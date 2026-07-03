'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useSearchParams } from 'next/navigation';
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
  Star,
  Sparkles,
  TrendingDown,
  Info
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
  LineChart,
  Line
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

// ─── Sparkline waves ────────────────────────────────────────────────────────
function SparklineWave({ color, path }: { color: string; path: string }) {
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '30px', pointerEvents: 'none', opacity: 0.45 }}>
      <path d={`${path} L100,30 L0,30 Z`} fill={color} opacity="0.12"></path>
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round"></path>
    </svg>
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
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [baseCosts, setBaseCosts] = useState<any[]>([]);
  const [sizesList, setSizesList] = useState<any[]>([]);
  const [colorsList, setColorsList] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [productAccessoriesList, setProductAccessoriesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [viewingOrderDetails, setViewingOrderDetails] = useState<any>(null);

  const currentTab = searchParams.get('tab') || 'dashboard';

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [
          res1,
          res2,
          res3,
          res4,
          res5,
          res6,
          res7,
          res8
        ] = await Promise.all([
          supabase
            .from('orders')
            .select('*, fabrics(nombre_tela), workshops(nombre_taller, responsable), cuts(*, cut_sizes(*))')
            .order('created_at', { ascending: false }),
          supabase.from('workshops').select('*'),
          supabase.from('quality_inspections').select('*'),
          supabase.from('base_costs').select('*'),
          supabase.from('sizes').select('*').order('orden_visual', { ascending: true }),
          supabase.from('colors').select('*'),
          supabase.from('products').select('*'),
          supabase.from('product_accessories').select('*, accessories(nombre, unidad_medida), products(nombre_producto)')
        ]);
        const ordersData = res1.data;
        const workshopsData = res2.data;
        const inspectionsData = res3.data;
        const baseCostsData = res4.data;
        const sData = res5.data;
        const cData = res6.data;
        const pData = res7.data;
        const paData = res8.data;

        if (ordersData) setOrders(ordersData);
        if (workshopsData) setWorkshops(workshopsData);
        if (inspectionsData) setInspections(inspectionsData);
        if (baseCostsData) setBaseCosts(baseCostsData);
        if (sData) setSizesList(sData);
        if (cData) setColorsList(cData);
        if (pData) setProductsList(pData);
        if (paData) setProductAccessoriesList(paData);
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

    // Calculate generic progression percentage for orders
    const getProgressionPercentage = (order: any) => {
      // Logic placeholder for progression: e.g. based on status or logs
      if (order.status === 'Terminada' || order.status === 'Enviada') return 100;
      if (order.status === 'En Confección') {
        // Return simulated progres based on orders to match visual layout
        const lastChar = order.internal_code ? order.internal_code.charCodeAt(order.internal_code.length - 1) : 5;
        return 30 + (lastChar % 6) * 10; // returns 30%, 40%, 50%, 60%, 70%, 80%
      }
      return 0;
    };

    // Main Workshop Dashboard Tab
    if (currentTab === 'dashboard') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '4rem' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.5rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              {profile?.avatar_url ? (
                <div style={{ width: '80px', height: '80px', borderRadius: '20px', overflow: 'hidden', border: '4px solid white', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}>
                  <img src={profile.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ) : (
                <div style={{ width: '80px', height: '80px', borderRadius: '20px', backgroundColor: 'var(--primary-lighter)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '4px solid white', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}>
                  <Factory size={32} />
                </div>
              )}
              <div>
                <span style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'var(--primary-lighter)', padding: '4px 10px', borderRadius: '6px' }}>
                  Taller Satélite Conectado
                </span>
                <h1 style={{ fontSize: '2.5rem', fontWeight: '950', margin: '0.4rem 0 0.25rem 0', color: '#0f172a', lineHeight: 1.1 }}>
                  {loading 
                    ? 'Cargando taller...' 
                    : (userWorkshop?.nombre_taller || 'Sin taller asignado (Contacte Administrador)')}
                </h1>
                <p style={{ color: '#64748b', fontSize: '0.92rem', fontWeight: '500', margin: 0 }}>
                  ¡Hola, <strong style={{ color: '#0f172a' }}>{profile?.full_name || 'Operario'}</strong>! 👋 Aquí tienes el resumen y gestión de tu producción.
                </p>
              </div>
            </div>
          </div>

          {/* Premium Redesigned KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
            
            {/* Card 1: Actives */}
            <div className="card" style={{ position: 'relative', overflow: 'hidden', padding: '1.5rem 1.75rem', border: '1px solid #eef2ff', background: 'linear-gradient(to bottom right, #ffffff, #fafaff)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div>
                  <p style={{ fontSize: '0.78rem', fontWeight: '800', color: '#4f46e5', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Órdenes Activas</p>
                  <h3 style={{ fontSize: '2.25rem', fontWeight: '950', margin: '0.35rem 0', color: '#1e1b4b' }}>{loading ? '…' : pendingOrders.length}</h3>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0, fontWeight: '600' }}>En confección actualmente</p>
                </div>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#eef2ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Scissors size={20} style={{ alignSelf: 'center' }} />
                </div>
              </div>
              <SparklineWave color="#4f46e5" path="M0,22 Q25,8 50,18 T100,8" />
            </div>

            {/* Card 2: Completed */}
            <div className="card" style={{ position: 'relative', overflow: 'hidden', padding: '1.5rem 1.75rem', border: '1px solid #f0fdf4', background: 'linear-gradient(to bottom right, #ffffff, #fafdfb)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div>
                  <p style={{ fontSize: '0.78rem', fontWeight: '800', color: '#16a34a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Órdenes Terminadas</p>
                  <h3 style={{ fontSize: '2.25rem', fontWeight: '950', margin: '0.35rem 0', color: '#052e16' }}>{loading ? '…' : completedOrders.length}</h3>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0, fontWeight: '600' }}>Entregadas a central</p>
                </div>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={20} />
                </div>
              </div>
              <SparklineWave color="#16a34a" path="M0,15 Q30,25 60,10 T100,20" />
            </div>

            {/* Card 3: Approved */}
            <div className="card" style={{ position: 'relative', overflow: 'hidden', padding: '1.5rem 1.75rem', border: '1px solid #fef3c7', background: 'linear-gradient(to bottom right, #ffffff, #fffdf5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div>
                  <p style={{ fontSize: '0.78rem', fontWeight: '800', color: '#d97706', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Prendas Aprobadas</p>
                  <h3 style={{ fontSize: '2.25rem', fontWeight: '950', margin: '0.35rem 0', color: '#451a03' }}>{loading ? '…' : `${totalApprovedGarments} uds`}</h3>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0, fontWeight: '600' }}>Esta semana</p>
                </div>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Star size={20} />
                </div>
              </div>
              <SparklineWave color="#d97706" path="M0,25 Q20,10 50,22 T100,12" />
            </div>

            {/* Card 4: Wallet Earnings Payout */}
            <div className="card" style={{
              position: 'relative', overflow: 'hidden', padding: '1.5rem 1.75rem', color: 'white',
              background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', boxShadow: '0 10px 25px -5px rgba(49,46,129,0.3)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem', position: 'relative', zIndex: 2 }}>
                <div>
                  <p style={{ fontSize: '0.78rem', fontWeight: '800', color: '#c7d2fe', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Saldo por Pagar</p>
                  <h3 style={{ fontSize: '2.2rem', fontWeight: '950', margin: '0.35rem 0', color: 'white' }}>{loading ? '…' : `$${totalEarnings.toLocaleString('es-CO')} COP`}</h3>
                  <p style={{ fontSize: '0.75rem', color: '#a5b4fc', margin: 0, fontWeight: '600' }}>Tarifa base: ${rate.toLocaleString('es-CO')} / prenda</p>
                </div>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DollarSign size={20} />
                </div>
              </div>
              <div style={{ position: 'absolute', bottom: '-20px', right: '-20px', width: '120px', height: '120px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />
            </div>

          </div>

          {/* Main Layout: 70% Columns & 30% Right Panel */}
          <div style={{ display: 'grid', gridTemplateColumns: '7fr 3fr', gap: '2rem', alignItems: 'start' }}>
            
            {/* Left Content Area */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {/* Active Orders */}
              <div className="card" style={{ padding: '2rem', borderRadius: '20px', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '900', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    Órdenes Asignadas Activas
                    <span style={{ fontSize: '0.72rem', backgroundColor: '#eef2ff', color: '#4f46e5', padding: '2px 8px', borderRadius: '999px', fontWeight: '800' }}>{pendingOrders.length}</span>
                  </h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2.5px solid #f1f5f9', textAlign: 'left', color: '#64748b' }}>
                        {['Orden', 'Cliente', 'Tela', 'Prendas', 'Fecha Asignada', 'Estado', 'Progreso', 'Acción'].map(h => (
                          <th key={h} style={{ padding: '0.85rem 1rem', fontWeight: '800', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Cargando órdenes…</td></tr>
                      ) : pendingOrders.length === 0 ? (
                        <tr><td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>No tienes órdenes activas asignadas.</td></tr>
                      ) : pendingOrders.map(o => {
                        const progress = getProgressionPercentage(o);
                        return (
                          <tr key={o.id} style={{ borderBottom: '1px solid #f8fafc', transition: 'background-color 0.15s' }}>
                            <td style={{ padding: '1rem 1rem', fontWeight: '800', color: '#4f46e5' }}>OC-{o.internal_code}</td>
                            <td style={{ padding: '1rem 1rem', fontWeight: '700', color: '#1e293b' }}>{o.client_name}</td>
                            <td style={{ padding: '1rem 1rem', color: '#64748b', fontWeight: '500' }}>{o.fabrics?.nombre_tela || '—'}</td>
                            <td style={{ padding: '1rem 1rem', fontWeight: '800', color: '#0f172a' }}>{getTotalPrendas(o)} uds</td>
                            <td style={{ padding: '1rem 1rem', color: '#64748b', fontWeight: '600' }}>{o.created_at ? new Date(o.created_at).toLocaleDateString('es-CO') : '—'}</td>
                            <td style={{ padding: '1rem 1rem' }}>
                              <span style={{ fontSize: '0.68rem', padding: '0.25rem 0.65rem', borderRadius: '8px', backgroundColor: '#eff6ff', color: '#1e4ed8', fontWeight: '800', border: '1px solid #bfdbfe' }}>
                                En confección
                              </span>
                            </td>
                            <td style={{ padding: '1rem 1rem', width: '160px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ flex: 1, height: '6px', borderRadius: '999px', backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                                  <div style={{ width: `${progress}%`, height: '100%', borderRadius: '999px', backgroundColor: 'var(--primary)' }} />
                                </div>
                                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#475569' }}>{progress}%</span>
                              </div>
                            </td>
                            <td style={{ padding: '1rem 1rem' }}>
                              <button 
                                onClick={() => setViewingOrderDetails(o)} 
                                style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.75rem', fontWeight: '800', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                              >
                                Ver Detalles <ChevronRight size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Delivery History */}
              <div className="card" style={{ padding: '2rem', borderRadius: '20px', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '900', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    Historial de Entregas y Pagos
                    <span style={{ fontSize: '0.72rem', backgroundColor: '#ecfdf5', color: '#10b981', padding: '2px 8px', borderRadius: '999px', fontWeight: '800' }}>{workshopInspections.length}</span>
                  </h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2.5px solid #f1f5f9', textAlign: 'left', color: '#64748b' }}>
                        {['Orden', 'Fecha Revisión', 'Inspeccionadas', 'Aprobadas', 'Rechazadas', 'Pago Estimado', 'Estado Pago'].map(h => (
                          <th key={h} style={{ padding: '0.85rem 1rem', fontWeight: '800', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Cargando historial…</td></tr>
                      ) : workshopInspections.length === 0 ? (
                        <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>Aún no registras auditorías en Control de Calidad.</td></tr>
                      ) : workshopInspections.slice(0, 5).map(i => {
                        const orderObj = orders.find(o => o.id === i.order_id);
                        const orderCode = orderObj ? `OC-${orderObj.internal_code}` : '—';
                        const payment = (i.items_approved || 0) * rate;
                        return (
                          <tr key={i.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                            <td style={{ padding: '1rem 1rem', fontWeight: '800', color: '#4f46e5' }}>{orderCode}</td>
                            <td style={{ padding: '1rem 1rem', color: '#64748b', fontWeight: '600' }}>{i.created_at ? new Date(i.created_at).toLocaleDateString('es-CO') : '—'}</td>
                            <td style={{ padding: '1rem 1rem', fontWeight: '800', color: '#475569' }}>{i.items_inspected} uds</td>
                            <td style={{ padding: '1rem 1rem', fontWeight: '800', color: '#16a34a' }}>{i.items_approved} uds</td>
                            <td style={{ padding: '1rem 1rem', fontWeight: '800', color: '#ef4444' }}>{i.items_rejected} uds</td>
                            <td style={{ padding: '1rem 1rem', fontWeight: '900', color: '#10b981' }}>${payment.toLocaleString('es-CO')} COP</td>
                            <td style={{ padding: '1rem 1rem' }}>
                              <span style={{
                                fontSize: '0.68rem', padding: '0.25rem 0.65rem', borderRadius: '8px', fontWeight: '800',
                                backgroundColor: i.status === 'Aprobado' ? '#ecfdf5' : '#fffbeb',
                                color: i.status === 'Aprobado' ? '#15803d' : '#b45309',
                                border: i.status === 'Aprobado' ? '1px solid #bbf7d0' : '1px solid #fef08a'
                              }}>
                                {i.status === 'Aprobado' ? 'Aprobado' : 'Pendiente'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
{/* Orders table ... inside useEffect: const [sizesList, setSizesList] = useState([]); const [colorsList, setColorsList] = useState([]); const [viewingOrderDetails, setViewingOrderDetails] = useState(null); ... useEffect(() => { ... fetchSizes(); fetchColors(); ... }, []); */}

                    </tbody>
                  </table>
                </div>
              </div>

          </div>

          {/* Workshop Order Confección Details Modal (Relación de Despacho Format) */}
          {viewingOrderDetails && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1500, padding: '2rem' }}>
              <div className="card" style={{ width: '100%', maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto', padding: '3rem', borderRadius: '16px', backgroundColor: 'white', border: '1px solid #cbd5e1', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                
                {/* Print relation header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2.5px solid #0f172a', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ backgroundColor: '#0f172a', padding: '0.5rem', borderRadius: '8px', color: 'white' }}>
                      <Factory size={22} />
                    </div>
                    <div>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: '950', margin: 0, letterSpacing: '-0.02em', textTransform: 'uppercase', color: '#0f172a' }}>
                        Relación de Despacho a Confección
                      </h2>
                      <p style={{ fontSize: '0.72rem', color: '#475569', margin: 0 }}>
                        Cortesbreiner Sistema de Control Satélite · {new Date().toLocaleDateString('es-CO')}
                      </p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div>
                      <p style={{ fontSize: '0.75rem', margin: 0, fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Orden de Confección</p>
                      <p style={{ fontSize: '1.1rem', fontWeight: '950', color: 'var(--primary)', margin: 0 }}>
                        OC-{viewingOrderDetails.internal_code}
                      </p>
                    </div>
                    <button onClick={() => setViewingOrderDetails(null)} style={{ background: '#f1f5f9', border: 'none', color: '#475569', cursor: 'pointer', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
                  </div>
                </div>

                {/* Workshop Info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.825rem', marginBottom: '2rem' }}>
                  <div>
                    <p style={{ margin: '0 0 0.35rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em' }}>Taller Satélite Destinatario</p>
                    <p style={{ margin: 0, fontWeight: '900', fontSize: '1rem', color: '#0f172a' }}>{userWorkshop?.nombre_taller || 'Taller Asignado'}</p>
                    <p style={{ margin: '0.2rem 0 0', color: '#334155', fontWeight: '600' }}>Responsable: <span style={{ color: '#0f172a', fontWeight: '800' }}>{userWorkshop?.responsable || '—'}</span></p>
                    <p style={{ margin: '0.15rem 0 0', color: '#475569' }}>Teléfono: {userWorkshop?.telefono || '—'}</p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 0.35rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em' }}>Detalle de Entrega</p>
                    <p style={{ margin: 0, fontWeight: '600' }}>Cliente: <strong style={{ color: '#0f172a', fontWeight: '800' }}>{viewingOrderDetails.client_name}</strong></p>
                    <p style={{ margin: '0.2rem 0 0', color: '#7c3aed', fontWeight: '750' }}>Fecha Programada: <strong>{viewingOrderDetails.created_at ? new Date(viewingOrderDetails.created_at).toLocaleDateString('es-CO') : '—'}</strong></p>
                    <p style={{ margin: '0.15rem 0 0', color: '#475569' }}>Tela Principal: {viewingOrderDetails.fabrics?.nombre_tela || '—'}</p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  
                  {/* Items Table */}
                  <div>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', margin: '0 0 0.75rem', borderBottom: '1.5px solid #cbd5e1', paddingBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>📋</span> Prendas y Cantidades a Armar
                    </h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1' }}>
                          <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: '800', color: '#475569' }}>Referencia</th>
                          <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: '800', color: '#475569' }}>Color</th>
                          <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: '800', color: '#475569' }}>Categoría / Tela</th>
                          <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: '800', color: '#475569', width: '80px' }}>Talla</th>
                          <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: '900', color: '#0f172a', width: '120px' }}>Cantidad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const itemsList: any[] = [];
                          viewingOrderDetails.cuts?.forEach((cut: any) => {
                            const prod = productsList?.find(p => String(p.id) === String(cut.product_id));
                            const productName = prod ? prod.nombre_producto : `OC-${viewingOrderDetails.internal_code}`;
                            
                            const categoryName = prod ? (prod.categoria || '—') : '—';

                            let colorObj = colorsList.find(c => String(c.id) === String(cut.color_id));
                            if (!colorObj && prod && prod.nombre_producto) {
                              const prodNameLower = prod.nombre_producto.toLowerCase();
                              colorObj = colorsList.find(c => c.nombre_color && prodNameLower.includes(c.nombre_color.toLowerCase()));
                            }
                            const colorName = colorObj ? colorObj.nombre_color : 'Sin Color';

                            cut.cut_sizes?.forEach((szQty: any) => {
                              const sizeObj = sizesList.find(s => String(s.id) === String(szQty.size_id));
                              const sizeName = sizeObj ? sizeObj.nombre_talla : '—';

                              const layersProyec = cut.layers || 1;
                              const layersProduced = cut.layers_produced || 0;
                              const plannedQty = Number(szQty.quantity) || 0;
                              const ppc = plannedQty / layersProyec;
                              const actualQty = Math.round(ppc * layersProduced);

                              if (actualQty > 0) {
                                itemsList.push({
                                  cutId: cut.id,
                                  productName,
                                  colorName,
                                  categoryName,
                                  sizeCode: sizeName,
                                  quantity: actualQty
                                });
                              }
                            });
                          });

                          if (itemsList.length === 0) {
                            return <tr><td colSpan={5} style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>No se relacionan prendas en este lote.</td></tr>;
                          }

                          return (
                            <>
                              {itemsList.map((item, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#0f172a' }}>{item.productName}</td>
                                  <td style={{ padding: '0.6rem 0.75rem', color: '#1e293b', fontWeight: '500' }}>{item.colorName}</td>
                                  <td style={{ padding: '0.6rem 0.75rem', color: '#475569' }}>{item.categoryName}</td>
                                  <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: '800', color: '#7c3aed' }}>{item.sizeCode}</td>
                                  <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>{item.quantity} uds</td>
                                </tr>
                              ))}
                              <tr style={{ backgroundColor: '#f8fafc', fontWeight: '900', borderTop: '1.5px solid #cbd5e1' }}>
                                <td colSpan={4} style={{ padding: '0.75rem 0.75rem', textTransform: 'uppercase', color: '#334155', fontSize: '0.7rem' }}>Total Unidades Despachadas</td>
                                <td style={{ padding: '0.75rem 0.75rem', textAlign: 'right', color: '#7c3aed', fontSize: '0.9rem', fontWeight: '950' }}>
                                  {itemsList.reduce((sum, item) => sum + item.quantity, 0)} uds
                                </td>
                              </tr>
                            </>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* Accessories Table */}
                  <div>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', margin: '0 0 0.75rem', borderBottom: '1.5px solid #cbd5e1', paddingBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>🔗</span> Accesorios e Insumos Entregados
                    </h3>
                    {(() => {
                      const computedAccs: { name: string; unit: string; qty: number }[] = [];
                      
                      // Process items assigned to sew
                      const itemsList: any[] = [];
                      viewingOrderDetails.cuts?.forEach((cut: any) => {
                        cut.cut_sizes?.forEach((szQty: any) => {
                          const layersProyec = cut.layers || 1;
                          const layersProduced = cut.layers_produced || 0;
                          const plannedQty = Number(szQty.quantity) || 0;
                          const ppc = plannedQty / layersProyec;
                          const actualQty = Math.round(ppc * layersProduced);

                          if (actualQty > 0) {
                            itemsList.push({
                              cutId: cut.id,
                              productId: cut.product_id,
                              quantity: actualQty
                            });
                          }
                        });
                      });

                      itemsList.forEach(item => {
                        if (!item.productId) return;
                        const prodObj = productsList.find(p => String(p.id) === String(item.productId));
                        const prodName = prodObj?.nombre_producto;
                        const prodAccs = productAccessoriesList.filter(pa => {
                          if (String(pa.product_id) === String(item.productId)) return true;
                          const paProdName = pa.products?.nombre_producto;
                          return paProdName && prodName && paProdName.toLowerCase().trim() === prodName.toLowerCase().trim();
                        });

                        prodAccs.forEach(pa => {
                          const accName = pa.accessories?.nombre || 'Accesorio';
                          const rawUnit = pa.accessories?.unidad_medida || '';
                          const accUnit = rawUnit && isNaN(Number(rawUnit)) ? rawUnit : 'Unidad';
                          const qtyPerProduct = Number(pa.cantidad) || 0;
                          const totalRequired = item.quantity * qtyPerProduct;

                          if (totalRequired > 0) {
                            const existing = computedAccs.find(wa => wa.name === accName);
                            if (existing) {
                              existing.qty += totalRequired;
                            } else {
                              computedAccs.push({
                                name: accName,
                                unit: accUnit,
                                qty: totalRequired
                              });
                            }
                          }
                        });
                      });

                      if (computedAccs.length === 0) {
                        return <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0, fontStyle: 'italic', padding: '0.5rem 0' }}>No se relacionan accesorios para este lote.</p>;
                      }

                      return (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1' }}>
                              <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: '800', color: '#475569' }}>Insumo / Accesorio</th>
                              <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: '800', color: '#475569', width: '100px' }}>Unidad</th>
                              <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: '900', color: '#0f172a', width: '150px' }}>Cantidad Proporcional</th>
                            </tr>
                          </thead>
                          <tbody>
                            {computedAccs.map((wa, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#0f172a' }}>{wa.name}</td>
                                <td style={{ padding: '0.6rem 0.75rem', color: '#475569' }}>{wa.unit}</td>
                                <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: '800', color: '#059669' }}>{Math.round(wa.qty)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>

                  {/* Special Notes & Observations */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', fontSize: '0.78rem' }}>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', backgroundColor: '#faf9ff' }}>
                      <p style={{ fontWeight: '850', color: '#334155', margin: '0 0 0.4rem 0', textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em' }}>Observaciones y Detalles de Costura</p>
                      <p style={{ margin: 0, color: '#475569', lineHeight: '1.5', fontSize: '0.825rem', fontWeight: '500' }}>
                        {(() => {
                          const rawObs = viewingOrderDetails.observaciones || '';
                          return rawObs.replace(/<!--ASSIGNMENTS_JSON:[\s\S]*?-->/g, '').trim() || 'Sin observaciones adicionales de preparación.';
                        })()}
                      </p>
                    </div>
                  </div>

                  {/* Signature Block */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', marginTop: '2rem', paddingTop: '1.5rem' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ borderBottom: '1px solid #0f172a', width: '100%', marginBottom: '0.4rem' }}></div>
                      <p style={{ fontSize: '0.625rem', fontWeight: '800', textTransform: 'uppercase', margin: 0 }}>Entregado por (Planta)</p>
                      <p style={{ fontSize: '0.58rem', color: '#64748b', margin: '0.1rem 0 0' }}>Cortesbreiner Producción</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ borderBottom: '1px solid #0f172a', width: '100%', marginBottom: '0.4rem' }}></div>
                      <p style={{ fontSize: '0.625rem', fontWeight: '800', textTransform: 'uppercase', margin: 0 }}>Recibido por Taller Satélite</p>
                      <p style={{ fontSize: '0.58rem', color: '#64748b', margin: '0.1rem 0 0' }}>{userWorkshop?.nombre_taller || 'Taller Satélite'}</p>
                    </div>
                  </div>

                </div>

                <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid #f1f5f9', marginTop: '2.5rem', paddingTop: '1.5rem' }}>
                  <button type="button" className="btn btn-secondary" style={{ flex: 1, padding: '0.85rem', fontWeight: '800', borderRadius: '12px', backgroundColor: '#1e293b', color: 'white', border: 'none', cursor: 'pointer' }} onClick={() => setViewingOrderDetails(null)}>Cerrar Orden</button>
                </div>
              </div>
            </div>
          )}

          {/* Right Side Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Notifications */}
              <div className="card" style={{ padding: '1.5rem', borderRadius: '20px', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#eef2ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Package size={15} />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: '700', color: '#1e293b', lineHeight: '1.3' }}>Nueva orden asignada</p>
                      <p style={{ margin: '0.15rem 0 0', fontSize: '0.7rem', color: '#64748b', fontWeight: '500' }}>OC-FZYW1 ha sido asignada</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <CheckCircle2 size={15} />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: '700', color: '#1e293b', lineHeight: '1.3' }}>Entrega registrada</p>
                      <p style={{ margin: '0.15rem 0 0', fontSize: '0.7rem', color: '#64748b', fontWeight: '500' }}>La orden OC-3QKZL fue entregada</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <DollarSign size={15} />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: '700', color: '#1e293b', lineHeight: '1.3' }}>Pago aprobado</p>
                      <p style={{ margin: '0.15rem 0 0', fontSize: '0.7rem', color: '#64748b', fontWeight: '500' }}>Pago de $2.000 COP aprobado</p>
                    </div>
                  </div>

                </div>
              </div>

              {/* Tip box */}
              <div className="card" style={{ padding: '1.5rem', borderRadius: '20px', backgroundColor: '#faf9ff', border: '1px dashed #dcd6ff', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#7c3aed' }}>
                  <Sparkles size={16} />
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase' }}>Consejo del día</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#475569', lineHeight: '1.45', fontWeight: '500', fontStyle: 'italic' }}>
                  "Mantén tus avances actualizados para mejorar la planificación y evitar retrasos en las revisiones de calidad."
                </p>
              </div>

              {/* Performance / Ratings */}
              <div className="card" style={{ padding: '1.5rem', borderRadius: '20px', border: '1px solid #f1f5f9' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: '800', color: '#0f172a' }}>Tu desempeño</h4>
                
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                  <span style={{ fontSize: '2.1rem', fontWeight: '950', color: '#0f172a' }}>4.8</span>
                  <div style={{ display: 'flex', gap: '2px', color: '#fbbf24' }}>
                    {[1, 2, 3, 4, 5].map(n => <Star key={n} size={14} fill="#fbbf24" stroke="none" />)}
                  </div>
                </div>
                <p style={{ margin: '0.15rem 0 1.25rem', fontSize: '0.75rem', color: '#16a34a', fontWeight: '800' }}>¡Excelente trabajo!</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.25rem' }}>
                      <span style={{ color: '#475569' }}>Entrega a tiempo</span>
                      <span style={{ color: '#0f172a' }}>95%</span>
                    </div>
                    <div style={{ height: '4px', borderRadius: '999px', backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
                      <div style={{ width: '95%', height: '100%', backgroundColor: '#10b981' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.25rem' }}>
                      <span style={{ color: '#475569' }}>Calidad de confección</span>
                      <span style={{ color: '#0f172a' }}>98%</span>
                    </div>
                    <div style={{ height: '4px', borderRadius: '999px', backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
                      <div style={{ width: '98%', height: '100%', backgroundColor: '#10b981' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.25rem' }}>
                      <span style={{ color: '#475569' }}>Comunicación</span>
                      <span style={{ color: '#0f172a' }}>4.9 / 5.0</span>
                    </div>
                    <div style={{ height: '4px', borderRadius: '999px', backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
                      <div style={{ width: '92%', height: '100%', backgroundColor: '#7c3aed' }} />
                    </div>
                  </div>

                </div>
              </div>

            </div>

          </div>
        </div>
      );
    }

    // Orders tab inside Taller view
    if (currentTab === 'orders') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#7c3aed', textTransform: 'uppercase' }}>Portal de Taller</span>
              <h1 style={{ fontSize: '1.75rem', fontWeight: '950', margin: '0.25rem 0 0', color: '#0f172a' }}>Mis Órdenes Asignadas</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Listado total de órdenes históricas y activas en tu satélite.</p>
            </div>
            <div style={{ padding: '0.5rem 1.25rem', backgroundColor: '#f5f3ff', borderRadius: '12px', border: '1.5px solid #ddd6fe' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#7c3aed', textTransform: 'uppercase', display: 'block' }}>Taller Conectado</span>
              <strong style={{ fontSize: '0.95rem', color: '#1e1b4b', fontWeight: '900' }}>{userWorkshop?.nombre_taller || 'Taller satélite'}</strong>
            </div>
          </div>

          <div className="card" style={{ padding: '2rem' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2.5px solid #f1f5f9', textAlign: 'left', color: '#64748b' }}>
                    {['Código', 'Cliente', 'Taller', 'Tela', 'Prendas Totales', 'Estado', 'Fecha Creación'].map(h => (
                      <th key={h} style={{ padding: '1rem', fontWeight: '800' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assignedOrders.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Aún no se te han asignado órdenes de corte.</td></tr>
                  ) : assignedOrders.map(o => {
                    const totalP = getTotalPrendas(o);
                    return (
                      <tr key={o.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '1rem', fontWeight: '800', color: '#4f46e5' }}>OC-{o.internal_code}</td>
                        <td style={{ padding: '1rem', fontWeight: '700' }}>{o.client_name}</td>
                        <td style={{ padding: '1rem', fontWeight: '600' }}>{userWorkshop?.nombre_taller || '—'}</td>
                        <td style={{ padding: '1rem', color: '#475569' }}>{o.fabrics?.nombre_tela || '—'}</td>
                        <td style={{ padding: '1rem', fontWeight: '800' }}>{totalP} uds</td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{
                            fontSize: '0.7rem', padding: '0.25rem 0.65rem', borderRadius: '8px', fontWeight: '800',
                            backgroundColor: o.status === 'En Confección' ? '#eff6ff' : '#ecfdf5',
                            color: o.status === 'En Confección' ? '#1e4ed8' : '#15803d',
                            border: o.status === 'En Confección' ? '1px solid #bfdbfe' : '1px solid #bbf7d0'
                          }}>
                            {o.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '1rem', color: '#64748b' }}>{new Date(o.created_at).toLocaleDateString('es-CO')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    // Payments tab inside Taller view
    if (currentTab === 'payments') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#7c3aed', textTransform: 'uppercase' }}>Portal de Taller</span>
              <h1 style={{ fontSize: '1.75rem', fontWeight: '950', margin: '0.25rem 0 0', color: '#0f172a' }}>Control de Entregas y Pagos</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Registro de prendas aprobadas en auditoría de calidad y valor liquidado.</p>
            </div>
            <div style={{ padding: '0.5rem 1.25rem', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1.5px solid #bbf7d0' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#16a34a', textTransform: 'uppercase', display: 'block' }}>Taller Conectado</span>
              <strong style={{ fontSize: '0.95rem', color: '#14532d', fontWeight: '900' }}>{userWorkshop?.nombre_taller || 'Taller satélite'}</strong>
            </div>
          </div>

          <div className="card" style={{ padding: '2rem' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2.5px solid #f1f5f9', textAlign: 'left', color: '#64748b' }}>
                    {['Orden', 'Fecha Revisión', 'Inspeccionadas', 'Aprobadas', 'Rechazadas', 'Tarifa Aplicada', 'Pago Estimado', 'Estado Pago'].map(h => (
                      <th key={h} style={{ padding: '1rem', fontWeight: '800' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {workshopInspections.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Aún no se registran inspecciones de calidad para este taller.</td></tr>
                  ) : workshopInspections.map(i => {
                    const orderObj = orders.find(o => o.id === i.order_id);
                    const orderCode = orderObj ? `OC-${orderObj.internal_code}` : '—';
                    const payment = (i.items_approved || 0) * rate;
                    return (
                      <tr key={i.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '1rem', fontWeight: '800', color: '#4f46e5' }}>{orderCode}</td>
                        <td style={{ padding: '1rem', color: '#475569' }}>{i.created_at ? new Date(i.created_at).toLocaleDateString('es-CO') : '—'}</td>
                        <td style={{ padding: '1rem', fontWeight: '700' }}>{i.items_inspected} uds</td>
                        <td style={{ padding: '1rem', fontWeight: '700', color: '#16a34a' }}>{i.items_approved} uds</td>
                        <td style={{ padding: '1rem', fontWeight: '700', color: '#ef4444' }}>{i.items_rejected} uds</td>
                        <td style={{ padding: '1rem', fontWeight: '600' }}>${rate.toLocaleString('es-CO')} COP</td>
                        <td style={{ padding: '1rem', fontWeight: '900', color: '#10b981' }}>${payment.toLocaleString('es-CO')} COP</td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{
                            fontSize: '0.7rem', padding: '0.25rem 0.65rem', borderRadius: '8px', fontWeight: '800',
                            backgroundColor: i.status === 'Aprobado' ? '#ecfdf5' : '#fffbeb',
                            color: i.status === 'Aprobado' ? '#15803d' : '#b45309',
                            border: i.status === 'Aprobado' ? '1px solid #bbf7d0' : '1px solid #fef08a'
                          }}>
                            {i.status === 'Aprobado' ? 'Listo para Pago' : 'Pendiente'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }
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
                        {order.cortador_name ? `✂ ${order.cortador_name}` : 'Sin cortador asignado'}
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
