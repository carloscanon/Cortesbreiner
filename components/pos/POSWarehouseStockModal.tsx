'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Search, Barcode, Warehouse, Package, RefreshCw, X,
  Building2, CheckCircle2, AlertTriangle, Filter, ChevronDown,
  ChevronRight, Layers, ArrowRightLeft, ShoppingCart, Eye,
  Sparkles, Check, Store, Info, Plus
} from 'lucide-react';

interface POSWarehouseStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStore: any;
  products: any[];
  colors: any[];
  sizes: any[];
  onAddToCart?: (product: any, colorId: string | null, sizeId: string | null) => void;
  onOpenTransfers?: () => void;
}

export default function POSWarehouseStockModal({
  isOpen,
  onClose,
  currentStore,
  products,
  colors,
  sizes,
  onAddToCart,
  onOpenTransfers
}: POSWarehouseStockModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('all');
  const [selectedColorId, setSelectedColorId] = useState<string>('all');
  const [selectedSizeId, setSelectedSizeId] = useState<string>('all');
  const [onlyInStock, setOnlyInStock] = useState<boolean>(false);

  const [warehousesList, setWarehousesList] = useState<any[]>([]);
  const [allStockData, setAllStockData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProductDetails, setSelectedProductDetails] = useState<any | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch warehouses and full inventory stock
  const fetchInventoryData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Warehouses
      const { data: whData, error: whErr } = await supabase
        .from('warehouses')
        .select('*')
        .order('nombre_bodega', { ascending: true });

      if (!whErr && whData) {
        setWarehousesList(whData);
      }

      // 2. Fetch Finished Goods Stock with relations
      const { data: stockData, error: stErr } = await supabase
        .from('finished_goods_stock')
        .select(`
          id,
          warehouse_id,
          product_id,
          color_id,
          size_id,
          cantidad_disponible,
          cantidad_reservada,
          cantidad_en_transito,
          warehouses(id, nombre_bodega, tipo, responsable),
          products(id, nombre_producto, codigo_referencia, precio, imagen_url),
          colors(id, nombre_color, hex_color),
          sizes(id, codigo_talla, nombre_talla)
        `);

      if (!stErr && stockData) {
        setAllStockData(stockData);
      }
    } catch (err: any) {
      console.error('Error fetching warehouse stock in POS:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchInventoryData();
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen]);

  // Direct Barcode Lookup on Enter (pistol scanner or typing)
  const handleBarcodeScan = async (barcodeTerm: string) => {
    const term = barcodeTerm.trim();
    if (!term) return;

    try {
      // Check individual garments table
      const { data: garment } = await supabase
        .from('individual_garments')
        .select('*')
        .eq('barcode', term)
        .maybeSingle();

      if (garment) {
        const cleanRef = (garment.reference_name || '').toLowerCase().trim();
        const matched = products.find(p => {
          const pName = (p.nombre_producto || '').toLowerCase().trim();
          const pRef = (p.codigo_referencia || '').toLowerCase().trim();
          return (pRef && cleanRef.includes(pRef)) || (pName && cleanRef.includes(pName)) || (pName && pName.includes(cleanRef));
        });

        if (matched) {
          setSearchTerm(matched.nombre_producto || matched.codigo_referencia);
          setSelectedProductDetails(matched);
          return;
        }
      }

      // Check product reference
      const prodMatch = products.find(
        p => (p.codigo_referencia || '').toLowerCase() === term.toLowerCase() ||
             (p.nombre_producto || '').toLowerCase().includes(term.toLowerCase())
      );
      if (prodMatch) {
        setSearchTerm(prodMatch.nombre_producto);
        setSelectedProductDetails(prodMatch);
      }
    } catch (e) {
      console.error('Barcode lookup error:', e);
    }
  };

  // Group stock data by Product
  const groupedProductsStock = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    // 1. Group all stock entries by product_id
    const productMap = new Map<string, {
      product: any;
      totalStock: number;
      currentStoreStock: number;
      stockByWarehouse: Map<string, {
        warehouse: any;
        warehouseTotal: number;
        variants: any[];
      }>;
    }>();

    // Initialize map with all available catalog products if search matches
    products.forEach(p => {
      const pName = (p.nombre_producto || '').toLowerCase();
      const pRef = (p.codigo_referencia || '').toLowerCase();
      
      const matchesSearch = !term || pName.includes(term) || pRef.includes(term);
      if (matchesSearch) {
        productMap.set(p.id, {
          product: p,
          totalStock: 0,
          currentStoreStock: 0,
          stockByWarehouse: new Map()
        });
      }
    });

    // Populate stock entries
    allStockData.forEach(st => {
      if (!st.product_id) return;
      
      // Check if product is in map or should be added
      let entry = productMap.get(st.product_id);
      if (!entry) {
        const pObj = st.products || products.find(p => p.id === st.product_id);
        if (pObj) {
          const pName = (pObj.nombre_producto || '').toLowerCase();
          const pRef = (pObj.codigo_referencia || '').toLowerCase();
          if (!term || pName.includes(term) || pRef.includes(term)) {
            entry = {
              product: pObj,
              totalStock: 0,
              currentStoreStock: 0,
              stockByWarehouse: new Map()
            };
            productMap.set(st.product_id, entry);
          }
        }
      }

      if (!entry) return;

      const qty = Number(st.cantidad_disponible) || 0;
      const whId = st.warehouse_id || 'unknown';
      const whObj = st.warehouses || warehousesList.find(w => w.id === whId) || {
        id: whId,
        nombre_bodega: 'Bodega Sin Nombre',
        tipo: 'General'
      };

      // Filter checks
      if (selectedWarehouseId !== 'all' && whId !== selectedWarehouseId) return;
      if (selectedColorId !== 'all' && st.color_id !== selectedColorId) return;
      if (selectedSizeId !== 'all' && st.size_id !== selectedSizeId) return;

      // Add to total
      entry.totalStock += qty;

      // Check if this warehouse is associated with the current POS store
      if (currentStore?.bodega_asociada_id && currentStore.bodega_asociada_id === whId) {
        entry.currentStoreStock += qty;
      }

      // Add to warehouse specific breakdown
      if (!entry.stockByWarehouse.has(whId)) {
        entry.stockByWarehouse.set(whId, {
          warehouse: whObj,
          warehouseTotal: 0,
          variants: []
        });
      }

      const whGroup = entry.stockByWarehouse.get(whId)!;
      whGroup.warehouseTotal += qty;
      whGroup.variants.push({
        id: st.id,
        color_id: st.color_id,
        size_id: st.size_id,
        color_name: st.colors?.nombre_color || 'Estándar',
        hex_color: st.colors?.hex_color || '#94a3b8',
        size_name: st.sizes?.codigo_talla || st.sizes?.nombre_talla || 'Única',
        cantidad: qty,
        reservada: Number(st.cantidad_reservada) || 0,
        en_transito: Number(st.cantidad_en_transito) || 0
      });
    });

    // Convert to array and filter
    let results = Array.from(productMap.values()).filter(item => {
      if (onlyInStock && item.totalStock <= 0) return false;
      return true;
    });

    // Sort: items with stock in current store first, then total stock desc
    results.sort((a, b) => {
      if (b.currentStoreStock !== a.currentStoreStock) {
        return b.currentStoreStock - a.currentStoreStock;
      }
      return b.totalStock - a.totalStock;
    });

    return results;
  }, [allStockData, products, warehousesList, searchTerm, selectedWarehouseId, selectedColorId, selectedSizeId, onlyInStock, currentStore]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.78)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1.25rem'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '1180px',
        height: '92vh',
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid #e2e8f0'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 2rem',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)'
            }}>
              <Warehouse size={24} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '900', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                Consulta de Prendas y Stock por Bodega
                <span style={{ fontSize: '0.72rem', padding: '0.2rem 0.65rem', borderRadius: '20px', backgroundColor: 'rgba(59, 130, 246, 0.25)', color: '#93c5fd', fontWeight: '800', border: '1px solid rgba(147, 197, 253, 0.3)' }}>
                  {currentStore?.nombre || 'Tienda POS'}
                </span>
              </h2>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                Consulta en tiempo real existencias, tallas y colores en Bodega Principal, Locales y Tránsito
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={fetchInventoryData}
              disabled={loading}
              style={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                color: '#ffffff',
                border: 'none',
                padding: '0.5rem 0.9rem',
                borderRadius: '10px',
                fontSize: '0.8rem',
                fontWeight: '750',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Actualizar
            </button>

            <button
              onClick={onClose}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: 'rgba(255,255,255,0.1)',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.35)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div style={{
          backgroundColor: '#f8fafc',
          padding: '1.25rem 2rem',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          {/* Main Search Input */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Barcode size={20} style={{ position: 'absolute', left: '1.1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleBarcodeScan(searchTerm);
                  }
                }}
                placeholder="Escanea código de barras (ej: 0081995055) o busca por Nombre de Prenda, Referencia..."
                style={{
                  width: '100%',
                  padding: '0.85rem 1rem 0.85rem 3rem',
                  borderRadius: '14px',
                  border: '2px solid #cbd5e1',
                  fontSize: '0.95rem',
                  fontWeight: '700',
                  color: '#0f172a',
                  outline: 'none',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                  transition: 'border-color 0.2s'
                }}
                onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'}
                onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{
                    position: 'absolute',
                    right: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: '#94a3b8'
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {onOpenTransfers && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenTransfers();
                }}
                style={{
                  padding: '0.85rem 1.4rem',
                  borderRadius: '14px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  fontWeight: '850',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 12px rgba(16,185,129,0.3)'
                }}
              >
                <ArrowRightLeft size={16} /> Solicitar Traslado
              </button>
            )}
          </div>

          {/* Secondary Selectors (Warehouse, Color, Size, Stock Toggle) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {/* Warehouse filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#64748b' }}>🏢 Bodega:</span>
              <select
                value={selectedWarehouseId}
                onChange={e => setSelectedWarehouseId(e.target.value)}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontSize: '0.82rem',
                  fontWeight: '700',
                  color: '#1e293b',
                  outline: 'none'
                }}
              >
                <option value="all">🌐 Todas las Bodegas (Consolidado)</option>
                {warehousesList.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.nombre_bodega || w.name} ({w.tipo || 'General'})
                  </option>
                ))}
              </select>
            </div>

            {/* Color filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#64748b' }}>🎨 Color:</span>
              <select
                value={selectedColorId}
                onChange={e => setSelectedColorId(e.target.value)}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontSize: '0.82rem',
                  fontWeight: '700',
                  color: '#1e293b',
                  outline: 'none'
                }}
              >
                <option value="all">Todos los colores</option>
                {colors.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre_color}</option>
                ))}
              </select>
            </div>

            {/* Size filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#64748b' }}>📏 Talla:</span>
              <select
                value={selectedSizeId}
                onChange={e => setSelectedSizeId(e.target.value)}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontSize: '0.82rem',
                  fontWeight: '700',
                  color: '#1e293b',
                  outline: 'none'
                }}
              >
                <option value="all">Todas las tallas</option>
                {sizes.map(s => (
                  <option key={s.id} value={s.id}>{s.codigo_talla || s.nombre_talla}</option>
                ))}
              </select>
            </div>

            {/* Only with stock checkbox */}
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: '750',
              color: onlyInStock ? '#059669' : '#475569',
              marginLeft: 'auto'
            }}>
              <input
                type="checkbox"
                checked={onlyInStock}
                onChange={e => setOnlyInStock(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#059669' }}
              />
              Solo prendas con existencias (&gt;0)
            </label>
          </div>
        </div>

        {/* Modal Results Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.75rem 2rem', backgroundColor: '#f1f5f9' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '1rem', color: '#64748b' }}>
              <RefreshCw size={32} className="animate-spin" color="#3b82f6" />
              <span style={{ fontSize: '0.95rem', fontWeight: '750' }}>Consultando stock en todas las bodegas...</span>
            </div>
          ) : groupedProductsStock.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4rem 2rem',
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              border: '2px dashed #cbd5e1',
              textAlign: 'center',
              gap: '0.75rem'
            }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                <Package size={28} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '850', color: '#1e293b' }}>
                No se encontraron prendas con los filtros aplicados
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', maxWidth: '400px' }}>
                Prueba buscando por otra referencia, nombre de producto, o cambia el filtro de bodega/color.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '850', color: '#475569' }}>
                  Mostrando {groupedProductsStock.length} referencia(s) encontrada(s)
                </span>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Total unidades en catálogo filtrado: <strong style={{ color: '#0f172a' }}>{groupedProductsStock.reduce((s, it) => s + it.totalStock, 0)} unidades</strong>
                </span>
              </div>

              {groupedProductsStock.map(({ product, totalStock, currentStoreStock, stockByWarehouse }) => {
                const whArray = Array.from(stockByWarehouse.values());
                const isSelected = selectedProductDetails?.id === product.id;

                return (
                  <div
                    key={product.id}
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '18px',
                      border: currentStoreStock > 0 ? '2px solid #bbf7d0' : '1.5px solid #e2e8f0',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.04)',
                      overflow: 'hidden',
                      transition: 'all 0.2s'
                    }}
                  >
                    {/* Product Summary Header Card */}
                    <div style={{
                      padding: '1.25rem 1.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: isSelected ? '#f8fafc' : '#ffffff',
                      borderBottom: '1px solid #f1f5f9'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        {/* Product Image / Icon */}
                        <div style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '12px',
                          backgroundColor: '#f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          border: '1px solid #e2e8f0',
                          flexShrink: 0
                        }}>
                          {product.imagen_url ? (
                            <img src={product.imagen_url} alt={product.nombre_producto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <Package size={24} color="#64748b" />
                          )}
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '900', color: '#0f172a' }}>
                              {product.nombre_producto}
                            </h3>
                            {product.codigo_referencia && (
                              <span style={{
                                backgroundColor: '#f1f5f9',
                                color: '#475569',
                                padding: '0.15rem 0.5rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: '800'
                              }}>
                                Ref: {product.codigo_referencia}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
                            Precio Venta: <strong style={{ color: '#059669', fontSize: '0.9rem' }}>${Number(product.precio || 35000).toLocaleString('es-CO')}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Stock Badges and Quick Add */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {/* Current store stock badge */}
                        <div style={{
                          backgroundColor: currentStoreStock > 0 ? '#ecfdf5' : '#f8fafc',
                          border: currentStoreStock > 0 ? '1.5px solid #10b981' : '1px solid #cbd5e1',
                          padding: '0.45rem 0.85rem',
                          borderRadius: '10px',
                          textAlign: 'center'
                        }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: '800', color: currentStoreStock > 0 ? '#047857' : '#64748b', display: 'block' }}>
                            EN ESTA TIENDA
                          </span>
                          <span style={{ fontSize: '1.1rem', fontWeight: '950', color: currentStoreStock > 0 ? '#059669' : '#94a3b8' }}>
                            {currentStoreStock} und
                          </span>
                        </div>

                        {/* Total Company stock badge */}
                        <div style={{
                          backgroundColor: totalStock > 0 ? '#eff6ff' : '#f8fafc',
                          border: totalStock > 0 ? '1.5px solid #3b82f6' : '1px solid #cbd5e1',
                          padding: '0.45rem 0.85rem',
                          borderRadius: '10px',
                          textAlign: 'center'
                        }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: '800', color: totalStock > 0 ? '#1d4ed8' : '#64748b', display: 'block' }}>
                            TOTAL EMPRESA
                          </span>
                          <span style={{ fontSize: '1.1rem', fontWeight: '950', color: totalStock > 0 ? '#2563eb' : '#94a3b8' }}>
                            {totalStock} und
                          </span>
                        </div>

                        {/* Direct Add to Cart button if in stock in current store */}
                        {onAddToCart && currentStoreStock > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              onAddToCart(product, null, null);
                              onClose();
                            }}
                            style={{
                              backgroundColor: '#ec4899',
                              color: '#ffffff',
                              border: 'none',
                              padding: '0.55rem 1rem',
                              borderRadius: '10px',
                              fontSize: '0.8rem',
                              fontWeight: '850',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              boxShadow: '0 2px 8px rgba(236,72,153,0.35)'
                            }}
                          >
                            <ShoppingCart size={15} /> Vender en POS
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Breakdown by Warehouse Accordion / Table */}
                    <div style={{ padding: '1rem 1.75rem', backgroundColor: '#fafafa' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '850', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.75rem' }}>
                        📦 Desglose de existencias por bodega y variante ({whArray.length} bodegas con registro):
                      </span>

                      {whArray.length === 0 ? (
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', padding: '0.5rem 0' }}>
                          Sin existencias registradas en bodegas para esta referencia.
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.85rem' }}>
                          {whArray.map(({ warehouse, warehouseTotal, variants }) => {
                            const isMyStoreWarehouse = currentStore?.bodega_asociada_id === warehouse.id;

                            return (
                              <div
                                key={warehouse.id}
                                style={{
                                  backgroundColor: '#ffffff',
                                  borderRadius: '12px',
                                  border: isMyStoreWarehouse ? '2px solid #10b981' : '1px solid #e2e8f0',
                                  padding: '0.85rem 1rem',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.6rem'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <div>
                                    <div style={{ fontSize: '0.88rem', fontWeight: '850', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                      <Building2 size={15} color={isMyStoreWarehouse ? '#059669' : '#3b82f6'} />
                                      {warehouse.nombre_bodega || warehouse.name}
                                    </div>
                                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                      {isMyStoreWarehouse ? '⭐ Bodega de tu Tienda' : `Tipo: ${warehouse.tipo || 'General'}`}
                                    </span>
                                  </div>

                                  <span style={{
                                    backgroundColor: warehouseTotal > 0 ? (isMyStoreWarehouse ? '#ecfdf5' : '#eff6ff') : '#f1f5f9',
                                    color: warehouseTotal > 0 ? (isMyStoreWarehouse ? '#047857' : '#1e40af') : '#64748b',
                                    padding: '0.2rem 0.6rem',
                                    borderRadius: '8px',
                                    fontSize: '0.82rem',
                                    fontWeight: '900'
                                  }}>
                                    {warehouseTotal} und
                                  </span>
                                </div>

                                {/* Variants pills / list */}
                                <div style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.35rem',
                                  maxHeight: '130px',
                                  overflowY: 'auto',
                                  backgroundColor: '#f8fafc',
                                  padding: '0.5rem',
                                  borderRadius: '8px'
                                }}>
                                  {variants.map((v: any, vIdx: number) => (
                                    <div
                                      key={vIdx}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        fontSize: '0.78rem'
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <span
                                          style={{
                                            width: '10px',
                                            height: '10px',
                                            borderRadius: '50%',
                                            backgroundColor: v.hex_color || '#94a3b8',
                                            border: '1px solid rgba(0,0,0,0.15)',
                                            display: 'inline-block'
                                          }}
                                        />
                                        <span style={{ fontWeight: '700', color: '#334155' }}>
                                          {v.color_name}
                                        </span>
                                        <span style={{ color: '#64748b' }}>• Talla: <strong style={{ color: '#0f172a' }}>{v.size_name}</strong></span>
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <span style={{
                                          fontWeight: '850',
                                          color: v.cantidad > 0 ? '#059669' : '#dc2626'
                                        }}>
                                          {v.cantidad} und
                                        </span>

                                        {onAddToCart && isMyStoreWarehouse && v.cantidad > 0 && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              onAddToCart(product, v.color_id, v.size_id);
                                              onClose();
                                            }}
                                            title="Agregar esta talla y color al POS"
                                            style={{
                                              backgroundColor: '#ec4899',
                                              color: '#ffffff',
                                              border: 'none',
                                              width: '20px',
                                              height: '20px',
                                              borderRadius: '4px',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            <Plus size={12} />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
