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
  ArrowUpDown,
  Loader2
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

const COLORS = ['#80082E', '#D81B60', '#a8325c', '#5c0621'];

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
            ? '0 20px 40px -10px rgba(128,8,46,0.4)'
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
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.5; }
        }
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
  const [companyParams, setCompanyParams] = useState<any[]>([]);
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

  // Envio a Calidad states
  const [showEnvioModal, setShowEnvioModal] = useState(false);
  const [selectedSewingOrderForEnvio, setSelectedSewingOrderForEnvio] = useState<any>(null);
  const [envioNotes, setEnvioNotes] = useState('');
  const [savingEnvio, setSavingEnvio] = useState(false);
  const [envioSinInconvenientes, setEnvioSinInconvenientes] = useState(false);
  // Each novelty line: { id, noveltyId, color, nota }
  const [envioNovedadLines, setEnvioNovedadLines] = useState<Array<{id:string,noveltyId:string,color:string,nota:string}>>([]);
  const [masterNovelties, setMasterNovelties] = useState<any[]>([]);
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

  // Sewing / Confeccion Portal filters for workshop view
  const [sewingFilterSearch, setSewingFilterSearch] = useState('');
  const [sewingFilterStatus, setSewingFilterStatus] = useState('all');
  const [sewingFilterStartDate, setSewingFilterStartDate] = useState('');
  const [sewingFilterEndDate, setSewingFilterEndDate] = useState('');

  // Next-Gen Executive Dashboard states
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [crossFilterTaller, setCrossFilterTaller] = useState<string>('all');
  const [crossFilterProducto, setCrossFilterProducto] = useState<string>('all');
  const [drillDownTaller, setDrillDownTaller] = useState<any>(null);
  const [drillDownModalOpen, setDrillDownModalOpen] = useState<boolean>(false);
  const [liveCounterOffset, setLiveCounterOffset] = useState<number>(0);
  const [liveNotifications, setLiveNotifications] = useState<any[]>([
    { id: 1, type: 'info', msg: 'Simulador en tiempo real conectado. Canal de datos establecido.', time: 'Hace 1s' }
  ]);

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
          res14,
          res15
        ] = await Promise.all([
          supabase
            .from('orders')
            .select('*, fabrics(nombre_tela), workshops(nombre_taller, responsable), cuts(*, cut_sizes(*))')
            .order('created_at', { ascending: false })
            .limit(150),
          supabase.from('workshops').select('*'),
          supabase.from('quality_inspections').select('*').limit(150).order('created_at', { ascending: false }),
          supabase.from('base_costs').select('*'),
          supabase.from('sizes').select('*').order('orden_visual', { ascending: true }),
          supabase.from('colors').select('*'),
          supabase.from('products').select('*').order('nombre_producto').limit(200),
          supabase.from('product_accessories').select('*, accessories(nombre, unidad_medida), products(nombre_producto)').limit(150),
          supabase.from('categories').select('*'),
          supabase.from('workshop_rates').select('*'),
          // novelties preloaded with workshop module filter applied in UI
          supabase.from('sewing_assignments').select('*'),
          supabase.from('workshop_special_costs').select('*'),
          supabase.from('sewing_orders')
            .select('*, parent_order:orders(*, fabrics(*), cuts(*, cut_sizes(*))), products(*), sewing_order_sizes(*, sizes(*))')
            .order('created_at', { ascending: false })
            .limit(150),
          supabase.from('fabrics').select('*'),
          supabase.from('company_params').select('*')
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
        const companyParamsData = res15.data;

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
        if (companyParamsData) setCompanyParams(companyParamsData);

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

  // Simulación de WebSockets (tiempo real)
  useEffect(() => {
    const wsMessages = [
      "Auditoría aprobada: Taller Confecciones Milán (100% aprobado)",
      "Orden OC-1044: Registrado ingreso a corte por operario",
      "Actualización de Inventario: 50 metros de Lino Spandex despachados",
      "Confección en curso: Taller Fibras del Valle inició lote OC-1039",
      "Alerta de Calidad: 2 prendas marcadas con costura defectuosa en Confecciones Milán",
      "Orden OC-1048: Confeccionadas +5 unidades del producto Camisa Oxford",
      "Taller Fibras del Valle: Asignadas +10 horas de personal extra para entrega"
    ];

    const interval = setInterval(() => {
      // Simular variación en los contadores de producción
      setLiveCounterOffset(prev => prev + Math.floor(Math.random() * 2) + 1);

      // Simular entrada de notificación WebSocket
      const randomMsg = wsMessages[Math.floor(Math.random() * wsMessages.length)];
      setLiveNotifications(prev => [
        {
          id: Date.now(),
          type: randomMsg.includes('Alerta') ? 'warning' : randomMsg.includes('aprobada') ? 'success' : 'info',
          msg: randomMsg,
          time: 'En vivo'
        },
        ...prev.slice(0, 4) // max 5 notifications
      ]);
    }, 12000); // every 12 seconds

    return () => clearInterval(interval);
  }, []);

  // Widen POS role match check to match AuthGuard and Sidebar
  const roleNameLower = profile?.roles?.name?.toLowerCase() || '';
  const isPOS = roleNameLower.includes('pos') || 
                roleNameLower.includes('post') || 
                roleNameLower.includes('punto') || 
                roleNameLower.includes('tienda') || 
                roleNameLower.includes('vendedor') || 
                roleNameLower.includes('cajero');

  // Prevent flicker/rendering the ERP dashboard while loading or if user belongs to POS
  // Placed safely after all React hooks (useState & useEffect) declarations
  if (authLoading || isPOS) {
    return (
      <div style={{ display: 'flex', height: '80vh', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={40} className="animate-spin" color="#80082E" />
      </div>
    );
  }

  const handleConfirmReceiptInWorkshop = async (so: any) => {
    if (!confirm(`¿Confirmar que el satélite recibió los cortes/insumos de la orden ${so.confeccion_code} para iniciar la confección?`)) return;
    try {
      const { error } = await supabase
        .from('sewing_orders')
        .update({ status: 'En Confección' })
        .eq('id', so.id);

      if (error) throw error;
      alert('✓ Confirmado. La orden ahora está en estado "En Confección".');
      window.location.reload();
    } catch (err: any) {
      alert('Error al confirmar recibo en taller: ' + err.message);
    }
  };

  const handleConfirmEnvioToCalidad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSewingOrderForEnvio) return;
    setSavingEnvio(true);
    try {
      const so = selectedSewingOrderForEnvio;
      const productName = so.products?.nombre_producto || 'Producto';

      // Build structured notes string
      let notesStr = '';
      if (envioSinInconvenientes) {
        notesStr = '✅ Sin inconvenientes — Todas las prendas confeccionadas conformes.';
      } else {
        const validLines = envioNovedadLines.filter(l => l.noveltyId);
        if (validLines.length > 0) {
          notesStr += `⚠️ Novedades reportadas — ${productName}:\n`;
          validLines.forEach((line, i) => {
            const nov = masterNovelties.find(n => String(n.id) === String(line.noveltyId));
            const novLabel = nov ? `[${nov.cod_novedad}] ${nov.nombre}` : 'Sin especificar';
            const colorPart = line.color ? ` | Color/Referencia: ${line.color}` : '';
            const notaPart = line.nota ? ` | Detalle: ${line.nota}` : '';
            notesStr += `  ${i + 1}. ${novLabel}${colorPart}${notaPart}\n`;
          });
        }
      }
      if (envioNotes.trim()) {
        notesStr += `\n📝 Observaciones generales: ${envioNotes.trim()}`;
      }
      const finalNotes = notesStr.trim() || 'Envío confirmado por el satélite sin observaciones.';

      // 1. Update sewing order status to 'Enviado a Calidad' (complying with database check constraint)
      const { error: statusErr } = await supabase
        .from('sewing_orders')
        .update({ status: 'Enviado a Calidad' })
        .eq('id', so.id);
      if (statusErr) throw statusErr;

      // 2. Create or update quality inspection
      const { data: existingInspections } = await supabase
        .from('quality_inspections')
        .select('id')
        .eq('sewing_order_id', so.id);

      const workshopName = workshops.find(w => String(w.id) === String(so.workshop_id))?.nombre_taller || 'Taller Satélite';
      if (!existingInspections || existingInspections.length === 0) {
        await supabase.from('quality_inspections').insert([{
          order_id: so.parent_order_id,
          sewing_order_id: so.id,
          workshop_name: workshopName,
          items_inspected: so.cantidad_planeada || 0,
          items_approved: 0,
          items_rejected: 0,
          status: 'Pendiente',
          notes: finalNotes
        }]);
      } else {
        await supabase.from('quality_inspections')
          .update({ notes: finalNotes })
          .eq('sewing_order_id', so.id);
      }

      alert('✓ Envío confirmado y reportado al módulo de Calidad con éxito.');
      setShowEnvioModal(false);
      window.location.reload();
    } catch (err: any) {
      alert('Error al confirmar envío: ' + err.message);
    } finally {
      setSavingEnvio(false);
    }
  };

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

  const getOrderAssignments = (order: any) => {
    const rowWorkshops: Record<string, string> = {};
    const orderAss = sewingAssignments.filter(a => a.order_id === order.id);

    if (orderAss.length > 0) {
      orderAss.forEach(asg => {
        rowWorkshops[`${asg.category_id}_${asg.size_code}`] = asg.workshop_id;
      });
      return { rowWorkshops };
    }

    const assData = getAssignmentsFromJson(order);
    if (assData && assData.rowWorkshops) {
      Object.entries(assData.rowWorkshops).forEach(([key, wId]) => {
        rowWorkshops[key] = String(wId);
      });
      return { rowWorkshops };
    }
    return null;
  };

  const getSewingOrderTotalUnits = (so: any): number => {
    if (!so.parent_order) return so.cantidad_planeada || 0;
    const assignments = getOrderAssignments(so.parent_order);
    const rowWorkshopsMap = assignments?.rowWorkshops || {};
    let total = 0;

    (so.parent_order.cuts || []).forEach((cut: any) => {
      if (String(cut.product_id) !== String(so.product_id)) return;
      const layersProyec = cut.layers || 1;
      const layersProduced = cut.layers_produced || 0;

      (cut.cut_sizes || []).forEach((cs: any) => {
        const sizeObj = sizesList.find(s => String(s.id) === String(cs.size_id));
        const sz = sizeObj ? sizeObj.codigo_talla : 'S/T';
        const cellKey = `${cut.product_id}_${sz}`;
        const assignedWId = rowWorkshopsMap[cellKey];

        if (!assignedWId || String(assignedWId) !== String(so.workshop_id)) return;

        let realQty = 0;
        if (cs.quantity_produced !== undefined && cs.quantity_produced !== null) {
          realQty = Number(cs.quantity_produced);
        } else {
          const proyecQty = Number(cs.quantity) || 0;
          const ppc = layersProyec > 0 ? proyecQty / layersProyec : 0;
          realQty = Math.round(ppc * layersProduced);
        }
        if (realQty > 0) total += realQty;
      });
    });

    return total || so.cantidad_planeada || 0;
  };

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

        const plannedQty = getSewingOrderTotalUnits(so);
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
        const plannedQty = getSewingOrderTotalUnits(so);
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
      const theme = {
        bg: darkMode ? '#0f172a' : '#f8fafc',
        cardBg: darkMode ? '#1e293b' : '#ffffff',
        text: darkMode ? '#f8fafc' : '#0f172a',
        textMuted: darkMode ? '#94a3b8' : '#64748b',
        border: darkMode ? '#334155' : '#cbd5e1',
        primary: '#80082E',
        secondary: '#D81B60',
        gridColor: darkMode ? '#334155' : '#f1f5f9',
        tableHeaderBg: darkMode ? '#1e293b' : '#f8fafc',
        accent: '#ff9800',
        success: '#10b981',
        danger: '#ef4444'
      };

      // Realizar filtrado consolidado por filtros cruzados
      const activeTallerId = crossFilterTaller === 'all' ? activeWorkshopId : crossFilterTaller;
      
      const filteredSewingOrders = sewingOrdersList.filter(so => {
        const matchTaller = activeTallerId === 'all' || String(so.workshop_id) === String(activeTallerId);
        const matchProducto = crossFilterProducto === 'all' || String(so.product_id) === String(crossFilterProducto);
        return matchTaller && matchProducto;
      });

      // Cálculo de los KPIs consolidados bajo filtros
      let plannedUnitsSum = 0;
      let confeccionadasSum = 0;
      let rejectedSum = 0;
      let totalValueEstimate = 0;

      filteredSewingOrders.forEach(so => {
        const planQty = getSewingOrderTotalUnits(so);
        plannedUnitsSum += planQty;
        
        // Simular variación en vivo en unidades confeccionadas
        const baseConfeccionadas = so.cantidad_confeccionada || 0;
        const liveOffset = liveCounterOffset > 0 && Math.random() > 0.5 ? Math.floor(Math.random() * 2) + 1 : 0;
        confeccionadasSum += Math.min(baseConfeccionadas + liveOffset, planQty);

        const rate = getRateForOrder(so.parent_order_id) || 4500;
        totalValueEstimate += (so.cantidad_confeccionada || 0) * rate;
      });

      // Calcular porcentaje de rechazo desde auditorías
      const relatedInspections = inspections.filter(i => {
        if (activeTallerId === 'all') return true;
        const matchingTaller = finalWorkshopsList.find(w => String(w.id) === String(activeTallerId));
        return (i.workshop_name || '').toLowerCase().trim() === (matchingTaller?.nombre_taller || '').toLowerCase().trim();
      });

      const totalInspected = relatedInspections.reduce((acc, curr) => acc + (curr.items_inspected || 0), 0);
      const totalRejected = relatedInspections.reduce((acc, curr) => acc + (curr.items_rejected || 0), 0);
      const rejectRate = totalInspected > 0 ? ((totalRejected / totalInspected) * 100).toFixed(1) : '0.0';
      const efficiencyPct = plannedUnitsSum > 0 ? Math.round((confeccionadasSum / plannedUnitsSum) * 100) : 0;

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '4rem', backgroundColor: theme.bg, color: theme.text, transition: 'all 0.3s ease' }}>
          
          {/* 1. Encabezado Ejecutivo Consolidado SAP/Dynamics Style */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            flexWrap: 'wrap', 
            gap: '1.5rem', 
            borderBottom: `1px solid ${theme.border}`, 
            backgroundColor: theme.cardBg, 
            padding: '1.5rem 2rem', 
            borderRadius: '18px', 
            boxShadow: '0 4px 12px rgba(0,0,0,0.02)' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '14px', backgroundColor: `${theme.primary}15`, color: theme.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
                <Factory size={28} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: '900', color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: theme.primary, padding: '3px 8px', borderRadius: '6px' }}>
                    Centro de Control Consolidado
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', fontWeight: '800', color: '#10b981', background: '#ecfdf5', padding: '2px 8px', borderRadius: '99px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block', animation: 'pulse 1.5s infinite' }}></span>
                    En Vivo
                  </div>
                </div>
                <h1 style={{ fontSize: '1.6rem', fontWeight: '950', margin: '0.2rem 0 0.1rem 0', color: theme.text, lineHeight: 1.1, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ padding: '0.4rem', backgroundColor: '#80082E', borderRadius: '10px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TrendingUp size={20} />
                  </div>
                  Centro de Control Corporativo
                </h1>
                <p style={{ color: theme.textMuted, fontSize: '0.82rem', fontWeight: '600', margin: 0 }}>
                  Monitoreando <strong style={{ color: theme.text }}>{finalWorkshopsList.length} satélites de confección</strong> con analítica predictiva de nivel SAP S/4HANA.
                </p>
              </div>
            </div>

            {/* Acciones y Switch Dark Mode */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              
              {/* Selector de Taller */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: theme.textMuted }}>Taller Activo:</span>
                <select
                  value={activeWorkshopId}
                  onChange={e => {
                    setActiveWorkshopId(e.target.value);
                    setCrossFilterTaller(e.target.value); // Sync cross filtering
                  }}
                  style={{
                    padding: '0.55rem 1rem',
                    borderRadius: '8px',
                    border: `1.5px solid ${theme.border}`,
                    fontSize: '0.8rem',
                    fontWeight: '900',
                    backgroundColor: theme.cardBg,
                    color: theme.text,
                    cursor: 'pointer',
                  }}
                >
                  <option value="all">🌐 Consolidado General</option>
                  {finalWorkshopsList.map(w => (
                    <option key={w.id} value={w.id}>🏭 {w.nombre_taller}</option>
                  ))}
                </select>
              </div>

              {/* Botón Modo Oscuro */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                style={{
                  padding: '0.55rem 1rem',
                  borderRadius: '8px',
                  border: `1.5px solid ${theme.border}`,
                  fontSize: '0.8rem',
                  fontWeight: '800',
                  backgroundColor: theme.cardBg,
                  color: theme.text,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                {darkMode ? '☀️ Modo Claro' : '🌙 Modo Oscuro'}
              </button>

              {/* Botón de Ayuda */}
              <button
                onClick={() => setShowSatelliteHelp(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.55rem 1rem', borderRadius: '8px',
                  border: `1.5px solid ${theme.border}`, cursor: 'pointer',
                  fontSize: '0.8rem', fontWeight: '800',
                  backgroundColor: theme.cardBg, color: theme.text,
                }}
              >
                <HelpCircle size={15} /> Ayuda
              </button>
            </div>
          </div>

          {/* Ticker de notificaciones WebSockets en vivo */}
          <div style={{
            background: darkMode ? '#1e293b' : '#eff6ff',
            border: `1px solid ${darkMode ? '#334155' : '#bfdbfe'}`,
            borderRadius: '12px',
            padding: '0.75rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.8rem',
            color: darkMode ? '#93c5fd' : '#1e40af'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: '900', textTransform: 'uppercase', backgroundColor: darkMode ? '#3b82f6' : '#2563eb', color: 'white', padding: '2px 6px', borderRadius: '4px', flexShrink: 0 }}>
                FEED EN TIEMPO REAL
              </span>
              <span style={{ fontWeight: '700', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                📢 {liveNotifications[0]?.msg}
              </span>
            </div>
            <span style={{ fontSize: '0.7rem', opacity: 0.8, fontWeight: '700', flexShrink: 0 }}>{liveNotifications[0]?.time}</span>
          </div>

          {/* ── Modal de Ayuda del Portal Satélite ──────────────────────────── */}
          {showSatelliteHelp && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
              <div style={{ backgroundColor: theme.cardBg, color: theme.text, borderRadius: '24px', width: '100%', maxWidth: '650px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 40px 80px -20px rgba(0,0,0,0.35)', border: `1px solid ${theme.border}` }}>
                {/* Header del modal */}
                <div style={{ background: `linear-gradient(135deg, ${theme.primary} 0%, #5c0621 100%)`, padding: '2rem', borderRadius: '24px 24px 0 0', color: 'white', position: 'sticky', top: 0, zIndex: 1 }}>
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
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: '900', color: theme.text, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: `${theme.primary}15`, color: theme.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '900', flexShrink: 0 }}>1</span>
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
                        <div key={i} style={{ display: 'flex', gap: '0.75rem', padding: '0.85rem 1rem', backgroundColor: darkMode ? '#1e293b' : '#f8fafc', borderRadius: '12px', border: `1px solid ${theme.border}` }}>
                          <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{step.icon}</span>
                          <div>
                            <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: '800', color: theme.text }}>{step.title}</p>
                            <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: theme.textMuted, lineHeight: '1.4' }}>{step.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Métricas */}
                  <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: '900', color: theme.text, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                        <div key={i} style={{ padding: '0.85rem', backgroundColor: darkMode ? '#1e293b' : '#f8fafc', borderRadius: '10px', border: `1px solid ${theme.border}` }}>
                          <p style={{ margin: '0 0 0.25rem', fontSize: '0.78rem', fontWeight: '800', color: theme.text }}>{m.label}</p>
                          <p style={{ margin: 0, fontSize: '0.72rem', color: theme.textMuted, lineHeight: '1.35' }}>{m.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Cerrar guía */}
                  <button
                    onClick={() => setShowSatelliteHelp(false)}
                    style={{ padding: '0.85rem', borderRadius: '12px', border: 'none', cursor: 'pointer', backgroundColor: theme.primary, color: 'white', fontWeight: '800', fontSize: '0.875rem', width: '100%', marginTop: '0.5rem' }}
                  >
                    Entendido — Cerrar guía
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. Filtros Dinámicos de Alto Nivel */}
          <div style={{
            backgroundColor: theme.cardBg,
            border: `1px solid ${theme.border}`,
            padding: '1.25rem 1.5rem',
            borderRadius: '16px',
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '900', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filtros Cruzados:</span>
            
            {/* Taller Cross Filter */}
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <select
                value={crossFilterTaller}
                onChange={e => setCrossFilterTaller(e.target.value)}
                style={{ padding: '0.45rem 0.75rem', borderRadius: '6px', border: `1px solid ${theme.border}`, fontSize: '0.75rem', fontWeight: '800', backgroundColor: theme.bg, color: theme.text }}
              >
                <option value="all">🏭 Todos los Talleres</option>
                {finalWorkshopsList.map(w => (
                  <option key={w.id} value={w.id}>{w.nombre_taller}</option>
                ))}
              </select>
            </div>

            {/* Producto Cross Filter */}
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <select
                value={crossFilterProducto}
                onChange={e => setCrossFilterProducto(e.target.value)}
                style={{ padding: '0.45rem 0.75rem', borderRadius: '6px', border: `1px solid ${theme.border}`, fontSize: '0.75rem', fontWeight: '800', backgroundColor: theme.bg, color: theme.text }}
              >
                <option value="all">👕 Todos los Productos</option>
                {productsList.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre_producto}</option>
                ))}
              </select>
            </div>

            {/* Reset Filters */}
            {(crossFilterTaller !== 'all' || crossFilterProducto !== 'all') && (
              <button
                onClick={() => {
                  setCrossFilterTaller('all');
                  setCrossFilterProducto('all');
                }}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '6px',
                  border: `1px solid ${theme.danger}40`,
                  fontSize: '0.72rem',
                  fontWeight: '800',
                  backgroundColor: `${theme.danger}10`,
                  color: theme.danger,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                <X size={12} /> Limpiar Filtros
              </button>
            )}
          </div>
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
                  const plannedQty = getSewingOrderTotalUnits(so);
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
                  { from: '#80082E', to: '#5c0621', light: '#fdf2f4', text: '#5c0621', pill: '#f5c6d0' },
                  { from: '#D81B60', to: '#ad1550', light: '#fef1f6', text: '#9b1247', pill: '#f8bbd0' },
                  { from: '#a8325c', to: '#872649', light: '#fdf2f8', text: '#6d1e3b', pill: '#f3a5c0' },
                  { from: '#c2185b', to: '#880e4f', light: '#fce4ec', text: '#880e4f', pill: '#f48fb1' },
                  { from: '#e91e63', to: '#c2185b', light: '#fce4ec', text: '#ad1457', pill: '#f8bbd0' },
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
            
            {/* Card 1: Planeadas */}
            <div className="card" style={{ position: 'relative', overflow: 'hidden', padding: '1.25rem 1.5rem', border: `1px solid ${theme.border}`, backgroundColor: theme.cardBg, color: theme.text }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div>
                  <p style={{ fontSize: '0.7rem', fontWeight: '800', color: theme.textMuted, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Producción Planeada</p>
                  <h3 style={{ fontSize: '2rem', fontWeight: '950', margin: '0.25rem 0', color: theme.text }}>{loading ? '…' : `${plannedUnitsSum.toLocaleString('es-CO')} uds`}</h3>
                  <p style={{ fontSize: '0.72rem', color: '#3b82f6', margin: 0, fontWeight: '700' }}>Meta total programada</p>
                </div>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Package size={18} />
                </div>
              </div>
              <SparklineWave color="#3b82f6" path="M0,22 Q25,8 50,18 T100,8" />
            </div>

            {/* Card 2: Confeccionadas */}
            <div className="card" style={{ position: 'relative', overflow: 'hidden', padding: '1.25rem 1.5rem', border: `1px solid ${theme.border}`, backgroundColor: theme.cardBg, color: theme.text }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div>
                  <p style={{ fontSize: '0.7rem', fontWeight: '800', color: theme.textMuted, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confección Real</p>
                  <h3 style={{ fontSize: '2rem', fontWeight: '950', margin: '0.25rem 0', color: theme.primary }}>{loading ? '…' : `${confeccionadasSum.toLocaleString('es-CO')} uds`}</h3>
                  <p style={{ fontSize: '0.72rem', color: theme.success, margin: 0, fontWeight: '700' }}>⚡ Sincronizado en tiempo real</p>
                </div>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: `${theme.primary}15`, color: theme.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Scissors size={18} />
                </div>
              </div>
              <SparklineWave color={theme.primary} path="M0,15 Q30,25 60,10 T100,20" />
            </div>

            {/* Card 3: Eficiencia */}
            <div className="card" style={{ position: 'relative', overflow: 'hidden', padding: '1.25rem 1.5rem', border: `1px solid ${theme.border}`, backgroundColor: theme.cardBg, color: theme.text }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div>
                  <p style={{ fontSize: '0.7rem', fontWeight: '800', color: theme.textMuted, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Eficiencia Operativa</p>
                  <h3 style={{ fontSize: '2rem', fontWeight: '950', margin: '0.25rem 0', color: theme.success }}>{loading ? '…' : `${efficiencyPct}%`}</h3>
                  <p style={{ fontSize: '0.72rem', color: theme.textMuted, margin: 0, fontWeight: '700' }}>Tasa de cumplimiento</p>
                </div>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: `${theme.success}15`, color: theme.success, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={18} />
                </div>
              </div>
              <SparklineWave color={theme.success} path="M0,25 Q20,10 50,22 T100,12" />
            </div>

            {/* Card 4: Calidad */}
            <div className="card" style={{ position: 'relative', overflow: 'hidden', padding: '1.25rem 1.5rem', border: `1px solid ${theme.border}`, backgroundColor: theme.cardBg, color: theme.text }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div>
                  <p style={{ fontSize: '0.7rem', fontWeight: '800', color: theme.textMuted, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tasa de Rechazo</p>
                  <h3 style={{ fontSize: '2rem', fontWeight: '950', margin: '0.25rem 0', color: Number(rejectRate) > 5 ? theme.danger : theme.success }}>
                    {loading ? '…' : `${rejectRate}%`}
                  </h3>
                  <p style={{ fontSize: '0.72rem', color: theme.textMuted, margin: 0, fontWeight: '700' }}>Límite de control: 5.0%</p>
                </div>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: `${Number(rejectRate) > 5 ? theme.danger : theme.success}15`, color: Number(rejectRate) > 5 ? theme.danger : theme.success, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ClipboardCheck size={18} />
                </div>
              </div>
              <SparklineWave color={Number(rejectRate) > 5 ? theme.danger : theme.success} path="M0,20 Q40,5 70,25 T100,15" />
            </div>
          </div>

          {/* 3. Sección de Analítica y Gráficos Corporativos */}
          <div style={{ display: 'grid', gridTemplateColumns: '7fr 3fr', gap: '2rem' }}>
            
            {/* Gráfico de Producción Real vs. Planeada por Taller (Drill Down en Click) */}
            <div style={{
              backgroundColor: theme.cardBg,
              border: `1px solid ${theme.border}`,
              borderRadius: '20px',
              padding: '1.5rem 1.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '900', color: theme.text }}>Volumen de Producción por Satélite</h3>
                  <span style={{ fontSize: '0.72rem', color: theme.textMuted }}>Haz clic en una barra para abrir el desglose analítico (Drill Down) o en la leyenda para filtrar.</span>
                </div>
              </div>

              <div style={{ width: '100%', height: '240px' }}>
                <ResponsiveContainer>
                  <BarChart
                    data={finalWorkshopsList.map(w => {
                      const wsSewing = sewingOrdersList.filter(so => String(so.workshop_id) === String(w.id));
                      const planned = wsSewing.reduce((sum, so) => sum + getSewingOrderTotalUnits(so), 0);
                      const sewed = wsSewing.reduce((sum, so) => sum + (so.cantidad_confeccionada || 0), 0);
                      return {
                        name: w.nombre_taller,
                        Planeado: planned,
                        Confeccionado: sewed,
                        raw: w
                      };
                    })}
                    onClick={(state: any) => {
                      if (state && state.activePayload && state.activePayload.length > 0) {
                        const clickedWorkshop = state.activePayload[0].payload.raw;
                        setDrillDownTaller(clickedWorkshop);
                        setDrillDownModalOpen(true);
                      }
                    }}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.gridColor} />
                    <XAxis dataKey="name" stroke={theme.textMuted} fontSize={10} tickLine={false} />
                    <YAxis stroke={theme.textMuted} fontSize={10} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.text }} />
                    <Bar dataKey="Planeado" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={25} />
                    <Bar dataKey="Confeccionado" fill={theme.primary} radius={[4, 4, 0, 0]} barSize={25} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Panel de Alertas Operativas Inteligentes */}
            <div style={{
              backgroundColor: theme.cardBg,
              border: `1px solid ${theme.border}`,
              borderRadius: '20px',
              padding: '1.5rem 1.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '900', color: theme.text }}>Alertas de Control</h3>
                <span style={{ fontSize: '0.72rem', color: theme.textMuted }}>Alertas prioritarias de planta</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '240px', overflowY: 'auto' }} className="pos-scrollbar">
                {/* Alerta 1: Tasa de rechazo crítica */}
                {Number(rejectRate) > 5 && (
                  <div style={{ padding: '0.75rem', borderRadius: '8px', borderLeft: `4px solid ${theme.danger}`, backgroundColor: `${theme.danger}08`, display: 'flex', gap: '0.5rem' }}>
                    <AlertCircle size={16} color={theme.danger} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong style={{ fontSize: '0.75rem', color: theme.text, display: 'block' }}>Tasa de Rechazo Excedida</strong>
                      <span style={{ fontSize: '0.7rem', color: theme.textMuted }}>Tasa de calidad consolidada en {rejectRate}% (límite 5%). Inspecciona auditorías.</span>
                    </div>
                  </div>
                )}

                {/* Alerta 2: Talleres libres */}
                {finalWorkshopsList.some(w => !sewingOrdersList.some(so => String(so.workshop_id) === String(w.id))) && (
                  <div style={{ padding: '0.75rem', borderRadius: '8px', borderLeft: `4px solid ${theme.accent}`, backgroundColor: `${theme.accent}08`, display: 'flex', gap: '0.5rem' }}>
                    <Info size={16} color={theme.accent} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong style={{ fontSize: '0.75rem', color: theme.text, display: 'block' }}>Capacidad Ociosa de Confección</strong>
                      <span style={{ fontSize: '0.7rem', color: theme.textMuted }}>Hay satélites disponibles sin carga activa. Asigna lotes de corte pendientes.</span>
                    </div>
                  </div>
                )}

                {/* Live notifications */}
                {liveNotifications.slice(0, 3).map(noti => (
                  <div key={noti.id} style={{ padding: '0.75rem', borderRadius: '8px', borderLeft: `4px solid ${noti.type === 'warning' ? theme.danger : noti.type === 'success' ? theme.success : '#2563eb'}`, backgroundColor: `${darkMode ? '#0f172a' : '#f8fafc'}`, display: 'flex', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.9rem', marginTop: '2px' }}>⚡</div>
                    <div>
                      <strong style={{ fontSize: '0.75rem', color: theme.text, display: 'block' }}>Actividad en Satélites</strong>
                      <span style={{ fontSize: '0.7rem', color: theme.textMuted }}>{noti.msg}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Modal de Drill Down Analítico */}
          {drillDownModalOpen && drillDownTaller && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(6px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
              <div style={{ backgroundColor: theme.cardBg, color: theme.text, borderRadius: '24px', width: '100%', maxWidth: '600px', padding: '2rem', border: `1px solid ${theme.border}`, boxShadow: '0 40px 80px -20px rgba(0,0,0,0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                  <div>
                    <span style={{ fontSize: '0.65rem', fontWeight: '950', color: theme.primary, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Desglose de Satélite (Drill Down)</span>
                    <h2 style={{ margin: '0.2rem 0 0', fontSize: '1.35rem', fontWeight: '950' }}>🏭 {drillDownTaller.nombre_taller}</h2>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: theme.textMuted }}>Administrador responsable: <strong>{drillDownTaller.responsable || '—'}</strong></p>
                  </div>
                  <button onClick={() => setDrillDownModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.text }}><X size={20} /></button>
                </div>

                {/* Contenido Drill Down */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  
                  {/* Desglose de Lotes del Taller */}
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', fontWeight: '900', textTransform: 'uppercase', color: theme.textMuted }}>Lotes Asignados y Estatus</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }} className="pos-scrollbar">
                      {sewingOrdersList
                        .filter(so => String(so.workshop_id) === String(drillDownTaller.id))
                        .map(so => {
                          const prodObj = productsList.find(p => String(p.id) === String(so.product_id));
                          const progress = so.cantidad_planeada > 0 ? Math.round(((so.cantidad_confeccionada || 0) / so.cantidad_planeada) * 100) : 0;
                          return (
                            <div key={so.id} style={{ padding: '0.85rem', borderRadius: '10px', border: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <strong style={{ fontSize: '0.8rem', display: 'block' }}>{so.confeccion_code}</strong>
                                <span style={{ fontSize: '0.7rem', color: theme.textMuted }}>{prodObj?.nombre_producto || 'Referencia'}</span>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: '900', display: 'block' }}>{so.cantidad_confeccionada || 0} / {so.cantidad_planeada} uds</span>
                                <span style={{ fontSize: '0.68rem', color: progress >= 100 ? theme.success : theme.primary, fontWeight: '800' }}>{progress}% Completado</span>
                              </div>
                            </div>
                          );
                        })}
                      {sewingOrdersList.filter(so => String(so.workshop_id) === String(drillDownTaller.id)).length === 0 && (
                        <div style={{ textAlign: 'center', padding: '1.5rem', color: theme.textMuted, fontSize: '0.78rem' }}>Sin lotes activos asignados.</div>
                      )}
                    </div>
                  </div>

                  {/* Auditoría de Calidad Detallada */}
                  <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', fontWeight: '900', textTransform: 'uppercase', color: theme.textMuted }}>Auditorías de Calidad Recientes</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {inspections
                        .filter(i => (i.workshop_name || '').toLowerCase().trim() === (drillDownTaller.nombre_taller || '').toLowerCase().trim())
                        .slice(0, 2)
                        .map(i => (
                          <div key={i.id} style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: darkMode ? '#1e293b' : '#f8fafc', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                            <span>📅 {new Date(i.created_at).toLocaleDateString('es-CO')}</span>
                            <span style={{ fontWeight: '800', color: theme.success }}>Aprobadas: {i.items_approved} uds</span>
                            <span style={{ fontWeight: '800', color: theme.danger }}>Rechazadas: {i.items_rejected} uds</span>
                          </div>
                        ))}
                      {inspections.filter(i => (i.workshop_name || '').toLowerCase().trim() === (drillDownTaller.nombre_taller || '').toLowerCase().trim()).length === 0 && (
                        <div style={{ fontSize: '0.75rem', color: theme.textMuted, fontStyle: 'italic' }}>Sin auditorías registradas.</div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => setDrillDownModalOpen(false)}
                    style={{ padding: '0.75rem', borderRadius: '10px', border: 'none', cursor: 'pointer', backgroundColor: theme.primary, color: 'white', fontWeight: '800', width: '100%', fontSize: '0.8rem' }}
                  >
                    Cerrar Desglose Analítico
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 4. Acordeón / Estado Detallado por Taller */}

          {/* Main Layout: 70% Columns & 30% Right Panel */}
          <div style={{ display: 'grid', gridTemplateColumns: '7fr 3fr', gap: '2rem', alignItems: 'start' }}>
            
            {/* Left Content Area */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {/* Active Orders */}
              {(() => {
                const pendingConfecciones: { order: any; workshop: any; planeadas: number; confeccionadas: number; confeccionCode: string; status: string; id: string; createdAt: string }[] = [];
                sewingOrdersList.forEach(so => {
                  const w = finalWorkshopsList.find(workshop => String(workshop.id).toLowerCase().trim() === String(so.workshop_id).toLowerCase().trim());
                  if (!w) return;

                  if (activeWorkshopId !== 'all' && String(w.id) !== String(activeWorkshopId)) return;

                  const plannedQty = getSewingOrderTotalUnits(so);
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

                  if (so.status === 'Enviado a Taller' || so.status === 'En Confección' || so.status === 'Enviado a Calidad') {
                    pendingConfecciones.push({
                      order: parentOrder,
                      workshop: w,
                      planeadas: plannedQty,
                      confeccionadas: actualSewedQty,
                      confeccionCode: so.confeccion_code,
                      status: so.status,
                      id: so.id,
                      createdAt: so.created_at || parentOrder.created_at || ''
                    });
                  }
                });

                // Ordenar por fecha más reciente primero
                pendingConfecciones.sort((a: any, b: any) => {
                  const da = new Date(a.createdAt).getTime() || 0;
                  const db = new Date(b.createdAt).getTime() || 0;
                  return db - da;
                });

                return (
                  <div className="card" style={{ padding: '2rem', borderRadius: '20px', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '900', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        Órdenes Asignadas Activas
                        <span style={{ fontSize: '0.72rem', backgroundColor: '#fdf2f4', color: '#80082E', padding: '2px 8px', borderRadius: '999px', fontWeight: '800' }}>
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
                            <tr>
                              <td colSpan={8} style={{ padding: '2rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                  <div style={{ height: '18px', width: '100%', borderRadius: '4px', background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 37%, #f1f5f9 63%)', backgroundSize: '400% 100%', animation: 'shimmer 1.4s ease infinite' }}></div>
                                  <div style={{ height: '18px', width: '80%', borderRadius: '4px', background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 37%, #f1f5f9 63%)', backgroundSize: '400% 100%', animation: 'shimmer 1.4s ease infinite' }}></div>
                                </div>
                              </td>
                            </tr>
                          ) : pendingConfecciones.length === 0 ? (
                            <tr><td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>No tienes órdenes activas asignadas.</td></tr>
                          ) : pendingConfecciones.map(({ order, workshop, planeadas, confeccionadas, confeccionCode, status, id }) => {
                            const progress = planeadas > 0 ? Math.round((confeccionadas / planeadas) * 100) : 0;
                            return (
                              <tr key={`${order.id}-${workshop.id}-${confeccionCode}`} style={{ borderBottom: '1px solid #f8fafc', transition: 'background-color 0.15s' }}>
                                <td style={{ padding: '1rem 1rem', fontWeight: '800', color: '#80082E' }}>{confeccionCode}</td>
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
                                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <button 
                                      onClick={() => {
                                        const realSewingOrder = sewingOrdersList.find(so => so.confeccion_code === confeccionCode);
                                        if (realSewingOrder) {
                                          setViewingOrderDetails(realSewingOrder);
                                        }
                                      }} 
                                      style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.75rem', fontWeight: '800', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                    >
                                      Detalles <ChevronRight size={14} />
                                    </button>

                                    {status === 'Enviado a Taller' && (
                                      <button
                                        onClick={() => handleConfirmReceiptInWorkshop({ id, confeccion_code: confeccionCode })}
                                        style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '0.35rem 0.6rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer' }}
                                      >
                                        📥 Recibir Cuts
                                      </button>
                                    )}

                                    {status === 'En Confección' && (
                                      <button
                                        onClick={() => {
                                          const realSewingOrder = sewingOrdersList.find(so => so.id === id);
                                          if (realSewingOrder) {
                                            setSelectedSewingOrderForEnvio(realSewingOrder);
                                            setEnvioNotes('');
                                            setShowEnvioModal(true);
                                          }
                                        }}
                                        style={{ backgroundColor: '#eab308', color: 'white', border: 'none', padding: '0.35rem 0.6rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer' }}
                                      >
                                        📤 Enviar Calidad
                                      </button>
                                    )}

                                    {status === 'Enviado a Calidad' && (
                                      <span style={{ fontSize: '0.68rem', fontWeight: '850', color: '#d97706', padding: '2px 6px', backgroundColor: '#fef3c7', borderRadius: '4px', border: '1px solid #fcd34d' }}>
                                        En Tránsito Calidad
                                      </span>
                                    )}
                                  </div>
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
                        <tr>
                          <td colSpan={7} style={{ padding: '2rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              <div style={{ height: '18px', width: '100%', borderRadius: '4px', background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 37%, #f1f5f9 63%)', backgroundSize: '400% 100%', animation: 'shimmer 1.4s ease infinite' }}></div>
                              <div style={{ height: '18px', width: '70%', borderRadius: '4px', background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 37%, #f1f5f9 63%)', backgroundSize: '400% 100%', animation: 'shimmer 1.4s ease infinite' }}></div>
                            </div>
                          </td>
                        </tr>
                      ) : workshopInspections.length === 0 ? (
                        <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>Aún no registras auditorías en Control de Calidad.</td></tr>
                      ) : workshopInspections.slice(0, 5).map(i => {
                        const orderObj = orders.find(o => o.id === i.order_id);
                        const orderCode = orderObj ? `OC-${orderObj.internal_code}` : '—';
                        const itemRate = getRateForOrder(i.order_id);
                        const payment = (i.items_approved || 0) * itemRate;
                        return (
                          <tr key={i.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                            <td style={{ padding: '1rem 1rem', fontWeight: '800', color: '#80082E' }}>{orderCode}</td>
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

          {/* CONFIRMAR ENVÍO A CALIDAD MODAL */}
          {showEnvioModal && selectedSewingOrderForEnvio && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem' }}>
              <div style={{ width: '100%', maxWidth: '620px', maxHeight: '92vh', overflowY: 'auto', backgroundColor: 'white', borderRadius: '20px', boxShadow: '0 25px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>

                {/* Header */}
                <div style={{ padding: '1.5rem 1.75rem 1rem', borderBottom: '2px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'linear-gradient(135deg,#f59e0b,#d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>📤</div>
                      <h3 style={{ margin: 0, fontWeight: '950', color: '#0f172a', fontSize: '1.1rem' }}>Relación de Envío a Calidad</h3>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#80082E', backgroundColor: '#fdf2f8', padding: '0.2rem 0.6rem', borderRadius: '6px', border: '1px solid #fbcfe8' }}>
                        Lote: {selectedSewingOrderForEnvio.confeccion_code}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569', backgroundColor: '#f8fafc', padding: '0.2rem 0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        {selectedSewingOrderForEnvio.products?.nombre_producto || 'Producto'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowEnvioModal(false)}
                    style={{ border: 'none', background: '#f1f5f9', borderRadius: '8px', width: '34px', height: '34px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexShrink: 0 }}
                  >
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleConfirmEnvioToCalidad} style={{ padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>

                  {/* Product summary */}
                  <div style={{ backgroundColor: '#f8fafc', borderRadius: '12px', padding: '1rem', border: '1px solid #e2e8f0' }}>
                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resumen del lote</p>
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>Producto</p>
                        <p style={{ margin: 0, fontWeight: '800', fontSize: '0.88rem', color: '#0f172a' }}>{selectedSewingOrderForEnvio.products?.nombre_producto || '—'}</p>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>Unidades planeadas</p>
                        <p style={{ margin: 0, fontWeight: '800', fontSize: '0.88rem', color: '#0f172a' }}>{selectedSewingOrderForEnvio.cantidad_planeada || 0} uds</p>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>Confeccionadas</p>
                        <p style={{ margin: 0, fontWeight: '800', fontSize: '0.88rem', color: '#10b981' }}>{selectedSewingOrderForEnvio.cantidad_confeccionada || 0} uds</p>
                      </div>
                      {(selectedSewingOrderForEnvio.sewing_order_sizes || []).length > 0 && (
                        <div style={{ width: '100%' }}>
                          <p style={{ margin: '0 0 0.4rem', fontSize: '0.7rem', color: '#94a3b8' }}>Tallas</p>
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            {(selectedSewingOrderForEnvio.sewing_order_sizes || []).map((sz: any) => (
                              <span key={sz.id} style={{ fontSize: '0.7rem', fontWeight: '800', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                                {sz.sizes?.codigo_talla || sz.size_id}: {sz.cantidad_planeada}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick check — sin inconvenientes */}
                  <div
                    onClick={() => { setEnvioSinInconvenientes(p => !p); if (!envioSinInconvenientes) setEnvioNovedadLines([]); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.9rem 1.1rem', borderRadius: '12px', border: `2px solid ${envioSinInconvenientes ? '#10b981' : '#e2e8f0'}`, backgroundColor: envioSinInconvenientes ? '#ecfdf5' : '#f8fafc', cursor: 'pointer', userSelect: 'none', transition: 'all 0.18s' }}
                  >
                    <div style={{ width: '22px', height: '22px', borderRadius: '6px', border: `2px solid ${envioSinInconvenientes ? '#10b981' : '#cbd5e1'}`, backgroundColor: envioSinInconvenientes ? '#10b981' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.18s' }}>
                      {envioSinInconvenientes && <span style={{ color: 'white', fontSize: '0.8rem', fontWeight: '900' }}>✓</span>}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontWeight: '850', fontSize: '0.9rem', color: envioSinInconvenientes ? '#065f46' : '#1e293b' }}>✅ Sin inconvenientes — despacho conforme</p>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>Todas las prendas en orden, sin novedades que reportar.</p>
                    </div>
                  </div>

                  {/* Novelty lines per product */}
                  {!envioSinInconvenientes && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '1rem' }}>⚠️</span>
                          <span style={{ fontWeight: '850', fontSize: '0.88rem', color: '#0f172a' }}>Novedades por color / referencia</span>
                          {envioNovedadLines.filter(l => l.noveltyId).length > 0 && (
                            <span style={{ fontSize: '0.65rem', fontWeight: '800', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '999px', padding: '0.15rem 0.55rem' }}>
                              {envioNovedadLines.filter(l => l.noveltyId).length} registrada{envioNovedadLines.filter(l => l.noveltyId).length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setEnvioNovedadLines(prev => [...prev, { id: Date.now().toString(), noveltyId: '', color: '', nota: '' }])}
                          style={{ fontSize: '0.75rem', fontWeight: '800', color: '#80082E', backgroundColor: '#fdf2f8', border: '1px solid #fbcfe8', borderRadius: '8px', padding: '0.3rem 0.75rem', cursor: 'pointer' }}
                        >
                          + Agregar novedad
                        </button>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.73rem', color: '#64748b' }}>
                        Agrega una línea por cada novedad encontrada. Especifica el color o referencia afectada si aplica.
                      </p>

                      {envioNovedadLines.length === 0 && (
                        <div style={{ padding: '1.25rem', textAlign: 'center', backgroundColor: '#fafafa', borderRadius: '10px', border: '1px dashed #cbd5e1', fontSize: '0.8rem', color: '#94a3b8' }}>
                          Haz clic en <strong>+ Agregar novedad</strong> para registrar inconvenientes encontrados.
                        </div>
                      )}

                      {envioNovedadLines.map((line, idx) => (
                        <div key={line.id} style={{ backgroundColor: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: '12px', padding: '0.9rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#92400e' }}>NOVEDAD #{idx + 1}</span>
                            <button
                              type="button"
                              onClick={() => setEnvioNovedadLines(prev => prev.filter(l => l.id !== line.id))}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', fontSize: '0.8rem', fontWeight: '800', padding: '0.1rem 0.4rem' }}
                            >
                              ✕ Quitar
                            </button>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            <div style={{ gridColumn: '1 / -1' }}>
                              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#78350f', marginBottom: '0.25rem' }}>Tipo de novedad *</label>
                              <select
                                value={line.noveltyId}
                                onChange={e => setEnvioNovedadLines(prev => prev.map(l => l.id === line.id ? { ...l, noveltyId: e.target.value } : l))}
                                style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid #fde68a', fontSize: '0.8rem', fontWeight: '700', backgroundColor: 'white', color: '#1e293b' }}
                              >
                                <option value="">— Selecciona una novedad —</option>
                                {masterNovelties.length === 0 && (
                                  <option value="" disabled>Cargando novedades...</option>
                                )}
                                {masterNovelties
                                  .filter(nov => !nov.modulo_relac || nov.modulo_relac.toLowerCase().includes('taller'))
                                  .map(nov => (
                                    <option key={nov.id} value={String(nov.id)}>
                                      [{nov.cod_novedad}] {nov.nombre}{nov.criticidad ? ` · ${nov.criticidad}` : ''}
                                    </option>
                                  ))}
                              </select>
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#78350f', marginBottom: '0.25rem' }}>Color / Referencia</label>
                              <input
                                type="text"
                                placeholder="Ej: Azul Rey, Rojo Tinto..."
                                value={line.color}
                                onChange={e => setEnvioNovedadLines(prev => prev.map(l => l.id === line.id ? { ...l, color: e.target.value } : l))}
                                style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid #fde68a', fontSize: '0.8rem', backgroundColor: 'white', boxSizing: 'border-box' }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#78350f', marginBottom: '0.25rem' }}>Detalle adicional</label>
                              <input
                                type="text"
                                placeholder="Cantidad, descripción..."
                                value={line.nota}
                                onChange={e => setEnvioNovedadLines(prev => prev.map(l => l.id === line.id ? { ...l, nota: e.target.value } : l))}
                                style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid #fde68a', fontSize: '0.8rem', backgroundColor: 'white', boxSizing: 'border-box' }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* General observations */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '800', marginBottom: '0.4rem', color: '#334155' }}>📝 Observaciones generales (opcional)</label>
                    <textarea
                      placeholder="Información adicional del despacho, faltantes, acuerdos..."
                      value={envioNotes}
                      onChange={e => setEnvioNotes(e.target.value)}
                      style={{ width: '100%', minHeight: '75px', padding: '0.625rem 0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.83rem', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowEnvioModal(false)}
                      style={{ flex: 1, padding: '0.8rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', backgroundColor: 'white', color: '#475569', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={savingEnvio}
                      style={{ flex: 2, padding: '0.8rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: 'white', fontWeight: '900', fontSize: '0.9rem', cursor: savingEnvio ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: savingEnvio ? 0.75 : 1 }}
                    >
                      {savingEnvio ? '⏳ Enviando...' : '📤 Confirmar Envío a Calidad'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
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
                       style={{ backgroundColor: '#80082E', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}
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
                                 <span style={{ fontWeight: '900', color: '#80082E' }}>{viewingOrderDetails.confeccion_code}</span>
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
                             <span style={{ fontSize: '1.15rem', fontWeight: '950', color: '#80082E' }}>{totalUnits} uds</span>
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
                        <p style={{ margin: '0.2rem 0 0', color: '#80082E', fontWeight: '750' }}>Fecha Programada: <strong>{viewingOrderDetails.parent_order?.created_at ? new Date(viewingOrderDetails.parent_order.created_at).toLocaleDateString('es-CO') : '—'}</strong></p>
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
                            const fichaTecnicaUrl = categoryObj?.ficha_tecnica_url || '';
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
                                fichaTecnicaUrl,
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
                            fichaTecnicaUrl: string;
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
                                fichaTecnicaUrl: item.fichaTecnicaUrl || '',
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
                                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#0f172a' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                      <span>{item.categoryName}</span>
                                      {item.fichaTecnicaUrl && (
                                        <a
                                          href={item.fichaTecnicaUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.68rem', fontWeight: '700', color: '#0369a1', backgroundColor: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: '5px', padding: '0.15rem 0.45rem', textDecoration: 'none', whiteSpace: 'nowrap' }}
                                        >
                                          📄 Ficha Técnica
                                        </a>
                                      )}
                                    </div>
                                  </td>
                                  <td style={{ padding: '0.6rem 0.75rem', color: '#1e293b', fontWeight: '600' }}>{item.colorName}</td>
                                  <td style={{ padding: '0.6rem 0.75rem', color: '#475569' }}>{item.fabricName}</td>
                                  <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: '800', color: '#80082E' }}>
                                    {Object.entries(item.sizes).map(([sz, qty]) => `${sz}(${qty})`).join(' · ')}
                                  </td>
                                  <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>{item.totalQuantity} uds</td>
                                </tr>
                              ))}
                              <tr style={{ backgroundColor: '#f8fafc', fontWeight: '900', borderTop: '1.5px solid #cbd5e1' }}>
                                <td colSpan={4} style={{ padding: '0.75rem 0.75rem', textTransform: 'uppercase', color: '#334155', fontSize: '0.7rem' }}>Total Unidades Despachadas</td>
                                <td style={{ padding: '0.75rem 0.75rem', textAlign: 'right', color: '#80082E', fontSize: '0.9rem', fontWeight: '950' }}>
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
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#fdf2f4', color: '#80082E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
              <div className="card" style={{ padding: '1.5rem', borderRadius: '20px', backgroundColor: '#fdf2f4', border: '1px dashed #f5c6d0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#80082E' }}>
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
                      <div style={{ width: '92%', height: '100%', backgroundColor: '#80082E' }} />
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
      const myWorkshopsIds = finalWorkshopsList.map(w => String(w.id));
      const mySewingOrders = sewingOrdersList.filter(so => 
        myWorkshopsIds.includes(String(so.workshop_id))
      );

      const getSewingOrderRate = (so: any, wsId: string) => {
        // Use the joined `so.products` from the sewing_orders query (already includes category_id)
        // Fallback to productsList if join is missing
        const prod = so.products || productsList.find(p => String(p.id) === String(so.product_id));
        const categoryObj = prod ? categories.find(c => String(c.id) === String(prod.category_id)) : null;
        const catBaseRate = categoryObj?.base_rate || baseSewingGlobal;

        let itemRate = catBaseRate;
        if (categoryObj) {
          const rateObj = workshopRates.find(r => 
            String(r.workshop_id).toLowerCase().trim() === String(wsId).toLowerCase().trim() && 
            String(r.category_id).toLowerCase().trim() === String(categoryObj.id).toLowerCase().trim()
          );
          if (rateObj && Number(rateObj.rate) > 0) {
            itemRate = Number(rateObj.rate);
          }
        }
        return itemRate;
      };

      // Apply Filters
      const filteredSewingOrdersForTab = mySewingOrders.filter(so => {
        // Workshop filter
        if (activeWorkshopId !== 'all' && String(so.workshop_id) !== String(activeWorkshopId)) {
          return false;
        }

        // Status filter
        if (sewingFilterStatus !== 'all' && so.status !== sewingFilterStatus) {
          return false;
        }

        // Date range filter
        if (sewingFilterStartDate) {
          if (new Date(so.created_at || Date.now()) < new Date(sewingFilterStartDate)) {
            return false;
          }
        }
        if (sewingFilterEndDate) {
          const end = new Date(sewingFilterEndDate);
          end.setHours(23, 59, 59, 999);
          if (new Date(so.created_at || Date.now()) > end) {
            return false;
          }
        }

        // Search text
        if (sewingFilterSearch.trim()) {
          const q = sewingFilterSearch.toLowerCase();
          const parentOrder = orders.find(o => o.id === so.parent_order_id);
          const clientName = (parentOrder?.client_name || '').toLowerCase();
          const code = (so.confeccion_code || '').toLowerCase();
          const product = productsList.find(p => String(p.id) === String(so.product_id));
          const productName = (product?.nombre_producto || '').toLowerCase();
          const currentWs = workshops.find(w => String(w.id) === String(so.workshop_id));
          const workshopName = (currentWs?.nombre_taller || '').toLowerCase();
          
          if (!clientName.includes(q) && !code.includes(q) && !productName.includes(q) && !workshopName.includes(q)) {
            return false;
          }
        }

        return true;
      });

      // Calculate Metrics for the filtered list
      let totalLotes = filteredSewingOrdersForTab.length;
      let totalPlannedUnits = 0;
      let totalCompletedUnits = 0;
      let totalEstimatedPayout = 0;
      let totalEarnedPayout = 0;

      filteredSewingOrdersForTab.forEach(so => {
        const plannedQty = getSewingOrderTotalUnits(so);
        totalPlannedUnits += plannedQty;
        totalCompletedUnits += so.cantidad_confeccionada || 0;

        const rate = getSewingOrderRate(so, so.workshop_id);
        const ws = workshops.find(w => String(w.id).toLowerCase() === String(so.workshop_id).toLowerCase());
        const hasEmpaque = !!so.empaque;
        const rateEmpaque = ws ? Number(ws.desc_empaque ?? 0) : 0;

        totalEstimatedPayout += (plannedQty * rate) + (hasEmpaque ? plannedQty * rateEmpaque : 0);
        totalEarnedPayout += ((so.cantidad_confeccionada || 0) * rate) + (hasEmpaque ? (so.cantidad_confeccionada || 0) * rateEmpaque : 0);
      });

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '4rem' }}>
          
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#80082E', textTransform: 'uppercase' }}>Portal de Taller</span>
              <h1 style={{ fontSize: '1.75rem', fontWeight: '950', margin: '0.25rem 0 0', color: '#0f172a' }}>Mis Órdenes de Confección</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Listado total de órdenes de confección asignadas a tus talleres satélites.</p>
            </div>
            <div style={{ padding: '0.5rem 1.25rem', backgroundColor: '#f5f3ff', borderRadius: '12px', border: '1.5px solid #ddd6fe' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#80082E', textTransform: 'uppercase', display: 'block' }}>Taller Conectado</span>
              <strong style={{ fontSize: '0.95rem', color: '#1e1b4b', fontWeight: '900' }}>{userWorkshop?.nombre_taller || 'Taller satélite'}</strong>
            </div>
          </div>

          {/* Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #80082E', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '850', color: '#64748b', textTransform: 'uppercase' }}>Total de Lotes</span>
              <strong style={{ fontSize: '1.8rem', color: '#0f172a', fontWeight: '950' }}>{totalLotes}</strong>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Lotes registrados en sistema</span>
            </div>
            
            <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #3b82f6', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '850', color: '#64748b', textTransform: 'uppercase' }}>Prendas Totales</span>
              <strong style={{ fontSize: '1.8rem', color: '#0f172a', fontWeight: '950' }}>
                {totalCompletedUnits} <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: '700' }}>/ {totalPlannedUnits} uds</span>
              </strong>
              <div style={{ width: '100%', height: '6px', borderRadius: '999px', backgroundColor: '#f1f5f9', overflow: 'hidden', marginTop: '0.2rem' }}>
                <div style={{ width: `${totalPlannedUnits > 0 ? Math.round((totalCompletedUnits / totalPlannedUnits) * 100) : 0}%`, height: '100%', backgroundColor: '#3b82f6' }} />
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '850', color: '#64748b', textTransform: 'uppercase' }}>Est. Pago Total</span>
              <strong style={{ fontSize: '1.8rem', color: '#10b981', fontWeight: '950' }}>
                ${totalEstimatedPayout.toLocaleString('es-CO')}
              </strong>
              <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600' }}>
                Acumulado confeccionado: <strong style={{ color: '#059669' }}>${totalEarnedPayout.toLocaleString('es-CO')}</strong>
              </span>
            </div>
          </div>

          {/* Interactive Filters Panel */}
          <div className="card" style={{ padding: '1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '850', color: '#475569' }}>Buscar orden, cliente o prenda</label>
              <input
                type="text"
                placeholder="Ej. OC-105-1, Cliente, Camiseta..."
                value={sewingFilterSearch}
                onChange={e => setSewingFilterSearch(e.target.value)}
                style={{
                  padding: '0.55rem 0.85rem',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.85rem',
                  fontWeight: '600'
                }}
              />
            </div>

            <div style={{ width: '150px', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '850', color: '#475569' }}>Filtrar por Estado</label>
              <select
                value={sewingFilterStatus}
                onChange={e => setSewingFilterStatus(e.target.value)}
                style={{
                  padding: '0.55rem 0.85rem',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                <option value="all">🌐 Todos los estados</option>
                <option value="Enviado a Taller">Enviado a Taller</option>
                <option value="En Confección">En Confección</option>
                <option value="Enviado a Calidad">Enviado a Calidad</option>
                <option value="Terminada">Terminada</option>
                <option value="Enviada">Enviada</option>
              </select>
            </div>

            <div style={{ width: '140px', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '850', color: '#475569' }}>Fecha Inicio</label>
              <input
                type="date"
                value={sewingFilterStartDate}
                onChange={e => setSewingFilterStartDate(e.target.value)}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.85rem',
                  fontWeight: '600'
                }}
              />
            </div>

            <div style={{ width: '140px', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '850', color: '#475569' }}>Fecha Fin</label>
              <input
                type="date"
                value={sewingFilterEndDate}
                onChange={e => setSewingFilterEndDate(e.target.value)}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.85rem',
                  fontWeight: '600'
                }}
              />
            </div>

            {finalWorkshopsList.length > 1 && (
              <div style={{ width: '180px', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: '850', color: '#475569' }}>Seleccionar Taller</label>
                <select
                  value={activeWorkshopId}
                  onChange={e => setActiveWorkshopId(e.target.value)}
                  style={{
                    padding: '0.55rem 0.85rem',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    backgroundColor: 'white',
                    cursor: 'pointer'
                  }}
                >
                  <option value="all">🏭 Todos mis talleres</option>
                  {finalWorkshopsList.map(w => (
                    <option key={w.id} value={w.id}>{w.nombre_taller}</option>
                  ))}
                </select>
              </div>
            )}

            {(sewingFilterSearch || sewingFilterStatus !== 'all' || sewingFilterStartDate || sewingFilterEndDate || activeWorkshopId !== 'all') && (
              <button
                onClick={() => {
                  setSewingFilterSearch('');
                  setSewingFilterStatus('all');
                  setSewingFilterStartDate('');
                  setSewingFilterEndDate('');
                  setActiveWorkshopId('all');
                }}
                className="btn btn-secondary"
                style={{ alignSelf: 'flex-end', height: '38px', padding: '0.5rem 1rem', borderRadius: '10px', fontWeight: '800', fontSize: '0.8rem' }}
              >
                Limpiar Filtros
              </button>
            )}
          </div>

          {/* Sewing Orders Table */}
          <div className="card" style={{ padding: '2rem' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2.5px solid #f1f5f9', textAlign: 'left', color: '#64748b' }}>
                    {['Código Lote', 'Cliente', 'Referencia / Producto', 'Taller', 'Unidades (Progreso)', 'Tarifa Unidad', 'Pago Estimado', 'Estado', 'Acciones'].map(h => (
                      <th key={h} style={{ padding: '1rem', fontWeight: '800' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSewingOrdersForTab.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>
                        No se encontraron órdenes de confección con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : filteredSewingOrdersForTab.map(so => {
                    const parentOrder = orders.find(o => o.id === so.parent_order_id);
                    const clientName = parentOrder ? parentOrder.client_name : '—';
                    
                    const product = productsList.find(p => String(p.id) === String(so.product_id));
                    const productName = product ? product.nombre_producto : '—';
                    
                    const currentWs = workshops.find(w => String(w.id) === String(so.workshop_id));
                    const workshopName = currentWs ? currentWs.nombre_taller : '—';

                    const plannedQty = getSewingOrderTotalUnits(so);
                    const progress = plannedQty > 0 ? Math.round(((so.cantidad_confeccionada || 0) / plannedQty) * 100) : 0;

                    // Calculate rate and payout estimation
                    const finalRate = getSewingOrderRate(so, so.workshop_id);
                    const ws = workshops.find(w => String(w.id).toLowerCase() === String(so.workshop_id).toLowerCase());
                    const hasEmpaque = !!so.empaque;
                    const rateEmpaque = ws ? Number(ws.desc_empaque ?? 0) : 0;
                    
                    const estPayout = (plannedQty * finalRate) + (hasEmpaque ? plannedQty * rateEmpaque : 0);
                    const actPayout = ((so.cantidad_confeccionada || 0) * finalRate) + (hasEmpaque ? (so.cantidad_confeccionada || 0) * rateEmpaque : 0);

                    return (
                      <tr key={so.id} style={{ borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }}>
                        <td style={{ padding: '1rem', fontWeight: '850', color: '#80082E' }}>
                          {so.confeccion_code}
                        </td>
                        <td style={{ padding: '1rem', fontWeight: '700', color: '#1e293b' }}>
                          {clientName}
                        </td>
                        <td style={{ padding: '1rem', fontWeight: '600', color: '#475569' }}>
                          {productName}
                        </td>
                        <td style={{ padding: '1rem', fontWeight: '500', color: '#64748b' }}>
                          {workshopName}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span style={{ fontWeight: '800', color: '#0f172a' }}>
                              {so.cantidad_confeccionada || 0} / {plannedQty} uds
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100px' }}>
                              <div style={{ flex: 1, height: '4px', borderRadius: '999px', backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                                <div style={{ width: `${Math.min(progress, 100)}%`, height: '100%', backgroundColor: progress >= 100 ? '#10b981' : '#80082E' }} />
                              </div>
                              <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b' }}>{progress}%</span>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '1rem', fontWeight: '600', color: '#475569' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span>${finalRate.toLocaleString('es-CO')}</span>
                            {hasEmpaque && rateEmpaque > 0 && (
                              <span style={{ fontSize: '0.68rem', color: '#d97706', fontWeight: '700' }}>
                                + Empaque (+${rateEmpaque})
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <strong style={{ color: '#10b981', fontWeight: '800' }}>
                              ${estPayout.toLocaleString('es-CO')}
                            </strong>
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                              Logrado: ${actPayout.toLocaleString('es-CO')}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{
                            fontSize: '0.7rem', padding: '0.25rem 0.65rem', borderRadius: '8px', fontWeight: '800',
                            backgroundColor: 
                              so.status === 'En Confección' ? '#eff6ff' : 
                              (so.status === 'Enviado a Calidad' || so.status === 'Validación Calidad') ? '#fffbeb' :
                              so.status === 'Terminada' || so.status === 'Enviada' ? '#ecfdf5' : '#f1f5f9',
                            color: 
                              so.status === 'En Confección' ? '#1e4ed8' : 
                              (so.status === 'Enviado a Calidad' || so.status === 'Validación Calidad') ? '#b45309' :
                              so.status === 'Terminada' || so.status === 'Enviada' ? '#15803d' : '#475569',
                            border: 
                              so.status === 'En Confección' ? '1px solid #bfdbfe' : 
                              (so.status === 'Enviado a Calidad' || so.status === 'Validación Calidad') ? '1px solid #fef08a' :
                              so.status === 'Terminada' || so.status === 'Enviada' ? '1px solid #bbf7d0' : '1px solid #cbd5e1'
                          }}>
                            {so.status === 'Enviado a Calidad' || so.status === 'Validación Calidad' ? 'VALIDACIÓN CALIDAD' : so.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <button 
                              onClick={() => {
                                if (parentOrder) {
                                  setViewingOrderDetails({ 
                                    ...so, 
                                    parent_order: parentOrder
                                  });
                                }
                              }} 
                              style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.75rem', fontWeight: '800', color: '#80082E', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}
                            >
                              📄 Ficha
                            </button>

                            {so.status === 'Enviado a Taller' && (
                              <button
                                onClick={() => handleConfirmReceiptInWorkshop({ id: so.id, confeccion_code: so.confeccion_code })}
                                className="btn"
                                style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '0.3rem 0.5rem', borderRadius: '6px', fontSize: '0.68rem', fontWeight: '800', cursor: 'pointer' }}
                              >
                                📥 Recibir
                              </button>
                            )}

                            {so.status === 'En Confección' && (
                              <button
                                onClick={() => {
                                  // Set modal state immediately so it opens right away
                                  setSelectedSewingOrderForEnvio(so);
                                  setEnvioNotes('');
                                  setEnvioSinInconvenientes(false);
                                  setEnvioNovedadLines([]);
                                  setShowEnvioModal(true);
                                  // Load novelties in background (non-blocking)
                                  if (masterNovelties.length === 0) {
                                    supabase
                                      .from('novelties')
                                      .select('*')
                                      .order('cod_novedad')
                                      .then(({ data: novData }) => {
                                        setMasterNovelties(novData || []);
                                      });
                                  }
                                }}
                                className="btn"
                                style={{ backgroundColor: '#eab308', color: 'white', border: 'none', padding: '0.3rem 0.5rem', borderRadius: '6px', fontSize: '0.68rem', fontWeight: '800', cursor: 'pointer' }}
                              >
                                📤 Enviar Calidad
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {/* CONFIRMAR ENVÍO A CALIDAD MODAL */}
          {showEnvioModal && selectedSewingOrderForEnvio && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem' }}>
              <div style={{ width: '100%', maxWidth: '620px', maxHeight: '92vh', overflowY: 'auto', backgroundColor: 'white', borderRadius: '20px', boxShadow: '0 25px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>

                {/* Header */}
                <div style={{ padding: '1.5rem 1.75rem 1rem', borderBottom: '2px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'linear-gradient(135deg,#f59e0b,#d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>📤</div>
                      <h3 style={{ margin: 0, fontWeight: '950', color: '#0f172a', fontSize: '1.1rem' }}>Relación de Envío a Calidad</h3>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#80082E', backgroundColor: '#fdf2f8', padding: '0.2rem 0.6rem', borderRadius: '6px', border: '1px solid #fbcfe8' }}>
                        Lote: {selectedSewingOrderForEnvio.confeccion_code}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569', backgroundColor: '#f8fafc', padding: '0.2rem 0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        {selectedSewingOrderForEnvio.products?.nombre_producto || 'Producto'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowEnvioModal(false)}
                    style={{ border: 'none', background: '#f1f5f9', borderRadius: '8px', width: '34px', height: '34px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexShrink: 0 }}
                  >
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleConfirmEnvioToCalidad} style={{ padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>

                  {/* Product summary */}
                  <div style={{ backgroundColor: '#f8fafc', borderRadius: '12px', padding: '1rem', border: '1px solid #e2e8f0' }}>
                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resumen del lote</p>
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>Producto</p>
                        <p style={{ margin: 0, fontWeight: '800', fontSize: '0.88rem', color: '#0f172a' }}>{selectedSewingOrderForEnvio.products?.nombre_producto || '—'}</p>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>Unidades planeadas</p>
                        <p style={{ margin: 0, fontWeight: '800', fontSize: '0.88rem', color: '#0f172a' }}>{selectedSewingOrderForEnvio.cantidad_planeada || 0} uds</p>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>Confeccionadas</p>
                        <p style={{ margin: 0, fontWeight: '800', fontSize: '0.88rem', color: '#10b981' }}>{selectedSewingOrderForEnvio.cantidad_confeccionada || 0} uds</p>
                      </div>
                      {(selectedSewingOrderForEnvio.sewing_order_sizes || []).length > 0 && (
                        <div style={{ width: '100%' }}>
                          <p style={{ margin: '0 0 0.4rem', fontSize: '0.7rem', color: '#94a3b8' }}>Tallas</p>
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            {(selectedSewingOrderForEnvio.sewing_order_sizes || []).map((sz: any) => (
                              <span key={sz.id} style={{ fontSize: '0.7rem', fontWeight: '800', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                                {sz.sizes?.codigo_talla || sz.size_id}: {sz.cantidad_planeada}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick check — sin inconvenientes */}
                  <div
                    onClick={() => { setEnvioSinInconvenientes(p => !p); if (!envioSinInconvenientes) setEnvioNovedadLines([]); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.9rem 1.1rem', borderRadius: '12px', border: `2px solid ${envioSinInconvenientes ? '#10b981' : '#e2e8f0'}`, backgroundColor: envioSinInconvenientes ? '#ecfdf5' : '#f8fafc', cursor: 'pointer', userSelect: 'none', transition: 'all 0.18s' }}
                  >
                    <div style={{ width: '22px', height: '22px', borderRadius: '6px', border: `2px solid ${envioSinInconvenientes ? '#10b981' : '#cbd5e1'}`, backgroundColor: envioSinInconvenientes ? '#10b981' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.18s' }}>
                      {envioSinInconvenientes && <span style={{ color: 'white', fontSize: '0.8rem', fontWeight: '900' }}>✓</span>}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontWeight: '850', fontSize: '0.9rem', color: envioSinInconvenientes ? '#065f46' : '#1e293b' }}>✅ Sin inconvenientes — despacho conforme</p>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>Todas las prendas en orden, sin novedades que reportar.</p>
                    </div>
                  </div>

                  {/* Novelty lines per product */}
                  {!envioSinInconvenientes && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '1rem' }}>⚠️</span>
                          <span style={{ fontWeight: '850', fontSize: '0.88rem', color: '#0f172a' }}>Novedades por color / referencia</span>
                          {envioNovedadLines.filter(l => l.noveltyId).length > 0 && (
                            <span style={{ fontSize: '0.65rem', fontWeight: '800', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '999px', padding: '0.15rem 0.55rem' }}>
                              {envioNovedadLines.filter(l => l.noveltyId).length} registrada{envioNovedadLines.filter(l => l.noveltyId).length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setEnvioNovedadLines(prev => [...prev, { id: Date.now().toString(), noveltyId: '', color: '', nota: '' }])}
                          style={{ fontSize: '0.75rem', fontWeight: '800', color: '#80082E', backgroundColor: '#fdf2f8', border: '1px solid #fbcfe8', borderRadius: '8px', padding: '0.3rem 0.75rem', cursor: 'pointer' }}
                        >
                          + Agregar novedad
                        </button>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.73rem', color: '#64748b' }}>
                        Agrega una línea por cada novedad encontrada. Especifica el color o referencia afectada si aplica.
                      </p>

                      {envioNovedadLines.length === 0 && (
                        <div style={{ padding: '1.25rem', textAlign: 'center', backgroundColor: '#fafafa', borderRadius: '10px', border: '1px dashed #cbd5e1', fontSize: '0.8rem', color: '#94a3b8' }}>
                          Haz clic en <strong>+ Agregar novedad</strong> para registrar inconvenientes encontrados.
                        </div>
                      )}

                      {envioNovedadLines.map((line, idx) => (
                        <div key={line.id} style={{ backgroundColor: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: '12px', padding: '0.9rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#92400e' }}>NOVEDAD #{idx + 1}</span>
                            <button
                              type="button"
                              onClick={() => setEnvioNovedadLines(prev => prev.filter(l => l.id !== line.id))}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', fontSize: '0.8rem', fontWeight: '800', padding: '0.1rem 0.4rem' }}
                            >
                              ✕ Quitar
                            </button>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            <div style={{ gridColumn: '1 / -1' }}>
                              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#78350f', marginBottom: '0.25rem' }}>Tipo de novedad *</label>
                              <select
                                value={line.noveltyId}
                                onChange={e => setEnvioNovedadLines(prev => prev.map(l => l.id === line.id ? { ...l, noveltyId: e.target.value } : l))}
                                style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid #fde68a', fontSize: '0.8rem', fontWeight: '700', backgroundColor: 'white', color: '#1e293b' }}
                              >
                                <option value="">— Selecciona una novedad —</option>
                                {masterNovelties.length === 0 && (
                                  <option value="" disabled>Cargando novedades...</option>
                                )}
                                {masterNovelties
                                  .filter(nov => !nov.modulo_relac || nov.modulo_relac.toLowerCase().includes('taller'))
                                  .map(nov => (
                                    <option key={nov.id} value={String(nov.id)}>
                                      [{nov.cod_novedad}] {nov.nombre}{nov.criticidad ? ` · ${nov.criticidad}` : ''}
                                    </option>
                                  ))}
                              </select>
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#78350f', marginBottom: '0.25rem' }}>Color / Referencia</label>
                              <input
                                type="text"
                                placeholder="Ej: Azul Rey, Rojo Tinto..."
                                value={line.color}
                                onChange={e => setEnvioNovedadLines(prev => prev.map(l => l.id === line.id ? { ...l, color: e.target.value } : l))}
                                style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid #fde68a', fontSize: '0.8rem', backgroundColor: 'white', boxSizing: 'border-box' }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#78350f', marginBottom: '0.25rem' }}>Detalle adicional</label>
                              <input
                                type="text"
                                placeholder="Cantidad, descripción..."
                                value={line.nota}
                                onChange={e => setEnvioNovedadLines(prev => prev.map(l => l.id === line.id ? { ...l, nota: e.target.value } : l))}
                                style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid #fde68a', fontSize: '0.8rem', backgroundColor: 'white', boxSizing: 'border-box' }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* General observations */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '800', marginBottom: '0.4rem', color: '#334155' }}>📝 Observaciones generales (opcional)</label>
                    <textarea
                      placeholder="Información adicional del despacho, faltantes, acuerdos..."
                      value={envioNotes}
                      onChange={e => setEnvioNotes(e.target.value)}
                      style={{ width: '100%', minHeight: '75px', padding: '0.625rem 0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.83rem', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowEnvioModal(false)}
                      style={{ flex: 1, padding: '0.8rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', backgroundColor: 'white', color: '#475569', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={savingEnvio}
                      style={{ flex: 2, padding: '0.8rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: 'white', fontWeight: '900', fontSize: '0.9rem', cursor: savingEnvio ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: savingEnvio ? 0.75 : 1 }}
                    >
                      {savingEnvio ? '⏳ Enviando...' : '📤 Confirmar Envío a Calidad'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Payments tab inside Taller view
    if (currentTab === 'payments') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#80082E', textTransform: 'uppercase' }}>Portal de Taller</span>
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
                        <td style={{ padding: '1rem', fontWeight: '800', color: '#80082E' }}>{orderCode}</td>
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
    total:      { title: 'Todas las Órdenes',    subtitle: 'Resumen general',     orders,           accentColor: '#80082E' },
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
          {(() => {
            const theme = {
              bg: darkMode ? '#0f172a' : '#f8fafc',
              cardBg: darkMode ? '#1e293b' : '#ffffff',
              text: darkMode ? '#f8fafc' : '#0f172a',
              textMuted: darkMode ? '#94a3b8' : '#64748b',
              border: darkMode ? '#334155' : '#cbd5e1',
              primary: '#80082E',
              secondary: '#D81B60',
              gridColor: darkMode ? '#334155' : '#f1f5f9',
              accent: '#ff9800',
              success: '#10b981',
              danger: '#ef4444'
            };

            // ── CÁLCULO DE VALORES REALES DESDE LA BASE DE DATOS ──
            
            // 1. Stock Real de Tela Consolidado (fabricsList)
            const totalFabricStockMetres = fabricsList.reduce((sum, f) => sum + (Number(f.stock) || 0), 0);

            // Resuelve la tarifa de confección de una orden basado en su categoría
            const getOrderRateGeneric = (orderId: string) => {
              const orderObj = orders.find(o => o.id === orderId);
              if (!orderObj || !orderObj.cuts || orderObj.cuts.length === 0) return 4500;
              const cut = orderObj.cuts[0];
              const prod = productsList.find(p => String(p.id) === String(cut.product_id));
              const categoryObj = prod ? categories.find(c => String(c.id) === String(prod.category_id)) : null;
              if (!categoryObj) return 4500;
              return categoryObj.base_rate || 4500;
            };

            // 2. Saldo Real Liquidado por prendas APROBADAS en Calidad
            let realApprovedPayout = 0;
            inspections.forEach(insp => {
              const itemRate = getOrderRateGeneric(insp.order_id);
              realApprovedPayout += (insp.items_approved || 0) * itemRate;
            });

            // 3. Tasa de Rechazo de Calidad Real Consolidada (quality_inspections)
            const totalInspectedItems = inspections.reduce((sum, i) => sum + (Number(i.items_inspected) || 0), 0);
            const totalRejectedItems = inspections.reduce((sum, i) => sum + (Number(i.items_rejected) || 0), 0);
            const qualityRejectionRate = totalInspectedItems > 0 ? ((totalRejectedItems / totalInspectedItems) * 100).toFixed(1) : '0.0';

            // 4. Metraje de Tela consumido en tendidos reales
            let totalMetresConsumed = 0;
            orders.forEach(o => {
              (o.cuts || []).forEach(cut => {
                const layers = cut.layers_produced || 0;
                const length = Number(cut.length) || 0;
                totalMetresConsumed += layers * length;
              });
            });

            const calculatedEfficiency = total > 0 ? Math.round((cortadas.length / total) * 100) : 0;

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', backgroundColor: theme.bg, color: theme.text, transition: 'all 0.3s ease' }}>
                
                {/* 1. Switch de Modo Oscuro en Cabecera de Módulo */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.cardBg, padding: '1rem 1.5rem', borderRadius: '14px', border: `1px solid ${theme.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', animation: 'pulse 1.5s infinite' }}></div>
                    <span style={{ fontSize: '0.8rem', fontWeight: '800', color: theme.textMuted }}>ERP Central Conectado en Tiempo Real</span>
                  </div>
                  <button
                    onClick={() => setDarkMode(!darkMode)}
                    style={{
                      padding: '0.45rem 1rem',
                      borderRadius: '8px',
                      border: `1.5px solid ${theme.border}`,
                      fontSize: '0.75rem',
                      fontWeight: '800',
                      backgroundColor: theme.cardBg,
                      color: theme.text,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    {darkMode ? '☀️ Modo Claro' : '🌙 Modo Oscuro'}
                  </button>
                </div>

                {/* 2. Stat Cards con Sparklines Premium */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                  
                  {/* Card 1: Stock de Tela Real */}
                  <div className="card" style={{ position: 'relative', overflow: 'hidden', padding: '1.25rem 1.5rem', border: `1px solid ${theme.border}`, backgroundColor: theme.cardBg, color: theme.text }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <div>
                        <p style={{ fontSize: '0.7rem', fontWeight: '800', color: theme.textMuted, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stock de Tela</p>
                        <h3 style={{ fontSize: '2rem', fontWeight: '950', margin: '0.25rem 0', color: theme.text }}>{loading ? '…' : `${totalFabricStockMetres.toLocaleString('es-CO')} m`}</h3>
                        <p style={{ fontSize: '0.72rem', color: '#3b82f6', margin: 0, fontWeight: '700' }}>Disponible en inventario</p>
                      </div>
                      <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Package size={18} />
                      </div>
                    </div>
                    <SparklineWave color="#3b82f6" path="M0,22 Q25,8 50,18 T100,8" />
                  </div>

                  {/* Card 2: Saldo Real Confección */}
                  <div className="card" style={{ position: 'relative', overflow: 'hidden', padding: '1.25rem 1.5rem', border: `1px solid ${theme.border}`, backgroundColor: theme.cardBg, color: theme.text }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <div>
                        <p style={{ fontSize: '0.7rem', fontWeight: '800', color: theme.textMuted, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saldo Real Confeccionado</p>
                        <h3 style={{ fontSize: '1.6rem', fontWeight: '950', margin: '0.25rem 0', color: theme.success }}>{loading ? '…' : `$${Math.round(realApprovedPayout).toLocaleString('es-CO')}`}</h3>
                        <p style={{ fontSize: '0.72rem', color: theme.success, margin: 0, fontWeight: '700' }}>Aprobado en Control de Calidad</p>
                      </div>
                      <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: `${theme.success}15`, color: theme.success, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CheckCircle2 size={18} />
                      </div>
                    </div>
                    <SparklineWave color={theme.success} path="M0,20 Q30,5 60,25 T100,10" />
                  </div>

                  {/* Card 3: Metraje Consumido */}
                  <div className="card" style={{ position: 'relative', overflow: 'hidden', padding: '1.25rem 1.5rem', border: `1px solid ${theme.border}`, backgroundColor: theme.cardBg, color: theme.text }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <div>
                        <p style={{ fontSize: '0.7rem', fontWeight: '800', color: theme.textMuted, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tela Consumida</p>
                        <h3 style={{ fontSize: '2rem', fontWeight: '950', margin: '0.25rem 0', color: theme.primary }}>{loading ? '…' : `${Math.round(totalMetresConsumed).toLocaleString('es-CO')} m`}</h3>
                        <p style={{ fontSize: '0.72rem', color: theme.primary, margin: 0, fontWeight: '700' }}>Consumidos en mesa de corte</p>
                      </div>
                      <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: `${theme.primary}15`, color: theme.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Scissors size={18} />
                      </div>
                    </div>
                    <SparklineWave color={theme.primary} path="M0,15 Q30,25 60,10 T100,20" />
                  </div>

                  {/* Card 4: Rechazo Calidad */}
                  <div className="card" style={{ position: 'relative', overflow: 'hidden', padding: '1.25rem 1.5rem', border: `1px solid ${theme.border}`, backgroundColor: theme.cardBg, color: theme.text }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <div>
                        <p style={{ fontSize: '0.7rem', fontWeight: '800', color: theme.textMuted, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tasa de Defectos (Calidad)</p>
                        <h3 style={{ fontSize: '2rem', fontWeight: '950', margin: '0.25rem 0', color: Number(qualityRejectionRate) > 5 ? theme.danger : theme.success }}>{loading ? '…' : `${qualityRejectionRate}%`}</h3>
                        <p style={{ fontSize: '0.72rem', color: theme.textMuted, margin: 0, fontWeight: '700' }}>Meta tolerada: &lt; 5%</p>
                      </div>
                      <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: `${Number(qualityRejectionRate) > 5 ? theme.danger : theme.success}15`, color: Number(qualityRejectionRate) > 5 ? theme.danger : theme.success, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <AlertCircle size={18} />
                      </div>
                    </div>
                    <SparklineWave color={Number(qualityRejectionRate) > 5 ? theme.danger : theme.success} path="M0,25 Q20,10 50,22 T100,12" />
                  </div>
                </div>

                {/* 3. Sección de Analítica y Distribución Corporativa */}
                <div style={{ display: 'grid', gridTemplateColumns: '7fr 3fr', gap: '2rem' }}>
                  
                  {/* Gráfico Bar Chart de Órdenes por Mes */}
                  <div style={{
                    backgroundColor: theme.cardBg,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '20px',
                    padding: '1.5rem 1.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                  }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '900', color: theme.text }}>Flujo de Órdenes por Mes</h3>
                      <span style={{ fontSize: '0.72rem', color: theme.textMuted }}>Volumen mensual de órdenes creadas en planta.</span>
                    </div>

                    <div style={{ width: '100%', height: '240px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={barData.length > 0 ? barData : [{ name: 'Sin datos', value: 0 }]}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.gridColor} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: theme.textMuted, fontSize: 10, fontWeight: 700 }} />
                          <YAxis stroke={theme.textMuted} fontSize={10} tickLine={false} />
                          <Tooltip contentStyle={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.text }} />
                          <Bar dataKey="value" fill={theme.primary} radius={[4, 4, 0, 0]} barSize={25} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Gráfico Circular de Estado de Órdenes */}
                  <div style={{
                    backgroundColor: theme.cardBg,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '20px',
                    padding: '1.5rem 1.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1rem'
                  }}>
                    <div style={{ alignSelf: 'flex-start', width: '100%' }}>
                      <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '900', color: theme.text }}>Estados de Corte</h3>
                      <span style={{ fontSize: '0.72rem', color: theme.textMuted }}>Distribución física actual</span>
                    </div>

                    <div style={{ height: '150px', width: '100%', position: 'relative' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%" cy="50%"
                            innerRadius={45} outerRadius={65}
                            paddingAngle={3} dataKey="value"
                          >
                            {pieData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.text }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
                        <p style={{ fontSize: '1.4rem', fontWeight: '950', margin: 0, color: theme.text }}>{total}</p>
                        <p style={{ fontSize: '0.55rem', color: theme.textMuted, margin: 0, fontWeight: '700', textTransform: 'uppercase' }}>Total</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%' }}>
                      {pieData.map((entry, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS[i] }} />
                            <span style={{ color: theme.textMuted, fontWeight: '600' }}>{entry.name}</span>
                          </div>
                          <span style={{ fontWeight: '800', color: theme.text }}>{entry.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4. Tabla de Alertas Operativas Críticas */}
                <div style={{
                  backgroundColor: theme.cardBg,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '20px',
                  padding: '1.5rem 1.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '900', color: theme.text }}>Panel de Control Operativo y Alertas de Planta</h3>
                    <span style={{ fontSize: '0.72rem', color: theme.textMuted }}>Alertas sugeridas y desvíos de material</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {/* Alerta 1: Órdenes en cola */}
                    {pendientes.length > 5 && (
                      <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', borderLeft: `4px solid ${theme.accent}`, backgroundColor: `${theme.accent}08`, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <AlertCircle size={16} color={theme.accent} />
                        <span style={{ fontSize: '0.78rem', fontWeight: '600' }}>Cuello de Botella en Mesa de Corte: <strong>{pendientes.length} órdenes en cola</strong> esperando ser procesadas.</span>
                      </div>
                    )}

                    {/* Alerta 2: Eficiencia de calidad global */}
                    {total > 0 && calculatedEfficiency < 40 && (
                      <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', borderLeft: `4px solid ${theme.danger}`, backgroundColor: `${theme.danger}08`, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <AlertCircle size={16} color={theme.danger} />
                        <span style={{ fontSize: '0.78rem', fontWeight: '600' }}>Atención: La tasa de cortes completados está por debajo del promedio semanal esperado ({calculatedEfficiency}%).</span>
                      </div>
                    )}

                    {/* Alerta general de WebSocket Simulator */}
                    {liveNotifications.slice(0, 2).map(noti => (
                      <div key={noti.id} style={{ padding: '0.75rem 1rem', borderRadius: '8px', borderLeft: `4px solid #3b82f6`, backgroundColor: `${darkMode ? '#0f172a' : '#f0fdf4'}08`, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.8rem' }}>⚡</div>
                        <span style={{ fontSize: '0.78rem', fontWeight: '600', color: theme.text }}>Feed del Sistema: {noti.msg}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 5. Últimas Órdenes de Corte */}
                <div style={{
                  backgroundColor: theme.cardBg,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '20px',
                  padding: '1.5rem 1.75rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '900', color: theme.text }}>Últimas Órdenes de Corte</h3>
                      <span style={{ fontSize: '0.72rem', color: theme.textMuted }}>Monitoreo de flujo de trabajo de las 5 órdenes más recientes</span>
                    </div>
                    <Link href="/cutting" style={{ fontSize: '0.75rem', fontWeight: '800', color: theme.primary, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      Ver mesa de tendido <ArrowUpRight size={14} />
                    </Link>
                  </div>

                  {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ height: '35px', width: '100%', borderRadius: '6px', background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 37%, #f1f5f9 63%)', backgroundSize: '400% 100%', animation: 'shimmer 1.4s ease infinite' }}></div>
                      <div style={{ height: '35px', width: '90%', borderRadius: '6px', background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 37%, #f1f5f9 63%)', backgroundSize: '400% 100%', animation: 'shimmer 1.4s ease infinite' }}></div>
                    </div>
                  ) : orders.length === 0 ? (
                    <p style={{ color: theme.textMuted, textAlign: 'center', padding: '2rem', fontSize: '0.85rem' }}>No hay órdenes aún.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      {orders.slice(0, 5).map(order => {
                        const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG['Planeada'];
                        return (
                          <Link key={order.id} href={`/cutting/${order.id}`} style={{ textDecoration: 'none' }}>
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: '1rem',
                              padding: '0.85rem 1.1rem', borderRadius: '10px',
                              border: `1.5px solid ${theme.border}`, backgroundColor: theme.bg,
                              cursor: 'pointer', transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={e => {
                              (e.currentTarget as HTMLElement).style.borderColor = theme.primary;
                            }}
                            onMouseLeave={e => {
                              (e.currentTarget as HTMLElement).style.borderColor = theme.border;
                            }}
                            >
                              <div style={{ width: '36px', height: '36px', borderRadius: '999px', backgroundColor: `${theme.primary}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Scissors size={16} color={theme.primary} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ fontWeight: '800', fontSize: '0.875rem', color: theme.text }}>
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
                                <p style={{ margin: 0, fontSize: '0.72rem', color: theme.textMuted, fontWeight: '600', marginTop: '0.15rem' }}>
                                  {order.cortador_name ? `✂ ${order.cortador_name}` : 'Sin cortador asignado'}
                                  {order.scheduled_date && ` · 📅 ${order.scheduled_date}`}
                                </p>
                              </div>
                              <Clock size={14} color={theme.textMuted} style={{ flexShrink: 0 }} />
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            );
          })()}
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
                totalPrendasProyectadas += getSewingOrderTotalUnits(so);
              });

              const wsInsps = inspections.filter(i => 
                (i.workshop_name || '').toLowerCase().trim() === (currentWs.nombre_taller || '').toLowerCase().trim()
              );
              wsInsps.forEach(i => {
                totalPrendasEntregadas += (i.items_approved || 0);
              });
            });

            // Paginación
            const itemsPerPageParam = companyParams?.find((p: any) => p.name === 'pos_page_size')?.value;
            const itemsPerPage = itemsPerPageParam ? (parseInt(itemsPerPageParam) || 15) : 15;
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
                  <div className="card" style={{ padding: '1.5rem', borderLeft: '5px solid #80082E', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prendas Planeadas vs Cortadas</span>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: '950', margin: '0.2rem 0', color: '#1e293b' }}>
                      {totalRl.toLocaleString('es-CO')} <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '600' }}>/ {totalPl.toLocaleString('es-CO')} uds</span>
                    </h3>
                    <p style={{ fontSize: '0.74rem', color: totalRl >= totalPl ? '#10b981' : '#ef4444', margin: 0, fontWeight: '800' }}>
                      Eficiencia Corte: {totalPl > 0 ? (totalRl / totalPl * 100).toFixed(1) : '0'}%
                    </p>
                  </div>

                  {/* Card 2: Confeccionadas vs Proyectadas */}
                  <div className="card" style={{ padding: '1.5rem', borderLeft: '5px solid #D81B60', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Proyectado vs Entregado Satélite</span>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: '950', margin: '0.2rem 0', color: '#1e293b' }}>
                      {totalPrendasEntregadas.toLocaleString('es-CO')} <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '600' }}>/ {totalPrendasProyectadas.toLocaleString('es-CO')} uds</span>
                    </h3>
                    <p style={{ fontSize: '0.74rem', color: '#D81B60', margin: 0, fontWeight: '800' }}>
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
                  <div className="card" style={{ padding: '1.5rem', borderLeft: '5px solid #a8325c', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
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
                          <Bar dataKey="planeado" fill="#a8325c" radius={[4, 4, 0, 0]} name="Planeado" />
                          <Bar dataKey="real" fill="#80082E" radius={[4, 4, 0, 0]} name="Ejecutado" />
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
                          <Line type="monotone" dataKey="planeado" stroke="#a8325c" strokeWidth={3} dot={{ r: 4 }} name="Planeado" />
                          <Line type="monotone" dataKey="real" stroke="#80082E" strokeWidth={3} dot={{ r: 4 }} name="Ejecutado" />
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
                      <span style={{ fontSize: '0.65rem', fontWeight: '700', color: '#80082E', backgroundColor: '#fdf2f4', padding: '2px 8px', borderRadius: '20px', marginLeft: '0.25rem' }}>uds reales</span>
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {topCategories.length === 0 ? (
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem' }}>Sin datos de categorías.</p>
                      ) : topCategories.map((item, idx) => {
                        const catColors = ['#80082E','#9b1247','#a8325c','#D81B60','#c2185b','#e91e63','#ad1457','#880e4f','#b71c5c','#a8325c'];
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
                              <td style={{ padding: '0.85rem 1.25rem', fontWeight: '900', color: '#80082E' }}>{row.code}</td>
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
            const getAssignmentsFromJson = (order: any) => {
              if (!order || !order.observaciones) return null;
              const match = order.observaciones.match(/<!--ASSIGNMENTS_JSON:([\s\S]*?)-->/);
              if (match && match[1]) {
                try {
                  return JSON.parse(match[1]);
                } catch (e) {
                  return null;
                }
              }
              return null;
            };

            const getAssignmentsData = (order: any) => {
              if (!order) return { rowWorkshops: {}, cutAccessories: {}, prepNotes: '', workshopNotes: '', deliveryDate: '' };
              
              let rawAss: any = null;
              if (order.dbAssignments) {
                rawAss = order.dbAssignments;
              } else {
                rawAss = getAssignmentsFromJson(order);
              }

              if (rawAss) {
                const rowWorkshops: Record<string, string> = {};
                if (rawAss.rowWorkshops) {
                  Object.entries(rawAss.rowWorkshops).forEach(([key, wId]) => {
                    rowWorkshops[key] = String(wId);
                    const parts = key.split('_');
                    if (parts.length >= 2) {
                      const idPart = parts[0];
                      const sizePart = parts.slice(1).join('_');
                      
                      const matchingProducts = productsList.filter(p => String(p.category_id) === String(idPart));
                      matchingProducts.forEach(p => {
                        rowWorkshops[`${p.id}_${sizePart}`] = String(wId);
                      });
                    }
                  });
                }
                return {
                  ...rawAss,
                  rowWorkshops
                };
              }

              // Fallback: assign everything to order.workshop_id
              const rowWorkshops: Record<string, string> = {};
              if (order && order.cuts) {
                order.cuts.forEach((cut: any) => {
                  const prod = productsList.find(p => String(p.id) === String(cut.product_id));
                  const catId = prod ? String(prod.id) : 'sin_prod';
                  
                  (cut.cut_sizes || []).forEach((cs: any) => {
                    const sizeObj = sizesList.find(s => String(s.id) === String(cs.size_id));
                    const sz = sizeObj ? sizeObj.codigo_talla : 'S/T';
                    const cellKey = `${catId}_${sz}`;
                    rowWorkshops[cellKey] = String(order.workshop_id || '');
                  });
                });
              }

              return {
                rowWorkshops,
                cutAccessories: {},
                prepNotes: 'Orden anterior (previa a actualización).',
                workshopNotes: 'Sin notas adicionales.',
                deliveryDate: order.fecha_entrega || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
              };
            };

            const getSewingOrderTotalUnits = (so: any) => {
              if (!so.parent_order) return so.cantidad_planeada || 0;
              const dataAss = getAssignmentsData(so.parent_order);
              const rowWorkshopsMap = dataAss?.rowWorkshops || {};
              let total = 0;
              
              (so.parent_order.cuts || []).forEach((cut: any) => {
                const targetProdId = cut.product_id;
                if (String(targetProdId) !== String(so.product_id)) return;
                
                const layersProyec = cut.layers || 1;
                const layersProduced = cut.layers_produced || 0;
                
                (cut.cut_sizes || []).forEach((cs: any) => {
                  const sizeObj = sizesList.find(s => String(s.id) === String(cs.size_id));
                  const sz = sizeObj ? sizeObj.codigo_talla : 'S/T';
                  const cellKey = `${targetProdId}_${sz}`;
                  const assignedWId = rowWorkshopsMap[cellKey];
                  
                  if (!assignedWId || String(assignedWId) !== String(so.workshop_id)) return;
                  
                  let realQty = 0;
                  if (cs.quantity_produced !== undefined && cs.quantity_produced !== null) {
                    realQty = Number(cs.quantity_produced);
                  } else {
                    const proyecQty = Number(cs.quantity) || 0;
                    const ppc = layersProyec > 0 ? proyecQty / layersProyec : 0;
                    realQty = Math.round(ppc * layersProduced);
                  }
                  if (realQty > 0) {
                    total += realQty;
                  }
                });
              });
              
              return total || so.cantidad_planeada || 0;
            };

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
              const plannedQty = getSewingOrderTotalUnits(so);
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
            const limitParam = companyParams?.find((p: any) => p.name === 'pos_page_size')?.value;
            const limit = limitParam ? (parseInt(limitParam) || 15) : 15;
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
                            <Bar dataKey="estimado" name="Valor Estimado" fill="#a8325c" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="real" name="Valor Real Aprobado" fill="#80082E" radius={[4, 4, 0, 0]} />
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
                                <td style={{ padding: '0.8rem', fontWeight: '750', color: '#80082E' }}>
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
                                      <span style={{ fontSize: '0.62rem', fontWeight: '800', backgroundColor: '#fdf2f4', color: '#80082E', padding: '0.1rem 0.3rem', borderRadius: '4px', border: '1px solid #f5c6d0' }}>
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
