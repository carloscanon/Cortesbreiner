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
    if (error) alert('Error al eliminar: ' + error.message);
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
                <div>
                  <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Órdenes Asignadas</p>
                  <p style={{ fontSize: '1rem', fontWeight: '700', marginTop: '0.25rem' }}>
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
    </div>
  );
}
