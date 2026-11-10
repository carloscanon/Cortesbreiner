'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Download, Printer, Filter, Calendar, Search, RefreshCw, 
  CheckCircle2, XCircle, TrendingUp, ShoppingBag, DollarSign, 
  CreditCard, ChevronLeft, ChevronRight, FileSpreadsheet, Eye, X, Loader2,
  Store, Building2, RotateCcw,
  Banknote, QrCode, ArrowDownRight, ArrowUpRight, Wallet, CheckCircle, AlertCircle
} from 'lucide-react';

interface POSReportsManagerProps {
  salesLogs: any[];
  selectedStore?: any;
  stores?: any[];
  onSelectStore?: (store: any) => void;
  managerShifts?: any[];
  shiftsPage?: number;
  setShiftsPage?: React.Dispatch<React.SetStateAction<number>>;
  onRefreshSales?: () => void;
  supabase: any;
  title?: string;
  isStoreAdminView?: boolean;
}

export default function POSReportsManager({
  salesLogs = [],
  selectedStore: propSelectedStore,
  stores = [],
  onSelectStore,
  managerShifts = [],
  shiftsPage = 0,
  setShiftsPage,
  onRefreshSales,
  supabase,
  title,
  isStoreAdminView = false
}: POSReportsManagerProps) {
  // Store Selection State (if used in store-admin where user picks from all stores or 'all')
  const [internalStoreId, setInternalStoreId] = useState<string>(
    propSelectedStore?.id ? String(propSelectedStore.id) : (stores.length > 0 ? String(stores[0].id) : 'all')
  );

  useEffect(() => {
    if (propSelectedStore?.id) {
      setInternalStoreId(String(propSelectedStore.id));
    }
  }, [propSelectedStore]);

  const currentSelectedStore = useMemo(() => {
    if (propSelectedStore && !isStoreAdminView) return propSelectedStore;
    if (internalStoreId === 'all') return { id: 'all', nombre: 'Todas las Sucursales' };
    return stores.find(st => String(st.id) === String(internalStoreId)) || propSelectedStore || { id: 'pos', nombre: 'Punto de Venta' };
  }, [propSelectedStore, isStoreAdminView, internalStoreId, stores]);

  // Navigation Tabs inside Reports Module
  const [activeTab, setActiveTab] = useState<'detalle' | 'kpis' | 'turnos'>('detalle');

  // Filter States
  const todayStr = useMemo(() => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }), []);
  const [dateFilterMode, setDateFilterMode] = useState<'today' | 'custom' | 'all'>('today');
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [filterVendedor, setFilterVendedor] = useState<string>('all');
  const [filterPayment, setFilterPayment] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // UI States
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [isExportingCSV, setIsExportingCSV] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<any | null>(null);
  const [selectedShiftForModal, setSelectedShiftForModal] = useState<any | null>(null);
  const [shiftModalSales, setShiftModalSales] = useState<any[]>([]);
  const [shiftModalMovements, setShiftModalMovements] = useState<any[]>([]);
  const [loadingShiftSales, setLoadingShiftSales] = useState<boolean>(false);
  const [selectedSaleForCreditNote, setSelectedSaleForCreditNote] = useState<any | null>(null);
  const [creditNoteReason, setCreditNoteReason] = useState<string>('Devolución de prendas / Anulación POS');
  const [processingCreditNote, setProcessingCreditNote] = useState<boolean>(false);

  // Fetch sales and sold items for shift details modal
  useEffect(() => {
    if (!selectedShiftForModal?.id) {
      setShiftModalSales([]);
      return;
    }
    const fetchShiftData = async () => {
      setLoadingShiftSales(true);
      try {
        const { data, error } = await supabase
          .from('pos_sales')
          .select('*, stores(id, codigo, nombre), pos_sale_items(*, products(*), colors(*), sizes(*)), pos_payments(*)')
          .eq('session_id', selectedShiftForModal.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setShiftModalSales(data || []);
      } catch (e) {
        console.warn('Error fetching shift sales from supabase, using salesLogs fallback:', e);
        const fallback = salesLogs.filter(s => s.session_id === selectedShiftForModal.id);
        setShiftModalSales(fallback);
      } finally {
        setLoadingShiftSales(false);
      }
    };
    fetchShiftData();
  }, [selectedShiftForModal, supabase, salesLogs]);

  // Execute Credit Note
  const handleExecuteCreditNote = async () => {
    if (!selectedSaleForCreditNote) return;
    setProcessingCreditNote(true);
    try {
      const res = await fetch('/api/pos/credit-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saleId: selectedSaleForCreditNote.id,
          reason: creditNoteReason,
          userEmail: 'Administrador'
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al procesar la Nota Crédito');
      }
      alert(data.message || 'Nota Crédito procesada exitosamente.');
      setSelectedSaleForCreditNote(null);
      if (onRefreshSales) onRefreshSales();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setProcessingCreditNote(false);
    }
  };

  // Extract unique sellers/cashiers for filter dropdown
  const uniqueSellers = useMemo(() => {
    const set = new Set<string>();
    salesLogs.forEach(s => {
      const v = s.vendedor || s.usuario_apertura;
      if (v) set.add(String(v).trim());
    });
    return Array.from(set).sort();
  }, [salesLogs]);

  // Extract barcodes from sale observation [BARCODES: ...]
  const extractBarcodesFromSale = (sale: any): string[] => {
    if (!sale) return [];
    const bcs: string[] = [];
    if (sale.observaciones) {
      const match = sale.observaciones.match(/\[BARCODES:\s*([^\]]+)\]/i);
      if (match && match[1]) {
        match[1].split(',').forEach((x: string) => {
          const clean = x.trim();
          if (clean && !bcs.includes(clean)) bcs.push(clean);
        });
      }
    }
    return bcs;
  };

  // Filter sales list based on store & selected filters
  const filteredSales = useMemo(() => {
    return salesLogs.filter((s: any) => {
      // 0. Store Filter (if in Store Admin view)
      if (isStoreAdminView && internalStoreId !== 'all') {
        const sStoreId = String(s.store_id || s.stores?.id || '');
        if (sStoreId && sStoreId !== internalStoreId) return false;
      }

      // 1. Date filter
      if (s.created_at) {
        const saleDate = new Date(s.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
        if (dateFilterMode === 'today') {
          if (saleDate !== todayStr) return false;
        } else if (dateFilterMode === 'custom') {
          if (startDate && saleDate < startDate) return false;
          if (endDate && saleDate > endDate) return false;
        }
      }

      // 2. Status filter
      if (filterStatus !== 'all') {
        const status = (s.estado || 'completada').toLowerCase();
        if (filterStatus === 'anulada' && status !== 'anulada') return false;
        if (filterStatus === 'completada' && status === 'anulada') return false;
      }

      // 3. Seller filter
      if (filterVendedor !== 'all') {
        const v = (s.vendedor || s.usuario_apertura || '').trim();
        if (v !== filterVendedor) return false;
      }

      // 4. Payment method filter
      if (filterPayment !== 'all') {
        const payments = s.pos_payments || [];
        const payMethods = payments.map((p: any) => (p.metodo_pago || '').toLowerCase());
        const mainMethod = (s.metodo_pago || '').toLowerCase();
        const hasMethod = payMethods.some((m: string) => m.includes(filterPayment.toLowerCase())) ||
                          mainMethod.includes(filterPayment.toLowerCase());
        if (!hasMethod) return false;
      }

      // 5. Search query (Ticket, Customer, Document, Barcodes, Reference)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const ticketNum = String(s.consecutive || '');
        const stCode = (s.stores?.codigo || currentSelectedStore?.codigo || (s.stores?.nombre || currentSelectedStore?.nombre || 'POS').substring(0, 3)).toUpperCase();
        const ticketStr = `${stCode}-${ticketNum.padStart(4, '0')}`.toLowerCase();
        const clientName = (s.cliente_nombre || '').toLowerCase();
        const clientDoc = (s.cliente_identificacion || '').toLowerCase();
        const obs = (s.observaciones || '').toLowerCase();
        const items = s.items || s.pos_sale_items || [];
        const itemMatch = items.some((it: any) => {
          const pName = (it.products?.nombre_producto || it.nombre || '').toLowerCase();
          const pRef = (it.products?.codigo_referencia || '').toLowerCase();
          return pName.includes(q) || pRef.includes(q);
        });

        const matches = ticketNum.includes(q) || ticketStr.includes(q) || 
                        clientName.includes(q) || clientDoc.includes(q) || 
                        obs.includes(q) || itemMatch;
        if (!matches) return false;
      }

      return true;
    });
  }, [salesLogs, isStoreAdminView, internalStoreId, dateFilterMode, startDate, endDate, todayStr, filterStatus, filterVendedor, filterPayment, searchQuery, currentSelectedStore]);

  // Essential summary metrics calculated from filtered sales
  const summaryMetrics = useMemo(() => {
    const validSales = filteredSales.filter(s => s.estado !== 'anulada');
    const totalVendido = validSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
    const totalTx = validSales.length;
    const ticketPromedio = totalTx > 0 ? Math.round(totalVendido / totalTx) : 0;
    
    let totalPrendas = 0;
    let payEfectivo = 0;
    let payTarjeta = 0;
    let payTransferencia = 0;
    let payOtros = 0;

    validSales.forEach(s => {
      // Units sold
      const items = s.items || s.pos_sale_items || [];
      if (items.length > 0) {
        items.forEach((it: any) => {
          totalPrendas += Number(it.cantidad || 1);
        });
      } else {
        totalPrendas += 1;
      }

      // Payments breakdown
      const payments = s.pos_payments || [];
      if (payments.length > 0) {
        payments.forEach((p: any) => {
          const m = Number(p.monto || 0);
          const method = (p.metodo_pago || '').toLowerCase();
          if (method.includes('efectivo')) payEfectivo += m;
          else if (method.includes('tarjeta') || method.includes('datafono')) payTarjeta += m;
          else if (method.includes('transferencia')) payTransferencia += m;
          else payOtros += m;
        });
      } else {
        const m = Number(s.total || 0);
        const method = (s.metodo_pago || '').toLowerCase();
        if (method.includes('efectivo')) payEfectivo += m;
        else if (method.includes('tarjeta') || method.includes('datafono')) payTarjeta += m;
        else if (method.includes('transferencia')) payTransferencia += m;
        else payOtros += m;
      }
    });

    return {
      totalVendido,
      totalTx,
      ticketPromedio,
      totalPrendas,
      payEfectivo,
      payTarjeta,
      payTransferencia,
      payOtros
    };
  }, [filteredSales]);

  // Export to clean Excel/CSV file with essential control fields
  const handleExportCSV = async () => {
    try {
      setIsExportingCSV(true);
      if (filteredSales.length === 0) {
        alert('No hay ventas en la selección actual para exportar.');
        return;
      }

      // Pre-fetch catalog barcodes from individual_garments to populate any legacy items
      let catalogGarments: any[] = [];
      try {
        const { data: garms } = await supabase
          .from('individual_garments')
          .select('barcode, reference_name, color_name, size_code')
          .limit(10000);
        if (garms) catalogGarments = garms;
      } catch (eGarm) {
        console.warn('Garments lookup for export:', eGarm);
      }

      const headers = [
        'Ticket',
        'Fecha y Hora',
        'Punto de Venta',
        'Cajero / Vendedor',
        'Cliente',
        'Doc. Cliente',
        'Estado',
        'Método(s) de Pago',
        'Prenda / Referencia',
        'Color',
        'Talla',
        'Cant.',
        'Código de Barras / Serial',
        'Precio Unitario',
        'Subtotal',
        'Total Ticket'
      ];

      const rows: string[][] = [];

      filteredSales.forEach(sale => {
        const storeName = sale.stores?.nombre || currentSelectedStore?.nombre || 'Punto de Venta';
        const storeCode = (sale.stores?.codigo || currentSelectedStore?.codigo || (sale.stores?.nombre || currentSelectedStore?.nombre || 'POS').substring(0, 3)).toUpperCase();
        const ticket = `${storeCode}-${String(sale.consecutive || 0).padStart(4, '0')}`;
        const fechaHora = sale.created_at ? new Date(sale.created_at).toLocaleString('es-CO') : '-';
        const vendedor = sale.vendedor || sale.usuario_apertura || 'Vendedor';
        const cliente = sale.cliente_nombre || 'Cliente General';
        const docCliente = sale.cliente_identificacion || '222222222222';
        const estado = sale.estado || 'Completada';

        const paymentsStr = (sale.pos_payments && sale.pos_payments.length > 0)
          ? sale.pos_payments.map((p: any) => `${p.metodo_pago}: $${Number(p.monto || 0).toLocaleString('es-CO')}`).join(' | ')
          : (sale.metodo_pago || 'Efectivo');

        const saleBarcodes = extractBarcodesFromSale(sale);
        const items = sale.items || sale.pos_sale_items || [];

        if (items.length === 0) {
          rows.push([
            ticket,
            fechaHora,
            storeName,
            vendedor,
            cliente,
            docCliente,
            estado,
            paymentsStr,
            'Venta General',
            '-',
            '-',
            '1',
            saleBarcodes.join(', ') || '-',
            String(Number(sale.total) || 0),
            String(Number(sale.total) || 0),
            String(Number(sale.total) || 0)
          ]);
        } else {
          items.forEach((it: any, itIdx: number) => {
            const prodName = it.products?.nombre_producto || it.nombre || 'Prenda';
            const prodRef = it.products?.codigo_referencia || '';
            const colName = it.colors?.nombre_color || it.color || '-';
            const szName = it.sizes?.codigo_talla || it.talla || '-';
            const qty = Number(it.cantidad || 1);
            const unitPrice = Number(it.precio_unitario || (qty > 0 ? (Number(it.subtotal || it.total || 0) / qty) : 0));
            const subtotal = Number(it.subtotal || it.total || (unitPrice * qty));

            let itemBarcodes = '';
            if (saleBarcodes.length > 0) {
              if (items.length === 1) {
                itemBarcodes = saleBarcodes.join(', ');
              } else if (itIdx < saleBarcodes.length) {
                itemBarcodes = saleBarcodes[itIdx];
              } else {
                itemBarcodes = saleBarcodes.join(', ');
              }
            }

            if (!itemBarcodes && catalogGarments.length > 0) {
              const cleanRef = (prodRef || '').toLowerCase().trim();
              const cleanName = (prodName || '').toLowerCase().trim();
              const cUpper = colName.toUpperCase().trim();
              const sUpper = szName.toUpperCase().trim();

              const matches = catalogGarments.filter(cg => {
                const cgRef = (cg.reference_name || '').toLowerCase();
                const refOk = (cleanRef && cgRef.includes(cleanRef)) || (cleanName && cgRef.includes(cleanName));
                if (!refOk) return false;
                if (cUpper !== '-' && cUpper !== 'ÚNICO' && !((cg.color_name || '').toUpperCase().includes(cUpper))) return false;
                if (sUpper !== '-' && sUpper !== 'ÚNICA' && !((cg.size_code || '').toUpperCase().includes(sUpper))) return false;
                return true;
              });

              if (matches.length > 0) {
                itemBarcodes = matches.slice(0, Math.max(1, qty)).map(m => m.barcode).join(', ');
              } else if (prodRef && /^\d{4,}$/.test(prodRef.trim())) {
                itemBarcodes = prodRef.trim();
              }
            }

            rows.push([
              ticket,
              fechaHora,
              storeName,
              vendedor,
              cliente,
              docCliente,
              estado,
              paymentsStr,
              `${prodName}${prodRef ? ` (Ref: ${prodRef})` : ''}`,
              colName,
              szName,
              String(qty),
              itemBarcodes || '-',
              String(unitPrice),
              String(subtotal),
              String(Number(sale.total) || 0)
            ]);
          });
        }
      });

      const csvString = '\uFEFF' + [
        headers.map(h => `"${h.replace(/"/g, '""')}"`).join(';'),
        ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      ].join('\r\n');

      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateTag = dateFilterMode === 'today' ? `hoy_${todayStr}` : `${startDate}_a_${endDate}`;
      const storeTag = (currentSelectedStore?.nombre || 'pos').toLowerCase().replace(/\s+/g, '_');
      a.download = `control_ventas_${storeTag}_${dateTag}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error('Error al generar CSV:', e);
      alert('Error al generar CSV: ' + (e?.message || e));
    } finally {
      setIsExportingCSV(false);
    }
  };

  // Pagination for detailed table
  const PAGE_SIZE = 15;
  const paginatedSales = filteredSales.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filteredSales.length / PAGE_SIZE);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: isStoreAdminView ? '0.5rem 0' : '1.5rem', overflowY: 'auto', gap: '1.25rem', backgroundColor: isStoreAdminView ? 'transparent' : '#f8fafc' }} className="pos-scrollbar">
      
      {/* 1. Header with Title & Action Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.5rem' }}>📊</span>
            <h2 style={{ fontSize: '1.3rem', fontWeight: '950', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
              {title || 'Control y Discriminación de Ventas'}
            </h2>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.25rem 0 0' }}>
            Auditoría en tiempo real y cierre de caja para <strong>{currentSelectedStore?.nombre || 'Sucursal'}</strong>
          </p>
        </div>

        {/* Action Controls: Store Selector (if Admin) + Refresh + Excel + Master PDF */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.65rem' }}>
          
          {/* Store Selector (Visible in Store Admin view) */}
          {isStoreAdminView && stores.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'white', padding: '0.2rem 0.6rem', borderRadius: '10px', border: '1.5px solid #cbd5e1' }}>
              <Store size={14} color="#80082E" />
              <select
                value={internalStoreId}
                onChange={e => {
                  const newId = e.target.value;
                  setInternalStoreId(newId);
                  setCurrentPage(0);
                  if (onSelectStore) {
                    const st = stores.find(s => String(s.id) === newId);
                    if (st) onSelectStore(st);
                  }
                }}
                style={{
                  border: 'none',
                  outline: 'none',
                  fontSize: '0.78rem',
                  fontWeight: '900',
                  color: '#0f172a',
                  backgroundColor: 'transparent',
                  cursor: 'pointer'
                }}
              >
                <option value="all">🏢 Todas las Sucursales</option>
                {stores.map(st => (
                  <option key={st.id} value={st.id}>
                    📍 {st.nombre} ({st.ciudad || 'Colombia'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {onRefreshSales && (
            <button
              onClick={onRefreshSales}
              title="Refrescar ventas"
              style={{
                padding: '0.55rem 0.85rem',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
                backgroundColor: 'white',
                color: '#475569',
                fontWeight: '800',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <RefreshCw size={14} /> Refrescar
            </button>
          )}

          <button
            onClick={handleExportCSV}
            disabled={isExportingCSV || filteredSales.length === 0}
            style={{
              padding: '0.55rem 1rem',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: '#15803d',
              color: 'white',
              fontWeight: '850',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              cursor: isExportingCSV || filteredSales.length === 0 ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 6px rgba(21, 128, 61, 0.25)',
              opacity: isExportingCSV || filteredSales.length === 0 ? 0.6 : 1
            }}
          >
            {isExportingCSV ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
            <span>Exportar Excel (CSV)</span>
          </button>

          <button
            onClick={() => setShowPrintModal(true)}
            disabled={filteredSales.length === 0}
            style={{
              padding: '0.55rem 1.15rem',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: '#80082E',
              color: 'white',
              fontWeight: '900',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              cursor: filteredSales.length === 0 ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(128, 8, 46, 0.25)',
              opacity: filteredSales.length === 0 ? 0.6 : 1
            }}
          >
            <Printer size={15} />
            <span>Generar Informe PDF Master</span>
          </button>
        </div>
      </div>

      {/* 2. Top Executive KPI Summary Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.85rem' }}>
        
        {/* Total Facturado */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '1.15rem 1.25rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              TOTAL FACTURADO
            </span>
            <span style={{ backgroundColor: '#eff6ff', color: '#2563eb', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.65rem', fontWeight: '950' }}>
              {summaryMetrics.totalTx} ventas
            </span>
          </div>
          <h3 style={{ fontSize: '1.45rem', fontWeight: '950', color: '#1e3a8a', margin: '0.1rem 0' }}>
            ${summaryMetrics.totalVendido.toLocaleString('es-CO')}
          </h3>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '700' }}>
            Promedio: ${summaryMetrics.ticketPromedio.toLocaleString('es-CO')} / ticket
          </span>
        </div>

        {/* Prendas Vendidas */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '1.15rem 1.25rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              PRENDAS VENDIDAS
            </span>
            <span style={{ backgroundColor: '#fef3c7', color: '#b45309', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.65rem', fontWeight: '950' }}>
              Unidades
            </span>
          </div>
          <h3 style={{ fontSize: '1.45rem', fontWeight: '950', color: '#78350f', margin: '0.1rem 0' }}>
            {summaryMetrics.totalPrendas} <span style={{ fontSize: '0.9rem', fontWeight: '800' }}>uds</span>
          </h3>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '700' }}>
            {(summaryMetrics.totalTx > 0 ? (summaryMetrics.totalPrendas / summaryMetrics.totalTx).toFixed(1) : 0)} prendas / venta
          </span>
        </div>

        {/* Efectivo */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '1.15rem 1.25rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              💵 EFECTIVO
            </span>
            <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#16a34a' }}>
              {summaryMetrics.totalVendido > 0 ? Math.round((summaryMetrics.payEfectivo / summaryMetrics.totalVendido) * 100) : 0}%
            </span>
          </div>
          <h3 style={{ fontSize: '1.35rem', fontWeight: '950', color: '#15803d', margin: '0.1rem 0' }}>
            ${summaryMetrics.payEfectivo.toLocaleString('es-CO')}
          </h3>
          <div style={{ width: '100%', height: '4px', backgroundColor: '#f1f5f9', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${summaryMetrics.totalVendido > 0 ? (summaryMetrics.payEfectivo / summaryMetrics.totalVendido) * 100 : 0}%`, height: '100%', backgroundColor: '#16a34a' }} />
          </div>
        </div>

        {/* Tarjetas / Datáfono */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '1.15rem 1.25rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              💳 TARJETAS
            </span>
            <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#3b82f6' }}>
              {summaryMetrics.totalVendido > 0 ? Math.round((summaryMetrics.payTarjeta / summaryMetrics.totalVendido) * 100) : 0}%
            </span>
          </div>
          <h3 style={{ fontSize: '1.35rem', fontWeight: '950', color: '#1d4ed8', margin: '0.1rem 0' }}>
            ${summaryMetrics.payTarjeta.toLocaleString('es-CO')}
          </h3>
          <div style={{ width: '100%', height: '4px', backgroundColor: '#f1f5f9', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${summaryMetrics.totalVendido > 0 ? (summaryMetrics.payTarjeta / summaryMetrics.totalVendido) * 100 : 0}%`, height: '100%', backgroundColor: '#3b82f6' }} />
          </div>
        </div>

        {/* Transferencias */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '1.15rem 1.25rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              📲 TRANSFERENCIAS
            </span>
            <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#8b5cf6' }}>
              {summaryMetrics.totalVendido > 0 ? Math.round((summaryMetrics.payTransferencia / summaryMetrics.totalVendido) * 100) : 0}%
            </span>
          </div>
          <h3 style={{ fontSize: '1.35rem', fontWeight: '950', color: '#6d28d9', margin: '0.1rem 0' }}>
            ${summaryMetrics.payTransferencia.toLocaleString('es-CO')}
          </h3>
          <div style={{ width: '100%', height: '4px', backgroundColor: '#f1f5f9', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${summaryMetrics.totalVendido > 0 ? (summaryMetrics.payTransferencia / summaryMetrics.totalVendido) * 100 : 0}%`, height: '100%', backgroundColor: '#8b5cf6' }} />
          </div>
        </div>

      </div>

      {/* 3. Navigation Tabs & Comprehensive Filter Bar */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '1.25rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.85rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setActiveTab('detalle')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: 'none',
                fontWeight: '900',
                fontSize: '0.78rem',
                backgroundColor: activeTab === 'detalle' ? '#80082E' : '#f1f5f9',
                color: activeTab === 'detalle' ? '#ffffff' : '#64748b',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              📑 Discriminación Detallada de Ventas ({filteredSales.length})
            </button>
            <button
              onClick={() => setActiveTab('kpis')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: 'none',
                fontWeight: '900',
                fontSize: '0.78rem',
                backgroundColor: activeTab === 'kpis' ? '#80082E' : '#f1f5f9',
                color: activeTab === 'kpis' ? '#ffffff' : '#64748b',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              🎯 Cumplimiento de Meta & Gráficos
            </button>
            {managerShifts.length > 0 && (
              <button
                onClick={() => setActiveTab('turnos')}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: '900',
                  fontSize: '0.78rem',
                  backgroundColor: activeTab === 'turnos' ? '#80082E' : '#f1f5f9',
                  color: activeTab === 'turnos' ? '#ffffff' : '#64748b',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                💼 Turnos de Caja ({managerShifts.length})
              </button>
            )}
          </div>

          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '800' }}>
            Mostrando <strong>{filteredSales.length}</strong> ventas filtradas
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          
          {/* Quick Date Mode */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', backgroundColor: '#f8fafc', padding: '0.3rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <button
              onClick={() => { setDateFilterMode('today'); setCurrentPage(0); }}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '7px',
                border: 'none',
                fontSize: '0.72rem',
                fontWeight: '900',
                backgroundColor: dateFilterMode === 'today' ? '#ffffff' : 'transparent',
                color: dateFilterMode === 'today' ? '#80082E' : '#64748b',
                boxShadow: dateFilterMode === 'today' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer'
              }}
            >
              📅 Ventas de Hoy
            </button>
            <button
              onClick={() => { setDateFilterMode('custom'); setCurrentPage(0); }}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '7px',
                border: 'none',
                fontSize: '0.72rem',
                fontWeight: '900',
                backgroundColor: dateFilterMode === 'custom' ? '#ffffff' : 'transparent',
                color: dateFilterMode === 'custom' ? '#80082E' : '#64748b',
                boxShadow: dateFilterMode === 'custom' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer'
              }}
            >
              📆 Por Rango de Fechas
            </button>
            <button
              onClick={() => { setDateFilterMode('all'); setCurrentPage(0); }}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '7px',
                border: 'none',
                fontSize: '0.72rem',
                fontWeight: '900',
                backgroundColor: dateFilterMode === 'all' ? '#ffffff' : 'transparent',
                color: dateFilterMode === 'all' ? '#80082E' : '#64748b',
                boxShadow: dateFilterMode === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer'
              }}
            >
              📈 Todo el Histórico
            </button>
          </div>

          {/* Date Range Selectors (visible in custom mode) */}
          {dateFilterMode === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '800' }}>Desde:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => { setStartDate(e.target.value); setCurrentPage(0); }}
                  style={{
                    padding: '0.4rem 0.65rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.75rem',
                    color: '#0f172a',
                    fontWeight: '700'
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '800' }}>Hasta:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => { setEndDate(e.target.value); setCurrentPage(0); }}
                  style={{
                    padding: '0.4rem 0.65rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.75rem',
                    color: '#0f172a',
                    fontWeight: '700'
                  }}
                />
              </div>
            </div>
          )}

          {/* Vendedor Filter */}
          <select
            value={filterVendedor}
            onChange={e => { setFilterVendedor(e.target.value); setCurrentPage(0); }}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.75rem',
              color: '#0f172a',
              fontWeight: '750',
              backgroundColor: 'white'
            }}
          >
            <option value="all">👤 Todos los Vendedores</option>
            {uniqueSellers.map(v => (
              <option key={v} value={v}>👤 {v}</option>
            ))}
          </select>

          {/* Metodo de Pago Filter */}
          <select
            value={filterPayment}
            onChange={e => { setFilterPayment(e.target.value); setCurrentPage(0); }}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.75rem',
              color: '#0f172a',
              fontWeight: '750',
              backgroundColor: 'white'
            }}
          >
            <option value="all">💳 Todos los Medios de Pago</option>
            <option value="efectivo">💵 Solo Efectivo</option>
            <option value="tarjeta">💳 Solo Tarjetas / Datáfono</option>
            <option value="transferencia">📲 Solo Transferencias</option>
          </select>

          {/* Estado de Venta Filter */}
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setCurrentPage(0); }}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.75rem',
              color: '#0f172a',
              fontWeight: '750',
              backgroundColor: 'white'
            }}
          >
            <option value="all">⚡ Todos los Estados</option>
            <option value="completada">✓ Solo Completadas</option>
            <option value="anulada">✕ Solo Anuladas</option>
          </select>

          {/* Quick Search */}
          <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Buscar por ticket, cliente, serial o referencia..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(0); }}
              style={{
                width: '100%',
                padding: '0.45rem 0.75rem 0.45rem 2.2rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.75rem',
                color: '#0f172a',
                outline: 'none',
                backgroundColor: '#ffffff'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
              >
                <X size={14} />
              </button>
            )}
          </div>

        </div>
      </div>

      {/* 4. TAB CONTENT */}
      {activeTab === 'detalle' && (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Table Container */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #80082E', color: '#475569', textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: '950', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'left' }}>Ticket / Factura</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'left' }}>Fecha y Hora</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'left' }}>Punto de Venta</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'left' }}>Cajero / Vendedor</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'left' }}>Cliente / Documento</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'left' }}>Prendas Vendidas & Códigos de Barras</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Método de Pago</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Total Venta</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Estado</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSales.map((sale: any) => {
                  const storeName = sale.stores?.nombre || currentSelectedStore?.nombre || 'POS';
                  const storeCode = (sale.stores?.codigo || currentSelectedStore?.codigo || storeName.substring(0, 3)).toUpperCase();
                  const ticketStr = `${storeCode}-${String(sale.consecutive || 0).padStart(4, '0')}`;
                  const isAnulada = sale.estado === 'anulada';
                  const saleBarcodes = extractBarcodesFromSale(sale);
                  const items = sale.items || sale.pos_sale_items || [];

                  return (
                    <tr key={sale.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: isAnulada ? '#fff5f5' : 'white', transition: 'background-color 0.15s' }}>
                      
                      {/* Ticket */}
                      <td style={{ padding: '0.85rem 1rem', fontWeight: '950', color: isAnulada ? '#991b1b' : '#80082E', whiteSpace: 'nowrap' }}>
                        {ticketStr}
                      </td>

                      {/* Date & Time */}
                      <td style={{ padding: '0.85rem 1rem', color: '#64748b', whiteSpace: 'nowrap', fontSize: '0.72rem' }}>
                        {sale.created_at ? new Date(sale.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                      </td>

                      {/* Punto de Venta */}
                      <td style={{ padding: '0.85rem 1rem', color: '#334155', fontWeight: '800', whiteSpace: 'nowrap' }}>
                        {storeName}
                      </td>

                      {/* Vendedor */}
                      <td style={{ padding: '0.85rem 1rem', fontWeight: '750', color: '#1e293b', whiteSpace: 'nowrap' }}>
                        {sale.vendedor || sale.usuario_apertura || 'Vendedor POS'}
                      </td>

                      {/* Cliente */}
                      <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: '850', color: '#0f172a' }}>{sale.client_name || sale.cliente_nombre || 'Cliente General'}</div>
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontFamily: 'monospace' }}>C.C. {sale.client_document || sale.cliente_identificacion || '2222222222'}</div>
                      </td>

                      {/* Items & Barcodes list */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '240px' }}>
                          {items.length === 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ fontWeight: '750', color: '#334155' }}>Venta General</span>
                              {saleBarcodes.length > 0 && (
                                <span style={{ fontSize: '0.62rem', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '0.1rem 0.35rem', borderRadius: '4px', fontFamily: 'monospace', fontWeight: '800' }}>
                                  🏷️ {saleBarcodes.join(', ')}
                                </span>
                              )}
                            </div>
                          ) : (
                            items.map((it: any, itIdx: number) => {
                              const pName = it.products?.nombre_producto || it.nombre || 'Prenda';
                              const pRef = it.products?.codigo_referencia || '';
                              const col = it.colors?.nombre_color || it.color || '';
                              const sz = it.sizes?.codigo_talla || it.talla || '';
                              const itBarcode = (saleBarcodes.length > 0) ? (items.length === 1 ? saleBarcodes.join(', ') : (saleBarcodes[itIdx] || saleBarcodes[0])) : '';

                              return (
                                <div key={itIdx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', borderBottom: itIdx < items.length - 1 ? '1px dashed #f1f5f9' : 'none', paddingBottom: itIdx < items.length - 1 ? '0.25rem' : '0' }}>
                                  <div>
                                    <span style={{ fontWeight: '800', color: '#0f172a' }}>{it.cantidad || 1}x {pName}</span>
                                    {(col || sz || pRef) && (
                                      <span style={{ fontSize: '0.65rem', color: '#64748b', marginLeft: '0.3rem' }}>
                                        ({col}{col && sz ? ' / ' : ''}{sz}{pRef ? ` · Ref: ${pRef}` : ''})
                                      </span>
                                    )}
                                  </div>
                                  {itBarcode ? (
                                    <span style={{ fontSize: '0.6rem', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '0.1rem 0.4rem', borderRadius: '4px', fontFamily: 'monospace', fontWeight: '850', whiteSpace: 'nowrap' }}>
                                      🏷️ {itBarcode}
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                      {pRef ? `Ref: ${pRef}` : 'Sin serial'}
                                    </span>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </td>

                      {/* Payment Method */}
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        {sale.pos_payments && sale.pos_payments.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'center' }}>
                            {sale.pos_payments.map((p: any, pIdx: number) => (
                              <span key={pIdx} style={{
                                fontSize: '0.62rem',
                                fontWeight: '850',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                                backgroundColor: p.metodo_pago?.toLowerCase().includes('efectivo') ? '#dcfce7' : p.metodo_pago?.toLowerCase().includes('tarjeta') ? '#dbeafe' : '#ede9fe',
                                color: p.metodo_pago?.toLowerCase().includes('efectivo') ? '#166534' : p.metodo_pago?.toLowerCase().includes('tarjeta') ? '#1e40af' : '#6b21a8',
                                whiteSpace: 'nowrap'
                              }}>
                                {p.metodo_pago}: ${Number(p.monto || 0).toLocaleString('es-CO')}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.65rem', fontWeight: '850', padding: '0.15rem 0.45rem', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#475569' }}>
                            {sale.metodo_pago || 'Efectivo'}
                          </span>
                        )}
                      </td>

                      {/* Total */}
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: '950', fontSize: '0.85rem', color: isAnulada ? '#991b1b' : '#0f172a', whiteSpace: 'nowrap' }}>
                        ${Number(sale.total || 0).toLocaleString('es-CO')}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        <span style={{
                          padding: '0.25rem 0.55rem',
                          borderRadius: '6px',
                          fontSize: '0.62rem',
                          fontWeight: '950',
                          textTransform: 'uppercase',
                          backgroundColor: isAnulada ? '#fee2e2' : '#dcfce7',
                          color: isAnulada ? '#dc2626' : '#15803d'
                        }}>
                          {isAnulada ? '✕ Anulada' : '✓ Completada'}
                        </span>
                      </td>

                      {/* Action */}
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                          <button
                            onClick={() => setSelectedSaleDetail(sale)}
                            title="Ver detalle del ticket"
                            style={{
                              padding: '0.35rem 0.65rem',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: 'white',
                              color: '#475569',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              fontSize: '0.68rem',
                              fontWeight: '800'
                            }}
                          >
                            <Eye size={13} /> Ver
                          </button>
                          {!isAnulada && (
                            <button
                              onClick={() => {
                                setSelectedSaleForCreditNote(sale);
                                setCreditNoteReason('Devolución de prendas / Nota Crédito');
                              }}
                              title="Generar Nota Crédito (Devolver transacción e inventario)"
                              style={{
                                padding: '0.35rem 0.65rem',
                                borderRadius: '6px',
                                border: '1px solid #fca5a5',
                                backgroundColor: '#fef2f2',
                                color: '#b91c1c',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                fontSize: '0.68rem',
                                fontWeight: '850'
                              }}
                            >
                              <RotateCcw size={12} /> Nota Crédito
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })}

                {paginatedSales.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '2rem' }}>🔍</span>
                        <span style={{ fontWeight: '850', color: '#64748b' }}>No se encontraron ventas con los filtros aplicados.</span>
                        <span style={{ fontSize: '0.75rem' }}>Prueba ampliando el rango de fechas o seleccionando otra sucursal.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {filteredSales.length > PAGE_SIZE && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderTop: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '800' }}>
                Mostrando {currentPage * PAGE_SIZE + 1} a {Math.min((currentPage + 1) * PAGE_SIZE, filteredSales.length)} de {filteredSales.length} ventas
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: currentPage === 0 ? '#f1f5f9' : 'white',
                    color: currentPage === 0 ? '#94a3b8' : '#334155',
                    cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: '800'
                  }}
                >
                  Anterior
                </button>
                <button
                  onClick={() => setCurrentPage(p => p + 1)}
                  disabled={(currentPage + 1) * PAGE_SIZE >= filteredSales.length}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: (currentPage + 1) * PAGE_SIZE >= filteredSales.length ? '#f1f5f9' : 'white',
                    color: (currentPage + 1) * PAGE_SIZE >= filteredSales.length ? '#94a3b8' : '#334155',
                    cursor: (currentPage + 1) * PAGE_SIZE >= filteredSales.length ? 'not-allowed' : 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: '800'
                  }}
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* KPI & Monthly Goal Tab */}
      {activeTab === 'kpis' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {(() => {
            const currentMonthPrefix = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }).substring(0, 7);
            const rawMonthName = new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
            const capitalizedMonth = rawMonthName.charAt(0).toUpperCase() + rawMonthName.slice(1);
            
            const currentMonthSales = filteredSales
              .filter((s: any) => s.created_at && s.created_at.includes(currentMonthPrefix) && s.estado !== 'anulada')
              .reduce((sum: number, s: any) => sum + (Number(s.total) || 0), 0);
            
            const storeMeta = Number(currentSelectedStore?.meta_mensual) || 0;
            const compliancePercent = storeMeta > 0 ? Math.round((currentMonthSales / storeMeta) * 100) : (currentMonthSales > 0 ? 100 : 0);
            const isGoalReached = storeMeta > 0 && currentMonthSales >= storeMeta;
            const diffGoal = storeMeta - currentMonthSales;

            const now = new Date();
            const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            const currentDay = now.getDate();
            const remainingDays = Math.max(1, totalDaysInMonth - currentDay + 1);
            const dailyPaceNeeded = diffGoal > 0 ? Math.round(diffGoal / remainingDays) : 0;

            return (
              <div style={{
                borderRadius: '20px',
                background: isGoalReached 
                  ? 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #059669 100%)' 
                  : compliancePercent >= 50
                    ? 'linear-gradient(135deg, #1e1b4b 0%, #312e81 45%, #4338ca 100%)'
                    : 'linear-gradient(135deg, #451a03 0%, #78350f 50%, #b45309 100%)',
                color: 'white',
                padding: '1.75rem 2rem',
                boxShadow: '0 12px 28px rgba(0,0,0,0.15)',
                border: '1px solid rgba(255,255,255,0.2)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '1.25rem' }}>🎯</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: '900', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' }}>
                        META COMERCIAL DEL MES · {capitalizedMonth}
                      </span>
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '950', color: '#ffffff' }}>
                      {currentSelectedStore?.nombre || 'Punto de Venta'}
                    </h3>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', backgroundColor: 'rgba(255,255,255,0.12)', padding: '0.6rem 1.25rem', borderRadius: '16px' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '800', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase' }}>CUMPLIMIENTO</span>
                    <span style={{ fontSize: '2.2rem', fontWeight: '950', color: '#ffffff', lineHeight: 1 }}>{compliancePercent}%</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ marginTop: '1.5rem', width: '100%', height: '18px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '10px', overflow: 'hidden', padding: '2px' }}>
                  <div style={{
                    width: `${Math.min(100, compliancePercent)}%`,
                    height: '100%',
                    borderRadius: '8px',
                    background: isGoalReached ? 'linear-gradient(90deg, #34d399 0%, #10b981 100%)' : 'linear-gradient(90deg, #fbbf24 0%, #10b981 100%)'
                  }} />
                </div>

                {/* Stats grid */}
                <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
                  <div style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '0.85rem 1rem', borderRadius: '12px' }}>
                    <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: 'rgba(255,255,255,0.75)' }}>META ASIGNADA</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: '950', color: '#ffffff' }}>${storeMeta.toLocaleString('es-CO')}</span>
                  </div>
                  <div style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '0.85rem 1rem', borderRadius: '12px' }}>
                    <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: 'rgba(255,255,255,0.75)' }}>VENTAS DEL MES</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: '950', color: '#a7f3d0' }}>${currentMonthSales.toLocaleString('es-CO')}</span>
                  </div>
                  <div style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '0.85rem 1rem', borderRadius: '12px' }}>
                    <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: 'rgba(255,255,255,0.75)' }}>{isGoalReached ? 'SUPERÁVIT' : 'FALTANTE'}</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: '950', color: isGoalReached ? '#6ee7b7' : '#fde68a' }}>
                      {isGoalReached ? `+$${Math.abs(diffGoal).toLocaleString('es-CO')}` : `$${Math.max(0, diffGoal).toLocaleString('es-CO')}`}
                    </span>
                  </div>
                  <div style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '0.85rem 1rem', borderRadius: '12px' }}>
                    <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: '800', color: 'rgba(255,255,255,0.75)' }}>RITMO DIARIO REQUERIDO</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: '950', color: isGoalReached ? '#6ee7b7' : '#fbbf24' }}>
                      {isGoalReached ? '✓ ¡Completado!' : `$${dailyPaceNeeded.toLocaleString('es-CO')}/día`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Shifts Log Tab */}
      {activeTab === 'turnos' && managerShifts.length > 0 && (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '1.25rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
        }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: '950', color: '#0f172a', margin: '0 0 1rem 0' }}>
            Bitácora de Turnos y Cierres de Caja
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #80082E', fontWeight: '950', color: '#64748b', textTransform: 'uppercase', fontSize: '0.65rem' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Cajero</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Apertura</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Efectivo Inicial</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Efectivo Real</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Diferencia</th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }}>Estado</th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {managerShifts.slice(shiftsPage * 10, (shiftsPage + 1) * 10).map((sh, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.75rem', fontWeight: '850' }}>{sh.usuario_apertura}</td>
                  <td style={{ padding: '0.75rem', color: '#64748b' }}>{new Date(sh.fecha_apertura).toLocaleString('es-CO')}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>${Number(sh.monto_apertura).toLocaleString('es-CO')}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>{sh.monto_cierre_real != null ? `${Number(sh.monto_cierre_real).toLocaleString('es-CO')}` : '-'}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '850', color: Number(sh.diferencia) >= 0 ? '#10b981' : '#ef4444' }}>
                    {sh.diferencia != null ? `${Number(sh.diferencia).toLocaleString('es-CO')}` : '-'}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <span style={{ backgroundColor: sh.estado === 'abierta' ? '#dcfce7' : '#f1f5f9', color: sh.estado === 'abierta' ? '#15803d' : '#475569', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: '900', textTransform: 'uppercase', fontSize: '0.625rem' }}>
                      {sh.estado}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedShiftForModal(sh)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#f8fafc',
                        color: '#1e293b',
                        fontWeight: '850',
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <Eye size={13} style={{ color: '#80082E' }} />
                      Ver Detalle / Transacciones
                    </button>
                  </td>
                </tr>
              ))}
              {managerShifts.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No hay turnos registrados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. MASTER REPORT PDF MODAL (Printable Document) */}
      {showPrintModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '1.5rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '1000px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div className="no-print" style={{
              padding: '1rem 1.5rem',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '950', color: '#0f172a' }}>
                  📄 Vista Previa de Impresión / Guardar en PDF
                </h3>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  Informe Oficial de Ventas & Cierre · {currentSelectedStore?.nombre || 'Sucursal'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  onClick={() => window.print()}
                  style={{
                    padding: '0.5rem 1.25rem',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#80082E',
                    color: 'white',
                    fontWeight: '900',
                    fontSize: '0.78rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    cursor: 'pointer'
                  }}
                >
                  <Printer size={15} /> Imprimir / Guardar en PDF
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  style={{
                    padding: '0.5rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: 'white',
                    color: '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Printable Report Document Body */}
            <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }} className="printable-sales-report pos-scrollbar">
              
              {/* Document Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #80082E', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
                <div>
                  <h1 style={{ fontSize: '1.5rem', fontWeight: '950', color: '#80082E', margin: 0, letterSpacing: '-0.02em' }}>
                    BREINER CONFECCIONES S.A.S.
                  </h1>
                  <p style={{ margin: '0.2rem 0', fontSize: '0.85rem', fontWeight: '800', color: '#0f172a' }}>
                    INFORME GERENCIAL Y CONTROL DE VENTAS POS
                  </p>
                  <p style={{ margin: '0.15rem 0', fontSize: '0.75rem', color: '#475569' }}>
                    <strong>Sucursal:</strong> {currentSelectedStore?.nombre || 'Sucursal'} · <strong>Ciudad:</strong> {currentSelectedStore?.ciudad || 'Colombia'}
                  </p>
                  <p style={{ margin: '0.15rem 0', fontSize: '0.75rem', color: '#475569' }}>
                    <strong>Período Auditado:</strong> {dateFilterMode === 'today' ? `Ventas de Hoy (${todayStr})` : dateFilterMode === 'custom' ? `Desde ${startDate} hasta ${endDate}` : 'Histórico Completo'}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>FECHA DE GENERACIÓN</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '900', color: '#0f172a' }}>
                    {new Date().toLocaleString('es-CO')}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem' }}>
                    Estado: <span style={{ color: '#16a34a', fontWeight: '900' }}>✓ AUDITADO</span>
                  </div>
                </div>
              </div>

              {/* KPI Executive Summary Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ border: '1px solid #cbd5e1', padding: '0.85rem', borderRadius: '8px', backgroundColor: '#f8fafc' }}>
                  <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>VENTAS TOTALES</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: '950', color: '#1e3a8a' }}>${summaryMetrics.totalVendido.toLocaleString('es-CO')}</span>
                </div>
                <div style={{ border: '1px solid #cbd5e1', padding: '0.85rem', borderRadius: '8px', backgroundColor: '#f8fafc' }}>
                  <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>TRANSACCIONES</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: '950', color: '#0f172a' }}>{summaryMetrics.totalTx}</span>
                </div>
                <div style={{ border: '1px solid #cbd5e1', padding: '0.85rem', borderRadius: '8px', backgroundColor: '#f8fafc' }}>
                  <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>UNIDADES VENDIDAS</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: '950', color: '#78350f' }}>{summaryMetrics.totalPrendas} uds</span>
                </div>
                <div style={{ border: '1px solid #cbd5e1', padding: '0.85rem', borderRadius: '8px', backgroundColor: '#f8fafc' }}>
                  <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>TICKET PROMEDIO</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: '950', color: '#6d28d9' }}>${summaryMetrics.ticketPromedio.toLocaleString('es-CO')}</span>
                </div>
              </div>

              {/* Payment Methods Breakdown */}
              <div style={{ marginBottom: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem', backgroundColor: '#ffffff' }}>
                <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: '900', color: '#334155', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Desglose por Medios de Pago
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', fontSize: '0.78rem' }}>
                  <div><strong>Efectivo:</strong> ${summaryMetrics.payEfectivo.toLocaleString('es-CO')}</div>
                  <div><strong>Tarjetas:</strong> ${summaryMetrics.payTarjeta.toLocaleString('es-CO')}</div>
                  <div><strong>Transferencias:</strong> ${summaryMetrics.payTransferencia.toLocaleString('es-CO')}</div>
                  <div><strong>Otros / Mixto:</strong> ${summaryMetrics.payOtros.toLocaleString('es-CO')}</div>
                </div>
              </div>

              {/* Detailed Itemized Sales Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', marginBottom: '2rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #80082E', backgroundColor: '#f1f5f9', fontWeight: '950', color: '#334155', textTransform: 'uppercase', fontSize: '0.65rem' }}>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}># Ticket</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Fecha/Hora</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Sucursal</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Vendedor</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Cliente / Doc.</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Prendas / Referencias</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Código de Barras / Serial</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center' }}>Método</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map((sale: any, idx: number) => {
                    const stName = sale.stores?.nombre || currentSelectedStore?.nombre || 'POS';
                    const stCode = (sale.stores?.codigo || currentSelectedStore?.codigo || stName.substring(0, 3)).toUpperCase();
                    const ticketStr = `${stCode}-${String(sale.consecutive || 0).padStart(4, '0')}`;
                    const saleBarcodes = extractBarcodesFromSale(sale);
                    const items = sale.items || sale.pos_sale_items || [];
                    const itemsStr = items.map((it: any) => `${it.cantidad || 1}x ${it.products?.nombre_producto || it.nombre || 'Prenda'}`).join(', ') || 'Venta General';
                    const barcodesStr = saleBarcodes.join(', ') || '-';
                    const payStr = (sale.pos_payments && sale.pos_payments.length > 0) ? sale.pos_payments.map((p: any) => p.metodo_pago).join('/') : (sale.metodo_pago || 'Efectivo');

                    return (
                      <tr key={sale.id || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '0.5rem', fontWeight: '900', color: '#80082E' }}>{ticketStr}</td>
                        <td style={{ padding: '0.5rem', color: '#64748b', whiteSpace: 'nowrap' }}>{sale.created_at ? new Date(sale.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                        <td style={{ padding: '0.5rem' }}>{stName}</td>
                        <td style={{ padding: '0.5rem' }}>{sale.vendedor || sale.usuario_apertura || 'Vendedor'}</td>
                        <td style={{ padding: '0.5rem' }}>{sale.cliente_nombre || 'Cliente General'} ({sale.cliente_identificacion || '222222222222'})</td>
                        <td style={{ padding: '0.5rem' }}>{itemsStr}</td>
                        <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.68rem', color: '#0369a1' }}>{barcodesStr}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>{payStr}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '900' }}>${Number(sale.total || 0).toLocaleString('es-CO')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Signatures & Certification Area */}
              <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ borderTop: '1px solid #94a3b8', width: '220px', textAlign: 'center', paddingTop: '0.5rem', fontSize: '0.72rem', color: '#475569' }}>
                  <strong>Firma Cajero / Administrador</strong>
                </div>
                <div style={{ borderTop: '1px solid #94a3b8', width: '220px', textAlign: 'center', paddingTop: '0.5rem', fontSize: '0.72rem', color: '#475569' }}>
                  <strong>Firma Auditoría / Gerencia</strong>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE TURNO Y CIERRE DE CAJA */}
      {selectedShiftForModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '1.5rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '950px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '950', color: '#0f172a' }}>
                  💼 Detalle del Cierre de Caja · {selectedShiftForModal.usuario_apertura}
                </h3>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  Apertura: {new Date(selectedShiftForModal.fecha_apertura).toLocaleString('es-CO')} · {selectedShiftForModal.fecha_cierre ? `Cierre: ${new Date(selectedShiftForModal.fecha_cierre).toLocaleString('es-CO')}` : 'Turno Activo'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedShiftForModal(null)}
                style={{ border: 'none', backgroundColor: '#e2e8f0', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "1.5rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1.35rem" }}>
              {loadingShiftSales ? (
                <div style={{ textAlign: "center", padding: "3rem" }}>
                  <Loader2 size={28} className="animate-spin" style={{ margin: "0 auto", color: "#80082E" }} />
                  <p style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.75rem", fontWeight: "700" }}>Cargando resumen de cierre de caja...</p>
                </div>
              ) : (() => {
                const apertura = Number(selectedShiftForModal.monto_apertura || 0);
                const salesNonCancelled = shiftModalSales.filter(s => s.estado !== "anulada");
                const totalVendido = salesNonCancelled.reduce((sum, s) => sum + Number(s.total || 0), 0);

                // Breakdown by payment methods
                let totalEfectivo = 0;
                let totalTarjeta = 0;
                let totalTransferencia = 0;
                const transferenciasPorBanco: Record<string, number> = {};
                let totalOtros = 0;

                salesNonCancelled.forEach((sale: any) => {
                  const saleTotal = Number(sale.total || 0);
                  const pays: any[] = sale.pos_payments && sale.pos_payments.length > 0 ? sale.pos_payments : [];

                  if (pays.length > 0) {
                    pays.forEach((p: any) => {
                      const metodo = (p.metodo_pago || "").toLowerCase();
                      const monto = Number(p.monto || 0);
                      if (metodo.includes("efectivo")) {
                        totalEfectivo += monto;
                      } else if (metodo.includes("tarjeta") || metodo.includes("datafono")) {
                        totalTarjeta += monto;
                      } else if (metodo.includes("transferencia") || metodo.includes("banco") || metodo.includes("qr") || metodo.includes("nequi") || metodo.includes("daviplata")) {
                        totalTransferencia += monto;
                        let bankName = p.metodo_pago || "Transferencia";
                        if (sale.observaciones) {
                          const m = sale.observaciones.match(/Banco:\s*([^|,\n]+)/i);
                          if (m && m[1]) bankName = m[1].trim();
                        }
                        transferenciasPorBanco[bankName] = (transferenciasPorBanco[bankName] || 0) + monto;
                      } else {
                        totalOtros += monto;
                      }
                    });
                  } else {
                    const fallbackMetodo = (sale.metodo_pago || "efectivo").toLowerCase();
                    if (fallbackMetodo.includes("efectivo")) totalEfectivo += saleTotal;
                    else if (fallbackMetodo.includes("tarjeta") || fallbackMetodo.includes("datafono")) totalTarjeta += saleTotal;
                    else if (fallbackMetodo.includes("transferencia") || fallbackMetodo.includes("banco") || fallbackMetodo.includes("qr")) {
                      totalTransferencia += saleTotal;
                      transferenciasPorBanco["Transferencia"] = (transferenciasPorBanco["Transferencia"] || 0) + saleTotal;
                    } else totalOtros += saleTotal;
                  }
                });

                // Movimientos de caja (ingresos y egresos)
                let totalIngresos = 0;
                let totalEgresos = 0;
                shiftModalMovements.forEach((m: any) => {
                  const tipo = (m.tipo || "").toLowerCase();
                  const val = Number(m.monto || 0);
                  if (tipo === "ingreso") totalIngresos += val;
                  if (tipo === "egreso") totalEgresos += val;
                });

                // If no movement table entries found, check shift observations fallback
                if (totalIngresos === 0 && totalEgresos === 0 && selectedShiftForModal.observaciones) {
                  const obsLines = String(selectedShiftForModal.observaciones).split("\n");
                  obsLines.forEach(line => {
                    const match = line.match(/\[MOVIMIENTO CAJA - (INGRESO|EGRESO)\]:\s*\$([\d\.,]+)/i);
                    if (match) {
                      const t = match[1].toLowerCase();
                      const cleanVal = parseFloat(match[2].replace(/\./g, "").replace(",", "."));
                      if (!isNaN(cleanVal)) {
                        if (t === "ingreso") totalIngresos += cleanVal;
                        if (t === "egreso") totalEgresos += cleanVal;
                      }
                    }
                  });
                }

                // Balance calculations
                const efectivoEsperado = selectedShiftForModal.monto_cierre_esperado != null
                  ? Number(selectedShiftForModal.monto_cierre_esperado)
                  : (apertura + totalEfectivo + totalIngresos - totalEgresos);

                const montoCierreReal = selectedShiftForModal.monto_cierre_real != null ? Number(selectedShiftForModal.monto_cierre_real) : null;
                const diferencia = selectedShiftForModal.diferencia != null ? Number(selectedShiftForModal.diferencia) : (montoCierreReal != null ? montoCierreReal - efectivoEsperado : null);

                return (
                  <>
                    {/* 1. SECCION SUPERIOR: VENTAS TOTALES DEL DIA */}
                    <div style={{
                      background: "linear-gradient(135deg, #80082E 0%, #4a0319 100%)",
                      borderRadius: "16px",
                      padding: "1.35rem 1.75rem",
                      color: "white",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      boxShadow: "0 10px 25px -5px rgba(128, 8, 46, 0.35)"
                    }}>
                      <div>
                        <span style={{ fontSize: "0.72rem", fontWeight: "800", letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.85, display: "block" }}>
                          Ventas Totales del Día / Turno
                        </span>
                        <div style={{ fontSize: "2.1rem", fontWeight: "950", fontFamily: "monospace", marginTop: "0.15rem" }}>
                          ${totalVendido.toLocaleString("es-CO")}
                        </div>
                        <span style={{ fontSize: "0.75rem", opacity: 0.9 }}>
                          {salesNonCancelled.length} transacciones registradas · Base inicial: ${apertura.toLocaleString("es-CO")}
                        </span>
                      </div>
                      <div style={{
                        width: "56px",
                        height: "56px",
                        borderRadius: "14px",
                        backgroundColor: "rgba(255, 255, 255, 0.15)",
                        backdropFilter: "blur(6px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid rgba(255, 255, 255, 0.25)"
                      }}>
                        <TrendingUp size={30} style={{ color: "#ffffff" }} />
                      </div>
                    </div>

                    {/* 2. DESAGREGACION DE VENTAS POR MEDIOS DE PAGO HABILITADOS */}
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.75rem" }}>
                        <Wallet size={16} style={{ color: "#80082E" }} />
                        <h4 style={{ margin: 0, fontSize: "0.85rem", fontWeight: "950", color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Desagregación de Ventas por Medio de Pago
                        </h4>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.85rem" }}>
                        {/* EFECTIVO */}
                        <div style={{
                          backgroundColor: "#ecfdf5",
                          border: "1.5px solid #a7f3d0",
                          borderRadius: "14px",
                          padding: "1rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.35rem"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "0.68rem", fontWeight: "900", color: "#065f46", textTransform: "uppercase" }}>
                              Efectivo en Ventas
                            </span>
                            <div style={{ width: "28px", height: "28px", borderRadius: "8px", backgroundColor: "#d1fae5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Banknote size={16} style={{ color: "#059669" }} />
                            </div>
                          </div>
                          <span style={{ fontSize: "1.25rem", fontWeight: "950", color: "#047857", fontFamily: "monospace" }}>
                            ${totalEfectivo.toLocaleString("es-CO")}
                          </span>
                          <span style={{ fontSize: "0.65rem", color: "#059669", fontWeight: "700" }}>
                            {totalVendido > 0 ? ((totalEfectivo / totalVendido) * 100).toFixed(1) : 0}% de las ventas
                          </span>
                        </div>

                        {/* TRANSFERENCIAS */}
                        <div style={{
                          backgroundColor: "#fffbeb",
                          border: "1.5px solid #fde68a",
                          borderRadius: "14px",
                          padding: "1rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.35rem"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "0.68rem", fontWeight: "900", color: "#92400e", textTransform: "uppercase" }}>
                              Transferencias / QR
                            </span>
                            <div style={{ width: "28px", height: "28px", borderRadius: "8px", backgroundColor: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <QrCode size={16} style={{ color: "#d97706" }} />
                            </div>
                          </div>
                          <span style={{ fontSize: "1.25rem", fontWeight: "950", color: "#b45309", fontFamily: "monospace" }}>
                            ${totalTransferencia.toLocaleString("es-CO")}
                          </span>
                          {Object.keys(transferenciasPorBanco).length > 0 ? (
                            <div style={{ fontSize: "0.62rem", color: "#78350f", display: "flex", flexDirection: "column", gap: "2px", marginTop: "0.15rem" }}>
                              {Object.entries(transferenciasPorBanco).map(([banco, val]) => (
                                <div key={banco} style={{ display: "flex", justifyContent: "space-between" }}>
                                  <span>{banco}:</span>
                                  <strong style={{ fontFamily: "monospace" }}>${val.toLocaleString("es-CO")}</strong>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: "0.65rem", color: "#b45309", fontWeight: "700" }}>
                              Bancolombia, Nequi, Daviplata
                            </span>
                          )}
                        </div>

                        {/* TARJETAS */}
                        <div style={{
                          backgroundColor: "#eff6ff",
                          border: "1.5px solid #bfdbfe",
                          borderRadius: "14px",
                          padding: "1rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.35rem"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "0.68rem", fontWeight: "900", color: "#1e40af", textTransform: "uppercase" }}>
                              Tarjetas / Datáfono
                            </span>
                            <div style={{ width: "28px", height: "28px", borderRadius: "8px", backgroundColor: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <CreditCard size={16} style={{ color: "#2563eb" }} />
                            </div>
                          </div>
                          <span style={{ fontSize: "1.25rem", fontWeight: "950", color: "#1d4ed8", fontFamily: "monospace" }}>
                            ${totalTarjeta.toLocaleString("es-CO")}
                          </span>
                          <span style={{ fontSize: "0.65rem", color: "#2563eb", fontWeight: "700" }}>
                            Débito y Crédito
                          </span>
                        </div>

                        {/* OTROS SI EXISTEN */}
                        {totalOtros > 0 && (
                          <div style={{
                            backgroundColor: "#f5f3ff",
                            border: "1.5px solid #ddd6fe",
                            borderRadius: "14px",
                            padding: "1rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.35rem"
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: "0.68rem", fontWeight: "900", color: "#6d28d9", textTransform: "uppercase" }}>
                                Otros Medios
                              </span>
                              <div style={{ width: "28px", height: "28px", borderRadius: "8px", backgroundColor: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <DollarSign size={16} style={{ color: "#7c3aed" }} />
                              </div>
                            </div>
                            <span style={{ fontSize: "1.25rem", fontWeight: "950", color: "#5b21b6", fontFamily: "monospace" }}>
                              ${totalOtros.toLocaleString("es-CO")}
                            </span>
                            <span style={{ fontSize: "0.65rem", color: "#7c3aed", fontWeight: "700" }}>Bonos / Mixto</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 3. MOVIMIENTOS DE CAJA (INGRESOS Y EGRESOS) */}
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.75rem" }}>
                        <RotateCcw size={15} style={{ color: "#475569" }} />
                        <h4 style={{ margin: 0, fontSize: "0.85rem", fontWeight: "950", color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Movimientos de Caja (Ingresos y Egresos de Turno)
                        </h4>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.85rem" }}>
                        {/* INGRESOS */}
                        <div style={{
                          backgroundColor: "#f8fafc",
                          border: "1.5px solid #cbd5e1",
                          borderRadius: "12px",
                          padding: "0.9rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.85rem"
                        }}>
                          <div style={{ width: "38px", height: "38px", borderRadius: "10px", backgroundColor: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center", color: "#16a34a", flexShrink: 0 }}>
                            <ArrowDownRight size={20} />
                          </div>
                          <div>
                            <span style={{ fontSize: "0.65rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", display: "block" }}>
                              + Ingresos Adicionales
                            </span>
                            <span style={{ fontSize: "1.1rem", fontWeight: "950", color: "#16a34a", fontFamily: "monospace" }}>
                              ${totalIngresos.toLocaleString("es-CO")}
                            </span>
                          </div>
                        </div>

                        {/* EGRESOS / GASTOS */}
                        <div style={{
                          backgroundColor: "#f8fafc",
                          border: "1.5px solid #cbd5e1",
                          borderRadius: "12px",
                          padding: "0.9rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.85rem"
                        }}>
                          <div style={{ width: "38px", height: "38px", borderRadius: "10px", backgroundColor: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", color: "#dc2626", flexShrink: 0 }}>
                            <ArrowUpRight size={20} />
                          </div>
                          <div>
                            <span style={{ fontSize: "0.65rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", display: "block" }}>
                              - Egresos / Gastos Menores
                            </span>
                            <span style={{ fontSize: "1.1rem", fontWeight: "950", color: "#dc2626", fontFamily: "monospace" }}>
                              ${totalEgresos.toLocaleString("es-CO")}
                            </span>
                          </div>
                        </div>

                        {/* BALANCE NETO EFECTIVO EN CAJA ESPERADO */}
                        <div style={{
                          backgroundColor: "#fef3c7",
                          border: "1.5px solid #f59e0b",
                          borderRadius: "12px",
                          padding: "0.9rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.85rem"
                        }}>
                          <div style={{ width: "38px", height: "38px", borderRadius: "10px", backgroundColor: "#fde68a", display: "flex", alignItems: "center", justifyContent: "center", color: "#b45309", flexShrink: 0 }}>
                            <DollarSign size={20} />
                          </div>
                          <div>
                            <span style={{ fontSize: "0.65rem", fontWeight: "900", color: "#92400e", textTransform: "uppercase", display: "block" }}>
                              Efectivo Esperado en Caja
                            </span>
                            <span style={{ fontSize: "1.15rem", fontWeight: "950", color: "#92400e", fontFamily: "monospace" }}>
                              ${efectivoEsperado.toLocaleString("es-CO")}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* LISTA DETALLADA DE MOVIMIENTOS SI EXISTEN */}
                      {shiftModalMovements.length > 0 && (
                        <div style={{ marginTop: "0.75rem", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem" }}>
                            <thead>
                              <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontWeight: "850", textAlign: "left" }}>
                                <th style={{ padding: "0.45rem 0.65rem" }}>Tipo</th>
                                <th style={{ padding: "0.45rem 0.65rem" }}>Concepto</th>
                                <th style={{ padding: "0.45rem 0.65rem" }}>Observaciones</th>
                                <th style={{ padding: "0.45rem 0.65rem" }}>Usuario</th>
                                <th style={{ padding: "0.45rem 0.65rem", textAlign: "right" }}>Monto</th>
                              </tr>
                            </thead>
                            <tbody>
                              {shiftModalMovements.map((mov: any, mIdx: number) => {
                                const isIngreso = (mov.tipo || "").toLowerCase() === "ingreso";
                                return (
                                  <tr key={mov.id || mIdx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                    <td style={{ padding: "0.45rem 0.65rem" }}>
                                      <span style={{
                                        fontSize: "0.62rem",
                                        fontWeight: "900",
                                        padding: "0.15rem 0.4rem",
                                        borderRadius: "4px",
                                        backgroundColor: isIngreso ? "#dcfce7" : "#fee2e2",
                                        color: isIngreso ? "#15803d" : "#b91c1c",
                                        textTransform: "uppercase"
                                      }}>
                                        {mov.tipo}
                                      </span>
                                    </td>
                                    <td style={{ padding: "0.45rem 0.65rem", fontWeight: "800", color: "#0f172a" }}>{mov.concepto || "Movimiento de Caja"}</td>
                                    <td style={{ padding: "0.45rem 0.65rem", color: "#64748b" }}>{mov.observaciones || "—"}</td>
                                    <td style={{ padding: "0.45rem 0.65rem", color: "#475569" }}>{mov.usuario || "Cajero"}</td>
                                    <td style={{ padding: "0.45rem 0.65rem", textAlign: "right", fontWeight: "900", fontFamily: "monospace", color: isIngreso ? "#16a34a" : "#dc2626" }}>
                                      {isIngreso ? "+" : "-"}${Number(mov.monto || 0).toLocaleString("es-CO")}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* 4. PRENDAS VENDIDAS EN EL TURNO (AGRUPADAS) */}
                    <div>
                      <h4 style={{ margin: "0 0 0.65rem 0", fontSize: "0.85rem", fontWeight: "950", color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        🏷️ Prendas Vendidas en Este Cierre
                      </h4>
                      {(() => {
                        const itemMap = new Map();
                        salesNonCancelled.forEach(s => {
                          const items = s.pos_sale_items || s.items || [];
                          items.forEach((it: any) => {
                            const pName = it.products?.nombre_producto || it.nombre || "Prenda";
                            const pRef = it.products?.codigo_referencia || "";
                            const col = it.colors?.nombre_color || it.color || "";
                            const sz = it.sizes?.codigo_talla || it.talla || "";
                            const key = `${pName}_${col}_${sz}`;
                            const qty = Number(it.cantidad) || 1;
                            const subtotal = Number(it.subtotal || it.total || (it.precio_unitario * qty) || 0);

                            if (itemMap.has(key)) {
                              const cur = itemMap.get(key);
                              cur.cantidad += qty;
                              cur.total += subtotal;
                            } else {
                              itemMap.set(key, {
                                name: pName,
                                ref: pRef,
                                color: col,
                                size: sz,
                                cantidad: qty,
                                total: subtotal
                              });
                            }
                          });
                        });

                        const groupedItems = Array.from(itemMap.values());
                        if (groupedItems.length === 0) {
                          return <div style={{ fontSize: "0.78rem", color: "#94a3b8", fontStyle: "italic", padding: "0.5rem 0" }}>No se registraron prendas en este turno.</div>;
                        }

                        return (
                          <div style={{ border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                              <thead>
                                <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontWeight: "850", textAlign: "left" }}>
                                  <th style={{ padding: "0.55rem 0.75rem" }}>Prenda / Referencia</th>
                                  <th style={{ padding: "0.55rem 0.75rem" }}>Color & Talla</th>
                                  <th style={{ padding: "0.55rem 0.75rem", textAlign: "center" }}>Unidades</th>
                                  <th style={{ padding: "0.55rem 0.75rem", textAlign: "right" }}>Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {groupedItems.map((gi: any, gIdx: number) => (
                                  <tr key={gIdx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                    <td style={{ padding: "0.55rem 0.75rem", fontWeight: "800", color: "#0f172a" }}>
                                      {gi.name} {gi.ref ? `· Ref: ${gi.ref}` : ""}
                                    </td>
                                    <td style={{ padding: "0.55rem 0.75rem", color: "#475569" }}>
                                      {gi.color || "Standard"} / {gi.size || "U"}
                                    </td>
                                    <td style={{ padding: "0.55rem 0.75rem", textAlign: "center", fontWeight: "900", color: "#80082E" }}>
                                      {gi.cantidad}
                                    </td>
                                    <td style={{ padding: "0.55rem 0.75rem", textAlign: "right", fontWeight: "850", color: "#0f172a" }}>
                                      ${gi.total.toLocaleString("es-CO")}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}
                    </div>

                    {/* 5. CUADRO FINAL: LO REPORTADO POR LA CAJERA AL CIERRE Y BALANCE */}
                    <div style={{
                      marginTop: "0.5rem",
                      border: "2px solid #e2e8f0",
                      borderRadius: "16px",
                      overflow: "hidden",
                      backgroundColor: "#ffffff",
                      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.04)"
                    }}>
                      <div style={{
                        padding: "0.9rem 1.25rem",
                        backgroundColor: "#f8fafc",
                        borderBottom: "1.5px solid #e2e8f0",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <CheckCircle2 size={18} style={{ color: "#16a34a" }} />
                          <h4 style={{ margin: 0, fontSize: "0.9rem", fontWeight: "950", color: "#0f172a" }}>
                            Reporte Final y Cuadre de Cierre de Caja
                          </h4>
                        </div>
                        <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: "800" }}>
                          Cajero(a): <strong>{selectedShiftForModal.usuario_apertura}</strong>
                        </span>
                      </div>

                      <div style={{ padding: "1.25rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                        {/* Efectivo Esperado */}
                        <div style={{ padding: "0.85rem 1rem", borderRadius: "12px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                          <span style={{ fontSize: "0.65rem", fontWeight: "800", color: "#64748b", textTransform: "uppercase", display: "block" }}>
                            Efectivo Esperado en Sistema
                          </span>
                          <span style={{ fontSize: "1.3rem", fontWeight: "950", color: "#0f172a", fontFamily: "monospace" }}>
                            ${efectivoEsperado.toLocaleString("es-CO")}
                          </span>
                          <span style={{ fontSize: "0.62rem", color: "#94a3b8", display: "block", marginTop: "0.15rem" }}>
                            Base + Efectivo Ventas + Ingresos - Egresos
                          </span>
                        </div>

                        {/* Efectivo Real Reportado */}
                        <div style={{
                          padding: "0.85rem 1rem",
                          borderRadius: "12px",
                          backgroundColor: "#eff6ff",
                          border: "1.5px solid #93c5fd"
                        }}>
                          <span style={{ fontSize: "0.65rem", fontWeight: "900", color: "#1e40af", textTransform: "uppercase", display: "block" }}>
                            Efectivo Físico Reportado por Cajera
                          </span>
                          <span style={{ fontSize: "1.35rem", fontWeight: "950", color: "#1e3a8a", fontFamily: "monospace" }}>
                            {montoCierreReal != null ? `$${montoCierreReal.toLocaleString("es-CO")}` : "Turno Activo (Sin cierre)"}
                          </span>
                          <span style={{ fontSize: "0.62rem", color: "#3b82f6", display: "block", marginTop: "0.15rem" }}>
                            Monto contado y declarado en arqueo
                          </span>
                        </div>

                        {/* Diferencia / Cuadre */}
                        <div style={{
                          padding: "0.85rem 1rem",
                          borderRadius: "12px",
                          backgroundColor: diferencia == null ? "#f8fafc" : (diferencia === 0 ? "#f0fdf4" : (diferencia > 0 ? "#eff6ff" : "#fef2f2")),
                          border: `1.5px solid ${diferencia == null ? "#e2e8f0" : (diferencia === 0 ? "#86efac" : (diferencia > 0 ? "#93c5fd" : "#fca5a5"))}`
                        }}>
                          <span style={{
                            fontSize: "0.65rem",
                            fontWeight: "900",
                            color: diferencia == null ? "#64748b" : (diferencia === 0 ? "#166534" : (diferencia > 0 ? "#1e40af" : "#991b1b")),
                            textTransform: "uppercase",
                            display: "block"
                          }}>
                            {diferencia == null ? "Estado del Cuadre" : (diferencia === 0 ? "✓ Arqueo Exacto (Cuadrado)" : (diferencia > 0 ? "▲ Sobrante en Caja" : "▼ Faltante en Caja"))}
                          </span>
                          <span style={{
                            fontSize: "1.35rem",
                            fontWeight: "950",
                            fontFamily: "monospace",
                            color: diferencia == null ? "#64748b" : (diferencia >= 0 ? "#15803d" : "#dc2626")
                          }}>
                            {diferencia != null ? `$${Math.abs(diferencia).toLocaleString("es-CO")}` : "—"}
                          </span>
                          <span style={{ fontSize: "0.62rem", color: "#64748b", display: "block", marginTop: "0.15rem" }}>
                            {diferencia == null ? "Esperando declaración" : (diferencia === 0 ? "Sin descuadres de caja" : (diferencia > 0 ? "Excedente reportado" : "Faltante para conciliar"))}
                          </span>
                        </div>
                      </div>

                      {/* Observaciones registradas al cierre */}
                      {selectedShiftForModal.observaciones && (
                        <div style={{ padding: "0.75rem 1.25rem", backgroundColor: "#f8fafc", borderTop: "1px solid #e2e8f0", fontSize: "0.72rem", color: "#475569" }}>
                          <strong style={{ color: "#0f172a" }}>Observaciones del Turno:</strong> {selectedShiftForModal.observaciones}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => setSelectedShiftForModal(null)}
                style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#475569', fontWeight: '800', cursor: 'pointer' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GENERAR NOTA CRÉDITO POS */}
      {selectedSaleForCreditNote && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '1.5rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #e2e8f0', backgroundColor: '#fef2f2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <RotateCcw size={18} style={{ color: '#b91c1c' }} />
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '950', color: '#991b1b' }}>
                  Generar Nota Crédito / Devolución
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSaleForCreditNote(null)}
                style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.75rem' }}>
                <div><strong>Ticket:</strong> {(selectedSaleForCreditNote.stores?.codigo || 'POS').toUpperCase()}-{String(selectedSaleForCreditNote.consecutive || 0).padStart(4, '0')}</div>
                <div><strong>Cliente:</strong> {selectedSaleForCreditNote.client_name || selectedSaleForCreditNote.cliente_nombre || 'Cliente General'}</div>
                <div><strong>Total Transacción:</strong> ${Number(selectedSaleForCreditNote.total || 0).toLocaleString('es-CO')}</div>
              </div>

              <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: '750' }}>Esta acción realizará lo siguiente:</p>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <li>Marcar la venta como <strong>ANULADA</strong>.</li>
                  <li><strong>Restaurar el inventario físico</strong> y las prendas serializadas a la bodega asignada al punto de venta.</li>
                  <li>Generar el movimiento de entrada en el Kardex de inventario.</li>
                </ul>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: '800', color: '#334155', display: 'block', marginBottom: '0.3rem' }}>
                  Motivo de la Nota Crédito:
                </label>
                <select
                  value={creditNoteReason}
                  onChange={(e) => setCreditNoteReason(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', backgroundColor: 'white' }}
                >
                  <option value="Devolución de prendas / Inconformidad">Devolución de prendas / Inconformidad</option>
                  <option value="Cambio de talla / Referencia">Cambio de talla / Referencia</option>
                  <option value="Error en registro de factura o cobro">Error en registro de factura o cobro</option>
                  <option value="Prenda defectuosa / Garantía">Prenda defectuosa / Garantía</option>
                  <option value="Cancelación de pedido">Cancelación de pedido</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setSelectedSaleForCreditNote(null)}
                  disabled={processingCreditNote}
                  style={{ flex: 1, padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: '800', cursor: 'pointer', fontSize: '0.78rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleExecuteCreditNote}
                  disabled={processingCreditNote}
                  style={{ flex: 1.5, padding: '0.65rem', borderRadius: '8px', border: 'none', backgroundColor: '#b91c1c', color: 'white', fontWeight: '850', cursor: 'pointer', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                >
                  {processingCreditNote ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                  {processingCreditNote ? 'Procesando...' : 'Confirmar y Restaurar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Detail View Modal for a Single Sale */}
      {selectedSaleDetail && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1.5rem'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '540px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '950', color: '#0f172a' }}>
                  Ticket {(selectedSaleDetail.stores?.codigo || currentSelectedStore?.codigo || (selectedSaleDetail.stores?.nombre || currentSelectedStore?.nombre || 'POS').substring(0, 3)).toUpperCase()}-{String(selectedSaleDetail.consecutive || 0).padStart(4, '0')}
                </h4>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  {selectedSaleDetail.created_at ? new Date(selectedSaleDetail.created_at).toLocaleString('es-CO') : '-'}
                </span>
              </div>
              <button
                onClick={() => setSelectedSaleDetail(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0.2rem' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.75rem' }}>
                <div><strong>Vendedor:</strong> {selectedSaleDetail.vendedor || selectedSaleDetail.usuario_apertura || 'Vendedor'}</div>
                <div><strong>Estado:</strong> {selectedSaleDetail.estado || 'Completada'}</div>
                <div><strong>Sucursal:</strong> {selectedSaleDetail.stores?.nombre || currentSelectedStore?.nombre || 'Punto de Venta'}</div>
                <div><strong>Cliente:</strong> {selectedSaleDetail.cliente_nombre || 'Cliente General'}</div>
                <div><strong>Documento:</strong> {selectedSaleDetail.cliente_identificacion || '222222222222'}</div>
              </div>

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>Artículos Vendidos:</span>
                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {((selectedSaleDetail.items || selectedSaleDetail.pos_sale_items) || []).map((it: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.75rem' }}>
                      <div>
                        <div style={{ fontWeight: '850', color: '#0f172a' }}>{it.cantidad || 1}x {it.products?.nombre_producto || it.nombre || 'Prenda'}</div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
                          Color: {it.colors?.nombre_color || it.color || '-'} | Talla: {it.sizes?.codigo_talla || it.talla || '-'}
                        </div>
                      </div>
                      <div style={{ fontWeight: '900', color: '#0f172a' }}>
                        ${Number(it.subtotal || it.total || 0).toLocaleString('es-CO')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedSaleDetail.observaciones && (
                <div style={{ backgroundColor: '#eff6ff', padding: '0.75rem', borderRadius: '8px', fontSize: '0.72rem', color: '#1e40af' }}>
                  <strong>Observaciones / Seriales:</strong> {selectedSaleDetail.observaciones}
                </div>
              )}

              <div style={{ borderTop: '2px solid #80082E', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: '950', color: '#0f172a' }}>TOTAL:</span>
                <span style={{ fontSize: '1.25rem', fontWeight: '950', color: '#80082E' }}>
                  ${Number(selectedSaleDetail.total || 0).toLocaleString('es-CO')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print CSS Rules */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden !important;
          }
          .printable-sales-report, .printable-sales-report * {
            visibility: visible !important;
          }
          .printable-sales-report {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            color: #000000 !important;
            background: #ffffff !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

    </div>
  );
}
