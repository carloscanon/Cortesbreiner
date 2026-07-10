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
  Info,
  HelpCircle,
  BookOpen,
  Printer,
  Download,
  ArrowUpDown
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
  const [fabricsList, setFabricsList] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [productAccessoriesList, setProductAccessoriesList] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [workshopRates, setWorkshopRates] = useState<any[]>([]);
  const [sewingAssignments, setSewingAssignments] = useState<any[]>([]);
  const [sewingOrdersList, setSewingOrdersList] = useState<any[]>([]);
  const [specialCosts, setSpecialCosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [viewingOrderDetails, setViewingOrderDetails] = useState<any>(null);
  const [printMode, setPrintMode] = useState<'report' | 'sticker'>('report');
  const [activeWorkshopId, setActiveWorkshopId] = useState<string>('all');
  const [expandedWorkshopId, setExpandedWorkshopId] = useState<string | null>(null);
  // IDs de talleres leídos directamente de auth.getUser() (siempre frescos)
  const [authWorkshopIds, setAuthWorkshopIds] = useState<string[]>([]);
  const [adminTab, setAdminTab] = useState<'overview' | 'comparison' | 'workshop_consolidation'>('overview');
  const [compProductId, setCompProductId] = useState<string>('all');
  const [compStartDate, setCompStartDate] = useState<string>('');
  const [compEndDate, setCompEndDate] = useState<string>('');
  const [compPage, setCompPage] = useState<number>(1);
  const [showSatelliteHelp, setShowSatelliteHelp] = useState<boolean>(false);

  // Estados de filtros para consolidación de talleres
  const [consolidationWorkshopId, setConsolidationWorkshopId] = useState<string>('all');
  const [consolidationStatus, setConsolidationStatus] = useState<string>('all');
  const [consolidationSearch, setConsolidationSearch] = useState<string>('');
  const [consolidationStartDate, setConsolidationStartDate] = useState<string>('');
  const [consolidationEndDate, setConsolidationEndDate] = useState<string>('');
  const [consolidationPage, setConsolidationPage] = useState<number>(1);
  const [consolidationSortField, setConsolidationSortField] = useState<string>('created_at');
  const [consolidationSortAsc, setConsolidationSortAsc] = useState<boolean>(false);

  const currentTab = searchParams.get('tab') || 'dashboard';

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Obtener user_metadata fresco del servidor para workshop_id confiable
        const { data: authData } = await supabase.auth.getUser();
        const rawWorkshopId = authData?.user?.user_metadata?.workshop_id || '';
        const parsedWorkshopIds = rawWorkshopId.split(',').map((id: string) => id.trim()).filter(Boolean);
        setAuthWorkshopIds(parsedWorkshopIds);

        const [
          res1,
          res2,
          res3,
          res4,
          res5,
          res6,
          res7,
          res8,
          res9,
          res10,
          res11,
          res12,
          res13,
          res14
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
          (async () => {
            let all: any[] = [];
            let fromVal = 0;
            while (true) {
              const { data, error } = await supabase.from('products').select('*').range(fromVal, fromVal + 999);
              if (error || !data || data.length === 0) break;
              all = [...all, ...data];
              if (data.length < 1000) break;
              fromVal += 1000;
            }
            return { data: all };
          })(),
          supabase.from('product_accessories').select('*, accessories(nombre, unidad_medida), products(nombre_producto)'),
          supabase.from('categories').select('*'),
          supabase.from('workshop_rates').select('*'),
          supabase.from('sewing_assignments').select('*'),
          supabase.from('workshop_special_costs').select('*'),
          (async () => {
            let all: any[] = [];
            let fromVal = 0;
            while (true) {
              const { data, error } = await supabase
                .from('sewing_orders')
                .select('*, parent_order:orders(*, fabrics(*), cuts(*, cut_sizes(*))), products(*), sewing_order_sizes(*, sizes(*))')
                .range(fromVal, fromVal + 999);
              if (error || !data || data.length === 0) break;
              all = [...all, ...data];
              if (data.length < 1000) break;
              fromVal += 1000;
            }
            return { data: all };
          })(),
          supabase.from('fabrics').select('*')
        ]);
        const ordersData = res1.data;
        const workshopsData = res2.data;
        const inspectionsData = res3.data;
        const baseCostsData = res4.data;
        const sData = res5.data;
        const cData = res6.data;
        const pData = res7.data;
        const paData = res8.data;
        const catsData = res9.data;
        const ratesData = res10.data;
        const sewingAssData = res11.data;
        const specCostsData = res12.data;
        const sewingOrdersData = res13.data;
        const fabricsData = res14.data;

        if (ordersData) setOrders(ordersData);
        if (workshopsData) setWorkshops(workshopsData);
        if (inspectionsData) setInspections(inspectionsData);
        if (baseCostsData) setBaseCosts(baseCostsData);
        if (sData) setSizesList(sData);
        if (cData) setColorsList(cData);
        if (pData) setProductsList(pData);
        if (paData) setProductAccessoriesList(paData);
        if (catsData) setCategories(catsData);
        if (ratesData) setWorkshopRates(ratesData);
        if (sewingAssData) setSewingAssignments(sewingAssData);
        if (sewingOrdersData) setSewingOrdersList(sewingOrdersData);
        if (specCostsData) setSpecialCosts(specCostsData);
        if (fabricsData) setFabricsList(fabricsData);

        // Migración automática de asignaciones antiguas
        if (ordersData && sewingOrdersData && sData) {
          const missingMigrations: any[] = [];
          
          ordersData.forEach(order => {
            const hasSewingOrders = sewingOrdersData.some(so => String(so.parent_order_id) === String(order.id));
            if (!hasSewingOrders && order.observaciones) {
              const match = order.observaciones.match(/<!--ASSIGNMENTS_JSON:([\s\S]*?)-->/);
              if (match) {
                try {
                  const assData = JSON.parse(match[1]);
                  const rowWorkshops = assData.rowWorkshops || {};
                  
                  // Agrupar por taller y producto
                  const sewingOrdersMap: Record<string, {
                    workshopId: string;
                    productId: string;
                    cantidadPlaneada: number;
                    sizes: { sizeId: string; qty: number }[];
                  }> = {};

                  Object.entries(rowWorkshops).forEach(([cellKey, wId]) => {
                    if (!wId) return;
                    const [productId, szCode] = cellKey.split('_');
                    
                    const cut = order.cuts?.find((c: any) => String(c.product_id) === String(productId));
                    if (!cut) return;
                    
                    const sizeObj = sData.find(s => String(s.codigo_talla).toLowerCase() === szCode.toLowerCase());
                    if (!sizeObj) return;

                    const szQty = cut.cut_sizes?.find((sc: any) => String(sc.size_id) === String(sizeObj.id));
                    if (!szQty) return;

                    const layersProyec = cut.layers || 1;
                    const layersProduced = cut.layers_produced || 0;
                    const plannedQty = Number(szQty.quantity) || 0;
                    const ppc = plannedQty / layersProyec;
                    const qty = Math.round(ppc * layersProduced);

                    if (qty <= 0) return;

                    const key = `${wId}_${productId}`;
                    if (!sewingOrdersMap[key]) {
                      sewingOrdersMap[key] = {
                        workshopId: String(wId),
                        productId,
                        cantidadPlaneada: 0,
                        sizes: []
                      };
                    }
                    sewingOrdersMap[key].cantidadPlaneada += qty;
                    sewingOrdersMap[key].sizes.push({ sizeId: String(sizeObj.id), qty });
                  });

                  Object.values(sewingOrdersMap).forEach(lot => {
                    missingMigrations.push({
                      parent_order_id: order.id,
                      workshop_id: lot.workshopId,
                      product_id: lot.productId,
                      cantidad_planeada: lot.cantidadPlaneada,
                      sizes: lot.sizes,
                      cleanCode: (order.internal_code || '').replace(/^OC-?/i, '') || order.consecutive || '—'
                    });
                  });
                } catch (e) {
                  console.warn("Error parsing historical assignments JSON:", e);
                }
              }
            }
          });

          if (missingMigrations.length > 0) {
            (async () => {
              for (const migration of missingMigrations) {
                // Generar correlativo
                const { data: existing } = await supabase.from('sewing_orders').select('id').eq('parent_order_id', migration.parent_order_id);
                const count = (existing || []).length;
                const confCode = `${migration.cleanCode}-${count + 1}`;

                const { data: inserted, error: insErr } = await supabase.from('sewing_orders').insert({
                  parent_order_id: migration.parent_order_id,
                  confeccion_code: confCode,
                  workshop_id: migration.workshop_id,
                  product_id: migration.product_id,
                  status: 'En Confección',
                  cantidad_planeada: migration.cantidad_planeada,
                  cantidad_confeccionada: 0
                }).select().single();

                if (inserted && migration.sizes.length > 0) {
                  const sizesToInsert = migration.sizes.map((s: any) => ({
                    sewing_order_id: inserted.id,
                    size_id: s.sizeId,
                    cantidad_planeada: s.qty,
                    cantidad_confeccionada: 0
                  }));
                  await supabase.from('sewing_order_sizes').insert(sizesToInsert);
                }
              }
              // Refrescar el estado de órdenes de confección tras migrar
              const { data: freshSewingOrders } = await supabase.from('sewing_orders').select('*, parent_order:orders(*, fabrics(*), cuts(*, cut_sizes(*))), products(*), sewing_order_sizes(*, sizes(*))');              
              if (freshSewingOrders) setSewingOrdersList(freshSewingOrders);
            })();
          }
        }
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
    // 1. IDs de talleres del usuario: priorizar los de auth.getUser() (frescos), fallback al profile
    const userWorkshopIds = authWorkshopIds.length > 0
      ? authWorkshopIds
      : (profile?.workshop_id || '').split(',').map((id: string) => id.trim()).filter(Boolean);

    // 2. Encontrar talleres que coincidan por ID o por nombre/responsable
    const associatedWorkshops = workshops.filter(w => {
      const byId = userWorkshopIds.includes(String(w.id));
      const byName = (w.nombre_taller || '').toLowerCase().trim() === (profile?.full_name || '').toLowerCase().trim() ||
                     (w.responsable || '').toLowerCase().trim() === (profile?.full_name || '').toLowerCase().trim();
      return byId || byName;
    });

    // 3. Solo mostrar los talleres que el usuario tiene realmente asociados (si no tiene ninguno, la lista debe ser vacía para que muestre 0)
    const finalWorkshopsList = associatedWorkshops;

    // Determinar qué taller está seleccionado actualmente en el selector superior (o todos)
    const userWorkshop = activeWorkshopId === 'all'
      ? (finalWorkshopsList.length > 0 ? finalWorkshopsList[0] : null)
      : (finalWorkshopsList.find(w => String(w.id) === String(activeWorkshopId)) || null);

    const getCostsFromJson = (order: any) => {
      if (!order || !order.observaciones) return {};
      const match = order.observaciones.match(/<!--COSTS_JSON:(.*?)-->/);
      if (!match) return {};
      try { return JSON.parse(match[1]); } catch (e) { return {}; }
    };

    const getAssignmentsFromJson = (order: any) => {
      if (!order || !order.observaciones) return null;
      const match = order.observaciones.match(/<!--ASSIGNMENTS_JSON:(.*?)-->/);
      if (!match) return null;
      try { return JSON.parse(match[1]); } catch (e) { return null; }
    };

    // Mapear asignaciones: la tabla sewing_assignments guarda category_id = product.id (no el category real)
    // El JSON observaciones guarda rowWorkshops con clave `{product.id}_{size_code}` y valor workshop_id (UUID)
    const getOrderAssignments = (order: any) => {
      const rowWorkshops: Record<string, string> = {};
      const orderAss = sewingAssignments.filter(a => a.order_id === order.id);

      if (orderAss.length > 0) {
        // sewing_assignments.category_id = product.id (ver sewing/page.tsx getCategoryAssignmentsData)
        orderAss.forEach(asg => {
          // Clave por product_id (que es lo que guarda category_id en la tabla)
          rowWorkshops[`${asg.category_id}_${asg.size_code}`] = asg.workshop_id;
        });
        return { rowWorkshops };
      }

      // Fallback: leer del JSON en observaciones
      const assData = getAssignmentsFromJson(order);
      if (assData && assData.rowWorkshops) {
        Object.entries(assData.rowWorkshops).forEach(([key, wId]) => {
          rowWorkshops[key] = String(wId);
        });
        return { rowWorkshops };
      }
      return null;
    };

    // Filtrar órdenes asignadas a cualquiera de los talleres del usuario
    const assignedOrders = orders.filter(o => {
      // Restringir estrictamente a órdenes que ya estén en taller (en confección o terminadas/enviadas)
      const isSewingState = o.status === 'En Confección' || o.status === 'Terminada' || o.status === 'Enviada';
      if (!isSewingState) return false;

      // 1. Coincidencia directa en cabecera de orden
      const isDirectMatch = finalWorkshopsList.some(w =>
        String(o.workshop_id).toLowerCase().trim() === String(w.id).toLowerCase().trim() ||
        (o.workshops?.nombre_taller || '').toLowerCase().trim() === (w.nombre_taller || '').toLowerCase().trim()
      );
      if (isDirectMatch) return true;

      // 2. Coincidencia en la matriz de asignaciones (rowWorkshops)
      const assData = getOrderAssignments(o);
      if (assData && assData.rowWorkshops) {
        const match = Object.values(assData.rowWorkshops).some(wId =>
          finalWorkshopsList.some(w =>
            String(w.id).toLowerCase().trim() === String(wId).toLowerCase().trim() ||
            (w.nombre_taller || '').toLowerCase().trim() === String(wId).toLowerCase().trim()
          )
        );
        return match;
      }
      return false;
    });

    const pendingOrders = assignedOrders.filter(o => o.status === 'En Confección');
    const completedOrders = assignedOrders.filter(o => o.status === 'Terminada' || o.status === 'Enviada');

    // Inspecciones de todos los talleres del usuario (el selector solo afecta la vista, no el pool)
    const workshopInspections = inspections.filter(i =>
      finalWorkshopsList.some(w => (i.workshop_name || '').toLowerCase().trim() === (w.nombre_taller || '').toLowerCase().trim())
    );

    const totalApprovedGarments = workshopInspections.reduce((s, i) => s + (i.items_approved || 0), 0);
    const totalRejectedGarments = workshopInspections.reduce((s, i) => s + (i.items_rejected || 0), 0);

    // Obtener código único de confección por taller (ej. 12XKE-1, 12XKE-2)
    const getConfeccionCode = (order: any, workshopId: string, productId?: string) => {
      const cleanCode = (order.internal_code || '').replace(/^OC-?/i, '') || order.consecutive || '—';
      const assignments = getOrderAssignments(order);
      if (!assignments || !assignments.rowWorkshops) return `${cleanCode}-1`;

      // Encontrar todos los talleres únicos asignados a esta orden en rowWorkshops
      const uniqueWorkshops: string[] = [];
      
      // Si el taller de la cabecera está y no está en la matriz, lo agregamos primero para mantener consistencia
      const headWorkshopId = order.workshop_id ? String(order.workshop_id).toLowerCase().trim() : '';
      if (headWorkshopId) {
        uniqueWorkshops.push(headWorkshopId);
      }

      Object.values(assignments.rowWorkshops).forEach(wId => {
        if (wId) {
          const cleanWId = String(wId).toLowerCase().trim();
          if (!uniqueWorkshops.includes(cleanWId)) {
            uniqueWorkshops.push(cleanWId);
          }
        }
      });

      const targetWId = String(workshopId).toLowerCase().trim();
      const idx = uniqueWorkshops.indexOf(targetWId) + 1;
      const displayIdx = idx > 0 ? idx : 1;
      return `${cleanCode}-${displayIdx}`;
    };

    // Obtener prendas asignadas a un taller y un producto específico
    const getPrendasParaTallerYProducto = (order: any, workshopId: string, productId: string) => {
      if (!order.cuts) return { planeadas: 0, confeccionadas: 0 };
      const assignments = getOrderAssignments(order);
      if (!assignments || !assignments.rowWorkshops) return { planeadas: 0, confeccionadas: 0 };

      let planeadas = 0;
      let confeccionadas = 0;
      const wid = String(workshopId).toLowerCase().trim();

      order.cuts.forEach((cut: any) => {
        if (String(cut.product_id) !== String(productId)) return;
        const prodId = String(cut.product_id);
        const layersProyec = cut.layers || 1;
        const layersProduced = cut.layers_produced || 0;

        (cut.cut_sizes || []).forEach((cs: any) => {
          const qty = Number(cs.quantity) || 0;
          const sizeObj = sizesList.find(s => String(s.id) === String(cs.size_id));
          const sz = sizeObj ? sizeObj.codigo_talla : 'S/T';
          const cellKey = `${prodId}_${sz}`;

          const assignedTo = assignments.rowWorkshops[cellKey];
          if (assignedTo && String(assignedTo).toLowerCase().trim() === wid) {
            planeadas += qty;
            const ppc = qty / layersProyec;
            confeccionadas += layersProduced > 0 ? Math.round(ppc * layersProduced) : 0;
          }
        });
      });

      return { planeadas, confeccionadas };
    };

    let totalAuthorizedUnits = 0;
    let totalSewedUnits = 0;
    let totalAuthorizedPayment = 0;
    let totalSewedPayment = 0;

    const baseSewingGlobal = baseCosts.find(c => c.concepto?.toLowerCase() === 'costura')?.valor || 2500;

    // Si está en consolidado, sumamos todos los talleres asociados, si no, solo el taller seleccionado
    const workshopsToAggregate = activeWorkshopId === 'all' 
      ? finalWorkshopsList 
      : finalWorkshopsList.filter(w => String(w.id) === String(activeWorkshopId));

    workshopsToAggregate.forEach(currentWs => {
      const wsSewingOrders = sewingOrdersList.filter(so => 
        String(so.workshop_id).toLowerCase().trim() === String(currentWs.id).toLowerCase().trim()
      );

      // Calcular Autorizados (lo planeado que se le envió al taller)
      wsSewingOrders.forEach(so => {
        if (so.status !== 'En Confección' && so.status !== 'Terminada' && so.status !== 'Enviada') return;

        const prod = productsList.find(p => String(p.id) === String(so.product_id));
        const categoryObj = prod ? categories.find(c => String(c.id) === String(prod.category_id)) : null;
        const catBaseRate = categoryObj?.base_rate || baseSewingGlobal;

        let itemRate = catBaseRate;
        if (categoryObj) {
          const rateObj = workshopRates.find(r => 
            String(r.workshop_id).toLowerCase().trim() === String(currentWs.id).toLowerCase().trim() && 
            String(r.category_id).toLowerCase().trim() === String(categoryObj.id).toLowerCase().trim()
          );
          if (rateObj && Number(rateObj.rate) > 0) {
            itemRate = Number(rateObj.rate);
          }
        }

        let finalRate = itemRate;
        if (so.tarifa_especial !== null && so.tarifa_especial !== undefined && Number(so.tarifa_especial) > 0) {
          const specCostObj = specialCosts.find(sc => 
            String(sc.workshop_id).toLowerCase() === String(currentWs.id).toLowerCase() && 
            String(sc.product_id).toLowerCase() === String(so.product_id).toLowerCase()
          );
          if (specCostObj && Number(specCostObj.special_rate) > 0) {
            finalRate = Number(specCostObj.special_rate);
          }
        }

        const plannedQty = so.cantidad_planeada || 0;
        totalAuthorizedUnits += plannedQty;
        totalAuthorizedPayment += plannedQty * finalRate;
      });

      // Calcular Confeccionados/Aprobados reales a pagar basados en las inspecciones de calidad aprobadas
      const wsInsps = inspections.filter(i => 
        (i.workshop_name || '').toLowerCase().trim() === (currentWs.nombre_taller || '').toLowerCase().trim()
      );

      wsInsps.forEach(i => {
        // Encontrar la orden de confección correspondiente a la orden de corte (i.order_id)
        const parentOrder = orders.find(o => o.id === i.order_id);
        if (!parentOrder || !parentOrder.cuts || parentOrder.cuts.length === 0) return;

        const cut = parentOrder.cuts[0];
        const prod = productsList.find(p => String(p.id) === String(cut.product_id));
        const categoryObj = prod ? categories.find(c => String(c.id) === String(prod.category_id)) : null;
        if (!categoryObj) return;

        let itemRate = categoryObj.base_rate || baseSewingGlobal;
        const rateObj = workshopRates.find(r => 
          String(r.workshop_id).toLowerCase().trim() === String(currentWs.id).toLowerCase().trim() && 
          String(r.category_id).toLowerCase().trim() === String(categoryObj.id).toLowerCase().trim()
        );
        if (rateObj && Number(rateObj.rate) > 0) {
          itemRate = Number(rateObj.rate);
        }

        // Buscar si la orden de confección correspondiente tiene flag de precio especial
        const so = sewingOrdersList.find(s => 
          String(s.parent_order_id) === String(i.order_id) && 
          String(s.workshop_id).toLowerCase().trim() === String(currentWs.id).toLowerCase().trim()
        );

        let finalRate = itemRate;
        if (so && so.tarifa_especial !== null && so.tarifa_especial !== undefined && Number(so.tarifa_especial) > 0) {
          const specCostObj = specialCosts.find(sc => 
            String(sc.workshop_id).toLowerCase() === String(currentWs.id).toLowerCase() && 
            String(sc.product_id).toLowerCase() === String(cut.product_id).toLowerCase()
          );
          if (specCostObj && Number(specCostObj.special_rate) > 0) {
            finalRate = Number(specCostObj.special_rate);
          }
        }

        const approvedQty = i.items_approved || 0;
        totalSewedUnits += approvedQty;
        totalSewedPayment += approvedQty * finalRate;
      });
    });

    const averageRate = totalSewedUnits > 0 
      ? Math.round(totalSewedPayment / totalSewedUnits) 
      : (totalAuthorizedUnits > 0 ? Math.round(totalAuthorizedPayment / totalAuthorizedUnits) : 0);

    const getRateForOrder = (orderId: string) => {
      const orderObj = orders.find(o => o.id === orderId);
      if (!orderObj || !orderObj.cuts || orderObj.cuts.length === 0) return averageRate;

      const cut = orderObj.cuts[0];
      const prod = productsList.find(p => String(p.id) === String(cut.product_id));
      const categoryObj = prod ? categories.find(c => String(c.id) === String(prod.category_id)) : null;
      if (!categoryObj) return averageRate;

      // Buscar si para este taller y esta orden de corte existe alguna orden de confección con flag de precio especial
      const sewingOrderForThis = sewingOrdersList.find(so => 
        String(so.parent_order_id) === String(orderId) &&
        userWorkshop &&
        String(so.workshop_id).toLowerCase() === String(userWorkshop.id).toLowerCase() &&
        String(so.product_id) === String(cut.product_id) &&
        so.tarifa_especial !== null &&
        Number(so.tarifa_especial) > 0
      );

      if (sewingOrderForThis) {
        // Buscar la tarifa en workshop_special_costs
        const specCostObj = specialCosts.find(sc => 
          userWorkshop &&
          String(sc.workshop_id).toLowerCase() === String(userWorkshop.id).toLowerCase() && 
          String(sc.product_id).toLowerCase() === String(prod?.id).toLowerCase()
        );
        if (specCostObj && Number(specCostObj.special_rate) > 0) {
          return Number(specCostObj.special_rate);
        }
      }

      const rateObj = workshopRates.find(r => 
        userWorkshop &&
        String(r.workshop_id).toLowerCase() === String(userWorkshop.id).toLowerCase() && 
        String(r.category_id).toLowerCase() === String(categoryObj.id).toLowerCase()
      );
      if (rateObj && Number(rateObj.rate) > 0) {
        return Number(rateObj.rate);
      }

      return categoryObj.base_rate || baseSewingGlobal / 5;
    };

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

    // ─── Prendas asignadas A UN TALLER específico en una orden ────────────────
    // La clave rowWorkshops es `{product.id}_{size_code}` → workshop_id (UUID)
    const getPrendasParaTaller = (order: any, workshopId: string) => {
      if (!order.cuts) return { planeadas: 0, confeccionadas: 0 };
      const assignments = getOrderAssignments(order);
      if (!assignments || !assignments.rowWorkshops) return { planeadas: 0, confeccionadas: 0 };

      let planeadas = 0;
      let confeccionadas = 0;
      const wid = String(workshopId).toLowerCase().trim();

      order.cuts.forEach((cut: any) => {
        const prod = productsList.find(p => String(p.id) === String(cut.product_id));
        const prodId = prod ? String(prod.id) : 'sin_prod';
        const layersProyec = cut.layers || 1;
        const layersProduced = cut.layers_produced || 0;

        (cut.cut_sizes || []).forEach((cs: any) => {
          const qty = Number(cs.quantity) || 0;
          const sizeObj = sizesList.find(s => String(s.id) === String(cs.size_id));
          const sz = sizeObj ? sizeObj.codigo_talla : 'S/T';
          const cellKey = `${prodId}_${sz}`;

          const assignedTo = assignments.rowWorkshops[cellKey];
          if (assignedTo && String(assignedTo).toLowerCase().trim() === wid) {
            planeadas += qty;
            const ppc = qty / layersProyec;
            confeccionadas += layersProduced > 0 ? Math.round(ppc * layersProduced) : 0;
          }
        });
      });

      return { planeadas, confeccionadas };
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

    // Contabilizar las órdenes activas y terminadas sumando individualmente por cada taller asignado
    let activeConfeccionesCount = 0;
    let completedConfeccionesCount = 0;

    finalWorkshopsList.filter(w => activeWorkshopId === 'all' || String(w.id) === String(activeWorkshopId)).forEach(w => {
      const wsSewingOrders = sewingOrdersList.filter(so => 
        String(so.workshop_id).toLowerCase().trim() === String(w.id).toLowerCase().trim()
      );

      wsSewingOrders.forEach(so => {
        const plannedQty = so.cantidad_planeada || 0;
        if (plannedQty <= 0) return;

        const parentOrder = so.parent_order || {};
        const parentCuts = parentOrder.cuts || [];
        const cut = parentCuts.find((c: any) => String(c.product_id) === String(so.product_id));
        let actualSewedQty = 0;
        if (cut) {
          const layersProyec = cut.layers || 1;
          const layersProduced = cut.layers_produced || 0;
          const pct = layersProyec > 0 ? layersProduced / layersProyec : 0;
          actualSewedQty = Math.round(plannedQty * pct);
        } else {
          actualSewedQty = so.cantidad_confeccionada || 0;
        }

        if (actualSewedQty >= plannedQty) {
          completedConfeccionesCount++;
        } else {
          activeConfeccionesCount++;
        }
      });
    });

    // Main Workshop Dashboard Tab
    if (currentTab === 'dashboard') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '4rem' }}>
          {/* 1. Encabezado Ejecutivo Consolidado */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1.5rem', backgroundColor: 'white', padding: '1.5rem 2rem', borderRadius: '18px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              {profile?.avatar_url ? (
                <div style={{ width: '70px', height: '70px', borderRadius: '16px', overflow: 'hidden', border: '3px solid white', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}>
                  <img src={profile.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ) : (
                <div style={{ width: '70px', height: '70px', borderRadius: '16px', backgroundColor: 'var(--primary-lighter)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid white', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}>
                  <Factory size={28} />
                </div>
              )}
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: 'var(--primary-lighter)', padding: '3px 8px', borderRadius: '6px' }}>
                  Centro de Control
                </span>
                <h1 style={{ fontSize: '1.8rem', fontWeight: '950', margin: '0.2rem 0 0.1rem 0', color: '#0f172a', lineHeight: 1.1 }}>
                  Hola Liliana 👋
                </h1>
                <p style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '600', margin: 0 }}>
                  Administras <strong style={{ color: '#0f172a' }}>{finalWorkshopsList.length} talleres asociados</strong> desde esta pantalla consolidada.
                </p>
              </div>
            </div>

            {/* Selector de Taller */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#64748b' }}>Taller Activo:</span>
              <select
                value={activeWorkshopId}
                onChange={e => setActiveWorkshopId(e.target.value)}
                style={{
                  padding: '0.65rem 1.25rem',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.82rem',
                  fontWeight: '900',
                  backgroundColor: 'white',
                  color: '#0f172a',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                }}
              >
                <option value="all">🌐 Consolidado General</option>
                {finalWorkshopsList.map(w => (
                  <option key={w.id} value={w.id}>🏭 {w.nombre_taller}</option>
                ))}
              </select>
            </div>

            {/* Botón de Ayuda */}
            <button
              onClick={() => setShowSatelliteHelp(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.6rem 1.1rem', borderRadius: '10px',
                border: '1.5px solid var(--border)', cursor: 'pointer',
                fontSize: '0.8rem', fontWeight: '800',
                backgroundColor: 'white', color: 'var(--text-muted)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)';
                (e.currentTarget as HTMLElement).style.color = 'var(--primary)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
              }}
            >
              <HelpCircle size={16} /> Ayuda
            </button>
          </div>

          {/* ── Modal de Ayuda del Portal Satélite ──────────────────────────── */}
          {showSatelliteHelp && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
              <div style={{ backgroundColor: 'white', borderRadius: '24px', width: '100%', maxWidth: '650px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 40px 80px -20px rgba(0,0,0,0.35)' }}>
                {/* Header del modal */}
                <div style={{ background: 'linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%)', padding: '2rem', borderRadius: '24px 24px 0 0', color: 'white', position: 'sticky', top: 0, zIndex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <BookOpen size={24} />
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8 }}>Centro de Ayuda</p>
                        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '950' }}>Guía del Portal de Taller</h2>
                      </div>
                    </div>
                    <button onClick={() => setShowSatelliteHelp(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '10px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', flexShrink: 0 }}>
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Contenido del modal */}
                <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

                  {/* Flujo General */}
                  <div>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: '900', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: '#eef2ff', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '900', flexShrink: 0 }}>1</span>
                      ¿Cómo funciona este portal?
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', paddingLeft: '2rem' }}>
                      {[
                        { icon: '📦', title: 'Recibe órdenes de confección', desc: 'Las órdenes asignadas a tu taller aparecen automáticamente en la sección "Estado de mis Talleres".' },
                        { icon: '✂️', title: 'Registra tu avance', desc: 'Actualiza el progreso de cada lote a medida que confeccionas las prendas. Esto permite que la planta vea tu avance en tiempo real.' },
                        { icon: '📋', title: 'Consulta el comprobante de despacho', desc: 'Al hacer clic en "Ver Detalles" de una orden activa, puedes ver e imprimir la relación de despacho con los detalles de las prendas y tallas.' },
                        { icon: '✅', title: 'Entrega y calidad', desc: 'Cuando entregues las prendas, la planta registra la inspección de calidad. El resultado aparecerá en "Historial de Entregas y Pagos".' },
                        { icon: '💰', title: 'Liquidación de pagos', desc: 'Una vez aprobadas las prendas en calidad, el saldo confeccionado se calcula automáticamente según la tarifa del taller.' },
                      ].map((step, i) => (
                        <div key={i} style={{ display: 'flex', gap: '0.75rem', padding: '0.85rem 1rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{step.icon}</span>
                          <div>
                            <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: '800', color: '#1e293b' }}>{step.title}</p>
                            <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4' }}>{step.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Métricas */}
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: '900', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '900', flexShrink: 0 }}>2</span>
                      ¿Qué significan los indicadores?
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', paddingLeft: '2rem' }}>
                      {[
                        { label: '🔵 Órdenes Activas', desc: 'Lotes de confección que actualmente tienes asignados y aún no han sido completados.' },
                        { label: '✅ Órdenes Terminadas', desc: 'Lotes que ya completaste y han pasado por inspección de calidad.' },
                        { label: '👗 Prendas Aprobadas', desc: 'Total de prendas revisadas y aceptadas por la planta en control de calidad.' },
                        { label: '💵 Saldo Confeccionado', desc: 'Valor económico acumulado de las prendas aprobadas, calculado con tu tarifa asignada.' },
                      ].map((m, i) => (
                        <div key={i} style={{ padding: '0.85rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                          <p style={{ margin: '0 0 0.25rem', fontSize: '0.78rem', fontWeight: '800', color: '#1e293b' }}>{m.label}</p>
                          <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b', lineHeight: '1.35' }}>{m.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Consejos */}
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: '900', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: '#fffbeb', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '900', flexShrink: 0 }}>3</span>
                      Consejos para optimizar tu trabajo
                    </h3>
                    <div style={{ paddingLeft: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {[
                        '💡 Actualiza el progreso de tus lotes al menos una vez al día para que la planta tenga visibilidad precisa.',
                        '🖨️ Imprime la relación de despacho antes de cada entrega para tener soporte físico.',
                        '📞 Si ves un error en los datos de una orden (tallas, cantidades), comunícate con la planta inmediatamente.',
                        '⏰ Las entregas a tiempo mejoran tu puntuación de desempeño y pueden darte acceso a tarifas preferenciales.',
                        '🔄 Si el portal no carga datos nuevos, recarga la página — los datos se actualizan en tiempo real desde la planta.',
                      ].map((tip, i) => (
                        <p key={i} style={{ margin: 0, fontSize: '0.78rem', color: '#475569', padding: '0.5rem 0.75rem', backgroundColor: '#fafafa', borderRadius: '8px', borderLeft: '3px solid #fbbf24', lineHeight: '1.4' }}>{tip}</p>
                      ))}
                    </div>
                  </div>

                  {/* Botón cerrar */}
                  <button
                    onClick={() => setShowSatelliteHelp(false)}
                    style={{ padding: '0.85rem', borderRadius: '12px', border: 'none', cursor: 'pointer', backgroundColor: 'var(--primary)', color: 'white', fontWeight: '800', fontSize: '0.875rem', width: '100%', marginTop: '0.5rem' }}
                  >
                    Entendido — Cerrar guía
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. Acordeón / Estado Detallado por Taller */}
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '900', color: '#0f172a', marginBottom: '1rem' }}>🏭 Estado y Detalle de Mis Talleres</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
              {finalWorkshopsList.filter(w => activeWorkshopId === 'all' || String(w.id) === String(activeWorkshopId)).map(w => {
                // Filtrar las órdenes de confección asignadas a este taller
                const wsSewingOrders = sewingOrdersList.filter(so => 
                  String(so.workshop_id).toLowerCase().trim() === String(w.id).toLowerCase().trim()
                );

                const wsLotes: { 
                  order: any; 
                  productId: string; 
                  productName: string; 
                  planeadas: number; 
                  confeccionadas: number;
                  confeccionCode: string;
                  sewingOrderId: string;
                }[] = [];

                wsSewingOrders.forEach(so => {
                  const parentOrder = so.parent_order || {};
                  const prodObj = productsList.find(p => String(p.id) === String(so.product_id));
                  const plannedQty = so.cantidad_planeada || 0;
                  if (plannedQty <= 0) return;

                  const parentCuts = parentOrder.cuts || [];
                  const cut = parentCuts.find((c: any) => String(c.product_id) === String(so.product_id));
                  let actualSewedQty = 0;
                  if (cut) {
                    const layersProyec = cut.layers || 1;
                    const layersProduced = cut.layers_produced || 0;
                    const pct = layersProyec > 0 ? layersProduced / layersProyec : 0;
                    actualSewedQty = Math.round(plannedQty * pct);
                  } else {
                    actualSewedQty = so.cantidad_confeccionada || 0;
                  }

                  wsLotes.push({
                    order: parentOrder,
                    productId: so.product_id,
                    productName: prodObj ? prodObj.nombre_producto : 'Referencia',
                    planeadas: plannedQty,
                    confeccionadas: actualSewedQty,
                    confeccionCode: so.confeccion_code,
                    sewingOrderId: so.id
                  });
                });

                const wsPending = wsLotes.filter(lot => lot.confeccionadas < lot.planeadas);
                const wsCompleted = wsLotes.filter(lot => lot.confeccionadas >= lot.planeadas);
                const wsInsps = inspections.filter(i => (i.workshop_name || '').toLowerCase().trim() === (w.nombre_taller || '').toLowerCase().trim());
                const wsApproved = wsInsps.reduce((s, i) => s + (i.items_approved || 0), 0);
                const isExpanded = expandedWorkshopId === w.id;

                const totals = wsLotes.reduce((acc: { planeadas: number; confeccionadas: number }, lot) => {
                  return { planeadas: acc.planeadas + lot.planeadas, confeccionadas: acc.confeccionadas + lot.confeccionadas };
                }, { planeadas: 0, confeccionadas: 0 });

                const pctGlobal = totals.planeadas > 0 ? Math.round((totals.confeccionadas / totals.planeadas) * 100) : 0;

                // Paleta de colores únicos por índice de taller
                const ACCENT_PALETTES = [
                  { from: '#4f46e5', to: '#7c3aed', light: '#eef2ff', text: '#3730a3', pill: '#c7d2fe' },
                  { from: '#0891b2', to: '#0e7490', light: '#ecfeff', text: '#155e75', pill: '#a5f3fc' },
                  { from: '#059669', to: '#047857', light: '#ecfdf5', text: '#065f46', pill: '#a7f3d0' },
                  { from: '#d97706', to: '#b45309', light: '#fffbeb', text: '#92400e', pill: '#fde68a' },
                  { from: '#db2777', to: '#be185d', light: '#fdf2f8', text: '#831843', pill: '#fbcfe8' },
                ];
                const wIdx = finalWorkshopsList.indexOf(w) % ACCENT_PALETTES.length;
                const pal = ACCENT_PALETTES[wIdx];
                const initial = (w.nombre_taller || 'T').charAt(0).toUpperCase();

                // SVG donut ring
                const r = 22; const circ = 2 * Math.PI * r;
                const dash = (pctGlobal / 100) * circ;

                const hasOrders = wsLotes.length > 0;

                return (
                  <div key={w.id} style={{
                    borderRadius: '22px',
                    overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)',
                    border: '1px solid rgba(255,255,255,0.8)',
                    display: 'flex', flexDirection: 'column',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    background: 'white',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 16px 40px rgba(0,0,0,0.11)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.07)'; }}
                  >
                    {/* ── Header con gradiente ── */}
                    <div style={{
                      background: `linear-gradient(135deg, ${pal.from} 0%, ${pal.to} 100%)`,
                      padding: '1.25rem 1.5rem',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                      position: 'relative', overflow: 'hidden',
                    }}>
                      {/* Círculo decorativo fondo */}
                      <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '90px', height: '90px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
                      <div style={{ position: 'absolute', bottom: '-30px', right: '30px', width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
                      {/* Ícono textil decorativo */}
                      <img
                        src="/textile-icon.png"
                        alt=""
                        style={{
                          position: 'absolute', bottom: '10px', right: '14px',
                          width: '38px', height: '38px', objectFit: 'contain',
                          filter: 'brightness(0) invert(1)',
                          opacity: 0.18, pointerEvents: 'none', zIndex: 0,
                        }}
                      />

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', position: 'relative', zIndex: 1 }}>
                        {/* Avatar con inicial del taller */}
                        <div style={{
                          width: '46px', height: '46px', borderRadius: '14px',
                          background: 'rgba(255,255,255,0.2)',
                          backdropFilter: 'blur(8px)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: '1.5px solid rgba(255,255,255,0.35)',
                          flexShrink: 0,
                        }}>
                          <span style={{ fontSize: '1.35rem', fontWeight: '900', color: 'white', lineHeight: 1 }}>{initial}</span>
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '900', color: 'white', lineHeight: 1.2 }}>{w.nombre_taller}</h4>
                          <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.75)', fontWeight: '600' }}>
                            👤 {w.responsable || '—'}
                          </span>
                        </div>
                      </div>

                      {/* Badge de estado */}
                      <span style={{
                        padding: '0.25rem 0.65rem', borderRadius: '20px', fontSize: '0.62rem', fontWeight: '900',
                        background: wsLotes.length > 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)',
                        color: 'white', border: '1px solid rgba(255,255,255,0.3)',
                        backdropFilter: 'blur(4px)', position: 'relative', zIndex: 1, whiteSpace: 'nowrap',
                      }}>
                        {wsLotes.length > 0 ? `● ${wsLotes.length} lote${wsLotes.length !== 1 ? 's' : ''}` : '○ Disponible'}
                      </span>
                    </div>

                    {/* ── Cuerpo con métricas ── */}
                    <div style={{ padding: '1.35rem 1.5rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

                      {/* Donut + métricas */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        {/* SVG donut */}
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <svg width="60" height="60" viewBox="0 0 60 60">
                            <circle cx="30" cy="30" r={r} fill="none" stroke="#f1f5f9" strokeWidth="7" />
                            <circle
                              cx="30" cy="30" r={r} fill="none"
                              stroke={pal.from} strokeWidth="7"
                              strokeDasharray={`${dash} ${circ}`}
                              strokeLinecap="round"
                              transform="rotate(-90 30 30)"
                              style={{ transition: 'stroke-dasharray 0.6s ease' }}
                            />
                          </svg>
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: '900', color: pal.text }}>{pctGlobal}%</span>
                          </div>
                        </div>

                        {/* Stats */}
                        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 0.75rem' }}>
                          <div>
                            <span style={{ fontSize: '0.6rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', display: 'block' }}>Planeadas</span>
                            <span style={{ fontSize: '1.1rem', fontWeight: '900', color: '#1e293b' }}>{totals.planeadas}</span>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.6rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', display: 'block' }}>Confeccionadas</span>
                            <span style={{ fontSize: '1.1rem', fontWeight: '900', color: pal.text }}>{totals.confeccionadas}</span>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.6rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', display: 'block' }}>En Confección</span>
                            <span style={{ fontSize: '1.1rem', fontWeight: '900', color: '#1e293b' }}>{wsPending.length}</span>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.6rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', display: 'block' }}>Aprobadas</span>
                            <span style={{ fontSize: '1.1rem', fontWeight: '900', color: '#059669' }}>{wsApproved}</span>
                          </div>
                        </div>
                      </div>

                      {/* Pills de estado */}
                      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                        {wsPending.length > 0 && (
                          <span style={{ padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.62rem', fontWeight: '800', background: pal.light, color: pal.text, border: `1px solid ${pal.pill}` }}>
                            🧵 {wsPending.length} en proceso
                          </span>
                        )}
                        {wsCompleted.length > 0 && (
                          <span style={{ padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.62rem', fontWeight: '800', background: '#f0fdf4', color: '#065f46', border: '1px solid #a7f3d0' }}>
                            ✅ {wsCompleted.length} terminada{wsCompleted.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        {wsLotes.length === 0 && (
                          <span style={{ padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.62rem', fontWeight: '800', background: '#f8fafc', color: '#94a3b8', border: '1px solid #e2e8f0' }}>
                            Sin órdenes activas
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ── Footer: botón expandir ── */}
                    <div style={{ borderTop: '1px solid #f1f5f9' }}>
                      <button
                        onClick={() => setExpandedWorkshopId(isExpanded ? null : w.id)}
                        style={{
                          width: '100%', padding: '0.85rem 1.5rem',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          background: isExpanded ? pal.light : 'white',
                          border: 'none', cursor: 'pointer',
                          fontSize: '0.75rem', fontWeight: '800', color: pal.text,
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <span>{isExpanded ? '▲ Ocultar lotes' : '▼ Ver lotes de confección'}</span>
                        <span style={{
                          background: pal.light, color: pal.text,
                          borderRadius: '8px', padding: '0.15rem 0.5rem',
                          fontSize: '0.65rem', fontWeight: '900'
                        }}>{wsLotes.length}</span>
                      </button>

                      {/* ── Panel expandido ── */}
                      {isExpanded && (
                        <div style={{ background: pal.light, borderTop: `2px solid ${pal.pill}`, padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                          {(() => {
                            if (wsLotes.length === 0) {
                              return (
                                <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                                  Sin órdenes asignadas a este taller
                                </div>
                              );
                            }

                            return wsLotes.map(({ order, productId, productName, planeadas, confeccionadas, confeccionCode, sewingOrderId }) => {
                              const pct = planeadas > 0 ? Math.round((confeccionadas / planeadas) * 100) : 0;
                              const isTerminada = confeccionadas >= planeadas;
                              return (
                                <div
                                  key={sewingOrderId}
                                  onClick={() => {
                                    const realSewingOrder = sewingOrdersList.find(so => so.confeccion_code === confeccionCode);
                                    if (realSewingOrder) {
                                      setViewingOrderDetails(realSewingOrder);
                                    }
                                  }}
                                  style={{
                                    background: 'white', borderRadius: '14px',
                                    border: `1.5px solid ${isTerminada ? '#bbf7d0' : pal.pill}`,
                                    padding: '0.9rem 1.1rem', cursor: 'pointer',
                                    display: 'flex', flexDirection: 'column', gap: '0.5rem',
                                    transition: 'all 0.15s ease',
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                                  }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateX(4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateX(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 6px rgba(0,0,0,0.04)'; }}
                                >
                                  {/* Row 1: código + status */}
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <div style={{ width: '32px', height: '32px', borderRadius: '99px', background: pal.light, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: '5px' }}>
                                        <img src="/textile-icon.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: `brightness(0) saturate(100%) ${pal.text === '#3730a3' ? 'invert(20%) sepia(80%) saturate(3000%) hue-rotate(230deg)' : pal.text === '#155e75' ? 'invert(25%) sepia(70%) saturate(2000%) hue-rotate(175deg)' : pal.text === '#065f46' ? 'invert(25%) sepia(60%) saturate(2000%) hue-rotate(130deg)' : 'invert(30%) sepia(80%) saturate(2000%) hue-rotate(20deg)'}` }} />
                                      </div>
                                      <div>
                                        <strong style={{ fontSize: '0.82rem', color: pal.text, display: 'block', lineHeight: 1.1 }}>
                                          {confeccionCode}
                                        </strong>
                                        <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '600' }}>{productName} (OC-{(order.internal_code || '').replace(/^OC-?/i, '')})</span>
                                      </div>
                                    </div>
                                    <span style={{
                                      fontSize: '0.6rem', fontWeight: '900', padding: '0.2rem 0.55rem', borderRadius: '20px',
                                      background: isTerminada ? '#f0fdf4' : order.status === 'En Confección' ? pal.light : '#f8fafc',
                                      color: isTerminada ? '#059669' : order.status === 'En Confección' ? pal.text : '#64748b',
                                      border: `1px solid ${isTerminada ? '#a7f3d0' : order.status === 'En Confección' ? pal.pill : '#e2e8f0'}`,
                                    }}>{isTerminada ? 'Terminada' : order.status}</span>
                                  </div>

                                  {/* Row 2: métricas */}
                                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.68rem', color: '#475569', fontWeight: '700' }}>
                                    <span>Planeadas: <strong style={{ color: '#1e293b' }}>{planeadas}</strong></span>
                                    <span>Confeccionadas: <strong style={{ color: pal.text }}>{confeccionadas}</strong></span>
                                    <span style={{ marginLeft: 'auto', color: pct >= 100 ? '#059669' : pal.text }}>{pct}%</span>
                                  </div>

                                  {/* Row 3: barra de progreso */}
                                  {planeadas > 0 && (
                                    <div style={{ height: '5px', borderRadius: '99px', background: '#e2e8f0', overflow: 'hidden' }}>
                                      <div style={{
                                        height: '100%',
                                        width: `${Math.min(pct, 100)}%`,
                                        background: pct >= 100
                                          ? 'linear-gradient(90deg, #059669, #10b981)'
                                          : `linear-gradient(90deg, ${pal.from}, ${pal.to})`,
                                        borderRadius: '99px',
                                        transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
                                      }} />
                                    </div>
                                  )}
                                </div>
                              );
                            });
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Premium Redesigned KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
            
            {/* Card 1: Actives */}
            <div className="card" style={{ position: 'relative', overflow: 'hidden', padding: '1.5rem 1.75rem', border: '1px solid #eef2ff', background: 'linear-gradient(to bottom right, #ffffff, #fafaff)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div>
                  <p style={{ fontSize: '0.78rem', fontWeight: '800', color: '#4f46e5', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Órdenes Activas</p>
                  <h3 style={{ fontSize: '2.25rem', fontWeight: '950', margin: '0.35rem 0', color: '#1e1b4b' }}>{loading ? '…' : activeConfeccionesCount}</h3>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0, fontWeight: '600' }}>Lotes asignados en confección</p>
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
                  <h3 style={{ fontSize: '2.25rem', fontWeight: '950', margin: '0.35rem 0', color: '#052e16' }}>{loading ? '…' : completedConfeccionesCount}</h3>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0, fontWeight: '600' }}>Lotes totalmente confeccionados</p>
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
              background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', boxShadow: '0 10px 25px -5px rgba(49,46,129,0.3)',
              display: 'flex', flexDirection: 'column', gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
                <div>
                  <p style={{ fontSize: '0.78rem', fontWeight: '800', color: '#c7d2fe', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Saldo Confeccionado</p>
                  <h3 style={{ fontSize: '2.2rem', fontWeight: '950', margin: '0.2rem 0', color: 'white' }}>
                    {loading ? '…' : totalSewedPayment > 0 ? `$${totalSewedPayment.toLocaleString('es-CO')} COP` : '—'}
                  </h3>
                  <p style={{ fontSize: '0.74rem', color: '#a5b4fc', margin: 0, fontWeight: '600' }}>
                    Autorizado: <strong style={{ color: 'white' }}>{totalAuthorizedPayment > 0 ? `$${totalAuthorizedPayment.toLocaleString('es-CO')} COP` : '— Sin tarifa configurada'}</strong>
                  </p>
                </div>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DollarSign size={20} />
                </div>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#c7d2fe', fontWeight: '600', position: 'relative', zIndex: 2 }}>
                <span>Prendas: {totalSewedUnits} / {totalAuthorizedUnits} uds</span>
                <span>Tarifa Prom.: ${averageRate.toLocaleString('es-CO')} / ud</span>
              </div>
              <div style={{ position: 'absolute', bottom: '-20px', right: '-20px', width: '120px', height: '120px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />
            </div>

          </div>

          {/* Main Layout: 70% Columns & 30% Right Panel */}
          <div style={{ display: 'grid', gridTemplateColumns: '7fr 3fr', gap: '2rem', alignItems: 'start' }}>
            
            {/* Left Content Area */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {/* Active Orders */}
              {(() => {
                const pendingConfecciones: { order: any; workshop: any; planeadas: number; confeccionadas: number; confeccionCode: string }[] = [];
                sewingOrdersList.forEach(so => {
                  const w = finalWorkshopsList.find(workshop => String(workshop.id).toLowerCase().trim() === String(so.workshop_id).toLowerCase().trim());
                  if (!w) return;

                  if (activeWorkshopId !== 'all' && String(w.id) !== String(activeWorkshopId)) return;

                  const plannedQty = so.cantidad_planeada || 0;
                  if (plannedQty <= 0) return;

                  const parentOrder = so.parent_order || {};
                  const parentCuts = parentOrder.cuts || [];
                  const cut = parentCuts.find((c: any) => String(c.product_id) === String(so.product_id));
                  let actualSewedQty = 0;
                  if (cut) {
                    const layersProyec = cut.layers || 1;
                    const layersProduced = cut.layers_produced || 0;
                    const pct = layersProyec > 0 ? layersProduced / layersProyec : 0;
                    actualSewedQty = Math.round(plannedQty * pct);
                  } else {
                    actualSewedQty = so.cantidad_confeccionada || 0;
                  }

                  if (actualSewedQty < plannedQty && so.status === 'En Confección') {
                    pendingConfecciones.push({
                      order: parentOrder,
                      workshop: w,
                      planeadas: plannedQty,
                      confeccionadas: actualSewedQty,
                      confeccionCode: so.confeccion_code
                    });
                  }
                });

                return (
                  <div className="card" style={{ padding: '2rem', borderRadius: '20px', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '900', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        Órdenes Asignadas Activas
                        <span style={{ fontSize: '0.72rem', backgroundColor: '#eef2ff', color: '#4f46e5', padding: '2px 8px', borderRadius: '999px', fontWeight: '800' }}>
                          {pendingConfecciones.length}
                        </span>
                      </h3>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '2.5px solid #f1f5f9', textAlign: 'left', color: '#64748b' }}>
                            {['Orden Confección', 'Taller', 'Cliente', 'Tela', 'Prendas', 'Fecha Asig.', 'Progreso', 'Acción'].map(h => (
                              <th key={h} style={{ padding: '0.85rem 1rem', fontWeight: '800', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {loading ? (
                            <tr><td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Cargando órdenes…</td></tr>
                          ) : pendingConfecciones.length === 0 ? (
                            <tr><td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>No tienes órdenes activas asignadas.</td></tr>
                          ) : pendingConfecciones.map(({ order, workshop, planeadas, confeccionadas, confeccionCode }) => {
                            const progress = planeadas > 0 ? Math.round((confeccionadas / planeadas) * 100) : 0;
                            return (
                              <tr key={`${order.id}-${workshop.id}-${confeccionCode}`} style={{ borderBottom: '1px solid #f8fafc', transition: 'background-color 0.15s' }}>
                                <td style={{ padding: '1rem 1rem', fontWeight: '800', color: '#4f46e5' }}>{confeccionCode}</td>
                                <td style={{ padding: '1rem 1rem', fontWeight: '700', color: '#1e293b' }}>
                                  <span style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', backgroundColor: '#f1f5f9', fontSize: '0.75rem', fontWeight: '800', color: '#475569' }}>
                                    🏭 {workshop.nombre_taller}
                                  </span>
                                </td>
                                <td style={{ padding: '1rem 1rem', fontWeight: '700', color: '#64748b' }}>{order.client_name || '—'}</td>
                                <td style={{ padding: '1rem 1rem', color: '#64748b', fontWeight: '500' }}>{order.fabrics?.nombre_tela || '—'}</td>
                                <td style={{ padding: '1rem 1rem', fontWeight: '800', color: '#0f172a' }}>{confeccionadas} / {planeadas} uds</td>
                                <td style={{ padding: '1rem 1rem', color: '#64748b', fontWeight: '600' }}>{order.created_at ? new Date(order.created_at).toLocaleDateString('es-CO') : '—'}</td>
                                <td style={{ padding: '1rem 1rem', width: '150px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ flex: 1, height: '6px', borderRadius: '999px', backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                                      <div style={{ width: `${Math.min(progress, 100)}%`, height: '100%', borderRadius: '999px', backgroundColor: progress >= 100 ? '#10b981' : 'var(--primary)' }} />
                                    </div>
                                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#475569' }}>{progress}%</span>
                                  </div>
                                </td>
                                <td style={{ padding: '1rem 1rem' }}>
                                  <button 
                                    onClick={() => {
                                      const realSewingOrder = sewingOrdersList.find(so => so.confeccion_code === confeccionCode);
                                      if (realSewingOrder) {
                                        setViewingOrderDetails(realSewingOrder);
                                      }
                                    }} 
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
                );
              })()}

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
                        const itemRate = getRateForOrder(i.order_id);
                        const payment = (i.items_approved || 0) * itemRate;
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
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

          {/* Workshop Order Confección Details Modal (Relación de Despacho Format) */}
          {viewingOrderDetails && (
             <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1500, padding: '2rem' }}>
               <div className="card printable-workshop-order" style={printMode === 'sticker' ? {
                 width: '100%',
                 maxWidth: '650px',
                 maxHeight: '90vh',
                 overflowY: 'auto',
                 padding: '3rem',
                 borderRadius: '16px',
                 backgroundColor: '#f1f5f9',
                 border: '1px solid #cbd5e1',
                 boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
               } : {
                 width: '100%',
                 maxWidth: '850px',
                 maxHeight: '90vh',
                 overflowY: 'auto',
                 padding: '3rem',
                 borderRadius: '16px',
                 backgroundColor: 'white',
                 border: '1px solid #cbd5e1',
                 boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
               }}>
                 
                 {/* Print relation header */}
                 <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2.5px solid #0f172a', paddingBottom: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                     <div style={{ backgroundColor: '#0f172a', padding: '0.5rem', borderRadius: '8px', color: 'white' }}>
                       <Factory size={22} />
                     </div>
                     <div>
                       <h2 style={{ fontSize: '1.1rem', fontWeight: '950', margin: 0, letterSpacing: '-0.02em', textTransform: 'uppercase', color: '#0f172a' }}>
                         Relación de Despacho
                       </h2>
                       <div style={{ display: 'inline-flex', backgroundColor: '#e2e8f0', padding: '0.2rem', borderRadius: '8px', marginTop: '0.25rem' }}>
                         <button
                           onClick={() => setPrintMode('report')}
                           style={{
                             border: 'none',
                             backgroundColor: printMode === 'report' ? 'white' : 'transparent',
                             color: printMode === 'report' ? '#0f172a' : '#475569',
                             padding: '0.25rem 0.6rem',
                             borderRadius: '6px',
                             fontSize: '0.68rem',
                             fontWeight: '850',
                             cursor: 'pointer',
                             boxShadow: printMode === 'report' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                           }}
                         >
                           📄 Reporte
                         </button>
                         <button
                           onClick={() => setPrintMode('sticker')}
                           style={{
                             border: 'none',
                             backgroundColor: printMode === 'sticker' ? 'white' : 'transparent',
                             color: printMode === 'sticker' ? '#0f172a' : '#475569',
                             padding: '0.25rem 0.6rem',
                             borderRadius: '6px',
                             fontSize: '0.68rem',
                             fontWeight: '850',
                             cursor: 'pointer',
                             boxShadow: printMode === 'sticker' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                           }}
                         >
                           🏷️ Sticker 10x10
                         </button>
                       </div>
                     </div>
                   </div>
                   <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                     <div>
                       <p style={{ fontSize: '0.75rem', margin: 0, fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Orden de Confección</p>
                       <p style={{ fontSize: '1.1rem', fontWeight: '950', color: 'var(--primary)', margin: 0 }}>
                         {viewingOrderDetails.confeccion_code}
                       </p>
                     </div>
                     <button
                       className="btn"
                       onClick={() => window.print()}
                       style={{ backgroundColor: '#7c3aed', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}
                     >
                       <Printer size={13} /> Imprimir
                     </button>
                     <button onClick={() => { setViewingOrderDetails(null); setPrintMode('report'); }} style={{ background: '#f1f5f9', border: 'none', color: '#475569', cursor: 'pointer', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
                   </div>
                 </div>
 
                 {printMode === 'sticker' ? (
                   (() => {
                     const parentOrder = viewingOrderDetails.parent_order || {};
                     const assignments = getOrderAssignments(parentOrder);
                     const rowWorkshopsMap = assignments?.rowWorkshops || {};
                     const workshopId = viewingOrderDetails.workshop_id;
                     const currentWs = workshops.find(w => String(w.id) === String(workshopId));

                     const qtyByCutSize: Record<string, number> = {};
                     (parentOrder.cuts || []).forEach((cut: any) => {
                       const targetProdId = cut.product_id;
                       const layersProyec = cut.layers || 1;
                       const layersProduced = cut.layers_produced || 0;
                       (cut.cut_sizes || []).forEach((cs: any) => {
                         const sizeObj = sizesList.find(s => String(s.id) === String(cs.size_id));
                         const sz = sizeObj ? sizeObj.codigo_talla : 'S/T';
                         const cellKey = `${targetProdId}_${sz}`;
                         const assignedWId = rowWorkshopsMap[cellKey];
                         if (!assignedWId || String(assignedWId) !== String(workshopId)) return;
                         let realQty = 0;
                         if (cs.quantity_produced !== undefined && cs.quantity_produced !== null) {
                           realQty = Number(cs.quantity_produced);
                         } else {
                           const proyecQty = Number(cs.quantity) || 0;
                           const ppc = layersProyec > 0 ? proyecQty / layersProyec : 0;
                           realQty = Math.round(ppc * layersProduced);
                         }
                         if (realQty <= 0) return;
                         const key = `${cut.id}_${sz}`;
                         qtyByCutSize[key] = (qtyByCutSize[key] || 0) + realQty;
                       });
                     });

                     const itemsList: any[] = [];
                     const seenKeys = new Set<string>();
                     (parentOrder.cuts || []).forEach((cut: any) => {
                       const targetProdId = cut.product_id;
                       const prodObj = productsList.find(p => String(p.id) === String(targetProdId));
                       const categoryObj = prodObj ? categories.find(c => String(c.id) === String(prodObj.category_id)) : null;
                       const categoryName = categoryObj ? categoryObj.categoria : (prodObj ? (prodObj.categoria || 'Sin Categoría') : 'Sin Categoría');
                       const colorObj = cut ? colorsList.find(c => String(c.id) === String(cut.color_id)) : null;
                       const colorName = colorObj ? colorObj.nombre_color : 'Sin Color';
                       const fabricObj = cut ? fabricsList?.find((f: any) => String(f.id) === String(cut.fabric_id)) : null;
                       const fabricName = fabricObj ? fabricObj.nombre_tela : (parentOrder.fabrics?.nombre_tela || '—');

                       let displayFabricName = fabricName;
                       let displayColorName = colorName;
                       if (fabricName.includes(',')) {
                         const commaIdx = fabricName.indexOf(',');
                         displayFabricName = fabricName.substring(0, commaIdx).trim();
                         const extractedColor = fabricName.substring(commaIdx + 1).trim();
                         if (extractedColor) {
                           displayColorName = extractedColor;
                         }
                       }

                       (cut.cut_sizes || []).forEach((cs: any) => {
                         const sizeObj = sizesList.find(s => String(s.id) === String(cs.size_id));
                         const sizeName = sizeObj ? sizeObj.nombre_talla : '—';
                         const sz = sizeObj ? sizeObj.codigo_talla : 'S/T';
                         const key = `${cut.id}_${sz}`;
                         if (!qtyByCutSize[key] || seenKeys.has(key)) return;
                         seenKeys.add(key);
                         itemsList.push({
                           categoryName,
                           colorName: displayColorName,
                           fabricName: displayFabricName,
                           sizeCode: sizeName,
                           quantity: qtyByCutSize[key]
                         });
                       });
                     });

                     const groupedItems: {
                       colorName: string;
                       categoryName: string;
                       fabricName: string;
                       sizes: { [size: string]: number };
                       totalQuantity: number;
                     }[] = [];

                     itemsList.forEach((item: any) => {
                       const existing = groupedItems.find(g => 
                         g.categoryName.toLowerCase() === item.categoryName.toLowerCase() && 
                         g.colorName.toLowerCase() === item.colorName.toLowerCase() &&
                         g.fabricName.toLowerCase() === item.fabricName.toLowerCase()
                       );
                       if (existing) {
                         existing.sizes[item.sizeCode] = (existing.sizes[item.sizeCode] || 0) + item.quantity;
                         existing.totalQuantity += item.quantity;
                       } else {
                         groupedItems.push({
                           categoryName: item.categoryName,
                           colorName: item.colorName,
                           fabricName: item.fabricName,
                           sizes: { [item.sizeCode]: item.quantity },
                           totalQuantity: item.quantity
                         });
                       }
                     });

                     groupedItems.sort((a, b) => a.categoryName.localeCompare(b.categoryName, 'es'));
                     const totalUnits = groupedItems.reduce((sum, item) => sum + item.totalQuantity, 0);

                     return (
                       <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem', backgroundColor: '#f1f5f9', borderRadius: '12px' }}>
                         <div className="print-stickers-page" style={{
                           width: '100mm',
                           height: '100mm',
                           padding: '8mm',
                           boxSizing: 'border-box',
                           display: 'flex',
                           flexDirection: 'column',
                           justifyContent: 'space-between',
                           border: '2.5px solid #000',
                           backgroundColor: 'white',
                           boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                           color: 'black',
                           fontFamily: 'system-ui, sans-serif'
                         }}>
                           <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                             <div style={{ textAlign: 'center', borderBottom: '2.5px solid #000', paddingBottom: '0.35rem', marginBottom: '0.2rem' }}>
                               <h2 style={{ fontSize: '1.25rem', fontWeight: '950', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cortesbreiner</h2>
                               <p style={{ fontSize: '0.6rem', color: '#333', fontWeight: '750', margin: 0, letterSpacing: '0.05em' }}>DESPACHO DE PRENDAS A SATÉLITE</p>
                             </div>
                             
                             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.72rem' }}>
                               <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                 <span><strong>ORDEN CONFECCIÓN:</strong></span>
                                 <span style={{ fontWeight: '900', color: '#7c3aed' }}>{viewingOrderDetails.confeccion_code}</span>
                               </div>
                               <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                 <span><strong>TALLER SATÉLITE:</strong></span>
                                 <span style={{ fontWeight: '800' }}>{currentWs?.nombre_taller || '—'}</span>
                               </div>
                               <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                 <span><strong>CLIENTE:</strong></span>
                                 <span>{viewingOrderDetails.parent_order?.client_name || '—'}</span>
                               </div>
                               <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                 <span><strong>TELA PRINCIPAL:</strong></span>
                                 <span>{viewingOrderDetails.parent_order?.fabrics?.nombre_tela || '—'}</span>
                               </div>
                               <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                 <span><strong>FECHA PROGRAMADA:</strong></span>
                                 <span><strong>{viewingOrderDetails.parent_order?.created_at ? new Date(viewingOrderDetails.parent_order.created_at).toLocaleDateString('es-CO') : '—'}</strong></span>
                               </div>
                             </div>

                             <div style={{ marginTop: '0.3rem', borderTop: '1.5px dashed #000', paddingTop: '0.3rem' }}>
                               <p style={{ margin: '0 0 0.15rem 0', fontSize: '0.625rem', fontWeight: '800', textTransform: 'uppercase', color: '#444' }}>DETALLE DE PRENDAS:</p>
                               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', fontSize: '0.625rem', maxHeight: '2.5rem', overflow: 'hidden' }}>
                                 {groupedItems.slice(0, 5).map((item, idx) => (
                                   <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                     <span style={{ fontWeight: '600' }}>• {item.categoryName} ({item.colorName})</span>
                                     <strong style={{ fontSize: '0.68rem' }}>{item.totalQuantity} uds</strong>
                                   </div>
                                 ))}
                                 {groupedItems.length > 5 && (
                                   <div style={{ fontSize: '0.55rem', fontStyle: 'italic', textAlign: 'center', color: '#666' }}>+ {groupedItems.length - 5} más categorías/colores...</div>
                                 )}
                                </div>
                             </div>
                           </div>

                           <div style={{ borderTop: '2.5px solid #000', paddingTop: '0.35rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                             <span style={{ fontSize: '0.65rem', fontWeight: '900', textTransform: 'uppercase' }}>Total Unidades:</span>
                             <span style={{ fontSize: '1.15rem', fontWeight: '950', color: '#7c3aed' }}>{totalUnits} uds</span>
                           </div>
                         </div>
                       </div>
                     );
                   })()
                 ) : (
                   <>
                {/* Workshop Info */}
                {(() => {
                  const currentWs = workshops.find(w => String(w.id) === String(viewingOrderDetails.workshop_id));
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.825rem', marginBottom: '2rem' }}>
                      <div>
                        <p style={{ margin: '0 0 0.35rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em' }}>Taller Satélite Destinatario</p>
                        <p style={{ margin: 0, fontWeight: '900', fontSize: '1rem', color: '#0f172a' }}>{currentWs?.nombre_taller || 'Taller Asignado'}</p>
                        <p style={{ margin: '0.2rem 0 0', color: '#334155', fontWeight: '600' }}>Responsable: <span style={{ color: '#0f172a', fontWeight: '800' }}>{currentWs?.responsable || '—'}</span></p>
                        <p style={{ margin: '0.15rem 0 0', color: '#475569' }}>Teléfono: {currentWs?.telefono || '—'}</p>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 0.35rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em' }}>Detalle de Entrega</p>
                        <p style={{ margin: 0, fontWeight: '600' }}>Cliente: <strong style={{ color: '#0f172a', fontWeight: '800' }}>{viewingOrderDetails.parent_order?.client_name || '—'}</strong></p>
                        <p style={{ margin: '0.2rem 0 0', color: '#7c3aed', fontWeight: '750' }}>Fecha Programada: <strong>{viewingOrderDetails.parent_order?.created_at ? new Date(viewingOrderDetails.parent_order.created_at).toLocaleDateString('es-CO') : '—'}</strong></p>
                        <p style={{ margin: '0.15rem 0 0', color: '#475569' }}>Tela Principal: {viewingOrderDetails.parent_order?.fabrics?.nombre_tela || '—'}</p>
                      </div>
                    </div>
                  );
                })()}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  
                  {/* Items Table */}
                  <div>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', margin: '0 0 0.75rem', borderBottom: '1.5px solid #cbd5e1', paddingBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>📋</span> Prendas y Cantidades a Armar
                    </h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1' }}>
                          <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: '800', color: '#475569' }}>Categoría</th>
                          <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: '800', color: '#475569' }}>Color</th>
                          <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: '800', color: '#475569' }}>Tela</th>
                          <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: '800', color: '#475569' }}>Distribución Tallas</th>
                          <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: '900', color: '#0f172a', width: '120px' }}>Cantidad Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const parentOrder = viewingOrderDetails.parent_order || {};
                          const assignments = getOrderAssignments(parentOrder);
                          const rowWorkshopsMap = assignments?.rowWorkshops || {};
                          const workshopId = viewingOrderDetails.workshop_id;

                          const qtyByCutSize: Record<string, number> = {};
                          (parentOrder.cuts || []).forEach((cut: any) => {
                            const targetProdId = cut.product_id;
                            const layersProyec = cut.layers || 1;
                            const layersProduced = cut.layers_produced || 0;
                            (cut.cut_sizes || []).forEach((cs: any) => {
                              const sizeObj = sizesList.find(s => String(s.id) === String(cs.size_id));
                              const sz = sizeObj ? sizeObj.codigo_talla : 'S/T';
                              const cellKey = `${targetProdId}_${sz}`;
                              const assignedWId = rowWorkshopsMap[cellKey];
                              if (!assignedWId || String(assignedWId) !== String(workshopId)) return;
                              let realQty = 0;
                              if (cs.quantity_produced !== undefined && cs.quantity_produced !== null) {
                                realQty = Number(cs.quantity_produced);
                              } else {
                                const proyecQty = Number(cs.quantity) || 0;
                                const ppc = layersProyec > 0 ? proyecQty / layersProyec : 0;
                                realQty = Math.round(ppc * layersProduced);
                              }
                              if (realQty <= 0) return;
                              const key = `${cut.id}_${sz}`;
                              qtyByCutSize[key] = (qtyByCutSize[key] || 0) + realQty;
                            });
                          });

                          const itemsList: any[] = [];
                          const seenKeys = new Set<string>();
                          (parentOrder.cuts || []).forEach((cut: any) => {
                            const targetProdId = cut.product_id;
                            const prodObj = productsList.find(p => String(p.id) === String(targetProdId));
                            const categoryObj = prodObj ? categories.find(c => String(c.id) === String(prodObj.category_id)) : null;
                            const categoryName = categoryObj ? categoryObj.categoria : (prodObj ? (prodObj.categoria || 'Sin Categoría') : 'Sin Categoría');
                            const colorObj = cut ? colorsList.find(c => String(c.id) === String(cut.color_id)) : null;
                            const colorName = colorObj ? colorObj.nombre_color : 'Sin Color';
                            const fabricObj = cut ? fabricsList?.find((f: any) => String(f.id) === String(cut.fabric_id)) : null;
                            const fabricName = fabricObj ? fabricObj.nombre_tela : (parentOrder.fabrics?.nombre_tela || '—');

                            let displayFabricName = fabricName;
                            let displayColorName = colorName;
                            if (fabricName.includes(',')) {
                              const commaIdx = fabricName.indexOf(',');
                              displayFabricName = fabricName.substring(0, commaIdx).trim();
                              const extractedColor = fabricName.substring(commaIdx + 1).trim();
                              if (extractedColor) {
                                displayColorName = extractedColor;
                              }
                            }

                            (cut.cut_sizes || []).forEach((cs: any) => {
                              const sizeObj = sizesList.find(s => String(s.id) === String(cs.size_id));
                              const sizeName = sizeObj ? sizeObj.nombre_talla : '—';
                              const sz = sizeObj ? sizeObj.codigo_talla : 'S/T';
                              const key = `${cut.id}_${sz}`;
                              if (!qtyByCutSize[key] || seenKeys.has(key)) return;
                              seenKeys.add(key);
                              itemsList.push({
                                categoryName,
                                colorName: displayColorName,
                                fabricName: displayFabricName,
                                sizeCode: sizeName,
                                quantity: qtyByCutSize[key]
                              });
                            });
                          });

                          if (itemsList.length === 0) {
                            return <tr><td colSpan={5} style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>No se relacionan prendas en este lote.</td></tr>;
                          }

                          const groupedItems: {
                            colorName: string;
                            categoryName: string;
                            fabricName: string;
                            sizes: { [size: string]: number };
                            totalQuantity: number;
                          }[] = [];

                          itemsList.forEach((item: any) => {
                            const existing = groupedItems.find(g => 
                              g.categoryName.toLowerCase() === item.categoryName.toLowerCase() && 
                              g.colorName.toLowerCase() === item.colorName.toLowerCase() &&
                              g.fabricName.toLowerCase() === item.fabricName.toLowerCase()
                            );
                            if (existing) {
                              existing.sizes[item.sizeCode] = (existing.sizes[item.sizeCode] || 0) + item.quantity;
                              existing.totalQuantity += item.quantity;
                            } else {
                              groupedItems.push({
                                categoryName: item.categoryName,
                                colorName: item.colorName,
                                fabricName: item.fabricName,
                                sizes: { [item.sizeCode]: item.quantity },
                                totalQuantity: item.quantity
                              });
                            }
                          });

                          groupedItems.sort((a, b) => a.categoryName.localeCompare(b.categoryName, 'es'));

                          return (
                            <>
                              {groupedItems.map((item, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#0f172a' }}>{item.categoryName}</td>
                                  <td style={{ padding: '0.6rem 0.75rem', color: '#1e293b', fontWeight: '600' }}>{item.colorName}</td>
                                  <td style={{ padding: '0.6rem 0.75rem', color: '#475569' }}>{item.fabricName}</td>
                                  <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: '800', color: '#7c3aed' }}>
                                    {Object.entries(item.sizes).map(([sz, qty]) => `${sz}(${qty})`).join(' · ')}
                                  </td>
                                  <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>{item.totalQuantity} uds</td>
                                </tr>
                              ))}
                              <tr style={{ backgroundColor: '#f8fafc', fontWeight: '900', borderTop: '1.5px solid #cbd5e1' }}>
                                <td colSpan={4} style={{ padding: '0.75rem 0.75rem', textTransform: 'uppercase', color: '#334155', fontSize: '0.7rem' }}>Total Unidades Despachadas</td>
                                <td style={{ padding: '0.75rem 0.75rem', textAlign: 'right', color: '#7c3aed', fontSize: '0.9rem', fontWeight: '950' }}>
                                  {groupedItems.reduce((sum, item) => sum + item.totalQuantity, 0)} uds
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
                      const itemsList: any[] = [];
                      const assignments = getOrderAssignments(viewingOrderDetails);
                      const workshopId = viewingOrderDetails.workshop_id;
                      const targetWorkshopId = workshopId || userWorkshop?.id;

                      viewingOrderDetails.cuts?.forEach((cut: any) => {
                        const prod = productsList?.find(p => String(p.id) === String(cut.product_id));
                        const prodId = prod ? String(prod.id) : 'sin_prod';

                        cut.cut_sizes?.forEach((szQty: any) => {
                          const sizeObj = sizesList.find(s => String(s.id) === String(szQty.size_id));
                          const sz = sizeObj ? sizeObj.codigo_talla : 'S/T';

                          const cellKey = `${prodId}_${sz}`;
                          const assignedTo = assignments?.rowWorkshops?.[cellKey];

                          if (targetWorkshopId && assignedTo && String(assignedTo).toLowerCase().trim() === String(targetWorkshopId).toLowerCase().trim()) {
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
                          }
                        });
                      });

                      itemsList.forEach((item: any) => {
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
                 </>
                )}

                <div className="no-print" style={{ display: 'flex', gap: '1rem', borderTop: '1px solid #f1f5f9', marginTop: '2.5rem', paddingTop: '1.5rem' }}>
                  <button type="button" className="btn btn-secondary" style={{ flex: 1, padding: '0.85rem', fontWeight: '800', borderRadius: '12px', backgroundColor: '#1e293b', color: 'white', border: 'none', cursor: 'pointer' }} onClick={() => { setViewingOrderDetails(null); setPrintMode('report'); }}>Cerrar Orden</button>
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
                      <span style={{ color: '#0f172a' }}>{"4.9 / 5.0"}</span>
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
                    const itemRate = getRateForOrder(i.order_id);
                    const payment = (i.items_approved || 0) * itemRate;
                    return (
                      <tr key={i.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '1rem', fontWeight: '800', color: '#4f46e5' }}>{orderCode}</td>
                        <td style={{ padding: '1rem', color: '#475569' }}>{i.created_at ? new Date(i.created_at).toLocaleDateString('es-CO') : '—'}</td>
                        <td style={{ padding: '1rem', fontWeight: '700' }}>{i.items_inspected} uds</td>
                        <td style={{ padding: '1rem', fontWeight: '700', color: '#16a34a' }}>{i.items_approved} uds</td>
                        <td style={{ padding: '1rem', fontWeight: '700', color: '#ef4444' }}>{i.items_rejected} uds</td>
                        <td style={{ padding: '1rem', fontWeight: '600' }}>${itemRate.toLocaleString('es-CO')} COP</td>
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

  const filteredCompOrders = orders.filter(o => {
    if (compProductId !== 'all') {
      const hasProduct = o.cuts?.some(c => String(c.product_id) === compProductId);
      if (!hasProduct) return false;
    }
    if (compStartDate) {
      if (new Date(o.created_at) < new Date(compStartDate)) return false;
    }
    if (compEndDate) {
      const end = new Date(compEndDate);
      end.setHours(23, 59, 59, 999);
      if (new Date(o.created_at) > end) return false;
    }
    return true;
  });

  const productData: Record<string, { name: string; planeado: number; real: number }> = {};
  filteredCompOrders.forEach(o => {
    (o.cuts || []).forEach(cut => {
      const prod = productsList.find(p => String(p.id) === String(cut.product_id));
      const prodName = prod ? prod.nombre_producto : 'Referencia';
      if (!productData[prodName]) {
        productData[prodName] = { name: prodName, planeado: 0, real: 0 };
      }
      
      const planned = (cut.cut_sizes || []).reduce((s: number, cs: any) => s + (Number(cs.quantity) || 0), 0);
      let real = 0;
      if (o.status === 'Cortado') {
        real = planned;
      } else if (o.status === 'En Corte') {
        const layersProyec = cut.layers || 1;
        const layersProduced = cut.layers_produced || 0;
        real = Math.round(planned * (layersProyec > 0 ? layersProduced / layersProyec : 0));
      }
      
      productData[prodName].planeado += planned;
      productData[prodName].real += real;
    });
  });
  const comparisonChartData = Object.values(productData).slice(0, 8);

  const dateData: Record<string, { date: string; planeado: number; real: number }> = {};
  filteredCompOrders.forEach(o => {
    const dateStr = o.created_at ? new Date(o.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' }) : '—';
    if (!dateData[dateStr]) {
      dateData[dateStr] = { date: dateStr, planeado: 0, real: 0 };
    }
    
    let planned = 0;
    let real = 0;
    (o.cuts || []).forEach(cut => {
      const pl = (cut.cut_sizes || []).reduce((s: number, cs: any) => s + (Number(cs.quantity) || 0), 0);
      planned += pl;
      if (o.status === 'Cortado') {
        real += pl;
      } else if (o.status === 'En Corte') {
        const layersProyec = cut.layers || 1;
        const layersProduced = cut.layers_produced || 0;
        real += Math.round(pl * (layersProyec > 0 ? layersProduced / layersProyec : 0));
      }
    });
    
    dateData[dateStr].planeado += planned;
    dateData[dateStr].real += real;
  });
  const lineChartData = Object.values(dateData).slice(-10);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '4rem' }}>

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

      {/* Selector de Pestañas Premium */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid var(--border)', paddingBottom: '0.5rem', marginTop: '-0.5rem' }}>
        <button
          onClick={() => setAdminTab('overview')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.65rem 1.25rem', borderRadius: '10px',
            border: 'none', cursor: 'pointer',
            fontSize: '0.85rem', fontWeight: '800',
            backgroundColor: adminTab === 'overview' ? 'var(--primary)' : 'transparent',
            color: adminTab === 'overview' ? 'white' : 'var(--text-muted)',
            transition: 'all 0.15s ease',
            boxShadow: adminTab === 'overview' ? '0 2px 8px rgba(99,102,241,0.25)' : 'none',
          }}
        >
          <BarChart2 size={16} /> Vista General
        </button>
        <button
          onClick={() => setAdminTab('comparison')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.65rem 1.25rem', borderRadius: '10px',
            border: 'none', cursor: 'pointer',
            fontSize: '0.85rem', fontWeight: '800',
            backgroundColor: adminTab === 'comparison' ? 'var(--primary)' : 'transparent',
            color: adminTab === 'comparison' ? 'white' : 'var(--text-muted)',
            transition: 'all 0.15s ease',
            boxShadow: adminTab === 'comparison' ? '0 2px 8px rgba(99,102,241,0.25)' : 'none',
          }}
        >
          <TrendingUp size={16} /> Planeado vs Real (Cortes)
        </button>
        <button
          onClick={() => setAdminTab('workshop_consolidation')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.65rem 1.25rem', borderRadius: '10px',
            border: 'none', cursor: 'pointer',
            fontSize: '0.85rem', fontWeight: '800',
            backgroundColor: adminTab === 'workshop_consolidation' ? 'var(--primary)' : 'transparent',
            color: adminTab === 'workshop_consolidation' ? 'white' : 'var(--text-muted)',
            transition: 'all 0.15s ease',
            boxShadow: adminTab === 'workshop_consolidation' ? '0 2px 8px rgba(99,102,241,0.25)' : 'none',
          }}
        >
          <Factory size={16} /> Consolidado de Talleres
        </button>
      </div>

      {adminTab === 'overview' && (
        <>
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
        </>
      )}

      {adminTab === 'comparison' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Filtros de comparación */}
          <div className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'flex-end', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1, minWidth: '200px' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Filtrar por Prenda / Referencia</span>
              <select
                value={compProductId}
                onChange={e => setCompProductId(e.target.value)}
                style={{ padding: '0.6rem 0.85rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '750', color: '#0f172a', backgroundColor: 'white' }}
              >
                <option value="all">Todas las referencias</option>
                {productsList.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre_producto}</option>
                ))}
              </select>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '160px' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Fecha Inicio</span>
              <input
                type="date"
                value={compStartDate}
                onChange={e => setCompStartDate(e.target.value)}
                style={{ padding: '0.55rem 0.85rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '700', color: '#0f172a', width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '160px' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Fecha Fin</span>
              <input
                type="date"
                value={compEndDate}
                onChange={e => setCompEndDate(e.target.value)}
                style={{ padding: '0.55rem 0.85rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '700', color: '#0f172a', width: '100%' }}
              />
            </div>

            <button
              onClick={() => {
                setCompProductId('all');
                setCompStartDate('');
                setCompEndDate('');
              }}
              style={{
                padding: '0.65rem 1.25rem', borderRadius: '10px',
                border: '1.5px solid #cbd5e1', cursor: 'pointer',
                fontSize: '0.85rem', fontWeight: '800',
                backgroundColor: 'white', color: '#475569',
                transition: 'all 0.15s ease'
              }}
            >
              Limpiar Filtros
            </button>
          </div>

          {/* Comparativa KPI Cards */}
          {(() => {
            let totalPl = 0;
            let totalRl = 0;
            let totalKilosPl = 0;
            let totalKilosRl = 0;
            let totalMetrosPl = 0;
            let totalMetrosRl = 0;

            // Listado plano de filas para la tabla
            const allRows: any[] = [];

            // Top acumuladores
            const categoryQtyMap: Record<string, number> = {};
            const productQtyMap: Record<string, number> = {};

            filteredCompOrders.forEach(order => {
              (order.cuts || []).forEach(cut => {
                const prod = productsList.find(p => String(p.id) === String(cut.product_id));
                const prodName = prod ? prod.nombre_producto : 'Referencia';
                const categoryObj = prod ? categories.find(c => String(c.id) === String(prod.category_id)) : null;
                const categoryName = categoryObj ? (categoryObj.categoria || categoryObj.name || 'Sin Categoría') : 'Sin Categoría';
                const fabricName = (order.fabrics as any)?.nombre_tela || 'Tela Externa';

                const planned = (cut.cut_sizes || []).reduce((s: number, cs: any) => s + (Number(cs.quantity) || 0), 0);
                
                const layersProyec = cut.layers || 1;
                const layersProduced = cut.layers_produced > 0 ? cut.layers_produced : (order.status === 'Cortado' ? layersProyec : 0);
                const real = Math.round(planned * (layersProyec > 0 ? layersProduced / layersProyec : 0));

                const kPl = Number(cut.consumo_estimado) || Number(cut.kilos) || 0;
                const kRl = Number(cut.kilos) || 0;

                const mPl = Number(cut.stroke_length || 0) * Number(cut.layers || 0);
                const mRl = Number(cut.stroke_length || 0) * layersProduced;

                totalPl += planned;
                totalRl += real;
                totalKilosPl += kPl;
                totalKilosRl += kRl;
                totalMetrosPl += mPl;
                totalMetrosRl += mRl;

                // Acumular Tops
                categoryQtyMap[categoryName] = (categoryQtyMap[categoryName] || 0) + real;
                productQtyMap[prodName] = (productQtyMap[prodName] || 0) + real;

                allRows.push({
                  code: `OC-${order.internal_code}`,
                  productName: prodName,
                  fabricName: fabricName,
                  planned,
                  real,
                  kPl,
                  kRl,
                  mPl,
                  mRl,
                  efficiency: planned > 0 ? (real / planned) * 100 : 0,
                  orderId: order.id,
                  cutId: cut.id
                });
              });
            });

            // Entregas reales del taller aprobadas en calidad en ese período
            const matchingWorkshops = activeWorkshopId === 'all' 
              ? workshops 
              : workshops.filter(w => String(w.id) === String(activeWorkshopId));
            
            let totalPrendasProyectadas = 0;
            let totalPrendasEntregadas = 0;

            matchingWorkshops.forEach(currentWs => {
              const wsSewingOrders = sewingOrdersList.filter(so => 
                String(so.workshop_id).toLowerCase().trim() === String(currentWs.id).toLowerCase().trim()
              );
              wsSewingOrders.forEach(so => {
                totalPrendasProyectadas += (so.cantidad_planeada || 0);
              });

              const wsInsps = inspections.filter(i => 
                (i.workshop_name || '').toLowerCase().trim() === (currentWs.nombre_taller || '').toLowerCase().trim()
              );
              wsInsps.forEach(i => {
                totalPrendasEntregadas += (i.items_approved || 0);
              });
            });

            // Paginación
            const itemsPerPage = 25;
            const totalPages = Math.ceil(allRows.length / itemsPerPage) || 1;
            const currentPage = Math.min(compPage, totalPages);
            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const paginatedRows = allRows.slice(startIndex, endIndex);

            // Tops ordenados
            const topCategories = Object.entries(categoryQtyMap)
              .map(([name, val]) => ({ name, value: val }))
              .sort((a, b) => b.value - a.value)
              .slice(0, 10);

            const topProducts = Object.entries(productQtyMap)
              .map(([name, val]) => ({ name, value: val }))
              .sort((a, b) => b.value - a.value)
              .slice(0, 10);

            return (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
                  {/* Card 1: Unidades de Corte */}
                  <div className="card" style={{ padding: '1.5rem', borderLeft: '5px solid #6366f1', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prendas Planeadas vs Cortadas</span>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: '950', margin: '0.2rem 0', color: '#1e293b' }}>
                      {totalRl.toLocaleString('es-CO')} <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '600' }}>/ {totalPl.toLocaleString('es-CO')} uds</span>
                    </h3>
                    <p style={{ fontSize: '0.74rem', color: totalRl >= totalPl ? '#10b981' : '#ef4444', margin: 0, fontWeight: '800' }}>
                      Eficiencia Corte: {totalPl > 0 ? (totalRl / totalPl * 100).toFixed(1) : '0'}%
                    </p>
                  </div>

                  {/* Card 2: Confeccionadas vs Proyectadas */}
                  <div className="card" style={{ padding: '1.5rem', borderLeft: '5px solid #f59e0b', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Proyectado vs Entregado Satélite</span>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: '950', margin: '0.2rem 0', color: '#1e293b' }}>
                      {totalPrendasEntregadas.toLocaleString('es-CO')} <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '600' }}>/ {totalPrendasProyectadas.toLocaleString('es-CO')} uds</span>
                    </h3>
                    <p style={{ fontSize: '0.74rem', color: '#f59e0b', margin: 0, fontWeight: '800' }}>
                      Entregas Aprobadas: {totalPrendasProyectadas > 0 ? (totalPrendasEntregadas / totalPrendasProyectadas * 100).toFixed(1) : '0'}%
                    </p>
                  </div>

                  {/* Card 3: Pesos de Tela (Kilos) */}
                  <div className="card" style={{ padding: '1.5rem', borderLeft: '5px solid #10b981', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kilos Programados vs Reales</span>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: '950', margin: '0.2rem 0', color: '#1e293b' }}>
                      {totalKilosRl.toFixed(1)} <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '600' }}>/ {totalKilosPl.toFixed(1)} kg</span>
                    </h3>
                    <p style={{ fontSize: '0.74rem', color: totalKilosRl > totalKilosPl ? '#ef4444' : '#10b981', margin: 0, fontWeight: '800' }}>
                      Desviación: {(totalKilosRl - totalKilosPl).toFixed(1)} kg ({totalKilosPl > 0 ? (totalKilosRl / totalKilosPl * 100).toFixed(1) : '0'}%)
                    </p>
                  </div>

                  {/* Card 4: Metros de Tela */}
                  <div className="card" style={{ padding: '1.5rem', borderLeft: '5px solid #06b6d4', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Metros Planificados vs Cortados</span>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: '950', margin: '0.2rem 0', color: '#1e293b' }}>
                      {totalMetrosRl.toFixed(1)} <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '600' }}>/ {totalMetrosPl.toFixed(1)} m</span>
                    </h3>
                    <p style={{ fontSize: '0.74rem', color: totalMetrosRl > totalMetrosPl ? '#ef4444' : '#10b981', margin: 0, fontWeight: '800' }}>
                      Diferencia Metraje: {(totalMetrosRl - totalMetrosPl).toFixed(1)} m
                    </p>
                  </div>
                </div>

                {/* Gráficas Comparativas */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginTop: '0.5rem' }}>
                  {/* Gráfica de barras de Referencias */}
                  <div className="card" style={{ borderRadius: '18px', padding: '1.5rem' }}>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <h3 style={{ margin: 0 }}>Rendimiento de Prendas por Referencia</h3>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>Prendas planeadas frente a prendas reales cortadas</p>
                    </div>
                    <div style={{ height: '280px', width: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={comparisonChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                          <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.08)' }} />
                          <Bar dataKey="planeado" fill="#818cf8" radius={[4, 4, 0, 0]} name="Planeado" />
                          <Bar dataKey="real" fill="#34d399" radius={[4, 4, 0, 0]} name="Ejecutado" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Gráfica de líneas de Cumplimiento */}
                  <div className="card" style={{ borderRadius: '18px', padding: '1.5rem' }}>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <h3 style={{ margin: 0 }}>Cumplimiento en el Tiempo</h3>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>Evolución de planeación vs ejecución real de cortes</p>
                    </div>
                    <div style={{ height: '280px', width: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={lineChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                          <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.08)' }} />
                          <Line type="monotone" dataKey="planeado" stroke="#818cf8" strokeWidth={3} dot={{ r: 4 }} name="Planeado" />
                          <Line type="monotone" dataKey="real" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} name="Ejecutado" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Sección de Tops 10 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
                  {/* Top 10 Categorías de Producto */}
                  <div className="card" style={{ borderRadius: '18px', padding: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '0.95rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.1rem' }}>🏷️</span> Top 10 Categorías Producidas
                      <span style={{ fontSize: '0.65rem', fontWeight: '700', color: '#7c3aed', backgroundColor: '#ede9fe', padding: '2px 8px', borderRadius: '20px', marginLeft: '0.25rem' }}>uds reales</span>
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {topCategories.length === 0 ? (
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem' }}>Sin datos de categorías.</p>
                      ) : topCategories.map((item, idx) => {
                        const catColors = ['#6366f1','#8b5cf6','#a78bfa','#7c3aed','#4f46e5','#6d28d9','#818cf8','#7e22ce','#5b21b6','#4338ca'];
                        const barColor = catColors[idx % catColors.length];
                        const maxVal = topCategories[0].value;
                        return (
                          <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: '700' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ width: '18px', height: '18px', borderRadius: '4px', backgroundColor: barColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: 'white', fontWeight: '900', flexShrink: 0 }}>{idx + 1}</span>
                                <span style={{ color: '#1e293b', fontWeight: '800' }}>{item.name}</span>
                              </div>
                              <span style={{ color: barColor, fontWeight: '900' }}>{item.value.toLocaleString('es-CO')} uds</span>
                            </div>
                            <div style={{ height: '8px', borderRadius: '4px', backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
                              <div style={{ width: `${maxVal > 0 ? (item.value / maxVal * 100) : 0}%`, height: '100%', background: `linear-gradient(90deg, ${barColor}, ${barColor}99)`, borderRadius: '4px', transition: 'width 0.4s ease' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Top 10 Productos Producidos */}
                  <div className="card" style={{ borderRadius: '18px', padding: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: '900' }}>⭐ Top 10 de Productos Producidos (uds reales)</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {topProducts.length === 0 ? (
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem' }}>Sin datos de productos.</p>
                      ) : topProducts.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: '700' }}>
                            <span style={{ color: '#475569' }}>{idx + 1}. {item.name}</span>
                            <span style={{ color: '#1e293b', fontWeight: '800' }}>{item.value.toLocaleString('es-CO')} uds</span>
                          </div>
                          <div style={{ height: '8px', borderRadius: '4px', backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
                            <div style={{ width: `${topProducts[0].value > 0 ? (item.value / topProducts[0].value * 100) : 0}%`, height: '100%', backgroundColor: '#10b981', borderRadius: '4px' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Tabla de Detalle Comparativo con Paginación */}
                <div className="card" style={{ padding: 0, borderRadius: '18px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.01)' }}>
                  <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '900', color: '#0f172a' }}>Listado Comparativo de Lotes de Corte</h3>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700' }}>Total: {allRows.length} registros</span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                          <th style={{ padding: '0.85rem 1.25rem', textAlign: 'left', fontWeight: '850', color: '#475569' }}>Código</th>
                          <th style={{ padding: '0.85rem 1.25rem', textAlign: 'left', fontWeight: '850', color: '#475569' }}>Referencia</th>
                          <th style={{ padding: '0.85rem 1.25rem', textAlign: 'left', fontWeight: '850', color: '#475569' }}>Tela</th>
                          <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right', fontWeight: '850', color: '#475569' }}>Prendas (Pl vs Rl)</th>
                          <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right', fontWeight: '850', color: '#475569' }}>Kilos (Pl vs Rl)</th>
                          <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right', fontWeight: '850', color: '#475569' }}>Metros (Pl vs Rl)</th>
                          <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right', fontWeight: '850', color: '#475569' }}>Desviación</th>
                          <th style={{ padding: '0.85rem 1.25rem', textAlign: 'center', fontWeight: '850', color: '#475569' }}>Eficiencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedRows.length === 0 ? (
                          <tr><td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>No hay datos que coincidan con los filtros.</td></tr>
                        ) : paginatedRows.map((row, idx) => {
                          const diffQtyVal = row.real - row.planned;
                          return (
                            <tr key={`${row.cutId}-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '0.85rem 1.25rem', fontWeight: '900', color: '#4f46e5' }}>{row.code}</td>
                              <td style={{ padding: '0.85rem 1.25rem', fontWeight: '700', color: '#1e293b' }}>{row.productName}</td>
                              <td style={{ padding: '0.85rem 1.25rem', color: '#475569', fontWeight: '600' }}>{row.fabricName}</td>
                              <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', fontWeight: '700' }}>
                                {row.real.toLocaleString('es-CO')} <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>/ {row.planned.toLocaleString('es-CO')}</span>
                              </td>
                              <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', fontWeight: '700' }}>
                                {row.kRl.toFixed(1)} <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>/ {row.kPl.toFixed(1)} kg</span>
                              </td>
                              <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', fontWeight: '700' }}>
                                {row.mRl.toFixed(1)} <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>/ {row.mPl.toFixed(1)} m</span>
                              </td>
                              <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', fontWeight: '800', color: diffQtyVal < 0 ? '#ef4444' : '#10b981' }}>
                                {diffQtyVal >= 0 ? `+${diffQtyVal}` : diffQtyVal} uds
                              </td>
                              <td style={{ padding: '0.85rem 1.25rem', textAlign: 'center' }}>
                                <span style={{
                                  fontSize: '0.72rem', padding: '0.2rem 0.55rem', borderRadius: '6px', fontWeight: '800',
                                  backgroundColor: row.efficiency >= 100 ? '#ecfdf5' : '#fff1f2',
                                  color: row.efficiency >= 100 ? '#15803d' : '#9f1239'
                                }}>
                                  {row.efficiency.toFixed(0)}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Paginador */}
                  {totalPages > 1 && (
                    <div style={{ padding: '1rem 1.5rem', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button
                        disabled={currentPage === 1}
                        onClick={() => setCompPage(p => Math.max(1, p - 1))}
                        style={{
                          padding: '0.45rem 1rem', borderRadius: '8px', border: '1.5px solid #cbd5e1',
                          backgroundColor: currentPage === 1 ? '#f1f5f9' : 'white',
                          color: currentPage === 1 ? '#94a3b8' : '#475569',
                          fontWeight: '800', cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                          fontSize: '0.75rem'
                        }}
                      >
                        Anterior
                      </button>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '750' }}>
                        Página {currentPage} de {totalPages}
                      </span>
                      <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCompPage(p => Math.min(totalPages, p + 1))}
                        style={{
                          padding: '0.45rem 1rem', borderRadius: '8px', border: '1.5px solid #cbd5e1',
                          backgroundColor: currentPage === totalPages ? '#f1f5f9' : 'white',
                          color: currentPage === totalPages ? '#94a3b8' : '#475569',
                          fontWeight: '800', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                          fontSize: '0.75rem'
                        }}
                      >
                        Siguiente
                      </button>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {adminTab === 'workshop_consolidation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {(() => {
            const baseSewingGlobal = baseCosts.find(c => c.concepto?.toLowerCase() === 'costura')?.valor || 2500;
            
            const rows = sewingOrdersList.map(so => {
              const ws = workshops.find(w => String(w.id) === String(so.workshop_id));
              const wsName = ws ? ws.nombre_taller : 'Taller Desconocido';

              // Parent order details
              const pOrder = so.parent_order;
              const parentCode = pOrder ? (pOrder.internal_code || `OC-${pOrder.consecutive}`) : '—';

              // Rate calculation
              const prod = so.products || productsList.find(p => String(p.id) === String(so.product_id));
              const categoryObj = prod ? categories.find(c => String(c.id) === String(prod.category_id)) : null;
              
              // 1. Tarifa Normal (Taller + Categoría o en su defecto base_rate de categoría, o base global)
              let normalRate = categoryObj?.base_rate || baseSewingGlobal;
              if (categoryObj && so.workshop_id) {
                const rateObj = workshopRates.find(r => 
                  String(r.workshop_id).toLowerCase().trim() === String(so.workshop_id).toLowerCase().trim() && 
                  String(r.category_id).toLowerCase().trim() === String(categoryObj.id).toLowerCase().trim()
                );
                if (rateObj && Number(rateObj.rate) > 0) {
                  normalRate = Number(rateObj.rate);
                }
              }

              // 2. Tarifa Especial (Si so.tarifa_especial es true o tiene valor guardado superior a 0)
              let specialRate = null;
              if (so.workshop_id && so.product_id) {
                // Intento 1: Buscar por product_id exacto
                const specCostObj = specialCosts.find(sc => 
                  String(sc.workshop_id).toLowerCase() === String(so.workshop_id).toLowerCase() && 
                  String(sc.product_id).toLowerCase() === String(so.product_id).toLowerCase()
                );
                if (specCostObj && Number(specCostObj.special_rate) > 0) {
                  specialRate = Number(specCostObj.special_rate);
                } else if (categoryObj) {
                  // Intento 2: Fallback por cualquier producto de la misma categoría
                  const categoryProducts = productsList.filter(p => String(p.category_id) === String(categoryObj.id));
                  const catSpecCostObj = specialCosts.find(sc => 
                    String(sc.workshop_id).toLowerCase() === String(so.workshop_id).toLowerCase() && 
                    categoryProducts.some(p => String(p.id).toLowerCase() === String(sc.product_id).toLowerCase())
                  );
                  if (catSpecCostObj && Number(catSpecCostObj.special_rate) > 0) {
                    specialRate = Number(catSpecCostObj.special_rate);
                  }
                }
              }

              // Si so.tarifa_especial tiene un valor o está activo
              const isSpecialEnabled = so.tarifa_especial !== null && so.tarifa_especial !== undefined && (so.tarifa_especial === true || Number(so.tarifa_especial) > 0);
              let finalRate = normalRate;
              if (isSpecialEnabled) {
                // Priorizar tarifa especial en tabla workshop_special_costs, o el valor explícito en so.tarifa_especial si es numérico
                if (specialRate !== null) {
                  finalRate = specialRate;
                } else if (typeof so.tarifa_especial === 'number' && so.tarifa_especial > 0) {
                  finalRate = so.tarifa_especial;
                }
              }

              // Quantities & Empaque
              const plannedQty = so.cantidad_planeada || 0;
              const hasEmpaque = !!so.empaque; // Flag empaque de la orden de confección
              const rateEmpaque = ws ? Number(ws.desc_empaque ?? 0) : 0;
              
              // Valor Estimado incluye empaque si está habilitado
              const estimatedValue = (plannedQty * finalRate) + (hasEmpaque ? plannedQty * rateEmpaque : 0);

              // Quality inspection link
              const orderInspections = inspections.filter(i => {
                if (i.sewing_order_id) {
                  return String(i.sewing_order_id) === String(so.id);
                }
                return String(i.order_id) === String(so.parent_order_id) && 
                       (i.workshop_name || '').toLowerCase().trim() === (ws?.nombre_taller || '').toLowerCase().trim();
              });

              const approvedQty = orderInspections.reduce((sum, i) => sum + (Number(i.items_approved) || 0), 0);
              const rejectedQty = orderInspections.reduce((sum, i) => sum + (Number(i.items_rejected) || 0), 0);
              const realValueApproved = orderInspections.reduce((sum, i) => sum + (Number(i.valor_pagar) || 0), 0);
              const hasInspections = orderInspections.length > 0;

              // Fabric invoices relation
              const cuts = pOrder?.cuts || [];
              const fabricInvoices = cuts.map((cut: any) => {
                const fab = fabricsList.find(f => String(f.id) === String(cut.fabric_id));
                return fab?.factura_relacionada;
              }).filter(Boolean) as string[];
              const uniqueInvoices = Array.from(new Set(fabricInvoices));

              return {
                id: so.id,
                sewingOrderCode: so.confeccion_code || '—',
                parentCode,
                parentOrderId: so.parent_order_id,
                workshopId: so.workshop_id,
                workshopName: wsName,
                productName: prod?.nombre_producto || 'Referencia Desconocida',
                categoryName: categoryObj?.categoria || 'Sin Categoría',
                plannedQty,
                approvedQty,
                rejectedQty,
                rate: finalRate,
                estimatedValue,
                realValueApproved,
                hasInspections,
                fabricInvoices: uniqueInvoices,
                status: so.status || 'Pendiente',
                isSpecialEnabled,
                hasEmpaque,
                rateEmpaque,
                created_at: so.created_at
              };
            });

            // Filter logic
            const filtered = rows.filter(r => {
              if (consolidationWorkshopId !== 'all' && String(r.workshopId) !== String(consolidationWorkshopId)) return false;
              if (consolidationStatus !== 'all' && String(r.status) !== String(consolidationStatus)) return false;

              // Date filter
              if (consolidationStartDate) {
                const start = new Date(consolidationStartDate);
                const orderDate = new Date(r.created_at);
                if (orderDate < start) return false;
              }
              if (consolidationEndDate) {
                const end = new Date(consolidationEndDate);
                end.setHours(23, 59, 59, 999);
                const orderDate = new Date(r.created_at);
                if (orderDate > end) return false;
              }

              // Search text
              if (consolidationSearch) {
                const query = consolidationSearch.toLowerCase().trim();
                const matchCode = r.sewingOrderCode.toLowerCase().includes(query);
                const matchParent = r.parentCode.toLowerCase().includes(query);
                const matchProduct = r.productName.toLowerCase().includes(query);
                const matchInvoice = r.fabricInvoices.some((inv: string) => inv.toLowerCase().includes(query));
                if (!matchCode && !matchParent && !matchProduct && !matchInvoice) return false;
              }

              return true;
            });

            // Sorting logic
            const sorted = [...filtered].sort((a, b) => {
              let valA = a[consolidationSortField as keyof typeof a];
              let valB = b[consolidationSortField as keyof typeof b];

              if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = (valB as string || '').toLowerCase();
              }

              if (valA === undefined || valA === null) return 1;
              if (valB === undefined || valB === null) return -1;

              if (valA < valB) return consolidationSortAsc ? -1 : 1;
              if (valA > valB) return consolidationSortAsc ? 1 : -1;
              return 0;
            });

            // Pagination
            const limit = 10;
            const totalItems = sorted.length;
            const totalPages = Math.ceil(totalItems / limit) || 1;
            const currentPage = Math.min(consolidationPage, totalPages);
            const startIdx = (currentPage - 1) * limit;
            const pageItems = sorted.slice(startIdx, startIdx + limit);

            // Totals
            const totalOrders = filtered.length;
            const totalPlannedUnits = filtered.reduce((sum, r) => sum + r.plannedQty, 0);
            const totalApprovedUnits = filtered.reduce((sum, r) => sum + r.approvedQty, 0);
            const totalRejectedUnits = filtered.reduce((sum, r) => sum + r.rejectedQty, 0);
            const totalEstimatedBudget = filtered.reduce((sum, r) => sum + r.estimatedValue, 0);
            const totalRealApprovedBudget = filtered.reduce((sum, r) => sum + r.realValueApproved, 0);

            // Group by workshop for the chart
            const chartDataMap: Record<string, { name: string; estimado: number; real: number }> = {};
            filtered.forEach(r => {
              if (!chartDataMap[r.workshopName]) {
                chartDataMap[r.workshopName] = { name: r.workshopName, estimado: 0, real: 0 };
              }
              chartDataMap[r.workshopName].estimado += r.estimatedValue;
              chartDataMap[r.workshopName].real += r.realValueApproved;
            });
            const chartData = Object.values(chartDataMap);

            const requestSort = (field: string) => {
              if (consolidationSortField === field) {
                setConsolidationSortAsc(!consolidationSortAsc);
              } else {
                setConsolidationSortField(field);
                setConsolidationSortAsc(true);
              }
              setConsolidationPage(1);
            };

            const exportToCSV = () => {
              const headers = ['Taller', 'Código Confección', 'Orden Corte', 'Referencia', 'Cant. Planeada', 'Cant. Aprobada', 'Cant. Rechazada', 'Tarifa ($)', 'Valor Estimado ($)', 'Valor Real Aprobado ($)', 'Facturas Telas', 'Estado', 'Fecha Creación'];
              const csvRows = [headers.join(',')];
              
              filtered.forEach(r => {
                const row = [
                  `"${r.workshopName}"`,
                  `"${r.sewingOrderCode}"`,
                  `"${r.parentCode}"`,
                  `"${r.productName}"`,
                  r.plannedQty,
                  r.approvedQty,
                  r.rejectedQty,
                  r.rate,
                  r.estimatedValue,
                  r.realValueApproved,
                  `"${r.fabricInvoices.join('; ')}"`,
                  `"${r.status}"`,
                  `"${new Date(r.created_at).toLocaleDateString('es-ES')}"`
                ];
                csvRows.push(row.join(','));
              });
              
              const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvRows.join("\n");
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement("a");
              link.setAttribute("href", encodedUri);
              link.setAttribute("download", `Consolidado_Talleres_${new Date().toISOString().split('T')[0]}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            };

            return (
              <>
                {/* ── Cards de Métricas ── */}
                <div className="dashboard-grid">
                  <StatCard
                    label="Órdenes de Confección"
                    value={totalOrders}
                    sub="Filtradas para el consolidado"
                    icon={<ClipboardCheck size={20} />}
                    primary
                  />
                  <StatCard
                    label="Presupuesto Estimado"
                    value={`$${totalEstimatedBudget.toLocaleString('es-CO')}`}
                    sub={`${totalPlannedUnits.toLocaleString('es-CO')} prendas proyectadas`}
                    icon={<DollarSign size={20} />}
                  />
                  <StatCard
                    label="Valor Aprobado (Real)"
                    value={`$${totalRealApprovedBudget.toLocaleString('es-CO')}`}
                    sub={`${totalApprovedUnits.toLocaleString('es-CO')} prendas aprobadas por calidad`}
                    icon={<CheckCircle2 size={20} />}
                  />
                  <StatCard
                    label="Cumplimiento / Eficiencia"
                    value={totalEstimatedBudget > 0 ? `${Math.round((totalRealApprovedBudget / totalEstimatedBudget) * 100)}%` : '0%'}
                    sub={`Defectos de calidad: ${totalRejectedUnits} unidades rechazadas`}
                    icon={<TrendingUp size={20} />}
                  />
                </div>

                {/* ── Graphic Comparison and Filters ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', alignItems: 'stretch' }}>
                  {/* Recharts Bar Chart */}
                  <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '350px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '850', color: '#0f172a' }}>Comparación de Valor de Producción por Taller ($)</h3>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '600' }}>Estimado vs Real Aprobado</span>
                    </div>
                    
                    <div style={{ flex: 1, minHeight: '280px' }}>
                      {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                            <YAxis stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={v => `$${(v/1e6).toFixed(1)}M`} />
                            <Tooltip formatter={(value: any) => [`$${Number(value).toLocaleString('es-CO')}`, '']} />
                            <Bar dataKey="estimado" name="Valor Estimado" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="real" name="Valor Real Aprobado" fill="#10b981" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                          Sin datos para graficar con los filtros actuales
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sidebar Filters */}
                  <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '850', color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>Filtros</h3>
                    
                    {/* Taller Selector */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Taller Satélite</span>
                      <select
                        value={consolidationWorkshopId}
                        onChange={e => { setConsolidationWorkshopId(e.target.value); setConsolidationPage(1); }}
                        style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.8rem', fontWeight: '700', backgroundColor: 'white' }}
                      >
                        <option value="all">Todos los talleres</option>
                        {workshops.map(w => (
                          <option key={w.id} value={w.id}>{w.nombre_taller}</option>
                        ))}
                      </select>
                    </div>

                    {/* Status Selector */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Estado de Orden</span>
                      <select
                        value={consolidationStatus}
                        onChange={e => { setConsolidationStatus(e.target.value); setConsolidationPage(1); }}
                        style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.8rem', fontWeight: '700', backgroundColor: 'white' }}
                      >
                        <option value="all">Todos los estados</option>
                        <option value="En Confección">En Confección</option>
                        <option value="Terminada">Terminada</option>
                        <option value="Enviada">Enviada</option>
                      </select>
                    </div>

                    {/* Text Search */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Buscar código / factura / ref</span>
                      <input
                        type="text"
                        placeholder="Ej: OC-XXXX, Fac-100..."
                        value={consolidationSearch}
                        onChange={e => { setConsolidationSearch(e.target.value); setConsolidationPage(1); }}
                        style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.8rem', fontWeight: '700', backgroundColor: 'white', width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>

                    {/* Dates range */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Fecha Inicio</span>
                      <input
                        type="date"
                        value={consolidationStartDate}
                        onChange={e => { setConsolidationStartDate(e.target.value); setConsolidationPage(1); }}
                        style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.8rem', fontWeight: '700', backgroundColor: 'white', width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Fecha Fin</span>
                      <input
                        type="date"
                        value={consolidationEndDate}
                        onChange={e => { setConsolidationEndDate(e.target.value); setConsolidationPage(1); }}
                        style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.8rem', fontWeight: '700', backgroundColor: 'white', width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                </div>

                {/* ── Detalle Consolidador Table Card ── */}
                <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '850', color: '#0f172a' }}>Desglose de Confección por Taller</h3>
                      <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.72rem', color: '#64748b', fontWeight: '600' }}>
                        Mostrando {startIdx + 1}-{Math.min(startIdx + limit, totalItems)} de {totalItems} registros.
                      </p>
                    </div>

                    <button
                      onClick={exportToCSV}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                        padding: '0.5rem 1rem', borderRadius: '8px', border: '1.5px solid #10b981',
                        backgroundColor: 'white', color: '#10b981', fontWeight: '800', cursor: 'pointer',
                        fontSize: '0.78rem', transition: 'all 0.15s ease'
                      }}
                    >
                      <Download size={14} /> Exportar CSV
                    </button>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                          <th onClick={() => requestSort('workshopName')} style={{ padding: '0.8rem', textAlign: 'left', fontWeight: '800', cursor: 'pointer', userSelect: 'none' }}>
                            Taller <ArrowUpDown size={12} style={{ display: 'inline', marginLeft: '0.2rem' }} />
                          </th>
                          <th onClick={() => requestSort('sewingOrderCode')} style={{ padding: '0.8rem', textAlign: 'left', fontWeight: '800', cursor: 'pointer', userSelect: 'none' }}>
                            Código Confección <ArrowUpDown size={12} style={{ display: 'inline', marginLeft: '0.2rem' }} />
                          </th>
                          <th onClick={() => requestSort('parentCode')} style={{ padding: '0.8rem', textAlign: 'left', fontWeight: '800', cursor: 'pointer', userSelect: 'none' }}>
                            Orden Corte <ArrowUpDown size={12} style={{ display: 'inline', marginLeft: '0.2rem' }} />
                          </th>
                          <th onClick={() => requestSort('categoryName')} style={{ padding: '0.8rem', textAlign: 'left', fontWeight: '800', cursor: 'pointer', userSelect: 'none' }}>
                            Categoría <ArrowUpDown size={12} style={{ display: 'inline', marginLeft: '0.2rem' }} />
                          </th>
                          <th style={{ padding: '0.8rem', textAlign: 'left', fontWeight: '800' }}>Facturas Telas</th>
                          <th style={{ padding: '0.8rem', textAlign: 'center', fontWeight: '800' }}>Configuración</th>
                          <th onClick={() => requestSort('plannedQty')} style={{ padding: '0.8rem', textAlign: 'center', fontWeight: '800', cursor: 'pointer', userSelect: 'none' }}>
                            Cant. Plan <ArrowUpDown size={12} style={{ display: 'inline', marginLeft: '0.2rem' }} />
                          </th>
                          <th onClick={() => requestSort('approvedQty')} style={{ padding: '0.8rem', textAlign: 'center', fontWeight: '800', cursor: 'pointer', userSelect: 'none' }}>
                            Aprobado Calidad <ArrowUpDown size={12} style={{ display: 'inline', marginLeft: '0.2rem' }} />
                          </th>
                          <th onClick={() => requestSort('estimatedValue')} style={{ padding: '0.8rem', textAlign: 'right', fontWeight: '800', cursor: 'pointer', userSelect: 'none' }}>
                            Valor Est. <ArrowUpDown size={12} style={{ display: 'inline', marginLeft: '0.2rem' }} />
                          </th>
                          <th onClick={() => requestSort('realValueApproved')} style={{ padding: '0.8rem', textAlign: 'right', fontWeight: '800', cursor: 'pointer', userSelect: 'none' }}>
                            Aprobado ($) <ArrowUpDown size={12} style={{ display: 'inline', marginLeft: '0.2rem' }} />
                          </th>
                          <th style={{ padding: '0.8rem', textAlign: 'center', fontWeight: '800' }}>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageItems.length > 0 ? (
                          pageItems.map(row => {
                            const statusColor = row.status === 'Terminada' ? '#10b981' : row.status === 'Enviada' ? '#3b82f6' : '#ea580c';
                            const statusBg = row.status === 'Terminada' ? '#ecfdf5' : row.status === 'Enviada' ? '#eff6ff' : '#fff7ed';

                            return (
                              <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '0.8rem', fontWeight: '700', color: '#1e293b' }}>
                                  {row.workshopName}
                                </td>
                                <td style={{ padding: '0.8rem', fontWeight: '750', color: '#4f46e5' }}>
                                  {row.sewingOrderCode}
                                </td>
                                <td style={{ padding: '0.8rem', fontWeight: '600' }}>
                                  {row.parentCode}
                                </td>
                                <td style={{ padding: '0.8rem', fontWeight: '700', color: '#334155' }}>
                                  {row.categoryName}
                                </td>
                                <td style={{ padding: '0.8rem' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    {row.fabricInvoices.length > 0 ? (
                                      <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap' }}>
                                        {row.fabricInvoices.map((inv, i) => (
                                          <span key={i} style={{ display: 'inline-block', backgroundColor: '#e2e8f0', color: '#334155', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.62rem', fontWeight: '750' }}>
                                            📄 {inv}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <span style={{ fontSize: '0.62rem', color: '#94a3b8', fontStyle: 'italic' }}>Sin factura de tela</span>
                                    )}
                                  </div>
                                </td>
                                <td style={{ padding: '0.8rem', textAlign: 'center' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center' }}>
                                    {row.isSpecialEnabled ? (
                                      <span style={{ fontSize: '0.62rem', fontWeight: '800', backgroundColor: '#faf5ff', color: '#7c3aed', padding: '0.1rem 0.3rem', borderRadius: '4px', border: '1px solid #e9d5ff' }}>
                                        💲 Especial
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: '0.62rem', fontWeight: '700', color: '#94a3b8' }}>Estándar</span>
                                    )}
                                    {row.hasEmpaque ? (
                                      <span style={{ fontSize: '0.62rem', fontWeight: '800', backgroundColor: '#f0fdf4', color: '#16a34a', padding: '0.1rem 0.3rem', borderRadius: '4px', border: '1px solid #bbf7d0' }} title={`Costo empaque: $${row.rateEmpaque}`}>
                                        📦 Empaque (+${row.rateEmpaque})
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                <td style={{ padding: '0.8rem', textAlign: 'center', fontWeight: '600' }}>
                                  {row.plannedQty.toLocaleString('es-CO')}
                                </td>
                                <td style={{ padding: '0.8rem', textAlign: 'center' }}>
                                  {row.hasInspections ? (
                                    <span style={{ fontWeight: '750', color: '#10b981' }}>
                                      {row.approvedQty.toLocaleString('es-CO')}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Pendiente cal.</span>
                                  )}
                                </td>
                                <td style={{ padding: '0.8rem', textAlign: 'right', fontWeight: '600' }}>
                                  ${row.estimatedValue.toLocaleString('es-CO')}
                                </td>
                                <td style={{ padding: '0.8rem', textAlign: 'right', fontWeight: '750', color: '#10b981' }}>
                                  ${row.realValueApproved.toLocaleString('es-CO')}
                                </td>
                                <td style={{ padding: '0.8rem', textAlign: 'center' }}>
                                  <span style={{ display: 'inline-block', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.68rem', fontWeight: '750', color: statusColor, backgroundColor: statusBg, border: `1px solid ${statusColor}22` }}>
                                    {row.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                              No se encontraron registros de confección que coincidan con los filtros seleccionados.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Footer */}
                  {totalPages > 1 && (
                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button
                        disabled={currentPage === 1}
                        onClick={() => setConsolidationPage(p => Math.max(1, p - 1))}
                        style={{
                          padding: '0.45rem 1rem', borderRadius: '8px', border: '1.5px solid #cbd5e1',
                          backgroundColor: currentPage === 1 ? '#f1f5f9' : 'white',
                          color: currentPage === 1 ? '#94a3b8' : '#475569',
                          fontWeight: '800', cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                          fontSize: '0.75rem'
                        }}
                      >
                        Anterior
                      </button>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '750' }}>
                        Página {currentPage} de {totalPages}
                      </span>
                      <button
                        disabled={currentPage === totalPages}
                        onClick={() => setConsolidationPage(p => Math.min(totalPages, p + 1))}
                        style={{
                          padding: '0.45rem 1rem', borderRadius: '8px', border: '1.5px solid #cbd5e1',
                          backgroundColor: currentPage === totalPages ? '#f1f5f9' : 'white',
                          color: currentPage === totalPages ? '#94a3b8' : '#475569',
                          fontWeight: '800', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                          fontSize: '0.75rem'
                        }}
                      >
                        Siguiente
                      </button>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ── Detail Modal ─────────────────────────────────────────────────────── */}
      {activeModal && (
        <DetailModal
          {...modalConfig[activeModal]}
          onClose={() => setActiveModal(null)}
        />
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .print-only {
          display: none;
        }
        @media print {
          @page {
            size: ${printMode === 'sticker' ? '100mm 100mm' : 'auto'};
            margin: 0;
          }
          body * {
            visibility: hidden !important;
          }
          .printable-workshop-order, .printable-workshop-order * {
            visibility: visible !important;
          }
          .printable-workshop-order {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            color: black !important;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: inline !important;
          }
        }
      `}} />
    </div>
  );
}
