import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://plsvbuzcjtztpidsjmua.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdminClient() {
  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurado en el servidor');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function POST(request: Request) {
  try {
    const supabase = getAdminClient();
    const body = await request.json();
    const {
      store,
      salePayload,
      cart,
      paymentsToInsert
    } = body;

    if (!salePayload || !Array.isArray(cart) || cart.length === 0) {
      return NextResponse.json({ error: 'Datos de venta o carrito inválidos' }, { status: 400 });
    }

    // 1. Insert pos_sales row
    const { data: newSale, error: saleErr } = await supabase
      .from('pos_sales')
      .insert([salePayload])
      .select()
      .single();

    if (saleErr) {
      console.error('Error insert pos_sales:', saleErr);
      return NextResponse.json({ error: saleErr.message }, { status: 500 });
    }

    const consecutive = newSale.consecutive;
    const storeName = store?.nombre || 'POS';
    const prefix = storeName.substring(0, 3).toUpperCase();
    const docRef = `Venta POS #${prefix}-${String(consecutive).padStart(4, '0')}`;
    const vendedor = salePayload.vendedor || 'Vendedor';

    // Collect all barcodes for this entire sale to store in sale observations
    const allSaleBarcodes: string[] = [];
    for (const item of cart) {
      if (Array.isArray(item.barcodes)) {
        item.barcodes.forEach((b: string) => {
          if (b && !allSaleBarcodes.includes(b)) allSaleBarcodes.push(b);
        });
      }
    }

    if (allSaleBarcodes.length > 0) {
      const barcodeTag = `[BARCODES: ${allSaleBarcodes.join(', ')}]`;
      const updatedObs = salePayload.observaciones 
        ? `${salePayload.observaciones} | ${barcodeTag}` 
        : barcodeTag;
      
      await supabase
        .from('pos_sales')
        .update({ observaciones: updatedObs })
        .eq('id', newSale.id);
    }

    // 2. Process each item in cart
    for (const cartItem of cart) {
      // 2.1 Insert pos_sale_items
      await supabase.from('pos_sale_items').insert({
        sale_id: newSale.id,
        product_id: cartItem.product_id,
        color_id: cartItem.color_id,
        size_id: cartItem.size_id,
        cantidad: cartItem.cantidad,
        precio_unitario: cartItem.precio,
        subtotal: cartItem.precio * cartItem.cantidad,
        total: cartItem.precio * cartItem.cantidad
      });

      const qtyToDeduct = Number(cartItem.cantidad) || 1;
      const isDevolucion = qtyToDeduct < 0;
      const movType = isDevolucion ? 'Devolución' : 'Venta POS';

      // 2.2 Identify physical warehouse and garment tags from barcodes
      const directBarcodes: string[] = Array.isArray(cartItem.barcodes) ? cartItem.barcodes.filter(Boolean) : [];
      let garmentWarehouseId: string | null = null;
      let matchedGarmentRows: any[] = [];

      if (directBarcodes.length > 0) {
        const { data: gRows } = await supabase
          .from('individual_garments')
          .select('id, barcode, warehouse_id, store_id, status, reference_name, color_name, size_code')
          .in('barcode', directBarcodes);
        
        if (gRows && gRows.length > 0) {
          matchedGarmentRows = gRows;
          const whFound = gRows.find(g => g.warehouse_id)?.warehouse_id;
          if (whFound) garmentWarehouseId = whFound;
        }

        // DIRECTLY UPDATE INDIVIDUAL_GARMENTS: Disassociate warehouse and store upon sale
        // Note: individual_garments has a check constraint (Pendiente, Aprobada, Reproceso, Rechazada)
        // Disassociating warehouse_id and store_id immediately removes it from warehouse and POS inventory views.
        const { error: updErr } = await supabase
          .from('individual_garments')
          .update({
            warehouse_id: null,
            store_id: null,
            updated_at: new Date().toISOString(),
            notes: `${docRef} - Vendedor: ${vendedor}`
          })
          .in('barcode', directBarcodes);
        
        if (updErr) {
          console.error('Error updating individual_garments by barcode:', updErr);
        }
      }

      // If no barcodes attached or extra qty, attempt matching by ref, size, color
      const remainingQtyToMark = Math.max(0, qtyToDeduct - directBarcodes.length);
      if (remainingQtyToMark > 0) {
        // Resolve item names for exact matching
        let refQueryName = (cartItem.reference_name || cartItem.nombre || '').replace(/\s*premium\s*/gi, '').trim();
        let colQueryName = cartItem.color_name || '';
        let szQueryCode = cartItem.size_name || cartItem.size_code || '';

        // If names not in cartItem, fetch product/color/size names
        if (!refQueryName && cartItem.product_id) {
          const { data: pData } = await supabase.from('products').select('nombre_producto, codigo_referencia').eq('id', cartItem.product_id).maybeSingle();
          if (pData) refQueryName = (pData.nombre_producto || pData.codigo_referencia || '').replace(/\s*premium\s*/gi, '').trim();
        }
        if (!colQueryName && cartItem.color_id) {
          const { data: cData } = await supabase.from('colors').select('nombre_color').eq('id', cartItem.color_id).maybeSingle();
          if (cData) colQueryName = cData.nombre_color;
        }
        if (!szQueryCode && cartItem.size_id) {
          const { data: sData } = await supabase.from('sizes').select('codigo_talla, nombre_talla').eq('id', cartItem.size_id).maybeSingle();
          if (sData) szQueryCode = sData.codigo_talla || sData.nombre_talla;
        }

        let gQuery = supabase
          .from('individual_garments')
          .select('id, barcode')
          .in('status', ['Aprobada', 'Terminada', 'En Inventario', 'Recibido', 'Disponible']);
        
        if (refQueryName) {
          gQuery = gQuery.ilike('reference_name', `%${refQueryName}%`);
        }
        if (colQueryName) {
          gQuery = gQuery.ilike('color_name', `%${colQueryName.trim()}%`);
        }
        if (szQueryCode) {
          gQuery = gQuery.eq('size_code', szQueryCode.trim());
        }

        if (garmentWarehouseId || store?.bodega_asociada_id) {
          const wId = garmentWarehouseId || store.bodega_asociada_id;
          gQuery = gQuery.or(`warehouse_id.eq.${wId},store_id.eq.${store.id}`);
        } else if (store?.id) {
          gQuery = gQuery.eq('store_id', store.id);
        }

        const { data: localGarms } = await gQuery.limit(remainingQtyToMark);
        if (localGarms && localGarms.length > 0) {
          await supabase
            .from('individual_garments')
            .update({
              warehouse_id: null,
              store_id: null,
              updated_at: new Date().toISOString(),
              notes: `${docRef} - Vendedor: ${vendedor}`
            })
            .in('id', localGarms.map(g => g.id));

          // Also append these matched barcodes to sale barcodes
          localGarms.forEach(g => {
            if (g.barcode && !allSaleBarcodes.includes(g.barcode)) {
              allSaleBarcodes.push(g.barcode);
            }
          });
        }
      }

      // 2.3 Resolve target warehouse for finished_goods_stock
      let whId = garmentWarehouseId || store?.bodega_asociada_id;
      if (!whId && store?.id) {
        const { data: storeRow } = await supabase
          .from('stores')
          .select('bodega_asociada_id')
          .eq('id', store.id)
          .maybeSingle();
        if (storeRow?.bodega_asociada_id) whId = storeRow.bodega_asociada_id;
      }

      // 2.4 Deduct finished_goods_stock & finished_goods_kardex
      if (whId) {
        let targetStock: any = null;

        // Try exact match product + size + color
        let q1 = supabase.from('finished_goods_stock').select('*')
          .eq('warehouse_id', whId)
          .eq('product_id', cartItem.product_id);
        if (cartItem.size_id) q1 = q1.eq('size_id', cartItem.size_id);
        if (cartItem.color_id) q1 = q1.eq('color_id', cartItem.color_id);
        const { data: d1 } = await q1;
        if (d1 && d1.length > 0) targetStock = d1[0];

        // Fallback exact product + size
        if (!targetStock && cartItem.size_id) {
          const { data: d2 } = await supabase.from('finished_goods_stock').select('*')
            .eq('warehouse_id', whId)
            .eq('product_id', cartItem.product_id)
            .eq('size_id', cartItem.size_id)
            .order('cantidad_disponible', { ascending: false });
          if (d2 && d2.length > 0) targetStock = d2[0];
        }

        // Fallback any row with product in this warehouse
        if (!targetStock) {
          const { data: d3 } = await supabase.from('finished_goods_stock').select('*')
            .eq('warehouse_id', whId)
            .eq('product_id', cartItem.product_id)
            .order('cantidad_disponible', { ascending: false });
          if (d3 && d3.length > 0) targetStock = d3[0];
        }

        let currentQty = 0;
        let finalSizeId = cartItem.size_id;
        let finalColorId = cartItem.color_id;

        if (targetStock) {
          currentQty = Number(targetStock.cantidad_disponible) || 0;
          finalSizeId = targetStock.size_id || cartItem.size_id;
          finalColorId = targetStock.color_id || cartItem.color_id;
          const newQty = currentQty - qtyToDeduct;

          await supabase.from('finished_goods_stock')
            .update({
              cantidad_disponible: newQty,
              updated_at: new Date().toISOString()
            })
            .eq('id', targetStock.id);
        } else {
          const newQty = 0 - qtyToDeduct;
          await supabase.from('finished_goods_stock').insert([{
            warehouse_id: whId,
            product_id: cartItem.product_id,
            size_id: cartItem.size_id || null,
            color_id: cartItem.color_id || null,
            cantidad_disponible: newQty,
            cantidad_reservada: 0,
            cantidad_en_transito: 0
          }]);
        }

        // Insert Kardex movement
        await supabase.from('finished_goods_kardex').insert([{
          warehouse_dest_id: whId,
          product_id: cartItem.product_id,
          color_id: finalColorId || null,
          size_id: finalSizeId || null,
          tipo_movimiento: movType,
          cantidad: Math.abs(qtyToDeduct),
          saldo_anterior: currentQty,
          saldo_nuevo: currentQty - qtyToDeduct,
          documento_origen: docRef,
          usuario: vendedor
        }]);
      }

      // 2.5 Also update store_inventory if store rows exist
      if (store?.id) {
        try {
          const { data: sData } = await supabase.from('store_inventory').select('*')
            .eq('store_id', store.id)
            .eq('product_id', cartItem.product_id);
          
          if (sData && sData.length > 0) {
            const sStock = sData[0];
            const sCurrentQty = Number(sStock.cantidad_disponible) || 0;
            await supabase.from('store_inventory')
              .update({
                cantidad_disponible: sCurrentQty - qtyToDeduct,
                updated_at: new Date().toISOString()
              })
              .eq('id', sStock.id);

            await supabase.from('store_kardex').insert([{
              store_id: store.id,
              product_id: cartItem.product_id,
              color_id: cartItem.color_id || null,
              size_id: cartItem.size_id || null,
              tipo_movimiento: movType,
              cantidad: Math.abs(qtyToDeduct),
              saldo_anterior: sCurrentQty,
              saldo_nuevo: sCurrentQty - qtyToDeduct,
              documento_ref: docRef,
              usuario: vendedor
            }]);
          }
        } catch (eStore) {
          console.warn('store_inventory update warning:', eStore);
        }
      }
    }

    // 3. Process payments
    if (Array.isArray(paymentsToInsert) && paymentsToInsert.length > 0) {
      for (const p of paymentsToInsert) {
        await supabase.from('pos_payments').insert({
          sale_id: newSale.id,
          metodo_pago: p.metodo_pago,
          monto: p.monto
        });
      }
    }

    // 4. If allSaleBarcodes was enriched during item processing, update pos_sales observaciones
    if (allSaleBarcodes.length > 0) {
      const barcodeTag = `[BARCODES: ${allSaleBarcodes.join(', ')}]`;
      const currentObs = (salePayload.observaciones || '').replace(/\|\s*\[BARCODES:[^\]]+\]/gi, '').replace(/\[BARCODES:[^\]]+\]/gi, '').trim();
      const finalObs = currentObs ? `${currentObs} | ${barcodeTag}` : barcodeTag;

      await supabase
        .from('pos_sales')
        .update({ observaciones: finalObs })
        .eq('id', newSale.id);
    }

    return NextResponse.json({
      success: true,
      sale: newSale
    });
  } catch (err: any) {
    console.error('API /api/pos/sales error:', err);
    return NextResponse.json({ error: err.message || 'Error procesando venta en base de datos' }, { status: 500 });
  }
}
