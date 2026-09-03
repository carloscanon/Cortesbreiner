import React, { useState, useMemo, useEffect } from 'react';
import {
  Package, TrendingUp, Barcode, CheckCircle2, AlertTriangle, GitMerge,
  Search, RefreshCw, Plus, FileSpreadsheet, Layers, History, RotateCcw,
  ShieldCheck, Info, Eye, Layers3, Filter, ArrowUpRight
} from 'lucide-react';
import HomologationTraceabilityModal from './HomologationTraceabilityModal';
import BulkHomologationImportModal from './BulkHomologationImportModal';
import ConsolidationWizard from './ConsolidationWizard';

interface GeneralInventorySubmoduleProps {
  products: any[];
  stock: any[];
  kardex: any[];
  warehouses: any[];
  colors: any[];
  sizes: any[];
  categories: any[];
  user: any;
  profile: any;
  isAdmin: boolean;
  onRefreshData: () => void;
}

export default function GeneralInventorySubmodule({
  products,
  stock,
  kardex,
  warehouses,
  colors,
  sizes,
  categories,
  user,
  profile,
  isAdmin,
  onRefreshData
}: GeneralInventorySubmoduleProps) {
  const [subTab, setSubTab] = useState<'consolidated' | 'wizard' | 'homologation_engine' | 'history'>('consolidated');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');

  // Homologations state
  const [homologations, setHomologations] = useState<any[]>([]);
  const [homologationLogs, setHomologationLogs] = useState<any[]>([]);
  const [loadingHomologations, setLoadingHomologations] = useState(false);

  // Modals state
  const [selectedItemForTraceability, setSelectedItemForTraceability] = useState<any>(null);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);

  // Manual Homologation Form state
  const [manualSourceCode, setManualSourceCode] = useState('');
  const [manualMasterCode, setManualMasterCode] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [isSavingManual, setIsSavingManual] = useState(false);

  // Fetch homologations from API
  const fetchHomologations = async () => {
    setLoadingHomologations(true);
    try {
      const res = await fetch('/api/inventory/homologations');
      const data = await res.json();
      if (res.ok && data.success) {
        setHomologations(data.homologations || []);
        setHomologationLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Error fetching homologations:', err);
    } finally {
      setLoadingHomologations(false);
    }
  };

  useEffect(() => {
    fetchHomologations();
  }, []);

  // Map of active homologations: source_code -> master_code
  const activeHomologationsMap = useMemo(() => {
    const map = new Map<string, string>();
    (homologations || []).forEach(h => {
      if (h.status === 'Activo') {
        map.set(h.source_code.toUpperCase().trim(), h.master_code.toUpperCase().trim());
      }
    });
    return map;
  }, [homologations]);

  // Consolidated Inventory Aggregation Logic
  const consolidatedInventoryList = useMemo(() => {
    const aggMap: Record<string, {
      masterCode: string;
      nombre_producto: string;
      categoria: string;
      product_id: string | null;
      totalStock: number;
      warehousesSet: Set<string>;
      linkedCodesSet: Set<string>;
      colorName: string;
      sizeCode: string;
    }> = {};

    // Group stock by Master Code
    (stock || []).forEach(st => {
      const refCode = (st.products?.codigo_referencia || '').toUpperCase().trim();
      const prodName = st.products?.nombre_producto || refCode || 'Sin Nombre';
      const catName = st.products?.categories?.categoria || st.products?.categoria || 'Sin Categoría';
      const whName = st.warehouses?.nombre_bodega || 'Bodega Principal';
      const colorName = st.colors?.nombre_color || '—';
      const sizeCode = st.sizes?.codigo_talla || 'ST';

      // Check if this reference code is homologated under a master code
      const masterCode = activeHomologationsMap.get(refCode) || refCode || 'SIN-CODIGO';
      const aggKey = `${masterCode}___${colorName}___${sizeCode}`;

      if (!aggMap[aggKey]) {
        aggMap[aggKey] = {
          masterCode,
          nombre_producto: prodName,
          categoria: catName,
          product_id: st.product_id || null,
          totalStock: 0,
          warehousesSet: new Set(),
          linkedCodesSet: new Set(),
          colorName,
          sizeCode
        };
      }

      aggMap[aggKey].totalStock += Number(st.cantidad_disponible || 0);
      aggMap[aggKey].warehousesSet.add(whName);
      if (refCode && refCode !== masterCode) {
        aggMap[aggKey].linkedCodesSet.add(refCode);
      }
    });

    // Also include products from `products` master that might have 0 stock
    (products || []).forEach(p => {
      const refCode = (p.codigo_referencia || '').toUpperCase().trim();
      if (!refCode) return;
      const masterCode = activeHomologationsMap.get(refCode) || refCode;
      const aggKey = `${masterCode}___—___ST`;

      if (!aggMap[aggKey]) {
        aggMap[aggKey] = {
          masterCode,
          nombre_producto: p.nombre_producto || refCode,
          categoria: p.categoria || p.categories?.categoria || 'Sin Categoría',
          product_id: p.id,
          totalStock: 0,
          warehousesSet: new Set(['Sin Stock']),
          linkedCodesSet: new Set(),
          colorName: '—',
          sizeCode: 'ST'
        };
      }
    });

    return Object.values(aggMap);
  }, [stock, products, activeHomologationsMap]);

  // Check if current search query matches an old/homologated code
  const searchedHomologatedNotice = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const term = searchQuery.trim().toUpperCase();
    const activeH = (homologations || []).find(
      h => h.status === 'Activo' && h.source_code.toUpperCase().trim() === term
    );
    if (activeH) {
      return {
        sourceCode: activeH.source_code,
        masterCode: activeH.master_code
      };
    }
    return null;
  }, [searchQuery, homologations]);

  // Filtered Consolidated List
  const filteredConsolidatedList = useMemo(() => {
    return consolidatedInventoryList.filter(item => {
      const matchesCategory = !categoryFilter || item.categoria.toLowerCase() === categoryFilter.toLowerCase();
      const matchesWarehouse = !warehouseFilter || Array.from(item.warehousesSet).some(w => w.toLowerCase().includes(warehouseFilter.toLowerCase()));

      if (!searchQuery.trim()) return matchesCategory && matchesWarehouse;

      const term = searchQuery.trim().toLowerCase();
      const matchesCode = item.masterCode.toLowerCase().includes(term);
      const matchesName = item.nombre_producto.toLowerCase().includes(term);
      const matchesCat = item.categoria.toLowerCase().includes(term);
      const matchesColor = item.colorName.toLowerCase().includes(term);
      const matchesSize = item.sizeCode.toLowerCase().includes(term);
      const matchesLinked = Array.from(item.linkedCodesSet).some(c => c.toLowerCase().includes(term));

      return matchesCategory && matchesWarehouse && (matchesCode || matchesName || matchesCat || matchesColor || matchesSize || matchesLinked);
    });
  }, [consolidatedInventoryList, categoryFilter, warehouseFilter, searchQuery]);

  // KPI Calculations
  const totalMasterProductsCount = consolidatedInventoryList.length;
  const totalConsolidatedUnits = consolidatedInventoryList.reduce((sum, item) => sum + item.totalStock, 0);
  const totalActiveHomologationsCount = (homologations || []).filter(h => h.status === 'Activo').length;
  const pendingHomologationsCount = useMemo(() => {
    // Products with potential duplicates
    const namesSet = new Set<string>();
    let dupes = 0;
    products.forEach(p => {
      const nameNorm = (p.nombre_producto || '').trim().toUpperCase();
      if (nameNorm && namesSet.has(nameNorm)) {
        dupes++;
      } else if (nameNorm) {
        namesSet.add(nameNorm);
      }
    });
    return dupes;
  }, [products]);

  // Manual Homologation Handler
  const handleSaveManualHomologation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualSourceCode.trim() || !manualMasterCode.trim()) {
      return alert('Ingresa el Código Actual y el Código Maestro.');
    }
    if (manualSourceCode.trim().toUpperCase() === manualMasterCode.trim().toUpperCase()) {
      return alert('El Código Actual no puede ser idéntico al Código Maestro.');
    }

    setIsSavingManual(true);
    try {
      const sourceProd = products.find(p => p.codigo_referencia?.toUpperCase().trim() === manualSourceCode.trim().toUpperCase());
      const masterProd = products.find(p => p.codigo_referencia?.toUpperCase().trim() === manualMasterCode.trim().toUpperCase());

      const res = await fetch('/api/inventory/homologations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: user?.email || 'Sistema',
          actionType: 'CREACION_MANUAL',
          notes: manualNotes || 'Homologación manual',
          items: [{
            sourceCode: manualSourceCode.trim(),
            masterCode: manualMasterCode.trim(),
            sourceProductId: sourceProd?.id || null,
            masterProductId: masterProd?.id || null,
            matchPercentage: 100,
            matchType: 'manual',
            notes: manualNotes
          }]
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar homologación.');

      alert(`✅ Homologación guardada: ${manualSourceCode} ➔ ${manualMasterCode}`);
      setManualSourceCode('');
      setManualMasterCode('');
      setManualNotes('');
      await fetchHomologations();
      onRefreshData();
    } catch (err: any) {
      alert('❌ Error: ' + err.message);
    } finally {
      setIsSavingManual(false);
    }
  };

  // Revert Homologation Handler
  const handleRevertHomologation = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas revertir esta homologación? La relación quedará inactiva y los inventarios se consultarán por separado.')) return;

    try {
      const res = await fetch(`/api/inventory/homologations?id=${id}&userEmail=${encodeURIComponent(user?.email || 'Sistema')}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al revertir.');

      alert('✅ Homologación revertida con éxito.');
      await fetchHomologations();
      onRefreshData();
    } catch (err: any) {
      alert('❌ Error: ' + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
      {/* KPI Indicators Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
        {[
          { label: 'Total Productos Consolidados', value: `${totalMasterProductsCount} refs`, subText: 'Código Maestro', color: 'var(--primary)', icon: Package },
          { label: 'Total Unidades Consolidadas', value: `${totalConsolidatedUnits.toLocaleString()} uds`, subText: 'Existencia unificada', color: '#10b981', icon: TrendingUp },
          { label: 'Productos Homologated', value: `${totalActiveHomologationsCount} vínculos`, subText: 'Relaciones activas', color: '#6366f1', icon: GitMerge },
          { label: 'Posibles Duplicados', value: `${pendingHomologationsCount} refs`, subText: 'Nombres similares', color: '#f59e0b', icon: AlertTriangle }
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid #e2e8f0', borderRadius: '14px', backgroundColor: 'white' }}>
            <div style={{ padding: '0.65rem', backgroundColor: `${k.color}14`, color: k.color, borderRadius: '10px', flexShrink: 0 }}>
              <k.icon size={22} />
            </div>
            <div>
              <p style={{ fontSize: '0.68rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>{k.label}</p>
              <h3 style={{ fontSize: '1.3rem', fontWeight: '950', margin: '0.15rem 0', color: '#0f172a' }}>{k.value}</h3>
              <p style={{ fontSize: '0.7rem', color: '#64748b', margin: 0 }}>{k.subText}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Submodule Navigation Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '14px',
        border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '1rem'
      }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { id: 'consolidated', label: '📦 Vista Consolidada General', icon: Layers },
            { id: 'wizard', label: '🔄 Cruzar y Consolidar Inventarios', icon: GitMerge },
            { id: 'homologation_engine', label: '⚡ Motor / Homologación Manual', icon: ShieldCheck },
            { id: 'history', label: '📜 Historial de Auditoría', icon: History }
          ].map(st => (
            <button
              key={st.id}
              onClick={() => setSubTab(st.id as any)}
              className="btn"
              style={{
                padding: '0.55rem 1rem', fontSize: '0.82rem', fontWeight: '800', borderRadius: '10px',
                backgroundColor: subTab === st.id ? 'var(--primary)' : 'white',
                color: subTab === st.id ? 'white' : '#475569',
                border: subTab === st.id ? 'none' : '1px solid #cbd5e1',
                boxShadow: subTab === st.id ? '0 4px 10px rgba(128,8,46,0.25)' : 'none',
                display: 'flex', alignItems: 'center', gap: '0.4rem'
              }}
            >
              {st.label}
            </button>
          ))}
        </div>

        {/* Action Button: Import Massively */}
        <button
          onClick={() => setShowBulkImportModal(true)}
          className="btn btn-secondary"
          style={{ padding: '0.55rem 1rem', fontSize: '0.8rem', fontWeight: '800', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <FileSpreadsheet size={16} style={{ color: '#10b981' }} /> Importar Masivo CSV/Excel
        </button>
      </div>

      {/* SUBTAB 1: VISTA CONSOLIDADA (INVENTARIO GENERAL) */}
      {subTab === 'consolidated' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Smart Search & Filters Bar */}
          <div className="card" style={{ padding: '1rem 1.25rem', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', backgroundColor: 'white' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
              <Search size={18} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Búsqueda Inteligente (Código Maestro, Código Anterior, SKU, Referencia, Nombre, Talla, Color)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.85rem 0.65rem 2.4rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', fontWeight: '600' }}
              />
            </div>

            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              style={{ padding: '0.65rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', fontWeight: '700', backgroundColor: 'white' }}
            >
              <option value="">Todas las Categorías</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.categoria}>{c.categoria}</option>
              ))}
            </select>

            <select
              value={warehouseFilter}
              onChange={e => setWarehouseFilter(e.target.value)}
              style={{ padding: '0.65rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', fontWeight: '700', backgroundColor: 'white' }}
            >
              <option value="">Todas las Bodegas</option>
              {warehouses.map((w: any) => (
                <option key={w.id} value={w.nombre_bodega}>{w.nombre_bodega}</option>
              ))}
            </select>
          </div>

          {/* Smart Homologation Notice Banner */}
          {searchedHomologatedNotice && (
            <div style={{
              backgroundColor: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '12px',
              padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#1e40af'
            }}>
              <Info size={20} style={{ flexShrink: 0, color: '#3b82f6' }} />
              <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>
                El código buscado <strong>{searchedHomologatedNotice.sourceCode}</strong> fue homologado con el Código Maestro <strong>{searchedHomologatedNotice.masterCode}</strong>.
              </div>
            </div>
          )}

          {/* Main Consolidated Inventory Table */}
          <div className="card" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem', textAlign: 'left' }}>
              <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', fontWeight: '800', color: '#475569' }}>
                <tr>
                  <th style={{ padding: '0.9rem 1.25rem' }}>Código Maestro</th>
                  <th style={{ padding: '0.9rem 1.25rem' }}>Producto</th>
                  <th style={{ padding: '0.9rem 1.25rem' }}>Categoría</th>
                  <th style={{ padding: '0.9rem 1.25rem', textAlign: 'center' }}>Color / Talla</th>
                  <th style={{ padding: '0.9rem 1.25rem', textAlign: 'right' }}>Stock Total Consolidado</th>
                  <th style={{ padding: '0.9rem 1.25rem' }}>Bodegas</th>
                  <th style={{ padding: '0.9rem 1.25rem', textAlign: 'center' }}>Códigos Vinculados</th>
                  <th style={{ padding: '0.9rem 1.25rem', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredConsolidatedList.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                      No se encontraron productos consolidados con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filteredConsolidatedList.map((item, idx) => {
                    const linkedCount = item.linkedCodesSet.size;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={{ padding: '0.9rem 1.25rem', fontWeight: '950', color: '#4f46e5' }}>
                          {item.masterCode}
                        </td>
                        <td style={{ padding: '0.9rem 1.25rem', fontWeight: '800', color: '#0f172a' }}>
                          {item.nombre_producto}
                        </td>
                        <td style={{ padding: '0.9rem 1.25rem', color: '#64748b' }}>
                          {item.categoria}
                        </td>
                        <td style={{ padding: '0.9rem 1.25rem', textAlign: 'center' }}>
                          <span style={{ backgroundColor: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '800', color: '#334155' }}>
                            {item.colorName} | {item.sizeCode}
                          </span>
                        </td>
                        <td style={{ padding: '0.9rem 1.25rem', textAlign: 'right', fontWeight: '950', fontSize: '1rem', color: item.totalStock > 0 ? '#059669' : '#94a3b8' }}>
                          {item.totalStock.toLocaleString()} uds
                        </td>
                        <td style={{ padding: '0.9rem 1.25rem', color: '#64748b', fontSize: '0.78rem' }}>
                          {Array.from(item.warehousesSet).join(', ') || 'Bodega Principal'}
                        </td>
                        <td style={{ padding: '0.9rem 1.25rem', textAlign: 'center' }}>
                          {linkedCount > 0 ? (
                            <span style={{ backgroundColor: '#ecfdf5', color: '#047857', fontWeight: '900', padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem' }}>
                              {linkedCount} vinculo(s)
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '0.9rem 1.25rem', textAlign: 'center' }}>
                          <button
                            onClick={() => setSelectedItemForTraceability(item)}
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: '800', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                          >
                            <Eye size={14} /> Ver Trazabilidad
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
      )}

      {/* SUBTAB 2: CRUZAR Y CONSOLIDAR INVENTARIOS (WIZARD 7 PASOS) */}
      {subTab === 'wizard' && (
        <ConsolidationWizard
          products={products}
          stock={stock}
          homologations={homologations}
          userEmail={user?.email || 'Sistema'}
          onCancel={() => setSubTab('consolidated')}
          onFinishSuccess={() => {
            fetchHomologations();
            onRefreshData();
            setSubTab('consolidated');
          }}
        />
      )}

      {/* SUBTAB 3: MOTOR DE HOMOLOGACIÓN / MANUAL */}
      {subTab === 'homologation_engine' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* Active Homologations List */}
          <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '950', color: '#0f172a', margin: 0 }}>
                  Motor de Homologación de Códigos
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                  Relaciones de homologación permanentes registradas en el sistema ({homologations.length})
                </p>
              </div>
            </div>

            <div style={{ maxHeight: '450px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: '800', color: '#475569', position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={{ padding: '0.75rem 1rem' }}>Código Actual</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Código Maestro</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Tipo / Coincidencia</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Estado</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {homologations.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                        No hay homologaciones registradas.
                      </td>
                    </tr>
                  ) : (
                    homologations.map((h: any) => (
                      <tr key={h.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.65rem 1rem', fontWeight: '800', color: '#4f46e5' }}>{h.source_code}</td>
                        <td style={{ padding: '0.65rem 1rem', fontWeight: '800', color: '#059669' }}>{h.master_code}</td>
                        <td style={{ padding: '0.65rem 1rem' }}>
                          <span style={{ backgroundColor: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '800' }}>
                            {h.match_type} ({h.match_percentage}%)
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 1rem' }}>
                          <span style={{
                            padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '900',
                            backgroundColor: h.status === 'Activo' ? '#ecfdf5' : '#fef2f2',
                            color: h.status === 'Activo' ? '#047857' : '#b91c1c'
                          }}>
                            {h.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>
                          {h.status === 'Activo' && (
                            <button
                              onClick={() => handleRevertHomologation(h.id)}
                              className="btn btn-secondary"
                              style={{ padding: '0.25rem 0.6rem', fontSize: '0.7rem', fontWeight: '800', color: '#ef4444', border: '1px solid #fca5a5' }}
                            >
                              <RotateCcw size={12} style={{ marginRight: '0.25rem' }} /> Revertir
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Form: Manual Homologation */}
          <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1.25rem', backgroundColor: 'white' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '950', color: '#0f172a', margin: 0 }}>
                Homologación Manual
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                Establecer relación permanente entre un código antiguo y uno maestro.
              </p>
            </div>

            <form onSubmit={handleSaveManualHomologation} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#334155', marginBottom: '0.25rem' }}>
                  Código Actual (Origen)
                </label>
                <input
                  type="text"
                  placeholder="Ej. CAM-001"
                  value={manualSourceCode}
                  onChange={e => setManualSourceCode(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', fontWeight: '700' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#334155', marginBottom: '0.25rem' }}>
                  Código Maestro (Destino)
                </label>
                <input
                  type="text"
                  placeholder="Ej. CAM-1001"
                  value={manualMasterCode}
                  onChange={e => setManualMasterCode(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', fontWeight: '700' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#334155', marginBottom: '0.25rem' }}>
                  Observaciones / Motivo
                </label>
                <textarea
                  placeholder="Ej. Cambio de código según catálogo 2026"
                  value={manualNotes}
                  onChange={e => setManualNotes(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.8rem', minHeight: '60px' }}
                />
              </div>

              <button
                type="submit"
                disabled={isSavingManual}
                className="btn btn-primary"
                style={{ padding: '0.75rem', fontWeight: '900', borderRadius: '10px', justifyContent: 'center' }}
              >
                {isSavingManual ? 'Guardando...' : '🔒 Registrar Homologación Manual'}
              </button>
            </form>
          </div>

        </div>
      )}

      {/* SUBTAB 4: HISTORIAL DE AUDITORÍA */}
      {subTab === 'history' && (
        <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '950', color: '#0f172a', margin: 0 }}>
              Historial de Auditoría y Cambios de Homologación
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
              Registro de trazabilidad sobre quién realizó cada homologación o reversión.
            </p>
          </div>

          <div style={{ maxHeight: '450px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
              <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: '800', color: '#475569', position: 'sticky', top: 0 }}>
                <tr>
                  <th style={{ padding: '0.75rem 1rem' }}>Fecha / Hora</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Acción</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Usuario</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Detalle del Cambio</th>
                </tr>
              </thead>
              <tbody>
                {homologationLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                      Sin registros en el historial.
                    </td>
                  </tr>
                ) : (
                  homologationLogs.map((log: any) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.65rem 1rem', color: '#64748b' }}>
                        {log.created_at ? new Date(log.created_at).toLocaleString('es-CO') : '—'}
                      </td>
                      <td style={{ padding: '0.65rem 1rem' }}>
                        <span style={{
                          padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '900',
                          backgroundColor: log.action === 'CREACION' ? '#ecfdf5' : log.action === 'REVERSION' ? '#fef2f2' : '#eef2ff',
                          color: log.action === 'CREACION' ? '#047857' : log.action === 'REVERSION' ? '#b91c1c' : '#4338ca'
                        }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 1rem', fontWeight: '800', color: '#334155' }}>
                        {log.user_email || 'Sistema'}
                      </td>
                      <td style={{ padding: '0.65rem 1rem', color: '#64748b' }}>
                        {JSON.stringify(log.details)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Traceability Modal */}
      {selectedItemForTraceability && (
        <HomologationTraceabilityModal
          item={selectedItemForTraceability}
          homologations={homologations}
          stock={stock}
          kardex={kardex}
          warehouses={warehouses}
          colors={colors}
          sizes={sizes}
          onClose={() => setSelectedItemForTraceability(null)}
        />
      )}

      {/* Bulk Import Modal */}
      {showBulkImportModal && (
        <BulkHomologationImportModal
          products={products}
          userEmail={user?.email || 'Sistema'}
          onClose={() => setShowBulkImportModal(false)}
          onSuccess={() => {
            setShowBulkImportModal(false);
            fetchHomologations();
            onRefreshData();
          }}
        />
      )}

    </div>
  );
}
