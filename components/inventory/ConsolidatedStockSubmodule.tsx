import React, { useState, useMemo } from 'react';
import {
  PackageCheck, Search, Filter, Download, Layers, Eye, RefreshCw,
  AlertTriangle, TrendingUp, CheckCircle2, Package, ChevronDown, ChevronUp, Layers3
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
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // Grouping stock by unique SKU: Product + Color + Size + Warehouse
  const consolidatedList = useMemo(() => {
    const map: Record<string, {
      key: string;
      productId: string | null;
      productRef: string;
      productName: string;
      categoryName: string;
      price: number;
      colorId: string | null;
      colorName: string;
      hexColor: string;
      sizeId: string | null;
      sizeCode: string;
      warehouseId: string | null;
      warehouseName: string;
      totalDisponible: number;
      totalReservado: number;
      totalEnTransito: number;
      stockMinimo: number;
      stockMaximo: number;
      recordsCount: number;
      items: any[];
      linkedOrders: Set<string>;
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
      const warehouseId = item.warehouse_id || item.warehouses?.id || 'main';

      // Unique Grouping Key: Reference/Name + Color + Size + Warehouse
      const refNorm = productRef.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const colorNorm = colorName.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const sizeNorm = sizeCode.toUpperCase();
      const whNorm = warehouseName.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      const groupKey = `${refNorm}___${colorNorm}___${sizeNorm}___${whNorm}`;

      if (!map[groupKey]) {
        map[groupKey] = {
          key: groupKey,
          productId: item.product_id || null,
          productRef,
          productName,
          categoryName,
          price,
          colorId: item.color_id || null,
          colorName,
          hexColor: hexColor || '#94a3b8',
          sizeId: item.size_id || null,
          sizeCode,
          warehouseId,
          warehouseName,
          totalDisponible: 0,
          totalReservado: 0,
          totalEnTransito: 0,
          stockMinimo: item.stock_minimo || 0,
          stockMaximo: item.stock_maximo || 0,
          recordsCount: 0,
          items: [],
          linkedOrders: new Set()
        };
      }

      map[groupKey].totalDisponible += Number(item.cantidad_disponible || 0);
      map[groupKey].totalReservado += Number(item.cantidad_reservada || 0);
      map[groupKey].totalEnTransito += Number(item.cantidad_en_transito || 0);
      map[groupKey].recordsCount += 1;
      map[groupKey].items.push(item);

      // Check linked order
      const stockKey = `${item.product_id}_${item.color_id || 'null'}_${item.size_id}_${item.warehouse_id}`;
      const refKey = `${productName.toUpperCase()}___${colorName.toUpperCase()}___${sizeCode.toUpperCase()}`;
      const linkedOrder = stockOrderMap[refKey] || stockOrderMap[stockKey];
      if (linkedOrder && linkedOrder !== '—') {
        map[groupKey].linkedOrders.add(linkedOrder);
      }
    });

    return Object.values(map);
  }, [stock, colors, stockOrderMap]);

  // Filtered List
  const filteredList = useMemo(() => {
    return consolidatedList.filter(item => {
      // Warehouse filter
      if (selectedWarehouse !== 'all') {
        const whName = item.warehouseName.toLowerCase();
        const selWh = selectedWarehouse.toLowerCase();
        if (!whName.includes(selWh) && item.warehouseId !== selectedWarehouse) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory !== 'all' && item.categoryName.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }

      // Color filter
      if (selectedColor !== 'all' && item.colorName.toLowerCase() !== selectedColor.toLowerCase()) {
        return false;
      }

      // Size filter
      if (selectedSize !== 'all' && item.sizeCode.toLowerCase() !== selectedSize.toLowerCase()) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const term = searchQuery.trim().toLowerCase();
        const matchesRef = item.productRef.toLowerCase().includes(term);
        const matchesName = item.productName.toLowerCase().includes(term);
        const matchesColor = item.colorName.toLowerCase().includes(term);
        const matchesSize = item.sizeCode.toLowerCase().includes(term);
        const matchesCat = item.categoryName.toLowerCase().includes(term);
        const matchesWh = item.warehouseName.toLowerCase().includes(term);

        if (!matchesRef && !matchesName && !matchesColor && !matchesSize && !matchesCat && !matchesWh) {
          return false;
        }
      }

      return true;
    });
  }, [consolidatedList, selectedWarehouse, selectedCategory, selectedColor, selectedSize, searchQuery]);

  // KPIs
  const totalUniqueSKUs = filteredList.length;
  const totalGarmentsSum = filteredList.reduce((sum, item) => sum + item.totalDisponible, 0);
  const totalDuplicateRecordsCount = filteredList.reduce((sum, item) => sum + item.recordsCount, 0);
  const totalValueSum = filteredList.reduce((sum, item) => sum + (item.totalDisponible * item.price), 0);

  // Export CSV
  const handleExportCSV = () => {
    if (filteredList.length === 0) return alert('No hay datos para exportar.');

    const BOM = '\uFEFF';
    const headers = [
      'Referencia', 'Nombre Producto', 'Categoría', 'Color', 'Talla',
      'Bodega', 'Disponible Consolidado', 'Reservado', 'En Tránsito',
      'Registros Fusionados', 'Ordenes Vinculadas', 'Valor Estimado'
    ];

    const rows = filteredList.map(item => {
      const ordersStr = Array.from(item.linkedOrders).join(', ') || '—';
      const estimatedVal = item.totalDisponible * item.price;
      return [
        item.productRef,
        item.productName,
        item.categoryName,
        item.colorName,
        item.sizeCode,
        item.warehouseName,
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
    link.setAttribute('download', `inventario_consolidado_sku_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
      {/* Executive Info Banner */}
      <div style={{
        backgroundColor: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '14px',
        padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ padding: '0.65rem', backgroundColor: '#dbeafe', color: '#1e40af', borderRadius: '12px' }}>
            <Layers3 size={24} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '950', color: '#1e3a8a' }}>
              Inventario Consolidado por SKU (Sin Repeticiones)
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: '#3b82f6' }}>
              Fusiona automáticamente todas las existencias repetidas que comparten la misma <strong>Referencia + Color + Talla + Bodega</strong>.
            </p>
          </div>
        </div>

        <button
          onClick={handleExportCSV}
          className="btn btn-primary"
          style={{
            padding: '0.6rem 1.25rem', fontSize: '0.82rem', fontWeight: '900', borderRadius: '10px',
            backgroundColor: '#059669', border: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem'
          }}
        >
          <Download size={16} /> Exportar Excel Consolidado
        </button>
      </div>

      {/* Executive KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
        {[
          { label: 'Combinaciones Únicas (SKUs)', value: `${totalUniqueSKUs.toLocaleString()} SKUs`, subText: 'Sin duplicaciones', color: 'var(--primary)', icon: PackageCheck },
          { label: 'Total Prendas Disponibles', value: `${totalGarmentsSum.toLocaleString()} uds`, subText: 'Suma consolidada total', color: '#10b981', icon: TrendingUp },
          { label: 'Filas / Registros Fusionados', value: `${totalDuplicateRecordsCount.toLocaleString()} filas`, subText: 'Agrupadas en vista limpia', color: '#6366f1', icon: Layers },
          { label: 'Valor Total Consolidado', value: `$${totalValueSum.toLocaleString('es-CO')}`, subText: 'A precio de venta', color: '#0284c7', icon: CheckCircle2 }
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

      {/* Filters Bar */}
      <div className="card" style={{ padding: '1.25rem', borderRadius: '14px', border: '1px solid #e2e8f0', backgroundColor: 'white', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          
          {/* Search Box */}
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
              Buscar Referencia / Producto / Color / Talla
            </label>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Ej. CAM-001, Noah Premium, Azul, LXL..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.85rem 0.65rem 2.4rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', fontWeight: '600' }}
              />
            </div>
          </div>

          {/* Warehouse Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
              Bodega
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
              Categoría
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
              Color
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
              Talla
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

      {/* Consolidated Table */}
      <div className="card" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', backgroundColor: 'white' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem', textAlign: 'left' }}>
            <thead style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', fontWeight: '800', color: '#475569' }}>
              <tr>
                <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase' }}>Referencia</th>
                <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase' }}>Producto</th>
                <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase' }}>Color</th>
                <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase' }}>Talla</th>
                <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase' }}>Bodega</th>
                <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'right' }}>Disponible</th>
                <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'right' }}>Reservado</th>
                <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'center' }}>Registros Fusionados</th>
                <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'center' }}>Ordenes Vinculadas</th>
                <th style={{ padding: '0.9rem 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                    No se encontraron combinaciones de prendas con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredList.map((item, idx) => {
                  const isExpanded = expandedKey === item.key;
                  const isCritical = item.totalDisponible <= item.stockMinimo && item.stockMinimo > 0;
                  const isOver = item.totalDisponible >= item.stockMaximo && item.stockMaximo > 0;
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
                        </td>
                        <td style={{ padding: '0.9rem 1.25rem' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: '750', color: '#334155' }}>
                            <span style={{ width: '13px', height: '13px', borderRadius: '50%', backgroundColor: item.hexColor, border: '1px solid #cbd5e1', flexShrink: 0 }} />
                            {item.colorName}
                          </span>
                        </td>
                        <td style={{ padding: '0.9rem 1.25rem' }}>
                          <span style={{ backgroundColor: '#0f172a', color: 'white', fontWeight: '900', padding: '0.2rem 0.55rem', borderRadius: '5px', fontSize: '0.78rem' }}>
                            {item.sizeCode}
                          </span>
                        </td>
                        <td style={{ padding: '0.9rem 1.25rem', fontWeight: '700', color: '#475569' }}>
                          {item.warehouseName}
                        </td>
                        <td style={{ padding: '0.9rem 1.25rem', textAlign: 'right', fontWeight: '950', fontSize: '1.05rem', color: item.totalDisponible > 0 ? '#059669' : '#94a3b8' }}>
                          {item.totalDisponible.toLocaleString()} uds
                        </td>
                        <td style={{ padding: '0.9rem 1.25rem', textAlign: 'right', color: '#64748b', fontWeight: '700' }}>
                          {item.totalReservado}
                        </td>
                        <td style={{ padding: '0.9rem 1.25rem', textAlign: 'center' }}>
                          <span style={{
                            padding: '0.25rem 0.65rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '850',
                            backgroundColor: item.recordsCount > 1 ? '#eef2ff' : '#f1f5f9',
                            color: item.recordsCount > 1 ? '#4338ca' : '#64748b',
                            border: item.recordsCount > 1 ? '1px solid #c7d2fe' : '1px solid #e2e8f0'
                          }}>
                            {item.recordsCount > 1 ? `⚡ ${item.recordsCount} filas fusionadas` : `1 registro`}
                          </span>
                        </td>
                        <td style={{ padding: '0.9rem 1.25rem', textAlign: 'center' }}>
                          {ordersList.length > 0 ? (
                            <span style={{ backgroundColor: '#fdf2f4', color: '#80082E', fontWeight: '850', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.75rem', border: '1px solid #fecdd3' }}>
                              📦 {ordersList.join(', ')}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '0.9rem 1.25rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center', alignItems: 'center' }}>
                            <button
                              onClick={() => setExpandedKey(isExpanded ? null : item.key)}
                              className="btn btn-secondary"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', fontWeight: '800', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              {isExpanded ? 'Ocultar' : `Ver Detalle (${item.recordsCount})`}
                            </button>

                            {onOpenUnitDetails && item.items[0] && (
                              <button
                                onClick={() => onOpenUnitDetails(item.items[0])}
                                className="btn"
                                style={{ padding: '0.35rem 0.55rem', fontSize: '0.75rem', border: '1px solid #6366f1', backgroundColor: '#eef2ff', color: '#4338ca', fontWeight: '800', borderRadius: '8px' }}
                                title="Ver códigos individuales"
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
                          <td colSpan={10} style={{ padding: '1rem 1.5rem' }}>
                            <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '900', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <Layers size={16} style={{ color: 'var(--primary)' }} />
                                  Desglose de Registros Originales Fusionados ({item.recordsCount} filas de inventario)
                                </h4>
                                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                  Suma Total: <strong>{item.totalDisponible} uds</strong>
                                </span>
                              </div>

                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                                <thead style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', fontWeight: '800', color: '#475569' }}>
                                  <tr>
                                    <th style={{ padding: '0.5rem 0.75rem' }}>ID Stock</th>
                                    <th style={{ padding: '0.5rem 0.75rem' }}>Bodega de Origen</th>
                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Disponible</th>
                                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Reservado</th>
                                    <th style={{ padding: '0.5rem 0.75rem' }}>Acción</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {item.items.map((subItem: any, sIdx: number) => (
                                    <tr key={subItem.id || sIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                      <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace', fontWeight: '700', color: '#4f46e5' }}>
                                        {subItem.id ? subItem.id.slice(0, 13) + '...' : '—'}
                                      </td>
                                      <td style={{ padding: '0.5rem 0.75rem', color: '#334155' }}>
                                        {subItem.warehouses?.nombre_bodega || item.warehouseName}
                                      </td>
                                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '900', color: '#059669' }}>
                                        {subItem.cantidad_disponible} uds
                                      </td>
                                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: '#64748b' }}>
                                        {subItem.cantidad_reservada || 0}
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
                                  ))}
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
      </div>

    </div>
  );
}
