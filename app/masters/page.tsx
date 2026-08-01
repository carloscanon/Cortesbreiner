'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Plus, Search, Tag, Briefcase, Palette, Droplets, MoreVertical, X, Loader2, 
  Ruler, LayoutGrid, Factory, Truck, Warehouse, Monitor, AlertTriangle, 
  CheckCircle, Activity, DollarSign, Settings, User, Printer, Download, ExternalLink
} from 'lucide-react';

// Configuration for all masters
const MASTER_CONFIG: any = {
  accessories: {
    title: 'Maestro de Accesorios',
    table: 'accessories',
    icon: Tag,
    listFields: ['codigo', 'tipo', 'unidad_medida', 'costo_unitario'],
    fields: [
      { name: 'nombre', label: 'Nombre Accesorio', type: 'text', required: true },
      { name: 'tipo', label: 'Tipo', type: 'select', options: ['Hilo', 'Aguja', 'Botón', 'Cremallera', 'Elástico', 'Cinta', 'Marquilla', 'Otro'] },
      { name: 'unidad_medida', label: 'Unidad de Medida', type: 'text' },
      { name: 'costo_unitario', label: 'Costo Unitario ($)', type: 'number' }
    ]
  },
  fabrics: {
    title: 'Maestro de Telas',
    table: 'fabrics',
    icon: Droplets,
    listFields: ['factura_relacionada', 'tipo_tela', 'composicion', 'kilos', 'metros', 'capas', 'costo_con_iva'],
    fields: [
      { name: 'factura_relacionada', label: 'N° Factura Relacionada', type: 'text' },
      { name: 'codigo_tela', label: 'Código Tela', type: 'text' },
      { name: 'nombre_tela', label: 'Nombre Tela', type: 'text', required: true },
      { name: 'tipo_tela', label: 'Tipo de Tela', type: 'text' },
      { name: 'composicion', label: 'Composición', type: 'text' },
      { name: 'ancho', label: 'Ancho (m)', type: 'number' },
      { name: 'gramaje', label: 'Gramaje (g/m²)', type: 'number' },
      { name: 'rendimiento_estimado', label: 'Rendimiento Estimado', type: 'number' },
      { name: 'kilos', label: 'Kilos (Facturados)', type: 'number' },
      { name: 'metros', label: 'Metros (Calculados)', type: 'number' },
      { name: 'capas', label: 'Capas (Calculadas)', type: 'number' },
      { name: 'capas_maximas', label: 'Capas (Límite)', type: 'number' },
      { name: 'costo_unitario', label: 'Costo Unitario ($)', type: 'number' },
      { name: 'costo_con_iva', label: 'Costo con IVA ($)', type: 'number', disabled: true }
    ]
  },
  colors: {
    title: 'Maestro de Colores',
    table: 'colors',
    icon: Palette,
    listFields: ['referencia_proveedor'],
    fields: [
      { name: 'codigo_color', label: 'Código Color', type: 'text' },
      { name: 'nombre_color', label: 'Nombre Color', type: 'text', required: true },
      { name: 'hex_color', label: 'Color (HEX)', type: 'color' },
      { name: 'referencia_proveedor', label: 'Ref. Proveedor', type: 'text' }
    ]
  },
  sizes: {
    title: 'Maestro de Tallas',
    table: 'sizes',
    icon: Ruler,
    listFields: ['genero', 'orden_visual'],
    fields: [
      { name: 'codigo_talla', label: 'Código (ej: S, M)', type: 'text', required: true },
      { name: 'nombre_talla', label: 'Nombre Largo', type: 'text', required: true },
      { name: 'orden_visual', label: 'Orden Visual', type: 'number' },
      { name: 'genero', label: 'Género', type: 'text' }
    ]
  },
  products: {
    title: 'Maestro de Productos',
    table: 'products',
    icon: LayoutGrid,
    listFields: ['category_id', 'precio', 'precio_con_iva'],
    fields: [
      { name: 'codigo_referencia', label: 'Referencia (Opcional - Auto)', type: 'text', disabled: false },
      { name: 'nombre_producto', label: 'Nombre Producto', type: 'text', required: true },
      { name: 'category_id', label: 'Categoría', type: 'select', options: [] },
      { name: 'genero', label: 'Género', type: 'select', options: ['M', 'F'] },
      { name: 'iva', label: 'IVA (%)', type: 'number', disabled: true },
      { name: 'precio', label: 'Precio ($)', type: 'number' },
      { name: 'precio_con_iva', label: 'Precio con IVA ($)', type: 'number', disabled: true },
      { name: 'imagen_url', label: 'Imagen del Producto', type: 'image' }
    ]
  },
  categories: {
    title: 'Maestro de Categorías',
    table: 'categories',
    icon: Tag,
    listFields: ['cod_categoria', 'linea'],
    fields: [
      { name: 'cod_categoria', label: 'Cód. Categoría (Auto)', type: 'text', disabled: true },
      { name: 'categoria', label: 'Nombre Categoría', type: 'text', required: true },
      { name: 'linea', label: 'Línea', type: 'text' },
      { name: 'ficha_tecnica_url', label: 'URL Ficha Técnica (PDF/Link)', type: 'text' }
    ]
  },
  workshops: {
    title: 'Talleres Satélite',
    table: 'workshops',
    icon: Factory,
    listFields: ['especialidad', 'responsable', 'telefono', 'capacidad_diaria'],
    fields: [
      { name: 'nombre_taller', label: 'Nombre Taller', type: 'text', required: true },
      { name: 'nit_documento', label: 'NIT / Documento', type: 'text' },
      { name: 'responsable', label: 'Responsable', type: 'text' },
      { name: 'telefono', label: 'Teléfono', type: 'text' },
      { name: 'capacidad_diaria', label: 'Capacidad Diaria', type: 'number' },
      { name: 'especialidad', label: 'Especialidad', type: 'text' }
    ]
  },
  suppliers: {
    title: 'Maestro de Proveedores',
    table: 'suppliers',
    icon: Truck,
    listFields: ['nit', 'tipo_proveedor', 'ciudad', 'telefono'],
    fields: [
      { name: 'razon_social', label: 'Razón Social', type: 'text', required: true },
      { name: 'nit', label: 'NIT', type: 'text' },
      { name: 'contacto', label: 'Contacto', type: 'text' },
      { name: 'telefono', label: 'Teléfono', type: 'text' },
      { name: 'email', label: 'Email', type: 'text' },
      { name: 'direccion', label: 'Dirección', type: 'text' },
      { name: 'ciudad', label: 'Ciudad', type: 'text' },
      { name: 'departamento', label: 'Departamento', type: 'text' },
      { name: 'tipo_proveedor', label: 'Tipo Proveedor', type: 'text' }
    ]
  },
  warehouses: {
    title: 'Bodegas / Ubicaciones',
    table: 'warehouses',
    icon: Warehouse,
    listFields: ['tipo', 'responsable'],
    fields: [
      { name: 'nombre_bodega', label: 'Nombre Bodega', type: 'text', required: true },
      { name: 'tipo', label: 'Tipo', type: 'text' },
      { name: 'responsable', label: 'Responsable', type: 'text' }
    ]
  },
  machines: {
    title: 'Máquinas / Meses',
    table: 'machines',
    icon: Monitor,
    listFields: ['tipo', 'serial', 'capacidad'],
    fields: [
      { name: 'nombre', label: 'Nombre / Identificador', type: 'text', required: true },
      { name: 'tipo', label: 'Tipo', type: 'text' },
      { name: 'serial', label: 'Serial', type: 'text' },
      { name: 'capacidad', label: 'Capacidad', type: 'number' }
    ]
  },
  waste: {
    title: 'Motivos de Merma',
    table: 'waste_reasons',
    icon: AlertTriangle,
    listFields: ['categoria'],
    fields: [
      { name: 'codigo', label: 'Código', type: 'text', required: true },
      { name: 'descripcion', label: 'Descripción', type: 'text', required: true },
      { name: 'categoria', label: 'Categoría', type: 'text' }
    ]
  },
  quality: {
    title: 'Tipos de Calidad',
    table: 'quality_types',
    icon: CheckCircle,
    listFields: ['criticidad'],
    fields: [
      { name: 'nombre', label: 'Nombre', type: 'text', required: true },
      { name: 'descripcion', label: 'Descripción', type: 'text' },
      { name: 'criticidad', label: 'Criticidad (Alta/Media/Baja)', type: 'text' }
    ]
  },
  states: {
    title: 'Estados del Proceso',
    table: 'process_states',
    icon: Activity,
    listFields: ['modulo', 'orden_flujo'],
    fields: [
      { name: 'modulo', label: 'Módulo', type: 'text' },
      { name: 'nombre_estado', label: 'Nombre Estado', type: 'text', required: true },
      { name: 'color_visual', label: 'Color (HEX)', type: 'color' },
      { name: 'orden_flujo', label: 'Orden Flujo', type: 'number' }
    ]
  },
  costs: {
    title: 'Costos Base',
    table: 'base_costs',
    icon: DollarSign,
    listFields: ['valor', 'unidad'],
    fields: [
      { name: 'concepto', label: 'Concepto', type: 'text', required: true },
      { name: 'valor', label: 'Valor ($)', type: 'number', required: true },
      { name: 'unidad', label: 'Unidad', type: 'text' }
    ]
  },
  novelties: {
    title: 'Maestro de Novedades',
    table: 'novelties',
    icon: AlertTriangle,
    listFields: ['modulo_relac', 'criticidad'],
    fields: [
      { name: 'cod_novedad', label: 'Código Novedad', type: 'text', required: true },
      { name: 'nombre', label: 'Nombre Novedad', type: 'text', required: true },
      { name: 'modulo_relac', label: 'Módulo Relacionado', type: 'text' },
      { name: 'criticidad', label: 'Criticidad (Alta/Media/Baja)', type: 'text' }
    ]
  },
  config: {
    title: 'Configuración General',
    table: 'system_config',
    icon: Settings,
    listFields: ['nit', 'moneda'],
    fields: [
      { name: 'empresa_nombre', label: 'Nombre Empresa', type: 'text' },
      { name: 'nit', label: 'NIT', type: 'text' },
      { name: 'moneda', label: 'Moneda (COP/USD)', type: 'text' },
      { name: 'whatsapp_empresa', label: 'WhatsApp', type: 'text' }
    ]
  }
};

const fetchAll = async (queryFn: () => any) => {
  let allData: any[] = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await queryFn().range(from, from + step - 1);
    if (error) throw error;
    if (data && data.length > 0) {
      allData = [...allData, ...data];
      from += step;
      if (data.length < step) break;
    } else {
      break;
    }
  }
  return allData;
};

export default function MastersPage({ isEmbed = false }: { isEmbed?: boolean }) {
  const [activeTab, setActiveTab] = useState<string>('categories');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [iva, setIva] = useState(19);
  const [search, setSearch] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [masterCounts, setMasterCounts] = useState<Record<string, number>>({});
 
  useEffect(() => {
    const fetchIva = async () => {
      const { data } = await supabase.from('company_params').select('value').eq('name', 'iva_percent').single();
      if (data) setIva(Number(data.value));
    };
    fetchIva();
    fetchAllCounts();
  }, []);

  const fetchAllCounts = async () => {
    try {
      const counts: Record<string, number> = {};
      await Promise.all(
        Object.entries(MASTER_CONFIG).map(async ([key, conf]: [string, any]) => {
          const { count } = await supabase.from(conf.table).select('*', { count: 'exact', head: true });
          counts[key] = count || 0;
        })
      );
      setMasterCounts(counts);
    } catch (e) {
      console.error('Error fetching master counts:', e);
    }
  };

  const config = MASTER_CONFIG[activeTab];

  const [categories, setCategories] = useState<any[]>([]);
  const [accessories, setAccessories] = useState<any[]>([]);
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>([]);
  const [categoryAccessoriesList, setCategoryAccessoriesList] = useState<any[]>([]);
  const [productAccessoriesList, setProductAccessoriesList] = useState<any[]>([]);
  const [selectedProductAccessories, setSelectedProductAccessories] = useState<{ accessory_id: string; cantidad: number }[]>([]);

  useEffect(() => {
    setSearch('');
    setCurrentPage(1);
    fetchData();
    const fetchMasters = async () => {
      try {
        const catData = await fetchAll(() => supabase.from('categories').select('*').order('categoria'));
        if (catData) setCategories(catData);
        
        const accData = await fetchAll(() => supabase.from('accessories').select('*').order('nombre'));
        if (accData) setAccessories(accData || []);

        try {
          const allCategoryAccs = await fetchAll(() => supabase.from('category_accessories').select('*, accessories(nombre)'));
          if (allCategoryAccs) setCategoryAccessoriesList(allCategoryAccs || []);
        } catch (e) {
          console.warn('category_accessories table not found:', e);
        }

        const allProductAccs = await fetchAll(() => supabase.from('product_accessories').select('*, accessories(nombre, unidad_medida)'));
        if (allProductAccs) setProductAccessoriesList(allProductAccs || []);
      } catch (err) {
        console.error('Error fetching categories/accessories/products:', err);
      }
    };
    fetchMasters();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await fetchAll(() =>
        supabase
          .from(config.table)
          .select('*')
          .order('created_at', { ascending: false })
      );
      setData(result || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingId(null);
    setSelectedAccessories([]);
    setSelectedProductAccessories([]);
    const initialData: any = {};
    
    // Pre-cargar IVA global para productos y telas
    if (activeTab === 'products' || activeTab === 'fabrics') {
      initialData.iva = iva;
    }
    
    setFormData(initialData);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...formData };
      
      // Auto-generar referencia para productos si es nuevo y no se especificó una
      if (activeTab === 'products' && !editingId && !payload.codigo_referencia) {
        let isUnique = false;
        let attempts = 0;
        let refCode = '';
        while (!isUnique && attempts < 10) {
          const suffix = Math.floor(1000 + Math.random() * 9000);
          refCode = `REF-${suffix}`;
          const { data: existing } = await supabase
            .from('products')
            .select('id')
            .eq('codigo_referencia', refCode)
            .maybeSingle();
          if (!existing) {
            isUnique = true;
          }
          attempts++;
        }
        payload.codigo_referencia = refCode;
      }

      // Lógica específica para colores
      if (activeTab === 'colors') {
        if (!payload.hex_color) payload.hex_color = '#000000';
        if (!payload.codigo_color) {
          payload.codigo_color = payload.hex_color.replace('#', '').toUpperCase();
        }
      }

      // Auto-generar código jerárquico para accesorios
      if (activeTab === 'accessories' && !editingId) {
        const prefixMap: Record<string, string> = {
          'Hilo': 'HIL', 'Aguja': 'AGU', 'Botón': 'BOT', 'Cremallera': 'CRE',
          'Elástico': 'ELA', 'Cinta': 'CIN', 'Marquilla': 'MRQ', 'Otro': 'ACC'
        };
        const prefix = prefixMap[payload.tipo] || 'ACC';
        const { count } = await supabase
          .from('accessories')
          .select('*', { count: 'exact', head: true })
          .eq('tipo', payload.tipo || '');
        
        let nextNum = (count || 0) + 1;
        let code = `${prefix}-${nextNum.toString().padStart(3, '0')}`;
        let exists = true;
        while (exists) {
          const { data: existing } = await supabase
            .from('accessories')
            .select('id')
            .eq('codigo', code);
          if (existing && existing.length > 0) {
            nextNum++;
            code = `${prefix}-${nextNum.toString().padStart(3, '0')}`;
          } else {
            exists = false;
          }
        }
        payload.codigo = code;
      }

      // Auto-generar código de categoría si es nuevo
      if (activeTab === 'categories' && !editingId) {
        const { count } = await supabase
          .from('categories')
          .select('*', { count: 'exact', head: true });
        
        let nextNum = (count || 0) + 1;
        let code = `CAT-${nextNum.toString().padStart(3, '0')}`;
        let exists = true;
        while (exists) {
          const { data: existing } = await supabase
            .from('categories')
            .select('id')
            .eq('cod_categoria', code);
          if (existing && existing.length > 0) {
            nextNum++;
            code = `CAT-${nextNum.toString().padStart(3, '0')}`;
          } else {
            exists = false;
          }
        }
        payload.cod_categoria = code;
        formData.cod_categoria = code;
      }

      // Lógica específica para talleres (workshops): la columna 'name' tiene NOT NULL
      if (activeTab === 'workshops') {
        payload.name = payload.nombre_taller;
      }

      let categoryId = editingId;
      let productId = editingId;
      if (editingId) {
        const { error } = await supabase.from(config.table).update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        if (activeTab === 'categories') {
          const { data: newCat, error: catErr } = await supabase.from(config.table).insert([payload]).select().single();
          if (catErr) throw catErr;
          categoryId = newCat.id;
          
          if (newCat) {
            const { data: allProds } = await supabase.from('products').select('id');
            const count = (allProds?.length || 0) + 1;
            const refCode = `REF-${count.toString().padStart(4, '0')}`;
            
            await supabase.from('products').insert([{
              nombre_producto: newCat.categoria,
              codigo_referencia: refCode,
              category_id: newCat.id,
              genero: 'F',
              iva: iva,
              precio: 0,
              precio_con_iva: 0,
              estado: 'activo'
            }]);
          }
        } else if (activeTab === 'products') {
          const { data: newProd, error: prodErr } = await supabase.from(config.table).insert([payload]).select().single();
          if (prodErr) throw prodErr;
          productId = newProd.id;
        } else {
          const { error } = await supabase.from(config.table).insert([payload]);
          if (error) throw error;
        }
      }

      // Save category accessories
      if (activeTab === 'categories' && categoryId) {
        try {
          const { error: delErr } = await supabase.from('category_accessories').delete().eq('category_id', categoryId);
          if (!delErr && selectedAccessories.length > 0) {
            const toInsert = selectedAccessories.map(accId => ({
              category_id: categoryId,
              accessory_id: accId
            }));
            const { error: insErr } = await supabase.from('category_accessories').insert(toInsert);
            if (insErr && insErr.code !== 'PGRST205') console.warn('Error saving category_accessories:', insErr.message);
          }
        } catch (catAccErr) {
          console.warn('category_accessories table not available:', catAccErr);
        }
      }

      // Save product accessories
      if (activeTab === 'products' && productId) {
        await supabase.from('product_accessories').delete().eq('product_id', productId);
        if (selectedProductAccessories.length > 0) {
          const toInsert = selectedProductAccessories.map(item => ({
            product_id: productId,
            accessory_id: item.accessory_id,
            cantidad: Number(item.cantidad) || 0
          }));
          const { error: insErr } = await supabase.from('product_accessories').insert(toInsert);
          if (insErr) throw insErr;
        }
      }

      setShowModal(false);
      setFormData({});
      setEditingId(null);
      fetchData();
    } catch (err: any) {
      alert('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este registro?')) return;
    try {
      const { error } = await supabase.from(config.table).delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      let friendlyMessage = err.message;
      if (err.message?.includes('violates foreign key constraint') || err.code === '23503') {
        friendlyMessage = 'No se puede eliminar este registro porque está asociado a otros datos en el sistema (por ejemplo, cortes, productos u órdenes). Primero debes eliminar o modificar esas asociaciones en los módulos correspondientes.';
      }
      alert('Error al eliminar: ' + friendlyMessage);
    }
  };

  const handleEdit = async (item: any) => {
    setFormData(item);
    setEditingId(item.id);
    if (activeTab === 'categories') {
      try {
        const { data: rels } = await supabase.from('category_accessories').select('accessory_id').eq('category_id', item.id);
        setSelectedAccessories(rels?.map(r => r.accessory_id) || []);
      } catch (e) {
        setSelectedAccessories([]);
      }
      setSelectedProductAccessories([]);
    } else if (activeTab === 'products') {
      const { data: rels } = await supabase.from('product_accessories').select('accessory_id, cantidad').eq('product_id', item.id);
      setSelectedProductAccessories(rels?.map(r => ({ accessory_id: r.accessory_id, cantidad: Number(r.cantidad) })) || []);
      setSelectedAccessories([]);
    } else {
      setSelectedAccessories([]);
      setSelectedProductAccessories([]);
    }
    setShowModal(true);
    setActiveMenu(null);
  };

  return (
    <div style={{ display: 'flex', gap: '2rem', height: isEmbed ? 'auto' : 'calc(100vh - 120px)', minHeight: isEmbed ? '500px' : 'none' }}>
      {/* Sidebar de Maestros */}
      <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderRight: '1px solid var(--border)', paddingRight: '1.5rem', overflowY: 'auto' }}>
        <h2 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>Módulos Maestros</h2>
        {Object.entries(MASTER_CONFIG).map(([key, item]: [string, any]) => {
          const itemCount = masterCounts[key] !== undefined ? masterCounts[key] : (activeTab === key ? data.length : null);
          return (
            <button 
              key={key}
              onClick={() => setActiveTab(key)}
              className={`btn ${activeTab === key ? 'btn-primary' : ''}`}
              style={{ 
                justifyContent: 'space-between', 
                padding: '0.75rem 1rem', 
                backgroundColor: activeTab === key ? 'var(--primary)' : 'transparent',
                color: activeTab === key ? 'white' : 'var(--text)',
                fontSize: '0.875rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <item.icon size={18} />
                <span>{item.title}</span>
              </div>
              {itemCount !== null && (
                <span style={{ 
                  fontSize: '0.75rem', 
                  fontWeight: '800', 
                  padding: '0.15rem 0.5rem', 
                  borderRadius: '10px', 
                  backgroundColor: activeTab === key ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                  color: activeTab === key ? 'white' : '#475569'
                }}>
                  {itemCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Contenido Principal */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
        {/* Totalization Summary Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.85rem' }}>
          {Object.entries(MASTER_CONFIG).map(([key, conf]: [string, any]) => {
            const countVal = masterCounts[key] !== undefined ? masterCounts[key] : (activeTab === key ? data.length : 0);
            const isSelected = activeTab === key;
            const Icon = conf.icon;
            return (
              <div
                key={key}
                onClick={() => setActiveTab(key)}
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '14px',
                  backgroundColor: isSelected ? '#80082E' : 'white',
                  color: isSelected ? 'white' : '#0f172a',
                  border: isSelected ? '1.5px solid #80082E' : '1px solid #e2e8f0',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? '0 4px 12px rgba(128, 8, 46, 0.2)' : '0 2px 4px rgba(0,0,0,0.02)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
              >
                <div style={{
                  padding: '0.5rem',
                  borderRadius: '10px',
                  backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : '#f8fafc',
                  color: isSelected ? 'white' : '#80082E',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Icon size={20} />
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <p style={{
                    margin: 0,
                    fontSize: '0.68rem',
                    fontWeight: '800',
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                    color: isSelected ? 'rgba(255,255,255,0.85)' : '#64748b',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {conf.title.replace('Maestro de ', '').replace('Maestro ', '')}
                  </p>
                  <h3 style={{
                    margin: '0.1rem 0 0',
                    fontSize: '1.2rem',
                    fontWeight: '950',
                    color: isSelected ? 'white' : '#0f172a'
                  }}>
                    {countVal.toLocaleString()} <span style={{ fontSize: '0.75rem', fontWeight: '700', opacity: 0.85 }}>ítems</span>
                  </h3>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#80082E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Base de Datos
            </span>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '950', margin: '0.25rem 0 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ padding: '0.5rem', backgroundColor: '#80082E', borderRadius: '12px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Settings size={24} />
              </div>
              {config.title}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Gestión de datos técnicos del sistema.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {activeTab === 'products' && (
              <>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => {
                    // Export products as Excel-compatible CSV
                    const BOM = '\uFEFF';
                    const headers = ['Referencia', 'Nombre Producto', 'Categoría', 'Género', 'IVA (%)', 'Precio', 'Precio con IVA'];
                    const rows = data.map((p: any) => {
                      const cat = categories.find((c: any) => c.id === p.category_id);
                      return [
                        p.codigo_referencia || '',
                        p.nombre_producto || '',
                        cat ? cat.categoria : '',
                        p.genero || '',
                        p.iva || '',
                        p.precio || '',
                        p.precio_con_iva || ''
                      ].map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(';');
                    });
                    const csv = BOM + [headers.join(';'), ...rows].join('\n');
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `maestro_productos_${new Date().toISOString().slice(0,10)}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid var(--border)', backgroundColor: 'white', color: 'var(--text)', cursor: 'pointer' }}
                >
                  <Download size={16} /> Exportar Excel
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setShowPrintModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid var(--border)', backgroundColor: 'white', color: 'var(--text)', cursor: 'pointer' }}
                >
                  <Printer size={16} /> Exportar Catálogo PDF
                </button>
              </>
            )}
            <button className="btn btn-primary" onClick={handleAdd}>
              <Plus size={18} /> Nuevo Registro
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: '0' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
             <div style={{ position: 'relative', width: '300px' }}>
                <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{ padding: '0.75rem 1rem 0.75rem 2.5rem', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '0.9rem', width: '250px', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                  onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)'; }}
                />
             </div>
          </div>

          <div style={{ minHeight: '400px' }}>
            {(() => {
              const filteredData = data.filter(item => {
                if (!search) return true;
                const s = search.toLowerCase();
                const fieldsToSearch = [
                  item.categoria, item.nombre_tela, item.nombre_color, item.nombre_talla, item.nombre_producto,
                  item.nombre_taller, item.razon_social, item.nombre_bodega, item.nombre,
                  item.descripcion, item.concepto, item.empresa_nombre, item.nombre_estado,
                  item.cod_novedad, item.codigo_tela, item.codigo_color, item.codigo_talla,
                  item.codigo_referencia, item.codigo, item.nit, item.factura_relacionada,
                  item.responsable
                ];
                return fieldsToSearch.some(field => 
                  field && String(field).toLowerCase().includes(s)
                );
              });

              if (loading) {
                return <div style={{ display: 'flex', padding: '5rem', justifyContent: 'center' }}><Loader2 className="animate-spin" /></div>;
              }
              if (filteredData.length === 0) {
                return <div style={{ padding: '5rem', textAlign: 'center', color: 'var(--text-muted)' }}>No se encontraron registros.</div>;
              }

              return (
                <>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {filteredData.slice((currentPage - 1) * 50, currentPage * 50).map((item) => (
                    <div key={item.id} style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'background 0.2s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flex: 1 }}>
                      {/* Visual Indicator (Color or Icon) */}
                      {(activeTab === 'colors' || activeTab === 'states') ? (
                        <div style={{ 
                          width: '40px', 
                          height: '40px', 
                          borderRadius: '10px', 
                          backgroundColor: item.hex_color || item.color_visual || '#eee', 
                          border: '2px solid white',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                          flexShrink: 0
                        }}></div>
                      ) : (
                        item.imagen_url ? (
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            border: '1px solid var(--border)',
                            flexShrink: 0
                          }}>
                            <img src={item.imagen_url} alt="Thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ) : (
                          <div style={{ 
                            width: '40px', 
                            height: '40px', 
                            borderRadius: '10px', 
                            backgroundColor: 'var(--primary-light)', 
                            color: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <config.icon size={20} />
                          </div>
                        )
                      )}

                      {/* Info Content */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                          <p style={{ fontWeight: '700', fontSize: '0.9375rem', color: 'var(--text)' }}>
                            {item.nombre_tela || item.nombre_color || item.nombre_talla || item.nombre_producto || item.nombre_taller || item.razon_social || item.nombre_bodega || item.nombre || item.categoria || item.descripcion || item.concepto || item.empresa_nombre || item.nombre_estado || 'Registro'}
                          </p>
                          <span style={{ fontSize: '0.6875rem', padding: '0.2rem 0.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
                            {item.cod_novedad || item.codigo_tela || item.codigo_color || item.codigo_talla || item.codigo_referencia || item.codigo || item.nit || item.cod_categoria || item.id.slice(0,6)}
                          </span>
                        </div>
                        
                        {/* Dynamic Tags / Extra Info */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {activeTab === 'categories' && (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap', width: '100%', marginBottom: '0.25rem' }}>
                                <span style={{ fontWeight: '600' }}>Insumos por defecto:</span>
                                {(() => {
                                  const accs = categoryAccessoriesList.filter(ca => ca.category_id === item.id);
                                  if (accs.length === 0) return <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Ninguno</span>;
                                  return accs.map(ca => (
                                    <span key={ca.id} style={{ backgroundColor: '#f5f3ff', color: '#6d28d9', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: '600', border: '1px solid #ddd6fe', fontSize: '0.7rem' }}>
                                      {ca.accessories?.nombre || 'Accesorio'}
                                    </span>
                                  ));
                                })()}
                              </div>
                              {item.ficha_tecnica_url && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                                  <a
                                    href={item.ficha_tecnica_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', fontWeight: '700', color: '#0369a1', backgroundColor: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: '6px', padding: '0.2rem 0.6rem', textDecoration: 'none', transition: 'background 0.15s' }}
                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#bae6fd')}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#e0f2fe')}
                                  >
                                    <ExternalLink size={11} /> Ver Ficha Técnica
                                  </a>
                                </div>
                              )}
                            </>
                          )}
                          {activeTab === 'products' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap', width: '100%', marginBottom: '0.25rem' }}>
                              <span style={{ fontWeight: '600' }}>Accesorios requeridos:</span>
                              {(() => {
                                const accs = productAccessoriesList.filter(pa => String(pa.product_id) === String(item.id));
                                if (accs.length === 0) return <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Ninguno</span>;
                                return accs.map(pa => (
                                  <span key={pa.id} style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: '600', border: '1px solid #bae6fd', fontSize: '0.7rem' }}>
                                    {pa.accessories?.nombre || 'Accesorio'} ({Number(pa.cantidad).toFixed(2)} {pa.accessories?.unidad_medida || 'Unidad'})
                                  </span>
                                ));
                              })()}
                            </div>
                          )}
                          {config.listFields.map((fieldKey: string) => {
                            let val = item[fieldKey];
                            
                            if (fieldKey === 'metros' && val === undefined) {
                              val = ((item.kilos || 0) * (item.rendimiento_estimado || 3.5)).toFixed(2);
                            }

                            if (val === undefined || val === null || val === '') return null;
                            
                            let label = fieldKey.replace('_', ' ');
                            let displayVal = val;

                            if (fieldKey === 'category_id') {
                              const cat = categories.find(c => c.id === val);
                              displayVal = cat ? cat.categoria : 'Sin Categoría';
                              label = 'Categoría';
                            }
                            if (fieldKey === 'valor' || fieldKey === 'precio' || fieldKey === 'precio_con_iva' || fieldKey === 'costo_con_iva') {
                              displayVal = `$${Number(val).toLocaleString()}`;
                            }
                            if (fieldKey === 'ancho') displayVal = `${val}m`;
                            if (fieldKey === 'gramaje') displayVal = `${val}g/m²`;
                            
                            return (
                              <div key={fieldKey} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                <span style={{ fontWeight: '500', textTransform: 'capitalize' }}>{label}:</span>
                                <span style={{ color: 'var(--text)', fontWeight: '600' }}>{displayVal}</span>
                              </div>
                            );
                          })}
                          {activeTab === 'states' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              <span style={{ fontWeight: '500' }}>Orden:</span>
                              <span style={{ color: 'var(--text)', fontWeight: '600' }}>#{item.orden_flujo}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ position: 'relative' }}>
                      <button 
                        className="btn-icon" 
                        onClick={() => setActiveMenu(activeMenu === item.id ? null : item.id)}
                        style={{ width: '32px', height: '32px' }}
                      >
                        <MoreVertical size={16} />
                      </button>
                      
                      {activeMenu === item.id && (
                        <div style={{ 
                          position: 'absolute', 
                          right: 0, 
                          top: '100%', 
                          backgroundColor: 'white', 
                          border: '1px solid var(--border)', 
                          borderRadius: '10px', 
                          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)', 
                          zIndex: 10,
                          minWidth: '140px',
                          overflow: 'hidden',
                          marginTop: '0.5rem'
                        }}>
                          <button 
                            onClick={() => handleEdit(item)}
                            style={{ width: '100%', padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.6rem', borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                          >
                            <Settings size={14} /> Editar Datos
                          </button>
                          <button 
                            onClick={() => handleDelete(item.id)}
                            style={{ width: '100%', padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#ef4444', transition: 'background 0.2s' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fff5f5'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                          >
                            <AlertTriangle size={14} /> Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  ))}
                </div>
                
                {filteredData.length > 50 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem', padding: '1rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid var(--border)', background: currentPage === 1 ? '#f8fafc' : 'white', color: currentPage === 1 ? '#94a3b8' : '#334155', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontWeight: '600', transition: 'all 0.2s', boxShadow: currentPage === 1 ? 'none' : '0 1px 2px rgba(0,0,0,0.05)' }}
                    >
                      Anterior
                    </button>
                    
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      {Array.from({ length: Math.ceil(filteredData.length / 50) }, (_, i) => i + 1)
                        .filter(pageNum => pageNum === 1 || pageNum === Math.ceil(filteredData.length / 50) || (pageNum >= currentPage - 2 && pageNum <= currentPage + 2))
                        .map((pageNum, idx, arr) => (
                          <React.Fragment key={pageNum}>
                            {idx > 0 && arr[idx - 1] !== pageNum - 1 && (
                              <span style={{ padding: '0.4rem 0.6rem', color: '#64748b' }}>...</span>
                            )}
                            <button
                              onClick={() => setCurrentPage(pageNum)}
                              style={{ width: '36px', height: '36px', borderRadius: '8px', border: pageNum === currentPage ? 'none' : '1px solid var(--border)', background: pageNum === currentPage ? '#3b82f6' : 'white', color: pageNum === currentPage ? 'white' : '#475569', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s', boxShadow: pageNum === currentPage ? '0 4px 6px -1px rgba(59, 130, 246, 0.4)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              {pageNum}
                            </button>
                          </React.Fragment>
                        ))}
                    </div>

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredData.length / 50)))}
                      disabled={currentPage === Math.ceil(filteredData.length / 50)}
                      style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid var(--border)', background: currentPage === Math.ceil(filteredData.length / 50) ? '#f8fafc' : 'white', color: currentPage === Math.ceil(filteredData.length / 50) ? '#94a3b8' : '#334155', cursor: currentPage === Math.ceil(filteredData.length / 50) ? 'not-allowed' : 'pointer', fontWeight: '600', transition: 'all 0.2s', boxShadow: currentPage === Math.ceil(filteredData.length / 50) ? 'none' : '0 1px 2px rgba(0,0,0,0.05)' }}
                    >
                      Siguiente
                    </button>
                  </div>
                )}
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Modal Dinámico */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: '90%', maxWidth: '600px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3>{editingId ? 'Editar' : 'Nuevo'} en {config.title}</h3>
              <button onClick={() => { setShowModal(false); setEditingId(null); }} className="btn-icon"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              {config.fields.map((field: any) => (
                <div key={field.name} style={{ gridColumn: field.type === 'textarea' ? 'span 2' : 'span 1' }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', marginBottom: '0.4rem' }}>{field.label}</label>
                  {field.type === 'select' ? (
                    <select
                      required={field.required}
                      style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                      value={formData[field.name] || ''}
                      onChange={(e) => setFormData({...formData, [field.name]: e.target.value})}
                    >
                      <option value=''>Seleccionar...</option>
                      {field.name === 'category_id' ? (
                        categories.map((cat: any) => (
                          <option key={cat.id} value={cat.id}>{cat.categoria}</option>
                        ))
                      ) : (
                        field.options?.map((opt: string) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))
                      )}
                    </select>
                  ) : field.type === 'image' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      {formData[field.name] && (
                        <div style={{ width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                          <img src={formData[field.name]} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        style={{ fontSize: '0.8rem' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          
                          const reader = new FileReader();
                          reader.onload = async () => {
                            try {
                              const base64String = (reader.result as string).split(',')[1];
                              const fileExt = file.name.split('.').pop();
                              const fileName = `${Math.random()}.${fileExt}`;
                              
                              const res = await fetch('/api/products/upload-image', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ fileBase64: base64String, fileName })
                              });
                              const json = await res.json();
                              if (json.error) throw new Error(json.error);
                              setFormData({ ...formData, [field.name]: json.publicUrl });
                            } catch (err: any) {
                              alert('Error al subir imagen: ' + err.message);
                            }
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </div>
                  ) : (
                    <input 
                      type={field.type}
                      required={field.required}
                      disabled={field.disabled}
                      style={{ 
                        width: '100%', 
                        padding: '0.625rem', 
                        borderRadius: '8px', 
                        border: '1px solid var(--border)', 
                        fontSize: '0.875rem', 
                        height: field.type === 'color' ? '45px' : 'auto',
                        backgroundColor: field.disabled ? '#f1f5f9' : 'white'
                      }}
                      value={formData[field.name] || (field.type === 'color' ? '#000000' : '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        const newFormData = { ...formData, [field.name]: val };
                        
                        // Cálculo automático de IVA para telas
                        if (activeTab === 'fabrics' && field.name === 'costo_unitario') {
                          const cost = Number(val) || 0;
                          newFormData.costo_con_iva = (cost * (1 + iva / 100)).toFixed(2);
                        }

                        // Cálculo automático de IVA para productos
                        if (activeTab === 'products') {
                          if (field.name === 'precio') {
                            const price = Number(val) || 0;
                            const productIva = Number(newFormData.iva) || iva;
                            newFormData.precio_con_iva = (price * (1 + productIva / 100)).toFixed(2);
                          }
                        }
                        
                        setFormData(newFormData);
                      }}
                    />
                  )}
                </div>
              ))}
              {activeTab === 'categories' && (
                <div style={{ gridColumn: 'span 2', marginTop: '0.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', marginBottom: '0.75rem' }}>
                    Accesorios / Insumos por Defecto
                  </label>
                  {accessories.length === 0 ? (
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No hay accesorios registrados en el maestro de accesorios.
                    </p>
                  ) : (
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
                      gap: '0.75rem', 
                      maxHeight: '200px', 
                      overflowY: 'auto', 
                      padding: '0.75rem', 
                      border: '1px solid var(--border)', 
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-secondary)'
                    }}>
                      {accessories.map((acc: any) => {
                        const isChecked = selectedAccessories.includes(acc.id);
                        return (
                          <label key={acc.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer', userSelect: 'none' }}>
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAccessories([...selectedAccessories, acc.id]);
                                } else {
                                  setSelectedAccessories(selectedAccessories.filter(id => id !== acc.id));
                                }
                              }}
                              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                            <span>{acc.nombre}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'products' && (
                <div style={{ gridColumn: 'span 2', marginTop: '0.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', marginBottom: '0.75rem' }}>
                    Accesorios / Insumos Requeridos (con Cantidad)
                  </label>
                  {accessories.length === 0 ? (
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No hay accesorios registrados en el maestro de accesorios.
                    </p>
                  ) : (
                    <div style={{ 
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem', 
                      maxHeight: '220px', 
                      overflowY: 'auto', 
                      padding: '0.75rem', 
                      border: '1px solid var(--border)', 
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-secondary)'
                    }}>
                      {accessories.map((acc: any) => {
                        const existing = selectedProductAccessories.find(pa => pa.accessory_id === acc.id);
                        const isChecked = !!existing;
                        const qty = existing ? existing.cantidad : 1.0;
                        return (
                          <div key={acc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'white' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer', userSelect: 'none', flex: 1 }}>
                              <input 
                                type="checkbox" 
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedProductAccessories([...selectedProductAccessories, { accessory_id: acc.id, cantidad: 1.0 }]);
                                  } else {
                                    setSelectedProductAccessories(selectedProductAccessories.filter(item => item.accessory_id !== acc.id));
                                  }
                                }}
                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                              />
                              <span style={{ fontWeight: '500' }}>{acc.nombre}</span>
                            </label>
                            {isChecked && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cantidad:</span>
                                <input 
                                  type="number" 
                                  step="0.01"
                                  min="0.01"
                                  value={qty}
                                  onChange={(e) => {
                                    const val = Number(e.target.value) || 0.01;
                                    setSelectedProductAccessories(
                                      selectedProductAccessories.map(pa => pa.accessory_id === acc.id ? { ...pa, cantidad: val } : pa)
                                    );
                                  }}
                                  style={{ width: '80px', padding: '0.25rem 0.5rem', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8125rem', textAlign: 'right' }}
                                />
                                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', width: '60px' }}>
                                  {acc.unidad_medida || 'Unidad'}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              <div style={{ gridColumn: 'span 2', display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" size={18} /> : 'Guardar Datos'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal para Impresión de Catálogo de Productos */}
      {showPrintModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(8px)', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '900px', padding: 0, maxHeight: '95vh', display: 'flex', flexDirection: 'column', borderRadius: '20px', overflow: 'hidden', backgroundColor: 'white' }}>
            {/* Modal header (no-print) */}
            <div className="no-print" style={{ padding: '1rem 2rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '900', fontSize: '0.85rem', color: '#0f172a' }}>Vista Previa de Catálogo de Productos</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn"
                  onClick={() => window.print()}
                  style={{ backgroundColor: '#7c3aed', color: 'white', border: 'none', padding: '0.45rem 1rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}
                >
                  <Printer size={13} /> Imprimir / PDF
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowPrintModal(false)}
                  style={{ padding: '0.45rem 1rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700' }}
                >
                  Cerrar
                </button>
              </div>
            </div>

            {/* Printable container */}
            <div className="printable-products-list" style={{ flex: 1, overflowY: 'auto', padding: '2.5rem', backgroundColor: 'white', color: 'black' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Header catalog */}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2.5px solid #0f172a', paddingBottom: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '950', margin: 0, letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
                      Catálogo General de Productos
                    </h2>
                    <p style={{ fontSize: '0.75rem', color: '#475569', margin: '0.25rem 0 0' }}>
                      Cortesbreiner Producción — Reporte Técnico
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.7rem', color: '#475569' }}>
                    <p style={{ margin: 0 }}><strong>Fecha Reporte:</strong> {new Date().toLocaleDateString('es-ES')}</p>
                    <p style={{ margin: 0 }}><strong>Total Items:</strong> {data.length}</p>
                  </div>
                </div>

                {/* Table catalog */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1' }}>
                      <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '900', color: '#0f172a' }}>Cód. Ref</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '900', color: '#0f172a' }}>Producto</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center', fontWeight: '900', color: '#0f172a' }}>Género</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '900', color: '#0f172a' }}>Categoría</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '900', color: '#0f172a' }}>Accesorios Requeridos</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center', fontWeight: '900', color: '#0f172a' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((item, idx) => {
                      const categoryObj = categories.find(c => c.id === item.category_id);
                      const categoryName = categoryObj ? categoryObj.categoria : 'Sin Categoría';
                      
                      const accs = productAccessoriesList.filter(pa => String(pa.product_id) === String(item.id));

                      return (
                        <tr key={item.id || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '0.5rem', fontWeight: '800', color: '#0f172a' }}>{item.codigo_referencia || '—'}</td>
                          <td style={{ padding: '0.5rem', fontWeight: '700' }}>{item.nombre_producto}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'center', textTransform: 'uppercase' }}>{item.genero || '—'}</td>
                          <td style={{ padding: '0.5rem', color: '#475569' }}>{categoryName}</td>
                          <td style={{ padding: '0.5rem', color: '#0f172a' }}>
                            {accs.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                {accs.map(pa => (
                                  <span key={pa.id} style={{ border: '1px solid #cbd5e1', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.65rem', backgroundColor: '#f8fafc', fontWeight: '600' }}>
                                    {pa.accessories?.nombre || 'Accesorio'} ({Number(pa.cantidad).toFixed(2)} {pa.accessories?.unidad_medida || 'uds'})
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>Sin accesorios</span>
                            )}
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'center', textTransform: 'uppercase', fontWeight: '700', color: item.estado === 'activo' ? '#059669' : '#dc2626' }}>
                            {item.estado}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden !important;
          }
          .printable-products-list, .printable-products-list * {
            visibility: visible !important;
          }
          .printable-products-list {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            color: black !important;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />
    </div>
  );
}
