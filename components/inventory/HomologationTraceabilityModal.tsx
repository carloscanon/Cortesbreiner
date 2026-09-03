import React from 'react';
import { X, ShieldCheck, Layers, GitMerge, BarChart2, Package, MapPin, History } from 'lucide-react';

interface TraceabilityModalProps {
  item: any;
  homologations: any[];
  stock: any[];
  kardex: any[];
  warehouses: any[];
  colors: any[];
  sizes: any[];
  onClose: () => void;
}

export default function HomologationTraceabilityModal({
  item,
  homologations,
  stock,
  kardex,
  warehouses,
  colors,
  sizes,
  onClose
}: TraceabilityModalProps) {
  if (!item) return null;

  const masterCode = item.masterCode || item.codigo_referencia || '—';
  const masterName = item.nombre_producto || 'Sin Nombre';

  // Find all homologated codes associated with this master code
  const linkedHomologations = (homologations || []).filter(
    h => h.status === 'Activo' && h.master_code.toUpperCase().trim() === masterCode.toUpperCase().trim()
  );

  const linkedCodesSet = new Set<string>();
  linkedCodesSet.add(masterCode.toUpperCase().trim());
  linkedHomologations.forEach(h => {
    if (h.source_code) linkedCodesSet.add(h.source_code.toUpperCase().trim());
  });

  // Calculate stock breakdown by source code
  const sourceStockMap: Record<string, { code: string; name: string; qty: number; warehousesSet: Set<string> }> = {};

  (stock || []).forEach(st => {
    const stCode = (st.products?.codigo_referencia || '').toUpperCase().trim();
    const stName = st.products?.nombre_producto || stCode || '—';
    const whName = st.warehouses?.nombre_bodega || 'Bodega Principal';

    if (linkedCodesSet.has(stCode) || st.product_id === item.product_id) {
      const displayCode = stCode || masterCode;
      if (!sourceStockMap[displayCode]) {
        sourceStockMap[displayCode] = {
          code: displayCode,
          name: stName,
          qty: 0,
          warehousesSet: new Set()
        };
      }
      sourceStockMap[displayCode].qty += Number(st.cantidad_disponible || 0);
      sourceStockMap[displayCode].warehousesSet.add(whName);
    }
  });

  const sourceStockList = Object.values(sourceStockMap);

  // Combined Kardex movements for master and linked codes
  const combinedKardex = (kardex || []).filter(k => {
    const kCode = (k.products?.codigo_referencia || '').toUpperCase().trim();
    return linkedCodesSet.has(kCode) || k.product_id === item.product_id;
  }).slice(0, 30);

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 1100, padding: '1.5rem'
    }}>
      <div className="card" style={{
        width: '100%', maxWidth: '850px', maxHeight: '90vh',
        backgroundColor: 'white', borderRadius: '20px', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
        border: '1px solid #cbd5e1'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.75rem', background: 'linear-gradient(135deg, #0f172a, #1e293b)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.5rem', backgroundColor: 'rgba(99, 102, 241, 0.2)', borderRadius: '10px', color: '#818cf8' }}>
              <GitMerge size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '950', letterSpacing: '-0.02em' }}>
                Trazabilidad del Código Maestro
              </h3>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                Historial de existencias de origen y movimientos asociados
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem' }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Master Header Card */}
          <div style={{
            backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '14px',
            border: '1.5px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem'
          }}>
            <div>
              <span style={{ fontSize: '0.68rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Código Maestro</span>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.1rem', fontWeight: '950', color: '#4f46e5' }}>{masterCode}</p>
            </div>
            <div>
              <span style={{ fontSize: '0.68rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Nombre del Producto</span>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.95rem', fontWeight: '800', color: '#0f172a' }}>{masterName}</p>
            </div>
            <div>
              <span style={{ fontSize: '0.68rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Stock Total Consolidado</span>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.1rem', fontWeight: '950', color: '#059669' }}>
                {(item.totalStock || item.cantidad_disponible || 0).toLocaleString()} uds
              </p>
            </div>
            <div>
              <span style={{ fontSize: '0.68rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Códigos Homologados</span>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '1.1rem', fontWeight: '950', color: '#0284c7' }}>
                {linkedHomologations.length} vinculo(s)
              </p>
            </div>
          </div>

          {/* SECTION 1: Códigos Relacionados */}
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: '900', color: '#334155', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={16} style={{ color: '#6366f1' }} /> Códigos Relacionados y Homologaciones
            </h4>
            
            {linkedHomologations.length === 0 ? (
              <div style={{ padding: '1rem', backgroundColor: '#f1f5f9', borderRadius: '10px', fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
                Este producto no tiene códigos anteriores enlazados todavía.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {linkedHomologations.map((h: any) => (
                  <div key={h.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.75rem 1rem', backgroundColor: '#ffffff', borderRadius: '10px',
                    border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: '900', color: '#4f46e5', backgroundColor: '#eef2ff', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                        {h.source_code}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#475569' }}>➔</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: '900', color: '#059669', backgroundColor: '#ecfdf5', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                        {h.master_code}
                      </span>
                      {h.notes && (
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>({h.notes})</span>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.72rem', color: '#94a3b8' }}>
                      <div>Registrado por: <strong>{h.created_by || 'Sistema'}</strong></div>
                      <div>{new Date(h.created_at).toLocaleString('es-CO')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 2: Origen de Existencias */}
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: '900', color: '#334155', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Package size={16} style={{ color: '#10b981' }} /> Desglose de Existencias por Código de Origen
            </h4>

            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: '800', color: '#475569' }}>
                  <tr>
                    <th style={{ padding: '0.65rem 1rem' }}>Código de Origen</th>
                    <th style={{ padding: '0.65rem 1rem' }}>Producto Registrado</th>
                    <th style={{ padding: '0.65rem 1rem' }}>Bodegas</th>
                    <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Stock Físico</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceStockList.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8' }}>
                        Sin existencias asociadas.
                      </td>
                    </tr>
                  ) : (
                    sourceStockList.map((st, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={{ padding: '0.65rem 1rem', fontWeight: '800', color: '#4f46e5' }}>{st.code}</td>
                        <td style={{ padding: '0.65rem 1rem', color: '#334155' }}>{st.name}</td>
                        <td style={{ padding: '0.65rem 1rem', color: '#64748b' }}>{Array.from(st.warehousesSet).join(', ') || 'Bodega Principal'}</td>
                        <td style={{ padding: '0.65rem 1rem', fontWeight: '900', color: '#0f172a', textAlign: 'right' }}>{st.qty.toLocaleString()} uds</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 3: Historial Combinado Kardex */}
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: '900', color: '#334155', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={16} style={{ color: '#0284c7' }} /> Movimientos de Kardex Combinados ({combinedKardex.length})
            </h4>

            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: '800', color: '#475569', position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Fecha</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Código</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Tipo Movimiento</th>
                    <th style={{ padding: '0.5rem 0.75rem' }}>Documento</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedKardex.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8' }}>
                        Sin movimientos en el Kardex.
                      </td>
                    </tr>
                  ) : (
                    combinedKardex.map((k: any, idx: number) => {
                      const isEntry = k.tipo_movimiento?.toLowerCase().includes('ingreso') || k.tipo_movimiento?.toLowerCase().includes('entrada') || (k.cantidad > 0);
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.5rem 0.75rem', color: '#64748b' }}>
                            {k.created_at ? new Date(k.created_at).toLocaleString('es-CO') : '—'}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', fontWeight: '750', color: '#4f46e5' }}>
                            {k.products?.codigo_referencia || masterCode}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', color: '#334155' }}>{k.tipo_movimiento}</td>
                          <td style={{ padding: '0.5rem 0.75rem', color: '#64748b' }}>{k.documento_origen || '—'}</td>
                          <td style={{ padding: '0.5rem 0.75rem', fontWeight: '900', color: isEntry ? '#059669' : '#ef4444', textAlign: 'right' }}>
                            {isEntry ? `+${k.cantidad}` : `-${Math.abs(k.cantidad)}`}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.5rem', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '0.5rem 1.25rem', fontWeight: '800', borderRadius: '8px' }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
