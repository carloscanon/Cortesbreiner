'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Scissors, 
  Clock, 
  User, 
  Layers, 
  CheckCircle, 
  AlertTriangle,
  ArrowLeft,
  Info,
  Save,
  Loader2,
  Calendar,
  Layers2
} from 'lucide-react';
import Link from 'next/link';

export default function CorteDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [cuts, setCuts] = useState<any[]>([]);
  const [fabrics, setFabrics] = useState<any[]>([]);
  const [noveltiesMaster, setNoveltiesMaster] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Resolution inputs for critical/medium novelties
  // Key format: "capa_tipo"
  const [resolutions, setResolutions] = useState<Record<string, { solucion: string; metros: string; observaciones: string }>>({});

  useEffect(() => {
    fetchOrders();
    fetchMasters();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['Tendido', 'Cortando', 'Cortado'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('Error fetching orders for cutting stage:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMasters = async () => {
    try {
      const { data: fData } = await supabase.from('fabrics').select('*');
      const { data: nData } = await supabase.from('novelties').select('*');
      setFabrics(fData || []);
      setNoveltiesMaster(nData || []);
    } catch (err) {
      console.error('Error fetching masters:', err);
    }
  };

  const loadOrderDetails = async (order: any) => {
    setLoading(true);
    setSelectedOrder(order);
    setResolutions({});
    try {
      const { data: cutsData, error: cutsErr } = await supabase
        .from('cuts')
        .select('*, cut_sizes(*)')
        .eq('order_id', order.id);
      if (cutsErr) throw cutsErr;
      setCuts(cutsData || []);
    } catch (err: any) {
      alert('Error al cargar detalles: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Parse novelties from observations
  const parseNovelties = (obs: string) => {
    if (!obs) return [];
    const lines = obs.split('\n');
    const list: { capa: string; tipo: string; criticidad: string; tela?: string }[] = [];

    lines.forEach(line => {
      // Try new format first: - Capa 5 - Novedad: Marra | Tela: JABON/CAFE
      const newRegex = /-\s*Capa\s+(\d+)\s*-\s*Novedad:\s*([^|]+?)(?:\s*\|\s*Tela:\s*(.+))?$/i;
      let match = line.match(newRegex);
      if (match) {
        const capa = match[1];
        const tipo = match[2].trim();
        const tela = match[3] ? match[3].trim() : 'General';
        
        const master = noveltiesMaster.find(
          n => n.nombre.toLowerCase().trim() === tipo.toLowerCase().trim()
        );
        const criticidad = master ? master.criticidad || 'Baja' : 'Baja';
        
        if (!list.some(item => item.capa === capa && item.tipo === tipo && item.tela === tela)) {
          list.push({ capa, tipo, criticidad, tela });
        }
      } else {
        // Fallback to old format: - Capa 5: Marra
        const oldRegex = /-\s*Capa\s+(\d+):\s*(.+)/i;
        match = line.match(oldRegex);
        if (match) {
          const capa = match[1];
          const tipo = match[2].trim();
          
          const master = noveltiesMaster.find(
            n => n.nombre.toLowerCase().trim() === tipo.toLowerCase().trim()
          );
          const criticidad = master ? master.criticidad || 'Baja' : 'Baja';
          
          if (!list.some(item => item.capa === capa && item.tipo === tipo)) {
            list.push({ capa, tipo, criticidad, tela: 'General' });
          }
        }
      }
    });
    return list;
  };

  const novelties = selectedOrder ? parseNovelties(selectedOrder.observaciones) : [];
  const criticalNovelties = novelties.filter(n => n.criticidad === 'Alta' || n.criticidad === 'Media');

  const handleResolveChange = (key: string, field: string, value: string) => {
    setResolutions(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || { solucion: '', metros: '', observaciones: '' }),
        [field]: value
      }
    }));
  };

  const handleFinishCuttingProcess = async () => {
    if (!selectedOrder) return;

    // Validate critical resolutions
    for (const cn of criticalNovelties) {
      const key = `${cn.capa}_${cn.tipo}`;
      const res = resolutions[key];
      if (!res || !res.solucion.trim() || !res.metros.trim() || !res.observaciones.trim()) {
        alert(`Por favor complete todos los datos de resolución para la novedad crítica en la Capa ${cn.capa} (${cn.tipo}).`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const timeStamp = new Date().toLocaleString('es-ES');
      let resolutionLog = `\n\n=== RESOLUCIÓN DE NOVEDADES EN CORTE (${timeStamp}) ===`;
      
      if (criticalNovelties.length > 0) {
        criticalNovelties.forEach(cn => {
          const key = `${cn.capa}_${cn.tipo}`;
          const res = resolutions[key];
          resolutionLog += `\n- Novedad Capa ${cn.capa} [${cn.tipo}] (Criticidad: ${cn.criticidad}):\n  * Solución: ${res.solucion}\n  * Tela gastada: ${res.metros} metros\n  * Reemplazo: ${res.observaciones}`;
        });
      } else {
        resolutionLog += '\n- No se presentaron novedades críticas que requirieran reposición.';
      }

      const finalObservations = (selectedOrder.observaciones || '') + resolutionLog;

      const { error } = await supabase
        .from('orders')
        .update({
          status: 'Cortado',
          observaciones: finalObservations
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      alert('¡Corte finalizado y registrado con éxito!');
      setSelectedOrder(null);
      fetchOrders();
    } catch (err: any) {
      alert('Error al finalizar el corte: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartCutting = async (orderId: string) => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'Cortando' })
        .eq('id', orderId);

      if (error) throw error;
      
      setSelectedOrder((prev: any) => ({ ...prev, status: 'Cortando' }));
      fetchOrders();
      alert('¡Proceso de corte iniciado para esta orden!');
    } catch (err: any) {
      alert('Error al iniciar el corte: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '3rem' }}>
      
      {/* Header */}
      {!selectedOrder ? (
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
            Etapa de Producción
          </span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '950', margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Scissors size={28} style={{ transform: 'rotate(-45deg)', color: 'var(--primary)' }} />
            Proceso de Corte Final
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Valida los tendidos completados, soluciona novedades críticas de tela y envía las órdenes a confección.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={() => setSelectedOrder(null)} style={{ padding: '0.6rem', borderRadius: '10px' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
              Proceso de Corte
            </span>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '950', margin: 0, color: '#0f172a' }}>
              Validación y Corte: OC-{selectedOrder.internal_code}
            </h1>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && !selectedOrder && (
        <div style={{ display: 'flex', padding: '5rem', justifyContent: 'center' }}>
          <Loader2 className="animate-spin" size={36} style={{ color: 'var(--primary)' }} />
        </div>
      )}

      {/* Dashboard Grid */}
      {!loading && !selectedOrder && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
          <div className="card" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', backgroundColor: '#f8fafc' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: '900', color: '#0f172a', margin: 0, textTransform: 'uppercase' }}>
                Órdenes listas para cortar
              </h3>
            </div>
            
            {orders.length === 0 ? (
              <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No hay órdenes pendientes de corte en este momento.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {orders.map(order => {
                  const isFinished = order.status === 'Cortado';
                  const isCutting = order.status === 'Cortando';
                  return (
                    <div 
                      key={order.id} 
                      style={{ 
                        padding: '1.25rem 1.5rem', 
                        borderBottom: '1px solid var(--border)', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        backgroundColor: isFinished ? '#f8fafc' : isCutting ? '#eff6ff' : 'white',
                        transition: 'background 0.2s'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontWeight: '800', fontSize: '0.95rem', color: '#1e293b' }}>
                            OC-{order.internal_code || order.id}
                          </span>
                          <span style={{ 
                            fontSize: '0.6875rem', 
                            padding: '0.2rem 0.5rem', 
                            borderRadius: '4px', 
                            fontWeight: '700',
                            backgroundColor: isFinished ? '#dcfce7' : isCutting ? '#dbeafe' : '#fef3c7',
                            color: isFinished ? '#15803d' : isCutting ? '#1d4ed8' : '#b45309'
                          }}>
                            {isFinished ? 'Cortado' : isCutting ? 'En Corte' : 'Listo para Corte'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#64748b' }}>
                          <span><strong>Cliente:</strong> {order.client_name || 'General'}</span>
                          <span><strong>Largo Trazo:</strong> {order.largo_trazo} cm</span>
                        </div>
                      </div>
                      
                      <button 
                        className={`btn ${isFinished ? 'btn-secondary' : isCutting ? 'btn-primary' : 'btn-primary'}`} 
                        onClick={() => loadOrderDetails(order)}
                        style={{ 
                          padding: '0.5rem 1.25rem', 
                          borderRadius: '8px',
                          backgroundColor: isFinished ? undefined : isCutting ? '#2563eb' : undefined
                        }}
                      >
                        {isFinished ? 'Ver Resumen' : isCutting ? 'Resolver y Cerrar' : 'Iniciar Corte'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selected Order Detail view */}
      {selectedOrder && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '2rem', alignItems: 'start' }}>
          
          {/* Left Side: Order Spreading Composition */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="card" style={{ padding: '2rem', borderRadius: '16px' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '950', color: '#0f172a', margin: '0 0 1.25rem 0' }}>
                Composición del Tendido en Mesa
              </h3>
              
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Corte (Trazo)</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Tela / Color</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Capas</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Kilos Reales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuts.map(cut => {
                      const fabricObj = fabrics.find(f => String(f.id) === String(cut.fabric_id));
                      const telaName = fabricObj ? fabricObj.nombre_tela : 'Tela Externa';
                      return (
                        <tr key={cut.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem' }}>
                          <td style={{ padding: '1rem', fontWeight: '700' }}>Corte ({cut.stroke_length} cm)</td>
                          <td style={{ padding: '1rem' }}>{telaName}</td>
                          <td style={{ padding: '1rem', fontWeight: '800', color: 'var(--primary)' }}>
                            {cut.layers_produced} / {cut.layers}
                          </td>
                          <td style={{ padding: '1rem', fontWeight: '700' }}>{cut.kilos} kg</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* General Observations Log */}
            <div className="card" style={{ padding: '2rem', borderRadius: '16px' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '950', color: '#0f172a', margin: '0 0 1rem 0' }}>
                Bitácora de Observaciones de la Orden
              </h3>
              <div style={{ 
                maxHeight: '300px', 
                overflowY: 'auto', 
                backgroundColor: '#f8fafc', 
                padding: '1.25rem', 
                borderRadius: '12px',
                border: '1.5px solid #e2e8f0',
                fontSize: '0.85rem',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
                color: '#334155'
              }}>
                {selectedOrder.observaciones || 'No hay observaciones registradas en esta orden.'}
              </div>
            </div>
          </div>

          {/* Right Side: Novelties Validation & Solutions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Title / Action Box */}
            <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', backgroundColor: '#fff', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '950', color: '#0f172a', margin: '0 0 1rem 0' }}>
                Control de Novedades Críticas
              </h3>

              {novelties.length === 0 ? (
                <div style={{ padding: '1.5rem 0', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>
                  <CheckCircle size={32} style={{ color: '#10b981', margin: '0 auto 0.75rem auto' }} />
                  ¡Sin novedades reportadas durante el tendido!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>
                    Novedades reportadas: <strong>{novelties.length}</strong>. Críticas/Medias: <strong>{criticalNovelties.length}</strong>.
                  </p>
                  {novelties.map((n, i) => (
                    <div 
                      key={i} 
                      style={{ 
                        padding: '0.75rem', 
                        borderRadius: '8px', 
                        border: '1px solid #e2e8f0', 
                        backgroundColor: n.criticidad === 'Alta' ? '#fef2f2' : n.criticidad === 'Media' ? '#fffbeb' : '#f8fafc',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span style={{ fontSize: '0.8rem', fontWeight: '800', display: 'flex', flexDirection: 'column' }}>
                        <span>Capa {n.capa}: {n.tipo}</span>
                        {n.tela && n.tela !== 'General' && (
                          <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 'normal', marginTop: '0.15rem' }}>
                            Tela: {n.tela}
                          </span>
                        )}
                      </span>
                      <span style={{ 
                        fontSize: '0.65rem', 
                        padding: '0.15rem 0.4rem', 
                        borderRadius: '4px', 
                        fontWeight: '800',
                        backgroundColor: n.criticidad === 'Alta' ? '#fecaca' : n.criticidad === 'Media' ? '#fde68a' : '#e2e8f0',
                        color: n.criticidad === 'Alta' ? '#991b1b' : n.criticidad === 'Media' ? '#92400e' : '#475569'
                      }}>
                        {n.criticidad}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Start Cutting button (Tendido state) */}
              {selectedOrder.status === 'Tendido' && (
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem' }}>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '1rem' }}>
                    Esta orden está lista y tendida. Haz clic abajo para iniciar el proceso de corte físico.
                  </p>
                  <button 
                    className="btn btn-primary"
                    disabled={submitting}
                    onClick={() => handleStartCutting(selectedOrder.id)}
                    style={{ 
                      width: '100%', 
                      padding: '1.25rem', 
                      justifyContent: 'center', 
                      fontSize: '0.9rem', 
                      fontWeight: '900',
                      backgroundColor: 'var(--primary)',
                      color: 'white',
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 4px 10px rgba(99, 102, 241, 0.3)'
                    }}
                  >
                    {submitting ? <Loader2 className="animate-spin" size={18} /> : <Scissors size={18} style={{ marginRight: '0.5rem', transform: 'rotate(-45deg)' }} />}
                    Iniciar Proceso de Corte
                  </button>
                </div>
              )}

              {/* Critical novelties Checklist Form (Cortando state) */}
              {selectedOrder.status === 'Cortando' && criticalNovelties.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem' }}>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: '900', color: '#0f172a', margin: 0, textTransform: 'uppercase' }}>
                    Solución de Novedades Requeridas
                  </h4>
                  
                  {criticalNovelties.map((cn, i) => {
                    const key = `${cn.capa}_${cn.tipo}`;
                    const res = resolutions[key] || { solucion: '', metros: '', observaciones: '' };
                    return (
                      <div key={i} style={{ border: '1px solid #cbd5e1', padding: '1rem', borderRadius: '12px', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '900', color: '#0f172a' }}>
                          📍 Capa {cn.capa}: {cn.tipo} ({cn.criticidad})
                        </div>
                        
                        <div>
                          <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#475569', marginBottom: '0.25rem' }}>Solución Dada</label>
                          <input 
                            type="text" 
                            placeholder="Ej. Se repuso la pieza dañada"
                            value={res.solucion}
                            onChange={e => handleResolveChange(key, 'solucion', e.target.value)}
                            style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1.5px solid #cbd5e1', fontSize: '0.75rem' }}
                          />
                        </div>
                        
                        <div>
                          <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#475569', marginBottom: '0.25rem' }}>Tela Gastada (Metros)</label>
                          <input 
                            type="number" 
                            step="0.01"
                            placeholder="Ej. 1.25"
                            value={res.metros}
                            onChange={e => handleResolveChange(key, 'metros', e.target.value)}
                            style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1.5px solid #cbd5e1', fontSize: '0.75rem' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#475569', marginBottom: '0.25rem' }}>Observación de Pieza Repuesta</label>
                          <textarea 
                            placeholder="Ej. Se cortó nuevamente el delantero derecho de la talla M..."
                            value={res.observaciones}
                            onChange={e => handleResolveChange(key, 'observaciones', e.target.value)}
                            style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1.5px solid #cbd5e1', fontSize: '0.75rem', minHeight: '50px', resize: 'vertical' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Action button (Cortando state) */}
              {selectedOrder.status === 'Cortando' && (
                <div style={{ marginTop: '1.5rem' }}>
                  <button 
                    className="btn btn-primary"
                    disabled={submitting}
                    onClick={handleFinishCuttingProcess}
                    style={{ 
                      width: '100%', 
                      padding: '1rem', 
                      justifyContent: 'center', 
                      fontSize: '0.9rem', 
                      fontWeight: '900',
                      backgroundColor: '#059669',
                      color: 'white',
                      borderRadius: '12px',
                      boxShadow: '0 4px 10px rgba(5, 150, 105, 0.3)',
                      border: 'none'
                    }}
                  >
                    {submitting ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} style={{ marginRight: '0.5rem' }} />}
                    Finalizar y Cerrar Corte
                  </button>
                </div>
              )}
            </div>
          </div>
          
        </div>
      )}

    </div>
  );
}
