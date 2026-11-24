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

// In-memory concurrency locks and idempotency cache
const activeProcessingBarcodes = new Set<string>();
const recentSalesFingerprints = new Map<string, number>();

export async function POST(request: Request) {
  let saleFingerprint: string | null = null;
  const lockedBarcodesInThisRequest: string[] = [];

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

    // -------------------------------------------------------------------------
    // PROTECCIÓN DE IDEMPOTENCIA Y RÁFAGAS: Evitar ventas repetidas (15s)
    // -------------------------------------------------------------------------
    const now = Date.now();
    for (const [fp, ts] of recentSalesFingerprints.entries()) {
      if (now - ts > 60000) recentSalesFingerprints.delete(fp);
    }

    const cartSig = cart
      .map((c: any) => `${c.product_id || ''}-${c.color_id || ''}-${c.size_id || ''}-${c.cantidad || 1}`)
      .sort()
      .join('|');
    const clientSig = (salePayload.cliente_id || salePayload.client_document || salePayload.client_name || 'general').trim();
    saleFingerprint = `${store?.id || 'wh'}_${clientSig}_${Number(salePayload.total || 0).toFixed(2)}_${cartSig}`;

    const lastSeenTime = recentSalesFingerprints.get(saleFingerprint);
    if (lastSeenTime && (now - lastSeenTime < 15000)) {
      console.warn(`[IDEMPOTENCY BLOCKED] Venta duplicada rechazada por ráfaga: ${saleFingerprint}`);
      return NextResponse.json({
        error: '⛔ Venta duplicada detectada: Una venta idéntica para este cliente y carrito ya fue enviada o está en proceso hace menos de 15 segundos. Por favor espera a que finalice.'
      }, { status: 409 });
    }
    recentSalesFingerprints.set(saleFingerprint, now);

    // =========================================================================
    // VALIDACIÓN ESTRICTA: PREVENCIÓN DE FACTURAS DUPLICADAS Y PRENDAS YA VENDIDAS
    // =========================================================================
    const targetWhId = store?.bodega_asociada_id;
    const directBarcodesToValidate: string[] = [];
    const seenBarcodes = new Set<string>();
    const duplicateInCart: string[] = [];

    // 1. Validar que no hayan códigos duplicados en el mismo carrito
    for (const item of cart) {
      if (Array.isArray(item.barcodes)) {
        for (const b of item.barcodes) {
          if (b && typeof b === 'string') {
            const cleanB = b.trim();
            if (cleanB) {
              if (seenBarcodes.has(cleanB)) {
                duplicateInCart.push(cleanB);
              } else {
                seenBarcodes.add(cleanB);
                directBarcodesToValidate.push(cleanB);
              }
            }
          }
        }
      }
    }

    if (duplicateInCart.length > 0) {
      if (saleFingerprint) recentSalesFingerprints.delete(saleFingerprint);
      return NextResponse.json({
        error: `⛔ El carrito contiene prendas duplicadas con el mismo código de barras: [${duplicateInCart.join(', ')}]. Cada prenda física solo puede ser vendida una sola vez.`
      }, { status: 400 });
    }

    // 1.1 Bloqueo de concurrencia en memoria para códigos de barra
    for (const bc of directBarcodesToValidate) {
      if (activeProcessingBarcodes.has(bc)) {
        if (saleFingerprint) recentSalesFingerprints.delete(saleFingerprint);
        return NextResponse.json({
          error: `⛔ La prenda física con código de barras "${bc}" ya está siendo procesada en este instante por otra transacción. Solicitud rechazada para evitar duplicidad.`
        }, { status: 409 });
      }
      activeProcessingBarcodes.add(bc);
      lockedBarcodesInThisRequest.push(bc);
    }

    // 2. Validar contra individual_garments: comprobar si la prenda ya fue vendida o pertenece a otra bodega
    if (directBarcodesToValidate.length > 0) {
      const { data: garmentCheck, error: gCheckErr } = await supabase
        .from('individual_garments')
        .select('id, barcode, warehouse_id, store_id, notes, defect_checklist, status, reference_name, color_name, size_code')
        .in('barcode', directBarcodesToValidate);

      if (gCheckErr) {
        console.error('Error consultando individual_garments en validación:', gCheckErr);
      } else if (garmentCheck && garmentCheck.length > 0) {
        for (const g of garmentCheck) {
          const isRestored = 
            (g.defect_checklist && typeof g.defect_checklist === 'object' && g.defect_checklist.is_sold === false) ||
            (typeof g.notes === 'string' && g.notes.toLowerCase().includes('restaurada por nota cr'));

          // Verificar si ya fue vendida o facturada
          const isAlreadySold = !isRestored && (
            (g.defect_checklist && typeof g.defect_checklist === 'object' && g.defect_checklist.is_sold === true) ||
            (typeof g.notes === 'string' && (
              g.notes.toLowerCase().includes('venta pos') || 
              g.notes.toLowerCase().includes('vendid') || 
              g.notes.toLowerCase().includes('factur')
            )) ||
            (!g.warehouse_id && !g.store_id)
          );

          if (isAlreadySold) {
            return NextResponse.json({
              error: `⛔ La prenda con código "${g.barcode}" (${g.reference_name || ''} ${g.color_name || ''} ${g.size_code || ''}) ya figura como FACTURADA / VENDIDA previamente. Detalle: ${g.notes || 'No se encuentra en stock disponible'}. No se puede volver a facturar.`
            }, { status: 400 });
          }

          // Verificar restricción estricta de bodega
          if (targetWhId) {
            const isAssigned = (g.warehouse_id === targetWhId) || (g.store_id && store?.id && g.store_id === store.id);
            if (!isAssigned) {
              return NextResponse.json({
                error: `⛔ La prenda con código "${g.barcode}" pertenece a otra bodega o sucursal y no puede venderse en esta tienda.`
              }, { status: 400 });
            }
          }
        }
      }

      // 3. Validar contra ventas históricas confirmadas en pos_sales
      for (const bc of directBarcodesToValidate) {
        const { data: pastSales } = await supabase
          .from('pos_sales')
          .select('id, consecutive, created_at, client_name, observaciones, estado')
          .ilike('observaciones', `%${bc}%`)
          .neq('estado', 'anulada')
          .limit(1);

        if (pastSales && pastSales.length > 0) {
          const past = pastSales[0];
          return NextResponse.json({
            error: `⛔ La prenda con código "${bc}" ya fue facturada en la Venta #${past.consecutive || past.id} (Fecha: ${new Date(past.created_at).toLocaleString('es-CO')}). No se puede volver a facturar.`
          }, { status: 400 });
        }
      }
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
    const storeCode = (store?.codigo || (store?.nombre || 'POS').substring(0, 3)).toUpperCase();
    const docRef = `Venta POS #${storeCode}-${String(consecutive).padStart(4, '0')}`;
    const vendedor = salePayload.vendedor || 'Vendedor';

    // 2. Preparar todas las inserciones en lote (Batch Inserts)
    const saleItemsToInsert = cart.map(cartItem => ({
      sale_id: newSale.id,
      product_id: cartItem.product_id,
      color_id: cartItem.color_id || null,
      size_id: cartItem.size_id || null,
      cantidad: cartItem.cantidad,
      precio_unitario: cartItem.precio,
      subtotal: cartItem.precio * cartItem.cantidad,
      total: cartItem.precio * cartItem.cantidad
    }));

    // Inserción en lote de items de venta
    const insertItemsPromise = Promise.resolve(supabase.from('pos_sale_items').insert(saleItemsToInsert));

    // Inserción en lote de pagos
    let insertPaymentsPromise: Promise<any> = Promise.resolve();
    if (Array.isArray(paymentsToInsert) && paymentsToInsert.length > 0) {
      const paymentsBatch = paymentsToInsert.map(p => ({
        sale_id: newSale.id,
        metodo_pago: p.metodo_pago,
        monto: p.monto
      }));
      insertPaymentsPromise = Promise.resolve(supabase.from('pos_payments').insert(paymentsBatch));
    }

    // 3. Procesar y actualizar individual_garments en una sola llamada en lote
    const allDirectBarcodes: string[] = [];
    cart.forEach(it => {
      const bcs = Array.isArray(it.barcodes) ? it.barcodes.filter(Boolean) : (it.barcode ? [it.barcode] : []);
      bcs.forEach((b: string) => {
        if (!allDirectBarcodes.includes(b)) allDirectBarcodes.push(b);
      });
    });

    let updateGarmentsPromise: Promise<any> = Promise.resolve();
    if (allDirectBarcodes.length > 0) {
      updateGarmentsPromise = Promise.resolve(supabase
        .from('individual_garments')
        .update({
          warehouse_id: null,
          store_id: null,
          defect_checklist: {
            is_sold: true,
            sale_id: newSale.id,
            consecutive: newSale.consecutive,
            doc_ref: docRef,
            sold_at: new Date().toISOString()
          },
          updated_at: new Date().toISOString(),
          notes: `${docRef} - Vendedor: ${vendedor}`
        })
        .in('barcode', allDirectBarcodes));
    }

    // 4. Actualización consolidada de finished_goods_stock y Kardex
    const kardexBatch: any[] = [];
    const stockPromises: Promise<any>[] = [];

    if (targetWhId) {
      // Agrupar items del carrito por producto, color y talla
      const groupedStock = new Map<string, { product_id: string; color_id: string | null; size_id: string | null; qty: number }>();
      for (const it of cart) {
        const key = `${it.product_id}_${it.color_id || ''}_${it.size_id || ''}`;
        const existing = groupedStock.get(key) || { product_id: it.product_id, color_id: it.color_id || null, size_id: it.size_id || null, qty: 0 };
        existing.qty += Number(it.cantidad) || 1;
        groupedStock.set(key, existing);
      }

      for (const entry of groupedStock.values()) {
        const isDevolucion = entry.qty < 0;
        const movType = isDevolucion ? 'Devolución' : 'Venta POS';

        let q = supabase.from('finished_goods_stock').select('id, cantidad_disponible')
          .eq('warehouse_id', targetWhId)
          .eq('product_id', entry.product_id);
        if (entry.size_id) q = q.eq('size_id', entry.size_id);
        if (entry.color_id) q = q.eq('color_id', entry.color_id);

        stockPromises.push(
          Promise.resolve(q.maybeSingle()).then(async ({ data: targetStock }: any) => {
            let currentQty = 0;
            if (targetStock) {
              currentQty = Number(targetStock.cantidad_disponible) || 0;
              await supabase.from('finished_goods_stock')
                .update({
                  cantidad_disponible: currentQty - entry.qty,
                  updated_at: new Date().toISOString()
                })
                .eq('id', targetStock.id);
            } else {
              await supabase.from('finished_goods_stock').insert([{
                warehouse_id: targetWhId,
                product_id: entry.product_id,
                size_id: entry.size_id,
                color_id: entry.color_id,
                cantidad_disponible: 0 - entry.qty,
                cantidad_reservada: 0,
                cantidad_en_transito: 0
              }]);
            }

            kardexBatch.push({
              warehouse_dest_id: targetWhId,
              product_id: entry.product_id,
              color_id: entry.color_id,
              size_id: entry.size_id,
              tipo_movimiento: movType,
              cantidad: Math.abs(entry.qty),
              saldo_anterior: currentQty,
              saldo_nuevo: currentQty - entry.qty,
              documento_origen: docRef,
              usuario: vendedor
            });
          })
        );
      }
    }

    // Ejecutar en paralelo todas las operaciones en lote (Batch Parallelism)
    await Promise.all([
      insertItemsPromise,
      insertPaymentsPromise,
      updateGarmentsPromise,
      Promise.all(stockPromises)
    ]);

    // Insertar Kardex en lote si hubo movimientos
    if (kardexBatch.length > 0) {
      await supabase.from('finished_goods_kardex').insert(kardexBatch);
    }

    return NextResponse.json({
      success: true,
      sale: newSale,
      soldBarcodes: allDirectBarcodes
    });
  } catch (err: any) {
    if (saleFingerprint) recentSalesFingerprints.delete(saleFingerprint);
    console.error('API /api/pos/sales error:', err);
    return NextResponse.json({ error: err.message || 'Error procesando venta en base de datos' }, { status: 500 });
  } finally {
    for (const bc of lockedBarcodesInThisRequest) {
      activeProcessingBarcodes.delete(bc);
    }
  }
}
