'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  TrendingUp,
  FileText,
  Package,
  Layers,
  Scissors,
  Users,
  DollarSign,
  Activity,
  RefreshCw,
  CheckCircle,
  BadgePercent,
  XCircle,
  Search,
  ChevronUp,
  ChevronDown,
  Download,
  ShoppingBag,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  X as IconX
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

// ─────── helpers ───────
const fmt = (n: number) => n.toLocaleString('es-CO');
const fmtCOP = (n: number) => `$${fmt(n)}`;

// ─────── tipos ───────
type RiskLevel = 'Bajo' | 'Medio' | 'Alto';

interface Customer {
  id: string;
  siigo_id: string;
  identification: string;
  name: string;
  person_type: string;
  email: string;
  phone: string;
  city_name: string;
  state_name: string;
  vendedor_name: string;
  cupo_credito: number;
  saldo_mora: number;
  riesgo: RiskLevel;
  rotacion: string;
  updated_at: string;
}

interface Invoice {
  id: string;
  siigo_id: string;
  consecutive: string;
  date: string;
  customer_identification: string;
  total: number;
  observations: string;
  status_dian: string;
  cufe: string;
  items: any[];
  payments: any[];
  siigo_customers?: {
    name: string;
    city_name: string;
    state_name: string;
    vendedor_name: string;
    riesgo: RiskLevel;
    cupo_credito: number;
    saldo_mora: number;
  };
}

// ─────── componente Principal ───────
export default function FinancialControlCenter() {
  const [activeMenu, setActiveMenu] = useState<'dashboard' | 'crm' | 'trazabilidad' | 'costos' | 'satelites' | 'ventas'>('dashboard');

  // ── Estado de Ventas ──
  const [salesData,      setSalesData]      = useState<Invoice[]>([]);
  const [salesLoading,   setSalesLoading]   = useState(false);
  const [salesSummary,   setSalesSummary]   = useState<any>(null);
  const [salesPagination,setSalesPagination]= useState({ page:1, perPage:20, totalRows:0, totalPages:0 });
  const [salesFilters,   setSalesFilters]   = useState({
    q: '', custId: '', dateStart: '', dateEnd: '', minTotal: '', maxTotal: ''
  });
  const [salesSort,      setSalesSort]      = useState<{ by: string; asc: boolean }>({ by: 'date', asc: false });
  const [salesDetail,    setSalesDetail]    = useState<Invoice | null>(null);
  const [showFilters,    setShowFilters]    = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Datos
  const [kpis, setKpis] = useState<any>(null);
  const [satellites, setSatellites] = useState<any[]>([]);
  const [costs, setCosts] = useState<any>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Estados de carga
  const [loading, setLoading] = useState(true);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string; synced?: any } | null>(null);

  // CRM
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Customer | null>(null);
  const [clientInvoices, setClientInvoices] = useState<Invoice[]>([]);

  // Trazabilidad
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // ─── fetch financiero (KPIs) ───
  const fetchFinancialData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/siigo/financial/metrics');
      const data = await res.json();
      if (!data.error) {
        setKpis(data.kpis);
        setSatellites(data.satelites || []);
        setCosts(data.costosBreakdown);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── fetch clientes locales ───
  const fetchCustomers = useCallback(async (q = '') => {
    setLoadingCustomers(true);
    try {
      const res = await fetch(`/api/siigo/financial/customers?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } finally {
      setLoadingCustomers(false);
    }
  }, []);

  // ─── fetch facturas locales (dashboard/trazabilidad) ───
  const fetchInvoices = useCallback(async (q = '') => {
    setLoadingInvoices(true);
    try {
      const res = await fetch(`/api/siigo/financial/invoices?q=${encodeURIComponent(q)}&per_page=8`);
      const data = await res.json();
      setInvoices(data.data ?? (Array.isArray(data) ? data : []));
    } finally {
      setLoadingInvoices(false);
    }
  }, []);

  // ─── fetch ventas paginado ───
  const fetchSales = useCallback(async (
    filters = salesFilters,
    page    = salesPagination.page,
    sort    = salesSort
  ) => {
    setSalesLoading(true);
    try {
      const p = new URLSearchParams({
        q:          filters.q,
        customer_identification: filters.custId,
        date_start: filters.dateStart,
        date_end:   filters.dateEnd,
        min_total:  filters.minTotal,
        max_total:  filters.maxTotal,
        page:       String(page),
        per_page:   String(salesPagination.perPage),
        sort_by:    sort.by,
        sort_order: sort.asc ? 'asc' : 'desc'
      });
      const res  = await fetch(`/api/siigo/financial/invoices?${p}`);
      const json = await res.json();
      setSalesData(json.data || []);
      setSalesSummary(json.summary || null);
      setSalesPagination(prev => ({ ...prev, page, ...(json.pagination || {}) }));
    } finally {
      setSalesLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSalesFilterChange = (field: string, value: string) => {
    const next = { ...salesFilters, [field]: value };
    setSalesFilters(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSales(next, 1, salesSort), 450);
  };

  const handleSalesSort = (by: string) => {
    const next = { by, asc: salesSort.by === by ? !salesSort.asc : false };
    setSalesSort(next);
    fetchSales(salesFilters, 1, next);
  };

  const clearSalesFilters = () => {
    const empty = { q: '', custId: '', dateStart: '', dateEnd: '', minTotal: '', maxTotal: '' };
    setSalesFilters(empty);
    fetchSales(empty, 1, salesSort);
  };

  const exportCSV = () => {
    const header = 'Consecutivo,Fecha,Cliente,NIT,Total,Estado DIAN\n';
    const rows   = salesData.map(i =>
      `${i.consecutive},${i.date},"${i.siigo_customers?.name || i.customer_identification}",${i.customer_identification},${i.total},"${i.status_dian || 'Aceptado DIAN'}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `ventas_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // ─── fetch facturas por cliente ───
  const fetchClientInvoices = async (identification: string) => {
    const res = await fetch(`/api/siigo/financial/invoices?customer_identification=${identification}`);
    const data = await res.json();
    setClientInvoices(Array.isArray(data) ? data : []);
  };

  // ─── sincronizar desde SIIGO (Background Polling) ───
  const runSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/siigo/financial/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSyncResult({ success: true, message: 'Sincronización masiva iniciada en segundo plano...' });
        pollSyncProgress();
      } else {
        setSyncResult({ success: false, message: data.message || 'Error al iniciar' });
        setSyncing(false);
      }
    } catch (e: any) {
      setSyncResult({ success: false, message: e.message });
      setSyncing(false);
    }
  };

  const pollSyncProgress = async () => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/siigo/financial/sync');
        const progress = await res.json();
        
        if (progress.isSyncRunning) {
          setSyncResult({
            success: true,
            message: `Sincronizando: ${progress.status === 'syncing_customers' ? 'Clientes' : 'Facturas'} (Pág. ${progress.currentPage})`,
            synced: {
              customers: progress.customersProcessed,
              invoices: progress.invoicesProcessed
            }
          });
        } else {
          clearInterval(interval);
          setSyncing(false);
          if (progress.status === 'completed') {
            setSyncResult({
              success: true,
              message: '¡Sincronización masiva completada!',
              synced: {
                customers: progress.customersProcessed,
                invoices: progress.invoicesProcessed
              }
            });
            fetchCustomers();
            fetchInvoices();
            fetchFinancialData();
          } else if (progress.status === 'error') {
            setSyncResult({ success: false, message: `Error: ${progress.error}` });
          }
        }
      } catch (err) {
        console.error('Error polling sync progress:', err);
      }
    }, 2000);
  };

  useEffect(() => {
    fetchFinancialData();
    fetchCustomers();
    fetchInvoices();
    // Validar si ya hay una sync corriendo al montar
    fetch('/api/siigo/financial/sync')
      .then(res => res.json())
      .then(prog => {
        if (prog.isSyncRunning) {
          setSyncing(true);
          pollSyncProgress();
        }
      }).catch(() => {});
  }, [fetchFinancialData, fetchCustomers, fetchInvoices]);

  const filteredCustomers = customers.filter(c =>
    !searchTerm ||
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.identification?.includes(searchTerm)
  );

  // ─────── RENDER ───────
  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif", backgroundColor: '#0f172a', color: '#f1f5f9' }}>

      {/* ── MENÚ LATERAL ── */}
      <aside style={{ width: '260px', flexShrink: 0, backgroundColor: '#1e293b', borderRight: '1px solid #334155', padding: '2rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 900, background: 'linear-gradient(135deg,#6366f1,#3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
            BRAINER ERP
          </h2>
          <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Financial Control Center
          </span>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {([
            { key: 'dashboard',    icon: <Activity size={16} />,     label: 'War Room Gerencial' },
            { key: 'ventas',       icon: <ShoppingBag size={16} />,  label: 'Ventas & Facturación' },
            { key: 'crm',          icon: <Users size={16} />,        label: 'CRM & Clientes' },
            { key: 'trazabilidad', icon: <FileText size={16} />,     label: 'Trazabilidad 360°' },
            { key: 'costos',       icon: <BadgePercent size={16} />, label: 'Margen & Utilidad' },
            { key: 'satelites',    icon: <Scissors size={16} />,     label: 'Dashboard Satélites' }
          ] as const).map(({ key, icon, label }) => (
            <button
              key={key}
              onClick={() => {
                setActiveMenu(key);
                if (key === 'crm') setSelectedClient(null);
                if (key === 'ventas') fetchSales(salesFilters, 1, salesSort);
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.7rem 0.9rem',
                borderRadius: '8px', border: 'none',
                backgroundColor: activeMenu === key ? '#4f46e5' : 'transparent',
                color: 'white', fontWeight: 700, cursor: 'pointer', textAlign: 'left', fontSize: '0.82rem',
                transition: 'background 0.15s'
              }}
            >
              {icon} {label}
            </button>
          ))}
        </nav>

        {/* ── Botón de SINCRONIZACIÓN ── */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button
            onClick={runSync}
            disabled={syncing}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              backgroundColor: syncing ? '#334155' : '#059669', color: 'white', border: 'none',
              borderRadius: '8px', padding: '0.7rem 1rem', fontSize: '0.8rem', fontWeight: 700, cursor: syncing ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <RefreshCw size={15} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
            {syncing ? 'Sincronizando...' : 'Sincronizar con SIIGO'}
          </button>

          {syncResult && (
            <div style={{
              padding: '0.6rem 0.75rem', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 600,
              backgroundColor: syncResult.success ? '#064e3b' : '#7f1d1d',
              color: syncResult.success ? '#6ee7b7' : '#fca5a5',
              display: 'flex', alignItems: 'flex-start', gap: '0.4rem'
            }}>
              {syncResult.success ? <CheckCircle size={13} /> : <XCircle size={13} />}
              <span>
                {syncResult.message}
                {syncResult.synced && (
                  <><br />Clientes: {syncResult.synced.customers}, Facturas: {syncResult.synced.invoices}</>
                )}
              </span>
            </div>
          )}

          <div style={{ padding: '0.75rem', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}>
            <span style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>Estado Conexión</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#16a34a', flexShrink: 0 }}></span>
              <span style={{ fontSize: '0.73rem', fontWeight: 700 }}>SIIGO Live API</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── CONTENIDO PRINCIPAL ── */}
      <main style={{ flexGrow: 1, padding: '2.5rem 2rem', overflowY: 'auto', maxHeight: '100vh' }}>

        {/* ── 1. WAR ROOM DASHBOARD ── */}
        {activeMenu === 'dashboard' && (
          loading ? (
            <Spinner label="Consolidando datos financieros y operativos..." />
          ) : (
            <div>
              <PageHeader title="War Room Gerencial" subtitle="Vista unificada de operación + contabilidad en tiempo real" />

              {/* KPIs Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
                <KpiCard label="Ventas del Día" value={fmtCOP(kpis?.ventasDia || 0)} sub="↑ 12% vs ayer" subColor="#16a34a" icon={<DollarSign size={60} />} />
                <KpiCard label="Ventas del Mes" value={fmtCOP(kpis?.ventasMes || 0)} sub="Consolidado SIIGO" icon={<TrendingUp size={60} />} />
                <KpiCard label="Facturas SIIGO" value={kpis?.facturasSiigo || 0} sub={`${kpis?.facturasVencidas || 0} vencidas`} subColor="#ef4444" icon={<FileText size={60} />} />
                <KpiCard label="Pedidos Brainer" value={kpis?.pedidosBrainer || 0} sub="Órdenes activas" icon={<Package size={60} />} />
                <KpiCard label="Prendas en Confección" value={fmt(kpis?.prendasConfeccion || 0)} sub="En talleres satélites" subColor="#818cf8" icon={<Layers size={60} />} />
                <KpiCard label="Satélites Activos" value={kpis?.satelitesActivos || 0} sub="Talleres en operación" icon={<Scissors size={60} />} />
                <KpiCard label="Cartera" value={fmtCOP(kpis?.cartera || 0)} sub="Por cobrar" subColor="#f59e0b" icon={<DollarSign size={60} />} />
                <KpiCard label="Margen Promedio" value={`${kpis?.margenPromedio || 34}%`} sub="Operación + Tela" subColor="#10b981" icon={<BadgePercent size={60} />} />
                <KpiCard label="Clientes en SIIGO" value={customers.length || '—'} sub="Sincronizados localmente" icon={<Users size={60} />} />
                <KpiCard label="Facturas Locales" value={invoices.length || '—'} sub="Sincronizadas localmente" icon={<CheckCircle size={60} />} />
              </div>

              {/* Gráficos */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                <ChartCard title="Ingresos vs Egresos de Confección (Semestral)">
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={[
                      { name: 'Ene', Ingresos: 85000000, Egresos: 55000000 },
                      { name: 'Feb', Ingresos: 92000000, Egresos: 62000000 },
                      { name: 'Mar', Ingresos: 110000000, Egresos: 75000000 },
                      { name: 'Abr', Ingresos: 98000000, Egresos: 71000000 },
                      { name: 'May', Ingresos: 125000000, Egresos: 83000000 },
                      { name: 'Jun', Ingresos: 140000000, Egresos: 92000000 }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000000).toFixed(0)}M`} />
                      <Tooltip formatter={(v) => fmtCOP(Number(v))} contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', fontSize: 12 }} />
                      <Area type="monotone" dataKey="Ingresos" stroke="#10b981" strokeWidth={2} fillOpacity={0.1} fill="#10b981" />
                      <Area type="monotone" dataKey="Egresos" stroke="#ef4444" strokeWidth={2} fillOpacity={0} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Estado de Producción">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '0.5rem' }}>
                    <ProgressBar label="En Confección" value={fmt(kpis?.prendasConfeccion || 7920) + ' prendas'} pct={70} color="#6366f1" />
                    <ProgressBar label="Control Calidad" value="1,840 prendas" pct={35} color="#10b981" />
                    <ProgressBar label="Listo para Despacho" value={`${kpis?.pedidosListos || 36} pedidos`} pct={50} color="#f59e0b" />
                    <ProgressBar label="Despachos Pendientes" value={`${kpis?.despachosPendientes || 12}`} pct={20} color="#ef4444" />
                  </div>
                </ChartCard>
              </div>

              {/* Facturas recientes locales */}
              {invoices.length > 0 && (
                <ChartCard title={`Últimas ${Math.min(invoices.length, 8)} Facturas Sincronizadas de SIIGO`}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #334155', color: '#94a3b8' }}>
                          <th style={{ padding: '0.6rem', textAlign: 'left' }}>Consecutivo</th>
                          <th style={{ padding: '0.6rem', textAlign: 'left' }}>Fecha</th>
                          <th style={{ padding: '0.6rem', textAlign: 'left' }}>Cliente</th>
                          <th style={{ padding: '0.6rem', textAlign: 'right' }}>Total</th>
                          <th style={{ padding: '0.6rem', textAlign: 'left' }}>Estado DIAN</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.slice(0, 8).map((inv) => (
                          <tr key={inv.id} style={{ borderBottom: '1px solid #1e293b', cursor: 'pointer' }}
                            onClick={() => { setSelectedInvoice(inv); setActiveMenu('trazabilidad'); }}>
                            <td style={{ padding: '0.6rem', fontWeight: 700, color: '#818cf8' }}>{inv.consecutive}</td>
                            <td style={{ padding: '0.6rem' }}>{inv.date}</td>
                            <td style={{ padding: '0.6rem' }}>{inv.siigo_customers?.name || inv.customer_identification}</td>
                            <td style={{ padding: '0.6rem', textAlign: 'right', fontWeight: 700 }}>{fmtCOP(inv.total)}</td>
                            <td style={{ padding: '0.6rem' }}>
                              <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700 }}>✅ {inv.status_dian || 'Aceptado DIAN'}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ChartCard>
              )}
            </div>
          )
        )}

        {/* ── 2. CRM & CLIENTES ── */}
        {activeMenu === 'crm' && (
          <div>
            <PageHeader title="CRM de Clientes" subtitle="Terceros sincronizados desde SIIGO con análisis de riesgo y comportamiento comercial" />

            {!selectedClient ? (
              <div>
                {/* Barra de búsqueda */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', maxWidth: '500px', alignItems: 'center' }}>
                  <div style={{ position: 'relative', flexGrow: 1 }}>
                    <Search size={16} style={{ position: 'absolute', top: '50%', left: '0.75rem', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Buscar por NIT o razón social..."
                      value={searchTerm}
                      onChange={e => { setSearchTerm(e.target.value); fetchCustomers(e.target.value); }}
                      style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.25rem', border: '1px solid #334155', borderRadius: '8px', backgroundColor: '#1e293b', color: 'white', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                {loadingCustomers ? (
                  <Spinner label="Cargando clientes..." />
                ) : filteredCustomers.length === 0 ? (
                  <EmptyState
                    icon={<Users size={40} />}
                    title="No hay clientes sincronizados"
                    description='Haz clic en "Sincronizar con SIIGO" en el menú lateral para traer tus clientes.'
                  />
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1.25rem' }}>
                    {filteredCustomers.map(c => (
                      <CustomerCard key={c.id} customer={c} onClick={() => { setSelectedClient(c); fetchClientInvoices(c.identification); }} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <ClientDetail
                client={selectedClient}
                invoices={clientInvoices}
                onBack={() => { setSelectedClient(null); setClientInvoices([]); }}
                onViewInvoice={(inv) => { setSelectedInvoice(inv); setActiveMenu('trazabilidad'); }}
              />
            )}
          </div>
        )}

        {/* ── 3. TRAZABILIDAD 360° ── */}
        {activeMenu === 'trazabilidad' && (
          <div>
            <PageHeader title="Trazabilidad 360°" subtitle="Seguimiento completo de una factura desde el pedido hasta la contabilización en SIIGO" />

            {/* Búsqueda de factura */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', maxWidth: '500px' }}>
              <div style={{ position: 'relative', flexGrow: 1 }}>
                <Search size={16} style={{ position: 'absolute', top: '50%', left: '0.75rem', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Número de factura (ej: FV-1-101)..."
                  value={invoiceQuery}
                  onChange={e => { setInvoiceQuery(e.target.value); fetchInvoices(e.target.value); }}
                  style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.25rem', border: '1px solid #334155', borderRadius: '8px', backgroundColor: '#1e293b', color: 'white', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Vista de la factura seleccionada */}
            {selectedInvoice ? (
              <InvoiceTrace invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
            ) : (
              <div>
                {loadingInvoices ? (
                  <Spinner label="Buscando facturas..." />
                ) : invoices.length === 0 ? (
                  <EmptyState
                    icon={<FileText size={40} />}
                    title="Sin facturas sincronizadas"
                    description='Sincroniza primero los datos con el botón "Sincronizar con SIIGO".'
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {invoices.slice(0, 15).map(inv => (
                      <div
                        key={inv.id}
                        onClick={() => setSelectedInvoice(inv)}
                        style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1.1rem 1.5rem', cursor: 'pointer', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '1rem', alignItems: 'center' }}
                      >
                        <div>
                          <span style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'block' }}>Consecutivo</span>
                          <strong style={{ color: '#818cf8' }}>{inv.consecutive}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'block' }}>Fecha</span>
                          <strong>{inv.date}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'block' }}>Cliente</span>
                          <strong>{inv.siigo_customers?.name || inv.customer_identification}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'block' }}>Total</span>
                          <strong style={{ color: '#10b981' }}>{fmtCOP(inv.total)}</strong>
                        </div>
                        <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, whiteSpace: 'nowrap' }}>✅ Ver Trace</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── 4. MARGEN & UTILIDAD ── */}
        {activeMenu === 'costos' && (
          <div>
            <PageHeader title="Margen & Utilidad Operativa" subtitle="Cruce de costos de producción en taller con ingresos facturados en SIIGO" />

            {costs ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <ChartCard title="Desglose de Costo de Producción Promedio">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '0.5rem' }}>
                    <CostBar label="Costo Tela (Kilos consumidos)" value={fmtCOP(costs.tela)} pct={53} color="#3b82f6" />
                    <CostBar label="Costo Satélite (Mano de Obra)" value={fmtCOP(costs.satelite)} pct={28} color="#6366f1" />
                    <CostBar label="Estampado / Bordado" value={fmtCOP(costs.estampado)} pct={12} color="#f59e0b" />
                    <CostBar label="Transporte & Logística" value={fmtCOP(costs.logistica)} pct={7} color="#10b981" />
                  </div>
                </ChartCard>

                <ChartCard title="Rentabilidad Operativa">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#0f172a', padding: '1rem', borderRadius: '10px' }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Ingresos Estimados</span>
                        <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>{fmtCOP(costs.ventas)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Utilidad Operativa</span>
                        <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#10b981' }}>{fmtCOP(costs.utilidad)}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between', padding: '0 0.25rem' }}>
                      <span>Margen Calculado:</span>
                      <strong style={{ color: '#10b981', fontSize: '1rem' }}>{Math.round((costs.utilidad / costs.ventas) * 100)}%</strong>
                    </div>
                    <p style={{ fontSize: '0.72rem', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                      * El margen cruza metros de tela consumidos en corte, liquidaciones pagadas a satélites y facturación real de SIIGO.
                      Sincroniza periódicamente para mantener el cálculo actualizado.
                    </p>
                  </div>
                </ChartCard>
              </div>
            ) : <Spinner label="Calculando márgenes operativos..." />}
          </div>
        )}

        {/* ── 6. VENTAS TAB ── */}
        {activeMenu === 'ventas' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <PageHeader title="Ventas & Facturación (SIIGO)" subtitle="Detalle consolidado de facturas y ventas con filtros avanzados" />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#334155',
                    color: 'white', border: 'none', borderRadius: '8px', padding: '0.55rem 1rem',
                    fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  <SlidersHorizontal size={14} /> Filtros {showFilters ? '▲' : '▼'}
                </button>
                <button
                  onClick={exportCSV}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#059669',
                    color: 'white', border: 'none', borderRadius: '8px', padding: '0.55rem 1rem',
                    fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  <Download size={14} /> Exportar CSV
                </button>
              </div>
            </div>

            {/* Ventas KPIs resumidos */}
            {salesSummary && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1rem' }}>
                  <span style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'block', textTransform: 'uppercase' }}>Ventas del Rango</span>
                  <strong style={{ fontSize: '1.25rem', color: '#10b981' }}>{fmtCOP(salesSummary.totalVentas)}</strong>
                </div>
                <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1rem' }}>
                  <span style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'block', textTransform: 'uppercase' }}>Total Facturas</span>
                  <strong style={{ fontSize: '1.25rem', color: 'white' }}>{salesSummary.totalFacturas}</strong>
                </div>
                <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1rem' }}>
                  <span style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'block', textTransform: 'uppercase' }}>Ticket Promedio</span>
                  <strong style={{ fontSize: '1.25rem', color: '#6366f1' }}>{fmtCOP(salesSummary.ticketPromedio)}</strong>
                </div>
                <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1rem' }}>
                  <span style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'block', textTransform: 'uppercase' }}>Factura Máxima</span>
                  <strong style={{ fontSize: '1.25rem', color: '#f59e0b' }}>{fmtCOP(salesSummary.maxFactura)}</strong>
                </div>
              </div>
            )}

            {/* Panel de Filtros Avanzados */}
            {showFilters && (
              <div style={{
                backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px',
                padding: '1.25rem', marginBottom: '1.5rem', display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem'
              }}>
                <div>
                  <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Buscador General</label>
                  <input
                    type="text"
                    value={salesFilters.q}
                    onChange={e => handleSalesFilterChange('q', e.target.value)}
                    placeholder="Consecutivo u observaciones..."
                    style={{ width: '100%', padding: '0.5rem', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: 'white', fontSize: '0.8rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Identificación Cliente (NIT)</label>
                  <input
                    type="text"
                    value={salesFilters.custId}
                    onChange={e => handleSalesFilterChange('custId', e.target.value)}
                    placeholder="Ej: 10101010..."
                    style={{ width: '100%', padding: '0.5rem', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: 'white', fontSize: '0.8rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Fecha Inicio</label>
                  <input
                    type="date"
                    value={salesFilters.dateStart}
                    onChange={e => handleSalesFilterChange('dateStart', e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: 'white', fontSize: '0.8rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Fecha Fin</label>
                  <input
                    type="date"
                    value={salesFilters.dateEnd}
                    onChange={e => handleSalesFilterChange('dateEnd', e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: 'white', fontSize: '0.8rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Monto Mínimo</label>
                  <input
                    type="number"
                    value={salesFilters.minTotal}
                    onChange={e => handleSalesFilterChange('minTotal', e.target.value)}
                    placeholder="Mínimo $"
                    style={{ width: '100%', padding: '0.5rem', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: 'white', fontSize: '0.8rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Monto Máximo</label>
                  <input
                    type="number"
                    value={salesFilters.maxTotal}
                    onChange={e => handleSalesFilterChange('maxTotal', e.target.value)}
                    placeholder="Máximo $"
                    style={{ width: '100%', padding: '0.5rem', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: 'white', fontSize: '0.8rem' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                  <button
                    onClick={clearSalesFilters}
                    style={{
                      padding: '0.5rem 1rem', backgroundColor: '#334155', color: 'white',
                      border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700
                    }}
                  >
                    Limpiar Filtros
                  </button>
                </div>
              </div>
            )}

            {/* Listado de Facturas */}
            {salesLoading ? (
              <Spinner label="Buscando facturas de ventas..." />
            ) : salesData.length === 0 ? (
              <EmptyState
                icon={<ShoppingBag size={40} />}
                title="No se encontraron facturas"
                description="Modifica los filtros de búsqueda o realiza una sincronización de facturas."
              />
            ) : (
              <div>
                <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', overflow: 'hidden', marginBottom: '1.5rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#0f172a', borderBottom: '2px solid #334155', color: '#94a3b8' }}>
                        <th style={{ padding: '0.85rem 1rem', cursor: 'pointer' }} onClick={() => handleSalesSort('consecutive')}>
                          Consecutivo {salesSort.by === 'consecutive' && (salesSort.asc ? '▲' : '▼')}
                        </th>
                        <th style={{ padding: '0.85rem 1rem', cursor: 'pointer' }} onClick={() => handleSalesSort('date')}>
                          Fecha {salesSort.by === 'date' && (salesSort.asc ? '▲' : '▼')}
                        </th>
                        <th style={{ padding: '0.85rem 1rem' }}>Cliente</th>
                        <th style={{ padding: '0.85rem 1rem' }}>Identificación</th>
                        <th style={{ padding: '0.85rem 1rem', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSalesSort('total')}>
                          Total {salesSort.by === 'total' && (salesSort.asc ? '▲' : '▼')}
                        </th>
                        <th style={{ padding: '0.85rem 1rem' }}>Estado DIAN</th>
                        <th style={{ padding: '0.85rem 1rem' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesData.map(inv => (
                        <tr key={inv.id} style={{ borderBottom: '1px solid #334155' }}>
                          <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#818cf8' }}>{inv.consecutive}</td>
                          <td style={{ padding: '0.85rem 1rem' }}>{inv.date}</td>
                          <td style={{ padding: '0.85rem 1rem' }}>{inv.siigo_customers?.name || 'Cliente Genérico'}</td>
                          <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace' }}>{inv.customer_identification}</td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{fmtCOP(inv.total)}</td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700 }}>✅ {inv.status_dian}</span>
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <button
                              onClick={() => setSalesDetail(inv)}
                              style={{
                                backgroundColor: '#334155', color: 'white', border: 'none',
                                borderRadius: '6px', padding: '0.35rem 0.75rem', fontSize: '0.72rem',
                                fontWeight: 700, cursor: 'pointer'
                              }}
                            >
                              Ver Detalle
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Controles de Paginación Real */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    Mostrando facturas {((salesPagination.page - 1) * salesPagination.perPage) + 1} - {Math.min(salesPagination.page * salesPagination.perPage, salesPagination.totalRows)} de {salesPagination.totalRows}
                  </span>
                  
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      disabled={salesPagination.page <= 1}
                      onClick={() => fetchSales(salesFilters, 1, salesSort)}
                      style={{ padding: '0.45rem', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: 'white', cursor: 'pointer' }}
                    >
                      <ChevronsLeft size={14} />
                    </button>
                    <button
                      disabled={salesPagination.page <= 1}
                      onClick={() => fetchSales(salesFilters, salesPagination.page - 1, salesSort)}
                      style={{ padding: '0.45rem', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: 'white', cursor: 'pointer' }}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.75rem', fontSize: '0.82rem', fontWeight: 700 }}>
                      Pág. {salesPagination.page} / {salesPagination.totalPages}
                    </span>
                    <button
                      disabled={salesPagination.page >= salesPagination.totalPages}
                      onClick={() => fetchSales(salesFilters, salesPagination.page + 1, salesSort)}
                      style={{ padding: '0.45rem', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: 'white', cursor: 'pointer' }}
                    >
                      <ChevronRight size={14} />
                    </button>
                    <button
                      disabled={salesPagination.page >= salesPagination.totalPages}
                      onClick={() => fetchSales(salesFilters, salesPagination.totalPages, salesSort)}
                      style={{ padding: '0.45rem', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: 'white', cursor: 'pointer' }}
                    >
                      <ChevronsRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Lateral (Drawer) de Detalle de Factura */}
            {salesDetail && (
              <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '450px', backgroundColor: '#1e293b', borderLeft: '1px solid #334155', boxShadow: '-10px 0 30px rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', flexDirection: 'column', animation: 'slideIn 0.2s ease-out' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: 'white' }}>{salesDetail.consecutive}</h3>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>ID SIIGO: {salesDetail.siigo_id}</span>
                  </div>
                  <button onClick={() => setSalesDetail(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                    <IconX size={20} />
                  </button>
                </div>
                
                <div style={{ padding: '1.5rem', flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', fontSize: '0.82rem' }}>
                  <div>
                    <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase' }}>Cliente</span>
                    <strong>{salesDetail.siigo_customers?.name || 'Cliente Genérico'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase' }}>Identificación (NIT)</span>
                    <strong style={{ fontFamily: 'monospace' }}>{salesDetail.customer_identification}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase' }}>Fecha de Factura</span>
                    <strong>{salesDetail.date}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase' }}>Valor Total</span>
                    <strong style={{ color: '#10b981', fontSize: '1.1rem' }}>{fmtCOP(salesDetail.total)}</strong>
                  </div>

                  <div style={{ borderTop: '1px solid #334155', paddingTop: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase' }}>Ítems de Factura</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {(salesDetail.items || []).map((it: any, index: number) => (
                        <div key={index} style={{ backgroundColor: '#0f172a', padding: '0.6rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontWeight: 700 }}>{it.description || 'Producto'}</div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Código: {it.code} — Cant: {it.quantity}</div>
                          </div>
                          <span style={{ fontWeight: 700 }}>{fmtCOP((it.price || 0) * (it.quantity || 1))}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {salesDetail.payments && salesDetail.payments.length > 0 && (
                    <div style={{ borderTop: '1px solid #334155', paddingTop: '1rem' }}>
                      <h4 style={{ margin: '0 0 0.5rem', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase' }}>Medios de Pago</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {salesDetail.payments.map((p: any, index: number) => (
                          <div key={index} style={{ backgroundColor: '#0f172a', padding: '0.6rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', color: '#10b981' }}>
                            <span>💳 Medio Pago ID: {p.id}</span>
                            <strong>{fmtCOP(p.value)}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {salesDetail.observations && (
                    <div style={{ borderTop: '1px solid #334155', paddingTop: '1rem' }}>
                      <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase' }}>Observaciones</span>
                      <p style={{ margin: '0.25rem 0 0', fontStyle: 'italic', color: '#cbd5e1' }}>{salesDetail.observations}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 5. DASHBOARD SATÉLITES ── */}
        {activeMenu === 'satelites' && (
          <div>
            <PageHeader title="Dashboard Satélites" subtitle="Desempeño, calidad y rentabilidad de cada taller de confección" />

            {satellites.length === 0 ? (
              <EmptyState icon={<Scissors size={40} />} title="Sin datos de satélites" description="Las métricas de talleres se calculan automáticamente al abrir el módulo. Asegúrate de tener inspecciones de calidad registradas." />
            ) : (
              <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #334155', color: '#94a3b8', backgroundColor: '#0f172a' }}>
                      {['Taller', 'Prendas Procesadas', 'Valor Liquidado', 'Tasa Rechazo', 'Eficiencia', 'Estado'].map(h => (
                        <th key={h} style={{ padding: '0.85rem 1rem', textAlign: 'left', fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {satellites.map((sat: any) => (
                      <tr key={sat.id} style={{ borderBottom: '1px solid #334155' }}>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>{sat.nombre}</td>
                        <td style={{ padding: '0.85rem 1rem' }}>{fmt(sat.prendas)}</td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>{fmtCOP(sat.valor_pagado)}</td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{ color: sat.defect_rate > 5 ? '#ef4444' : '#10b981', fontWeight: 700 }}>{sat.defect_rate}%</span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{ fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', backgroundColor: sat.rentabilidad > 95 ? '#064e3b' : '#451a03', color: sat.rentabilidad > 95 ? '#6ee7b7' : '#fbbf24' }}>
                            {sat.rentabilidad}%
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: sat.estado === 'Activo' ? '#10b981' : '#64748b' }}>
                            {sat.estado === 'Activo' ? '🟢 Activo' : '⚫ Inactivo'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </main>

      <style jsx global>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; } 
        ::-webkit-scrollbar-track { background: #0f172a; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
      `}</style>
    </div>
  );
}

// ─────── Sub-componentes ───────

function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white', margin: '0 0 0.25rem' }}>{title}</h1>
      <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>{subtitle}</p>
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ border: '4px solid #334155', borderTop: '4px solid #6366f1', borderRadius: '50%', width: '38px', height: '38px', animation: 'spin 0.8s linear infinite' }}></div>
      <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>{label}</p>
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem 2rem', color: '#64748b', textAlign: 'center', gap: '0.75rem' }}>
      {icon}
      <h3 style={{ color: '#94a3b8', margin: 0 }}>{title}</h3>
      <p style={{ margin: 0, fontSize: '0.85rem', maxWidth: '350px' }}>{description}</p>
    </div>
  );
}

function KpiCard({ label, value, sub, subColor, icon }: { label: string; value: any; sub?: string; subColor?: string; icon?: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '1.2rem', position: 'relative', overflow: 'hidden' }}>
      <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <h3 style={{ fontSize: '1.45rem', fontWeight: 900, color: 'white', margin: '0.25rem 0 0.1rem' }}>{value}</h3>
      {sub && <span style={{ fontSize: '0.7rem', color: subColor || '#64748b', fontWeight: 600 }}>{sub}</span>}
      <div style={{ position: 'absolute', right: '-8px', bottom: '-8px', opacity: 0.04, color: 'white' }}>{icon}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.5rem' }}>
      <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 1.25rem', color: '#e2e8f0' }}>{title}</h3>
      {children}
    </div>
  );
}

function ProgressBar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
        <span style={{ color: '#94a3b8' }}>{label}</span>
        <strong>{value}</strong>
      </div>
      <div style={{ width: '100%', height: '7px', backgroundColor: '#334155', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: '4px', transition: 'width 0.5s ease' }}></div>
      </div>
    </div>
  );
}

function CostBar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.3rem' }}>
        <span>{label}</span>
        <strong>{value} ({pct}%)</strong>
      </div>
      <div style={{ width: '100%', height: '7px', backgroundColor: '#334155', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color }}></div>
      </div>
    </div>
  );
}

function RiskBadge({ risk }: { risk: RiskLevel }) {
  const conf: Record<RiskLevel, { bg: string; color: string }> = {
    Bajo:  { bg: '#064e3b', color: '#6ee7b7' },
    Medio: { bg: '#451a03', color: '#fbbf24' },
    Alto:  { bg: '#7f1d1d', color: '#fca5a5' }
  };
  const c = conf[risk] || conf.Medio;
  return (
    <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.2rem 0.55rem', borderRadius: '4px', backgroundColor: c.bg, color: c.color }}>
      {risk === 'Bajo' ? '🟢' : risk === 'Medio' ? '🟡' : '🔴'} Riesgo {risk}
    </span>
  );
}

function CustomerCard({ customer: c, onClick }: { customer: Customer; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{
      backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '14px',
      padding: '1.4rem', cursor: 'pointer', transition: 'border-color 0.2s'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'white', margin: '0 0 0.2rem' }}>{c.name}</h3>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>NIT: {c.identification}</span>
        </div>
        <RiskBadge risk={c.riesgo} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', fontSize: '0.78rem', borderTop: '1px solid #334155', paddingTop: '0.85rem' }}>
        <div><span style={{ color: '#94a3b8', display: 'block' }}>Ciudad</span><strong>{c.city_name}</strong></div>
        <div><span style={{ color: '#94a3b8', display: 'block' }}>Saldo Mora</span><strong style={{ color: c.saldo_mora > 0 ? '#ef4444' : '#10b981' }}>{fmtCOP(c.saldo_mora)}</strong></div>
        <div><span style={{ color: '#94a3b8', display: 'block' }}>Cupo Crédito</span><strong>{fmtCOP(c.cupo_credito)}</strong></div>
        <div><span style={{ color: '#94a3b8', display: 'block' }}>Vendedor</span><strong>{c.vendedor_name}</strong></div>
      </div>
    </div>
  );
}

function ClientDetail({ client: c, invoices, onBack, onViewInvoice }: {
  client: Customer;
  invoices: Invoice[];
  onBack: () => void;
  onViewInvoice: (inv: Invoice) => void;
}) {
  const totalCompras = invoices.reduce((acc, inv) => acc + inv.total, 0);
  const promMensual = invoices.length > 0 ? totalCompras / Math.max(invoices.length, 1) : 0;

  return (
    <div>
      <button onClick={onBack} style={{ backgroundColor: '#334155', color: 'white', border: 'none', borderRadius: '6px', padding: '0.4rem 1rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', marginBottom: '1.5rem' }}>
        ← Volver
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem' }}>

        {/* Ficha del Cliente */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'white', margin: 0 }}>{c.name}</h2>
              <RiskBadge risk={c.riesgo} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.8rem' }}>
              <div><span style={{ color: '#94a3b8', display: 'block' }}>NIT</span><strong>{c.identification}</strong></div>
              <div><span style={{ color: '#94a3b8', display: 'block' }}>Ciudad</span><strong>{c.city_name}, {c.state_name}</strong></div>
              <div><span style={{ color: '#94a3b8', display: 'block' }}>Email</span><strong>{c.email || 'No registrado'}</strong></div>
              <div><span style={{ color: '#94a3b8', display: 'block' }}>Teléfono</span><strong>{c.phone || 'No registrado'}</strong></div>
              <div><span style={{ color: '#94a3b8', display: 'block' }}>Vendedor Asignado</span><strong>{c.vendedor_name}</strong></div>
              <div><span style={{ color: '#94a3b8', display: 'block' }}>Cupo de Crédito</span><strong>{fmtCOP(c.cupo_credito)}</strong></div>
              <div><span style={{ color: '#94a3b8', display: 'block' }}>Saldo en Mora</span><strong style={{ color: c.saldo_mora > 0 ? '#ef4444' : '#10b981' }}>{fmtCOP(c.saldo_mora)}</strong></div>
            </div>
          </div>

          {/* IA Comercial */}
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.8rem', fontWeight: 800, color: '#818cf8', margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              ✨ Inteligencia Comercial (IA)
            </h3>
            <div style={{ fontSize: '0.74rem', color: '#cbd5e1', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <p style={{ margin: 0 }}>🤖 <strong>Comportamiento:</strong> Rotación de compras <strong>{c.rotacion}</strong>. {c.saldo_mora > 0 ? `Tiene saldo en mora de ${fmtCOP(c.saldo_mora)} que requiere seguimiento.` : 'Al día con sus pagos.'}</p>
              <p style={{ margin: 0 }}>📊 <strong>Total histórico facturado:</strong> {fmtCOP(totalCompras)}</p>
              <p style={{ margin: 0 }}>💡 <strong>Recomendación:</strong> {c.riesgo === 'Alto' ? 'Enviar a proceso de cobro preventivo antes de nuevos pedidos.' : 'Cliente confiable. Evaluar incremento de cupo de crédito.'}</p>
            </div>
          </div>
        </div>

        {/* Facturas del Cliente */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <KpiCard label="Total Facturado" value={fmtCOP(totalCompras)} icon={<DollarSign size={50} />} />
            <KpiCard label="Facturas en SIIGO" value={invoices.length} icon={<FileText size={50} />} />
            <KpiCard label="Promedio por Factura" value={fmtCOP(promMensual)} icon={<Activity size={50} />} />
          </div>

          {/* Lista de facturas */}
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 1rem' }}>Facturas SIIGO del Cliente</h3>
            {invoices.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '0.82rem', textAlign: 'center', padding: '2rem' }}>
                No hay facturas sincronizadas para este cliente. Realiza una sincronización con SIIGO.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #334155', color: '#94a3b8' }}>
                      <th style={{ padding: '0.6rem', textAlign: 'left' }}>Consecutivo</th>
                      <th style={{ padding: '0.6rem', textAlign: 'left' }}>Fecha</th>
                      <th style={{ padding: '0.6rem', textAlign: 'right' }}>Total</th>
                      <th style={{ padding: '0.6rem', textAlign: 'left' }}>Estado DIAN</th>
                      <th style={{ padding: '0.6rem' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => (
                      <tr key={inv.id} style={{ borderBottom: '1px solid #334155' }}>
                        <td style={{ padding: '0.6rem', fontWeight: 700, color: '#818cf8' }}>{inv.consecutive}</td>
                        <td style={{ padding: '0.6rem' }}>{inv.date}</td>
                        <td style={{ padding: '0.6rem', textAlign: 'right', fontWeight: 700 }}>{fmtCOP(inv.total)}</td>
                        <td style={{ padding: '0.6rem' }}><span style={{ color: '#10b981', fontSize: '0.72rem' }}>✅ {inv.status_dian || 'Aceptado DIAN'}</span></td>
                        <td style={{ padding: '0.6rem' }}>
                          <button onClick={() => onViewInvoice(inv)} style={{ backgroundColor: '#334155', border: 'none', color: 'white', borderRadius: '5px', padding: '0.25rem 0.65rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
                            Ver Trace →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

function InvoiceTrace({ invoice: inv, onClose }: { invoice: Invoice; onClose: () => void }) {
  const fmt2 = (n: number) => `$${n.toLocaleString('es-CO')}`;

  const steps = [
    { emoji: '🛍️', label: 'Pedido Comercial', value: `Pedido registrado en Brainer — Cliente: ${inv.siigo_customers?.name || inv.customer_identification}`, color: '#6366f1' },
    { emoji: '🏭', label: 'Orden de Producción', value: 'Generada desde el pedido aprobado en el módulo de órdenes', color: '#6366f1' },
    { emoji: '✂️', label: 'Corte & Insumos', value: 'Matriz de tendido y corte aprobada. Tela consumida registrada en inventario.', color: '#6366f1' },
    { emoji: '🧵', label: 'Confección en Satélite', value: 'Asignado al taller externo. Liquidación registrada en control de calidad.', color: '#6366f1' },
    { emoji: '✅', label: 'Control de Calidad', value: 'Prendas inspeccionadas y aprobadas. Descuentos por defecto aplicados.', color: '#10b981' },
    { emoji: '📦', label: 'Empaque & Despacho', value: 'Guía logística generada y entregada al transportador.', color: '#10b981' },
    { emoji: '📄', label: 'Factura SIIGO', value: `${inv.consecutive} — ${fmt2(inv.total)} — ${inv.date}`, color: '#f59e0b' },
    { emoji: '🏦', label: 'Estado DIAN', value: `${inv.status_dian || 'Aceptado por la DIAN'}${inv.cufe ? ` — CUFE: ${inv.cufe.substring(0, 20)}...` : ''}`, color: '#10b981' },
    { emoji: '💳', label: 'Recaudo / Pago', value: inv.payments?.length > 0 ? `${inv.payments.length} medio(s) de pago registrado(s)` : 'Pendiente de recaudo', color: inv.payments?.length > 0 ? '#10b981' : '#f59e0b' },
  ];

  return (
    <div>
      <button onClick={onClose} style={{ backgroundColor: '#334155', color: 'white', border: 'none', borderRadius: '6px', padding: '0.4rem 1rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', marginBottom: '1.5rem' }}>
        ← Volver
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>

        {/* Resumen de Factura */}
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.5rem' }}>
          <div style={{ borderBottom: '1px solid #334155', paddingBottom: '0.85rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Factura de Venta</span>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#818cf8', margin: '0.15rem 0' }}>{inv.consecutive}</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', fontSize: '0.8rem' }}>
            <div><span style={{ color: '#94a3b8', display: 'block' }}>Cliente</span><strong>{inv.siigo_customers?.name || inv.customer_identification}</strong></div>
            <div><span style={{ color: '#94a3b8', display: 'block' }}>NIT</span><strong>{inv.customer_identification}</strong></div>
            <div><span style={{ color: '#94a3b8', display: 'block' }}>Fecha</span><strong>{inv.date}</strong></div>
            <div><span style={{ color: '#94a3b8', display: 'block' }}>Total Factura</span><strong style={{ fontSize: '1.1rem', color: '#10b981' }}>{fmt2(inv.total)}</strong></div>
            <div><span style={{ color: '#94a3b8', display: 'block' }}>Estado DIAN</span><span style={{ color: '#10b981', fontWeight: 700 }}>✅ {inv.status_dian || 'Aceptado'}</span></div>
            {inv.cufe && <div><span style={{ color: '#94a3b8', display: 'block' }}>CUFE</span><code style={{ color: '#f59e0b', fontSize: '0.65rem', wordBreak: 'break-all' }}>{inv.cufe}</code></div>}
            {inv.observations && <div><span style={{ color: '#94a3b8', display: 'block' }}>Observaciones</span><em style={{ color: '#cbd5e1' }}>{inv.observations}</em></div>}
          </div>

          {/* Items facturados */}
          {inv.items?.length > 0 && (
            <div style={{ marginTop: '1.25rem', borderTop: '1px solid #334155', paddingTop: '1rem' }}>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 700, margin: '0 0 0.75rem', color: '#94a3b8' }}>Ítems Facturados</h4>
              {inv.items.map((item: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', padding: '0.3rem 0', borderBottom: '1px solid #334155' }}>
                  <span>{item.description || item.code}</span>
                  <strong>{fmt2((item.price || 0) * (item.quantity || 1))}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trazabilidad */}
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'white', margin: '0 0 1.5rem' }}>Flujo Operativo Completo</h3>
          <div style={{ position: 'relative', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div style={{ position: 'absolute', left: '5px', top: '8px', bottom: '8px', width: '2px', backgroundColor: '#334155' }}></div>
            {steps.map((step, i) => (
              <div key={i} style={{ position: 'relative', paddingLeft: '0.25rem' }}>
                <div style={{ position: 'absolute', left: '-21px', top: '2px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: step.color, border: '2px solid #0f172a' }}></div>
                <div>
                  <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {step.emoji} {step.label}
                  </span>
                  <strong style={{ fontSize: '0.8rem', color: '#e2e8f0' }}>{step.value}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
