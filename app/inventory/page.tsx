'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Package, 
  Search, 
  Plus,
  MoveHorizontal,
  X,
  Loader2,
  Trash2,
  Activity,
  TrendingDown,
  CheckCircle2,
  Clock,
  Scissors,
  Database,
  Edit2,
  Save,
  XCircle
} from 'lucide-react';

type TabType = 'rollos' | 'movimientos';

const ESTADO_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  planeacion: { label: 'Planeación', color: '#f59e0b', bg: '#fef3c7', icon: Clock },
  corte:      { label: 'Corte',      color: '#3b82f6', bg: '#dbeafe', icon: Scissors },
  confeccion: { label: 'Confección', color: '#10b981', bg: '#d1fae5', icon: CheckCircle2 }
};

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<TabType>('rollos');

  // ── Rollos state ───────────────────────────────────────────────────────────
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [searchQuery, setSearchQuery] = useState('');

  // Edit rollo modal
  const [showEditRolloModal, setShowEditRolloModal] = useState(false);
  const [editRolloData, setEditRolloData] = useState<any>(null);
  const [savingRollo, setSavingRollo] = useState(false);

  // ── Movimientos state ──────────────────────────────────────────────────────
  const [movements, setMovements] = useState<any[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [movSearch, setMovSearch] = useState('');
  const [movEstado, setMovEstado] = useState<string>('all');
  const [movementsTableMissing, setMovementsTableMissing] = useState(false);
  const [loadingBackfill, setLoadingBackfill] = useState(false);
  const [clearingMovements, setClearingMovements] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Inline editing for movements
  const [editingMovId, setEditingMovId] = useState<string | null>(null);
  const [editMovData, setEditMovData] = useState<{ metros_planeados: string; metros_reales: string; estado: string; observaciones: string }>({
    metros_planeados: '',
    metros_reales: '',
    estado: '',
    observaciones: ''
  });
  const [savingMov, setSavingMov] = useState(false);

  // Masters
  const [fabrics, setFabrics] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
    fetchMasters();
  }, []);

  useEffect(() => {
    if (activeTab === 'movimientos') fetchMovements();
  }, [activeTab]);

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

  const fetchMovements = async () => {
    setLoadingMovements(true);
    setMovementsTableMissing(false);
    try {
      const { data: result, error } = await supabase
        .from('inventory_movements')
        .select(`
          *,
          fabrics (nombre_tela, costo_unitario),
          colors (nombre_color, hex_color),
          orders (internal_code, status)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        const msg = (error.message || '').toLowerCase();
        const isTableMissing = 
          error.code === '42P01' ||
          msg.includes('does not exist') ||
          msg.includes('schema cache') ||
          msg.includes('could not find the table');
        if (isTableMissing) {
          setMovementsTableMissing(true);
        } else {
          console.error('Error fetching movements:', error.message || error);
        }
        return;
      }
      setMovements(result || []);
    } catch (err: any) {
      console.error('Error fetching movements:', err?.message || err);
    } finally {
      setLoadingMovements(false);
    }
  };

  const handleBackfillMovements = async () => {
    if (!confirm('¿Deseas reconstruir y migrar los movimientos de inventario históricos para todas las órdenes existentes? Se recalcularán metros planeados y reales según los cortes de cada orden.')) {
      return;
    }
    setLoadingBackfill(true);
    try {
      const { data: dbOrders, error: ordersErr } = await supabase
        .from('orders')
        .select('id, internal_code, status');
      if (ordersErr) throw ordersErr;

      const { data: dbCuts, error: cutsErr } = await supabase
        .from('cuts')
        .select('*');
      if (cutsErr) throw cutsErr;

      const { error: deleteErr } = await supabase
        .from('inventory_movements')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (deleteErr) throw deleteErr;

      const movementsToInsert: any[] = [];

      for (const order of (dbOrders || [])) {
        const orderCuts = (dbCuts || []).filter(c => c.order_id === order.id);
        if (orderCuts.length === 0) continue;

        const fabricColorKeys = new Set<string>();
        orderCuts.forEach(c => {
          if (!c.fabric_id) return;
          fabricColorKeys.add(`${c.fabric_id}_${c.color_id || 'none'}`);
        });

        fabricColorKeys.forEach(key => {
          const [fabricId, colorIdStr] = key.split('_');
          const colorId = colorIdStr === 'none' ? null : colorIdStr;

          const matchingCuts = orderCuts.filter(c => 
            String(c.fabric_id) === fabricId && 
            String(c.color_id || 'none') === (colorId || 'none')
          );

          const planeados = matchingCuts.reduce((sum, c) => 
            sum + ((Number(c.stroke_length) || 0) * (Number(c.layers) || 0)), 0
          );

          const reales = matchingCuts.reduce((sum, c) => 
            sum + ((Number(c.stroke_length) || 0) * (Number(c.layers_produced || c.layers) || 0)), 0
          );

          let estado = 'planeacion';
          let metrosReales = 0;

          const status = (order.status || '').toLowerCase();
          if (status === 'planeada' || status === 'en corte') {
            estado = 'planeacion';
            metrosReales = 0;
          } else if (status === 'tendido' || status === 'cortado' || status === 'en confección' || status === 'en confeccion') {
            estado = 'corte';
            metrosReales = reales;
          } else if (status === 'completada') {
            estado = 'confeccion';
            metrosReales = reales;
          } else {
            estado = 'planeacion';
            metrosReales = 0;
          }

          movementsToInsert.push({
            order_id: order.id,
            fabric_id: fabricId,
            color_id: colorId,
            metros_planeados: planeados,
            metros_reales: metrosReales,
            tipo_movimiento: 'egreso',
            estado: estado,
            observaciones: `Migración histórica automática - Estado orden: ${order.status || 'N/A'}`
          });
        });
      }

      if (movementsToInsert.length > 0) {
        const { error: insertErr } = await supabase
          .from('inventory_movements')
          .insert(movementsToInsert);
        if (insertErr) throw insertErr;
      }

      alert(`¡Migración exitosa! Se generaron ${movementsToInsert.length} registros de movimientos para ${dbOrders?.length || 0} órdenes.`);
      await fetchMovements();
    } catch (err: any) {
      alert('Error en la migración: ' + (err.message || err));
      console.error('Migration error:', err);
    } finally {
      setLoadingBackfill(false);
    }
  };

  const handleClearMovements = async () => {
    setClearingMovements(true);
    try {
      const { error } = await supabase
        .from('inventory_movements')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      setMovements([]);
      setShowClearConfirm(false);
      alert('✅ Todos los movimientos de inventario han sido eliminados.');
    } catch (err: any) {
      alert('Error al vaciar movimientos: ' + (err.message || err));
      console.error('Clear movements error:', err);
    } finally {
      setClearingMovements(false);
    }
  };

  // ── ROLLOS: Create ─────────────────────────────────────────────────────────
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

  // ── ROLLOS: Edit ───────────────────────────────────────────────────────────
  const handleOpenEditRollo = (item: any) => {
    setEditRolloData({ ...item });
    setShowEditRolloModal(true);
  };

  const handleSaveRollo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRolloData) return;
    setSavingRollo(true);
    try {
      const { error } = await supabase
        .from('fabric_inventory')
        .update({
          fabric_id: editRolloData.fabric_id,
          color_id: editRolloData.color_id,
          kilos: editRolloData.kilos,
          meters: editRolloData.meters,
          location: editRolloData.location,
        })
        .eq('id', editRolloData.id);
      if (error) throw error;
      setShowEditRolloModal(false);
      setEditRolloData(null);
      fetchData();
    } catch (err: any) {
      alert('Error al actualizar: ' + err.message);
    } finally {
      setSavingRollo(false);
    }
  };

  // ── ROLLOS: Delete ─────────────────────────────────────────────────────────
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

  // ── MOVIMIENTOS: Inline edit ───────────────────────────────────────────────
  const startEditMov = (m: any) => {
    setEditingMovId(m.id);
    setEditMovData({
      metros_planeados: String(m.metros_planeados ?? ''),
      metros_reales: String(m.metros_reales ?? ''),
      estado: m.estado ?? 'planeacion',
      observaciones: m.observaciones ?? ''
    });
  };

  const cancelEditMov = () => {
    setEditingMovId(null);
  };

  const saveEditMov = async (id: string) => {
    setSavingMov(true);
    try {
      const { error } = await supabase
        .from('inventory_movements')
        .update({
          metros_planeados: Number(editMovData.metros_planeados) || 0,
          metros_reales: Number(editMovData.metros_reales) || 0,
          estado: editMovData.estado,
          observaciones: editMovData.observaciones,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      if (error) throw error;
      setEditingMovId(null);
      await fetchMovements();
    } catch (err: any) {
      alert('Error al guardar: ' + err.message);
    } finally {
      setSavingMov(false);
    }
  };

  const handleDeleteMov = async (id: string) => {
    if (!confirm('¿Eliminar este movimiento de inventario?')) return;
    try {
      const { error } = await supabase.from('inventory_movements').delete().eq('id', id);
      if (error) throw error;
      setMovements(prev => prev.filter(m => m.id !== id));
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  // ── Computed ───────────────────────────────────────────────────────────────
  const totalKilos  = data.reduce((acc, item) => acc + (Number(item.kilos) || 0), 0);
  const totalMeters = data.reduce((acc, item) => acc + (Number(item.meters) || 0), 0);
  const totalRolls  = data.length;

  const handleOpenModal = () => {
    const nextNum  = (data.length + 1).toString().padStart(3, '0');
    const year     = new Date().getFullYear();
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

  const filteredMovements = movements.filter(m => {
    const matchesEstado = movEstado === 'all' || m.estado === movEstado;
    const q = movSearch.toLowerCase().trim();
    if (!q) return matchesEstado;
    return matchesEstado && (
      (m.orders?.internal_code && m.orders.internal_code.toLowerCase().includes(q)) ||
      (m.fabrics?.nombre_tela && m.fabrics.nombre_tela.toLowerCase().includes(q)) ||
      (m.colors?.nombre_color && m.colors.nombre_color.toLowerCase().includes(q))
    );
  });

  const totalPlaneados  = movements.reduce((s, m) => s + (Number(m.metros_planeados) || 0), 0);
  const totalReales     = movements.filter(m => m.estado !== 'planeacion').reduce((s, m) => s + (Number(m.metros_reales) || 0), 0);
  const diferencia      = totalPlaneados - totalReales;
  const countPlaneacion = movements.filter(m => m.estado === 'planeacion').length;
  const countCorte      = movements.filter(m => m.estado === 'corte').length;
  const countConfeccion = movements.filter(m => m.estado === 'confeccion').length;

  const inputStyle = {
    padding: '0.375rem 0.625rem',
    borderRadius: '6px',
    border: '1.5px solid #6366f1',
    fontSize: '0.82rem',
    fontWeight: '600',
    outline: 'none',
    width: '100%',
    backgroundColor: '#f8f9ff'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.75rem', fontWeight: '950' }}>
            <Package size={32} style={{ color: 'var(--primary)' }} /> Inventario de Telas
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Control de rollos, kilos, metros y movimientos por orden de corte.</p>
        </div>
        {activeTab === 'rollos' && (
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn btn-secondary">
              <MoveHorizontal size={18} /> Traslado
            </button>
            <button className="btn btn-primary" onClick={handleOpenModal}>
              <Plus size={18} /> Entrada de Tela
            </button>
          </div>
        )}
        {activeTab === 'movimientos' && (
          <div style={{ display: 'flex', gap: '1rem' }}>
            {!movementsTableMissing && (
              <button className="btn btn-secondary" onClick={handleBackfillMovements} disabled={loadingBackfill}>
                {loadingBackfill ? <Loader2 className="animate-spin" size={16} /> : <Database size={16} />} Migrar Históricos
              </button>
            )}
            <button className="btn btn-secondary" onClick={fetchMovements}>
              <Activity size={18} /> Actualizar
            </button>
            {!movementsTableMissing && (
              <button
                id="btn-admin-vaciar-movimientos"
                onClick={() => setShowClearConfirm(true)}
                disabled={clearingMovements || movements.length === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.625rem 1.25rem', borderRadius: '10px', border: '2px solid #ef4444',
                  backgroundColor: 'transparent', color: '#ef4444',
                  fontWeight: '800', fontSize: '0.8rem', cursor: movements.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: movements.length === 0 ? 0.4 : 1, transition: 'all 0.2s'
                }}
              >
                <Trash2 size={16} /> Vaciar Todo
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'white', padding: '0.375rem', borderRadius: '12px', width: 'fit-content', border: '1px solid var(--border)' }}>
        {([
          { key: 'rollos',      label: 'Rollos en Bodega',         icon: Package },
          { key: 'movimientos', label: 'Movimientos de Inventario', icon: Activity }
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="btn"
            style={{
              borderRadius: '8px',
              padding: '0.625rem 1.25rem',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              backgroundColor: activeTab === tab.key ? 'var(--primary)' : 'transparent',
              color: activeTab === tab.key ? 'white' : 'var(--text)',
              border: 'none',
              fontWeight: '700',
              fontSize: '0.875rem'
            }}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: ROLLOS ───────────────────────────────────────────────────────── */}
      {activeTab === 'rollos' && (
        <>
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
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              className="btn-icon"
                              onClick={() => handleOpenEditRollo(item)}
                              title="Editar rollo"
                              style={{ color: '#6366f1' }}
                            >
                              <Edit2 size={15} />
                            </button>
                            <button className="btn-icon" onClick={() => handleDelete(item.id)} style={{ color: '#ef4444' }}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── TAB: MOVIMIENTOS ──────────────────────────────────────────────────── */}
      {activeTab === 'movimientos' && (
        <>
          {movementsTableMissing && (
            <div style={{
              background: 'linear-gradient(135deg, #fef3c7, #fffbeb)',
              border: '1.5px solid #f59e0b',
              borderRadius: '14px',
              padding: '1.75rem 2rem',
              display: 'flex',
              gap: '1.25rem',
              alignItems: 'flex-start'
            }}>
              <span style={{ fontSize: '2rem', lineHeight: 1 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: '800', fontSize: '1rem', color: '#92400e', marginBottom: '0.5rem' }}>
                  Tabla <code style={{ backgroundColor: '#fde68a', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>inventory_movements</code> no encontrada en Supabase
                </p>
                <p style={{ fontSize: '0.875rem', color: '#78350f', lineHeight: 1.6, marginBottom: '1rem' }}>
                  Debes ejecutar el SQL de migración en el <strong>SQL Editor</strong> de tu Dashboard de Supabase para activar este módulo.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <code style={{
                    display: 'block', background: '#1e293b', color: '#86efac',
                    padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.78rem',
                    lineHeight: 1.8, whiteSpace: 'pre', overflowX: 'auto'
                  }}>{`CREATE TABLE IF NOT EXISTS inventory_movements (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  order_id         uuid REFERENCES orders(id) ON DELETE CASCADE,
  fabric_id        integer REFERENCES fabrics(id),
  color_id         integer REFERENCES colors(id),
  metros_planeados numeric(10,2) NOT NULL DEFAULT 0,
  metros_reales    numeric(10,2) NOT NULL DEFAULT 0,
  tipo_movimiento  text NOT NULL DEFAULT 'egreso',
  estado           text NOT NULL DEFAULT 'planeacion',
  observaciones    text
);
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON inventory_movements
  FOR ALL USING (auth.role() = 'authenticated');`}</code>
                  <button className="btn btn-primary" onClick={fetchMovements} style={{ marginTop: '0.5rem', alignSelf: 'flex-start' }}>
                    <Activity size={16} /> Reintentar conexión
                  </button>
                </div>
              </div>
            </div>
          )}

          {!movementsTableMissing && (
          <>

          {/* KPIs movimientos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem' }}>
            {[
              { label: 'Metros Planeados',   value: `${totalPlaneados.toFixed(1)} m`,  color: '#7c3aed', bg: '#ede9fe' },
              { label: 'Metros Reales',      value: `${totalReales.toFixed(1)} m`,     color: '#2563eb', bg: '#dbeafe' },
              { label: 'Diferencia',         value: `${diferencia.toFixed(1)} m`,      color: diferencia > 0 ? '#f59e0b' : '#10b981', bg: diferencia > 0 ? '#fef3c7' : '#d1fae5' },
              { label: 'En Planeación',      value: countPlaneacion,                   color: '#f59e0b', bg: '#fef3c7' },
              { label: 'En Corte',           value: countCorte,                        color: '#3b82f6', bg: '#dbeafe' },
              { label: 'En Confección',      value: countConfeccion,                   color: '#10b981', bg: '#d1fae5' }
            ].map((kpi, i) => (
              <div key={i} className="card" style={{ padding: '1.25rem', borderLeft: `4px solid ${kpi.color}` }}>
                <p style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{kpi.label}</p>
                <p style={{ fontSize: '1.5rem', fontWeight: '900', color: kpi.color }}>{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Hint edición */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            background: 'linear-gradient(135deg, #ede9fe, #e0e7ff)',
            border: '1.5px solid #a5b4fc',
            borderRadius: '12px',
            padding: '0.875rem 1.25rem',
            fontSize: '0.82rem',
            fontWeight: '600',
            color: '#4338ca'
          }}>
            <Edit2 size={16} />
            Haz clic en el ícono <Edit2 size={13} style={{ display: 'inline', margin: '0 4px' }} /> de cualquier fila para editar metros planeados, metros reales, estado y observaciones directamente.
          </div>

          {/* Filtros */}
          <div className="card" style={{ padding: '0' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
                <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Buscar por OC, tela o color..."
                  value={movSearch}
                  onChange={e => setMovSearch(e.target.value)}
                  style={{ width: '100%', padding: '0.625rem 1rem 0.625rem 2.5rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['all', 'planeacion', 'corte', 'confeccion'].map(estado => {
                  const cfg = estado === 'all' ? null : ESTADO_CONFIG[estado];
                  const isActive = movEstado === estado;
                  return (
                    <button
                      key={estado}
                      onClick={() => setMovEstado(estado)}
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '8px',
                        border: '1.5px solid',
                        borderColor: isActive ? (cfg?.color || 'var(--primary)') : 'var(--border)',
                        backgroundColor: isActive ? (cfg?.bg || '#ede9fe') : 'white',
                        color: isActive ? (cfg?.color || 'var(--primary)') : 'var(--text-muted)',
                        fontWeight: '700',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {estado === 'all' ? 'Todos' : cfg?.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', backgroundColor: '#f8fafc' }}>
                    {['Orden de Corte', 'Tela', 'Color', 'Metros Planeados', 'Metros Reales', 'Diferencia', 'Estado', 'Observaciones', 'Fecha', 'Acciones'].map(h => (
                      <th key={h} style={{ padding: '0.875rem 1.25rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingMovements ? (
                    <tr><td colSpan={10} style={{ padding: '4rem', textAlign: 'center' }}>
                      <Loader2 className="animate-spin" size={36} style={{ color: 'var(--primary)', opacity: 0.5 }} />
                    </td></tr>
                  ) : filteredMovements.length === 0 ? (
                    <tr><td colSpan={10} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <TrendingDown size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                      <p>No hay movimientos de inventario registrados aún.</p>
                      <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Se generan automáticamente al crear o editar una Orden de Corte.</p>
                    </td></tr>
                  ) : filteredMovements.map(m => {
                    const isEditing = editingMovId === m.id;
                    const cfg = ESTADO_CONFIG[isEditing ? editMovData.estado : m.estado] || ESTADO_CONFIG['planeacion'];
                    const MetrosPlaneados = isEditing ? (Number(editMovData.metros_planeados) || 0) : (Number(m.metros_planeados) || 0);
                    const MetrosReales    = isEditing ? (Number(editMovData.metros_reales) || 0) : (Number(m.metros_reales) || 0);
                    const diff            = MetrosPlaneados - MetrosReales;
                    const hasRealData     = (isEditing ? editMovData.estado : m.estado) !== 'planeacion';

                    return (
                      <tr
                        key={m.id}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          transition: 'background 0.15s',
                          backgroundColor: isEditing ? '#f5f3ff' : undefined
                        }}
                        className="hover-row"
                      >
                        {/* Orden */}
                        <td style={{ padding: '0.75rem 1.25rem' }}>
                          <span style={{ fontWeight: '900', color: 'var(--primary)', fontSize: '0.875rem' }}>
                            {m.orders?.internal_code || '—'}
                          </span>
                          {m.orders?.status && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>{m.orders.status}</div>
                          )}
                        </td>

                        {/* Tela */}
                        <td style={{ padding: '0.75rem 1.25rem', fontWeight: '600', fontSize: '0.875rem' }}>
                          {m.fabrics?.nombre_tela || '—'}
                        </td>

                        {/* Color */}
                        <td style={{ padding: '0.75rem 1.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {m.colors?.hex_color && (
                              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: m.colors.hex_color, border: '1px solid #e2e8f0', flexShrink: 0 }} />
                            )}
                            <span style={{ fontSize: '0.875rem' }}>{m.colors?.nombre_color || '—'}</span>
                          </div>
                        </td>

                        {/* Metros Planeados */}
                        <td style={{ padding: '0.75rem 1.25rem', minWidth: '130px' }}>
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.01"
                              value={editMovData.metros_planeados}
                              onChange={e => setEditMovData(prev => ({ ...prev, metros_planeados: e.target.value }))}
                              style={inputStyle}
                            />
                          ) : (
                            <span style={{ fontWeight: '700', fontSize: '0.875rem', color: '#7c3aed' }}>
                              {MetrosPlaneados.toFixed(2)} m
                            </span>
                          )}
                        </td>

                        {/* Metros Reales */}
                        <td style={{ padding: '0.75rem 1.25rem', minWidth: '130px' }}>
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.01"
                              value={editMovData.metros_reales}
                              onChange={e => setEditMovData(prev => ({ ...prev, metros_reales: e.target.value }))}
                              style={inputStyle}
                            />
                          ) : hasRealData ? (
                            <span style={{ fontWeight: '700', fontSize: '0.875rem', color: '#2563eb' }}>
                              {MetrosReales.toFixed(2)} m
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>Pendiente</span>
                          )}
                        </td>

                        {/* Diferencia */}
                        <td style={{ padding: '0.75rem 1.25rem' }}>
                          {hasRealData ? (
                            <span style={{
                              fontWeight: '700',
                              fontSize: '0.8rem',
                              color: Math.abs(diff) < 0.5 ? '#10b981' : diff > 0 ? '#f59e0b' : '#ef4444',
                              padding: '0.2rem 0.6rem',
                              borderRadius: '6px',
                              backgroundColor: Math.abs(diff) < 0.5 ? '#d1fae5' : diff > 0 ? '#fef3c7' : '#fee2e2'
                            }}>
                              {diff >= 0 ? '+' : ''}{diff.toFixed(2)} m
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>—</span>
                          )}
                        </td>

                        {/* Estado */}
                        <td style={{ padding: '0.75rem 1.25rem', minWidth: '140px' }}>
                          {isEditing ? (
                            <select
                              value={editMovData.estado}
                              onChange={e => setEditMovData(prev => ({ ...prev, estado: e.target.value }))}
                              style={{ ...inputStyle, cursor: 'pointer' }}
                            >
                              <option value="planeacion">Planeación</option>
                              <option value="corte">Corte</option>
                              <option value="confeccion">Confección</option>
                            </select>
                          ) : (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                              padding: '0.3rem 0.75rem', borderRadius: '20px',
                              backgroundColor: cfg.bg, color: cfg.color,
                              fontWeight: '700', fontSize: '0.75rem'
                            }}>
                              <cfg.icon size={12} />
                              {cfg.label}
                            </span>
                          )}
                        </td>

                        {/* Observaciones */}
                        <td style={{ padding: '0.75rem 1.25rem', minWidth: '180px' }}>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editMovData.observaciones}
                              onChange={e => setEditMovData(prev => ({ ...prev, observaciones: e.target.value }))}
                              placeholder="Observaciones..."
                              style={inputStyle}
                            />
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: m.observaciones ? 'normal' : 'italic' }}>
                              {m.observaciones || '—'}
                            </span>
                          )}
                        </td>

                        {/* Fecha */}
                        <td style={{ padding: '0.75rem 1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {m.created_at ? new Date(m.created_at).toLocaleDateString('es-ES') : '—'}
                        </td>

                        {/* Acciones */}
                        <td style={{ padding: '0.75rem 1.25rem' }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button
                                onClick={() => saveEditMov(m.id)}
                                disabled={savingMov}
                                title="Guardar cambios"
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                                  padding: '0.4rem 0.8rem', borderRadius: '8px',
                                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                  color: 'white', border: 'none', fontWeight: '700',
                                  fontSize: '0.78rem', cursor: savingMov ? 'not-allowed' : 'pointer',
                                  opacity: savingMov ? 0.7 : 1
                                }}
                              >
                                {savingMov ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                Guardar
                              </button>
                              <button
                                onClick={cancelEditMov}
                                title="Cancelar"
                                style={{
                                  display: 'flex', alignItems: 'center',
                                  padding: '0.4rem 0.6rem', borderRadius: '8px',
                                  background: '#f1f5f9', color: '#64748b',
                                  border: '1px solid #e2e8f0', cursor: 'pointer'
                                }}
                              >
                                <XCircle size={14} />
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button
                                className="btn-icon"
                                onClick={() => startEditMov(m)}
                                title="Editar movimiento"
                                style={{ color: '#6366f1' }}
                              >
                                <Edit2 size={15} />
                              </button>
                              <button
                                className="btn-icon"
                                onClick={() => handleDeleteMov(m.id)}
                                title="Eliminar movimiento"
                                style={{ color: '#ef4444' }}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          </>
          )}
        </>
      )}


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
                  type="text" required readOnly
                  value={formData.roll_number || ''}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#f9fafb', color: 'var(--text-muted)', fontWeight: '700' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Tela (Maestro)</label>
                  <select required style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                    onChange={(e) => setFormData({...formData, fabric_id: e.target.value})}>
                    <option value="">Seleccionar...</option>
                    {fabrics.map(f => <option key={f.id} value={f.id}>{f.nombre_tela}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Color (Maestro)</label>
                  <select required style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                    onChange={(e) => setFormData({...formData, color_id: e.target.value})}>
                    <option value="">Seleccionar...</option>
                    {colors.map(c => <option key={c.id} value={c.id}>{c.nombre_color}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Kilos Netos</label>
                  <input type="number" step="0.01" required style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                    onChange={(e) => setFormData({...formData, kilos: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Metros Estimados</label>
                  <input type="number" step="0.01" required style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                    onChange={(e) => setFormData({...formData, meters: e.target.value})} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Bodega (Maestro)</label>
                <select required style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}>
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

      {/* Modal Editar Rollo */}
      {showEditRolloModal && editRolloData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: '90%', maxWidth: '500px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit2 size={20} style={{ color: '#6366f1' }} /> Editar Rollo {editRolloData.roll_number}
              </h3>
              <button onClick={() => setShowEditRolloModal(false)} className="btn-icon"><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveRollo} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Tela</label>
                  <select
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                    value={editRolloData.fabric_id || ''}
                    onChange={e => setEditRolloData({ ...editRolloData, fabric_id: e.target.value })}
                  >
                    <option value="">Seleccionar...</option>
                    {fabrics.map(f => <option key={f.id} value={f.id}>{f.nombre_tela}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Color</label>
                  <select
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                    value={editRolloData.color_id || ''}
                    onChange={e => setEditRolloData({ ...editRolloData, color_id: e.target.value })}
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
                    type="number"
                    step="0.01"
                    value={editRolloData.kilos || ''}
                    onChange={e => setEditRolloData({ ...editRolloData, kilos: e.target.value })}
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Metros Estimados</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editRolloData.meters || ''}
                    onChange={e => setEditRolloData({ ...editRolloData, meters: e.target.value })}
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Bodega / Ubicación</label>
                <select
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                  value={editRolloData.location || ''}
                  onChange={e => setEditRolloData({ ...editRolloData, location: e.target.value })}
                >
                  <option value="">Seleccionar Bodega...</option>
                  {warehouses.map(w => <option key={w.id} value={w.nombre_bodega}>{w.nombre_bodega}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowEditRolloModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingRollo}
                  style={{
                    flex: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    padding: '0.75rem', borderRadius: '10px',
                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    color: 'white', border: 'none', fontWeight: '800',
                    fontSize: '0.9rem', cursor: savingRollo ? 'not-allowed' : 'pointer',
                    opacity: savingRollo ? 0.7 : 1
                  }}
                >
                  {savingRollo ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Vaciar Movimientos */}
      {showClearConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: '90%', maxWidth: '400px', padding: '2rem', textAlign: 'center' }}>
            <div style={{ color: '#ef4444', marginBottom: '1rem' }}>
              <Trash2 size={48} style={{ margin: '0 auto' }} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.75rem', color: '#1e293b' }}>
              ¿Vaciar todos los movimientos?
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              Esta acción es irreversible. Se eliminarán permanentemente todos los registros de movimientos de inventario del Kardex.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                onClick={() => setShowClearConfirm(false)} 
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancelar
              </button>
              <button 
                onClick={handleClearMovements} 
                disabled={clearingMovements}
                style={{ 
                  flex: 1,
                  backgroundColor: '#ef4444', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '8px', 
                  padding: '0.625rem 1rem', 
                  fontWeight: '700', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                {clearingMovements ? <Loader2 className="animate-spin" size={16} /> : 'Sí, Vaciar Todo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
