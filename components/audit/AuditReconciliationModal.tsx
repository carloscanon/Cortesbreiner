import React, { useState, useEffect, useMemo } from 'react';
import {
  X, CheckCircle2, AlertTriangle, Send, DollarSign, FileText, Check, ShieldCheck, RefreshCw,
  AlertCircle, Search, Layers, ArrowRight, CheckSquare, HelpCircle, ChevronLeft, ChevronRight,
  Package, MapPin, Sparkles
} from 'lucide-react';

interface AuditReconciliationModalProps {
  session: any;
  userEmail: string;
  onClose: () => void;
  onRefreshData: () => void;
}

type TabType = 'all' | 'conciliados' | 'faltantes' | 'sobrantes';

export default function AuditReconciliationModal({
  session,
  userEmail,
  onClose,
  onRefreshData
}: AuditReconciliationModalProps) {
  const [sessionData, setSessionData] = useState<any>(session);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJustifyItem, setSelectedJustifyItem] = useState<any>(null);
  const [justificationText, setJustificationText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [adjustmentReason, setAdjustmentReason] = useState('Diferencias validadas en auditoría física');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Load audit items for session
  const fetchSessionItems = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory/audit/sessions?sessionId=${session.id}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setSessionData(data.session);
        setItems(data.items || []);
      }
    } catch (err) {
      console.error('Error fetching session items:', err);
    } finally {
      setLoading(false);
    }
  };

  // Recalculate & validate full reconciliation against DB inventory
  const handleRecalculate = async (silent = false) => {
    setIsRecalculating(true);
    try {
      const res = await fetch('/api/inventory/audit/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auditId: session.id,
          actionType: 'RECALCULATE_RECONCILIATION',
          userEmail: userEmail || 'Auditor'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al recalcular conciliación.');

      await fetchSessionItems();
      onRefreshData();
      if (!silent) {
        alert(`✅ Conciliación recalculada con éxito:\n\n• Esperados en bodega: ${data.summary?.totalExpected || 0}\n• Leídos físicamente: ${data.summary?.totalCounted || 0}\n• Conciliados (Encontrados): ${data.summary?.conciliados || 0}\n• Faltantes: ${data.summary?.faltantes || 0}\n• Sobrantes / Otra bodega: ${data.summary?.sobrantes || 0}`);
      }
    } catch (err: any) {
      console.error('Error recalculating:', err);
      if (!silent) alert('❌ Error: ' + err.message);
    } finally {
      setIsRecalculating(false);
    }
  };

  useEffect(() => {
    fetchSessionItems();
  }, [session.id]);

  // Justify item handler
  const handleJustifyItem = async () => {
    if (!selectedJustifyItem || !justificationText.trim()) return alert('Ingresa la justificación de la diferencia.');

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/inventory/audit/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auditId: session.id,
          actionType: 'JUSTIFY_ITEM',
          itemId: selectedJustifyItem.id,
          justification: justificationText.trim(),
          userEmail: userEmail || 'Sistema'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar justificación.');

      alert('✅ Diferencia justificada correctamente.');
      setSelectedJustifyItem(null);
      setJustificationText('');
      await fetchSessionItems();
      onRefreshData();
    } catch (err: any) {
      alert('❌ Error: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Request adjustment handler
  const handleRequestAdjustment = async () => {
    if (!confirm('¿Confirmas enviar esta auditoría a solicitud de ajuste de inventario? Un administrador o supervisor deberá autorizar el cambio.')) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/inventory/audit/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auditId: session.id,
          actionType: 'REQUEST_ADJUSTMENT',
          userEmail: userEmail || 'Auditor',
          reason: adjustmentReason
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al enviar solicitud.');

      alert('✅ Solicitud de ajuste enviada a aprobación con éxito.');
      onClose();
      onRefreshData();
    } catch (err: any) {
      alert('❌ Error: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Approve adjustment & Apply real inventory update
  const handleApproveAdjustment = async () => {
    const totalDiff = (sessionData?.total_missing_qty || 0) + (sessionData?.total_surplus_qty || 0);
    const confirmMessage = `⚠️ ¿CONFIRMAS APROBAR Y APLICAR EL AJUSTE REAL DE INVENTARIO?\n\n` +
      `• Ubicación: ${sessionData?.location_name}\n` +
      `• Conciliados confirmados: ${(sessionData?.total_expected_qty || 0) - (sessionData?.total_missing_qty || 0)} prendas\n` +
      `• Faltantes dados de baja: ${sessionData?.total_missing_qty || 0} prendas\n` +
      `• Sobrantes ingresados a bodega: ${sessionData?.total_surplus_qty || 0} prendas\n\n` +
      `Esta acción actualizará las prendas individuales y el Kardex en la base de datos de forma permanente.`;

    if (!confirm(confirmMessage)) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/inventory/audit/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auditId: session.id,
          actionType: 'APPROVE_ADJUSTMENT',
          userEmail: userEmail || 'Aprobador'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al aprobar ajuste.');

      alert(data.message || '✅ Ajuste aprobado y aplicado en base de datos con éxito.');
      onClose();
      onRefreshData();
    } catch (err: any) {
      alert('❌ Error: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered items list
  const conciliadosList = useMemo(() => items.filter(i => i.status === 'Conciliado' || (i.counted_qty > 0 && i.expected_qty > 0)), [items]);
  const faltantesList = useMemo(() => items.filter(i => i.status === 'Faltante' || (i.expected_qty > 0 && i.counted_qty === 0)), [items]);
  const sobrantesList = useMemo(() => items.filter(i => i.status === 'Sobrante' || (i.expected_qty === 0 && i.counted_qty > 0)), [items]);

  const activeTabItems = useMemo(() => {
    if (activeTab === 'conciliados') return conciliadosList;
    if (activeTab === 'faltantes') return faltantesList;
    if (activeTab === 'sobrantes') return sobrantesList;
    return items;
  }, [activeTab, items, conciliadosList, faltantesList, sobrantesList]);

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return activeTabItems;
    const term = searchTerm.toLowerCase().trim();
    return activeTabItems.filter(i => {
      const bc = (i.barcode || '').toLowerCase();
      const sku = (i.sku_code || '').toLowerCase();
      const name = (i.product_name || '').toLowerCase();
      const color = (i.color_name || '').toLowerCase();
      const size = (i.size_code || '').toLowerCase();
      const just = (i.justification || '').toLowerCase();
      return bc.includes(term) || sku.includes(term) || name.includes(term) || color.includes(term) || size.includes(term) || just.includes(term);
    });
  }, [activeTabItems, searchTerm]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.8)',
      backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 1100, padding: '1.25rem'
    }}>
      <div className="card" style={{
        width: '100%', maxWidth: '1080px', maxHeight: '92vh',
        backgroundColor: 'white', borderRadius: '24px', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.45)',
        border: '1px solid #cbd5e1'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 2rem', background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.65rem', backgroundColor: 'rgba(99, 102, 241, 0.25)', borderRadius: '12px', color: '#a5b4fc' }}>
              <ShieldCheck size={26} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '950', letterSpacing: '-0.02em' }}>
                  Conciliación y Ajustes — Auditoría #{sessionData?.consecutive}
                </h3>
                <span style={{
                  padding: '0.2rem 0.65rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '900',
                  backgroundColor: sessionData?.status === 'Ajustado' ? '#10b981' : '#f59e0b',
                  color: 'white'
                }}>
                  {sessionData?.status || 'En Progreso'}
                </span>
              </div>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                📍 Ubicación: <strong style={{ color: '#e2e8f0' }}>{sessionData?.location_name}</strong> • Tipo: <strong style={{ color: '#e2e8f0' }}>{sessionData?.notes || sessionData?.audit_type}</strong>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => handleRecalculate(false)}
              disabled={isRecalculating || loading}
              className="btn"
              style={{
                backgroundColor: 'rgba(255,255,255,0.12)', color: 'white', border: '1px solid rgba(255,255,255,0.2)',
                padding: '0.45rem 0.9rem', fontSize: '0.78rem', fontWeight: '850', borderRadius: '10px',
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer'
              }}
              title="Recalcular conciliación y validar códigos contra base de datos"
            >
              <RefreshCw size={15} className={isRecalculating ? 'animate-spin' : ''} />
              {isRecalculating ? 'Validando...' : 'Recalcular / Validar'}
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem 2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1 }}>
          
          {/* Executive KPI Metric Cards */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem'
          }}>
            <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '14px', border: '1.5px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Package size={13} /> Esperado en Bodega
              </span>
              <p style={{ margin: '0.3rem 0 0 0', fontSize: '1.35rem', fontWeight: '950', color: '#0f172a' }}>
                {(sessionData?.total_expected_qty || items.filter(i => i.status !== 'Sobrante').length).toLocaleString('es-CO')} <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700' }}>uds</span>
              </p>
            </div>

            <div style={{ backgroundColor: '#ecfdf5', padding: '1rem', borderRadius: '14px', border: '1.5px solid #a7f3d0' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: '800', color: '#047857', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <CheckCircle2 size={13} /> 🟢 Conciliados (OK)
              </span>
              <p style={{ margin: '0.3rem 0 0 0', fontSize: '1.35rem', fontWeight: '950', color: '#065f46' }}>
                {conciliadosList.length.toLocaleString('es-CO')} <span style={{ fontSize: '0.75rem', color: '#047857', fontWeight: '700' }}>uds</span>
              </p>
            </div>

            <div style={{ backgroundColor: '#fef2f2', padding: '1rem', borderRadius: '14px', border: '1.5px solid #fecaca' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: '800', color: '#b91c1c', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <AlertCircle size={13} /> 🔴 Faltantes
              </span>
              <p style={{ margin: '0.3rem 0 0 0', fontSize: '1.35rem', fontWeight: '950', color: '#991b1b' }}>
                -{faltantesList.length.toLocaleString('es-CO')} <span style={{ fontSize: '0.75rem', color: '#b91c1c', fontWeight: '700' }}>uds</span>
              </p>
            </div>

            <div style={{ backgroundColor: '#f0f9ff', padding: '1rem', borderRadius: '14px', border: '1.5px solid #bae6fd' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: '800', color: '#0369a1', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Sparkles size={13} /> 🔵 Sobrantes / De Más
              </span>
              <p style={{ margin: '0.3rem 0 0 0', fontSize: '1.35rem', fontWeight: '950', color: '#0c4a6e' }}>
                +{sobrantesList.length.toLocaleString('es-CO')} <span style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: '700' }}>uds</span>
              </p>
            </div>

            <div style={{ backgroundColor: '#faf5ff', padding: '1rem', borderRadius: '14px', border: '1.5px solid #e9d5ff' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: '800', color: '#7e22ce', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <DollarSign size={13} /> Impacto Financiero
              </span>
              <p style={{ margin: '0.3rem 0 0 0', fontSize: '1.2rem', fontWeight: '950', color: Number(sessionData?.financial_impact || 0) < 0 ? '#dc2626' : '#10b981' }}>
                ${Number(sessionData?.financial_impact || 0).toLocaleString('es-CO')}
              </p>
            </div>
          </div>

          {/* Interactive Navigation Tabs & Search Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem', backgroundColor: '#f1f5f9', padding: '0.3rem', borderRadius: '12px' }}>
              <button
                onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
                style={{
                  padding: '0.45rem 0.9rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '900', border: 'none', cursor: 'pointer',
                  backgroundColor: activeTab === 'all' ? 'white' : 'transparent',
                  color: activeTab === 'all' ? '#0f172a' : '#64748b',
                  boxShadow: activeTab === 'all' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                Todos ({items.length})
              </button>
              <button
                onClick={() => { setActiveTab('conciliados'); setCurrentPage(1); }}
                style={{
                  padding: '0.45rem 0.9rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '900', border: 'none', cursor: 'pointer',
                  backgroundColor: activeTab === 'conciliados' ? '#059669' : 'transparent',
                  color: activeTab === 'conciliados' ? 'white' : '#047857',
                  boxShadow: activeTab === 'conciliados' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                🟢 Conciliados ({conciliadosList.length})
              </button>
              <button
                onClick={() => { setActiveTab('faltantes'); setCurrentPage(1); }}
                style={{
                  padding: '0.45rem 0.9rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '900', border: 'none', cursor: 'pointer',
                  backgroundColor: activeTab === 'faltantes' ? '#dc2626' : 'transparent',
                  color: activeTab === 'faltantes' ? 'white' : '#b91c1c',
                  boxShadow: activeTab === 'faltantes' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                🔴 Faltantes ({faltantesList.length})
              </button>
              <button
                onClick={() => { setActiveTab('sobrantes'); setCurrentPage(1); }}
                style={{
                  padding: '0.45rem 0.9rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '900', border: 'none', cursor: 'pointer',
                  backgroundColor: activeTab === 'sobrantes' ? '#0284c7' : 'transparent',
                  color: activeTab === 'sobrantes' ? 'white' : '#0369a1',
                  boxShadow: activeTab === 'sobrantes' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                🔵 Sobrantes ({sobrantesList.length})
              </button>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Buscar código, color, talla..."
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                style={{
                  width: '100%', padding: '0.45rem 0.75rem 0.45rem 2.25rem', borderRadius: '10px',
                  border: '1.5px solid #cbd5e1', fontSize: '0.8rem', backgroundColor: 'white'
                }}
              />
            </div>
          </div>

          {/* Items Table */}
          <div style={{ border: '1.5px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', backgroundColor: 'white' }}>
            <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                <thead style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', fontWeight: '850', color: '#475569', position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr>
                    <th style={{ padding: '0.75rem 1rem' }}>Código / Barcode</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Prenda / Referencia</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Color</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Talla</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Esperado</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Contado</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Diferencia</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Estado</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Observación / Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                        <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem auto', display: 'block', color: 'var(--primary)' }} />
                        Cargando inventario de auditoría...
                      </td>
                    </tr>
                  ) : paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b', fontWeight: '700' }}>
                        No se encontraron registros en esta vista.
                      </td>
                    </tr>
                  ) : (
                    paginatedItems.map(item => {
                      const diff = (item.counted_qty || 0) - (item.expected_qty || 0);
                      const isConciliado = item.status === 'Conciliado' || diff === 0;
                      const isMissing = item.status === 'Faltante' || diff < 0;
                      const isSurplus = item.status === 'Sobrante' || diff > 0;

                      return (
                        <tr
                          key={item.id}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            backgroundColor: isConciliado ? '#f0fdf4' : isMissing ? '#fff5f5' : '#f0f9ff'
                          }}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td style={{ padding: '0.65rem 1rem', fontWeight: '900', fontFamily: 'monospace', color: '#0f172a' }}>
                            {item.barcode || item.sku_code}
                          </td>
                          <td style={{ padding: '0.65rem 1rem', fontWeight: '800', color: '#1e293b' }}>
                            {item.product_name || 'Prenda Indiv.'}
                          </td>
                          <td style={{ padding: '0.65rem 1rem', color: '#475569', fontWeight: '700' }}>
                            {item.color_name || '—'}
                          </td>
                          <td style={{ padding: '0.65rem 1rem', color: '#475569', fontWeight: '700' }}>
                            {item.size_code || '—'}
                          </td>
                          <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: '800', color: '#64748b' }}>
                            {item.expected_qty}
                          </td>
                          <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: '950', color: '#0f172a' }}>
                            {item.counted_qty}
                          </td>
                          <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: '950', color: isConciliado ? '#059669' : isMissing ? '#dc2626' : '#0284c7' }}>
                            {diff > 0 ? `+${diff}` : diff}
                          </td>
                          <td style={{ padding: '0.65rem 1rem', textAlign: 'center' }}>
                            <span style={{
                              padding: '0.2rem 0.55rem', borderRadius: '12px', fontSize: '0.7rem', fontWeight: '900',
                              backgroundColor: isConciliado ? '#dcfce7' : isMissing ? '#fee2e2' : '#e0f2fe',
                              color: isConciliado ? '#166534' : isMissing ? '#991b1b' : '#075985'
                            }}>
                              {item.status || (isConciliado ? 'Conciliado' : isMissing ? 'Faltante' : 'Sobrante')}
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 1rem', textAlign: 'center' }}>
                            {item.justification ? (
                              <span style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic' }} title={item.justification}>
                                {item.justification.length > 25 ? item.justification.slice(0, 25) + '...' : item.justification}
                              </span>
                            ) : isConciliado ? (
                              <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: '800' }}>✅ Coincide</span>
                            ) : (
                              <button
                                onClick={() => {
                                  setSelectedJustifyItem(item);
                                  setJustificationText(item.justification || '');
                                }}
                                className="btn btn-secondary"
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', fontWeight: '800', borderRadius: '6px' }}
                              >
                                Justificar
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{
                padding: '0.75rem 1.25rem', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem'
              }}>
                <span style={{ color: '#64748b', fontWeight: '700' }}>
                  Mostrando {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, filteredItems.length)} de {filteredItems.length} registros
                </span>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    style={{
                      padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1',
                      backgroundColor: currentPage === 1 ? '#f1f5f9' : 'white', cursor: currentPage === 1 ? 'default' : 'pointer'
                    }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span style={{ fontWeight: '800', color: '#0f172a' }}>Página {currentPage} de {totalPages}</span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    style={{
                      padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1',
                      backgroundColor: currentPage === totalPages ? '#f1f5f9' : 'white', cursor: currentPage === totalPages ? 'default' : 'pointer'
                    }}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Form Justify Single Item */}
          {selectedJustifyItem && (
            <div style={{ backgroundColor: '#eff6ff', padding: '1.25rem', borderRadius: '16px', border: '1.5px solid #bfdbfe', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '900', color: '#1e40af' }}>
                  Justificar Diferencia: {selectedJustifyItem.product_name} ({selectedJustifyItem.barcode})
                </span>
                <button onClick={() => setSelectedJustifyItem(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>

              <input
                type="text"
                placeholder="Ingresa la causa (ej. Merma en tintorería, muestra física entregada, traslado sin registrar)..."
                value={justificationText}
                onChange={e => setJustificationText(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1.5px solid #93c5fd', fontSize: '0.82rem' }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button onClick={() => setSelectedJustifyItem(null)} className="btn btn-secondary" style={{ padding: '0.45rem 0.9rem', fontSize: '0.78rem' }}>
                  Cancelar
                </button>
                <button onClick={handleJustifyItem} disabled={isSubmitting} className="btn btn-primary" style={{ padding: '0.45rem 1.1rem', fontSize: '0.78rem' }}>
                  Guardar Justificación
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '1.15rem 2rem', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '0.6rem 1.35rem', fontWeight: '800', borderRadius: '12px' }}>
            Cerrar
          </button>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {sessionData?.status !== 'Ajustado' && (
              <button
                onClick={handleRequestAdjustment}
                disabled={isSubmitting || isRecalculating}
                className="btn btn-secondary"
                style={{
                  padding: '0.65rem 1.25rem', fontWeight: '850', borderRadius: '12px',
                  backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a'
                }}
              >
                <Send size={16} style={{ marginRight: '0.4rem' }} /> Solicitar Aprobación
              </button>
            )}

            {sessionData?.status !== 'Ajustado' && (
              <button
                onClick={handleApproveAdjustment}
                disabled={isSubmitting || isRecalculating}
                className="btn btn-primary"
                style={{
                  padding: '0.65rem 1.75rem', fontWeight: '950', borderRadius: '12px',
                  backgroundColor: '#059669', boxShadow: '0 4px 12px rgba(5, 150, 105, 0.35)'
                }}
              >
                <CheckCircle2 size={17} style={{ marginRight: '0.4rem' }} /> Aprobar y Aplicar Ajuste Real en Inventario
              </button>
            )}

            {sessionData?.status === 'Ajustado' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#059669', fontWeight: '900', fontSize: '0.85rem' }}>
                <CheckCircle2 size={20} /> Esta auditoría ya fue aprobada y aplicada al inventario real.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
