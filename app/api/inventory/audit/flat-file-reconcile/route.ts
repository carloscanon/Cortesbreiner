import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({ error: 'Credenciales de Supabase no configuradas.' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const body = await req.json();

    const {
      actionType, // 'ANALYZE' | 'APPLY_RECONCILIATION'
      locationId,
      locationName,
      rawBarcodes = [],
      scopeMode = 'auto', // 'auto' | 'category' | 'full'
      selectedCategories = [],
      userEmail,
      notes
    } = body;

    if (!locationId) {
      return NextResponse.json({ error: 'Debe especificar la bodega o tienda a conciliar.' }, { status: 400 });
    }

    // Clean and normalize incoming barcodes (preserve leading zeros as strings)
    const cleanedBarcodes = Array.from(
      new Set(
        (rawBarcodes as string[])
          .map(b => (b || '').toString().trim().replace(/^["']|["']$/g, ''))
          .filter(b => b.length > 0)
      )
    );

    if (cleanedBarcodes.length === 0) {
      return NextResponse.json({ error: 'No se encontraron códigos de barras válidos en el archivo.' }, { status: 400 });
    }

    // =========================================================================
    // ACTION 1: ANALYZE AND CROSS FLAT FILE AGAINST WAREHOUSE INVENTORY
    // =========================================================================
    if (actionType === 'ANALYZE') {
      // 1. Fetch info for scanned barcodes across the entire individual_garments table
      let globalGarments: any[] = [];
      const batchSize = 100;
      for (let i = 0; i < cleanedBarcodes.length; i += batchSize) {
        const batch = cleanedBarcodes.slice(i, i + batchSize);
        const { data: batchGarments } = await supabase
          .from('individual_garments')
          .select('id, barcode, reference_name, color_name, size_code, warehouse_id, status, warehouses:warehouse_id(nombre_bodega)')
          .in('barcode', batch);

        if (batchGarments && batchGarments.length > 0) {
          globalGarments = globalGarments.concat(batchGarments);
        }
      }

      const globalGarmentMap = new Map<string, any>();
      globalGarments.forEach((g: any) => {
        if (g.barcode) {
          const raw = g.barcode.trim();
          globalGarmentMap.set(raw, g);
          const unpadded = raw.replace(/^0+/, '');
          if (unpadded) globalGarmentMap.set(unpadded, g);
        }
      });

      // 2. Identify distinct references present in the scanned file
      const scannedReferencesMap = new Map<string, number>();
      globalGarments.forEach((g: any) => {
        const ref = (g.reference_name || 'Sin Referencia').trim();
        scannedReferencesMap.set(ref, (scannedReferencesMap.get(ref) || 0) + 1);
      });

      const detectedReferences = Array.from(scannedReferencesMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count }));

      // 3. Resolve warehouse expected garments scope
      let expectedGarments: any[] = [];
      const isFullScope = scopeMode === 'full';

      // Determine category / reference filter keywords
      let filterKeywords: string[] = [];
      if (!isFullScope) {
        if (selectedCategories && selectedCategories.length > 0) {
          selectedCategories.forEach((cat: string) => {
            const clean = cat.toLowerCase().trim();
            clean.split(/\s+/).forEach((w: string) => {
              if (w.length >= 3 && !filterKeywords.includes(w)) filterKeywords.push(w);
            });
          });
        } else if (detectedReferences.length > 0) {
          // Auto mode: use distinct words from detected references in the file
          detectedReferences.forEach(dr => {
            const clean = dr.name.toLowerCase().trim();
            clean.split(/\s+/).forEach((w: string) => {
              if (w.length >= 3 && !filterKeywords.includes(w)) filterKeywords.push(w);
            });
          });
        }
      }

      // Filter out generic stop words
      const stopWords = new Set(['top', 'body', 'tipo', 'linea', 'para', 'de', 'la', 'el', 'los', 'las', 'no', 'usar', 'saldo', 'premium']);
      const mainKeywords = filterKeywords.filter(k => !stopWords.has(k));
      const effectiveKeywords = mainKeywords.length > 0 ? mainKeywords : filterKeywords;

      // Query active garments currently in the warehouse
      let page = 0;
      const pageSize = 1000;
      while (true) {
        let q = supabase
          .from('individual_garments')
          .select('id, barcode, reference_name, color_name, size_code, warehouse_id, status')
          .eq('warehouse_id', locationId)
          .eq('status', 'Aprobada');

        if (!isFullScope && effectiveKeywords.length > 0) {
          q = q.ilike('reference_name', `%${effectiveKeywords[0]}%`);
        }

        const { data: chunk, error: gErr } = await q.range(page * pageSize, (page + 1) * pageSize - 1);
        if (gErr || !chunk || chunk.length === 0) break;

        const filteredChunk = (!isFullScope && effectiveKeywords.length > 1)
          ? chunk.filter((g: any) => {
              const refLower = (g.reference_name || '').toLowerCase();
              return effectiveKeywords.every(w => refLower.includes(w));
            })
          : chunk;

        expectedGarments = expectedGarments.concat(filteredChunk);
        if (chunk.length < pageSize) break;
        page++;
      }

      // 4. Products catalog for price/cost resolution
      const { data: prods } = await supabase
        .from('products')
        .select('id, codigo_referencia, nombre_producto, precio, costo, precio_con_iva, precio_costo, categoria');

      const prodMapByName = new Map<string, any>();
      const prodMapByRef = new Map<string, any>();
      prods?.forEach((p: any) => {
        if (p.codigo_referencia) prodMapByRef.set(p.codigo_referencia.trim().toUpperCase(), p);
        if (p.nombre_producto) prodMapByName.set(p.nombre_producto.trim().toLowerCase(), p);
      });

      const resolveProd = (refName: string) => {
        if (!refName) return null;
        const clean = refName.trim().toLowerCase();
        if (prodMapByName.has(clean)) return prodMapByName.get(clean);
        for (const [name, p] of prodMapByName.entries()) {
          if (clean.includes(name) || name.includes(clean)) return p;
        }
        return null;
      };

      // 5. Build sets and match items
      const scannedBcSet = new Set<string>();
      cleanedBarcodes.forEach(bc => {
        scannedBcSet.add(bc.trim());
        const unpadded = bc.trim().replace(/^0+/, '');
        if (unpadded) scannedBcSet.add(unpadded);
      });

      const expectedBcMap = new Map<string, any>();
      expectedGarments.forEach(g => {
        if (g.barcode) {
          const raw = g.barcode.trim();
          expectedBcMap.set(raw, g);
          const unpadded = raw.replace(/^0+/, '');
          if (unpadded) expectedBcMap.set(unpadded, g);
        }
      });

      const items: any[] = [];
      let conciliadosCount = 0;
      let faltantesCount = 0;
      let sobrantesCount = 0;
      let noRegistradosCount = 0;
      let financialMissing = 0;
      let financialSurplus = 0;

      // A. Process Expected items in this warehouse
      expectedGarments.forEach((g: any) => {
        const bc = (g.barcode || '').trim();
        const unpadded = bc.replace(/^0+/, '');
        const isScanned = scannedBcSet.has(bc) || (unpadded.length > 0 && scannedBcSet.has(unpadded));
        const prod = resolveProd(g.reference_name);
        const cost = Number(prod?.costo || prod?.precio_costo || 25000);
        const price = Number(prod?.precio || prod?.precio_con_iva || 50000);

        if (isScanned) {
          conciliadosCount++;
          items.push({
            barcode: bc,
            reference_name: g.reference_name || 'Prenda en Bodega',
            color_name: g.color_name || '—',
            size_code: g.size_code || 'ST',
            category_name: prod?.categoria || 'General',
            status: 'Conciliado',
            origin: 'Bodega Actual',
            cost,
            price,
            product_id: prod?.id || null
          });
        } else {
          faltantesCount++;
          financialMissing += cost;
          items.push({
            barcode: bc,
            reference_name: g.reference_name || 'Prenda en Bodega',
            color_name: g.color_name || '—',
            size_code: g.size_code || 'ST',
            category_name: prod?.categoria || 'General',
            status: 'Faltante',
            origin: 'Bodega Actual (No encontrada en plano)',
            cost,
            price,
            product_id: prod?.id || null
          });
        }
      });

      // B. Process Scanned items that were NOT in expected garments
      cleanedBarcodes.forEach(bc => {
        const raw = bc.trim();
        const unpadded = raw.replace(/^0+/, '');
        const wasInExpected = expectedBcMap.has(raw) || (unpadded.length > 0 && expectedBcMap.has(unpadded));

        if (!wasInExpected) {
          const match = globalGarmentMap.get(raw) || globalGarmentMap.get(unpadded);
          const prod = resolveProd(match?.reference_name || '');
          const cost = Number(prod?.costo || prod?.precio_costo || 25000);
          const price = Number(prod?.precio || prod?.precio_con_iva || 50000);

          if (match) {
            sobrantesCount++;
            financialSurplus += cost;
            const originWh = match.warehouses?.nombre_bodega || (match.warehouse_id ? `Bodega (${match.warehouse_id.slice(0, 8)}...)` : 'Sin Asignar');
            items.push({
              barcode: raw,
              reference_name: match.reference_name || 'Prenda Sobrante',
              color_name: match.color_name || '—',
              size_code: match.size_code || 'ST',
              category_name: prod?.categoria || 'General',
              status: 'Sobrante',
              origin: `En plano físico, pero en sistema registrada en: ${originWh}`,
              cost,
              price,
              product_id: prod?.id || null
            });
          } else {
            noRegistradosCount++;
            items.push({
              barcode: raw,
              reference_name: 'Código No Registrado',
              color_name: '—',
              size_code: 'ST',
              category_name: 'Desconocida',
              status: 'No Registrado',
              origin: 'Código en plano físico no existe en base de datos',
              cost: 0,
              price: 0,
              product_id: null
            });
          }
        }
      });

      const totalExpected = expectedGarments.length;
      const totalCounted = cleanedBarcodes.length;
      const reconciliationRate = totalExpected > 0
        ? Math.round((conciliadosCount / totalExpected) * 100)
        : (totalCounted > 0 ? 100 : 0);

      return NextResponse.json({
        success: true,
        summary: {
          totalFileBarcodes: totalCounted,
          totalWarehouseExpected: totalExpected,
          conciliadosCount,
          faltantesCount,
          sobrantesCount,
          noRegistradosCount,
          reconciliationRate,
          financialMissing,
          financialSurplus,
          financialImpact: financialSurplus - financialMissing,
          scopeMode,
          detectedReferences
        },
        items
      });
    }

    // =========================================================================
    // ACTION 2: APPLY RECONCILIATION AND ADJUST WAREHOUSE IN DATABASE
    // =========================================================================
    if (actionType === 'APPLY_RECONCILIATION') {
      const { items = [] } = body;

      if (!items || items.length === 0) {
        return NextResponse.json({ error: 'No hay ítems para aplicar el ajuste.' }, { status: 400 });
      }

      const conciliados = items.filter((i: any) => i.status === 'Conciliado');
      const faltantes = items.filter((i: any) => i.status === 'Faltante');
      const sobrantes = items.filter((i: any) => i.status === 'Sobrante');

      const totalExpected = conciliados.length + faltantes.length;
      const totalCounted = conciliados.length + sobrantes.length;
      const reconciliationRate = totalExpected > 0 ? Math.round((conciliados.length / totalExpected) * 100) : 100;

      // 1. Create audit session in database
      const auditNotes = notes || `Conciliación con Archivo Plano en ${locationName} (${cleanedBarcodes.length} códigos procesados)`;
      const { data: session, error: sessErr } = await supabase
        .from('audit_sessions')
        .insert({
          location_id: locationId,
          location_name: locationName,
          audit_type: 'Plano Masivo',
          sample_percentage: 100,
          status: 'Ajustado',
          created_by: userEmail || 'Sistema',
          approved_by: userEmail || 'Sistema',
          notes: auditNotes,
          total_expected_items: totalExpected,
          total_expected_qty: totalExpected,
          total_counted_qty: totalCounted,
          total_missing_qty: faltantes.length,
          total_surplus_qty: sobrantes.length,
          reconciliation_rate: reconciliationRate,
          closed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (sessErr || !session) {
        return NextResponse.json({ error: 'Error al registrar sesión de auditoría: ' + sessErr?.message }, { status: 500 });
      }

      const auditId = session.id;

      // 2. Insert scans into audit_scans in batches
      const scansToInsert = cleanedBarcodes.map(bc => ({
        audit_id: auditId,
        barcode: bc,
        sku_code: bc,
        counted_by: userEmail || 'Carga Plano',
        device_info: 'Carga Archivo Plano'
      }));

      for (let i = 0; i < scansToInsert.length; i += 300) {
        await supabase.from('audit_scans').insert(scansToInsert.slice(i, i + 300));
      }

      // 3. Insert audit_items in batches
      const auditItemsToInsert = items.map((i: any) => ({
        audit_id: auditId,
        product_id: i.product_id || null,
        sku_code: i.barcode,
        barcode: i.barcode,
        product_name: i.reference_name || 'Prenda',
        category_name: i.category_name || 'General',
        color_name: i.color_name || '—',
        size_code: i.size_code || 'ST',
        expected_qty: i.status === 'Faltante' || i.status === 'Conciliado' ? 1 : 0,
        counted_qty: i.status === 'Conciliado' || i.status === 'Sobrante' ? 1 : 0,
        unit_cost: i.cost || 25000,
        unit_price: i.price || 50000,
        status: i.status === 'Conciliado' ? 'OK' : i.status,
        item_state: 'Ajustada',
        justification: i.status === 'Faltante' ? 'Dado de baja por diferencia en plano' : (i.status === 'Sobrante' ? 'Incorporado a bodega por plano' : 'Conciliado')
      }));

      for (let i = 0; i < auditItemsToInsert.length; i += 300) {
        await supabase.from('audit_items').insert(auditItemsToInsert.slice(i, i + 300));
      }

      // 4. Update individual_garments:
      // A. Conciliados: mark Aprobada in this warehouse
      const conciliadosBc = conciliados.map((i: any) => i.barcode);
      for (let i = 0; i < conciliadosBc.length; i += 100) {
        await supabase
          .from('individual_garments')
          .update({
            warehouse_id: locationId,
            status: 'Aprobada',
            updated_at: new Date().toISOString()
          })
          .in('barcode', conciliadosBc.slice(i, i + 100));
      }

      // B. Faltantes: disassociate from warehouse and set status = 'Rechazada'
      const faltantesBc = faltantes.map((i: any) => i.barcode);
      for (let i = 0; i < faltantesBc.length; i += 100) {
        await supabase
          .from('individual_garments')
          .update({
            warehouse_id: null,
            status: 'Rechazada',
            notes: `Faltante en Auditoría #${session.consecutive} (${new Date().toLocaleDateString('es-CO')})`,
            updated_at: new Date().toISOString()
          })
          .in('barcode', faltantesBc.slice(i, i + 100))
          .eq('warehouse_id', locationId);
      }

      // C. Sobrantes: assign to this warehouse and set status = 'Aprobada'
      const sobrantesBc = sobrantes.map((i: any) => i.barcode);
      for (let i = 0; i < sobrantesBc.length; i += 100) {
        await supabase
          .from('individual_garments')
          .update({
            warehouse_id: locationId,
            status: 'Aprobada',
            notes: `Ingreso por sobrante auditoría #${session.consecutive} (${new Date().toLocaleDateString('es-CO')})`,
            updated_at: new Date().toISOString()
          })
          .in('barcode', sobrantesBc.slice(i, i + 100));
      }

      // 5. Adjust finished_goods_stock for audited products in this warehouse
      // Fetch color catalog and size catalog to map IDs
      const { data: colorsList } = await supabase.from('colors').select('id, nombre_color');
      const { data: sizesList } = await supabase.from('sizes').select('id, codigo_talla');

      const colorMap = new Map<string, string>();
      colorsList?.forEach((c: any) => {
        if (c.nombre_color) colorMap.set(c.nombre_color.trim().toUpperCase(), c.id);
      });

      const sizeMap = new Map<string, string>();
      sizesList?.forEach((s: any) => {
        if (s.codigo_talla) sizeMap.set(s.codigo_talla.trim().toUpperCase(), s.id);
      });

      // Aggregate physical counted items by product_id, color_id, size_id
      const stockAdjustmentsMap = new Map<string, {
        product_id: string;
        color_id: string | null;
        size_id: string | null;
        color_name: string;
        size_code: string;
        product_name: string;
        counted_qty: number;
      }>();

      const auditedProductIds = new Set<string>();

      items.forEach((item: any) => {
        if (!item.product_id) return;
        auditedProductIds.add(item.product_id);

        const colId = item.color_name ? colorMap.get(item.color_name.trim().toUpperCase()) || null : null;
        const szId = item.size_code ? sizeMap.get(item.size_code.trim().toUpperCase()) || null : null;

        const key = `${item.product_id}_${colId || 'null'}_${szId || 'null'}`;
        const current = stockAdjustmentsMap.get(key) || {
          product_id: item.product_id,
          color_id: colId,
          size_id: szId,
          color_name: item.color_name || '',
          size_code: item.size_code || '',
          product_name: item.reference_name || 'Producto',
          counted_qty: 0
        };

        if (item.status === 'Conciliado' || item.status === 'Sobrante') {
          current.counted_qty += 1;
        }
        stockAdjustmentsMap.set(key, current);
      });

      // Query existing stock records for audited products
      if (auditedProductIds.size > 0) {
        const { data: existingStockRecords } = await supabase
          .from('finished_goods_stock')
          .select('*')
          .eq('warehouse_id', locationId)
          .in('product_id', Array.from(auditedProductIds));

        const existingRecordsByKey = new Map<string, any[]>();
        existingStockRecords?.forEach((rec: any) => {
          const k = `${rec.product_id}_${rec.color_id || 'null'}_${rec.size_id || 'null'}`;
          const list = existingRecordsByKey.get(k) || [];
          list.push(rec);
          existingRecordsByKey.set(k, list);
        });

        // A. Update counted variants and zero out duplicates
        for (const [key, adj] of stockAdjustmentsMap.entries()) {
          const matches = existingRecordsByKey.get(key) || [];
          const newQty = Math.max(0, adj.counted_qty);

          if (matches.length > 0) {
            const primary = matches[0];
            const prevQty = Number(primary.cantidad_disponible || 0);
            const delta = newQty - prevQty;

            await supabase
              .from('finished_goods_stock')
              .update({ cantidad_disponible: newQty, updated_at: new Date().toISOString() })
              .eq('id', primary.id);

            for (let d = 1; d < matches.length; d++) {
              await supabase
                .from('finished_goods_stock')
                .update({ cantidad_disponible: 0, updated_at: new Date().toISOString() })
                .eq('id', matches[d].id);
            }

            if (delta !== 0) {
              await supabase.from('finished_goods_kardex').insert({
                product_id: adj.product_id,
                color_id: adj.color_id,
                size_id: adj.size_id,
                warehouse_dest_id: locationId,
                tipo_movimiento: delta > 0 ? 'Ajuste Auditoría (Sobrante)' : 'Ajuste Auditoría (Faltante)',
                cantidad: Math.abs(delta),
                saldo_anterior: prevQty,
                saldo_nuevo: newQty,
                documento_origen: `AUDITORÍA #${session.consecutive}`,
                usuario: userEmail || 'Sistema',
                observaciones: `Ajuste plano auditoría #${session.consecutive} (${adj.product_name} - ${adj.color_name || 'General'})`
              });
            }
          } else if (newQty > 0) {
            await supabase.from('finished_goods_stock').insert({
              product_id: adj.product_id,
              color_id: adj.color_id,
              size_id: adj.size_id,
              warehouse_id: locationId,
              cantidad_disponible: newQty
            });
          }
        }

        // B. Zero out uncounted variants of audited products
        for (const [key, records] of existingRecordsByKey.entries()) {
          if (!stockAdjustmentsMap.has(key)) {
            for (const rec of records) {
              const prevQty = Number(rec.cantidad_disponible || 0);
              if (prevQty > 0) {
                await supabase
                  .from('finished_goods_stock')
                  .update({ cantidad_disponible: 0, updated_at: new Date().toISOString() })
                  .eq('id', rec.id);

                await supabase.from('finished_goods_kardex').insert({
                  product_id: rec.product_id,
                  color_id: rec.color_id,
                  size_id: rec.size_id,
                  warehouse_dest_id: locationId,
                  tipo_movimiento: 'Ajuste Auditoría (Faltante)',
                  cantidad: prevQty,
                  saldo_anterior: prevQty,
                  saldo_nuevo: 0,
                  documento_origen: `AUDITORÍA #${session.consecutive}`,
                  usuario: userEmail || 'Sistema',
                  observaciones: `Ajuste auditoría #${session.consecutive} (Variante no encontrada en plano físico)`
                });
              }
            }
          }
        }
      }

      // 6. Register Audit Log
      await supabase.from('audit_logs').insert({
        audit_id: auditId,
        action: 'CONCILIACION_PLANO_APLICADA',
        user_email: userEmail || 'Sistema',
        after_state: {
          consecutive: session.consecutive,
          location: locationName,
          conciliados: conciliados.length,
          faltantes: faltantes.length,
          sobrantes: sobrantes.length
        }
      });

      return NextResponse.json({
        success: true,
        session,
        message: `✅ Auditoría #${session.consecutive} conciliada y ajustada exitosamente en ${locationName}: ${conciliados.length} confirmadas, ${faltantes.length} faltantes dados de baja y ${sobrantes.length} sobrantes incorporados.`,
        summary: {
          consecutive: session.consecutive,
          conciliados: conciliados.length,
          faltantes: faltantes.length,
          sobrantes: sobrantes.length,
          reconciliationRate
        }
      });
    }

    return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 });

  } catch (error: any) {
    console.error('Error in /api/inventory/audit/flat-file-reconcile:', error);
    return NextResponse.json({ error: error.message || 'Error al procesar conciliación con plano.' }, { status: 500 });
  }
}
