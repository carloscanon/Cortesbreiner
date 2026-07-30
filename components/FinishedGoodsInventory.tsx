'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Package, Search, Plus, MoveHorizontal, X, Loader2,
  TrendingUp, TrendingDown, CheckCircle2, Clock, AlertTriangle,
  MapPin, Eye, FileText, ArrowRight, Download, Upload, RefreshCw, Barcode, QrCode
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

type TabType = 'dashboard' | 'stock' | 'kardex' | 'transfers' | 'locations' | 'initial_load';

export default function FinishedGoodsInventory() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  // Masters
  const [products, setProducts] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);

  // State
  const [loading, setLoading] = useState(true);
  const [stock, setStock] = useState<any[]>([]);
  const [kardex, setKardex] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState('');
  const [filterColor, setFilterColor] = useState('');
  const [filterSize, setFilterSize] = useState('');
  const [filterAlert, setFilterAlert] = useState('all');

  // Modals
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Form states
  const [locationForm, setLocationForm] = useState({ warehouse_id: '', pasillo: '', estanteria: '', nivel: '', posicion: '' });
  const [adjustmentForm, setAdjustmentForm] = useState({ stock_id: '', product_id: '', color_id: '', size_id: '', warehouse_id: '', type: 'Ajuste positivo', cantidad: 1, observaciones: '' });
  const [transferForm, setTransferForm] = useState({ warehouse_orig_id: '', warehouse_dest_id: '', items: [] as any[], observaciones: '' });
  
  // Initial load assistant
  const [rawPaste, setRawPaste] = useState('');
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);

  // Loading flags
  const [savingLocation, setSavingLocation] = useState(false);
  const [savingAdjustment, setSavingAdjustment] = useState(false);
  const [savingTransfer, setSavingTransfer] = useState(false);

  useEffect(() => {
    fetchMasters().then(() => {
      fetchStock();
      fetchKardex();
      fetchTransfers();
    });
  }, []);

  const fetchMasters = async () => {
    setLoading(true);
    try {
      const { data: p } = await supabase.from('products').select('*');
      const { data: c } = await supabase.from('colors').select('*');
      const { data: s } = await supabase.from('sizes').select('*').order('orden_visual', { ascending: true });
      const { data: w } = await supabase.from('warehouses').select('*').eq('estado', 'activo');
      const { data: loc } = await supabase.from('warehouse_locations').select('*');

      setProducts(p || []);
      setColors(c || []);
      setSizes(s || []);
      setWarehouses(w || []);
      setLocations(loc || []);
    } catch (err) {
      console.error('Error fetching masters:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStock = async () => {
    try {
      const { data, error } = await supabase
        .from('finished_goods_stock')
        .select(`
          *,
          products (id, nombre_producto, codigo_referencia, precio, categoria, category_id, categories (id, categoria, nombre_categoria)),
          colors (id, nombre_color, hex_color),
          sizes (id, codigo_talla),
          warehouses (id, nombre_bodega),
          warehouse_locations (id, pasillo, estanteria, nivel, posicion)
        `);
      if (error) throw error;
      setStock(data || []);
    } catch (err) {
      console.error('Error fetching stock:', err);
    }
  };

  const fetchKardex = async () => {
    try {
      const { data, error } = await supabase
        .from('finished_goods_kardex')
        .select(`
          *,
          products (id, nombre_producto, codigo_referencia, categoria, category_id, categories (id, categoria, nombre_categoria)),
          colors (id, nombre_color),
          sizes (id, codigo_talla),
          warehouse_orig:warehouses!finished_goods_kardex_warehouse_orig_id_fkey (nombre_bodega),
          warehouse_dest:warehouses!finished_goods_kardex_warehouse_dest_id_fkey (nombre_bodega)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
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
    .filter(k => new Date(k.created_at) >= todayStart && k.tipo_movimiento.toLowerCase().includes('ingreso') || k.tipo_movimiento.toLowerCase().includes('positivo'))
    .reduce((sum, k) => sum + k.cantidad, 0);
  const exitsToday = kardex
    .filter(k => new Date(k.created_at) >= todayStart && k.tipo_movimiento.toLowerCase().includes('salida') || k.tipo_movimiento.toLowerCase().includes('negativo') || k.tipo_movimiento.toLowerCase().includes('despacho') || k.tipo_movimiento.toLowerCase().includes('baja'))
    .reduce((sum, k) => sum + k.cantidad, 0);

  // Filters stock
  const filteredStock = stock.filter(item => {
    const ref = item.products?.codigo_referencia || '';
    const name = item.products?.nombre_producto || '';
    const cat = (item.products?.categories?.categoria || item.products?.categories?.nombre_categoria || item.products?.categoria || '');
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
      
    const matchesWarehouse = filterWarehouse ? item.warehouse_id === filterWarehouse : true;
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

      // 1. Fetch current stock
      const { data: stockRecords } = await supabase
        .from('finished_goods_stock')
        .select('*')
        .eq('warehouse_id', finalWarehouseId)
        .eq('product_id', finalProductId)
        .eq('size_id', finalSizeId)
        .is('location_id', null);

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
            color_id: finalColorId,
            size_id: finalSizeId,
            cantidad_disponible: saldoNuevo
          });
      }

      // 2. Add to Kardex
      await supabase
        .from('finished_goods_kardex')
        .insert({
          product_id: finalProductId,
          color_id: finalColorId,
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
      setAdjustmentForm({ stock_id: '', product_id: '', color_id: '', size_id: '', warehouse_id: '', type: 'Ajuste positivo', cantidad: 1, observaciones: '' });
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
            color_id: item.color_id,
            size_id: item.size_id,
            cantidad: Number(item.cantidad)
          });

        // Deduct from origin
        const { data: origStock } = await supabase
          .from('finished_goods_stock')
          .select('*')
          .eq('warehouse_id', transferForm.warehouse_orig_id)
          .eq('product_id', item.product_id)
          .eq('size_id', item.size_id)
          .is('location_id', null);

        const currentOrigQty = origStock?.[0] ? Number(origStock[0].cantidad_disponible) : 0;
        await supabase
          .from('finished_goods_stock')
          .update({ cantidad_disponible: currentOrigQty - Number(item.cantidad) })
          .eq('id', origStock?.[0]?.id);

        // Kardex Orig (Salida en Tránsito)
        await supabase.from('finished_goods_kardex').insert({
          product_id: item.product_id,
          color_id: item.color_id,
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
        const { data: destStock } = await supabase
          .from('finished_goods_stock')
          .select('*')
          .eq('warehouse_id', tx.warehouse_dest_id)
          .eq('product_id', item.product_id)
          .eq('size_id', item.size_id)
          .is('location_id', null);

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
              color_id: item.color_id,
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
            const { data: storeStock } = await supabase
              .from('store_inventory')
              .select('*')
              .eq('store_id', store.id)
              .eq('product_id', item.product_id)
              .eq('size_id', item.size_id)
              .is('color_id', item.color_id ? item.color_id : null);

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
                  color_id: item.color_id,
                  size_id: item.size_id,
                  cantidad_disponible: Number(item.cantidad)
                });
            }
          }
        }

        // Kardex Dest
        await supabase.from('finished_goods_kardex').insert({
          product_id: item.product_id,
          color_id: item.color_id,
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
        // Consultar stock
        const { data: stockRecords } = await supabase
          .from('finished_goods_stock')
          .select('*')
          .eq('warehouse_id', item.warehouseId)
          .eq('product_id', item.productId)
          .eq('size_id', item.sizeId)
          .is('location_id', null);

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
              color_id: item.colorId,
              size_id: item.sizeId,
              cantidad_disponible: item.qty
            });
        }

        // Kardex
        await supabase.from('finished_goods_kardex').insert({
          product_id: item.productId,
          color_id: item.colorId,
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
        
        <div style={{ display: 'flex', gap: '0.75rem' }}>
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
          { id: 'stock', label: 'Existencias por SKU' },
          { id: 'kardex', label: 'Kardex Historial' },
          { id: 'transfers', label: 'Transferencias' },
          { id: 'locations', label: 'Bodegas y Ubicaciones' },
          { id: 'initial_load', label: 'Carga Inicial Excel' }
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
                  const whStock = stock.filter(s => s.warehouse_id === w.id);
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
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2.5px solid var(--border)', textAlign: 'left', backgroundColor: '#f8fafc' }}>
                  {['Referencia', 'Producto', 'Categoría', 'Bodega', 'Color', 'Talla', 'Disponible', 'Reservado', 'En Tránsito', 'Stock Mín / Máx', 'Estado/Alerta', 'Acciones'].map(h => (
                    <th key={h} style={{ padding: '1rem 1.5rem', fontWeight: '800', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredStock.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      No se encontraron existencias con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filteredStock.map(item => {
                    const isCritical = item.cantidad_disponible <= (item.stock_minimo || 0) && item.stock_minimo > 0;
                    const isOver = item.cantidad_disponible >= (item.stock_maximo || 999999) && item.stock_maximo > 0;
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.2s' }}>
                        <td style={{ padding: '1rem 1.5rem', fontWeight: '800', color: 'var(--primary)' }}>{item.products?.codigo_referencia || '—'}</td>
                        <td style={{ padding: '1rem 1.5rem', fontWeight: '800', color: '#0f172a' }}>{item.products?.nombre_producto || '—'}</td>
                        <td style={{ padding: '1rem 1.5rem', fontWeight: '700', color: '#475569' }}>
                          {item.products?.categories?.categoria || item.products?.categories?.nombre_categoria || item.products?.categoria || '—'}
                        </td>
                        <td style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>{item.warehouses?.nombre_bodega || '—'}</td>
                        <td style={{ padding: '1rem 1.5rem' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: '600' }}>
                            <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: item.colors?.hex_color || '#000', border: '1px solid var(--border)' }} />
                            {item.colors?.nombre_color || '—'}
                          </span>
                        </td>
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
                        <td style={{ padding: '1rem 1.5rem' }}>
                          <button
                            onClick={() => {
                              setAdjustmentForm({
                                stock_id: item.id,
                                product_id: item.product_id,
                                color_id: item.color_id,
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
          <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>Historial de Movimientos de Producto Terminado</h3>
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
                        <td style={{ padding: '1rem 1.5rem', fontWeight: '700' }}>{mov.documento_origen || '—'}</td>
                        <td style={{ padding: '1rem 1.5rem', fontWeight: '800', color: 'var(--primary)' }}>{mov.products?.codigo_referencia || '—'}</td>
                        <td style={{ padding: '1rem 1.5rem', fontWeight: '800', color: '#0f172a' }}>{mov.products?.nombre_producto || '—'}</td>
                        <td style={{ padding: '1rem 1.5rem', fontWeight: '700', color: '#475569' }}>
                          {mov.products?.categories?.categoria || mov.products?.categories?.nombre_categoria || mov.products?.categoria || '—'}
                        </td>
                        <td style={{ padding: '1rem 1.5rem', fontWeight: '600' }}>{mov.colors?.nombre_color || '—'}</td>
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
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Referencia / Producto</label>
                    <select
                      required
                      value={adjustmentForm.product_id}
                      onChange={e => setAdjustmentForm({ ...adjustmentForm, product_id: e.target.value })}
                      style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                    >
                      <option value="">Seleccionar...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.nombre_producto} ({p.codigo_referencia})</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Color</label>
                      <select
                        value={adjustmentForm.color_id}
                        onChange={e => setAdjustmentForm({ ...adjustmentForm, color_id: e.target.value })}
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
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Prendas a transferir</label>
                
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
                        {products.map(p => <option key={p.id} value={p.id}>{p.nombre_producto}</option>)}
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
    </div>
  );
}
