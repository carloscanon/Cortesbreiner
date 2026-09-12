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

    // 1. Fetch exact matching audit_items record for this session by barcode ID Único or SKU
    const { data: matchedItems } = await supabase
      .from('audit_items')
      .select('*')
      .eq('audit_id', auditId)
      .or(`barcode.eq.${cleanCode},sku_code.eq.${cleanCode},barcode.ilike.%${cleanCode}%,sku_code.ilike.%${cleanCode}%`);

    let itemToUpdate = matchedItems && matchedItems.length > 0 ? matchedItems[0] : null;

    // 2. If not found in session snapshot, check `individual_garments` database table
    if (!itemToUpdate) {
      const { data: garment } = await supabase
        .from('individual_garments')
        .select('*')
        .eq('barcode', cleanCode)
        .maybeSingle();

      if (garment) {
        // Registered in database but was not in initial expected snapshot -> Add to session as Sobrante / Hallazgo Físico
        const { data: newItem } = await supabase
          .from('audit_items')
          .insert({
            audit_id: auditId,
            product_id: garment.product_id || null,
            sku_code: cleanCode,
            barcode: cleanCode,
            product_name: garment.reference_name || 'Prenda Indiv.',
            category_name: 'Prendas Individuales',
            color_name: garment.color_name || '—',
            size_code: garment.size_code || 'ST',
            expected_qty: 0,
            counted_qty: 1,
            unit_cost: 0,
            unit_price: 0,
            status: 'Sobrante',
            item_state: 'Detectada'
          })
          .select()
          .single();

        itemToUpdate = newItem;
      }
    }

    // 3. If still not found, check `products` master
    if (!itemToUpdate) {
      const { data: prod } = await supabase
        .from('products')
        .select('*')
        .or(`codigo_referencia.ilike.${cleanCode},nombre_producto.ilike.%${cleanCode}%`)
        .limit(1)
        .maybeSingle();

      if (prod) {
        const { data: newItem } = await supabase
          .from('audit_items')
          .insert({
            audit_id: auditId,
            product_id: prod.id,
            sku_code: (prod.codigo_referencia || cleanCode).toUpperCase(),
            barcode: cleanCode,
            product_name: prod.nombre_producto || prod.codigo_referencia,
            category_name: prod.categoria || 'Sin Categoría',
            expected_qty: 0,
            counted_qty: incrementQty,
            unit_cost: prod.costo || prod.precio * 0.5 || 0,
            unit_price: prod.precio || 0,
            status: 'Sobrante',
            item_state: 'Detectada'
          })
          .select()
          .single();

        itemToUpdate = newItem;
      }
    }

    // 4. Handle Product Not Registered Scenario ⚠️
    if (!itemToUpdate) {
      await supabase.from('audit_unregistered_items').insert({
        audit_id: auditId,
        scanned_code: cleanCode,
        quantity: incrementQty,
        action_taken: 'REGISTRADO_SOBRANTE',
        reported_by: userEmail || 'Pistola Lectora',
        notes: `Código de Barras ID Único ${cleanCode} no registrado en catálogo`
      });

      return NextResponse.json({
        success: true,
        isUnregistered: true,
        message: `⚠️ Código de Barras ID Único No Registrado: ${cleanCode}`,
        code: cleanCode
      });
    }

    // 5. Update counted_qty and calculate difference (1-to-1 matching)
    let newCounted = itemToUpdate.counted_qty || 0;

    if (mode === 'set') {
      newCounted = Number(incrementQty);
    } else if (mode === 'decrement') {
      newCounted = Math.max(0, newCounted - Number(incrementQty));
    } else {
      newCounted = newCounted + Number(incrementQty);
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

    const { data: updatedItem, error: updErr } = await supabase
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
        const diff = (i.counted_qty || 0) - (i.expected_qty || 0);
        const cost = Number(i.unit_cost || i.unit_price || 0);

        if (diff < 0) {
          totalMissing += Math.abs(diff);
          financialMissing += Math.abs(diff) * cost;
        } else if (diff > 0) {
          totalSurplus += diff;
          financialSurplus += diff * cost;
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

    return NextResponse.json({
      success: true,
      item: updatedItem,
      message: `✅ Escaneado ID Único ${cleanCode}: ${updatedItem.product_name} (${updatedItem.color_name} | ${updatedItem.size_code})`
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error en escaneo de producto.' }, { status: 500 });
  }
}
