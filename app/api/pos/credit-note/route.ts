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
    const { saleId, reason = 'Anulación / Devolución por Nota Crédito', userEmail } = body;

    if (!saleId) {
      return NextResponse.json({ error: 'ID de venta requerido' }, { status: 400 });
    }

    // 1. Fetch sale with store and items
    const { data: sale, error: fetchErr } = await supabase
      .from('pos_sales')
      .select('*, stores(id, codigo, nombre, bodega_asociada_id), pos_sale_items(*, products(*), colors(*), sizes(*))')
      .eq('id', saleId)
      .single();

    if (fetchErr || !sale) {
      return NextResponse.json({ error: 'Venta no encontrada: ' + (fetchErr?.message || '') }, { status: 404 });
    }

    if (sale.estado === 'anulada') {
      return NextResponse.json({ error: 'Esta venta ya fue anulada previamente con Nota Crédito.' }, { status: 400 });
    }

    const store = sale.stores;
    const storeCode = (store?.codigo || (store?.nombre || 'POS').substring(0, 3)).toUpperCase();
    const ticketRef = `${storeCode}-${String(sale.consecutive).padStart(4, '0')}`;
    const targetWarehouseId = store?.bodega_asociada_id || null;

    // 2. Extract barcodes from sale observations and items
    const barcodesToRestore: string[] = [];
    const obs = sale.observaciones || '';
    const barcodeMatch = obs.match(/\[BARCODES:\s*([^\]]+)\]/i);
    if (barcodeMatch && barcodeMatch[1]) {
      barcodeMatch[1].split(',').forEach((b: string) => {
        const clean = b.trim();
        if (clean && !barcodesToRestore.includes(clean)) barcodesToRestore.push(clean);
      });
    }

    // 3. Mark sale as 'anulada'
    const noteTag = `[NOTA CRÉDITO: ${reason} por ${userEmail || 'Admin'} - ${new Date().toLocaleString('es-CO')}]`;
    const updatedObs = obs ? `${obs} | ${noteTag}` : noteTag;

    const { error: updateSaleErr } = await supabase
      .from('pos_sales')
      .update({
        estado: 'anulada',
        observaciones: updatedObs
      })
      .eq('id', saleId);

    if (updateSaleErr) {
      throw updateSaleErr;
    }

    // 4. Restore individual_garments
    let restoredGarmentsCount = 0;
    if (barcodesToRestore.length > 0 && targetWarehouseId) {
      const { data: updatedGarms, error: gErr } = await supabase
        .from('individual_garments')
        .update({
          warehouse_id: targetWarehouseId,
          store_id: store?.id || null,
          status: 'Aprobada',
          notes: `Restaurada por Nota Crédito (${ticketRef}) - ${reason}`,
          updated_at: new Date().toISOString()
        })
        .in('barcode', barcodesToRestore)
        .select();

      if (!gErr && updatedGarms) {
        restoredGarmentsCount = updatedGarms.length;
      }
    }

    // 5. Restore finished_goods_stock and insert kardex movements
    const items = sale.pos_sale_items || [];
    for (const item of items) {
      const qty = Number(item.cantidad) || 1;
      if (qty <= 0) continue;

      if (targetWarehouseId) {
        // Find existing stock in warehouse
        let stockQuery = supabase
          .from('finished_goods_stock')
          .select('*')
          .eq('warehouse_id', targetWarehouseId)
          .eq('product_id', item.product_id);

        if (item.size_id) stockQuery = stockQuery.eq('size_id', item.size_id);
        if (item.color_id) stockQuery = stockQuery.eq('color_id', item.color_id);

        const { data: existingStocks } = await stockQuery;
        const targetStock = existingStocks && existingStocks.length > 0 ? existingStocks[0] : null;

        if (targetStock) {
          const prevQty = Number(targetStock.cantidad_disponible) || 0;
          const newQty = prevQty + qty;

          await supabase
            .from('finished_goods_stock')
            .update({
              cantidad_disponible: newQty,
              updated_at: new Date().toISOString()
            })
            .eq('id', targetStock.id);

          // Kardex entry
          await supabase.from('finished_goods_kardex').insert({
            warehouse_id: targetWarehouseId,
            product_id: item.product_id,
            size_id: item.size_id || null,
            color_id: item.color_id || null,
            tipo_movimiento: 'Devolución Venta POS (Nota Crédito)',
            cantidad: qty,
            cantidad_anterior: prevQty,
            cantidad_nueva: newQty,
            documento_referencia: `Nota Crédito #${ticketRef}`,
            observaciones: `Devolución y anulación de venta POS #${ticketRef}: ${reason}`,
            created_at: new Date().toISOString()
          });
        } else {
          // If no row existed, insert new row in finished_goods_stock
          await supabase.from('finished_goods_stock').insert({
            warehouse_id: targetWarehouseId,
            product_id: item.product_id,
            size_id: item.size_id || null,
            color_id: item.color_id || null,
            cantidad_disponible: qty,
            cantidad_reservada: 0,
            updated_at: new Date().toISOString()
          });

          await supabase.from('finished_goods_kardex').insert({
            warehouse_id: targetWarehouseId,
            product_id: item.product_id,
            size_id: item.size_id || null,
            color_id: item.color_id || null,
            tipo_movimiento: 'Devolución Venta POS (Nota Crédito)',
            cantidad: qty,
            cantidad_anterior: 0,
            cantidad_nueva: qty,
            documento_referencia: `Nota Crédito #${ticketRef}`,
            observaciones: `Devolución y anulación de venta POS #${ticketRef}: ${reason}`,
            created_at: new Date().toISOString()
          });
        }
      } else if (store?.id) {
        // Fallback store_inventory if no bodega_asociada_id
        const { data: storeStocks } = await supabase
          .from('store_inventory')
          .select('*')
          .eq('store_id', store.id)
          .eq('product_id', item.product_id);

        if (storeStocks && storeStocks.length > 0) {
          const st = storeStocks[0];
          await supabase
            .from('store_inventory')
            .update({
              cantidad_disponible: (Number(st.cantidad_disponible) || 0) + qty,
              updated_at: new Date().toISOString()
            })
            .eq('id', st.id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Nota Crédito procesada exitosamente para el ticket ${ticketRef}. Inventario restaurado (${restoredGarmentsCount} prendas serializadas reincorporadas a bodega).`,
      ticket: ticketRef,
      restoredGarmentsCount
    });
  } catch (error: any) {
    console.error('Error generating credit note:', error);
    return NextResponse.json({
      error: error.message || 'Error al procesar la Nota Crédito'
    }, { status: 500 });
  }
}
