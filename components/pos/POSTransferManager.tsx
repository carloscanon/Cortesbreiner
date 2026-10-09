'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Truck, Package, ArrowLeftRight, Search, Barcode, CheckCircle2,
  AlertTriangle, ArrowRight, Printer, Download, RefreshCw, X,
  FileText, User, Calendar, MapPin, Check, Plus, Trash2, Eye,
  ShieldCheck, AlertCircle, Clock, Sparkles, Building2, Store
} from 'lucide-react';

interface POSTransferManagerProps {
  currentStore: any;
  user: any;
  profile: any;
  onRefreshInventory?: () => void;
  primaryColor?: string;
  secondaryColor?: string;
}

export default function POSTransferManager({
  currentStore,
  user,
  profile,
  onRefreshInventory,
  primaryColor = '#80082E',
  secondaryColor = '#D81B60'
}: POSTransferManagerProps) {
  const [activeTab, setActiveTab] = useState<'dispatch' | 'receive' | 'history'>('dispatch');
  const [loading, setLoading] = useState(false);

  // Masters
  const [stores, setStores] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);

  // 🚚 DESPACHO STATES
  const [destLocationType, setDestLocationType] = useState<'store' | 'warehouse'>('store');
  const [destLocationId, setDestLocationId] = useState('');
  const [dispatchBarcode, setDispatchBarcode] = useState('');
  const [dispatchItems, setDispatchItems] = useState<any[]>([]);
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [manualSearch, setManualSearch] = useState('');
  const [manualAvailableStock, setManualAvailableStock] = useState<any[]>([]);
  const [selectedStockForAdd, setSelectedStockForAdd] = useState<any>(null);
  const [manualQtyToAdd, setManualQtyToAdd] = useState(1);
  const [manualRowQuantities, setManualRowQuantities] = useState<Record<string, number>>({});
  const [showManualModal, setShowManualModal] = useState(false);
  const [isProcessingDispatch, setIsProcessingDispatch] = useState(false);
  const [lastDispatchedTransfer, setLastDispatchedTransfer] = useState<any>(null);
  const [showDispatchVoucher, setShowDispatchVoucher] = useState(false);

  // 📦 RECEPCIÓN STATES
  const [incomingTransfers, setIncomingTransfers] = useState<any[]>([]);
  const [selectedReceiveTransfer, setSelectedReceiveTransfer] = useState<any>(null);
  const [receiveBarcodeInput, setReceiveBarcodeInput] = useState('');
  const [scannedReceiveBarcodes, setScannedReceiveBarcodes] = useState<Set<string>>(new Set());
  const [scannedItemsCountMap, setScannedItemsCountMap] = useState<Record<string, number>>({});
  const [receivingNotes, setReceivingNotes] = useState('');
  const [isProcessingReceipt, setIsProcessingReceipt] = useState(false);
  const [lastReceivedTransfer, setLastReceivedTransfer] = useState<any>(null);
  const [showReceiptVoucher, setShowReceiptVoucher] = useState(false);
  const receiveInputRef = useRef<HTMLInputElement>(null);
  const dispatchInputRef = useRef<HTMLInputElement>(null);

  // 📜 HISTORIAL STATES
  const [transferHistory, setTransferHistory] = useState<any[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [selectedHistoryTransfer, setSelectedHistoryTransfer] = useState<any>(null);
  const [showHistoryDetailModal, setShowHistoryDetailModal] = useState(false);

  // Helper fetch all pages
  const fetchAllPages = async (queryBuilder: any, maxRecords = 30000) => {
    let allRows: any[] = [];
    let from = 0;
    const step = 1000;
    let keepGoing = true;
    while (keepGoing && from < maxRecords) {
      const { data, error } = await queryBuilder.range(from, from + step - 1);
      if (error || !data || data.length === 0) {
        keepGoing = false;
      } else {
        allRows = [...allRows, ...data];
        if (data.length < step) keepGoing = false;
        else from += step;
      }
    }
    return allRows;
  };

  // ── CARGAR DATOS INICIALES Y MAESTROS ──
  const fetchMasters = async () => {
    setLoading(true);
    try {
      const [stRes, whRes, prRes, colRes, szRes] = await Promise.all([
        supabase.from('stores').select('*').eq('estado', 'activo'),
        supabase.from('warehouses').select('*').eq('estado', 'activo'),
        fetchAllPages(supabase.from('products').select('id, nombre_producto, codigo_referencia, precio, categoria').neq('estado', 'inactivo')),
        supabase.from('colors').select('*'),
        supabase.from('sizes').select('*').order('orden_visual', { ascending: true })
      ]);

      setStores(stRes.data || []);
      setWarehouses(whRes.data || []);
      setProducts(prRes || []);
      setColors(colRes.data || []);
      setSizes(szRes.data || []);
    } catch (e) {
      console.error('Error fetching masters:', e);
    } finally {
      setLoading(false);
    }
  };

  // ── DETERMINAR BODEGA Y TIENDA ORIGEN ACTUAL ──
  const originWarehouseId = useMemo(() => {
    if (!currentStore) return null;
    return currentStore.bodega_asociada_id || currentStore.id;
  }, [currentStore]);

  const originStoreId = useMemo(() => {
    return currentStore?.id || null;
  }, [currentStore]);

  // ── CARGAR EXISTENCIAS DISPONIBLES EN ORIGEN PARA BÚSQUEDA MANUAL ──
  const fetchOriginStock = async () => {
    if (!originWarehouseId && !originStoreId) return;
    try {
      let query = supabase.from('finished_goods_stock').select(`
        *,
        products (id, nombre_producto, codigo_referencia, precio),
        colors (id, nombre_color, hex_color),
        sizes (id, codigo_talla)
      `).gt('cantidad_disponible', 0);

      if (originWarehouseId) {
        query = query.eq('warehouse_id', originWarehouseId);
      }
      const stockRows = await fetchAllPages(query);
      setManualAvailableStock(stockRows || []);
    } catch (e) {
      console.error('Error fetching origin stock:', e);
    }
  };

  // ── CARGAR TRASLADOS ENTRANTES (PARA RECIBIR) ──
  const fetchIncomingTransfers = async () => {
    if (!currentStore) return;
    try {
      const destIds = [currentStore.id];
      if (currentStore.bodega_asociada_id) {
        destIds.push(currentStore.bodega_asociada_id);
      }

      const { data, error } = await supabase
        .from('finished_goods_transfers')
        .select(`
          *,
          warehouse_orig:warehouse_orig_id (id, nombre_bodega),
          warehouse_dest:warehouse_dest_id (id, nombre_bodega),
          finished_goods_transfer_items (
            *,
            products (id, nombre_producto, codigo_referencia),
            colors (id, nombre_color, hex_color),
            sizes (id, codigo_talla)
          )
        `)
        .in('warehouse_dest_id', destIds)
        .in('estado', ['Pendiente', 'En Tránsito', 'en_transito', 'pendiente'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIncomingTransfers(data || []);
    } catch (e) {
      console.error('Error fetching incoming transfers:', e);
    }
  };

  // ── CARGAR HISTORIAL DE TRASLADOS ──
  const fetchHistoryTransfers = async () => {
    if (!currentStore) return;
    try {
      const storeIds = [currentStore.id];
      if (currentStore.bodega_asociada_id) {
        storeIds.push(currentStore.bodega_asociada_id);
      }

      const filter = `warehouse_orig_id.in.(${storeIds.join(',')}),warehouse_dest_id.in.(${storeIds.join(',')})`;

      const { data, error } = await supabase
        .from('finished_goods_transfers')
        .select(`
          *,
          warehouse_orig:warehouse_orig_id (id, nombre_bodega),
          warehouse_dest:warehouse_dest_id (id, nombre_bodega),
          finished_goods_transfer_items (
            *,
            products (id, nombre_producto, codigo_referencia),
            colors (id, nombre_color),
            sizes (id, codigo_talla)
          )
        `)
        .or(filter)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setTransferHistory(data || []);
    } catch (e) {
      console.error('Error fetching history:', e);
    }
  };

  useEffect(() => {
    fetchMasters();
  }, []);

  useEffect(() => {
    if (currentStore) {
      fetchOriginStock();
      fetchIncomingTransfers();
      fetchHistoryTransfers();
    }
  }, [currentStore, activeTab]);

  // ─────────────────────────────────────────────────────────────
  // 🚚 1. LÓGICA DE DESPACHO (ORIGEN ➔ TRÁNSITO)
  // ─────────────────────────────────────────────────────────────

  // Escaneo por pistola de código de barras para despacho
  const handleScanDispatchBarcode = async (e: React.FormEvent) => {
    e.preventDefault();
    const barcode = dispatchBarcode.trim();
    if (!barcode) return;

    // Verificar si ya está en la lista de despacho
    const alreadyAdded = dispatchItems.some(it => it.barcodes && it.barcodes.includes(barcode));
    if (alreadyAdded) {
      alert(`⚠️ La prenda con código de barras ${barcode} ya está agregada al despacho actual.`);
      setDispatchBarcode('');
      return;
    }

    try {
      // Buscar prenda en individual_garments
      const { data: garments, error } = await supabase
        .from('individual_garments')
        .select(`
          *,
          sewing_orders (
            id,
            product_id,
            products (id, nombre_producto, codigo_referencia, precio)
          )
        `)
        .eq('barcode', barcode)
        .limit(1);

      if (error) throw error;
      const garment = garments?.[0];

      if (!garment) {
        alert(`❌ No se encontró ninguna prenda registrada con el código de barras "${barcode}".`);
        setDispatchBarcode('');
        return;
      }

      // Validar si pertenece a la tienda / bodega actual
      const isCurrentLocation = 
        (originWarehouseId && garment.warehouse_id === originWarehouseId) ||
        (originStoreId && garment.store_id === originStoreId);

      if (!isCurrentLocation && garment.status !== 'en_transito') {
        const whObj = warehouses.find(w => w.id === garment.warehouse_id);
        const stObj = stores.find(s => s.id === garment.store_id);
        const locName = whObj?.nombre_bodega || stObj?.nombre || 'otra ubicación';
        
        if (!confirm(`⚠️ AVISO DE UBICACIÓN:\n\nLa prenda #${barcode} figura en el sistema en "${locName}" (Estado: ${garment.status || 'Disponible'}).\n\n¿Deseas agregarla a este despacho desde ${currentStore?.nombre || 'esta tienda'}?`)) {
          setDispatchBarcode('');
          return;
        }
      }

      if (garment.status === 'vendido') {
        alert(`❌ La prenda #${barcode} está marcada como VENDIDA y no se puede despachar.`);
        setDispatchBarcode('');
        return;
      }

      // Resolver producto, color y talla
      const productId = garment.sewing_orders?.product_id || garment.product_id || products.find(p => p.codigo_referencia === garment.reference_name || p.nombre_producto === garment.reference_name)?.id;
      const prodObj = products.find(p => p.id === productId);
      const colorObj = colors.find(c => c.nombre_color?.toLowerCase().trim() === (garment.color_name || '').toLowerCase().trim());
      const sizeObj = sizes.find(s => s.codigo_talla?.toLowerCase().trim() === (garment.size_code || '').toLowerCase().trim());

      const newItem = {
        id: `scan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        product_id: productId || null,
        productName: prodObj?.nombre_producto || garment.reference_name || 'Prenda Breiner',
        productRef: prodObj?.codigo_referencia || garment.reference_name || 'REF',
        color_id: colorObj?.id || null,
        colorName: garment.color_name || colorObj?.nombre_color || 'Sin Color',
        size_id: sizeObj?.id || null,
        sizeCode: garment.size_code || sizeObj?.codigo_talla || 'ST',
        cantidad: 1,
        barcodes: [barcode],
        garmentId: garment.id
      };

      // Agregar o agrupar si ya existe la misma SKU
      setDispatchItems(prev => {
        const existingIdx = prev.findIndex(it => 
          it.product_id === newItem.product_id && 
          it.color_id === newItem.color_id && 
          it.size_id === newItem.size_id
        );

        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx].cantidad += 1;
          updated[existingIdx].barcodes = [...(updated[existingIdx].barcodes || []), barcode];
          return updated;
        }
        return [...prev, newItem];
      });

      setDispatchBarcode('');
      if (dispatchInputRef.current) dispatchInputRef.current.focus();
    } catch (err: any) {
      console.error('Error scanning barcode:', err);
      alert('Error al escanear: ' + err.message);
    }
  };

  // Agregar ítem manual desde el catálogo de existencias
  const handleAddManualItem = (stockItem: any, qty: number) => {
    if (!stockItem || qty <= 0) return;

    const available = Number(stockItem.cantidad_disponible || 0);
    if (qty > available) {
      alert(`⚠️ Solo hay ${available} unidades disponibles en existencias para esta referencia.`);
      return;
    }

    const newItem = {
      id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      product_id: stockItem.product_id,
      productName: stockItem.products?.nombre_producto || 'Prenda Breiner',
      productRef: stockItem.products?.codigo_referencia || 'REF',
      color_id: stockItem.color_id || null,
      colorName: stockItem.colors?.nombre_color || 'Estándar',
      size_id: stockItem.size_id || null,
      sizeCode: stockItem.sizes?.codigo_talla || 'ST',
      cantidad: qty,
      barcodes: []
    };

    setDispatchItems(prev => {
      const existingIdx = prev.findIndex(it => 
        it.product_id === newItem.product_id && 
        it.color_id === newItem.color_id && 
        it.size_id === newItem.size_id
      );

      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx].cantidad += qty;
        return updated;
      }
      return [...prev, newItem];
    });

    setShowManualModal(false);
    setSelectedStockForAdd(null);
    setManualQtyToAdd(1);
  };

  // Quitar ítem o reducir cantidad del despacho
  const handleRemoveDispatchItem = (index: number) => {
    setDispatchItems(prev => prev.filter((_, i) => i !== index));
  };

  // Total de prendas en el carrito de despacho
  const totalDispatchGarments = useMemo(() => {
    return dispatchItems.reduce((acc, it) => acc + (Number(it.cantidad) || 0), 0);
  }, [dispatchItems]);

  // Ejecutar confirmación de despacho (Descontar de Origen, Pasar a Tránsito, Generar TR)
  const handleConfirmDispatch = async () => {
    if (!destLocationId) {
      alert('⚠️ Por favor selecciona la tienda o bodega de destino.');
      return;
    }

    if (dispatchItems.length === 0) {
      alert('⚠️ Debes agregar al menos una prenda o código de barras para despachar.');
      return;
    }

    // Resolver ID de bodega de destino
    let resolvedDestWhId = destLocationId;
    if (destLocationType === 'store') {
      const st = stores.find(s => s.id === destLocationId);
      resolvedDestWhId = st?.bodega_asociada_id || st?.id || destLocationId;
    }

    // Validar que origen != destino
    if (resolvedDestWhId === originWarehouseId) {
      alert('⚠️ La ubicación de origen y destino no pueden ser la misma.');
      return;
    }

    const destName = destLocationType === 'store' 
      ? (stores.find(s => s.id === destLocationId)?.nombre || 'Tienda Destino')
      : (warehouses.find(w => w.id === destLocationId)?.nombre_bodega || 'Bodega Destino');

    if (!confirm(`🚚 CONFIRMAR DESPACHO INTER-TIENDAS:\n\n• Origen: ${currentStore?.nombre || 'Tienda Actual'}\n• Destino: ${destName}\n• Total Prendas: ${totalDispatchGarments} uds\n\nLas unidades saldrán de disponibilidad y quedarán EN TRÁNSITO hasta que el destino las reciba físicamente.`)) {
      return;
    }

    setIsProcessingDispatch(true);
    try {
      // 1. Obtener consecutivo siguiente
      const { data: lastTx } = await supabase
        .from('finished_goods_transfers')
        .select('consecutive')
        .order('consecutive', { ascending: false })
        .limit(1);

      const nextConsecutive = ((lastTx?.[0]?.consecutive) || 0) + 1;

      // 2. Crear registro de traslado (Estado: Pendiente / En Tránsito)
      const { data: newTransfer, error: txError } = await supabase
        .from('finished_goods_transfers')
        .insert({
          consecutive: nextConsecutive,
          warehouse_orig_id: originWarehouseId,
          warehouse_dest_id: resolvedDestWhId,
          estado: 'Pendiente',
          usuario: profile?.full_name || user?.email || 'Vendedor POS',
          observaciones: `Despacho POS desde ${currentStore?.nombre || 'Tienda'}. ${dispatchNotes ? `Nota: ${dispatchNotes}` : ''}`
        })
        .select()
        .single();

      if (txError) throw txError;

      // 3. Insertar items del traslado
      const transferItemsPayload = dispatchItems.map(it => ({
        transfer_id: newTransfer.id,
        product_id: it.product_id,
        color_id: it.color_id || null,
        size_id: it.size_id || null,
        cantidad: it.cantidad,
        barcodes: it.barcodes || []
      }));

      const { error: itemsErr } = await supabase
        .from('finished_goods_transfer_items')
        .insert(transferItemsPayload);

      if (itemsErr) throw itemsErr;

      // 4. Actualizar individual_garments: Poner en status = 'en_transito'
      const allBarcodesToTransit: string[] = [];
      dispatchItems.forEach(it => {
        if (it.barcodes && it.barcodes.length > 0) {
          allBarcodesToTransit.push(...it.barcodes);
        }
      });

      if (allBarcodesToTransit.length > 0) {
        await supabase
          .from('individual_garments')
          .update({ status: 'en_transito' })
          .in('barcode', allBarcodesToTransit);
      }

      // 5. Descontar existencias del ORIGEN (finished_goods_stock y store_inventory)
      for (const it of dispatchItems) {
        const qty = Number(it.cantidad || 0);

        // Descontar de finished_goods_stock de origen
        if (originWarehouseId && it.product_id) {
          let origQuery = supabase
            .from('finished_goods_stock')
            .select('*')
            .eq('warehouse_id', originWarehouseId)
            .eq('product_id', it.product_id);

          if (it.size_id) origQuery = origQuery.eq('size_id', it.size_id);
          if (it.color_id) origQuery = origQuery.eq('color_id', it.color_id);

          const { data: origStock } = await origQuery.limit(1);
          if (origStock?.[0]) {
            const currentQty = Number(origStock[0].cantidad_disponible || 0);
            await supabase
              .from('finished_goods_stock')
              .update({ cantidad_disponible: Math.max(0, currentQty - qty) })
              .eq('id', origStock[0].id);
          }
        }

        // Descontar de store_inventory del POS de origen
        if (originStoreId && it.product_id) {
          let stQuery = supabase
            .from('store_inventory')
            .select('*')
            .eq('store_id', originStoreId)
            .eq('product_id', it.product_id);

          if (it.size_id) stQuery = stQuery.eq('size_id', it.size_id);
          if (it.color_id) stQuery = stQuery.eq('color_id', it.color_id);

          const { data: storeStock } = await stQuery.limit(1);
          if (storeStock?.[0]) {
            const currentQty = Number(storeStock[0].cantidad_disponible || 0);
            await supabase
              .from('store_inventory')
              .update({ cantidad_disponible: Math.max(0, currentQty - qty) })
              .eq('id', storeStock[0].id);
          }
        }

        // Registrar Kardex de Salida
        if (it.product_id) {
          await supabase.from('finished_goods_kardex').insert({
            product_id: it.product_id,
            color_id: it.color_id || null,
            size_id: it.size_id || null,
            tipo_movimiento: 'Transferencia (Salida)',
            cantidad: qty,
            saldo_anterior: 0,
            saldo_nuevo: 0,
            warehouse_orig_id: originWarehouseId,
            warehouse_dest_id: resolvedDestWhId,
            documento_origen: `TR-${String(nextConsecutive).padStart(4, '0')}`,
            usuario: profile?.full_name || user?.email || 'Vendedor POS',
            observaciones: `Despacho desde ${currentStore?.nombre || 'Tienda'}`
          });
        }
      }

      // Preparar datos de comprobante
      const voucherData = {
        ...newTransfer,
        consecutiveFormatted: `TR-${String(nextConsecutive).padStart(4, '0')}`,
        originName: currentStore?.nombre || 'Tienda Origen',
        destName,
        items: dispatchItems,
        totalGarments: totalDispatchGarments,
        date: new Date().toLocaleString('es-CO')
      };

      setLastDispatchedTransfer(voucherData);
      setShowDispatchVoucher(true);

      // Limpiar formulario de despacho
      setDispatchItems([]);
      setDispatchNotes('');
      setDestLocationId('');

      // Refrescar inventario
      fetchOriginStock();
      fetchHistoryTransfers();
      if (onRefreshInventory) onRefreshInventory();
    } catch (err: any) {
      console.error('Error in dispatch:', err);
      alert('❌ Error al procesar despacho: ' + err.message);
    } finally {
      setIsProcessingDispatch(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 📦 2. LÓGICA DE RECEPCIÓN (TRÁNSITO ➔ DESTINO)
  // ─────────────────────────────────────────────────────────────

  // Seleccionar un traslado entrante para iniciar recepción
  const handleSelectReceiveTransfer = (tx: any) => {
    setSelectedReceiveTransfer(tx);
    setScannedReceiveBarcodes(new Set());
    setScannedItemsCountMap({});
    setReceivingNotes('');
    setReceiveBarcodeInput('');
    setTimeout(() => {
      if (receiveInputRef.current) receiveInputRef.current.focus();
    }, 150);
  };

  // Pistoleo de códigos de barras en recepción
  const handleScanReceiveBarcode = (e: React.FormEvent) => {
    e.preventDefault();
    const barcode = receiveBarcodeInput.trim();
    if (!barcode || !selectedReceiveTransfer) return;

    if (scannedReceiveBarcodes.has(barcode)) {
      alert(`⚠️ El código de barras ${barcode} ya fue escaneado en esta recepción.`);
      setReceiveBarcodeInput('');
      return;
    }

    // Buscar si el código de barras pertenece a algún ítem del traslado
    let matchedItem: any = null;
    for (const it of (selectedReceiveTransfer.finished_goods_transfer_items || [])) {
      if (it.barcodes && it.barcodes.includes(barcode)) {
        matchedItem = it;
        break;
      }
    }

    // Si no tiene barcodes específicos grabados, permitir asociarlo por SKU si existe en individual_garments
    if (!matchedItem) {
      // Alerta de que no pertenece a este traslado
      const confirmAdd = confirm(`⚠️ El código ${barcode} no está en la lista de despacho de este traslado TR-${String(selectedReceiveTransfer.consecutive).padStart(4, '0')}.\n\n¿Deseas agregarlo de todas formas como prenda recibida?`);
      if (!confirmAdd) {
        setReceiveBarcodeInput('');
        return;
      }
    }

    // Registrar como escaneado
    setScannedReceiveBarcodes(prev => new Set([...Array.from(prev), barcode]));

    if (matchedItem) {
      setScannedItemsCountMap(prev => ({
        ...prev,
        [matchedItem.id]: (prev[matchedItem.id] || 0) + 1
      }));
    }

    setReceiveBarcodeInput('');
    if (receiveInputRef.current) receiveInputRef.current.focus();
  };

  // Toggle check de aceptación de un ítem completo
  const handleToggleItemAcceptance = (itemId: string, forceCheck?: boolean) => {
    if (!selectedReceiveTransfer) return;
    const item = (selectedReceiveTransfer.finished_goods_transfer_items || []).find((it: any) => it.id === itemId);
    if (!item) return;

    const expected = Number(item.cantidad || 0);
    const currentCount = scannedItemsCountMap[itemId] || 0;
    const isCurrentlyComplete = currentCount >= expected;
    const shouldAccept = forceCheck !== undefined ? forceCheck : !isCurrentlyComplete;

    setScannedItemsCountMap(prev => ({
      ...prev,
      [itemId]: shouldAccept ? expected : 0
    }));

    setScannedReceiveBarcodes(prev => {
      const updated = new Set(prev);
      if (item.barcodes && Array.isArray(item.barcodes)) {
        item.barcodes.forEach((bc: string) => {
          if (shouldAccept) {
            updated.add(bc);
          } else {
            updated.delete(bc);
          }
        });
      }
      return updated;
    });
  };

  // Toggle check de un código de barras individual
  const handleToggleBarcodeAcceptance = (itemId: string, barcode: string) => {
    if (!selectedReceiveTransfer) return;
    const isCurrentlyScanned = scannedReceiveBarcodes.has(barcode);
    const newScanned = new Set(scannedReceiveBarcodes);

    if (isCurrentlyScanned) {
      newScanned.delete(barcode);
      setScannedItemsCountMap(prev => ({
        ...prev,
        [itemId]: Math.max(0, (prev[itemId] || 1) - 1)
      }));
    } else {
      newScanned.add(barcode);
      setScannedItemsCountMap(prev => ({
        ...prev,
        [itemId]: (prev[itemId] || 0) + 1
      }));
    }
    setScannedReceiveBarcodes(newScanned);
  };

  // Aceptar todas las prendas y códigos del traslado con 1 solo check
  const handleAcceptAllTransferItems = () => {
    if (!selectedReceiveTransfer) return;
    const newMap: Record<string, number> = {};
    const newBarcodes = new Set<string>();

    (selectedReceiveTransfer.finished_goods_transfer_items || []).forEach((it: any) => {
      const qty = Number(it.cantidad || 0);
      newMap[it.id] = qty;
      if (it.barcodes && Array.isArray(it.barcodes)) {
        it.barcodes.forEach((bc: string) => newBarcodes.add(bc));
      }
    });

    setScannedItemsCountMap(newMap);
    setScannedReceiveBarcodes(newBarcodes);
  };

  // Totales esperados vs escaneados en recepción
  const totalExpectedInReceive = useMemo(() => {
    if (!selectedReceiveTransfer) return 0;
    return (selectedReceiveTransfer.finished_goods_transfer_items || []).reduce(
      (sum: number, it: any) => sum + Number(it.cantidad || 0), 0
    );
  }, [selectedReceiveTransfer]);

  const totalScannedInReceive = useMemo(() => {
    if (!selectedReceiveTransfer) return 0;
    // Si hay códigos específicos escaneados, usar el conteo de barcodes o la suma de items aceptados
    const itemsSum = Object.values(scannedItemsCountMap).reduce((s, c) => s + (Number(c) || 0), 0);
    return Math.max(scannedReceiveBarcodes.size, itemsSum);
  }, [scannedReceiveBarcodes, scannedItemsCountMap, selectedReceiveTransfer]);

  const receiveDifference = totalExpectedInReceive - totalScannedInReceive;

  // Confirmar recepción real en destino
  const handleConfirmReceipt = async () => {
    if (!selectedReceiveTransfer) return;

    // Validación de doble recepción
    if (selectedReceiveTransfer.estado === 'Recibida') {
      alert('⚠️ Este traslado ya fue recibido previamente.');
      return;
    }

    if (totalScannedInReceive === 0) {
      if (!confirm(`⚠️ No has escaneado ninguna prenda con código de barras.\n\n¿Deseas marcar todas las ${totalExpectedInReceive} prendas como recibidas automáticamente?`)) {
        return;
      }
    }

    const hasDiscrepancy = totalScannedInReceive > 0 && receiveDifference !== 0;
    if (hasDiscrepancy) {
      if (!confirm(`⚠️ ALERTA DE DIFERENCIA:\n\n• Despachadas: ${totalExpectedInReceive} prendas\n• Escaneadas realmente: ${totalScannedInReceive} prendas\n• Diferencia: ${receiveDifference} prendas pendientes de conciliación\n\n¿Confirmas ingresar ÚNICAMENTE las ${totalScannedInReceive} prendas recibidas a tu inventario?`)) {
        return;
      }
    }

    setIsProcessingReceipt(true);
    try {
      const destWhId = originWarehouseId || selectedReceiveTransfer.warehouse_dest_id;
      const destStoreId = originStoreId;

      // 1. Actualizar estado del traslado
      const statusFinal = (totalScannedInReceive >= totalExpectedInReceive || totalScannedInReceive === 0) ? 'Recibida' : 'Parcialmente Recibida';
      const obsFinal = `${selectedReceiveTransfer.observaciones || ''} | Recepción POS por ${profile?.full_name || user?.email || 'Usuario'}: ${totalScannedInReceive > 0 ? `${totalScannedInReceive} de ${totalExpectedInReceive} recibidas` : 'Recepción completa automática'}. ${receivingNotes ? `Novedades: ${receivingNotes}` : ''}`;

      await supabase
        .from('finished_goods_transfers')
        .update({
          estado: statusFinal,
          observaciones: obsFinal,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedReceiveTransfer.id);

      // 2. Ingresar existencias recibidas al stock del destino (finished_goods_stock y store_inventory)
      for (const it of (selectedReceiveTransfer.finished_goods_transfer_items || [])) {
        const qtyToIngest = totalScannedInReceive > 0
          ? (scannedItemsCountMap[it.id] || 0)
          : Number(it.cantidad || 0);

        if (qtyToIngest <= 0) continue;

        // Incrementar en finished_goods_stock
        if (destWhId && it.product_id) {
          let destQuery = supabase
            .from('finished_goods_stock')
            .select('*')
            .eq('warehouse_id', destWhId)
            .eq('product_id', it.product_id);

          if (it.size_id) destQuery = destQuery.eq('size_id', it.size_id);
          if (it.color_id) destQuery = destQuery.eq('color_id', it.color_id);

          const { data: destStock } = await destQuery.limit(1);
          const currentDestQty = destStock?.[0] ? Number(destStock[0].cantidad_disponible || 0) : 0;

          if (destStock?.[0]) {
            await supabase
              .from('finished_goods_stock')
              .update({ cantidad_disponible: currentDestQty + qtyToIngest })
              .eq('id', destStock[0].id);
          } else {
            await supabase
              .from('finished_goods_stock')
              .insert({
                warehouse_id: destWhId,
                product_id: it.product_id,
                color_id: it.color_id || null,
                size_id: it.size_id || sizes[0]?.id || '',
                cantidad_disponible: qtyToIngest
              });
          }
        }

        // Incrementar en store_inventory del POS destino
        if (destStoreId && it.product_id) {
          let stQuery = supabase
            .from('store_inventory')
            .select('*')
            .eq('store_id', destStoreId)
            .eq('product_id', it.product_id);

          if (it.size_id) stQuery = stQuery.eq('size_id', it.size_id);
          if (it.color_id) stQuery = stQuery.eq('color_id', it.color_id);

          const { data: storeStock } = await stQuery.limit(1);
          const currentStoreQty = storeStock?.[0] ? Number(storeStock[0].cantidad_disponible || 0) : 0;

          if (storeStock?.[0]) {
            await supabase
              .from('store_inventory')
              .update({ cantidad_disponible: currentStoreQty + qtyToIngest })
              .eq('id', storeStock[0].id);
          } else {
            await supabase
              .from('store_inventory')
              .insert({
                store_id: destStoreId,
                product_id: it.product_id,
                color_id: it.color_id || null,
                size_id: it.size_id || sizes[0]?.id || '',
                cantidad_disponible: qtyToIngest
              });
          }
        }

        // Kardex Entrada en Destino
        if (it.product_id) {
          await supabase.from('finished_goods_kardex').insert({
            product_id: it.product_id,
            color_id: it.color_id || null,
            size_id: it.size_id || null,
            tipo_movimiento: 'Transferencia (Entrada)',
            cantidad: qtyToIngest,
            saldo_anterior: 0,
            saldo_nuevo: 0,
            warehouse_orig_id: selectedReceiveTransfer.warehouse_orig_id,
            warehouse_dest_id: destWhId,
            documento_origen: `TR-${String(selectedReceiveTransfer.consecutive).padStart(4, '0')}`,
            usuario: profile?.full_name || user?.email || 'Vendedor POS',
            observaciones: `Recepción confirmada en ${currentStore?.nombre || 'Tienda'}`
          });
        }
      }

      // 3. Actualizar individual_garments: Poner en status = 'Aprobada' y asignar a la nueva bodega/tienda
      const barcodesToApprove: string[] = [];
      if (scannedReceiveBarcodes.size > 0) {
        barcodesToApprove.push(...Array.from(scannedReceiveBarcodes));
      } else {
        // Si fue automático, tomar los barcodes de los items
        (selectedReceiveTransfer.finished_goods_transfer_items || []).forEach((it: any) => {
          if (it.barcodes && Array.isArray(it.barcodes)) {
            barcodesToApprove.push(...it.barcodes);
          }
        });
      }

      if (barcodesToApprove.length > 0 && destWhId) {
        await supabase
          .from('individual_garments')
          .update({
            warehouse_id: destWhId,
            store_id: destStoreId || null,
            status: 'Aprobada'
          })
          .in('barcode', barcodesToApprove);
      }

      const receiptVoucher = {
        consecutiveFormatted: `TR-${String(selectedReceiveTransfer.consecutive).padStart(4, '0')}`,
        originName: selectedReceiveTransfer.warehouse_orig?.nombre_bodega || 'Origen',
        destName: currentStore?.nombre || 'Tienda Destino',
        expectedQty: totalExpectedInReceive,
        receivedQty: totalScannedInReceive > 0 ? totalScannedInReceive : totalExpectedInReceive,
        diff: hasDiscrepancy ? receiveDifference : 0,
        notes: receivingNotes,
        receiver: profile?.full_name || user?.email || 'Vendedor POS',
        date: new Date().toLocaleString('es-CO')
      };

      setLastReceivedTransfer(receiptVoucher);
      setShowReceiptVoucher(true);
      setSelectedReceiveTransfer(null);
      setScannedReceiveBarcodes(new Set());

      // Recargar listados
      fetchIncomingTransfers();
      fetchOriginStock();
      fetchHistoryTransfers();
      if (onRefreshInventory) onRefreshInventory();
    } catch (err: any) {
      console.error('Error confirming receipt:', err);
      alert('❌ Error al confirmar recepción: ' + err.message);
    } finally {
      setIsProcessingReceipt(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER PRINCIPAL DEL MÓDULO
  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%', overflowY: 'auto', padding: '1rem 1.5rem', backgroundColor: '#f8fafc' }} className="pos-scrollbar">
      
      {/* ── 1. BANNER VISUAL OBLIGATORIO: DIAGRAMA DE FLUJO EN 3 ETAPAS ── */}
      <div style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #fdf2f4 100%)',
        border: '1.5px solid #fecdd3',
        borderRadius: '16px',
        padding: '1.25rem 1.5rem',
        boxShadow: '0 4px 14px rgba(128,8,46,0.06)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <span style={{ fontSize: '0.68rem', fontWeight: '900', color: primaryColor, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              LOGÍSTICA INTER-TIENDAS Y BODEGAS BREINER
            </span>
            <h2 style={{ margin: '0.15rem 0 0', fontSize: '1.35rem', fontWeight: '950', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <ArrowLeftRight size={22} style={{ color: primaryColor }} />
              Control de Traslados y Despachos 1-a-1
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              backgroundColor: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0',
              padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '850',
              display: 'flex', alignItems: 'center', gap: '0.4rem'
            }}>
              <Store size={14} /> Tienda Actual: <strong>{currentStore?.nombre || 'Mi Tienda'}</strong>
            </span>
          </div>
        </div>

        {/* Diagrama Visual de 3 Nodos: ORIGEN ➔ EN TRÁNSITO ➔ DESTINO */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
          
          {/* Nodo 1: TIENDA ORIGEN */}
          <div style={{
            backgroundColor: 'white', borderRadius: '14px', padding: '1rem', border: '1.5px solid #cbd5e1',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', gap: '0.75rem'
          }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Building2 size={22} />
            </div>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>1. Origen</span>
              <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: '900', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentStore?.nombre || 'Tienda Actual'}
              </h4>
              <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: '800' }}>
                {manualAvailableStock.reduce((a, b) => a + (Number(b.cantidad_disponible) || 0), 0)} uds disp.
              </span>
            </div>
          </div>

          {/* Flecha Despacho */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
            <span style={{ fontSize: '0.62rem', fontWeight: '900', color: primaryColor, textTransform: 'uppercase' }}>🚚 Despacho</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#fff1f2', color: primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowRight size={18} />
            </div>
          </div>

          {/* Nodo 2: EN TRÁNSITO */}
          <div style={{
            backgroundColor: '#fffbeb', borderRadius: '14px', padding: '1rem', border: '1.5px solid #fde68a',
            boxShadow: '0 2px 6px rgba(245,158,11,0.08)', display: 'flex', alignItems: 'center', gap: '0.75rem'
          }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Truck size={22} />
            </div>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#b45309', textTransform: 'uppercase' }}>2. En Tránsito</span>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '950', color: '#92400e' }}>
                {incomingTransfers.length} Traslados
              </h4>
              <span style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: '800' }}>
                Mercancía en viaje
              </span>
            </div>
          </div>

          {/* Flecha Recepción */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
            <span style={{ fontSize: '0.62rem', fontWeight: '900', color: '#059669', textTransform: 'uppercase' }}>📦 Recepción</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowRight size={18} />
            </div>
          </div>

          {/* Nodo 3: TIENDA / BODEGA DESTINO */}
          <div style={{
            backgroundColor: 'white', borderRadius: '14px', padding: '1rem', border: '1.5px solid #cbd5e1',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', gap: '0.75rem'
          }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CheckCircle2 size={22} />
            </div>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>3. Destino</span>
              <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: '900', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selectedReceiveTransfer ? (selectedReceiveTransfer.warehouse_dest?.nombre_bodega || 'Destino') : 'Validación 1-a-1'}
              </h4>
              <span style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: '800' }}>
                Ingreso a Stock
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* ── 2. NAVEGACIÓN DE PESTAÑAS (DESPACHAR / RECIBIR / HISTORIAL) ── */}
      <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: '#f1f5f9', padding: '0.4rem', borderRadius: '14px', border: '1px solid #cbd5e1' }}>
        <button
          onClick={() => setActiveTab('dispatch')}
          style={{
            flex: 1, padding: '0.7rem 1rem', borderRadius: '10px', border: 'none', cursor: 'pointer',
            backgroundColor: activeTab === 'dispatch' ? primaryColor : 'transparent',
            color: activeTab === 'dispatch' ? 'white' : '#475569',
            fontWeight: '900', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            boxShadow: activeTab === 'dispatch' ? '0 4px 12px rgba(128,8,46,0.25)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <Truck size={18} />
          <span>🚚 1. Despachar Prendas (Enviar)</span>
          {dispatchItems.length > 0 && (
            <span style={{ backgroundColor: '#ffffff', color: primaryColor, padding: '0.15rem 0.5rem', borderRadius: '10px', fontSize: '0.72rem', fontWeight: '950' }}>
              {totalDispatchGarments}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('receive')}
          style={{
            flex: 1, padding: '0.7rem 1rem', borderRadius: '10px', border: 'none', cursor: 'pointer',
            backgroundColor: activeTab === 'receive' ? '#059669' : 'transparent',
            color: activeTab === 'receive' ? 'white' : '#475569',
            fontWeight: '900', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            boxShadow: activeTab === 'receive' ? '0 4px 12px rgba(5,150,105,0.25)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <Package size={18} />
          <span>📦 2. Recibir Traslado (Validar Llegada)</span>
          {incomingTransfers.length > 0 && (
            <span style={{ backgroundColor: '#fef08a', color: '#854d0e', padding: '0.15rem 0.5rem', borderRadius: '10px', fontSize: '0.72rem', fontWeight: '950' }}>
              {incomingTransfers.length} pend.
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('history')}
          style={{
            flex: 0.8, padding: '0.7rem 1rem', borderRadius: '10px', border: 'none', cursor: 'pointer',
            backgroundColor: activeTab === 'history' ? '#334155' : 'transparent',
            color: activeTab === 'history' ? 'white' : '#475569',
            fontWeight: '900', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            boxShadow: activeTab === 'history' ? '0 4px 12px rgba(51,65,85,0.25)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <FileText size={18} />
          <span>📜 Historial y Comprobantes</span>
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── TAB 1: 🚚 DESPACHAR PRENDAS ── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'dispatch' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.25rem', alignItems: 'start' }}>
          
          {/* Columna Izquierda: Escáner y Lista de Prendas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Tarjeta de Destino */}
            <div style={{ backgroundColor: 'white', borderRadius: '14px', padding: '1.25rem', border: '1.5px solid #cbd5e1', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: '950', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <MapPin size={18} style={{ color: primaryColor }} />
                Paso 1: Seleccionar Destino del Despacho
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                    Tipo de Destino
                  </label>
                  <select
                    value={destLocationType}
                    onChange={e => {
                      setDestLocationType(e.target.value as any);
                      setDestLocationId('');
                    }}
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '800' }}
                  >
                    <option value="store">🏬 Tienda / Punto POS</option>
                    <option value="warehouse">🧼 Bodega Lavandería / Puntos</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                    {destLocationType === 'store' ? 'Selecciona la Tienda Destino' : 'Selecciona la Bodega Destino (Lavandería / Puntos)'}
                  </label>
                  <select
                    value={destLocationId}
                    onChange={e => setDestLocationId(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '850', color: '#0f172a', backgroundColor: '#f8fafc' }}
                  >
                    <option value="">-- Seleccionar ubicación destino autorizada --</option>
                    {destLocationType === 'store'
                      ? stores.filter(s => s.id !== currentStore?.id).map(s => (
                          <option key={s.id} value={s.id}>🏬 {s.nombre} ({s.ciudad || 'Colombia'})</option>
                        ))
                      : warehouses
                          .filter(w => {
                            if (w.id === originWarehouseId) return false;
                            const name = (w.nombre_bodega || w.name || '').toLowerCase();
                            const type = (w.tipo || '').toLowerCase();
                            const isLavanderia = name.includes('lavanderia') || type.includes('lavanderia');
                            const isPuntoOrStore = type.includes('local') || type.includes('punto') || type.includes('tienda') || stores.some(s => s.bodega_asociada_id === w.id);
                            return isLavanderia || isPuntoOrStore;
                          })
                          .map(w => (
                            <option key={w.id} value={w.id}>
                              {w.nombre_bodega?.toLowerCase().includes('lavanderia') ? '🧼' : '🏢'} {w.nombre_bodega} ({w.tipo || 'Punto / Lavandería'})
                            </option>
                          ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Tarjeta de Pistoleo / Escáner de Códigos de Barras */}
            <div style={{ backgroundColor: 'white', borderRadius: '14px', padding: '1.25rem', border: '1.5px solid #cbd5e1', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '950', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Barcode size={18} style={{ color: primaryColor }} />
                  Paso 2: Pistolear Código de Barras de la Prenda
                </h3>
                <button
                  type="button"
                  onClick={() => setShowManualModal(true)}
                  style={{
                    padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1',
                    backgroundColor: '#f8fafc', fontSize: '0.75rem', fontWeight: '800', color: primaryColor,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem'
                  }}
                >
                  <Search size={13} /> Catálogo Manual
                </button>
              </div>

              <form onSubmit={handleScanDispatchBarcode} style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Barcode size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: primaryColor }} />
                  <input
                    ref={dispatchInputRef}
                    type="text"
                    placeholder="Pistolea el código de barras o escribe el serial (ej: 0081970935)..."
                    value={dispatchBarcode}
                    onChange={e => setDispatchBarcode(e.target.value)}
                    style={{
                      width: '100%', padding: '0.8rem 1rem 0.8rem 2.75rem', borderRadius: '10px',
                      border: '2px solid #80082E', fontSize: '0.95rem', fontWeight: '800', outline: 'none',
                      backgroundColor: '#fffdfd'
                    }}
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={!dispatchBarcode.trim()}
                  style={{
                    padding: '0 1.5rem', borderRadius: '10px', border: 'none',
                    backgroundColor: primaryColor, color: 'white', fontWeight: '900', fontSize: '0.85rem',
                    cursor: dispatchBarcode.trim() ? 'pointer' : 'not-allowed', opacity: dispatchBarcode.trim() ? 1 : 0.6
                  }}
                >
                  + Agregar
                </button>
              </form>
            </div>

            {/* Tabla de Prendas Agregadas al Despacho */}
            <div style={{ backgroundColor: 'white', borderRadius: '14px', border: '1.5px solid #cbd5e1', overflow: 'hidden' }}>
              <div style={{ padding: '0.85rem 1.25rem', backgroundColor: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '900', color: '#0f172a' }}>
                  Prendas a Despachar ({dispatchItems.length} ítems / {totalDispatchGarments} uds)
                </h4>
                {dispatchItems.length > 0 && (
                  <button
                    onClick={() => setDispatchItems([])}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.72rem', fontWeight: '800', cursor: 'pointer' }}
                  >
                    Vaciar Lista
                  </button>
                )}
              </div>

              {dispatchItems.length === 0 ? (
                <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#94a3b8' }}>
                  <Barcode size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
                  <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: '750' }}>No has agregado prendas al despacho todavía.</p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem' }}>Pistolea los códigos de barras de las prendas que vas a enviar.</p>
                </div>
              ) : (
                <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left', borderBottom: '1px solid #cbd5e1', fontSize: '0.7rem', textTransform: 'uppercase', color: '#475569' }}>
                        <th style={{ padding: '0.65rem 1rem' }}>Referencia / Producto</th>
                        <th style={{ padding: '0.65rem 1rem' }}>Color</th>
                        <th style={{ padding: '0.65rem 1rem', textAlign: 'center' }}>Talla</th>
                        <th style={{ padding: '0.65rem 1rem', textAlign: 'center' }}>Cant.</th>
                        <th style={{ padding: '0.65rem 1rem' }}>Etiquetas / Códigos</th>
                        <th style={{ padding: '0.65rem 1rem', textAlign: 'center' }}>Quitar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dispatchItems.map((it, idx) => (
                        <tr key={it.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: '850', color: '#0f172a' }}>
                            {it.productName}
                            <span style={{ display: 'block', fontSize: '0.68rem', color: primaryColor }}>Ref: {it.productRef}</span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#334155', fontWeight: '750' }}>{it.colorName}</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                            <span style={{ backgroundColor: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: '900', fontSize: '0.75rem' }}>
                              {it.sizeCode}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: '950', fontSize: '0.9rem', color: '#0f172a' }}>
                            {it.cantidad}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {it.barcodes && it.barcodes.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', maxWidth: '200px' }}>
                                {it.barcodes.map((bc: string) => (
                                  <span key={bc} style={{ fontFamily: 'monospace', fontSize: '0.68rem', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: '850' }}>
                                    🏷️ {bc}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic' }}>Lote Global</span>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                            <button
                              onClick={() => handleRemoveDispatchItem(idx)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }}
                            >
                              <Trash2 size={16} />
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

          {/* Columna Derecha: Resumen de Despacho y Autorización */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            <div style={{
              backgroundColor: 'white', borderRadius: '16px', padding: '1.5rem', border: '1.5px solid #cbd5e1',
              boxShadow: '0 4px 16px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '1.25rem'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '950', color: '#0f172a', borderBottom: '1.5px solid #e2e8f0', paddingBottom: '0.75rem' }}>
                Resumen del Despacho
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b', fontWeight: '700' }}>Origen:</span>
                  <strong style={{ color: '#0f172a' }}>{currentStore?.nombre || 'Tienda Origen'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b', fontWeight: '700' }}>Destino Seleccionado:</span>
                  <strong style={{ color: destLocationId ? primaryColor : '#94a3b8' }}>
                    {destLocationId 
                      ? (destLocationType === 'store' ? stores.find(s => s.id === destLocationId)?.nombre : warehouses.find(w => w.id === destLocationId)?.nombre_bodega)
                      : 'Sin seleccionar'}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b', fontWeight: '700' }}>Despachado por:</span>
                  <strong style={{ color: '#0f172a' }}>{profile?.full_name || user?.email || 'Vendedor POS'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '0.65rem' }}>
                  <span style={{ fontSize: '1rem', fontWeight: '900', color: '#0f172a' }}>Total Prendas a Enviar:</span>
                  <span style={{ fontSize: '1.3rem', fontWeight: '950', color: primaryColor }}>{totalDispatchGarments} uds</span>
                </div>
              </div>

              {/* Observaciones Input */}
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                  Observaciones / Motivo de Envío
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej: Reposición de fin de semana, prendas solicitadas por cliente..."
                  value={dispatchNotes}
                  onChange={e => setDispatchNotes(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.8rem', resize: 'none' }}
                />
              </div>

              {/* Botón de Confirmación */}
              <button
                type="button"
                onClick={handleConfirmDispatch}
                disabled={isProcessingDispatch || dispatchItems.length === 0 || !destLocationId}
                style={{
                  width: '100%', padding: '0.9rem', borderRadius: '12px', border: 'none',
                  backgroundColor: (dispatchItems.length > 0 && destLocationId) ? primaryColor : '#cbd5e1',
                  color: 'white', fontWeight: '950', fontSize: '0.95rem', cursor: (dispatchItems.length > 0 && destLocationId) ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  boxShadow: (dispatchItems.length > 0 && destLocationId) ? '0 6px 18px rgba(128,8,46,0.35)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                {isProcessingDispatch ? (
                  <RefreshCw size={18} className="animate-spin" />
                ) : (
                  <>
                    <Truck size={20} /> Confirmar y Despachar ({totalDispatchGarments} uds)
                  </>
                )}
              </button>

              <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '10px', fontSize: '0.72rem', color: '#64748b', border: '1px solid #e2e8f0' }}>
                ℹ️ <strong>Regla Crítica:</strong> Al confirmar, las prendas saldrán inmediatamente de tu inventario disponible y quedarán <strong>EN TRÁNSITO</strong> con número de traslado único. No se sumarán al destino hasta que sean recibidas físicamente.
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── TAB 2: 📦 RECIBIR TRASLADO ── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'receive' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.25rem', alignItems: 'start' }}>
          
          {/* Lista de Traslados Pendientes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '950', color: '#0f172a' }}>
                Traslados en Camino ({incomingTransfers.length})
              </h3>
              <button
                onClick={fetchIncomingTransfers}
                style={{ padding: '0.25rem 0.5rem', background: 'none', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <RefreshCw size={12} /> Refrescar
              </button>
            </div>

            {incomingTransfers.length === 0 ? (
              <div style={{ padding: '2.5rem 1.5rem', backgroundColor: 'white', borderRadius: '14px', border: '1.5px dashed #cbd5e1', textAlign: 'center', color: '#94a3b8' }}>
                <CheckCircle2 size={32} style={{ margin: '0 auto 0.5rem', color: '#10b981' }} />
                <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: '800', color: '#334155' }}>Al día</p>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem' }}>No hay traslados pendientes de recibir para esta tienda.</p>
              </div>
            ) : (
              incomingTransfers.map(tx => {
                const totalUnits = (tx.finished_goods_transfer_items || []).reduce((s: number, i: any) => s + Number(i.cantidad || 0), 0);
                const isSelected = selectedReceiveTransfer?.id === tx.id;

                return (
                  <div
                    key={tx.id}
                    onClick={() => handleSelectReceiveTransfer(tx)}
                    style={{
                      padding: '1.1rem', borderRadius: '14px', cursor: 'pointer', transition: 'all 0.15s ease',
                      backgroundColor: isSelected ? '#fdf2f4' : 'white',
                      border: isSelected ? `2px solid ${primaryColor}` : '1.5px solid #cbd5e1',
                      boxShadow: isSelected ? '0 4px 14px rgba(128,8,46,0.1)' : '0 1px 3px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span style={{ fontWeight: '950', fontSize: '0.95rem', color: primaryColor }}>
                        TR-{String(tx.consecutive).padStart(4, '0')}
                      </span>
                      <span style={{ backgroundColor: '#fef3c7', color: '#92400e', fontSize: '0.68rem', fontWeight: '900', padding: '0.15rem 0.5rem', borderRadius: '6px' }}>
                        {tx.estado}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <div>
                        <span style={{ color: '#64748b' }}>Origen: </span>
                        <strong>{tx.warehouse_orig?.nombre_bodega || 'Bodega/Tienda'}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Prendas en camino: </span>
                        <strong style={{ color: '#0f172a' }}>{totalUnits} uds</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Enviado por: </span>
                        <span>{tx.usuario || 'Sistema'}</span>
                      </div>
                    </div>

                    <div style={{ marginTop: '0.5rem', paddingTop: '0.4rem', borderTop: '1px dashed #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', color: '#94a3b8' }}>
                      <span>{new Date(tx.created_at).toLocaleString('es-CO')}</span>
                      <span style={{ color: isSelected ? primaryColor : '#64748b', fontWeight: '800' }}>
                        {isSelected ? '▶ Recibiendo ahora' : 'Tocar para recibir'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Área de Validación y Pistoleo de Recepción */}
          {selectedReceiveTransfer ? (
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.5rem', border: '1.5px solid #cbd5e1', boxShadow: '0 4px 16px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1.5px solid #e2e8f0', paddingBottom: '1rem' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', fontWeight: '900', color: '#059669', textTransform: 'uppercase' }}>
                    Validación de Llegada
                  </span>
                  <h3 style={{ margin: '0.1rem 0', fontSize: '1.3rem', fontWeight: '950', color: '#0f172a' }}>
                    Recibiendo TR-{String(selectedReceiveTransfer.consecutive).padStart(4, '0')}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                    Origen: <strong>{selectedReceiveTransfer.warehouse_orig?.nombre_bodega || 'Origen'}</strong> ➔ Destino: <strong>{currentStore?.nombre || 'Mi Tienda'}</strong>
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setSelectedReceiveTransfer(null)}
                    style={{ padding: '0.45rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', fontSize: '0.78rem', fontWeight: '800', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>

              {/* Barra de Progreso y Alerta de Diferencias */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '850', color: '#0f172a' }}>
                    Progreso de Escaneo Físico: {totalScannedInReceive} de {totalExpectedInReceive} prendas
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: '950', color: totalScannedInReceive === totalExpectedInReceive ? '#059669' : '#d97706' }}>
                    {totalExpectedInReceive > 0 ? Math.round((totalScannedInReceive / totalExpectedInReceive) * 100) : 0}%
                  </span>
                </div>

                <div style={{ width: '100%', height: '10px', backgroundColor: '#f1f5f9', borderRadius: '6px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${totalExpectedInReceive > 0 ? Math.min(100, (totalScannedInReceive / totalExpectedInReceive) * 100) : 0}%`,
                      backgroundColor: totalScannedInReceive === totalExpectedInReceive ? '#10b981' : '#f59e0b',
                      transition: 'width 0.2s ease'
                    }}
                  />
                </div>

                {/* ALERTA VISUAL DE DIFERENCIA (OBLIGATORIA) */}
                {totalScannedInReceive > 0 && receiveDifference > 0 && (
                  <div style={{
                    marginTop: '0.75rem', padding: '0.75rem 1rem', borderRadius: '10px',
                    backgroundColor: '#fef2f2', border: '1.5px solid #fca5a5', color: '#991b1b',
                    display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.82rem', fontWeight: '900'
                  }}>
                    <AlertTriangle size={20} style={{ color: '#dc2626', flexShrink: 0 }} />
                    <span>⚠️ DIFERENCIA: {receiveDifference} PRENDA{receiveDifference > 1 ? 'S' : ''} PENDIENTE{receiveDifference > 1 ? 'S' : ''} DE CONCILIACIÓN (FALTANTE).</span>
                  </div>
                )}
              </div>

              {/* Escáner Pistoleo de Entrada */}
              <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1.5px solid #cbd5e1' }}>
                <form onSubmit={handleScanReceiveBarcode} style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <Barcode size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#059669' }} />
                    <input
                      ref={receiveInputRef}
                      type="text"
                      placeholder="Pistolea cada prenda que llegó de este paquete..."
                      value={receiveBarcodeInput}
                      onChange={e => setReceiveBarcodeInput(e.target.value)}
                      style={{
                        width: '100%', padding: '0.8rem 1rem 0.8rem 2.75rem', borderRadius: '10px',
                        border: '2px solid #059669', fontSize: '0.95rem', fontWeight: '800', outline: 'none',
                        backgroundColor: 'white'
                      }}
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!receiveBarcodeInput.trim()}
                    style={{
                      padding: '0 1.5rem', borderRadius: '10px', border: 'none',
                      backgroundColor: '#059669', color: 'white', fontWeight: '900', fontSize: '0.85rem',
                      cursor: receiveBarcodeInput.trim() ? 'pointer' : 'not-allowed', opacity: receiveBarcodeInput.trim() ? 1 : 0.6
                    }}
                  >
                    Validar
                  </button>
                </form>
              </div>

              {/* Banner de Check de Aceptación General con Códigos */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#ecfdf5',
                border: '2px solid #10b981',
                padding: '0.85rem 1.25rem',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(16,185,129,0.15)'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', fontWeight: '900', color: '#065f46', fontSize: '0.9rem' }}>
                  <input
                    type="checkbox"
                    checked={totalScannedInReceive >= totalExpectedInReceive && totalExpectedInReceive > 0}
                    onChange={e => {
                      if (e.target.checked) {
                        handleAcceptAllTransferItems();
                      } else {
                        setScannedItemsCountMap({});
                        setScannedReceiveBarcodes(new Set());
                      }
                    }}
                    style={{ width: '20px', height: '20px', accentColor: '#10b981', cursor: 'pointer' }}
                  />
                  <span>✅ Check de Aceptación General: Aceptar todo el traslado con sus códigos ({totalExpectedInReceive} prendas)</span>
                </label>
                <button
                  type="button"
                  onClick={handleAcceptAllTransferItems}
                  style={{
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.45rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: '850',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(16,185,129,0.3)'
                  }}
                >
                  ✓ Aceptar Todo
                </button>
              </div>

              {/* Tabla de Comparación de Ítems (Enviado vs Recibido) */}
              <div style={{ border: '1.5px solid #cbd5e1', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left', borderBottom: '1.5px solid #cbd5e1', fontSize: '0.7rem', textTransform: 'uppercase', color: '#475569' }}>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center', width: '70px' }}>Aceptar</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Producto / Referencia</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Color</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Talla</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Enviadas</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Recibidas</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedReceiveTransfer.finished_goods_transfer_items || []).map((it: any) => {
                      const expected = Number(it.cantidad || 0);
                      const scanned = scannedItemsCountMap[it.id] || 0;
                      const isComplete = scanned >= expected;

                      return (
                        <tr key={it.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: isComplete ? '#f0fdf4' : 'white' }}>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isComplete}
                              onChange={() => handleToggleItemAcceptance(it.id)}
                              style={{ width: '18px', height: '18px', accentColor: '#10b981', cursor: 'pointer' }}
                              title="Marcar como recibido este ítem"
                            />
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: '850', color: '#0f172a' }}>
                            {it.products?.nombre_producto || 'Prenda'}
                            <span style={{ display: 'block', fontSize: '0.68rem', color: primaryColor }}>Ref: {it.products?.codigo_referencia || 'REF'}</span>
                            
                            {/* Badges de códigos de barras de este ítem (Clickables para aceptar/desmarcar individualmente) */}
                            {it.barcodes && it.barcodes.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.35rem' }}>
                                {it.barcodes.map((bc: string) => {
                                  const isScanned = scannedReceiveBarcodes.has(bc);
                                  return (
                                    <button
                                      key={bc}
                                      type="button"
                                      onClick={() => handleToggleBarcodeAcceptance(it.id, bc)}
                                      title="Haz clic para marcar/desmarcar este código como recibido"
                                      style={{
                                        fontFamily: 'monospace', fontSize: '0.65rem', padding: '0.15rem 0.45rem', borderRadius: '5px',
                                        backgroundColor: isScanned ? '#dcfce7' : '#f8fafc',
                                        color: isScanned ? '#15803d' : '#64748b',
                                        border: `1.5px solid ${isScanned ? '#86efac' : '#cbd5e1'}`,
                                        fontWeight: isScanned ? '900' : '700',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.2rem'
                                      }}
                                    >
                                      {isScanned ? '✓ ' : '⏳ '}{bc}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#334155', fontWeight: '750' }}>
                            {it.colors?.nombre_color || 'Estándar'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                            <span style={{ backgroundColor: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: '900', fontSize: '0.75rem' }}>
                              {it.sizes?.codigo_talla || 'ST'}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: '900', fontSize: '0.9rem', color: '#475569' }}>
                            {expected} uds
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: '950', fontSize: '0.95rem', color: isComplete ? '#059669' : '#d97706' }}>
                            {scanned} uds
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                            {isComplete ? (
                              <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '900' }}>
                                ✓ ACEPTADO
                              </span>
                            ) : (
                              <span style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '900' }}>
                                FALTAN {expected - scanned}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Observaciones de Recepción / Novedades */}
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                  Novedades de Recepción (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Se reciben 9 prendas en perfecto estado, falta 1 unidad..."
                  value={receivingNotes}
                  onChange={e => setReceivingNotes(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem' }}
                />
              </div>

              {/* Botón Finalizar Recepción */}
              <button
                type="button"
                onClick={handleConfirmReceipt}
                disabled={isProcessingReceipt}
                style={{
                  width: '100%', padding: '0.95rem', borderRadius: '12px', border: 'none',
                  backgroundColor: '#059669', color: 'white', fontWeight: '950', fontSize: '0.95rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  boxShadow: '0 6px 18px rgba(5,150,105,0.35)', transition: 'all 0.2s ease'
                }}
              >
                {isProcessingReceipt ? (
                  <RefreshCw size={18} className="animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 size={20} />
                    Confirmar Recepción Real ({totalScannedInReceive > 0 ? totalScannedInReceive : totalExpectedInReceive} uds al Inventario)
                  </>
                )}
              </button>

            </div>
          ) : (
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '3.5rem 2rem', border: '1.5px dashed #cbd5e1', textAlign: 'center', color: '#64748b' }}>
              <Package size={42} style={{ margin: '0 auto 0.75rem', color: '#059669', opacity: 0.6 }} />
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900', color: '#0f172a' }}>Selecciona un traslado entrante</h3>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>Haz clic en un traslado pendiente de la lista a la izquierda para iniciar el pistoleo y validación de las prendas recibidas.</p>
            </div>
          )}

        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── TAB 3: 📜 HISTORIAL DE TRASLADOS Y COMPROBANTES ── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1.5px solid #cbd5e1', overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem', backgroundColor: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '950', color: '#0f172a' }}>
                Historial de Traslados y Trazabilidad
              </h3>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                Registro de todos los movimientos de salida y entrada de esta sucursal.
              </p>
            </div>

            <div style={{ position: 'relative', minWidth: '240px' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Buscar por TR-XXXX o usuario..."
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                style={{ width: '100%', padding: '0.45rem 0.75rem 0.45rem 2.2rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left', borderBottom: '1.5px solid #cbd5e1', fontSize: '0.7rem', textTransform: 'uppercase', color: '#475569' }}>
                  <th style={{ padding: '0.85rem 1rem' }}>Consecutivo</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Fecha</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Tipo</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Origen</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Destino</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Total Uds</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Estado</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {transferHistory
                  .filter(tx => {
                    if (!historySearch.trim()) return true;
                    const q = historySearch.toLowerCase();
                    const code = `TR-${String(tx.consecutive).padStart(4, '0')}`.toLowerCase();
                    const user = (tx.usuario || '').toLowerCase();
                    const obs = (tx.observaciones || '').toLowerCase();
                    return code.includes(q) || user.includes(q) || obs.includes(q);
                  })
                  .map(tx => {
                    const totalUnits = (tx.finished_goods_transfer_items || []).reduce((s: number, i: any) => s + Number(i.cantidad || 0), 0);
                    const isOutgoing = tx.warehouse_orig_id === originWarehouseId;

                    return (
                      <tr key={tx.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: '950', color: primaryColor }}>
                          TR-{String(tx.consecutive).padStart(4, '0')}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: '#64748b' }}>
                          {new Date(tx.created_at).toLocaleString('es-CO')}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{
                            padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '900',
                            backgroundColor: isOutgoing ? '#fff1f2' : '#ecfdf5',
                            color: isOutgoing ? primaryColor : '#059669',
                            border: `1px solid ${isOutgoing ? '#fecdd3' : '#a7f3d0'}`
                          }}>
                            {isOutgoing ? '📤 Salida (Despacho)' : '📥 Entrada (Recepción)'}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: '750' }}>{tx.warehouse_orig?.nombre_bodega || '—'}</td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: '750' }}>{tx.warehouse_dest?.nombre_bodega || '—'}</td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: '950', fontSize: '0.9rem' }}>
                          {totalUnits} uds
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{
                            padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '900',
                            backgroundColor: tx.estado === 'Recibida' ? '#dcfce7' : tx.estado === 'Pendiente' ? '#fef3c7' : '#f1f5f9',
                            color: tx.estado === 'Recibida' ? '#15803d' : tx.estado === 'Pendiente' ? '#92400e' : '#475569'
                          }}>
                            {tx.estado}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                          <button
                            onClick={() => {
                              setSelectedHistoryTransfer(tx);
                              setShowHistoryDetailModal(true);
                            }}
                            style={{
                              padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1',
                              backgroundColor: '#f8fafc', fontSize: '0.75rem', fontWeight: '800', color: '#0f172a', cursor: 'pointer',
                              display: 'inline-flex', alignItems: 'center', gap: '0.3rem'
                            }}
                          >
                            <Eye size={13} /> Ver Detalle
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                {transferHistory.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                      No hay registros de traslados previos en esta tienda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── MODAL DE CATÁLOGO MANUAL DE EXISTENCIAS ── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showManualModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '18px', maxWidth: '750px', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#0f172a', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Search size={18} /> Seleccionar Prenda desde Existencias Disponibles
              </h3>
              <button onClick={() => setShowManualModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input
                type="text"
                placeholder="Buscar por referencia o nombre..."
                value={manualSearch}
                onChange={e => setManualSearch(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 1rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem' }}
                autoFocus
              />

              <div style={{ maxHeight: '380px', overflowY: 'auto', border: '1.5px solid #cbd5e1', borderRadius: '12px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left', borderBottom: '1.5px solid #cbd5e1', fontSize: '0.7rem', textTransform: 'uppercase', color: '#475569' }}>
                      <th style={{ padding: '0.75rem 0.85rem' }}>Producto</th>
                      <th style={{ padding: '0.75rem 0.85rem' }}>Color</th>
                      <th style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>Talla</th>
                      <th style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>Disponible</th>
                      <th style={{ padding: '0.75rem 0.85rem', textAlign: 'center', width: '140px' }}>Cantidad</th>
                      <th style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manualAvailableStock
                      .filter(s => {
                        if (!manualSearch.trim()) return true;
                        const q = manualSearch.toLowerCase();
                        const pName = (s.products?.nombre_producto || '').toLowerCase();
                        const pRef = (s.products?.codigo_referencia || '').toLowerCase();
                        return pName.includes(q) || pRef.includes(q);
                      })
                      .map(s => {
                        const available = Number(s.cantidad_disponible || 0);
                        const selectedQty = manualRowQuantities[s.id] !== undefined ? manualRowQuantities[s.id] : 1;

                        return (
                          <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.65rem 0.85rem', fontWeight: '850', color: '#0f172a' }}>
                              {s.products?.nombre_producto || 'Prenda'}
                              <span style={{ display: 'block', fontSize: '0.68rem', color: primaryColor }}>Ref: {s.products?.codigo_referencia}</span>
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', color: '#334155', fontWeight: '700' }}>
                              {s.colors?.nombre_color || 'Estándar'}
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                              <span style={{ backgroundColor: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: '900', fontSize: '0.75rem' }}>
                                {s.sizes?.codigo_talla || 'ST'}
                              </span>
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center', fontWeight: '950', color: '#059669', fontSize: '0.9rem' }}>
                              {available} uds
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                                <button
                                  type="button"
                                  onClick={() => setManualRowQuantities(prev => ({ ...prev, [s.id]: Math.max(1, (prev[s.id] || 1) - 1) }))}
                                  style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', cursor: 'pointer', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  max={available}
                                  value={selectedQty}
                                  onChange={e => {
                                    const val = Math.min(available, Math.max(1, parseInt(e.target.value) || 1));
                                    setManualRowQuantities(prev => ({ ...prev, [s.id]: val }));
                                  }}
                                  style={{
                                    width: '50px',
                                    padding: '0.25rem 0.2rem',
                                    textAlign: 'center',
                                    borderRadius: '6px',
                                    border: '1.5px solid #cbd5e1',
                                    fontWeight: '900',
                                    fontSize: '0.85rem',
                                    color: '#0f172a'
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => setManualRowQuantities(prev => ({ ...prev, [s.id]: Math.min(available, (prev[s.id] || 1) + 1) }))}
                                  style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', cursor: 'pointer', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  +
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setManualRowQuantities(prev => ({ ...prev, [s.id]: available }))}
                                  style={{ padding: '0.15rem 0.35rem', borderRadius: '5px', border: '1px solid #94a3b8', backgroundColor: '#f1f5f9', cursor: 'pointer', fontSize: '0.65rem', fontWeight: '800', color: '#475569' }}
                                  title="Seleccionar todo el disponible"
                                >
                                  Máx
                                </button>
                              </div>
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleAddManualItem(s, selectedQty)}
                                style={{
                                  padding: '0.4rem 0.85rem',
                                  borderRadius: '8px',
                                  border: 'none',
                                  backgroundColor: primaryColor,
                                  color: 'white',
                                  fontWeight: '850',
                                  fontSize: '0.78rem',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                  boxShadow: '0 2px 6px rgba(0,0,0,0.12)'
                                }}
                              >
                                + Agregar {selectedQty} ud{selectedQty > 1 ? 's' : ''}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── MODAL COMPROBANTE DE DESPACHO (GUÍA DE TRASLADO) ── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showDispatchVoucher && lastDispatchedTransfer && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '18px', maxWidth: '600px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#0f172a', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={20} style={{ color: '#10b981' }} /> ¡Despacho Confirmado con Éxito!
              </h3>
              <button onClick={() => setShowDispatchVoucher(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#ecfdf5', borderRadius: '12px', border: '1.5px solid #a7f3d0' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#047857', textTransform: 'uppercase' }}>NÚMERO ÚNICO DE TRASLADO</span>
                <h2 style={{ margin: '0.2rem 0', fontSize: '1.8rem', fontWeight: '950', color: primaryColor }}>
                  {lastDispatchedTransfer.consecutiveFormatted}
                </h2>
                <span style={{ fontSize: '0.8rem', color: '#065f46', fontWeight: '750' }}>
                  Estado: EN TRÁNSITO ({lastDispatchedTransfer.totalGarments} prendas enviadas)
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
                <div><span style={{ color: '#64748b' }}>Origen:</span> <strong>{lastDispatchedTransfer.originName}</strong></div>
                <div><span style={{ color: '#64748b' }}>Destino:</span> <strong style={{ color: primaryColor }}>{lastDispatchedTransfer.destName}</strong></div>
                <div><span style={{ color: '#64748b' }}>Fecha:</span> <span>{lastDispatchedTransfer.date}</span></div>
                <div><span style={{ color: '#64748b' }}>Despachado por:</span> <span>{lastDispatchedTransfer.usuario}</span></div>
              </div>

              {/* Lista de Códigos de Barras */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.85rem', backgroundColor: '#f8fafc' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '900', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                  Detalle de Prendas y Códigos Despachados
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '180px', overflowY: 'auto' }}>
                  {lastDispatchedTransfer.items?.map((it: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.25rem' }}>
                      <span><strong>{it.productName}</strong> ({it.colorName} | {it.sizeCode})</span>
                      <span style={{ fontWeight: '900' }}>{it.cantidad} uds</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ padding: '1rem 1.5rem', backgroundColor: '#f8fafc', borderTop: '1.5px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                onClick={() => {
                  window.print();
                }}
                style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Printer size={16} /> Imprimir Guía
              </button>
              <button
                onClick={() => setShowDispatchVoucher(false)}
                style={{ padding: '0.6rem 1.5rem', borderRadius: '8px', border: 'none', backgroundColor: primaryColor, color: 'white', fontWeight: '900', fontSize: '0.82rem', cursor: 'pointer' }}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── MODAL COMPROBANTE DE RECEPCIÓN CONFIRMADA ── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showReceiptVoucher && lastReceivedTransfer && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '18px', maxWidth: '600px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#059669', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={20} /> Recepción Confirmada e Ingresada a Stock
              </h3>
              <button onClick={() => setShowReceiptVoucher(false)} style={{ background: 'none', border: 'none', color: '#a7f3d0', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#ecfdf5', borderRadius: '12px', border: '1.5px solid #a7f3d0' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#047857', textTransform: 'uppercase' }}>TRASLADO RECIBIDO</span>
                <h2 style={{ margin: '0.2rem 0', fontSize: '1.8rem', fontWeight: '950', color: '#047857' }}>
                  {lastReceivedTransfer.consecutiveFormatted}
                </h2>
                <span style={{ fontSize: '0.85rem', color: '#065f46', fontWeight: '900' }}>
                  {lastReceivedTransfer.receivedQty} de {lastReceivedTransfer.expectedQty} prendas ingresadas
                </span>
              </div>

              {lastReceivedTransfer.diff > 0 && (
                <div style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', fontSize: '0.8rem', fontWeight: '800' }}>
                  ⚠️ Novedad: Quedaron {lastReceivedTransfer.diff} prendas pendientes de conciliar con el origen.
                </div>
              )}
            </div>

            <div style={{ padding: '1rem 1.5rem', backgroundColor: '#f8fafc', borderTop: '1.5px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowReceiptVoucher(false)}
                style={{ padding: '0.6rem 1.5rem', borderRadius: '8px', border: 'none', backgroundColor: '#059669', color: 'white', fontWeight: '900', fontSize: '0.85rem', cursor: 'pointer' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
