'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  PieChart as PieChartIcon,
  Search,
  ArrowUpRight,
  Download,
  Loader2,
  FileSpreadsheet,
  Save,
  Percent,
  Layers,
  Sparkles,
  Edit2
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

export default function CostsPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [fabricsMaster, setFabricsMaster] = useState<any[]>([]);
  const [baseCosts, setBaseCosts] = useState<any[]>([]);
  const [accessories, setAccessories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter
  const [search, setSearch] = useState('');
  
  // Selection
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  
  // Editing state for selected order overrides
  const [customSewingRate, setCustomSewingRate] = useState('');
  const [realLogistics, setRealLogistics] = useState('');
  const [extras, setExtras] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*, fabrics(nombre_tela, costo_unitario, costo_con_iva), workshops(nombre_taller, responsable), cuts(*, cut_sizes(*))')
        .order('created_at', { ascending: false });

      const { data: prodData } = await supabase.from('products').select('*');
      const { data: fabData } = await supabase.from('fabrics').select('*');
      const { data: costsData } = await supabase.from('base_costs').select('*');
      const { data: accData } = await supabase.from('accessories').select('*');

      setOrders(ordersData || []);
      setProducts(prodData || []);
      setFabricsMaster(fabData || []);
      setBaseCosts(costsData || []);
      setAccessories(accData || []);
      
      // Auto select first order if available
      if (ordersData && ordersData.length > 0) {
        handleSelectOrder(ordersData[0]);
      }
    } catch (err: any) {
      console.error('Error fetching costs data:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const getCostsFromJson = (order: any) => {
    if (!order || !order.observaciones) return {};
    const match = order.observaciones.match(/<!--COSTS_JSON:(.*?)-->/);
    if (!match) return {};
    try {
      return JSON.parse(match[1]);
    } catch (e) {
      return {};
    }
  };

  const getAssignmentsFromJson = (order: any) => {
    if (!order || !order.observaciones) return null;
    const match = order.observaciones.match(/<!--ASSIGNMENTS_JSON:(.*?)-->/);
    if (!match) return null;
    try {
      return JSON.parse(match[1]);
    } catch (e) {
      return null;
    }
  };

  const handleSelectOrder = (order: any) => {
    setSelectedOrder(order);
    const overrides = getCostsFromJson(order);
    setCustomSewingRate(overrides.custom_sewing_rate !== undefined ? String(overrides.custom_sewing_rate) : '');
    setRealLogistics(overrides.real_logistics !== undefined ? String(overrides.real_logistics) : '');
    setExtras(overrides.extras !== undefined ? String(overrides.extras) : '');
  };

  const handleSaveOverrides = async () => {
    if (!selectedOrder) return;
    setSaving(true);
    try {
      let obs = selectedOrder.observaciones || '';
      const costsData = {
        custom_sewing_rate: customSewingRate !== '' ? Number(customSewingRate) : undefined,
        real_logistics: realLogistics !== '' ? Number(realLogistics) : undefined,
        extras: extras !== '' ? Number(extras) : undefined
      };

      const costsRegex = /<!--COSTS_JSON:.*?-->/;
      const serialized = `<!--COSTS_JSON:${JSON.stringify(costsData)}-->`;
      
      if (costsRegex.test(obs)) {
        obs = obs.replace(costsRegex, serialized);
      } else {
        obs += '\n' + serialized;
      }

      const { error } = await supabase
        .from('orders')
        .update({ observaciones: obs })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      // Update local state
      const updatedOrder = { ...selectedOrder, observaciones: obs };
      setOrders(prev => prev.map(o => o.id === selectedOrder.id ? updatedOrder : o));
      setSelectedOrder(updatedOrder);
      alert('Costos de la orden guardados correctamente.');
    } catch (err: any) {
      alert('Error al guardar costos: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Helper calculations
  const getTotalPrendas = (order: any) => {
    if (!order.cuts) return order.capas_proyectadas || 0;
    return order.cuts.reduce((sum: number, c: any) => {
      const layersProyec = c.layers || 1;
      const layersProduced = c.layers_produced || 0;
      return sum + (c.cut_sizes || []).reduce((s: number, cs: any) => {
        const qty = Number(cs.quantity) || 0;
        const ppc = qty / layersProyec;
        return s + Math.round(ppc * (layersProduced || layersProyec));
      }, 0);
    }, 0);
  };

  const calculateOrderCosts = (order: any) => {
    if (!order) return { 
      real: { fabric: 0, sewing: 0, logistics: 0, accessories: 0, extras: 0, total: 0 }, 
      estimated: { fabric: 0, sewing: 0, logistics: 0, accessories: 0, total: 0 }, 
      merma: 0,
      retailValue: 0,
      units: 0,
      totalProjectedMeters: 0,
      totalCutMeters: 0
    };

    const overrides = getCostsFromJson(order);
    const assignments = getAssignmentsFromJson(order);

    // 1. Fabric Cost & Meters
    let realFabricCost = 0;
    let estFabricCost = 0;
    let mermaCost = 0;
    let totalProjectedMeters = 0;
    let totalCutMeters = 0;

    if (order.cuts) {
      // Group cuts by fabric_id + color_id
      const fabricColorKeys = new Set<string>();
      order.cuts.forEach((c: any) => {
        if (!c.fabric_id) return;
        fabricColorKeys.add(`${c.fabric_id}_${c.color_id || 'none'}`);
      });

      fabricColorKeys.forEach(key => {
        const [fabricId, colorIdStr] = key.split('_');
        const colorId = colorIdStr === 'none' ? null : colorIdStr;

        const matchingCuts = order.cuts.filter((c: any) => 
          String(c.fabric_id) === fabricId && 
          String(c.color_id || 'none') === (colorId || 'none')
        );

        const fabric = fabricsMaster.find(f => String(f.id) === fabricId) || order.fabrics;
        const fabricKiloCost = fabric ? (Number(fabric.costo_con_iva) || Number(fabric.costo_unitario) || 0) : 0;
        
        // Convert price per kilo to price per meter: Costo_Metro = Costo_Kilo / Rendimiento_Estimado
        const rendimiento = fabric && Number(fabric.rendimiento_estimado) > 0 ? Number(fabric.rendimiento_estimado) : 3.5;
        const costPerMeter = fabricKiloCost / rendimiento;

        // Group by stroke_length to deduplicate layers (as one stroke group = one tendida)
        const tendidaMap: Record<string, { layers: number; layersProduced: number }> = {};
        matchingCuts.forEach((c: any) => {
          const sKey = String(Number(c.stroke_length) || 0);
          const prev = tendidaMap[sKey];
          const layers = Number(c.layers) || 0;
          const layersProduced = Number(c.layers_produced) || 0;
          if (!prev) {
            tendidaMap[sKey] = { layers, layersProduced };
          } else {
            tendidaMap[sKey] = {
              layers: Math.max(prev.layers, layers),
              layersProduced: Math.max(prev.layersProduced, layersProduced)
            };
          }
        });

        let planeados = 0;
        let reales = 0;
        const hasAnyProgress = matchingCuts.some((c: any) => (Number(c.layers_produced) || 0) > 0);

        Object.entries(tendidaMap).forEach(([strokeKey, { layers, layersProduced }]) => {
          const stroke = Number(strokeKey);
          planeados += stroke * layers;
          const realLayers = hasAnyProgress ? layersProduced : layers;
          reales += stroke * realLayers;
        });

        totalProjectedMeters += planeados;
        totalCutMeters += reales;

        realFabricCost += reales * costPerMeter;
        estFabricCost += planeados * costPerMeter;

        // Add merma cost from any cuts in this group
        matchingCuts.forEach((c: any) => {
          if (Number(c.remaining_kilos) > 0) {
            mermaCost += Number(c.remaining_kilos) * fabricKiloCost;
          }
        });
      });
    }

    // 2. Confeccion Cost (Sewing)
    const units = getTotalPrendas(order);
    const baseSewing = baseCosts.find(c => c.concepto?.toLowerCase() === 'costura')?.valor || 2500;
    const realSewingRate = overrides.custom_sewing_rate !== undefined ? Number(overrides.custom_sewing_rate) : baseSewing;
    
    const realSewingCost = units * realSewingRate;
    const estSewingCost = units * baseSewing;

    // 3. Accessories Cost (Insumos)
    let realAccsCost = 0;
    let estAccsCost = 0;
    if (assignments && assignments.cutAccessories) {
      Object.values(assignments.cutAccessories).forEach((list: any) => {
        list.forEach((ca: any) => {
          const acc = accessories.find(a => a.id === ca.accId);
          const accUnitCost = acc ? (Number(acc.costo_unitario) || 0) : 0;
          realAccsCost += (Number(ca.qty) || 0) * accUnitCost;
          estAccsCost += (Number(ca.qty) || 0) * accUnitCost;
        });
      });
    }

    // 4. Logistics
    const defaultLogistics = baseCosts.find(c => c.concepto?.toLowerCase() === 'logistica')?.valor || 0;
    const realLogisticsCost = overrides.real_logistics !== undefined ? Number(overrides.real_logistics) : defaultLogistics;
    const estLogisticsCost = defaultLogistics;

    // 5. Extras
    const extrasCost = overrides.extras !== undefined ? Number(overrides.extras) : 0;

    const realTotal = realFabricCost + realSewingCost + realAccsCost + realLogisticsCost + extrasCost;
    const estTotal = estFabricCost + estSewingCost + estAccsCost + estLogisticsCost;

    // Estimated Retail Value
    let estRetailValue = 0;
    if (order.cuts) {
      order.cuts.forEach((cut: any) => {
        const prod = products.find(p => p.id === cut.product_id);
        const price = prod ? (Number(prod.precio_con_iva) || Number(prod.precio) || 28000) : 28000;
        
        // Sum sizes * price
        const layersProyec = cut.layers || 1;
        const layersProduced = cut.layers_produced || 0;
        const cutUnits = (cut.cut_sizes || []).reduce((s: number, cs: any) => {
          const qty = Number(cs.quantity) || 0;
          const ppc = qty / layersProyec;
          return s + Math.round(ppc * (layersProduced || layersProyec));
        }, 0);
        
        estRetailValue += cutUnits * price;
      });
    }

    return {
      real: {
        fabric: realFabricCost,
        sewing: realSewingCost,
        accessories: realAccsCost,
        logistics: realLogisticsCost,
        extras: extrasCost,
        total: realTotal
      },
      estimated: {
        fabric: estFabricCost,
        sewing: estSewingCost,
        accessories: estAccsCost,
        logistics: estLogisticsCost,
        total: estTotal
      },
      merma: mermaCost,
      retailValue: estRetailValue || (units * 28000), // Fallback if products not matched
      units,
      totalProjectedMeters,
      totalCutMeters
    };
  };

  // Monthly Metrics Calculation
  const getMonthlyKPIs = () => {
    let monthlyRealTotal = 0;
    let monthlyRetailValue = 0;
    let totalMerma = 0;
    let orderCount = 0;

    orders.forEach(o => {
      const stats = calculateOrderCosts(o);
      monthlyRealTotal += stats.real.total;
      monthlyRetailValue += stats.retailValue;
      totalMerma += stats.merma;
      if (stats.real.total > 0) orderCount++;
    });

    const averageMargin = monthlyRetailValue > 0 
      ? ((monthlyRetailValue - monthlyRealTotal) / monthlyRetailValue) * 100 
      : 0;

    return {
      totalCost: monthlyRealTotal,
      salesValue: monthlyRetailValue,
      margin: averageMargin,
      merma: totalMerma,
      orderCount
    };
  };

  // Historic data for Chart
  const getChartData = () => {
    // Group costs by month of order creation
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const groups: Record<string, { name: string; costo: number; venta: number; orderVal: number }> = {};
    
    // Initialize past 5 months
    const currentMonthIdx = new Date().getMonth();
    for (let i = 4; i >= 0; i--) {
      const idx = (currentMonthIdx - i + 12) % 12;
      groups[idx] = { name: months[idx], costo: 0, venta: 0, orderVal: idx };
    }

    orders.forEach(o => {
      const date = new Date(o.created_at);
      const mIdx = date.getMonth();
      if (groups[mIdx]) {
        const stats = calculateOrderCosts(o);
        groups[mIdx].costo += stats.real.total;
        groups[mIdx].venta += stats.retailValue;
      }
    });

    return Object.values(groups).sort((a, b) => a.orderVal - b.orderVal);
  };

  const filteredOrders = orders.filter(o => {
    const q = search.toLowerCase();
    return (
      (o.internal_code || '').toLowerCase().includes(q) ||
      (o.client_name || '').toLowerCase().includes(q) ||
      (o.status || '').toLowerCase().includes(q)
    );
  });

  const kpis = getMonthlyKPIs();
  const chartData = getChartData();
  const selectedStats = calculateOrderCosts(selectedOrder);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '3rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Módulo Administrativo
          </span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '950', margin: '0.25rem 0 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.5rem', backgroundColor: '#7c3aed', borderRadius: '12px', color: 'white' }}>
              <DollarSign size={24} />
            </div>
            Control de Costos
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Monitorea costos reales frente a estimados, control de mermas e inventarios.
          </p>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
          <Loader2 className="animate-spin" size={36} style={{ color: '#7c3aed' }} />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            <div className="card" style={{ borderLeft: '4px solid #7c3aed' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase' }}>COSTO TOTAL ACUMULADO</p>
                <TrendingUp size={16} style={{ color: '#7c3aed' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.5rem' }}>
                <p style={{ fontSize: '1.6rem', fontWeight: '900', color: '#0f172a' }}>
                  ${kpis.totalCost.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                </p>
              </div>
              <p style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.4rem' }}>
                Costo total real de {kpis.orderCount} órdenes de corte.
              </p>
            </div>

            <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase' }}>PRODUCCIÓN ESTIMADA (VENTA)</p>
                <ArrowUpRight size={16} style={{ color: '#10b981' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.5rem' }}>
                <p style={{ fontSize: '1.6rem', fontWeight: '900', color: '#0f172a' }}>
                  ${kpis.salesValue.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                </p>
              </div>
              <p style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.4rem' }}>
                Valor proyectado basado en precios de lista.
              </p>
            </div>

            <div className="card" style={{ borderLeft: '4px solid #3b82f6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase' }}>MARGEN ESTIMADO</p>
                <Percent size={16} style={{ color: '#3b82f6' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.5rem' }}>
                <p style={{ fontSize: '1.6rem', fontWeight: '900', color: '#0f172a' }}>
                  {kpis.margin.toFixed(1)}%
                </p>
              </div>
              <p style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.4rem' }}>
                Margen bruto promedio sobre producción.
              </p>
            </div>

            <div className="card" style={{ borderLeft: '4px solid #ef4444' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase' }}>VALOR TOTAL DE MERMA</p>
                <TrendingDown size={16} style={{ color: '#ef4444' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.5rem' }}>
                <p style={{ fontSize: '1.6rem', fontWeight: '900', color: '#0f172a' }}>
                  ${kpis.merma.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                </p>
              </div>
              <p style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.4rem' }}>
                Pérdida valorizada de remanentes/sobrantes de tela.
              </p>
            </div>
          </div>

          {/* Main Visuals & Details layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr', gap: '1.5rem', alignItems: 'start' }}>
            
            {/* Left Column: Chart & Table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Recharts Historical Area Chart */}
              <div className="card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '900', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <PieChartIcon size={18} style={{ color: '#7c3aed' }} />
                  Histórico de Costos de Producción vs Ventas Estimadas
                </h3>
                <div style={{ height: '280px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorVenta" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorCosto" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(val) => `$${(val / 1e6).toFixed(1)}M`} />
                      <Tooltip formatter={(value: any) => [`$${value.toLocaleString()}`, '']} />
                      <Area type="monotone" name="Ventas Proyectadas" dataKey="venta" stroke="#7c3aed" fillOpacity={1} fill="url(#colorVenta)" strokeWidth={3} />
                      <Area type="monotone" name="Costos Reales" dataKey="costo" stroke="#94a3b8" fillOpacity={1} fill="url(#colorCosto)" strokeWidth={2} strokeDasharray="4 4" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Orders List Table */}
              <div className="card" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: '900', color: '#0f172a' }}>Órdenes de Corte (OC)</h3>
                  <div style={{ position: 'relative', width: '250px' }}>
                    <Search size={15} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Buscar orden o cliente..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem 1rem 0.5rem 2.25rem', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '0.8rem' }}
                    />
                  </div>
                </div>

                <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid var(--border)', position: 'sticky', top: 0, zIndex: 1 }}>
                        {['Código OC', 'Cliente', 'Unidades', 'Costo Real', 'Costo Est.', 'Estado'].map(h => (
                          <th key={h} style={{ padding: '0.75rem 1.25rem', fontSize: '0.65rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', textAlign: 'left' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map(o => {
                        const stats = calculateOrderCosts(o);
                        const isSelected = selectedOrder?.id === o.id;
                        
                        return (
                          <tr 
                            key={o.id} 
                            onClick={() => handleSelectOrder(o)}
                            style={{ 
                              borderBottom: '1px solid var(--border)', 
                              cursor: 'pointer',
                              backgroundColor: isSelected ? '#f5f3ff' : 'white',
                              transition: 'background-color 0.2s'
                            }}
                            className="table-row-hover"
                          >
                            <td style={{ padding: '0.875rem 1.25rem', fontWeight: '900', color: '#7c3aed', fontSize: '0.85rem' }}>
                              OC-{o.internal_code}
                            </td>
                            <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.82rem', color: '#1e293b' }}>
                              {o.client_name || 'Sin Cliente'}
                            </td>
                            <td style={{ padding: '0.875rem 1.25rem', fontWeight: '700', fontSize: '0.82rem' }}>
                              {stats.units} uds
                            </td>
                            <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.82rem', fontWeight: '700', color: '#0f172a' }}>
                              ${stats.real.total.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                            </td>
                            <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.82rem', color: '#64748b' }}>
                              ${stats.estimated.total.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                            </td>
                            <td style={{ padding: '0.875rem 1.25rem' }}>
                              <span style={{ 
                                padding: '0.25rem 0.5rem', 
                                borderRadius: '6px', 
                                fontSize: '0.62rem', 
                                fontWeight: '800',
                                backgroundColor: o.status === 'En Confección' ? '#eff6ff' : o.status === 'Terminada' ? '#f0fdf4' : '#fffbeb',
                                color: o.status === 'En Confección' ? '#2563eb' : o.status === 'Terminada' ? '#16a34a' : '#d97706'
                              }}>
                                {o.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Column: Cost Breakdown & Custom Editor */}
            <div className="card" style={{ padding: '1.5rem', position: 'sticky', top: '20px' }}>
              {selectedOrder ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#7c3aed', textTransform: 'uppercase' }}>Ficha de Costos</span>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '950', color: '#0f172a', margin: '0.15rem 0' }}>OC-{selectedOrder.internal_code}</h2>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cliente: <strong>{selectedOrder.client_name}</strong></p>
                  </div>

                  <hr style={{ border: 0, borderTop: '1px solid #e2e8f0' }} />

                  {/* Rendimiento y Metraje (Tela) */}
                  <div style={{ backgroundColor: '#f8fafc', padding: '0.875rem', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.4rem', border: '1px dashed #cbd5e1' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>Metraje de Tela (Proyectado vs Cortado)</span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ color: '#64748b' }}>Metros Proyectados:</span>
                      <strong style={{ color: '#1e293b' }}>{selectedStats.totalProjectedMeters.toFixed(2)} m</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ color: '#64748b' }}>Metros Cortados Reales:</span>
                      <strong style={{ color: '#7c3aed' }}>{selectedStats.totalCutMeters.toFixed(2)} m</strong>
                    </div>
                  </div>

                  <hr style={{ border: 0, borderTop: '1px solid #e2e8f0' }} />

                  {/* Desglose de Costos Reales vs Estimados */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <h4 style={{ fontSize: '0.75rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Desglose de Costos</h4>
                    
                    {[
                      { label: 'Tela Consumida', real: selectedStats.real.fabric, est: selectedStats.estimated.fabric, color: '#7c3aed' },
                      { label: 'Taller Confección', real: selectedStats.real.sewing, est: selectedStats.estimated.sewing, color: '#3b82f6' },
                      { label: 'Accesorios / Insumos', real: selectedStats.real.accessories, est: selectedStats.estimated.accessories, color: '#10b981' },
                      { label: 'Transporte / Logística', real: selectedStats.real.logistics, est: selectedStats.estimated.logistics, color: '#f59e0b' },
                      { label: 'Costos Extras', real: selectedStats.real.extras, est: 0, color: '#ec4899' }
                    ].map((item, idx) => (
                      <div key={idx} style={{ padding: '0.5rem 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontWeight: '600', color: '#1e293b' }}>{item.label}</span>
                          <span style={{ fontWeight: '700', color: '#0f172a' }}>
                            ${item.real.toLocaleString()} 
                            {item.est > 0 && (
                              <span style={{ fontWeight: '400', color: '#64748b', fontSize: '0.7rem', marginLeft: '0.25rem' }}>
                                (est: ${item.est.toLocaleString()})
                              </span>
                            )}
                          </span>
                        </div>
                        <div style={{ height: '4px', backgroundColor: '#f1f5f9', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ 
                            width: `${selectedStats.real.total > 0 ? (item.real / selectedStats.real.total) * 100 : 0}%`, 
                            height: '100%', 
                            backgroundColor: item.color 
                          }}></div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ backgroundColor: '#f5f3ff', padding: '1rem', borderRadius: '12px', marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#7c3aed' }}>COSTO TOTAL REAL</span>
                      <span style={{ fontSize: '1.2rem', fontWeight: '950', color: '#7c3aed' }}>
                        ${selectedStats.real.total.toLocaleString()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem', fontSize: '0.7rem', color: '#64748b' }}>
                      <span>Costo Unitario Real:</span>
                      <strong>
                        ${selectedStats.units > 0 ? Math.round(selectedStats.real.total / selectedStats.units).toLocaleString() : 0} / unidad
                      </strong>
                    </div>
                  </div>

                  <hr style={{ border: 0, borderTop: '1px solid #e2e8f0' }} />

                  {/* Overrides form */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <h4 style={{ fontSize: '0.75rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Edit2 size={12} />
                      Ajustar Costos Reales
                    </h4>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <label style={{ fontSize: '0.7rem', fontWeight: '700', color: '#475569' }}>TARIFA COSTURA POR PRENDA ($)</label>
                      <input
                        type="number"
                        placeholder="Ej: 2800"
                        value={customSewingRate}
                        onChange={e => setCustomSewingRate(e.target.value)}
                        style={{ padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1.5px solid var(--border)', fontSize: '0.8rem' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <label style={{ fontSize: '0.7rem', fontWeight: '700', color: '#475569' }}>COSTO DE TRANSPORTE / LOGÍSTICA ($)</label>
                      <input
                        type="number"
                        placeholder="Ej: 45000"
                        value={realLogistics}
                        onChange={e => setRealLogistics(e.target.value)}
                        style={{ padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1.5px solid var(--border)', fontSize: '0.8rem' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <label style={{ fontSize: '0.7rem', fontWeight: '700', color: '#475569' }}>COSTOS EXTRAS ($)</label>
                      <input
                        type="number"
                        placeholder="Ej: 15000"
                        value={extras}
                        onChange={e => setExtras(e.target.value)}
                        style={{ padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1.5px solid var(--border)', fontSize: '0.8rem' }}
                      />
                    </div>

                    <button
                      className="btn btn-primary"
                      onClick={handleSaveOverrides}
                      disabled={saving}
                      style={{ 
                        marginTop: '0.5rem', 
                        backgroundColor: '#7c3aed', 
                        borderColor: '#7c3aed',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '0.5rem',
                        fontSize: '0.8rem',
                        fontWeight: '800',
                        padding: '0.6rem'
                      }}
                    >
                      {saving ? (
                        <Loader2 className="animate-spin" size={15} />
                      ) : (
                        <Save size={15} />
                      )}
                      Guardar Costos
                    </button>
                  </div>

                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                  <Layers size={36} style={{ margin: 'auto', marginBottom: '0.75rem', opacity: 0.5 }} />
                  <p style={{ fontSize: '0.85rem' }}>Selecciona una orden de la lista para ver su desglose e ingresar costos reales.</p>
                </div>
              )}
            </div>

          </div>
        </>
      )}

    </div>
  );
}
