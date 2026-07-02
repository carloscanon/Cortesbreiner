'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  ArrowUpRight,
  Plus,
  Clock,
  CheckCircle2,
  Scissors,
  Package,
  X,
  TrendingUp,
  AlertCircle,
  Layers,
  ChevronRight,
  BarChart2,
  Factory,
  DollarSign,
  ClipboardCheck,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#059669', '#6366f1', '#f59e0b', '#e2e8f0'];

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  Planeada:  { label: 'Planeada',   bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  'En Corte':{ label: 'En Corte',   bg: '#fffbeb', color: '#b45309', border: '#fef08a' },
  Cortado:   { label: 'Cortado',    bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
  Pendiente: { label: 'Pendiente',  bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
};

type Order = {
  id: string;
  internal_code: string;
  status: string;
  cortador_name: string | null;
  scheduled_date: string | null;
  created_at: string;
  observaciones: string | null;
  workshop_id: string | null;
  client_name: string | null;
  workshops: { nombre_taller: string; responsable: string } | null;
  cuts: any[] | null;
  fabrics: { nombre_tela: string } | null;
};

type ModalType = 'total' | 'cortadas' | 'en_proceso' | 'pendientes' | null;

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon, primary, onClick,
}: {
  label: string; value: number | string; sub: string;
  icon: React.ReactNode; primary?: boolean; onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="card stat-card"
      style={{
        backgroundColor: primary ? 'var(--primary)' : 'white',
        color: primary ? 'white' : 'inherit',
        cursor: onClick ? 'pointer' : 'default',
        transform: hovered && onClick ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: hovered && onClick
          ? primary
            ? '0 20px 40px -10px rgba(99,102,241,0.45)'
            : '0 12px 28px -6px rgba(0,0,0,0.12)'
          : '0 1px 3px rgba(0,0,0,0.06)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{ fontSize: '0.8rem', opacity: primary ? 0.85 : 1, fontWeight: '700', color: primary ? 'rgba(255,255,255,0.85)' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {label}
          </span>
          <div style={{ fontSize: '2.2rem', fontWeight: '950', lineHeight: 1.1, margin: '0.4rem 0 0.5rem' }}>
            {value}
          </div>
          <div style={{ fontSize: '0.75rem', opacity: 0.75, fontWeight: '600' }}>{sub}</div>
        </div>
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px',
          backgroundColor: primary ? 'rgba(255,255,255,0.15)' : '#f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: primary ? 'white' : 'var(--primary)',
        }}>
          {icon}
        </div>
      </div>
      {onClick && (
        <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', opacity: 0.8, fontWeight: '700' }}>
          <ChevronRight size={13} />
          <span>Ver detalle</span>
        </div>
      )}
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({
  title, subtitle, orders, onClose, accentColor,
}: {
  title: string; subtitle: string; orders: Order[];
  onClose: () => void; accentColor: string;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(15,23,42,0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000, padding: '1rem',
        animation: 'fadeIn 0.15s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: '20px', width: '100%', maxWidth: '640px',
          maxHeight: '80vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 40px 80px -20px rgba(0,0,0,0.3)',
          animation: 'slideUp 0.2s ease',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '1.5rem 2rem', borderBottom: '1px solid #f1f5f9',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          background: `linear-gradient(135deg, ${accentColor}10 0%, white 60%)`,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: accentColor }} />
              <span style={{ fontSize: '0.7rem', fontWeight: '800', color: accentColor, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{subtitle}</span>
            </div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '950', color: '#0f172a' }}>{title}</h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#64748b', fontWeight: '600' }}>
              {orders.length} orden{orders.length !== 1 ? 'es' : ''} encontrada{orders.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: '#f1f5f9', border: 'none', borderRadius: '10px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', flexShrink: 0 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', padding: '1rem 2rem 1.5rem' }}>
          {orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: '#94a3b8' }}>
              <Package size={40} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
              <p style={{ fontWeight: '700', fontSize: '0.9rem' }}>No hay órdenes en esta categoría</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
              {orders.map(order => {
                const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG['Planeada'];
                return (
                  <Link
                    key={order.id}
                    href={`/cutting/${order.id}`}
                    onClick={onClose}
                    style={{ textDecoration: 'none' }}
                  >
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '1rem',
                      padding: '1rem 1.25rem', borderRadius: '12px',
                      border: '1.5px solid #f1f5f9', backgroundColor: '#fafafa',
                      cursor: 'pointer', transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = accentColor;
                      (e.currentTarget as HTMLElement).style.backgroundColor = `${accentColor}08`;
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = '#f1f5f9';
                      (e.currentTarget as HTMLElement).style.backgroundColor = '#fafafa';
                    }}
                    >
                      {/* Code badge */}
                      <div style={{
                        minWidth: '60px', height: '44px', borderRadius: '10px',
                        backgroundColor: `${accentColor}15`,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Scissors size={14} color={accentColor} />
                        <span style={{ fontSize: '0.6rem', fontWeight: '800', color: accentColor, marginTop: '2px' }}>
                          OC-{order.internal_code}
                        </span>
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: '800', fontSize: '0.9rem', color: '#1e293b' }}>
                            OC-{order.internal_code}
                          </span>
                          <span style={{
                            fontSize: '0.65rem', fontWeight: '800', padding: '2px 8px',
                            borderRadius: '6px', backgroundColor: cfg.bg, color: cfg.color,
                            border: `1px solid ${cfg.border}`,
                          }}>
                            {cfg.label}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                          {order.cortador_name && (
                            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '600' }}>
                              ✂ {order.cortador_name}
                            </span>
                          )}
                          {order.scheduled_date && (
                            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '600' }}>
                              📅 {order.scheduled_date}
                            </span>
                          )}
                        </div>
                      </div>

                      <ChevronRight size={16} color="#94a3b8" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { profile, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [baseCosts, setBaseCosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [
          { data: ordersData },
          { data: workshopsData },
          { data: inspectionsData },
          { data: baseCostsData }
        ] = await Promise.all([
          supabase
            .from('orders')
            .select('*, fabrics(nombre_tela), workshops(nombre_taller, responsable), cuts(*, cut_sizes(*))')
            .order('created_at', { ascending: false }),
          supabase.from('workshops').select('*'),
          supabase.from('quality_inspections').select('*'),
          supabase.from('base_costs').select('*')
        ]);

        if (ordersData) setOrders(ordersData);
        if (workshopsData) setWorkshops(workshopsData);
        if (inspectionsData) setInspections(inspectionsData);
        if (baseCostsData) setBaseCosts(baseCostsData);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const isTaller = profile?.roles?.name === 'Taller';

  // ─── WORKSHOP USER SPECIFIC LOGIC ──────────────────────────────────────────
  if (isTaller) {
    // Match by workshop_id from profile (direct FK) or fallback to name matching
    const userWorkshop = workshops.find(w =>
      (profile?.workshop_id && w.id === profile.workshop_id) ||
      (w.nombre_taller || '').toLowerCase().trim() === (profile?.full_name || '').toLowerCase().trim() ||
      (w.responsable || '').toLowerCase().trim() === (profile?.full_name || '').toLowerCase().trim()
    );

    // Filter orders assigned to this workshop
    const assignedOrders = orders.filter(o => {
      if (!userWorkshop) return false;
      return o.workshop_id === userWorkshop.id ||
        (o.workshops?.nombre_taller || '').toLowerCase().trim() === (userWorkshop.nombre_taller || '').toLowerCase().trim();
    });

    const pendingOrders = assignedOrders.filter(o => o.status === 'En Confección');
    const completedOrders = assignedOrders.filter(o => o.status === 'Terminada' || o.status === 'Enviada');

    // Quality stats for payment matching
    const workshopInspections = inspections.filter(i =>
      userWorkshop && (i.workshop_name || '').toLowerCase().trim() === (userWorkshop.nombre_taller || '').toLowerCase().trim()
    );

    const totalApprovedGarments = workshopInspections.reduce((s, i) => s + (i.items_approved || 0), 0);
    const totalRejectedGarments = workshopInspections.reduce((s, i) => s + (i.items_rejected || 0), 0);

    // Sewing cost rate config
    const costuraConfig = baseCosts.find(c => c.concepto?.toLowerCase() === 'costura');
    const rate = costuraConfig && Number(costuraConfig.unidad) > 0
      ? (Number(costuraConfig.valor) / Number(costuraConfig.unidad))
      : 500; // default 500 per unit if 25000/50

    const totalEarnings = totalApprovedGarments * rate;

    const getTotalPrendas = (order: any) => {
      if (!order.cuts) return 0;
      return order.cuts.reduce((sum: number, c: any) => {
        const layersProyec = c.layers || 1;
        const layersProduced = c.layers_produced || 0;
        return sum + (c.cut_sizes || []).reduce((s: number, cs: any) => {
          const qty = Number(cs.quantity) || 0;
          const ppc = qty / layersProyec;
          return s + Math.round(ppc * layersProduced);
        }, 0);
      }, 0);
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '4rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#7c3aed', textTransform: 'uppercase' }}>
              Portal de Taller Satélite
            </span>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '950', margin: '0.25rem 0 0', color: '#0f172a' }}>
              ¡Hola, {profile?.full_name || 'Taller'}!
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Taller Asignado: <strong style={{ color: '#7c3aed' }}>{userWorkshop?.nombre_taller || 'Cargando taller asociado...'}</strong>
            </p>
          </div>
        </div>

        {/* Workshop KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
          <StatCard
            label="Órdenes Pendientes"
            value={loading ? '…' : pendingOrders.length}
            sub="En confección actualmente"
            icon={<Clock size={20} />}
          />
          <StatCard
            label="Órdenes Terminadas"
            value={loading ? '…' : completedOrders.length}
            sub="Entregadas a central"
            icon={<CheckCircle2 size={20} />}
          />
          <StatCard
            label="Prendas Aprobadas"
            value={loading ? '…' : `${totalApprovedGarments} uds`}
            sub={`${totalRejectedGarments} prendas rechazadas`}
            icon={<ClipboardCheck size={20} />}
          />
          <StatCard
            label="Aprobado para Pago"
            value={loading ? '…' : `$${totalEarnings.toLocaleString('es-CO')} COP`}
            sub={`Tarifa base: $${rate.toLocaleString('es-CO')} / prenda`}
            icon={<DollarSign size={20} />}
            primary
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
          {/* Active assignments table */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1rem', fontWeight: '900', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Factory size={18} style={{ color: '#7c3aed' }} /> Órdenes Asignadas Activas ({pendingOrders.length})
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9', textAlign: 'left', color: '#64748b' }}>
                    {['Orden', 'Cliente', 'Tela', 'Prendas', 'Estado'].map(h => (
                      <th key={h} style={{ padding: '0.75rem 1rem', fontWeight: '800' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Cargando órdenes…</td></tr>
                  ) : pendingOrders.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No tienes órdenes en confección actualmente.</td></tr>
                  ) : pendingOrders.map(o => (
                    <tr key={o.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: '800', color: '#7c3aed' }}>OC-{o.internal_code}</td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: '600' }}>{o.client_name}</td>
                      <td style={{ padding: '0.85rem 1rem', color: '#475569' }}>{o.fabrics?.nombre_tela || '—'}</td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: '700' }}>{getTotalPrendas(o)} uds</td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: '999px', backgroundColor: '#eff6ff', color: '#1e4ed8', fontWeight: '800' }}>
                          EN CONFECCIÓN
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* History and Payments */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1rem', fontWeight: '900', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ClipboardCheck size={18} style={{ color: '#10b981' }} /> Historial de Entregas y Pagos ({workshopInspections.length})
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9', textAlign: 'left', color: '#64748b' }}>
                    {['Orden', 'Fecha Revisión', 'Inspeccionadas', 'Aprobadas', 'Rechazadas', 'Pago Estimado'].map(h => (
                      <th key={h} style={{ padding: '0.75rem 1rem', fontWeight: '800' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Cargando historial…</td></tr>
                  ) : workshopInspections.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Aún no se registran inspecciones de calidad para este taller.</td></tr>
                  ) : workshopInspections.map(i => {
                    const orderObj = orders.find(o => o.id === i.order_id);
                    const orderCode = orderObj ? `OC-${orderObj.internal_code}` : '—';
                    const payment = (i.items_approved || 0) * rate;
                    return (
                      <tr key={i.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: '800', color: '#7c3aed' }}>{orderCode}</td>
                        <td style={{ padding: '0.85rem 1rem', color: '#475569' }}>{i.created_at ? new Date(i.created_at).toLocaleDateString('es-CO') : '—'}</td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: '600' }}>{i.items_inspected} uds</td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: '700', color: '#16a34a' }}>{i.items_approved} uds</td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: '700', color: '#ef4444' }}>{i.items_rejected} uds</td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: '800', color: '#10b981' }}>${payment.toLocaleString('es-CO')} COP</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── ADMIN / GENERAL USER DASHBOARD LOGIC ────────────────────────────────────
  const total      = orders.length;
  const cortadas   = orders.filter(o => o.status === 'Cortado');
  const enProceso  = orders.filter(o => o.status === 'En Corte');
  const pendientes = orders.filter(o => o.status === 'Planeada');

  // ── Chart data ──────────────────────────────────────────────────────────────
  const pieData = [
    { name: 'Cortadas',   value: cortadas.length   || 0 },
    { name: 'En Corte',   value: enProceso.length  || 0 },
    { name: 'Pendientes', value: pendientes.length  || 0 },
  ];

  // Group orders by month for bar chart
  const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const byMonth: Record<number, number> = {};
  orders.forEach(o => {
    const m = new Date(o.created_at).getMonth();
    byMonth[m] = (byMonth[m] || 0) + 1;
  });
  const barData = monthNames.map((name, i) => ({ name, value: byMonth[i] || 0 }))
    .filter(d => d.value > 0).slice(-6);

  // ── Modal config map ────────────────────────────────────────────────────────
  const modalConfig: Record<NonNullable<ModalType>, {
    title: string; subtitle: string; orders: Order[]; accentColor: string;
  }> = {
    total:      { title: 'Todas las Órdenes',    subtitle: 'Resumen general',     orders,           accentColor: '#6366f1' },
    cortadas:   { title: 'Órdenes Cortadas',     subtitle: 'Completadas',         orders: cortadas,  accentColor: '#059669' },
    en_proceso: { title: 'Órdenes En Corte',     subtitle: 'Actualmente en mesa', orders: enProceso, accentColor: '#d97706' },
    pendientes: { title: 'Órdenes Pendientes',   subtitle: 'Esperando inicio',    orders: pendientes,accentColor: '#ef4444' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>Panel de Control</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Planifica, prioriza y gestiona las órdenes de corte con facilidad.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Link href="/orders" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            <Plus size={18} /> Nueva Orden
          </Link>
        </div>
      </div>

      {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
      <div className="dashboard-grid">
        <StatCard
          label="Órdenes Totales" value={loading ? '…' : total}
          sub={`${total} órdenes en el sistema`}
          icon={<Package size={20} />} primary
          onClick={() => setActiveModal('total')}
        />
        <StatCard
          label="Órdenes Cortadas" value={loading ? '…' : cortadas.length}
          sub={`${total > 0 ? Math.round((cortadas.length / total) * 100) : 0}% del total completado`}
          icon={<CheckCircle2 size={20} />}
          onClick={() => setActiveModal('cortadas')}
        />
        <StatCard
          label="En Corte" value={loading ? '…' : enProceso.length}
          sub="Actualmente en mesa de corte"
          icon={<Scissors size={20} />}
          onClick={() => setActiveModal('en_proceso')}
        />
        <StatCard
          label="Pendientes" value={loading ? '…' : pendientes.length}
          sub="Esperando inicio de corte"
          icon={<AlertCircle size={20} />}
          onClick={() => setActiveModal('pendientes')}
        />
      </div>

      {/* ── Charts Row ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>

        {/* Bar Chart */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ margin: 0 }}>Órdenes por Mes</h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>Órdenes creadas en los últimos meses</p>
            </div>
            <BarChart2 size={20} color="var(--primary)" />
          </div>
          <div style={{ height: '240px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData.length > 0 ? barData : [{ name: 'Sin datos', value: 0 }]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }} />
                <YAxis hide allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                  contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontWeight: 700 }}
                />
                <Bar dataKey="value" fill="var(--primary)" radius={[6, 6, 0, 0]} barSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ alignSelf: 'flex-start', marginBottom: '1rem', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0 }}>Estado de Órdenes</h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>Distribución actual</p>
            </div>
          </div>
          <div style={{ height: '180px', width: '100%', position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={78}
                  paddingAngle={4} dataKey="value"
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontWeight: 700 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
              <p style={{ fontSize: '1.6rem', fontWeight: '950', margin: 0, color: '#0f172a' }}>{total}</p>
              <p style={{ fontSize: '0.6rem', color: '#64748b', margin: 0, fontWeight: '700', textTransform: 'uppercase' }}>Total</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem', width: '100%' }}>
            {pieData.map((entry, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS[i] }} />
                  <span style={{ color: '#475569', fontWeight: '600' }}>{entry.name}</span>
                </div>
                <span style={{ fontWeight: '800', color: '#1e293b' }}>{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Últimas Órdenes ─────────────────────────────────────────────────── */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ margin: 0 }}>Últimas Órdenes</h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>Las 5 órdenes más recientes</p>
          </div>
          <Link href="/cutting" style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            Ver todas <ArrowUpRight size={14} />
          </Link>
        </div>

        {loading ? (
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Cargando órdenes…</p>
        ) : orders.length === 0 ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem', fontSize: '0.85rem' }}>No hay órdenes aún.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {orders.slice(0, 5).map(order => {
              const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG['Planeada'];
              return (
                <Link key={order.id} href={`/cutting/${order.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    padding: '0.85rem 1.1rem', borderRadius: '10px',
                    border: '1.5px solid #f1f5f9', backgroundColor: '#fafafa',
                    cursor: 'pointer', transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#6366f1';
                    (e.currentTarget as HTMLElement).style.backgroundColor = '#f8f7ff';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = '#f1f5f9';
                    (e.currentTarget as HTMLElement).style.backgroundColor = '#fafafa';
                  }}
                  >
                    <div style={{ width: '36px', height: '36px', borderRadius: '999px', backgroundColor: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Scissors size={16} color="#6366f1" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: '800', fontSize: '0.875rem', color: '#1e293b' }}>
                          OC-{order.internal_code}
                        </span>
                        <span style={{
                          fontSize: '0.65rem', fontWeight: '800',
                          padding: '2px 7px', borderRadius: '5px',
                          backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                        }}>
                          {cfg.label}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b', fontWeight: '600', marginTop: '0.15rem' }}>
                        {order.cortador_name ? `✂ {order.cortador_name}` : 'Sin cortador asignado'}
                        {order.scheduled_date && ` · 📅 ${order.scheduled_date}`}
                      </p>
                    </div>
                    <Clock size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Detail Modal ─────────────────────────────────────────────────────── */}
      {activeModal && (
        <DetailModal
          {...modalConfig[activeModal]}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
}
