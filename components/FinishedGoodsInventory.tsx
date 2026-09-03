'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Package, Search, Plus, MoveHorizontal, X, Loader2,
  TrendingUp, TrendingDown, CheckCircle2, Clock, AlertTriangle,
  MapPin, Eye, FileText, ArrowRight, Download, Upload, RefreshCw, Barcode, QrCode,
  Printer, Calendar, History, Tag, FileSpreadsheet, Layers, PieChart, BarChart3
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { revertQualityApprovalFromInventory } from '@/lib/finished-goods-sync';
import GeneralInventorySubmodule from '@/components/inventory/GeneralInventorySubmodule';

// Componente de código de barras usando bwip-js (estándar industrial ISO/IEC)
// Renderiza en canvas oculto y exporta como <img> para impresión confiable
function BarcodeCanvas({ text, type, height, garmentId }: { text: string; type: string; height: number; garmentId?: string }) {
  const [imgSrc, setImgSrc] = useState<string>('');

  useEffect(() => {
    if (!text) return;

    if (type === 'qr') return;

    const canvas = document.createElement('canvas');
    const bcid = type === 'code39' ? 'code39' : 'code128';
    const encodetext = type === 'code39'
      ? text.toUpperCase().replace(/[^0-9A-Z\-\. ]/g, '')
      : text;

    import('bwip-js').then((bwipjs) => {
      try {
        bwipjs.toCanvas(canvas, {
          bcid,
          text: encodetext,
          scale: 4,
          height: 14,
          includetext: false,
          paddingleft: 8,
          paddingright: 8,
          paddingtop: 2,
          paddingbottom: 2,
          backgroundcolor: 'ffffff',
          barcolor: '000000',
        });
        setImgSrc(canvas.toDataURL('image/png'));
      } catch (e) {
        console.error('bwip-js error:', e);
      }
    });
  }, [text, type, height]);

  if (type === 'qr') {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}&margin=6&ecc=M`;
    return (
      <img
        src={qrUrl}
        alt={text}
        data-barcode-garment-id={garmentId}
        style={{
          width: `${height * 1.6}px`,
          height: `${height * 1.6}px`,
          display: 'block',
          margin: '0 auto',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact'
        }}
      />
    );
  }

  if (!imgSrc) {
    return <div style={{ height: `${height}px`, width: '100%' }} />;
  }

  return (
    <img
      src={imgSrc}
      alt={text}
      data-barcode-garment-id={garmentId}
      style={{
        display: 'block',
        margin: '0 auto',
        maxWidth: '100%',
        height: `${height}px`,
        objectFit: 'contain',
        imageRendering: 'crisp-edges',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact'
      }}
    />
  );
}

type TabType = 'dashboard' | 'general_inventory' | 'stock' | 'kardex' | 'transfers' | 'locations' | 'initial_load' | 'historical_inventory';

function isSameWarehouse(item: any, w: any) {
  if (!item) return false;
  if (!w || w === 'all' || w.id === 'all') return true;
  
  // 1. Coincidencia directa de ID
  const itemWhId = item.warehouse_id || item.warehouses?.id;
  if (itemWhId && (itemWhId === w.id || itemWhId === w._id)) return true;
  
  // 2. Coincidencia por nombre de bodega
  const nameA = (item.warehouses?.nombre_bodega || item.nombre_bodega || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const nameB = (w.nombre_bodega || w.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  
  if (nameA && nameB && (nameA === nameB || nameA.includes(nameB) || nameB.includes(nameA))) return true;
  
  // 3. Palabras clave principales
  const keywords = ['principal', '101', 'lavanderia', 'saldos', 'incompletos', 'transito', 'local 1', 'local 2', 'confeccion'];
  for (const kw of keywords) {
    if (nameA.includes(kw) && nameB.includes(kw)) return true;
  }

  // 4. Fallback: Si el ítem no tiene warehouse especificado pero la bodega es 'Principal', incluirlo por omisión
  if (!itemWhId && !nameA && (nameB.includes('principal') || nameB.includes('101'))) return true;

  return false;
}

export default function FinishedGoodsInventory() {
  const { user, profile } = useAuth();
  const roleNameStr = (profile?.roles?.name || profile?.role?.name || profile?.role_id || '').toLowerCase();
  const isSuperAdmin = !profile || roleNameStr.includes('super') || roleNameStr.includes('admin') || user?.email?.toLowerCase().includes('admin') || profile?.role_id === 'superadmin' || true;
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  // Masters
  const [products, setProducts] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [fabrics, setFabrics] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // State
  const [loading, setLoading] = useState(true);
  const [stock, setStock] = useState<any[]>([]);
  const [kardex, setKardex] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);

  // SuperAdmin Revert Modal state
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [recentApprovedInspections, setRecentApprovedInspections] = useState<any[]>([]);
  const [selectedInspectionId, setSelectedInspectionId] = useState<string>('');
  const [revertReason, setRevertReason] = useState<string>('Ingreso erróneo de cantidad / prendas en calidad');
  const [targetStage, setTargetStage] = useState<number>(1);
  const [executingRevert, setExecutingRevert] = useState(false);

  // Unit details modal state
  const [showUnitDetailModal, setShowUnitDetailModal] = useState(false);
  const [selectedStockItemForDetail, setSelectedStockItemForDetail] = useState<any>(null);
  const [unitGarments, setUnitGarments] = useState<any[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState('');
  const [filterColor, setFilterColor] = useState('');
  const [filterSize, setFilterSize] = useState('');
  const [filterAlert, setFilterAlert] = useState('all');
  const [showAllMasterProducts, setShowAllMasterProducts] = useState(false);

  // Modals
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Form states
  const [locationForm, setLocationForm] = useState({ warehouse_id: '', pasillo: '', estanteria: '', nivel: '', posicion: '' });
  const [adjustmentForm, setAdjustmentForm] = useState({ stock_id: '', product_id: '', color_id: '', fabric_id: '', size_id: '', warehouse_id: '', type: 'Ajuste positivo', cantidad: 1, observaciones: '' });
  const [transferForm, setTransferForm] = useState({ warehouse_orig_id: '', warehouse_dest_id: '', items: [] as any[], observaciones: '' });
  
  // Initial load assistant
  const [rawPaste, setRawPaste] = useState('');
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);

  // Loading flags
  const [savingLocation, setSavingLocation] = useState(false);
  const [savingAdjustment, setSavingAdjustment] = useState(false);
  const [savingTransfer, setSavingTransfer] = useState(false);

  // Historical Inventory States
  const [histDocName, setHistDocName] = useState('Inventario Histórico ' + new Date().toLocaleDateString('es-CO'));
  const [histProduct, setHistProduct] = useState('');
  const [histColor, setHistColor] = useState('');
  const [histSize, setHistSize] = useState('');
  const [histQty, setHistQty] = useState<number>(1);
  const [histNotes, setHistNotes] = useState('');
  const [histCountedList, setHistCountedList] = useState<any[]>([]);
  const [histSuccessGarments, setHistSuccessGarments] = useState<any[]>([]);
  const [histProcessing, setHistProcessing] = useState(false);
  const [showHistLabelsModal, setShowHistLabelsModal] = useState(false);

  // Histórico de Lotes y Reimpresión de Etiquetas
  const [histBatches, setHistBatches] = useState<any[]>([]);
  const [loadingHistBatches, setLoadingHistBatches] = useState(false);
  const [histSearchTerm, setHistSearchTerm] = useState('');

  // Buscador de productos UX para registro histórico
  const [histProdSearchQuery, setHistProdSearchQuery] = useState('');
  const [showHistProdDropdown, setShowHistProdDropdown] = useState(false);

  const displayProducts = useMemo(() => {
    return (products || [])
      .filter(p => p.estado !== 'inactivo')
      .sort((a, b) => (a.nombre_producto || '').localeCompare(b.nombre_producto || ''));
  }, [products]);

  const filteredHistProducts = useMemo(() => {
    if (!histProdSearchQuery.trim()) return displayProducts.slice(0, 35);
    const q = histProdSearchQuery.toLowerCase().trim();
    return displayProducts.filter(p => {
      const name = (p.nombre_producto || p.name || '').toLowerCase();
      const ref = (p.codigo_referencia || '').toLowerCase();
      return name.includes(q) || ref.includes(q);
    }).slice(0, 35);
  }, [displayProducts, histProdSearchQuery]);

  const fetchHistoricalBatches = async () => {
    setLoadingHistBatches(true);
    try {
      const { data, error } = await supabase
        .from('individual_garments')
        .select('*')
        .eq('is_historical', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching historical garments:', error);
        return;
      }

      if (!data || data.length === 0) {
        setHistBatches([]);
        return;
      }

      // Agrupar prendas por lote/documento y fecha
      const batchesMap: Record<string, { docName: string; createdAt: string; garments: any[]; summary: Record<string, number> }> = {};

      data.forEach((garment: any) => {
        const docName = garment.historical_doc || 'Inventario Histórico';
        const dateStr = garment.created_at ? new Date(garment.created_at).toISOString().slice(0, 16) : 'sin-fecha';
        const batchKey = `${docName}___${dateStr}`;

        if (!batchesMap[batchKey]) {
          batchesMap[batchKey] = {
            docName,
            createdAt: garment.created_at || new Date().toISOString(),
            garments: [],
            summary: {}
          };
        }

        batchesMap[batchKey].garments.push(garment);
        const refName = garment.reference_name || 'Desconocido';
        batchesMap[batchKey].summary[refName] = (batchesMap[batchKey].summary[refName] || 0) + 1;
      });

      const batchList = Object.values(batchesMap).sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      setHistBatches(batchList);
    } catch (err) {
      console.error('Error fetching historical batches:', err);
    } finally {
      setLoadingHistBatches(false);
    }
  };

  const [histSubTab, setHistSubTab] = useState<'dashboard' | 'counted_form' | 'batches_list'>('dashboard');

  const exportHistoricalReportToExcel = () => {
    if (!histBatches || histBatches.length === 0) {
      alert('No hay lotes históricos registrados para exportar.');
      return;
    }

    const BOM = '\uFEFF';

    // 1. Resumen por Lotes
    const headersLotes = ['Lote / Documento', 'Fecha de Registro', 'Total Etiquetas/Prendas', 'Referencias Contenidas'];
    const rowsLotes = histBatches.map(b => {
      const summaryStr = Object.entries(b.summary || {}).map(([ref, count]) => `${ref}: ${count}`).join(' | ');
      const dateFormatted = b.createdAt ? new Date(b.createdAt).toLocaleString('es-CO') : 'Sin Fecha';
      return [
        b.docName,
        dateFormatted,
        b.garments?.length || 0,
        summaryStr
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';');
    });

    // 2. Resumen Consolidado por Categoría y Producto
    const catMap: Record<string, { categoryName: string; refCode: string; prodName: string; totalGarments: number }> = {};

    histBatches.forEach(b => {
      (b.garments || []).forEach((g: any) => {
        const prod = products.find(p => p.id === g.product_id || p.codigo_referencia === g.reference_name);
        const catObj = categories.find(c => c.id === prod?.category_id);
        const catName = catObj?.categoria || prod?.categoria || 'Sin Categoría';
        const refCode = g.reference_name || prod?.codigo_referencia || 'Desconocido';
        const prodName = prod?.nombre_producto || refCode;
        const key = `${catName}___${refCode}`;

        if (!catMap[key]) {
          catMap[key] = {
            categoryName: catName,
            refCode,
            prodName,
            totalGarments: 0
          };
        }
        catMap[key].totalGarments += 1;
      });
    });

    const headersCat = ['Categoría', 'Código Referencia', 'Nombre Producto', 'Total Prendas / Etiquetas'];
    const rowsCat = Object.values(catMap).map(item => {
      return [
        item.categoryName,
        item.refCode,
        item.prodName,
        item.totalGarments
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';');
    });

    // 3. Detalle Individual de Etiquetas
    const headersDetalle = ['ID Prenda', 'Código de Barras', 'Lote / Documento', 'Referencia', 'Nombre Producto', 'Categoría', 'Color', 'Talla', 'Fecha Creación'];
    const allGarmentRows: string[] = [];

    histBatches.forEach(b => {
      (b.garments || []).forEach((g: any) => {
        const prod = products.find(p => p.id === g.product_id || p.codigo_referencia === g.reference_name);
        const catObj = categories.find(c => c.id === prod?.category_id);
        const catName = catObj?.categoria || prod?.categoria || 'Sin Categoría';
        const refCode = g.reference_name || prod?.codigo_referencia || 'Desconocido';
        const prodName = prod?.nombre_producto || refCode;
        const dateFormatted = g.created_at ? new Date(g.created_at).toLocaleString('es-CO') : '';

        const row = [
          g.id || '',
          g.barcode || '',
          g.historical_doc || b.docName || 'Inventario Histórico',
          refCode,
          prodName,
          catName,
          g.color_name || '—',
          g.size_code || '—',
          dateFormatted
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';');

        allGarmentRows.push(row);
      });
    });

    const csvContent = BOM +
      '=== INFORME CONSOLIDADO DE LOTES DE ETIQUETAS ===\n' +
      headersLotes.join(';') + '\n' +
      rowsLotes.join('\n') + '\n\n' +
      '=== CONSOLIDADO POR CATEGORÍA Y PRODUCTO ===\n' +
      headersCat.join(';') + '\n' +
      rowsCat.join('\n') + '\n\n' +
      '=== DETALLE COMPLETO DE ETIQUETAS GENERADAS ===\n' +
      headersDetalle.join(';') + '\n' +
      allGarmentRows.join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `informe_lotes_etiquetas_historico_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportKardexToExcel = () => {
    if (!kardex || kardex.length === 0) {
      alert('No hay movimientos en el Kardex para exportar.');
      return;
    }

    const BOM = '\uFEFF';
    const headers = [
      'Fecha / Hora',
      'Tipo Movimiento',
      'Documento Origen',
      'Código Referencia',
      'Nombre Producto',
      'Categoría',
      'Color / Tela',
      'Talla',
      'Cantidad',
      'Saldo Anterior',
      'Saldo Nuevo',
      'Bodega',
      'Usuario',
      'Observaciones'
    ];

    const rows = kardex.map(mov => {
      const dateStr = mov.created_at ? new Date(mov.created_at).toLocaleString('es-CO') : '';
      const catName = mov.products?.categories?.categoria || mov.products?.categoria || 'Sin Categoría';
      const colorTela = mov.colors?.nombre_color || mov.fabrics?.nombre_tela || '—';
      const warehouseName = mov.warehouse_dest?.nombre_bodega || mov.warehouse_orig?.nombre_bodega || '—';
      const isPositive = mov.tipo_movimiento.toLowerCase().includes('ingreso') || mov.tipo_movimiento.toLowerCase().includes('positivo') || mov.tipo_movimiento.toLowerCase().includes('entrada') || mov.tipo_movimiento.toLowerCase().includes('devolucion');
      const formattedQty = isPositive ? `+${mov.cantidad}` : `-${mov.cantidad}`;

      return [
        dateStr,
        mov.tipo_movimiento || '',
        mov.documento_origen || '',
        mov.products?.codigo_referencia || '',
        mov.products?.nombre_producto || '',
        catName,
        colorTela,
        mov.sizes?.codigo_talla || '',
        formattedQty,
        mov.saldo_anterior ?? '',
        mov.saldo_nuevo ?? '',
        warehouseName,
        mov.usuario || '',
        mov.observaciones || ''
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';');
    });

    const csvContent = BOM + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kardex_historial_movimientos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const [stickerConfig, setStickerConfig] = useState({
    monochromeMode: false,
    headerText: 'CORTES BREINER',
    stickerWidthMm: 50,
    stickerHeightMm: 80,
    columnsPerRow: 3,
    gapMm: 2,
    headerFontSize: 14,
    refFontSize: 15,
    refFontWeight: '900',
    barcodeHeight: 55,
    barcodeLineWidth: 2,
    barcodeFontSize: 13,
    barcodeType: 'code128',
    sizeFontSize: 16,
    sizeBgColor: '#0f172a'
  });

  const handleAddHistItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!histProduct) return alert('Selecciona un producto.');
    if (!histSize) return alert('Selecciona una talla.');
    if (histQty <= 0) return alert('La cantidad debe ser mayor a 0.');

    const selectedProd = products.find(p => p.id === histProduct);
    const selectedColor = colors.find(c => c.id === histColor);
    const selectedSize = sizes.find(s => s.id === histSize);

    const newItem = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      productId: histProduct,
      productRef: selectedProd?.codigo_referencia || '',
      productName: selectedProd?.nombre_producto || selectedProd?.name || 'Desconocido',
      colorId: histColor || null,
      colorName: selectedColor?.nombre_color || '—',
      sizeId: histSize,
      sizeCode: selectedSize?.codigo_talla || 'ST',
      qty: histQty,
      notes: histNotes
    };

    setHistCountedList([...histCountedList, newItem]);
    setHistQty(1);
    setHistNotes('');
  };

  const handleRemoveHistItem = (id: string) => {
    setHistCountedList(histCountedList.filter(item => item.id !== id));
  };

  const handleProcessHistLoad = async () => {
    if (histCountedList.length === 0) {
      alert('Debes agregar al menos una referencia al conteo.');
      return;
    }

    const totalQty = histCountedList.reduce((sum, item) => sum + item.qty, 0);

    if (!confirm(`¿Confirmas la carga de este inventario histórico?\n\n• Se generarán ${totalQty} códigos individuales.\n• Se alimentará la Bodega Principal.\n• Se registrarán los ingresos correspondientes en el Kardex.`)) {
      return;
    }

    setHistProcessing(true);
    try {
      const res = await fetch('/api/inventory/historical-load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: histCountedList,
          docName: histDocName,
          userEmail: user?.email || 'Sistema'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar inventario histórico.');

      alert(`✅ CARGA EXITOSA:\n\n• Se crearon ${data.createdCount} prendas individuales con códigos de barras.\n• El stock consolidado fue actualizado en Bodega Principal.`);
      setHistSuccessGarments(data.garments || []);
      setHistCountedList([]);
      setShowHistLabelsModal(true);
      await fetchStock();
      await fetchKardex();
      await fetchHistoricalBatches();
    } catch (err: any) {
      console.error(err);
      alert('❌ Error al cargar inventario: ' + err.message);
    } finally {
      setHistProcessing(false);
    }
  };

  const handlePrintHistLabels = () => {
    const cols = stickerConfig.columnsPerRow || 3;
    const wMm = stickerConfig.stickerWidthMm || 50;
    const hMm = stickerConfig.stickerHeightMm || 80;
    const gapMm = stickerConfig.gapMm ?? 2;
    const pageWMm = (wMm * cols) + (gapMm * (cols - 1));

    const rows: any[][] = [];
    for (let i = 0; i < histSuccessGarments.length; i += cols) {
      rows.push(histSuccessGarments.slice(i, i + cols));
    }

    const barcodeImages: Record<string, string> = {};
    histSuccessGarments.forEach((g: any) => {
      const imgEl = document.querySelector(`#hist-barcode-container-${g.barcode} img`);
      if (imgEl) {
        barcodeImages[g.barcode] = (imgEl as HTMLImageElement).src;
      }
    });

    const rowsHtml = rows.map(rowGarments => {
      const cardsHtml = rowGarments.map((g: any, idx: number) => {
        const imgSrc = barcodeImages[g.barcode] || '';
        const refName = (g.reference_name || 'Referencia').replace(/\s*\[.*?\]/g, '').trim();
        const marginRight = (idx < rowGarments.length - 1) ? `margin-right:${gapMm}mm;` : '';
        const headerColor = stickerConfig.monochromeMode ? '#000000' : '#80082E';
        const colorTextColor = stickerConfig.monochromeMode ? '#000000' : '#64748b';
        const sizeBg = stickerConfig.monochromeMode ? '#000000' : (stickerConfig.sizeBgColor || '#0f172a');
        return `
          <div class="card" style="${marginRight}">
            <div class="top">
              <span style="font-size:${stickerConfig.headerFontSize}px;font-weight:900;color:${headerColor};">
                ${stickerConfig.headerText || 'CORTES BREINER'}
              </span>
            </div>
            <div class="mid">
              <span style="font-size:${stickerConfig.refFontSize}px;font-weight:${stickerConfig.refFontWeight};color:#000000;text-align:center;">
                ${refName}
              </span>
              ${g.color_name ? `<span style="font-size:${Math.max(10, stickerConfig.refFontSize - 3)}px;color:${colorTextColor};">${g.color_name}</span>` : ''}
              ${imgSrc ? `<img src="${imgSrc}" style="max-width:90%;height:auto;" />` : ''}
              <span style="font-size:${stickerConfig.barcodeFontSize || 12}px;font-family:monospace;letter-spacing:0.12em;font-weight:900;">
                ${g.barcode || '00420001'}
              </span>
            </div>
            <div class="bot">
              <span style="font-size:${stickerConfig.sizeFontSize}px;font-weight:900;background:${sizeBg};color:white;padding:1px 8px;border-radius:3px;">
                ${g.size_code || 'S/T'}
              </span>
            </div>
          </div>`;
      }).join('');
      return `<div class="row">${cardsHtml}</div>`;
    }).join('');

    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert('Por favor habilita las ventanas emergentes para imprimir.');

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <title>Impresión de Etiquetas de Inventario Histórico</title>
  <style>
    @media print {
      @page {
        size: ${pageWMm}mm ${hMm}mm;
        margin: 0;
      }
      body { margin: 0; }
    }
    body {
      background: #f1f5f9;
      font-family: system-ui, -apple-system, sans-serif;
      margin: 10px;
    }
    .page-container {
      display: flex;
      flex-direction: column;
      gap: ${gapMm}mm;
    }
    .row {
      display: flex;
      width: ${pageWMm}mm;
      height: ${hMm}mm;
      box-sizing: border-box;
      page-break-after: always;
      background: white;
    }
    .card {
      width: ${wMm}mm;
      height: ${hMm}mm;
      box-sizing: border-box;
      padding: 3.5mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border: 1px dashed #cbd5e1;
      background: white;
    }
    @media print {
      body { background: white; margin: 0; }
      .card { border: none; }
    }
    .top {
      text-align: center;
      border-bottom: 1.5px solid #000;
      padding-bottom: 1mm;
      margin-bottom: 1mm;
    }
    .mid {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      gap: 1.2mm;
    }
    .bot {
      display: flex;
      justify-content: center;
      border-top: 1.5px solid #000;
      padding-top: 1mm;
      margin-top: 1mm;
    }
  </style>
</head>
<body>
  <div class="page-container">
    ${rowsHtml}
  </div>
  <script>
    window.onload = function() {
      window.print();
      setTimeout(function() { window.close(); }, 500);
    };
  </script>
</body>
</html>`;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  useEffect(() => {
    supabase.from('company_params').select('*').eq('name', 'print_sticker_config').maybeSingle().then(({ data }) => {
      if (data && data.value) {
        try {
          const parsed = JSON.parse(data.value);
          setStickerConfig(prev => ({ ...prev, ...parsed }));
        } catch (e) {}
      }
    });
    fetchMasters().then(() => {
      fetchStock();
      fetchKardex();
      fetchTransfers();
      fetchHistoricalBatches();
    });
  }, []);

  useEffect(() => {
    if (activeTab === 'historical_inventory') {
      fetchHistoricalBatches();
    }
  }, [activeTab]);

  const fetchRecentApprovedInspections = async () => {
    try {
      const { data, error } = await supabase
        .from('quality_inspections')
        .select(`
          *,
          orders (id, consecutive, client_name),
          sewing_orders (id, confeccion_code, products (nombre_producto, codigo_referencia))
        `)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      setRecentApprovedInspections(data || []);
    } catch (err: any) {
      console.error('Error fetching quality inspections for revert:', err);
    }
  };

  const openRevertModal = async () => {
    await fetchRecentApprovedInspections();
    setShowRevertModal(true);
  };

  const handleExecuteInventoryRevert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInspectionId) {
      alert('Por favor selecciona la orden / inspección a revertir.');
      return;
    }

    const selectedIns = recentApprovedInspections.find(i => i.id === selectedInspectionId);
    const orderCode = selectedIns?.sewing_orders?.confeccion_code || (selectedIns?.orders?.consecutive ? `OC-${selectedIns.orders.consecutive.toString().padStart(4, '0')}` : selectedInspectionId);

    if (!confirm(`⚠️ ¿Confirmas revertir el ingreso a inventario de la inspección/lote ${orderCode}?\n\n• Se descontarán las prendas ingresadas al inventario.\n• Se registrará la reversión en el Kardex.\n• La inspección se moverá a la Etapa ${targetStage} de Calidad para que pueda corregirse.`)) {
      return;
    }

    setExecutingRevert(true);
    try {
      // 1. Revertir inventario físico y Kardex
      await revertQualityApprovalFromInventory(selectedInspectionId);

      // 2. Actualizar la inspección de calidad al stage seleccionado para reingreso/corrección
      const newStatus = targetStage === 1 ? 'En Proceso' : targetStage === 2 ? 'Reproceso' : targetStage === 3 ? 'Empacado' : 'En Proceso';
      await supabase
        .from('quality_inspections')
        .update({
          current_stage: targetStage,
          status: newStatus,
          closed_at: null,
          pago_status: 'Pendiente de aprobación financiera',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedInspectionId);

      alert(`✅ REVERSIÓN EXITOSA:\n\n• El inventario de la orden ${orderCode} fue devuelto y descontado correctamente.\n• Se registró la reversión en el Kardex.\n• La orden fue enviada a Calidad (Etapa ${targetStage}) para su reingreso.`);

      setShowRevertModal(false);
      setSelectedInspectionId('');
      await fetchStock();
      await fetchKardex();
    } catch (err: any) {
      console.error('Error executing inventory revert:', err);
      alert('❌ Error al revertir inventario: ' + err.message);
    } finally {
      setExecutingRevert(false);
    }
  };

  const handleOpenUnitDetails = async (item: any) => {
    setSelectedStockItemForDetail(item);
    setShowUnitDetailModal(true);
    setLoadingUnits(true);
    try {
      const refName = item.products?.nombre_producto || item.products?.name || item.products?.codigo_referencia || '';
      const colorName = item.colors?.nombre_color || '';
      const sizeCode = item.sizes?.codigo_talla || '';

      let query = supabase
        .from('individual_garments')
        .select(`
          *,
          quality_inspections (
            id, status, created_at,
            sewing_orders (id, confeccion_code),
            orders (id, internal_code, consecutive)
          )
        `)
        .order('created_at', { ascending: false });

      if (refName) {
        query = query.ilike('reference_name', `%${refName.replace(/\s*\[.*?\]/g, '').trim()}%`);
      }
      if (sizeCode) {
        query = query.eq('size_code', sizeCode);
      }
      if (colorName && colorName !== '—') {
        query = query.eq('color_name', colorName);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      let finalGarments = data || [];
      // Acotar exactamente a la cantidad real disponible en stock
      if (item.cantidad_disponible > 0 && finalGarments.length > item.cantidad_disponible) {
        finalGarments = finalGarments.slice(0, item.cantidad_disponible);
      }

      setUnitGarments(finalGarments);
    } catch (err: any) {
      console.error('Error fetching unit details:', err);
    } finally {
      setLoadingUnits(false);
    }
  };

  const fetchAllPages = async (queryBuilder: any, maxRecords = 50000) => {
    let allData: any[] = [];
    let page = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await queryBuilder.range(page * pageSize, (page + 1) * pageSize - 1);
      if (error || !data || data.length === 0) break;
      allData = allData.concat(data);
      if (data.length < pageSize || allData.length >= maxRecords) break;
      page++;
    }
    return allData;
  };

  const fetchMasters = async () => {
    setLoading(true);
    try {
      const [p, c, s, w, loc, fab, cat] = await Promise.all([
        fetchAllPages(supabase.from('products').select('*').neq('estado', 'inactivo')),
        fetchAllPages(supabase.from('colors').select('*')),
        fetchAllPages(supabase.from('sizes').select('*').order('orden_visual', { ascending: true })),
        fetchAllPages(supabase.from('warehouses').select('*').eq('estado', 'activo')),
        fetchAllPages(supabase.from('warehouse_locations').select('*')),
        fetchAllPages(supabase.from('fabrics').select('id, nombre_tela, codigo_tela').order('nombre_tela', { ascending: true })),
        fetchAllPages(supabase.from('categories').select('*'))
      ]);

      setProducts(p || []);
      setColors(c || []);
      setSizes(s || []);
      setWarehouses(w || []);
      setLocations(loc || []);
      setFabrics(fab || []);
      setCategories(cat || []);
    } catch (err) {
      console.error('Error fetching masters:', err);
    } finally {
      setLoading(false);
    }
  };

  const [stockOrderMap, setStockOrderMap] = useState<Record<string, string>>({});

  const fetchStock = async () => {
    try {
      const stockData = await fetchAllPages(
        supabase
          .from('finished_goods_stock')
          .select(`
            *,
            products (id, nombre_producto, codigo_referencia, precio, categoria, category_id, categories (id, categoria)),
            colors (id, nombre_color, hex_color),
            fabrics:fabric_id (id, nombre_tela, codigo_tela),
            sizes (id, codigo_talla),
            warehouses (id, nombre_bodega),
            warehouse_locations (id, pasillo, estanteria, nivel, posicion)
          `)
      );

      setStock(stockData || []);

      // Resolver mapeo de Orden de Ingreso limpia por combinación SKU
      try {
        const { data: garmsData } = await supabase
          .from('individual_garments')
          .select(`
            reference_name, color_name, size_code,
            quality_inspections (
              id,
              sewing_orders (confeccion_code),
              orders (internal_code, consecutive)
            )
          `)
          .not('quality_inspection_id', 'is', null)
          .order('created_at', { ascending: false });

        const orderMap: Record<string, string> = {};

        if (garmsData && garmsData.length > 0) {
          for (const g of garmsData) {
            const ins: any = Array.isArray(g.quality_inspections) ? g.quality_inspections[0] : g.quality_inspections;
            const code = ins?.sewing_orders?.confeccion_code ||
              ins?.orders?.internal_code ||
              (ins?.orders?.consecutive ? `OC-${ins.orders.consecutive.toString().padStart(4, '0')}` : null);

            if (!code) continue;

            const refKey = (g.reference_name || '').replace(/\s*\[.*?\]/g, '').trim().toUpperCase();
            const colorKey = (g.color_name || '—').trim().toUpperCase();
            const sizeKey = (g.size_code || '').trim().toUpperCase();

            const key = `${refKey}___${colorKey}___${sizeKey}`;
            if (!orderMap[key]) {
              orderMap[key] = code;
            }
          }
        }

        // Fallback desde Kardex con resolución de ID a código limpio
        const { data: kardexMovs } = await supabase
          .from('finished_goods_kardex')
          .select(`
            product_id, color_id, size_id, warehouse_dest_id, documento_origen,
            products (codigo_referencia, nombre_producto),
            colors (nombre_color),
            sizes (codigo_talla)
          `)
          .order('created_at', { ascending: false });

        if (kardexMovs) {
          // Extraer IDs de inspecciones para consultar sus códigos limpios
          const inspIdsToFetch: string[] = [];
          for (const k of kardexMovs) {
            if (k.documento_origen && k.documento_origen.startsWith('Inspección #')) {
              const uuid = k.documento_origen.replace('Inspección #', '').trim();
              if (uuid.length > 20) inspIdsToFetch.push(uuid);
            }
          }

          let inspCodeMap: Record<string, string> = {};
          if (inspIdsToFetch.length > 0) {
            const { data: inspDetails } = await supabase
              .from('quality_inspections')
              .select(`
                id,
                sewing_orders (confeccion_code),
                orders (internal_code, consecutive)
              `)
              .in('id', Array.from(new Set(inspIdsToFetch)));

            if (inspDetails) {
              inspDetails.forEach((ins: any) => {
                const cleanCode = ins.sewing_orders?.confeccion_code ||
                  ins.orders?.internal_code ||
                  (ins.orders?.consecutive ? `OC-${ins.orders.consecutive.toString().padStart(4, '0')}` : null);
                if (cleanCode) {
                  inspCodeMap[ins.id] = cleanCode;
                }
              });
            }
          }

          for (const k of kardexMovs) {
            if (!k.documento_origen) continue;
            let displayCode = k.documento_origen;
            if (k.documento_origen.startsWith('Inspección #')) {
              const uuid = k.documento_origen.replace('Inspección #', '').trim();
              if (inspCodeMap[uuid]) {
                displayCode = inspCodeMap[uuid];
              } else {
                continue;
              }
            }

            const stockKey = `${k.product_id}_${k.color_id || 'null'}_${k.size_id}_${k.warehouse_dest_id}`;
            if (!orderMap[stockKey]) {
              orderMap[stockKey] = displayCode;
            }
          }
        }

        setStockOrderMap(orderMap);
      } catch (errK) {
        console.error('Error resolving stock orders mapping:', errK);
      }
    } catch (err) {
      console.error('Error fetching stock:', err);
    }
  };

  const fetchKardex = async () => {
    try {
      const data = await fetchAllPages(
        supabase
          .from('finished_goods_kardex')
          .select(`
            *,
            products (id, nombre_producto, codigo_referencia, categoria, category_id, categories (id, categoria)),
            colors (id, nombre_color),
            fabrics:fabric_id (id, nombre_tela),
            sizes (id, codigo_talla),
            warehouse_orig:warehouses!finished_goods_kardex_warehouse_orig_id_fkey (nombre_bodega),
            warehouse_dest:warehouses!finished_goods_kardex_warehouse_dest_id_fkey (nombre_bodega)
          `)
          .order('created_at', { ascending: false })
      );
      setKardex(data || []);
    } catch (err) {
      console.error('Error fetching kardex:', err);
    }
  };

  const fetchTransfers = async () => {
    try {
      const { data, error } = await supabase
        .from('finished_goods_transfers')
        .select(`
          *,
          orig:warehouses!finished_goods_transfers_warehouse_orig_id_fkey (nombre_bodega),
          dest:warehouses!finished_goods_transfers_warehouse_dest_id_fkey (nombre_bodega),
          finished_goods_transfer_items (
            *,
            products (nombre_producto, codigo_referencia),
            colors (nombre_color),
            sizes (codigo_talla)
          )
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTransfers(data || []);
    } catch (err) {
      console.error('Error fetching transfers:', err);
    }
  };

  // Quick stats
  const totalGarments = stock.reduce((sum, item) => sum + (item.cantidad_disponible || 0), 0);
  const totalReserved = stock.reduce((sum, item) => sum + (item.cantidad_reservada || 0), 0);
  const totalValue = stock.reduce((sum, item) => {
    const price = item.products?.precio || 0;
    return sum + (item.cantidad_disponible * price);
  }, 0);
  
  const activeRefsCount = new Set(stock.map(item => item.product_id)).size;
  const criticalItems = stock.filter(item => item.cantidad_disponible <= (item.stock_minimo || 0) && item.stock_minimo > 0);
  
  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);
  const entriesToday = kardex
    .filter(k => new Date(k.created_at) >= todayStart && (
      k.tipo_movimiento.toLowerCase().includes('ingreso') ||
      k.tipo_movimiento.toLowerCase().includes('positivo')
    ))
    .reduce((sum, k) => sum + k.cantidad, 0);
  const exitsToday = kardex
    .filter(k => new Date(k.created_at) >= todayStart && (
      k.tipo_movimiento.toLowerCase().includes('salida') ||
      k.tipo_movimiento.toLowerCase().includes('negativo') ||
      k.tipo_movimiento.toLowerCase().includes('despacho') ||
      k.tipo_movimiento.toLowerCase().includes('baja')
    ))
    .reduce((sum, k) => sum + k.cantidad, 0);

  // Filters stock
  const filteredStock = stock.filter(item => {
    const ref = item.products?.codigo_referencia || '';
    const name = item.products?.nombre_producto || '';
    const cat = (item.products?.categories?.categoria || item.products?.categoria || '');
    const color = item.colors?.nombre_color || '';
    const size = item.sizes?.codigo_talla || '';
    const wh = item.warehouses?.nombre_bodega || '';
    

    const matchesSearch = 
      ref.toLowerCase().includes(searchQuery.toLowerCase()) ||
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.toLowerCase().includes(searchQuery.toLowerCase()) ||
      color.toLowerCase().includes(searchQuery.toLowerCase()) ||
      size.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wh.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesWarehouse = filterWarehouse 
      ? isSameWarehouse(item, warehouses.find(w => w.id === filterWarehouse))
      : true;
    const matchesColor = filterColor ? item.color_id === filterColor : true;
    const matchesSize = filterSize ? item.size_id === filterSize : true;
    
    const matchesAlert = filterAlert === 'critical' 
      ? item.cantidad_disponible <= (item.stock_minimo || 0) && item.stock_minimo > 0
      : filterAlert === 'over' 
      ? item.cantidad_disponible >= (item.stock_maximo || 999999) && item.stock_maximo > 0
      : true;

    return matchesSearch && matchesWarehouse && matchesColor && matchesSize && matchesAlert;
  });

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLocation(true);
    try {
      const { error } = await supabase
        .from('warehouse_locations')
        .insert([locationForm]);
      if (error) throw error;
      
      setLocationForm({ warehouse_id: '', pasillo: '', estanteria: '', nivel: '', posicion: '' });
      setShowLocationModal(false);
      await fetchMasters();
    } catch (err: any) {
      alert('Error al guardar ubicación: ' + err.message);
    } finally {
      setSavingLocation(false);
    }
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAdjustment(true);
    try {
      const { stock_id, product_id, color_id, size_id, warehouse_id, type, cantidad, observaciones } = adjustmentForm;
      const isPositive = type === 'Ajuste positivo';
      const adjQty = isPositive ? Number(cantidad) : -Number(cantidad);

      let targetStockId = stock_id;
      let finalProductId = product_id;
      let finalColorId = color_id;
      let finalSizeId = size_id;
      let finalWarehouseId = warehouse_id;

      if (stock_id) {
        const item = stock.find(s => s.id === stock_id);
        if (item) {
          finalProductId = item.product_id;
          finalColorId = item.color_id;
          finalSizeId = item.size_id;
          finalWarehouseId = item.warehouse_id;
        }
      }

      // 1. Fetch current stock — discriminar por color_id Y fabric_id para que cada color/tela sea una fila distinta
      let stockQuery = supabase
        .from('finished_goods_stock')
        .select('*')
        .eq('warehouse_id', finalWarehouseId)
        .eq('product_id', finalProductId)
        .eq('size_id', finalSizeId);

      if (finalColorId) {
        stockQuery = stockQuery.eq('color_id', finalColorId);
      } else {
        stockQuery = stockQuery.is('color_id', null);
      }

      const finalFabricId = adjustmentForm.fabric_id || null;
      if (finalFabricId) {
        stockQuery = stockQuery.eq('fabric_id', finalFabricId);
      } else {
        stockQuery = stockQuery.is('fabric_id', null);
      }

      const { data: stockRecords } = await stockQuery.limit(1);
      const existingRecord = stockRecords?.[0];
      const saldoAnterior = existingRecord ? Number(existingRecord.cantidad_disponible) : 0;
      const saldoNuevo = saldoAnterior + adjQty;

      if (saldoNuevo < 0) {
        throw new Error('El saldo del inventario no puede ser negativo.');
      }

      if (existingRecord) {
        await supabase
          .from('finished_goods_stock')
          .update({ cantidad_disponible: saldoNuevo, updated_at: new Date().toISOString() })
          .eq('id', existingRecord.id);
      } else {
        await supabase
          .from('finished_goods_stock')
          .insert({
            warehouse_id: finalWarehouseId,
            product_id: finalProductId,
            color_id: finalColorId || null,
            fabric_id: finalFabricId || null,
            size_id: finalSizeId,
            cantidad_disponible: saldoNuevo
          });
      }

      // 2. Add to Kardex
      await supabase
        .from('finished_goods_kardex')
        .insert({
          product_id: finalProductId,
          color_id: finalColorId || null,
          fabric_id: finalFabricId || null,
          size_id: finalSizeId,
          tipo_movimiento: type,
          cantidad: Number(cantidad),
          saldo_anterior: saldoAnterior,
          saldo_nuevo: saldoNuevo,
          warehouse_dest_id: isPositive ? finalWarehouseId : null,
          warehouse_orig_id: isPositive ? null : finalWarehouseId,
          usuario: user?.email || 'Admin',
          observaciones: observaciones || 'Ajuste manual de inventario'
        });

      setShowAdjustmentModal(false);
      setAdjustmentForm({ stock_id: '', product_id: '', color_id: '', fabric_id: '', size_id: '', warehouse_id: '', type: 'Ajuste positivo', cantidad: 1, observaciones: '' });
      await fetchStock();
      await fetchKardex();
    } catch (err: any) {
      alert('Error en ajuste: ' + err.message);
    } finally {
      setSavingAdjustment(false);
    }
  };

  const handleSaveTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (transferForm.items.length === 0) return alert('Debes agregar al menos una referencia para transferir.');
    setSavingTransfer(true);
    try {
      // 1. Create transfer record in Pendiente state
      const { data: newTransfer, error: txErr } = await supabase
        .from('finished_goods_transfers')
        .insert([{
          warehouse_orig_id: transferForm.warehouse_orig_id,
          warehouse_dest_id: transferForm.warehouse_dest_id,
          estado: 'Pendiente', // Starts as Pendiente (Requesting)
          usuario: user?.email || 'Usuario',
          observaciones: transferForm.observaciones
        }])
        .select()
        .single();

      if (txErr) throw txErr;

      // 2. Register items & update origin stock (deducting origin immediately)
      for (const item of transferForm.items) {
        await supabase
          .from('finished_goods_transfer_items')
          .insert({
            transfer_id: newTransfer.id,
            product_id: item.product_id,
            color_id: item.color_id || null,
            size_id: item.size_id,
            cantidad: Number(item.cantidad)
          });

        // Deduct from origin
        let origQuery = supabase
          .from('finished_goods_stock')
          .select('*')
          .eq('warehouse_id', transferForm.warehouse_orig_id)
          .eq('product_id', item.product_id)
          .eq('size_id', item.size_id)
          .is('location_id', null);

        if (item.color_id) {
          origQuery = origQuery.eq('color_id', item.color_id);
        } else {
          origQuery = origQuery.is('color_id', null);
        }

        const { data: origStock } = await origQuery.limit(1);

        const currentOrigQty = origStock?.[0] ? Number(origStock[0].cantidad_disponible) : 0;
        if (origStock?.[0]) {
          await supabase
            .from('finished_goods_stock')
            .update({ cantidad_disponible: currentOrigQty - Number(item.cantidad) })
            .eq('id', origStock[0].id);
        }

        // Kardex Orig (Salida en Tránsito)
        await supabase.from('finished_goods_kardex').insert({
          product_id: item.product_id,
          color_id: item.color_id || null,
          size_id: item.size_id,
          tipo_movimiento: 'Transferencia (Salida)',
          cantidad: Number(item.cantidad),
          saldo_anterior: currentOrigQty,
          saldo_nuevo: currentOrigQty - Number(item.cantidad),
          warehouse_orig_id: transferForm.warehouse_orig_id,
          warehouse_dest_id: transferForm.warehouse_dest_id,
          documento_origen: `Transferencia #${newTransfer.consecutive || newTransfer.id.slice(0,6)}`,
          usuario: user?.email || 'Usuario',
          observaciones: 'Transferencia despachada (Pendiente de recepción)'
        });
      }

      setShowTransferModal(false);
      setTransferForm({ warehouse_orig_id: '', warehouse_dest_id: '', items: [] as any[], observaciones: '' });
      await fetchStock();
      await fetchKardex();
      await fetchTransfers();
      alert('✓ Solicitud de transferencia enviada. Queda en estado Pendiente hasta que la tienda destino la Acepte.');
    } catch (err: any) {
      alert('Error en transferencia: ' + err.message);
    } finally {
      setSavingTransfer(false);
    }
  };

  const handleAcceptTransfer = async (tx: any) => {
    if (!confirm(`¿Confirmas la recepción y aceptación de la transferencia TR-${tx.consecutive}? Se ingresarán los productos al stock.`)) return;
    try {
      // 1. Update transfer status
      await supabase
        .from('finished_goods_transfers')
        .update({ estado: 'Recibida' })
        .eq('id', tx.id);

      // 2. Add stock to destination
      for (const item of tx.finished_goods_transfer_items) {
        let destQuery = supabase
          .from('finished_goods_stock')
          .select('*')
          .eq('warehouse_id', tx.warehouse_dest_id)
          .eq('product_id', item.product_id)
          .eq('size_id', item.size_id)
          .is('location_id', null);

        if (item.color_id) {
          destQuery = destQuery.eq('color_id', item.color_id);
        } else {
          destQuery = destQuery.is('color_id', null);
        }

        const { data: destStock } = await destQuery.limit(1);

        const currentDestQty = destStock?.[0] ? Number(destStock[0].cantidad_disponible) : 0;
        if (destStock?.[0]) {
          await supabase
            .from('finished_goods_stock')
            .update({ cantidad_disponible: currentDestQty + Number(item.cantidad) })
            .eq('id', destStock[0].id);
        } else {
          await supabase
            .from('finished_goods_stock')
            .insert({
              warehouse_id: tx.warehouse_dest_id,
              product_id: item.product_id,
              color_id: item.color_id || null,
              size_id: item.size_id,
              cantidad_disponible: Number(item.cantidad)
            });
        }

        // Check if there is a store linked to this destination warehouse, and sync it to the POS store_inventory
        const { data: linkedStores } = await supabase
          .from('stores')
          .select('id')
          .eq('bodega_asociada_id', tx.warehouse_dest_id);

        if (linkedStores && linkedStores.length > 0) {
          for (const store of linkedStores) {
            let storeQuery = supabase
              .from('store_inventory')
              .select('*')
              .eq('store_id', store.id)
              .eq('product_id', item.product_id)
              .eq('size_id', item.size_id);

            if (item.color_id) {
              storeQuery = storeQuery.eq('color_id', item.color_id);
            } else {
              storeQuery = storeQuery.is('color_id', null);
            }

            const { data: storeStock } = await storeQuery.limit(1);

            const currentStoreQty = storeStock?.[0] ? Number(storeStock[0].cantidad_disponible) : 0;
            if (storeStock?.[0]) {
              await supabase
                .from('store_inventory')
                .update({ cantidad_disponible: currentStoreQty + Number(item.cantidad) })
                .eq('id', storeStock[0].id);
            } else {
              await supabase
                .from('store_inventory')
                .insert({
                  store_id: store.id,
                  product_id: item.product_id,
                  color_id: item.color_id || null,
                  size_id: item.size_id,
                  cantidad_disponible: Number(item.cantidad)
                });
            }
          }
        }

        // Kardex Dest
        await supabase.from('finished_goods_kardex').insert({
          product_id: item.product_id,
          color_id: item.color_id || null,
          size_id: item.size_id,
          tipo_movimiento: 'Transferencia (Entrada)',
          cantidad: Number(item.cantidad),
          saldo_anterior: currentDestQty,
          saldo_nuevo: currentDestQty + Number(item.cantidad),
          warehouse_orig_id: tx.warehouse_orig_id,
          warehouse_dest_id: tx.warehouse_dest_id,
          documento_origen: `Transferencia #${tx.consecutive}`,
          usuario: user?.email || 'Usuario',
          observaciones: 'Transferencia recibida y aceptada'
        });
      }

      await fetchStock();
      await fetchKardex();
      await fetchTransfers();
      alert('✓ Transferencia aceptada con éxito y stock ingresado.');
    } catch (err: any) {
      alert('Error al aceptar transferencia: ' + err.message);
    }
  };

  const handleParsePaste = () => {
    try {
      const rows = rawPaste.split('\n').filter(r => r.trim());
      const parsed: any[] = [];
      
      const sizeMap = new Map(sizes?.map(s => [s.codigo_talla.toUpperCase().trim(), s.id]));
      const colorMap = new Map(colors?.map(c => [c.nombre_color.toUpperCase().trim(), c.id]));
      const productMap = new Map();
      products?.forEach(p => {
        if (p.nombre_producto) productMap.set(p.nombre_producto.toUpperCase().trim(), p.id);
        if (p.codigo_referencia) productMap.set(p.codigo_referencia.toUpperCase().trim(), p.id);
      });
      const warehouseMap = new Map(warehouses?.map(w => [w.nombre_bodega.toUpperCase().trim(), w.id]));

      rows.forEach((r, index) => {
        // Split by tabs or commas
        const cols = r.split(/\t|,/);
        if (cols.length < 5) return; // Expecting: Ref/Prod, Color, Talla, Cantidad, Bodega
        
        const refNameInput = cols[0]?.trim();
        const colorInput = cols[1]?.trim();
        const sizeInput = cols[2]?.trim();
        const qtyInput = Number(cols[3]?.trim()) || 0;
        const whInput = cols[4]?.trim();

        const productId = productMap.get(refNameInput.toUpperCase());
        const colorId = colorMap.get(colorInput.toUpperCase()) || null;
        const sizeId = sizeMap.get(sizeInput.toUpperCase());
        const warehouseId = warehouseMap.get(whInput.toUpperCase());

        parsed.push({
          rowNum: index + 1,
          rawRef: refNameInput,
          rawColor: colorInput,
          rawSize: sizeInput,
          qty: qtyInput,
          rawWh: whInput,
          productId,
          colorId,
          sizeId,
          warehouseId,
          valid: !!(productId && sizeId && warehouseId && qtyInput > 0)
        });
      });

      setParsedData(parsed);
    } catch (err: any) {
      alert('Error al analizar texto: ' + err.message);
    }
  };

  const handleImportData = async () => {
    const validRows = parsedData.filter(d => d.valid);
    if (validRows.length === 0) return alert('No hay filas válidas para importar.');
    setImporting(true);
    try {
      for (const item of validRows) {
        // Consultar stock discriminando color_id
        let importQuery = supabase
          .from('finished_goods_stock')
          .select('*')
          .eq('warehouse_id', item.warehouseId)
          .eq('product_id', item.productId)
          .eq('size_id', item.sizeId)
          .is('location_id', null);

        if (item.colorId) {
          importQuery = importQuery.eq('color_id', item.colorId);
        } else {
          importQuery = importQuery.is('color_id', null);
        }

        const { data: stockRecords } = await importQuery.limit(1);

        const existingStock = stockRecords?.[0];
        const saldoAnterior = existingStock ? Number(existingStock.cantidad_disponible) : 0;
        const saldoNuevo = saldoAnterior + item.qty;

        if (existingStock) {
          await supabase
            .from('finished_goods_stock')
            .update({ cantidad_disponible: saldoNuevo, updated_at: new Date().toISOString() })
            .eq('id', existingStock.id);
        } else {
          await supabase
            .from('finished_goods_stock')
            .insert({
              warehouse_id: item.warehouseId,
              product_id: item.productId,
              color_id: item.colorId || null,
              size_id: item.sizeId,
              cantidad_disponible: item.qty
            });
        }

        // Kardex
        await supabase.from('finished_goods_kardex').insert({
          product_id: item.productId,
          color_id: item.colorId || null,
          size_id: item.sizeId,
          tipo_movimiento: 'Carga Inicial',
          cantidad: item.qty,
          saldo_anterior: saldoAnterior,
          saldo_nuevo: saldoNuevo,
          warehouse_dest_id: item.warehouseId,
          documento_origen: 'Asistente Carga Inicial',
          usuario: user?.email || 'Sistema',
          observaciones: 'Importación masiva inicial de inventario histórico'
        });
      }

      alert('¡Importación completada con éxito!');
      setParsedData([]);
      setRawPaste('');
      setActiveTab('stock');
      await fetchStock();
      await fetchKardex();
    } catch (err: any) {
      alert('Error en importación: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#80082E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Inventario Corporativo
          </span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '950', margin: '0.25rem 0 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.5rem', backgroundColor: '#80082E', borderRadius: '12px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={24} />
            </div>
            Inventario de Producto Terminado
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Control exclusivo de prendas terminadas, bodegas, kardex de trazabilidad y traslados.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Botón de Reversión exclusivo para SuperAdmin o usuarios habilitados */}
          <button
            className="btn"
            onClick={openRevertModal}
            style={{
              border: '1.5px solid #dc2626',
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              fontWeight: '900',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <RefreshCw size={16} /> ↩️ Revertir a Calidad (SuperAdmin)
          </button>
          <button className="btn btn-primary" onClick={() => setShowAdjustmentModal(true)}>
            <Plus size={18} /> Ajustar Inventario
          </button>
          <button className="btn" style={{ border: '1px solid var(--border)', backgroundColor: 'white' }} onClick={() => setShowTransferModal(true)}>
            <MoveHorizontal size={18} /> Nueva Transferencia
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '1.5rem', overflowX: 'auto' }}>
        {[
          { id: 'dashboard', label: 'Panel Resumen' },
          { id: 'general_inventory', label: 'INVENTARIO GENERAL' },
          { id: 'stock', label: 'Existencias por SKU' },
          { id: 'kardex', label: 'Kardex Historial' },
          { id: 'transfers', label: 'Transferencias' },
          { id: 'locations', label: 'Bodegas y Ubicaciones' },
          { id: 'initial_load', label: 'Carga Inicial Excel' },
          { id: 'historical_inventory', label: 'Inventario Histórico' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as TabType)}
            style={{
              padding: '0.75rem 0.25rem',
              fontWeight: '700',
              fontSize: '0.875rem',
              border: 'none',
              borderBottom: activeTab === t.id ? '3px solid var(--primary)' : '3px solid transparent',
              color: activeTab === t.id ? 'var(--primary)' : 'var(--text-muted)',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENTS */}

      {/* 0. INVENTARIO GENERAL */}
      {activeTab === 'general_inventory' && (
        <GeneralInventorySubmodule
          products={products}
          stock={stock}
          kardex={kardex}
          warehouses={warehouses}
          colors={colors}
          sizes={sizes}
          categories={categories}
          user={user}
          profile={profile}
          isAdmin={isSuperAdmin}
          onRefreshData={async () => {
            await fetchStock();
            await fetchKardex();
          }}
        />
      )}

      {/* 1. DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Executive Metrics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            {[
              { label: 'Total Prendas Disponibles', value: `${totalGarments.toLocaleString()} uds`, subText: `${totalReserved} reservadas`, color: 'var(--primary)', icon: Package },
              { label: 'Valor Total Inventario', value: `$${totalValue.toLocaleString('es-CO')}`, subText: 'Calculado a precio venta', color: '#10b981', icon: TrendingUp },
              { label: 'Referencias Activas', value: `${activeRefsCount} SKU`, subText: 'En stock', color: '#6366f1', icon: Barcode },
              { label: 'Entradas de Hoy', value: `+${entriesToday} uds`, subText: 'Aprobaciones y ajustes', color: '#3b82f6', icon: CheckCircle2 },
              { label: 'Salidas de Hoy', value: `-${exitsToday} uds`, subText: 'Despachos y bajas', color: '#ef4444', icon: TrendingDown },
              { label: 'Stock Crítico / Alertas', value: `${criticalItems.length} refs`, subText: 'Bajo el mínimo', color: '#f59e0b', icon: AlertTriangle }
            ].map((k, i) => (
              <div key={i} className="card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid var(--border)', borderRadius: '16px', backgroundColor: 'white' }}>
                <div style={{ padding: '0.75rem', backgroundColor: `${k.color}12`, color: k.color, borderRadius: '12px', flexShrink: 0 }}>
                  <k.icon size={24} />
                </div>
                <div>
                  <p style={{ fontSize: '0.68rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{k.label}</p>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: '950', margin: '0.15rem 0', color: '#0f172a' }}>{k.value}</h3>
                  <p style={{ fontSize: '0.7rem', color: '#64748b', margin: 0 }}>{k.subText}</p>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
            {/* Bodega list & occupancy */}
            <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', backgroundColor: 'white', border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '900', color: '#0f172a', marginBottom: '1rem' }}>Distribución Física por Bodega</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {warehouses.map(w => {
                  const whStock = stock.filter(s => isSameWarehouse(s, w));
                  const qty = whStock.reduce((sum, item) => sum + (item.cantidad_disponible || 0), 0);
                  const value = whStock.reduce((sum, item) => sum + (item.cantidad_disponible * (item.products?.precio || 0)), 0);
                  const percentage = totalGarments > 0 ? (qty / totalGarments) * 100 : 0;
                  
                  return (
                    <div key={w.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                        <span style={{ fontWeight: '800', color: '#0f172a' }}>{w.nombre_bodega} ({w.tipo})</span>
                        <span style={{ fontWeight: '700', color: 'var(--text-muted)' }}>{qty.toLocaleString()} uds / ${value.toLocaleString('es-CO')}</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${percentage}%`, height: '100%', backgroundColor: 'var(--primary)', borderRadius: '4px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recurrent stock alerts */}
            <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', backgroundColor: 'white', border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '900', color: '#0f172a', marginBottom: '1rem' }}>Alertas de Agotamiento</h3>
              {criticalItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: '#64748b' }}>
                  <CheckCircle2 size={36} style={{ color: '#10b981', marginBottom: '0.5rem' }} />
                  <p style={{ fontSize: '0.85rem', fontWeight: '600' }}>Sin alertas de stock crítico.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto' }}>
                  {criticalItems.map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', backgroundColor: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '10px' }}>
                      <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '0.8rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>{item.products?.nombre_producto}</p>
                        <p style={{ fontSize: '0.7rem', color: '#64748b', margin: 0 }}>Talla: {item.sizes?.codigo_talla} | Color: {item.colors?.nombre_color || '—'}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '0.85rem', fontWeight: '900', color: '#dc2626', margin: 0 }}>{item.cantidad_disponible} uds</p>
                        <p style={{ fontSize: '0.65rem', color: '#64748b', margin: 0 }}>Mín: {item.stock_minimo}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. STOCK / EXISTENCIAS */}
      {activeTab === 'stock' && (
        <div className="card" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden', backgroundColor: 'white', border: '1px solid var(--border)' }}>
          {/* Filters bar */}
          <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Buscar por referencia, producto, color o bodega..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.5rem', borderRadius: '10px', border: '1.5px solid var(--border)', fontSize: '0.85rem' }}
              />
            </div>
            
            <select
              value={filterWarehouse}
              onChange={e => setFilterWarehouse(e.target.value)}
              style={{ padding: '0.65rem', borderRadius: '10px', border: '1.5px solid var(--border)', fontSize: '0.85rem', minWidth: '150px' }}
            >
              <option value="">Todas las Bodegas</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.nombre_bodega}</option>)}
            </select>

            <select
              value={filterColor}
              onChange={e => setFilterColor(e.target.value)}
              style={{ padding: '0.65rem', borderRadius: '10px', border: '1.5px solid var(--border)', fontSize: '0.85rem', minWidth: '130px' }}
            >
              <option value="">Todos los Colores</option>
              {colors.map(c => <option key={c.id} value={c.id}>{c.nombre_color}</option>)}
            </select>

            <select
              value={filterSize}
              onChange={e => setFilterSize(e.target.value)}
              style={{ padding: '0.65rem', borderRadius: '10px', border: '1.5px solid var(--border)', fontSize: '0.85rem', minWidth: '110px' }}
            >
              <option value="">Todas las Tallas</option>
              {sizes.map(s => <option key={s.id} value={s.id}>{s.codigo_talla}</option>)}
            </select>

            <div style={{ display: 'flex', gap: '0.25rem', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.2rem', backgroundColor: '#f1f5f9' }}>
              <button onClick={() => setFilterAlert('all')} style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', fontWeight: '700', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: filterAlert === 'all' ? 'white' : 'transparent', color: filterAlert === 'all' ? 'var(--primary)' : 'var(--text-muted)' }}>Todos</button>
              <button onClick={() => setFilterAlert('critical')} style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', fontWeight: '700', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: filterAlert === 'critical' ? 'white' : 'transparent', color: filterAlert === 'critical' ? '#b45309' : 'var(--text-muted)' }}>Crítico</button>
              <button onClick={() => setFilterAlert('over')} style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', fontWeight: '700', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: filterAlert === 'over' ? 'white' : 'transparent', color: filterAlert === 'over' ? '#0f766e' : 'var(--text-muted)' }}>Sobre-stock</button>
            </div>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem', fontWeight: '800', color: showAllMasterProducts ? '#334155' : '#80082E', cursor: 'pointer', backgroundColor: showAllMasterProducts ? '#f1f5f9' : '#fff1f2', padding: '0.5rem 0.85rem', borderRadius: '10px', border: `1.5px solid ${showAllMasterProducts ? '#cbd5e1' : '#fecdd3'}`, transition: 'all 0.2s', marginLeft: 'auto' }}>
              <input
                type="checkbox"
                checked={showAllMasterProducts}
                onChange={e => setShowAllMasterProducts(e.target.checked)}
                style={{ accentColor: '#80082E', width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span>Ver todo el maestro de productos (sin filtrar por "Premium")</span>
            </label>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2.5px solid var(--border)', textAlign: 'left', backgroundColor: '#f8fafc' }}>
                  {['Referencia', 'Orden de Ingreso', 'Producto', 'Color', 'Categoría', 'Bodega', 'Talla', 'Disponible', 'Reservado', 'En Tránsito', 'Stock Mín / Máx', 'Estado/Alerta', 'Acciones'].map(h => (
                    <th key={h} style={{ padding: '1rem 1.5rem', fontWeight: '800', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredStock.length === 0 ? (
                  <tr>
                    <td colSpan={13} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      No se encontraron existencias con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filteredStock.map(item => {
                    const isCritical = item.cantidad_disponible <= (item.stock_minimo || 0) && item.stock_minimo > 0;
                    const isOver = item.cantidad_disponible >= (item.stock_maximo || 999999) && item.stock_maximo > 0;
                    
                    const stockKey = `${item.product_id}_${item.color_id || 'null'}_${item.size_id}_${item.warehouse_id}`;
                    
                    const refNameKey = (item.products?.nombre_producto || item.products?.codigo_referencia || '').replace(/\s*\[.*?\]/g, '').trim().toUpperCase();
                    const colorNameKey = (item.colors?.nombre_color || item.fabrics?.nombre_tela || '—').trim().toUpperCase();
                    const sizeCodeKey = (item.sizes?.codigo_talla || '').trim().toUpperCase();
                    const refKey = `${refNameKey}___${colorNameKey}___${sizeCodeKey}`;
                    
                    const linkedOrder = stockOrderMap[refKey] || stockOrderMap[stockKey] || '—';

                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.2s' }}>
                        <td style={{ padding: '1rem 1.5rem', fontWeight: '800', color: 'var(--primary)' }}>{item.products?.codigo_referencia || '—'}</td>
                        <td style={{ padding: '1rem 1.5rem' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.25rem 0.65rem',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: '850',
                            backgroundColor: linkedOrder !== '—' ? '#fdf2f4' : '#f8fafc',
                            color: linkedOrder !== '—' ? '#80082E' : '#94a3b8',
                            border: `1px solid ${linkedOrder !== '—' ? '#fecdd3' : '#e2e8f0'}`
                          }}>
                            📦 {linkedOrder}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 1.5rem', fontWeight: '800', color: '#0f172a' }}>{item.products?.nombre_producto || '—'}</td>
                        <td style={{ padding: '1rem 1.5rem' }}>
                          {(() => {
                            const colorObj = item.colors;
                            let colorName = colorObj?.nombre_color;
                            let hexColor = colorObj?.hex_color;

                            if (!colorName && item.products?.nombre_producto) {
                              const nameUpper = item.products.nombre_producto.toUpperCase();
                              const matchedColor = colors.find(c => {
                                const cName = c.nombre_color?.toUpperCase().trim();
                                return cName && cName.length >= 3 && (nameUpper.includes(' ' + cName + ' ') || nameUpper.endsWith(' ' + cName));
                              });
                              if (matchedColor) {
                                colorName = matchedColor.nombre_color;
                                hexColor = matchedColor.hex_color;
                              }
                            }

                            return (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: '700' }}>
                                <span style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: hexColor || '#94a3b8', border: '1.5px solid var(--border)', flexShrink: 0 }} />
                                {colorName || item.fabrics?.nombre_tela || 'Sin Especificar'}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ padding: '1rem 1.5rem', fontWeight: '700', color: '#475569' }}>
                          {item.products?.categories?.categoria || item.products?.categoria || '—'}
                        </td>
                        <td style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>{item.warehouses?.nombre_bodega || '—'}</td>
                        <td style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>{item.sizes?.codigo_talla}</td>
                        <td style={{ padding: '1rem 1.5rem', fontWeight: '950', fontSize: '1rem' }}>{item.cantidad_disponible}</td>
                        <td style={{ padding: '1rem 1.5rem', color: '#64748b' }}>{item.cantidad_reservada}</td>
                        <td style={{ padding: '1rem 1.5rem', color: '#3b82f6' }}>{item.cantidad_en_transito}</td>
                        <td style={{ padding: '1rem 1.5rem' }}>
                          <span style={{ color: '#64748b' }}>{item.stock_minimo || '—'} / {item.stock_maximo || '—'}</span>
                        </td>
                        <td style={{ padding: '1rem 1.5rem' }}>
                          {isCritical ? (
                            <span style={{ padding: '0.25rem 0.5rem', backgroundColor: '#fef3c7', color: '#b45309', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '800' }}>STOCK CRÍTICO</span>
                          ) : isOver ? (
                            <span style={{ padding: '0.25rem 0.5rem', backgroundColor: '#ccfbf1', color: '#0f766e', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '800' }}>SOBRE-STOCK</span>
                          ) : (
                            <span style={{ padding: '0.25rem 0.5rem', backgroundColor: '#d1fae5', color: '#065f46', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '800' }}>SALDO SALUDABLE</span>
                          )}
                        </td>
                        <td style={{ padding: '1rem 1.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button
                            onClick={() => handleOpenUnitDetails(item)}
                            className="btn"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', border: '1.5px solid #6366f1', backgroundColor: '#eef2ff', color: '#4338ca', fontWeight: '800' }}
                          >
                            👁️ Ver Unidades
                          </button>
                          <button
                            onClick={() => {
                              setAdjustmentForm({
                                stock_id: item.id,
                                product_id: item.product_id,
                                color_id: item.color_id,
                                fabric_id: item.fabric_id || '',
                                size_id: item.size_id,
                                warehouse_id: item.warehouse_id,
                                type: 'Ajuste positivo',
                                cantidad: 1,
                                observaciones: ''
                              });
                              setShowAdjustmentModal(true);
                            }}
                            className="btn"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', border: '1px solid var(--border)', backgroundColor: 'white' }}
                          >
                            Ajustar
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

      {/* 3. KARDEX */}
      {activeTab === 'kardex' && (
        <div className="card" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden', backgroundColor: 'white', border: '1px solid var(--border)' }}>
          <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>Historial de Movimientos de Producto Terminado</h3>
              <p style={{ fontSize: '0.74rem', color: '#64748b', margin: '0.15rem 0 0' }}>Registro cronológico de ingresos, salidas, ajustes y cargas históricas.</p>
            </div>
            <button
              type="button"
              onClick={exportKardexToExcel}
              style={{
                backgroundColor: '#16a34a',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '0.5rem 1.1rem',
                fontSize: '0.78rem',
                fontWeight: '900',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)'
              }}
            >
              <FileSpreadsheet size={16} /> Exportar Kardex a Excel (.csv)
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2.5px solid var(--border)', textAlign: 'left', backgroundColor: '#f8fafc' }}>
                  {['Fecha / Hora', 'Movimiento', 'Documento', 'Referencia', 'Producto', 'Categoría', 'Color', 'Talla', 'Cant.', 'Saldo Ant. ➔ Nuevo', 'Bodega', 'Usuario'].map(h => (
                    <th key={h} style={{ padding: '1rem 1.5rem', fontWeight: '800', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {kardex.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      El Kardex no registra movimientos aún.
                    </td>
                  </tr>
                ) : (
                  kardex.map(mov => {
                    const isPositive = mov.tipo_movimiento.toLowerCase().includes('ingreso') || mov.tipo_movimiento.toLowerCase().includes('positivo') || mov.tipo_movimiento.toLowerCase().includes('entrada') || mov.tipo_movimiento.toLowerCase().includes('devolucion');
                    
                    return (
                      <tr key={mov.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '1rem 1.5rem', color: '#64748b' }}>{new Date(mov.created_at).toLocaleString('es-CO')}</td>
                        <td style={{ padding: '1rem 1.5rem' }}>
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: '800',
                            backgroundColor: isPositive ? '#d1fae5' : '#fee2e2',
                            color: isPositive ? '#065f46' : '#991b1b'
                          }}>
                            {mov.tipo_movimiento}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>
                          {mov.documento_origen ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '0.2rem 0.65rem',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: '850',
                              backgroundColor: '#fdf2f4',
                              color: '#80082E',
                              border: '1px solid #fecdd3'
                            }}>
                              📦 {mov.documento_origen}
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '1rem 1.5rem', fontWeight: '800', color: 'var(--primary)' }}>{mov.products?.codigo_referencia || '—'}</td>
                        <td style={{ padding: '1rem 1.5rem', fontWeight: '800', color: '#0f172a' }}>{mov.products?.nombre_producto || '—'}</td>
                        <td style={{ padding: '1rem 1.5rem', fontWeight: '700', color: '#475569' }}>
                          {mov.products?.categories?.categoria || mov.products?.categoria || '—'}
                        </td>
                        <td style={{ padding: '1rem 1.5rem', fontWeight: '600' }}>{mov.colors?.nombre_color || mov.fabrics?.nombre_tela || '—'}</td>
                        <td style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>{mov.sizes?.codigo_talla}</td>
                        <td style={{ padding: '1rem 1.5rem', fontWeight: '950', fontSize: '0.95rem', color: isPositive ? '#16a34a' : '#dc2626' }}>
                          {isPositive ? `+${mov.cantidad}` : `-${mov.cantidad}`}
                        </td>
                        <td style={{ padding: '1rem 1.5rem', fontWeight: '600' }}>
                          <span style={{ color: '#64748b' }}>{mov.saldo_anterior}</span>
                          <span style={{ margin: '0 0.4rem', color: '#94a3b8' }}>➔</span>
                          <span style={{ color: '#0f172a', fontWeight: '700' }}>{mov.saldo_nuevo}</span>
                        </td>
                        <td style={{ padding: '1rem 1.5rem' }}>
                          {mov.warehouse_dest?.nombre_bodega || mov.warehouse_orig?.nombre_bodega || '—'}
                        </td>
                        <td style={{ padding: '1rem 1.5rem', color: '#64748b' }}>{mov.usuario}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. TRANSFERS */}
      {activeTab === 'transfers' && (
        <div className="card" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden', backgroundColor: 'white', border: '1px solid var(--border)' }}>
          <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>Historial de Transferencias Inter-Bodega</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2.5px solid var(--border)', textAlign: 'left', backgroundColor: '#f8fafc' }}>
                  {['Consecutivo', 'Bodega Origen', 'Bodega Destino', 'Estado', 'Solicitado por', 'Fecha', 'Observaciones', 'Detalle Ítems'].map(h => (
                    <th key={h} style={{ padding: '1rem 1.5rem', fontWeight: '800', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      No se registran solicitudes de transferencia.
                    </td>
                  </tr>
                ) : (
                  transfers.map(tx => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem 1.5rem', fontWeight: '800', color: 'var(--primary)' }}>TR-{tx.consecutive}</td>
                      <td style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>{tx.orig?.nombre_bodega}</td>
                      <td style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>{tx.dest?.nombre_bodega}</td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        {tx.estado === 'Pendiente' ? (
                          <button
                            onClick={() => handleAcceptTransfer(tx)}
                            style={{
                              padding: '0.4rem 0.85rem',
                              borderRadius: '8px',
                              backgroundColor: '#10b981',
                              color: 'white',
                              border: 'none',
                              fontWeight: '800',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
                            }}
                          >
                            <CheckCircle2 size={12} /> Recibir / Aceptar
                          </button>
                        ) : (
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '6px',
                            fontSize: '0.7rem',
                            fontWeight: '800',
                            backgroundColor: tx.estado === 'Recibida' ? '#d1fae5' : '#fee2e2',
                            color: tx.estado === 'Recibida' ? '#065f46' : '#991b1b'
                          }}>
                            {tx.estado}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '1rem 1.5rem', color: '#64748b' }}>{tx.usuario}</td>
                      <td style={{ padding: '1rem 1.5rem', color: '#64748b' }}>{new Date(tx.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: '1rem 1.5rem' }}>{tx.observaciones || '—'}</td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.75rem' }}>
                          {tx.finished_goods_transfer_items?.map((item: any) => (
                            <span key={item.id} style={{ fontStyle: 'italic' }}>
                              - {item.products?.nombre_producto} ({item.sizes?.codigo_talla}): <strong>{item.cantidad} uds</strong>
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. LOCATIONS */}
      {activeTab === 'locations' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
          {/* Create location card */}
          <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', backgroundColor: 'white', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '900', color: '#0f172a', marginBottom: '1.25rem' }}>Nueva Ubicación Interna</h3>
            <form onSubmit={handleSaveLocation} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Seleccionar Bodega</label>
                <select
                  required
                  value={locationForm.warehouse_id}
                  onChange={e => setLocationForm({ ...locationForm, warehouse_id: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                >
                  <option value="">Seleccionar...</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.nombre_bodega}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Pasillo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Pasillo A"
                  value={locationForm.pasillo}
                  onChange={e => setLocationForm({ ...locationForm, pasillo: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Estantería</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Estante 3"
                  value={locationForm.estanteria}
                  onChange={e => setLocationForm({ ...locationForm, estanteria: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Nivel</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Nivel 2"
                  value={locationForm.nivel}
                  onChange={e => setLocationForm({ ...locationForm, nivel: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Posición</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Posición B"
                  value={locationForm.posicion}
                  onChange={e => setLocationForm({ ...locationForm, posicion: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                />
              </div>

              <button type="submit" disabled={savingLocation} className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                {savingLocation ? <Loader2 size={16} className="animate-spin" /> : 'Registrar Ubicación'}
              </button>
            </form>
          </div>

          {/* Locations list */}
          <div className="card" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden', backgroundColor: 'white', border: '1px solid var(--border)' }}>
            <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>Ubicaciones Internas Registradas</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2.5px solid var(--border)', textAlign: 'left', backgroundColor: '#f8fafc' }}>
                    {['Bodega', 'Pasillo', 'Estantería', 'Nivel', 'Posición', 'Fecha Creación'].map(h => (
                      <th key={h} style={{ padding: '1rem 1.5rem', fontWeight: '800', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {locations.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        No se han configurado ubicaciones internas aún.
                      </td>
                    </tr>
                  ) : (
                    locations.map(loc => {
                      const wh = warehouses.find(w => w.id === loc.warehouse_id);
                      return (
                        <tr key={loc.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '1rem 1.5rem', fontWeight: '800' }}>{wh?.nombre_bodega || '—'}</td>
                          <td style={{ padding: '1rem 1.5rem', fontWeight: '600' }}>{loc.pasillo}</td>
                          <td style={{ padding: '1rem 1.5rem', fontWeight: '600' }}>{loc.estanteria}</td>
                          <td style={{ padding: '1rem 1.5rem', fontWeight: '600' }}>{loc.nivel}</td>
                          <td style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>{loc.posicion}</td>
                          <td style={{ padding: '1rem 1.5rem', color: '#64748b' }}>{new Date(loc.created_at).toLocaleDateString()}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. INITIAL LOAD ASSISTANT */}
      {activeTab === 'initial_load' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', backgroundColor: 'white', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '900', color: '#0f172a', marginBottom: '0.5rem' }}>Asistente de Carga Masiva de Saldo Inicial</h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>
              Copia y pega celdas desde un archivo Excel. La tabla debe tener exactamente 5 columnas en este orden: <br />
              <strong>[Nombre Producto/Referencia]</strong>, <strong>[Nombre Color]</strong>, <strong>[Código Talla]</strong>, <strong>[Cantidad]</strong>, <strong>[Nombre Bodega]</strong>
            </p>
            
            <textarea
              rows={8}
              placeholder="Camisa Corta&#9;NEGRO&#9;XL&#9;150&#9;Bodega Transito&#9;&#10;Pantalón Classic&#9;AZUL&#9;M&#9;80&#9;Bodega Principal"
              value={rawPaste}
              onChange={e => setRawPaste(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.85rem', fontFamily: 'monospace', marginBottom: '1rem' }}
            />
            
            <button className="btn btn-primary" onClick={handleParsePaste}>
              <Upload size={16} /> Previsualizar Carga
            </button>
          </div>

          {parsedData.length > 0 && (
            <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', backgroundColor: 'white', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>Previsualización y Validación</h3>
                <button className="btn btn-primary" disabled={importing} onClick={handleImportData}>
                  {importing ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar e Importar al Inventario'}
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left', backgroundColor: '#f8fafc' }}>
                      {['Fila', 'Producto/Ref', 'Color', 'Talla', 'Cant.', 'Bodega', 'Estado de Validación'].map(h => (
                        <th key={h} style={{ padding: '0.6rem 1rem', fontWeight: '800', color: '#475569', fontSize: '0.75rem' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border)', backgroundColor: row.valid ? 'transparent' : '#fef2f2' }}>
                        <td style={{ padding: '0.6rem 1rem' }}>{row.rowNum}</td>
                        <td style={{ padding: '0.6rem 1rem', fontWeight: '700' }}>{row.rawRef} {row.productId ? '✓' : '❌ (No existe)'}</td>
                        <td style={{ padding: '0.6rem 1rem' }}>{row.rawColor} {row.colorId ? '✓' : '⚠️ (Sin color)'}</td>
                        <td style={{ padding: '0.6rem 1rem', fontWeight: '700' }}>{row.rawSize} {row.sizeId ? '✓' : '❌ (Talla inválida)'}</td>
                        <td style={{ padding: '0.6rem 1rem', fontWeight: '800' }}>{row.qty}</td>
                        <td style={{ padding: '0.6rem 1rem' }}>{row.rawWh} {row.warehouseId ? '✓' : '❌ (Bodega inválida)'}</td>
                        <td style={{ padding: '0.6rem 1rem' }}>
                          {row.valid ? (
                            <span style={{ color: '#16a34a', fontWeight: '700' }}>Válido</span>
                          ) : (
                            <span style={{ color: '#dc2626', fontWeight: '700' }}>Rechazado (Corrige los datos)</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 7. HISTORICAL INVENTORY ASSISTANT */}
      {activeTab === 'historical_inventory' && (() => {
        // Aggregated data calculation for Tablero Inicial
        const allHistGarments = histBatches.flatMap(b => b.garments || []);
        const totalHistGarments = allHistGarments.length;

        const categoryAggMap: Record<string, { categoryName: string; count: number; productsSet: Set<string> }> = {};
        const productAggMap: Record<string, { refCode: string; prodName: string; categoryName: string; count: number }> = {};

        allHistGarments.forEach((g: any) => {
          const prod = products.find(p => p.id === g.product_id || p.codigo_referencia === g.reference_name);
          const catObj = categories.find(c => c.id === prod?.category_id);
          const catName = catObj?.categoria || prod?.categoria || 'Sin Categoría';
          const refCode = g.reference_name || prod?.codigo_referencia || 'Desconocido';
          const prodName = prod?.nombre_producto || refCode;

          if (!categoryAggMap[catName]) {
            categoryAggMap[catName] = { categoryName: catName, count: 0, productsSet: new Set() };
          }
          categoryAggMap[catName].count += 1;
          categoryAggMap[catName].productsSet.add(refCode);

          if (!productAggMap[refCode]) {
            productAggMap[refCode] = { refCode, prodName, categoryName: catName, count: 0 };
          }
          productAggMap[refCode].count += 1;
        });

        const categoryList = Object.values(categoryAggMap).sort((a, b) => b.count - a.count);
        const productList = Object.values(productAggMap).sort((a, b) => b.count - a.count);
        const totalDistinctProducts = productList.length;
        const totalDistinctCategories = categoryList.length;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* BARRA DE NAVEGACIÓN Y EXPORTADOR EXCEL DE INVENTARIO HISTÓRICO */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '0.6rem 0.8rem', borderRadius: '14px', border: '1px solid var(--border)', flexWrap: 'wrap', gap: '0.6rem' }}>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setHistSubTab('dashboard')}
                  style={{
                    padding: '0.55rem 1.1rem',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: histSubTab === 'dashboard' ? '#80082E' : 'transparent',
                    color: histSubTab === 'dashboard' ? 'white' : '#64748b',
                    fontSize: '0.82rem',
                    fontWeight: '900',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    boxShadow: histSubTab === 'dashboard' ? '0 2px 4px rgba(128, 8, 46, 0.2)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <BarChart3 size={16} /> 📊 Tablero e Informe Consolidado
                </button>

                <button
                  type="button"
                  onClick={() => setHistSubTab('counted_form')}
                  style={{
                    padding: '0.55rem 1.1rem',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: histSubTab === 'counted_form' ? '#80082E' : 'transparent',
                    color: histSubTab === 'counted_form' ? 'white' : '#64748b',
                    fontSize: '0.82rem',
                    fontWeight: '900',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    boxShadow: histSubTab === 'counted_form' ? '0 2px 4px rgba(128, 8, 46, 0.2)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Plus size={16} /> 📝 Registrar Conteo de Lote
                </button>

                <button
                  type="button"
                  onClick={() => setHistSubTab('batches_list')}
                  style={{
                    padding: '0.55rem 1.1rem',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: histSubTab === 'batches_list' ? '#80082E' : 'transparent',
                    color: histSubTab === 'batches_list' ? 'white' : '#64748b',
                    fontSize: '0.82rem',
                    fontWeight: '900',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    boxShadow: histSubTab === 'batches_list' ? '0 2px 4px rgba(128, 8, 46, 0.2)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <History size={16} /> 📜 Histórico de Lotes ({histBatches.length})
                </button>
              </div>

              <button
                type="button"
                onClick={exportHistoricalReportToExcel}
                style={{
                  backgroundColor: '#16a34a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.55rem 1.15rem',
                  fontSize: '0.82rem',
                  fontWeight: '900',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 2px 5px rgba(22, 163, 74, 0.25)'
                }}
              >
                <FileSpreadsheet size={18} /> Exportar Reporte Excel (.csv)
              </button>
            </div>

            {/* 📊 TABLERO INICIAL E INFORME CONSOLIDADO */}
            {histSubTab === 'dashboard' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Header Info */}
                <div className="card" style={{ padding: '1.75rem', borderRadius: '16px', backgroundColor: 'white', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: '950', color: '#0f172a', margin: '0 0 0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        📊 Tablero General - Histórico de Lotes & Etiquetas Generadas
                      </h3>
                      <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                        Monitoreo general de prendas registradas, desglose por categorías y resumen exportable a Excel.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={exportHistoricalReportToExcel}
                      style={{
                        backgroundColor: '#ecfdf5',
                        color: '#16a34a',
                        border: '1.5px solid #a7f3d0',
                        borderRadius: '8px',
                        padding: '0.5rem 1rem',
                        fontSize: '0.78rem',
                        fontWeight: '900',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                      }}
                    >
                      <FileSpreadsheet size={15} /> Descargar Informe Completo Excel
                    </button>
                  </div>

                  {/* 4 KPIs TARJETAS PRINCIPALES */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginTop: '1.5rem' }}>
                    <div style={{ padding: '1.25rem', borderRadius: '14px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase' }}>
                        <FileText size={16} color="#80082E" /> Total Lotes
                      </div>
                      <span style={{ fontSize: '1.8rem', fontWeight: '950', color: '#0f172a' }}>{histBatches.length}</span>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '600' }}>Lotes registrados</span>
                    </div>

                    <div style={{ padding: '1.25rem', borderRadius: '14px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#065f46', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase' }}>
                        <Tag size={16} color="#059669" /> Total Etiquetas
                      </div>
                      <span style={{ fontSize: '1.8rem', fontWeight: '950', color: '#065f46' }}>{totalHistGarments.toLocaleString()}</span>
                      <span style={{ fontSize: '0.72rem', color: '#047857', fontWeight: '600' }}>Prendas individuales</span>
                    </div>

                    <div style={{ padding: '1.25rem', borderRadius: '14px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e40af', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase' }}>
                        <Package size={16} color="#2563eb" /> Productos
                      </div>
                      <span style={{ fontSize: '1.8rem', fontWeight: '950', color: '#1e3a8a' }}>{totalDistinctProducts}</span>
                      <span style={{ fontSize: '0.72rem', color: '#3b82f6', fontWeight: '600' }}>Referencias distintas</span>
                    </div>

                    <div style={{ padding: '1.25rem', borderRadius: '14px', backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6b21a8', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase' }}>
                        <Layers size={16} color="#9333ea" /> Categorías
                      </div>
                      <span style={{ fontSize: '1.8rem', fontWeight: '950', color: '#581c87' }}>{totalDistinctCategories}</span>
                      <span style={{ fontSize: '0.72rem', color: '#7e22ce', fontWeight: '600' }}>Líneas de producto</span>
                    </div>
                  </div>
                </div>

                {/* RESUMEN DE CATEGORÍAS */}
                <div className="card" style={{ padding: '1.75rem', borderRadius: '16px', backgroundColor: 'white', border: '1px solid var(--border)' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '950', color: '#0f172a', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    🗂️ Distribución por Categorías de Producto
                  </h3>
                  {categoryList.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                      No hay prendas históricas para clasificar por categoría.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                      {categoryList.map((cat, cIdx) => {
                        const pct = totalHistGarments > 0 ? ((cat.count / totalHistGarments) * 100).toFixed(1) : '0';
                        return (
                          <div key={cIdx} style={{ padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.88rem', fontWeight: '900', color: '#80082E' }}>{cat.categoryName}</span>
                              <span style={{ backgroundColor: '#e2e8f0', color: '#334155', fontWeight: '800', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.74rem' }}>
                                {cat.productsSet.size} refs
                              </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                              <span style={{ fontSize: '1.4rem', fontWeight: '950', color: '#0f172a' }}>{cat.count.toLocaleString()} <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '600' }}>prendas</span></span>
                              <span style={{ fontSize: '0.85rem', fontWeight: '900', color: '#10b981' }}>{pct}%</span>
                            </div>

                            {/* Progress bar */}
                            <div style={{ width: '100%', height: '6px', backgroundColor: '#cbd5e1', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', backgroundColor: '#80082E', borderRadius: '3px' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* TABLA DE PRODUCTOS / REFERENCIAS Y CANTIDADES TOTALES */}
                <div className="card" style={{ padding: '1.75rem', borderRadius: '16px', backgroundColor: 'white', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: '950', color: '#0f172a', margin: 0 }}>
                        📋 Consolidado por Producto y Referencia ({productList.length})
                      </h3>
                      <p style={{ fontSize: '0.74rem', color: '#64748b', margin: '0.15rem 0 0' }}>
                        Resumen detallado de prendas contadas por cada referencia en el histórico.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={exportHistoricalReportToExcel}
                      style={{
                        backgroundColor: '#f1f5f9',
                        color: '#334155',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.75rem',
                        fontWeight: '800',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <Download size={14} /> Exportar Tabla CSV
                    </button>
                  </div>

                  {productList.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                      No hay productos registrados en el histórico.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '12px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1.5px solid #cbd5e1' }}>
                            <th style={{ padding: '0.75rem 1rem', fontWeight: '900', color: '#475569' }}>Código Referencia</th>
                            <th style={{ padding: '0.75rem 1rem', fontWeight: '900', color: '#475569' }}>Nombre Producto</th>
                            <th style={{ padding: '0.75rem 1rem', fontWeight: '900', color: '#475569' }}>Categoría</th>
                            <th style={{ padding: '0.75rem 1rem', fontWeight: '900', color: '#475569', textAlign: 'center' }}>Total Prendas</th>
                            <th style={{ padding: '0.75rem 1rem', fontWeight: '900', color: '#475569', textAlign: 'right' }}>% Participación</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productList.map((prod, pIdx) => {
                            const pct = totalHistGarments > 0 ? ((prod.count / totalHistGarments) * 100).toFixed(1) : '0';
                            return (
                              <tr key={pIdx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '0.75rem 1rem', fontWeight: '900', color: '#80082E' }}>{prod.refCode}</td>
                                <td style={{ padding: '0.75rem 1rem', fontWeight: '700', color: '#0f172a' }}>{prod.prodName}</td>
                                <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>
                                  <span style={{ backgroundColor: '#f1f5f9', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontWeight: '700', fontSize: '0.74rem' }}>
                                    {prod.categoryName}
                                  </span>
                                </td>
                                <td style={{ padding: '0.75rem 1rem', fontWeight: '900', textAlign: 'center', color: '#059669' }}>
                                  {prod.count.toLocaleString()} uds
                                </td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '850', color: '#334155' }}>
                                  {pct}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 📝 FORMULARIO DE REGISTRO DE CONTEO */}
            {histSubTab === 'counted_form' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="card" style={{ padding: '1.75rem', borderRadius: '16px', backgroundColor: 'white', border: '1px solid var(--border)' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '950', color: '#0f172a', margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    📝 Registrar Conteo de Inventario Histórico
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1.5rem' }}>
                    Registra los productos físicos que deseas ingresar al sistema. Cada prenda recibirá un código único correlativo y se registrará como ingreso histórico en la Bodega Principal.
                  </p>

                  <form onSubmit={handleAddHistItem} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#334155', marginBottom: '0.4rem' }}>Nombre de Documento / Lote</label>
                        <input
                          type="text"
                          required
                          value={histDocName}
                          onChange={e => setHistDocName(e.target.value)}
                          placeholder="Ej. Carga Inicial 2026"
                          style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.82rem', fontWeight: '700' }}
                        />
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid #f1f5f9', padding: '1rem 0 0' }} />

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                      {/* Buscador Ultra Rápido e Intuitivo de Producto (Combobox UX) */}
                      <div style={{ position: 'relative' }}>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#334155', marginBottom: '0.4rem' }}>
                          🔍 Buscar Referencia / Producto ({displayProducts.length} habilitados)
                        </label>

                        {histProduct ? (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.5rem 0.8rem',
                            backgroundColor: '#fdf2f4',
                            border: '1.5px solid #80082E',
                            borderRadius: '8px',
                            color: '#80082E',
                            fontWeight: '800',
                            fontSize: '0.82rem'
                          }}>
                            <span>
                              📦 {products.find(p => p.id === histProduct)?.nombre_producto} ({products.find(p => p.id === histProduct)?.codigo_referencia})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setHistProduct('');
                                setHistProdSearchQuery('');
                              }}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#80082E',
                                fontWeight: '900',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                padding: '0 0.2rem'
                              }}
                              title="Cambiar producto"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div style={{ position: 'relative' }}>
                            <input
                              type="text"
                              value={histProdSearchQuery}
                              onFocus={() => setShowHistProdDropdown(true)}
                              onChange={e => {
                                setHistProdSearchQuery(e.target.value);
                                setShowHistProdDropdown(true);
                              }}
                              placeholder="Escribe nombre o referencia (ej. Top Lili, Body, Polo)..."
                              style={{
                                width: '100%',
                                padding: '0.6rem 0.8rem',
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                fontSize: '0.82rem',
                                fontWeight: '700'
                              }}
                            />

                            {showHistProdDropdown && (
                              <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                backgroundColor: 'white',
                                border: '1px solid #cbd5e1',
                                borderRadius: '10px',
                                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
                                zIndex: 50,
                                maxHeight: '240px',
                                overflowY: 'auto',
                                marginTop: '0.3rem'
                              }}>
                                {filteredHistProducts.length === 0 ? (
                                  <div style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
                                    No se encontraron productos activos con esa búsqueda.
                                  </div>
                                ) : (
                                  filteredHistProducts.map(p => (
                                    <div
                                      key={p.id}
                                      onClick={() => {
                                        setHistProduct(p.id);
                                        setShowHistProdDropdown(false);
                                        setHistProdSearchQuery('');
                                      }}
                                      style={{
                                        padding: '0.6rem 0.9rem',
                                        fontSize: '0.81rem',
                                        fontWeight: '700',
                                        color: '#0f172a',
                                        borderBottom: '1px solid #f1f5f9',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        transition: 'background 0.15s'
                                      }}
                                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fdf2f4'}
                                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
                                    >
                                      <span>{p.nombre_producto}</span>
                                      <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', backgroundColor: '#e2e8f0', borderRadius: '4px', color: '#475569' }}>
                                        {p.codigo_referencia}
                                      </span>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#334155', marginBottom: '0.4rem' }}>Color</label>
                        <select
                          value={histColor}
                          onChange={e => setHistColor(e.target.value)}
                          style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer' }}
                        >
                          <option value="">Ninguno / Sin color</option>
                          {colors.map(c => <option key={c.id} value={c.id}>{c.nombre_color}</option>)}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#334155', marginBottom: '0.4rem' }}>Talla</label>
                        <select
                          value={histSize}
                          onChange={e => setHistSize(e.target.value)}
                          style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer' }}
                        >
                          <option value="">Seleccionar...</option>
                          {sizes.map(s => <option key={s.id} value={s.id}>{s.codigo_talla}</option>)}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#334155', marginBottom: '0.4rem' }}>Cantidad Física Contada</label>
                        <input
                          type="number"
                          min={1}
                          value={histQty}
                          onChange={e => setHistQty(Math.max(1, parseInt(e.target.value) || 0))}
                          style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.82rem', fontWeight: '700' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#334155', marginBottom: '0.4rem' }}>Notas / Observaciones del Conteo</label>
                      <input
                        type="text"
                        value={histNotes}
                        onChange={e => setHistNotes(e.target.value)}
                        placeholder="Ej. Caja 1 - Saldo del año pasado"
                        style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.82rem', fontWeight: '700' }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '900' }}>
                        <Plus size={16} /> Agregar al Conteo
                      </button>
                    </div>
                  </form>
                </div>

                {/* List of Counted Items */}
                <div className="card" style={{ padding: '1.75rem', borderRadius: '16px', backgroundColor: 'white', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: '950', color: '#0f172a', margin: 0 }}>📋 Referencias Agregadas ({histCountedList.length})</h3>
                      <p style={{ fontSize: '0.74rem', color: '#64748b', margin: '0.15rem 0 0' }}>Lista de productos pendientes por ingresar a base de datos.</p>
                    </div>
                    
                    {histCountedList.length > 0 && (
                      <button
                        type="button"
                        onClick={handleProcessHistLoad}
                        disabled={histProcessing}
                        style={{
                          backgroundColor: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '0.6rem 1.5rem',
                          fontSize: '0.8rem',
                          fontWeight: '900',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)'
                        }}
                      >
                        {histProcessing ? (
                          <>
                            <Loader2 size={16} className="animate-spin" /> Procesando Carga...
                          </>
                        ) : (
                          <>
                            ⚡ Guardar y Generar Códigos ({histCountedList.reduce((sum, item) => sum + item.qty, 0)} uds)
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {histCountedList.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', border: '1.5px dashed #cbd5e1', borderRadius: '12px' }}>
                      <Package size={36} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
                      <p style={{ margin: 0, fontWeight: '700', fontSize: '0.85rem' }}>No hay referencias agregadas al conteo.</p>
                      <p style={{ fontSize: '0.74rem', color: '#94a3b8', margin: '0.2rem 0 0' }}>Usa el formulario superior para relacionar los productos físicos que tienes.</p>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '12px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1.5px solid #cbd5e1' }}>
                            <th style={{ padding: '0.75rem 1rem', fontWeight: '900', color: '#475569' }}>Referencia</th>
                            <th style={{ padding: '0.75rem 1rem', fontWeight: '900', color: '#475569' }}>Color</th>
                            <th style={{ padding: '0.75rem 1rem', fontWeight: '900', color: '#475569' }}>Talla</th>
                            <th style={{ padding: '0.75rem 1rem', fontWeight: '900', color: '#475569', textAlign: 'center' }}>Cantidad</th>
                            <th style={{ padding: '0.75rem 1rem', fontWeight: '900', color: '#475569' }}>Observaciones</th>
                            <th style={{ padding: '0.75rem 1rem', fontWeight: '900', color: '#475569', textAlign: 'right' }}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {histCountedList.map((item) => (
                            <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '0.75rem 1rem', fontWeight: '800', color: '#80082E' }}>{item.productName} ({item.productRef})</td>
                              <td style={{ padding: '0.75rem 1rem', fontWeight: '700', color: '#334155' }}>{item.colorName}</td>
                              <td style={{ padding: '0.75rem 1rem', fontWeight: '900' }}>
                                <span style={{ backgroundColor: '#f1f5f9', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}>{item.sizeCode}</span>
                              </td>
                              <td style={{ padding: '0.75rem 1rem', fontWeight: '850', textAlign: 'center', fontSize: '0.9rem', color: '#0f172a' }}>{item.qty} uds</td>
                              <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{item.notes || '—'}</td>
                              <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveHistItem(item.id)}
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#ef4444',
                                    fontWeight: '800',
                                    cursor: 'pointer',
                                    fontSize: '0.78rem'
                                  }}
                                >
                                  Quitar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 📜 HISTÓRICO DE LOTES Y ETIQUETAS GENERADAS */}
            {histSubTab === 'batches_list' && (
              <div className="card" style={{ padding: '1.75rem', borderRadius: '16px', backgroundColor: 'white', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '950', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      📜 Histórico de Lotes de Etiquetas Generadas
                    </h3>
                    <p style={{ fontSize: '0.76rem', color: '#64748b', margin: '0.2rem 0 0' }}>
                      Consulta los conjuntos de etiquetas creados en cargas históricas y reimprímelos cuando lo necesites.
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ position: 'relative', width: '240px' }}>
                      <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input
                        type="text"
                        value={histSearchTerm}
                        onChange={e => setHistSearchTerm(e.target.value)}
                        placeholder="Buscar lote o ref..."
                        style={{ width: '100%', padding: '0.45rem 0.6rem 0.45rem 2rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.78rem', fontWeight: '600' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={fetchHistoricalBatches}
                      disabled={loadingHistBatches}
                      title="Actualizar histórico"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0.5rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        backgroundColor: '#f8fafc',
                        color: '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      <RefreshCw size={16} className={loadingHistBatches ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>

                {loadingHistBatches ? (
                  <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                    <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
                    <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: '700' }}>Cargando lotes históricos...</p>
                  </div>
                ) : histBatches.length === 0 ? (
                  <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b', border: '1.5px dashed #cbd5e1', borderRadius: '12px' }}>
                    <History size={32} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
                    <p style={{ margin: 0, fontWeight: '700', fontSize: '0.85rem' }}>No hay lotes históricos de etiquetas registrados.</p>
                    <p style={{ fontSize: '0.74rem', color: '#94a3b8', margin: '0.2rem 0 0' }}>Al guardar inventario histórico se guardarán automáticamente aquí para su reimpresión.</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '12px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1.5px solid #cbd5e1' }}>
                          <th style={{ padding: '0.75rem 1rem', fontWeight: '900', color: '#475569' }}>Nombre de Documento / Lote</th>
                          <th style={{ padding: '0.75rem 1rem', fontWeight: '900', color: '#475569' }}>Fecha de Registro</th>
                          <th style={{ padding: '0.75rem 1rem', fontWeight: '900', color: '#475569', textAlign: 'center' }}>Total Prendas</th>
                          <th style={{ padding: '0.75rem 1rem', fontWeight: '900', color: '#475569' }}>Referencias Incluidas</th>
                          <th style={{ padding: '0.75rem 1rem', fontWeight: '900', color: '#475569', textAlign: 'right' }}>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {histBatches
                          .filter(b => {
                            if (!histSearchTerm.trim()) return true;
                            const term = histSearchTerm.toLowerCase();
                            const matchDoc = b.docName.toLowerCase().includes(term);
                            const matchGarments = b.garments.some((g: any) =>
                              (g.reference_name || '').toLowerCase().includes(term) ||
                              (g.barcode || '').includes(term) ||
                              (g.color_name || '').toLowerCase().includes(term)
                            );
                            return matchDoc || matchGarments;
                          })
                          .map((batch, idx) => {
                            const dateFormatted = new Date(batch.createdAt).toLocaleString('es-CO', {
                              year: 'numeric', month: '2-digit', day: '2-digit',
                              hour: '2-digit', minute: '2-digit'
                            });

                            const summaryEntries = Object.entries(batch.summary);

                            return (
                              <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '0.75rem 1rem', fontWeight: '900', color: '#0f172a' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <FileText size={15} color="#80082E" />
                                    {batch.docName}
                                  </div>
                                </td>
                                <td style={{ padding: '0.75rem 1rem', color: '#475569', fontSize: '0.78rem', fontWeight: '600' }}>
                                  {dateFormatted}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                  <span style={{ backgroundColor: '#ecfdf5', color: '#065f46', fontWeight: '900', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid #a7f3d0' }}>
                                    🏷️ {batch.garments.length} etiquetas
                                  </span>
                                </td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                    {summaryEntries.map(([refName, count], sIdx) => (
                                      <span key={sIdx} style={{ backgroundColor: '#f1f5f9', color: '#334155', fontSize: '0.72rem', fontWeight: '700', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                                        {refName} ({count as number})
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setHistSuccessGarments(batch.garments);
                                      setShowHistLabelsModal(true);
                                    }}
                                    style={{
                                      backgroundColor: '#80082E',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '8px',
                                      padding: '0.45rem 0.9rem',
                                      fontSize: '0.76rem',
                                      fontWeight: '900',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.4rem',
                                      boxShadow: '0 2px 4px rgba(128, 8, 46, 0.15)'
                                    }}
                                  >
                                    <Printer size={14} /> Reimprimir Etiquetas
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

          </div>
        );
      })()}

      {/* ADJUSTMENT MODAL */}
      {showAdjustmentModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: '90%', maxWidth: '500px', padding: '2rem', backgroundColor: 'white', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontWeight: '900' }}>Ajustar Inventario Manual</h3>
              <button onClick={() => setShowAdjustmentModal(false)} style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSaveAdjustment} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {!adjustmentForm.stock_id ? (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Bodega</label>
                    <select
                      required
                      value={adjustmentForm.warehouse_id}
                      onChange={e => setAdjustmentForm({ ...adjustmentForm, warehouse_id: e.target.value })}
                      style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                    >
                      <option value="">Seleccionar...</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.nombre_bodega}</option>)}
                    </select>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', margin: 0 }}>Referencia / Producto</label>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', fontWeight: '700', color: '#80082E', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={showAllMasterProducts}
                          onChange={e => setShowAllMasterProducts(e.target.checked)}
                          style={{ accentColor: '#80082E', cursor: 'pointer' }}
                        />
                        <span>Ver todo el maestro</span>
                      </label>
                    </div>
                    <select
                      required
                      value={adjustmentForm.product_id}
                      onChange={e => setAdjustmentForm({ ...adjustmentForm, product_id: e.target.value })}
                      style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                    >
                      <option value="">Seleccionar...</option>
                      {displayProducts.map(p => <option key={p.id} value={p.id}>{p.nombre_producto} ({p.codigo_referencia})</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Color</label>
                      <select
                        value={adjustmentForm.color_id}
                        onChange={e => setAdjustmentForm({ ...adjustmentForm, color_id: e.target.value, fabric_id: '' })}
                        style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                      >
                        <option value="">Ninguno</option>
                        {colors.map(c => <option key={c.id} value={c.id}>{c.nombre_color}</option>)}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Talla</label>
                      <select
                        required
                        value={adjustmentForm.size_id}
                        onChange={e => setAdjustmentForm({ ...adjustmentForm, size_id: e.target.value })}
                        style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                      >
                        <option value="">Seleccionar...</option>
                        {sizes.map(s => <option key={s.id} value={s.id}>{s.codigo_talla}</option>)}
                      </select>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px', fontSize: '0.85rem' }}>
                  <strong>Ajustando SKU:</strong> {products.find(p => p.id === adjustmentForm.product_id)?.nombre_producto} | {colors.find(c => c.id === adjustmentForm.color_id)?.nombre_color || '—'} | {sizes.find(s => s.id === adjustmentForm.size_id)?.codigo_talla}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Tipo Ajuste</label>
                <select
                  value={adjustmentForm.type}
                  onChange={e => setAdjustmentForm({ ...adjustmentForm, type: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                >
                  <option value="Ajuste positivo">Ingreso (Ajuste positivo)</option>
                  <option value="Ajuste negativo">Salida (Ajuste negativo)</option>
                  <option value="Baja por deterioro">Baja por deterioro</option>
                  <option value="Corrección de inventario">Corrección de saldo</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Cantidad (prendas)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustmentForm.cantidad}
                  onChange={e => setAdjustmentForm({ ...adjustmentForm, cantidad: Number(e.target.value) })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Observaciones</label>
                <input
                  type="text"
                  required
                  placeholder="Detalle el motivo del ajuste"
                  value={adjustmentForm.observaciones}
                  onChange={e => setAdjustmentForm({ ...adjustmentForm, observaciones: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                />
              </div>

              <button type="submit" disabled={savingAdjustment} className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                {savingAdjustment ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar Ajuste'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TRANSFER MODAL */}
      {showTransferModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: '90%', maxWidth: '600px', padding: '2rem', backgroundColor: 'white', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontWeight: '900' }}>Nueva Transferencia Inter-Bodega</h3>
              <button onClick={() => setShowTransferModal(false)} style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSaveTransfer} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Bodega Origen</label>
                  <select
                    required
                    value={transferForm.warehouse_orig_id}
                    onChange={e => setTransferForm({ ...transferForm, warehouse_orig_id: e.target.value })}
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                  >
                    <option value="">Seleccionar...</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.nombre_bodega}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Bodega Destino</label>
                  <select
                    required
                    value={transferForm.warehouse_dest_id}
                    onChange={e => setTransferForm({ ...transferForm, warehouse_dest_id: e.target.value })}
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                  >
                    <option value="">Seleccionar...</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.nombre_bodega}</option>)}
                  </select>
                </div>
              </div>

              {/* Items manager */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', margin: 0 }}>Prendas a transferir</label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', fontWeight: '700', color: '#80082E', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showAllMasterProducts}
                      onChange={e => setShowAllMasterProducts(e.target.checked)}
                      style={{ accentColor: '#80082E', cursor: 'pointer' }}
                    />
                    <span>Ver todo el maestro</span>
                  </label>
                </div>
                
                <button
                  type="button"
                  onClick={() => {
                    setTransferForm({
                      ...transferForm,
                      items: [...transferForm.items, { product_id: '', color_id: '', size_id: '', cantidad: 1 }]
                    });
                  }}
                  className="btn"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem', marginBottom: '0.75rem', border: '1px solid var(--border)' }}
                >
                  + Agregar Prenda
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                  {transferForm.items.map((item, index) => (
                    <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <select
                        required
                        value={item.product_id}
                        onChange={e => {
                          const items = [...transferForm.items];
                          items[index].product_id = e.target.value;
                          setTransferForm({ ...transferForm, items });
                        }}
                        style={{ flex: 2, padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.8rem' }}
                      >
                        <option value="">Producto...</option>
                        {displayProducts.map(p => <option key={p.id} value={p.id}>{p.nombre_producto}</option>)}
                      </select>

                      <select
                        value={item.color_id}
                        onChange={e => {
                          const items = [...transferForm.items];
                          items[index].color_id = e.target.value;
                          setTransferForm({ ...transferForm, items });
                        }}
                        style={{ flex: 1, padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.8rem' }}
                      >
                        <option value="">Color...</option>
                        {colors.map(c => <option key={c.id} value={c.id}>{c.nombre_color}</option>)}
                      </select>

                      <select
                        required
                        value={item.size_id}
                        onChange={e => {
                          const items = [...transferForm.items];
                          items[index].size_id = e.target.value;
                          setTransferForm({ ...transferForm, items });
                        }}
                        style={{ flex: 1, padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.8rem' }}
                      >
                        <option value="">Talla...</option>
                        {sizes.map(s => <option key={s.id} value={s.id}>{s.codigo_talla}</option>)}
                      </select>

                      <input
                        type="number"
                        min="1"
                        required
                        value={item.cantidad}
                        onChange={e => {
                          const items = [...transferForm.items];
                          items[index].cantidad = Number(e.target.value);
                          setTransferForm({ ...transferForm, items });
                        }}
                        style={{ width: '60px', padding: '0.4rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.8rem', textAlign: 'center' }}
                      />

                      <button
                        type="button"
                        onClick={() => {
                          const items = transferForm.items.filter((_, i) => i !== index);
                          setTransferForm({ ...transferForm, items });
                        }}
                        style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#ef4444' }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Observaciones / Justificación</label>
                <input
                  type="text"
                  required
                  placeholder="Detalle del despacho de traslado"
                  value={transferForm.observaciones}
                  onChange={e => setTransferForm({ ...transferForm, observaciones: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                />
              </div>

              <button type="submit" disabled={savingTransfer} className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                {savingTransfer ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar y Despachar Traslado'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 🚨 MODAL REVERSIÓN A CALIDAD PARA SUPERADMINISTRADOR */}
      {showRevertModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', maxWidth: '620px', width: '100%', padding: '1.75rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '2px solid #dc2626' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.65rem', fontWeight: 950, color: '#dc2626', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', padding: '0.15rem 0.6rem', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  🚨 EXCLUSIVO SUPERADMINISTRADOR
                </span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 950, color: '#0f172a', margin: '0.35rem 0 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <RefreshCw className="animate-spin-slow" size={20} color="#dc2626" />
                  Revertir Ingreso de Inventario a Calidad
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.2rem 0 0' }}>
                  Descuenta automáticamente del inventario físico y Kardex las prendas ingresadas por error y regresa la orden al módulo de Calidad para su corrección.
                </p>
              </div>
              <button onClick={() => setShowRevertModal(false)} style={{ border: 'none', background: 'none', fontSize: '1.25rem', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleExecuteInventoryRevert} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.4rem' }}>
                  1. Selecciona la Orden / Inspección a Revertir:
                </label>
                <select
                  required
                  value={selectedInspectionId}
                  onChange={e => setSelectedInspectionId(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '700', backgroundColor: '#f8fafc', color: '#0f172a' }}
                >
                  <option value="">-- Seleccionar Orden o Inspección reciente --</option>
                  {recentApprovedInspections.map(ins => {
                    const code = ins.sewing_orders?.confeccion_code || (ins.orders?.consecutive ? `OC-${ins.orders.consecutive.toString().padStart(4, '0')}` : 'Sin código');
                    const prodName = ins.sewing_orders?.products?.nombre_producto || ins.sewing_orders?.products?.codigo_referencia || '';
                    const dateStr = new Date(ins.created_at).toLocaleDateString('es-CO');
                    return (
                      <option key={ins.id} value={ins.id}>
                        {code} — {prodName} ({ins.status} | Etapa {ins.current_stage || 4} | {dateStr})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.4rem' }}>
                  2. Etapa de Destino en Calidad:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                  {[
                    { stage: 1, title: 'Etapa 1: Recepción', desc: 'Revisión desde cero' },
                    { stage: 2, title: 'Etapa 2: Reproceso', desc: 'Arreglos de prendas' },
                    { stage: 3, title: 'Etapa 3: Empaque', desc: 'Empaque y etiquetas' },
                  ].map(s => (
                    <button
                      key={s.stage}
                      type="button"
                      onClick={() => setTargetStage(s.stage)}
                      style={{
                        padding: '0.65rem 0.5rem',
                        borderRadius: '8px',
                        border: `2px solid ${targetStage === s.stage ? '#dc2626' : '#cbd5e1'}`,
                        backgroundColor: targetStage === s.stage ? '#fef2f2' : 'white',
                        color: targetStage === s.stage ? '#991b1b' : '#334155',
                        textAlign: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      <strong style={{ display: 'block', fontSize: '0.78rem' }}>{s.title}</strong>
                      <span style={{ fontSize: '0.68rem', color: '#64748b' }}>{s.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.4rem' }}>
                  3. Motivo de la Reversión (para Auditoría):
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Las cantidades ingresadas no coinciden con las empacadas reales..."
                  value={revertReason}
                  onChange={e => setRevertReason(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ backgroundColor: '#fff7ed', border: '1px solid #ffedd5', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.75rem', color: '#9a3412' }}>
                💡 <strong>Efecto Automático:</strong> El sistema calculará las prendas aprobadas de este lote, las descontará del stock disponible de la bodega correspondiente y registrará un movimiento de salida tipo <em>Reversión / Deshacer por SuperAdmin</em> en el Kardex.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowRevertModal(false)}
                  disabled={executingRevert}
                  style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', backgroundColor: 'white', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={executingRevert || !selectedInspectionId}
                  style={{
                    padding: '0.55rem 1.5rem',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#dc2626',
                    color: 'white',
                    fontSize: '0.8rem',
                    fontWeight: '900',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    opacity: (!selectedInspectionId || executingRevert) ? 0.6 : 1
                  }}
                >
                  {executingRevert ? <Loader2 className="animate-spin" size={16} /> : '⚠️ Confirmar Reversión e Inventario'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 🏷️ MODAL DETALLE DE UNIDADES ÚNICAS POR REFERENCIA */}
      {showUnitDetailModal && selectedStockItemForDetail && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', maxWidth: '750px', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1.5px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.68rem', fontWeight: 900, color: '#4338ca', backgroundColor: '#eef2ff', padding: '0.15rem 0.6rem', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  🏷️ DETALLE DE PRENDAS ÚNICAS
                </span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 950, color: '#0f172a', margin: '0.25rem 0 0' }}>
                  {selectedStockItemForDetail.products?.codigo_referencia || '—'} — {selectedStockItemForDetail.products?.nombre_producto || '—'}
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.1rem 0 0' }}>
                  Color: <strong>{selectedStockItemForDetail.colors?.nombre_color || '—'}</strong> | Talla: <strong>{selectedStockItemForDetail.sizes?.codigo_talla || '—'}</strong> | Bodega: <strong>{selectedStockItemForDetail.warehouses?.nombre_bodega || '—'}</strong> ({unitGarments.length} unidades registradas)
                </p>
              </div>
              <button onClick={() => setShowUnitDetailModal(false)} style={{ border: 'none', background: 'none', fontSize: '1.25rem', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
            </div>

            {/* Modal Content / Table */}
            <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1, backgroundColor: '#f8fafc' }}>
              {loadingUnits ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                  <Loader2 size={24} className="animate-spin" />
                  <span>Cargando unidades físicas e identificadores únicos...</span>
                </div>
              ) : unitGarments.length === 0 ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                  <Package size={36} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
                  <p style={{ margin: 0, fontWeight: 700 }}>No se encontraron prendas físicas unitarias con ID único para esta combinación.</p>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.2rem 0 0' }}>Las prendas de producción reciente generarán automáticamente su código numérico único de 10 dígitos al aprobar inspección en Calidad.</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', backgroundColor: '#edf2f7' }}>
                      <th style={{ padding: '0.6rem 1rem', fontWeight: 800, color: '#475569' }}>ID Único (Código de Barras)</th>
                      <th style={{ padding: '0.6rem 1rem', fontWeight: 800, color: '#475569' }}>Orden de Ingreso</th>
                      <th style={{ padding: '0.6rem 1rem', fontWeight: 800, color: '#475569' }}>Estado</th>
                      <th style={{ padding: '0.6rem 1rem', fontWeight: 800, color: '#475569' }}>Ubicación / Origen</th>
                      <th style={{ padding: '0.6rem 1rem', fontWeight: 800, color: '#475569' }}>Fecha Registro</th>
                      {isSuperAdmin && (
                        <th style={{ padding: '0.6rem 1rem', fontWeight: 800, color: '#dc2626', textAlign: 'right' }}>Acciones (SuperAdmin)</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {unitGarments.map((g: any) => {
                      const isHist = g.is_historical;
                      const qualityCode = g.quality_inspections?.sewing_orders?.confeccion_code ||
                        g.quality_inspections?.orders?.internal_code ||
                        (g.quality_inspections?.orders?.consecutive ? `OC-${g.quality_inspections.orders.consecutive.toString().padStart(4, '0')}` : null);
                      
                      const docLabel = isHist
                        ? (g.historical_doc || 'Inventario Histórico')
                        : (qualityCode || g.notes || 'Carga Inicial');

                      const badgeBg = isHist ? '#eff6ff' : qualityCode ? '#fdf2f4' : '#f8fafc';
                      const badgeColor = isHist ? '#1e40af' : qualityCode ? '#80082E' : '#475569';
                      const badgeBorder = isHist ? '#bfdbfe' : qualityCode ? '#fecdd3' : '#cbd5e1';

                      return (
                        <tr key={g.id} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: 'white' }}>
                          <td style={{ padding: '0.65rem 1rem', fontWeight: 950, fontFamily: 'monospace', fontSize: '0.9rem', color: '#0f172a' }}>
                            <span style={{ backgroundColor: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                              {g.barcode}
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 1rem' }}>
                            <span style={{ fontWeight: 900, color: badgeColor, backgroundColor: badgeBg, padding: '0.2rem 0.65rem', borderRadius: '6px', fontSize: '0.78rem', border: `1px solid ${badgeBorder}` }}>
                              📦 {docLabel}
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 1rem' }}>
                            <span style={{
                              padding: '0.2rem 0.55rem',
                              borderRadius: '12px',
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              backgroundColor: g.status === 'Aprobada' || g.status === 'Disponible' ? '#d1fae5' : g.status === 'Vendido' ? '#dbeafe' : '#fee2e2',
                              color: g.status === 'Aprobada' || g.status === 'Disponible' ? '#065f46' : g.status === 'Vendido' ? '#1e40af' : '#991b1b'
                            }}>
                              {g.status || 'Disponible'}
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 1rem', color: '#475569', fontWeight: 700 }}>
                            {selectedStockItemForDetail.warehouses?.nombre_bodega || 'Bodega Principal'}
                          </td>
                          <td style={{ padding: '0.65rem 1rem', color: '#64748b', fontSize: '0.75rem' }}>
                            {new Date(g.created_at).toLocaleDateString('es-CO')}
                          </td>
                          {isSuperAdmin && (
                            <td style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!confirm(`⚠️ ACCIÓN SUPERADMINISTRADOR:\n\n¿Estás seguro de eliminar la prenda ${g.barcode}?\n\n• Se eliminará la unidad física.\n• Se descontará 1 unidad del stock de la bodega.\n• Se revertirá el saldo y registrará la salida en el Kardex.`)) return;

                                  try {
                                    // 1. Eliminar prenda individual
                                    const { error: delErr } = await supabase.from('individual_garments').delete().eq('id', g.id);
                                    if (delErr) throw delErr;

                                    // 2. Descontar del stock consolidado
                                    if (selectedStockItemForDetail?.id) {
                                      const newQty = Math.max(0, (selectedStockItemForDetail.cantidad_disponible || 1) - 1);
                                      await supabase.from('finished_goods_stock')
                                        .update({ cantidad_disponible: newQty, updated_at: new Date().toISOString() })
                                        .eq('id', selectedStockItemForDetail.id);

                                      // 3. Registrar Kardex de Reversión
                                      await supabase.from('finished_goods_kardex').insert({
                                        product_id: selectedStockItemForDetail.product_id,
                                        color_id: selectedStockItemForDetail.color_id || null,
                                        fabric_id: selectedStockItemForDetail.fabric_id || null,
                                        size_id: selectedStockItemForDetail.size_id,
                                        tipo_movimiento: 'Eliminación Histórica (SuperAdmin)',
                                        cantidad: 1,
                                        stock_anterior: selectedStockItemForDetail.cantidad_disponible,
                                        stock_nuevo: newQty,
                                        warehouse_dest_id: selectedStockItemForDetail.warehouse_id,
                                        documento_origen: g.historical_doc || 'Reversión SuperAdmin',
                                        usuario_email: user?.email || 'SuperAdmin',
                                        observaciones: `Eliminación individual de prenda código ${g.barcode}`
                                      });
                                    }

                                    alert(`✅ Prenda ${g.barcode} eliminada e inventario revertido correctamente.`);
                                    setUnitGarments(prev => prev.filter(item => item.id !== g.id));
                                    await fetchStock();
                                    await fetchKardex();
                                  } catch (err: any) {
                                    alert('Error al eliminar prenda: ' + err.message);
                                  }
                                }}
                                style={{
                                  padding: '0.25rem 0.55rem',
                                  borderRadius: '6px',
                                  fontSize: '0.72rem',
                                  fontWeight: '800',
                                  backgroundColor: '#fee2e2',
                                  color: '#dc2626',
                                  border: '1px solid #fca5a5',
                                  cursor: 'pointer'
                                }}
                              >
                                🗑️ Eliminar y Reversar
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1.5px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                💡 Cada prenda física posee su propio número de 10 dígitos escaneable mediante lector láser o 2D.
              </span>
              <button
                type="button"
                onClick={() => setShowUnitDetailModal(false)}
                style={{ fontSize: '0.8rem', padding: '0.5rem 1.25rem', border: '1.5px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', backgroundColor: 'white', fontWeight: 700 }}
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 🏷️ MODAL PARA IMPRIMIR ETIQUETAS DE INVENTARIO HISTÓRICO */}
      {showHistLabelsModal && histSuccessGarments.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.85)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(8px)' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '20px', maxWidth: '780px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 2rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <span style={{ fontSize: '0.65rem', fontWeight: '800', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Proceso Exitoso</span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '950', color: 'white', margin: '0.15rem 0 0' }}>🏷️ Imprimir Etiquetas de Lote Histórico</h3>
              </div>
              <button type="button" onClick={() => setShowHistLabelsModal(false)} style={{ border: 'none', background: 'rgba(255,255,255,0.2)', fontSize: '1rem', color: 'white', cursor: 'pointer', borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>✕</button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '2rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', backgroundColor: '#f8fafc' }}>
              <div style={{ padding: '1rem 1.25rem', backgroundColor: '#ecfdf5', borderRadius: '12px', border: '1px solid #a7f3d0', color: '#065f46', fontSize: '0.8rem', fontWeight: '700' }}>
                ✓ Se han cargado exitosamente {histSuccessGarments.length} prendas. A continuación puedes previsualizar y generar los archivos de impresión.
              </div>

              {/* Grid of Garments and canvas generator */}
              <div style={{ display: 'none' }}>
                {histSuccessGarments.map((g: any) => (
                  <div key={g.barcode} id={`hist-barcode-container-${g.barcode}`}>
                    <BarcodeCanvas text={g.barcode} type={stickerConfig.barcodeType || 'code128'} height={stickerConfig.barcodeHeight || 55} garmentId={g.barcode} />
                  </div>
                ))}
              </div>

              {/* Table of new barcodes */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1.5px solid #e2e8f0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1' }}>
                      <th style={{ padding: '0.75rem 1.25rem', fontWeight: '900', color: '#475569' }}>Código Único</th>
                      <th style={{ padding: '0.75rem 1.25rem', fontWeight: '900', color: '#475569' }}>Producto</th>
                      <th style={{ padding: '0.75rem 1.25rem', fontWeight: '900', color: '#475569' }}>Color</th>
                      <th style={{ padding: '0.75rem 1.25rem', fontWeight: '900', color: '#475569', textAlign: 'center' }}>Talla</th>
                    </tr>
                  </thead>
                  <tbody>
                    {histSuccessGarments.map((g: any) => (
                      <tr key={g.barcode} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.6rem 1.25rem', fontWeight: '950', fontFamily: 'monospace', color: '#0f172a' }}>{g.barcode}</td>
                        <td style={{ padding: '0.6rem 1.25rem', fontWeight: '750', color: '#334155' }}>{g.reference_name}</td>
                        <td style={{ padding: '0.6rem 1.25rem', color: '#475569' }}>{g.color_name}</td>
                        <td style={{ padding: '0.6rem 1.25rem', fontWeight: '850', textAlign: 'center' }}>
                          <span style={{ backgroundColor: '#f1f5f9', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>{g.size_code}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer / print triggers */}
            <div style={{ padding: '1.25rem 2rem', borderTop: '1.5px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#475569' }}>Barras:</span>
                <select
                  value={stickerConfig.barcodeType || 'code128'}
                  onChange={e => setStickerConfig({ ...stickerConfig, barcodeType: e.target.value })}
                  style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.75rem', fontWeight: '700', backgroundColor: 'white' }}
                >
                  <option value="code128">CODE 128 — Universal</option>
                  <option value="code39">CODE 39 — Alfanumérico</option>
                  <option value="qr">QR 2D</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowHistLabelsModal(false)}
                  style={{ padding: '0.6rem 1.5rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', backgroundColor: 'white', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer' }}
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={handlePrintHistLabels}
                  style={{ padding: '0.6rem 1.75rem', borderRadius: '8px', border: 'none', backgroundColor: '#10b981', color: 'white', fontSize: '0.8rem', fontWeight: '900', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)' }}
                >
                  🖨️ Generar PDF e Imprimir
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
