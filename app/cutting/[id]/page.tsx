'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { syncOrderMovements } from '@/lib/inventory-sync';
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
  Trash2,
  Bell,
  ChevronRight,
  Package
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
  const [novelties, setNovelties] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Cutter inputs
  const [cutterNotes, setCutterNotes] = useState('');
  const [actualCutsData, setActualCutsData] = useState<Record<number, { actualLayers: number; actualKilos: number }>>({});

  // Partial progress modal states
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [progressLayers, setProgressLayers] = useState<Record<string, string>>({});
  const [selectedGroupKey, setSelectedGroupKey] = useState('');
  const [selectedGroupLayers, setSelectedGroupLayers] = useState('');

  // ── New orders notification system ────────────────────────────────────────
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [showNewOrdersModal, setShowNewOrdersModal] = useState(false);
  const [newArrivals, setNewArrivals] = useState<any[]>([]);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPendingOrders = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('orders')
        .select('id, internal_code, status, created_at, cortador_name, scheduled_date')
        .in('status', ['Planeada', 'En Corte'])
        .order('created_at', { ascending: false });

      const filtered = (data || []).filter((o: any) => String(o.id) !== String(orderId));
      setPendingOrders(filtered);

      // Detect truly NEW orders (not seen before)
      if (knownOrderIdsRef.current.size > 0) {
        const arrivals = filtered.filter((o: any) => !knownOrderIdsRef.current.has(String(o.id)));
        if (arrivals.length > 0) {
          setNewArrivals(arrivals);
          setShowNewOrdersModal(true);
        }
      }
      // Update known set
      knownOrderIdsRef.current = new Set(filtered.map((o: any) => String(o.id)));
    } catch (err) {
      console.error('Error polling pending orders:', err);
    }
  }, [orderId]);

  // Start polling on mount, stop on unmount
  useEffect(() => {
    fetchPendingOrders();
    pollIntervalRef.current = setInterval(fetchPendingOrders, 30000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [fetchPendingOrders]);
  // ──────────────────────────────────────────────────────────────────────────

  const parseObservations = (obs: string) => {
    if (!obs) return [];
    const blocks: { title: string; content: string }[] = [];
    const firstSepIdx = obs.indexOf('===');
    if (firstSepIdx === -1) {
      blocks.push({
        title: 'Nota de Creación / Orden',
        content: obs.trim()
      });
      return blocks;
    }
    const initialNote = obs.substring(0, firstSepIdx).trim();
    if (initialNote) {
      blocks.push({
        title: 'Nota de Creación / Orden',
        content: initialNote
      });
    }
    const regex = /===\s*([^=]+?)\s*===\n([\s\S]*?)(?=(===\s*[^=]+?\s*===|$))/g;
    let match;
    while ((match = regex.exec(obs)) !== null) {
      blocks.push({
        title: match[1].trim(),
        content: match[2].trim()
      });
    }
    return blocks;
  };
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
      let pData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (error || !data || data.length === 0) break;
        pData = pData.concat(data);
        if (data.length < pageSize) break;
        page++;
      }
      const { data: cData } = await supabase.from('colors').select('*');
      const { data: sData } = await supabase.from('sizes').select('*').order('orden_visual', { ascending: true });
      const { data: catData } = await supabase.from('categories').select('*');
      const { data: fData } = await supabase.from('fabrics').select('*');
      const { data: nData } = await supabase.from('novelties').select('*').order('nombre', { ascending: true });
      
      setProducts(pData || []);
      setColors(cData || []);
      setSizes(sData || []);
      setCategories(catData || []);
      setFabrics(fData || []);
      setNovelties(nData || []);

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
      await syncOrderMovements(String(orderId), 'En Corte');
      
      setOrder({ ...order, status: 'En Corte' });
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFinishCut = async () => {
    if (!orderId) return;
    if (!confirm('¿Estás seguro de que deseas finalizar y registrar este tendido? Esta acción cambiará el estado de la orden a "Tendido".')) return;
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
      
      const noveltiesStr = progressNovelties.length > 0 
        ? progressNovelties.map(n => `- Capa ${n.capa}: ${n.tipo}`).join('\n')
        : '';
        
      if (noveltiesStr || cutterNotes.trim()) {
        finalObservations += `\n\n=== REPORTE DE TENDIDO (${new Date().toLocaleDateString('es-ES')}) ===`;
        if (noveltiesStr) {
          finalObservations += `\nNovedades de corte por capa:\n${noveltiesStr}`;
        }
        if (cutterNotes.trim()) {
          finalObservations += `\nNotas: ${cutterNotes}`;
        }
      }

      // 3. Update Order status to 'Tendido' and save observations
      const { error: orderErr } = await supabase
        .from('orders')
        .update({ 
          status: 'Tendido',
          observaciones: finalObservations
        })
        .eq('id', orderId);

      if (orderErr) throw orderErr;

      await syncOrderMovements(String(orderId), 'Tendido');

      alert('¡Tendido completado y registrado con éxito!');
      router.push('/cutting');
    } catch (err: any) {
      alert('Error al guardar el registro de corte: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId) return;

    if (!selectedGroupKey) {
      alert("Por favor selecciona la tela tendida.");
      return;
    }
    const layersToAdd = Number(selectedGroupLayers) || 0;
    if (layersToAdd <= 0) {
      alert("Por favor ingresa una cantidad de capas tendidas válida.");
      return;
    }

    setProgressSaving(true);
    
    try {
      let progressLog = '';
      const [strokeValStr, fabOrColPrefix, subId] = selectedGroupKey.split('_');
      const strokeVal = Number(strokeValStr);

      for (const cut of cuts) {
        const matchesGroup = Number(cut.stroke_length ?? 0) === strokeVal && (
          (fabOrColPrefix === 'fab' && String(cut.fabric_id) === subId) ||
          (fabOrColPrefix === 'col' && String(cut.color_id) === subId)
        );

        if (!matchesGroup) continue;

        const newLayersProduced = (cut.layers_produced || 0) + layersToAdd;

        // 1. Update cuts table — solo layers_produced
        const { error: cutErr } = await supabase
          .from('cuts')
          .update({ layers_produced: newLayersProduced })
          .eq('id', cut.id);
        
        if (cutErr) throw cutErr;
      }

      // Resolve fabric name and stroke label
      const isFab = fabOrColPrefix === 'fab';
      const fabricObj = fabrics.find((f: any) => String(f.id) === subId);
      const colorData = isFab ? null : colors.find((c: any) => String(c.id) === subId);
      const telaName = fabricObj ? fabricObj.nombre_tela : (colorData?.nombre_color || 'Tela');
      const strokeName = getStrokeLabel(strokeVal);

      progressLog += `\n- [${strokeName}] Tela: ${telaName} | ${layersToAdd} capas tendidas`;
      
      const timeStamp = new Date().toLocaleString('es-ES');
      
      // Formatear novedades de corte por capa con asociación de tela
      const noveltiesStr = progressNovelties.length > 0 
        ? progressNovelties.map(n => `- Capa ${n.capa} - Novedad: ${n.tipo} | Tela: ${telaName}`).join('\n')
        : 'Ninguna novedad reportada.';

      const finalLog = `\n\n=== AVANCE PARCIAL (${timeStamp}) ===${progressLog}\nNovedades de corte por capa:\n${noveltiesStr}\nNotas: ${progressNotes || 'Sin observaciones adicionales.'}`;
      
      const newObservations = (order.observaciones || '') + finalLog;

      const { error: orderErr } = await supabase
        .from('orders')
        .update({ observaciones: newObservations })
        .eq('id', orderId);

      if (orderErr) throw orderErr;

      await syncOrderMovements(String(orderId), order.status || 'En Corte');

      alert('Avance parcial registrado con éxito.');
      setShowProgressModal(false);
      setSelectedGroupKey('');
      setSelectedGroupLayers('');
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

  const getStrokeLabel = (stroke: any): string => {
    const uniqueStrokes: number[] = Array.from(
      new Set(cuts.map((c: any) => Number(c.stroke_length ?? 0)))
    ).sort((a, b) => b - a);
    const idx = uniqueStrokes.indexOf(Number(stroke ?? 0));
    return idx === 0 ? 'Corte 1' : `Corte ${(idx < 0 ? 0 : idx) + 1}`;
  };

  // Determine active size columns based on what's configured in the cut sizes
  const activeSizes = sizes.filter(size => 
    cuts.some(cut => cut.cut_sizes.some((cs: any) => String(cs.size_id) === String(size.id)))
  );

  // Group cuts by fabric color & product to display cleanly
  const isPending = order.status === 'Planeada';
  const isActive = order.status === 'En Corte';
  const isCompleted = order.status === 'Tendido' || order.status === 'Cortado';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '3rem' }}>
      
      {/* Top Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link href="/cutting" className="btn btn-secondary" style={{ padding: '0.6rem', borderRadius: '10px' }}>
          <ArrowLeft size={18} />
        </Link>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
            Mesa de Tendido
          </span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '950', margin: 0, color: '#0f172a' }}>
            Ficha de Tendido Físico: OC-{order.internal_code}
          </h1>
        </div>
      </div>

      {/* ── BANNER: Órdenes pendientes de tendido ─────────────────────────── */}
      {pendingOrders.length > 0 && (
        <div
          onClick={() => setShowNewOrdersModal(true)}
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            borderRadius: '14px',
            padding: '0.875rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(124,58,237,0.35)',
            transition: 'transform 0.15s',
            userSelect: 'none'
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.01)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Bell size={22} style={{ color: 'white' }} />
            <span style={{
              position: 'absolute', top: '-4px', right: '-4px',
              width: '10px', height: '10px', borderRadius: '50%',
              backgroundColor: '#fbbf24',
              border: '2px solid white'
            }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: '900', fontSize: '0.9rem', color: 'white' }}>
              {pendingOrders.length === 1
                ? '1 orden nueva lista para tender'
                : `${pendingOrders.length} órdenes nuevas listas para tender`}
            </p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>
              {pendingOrders.slice(0, 4).map((o: any) => `OC-${o.internal_code}`).join(' · ')}
              {pendingOrders.length > 4 ? ` y ${pendingOrders.length - 4} más` : ''} — Haz clic para ver detalle
            </p>
          </div>
          <ChevronRight size={20} style={{ color: 'rgba(255,255,255,0.7)', flexShrink: 0 }} />
        </div>
      )}

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
                  <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#1e293b' }}>
                    {order?.largo_trazo ? `${Number(order.largo_trazo).toFixed(2)} mts` : cuts[0]?.stroke_length ? `${Number(cuts[0].stroke_length).toFixed(2)} mts` : '—'}
                  </span>
                </div>
              </div>
            </div>


          </div>

          {/* Technical Cut Sheet Matrix */}
          <div className="card" style={{ padding: '2rem', borderRadius: '16px', overflowX: 'auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '950', color: '#0f172a', margin: '0 0 1.5rem 0' }}>
              Programación Capas a Tender
            </h3>
            {(() => {
              // Ordenar stroke_lengths NUMÉRICAMENTE (no como string) para que el corte de mayor longitud = Corte 1 (corte principal)
              const uniqueStrokes: number[] = Array.from(
                new Set(cuts.map((c: any) => Number(c.stroke_length ?? 0)))
              ).sort((a, b) => b - a); // Descendente: mayor longitud = Corte 1 (orden principal)

              const strokeIdx = (s: any): number => {
                const idx = uniqueStrokes.indexOf(Number(s ?? 0));
                return idx < 0 ? 0 : idx;
              };
              const strokeLabel = (s: any): string => {
                const idx = strokeIdx(s);
                return idx === 0 ? 'Corte 1' : `Corte ${idx + 1}`;
              };
              const palette = [
                { bg: '#eef2ff', color: '#4f46e5', border: '#c7d2fe', headerBg: 'linear-gradient(90deg, #4f46e5 0%, #6366f1 100%)', icon: '✂️' },
                { bg: '#dcfce7', color: '#16a34a', border: '#86efac', headerBg: 'linear-gradient(90deg, #16a34a 0%, #22c55e 100%)', icon: '✂️' },
                { bg: '#fef3c7', color: '#d97706', border: '#fcd34d', headerBg: 'linear-gradient(90deg, #d97706 0%, #f59e0b 100%)', icon: '✂️' },
                { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5', headerBg: 'linear-gradient(90deg, #dc2626 0%, #ef4444 100%)', icon: '✂️' },
              ];
              const strokeBadgeStyle = (s: any): React.CSSProperties => {
                const p = palette[strokeIdx(s) % palette.length];
                return { backgroundColor: p.bg, color: p.color, border: `1.5px solid ${p.border}`, borderRadius: '999px', padding: '0.2rem 0.75rem', fontSize: '0.7rem', fontWeight: '900', whiteSpace: 'nowrap' as const };
              };

              // Agrupar cuts por stroke_length, manteniendo orden de grupos
              const groupsMap = new Map<number, any[]>();
              [...cuts]
                .sort((a: any, b: any) => Number(b.stroke_length ?? 0) - Number(a.stroke_length ?? 0))
                .forEach((cut: any) => {
                  const k = Number(cut.stroke_length ?? 0);
                  if (!groupsMap.has(k)) groupsMap.set(k, []);
                  groupsMap.get(k)!.push(cut);
                });

              const rows: React.ReactNode[] = [];
              let globalIdx = 0;

              groupsMap.forEach((groupCuts, strokeVal) => {
                const corteIdx = strokeIdx(strokeVal);
                const p = palette[corteIdx % palette.length];
                const label = strokeLabel(strokeVal);

                // ── FILA SEPARADORA / HEADER DEL GRUPO ──
                rows.push(
                  <tr key={`header-${strokeVal}`}>
                    <td colSpan={7} style={{ padding: 0 }}>
                      <div style={{
                        background: p.headerBg,
                        padding: '0.55rem 1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        marginTop: corteIdx === 0 ? 0 : '0.25rem',
                      }}>
                        <span style={{ fontSize: '0.95rem' }}>✂️</span>
                        <span style={{ color: 'white', fontWeight: '900', fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                          {label}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem', fontWeight: '600' }}>
                          — Largo de Trazo: {Number(strokeVal).toFixed(2)} m
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem', fontWeight: '600', marginLeft: '1rem' }}>
                          — Metros Totales: {(() => {
                            const groupLayers = groupCuts[0]?.layers ? Math.max(...groupCuts.map((c: any) => Number(c.layers) || 0)) : 0;
                            return (strokeVal * groupLayers).toFixed(2);
                          })()} m
                        </span>
                        <span style={{
                          marginLeft: 'auto',
                          backgroundColor: 'rgba(255,255,255,0.2)',
                          color: 'white',
                          borderRadius: '999px',
                          padding: '0.15rem 0.6rem',
                          fontSize: '0.68rem',
                          fontWeight: '800'
                        }}>
                          {groupCuts.length} tela{groupCuts.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </td>
                  </tr>
                );

                // Group cuts within the stroke group by fabric/color
                const fabricGroupsMap = new Map<string, any>();
                groupCuts.forEach((cut: any) => {
                  const key = cut.fabric_id ? `fab_${cut.fabric_id}` : `col_${cut.color_id || 'none'}`;
                  const totalPrendas = cut.cut_sizes?.reduce((sum: number, cs: any) => sum + (Number(cs.quantity) || 0), 0) || 0;
                  
                  if (!fabricGroupsMap.has(key)) {
                    fabricGroupsMap.set(key, {
                      key,
                      fabric_id: cut.fabric_id,
                      color_id: cut.color_id,
                      stroke_length: cut.stroke_length,
                      kilos: Number(cut.kilos || 0),
                      layers: Number(cut.layers || 0),
                      layers_produced: Number(cut.layers_produced || 0),
                      totalPrendas: totalPrendas
                    });
                  } else {
                    const existing = fabricGroupsMap.get(key);
                    existing.kilos += Number(cut.kilos || 0);
                    existing.layers = Math.max(existing.layers, Number(cut.layers || 0));
                    existing.layers_produced = Math.max(existing.layers_produced, Number(cut.layers_produced || 0));
                    existing.totalPrendas += totalPrendas;
                  }
                });

                // Filas de telas del grupo
                Array.from(fabricGroupsMap.values()).forEach((groupedCut: any) => {
                  const color = getColorData(groupedCut.color_id, groupedCut);
                  const fabricObj = fabrics.find((f: any) => String(f.id) === String(groupedCut.fabric_id));
                  const telaName = fabricObj ? fabricObj.nombre_tela : (color?.nombre_color || 'Sin Tela');
                  const colorHex = color?.hex_color || '#cbd5e1';
                  
                  const totalPrendas = groupedCut.totalPrendas;
                  const capasPlaneadas = groupedCut.layers;
                  const capasProducidas = groupedCut.layers_produced;
                  const capasRestantes = Math.max(0, capasPlaneadas - capasProducidas);
                  const porcentajeProd = capasPlaneadas > 0 ? Math.min(100, Math.round((capasProducidas / capasPlaneadas) * 100)) : 0;
                  const porcentajeRestante = 100 - porcentajeProd;
                  const rowBg = globalIdx % 2 === 0 ? 'white' : `${p.bg}88`;
                  globalIdx++;

                  rows.push(
                    <tr key={groupedCut.key} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: rowBg }}>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <span style={strokeBadgeStyle(groupedCut.stroke_length)}>{label}</span>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: '700' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: colorHex, border: '1px solid #94a3b8', flexShrink: 0 }}></div>
                          <div style={{ fontWeight: '800', color: '#1e293b' }}>{telaName}</div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.9rem', fontWeight: '800', color: '#10b981' }}>
                        {(Number(groupedCut.stroke_length) * Number(groupedCut.layers)).toFixed(2)} m
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.9rem', fontWeight: '800', color: '#b45309' }}>{Number(groupedCut.kilos || 0).toFixed(2)} kg</td>
                      <td style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: '800' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                            <span style={{ fontSize: '1rem', fontWeight: '900', color: capasRestantes === 0 ? '#059669' : p.color }}>{capasRestantes}</span>
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: '600' }}>/ {capasPlaneadas}</span>
                          </div>
                          {capasPlaneadas > 0 && (
                            <div style={{ width: '70px', height: '5px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${porcentajeRestante}%`, backgroundColor: porcentajeRestante <= 0 ? '#059669' : p.color, borderRadius: '3px', transition: 'width 0.4s ease' }}></div>
                            </div>
                          )}
                          <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>{porcentajeRestante}% restante</span>
                        </div>
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: '800' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                          <span style={{ fontSize: '1rem', fontWeight: '900', color: porcentajeProd >= 100 ? '#059669' : porcentajeProd > 50 ? '#d97706' : capasProducidas > 0 ? '#3b82f6' : '#94a3b8' }}>{capasProducidas}</span>
                          {capasPlaneadas > 0 && (
                            <div style={{ width: '70px', height: '5px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${porcentajeProd}%`, backgroundColor: porcentajeProd >= 100 ? '#059669' : porcentajeProd > 50 ? '#d97706' : '#3b82f6', borderRadius: '3px', transition: 'width 0.4s ease' }}></div>
                            </div>
                          )}
                          <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>{porcentajeProd}% completado</span>
                        </div>
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.9rem', fontWeight: '900', color: 'var(--primary)' }}>{totalPrendas} unds</td>
                    </tr>
                  );
                });
              });

              return (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2.5px solid #e2e8f0' }}>
                      <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Corte</th>
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Tela</th>
                      <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', color: '#10b981', textTransform: 'uppercase' }}>Metros Planificados</th>
                      <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', color: '#b45309', textTransform: 'uppercase' }}>Estimación Kilos</th>
                      <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', color: '#6366f1', textTransform: 'uppercase', minWidth: '130px' }}>Capas Programadas</th>
                      <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', color: '#059669', textTransform: 'uppercase', minWidth: '130px' }}>Capas Producidas</th>
                      <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Prendas Totales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuts.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding: '2rem', color: '#94a3b8', fontSize: '0.9rem' }}>No hay programaciones cargadas.</td></tr>
                    ) : rows}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </div>

        {/* Right Side: Cutter Workshop Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Notes and Observations Box */}
          <div 
            onClick={() => setShowNotesModal(true)}
            className="card" 
            style={{ 
              backgroundColor: '#fffbeb', 
              border: '1.5px solid #fef08a', 
              borderRadius: '16px',
              padding: '1.5rem',
              cursor: 'pointer',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <BookOpen size={18} style={{ color: '#b45309' }} />
              <h3 style={{ fontSize: '0.85rem', fontWeight: '900', color: '#78350f', margin: 0, textTransform: 'uppercase' }}>
                Última Nota de Corte
              </h3>
            </div>
            
            {(() => {
              const blocks = parseObservations(order?.observaciones);
              if (blocks.length === 0) {
                return <p style={{ fontSize: '0.8rem', color: '#92400e', margin: 0, fontWeight: '600', fontStyle: 'italic' }}>Sin observaciones registradas.</p>;
              }
              const lastBlock = blocks[blocks.length - 1];
              const preview = lastBlock.content.length > 100 
                ? lastBlock.content.substring(0, 100) + '...'
                : lastBlock.content;
                
              return (
                <div>
                  <div style={{ fontSize: '0.68rem', color: '#b45309', fontWeight: '800', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                    {lastBlock.title}
                  </div>
                  <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.825rem', color: '#92400e', whiteSpace: 'pre-wrap', lineHeight: '1.4', fontWeight: '600' }}>
                    {preview}
                  </p>
                  <span style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: '800', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    Ver historial completo ({blocks.length} nota{blocks.length !== 1 ? 's' : ''}) →
                  </span>
                </div>
              );
            })()}
          </div>

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
                  <Play size={18} style={{ marginRight: '0.5rem' }} /> Iniciar Tendido
                </button>
              </div>
            )}

            {isActive && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <p style={{ fontSize: '0.85rem', opacity: 0.9, lineHeight: '1.4', margin: 0 }}>
                  El tendido está actualmente <strong>En Mesa</strong>. Verifique y complete las cantidades reales extendidas en el taller.
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
                  <p style={{ fontSize: '0.8rem', fontWeight: '800', margin: 0 }}>Tendido Completado</p>
                  <p style={{ fontSize: '0.7rem', opacity: 0.8, margin: 0 }}>La información del tendido ha sido guardada. Pendiente de proceso de corte.</p>
                </div>
              </div>
            )}
          </div>

          {/* Form: Interactive Adjustments (Only active when in corte) */}
          {isActive && (
            <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              
              {/* Novedades por Capa on Main Page */}
              <div style={{ border: '1.5px solid #cbd5e1', borderRadius: '12px', padding: '1rem', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase' }}>Novedades de Corte (Por Capa)</label>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr auto', gap: '0.5rem', alignItems: 'end', marginBottom: '0.5rem' }}>
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
                      {novelties.map((nov: any) => (
                        <option key={nov.id} value={nov.nombre}>
                          {nov.nombre}
                        </option>
                      ))}
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
                      fontSize: '0.85rem'
                    }}
                  >
                    +
                  </button>
                </div>

                {progressNovelties.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {progressNovelties.map((n, index) => (
                      <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.75rem', fontWeight: '700' }}>
                        <span>Capa {n.capa}: {n.tipo}</span>
                        <button 
                          type="button"
                          onClick={() => setProgressNovelties(progressNovelties.filter((_, idx) => idx !== index))}
                          style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

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
                <CheckCircle size={18} style={{ marginRight: '0.5rem' }} /> Finalizar y Registrar Tendido
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
              {/* Selector de Tela Tendida */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Selecciona Tela Tendida</label>
                {(() => {
                  const uniqueStrokes: number[] = Array.from(
                    new Set(cuts.map((c: any) => Number(c.stroke_length ?? 0)))
                  ).sort((a, b) => b - a);

                  const strokeIdx = (s: any): number => {
                    const idx = uniqueStrokes.indexOf(Number(s ?? 0));
                    return idx < 0 ? 0 : idx;
                  };
                  const strokeLabel = (s: any): string => {
                    const idx = strokeIdx(s);
                    return idx === 0 ? 'Corte 1' : `Corte ${idx + 1}`;
                  };

                  const groupsMap = new Map<number, any[]>();
                  [...cuts]
                    .sort((a: any, b: any) => Number(b.stroke_length ?? 0) - Number(a.stroke_length ?? 0))
                    .forEach((cut: any) => {
                      const k = Number(cut.stroke_length ?? 0);
                      if (!groupsMap.has(k)) groupsMap.set(k, []);
                      groupsMap.get(k)!.push(cut);
                    });

                  const groupedRows: any[] = [];
                  groupsMap.forEach((groupCuts, strokeVal) => {
                    const label = strokeLabel(strokeVal);

                    const fabricGroupsMap = new Map<string, any>();
                    groupCuts.forEach((cut: any) => {
                      const key = cut.fabric_id ? `fab_${cut.fabric_id}` : `col_${cut.color_id || 'none'}`;
                      if (!fabricGroupsMap.has(key)) {
                        fabricGroupsMap.set(key, {
                          key: `${strokeVal}_${key}`,
                          fabric_id: cut.fabric_id,
                          color_id: cut.color_id,
                          stroke_length: cut.stroke_length,
                          layers: Number(cut.layers || 0),
                          layers_produced: Number(cut.layers_produced || 0),
                        });
                      } else {
                        const existing = fabricGroupsMap.get(key);
                        existing.layers = Math.max(existing.layers, Number(cut.layers || 0));
                        existing.layers_produced = Math.max(existing.layers_produced, Number(cut.layers_produced || 0));
                      }
                    });

                    Array.from(fabricGroupsMap.values()).forEach((groupedCut: any) => {
                      groupedRows.push({
                        ...groupedCut,
                        strokeLabel: label
                      });
                    });
                  });

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <select
                        value={selectedGroupKey}
                        onChange={e => setSelectedGroupKey(e.target.value)}
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '600', color: '#1e293b' }}
                      >
                        <option value="">Selecciona la tela...</option>
                        {groupedRows.map(gr => {
                          const colorDat = getColorData(gr.color_id, gr);
                          const fabricObj = fabrics.find((f: any) => String(f.id) === String(gr.fabric_id));
                          const telaName = fabricObj ? fabricObj.nombre_tela : (colorDat?.nombre_color || 'Sin Tela');
                          return (
                            <option key={gr.key} value={gr.key}>
                              [{gr.strokeLabel}] {telaName} ({gr.layers_produced} / {gr.layers} capas)
                            </option>
                          );
                        })}
                      </select>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Capas a reportar</label>
                        <input
                          type="number"
                          min="1"
                          value={selectedGroupLayers}
                          onChange={e => setSelectedGroupLayers(e.target.value)}
                          style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '750' }}
                          placeholder="Ingresa la cantidad de capas tendidas..."
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Novedades de Corte Section */}
              <div style={{ border: '1.5px solid #cbd5e1', borderRadius: '12px', padding: '1rem', backgroundColor: '#f8fafc' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#1e293b', marginBottom: '0.75rem', textTransform: 'uppercase' }}>Novedades de Corte (Por Capa)</label>
                
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
                      <option value="">Selecciona novedad...</option>
                      {(() => {
                        const modules: string[] = Array.from(new Set(novelties.map((n: any) => n.modulo_relac || 'General'))) as string[];
                        return modules.map((mod: string) => (
                          <optgroup key={mod} label={`── ${mod} ──`}>
                            {novelties
                              .filter((n: any) => (n.modulo_relac || 'General') === mod)
                              .map((nov: any) => (
                                <option key={nov.id} value={nov.nombre}>
                                  {nov.cod_novedad ? `[${nov.cod_novedad}] ` : ''}{nov.nombre}{nov.criticidad ? ` · ${nov.criticidad}` : ''}
                                </option>
                              ))}
                          </optgroup>
                        ));
                      })()}
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
                    <th style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.7rem', textAlign: 'left' }}>CATEGORÍA</th>
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
                      const fabricObj = fabrics.find(f => String(f.id) === String(cut.fabric_id));
                      const colorObj = getColorData(cut.color_id, cut);
                      const telaName = fabricObj ? fabricObj.nombre_tela : (colorObj ? colorObj.nombre_color : '---');
                      const prodObj = products.find(p => String(p.id) === String(cut.product_id));
                      const catObj = prodObj ? categories.find(c => String(c.id) === String(prodObj.category_id)) : null;
                      const catName = catObj ? (catObj.categoria || '---') : '---';
                      
                      return cut.cut_sizes.filter((cs: any) => Number(cs.quantity) > 0).map((cs: any, i: number) => {
                        const sizeObj = sizes.find(s => String(s.id) === String(cs.size_id));
                        const capas = Number(cut.layers) || 1;
                        const marc = (Number(cs.quantity) / capas).toFixed(2);
                        return (
                          <tr key={`${cut.id}-${cs.size_id}`} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                            <td style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.8rem', fontWeight: '700' }}>{telaName}</td>
                            <td style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.8rem' }}>{catName}</td>
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

      {/* Historial de Notas y Observaciones Modal */}
      {showNotesModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '650px', backgroundColor: 'white', borderRadius: '20px', overflow: 'hidden', padding: 0, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 60px -10px rgba(0, 0, 0, 0.6)' }}>
            <div style={{ padding: '1.5rem 2rem', background: 'linear-gradient(135deg, #0f172a, #1e3a5f)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '20px 20px 0 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BookOpen size={20} style={{ color: 'white' }} />
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '950', color: 'white' }}>Historial de Notas y Observaciones</h3>
              </div>
              <button onClick={() => setShowNotesModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }}><X size={24} /></button>
            </div>
            
            <div style={{ padding: '2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {(() => {
                const blocks = parseObservations(order?.observaciones);
                if (blocks.length === 0) {
                  return <p style={{ fontSize: '0.9rem', color: '#64748b', textAlign: 'center', fontStyle: 'italic', margin: '2rem 0' }}>No hay notas registradas para esta orden.</p>;
                }
                
                return blocks.map((block, i) => (
                  <div 
                    key={i} 
                    style={{ 
                      backgroundColor: '#fffbeb', 
                      border: '1.5px solid #fef08a', 
                      borderRadius: '12px',
                      padding: '1.25rem',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed #fde047', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '900', color: '#78350f', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {block.title}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#b45309', fontWeight: '700' }}>
                        Nota #{i + 1}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#92400e', whiteSpace: 'pre-wrap', lineHeight: '1.5', fontWeight: '600' }}>
                      {block.content}
                    </p>
                  </div>
                ));
              })()}
            </div>
            
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNotesModal(false)} className="btn btn-secondary" style={{ padding: '0.75rem 1.5rem', fontWeight: '800' }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Nuevas órdenes para tender ─────────────────────────────── */}
      {showNewOrdersModal && (
        <div style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(15,23,42,0.7)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '560px',
            overflow: 'hidden',
            boxShadow: '0 25px 60px rgba(0,0,0,0.3)'
          }}>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              padding: '1.5rem 2rem',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '14px',
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Bell size={24} style={{ color: 'white' }} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '950', color: 'white' }}>
                    {newArrivals.length > 0
                      ? `🆕 ${newArrivals.length === 1 ? 'Nueva orden' : `${newArrivals.length} nuevas órdenes`} para tender`
                      : 'Órdenes pendientes de tendido'}
                  </h2>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>
                    {pendingOrders.length} orden{pendingOrders.length !== 1 ? 'es' : ''} esperando en mesa
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setShowNewOrdersModal(false); setNewArrivals([]); }}
                style={{
                  background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
                  borderRadius: '10px', width: '36px', height: '36px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontSize: '1rem', fontWeight: '900'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Orders list */}
            <div style={{ maxHeight: '380px', overflowY: 'auto', padding: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {pendingOrders.map((o: any) => {
                  const isNew = newArrivals.some((a: any) => a.id === o.id);
                  return (
                    <a
                      key={o.id}
                      href={`/cutting/${o.id}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '1rem',
                        padding: '1rem 1.25rem',
                        borderRadius: '12px',
                        border: isNew ? '2px solid #7c3aed' : '1.5px solid #e2e8f0',
                        backgroundColor: isNew ? '#faf5ff' : '#f8fafc',
                        textDecoration: 'none',
                        transition: 'all 0.15s',
                        cursor: 'pointer',
                        position: 'relative'
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = isNew ? '#f3e8ff' : '#f1f5f9'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = isNew ? '#faf5ff' : '#f8fafc'; }}
                    >
                      {isNew && (
                        <span style={{
                          position: 'absolute', top: '-8px', right: '12px',
                          background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                          color: 'white', fontSize: '0.65rem', fontWeight: '900',
                          padding: '2px 8px', borderRadius: '999px',
                          letterSpacing: '0.05em'
                        }}>NUEVA</span>
                      )}
                      {/* Icon */}
                      <div style={{
                        width: '42px', height: '42px', borderRadius: '10px', flexShrink: 0,
                        backgroundColor: isNew ? '#ede9fe' : '#e2e8f0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <Scissors size={18} style={{ color: isNew ? '#7c3aed' : '#64748b' }} />
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: '900', fontSize: '1rem', color: '#0f172a' }}>
                            OC-{o.internal_code}
                          </span>
                          <span style={{
                            fontSize: '0.7rem', fontWeight: '700', padding: '2px 8px',
                            borderRadius: '999px',
                            backgroundColor: o.status === 'En Corte' ? '#dbeafe' : '#fef3c7',
                            color: o.status === 'En Corte' ? '#1d4ed8' : '#92400e'
                          }}>{o.status}</span>
                        </div>
                        <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                          {o.cortador_name ? `Cortador: ${o.cortador_name}` : 'Sin cortador asignado'}
                          {o.scheduled_date ? ` · ${new Date(o.scheduled_date).toLocaleDateString('es-ES')}` : ''}
                        </p>
                      </div>
                      <ChevronRight size={18} style={{ color: '#94a3b8', flexShrink: 0 }} />
                    </a>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '1rem 1.25rem',
              borderTop: '1px solid #f1f5f9',
              backgroundColor: '#fafafa',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem'
            }}>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                Se actualiza cada 30 segundos automáticamente
              </p>
              <button
                onClick={() => { setShowNewOrdersModal(false); setNewArrivals([]); }}
                style={{
                  padding: '0.625rem 1.5rem', borderRadius: '10px',
                  background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  color: 'white', border: 'none', fontWeight: '800',
                  fontSize: '0.875rem', cursor: 'pointer'
                }}
              >
                Continuar aquí
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
