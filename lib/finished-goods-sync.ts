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

    // 4. Actualizar inventario físico y Kardex para cada ítem resuelto
    for (const item of stockItemsToProcess) {
      console.log(`Sincronizando SKU: Prod=${item.productId}, Color=${item.colorId}, Talla=${item.sizeId}, Qty=${item.qty}`);

      const query = supabase
        .from('finished_goods_stock')
        .select('*')
        .eq('warehouse_id', defaultWarehouse.id)
        .eq('product_id', item.productId)
        .eq('size_id', item.sizeId)
        .is('location_id', null);

      if (item.colorId) {
        query.eq('color_id', item.colorId);
      } else {
        query.is('color_id', null);
      }

      const { data: stockRecords } = await query;
      const existingStock = stockRecords?.[0];
      const saldoAnterior = existingStock ? Number(existingStock.cantidad_disponible) : 0;
      const saldoNuevo = saldoAnterior + item.qty;

      if (existingStock) {
        await supabase
          .from('finished_goods_stock')
          .update({
            cantidad_disponible: saldoNuevo,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingStock.id);
      } else {
        await supabase
          .from('finished_goods_stock')
          .insert({
            warehouse_id: defaultWarehouse.id,
            location_id: null,
            product_id: item.productId,
            color_id: item.colorId,
            size_id: item.sizeId,
            cantidad_disponible: item.qty
          });
      }

      // Registrar movimiento de Kardex
      await supabase
        .from('finished_goods_kardex')
        .insert({
          product_id: item.productId,
          color_id: item.colorId,
          size_id: item.sizeId,
          tipo_movimiento: 'Ingreso por aprobación de calidad',
          cantidad: item.qty,
          saldo_anterior: saldoAnterior,
          saldo_nuevo: saldoNuevo,
          warehouse_dest_id: defaultWarehouse.id,
          documento_origen: `Inspección #${inspectionId}`,
          usuario: inspection.usuario || 'Sistema - Calidad',
          observaciones: `Aprobación automática de prendas de la orden de confección ${inspection.sewing_orders?.confeccion_code || ''}`
        });
    }

    console.log(`✓ Sincronización de inventario terminada para la inspección ${inspectionId}.`);
  } catch (err) {
    console.error('Error in syncQualityApprovalToInventory:', err);
  }
}
