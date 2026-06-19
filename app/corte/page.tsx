'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { syncOrderMovements } from '@/lib/inventory-sync';
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
  Layers2,
  BarChart3,
  FileText
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
  const [reconciliationOrder, setReconciliationOrder] = useState<any>(null);
  const [reconciliationCuts, setReconciliationCuts] = useState<any[]>([]);
  const [reconciliationLoading, setReconciliationLoading] = useState(false);
  const [reconciliationProducts, setReconciliationProducts] = useState<any[]>([]);
  const [reconciliationCategories, setReconciliationCategories] = useState<any[]>([]);

  // Resolution inputs for critical/medium novelties
  // Key format: "capa_tipo"
  const [resolutions, setResolutions] = useState<Record<string, { solucion: string; metros: string; observaciones: string; telaId?: string }>>({});

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

  const uniqueCutsFabrics = selectedOrder
    ? Array.from(new Set(cuts.map(c => String(c.fabric_id)))).map(fabId => {
        const fabricObj = fabrics.find(f => String(f.id) === fabId);
        return {
          id: fabId,
          nombre: fabricObj ? fabricObj.nombre_tela : 'Tela Externa'
        };
      })
    : [];

  const handleResolveChange = (key: string, field: string, value: string) => {
    setResolutions(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || { solucion: '', metros: '', observaciones: '', telaId: '' }),
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
      if (!res || !res.solucion.trim() || !res.metros.trim() || !res.observaciones.trim() || !res.telaId) {
        alert(`Por favor complete todos los datos de resolución para la novedad crítica en la Capa ${cn.capa} (${cn.tipo}), incluyendo la selección de la tela de reposición.`);
        return;
      }
      if (parseFloat(res.metros) > 1) {
        alert(`El total de tela gastada no puede superar 1 metro para resolver la novedad en la Capa ${cn.capa}.`);
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
          const fabricObj = fabrics.find(f => String(f.id) === String(res.telaId));
          const fabricName = fabricObj ? fabricObj.nombre_tela : 'Tela Externa';
          resolutionLog += `\n- Novedad Capa ${cn.capa} [${cn.tipo}] (Criticidad: ${cn.criticidad}):\n  * Solución: ${res.solucion}\n  * Tela de reposición: ${fabricName} (ID: ${res.telaId})\n  * Tela gastada: ${res.metros} metros\n  * Reemplazo: ${res.observaciones}`;
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

      await syncOrderMovements(selectedOrder.id, 'Cortado');

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

      await syncOrderMovements(orderId, 'Cortando');
      
      setSelectedOrder((prev: any) => ({ ...prev, status: 'Cortando' }));
      fetchOrders();
      alert('¡Proceso de corte iniciado para esta orden!');
    } catch (err: any) {
      alert('Error al iniciar el corte: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const loadReconciliation = async (order: any) => {
    setReconciliationLoading(true);
    setReconciliationOrder(order);
    setReconciliationProducts([]);
    setReconciliationCategories([]);
    try {
      const { data: cutsData, error } = await supabase
        .from('cuts')
        .select('*, cut_sizes(*)')
        .eq('order_id', order.id);
      if (error) throw error;
      setReconciliationCuts(cutsData || []);

      // Fetch products and categories for category breakdown
      const { data: prodData } = await supabase.from('products').select('*');
      const { data: catData } = await supabase.from('categories').select('*');
      setReconciliationProducts(prodData || []);
      setReconciliationCategories(catData || []);
    } catch (err: any) {
      alert('Error al cargar informe: ' + err.message);
    } finally {
      setReconciliationLoading(false);
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
      {!loading && !selectedOrder && !reconciliationOrder && (
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
                      
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {isFinished && (
                          <button
                            className="btn"
                            onClick={() => loadReconciliation(order)}
                            style={{
                              padding: '0.5rem 1rem',
                              borderRadius: '8px',
                              backgroundColor: '#0f172a',
                              color: 'white',
                              border: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              fontSize: '0.8rem',
                              fontWeight: '700'
                            }}
                          >
                            <BarChart3 size={14} />
                            Conciliación
                          </button>
                        )}
                        <button 
                          className={`btn ${isFinished ? 'btn-secondary' : 'btn-primary'}`} 
                          onClick={() => loadOrderDetails(order)}
                          style={{ 
                            padding: '0.5rem 1.25rem', 
                            borderRadius: '8px',
                            backgroundColor: isFinished ? undefined : isCutting ? '#2563eb' : undefined
                          }}
                        >
                          {isFinished ? 'Ver Detalle' : isCutting ? 'Resolver y Cerrar' : 'Iniciar Corte'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reconciliation Report View */}
      {reconciliationOrder && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Reconciliation Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              className="btn btn-secondary"
              onClick={() => { setReconciliationOrder(null); setReconciliationCuts([]); }}
              style={{ padding: '0.6rem', borderRadius: '10px' }}
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
                Informe de Conciliación
              </span>
              <h1 style={{ fontSize: '1.75rem', fontWeight: '950', margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <BarChart3 size={26} style={{ color: '#0f172a' }} />
                OC-{reconciliationOrder.internal_code} — Proyectado vs. Real
              </h1>
            </div>
          </div>

          {reconciliationLoading ? (
            <div style={{ display: 'flex', padding: '5rem', justifyContent: 'center' }}>
              <Loader2 className="animate-spin" size={36} style={{ color: 'var(--primary)' }} />
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                {(() => {
                  const totalCapasProyectadas = reconciliationCuts.reduce((sum, c) => sum + (c.layers || 0), 0);
                  const totalCapasReales = reconciliationCuts.reduce((sum, c) => sum + (c.layers_produced || 0), 0);
                  const totalKilos = reconciliationCuts.reduce((sum, c) => sum + (parseFloat(c.kilos) || 0), 0);
                  const difCapas = totalCapasReales - totalCapasProyectadas;
                  // sz.quantity is already total pieces (per-layer-pieces × projected-layers)
                  const totalPrendasProyec = reconciliationCuts.reduce((sum, c) => {
                    return sum + (c.cut_sizes || []).reduce((s: number, cs: any) => s + (Number(cs.quantity) || 0), 0);
                  }, 0);
                  const totalPrendasReales = reconciliationCuts.reduce((sum, c) => {
                    const layers = c.layers || 1;
                    const layersReal = c.layers_produced || 0;
                    return sum + (c.cut_sizes || []).reduce((s: number, cs: any) => {
                      const piezasPorCapa = (Number(cs.quantity) || 0) / layers;
                      return s + Math.round(piezasPorCapa * layersReal);
                    }, 0);
                  }, 0);
                  const difPrendas = totalPrendasReales - totalPrendasProyec;
                  return (
                    <>
                      <div className="card" style={{ padding: '1.25rem', borderRadius: '14px', borderLeft: '4px solid #6366f1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Capas</p>
                          <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: 0 }}>Proyectadas vs. Reales</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: '1.75rem', fontWeight: '900', color: '#6366f1', margin: 0, lineHeight: 1 }}>{totalCapasProyectadas}</p>
                          <p style={{ fontSize: '1.25rem', fontWeight: '800', color: '#10b981', margin: 0 }}>{totalCapasReales} <span style={{ fontSize: '0.7rem', color: difCapas < 0 ? '#dc2626' : '#10b981' }}>({difCapas > 0 ? '+' : ''}{difCapas})</span></p>
                        </div>
                      </div>
                      <div className="card" style={{ padding: '1.25rem', borderRadius: '14px', borderLeft: '4px solid #f59e0b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Prendas</p>
                          <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: 0 }}>Estimadas vs. Confeccionadas</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: '1.75rem', fontWeight: '900', color: '#f59e0b', margin: 0, lineHeight: 1 }}>{totalPrendasProyec}</p>
                          <p style={{ fontSize: '1.25rem', fontWeight: '800', color: '#10b981', margin: 0 }}>{totalPrendasReales} <span style={{ fontSize: '0.7rem', color: difPrendas < 0 ? '#dc2626' : '#10b981' }}>({difPrendas > 0 ? '+' : ''}{difPrendas})</span></p>
                        </div>
                      </div>
                      <div className="card" style={{ padding: '1.25rem', borderRadius: '14px', borderLeft: '4px solid #0ea5e9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total Kilos</p>
                          <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: 0 }}>Registrados en corte</p>
                        </div>
                        <p style={{ fontSize: '1.75rem', fontWeight: '900', color: '#0ea5e9', margin: 0 }}>{totalKilos.toFixed(2)} kg</p>
                      </div>
                      <div className="card" style={{ padding: '1.25rem', borderRadius: '14px', borderLeft: `4px solid ${difPrendas < 0 ? '#ef4444' : '#10b981'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Eficiencia de Corte</p>
                          <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: 0 }}>Prendas reales / estimadas</p>
                        </div>
                        <p style={{ fontSize: '1.75rem', fontWeight: '900', color: difPrendas < 0 ? '#ef4444' : '#10b981', margin: 0 }}>
                          {totalPrendasProyec > 0 ? ((totalPrendasReales / totalPrendasProyec) * 100).toFixed(1) : '—'}%
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Per-cut table */}
              <div className="card" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <FileText size={18} style={{ color: '#64748b' }} />
                  <h3 style={{ fontSize: '0.9rem', fontWeight: '900', color: '#0f172a', margin: 0, textTransform: 'uppercase' }}>
                    Detalle por Trazo / Tela
                  </h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                        {['Trazo', 'Tela / Color', 'Largo (Mts)', 'Capas Proy.', 'Capas Reales', 'Δ Capas', 'Prendas Proy.', 'Prendas Reales', 'Δ Prendas', 'Kilos', 'Eficiencia'].map(h => (
                          <th key={h} style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reconciliationCuts.map((cut, idx) => {
                        const fabricObj = fabrics.find(f => String(f.id) === String(cut.fabric_id));
                        const telaName = fabricObj ? fabricObj.nombre_tela : 'Tela Externa';
                        const capasProyec = cut.layers || 0;
                        const capasReal = cut.layers_produced || 0;
                        const diffCapas = capasReal - capasProyec;
                        // sz.quantity = total prendas ya multiplicadas por capas proyectadas
                        const prendasProyec = (cut.cut_sizes || []).reduce((s: number, cs: any) => s + (Number(cs.quantity) || 0), 0);
                        const prendasReales = (cut.cut_sizes || []).reduce((s: number, cs: any) => {
                          const piezasPorCapa = capasProyec > 0 ? (Number(cs.quantity) || 0) / capasProyec : 0;
                          return s + Math.round(piezasPorCapa * capasReal);
                        }, 0);
                        const diffPrendas = prendasReales - prendasProyec;
                        const eficiencia = capasProyec > 0 ? ((capasReal / capasProyec) * 100).toFixed(1) : '—';
                        return (
                          <tr key={cut.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                            <td style={{ padding: '1rem', fontWeight: '700', fontSize: '0.85rem' }}>Corte {idx + 1}</td>
                            <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                              <span style={{ fontWeight: '700' }}>{telaName}</span>
                            </td>
                            <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{Number(cut.stroke_length).toFixed(2)} mts</td>
                            <td style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: '700', color: '#6366f1' }}>{capasProyec}</td>
                            <td style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: '700', color: '#10b981' }}>{capasReal}</td>
                            <td style={{ padding: '1rem' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: '800', padding: '0.2rem 0.6rem', borderRadius: '5px',
                                backgroundColor: diffCapas < 0 ? '#fef2f2' : diffCapas > 0 ? '#fffbeb' : '#f0fdf4',
                                color: diffCapas < 0 ? '#dc2626' : diffCapas > 0 ? '#d97706' : '#16a34a' }}>
                                {diffCapas > 0 ? '+' : ''}{diffCapas}
                              </span>
                            </td>
                            <td style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: '700', color: '#6366f1' }}>{prendasProyec}</td>
                            <td style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: '700', color: '#10b981' }}>{prendasReales}</td>
                            <td style={{ padding: '1rem' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: '800', padding: '0.2rem 0.6rem', borderRadius: '5px',
                                backgroundColor: diffPrendas < 0 ? '#fef2f2' : diffPrendas > 0 ? '#fffbeb' : '#f0fdf4',
                                color: diffPrendas < 0 ? '#dc2626' : diffPrendas > 0 ? '#d97706' : '#16a34a' }}>
                                {diffPrendas > 0 ? '+' : ''}{diffPrendas}
                              </span>
                            </td>
                            <td style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: '700' }}>{parseFloat(cut.kilos || 0).toFixed(2)} kg</td>
                            <td style={{ padding: '1rem' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: '800', padding: '0.2rem 0.6rem', borderRadius: '5px',
                                backgroundColor: parseFloat(eficiencia) >= 100 ? '#f0fdf4' : parseFloat(eficiencia) >= 80 ? '#fffbeb' : '#fef2f2',
                                color: parseFloat(eficiencia) >= 100 ? '#16a34a' : parseFloat(eficiencia) >= 80 ? '#d97706' : '#dc2626' }}>
                                {eficiencia}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Parallel: Size + Category breakdown */}
              {reconciliationCuts.some(c => c.cut_sizes && c.cut_sizes.length > 0) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>

                  {/* ── LEFT: Distribución por Talla ── */}
                  <div className="card" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden' }}>
                    <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#6366f1' }} />
                      <h3 style={{ fontSize: '0.82rem', fontWeight: '900', color: '#0f172a', margin: 0, textTransform: 'uppercase' }}>
                        Distribución por Talla
                      </h3>
                    </div>
                    <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {(() => {
                        // Aggregate all tallas across all cuts
                        const sizeMap: Record<string, { proyec: number; real: number }> = {};
                        reconciliationCuts.forEach(cut => {
                          const capasProyec = cut.layers || 1;
                          const capasReal = cut.layers_produced || 0;
                          (cut.cut_sizes || []).forEach((sz: any) => {
                            const key = sz.size || sz.codigo_talla || 'S/T';
                            if (!sizeMap[key]) sizeMap[key] = { proyec: 0, real: 0 };
                            const proyec = Number(sz.quantity) || 0;
                            const piezasPorCapa = proyec / capasProyec;
                            sizeMap[key].proyec += proyec;
                            sizeMap[key].real += Math.round(piezasPorCapa * capasReal);
                          });
                        });
                        return Object.entries(sizeMap).map(([size, data]) => {
                          const diff = data.real - data.proyec;
                          const pct = data.proyec > 0 ? (data.real / data.proyec) * 100 : 0;
                          return (
                            <div key={size}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.3rem' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#0f172a' }}>Talla {size}</span>
                                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                  <span style={{ color: '#6366f1', fontWeight: '800' }}>{data.proyec}</span>
                                  {' → '}
                                  <span style={{ color: '#10b981', fontWeight: '800' }}>{data.real}</span>
                                  {diff !== 0 && (
                                    <span style={{ marginLeft: '0.3rem', fontSize: '0.65rem', fontWeight: '800', color: diff < 0 ? '#dc2626' : '#16a34a' }}>
                                      ({diff > 0 ? '+' : ''}{diff})
                                    </span>
                                  )}
                                </span>
                              </div>
                              <div style={{ height: '6px', backgroundColor: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, backgroundColor: pct >= 100 ? '#10b981' : pct >= 80 ? '#f59e0b' : '#ef4444', borderRadius: '99px', transition: 'width 0.4s' }} />
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* ── RIGHT: Distribución por Categoría ── */}
                  <div className="card" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden' }}>
                    <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                      <h3 style={{ fontSize: '0.82rem', fontWeight: '900', color: '#0f172a', margin: 0, textTransform: 'uppercase' }}>
                        Distribución por Categoría
                      </h3>
                    </div>
                    <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {(() => {
                        // Build: catMap[catKey] = { nombre, sizes: { [size]: { proyec, real } }, totalProyec, totalReal }
                        const colors = ['#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#10b981'];
                        const catMap: Record<string, { nombre: string; color: string; sizes: Record<string, { proyec: number; real: number }>; totalProyec: number; totalReal: number }> = {};
                        let colorIdx = 0;

                        reconciliationCuts.forEach(cut => {
                          const capasProyec = cut.layers || 1;
                          const capasReal = cut.layers_produced || 0;
                          const prod = reconciliationProducts.find((p: any) => String(p.id) === String(cut.product_id));
                          const cat = prod ? reconciliationCategories.find((c: any) => String(c.id) === String(prod.category_id)) : null;
                          const catKey = cat ? String(cat.id) : 'sin_cat';
                          const catNombre = cat ? (cat.categoria || 'Sin Categoría') : 'Sin Categoría';

                          if (!catMap[catKey]) {
                            catMap[catKey] = { nombre: catNombre, color: colors[colorIdx++ % colors.length], sizes: {}, totalProyec: 0, totalReal: 0 };
                          }

                          (cut.cut_sizes || []).forEach((cs: any) => {
                            const sizeKey = cs.size || cs.codigo_talla || 'S/T';
                            if (!catMap[catKey].sizes[sizeKey]) catMap[catKey].sizes[sizeKey] = { proyec: 0, real: 0 };
                            const proyec = Number(cs.quantity) || 0;
                            const ppc = proyec / capasProyec;
                            const real = Math.round(ppc * capasReal);
                            catMap[catKey].sizes[sizeKey].proyec += proyec;
                            catMap[catKey].sizes[sizeKey].real += real;
                            catMap[catKey].totalProyec += proyec;
                            catMap[catKey].totalReal += real;
                          });
                        });

                        const entries = Object.entries(catMap);
                        if (entries.length === 0) {
                          return (
                            <p style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', padding: '1rem' }}>
                              Sin categorías asignadas a los cortes.
                            </p>
                          );
                        }

                        return entries.map(([catKey, data]) => {
                          const diff = data.totalReal - data.totalProyec;
                          const pct = data.totalProyec > 0 ? (data.totalReal / data.totalProyec) * 100 : 0;
                          const barColor = pct >= 100 ? '#10b981' : pct >= 80 ? '#f59e0b' : '#ef4444';

                          return (
                            <div key={catKey} style={{ borderRadius: '12px', border: `1.5px solid ${data.color}30`, overflow: 'hidden' }}>
                              {/* Category header */}
                              <div style={{ padding: '0.75rem 1rem', backgroundColor: `${data.color}10`, borderBottom: `1px solid ${data.color}25`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: '900', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: data.color, display: 'inline-block' }} />
                                  {data.nombre}
                                </span>
                                <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                                  <span style={{ color: data.color, fontWeight: '800' }}>{data.totalProyec}</span>
                                  {' → '}
                                  <span style={{ color: '#10b981', fontWeight: '800' }}>{data.totalReal}</span>
                                  {diff !== 0 && (
                                    <span style={{ marginLeft: '0.3rem', fontSize: '0.65rem', fontWeight: '800', color: diff < 0 ? '#dc2626' : '#16a34a' }}>
                                      ({diff > 0 ? '+' : ''}{diff})
                                    </span>
                                  )}
                                </span>
                              </div>

                              {/* Efficiency bar */}
                              <div style={{ height: '4px', backgroundColor: '#f1f5f9' }}>
                                <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, backgroundColor: barColor, transition: 'width 0.4s' }} />
                              </div>

                              {/* Size breakdown grid */}
                              <div style={{ padding: '0.75rem 1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {Object.entries(data.sizes).map(([size, szData]) => {
                                  const szDiff = szData.real - szData.proyec;
                                  return (
                                    <div key={size} style={{
                                      flex: '1 0 auto', minWidth: '70px', textAlign: 'center',
                                      padding: '0.5rem 0.4rem', borderRadius: '8px',
                                      backgroundColor: szDiff < 0 ? '#fef2f2' : szDiff === 0 ? '#f8fafc' : '#f0fdf4',
                                      border: `1px solid ${szDiff < 0 ? '#fecaca' : szDiff === 0 ? '#e2e8f0' : '#bbf7d0'}`
                                    }}>
                                      <p style={{ fontSize: '0.6rem', fontWeight: '900', color: '#64748b', margin: '0 0 0.25rem', textTransform: 'uppercase' }}>{size}</p>
                                      <p style={{ fontSize: '0.85rem', fontWeight: '900', color: data.color, margin: 0 }}>{szData.proyec}</p>
                                      <p style={{ fontSize: '0.85rem', fontWeight: '900', color: '#10b981', margin: 0 }}>{szData.real}</p>
                                      {szDiff !== 0 && (
                                        <p style={{ fontSize: '0.55rem', fontWeight: '800', color: szDiff < 0 ? '#dc2626' : '#16a34a', margin: 0 }}>
                                          {szDiff > 0 ? '+' : ''}{szDiff}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Efficiency label */}
                              <div style={{ padding: '0.25rem 1rem 0.6rem', textAlign: 'right' }}>
                                <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: '600' }}>
                                  Eficiencia: <span style={{ color: barColor, fontWeight: '800' }}>{data.totalProyec > 0 ? pct.toFixed(1) : '—'}%</span>
                                </span>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                </div>
              )}


              {/* Novelties Log from observations */}
              {reconciliationOrder.observaciones && (
                <div className="card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: '900', color: '#0f172a', margin: '0 0 1rem 0', textTransform: 'uppercase' }}>
                    Bitácora de Novedades y Resoluciones
                  </h3>
                  <div style={{
                    maxHeight: '300px', overflowY: 'auto',
                    backgroundColor: '#f8fafc', padding: '1.25rem',
                    borderRadius: '10px', border: '1.5px solid #e2e8f0',
                    fontSize: '0.82rem', lineHeight: '1.7',
                    whiteSpace: 'pre-wrap', color: '#334155'
                  }}>
                    {reconciliationOrder.observaciones}
                  </div>
                </div>
              )}
            </>
          )}
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
                      <th style={{ padding: '0.75rem 1rem' }}>Prendas (Real / Proy.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuts.map(cut => {
                      const fabricObj = fabrics.find(f => String(f.id) === String(cut.fabric_id));
                      const telaName = fabricObj ? fabricObj.nombre_tela : 'Tela Externa';
                      
                      const totalProyec = cut.cut_sizes?.reduce((sum: number, cs: any) => sum + (Number(cs.quantity) || 0), 0) || 0;
                      const layersProyec = Number(cut.layers) || 1;
                      const layersProd = Number(cut.layers_produced) || 0;
                      const prendasCortadas = Math.round((totalProyec / layersProyec) * layersProd);

                      return (
                        <tr key={cut.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem' }}>
                          <td style={{ padding: '1rem', fontWeight: '700' }}>Corte ({cut.stroke_length} cm)</td>
                          <td style={{ padding: '1rem' }}>{telaName}</td>
                          <td style={{ padding: '1rem', fontWeight: '800', color: 'var(--primary)' }}>
                            {cut.layers_produced} / {cut.layers}
                          </td>
                          <td style={{ padding: '1rem', fontWeight: '700' }}>{cut.kilos} kg</td>
                          <td style={{ padding: '1rem', fontWeight: '800', color: '#059669' }}>
                            {prendasCortadas} / {totalProyec}
                          </td>
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
                    const res = resolutions[key] || { solucion: '', metros: '', observaciones: '', telaId: '' };
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
                          <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#475569', marginBottom: '0.25rem' }}>Tela Usada para Reposición</label>
                          <select 
                            value={res.telaId || ''}
                            onChange={e => handleResolveChange(key, 'telaId', e.target.value)}
                            style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1.5px solid #cbd5e1', fontSize: '0.75rem', backgroundColor: 'white' }}
                          >
                            <option value="">Seleccione una tela...</option>
                            {uniqueCutsFabrics.map(uf => (
                              <option key={uf.id} value={uf.id}>
                                {uf.nombre}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#475569', marginBottom: '0.25rem' }}>Tela Gastada (Metros)</label>
                          <input 
                            type="number" 
                            step="0.01"
                            max="1"
                            placeholder="Ej. 0.85 (Máx. 1.00)"
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
