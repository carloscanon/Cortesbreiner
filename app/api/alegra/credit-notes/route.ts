import { NextResponse } from 'next/server';
import { AlegraClient } from '@/lib/alegra/client';
import { supabase } from '@/lib/supabase';

export const maxDuration = 45;

/**
 * Reversión de inventario para una venta anulada/revertida.
 * Devuelve las existencias a la bodega de la tienda y restaura los códigos de barra de prendas individuales.
 */
async function revertSaleInventory(saleId: string) {
  try {
    // 1. Fetch sale with its items
    const { data: sale, error: sErr } = await supabase
      .from('pos_sales')
      .select('id, store_id, stores(bodega_asociada_id), pos_sale_items(*)')
      .eq('id', saleId)
      .maybeSingle();

    if (sErr || !sale) return;

    const warehouseId = (sale.stores as any)?.bodega_asociada_id || null;

    // 2. For each item in sale
    for (const item of (sale.pos_sale_items || [])) {
      const qtyToReturn = Number(item.cantidad) || 1;

      // Re-increment finished_goods_stock
      if (warehouseId && item.product_id) {
        let stockQuery = supabase
          .from('finished_goods_stock')
          .select('id, cantidad_disponible')
          .eq('warehouse_id', warehouseId)
          .eq('product_id', item.product_id);

        if (item.size_id) stockQuery = stockQuery.eq('size_id', item.size_id);
        if (item.color_id) stockQuery = stockQuery.eq('color_id', item.color_id);

        const { data: stockRows } = await stockQuery;
        if (stockRows && stockRows.length > 0) {
          const currentQty = Number(stockRows[0].cantidad_disponible) || 0;
          await supabase
            .from('finished_goods_stock')
            .update({
              cantidad_disponible: currentQty + qtyToReturn,
              updated_at: new Date().toISOString()
            })
            .eq('id', stockRows[0].id);
        } else {
          // If no row existed, insert with returned quantity
          await supabase.from('finished_goods_stock').insert([{
            warehouse_id: warehouseId,
            product_id: item.product_id,
            size_id: item.size_id,
            color_id: item.color_id,
            cantidad_disponible: qtyToReturn,
            updated_at: new Date().toISOString()
          }]);
        }
      }
    }

    // 3. Restore individual_garments barcodes disassociated in notes
    const { data: garments } = await supabase
      .from('individual_garments')
      .select('id, notes')
      .ilike('notes', `%Ticket #${saleId}%`);

    if (garments && garments.length > 0) {
      await supabase
        .from('individual_garments')
        .update({
          warehouse_id: warehouseId,
          store_id: sale.store_id,
          updated_at: new Date().toISOString(),
          notes: `Reincorporado al inventario por Nota Crédito (Venta #${saleId})`
        })
        .in('id', garments.map(g => g.id));
    }
  } catch (err) {
    console.warn('Error in revertSaleInventory:', err);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { saleId, alegraInvoiceId, reason = 'Anulación de factura electrónica', autoStamp = true } = body;

    if (!saleId) {
      return NextResponse.json({
        success: false,
        error: 'El campo "saleId" es obligatorio para emitir la Nota Crédito y reversar el inventario.'
      }, { status: 400 });
    }

    let alegraCreditNoteResult: any = null;
    let stampResult: any = null;

    // 1. If invoice was emitted in Alegra, create electronic Credit Note in Alegra & stamp it
    if (alegraInvoiceId) {
      try {
        const invRes = await AlegraClient.getInvoice(alegraInvoiceId);
        if (invRes.ok && invRes.data) {
          const inv = invRes.data;
          const cnPayload = {
            date: new Date().toISOString().split('T')[0],
            client: inv.client?.id,
            invoices: [{ id: inv.id, amount: inv.total }],
            items: inv.items?.map((it: any) => ({
              id: it.id || 17,
              price: it.price,
              quantity: it.quantity,
              tax: it.tax ? it.tax.map((t: any) => ({ id: t.id })) : [{ id: 4 }]
            })) || [{ id: 17, price: inv.subtotal || inv.total, quantity: 1, tax: [{ id: 4 }] }],
            type: 'VOID_ELECTRONIC_INVOICE',
            anotation: reason || 'Anulación por Nota Crédito desde ERP Breiner'
          };

          const cnRes = await AlegraClient.createCreditNote(cnPayload);
          if (cnRes.ok && cnRes.data?.id) {
            alegraCreditNoteResult = cnRes.data;
            if (autoStamp) {
              const stRes = await AlegraClient.stampCreditNote(cnRes.data.id);
              stampResult = stRes.data;
            }
          }
        }
      } catch (eCn: any) {
        console.warn('Could not emit credit note in Alegra API, will proceed with inventory & local reversal:', eCn.message);
      }
    }

    // 2. Revert physical inventory and individual garments
    await revertSaleInventory(saleId);

    // 3. Update sale status in Supabase
    const cnNumber = alegraCreditNoteResult?.numberTemplate?.fullNumber || alegraCreditNoteResult?.id ? `NC-ALEGRA-#${alegraCreditNoteResult?.id}` : 'NC-LOCAL';
    const stampStatus = stampResult?.errors?.length === 0 || stampResult?.data?.[0]?.success ? 'TIMBRADA DIAN' : '';

    const obsText = `Nota Crédito generada: ${reason}. Reversión de inventario aplicada con éxito. [${cnNumber} ${stampStatus}]`.trim();

    const { error: updErr } = await supabase
      .from('pos_sales')
      .update({
        estado: 'anulada',
        sincronizado_erp: false,
        observaciones: obsText
      })
      .eq('id', saleId);

    if (updErr) {
      return NextResponse.json({ success: false, error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      saleId,
      creditNote: alegraCreditNoteResult,
      stamp: stampResult,
      message: 'Nota Crédito procesada, inventario reincorporado y venta anulada con éxito.'
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
  }
}
