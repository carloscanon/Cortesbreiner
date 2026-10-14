import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck, BarChart3, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown,
  Building2, Package, RefreshCw, Plus, Eye, Play, DollarSign, FileText, Layers, AlertCircle, FileSpreadsheet, Trash2, CheckSquare,
  Search, Palette, Check, UploadCloud
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import AuditFlatFileReconcilerModal from './AuditFlatFileReconcilerModal';

interface AuditManagerDashboardProps {
  warehouses: any[];
  categories?: any[];
  user: any;
  profile: any;
  isAdmin?: boolean;
  onOpenScanner: (session: any) => void;
  onOpenReconciliation: (session: any) => void;
}

export default function AuditManagerDashboard({
  warehouses,
  categories = [],
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
  const [showFlatFileModal, setShowFlatFileModal] = useState(false);
  const [newLocationId, setNewLocationId] = useState('');
  const [newAuditType, setNewAuditType] = useState('Completo');
  const [newNotes, setNewNotes] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [categoriesList, setCategoriesList] = useState<any[]>(categories || []);
  const [isCreating, setIsCreating] = useState(false);

  // Search & Color Granularity States
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [selectedColorNames, setSelectedColorNames] = useState<string[]>([]);
  const [categoriesStockCounts, setCategoriesStockCounts] = useState<Record<string, number>>({});
  const [categoriesColorsMap, setCategoriesColorsMap] = useState<Record<string, Record<string, number>>>({});

  // Fetch categories from DB if not passed via props
  useEffect(() => {
    if (categories && categories.length > 0) {
      setCategoriesList(categories);
    } else {
      supabase.from('categories').select('*').then(res => {
        if (res.data) setCategoriesList(res.data);
      });
    }
  }, [categories]);

  // Compute category stock totals and colors dynamically for selected location when modal opens
  useEffect(() => {
    if (!showCreateModal) return;

    const fetchCategoryCounts = async () => {
      try {
        let countMap: Record<string, number> = {};
        let colorMap: Record<string, Record<string, number>> = {};

        // 1. Fetch individual garments count by category with pagination
        let garments: any[] = [];
        let page = 0;
        const pageSize = 1000;
        while (true) {
          let garmentsQuery = supabase
            .from('individual_garments')
            .select('reference_name, color_name')
            .eq('status', 'Aprobada')
            .not('warehouse_id', 'is', null);

          if (newLocationId && newLocationId !== 'all') {
            garmentsQuery = garmentsQuery.eq('warehouse_id', newLocationId);
          }

          const { data: chunk, error: gErr } = await garmentsQuery.range(page * pageSize, (page + 1) * pageSize - 1);
          if (gErr || !chunk || chunk.length === 0) break;
          garments = garments.concat(chunk);
          if (chunk.length < pageSize) break;
          page++;
        }

        // Fetch products & categories to map references
        const { data: prods } = await supabase
          .from('products')
          .select('id, codigo_referencia, nombre_producto, categoria, category_id, categories(categoria)');

        const stopWords = new Set(['top', 'body', 'tipo', 'linea', 'para', 'de', 'la', 'el', 'los', 'las', 'no', 'usar', 'saldo']);

        // Build list of category resolvers
        const catResolvers: { key: string; name: string; distinctWords: string[] }[] = [];
        (categoriesList || []).forEach((c: any) => {
          const catName = typeof c === 'string' ? c : (c.categoria || c.name || '');
          if (!catName) return;
          const distinctWords = catName.toLowerCase().split(/\s+/).filter((w: string) => w.length >= 3 && !stopWords.has(w));
          catResolvers.push({
            key: catName.toLowerCase().trim(),
            name: catName,
            distinctWords
          });
        });

        if (garments && garments.length > 0) {
          garments.forEach(g => {
            const refLower = (g.reference_name || '').toLowerCase().trim();
            if (!refLower) return;

            // Find matching category resolver
            let matchedKey = 'sin categoría';
            for (const cr of catResolvers) {
              if (cr.distinctWords.length > 0 && cr.distinctWords.every((w: string) => refLower.includes(w))) {
                matchedKey = cr.key;
                break;
              }
            }

            countMap[matchedKey] = (countMap[matchedKey] || 0) + 1;

            const colName = (g.color_name || 'SIN COLOR').trim().toUpperCase();
            if (!colorMap[matchedKey]) {
              colorMap[matchedKey] = {};
            }
            colorMap[matchedKey][colName] = (colorMap[matchedKey][colName] || 0) + 1;
          });
        }

        // 2. Fetch stock count from finished_goods_stock if not in garments
        let stockQuery = supabase
          .from('finished_goods_stock')
          .select('cantidad_disponible, products(nombre_producto, codigo_referencia, categoria, category_id, categories(categoria)), colors(nombre_color)');

        if (newLocationId && newLocationId !== 'all') {
          stockQuery = stockQuery.eq('warehouse_id', newLocationId);
        }

        const { data: stockItems } = await stockQuery;

        if (stockItems && stockItems.length > 0 && (!garments || garments.length === 0)) {
          stockItems.forEach((st: any) => {
            const qty = Number(st.cantidad_disponible || 0);
            if (qty <= 0) return;
            const prod = Array.isArray(st.products) ? st.products[0] : st.products;
            const catObj = Array.isArray(prod?.categories) ? prod?.categories[0] : prod?.categories;
            const catName = (catObj?.categoria || prod?.categoria || prod?.nombre_producto || 'Sin Categoría').trim();
            const key = catName.toLowerCase();
            countMap[key] = (countMap[key] || 0) + qty;

            const colObj = Array.isArray(st.colors) ? st.colors[0] : st.colors;
            const colName = (colObj?.nombre_color || 'SIN COLOR').trim().toUpperCase();
            if (!colorMap[key]) {
              colorMap[key] = {};
            }
            colorMap[key][colName] = (colorMap[key][colName] || 0) + qty;
          });
        }

        setCategoriesStockCounts(countMap);
        setCategoriesColorsMap(colorMap);
      } catch (err) {
        console.error('Error fetching category counts:', err);
      }
    };

    fetchCategoryCounts();
  }, [showCreateModal, newLocationId]);

  // Filtered categories based on search term
  const filteredCategoriesList = useMemo(() => {
    if (!categorySearchTerm.trim()) return categoriesList;
    const term = categorySearchTerm.toLowerCase().trim();
    return (categoriesList || []).filter((cat: any) => {
      const name = (typeof cat === 'string' ? cat : (cat.categoria || cat.name || cat.cod_categoria || '')).toLowerCase();
      return name.includes(term);
    });
  }, [categoriesList, categorySearchTerm]);

  // Compute available colors aggregated across all selected categories
  const availableColors = useMemo(() => {
    if (selectedCategoryIds.length === 0) return [];
    const colorAgg: Record<string, number> = {};
    selectedCategoryIds.forEach(catName => {
      const key = catName.toLowerCase().trim();
      const colorsForCat = categoriesColorsMap[key] || {};
      Object.entries(colorsForCat).forEach(([col, count]) => {
        colorAgg[col] = (colorAgg[col] || 0) + count;
      });
    });

    return Object.entries(colorAgg)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [selectedCategoryIds, categoriesColorsMap]);

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

    if ((newAuditType === 'Parcial' || newAuditType === 'Por Categoria') && selectedCategoryIds.length === 0) {
      return alert('Por favor selecciona al menos una categoría para la auditoría parcial.');
    }

    setIsCreating(true);
    try {
      const whObj = warehouses.find(w => w.id === newLocationId);
      const locationName = whObj?.nombre_bodega || whObj?.name || 'Ubicación Desconocida';

      const categoryNotes = selectedCategoryIds.length > 0
        ? `Auditoría Parcial por Categoría(s): ${selectedCategoryIds.join(', ')}`
        : `Auditoría ${newAuditType} en ${locationName}`;

      const colorNotes = selectedColorNames.length > 0
        ? ` | Color(es): ${selectedColorNames.join(', ')}`
        : '';

      const baseNotes = `${categoryNotes}${colorNotes}`;
      const payloadNotes = newNotes ? `${baseNotes} | ${newNotes}` : baseNotes;

      const res = await fetch('/api/inventory/audit/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: newLocationId,
          locationName,
          auditType: newAuditType,
          categories: selectedCategoryIds,
          colors: selectedColorNames,
          userEmail: user?.email || 'Sistema',
          notes: payloadNotes
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear la sesión.');

      alert(`✅ Sesión de Auditoría #${data.session.consecutive} creada exitosamente en ${locationName}`);
      setShowCreateModal(false);
      setNewLocationId('');
      setNewNotes('');
      setSelectedCategoryIds([]);
      setSelectedColorNames([]);
      setCategorySearchTerm('');
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

  const [consistencyData, setConsistencyData] = useState<any>(null);
  const [loadingConsistency, setLoadingConsistency] = useState(false);

  const fetchConsistencyData = async () => {
    setLoadingConsistency(true);
    try {
      const res = await fetch('/api/inventory/consistency-check');
      const data = await res.json();
      if (res.ok && data.success) {
        setConsistencyData(data);
      }
    } catch (err) {
      console.error('Error fetching inventory consistency data:', err);
    } finally {
      setLoadingConsistency(false);
    }
  };

  useEffect(() => {
    fetchConsistencyData();
  }, []);

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

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={fetchConsistencyData}
            className="btn btn-secondary"
            style={{ padding: '0.75rem 1rem', fontWeight: '850', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#1e293b', color: 'white', border: '1px solid #334155' }}
          >
            <RefreshCw size={16} className={loadingConsistency ? 'animate-spin' : ''} /> Diagnóstico
          </button>
          <button
            onClick={() => setShowFlatFileModal(true)}
            style={{
              padding: '0.75rem 1.25rem', fontWeight: '900', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem',
              backgroundColor: '#059669', color: 'white', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
            }}
          >
            <UploadCloud size={18} /> Conciliar con Archivo Plano
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
            style={{ padding: '0.75rem 1.5rem', fontWeight: '950', borderRadius: '12px', backgroundColor: '#6366f1', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Plus size={18} /> Nueva Sesión de Auditoría
          </button>
        </div>
      </div>

      {/* Indicador Semáforo de Consistencia de Inventario (Puntos 4, 9, 10 y 11) */}
      {consistencyData && (
        <div className="card" style={{
          padding: '1.25rem 1.5rem', borderRadius: '16px', border: `2px solid ${
            consistencyData.globalStatus === 'CONSISTENTE' ? '#10b981' :
            consistencyData.globalStatus === 'CON_DIFERENCIAS' ? '#f59e0b' : '#ef4444'
          }`,
          backgroundColor: consistencyData.globalStatus === 'CONSISTENTE' ? '#f0fdf4' :
            consistencyData.globalStatus === 'CON_DIFERENCIAS' ? '#fffbeb' : '#fef2f2',
          display: 'flex', flexDirection: 'column', gap: '0.75rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem' }}>
                {consistencyData.globalStatus === 'CONSISTENTE' ? '🟢' :
                 consistencyData.globalStatus === 'CON_DIFERENCIAS' ? '🟡' : '🔴'}
              </span>
              <div>
                <span style={{ fontSize: '0.7rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>
                  ESTADO GLOBAL DE CONSISTENCIA DE INVENTARIO
                </span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: '950', margin: 0, color: '#0f172a' }}>
                  {consistencyData.globalStatus === 'CONSISTENTE' ? 'INVENTARIO CONSISTENTE' :
                   consistencyData.globalStatus === 'CON_DIFERENCIAS' ? 'INVENTARIO CON TRASLADOS EN TRÁNSITO' : 'INCONSISTENCIA DETECTADA'}
                </h3>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', display: 'block' }}>TRASLADOS PENDIENTES</span>
                <strong style={{ fontSize: '1rem', fontWeight: '900', color: '#0f172a' }}>
                  {consistencyData.totalPendingTransfers} ({consistencyData.totalPendingTransferUnits} Uds en Tránsito)
                </strong>
              </div>
            </div>
          </div>

          {consistencyData.issuesList && consistencyData.issuesList.length > 0 && (
            <div style={{ backgroundColor: 'rgba(255,255,255,0.7)', padding: '0.65rem 0.85rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: '700', color: '#334155' }}>
              <strong style={{ color: '#0f172a' }}>Detalle de Reglas y Alertas:</strong>
              <ul style={{ margin: '0.3rem 0 0 1.2rem', padding: 0 }}>
                {consistencyData.issuesList.map((issue: string, idx: number) => (
                  <li key={idx}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

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
                  <th style={{ padding: '0.85rem 1rem' }}>Fecha</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Ubicación</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Tipo / Categoría</th>
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
                    <td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                      No se encontraron auditorías con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  sessions.map(s => {
                    const rate = s.reconciliation_rate ?? 100;
                    const semaforoColor = rate >= 98 ? '#10b981' : rate >= 90 ? '#f59e0b' : '#ef4444';
                    const semaforoLabel = rate >= 98 ? '🟢 Conciliado' : rate >= 90 ? '🟡 Diferencia Menor' : '🔴 Crítico';
                    let categoryTag: string | null = null;
                    let colorTag: string | null = null;

                    if (s.notes) {
                      if (s.notes.match(/categor[ií]a\(s\):/i)) {
                        const afterCat = s.notes.split(/categor[ií]a\(s\):/i)[1] || '';
                        categoryTag = afterCat.split(/\||\n/)[0]?.trim() || null;
                      }
                      if (s.notes.match(/color\(es\):|colores:/i)) {
                        const afterCol = s.notes.split(/color\(es\):|colores:/i)[1] || '';
                        colorTag = afterCol.split(/\||\n/)[0]?.trim() || null;
                      }
                    }

                    const formattedDate = s.created_at
                      ? new Date(s.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
                        ' ' +
                        new Date(s.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })
                      : '—';

                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: '950', color: 'var(--primary)' }}>
                          #{s.consecutive}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontSize: '0.75rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                          📅 {formattedDate}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: '800', color: '#0f172a' }}>
                          {s.location_name}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: '#475569' }}>
                          <div style={{ fontWeight: '800' }}>{s.audit_type}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.2rem' }}>
                            {categoryTag && (
                              <span style={{
                                fontSize: '0.68rem',
                                fontWeight: '900',
                                color: '#4338ca',
                                backgroundColor: '#e0e7ff',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '6px',
                                display: 'inline-block'
                              }}>
                                🏷️ {categoryTag}
                              </span>
                            )}
                            {colorTag && (
                              <span style={{
                                fontSize: '0.68rem',
                                fontWeight: '900',
                                color: '#047857',
                                backgroundColor: '#ecfdf5',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '6px',
                                display: 'inline-block',
                                border: '1px solid #a7f3d0'
                              }}>
                                🎨 {colorTag}
                              </span>
                            )}
                          </div>
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
            width: '100%', maxWidth: '580px', maxHeight: '92vh', overflowY: 'auto', backgroundColor: 'white', borderRadius: '20px',
            padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem'
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
                  onChange={e => {
                    setNewLocationId(e.target.value);
                    setSelectedCategoryIds([]);
                    setSelectedColorNames([]);
                  }}
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
                  <option value="Parcial">Inventario Parcial (por Categoría)</option>
                  <option value="Por Categoria">Por Categoría</option>
                  <option value="Por Referencia">Por Referencia</option>
                  <option value="Muestreo">Muestreo Aleatorio</option>
                  <option value="Ciclico">Auditoría Cíclica</option>
                </select>
              </div>

              {/* SELECCIONADOR DE CATEGORÍAS Y GRANULARIDAD POR COLOR */}
              {(newAuditType === 'Parcial' || newAuditType === 'Por Categoria') && (
                <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '14px', border: '1.5px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: '900', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      📁 Categoría(s) a Auditar *
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {selectedCategoryIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategoryIds([]);
                            setSelectedColorNames([]);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            fontSize: '0.72rem',
                            fontWeight: '800',
                            cursor: 'pointer',
                            padding: '0.1rem 0.3rem'
                          }}
                        >
                          Limpiar
                        </button>
                      )}
                      <span style={{ fontSize: '0.72rem', color: '#6366f1', fontWeight: '800', backgroundColor: '#e0e7ff', padding: '0.15rem 0.5rem', borderRadius: '6px' }}>
                        {selectedCategoryIds.length} seleccionada(s)
                      </span>
                    </div>
                  </div>

                  {/* BUSCADOR DE CATEGORÍA */}
                  <div style={{ position: 'relative' }}>
                    <Search size={15} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Buscar categoría (ej. Lassie, Manga, Falda, Capri...)"
                      value={categorySearchTerm}
                      onChange={e => setCategorySearchTerm(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem 0.5rem 2.1rem',
                        paddingRight: categorySearchTerm ? '2rem' : '0.75rem',
                        borderRadius: '8px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        outline: 'none',
                        backgroundColor: 'white'
                      }}
                    />
                    {categorySearchTerm && (
                      <button
                        type="button"
                        onClick={() => setCategorySearchTerm('')}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: 'bold',
                          padding: '0.1rem 0.3rem'
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* LISTADO DE CATEGORÍAS */}
                  <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem', paddingRight: '0.3rem' }}>
                    {filteredCategoriesList.length === 0 ? (
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center', padding: '0.75rem 0', fontStyle: 'italic' }}>
                        {categorySearchTerm ? 'No se encontraron categorías que coincidan con la búsqueda.' : 'Cargando categorías...'}
                      </div>
                    ) : (
                      filteredCategoriesList.map((cat: any) => {
                        let catName = 'Categoría';
                        if (typeof cat === 'string') {
                          catName = cat;
                        } else if (cat && typeof cat === 'object') {
                          if (typeof cat.categoria === 'string') catName = cat.categoria;
                          else if (typeof cat.name === 'string') catName = cat.name;
                          else if (typeof cat.cod_categoria === 'string') catName = cat.cod_categoria;
                          else if (cat.id) catName = String(cat.id);
                        }

                        // Calculate total products in category for selected warehouse
                        const totalUnitsInCat = (categoriesStockCounts && categoriesStockCounts[catName.toLowerCase()]) || 0;
                        const isSelected = selectedCategoryIds.includes(catName);

                        return (
                          <label
                            key={typeof cat === 'object' && cat?.id ? cat.id : catName}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '0.8rem',
                              fontWeight: '700',
                              color: isSelected ? '#3730a3' : '#334155',
                              cursor: 'pointer',
                              padding: '0.35rem 0.65rem',
                              borderRadius: '8px',
                              backgroundColor: isSelected ? '#e0e7ff' : 'white',
                              border: `1px solid ${isSelected ? '#818cf8' : '#cbd5e1'}`,
                              transition: 'all 0.15s'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setSelectedCategoryIds([...selectedCategoryIds, catName]);
                                  } else {
                                    setSelectedCategoryIds(selectedCategoryIds.filter(c => c !== catName));
                                  }
                                }}
                                style={{ accentColor: '#6366f1', width: '15px', height: '15px', cursor: 'pointer' }}
                              />
                              <span>📁 {catName}</span>
                            </div>
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: '900',
                              padding: '0.12rem 0.45rem',
                              borderRadius: '6px',
                              backgroundColor: isSelected ? '#4f46e5' : '#f1f5f9',
                              color: isSelected ? 'white' : '#64748b'
                            }}>
                              {totalUnitsInCat.toLocaleString()} Uds
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>

                  {/* GRANULARIDAD POR COLOR (CUANDO HAY CATEGORÍAS SELECCIONADAS) */}
                  {selectedCategoryIds.length > 0 && (
                    <div style={{
                      backgroundColor: 'white',
                      padding: '0.85rem',
                      borderRadius: '12px',
                      border: '1.5px solid #cbd5e1',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.6rem',
                      marginTop: '0.25rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: '900', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Palette size={14} style={{ color: '#6366f1' }} /> Filtrar por Color (Granularidad)
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '700' }}>
                            {selectedColorNames.length === 0
                              ? '(Todos los colores)'
                              : `(${selectedColorNames.length} seleccionado${selectedColorNames.length > 1 ? 's' : ''})`}
                          </span>
                        </div>

                        {availableColors.length > 0 && (
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <button
                              type="button"
                              onClick={() => setSelectedColorNames(availableColors.map(c => c.name))}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#4f46e5',
                                fontSize: '0.72rem',
                                fontWeight: '800',
                                cursor: 'pointer',
                                padding: '0.1rem 0.3rem'
                              }}
                            >
                              Todos
                            </button>
                            {selectedColorNames.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setSelectedColorNames([])}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#dc2626',
                                  fontSize: '0.72rem',
                                  fontWeight: '800',
                                  cursor: 'pointer',
                                  padding: '0.1rem 0.3rem'
                                }}
                              >
                                Limpiar
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {availableColors.length === 0 ? (
                        <div style={{ fontSize: '0.73rem', color: '#94a3b8', fontStyle: 'italic' }}>
                          No se detectaron colores individuales en la bodega. Se auditarán todos los ítems de la categoría.
                        </div>
                      ) : (
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '0.35rem',
                          maxHeight: '110px',
                          overflowY: 'auto',
                          padding: '0.15rem'
                        }}>
                          {availableColors.map(col => {
                            const isColorSelected = selectedColorNames.includes(col.name);
                            return (
                              <button
                                type="button"
                                key={col.name}
                                onClick={() => {
                                  if (isColorSelected) {
                                    setSelectedColorNames(selectedColorNames.filter(c => c !== col.name));
                                  } else {
                                    setSelectedColorNames([...selectedColorNames, col.name]);
                                  }
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  padding: '0.25rem 0.55rem',
                                  borderRadius: '16px',
                                  fontSize: '0.72rem',
                                  fontWeight: '800',
                                  cursor: 'pointer',
                                  border: `1.5px solid ${isColorSelected ? '#4f46e5' : '#cbd5e1'}`,
                                  backgroundColor: isColorSelected ? '#e0e7ff' : '#f8fafc',
                                  color: isColorSelected ? '#3730a3' : '#334155',
                                  transition: 'all 0.15s'
                                }}
                              >
                                <span>{isColorSelected ? '✓ ' : ''}{col.name}</span>
                                <span style={{
                                  backgroundColor: isColorSelected ? '#4338ca' : '#e2e8f0',
                                  color: isColorSelected ? 'white' : '#64748b',
                                  padding: '0.05rem 0.35rem',
                                  borderRadius: '8px',
                                  fontSize: '0.65rem',
                                  fontWeight: '900'
                                }}>
                                  {col.count}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* RESUMEN DE ESPERADOS */}
                      <div style={{
                        fontSize: '0.73rem',
                        fontWeight: '700',
                        color: '#475569',
                        backgroundColor: '#f8fafc',
                        padding: '0.4rem 0.65rem',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span>Prendas esperadas con esta selección:</span>
                        <span style={{ fontWeight: '950', color: '#4f46e5' }}>
                          {selectedColorNames.length === 0
                            ? `${availableColors.reduce((sum, c) => sum + c.count, 0).toLocaleString()} Uds (Todos los colores)`
                            : `${availableColors.filter(c => selectedColorNames.includes(c.name)).reduce((sum, c) => sum + c.count, 0).toLocaleString()} Uds (${selectedColorNames.length} color${selectedColorNames.length > 1 ? 'es' : ''})`
                          }
                        </span>
                      </div>
                    </div>
                  )}

                </div>
              )}

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

      {/* Flat File Reconciliation Modal */}
      {showFlatFileModal && (
        <AuditFlatFileReconcilerModal
          warehouses={warehouses}
          categories={categoriesList}
          userEmail={user?.email || 'Sistema'}
          onClose={() => setShowFlatFileModal(false)}
          onSuccess={(newSession) => {
            setShowFlatFileModal(false);
            fetchAuditSessions();
            if (newSession) {
              onOpenReconciliation(newSession);
            }
          }}
        />
      )}

    </div>
  );
}
