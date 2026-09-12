import React, { useState, useEffect } from 'react';
import {
  X, CheckCircle2, AlertTriangle, Send, DollarSign, FileText, Check, ShieldCheck, RefreshCw, AlertCircle
} from 'lucide-react';

interface AuditReconciliationModalProps {
  session: any;
  userEmail: string;
  onClose: () => void;
  onRefreshData: () => void;
}

export default function AuditReconciliationModal({
  session,
  userEmail,
  onClose,
  onRefreshData
}: AuditReconciliationModalProps) {
  const [sessionData, setSessionData] = useState<any>(session);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJustifyItem, setSelectedJustifyItem] = useState<any>(null);
  const [justificationText, setJustificationText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [adjustmentReason, setAdjustmentReason] = useState('Diferencias validadas en auditoría física');

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

  // Approve adjustment handler (Admin / Supervisor)
  const handleApproveAdjustment = async () => {
    if (!confirm('¿Confirmas APROBAR el ajuste de inventario? Se actualizará el inventario real en base de datos de forma inmutable.')) return;

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

      alert(data.message || '✅ Ajuste aprobado y aplicado en base de datos.');
      onClose();
      onRefreshData();
    } catch (err: any) {
      alert('❌ Error: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const differencesList = items.filter(i => (i.counted_qty - i.expected_qty) !== 0);

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 1100, padding: '1.5rem'
    }}>
      <div className="card" style={{
        width: '100%', maxWidth: '900px', maxHeight: '90vh',
        backgroundColor: 'white', borderRadius: '20px', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
        border: '1px solid #cbd5e1'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.75rem', background: 'linear-gradient(135deg, #0f172a, #1e293b)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.5rem', backgroundColor: 'rgba(99, 102, 241, 0.2)', borderRadius: '10px', color: '#818cf8' }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '950' }}>
                Conciliación y Ajustes — Auditoría #{sessionData?.consecutive}
              </h3>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                Ubicación: {sessionData?.location_name} | Estado: <strong>{sessionData?.status}</strong>
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Executive Metrics Header Card */}
          <div style={{
            backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '14px',
            border: '1.5px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem'
          }}>
            <div>
              <span style={{ fontSize: '0.68rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Diferencias Encontradas</span>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.2rem', fontWeight: '950', color: '#0f172a' }}>{differencesList.length} ítems</p>
            </div>
            <div>
              <span style={{ fontSize: '0.68rem', fontWeight: '800', color: '#dc2626', textTransform: 'uppercase' }}>Faltantes Totales</span>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.2rem', fontWeight: '950', color: '#b91c1c' }}>-{sessionData?.total_missing_qty || 0} uds</p>
            </div>
            <div>
              <span style={{ fontSize: '0.68rem', fontWeight: '800', color: '#0284c7', textTransform: 'uppercase' }}>Sobrantes Totales</span>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.2rem', fontWeight: '950', color: '#0369a1' }}>+{sessionData?.total_surplus_qty || 0} uds</p>
            </div>
            <div>
              <span style={{ fontSize: '0.68rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Impacto Financiero</span>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.2rem', fontWeight: '950', color: Number(sessionData?.financial_impact || 0) < 0 ? '#ef4444' : '#10b981' }}>
                ${Number(sessionData?.financial_impact || 0).toLocaleString('es-CO')}
              </p>
            </div>
          </div>

          {/* Differences Table */}
          <div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: '900', color: '#0f172a', margin: '0 0 0.75rem 0' }}>
              Detalle de Diferencias a Conciliar ({differencesList.length})
            </h4>

            <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', fontWeight: '800', color: '#475569', position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={{ padding: '0.65rem 0.85rem' }}>SKU</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Producto</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Esperado</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Contado</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Diferencia</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Impacto ($)</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Estado</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {differencesList.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#059669', fontWeight: '800' }}>
                        🎉 ¡Excelente! No existen diferencias en esta auditoría. El inventario físico coincide 100% con el sistema.
                      </td>
                    </tr>
                  ) : (
                    differencesList.map(item => {
                      const diff = (item.counted_qty - item.expected_qty);
                      const isMissing = diff < 0;

                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: isMissing ? '#fef2f2' : '#f0f9ff' }}>
                          <td style={{ padding: '0.65rem 0.85rem', fontWeight: '800', color: 'var(--primary)' }}>{item.sku_code}</td>
                          <td style={{ padding: '0.65rem 0.85rem', fontWeight: '800', color: '#0f172a' }}>{item.product_name}</td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: '800', color: '#64748b' }}>{item.expected_qty}</td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: '950', color: '#0f172a' }}>{item.counted_qty}</td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: '950', color: isMissing ? '#dc2626' : '#0284c7' }}>
                            {diff > 0 ? `+${diff}` : diff}
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: '800', color: isMissing ? '#dc2626' : '#059669' }}>
                            ${Number(item.difference_cost || 0).toLocaleString('es-CO')}
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                            <span style={{ backgroundColor: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '800' }}>
                              {item.item_state || 'Detectada'}
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                            <button
                              onClick={() => {
                                setSelectedJustifyItem(item);
                                setJustificationText(item.justification || '');
                              }}
                              className="btn btn-secondary"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', fontWeight: '800' }}
                            >
                              Justificar
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Form Justify Single Item */}
          {selectedJustifyItem && (
            <div style={{ backgroundColor: '#eff6ff', padding: '1rem', borderRadius: '12px', border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '900', color: '#1e40af' }}>
                  Justificar Diferencia para: {selectedJustifyItem.product_name} ({selectedJustifyItem.sku_code})
                </span>
                <button onClick={() => setSelectedJustifyItem(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                  <X size={16} />
                </button>
              </div>

              <input
                type="text"
                placeholder="Ingresa la causa (ej. Merma en lavado, muestra a cliente, faltante físico)..."
                value={justificationText}
                onChange={e => setJustificationText(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1.5px solid #93c5fd', fontSize: '0.8rem' }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button onClick={() => setSelectedJustifyItem(null)} className="btn btn-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.75rem' }}>
                  Cancelar
                </button>
                <button onClick={handleJustifyItem} disabled={isSubmitting} className="btn btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.75rem' }}>
                  Guardar Justificación
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div style={{ padding: '1rem 1.75rem', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '0.55rem 1.25rem', fontWeight: '800', borderRadius: '10px' }}>
            Cerrar
          </button>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {sessionData?.status !== 'Ajustado' && (
              <button
                onClick={handleRequestAdjustment}
                disabled={isSubmitting}
                className="btn btn-secondary"
                style={{ padding: '0.65rem 1.25rem', fontWeight: '800', borderRadius: '10px', backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}
              >
                <Send size={16} style={{ marginRight: '0.35rem' }} /> solicitar Ajuste de Inventario
              </button>
            )}

            {sessionData?.status !== 'Ajustado' && (
              <button
                onClick={handleApproveAdjustment}
                disabled={isSubmitting}
                className="btn btn-primary"
                style={{ padding: '0.65rem 1.5rem', fontWeight: '950', borderRadius: '10px', backgroundColor: '#059669' }}
              >
                <CheckCircle2 size={16} style={{ marginRight: '0.35rem' }} /> Aprobar y Aplicar Ajuste Real
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
