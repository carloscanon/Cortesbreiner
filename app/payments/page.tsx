'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  CreditCard, CheckCircle2, Clock, DollarSign, Users, FileText, Printer,
  Search, X, Loader2, ChevronDown, ChevronUp, AlertCircle, Building2,
  Banknote, Receipt, Calendar, Filter, RefreshCw, TrendingUp, Eye
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface Inspection {
  id: string;
  created_at: string;
  closed_at: string | null;
  order_id: string | null;
  sewing_order_id: string | null;
  workshop_name: string;
  items_inspected: number;
  items_approved: number;
  items_rejected: number;
  valor_prenda: number;
  descuento_defectos: number;
  pago_empaque: number;
  valor_pagar: number;
  pago_status: string;
  status: string;
  notes: string;
  lavanderia: number;
  saldos: number;
  costuras: number;
  operator_name: string;
  sewing_orders?: {
    id: string;
    confeccion_code: string;
    status: string;
    workshops?: { id: string; nombre_taller: string; responsable?: string; };
    parent_order?: { id: string; client_name?: string; internal_code?: string; };
  };
  orders?: { id: string; consecutive?: string; internal_code?: string; client_name?: string; brand?: string; };
}

interface WorkshopGroup {
  workshopId: string;
  workshopName: string;
  responsable: string;
  inspections: Inspection[];
  totalPrendas: number;
  totalBruto: number;
  totalDescuentos: number;
  totalEmpaque: number;
  totalNeto: number;
}

interface Payment {
  id: string;
  created_at: string;
  paid_at: string | null;
  workshop_name: string;
  inspection_ids: string[];
  total_prendas: number;
  total_bruto: number;
  total_descuentos: number;
  total_neto: number;
  metodo_pago: string;
  numero_referencia: string | null;
  observaciones: string | null;
  status: string;
  created_by: string | null;
  paid_by: string | null;
}

const METODOS_PAGO = ['Transferencia Bancaria', 'Efectivo', 'Cheque', 'Nequi', 'Daviplata', 'Otro'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCOP(n: number) {
  return `$${n.toLocaleString('es-CO')}`;
}
function fmtDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Printable Receipt ─────────────────────────────────────────────────────────

function PrintReceipt({ group, paymentRef, metodo, obs, companyName, paymentNumber }: {
  group: WorkshopGroup;
  paymentRef: string;
  metodo: string;
  obs: string;
  companyName: string;
  paymentNumber: string;
}) {
  return (
    <div id="printable-receipt" style={{ fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#000', padding: '20px', maxWidth: '680px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', borderBottom: '2.5px solid #000', paddingBottom: '12px', marginBottom: '12px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: '900', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{companyName}</h1>
        <p style={{ margin: '2px 0 0', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555' }}>Comprobante de Pago a Taller Satélite</p>
        <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#444' }}>No. Comprobante: <strong>{paymentNumber}</strong> | Fecha: <strong>{new Date().toLocaleDateString('es-CO')}</strong></p>
      </div>
      {/* Workshop Info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '8px', background: '#f5f5f5', borderRadius: '4px', marginBottom: '12px' }}>
        <div>
          <p style={{ margin: 0, fontWeight: '800', fontSize: '10px', textTransform: 'uppercase', color: '#555' }}>Taller Satélite</p>
          <p style={{ margin: '2px 0 0', fontWeight: '900', fontSize: '13px' }}>{group.workshopName}</p>
          <p style={{ margin: '1px 0 0', fontSize: '10px' }}>Responsable: {group.responsable || '—'}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontWeight: '800', fontSize: '10px', textTransform: 'uppercase', color: '#555' }}>Método de Pago</p>
          <p style={{ margin: '2px 0 0', fontWeight: '900', fontSize: '12px' }}>{metodo}</p>
          {paymentRef && <p style={{ margin: '1px 0 0', fontSize: '10px' }}>Ref: {paymentRef}</p>}
        </div>
      </div>
      {/* Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', marginBottom: '12px' }}>
        <thead>
          <tr style={{ background: '#000', color: '#fff' }}>
            {['Orden Conf.', 'Cliente', 'Aprobadas', 'Tarifa/Prenda', 'Descuentos', 'Neto'].map(h => (
              <th key={h} style={{ padding: '5px 6px', textAlign: 'left', fontWeight: '800', fontSize: '9px', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {group.inspections.map((insp, idx) => (
            <tr key={insp.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f8f8f8', borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '5px 6px', fontWeight: '800' }}>{insp.sewing_orders?.confeccion_code || insp.orders?.internal_code || '—'}</td>
              <td style={{ padding: '5px 6px' }}>{insp.sewing_orders?.parent_order?.client_name || insp.orders?.client_name || '—'}</td>
              <td style={{ padding: '5px 6px', fontWeight: '700', textAlign: 'center' }}>{insp.items_approved}</td>
              <td style={{ padding: '5px 6px', textAlign: 'right' }}>{formatCOP(insp.valor_prenda || 0)}</td>
              <td style={{ padding: '5px 6px', textAlign: 'right', color: '#c00' }}>{formatCOP(insp.descuento_defectos || 0)}</td>
              <td style={{ padding: '5px 6px', fontWeight: '900', textAlign: 'right' }}>{formatCOP(insp.valor_pagar || 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Totals */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <div style={{ minWidth: '260px', border: '2px solid #000', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px', background: '#f5f5f5' }}>
            <span style={{ fontWeight: '700', fontSize: '10px' }}>Total Prendas:</span>
            <span style={{ fontWeight: '900' }}>{group.totalPrendas}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px' }}>
            <span style={{ fontWeight: '700', fontSize: '10px' }}>Subtotal Bruto:</span>
            <span>{formatCOP(group.totalBruto)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px', background: '#fff0f0' }}>
            <span style={{ fontWeight: '700', fontSize: '10px', color: '#c00' }}>(-) Descuentos:</span>
            <span style={{ color: '#c00' }}>-{formatCOP(group.totalDescuentos)}</span>
          </div>
          {group.totalEmpaque > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px', background: '#f0fff0' }}>
              <span style={{ fontWeight: '700', fontSize: '10px', color: '#008' }}>(+) Empaque:</span>
              <span style={{ color: '#008' }}>+{formatCOP(group.totalEmpaque)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: '#000', color: '#fff' }}>
            <span style={{ fontWeight: '900', fontSize: '12px', textTransform: 'uppercase' }}>TOTAL NETO A PAGAR:</span>
            <span style={{ fontWeight: '900', fontSize: '13px' }}>{formatCOP(group.totalNeto)}</span>
          </div>
        </div>
      </div>
      {/* Observations */}
      {obs && (
        <div style={{ marginBottom: '14px', padding: '6px 10px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '4px', fontSize: '10px' }}>
          <strong>Observaciones:</strong> {obs}
        </div>
      )}
      {/* Signatures */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '30px' }}>
        {[{ label: 'Empresa', sub: companyName }, { label: 'Taller Satélite', sub: group.workshopName }].map(s => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ borderTop: '1.5px solid #000', paddingTop: '5px' }}>
              <p style={{ margin: 0, fontWeight: '700', fontSize: '10px' }}>Firma y Sello: {s.label}</p>
              <p style={{ margin: '1px 0 0', fontSize: '9px', color: '#555' }}>{s.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function WorkshopPaymentsPage() {
  // Data
  const [pendingInspections, setPendingInspections] = useState<Inspection[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('CORTES BREINER S.A.S.');
  const [currentUser, setCurrentUser] = useState<any>(null);

  // UI State
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [searchHistory, setSearchHistory] = useState('');
  const [historyStatus, setHistoryStatus] = useState('all');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<WorkshopGroup | null>(null);
  const [metodo, setMetodo] = useState('Transferencia Bancaria');
  const [paymentRef, setPaymentRef] = useState('');
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // View payment detail modal
  const [viewingPayment, setViewingPayment] = useState<Payment | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchAll();
    loadCompany();
    loadUser();
  }, []);

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
      if (profile) setCurrentUser(profile);
    }
  };

  const loadCompany = async () => {
    const { data } = await supabase.from('company_params').select('value').eq('name', 'company_name').maybeSingle();
    if (data?.value) setCompanyName(data.value);
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [inspRes, paymRes] = await Promise.all([
        supabase
          .from('quality_inspections')
          .select(`
            *,
            sewing_orders (
              id, confeccion_code, status,
              workshops ( id, nombre_taller, responsable ),
              parent_order:orders ( id, client_name, internal_code )
            ),
            orders ( id, consecutive, internal_code, client_name, brand )
          `)
          .eq('pago_status', 'Autorizado para Pago')
          .order('created_at', { ascending: false }),
        supabase
          .from('workshop_payments')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200)
      ]);
      setPendingInspections(inspRes.data || []);
      setPayments(paymRes.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // ── Grouping ──────────────────────────────────────────────────────────────
  const grouped: WorkshopGroup[] = (() => {
    const map: Record<string, WorkshopGroup> = {};
    for (const insp of pendingInspections) {
      const ws = insp.sewing_orders?.workshops;
      const key = ws?.id || insp.workshop_name || 'sin-taller';
      const name = ws?.nombre_taller || insp.workshop_name || 'Sin taller';
      const resp = ws?.responsable || '';
      if (!map[key]) {
        map[key] = { workshopId: key, workshopName: name, responsable: resp, inspections: [], totalPrendas: 0, totalBruto: 0, totalDescuentos: 0, totalEmpaque: 0, totalNeto: 0 };
      }
      const g = map[key];
      g.inspections.push(insp);
      g.totalPrendas += insp.items_approved || 0;
      g.totalBruto += (insp.items_approved || 0) * (insp.valor_prenda || 0);
      g.totalDescuentos += insp.descuento_defectos || 0;
      g.totalEmpaque += insp.pago_empaque || 0;
      g.totalNeto += insp.valor_pagar || 0;
    }
    return Object.values(map).sort((a, b) => b.totalNeto - a.totalNeto);
  })();

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalPendiente = grouped.reduce((s, g) => s + g.totalNeto, 0);
  const talleresPendientes = grouped.length;
  const thisMonth = new Date().toISOString().slice(0, 7);
  const pagadoMes = payments.filter(p => p.created_at.startsWith(thisMonth) && p.status === 'Pagado').reduce((s, p) => s + (p.total_neto || 0), 0);
  const numPagosMes = payments.filter(p => p.created_at.startsWith(thisMonth) && p.status === 'Pagado').length;

  // ── Confirm Payment ────────────────────────────────────────────────────────
  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || saving) return;
    setSaving(true);
    try {
      const g = selectedGroup;
      const now = new Date().toISOString();
      const payNumber = `PAG-${Date.now().toString().slice(-8)}`;

      // 1. Insert workshop_payments
      const { error: insErr } = await supabase.from('workshop_payments').insert({
        paid_at: now,
        workshop_id: g.workshopId !== 'sin-taller' ? g.workshopId : null,
        workshop_name: g.workshopName,
        inspection_ids: g.inspections.map(i => i.id),
        total_prendas: g.totalPrendas,
        total_bruto: g.totalBruto,
        total_descuentos: g.totalDescuentos,
        total_neto: g.totalNeto,
        metodo_pago: metodo,
        numero_referencia: paymentRef || null,
        observaciones: obs || null,
        status: 'Pagado',
        created_by: currentUser?.full_name || null,
        paid_by: currentUser?.full_name || null,
        payment_number: payNumber
      });
      if (insErr) throw insErr;

      // 2. Update quality_inspections pago_status → 'Pagado'
      const ids = g.inspections.map(i => i.id);
      const { error: updErr } = await supabase
        .from('quality_inspections')
        .update({ pago_status: 'Pagado' })
        .in('id', ids);
      if (updErr) throw updErr;

      alert(`✅ Pago registrado correctamente para ${g.workshopName}.\nComprobante No.: ${payNumber}`);
      setShowModal(false);
      setShowPreview(false);
      setPaymentRef('');
      setObs('');
      setMetodo('Transferencia Bancaria');
      setSelectedGroup(null);
      fetchAll();
    } catch (err: any) {
      alert('Error al registrar pago: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── History filter ─────────────────────────────────────────────────────────
  const filteredHistory = payments.filter(p => {
    const q = searchHistory.toLowerCase();
    const matchSearch = !q || p.workshop_name.toLowerCase().includes(q) || (p.numero_referencia || '').toLowerCase().includes(q);
    const matchStatus = historyStatus === 'all' || p.status === historyStatus;
    return matchSearch && matchStatus;
  });

  // ── Print ──────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const el = document.getElementById('printable-receipt');
    if (!el) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>Comprobante de Pago</title>
      <style>@media print{body{margin:0;}} body{font-family:Arial,sans-serif;font-size:11px;}</style>
      </head><body>${el.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 400);
  };

  // ── UI Helper ──────────────────────────────────────────────────────────────
  const KPI = ({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string; sub?: string; color: string }) => (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'white', borderRadius: '16px', padding: '1.5rem', border: `1px solid ${color}20`, boxShadow: `0 4px 20px ${color}15` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={22} color={color} />
        </div>
      </div>
      <div>
        <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8' }}>{label}</p>
        <p style={{ margin: '0.25rem 0 0', fontSize: '1.6rem', fontWeight: '950', color: '#0f172a', lineHeight: 1 }}>{value}</p>
        {sub && <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem', color: '#64748b' }}>{sub}</p>}
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="main-content" style={{ padding: '2rem', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CreditCard size={22} color="white" />
            </div>
            <h1 style={{ margin: 0, fontSize: '1.65rem', fontWeight: '950', color: '#0f172a' }}>Pagos a Talleres Satélite</h1>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Liquidación y comprobantes de pago por órdenes de confección aprobadas en calidad</p>
        </div>
        <button
          onClick={fetchAll}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', backgroundColor: 'white', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', color: '#475569' }}
        >
          <RefreshCw size={15} /> Actualizar
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        <KPI icon={DollarSign} label="Total Pendiente de Pago" value={formatCOP(totalPendiente)} sub={`${talleresPendientes} taller${talleresPendientes !== 1 ? 'es' : ''} con saldo`} color="#f59e0b" />
        <KPI icon={Users} label="Talleres con Liquidación" value={`${talleresPendientes}`} sub="Con inspecciones autorizadas" color="#7c3aed" />
        <KPI icon={TrendingUp} label="Pagado este Mes" value={formatCOP(pagadoMes)} sub={`${numPagosMes} pago${numPagosMes !== 1 ? 's' : ''} registrado${numPagosMes !== 1 ? 's' : ''}`} color="#10b981" />
        <KPI icon={Receipt} label="Total Pagos Histórico" value={`${payments.length}`} sub="Desde el inicio del sistema" color="#3b82f6" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0' }}>
        {[{ key: 'pending', label: '⏳ Pendientes de Pago', count: grouped.length }, { key: 'history', label: '✅ Historial de Pagos', count: payments.length }].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '0.82rem',
              fontWeight: '800',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderBottom: activeTab === t.key ? '3px solid #7c3aed' : '3px solid transparent',
              color: activeTab === t.key ? '#7c3aed' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '-2px',
              transition: 'all 0.15s'
            }}
          >
            {t.label}
            <span style={{ padding: '0.1rem 0.5rem', borderRadius: '999px', backgroundColor: activeTab === t.key ? '#ede9fe' : '#f1f5f9', color: activeTab === t.key ? '#7c3aed' : '#64748b', fontSize: '0.7rem', fontWeight: '900' }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5rem' }}>
          <Loader2 size={36} className="animate-spin" color="#7c3aed" />
        </div>
      )}

      {/* ── PENDING TAB ── */}
      {!loading && activeTab === 'pending' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {grouped.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '4rem', borderRadius: '16px' }}>
              <CheckCircle2 size={52} color="#10b981" style={{ margin: '0 auto 1rem' }} />
              <h3 style={{ margin: 0, fontWeight: '900', color: '#0f172a' }}>Todo al día</h3>
              <p style={{ margin: '0.5rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>No hay inspecciones pendientes de pago en este momento.</p>
            </div>
          ) : grouped.map(g => {
            const isOpen = !!expandedGroups[g.workshopId];
            return (
              <div key={g.workshopId} className="card" style={{ borderRadius: '18px', overflow: 'hidden', padding: 0, border: '1px solid #e2e8f0', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
                {/* Card Header */}
                <div style={{ padding: '1.5rem 1.75rem', background: 'linear-gradient(135deg, #faf5ff, #f5f3ff)', borderBottom: isOpen ? '1px solid #e2e8f0' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(124,58,237,0.3)' }}>
                      <Building2 size={22} color="white" />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontWeight: '950', fontSize: '1.1rem', color: '#0f172a' }}>{g.workshopName}</h3>
                      <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>
                        {g.responsable && `Resp: ${g.responsable} · `}
                        {g.inspections.length} orden{g.inspections.length !== 1 ? 'es' : ''} · {g.totalPrendas} prendas aprobadas
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {/* Mini breakdown */}
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', color: '#94a3b8' }}>Bruto</p>
                        <p style={{ margin: 0, fontWeight: '800', fontSize: '0.9rem', color: '#475569' }}>{formatCOP(g.totalBruto)}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', color: '#94a3b8' }}>Descuentos</p>
                        <p style={{ margin: 0, fontWeight: '800', fontSize: '0.9rem', color: '#ef4444' }}>-{formatCOP(g.totalDescuentos)}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', color: '#94a3b8' }}>Neto a Pagar</p>
                        <p style={{ margin: 0, fontWeight: '950', fontSize: '1.25rem', color: '#7c3aed' }}>{formatCOP(g.totalNeto)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => { setSelectedGroup(g); setShowModal(true); setShowPreview(false); }}
                      style={{ padding: '0.65rem 1.4rem', borderRadius: '10px', backgroundColor: '#7c3aed', color: 'white', border: 'none', fontSize: '0.8rem', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(124,58,237,0.3)', whiteSpace: 'nowrap', transition: 'all 0.2s' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#6d28d9')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#7c3aed')}
                    >
                      <CreditCard size={15} /> Generar Liquidación
                    </button>
                    <button
                      onClick={() => setExpandedGroups(prev => ({ ...prev, [g.workshopId]: !prev[g.workshopId] }))}
                      style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                      {isOpen ? <ChevronUp size={16} color="#475569" /> : <ChevronDown size={16} color="#475569" />}
                    </button>
                  </div>
                </div>
                {/* Expandable orders table */}
                {isOpen && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                          {['Orden Confección', 'Cliente / Producto', 'Aprobadas', 'Rechazadas', 'Tarifa/Prenda', 'Descuento', 'Empaque', 'Neto'].map(h => (
                            <th key={h} style={{ padding: '0.75rem 1rem', fontWeight: '900', fontSize: '0.67rem', textTransform: 'uppercase', color: '#64748b', textAlign: h === 'Neto' || h === 'Tarifa/Prenda' || h === 'Descuento' || h === 'Empaque' ? 'right' : 'left' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {g.inspections.map((insp, idx) => (
                          <tr key={insp.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                            <td style={{ padding: '0.85rem 1rem', fontWeight: '900', color: '#7c3aed' }}>
                              {insp.sewing_orders?.confeccion_code || insp.orders?.internal_code || '—'}
                            </td>
                            <td style={{ padding: '0.85rem 1rem' }}>
                              <div style={{ fontWeight: '700', color: '#0f172a' }}>{insp.sewing_orders?.parent_order?.client_name || insp.orders?.client_name || '—'}</div>
                            </td>
                            <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                              <span style={{ fontWeight: '900', fontSize: '0.95rem', color: '#10b981' }}>{insp.items_approved}</span>
                            </td>
                            <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                              <span style={{ fontWeight: '700', color: insp.items_rejected > 0 ? '#ef4444' : '#94a3b8' }}>{insp.items_rejected}</span>
                            </td>
                            <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: '700' }}>{formatCOP(insp.valor_prenda || 0)}</td>
                            <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#ef4444', fontWeight: '700' }}>
                              {insp.descuento_defectos > 0 ? `-${formatCOP(insp.descuento_defectos)}` : '—'}
                            </td>
                            <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#10b981', fontWeight: '700' }}>
                              {insp.pago_empaque > 0 ? `+${formatCOP(insp.pago_empaque)}` : '—'}
                            </td>
                            <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: '950', fontSize: '0.95rem', color: '#0f172a' }}>
                              {formatCOP(insp.valor_pagar || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: 'linear-gradient(135deg, #faf5ff, #ede9fe)', borderTop: '2px solid #7c3aed' }}>
                          <td colSpan={2} style={{ padding: '0.85rem 1rem', fontWeight: '900', fontSize: '0.8rem', textTransform: 'uppercase', color: '#7c3aed' }}>TOTALES</td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: '950', color: '#10b981', fontSize: '0.95rem' }}>{g.totalPrendas}</td>
                          <td />
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: '950' }}>{formatCOP(g.totalBruto)}</td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: '950', color: '#ef4444' }}>-{formatCOP(g.totalDescuentos)}</td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: '950', color: '#10b981' }}>+{formatCOP(g.totalEmpaque)}</td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: '950', fontSize: '1.05rem', color: '#7c3aed' }}>{formatCOP(g.totalNeto)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {!loading && activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Filters */}
          <div className="card" style={{ padding: '1rem 1.5rem', borderRadius: '14px', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
              <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Buscar por taller o referencia..."
                value={searchHistory}
                onChange={e => setSearchHistory(e.target.value)}
                style={{ width: '100%', padding: '0.6rem 0.75rem 0.6rem 2.25rem', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '0.83rem', outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {['all', 'Pagado', 'Anulado'].map(s => (
                <button key={s} onClick={() => setHistoryStatus(s)}
                  style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '0.75rem', fontWeight: '800', backgroundColor: historyStatus === s ? '#7c3aed' : 'white', color: historyStatus === s ? 'white' : '#475569', cursor: 'pointer' }}>
                  {s === 'all' ? 'Todos' : s}
                </button>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden' }}>
            {filteredHistory.length === 0 ? (
              <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
                <Receipt size={40} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                <p style={{ fontWeight: '700' }}>No hay pagos registrados aún.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    {['Fecha', 'Taller', 'Prendas', 'Bruto', 'Descuentos', 'Neto', 'Método', 'Referencia', 'Estado', 'Acciones'].map(h => (
                      <th key={h} style={{ padding: '0.875rem 1rem', fontSize: '0.67rem', fontWeight: '900', textTransform: 'uppercase', color: '#64748b', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((p, idx) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '0.875rem 1rem', fontWeight: '700', color: '#475569', whiteSpace: 'nowrap' }}>
                        {fmtDate(p.paid_at || p.created_at)}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', fontWeight: '800', color: '#0f172a' }}>{p.workshop_name}</td>
                      <td style={{ padding: '0.875rem 1rem', textAlign: 'center', fontWeight: '800', color: '#7c3aed' }}>{p.total_prendas}</td>
                      <td style={{ padding: '0.875rem 1rem', color: '#475569' }}>{formatCOP(p.total_bruto)}</td>
                      <td style={{ padding: '0.875rem 1rem', color: '#ef4444' }}>-{formatCOP(p.total_descuentos)}</td>
                      <td style={{ padding: '0.875rem 1rem', fontWeight: '950', color: '#10b981', fontSize: '0.9rem' }}>{formatCOP(p.total_neto)}</td>
                      <td style={{ padding: '0.875rem 1rem' }}>{p.metodo_pago}</td>
                      <td style={{ padding: '0.875rem 1rem', color: '#64748b', fontSize: '0.75rem', fontFamily: 'monospace' }}>{p.numero_referencia || '—'}</td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <span style={{
                          padding: '0.25rem 0.65rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: '900',
                          backgroundColor: p.status === 'Pagado' ? '#dcfce7' : p.status === 'Anulado' ? '#fee2e2' : '#fef3c7',
                          color: p.status === 'Pagado' ? '#166534' : p.status === 'Anulado' ? '#991b1b' : '#92400e'
                        }}>
                          {p.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <button
                          onClick={() => setViewingPayment(p)}
                          style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1.5px solid #e2e8f0', background: 'white', fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#475569' }}
                        >
                          <Eye size={13} /> Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── LIQUIDATION MODAL ── */}
      {showModal && selectedGroup && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(8px)', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', padding: 0, borderRadius: '20px', boxShadow: '0 25px 60px rgba(0,0,0,0.25)' }}>
            {/* Modal Header */}
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #faf5ff, white)' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: '950', fontSize: '1.2rem', color: '#0f172a' }}>💳 Generar Liquidación de Pago</h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#7c3aed', fontWeight: '700' }}>{selectedGroup.workshopName}</p>
              </div>
              <button onClick={() => { setShowModal(false); setShowPreview(false); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}>
                <X size={22} />
              </button>
            </div>

            {/* Toggle between form and preview */}
            <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid #f1f5f9' }}>
              {[{ key: false, label: '📋 Detalle y Pago' }, { key: true, label: '🖨️ Vista Previa Comprobante' }].map(t => (
                <button key={String(t.key)} onClick={() => setShowPreview(t.key)}
                  style={{ flex: 1, padding: '0.75rem', fontSize: '0.8rem', fontWeight: '800', border: 'none', background: showPreview === t.key ? '#ede9fe' : 'white', color: showPreview === t.key ? '#7c3aed' : '#64748b', cursor: 'pointer', borderBottom: showPreview === t.key ? '3px solid #7c3aed' : '3px solid transparent', transition: 'all 0.15s' }}>
                  {t.label}
                </button>
              ))}
            </div>

            {!showPreview ? (
              <form onSubmit={handleConfirmPayment} style={{ padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Resumen financiero */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                  {[
                    { label: 'Total Prendas', value: `${selectedGroup.totalPrendas} und`, color: '#7c3aed' },
                    { label: 'Valor Bruto', value: formatCOP(selectedGroup.totalBruto), color: '#475569' },
                    { label: 'Descuentos', value: `-${formatCOP(selectedGroup.totalDescuentos)}`, color: '#ef4444' },
                  ].map(r => (
                    <div key={r.label} style={{ padding: '0.875rem', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '800', color: '#94a3b8' }}>{r.label}</p>
                      <p style={{ margin: '4px 0 0', fontWeight: '950', fontSize: '1rem', color: r.color }}>{r.value}</p>
                    </div>
                  ))}
                </div>
                {/* Neto grande */}
                <div style={{ padding: '1rem 1.5rem', borderRadius: '12px', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: '900', color: '#c4b5fd', textTransform: 'uppercase' }}>Total Neto a Pagar</p>
                    <p style={{ margin: '2px 0 0', fontSize: '2rem', fontWeight: '950', color: 'white', lineHeight: 1 }}>{formatCOP(selectedGroup.totalNeto)}</p>
                  </div>
                  <DollarSign size={42} color="rgba(255,255,255,0.3)" />
                </div>

                {/* Mini orders table */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', maxHeight: '200px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0 }}>
                        {['Orden', 'Aprobadas', 'Tarifa', 'Neto'].map(h => (
                          <th key={h} style={{ padding: '0.6rem 0.875rem', fontWeight: '800', color: '#64748b', fontSize: '0.65rem', textTransform: 'uppercase', textAlign: h === 'Neto' || h === 'Tarifa' ? 'right' : 'left' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedGroup.inspections.map(insp => (
                        <tr key={insp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.6rem 0.875rem', fontWeight: '800', color: '#7c3aed' }}>{insp.sewing_orders?.confeccion_code || insp.orders?.internal_code || '—'}</td>
                          <td style={{ padding: '0.6rem 0.875rem', textAlign: 'center', fontWeight: '700', color: '#10b981' }}>{insp.items_approved}</td>
                          <td style={{ padding: '0.6rem 0.875rem', textAlign: 'right' }}>{formatCOP(insp.valor_prenda || 0)}</td>
                          <td style={{ padding: '0.6rem 0.875rem', textAlign: 'right', fontWeight: '950' }}>{formatCOP(insp.valor_pagar || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Payment fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#334155', marginBottom: '0.4rem' }}>Método de Pago</label>
                    <select value={metodo} onChange={e => setMetodo(e.target.value)}
                      style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '700', backgroundColor: '#f8fafc' }}>
                      {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#334155', marginBottom: '0.4rem' }}>No. Referencia / Comprobante</label>
                    <input type="text" value={paymentRef} onChange={e => setPaymentRef(e.target.value)}
                      placeholder="Ej: 123456789"
                      style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', outline: 'none' }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#334155', marginBottom: '0.4rem' }}>Observaciones</label>
                  <textarea rows={2} value={obs} onChange={e => setObs(e.target.value)}
                    placeholder="Observaciones o acuerdos adicionales..."
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', outline: 'none', resize: 'vertical' }} />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
                  <button type="button" onClick={() => { setShowModal(false); setShowPreview(false); }}
                    style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', background: 'white', fontSize: '0.83rem', fontWeight: '700', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                  <button type="button" onClick={() => setShowPreview(true)}
                    style={{ padding: '0.75rem 1.25rem', borderRadius: '10px', border: '1.5px solid #7c3aed', background: '#ede9fe', color: '#7c3aed', fontSize: '0.83rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Printer size={15} /> Previsualizar
                  </button>
                  <button type="submit" disabled={saving}
                    style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontSize: '0.83rem', fontWeight: '950', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: saving ? 0.7 : 1 }}>
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    {saving ? 'Registrando...' : 'Confirmar y Registrar Pago'}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ padding: '1.5rem 2rem' }}>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', marginBottom: '1rem' }}>
                  <PrintReceipt
                    group={selectedGroup}
                    paymentRef={paymentRef}
                    metodo={metodo}
                    obs={obs}
                    companyName={companyName}
                    paymentNumber={`PAG-PREVIEW`}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={() => setShowPreview(false)}
                    style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', fontSize: '0.83rem', fontWeight: '700', cursor: 'pointer' }}>
                    ← Volver al Formulario
                  </button>
                  <button onClick={handlePrint}
                    style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: 'none', background: '#7c3aed', color: 'white', fontSize: '0.83rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <Printer size={15} /> Imprimir Comprobante
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── VIEW PAYMENT MODAL ── */}
      {viewingPayment && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(8px)', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '560px', padding: '2rem', borderRadius: '20px', boxShadow: '0 25px 60px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: '950', fontSize: '1.1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Receipt size={20} color="#7c3aed" /> Detalle del Pago
              </h3>
              <button onClick={() => setViewingPayment(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {[
                { label: 'Taller', value: viewingPayment.workshop_name },
                { label: 'Fecha de Pago', value: fmtDate(viewingPayment.paid_at || viewingPayment.created_at) },
                { label: 'Método', value: viewingPayment.metodo_pago },
                { label: 'Referencia', value: viewingPayment.numero_referencia || '—' },
                { label: 'Total Prendas', value: `${viewingPayment.total_prendas}` },
                { label: 'Estado', value: viewingPayment.status },
              ].map(r => (
                <div key={r.label} style={{ padding: '0.875rem', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <p style={{ margin: 0, fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '800', color: '#94a3b8' }}>{r.label}</p>
                  <p style={{ margin: '3px 0 0', fontWeight: '800', color: '#0f172a', fontSize: '0.9rem' }}>{r.value}</p>
                </div>
              ))}
            </div>
            <div style={{ padding: '1rem 1.25rem', borderRadius: '12px', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.7rem', color: '#c4b5fd', fontWeight: '800', textTransform: 'uppercase' }}>Neto Pagado</p>
                <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: '950', color: 'white' }}>{formatCOP(viewingPayment.total_neto)}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: '0.7rem', color: '#c4b5fd', fontWeight: '800' }}>(-) Descuentos</p>
                <p style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: '#fca5a5' }}>-{formatCOP(viewingPayment.total_descuentos)}</p>
              </div>
            </div>
            {viewingPayment.observaciones && (
              <div style={{ padding: '0.75rem 1rem', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fcd34d', fontSize: '0.82rem', color: '#92400e' }}>
                <strong>Obs:</strong> {viewingPayment.observaciones}
              </div>
            )}
            <div style={{ padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.75rem', color: '#64748b' }}>
              Registrado por: <strong>{viewingPayment.created_by || '—'}</strong> | {viewingPayment.inspection_ids?.length || 0} órdenes incluidas
            </div>
            <button onClick={() => setViewingPayment(null)}
              style={{ padding: '0.75rem', borderRadius: '10px', border: 'none', background: '#1e293b', color: 'white', fontWeight: '800', fontSize: '0.83rem', cursor: 'pointer' }}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
