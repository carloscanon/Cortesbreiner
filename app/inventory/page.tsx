'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Package, 
  Search, 
  Filter, 
  ArrowUpDown,
  MoreVertical,
  Plus,
  MoveHorizontal,
  X,
  Loader2,
  Trash2
} from 'lucide-react';

export default function InventoryPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [searchQuery, setSearchQuery] = useState('');
  
  // Masters for selection
  const [fabrics, setFabrics] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
    fetchMasters();
  }, []);

  const fetchMasters = async () => {
    try {
      const { data: f } = await supabase.from('fabrics').select('*');
      const { data: c } = await supabase.from('colors').select('*');
      const { data: w } = await supabase.from('warehouses').select('*');
      setFabrics(f || []);
      setColors(c || []);
      setWarehouses(w || []);
    } catch (err) {
      console.error('Error fetching masters:', err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Un join simple para traer nombres de tela y color
      const { data: result, error } = await supabase
        .from('fabric_inventory')
        .select(`
          *,
          fabrics (nombre_tela),
          colors (nombre_color, hex_color)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setData(result || []);
    } catch (err: any) {
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from('fabric_inventory').insert([formData]);
      if (error) throw error;
      
      setShowModal(false);
      setFormData({});
      fetchData();
    } catch (err: any) {
      alert('Error al registrar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este rollo del inventario?')) return;
    try {
      const { error } = await supabase.from('fabric_inventory').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  // Totals calculation
  const totalKilos = data.reduce((acc, item) => acc + (Number(item.kilos) || 0), 0);
  const totalMeters = data.reduce((acc, item) => acc + (Number(item.meters) || 0), 0);
  const totalRolls = data.length;

  const handleOpenModal = () => {
    const nextNum = (data.length + 1).toString().padStart(3, '0');
    const year = new Date().getFullYear();
    const autoRoll = `R-${year}-${nextNum}`;
    
    setFormData({ roll_number: autoRoll });
    setShowModal(true);
  };

  const filteredData = data.filter(item => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      (item.roll_number && item.roll_number.toLowerCase().includes(query)) ||
      (item.fabrics?.nombre_tela && item.fabrics.nombre_tela.toLowerCase().includes(query)) ||
      (item.colors?.nombre_color && item.colors.nombre_color.toLowerCase().includes(query)) ||
      (item.location && item.location.toLowerCase().includes(query))
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Inventario de Telas</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Control detallado de rollos, kilos y metros disponibles.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-secondary">
            <MoveHorizontal size={18} /> Traslado
          </button>
          <button className="btn btn-primary" onClick={handleOpenModal}>
            <Plus size={18} /> Entrada de Tela
          </button>
        </div>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="card">
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>TOTAL KILOS</p>
          <p style={{ fontSize: '1.5rem', fontWeight: '700', marginTop: '0.5rem' }}>{totalKilos.toFixed(1)} Kg</p>
        </div>
        <div className="card">
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>TOTAL METROS</p>
          <p style={{ fontSize: '1.5rem', fontWeight: '700', marginTop: '0.5rem' }}>{totalMeters.toFixed(1)} Mts</p>
        </div>
        <div className="card">
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>ROLLOS ACTIVOS</p>
          <p style={{ fontSize: '1.5rem', fontWeight: '700', marginTop: '0.5rem' }}>{totalRolls}</p>
        </div>
        <div className="card">
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>ESTADO CRÍTICO</p>
          <p style={{ fontSize: '1.5rem', fontWeight: '700', marginTop: '0.5rem', color: '#ef4444' }}>0</p>
        </div>
      </div>

      <div className="card" style={{ padding: '0' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Buscar por rollo o tela..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '0.625rem 1rem 0.625rem 3rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', backgroundColor: '#f8fafc' }}>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Rollo</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tela / Color</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Kilos</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Metros</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ubicación</th>
                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center' }}><Loader2 className="animate-spin" /></td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No hay rollos en inventario.</td></tr>
              ) : (
                filteredData.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', fontWeight: '700' }}>{item.roll_number}</td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>{item.fabrics?.nombre_tela || 'N/A'}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: item.colors?.hex_color }}></div>
                        {item.colors?.nombre_color || 'Sin Color'}
                      </div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', fontWeight: '600' }}>{item.kilos} Kg</td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem' }}>{item.meters} Mts</td>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{item.location}</td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <button className="btn-icon" onClick={() => handleDelete(item.id)} style={{ color: '#ef4444' }}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Entrada de Tela */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: '90%', maxWidth: '500px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Package size={20} /> Nueva Entrada de Tela</h3>
              <button onClick={() => setShowModal(false)} className="btn-icon"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Número de Rollo (Auto)</label>
                <input 
                  type="text" 
                  required 
                  readOnly
                  value={formData.roll_number || ''}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#f9fafb', color: 'var(--text-muted)', fontWeight: '700' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Tela (Maestro)</label>
                  <select 
                    required
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                    onChange={(e) => setFormData({...formData, fabric_id: e.target.value})}
                  >
                    <option value="">Seleccionar...</option>
                    {fabrics.map(f => <option key={f.id} value={f.id}>{f.nombre_tela}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Color (Maestro)</label>
                  <select 
                    required
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                    onChange={(e) => setFormData({...formData, color_id: e.target.value})}
                  >
                    <option value="">Seleccionar...</option>
                    {colors.map(c => <option key={c.id} value={c.id}>{c.nombre_color}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Kilos Netos</label>
                  <input 
                    type="number" step="0.01" required 
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                    onChange={(e) => setFormData({...formData, kilos: e.target.value})}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Metros Estimados</label>
                  <input 
                    type="number" step="0.01" required 
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                    onChange={(e) => setFormData({...formData, meters: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Bodega (Maestro)</label>
                <select 
                  required
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                >
                  <option value="">Seleccionar Bodega...</option>
                  {warehouses.map(w => <option key={w.id} value={w.nombre_bodega}>{w.nombre_bodega}</option>)}
                </select>
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem', padding: '1rem' }} disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : 'Registrar Entrada'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
