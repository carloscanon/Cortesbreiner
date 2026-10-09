'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  AlertTriangle,
  Search,
  Filter,
  Download,
  Printer,
  RefreshCw,
  DollarSign,
  CheckCircle2,
  XCircle,
  Truck,
  Building2,
  Calendar,
  Layers,
  ArrowRightLeft,
  ChevronRight,
  ChevronLeft,
  Eye,
  SlidersHorizontal,
  X,
  Loader2,
  Tag,
  Factory
} from 'lucide-react';

const BODEGA_RECHAZOS_ID = '710e4d52-771c-4ca5-a24b-83ba1aa9dc04';

interface RejectedGarment {
  id: string;
  barcode: string;
  reference_name: string;
  color_name: string;
  size_code: string;
  status: string;
  defect_checklist: Record<string, any> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  order_id: string | null;
  sewing_order_id: string | null;
  quality_inspection_id: string | null;
  warehouse_id: string | null;
  sewing_orders?: {
    id: string;
    confeccion_code: string;
    workshop_id: string;
    cantidad_planeada: number;
    workshops?: {
      id: string;
      nombre_taller: string;
      responsable?: string;
      telefono?: string;
      desc_costuras?: number;
      desc_lavanderia?: number;
      desc_saldos?: number;
    };
  } | null;
  orders?: {
    id: string;
    consecutive: number;
    internal_code: string;
    client_name: string;
    brand: string;
  } | null;
  quality_inspections?: {
    id: string;
    items_inspected: number;
    items_approved: number;
    items_rejected: number;
    valor_prenda: number;
    descuento_defectos: number;
    valor_pagar: number;
    pago_status: string;
    status: string;
  } | null;
}

export default function RejectionsWarehousePage() {
  const { profile } = useAuth();
  const [garments, setGarments] = useState<RejectedGarment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedWorkshop, setSelectedWorkshop] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState('all');
  const [selectedDefect, setSelectedDefect] = useState('all');
  const [selectedLiquidationStatus, setSelectedLiquidationStatus] = useState('all');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // Pagination
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  // Selection for bulk actions
  const [selectedGarmentIds, setSelectedGarmentIds] = useState<string[]>([]);

  // Modals
  const [showLiquidationModal, setShowLiquidationModal] = useState(false);
  const [selectedOrderForLiquidation, setSelectedOrderForLiquidation] = useState<any>(null);
  const [liquidationData, setLiquidationData] = useState({
    valor_prenda: 3500,
    descuento_por_rechazo: 1000,
    notas_liquidacion: '',
    descuento_manual: 0,
  });
  const [savingLiquidation, setSavingLiquidation] = useState(false);

  const [showBarcodeModal, setShowBarcodeModal] = useState<RejectedGarment | null>(null);
  const [showStatusModal, setShowStatusModal] = useState<RejectedGarment[] | null>(null);
  const [newStatusTarget, setNewStatusTarget] = useState('En Bodega de Rechazos');
  const [savingStatus, setSavingStatus] = useState(false);

  // Fetch rejected garments
  const fetchGarments = async () => {
    setLoading(true);
    try {
      // 1. Fetch individual garments located in Bodega de Rechazos or with status Rechazada/Defectuoso
      const { data: gData, error: gErr } = await supabase
        .from('individual_garments')
        .select(`
          id, barcode, reference_name, color_name, size_code, status,
          defect_checklist, notes, created_at, updated_at, order_id,
          sewing_order_id, quality_inspection_id, warehouse_id
        `)
        .or(`warehouse_id.eq.${BODEGA_RECHAZOS_ID},status.in.(Rechazada,Rechazado,Reproceso,Defectuoso,Saldos)`)
        .order('created_at', { ascending: false });

      if (gErr) throw gErr;

      const rawGarments = gData || [];

      // 2. Fetch related sewing orders, workshops, orders, and quality inspections
      const sewingIds = Array.from(new Set(rawGarments.map(g => g.sewing_order_id).filter(Boolean)));
      const orderIds = Array.from(new Set(rawGarments.map(g => g.order_id).filter(Boolean)));
      const inspectionIds = Array.from(new Set(rawGarments.map(g => g.quality_inspection_id).filter(Boolean)));

      let sewingMap = new Map<string, any>();
      if (sewingIds.length > 0) {
        const { data: sData } = await supabase
          .from('sewing_orders')
          .select('id, confeccion_code, workshop_id, cantidad_planeada, workshops(id, nombre_taller, responsable, telefono, desc_costuras, desc_lavanderia, desc_saldos)')
          .in('id', sewingIds);
        (sData || []).forEach(s => sewingMap.set(s.id, s));
      }

      let orderMap = new Map<string, any>();
      if (orderIds.length > 0) {
        const { data: oData } = await supabase
          .from('orders')
          .select('id, consecutive, internal_code, client_name, brand')
          .in('id', orderIds);
        (oData || []).forEach(o => orderMap.set(o.id, o));
      }

      let inspectionMap = new Map<string, any>();
      if (inspectionIds.length > 0) {
        const { data: qData } = await supabase
          .from('quality_inspections')
          .select('id, items_inspected, items_approved, items_rejected, valor_prenda, descuento_defectos, valor_pagar, pago_status, status')
          .in('id', inspectionIds);
        (qData || []).forEach(q => inspectionMap.set(q.id, q));
      }

      // Merge data
      const merged: RejectedGarment[] = rawGarments.map(g => {
        const s = g.sewing_order_id ? sewingMap.get(g.sewing_order_id) : null;
        const o = g.order_id ? orderMap.get(g.order_id) : null;
        const q = g.quality_inspection_id ? inspectionMap.get(g.quality_inspection_id) : null;
        return {
          ...g,
          sewing_orders: s || null,
          orders: o || null,
          quality_inspections: q || null
        };
      });

      setGarments(merged);
    } catch (err: any) {
      console.error('Error al cargar prendas rechazadas:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchGarments();
  }, []);

  // List of unique workshops for filter
  const workshopsList = useMemo(() => {
    const map = new Map<string, string>();
    garments.forEach(g => {
      const w = g.sewing_orders?.workshops;
      if (w?.id && w?.nombre_taller) {
        map.set(w.id, w.nombre_taller);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [garments]);

  // List of unique orders for filter
  const ordersList = useMemo(() => {
    const map = new Map<string, string>();
    garments.forEach(g => {
      const code = g.sewing_orders?.confeccion_code || g.orders?.internal_code || (g.orders?.consecutive ? `OC-${g.orders.consecutive}` : '');
      const id = g.sewing_order_id || g.order_id;
      if (id && code) {
        map.set(id, code);
      }
    });
    return Array.from(map.entries()).map(([id, code]) => ({ id, code }));
  }, [garments]);

  // Filtered Garments
  const filteredGarments = useMemo(() => {
    return garments.filter(g => {
      // 1. Search Query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const barcode = (g.barcode || '').toLowerCase();
        const ref = (g.reference_name || '').toLowerCase();
        const color = (g.color_name || '').toLowerCase();
        const size = (g.size_code || '').toLowerCase();
        const confCode = (g.sewing_orders?.confeccion_code || '').toLowerCase();
        const intCode = (g.orders?.internal_code || '').toLowerCase();
        const consec = g.orders?.consecutive ? `oc-${g.orders.consecutive.toString().padStart(4, '0')}` : '';
        const workshop = (g.sewing_orders?.workshops?.nombre_taller || '').toLowerCase();
        const client = (g.orders?.client_name || '').toLowerCase();
        const notes = (g.notes || '').toLowerCase();

        const match = barcode.includes(q) ||
          ref.includes(q) ||
          color.includes(q) ||
          size.includes(q) ||
          confCode.includes(q) ||
          intCode.includes(q) ||
          consec.includes(q) ||
          workshop.includes(q) ||
          client.includes(q) ||
          notes.includes(q);

        if (!match) return false;
      }

      // 2. Workshop Filter
      if (selectedWorkshop !== 'all') {
        const wId = g.sewing_orders?.workshops?.id || g.sewing_orders?.workshop_id;
        if (String(wId) !== String(selectedWorkshop)) return false;
      }

      // 3. Order Filter
      if (selectedOrder !== 'all') {
        if (g.sewing_order_id !== selectedOrder && g.order_id !== selectedOrder) return false;
      }

      // 4. Defect Type Filter
      if (selectedDefect !== 'all') {
        const checklist = g.defect_checklist || {};
        const hasDefect = checklist[selectedDefect] || (g.notes && g.notes.toLowerCase().includes(selectedDefect.toLowerCase()));
        if (!hasDefect) return false;
      }

      // 5. Liquidation Status
      if (selectedLiquidationStatus !== 'all') {
        const pagoStatus = g.quality_inspections?.pago_status || 'Pendiente de aprobación financiera';
        if (selectedLiquidationStatus === 'liquidado' && pagoStatus !== 'Autorizado para Pago' && pagoStatus !== 'Pagado') return false;
        if (selectedLiquidationStatus === 'pendiente' && (pagoStatus === 'Autorizado para Pago' || pagoStatus === 'Pagado')) return false;
      }

      // 6. Date Range
      if (dateRange !== 'all' && g.created_at) {
        const gDate = new Date(g.created_at);
        const now = new Date();
        if (dateRange === 'today') {
          const isToday = gDate.getDate() === now.getDate() && gDate.getMonth() === now.getMonth() && gDate.getFullYear() === now.getFullYear();
          if (!isToday) return false;
        } else if (dateRange === 'week') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (gDate < weekAgo) return false;
        } else if (dateRange === 'month') {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (gDate < monthAgo) return false;
        }
      }

      return true;
    });
  }, [garments, search, selectedWorkshop, selectedOrder, selectedDefect, selectedLiquidationStatus, dateRange]);

  // Paginated Garments
  const paginatedGarments = useMemo(() => {
    const start = page * pageSize;
    return filteredGarments.slice(start, start + pageSize);
  }, [filteredGarments, page, pageSize]);

  const totalPages = Math.ceil(filteredGarments.length / pageSize);

  // KPIs
  const totalRejectedCount = filteredGarments.length;
  const uniqueWorkshopsCount = new Set(filteredGarments.map(g => g.sewing_orders?.workshops?.nombre_taller).filter(Boolean)).size;
  const uniqueOrdersCount = new Set(filteredGarments.map(g => g.sewing_orders?.confeccion_code || g.orders?.internal_code).filter(Boolean)).size;
  const pendingLiquidationCount = filteredGarments.filter(g => {
    const st = g.quality_inspections?.pago_status;
    return st !== 'Autorizado para Pago' && st !== 'Pagado';
  }).length;

  // Toggle selection
  const toggleSelectAll = () => {
    if (selectedGarmentIds.length === paginatedGarments.length) {
      setSelectedGarmentIds([]);
    } else {
      setSelectedGarmentIds(paginatedGarments.map(g => g.id));
    }
  };

  const toggleSelectGarment = (id: string) => {
    setSelectedGarmentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Open Liquidation Modal for a specific order or selection
  const handleOpenLiquidationForOrder = (orderInfo: any) => {
    setSelectedOrderForLiquidation(orderInfo);
    const w = orderInfo.workshops;
    const defaultValPrenda = orderInfo.quality_inspections?.valor_prenda || 3500;
    const defaultDescDefecto = w?.desc_costuras || w?.desc_saldos || 1000;

    setLiquidationData({
      valor_prenda: defaultValPrenda,
      descuento_por_rechazo: defaultDescDefecto,
      notas_liquidacion: `Liquidación por corte/confección con descuento por ${orderInfo.items_rejected || 0} prendas rechazadas.`,
      descuento_manual: 0
    });
    setShowLiquidationModal(true);
  };

  // Execute workshop order liquidation
  const handleConfirmLiquidation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForLiquidation) return;
    setSavingLiquidation(true);

    try {
      const soId = selectedOrderForLiquidation.sewing_order_id;
      const orderId = selectedOrderForLiquidation.order_id;
      const inspectionId = selectedOrderForLiquidation.quality_inspection_id;

      // Count approved and rejected garments for this order
      const orderGarments = garments.filter(g => g.sewing_order_id === soId || (orderId && g.order_id === orderId));
      const totalRejected = orderGarments.filter(g => g.status === 'Rechazada').length;
      
      // Calculate financial values
      const plannedQty = selectedOrderForLiquidation.cantidad_planeada || orderGarments.length || 0;
      const approvedQty = Math.max(0, plannedQty - totalRejected);
      const valPrenda = Number(liquidationData.valor_prenda) || 0;
      const descUnit = Number(liquidationData.descuento_por_rechazo) || 0;
      const descTotal = (totalRejected * descUnit) + (Number(liquidationData.descuento_manual) || 0);
      const subtotal = approvedQty * valPrenda;
      const valorPagar = Math.max(0, subtotal - descTotal);

      // 1. If inspection exists, update it. If not, create inspection record
      if (inspectionId) {
        await supabase.from('quality_inspections').update({
          valor_prenda: valPrenda,
          descuento_defectos: descTotal,
          valor_pagar: valorPagar,
          pago_status: 'Autorizado para Pago',
          notes: (selectedOrderForLiquidation.notes || '') + `\n[Liquidado en Bodega Rechazos] Desc: -$${descTotal.toLocaleString()} COP. Total Pago: $${valorPagar.toLocaleString()} COP.`
        }).eq('id', inspectionId);
      } else {
        const { data: newIns } = await supabase.from('quality_inspections').insert([{
          order_id: orderId,
          sewing_order_id: soId,
          workshop_name: selectedOrderForLiquidation.workshops?.nombre_taller || 'Taller Satélite',
          items_inspected: plannedQty,
          items_approved: approvedQty,
          items_rejected: totalRejected,
          valor_prenda: valPrenda,
          descuento_defectos: descTotal,
          valor_pagar: valorPagar,
          pago_status: 'Autorizado para Pago',
          status: 'Aprobado',
          notes: `Liquidado desde Bodega de Rechazos. Total pago: $${valorPagar.toLocaleString()} COP.`
        }]).select().single();

        if (newIns) {
          // Link garments to new inspection
          await supabase.from('individual_garments')
            .update({ quality_inspection_id: newIns.id })
            .in('id', orderGarments.map(g => g.id));
        }
      }

      // 2. Mark garments notes as audited
      await supabase.from('individual_garments')
        .update({
          notes: `[Liquidado a Taller] Sanción aplicada -$${descUnit}/ud. ${new Date().toLocaleDateString('es-CO')}`,
          updated_at: new Date().toISOString()
        })
        .in('id', orderGarments.filter(g => g.status === 'Rechazada').map(g => g.id));

      alert(`✅ Liquidación autorizada con éxito para el taller.\n\nPrendas Aprobadas: ${approvedQty} uds\nPrendas Rechazadas (Descuento): ${totalRejected} uds\nDescuento Total: -$${descTotal.toLocaleString('es-CO')} COP\nValor Neto a Pagar: $${valorPagar.toLocaleString('es-CO')} COP`);
      setShowLiquidationModal(false);
      fetchGarments();
    } catch (err: any) {
      alert('Error al liquidar orden: ' + err.message);
    } finally {
      setSavingLiquidation(false);
    }
  };

  // Bulk status update for garments in rejection warehouse
  const handleBulkStatusUpdate = async () => {
    if (!showStatusModal || showStatusModal.length === 0) return;
    setSavingStatus(true);
    try {
      const ids = showStatusModal.map(g => g.id);
      let targetWarehouse = BODEGA_RECHAZOS_ID;
      let targetStatus = 'Rechazada';

      if (newStatusTarget === 'Devuelto a Taller') {
        targetStatus = 'Reproceso';
      } else if (newStatusTarget === 'Dado de Baja') {
        targetStatus = 'Dado de Baja';
      } else if (newStatusTarget === 'Venta Segundas') {
        targetStatus = 'Saldos';
      }

      const { error } = await supabase.from('individual_garments')
        .update({
          status: targetStatus,
          warehouse_id: targetWarehouse,
          notes: `[Gestión Bodega Rechazos: ${newStatusTarget}] ${new Date().toLocaleDateString('es-CO')}`,
          updated_at: new Date().toISOString()
        })
        .in('id', ids);

      if (error) throw error;

      alert(`✓ Se actualizaron ${ids.length} prendas a estado "${newStatusTarget}".`);
      setShowStatusModal(null);
      setSelectedGarmentIds([]);
      fetchGarments();
    } catch (err: any) {
      alert('Error al actualizar estado: ' + err.message);
    } finally {
      setSavingStatus(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredGarments.length === 0) {
      alert('No hay prendas rechazadas para exportar.');
      return;
    }

    const headers = [
      'Código de Barras',
      'Orden Confección',
      'Consecutivo Corte',
      'Referencia Producto',
      'Color',
      'Talla',
      'Taller Satélite',
      'Fecha Rechazo',
      'Defectos Registrados',
      'Observaciones',
      'Estado Liquidación',
      'Bodega'
    ];

    const rows = filteredGarments.map(g => {
      const confCode = g.sewing_orders?.confeccion_code || g.orders?.internal_code || '—';
      const cutCode = g.orders?.consecutive ? `OC-${g.orders.consecutive.toString().padStart(4, '0')}` : '—';
      const workshop = g.sewing_orders?.workshops?.nombre_taller || '—';
      const dateStr = g.created_at ? new Date(g.created_at).toLocaleDateString('es-CO') : '—';
      
      const defectList = Object.entries(g.defect_checklist || {})
        .filter(([_, v]) => Boolean(v))
        .map(([k]) => k)
        .join(', ') || 'Sin especificar';

      const pagoSt = g.quality_inspections?.pago_status === 'Autorizado para Pago' ? 'Liquidado' : 'Pendiente';

      return [
        g.barcode,
        confCode,
        cutCode,
        g.reference_name,
        g.color_name,
        g.size_code,
        workshop,
        dateStr,
        `"${defectList}"`,
        `"${(g.notes || '').replace(/"/g, '""')}"`,
        pagoSt,
        'Bodega Rechazos'
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `reporte_bodega_rechazos_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '5rem' }}>
      
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Control WMS & Calidad
          </span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '950', margin: '0.25rem 0 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.5rem', backgroundColor: '#dc2626', borderRadius: '12px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={24} />
            </div>
            Bodega de Rechazos & Devoluciones
          </h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
            Inventario centralizado de prendas defectuosas, trazabilidad de fallas por taller y liquidación financiera.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => { setRefreshing(true); fetchGarments(); }}
            disabled={refreshing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', backgroundColor: 'white', color: '#334155', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer' }}
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Actualizando...' : 'Actualizar'}
          </button>

          <button
            onClick={handleExportCSV}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', backgroundColor: 'white', color: '#0f172a', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer' }}
          >
            <Download size={15} />
            Exportar CSV
          </button>

          <button
            onClick={() => window.print()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem', borderRadius: '10px', border: 'none', backgroundColor: '#0f172a', color: 'white', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer' }}
          >
            <Printer size={15} />
            Imprimir Manifiesto
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        
        {/* Total Rechazos */}
        <div className="card" style={{ padding: '1.25rem 1.5rem', borderRadius: '16px', border: '1.5px solid #fecaca', backgroundColor: '#fff5f5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '850', color: '#991b1b', textTransform: 'uppercase' }}>Total Prendas Rechazadas</span>
            <div style={{ padding: '0.35rem', borderRadius: '8px', backgroundColor: '#fee2e2', color: '#dc2626' }}><XCircle size={18} /></div>
          </div>
          <h3 style={{ fontSize: '1.85rem', fontWeight: '950', color: '#7f1d1d', margin: '0.5rem 0 0' }}>
            {totalRejectedCount.toLocaleString()}
          </h3>
          <span style={{ fontSize: '0.72rem', color: '#b91c1c', fontWeight: '700' }}>En Bodega de Rechazos</span>
        </div>

        {/* Talleres Satélite Afectados */}
        <div className="card" style={{ padding: '1.25rem 1.5rem', borderRadius: '16px', border: '1.5px solid #fed7aa', backgroundColor: '#fffaf5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '850', color: '#c2410c', textTransform: 'uppercase' }}>Talleres con Rechazos</span>
            <div style={{ padding: '0.35rem', borderRadius: '8px', backgroundColor: '#ffedd5', color: '#ea580c' }}><Factory size={18} /></div>
          </div>
          <h3 style={{ fontSize: '1.85rem', fontWeight: '950', color: '#9a3412', margin: '0.5rem 0 0' }}>
            {uniqueWorkshopsCount}
          </h3>
          <span style={{ fontSize: '0.72rem', color: '#c2410c', fontWeight: '700' }}>Satélites responsables</span>
        </div>

        {/* Lotes / Órdenes */}
        <div className="card" style={{ padding: '1.25rem 1.5rem', borderRadius: '16px', border: '1.5px solid #e2e8f0', backgroundColor: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '850', color: '#475569', textTransform: 'uppercase' }}>Lotes / Órdenes Afectadas</span>
            <div style={{ padding: '0.35rem', borderRadius: '8px', backgroundColor: '#f1f5f9', color: '#334155' }}><Layers size={18} /></div>
          </div>
          <h3 style={{ fontSize: '1.85rem', fontWeight: '950', color: '#0f172a', margin: '0.5rem 0 0' }}>
            {uniqueOrdersCount}
          </h3>
          <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '700' }}>Órdenes de producción</span>
        </div>

        {/* Pendientes de Liquidar */}
        <div className="card" style={{ padding: '1.25rem 1.5rem', borderRadius: '16px', border: '1.5px solid #fef08a', backgroundColor: '#fefce8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '850', color: '#854d0e', textTransform: 'uppercase' }}>Pendientes de Liquidar</span>
            <div style={{ padding: '0.35rem', borderRadius: '8px', backgroundColor: '#fef9c3', color: '#ca8a04' }}><DollarSign size={18} /></div>
          </div>
          <h3 style={{ fontSize: '1.85rem', fontWeight: '950', color: '#713f12', margin: '0.5rem 0 0' }}>
            {pendingLiquidationCount}
          </h3>
          <span style={{ fontSize: '0.72rem', color: '#854d0e', fontWeight: '700' }}>Prendas por conciliar sanción</span>
        </div>

      </div>

      {/* ── Filters & Search Bar ── */}
      <div className="card" style={{ padding: '1.25rem 1.5rem', borderRadius: '16px', backgroundColor: 'white', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'center' }}>
          
          {/* Search */}
          <div style={{ position: 'relative', gridColumn: 'span 2' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Buscar por código de barras, orden, taller, referencia, notas..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.4rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', outline: 'none' }}
            />
          </div>

          {/* Workshop Filter */}
          <div>
            <select
              value={selectedWorkshop}
              onChange={(e) => { setSelectedWorkshop(e.target.value); setPage(0); }}
              style={{ width: '100%', padding: '0.65rem 1rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.8rem', backgroundColor: '#f8fafc', fontWeight: '700', color: '#334155' }}
            >
              <option value="all">🏭 Todos los Talleres</option>
              {workshopsList.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          {/* Order Filter */}
          <div>
            <select
              value={selectedOrder}
              onChange={(e) => { setSelectedOrder(e.target.value); setPage(0); }}
              style={{ width: '100%', padding: '0.65rem 1rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.8rem', backgroundColor: '#f8fafc', fontWeight: '700', color: '#334155' }}
            >
              <option value="all">📦 Todas las Órdenes</option>
              {ordersList.map(o => (
                <option key={o.id} value={o.id}>{o.code}</option>
              ))}
            </select>
          </div>

          {/* Defect Filter */}
          <div>
            <select
              value={selectedDefect}
              onChange={(e) => { setSelectedDefect(e.target.value); setPage(0); }}
              style={{ width: '100%', padding: '0.65rem 1rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.8rem', backgroundColor: '#f8fafc', fontWeight: '700', color: '#334155' }}
            >
              <option value="all">⚠️ Todos los Defectos</option>
              <option value="costuras">Costuras / Descosido</option>
              <option value="mancha">Manchas de Aceite/Suciedad</option>
              <option value="roto">Roto / Picado</option>
              <option value="dobladillo">Dobladillo / Baste</option>
              <option value="medida">Fuera de Medida / Talla</option>
              <option value="tela">Defecto de Tela</option>
              <option value="lavanderia">Lavandería</option>
              <option value="saldos">Saldos</option>
            </select>
          </div>

          {/* Liquidation Status */}
          <div>
            <select
              value={selectedLiquidationStatus}
              onChange={(e) => { setSelectedLiquidationStatus(e.target.value); setPage(0); }}
              style={{ width: '100%', padding: '0.65rem 1rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.8rem', backgroundColor: '#f8fafc', fontWeight: '700', color: '#334155' }}
            >
              <option value="all">💵 Estado Liquidación: Todos</option>
              <option value="pendiente">⏳ Pendiente de Liquidar</option>
              <option value="liquidado">✅ Liquidado con Descuento</option>
            </select>
          </div>

          {/* Date Range */}
          <div>
            <select
              value={dateRange}
              onChange={(e: any) => { setDateRange(e.target.value); setPage(0); }}
              style={{ width: '100%', padding: '0.65rem 1rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.8rem', backgroundColor: '#f8fafc', fontWeight: '700', color: '#334155' }}
            >
              <option value="all">📅 Fecha: Histórico Completo</option>
              <option value="today">Hoy</option>
              <option value="week">Últimos 7 días</option>
              <option value="month">Últimos 30 días</option>
            </select>
          </div>

        </div>

        {/* Bulk Action Bar when items are selected */}
        {selectedGarmentIds.length > 0 && (
          <div style={{ marginTop: '1.25rem', padding: '0.75rem 1.25rem', backgroundColor: '#f1f5f9', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '850', color: '#0f172a' }}>
              ✓ {selectedGarmentIds.length} prendas seleccionadas
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setShowStatusModal(garments.filter(g => selectedGarmentIds.includes(g.id)))}
                style={{ padding: '0.45rem 0.9rem', borderRadius: '8px', border: 'none', backgroundColor: '#0f172a', color: 'white', fontSize: '0.75rem', fontWeight: '850', cursor: 'pointer' }}
              >
                Cambiar Destino / Estado
              </button>
              <button
                onClick={() => setSelectedGarmentIds([])}
                style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#64748b', fontSize: '0.75rem', fontWeight: '800', cursor: 'pointer' }}
              >
                Deseleccionar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Table of Rejected Garments ── */}
      <div className="card" style={{ padding: 0, borderRadius: '16px', backgroundColor: 'white', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                <th style={{ padding: '0.9rem 1rem', width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={paginatedGarments.length > 0 && selectedGarmentIds.length === paginatedGarments.length}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                  />
                </th>
                <th style={{ padding: '0.9rem 1rem', fontWeight: '900', textTransform: 'uppercase', fontSize: '0.7rem' }}>Código / Tag</th>
                <th style={{ padding: '0.9rem 1rem', fontWeight: '900', textTransform: 'uppercase', fontSize: '0.7rem' }}>Orden / Confección</th>
                <th style={{ padding: '0.9rem 1rem', fontWeight: '900', textTransform: 'uppercase', fontSize: '0.7rem' }}>Referencia & Color</th>
                <th style={{ padding: '0.9rem 1rem', fontWeight: '900', textTransform: 'uppercase', fontSize: '0.7rem' }}>Taller Responsable</th>
                <th style={{ padding: '0.9rem 1rem', fontWeight: '900', textTransform: 'uppercase', fontSize: '0.7rem' }}>Defectos Reportados</th>
                <th style={{ padding: '0.9rem 1rem', fontWeight: '900', textTransform: 'uppercase', fontSize: '0.7rem' }}>Fecha</th>
                <th style={{ padding: '0.9rem 1rem', fontWeight: '900', textTransform: 'uppercase', fontSize: '0.7rem' }}>Liquidación</th>
                <th style={{ padding: '0.9rem 1rem', textAlign: 'center', fontWeight: '900', textTransform: 'uppercase', fontSize: '0.7rem' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: '4rem 1rem', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                      <Loader2 className="animate-spin" size={28} style={{ color: '#dc2626' }} />
                      <span style={{ fontWeight: '750' }}>Cargando inventario de Bodega de Rechazos...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedGarments.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '4rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <CheckCircle2 size={36} style={{ color: '#10b981' }} />
                      <span style={{ fontWeight: '800', fontSize: '0.95rem', color: '#1e293b' }}>No se encontraron prendas rechazadas con los filtros seleccionados.</span>
                      <span style={{ fontSize: '0.8rem' }}>Todo el inventario está conforme o los filtros aplicados son muy restrictivos.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedGarments.map((g) => {
                  const confCode = g.sewing_orders?.confeccion_code || '—';
                  const cutCode = g.orders?.consecutive ? `OC-${g.orders.consecutive.toString().padStart(4, '0')}` : (g.orders?.internal_code || '—');
                  const workshopName = g.sewing_orders?.workshops?.nombre_taller || 'Taller No Asignado';
                  const isSelected = selectedGarmentIds.includes(g.id);

                  // Extract active defects from checklist
                  const defects = Object.entries(g.defect_checklist || {})
                    .filter(([_, v]) => Boolean(v))
                    .map(([k]) => k);

                  const isLiquidado = g.quality_inspections?.pago_status === 'Autorizado para Pago' || g.quality_inspections?.pago_status === 'Pagado';

                  return (
                    <tr
                      key={g.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: isSelected ? '#fef2f2' : 'transparent',
                        transition: 'background-color 0.15s'
                      }}
                    >
                      {/* Checkbox */}
                      <td style={{ padding: '1rem' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectGarment(g.id)}
                          style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                        />
                      </td>

                      {/* Barcode */}
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: '900', color: '#0f172a', fontSize: '0.88rem', letterSpacing: '0.04em' }}>
                            {g.barcode}
                          </span>
                          <button
                            onClick={() => setShowBarcodeModal(g)}
                            title="Ver / Reimprimir Etiqueta"
                            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}
                          >
                            <Tag size={14} />
                          </button>
                        </div>
                      </td>

                      {/* Order / Sewing code */}
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: '900', color: '#80082E', fontSize: '0.85rem' }}>
                            {confCode}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '750' }}>
                            {cutCode} {g.orders?.client_name ? `• ${g.orders.client_name}` : ''}
                          </span>
                        </div>
                      </td>

                      {/* Reference, Color, Size */}
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: '850', color: '#1e293b' }}>
                            {g.reference_name}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span>Talla: <strong>{g.size_code}</strong></span>
                            <span>•</span>
                            <span>Color: <strong>{g.color_name}</strong></span>
                          </span>
                        </div>
                      </td>

                      {/* Workshop */}
                      <td style={{ padding: '1rem' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.6rem', borderRadius: '8px', backgroundColor: '#f1f5f9', color: '#334155', fontWeight: '800', fontSize: '0.75rem' }}>
                          🏭 {workshopName}
                        </span>
                      </td>

                      {/* Defects Badges */}
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          {defects.length > 0 ? (
                            defects.map(d => (
                              <span key={d} style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem', borderRadius: '6px', backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: '850', border: '1px solid #fecaca' }}>
                                {d}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: '800' }}>
                              {g.notes || 'Rechazo general'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.75rem', fontWeight: '650' }}>
                        {g.created_at ? new Date(g.created_at).toLocaleDateString('es-CO') : '—'}
                      </td>

                      {/* Liquidation Status */}
                      <td style={{ padding: '1rem' }}>
                        {isLiquidado ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.6rem', borderRadius: '999px', backgroundColor: '#dcfce7', color: '#166534', fontWeight: '900', fontSize: '0.7rem', border: '1px solid #bbf7d0' }}>
                            ✓ Liquidado
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.6rem', borderRadius: '999px', backgroundColor: '#fef3c7', color: '#92400e', fontWeight: '900', fontSize: '0.7rem', border: '1px solid #fde68a' }}>
                            ⏳ Pendiente
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                          <button
                            onClick={() => {
                              handleOpenLiquidationForOrder({
                                sewing_order_id: g.sewing_order_id,
                                order_id: g.order_id,
                                quality_inspection_id: g.quality_inspection_id,
                                confeccion_code: confCode,
                                workshops: g.sewing_orders?.workshops,
                                cantidad_planeada: g.sewing_orders?.cantidad_planeada,
                                notes: g.notes,
                                items_rejected: 1
                              });
                            }}
                            title="Liquidar Orden del Taller"
                            style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: 'none', backgroundColor: '#10b981', color: 'white', fontSize: '0.72rem', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            <DollarSign size={13} /> Liquidar
                          </button>

                          <button
                            onClick={() => setShowStatusModal([g])}
                            title="Gestionar estado"
                            style={{ padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#475569', fontSize: '0.72rem', fontWeight: '800', cursor: 'pointer' }}
                          >
                            <ArrowRightLeft size={13} />
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

        {/* Pagination Bar */}
        <div style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '1rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '750' }}>
            Mostrando {paginatedGarments.length} de {filteredGarments.length} prendas rechazadas
          </span>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', backgroundColor: 'white', color: '#334155', fontSize: '0.75rem', fontWeight: '800', cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.5 : 1 }}
            >
              <ChevronLeft size={15} />
            </button>
            <span style={{ fontSize: '0.8rem', fontWeight: '850', color: '#0f172a' }}>
              Página {page + 1} de {totalPages || 1}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', backgroundColor: 'white', color: '#334155', fontSize: '0.75rem', fontWeight: '800', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', opacity: page >= totalPages - 1 ? 0.5 : 1 }}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Modal: Liquidar Orden a Taller ── */}
      {showLiquidationModal && selectedOrderForLiquidation && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', borderRadius: '20px', backgroundColor: 'white', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f1f5f9', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: '850', color: '#10b981', textTransform: 'uppercase' }}>Liquidación Financiera</span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '950', color: '#0f172a', margin: '0.15rem 0 0' }}>
                  💰 Liquidar Orden de Confección
                </h2>
              </div>
              <button onClick={() => setShowLiquidationModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmLiquidation} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Order and Workshop Info */}
              <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Orden:</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: '900', color: '#80082E' }}>{selectedOrderForLiquidation.confeccion_code}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Taller Satélite:</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: '900', color: '#0f172a' }}>{selectedOrderForLiquidation.workshops?.nombre_taller || 'Taller Satélite'}</span>
                </div>
              </div>

              {/* Pricing breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '850', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                    Tarifa Confección ($ COP / ud)
                  </label>
                  <input
                    type="number"
                    value={liquidationData.valor_prenda}
                    onChange={(e) => setLiquidationData({ ...liquidationData, valor_prenda: Number(e.target.value) })}
                    style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '800' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '850', color: '#991b1b', display: 'block', marginBottom: '0.35rem' }}>
                    Sanción Descuento ($ COP / rechazo)
                  </label>
                  <input
                    type="number"
                    value={liquidationData.descuento_por_rechazo}
                    onChange={(e) => setLiquidationData({ ...liquidationData, descuento_por_rechazo: Number(e.target.value) })}
                    style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1.5px solid #fecaca', fontSize: '0.85rem', fontWeight: '800', backgroundColor: '#fff5f5' }}
                    required
                  />
                </div>
              </div>

              {/* Additional discount */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: '850', color: '#64748b', display: 'block', marginBottom: '0.35rem' }}>
                  Descuento Adicional Global ($ COP)
                </label>
                <input
                  type="number"
                  value={liquidationData.descuento_manual}
                  onChange={(e) => setLiquidationData({ ...liquidationData, descuento_manual: Number(e.target.value) })}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>

              {/* Notes */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: '850', color: '#64748b', display: 'block', marginBottom: '0.35rem' }}>
                  Observaciones de Liquidación
                </label>
                <textarea
                  rows={2}
                  value={liquidationData.notas_liquidacion}
                  onChange={(e) => setLiquidationData({ ...liquidationData, notas_liquidacion: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.8rem', resize: 'vertical' }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowLiquidationModal(false)}
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', backgroundColor: 'white', color: '#475569', fontSize: '0.82rem', fontWeight: '850', cursor: 'pointer' }}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={savingLiquidation}
                  style={{ flex: 2, padding: '0.75rem', borderRadius: '10px', border: 'none', backgroundColor: '#10b981', color: 'white', fontSize: '0.85rem', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  {savingLiquidation ? <Loader2 size={16} className="animate-spin" /> : <DollarSign size={16} />}
                  {savingLiquidation ? 'Liquidando...' : 'Confirmar y Autorizar Pago'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Visualizar Tag de Código de Barras ── */}
      {showBarcodeModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '2rem', borderRadius: '20px', backgroundColor: 'white', textAlign: 'center' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '900', color: '#0f172a' }}>Etiqueta de Rechazo</h3>
              <button onClick={() => setShowBarcodeModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', border: '2px dashed #cbd5e1', borderRadius: '12px', backgroundColor: '#f8fafc', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: '850', color: '#dc2626', textTransform: 'uppercase' }}>BODEGA DE RECHAZOS</span>
              <h4 style={{ margin: '0.25rem 0', fontSize: '1.1rem', fontWeight: '950', color: '#0f172a' }}>{showBarcodeModal.reference_name}</h4>
              <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: '#475569' }}>
                Talla: <strong>{showBarcodeModal.size_code}</strong> | Color: <strong>{showBarcodeModal.color_name}</strong>
              </p>

              {/* Barcode representation */}
              <div style={{ fontFamily: '"Libre Barcode 128", "Libre Barcode 39", monospace', fontSize: '3rem', lineHeight: '1', color: '#0f172a', margin: '1rem 0 0.5rem' }}>
                *{showBarcodeModal.barcode}*
              </div>
              <span style={{ fontFamily: 'monospace', fontWeight: '900', fontSize: '1rem', letterSpacing: '0.1em', color: '#0f172a' }}>
                {showBarcodeModal.barcode}
              </span>
            </div>

            <button
              onClick={() => window.print()}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: 'none', backgroundColor: '#0f172a', color: 'white', fontWeight: '850', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              Imprimir Tag
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: Cambiar Estado / Destino ── */}
      {showStatusModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '450px', padding: '2rem', borderRadius: '20px', backgroundColor: 'white' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '950', color: '#0f172a' }}>
                Cambiar Destino de {showStatusModal.length} Prenda(s)
              </h3>
              <button onClick={() => setShowStatusModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: '800', color: '#334155' }}>
                Seleccione la acción o destino:
              </label>

              <select
                value={newStatusTarget}
                onChange={(e) => setNewStatusTarget(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '800' }}
              >
                <option value="En Bodega de Rechazos">En Bodega de Rechazos (Custodia)</option>
                <option value="Devuelto a Taller">Devolver a Taller para Reproceso</option>
                <option value="Dado de Baja">Dar de Baja / Descarte</option>
                <option value="Venta Segundas">Trasladar a Venta de Saldos / Segundas</option>
              </select>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowStatusModal(null)}
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', backgroundColor: 'white', color: '#475569', fontWeight: '800', cursor: 'pointer' }}
                >
                  Cancelar
                </button>

                <button
                  onClick={handleBulkStatusUpdate}
                  disabled={savingStatus}
                  style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: 'none', backgroundColor: '#0f172a', color: 'white', fontWeight: '900', cursor: 'pointer' }}
                >
                  {savingStatus ? 'Guardando...' : 'Aplicar Cambio'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
