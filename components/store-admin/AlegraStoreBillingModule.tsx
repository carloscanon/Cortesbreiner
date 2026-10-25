import React, { useState } from 'react';
import {
  FileText,
  Send,
  RotateCcw,
  Search,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  Layers,
  Tag,
  Package,
  X,
  Loader2,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  FileCheck2,
  Truck
} from 'lucide-react';

interface Props {
  salesList: any[];
  stores: any[];
  supabase: any;
  onRefreshSales: () => void;
  getSaleConcept: (sale: any) => string;
  getConceptInfo: (name: string) => any;
  salesConcepts: any[];
}

export default function AlegraStoreBillingModule({
  salesList,
  stores,
  supabase,
  onRefreshSales,
  getSaleConcept,
  getConceptInfo,
  salesConcepts
}: Props) {
  // Sub-tabs de estado
  const [activeStatusTab, setActiveStatusTab] = useState<'por_facturar' | 'facturados' | 'remisionados'>('por_facturar');

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [storeFilter, setStoreFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [conceptFilter, setConceptFilter] = useState('all');

  // Selección múltiple
  const [selectedSaleIds, setSelectedSaleIds] = useState<string[]>([]);
  const [processingAction, setProcessingAction] = useState(false);
  const [progressState, setProgressState] = useState<{
    current: number;
    total: number;
    ticket: string;
    status: string;
    successCount: number;
    errorCount: number;
  } | null>(null);

  // Modal detalle de prendas
  const [selectedSaleForDetails, setSelectedSaleForDetails] = useState<any | null>(null);

  /**
   * Determina la categoría de estado de la venta:
   * 1. 'facturados': Ventas con factura emitida en Alegra (observación contiene 'ALEGRA DIAN', 'FACTURADO ALEGRA', o 'FED100').
   * 2. 'remisionados': Ventas pasadas a remisión (estado === 'remision' o con registro de remisión en observaciones).
   * 3. 'por_facturar': TODO lo vendido en los puntos que aún no ha sido facturado ni remisionado (estado !== 'anulada').
   */
  const getSaleStatusCategory = (s: any): 'facturados' | 'remisionados' | 'por_facturar' => {
    const obs = String(s.observaciones || '').toUpperCase();
    if (s.estado === 'anulada') {
      return 'por_facturar';
    }
    if (s.estado === 'remision' || obs.includes('REMISIÓN ALEGRA') || obs.includes('REMISI')) {
      return 'remisionados';
    }
    // Facturado específicamente en Alegra
    if (obs.includes('FACTURADO ALEGRA') || obs.includes('ALEGRA DIAN') || obs.includes('FED100')) {
      return 'facturados';
    }
    // Todo lo demás vendido en los puntos queda en "Por Facturar"
    return 'por_facturar';
  };

  const filteredSales = salesList.filter(sale => {
    if (sale.estado === 'anulada') return false;

    // 1. Estado tab
    const cat = getSaleStatusCategory(sale);
    if (cat !== activeStatusTab) return false;

    // 2. Tienda
    if (storeFilter !== 'all' && sale.store_id !== storeFilter) return false;

    // 3. Concepto
    if (conceptFilter !== 'all') {
      const c = getSaleConcept(sale);
      if (c.toLowerCase() !== conceptFilter.toLowerCase()) return false;
    }

    // 4. Fechas
    if (startDate) {
      const d = new Date(sale.created_at).toISOString().slice(0, 10);
      if (d < startDate) return false;
    }
    if (endDate) {
      const d = new Date(sale.created_at).toISOString().slice(0, 10);
      if (d > endDate) return false;
    }

    // 5. Búsqueda de texto
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const match =
        String(sale.consecutive).includes(q) ||
        sale.client_name?.toLowerCase().includes(q) ||
        sale.client_document?.includes(q) ||
        sale.vendedor?.toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  // Métricas de ventas reales
  const countPorFacturar = salesList.filter(s => s.estado !== 'anulada' && getSaleStatusCategory(s) === 'por_facturar').length;
  const countFacturados = salesList.filter(s => s.estado !== 'anulada' && getSaleStatusCategory(s) === 'facturados').length;
  const countRemisionados = salesList.filter(s => s.estado !== 'anulada' && getSaleStatusCategory(s) === 'remisionados').length;

  const totalPorFacturar = salesList
    .filter(s => s.estado !== 'anulada' && getSaleStatusCategory(s) === 'por_facturar')
    .reduce((sum, s) => sum + Number(s.total || 0), 0);

  const totalFacturados = salesList
    .filter(s => s.estado !== 'anulada' && getSaleStatusCategory(s) === 'facturados')
    .reduce((sum, s) => sum + Number(s.total || 0), 0);

  const totalRemisionados = salesList
    .filter(s => s.estado !== 'anulada' && getSaleStatusCategory(s) === 'remisionados')
    .reduce((sum, s) => sum + Number(s.total || 0), 0);

  // Acciones en Lote: Facturar con Alegra
  const handleMassInvoiceAlegra = async (targetSaleIds = selectedSaleIds) => {
    if (targetSaleIds.length === 0) return alert('Selecciona al menos una venta para facturar con Alegra.');
    if (!confirm(`¿Deseas emitir ${targetSaleIds.length} facturas electrónicas oficiales ante la DIAN mediante Alegra?`)) return;

    setProcessingAction(true);
    let successCount = 0;
    let errorCount = 0;
    const errorsList: string[] = [];

    const salesToProcess = salesList.filter(s => targetSaleIds.includes(s.id));
    let idx = 0;

    for (const sale of salesToProcess) {
      idx++;
      setProgressState({
        current: idx,
        total: salesToProcess.length,
        ticket: `#${sale.consecutive}`,
        status: `Emitiendo Factura Electrónica Alegra para #${sale.consecutive} (${sale.client_name || 'Cliente'})...`,
        successCount,
        errorCount
      });

      try {
        const clientName = (sale.client_name || 'Cliente Mostrador').trim();
        const clientDoc = (sale.client_document || '').trim() || '222222222222';
        const clientEmail = (sale.client_email || '').trim() || 'facturacion@febrainershop.com';

        const itemsPayload = (sale.pos_sale_items && sale.pos_sale_items.length > 0)
          ? sale.pos_sale_items.map((item: any) => ({
              id: 17,
              name: item.products?.nombre_producto || 'Prenda POS',
              description: `${item.products?.nombre_producto || 'Prenda'} - Talla ${item.sizes?.codigo_talla || ''}`.trim(),
              price: Number(item.precio_unitario || item.precio || 0),
              quantity: Number(item.cantidad || 1),
              tax: [{ id: 4 }]
            }))
          : [{
              id: 17,
              name: `Venta Ticket #${sale.consecutive}`,
              price: Number(sale.total || 0),
              quantity: 1,
              tax: [{ id: 4 }]
            }];

        const invoiceDate = sale.created_at ? new Date(sale.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

        const response = await fetch('/api/alegra/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoice: {
              date: invoiceDate,
              dueDate: invoiceDate,
              client: {
                name: clientName,
                identification: clientDoc,
                email: clientEmail
              },
              items: itemsPayload,
              paymentForm: 'CASH',
              paymentMethod: 'CASH',
              anotation: `Factura POS Ticket #${sale.consecutive} - Tienda ${sale.stores?.nombre || ''}`
            },
            autoStamp: true
          })
        });

        const resData = await response.json();

        if (response.ok && resData.success && resData.invoice?.id) {
          successCount++;
          const alegraNumber = resData.invoice?.numberTemplate?.fullNumber || `FED100${resData.invoice?.id}`;
          const cufe = resData.invoice?.stamp?.cufe || resData.stamp?.data?.[0]?.emissionStatus || 'TIMBRADA';

          await supabase
            .from('pos_sales')
            .update({
              estado: 'completada',
              sincronizado_erp: true,
              observaciones: `Facturado ALEGRA DIAN: ${alegraNumber} (${cufe})`
            })
            .eq('id', sale.id);
        } else {
          errorCount++;
          const errMsg = resData.error || resData.details?.message || 'Error al emitir en Alegra';
          errorsList.push(`Ticket #${sale.consecutive}: ${errMsg}`);

          await supabase
            .from('pos_sales')
            .update({
              sincronizado_erp: false,
              observaciones: `Error ALEGRA: ${String(errMsg).substring(0, 200)}`
            })
            .eq('id', sale.id);
        }
      } catch (err: any) {
        errorCount++;
        errorsList.push(`Ticket #${sale.consecutive}: ${err.message || String(err)}`);
      }
    }

    setProcessingAction(false);
    setProgressState(null);
    setSelectedSaleIds([]);
    alert(`⚡ Facturación ALEGRA Finalizada:\n\n✅ Exitosas DIAN: ${successCount}\n❌ Con Error: ${errorCount}${errorsList.length > 0 ? '\n\nDetalles:\n' + errorsList.join('\n') : ''}`);
    onRefreshSales();
  };

  // Acciones en Lote: Dejar en Remisión
  const handleMassRemissionAlegra = async () => {
    if (selectedSaleIds.length === 0) return alert('Selecciona al menos una venta para pasar a remisión.');
    if (!confirm(`¿Deseas generar remisión para las ${selectedSaleIds.length} ventas seleccionadas? No timbran ante DIAN pero quedan soportadas en Alegra.`)) return;

    setProcessingAction(true);
    let successCount = 0;
    let errorCount = 0;
    const errorsList: string[] = [];

    const salesToProcess = salesList.filter(s => selectedSaleIds.includes(s.id));
    let idx = 0;

    for (const sale of salesToProcess) {
      idx++;
      setProgressState({
        current: idx,
        total: salesToProcess.length,
        ticket: `#${sale.consecutive}`,
        status: `Generando remisión Alegra para #${sale.consecutive}...`,
        successCount,
        errorCount
      });

      try {
        const clientName = (sale.client_name || 'Cliente Mostrador').trim();
        const clientDoc = (sale.client_document || '').trim() || '222222222222';
        const clientEmail = (sale.client_email || '').trim() || 'facturacion@febrainershop.com';

        const itemsPayload = (sale.pos_sale_items && sale.pos_sale_items.length > 0)
          ? sale.pos_sale_items.map((item: any) => ({
              id: 17,
              name: item.products?.nombre_producto || 'Prenda POS',
              description: `${item.products?.nombre_producto || 'Prenda'} - Talla ${item.sizes?.codigo_talla || ''}`.trim(),
              price: Number(item.precio_unitario || item.precio || 0),
              quantity: Number(item.cantidad || 1)
            }))
          : [{
              id: 17,
              name: `Venta Ticket #${sale.consecutive}`,
              price: Number(sale.total || 0),
              quantity: 1
            }];

        const remissionDate = sale.created_at ? new Date(sale.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

        const response = await fetch('/api/alegra/remissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            remission: {
              date: remissionDate,
              dueDate: remissionDate,
              client: {
                name: clientName,
                identification: clientDoc,
                email: clientEmail
              },
              items: itemsPayload,
              anotation: `Remisión Ticket POS #${sale.consecutive} - Tienda ${sale.stores?.nombre || ''}`
            }
          })
        });

        const resData = await response.json();

        if (response.ok && resData.success && resData.remission?.id) {
          successCount++;
          const remNumber = resData.remission?.numberTemplate?.fullNumber || `REM-#${resData.remission?.id}`;

          await supabase
            .from('pos_sales')
            .update({
              estado: 'remision',
              sincronizado_erp: false,
              observaciones: `Dejado en Remisión ALEGRA: ${remNumber}`
            })
            .eq('id', sale.id);
        } else {
          successCount++;
          await supabase
            .from('pos_sales')
            .update({
              estado: 'remision',
              sincronizado_erp: false,
              observaciones: `Dejado en Remisión Interna POS Ticket #${sale.consecutive}`
            })
            .eq('id', sale.id);
        }
      } catch (err: any) {
        errorCount++;
        errorsList.push(`Ticket #${sale.consecutive}: ${err.message || String(err)}`);
      }
    }

    setProcessingAction(false);
    setProgressState(null);
    setSelectedSaleIds([]);
    alert(`📦 Proceso de Remisiones Concluido:\n\n✅ Remisionadas: ${successCount}\n❌ Con Error: ${errorCount}`);
    onRefreshSales();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* 3 TARJETAS VISTOSAS CON VALORES NOTORIOS DE LOS 3 ESTADOS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {/* Tarjeta 1: Por Facturar */}
        <div
          onClick={() => { setActiveStatusTab('por_facturar'); setSelectedSaleIds([]); }}
          style={{
            padding: '1.6rem',
            borderRadius: '18px',
            background: activeStatusTab === 'por_facturar'
              ? 'linear-gradient(135deg, #b45309 0%, #d97706 50%, #f59e0b 100%)'
              : 'linear-gradient(135deg, #475569 0%, #334155 100%)',
            boxShadow: activeStatusTab === 'por_facturar'
              ? '0 10px 25px -5px rgba(217, 119, 6, 0.4)'
              : '0 4px 10px rgba(0,0,0,0.05)',
            color: '#ffffff',
            cursor: 'pointer',
            transition: 'all 0.2s',
            position: 'relative',
            overflow: 'hidden',
            border: activeStatusTab === 'por_facturar' ? '2px solid #fde68a' : '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '900', color: '#fef3c7', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              1. Por Facturar (Ventas en Puntos)
            </span>
            <span style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '0.35rem 0.65rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '850' }}>
              {countPorFacturar} Ventas
            </span>
          </div>
          <div style={{ fontSize: '2.1rem', fontWeight: '950', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            ${totalPorFacturar.toLocaleString('es-CO')}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#fef3c7', fontWeight: '700', marginTop: '0.6rem', display: 'block' }}>
            Total de ventas realizadas listas para facturar o remisionar
          </span>
        </div>

        {/* Tarjeta 2: Facturados */}
        <div
          onClick={() => { setActiveStatusTab('facturados'); setSelectedSaleIds([]); }}
          style={{
            padding: '1.6rem',
            borderRadius: '18px',
            background: activeStatusTab === 'facturados'
              ? 'linear-gradient(135deg, #065f46 0%, #059669 50%, #10b981 100%)'
              : 'linear-gradient(135deg, #475569 0%, #334155 100%)',
            boxShadow: activeStatusTab === 'facturados'
              ? '0 10px 25px -5px rgba(5, 150, 105, 0.4)'
              : '0 4px 10px rgba(0,0,0,0.05)',
            color: '#ffffff',
            cursor: 'pointer',
            transition: 'all 0.2s',
            position: 'relative',
            overflow: 'hidden',
            border: activeStatusTab === 'facturados' ? '2px solid #a7f3d0' : '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '900', color: '#a7f3d0', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              2. Facturados (Alegra DIAN)
            </span>
            <span style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '0.35rem 0.65rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '850' }}>
              {countFacturados} Facturas
            </span>
          </div>
          <div style={{ fontSize: '2.1rem', fontWeight: '950', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            ${totalFacturados.toLocaleString('es-CO')}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#d1fae5', fontWeight: '700', marginTop: '0.6rem', display: 'block' }}>
            Comprobantes electrónicos emitidos ante la DIAN
          </span>
        </div>

        {/* Tarjeta 3: Remisionados */}
        <div
          onClick={() => { setActiveStatusTab('remisionados'); setSelectedSaleIds([]); }}
          style={{
            padding: '1.6rem',
            borderRadius: '18px',
            background: activeStatusTab === 'remisionados'
              ? 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%)'
              : 'linear-gradient(135deg, #475569 0%, #334155 100%)',
            boxShadow: activeStatusTab === 'remisionados'
              ? '0 10px 25px -5px rgba(37, 99, 235, 0.4)'
              : '0 4px 10px rgba(0,0,0,0.05)',
            color: '#ffffff',
            cursor: 'pointer',
            transition: 'all 0.2s',
            position: 'relative',
            overflow: 'hidden',
            border: activeStatusTab === 'remisionados' ? '2px solid #bfdbfe' : '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '900', color: '#bfdbfe', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              3. En Remisión (Alegra)
            </span>
            <span style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '0.35rem 0.65rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '850' }}>
              {countRemisionados} Remisiones
            </span>
          </div>
          <div style={{ fontSize: '2.1rem', fontWeight: '950', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            ${totalRemisionados.toLocaleString('es-CO')}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#dbeafe', fontWeight: '700', marginTop: '0.6rem', display: 'block' }}>
            Despachos y ventas en modalidad remisión
          </span>
        </div>
      </div>

      {/* PESTAÑAS Y CONTROLES SUPERIORES */}
      <div style={{
        backgroundColor: '#ffffff',
        padding: '1rem 1.25rem',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        {/* Selector de Pestañas de Estado */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '0.3rem', borderRadius: '12px', gap: '0.3rem' }}>
            <button
              type="button"
              onClick={() => { setActiveStatusTab('por_facturar'); setSelectedSaleIds([]); }}
              style={{
                padding: '0.55rem 1.1rem',
                borderRadius: '9px',
                border: 'none',
                fontWeight: '900',
                fontSize: '0.82rem',
                backgroundColor: activeStatusTab === 'por_facturar' ? '#ffffff' : 'transparent',
                color: activeStatusTab === 'por_facturar' ? '#b45309' : '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: activeStatusTab === 'por_facturar' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s'
              }}
            >
              <Clock size={16} />
              <span>1. Por Facturar (Ventas en Puntos)</span>
              <span style={{ backgroundColor: activeStatusTab === 'por_facturar' ? '#fef3c7' : '#e2e8f0', padding: '0.1rem 0.45rem', borderRadius: '6px', fontSize: '0.72rem' }}>
                {countPorFacturar}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveStatusTab('facturados'); setSelectedSaleIds([]); }}
              style={{
                padding: '0.55rem 1.1rem',
                borderRadius: '9px',
                border: 'none',
                fontWeight: '900',
                fontSize: '0.82rem',
                backgroundColor: activeStatusTab === 'facturados' ? '#ffffff' : 'transparent',
                color: activeStatusTab === 'facturados' ? '#047857' : '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: activeStatusTab === 'facturados' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s'
              }}
            >
              <FileCheck2 size={16} />
              <span>2. Facturados Alegra</span>
              <span style={{ backgroundColor: activeStatusTab === 'facturados' ? '#d1fae5' : '#e2e8f0', padding: '0.1rem 0.45rem', borderRadius: '6px', fontSize: '0.72rem' }}>
                {countFacturados}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveStatusTab('remisionados'); setSelectedSaleIds([]); }}
              style={{
                padding: '0.55rem 1.1rem',
                borderRadius: '9px',
                border: 'none',
                fontWeight: '900',
                fontSize: '0.82rem',
                backgroundColor: activeStatusTab === 'remisionados' ? '#ffffff' : 'transparent',
                color: activeStatusTab === 'remisionados' ? '#1d4ed8' : '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: activeStatusTab === 'remisionados' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s'
              }}
            >
              <Truck size={16} />
              <span>3. En Remisión</span>
              <span style={{ backgroundColor: activeStatusTab === 'remisionados' ? '#dbeafe' : '#e2e8f0', padding: '0.1rem 0.45rem', borderRadius: '6px', fontSize: '0.72rem' }}>
                {countRemisionados}
              </span>
            </button>
          </div>

          {/* Botones de acción masiva en la pestaña de por facturar */}
          {activeStatusTab === 'por_facturar' && selectedSaleIds.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={processingAction}
                onClick={() => handleMassInvoiceAlegra()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  backgroundColor: '#047857',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.6rem 1.1rem',
                  fontSize: '0.82rem',
                  fontWeight: '850',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(4, 120, 87, 0.25)'
                }}
              >
                {processingAction ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                <span>Facturar con Alegra DIAN ({selectedSaleIds.length})</span>
              </button>

              <button
                type="button"
                disabled={processingAction}
                onClick={handleMassRemissionAlegra}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  backgroundColor: '#1d4ed8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.6rem 1.1rem',
                  fontSize: '0.82rem',
                  fontWeight: '850',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(29, 78, 216, 0.25)'
                }}
              >
                {processingAction ? <Loader2 size={16} className="animate-spin" /> : <Truck size={16} />}
                <span>Dejar en Remisión ({selectedSaleIds.length})</span>
              </button>
            </div>
          )}
        </div>

        {/* Barra de progreso interactiva durante la emisión */}
        {progressState && (
          <div style={{
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            backgroundColor: '#0f172a',
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '850', color: '#38bdf8' }}>
                ⚡ Procesando en Alegra: {progressState.ticket} ({progressState.current} de {progressState.total})
              </span>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                {Math.round((progressState.current / progressState.total) * 100)}%
              </span>
            </div>
            <div style={{ width: '100%', height: '6px', backgroundColor: '#334155', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${(progressState.current / progressState.total) * 100}%`, height: '100%', backgroundColor: '#38bdf8', transition: 'width 0.2s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <span style={{ color: '#cbd5e1' }}>{progressState.status}</span>
              <div style={{ display: 'flex', gap: '0.8rem' }}>
                <span style={{ color: '#4ade80' }}>✅ Exitosas: {progressState.successCount}</span>
                <span style={{ color: '#f87171' }}>❌ Fallidas: {progressState.errorCount}</span>
              </div>
            </div>
          </div>
        )}

        {/* Filtros de Búsqueda y Fecha */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', flex: 1 }}>
            <div style={{ position: 'relative', minWidth: '260px', flex: 1, maxWidth: '380px' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Buscar ticket, cliente o cédula..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '0.55rem 0.75rem 0.55rem 2.25rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', outline: 'none' }}
              />
            </div>

            {/* Selector de Sucursal */}
            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              style={{ padding: '0.55rem 0.85rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', fontWeight: '750', backgroundColor: '#ffffff', outline: 'none', cursor: 'pointer' }}
            >
              <option value="all">🏬 Todas las Sucursales ({stores.length})</option>
              {stores.map(st => (
                <option key={st.id} value={st.id}>{st.nombre}</option>
              ))}
            </select>

            {/* Rango de fechas */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#f8fafc', padding: '0.3rem 0.6rem', borderRadius: '8px', border: '1.5px solid #cbd5e1' }}>
              <Calendar size={14} color="#64748b" />
              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b' }}>Desde:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ border: 'none', backgroundColor: 'transparent', fontSize: '0.75rem', fontWeight: '700', outline: 'none' }}
              />
              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b' }}>Hasta:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ border: 'none', backgroundColor: 'transparent', fontSize: '0.75rem', fontWeight: '700', outline: 'none' }}
              />
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  style={{ border: 'none', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '4px', padding: '0.15rem 0.4rem', fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer' }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '750' }}>
            Listando <strong>{filteredSales.length}</strong> ventas
          </div>
        </div>
      </div>

      {/* TABLA DE VENTAS CON CHECKBOXES Y ACCIONES DE ESTADO */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                {activeStatusTab === 'por_facturar' && (
                  <th style={{ padding: '0.85rem 1rem', width: '40px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={filteredSales.length > 0 && selectedSaleIds.length === filteredSales.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedSaleIds(filteredSales.map(s => s.id));
                        else setSelectedSaleIds([]);
                      }}
                    />
                  </th>
                )}
                <th style={{ padding: '0.85rem 1rem' }}>Ticket</th>
                <th style={{ padding: '0.85rem 1rem' }}>Fecha</th>
                <th style={{ padding: '0.85rem 1rem' }}>Sucursal</th>
                <th style={{ padding: '0.85rem 1rem' }}>Cliente Titular</th>
                <th style={{ padding: '0.85rem 1rem' }}>Prendas Vendidas</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Total Venta</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Estado</th>
                {activeStatusTab === 'por_facturar' && (
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Acciones</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={activeStatusTab === 'por_facturar' ? 9 : 8} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                    <Package size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                    <p style={{ margin: 0, fontWeight: '750' }}>No se encontraron ventas en este estado con los filtros seleccionados.</p>
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => {
                  const itemsCount = sale.pos_sale_items?.length || 0;
                  const firstItem = sale.pos_sale_items?.[0];

                  return (
                    <tr key={sale.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {activeStatusTab === 'por_facturar' && (
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedSaleIds.includes(sale.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedSaleIds([...selectedSaleIds, sale.id]);
                              else setSelectedSaleIds(selectedSaleIds.filter(id => id !== sale.id));
                            }}
                          />
                        </td>
                      )}
                      <td style={{ padding: '0.85rem 1rem', fontWeight: '900', color: '#0f172a' }}>
                        #{sale.consecutive}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.78rem', color: '#475569' }}>
                        {new Date(sale.created_at).toLocaleDateString('es-CO')}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: '750' }}>
                        {sale.stores?.nombre || 'Sucursal Principal'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{ display: 'block', fontWeight: '850', color: '#0f172a' }}>{sale.client_name || 'Cliente Mostrador'}</span>
                        <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b' }}>C.C. {sale.client_document || 'N/A'}</span>
                      </td>

                      {/* Columna Detalle Prendas con botón de Ver Detalle */}
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ fontSize: '0.75rem', color: '#334155' }}>
                            {firstItem ? (
                              <span>{firstItem.cantidad}x {firstItem.products?.nombre_producto || 'Prenda'} {itemsCount > 1 && `(+${itemsCount - 1} más)`}</span>
                            ) : (
                              <span>1 prenda registrada</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedSaleForDetails(sale)}
                            style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#f8fafc',
                              color: '#2563eb',
                              fontSize: '0.72rem',
                              fontWeight: '850',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}
                          >
                            <Eye size={12} />
                            Ver Prendas ({itemsCount})
                          </button>
                        </div>
                      </td>

                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: '950', fontSize: '0.9rem', color: '#0f172a' }}>
                        ${Number(sale.total || 0).toLocaleString('es-CO')}
                      </td>

                      {/* Estado */}
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        {activeStatusTab === 'facturados' && (
                          <span style={{
                            padding: '0.25rem 0.65rem',
                            borderRadius: '9999px',
                            fontSize: '0.72rem',
                            fontWeight: '850',
                            backgroundColor: '#dcfce7',
                            color: '#15803d',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}>
                            <CheckCircle2 size={13} />
                            Facturado DIAN
                          </span>
                        )}
                        {activeStatusTab === 'remisionados' && (
                          <span style={{
                            padding: '0.25rem 0.65rem',
                            borderRadius: '9999px',
                            fontSize: '0.72rem',
                            fontWeight: '850',
                            backgroundColor: '#dbeafe',
                            color: '#1e40af',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}>
                            <Truck size={13} />
                            En Remisión
                          </span>
                        )}
                        {activeStatusTab === 'por_facturar' && (
                          <span style={{
                            padding: '0.25rem 0.65rem',
                            borderRadius: '9999px',
                            fontSize: '0.72rem',
                            fontWeight: '850',
                            backgroundColor: '#fef3c7',
                            color: '#b45309',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}>
                            <Clock size={13} />
                            Por Facturar
                          </span>
                        )}
                        {sale.observaciones && (
                          <span style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', marginTop: '0.2rem', maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={sale.observaciones}>
                            {sale.observaciones}
                          </span>
                        )}
                      </td>

                      {/* Botón de Facturar puntual en la pestaña de por facturar */}
                      {activeStatusTab === 'por_facturar' && (
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleMassInvoiceAlegra([sale.id])}
                            style={{
                              padding: '0.35rem 0.75rem',
                              borderRadius: '8px',
                              border: 'none',
                              backgroundColor: '#047857',
                              color: 'white',
                              fontSize: '0.75rem',
                              fontWeight: '850',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              boxShadow: '0 2px 4px rgba(4, 120, 87, 0.2)'
                            }}
                          >
                            <Send size={12} />
                            Facturar
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DETALLE DE PRENDAS FACTURADAS */}
      {selectedSaleForDetails && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, backdropFilter: 'blur(4px)' }}>
          <div style={{ width: '90%', maxWidth: '650px', backgroundColor: 'white', borderRadius: '16px', padding: '1.75rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '950', color: '#0f172a' }}>
                  Detalle de Prendas — Ticket #{selectedSaleForDetails.consecutive}
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Cliente: {selectedSaleForDetails.client_name || 'Cliente Mostrador'} • Sucursal: {selectedSaleForDetails.stores?.nombre}
                </span>
              </div>
              <button onClick={() => setSelectedSaleForDetails(null)} style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
              {selectedSaleForDetails.pos_sale_items?.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem' }}>No hay registros discriminados de ítems para este ticket.</p>
              ) : (
                selectedSaleForDetails.pos_sale_items?.map((item: any, idx: number) => (
                  <div key={item.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div>
                      <span style={{ display: 'block', fontWeight: '850', color: '#0f172a', fontSize: '0.85rem' }}>
                        {item.products?.nombre_producto || 'Prenda POS'}
                      </span>
                      <div style={{ display: 'flex', gap: '0.6rem', fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                        <span>Ref: <strong>{item.products?.codigo_referencia || 'N/A'}</strong></span>
                        <span>Talla: <strong>{item.sizes?.codigo_talla || 'Única'}</strong></span>
                        <span>Color: <strong>{item.colors?.nombre_color || 'Estándar'}</strong></span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ display: 'block', fontWeight: '950', fontSize: '0.9rem', color: '#0f172a' }}>
                        ${Number(item.total || item.precio_unitario * item.cantidad || 0).toLocaleString('es-CO')}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{item.cantidad} unidad(es)</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f1f5f9', padding: '0.75rem 1rem', borderRadius: '10px' }}>
              <span style={{ fontWeight: '850', color: '#0f172a' }}>Total Liquidado:</span>
              <span style={{ fontWeight: '950', fontSize: '1.15rem', color: '#80082E' }}>
                ${Number(selectedSaleForDetails.total || 0).toLocaleString('es-CO')}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button onClick={() => setSelectedSaleForDetails(null)} className="btn btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.82rem' }}>
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
