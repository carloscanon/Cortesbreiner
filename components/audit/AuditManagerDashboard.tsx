import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck, BarChart3, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown,
  Building2, Package, RefreshCw, Plus, Eye, Play, DollarSign, FileText, Layers, AlertCircle, FileSpreadsheet, Trash2
} from 'lucide-react';

interface AuditManagerDashboardProps {
  warehouses: any[];
  user: any;
  profile: any;
  isAdmin?: boolean;
  onOpenScanner: (session: any) => void;
  onOpenReconciliation: (session: any) => void;
}

export default function AuditManagerDashboard({
  warehouses,
  user,
  profile,
  isAdmin = false,
  onOpenScanner,
  onOpenReconciliation
}: AuditManagerDashboardProps) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Modal Create Audit Session
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newLocationId, setNewLocationId] = useState('');
  const [newAuditType, setNewAuditType] = useState('Completo');
  const [newNotes, setNewNotes] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Check if current user is superadmin
  const isSuperAdminUser = isAdmin || profile?.role === 'super_admin' || profile?.role === 'admin' || user?.email?.includes('admin');

  // Delete Audit Session Handler
  const handleDeleteSession = async (session: any) => {
    const confirmMessage = `⚠️ ¿ESTÁS SEGURO DE ELIMINAR LA AUDITORÍA #${session.consecutive} (${session.location_name})?\n\nEsta acción eliminará permanentemente todos los conteos y registros de esta auditoría.`;
    if (!window.confirm(confirmMessage)) return;

    setDeletingId(session.id);
    try {
      const res = await fetch(`/api/inventory/audit/sessions?id=${session.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar la auditoría.');

      alert(`✅ Sesión de Auditoría #${session.consecutive} eliminada exitosamente.`);
      await fetchAuditSessions();
    } catch (err: any) {
      alert('❌ Error al eliminar: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // Fetch audit sessions from DB API
  const fetchAuditSessions = async () => {
    setLoading(true);
    try {
      let url = `/api/inventory/audit/sessions?locationId=${selectedLocation}&status=${selectedStatus}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.success) {
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error('Error fetching audit sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditSessions();
  }, [selectedLocation, selectedStatus]);

  // Create new Audit Session Handler
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocationId) return alert('Selecciona la tienda o bodega a auditar.');

    setIsCreating(true);
    try {
      const whObj = warehouses.find(w => w.id === newLocationId);
      const locationName = whObj?.nombre_bodega || whObj?.name || 'Ubicación Desconocida';

      const res = await fetch('/api/inventory/audit/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: newLocationId,
          locationName,
          auditType: newAuditType,
          userEmail: user?.email || 'Sistema',
          notes: newNotes
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear la sesión.');

      alert(`✅ Sesión de Auditoría #${data.session.consecutive} creada exitosamente en ${locationName}`);
      setShowCreateModal(false);
      setNewLocationId('');
      setNewNotes('');
      await fetchAuditSessions();
      onOpenScanner(data.session);
    } catch (err: any) {
      alert('❌ Error: ' + err.message);
    } finally {
      setIsCreating(false);
    }
  };

  // Executive Metrics Calculations
  const totalAuditsCount = sessions.length;
  const totalFinancialImpact = sessions.reduce((sum, s) => sum + Number(s.financial_impact || 0), 0);
  const totalMissingQty = sessions.reduce((sum, s) => sum + Number(s.total_missing_qty || 0), 0);
  const totalSurplusQty = sessions.reduce((sum, s) => sum + Number(s.total_surplus_qty || 0), 0);
  const avgReconciliationRate = sessions.length > 0 ? Math.round(sessions.reduce((sum, s) => sum + Number(s.reconciliation_rate || 0), 0) / sessions.length) : 100;

  // Risk Heatmap by Store/Warehouse
  const riskByLocation = useMemo(() => {
    const map: Record<string, { name: string; missing: number; loss: number; auditCount: number }> = {};
    sessions.forEach(s => {
      const locName = s.location_name || 'Ubicación';
      if (!map[locName]) {
        map[locName] = { name: locName, missing: 0, loss: 0, auditCount: 0 };
      }
      map[locName].missing += Number(s.total_missing_qty || 0);
      map[locName].loss += Number(s.financial_missing || 0);
      map[locName].auditCount += 1;
    });
    return Object.values(map).sort((a, b) => b.loss - a.loss);
  }, [sessions]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
      {/* Executive Header Banner */}
      <div style={{
        backgroundColor: '#0f172a', padding: '1.5rem 1.75rem', borderRadius: '20px', color: 'white',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.25)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', backgroundColor: 'rgba(99, 102, 241, 0.2)', borderRadius: '14px', color: '#818cf8' }}>
            <ShieldCheck size={32} />
          </div>
          <div>
            <span style={{ fontSize: '0.72rem', fontWeight: '900', color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              CONTROL Y AUDITORÍA DE INVENTARIO BREINER
            </span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '950', margin: 0 }}>
              Dashboard Ejecutivo y Mapa de Riesgo
            </h2>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
          style={{ padding: '0.75rem 1.5rem', fontWeight: '950', borderRadius: '12px', backgroundColor: '#6366f1', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Plus size={18} /> Nueva Sesión de Auditoría
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
        <div className="card" style={{ padding: '1.25rem', border: '1px solid #e2e8f0', borderRadius: '16px', backgroundColor: 'white' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>TOTAL AUDITORÍAS</span>
          <h3 style={{ fontSize: '1.5rem', fontWeight: '950', margin: '0.2rem 0', color: '#0f172a' }}>{totalAuditsCount} sesiones</h3>
          <p style={{ fontSize: '0.72rem', color: '#64748b', margin: 0 }}>Fábrica, Tiendas y Bodegas</p>
        </div>

        <div className="card" style={{ padding: '1.25rem', border: '1px solid #e2e8f0', borderRadius: '16px', backgroundColor: 'white' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: '900', color: '#10b981', textTransform: 'uppercase' }}>TASA DE CONCILIACIÓN</span>
          <h3 style={{ fontSize: '1.5rem', fontWeight: '950', margin: '0.2rem 0', color: '#059669' }}>{avgReconciliationRate}%</h3>
          <p style={{ fontSize: '0.72rem', color: '#64748b', margin: 0 }}>Exactitud global física</p>
        </div>

        <div className="card" style={{ padding: '1.25rem', border: '1px solid #fca5a5', borderRadius: '16px', backgroundColor: '#fef2f2' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: '900', color: '#dc2626', textTransform: 'uppercase' }}>FALTANTES ACUMULADOS</span>
          <h3 style={{ fontSize: '1.5rem', fontWeight: '950', margin: '0.2rem 0', color: '#b91c1c' }}>-{totalMissingQty.toLocaleString()} uds</h3>
          <p style={{ fontSize: '0.72rem', color: '#dc2626', margin: 0 }}>Piezas sin encontrar</p>
        </div>

        <div className="card" style={{ padding: '1.25rem', border: '1px solid #bae6fd', borderRadius: '16px', backgroundColor: '#f0f9ff' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: '900', color: '#0284c7', textTransform: 'uppercase' }}>SOBRANTES ACUMULADOS</span>
          <h3 style={{ fontSize: '1.5rem', fontWeight: '950', margin: '0.2rem 0', color: '#0369a1' }}>+{totalSurplusQty.toLocaleString()} uds</h3>
          <p style={{ fontSize: '0.72rem', color: '#0284c7', margin: 0 }}>Hallazgos no esperados</p>
        </div>

        <div className="card" style={{ padding: '1.25rem', border: '1px solid #e2e8f0', borderRadius: '16px', backgroundColor: 'white' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>IMPACTO ECONÓMICO ($)</span>
          <h3 style={{ fontSize: '1.4rem', fontWeight: '950', margin: '0.2rem 0', color: totalFinancialImpact < 0 ? '#ef4444' : '#10b981' }}>
            ${totalFinancialImpact.toLocaleString('es-CO')}
          </h3>
          <p style={{ fontSize: '0.72rem', color: '#64748b', margin: 0 }}>Balance de diferencias</p>
        </div>
      </div>

      {/* Risk Heatmap & Audit Sessions List Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Sessions List Table */}
        <div className="card" style={{ padding: '1.5rem', borderRadius: '18px', border: '1px solid #e2e8f0', backgroundColor: 'white', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Filters Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '950', color: '#0f172a', margin: 0 }}>
                Sesiones de Auditoría Registradas ({sessions.length})
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                Conexión en tiempo real a base de datos Supabase
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <select
                value={selectedLocation}
                onChange={e => setSelectedLocation(e.target.value)}
                style={{ padding: '0.55rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.8rem', fontWeight: '700' }}
              >
                <option value="all">Todas las Ubicaciones</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.nombre_bodega || w.name}</option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                style={{ padding: '0.55rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.8rem', fontWeight: '700' }}
              >
                <option value="all">Todos los Estados</option>
                <option value="En Progreso">En Progreso</option>
                <option value="En Revision">En Revisión</option>
                <option value="Ajustado">Ajustado / Cerrado</option>
              </select>

              <button onClick={fetchAuditSessions} className="btn btn-secondary" style={{ padding: '0.55rem', borderRadius: '10px' }}>
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
              <thead style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', fontWeight: '800', color: '#475569' }}>
                <tr>
                  <th style={{ padding: '0.85rem 1rem' }}>Auditoría #</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Ubicación</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Tipo</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Esperado</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Contado</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Semáforo</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Estado</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                      No se encontraron auditorías con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  sessions.map(s => {
                    const rate = s.reconciliation_rate ?? 100;
                    const semaforoColor = rate >= 98 ? '#10b981' : rate >= 90 ? '#f59e0b' : '#ef4444';
                    const semaforoLabel = rate >= 98 ? '🟢 Conciliado' : rate >= 90 ? '🟡 Diferencia Menor' : '🔴 Crítico';

                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: '950', color: 'var(--primary)' }}>
                          #{s.consecutive}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: '800', color: '#0f172a' }}>
                          {s.location_name}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: '#475569' }}>
                          {s.audit_type}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: '800', color: '#64748b' }}>
                          {(s.total_expected_qty || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: '950', color: '#0f172a' }}>
                          {(s.total_counted_qty || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                          <span style={{ backgroundColor: `${semaforoColor}15`, color: semaforoColor, fontWeight: '900', padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.72rem' }}>
                            {semaforoLabel} ({rate}%)
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                          <span style={{
                            padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '900',
                            backgroundColor: s.status === 'Ajustado' ? '#ecfdf5' : s.status === 'En Revision' ? '#fffbeb' : '#eef2ff',
                            color: s.status === 'Ajustado' ? '#047857' : s.status === 'En Revision' ? '#b45309' : '#4338ca'
                          }}>
                            {s.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                            <button
                              onClick={() => onOpenScanner(s)}
                              className="btn btn-primary"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', fontWeight: '850', borderRadius: '8px' }}
                            >
                              🔍 Escanear / Contar
                            </button>
                            <button
                              onClick={() => onOpenReconciliation(s)}
                              className="btn btn-secondary"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', fontWeight: '850', borderRadius: '8px' }}
                            >
                              ⚙️ Conciliar
                            </button>
                            {isSuperAdminUser && (
                              <button
                                onClick={() => handleDeleteSession(s)}
                                disabled={deletingId === s.id}
                                title="Eliminar auditoría (Solo SuperAdministrador)"
                                style={{
                                  padding: '0.35rem 0.55rem',
                                  fontSize: '0.75rem',
                                  fontWeight: '850',
                                  borderRadius: '8px',
                                  backgroundColor: '#fee2e2',
                                  color: '#dc2626',
                                  border: '1px solid #fca5a5',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.2rem'
                                }}
                              >
                                <Trash2 size={14} /> {deletingId === s.id ? '...' : ''}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Risk Map Panel */}
        <div className="card" style={{ padding: '1.5rem', borderRadius: '18px', border: '1px solid #e2e8f0', backgroundColor: 'white', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '950', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertTriangle size={18} style={{ color: '#ef4444' }} /> Mapa de Riesgo de Pérdidas
            </h3>
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
              Ubicaciones con mayor nivel de diferencia acumulada
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {riskByLocation.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>Sin datos de auditoría suficientes.</p>
            ) : (
              riskByLocation.map((r, i) => (
                <div key={i} style={{ padding: '0.85rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '900', color: '#0f172a' }}>{r.name}</h4>
                    <span style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: '800' }}>-{r.missing} prendas faltantes</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: '950', color: '#ef4444' }}>-${r.loss.toLocaleString('es-CO')}</span>
                    <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{r.auditCount} auditoría(s)</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* CREATE AUDIT SESSION MODAL */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1100, padding: '1.5rem'
        }}>
          <div className="card" style={{
            width: '100%', maxWidth: '520px', backgroundColor: 'white', borderRadius: '20px',
            overflow: 'hidden', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem'
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '950', color: '#0f172a' }}>
                Nueva Sesión de Auditoría Físico
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                Selecciona la tienda o bodega para tomar la foto fija del inventario esperado.
              </p>
            </div>

            <form onSubmit={handleCreateSession} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#334155', marginBottom: '0.3rem' }}>
                  Ubicación a Auditar (Fábrica, Tienda o Bodega)
                </label>
                <select
                  value={newLocationId}
                  onChange={e => setNewLocationId(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '700' }}
                  required
                >
                  <option value="">Seleccionar Ubicación...</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.nombre_bodega || w.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#334155', marginBottom: '0.3rem' }}>
                  Tipo de Auditoría
                </label>
                <select
                  value={newAuditType}
                  onChange={e => setNewAuditType(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '700' }}
                >
                  <option value="Completo">Inventario Completo (100%)</option>
                  <option value="Parcial">Inventario Parcial</option>
                  <option value="Por Categoria">Por Categoría</option>
                  <option value="Por Referencia">Por Referencia</option>
                  <option value="Muestreo">Muestreo Aleatorio</option>
                  <option value="Ciclico">Auditoría Cíclica</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#334155', marginBottom: '0.3rem' }}>
                  Observaciones / Notas de Inicio
                </label>
                <textarea
                  placeholder="Ej. Auditoría trimestral de inventario físico..."
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', minHeight: '60px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                  style={{ padding: '0.65rem 1.25rem', fontWeight: '800' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="btn btn-primary"
                  style={{ padding: '0.65rem 1.5rem', fontWeight: '950', backgroundColor: '#6366f1' }}
                >
                  {isCreating ? 'Iniciando...' : '🚀 Iniciar Sesión de Auditoría'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
