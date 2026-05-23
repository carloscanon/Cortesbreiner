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
  Play
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
  const [colors, setColors] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Cutter inputs
  const [cutterNotes, setCutterNotes] = useState('');
  const [actualCutsData, setActualCutsData] = useState<Record<number, { actualLayers: number; actualKilos: number }>>({});

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
          actualKilos: cut.kilos || 0
        };
      });
      setActualCutsData(initialInputState);

      // 4. Fetch Masters to resolve IDs
      const { data: pData } = await supabase.from('products').select('*');
      const { data: cData } = await supabase.from('colors').select('*');
      const { data: sData } = await supabase.from('sizes').select('*').order('orden_visual', { ascending: true });
      
      setProducts(pData || []);
      setColors(cData || []);
      setSizes(sData || []);

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
  const getProductName = (pid: string) => products.find(p => p.id === pid || p.id === Number(pid))?.nombre_producto || 'Sin Producto';
  const getColorData = (cid: string) => colors.find(c => c.id === cid || c.id === Number(cid));

  // Determine active size columns based on what's configured in the cut sizes
  const activeSizes = sizes.filter(size => 
    cuts.some(cut => cut.cut_sizes.some((cs: any) => cs.size_id === size.id || cs.size_id === Number(size.id)))
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
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>Especificación del Trazo y Mesa</h3>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>Planificación asignada al cortador.</p>
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
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', minWidth: '180px' }}>
                    Tela / Color
                  </th>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', minWidth: '180px' }}>
                    Producto Relacionado
                  </th>
                  <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
                    Capas Prog.
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
                  const color = getColorData(cut.color_id);
                  const productName = getProductName(cut.product_id);
                  
                  // Compute total prendas for this cut row
                  const totalPrendas = cut.cut_sizes.reduce((sum: number, cs: any) => sum + (Number(cs.quantity) || 0), 0);

                  return (
                    <tr key={cut.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? 'white' : '#f8fafc' }}>
                      <td style={{ padding: '1rem', textAlign: 'left', fontWeight: '850', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ 
                            width: '14px', 
                            height: '14px', 
                            borderRadius: '50%', 
                            backgroundColor: color?.hex_color || '#cbd5e1',
                            border: '1px solid #94a3b8'
                          }}></div>
                          <span>{color?.nombre_color || 'Manual / Sin Color'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.8rem', color: '#475569', fontWeight: '700' }}>
                        {productName}
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: '800', color: '#334155' }}>
                        {cut.layers || 0}
                      </td>
                      {activeSizes.map(size => {
                        const qty = cut.cut_sizes.find((cs: any) => cs.size_id === size.id || cs.size_id === Number(size.id))?.quantity || 0;
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
                const color = getColorData(cut.color_id);
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
                          value={input.actualKilos}
                          onChange={e => setActualCutsData({
                            ...actualCutsData,
                            [cut.id]: { ...input, actualKilos: Number(e.target.value) || 0 }
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
                  const color = getColorData(cut.color_id);
                  const totalPrendas = cut.cut_sizes.reduce((sum: number, cs: any) => sum + (Number(cs.quantity) || 0), 0);
                  
                  return (
                    <div key={cut.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                      <span style={{ fontWeight: '750', color: '#475569' }}>{color?.nombre_color || 'Tela'}</span>
                      <div style={{ textAlign: 'right', fontWeight: '800', color: '#1e293b' }}>
                        <div>{cut.layers} capas | {cut.kilos} kg</div>
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
    </div>
  );
}
