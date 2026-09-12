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

    let newlyInserted = false;

    // 2. If not found in session snapshot, check `individual_garments` database table
    if (!itemToUpdate) {
      const { data: garment } = await supabase
        .from('individual_garments')
        .select('*')
        .eq('barcode', cleanCode)
        .maybeSingle();

      if (garment) {
        // Registered in database but was not in initial expected snapshot -> Add to session as Sobrante / Hallazgo Físico (1-to-1)
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

    // 4. Handle Product Not Registered Scenario ⚠️
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
        message: `⚠️ Código de Barras ID Único No Registrado: ${cleanCode}`,
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

    const message = wasAlreadyCounted
      ? `ℹ️ Prenda (ID ${cleanCode}) ya estaba registrada (1/1)`
      : `✅ Prenda registrada (1 unidad): ${updatedItem.product_name} (${cleanCode})`;

    return NextResponse.json({
      success: true,
      item: updatedItem,
      wasAlreadyCounted,
      message
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error en escaneo de producto.' }, { status: 500 });
  }
}
