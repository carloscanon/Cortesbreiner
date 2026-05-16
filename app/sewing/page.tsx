'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Scissors, Factory, Truck, CheckCircle, Clock, Search, 
  Filter, ChevronRight, Loader2, Save, Calendar, AlertCircle,
  Package, User, Info, ArrowRight, LayoutList, Plus, X
} from 'lucide-react';

export default function SewingPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('Cortado');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [assignment, setAssignment] = useState({
    workshop_id: '',
    scheduled_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [showGenerationModal, setShowGenerationModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          fabrics (nombre_tela),
          workshops (nombre_taller, responsable)
        `)
        .in('status', ['Cortado', 'En Confección', 'Enviada', 'Terminada'])
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      const { data: workshopsData, error: workshopsError } = await supabase
        .from('workshops')
        .select('*')
        .order('nombre_taller', { ascending: true });

      if (workshopsError) throw workshopsError;

      setOrders(ordersData || []);
      setWorkshops(workshopsData || []);
    } catch (err: any) {
      console.error('Error fetching data:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!assignment.workshop_id || !selectedOrder) return alert('Seleccione un taller.');
    setSaving(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          workshop_id: assignment.workshop_id,
          status: 'En Confección',
          observaciones: assignment.notes ? `${selectedOrder.observaciones || ''}\n[Salida Taller]: ${assignment.notes}` : selectedOrder.observaciones
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;
      
      setShowModal(false);
      setShowGenerationModal(false);
      setAssignment({ workshop_id: '', scheduled_date: new Date().toISOString().split('T')[0], notes: '' });
      fetchData();
    } catch (err: any) {
      alert('Error al asignar taller: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const filtered = orders.filter(o => {
    const matchSearch = o.internal_code?.toLowerCase().includes(search.toLowerCase()) ||
                       o.brand?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' ? true : o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const availableToSew = orders.filter(o => o.status === 'Cortado');

  const stats = {
    total: orders.length,
    cortado: availableToSew.length,
    enConfeccion: orders.filter(o => o.status === 'En Confección').length,
    recibidas: orders.filter(o => o.status === 'Enviada' || o.status === 'Terminada').length
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '4rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: '950', letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.5rem', backgroundColor: '#7c3aed', borderRadius: '12px', color: 'white' }}>
              <Truck size={28} />
            </div>
            Gestión de Confección
          </h1>
          <p style={{ color: 'var(--text-muted)', fontWeight: '500' }}>Salida de producción a talleres y recepción de confección.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowGenerationModal(true)} style={{ backgroundColor: '#7c3aed', borderColor: '#7c3aed', padding: '0.875rem 1.5rem', fontSize: '0.875rem', fontWeight: '800' }}>
          <Plus size={20} /> Generar Orden de Confección
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
        {[
          { label: 'Por Despachar', value: stats.cortado, color: '#f59e0b', icon: Package, desc: 'Listas en mesa de corte' },
          { label: 'En Taller', value: stats.enConfeccion, color: '#7c3aed', icon: Factory, desc: 'Órdenes en costura' },
          { label: 'Terminadas', value: stats.recibidas, color: '#10b981', icon: CheckCircle, desc: 'Listas para ingreso' },
          { label: 'Total Flujo', value: stats.total, color: '#64748b', icon: LayoutList, desc: 'Acumulado del mes' }
        ].map((kpi, i) => (
          <div key={i} className="card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', border: `1px solid ${kpi.color}20` }}>
            <div style={{ padding: '0.75rem', backgroundColor: `${kpi.color}15`, color: kpi.color, borderRadius: '12px' }}>
              <kpi.icon size={24} />
            </div>
            <div>
              <p style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>{kpi.label}</p>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '950', margin: '0.1rem 0' }}>{kpi.value}</h3>
              <p style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{kpi.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main List: En Confección / Tracking */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: '1.5rem', backgroundColor: '#fcfcfc' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Buscar por código u OP..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 3rem', borderRadius: '10px', border: '1.5px solid var(--border)' }} 
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['En Confección', 'Enviada', 'Terminada', 'all'].map(s => (
              <button 
                key={s}
                onClick={() => setFilterStatus(s)}
                className="btn"
                style={{ 
                  fontSize: '0.75rem', 
                  fontWeight: '700', 
                  backgroundColor: filterStatus === s ? '#7c3aed' : 'white',
                  color: filterStatus === s ? 'white' : 'var(--text)',
                  border: '1px solid var(--border)'
                }}
              >
                {s === 'all' ? 'Ver Todas' : s}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b' }}>CÓDIGO / REF</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b' }}>TELA</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b' }}>UNIDADES</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b' }}>TALLER ASIGNADO</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b' }}>ESTADO</th>
                <th style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: '4rem', textAlign: 'center' }}><Loader2 className="animate-spin" size={32} style={{ margin: 'auto' }} /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>No hay órdenes en confección actualmente.</td></tr>
              ) : filtered.map(order => (
                <tr key={order.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <div style={{ fontWeight: '900', color: '#7c3aed', fontSize: '1rem' }}>{order.internal_code}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>{order.brand}</div>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>{order.fabrics?.nombre_tela}</td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <span style={{ fontWeight: '800', padding: '0.35rem 0.75rem', backgroundColor: '#f1f5f9', borderRadius: '8px' }}>
                      {order.capas_proyectadas || '—'} u
                    </span>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <div style={{ fontWeight: '700' }}>{order.workshops?.nombre_taller || 'No asignado'}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{order.workshops?.responsable}</div>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <span style={{ 
                      padding: '0.4rem 0.8rem', 
                      borderRadius: '999px', 
                      fontSize: '0.65rem', 
                      fontWeight: '800',
                      backgroundColor: order.status === 'En Confección' ? '#eff6ff' : '#ecfdf5',
                      color: order.status === 'En Confección' ? '#1e40af' : '#059669',
                      border: '1px solid currentColor'
                    }}>
                      {order.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                    {order.status === 'En Confección' && (
                      <button 
                        className="btn btn-success" 
                        style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', backgroundColor: '#10b981', color: 'white', border: 'none' }}
                        onClick={() => handleUpdateStatus(order.id, 'Terminada')}
                      >
                        Recibir de Taller
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Generar Orden (Seleccionar de Cortadas) */}
      {showGenerationModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(10px)' }}>
          <div className="card" style={{ width: '95%', maxWidth: '800px', padding: '0', maxHeight: '90vh', overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1.5rem 2rem', background: '#7c3aed', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '950', color: 'white', margin: 0 }}>Generar Salida a Confección</h2>
              <button onClick={() => setShowGenerationModal(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            
            <div style={{ padding: '2rem', overflowY: 'auto' }}>
              <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.5rem', fontWeight: '600' }}>Seleccione una orden de las mesas de corte para enviar a taller:</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {availableToSew.length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
                    <Scissors size={40} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                    <p style={{ fontWeight: '700', color: '#64748b' }}>No hay órdenes cortadas disponibles.</p>
                  </div>
                ) : availableToSew.map(order => (
                  <div 
                    key={order.id} 
                    className="card hover-row" 
                    style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', border: '1.5px solid #e2e8f0' }}
                    onClick={() => { setSelectedOrder(order); setShowModal(true); }}
                  >
                    <div>
                      <div style={{ fontWeight: '900', color: '#7c3aed', fontSize: '1rem' }}>{order.internal_code}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{order.brand} • {order.fabrics?.nombre_tela}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: '800', color: '#0f172a' }}>{order.capas_proyectadas} unidades</div>
                      <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: '800' }}>LISTA PARA COSER <ChevronRight size={14} /></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Asignación Final */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(10px)' }}>
          <div className="card" style={{ width: '95%', maxWidth: '500px', padding: '0' }}>
            <div style={{ padding: '1.5rem 2rem', background: '#0f172a', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: '950', color: 'white', margin: 0 }}>Formato de Salida a Taller</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            
            <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ padding: '1.25rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '2px dashed #cbd5e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b' }}>ORDEN DE PRODUCCIÓN</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#7c3aed' }}>{selectedOrder?.internal_code}</span>
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '950', margin: '0.25rem 0' }}>{selectedOrder?.capas_proyectadas} Unidades</h3>
                <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#475569' }}>{selectedOrder?.brand}</p>
              </div>

              <div className="input-group">
                <label style={{ fontWeight: '800', fontSize: '0.75rem', color: '#64748b' }}>TALLER SATÉLITE RESPONSABLE</label>
                <select 
                  style={{ width: '100%', padding: '0.875rem', borderRadius: '10px', border: '2.5px solid #e2e8f0', fontWeight: '700' }}
                  value={assignment.workshop_id}
                  onChange={e => setAssignment({...assignment, workshop_id: e.target.value})}
                >
                  <option value="">Seleccione taller...</option>
                  {workshops.map(w => (
                    <option key={w.id} value={w.id}>{w.nombre_taller} ({w.responsable})</option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label style={{ fontWeight: '800', fontSize: '0.75rem', color: '#64748b' }}>FECHA COMPROMISO DE ENTREGA</label>
                <input 
                  type="date" 
                  style={{ width: '100%', padding: '0.875rem', borderRadius: '10px', border: '2.5px solid #e2e8f0' }}
                  value={assignment.scheduled_date}
                  onChange={e => setAssignment({...assignment, scheduled_date: e.target.value})}
                />
              </div>

              <div className="input-group">
                <label style={{ fontWeight: '800', fontSize: '0.75rem', color: '#64748b' }}>OBSERVACIONES / ACCESORIOS</label>
                <textarea 
                  placeholder="Incluye hilos, marquillas, cierres, etc."
                  style={{ width: '100%', padding: '0.875rem', borderRadius: '10px', border: '2.5px solid #e2e8f0', minHeight: '80px', fontSize: '0.875rem' }}
                  value={assignment.notes}
                  onChange={e => setAssignment({...assignment, notes: e.target.value})}
                />
              </div>

              <button 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '1rem', fontSize: '1rem', fontWeight: '950', backgroundColor: '#7c3aed', border: 'none' }}
                disabled={saving || !assignment.workshop_id}
                onClick={handleAssign}
              >
                {saving ? <Loader2 className="animate-spin" /> : <><Truck size={20} style={{ marginRight: '0.75rem' }} /> Formalizar Salida a Taller</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
