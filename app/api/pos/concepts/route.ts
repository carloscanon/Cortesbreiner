import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://plsvbuzcjtztpidsjmua.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEFAULT_CONCEPTS = [
  { id: 'detal', nombre: 'Venta Detal / Minorista', color: '#10b981', descripcion: 'Venta regular al detal en tienda física', is_default: true, activo: true },
  { id: 'mayorista', nombre: 'Ventas Mayoristas', color: '#3b82f6', descripcion: 'Ventas al por mayor o distribuidores comerciales', is_default: false, activo: true },
  { id: 'dotacion', nombre: 'Dotación Empresarial', color: '#8b5cf6', descripcion: 'Dotaciones para empresas y uniformes corporativos', is_default: false, activo: true },
  { id: 'evento', nombre: 'Venta Evento / Feria', color: '#f59e0b', descripcion: 'Ventas en ferias, bazares o activaciones de marca', is_default: false, activo: true },
  { id: 'cortesia', nombre: 'Cortesía / Obsequio', color: '#ec4899', descripcion: 'Salidas de cortesía, muestras o intercambios publicitarios', is_default: false, activo: true },
  { id: 'consignacion', nombre: 'Venta Consignación', color: '#06b6d4', descripcion: 'Despachos o ventas bajo modalidad de consignación', is_default: false, activo: true }
];

function getAdminClient() {
  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurado en el servidor');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function normalizeConcepts(list: any[]): any[] {
  return (list || []).map((c: any) => ({
    id: c.id,
    nombre: c.nombre || c.name || '',
    name: c.nombre || c.name || '',
    color: c.color || '#3b82f6',
    descripcion: c.descripcion || c.description || '',
    description: c.descripcion || c.description || '',
    is_default: Boolean(c.is_default),
    activo: c.activo !== false
  }));
}

export async function GET() {
  try {
    const supabase = getAdminClient();

    // 1. Try settings table
    const { data: settingRow, error: settingError } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'pos_sales_concepts')
      .maybeSingle();

    if (!settingError && settingRow?.value) {
      try {
        const parsed = typeof settingRow.value === 'string' ? JSON.parse(settingRow.value) : settingRow.value;
        if (Array.isArray(parsed) && parsed.length > 0) {
          return NextResponse.json({ success: true, concepts: normalizeConcepts(parsed) });
        }
      } catch (e) {
        console.warn('Error parsing concepts from settings, falling back to company_params', e);
      }
    }

    // 2. Try company_params table
    const { data: paramRow } = await supabase
      .from('company_params')
      .select('value')
      .eq('name', 'pos_sales_concepts')
      .maybeSingle();

    if (paramRow?.value) {
      try {
        const parsed = typeof paramRow.value === 'string' ? JSON.parse(paramRow.value) : paramRow.value;
        if (Array.isArray(parsed) && parsed.length > 0) {
          return NextResponse.json({ success: true, concepts: normalizeConcepts(parsed) });
        }
      } catch (e) {
        console.warn('Error parsing concepts from company_params', e);
      }
    }

    // 3. If not found in either, seed default concepts
    await supabase.from('settings').upsert({
      key: 'pos_sales_concepts',
      value: JSON.stringify(DEFAULT_CONCEPTS),
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });

    await supabase.from('company_params').upsert({
      name: 'pos_sales_concepts',
      value: JSON.stringify(DEFAULT_CONCEPTS),
      description: 'Conceptos de catalogación de ventas POS'
    }, { onConflict: 'name' });

    return NextResponse.json({ success: true, concepts: DEFAULT_CONCEPTS });
  } catch (error: any) {
    console.error('Error in GET /api/pos/concepts:', error);
    return NextResponse.json({ success: false, error: error.message, concepts: DEFAULT_CONCEPTS }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getAdminClient();
    const body = await request.json();

    // Load current concepts
    let currentConcepts: any[] = [];
    const { data: settingRow } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'pos_sales_concepts')
      .maybeSingle();

    if (settingRow?.value) {
      try {
        currentConcepts = typeof settingRow.value === 'string' ? JSON.parse(settingRow.value) : settingRow.value;
      } catch {
        currentConcepts = [...DEFAULT_CONCEPTS];
      }
    } else {
      currentConcepts = [...DEFAULT_CONCEPTS];
    }

    let updatedList = [...currentConcepts];

    if (Array.isArray(body.concepts)) {
      // Direct replace
      updatedList = body.concepts;
    } else if (body.action === 'add') {
      const { concept } = body;
      if (!concept || !concept.nombre) {
        return NextResponse.json({ error: 'El nombre del concepto es obligatorio' }, { status: 400 });
      }
      const newId = concept.id || concept.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `c_${Date.now()}`;
      
      // If marked as default, unmark previous defaults
      if (concept.is_default) {
        updatedList = updatedList.map(c => ({ ...c, is_default: false }));
      }

      // Check if id exists
      const existingIdx = updatedList.findIndex(c => c.id === newId);
      const newConcept = {
        id: newId,
        nombre: concept.nombre.trim(),
        color: concept.color || '#3b82f6',
        descripcion: (concept.descripcion || '').trim(),
        is_default: Boolean(concept.is_default),
        activo: concept.activo !== false
      };

      if (existingIdx >= 0) {
        updatedList[existingIdx] = newConcept;
      } else {
        updatedList.push(newConcept);
      }
    } else if (body.action === 'update') {
      const { concept } = body;
      if (!concept || !concept.id) {
        return NextResponse.json({ error: 'ID de concepto requerido para actualizar' }, { status: 400 });
      }

      if (concept.is_default) {
        updatedList = updatedList.map(c => ({ ...c, is_default: false }));
      }

      updatedList = updatedList.map(c => {
        if (c.id === concept.id) {
          return {
            ...c,
            ...concept,
            nombre: concept.nombre ? concept.nombre.trim() : c.nombre,
            color: concept.color || c.color,
            descripcion: concept.descripcion !== undefined ? concept.descripcion.trim() : c.descripcion,
            is_default: Boolean(concept.is_default),
            activo: concept.activo !== false
          };
        }
        return c;
      });
    } else if (body.action === 'delete') {
      const { id } = body;
      if (!id) {
        return NextResponse.json({ error: 'ID de concepto requerido para eliminar' }, { status: 400 });
      }
      updatedList = updatedList.filter(c => c.id !== id);
    } else {
      return NextResponse.json({ error: 'Acción no soportada. Use concepts array, o action add/update/delete' }, { status: 400 });
    }

    // Persist to settings
    await supabase.from('settings').upsert({
      key: 'pos_sales_concepts',
      value: JSON.stringify(updatedList),
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });

    // Persist to company_params
    await supabase.from('company_params').upsert({
      name: 'pos_sales_concepts',
      value: JSON.stringify(updatedList),
      description: 'Conceptos de catalogación de ventas POS'
    }, { onConflict: 'name' });

    return NextResponse.json({ success: true, concepts: updatedList });
  } catch (error: any) {
    console.error('Error in POST /api/pos/concepts:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
