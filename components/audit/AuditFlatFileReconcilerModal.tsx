import React, { useState, useMemo, useRef } from 'react';
import {
  X, UploadCloud, FileText, CheckCircle2, AlertTriangle, ArrowRight,
  RefreshCw, Search, ShieldCheck, Database, Layers, Download, Check, AlertCircle, FileSpreadsheet
} from 'lucide-react';

interface AuditFlatFileReconcilerModalProps {
  warehouses: any[];
  userEmail: string;
  onClose: () => void;
  onSuccess: (session: any) => void;
}

type TabType = 'all' | 'conciliados' | 'faltantes' | 'sobrantes' | 'no_registrados';

export default function AuditFlatFileReconcilerModal({
  warehouses,
  userEmail,
  onClose,
  onSuccess
}: AuditFlatFileReconcilerModalProps) {
  const [locationId, setLocationId] = useState('');
  const [scopeMode, setScopeMode] = useState<'auto' | 'full'>('auto');
  const [inputMode, setInputMode] = useState<'file' | 'text'>('file');
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsedBarcodes, setParsedBarcodes] = useState<string[]>([]);

  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  // Table filters & pagination
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 40;

  // Execution state
  const [isApplying, setIsApplying] = useState(false);
  const [appliedSession, setAppliedSession] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse barcodes from raw string (supports commas, newlines, tabs, semicolons, CSV structure)
  const parseBarcodesFromString = (text: string): string[] => {
    if (!text) return [];
    // If it has newlines with potential CSV header
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const codes: string[] = [];

    lines.forEach((line, idx) => {
      // Skip obvious CSV headers
      const lower = line.toLowerCase();
      if (idx === 0 && (lower.includes('codigo') || lower.includes('barcode') || lower.includes('consecutivo') || lower.includes('sku'))) {
        return;
      }

      // Check if line contains commas or semicolons
      if (line.includes(',') || line.includes(';') || line.includes('\t')) {
        const parts = line.split(/[,;\t]/).map(p => p.trim().replace(/^["']|["']$/g, ''));
        parts.forEach(part => {
          // If part looks like a barcode (alphanumeric, len >= 3)
          if (part && !['camera', 'manual', 'consecutivo', 'codigo_barras', 'cantidad'].includes(part.toLowerCase())) {
            // Check if it's not a timestamp like '2026-10-13 14:30:15'
            if (!part.includes(':') && !part.includes('-')) {
              codes.push(part);
            }
          }
        });
      } else {
        const clean = line.replace(/^["']|["']$/g, '').trim();
        if (clean) codes.push(clean);
      }
    });

    // Deduplicate while preserving order and exact strings
    return Array.from(new Set(codes));
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const codes = parseBarcodesFromString(content);
      setParsedBarcodes(codes);
      setRawText(codes.join('\n'));
      setAnalysisResult(null);
    };
    reader.readAsText(file);
  };

  // Handle direct text changes
  const handleTextChange = (text: string) => {
    setRawText(text);
    const codes = parseBarcodesFromString(text);
    setParsedBarcodes(codes);
    setAnalysisResult(null);
  };

  // Analyze and cross flat file with warehouse inventory
  const handleAnalyze = async () => {
    if (!locationId) return alert('Por favor selecciona la bodega a conciliar.');
    if (parsedBarcodes.length === 0) return alert('No se han cargado códigos de barras para analizar.');

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const whObj = warehouses.find(w => w.id === locationId);
      const locationName = whObj?.nombre_bodega || whObj?.name || 'Bodega';

      const res = await fetch('/api/inventory/audit/flat-file-reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType: 'ANALYZE',
          locationId,
          locationName,
          rawBarcodes: parsedBarcodes,
          scopeMode,
          userEmail: userEmail || 'Sistema'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al analizar el plano.');

      setAnalysisResult(data);
      setActiveTab('all');
      setCurrentPage(1);
    } catch (err: any) {
      alert('❌ Error al cruzar con inventario: ' + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Filter items in table
  const allItems = analysisResult?.items || [];

  const filteredItems = useMemo(() => {
    return allItems.filter((item: any) => {
      if (activeTab === 'conciliados' && item.status !== 'Conciliado') return false;
      if (activeTab === 'faltantes' && item.status !== 'Faltante') return false;
      if (activeTab === 'sobrantes' && item.status !== 'Sobrante') return false;
      if (activeTab === 'no_registrados' && item.status !== 'No Registrado') return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const bc = (item.barcode || '').toLowerCase();
        const ref = (item.reference_name || '').toLowerCase();
        const col = (item.color_name || '').toLowerCase();
        const orig = (item.origin || '').toLowerCase();
        return bc.includes(term) || ref.includes(term) || col.includes(term) || orig.includes(term);
      }
      return true;
    });
  }, [allItems, activeTab, searchTerm]);

  // Paginated items
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage]);

  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;

  // Apply Reconciliation & Adjust in DB
  const handleApplyReconciliation = async () => {
    if (!analysisResult) return;
    const whObj = warehouses.find(w => w.id === locationId);
    const locationName = whObj?.nombre_bodega || whObj?.name || 'Bodega';
    const sum = analysisResult.summary;

    const confirmMsg =
      `⚠️ ¿CONFIRMAS APLICAR LA CONCILIACIÓN Y AJUSTE REAL EN BASE DE DATOS?\n\n` +
      `• Bodega: ${locationName}\n` +
      `• Total leídas en plano: ${sum.totalFileBarcodes} prendas\n` +
      `• Conciliadas (Confirmadas): ${sum.conciliadosCount} prendas\n` +
      `• Faltantes (Dadas de baja): ${sum.faltantesCount} prendas\n` +
      `• Sobrantes (Incorporadas): ${sum.sobrantesCount} prendas\n\n` +
      `Esta acción sincronizará el stock disponible, dará de baja las prendas faltantes y registrará los movimientos en Kardex de forma definitiva.`;

    if (!window.confirm(confirmMsg)) return;

    setIsApplying(true);
    try {
      const res = await fetch('/api/inventory/audit/flat-file-reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType: 'APPLY_RECONCILIATION',
          locationId,
          locationName,
          rawBarcodes: parsedBarcodes,
          items: allItems,
          userEmail: userEmail || 'Sistema',
          notes: `Conciliación y ajuste por carga de plano en ${locationName} (${fileName || 'Texto pegado'})`
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al aplicar el ajuste.');

      setAppliedSession(data.session);
      alert(data.message || '✅ Conciliación aplicada con éxito.');
      onSuccess(data.session);
    } catch (err: any) {
      alert('❌ Error al aplicar ajuste: ' + err.message);
    } finally {
      setIsApplying(false);
    }
  };

  // Export report to CSV
  const handleExportCSV = () => {
    if (!analysisResult) return;
    const whObj = warehouses.find(w => w.id === locationId);
    const locationName = whObj?.nombre_bodega || whObj?.name || 'Bodega';

    const headers = ['Consecutivo', 'Codigo_Barras', 'Referencia', 'Color', 'Talla', 'Estado_Cruce', 'Origen_Sistema', 'Costo_Estimado'];
    const rows = allItems.map((item: any, idx: number) => [
      idx + 1,
      `"${item.barcode}"`,
      `"${item.reference_name || ''}"`,
      `"${item.color_name || ''}"`,
      `"${item.size_code || ''}"`,
      `"${item.status || ''}"`,
      `"${item.origin || ''}"`,
      item.cost || 0
    ]);

    const csvContent = [headers.join(','), ...rows.map((r: any[]) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conciliacion_plano_${locationName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 1100, padding: '1rem'
    }}>
      <div style={{
        width: '100%', maxWidth: '1100px', maxHeight: '94vh',
        backgroundColor: 'white', borderRadius: '24px', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
        border: '1px solid #cbd5e1'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.75rem', background: 'linear-gradient(135deg, #0f172a, #1e293b)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ padding: '0.6rem', backgroundColor: 'rgba(99, 102, 241, 0.25)', borderRadius: '14px', color: '#818cf8' }}>
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: '900', color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  AUDITORÍA MASIVA & CONCILIACIÓN
                </span>
                <span style={{ backgroundColor: '#10b981', color: 'white', fontSize: '0.62rem', fontWeight: '900', padding: '0.15rem 0.45rem', borderRadius: '6px' }}>
                  EN TIEMPO REAL
                </span>
              </div>
              <h3 style={{ margin: '0.15rem 0 0 0', fontSize: '1.25rem', fontWeight: '950' }}>
                Conciliar Bodega con Archivo Plano
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.4rem', borderRadius: '8px' }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1 }}>

          {/* Configuration Grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem',
            backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0'
          }}>
            {/* Warehouse Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '900', color: '#1e293b', marginBottom: '0.35rem' }}>
                1. SELECCIONA LA BODEGA A CONCILIAR *
              </label>
              <select
                value={locationId}
                onChange={e => {
                  setLocationId(e.target.value);
                  setAnalysisResult(null);
                }}
                style={{
                  width: '100%', padding: '0.75rem', borderRadius: '12px', border: '2px solid #cbd5e1',
                  fontSize: '0.9rem', fontWeight: '800', color: '#0f172a', backgroundColor: 'white'
                }}
              >
                <option value="">Seleccionar bodega o tienda...</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.nombre_bodega || w.name}</option>
                ))}
              </select>
            </div>

            {/* Scope Mode Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '900', color: '#1e293b', marginBottom: '0.35rem' }}>
                2. ALCANCE DE CONCILIACIÓN
              </label>
              <select
                value={scopeMode}
                onChange={e => {
                  setScopeMode(e.target.value as any);
                  setAnalysisResult(null);
                }}
                style={{
                  width: '100%', padding: '0.75rem', borderRadius: '12px', border: '2px solid #cbd5e1',
                  fontSize: '0.85rem', fontWeight: '750', color: '#0f172a', backgroundColor: 'white'
                }}
              >
                <option value="auto">⭐ Detección Automática por Referencia / Categoría (Recomendado)</option>
                <option value="full">📦 Inventario Completo de la Bodega (Toda la Bodega)</option>
              </select>
              <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                {scopeMode === 'auto'
                  ? 'Compara únicamente contra las prendas de la bodega que coincidan con las referencias del plano.'
                  : 'Compara contra todas las prendas activas en la bodega (cualquier prenda no leída será Faltante).'}
              </span>
            </div>
          </div>

          {/* Input Tabs: File Upload or Direct Paste */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setInputMode('file')}
                style={{
                  padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: '850',
                  border: 'none', cursor: 'pointer',
                  backgroundColor: inputMode === 'file' ? '#6366f1' : '#f1f5f9',
                  color: inputMode === 'file' ? 'white' : '#475569'
                }}
              >
                📁 Subir Archivo Plano (.txt / .csv)
              </button>
              <button
                type="button"
                onClick={() => setInputMode('text')}
                style={{
                  padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: '850',
                  border: 'none', cursor: 'pointer',
                  backgroundColor: inputMode === 'text' ? '#6366f1' : '#f1f5f9',
                  color: inputMode === 'text' ? 'white' : '#475569'
                }}
              >
                📋 Pegar Texto o Códigos Directamente
              </button>
            </div>

            {inputMode === 'file' ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed #818cf8', borderRadius: '16px', padding: '1.75rem',
                  backgroundColor: '#f8faff', textAlign: 'center', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem',
                  transition: 'all 0.2s ease'
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".txt,.csv,.tsv"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <div style={{ padding: '0.75rem', backgroundColor: '#ede9fe', borderRadius: '50%', color: '#6366f1' }}>
                  <UploadCloud size={30} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '900', color: '#1e293b' }}>
                    {fileName ? `Archivo cargado: ${fileName}` : 'Haz clic o arrastra aquí tu archivo plano'}
                  </h4>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                    Compatible con archivos exportados del escáner móvil (.txt separado por comas o saltos de línea, y .csv)
                  </p>
                </div>
                {parsedBarcodes.length > 0 && (
                  <div style={{ marginTop: '0.4rem', padding: '0.35rem 0.85rem', backgroundColor: '#dcfce7', color: '#15803d', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '900' }}>
                    ✅ {parsedBarcodes.length} códigos de barras únicos detectados en el archivo
                  </div>
                )}
              </div>
            ) : (
              <div>
                <textarea
                  value={rawText}
                  onChange={e => handleTextChange(e.target.value)}
                  placeholder="Pega aquí los códigos separados por comas o uno por línea (ej: 0081956826,0081956827,0081995126...)"
                  rows={4}
                  style={{
                    width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1.5px solid #cbd5e1',
                    fontSize: '0.85rem', fontFamily: 'monospace', resize: 'vertical'
                  }}
                />
                {parsedBarcodes.length > 0 && (
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#16a34a', marginTop: '0.25rem', display: 'block' }}>
                    ✅ {parsedBarcodes.length} códigos de barras únicos detectados en el texto
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Action to Cross & Analyze */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || parsedBarcodes.length === 0 || !locationId}
              style={{
                padding: '0.85rem 2rem', borderRadius: '14px', fontSize: '0.95rem', fontWeight: '950',
                backgroundColor: !locationId || parsedBarcodes.length === 0 ? '#94a3b8' : '#4f46e5',
                color: 'white', border: 'none', cursor: !locationId || parsedBarcodes.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
              }}
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw size={18} className="animate-spin" /> Cruzando contra inventario de la bodega...
                </>
              ) : (
                <>
                  <Database size={18} /> Cruzar y Analizar con la Bodega
                </>
              )}
            </button>
          </div>

          {/* STEP 2: ANALYSIS RESULTS DASHBOARD */}
          {analysisResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '0.5rem' }}>
              
              {/* Detected References Banner if in Auto Mode */}
              {analysisResult.summary.detectedReferences?.length > 0 && (
                <div style={{
                  padding: '0.75rem 1rem', backgroundColor: '#eef2ff', borderRadius: '12px',
                  border: '1px solid #c7d2fe', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap'
                }}>
                  <Layers size={18} color="#4f46e5" />
                  <span style={{ fontSize: '0.8rem', fontWeight: '850', color: '#312e81' }}>
                    Referencias detectadas en el plano físico:
                  </span>
                  {analysisResult.summary.detectedReferences.map((dr: any, idx: number) => (
                    <span key={idx} style={{
                      backgroundColor: 'white', padding: '0.2rem 0.5rem', borderRadius: '6px',
                      fontSize: '0.75rem', fontWeight: '900', color: '#4338ca', border: '1px solid #c7d2fe'
                    }}>
                      {dr.name} ({dr.count})
                    </span>
                  ))}
                </div>
              )}

              {/* KPI Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem' }}>
                <div style={{ padding: '0.85rem 1rem', backgroundColor: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>LEÍDAS EN PLANO</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: '950', color: '#0f172a' }}>{analysisResult.summary.totalFileBarcodes}</div>
                  <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Físico archivo</span>
                </div>

                <div style={{ padding: '0.85rem 1rem', backgroundColor: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>ESPERADO BODEGA</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: '950', color: '#0f172a' }}>{analysisResult.summary.totalWarehouseExpected}</div>
                  <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Sistema en BD</span>
                </div>

                <div style={{ padding: '0.85rem 1rem', backgroundColor: '#f0fdf4', borderRadius: '14px', border: '1.5px solid #86efac' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#16a34a', textTransform: 'uppercase' }}>CONCILIADOS (OK)</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: '950', color: '#15803d' }}>{analysisResult.summary.conciliadosCount}</div>
                  <span style={{ fontSize: '0.68rem', color: '#16a34a' }}>Coincidencia exacta</span>
                </div>

                <div style={{ padding: '0.85rem 1rem', backgroundColor: '#fef2f2', borderRadius: '14px', border: '1.5px solid #fca5a5' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#dc2626', textTransform: 'uppercase' }}>FALTANTES EN BODEGA</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: '950', color: '#b91c1c' }}>{analysisResult.summary.faltantesCount}</div>
                  <span style={{ fontSize: '0.68rem', color: '#dc2626' }}>En sistema pero no en plano</span>
                </div>

                <div style={{ padding: '0.85rem 1rem', backgroundColor: '#faf5ff', borderRadius: '14px', border: '1.5px solid #d8b4fe' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#7e22ce', textTransform: 'uppercase' }}>SOBRANTES / OTRA BODEGA</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: '950', color: '#6b21a8' }}>{analysisResult.summary.sobrantesCount}</div>
                  <span style={{ fontSize: '0.68rem', color: '#7e22ce' }}>En plano pero no en bodega</span>
                </div>

                <div style={{ padding: '0.85rem 1rem', backgroundColor: '#eff6ff', borderRadius: '14px', border: '1.5px solid #93c5fd' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#1d4ed8', textTransform: 'uppercase' }}>% CONCILIACIÓN</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: '950', color: '#1e40af' }}>{analysisResult.summary.reconciliationRate}%</div>
                  <span style={{ fontSize: '0.68rem', color: '#1d4ed8' }}>Tasa de efectividad</span>
                </div>
              </div>

              {/* Table Controls (Search & Tabs) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
                    style={{
                      padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '850', border: 'none', cursor: 'pointer',
                      backgroundColor: activeTab === 'all' ? '#0f172a' : '#f1f5f9',
                      color: activeTab === 'all' ? 'white' : '#475569'
                    }}
                  >
                    Todos ({allItems.length})
                  </button>
                  <button
                    onClick={() => { setActiveTab('conciliados'); setCurrentPage(1); }}
                    style={{
                      padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '850', border: 'none', cursor: 'pointer',
                      backgroundColor: activeTab === 'conciliados' ? '#16a34a' : '#f0fdf4',
                      color: activeTab === 'conciliados' ? 'white' : '#15803d'
                    }}
                  >
                    Conciliados OK ({analysisResult.summary.conciliadosCount})
                  </button>
                  <button
                    onClick={() => { setActiveTab('faltantes'); setCurrentPage(1); }}
                    style={{
                      padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '850', border: 'none', cursor: 'pointer',
                      backgroundColor: activeTab === 'faltantes' ? '#dc2626' : '#fef2f2',
                      color: activeTab === 'faltantes' ? 'white' : '#b91c1c'
                    }}
                  >
                    Faltantes ({analysisResult.summary.faltantesCount})
                  </button>
                  <button
                    onClick={() => { setActiveTab('sobrantes'); setCurrentPage(1); }}
                    style={{
                      padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '850', border: 'none', cursor: 'pointer',
                      backgroundColor: activeTab === 'sobrantes' ? '#7e22ce' : '#faf5ff',
                      color: activeTab === 'sobrantes' ? 'white' : '#6b21a8'
                    }}
                  >
                    Sobrantes ({analysisResult.summary.sobrantesCount})
                  </button>
                  {analysisResult.summary.noRegistradosCount > 0 && (
                    <button
                      onClick={() => { setActiveTab('no_registrados'); setCurrentPage(1); }}
                      style={{
                        padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '850', border: 'none', cursor: 'pointer',
                        backgroundColor: activeTab === 'no_registrados' ? '#ea580c' : '#fff7ed',
                        color: activeTab === 'no_registrados' ? 'white' : '#c2410c'
                      }}
                    >
                      No Registrados ({analysisResult.summary.noRegistradosCount})
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Buscar código o referencia..."
                      value={searchTerm}
                      onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                      style={{
                        padding: '0.4rem 0.6rem 0.4rem 2rem', borderRadius: '8px', border: '1px solid #cbd5e1',
                        fontSize: '0.78rem', width: '210px'
                      }}
                    />
                  </div>
                  <button
                    onClick={handleExportCSV}
                    style={{
                      padding: '0.4rem 0.75rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '800',
                      backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '0.3rem'
                    }}
                  >
                    <Download size={14} /> Exportar CSV
                  </button>
                </div>
              </div>

              {/* Items Table */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                  <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '900' }}>
                    <tr>
                      <th style={{ padding: '0.65rem 0.85rem' }}>CÓDIGO DE BARRAS</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>REFERENCIA</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>COLOR</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>TALLA</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>ESTADO CRUCE</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>ORIGEN / DETALLE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((item: any, idx: number) => {
                      const isOk = item.status === 'Conciliado';
                      const isFaltante = item.status === 'Faltante';
                      const isSobrante = item.status === 'Sobrante';

                      return (
                        <tr key={idx} style={{
                          borderBottom: '1px solid #f1f5f9',
                          backgroundColor: isOk ? '#f0fdf4' : (isFaltante ? '#fef2f2' : (isSobrante ? '#faf5ff' : '#fff7ed'))
                        }}>
                          <td style={{ padding: '0.6rem 0.85rem', fontFamily: 'monospace', fontWeight: '800', color: '#0f172a' }}>
                            {item.barcode}
                          </td>
                          <td style={{ padding: '0.6rem 0.85rem', fontWeight: '800', color: '#1e293b' }}>
                            {item.reference_name}
                          </td>
                          <td style={{ padding: '0.6rem 0.85rem', fontWeight: '750', color: '#475569' }}>
                            {item.color_name}
                          </td>
                          <td style={{ padding: '0.6rem 0.85rem', fontWeight: '750', color: '#475569' }}>
                            {item.size_code}
                          </td>
                          <td style={{ padding: '0.6rem 0.85rem' }}>
                            <span style={{
                              padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '900',
                              backgroundColor: isOk ? '#dcfce7' : (isFaltante ? '#fee2e2' : (isSobrante ? '#f3e8ff' : '#ffedd5')),
                              color: isOk ? '#15803d' : (isFaltante ? '#b91c1c' : (isSobrante ? '#7e22ce' : '#c2410c'))
                            }}>
                              {item.status}
                            </span>
                          </td>
                          <td style={{ padding: '0.6rem 0.85rem', color: '#64748b', fontSize: '0.72rem' }}>
                            {item.origin}
                          </td>
                        </tr>
                      );
                    })}
                    {paginatedItems.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontWeight: '750' }}>
                          No se encontraron registros con los filtros seleccionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#64748b' }}>
                  <span>Mostrando {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, filteredItems.length)} de {filteredItems.length}</span>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                    >
                      Anterior
                    </button>
                    <span style={{ padding: '0.3rem 0.6rem', fontWeight: '800' }}>Pág. {currentPage} de {totalPages}</span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: APPLY CONCILIATION & ADJUSTMENT IN DATABASE */}
              <div style={{
                marginTop: '1rem', padding: '1.25rem', backgroundColor: '#0f172a', borderRadius: '18px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', color: 'white'
              }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '950' }}>
                    ¿Listo para aplicar la conciliación física a la bodega?
                  </h4>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                    Se actualizarán las prendas individuales, se darán de baja los faltantes, se incorporarán los sobrantes y se ajustará el stock disponible en Kardex.
                  </p>
                </div>

                <button
                  onClick={handleApplyReconciliation}
                  disabled={isApplying}
                  style={{
                    padding: '0.85rem 1.75rem', borderRadius: '12px', fontSize: '0.92rem', fontWeight: '950',
                    backgroundColor: '#10b981', color: 'white', border: 'none', cursor: isApplying ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
                  }}
                >
                  {isApplying ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" /> Aplicando ajuste en base de datos...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} /> Aplicar Conciliación y Ajustar Bodega
                    </>
                  )}
                </button>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
