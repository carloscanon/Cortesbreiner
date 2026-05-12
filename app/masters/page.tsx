'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Plus, 
  Search, 
  Tag, 
  Briefcase, 
  Palette,
  Droplets,
  MoreVertical,
  X,
  Loader2
} from 'lucide-react';

export default function MastersPage() {
  const [activeTab, setActiveTab] = useState('fabrics');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    supplier: '',
    composition: '',
    hex: '#000000'
  });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const table = activeTab === 'fabrics' ? 'fabrics' : 
                    activeTab === 'colors' ? 'colors' : 
                    activeTab === 'clients' ? 'clients' : 'brands';
      
      const { data: result, error } = await supabase
        .from(table)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setData(result || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const table = activeTab === 'fabrics' ? 'fabrics' : 
                    activeTab === 'colors' ? 'colors' : 
                    activeTab === 'clients' ? 'clients' : 'brands';
      
      const payload: any = { name: formData.name };
      if (activeTab === 'fabrics') {
        payload.supplier = formData.supplier;
        payload.composition = formData.composition;
      } else if (activeTab === 'colors') {
        payload.hex_code = formData.hex;
      }

      const { error } = await supabase.from(table).insert([payload]);
      if (error) throw error;

      setShowModal(false);
      setFormData({ name: '', supplier: '', composition: '', hex: '#000000' });
      fetchData();
    } catch (err) {
      console.error('Error saving data:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Datos Maestros</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Administra los catálogos base de tu operación textil.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Nuevo Registro
        </button>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border)', width: '100%' }}>
          {[
            { id: 'fabrics', label: 'Telas', icon: Droplets },
            { id: 'colors', label: 'Colores', icon: Palette },
            { id: 'clients', label: 'Clientes', icon: Briefcase },
            { id: 'brands', label: 'Marcas', icon: Tag },
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                padding: '1rem 1.5rem', 
                fontSize: '0.875rem', 
                fontWeight: '600',
                color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: '-1px',
                transition: 'all 0.2s'
              }}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: '0' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ position: 'relative', width: '400px' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder={`Buscar en ${activeTab}...`} 
              style={{ width: '100%', padding: '0.625rem 1rem 0.625rem 3rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '200px' }}>
          {loading ? (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', padding: '3rem' }}>
              <Loader2 className="animate-spin" color="var(--primary)" />
            </div>
          ) : data.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              <p>No hay registros encontrados en {activeTab}.</p>
            </div>
          ) : (
            data.map((item, i) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', transition: 'background-color 0.2s' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {activeTab === 'colors' && (
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: item.hex_code, border: '1px solid var(--border)' }}></div>
                  )}
                  <div>
                    <p style={{ fontSize: '0.875rem', fontWeight: '700' }}>{item.name}</p>
                    <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {activeTab === 'fabrics' && (
                        <>
                          <span>Proveedor: <strong>{item.supplier || 'N/A'}</strong></span>
                          <span>Composición: <strong>{item.composition || 'N/A'}</strong></span>
                        </>
                      )}
                      {activeTab === 'colors' && <span>HEX: <strong>{item.hex_code}</strong></span>}
                    </div>
                  </div>
                </div>
                <button className="btn-icon"><MoreVertical size={16} color="var(--text-muted)" /></button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MODAL */}
      {showModal && (
        <div style={{ 
          position: 'fixed', 
          top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3>Nuevo {activeTab === 'fabrics' ? 'Tipo de Tela' : 'Registro'}</h3>
              <button onClick={() => setShowModal(false)} className="btn-icon"><X size={20} /></button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Nombre</label>
                <input 
                  type="text" 
                  required
                  className="form-control"
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>

              {activeTab === 'fabrics' && (
                <>
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Proveedor</label>
                    <input 
                      type="text" 
                      className="form-control"
                      style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                      value={formData.supplier}
                      onChange={(e) => setFormData({...formData, supplier: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Composición</label>
                    <input 
                      type="text" 
                      className="form-control"
                      style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                      value={formData.composition}
                      onChange={(e) => setFormData({...formData, composition: e.target.value})}
                    />
                  </div>
                </>
              )}

              {activeTab === 'colors' && (
                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Color (HEX)</label>
                  <input 
                    type="color" 
                    className="form-control"
                    style={{ width: '100%', height: '40px', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                    value={formData.hex}
                    onChange={(e) => setFormData({...formData, hex: e.target.value})}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" size={18} /> : 'Guardar Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
