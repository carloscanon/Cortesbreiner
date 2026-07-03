'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  CheckCircle2, XCircle, AlertCircle, Search, ClipboardCheck,
  Plus, X, Loader2, Save, ClipboardList, Package, ChevronDown, ChevronUp
} from 'lucide-react';

const STATUS_OPTIONS = ['Pendiente', 'Aprobado', 'Reproceso', 'Rechazado'];

const EMPTY_FORM = {
  order_id: '',
  workshop_name: '',
  items_inspected: '',
  items_approved: '',
  items_rejected: '',
  status: 'Pendiente',
  notes: '',
  lavanderia: '0',
  saldos: '0',
  costuras: '0',
  incompleto: '0',
};

// Fetch all pages of a query
const fetchAll = async (queryFn: () => any) => {
  let allData: any[] = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await queryFn().range(from, from + step - 1);
    if (error) throw error;
    if (data && data.length > 0) {
      allData = [...allData, ...data];
      from += step;
      if (data.length < step) break;
    } else break;
  }
  return allData;
};

export default function QualityPage() {
  const [inspections, setInspections] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  // Track per-row approved/rejected in the detail table
  const [rowApproved, setRowApproved] = useState<Record<string, number>>({});
  const [rowRejected, setRowRejected] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchAll(() => supabase.from('products').select('*')).then(setProducts);
    supabase.from('sizes').select('*').order('orden_visual', { ascending: true }).then(({ data }) => setSizes(data || []));
    supabase.from('colors').select('*').then(({ data }) => setColors(data || []));
    fetchInspections();
    fetchOrders();
  }, []);

  const fetchInspections = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('quality_inspections')
      .select(`
        *,
        orders (
          id,
          consecutive,
          internal_code,
          client_name,
          brand,
          workshops (nombre_taller)
        )
      `)
      .order('created_at', { ascending: false });
    setInspections(data || []);
    setLoading(false);
  };

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('id, consecutive, internal_code, client_name, brand, workshops(nombre_taller)')
      .order('consecutive', { ascending: false });
    setOrders(data || []);
  };

  const fetchOrderDetail = async (orderId: string) => {
    setLoadingDetail(true);
    setOrderDetail(null);
    const { data } = await supabase
      .from('orders')
      .select('*, fabrics(nombre_tela), workshops(nombre_taller, responsable), cuts(*, cut_sizes(*))')
      .eq('id', orderId)
      .single();
    setOrderDetail(data);
    setLoadingDetail(false);
  };

  // Build detail rows from order cuts
  const getDetailRows = (order: any) => {
    if (!order?.cuts) return [];
    const rows: { key: string; productName: string; colorName: string; size: string; quantity: number }[] = [];
    order.cuts.forEach((cut: any) => {
      const prod = products.find(p => String(p.id) === String(cut.product_id));
      const colorObj = colors.find(c => String(c.id) === String(cut.color_id));
      const colorName = colorObj ? colorObj.nombre_color : (cut.color || '—');
      const productName = prod ? prod.nombre_producto : 'Sin Referencia';
      const layersProyec = cut.layers || 1;
      const layersProduced = cut.layers_produced || 0;
      (cut.cut_sizes || []).forEach((cs: any) => {
        const sizeObj = sizes.find(s => String(s.id) === String(cs.size_id));
        const sz = sizeObj ? sizeObj.codigo_talla : (cs.size_code || 'S/T');
        let qty = 0;
        if (cs.quantity_produced !== undefined && cs.quantity_produced !== null) {
          qty = Number(cs.quantity_produced);
        } else {
          const proyecQty = Number(cs.quantity) || 0;
          const ppc = layersProyec > 0 ? proyecQty / layersProyec : 0;
          qty = Math.round(ppc * layersProduced);
        }
        if (qty > 0) {
          const key = `${cut.id}_${cs.id}`;
          rows.push({ key, productName, colorName, size: sz, quantity: qty });
        }
      });
    });
    return rows;
  };

  // Compute totals from per-row inputs
  const computeTotalsFromRows = (rows: any[]) => {
    let totalApproved = 0;
    let totalRejected = 0;
    rows.forEach(row => {
      totalApproved += rowApproved[row.key] || 0;
      totalRejected += rowRejected[row.key] || 0;
    });
    return { totalApproved, totalRejected };
  };

  const handleSave = async () => {
    if (!form.order_id) return alert('Selecciona una orden.');
    setSaving(true);

    const selectedOrder = orders.find(o => o.id === form.order_id);
    const rows = getDetailRows(orderDetail);
    
    const lavVal = Number(form.lavanderia) || 0;
    const salVal = Number(form.saldos) || 0;
    const cosVal = Number(form.costuras) || 0;
    const incVal = Number(form.incompleto) || 0;
    
    // Total rejected is the sum of breakdown categories
    let finalRejected = lavVal + salVal + cosVal + incVal;
    let finalApproved = Number(form.items_approved) || 0;

    // If we have per-row data, compute approved from that
    if (rows.length > 0) {
      const { totalApproved, totalRejected } = computeTotalsFromRows(rows);
      if (totalApproved > 0) {
        finalApproved = totalApproved;
      }
      if (totalRejected > 0 && finalRejected === 0) {
        finalRejected = totalRejected;
      }
    }

    const payload = {
      order_id: form.order_id,
      workshop_name: selectedOrder?.workshops?.nombre_taller || form.workshop_name || '',
      items_inspected: Number(form.items_inspected) || 0,
      items_approved: finalApproved,
      items_rejected: finalRejected,
      lavanderia: lavVal,
      saldos: salVal,
      costuras: cosVal,
      incompleto: incVal,
      status: form.status,
      notes: form.notes,
    };

    let error = null;
    if (editingId) {
      const res = await supabase.from('quality_inspections').update(payload).eq('id', editingId);
      error = res.error;
    } else {
      const res = await supabase.from('quality_inspections').insert([payload]);
      error = res.error;
    }

    if (error) {
      alert('Error al guardar: ' + error.message);
    } else {
      closeModal();
      fetchInspections();
    }
    setSaving(false);
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('quality_inspections').update({ status }).eq('id', id);
    fetchInspections();
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOrderDetail(null);
    setRowApproved({});
    setRowRejected({});
  };

  const openReview = async (item: any) => {
    setEditingId(item.id);
    setForm({
      order_id: item.order_id,
      workshop_name: item.workshop_name || '',
      items_inspected: (item.items_inspected || 0).toString(),
      items_approved: (item.items_approved || 0).toString(),
      items_rejected: (item.items_rejected || 0).toString(),
      lavanderia: (item.lavanderia || 0).toString(),
      saldos: (item.saldos || 0).toString(),
      costuras: (item.costuras || 0).toString(),
      incompleto: (item.incompleto || 0).toString(),
      status: item.status,
      notes: item.notes || '',
    });
    setRowApproved({});
    setRowRejected({});
    setShowModal(true);
    await fetchOrderDetail(item.order_id);
  };

  // KPIs
  const approved = inspections.filter(i => i.status === 'Aprobado').length;
  const rework = inspections.filter(i => i.status === 'Reproceso').length;
  const rejected = inspections.filter(i => i.status === 'Rechazado').length;
  const pending = inspections.filter(i => i.status === 'Pendiente').length;

  const filtered = inspections.filter(i => {
    const orderCode = i.orders?.internal_code
      ? `OC-${i.orders.internal_code}`
      : i.orders?.consecutive ? `OC-${i.orders.consecutive.toString().padStart(4, '0')}` : '';
    const client = i.orders?.client_name || '';
    const workshop = i.workshop_name || i.orders?.workshops?.nombre_taller || '';
    const matchSearch =
      orderCode.toLowerCase().includes(search.toLowerCase()) ||
      client.toLowerCase().includes(search.toLowerCase()) ||
      workshop.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus ? i.status === filterStatus : true;
    return matchSearch && matchStatus;
  });

  const detailRows = orderDetail ? getDetailRows(orderDetail) : [];
  const { totalApproved: rowTotalApproved, totalRejected: rowTotalRejected } = computeTotalsFromRows(detailRows);
  const hasRowData = rowTotalApproved > 0 || rowTotalRejected > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '4rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#7c3aed', textTransform: 'uppercase' }}>
            Etapa de Producción
          </span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '950', margin: '0.25rem 0 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.5rem', backgroundColor: '#7c3aed', borderRadius: '12px', color: 'white' }}>
              <ClipboardCheck size={24} />
            </div>
            Control de Calidad
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Inspección y validación de prendas recibidas de confección.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setOrderDetail(null); setShowModal(true); }}>
          <Plus size={18} /> Nueva Inspección
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem' }}>
        {[
          { label: 'Pendientes', value: pending, color: '#3b82f6', icon: ClipboardList },
          { label: 'Aprobados', value: approved, color: '#10b981', icon: CheckCircle2 },
          { label: 'En Reproceso', value: rework, color: '#f59e0b', icon: AlertCircle },
          { label: 'Rechazados', value: rejected, color: '#ef4444', icon: XCircle },
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', border: `1px solid ${k.color}25`, borderRadius: '16px' }}>
            <div style={{ padding: '0.875rem', backgroundColor: `${k.color}15`, color: k.color, borderRadius: '14px', flexShrink: 0 }}>
              <k.icon size={22} />
            </div>
            <div>
              <p style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</p>
              <h3 style={{ fontSize: '2rem', fontWeight: '950', margin: '0.1rem 0', color: k.color }}>{k.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* List */}
      <div className="card" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden' }}>
        {/* Filters */}
        <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Buscar por orden, cliente o taller..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.5rem', borderRadius: '10px', border: '1.5px solid var(--border)', fontSize: '0.85rem' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {['', ...STATUS_OPTIONS].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)} className="btn" style={{
                fontSize: '0.72rem', fontWeight: '700', padding: '0.5rem 0.875rem',
                backgroundColor: filterStatus === s ? '#7c3aed' : 'white',
                color: filterStatus === s ? 'white' : 'var(--text)',
                border: '1px solid var(--border)', borderRadius: '8px'
              }}>{s === '' ? 'Todos' : s}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}><Loader2 className="animate-spin" style={{ margin: 'auto', color: '#7c3aed' }} size={28} /></div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <ClipboardList size={40} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p>No hay inspecciones registradas.</p>
            </div>
          ) : filtered.map(item => {
            const orderCode = item.orders?.internal_code
              ? `OC-${item.orders.internal_code}`
              : item.orders?.consecutive ? `OC-${item.orders.consecutive.toString().padStart(4, '0')}` : '—';
            const client = item.orders?.client_name || '—';
            const workshop = item.workshop_name || item.orders?.workshops?.nombre_taller || '—';
            const date = item.created_at ? new Date(item.created_at).toLocaleDateString('es-CO') : '—';
            const statusColor = item.status === 'Aprobado' ? { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' }
              : item.status === 'Reproceso' ? { bg: '#fffbeb', color: '#92400e', border: '#fde68a' }
              : item.status === 'Rechazado' ? { bg: '#fff1f2', color: '#9f1239', border: '#fecdd3' }
              : { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
            return (
              <div
                key={item.id}
                style={{ display: 'flex', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', gap: '1rem', flexWrap: 'wrap' }}
              >
                {/* Status dot */}
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: statusColor.color, flexShrink: 0 }} />

                {/* Info */}
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: '800', color: '#7c3aed' }}>{orderCode}</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#0f172a' }}>{client}</span>
                    <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '999px', backgroundColor: statusColor.bg, color: statusColor.color, border: `1px solid ${statusColor.border}`, fontWeight: '700' }}>
                      {item.status.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.72rem', color: '#64748b', flexWrap: 'wrap' }}>
                    <span>🏭 {workshop}</span>
                    {item.items_inspected > 0 && <span>📦 {item.items_inspected} prendas</span>}
                    {item.items_approved > 0 && <span style={{ color: '#16a34a', fontWeight: '700' }}>✓ {item.items_approved} aprobadas</span>}
                    {item.items_rejected > 0 && (
                      <span style={{ color: '#ef4444', fontWeight: '700' }}>
                        ✗ {item.items_rejected} rechazadas
                        {(item.costuras > 0 || item.lavanderia > 0 || item.saldos > 0 || item.incompleto > 0) && (
                          <span style={{ fontWeight: '500', fontSize: '0.68rem', color: '#7f1d1d', marginLeft: '0.2rem' }}>
                            ({[
                              item.costuras > 0 && `${item.costuras} costura`,
                              item.lavanderia > 0 && `${item.lavanderia} lavandería`,
                              item.saldos > 0 && `${item.saldos} saldos`,
                              item.incompleto > 0 && `${item.incompleto} incompleto`
                            ].filter(Boolean).join(', ')})
                          </span>
                        )}
                      </span>
                    )}
                    <span>📅 {date}</span>
                  </div>
                  {item.notes && item.notes !== 'Creado automáticamente al recibir de confección.' && (
                    <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem', fontStyle: 'italic' }}>{item.notes}</p>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                  <select
                    value={item.status}
                    onChange={e => updateStatus(item.id, e.target.value)}
                    style={{
                      padding: '0.4rem 0.75rem', borderRadius: '8px',
                      border: `1.5px solid ${statusColor.border}`,
                      fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer',
                      backgroundColor: statusColor.bg, color: statusColor.color,
                    }}
                  >
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button
                    className="btn"
                    style={{ padding: '0.4rem 0.9rem', fontSize: '0.72rem', fontWeight: '800', backgroundColor: '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    onClick={() => openReview(item)}
                  >
                    Revisar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── MODAL: Nueva / Revisar Inspección ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '780px', padding: 0, maxHeight: '95vh', display: 'flex', flexDirection: 'column', borderRadius: '20px', overflow: 'hidden' }}>

            {/* Modal header */}
            <div style={{ padding: '1.5rem 2rem', background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <p style={{ fontSize: '0.65rem', fontWeight: '800', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {editingId ? 'Revisar Inspección de Calidad' : 'Nueva Inspección de Calidad'}
                </p>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '950', color: 'white', margin: '0.25rem 0 0' }}>
                  {orderDetail
                    ? `OC-${orderDetail.internal_code || orderDetail.consecutive} — ${orderDetail.client_name}`
                    : 'Selecciona una orden para revisar'}
                </h2>
              </div>
              <button onClick={closeModal} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', cursor: 'pointer', borderRadius: '8px', padding: '0.5rem' }}>
                <X size={20} />
              </button>
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* Order selector (only when creating new) */}
              {!editingId && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.35rem', color: '#374151' }}>Orden de Corte *</label>
                  <select
                    style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '0.875rem' }}
                    value={form.order_id}
                    onChange={async e => {
                      setForm({ ...form, order_id: e.target.value });
                      if (e.target.value) await fetchOrderDetail(e.target.value);
                      else setOrderDetail(null);
                    }}
                  >
                    <option value="">Seleccionar Orden...</option>
                    {orders.map(o => (
                      <option key={o.id} value={o.id}>
                        OC-{o.internal_code || o.consecutive?.toString().padStart(4, '0')} — {o.client_name} ({o.workshops?.nombre_taller || 'Sin taller'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Order context info when editing */}
              {editingId && orderDetail && (
                <div style={{ padding: '1rem 1.25rem', backgroundColor: '#f5f3ff', borderRadius: '12px', border: '1.5px solid #ddd6fe', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ fontSize: '0.65rem', fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase' }}>Taller</p>
                    <p style={{ fontWeight: '800', fontSize: '0.9rem' }}>{orderDetail.workshops?.nombre_taller || '—'}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.65rem', fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase' }}>Cliente</p>
                    <p style={{ fontWeight: '800', fontSize: '0.9rem' }}>{orderDetail.client_name}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.65rem', fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase' }}>Tela</p>
                    <p style={{ fontWeight: '800', fontSize: '0.9rem' }}>{orderDetail.fabrics?.nombre_tela || '—'}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.65rem', fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase' }}>Total Esperado</p>
                    <p style={{ fontWeight: '800', fontSize: '0.9rem' }}>{detailRows.reduce((s, r) => s + r.quantity, 0)} prendas</p>
                  </div>
                </div>
              )}

              {/* Detail table – what to verify */}
              {loadingDetail && (
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                  <Loader2 className="animate-spin" size={24} style={{ color: '#7c3aed', margin: 'auto' }} />
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.5rem' }}>Cargando detalle de la orden…</p>
                </div>
              )}

              {!loadingDetail && detailRows.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <Package size={16} style={{ color: '#7c3aed' }} />
                    <h3 style={{ fontSize: '0.85rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>
                      Detalle de Prendas a Revisar
                    </h3>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', marginLeft: 'auto' }}>
                      Ingresa cuántas prendas aprobaste y rechazaste por fila
                    </span>
                  </div>
                  <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1.5px solid #e2e8f0' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                          {['Referencia', 'Color', 'Talla', 'Esperado', '✓ Aprobadas', '✗ Rechazadas'].map((h, i) => (
                            <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: i >= 3 ? 'center' : 'left', fontWeight: '800', color: '#475569', fontSize: '0.7rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {detailRows.map((row, idx) => {
                          const aprVal = rowApproved[row.key] ?? (editingId && idx === 0 ? undefined : undefined);
                          const rejVal = rowRejected[row.key] ?? undefined;
                          return (
                            <tr key={row.key} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                              <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#0f172a' }}>{row.productName}</td>
                              <td style={{ padding: '0.6rem 0.75rem', color: '#475569' }}>{row.colorName}</td>
                              <td style={{ padding: '0.6rem 0.75rem' }}>
                                <span style={{ backgroundColor: '#ede9fe', color: '#5b21b6', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: '700', fontSize: '0.75rem' }}>{row.size}</span>
                              </td>
                              <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: '800', color: '#334155' }}>{row.quantity}</td>
                              <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                                <input
                                  type="number"
                                  min="0"
                                  max={row.quantity}
                                  placeholder="0"
                                  value={rowApproved[row.key] ?? ''}
                                  onChange={e => setRowApproved(prev => ({ ...prev, [row.key]: Number(e.target.value) }))}
                                  style={{ width: '70px', padding: '0.35rem 0.4rem', borderRadius: '6px', border: '1.5px solid #bbf7d0', backgroundColor: '#f0fdf4', textAlign: 'center', fontWeight: '700', color: '#166534', fontSize: '0.82rem' }}
                                />
                              </td>
                              <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                                <input
                                  type="number"
                                  min="0"
                                  max={row.quantity}
                                  placeholder="0"
                                  value={rowRejected[row.key] ?? ''}
                                  onChange={e => setRowRejected(prev => ({ ...prev, [row.key]: Number(e.target.value) }))}
                                  style={{ width: '70px', padding: '0.35rem 0.4rem', borderRadius: '6px', border: '1.5px solid #fecaca', backgroundColor: '#fff5f5', textAlign: 'center', fontWeight: '700', color: '#991b1b', fontSize: '0.82rem' }}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {/* Totals row */}
                      <tfoot>
                        <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                          <td colSpan={3} style={{ padding: '0.6rem 0.75rem', fontWeight: '800', fontSize: '0.75rem', color: '#374151' }}>TOTALES</td>
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: '900', color: '#334155' }}>{detailRows.reduce((s, r) => s + r.quantity, 0)}</td>
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: '900', color: '#16a34a' }}>{rowTotalApproved}</td>
                          <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: '900', color: '#dc2626' }}>{rowTotalRejected}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  {hasRowData && (
                    <p style={{ fontSize: '0.72rem', color: '#7c3aed', marginTop: '0.5rem', fontWeight: '600' }}>
                      ✓ Los totales de la tabla se usarán al guardar la inspección ({rowTotalApproved} aprobadas / {rowTotalRejected} rechazadas).
                    </p>
                  )}
                </div>
              )}

              {/* Overall counts (always visible) */}
              <div>
                <h3 style={{ fontSize: '0.8rem', fontWeight: '800', color: '#374151', marginBottom: '0.75rem' }}>
                  {detailRows.length > 0 ? 'Resumen General' : 'Conteo de Prendas'}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.35rem', color: '#374151' }}>Total Inspeccionadas</label>
                    <input
                      type="number" min="0" placeholder="0"
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1.5px solid var(--border)', fontWeight: '700', textAlign: 'center' }}
                      value={form.items_inspected}
                      onChange={e => setForm({ ...form, items_inspected: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.35rem', color: '#16a34a' }}>
                      ✓ Aprobadas {hasRowData && <span style={{ color: '#7c3aed', fontSize: '0.65rem' }}>(auto: {rowTotalApproved})</span>}
                    </label>
                    <input
                      type="number" min="0" placeholder="0"
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1.5px solid #bbf7d0', backgroundColor: '#f0fdf4', fontWeight: '700', textAlign: 'center', color: '#16a34a' }}
                      value={hasRowData ? rowTotalApproved : form.items_approved}
                      readOnly={hasRowData}
                      onChange={e => !hasRowData && setForm({ ...form, items_approved: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.35rem', color: '#ef4444' }}>
                      ✗ Rechazadas {hasRowData && <span style={{ color: '#7c3aed', fontSize: '0.65rem' }}>(auto: {rowTotalRejected})</span>}
                    </label>
                    <input
                      type="number" min="0" placeholder="0"
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1.5px solid #fecaca', backgroundColor: '#fff5f5', fontWeight: '700', textAlign: 'center', color: '#dc2626' }}
                      value={hasRowData ? rowTotalRejected : (Number(form.lavanderia || 0) + Number(form.saldos || 0) + Number(form.costuras || 0) + Number(form.incompleto || 0))}
                      readOnly={true}
                    />
                  </div>
                </div>
              </div>

              {/* Breakdown of Rejected Garments */}
              <div style={{ backgroundColor: '#fff5f5', border: '1px solid #fecaca', padding: '1.25rem', borderRadius: '12px' }}>
                <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.8rem', fontWeight: '900', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>✗</span> Clasificación de Defectos y Rechazos
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', marginBottom: '0.3rem', color: '#7f1d1d' }}>Costuras</label>
                    <input
                      type="number" min="0" placeholder="0"
                      value={form.costuras || ''}
                      onChange={e => setForm({ ...form, costuras: e.target.value })}
                      style={{ width: '100%', padding: '0.45rem 0.5rem', borderRadius: '6px', border: '1.5px solid #fca5a5', textAlign: 'center', fontWeight: '700', fontSize: '0.8rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', marginBottom: '0.3rem', color: '#7f1d1d' }}>Lavandería</label>
                    <input
                      type="number" min="0" placeholder="0"
                      value={form.lavanderia || ''}
                      onChange={e => setForm({ ...form, lavanderia: e.target.value })}
                      style={{ width: '100%', padding: '0.45rem 0.5rem', borderRadius: '6px', border: '1.5px solid #fca5a5', textAlign: 'center', fontWeight: '700', fontSize: '0.8rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', marginBottom: '0.3rem', color: '#7f1d1d' }}>Saldos</label>
                    <input
                      type="number" min="0" placeholder="0"
                      value={form.saldos || ''}
                      onChange={e => setForm({ ...form, saldos: e.target.value })}
                      style={{ width: '100%', padding: '0.45rem 0.5rem', borderRadius: '6px', border: '1.5px solid #fca5a5', textAlign: 'center', fontWeight: '700', fontSize: '0.8rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', marginBottom: '0.3rem', color: '#7f1d1d' }}>Incompleto</label>
                    <input
                      type="number" min="0" placeholder="0"
                      value={form.incompleto || ''}
                      onChange={e => setForm({ ...form, incompleto: e.target.value })}
                      style={{ width: '100%', padding: '0.45rem 0.5rem', borderRadius: '6px', border: '1.5px solid #fca5a5', textAlign: 'center', fontWeight: '700', fontSize: '0.8rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* Result status */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.5rem', color: '#374151' }}>Resultado de Inspección</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                  {STATUS_OPTIONS.map(s => {
                    const colors: Record<string, { bg: string; border: string; color: string }> = {
                      Pendiente: { bg: '#eff6ff', border: '#93c5fd', color: '#1d4ed8' },
                      Aprobado: { bg: '#f0fdf4', border: '#6ee7b7', color: '#065f46' },
                      Reproceso: { bg: '#fffbeb', border: '#fcd34d', color: '#92400e' },
                      Rechazado: { bg: '#fff1f2', border: '#fca5a5', color: '#9f1239' },
                    };
                    const c = colors[s];
                    const isSelected = form.status === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setForm({ ...form, status: s })}
                        style={{
                          padding: '0.6rem',
                          borderRadius: '10px',
                          border: `2px solid ${isSelected ? c.color : '#e2e8f0'}`,
                          backgroundColor: isSelected ? c.bg : 'white',
                          color: isSelected ? c.color : '#64748b',
                          fontWeight: isSelected ? '800' : '600',
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          boxShadow: isSelected ? `0 0 0 3px ${c.border}55` : 'none',
                        }}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.35rem', color: '#374151' }}>Observaciones / Hallazgos</label>
                <textarea
                  rows={3}
                  placeholder="Ej: 5 prendas con costura abierta en el hombro izquierdo, 2 con manchas de tela…"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1.5px solid var(--border)', resize: 'vertical', fontSize: '0.875rem', lineHeight: 1.5 }}
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <button
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.9rem', justifyContent: 'center', borderRadius: '12px', fontSize: '0.9rem', fontWeight: '800', backgroundColor: '#7c3aed', borderColor: '#7c3aed' }}
                disabled={saving || !form.order_id}
                onClick={handleSave}
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> {editingId ? 'Guardar Revisión' : 'Registrar Inspección'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
