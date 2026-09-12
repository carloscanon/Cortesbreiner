import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
      code, // barcode ID Único or SKU
      incrementQty = 1,
      mode = 'increment', // 'increment', 'decrement', 'set'
      userEmail,
      deviceInfo = 'Pistola Lectora USB/Bluetooth'
    } = body;

    if (!auditId || !code) {
      return NextResponse.json({ error: 'Se requiere auditId y Código de Barras ID Único.' }, { status: 400 });
    }

    const cleanCode = code.trim().toUpperCase();

    // Fetch audit session to get target location_id & location_name
    const { data: auditSession } = await supabase
      .from('audit_sessions')
      .select('id, location_id, location_name')
      .eq('id', auditId)
      .single();

    const targetLocationId = auditSession?.location_id || 'all';
    const targetLocationName = auditSession?.location_name || 'Ubicación General';

    let itemToUpdate: any = null;
    let newlyInserted = false;
    let belongsToAuditWarehouse = true;
    let actualGarmentWarehouseName: string | null = null;

    const digitsOnly = cleanCode.replace(/\D/g, '');
    const padded10 = digitsOnly ? digitsOnly.padStart(10, '0') : cleanCode;
    const padded8 = digitsOnly ? digitsOnly.padStart(8, '0') : cleanCode;
    const unpadded = digitsOnly ? digitsOnly.replace(/^0+/, '') : cleanCode;

    const codeClean = cleanCode;

    // 1. Search in `individual_garments` database (ID Único / Código de Barras de Prenda)
    let garmentList: any[] | null = null;

    // Direct query by exact or padded/unpadded codes
    const { data: directGarments } = await supabase
      .from('individual_garments')
      .select('*, warehouses(id, nombre_bodega)')
      .or(`barcode.eq.${codeClean},barcode.eq.${padded10},barcode.eq.${padded8},barcode.eq.${unpadded},garment_id.eq.${codeClean},garment_id.eq.${unpadded}`)
      .order('created_at', { ascending: false });

    garmentList = directGarments;

    // Fallback: If not found by exact equal, search by ilike %code%
    if (!garmentList || garmentList.length === 0) {
      const { data: ilikeGarments } = await supabase
        .from('individual_garments')
        .select('*, warehouses(id, nombre_bodega)')
        .ilike('barcode', `%${unpadded}%`)
        .order('created_at', { ascending: false })
        .limit(5);

      garmentList = ilikeGarments;
    }

    if (garmentList && garmentList.length > 0) {
      // Prioritize garment in target warehouse if available
      const garment = garmentList.find((g: any) => targetLocationId === 'all' || g.warehouse_id === targetLocationId) || garmentList[0];
      const whObj: any = garment.warehouses;
      actualGarmentWarehouseName = (Array.isArray(whObj) ? whObj[0]?.nombre_bodega : whObj?.nombre_bodega) || 'Otra Bodega';

      if (targetLocationId !== 'all' && garment.warehouse_id && garment.warehouse_id !== targetLocationId) {
        belongsToAuditWarehouse = false;
      }

      // Resolve real product name from products master
      let resolvedProductName = garment.reference_name || 'Prenda Única';
      let resolvedProductId = garment.product_id || null;

      const { data: prodMaster } = await supabase.from('products').select('*');
      if (prodMaster && prodMaster.length > 0) {
        if (resolvedProductId) {
          const pObj = prodMaster.find(p => p.id === resolvedProductId);
          if (pObj) resolvedProductName = pObj.nombre_producto;
        } else if (garment.reference_name) {
          const refClean = garment.reference_name.trim().toUpperCase();
          const pObj = prodMaster.find(p =>
            (p.codigo_referencia && p.codigo_referencia.trim().toUpperCase() === refClean) ||
            (p.nombre_producto && p.nombre_producto.trim().toUpperCase() === refClean)
          );
          if (pObj) {
            resolvedProductId = pObj.id;
            resolvedProductName = pObj.nombre_producto;
          }
        }
      }

      // Check if already in audit_items snapshot for this session strictly by ID Único / Barcode
      const { data: matchedItems } = await supabase
        .from('audit_items')
        .select('*')
        .eq('audit_id', auditId)
        .or(`barcode.eq.${codeClean},barcode.eq.${garment.barcode},barcode.eq.${padded10},barcode.eq.${padded8},barcode.eq.${unpadded}`);

      if (matchedItems && matchedItems.length > 0) {
        itemToUpdate = matchedItems[0];
      } else {
        // Registered in individual_garments but wasn't in initial expected snapshot for this session
        const { data: newItem } = await supabase
          .from('audit_items')
          .insert({
            audit_id: auditId,
            product_id: resolvedProductId,
            sku_code: garment.barcode || codeClean,
            barcode: garment.barcode || codeClean,
            product_name: resolvedProductName,
            category_name: 'Prendas Individuales',
            color_name: garment.color_name || '—',
            size_code: garment.size_code || 'ST',
            expected_qty: 0,
            counted_qty: 1, // Strictly 1 unit initially
            difference_cost: 0,
            difference_price: 0,
            status: 'Sobrante',
            item_state: 'Detectada'
          })
          .select()
          .single();

        itemToUpdate = newItem;
        newlyInserted = true;
      }
    }

    // 2. If not found in individual_garments, check `products` catalog strictly by reference barcode
    if (!itemToUpdate) {
      const { data: prodList } = await supabase
        .from('products')
        .select('*')
        .or(`codigo_referencia.eq.${codeClean},codigo_referencia.eq.${unpadded},codigo_referencia.eq.${padded10},codigo_referencia.eq.${padded8}`)
        .limit(1);

      const prod = prodList && prodList.length > 0 ? prodList[0] : null;

      if (prod) {
        // Check finished_goods_stock to determine warehouse belonging
        const { data: stockList } = await supabase
          .from('finished_goods_stock')
          .select('*, warehouses(id, nombre_bodega)')
          .eq('product_id', prod.id);

        if (stockList && stockList.length > 0) {
          const matchWh = stockList.find((s: any) => targetLocationId === 'all' || s.warehouse_id === targetLocationId) || stockList[0];
          const whObj: any = matchWh.warehouses;
          actualGarmentWarehouseName = (Array.isArray(whObj) ? whObj[0]?.nombre_bodega : whObj?.nombre_bodega) || 'Otra Bodega';

          if (targetLocationId !== 'all' && matchWh.warehouse_id && matchWh.warehouse_id !== targetLocationId) {
            belongsToAuditWarehouse = false;
          }
        }

        // Check if item is already in audit_items snapshot strictly by barcode ID Único
        const { data: matchedItems } = await supabase
          .from('audit_items')
          .select('*')
          .eq('audit_id', auditId)
          .or(`barcode.eq.${codeClean},barcode.eq.${unpadded},barcode.eq.${padded10},barcode.eq.${padded8}`);

        if (matchedItems && matchedItems.length > 0) {
          itemToUpdate = matchedItems[0];
        } else {
          const { data: newItem } = await supabase
            .from('audit_items')
            .insert({
              audit_id: auditId,
              product_id: prod.id,
              sku_code: (prod.codigo_referencia || codeClean).toUpperCase(),
              barcode: codeClean,
              product_name: prod.nombre_producto || prod.codigo_referencia,
              category_name: prod.categoria || 'Sin Categoría',
              expected_qty: 0,
              counted_qty: 1, // Strictly 1 unit initially
              unit_cost: prod.costo || prod.precio * 0.5 || 0,
              unit_price: prod.precio || 0,
              status: 'Sobrante',
              item_state: 'Detectada'
            })
            .select()
            .single();

          itemToUpdate = newItem;
          newlyInserted = true;
        }
      }
    }

    // 4. Handle Product Not Registered Scenario ⚠️ (Only when neither garment nor product exists in DB)
    if (!itemToUpdate) {
      await supabase.from('audit_unregistered_items').insert({
        audit_id: auditId,
        scanned_code: cleanCode,
        quantity: 1,
        action_taken: 'REGISTRADO_SOBRANTE',
        reported_by: userEmail || 'Pistola Lectora',
        notes: `Código de Barras ID Único ${cleanCode} no registrado en catálogo`
      });

      return NextResponse.json({
        success: true,
        isUnregistered: true,
        message: `⚠️ Código de Barras ID Único No Registrado en Catálogo: ${cleanCode}`,
        code: cleanCode
      });
    }

    // 5. Update counted_qty and calculate difference (Strict 1-to-1 barcode sticker matching)
    let updatedItem = itemToUpdate;
    let wasAlreadyCounted = false;

    if (!newlyInserted) {
      let newCounted = itemToUpdate.counted_qty || 0;

      if (mode === 'set') {
        newCounted = Number(incrementQty);
      } else if (mode === 'decrement') {
        newCounted = Math.max(0, newCounted - 1);
      } else {
        // Strict 1-to-1 unique garment barcode sticker check:
        // If expected_qty is 0 or 1 for individual barcode sticker, cap counted_qty to strictly 1!
        const isIndividualSticker = itemToUpdate.expected_qty <= 1 || itemToUpdate.barcode === cleanCode;
        if (isIndividualSticker) {
          if (newCounted >= 1) {
            wasAlreadyCounted = true;
          }
          newCounted = 1;
        } else {
          newCounted = newCounted + 1;
        }
      }

      const expected = itemToUpdate.expected_qty || 0;
      const diff = newCounted - expected;
      const unitCost = Number(itemToUpdate.unit_cost || 0);
      const unitPrice = Number(itemToUpdate.unit_price || 0);
      const diffCost = diff * unitCost;
      const diffPrice = diff * unitPrice;

      let newStatus = 'OK';
      if (diff < 0) newStatus = 'Faltante';
      if (diff > 0) newStatus = 'Sobrante';

      const { data: updated, error: updErr } = await supabase
        .from('audit_items')
        .update({
          counted_qty: newCounted,
          difference_cost: diffCost,
          difference_price: diffPrice,
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', itemToUpdate.id)
        .select()
        .single();

      if (updErr) {
        console.error('Error updating audit item:', updErr);
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }
      updatedItem = updated;
    }

    // 6. Record scan event in audit_scans
    await supabase.from('audit_scans').insert({
      audit_id: auditId,
      sku_code: itemToUpdate.sku_code,
      barcode: cleanCode,
      counted_by: userEmail || 'Pistola Lectora',
      device_info: deviceInfo
    });

    // 7. Recalculate Session Metrics & Impact in DB
    const { data: allItems } = await supabase
      .from('audit_items')
      .select('*')
      .eq('audit_id', auditId);

    if (allItems) {
      let totalExpected = 0;
      let totalCounted = 0;
      let totalMissing = 0;
      let totalSurplus = 0;
      let financialMissing = 0;
      let financialSurplus = 0;

      allItems.forEach(i => {
        totalExpected += i.expected_qty || 0;
        totalCounted += i.counted_qty || 0;
        const d = (i.counted_qty || 0) - (i.expected_qty || 0);
        const cost = Number(i.unit_cost || i.unit_price || 0);

        if (d < 0) {
          totalMissing += Math.abs(d);
          financialMissing += Math.abs(d) * cost;
        } else if (d > 0) {
          totalSurplus += d;
          financialSurplus += d * cost;
        }
      });

      const netImpact = financialSurplus - financialMissing;
      const rate = totalExpected > 0 ? Math.max(0, Math.min(100, Math.round(((totalCounted - Math.abs(totalSurplus)) / totalExpected) * 100))) : 100;

      await supabase.from('audit_sessions').update({
        total_counted_qty: totalCounted,
        total_missing_qty: totalMissing,
        total_surplus_qty: totalSurplus,
        financial_impact: netImpact,
        financial_missing: financialMissing,
        financial_surplus: financialSurplus,
        reconciliation_rate: rate,
        updated_at: new Date().toISOString()
      }).eq('id', auditId);
    }

    let message = wasAlreadyCounted
      ? `ℹ️ Prenda (ID ${cleanCode}) ya estaba registrada (1/1)`
      : `✅ Prenda registrada (1 unidad): ${updatedItem.product_name} (${cleanCode})`;

    if (!belongsToAuditWarehouse && actualGarmentWarehouseName) {
      message += ` ⚠️ ATENCIÓN: Esta prenda pertenece a la bodega "${actualGarmentWarehouseName}", no a esta bodega ("${targetLocationName}").`;
    }

    return NextResponse.json({
      success: true,
      item: updatedItem,
      wasAlreadyCounted,
      belongsToAuditWarehouse,
      actualGarmentWarehouseName,
      targetLocationName,
      message
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error en escaneo de producto.' }, { status: 500 });
  }
}
