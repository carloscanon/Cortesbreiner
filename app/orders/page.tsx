'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Plus, Search, Trash2, X, Loader2, AlertTriangle, 
  Scissors, Layers, Info, ArrowRight, Factory, Droplets, Printer,
  ChevronRight, Package, Palette, Activity, CheckCircle, Code
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function OrdersPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState('all'); 
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const router = useRouter();
  
  // Form State
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<any>({
    client_name: '',
    brand: '',
    product_id: '',
    factura_relacionada: '',
    workshop_id: '',
    status: 'Planeada',
    priority: 'Media',
    order_type: 'corte',
    internal_code: '',
    cortador_name: '',
    observaciones: '',
    scheduled_date: new Date().toISOString().split('T')[0]
  });

  // Step 2 Matrix State
  const [matrixCols, setMatrixCols] = useState<any[]>([{ id: Date.now(), product_id: '', size1_id: '', size2_id: '', marker1: '1', marker2: '1' }]);
  const [matrixCells, setMatrixCells] = useState<Record<string, number>>({});
  const [longitud, setLongitud] = useState<number>(1);

  const handleLongitudChange = (valStr: string) => {
    const val = Number(valStr) || 1;
    setLongitud(val);
    
    // Re-fill/re-calculate all matrix cells using the new longitud
    setMatrixCells(prev => {
      const newCells = { ...prev };
      fabricColors.forEach(fc => {
        if ((fc.fabric_id || fc.nombre_tela) && Number(fc.layers) > 0) {
          matrixCols.forEach(col => {
            const m1 = col.marker1 === '' ? 1 : Number(col.marker1);
            const m2 = col.marker2 === '' ? 1 : Number(col.marker2);
            newCells[`${fc.id}_${col.id}_1`] = Math.round(((Number(fc.layers) || 0) * m1) / val);
            newCells[`${fc.id}_${col.id}_2`] = Math.round(((Number(fc.layers) || 0) * m2) / val);
          });
        }
      });
      return newCells;
    });
  };

  const addMatrixCol = () => {
    if (matrixCols.length < 8) {
      setMatrixCols([...matrixCols, { id: Date.now(), product_id: '', size1_id: '', size2_id: '', marker1: '1', marker2: '1' }]);
    }
  };
  
  const removeMatrixCol = (id: number) => {
    setMatrixCols(matrixCols.filter(c => c.id !== id));
  };
  
  const updateMatrixCol = (id: number, field: string, value: string) => {
    setMatrixCols(matrixCols.map(c => c.id === id ? { ...c, [field]: value } : c));
    
    // Auto-calculate quantities if marker changes
    if (field === 'marker1' || field === 'marker2') {
      const sizeIndex = field === 'marker1' ? 1 : 2;
      const markerVal = value === '' ? 1 : Number(value);
      setMatrixCells(prev => {
        const newCells = { ...prev };
        fabricColors.forEach(fc => {
          if ((fc.fabric_id || fc.nombre_tela) && Number(fc.layers) > 0) {
            const key = `${fc.id}_${id}_${sizeIndex}`;
            newCells[key] = Math.round(((Number(fc.layers) || 0) * markerVal) / (longitud || 1));
          }
        });
        return newCells;
      });
    }
  };
  
  const updateMatrixCell = (fabricColorId: number, colId: number, sizeIndex: number, value: string) => {
    const key = `${fabricColorId}_${colId}_${sizeIndex}`;
    setMatrixCells({ ...matrixCells, [key]: Number(value) || 0 });
  };

  // Calculated Consumo / Prenda based on longitud and matrixCols
  const totalActiveSizes = matrixCols.reduce((acc, col) => {
    let count = 0;
    if (col.size1_id && (Number(col.marker1) || 0) >= 1) count++;
    if (col.size2_id && (Number(col.marker2) || 0) >= 1) count++;
    return acc + count;
  }, 0);

  const totalTallasMarcacionMayorA1 = matrixCols.reduce((acc, col) => {
    let count = 0;
    if (col.size1_id && (Number(col.marker1) || 0) > 1) count++;
    if (col.size2_id && (Number(col.marker2) || 0) > 1) count++;
    return acc + count;
  }, 0);

  const divisorConsumo = totalTallasMarcacionMayorA1 > 0 ? totalTallasMarcacionMayorA1 : totalActiveSizes;
  const consumoPrenda = divisorConsumo > 0 ? (longitud / divisorConsumo).toFixed(3) : '0.000';

  // Fabric colors for Step 2
  const [fabricColors, setFabricColors] = useState<any[]>([
    { id: Date.now(), color_id: '', kilos: '', layers: '', observation: '', nombre_tela: '' }
  ]);

  const addFabricColor = () =>
    setFabricColors(prev => [...prev, { id: Date.now(), color_id: '', kilos: '', layers: '', observation: '', nombre_tela: '' }]);

  const removeFabricColor = (id: number) =>
    setFabricColors(prev => prev.filter(fc => fc.id !== id));

  const updateFabricColor = (id: number, field: string, value: any) =>
    setFabricColors(prev => prev.map(fc => fc.id === id ? { ...fc, [field]: value } : fc));
  
  // Masters
  const [fabrics, setFabrics] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([
    { id: 1, name: 'Juan Cortador', role: 'Cortador' },
    { id: 2, name: 'Pedro Mesa', role: 'Cortador' },
    { id: 3, name: 'Maria Tela', role: 'Cortador' }
  ]);

  useEffect(() => {
    fetchData();
    fetchMasters();
  }, [filterType]);

  const fetchMasters = async () => {
    try {
      const { data: p } = await supabase.from('products').select('*');
      const { data: c } = await supabase.from('colors').select('*');
      const { data: s } = await supabase.from('sizes').select('*').order('orden_visual', { ascending: true });
      const { data: w } = await supabase.from('workshops').select('*');
      const { data: f } = await supabase.from('fabrics').select('*');
      
      if (p) setProducts(p);
      if (c) setColors(c);
      if (s) setSizes(s);
      if (w) setWorkshops(w);
      if (f) setFabrics(f);
    } catch (err) {
      console.error('Error fetching masters:', err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select(`*, workshops (nombre_taller)`)
        .order('created_at', { ascending: false });

      if (filterType !== 'all') query = query.eq('status', filterType);

      const { data: result, error } = await query;
      if (error) throw error;
      setData(result || []);
    } catch (err: any) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFacturaFabrics = async () => {
    if (!formData.factura_relacionada) {
      alert('Por favor ingresa un número de factura');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fabrics')
        .select('*')
        .eq('factura_relacionada', formData.factura_relacionada);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const newFabricColors = data.map(fabric => ({
          id: Math.random(),
          color_id: '', 
          kilos: fabric.kilos || '',
          layers: fabric.capas ? Math.round(Number(fabric.capas)) : '',
          observation: '',
          fabric_id: fabric.id,
          nombre_tela: fabric.nombre_tela,
          capas_definidas: fabric.capas ? Math.round(Number(fabric.capas)) : ''
        }));
        setFabricColors(newFabricColors);
      } else {
        alert('No se encontraron telas asociadas a este número de factura.');
      }
    } catch (err: any) {
      alert('Error consultando factura: ' + err.message);
    } finally {
      setLoading(false);
    }
  };



  const step2TotalLayers = fabricColors.reduce((acc, fc) => acc + (Number(fc.layers) || 0), 0);
  const totalCapasEstimadas = fabricColors.reduce((acc, fc) => acc + (Number(fc.capas_definidas) || 0), 0);
  const totalUnits = Object.values(matrixCells).reduce((a, b) => a + b, 0);
  const totalLayersSummary = step2TotalLayers;
  const totalKilos = fabricColors.reduce((sum, fc) => sum + (Number(fc.kilos) || 0), 0);
  
  const isOverLimit = totalCapasEstimadas > 0 && step2TotalLayers > totalCapasEstimadas;

  const orderItems: any[] = [];
  fabricColors.forEach(fc => {
    if (!fc.nombre_tela && !fc.fabric_id) return;
    matrixCols.forEach(col => {
      if (!col.product_id) return;
      const qty1 = matrixCells[`${fc.id}_${col.id}_1`] || 0;
      const qty2 = matrixCells[`${fc.id}_${col.id}_2`] || 0;
      if (qty1 > 0 && col.size1_id) {
        orderItems.push({ product_id: col.product_id, color_id: fc.color_id, nombre_tela: fc.nombre_tela, size_id: col.size1_id, layers: fc.layers || 0, marker: col.marker1 || 0, total: qty1 });
      }
      if (qty2 > 0 && col.size2_id) {
        orderItems.push({ product_id: col.product_id, color_id: fc.color_id, nombre_tela: fc.nombre_tela, size_id: col.size2_id, layers: fc.layers || 0, marker: col.marker2 || 0, total: qty2 });
      }
    });
  });

  const handleEdit = async (order: any) => {
    setEditingId(order.id);
    
    try {
      const { data: cutsData } = await supabase
        .from('cuts')
        .select('*, cut_sizes(*)')
        .eq('order_id', order.id);

      const firstProductId = cutsData?.[0]?.product_id || '';

      setFormData({
        internal_code: order.internal_code || '',
        brand: order.brand || '',
        factura_relacionada: '',
        product_id: firstProductId,
        status: order.status || 'Planeada',
        priority: order.priority || 'Media',
        order_type: order.order_type || 'Producción',
        observaciones: order.observaciones || '',
        cortador_name: order.cortador_name || '',
        scheduled_date: order.scheduled_date || new Date().toISOString().split('T')[0]
      });

      if (cutsData && cutsData.length > 0) {
        const uniqueColors = Array.from(new Set(cutsData.map(c => c.color_id)));
        const fCols = uniqueColors.map(cid => {
          const colorCuts = cutsData.filter(c => c.color_id === cid);
          const totalKilosForColor = colorCuts.reduce((sum, c) => sum + (Number(c.kilos) || 0), 0);
          const maxLayersForColor = Math.max(...colorCuts.map(c => Number(c.layers) || 0));
          
          return {
            id: Math.random(),
            color_id: cid,
            kilos: totalKilosForColor || '',
            layers: maxLayersForColor || '',
            observation: '',
            capas_definidas: ''
          };
        });
        setFabricColors(fCols.length > 0 ? fCols : [{ id: Date.now(), color_id: '', kilos: '', layers: '', observation: '', capas_definidas: '' }]);

        const productIds = Array.from(new Set(cutsData.map(c => c.product_id)));
        const newCols = productIds.map(pid => {
          const productCuts = cutsData.filter(c => c.product_id === pid);
          const sizesForProduct = Array.from(new Set(productCuts.flatMap(c => c.cut_sizes.map((cs: any) => cs.size_id))));
          return {
            id: Math.random(),
            product_id: pid,
            size1_id: sizesForProduct[0] || '',
            size2_id: sizesForProduct[1] || ''
          };
        });
        setMatrixCols(newCols.length > 0 ? newCols : [{ id: Date.now(), product_id: '', size1_id: '', size2_id: '' }]);

        const newCells: Record<string, number> = {};
        cutsData.forEach(cut => {
          const fc = fCols.find(f => f.color_id === cut.color_id);
          if (!fc) return;
          const col = newCols.find(c => c.product_id === cut.product_id);
          if (!col) return;
          
          cut.cut_sizes.forEach((cs: any) => {
            if (cs.size_id === col.size1_id) {
              newCells[`${fc.id}_${col.id}_1`] = Number(cs.quantity) || 0;
            } else if (cs.size_id === col.size2_id) {
              newCells[`${fc.id}_${col.id}_2`] = Number(cs.quantity) || 0;
            }
          });
        });
        setMatrixCells(newCells);
      }
      
      setStep(1);
      setShowModal(true);
    } catch (err) {
      console.error('Error loading order details:', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const orderPayload = {
        internal_code: formData.internal_code,
        client_name: formData.brand || formData.internal_code,
        brand: formData.brand || formData.internal_code,
        workshop_id: null,
        status: formData.status,
        priority: formData.priority,
        order_type: formData.order_type,
        capas_proyectadas: totalLayersSummary,
        total_kilos_proyectados: totalKilos,
        observaciones: formData.observaciones,
        cortador_name: formData.cortador_name,
        scheduled_date: formData.scheduled_date
      };

      let orderId = editingId;

      if (editingId) {
        const { error: updateError } = await supabase
          .from('orders')
          .update(orderPayload)
          .eq('id', editingId);
        if (updateError) throw updateError;

        const { data: oldCuts } = await supabase.from('cuts').select('id').eq('order_id', editingId);
        if (oldCuts && oldCuts.length > 0) {
          const cutIds = oldCuts.map(c => c.id);
          await supabase.from('cut_sizes').delete().in('cut_id', cutIds);
          await supabase.from('cuts').delete().in('id', cutIds);
        }
      } else {
        const { data: newOrder, error: orderError } = await supabase
          .from('orders')
          .insert([orderPayload])
          .select()
          .single();
        if (orderError) throw orderError;
        orderId = newOrder.id;
      }
      setCurrentOrderId(orderId);

      const colorKilosMap: Record<string, number> = {};
      fabricColors.forEach(fc => {
        if (fc.id) colorKilosMap[fc.id.toString()] = Number(fc.kilos) || 0;
      });

      const assignedFabrics = new Set<string>();
      for (const fc of fabricColors) {
        if (!fc.nombre_tela && !fc.color_id && !fc.fabric_id) continue;
        
        for (const col of matrixCols) {
          if (!col.product_id) continue;
          
          const qty1 = matrixCells[`${fc.id}_${col.id}_1`] || 0;
          const qty2 = matrixCells[`${fc.id}_${col.id}_2`] || 0;
          
          if (qty1 > 0 || qty2 > 0) {
            let itemKilos = 0;
            if (!assignedFabrics.has(fc.id.toString())) {
              itemKilos = colorKilosMap[fc.id.toString()] || 0;
              assignedFabrics.add(fc.id.toString());
            }
            
            const { data: newCut, error: cutError } = await supabase
              .from('cuts')
              .insert([{
                order_id: orderId,
                product_id: col.product_id,
                color_id: fc.color_id || null,
                kilos: itemKilos,
                layers: Number(fc.layers) || 0,
                consumption: Number(consumoPrenda) || 0,
                stroke_length: longitud
              }])
              .select()
              .single();

            if (cutError) throw cutError;

            const sizesToInsert = [];
            if (qty1 > 0 && col.size1_id) sizesToInsert.push({ cut_id: newCut.id, size_id: col.size1_id, quantity: qty1 });
            if (qty2 > 0 && col.size2_id) sizesToInsert.push({ cut_id: newCut.id, size_id: col.size2_id, quantity: qty2 });
            
            if (sizesToInsert.length > 0) {
              const { error: sizeError } = await supabase.from('cut_sizes').insert(sizesToInsert);
              if (sizeError) throw sizeError;
            }
          }
        }
      }
      
      setStep(3); 
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFinishAndSend = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'En Corte'
        })
        .eq('id', currentOrderId || editingId);
      
      if (error) throw error;
      
      setShowModal(false);
      setStep(1);
      setEditingId(null);
      fetchData();
    } catch (err: any) {
      alert('Error al enviar a cortador: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const stats = {
    total: data.length,
    planeada: data.filter(o => o.status === 'Planeada').length,
    enCorte: data.filter(o => o.status === 'En Corte').length,
    cortado: data.filter(o => o.status === 'Cortado' || o.status === 'Completada').length
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1rem', backgroundColor: '#fcfcfc', minHeight: '100vh' }}>
      
      {/* Dashboard Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
        {[
          { label: 'Total Órdenes', value: stats.total, color: 'var(--primary)', icon: Package },
          { label: 'Planeadas', value: stats.planeada, color: '#64748b', icon: Info },
          { label: 'En Proceso', value: stats.enCorte, color: '#f59e0b', icon: Activity },
          { label: 'Completadas', value: stats.cortado, color: '#10b981', icon: CheckCircle }
        ].map((stat, i) => (
          <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1.5rem', borderLeft: `6px solid ${stat.color}` }}>
            <div style={{ backgroundColor: `${stat.color}15`, padding: '1rem', borderRadius: '12px' }}>
              <stat.icon size={24} style={{ color: stat.color }} />
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</p>
              <h2 style={{ fontSize: '1.75rem', fontWeight: '900', margin: 0 }}>{stat.value}</h2>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.75rem', fontWeight: '950' }}>
            <Scissors size={32} style={{ color: 'var(--primary)' }} /> Módulo de Corte Industrial
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Gestión, trazabilidad y control de consumo textil.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={fetchData}><Activity size={18} /> Actualizar</button>
          <button className="btn btn-secondary" style={{ padding: '0.75rem 1.5rem', fontSize: '1rem', fontWeight: '700', backgroundColor: '#f8fafc' }} onClick={() => router.push('/orders/design')}>
            <Code size={20} style={{ color: 'var(--primary)' }} /> Diseño (XML)
          </button>
          <button className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', fontSize: '1rem', fontWeight: '700' }} onClick={() => { 
            const randomCode = `OC-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
            const sortedFabrics = fabrics && fabrics.length > 0 ? [...fabrics].sort((a, b) => b.id - a.id) : [];
            const latestFactura = sortedFabrics.length > 0 ? (sortedFabrics[0].factura_relacionada ?? '') : '';
            setFormData({ 
              status: 'Planeada', 
              priority: 'Media', 
              client_name: '', 
              brand: '', 
              product_id: '',
              factura_relacionada: latestFactura,
              workshop_id: '',
              internal_code: randomCode, 
              order_type: 'corte', 
              observaciones: '',
              cortador_name: '',
              scheduled_date: new Date().toISOString().split('T')[0] 
            });
            setEditingId(null);
            setStep(1); 
            setFabricColors([{ id: Date.now(), color_id: '', kilos: '', layers: '', observation: '', capas_definidas: '' }]);
            setMatrixCols([{ id: Date.now(), product_id: '', size1_id: '', size2_id: '', marker1: '1', marker2: '1' }]);
            setMatrixCells({});
            setShowModal(true); 
            
            // Auto-fetch if there is a latest factura
            if (latestFactura) {
              setTimeout(() => {
                const btn = document.getElementById('btn-buscar-telas');
                if (btn) btn.click();
              }, 100);
            }
          }}>
            <Plus size={20} /> Nueva Orden de Corte
          </button>
        </div>
      </div>

      {/* Tabs Filtros */}
      <div style={{ display: 'flex', gap: '1rem', backgroundColor: 'white', padding: '0.5rem', borderRadius: '12px', width: 'fit-content', border: '1px solid var(--border)' }}>
        {['all', 'Planeada', 'En Corte', 'Cortado'].map(state => (
          <button key={state} onClick={() => setFilterType(state === 'all' ? 'all' : state)} 
            className="btn" 
            style={{ 
              borderRadius: '8px', 
              padding: '0.5rem 1.25rem',
              backgroundColor: (filterType === state || (state === 'all' && filterType === 'all')) ? 'var(--primary)' : 'transparent',
              color: (filterType === state || (state === 'all' && filterType === 'all')) ? 'white' : 'var(--text)',
              border: 'none',
              fontWeight: '700'
            }}>
            {state === 'all' ? 'Todas' : state}
          </button>
        ))}
      </div>

      {/* Tabla Principal */}
      <div className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', backgroundColor: '#fcfcfc' }}>
          <div style={{ position: 'relative', width: '400px' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" placeholder="Buscar por código, cliente o referencia..." style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 3rem', borderRadius: '10px', border: '1.5px solid var(--border)', fontSize: '0.875rem' }} />
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', backgroundColor: '#f8fafc' }}>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Cód. Interno</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Cliente / Marca</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Tela Base</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Taller</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Capas</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Kilos</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Estado</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: '5rem', textAlign: 'center' }}><Loader2 className="animate-spin" size={48} style={{ color: 'var(--primary)', opacity: 0.5 }} /></td></tr>
              ) : (
                data.map(order => (
                  <tr key={order.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="hover-row">
                    <td style={{ padding: '1rem 1.5rem' }}><span style={{ fontWeight: '900', color: 'var(--primary)' }}>{order.internal_code}</span></td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ fontWeight: '700' }}>{order.client_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{order.brand}</div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>---</td>
                    <td style={{ padding: '1rem 1.5rem' }}>{order.workshops?.nombre_taller || '---'}</td>
                    <td style={{ padding: '1rem 1.5rem' }}><span style={{ fontWeight: '800', backgroundColor: '#f1f5f9', padding: '0.25rem 0.75rem', borderRadius: '6px' }}>{order.capas_proyectadas}</span></td>
                    <td style={{ padding: '1rem 1.5rem' }}><span style={{ fontWeight: '800', color: '#64748b' }}>{order.total_kilos_proyectados || 0} kg</span></td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <span className="badge" style={{ 
                        backgroundColor: order.status === 'Planeada' ? '#f1f5f9' : order.status === 'En Corte' ? '#fffbeb' : '#ecfdf5',
                        color: order.status === 'Planeada' ? '#64748b' : order.status === 'En Corte' ? '#b45309' : '#059669',
                        padding: '0.4rem 0.8rem',
                        fontWeight: '800',
                        fontSize: '0.7rem',
                        borderRadius: '999px',
                        border: '1px solid currentColor'
                      }}>
                        {order.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                      <button className="btn btn-secondary" onClick={() => handleEdit(order)} style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: '700' }}>
                        Editar / Detalle
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* WIZARD MODAL */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(12px)' }}>
          <div className="card" style={{ width: '70vw', maxWidth: 'none', padding: '0', maxHeight: '95vh', overflowY: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            
            {/* Wizard Header */}
            <div style={{ padding: '1.5rem 2.5rem', background: '#0f172a', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '950', color: 'white', margin: 0, letterSpacing: '-0.02em' }}>
                  {editingId ? 'Editar Orden de Corte' : 'Nueva Programación de Corte'}
                </h2>
                <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem' }}>
                  {[
                    { s: 1, l: 'Info & Telas' },
                    { s: 2, l: 'Programación Técnica' },
                    { s: 3, l: 'Asignación Final' }
                  ].map(item => (
                    <div key={item.s} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: step >= item.s ? 1 : 0.4 }}>
                      <div style={{ 
                        width: '24px', height: '24px', borderRadius: '50%', 
                        backgroundColor: step === item.s ? 'var(--primary)' : step > item.s ? '#10b981' : 'rgba(255,255,255,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '900'
                      }}>
                        {step > item.s ? '✓' : item.s}
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase' }}>{item.l}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ color: 'white', background: 'rgba(255,255,255,0.1)', border: 'none', padding: '0.75rem', borderRadius: '12px', cursor: 'pointer' }}><X size={24} /></button>
            </div>

            <div style={{ padding: '2.5rem', overflowY: 'auto', flex: 1 }}>
              
              {/* STEP 1: INFO GENERAL & TELAS */}
              {step === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                    <div className="input-group">
                      <label style={{ fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Código Interno</label>
                      <div style={{ padding: '0.875rem', borderRadius: '10px', backgroundColor: '#f8fafc', border: '2.5px solid #e2e8f0', fontWeight: '900', color: 'var(--primary)', fontSize: '1.125rem' }}>
                        {formData.internal_code}
                      </div>
                    </div>
                    <div className="input-group" style={{ gridColumn: 'span 2' }}>
                      <label style={{ fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Factura de Telas (Busqueda)</label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <select 
                          style={{ flex: 1, padding: '0.875rem', borderRadius: '10px', border: '2.5px solid #e2e8f0', fontWeight: '700', backgroundColor: 'white' }} 
                          value={formData.factura_relacionada} 
                          onChange={e => setFormData({...formData, factura_relacionada: e.target.value})} 
                        >
                          <option value="">Seleccionar Factura...</option>
                          {Array.from(new Set(fabrics.map(f => f.factura_relacionada).filter(Boolean))).map(factura => (
                            <option key={String(factura)} value={String(factura)}>{String(factura)}</option>
                          ))}
                        </select>
                        <button id="btn-buscar-telas" className="btn btn-primary" onClick={fetchFacturaFabrics} style={{ padding: '0 1.5rem', fontWeight: '800' }}>
                          <Search size={18} style={{ marginRight: '0.5rem' }} /> Buscar Telas
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* CONFIGURACIÓN DE COLORES Y CAPAS (ANTES PASO 2) */}
                  <div style={{ marginTop: '1rem', borderTop: '2px solid #f1f5f9', paddingTop: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: '900', color: '#0f172a' }}>Distribución de Colores y Capas</h3>
                      <button className="btn btn-secondary" onClick={addFabricColor}><Plus size={18} /> Añadir Color</button>
                    </div>

                    {isOverLimit && (
                      <div style={{ backgroundColor: '#fef2f2', border: '1px solid #ef4444', padding: '1rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '1rem', color: '#b91c1c', marginBottom: '1.5rem' }}>
                        <AlertTriangle size={24} />
                        <div>
                          <p style={{ fontWeight: '900' }}>¡Límite de Capas Excedido!</p>
                          <p style={{ fontSize: '0.875rem' }}>El maestro define un total estimado de {totalCapasEstimadas} capas. Has programado {step2TotalLayers} capas, lo cual excede el límite permitido.</p>
                        </div>
                      </div>
                    )}

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ textAlign: 'left', borderBottom: '2.5px solid #e2e8f0' }}>
                            <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)' }}>TELA (FACTURA)</th>
                            <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)' }}>CAPAS DEFINIDAS</th>
                            <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textAlign: 'center' }}>N° CAPAS</th>
                            <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', color: '#64748b' }}>OBSERVACIÓN</th>
                            <th style={{ padding: '1rem' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {fabricColors.map(fc => (
                            <tr key={fc.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '0.75rem' }}>
                                <div style={{ fontWeight: '700', fontSize: '0.875rem', color: 'var(--primary)' }}>{fc.nombre_tela || 'Manual'}</div>
                                {fc.kilos && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '800' }}>{fc.kilos} kg</div>}
                              </td>
                              <td style={{ padding: '0.75rem' }}>
                                <div style={{ fontWeight: '800', fontSize: '0.875rem', color: '#64748b', textAlign: 'center', backgroundColor: '#f8fafc', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                  {fc.capas_definidas || '---'}
                                </div>
                              </td>
                              <td style={{ padding: '0.75rem' }}>
                                <input type="number" step="1" placeholder="0" style={{ width: '100px', margin: '0 auto', display: 'block', padding: '0.75rem', borderRadius: '8px', border: '1.5px solid #e2e8f0', textAlign: 'center', fontWeight: '800' }} value={fc.layers} onChange={e => updateFabricColor(fc.id, 'layers', e.target.value ? Math.round(Number(e.target.value)) : '')} />
                              </td>
                              <td style={{ padding: '0.75rem' }}>
                                <input type="text" placeholder="Ej: Lote X" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1.5px solid #e2e8f0' }} value={fc.observation} onChange={e => updateFabricColor(fc.id, 'observation', e.target.value)} />
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                <button onClick={() => removeFabricColor(fc.id)} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }}><Trash2 size={20} /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', marginTop: '1.5rem' }}>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Total Kilos Tela</p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--primary)' }}>{totalKilos.toFixed(2)} kg</h3>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Capas Estimadas (Maestro)</p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#64748b' }}>{totalCapasEstimadas}</h3>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '0.7rem', fontWeight: '800', color: isOverLimit ? '#ef4444' : '#64748b', textTransform: 'uppercase' }}>Total Capas Programadas</p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: isOverLimit ? '#ef4444' : '#1e293b' }}>{step2TotalLayers}</h3>
                      </div>
                    </div>
                  </div>

                  <div className="input-group">
                    <label style={{ fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Notas Adicionales</label>
                    <textarea style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '2.5px solid #e2e8f0', minHeight: '80px' }} value={formData.observaciones} onChange={e => setFormData({...formData, observaciones: e.target.value})} placeholder="Instrucciones para el cortador..." />
                  </div>

                  <button className="btn btn-primary" style={{ width: '100%', padding: '1.25rem', fontSize: '1.125rem', fontWeight: '900' }} 
                    onClick={() => {
                      const validColors = fabricColors.filter(fc => fc.nombre_tela || fc.fabric_id);
                      setFabricColors(validColors.length > 0 ? validColors : [{ id: Date.now(), color_id: '', kilos: '', layers: '', observation: '', capas_definidas: '' }]);

                      if (formData.product_id && matrixCols.length === 1 && !matrixCols[0].product_id) {
                        setMatrixCols([{ ...matrixCols[0], product_id: formData.product_id }]);
                      }
                      
                      // Auto-fill Step 2 grid
                      const newCells: Record<string, number> = { ...matrixCells };
                      validColors.forEach(fc => {
                        if ((fc.fabric_id || fc.nombre_tela) && Number(fc.layers) > 0) {
                          matrixCols.forEach(col => {
                            newCells[`${fc.id}_${col.id}_1`] = Math.round(((Number(fc.layers) || 0) * (col.marker1 === '' ? 1 : Number(col.marker1))) / (longitud || 1));
                            newCells[`${fc.id}_${col.id}_2`] = Math.round(((Number(fc.layers) || 0) * (col.marker2 === '' ? 1 : Number(col.marker2))) / (longitud || 1));
                          });
                        }
                      });
                      setMatrixCells(newCells);
                      
                      setStep(2);
                    }} 
                    disabled={fabricColors.filter(f => f.nombre_tela || f.fabric_id).length === 0}>
                    Continuar a Programación Técnica <ArrowRight size={24} style={{ marginLeft: '1rem' }} />
                  </button>
                </div>
              )}

              {/* STEP 2: PROGRAMACIÓN TÉCNICA (ANTES PASO 3) */}
              {step === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', gap: '1rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: '950', margin: 0, color: '#0f172a' }}>Matriz de Programación Técnica</h3>
                      <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>Configure las tallas y marcaciones de producción.</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'white', padding: '0.5rem 1rem', borderRadius: '8px', border: '1.5px solid #cbd5e1' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#475569', whiteSpace: 'nowrap' }}>FACTOR LONGITUD (DIVISOR):</label>
                        <input 
                          type="number" 
                          step="0.01" 
                          min="0.01" 
                          value={longitud} 
                          onChange={e => handleLongitudChange(e.target.value)} 
                          style={{ width: '80px', padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1.5px solid #cbd5e1', fontWeight: '900', textAlign: 'center', fontSize: '0.9rem', color: 'var(--primary)' }} 
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'white', padding: '0.5rem 1rem', borderRadius: '8px', border: '1.5px solid #cbd5e1' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#475569', whiteSpace: 'nowrap' }}>CONSUMO / PRENDA:</label>
                        <input 
                          type="text" 
                          readOnly 
                          value={consumoPrenda} 
                          title={`Fórmula: Longitud (${longitud}) / Divisor (${divisorConsumo})`}
                          style={{ width: '80px', padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1.5px solid #cbd5e1', fontWeight: '900', textAlign: 'center', fontSize: '0.9rem', color: '#10b981', backgroundColor: '#f8fafc', cursor: 'not-allowed' }} 
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                          <th rowSpan={3} style={{ padding: '1rem', textAlign: 'left', backgroundColor: '#0f172a', color: 'white', minWidth: '200px', fontSize: '0.75rem' }}>
                            DISTRIBUCIÓN DE<br/>COLORES Y CAPAS
                          </th>
                          {matrixCols.map(col => (
                            <th key={col.id} colSpan={2} style={{ padding: '0.5rem', borderLeft: '2px solid #e2e8f0' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <select style={{ width: '100%', padding: '0.5rem', border: 'none', background: 'transparent', fontWeight: '900', fontSize: '0.875rem' }} value={col.product_id} onChange={e => updateMatrixCol(col.id, 'product_id', e.target.value)}>
                                  <option value="">Seleccionar Producto...</option>
                                  {products.map(p => <option key={p.id} value={p.id}>{p.nombre_producto}</option>)}
                                </select>
                                {matrixCols.length > 1 && (
                                  <button onClick={() => removeMatrixCol(col.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}><X size={16}/></button>
                                )}
                              </div>
                            </th>
                          ))}
                          {matrixCols.length < 8 && (
                            <th rowSpan={3} style={{ padding: '1rem', borderLeft: '2px solid #e2e8f0', backgroundColor: '#f1f5f9' }}>
                              <button className="btn btn-secondary" onClick={addMatrixCol} style={{ padding: '0.5rem', fontSize: '0.75rem' }}><Plus size={16}/> Producto</button>
                            </th>
                          )}
                        </tr>
                        <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                          {matrixCols.map(col => (
                            <React.Fragment key={`${col.id}-sizes`}>
                              <th style={{ padding: '0.5rem', borderLeft: '2px solid #e2e8f0' }}>
                                <select style={{ width: '100%', padding: '0.25rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700' }} value={col.size1_id} onChange={e => updateMatrixCol(col.id, 'size1_id', e.target.value)}>
                                  <option value="">Talla 1...</option>
                                  {sizes.map(s => <option key={s.id} value={s.id}>{s.codigo_talla}</option>)}
                                </select>
                              </th>
                              <th style={{ padding: '0.5rem', borderLeft: '1px dashed #e2e8f0' }}>
                                <select style={{ width: '100%', padding: '0.25rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700' }} value={col.size2_id} onChange={e => updateMatrixCol(col.id, 'size2_id', e.target.value)}>
                                  <option value="">Talla 2...</option>
                                  {sizes.map(s => <option key={s.id} value={s.id}>{s.codigo_talla}</option>)}
                                </select>
                              </th>
                            </React.Fragment>
                          ))}
                        </tr>
                        <tr style={{ borderBottom: '2px solid #e2e8f0', backgroundColor: '#eef2ff' }}>
                          {matrixCols.map(col => (
                            <React.Fragment key={`${col.id}-markers`}>
                              <th style={{ padding: '0.25rem 0.5rem', borderLeft: '2px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                                  <span style={{ fontSize: '0.6rem', fontWeight: '700', color: '#6366f1' }}>Marc.</span>
                                  <select style={{ padding: '0.15rem 0.25rem', border: '1px solid #a5b4fc', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '800', backgroundColor: '#e0e7ff', color: '#3730a3', width: '40px' }} value={col.marker1} onChange={e => updateMatrixCol(col.id, 'marker1', e.target.value)}>
                                    {[0,1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}
                                  </select>
                                </div>
                              </th>
                              <th style={{ padding: '0.25rem 0.5rem', borderLeft: '1px dashed #e2e8f0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                                  <span style={{ fontSize: '0.6rem', fontWeight: '700', color: '#6366f1' }}>Marc.</span>
                                  <select style={{ padding: '0.15rem 0.25rem', border: '1px solid #a5b4fc', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '800', backgroundColor: '#e0e7ff', color: '#3730a3', width: '40px' }} value={col.marker2} onChange={e => updateMatrixCol(col.id, 'marker2', e.target.value)}>
                                    {[0,1,2,3,4,5].map(v => <option key={v} value={v}>{v}</option>)}
                                  </select>
                                </div>
                              </th>
                            </React.Fragment>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fabricColors.map((fc, i) => {
                          const colData = colors.find(c => c.id === fc.color_id);
                          const fabricName = (fc as any).nombre_tela || colData?.nombre_color || 'Sin Nombre';
                          return (
                            <tr key={fc.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                              <td style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '800', borderRight: '2px solid #e2e8f0', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: colData?.hex_color || '#94a3b8', flexShrink: 0 }}></div>
                                  <span>{fabricName}</span>
                                  <span style={{ color: '#64748b', fontWeight: '600' }}>/ {fc.layers || 0}</span>
                                </div>
                              </td>
                              {matrixCols.map(col => {
                                 const val1 = matrixCells[`${fc.id}_${col.id}_1`] || '';
                                 const val2 = matrixCells[`${fc.id}_${col.id}_2`] || '';
                                 return (
                                   <React.Fragment key={`${col.id}-cells`}>
                                     <td style={{ padding: '0', borderLeft: '2px solid #e2e8f0', verticalAlign: 'middle' }}>
                                       <input type="number" style={{ width: '100%', height: '100%', minHeight: '40px', padding: '0.5rem', border: 'none', textAlign: 'center', fontWeight: val1 ? '900' : '500', fontSize: '1rem', outline: 'none', backgroundColor: val1 ? '#ecfdf5' : 'transparent', color: val1 ? '#065f46' : 'inherit' }} value={val1} onChange={e => updateMatrixCell(fc.id, col.id, 1, e.target.value)} />
                                     </td>
                                     <td style={{ padding: '0', borderLeft: '1px dashed #e2e8f0', verticalAlign: 'middle' }}>
                                       <input type="number" style={{ width: '100%', height: '100%', minHeight: '40px', padding: '0.5rem', border: 'none', textAlign: 'center', fontWeight: val2 ? '900' : '500', fontSize: '1rem', outline: 'none', backgroundColor: val2 ? '#ecfdf5' : 'transparent', color: val2 ? '#065f46' : 'inherit' }} value={val2} onChange={e => updateMatrixCell(fc.id, col.id, 2, e.target.value)} />
                                     </td>
                                   </React.Fragment>
                                 );
                              })}
                              {matrixCols.length < 8 && <td style={{ borderLeft: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}></td>}
                            </tr>
                          );
                        })}
                        <tr style={{ backgroundColor: '#0f172a', color: 'white' }}>
                          <td style={{ padding: '1rem', textAlign: 'left', fontWeight: '900', fontSize: '0.75rem' }}>TOTALES Y RESUMEN</td>
                          {matrixCols.map(col => {
                            let sum1 = 0; let sum2 = 0;
                            fabricColors.forEach(fc => {
                              sum1 += matrixCells[`${fc.id}_${col.id}_1`] || 0;
                              sum2 += matrixCells[`${fc.id}_${col.id}_2`] || 0;
                            });
                            return (
                              <React.Fragment key={`${col.id}-totals`}>
                                <td style={{ padding: '1rem 0.5rem', fontWeight: '900', borderLeft: '2px solid rgba(255,255,255,0.2)' }}>{sum1}</td>
                                <td style={{ padding: '1rem 0.5rem', fontWeight: '900', borderLeft: '1px dashed rgba(255,255,255,0.2)' }}>{sum2}</td>
                              </React.Fragment>
                            );
                          })}
                          {matrixCols.length < 8 && <td style={{ borderLeft: '2px solid rgba(255,255,255,0.2)' }}></td>}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                    <div style={{ background: 'linear-gradient(135deg, #1e293b, #334155)', padding: '1.25rem', borderRadius: '16px', textAlign: 'center' }}>
                      <p style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: '800', margin: '0 0 0.5rem 0' }}>TOTAL CAPAS</p>
                      <h3 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'white', margin: 0 }}>{Math.round(totalLayersSummary)}</h3>
                    </div>
                    <div style={{ background: 'linear-gradient(135deg, #064e3b, #065f46)', padding: '1.25rem', borderRadius: '16px', textAlign: 'center' }}>
                      <p style={{ fontSize: '0.65rem', color: '#6ee7b7', fontWeight: '800', margin: '0 0 0.5rem 0' }}>TOTAL PRENDAS</p>
                      <h3 style={{ fontSize: '1.75rem', fontWeight: '900', color: '#ecfdf5', margin: 0 }}>{totalUnits} u</h3>
                    </div>
                    <div style={{ background: 'linear-gradient(135deg, #312e81, #4338ca)', padding: '1.25rem', borderRadius: '16px', textAlign: 'center' }}>
                      <p style={{ fontSize: '0.65rem', color: '#c7d2fe', fontWeight: '800', margin: '0 0 0.5rem 0' }}>REFERENCIAS SELECCIONADAS</p>
                      <h3 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'white', margin: 0 }}>{matrixCols.filter(c => c.product_id).length}</h3>
                    </div>
                    <div style={{ background: 'linear-gradient(135deg, #0c4a6e, #0369a1)', padding: '1.25rem', borderRadius: '16px', textAlign: 'center' }}>
                      <p style={{ fontSize: '0.65rem', color: '#7dd3fc', fontWeight: '800', margin: '0 0 0.5rem 0' }}>KILOS TELA</p>
                      <h3 style={{ fontSize: '1.75rem', fontWeight: '900', color: '#e0f2fe', margin: 0 }}>{totalKilos.toFixed(2)} kg</h3>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1.5rem' }}>
                    <button className="btn btn-secondary" style={{ flex: 1, padding: '1rem' }} onClick={() => setStep(1)}>Atrás</button>
                    <button className="btn btn-primary" style={{ flex: 2, padding: '1rem', fontSize: '1.125rem', fontWeight: '900' }} onClick={handleSave} disabled={saving || totalUnits === 0}>
                      {saving ? <Loader2 className="animate-spin" /> : 'Siguiente: Asignación Final'}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: ASIGNACIÓN Y FORMATO FINAL (ANTES PASO 4) */}
              {step === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    <div className="card" style={{ padding: '1.5rem', border: '2px solid var(--primary)' }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: '900', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Factory size={20} /> Asignación del Cortador</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="input-group">
                          <label style={{ fontWeight: '800', fontSize: '0.7rem', color: '#64748b' }}>SELECCIONAR RESPONSABLE</label>
                          <input 
                            type="text"
                            list="cortadores-list"
                            placeholder="Ej: Juan Pérez"
                            style={{ width: '100%', padding: '0.875rem', borderRadius: '10px', border: '2.5px solid #e2e8f0', fontWeight: '700' }} 
                            value={formData.cortador_name} 
                            onChange={e => setFormData({...formData, cortador_name: e.target.value})}
                          />
                          <datalist id="cortadores-list">
                            {users.map(u => <option key={u.id} value={u.name}>{u.role}</option>)}
                          </datalist>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div className="input-group">
                            <label style={{ fontWeight: '800', fontSize: '0.7rem', color: '#64748b' }}>FECHA PROGRAMADA</label>
                            <input type="date" style={{ width: '100%', padding: '0.875rem', borderRadius: '10px', border: '2.5px solid #e2e8f0' }} value={formData.scheduled_date} onChange={e => setFormData({...formData, scheduled_date: e.target.value})} />
                          </div>
                          <div className="input-group">
                            <label style={{ fontWeight: '800', fontSize: '0.7rem', color: '#64748b' }}>PRIORIDAD</label>
                            <select style={{ width: '100%', padding: '0.875rem', borderRadius: '10px', border: '2.5px solid #e2e8f0', fontWeight: '700' }} value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
                              <option value="Alta">ALTA</option>
                              <option value="Media">MEDIA</option>
                              <option value="Baja">BAJA</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
                      <p style={{ fontWeight: '800', color: '#64748b', fontSize: '0.875rem' }}>RESUMEN FINAL DE PRODUCCIÓN</p>
                      <h2 style={{ fontSize: '3rem', fontWeight: '950', color: 'var(--primary)', margin: '0.5rem 0' }}>{totalUnits}</h2>
                      <p style={{ fontWeight: '700', fontSize: '1rem', color: '#10b981' }}>UNIDADES TOTALES A CORTAR</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                        <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '0.75rem', border: '1px solid #e2e8f0' }}>
                          <p style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', margin: '0 0 0.25rem 0' }}>CAPAS PROGRAMADAS</p>
                          <p style={{ fontSize: '1.25rem', fontWeight: '900', margin: 0, color: isOverLimit ? '#ef4444' : '#1e293b' }}>{Math.round(totalLayersSummary)}</p>
                        </div>
                        <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '0.75rem', border: '1px solid #e2e8f0' }}>
                          <p style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', margin: '0 0 0.25rem 0' }}>KILOS TELA</p>
                          <p style={{ fontSize: '1.25rem', fontWeight: '900', margin: 0, color: '#0369a1' }}>{totalKilos.toFixed(2)} kg</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '2px solid #e2e8f0', overflow: 'hidden' }}>
                    <div style={{ backgroundColor: '#1e293b', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Droplets size={18} color="white" />
                      <span style={{ color: 'white', fontWeight: '900', fontSize: '0.875rem' }}>RESUMEN DE TELAS PROGRAMADAS</span>
                    </div>
                    <div style={{ padding: '1rem' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8fafc' }}>
                            <th style={{ padding: '0.6rem 1rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textAlign: 'left', border: '1px solid #e2e8f0' }}>TELA</th>
                            <th style={{ padding: '0.6rem 1rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textAlign: 'center', border: '1px solid #e2e8f0' }}>CAPAS ESTIMADAS</th>
                            <th style={{ padding: '0.6rem 1rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textAlign: 'center', border: '1px solid #e2e8f0' }}>CAPAS PROGRAMADAS</th>
                            <th style={{ padding: '0.6rem 1rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textAlign: 'center', border: '1px solid #e2e8f0' }}>KILOS</th>
                            <th style={{ padding: '0.6rem 1rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textAlign: 'center', border: '1px solid #e2e8f0' }}>ESTADO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fabricColors.filter(fc => fc.nombre_tela || fc.fabric_id).map((fc, i) => {
                            const capEst = Number(fc.capas_definidas) || 0;
                            const capProg = Math.round(Number(fc.layers) || 0);
                            const over = capEst > 0 && capProg > capEst;
                            return (
                              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: over ? '#fef2f2' : 'white' }}>
                                <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: '700', border: '1px solid #e2e8f0' }}>{fc.nombre_tela || `Tela #${i+1}`}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.85rem', color: '#64748b', fontWeight: '700', border: '1px solid #e2e8f0' }}>{capEst || '---'}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.85rem', fontWeight: '900', color: over ? '#ef4444' : '#1e293b', border: '1px solid #e2e8f0' }}>{capProg}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.85rem', color: '#0369a1', fontWeight: '700', border: '1px solid #e2e8f0' }}>{Number(fc.kilos || 0).toFixed(2)} kg</td>
                                <td style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                                  {over
                                    ? <span style={{ backgroundColor: '#fee2e2', color: '#b91c1c', fontSize: '0.7rem', fontWeight: '800', padding: '0.2rem 0.6rem', borderRadius: '999px' }}>⚠ EXCEDE</span>
                                    : <span style={{ backgroundColor: '#dcfce7', color: '#166534', fontSize: '0.7rem', fontWeight: '800', padding: '0.2rem 0.6rem', borderRadius: '999px' }}>✓ OK</span>
                                  }
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="printable-order-preview" style={{ padding: '2rem', backgroundColor: 'white', borderRadius: '16px', border: '2.5px solid #0f172a', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '-16px', right: '2rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }} className="no-print">
                      <div style={{ backgroundColor: '#0f172a', color: 'white', padding: '0.35rem 1rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '900' }}>VISTA PREVIA ORDEN DE TRABAJO</div>
                      <button 
                        onClick={() => window.print()}
                        style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', padding: '0.35rem 0.75rem', fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }}
                      >
                        <Printer size={12} /> IMPRIMIR PDF
                      </button>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ backgroundColor: '#0f172a', padding: '0.5rem', borderRadius: '8px' }}><Scissors color="white" size={24} /></div>
                        <div>
                          <h3 style={{ fontSize: '1.25rem', fontWeight: '950', color: '#0f172a', margin: 0 }}>ORDEN DE CORTE #{formData.internal_code}</h3>
                          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>Sistema de Producción Industrial - {new Date().toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '0.875rem', margin: 0 }}>Referencia: <strong>{formData.internal_code}</strong></p>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>ID de Seguimiento</p>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                      {[
                        { l: 'Cortador Responsable', v: formData.cortador_name || '---' },
                        { l: 'Fecha de Corte', v: formData.scheduled_date || '---' },
                        { l: 'Prioridad', v: formData.priority || '---' },
                        { l: 'Factura Telas', v: formData.factura_relacionada || '---' },
                        { l: 'Telas Programadas', v: fabricColors.filter(fc => fc.nombre_tela || fc.fabric_id).length },
                        { l: 'Total Capas', v: Math.round(totalLayersSummary) },
                        { l: 'Total Kilos', v: `${totalKilos.toFixed(2)} kg` },
                        { l: 'Total Unidades', v: orderItems.reduce((sum, item) => sum + (item.total || 0), 0) }
                      ].map((item, i) => (
                        <div key={i} style={{ border: '1px solid #e2e8f0', padding: '0.75rem', borderRadius: '8px' }}>
                          <p style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', margin: 0, textTransform: 'uppercase' }}>{item.l}</p>
                          <p style={{ fontSize: '0.9rem', fontWeight: '700', margin: 0 }}>{item.v}</p>
                        </div>
                      ))}
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
                      <thead style={{ backgroundColor: '#f8fafc' }}>
                        <tr>
                          <th style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.7rem', textAlign: 'left' }}>PRODUCTO</th>
                          <th style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.7rem', textAlign: 'left' }}>TELA</th>
                          <th style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.7rem', textAlign: 'center' }}>TALLA</th>
                          <th style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.7rem', textAlign: 'center' }}>CAPAS</th>
                          <th style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.7rem', textAlign: 'center' }}>MARC.</th>
                          <th style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.7rem', textAlign: 'right' }}>TOTAL UND</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderItems.length === 0 ? (
                          <tr><td colSpan={6} style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>No hay ítems programados con talla y marcación asignada.</td></tr>
                        ) : (
                          orderItems.map((item, i) => (
                            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                              <td style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.8rem', fontWeight: '700' }}>{products.find(p => p.id === item.product_id)?.nombre_producto || '---'}</td>
                              <td style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.8rem' }}>{item.nombre_tela || '---'}</td>
                              <td style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.8rem', textAlign: 'center' }}>{sizes.find(s => s.id === item.size_id)?.codigo_talla || '---'}</td>
                              <td style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.8rem', textAlign: 'center' }}>{Math.round(Number(item.layers))}</td>
                              <td style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.8rem', textAlign: 'center' }}>{item.marker}</td>
                              <td style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.85rem', textAlign: 'right', fontWeight: '900', color: 'var(--primary)' }}>{item.total}</td>
                            </tr>
                          ))
                        )}
                        {orderItems.length > 0 && (
                          <tr style={{ backgroundColor: '#0f172a', color: 'white' }}>
                            <td colSpan={5} style={{ padding: '0.75rem 0.5rem', fontWeight: '900', fontSize: '0.8rem' }}>TOTAL UNIDADES PROGRAMADAS</td>
                            <td style={{ padding: '0.75rem 0.5rem', fontWeight: '900', fontSize: '1rem', textAlign: 'right' }}>{orderItems.reduce((sum, item) => sum + (item.total || 0), 0)}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', marginTop: '3rem' }}>
                      {['PLANEACIÓN', 'CORTADOR', 'CONTROL CALIDAD'].map(label => (
                        <div key={label} style={{ textAlign: 'center' }}>
                          <div style={{ borderBottom: '2px solid #0f172a', width: '100%', marginBottom: '0.5rem' }}></div>
                          <p style={{ fontSize: '0.7rem', fontWeight: '800' }}>{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1.5rem' }} className="no-print">
                    <button className="btn btn-secondary" style={{ flex: 1, padding: '1rem' }} onClick={() => setStep(2)}>Atrás</button>
                    <button 
                      className="btn" 
                      style={{ flex: 1.5, padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', backgroundColor: '#3b82f6', color: 'white', border: '1px solid #3b82f6', fontWeight: '800', borderRadius: '10px' }} 
                      onClick={() => window.print()}
                    >
                      <Printer size={18} /> Imprimir / PDF
                    </button>
                    <button className="btn btn-primary" style={{ flex: 2, padding: '1rem', fontSize: '1.125rem', fontWeight: '900', backgroundColor: '#10b981', borderColor: '#10b981' }} onClick={handleFinishAndSend} disabled={saving || !formData.cortador_name}>
                      {saving ? <Loader2 className="animate-spin" /> : 'Confirmar y Enviar a Planta'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .hover-row:hover {
          background-color: #f8fafc !important;
          cursor: pointer;
        }
        .input-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        textarea:focus, input:focus, select:focus {
          outline: none;
          border-color: var(--primary) !important;
          box-shadow: 0 0 0 4px var(--primary-light);
        }
        @media print {
          body * {
            visibility: hidden !important;
          }
          .printable-order-preview, .printable-order-preview * {
            visibility: visible !important;
          }
          .printable-order-preview {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
