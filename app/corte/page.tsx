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
  const [activeTab, setActiveTab] = useState<'list' | 'analytics' | 'detail'>('list');
  const [productsMaster, setProductsMaster] = useState<any[]>([]);
  const [allCuts, setAllCuts] = useState<any[]>([]);
  const [activeKpiModal, setActiveKpiModal] = useState<string | null>(null);
  const [colorsMaster, setColorsMaster] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterFabric, setFilterFabric] = useState('all');
  const [filterColor, setFilterColor] = useState('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

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

      if (data && data.length > 0) {
        const orderIds = data.map(o => o.id);
        const { data: cutsData } = await supabase
          .from('cuts')
          .select('*, cut_sizes(*)')
          .in('order_id', orderIds);
        setAllCuts(cutsData || []);
      } else {
        setAllCuts([]);
      }
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
      const { data: pData } = await supabase.from('products').select('*');
      const { data: cData } = await supabase.from('colors').select('*').order('nombre');
      setFabrics(fData || []);
      setNoveltiesMaster(nData || []);
      setProductsMaster(pData || []);
      setColorsMaster(cData || []);
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

      {/* Tab Switcher */}
      {!loading && !selectedOrder && !reconciliationOrder && (
        <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
          <button
            onClick={() => setActiveTab('list')}
            style={{
              padding: '0.5rem 1.25rem',
              border: 'none',
              backgroundColor: 'transparent',
              color: activeTab === 'list' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === 'list' ? '2.5px solid var(--primary)' : 'none',
              fontWeight: activeTab === 'list' ? '850' : '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem'
            }}
          >
            <FileText size={16} /> Órdenes Activas ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            style={{
              padding: '0.5rem 1.25rem',
              border: 'none',
              backgroundColor: 'transparent',
              color: activeTab === 'analytics' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === 'analytics' ? '2px solid var(--primary)' : 'none',
              fontWeight: activeTab === 'analytics' ? '850' : '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem'
            }}
          >
            <BarChart3 size={16} /> Indicadores y Gráficos
          </button>
          <button
            onClick={() => setActiveTab('detail')}
            style={{
              padding: '0.5rem 1.25rem',
              border: 'none',
              backgroundColor: 'transparent',
              color: activeTab === 'detail' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === 'detail' ? '2px solid var(--primary)' : 'none',
              fontWeight: activeTab === 'detail' ? '850' : '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem'
            }}
          >
            <Layers size={16} /> Detalle de Procesos
          </button>
        </div>
      )}

      {/* Dashboard Grid */}
      {!loading && !selectedOrder && !reconciliationOrder && activeTab === 'list' && (
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
                        backgroundColor: isFinished ? '#f0fdf4' : 'transparent',
                        transition: 'background 0.2s'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: '900', color: '#475569' }}>
                            {order.internal_code || `OC-${order.consecutive?.toString().padStart(4, '0')}`}
                          </span>
                          <span style={{ 
                            fontSize: '0.625rem', 
                            fontWeight: '900', 
                            padding: '0.15rem 0.5rem', 
                            borderRadius: '4px',
                            backgroundColor: isFinished ? '#d1fae5' : isCutting ? '#dbeafe' : '#fef3c7',
                            color: isFinished ? '#065f46' : isCutting ? '#1e40af' : '#92400e',
                            textTransform: 'uppercase'
                          }}>
                            {order.status}
                          </span>
                        </div>
                        <h4 style={{ fontSize: '1rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                          {order.client_name}
                        </h4>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.15rem 0 0' }}>
                          Creado el {new Date(order.created_at).toLocaleDateString('es-ES')} · Comprometido para: {order.fecha_entrega || '—'}
                        </p>
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
                              fontWeight: '700',
                              cursor: 'pointer'
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

      {/* Analytics Dashboard View */}
      {!loading && !selectedOrder && !reconciliationOrder && activeTab === 'analytics' && (() => {
        const totalKilos = allCuts.reduce((sum, cut) => sum + (Number(cut.kilos) || 0), 0);
        const totalLayers = allCuts.reduce((sum, cut) => sum + (Number(cut.layers_produced || cut.layers || 0)), 0);
        
        let totalGarments = 0;
        allCuts.forEach(cut => {
          (cut.cut_sizes || []).forEach((cs: any) => {
            const layersProyec = cut.layers || 1;
            const layersProduced = cut.layers_produced || 0;
            let realQty = 0;
            if (cs.quantity_produced !== undefined && cs.quantity_produced !== null) {
              realQty = Number(cs.quantity_produced);
            } else {
              const proyecQty = Number(cs.quantity) || 0;
              const ppc = layersProyec > 0 ? proyecQty / layersProyec : 0;
              realQty = Math.round(ppc * layersProduced);
            }
            totalGarments += realQty;
          });
        });

        const uniqueProdIds = Array.from(new Set(allCuts.map(c => String(c.product_id)).filter(Boolean)));
        const totalRefs = uniqueProdIds.length;

        const statusCounts = orders.reduce((acc, o) => {
          acc[o.status] = (acc[o.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const fabricKilos: Record<string, number> = {};
        allCuts.forEach(cut => {
          const fabObj = fabrics.find(f => String(f.id) === String(cut.fabric_id));
          const fabName = fabObj ? fabObj.nombre_tela : 'Tela Externa';
          fabricKilos[fabName] = (fabricKilos[fabName] || 0) + (Number(cut.kilos) || 0);
        });

        const productGarments: Record<string, number> = {};
        allCuts.forEach(cut => {
          const prodObj = productsMaster.find(p => String(p.id) === String(cut.product_id));
          const prodName = prodObj ? prodObj.nombre_producto : 'Sin Referencia';
          
          let cutQty = 0;
          (cut.cut_sizes || []).forEach((cs: any) => {
            const layersProyec = cut.layers || 1;
            const layersProduced = cut.layers_produced || 0;
            let realQty = 0;
            if (cs.quantity_produced !== undefined && cs.quantity_produced !== null) {
              realQty = Number(cs.quantity_produced);
            } else {
              const proyecQty = Number(cs.quantity) || 0;
              const ppc = layersProyec > 0 ? proyecQty / layersProyec : 0;
              realQty = Math.round(ppc * layersProduced);
            }
            cutQty += realQty;
          });
          productGarments[prodName] = (productGarments[prodName] || 0) + cutQty;
        });

        const topProducts = Object.entries(productGarments).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const topFabrics = Object.entries(fabricKilos).sort((a, b) => b[1] - a[1]).slice(0, 5);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* KPI Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
              <div className="card" onClick={() => setActiveKpiModal('orders')} style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem', background: 'linear-gradient(135deg, #4f46e5, #3b82f6)', color: 'white', borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(59,130,246,0.3)', cursor: 'pointer', transition: 'transform 0.2s' }}>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '0.75rem', borderRadius: '12px' }}>
                  <FileText size={24} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '800', opacity: 0.85 }}>Órdenes Pendientes</p>
                  <h3 style={{ margin: '0.2rem 0 0', fontSize: '1.75rem', fontWeight: '950' }}>{orders.length}</h3>
                  <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>En tendido y corte (Clic detalle)</span>
                </div>
              </div>

              <div className="card" onClick={() => setActiveKpiModal('kilos')} style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(16,185,129,0.3)', cursor: 'pointer', transition: 'transform 0.2s' }}>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '0.75rem', borderRadius: '12px' }}>
                  <Layers size={24} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '800', opacity: 0.85 }}>Tela Cortada (Kilos)</p>
                  <h3 style={{ margin: '0.2rem 0 0', fontSize: '1.75rem', fontWeight: '950' }}>{totalKilos.toFixed(1)} kg</h3>
                  <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>{totalLayers} capas (Clic detalle)</span>
                </div>
              </div>

              <div className="card" onClick={() => setActiveKpiModal('garments')} style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem', background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', color: 'white', borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(139,92,246,0.3)', cursor: 'pointer', transition: 'transform 0.2s' }}>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '0.75rem', borderRadius: '12px' }}>
                  <Scissors size={24} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '800', opacity: 0.85 }}>Prendas Producidas</p>
                  <h3 style={{ margin: '0.2rem 0 0', fontSize: '1.75rem', fontWeight: '950' }}>{totalGarments} uds</h3>
                  <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>Proyección real (Clic detalle)</span>
                </div>
              </div>

              <div className="card" onClick={() => setActiveKpiModal('references')} style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(245,158,11,0.3)', cursor: 'pointer', transition: 'transform 0.2s' }}>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '0.75rem', borderRadius: '12px' }}>
                  <Info size={24} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '800', opacity: 0.85 }}>Referencias</p>
                  <h3 style={{ margin: '0.2rem 0 0', fontSize: '1.75rem', fontWeight: '950' }}>{totalRefs} refs</h3>
                  <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>Modelos en corte (Clic detalle)</span>
                </div>
              </div>
            </div>

            {/* Visual Charts Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
              {/* Left Column: Fabrics */}
              <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', borderRadius: '16px' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: '900', color: '#0f172a', margin: 0, textTransform: 'uppercase', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                  Distribución de Consumo de Tela
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {topFabrics.map(([name, kilos], idx) => {
                    const pct = totalKilos > 0 ? (kilos / totalKilos) * 100 : 0;
                    return (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: '750', color: '#334155' }}>
                          <span>{name}</span>
                          <span style={{ color: 'var(--primary)', fontWeight: '800' }}>{kilos.toFixed(1)} kg ({pct.toFixed(0)}%)</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', backgroundColor: idx === 0 ? '#4f46e5' : idx === 1 ? '#10b981' : idx === 2 ? '#f59e0b' : '#8b5cf6', borderRadius: '4px' }}></div>
                        </div>
                      </div>
                    );
                  })}
                  {topFabrics.length === 0 && <p style={{ fontStyle: 'italic', color: '#94a3b8', fontSize: '0.78rem', margin: 0 }}>Sin registros de telas.</p>}
                </div>
              </div>

              {/* Right Column: Top Products */}
              <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', borderRadius: '16px' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: '900', color: '#0f172a', margin: 0, textTransform: 'uppercase', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                  Top 5 Referencias Más Producidas
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {topProducts.map(([name, qty], idx) => {
                    const maxQty = Math.max(...Object.values(productGarments), 1);
                    const pct = (qty / maxQty) * 100;
                    return (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: '750', color: '#334155' }}>
                          <span>{name}</span>
                          <span style={{ color: '#059669', fontWeight: '800' }}>{qty} uds</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', backgroundColor: idx === 0 ? '#10b981' : idx === 1 ? '#8b5cf6' : idx === 2 ? '#ec4899' : '#3b82f6', borderRadius: '4px' }}></div>
                        </div>
                      </div>
                    );
                  })}
                  {topProducts.length === 0 && <p style={{ fontStyle: 'italic', color: '#94a3b8', fontSize: '0.78rem', margin: 0 }}>Sin registros de productos.</p>}
                </div>
              </div>
            </div>

            {/* Status Breakdown Bar */}
            <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderRadius: '16px' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: '900', color: '#0f172a', margin: 0, textTransform: 'uppercase' }}>
                Fases de Órdenes en Corte
              </h3>
              <div style={{ display: 'flex', width: '100%', height: '24px', backgroundColor: '#f1f5f9', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                {['Tendido', 'Cortando', 'Cortado'].map((status) => {
                  const count = statusCounts[status] || 0;
                  const pct = orders.length > 0 ? (count / orders.length) * 100 : 0;
                  if (pct === 0) return null;
                  return (
                    <div
                      key={status}
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        backgroundColor: status === 'Tendido' ? '#f59e0b' : status === 'Cortando' ? '#3b82f6' : '#10b981',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '0.6875rem',
                        fontWeight: '900'
                      }}
                    >
                      {status}: {count} ({pct.toFixed(0)}%)
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '700' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#f59e0b' }}><span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: '#f59e0b', borderRadius: '50%' }}></span>Tendido ({statusCounts['Tendido'] || 0})</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#3b82f6' }}><span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: '#3b82f6', borderRadius: '50%' }}></span>Cortando ({statusCounts['Cortando'] || 0})</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#10b981' }}><span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%' }}></span>Cortado ({statusCounts['Cortado'] || 0})</span>
              </div>
            </div>

          </div>
        );
      })()}

      {/* Detailed Report View (New Tab) */}
      {!loading && !selectedOrder && !reconciliationOrder && activeTab === 'detail' && (() => {
        // Apply filters
        const filteredCuts = allCuts.filter(cut => {
          const orderObj = orders.find(o => String(o.id) === String(cut.order_id));
          const prodObj = productsMaster.find(p => String(p.id) === String(cut.product_id));
          
          // 1. Status Filter
          const status = orderObj ? orderObj.status : 'Desconocido';
          if (filterStatus !== 'all' && status !== filterStatus) return false;
          
          // 2. Fabric Filter
          if (filterFabric !== 'all' && String(cut.fabric_id) !== filterFabric) return false;
          
          // 3. Color Filter
          if (filterColor !== 'all') {
            const hasColor = (cut.cut_sizes || []).some((cs: any) => String(cs.color_id) === filterColor);
            if (!hasColor) return false;
          }
          
          // 4. Date Filter
          if (orderObj?.created_at) {
            const orderDate = new Date(orderObj.created_at);
            if (filterStartDate) {
              const start = new Date(filterStartDate);
              if (orderDate < start) return false;
            }
            if (filterEndDate) {
              const end = new Date(filterEndDate);
              end.setHours(23, 59, 59, 999);
              if (orderDate > end) return false;
            }
          }
          
          // 5. Search Query
          if (searchQuery) {
            const query = searchQuery.toLowerCase().trim();
            const matchesCode = String(orderObj?.internal_code || '').toLowerCase().includes(query);
            const matchesClient = String(orderObj?.client_name || '').toLowerCase().includes(query);
            const matchesProd = String(prodObj?.nombre_producto || '').toLowerCase().includes(query);
            if (!matchesCode && !matchesClient && !matchesProd) return false;
          }
          
          return true;
        });

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Filters Bar Card */}
            <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1rem', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: '850', color: '#0f172a', textTransform: 'uppercase', margin: 0 }}>Filtros de Búsqueda</h4>
                {(filterStatus !== 'all' || filterFabric !== 'all' || filterColor !== 'all' || filterStartDate || filterEndDate || searchQuery) && (
                  <button
                    onClick={() => {
                      setFilterStatus('all');
                      setFilterFabric('all');
                      setFilterColor('all');
                      setFilterStartDate('');
                      setFilterEndDate('');
                      setSearchQuery('');
                    }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontWeight: '750', fontSize: '0.75rem', cursor: 'pointer' }}
                  >
                    Limpiar Filtros
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                {/* Search query */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Búsqueda General</label>
                  <input
                    type="text"
                    placeholder="Orden, cliente o referencia..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.8rem', backgroundColor: 'var(--bg-card)' }}
                  />
                </div>

                {/* Status selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Estado de Orden</label>
                  <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    style={{ width: '100%', padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.8rem', cursor: 'pointer', backgroundColor: 'var(--bg-card)' }}
                  >
                    <option value="all">Todos los estados</option>
                    <option value="Tendido">Tendido</option>
                    <option value="Cortando">Cortando</option>
                    <option value="Cortado">Cortado</option>
                  </select>
                </div>

                {/* Fabric Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Tela Utilizada</label>
                  <select
                    value={filterFabric}
                    onChange={e => setFilterFabric(e.target.value)}
                    style={{ width: '100%', padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.8rem', cursor: 'pointer', backgroundColor: 'var(--bg-card)' }}
                  >
                    <option value="all">Todas las telas</option>
                    {fabrics.map(f => (
                      <option key={f.id} value={f.id}>{f.nombre_tela}</option>
                    ))}
                  </select>
                </div>

                {/* Color Selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Color Prenda</label>
                  <select
                    value={filterColor}
                    onChange={e => setFilterColor(e.target.value)}
                    style={{ width: '100%', padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.8rem', cursor: 'pointer', backgroundColor: 'var(--bg-card)' }}
                  >
                    <option value="all">Todos los colores</option>
                    {colorsMaster.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Start Date */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Fecha Desde</label>
                  <input
                    type="date"
                    value={filterStartDate}
                    onChange={e => setFilterStartDate(e.target.value)}
                    style={{ width: '100%', padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.8rem', backgroundColor: 'var(--bg-card)' }}
                  />
                </div>

                {/* End Date */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Fecha Hasta</label>
                  <input
                    type="date"
                    value={filterEndDate}
                    onChange={e => setFilterEndDate(e.target.value)}
                    style={{ width: '100%', padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.8rem', backgroundColor: 'var(--bg-card)' }}
                  />
                </div>
              </div>
            </div>

            {/* Detailed Process Table */}
            {(() => {
              const sumKilos = filteredCuts.reduce((sum, cut) => sum + (Number(cut.kilos) || 0), 0);
              const sumLayers = filteredCuts.reduce((sum, cut) => sum + (Number(cut.layers_produced || cut.layers || 0)), 0);
              
              let sumGarments = 0;
              filteredCuts.forEach(cut => {
                (cut.cut_sizes || []).forEach((cs: any) => {
                  const layersProyec = cut.layers || 1;
                  const layersProduced = cut.layers_produced || 0;
                  let realQty = 0;
                  if (cs.quantity_produced !== undefined && cs.quantity_produced !== null) {
                    realQty = Number(cs.quantity_produced);
                  } else {
                    const proyecQty = Number(cs.quantity) || 0;
                    const ppc = layersProyec > 0 ? proyecQty / layersProyec : 0;
                    realQty = Math.round(ppc * layersProduced);
                  }
                  sumGarments += realQty;
                });
              });

              return (
                <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: '900', color: '#0f172a', margin: 0, textTransform: 'uppercase' }}>
                      📋 Detalle de Tendido y Corte por Lote ({filteredCuts.length})
                    </h3>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', minWidth: '700px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1.5px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '0.6rem 0.5rem', fontWeight: '800' }}>Orden</th>
                          <th style={{ padding: '0.6rem 0.5rem', fontWeight: '800' }}>Cliente</th>
                          <th style={{ padding: '0.6rem 0.5rem', fontWeight: '800' }}>Referencia / Producto</th>
                          <th style={{ padding: '0.6rem 0.5rem', fontWeight: '800' }}>Tela</th>
                          <th style={{ padding: '0.6rem 0.5rem', fontWeight: '800', textAlign: 'right' }}>Kilos</th>
                          <th style={{ padding: '0.6rem 0.5rem', fontWeight: '800', textAlign: 'center' }}>Capas</th>
                          <th style={{ padding: '0.6rem 0.5rem', fontWeight: '800', textAlign: 'right' }}>Prendas Est.</th>
                          <th style={{ padding: '0.6rem 0.5rem', fontWeight: '800', textAlign: 'center' }}>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCuts.map((cut, idx) => {
                          const orderObj = orders.find(o => String(o.id) === String(cut.order_id));
                          const prodObj = productsMaster.find(p => String(p.id) === String(cut.product_id));
                          const fabObj = fabrics.find(f => String(f.id) === String(cut.fabric_id));
                          
                          let cutQty = 0;
                          (cut.cut_sizes || []).forEach((cs: any) => {
                            const layersProyec = cut.layers || 1;
                            const layersProduced = cut.layers_produced || 0;
                            let realQty = 0;
                            if (cs.quantity_produced !== undefined && cs.quantity_produced !== null) {
                              realQty = Number(cs.quantity_produced);
                            } else {
                              const proyecQty = Number(cs.quantity) || 0;
                              const ppc = layersProyec > 0 ? proyecQty / layersProyec : 0;
                              realQty = Math.round(ppc * layersProduced);
                            }
                            cutQty += realQty;
                          });

                          const status = orderObj ? orderObj.status : 'Desconocido';

                          return (
                            <tr key={cut.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '0.6rem 0.5rem', fontWeight: '750' }}>{orderObj?.internal_code || `OC-${orderObj?.consecutive}`}</td>
                              <td style={{ padding: '0.6rem 0.5rem' }}>{orderObj?.client_name}</td>
                              <td style={{ padding: '0.6rem 0.5rem', fontWeight: '700' }}>{prodObj ? prodObj.nombre_producto : '—'}</td>
                              <td style={{ padding: '0.6rem 0.5rem' }}>{fabObj ? fabObj.nombre_tela : '—'}</td>
                              <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: '800' }}>{Number(cut.kilos || 0).toFixed(1)} kg</td>
                              <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>{cut.layers_produced || cut.layers || 0}</td>
                              <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: '850', color: 'var(--primary)' }}>{cutQty} uds</td>
                              <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>
                                <span style={{
                                  fontSize: '0.65rem',
                                  fontWeight: '900',
                                  padding: '0.15rem 0.4rem',
                                  borderRadius: '4px',
                                  backgroundColor: status === 'Cortado' ? '#d1fae5' : status === 'Cortando' ? '#dbeafe' : '#fef3c7',
                                  color: status === 'Cortado' ? '#065f46' : status === 'Cortando' ? '#1e40af' : '#92400e',
                                  textTransform: 'uppercase'
                                }}>
                                  {status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredCuts.length === 0 && (
                          <tr>
                            <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              No se encontraron registros de cortes con los filtros seleccionados.
                            </td>
                          </tr>
                        )}
                      </tbody>
                      {filteredCuts.length > 0 && (
                        <tfoot>
                          <tr style={{ borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a', backgroundColor: '#f8fafc', fontWeight: '900', color: '#0f172a' }}>
                            <td colSpan={4} style={{ padding: '0.75rem 0.5rem', textTransform: 'uppercase', fontSize: '0.78rem' }}>
                              Totales Filtrados ({filteredCuts.length} registros)
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontSize: '0.825rem', color: '#059669', borderLeft: '1px solid var(--border)' }}>
                              {sumKilos.toFixed(1)} kg
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', fontSize: '0.825rem', borderLeft: '1px solid var(--border)' }}>
                              {sumLayers}
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontSize: '0.825rem', color: 'var(--primary)', borderLeft: '1px solid var(--border)', fontWeight: '950' }}>
                              {sumGarments} uds
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem', borderLeft: '1px solid var(--border)' }}></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* ── KPI DETAILS MODALS ── */}
      {activeKpiModal && (() => {
        let title = '';
        let modalBg = '';
        let analysisText = '';
        let content: React.ReactNode = null;

        if (activeKpiModal === 'orders') {
          title = 'Detalle de Órdenes Pendientes';
          modalBg = 'linear-gradient(135deg, #4f46e5, #3b82f6)';
          
          const tendidoCount = orders.filter(o => o.status === 'Tendido').length;
          const cortandoCount = orders.filter(o => o.status === 'Cortando').length;
          const cortadoCount = orders.filter(o => o.status === 'Cortado').length;
          
          analysisText = `Actualmente se registran ${orders.length} órdenes en flujo de corte. De ellas, ${tendidoCount} están en tendido inicial, ${cortandoCount} están en proceso activo de corte físico y ${cortadoCount} han finalizado el corte y están listas para envío. El flujo promedio muestra una buena distribución, con un enfoque en finalizar los cortes de lotes pendientes.`;
          
          content = (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {orders.map(o => (
                <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '10px' }}>
                  <div>
                    <strong style={{ color: 'var(--text)' }}>OC-{o.internal_code || o.consecutive}</strong>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cliente: {o.client_name} · Tela: {fabrics.find(f => String(f.id) === String(o.fabric_id))?.nombre_tela || 'Externa'}</p>
                  </div>
                  <span style={{
                    fontSize: '0.625rem',
                    fontWeight: '900',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    backgroundColor: o.status === 'Cortado' ? '#d1fae5' : o.status === 'Cortando' ? '#dbeafe' : '#fef3c7',
                    color: o.status === 'Cortado' ? '#065f46' : o.status === 'Cortando' ? '#1e40af' : '#92400e',
                    alignSelf: 'center',
                    textTransform: 'uppercase'
                  }}>{o.status}</span>
                </div>
              ))}
            </div>
          );
        } else if (activeKpiModal === 'kilos') {
          title = 'Detalle de Tela Cortada (Kilos)';
          modalBg = 'linear-gradient(135deg, #10b981, #059669)';
          
          const totalKilos = allCuts.reduce((sum, cut) => sum + (Number(cut.kilos) || 0), 0);
          const avgKilos = orders.length > 0 ? totalKilos / orders.length : 0;
          analysisText = `Se han consumido un total de ${totalKilos.toFixed(1)} kg de tela en los cortes actuales, con un promedio de ${avgKilos.toFixed(1)} kg por orden de producción. Las telas de mayor densidad representan el mayor volumen de peso. Monitorear los kilos cortados es fundamental para mantener el control de inventario de materia prima contra la producción real.`;
          
          const fabricKilos: Record<string, number> = {};
          allCuts.forEach(cut => {
            const fabObj = fabrics.find(f => String(f.id) === String(cut.fabric_id));
            const fabName = fabObj ? fabObj.nombre_tela : 'Tela Externa';
            fabricKilos[fabName] = (fabricKilos[fabName] || 0) + (Number(cut.kilos) || 0);
          });
          
          content = (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {Object.entries(fabricKilos).map(([name, kilos]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '10px' }}>
                  <span>{name}</span>
                  <strong style={{ color: 'var(--primary)' }}>{kilos.toFixed(1)} kg</strong>
                </div>
              ))}
            </div>
          );
        } else if (activeKpiModal === 'garments') {
          title = 'Detalle de Prendas Producidas';
          modalBg = 'linear-gradient(135deg, #8b5cf6, #ec4899)';
          
          let totalGarments = 0;
          const details: { code: string; client: string; qty: number }[] = [];
          
          allCuts.forEach(cut => {
            const orderObj = orders.find(o => String(o.id) === String(cut.order_id));
            let cutQty = 0;
            (cut.cut_sizes || []).forEach((cs: any) => {
              const layersProyec = cut.layers || 1;
              const layersProduced = cut.layers_produced || 0;
              let realQty = 0;
              if (cs.quantity_produced !== undefined && cs.quantity_produced !== null) {
                realQty = Number(cs.quantity_produced);
              } else {
                const proyecQty = Number(cs.quantity) || 0;
                const ppc = layersProyec > 0 ? proyecQty / layersProyec : 0;
                realQty = Math.round(ppc * layersProduced);
              }
              cutQty += realQty;
            });
            
            if (cutQty > 0 && orderObj) {
              totalGarments += cutQty;
              const code = orderObj.internal_code || orderObj.consecutive;
              const existing = details.find(d => d.code === code);
              if (existing) {
                existing.qty += cutQty;
              } else {
                details.push({ code, client: orderObj.client_name, qty: cutQty });
              }
            }
          });
          
          analysisText = `La proyección total de prendas reales obtenidas en la mesa de corte es de ${totalGarments} unidades. Esto representa la base real de carga de trabajo que ingresará al taller de costura/confección. Un conteo preciso garantiza que no haya diferencias entre las piezas entregadas a satélites y los productos finales facturados.`;
          
          content = (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {details.map(d => (
                <div key={d.code} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '10px' }}>
                  <div>
                    <strong style={{ color: 'var(--text)' }}>OC-{d.code}</strong>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cliente: {d.client}</p>
                  </div>
                  <strong style={{ color: 'var(--primary)', alignSelf: 'center' }}>{d.qty} prendas</strong>
                </div>
              ))}
            </div>
          );
        } else if (activeKpiModal === 'references') {
          title = 'Detalle de Referencias y Modelos';
          modalBg = 'linear-gradient(135deg, #f59e0b, #d97706)';
          
          const refCounts: Record<string, number> = {};
          allCuts.forEach(cut => {
            const prodObj = productsMaster.find(p => String(p.id) === String(cut.product_id));
            const prodName = prodObj ? prodObj.nombre_producto : 'Sin Referencia';
            refCounts[prodName] = (refCounts[prodName] || 0) + 1;
          });
          
          analysisText = `Actualmente se están procesando ${Object.keys(refCounts).length} referencias de producto diferentes. Diversificar referencias requiere mayor precisión en el trazo y tendido para evitar confusiones de moldes y optimizar el rendimiento del trazo.`;
          
          content = (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {Object.entries(refCounts).map(([name, count]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '10px' }}>
                  <span>{name}</span>
                  <strong style={{ color: 'var(--primary)' }}>{count} lote(s)</strong>
                </div>
              ))}
            </div>
          );
        }

        return (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(8px)', padding: '1.5rem' }}>
            <div className="card" style={{ width: '100%', maxWidth: '600px', borderRadius: '20px', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh', backgroundColor: 'white', border: '1px solid var(--border)' }}>
              <div style={{ background: modalBg, color: 'white', padding: '1.5rem 2rem', position: 'relative' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '950', margin: 0 }}>{title}</h3>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', opacity: 0.9, textTransform: 'uppercase', fontWeight: '750' }}>Panel de Información e Indicadores</p>
              </div>
              <div style={{ padding: '2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ padding: '1rem', borderRadius: '12px', borderLeft: '4px solid var(--primary)', backgroundColor: 'var(--bg-secondary)', fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  <p style={{ fontWeight: '850', color: 'var(--text)', margin: '0 0 0.4rem', textTransform: 'uppercase', fontSize: '0.65rem' }}>Análisis del Ejercicio</p>
                  {analysisText}
                </div>
                <div>
                  <h4 style={{ fontWeight: '850', fontSize: '0.75rem', color: 'var(--text)', textTransform: 'uppercase', marginBottom: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem' }}>Datos Específicos</h4>
                  {content}
                </div>
              </div>
              <div style={{ padding: '1rem 2rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', backgroundColor: 'var(--bg-secondary)' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setActiveKpiModal(null)}
                  style={{ padding: '0.5rem 1.5rem', fontWeight: '700', borderRadius: '8px' }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
              {/* Summary Cards */}
              {(() => {
                const totalCapasProyectadas = reconciliationCuts.reduce((sum, c) => sum + (c.layers || 0), 0);
                const totalCapasReales = reconciliationCuts.reduce((sum, c) => sum + (c.layers_produced || 0), 0);
                const totalKilos = reconciliationCuts.reduce((sum, c) => sum + (parseFloat(c.kilos) || 0), 0);
                const difCapas = totalCapasReales - totalCapasProyectadas;
                const totalPrendasProyec = reconciliationCuts.reduce((sum, c) => {
                  return sum + (c.cut_sizes || []).reduce((s: number, cs: any) => s + (Number(cs.quantity) || 0), 0);
                }, 0);
                const totalPrendasReales = reconciliationCuts.reduce((sum, c) => {
                  const layers = c.layers || 1;
                  const layersReal = c.layers_produced || 0;
                  return sum + (c.cut_sizes || []).reduce((s: number, cs: any) => {
                    if (cs.quantity_produced !== undefined && cs.quantity_produced !== null) {
                      return s + Number(cs.quantity_produced);
                    }
                    const piezasPorCapa = (Number(cs.quantity) || 0) / layers;
                    return s + Math.round(piezasPorCapa * layersReal);
                  }, 0);
                }, 0);
                const difPrendas = totalPrendasReales - totalPrendasProyec;
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Hero Card for Units Reconciliation */}
                    <div className="card" style={{
                      padding: '2rem',
                      borderRadius: '20px',
                      background: 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)',
                      color: '#ffffff',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1.5rem',
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        position: 'absolute',
                        top: '-20%',
                        right: '-10%',
                        width: '300px',
                        height: '300px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(0,0,0,0) 70%)',
                        pointerEvents: 'none'
                      }} />

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 1, flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                          <h2 style={{ fontSize: '1.25rem', fontWeight: '950', margin: 0, letterSpacing: '-0.025em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>🎯</span> BALANCE DE UNIDADES (PLANEADO VS. REAL)
                          </h2>
                          <p style={{ fontSize: '0.85rem', color: '#cbd5e1', margin: '0.25rem 0 0 0' }}>
                            Relación entre las prendas planificadas en la orden y las cortadas finalmente en el tendido físico.
                          </p>
                        </div>
                        <div style={{
                          backgroundColor: difPrendas < 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                          border: `1px solid ${difPrendas < 0 ? '#f87171' : '#34d399'}`,
                          borderRadius: '30px',
                          padding: '0.5rem 1.25rem',
                          fontSize: '0.9rem',
                          fontWeight: '900',
                          color: difPrendas < 0 ? '#f87171' : '#34d399'
                        }}>
                          {difPrendas === 0 ? 'Exacto' : `${difPrendas > 0 ? '+' : ''}${difPrendas.toLocaleString()} unidades`}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', zIndex: 1, backgroundColor: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', margin: '0 0 0.5rem 0' }}>Planeado</p>
                          <p style={{ fontSize: '2.25rem', fontWeight: '950', color: '#cbd5e1', margin: 0, fontFamily: 'monospace' }}>
                            {totalPrendasProyec.toLocaleString()} <span style={{ fontSize: '0.85rem', fontWeight: '500', color: '#64748b' }}>uds</span>
                          </p>
                        </div>
                        <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
                          <p style={{ fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', margin: '0 0 0.5rem 0' }}>Corte Real</p>
                          <p style={{ fontSize: '2.25rem', fontWeight: '950', color: difPrendas < 0 ? '#f87171' : '#34d399', margin: 0, fontFamily: 'monospace' }}>
                            {totalPrendasReales.toLocaleString()} <span style={{ fontSize: '0.85rem', fontWeight: '500', color: difPrendas < 0 ? '#f87171' : '#34d399' }}>uds</span>
                          </p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', margin: '0 0 0.5rem 0' }}>Cumplimiento</p>
                          <p style={{ fontSize: '2.25rem', fontWeight: '950', color: '#a5b4fc', margin: 0, fontFamily: 'monospace' }}>
                            {totalPrendasProyec > 0 ? ((totalPrendasReales / totalPrendasProyec) * 100).toFixed(1) : '—'}%
                          </p>
                        </div>
                      </div>
                      
                      {totalPrendasProyec > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', zIndex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' }}>
                            <span>Progreso de unidades</span>
                            <span>{totalPrendasReales.toLocaleString()} / {totalPrendasProyec.toLocaleString()} uds</span>
                          </div>
                          <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ 
                              width: `${Math.min((totalPrendasReales / totalPrendasProyec) * 100, 100)}%`, 
                              height: '100%', 
                              backgroundColor: difPrendas < 0 ? '#ef4444' : '#10b981', 
                              borderRadius: '4px',
                              transition: 'width 0.5s ease-out'
                            }} />
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
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
                    </div>
                  </div>
                );
              })()}

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
                          if (cs.quantity_produced !== undefined && cs.quantity_produced !== null) {
                            return s + Number(cs.quantity_produced);
                          }
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
                    {(() => {
                      const totalCapasProy = reconciliationCuts.reduce((sum, c) => sum + (c.layers || 0), 0);
                      const totalCapasReal = reconciliationCuts.reduce((sum, c) => sum + (c.layers_produced || 0), 0);
                      const totalDiffCapas = totalCapasReal - totalCapasProy;

                      const totalPrendasProy = reconciliationCuts.reduce((sum, c) => {
                        return sum + (c.cut_sizes || []).reduce((s: number, cs: any) => s + (Number(cs.quantity) || 0), 0);
                      }, 0);

                      const totalPrendasReal = reconciliationCuts.reduce((sum, c) => {
                        const layers = c.layers || 1;
                        const layersReal = c.layers_produced || 0;
                        return sum + (c.cut_sizes || []).reduce((s: number, cs: any) => {
                          if (cs.quantity_produced !== undefined && cs.quantity_produced !== null) {
                            return s + Number(cs.quantity_produced);
                          }
                          const piezasPorCapa = (Number(cs.quantity) || 0) / layers;
                          return s + Math.round(piezasPorCapa * layersReal);
                        }, 0);
                      }, 0);

                      const totalDiffPrendas = totalPrendasReal - totalPrendasProy;
                      const totalKilosSum = reconciliationCuts.reduce((sum, c) => sum + (parseFloat(c.kilos) || 0), 0);
                      const totalEficiencia = totalCapasProy > 0 ? ((totalCapasReal / totalCapasProy) * 100).toFixed(1) : '—';

                      return (
                        <tfoot style={{ borderTop: '2.5px solid #cbd5e1', backgroundColor: '#f8fafc', fontWeight: '900' }}>
                          <tr>
                            <td style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: '900', color: '#0f172a' }}>TOTALES</td>
                            <td style={{ padding: '1rem' }}></td>
                            <td style={{ padding: '1rem' }}></td>
                            <td style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: '900', color: '#6366f1' }}>{totalCapasProy}</td>
                            <td style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: '900', color: '#10b981' }}>{totalCapasReal}</td>
                            <td style={{ padding: '1rem' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: '800', padding: '0.2rem 0.6rem', borderRadius: '5px',
                                backgroundColor: totalDiffCapas < 0 ? '#fef2f2' : totalDiffCapas > 0 ? '#fffbeb' : '#f0fdf4',
                                color: totalDiffCapas < 0 ? '#dc2626' : totalDiffCapas > 0 ? '#d97706' : '#16a34a' }}>
                                {totalDiffCapas > 0 ? '+' : ''}{totalDiffCapas}
                              </span>
                            </td>
                            {/* Prominently highlighted unit totals */}
                            <td style={{ padding: '1rem', fontSize: '0.95rem', fontWeight: '950', color: '#4f46e5', backgroundColor: '#e0e7ff' }}>{totalPrendasProy.toLocaleString()}</td>
                            <td style={{ padding: '1rem', fontSize: '0.95rem', fontWeight: '950', color: '#059669', backgroundColor: '#d1fae5' }}>{totalPrendasReal.toLocaleString()}</td>
                            <td style={{ padding: '1rem', backgroundColor: totalDiffPrendas < 0 ? '#fef2f2' : '#f0fdf4' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: '900', padding: '0.2rem 0.6rem', borderRadius: '5px',
                                backgroundColor: totalDiffPrendas < 0 ? '#dc2626' : totalDiffPrendas > 0 ? '#fffbeb' : '#16a34a',
                                color: totalDiffPrendas < 0 ? '#ffffff' : totalDiffPrendas > 0 ? '#d97706' : '#ffffff' }}>
                                {totalDiffPrendas > 0 ? '+' : ''}{totalDiffPrendas.toLocaleString()}
                              </span>
                            </td>
                            <td style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: '900', color: '#0f172a' }}>{totalKilosSum.toFixed(2)} kg</td>
                            <td style={{ padding: '1rem' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: '800', padding: '0.2rem 0.6rem', borderRadius: '5px',
                                backgroundColor: parseFloat(totalEficiencia) >= 100 ? '#f0fdf4' : parseFloat(totalEficiencia) >= 80 ? '#fffbeb' : '#fef2f2',
                                color: parseFloat(totalEficiencia) >= 100 ? '#16a34a' : parseFloat(totalEficiencia) >= 80 ? '#d97706' : '#dc2626' }}>
                                {totalEficiencia}%
                              </span>
                            </td>
                          </tr>
                        </tfoot>
                      );
                    })()}
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
