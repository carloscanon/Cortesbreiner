'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Plus, Search, Tag, Briefcase, Palette, Droplets, MoreVertical, X, Loader2, 
  Ruler, LayoutGrid, Factory, Truck, Warehouse, Monitor, AlertTriangle, 
  CheckCircle, Activity, DollarSign, Settings, User
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
    listFields: ['tipo_tela', 'composicion', 'ancho', 'gramaje', 'capas_maximas', 'costo_con_iva'],
    fields: [
      { name: 'codigo_tela', label: 'Código Tela', type: 'text' },
      { name: 'nombre_tela', label: 'Nombre Tela', type: 'text', required: true },
      { name: 'tipo_tela', label: 'Tipo de Tela', type: 'text' },
      { name: 'composicion', label: 'Composición', type: 'text' },
      { name: 'ancho', label: 'Ancho (m)', type: 'number' },
      { name: 'gramaje', label: 'Gramaje (g/m²)', type: 'number' },
      { name: 'rendimiento_estimado', label: 'Rendimiento Estimado', type: 'number' },
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
    listFields: ['categoria', 'linea', 'genero'],
    fields: [
      { name: 'codigo_referencia', label: 'Referencia', type: 'text', required: true },
      { name: 'nombre_producto', label: 'Nombre Producto', type: 'text', required: true },
      { name: 'categoria', label: 'Categoría', type: 'text' },
      { name: 'linea', label: 'Línea', type: 'text' },
      { name: 'genero', label: 'Género', type: 'text' }
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
    listFields: ['nit', 'tipo_proveedor', 'contacto', 'telefono'],
    fields: [
      { name: 'razon_social', label: 'Razón Social', type: 'text', required: true },
      { name: 'nit', label: 'NIT', type: 'text' },
      { name: 'contacto', label: 'Contacto', type: 'text' },
      { name: 'telefono', label: 'Teléfono', type: 'text' },
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

export default function MastersPage() {
  const [activeTab, setActiveTab] = useState('fabrics');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [iva, setIva] = useState(19);
 
  useEffect(() => {
    const fetchIva = async () => {
      const { data } = await supabase.from('company_params').select('value').eq('name', 'iva_percent').single();
      if (data) setIva(Number(data.value));
    };
    fetchIva();
  }, []);

  const config = MASTER_CONFIG[activeTab];

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase
        .from(config.table)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setData(result || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...formData };
      
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
        const seq = ((count || 0) + 1).toString().padStart(3, '0');
        payload.codigo = `${prefix}-${seq}`;
      }

      if (editingId) {
        const { error } = await supabase.from(config.table).update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(config.table).insert([payload]);
        if (error) throw error;
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
      alert('Error al eliminar: ' + err.message);
    }
  };

  const handleEdit = (item: any) => {
    setFormData(item);
    setEditingId(item.id);
    setShowModal(true);
    setActiveMenu(null);
  };

  return (
    <div style={{ display: 'flex', gap: '2rem', height: 'calc(100vh - 120px)' }}>
      {/* Sidebar de Maestros */}
      <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderRight: '1px solid var(--border)', paddingRight: '1.5rem', overflowY: 'auto' }}>
        <h2 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>Módulos Maestros</h2>
        {Object.entries(MASTER_CONFIG).map(([key, item]: [string, any]) => (
          <button 
            key={key}
            onClick={() => setActiveTab(key)}
            className={`btn ${activeTab === key ? 'btn-primary' : ''}`}
            style={{ 
              justifyContent: 'flex-start', 
              padding: '0.75rem 1rem', 
              backgroundColor: activeTab === key ? 'var(--primary)' : 'transparent',
              color: activeTab === key ? 'white' : 'var(--text)',
              fontSize: '0.875rem'
            }}
          >
            <item.icon size={18} />
            {item.title}
          </button>
        ))}
      </div>

      {/* Contenido Principal */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>{config.title}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Gestión de datos técnicos del sistema.</p>
          </div>
          <button className="btn btn-primary" onClick={() => { setFormData({}); setEditingId(null); setShowModal(true); }}>
            <Plus size={18} /> Nuevo Registro
          </button>
        </div>

        <div className="card" style={{ padding: '0' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
             <div style={{ position: 'relative', width: '300px' }}>
                <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type="text" placeholder="Buscar..." style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 2.5rem', borderRadius: '8px', border: '1px solid var(--border)' }} />
             </div>
          </div>

          <div style={{ minHeight: '400px' }}>
            {loading ? (
              <div style={{ display: 'flex', padding: '5rem', justifyContent: 'center' }}><Loader2 className="animate-spin" /></div>
            ) : data.length === 0 ? (
              <div style={{ padding: '5rem', textAlign: 'center', color: 'var(--text-muted)' }}>No hay datos disponibles.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {data.map((item) => (
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
                      )}

                      {/* Info Content */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                          <p style={{ fontWeight: '700', fontSize: '0.9375rem', color: 'var(--text)' }}>
                            {item.nombre_tela || item.nombre_color || item.nombre_talla || item.nombre_producto || item.nombre_taller || item.razon_social || item.nombre_bodega || item.nombre || item.descripcion || item.concepto || item.empresa_nombre || item.nombre_estado || 'Registro'}
                          </p>
                          <span style={{ fontSize: '0.6875rem', padding: '0.2rem 0.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>
                            {item.codigo_tela || item.codigo_color || item.codigo_talla || item.codigo_referencia || item.codigo || item.nit || item.id.slice(0,6)}
                          </span>
                        </div>
                        
                        {/* Dynamic Tags / Extra Info */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {config.listFields.map((fieldKey: string) => {
                            const val = item[fieldKey];
                            if (val === undefined || val === null || val === '') return null;
                            
                            // Formato especial para ciertos campos
                            let label = fieldKey.replace('_', ' ');
                            let displayVal = val;
                            if (fieldKey === 'valor') displayVal = `$${val.toLocaleString()}`;
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
            )}
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
                      {field.options?.map((opt: string) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
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
                        
                        setFormData(newFormData);
                      }}
                    />
                  )}
                </div>
              ))}
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
    </div>
  );
}
