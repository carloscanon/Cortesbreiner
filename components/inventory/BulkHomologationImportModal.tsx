import React, { useState } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';

interface BulkImportModalProps {
  products: any[];
  userEmail: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BulkHomologationImportModal({
  products,
  userEmail,
  onClose,
  onSuccess
}: BulkImportModalProps) {
  const [rawText, setRawText] = useState('');
  const [analyzedRows, setAnalyzedRows] = useState<any[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<any>(null);

  const productCodeMap = new Map<string, any>();
  products.forEach(p => {
    if (p.codigo_referencia) {
      productCodeMap.set(p.codigo_referencia.trim().toUpperCase(), p);
    }
  });

  const handleParseAndAnalyze = () => {
    if (!rawText.trim()) return alert('Ingresa o pega el contenido CSV / Excel.');

    setIsAnalyzing(true);
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    const results: any[] = [];

    lines.forEach((line, idx) => {
      // Ignore header if present
      if (idx === 0 && (line.toLowerCase().includes('código') || line.toLowerCase().includes('codigo'))) {
        return;
      }

      const parts = line.split(/[,;\t]/).map(p => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length < 2) return;

      const sourceCode = parts[0];
      const masterCode = parts[1];
      const notes = parts[2] || 'Importación masiva CSV';

      const sourceProd = productCodeMap.get(sourceCode.toUpperCase());
      const masterProd = productCodeMap.get(masterCode.toUpperCase());

      const errors: string[] = [];
      const warnings: string[] = [];

      if (!sourceCode) errors.push('Código actual vacío.');
      if (!masterCode) errors.push('Código maestro vacío.');
      if (sourceCode.toUpperCase() === masterCode.toUpperCase()) warnings.push('Mismo código origen y maestro.');

      results.push({
        lineNum: idx + 1,
        sourceCode,
        masterCode,
        notes,
        sourceProductId: sourceProd?.id || null,
        masterProductId: masterProd?.id || null,
        sourceProdName: sourceProd?.nombre_producto || 'No registrado en maestro',
        masterProdName: masterProd?.nombre_producto || 'No registrado en maestro',
        isValid: errors.length === 0,
        errors,
        warnings
      });
    });

    setAnalyzedRows(results);
    setIsAnalyzing(false);
  };

  const validCount = analyzedRows.filter(r => r.isValid).length;
  const errorCount = analyzedRows.filter(r => !r.isValid).length;

  const handleExecuteImport = async () => {
    const validItems = analyzedRows.filter(r => r.isValid);
    if (validItems.length === 0) return alert('No hay registros válidos para importar.');

    if (!confirm(`¿Confirmas importar ${validItems.length} relaciones de homologación?`)) return;

    setIsImporting(true);
    try {
      const payload = {
        userEmail: userEmail || 'Sistema',
        actionType: 'IMPORTACION_MASIVA',
        notes: 'Carga masiva desde archivo',
        items: validItems.map(r => ({
          sourceCode: r.sourceCode,
          masterCode: r.masterCode,
          sourceProductId: r.sourceProductId,
          masterProductId: r.masterProductId,
          matchPercentage: 100,
          matchType: 'manual',
          notes: r.notes
        }))
      };

      const res = await fetch('/api/inventory/homologations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error en la importación.');

      setImportSummary({
        totalImported: data.count || validItems.length,
        errorsSkipped: errorCount
      });

      onSuccess();
    } catch (err: any) {
      alert('❌ Error: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 1100, padding: '1.5rem'
    }}>
      <div className="card" style={{
        width: '100%', maxWidth: '800px', maxHeight: '90vh',
        backgroundColor: 'white', borderRadius: '20px', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
        border: '1px solid #cbd5e1'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.75rem', background: 'linear-gradient(135deg, #0f172a, #1e3a5f)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.5rem', backgroundColor: 'rgba(59, 130, 246, 0.2)', borderRadius: '10px', color: '#60a5fa' }}>
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '950' }}>
                Importación Masiva de Homologaciones
              </h3>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                Carga homologaciones desde CSV / Excel (Código Actual, Código Maestro)
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {importSummary ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <div style={{
                width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#ecfdf5',
                color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto'
              }}>
                <CheckCircle2 size={36} />
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: '950', color: '#0f172a', margin: '0 0 0.5rem 0' }}>
                ¡Importación Exitosa!
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#475569', margin: 0 }}>
                Se registraron <strong>{importSummary.totalImported}</strong> homologaciones correctamente.
              </p>
              {importSummary.errorsSkipped > 0 && (
                <p style={{ fontSize: '0.8rem', color: '#f59e0b', marginTop: '0.5rem' }}>
                  ({importSummary.errorsSkipped} filas omitidas por errores)
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Instructions */}
              <div style={{ backgroundColor: '#eff6ff', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid #bfdbfe', fontSize: '0.8rem', color: '#1e40af' }}>
                <p style={{ fontWeight: '800', margin: '0 0 0.25rem 0' }}>Estructura esperada por línea (separado por coma, punto y coma o tabulación):</p>
                <code style={{ display: 'block', backgroundColor: 'white', padding: '0.5rem', borderRadius: '6px', fontSize: '0.78rem', color: '#0f172a', fontWeight: '800' }}>
                  Código Actual, Código Maestro, Observaciones (Opcional)
                </code>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.72rem', opacity: 0.85 }}>
                  Ejemplo: <code>CAM-001, CAM-1001, Homologación lote 2026</code>
                </p>
              </div>

              {/* Paste area */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#334155', marginBottom: '0.35rem' }}>
                  Pega aquí el contenido de las filas:
                </label>
                <textarea
                  rows={6}
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  placeholder="CAM-001, CAM-1001&#10;PAN-025, PAN-3025"
                  style={{
                    width: '100%', padding: '0.75rem', borderRadius: '10px',
                    border: '1.5px solid #cbd5e1', fontFamily: 'monospace', fontSize: '0.8rem'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={handleParseAndAnalyze}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '0.6rem', fontWeight: '800', justifyContent: 'center' }}
                >
                  <RefreshCw size={16} style={{ marginRight: '0.5rem' }} /> Analizar y Validar Registros
                </button>
              </div>

              {/* Validation Results Table */}
              {analyzedRows.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>
                      Resultado del Análisis ({analyzedRows.length} filas)
                    </h4>
                    <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', fontWeight: '800' }}>
                      <span style={{ color: '#059669' }}>✓ Válidas: {validCount}</span>
                      {errorCount > 0 && <span style={{ color: '#ef4444' }}>❌ Con Errores: {errorCount}</span>}
                    </div>
                  </div>

                  <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                      <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: '800', color: '#475569', position: 'sticky', top: 0 }}>
                        <tr>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Fila</th>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Código Actual</th>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Código Maestro</th>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Estado</th>
                          <th style={{ padding: '0.5rem 0.75rem' }}>Detalle / Validación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analyzedRows.map((r, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: r.isValid ? 'white' : '#fef2f2' }}>
                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: '800' }}>#{r.lineNum}</td>
                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: '800', color: '#4f46e5' }}>{r.sourceCode}</td>
                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: '800', color: '#059669' }}>{r.masterCode}</td>
                            <td style={{ padding: '0.5rem 0.75rem' }}>
                              {r.isValid ? (
                                <span style={{ color: '#059669', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                  <CheckCircle2 size={14} /> Válida
                                </span>
                              ) : (
                                <span style={{ color: '#ef4444', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                  <AlertCircle size={14} /> Error
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '0.5rem 0.75rem', color: r.isValid ? '#64748b' : '#dc2626' }}>
                              {r.errors.join(' | ') || r.warnings.join(' | ') || 'OK'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.5rem', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '0.5rem 1.25rem', fontWeight: '800', borderRadius: '8px' }}>
            {importSummary ? 'Cerrar' : 'Cancelar'}
          </button>

          {!importSummary && (
            <button
              onClick={handleExecuteImport}
              disabled={validCount === 0 || isImporting}
              className="btn btn-primary"
              style={{
                padding: '0.6rem 1.5rem', fontWeight: '900', borderRadius: '8px',
                backgroundColor: validCount > 0 ? 'var(--primary)' : '#cbd5e1'
              }}
            >
              {isImporting ? 'Importando...' : `Importar ${validCount} Homologaciones Válidas`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
