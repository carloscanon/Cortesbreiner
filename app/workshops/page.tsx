'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Plus, MapPin, Phone, Star, Users, Search,
  Trash2, X, Loader2, Edit2, Factory, Save
} from 'lucide-react';

const EMPTY_FORM = {
  nombre_taller: '',
  responsable: '',
  direccion: '',
  telefono: '',
  especialidad: '',
  capacidad_diaria: '',
  activo: true,
};

export default function WorkshopsPage() {
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [orderCounts, setOrderCounts] = useState<Record<string, number>>({});
  const [selectedWorkshopForOrders, setSelectedWorkshopForOrders] = useState<any>(null);
  const [workshopOrders, setWorkshopOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    fetchWorkshops();
    fetchOrderCounts();
  }, []);

  const fetchWorkshops = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('workshops')
      .select('*')
      .order('nombre_taller', { ascending: true });
    setWorkshops(data || []);
    setLoading(false);
  };

  const fetchOrderCounts = async () => {
    const { data } = await supabase
      .from('orders')
      .select('workshop_id')
      .not('workshop_id', 'is', null);
    const counts: Record<string, number> = {};
    (data || []).forEach((o: any) => {
      counts[o.workshop_id] = (counts[o.workshop_id] || 0) + 1;
    });
    setOrderCounts(counts);
  };

  const handleViewOrders = async (w: any) => {
    setSelectedWorkshopForOrders(w);
    setLoadingOrders(true);
    const { data } = await supabase
      .from('orders')
      .select('id, internal_code, brand, status, scheduled_date')
      .eq('workshop_id', w.id)
      .order('created_at', { ascending: false });
    setWorkshopOrders(data || []);
    setLoadingOrders(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (w: any) => {
    setEditingId(w.id);
    setForm({
      nombre_taller: w.nombre_taller || '',
      responsable: w.responsable || '',
      direccion: w.direccion || '',
      telefono: w.telefono || '',
      especialidad: w.especialidad || '',
      capacidad_diaria: w.capacidad_diaria || '',
      activo: w.activo ?? true,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.nombre_taller.trim()) return alert('El nombre del taller es obligatorio.');
    setSaving(true);
    
    const payload = {
      ...form,
      name: form.nombre_taller,
      capacidad_diaria: form.capacidad_diaria ? parseInt(form.capacidad_diaria, 10) : null
    };

    if (editingId) {
      const { error } = await supabase.from('workshops').update(payload).eq('id', editingId);
      if (error) alert('Error al actualizar: ' + error.message);
    } else {
      const { error } = await supabase.from('workshops').insert([payload]);
      if (error) alert('Error al crear: ' + error.message);
    }
    setSaving(false);
    setShowModal(false);
    fetchWorkshops();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este taller? Esta acción no se puede deshacer.')) return;
    const { error } = await supabase.from('workshops').delete().eq('id', id);
    if (error) {
      if (error.message.includes('foreign key constraint')) {
        alert('❌ No se puede eliminar este taller porque tiene envíos (remisiones) u órdenes de trabajo asociadas. Por favor, edítalo y cambia su estado a "Inactivo" para ocultarlo sin perder el historial.');
      } else {
        alert('Error al eliminar: ' + error.message);
      }
      return;
    }
    fetchWorkshops();
  };

  const filtered = workshops.filter(w =>
    w.nombre_taller?.toLowerCase().includes(search.toLowerCase()) ||
    w.responsable?.toLowerCase().includes(search.toLowerCase()) ||
    w.especialidad?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Factory /> Talleres Satélite
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Administra tus talleres externos y controla la producción delegada.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={18} /> Registrar Taller
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Buscar por nombre, especialidad o responsable..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 3rem', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
        />
      </div>

      {/* Cards grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <Loader2 className="animate-spin" style={{ margin: 'auto' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          No hay talleres registrados. Crea el primero.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {filtered.map(w => (
            <div key={w.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Card header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '1.125rem', marginBottom: '0.25rem' }}>{w.nombre_taller}</h3>
                  {w.especialidad && (
                    <span className="badge badge-info" style={{ fontSize: '0.625rem' }}>{w.especialidad}</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button
                    onClick={() => openEdit(w)}
                    style={{ padding: '0.4rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: 'var(--primary)' }}
                    title="Editar"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(w.id)}
                    style={{ padding: '0.4rem', borderRadius: '8px', border: '1px solid #fecaca', background: '#fff5f5', cursor: 'pointer', color: '#ef4444' }}
                    title="Eliminar"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Info rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {w.responsable && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    <Users size={15} />
                    <span>Responsable: <strong>{w.responsable}</strong></span>
                  </div>
                )}
                {w.direccion && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    <MapPin size={15} />
                    <span>{w.direccion}</span>
                  </div>
                )}
                {w.telefono && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    <Phone size={15} />
                    <span>{w.telefono}</span>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                <div>
                  <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Capacidad Diaria</p>
                  <p style={{ fontSize: '1rem', fontWeight: '700', marginTop: '0.25rem' }}>
                    {w.capacidad_diaria ? `${w.capacidad_diaria} pnd` : '—'}
                  </p>
                </div>
                <div 
                  onClick={() => handleViewOrders(w)}
                  style={{ cursor: 'pointer', transition: 'all 0.2s', padding: '0.25rem', borderRadius: '4px' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <p style={{ fontSize: '0.625rem', color: 'var(--primary)', fontWeight: '800', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    Órdenes Asignadas <Search size={10} />
                  </p>
                  <p style={{ fontSize: '1rem', fontWeight: '700', marginTop: '0.25rem', color: 'var(--text)' }}>
                    {orderCounts[w.id] || 0}
                  </p>
                </div>
              </div>

              {/* Status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={`badge ${w.activo ? 'badge-success' : 'badge-warning'}`}>
                  {w.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(6px)' }}>
          <div className="card" style={{ width: '95%', maxWidth: '560px', padding: '0', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '1.25rem 1.75rem', background: 'var(--primary)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.125rem', color: 'white' }}>{editingId ? 'Editar Taller' : 'Registrar Nuevo Taller'}</h2>
              <button onClick={() => setShowModal(false)} style={{ color: 'white', background: 'rgba(255,255,255,0.1)', border: 'none', padding: '0.4rem', borderRadius: '50%', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.35rem' }}>Nombre del Taller *</label>
                  <input
                    type="text" placeholder="Ej: Taller San José"
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                    value={form.nombre_taller}
                    onChange={e => setForm({ ...form, nombre_taller: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.35rem' }}>Responsable</label>
                  <input
                    type="text" placeholder="Nombre del encargado"
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                    value={form.responsable}
                    onChange={e => setForm({ ...form, responsable: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.35rem' }}>Teléfono</label>
                  <input
                    type="text" placeholder="310 123 4567"
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                    value={form.telefono}
                    onChange={e => setForm({ ...form, telefono: e.target.value })}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.35rem' }}>Dirección</label>
                  <input
                    type="text" placeholder="Calle 45 # 12-34"
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                    value={form.direccion}
                    onChange={e => setForm({ ...form, direccion: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.35rem' }}>Especialidad</label>
                  <input
                    type="text" placeholder="Ej: Camisas / Blusas"
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                    value={form.especialidad}
                    onChange={e => setForm({ ...form, especialidad: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.35rem' }}>Capacidad Diaria (pnd)</label>
                  <input
                    type="number" min="0" placeholder="200"
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                    value={form.capacidad_diaria}
                    onChange={e => setForm({ ...form, capacidad_diaria: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.35rem' }}>Estado</label>
                  <select
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                    value={form.activo ? 'true' : 'false'}
                    onChange={e => setForm({ ...form, activo: e.target.value === 'true' })}
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
              </div>

              <button
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.875rem', justifyContent: 'center' }}
                disabled={saving}
                onClick={handleSave}
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> {editingId ? 'Guardar Cambios' : 'Crear Taller'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Orders Modal */}
      {selectedWorkshopForOrders && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(6px)' }}>
          <div className="card" style={{ width: '95%', maxWidth: '600px', padding: '0', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.75rem', background: 'white', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.125rem', margin: 0, color: 'var(--text)' }}>Órdenes Asignadas</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, fontWeight: '600' }}>Taller: {selectedWorkshopForOrders.nombre_taller}</p>
              </div>
              <button onClick={() => setSelectedWorkshopForOrders(null)} style={{ color: 'var(--text-muted)', background: '#f1f5f9', border: 'none', padding: '0.4rem', cursor: 'pointer', borderRadius: '50%', display: 'flex' }}>
                <X size={18} />
              </button>
            </div>
            
            <div style={{ padding: '1.75rem', overflowY: 'auto', flex: 1, backgroundColor: '#f8fafc' }}>
              {loadingOrders ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}><Loader2 className="animate-spin" style={{ margin: 'auto' }} /></div>
              ) : workshopOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--text-muted)', backgroundColor: 'white', borderRadius: '12px', border: '1px dashed var(--border)' }}>
                  <Search size={32} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                  <p style={{ margin: 0, fontWeight: '600' }}>No hay órdenes asignadas a este taller.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {workshopOrders.map(order => (
                    <div key={order.id} style={{ padding: '1.25rem', background: 'white', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                      <div>
                        <h4 style={{ margin: '0 0 0.35rem 0', fontWeight: '800', color: 'var(--primary)', fontSize: '1rem' }}>OC-{order.internal_code}</h4>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>{order.brand || 'Sin marca'} • {order.scheduled_date || 'Sin fecha'}</span>
                      </div>
                      <span style={{ 
                        padding: '0.35rem 0.75rem',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: '800',
                        textTransform: 'uppercase',
                        backgroundColor: order.status === 'Completado' || order.status === 'Terminado' ? '#dcfce7' : order.status === 'En Proceso' ? '#fef3c7' : '#f1f5f9',
                        color: order.status === 'Completado' || order.status === 'Terminado' ? '#166534' : order.status === 'En Proceso' ? '#b45309' : '#475569'
                      }}>
                        {order.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
