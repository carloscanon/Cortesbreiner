import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  AlertTriangle,
  Building2,
  Search,
  RefreshCw,
  CheckCircle2,
  RotateCcw,
  Layers,
  ArrowRight,
  Filter,
  Package,
  Barcode,
  Calendar,
  Eye,
  SlidersHorizontal,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileSpreadsheet
} from 'lucide-react';

interface RejectedGarmentsManagerProps {
  warehouses: any[];
  user: any;
  isAdmin: boolean;
  onRefreshData?: () => void;
}

const BODEGA_101_ID = '65797b78-39c1-4078-9475-80d7385823a6';

export default function RejectedGarmentsManager({
  warehouses,
  user,
  isAdmin,
  onRefreshData
}: RejectedGarmentsManagerProps) {
  const [loading, setLoading] = useState(false);
  const [garments, setGarments] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [referenceFilter, setReferenceFilter] = useState('all');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Pagination
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Destination warehouse for relocation
  const [targetWarehouseId, setTargetWarehouseId] = useState(BODEGA_101_ID);
  const [relocating, setRelocating] = useState(false);
  const [relocationResult, setRelocationResult] = useState<string | null>(null);

  // Distinct references list for filtering
  const [distinctReferences, setDistinctReferences] = useState<string[]>([]);

  // Fetch rejected garments
  const fetchRejectedGarments = async () => {
    setLoading(true);
    setRelocationResult(null);
    try {
      let query = supabase
        .from('individual_garments')
        .select('id, barcode, reference_name, color_name, size_code, status, warehouse_id, notes, defect_checklist, created_at, updated_at', { count: 'exact' })
        .eq('status', 'Rechazada')
        .order('updated_at', { ascending: false });

      if (searchQuery.trim()) {
        const q = searchQuery.trim();
        query = query.or(`barcode.ilike.%${q}%,reference_name.ilike.%${q}%,color_name.ilike.%${q}%,notes.ilike.%${q}%`);
      }

      if (referenceFilter !== 'all') {
        query = query.eq('reference_name', referenceFilter);
      }

      const from = page * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) {
        console.error('Error fetching rejected garments:', error);
      } else {
        setGarments(data || []);
        setTotalCount(count || 0);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch distinct references among rejected garments once
  const fetchDistinctReferences = async () => {
    try {
      const { data } = await supabase
        .from('individual_garments')
        .select('reference_name')
        .eq('status', 'Rechazada')
        .limit(10000);

      if (data) {
        const refs = Array.from(new Set(data.map(d => d.reference_name).filter(Boolean))) as string[];
        refs.sort((a, b) => a.localeCompare(b));
        setDistinctReferences(refs);
      }
    } catch (err) {
      console.warn('Error fetching distinct references:', err);
    }
  };

  useEffect(() => {
    fetchDistinctReferences();
  }, []);

  useEffect(() => {
    fetchRejectedGarments();
    // Clear selection on page or filter change
    setSelectedIds(new Set());
  }, [page, referenceFilter]);

  // Handle Search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchRejectedGarments();
  };

  // Toggle selection
  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAllCurrent = () => {
    if (selectedIds.size === garments.length && garments.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(garments.map(g => g.id)));
    }
  };

  // Relocate selected garments to Bodega 101 (or selected warehouse)
  const handleRelocateSelected = async () => {
    if (selectedIds.size === 0) {
      alert('Por favor selecciona al menos una prenda para reubicar.');
      return;
    }

    const targetWh = warehouses.find(w => w.id === targetWarehouseId) || { nombre_bodega: 'Bodega 101 Principal' };
    const confirmMsg = `¿Confirmas reubicar y APROBAR ${selectedIds.size} prendas seleccionadas hacia "${targetWh.nombre_bodega}"?\n\nLas prendas cambiarán su estado a "Aprobada", se les asignará la bodega de destino y quedarán disponibles para inventario y venta.`;
    
    if (!window.confirm(confirmMsg)) return;

    setRelocating(true);
    setRelocationResult(null);

    try {
      const idsArray = Array.from(selectedIds);
      const userIdentifier = user?.email || 'Administrador';
      const timestamp = new Date().toLocaleString('es-CO');

      // Update in batches of 100
      let updatedTotal = 0;
      for (let i = 0; i < idsArray.length; i += 100) {
        const batch = idsArray.slice(i, i + 100);
        const { error } = await supabase
          .from('individual_garments')
          .update({
            status: 'Aprobada',
            warehouse_id: targetWarehouseId,
            store_id: null,
            notes: `Reubicada a ${targetWh.nombre_bodega} por ${userIdentifier} (${timestamp})`,
            updated_at: new Date().toISOString()
          })
          .in('id', batch);

        if (error) {
          console.error('Error updating batch:', error);
          throw error;
        }
        updatedTotal += batch.length;
      }

      setRelocationResult(`✅ Se reubicaron y aprobaron exitosamente ${updatedTotal} prendas en "${targetWh.nombre_bodega}".`);
      setSelectedIds(new Set());
      await fetchRejectedGarments();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error('Error during relocation:', err);
      alert('Ocurrió un error al reubicar las prendas: ' + (err.message || 'Error desconocido'));
    } finally {
      setRelocating(false);
    }
  };

  // Relocate a single garment
  const handleRelocateSingle = async (garment: any) => {
    const targetWh = warehouses.find(w => w.id === targetWarehouseId) || { nombre_bodega: 'Bodega 101 Principal' };
    if (!window.confirm(`¿Reubicar prenda con código ${garment.barcode} (${garment.reference_name} ${garment.color_name || ''}) a "${targetWh.nombre_bodega}"?`)) {
      return;
    }

    setRelocating(true);
    try {
      const userIdentifier = user?.email || 'Administrador';
      const timestamp = new Date().toLocaleString('es-CO');

      const { error } = await supabase
        .from('individual_garments')
        .update({
          status: 'Aprobada',
          warehouse_id: targetWarehouseId,
          store_id: null,
          notes: `Reubicada individualmente a ${targetWh.nombre_bodega} por ${userIdentifier} (${timestamp})`,
          updated_at: new Date().toISOString()
        })
        .eq('id', garment.id);

      if (error) throw error;

      setRelocationResult(`✅ Prenda ${garment.barcode} reubicada exitosamente en "${targetWh.nombre_bodega}".`);
      await fetchRejectedGarments();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      alert('Error al reubicar la prenda: ' + (err.message || 'Error'));
    } finally {
      setRelocating(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 50%, #b91c1c 100%)',
        borderRadius: '16px',
        padding: '1.25rem 1.75rem',
        color: 'white',
        boxShadow: '0 10px 25px -5px rgba(185, 28, 28, 0.3)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)'
          }}>
            <AlertTriangle size={26} color="#fecaca" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '950', letterSpacing: '-0.02em' }}>
                Prendas en Estado Rechazado / Auditoría
              </h2>
              <span style={{
                backgroundColor: 'rgba(255, 255, 255, 0.25)',
                padding: '0.2rem 0.6rem',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: '900'
              }}>
                {totalCount.toLocaleString()} prendas
              </span>
            </div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: '#fee2e2' }}>
              Valida códigos observados (ej: 0081998987), faltantes de inventario o rechazos, y reubícalos en la <strong>Bodega 101 Principal</strong> para reintegrarlos al stock activo.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => fetchRejectedGarments()}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: 'white',
              borderRadius: '10px',
              padding: '0.6rem 1rem',
              fontSize: '0.82rem',
              fontWeight: '800',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Relocation Notification Result */}
      {relocationResult && (
        <div style={{
          backgroundColor: '#f0fdf4',
          border: '1.5px solid #86efac',
          borderRadius: '12px',
          padding: '0.9rem 1.25rem',
          color: '#166534',
          fontSize: '0.88rem',
          fontWeight: '800',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem'
        }}>
          <CheckCircle2 size={18} color="#16a34a" />
          <span>{relocationResult}</span>
        </div>
      )}

      {/* Filter and Action Controls Bar */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1.5px solid #e2e8f0',
        borderRadius: '14px',
        padding: '1rem 1.25rem',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
      }}>
        {/* Left: Search & Reference Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', position: 'relative', minWidth: '260px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Buscar por código de barras (ej. 81998987), ref, color..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem 0.55rem 2.2rem',
                border: '1.5px solid #cbd5e1',
                borderRadius: '10px',
                fontSize: '0.82rem',
                outline: 'none',
                backgroundColor: '#f8fafc'
              }}
            />
          </form>

          <select
            value={referenceFilter}
            onChange={(e) => {
              setReferenceFilter(e.target.value);
              setPage(0);
            }}
            style={{
              padding: '0.55rem 0.85rem',
              borderRadius: '10px',
              border: '1.5px solid #cbd5e1',
              backgroundColor: '#f8fafc',
              fontSize: '0.82rem',
              fontWeight: '700',
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            <option value="all">Todas las Referencias ({distinctReferences.length})</option>
            {distinctReferences.map(ref => (
              <option key={ref} value={ref}>{ref}</option>
            ))}
          </select>
        </div>

        {/* Right: Reubicar a Bodega 101 Action Box */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          backgroundColor: '#eff6ff',
          padding: '0.5rem 0.85rem',
          borderRadius: '12px',
          border: '1.5px solid #bfdbfe'
        }}>
          <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Building2 size={16} /> Reubicar en:
          </span>
          <select
            value={targetWarehouseId}
            onChange={(e) => setTargetWarehouseId(e.target.value)}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '8px',
              border: '1.5px solid #93c5fd',
              backgroundColor: 'white',
              fontSize: '0.8rem',
              fontWeight: '800',
              color: '#1e3a8a',
              cursor: 'pointer'
            }}
          >
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>
                {w.nombre_bodega} {w.id === BODEGA_101_ID ? '⭐ (Principal)' : ''}
              </option>
            ))}
          </select>

          <button
            onClick={handleRelocateSelected}
            disabled={relocating || selectedIds.size === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: selectedIds.size > 0 ? '#1d4ed8' : '#94a3b8',
              color: 'white',
              border: 'none',
              padding: '0.55rem 1.1rem',
              borderRadius: '10px',
              fontSize: '0.82rem',
              fontWeight: '900',
              cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed',
              boxShadow: selectedIds.size > 0 ? '0 4px 10px rgba(29, 78, 216, 0.3)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            {relocating ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Reubicando...
              </>
            ) : (
              <>
                <ArrowRight size={15} />
                Reubicar {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Garments Table */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        border: '1.5px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
      }}>
        <div style={{
          padding: '0.75rem 1.25rem',
          backgroundColor: '#f8fafc',
          borderBottom: '1.5px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.82rem',
          color: '#475569',
          fontWeight: '700'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              onClick={toggleSelectAllCurrent}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                color: '#1e293b',
                fontWeight: '800',
                fontSize: '0.82rem'
              }}
            >
              {selectedIds.size === garments.length && garments.length > 0 ? (
                <CheckSquare size={18} color="#1d4ed8" />
              ) : (
                <Square size={18} color="#94a3b8" />
              )}
              <span>Seleccionar todos en esta página ({garments.length})</span>
            </button>
            {selectedIds.size > 0 && (
              <span style={{
                backgroundColor: '#dbeafe',
                color: '#1e40af',
                padding: '0.15rem 0.55rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: '900'
              }}>
                {selectedIds.size} seleccionada{selectedIds.size > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div>
            Mostrando {totalCount === 0 ? 0 : page * pageSize + 1} - {Math.min((page + 1) * pageSize, totalCount)} de {totalCount.toLocaleString()} prendas
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 0.75rem auto', color: '#dc2626' }} />
            <p style={{ margin: 0, fontWeight: '700' }}>Cargando prendas observadas...</p>
          </div>
        ) : garments.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <CheckCircle2 size={36} color="#16a34a" style={{ margin: '0 auto 0.75rem auto' }} />
            <p style={{ margin: 0, fontWeight: '800', fontSize: '0.95rem', color: '#0f172a' }}>
              No se encontraron prendas con estado Rechazada
            </p>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
              Todas las prendas de esta referencia o búsqueda están activas o ya fueron reubicadas.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1', color: '#334155', fontWeight: '900' }}>
                  <th style={{ padding: '0.75rem 1rem', width: '40px' }}></th>
                  <th style={{ padding: '0.75rem 1rem' }}>Código de Barras</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Referencia</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Color</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Talla</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Estado Actual</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Motivo / Observación</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Ubicación Actual</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {garments.map((g) => {
                  const isSelected = selectedIds.has(g.id);
                  const whName = warehouses.find(w => w.id === g.warehouse_id)?.nombre_bodega || 'Sin Bodega Asignada';
                  return (
                    <tr
                      key={g.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                        transition: 'background-color 0.1s'
                      }}
                    >
                      <td style={{ padding: '0.65rem 1rem' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(g.id)}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                      </td>
                      <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace', fontWeight: '900', color: '#0f172a' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Barcode size={14} color="#64748b" />
                          <span>{g.barcode}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.65rem 1rem', fontWeight: '800', color: '#1e293b' }}>
                        {g.reference_name}
                      </td>
                      <td style={{ padding: '0.65rem 1rem', color: '#475569' }}>
                        {g.color_name || '—'}
                      </td>
                      <td style={{ padding: '0.65rem 1rem' }}>
                        <span style={{
                          backgroundColor: '#f1f5f9',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '6px',
                          fontWeight: '800',
                          fontSize: '0.75rem'
                        }}>
                          {g.size_code || 'ST'}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 1rem' }}>
                        <span style={{
                          backgroundColor: '#fee2e2',
                          color: '#b91c1c',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: '900',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}>
                          <AlertTriangle size={12} />
                          {g.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 1rem', color: '#64748b', maxWidth: '280px' }}>
                        <span title={g.notes || ''} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {g.notes || 'Faltante / Observación sin detalle'}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 1rem', color: '#475569', fontSize: '0.78rem' }}>
                        {whName}
                      </td>
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>
                        <button
                          onClick={() => handleRelocateSingle(g)}
                          disabled={relocating}
                          style={{
                            padding: '0.35rem 0.75rem',
                            backgroundColor: '#2563eb',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: '800',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                        >
                          <Building2 size={13} />
                          Reubicar a 101
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div style={{
            padding: '0.85rem 1.25rem',
            backgroundColor: '#f8fafc',
            borderTop: '1.5px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '700' }}>
              Página {page + 1} de {totalPages}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0 || loading}
                style={{
                  padding: '0.45rem 0.85rem',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '8px',
                  backgroundColor: page === 0 ? '#f1f5f9' : 'white',
                  color: page === 0 ? '#94a3b8' : '#334155',
                  cursor: page === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontSize: '0.8rem',
                  fontWeight: '800'
                }}
              >
                <ChevronLeft size={15} /> Anterior
              </button>

              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || loading}
                style={{
                  padding: '0.45rem 0.85rem',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '8px',
                  backgroundColor: page >= totalPages - 1 ? '#f1f5f9' : 'white',
                  color: page >= totalPages - 1 ? '#94a3b8' : '#334155',
                  cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontSize: '0.8rem',
                  fontWeight: '800'
                }}
              >
                Siguiente <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
