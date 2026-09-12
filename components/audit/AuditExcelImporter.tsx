import React, { useState } from 'react';
import { X, FileSpreadsheet, RefreshCw, CheckCircle2, AlertCircle, Upload } from 'lucide-react';

interface AuditExcelImporterProps {
  warehouses: any[];
  userEmail: string;
  onClose: () => void;
  onSuccess: (session: any) => void;
}

export default function AuditExcelImporter({
  warehouses,
  userEmail,
  onClose,
  onSuccess
}: AuditExcelImporterProps) {
  const [locationId, setLocationId] = useState('');
  const [rawText, setRawText] = useState('');
  const [analyzedRows, setAnalyzedRows] = useState<any[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleParseAndAnalyze = () => {
    if (!locationId) return alert('Selecciona la tienda o bodega destino.');
    if (!rawText.trim()) return alert('Pega el contenido del Excel o CSV.');

    setIsAnalyzing(true);
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    const results: any[] = [];

    lines.forEach((line, idx) => {
      if (idx === 0 && (line.toLowerCase().includes('sku') || line.toLowerCase().includes('código'))) return;

      const parts = line.split(/[,;\t]/).map(p => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length < 2) return;

      const sku = parts[0];
      const name = parts[1] || sku;
      const qtyStr = parts[2] || '0';
      const costStr = parts[3] || '0';

      const qty = parseInt(qtyStr, 10);
      const cost = parseFloat(costStr);

      const errors: string[] = [];
      if (!sku) errors.push('SKU / Código vacío');
      if (isNaN(qty) || qty < 0) errors.push('Cantidad inválida o negativa');

      results.push({
        lineNum: idx + 1,
        sku,
        name,
        qty: isNaN(qty) ? 0 : qty,
        cost: isNaN(cost) ? 0 : cost,
        isValid: errors.length === 0,
        errors
      });
    });

    setAnalyzedRows(results);
    setIsAnalyzing(false);
  };

  const validCount = analyzedRows.filter(r => r.isValid).length;
  const errorCount = analyzedRows.filter(r => !r.isValid).length;

  const handleExecuteImport = async () => {
    const validRows = analyzedRows.filter(r => r.isValid);
    if (validRows.length === 0) return alert('No hay filas válidas para importar.');

    setIsImporting(true);
    try {
      const whObj = warehouses.find(w => w.id === locationId);
      const locationName = whObj?.nombre_bodega || whObj?.name || 'Ubicación Excel';

      // 1. Create audit session
      const resSess = await fetch('/api/inventory/audit/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId,
          locationName,
          auditType: 'Importación Excel',
          userEmail: userEmail || 'Sistema',
          notes: `Carga esperada desde Excel con ${validRows.length} registros`
        })
      });

      const sessionData = await resSess.json();
      if (!resSess.ok) throw new Error(sessionData.error || 'Error al crear la sesión.');

      alert(`✅ Sesión de Auditoría #${sessionData.session.consecutive} creada e importada desde Excel.`);
      onSuccess(sessionData.session);
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
                Importador Masivo de Inventario Esperado
              </h3>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                Carga un archivo Excel o CSV para iniciar una auditoría con inventario personalizado
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#334155', marginBottom: '0.3rem' }}>
              Ubicación Destino de la Auditoría
            </label>
            <select
              value={locationId}
              onChange={e => setLocationId(e.target.value)}
              style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '700' }}
            >
              <option value="">Seleccionar Ubicación...</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.nombre_bodega || w.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#334155', marginBottom: '0.3rem' }}>
              Pega aquí el contenido del Excel (Columnas: SKU, Producto, Cantidad Esperada, Costo):
            </label>
            <textarea
              rows={6}
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder="CAM-001-NEG-M, Camisa Oxford Negra M, 35, 45000&#10;PAN-025-AZU-L, Pantalón Jean Azul L, 20, 65000"
              style={{
                width: '100%', padding: '0.75rem', borderRadius: '10px',
                border: '1.5px solid #cbd5e1', fontFamily: 'monospace', fontSize: '0.8rem'
              }}
            />
          </div>

          <button
            type="button"
            onClick={handleParseAndAnalyze}
            className="btn btn-secondary"
            style={{ padding: '0.6rem', fontWeight: '800', justifyContent: 'center' }}
          >
            <RefreshCw size={16} style={{ marginRight: '0.5rem' }} /> Analizar y Validar Estructura
          </button>

          {analyzedRows.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: '800' }}>
                <span>Resultado del Análisis: {analyzedRows.length} filas</span>
                <div>
                  <span style={{ color: '#059669', marginRight: '1rem' }}>✓ Válidas: {validCount}</span>
                  {errorCount > 0 && <span style={{ color: '#ef4444' }}>❌ Con Errores: {errorCount}</span>}
                </div>
              </div>

              <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                  <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: '800' }}>
                    <tr>
                      <th style={{ padding: '0.5rem' }}>Fila</th>
                      <th style={{ padding: '0.5rem' }}>SKU</th>
                      <th style={{ padding: '0.5rem' }}>Producto</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Cantidad</th>
                      <th style={{ padding: '0.5rem' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyzedRows.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: r.isValid ? 'white' : '#fef2f2' }}>
                        <td style={{ padding: '0.5rem' }}>#{r.lineNum}</td>
                        <td style={{ padding: '0.5rem', fontWeight: '800', color: 'var(--primary)' }}>{r.sku}</td>
                        <td style={{ padding: '0.5rem' }}>{r.name}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '900' }}>{r.qty}</td>
                        <td style={{ padding: '0.5rem', color: r.isValid ? '#059669' : '#ef4444', fontWeight: '800' }}>
                          {r.isValid ? '✓ Válida' : r.errors.join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.5rem', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '0.55rem 1.25rem', fontWeight: '800' }}>
            Cancelar
          </button>
          <button
            onClick={handleExecuteImport}
            disabled={validCount === 0 || isImporting}
            className="btn btn-primary"
            style={{ padding: '0.65rem 1.5rem', fontWeight: '950', backgroundColor: validCount > 0 ? 'var(--primary)' : '#cbd5e1' }}
          >
            {isImporting ? 'Importando...' : `Iniciar Auditoría con ${validCount} Filas Válidas`}
          </button>
        </div>
      </div>
    </div>
  );
}
