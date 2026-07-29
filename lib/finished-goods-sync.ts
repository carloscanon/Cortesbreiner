import { supabase } from './supabase';

/**
 * Registra automáticamente el ingreso de prendas aprobadas al inventario de producto terminado.
 */
export async function syncQualityApprovalToInventory(inspectionId: string) {
  try {
    // 1. Obtener la inspección de calidad
    const { data: inspection, error: insErr } = await supabase
      .from('quality_inspections')
      .select(`
        *,
        orders (
          id,
          consecutive,
          internal_code,
          client_name
        ),
        sewing_orders (
          id,
          confeccion_code,
          product_id,
          workshop_id
        )
      `)
      .eq('id', inspectionId)
      .single();

    if (insErr || !inspection) {
      console.error('Error fetching inspection for inventory sync:', insErr);
      return;
    }

    // Solo procesar si el estado es Aprobado
    if (inspection.status !== 'Aprobado') {
      console.log(`Inspección ${inspectionId} no está aprobada (Estado: ${inspection.status}). No se sincroniza stock.`);
      return;
    }

    // Evitar duplicar el ingreso si ya se registró para esta inspección
    const { data: existingMovs } = await supabase
      .from('finished_goods_kardex')
      .select('id')
      .eq('documento_origen', `Inspección #${inspectionId}`)
      .limit(1);

    if (existingMovs && existingMovs.length > 0) {
      console.log(`El ingreso para la Inspección #${inspectionId} ya existe en el Kardex. Omitiendo.`);
      return;
    }

    // 2. Obtener la bodega de destino por defecto (Bodega Principal o la primera disponible)
    const { data: warehouses } = await supabase
      .from('warehouses')
      .select('id, nombre_bodega')
      .eq('estado', 'activo');
    
    let defaultWarehouse = warehouses?.find(w => w.nombre_bodega.toLowerCase().includes('principal')) || warehouses?.[0];
    let laundryWarehouse = warehouses?.find(w => w.nombre_bodega.toLowerCase().includes('lavanderia'));
    let saldosWarehouse = warehouses?.find(w => w.nombre_bodega.toLowerCase().includes('saldos'));
    let incompletoWarehouse = warehouses?.find(w => w.nombre_bodega.toLowerCase().includes('incomplet'));

    if (!defaultWarehouse) {
      console.error('No active warehouses found to insert finished goods.');
      return;
    }

    // 3. Obtener prendas individuales asociadas a la inspección para procesar con detalle
    const { data: garments } = await supabase
      .from('individual_garments')
      .select('*')
      .eq('quality_inspection_id', inspectionId)
      .eq('status', 'Aprobada');

    // Mapear combinaciones a procesar
    const stockItemsToProcess: {
      productId: string;
      colorId: string | null;
      sizeId: string;
      qty: number;
    }[] = [];

    // Cargar maestros de tallas y colores para resolver ids
    const { data: sizes } = await supabase.from('sizes').select('id, codigo_talla');
    const { data: colors } = await supabase.from('colors').select('id, nombre_color');
    const { data: products } = await supabase.from('products').select('id, nombre_producto, name');

    const sizeMap = new Map(sizes?.map(s => [s.codigo_talla.toUpperCase().trim(), s.id]));
    const colorMap = new Map(colors?.map(c => [c.nombre_color.toUpperCase().trim(), c.id]));
    const productMap = new Map();
    products?.forEach(p => {
      if (p.nombre_producto) productMap.set(p.nombre_producto.toUpperCase().trim(), p.id);
      if (p.name) productMap.set(p.name.toUpperCase().trim(), p.id);
    });

    if (garments && garments.length > 0) {
      // Caso A: Usar prendas individuales aprobadas
      console.log(`Procesando ${garments.length} prendas individuales aprobadas.`);
      
      const counts: Record<string, number> = {};
      
      for (const g of garments) {
        // Encontrar product_id del parent_order o sewing_order
        let prodId = inspection.sewing_orders?.product_id;
        if (!prodId && g.reference_name) {
          prodId = productMap.get(g.reference_name.toUpperCase().trim());
        }
        
        // Encontrar color_id
        let colorId = null;
        if (g.color_name && g.color_name !== '—') {
          colorId = colorMap.get(g.color_name.toUpperCase().trim());
        }
        
        // Encontrar size_id
        const sizeId = g.size_code ? sizeMap.get(g.size_code.toUpperCase().trim()) : null;

        if (!prodId || !sizeId) {
          console.warn(`No se pudo resolver producto o talla para la prenda: ${g.barcode}. Prod: ${prodId}, Talla: ${sizeId}`);
          continue;
        }

        const key = `${prodId}_${colorId || 'null'}_${sizeId}`;
        counts[key] = (counts[key] || 0) + 1;
      }

      Object.entries(counts).forEach(([key, qty]) => {
        const [productId, colorIdStr, sizeId] = key.split('_');
        stockItemsToProcess.push({
          productId,
          colorId: colorIdStr === 'null' ? null : colorIdStr,
          sizeId,
          qty
        });
      });
    } else {
      // Caso B: Si no hay prendas individuales, usar las cantidades globales aprobadas de la inspección
      console.log(`No hay prendas individuales. Usando cantidades de la inspección global (${inspection.items_approved} aprobados).`);
      
      const approvedQty = Number(inspection.items_approved) || 0;
      if (approvedQty <= 0) return;

      // Intentar obtener el producto de la orden de confección o buscar cortes asociados
      let productId = inspection.sewing_orders?.product_id;
      
      // Obtener cortes de la orden padre para saber color y talla
      const parentOrderId = inspection.order_id;
      if (parentOrderId) {
        const { data: cuts } = await supabase
          .from('cuts')
          .select(`
            *,
            cut_sizes(*)
          `)
          .eq('order_id', parentOrderId);
        
        if (cuts && cuts.length > 0) {
          const firstCut = cuts[0];
          productId = productId || firstCut.product_id;
          const colorId = firstCut.color_id;
          const sizeId = firstCut.cut_sizes?.[0]?.size_id;

          if (productId && sizeId) {
            stockItemsToProcess.push({
              productId,
              colorId,
              sizeId,
              qty: approvedQty
            });
          }
        }
      }

      // Fallback si no pudimos determinar del corte
      if (stockItemsToProcess.length === 0 && productId) {
        const defaultSizeId = sizes?.[0]?.id;
        if (defaultSizeId) {
          stockItemsToProcess.push({
            productId,
            colorId: null,
            sizeId: defaultSizeId,
            qty: approvedQty
          });
        }
      }
    }

    // Helper para actualizar stock y kardex en una bodega específica
    const syncWarehouseStock = async (whId: string, item: any, qty: number, tipoMov: string, obs: string) => {
      const query = supabase
        .from('finished_goods_stock')
        .select('*')
        .eq('warehouse_id', whId)
        .eq('product_id', item.productId)
        .eq('size_id', item.sizeId)
        .is('location_id', null);

      if (item.colorId) query.eq('color_id', item.colorId);
      else query.is('color_id', null);

      const { data: stockRecords } = await query;
      const existingStock = stockRecords?.[0];
      const saldoAnterior = existingStock ? Number(existingStock.cantidad_disponible) : 0;
      const saldoNuevo = saldoAnterior + qty;

      if (existingStock) {
        await supabase
          .from('finished_goods_stock')
          .update({ cantidad_disponible: saldoNuevo, updated_at: new Date().toISOString() })
          .eq('id', existingStock.id);
      } else {
        await supabase
          .from('finished_goods_stock')
          .insert({ warehouse_id: whId, location_id: null, product_id: item.productId, color_id: item.colorId, size_id: item.sizeId, cantidad_disponible: qty });
      }

      await supabase
        .from('finished_goods_kardex')
        .insert({
          product_id: item.productId,
          color_id: item.colorId,
          size_id: item.sizeId,
          tipo_movimiento: tipoMov,
          cantidad: qty,
          saldo_anterior: saldoAnterior,
          saldo_nuevo: saldoNuevo,
          warehouse_dest_id: whId,
          documento_origen: `Inspección #${inspectionId}`,
          usuario: inspection.usuario || 'Sistema - Calidad',
          observaciones: obs
        });
    };

    // 4. Distribuir stock entre Bodega Principal, Bodega Lavandería y Bodega Saldos
    let remainingLaundryToDeduct = Number(inspection.lavanderia) || 0;
    let remainingSaldosToDeduct = Number(inspection.saldos) || 0;

    for (const item of stockItemsToProcess) {
      const laundryDeduct = Math.min(item.qty, remainingLaundryToDeduct);
      remainingLaundryToDeduct -= laundryDeduct;

      const saldosDeduct = Math.min(item.qty - laundryDeduct, remainingSaldosToDeduct);
      remainingSaldosToDeduct -= saldosDeduct;

      const mainQty = item.qty - laundryDeduct - saldosDeduct;

      // 4a. Ingreso a Bodega 101 Principal (únicamente prendas aprobadas que no van a lavandería ni saldos)
      if (mainQty > 0) {
        console.log(`Sincronizando ${mainQty} prendas a Bodega Principal: Prod=${item.productId}, Color=${item.colorId}, Talla=${item.sizeId}`);
        await syncWarehouseStock(
          defaultWarehouse.id,
          item,
          mainQty,
          'Ingreso por aprobación de calidad',
          `Aprobación de prendas de la orden de confección ${inspection.sewing_orders?.confeccion_code || ''}`
        );
      }

      // 4b. Ingreso exclusivo a Bodega Lavanderia (Fabrica)
      if (laundryDeduct > 0 && laundryWarehouse) {
        console.log(`Sincronizando ${laundryDeduct} prendas a Bodega Lavanderia (Fabrica): Prod=${item.productId}, Color=${item.colorId}, Talla=${item.sizeId}`);
        await syncWarehouseStock(
          laundryWarehouse.id,
          item,
          laundryDeduct,
          'Ingreso a Bodega Lavandería (Fábrica)',
          `Prendas enviadas a proceso de lavado desde Inspección de Calidad de la orden ${inspection.sewing_orders?.confeccion_code || ''}`
        );
      }

      // 4c. Ingreso exclusivo a Bodega Saldos (Fabrica)
      if (saldosDeduct > 0 && saldosWarehouse) {
        console.log(`Sincronizando ${saldosDeduct} prendas a Bodega Saldos (Fabrica): Prod=${item.productId}, Color=${item.colorId}, Talla=${item.sizeId}`);
        await syncWarehouseStock(
          saldosWarehouse.id,
          item,
          saldosDeduct,
          'Ingreso a Bodega Saldos (Fábrica)',
          `Prendas clasificadas a saldos desde Inspección de Calidad de la orden ${inspection.sewing_orders?.confeccion_code || ''}`
        );
      }
    }

    // 4d. Ingreso exclusivo a Bodega Incompletos
    let remainingIncompletoToInsert = Number(inspection.incompleto) || 0;
    if (remainingIncompletoToInsert > 0 && incompletoWarehouse && stockItemsToProcess.length > 0) {
      const itemSample = stockItemsToProcess[0];
      console.log(`Sincronizando ${remainingIncompletoToInsert} prendas a Bodega Incompletos: Prod=${itemSample.productId}`);
      await syncWarehouseStock(
        incompletoWarehouse.id,
        itemSample,
        remainingIncompletoToInsert,
        'Ingreso por Faltantes / Lote Incompleto',
        `Prendas reportadas como faltantes/incompletas desde Inspección de Calidad de la orden ${inspection.sewing_orders?.confeccion_code || ''}`
      );
    }

    console.log(`✓ Sincronización de inventario terminada para la inspección ${inspectionId}.`);
  } catch (err) {
    console.error('Error in syncQualityApprovalToInventory:', err);
  }
}

/**
 * Revierte y descuenta del inventario físico y Kardex la sincronización previamente realizada para una inspección.
 */
export async function revertQualityApprovalFromInventory(inspectionId: string) {
  try {
    const docOrigin = `Inspección #${inspectionId}`;
    const { data: movs } = await supabase
      .from('finished_goods_kardex')
      .select('*')
      .eq('documento_origen', docOrigin);

    if (movs && movs.length > 0) {
      for (const m of movs) {
        const whId = m.warehouse_dest_id;
        if (!whId) continue;

        const query = supabase
          .from('finished_goods_stock')
          .select('*')
          .eq('warehouse_id', whId)
          .eq('product_id', m.product_id)
          .eq('size_id', m.size_id);

        if (m.color_id) query.eq('color_id', m.color_id);
        else query.is('color_id', null);

        const { data: stockRecords } = await query;
        const existingStock = stockRecords?.[0];

        if (existingStock) {
          const currentQty = Number(existingStock.cantidad_disponible) || 0;
          const newQty = Math.max(0, currentQty - (Number(m.cantidad) || 0));
          await supabase
            .from('finished_goods_stock')
            .update({ cantidad_disponible: newQty, updated_at: new Date().toISOString() })
            .eq('id', existingStock.id);
        }

        const saldoAnterior = existingStock ? Number(existingStock.cantidad_disponible) : 0;
        const saldoNuevo = Math.max(0, saldoAnterior - (Number(m.cantidad) || 0));
        await supabase.from('finished_goods_kardex').insert({
          product_id: m.product_id,
          color_id: m.color_id,
          size_id: m.size_id,
          tipo_movimiento: 'Reversión / Deshacer por SuperAdmin',
          cantidad: -(Number(m.cantidad) || 0),
          saldo_anterior: saldoAnterior,
          saldo_nuevo: saldoNuevo,
          warehouse_dest_id: whId,
          documento_origen: `Reversión Inspección #${inspectionId}`,
          usuario: 'SuperAdmin Master',
          observaciones: `Rollback ejecutado por SuperAdministrador para la inspección #${inspectionId}`
        });
      }

      await supabase.from('finished_goods_kardex').delete().eq('documento_origen', docOrigin);
      await supabase.from('finished_goods_inventory').delete().eq('quality_inspection_id', inspectionId);
      console.log(`✓ Inventario revertido exitosamente para la inspección #${inspectionId}.`);
    }
  } catch (err) {
    console.error('Error in revertQualityApprovalFromInventory:', err);
  }
}
