import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({ error: 'Supabase credentials missing.' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get('locationId');
    const status = searchParams.get('status');
    const sessionId = searchParams.get('sessionId');

    // Fetch single session with full item details
    if (sessionId) {
      const { data: session, error: sErr } = await supabase
        .from('audit_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sErr || !session) {
        return NextResponse.json({ error: 'Sesión de auditoría no encontrada.' }, { status: 404 });
      }

      let items: any[] = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data: chunk, error: itemsErr } = await supabase
          .from('audit_items')
          .select('*')
          .eq('audit_id', sessionId)
          .order('created_at', { ascending: true })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (itemsErr || !chunk || chunk.length === 0) break;
        items = items.concat(chunk);
        if (chunk.length < pageSize) break;
        page++;
      }

      const { data: unregistered } = await supabase
        .from('audit_unregistered_items')
        .select('*')
        .eq('audit_id', sessionId);

      const { data: logs } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('audit_id', sessionId)
        .order('timestamp', { ascending: false });

      const { data: adjustmentRequests } = await supabase
        .from('audit_adjustment_requests')
        .select('*')
        .eq('audit_id', sessionId)
        .order('created_at', { ascending: false });

      return NextResponse.json({
        success: true,
        session,
        items: items || [],
        unregistered: unregistered || [],
        logs: logs || [],
        adjustmentRequests: adjustmentRequests || []
      });
    }

    // Query session list
    let query = supabase.from('audit_sessions').select('*').order('created_at', { ascending: false });

    if (locationId && locationId !== 'all') {
      query = query.eq('location_id', locationId);
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: sessions, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      sessions: sessions || []
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al consultar auditorías.' }, { status: 500 });
  }
}

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
      locationId,
      locationName,
      auditType = 'Completo',
      categories = [],
      samplePercentage = 100,
      userEmail,
      notes
    } = body;

    if (!locationId || !locationName) {
      return NextResponse.json({ error: 'Debe especificar la ubicación a auditar.' }, { status: 400 });
    }

    // Normalize target categories for partial audit by category
    const targetCategories: string[] = Array.isArray(categories) && categories.length > 0
      ? categories.map((c: any) => (typeof c === 'string' ? c : c.categoria || c.name || '').trim().toLowerCase())
      : [];

    // 1. Create audit_sessions entry
    const { data: session, error: sessErr } = await supabase
      .from('audit_sessions')
      .insert({
        location_id: locationId,
        location_name: locationName,
        audit_type: auditType,
        sample_percentage: samplePercentage,
        status: 'En Progreso',
        created_by: userEmail || 'Sistema',
        notes: notes || `Auditoría ${auditType} en ${locationName}`
      })
      .select()
      .single();

    if (sessErr || !session) {
      console.error('Error creating audit session:', sessErr);
      return NextResponse.json({ error: 'Error al crear la sesión de auditoría: ' + sessErr?.message }, { status: 500 });
    }

    const auditItemsToInsert: any[] = [];
    let totalExpectedItems = 0;
    let totalExpectedQty = 0;

    // 2. Query 1-to-1 individual barcode garments (`individual_garments`) with pagination
    let garments: any[] = [];
    const pageSize = 1000;
    let page = 0;

    // Filter by category keyword if targetCategories specified
    const filterKeyword = targetCategories.length > 0 
      ? targetCategories.find(c => !['body', 'tipo', 'linea'].includes(c) && c.length >= 3) || targetCategories[0]
      : null;

    while (true) {
      let q = supabase
        .from('individual_garments')
        .select('*')
        .neq('status', 'vendido');

      if (locationId !== 'all') {
        q = q.eq('warehouse_id', locationId);
      }

      if (filterKeyword) {
        q = q.ilike('reference_name', `%${filterKeyword}%`);
      }

      const { data: chunk, error: gErr } = await q.range(page * pageSize, (page + 1) * pageSize - 1);
      if (gErr || !chunk || chunk.length === 0) break;
      garments = garments.concat(chunk);
      if (chunk.length < pageSize) break;
      page++;
    }

    const registeredBarcodes = new Set<string>();

    if (garments && garments.length > 0) {
      // Fetch product prices map for unit cost/price resolution
      const { data: prods } = await supabase.from('products').select('id, codigo_referencia, nombre_producto, precio, costo, categoria, category_id');
      const prodMap = new Map<string, any>();
      prods?.forEach((p: any) => {
        if (p.id) prodMap.set(p.id, p);
        if (p.codigo_referencia) prodMap.set(p.codigo_referencia.trim().toUpperCase(), p);
        if (p.nombre_producto) prodMap.set(p.nombre_producto.trim().toLowerCase(), p);
      });

      garments.forEach(g => {
        if (!g.barcode) return;
        const bCode = g.barcode.trim();

        const prod = prodMap.get(g.product_id) || prodMap.get((g.reference_name || '').trim().toLowerCase()) || prodMap.get((g.reference_name || '').trim().toUpperCase());
        const categoryName = (prod?.categoria || 'Prendas Individuales').trim();

        // If partial audit by category is active, filter out garments outside selected categories
        if (targetCategories.length > 0) {
          const catLower = categoryName.toLowerCase();
          const refLower = (g.reference_name || '').toLowerCase();
          const prodNameLower = (prod?.nombre_producto || '').toLowerCase();

          const matchesCategory = targetCategories.some(tc => {
            const cleanTc = tc.trim().toLowerCase();
            if (!cleanTc) return false;
            return catLower.includes(cleanTc) || cleanTc.includes(catLower) ||
                   refLower.includes(cleanTc) || prodNameLower.includes(cleanTc);
          });
          if (!matchesCategory) return;
        }

        registeredBarcodes.add(bCode);

        const productName = g.reference_name || prod?.nombre_producto || 'Prenda Indiv.';
        const unitCost = Number(prod?.costo || (prod?.precio ? prod.precio * 0.5 : 25000));
        const unitPrice = Number(prod?.precio || 50000);

        auditItemsToInsert.push({
          audit_id: session.id,
          product_id: g.product_id || prod?.id || null,
          sku_code: bCode,
          barcode: bCode,
          product_name: productName,
          category_name: categoryName,
          color_name: g.color_name || '—',
          size_code: g.size_code || 'ST',
          expected_qty: 1, // 1-to-1 matching per barcode sticker!
          counted_qty: 0,
          unit_cost: unitCost,
          unit_price: unitPrice,
          status: 'Faltante',
          item_state: 'Detectada'
        });

        totalExpectedItems += 1;
        totalExpectedQty += 1;
      });
    }

    // 3. Supplement from `finished_goods_stock` for non-barcoded SKU aggregations in the selected warehouse
    let expectedStock: any[] = [];
    
    if (locationId !== 'all') {
      const { data: stData } = await supabase
        .from('finished_goods_stock')
        .select(`
          id, product_id, color_id, size_id, warehouse_id, cantidad_disponible,
          products (id, nombre_producto, codigo_referencia, precio, costo, categoria, category_id, categories(categoria)),
          colors (id, nombre_color),
          sizes (id, codigo_talla),
          warehouses (id, nombre_bodega)
        `)
        .eq('warehouse_id', locationId);

      if (stData && stData.length > 0) {
        expectedStock = stData;
      } else {
        // Fallback: search by warehouse name matching
        const { data: stAll } = await supabase
          .from('finished_goods_stock')
          .select(`
            id, product_id, color_id, size_id, warehouse_id, cantidad_disponible,
            products (id, nombre_producto, codigo_referencia, precio, costo, categoria, category_id, categories(categoria)),
            colors (id, nombre_color),
            sizes (id, codigo_talla),
            warehouses (id, nombre_bodega)
          `);

        if (stAll && stAll.length > 0) {
          const targetName = locationName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
          expectedStock = stAll.filter((st: any) => {
            const whName = (st.warehouses?.nombre_bodega || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
            return st.warehouse_id === locationId || (whName && (whName.includes(targetName) || targetName.includes(whName)));
          });
        }
      }
    } else {
      const { data: stData } = await supabase
        .from('finished_goods_stock')
        .select(`
          id, product_id, color_id, size_id, warehouse_id, cantidad_disponible,
          products (id, nombre_producto, codigo_referencia, precio, costo, categoria, category_id, categories(categoria)),
          colors (id, nombre_color),
          sizes (id, codigo_talla),
          warehouses (id, nombre_bodega)
        `);
      expectedStock = stData || [];
    }

    if (expectedStock && expectedStock.length > 0) {
      expectedStock.forEach(st => {
        // Skip stock items with 0 available quantity or items already registered individually by barcode
        const qtyAvailable = Number(st.cantidad_disponible || 0);
        if (qtyAvailable <= 0) return;

        const prod = Array.isArray(st.products) ? st.products[0] : st.products;
        const color = Array.isArray(st.colors) ? st.colors[0] : st.colors;
        const size = Array.isArray(st.sizes) ? st.sizes[0] : st.sizes;

        const catObj = Array.isArray(prod?.categories) ? prod?.categories[0] : prod?.categories;
        const categoryName = (catObj?.categoria || prod?.categoria || 'Sin Categoría').trim();

        // If partial audit by category is active, filter out stock outside selected categories
        if (targetCategories.length > 0) {
          const catLower = categoryName.toLowerCase();
          const refLower = (prod?.codigo_referencia || '').toLowerCase();
          const prodLower = (prod?.nombre_producto || '').toLowerCase();

          const matchesCategory = targetCategories.some(tc => {
            const cleanTc = tc.trim().toLowerCase();
            if (!cleanTc) return false;
            return catLower.includes(cleanTc) || cleanTc.includes(catLower) ||
                   refLower.includes(cleanTc) || prodLower.includes(cleanTc);
          });
          if (!matchesCategory) return;
        }

        const productRef = prod?.codigo_referencia || 'SIN-REF';
        const productName = prod?.nombre_producto || productRef;
        const colorName = color?.nombre_color || '—';
        const sizeCode = size?.codigo_talla || 'ST';

        const skuCode = `${productRef}_${colorName}_${sizeCode}`.toUpperCase();

        // If individual garments were already loaded for this warehouse, don't duplicate
        const alreadyLoaded = auditItemsToInsert.some(item => item.sku_code === skuCode || item.barcode === productRef);
        if (alreadyLoaded) return;

        const unitCost = Number(prod?.costo || prod?.precio * 0.5 || 0);
        const unitPrice = Number(prod?.precio || 0);

        auditItemsToInsert.push({
          audit_id: session.id,
          product_id: st.product_id,
          color_id: st.color_id,
          size_id: st.size_id,
          sku_code: skuCode,
          barcode: productRef,
          product_name: productName,
          category_name: categoryName,
          color_name: colorName,
          size_code: sizeCode,
          expected_qty: qtyAvailable,
          counted_qty: 0,
          unit_cost: unitCost,
          unit_price: unitPrice,
          status: 'Faltante',
          item_state: 'Detectada'
        });

        totalExpectedItems += 1;
        totalExpectedQty += qtyAvailable;
      });
    }

    // Insert batch into audit_items
    if (auditItemsToInsert.length > 0) {
      // Chunk insert into batches of 500 for high performance
      for (let i = 0; i < auditItemsToInsert.length; i += 500) {
        const chunk = auditItemsToInsert.slice(i, i + 500);
        await supabase.from('audit_items').insert(chunk);
      }
    }

    // 4. Update session initial totals
    await supabase.from('audit_sessions').update({
      total_expected_items: totalExpectedItems,
      total_expected_qty: totalExpectedQty,
      total_missing_qty: totalExpectedQty
    }).eq('id', session.id);

    // 5. Record audit log
    await supabase.from('audit_logs').insert({
      audit_id: session.id,
      action: 'CREACION',
      user_email: userEmail || 'Sistema',
      after_state: {
        consecutive: session.consecutive,
        location: locationName,
        total_expected: totalExpectedQty,
        barcodes_count: registeredBarcodes.size
      }
    });

    return NextResponse.json({
      success: true,
      session: {
        ...session,
        total_expected_items: totalExpectedItems,
        total_expected_qty: totalExpectedQty
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al iniciar sesión de auditoría.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({ error: 'Supabase credentials missing.' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Se requiere id de la auditoría a eliminar.' }, { status: 400 });
    }

    // Delete related audit items, unregistered items, and logs first
    await supabase.from('audit_items').delete().eq('audit_id', id);
    await supabase.from('audit_unregistered_items').delete().eq('audit_id', id);
    await supabase.from('audit_scans').delete().eq('audit_id', id);
    await supabase.from('audit_logs').delete().eq('audit_id', id);
    await supabase.from('audit_adjustment_requests').delete().eq('audit_id', id);

    // Delete audit session entry
    const { error: delErr } = await supabase
      .from('audit_sessions')
      .delete()
      .eq('id', id);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Sesión de auditoría eliminada exitosamente.'
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al eliminar la auditoría.' }, { status: 500 });
  }
}
