import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurado en el servidor.' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const body = await req.json();
    const { items, docName, userEmail } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'La lista de items está vacía o es inválida.' }, { status: 400 });
    }

    // 1. Obtener bodega principal activa
    const { data: warehouses, error: whErr } = await supabaseAdmin
      .from('warehouses')
      .select('id, nombre_bodega')
      .eq('estado', 'activo');

    if (whErr || !warehouses || warehouses.length === 0) {
      return NextResponse.json({ error: 'No se encontraron bodegas activas en el sistema.' }, { status: 500 });
    }

    const defaultWarehouse = warehouses.find(w => w.nombre_bodega.toLowerCase().includes('principal')) || warehouses[0];
    const defaultWarehouseId = defaultWarehouse.id;

    // 2. Cargar maestros para mapear IDs a Nombres
    const { data: products } = await supabaseAdmin.from('products').select('id, nombre_producto, codigo_referencia, name');
    const { data: colors } = await supabaseAdmin.from('colors').select('id, nombre_color');
    const { data: sizes } = await supabaseAdmin.from('sizes').select('id, codigo_talla');

    const productMap = new Map(products?.map(p => [p.id, p.nombre_producto || p.name || p.codigo_referencia || '']));
    const colorMap = new Map(colors?.map(c => [c.id, c.nombre_color]));
    const sizeMap = new Map(sizes?.map(s => [s.id, s.codigo_talla]));

    // 3. Determinar el consecutivo más alto de código de barras
    let { data: maxGarment, error: maxErr } = await supabaseAdmin
      .from('individual_garments')
      .select('barcode')
      .like('barcode', '__________') // exactly 10 digits
      .order('barcode', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxErr) {
      return NextResponse.json({ error: 'Error al consultar código de barras (10 dgt): ' + maxErr.message }, { status: 500 });
    }

    if (!maxGarment?.barcode) {
      const fallbackQuery = await supabaseAdmin
        .from('individual_garments')
        .select('barcode')
        .like('barcode', '________') // fallback exactly 8 digits
        .order('barcode', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallbackQuery.error) {
        return NextResponse.json({ error: 'Error al consultar código de barras (8 dgt): ' + fallbackQuery.error.message }, { status: 500 });
      }
      maxGarment = fallbackQuery.data;
    }

    let maxGlobalSeq = 0;
    if (maxGarment?.barcode) {
      const num = parseInt(maxGarment.barcode, 10);
      if (!isNaN(num)) {
        maxGlobalSeq = num;
      }
    }

    const inserts: any[] = [];
    const stockUpdates: Record<string, { productId: string; colorId: string | null; sizeId: string; qty: number; notes: string }> = {};

    // 4. Procesar cada item para generar las prendas individuales
    for (const item of items) {
      const { productId, colorId, sizeId, qty, notes } = item;
      const parsedQty = Math.floor(Number(qty)) || 0;

      if (!productId || !sizeId || parsedQty <= 0) {
        continue;
      }

      // Nombre del producto, color y talla
      const pName = productMap.get(productId) || 'Producto Desconocido';
      const cName = colorId ? (colorMap.get(colorId) || '—') : '—';
      const sCode = sizeMap.get(sizeId) || 'ST';

      // Generar registros individuales
      for (let i = 0; i < parsedQty; i++) {
        maxGlobalSeq++;
        const nextBarcode = maxGlobalSeq.toString().padStart(10, '0');

        inserts.push({
          barcode: nextBarcode,
          reference_name: pName,
          color_name: cName,
          size_code: sCode,
          status: 'Aprobada',
          is_historical: true,
          historical_doc: docName || 'Inventario Histórico',
          notes: notes || 'Ingreso por Inventario Histórico',
          defect_checklist: { origen: 'inventario_historico' }
        });
      }

      // Consolidar cantidades por combinación para actualizar stock disponible y Kardex
      const key = `${productId}_${colorId || 'null'}_${sizeId}`;
      if (!stockUpdates[key]) {
        stockUpdates[key] = {
          productId,
          colorId: colorId || null,
          sizeId,
          qty: 0,
          notes: notes || 'Ingreso de lote histórico'
        };
      }
      stockUpdates[key].qty += parsedQty;
    }

    if (inserts.length === 0) {
      return NextResponse.json({ error: 'No se procesaron prendas válidas para el inventario.' }, { status: 400 });
    }

    // 5. Insertar prendas individuales en lotes en la base de datos
    const { error: insErr } = await supabaseAdmin.from('individual_garments').insert(inserts);
    if (insErr) {
      return NextResponse.json({ error: 'Error al registrar prendas individuales: ' + insErr.message }, { status: 500 });
    }

    // 6. Actualizar stock y Kardex de inventario consolidado
    for (const update of Object.values(stockUpdates)) {
      const { productId, colorId, sizeId, qty, notes } = update;

      // Buscar stock existente
      let stockQuery = supabaseAdmin
        .from('finished_goods_stock')
        .select('*')
        .eq('warehouse_id', defaultWarehouseId)
        .eq('product_id', productId)
        .eq('size_id', sizeId)
        .is('location_id', null);

      if (colorId) {
        stockQuery = stockQuery.eq('color_id', colorId);
      } else {
        stockQuery = stockQuery.is('color_id', null);
      }

      // historical load doesn't use fabric_id
      stockQuery = stockQuery.is('fabric_id', null);

      const { data: stockRecords, error: stockFetchErr } = await stockQuery.limit(1);
      if (stockFetchErr) {
        console.error('Error fetching stock record:', stockFetchErr);
        continue;
      }

      const existingRecord = stockRecords?.[0];
      const saldoAnterior = existingRecord ? Number(existingRecord.cantidad_disponible) : 0;
      const saldoNuevo = saldoAnterior + qty;

      if (existingRecord) {
        await supabaseAdmin
          .from('finished_goods_stock')
          .update({ cantidad_disponible: saldoNuevo, updated_at: new Date().toISOString() })
          .eq('id', existingRecord.id);
      } else {
        await supabaseAdmin
          .from('finished_goods_stock')
          .insert({
            warehouse_id: defaultWarehouseId,
            product_id: productId,
            color_id: colorId || null,
            fabric_id: null,
            size_id: sizeId,
            cantidad_disponible: qty
          });
      }

      // Registrar movimiento de ingreso en el Kardex
      await supabaseAdmin
        .from('finished_goods_kardex')
        .insert({
          product_id: productId,
          color_id: colorId || null,
          fabric_id: null,
          size_id: sizeId,
          tipo_movimiento: 'Ingreso por Inventario Histórico',
          cantidad: qty,
          saldo_anterior: saldoAnterior,
          saldo_nuevo: saldoNuevo,
          warehouse_dest_id: defaultWarehouseId,
          documento_origen: docName || 'Inventario Histórico',
          usuario: userEmail || 'Sistema',
          observaciones: notes || 'Carga inicial de inventario histórico'
        });
    }

    return NextResponse.json({
      success: true,
      createdCount: inserts.length,
      garments: inserts
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno de servidor.' }, { status: 500 });
  }
}
