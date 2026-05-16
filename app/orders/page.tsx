'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Plus, Search, Trash2, X, Loader2, AlertTriangle, 
  Scissors, Layers, Info, ArrowRight, Factory, 
  ChevronRight, Package, Palette, Activity, CheckCircle
} from 'lucide-react';

export default function OrdersPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState('all'); 
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  
  // Form State
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<any>({
    client_name: '',
    brand: '',
    product_id: '',
    fabric_id: '',
    workshop_id: '',
    largo_trazo: 0,
    marcaciones_config: '1',
    status: 'Planeada',
    priority: 'Media',
    order_type: 'corte',
    internal_code: '',
    consumo_prenda: '',
    cortador_name: '',
    observaciones: '',
    scheduled_date: new Date().toISOString().split('T')[0]
  });

  // Each row is a unique combination: Product | Color | Talla | Capas | Marcación
  const [orderItems, setOrderItems] = useState<any[]>([
    { id: Date.now(), product_id: '', color_id: '', size_id: '', layers: '', marker: '1' }
  ]);

  // Fabric colors for Step 2
  const [fabricColors, setFabricColors] = useState<any[]>([
    { id: Date.now(), color_id: '', kilos: '', layers: '', observation: '' }
  ]);

  const addFabricColor = () =>
    setFabricColors(prev => [...prev, { id: Date.now(), color_id: '', kilos: '', layers: '', observation: '' }]);

  const removeFabricColor = (id: number) =>
    setFabricColors(prev => prev.filter(fc => fc.id !== id));

  const updateFabricColor = (id: number, field: string, value: any) =>
    setFabricColors(prev => prev.map(fc => fc.id === id ? { ...fc, [field]: value } : fc));
  
  // Masters
  const [fabrics, setFabrics] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([
    { id: 1, name: 'Juan Cortador', role: 'Cortador' },
    { id: 2, name: 'Pedro Mesa', role: 'Cortador' },
    { id: 3, name: 'Maria Tela', role: 'Cortador' }
  ]);

  useEffect(() => {
    fetchData();
    fetchMasters();
  }, [filterType]);

  const fetchMasters = async () => {
    try {
      const { data: p } = await supabase.from('products').select('*');
      const { data: c } = await supabase.from('colors').select('*');
      const { data: s } = await supabase.from('sizes').select('*').order('orden_visual', { ascending: true });
      const { data: w } = await supabase.from('workshops').select('*');
      const { data: f } = await supabase.from('fabrics').select('*');
      
      if (p) setProducts(p);
      if (c) setColors(c);
      if (s) setSizes(s);
      if (w) setWorkshops(w);
      if (f) setFabrics(f);
    } catch (err) {
      console.error('Error fetching masters:', err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select(`*, fabrics (nombre_tela, capas_maximas), workshops (nombre_taller)`)
        .order('created_at', { ascending: false });

      if (filterType !== 'all') query = query.eq('order_type', filterType);

      const { data: result, error } = await query;
      if (error) throw error;
      setData(result || []);
    } catch (err: any) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const addProductRow = () => {
    setOrderItems([...orderItems, { id: Date.now(), product_id: '', color_id: '', size_id: '', layers: '', marker: '1' }]);
  };

  const removeProductRow = (id: number) => {
    setOrderItems(orderItems.filter(item => item.id !== id));
  };

  const updateItem = (id: number, field: string, value: any) => {
    setOrderItems(orderItems.map(item => {
      if (item.id === id) {
        const newItem = { ...item, [field]: value };
        if (field === 'color_id') {
          const fc = fabricColors.find(f => f.color_id === value);
          if (fc) newItem.layers = fc.layers;
        }
        return newItem;
      }
      return item;
    }));
  };

  const selectedFabric = fabrics.find(f => f.id === formData.fabric_id);
  const fabricMaxCapas = selectedFabric?.capas_maximas || 120;
  
  const step2TotalLayers = fabricColors.reduce((acc, fc) => acc + (Number(fc.layers) || 0), 0);
  const totalUnits = orderItems.reduce((acc, item) => acc + (Number(item.marker || 0) * (Number(item.layers) || 0)), 0);
  const totalLayersSummary = orderItems.reduce((acc, item) => acc + (Number(item.layers) || 0), 0);
  const totalKilos = fabricColors.reduce((sum, fc) => sum + (Number(fc.kilos) || 0), 0);
  
  const isOverLimit = step2TotalLayers > fabricMaxCapas;

  const handleEdit = async (order: any) => {
    setEditingId(order.id);
    
    try {
      const { data: cutsData } = await supabase
        .from('cuts')
        .select('*, cut_sizes(*)')
        .eq('order_id', order.id);

      const firstProductId = cutsData?.[0]?.product_id || '';

      setFormData({
        internal_code: order.internal_code || '',
        brand: order.brand || '',
        fabric_id: order.fabric_id || '',
        product_id: firstProductId,
        largo_trazo: order.largo_trazo || '',
        consumo_prenda: order.consumo_prenda || '',
        marcaciones_config: order.marcaciones_config || '1',
        status: order.status || 'Planeada',
        priority: order.priority || 'Media',
        order_type: order.order_type || 'Producción',
        observaciones: order.observaciones || '',
        cortador_name: order.cortador_name || '',
        scheduled_date: order.scheduled_date || new Date().toISOString().split('T')[0]
      });

      if (cutsData && cutsData.length > 0) {
        const uniqueColors = Array.from(new Set(cutsData.map(c => c.color_id)));
        const fCols = uniqueColors.map(cid => {
          const colorCuts = cutsData.filter(c => c.color_id === cid);
          const totalKilosForColor = colorCuts.reduce((sum, c) => sum + (Number(c.kilos) || 0), 0);
          const maxLayersForColor = Math.max(...colorCuts.map(c => Number(c.layers) || 0));
          
          return {
            id: Math.random(),
            color_id: cid,
            kilos: totalKilosForColor || '',
            layers: maxLayersForColor || '',
            observation: ''
          };
        });
        setFabricColors(fCols.length > 0 ? fCols : [{ id: Date.now(), color_id: '', kilos: '', layers: '', observation: '' }]);

        const items = cutsData.flatMap(cut => 
          cut.cut_sizes.map((cs: any) => ({
            id: Math.random(),
            product_id: cut.product_id,
            color_id: cut.color_id,
            size_id: cs.size_id,
            layers: cut.layers,
            marker: (Number(cs.quantity) / (Number(cut.layers) || 1)).toString()
          }))
        );
        setOrderItems(items.length > 0 ? items : [{ id: Date.now(), product_id: '', color_id: '', size_id: '', layers: '', marker: '1' }]);
      }
      
      setStep(1);
      setShowModal(true);
    } catch (err) {
      console.error('Error loading order details:', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const orderPayload = {
        internal_code: formData.internal_code,
        client_name: formData.brand || formData.internal_code,
        brand: formData.brand || formData.internal_code,
        fabric_id: formData.fabric_id || null,
        workshop_id: null,
        largo_trazo: Number(formData.largo_trazo) || 0,
        consumo_prenda: Number(formData.consumo_prenda) || 0, // Añadido
        marcaciones_config: formData.marcaciones_config,
        status: formData.status,
        priority: formData.priority,
        order_type: formData.order_type,
        capas_proyectadas: totalLayersSummary,
        total_kilos_proyectados: totalKilos,
        observaciones: formData.observaciones,
        cortador_name: formData.cortador_name,
        scheduled_date: formData.scheduled_date
      };

      let orderId = editingId;

      if (editingId) {
        const { error: updateError } = await supabase
          .from('orders')
          .update(orderPayload)
          .eq('id', editingId);
        if (updateError) throw updateError;

        const { data: oldCuts } = await supabase.from('cuts').select('id').eq('order_id', editingId);
        if (oldCuts && oldCuts.length > 0) {
          const cutIds = oldCuts.map(c => c.id);
          await supabase.from('cut_sizes').delete().in('cut_id', cutIds);
          await supabase.from('cuts').delete().in('id', cutIds);
        }
      } else {
        const { data: newOrder, error: orderError } = await supabase
          .from('orders')
          .insert([orderPayload])
          .select()
          .single();
        if (orderError) throw orderError;
        orderId = newOrder.id;
      }
      setCurrentOrderId(orderId);

      const colorKilosMap: Record<string, number> = {};
      fabricColors.forEach(fc => {
        if (fc.color_id) colorKilosMap[fc.color_id] = Number(fc.kilos) || 0;
      });

      const assignedColors = new Set<string>();

      for (const item of orderItems) {
        if (!item.color_id) continue;

        let itemKilos = 0;
        if (!assignedColors.has(item.color_id)) {
          itemKilos = colorKilosMap[item.color_id] || 0;
          assignedColors.add(item.color_id);
        }

        const { data: newCut, error: cutError } = await supabase
          .from('cuts')
          .insert([{
            order_id: orderId,
            product_id: item.product_id || null,
            color_id: item.color_id || null,
            stroke_length: formData.largo_trazo,
            consumption: Number(formData.consumo_prenda) || 0,
            kilos: itemKilos,
            layers: Number(item.layers) || 0
          }])
          .select()
          .single();

        if (cutError) throw cutError;

        const { error: sizeError } = await supabase.from('cut_sizes').insert([{
          cut_id: newCut.id,
          size_id: item.size_id || null,
          quantity: Math.round(Number(item.marker) * Number(item.layers))
        }]);

        if (sizeError) throw sizeError;
      }
      
      setStep(3); 
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFinishAndSend = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'En Corte'
        })
        .eq('id', currentOrderId || editingId);
      
      if (error) throw error;
      
      setShowModal(false);
      setStep(1);
      setEditingId(null);
      fetchData();
    } catch (err: any) {
      alert('Error al enviar a cortador: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const stats = {
    total: data.length,
    planeada: data.filter(o => o.status === 'Planeada').length,
    enCorte: data.filter(o => o.status === 'En Corte').length,
    cortado: data.filter(o => o.status === 'Cortado' || o.status === 'Completada').length
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1rem', backgroundColor: '#fcfcfc', minHeight: '100vh' }}>
      
      {/* Dashboard Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
        {[
          { label: 'Total Órdenes', value: stats.total, color: 'var(--primary)', icon: Package },
          { label: 'Planeadas', value: stats.planeada, color: '#64748b', icon: Info },
          { label: 'En Proceso', value: stats.enCorte, color: '#f59e0b', icon: Activity },
          { label: 'Completadas', value: stats.cortado, color: '#10b981', icon: CheckCircle }
        ].map((stat, i) => (
          <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1.5rem', borderLeft: `6px solid ${stat.color}` }}>
            <div style={{ backgroundColor: `${stat.color}15`, padding: '1rem', borderRadius: '12px' }}>
              <stat.icon size={24} style={{ color: stat.color }} />
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</p>
              <h2 style={{ fontSize: '1.75rem', fontWeight: '900', margin: 0 }}>{stat.value}</h2>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.75rem', fontWeight: '950' }}>
            <Scissors size={32} style={{ color: 'var(--primary)' }} /> Módulo de Corte Industrial
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Gestión, trazabilidad y control de consumo textil.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={fetchData}><Activity size={18} /> Actualizar</button>
          <button className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', fontSize: '1rem', fontWeight: '700' }} onClick={() => { 
            const randomCode = `OC-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
            setFormData({ 
              status: 'Planeada', 
              priority: 'Media', 
              client_name: '', 
              brand: '', 
              product_id: '',
              fabric_id: '',
              workshop_id: '',
              internal_code: randomCode, 
              order_type: 'corte', 
              consumo_prenda: '',
              largo_trazo: 0,
              marcaciones_config: '1',
              observaciones: '',
              cortador_name: '',
              scheduled_date: new Date().toISOString().split('T')[0] 
            });
            setEditingId(null);
            setStep(1); 
            setFabricColors([{ id: Date.now(), color_id: '', kilos: '', layers: '', observation: '' }]);
            setOrderItems([{ id: Date.now(), product_id: '', color_id: '', size_id: '', layers: '', marker: '1' }]);
            setShowModal(true); 
          }}>
            <Plus size={20} /> Nueva Orden de Corte
          </button>
        </div>
      </div>

      {/* Tabs Filtros */}
      <div style={{ display: 'flex', gap: '1rem', backgroundColor: 'white', padding: '0.5rem', borderRadius: '12px', width: 'fit-content', border: '1px solid var(--border)' }}>
        {['all', 'Planeada', 'En Corte', 'Cortado'].map(state => (
          <button key={state} onClick={() => setFilterType(state === 'all' ? 'all' : state)} 
            className="btn" 
            style={{ 
              borderRadius: '8px', 
              padding: '0.5rem 1.25rem',
              backgroundColor: (filterType === state || (state === 'all' && filterType === 'all')) ? 'var(--primary)' : 'transparent',
              color: (filterType === state || (state === 'all' && filterType === 'all')) ? 'white' : 'var(--text)',
              border: 'none',
              fontWeight: '700'
            }}>
            {state === 'all' ? 'Todas' : state}
          </button>
        ))}
      </div>

      {/* Tabla Principal */}
      <div className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', backgroundColor: '#fcfcfc' }}>
          <div style={{ position: 'relative', width: '400px' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" placeholder="Buscar por código, cliente o referencia..." style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 3rem', borderRadius: '10px', border: '1.5px solid var(--border)', fontSize: '0.875rem' }} />
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', backgroundColor: '#f8fafc' }}>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Cód. Interno</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Cliente / Marca</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Tela Base</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Taller</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Capas</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Kilos</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Estado</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: '5rem', textAlign: 'center' }}><Loader2 className="animate-spin" size={48} style={{ color: 'var(--primary)', opacity: 0.5 }} /></td></tr>
              ) : (
                data.map(order => (
                  <tr key={order.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="hover-row">
                    <td style={{ padding: '1rem 1.5rem' }}><span style={{ fontWeight: '900', color: 'var(--primary)' }}>{order.internal_code}</span></td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ fontWeight: '700' }}>{order.client_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{order.brand}</div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>{order.fabrics?.nombre_tela || '---'}</td>
                    <td style={{ padding: '1rem 1.5rem' }}>{order.workshops?.nombre_taller || '---'}</td>
                    <td style={{ padding: '1rem 1.5rem' }}><span style={{ fontWeight: '800', backgroundColor: '#f1f5f9', padding: '0.25rem 0.75rem', borderRadius: '6px' }}>{order.capas_proyectadas}</span></td>
                    <td style={{ padding: '1rem 1.5rem' }}><span style={{ fontWeight: '800', color: '#64748b' }}>{order.total_kilos_proyectados || 0} kg</span></td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <span className="badge" style={{ 
                        backgroundColor: order.status === 'Planeada' ? '#f1f5f9' : order.status === 'En Corte' ? '#fffbeb' : '#ecfdf5',
                        color: order.status === 'Planeada' ? '#64748b' : order.status === 'En Corte' ? '#b45309' : '#059669',
                        padding: '0.4rem 0.8rem',
                        fontWeight: '800',
                        fontSize: '0.7rem',
                        borderRadius: '999px',
                        border: '1px solid currentColor'
                      }}>
                        {order.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                      <button className="btn btn-secondary" onClick={() => handleEdit(order)} style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: '700' }}>
                        Editar / Detalle
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* WIZARD MODAL */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(12px)' }}>
          <div className="card" style={{ width: '95%', maxWidth: '1100px', padding: '0', maxHeight: '95vh', overflowY: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            
            {/* Wizard Header */}
            <div style={{ padding: '1.5rem 2.5rem', background: '#0f172a', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '950', color: 'white', margin: 0, letterSpacing: '-0.02em' }}>
                  {editingId ? 'Editar Orden de Corte' : 'Nueva Programación de Corte'}
                </h2>
                <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem' }}>
                  {[
                    { s: 1, l: 'Info & Telas' },
                    { s: 2, l: 'Programación Técnica' },
                    { s: 3, l: 'Asignación Final' }
                  ].map(item => (
                    <div key={item.s} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: step >= item.s ? 1 : 0.4 }}>
                      <div style={{ 
                        width: '24px', height: '24px', borderRadius: '50%', 
                        backgroundColor: step === item.s ? 'var(--primary)' : step > item.s ? '#10b981' : 'rgba(255,255,255,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '900'
                      }}>
                        {step > item.s ? '✓' : item.s}
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase' }}>{item.l}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ color: 'white', background: 'rgba(255,255,255,0.1)', border: 'none', padding: '0.75rem', borderRadius: '12px', cursor: 'pointer' }}><X size={24} /></button>
            </div>

            <div style={{ padding: '2.5rem', overflowY: 'auto', flex: 1 }}>
              
              {/* STEP 1: INFO GENERAL & TELAS */}
              {step === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                    <div className="input-group">
                      <label style={{ fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Código Interno</label>
                      <div style={{ padding: '0.875rem', borderRadius: '10px', backgroundColor: '#f8fafc', border: '2.5px solid #e2e8f0', fontWeight: '900', color: 'var(--primary)', fontSize: '1.125rem' }}>
                        {formData.internal_code}
                      </div>
                    </div>
                    <div className="input-group" style={{ gridColumn: 'span 2' }}>
                      <label style={{ fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Tela Base</label>
                      <select style={{ width: '100%', padding: '0.875rem', borderRadius: '10px', border: '2.5px solid #e2e8f0', fontWeight: '700' }} value={formData.fabric_id} onChange={e => setFormData({...formData, fabric_id: e.target.value})}>
                        <option value="">Seleccionar Tela...</option>
                        {fabrics.map(f => <option key={f.id} value={f.id}>{f.nombre_tela}</option>)}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                    <div className="input-group">
                      <label style={{ fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Consumo Estimado (kg/und)</label>
                      <input 
                        type="number" 
                        step="0.001" 
                        style={{ width: '100%', padding: '0.875rem', borderRadius: '10px', border: '2.5px solid #e2e8f0' }} 
                        value={formData.consumo_prenda || ''} 
                        onChange={e => setFormData({...formData, consumo_prenda: e.target.value})} 
                      />
                    </div>
                    <div className="input-group">
                      <label style={{ fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Largo de Trazo (m)</label>
                      <input type="number" step="0.01" style={{ width: '100%', padding: '0.875rem', borderRadius: '10px', border: '2.5px solid #e2e8f0' }} value={formData.largo_trazo} onChange={e => setFormData({...formData, largo_trazo: e.target.value})} />
                    </div>
                    <div className="input-group">
                      <label style={{ fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Configuración Marcación</label>
                      <select style={{ width: '100%', padding: '0.875rem', borderRadius: '10px', border: '2.5px solid #e2e8f0', fontWeight: '800' }} value={formData.marcaciones_config} onChange={e => setFormData({...formData, marcaciones_config: e.target.value})}>
                        {[1,2,3,4,5].map(v => <option key={v} value={v.toString()}>{v} Marcación(es)</option>)}
                      </select>
                    </div>
                  </div>

                  {/* CONFIGURACIÓN DE COLORES Y CAPAS (ANTES PASO 2) */}
                  <div style={{ marginTop: '1rem', borderTop: '2px solid #f1f5f9', paddingTop: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: '900', color: '#0f172a' }}>Distribución de Colores y Capas</h3>
                      <button className="btn btn-secondary" onClick={addFabricColor}><Plus size={18} /> Añadir Color</button>
                    </div>

                    {isOverLimit && (
                      <div style={{ backgroundColor: '#fef2f2', border: '1px solid #ef4444', padding: '1rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '1rem', color: '#b91c1c', marginBottom: '1.5rem' }}>
                        <AlertTriangle size={24} />
                        <div>
                          <p style={{ fontWeight: '900' }}>¡Límite de Capas Excedido!</p>
                          <p style={{ fontSize: '0.875rem' }}>La tela seleccionada permite un máximo de {fabricMaxCapas} capas. Actualmente tienes {step2TotalLayers}.</p>
                        </div>
                      </div>
                    )}

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ textAlign: 'left', borderBottom: '2.5px solid #e2e8f0' }}>
                            <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)' }}>TELA / KILOS</th>
                            <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)' }}>DETALLES</th>
                            <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textAlign: 'center' }}>N° CAPAS</th>
                            <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', color: '#64748b' }}>OBSERVACIÓN</th>
                            <th style={{ padding: '1rem' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {fabricColors.map(fc => (
                            <tr key={fc.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '0.75rem' }}>
                                <select style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontWeight: '700' }} value={fc.color_id} onChange={e => updateFabricColor(fc.id, 'color_id', e.target.value)}>
                                  <option value="">Seleccionar Color...</option>
                                  {colors.map(c => <option key={c.id} value={c.id}>{c.nombre_color}</option>)}
                                </select>
                              </td>
                              <td style={{ padding: '0.75rem' }}>
                                <input type="number" placeholder="0.00" style={{ width: '120px', padding: '0.75rem', borderRadius: '8px', border: '1.5px solid #e2e8f0', textAlign: 'right' }} value={fc.kilos} onChange={e => updateFabricColor(fc.id, 'kilos', e.target.value)} />
                              </td>
                              <td style={{ padding: '0.75rem' }}>
                                <input type="number" placeholder="0" style={{ width: '100px', margin: '0 auto', display: 'block', padding: '0.75rem', borderRadius: '8px', border: '1.5px solid #e2e8f0', textAlign: 'center', fontWeight: '800' }} value={fc.layers} onChange={e => updateFabricColor(fc.id, 'layers', e.target.value)} />
                              </td>
                              <td style={{ padding: '0.75rem' }}>
                                <input type="text" placeholder="Ej: Lote X" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1.5px solid #e2e8f0' }} value={fc.observation} onChange={e => updateFabricColor(fc.id, 'observation', e.target.value)} />
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                <button onClick={() => removeFabricColor(fc.id)} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }}><Trash2 size={20} /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', marginTop: '1.5rem' }}>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Total Kilos Tela</p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--primary)' }}>{totalKilos.toFixed(2)} kg</h3>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Total Capas Global</p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: isOverLimit ? '#ef4444' : '#1e293b' }}>{step2TotalLayers} / {fabricMaxCapas}</h3>
                      </div>
                    </div>
                  </div>

                  <div className="input-group">
                    <label style={{ fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Notas Adicionales</label>
                    <textarea style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '2.5px solid #e2e8f0', minHeight: '80px' }} value={formData.observaciones} onChange={e => setFormData({...formData, observaciones: e.target.value})} placeholder="Instrucciones para el cortador..." />
                  </div>

                  <button className="btn btn-primary" style={{ width: '100%', padding: '1.25rem', fontSize: '1.125rem', fontWeight: '900' }} 
                    onClick={() => {
                      const initialItems = fabricColors
                        .filter(fc => fc.color_id && Number(fc.layers) > 0)
                        .map(fc => ({
                          id: Math.random(),
                          product_id: formData.product_id || '', // Pre-fill product if selected in Step 1
                          color_id: fc.color_id,
                          size_id: '',
                          layers: fc.layers,
                          marker: '1'
                        }));
                      setOrderItems(initialItems.length > 0 ? initialItems : [{ id: Date.now(), product_id: '', color_id: '', size_id: '', layers: '', marker: '1' }]);
                      setStep(2);
                    }} 
                    disabled={!formData.fabric_id || fabricColors.filter(f => f.color_id).length === 0 || isOverLimit}>
                    {isOverLimit ? 'Límite de Capas Excedido' : 'Continuar a Programación Técnica'} <ArrowRight size={24} style={{ marginLeft: '1rem' }} />
                  </button>
                </div>
              )}

              {/* STEP 2: PROGRAMACIÓN TÉCNICA (ANTES PASO 3) */}
              {step === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '900' }}>Matriz de Programación Técnica</h3>
                    <button className="btn btn-secondary" onClick={addProductRow}><Plus size={18} /> Añadir Fila</button>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '2.5px solid #e2e8f0' }}>
                          <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', color: '#64748b' }}>PRODUCTO</th>
                          <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', color: '#64748b' }}>COLOR (AUTO)</th>
                          <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', color: '#64748b' }}>TALLA</th>
                          <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textAlign: 'center' }}>CAPAS</th>
                          <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textAlign: 'center' }}>MARCACIÓN</th>
                          <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textAlign: 'right' }}>SUBTOTAL</th>
                          <th style={{ padding: '1rem' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderItems.map(item => (
                          <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.75rem' }}>
                              <select style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1.5px solid #e2e8f0' }} value={item.product_id} onChange={e => updateItem(item.id, 'product_id', e.target.value)}>
                                <option value="">Seleccionar...</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.nombre_producto}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                              <select style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1.5px solid #e2e8f0', backgroundColor: '#f8fafc', fontWeight: '700' }} value={item.color_id} onChange={e => updateItem(item.id, 'color_id', e.target.value)}>
                                <option value="">Color...</option>
                                {fabricColors.map(fc => {
                                  const col = colors.find(c => c.id === fc.color_id);
                                  return <option key={fc.id} value={fc.color_id}>{col?.nombre_color || '?'}</option>
                                })}
                              </select>
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                              <select style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1.5px solid #e2e8f0' }} value={item.size_id} onChange={e => updateItem(item.id, 'size_id', e.target.value)}>
                                <option value="">Talla...</option>
                                {sizes.map(s => <option key={s.id} value={s.id}>{s.codigo_talla}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                              <input type="number" style={{ width: '70px', textAlign: 'center', padding: '0.75rem', border: '1.5px solid #e2e8f0', borderRadius: '8px' }} value={item.layers} onChange={e => updateItem(item.id, 'layers', e.target.value)} />
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                              <select style={{ padding: '0.75rem', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontWeight: '800' }} value={item.marker} onChange={e => updateItem(item.id, 'marker', e.target.value)}>
                                {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '900', color: 'var(--primary)', fontSize: '1rem' }}>{Number(item.marker) * Number(item.layers)} u</td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                              <button onClick={() => removeProductRow(item.id)} style={{ color: '#ef4444', border: 'none', background: 'none' }}><Trash2 size={18} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ backgroundColor: '#0f172a', padding: '2rem', borderRadius: '20px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', textAlign: 'center', color: 'white' }}>
                    <div><p style={{ fontSize: '0.7rem', opacity: 0.6, fontWeight: '800' }}>TOTAL CAPAS</p><h3 style={{ fontSize: '1.5rem', fontWeight: '900' }}>{totalLayersSummary}</h3></div>
                    <div><p style={{ fontSize: '0.7rem', opacity: 0.6, fontWeight: '800' }}>TOTAL PRENDAS</p><h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#10b981' }}>{totalUnits} u</h3></div>
                    <div><p style={{ fontSize: '0.7rem', opacity: 0.6, fontWeight: '800' }}>REFERENCIAS</p><h3 style={{ fontSize: '1.5rem', fontWeight: '900' }}>{new Set(orderItems.map(i => i.product_id)).size}</h3></div>
                    <div><p style={{ fontSize: '0.7rem', opacity: 0.6, fontWeight: '800' }}>KILOS TELA</p><h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#38bdf8' }}>{totalKilos.toFixed(2)} kg</h3></div>
                  </div>

                  <div style={{ display: 'flex', gap: '1.5rem' }}>
                    <button className="btn btn-secondary" style={{ flex: 1, padding: '1rem' }} onClick={() => setStep(1)}>Atrás</button>
                    <button className="btn btn-primary" style={{ flex: 2, padding: '1rem', fontSize: '1.125rem', fontWeight: '900' }} onClick={handleSave} disabled={saving || totalUnits === 0}>
                      {saving ? <Loader2 className="animate-spin" /> : 'Siguiente: Asignación Final'}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: ASIGNACIÓN Y FORMATO FINAL (ANTES PASO 4) */}
              {step === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    <div className="card" style={{ padding: '1.5rem', border: '2px solid var(--primary)' }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: '900', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Factory size={20} /> Asignación del Cortador</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="input-group">
                          <label style={{ fontWeight: '800', fontSize: '0.7rem', color: '#64748b' }}>SELECCIONAR RESPONSABLE</label>
                          <input 
                            type="text"
                            list="cortadores-list"
                            placeholder="Ej: Juan Pérez"
                            style={{ width: '100%', padding: '0.875rem', borderRadius: '10px', border: '2.5px solid #e2e8f0', fontWeight: '700' }} 
                            value={formData.cortador_name} 
                            onChange={e => setFormData({...formData, cortador_name: e.target.value})}
                          />
                          <datalist id="cortadores-list">
                            {users.map(u => <option key={u.id} value={u.name}>{u.role}</option>)}
                          </datalist>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div className="input-group">
                            <label style={{ fontWeight: '800', fontSize: '0.7rem', color: '#64748b' }}>FECHA PROGRAMADA</label>
                            <input type="date" style={{ width: '100%', padding: '0.875rem', borderRadius: '10px', border: '2.5px solid #e2e8f0' }} value={formData.scheduled_date} onChange={e => setFormData({...formData, scheduled_date: e.target.value})} />
                          </div>
                          <div className="input-group">
                            <label style={{ fontWeight: '800', fontSize: '0.7rem', color: '#64748b' }}>PRIORIDAD</label>
                            <select style={{ width: '100%', padding: '0.875rem', borderRadius: '10px', border: '2.5px solid #e2e8f0', fontWeight: '700' }} value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
                              <option value="Alta">ALTA</option>
                              <option value="Media">MEDIA</option>
                              <option value="Baja">BAJA</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
                      <p style={{ fontWeight: '800', color: '#64748b', fontSize: '0.875rem' }}>RESUMEN FINAL DE PRODUCCIÓN</p>
                      <h2 style={{ fontSize: '3rem', fontWeight: '950', color: 'var(--primary)', margin: '0.5rem 0' }}>{totalUnits}</h2>
                      <p style={{ fontWeight: '700', fontSize: '1rem', color: '#10b981' }}>UNIDADES TOTALES A CORTAR</p>
                    </div>
                  </div>

                  <div style={{ padding: '2rem', backgroundColor: 'white', borderRadius: '16px', border: '2.5px solid #0f172a', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '-12px', right: '2rem', backgroundColor: '#0f172a', color: 'white', padding: '0.25rem 1rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '900' }}>VISTA PREVIA ORDEN DE TRABAJO</div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ backgroundColor: '#0f172a', padding: '0.5rem', borderRadius: '8px' }}><Scissors color="white" size={24} /></div>
                        <div>
                          <h3 style={{ fontSize: '1.25rem', fontWeight: '950', color: '#0f172a', margin: 0 }}>ORDEN DE CORTE #{formData.internal_code}</h3>
                          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>Sistema de Producción Industrial - {new Date().toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '0.875rem', margin: 0 }}>Referencia: <strong>{formData.internal_code}</strong></p>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>ID de Seguimiento</p>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                      {[
                        { l: 'Tela Base', v: fabrics.find(f => f.id === formData.fabric_id)?.nombre_tela },
                        { l: 'Largo Trazo', v: `${formData.largo_trazo} m` },
                        { l: 'Consumo', v: `${formData.consumo_prenda} kg` },
                        { l: 'Marcación', v: `${formData.marcaciones_config} Marc.` }
                      ].map((item, i) => (
                        <div key={i} style={{ border: '1px solid #e2e8f0', padding: '0.75rem', borderRadius: '8px' }}>
                          <p style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', margin: 0, textTransform: 'uppercase' }}>{item.l}</p>
                          <p style={{ fontSize: '0.9rem', fontWeight: '700', margin: 0 }}>{item.v}</p>
                        </div>
                      ))}
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
                      <thead style={{ backgroundColor: '#f8fafc' }}>
                        <tr>
                          <th style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.7rem', textAlign: 'left' }}>PRODUCTO</th>
                          <th style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.7rem', textAlign: 'left' }}>COLOR</th>
                          <th style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.7rem', textAlign: 'center' }}>TALLA</th>
                          <th style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.7rem', textAlign: 'center' }}>CAPAS</th>
                          <th style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.7rem', textAlign: 'center' }}>MARC</th>
                          <th style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.7rem', textAlign: 'right' }}>TOTAL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderItems.map((item, i) => (
                          <tr key={i}>
                            <td style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.8rem' }}>{products.find(p => p.id === item.product_id)?.nombre_producto}</td>
                            <td style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.8rem' }}>{colors.find(c => c.id === item.color_id)?.nombre_color}</td>
                            <td style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.8rem', textAlign: 'center' }}>{sizes.find(s => s.id === item.size_id)?.codigo_talla}</td>
                            <td style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.8rem', textAlign: 'center' }}>{item.layers}</td>
                            <td style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.8rem', textAlign: 'center' }}>{item.marker}</td>
                            <td style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.8rem', textAlign: 'right', fontWeight: '700' }}>{Number(item.layers) * Number(item.marker)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', marginTop: '3rem' }}>
                      {['PLANEACIÓN', 'CORTADOR', 'CONTROL CALIDAD'].map(label => (
                        <div key={label} style={{ textAlign: 'center' }}>
                          <div style={{ borderBottom: '2px solid #0f172a', width: '100%', marginBottom: '0.5rem' }}></div>
                          <p style={{ fontSize: '0.7rem', fontWeight: '800' }}>{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1.5rem' }}>
                    <button className="btn btn-secondary" style={{ flex: 1, padding: '1rem' }} onClick={() => setStep(2)}>Atrás</button>
                    <button className="btn btn-primary" style={{ flex: 2, padding: '1rem', fontSize: '1.125rem', fontWeight: '900', backgroundColor: '#10b981', borderColor: '#10b981' }} onClick={handleFinishAndSend} disabled={saving || !formData.cortador_name}>
                      {saving ? <Loader2 className="animate-spin" /> : 'Confirmar y Enviar a Planta'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .hover-row:hover {
          background-color: #f8fafc !important;
          cursor: pointer;
        }
        .input-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        textarea:focus, input:focus, select:focus {
          outline: none;
          border-color: var(--primary) !important;
          box-shadow: 0 0 0 4px var(--primary-light);
        }
      `}</style>
    </div>
  );
}
