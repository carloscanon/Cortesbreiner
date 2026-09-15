import React, { useState, useMemo } from 'react';
import {
  PackageCheck, Search, Filter, Download, Layers, Eye, RefreshCw,
  AlertTriangle, TrendingUp, CheckCircle2, Package, ChevronDown, ChevronUp,
  Layers3, Sliders, CheckSquare, Square, Palette, Ruler, Building2, Tag
} from 'lucide-react';

interface ConsolidatedStockSubmoduleProps {
  stock: any[];
  products: any[];
  colors: any[];
  sizes: any[];
  warehouses: any[];
  categories: any[];
  stockOrderMap?: Record<string, string>;
  onOpenUnitDetails?: (item: any) => void;
  onOpenAdjustment?: (item: any) => void;
}

export default function ConsolidatedStockSubmodule({
  stock,
  products,
  colors,
  sizes,
  warehouses,
  categories,
  stockOrderMap = {},
  onOpenUnitDetails,
  onOpenAdjustment
}: ConsolidatedStockSubmoduleProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedColor, setSelectedColor] = useState('all');
  const [selectedSize, setSelectedSize] = useState('all');
  const [currentPage, setCurrentPage] = useState(0);

  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // Dynamic Grouping Controls
  const [groupByColor, setGroupByColor] = useState(true);
  const [groupBySize, setGroupBySize] = useState(true);
  const [groupByWarehouse, setGroupByWarehouse] = useState(true);
  const [groupPreset, setGroupPreset] = useState<'full_sku' | 'product_only' | 'product_color' | 'product_size' | 'warehouse_product' | 'custom'>('full_sku');

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery, selectedWarehouse, selectedCategory, selectedColor, selectedSize, groupByColor, groupBySize, groupByWarehouse]);

  // Handle Preset Change
  const handleSelectPreset = (preset: 'full_sku' | 'product_only' | 'product_color' | 'product_size' | 'warehouse_product') => {
    setGroupPreset(preset);
    switch (preset) {
      case 'product_only':
        setGroupByColor(false);
        setGroupBySize(false);
        setGroupByWarehouse(false);
        break;
      case 'product_color':
        setGroupByColor(true);
        setGroupBySize(false);
        setGroupByWarehouse(false);
        break;
      case 'product_size':
        setGroupByColor(false);
        setGroupBySize(true);
        setGroupByWarehouse(false);
        break;
      case 'warehouse_product':
        setGroupByColor(false);
        setGroupBySize(false);
        setGroupByWarehouse(true);
        break;
      case 'full_sku':
      default:
        setGroupByColor(true);
        setGroupBySize(true);
        setGroupByWarehouse(true);
        break;
    }
  };

  // Grouping stock dynamically by user preferences
  const consolidatedList = useMemo(() => {
    const map: Record<string, {
      key: string;
      productId: string | null;
      productRef: string;
      productName: string;
      categoryName: string;
      price: number;
      colorName: string;
      hexColor: string;
      sizeCode: string;
      warehouseName: string;
      totalDisponible: number;
      totalReservado: number;
      totalEnTransito: number;
      recordsCount: number;
      items: any[];
      linkedOrders: Set<string>;
      uniqueColorsSet: Set<string>;
      uniqueSizesSet: Set<string>;
      uniqueWarehousesSet: Set<string>;
    }> = {};

    (stock || []).forEach(item => {
      // 1. Resolve Product info
      const prodObj = item.products;
      const productRef = (prodObj?.codigo_referencia || item.reference_name || '—').trim();
      const productName = (prodObj?.nombre_producto || prodObj?.name || productRef || '—').trim();
      const categoryName = (prodObj?.categories?.categoria || prodObj?.categoria || 'Sin Categoría').trim();
      const price = prodObj?.precio || 0;

      // 2. Resolve Color info
      let colorObj = item.colors;
      let colorName = colorObj?.nombre_color;
      let hexColor = colorObj?.hex_color;

      if (!colorName && productName) {
        const nameUpper = productName.toUpperCase();
        const matchedColor = (colors || []).find(c => {
          const cName = c.nombre_color?.toUpperCase().trim();
          return cName && cName.length >= 3 && (nameUpper.includes(' ' + cName + ' ') || nameUpper.endsWith(' ' + cName));
        });
        if (matchedColor) {
          colorName = matchedColor.nombre_color;
          hexColor = matchedColor.hex_color;
        }
      }
      colorName = (colorName || item.fabrics?.nombre_tela || 'Sin Especificar').trim();

      // 3. Resolve Size info
      const sizeCode = (item.sizes?.codigo_talla || 'S/T').trim();

      // 4. Resolve Warehouse info
      const warehouseName = (item.warehouses?.nombre_bodega || 'Bodega Principal').trim();

      // Dynamic Grouping Key Parts
      const refNorm = (productName || productRef).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const colorNorm = groupByColor ? colorName.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : 'ALL_COLORS';
      const sizeNorm = groupBySize ? sizeCode.toUpperCase() : 'ALL_SIZES';
      const whNorm = groupByWarehouse ? warehouseName.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : 'ALL_WAREHOUSES';

      const groupKey = `${refNorm}___${colorNorm}___${sizeNorm}___${whNorm}`;

      if (!map[groupKey]) {
        map[groupKey] = {
          key: groupKey,
          productId: item.product_id || null,
          productRef,
          productName,
          categoryName,
          price,
          colorName: groupByColor ? colorName : 'Todos los Colores',
          hexColor: groupByColor ? (hexColor || '#94a3b8') : '#6366f1',
          sizeCode: groupBySize ? sizeCode : 'Todas las Tallas',
          warehouseName: groupByWarehouse ? warehouseName : 'Todas las Bodegas',
          totalDisponible: 0,
          totalReservado: 0,
          totalEnTransito: 0,
          recordsCount: 0,
          items: [],
          linkedOrders: new Set(),
          uniqueColorsSet: new Set(),
          uniqueSizesSet: new Set(),
          uniqueWarehousesSet: new Set()
        };
      }

      map[groupKey].totalDisponible += Number(item.cantidad_disponible || 0);
      map[groupKey].totalReservado += Number(item.cantidad_reservada || 0);
      map[groupKey].totalEnTransito += Number(item.cantidad_en_transito || 0);
      map[groupKey].recordsCount += 1;
      map[groupKey].items.push(item);

      map[groupKey].uniqueColorsSet.add(colorName);
      map[groupKey].uniqueSizesSet.add(sizeCode);
      map[groupKey].uniqueWarehousesSet.add(warehouseName);

      // Check linked order
      const stockKey = `${item.product_id}_${item.color_id || 'null'}_${item.size_id}_${item.warehouse_id}`;
      const refKey = `${productName.toUpperCase()}___${colorName.toUpperCase()}___${sizeCode.toUpperCase()}`;
      const linkedOrder = stockOrderMap[refKey] || stockOrderMap[stockKey];
      if (linkedOrder && linkedOrder !== '—') {
        map[groupKey].linkedOrders.add(linkedOrder);
      }
    });

    return Object.values(map);
  }, [stock, colors, stockOrderMap, groupByColor, groupBySize, groupByWarehouse]);

  // Filtered List
  const filteredList = useMemo(() => {
    return consolidatedList.filter(item => {
      // Warehouse filter
      if (selectedWarehouse !== 'all') {
        const selWh = selectedWarehouse.toLowerCase();
        const matchesAnyWh = Array.from(item.uniqueWarehousesSet).some(w => w.toLowerCase().includes(selWh));
        if (!matchesAnyWh) return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && item.categoryName.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }

      // Color filter
      if (selectedColor !== 'all') {
        const selColor = selectedColor.toLowerCase();
        const matchesAnyColor = Array.from(item.uniqueColorsSet).some(c => c.toLowerCase() === selColor);
        if (!matchesAnyColor) return false;
      }

      // Size filter
      if (selectedSize !== 'all') {
        const selSize = selectedSize.toLowerCase();
        const matchesAnySize = Array.from(item.uniqueSizesSet).some(s => s.toLowerCase() === selSize);
        if (!matchesAnySize) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const term = searchQuery.trim().toLowerCase();
        const matchesRef = item.productRef.toLowerCase().includes(term);
        const matchesName = item.productName.toLowerCase().includes(term);
        const matchesColor = Array.from(item.uniqueColorsSet).some(c => c.toLowerCase().includes(term));
        const matchesSize = Array.from(item.uniqueSizesSet).some(s => s.toLowerCase().includes(term));
        const matchesCat = item.categoryName.toLowerCase().includes(term);
        const matchesWh = Array.from(item.uniqueWarehousesSet).some(w => w.toLowerCase().includes(term));

        if (!matchesRef && !matchesName && !matchesColor && !matchesSize && !matchesCat && !matchesWh) {
          return false;
        }
      }

      return true;
    });
  }, [consolidatedList, selectedWarehouse, selectedCategory, selectedColor, selectedSize, searchQuery]);

  // KPIs
  const totalUniqueRows = filteredList.length;
  const totalGarmentsSum = filteredList.reduce((sum, item) => sum + item.totalDisponible, 0);
  const totalDuplicateRecordsCount = filteredList.reduce((sum, item) => sum + item.recordsCount, 0);
  const totalValueSum = filteredList.reduce((sum, item) => sum + (item.totalDisponible * item.price), 0);

  // Export CSV
  const handleExportCSV = () => {
    if (filteredList.length === 0) return alert('No hay datos para exportar.');

    const BOM = '\uFEFF';
    const headers = [
      'Referencia', 'Nombre Producto', 'Categoría',
      groupByColor ? 'Color' : 'Colores Incluidos',
      groupBySize ? 'Talla' : 'Tallas Incluidas',
      groupByWarehouse ? 'Bodega' : 'Bodegas Incluidas',
      'Disponible Consolidado', 'Reservado', 'En Tránsito',
      'Registros Fusionados', 'Ordenes Vinculadas', 'Valor Estimado'
    ];

    const rows = filteredList.map(item => {
      const colorsStr = Array.from(item.uniqueColorsSet).join(', ');
      const sizesStr = Array.from(item.uniqueSizesSet).join(', ');
      const warehousesStr = Array.from(item.uniqueWarehousesSet).join(', ');
      const ordersStr = Array.from(item.linkedOrders).join(', ') || '—';
      const estimatedVal = item.totalDisponible * item.price;
      return [
        item.productRef,
        item.productName,
        item.categoryName,
        colorsStr,
        sizesStr,
        warehousesStr,
        item.totalDisponible,
        item.totalReservado,
        item.totalEnTransito,
        item.recordsCount,
        ordersStr,
        `$${estimatedVal.toLocaleString('es-CO')}`
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';');
    });

    const csvContent = BOM + headers.join(';') + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `inventario_consolidado_dinamico_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Dynamic Grouping Mode Toolbar Banner */}
      <div style={{
        backgroundColor: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '16px',
        padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
      }}>
        
        {/* Top Header & Presets */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.55rem', backgroundColor: '#eef2ff', color: 'var(--primary)', borderRadius: '12px' }}>
              <Sliders size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '950', color: '#0f172a' }}>
                Consolidación Dinámica e Interactiva
              </h3>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                Selecciona cómo deseas agrupar tus existencias en tiempo real (Suma total por producto, por color, por talla o SKU).
              </p>
            </div>
          </div>

          {/* Quick Presets Pills */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {[
              { id: 'product_only', label: '📦 Solo por Producto (Total)', icon: Package },
              { id: 'product_color', label: '🎨 Producto + Color', icon: Palette },
              { id: 'product_size', label: '🏷️ Producto + Talla', icon: Ruler },
              { id: 'warehouse_product', label: '🏬 Bodega + Producto', icon: Building2 },
              { id: 'full_sku', label: '⚡ SKU Completo (Ref + Color + Talla + Bodega)', icon: Layers3 }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => handleSelectPreset(p.id as any)}
                style={{
                  padding: '0.45rem 0.85rem', fontSize: '0.78rem', fontWeight: '850', borderRadius: '10px',
                  border: groupPreset === p.id ? '2px solid var(--primary)' : '1px solid #cbd5e1',
                  backgroundColor: groupPreset === p.id ? '#fdf2f4' : '#f8fafc',
                  color: groupPreset === p.id ? 'var(--primary)' : '#475569',
                  cursor: 'pointer', transition: 'all 0.15s ease',
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem'
                }}
              >
                <p.icon size={14} /> {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Checkbox Dimension Toggles */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap',
          backgroundColor: '#f8fafc', padding: '0.75rem 1.25rem', borderRadius: '12px',
          border: '1px solid #e2e8f0'
        }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '900', color: '#475569', textTransform: 'uppercase' }}>
            Criterios de Agrupación Activos:
          </span>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: '800', color: '#0f172a', opacity: 0.7, cursor: 'not-allowed' }}>
            <input type="checkbox" checked readOnly style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }} />
            <span>Referencia / Producto</span>
          </label>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: '800', color: '#0f172a', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={groupByColor}
              onChange={e => {
                setGroupByColor(e.target.checked);
                setGroupPreset('custom');
              }}
              style={{ accentColor: 'var(--primary)', width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <span>Discriminar por Color</span>
          </label>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: '800', color: '#0f172a', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={groupBySize}
              onChange={e => {
                setGroupBySize(e.target.checked);
                setGroupPreset('custom');
              }}
              style={{ accentColor: 'var(--primary)', width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <span>Discriminar por Talla</span>
          </label>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: '800', color: '#0f172a', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={groupByWarehouse}
              onChange={e => {
                setGroupByWarehouse(e.target.checked);
                setGroupPreset('custom');
              }}
              style={{ accentColor: 'var(--primary)', width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <span>Discriminar por Bodega</span>
          </label>

          <button
            onClick={handleExportCSV}
            className="btn btn-primary"
            style={{
              marginLeft: 'auto', padding: '0.45rem 1.1rem', fontSize: '0.78rem', fontWeight: '900', borderRadius: '8px',
              backgroundColor: '#059669', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem'
            }}
          >
            <Download size={14} /> Exportar Vista Actual (CSV)
          </button>
        </div>

      </div>

      {/* Executive KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
        {[
          { label: 'Grupos / Filas Consolidadas', value: `${totalUniqueRows.toLocaleString()} grupos`, subText: groupPreset === 'product_only' ? 'Total por Referencia' : 'Según filtro activo', color: 'var(--primary)', icon: PackageCheck },
          { label: 'Total Prendas Disponibles', value: `${totalGarmentsSum.toLocaleString()} uds`, subText: 'Suma de existencias', color: '#10b981', icon: TrendingUp },
          { label: 'Filas Originales Agrupadas', value: `${totalDuplicateRecordsCount.toLocaleString()} filas`, subText: 'Sin repeticiones en pantalla', color: '#6366f1', icon: Layers },
          { label: 'Valor Estimado Vista Actual', value: `$${totalValueSum.toLocaleString('es-CO')}`, subText: 'Calculado a precio venta', color: '#0284c7', icon: CheckCircle2 }
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

      {/* Search & Filter Bar */}
      <div className="card" style={{ padding: '1.25rem', borderRadius: '14px', border: '1px solid #e2e8f0', backgroundColor: 'white', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          
          {/* Search Box */}
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
              Buscar en la Vista Actual
            </label>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Buscar por Referencia, Nombre, Color, Talla, Categoría..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.85rem 0.65rem 2.4rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', fontWeight: '600' }}
              />
            </div>
          </div>

          {/* Warehouse Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
              Filtrar Bodega
            </label>
            <select
              value={selectedWarehouse}
              onChange={e => setSelectedWarehouse(e.target.value)}
              style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', fontWeight: '700', backgroundColor: 'white' }}
            >
              <option value="all">Todas las Bodegas</option>
              {warehouses.map((w: any) => (
                <option key={w.id} value={w.nombre_bodega || w.id}>{w.nombre_bodega || w.name}</option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
              Filtrar Categoría
            </label>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', fontWeight: '700', backgroundColor: 'white' }}
            >
              <option value="all">Todas las Categorías</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.categoria}>{c.categoria}</option>
              ))}
            </select>
          </div>

          {/* Color Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
              Filtrar Color
            </label>
            <select
              value={selectedColor}
              onChange={e => setSelectedColor(e.target.value)}
              style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', fontWeight: '700', backgroundColor: 'white' }}
            >
              <option value="all">Todos los Colores</option>
              {colors.map((c: any) => (
                <option key={c.id} value={c.nombre_color}>{c.nombre_color}</option>
              ))}
            </select>
          </div>

          {/* Size Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
              Filtrar Talla
            </label>
            <select
              value={selectedSize}
              onChange={e => setSelectedSize(e.target.value)}
              style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', fontWeight: '700', backgroundColor: 'white' }}
            >
              <option value="all">Todas las Tallas</option>
              {sizes.map((s: any) => (
                <option key={s.id} value={s.codigo_talla}>{s.codigo_talla}</option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {/* Dynamic Table */}
      <div className="card" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', backgroundColor: 'white' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem', textAlign: 'left' }}>
            <thead style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', fontWeight: '800', color: '#475569' }}>
              <tr>
                <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase' }}>Referencia</th>
                <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase' }}>Producto</th>
                
                {groupByColor ? (
                  <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase' }}>Color</th>
                ) : (
                  <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase' }}>Colores Incluidos</th>
                )}

                {groupBySize ? (
                  <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase' }}>Talla</th>
                ) : (
                  <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase' }}>Tallas Incluidas</th>
                )}

                {groupByWarehouse ? (
                  <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase' }}>Bodega</th>
                ) : (
                  <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase' }}>Bodegas</th>
                )}

                <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'right' }}>Disponible Consolidado</th>
                <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'right' }}>Reservado</th>
                <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'center' }}>Filas Fusionadas</th>
                <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                    No se encontraron grupos con los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                filteredList.slice(currentPage * 10, (currentPage + 1) * 10).map((item, idx) => {
                  const isExpanded = expandedKey === item.key;
                  const colorsCount = item.uniqueColorsSet.size;
                  const sizesCount = item.uniqueSizesSet.size;
                  const warehousesCount = item.uniqueWarehousesSet.size;
                  const ordersList = Array.from(item.linkedOrders);

                  return (
                    <React.Fragment key={item.key}>
                      <tr style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: isExpanded ? '#f0f9ff' : idx % 2 === 0 ? 'white' : '#fafafa',
                        transition: 'background-color 0.15s ease'
                      }}>
                        <td style={{ padding: '0.9rem 1.25rem', fontWeight: '950', color: 'var(--primary)' }}>
                          {item.productRef}
                        </td>
                        <td style={{ padding: '0.9rem 1.25rem', fontWeight: '800', color: '#0f172a' }}>
                          {item.productName}
                          <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '600' }}>{item.categoryName}</div>
                        </td>

                        {/* Color Column */}
                        <td style={{ padding: '0.9rem 1.25rem' }}>
                          {groupByColor ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: '750', color: '#334155' }}>
                              <span style={{ width: '13px', height: '13px', borderRadius: '50%', backgroundColor: item.hexColor, border: '1px solid #cbd5e1', flexShrink: 0 }} />
                              {item.colorName}
                            </span>
                          ) : (
                            <span style={{ backgroundColor: '#eef2ff', color: '#4338ca', fontWeight: '800', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.75rem', border: '1px solid #c7d2fe' }}>
                              🎨 {colorsCount} color(es) ({Array.from(item.uniqueColorsSet).slice(0, 3).join(', ')}{colorsCount > 3 ? '...' : ''})
                            </span>
                          )}
                        </td>

                        {/* Size Column */}
                        <td style={{ padding: '0.9rem 1.25rem' }}>
                          {groupBySize ? (
                            <span style={{ backgroundColor: '#0f172a', color: 'white', fontWeight: '900', padding: '0.2rem 0.55rem', borderRadius: '5px', fontSize: '0.78rem' }}>
                              {item.sizeCode}
                            </span>
                          ) : (
                            <span style={{ backgroundColor: '#f1f5f9', color: '#334155', fontWeight: '800', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.75rem', border: '1px solid #cbd5e1' }}>
                              🏷️ {sizesCount} talla(s) ({Array.from(item.uniqueSizesSet).join(', ')})
                            </span>
                          )}
                        </td>

                        {/* Warehouse Column */}
                        <td style={{ padding: '0.9rem 1.25rem', fontWeight: '700', color: '#475569' }}>
                          {groupByWarehouse ? (
                            item.warehouseName
                          ) : (
                            <span style={{ fontSize: '0.78rem', color: '#475569' }}>
                              🏬 {Array.from(item.uniqueWarehousesSet).join(', ') || 'Bodega Principal'}
                            </span>
                          )}
                        </td>

                        {/* Quantity */}
                        <td style={{ padding: '0.9rem 1.25rem', textAlign: 'right', fontWeight: '950', fontSize: '1.1rem', color: item.totalDisponible > 0 ? '#059669' : '#94a3b8' }}>
                          {item.totalDisponible.toLocaleString()} uds
                        </td>

                        <td style={{ padding: '0.9rem 1.25rem', textAlign: 'right', color: '#64748b', fontWeight: '700' }}>
                          {item.totalReservado}
                        </td>

                        <td style={{ padding: '0.9rem 1.25rem', textAlign: 'center' }}>
                          <span style={{
                            padding: '0.25rem 0.65rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '850',
                            backgroundColor: item.recordsCount > 1 ? '#ecfdf5' : '#f1f5f9',
                            color: item.recordsCount > 1 ? '#047857' : '#64748b',
                            border: item.recordsCount > 1 ? '1px solid #a7f3d0' : '1px solid #e2e8f0'
                          }}>
                            ⚡ {item.recordsCount} {item.recordsCount === 1 ? 'fila' : 'filas fusionadas'}
                          </span>
                        </td>

                        <td style={{ padding: '0.9rem 1.25rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center', alignItems: 'center' }}>
                            <button
                              onClick={() => setExpandedKey(isExpanded ? null : item.key)}
                              className="btn btn-secondary"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: '800', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              {isExpanded ? 'Ocultar Sub-registros' : `Ver Sub-registros (${item.recordsCount})`}
                            </button>

                            {onOpenUnitDetails && item.items[0] && (
                              <button
                                onClick={() => onOpenUnitDetails(item.items[0])}
                                className="btn"
                                style={{ padding: '0.35rem 0.55rem', fontSize: '0.75rem', border: '1px solid #6366f1', backgroundColor: '#eef2ff', color: '#4338ca', fontWeight: '800', borderRadius: '8px' }}
                                title="Ver códigos de barra individuales"
                              >
                                <Eye size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Sub-row: Individual merged database records */}
                      {isExpanded && (
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                          <td colSpan={9} style={{ padding: '1rem 1.5rem' }}>
                            <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '900', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <Layers size={16} style={{ color: 'var(--primary)' }} />
                                  Detalle Completo de Filas Agrupadas en este Grupo ({item.recordsCount} registros)
                                </h4>
                                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                  Suma Total de este Grupo: <strong>{item.totalDisponible} uds</strong>
                                </span>
                              </div>

                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                                <thead style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', fontWeight: '800', color: '#475569' }}>
                                  <tr>
                                    <th style={{ padding: '0.5rem 0.75rem' }}>ID Stock</th>
                                    <th style={{ padding: '0.5rem 0.75rem' }}>Color</th>
                                    <th style={{ padding: '0.5rem 0.75rem' }}>Talla</th>
                                    <th style={{ padding: '0.5rem 0.75rem' }}>Bodega</th>
                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Disponible</th>
                                    <th style={{ padding: '0.5rem 0.75rem' }}>Acción</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {item.items.map((subItem: any, sIdx: number) => {
                                    const subColor = subItem.colors?.nombre_color || subItem.fabrics?.nombre_tela || '—';
                                    const subSize = subItem.sizes?.codigo_talla || '—';
                                    const subWh = subItem.warehouses?.nombre_bodega || 'Bodega Principal';

                                    return (
                                      <tr key={subItem.id || sIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace', fontWeight: '700', color: '#4f46e5' }}>
                                          {subItem.id ? subItem.id.slice(0, 13) + '...' : '—'}
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: '#334155' }}>
                                          {subColor}
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: '800' }}>
                                          {subSize}
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem', color: '#64748b' }}>
                                          {subWh}
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '900', color: '#059669' }}>
                                          {subItem.cantidad_disponible} uds
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem' }}>
                                          {onOpenAdjustment && (
                                            <button
                                              onClick={() => onOpenAdjustment(subItem)}
                                              className="btn btn-secondary"
                                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', fontWeight: '800' }}
                                            >
                                              Ajustar Fila
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filteredList.length > 10 && (
          <div style={{ padding: '0.85rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>
              Mostrando {currentPage * 10 + 1} - {Math.min((currentPage + 1) * 10, filteredList.length)} de {filteredList.length} grupos
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: currentPage === 0 ? '#f1f5f9' : 'white', color: '#334155', cursor: currentPage === 0 ? 'not-allowed' : 'pointer', fontSize: '0.75rem', fontWeight: '700' }}
              >
                Anterior
              </button>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', padding: '0 0.25rem' }}>
                Pág. {currentPage + 1} de {Math.ceil(filteredList.length / 10)}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredList.length / 10) - 1, p + 1))}
                disabled={(currentPage + 1) * 10 >= filteredList.length}
                style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: (currentPage + 1) * 10 >= filteredList.length ? '#f1f5f9' : 'white', color: '#334155', cursor: (currentPage + 1) * 10 >= filteredList.length ? 'not-allowed' : 'pointer', fontSize: '0.75rem', fontWeight: '700' }}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
