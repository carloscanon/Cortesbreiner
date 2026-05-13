'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  CheckCircle2, XCircle, AlertCircle, Search, ClipboardCheck,
  ChevronRight, Filter, Plus, X, Loader2, Save, ClipboardList
} from 'lucide-react';

const STATUS_OPTIONS = ['Pendiente', 'Aprobado', 'Reproceso', 'Rechazado'];

const STATUS_BADGE: Record<string, string> = {
  Aprobado: 'badge-success',
  Pendiente: 'badge-info',
  Reproceso: 'badge-warning',
  Rechazado: 'badge-error',
};

const EMPTY_FORM = {
  order_id: '',
  workshop_name: '',
  items_inspected: '',
  items_approved: '',
  items_rejected: '',
  status: 'Pendiente',
  notes: '',
};

export default function QualityPage() {
  const [inspections, setInspections] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>(EMPTY_FORM);

  useEffect(() => {
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
      .select('id, consecutive, client_name, brand, workshops(nombre_taller)')
      .order('consecutive', { ascending: false });
    setOrders(data || []);
  };

  const handleSave = async () => {
    if (!form.order_id) return alert('Selecciona una orden.');
    setSaving(true);
    const selectedOrder = orders.find(o => o.id === form.order_id);
    const payload = {
      order_id: form.order_id,
      workshop_name: selectedOrder?.workshops?.nombre_taller || '',
      items_inspected: Number(form.items_inspected) || 0,
      items_approved: Number(form.items_approved) || 0,
      items_rejected: Number(form.items_rejected) || 0,
      status: form.status,
      notes: form.notes,
    };
    const { error } = await supabase.from('quality_inspections').insert([payload]);
    if (error) {
      alert('Error al guardar: ' + error.message);
    } else {
      setShowModal(false);
      setForm(EMPTY_FORM);
      fetchInspections();
    }
    setSaving(false);
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('quality_inspections').update({ status }).eq('id', id);
    fetchInspections();
  };

  // KPIs from real data
  const approved = inspections.filter(i => i.status === 'Aprobado').length;
  const rework = inspections.filter(i => i.status === 'Reproceso').length;
  const rejected = inspections.filter(i => i.status === 'Rechazado').length;

  const filtered = inspections.filter(i => {
    const orderCode = `OC-${i.orders?.consecutive?.toString().padStart(4, '0')}` || '';
    const client = i.orders?.client_name || '';
    const workshop = i.workshop_name || i.orders?.workshops?.nombre_taller || '';
    const matchSearch =
      orderCode.toLowerCase().includes(search.toLowerCase()) ||
      client.toLowerCase().includes(search.toLowerCase()) ||
      workshop.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus ? i.status === filterStatus : true;
    return matchSearch && matchStatus;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <ClipboardCheck /> Control de Calidad
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Inspección de órdenes producidas y control de calidad por taller.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(EMPTY_FORM); setShowModal(true); }}>
          <Plus size={18} /> Nueva Inspección
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#166534', flexShrink: 0 }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Aprobados</p>
            <p style={{ fontSize: '1.75rem', fontWeight: '800' }}>{approved}</p>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#92400e', flexShrink: 0 }}>
            <AlertCircle size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>En Reproceso</p>
            <p style={{ fontSize: '1.75rem', fontWeight: '800' }}>{rework}</p>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#991b1b', flexShrink: 0 }}>
            <XCircle size={24} />
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Rechazados</p>
            <p style={{ fontSize: '1.75rem', fontWeight: '800' }}>{rejected}</p>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="card" style={{ padding: '0' }}>
        {/* Filters */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Buscar por orden, cliente o taller..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem', minWidth: '150px' }}
          >
            <option value="">Todos los estados</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* List */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}><Loader2 className="animate-spin" style={{ margin: 'auto' }} /></div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <ClipboardList size={40} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p>No hay inspecciones registradas.</p>
            </div>
          ) : filtered.map(item => {
            const orderCode = item.orders?.consecutive
              ? `OC-${item.orders.consecutive.toString().padStart(4, '0')}`
              : '—';
            const client = item.orders?.client_name || '—';
            const workshop = item.workshop_name || item.orders?.workshops?.nombre_taller || '—';
            const date = item.created_at ? new Date(item.created_at).toLocaleDateString('es-CO') : '—';
            return (
              <div
                key={item.id}
                style={{ display: 'flex', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', gap: '1.5rem' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {/* Left info */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--primary)' }}>{orderCode}</span>
                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#cbd5e1', display: 'inline-block' }} />
                    <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>{client}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>Taller: <strong>{workshop}</strong></span>
                    {item.items_inspected > 0 && <span>Inspeccionadas: <strong>{item.items_inspected}</strong></span>}
                    {item.items_approved > 0 && <span style={{ color: '#16a34a' }}>✓ {item.items_approved} aprobadas</span>}
                    {item.items_rejected > 0 && <span style={{ color: '#ef4444' }}>✗ {item.items_rejected} rechazadas</span>}
                    <span>Fecha: <strong>{date}</strong></span>
                  </div>
                  {item.notes && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem', fontStyle: 'italic' }}>
                      {item.notes}
                    </p>
                  )}
                </div>

                {/* Status selector */}
                <select
                  value={item.status}
                  onChange={e => updateStatus(item.id, e.target.value)}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '999px',
                    border: '1.5px solid var(--border)',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    backgroundColor: item.status === 'Aprobado' ? '#dcfce7' :
                      item.status === 'Reproceso' ? '#fef3c7' :
                      item.status === 'Rechazado' ? '#fee2e2' : '#f0f4ff',
                    color: item.status === 'Aprobado' ? '#166534' :
                      item.status === 'Reproceso' ? '#92400e' :
                      item.status === 'Rechazado' ? '#991b1b' : '#3b3fb6',
                  }}
                >
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>

                <ChevronRight size={16} color="var(--text-muted)" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal: Nueva Inspección */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(6px)' }}>
          <div className="card" style={{ width: '95%', maxWidth: '580px', padding: '0', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '1.25rem 1.75rem', background: 'var(--primary)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.125rem', color: 'white' }}>Nueva Inspección de Calidad</h2>
              <button onClick={() => setShowModal(false)} style={{ color: 'white', background: 'rgba(255,255,255,0.1)', border: 'none', padding: '0.4rem', borderRadius: '50%', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Order selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.35rem' }}>Orden de Corte *</label>
                <select
                  style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                  value={form.order_id}
                  onChange={e => setForm({ ...form, order_id: e.target.value })}
                >
                  <option value="">Seleccionar Orden...</option>
                  {orders.map(o => (
                    <option key={o.id} value={o.id}>
                      OC-{o.consecutive?.toString().padStart(4, '0')} — {o.client_name} ({o.workshops?.nombre_taller || 'Sin taller'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantities */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.35rem' }}>Inspeccionadas</label>
                  <input
                    type="number" min="0" placeholder="0"
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                    value={form.items_inspected}
                    onChange={e => setForm({ ...form, items_inspected: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.35rem', color: '#16a34a' }}>Aprobadas</label>
                  <input
                    type="number" min="0" placeholder="0"
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4' }}
                    value={form.items_approved}
                    onChange={e => setForm({ ...form, items_approved: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.35rem', color: '#ef4444' }}>Rechazadas</label>
                  <input
                    type="number" min="0" placeholder="0"
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #fecaca', backgroundColor: '#fff5f5' }}
                    value={form.items_rejected}
                    onChange={e => setForm({ ...form, items_rejected: e.target.value })}
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.35rem' }}>Resultado de Inspección</label>
                <select
                  style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                >
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.35rem' }}>Observaciones</label>
                <textarea
                  rows={3}
                  placeholder="Defectos encontrados, instrucciones de reproceso, etc."
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border)', resize: 'vertical', fontSize: '0.875rem' }}
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <button
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.875rem', justifyContent: 'center' }}
                disabled={saving || !form.order_id}
                onClick={handleSave}
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> Registrar Inspección</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
