'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Scissors, 
  Clock, 
  User, 
  Layers, 
  Weight, 
  Play, 
  CheckCircle, 
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  Search,
  BookOpen
} from 'lucide-react';
import Link from 'next/link';

export default function CuttingDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'Planeada' | 'En Corte' | 'Cortado'>('all');

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('scheduled_date', { ascending: true });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('Error fetching orders for cutter:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleStartCut = async (id: number) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'En Corte' })
        .eq('id', id);

      if (error) throw error;
      fetchOrders();
    } catch (err: any) {
      alert('Error al iniciar el corte: ' + err.message);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.internal_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.cortador_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.brand?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = 
      filterStatus === 'all' 
        ? ['Planeada', 'En Corte', 'Cortado'].includes(order.status)
        : order.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const stats = {
    pending: orders.filter(o => o.status === 'Planeada').length,
    active: orders.filter(o => o.status === 'En Corte').length,
    completedToday: orders.filter(o => o.status === 'Cortado').length
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1rem 0' }}>
      
      {/* Banner / Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)',
        padding: '2rem',
        borderRadius: '16px',
        color: 'white',
        boxShadow: '0 10px 25px -5px rgba(16, 68, 51, 0.2)'
      }}>
        <div>
          <h1 style={{ 
            fontSize: '2rem', 
            fontWeight: '950', 
            margin: 0, 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.75rem',
            letterSpacing: '-0.025em',
            color: 'white'
          }}>
            <Scissors size={32} style={{ transform: 'rotate(-45deg)', color: 'var(--secondary)' }} />
            Mesa de Corte Industrial
          </h1>
          <p style={{ opacity: 0.9, fontSize: '0.9rem', marginTop: '0.5rem', fontWeight: '500' }}>
            Panel de control para cortadores. Gestiona el extendido, trazo y corte físico en el taller.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ textAlign: 'center', backgroundColor: 'white', padding: '0.75rem 1.25rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
            <span style={{ fontSize: '0.75rem', color: '#0f172a', fontWeight: '700', textTransform: 'uppercase' }}>Pendientes</span>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '900', margin: 0, color: '#93c5fd' }}>{stats.pending}</h3>
          </div>
          <div style={{ textAlign: 'center', backgroundColor: 'white', padding: '0.75rem 1.25rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
            <span style={{ fontSize: '0.75rem', color: '#0f172a', fontWeight: '700', textTransform: 'uppercase' }}>En Mesa</span>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '900', margin: 0, color: '#fde047' }}>{stats.active}</h3>
          </div>
          <div style={{ textAlign: 'center', backgroundColor: 'white', padding: '0.75rem 1.25rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
            <span style={{ fontSize: '0.75rem', color: '#0f172a', fontWeight: '700', textTransform: 'uppercase' }}>Cortadas</span>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '900', margin: 0, color: '#86efac' }}>{stats.completedToday}</h3>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        backgroundColor: 'white', 
        padding: '1.25rem', 
        borderRadius: '14px', 
        border: '1.5px solid #e2e8f0',
        gap: '1.5rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ display: 'flex', gap: '0.75rem', flex: 1 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              type="text" 
              placeholder="Buscar por código, cortador o marca..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '0.75rem 1rem 0.75rem 2.75rem', 
                borderRadius: '10px', 
                border: '1.5px solid #cbd5e1', 
                fontSize: '0.9rem',
                fontWeight: '600'
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: '#f1f5f9', padding: '0.25rem', borderRadius: '10px' }}>
          {[
            { id: 'all', label: 'Todos los Estados' },
            { id: 'Planeada', label: 'Pendientes' },
            { id: 'En Corte', label: 'En Mesa' },
            { id: 'Cortado', label: 'Completados' }
          ].map(opt => (
            <button 
              key={opt.id}
              onClick={() => setFilterStatus(opt.id as any)}
              style={{ 
                padding: '0.5rem 1rem', 
                borderRadius: '8px', 
                border: 'none', 
                fontWeight: '800', 
                fontSize: '0.8rem',
                cursor: 'pointer',
                backgroundColor: filterStatus === opt.id ? 'white' : 'transparent',
                color: filterStatus === opt.id ? 'var(--primary)' : '#64748b',
                boxShadow: filterStatus === opt.id ? '0 1px 3px 0 rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem' }}>
          <div style={{ 
            border: '4px solid #f3f3f3', 
            borderTop: '4px solid var(--primary)', 
            borderRadius: '50%', 
            width: '40px', 
            height: '40px', 
            animation: 'spin 1s linear infinite' 
          }}></div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '4rem 2rem', 
          backgroundColor: '#f8fafc', 
          borderRadius: '16px', 
          border: '2px dashed #e2e8f0',
          color: '#64748b'
        }}>
          <Scissors size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <h3 style={{ fontWeight: '800', fontSize: '1.25rem', color: '#334155' }}>No hay órdenes pendientes</h3>
          <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>No se encontraron órdenes de corte que coincidan con la búsqueda o el filtro.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1.5rem' }}>
          {filteredOrders.map(order => {
            const isPriorityHigh = order.priority === 'Alta';
            const isPending = order.status === 'Planeada';
            const isActive = order.status === 'En Corte';
            const isCompleted = order.status === 'Cortado';

            return (
              <div 
                key={order.id} 
                className="card" 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between',
                  border: isPriorityHigh ? '2px solid #fecaca' : isActive ? '2px solid #fef08a' : '1.5px solid #e2e8f0',
                  boxShadow: isActive ? '0 10px 15px -3px rgba(250, 204, 21, 0.1)' : '0 4px 6px -1px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s ease',
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Priority ribbon/indicator */}
                {isPriorityHigh && (
                  <div style={{ 
                    position: 'absolute', 
                    top: 0, 
                    right: 0, 
                    backgroundColor: '#ef4444', 
                    color: 'white', 
                    fontSize: '0.65rem', 
                    fontWeight: '900', 
                    padding: '0.25rem 1rem', 
                    borderRadius: '0 0 0 10px',
                    textTransform: 'uppercase'
                  }}>
                    Prioridad Alta
                  </div>
                )}

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: '800', 
                      backgroundColor: isPending ? '#e2e8f0' : isActive ? '#fffbeb' : '#ecfdf5',
                      color: isPending ? '#475569' : isActive ? '#b45309' : '#047857',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '8px',
                      textTransform: 'uppercase'
                    }}>
                      {order.status === 'Planeada' ? 'Pendiente' : order.status === 'En Corte' ? 'En Mesa' : 'Completado'}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock size={14} />
                      {order.scheduled_date || 'Sin fecha'}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.25rem', fontWeight: '950', color: '#0f172a', margin: '0 0 0.5rem 0' }}>
                    OC-{order.internal_code}
                  </h3>
                  
                  {order.brand && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '800', textTransform: 'uppercase', margin: '0 0 1rem 0' }}>
                      {order.brand}
                    </p>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <User size={16} style={{ color: '#64748b' }} />
                      <div>
                        <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: 0, textTransform: 'uppercase', fontWeight: '700' }}>Cortador</p>
                        <p style={{ fontSize: '0.8rem', fontWeight: '700', color: '#334155', margin: 0 }}>{order.cortador_name || 'No asignado'}</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Layers size={16} style={{ color: '#64748b' }} />
                      <div>
                        <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: 0, textTransform: 'uppercase', fontWeight: '700' }}>Capas Prog.</p>
                        <p style={{ fontSize: '0.8rem', fontWeight: '700', color: '#334155', margin: 0 }}>{order.capas_proyectadas || '0'}</p>
                      </div>
                    </div>
                  </div>

                  {order.observaciones && (
                    <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
                      <p style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem', margin: '0 0 0.25rem 0' }}>
                        <BookOpen size={12} />
                        Instrucciones de Corte
                      </p>
                      <p style={{ fontSize: '0.75rem', color: '#475569', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: '1.4' }}>
                        {order.observaciones}
                      </p>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
                  {isPending && (
                    <button 
                      onClick={() => handleStartCut(order.id)}
                      className="btn btn-secondary" 
                      style={{ 
                        flex: 1, 
                        justifyContent: 'center', 
                        fontSize: '0.85rem', 
                        padding: '0.75rem',
                        fontWeight: '800',
                        backgroundColor: '#eff6ff',
                        color: '#2563eb',
                        border: '1.5px solid #bfdbfe'
                      }}
                    >
                      <Play size={16} style={{ marginRight: '0.5rem' }} /> Iniciar Trabajo
                    </button>
                  )}

                  <Link 
                    href={`/cutting/${order.id}`} 
                    className="btn btn-primary" 
                    style={{ 
                      flex: isPending ? 0.7 : 1, 
                      justifyContent: 'center', 
                      fontSize: '0.85rem', 
                      padding: '0.75rem',
                      fontWeight: '800',
                      backgroundColor: isCompleted ? '#ecfdf5' : 'var(--primary)',
                      color: isCompleted ? '#059669' : 'white',
                      border: isCompleted ? '1.5px solid #a7f3d0' : 'none'
                    }}
                  >
                    {isCompleted ? (
                      <>
                        <CheckCircle size={16} style={{ marginRight: '0.5rem' }} />
                        Ver Resumen
                      </>
                    ) : (
                      <>
                        Ver Ficha Físico
                        <ChevronRight size={16} style={{ marginLeft: '0.25rem' }} />
                      </>
                    )}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
