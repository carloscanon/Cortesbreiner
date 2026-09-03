import React, { useState, useMemo } from 'react';
import {
  RefreshCw, CheckCircle2, AlertTriangle, HelpCircle, ShieldCheck,
  ArrowRight, ArrowLeft, Play, Database, Layers, Check, Search, FileCheck, Layers3
} from 'lucide-react';

interface ConsolidationWizardProps {
  products: any[];
  stock: any[];
  homologations: any[];
  userEmail: string;
  onCancel: () => void;
  onFinishSuccess: () => void;
}

export default function ConsolidationWizard({
  products,
  stock,
  homologations,
  userEmail,
  onCancel,
  onFinishSuccess
}: ConsolidationWizardProps) {
  const [step, setStep] = useState<number>(1);

  // Step 1 states
  const [sourceInventoryType, setSourceInventoryType] = useState('current');
  const [targetInventoryType, setTargetInventoryType] = useState('master');

  // Step 2 & 3 states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any[]>([]);

  // Step 4 validation selections
  const [validatedPairs, setValidatedPairs] = useState<Record<string, { masterCode: string; masterProdId: string | null; action: string }>>({});

  // Step 6 execution states
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [finalSummary, setFinalSummary] = useState<any>(null);

  // Existing active homologations map
  const existingHomologatedSet = useMemo(() => {
    const set = new Set<string>();
    (homologations || []).forEach(h => {
      if (h.status === 'Activo') {
        set.add(h.source_code.toUpperCase().trim());
      }
    });
    return set;
  }, [homologations]);

  // Execute Step 2: Algoritmo de comparación
  const runAnalysis = () => {
    setIsAnalyzing(true);

    setTimeout(() => {
      const results: any[] = [];
      const codeProductMap = new Map<string, any>();

      products.forEach(p => {
        if (p.codigo_referencia) {
          codeProductMap.set(p.codigo_referencia.toUpperCase().trim(), p);
        }
      });

      products.forEach(sourceProd => {
        const sCode = (sourceProd.codigo_referencia || '').toUpperCase().trim();
        const sName = (sourceProd.nombre_producto || sCode || '').toUpperCase().trim();
        const sCategory = (sourceProd.categoria || sourceProd.categories?.categoria || '').toUpperCase().trim();

        if (!sCode) return;

        // Calculate total stock for this source product
        const sStock = stock
          .filter(st => st.product_id === sourceProd.id || (st.products?.codigo_referencia || '').toUpperCase().trim() === sCode)
          .reduce((sum, st) => sum + Number(st.cantidad_disponible || 0), 0);

        // Check if already homologated
        if (existingHomologatedSet.has(sCode)) {
          const activeH = homologations.find(h => h.status === 'Activo' && h.source_code.toUpperCase().trim() === sCode);
          results.push({
            id: sourceProd.id,
            sourceCode: sCode,
            sourceName: sourceProd.nombre_producto || sCode,
            sourceCategory: sCategory,
            sourceStock: sStock,
            masterCode: activeH?.master_code || sCode,
            masterName: activeH?.master_product?.nombre_producto || activeH?.master_code || sCode,
            matchPercentage: 100,
            matchType: 'ya_homologado', // 🔵
            action: 'Vincular'
          });
          return;
        }

        // Try exact code or clean reference match
        const cleanRefMatch = products.find(p => {
          if (p.id === sourceProd.id) return false;
          const targetRef = (p.codigo_referencia || '').toUpperCase().trim();
          return targetRef === sCode;
        });

        if (cleanRefMatch) {
          results.push({
            id: sourceProd.id,
            sourceCode: sCode,
            sourceName: sourceProd.nombre_producto || sCode,
            sourceCategory: sCategory,
            sourceStock: sStock,
            masterCode: cleanRefMatch.codigo_referencia,
            masterName: cleanRefMatch.nombre_producto || cleanRefMatch.codigo_referencia,
            masterProdId: cleanRefMatch.id,
            matchPercentage: 100,
            matchType: 'exacta', // 🟢
            action: 'Vincular'
          });
          return;
        }

        // Try name / similarity match (probable match)
        const probableMatch = products.find(p => {
          if (p.id === sourceProd.id) return false;
          const targetName = (p.nombre_producto || '').toUpperCase().trim();
          if (!targetName || !sName) return false;
          return targetName.includes(sName) || sName.includes(targetName);
        });

        if (probableMatch) {
          results.push({
            id: sourceProd.id,
            sourceCode: sCode,
            sourceName: sourceProd.nombre_producto || sCode,
            sourceCategory: sCategory,
            sourceStock: sStock,
            masterCode: probableMatch.codigo_referencia,
            masterName: probableMatch.nombre_producto || probableMatch.codigo_referencia,
            masterProdId: probableMatch.id,
            matchPercentage: 85,
            matchType: 'probable', // 🟡
            action: 'Revisar'
          });
          return;
        }

        // No match found
        results.push({
          id: sourceProd.id,
          sourceCode: sCode,
          sourceName: sourceProd.nombre_producto || sCode,
          sourceCategory: sCategory,
          sourceStock: sStock,
          masterCode: sCode,
          masterName: sourceProd.nombre_producto || sCode,
          masterProdId: sourceProd.id,
          matchPercentage: 0,
          matchType: 'sin_coincidencia', // 🔴
          action: 'Crear'
        });
      });

      setAnalysisResults(results);

      // Initialize validation mapping
      const initialVals: Record<string, any> = {};
      results.forEach(r => {
        initialVals[r.sourceCode] = {
          masterCode: r.masterCode,
          masterProdId: r.masterProdId || null,
          action: r.action
        };
      });
      setValidatedPairs(initialVals);

      setIsAnalyzing(false);
      setStep(3);
    }, 600);
  };

  // Counts for Step 3 & 7
  const exactCount = analysisResults.filter(r => r.matchType === 'exacta').length;
  const probableCount = analysisResults.filter(r => r.matchType === 'probable').length;
  const noMatchCount = analysisResults.filter(r => r.matchType === 'sin_coincidencia').length;
  const alreadyHomologatedCount = analysisResults.filter(r => r.matchType === 'ya_homologado').length;

  // Execute Step 6: Consolidate
  const handleConsolidateExecution = async () => {
    if (!confirm('¿Confirmas consolidar el inventario seleccionado? Esta operación registrará las homologaciones permanentes.')) return;

    setIsConsolidating(true);
    try {
      const pairsToSubmit = analysisResults.map(r => {
        const val = validatedPairs[r.sourceCode];
        return {
          sourceCode: r.sourceCode,
          masterCode: val ? val.masterCode : r.masterCode,
          sourceProductId: r.id,
          masterProductId: val ? val.masterProdId : r.masterProdId,
          matchPercentage: r.matchPercentage,
          matchType: r.matchType,
          sourceStock: r.sourceStock
        };
      });

      const res = await fetch('/api/inventory/consolidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairs: pairsToSubmit,
          userEmail: userEmail || 'Sistema',
          notes: 'Consolidación desde Asistente 7 Pasos'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al consolidar.');

      setFinalSummary(data.summary);
      setStep(7);
    } catch (err: any) {
      alert('❌ Error durante la consolidación: ' + err.message);
    } finally {
      setIsConsolidating(false);
    }
  };

  return (
    <div className="card" style={{ padding: '2rem', borderRadius: '16px', backgroundColor: 'white', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Wizard Header Progress Bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.72rem', fontWeight: '900', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ASISTENTE GUIADO DE CONSOLIDACIÓN DE INVENTARIO
            </span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '950', margin: 0, color: '#0f172a' }}>
              Paso {step} de 7: {
                step === 1 ? 'Seleccionar Inventarios' :
                step === 2 ? 'Analizando Códigos' :
                step === 3 ? 'Resultados del Análisis' :
                step === 4 ? 'Validación de Relaciones' :
                step === 5 ? 'Vista Previa Consolidada' :
                step === 6 ? 'Confirmar Consolidación' :
                'Resultado y Cierre'
              }
            </h2>
          </div>
          <span style={{ fontSize: '0.85rem', fontWeight: '900', color: '#64748b', backgroundColor: '#f1f5f9', padding: '0.35rem 0.85rem', borderRadius: '8px' }}>
            Etapa {step} / 7
          </span>
        </div>

        {/* Stepper Dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {[1, 2, 3, 4, 5, 6, 7].map(sNum => (
            <React.Fragment key={sNum}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: '900', fontSize: '0.85rem',
                backgroundColor: step === sNum ? 'var(--primary)' : step > sNum ? '#10b981' : '#e2e8f0',
                color: step >= sNum ? 'white' : '#64748b',
                transition: 'all 0.3s ease'
              }}>
                {step > sNum ? <Check size={16} /> : sNum}
              </div>
              {sNum < 7 && <div style={{ flex: 1, height: '3px', backgroundColor: step > sNum ? '#10b981' : '#e2e8f0' }} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* STEP 1: Seleccionar Inventarios */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ backgroundColor: '#eff6ff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #bfdbfe', fontSize: '0.85rem', color: '#1e40af' }}>
            <p style={{ margin: 0, fontWeight: '800' }}>Selecciona los inventarios a cruzar:</p>
            <p style={{ margin: '0.25rem 0 0 0', opacity: 0.85 }}>El sistema tomará los productos de origen y los comparará con la estructura del Código Maestro.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div style={{ padding: '1.5rem', borderRadius: '14px', border: '2px solid var(--primary)', backgroundColor: '#f8fafc' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: '900', color: 'var(--primary)', textTransform: 'uppercase' }}>Inventario Origen</span>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '950', margin: '0.25rem 0 0.75rem 0' }}>Inventario Actual Producto Terminado</h3>
              <select
                value={sourceInventoryType}
                onChange={e => setSourceInventoryType(e.target.value)}
                style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: '700' }}
              >
                <option value="current">Todos los SKUs Activos ({products.length} productos)</option>
              </select>
            </div>

            <div style={{ padding: '1.5rem', borderRadius: '14px', border: '2px solid #10b981', backgroundColor: '#f8fafc' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: '900', color: '#10b981', textTransform: 'uppercase' }}>Inventario Destino</span>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '950', margin: '0.25rem 0 0.75rem 0' }}>Estructura Código Maestro</h3>
              <select
                value={targetInventoryType}
                onChange={e => setTargetInventoryType(e.target.value)}
                style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: '700' }}
              >
                <option value="master">Catálogo Consolidado y Maestro</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
            <button onClick={onCancel} className="btn btn-secondary" style={{ padding: '0.65rem 1.5rem', fontWeight: '800' }}>Cancelar</button>
            <button onClick={runAnalysis} className="btn btn-primary" style={{ padding: '0.65rem 1.75rem', fontWeight: '900' }}>
              Iniciar Análisis de Códigos <ArrowRight size={18} style={{ marginLeft: '0.5rem' }} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Analizando Códigos */}
      {step === 2 && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ border: '4px solid #f3f3f3', borderTop: '4px solid var(--primary)', borderRadius: '50%', width: '50px', height: '50px', animation: 'spin 1s linear infinite' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: '950', margin: 0 }}>Procesando y Comparando Códigos...</h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>Analizando coincidencia por código, referencia, color, talla y categoría.</p>
        </div>
      )}

      {/* STEP 3: Resultados del Análisis */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Semáforo Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: '#ecfdf5', border: '1.5px solid #a7f3d0' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: '900', color: '#047857' }}>🟢 EXACTA (100%)</span>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '950', color: '#065f46', margin: '0.2rem 0' }}>{exactCount}</h3>
              <span style={{ fontSize: '0.7rem', color: '#047857' }}>Coincidencia completa</span>
            </div>

            <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: '#fffbeb', border: '1.5px solid #fef08a' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: '900', color: '#b45309' }}>🟡 PROBABLE (85%)</span>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '950', color: '#92400e', margin: '0.2rem 0' }}>{probableCount}</h3>
              <span style={{ fontSize: '0.7rem', color: '#b45309' }}>Requiere validación</span>
            </div>

            <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: '#fef2f2', border: '1.5px solid #fecaca' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: '900', color: '#b91c1c' }}>🔴 SIN COINCIDENCIA</span>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '950', color: '#991b1b', margin: '0.2rem 0' }}>{noMatchCount}</h3>
              <span style={{ fontSize: '0.7rem', color: '#b91c1c' }}>Registros independientes</span>
            </div>

            <div style={{ padding: '1rem', borderRadius: '12px', backgroundColor: '#f0f9ff', border: '1.5px solid #bae6fd' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: '900', color: '#0369a1' }}>🔵 YA HOMOLOGADO</span>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '950', color: '#075985', margin: '0.2rem 0' }}>{alreadyHomologatedCount}</h3>
              <span style={{ fontSize: '0.7rem', color: '#0369a1' }}>Relación activa</span>
            </div>
          </div>

          {/* Results Table */}
          <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
              <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: '800', color: '#475569', position: 'sticky', top: 0 }}>
                <tr>
                  <th style={{ padding: '0.75rem 1rem' }}>Código Actual</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Producto Actual</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Código Nuevo / Maestro</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Coincidencia</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {analysisResults.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.65rem 1rem', fontWeight: '800', color: '#4f46e5' }}>{r.sourceCode}</td>
                    <td style={{ padding: '0.65rem 1rem', color: '#334155' }}>{r.sourceName}</td>
                    <td style={{ padding: '0.65rem 1rem', fontWeight: '800', color: '#059669' }}>{r.masterCode}</td>
                    <td style={{ padding: '0.65rem 1rem' }}>
                      <span style={{
                        padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '900',
                        backgroundColor: r.matchType === 'exacta' ? '#ecfdf5' : r.matchType === 'probable' ? '#fffbeb' : r.matchType === 'ya_homologado' ? '#f0f9ff' : '#fef2f2',
                        color: r.matchType === 'exacta' ? '#047857' : r.matchType === 'probable' ? '#b45309' : r.matchType === 'ya_homologado' ? '#0369a1' : '#b91c1c'
                      }}>
                        {r.matchPercentage}% ({r.matchType.replace('_', ' ')})
                      </span>
                    </td>
                    <td style={{ padding: '0.65rem 1rem', fontWeight: '800', color: '#0f172a' }}>{r.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
            <button onClick={() => setStep(1)} className="btn btn-secondary" style={{ padding: '0.65rem 1.5rem', fontWeight: '800' }}>
              <ArrowLeft size={18} style={{ marginRight: '0.5rem' }} /> Volver
            </button>
            <button onClick={() => setStep(4)} className="btn btn-primary" style={{ padding: '0.65rem 1.75rem', fontWeight: '900' }}>
              Continuar a Validación <ArrowRight size={18} style={{ marginLeft: '0.5rem' }} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Validación de Relaciones */}
      {step === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ backgroundColor: '#fffbeb', padding: '1rem', borderRadius: '12px', border: '1px solid #fef08a', fontSize: '0.8rem', color: '#92400e' }}>
            <p style={{ margin: 0, fontWeight: '800' }}>Revisa y confirma las relaciones de homologación:</p>
            <p style={{ margin: '0.2rem 0 0 0' }}>Puedes ajustar el Código Maestro asignado a cada producto antes de confirmar la vista previa.</p>
          </div>

          <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
              <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: '800', color: '#475569', position: 'sticky', top: 0 }}>
                <tr>
                  <th style={{ padding: '0.75rem 1rem' }}>Código Actual</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Producto Actual</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Código Maestro Asignado</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Stock a Consolidar</th>
                </tr>
              </thead>
              <tbody>
                {analysisResults.map((r, i) => {
                  const currentVal = validatedPairs[r.sourceCode] || { masterCode: r.masterCode };
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.65rem 1rem', fontWeight: '800', color: '#4f46e5' }}>{r.sourceCode}</td>
                      <td style={{ padding: '0.65rem 1rem', color: '#334155' }}>{r.sourceName}</td>
                      <td style={{ padding: '0.65rem 1rem' }}>
                        <input
                          type="text"
                          value={currentVal.masterCode}
                          onChange={e => {
                            setValidatedPairs({
                              ...validatedPairs,
                              [r.sourceCode]: {
                                ...currentVal,
                                masterCode: e.target.value
                              }
                            });
                          }}
                          style={{
                            padding: '0.35rem 0.65rem', borderRadius: '6px',
                            border: '1.5px solid #cbd5e1', fontWeight: '800',
                            color: '#059669', fontSize: '0.8rem'
                          }}
                        />
                      </td>
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: '900', color: '#0f172a' }}>
                        {r.sourceStock.toLocaleString()} uds
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
            <button onClick={() => setStep(3)} className="btn btn-secondary" style={{ padding: '0.65rem 1.5rem', fontWeight: '800' }}>
              <ArrowLeft size={18} style={{ marginRight: '0.5rem' }} /> Volver
            </button>
            <button onClick={() => setStep(5)} className="btn btn-primary" style={{ padding: '0.65rem 1.75rem', fontWeight: '900' }}>
              Ver Vista Previa Consolidada <ArrowRight size={18} style={{ marginLeft: '0.5rem' }} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Vista Previa Consolidada */}
      {step === 5 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ backgroundColor: '#ecfdf5', padding: '1.25rem', borderRadius: '12px', border: '1px solid #a7f3d0', fontSize: '0.85rem', color: '#065f46' }}>
            <p style={{ margin: 0, fontWeight: '800' }}>Resumen de Vista Previa antes de Consolidar:</p>
            <p style={{ margin: '0.25rem 0 0 0' }}>Así quedará el catálogo consolidado en el Inventario General.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ padding: '1.25rem', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b' }}>TOTAL PRODUCTOS ANALIZADOS</span>
              <h3 style={{ fontSize: '1.4rem', fontWeight: '950', margin: '0.2rem 0', color: '#0f172a' }}>{analysisResults.length}</h3>
            </div>
            <div className="card" style={{ padding: '1.25rem', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b' }}>HOMOLOGACIONES A REGISTRAR</span>
              <h3 style={{ fontSize: '1.4rem', fontWeight: '950', margin: '0.2rem 0', color: '#4f46e5' }}>
                {Object.values(validatedPairs).filter(v => v.masterCode).length}
              </h3>
            </div>
            <div className="card" style={{ padding: '1.25rem', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b' }}>UNIDADES TOTALES EN STOCK</span>
              <h3 style={{ fontSize: '1.4rem', fontWeight: '950', margin: '0.2rem 0', color: '#059669' }}>
                {analysisResults.reduce((sum, r) => sum + r.sourceStock, 0).toLocaleString()} uds
              </h3>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
            <button onClick={() => setStep(4)} className="btn btn-secondary" style={{ padding: '0.65rem 1.5rem', fontWeight: '800' }}>
              <ArrowLeft size={18} style={{ marginRight: '0.5rem' }} /> Volver a Validación
            </button>
            <button onClick={() => setStep(6)} className="btn btn-primary" style={{ padding: '0.65rem 1.75rem', fontWeight: '900', backgroundColor: '#059669' }}>
              Proceder a Confirmar Consolidación <ArrowRight size={18} style={{ marginLeft: '0.5rem' }} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: Confirmar Consolidación */}
      {step === 6 && (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#eef2ff', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Database size={32} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: '950', color: '#0f172a', margin: '0 0 0.5rem 0' }}>
              ¿Estás listo para ejecutar la consolidación?
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#64748b', maxWidth: '500px', margin: '0 auto' }}>
              Se guardarán las homologaciones permanentes y se actualizará la vista del Inventario General manteniendo la trazabilidad histórica de origen.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button onClick={() => setStep(5)} disabled={isConsolidating} className="btn btn-secondary" style={{ padding: '0.75rem 1.5rem', fontWeight: '800' }}>
              <ArrowLeft size={18} style={{ marginRight: '0.5rem' }} /> Volver a Vista Previa
            </button>
            <button
              onClick={handleConsolidateExecution}
              disabled={isConsolidating}
              className="btn btn-primary"
              style={{ padding: '0.75rem 2rem', fontWeight: '950', backgroundColor: '#059669', fontSize: '1rem' }}
            >
              {isConsolidating ? 'CONSOLIDANDO INVENTARIO...' : '🔄 CONSOLIDAR INVENTARIO'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 7: Resultado y Cierre */}
      {step === 7 && finalSummary && (
        <div style={{ textAlign: 'center', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
          <div style={{ width: '70px', height: '70px', borderRadius: '50%', backgroundColor: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={42} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: '950', color: '#0f172a', margin: '0 0 0.25rem 0' }}>
              ¡Consolidación Finalizada con Éxito!
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
              El inventario general ha sido consolidado y las relaciones han quedado guardadas.
            </p>
          </div>

          {/* Final Summary Card Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', width: '100%', maxWidth: '750px', textAlign: 'left' }}>
            <div style={{ padding: '1.25rem', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b' }}>PRODUCTOS ANALIZADOS</span>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '950', color: '#0f172a', margin: '0.2rem 0' }}>{finalSummary.totalAnalyzed}</h3>
            </div>
            <div style={{ padding: '1.25rem', borderRadius: '12px', backgroundColor: '#eef2ff', border: '1px solid #c7d2fe' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#4338ca' }}>PRODUCTOS HOMOLOGADOS</span>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '950', color: '#3730a3', margin: '0.2rem 0' }}>{finalSummary.homologatedCount}</h3>
            </div>
            <div style={{ padding: '1.25rem', borderRadius: '12px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#047857' }}>UNIDADES CONSOLIDADAS</span>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '950', color: '#065f46', margin: '0.2rem 0' }}>{finalSummary.totalUnitsConsolidated.toLocaleString()}</h3>
            </div>
          </div>

          <button
            onClick={onFinishSuccess}
            className="btn btn-primary"
            style={{ padding: '0.75rem 2rem', fontWeight: '950', borderRadius: '10px', marginTop: '1rem' }}
          >
            Ir al Inventario General Consolidado
          </button>
        </div>
      )}

    </div>
  );
}
