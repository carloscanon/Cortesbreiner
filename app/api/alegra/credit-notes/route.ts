import { NextResponse } from 'next/server';
import { AlegraClient } from '@/lib/alegra/client';
import { supabase } from '@/lib/supabase';

export const maxDuration = 45;

/**
 * Reversión de inventario para una venta anulada/revertida.
 * Devuelve las existencias a la bodega de la tienda y restaura los códigos de barra de prendas individuales.
 */
async function revertSaleInventory(saleId: string, reason?: string) {
  try {
    // 1. Fetch sale with its items and store
    const { data: sale, error: sErr } = await supabase
      .from('pos_sales')
      .select('id, consecutive, observaciones, store_id, stores(id, codigo, nombre, bodega_asociada_id), pos_sale_items(*)')
      .eq('id', saleId)
      .maybeSingle();

    if (sErr || !sale) return;

    let warehouseId = (sale.stores as any)?.bodega_asociada_id || null;
    if (!warehouseId && sale.store_id) {
      const { data: stRow } = await supabase
        .from('stores')
        .select('bodega_asociada_id')
        .eq('id', sale.store_id)
        .maybeSingle();
      if (stRow?.bodega_asociada_id) {
        warehouseId = stRow.bodega_asociada_id;
      }
    }
    if (!warehouseId) {
      warehouseId = '65797b78-39c1-4078-9475-80d7385823a6';
    }

    const store = sale.stores as any;
    const storeCode = (store?.codigo || (store?.nombre || 'POS').substring(0, 3)).toUpperCase();
    const ticketRef = `${storeCode}-${String(sale.consecutive || 0).padStart(4, '0')}`;

    // 2. For each item in sale, restore finished_goods_stock and kardex
    for (const item of (sale.pos_sale_items || [])) {
      const qtyToReturn = Number(item.cantidad) || 1;
      if (qtyToReturn <= 0) continue;

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

          await supabase.from('finished_goods_kardex').insert({
            warehouse_id: warehouseId,
            product_id: item.product_id,
            size_id: item.size_id || null,
            color_id: item.color_id || null,
            tipo_movimiento: 'Devolución Venta POS (Nota Crédito Alegra)',
            cantidad: qtyToReturn,
            cantidad_anterior: currentQty,
            cantidad_nueva: currentQty + qtyToReturn,
            documento_referencia: `Nota Crédito #${ticketRef}`,
            observaciones: `Devolución y reversión de inventario por Nota Crédito #${ticketRef}: ${reason || 'Anulación Alegra'}`,
            created_at: new Date().toISOString()
          });
        } else {
          // If no row existed, insert with returned quantity
          await supabase.from('finished_goods_stock').insert([{
            warehouse_id: warehouseId,
            product_id: item.product_id,
            size_id: item.size_id || null,
            color_id: item.color_id || null,
            cantidad_disponible: qtyToReturn,
            cantidad_reservada: 0,
            updated_at: new Date().toISOString()
          }]);

          await supabase.from('finished_goods_kardex').insert({
            warehouse_id: warehouseId,
            product_id: item.product_id,
            size_id: item.size_id || null,
            color_id: item.color_id || null,
            tipo_movimiento: 'Devolución Venta POS (Nota Crédito Alegra)',
            cantidad: qtyToReturn,
            cantidad_anterior: 0,
            cantidad_nueva: qtyToReturn,
            documento_referencia: `Nota Crédito #${ticketRef}`,
            observaciones: `Devolución y creación inicial de stock por Nota Crédito #${ticketRef}`,
            created_at: new Date().toISOString()
          });
        }
      }
    }

    // 3. Extract all barcodes associated with this sale
    const barcodesToRestore: string[] = [];
    const obs = sale.observaciones || '';
    const barcodeMatch = obs.match(/\[BARCODES:\s*([^\]]+)\]/i);
    if (barcodeMatch && barcodeMatch[1]) {
      barcodeMatch[1].split(',').forEach((b: string) => {
        const clean = b.trim();
        if (clean && !barcodesToRestore.includes(clean)) barcodesToRestore.push(clean);
      });
    }

    // Direct lookup by defect_checklist->>sale_id
    const { data: linkedGarments } = await supabase
      .from('individual_garments')
      .select('id, barcode')
      .filter('defect_checklist->>sale_id', 'eq', saleId);

    if (linkedGarments && linkedGarments.length > 0) {
      linkedGarments.forEach((g: any) => {
        if (g.barcode && !barcodesToRestore.includes(g.barcode)) {
          barcodesToRestore.push(g.barcode);
        }
      });
    }

    // Lookup by ticketRef or saleId in notes
    const { data: notesGarments } = await supabase
      .from('individual_garments')
      .select('id, barcode')
      .or(`notes.ilike.%${ticketRef}%,notes.ilike.%Ticket #${saleId}%,notes.ilike.%#${sale.consecutive}%`);

    if (notesGarments && notesGarments.length > 0) {
      notesGarments.forEach((g: any) => {
        if (g.barcode && !barcodesToRestore.includes(g.barcode)) {
          barcodesToRestore.push(g.barcode);
        }
      });
    }

    // Restore all matched individual garments
    if (barcodesToRestore.length > 0 && warehouseId) {
      await supabase
        .from('individual_garments')
        .update({
          warehouse_id: warehouseId,
          store_id: sale.store_id || null,
          status: 'Aprobada',
          defect_checklist: {
            is_sold: false,
            restored_at: new Date().toISOString(),
            restored_by: 'Nota Crédito Alegra',
            credit_note_ref: ticketRef,
            reason: reason || 'Anulación Alegra'
          },
          updated_at: new Date().toISOString(),
          notes: `Restaurada por Nota Crédito (${ticketRef}) - ${reason || 'Anulación Alegra'}`
        })
        .in('barcode', barcodesToRestore);
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
    await revertSaleInventory(saleId, reason);

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
