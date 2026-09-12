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
      code, // barcode or SKU
      incrementQty = 1,
      mode = 'increment', // 'increment', 'decrement', 'set'
      userEmail,
      deviceInfo = 'Pistola Lectora USB/Bluetooth'
    } = body;

    if (!auditId || !code) {
      return NextResponse.json({ error: 'Se requiere auditId y código de barras/SKU.' }, { status: 400 });
    }

    const cleanCode = code.trim().toUpperCase();

    // 1. Fetch audit_items record for this session matching barcode or SKU
    const { data: matchedItems } = await supabase
      .from('audit_items')
      .select('*')
      .eq('audit_id', auditId)
      .or(`sku_code.ilike.%${cleanCode}%,barcode.ilike.%${cleanCode}%`);

    let itemToUpdate = matchedItems && matchedItems.length > 0 ? matchedItems[0] : null;

    // If not found in audit_items, try finding product in master `products` or `individual_garments`
    if (!itemToUpdate) {
      const { data: prod } = await supabase
        .from('products')
        .select('*')
        .or(`codigo_referencia.ilike.${cleanCode},nombre_producto.ilike.%${cleanCode}%`)
        .limit(1)
        .single();

      if (prod) {
        // Create new item in audit_items as unexpected/new physical discovery
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

    // 2. Handle Product Not Registered Scenario ⚠️
    if (!itemToUpdate) {
      await supabase.from('audit_unregistered_items').insert({
        audit_id: auditId,
        scanned_code: cleanCode,
        quantity: incrementQty,
        action_taken: 'REGISTRADO_SOBRANTE',
        reported_by: userEmail || 'Pistola Lectora',
        notes: `Escaneado el ${new Date().toLocaleString('es-CO')} no encontrado en catálogo`
      });

      return NextResponse.json({
        success: true,
        isUnregistered: true,
        message: `⚠️ Producto No Registrado: ${cleanCode}`,
        code: cleanCode
      });
    }

    // 3. Update counted_qty and calculate difference
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

    // 4. Record scan event in audit_scans
    await supabase.from('audit_scans').insert({
      audit_id: auditId,
      sku_code: itemToUpdate.sku_code,
      barcode: cleanCode,
      counted_by: userEmail || 'Pistola Lectora',
      device_info: deviceInfo
    });

    // 5. Recalculate Session Metrics & Impact in DB
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
      message: `✅ Escaneado: ${updatedItem.product_name} (${updatedItem.counted_qty} contados)`
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error en escaneo de producto.' }, { status: 500 });
  }
}
