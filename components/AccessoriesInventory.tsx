'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Tag, Search, Plus, Loader2, ArrowUpRight, ArrowDownLeft,
  AlertTriangle, RefreshCw, Box, Layers, Filter, CheckCircle2
} from 'lucide-react';

interface Accessory {
  id: string;
  codigo?: string;
  nombre: string;
  tipo?: string;
  unidad_medida?: string;
  costo_unitario?: number;
  stock_actual?: number;
  stock_minimo?: number;
}

interface ProductAccessoryRelation {
  id: string;
  product_id: string;
  accessory_id: string;
  cantidad: number;
  products?: { nombre_producto: string; codigo_referencia?: string };
  accessories?: { nombre: string; unidad_medida?: string };
}

interface ConsumedAccessory {
  accessory_id: string;
  nombre: string;
  codigo?: string;
  unidad_medida?: string;
  cantidad_por_prenda: number;
  total_despachado: number;
  total_confeccionado: number;
  productos_asociados: string[];
}

export default function AccessoriesInventory() {
  const [loading, setLoading] = useState(true);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [productAccs, setProductAccs] = useState<ProductAccessoryRelation[]>([]);
  const [sewingAccs, setSewingAccs] = useState<any[]>([]);
  const [sewingOrders, setSewingOrders] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [activeSubTab, setActiveSubTab] = useState<'balance' | 'consumption'>('balance');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { data: accData },
        { data: paData },
        { data: saData },
        { data: soData }
      ] = await Promise.all([
        supabase.from('accessories').select('*').order('nombre'),
        supabase.from('product_accessories').select('*, products(nombre_producto, codigo_referencia), accessories(nombre)'),
        supabase.from('sewing_accessories').select('*, accessories(nombre, unidad_medida)'),
        supabase.from('sewing_orders').select('*, sewing_order_sizes(cantidad_planeada, cantidad_confeccionada)')
      ]);

      setAccessories(accData || []);
      setProductAccs(paData || []);
      setSewingAccs(saData || []);
      setSewingOrders(soData || []);
    } catch (err: any) {
      console.error('Error fetching accessories inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Calculated metrics per accessory ───────────────────────────────────────
  const accessoryStats = accessories.map(acc => {
    // 1. Despachado a confección (sum from sewing_accessories table)
    const despachado = sewingAccs
      .filter(sa => String(sa.accessory_id) === String(acc.id))
      .reduce((sum, sa) => sum + (Number(sa.quantity) || 0), 0);

    // 2. Relaciones con productos (fichas técnicas)
    const rels = productAccs.filter(pa => String(pa.accessory_id) === String(acc.id));
    const productosNombres = Array.from(new Set(rels.map(r => r.products?.nombre_producto).filter(Boolean)));

    // 3. Estimado gastado según prendas confeccionadas aprobadas
    let consumidoEstimado = 0;
    rels.forEach(rel => {
      const cantPorPrenda = Number(rel.cantidad) || 0;
      // Buscar sewing_orders para este producto
      const matchingOrders = sewingOrders.filter(so => String(so.product_id) === String(rel.product_id));
      matchingOrders.forEach(so => {
        const confeccionadas = (so.sewing_order_sizes || []).reduce((s: number, sz: any) => s + (Number(sz.cantidad_confeccionada || sz.cantidad_planeada) || 0), 0);
        consumidoEstimado += (confeccionadas * cantPorPrenda);
      });
    });

    const totalDespachadoOGastado = Math.max(despachado, Math.round(consumidoEstimado));
    const stockActual = acc.stock_actual !== undefined && acc.stock_actual !== null ? acc.stock_actual : 0;
    const stockMinimo = acc.stock_minimo || 50;
    const isLowStock = stockActual > 0 && stockActual <= stockMinimo;
    const isOut = stockActual <= 0 && totalDespachadoOGastado > 0;

    return {
      ...acc,
      despachado,
      consumidoEstimado: Math.round(consumidoEstimado),
      totalDespachadoOGastado,
      productosCount: rels.length,
      productosNombres,
      stockActual,
      stockMinimo,
      isLowStock,
      isOut
    };
  });

  // Unique types
  const typesList = Array.from(new Set(accessories.map(a => a.tipo).filter(Boolean)));

  // Filtered
  const filteredAccessories = accessoryStats.filter(acc => {
    const matchesSearch = !searchQuery || 
      acc.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (acc.codigo && acc.codigo.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (acc.tipo && acc.tipo.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesType = typeFilter === 'all' || acc.tipo === typeFilter;
    return matchesSearch && matchesType;
  });

  // Overall KPIs
  const totalAccTypes = accessories.length;
  const totalUnidadesDespachadas = accessoryStats.reduce((s, a) => s + a.totalDespachadoOGastado, 0);
  const totalStockActual = accessoryStats.reduce((s, a) => s + a.stockActual, 0);
  const totalAlerts = accessoryStats.filter(a => a.isLowStock || a.isOut).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#80082E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Inventario & Materias Primas
          </span>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '950', margin: '0.2rem 0 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Tag size={24} style={{ color: '#80082E' }} /> Inventario de Accesorios, Marquillas y Fornituras
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.2rem 0 0' }}>
            Consulta de insumos asignados por producto, cantidades despachadas a confección y disponibilidades.
          </p>
        </div>

        <button 
          onClick={fetchData} 
          className="btn btn-secondary" 
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: '800' }}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        <div style={{ padding: '1.25rem', borderRadius: '14px', background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Tipos de Insumos</span>
          <div style={{ fontSize: '1.75rem', fontWeight: '950', color: '#0f172a', marginTop: '0.25rem' }}>{totalAccTypes}</div>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Categorizados en maestro</span>
        </div>
        
        <div style={{ padding: '1.25rem', borderRadius: '14px', background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Total Despachado / Gastado</span>
          <div style={{ fontSize: '1.75rem', fontWeight: '950', color: '#2563eb', marginTop: '0.25rem' }}>
            {totalUnidadesDespachadas.toLocaleString('es-CO')}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#3b82f6', fontWeight: '700' }}>En órdenes de confección</span>
        </div>

        <div style={{ padding: '1.25rem', borderRadius: '14px', background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Stock en Bodega</span>
          <div style={{ fontSize: '1.75rem', fontWeight: '950', color: '#16a34a', marginTop: '0.25rem' }}>
            {totalStockActual.toLocaleString('es-CO')}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: '700' }}>Unidades disponibles</span>
        </div>

        <div style={{ padding: '1.25rem', borderRadius: '14px', background: totalAlerts > 0 ? '#fff1f2' : 'white', border: `1px solid ${totalAlerts > 0 ? '#fecdd3' : '#e2e8f0'}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: '800', color: totalAlerts > 0 ? '#be123c' : '#64748b', textTransform: 'uppercase' }}>Alertas de Reorden</span>
          <div style={{ fontSize: '1.75rem', fontWeight: '950', color: totalAlerts > 0 ? '#e11d48' : '#0f172a', marginTop: '0.25rem' }}>{totalAlerts}</div>
          <span style={{ fontSize: '0.72rem', color: totalAlerts > 0 ? '#be123c' : '#94a3b8', fontWeight: '700' }}>
            {totalAlerts > 0 ? 'Requiere reabastecimiento' : 'Niveles normales'}
          </span>
        </div>
      </div>

      {/* Sub Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0' }}>
        {[
          { key: 'balance', label: '📦 Balance e Inventario de Accesorios' },
          { key: 'consumption', label: '📋 Consumo por Ficha Técnica de Producto' }
        ].map(st => (
          <button
            key={st.key}
            onClick={() => setActiveSubTab(st.key as any)}
            style={{
              padding: '0.65rem 1.25rem',
              fontSize: '0.82rem',
              fontWeight: '800',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderBottom: activeSubTab === st.key ? '3px solid #80082E' : '3px solid transparent',
              color: activeSubTab === st.key ? '#80082E' : '#64748b',
              marginBottom: '-2px',
              transition: 'all 0.15s'
            }}
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* Search & Filter Controls */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', backgroundColor: 'white', padding: '1rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Buscar por código, nombre (botón, cremallera, marquilla)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '0.6rem 0.85rem 0.6rem 2.5rem', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '0.83rem', outline: 'none' }}
          />
        </div>

        {typesList.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b' }}>Tipo:</span>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              style={{ padding: '0.55rem 0.85rem', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '0.82rem', fontWeight: '700', outline: 'none' }}
            >
              <option value="all">Todos los tipos</option>
              {typesList.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── SUB TAB 1: BALANCE E INVENTARIO ── */}
      {activeSubTab === 'balance' && (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem' }}>
              <Loader2 className="animate-spin" size={32} color="#80082E" />
            </div>
          ) : filteredAccessories.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>
              <Tag size={40} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p style={{ fontWeight: '700' }}>No se encontraron accesorios en el catálogo.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '0.85rem 1.25rem', fontWeight: '900', fontSize: '0.68rem', textTransform: 'uppercase', color: '#64748b' }}>Código</th>
                    <th style={{ padding: '0.85rem 1.25rem', fontWeight: '900', fontSize: '0.68rem', textTransform: 'uppercase', color: '#64748b' }}>Nombre / Accesorio</th>
                    <th style={{ padding: '0.85rem 1.25rem', fontWeight: '900', fontSize: '0.68rem', textTransform: 'uppercase', color: '#64748b' }}>Tipo</th>
                    <th style={{ padding: '0.85rem 1.25rem', fontWeight: '900', fontSize: '0.68rem', textTransform: 'uppercase', color: '#64748b' }}>Unidad</th>
                    <th style={{ padding: '0.85rem 1.25rem', fontWeight: '900', fontSize: '0.68rem', textTransform: 'uppercase', color: '#64748b', textAlign: 'right' }}>Fichas Técnica</th>
                    <th style={{ padding: '0.85rem 1.25rem', fontWeight: '900', fontSize: '0.68rem', textTransform: 'uppercase', color: '#64748b', textAlign: 'right' }}>Despachado / Gastado</th>
                    <th style={{ padding: '0.85rem 1.25rem', fontWeight: '900', fontSize: '0.68rem', textTransform: 'uppercase', color: '#64748b', textAlign: 'right' }}>Stock Disponible</th>
                    <th style={{ padding: '0.85rem 1.25rem', fontWeight: '900', fontSize: '0.68rem', textTransform: 'uppercase', color: '#64748b', textAlign: 'center' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccessories.map((acc, idx) => (
                    <tr key={acc.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '0.85rem 1.25rem', fontWeight: '900', color: '#80082E', fontFamily: 'monospace' }}>
                        {acc.codigo || '—'}
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <div style={{ fontWeight: '800', color: '#0f172a' }}>{acc.nombre}</div>
                        {acc.productosNombres.length > 0 && (
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                            Usado en: {acc.productosNombres.slice(0, 2).join(', ')}{acc.productosNombres.length > 2 ? ` (+${acc.productosNombres.length - 2} más)` : ''}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: '800', backgroundColor: '#f1f5f9', color: '#475569' }}>
                          {acc.tipo || 'General'}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', color: '#64748b', fontWeight: '700' }}>
                        {acc.unidad_medida || 'Unidad'}
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', fontWeight: '800', color: '#475569' }}>
                        {acc.productosCount} prod.
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', fontWeight: '950', color: '#2563eb', fontSize: '0.9rem' }}>
                        {acc.totalDespachadoOGastado.toLocaleString('es-CO')}
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', fontWeight: '950', color: acc.stockActual > 0 ? '#16a34a' : '#94a3b8', fontSize: '0.9rem' }}>
                        {acc.stockActual.toLocaleString('es-CO')}
                      </td>
                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'center' }}>
                        <span style={{
                          padding: '0.25rem 0.65rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: '900',
                          backgroundColor: acc.isOut ? '#fee2e2' : acc.isLowStock ? '#fef3c7' : '#dcfce7',
                          color: acc.isOut ? '#991b1b' : acc.isLowStock ? '#92400e' : '#166534'
                        }}>
                          {acc.isOut ? 'Agotado' : acc.isLowStock ? 'Bajo Stock' : 'Disponible'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── SUB TAB 2: CONSUMO POR FICHA TÉCNICA ── */}
      {activeSubTab === 'consumption' && (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ margin: 0, fontWeight: '900', color: '#0f172a', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={18} color="#80082E" /> Relación de Insumos por Ficha Técnica de Producto
          </h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
            Esta tabla muestra la cantidad exacta de insumos (botones, remaches, marquillas, fornituras) configurados por cada prenda en su ficha técnica de producción.
          </p>

          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: '900', fontSize: '0.68rem', textTransform: 'uppercase', color: '#64748b' }}>Producto / Referencia</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: '900', fontSize: '0.68rem', textTransform: 'uppercase', color: '#64748b' }}>Accesorio / Insumo</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: '900', fontSize: '0.68rem', textTransform: 'uppercase', color: '#64748b', textAlign: 'right' }}>Cant. por Prenda</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: '900', fontSize: '0.68rem', textTransform: 'uppercase', color: '#64748b', textAlign: 'right' }}>Total Estimado Confeccionado</th>
                </tr>
              </thead>
              <tbody>
                {productAccs.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                      No hay accesorios enlazados a fichas técnicas de producto aún.
                    </td>
                  </tr>
                ) : (
                  productAccs.map((pa, idx) => {
                    const cantPorPrenda = Number(pa.cantidad) || 0;
                    const matchingOrders = sewingOrders.filter(so => String(so.product_id) === String(pa.product_id));
                    const totalConfeccionado = matchingOrders.reduce((sum, so) => {
                      const qty = (so.sewing_order_sizes || []).reduce((s: number, sz: any) => s + (Number(sz.cantidad_confeccionada || sz.cantidad_planeada) || 0), 0);
                      return sum + qty;
                    }, 0);
                    const estimadoTotalGastado = totalConfeccionado * cantPorPrenda;

                    return (
                      <tr key={pa.id || idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: '800', color: '#0f172a' }}>
                          {pa.products?.nombre_producto || '—'}
                          {pa.products?.codigo_referencia && <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: '0.5rem' }}>({pa.products.codigo_referencia})</span>}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: '800', color: '#80082E' }}>
                          {pa.accessories?.nombre || '—'}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: '950', color: '#2563eb' }}>
                          {cantPorPrenda} {pa.accessories?.unidad_medida || 'und'} / prenda
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: '950', color: '#16a34a' }}>
                          {estimadoTotalGastado.toLocaleString('es-CO')} unidades
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

    </div>
  );
}
