'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Plus, Search, Trash2, X, Loader2, AlertTriangle, 
  Scissors, Layers, Info, ArrowRight, Factory, 
  ChevronRight, Package, Palette
} from 'lucide-react';

export default function OrdersPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form State
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<any>({
    client_name: '',
    brand: '',
    fabric_id: '',
    workshop_id: '',
    largo_trazo: 0,
    marcaciones_config: '',
    status: 'Planeada',
    priority: 'Media'
  });

  // Multireference items: Each item is a combination of Product + Color + Size Curve
  const [orderItems, setOrderItems] = useState<any[]>([
    { id: Date.now(), product_id: '', color_id: '', sizes: {} }
  ]);
  
  // Masters
  const [fabrics, setFabrics] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [workshops, setWorkshops] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
    fetchMasters();
  }, []);

  const fetchMasters = async () => {
    try {
      const { data: f } = await supabase.from('fabrics').select('id, nombre_tela');
      const { data: p } = await supabase.from('products').select('id, nombre_producto, codigo_referencia');
      const { data: c } = await supabase.from('colors').select('id, nombre_color, hex_color');
      const { data: s } = await supabase.from('sizes').select('id, nombre_talla, codigo_talla').order('orden_visual', { ascending: true });
      const { data: w } = await supabase.from('workshops').select('id, nombre_taller');
      
      setFabrics(f || []);
      setProducts(p || []);
      setColors(c || []);
      setSizes(s || []);
      setWorkshops(w || []);
    } catch (err) {
      console.error('Error fetching masters:', err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase
        .from('orders')
        .select(`
          *,
          fabrics (nombre_tela),
          workshops (nombre_taller)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setData(result || []);
    } catch (err: any) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const addProductRow = () => {
    setOrderItems([...orderItems, { id: Date.now(), product_id: '', color_id: '', sizes: {} }]);
  };

  const removeProductRow = (id: number) => {
    setOrderItems(orderItems.filter(item => item.id !== id));
  };

  const updateItem = (id: number, field: string, value: any) => {
    setOrderItems(orderItems.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const updateItemSize = (itemId: number, sizeId: string, layers: number) => {
    setOrderItems(orderItems.map(item => {
      if (item.id === itemId) {
        return { ...item, sizes: { ...item.sizes, [sizeId]: layers } };
      }
      return item;
    }));
  };

  const calculateTotalLayers = () => {
    let total = 0;
    orderItems.forEach(item => {
      Object.values(item.sizes).forEach((val: any) => {
        total += (Number(val) || 0);
      });
    });
    return total;
  };

  const totalLayers = calculateTotalLayers();
  const isOverLimit = totalLayers > 125;

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Insert Main Order
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert([{
          ...formData,
          capas_proyectadas: totalLayers
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Insert Cuts and Size Configs for each item
      for (const item of orderItems) {
        // Create a "Cut" record for this Product/Color
        const { data: newCut, error: cutError } = await supabase
          .from('cuts')
          .insert([{
            order_id: newOrder.id,
            product_id: item.product_id,
            color_id: item.color_id,
            stroke_length: formData.largo_trazo
          }])
          .select()
          .single();

        if (cutError) throw cutError;

        // Insert Sizes for this Cut
        const sizeConfigs = Object.entries(item.sizes).map(([sizeId, layers]) => ({
          cut_id: newCut.id,
          size_id: sizeId,
          quantity: layers
        }));

        if (sizeConfigs.length > 0) {
          const { error: sizeError } = await supabase.from('cut_sizes').insert(sizeConfigs);
          if (sizeError) throw sizeError;
        }
      }
      
      setShowModal(false);
      setStep(1);
      setFormData({ status: 'Planeada', priority: 'Media', client_name: '', brand: '', fabric_id: '', workshop_id: '', largo_trazo: 0 });
      setOrderItems([{ id: Date.now(), product_id: '', color_id: '', sizes: {} }]);
      fetchData();
    } catch (err: any) {
      alert('Error al crear orden multireferencia: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}><Scissors /> Órdenes de Corte Multireferencia</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Gestión avanzada de producción por taller y producto.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setStep(1); setShowModal(true); }}>
          <Plus size={18} /> Nueva Orden
        </button>
      </div>

      {/* Tabla de Órdenes */}
      <div className="card" style={{ padding: '0' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ position: 'relative', width: '350px' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" placeholder="Buscar..." style={{ width: '100%', padding: '0.625rem 1rem 0.625rem 3rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }} />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', backgroundColor: '#f8fafc' }}>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>ID</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cliente / Marca</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Taller Asignado</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tela</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Capas</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center' }}><Loader2 className="animate-spin" /></td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No hay órdenes.</td></tr>
              ) : (
                data.map((order) => (
                  <tr key={order.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', fontWeight: '700' }}>#{order.consecutive?.toString().padStart(4, '0')}</td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ fontWeight: '600' }}>{order.client_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{order.brand}</div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Factory size={14} color="var(--primary)" />
                        <span style={{ fontSize: '0.875rem' }}>{order.workshops?.nombre_taller || 'Sin Asignar'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem' }}>{order.fabrics?.nombre_tela}</td>
                    <td style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>{order.capas_proyectadas}</td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <span className="badge badge-info">{order.status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL MULTIREFERENCIA */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)' }}>
          <div className="card" style={{ width: '95%', maxWidth: '900px', padding: '0', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '1.5rem 2rem', background: 'var(--primary)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', color: 'white' }}>Programación Técnica de Corte</h2>
                <p style={{ fontSize: '0.75rem', opacity: 0.8 }}>Fase {step} de 2: {step === 1 ? 'Información General y Taller' : 'Configuración de Referencias'}</p>
              </div>
              <button onClick={() => setShowModal(false)} style={{ color: 'white', background: 'rgba(255,255,255,0.1)', border: 'none', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div style={{ padding: '2rem' }}>
              {step === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '700', marginBottom: '0.5rem' }}>Cliente / Marca</label>
                      <input type="text" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }} value={formData.client_name} onChange={(e) => setFormData({...formData, client_name: e.target.value, brand: e.target.value})} placeholder="Ej: Gef" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '700', marginBottom: '0.5rem' }}>Asignar Taller (Producción)</label>
                      <select style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }} value={formData.workshop_id} onChange={(e) => setFormData({...formData, workshop_id: e.target.value})}>
                        <option value="">Seleccionar Taller...</option>
                        {workshops.map(w => <option key={w.id} value={w.id}>{w.nombre_taller}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '700', marginBottom: '0.5rem' }}>Tela Principal</label>
                      <select style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }} value={formData.fabric_id} onChange={(e) => setFormData({...formData, fabric_id: e.target.value})}>
                        <option value="">Seleccionar...</option>
                        {fabrics.map(f => <option key={f.id} value={f.id}>{f.nombre_tela}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '700', marginBottom: '0.5rem' }}>Largo Trazo (m)</label>
                      <input type="number" step="0.01" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }} value={formData.largo_trazo} onChange={(e) => setFormData({...formData, largo_trazo: e.target.value})} />
                    </div>
                  </div>

                  <button className="btn btn-primary" style={{ padding: '1rem', width: '100%' }} onClick={() => setStep(2)}>
                    Configurar Referencias y Tallas <ArrowRight size={18} />
                  </button>
                </div>
              )}

              {step === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Package size={18} /> Referencias en esta Orden</h3>
                    <button className="btn btn-secondary" onClick={addProductRow} style={{ padding: '0.5rem 1rem' }}><Plus size={16} /> Añadir Referencia</button>
                  </div>

                  {orderItems.map((item, index) => (
                    <div key={item.id} style={{ padding: '1.5rem', border: '1px solid var(--border)', borderRadius: '16px', position: 'relative', backgroundColor: '#fdfdfd' }}>
                      <button onClick={() => removeProductRow(item.id)} style={{ position: 'absolute', top: '1rem', right: '1rem', color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }}><Trash2 size={18} /></button>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.3rem' }}>Producto / Referencia</label>
                          <select style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)' }} value={item.product_id} onChange={(e) => updateItem(item.id, 'product_id', e.target.value)}>
                            <option value="">Seleccionar Producto...</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.nombre_producto} ({p.codigo_referencia})</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.3rem' }}>Color</label>
                          <select style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)' }} value={item.color_id} onChange={(e) => updateItem(item.id, 'color_id', e.target.value)}>
                            <option value="">Seleccionar Color...</option>
                            {colors.map(c => <option key={c.id} value={c.id}>{c.nombre_color}</option>)}
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.75rem' }}>
                        {sizes.map(size => (
                          <div key={size.id} style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>{size.codigo_talla}</span>
                            <input 
                              type="number" min="0" placeholder="Capas"
                              style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border)', textAlign: 'center', fontSize: '0.875rem' }}
                              value={item.sizes[size.id] || ''}
                              onChange={(e) => updateItemSize(item.id, size.id, parseInt(e.target.value))}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div style={{ padding: '1.5rem', borderRadius: '12px', backgroundColor: isOverLimit ? '#fef2f2' : '#f0fdf4', border: `1px solid ${isOverLimit ? '#fecaca' : '#bbf7d0'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--text-muted)' }}>TOTAL CAPAS (TENDIDO GLOBAL)</p>
                      <h3 style={{ fontSize: '1.5rem', color: isOverLimit ? '#ef4444' : '#16a34a' }}>{totalLayers} / 125</h3>
                    </div>
                    {isOverLimit && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}><AlertTriangle size={24} /><span style={{ fontSize: '0.75rem', fontWeight: '700' }}>Excede límite técnico de 125 capas.</span></div>}
                  </div>

                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep(1)}>Atrás</button>
                    <button className="btn btn-primary" style={{ flex: 2 }} disabled={saving || totalLayers === 0} onClick={handleSave}>
                      {saving ? <Loader2 className="animate-spin" /> : 'Finalizar y Crear Orden'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
