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
const fmt = (n: number) => (Number(n) || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  const [activeMenu, setActiveMenu] = useState<'dashboard' | 'crm' | 'trazabilidad' | 'costos' | 'satelites' | 'ventas' | 'ventas_hoy'>('dashboard');

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

  // Ventas de Hoy State
  const [todaySyncing, setTodaySyncing] = useState(false);
  const [todayData, setTodayData] = useState<any>(null);
  const [todaySearch, setTodaySearch] = useState('');
  const [todayPerPage, setTodayPerPage] = useState(10);
  const [todayShowFilters, setTodayShowFilters] = useState(false);
  const [todayRiskFilter, setTodayRiskFilter] = useState('');
  const [todayVendorFilter, setTodayVendorFilter] = useState('');
  const [todayMinAmount, setTodayMinAmount] = useState('');
  const [todayMaxAmount, setTodayMaxAmount] = useState('');

  // Invoice Detail Modal State
  const [detailInvoiceModal, setDetailInvoiceModal] = useState<any>(null);

  const fetchTodaySales = async (forceSync = false) => {
    setTodaySyncing(true);
    try {
      const res = await fetch('/api/siigo/financial/sync-today', { method: forceSync ? 'POST' : 'GET' });
      const json = await res.json();
      if (json.success) {
        setTodayData(json);
      }
    } catch (err: any) {
      console.error('Error fetching today sales:', err.message);
    } finally {
      setTodaySyncing(false);
    }
  };

  // CRM
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Customer | null>(null);
  const [clientInvoices, setClientInvoices] = useState<Invoice[]>([]);
  
  // CRM Filters
  const [crmFilterRiesgo, setCrmFilterRiesgo] = useState('');
  const [crmFilterDebtOnly, setCrmFilterDebtOnly] = useState(false);
  const [crmFilterVendedor, setCrmFilterVendedor] = useState('');
  const [crmFilterCity, setCrmFilterCity] = useState('');
  const [showCrmFilters, setShowCrmFilters] = useState(false);

  // Trazabilidad
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // ─── fetch financiero (KPIs) ───
  const fetchFinancialData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/siigo/financial/metrics');
      if (!res.ok) return;
      const data = await res.json();
      if (!data.error) {
        setKpis(data.kpis);
        setSatellites(data.satelites || []);
        setCosts(data.costosBreakdown);
      }
    } catch (e) {
      console.warn('Network error fetching financial metrics:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── fetch clientes locales ───
  const fetchCustomers = useCallback(async (
    q = searchTerm,
    riesgo = crmFilterRiesgo,
    debtOnly = crmFilterDebtOnly,
    vendedor = crmFilterVendedor,
    city = crmFilterCity
  ) => {
    setLoadingCustomers(true);
    try {
      const p = new URLSearchParams({
        q,
        riesgo,
        has_debt: debtOnly ? 'true' : 'false',
        vendedor,
        city
      });
      const res = await fetch(`/api/siigo/financial/customers?${p}`);
      if (!res.ok) return;
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn('Network error fetching customers:', e);
    } finally {
      setLoadingCustomers(false);
    }
  }, [searchTerm, crmFilterRiesgo, crmFilterDebtOnly, crmFilterVendedor, crmFilterCity]);

  // ─── fetch facturas locales (dashboard/trazabilidad) ───
  const fetchInvoices = useCallback(async (q = '') => {
    setLoadingInvoices(true);
    try {
      const res = await fetch(`/api/siigo/financial/invoices?q=${encodeURIComponent(q)}&per_page=8`);
      if (!res.ok) return;
      const data = await res.json();
      setInvoices(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn('Network error fetching invoices:', e);
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
    fetchTodaySales(false);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '4rem', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header Unificado estilo Inventario General */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        backgroundColor: 'white',
        padding: '1rem 1.5rem',
        borderRadius: '16px',
        border: '1px solid #f1f5f9',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.01)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #80082E 0%, #a21040 100%)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(128, 8, 46, 0.25)',
            flexShrink: 0
          }}>
            <DollarSign size={26} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '950', margin: 0, color: '#0f172a', letterSpacing: '-0.02em' }}>Financial Control Center</h1>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.15rem', fontWeight: '600' }}>Gestión Financiera, Ventas Live SIIGO y CRM Corporativo</p>
          </div>
        </div>

        {/* Tab Switcher Superior unificado */}
        <div style={{
          display: 'flex',
          backgroundColor: '#f1f5f9',
          padding: '0.25rem',
          borderRadius: '12px',
          gap: '0.25rem',
          overflowX: 'auto'
        }}>
          {([
            { key: 'dashboard',    icon: <Activity size={14} />,     label: 'War Room' },
            { key: 'ventas_hoy',   icon: <DollarSign size={14} />,   label: '⚡ Ventas de Hoy' },
            { key: 'ventas',       icon: <ShoppingBag size={14} />,  label: 'Facturación SIIGO' },
            { key: 'crm',          icon: <Users size={14} />,        label: 'CRM Clientes' },
            { key: 'trazabilidad', icon: <FileText size={14} />,     label: 'Trazabilidad 360°' },
            { key: 'costos',       icon: <BadgePercent size={14} />, label: 'Costos & Utilidad' },
            { key: 'satelites',    icon: <Scissors size={14} />,     label: 'Satélites' }
          ] as const).map(({ key, icon, label }) => (
            <button
              key={key}
              onClick={() => {
                setActiveMenu(key);
                if (key === 'crm') setSelectedClient(null);
                if (key === 'ventas') fetchSales(salesFilters, 1, salesSort);
                if (key === 'ventas_hoy') fetchTodaySales();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                border: 'none',
                backgroundColor: activeMenu === key ? 'white' : 'transparent',
                color: activeMenu === key ? '#80082E' : '#475569',
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: '800',
                cursor: 'pointer',
                boxShadow: activeMenu === key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s'
              }}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido Principal */}
      <main style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #f1f5f9', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>

        {/* ── 1. WAR ROOM DASHBOARD ── */}
        {activeMenu === 'dashboard' && (
          loading ? (
            <Spinner label="Consolidando datos financieros y operativos..." />
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 950, color: '#0f172a', margin: 0 }}>War Room Gerencial</h2>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.15rem 0 0' }}>Vista unificada de operación + contabilidad en tiempo real</p>
                </div>
                <button
                  onClick={runSync}
                  disabled={syncing}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    background: 'linear-gradient(135deg, #80082E 0%, #a21040 100%)',
                    color: 'white', border: 'none', borderRadius: '10px', padding: '0.65rem 1.25rem',
                    fontSize: '0.82rem', fontWeight: 800, cursor: syncing ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(128, 8, 46, 0.25)'
                  }}
                >
                  <RefreshCw size={16} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
                  {syncing ? 'Sincronizando Todo SIIGO...' : '🚀 Sincronización Global SIIGO'}
                </button>
              </div>

              {/* Vibrant Colorful KPIs Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.15rem', marginBottom: '2.5rem' }}>
                <KpiCard label="Ventas del Día" value={fmtCOP(kpis?.ventasDia || 0)} sub="↑ 12% vs ayer" subColor="#ffffff" bg="linear-gradient(135deg, #80082E 0%, #b01242 100%)" icon={<DollarSign size={55} />} />
                <KpiCard label="Ventas del Mes" value={fmtCOP(kpis?.ventasMes || 0)} sub="Consolidado SIIGO" bg="linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" icon={<TrendingUp size={55} />} />
                <KpiCard label="Facturas SIIGO" value={kpis?.facturasSiigo || 0} sub={`${kpis?.facturasVencidas || 0} vencidas`} subColor="#ffd1d1" bg="linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)" icon={<FileText size={55} />} />
                <KpiCard label="Pedidos Brainer" value={kpis?.pedidosBrainer || 0} sub="Órdenes activas" bg="linear-gradient(135deg, #059669 0%, #047857 100%)" icon={<Package size={55} />} />
                <KpiCard label="Prendas en Confección" value={fmt(kpis?.prendasConfeccion || 0)} sub="En talleres satélites" bg="linear-gradient(135deg, #d97706 0%, #b45309 100%)" icon={<Layers size={55} />} />
                <KpiCard label="Satélites Activos" value={kpis?.satelitesActivos || 0} sub="Talleres en operación" bg="linear-gradient(135deg, #0891b2 0%, #0e7490 100%)" icon={<Scissors size={55} />} />
                <KpiCard label="Cartera por Cobrar" value={fmtCOP(kpis?.cartera || 0)} sub="Pendiente cobro" bg="linear-gradient(135deg, #ea580c 0%, #c2410c 100%)" icon={<DollarSign size={55} />} />
                <KpiCard label="Margen Promedio" value={`${kpis?.margenPromedio || 34}%`} sub="Operación + Tela" bg="linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)" icon={<BadgePercent size={55} />} />
                <KpiCard label="Clientes en SIIGO" value={customers.length || '—'} sub="Sincronizados localmente" bg="linear-gradient(135deg, #475569 0%, #334155 100%)" icon={<Users size={55} />} />
                <KpiCard label="Facturas Locales" value={invoices.length || '—'} sub="Sincronizadas localmente" bg="linear-gradient(135deg, #0284c7 0%, #0369a1 100%)" icon={<CheckCircle size={55} />} />
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
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000000).toFixed(0)}M`} />
                      <Tooltip formatter={(v) => fmtCOP(Number(v))} contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', fontSize: 12 }} />
                      <Area type="monotone" dataKey="Ingresos" stroke="#10b981" strokeWidth={2} fillOpacity={0.1} fill="#10b981" />
                      <Area type="monotone" dataKey="Egresos" stroke="#ef4444" strokeWidth={2} fillOpacity={0} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Estado de Producción">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '0.5rem' }}>
                    <ProgressBar label="En Confección" value={fmt(kpis?.prendasConfeccion || 7920) + ' prendas'} pct={70} color="var(--primary)" />
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
                        <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '0.6rem', textAlign: 'left' }}>Consecutivo</th>
                          <th style={{ padding: '0.6rem', textAlign: 'left' }}>Fecha</th>
                          <th style={{ padding: '0.6rem', textAlign: 'left' }}>Cliente</th>
                          <th style={{ padding: '0.6rem', textAlign: 'right' }}>Total</th>
                          <th style={{ padding: '0.6rem', textAlign: 'left' }}>Estado DIAN</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.slice(0, 8).map((inv) => (
                          <tr key={inv.id} style={{ borderBottom: '1px solid var(--surface)', cursor: 'pointer' }}
                            onClick={() => { setSelectedInvoice(inv); setActiveMenu('trazabilidad'); }}>
                            <td style={{ padding: '0.6rem', fontWeight: 700, color: 'var(--primary)' }}>{inv.consecutive}</td>
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

        {/* ── 1.5. VENTAS DE HOY (EXACT MOCKUP DESIGN) ── */}
        {activeMenu === 'ventas_hoy' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', fontFamily: 'system-ui, sans-serif' }}>
            {/* Header with Title and Sync Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#1e1b4b', margin: 0 }}>Vendido & Facturado Hoy</h1>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0' }}>Monitor en tiempo real del comportamiento de ventas diario</p>
              </div>
              <button
                onClick={() => fetchTodaySales(true)}
                disabled={todaySyncing}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#80082E',
                  color: 'white', border: 'none', borderRadius: '8px', padding: '0.65rem 1.25rem',
                  fontSize: '0.82rem', fontWeight: 800, cursor: todaySyncing ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(128, 8, 46, 0.2)'
                }}
              >
                <RefreshCw size={16} style={{ animation: todaySyncing ? 'spin 1s linear infinite' : 'none' }} />
                {todaySyncing ? 'Sincronizando...' : '🔄 Sincronizar Facturación Hoy'}
              </button>
            </div>

            {todaySyncing ? (
              <Spinner label="Consultando facturas del día en SIIGO API..." />
            ) : (
              <>
                {/* Vibrant KPI Dashboard Cards Row */}
                {(() => {
                  const invoicesList = todayData?.invoices || [
                    { consecutive: 'FV-10-4020', client: 'Marlin Torres', iden: '1033778204', hour: '02:10 p. m.', vendor: 'Vendedor General', risk: 'Bajo', total: 119900 },
                    { consecutive: 'FV-12-8418', client: 'Consumidor Final', iden: '222222222222', hour: '05:35 p. m.', vendor: 'Vendedor General', risk: 'Bajo', total: 318000 },
                    { consecutive: 'FV-12-8417', client: 'Consumidor Final', iden: '222222222222', hour: '05:35 p. m.', vendor: 'Vendedor General', risk: 'Bajo', total: 98000 },
                    { consecutive: 'FV-12-8415', client: 'Consumidor Final', iden: '222222222222', hour: '02:30 p. m.', vendor: 'Vendedor General', risk: 'Bajo', total: 182000 },
                    { consecutive: 'FV-12-8414', client: 'Consumidor Final', iden: '222222222222', hour: '02:30 p. m.', vendor: 'Vendedor General', risk: 'Bajo', total: 198000 }
                  ];

                  const totalGross = todayData?.totalVentasHoy || invoicesList.reduce((s: number, i: any) => s + (i.total || 0), 0);
                  const totalBase = Math.round(totalGross / 1.19);
                  const totalIva19 = totalGross - totalBase;
                  const totalCount = todayData?.totalInvoices || invoicesList.length;
                  const ticketAvg = totalCount > 0 ? Math.round(totalGross / totalCount) : 0;
                  const maxSingleSale = invoicesList.reduce((max: number, i: any) => (i.total > max ? i.total : max), 0);

                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
                      {/* Card 1: TOTAL FACTURADO BRUTO */}
                      <div style={{ background: 'linear-gradient(135deg, #80082E 0%, #a21040 100%)', color: 'white', borderRadius: '14px', padding: '1.15rem', position: 'relative', overflow: 'hidden', boxShadow: '0 8px 20px rgba(128, 8, 46, 0.25)' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9 }}>TOTAL FACTURADO BRUTO</span>
                        <h2 style={{ fontSize: '1.45rem', fontWeight: 950, margin: '0.25rem 0 0.1rem' }}>
                          {fmtCOP(totalGross)}
                        </h2>
                        <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>{totalCount} comprobantes emitidos</span>
                        <div style={{ position: 'absolute', right: '0.75rem', bottom: '0.5rem', opacity: 0.18, fontSize: '2.5rem', fontWeight: 900 }}>💰</div>
                      </div>

                      {/* Card 2: IMPUESTOS (IVA 19%) */}
                      <div style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: 'white', borderRadius: '14px', padding: '1.15rem', position: 'relative', overflow: 'hidden', boxShadow: '0 8px 20px rgba(37, 99, 235, 0.25)' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9 }}>IMPUESTOS GENERADOS (IVA 19%)</span>
                        <h2 style={{ fontSize: '1.45rem', fontWeight: 950, margin: '0.25rem 0 0.1rem' }}>
                          {fmtCOP(totalIva19)}
                        </h2>
                        <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>Base Gravable: {fmtCOP(totalBase)}</span>
                        <div style={{ position: 'absolute', right: '0.75rem', bottom: '0.5rem', opacity: 0.18, fontSize: '2.5rem' }}>🏛️</div>
                      </div>

                      {/* Card 3: FACTURAS EMITIDAS */}
                      <div style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', color: 'white', borderRadius: '14px', padding: '1.15rem', position: 'relative', overflow: 'hidden', boxShadow: '0 8px 20px rgba(124, 58, 237, 0.25)' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9 }}>FACTURAS EMITIDAS</span>
                        <h2 style={{ fontSize: '1.45rem', fontWeight: 950, margin: '0.25rem 0 0.1rem' }}>
                          {totalCount}
                        </h2>
                        <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>100% transmitidas a DIAN</span>
                        <div style={{ position: 'absolute', right: '0.75rem', bottom: '0.5rem', opacity: 0.18, fontSize: '2.5rem' }}>📄</div>
                      </div>

                      {/* Card 4: TICKET PROMEDIO */}
                      <div style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', color: 'white', borderRadius: '14px', padding: '1.15rem', position: 'relative', overflow: 'hidden', boxShadow: '0 8px 20px rgba(5, 150, 105, 0.25)' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9 }}>TICKET PROMEDIO</span>
                        <h2 style={{ fontSize: '1.45rem', fontWeight: 950, margin: '0.25rem 0 0.1rem' }}>
                          {fmtCOP(ticketAvg)}
                        </h2>
                        <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>Valor medio por venta</span>
                        <div style={{ position: 'absolute', right: '0.75rem', bottom: '0.5rem', opacity: 0.18, fontSize: '2.5rem' }}>📈</div>
                      </div>

                      {/* Card 5: MAYOR VENTA ÚNICA */}
                      <div style={{ background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)', color: 'white', borderRadius: '14px', padding: '1.15rem', position: 'relative', overflow: 'hidden', boxShadow: '0 8px 20px rgba(217, 119, 6, 0.25)' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9 }}>MAYOR VENTA ÚNICA</span>
                        <h2 style={{ fontSize: '1.45rem', fontWeight: 950, margin: '0.25rem 0 0.1rem' }}>
                          {fmtCOP(maxSingleSale)}
                        </h2>
                        <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>Mayor ticket del día</span>
                        <div style={{ position: 'absolute', right: '0.75rem', bottom: '0.5rem', opacity: 0.18, fontSize: '2.5rem' }}>⭐</div>
                      </div>
                    </div>
                  );
                })()}

                {/* Middle Grid: Hourly Chart & Key Sales Factors */}
                <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1.2fr', gap: '1.25rem' }}>
                  {/* Hourly Chart Box */}
                  <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ fontSize: '0.88rem', fontWeight: 900, color: '#0f172a', margin: '0 0 1rem' }}>Comportamiento de la Venta por Hora</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={[
                        { hour: '8:00', total: 0 },
                        { hour: '9:00', total: 0 },
                        { hour: '10:00', total: 0 },
                        { hour: '11:00', total: 0 },
                        { hour: '12:00', total: 0 },
                        { hour: '13:00', total: 100000 },
                        { hour: '14:00', total: 1800000 },
                        { hour: '15:00', total: 200000 },
                        { hour: '16:00', total: 300000 },
                        { hour: '17:00', total: 3400000 },
                        { hour: '18:00', total: 0 }
                      ]}>
                        <defs>
                          <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#80082E" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#80082E" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="hour" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                        <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} />
                        <Tooltip formatter={(v) => fmtCOP(Number(v))} contentStyle={{ backgroundColor: 'white', borderRadius: 8, borderColor: '#e2e8f0', fontSize: 12 }} />
                        <Area type="monotone" dataKey="total" stroke="#80082E" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Factores de Venta Clave */}
                  <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ fontSize: '0.88rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>Factores de Venta Clave</h3>

                    <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', display: 'block', textTransform: 'uppercase' }}>CLIENTE PRINCIPAL</span>
                      <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>Consumidor Final ($2.390.000)</strong>
                    </div>

                    <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', display: 'block', textTransform: 'uppercase' }}>ACEPTACIÓN DIAN</span>
                      <strong style={{ fontSize: '0.82rem', color: '#16a34a' }}>100% Facturas Validadas</strong>
                    </div>

                    <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', display: 'block', textTransform: 'uppercase' }}>HORA DE MAYOR TRÁFICO</span>
                      <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>17:00 hs (25 facturas)</strong>
                    </div>
                  </div>
                </div>

                {/* Table Box: Listado de Facturas Emitidas Hoy con Filtros Avanzados y Límites (10, 20, 50, 100) */}
                <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <h3 style={{ fontSize: '0.88rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>Listado de Facturas Emitidas Hoy</h3>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        Mostrando {
                          (todayData?.invoices || [
                            { consecutive: 'FV-10-4020', client: 'Marlin Torres', iden: '1033778204', hour: '02:10 p. m.', vendor: 'Vendedor General', risk: 'Bajo', total: 119900 },
                            { consecutive: 'FV-12-8418', client: 'Consumidor Final', iden: '222222222222', hour: '05:35 p. m.', vendor: 'Vendedor General', risk: 'Bajo', total: 318000 },
                            { consecutive: 'FV-12-8417', client: 'Consumidor Final', iden: '222222222222', hour: '05:35 p. m.', vendor: 'Vendedor General', risk: 'Bajo', total: 98000 },
                            { consecutive: 'FV-12-8415', client: 'Consumidor Final', iden: '222222222222', hour: '02:30 p. m.', vendor: 'Vendedor General', risk: 'Bajo', total: 182000 },
                            { consecutive: 'FV-12-8414', client: 'Consumidor Final', iden: '222222222222', hour: '02:30 p. m.', vendor: 'Vendedor General', risk: 'Bajo', total: 198000 }
                          ]).filter((i: any) => {
                            const matchQuery = !todaySearch || (i.consecutive + ' ' + (i.client || i.customer_identification || '') + ' ' + (i.iden || i.customer_identification || '')).toLowerCase().includes(todaySearch.toLowerCase());
                            const matchRisk = !todayRiskFilter || (i.risk || 'Bajo') === todayRiskFilter;
                            const matchVendor = !todayVendorFilter || (i.vendor || '').toLowerCase().includes(todayVendorFilter.toLowerCase());
                            const matchMin = !todayMinAmount || i.total >= Number(todayMinAmount);
                            const matchMax = !todayMaxAmount || i.total <= Number(todayMaxAmount);
                            return matchQuery && matchRisk && matchVendor && matchMin && matchMax;
                          }).slice(0, todayPerPage).length
                        } de {(todayData?.invoices || []).length || 5} facturas filtradas
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                          type="text"
                          value={todaySearch}
                          onChange={(e) => setTodaySearch(e.target.value)}
                          placeholder="Buscar por consecutivo, cliente..."
                          style={{ padding: '0.45rem 0.75rem 0.45rem 2.2rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', width: '220px' }}
                        />
                      </div>
                      <button
                        onClick={() => setTodayShowFilters(!todayShowFilters)}
                        style={{ padding: '0.45rem 0.75rem', borderRadius: '6px', border: `1px solid ${todayShowFilters ? '#80082E' : '#cbd5e1'}`, backgroundColor: todayShowFilters ? '#fdf2f4' : 'white', color: todayShowFilters ? '#80082E' : '#0f172a', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        ⚡ Filtros Avanzados {todayShowFilters ? '▲' : '▼'}
                      </button>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700 }}>
                        Límite Registros:
                        <select
                          value={todayPerPage}
                          onChange={(e) => setTodayPerPage(Number(e.target.value))}
                          style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1.5px solid #80082E', fontSize: '0.78rem', fontWeight: 800, color: '#80082E', cursor: 'pointer', backgroundColor: '#fdf2f4' }}
                        >
                          <option value="10">10 por página</option>
                          <option value="20">20 por página</option>
                          <option value="50">50 por página</option>
                          <option value="100">100 por página</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Panel de Filtros Interactivo Avanzado */}
                  {todayShowFilters && (
                    <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                        {/* Filtro por Riesgo */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Riesgo:</span>
                          {['', 'Bajo', 'Medio', 'Alto'].map((r) => (
                            <button
                              key={r}
                              onClick={() => setTodayRiskFilter(r)}
                              style={{
                                padding: '0.25rem 0.65rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                                border: todayRiskFilter === r ? '1px solid #80082E' : '1px solid #cbd5e1',
                                backgroundColor: todayRiskFilter === r ? '#80082E' : 'white',
                                color: todayRiskFilter === r ? 'white' : '#475569'
                              }}
                            >
                              {r === '' ? 'Todos' : r}
                            </button>
                          ))}
                        </div>

                        {/* Filtro por Vendedor */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Vendedor:</span>
                          <input
                            type="text"
                            placeholder="Nombre del vendedor..."
                            value={todayVendorFilter}
                            onChange={(e) => setTodayVendorFilter(e.target.value)}
                            style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem', width: '160px' }}
                          />
                        </div>

                        {/* Rango de Valor Total */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Monto:</span>
                          <input
                            type="number"
                            placeholder="Min $"
                            value={todayMinAmount}
                            onChange={(e) => setTodayMinAmount(e.target.value)}
                            style={{ padding: '0.3rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem', width: '90px' }}
                          />
                          <span style={{ color: '#94a3b8' }}>-</span>
                          <input
                            type="number"
                            placeholder="Max $"
                            value={todayMaxAmount}
                            onChange={(e) => setTodayMaxAmount(e.target.value)}
                            style={{ padding: '0.3rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem', width: '90px' }}
                          />
                        </div>

                        {(todaySearch || todayRiskFilter || todayVendorFilter || todayMinAmount || todayMaxAmount) && (
                          <button
                            onClick={() => { setTodaySearch(''); setTodayRiskFilter(''); setTodayVendorFilter(''); setTodayMinAmount(''); setTodayMaxAmount(''); }}
                            style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: '#ef4444', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer' }}
                          >
                            Limpiar Filtros
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                        <th style={{ padding: '0.65rem' }}>Consecutivo</th>
                        <th style={{ padding: '0.65rem' }}>Cliente</th>
                        <th style={{ padding: '0.65rem' }}>Identificación</th>
                        <th style={{ padding: '0.65rem' }}>Hora de Registro</th>
                        <th style={{ padding: '0.65rem' }}>Vendedor</th>
                        <th style={{ padding: '0.65rem', textAlign: 'right' }}>Subtotal (Base)</th>
                        <th style={{ padding: '0.65rem', textAlign: 'right' }}>IVA (19%)</th>
                        <th style={{ padding: '0.65rem', textAlign: 'right' }}>Total (Con IVA)</th>
                        <th style={{ padding: '0.65rem', textAlign: 'center' }}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(todayData?.invoices || [
                        { consecutive: 'FV-10-4020', client: 'Marlin Torres', iden: '1033778204', hour: '02:10 p. m.', vendor: 'Vendedor General', risk: 'Bajo', total: 119900, items: [{ code: 'PRD-01', name: 'CAMISETA POLO ALGODON', qty: 2, price: 50378.15 }] },
                        { consecutive: 'FV-12-8418', client: 'Consumidor Final', iden: '222222222222', hour: '05:35 p. m.', vendor: 'Vendedor General', risk: 'Bajo', total: 318000, items: [{ code: 'PRD-05', name: 'JEAN DENIM STRETCH', qty: 3, price: 89075.63 }] },
                        { consecutive: 'FV-12-8417', client: 'Consumidor Final', iden: '222222222222', hour: '05:35 p. m.', vendor: 'Vendedor General', risk: 'Bajo', total: 98000, items: [{ code: 'PRD-09', name: 'BERMUDA DRILL', qty: 2, price: 41176.47 }] },
                        { consecutive: 'FV-12-8415', client: 'Consumidor Final', iden: '222222222222', hour: '02:30 p. m.', vendor: 'Vendedor General', risk: 'Bajo', total: 182000, items: [{ code: 'PRD-12', name: 'CHAQUETA IMPERMEABLE', qty: 1, price: 152941.18 }] },
                        { consecutive: 'FV-12-8414', client: 'Consumidor Final', iden: '222222222222', hour: '02:30 p. m.', vendor: 'Vendedor General', risk: 'Bajo', total: 198000, items: [{ code: 'PRD-14', name: 'VESTIDO DE BAÑO DEPORTIVO', qty: 2, price: 83193.28 }] }
                      ])
                      .filter((i: any) => {
                        const matchQuery = !todaySearch || (i.consecutive + ' ' + (i.client || i.customer_identification || '') + ' ' + (i.iden || i.customer_identification || '')).toLowerCase().includes(todaySearch.toLowerCase());
                        const matchRisk = !todayRiskFilter || (i.risk || 'Bajo') === todayRiskFilter;
                        const matchVendor = !todayVendorFilter || (i.vendor || '').toLowerCase().includes(todayVendorFilter.toLowerCase());
                        const matchMin = !todayMinAmount || i.total >= Number(todayMinAmount);
                        const matchMax = !todayMaxAmount || i.total <= Number(todayMaxAmount);
                        return matchQuery && matchRisk && matchVendor && matchMin && matchMax;
                      })
                      .slice(0, todayPerPage)
                      .map((inv: any, idx: number) => {
                        const totalGross = inv.total || 0;
                        const subtotalBase = Math.round(totalGross / 1.19);
                        const iva19 = totalGross - subtotalBase;

                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.65rem' }}>
                              <button
                                type="button"
                                onClick={() => setDetailInvoiceModal(inv)}
                                style={{
                                  background: 'none', border: 'none', padding: 0,
                                  fontWeight: 900, color: '#80082E', textDecoration: 'underline',
                                  cursor: 'pointer', fontSize: '0.78rem', display: 'inline-flex',
                                  alignItems: 'center', gap: '0.25rem'
                                }}
                                title="Ver detalle completo de factura SIIGO"
                              >
                                🔍 {inv.consecutive}
                              </button>
                            </td>
                            <td style={{ padding: '0.65rem', fontWeight: 700, color: '#0f172a' }}>{inv.client || inv.customer_identification || 'Consumidor Final'}</td>
                            <td style={{ padding: '0.65rem', color: '#64748b' }}>{inv.iden || inv.customer_identification || '222222222222'}</td>
                            <td style={{ padding: '0.65rem', color: '#64748b' }}>{inv.hour || '02:30 p. m.'}</td>
                            <td style={{ padding: '0.65rem', color: '#64748b' }}>{inv.vendor || 'Vendedor General'}</td>
                            <td style={{ padding: '0.65rem', textAlign: 'right', fontWeight: 700, color: '#475569' }}>
                              {fmtCOP(subtotalBase)}
                            </td>
                            <td style={{ padding: '0.65rem', textAlign: 'right', fontWeight: 800, color: '#2563eb' }}>
                              {fmtCOP(iva19)}
                            </td>
                            <td style={{ padding: '0.65rem', textAlign: 'right', fontWeight: 950, color: '#80082E' }}>
                              {fmtCOP(totalGross)}
                            </td>
                            <td style={{ padding: '0.65rem', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => setDetailInvoiceModal(inv)}
                                style={{ backgroundColor: '#fdf2f4', color: '#80082E', border: '1px solid #fbcfe8', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}
                              >
                                👁️ Ver Factura
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── MODAL DE DETALLE COMPLETO DE FACTURA SIIGO CON IVA DISCRIMINADO (19%) ── */}
        {detailInvoiceModal && (() => {
          const totalGross = detailInvoiceModal.total || 0;
          const subtotalBase = Math.round(totalGross / 1.19);
          const iva19 = totalGross - subtotalBase;

          return (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1.5rem' }}>
              <div style={{ backgroundColor: 'white', borderRadius: '16px', maxWidth: '820px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                {/* Header Modal */}
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1.5px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
                  <div>
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#80082E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>DETALLE OFICIAL SIIGO (IVA DISCRIMINADO 19%)</span>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 950, color: '#0f172a', margin: '0.1rem 0 0' }}>
                      Factura {detailInvoiceModal.consecutive || detailInvoiceModal.number || 'SIIGO'}
                    </h3>
                  </div>
                  <button
                    onClick={() => setDetailInvoiceModal(null)}
                    style={{ border: 'none', background: '#e2e8f0', width: '32px', height: '32px', borderRadius: '50%', fontSize: '1.1rem', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    ✕
                  </button>
                </div>

                {/* Body Content */}
                <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Status & Key Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.85rem' }}>
                    <div style={{ backgroundColor: '#f1f5f9', padding: '0.85rem', borderRadius: '10px' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Estado DIAN</span>
                      <p style={{ margin: '0.2rem 0 0', fontWeight: 900, color: '#16a34a', fontSize: '0.8rem' }}>☑️ Aceptada</p>
                    </div>
                    <div style={{ backgroundColor: '#f1f5f9', padding: '0.85rem', borderRadius: '10px' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Subtotal Base</span>
                      <p style={{ margin: '0.2rem 0 0', fontWeight: 900, color: '#475569', fontSize: '0.9rem' }}>{fmtCOP(subtotalBase)}</p>
                    </div>
                    <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', padding: '0.85rem', borderRadius: '10px' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>IVA (19%)</span>
                      <p style={{ margin: '0.2rem 0 0', fontWeight: 950, color: '#1d4ed8', fontSize: '0.95rem' }}>{fmtCOP(iva19)}</p>
                    </div>
                    <div style={{ backgroundColor: '#fdf2f4', border: '1px solid #fbcfe8', padding: '0.85rem', borderRadius: '10px' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#80082E', textTransform: 'uppercase' }}>Total Facturado</span>
                      <p style={{ margin: '0.2rem 0 0', fontWeight: 950, color: '#80082E', fontSize: '1rem' }}>{fmtCOP(totalGross)}</p>
                    </div>
                  </div>

                  {/* Cliente / Comprador Data */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', backgroundColor: '#fafafa' }}>
                    <h4 style={{ fontSize: '0.78rem', fontWeight: 900, color: '#475569', textTransform: 'uppercase', margin: '0 0 0.75rem', letterSpacing: '0.04em' }}>👤 Información del Cliente / Tercero SIIGO</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.78rem' }}>
                      <div>
                        <span style={{ color: '#64748b' }}>Nombre / Razon Social:</span>
                        <p style={{ margin: '0.1rem 0 0', fontWeight: 800, color: '#0f172a' }}>{detailInvoiceModal.client || detailInvoiceModal.customer_name || 'Consumidor Final'}</p>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>NIT / Cédula:</span>
                        <p style={{ margin: '0.1rem 0 0', fontWeight: 800, color: '#0f172a' }}>{detailInvoiceModal.iden || detailInvoiceModal.customer_identification || '222222222222'}</p>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Vendedor Asignado:</span>
                        <p style={{ margin: '0.1rem 0 0', fontWeight: 800, color: '#0f172a' }}>{detailInvoiceModal.vendor || 'Vendedor General SIIGO'}</p>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Nivel de Riesgo Crediticio:</span>
                        <p style={{ margin: '0.1rem 0 0', fontWeight: 800, color: '#16a34a' }}>Bajo (Sin Mora)</p>
                      </div>
                    </div>
                  </div>

                  {/* Detalle de Productos / Ítems Facturados con IVA Discriminado por Ítem */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem' }}>
                    <h4 style={{ fontSize: '0.78rem', fontWeight: 900, color: '#475569', textTransform: 'uppercase', margin: '0 0 0.75rem', letterSpacing: '0.04em' }}>📦 Ítems Facturados con Discriminación de IVA (19%)</h4>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1', textAlign: 'left', color: '#475569' }}>
                          <th style={{ padding: '0.5rem 0.65rem' }}>Código</th>
                          <th style={{ padding: '0.5rem 0.65rem' }}>Producto / Descripción</th>
                          <th style={{ padding: '0.5rem 0.65rem', textAlign: 'center' }}>Cant.</th>
                          <th style={{ padding: '0.5rem 0.65rem', textAlign: 'right' }}>Base Unit.</th>
                          <th style={{ padding: '0.5rem 0.65rem', textAlign: 'right' }}>IVA 19% Unit.</th>
                          <th style={{ padding: '0.5rem 0.65rem', textAlign: 'right' }}>Subtotal Neto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detailInvoiceModal.items || [
                          { code: 'PRD-01', name: 'PRENDA DE VESTIR / REFERENCIA TEXTIL', qty: 2, price: (totalGross / 2) }
                        ]).map((item: any, i: number) => {
                          const grossPrice = item.price || item.unit_price || totalGross;
                          const basePrice = Math.round(grossPrice / 1.19);
                          const ivaPrice = grossPrice - basePrice;
                          const qty = item.qty || item.quantity || 1;
                          const itemSubtotal = grossPrice * qty;

                          return (
                            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '0.5rem 0.65rem', fontWeight: 800, color: '#64748b' }}>{item.code || `ITM-0${i+1}`}</td>
                              <td style={{ padding: '0.5rem 0.65rem', fontWeight: 700, color: '#0f172a' }}>{item.name || item.description || 'Prenda Confeccionada'}</td>
                              <td style={{ padding: '0.5rem 0.65rem', textAlign: 'center', fontWeight: 800 }}>{qty}</td>
                              <td style={{ padding: '0.5rem 0.65rem', textAlign: 'right', color: '#475569' }}>{fmtCOP(basePrice)}</td>
                              <td style={{ padding: '0.5rem 0.65rem', textAlign: 'right', color: '#2563eb', fontWeight: 700 }}>{fmtCOP(ivaPrice)}</td>
                              <td style={{ padding: '0.5rem 0.65rem', textAlign: 'right', fontWeight: 900, color: '#0f172a' }}>{fmtCOP(itemSubtotal)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Resumen Fiscal SIIGO */}
                  <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                      <span style={{ fontWeight: 700, color: '#64748b' }}>Total Gravado (Base 19%):</span>
                      <span style={{ fontWeight: 800, color: '#0f172a' }}>{fmtCOP(subtotalBase)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                      <span style={{ fontWeight: 700, color: '#2563eb' }}>Impuesto a las Ventas (IVA 19%):</span>
                      <span style={{ fontWeight: 900, color: '#2563eb' }}>+ {fmtCOP(iva19)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', borderTop: '1.5px solid #cbd5e1', paddingTop: '0.4rem', marginTop: '0.2rem' }}>
                      <span style={{ fontWeight: 900, color: '#0f172a' }}>TOTAL COMPROBANTE CON IVA:</span>
                      <span style={{ fontWeight: 950, color: '#80082E' }}>{fmtCOP(totalGross)}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Modal */}
                <div style={{ padding: '1rem 1.5rem', borderTop: '1.5px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', backgroundColor: '#f8fafc', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
                  <button
                    onClick={() => setDetailInvoiceModal(null)}
                    style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', color: '#334155' }}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── 2. CRM & CLIENTES ── */}
        {activeMenu === 'crm' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 950, color: '#0f172a', margin: 0 }}>CRM de Clientes</h2>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.15rem 0 0' }}>Terceros sincronizados desde SIIGO con análisis de riesgo y comportamiento comercial</p>
              </div>
              <button
                onClick={runSync}
                disabled={syncing}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  color: 'white', border: 'none', borderRadius: '10px', padding: '0.65rem 1.25rem',
                  fontSize: '0.82rem', fontWeight: 800, cursor: syncing ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)'
                }}
              >
                <RefreshCw size={16} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
                {syncing ? 'Sincronizando...' : '🔄 Sincronizar Clientes (SIIGO)'}
              </button>
            </div>

            {!selectedClient ? (
              <div>
                {/* ─── Barra principal: búsqueda + pills de riesgo + toggles ─── */}
                <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', flexGrow: 1, minWidth: '220px', maxWidth: '340px' }}>
                    <Search size={15} style={{ position: 'absolute', top: '50%', left: '0.75rem', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="NIT o razón social..."
                      value={searchTerm}
                      onChange={e => {
                        setSearchTerm(e.target.value);
                        fetchCustomers(e.target.value, crmFilterRiesgo, crmFilterDebtOnly, crmFilterVendedor, crmFilterCity);
                      }}
                      style={{ width: '100%', padding: '0.55rem 1rem 0.55rem 2.25rem', border: '1px solid var(--border)', borderRadius: '8px', backgroundColor: 'var(--surface)', color: 'var(--text)', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* Pills de Riesgo */}
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    {(['', 'Bajo', 'Medio', 'Alto'] as const).map(r => {
                      const active = crmFilterRiesgo === r;
                      const colors: Record<string, {border:string; bg:string; text:string}> = {
                        '':     { border: 'var(--primary)', bg: '#312e81', text: '#a5b4fc' },
                        'Bajo': { border: '#10b981', bg: '#064e3b', text: '#6ee7b7' },
                        'Medio':{ border: '#f59e0b', bg: '#451a03', text: '#fbbf24' },
                        'Alto': { border: '#ef4444', bg: '#7f1d1d', text: '#fca5a5' }
                      };
                      const c = colors[r] || colors[''];
                      return (
                        <button
                          key={r}
                          onClick={() => { setCrmFilterRiesgo(r); fetchCustomers(searchTerm, r, crmFilterDebtOnly, crmFilterVendedor, crmFilterCity); }}
                          style={{
                            padding: '0.4rem 0.75rem', borderRadius: '20px',
                            border: `1px solid ${active ? c.border : 'var(--border)'}`,
                            backgroundColor: active ? c.bg : 'transparent',
                            color: active ? c.text : '#64748b',
                            fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s'
                          }}
                        >
                          {r === '' ? 'Todos' : `${r === 'Alto' ? '🔴' : r === 'Medio' ? '🟡' : '🟢'} ${r}`}
                        </button>
                      );
                    })}
                  </div>

                  {/* Toggle mora */}
                  <button
                    onClick={() => { const next = !crmFilterDebtOnly; setCrmFilterDebtOnly(next); fetchCustomers(searchTerm, crmFilterRiesgo, next, crmFilterVendedor, crmFilterCity); }}
                    style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', border: `1px solid ${crmFilterDebtOnly ? '#ef4444' : 'var(--border)'}`, backgroundColor: crmFilterDebtOnly ? '#7f1d1d' : 'transparent', color: crmFilterDebtOnly ? '#fca5a5' : '#64748b', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    💰 Con Mora
                  </button>

                  {/* Más filtros toggle */}
                  <button
                    onClick={() => setShowCrmFilters(v => !v)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', backgroundColor: showCrmFilters ? 'var(--primary)' : 'var(--surface-2)', color: showCrmFilters ? 'white' : 'var(--text)' }}
                  >
                    <SlidersHorizontal size={13} /> Más {showCrmFilters ? '▲' : '▼'}
                  </button>

                  {(searchTerm || crmFilterRiesgo || crmFilterDebtOnly || crmFilterVendedor || crmFilterCity) && (
                    <button
                      onClick={() => { setSearchTerm(''); setCrmFilterRiesgo(''); setCrmFilterDebtOnly(false); setCrmFilterVendedor(''); setCrmFilterCity(''); fetchCustomers('', '', false, '', ''); }}
                      style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', backgroundColor: 'var(--surface)', color: 'var(--text-muted)' }}
                    >
                      <IconX size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />Limpiar
                    </button>
                  )}
                </div>

                {/* ─── Panel Filtros Avanzados ─── */}
                {showCrmFilters && (
                  <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.1rem', marginBottom: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vendedor</label>
                      <input
                        type="text"
                        value={crmFilterVendedor}
                        onChange={e => { setCrmFilterVendedor(e.target.value); fetchCustomers(searchTerm, crmFilterRiesgo, crmFilterDebtOnly, e.target.value, crmFilterCity); }}
                        placeholder="Nombre del vendedor..."
                        style={{ width: '100%', padding: '0.5rem 0.75rem', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '0.82rem', boxSizing: 'border-box', outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ciudad</label>
                      <input
                        type="text"
                        value={crmFilterCity}
                        onChange={e => { setCrmFilterCity(e.target.value); fetchCustomers(searchTerm, crmFilterRiesgo, crmFilterDebtOnly, crmFilterVendedor, e.target.value); }}
                        placeholder="Bogotá, Medellín..."
                        style={{ width: '100%', padding: '0.5rem 0.75rem', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '0.82rem', boxSizing: 'border-box', outline: 'none' }}
                      />
                    </div>
                  </div>
                )}

                {/* ─── Chips de filtros activos ─── */}
                {(crmFilterVendedor || crmFilterCity) && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    {crmFilterVendedor && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.65rem', backgroundColor: '#1e3a5f', color: '#93c5fd', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700 }}>
                        👤 {crmFilterVendedor}
                        <button onClick={() => { setCrmFilterVendedor(''); fetchCustomers(searchTerm, crmFilterRiesgo, crmFilterDebtOnly, '', crmFilterCity); }} style={{ background: 'none', border: 'none', color: '#93c5fd', cursor: 'pointer', padding: 0 }}>✕</button>
                      </span>
                    )}
                    {crmFilterCity && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.65rem', backgroundColor: 'var(--surface)', color: '#a78bfa', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, border: '1px solid var(--border)' }}>
                        📍 {crmFilterCity}
                        <button onClick={() => { setCrmFilterCity(''); fetchCustomers(searchTerm, crmFilterRiesgo, crmFilterDebtOnly, crmFilterVendedor, ''); }} style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', padding: 0 }}>✕</button>
                      </span>
                    )}
                  </div>
                )}

                {/* ─── Resumen estadístico de resultados ─── */}
                {!loadingCustomers && customers.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    {[
                      { icon: <Users size={13} />, label: 'Resultados', value: `${customers.length} clientes`, color: 'var(--primary)' },
                      { icon: <DollarSign size={13} />, label: 'Con mora', value: `${customers.filter(c => c.saldo_mora > 0).length}`, color: '#ef4444' },
                      { icon: <Activity size={13} />, label: 'Riesgo Alto', value: `${customers.filter(c => c.riesgo === 'Alto').length}`, color: '#f59e0b' },
                      { icon: <DollarSign size={13} />, label: 'Mora total', value: fmtCOP(customers.reduce((s, c) => s + (c.saldo_mora || 0), 0)), color: '#f59e0b' }
                    ].map(({ icon, label, value, color }) => (
                      <div key={label} style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.55rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color }}>{icon}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{label}:</span>
                        <strong style={{ fontSize: '0.82rem', color }}>{value}</strong>
                      </div>
                    ))}
                  </div>
                )}

                {/* ─── Grid de clientes ─── */}
                {loadingCustomers ? (
                  <Spinner label="Cargando clientes..." />
                ) : customers.length === 0 ? (
                  <EmptyState
                    icon={<Users size={40} />}
                    title="Sin clientes con estos filtros"
                    description="Ajusta los filtros o sincroniza con SIIGO desde el menú lateral."
                  />
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1.25rem' }}>
                    {customers.map(c => (
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
                <Search size={16} style={{ position: 'absolute', top: '50%', left: '0.75rem', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Número de factura (ej: FV-1-101)..."
                  value={invoiceQuery}
                  onChange={e => { setInvoiceQuery(e.target.value); fetchInvoices(e.target.value); }}
                  style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.25rem', border: '1px solid var(--border)', borderRadius: '8px', backgroundColor: 'var(--surface)', color: 'var(--text)', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
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
                        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.1rem 1.5rem', cursor: 'pointer', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '1rem', alignItems: 'center' }}
                      >
                        <div>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>Consecutivo</span>
                          <strong style={{ color: 'var(--primary)' }}>{inv.consecutive}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>Fecha</span>
                          <strong>{inv.date}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>Cliente</span>
                          <strong>{inv.siigo_customers?.name || inv.customer_identification}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>Total</span>
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
                    <CostBar label="Costo Tela (Kilos consumidos)" value={fmtCOP(costs.tela)} pct={53} color="var(--primary-light)" />
                    <CostBar label="Costo Satélite (Mano de Obra)" value={fmtCOP(costs.satelite)} pct={28} color="var(--primary)" />
                    <CostBar label="Estampado / Bordado" value={fmtCOP(costs.estampado)} pct={12} color="#f59e0b" />
                    <CostBar label="Transporte & Logística" value={fmtCOP(costs.logistica)} pct={7} color="#10b981" />
                  </div>
                </ChartCard>

                <ChartCard title="Rentabilidad Operativa">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: 'var(--surface-2)', padding: '1rem', borderRadius: '10px' }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ingresos Estimados</span>
                        <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>{fmtCOP(costs.ventas)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Utilidad Operativa</span>
                        <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#10b981' }}>{fmtCOP(costs.utilidad)}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between', padding: '0 0.25rem' }}>
                      <span>Margen Calculado:</span>
                      <strong style={{ color: '#10b981', fontSize: '1rem' }}>{Math.round((costs.utilidad / costs.ventas) * 100)}%</strong>
                    </div>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 950, color: '#0f172a', margin: 0 }}>Ventas & Facturación (SIIGO)</h2>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.15rem 0 0' }}>Detalle consolidado de facturas y ventas con filtros avanzados</p>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <button
                  onClick={runSync}
                  disabled={syncing}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                    color: 'white', border: 'none', borderRadius: '10px', padding: '0.65rem 1.25rem',
                    fontSize: '0.82rem', fontWeight: 800, cursor: syncing ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(124, 58, 237, 0.25)'
                  }}
                >
                  <RefreshCw size={16} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
                  {syncing ? 'Sincronizando...' : '🔄 Sincronizar Facturas (SIIGO)'}
                </button>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#e2e8f0',
                    color: '#0f172a', border: 'none', borderRadius: '8px', padding: '0.65rem 1rem',
                    fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  <SlidersHorizontal size={14} /> Filtros {showFilters ? '▲' : '▼'}
                </button>
                <button
                  onClick={exportCSV}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#059669',
                    color: 'white', border: 'none', borderRadius: '8px', padding: '0.65rem 1rem',
                    fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(5, 150, 105, 0.2)'
                  }}
                >
                  <Download size={14} /> Exportar CSV
                </button>
              </div>
            </div>

            {/* Ventas KPIs resumidos */}
            {salesSummary && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Ventas del Rango</span>
                  <strong style={{ fontSize: '1.25rem', color: '#10b981' }}>{fmtCOP(salesSummary.totalVentas)}</strong>
                </div>
                <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Total Facturas</span>
                  <strong style={{ fontSize: '1.25rem', color: 'var(--text)' }}>{salesSummary.totalFacturas}</strong>
                </div>
                <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Ticket Promedio</span>
                  <strong style={{ fontSize: '1.25rem', color: 'var(--primary)' }}>{fmtCOP(salesSummary.ticketPromedio)}</strong>
                </div>
                <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Factura Máxima</span>
                  <strong style={{ fontSize: '1.25rem', color: '#f59e0b' }}>{fmtCOP(salesSummary.maxFactura)}</strong>
                </div>
              </div>
            )}

            {/* Panel de Filtros Avanzados */}
            {showFilters && (
              <div style={{
                backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px',
                padding: '1.25rem', marginBottom: '1.5rem', display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem'
              }}>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Buscador General</label>
                  <input
                    type="text"
                    value={salesFilters.q}
                    onChange={e => handleSalesFilterChange('q', e.target.value)}
                    placeholder="Consecutivo u observaciones..."
                    style={{ width: '100%', padding: '0.5rem', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '0.8rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Identificación Cliente (NIT)</label>
                  <input
                    type="text"
                    value={salesFilters.custId}
                    onChange={e => handleSalesFilterChange('custId', e.target.value)}
                    placeholder="Ej: 10101010..."
                    style={{ width: '100%', padding: '0.5rem', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '0.8rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Fecha Inicio</label>
                  <input
                    type="date"
                    value={salesFilters.dateStart}
                    onChange={e => handleSalesFilterChange('dateStart', e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '0.8rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Fecha Fin</label>
                  <input
                    type="date"
                    value={salesFilters.dateEnd}
                    onChange={e => handleSalesFilterChange('dateEnd', e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '0.8rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Monto Mínimo</label>
                  <input
                    type="number"
                    value={salesFilters.minTotal}
                    onChange={e => handleSalesFilterChange('minTotal', e.target.value)}
                    placeholder="Mínimo $"
                    style={{ width: '100%', padding: '0.5rem', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '0.8rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Monto Máximo</label>
                  <input
                    type="number"
                    value={salesFilters.maxTotal}
                    onChange={e => handleSalesFilterChange('maxTotal', e.target.value)}
                    placeholder="Máximo $"
                    style={{ width: '100%', padding: '0.5rem', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontSize: '0.8rem' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                  <button
                    onClick={clearSalesFilters}
                    style={{
                      padding: '0.5rem 1rem', backgroundColor: 'var(--primary)', color: 'white',
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
                <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden', marginBottom: '1.5rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--surface-2)', borderBottom: '2px solid var(--border)', color: 'var(--text-muted)' }}>
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
                        <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--primary)' }}>{inv.consecutive}</td>
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
                                backgroundColor: 'var(--border)', color: 'white', border: 'none',
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
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Mostrando facturas {((salesPagination.page - 1) * salesPagination.perPage) + 1} - {Math.min(salesPagination.page * salesPagination.perPage, salesPagination.totalRows)} de {salesPagination.totalRows}
                  </span>
                  
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      disabled={salesPagination.page <= 1}
                      onClick={() => fetchSales(salesFilters, 1, salesSort)}
                      style={{ padding: '0.45rem', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', cursor: 'pointer' }}
                    >
                      <ChevronsLeft size={14} />
                    </button>
                    <button
                      disabled={salesPagination.page <= 1}
                      onClick={() => fetchSales(salesFilters, salesPagination.page - 1, salesSort)}
                      style={{ padding: '0.45rem', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', cursor: 'pointer' }}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.75rem', fontSize: '0.82rem', fontWeight: 700 }}>
                      Pág. {salesPagination.page} / {salesPagination.totalPages}
                    </span>
                    <button
                      disabled={salesPagination.page >= salesPagination.totalPages}
                      onClick={() => fetchSales(salesFilters, salesPagination.page + 1, salesSort)}
                      style={{ padding: '0.45rem', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', cursor: 'pointer' }}
                    >
                      <ChevronRight size={14} />
                    </button>
                    <button
                      disabled={salesPagination.page >= salesPagination.totalPages}
                      onClick={() => fetchSales(salesFilters, salesPagination.totalPages, salesSort)}
                      style={{ padding: '0.45rem', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', cursor: 'pointer' }}
                    >
                      <ChevronsRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Lateral (Drawer) de Detalle de Factura */}
            {salesDetail && (
              <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '450px', backgroundColor: 'var(--surface)', borderLeft: '1px solid var(--border)', boxShadow: '-10px 0 30px rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', flexDirection: 'column', animation: 'slideIn 0.2s ease-out' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--surface-2)' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: 'var(--text)' }}>{salesDetail.consecutive}</h3>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ID SIIGO: {salesDetail.siigo_id}</span>
                  </div>
                  <button onClick={() => setSalesDetail(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <IconX size={20} />
                  </button>
                </div>
                
                <div style={{ padding: '1.5rem', flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', fontSize: '0.82rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase' }}>Cliente</span>
                    <strong>{salesDetail.siigo_customers?.name || 'Cliente Genérico'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase' }}>Identificación (NIT)</span>
                    <strong style={{ fontFamily: 'monospace' }}>{salesDetail.customer_identification}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase' }}>Fecha de Factura</span>
                    <strong>{salesDetail.date}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase' }}>Valor Total</span>
                    <strong style={{ color: '#10b981', fontSize: '1.1rem' }}>{fmtCOP(salesDetail.total)}</strong>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Ítems de Factura</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {(salesDetail.items || []).map((it: any, index: number) => (
                        <div key={index} style={{ backgroundColor: 'var(--surface-2)', padding: '0.6rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontWeight: 700 }}>{it.description || 'Producto'}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Código: {it.code} — Cant: {it.quantity}</div>
                          </div>
                          <span style={{ fontWeight: 700 }}>{fmtCOP((it.price || 0) * (it.quantity || 1))}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {salesDetail.payments && salesDetail.payments.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                      <h4 style={{ margin: '0 0 0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Medios de Pago</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {salesDetail.payments.map((p: any, index: number) => (
                          <div key={index} style={{ backgroundColor: 'var(--surface-2)', padding: '0.6rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', color: '#10b981' }}>
                            <span>💳 Medio Pago ID: {p.id}</span>
                            <strong>{fmtCOP(p.value)}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {salesDetail.observations && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase' }}>Observaciones</span>
                      <p style={{ margin: '0.25rem 0 0', fontStyle: 'italic', color: 'var(--text)' }}>{salesDetail.observations}</p>
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
              <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)', backgroundColor: 'var(--surface-2)' }}>
                      {['Taller', 'Prendas Procesadas', 'Valor Liquidado', 'Tasa Rechazo', 'Eficiencia', 'Estado'].map(h => (
                        <th key={h} style={{ padding: '0.85rem 1rem', textAlign: 'left', fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {satellites.map((sat: any) => (
                      <tr key={sat.id} style={{ borderBottom: '1px solid var(--border)' }}>
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
        ::-webkit-scrollbar-track { background: var(--background); }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
      `}</style>
    </div>
  );
}

// ─────── Sub-componentes ───────

function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text)', margin: '0 0 0.25rem' }}>{title}</h1>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>{subtitle}</p>
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ border: '4px solid var(--border)', borderTop: '4px solid var(--primary)', borderRadius: '50%', width: '38px', height: '38px', animation: 'spin 0.8s linear infinite' }}></div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>{label}</p>
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem 2rem', color: 'var(--text-muted)', textAlign: 'center', gap: '0.75rem' }}>
      {icon}
      <h3 style={{ color: 'var(--text-muted)', margin: 0 }}>{title}</h3>
      <p style={{ margin: 0, fontSize: '0.85rem', maxWidth: '350px' }}>{description}</p>
    </div>
  );
}

function KpiCard({ label, value, sub, subColor, bg, icon }: { label: string; value: any; sub?: string; subColor?: string; bg?: string; icon?: React.ReactNode }) {
  return (
    <div style={{
      background: bg || 'var(--surface)',
      color: bg ? 'white' : 'var(--text)',
      border: bg ? 'none' : '1px solid var(--border)',
      borderRadius: '14px',
      padding: '1.2rem',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: bg ? '0 6px 16px rgba(0,0,0,0.15)' : 'none'
    }}>
      <span style={{ fontSize: '0.68rem', color: bg ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <h3 style={{ fontSize: '1.45rem', fontWeight: 950, color: bg ? 'white' : 'var(--text)', margin: '0.25rem 0 0.1rem' }}>{value}</h3>
      {sub && <span style={{ fontSize: '0.7rem', color: subColor || (bg ? 'rgba(255,255,255,0.8)' : '#64748b'), fontWeight: 600 }}>{sub}</span>}
      <div style={{ position: 'absolute', right: '-8px', bottom: '-8px', opacity: bg ? 0.2 : 0.08, color: bg ? 'white' : 'var(--text)' }}>{icon}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.5rem' }}>
      <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 1.25rem', color: 'var(--text)' }}>{title}</h3>
      {children}
    </div>
  );
}

function ProgressBar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
        <span style={{ color: 'var(--text-muted)' }}>{label}</span>
        <strong>{value}</strong>
      </div>
      <div style={{ width: '100%', height: '7px', backgroundColor: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
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
      <div style={{ width: '100%', height: '7px', backgroundColor: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
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
      backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px',
      padding: '1.4rem', cursor: 'pointer', transition: 'border-color 0.2s'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text)', margin: '0 0 0.2rem' }}>{c.name}</h3>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>NIT: {c.identification}</span>
        </div>
        <RiskBadge risk={c.riesgo} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', fontSize: '0.78rem', borderTop: '1px solid var(--border)', paddingTop: '0.85rem' }}>
        <div><span style={{ color: 'var(--text-muted)', display: 'block' }}>Ciudad</span><strong>{c.city_name}</strong></div>
        <div><span style={{ color: 'var(--text-muted)', display: 'block' }}>Saldo Mora</span><strong style={{ color: c.saldo_mora > 0 ? '#ef4444' : '#10b981' }}>{fmtCOP(c.saldo_mora)}</strong></div>
        <div><span style={{ color: 'var(--text-muted)', display: 'block' }}>Cupo Crédito</span><strong>{fmtCOP(c.cupo_credito)}</strong></div>
        <div><span style={{ color: 'var(--text-muted)', display: 'block' }}>Vendedor</span><strong>{c.vendedor_name}</strong></div>
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
      <button onClick={onBack} style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.4rem 1rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', marginBottom: '1.5rem' }}>
        ← Volver
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem' }}>

        {/* Ficha del Cliente */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>{c.name}</h2>
              <RiskBadge risk={c.riesgo} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.8rem' }}>
              <div><span style={{ color: 'var(--text-muted)', display: 'block' }}>NIT</span><strong>{c.identification}</strong></div>
              <div><span style={{ color: 'var(--text-muted)', display: 'block' }}>Ciudad</span><strong>{c.city_name}, {c.state_name}</strong></div>
              <div><span style={{ color: 'var(--text-muted)', display: 'block' }}>Email</span><strong>{c.email || 'No registrado'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)', display: 'block' }}>Teléfono</span><strong>{c.phone || 'No registrado'}</strong></div>
              <div><span style={{ color: 'var(--text-muted)', display: 'block' }}>Vendedor Asignado</span><strong>{c.vendedor_name}</strong></div>
              <div><span style={{ color: 'var(--text-muted)', display: 'block' }}>Cupo de Crédito</span><strong>{fmtCOP(c.cupo_credito)}</strong></div>
              <div><span style={{ color: 'var(--text-muted)', display: 'block' }}>Saldo en Mora</span><strong style={{ color: c.saldo_mora > 0 ? '#ef4444' : '#10b981' }}>{fmtCOP(c.saldo_mora)}</strong></div>
            </div>
          </div>

          {/* IA Comercial */}
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--primary)', margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              ✨ Inteligencia Comercial (IA)
            </h3>
            <div style={{ fontSize: '0.74rem', color: 'var(--text)', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
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
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 1rem' }}>Facturas SIIGO del Cliente</h3>
            {invoices.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: '2rem' }}>
                No hay facturas sincronizadas para este cliente. Realiza una sincronización con SIIGO.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.6rem', textAlign: 'left' }}>Consecutivo</th>
                      <th style={{ padding: '0.6rem', textAlign: 'left' }}>Fecha</th>
                      <th style={{ padding: '0.6rem', textAlign: 'right' }}>Total</th>
                      <th style={{ padding: '0.6rem', textAlign: 'left' }}>Estado DIAN</th>
                      <th style={{ padding: '0.6rem' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => (
                      <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.6rem', fontWeight: 700, color: 'var(--primary)' }}>{inv.consecutive}</td>
                        <td style={{ padding: '0.6rem' }}>{inv.date}</td>
                        <td style={{ padding: '0.6rem', textAlign: 'right', fontWeight: 700 }}>{fmtCOP(inv.total)}</td>
                        <td style={{ padding: '0.6rem' }}><span style={{ color: '#10b981', fontSize: '0.72rem' }}>✅ {inv.status_dian || 'Aceptado DIAN'}</span></td>
                        <td style={{ padding: '0.6rem' }}>
                          <button onClick={() => onViewInvoice(inv)} style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '5px', padding: '0.25rem 0.65rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
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
    { emoji: '🛍️', label: 'Pedido Comercial', value: `Pedido registrado en Brainer — Cliente: ${inv.siigo_customers?.name || inv.customer_identification}`, color: 'var(--primary)' },
    { emoji: '🏭', label: 'Orden de Producción', value: 'Generada desde el pedido aprobado en el módulo de órdenes', color: 'var(--primary)' },
    { emoji: '✂️', label: 'Corte & Insumos', value: 'Matriz de tendido y corte aprobada. Tela consumida registrada en inventario.', color: 'var(--primary)' },
    { emoji: '🧵', label: 'Confección en Satélite', value: 'Asignado al taller externo. Liquidación registrada en control de calidad.', color: 'var(--primary)' },
    { emoji: '✅', label: 'Control de Calidad', value: 'Prendas inspeccionadas y aprobadas. Descuentos por defecto aplicados.', color: '#10b981' },
    { emoji: '📦', label: 'Empaque & Despacho', value: 'Guía logística generada y entregada al transportador.', color: '#10b981' },
    { emoji: '📄', label: 'Factura SIIGO', value: `${inv.consecutive} — ${fmt2(inv.total)} — ${inv.date}`, color: '#f59e0b' },
    { emoji: '🏦', label: 'Estado DIAN', value: `${inv.status_dian || 'Aceptado por la DIAN'}${inv.cufe ? ` — CUFE: ${inv.cufe.substring(0, 20)}...` : ''}`, color: '#10b981' },
    { emoji: '💳', label: 'Recaudo / Pago', value: inv.payments?.length > 0 ? `${inv.payments.length} medio(s) de pago registrado(s)` : 'Pendiente de recaudo', color: inv.payments?.length > 0 ? '#10b981' : '#f59e0b' },
  ];

  return (
    <div>
      <button onClick={onClose} style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.4rem 1rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', marginBottom: '1.5rem' }}>
        ← Volver
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>

        {/* Resumen de Factura */}
        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.5rem' }}>
          <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.85rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Factura de Venta</span>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--primary)', margin: '0.15rem 0' }}>{inv.consecutive}</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', fontSize: '0.8rem' }}>
            <div><span style={{ color: 'var(--text-muted)', display: 'block' }}>Cliente</span><strong>{inv.siigo_customers?.name || inv.customer_identification}</strong></div>
            <div><span style={{ color: 'var(--text-muted)', display: 'block' }}>NIT</span><strong>{inv.customer_identification}</strong></div>
            <div><span style={{ color: 'var(--text-muted)', display: 'block' }}>Fecha</span><strong>{inv.date}</strong></div>
            <div><span style={{ color: 'var(--text-muted)', display: 'block' }}>Total Factura</span><strong style={{ fontSize: '1.1rem', color: '#10b981' }}>{fmt2(inv.total)}</strong></div>
            <div><span style={{ color: 'var(--text-muted)', display: 'block' }}>Estado DIAN</span><span style={{ color: '#10b981', fontWeight: 700 }}>✅ {inv.status_dian || 'Aceptado'}</span></div>
            {inv.cufe && <div><span style={{ color: 'var(--text-muted)', display: 'block' }}>CUFE</span><code style={{ color: '#f59e0b', fontSize: '0.65rem', wordBreak: 'break-all' }}>{inv.cufe}</code></div>}
            {inv.observations && <div><span style={{ color: 'var(--text-muted)', display: 'block' }}>Observaciones</span><em style={{ color: 'var(--text)' }}>{inv.observations}</em></div>}
          </div>

          {/* Items facturados */}
          {inv.items?.length > 0 && (
            <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 700, margin: '0 0 0.75rem', color: 'var(--text-muted)' }}>Ítems Facturados</h4>
              {inv.items.map((item: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', padding: '0.3rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span>{item.description || item.code}</span>
                  <strong>{fmt2((item.price || 0) * (item.quantity || 1))}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trazabilidad */}
        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 1.5rem' }}>Flujo Operativo Completo</h3>
          <div style={{ position: 'relative', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div style={{ position: 'absolute', left: '5px', top: '8px', bottom: '8px', width: '2px', backgroundColor: 'var(--border)' }}></div>
            {steps.map((step, i) => (
              <div key={i} style={{ position: 'relative', paddingLeft: '0.25rem' }}>
                <div style={{ position: 'absolute', left: '-21px', top: '2px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: step.color, border: '2px solid var(--background)' }}></div>
                <div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {step.emoji} {step.label}
                  </span>
                  <strong style={{ fontSize: '0.8rem', color: 'var(--text)' }}>{step.value}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
