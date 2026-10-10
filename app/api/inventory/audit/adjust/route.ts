import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({ error: 'Supabase credentials missing.' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const body = await req.json();

    const {
      auditId,
      actionType, // 'RECALCULATE_RECONCILIATION', 'REQUEST_ADJUSTMENT', 'APPROVE_ADJUSTMENT', 'JUSTIFY_ITEM'
      itemId,
      justification,
      userEmail,
      reason,
      notes
    } = body;

    if (!auditId) {
      return NextResponse.json({ error: 'Se requiere auditId.' }, { status: 400 });
    }

    // =========================================================================
    // ACTION 0: RECALCULATE / VALIDATE RECONCILIATION
    // Validates every scanned barcode against warehouse stock and individual garments
    // =========================================================================
    if (actionType === 'RECALCULATE_RECONCILIATION') {
      const { data: session, error: sessErr } = await supabase
        .from('audit_sessions')
        .select('*')
        .eq('id', auditId)
        .single();

      if (sessErr || !session) {
        return NextResponse.json({ error: 'Auditoría no encontrada.' }, { status: 404 });
      }

      const locationId = session.location_id;

      // 1. Fetch all scanned codes for this audit
      const { data: scans } = await supabase
        .from('audit_scans')
        .select('*')
        .eq('audit_id', auditId);

      const scannedBarcodes = [...new Set((scans || []).map(s => (s.barcode || s.sku_code || '').trim()))].filter(Boolean);

      // 2. Resolve Category Scope keywords
      let categoryKeywords: string[] = [];
      const notesLower = (session.notes || '').toLowerCase();
      if (notesLower.includes('categoría(s):') || notesLower.includes('categoria(s):') || notesLower.includes('categoria:')) {
        const parts = notesLower.split(/categoría\(s\):|categoria\(s\):|categoria:/);
        if (parts[1]) {
          const rawTerms = parts[1].split(',').map((c: string) => c.trim()).filter(Boolean);
          rawTerms.forEach((t: string) => {
            const clean = t.toLowerCase().trim();
            // extract words with > 3 chars (e.g. 'mango' from 'body mango')
            clean.split(/\s+/).forEach((w: string) => {
              if (w.length >= 3 && !categoryKeywords.includes(w)) categoryKeywords.push(w);
            });
          });
        }
      } else if (session.audit_type && session.audit_type !== 'Completo' && session.audit_type !== 'Por Ubicacion') {
        const clean = session.audit_type.trim().toLowerCase();
        clean.split(/\s+/).forEach((w: string) => {
          if (w.length >= 3 && !categoryKeywords.includes(w)) categoryKeywords.push(w);
        });
      }

      // Filter out generic words like 'body', 'top' if specific word like 'mango' is present
      const mainKeywords = categoryKeywords.filter(k => !['body', 'tipo', 'linea', 'para'].includes(k));
      const effectiveKeywords = mainKeywords.length > 0 ? mainKeywords : categoryKeywords;

      // 3. Fetch product catalog for price, cost, and product_id resolution
      const { data: products } = await supabase
        .from('products')
        .select('id, codigo_referencia, nombre_producto, precio, costo, precio_con_iva, precio_costo, categoria, category_id');

      const prodMapByRef = new Map<string, any>();
      const prodMapByName = new Map<string, any>();
      const prodMapById = new Map<string, any>();

      products?.forEach((p: any) => {
        if (p.id) prodMapById.set(p.id, p);
        if (p.codigo_referencia) prodMapByRef.set(p.codigo_referencia.trim().toUpperCase(), p);
        if (p.nombre_producto) prodMapByName.set(p.nombre_producto.trim().toLowerCase(), p);
      });

      // 4. Fetch expected individual garments in the audited warehouse with pagination
      let expectedGarments: any[] = [];
      const pageSize = 1000;
      let page = 0;

      while (true) {
        let q = supabase
          .from('individual_garments')
          .select('*')
          .eq('warehouse_id', locationId)
          .neq('status', 'vendido');

        if (effectiveKeywords.length > 0) {
          // Filter by keyword e.g. %mango%
          q = q.ilike('reference_name', `%${effectiveKeywords[0]}%`);
        }

        const { data: chunk, error: gErr } = await q.range(page * pageSize, (page + 1) * pageSize - 1);
        if (gErr || !chunk || chunk.length === 0) break;
        expectedGarments = expectedGarments.concat(chunk);
        if (chunk.length < pageSize) break;
        page++;
      }

      // 5. Query all scanned barcodes from individual_garments across the entire database to detect surplus & origin warehouses
      let dbMatchedGarments: any[] = [];
      if (scannedBarcodes.length > 0) {
        const batchSize = 100;
        const batchPromises = [];
        for (let i = 0; i < scannedBarcodes.length; i += batchSize) {
          const batch = scannedBarcodes.slice(i, i + batchSize);
          batchPromises.push(
            supabase
              .from('individual_garments')
              .select('*, warehouses:warehouse_id(nombre_bodega)')
              .in('barcode', batch)
          );
        }
        const results = await Promise.all(batchPromises);
        results.forEach(res => {
          if (res.data && res.data.length > 0) {
            dbMatchedGarments = dbMatchedGarments.concat(res.data);
          }
        });
      }

      const globalGarmentMap = new Map<string, any>();
      dbMatchedGarments.forEach((g: any) => {
        if (g.barcode) {
          const rawBc = g.barcode.trim();
          const unpaddedBc = rawBc.replace(/^0+/, '');
          globalGarmentMap.set(rawBc, g);
          globalGarmentMap.set(unpaddedBc, g);
        }
      });

      const expectedBarcodeMap = new Map<string, any>();
      expectedGarments.forEach((g: any) => {
        if (g.barcode) {
          const rawBc = g.barcode.trim();
          const unpaddedBc = rawBc.replace(/^0+/, '');
          expectedBarcodeMap.set(rawBc, g);
          expectedBarcodeMap.set(unpaddedBc, g);
        }
      });

      // 6. Match and categorize items
      const scannedSet = new Set<string>();
      scannedBarcodes.forEach(bc => {
        const raw = bc.trim();
        const unpadded = raw.replace(/^0+/, '');
        scannedSet.add(raw);
        scannedSet.add(unpadded);
      });

      const auditItemsToInsert: any[] = [];

      let totalExpectedQty = expectedGarments.length;
      let totalCountedQty = scannedBarcodes.length;
      let totalMissingQty = 0;
      let totalSurplusQty = 0;
      let financialMissing = 0;
      let financialSurplus = 0;

      // Helper to resolve product details
      const resolveProduct = (refName: string, prodId?: string) => {
        if (prodId && prodMapById.has(prodId)) return prodMapById.get(prodId);
        if (refName) {
          const cleanRef = refName.trim().toLowerCase();
          if (prodMapByName.has(cleanRef)) return prodMapByName.get(cleanRef);
          for (const [name, p] of prodMapByName.entries()) {
            if (cleanRef.includes(name) || name.includes(cleanRef)) return p;
          }
          const upperRef = refName.trim().toUpperCase();
          if (prodMapByRef.has(upperRef)) return prodMapByRef.get(upperRef);
        }
        return null;
      };

      // A. Process Expected items in this warehouse
      expectedGarments.forEach((g: any) => {
        const bc = (g.barcode || '').trim();
        const unpadded = bc.replace(/^0+/, '');
        const wasScanned = scannedSet.has(bc) || (unpadded.length > 0 && scannedSet.has(unpadded));
        const prod = resolveProduct(g.reference_name, g.product_id);
        const unitCost = Number(prod?.costo || prod?.precio_costo || (prod?.precio ? prod.precio * 0.5 : 25000));
        const unitPrice = Number(prod?.precio || prod?.precio_con_iva || 50000);

        if (wasScanned) {
          // CONCILIADO / ENCONTRADO
          auditItemsToInsert.push({
            audit_id: auditId,
            product_id: prod?.id || null,
            sku_code: bc,
            barcode: bc,
            product_name: g.reference_name || prod?.nombre_producto || 'Prenda Indiv.',
            category_name: prod?.categoria || 'Prendas Individuales',
            color_name: g.color_name || '—',
            size_code: g.size_code || 'ST',
            expected_qty: 1,
            counted_qty: 1,
            unit_cost: unitCost,
            unit_price: unitPrice,
            status: 'OK',
            item_state: 'Detectada'
          });
        } else {
          // FALTANTE / NO ENCONTRADO
          totalMissingQty += 1;
          financialMissing += unitCost;

          auditItemsToInsert.push({
            audit_id: auditId,
            product_id: prod?.id || null,
            sku_code: bc,
            barcode: bc,
            product_name: g.reference_name || prod?.nombre_producto || 'Prenda Indiv.',
            category_name: prod?.categoria || 'Prendas Individuales',
            color_name: g.color_name || '—',
            size_code: g.size_code || 'ST',
            expected_qty: 1,
            counted_qty: 0,
            unit_cost: unitCost,
            unit_price: unitPrice,
            status: 'Faltante',
            item_state: 'Detectada'
          });
        }
      });

      // B. Process Scanned items that were NOT in the expected category snapshot
      scannedBarcodes.forEach(bc => {
        const rawBc = bc.trim();
        const unpaddedBc = rawBc.replace(/^0+/, '');
        const isAlreadyInExpected = expectedBarcodeMap.has(rawBc) || (unpaddedBc.length > 0 && expectedBarcodeMap.has(unpaddedBc));

        if (!isAlreadyInExpected) {
          const gMatch = globalGarmentMap.get(rawBc) || globalGarmentMap.get(unpaddedBc);
          const prod = resolveProduct(gMatch?.reference_name || '', gMatch?.product_id);
          const unitCost = Number(prod?.costo || prod?.precio_costo || (prod?.precio ? prod.precio * 0.5 : 25000));
          const unitPrice = Number(prod?.precio || prod?.precio_con_iva || 50000);

          const belongsToAuditedWarehouse = gMatch && gMatch.warehouse_id === locationId;

          if (belongsToAuditedWarehouse) {
            // Belongs to this warehouse -> Match 1-to-1 as OK / Conciliado!
            totalExpectedQty += 1;
            auditItemsToInsert.push({
              audit_id: auditId,
              product_id: prod?.id || gMatch?.product_id || null,
              sku_code: rawBc,
              barcode: rawBc,
              product_name: gMatch?.reference_name || prod?.nombre_producto || 'Prenda Indiv.',
              category_name: prod?.categoria || 'Prendas Individuales',
              color_name: gMatch?.color_name || '—',
              size_code: gMatch?.size_code || 'ST',
              expected_qty: 1,
              counted_qty: 1,
              unit_cost: unitCost,
              unit_price: unitPrice,
              status: 'OK',
              item_state: 'Detectada'
            });
          } else {
            // SOBRANTE / DE OTRA BODEGA O NO REGISTRADO
            totalSurplusQty += 1;
            financialSurplus += unitCost;

            const originWhName = gMatch?.warehouses?.nombre_bodega || (gMatch?.warehouse_id ? `Bodega (${gMatch.warehouse_id.slice(0, 8)}...)` : 'Sin Asignar');

            auditItemsToInsert.push({
              audit_id: auditId,
              product_id: prod?.id || null,
              sku_code: rawBc,
              barcode: rawBc,
              product_name: gMatch?.reference_name || prod?.nombre_producto || 'Prenda Sobrante',
              category_name: 'Prendas Individuales',
              color_name: gMatch?.color_name || '—',
              size_code: gMatch?.size_code || 'ST',
              expected_qty: 0,
              counted_qty: 1,
              unit_cost: unitCost,
              unit_price: unitPrice,
              status: 'Sobrante',
              item_state: 'Detectada',
              justification: gMatch?.warehouse_id && gMatch.warehouse_id !== locationId
                ? `Leído físicamente aquí pero registrado en ${originWhName}`
                : 'Código leído físicamente sin asignación previa en bodega'
            });
          }
        }
      });

      const financialImpact = financialSurplus - financialMissing;
      const totalConciliados = totalExpectedQty - totalMissingQty;
      const reconciliationRate = totalExpectedQty > 0
        ? Math.round((totalConciliados / totalExpectedQty) * 100)
        : (totalCountedQty > 0 ? 100 : 0);

      // 7. Update audit_items in DB: replace old records with new verified records concurrently
      await supabase.from('audit_items').delete().eq('audit_id', auditId);

      const insertBatchSize = 300;
      const insertPromises = [];
      for (let i = 0; i < auditItemsToInsert.length; i += insertBatchSize) {
        const batch = auditItemsToInsert.slice(i, i + insertBatchSize);
        insertPromises.push(supabase.from('audit_items').insert(batch));
      }
      await Promise.all(insertPromises);

      // 8. Update audit_sessions stats in DB
      const sessionUpdate = {
        total_expected_items: totalExpectedQty,
        total_expected_qty: totalExpectedQty,
        total_counted_qty: totalCountedQty,
        total_missing_qty: totalMissingQty,
        total_surplus_qty: totalSurplusQty,
        financial_missing: financialMissing,
        financial_surplus: financialSurplus,
        financial_impact: financialImpact,
        reconciliation_rate: reconciliationRate,
        updated_at: new Date().toISOString()
      };

      await supabase.from('audit_sessions').update(sessionUpdate).eq('id', auditId);

      return NextResponse.json({
        success: true,
        message: 'Conciliación calculada y validada en base de datos.',
        summary: {
          totalExpected: totalExpectedQty,
          totalCounted: totalCountedQty,
          conciliados: totalConciliados,
          faltantes: totalMissingQty,
          sobrantes: totalSurplusQty,
          reconciliationRate,
          financialImpact
        }
      });
    }

    // =========================================================================
    // ACTION 1: JUSTIFY A SINGLE ITEM DIFFERENCE
    // =========================================================================
    if (actionType === 'JUSTIFY_ITEM' && itemId) {
      const { error: updErr } = await supabase
        .from('audit_items')
        .update({
          item_state: 'Justificada',
          justification: justification || 'Diferencia auditada y justificada'
        })
        .eq('id', itemId);

      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }

      await supabase.from('audit_logs').insert({
        audit_id: auditId,
        action: 'JUSTIFICACION',
        user_email: userEmail || 'Sistema',
        after_state: { itemId, justification }
      });

      return NextResponse.json({ success: true, message: 'Diferencia justificada.' });
    }

    // =========================================================================
    // ACTION 2: REQUEST INVENTORY ADJUSTMENT
    // =========================================================================
    if (actionType === 'REQUEST_ADJUSTMENT') {
      const { data: session } = await supabase.from('audit_sessions').select('*').eq('id', auditId).single();
      if (!session) return NextResponse.json({ error: 'Auditoría no encontrada.' }, { status: 404 });

      const { data: reqData, error: reqErr } = await supabase
        .from('audit_adjustment_requests')
        .insert({
          audit_id: auditId,
          requested_by: userEmail || 'Auditor',
          status: 'Pendiente',
          total_items_to_adjust: (session.total_missing_qty || 0) + (session.total_surplus_qty || 0),
          total_financial_impact: session.financial_impact || 0,
          reason: reason || 'Ajuste por diferencias detectadas en auditoría física',
          notes: notes || ''
        })
        .select()
        .single();

      if (reqErr) {
        return NextResponse.json({ error: reqErr.message }, { status: 500 });
      }

      await supabase.from('audit_sessions').update({ status: 'En Revision' }).eq('id', auditId);

      await supabase.from('audit_logs').insert({
        audit_id: auditId,
        action: 'SOLICITUD_AJUSTE',
        user_email: userEmail || 'Auditor',
        after_state: { requestId: reqData.id, reason }
      });

      return NextResponse.json({ success: true, request: reqData, message: 'Solicitud de ajuste enviada a aprobación.' });
    }

    // =========================================================================
    // ACTION 3: APPROVE ADJUSTMENT & UPDATE DB INVENTORY IMMUTABLY
    // Updates individual_garments, finished_goods_stock, finished_goods_kardex
    // =========================================================================
    if (actionType === 'APPROVE_ADJUSTMENT') {
      const { data: session } = await supabase.from('audit_sessions').select('*').eq('id', auditId).single();
      if (!session) return NextResponse.json({ error: 'Auditoría no encontrada.' }, { status: 404 });

      let items: any[] = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data: chunk, error: itemsErr } = await supabase
          .from('audit_items')
          .select('*')
          .eq('audit_id', auditId)
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (itemsErr || !chunk || chunk.length === 0) break;
        items = items.concat(chunk);
        if (chunk.length < pageSize) break;
        page++;
      }

      if (!items || items.length === 0) {
        return NextResponse.json({ error: 'No hay ítems registrados en la auditoría para ajustar.' }, { status: 400 });
      }

      const locationId = session.location_id;
      let updatedGarmentsCount = 0;
      let missingGarmentsCount = 0;
      let surplusGarmentsCount = 0;

      // 1. Update individual_garments table in batches
      const conciliadosBarcodes: string[] = [];
      const sobrantesItems: any[] = [];
      const faltantesBarcodes: string[] = [];

      items.forEach((item: any) => {
        const bc = item.barcode || item.sku_code;
        if (!bc) return;
        if (item.status === 'OK' || item.status === 'Conciliado') {
          conciliadosBarcodes.push(bc);
        } else if (item.status === 'Sobrante') {
          sobrantesItems.push(item);
        } else if (item.status === 'Faltante') {
          faltantesBarcodes.push(bc);
        }
      });

      // A. Conciliados: mark Aprobada in this warehouse
      if (conciliadosBarcodes.length > 0) {
        for (let i = 0; i < conciliadosBarcodes.length; i += 100) {
          const batch = conciliadosBarcodes.slice(i, i + 100);
          await supabase
            .from('individual_garments')
            .update({
              status: 'Aprobada',
              warehouse_id: locationId,
              updated_at: new Date().toISOString()
            })
            .in('barcode', batch);
        }
        updatedGarmentsCount = conciliadosBarcodes.length;
      }

      // B. Sobrantes: move to this warehouse or insert
      for (const item of sobrantesItems) {
        const bc = item.barcode || item.sku_code;
        const { data: existingGarment } = await supabase
          .from('individual_garments')
          .select('id')
          .eq('barcode', bc)
          .maybeSingle();

        if (existingGarment) {
          await supabase
            .from('individual_garments')
            .update({
              status: 'Aprobada',
              warehouse_id: locationId,
              notes: `Trasladado por sobrante auditoría #${session.consecutive} (${new Date().toLocaleDateString('es-CO')})`,
              updated_at: new Date().toISOString()
            })
            .eq('barcode', bc);
        } else {
          await supabase
            .from('individual_garments')
            .insert({
              barcode: bc,
              reference_name: item.product_name || 'Prenda Sobrante',
              color_name: item.color_name || '—',
              size_code: item.size_code || 'ST',
              warehouse_id: locationId,
              status: 'Aprobada',
              notes: `Ingreso por sobrante auditoría #${session.consecutive}`
            });
        }
        surplusGarmentsCount++;
      }

      // C. Faltantes: mark as Faltante Auditoría
      if (faltantesBarcodes.length > 0) {
        for (let i = 0; i < faltantesBarcodes.length; i += 100) {
          const batch = faltantesBarcodes.slice(i, i + 100);
          await supabase
            .from('individual_garments')
            .update({
              status: 'Faltante Auditoría',
              notes: `Marcado como faltante en auditoría #${session.consecutive} (${new Date().toLocaleDateString('es-CO')})`,
              updated_at: new Date().toISOString()
            })
            .in('barcode', batch)
            .eq('warehouse_id', locationId);
        }
        missingGarmentsCount = faltantesBarcodes.length;
      }

      // 2. Adjust finished_goods_stock if products exist
      const stockAdjustmentsMap = new Map<string, { product_id: string; color_name: string; size_code: string; delta: number; product_name: string }>();

      items.forEach((item: any) => {
        const diff = (item.counted_qty || 0) - (item.expected_qty || 0);
        if (diff !== 0 && item.product_id) {
          const key = `${item.product_id}_${item.color_name || ''}_${item.size_code || ''}`;
          const current = stockAdjustmentsMap.get(key) || {
            product_id: item.product_id,
            color_name: item.color_name || '',
            size_code: item.size_code || '',
            delta: 0,
            product_name: item.product_name
          };
          current.delta += diff;
          stockAdjustmentsMap.set(key, current);
        }
      });

      // Apply aggregated adjustments to finished_goods_stock and kardex
      for (const [_, adj] of stockAdjustmentsMap.entries()) {
        if (adj.delta === 0) continue;

        const { data: currentStock } = await supabase
          .from('finished_goods_stock')
          .select('*')
          .eq('product_id', adj.product_id)
          .eq('warehouse_id', locationId)
          .maybeSingle();

        const prevQty = currentStock ? Number(currentStock.cantidad_disponible || 0) : 0;
        const newQty = Math.max(0, prevQty + adj.delta);

        if (currentStock) {
          await supabase
            .from('finished_goods_stock')
            .update({ cantidad_disponible: newQty, updated_at: new Date().toISOString() })
            .eq('id', currentStock.id);
        } else if (newQty > 0) {
          await supabase.from('finished_goods_stock').insert({
            product_id: adj.product_id,
            warehouse_id: locationId,
            cantidad_disponible: newQty
          });
        }

        // Kardex audit movement record
        await supabase.from('finished_goods_kardex').insert({
          product_id: adj.product_id,
          warehouse_dest_id: locationId,
          tipo_movimiento: adj.delta > 0 ? 'Ajuste Auditoría (Sobrante)' : 'Ajuste Auditoría (Faltante)',
          cantidad: Math.abs(adj.delta),
          saldo_anterior: prevQty,
          saldo_nuevo: newQty,
          documento_origen: `AUDITORÍA #${session.consecutive}`,
          usuario: userEmail || 'Aprobador',
          observaciones: `Ajuste consolidado auditoría #${session.consecutive} (${adj.product_name})`
        });
      }

      // 3. Mark all audit items as Ajustada
      await supabase.from('audit_items').update({ item_state: 'Ajustada' }).eq('audit_id', auditId);

      // 4. Update session status to Ajustado / Cerrado
      await supabase.from('audit_sessions').update({
        status: 'Ajustado',
        approved_by: userEmail || 'Aprobador',
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', auditId);

      // 5. Update adjustment requests to Aprobado
      await supabase.from('audit_adjustment_requests').update({
        status: 'Aprobado',
        approved_by: userEmail || 'Aprobador',
        approved_at: new Date().toISOString()
      }).eq('audit_id', auditId);

      // 6. Register Audit Log
      await supabase.from('audit_logs').insert({
        audit_id: auditId,
        action: 'APROBACION_Y_AJUSTE_REAL',
        user_email: userEmail || 'Aprobador',
        before_state: { total_expected: session.total_expected_qty },
        after_state: {
          status: 'Ajustado',
          conciliados_confirmados: updatedGarmentsCount,
          faltantes_marcados: missingGarmentsCount,
          sobrantes_incorporados: surplusGarmentsCount,
          approved_by: userEmail || 'Aprobador'
        }
      });

      return NextResponse.json({
        success: true,
        message: `✅ Auditoría #${session.consecutive} conciliada y ajustada exitosamente: ${updatedGarmentsCount} prendas confirmadas, ${missingGarmentsCount} faltantes ajustadas y ${surplusGarmentsCount} sobrantes incorporadas a ${session.location_name}.`,
        summary: {
          conciliados: updatedGarmentsCount,
          faltantes: missingGarmentsCount,
          sobrantes: surplusGarmentsCount
        }
      });
    }

    return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 });

  } catch (error: any) {
    console.error('Error in /api/inventory/audit/adjust:', error);
    return NextResponse.json({ error: error.message || 'Error al procesar ajuste.' }, { status: 500 });
  }
}
