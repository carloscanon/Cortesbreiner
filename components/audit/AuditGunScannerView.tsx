import React, { useState, useEffect, useRef } from 'react';
import {
  Barcode, CheckCircle2, AlertTriangle, ArrowLeft, Volume2, VolumeX,
  Plus, Minus, RefreshCw, Layers, Package, HelpCircle, Send, Play, Check, AlertCircle, Eye
} from 'lucide-react';

interface AuditGunScannerViewProps {
  session: any;
  userEmail: string;
  onBack: () => void;
  onRefreshData: () => void;
}

export default function AuditGunScannerView({
  session,
  userEmail,
  onBack,
  onRefreshData
}: AuditGunScannerViewProps) {
  const [scanInput, setScanInput] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScannedItem, setLastScannedItem] = useState<any>(null);
  const [unregisteredModalData, setUnregisteredModalData] = useState<any>(null);
  const [sessionDetails, setSessionDetails] = useState<any>(session);
  const [items, setItems] = useState<any[]>([]);
  const [unregisteredList, setUnregisteredList] = useState<any[]>([]);
  const [activeTabFilter, setActiveTabFilter] = useState<'all' | 'differences' | 'unregistered'>('all');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const scanLockRef = useRef(false);

  // Focus keeper function
  const keepFocus = () => {
    if (inputRef.current && !unregisteredModalData) {
      inputRef.current.focus();
    }
  };

  // Permanent Focus strategy for Gun Scanner:
  // 1. Focus on mount and modal state change
  // 2. Global window click listener to re-focus when clicking anywhere outside
  // 3. Heartbeat interval to reclaim focus every 500ms
  useEffect(() => {
    keepFocus();

    const handleClick = (e: MouseEvent) => {
      // Don't reclaim focus if user clicked inside modal or interactive controls
      const target = e.target as HTMLElement;
      if (target && (target.closest('button') || target.closest('a') || target.closest('input') || target.closest('.card'))) {
        // If clicking input itself or modal, let normal behavior occur
        if (target.tagName === 'INPUT' || unregisteredModalData) return;
      }
      keepFocus();
    };

    window.addEventListener('click', handleClick);
    const intervalId = setInterval(keepFocus, 500);

    return () => {
      window.removeEventListener('click', handleClick);
      clearInterval(intervalId);
    };
  }, [unregisteredModalData]);

  // Load session data from DB API
  const fetchSessionDetails = async () => {
    try {
      const res = await fetch(`/api/inventory/audit/sessions?sessionId=${session.id}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setSessionDetails(data.session);
        setItems(data.items || []);
        setUnregisteredList(data.unregistered || []);
      }
    } catch (err) {
      console.error('Error fetching session:', err);
    }
  };

  useEffect(() => {
    fetchSessionDetails();
  }, [session.id]);

  // Play audio feedback
  const playAudioFeedback = (type: 'success' | 'warning' | 'error') => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 tone
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === 'warning') {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch (e) {
      // Audio fallback
    }
  };

  // High-Speed Scan Handler with Debounce / Lock
  const handleScanSubmit = async (e?: React.FormEvent, overrideCode?: string, mode: 'increment' | 'decrement' | 'set' = 'increment', qty: number = 1) => {
    if (e) e.preventDefault();
    const codeToScan = (overrideCode || scanInput).trim();
    if (!codeToScan || isScanning || scanLockRef.current) return;

    scanLockRef.current = true;
    setIsScanning(true);
    setScanInput('');

    try {
      const res = await fetch('/api/inventory/audit/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auditId: session.id,
          code: codeToScan,
          incrementQty: qty,
          mode: mode,
          userEmail: userEmail || 'Pistola Lectora',
          deviceInfo: 'Pistola Lectora USB/Bluetooth'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error en el escaneo.');

      if (data.isUnregistered) {
        playAudioFeedback('warning');
        setUnregisteredModalData({
          code: codeToScan,
          message: data.message
        });
        setStatusMessage({ text: `⚠️ Producto No Registrado: ${codeToScan}`, type: 'warning' });
      } else {
        playAudioFeedback('success');
        setLastScannedItem(data.item);
        const countInfo = data.wasAlreadyCounted
          ? `ℹ️ Prenda (ID ${codeToScan}) ya estaba registrada (1/1)`
          : `✅ Escaneado: ${data.item.product_name} (${data.item.counted_qty} contados)`;
        setStatusMessage({
          text: countInfo,
          type: data.wasAlreadyCounted ? 'warning' : 'success'
        });
      }

      await fetchSessionDetails();
      onRefreshData();
    } catch (err: any) {
      playAudioFeedback('error');
      setStatusMessage({ text: '❌ Error: ' + err.message, type: 'error' });
    } finally {
      setIsScanning(false);
      scanLockRef.current = false;
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 50);
    }
  };

  // Metrics
  const totalExpected = sessionDetails?.total_expected_qty || 0;
  const totalCounted = sessionDetails?.total_counted_qty || 0;
  const totalMissing = sessionDetails?.total_missing_qty || 0;
  const totalSurplus = sessionDetails?.total_surplus_qty || 0;
  const financialImpact = Number(sessionDetails?.financial_impact || 0);
  const progressPct = totalExpected > 0 ? Math.min(100, Math.round((totalCounted / totalExpected) * 100)) : 100;

  const filteredItems = items.filter(item => {
    if (activeTabFilter === 'differences') return item.difference_qty !== 0;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Top Session Header & Barcode Scanner Form */}
      <div className="card" style={{
        padding: '1.5rem', borderRadius: '18px', backgroundColor: '#0f172a', color: 'white',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: '1.25rem'
      }}>
        {/* Navigation & Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={onBack}
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.5rem', borderRadius: '10px', cursor: 'pointer' }}
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <span style={{ fontSize: '0.7rem', fontWeight: '900', color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                MODO PISTOLA LECTORA / CONTEO EN VIVO
              </span>
              <h2 style={{ fontSize: '1.35rem', fontWeight: '950', margin: 0 }}>
                AUDITORÍA #{sessionDetails?.consecutive} — {sessionDetails?.location_name}
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              style={{
                backgroundColor: soundEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: soundEnabled ? '#34d399' : '#f87171',
                border: 'none', padding: '0.5rem 0.85rem', borderRadius: '10px', cursor: 'pointer',
                fontWeight: '800', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.4rem'
              }}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              {soundEnabled ? 'Sonido Activo' : 'Silenciado'}
            </button>
          </div>
        </div>

        {/* High Speed Scanner Input Area */}
        <form onSubmit={e => handleScanSubmit(e)} style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Barcode size={24} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#818cf8' }} />
            <input
              ref={inputRef}
              type="text"
              placeholder="🔍 ESCANEAR CÓDIGO DE BARRAS / SKU (Pistola Lectora USB/Bluetooth)..."
              value={scanInput}
              onChange={e => setScanInput(e.target.value)}
              disabled={isScanning}
              autoFocus
              style={{
                width: '100%', padding: '0.9rem 1rem 0.9rem 3.2rem', borderRadius: '12px',
                border: '2px solid #6366f1', backgroundColor: '#1e293b', color: 'white',
                fontSize: '1rem', fontWeight: '900', letterSpacing: '0.04em'
              }}
            />
          </div>
          <button
            type="submit"
            disabled={isScanning || !scanInput.trim()}
            className="btn btn-primary"
            style={{ padding: '0.9rem 1.75rem', fontWeight: '950', fontSize: '0.95rem', borderRadius: '12px', backgroundColor: '#6366f1' }}
          >
            {isScanning ? 'PROCESANDO...' : 'REGISTRAR'}
          </button>
        </form>

        {/* Status Message Notification Bar */}
        {statusMessage && (
          <div style={{
            padding: '0.65rem 1rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '850',
            backgroundColor: statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : statusMessage.type === 'warning' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            color: statusMessage.type === 'success' ? '#34d399' : statusMessage.type === 'warning' ? '#fbbf24' : '#f87171',
            border: `1px solid ${statusMessage.type === 'success' ? '#059669' : statusMessage.type === 'warning' ? '#d97706' : '#dc2626'}`
          }}>
            {statusMessage.text}
          </div>
        )}

        {/* Live Progress Bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', marginBottom: '0.35rem' }}>
            <span>PROGRESO DEL CONTEO FÍSICO</span>
            <span>{totalCounted} contados / {totalExpected} esperados ({progressPct}%)</span>
          </div>
          <div style={{ width: '100%', height: '10px', backgroundColor: '#334155', borderRadius: '5px', overflow: 'hidden' }}>
            <div style={{ width: `${progressPct}%`, height: '100%', backgroundColor: '#10b981', transition: 'width 0.3s ease' }} />
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem' }}>
        <div className="card" style={{ padding: '1.25rem', border: '1px solid #e2e8f0', borderRadius: '14px', backgroundColor: 'white' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>PRODUCTOS ESPERADOS</span>
          <h3 style={{ fontSize: '1.4rem', fontWeight: '950', margin: '0.2rem 0', color: '#0f172a' }}>{totalExpected.toLocaleString()} uds</h3>
        </div>

        <div className="card" style={{ padding: '1.25rem', border: '1px solid #e2e8f0', borderRadius: '14px', backgroundColor: 'white' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: '900', color: '#10b981', textTransform: 'uppercase' }}>PRODUCTOS CONTADOS</span>
          <h3 style={{ fontSize: '1.4rem', fontWeight: '950', margin: '0.2rem 0', color: '#059669' }}>{totalCounted.toLocaleString()} uds</h3>
        </div>

        <div className="card" style={{ padding: '1.25rem', border: '1px solid #fca5a5', borderRadius: '14px', backgroundColor: '#fef2f2' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: '900', color: '#dc2626', textTransform: 'uppercase' }}>FALTANTES FÍSICOS</span>
          <h3 style={{ fontSize: '1.4rem', fontWeight: '950', margin: '0.2rem 0', color: '#b91c1c' }}>-{totalMissing.toLocaleString()} uds</h3>
        </div>

        <div className="card" style={{ padding: '1.25rem', border: '1px solid #bae6fd', borderRadius: '14px', backgroundColor: '#f0f9ff' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: '900', color: '#0284c7', textTransform: 'uppercase' }}>SOBRANTES FÍSICOS</span>
          <h3 style={{ fontSize: '1.4rem', fontWeight: '950', margin: '0.2rem 0', color: '#0369a1' }}>+{totalSurplus.toLocaleString()} uds</h3>
        </div>

        <div className="card" style={{ padding: '1.25rem', border: '1px solid #cbd5e1', borderRadius: '14px', backgroundColor: 'white' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>IMPACTO ECONÓMICO ($)</span>
          <h3 style={{ fontSize: '1.3rem', fontWeight: '950', margin: '0.2rem 0', color: financialImpact < 0 ? '#ef4444' : '#10b981' }}>
            ${financialImpact.toLocaleString('es-CO')}
          </h3>
        </div>
      </div>

      {/* Scanned Items List & Filters */}
      <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', backgroundColor: 'white', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Table Header Filter Tabs */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[
              { id: 'all', label: `Todos los Productos (${items.length})` },
              { id: 'differences', label: `Solo Diferencias (${items.filter(i => i.difference_qty !== 0).length})` },
              { id: 'unregistered', label: `No Registrados (${unregisteredList.length})` }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTabFilter(tab.id as any)}
                style={{
                  padding: '0.45rem 0.85rem', fontSize: '0.78rem', fontWeight: '850', borderRadius: '8px',
                  border: activeTabFilter === tab.id ? '2px solid var(--primary)' : '1px solid #cbd5e1',
                  backgroundColor: activeTabFilter === tab.id ? '#fdf2f4' : 'white',
                  color: activeTabFilter === tab.id ? 'var(--primary)' : '#475569',
                  cursor: 'pointer'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button onClick={fetchSessionDetails} className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', fontWeight: '800' }}>
            <RefreshCw size={14} style={{ marginRight: '0.3rem' }} /> Actualizar Tabla
          </button>
        </div>

        {/* Dynamic Table */}
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
            <thead style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', fontWeight: '800', color: '#475569' }}>
              <tr>
                <th style={{ padding: '0.75rem 1rem' }}>SKU / Código</th>
                <th style={{ padding: '0.75rem 1rem' }}>Producto</th>
                <th style={{ padding: '0.75rem 1rem' }}>Color / Talla</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Esperado</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Contado Físico</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Diferencia</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Valor ($)</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Acción Rápida</th>
              </tr>
            </thead>
            <tbody>
              {activeTabFilter === 'unregistered' ? (
                unregisteredList.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                      No se han reportado productos no registrados.
                    </td>
                  </tr>
                ) : (
                  unregisteredList.map((unreg, idx) => (
                    <tr key={unreg.id || idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#fffbeb' }}>
                      <td style={{ padding: '0.65rem 1rem', fontWeight: '800', color: '#d97706' }}>{unreg.scanned_code}</td>
                      <td style={{ padding: '0.65rem 1rem', fontWeight: '800', color: '#92400e' }}>⚠️ Producto Físico No Registrado en Sistema</td>
                      <td style={{ padding: '0.65rem 1rem' }}>—</td>
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>0</td>
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: '900', color: '#d97706' }}>{unreg.quantity}</td>
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: '900', color: '#d97706' }}>+{unreg.quantity}</td>
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>$0</td>
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'center' }}>
                        <span style={{ backgroundColor: '#fef3c7', color: '#b45309', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '800' }}>
                          {unreg.action_taken}
                        </span>
                      </td>
                    </tr>
                  ))
                )
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                    No hay productos en esta vista.
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const diff = item.difference_qty || (item.counted_qty - item.expected_qty);
                  const isMissing = diff < 0;
                  const isSurplus = diff > 0;

                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: isMissing ? '#fef2f2' : isSurplus ? '#f0f9ff' : 'white' }}>
                      <td style={{ padding: '0.65rem 1rem', fontWeight: '800', color: 'var(--primary)' }}>{item.sku_code}</td>
                      <td style={{ padding: '0.65rem 1rem', fontWeight: '800', color: '#0f172a' }}>{item.product_name}</td>
                      <td style={{ padding: '0.65rem 1rem', color: '#475569' }}>{item.color_name} | {item.size_code}</td>
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: '800', color: '#64748b' }}>{item.expected_qty}</td>
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: '950', fontSize: '0.95rem', color: '#0f172a' }}>{item.counted_qty}</td>
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: '950', color: isMissing ? '#dc2626' : isSurplus ? '#0284c7' : '#059669' }}>
                        {diff > 0 ? `+${diff}` : diff}
                      </td>
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: '800', color: isMissing ? '#dc2626' : '#64748b' }}>
                        ${Number(item.difference_cost || 0).toLocaleString('es-CO')}
                      </td>
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleScanSubmit(undefined, item.sku_code, 'increment', 1)}
                            style={{ padding: '0.25rem 0.5rem', backgroundColor: '#e0e7ff', color: '#4338ca', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '900' }}
                          >
                            +1
                          </button>
                          <button
                            onClick={() => handleScanSubmit(undefined, item.sku_code, 'decrement', 1)}
                            style={{ padding: '0.25rem 0.5rem', backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '900' }}
                          >
                            -1
                          </button>
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

      {/* UNREGISTERED PRODUCT MODAL ⚠️ */}
      {unregisteredModalData && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1200, padding: '1.5rem'
        }}>
          <div className="card" style={{
            width: '100%', maxWidth: '550px', backgroundColor: 'white', borderRadius: '20px',
            overflow: 'hidden', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#d97706' }}>
              <AlertTriangle size={32} />
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '950', color: '#0f172a' }}>
                  ⚠️ PRODUCTO NO REGISTRADO
                </h3>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  El código <strong>{unregisteredModalData.code}</strong> fue encontrado físicamente pero no está en el catálogo.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {[
                { action: 'REGISTRADO_SOBRANTE', title: '1. Registrar como Sobrante Físico', desc: 'Acumular cantidad encontrada manteniendo trazabilidad' },
                { action: 'CREADO', title: '2. Crear Producto Nuevo', desc: 'Abrir formulario rápido para registrar en catálogo' },
                { action: 'ASOCIADO', title: '3. Asociar a Producto Existente', desc: 'Vincular este código de barras a una referencia existente' },
                { action: 'INCIDENCIA', title: '4. Reportar Incidencia de Seguridad', desc: 'Notificar al supervisor sobre hallazgo anómalo' }
              ].map(opt => (
                <button
                  key={opt.action}
                  onClick={() => setUnregisteredModalData(null)}
                  style={{
                    padding: '0.85rem 1rem', textAlign: 'left', borderRadius: '12px',
                    border: '1.5px solid #cbd5e1', backgroundColor: '#f8fafc', cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ fontSize: '0.88rem', fontWeight: '900', color: '#0f172a' }}>{opt.title}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>{opt.desc}</div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setUnregisteredModalData(null)}
              className="btn btn-secondary"
              style={{ padding: '0.65rem', fontWeight: '800', justifyContent: 'center' }}
            >
              Continuar Escaneando
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
