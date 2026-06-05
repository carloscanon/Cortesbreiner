'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Scissors, 
  ArrowLeft, 
  Clock, 
  User, 
  Layers, 
  Weight, 
  CheckCircle, 
  BookOpen, 
  AlertTriangle,
  Info,
  Save,
  Play,
  X,
  FileText,
  Plus,
  Trash2
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';

export default function CutDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params?.id;

  const [order, setOrder] = useState<any>(null);
  const [cuts, setCuts] = useState<any[]>([]);
  
  // Masters state
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [fabrics, setFabrics] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Cutter inputs
  const [cutterNotes, setCutterNotes] = useState('');
  const [actualCutsData, setActualCutsData] = useState<Record<number, { actualLayers: number; actualKilos: number }>>({});

  // Partial progress modal states
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false);
  const [progressCutId, setProgressCutId] = useState<string>('');
  const [progressLayers, setProgressLayers] = useState('');
  const [progressNovelties, setProgressNovelties] = useState<{ capa: string; tipo: string }[]>([]);
  const [noveltyCapa, setNoveltyCapa] = useState('');
  const [noveltyTipo, setNoveltyTipo] = useState('');
  const [progressNotes, setProgressNotes] = useState('');
  const [progressSaving, setProgressSaving] = useState(false);

  const fetchData = async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      // 1. Fetch Order details
      const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();
      if (orderErr) throw orderErr;
      setOrder(orderData);

      // 2. Fetch Cuts and sizes associated with order
      const { data: cutsData, error: cutsErr } = await supabase
        .from('cuts')
        .select('*, cut_sizes(*)')
        .eq('order_id', orderId);
      if (cutsErr) throw cutsErr;
      setCuts(cutsData || []);

      // 3. Initialize cutter input state
      const initialInputState: Record<number, { actualLayers: number; actualKilos: number }> = {};
      cutsData?.forEach(cut => {
        initialInputState[cut.id] = {
          actualLayers: cut.layers || 0,
          actualKilos: Math.round((cut.kilos || 0) * 100) / 100
        };
      });
      setActualCutsData(initialInputState);

      // 4. Fetch Masters to resolve IDs
      const { data: pData } = await supabase.from('products').select('*');
      const { data: cData } = await supabase.from('colors').select('*');
      const { data: sData } = await supabase.from('sizes').select('*').order('orden_visual', { ascending: true });
      const { data: catData } = await supabase.from('categories').select('*');
      const { data: fData } = await supabase.from('fabrics').select('*');
      
      setProducts(pData || []);
      setColors(cData || []);
      setSizes(sData || []);
      setCategories(catData || []);
      setFabrics(fData || []);

    } catch (err: any) {
      console.error('Error fetching cut details:', err);
      alert('Error al cargar datos del corte: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [orderId]);

  const handleStartCutting = async () => {
    if (!orderId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'En Corte' })
        .eq('id', orderId);

      if (error) throw error;
      
      setOrder({ ...order, status: 'En Corte' });
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFinishCut = async () => {
    if (!orderId) return;
    setSaving(true);
    try {
      // 1. Update each cut with its actual layers/kilos if modified by the cutter
      for (const cut of cuts) {
        const input = actualCutsData[cut.id];
        if (input) {
          const { error: cutUpdateErr } = await supabase
            .from('cuts')
            .update({
              layers: input.actualLayers,
              kilos: input.actualKilos
            })
            .eq('id', cut.id);
          
          if (cutUpdateErr) throw cutUpdateErr;
        }
      }

      // 2. Format observations report
      let finalObservations = order.observaciones || '';
      if (cutterNotes.trim()) {
        finalObservations += `\n\n=== REPORTE DE CORTE (${new Date().toLocaleDateString('es-ES')}) ===\n${cutterNotes}`;
      }

      // 3. Update Order status to 'Cortado' and save observations
      const { error: orderErr } = await supabase
        .from('orders')
        .update({ 
          status: 'Cortado',
          observaciones: finalObservations
        })
        .eq('id', orderId);

      if (orderErr) throw orderErr;

      alert('¡Corte completado y registrado con éxito!');
      router.push('/cutting');
    } catch (err: any) {
      alert('Error al guardar el registro de corte: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId || !progressCutId) return;
    setProgressSaving(true);
    
    try {
      const cut = cuts.find(c => String(c.id) === String(progressCutId));
      if (!cut) throw new Error("Corte no encontrado");

      // Acumulamos en layers_produced (no tocamos layers que son las capas planeadas)
      const newLayersProduced = (cut.layers_produced || 0) + (Number(progressLayers) || 0);

      // 1. Update cuts table — solo layers_produced
      const { error: cutErr } = await supabase
        .from('cuts')
        .update({ layers_produced: newLayersProduced })
        .eq('id', cut.id);
      
      if (cutErr) throw cutErr;

      // 2. Append to observations
      const colorData = getColorData(cut.color_id, cut);
      const colorName = colorData?.nombre_color || 'Tela';
      const productName = getProductName(cut.product_id);
      
      const timeStamp = new Date().toLocaleString('es-ES');
      
      // Formatear novedades de corte por capa
      const noveltiesStr = progressNovelties.length > 0 
        ? progressNovelties.map(n => `- Capa ${n.capa}: ${n.tipo}`).join('\n')
        : 'Ninguna novedad reportada.';

      const progressLog = `\n\n=== AVANCE PARCIAL (${timeStamp}) ===\nProducto: ${productName} [${colorName}]\nCapas cortadas este avance: ${progressLayers} | Acumuladas: ${newLayersProduced} de ${cut.layers || 0} planeadas\nNovedades de corte por capa:\n${noveltiesStr}\nNotas: ${progressNotes || 'Sin observaciones adicionales.'}`;
      
      const newObservations = (order.observaciones || '') + progressLog;

      const { error: orderErr } = await supabase
        .from('orders')
        .update({ observaciones: newObservations })
        .eq('id', orderId);

      if (orderErr) throw orderErr;

      alert('Avance parcial registrado con éxito.');
      setShowProgressModal(false);
      setProgressCutId('');
      setProgressLayers('');
      setProgressNovelties([]);
      setNoveltyCapa('');
      setNoveltyTipo('');
      setProgressNotes('');
      
      // Refresh Data to show new values
      fetchData();
    } catch (err: any) {
      alert('Error al guardar el avance: ' + err.message);
    } finally {
      setProgressSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '10rem 0' }}>
        <div style={{ 
          border: '4px solid #f3f3f3', 
          borderTop: '4px solid var(--primary)', 
          borderRadius: '50%', 
          width: '50px', 
          height: '50px', 
          animation: 'spin 1s linear infinite' 
        }}></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <p style={{ color: '#ef4444', fontWeight: '800' }}>Error: Orden no encontrada.</p>
        <Link href="/cutting" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-flex' }}>Volver</Link>
      </div>
    );
  }

  // Helper resolvers
  const getProductName = (pid: string) => {
    const prod = products.find(p => String(p.id) === String(pid));
    if (!prod) return 'Sin Referencia';
    return prod.codigo_referencia || prod.nombre_producto || 'Sin Referencia';
  };
  const getColorData = (cid: string, cut?: any) => {
    if (cid) {
      const found = colors.find(c => String(c.id) === String(cid));
      if (found) return found;
    }
    if (cut && cut.product_id) {
      const prod = products.find(p => String(p.id) === String(cut.product_id));
      if (prod && prod.nombre_producto) {
        const prodNameLower = prod.nombre_producto.toLowerCase();
        const foundColor = colors.find(c => 
          prodNameLower.includes((c.nombre_color || '').toLowerCase())
        );
        if (foundColor) return foundColor;
      }
    }
    return null;
  };

  // Determine active size columns based on what's configured in the cut sizes
  const activeSizes = sizes.filter(size => 
    cuts.some(cut => cut.cut_sizes.some((cs: any) => String(cs.size_id) === String(size.id)))
  );

  // Group cuts by fabric color & product to display cleanly
  const isPending = order.status === 'Planeada';
  const isActive = order.status === 'En Corte';
  const isCompleted = order.status === 'Cortado';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '3rem' }}>
      
      {/* Top Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link href="/cutting" className="btn btn-secondary" style={{ padding: '0.6rem', borderRadius: '10px' }}>
          <ArrowLeft size={18} />
        </Link>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
            Mesa de Corte
          </span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '950', margin: 0, color: '#0f172a' }}>
            Ficha de Corte Físico: OC-{order.internal_code}
          </h1>
        </div>
      </div>

      {/* Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2rem', alignItems: 'start' }}>
        
        {/* Left Side: Technical Info & Sheet */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Main Info Card */}
          <div className="card" style={{ padding: '2rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>Especificación del Trazo y Mesa</h3>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>Planificación asignada al cortador.</p>
                </div>
                <button onClick={() => setShowOrderDetailsModal(true)} className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', fontSize: '0.9rem', fontWeight: '900', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#3b82f6', border: 'none', color: 'white', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.5)' }}>
                  <FileText size={20} />
                  Ver Detalle Original de Orden
                </button>
              </div>
              <span style={{ 
                fontSize: '0.8rem', 
                fontWeight: '900', 
                backgroundColor: isPending ? '#e2e8f0' : isActive ? '#fffbeb' : '#ecfdf5',
                color: isPending ? '#475569' : isActive ? '#b45309' : '#047857',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                textTransform: 'uppercase',
                border: isPending ? '1.5px solid #cbd5e1' : isActive ? '1.5px solid #fef08a' : '1.5px solid #a7f3d0'
              }}>
                {order.status === 'Planeada' ? 'Pendiente' : order.status === 'En Corte' ? 'En Mesa' : 'Completado'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <p style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', margin: '0 0 0.5rem 0' }}>Cortador Encargado</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <User size={16} style={{ color: 'var(--primary)' }} />
                  <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#1e293b' }}>{order.cortador_name || 'No asignado'}</span>
                </div>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <p style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', margin: '0 0 0.5rem 0' }}>Fecha Programada</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={16} style={{ color: 'var(--primary)' }} />
                  <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#1e293b' }}>{order.scheduled_date || 'Sin Fecha'}</span>
                </div>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <p style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', margin: '0 0 0.5rem 0' }}>Largo del Trazo (Mts)</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Scissors size={16} style={{ color: 'var(--primary)' }} />
                  <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#1e293b' }}>{cuts[0]?.stroke_length ? `${cuts[0].stroke_length} mts` : '1.00 mt'}</span>
                </div>
              </div>
            </div>

            {/* Observations Card */}
            {order.observaciones && (
              <div style={{ 
                marginTop: '1.5rem',
                backgroundColor: '#fffbeb', 
                border: '1.5px solid #fef08a', 
                padding: '1.25rem', 
                borderRadius: '12px',
                display: 'flex',
                gap: '1rem'
              }}>
                <BookOpen size={24} style={{ color: '#b45309', flexShrink: 0 }} />
                <div>
                  <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem', fontWeight: '900', color: '#78350f', textTransform: 'uppercase' }}>
                    Notas y Observaciones de Corte
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#92400e', whiteSpace: 'pre-wrap', lineHeight: '1.5', fontWeight: '600' }}>
                    {order.observaciones}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Technical Cut Sheet Matrix */}
          <div className="card" style={{ padding: '2rem', borderRadius: '16px', overflowX: 'auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '950', color: '#0f172a', margin: '0 0 1.5rem 0' }}>
              Matriz de Tallas y Marcaciones Programadas
            </h3>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2.5px solid #e2e8f0' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
                    Referencia
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
                    Tela
                  </th>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', color: '#6366f1', textTransform: 'uppercase', minWidth: '130px' }}>
                    Capas Programadas
                  </th>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', color: '#059669', textTransform: 'uppercase', minWidth: '130px' }}>
                    Capas Producidas
                  </th>
                  {activeSizes.map(size => (
                    <th key={size.id} style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase' }}>
                      {size.codigo_talla}
                    </th>
                  ))}
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
                    Prendas Totales
                  </th>
                </tr>
              </thead>
              <tbody>
                {cuts.map((cut, idx) => {
                  const color = getColorData(cut.color_id, cut);
                  const productName = getProductName(cut.product_id);
                  
                  // Compute total prendas for this cut row
                  const totalPrendas = cut.cut_sizes.reduce((sum: number, cs: any) => sum + (Number(cs.quantity) || 0), 0);

                  // Capas planeadas originales (campo layers NO se toca al reportar avance)
                  const capasPlaneadas = cut.layers || 0;
                  // Capas producidas acumuladas via avances parciales
                  const capasProducidas = cut.layers_produced || 0;
                  const capasRestantes = Math.max(0, capasPlaneadas - capasProducidas);
                  const porcentajeProd = capasPlaneadas > 0 ? Math.min(100, Math.round((capasProducidas / capasPlaneadas) * 100)) : 0;
                  // Porcentaje consumido de las programadas (para la barra que se va vaciando)
                  const porcentajeRestante = 100 - porcentajeProd;

                  return (
                    <tr key={cut.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? 'white' : '#f8fafc' }}>
                      <td style={{ padding: '1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: '700' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ 
                            width: '10px', 
                            height: '10px', 
                            borderRadius: '50%', 
                            backgroundColor: color?.hex_color || '#cbd5e1',
                            border: '1px solid #94a3b8',
                            flexShrink: 0
                          }}></div>
                          <div style={{ fontWeight: '800', color: '#1e293b', fontSize: '0.85rem' }}>{productName}</div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'left', fontSize: '0.8rem', color: '#64748b', fontWeight: '600' }}>
                        {(() => {
                          const fabric = fabrics.find(f => String(f.id) === String(cut.fabric_id));
                          return fabric ? fabric.nombre_tela : (color?.nombre_color || 'Sin Tela');
                        })()}
                      </td>

                      {/* CAPAS PROGRAMADAS: muestra restantes con barra que se va vaciando */}
                      <td style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: '800' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                            <span style={{ fontSize: '1rem', fontWeight: '900', color: capasRestantes === 0 ? '#059669' : '#6366f1' }}>
                              {capasRestantes}
                            </span>
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: '600' }}>/ {capasPlaneadas}</span>
                          </div>
                          {capasPlaneadas > 0 && (
                            <div style={{ width: '70px', height: '5px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ 
                                height: '100%', 
                                width: `${porcentajeRestante}%`,
                                backgroundColor: porcentajeRestante <= 0 ? '#059669' : porcentajeRestante < 30 ? '#f59e0b' : '#6366f1',
                                borderRadius: '3px',
                                transition: 'width 0.4s ease'
                              }}></div>
                            </div>
                          )}
                          <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>{porcentajeRestante}% restante</span>
                        </div>
                      </td>

                      {/* CAPAS PRODUCIDAS: muestra acumulado con barra que se va llenando */}
                      <td style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: '800' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                          <span style={{ 
                            fontSize: '1rem', fontWeight: '900',
                            color: porcentajeProd >= 100 ? '#059669' : porcentajeProd > 50 ? '#d97706' : capasProducidas > 0 ? '#3b82f6' : '#94a3b8' 
                          }}>
                            {capasProducidas}
                          </span>
                          {capasPlaneadas > 0 && (
                            <div style={{ width: '70px', height: '5px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ 
                                height: '100%', 
                                width: `${porcentajeProd}%`,
                                backgroundColor: porcentajeProd >= 100 ? '#059669' : porcentajeProd > 50 ? '#d97706' : '#3b82f6',
                                borderRadius: '3px',
                                transition: 'width 0.4s ease'
                              }}></div>
                            </div>
                          )}
                          <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>{porcentajeProd}% completado</span>
                        </div>
                      </td>
                      {activeSizes.map(size => {
                        const qty = cut.cut_sizes.find((cs: any) => String(cs.size_id) === String(size.id))?.quantity || 0;
                        return (
                          <td key={size.id} style={{ padding: '1rem', fontSize: '0.9rem', fontWeight: '800', color: qty > 0 ? '#1e1b4b' : '#cbd5e1' }}>
                            {qty > 0 ? qty : '-'}
                          </td>
                        );
                      })}
                      <td style={{ padding: '1rem', fontSize: '0.9rem', fontWeight: '900', color: 'var(--primary)' }}>
                        {totalPrendas} unds
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Cutter Workshop Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Status Box */}
          <div className="card" style={{ 
            backgroundColor: '#0f172a', 
            color: 'white', 
            border: 'none', 
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 10px 20px -5px rgba(15, 23, 42, 0.3)'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '800', color: '#94a3b8', margin: '0 0 1rem 0', textTransform: 'uppercase' }}>Controles del Cortador</h3>

            {isPending && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p style={{ fontSize: '0.85rem', opacity: 0.9, lineHeight: '1.4', margin: 0 }}>
                  La orden está <strong>Planificada</strong>. Antes de extender la tela, presione el botón de abajo para informar a producción que ha iniciado el corte.
                </p>
                <button 
                  onClick={handleStartCutting}
                  disabled={saving}
                  className="btn"
                  style={{
                    backgroundColor: 'var(--primary)',
                    color: 'white',
                    padding: '1rem',
                    width: '100%',
                    justifyContent: 'center',
                    fontWeight: '900',
                    fontSize: '0.95rem',
                    borderRadius: '12px',
                    boxShadow: '0 4px 10px rgba(99, 102, 241, 0.4)'
                  }}
                >
                  <Play size={18} style={{ marginRight: '0.5rem' }} /> Iniciar Tendido / Corte
                </button>
              </div>
            )}

            {isActive && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <p style={{ fontSize: '0.85rem', opacity: 0.9, lineHeight: '1.4', margin: 0 }}>
                  El corte está actualmente <strong>En Mesa</strong>. Verifique y complete las cantidades reales cortadas físicamente en el taller.
                </p>
                
                <div style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Info size={16} style={{ color: '#fbbf24' }} />
                  <p style={{ fontSize: '0.7rem', color: '#cbd5e1', margin: 0, lineHeight: '1.4' }}>
                    Si extendió más o menos capas, o gastó más kilos de tela de lo planeado, ajuste los valores abajo para una trazabilidad perfecta.
                  </p>
                </div>
              </div>
            )}

            {isCompleted && (
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', backgroundColor: '#022c22', border: '1px solid #065f46', padding: '1rem', borderRadius: '12px', color: '#6ee7b7' }}>
                <CheckCircle size={24} style={{ color: '#34d399', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: '0.8rem', fontWeight: '800', margin: 0 }}>Corte Completado</p>
                  <p style={{ fontSize: '0.7rem', opacity: 0.8, margin: 0 }}>La información ha sido enviada a confección satélite.</p>
                </div>
              </div>
            )}
          </div>

          {/* Form: Interactive Adjustments (Only active when in corte) */}
          {isActive && (
            <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: '900', color: '#1e293b', margin: 0, textTransform: 'uppercase' }}>Registros Reales del Taller</h4>
              
              {cuts.map(cut => {
                const color = getColorData(cut.color_id, cut);
                const input = actualCutsData[cut.id] || { actualLayers: cut.layers, actualKilos: cut.kilos };

                return (
                  <div key={cut.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: color?.hex_color || '#cbd5e1' }}></div>
                      <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#334155' }}>
                        {color?.nombre_color || 'Tela'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Capas Cortadas</label>
                        <input 
                          type="number" 
                          value={input.actualLayers}
                          onChange={e => setActualCutsData({
                            ...actualCutsData,
                            [cut.id]: { ...input, actualLayers: Number(e.target.value) || 0 }
                          })}
                          style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1.5px solid #cbd5e1', fontWeight: '700', fontSize: '0.85rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Kilos Reales</label>
                        <input 
                          type="number" 
                          step="0.01"
                          value={Number(input.actualKilos.toFixed(2))}
                          onChange={e => setActualCutsData({
                            ...actualCutsData,
                            [cut.id]: { ...input, actualKilos: Math.round((Number(e.target.value) || 0) * 100) / 100 }
                          })}
                          style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1.5px solid #cbd5e1', fontWeight: '700', fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#475569' }}>Observaciones del Cortador</label>
                <textarea 
                  placeholder="Ej: Defectos en el rollo de color negro, salieron 0.5kg de retazos..."
                  value={cutterNotes}
                  onChange={e => setCutterNotes(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', minHeight: '80px', fontSize: '0.8rem', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem', marginBottom: '1rem' }}>
                <button 
                  type="button"
                  onClick={() => setShowProgressModal(true)}
                  disabled={saving}
                  className="btn"
                  style={{ 
                    width: '100%', 
                    padding: '1rem', 
                    justifyContent: 'center', 
                    fontSize: '0.9rem', 
                    fontWeight: '800',
                    backgroundColor: '#f1f5f9',
                    color: '#334155',
                    borderRadius: '12px',
                    border: '1.5px solid #cbd5e1',
                    transition: 'all 0.2s'
                  }}
                >
                  <FileText size={18} style={{ marginRight: '0.5rem', color: '#3b82f6' }} /> Reportar Avance Parcial
                </button>
              </div>

              <button 
                onClick={handleFinishCut}
                disabled={saving}
                className="btn btn-primary"
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
                <CheckCircle size={18} style={{ marginRight: '0.5rem' }} /> Finalizar y Registrar Corte
              </button>
            </div>
          )}

          {/* Details Summary of Realized Work (Only displayed when completed) */}
          {isCompleted && (
            <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: '900', color: '#1e293b', margin: 0, textTransform: 'uppercase' }}>Resumen del Trabajo Realizado</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {cuts.map(cut => {
                  const color = getColorData(cut.color_id, cut);
                  const totalPrendas = cut.cut_sizes.reduce((sum: number, cs: any) => sum + (Number(cs.quantity) || 0), 0);
                  
                  return (
                    <div key={cut.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                      <span style={{ fontWeight: '750', color: '#475569' }}>{color?.nombre_color || 'Tela'}</span>
                      <div style={{ textAlign: 'right', fontWeight: '800', color: '#1e293b' }}>
                        <div>{cut.layers} capas | {(Math.round((cut.kilos || 0) * 100) / 100).toFixed(2)} kg</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.15rem' }}>{totalPrendas} prendas cortadas</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Important recommendation box */}
          <div className="card" style={{ padding: '1.25rem', backgroundColor: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '14px', display: 'flex', gap: '0.75rem' }}>
            <Info size={20} style={{ color: '#2563eb', flexShrink: 0 }} />
            <div>
              <h5 style={{ margin: '0 0 0.25rem 0', fontSize: '0.75rem', fontWeight: '900', color: '#1e3a8a', textTransform: 'uppercase' }}>Información de Mesa</h5>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#1e40af', lineHeight: '1.4', fontWeight: '600' }}>
                Todos los retazos o desperdicios mayores a 0.5 metros deben ser pesados y registrados para el inventario de mermas textiles.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Partial Progress Modal */}
      {showProgressModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', backgroundColor: 'white', borderRadius: '20px', overflow: 'hidden', padding: 0, boxShadow: '0 30px 60px -10px rgba(0, 0, 0, 0.6)' }}>
            <div style={{ padding: '1.5rem 2rem', background: 'linear-gradient(135deg, #0f172a, #1e3a5f)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '20px 20px 0 0' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '950', color: 'white' }}>Reportar Avance Parcial</h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>Registra un progreso sin finalizar la orden completa.</p>
              </div>
              <button onClick={() => setShowProgressModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }}><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSaveProgress} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase' }}>¿Sobre qué tela/color avanzaste?</label>
                <select 
                  required
                  value={progressCutId}
                  onChange={e => setProgressCutId(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.9rem', fontWeight: '600' }}
                >
                  <option value="">Selecciona una opción...</option>
                  {cuts.map(c => {
                    const colorDat = getColorData(c.color_id, c);
                    const productNam = getProductName(c.product_id);
                    const producidas = c.layers_produced || 0;
                    const planeadas = c.layers || 0;
                    return (
                      <option key={String(c.id)} value={String(c.id)}>
                        {colorDat?.nombre_color || 'Sin Color'} — {productNam} ({producidas} / {planeadas} capas producidas)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Nuevas Capas Cortadas</label>
                <input 
                  type="number" 
                  required
                  min="1"
                  value={progressLayers}
                  onChange={e => setProgressLayers(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.9rem', fontWeight: '700' }}
                  placeholder="Ej. 20"
                />
              </div>

              {/* Novedades de Corte Section */}
              <div style={{ border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '1rem', backgroundColor: '#f8fafc' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#1e293b', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Novedades de Corte (Por Capa)</label>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr auto', gap: '0.5rem', alignItems: 'end', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#64748b', marginBottom: '0.25rem' }}>Nº CAPA</label>
                    <input 
                      type="number"
                      min="1"
                      value={noveltyCapa}
                      onChange={e => setNoveltyCapa(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '700', textAlign: 'center' }}
                      placeholder="Ej. 5"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#64748b', marginBottom: '0.25rem' }}>NOVEDAD</label>
                    <select
                      value={noveltyTipo}
                      onChange={e => setNoveltyTipo(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '600' }}
                    >
                      <option value="">Selecciona...</option>
                      <option value="Marra">Marra</option>
                      <option value="Manchas">Manchas</option>
                      <option value="Traslape">Traslape</option>
                      <option value="Anchos de Tela">Anchos de Tela</option>
                      <option value="Rotos">Rotos</option>
                    </select>
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      if (!noveltyCapa.trim()) {
                        alert("Por favor ingresa el número de capa.");
                        return;
                      }
                      if (!noveltyTipo) {
                        alert("Por favor selecciona el tipo de novedad.");
                        return;
                      }
                      setProgressNovelties([...progressNovelties, { capa: noveltyCapa, tipo: noveltyTipo }]);
                      setNoveltyCapa('');
                      setNoveltyTipo('');
                    }}
                    style={{ 
                      padding: '0.55rem 1rem', 
                      borderRadius: '6px', 
                      backgroundColor: '#3b82f6', 
                      color: 'white', 
                      border: 'none', 
                      fontWeight: '800', 
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      height: '38px'
                    }}
                  >
                    <Plus size={16} /> Añadir
                  </button>
                </div>

                {/* List of added novelties */}
                {progressNovelties.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem', maxHeight: '120px', overflowY: 'auto', padding: '0.25rem' }}>
                    {progressNovelties.map((n, index) => (
                      <div 
                        key={index}
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.5rem', 
                          backgroundColor: 'white', 
                          border: '1px solid #cbd5e1', 
                          borderRadius: '8px', 
                          padding: '0.35rem 0.65rem', 
                          fontSize: '0.8rem', 
                          fontWeight: '700',
                          color: '#334155'
                        }}
                      >
                        <span style={{ color: '#2563eb' }}>Capa {n.capa}:</span> 
                        <span>{n.tipo}</span>
                        <button 
                          type="button"
                          onClick={() => setProgressNovelties(progressNovelties.filter((_, idx) => idx !== index))}
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            cursor: 'pointer', 
                            color: '#ef4444', 
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '0.5rem 0' }}>
                    No se han registrado novedades de corte para este avance.
                  </p>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Notas / Observaciones del Avance</label>
                <textarea 
                  value={progressNotes}
                  onChange={e => setProgressNotes(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', minHeight: '80px', resize: 'vertical' }}
                  placeholder="Ej: Se paró la máquina a las 3pm, terminamos la mitad del tendido negro..."
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowProgressModal(false)} className="btn btn-secondary" style={{ flex: 1, padding: '1rem', justifyContent: 'center', fontWeight: '800' }}>Cancelar</button>
                <button type="submit" disabled={progressSaving} className="btn btn-primary" style={{ flex: 2, padding: '1rem', justifyContent: 'center', fontWeight: '900', border: 'none', backgroundColor: '#3b82f6' }}>
                  {progressSaving ? 'Guardando...' : 'Guardar Avance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order Details Original Modal */}
      {showOrderDetailsModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '800px', backgroundColor: 'white', borderRadius: '20px', overflow: 'hidden', padding: 0, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 60px -10px rgba(0, 0, 0, 0.6)' }}>
            <div style={{ padding: '1.5rem 2rem', background: 'linear-gradient(135deg, #0f172a, #1e3a5f)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '20px 20px 0 0' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '950', color: 'white' }}>Vista Previa de la Orden Original</h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>Información desglosada según la planificación.</p>
              </div>
              <button onClick={() => setShowOrderDetailsModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }}><X size={24} /></button>
            </div>
            
            <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
                <thead style={{ backgroundColor: '#f8fafc' }}>
                  <tr>
                    <th style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.7rem', textAlign: 'left' }}>PRODUCTO</th>
                    <th style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.7rem', textAlign: 'left' }}>TELA</th>
                    <th style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.7rem', textAlign: 'center' }}>TALLA</th>
                    <th style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.7rem', textAlign: 'center' }}>CAPAS</th>
                    <th style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.7rem', textAlign: 'center' }}>MARC.</th>
                    <th style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.7rem', textAlign: 'right' }}>TOTAL UND</th>
                  </tr>
                </thead>
                <tbody>
                  {cuts.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>No hay datos.</td></tr>
                  ) : (
                    cuts.flatMap((cut) => {
                      const prodName = getProductName(cut.product_id);
                      const fabricObj = fabrics.find(f => String(f.id) === String(cut.fabric_id));
                      const colorObj = getColorData(cut.color_id, cut);
                      const telaName = fabricObj ? fabricObj.nombre_tela : (colorObj ? colorObj.nombre_color : '---');
                      
                      return cut.cut_sizes.filter((cs: any) => Number(cs.quantity) > 0).map((cs: any, i: number) => {
                        const sizeObj = sizes.find(s => String(s.id) === String(cs.size_id));
                        const capas = Number(cut.layers) || 1;
                        const marc = (Number(cs.quantity) / capas).toFixed(2);
                        return (
                          <tr key={`${cut.id}-${cs.size_id}`} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                            <td style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.8rem', fontWeight: '700' }}>{prodName}</td>
                            <td style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.8rem' }}>{telaName}</td>
                            <td style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.8rem', textAlign: 'center' }}>{sizeObj ? sizeObj.codigo_talla : '---'}</td>
                            <td style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.8rem', textAlign: 'center' }}>{cut.layers}</td>
                            <td style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.8rem', textAlign: 'center' }}>{marc.endsWith('.00') ? Math.round(Number(marc)) : marc}</td>
                            <td style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.85rem', textAlign: 'right', fontWeight: '900', color: 'var(--primary)' }}>{cs.quantity}</td>
                          </tr>
                        );
                      });
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowOrderDetailsModal(false)} className="btn btn-secondary" style={{ padding: '0.75rem 1.5rem', fontWeight: '800' }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
