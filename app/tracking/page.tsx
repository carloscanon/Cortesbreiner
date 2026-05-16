'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Package, Truck, CheckCircle, Clock, Search, Filter, 
  MessageSquare, Loader2, Save, Calendar, Scissors,
  Factory, AlertCircle, Layers
} from 'lucide-react';

export default function TrackingPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase
        .from('orders')
        .select(`
          *,
          workshops (nombre_taller),
          fabrics (nombre_tela)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setData(result || []);
    } catch (err: any) {
      console.error('Error fetching tracking orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id);
      
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      alert('Error al actualizar estado: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUpdateObservations = async (id: string, observations: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ observations })
        .eq('id', id);
      
      if (error) throw error;
    } catch (err: any) {
      console.error('Error updating observations:', err);
    }
  };

  const phases = ['Planeada', 'En Corte', 'Cortado', 'En Confección', 'Terminada', 'Cerrada'];

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'Planeada': return { border: '#bfdbfe', bg: '#eff6ff', color: '#2563eb', icon: <Clock size={16} /> };
      case 'En Corte': return { border: '#fef08a', bg: '#fefce8', color: '#a16207', icon: <Scissors size={16} /> };
      case 'Cortado': return { border: '#fed7aa', bg: '#fff7ed', color: '#ea580c', icon: <CheckCircle size={16} /> };
      case 'En Confección': return { border: '#ddd6fe', bg: '#f5f3ff', color: '#7c3aed', icon: <Factory size={16} /> };
      case 'Terminada': return { border: '#bbf7d0', bg: '#f0fdf4', color: '#16a34a', icon: <CheckCircle size={16} /> };
      case 'Enviada': return { border: '#ddd6fe', bg: '#f5f3ff', color: '#7c3aed', icon: <Truck size={16} /> };
      case 'Cerrada': return { border: '#e2e8f0', bg: '#f8fafc', color: '#64748b', icon: <Package size={16} /> };
      default: return { border: '#e2e8f0', bg: '#f8fafc', color: '#64748b', icon: <AlertCircle size={16} /> };
    }
  };

  const getPhaseIndex = (status: string) => phases.indexOf(status);

  const filteredData = data.filter(order => {
    const matchesSearch = 
      order.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      order.fabrics?.nombre_tela?.toLowerCase().includes(search.toLowerCase()) ||
      `oc-${order.consecutive?.toString().padStart(4, '0')}`.includes(search.toLowerCase());
    
    const matchesFilter = activeFilter === 'all' || order.status === activeFilter;
    
    return matchesSearch && matchesFilter;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Seguimiento Global de Producción</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Visualización interactiva y control de fases de producción.</p>
        </div>
      </div>

      <div className="card" style={{ padding: '0' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: '1rem', backgroundColor: '#f8fafc' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Buscar por código, cliente o tela..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 3rem', borderRadius: '10px', border: '1.5px solid var(--border)', fontSize: '0.875rem' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['all', 'En Corte', 'Cortado', 'En Confección', 'Terminada'].map(f => (
              <button 
                key={f}
                onClick={() => setActiveFilter(f)}
                className="btn"
                style={{ 
                  fontSize: '0.7rem', 
                  fontWeight: '700',
                  backgroundColor: activeFilter === f ? 'var(--primary)' : 'white',
                  color: activeFilter === f ? 'white' : 'var(--text)',
                  border: '1px solid var(--border)',
                  padding: '0.5rem 0.8rem',
                  cursor: 'pointer',
                  borderRadius: '6px'
                }}
              >
                {f === 'all' ? 'Ver Todas' : f}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <div style={{ padding: '5rem', textAlign: 'center' }}><Loader2 className="animate-spin" /></div>
          ) : filteredData.length === 0 ? (
            <div style={{ padding: '5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Package size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
              <p>No se encontraron órdenes de corte registradas.</p>
            </div>
          ) : (
            filteredData.map((order) => {
              const currentStyle = getStatusStyle(order.status);
              const currentPhaseIndex = getPhaseIndex(order.status);

              return (
                <div key={order.id} style={{ padding: '2.5rem', borderBottom: '1px solid var(--border)', transition: 'all 0.2s' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                    {/* Detalles de la Orden */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.8rem' }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: '800', backgroundColor: 'var(--primary)', color: 'white', padding: '0.3rem 0.75rem', borderRadius: '6px' }}>
                          OC-{order.consecutive?.toString().padStart(4, '0')}
                        </span>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '700' }}>{order.client_name}</h3>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Factory size={16} /> Taller: <strong style={{ color: 'var(--text)' }}>{order.workshops?.nombre_taller || 'Pendiente de Asignación'}</strong>
                        </p>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Scissors size={16} /> Tela: <strong style={{ color: 'var(--text)' }}>{order.fabrics?.nombre_tela}</strong>
                        </p>
                      </div>
                    </div>

                    {/* Gestión de Estado */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '0.6rem', textTransform: 'uppercase' }}>Actualizar Fase</label>
                      <div style={{ position: 'relative' }}>
                        <select 
                          value={order.status}
                          onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                          disabled={updatingId === order.id}
                          style={{ 
                            width: '100%', 
                            padding: '0.875rem 1rem', 
                            borderRadius: '12px', 
                            border: '2px solid',
                            borderColor: currentStyle.border,
                            backgroundColor: currentStyle.bg,
                            fontWeight: '800',
                            fontSize: '0.9375rem',
                            color: currentStyle.color,
                            cursor: 'pointer',
                            appearance: 'none',
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
                          }}
                        >
                          <option value="Planeada">⏳ Planeada</option>
                          <option value="En Corte">✂️ En Corte</option>
                          <option value="Cortado">📏 Cortado</option>
                          <option value="En Confección">🧵 En Confección</option>
                          <option value="Terminada">✅ Terminada</option>
                          <option value="Enviada">🚚 Enviada</option>
                          <option value="Cerrada">🔒 Cerrada</option>
                        </select>
                        {updatingId === order.id && <Loader2 size={16} className="animate-spin" style={{ position: 'absolute', right: '1rem', top: '35%' }} />}
                      </div>
                    </div>

                    {/* Capas y Progresión */}
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>CAPAS PROYECTADAS</p>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: '0.25rem' }}>
                        <p style={{ fontSize: '2.5rem', fontWeight: '800', lineHeight: 1, color: 'var(--primary)' }}>{order.capas_proyectadas}</p>
                        <Layers size={20} style={{ color: 'var(--text-muted)' }} />
                      </div>
                    </div>
                  </div>

                  {/* LÍNEA DE PROGRESO DINÁMICA */}
                  <div style={{ marginBottom: '2.5rem', padding: '0 1rem' }}>
                    <div style={{ position: 'relative', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {/* Línea de progreso coloreada */}
                      <div style={{ 
                        position: 'absolute', 
                        left: 0, 
                        top: 0, 
                        height: '100%', 
                        width: `${(currentPhaseIndex / (phases.length - 1)) * 100}%`, 
                        backgroundColor: currentStyle.color, 
                        borderRadius: '4px',
                        transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                      }} />

                      {phases.map((phase, idx) => {
                        const isCompleted = idx <= currentPhaseIndex;
                        const isCurrent = idx === currentPhaseIndex;
                        const style = getStatusStyle(phase);

                        return (
                          <div key={phase} style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ 
                              width: '24px', 
                              height: '24px', 
                              borderRadius: '50%', 
                              backgroundColor: isCompleted ? style.color : 'white',
                              border: `3px solid ${isCompleted ? style.color : '#cbd5e1'}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              transition: 'all 0.3s',
                              boxShadow: isCurrent ? `0 0 0 4px ${style.bg}` : 'none'
                            }}>
                              {isCompleted && <CheckCircle size={14} />}
                            </div>
                            <span style={{ 
                              position: 'absolute', 
                              top: '30px', 
                              fontSize: '0.6875rem', 
                              fontWeight: isCurrent ? '800' : '600', 
                              whiteSpace: 'nowrap',
                              color: isCurrent ? style.color : 'var(--text-muted)',
                              transition: 'all 0.3s'
                            }}>
                              {phase}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Observaciones Generales */}
                  <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px solid var(--border)' }}>
                    <div style={{ color: 'var(--primary)', marginTop: '0.2rem' }}><MessageSquare size={20} /></div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '800', marginBottom: '0.6rem', color: 'var(--primary)' }}>Bitácora de Seguimiento</label>
                      <textarea 
                        placeholder="Novedades de la orden..."
                        defaultValue={order.observations}
                        onBlur={(e) => handleUpdateObservations(order.id, e.target.value)}
                        style={{ 
                          width: '100%', 
                          padding: '0.5rem', 
                          borderRadius: '8px', 
                          border: '1px solid transparent', 
                          backgroundColor: 'transparent',
                          fontSize: '0.9375rem',
                          minHeight: '60px',
                          resize: 'vertical',
                          outline: 'none',
                          color: 'var(--text)'
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
