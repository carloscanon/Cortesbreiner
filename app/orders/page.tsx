'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Plus, Search, Trash2, X, Loader2, AlertTriangle, 
  Scissors, Layers, Info, ArrowRight, Factory, Droplets, Printer,
  ChevronRight, Package, Palette, Activity, CheckCircle, Code, RefreshCw
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function OrdersPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.roles?.name?.toLowerCase() === 'administrador';

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState('all'); 
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [viewingOrder, setViewingOrder] = useState<any | null>(null);
  const [viewCuts, setViewCuts] = useState<any[]>([]);
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
  const [matrixCols, setMatrixCols] = useState<any[]>([{ id: Date.now(), product_id: '', size1_id: '', size2_id: '', marker1: '0', marker2: '0' }]);
  const [matrixCells, setMatrixCells] = useState<Record<string, number>>({});
  const [longitud, setLongitud] = useState<string>('1');

  const handleLongitudChange = (valStr: string) => {
    // Permite tipear decimales libremente (e.g. '1.', '1.5', '0.')
    // Solo acepta números y un punto decimal
    if (valStr === '' || /^\d*\.?\d*$/.test(valStr)) {
      setLongitud(valStr);
    }
  };

  const longitudNum = parseFloat(longitud) || 1;


  const addMatrixCol = () => {
    if (matrixCols.length < 8) {
      const newCol = { id: Date.now(), product_id: '', size1_id: '', size2_id: '', marker1: '0', marker2: '0' };
      setMatrixCols([...matrixCols, newCol]);
      setCortesAdicionales(prev => prev.map(c => ({
        ...c,
        matrixCols: [...c.matrixCols, { ...newCol }]
      })));
    }
  };
  
  const removeMatrixCol = (id: number) => {
    setMatrixCols(matrixCols.filter(c => c.id !== id));
    setCortesAdicionales(prev => prev.map(c => ({
      ...c,
      matrixCols: c.matrixCols.filter((col: any) => col.id !== id)
    })));
  };
  
  const updateMatrixCol = (id: number, field: string, value: string) => {
    setMatrixCols(matrixCols.map(c => c.id === id ? { ...c, [field]: value } : c));
    
    // Auto-calculate quantities when marker changes: value = layers × marker
    if (field === 'marker1' || field === 'marker2') {
      const sizeIndex = field === 'marker1' ? 1 : 2;
      const markerVal = value === '' ? 0 : Number(value);
      setMatrixCells(prev => {
        const newCells = { ...prev };
        fabricColors.forEach(fc => {
          if (Number(fc.layers) > 0) {
            const key = `${fc.id}_${id}_${sizeIndex}`;
            newCells[key] = Math.round((Number(fc.layers) || 0) * markerVal);
          }
        });
        return newCells;
      });

      // Propagate marker changes and recalculate cells for additional cuts automatically
      setCortesAdicionales(prev => prev.map(corte => {
        const corteCols = corte.matrixCols.map((col: any) => col.id === id ? { ...col, [field]: value } : col);
        const corteCells = { ...corte.matrixCells };
        corte.fabricColors.forEach((fc: any) => {
          if (Number(fc.layers) > 0) {
            const key = `${fc.id}_${id}_${sizeIndex}`;
            corteCells[key] = Math.round((Number(fc.layers) || 0) * markerVal);
          }
        });
        return {
          ...corte,
          matrixCols: corteCols,
          matrixCells: corteCells
        };
      }));
    } else {
      // General field update propagation for column info like product_id, size1_id, size2_id
      setCortesAdicionales(prev => prev.map(corte => ({
        ...corte,
        matrixCols: corte.matrixCols.map((col: any) => col.id === id ? { ...col, [field]: value } : col)
      })));
    }
  };
  
  const syncCorteAdicionalMatrix = (corteId: number) => {
    const parentFabrics = fabricColors.filter(fc => fc.nombre_tela || fc.fabric_id || fc.color_id);
    setCortesAdicionales(prev => prev.map(c => {
      if (c.id === corteId) {
        const clonedCols = matrixCols.map(col => ({ ...col }));
        const corteLongitud = Number(c.longitud) || 1;

        // Sync fabric identities first!
        const updatedFabricColors = c.fabricColors.map((existingFc: any, idx: number) => {
          const parentFc = parentFabrics[idx];
          const parentLayers = parentFc ? (Number(parentFc.layers) || 0) : 0;
          return {
            ...existingFc,
            layers: parentLayers || '',
            longitud_row: String(parentLayers * corteLongitud)
          };
        });

        const corteCells = { ...c.matrixCells };
        updatedFabricColors.forEach((fc: any) => {
          clonedCols.forEach(col => {
            corteCells[`${fc.id}_${col.id}_1`] = Math.round((Number(fc.layers) || 0) * (col.marker1 === '' ? 0 : Number(col.marker1)));
            corteCells[`${fc.id}_${col.id}_2`] = Math.round((Number(fc.layers) || 0) * (col.marker2 === '' ? 0 : Number(col.marker2)));
          });
        });

        return {
          ...c,
          fabricColors: updatedFabricColors,
          matrixCols: clonedCols,
          matrixCells: corteCells
        };
      }
      return c;
    }));
  };

  const updateMatrixCell = (fabricColorId: number, colId: number, sizeIndex: number, value: string) => {
    const key = `${fabricColorId}_${colId}_${sizeIndex}`;
    setMatrixCells({ ...matrixCells, [key]: Number(value) || 0 });
  };

  // Calculated Consumo / Prenda based on longitud and matrixCols
  // Divisor counts all active markers (value >= 1) on the form (estimated / real-time)
  const totalActiveSizes = matrixCols.reduce((acc, col) => {
    let count = 0;
    if ((Number(col.marker1) || 0) >= 1) count++;
    if ((Number(col.marker2) || 0) >= 1) count++;
    return acc + count;
  }, 0);

  const totalMarcacionesActivas = matrixCols.reduce((acc, col) => {
    const m1 = Number(col.marker1) || 0;
    const m2 = Number(col.marker2) || 0;
    return acc + m1 + m2;
  }, 0);

  const consumoPrenda = totalMarcacionesActivas > 0 ? (longitudNum / totalMarcacionesActivas).toFixed(3) : '0.000';

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

  // ── CORTES ADICIONALES ────────────────────────────────────────────────────
  const [cortesAdicionales, setCortesAdicionales] = useState<any[]>([]);

  const addCorteAdicional = () => {
    const newId = Date.now();
    // Clonamos la configuración actual de matrixCols del Corte 1, asignando nuevos IDs a las columnas
    const clonedMatrixCols = matrixCols.map(col => ({
      ...col,
      id: Math.random()
    }));

    const parentFabrics = fabricColors.filter(fc => fc.nombre_tela || fc.fabric_id || fc.color_id);
    const clonedFabricColors = parentFabrics.length > 0 
      ? parentFabrics.map(fc => ({
          id: Math.random(),
          color_id: fc.color_id || '',
          fabric_id: fc.fabric_id || null,
          nombre_tela: fc.nombre_tela || '',
          metros: fc.metros || '',
          kilos: fc.kilos || '',
          capas_definidas: fc.capas_definidas || '',
          layers: '',
          longitud_row: ''
        }))
      : [{ id: Math.random(), color_id: '', kilos: '', layers: '', observation: '', nombre_tela: '', longitud_row: '' }];

    setCortesAdicionales(prev => [...prev, {
      id: newId,
      nombre: `Corte ${prev.length + 2}`,
      factura: '',
      longitud: '1',
      collapsed: false,
      fabricColors: clonedFabricColors,
      matrixCols: clonedMatrixCols.length > 0 ? clonedMatrixCols : [{ id: Date.now(), product_id: '', size1_id: '', size2_id: '', marker1: '0', marker2: '0' }],
      matrixCells: {}
    }]);
  };

  const syncCorteLayers = (corteId: number) => {
    const parentFabrics = fabricColors.filter(fc => fc.nombre_tela || fc.fabric_id || fc.color_id);
    setCortesAdicionales(prev => prev.map(c => {
      if (c.id === corteId) {
        const corteLongitud = Number(c.longitud) || 1;
        const updatedFabrics = c.fabricColors.map((existingFc: any, idx: number) => {
          const parentFc = parentFabrics[idx];
          const parentLayers = parentFc ? (Number(parentFc.layers) || 0) : 0;
          return {
            ...existingFc,
            layers: parentLayers || '',
            longitud_row: String(parentLayers * corteLongitud)
          };
        });
        return { ...c, fabricColors: updatedFabrics };
      }
      return c;
    }));
  };

  const removeCorteAdicional = (id: number) =>
    setCortesAdicionales(prev => prev.filter(c => c.id !== id));

  // --- Helpers para Matrix en Cortes Adicionales ---
  const addCorteMatrixCol = (corteId: number) => {
    setCortesAdicionales(prev => prev.map(c => 
      c.id === corteId && c.matrixCols.length < 8
        ? { ...c, matrixCols: [...c.matrixCols, { id: Date.now(), product_id: '', size1_id: '', size2_id: '', marker1: '0', marker2: '0' }] }
        : c
    ));
  };

  const removeCorteMatrixCol = (corteId: number, colId: number) => {
    setCortesAdicionales(prev => prev.map(c => 
      c.id === corteId
        ? { ...c, matrixCols: c.matrixCols.filter((col: any) => col.id !== colId) }
        : c
    ));
  };

  const updateCorteMatrixCol = (corteId: number, colId: number, field: string, value: string) => {
    setCortesAdicionales(prev => prev.map(c => {
      if (c.id === corteId) {
        const updatedCols = c.matrixCols.map((col: any) => col.id === colId ? { ...col, [field]: value } : col);
        
        // Auto-calculate quantities for this cut if marker changed
        if (field === 'marker1' || field === 'marker2') {
          const newCells = { ...c.matrixCells };
          c.fabricColors.forEach((fc: any) => {
            if (Number(fc.layers) > 0) {
              const updatedCol = updatedCols.find((col: any) => col.id === colId);
              if (updatedCol) {
                if (field === 'marker1') {
                  newCells[`${fc.id}_${colId}_1`] = Math.round((Number(fc.layers) || 0) * (value === '' ? 0 : Number(value)));
                } else if (field === 'marker2') {
                  newCells[`${fc.id}_${colId}_2`] = Math.round((Number(fc.layers) || 0) * (value === '' ? 0 : Number(value)));
                }
              }
            }
          });
          return { ...c, matrixCols: updatedCols, matrixCells: newCells };
        }
        return { ...c, matrixCols: updatedCols };
      }
      return c;
    }));
  };

  const updateCorteMatrixCell = (corteId: number, fcId: number, colId: number, sizeIndex: 1 | 2, value: string) => {
    setCortesAdicionales(prev => prev.map(c => 
      c.id === corteId
        ? { ...c, matrixCells: { ...c.matrixCells, [`${fcId}_${colId}_${sizeIndex}`]: Number(value) || 0 } }
        : c
    ));
  };
  // ------------------------------------------------

  const updateCorteField = (corteId: number, field: string, value: any) =>
    setCortesAdicionales(prev => prev.map(c => {
      if (c.id === corteId) {
        let updated = { ...c, [field]: value };
        if (field === 'longitud') {
          const newLng = Number(value) || 0;
          updated.fabricColors = c.fabricColors.map((fc: any) => {
            const layersNum = Number(fc.layers) || 0;
            return {
              ...fc,
              longitud_row: layersNum > 0 && newLng > 0 ? String(layersNum * newLng) : fc.longitud_row
            };
          });
        }
        return updated;
      }
      return c;
    }));

  const updateCorteFabric = (corteId: number, fcId: number, field: string, value: any) =>
    setCortesAdicionales(prev => prev.map(c => {
      if (c.id === corteId) {
        const newFabrics = c.fabricColors.map((fc: any) => fc.id === fcId ? { ...fc, [field]: value } : fc);
        if (field === 'layers') {
           const newCells = { ...c.matrixCells };
           c.matrixCols.forEach((col: any) => {
             newCells[`${fcId}_${col.id}_1`] = Math.round((Number(value) || 0) * (col.marker1 === '' ? 0 : Number(col.marker1)));
             newCells[`${fcId}_${col.id}_2`] = Math.round((Number(value) || 0) * (col.marker2 === '' ? 0 : Number(col.marker2)));
           });
           return { ...c, fabricColors: newFabrics, matrixCells: newCells };
        }
        return { ...c, fabricColors: newFabrics };
      }
      return c;
    }));

  const removeCorteFabric = (corteId: number, fcId: number) =>
    setCortesAdicionales(prev => prev.map(c =>
      c.id === corteId
        ? { ...c, fabricColors: c.fabricColors.filter((fc: any) => fc.id !== fcId) }
        : c
    ));

  const fetchCorteAdicionalFabrics = async (corteId: number, invoiceNo: string) => {
    if (!invoiceNo) { alert('Selecciona una factura'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fabrics')
        .select('*')
        .eq('factura_relacionada', invoiceNo)
        .gt('metros', 0);
      if (error) throw error;
      if (data && data.length > 0) {
        const corte = cortesAdicionales.find(c => c.id === corteId);
        const corteLongitud = corte ? (Number(corte.longitud) || 1) : 1;

        const newFcs = data.map((fabric, idx) => {
          const matchedParent = fabricColors[idx];
          const parentLayers = matchedParent ? (Number(matchedParent.layers) || 0) : 0;
          const initialLongitud = parentLayers * corteLongitud;

          return {
            id: Math.random(),
            color_id: matchedParent?.color_id || '',
            kilos: fabric.kilos || '',
            metros: fabric.metros || '',
            layers: parentLayers || '',
            observation: '',
            fabric_id: fabric.id,
            nombre_tela: fabric.nombre_tela,
            longitud_row: parentLayers > 0 ? String(initialLongitud) : '',
            capas_definidas: fabric.capas ? Math.round(Number(fabric.capas)) : ''
          };
        });
        setCortesAdicionales(prev => prev.map(c =>
          c.id === corteId ? { ...c, fabricColors: newFcs } : c
        ));
      } else {
        alert('No se encontraron telas para esta factura.');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };
  // ─────────────────────────────────────────────────────────────────────────

  const [fabrics, setFabrics] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
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
      const { data: cat } = await supabase.from('categories').select('*').order('categoria');
      
      if (p) setProducts(p);
      if (c) setColors(c);
      if (s) setSizes(s);
      if (w) setWorkshops(w);
      if (f) setFabrics(f);
      if (cat) setCategories(cat);
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
        .eq('factura_relacionada', formData.factura_relacionada)
        .gt('metros', 0);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const newFabricColors = data.map(fabric => ({
          id: Math.random(),
          color_id: '', 
          kilos: fabric.kilos || '',
          metros: fabric.metros || '',
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

  const fetchAndAppendFacturaFabrics = async (invoiceNo: string) => {
    if (!invoiceNo) {
      alert('Por favor selecciona una factura');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fabrics')
        .select('*')
        .eq('factura_relacionada', invoiceNo);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const newFabricColors = data.map(fabric => ({
          id: Math.random(),
          color_id: '', 
          kilos: fabric.kilos || '',
          metros: fabric.metros || '',
          layers: fabric.capas ? Math.round(Number(fabric.capas)) : '',
          observation: '',
          fabric_id: fabric.id,
          nombre_tela: fabric.nombre_tela,
          capas_definidas: fabric.capas ? Math.round(Number(fabric.capas)) : ''
        }));
        
        setFabricColors(prev => {
          const filteredPrev = prev.filter(fc => fc.nombre_tela || fc.fabric_id);
          return [...filteredPrev, ...newFabricColors];
        });

        setFormData((prev: any) => {
          const current = prev.factura_relacionada ? prev.factura_relacionada.split(', ') : [];
          if (!current.includes(invoiceNo)) {
            current.push(invoiceNo);
          }
          return { ...prev, factura_relacionada: current.join(', ') };
        });
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

  const totalUnits = (() => {
    let sum = 0;
    fabricColors.forEach(fc => {
      matrixCols.forEach(col => {
        sum += Number(matrixCells[`${fc.id}_${col.id}_1`]) || 0;
        sum += Number(matrixCells[`${fc.id}_${col.id}_2`]) || 0;
      });
    });
    return sum;
  })();

  const totalLayersSummary = step2TotalLayers;
  
  const totalKilos = fabricColors.reduce((sum, fc) => sum + (fc.longitud_row && Number(fc.longitud_row) > 0 ? Number(fc.longitud_row) : (Number(fc.metros) || 0)), 0);
  
  const isOverLimit = totalCapasEstimadas > 0 && step2TotalLayers > totalCapasEstimadas;

  const orderItems: any[] = [];
  fabricColors.forEach(fc => {
    matrixCols.forEach(col => {
      const qty1 = matrixCells[`${fc.id}_${col.id}_1`] || 0;
      const qty2 = matrixCells[`${fc.id}_${col.id}_2`] || 0;
      
      const colData = colors.find(c => String(c.id) === String(fc.color_id));
      const finalFabricName = fc.nombre_tela || colData?.nombre_color || 'Tela Base';

      if (qty1 > 0) orderItems.push({ product_id: col.product_id || '', color_id: fc.color_id, nombre_tela: finalFabricName, size_id: col.size1_id || '', layers: fc.layers || 0, marker: col.marker1 || 0, total: qty1 });
      if (qty2 > 0) orderItems.push({ product_id: col.product_id || '', color_id: fc.color_id, nombre_tela: finalFabricName, size_id: col.size2_id || '', layers: fc.layers || 0, marker: col.marker2 || 0, total: qty2 });
    });
  });
  
  cortesAdicionales.forEach(corte => {
    corte.fabricColors.forEach((fc: any) => {
      corte.matrixCols.forEach((col: any) => {
        const qty1 = corte.matrixCells[`${fc.id}_${col.id}_1`] || 0;
        const qty2 = corte.matrixCells[`${fc.id}_${col.id}_2`] || 0;
        
        const colData = colors.find(c => String(c.id) === String(fc.color_id));
        const finalFabricName = fc.nombre_tela || colData?.nombre_color || 'Tela Base';

        if (qty1 > 0) orderItems.push({ product_id: col.product_id || '', color_id: fc.color_id, nombre_tela: `${corte.nombre} - ${finalFabricName}`, size_id: col.size1_id || '', layers: fc.layers || 0, marker: col.marker1 || 0, total: qty1 });
        if (qty2 > 0) orderItems.push({ product_id: col.product_id || '', color_id: fc.color_id, nombre_tela: `${corte.nombre} - ${finalFabricName}`, size_id: col.size2_id || '', layers: fc.layers || 0, marker: col.marker2 || 0, total: qty2 });
      });
    });
  });

  const handleDeleteOrder = async (id: number, code: string) => {
    if (!confirm(`¿Eliminar la orden OC-${code || id}? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) {
      alert('Error al eliminar: ' + error.message);
    } else {
      fetchData();
    }
  };

  const handleEdit = async (order: any) => {
    setEditingId(order.id);
    
    try {
      // Recargar maestros en tiempo real para evitar inconsistencias con productos dinámicos
      const { data: latestProducts } = await supabase.from('products').select('*');
      const currentProducts = latestProducts || products;
      if (latestProducts) setProducts(latestProducts);

      const { data: latestFabrics } = await supabase.from('fabrics').select('*');
      if (latestFabrics) setFabrics(latestFabrics);

      const { data: cutsData } = await supabase
        .from('cuts')
        .select('*, cut_sizes(*)')
        .eq('order_id', order.id);

      console.log('Cargando orden en edición:', order.internal_code, { cutsCount: cutsData?.length, productsCount: currentProducts.length });

      const firstProductId = cutsData?.[0]?.product_id || '';
      const orderStrokeLength = cutsData?.[0]?.stroke_length || 1;
      setLongitud(String(orderStrokeLength));

      let fetchedFabrics: any[] = [];
      if (order.brand) {
        const { data: fabs } = await supabase
          .from('fabrics')
          .select('*')
          .eq('factura_relacionada', order.brand);
        if (fabs) fetchedFabrics = fabs;
      }

      setFormData({
        internal_code: order.internal_code || '',
        brand: order.brand || '',
        factura_relacionada: order.brand || '',
        product_id: firstProductId,
        status: order.status || 'Planeada',
        priority: order.priority || 'Media',
        order_type: order.order_type || 'Producción',
        observaciones: order.observaciones || '',
        cortador_name: order.cortador_name || '',
        scheduled_date: order.scheduled_date || new Date().toISOString().split('T')[0]
      });

      const getCategoryOfProduct = (pid: string) => {
        const prod = currentProducts.find(p => String(p.id) === String(pid));
        return prod?.category_id || '';
      };

      if (cutsData && cutsData.length > 0) {
        console.log('[handleEdit] cutsData sample:', cutsData.slice(0, 3).map(c => ({
          id: c.id, fabric_id: c.fabric_id, color_id: c.color_id, layers: c.layers, kilos: c.kilos, sizes: c.cut_sizes?.length
        })));
        console.log('[handleEdit] fetchedFabrics:', fetchedFabrics.map(f => ({ id: f.id, nombre_tela: f.nombre_tela })));

        // ── RECONSTRUIR FILAS DE TELAS ────────────────────────────────────────
        // Estrategia:
        //   1) Si hay telas de la factura → son la fuente de verdad (siempre las 4 correctas)
        //   2) Si no hay factura → agrupar por fabric_id (o color_id) de los cortes
        let fCols: any[];

        if (fetchedFabrics.length > 0) {
          // Fuente 1: telas directamente de la factura relacionada a la orden
          // Cada fabric de la factura = una fila de la matriz
          fCols = fetchedFabrics.map(f => {
            // Buscar el corte que corresponde a esta tela para sacar layers/kilos reales
            const fabricCuts = cutsData.filter(c => c.fabric_id && String(c.fabric_id) === String(f.id));
            const maxLayers = fabricCuts.length > 0 
              ? Math.max(...fabricCuts.map((c: any) => Number(c.layers) || 0))
              : (f.capas ? Math.round(Number(f.capas)) : '');
            const totalKilos = fabricCuts.length > 0
              ? fabricCuts.reduce((sum: number, c: any) => sum + (Number(c.kilos) || 0), 0)
              : (f.kilos || '');

            return {
              id: Math.random(),
              color_id: fabricCuts[0]?.color_id || '',
              kilos: totalKilos || f.kilos || '',
              metros: f.metros || '',
              layers: maxLayers || '',
              observation: '',
              fabric_id: f.id,
              nombre_tela: f.nombre_tela || 'Tela Cargada',
              capas_definidas: f.capas ? Math.round(Number(f.capas)) : ''
            };
          });
        } else {
          // Fuente 2 (fallback): agrupar cortes por fabric_id o color_id
          const uniqueKeys = Array.from(new Set(cutsData.map((c: any) =>
            c.fabric_id ? `fab_${c.fabric_id}` : `col_${c.color_id || 'null'}`
          )));
          fCols = uniqueKeys.map((key: string) => {
            const isFabric = key.startsWith('fab_');
            const refId = key.substring(4);
            const colorCuts = cutsData.filter((c: any) =>
              isFabric ? String(c.fabric_id) === refId : String(c.color_id) === (refId === 'null' ? null : refId)
            );
            const firstCut = colorCuts[0];
            const totalKilosForColor = colorCuts.reduce((sum: number, c: any) => sum + (Number(c.kilos) || 0), 0);
            const maxLayersForColor = Math.max(...colorCuts.map((c: any) => Number(c.layers) || 0));
            return {
              id: Math.random(),
              color_id: firstCut.color_id || '',
              kilos: totalKilosForColor || '',
              metros: firstCut.metros || '',
              layers: maxLayersForColor || '',
              observation: '',
              fabric_id: firstCut.fabric_id || '',
              nombre_tela: 'Tela Manual',
              capas_definidas: ''
            };
          });
        }

        console.log('[handleEdit] fCols generados:', fCols.length, fCols.map(f => ({ nombre_tela: f.nombre_tela, fabric_id: f.fabric_id })));
        setFabricColors(fCols.length > 0 ? fCols : [{ id: Date.now(), color_id: '', kilos: '', layers: '', observation: '', capas_definidas: '' }]);

        // 1. Recopilar columnas únicas a partir de los cortes guardados
        // Usamos un Map con clave "catId|size1|size2" (normalizado) para evitar duplicados entre telas
        const colMap = new Map<string, any>();
        cutsData.forEach(cut => {
          const prodId = cut.product_id;
          if (!prodId) return;

          // Ordenar los size_ids para normalizar (S,M == M,S)
          const allSizes = cut.cut_sizes.map((cs: any) => cs.size_id).sort();
          if (allSizes.length === 0) return;

          const size1 = allSizes[0] || '';
          const size2 = allSizes[1] || '';
          const colKey = `${prodId}|${size1}|${size2}`;

          if (colMap.has(colKey)) return; // Ya existe esta combinación de tallas, no duplicar

          const layers = Number(cut.layers) || 1;
          const cs1 = cut.cut_sizes.find((cs: any) => String(cs.size_id) === String(size1));
          const cs2 = cut.cut_sizes.find((cs: any) => String(cs.size_id) === String(size2));
          const m1 = cs1 ? Math.round(cs1.quantity / layers) : 0;
          const m2 = cs2 ? Math.round(cs2.quantity / layers) : 0;

          colMap.set(colKey, {
            id: Math.random(),
            product_id: prodId,
            size1_id: size1,
            size2_id: size2,
            marker1: String(m1),
            marker2: String(m2),
            _colKey: colKey // guardar la clave para localizar la columna al reconstruir celdas
          });
        });

        const newCols: any[] = Array.from(colMap.values());
        setMatrixCols(newCols.length > 0 ? newCols : [{ id: Date.now(), product_id: '', size1_id: '', size2_id: '', marker1: '0', marker2: '0' }]);

        const newCells: Record<string, number> = {};

        // Agrupar los cortes por fabric_id para reconstruir celdas correctamente
        // Para datos legados sin fabric_id, hacer fallback posicional agrupando por posición relativa
        const hasFabricIds = cutsData.some((c: any) => !!c.fabric_id);

        if (hasFabricIds) {
          // Caso moderno: los cortes tienen fabric_id → mapeo directo
          cutsData.forEach((cut: any) => {
            const fc = fCols.find((f: any) => cut.fabric_id && String(f.fabric_id) === String(cut.fabric_id));
            if (!fc) return;

            const cutProdId = cut.product_id;
            if (!cutProdId) return;

            const allSizes = cut.cut_sizes.map((cs: any) => cs.size_id).sort();
            if (allSizes.length === 0) return;
            const lookupKey = `${cutProdId}|${allSizes[0] || ''}|${allSizes[1] || ''}`;
            const col = newCols.find((c: any) => c._colKey === lookupKey);
            if (!col) return;

            cut.cut_sizes.forEach((cs: any) => {
              if (String(cs.size_id) === String(col.size1_id)) {
                newCells[`${fc.id}_${col.id}_1`] = Number(cs.quantity) || 0;
              } else if (String(cs.size_id) === String(col.size2_id)) {
                newCells[`${fc.id}_${col.id}_2`] = Number(cs.quantity) || 0;
              }
            });
          });
        } else {
          // Caso legado: cortes sin fabric_id → usar solo la primera fila de tela
          // (No podemos saber a qué tela pertenece cada corte, mostramos en la primera)
          const fallbackFc = fCols[0];
          if (fallbackFc) {
            cutsData.forEach((cut: any) => {
              const cutProdId = cut.product_id;
              if (!cutProdId) return;

              const allSizes = cut.cut_sizes.map((cs: any) => cs.size_id).sort();
              if (allSizes.length === 0) return;
              const lookupKey = `${cutProdId}|${allSizes[0] || ''}|${allSizes[1] || ''}`;
              const col = newCols.find((c: any) => c._colKey === lookupKey);
              if (!col) return;

              cut.cut_sizes.forEach((cs: any) => {
                if (String(cs.size_id) === String(col.size1_id)) {
                  newCells[`${fallbackFc.id}_${col.id}_1`] = Number(cs.quantity) || 0;
                } else if (String(cs.size_id) === String(col.size2_id)) {
                  newCells[`${fallbackFc.id}_${col.id}_2`] = Number(cs.quantity) || 0;
                }
              });
            });
          }
        }

        console.log('[handleEdit] newCells keys:', Object.keys(newCells).length);
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
        client_name: formData.factura_relacionada || formData.internal_code,
        brand: formData.factura_relacionada || formData.internal_code,
        workshop_id: null,
        status: formData.status,
        priority: formData.priority,
        order_type: formData.order_type,
        capas_proyectadas: totalLayersSummary,
        total_kilos_proyectados: fabricColors.reduce((sum, fc) => sum + (fc.longitud_row ? Number(fc.longitud_row) : 0), 0) + cortesAdicionales.reduce((acc, c) => acc + c.fabricColors.reduce((sum: number, fc: any) => sum + (fc.longitud_row ? Number(fc.longitud_row) : 0), 0), 0),
        observaciones: formData.observaciones,
        cortador_name: formData.cortador_name,
        scheduled_date: formData.scheduled_date
      };

      let orderId = editingId;

      // ── REVERSIÓN DE CAPAS Y METROS ANTERIORES (solo si es edición) ───────────────
      // Usamos fabricColors (cargados desde la factura al editar) para saber
      // cuántas capas y metros restaurar.
      if (editingId) {
        for (const fc of fabricColors) {
          if (fc.fabric_id && Number(fc.layers) > 0) {
            const { data: fab } = await supabase.from('fabrics').select('capas, metros').eq('id', fc.fabric_id).single();
            if (fab) {
              const restoredCapas = (Number(fab.capas) || 0) + (Number(fc.layers) || 0);
              const rowLongitud = fc.longitud_row && Number(fc.longitud_row) > 0 ? Number(fc.longitud_row) : longitudNum;
              const restoredMetros = (Number(fab.metros) || 0) + rowLongitud;
              await supabase.from('fabrics').update({ capas: restoredCapas, metros: restoredMetros }).eq('id', fc.fabric_id);
            }
          }
        }

        // Actualizar la orden y borrar cortes viejos
        const { error: updateError } = await supabase
          .from('orders')
          .update(orderPayload)
          .eq('id', editingId);
        if (updateError) throw updateError;

        const { data: oldCuts } = await supabase.from('cuts').select('id').eq('order_id', editingId);
        if (oldCuts && oldCuts.length > 0) {
          const cutIds = oldCuts.map((c: any) => c.id);
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



      // ── INSERTAR NUEVOS CORTES ────────────────────────────────────────────
      // Rastrear capas y metros a descontar por fabric_id
      const usageByFabric: Record<string, { capas: number, metros: number }> = {};

      for (const fc of fabricColors) {
        if (!fc.nombre_tela && !fc.color_id && !fc.fabric_id) continue;
        const fcLayers = Number(fc.layers) || 0;
        
        // Registrar consumo para la orden principal (una sola vez por fila de tela)
        const fabricKey = fc.fabric_id ? String(fc.fabric_id) : null;
        if (fabricKey) {
          const rowLongitud = fc.longitud_row && Number(fc.longitud_row) > 0 ? Number(fc.longitud_row) : (fcLayers * longitudNum);
          if (!usageByFabric[fabricKey]) usageByFabric[fabricKey] = { capas: 0, metros: 0 };
          usageByFabric[fabricKey].capas += fcLayers;
          usageByFabric[fabricKey].metros += rowLongitud;
        }

        for (const col of matrixCols) {
          if (!col.product_id) continue;

          const qty1 = matrixCells[`${fc.id}_${col.id}_1`] || 0;
          const qty2 = matrixCells[`${fc.id}_${col.id}_2`] || 0;
          if (qty1 === 0 && qty2 === 0) continue;

          // Kilos proporcionales para este corte
          const totalUnitsForFc = (() => {
            let sum = 0;
            matrixCols.forEach((c: any) => {
              sum += matrixCells[`${fc.id}_${c.id}_1`] || 0;
              sum += matrixCells[`${fc.id}_${c.id}_2`] || 0;
            });
            return sum;
          })();
          const itemUnits = qty1 + qty2;
          const fcKilos = fc.longitud_row && Number(fc.longitud_row) > 0 ? Number(fc.longitud_row) : (fcLayers * longitudNum);
          const itemKilos = totalUnitsForFc > 0 ? (fcKilos * itemUnits / totalUnitsForFc) : 0;

          const { data: newCut, error: cutError } = await supabase
            .from('cuts')
            .insert([{
              order_id: orderId,
              product_id: col.product_id,
              color_id: fc.color_id || null,
              fabric_id: fc.fabric_id || null,
              kilos: itemKilos,
              layers: fcLayers,
              consumption: Number(consumoPrenda) || 0,
              stroke_length: longitudNum
            }])
            .select()
            .single();

          if (cutError) throw cutError;

          const sizesMap = new Map<string, number>();
          if (qty1 > 0 && col.size1_id) {
            sizesMap.set(col.size1_id, (sizesMap.get(col.size1_id) || 0) + qty1);
          }
          if (qty2 > 0 && col.size2_id) {
            sizesMap.set(col.size2_id, (sizesMap.get(col.size2_id) || 0) + qty2);
          }

          const sizesToInsert = Array.from(sizesMap.entries()).map(([size_id, quantity]) => ({
            cut_id: newCut.id,
            size_id,
            quantity
          }));

          if (sizesToInsert.length > 0) {
            const { error: sizeError } = await supabase.from('cut_sizes').insert(sizesToInsert);
            if (sizeError) throw sizeError;
          }
        }
      }

      // ── CORTES ADICIONALES ────────────────────────────────────────────────
      for (const corte of cortesAdicionales) {
        const corteLongitudNum = parseFloat(corte.longitud) || 1;
        for (const fc of corte.fabricColors) {
          if (!fc.nombre_tela && !fc.color_id && !fc.fabric_id) continue;
          const fcLayers = Number(fc.layers) || 0;

          // Registrar consumo para el corte adicional (una sola vez por fila de tela del corte adicional)
          const fabricKey = fc.fabric_id ? String(fc.fabric_id) : null;
          if (fabricKey) {
            const rowLongitud = fc.longitud_row && Number(fc.longitud_row) > 0 ? Number(fc.longitud_row) : (fcLayers * corteLongitudNum);
            if (!usageByFabric[fabricKey]) usageByFabric[fabricKey] = { capas: 0, metros: 0 };
            usageByFabric[fabricKey].capas += fcLayers;
            usageByFabric[fabricKey].metros += rowLongitud;
          }

          for (const col of corte.matrixCols) {
            if (!col.product_id) continue;
            const qty1 = corte.matrixCells[`${fc.id}_${col.id}_1`] || 0;
            const qty2 = corte.matrixCells[`${fc.id}_${col.id}_2`] || 0;
            if (qty1 === 0 && qty2 === 0) continue;

            const totalUnitsForFc = (() => {
              let sum = 0;
              corte.matrixCols.forEach((c: any) => {
                sum += corte.matrixCells[`${fc.id}_${c.id}_1`] || 0;
                sum += corte.matrixCells[`${fc.id}_${c.id}_2`] || 0;
              });
              return sum;
            })();
            const itemUnits = qty1 + qty2;
            const fcKilos = fc.longitud_row && Number(fc.longitud_row) > 0 ? Number(fc.longitud_row) : (fcLayers * corteLongitudNum);
            const itemKilos = totalUnitsForFc > 0 ? (fcKilos * itemUnits / totalUnitsForFc) : 0;

            const { data: newCut, error: cutError } = await supabase
              .from('cuts')
              .insert([{
                order_id: orderId,
                product_id: col.product_id,
                color_id: fc.color_id || null,
                fabric_id: fc.fabric_id || null,
                kilos: itemKilos,
                layers: fcLayers,
                consumption: Number(consumoPrenda) || 0,
                stroke_length: corteLongitudNum
              }])
              .select()
              .single();
            if (cutError) throw cutError;

            const sizesMap = new Map<string, number>();
            if (qty1 > 0 && col.size1_id) sizesMap.set(col.size1_id, (sizesMap.get(col.size1_id) || 0) + qty1);
            if (qty2 > 0 && col.size2_id) sizesMap.set(col.size2_id, (sizesMap.get(col.size2_id) || 0) + qty2);
            const sizesToInsert = Array.from(sizesMap.entries()).map(([size_id, quantity]) => ({ cut_id: newCut.id, size_id, quantity }));
            if (sizesToInsert.length > 0) {
              const { error: sizeError } = await supabase.from('cut_sizes').insert(sizesToInsert);
              if (sizeError) throw sizeError;
            }
          }
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      // ── DESCUENTO DE CAPAS Y METROS EN TABLA FABRICS ─────────────────────
      // Restar las capas y metros usados en esta orden del inventario de telas
      for (const [fabricId, usage] of Object.entries(usageByFabric)) {
        const { data: fab } = await supabase.from('fabrics').select('capas, metros').eq('id', fabricId).single();
        if (fab) {
          const newCapas = Math.max(0, (Number(fab.capas) || 0) - usage.capas);
          const newMetros = Math.max(0, (Number(fab.metros) || 0) - usage.metros);
          await supabase.from('fabrics').update({ capas: newCapas, metros: newMetros }).eq('id', fabricId);
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
      // Guardar los campos editados en Step 3 (prioridad, cortador, fecha) + cambiar estado
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'En Corte',
          priority: formData.priority,
          cortador_name: formData.cortador_name,
          scheduled_date: formData.scheduled_date
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
            fetchMasters();
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
            setMatrixCols([{ id: Date.now(), product_id: '', size1_id: '', size2_id: '', marker1: '0', marker2: '0' }]);
            setMatrixCells({});
            setCortesAdicionales([]);
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
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Fecha</th>
                <th style={{ padding: '1.25rem 1.5rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Cliente / Marca</th>
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
                      <span style={{ fontWeight: '700', color: '#475569' }}>
                        {order.created_at ? new Date(order.created_at).toLocaleDateString('es-ES') : '---'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ fontWeight: '700' }}>{order.client_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{order.brand}</div>
                    </td>
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
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button
                          className="btn btn-secondary"
                          onClick={async () => {
                            const { data: cuts } = await supabase
                              .from('cuts')
                              .select('*, cut_sizes(*)')
                              .eq('order_id', order.id);
                            setViewCuts(cuts || []);
                            setViewingOrder(order);
                          }}
                          style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                        >
                          <Info size={14} /> Ver Detalle
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteOrder(order.id, order.internal_code)}
                            title="Eliminar orden"
                            style={{
                              padding: '0.5rem',
                              borderRadius: '8px',
                              border: '1.5px solid #fecaca',
                              backgroundColor: '#fff5f5',
                              color: '#ef4444',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DETALLE (solo lectura) */}
      {viewingOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(10px)' }}>
          <div className="card" style={{ width: '72vw', maxWidth: '1000px', padding: 0, maxHeight: '92vh', overflowY: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 60px -10px rgba(0,0,0,0.6)', borderRadius: '20px' }}>
            
            {/* Header */}
            <div style={{ padding: '1.5rem 2rem', background: 'linear-gradient(135deg, #0f172a, #1e3a5f)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '20px 20px 0 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '0.75rem', borderRadius: '12px' }}>
                  <Scissors size={24} color="white" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '950', letterSpacing: '-0.02em' }}>Orden {viewingOrder.internal_code}</h2>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                    {viewingOrder.created_at ? new Date(viewingOrder.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }) : '---'}
                    {viewingOrder.brand ? ` · Factura ${viewingOrder.brand}` : ''}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{
                  padding: '0.4rem 1rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: '800', border: '1.5px solid rgba(255,255,255,0.3)',
                  backgroundColor: viewingOrder.status === 'Planeada' ? 'rgba(100,116,139,0.3)' : viewingOrder.status === 'En Corte' ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)',
                  color: viewingOrder.status === 'Planeada' ? '#94a3b8' : viewingOrder.status === 'En Corte' ? '#fcd34d' : '#6ee7b7'
                }}>{viewingOrder.status?.toUpperCase()}</span>
                <button onClick={() => { setViewingOrder(null); setViewCuts([]); }} style={{ color: 'white', background: 'rgba(255,255,255,0.1)', border: 'none', padding: '0.65rem', borderRadius: '10px', cursor: 'pointer' }}><X size={20} /></button>
              </div>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                {[
                  { label: 'Total Capas', value: viewingOrder.capas_proyectadas ?? '---', color: '#6366f1' },
                  { label: 'Total Kilos', value: `${Number(viewingOrder.total_kilos_proyectados || 0).toFixed(2)} kg`, color: '#0ea5e9' },
                  { label: 'Prioridad', value: viewingOrder.priority || '---', color: viewingOrder.priority === 'Alta' ? '#ef4444' : viewingOrder.priority === 'Baja' ? '#10b981' : '#f59e0b' },
                  { label: 'Cortador', value: viewingOrder.cortador_name || 'Sin asignar', color: '#64748b' }
                ].map((kpi, i) => (
                  <div key={i} style={{ backgroundColor: '#f8fafc', border: `2px solid ${kpi.color}22`, borderRadius: '14px', padding: '1rem', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', margin: '0 0 0.35rem 0' }}>{kpi.label}</p>
                    <p style={{ fontSize: '1.1rem', fontWeight: '900', color: kpi.color, margin: 0 }}>{kpi.value}</p>
                  </div>
                ))}
              </div>

              {/* Telas programadas */}
              {(() => {
                const uniqueFabricIds = Array.from(new Set(viewCuts.map((c: any) => c.fabric_id).filter(Boolean)));
                const fabricRows = uniqueFabricIds.length > 0
                  ? uniqueFabricIds.map(fid => {
                      const fc = viewCuts.filter((c: any) => String(c.fabric_id) === String(fid));
                      const first = fc[0];
                      return { fabric_id: fid, layers: Math.max(...fc.map((c: any) => Number(c.layers) || 0)), kilos: fc.reduce((s: number, c: any) => s + (Number(c.kilos) || 0), 0), label: first?.fabric_id ? `Tela ID ${fid}` : 'Tela', firstCut: first };
                    })
                  : [{ fabric_id: null, layers: viewCuts[0]?.layers || 0, kilos: viewCuts.reduce((s, c) => s + (Number(c.kilos) || 0), 0), label: 'Tela programada', firstCut: viewCuts[0] }];

                // Intentar enricher con fabrics maestro y categorías
                const enriched = fabricRows.map(row => {
                  const prod = products.find(p => String(p.id) === String(row.firstCut?.product_id));
                  const cat = prod ? categories.find(c => String(c.id) === String(prod.category_id)) : null;
                  return { 
                    ...row, 
                    categoria: cat ? cat.categoria : (prod ? prod.nombre_producto : '---')
                  };
                });

                return (
                  <div>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Layers size={16} style={{ color: 'var(--primary)' }} /> Categorías Programadas ({enriched.length})
                    </h3>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f1f5f9' }}>
                            {['Categoría', 'Capas', 'Kilos'].map(h => <th key={h} style={{ padding: '0.65rem 1rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textAlign: h === 'Categoría' ? 'left' : 'center', textTransform: 'uppercase' }}>{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {enriched.map((row, i) => (
                            <tr key={i} style={{ borderTop: '1px solid #f1f5f9', backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                              <td style={{ padding: '0.75rem 1rem', fontWeight: '700', fontSize: '0.875rem' }}>{row.categoria}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '800', color: '#6366f1' }}>{Math.round(row.layers)}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '700', color: '#0ea5e9' }}>{Number(row.kilos).toFixed(2)} kg</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* Distribución por tallas */}
              {(() => {
                type SizeEntry = { size_id: string; quantity: number };
                const sizeMap: Record<string, number> = {};
                viewCuts.forEach((cut: any) => {
                  (cut.cut_sizes || []).forEach((cs: SizeEntry) => {
                    const label = sizes.find(s => String(s.id) === String(cs.size_id))?.codigo_talla || `Talla ${cs.size_id}`;
                    sizeMap[label] = (sizeMap[label] || 0) + (Number(cs.quantity) || 0);
                  });
                });
                const entries = Object.entries(sizeMap).sort((a, b) => a[0].localeCompare(b[0]));
                const totalUnds = entries.reduce((s, [, v]) => s + v, 0);
                if (entries.length === 0) return null;
                return (
                  <div>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Package size={16} style={{ color: 'var(--primary)' }} /> Distribución por Tallas — <span style={{ color: '#10b981' }}>{totalUnds} unidades</span>
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                      {entries.map(([talla, qty]) => (
                        <div key={talla} style={{ backgroundColor: '#f0fdf4', border: '2px solid #86efac', borderRadius: '12px', padding: '0.75rem 1.25rem', textAlign: 'center', minWidth: '80px' }}>
                          <p style={{ fontSize: '0.65rem', fontWeight: '800', color: '#16a34a', margin: '0 0 0.2rem 0', textTransform: 'uppercase' }}>{talla}</p>
                          <p style={{ fontSize: '1.5rem', fontWeight: '900', color: '#065f46', margin: 0 }}>{qty}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Relación por Categorías */}
              {(() => {
                // Agrupar cuts por categoría (vía product_id → category_id)
                const catMap: Record<string, { nombre: string; units: number; cuts: number }> = {};
                viewCuts.forEach((cut: any) => {
                  const prod = products.find((p: any) => String(p.id) === String(cut.product_id));
                  const cat = prod ? categories.find((c: any) => String(c.id) === String(prod.category_id)) : null;
                  const catKey = cat?.id || 'sin_categoria';
                  const catNombre = cat?.categoria || 'Sin Categoría';
                  const totalQty = (cut.cut_sizes || []).reduce((s: number, cs: any) => s + (Number(cs.quantity) || 0), 0);
                  if (!catMap[catKey]) catMap[catKey] = { nombre: catNombre, units: 0, cuts: 0 };
                  catMap[catKey].units += totalQty;
                  catMap[catKey].cuts += 1;
                });
                const catEntries = Object.entries(catMap).sort((a, b) => a[1].nombre.localeCompare(b[1].nombre));
                if (catEntries.length === 0) return null;
                const totalCatUnits = catEntries.reduce((s, [, v]) => s + v.units, 0);

                // Paleta de colores para las categorías
                const palette = ['#6366f1', '#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

                return (
                  <div>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <ChevronRight size={16} style={{ color: 'var(--primary)' }} /> Relación por Categorías — <span style={{ color: '#6366f1' }}>{totalCatUnits} unidades</span>
                    </h3>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f1f5f9' }}>
                            <th style={{ padding: '0.65rem 1rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textAlign: 'left', textTransform: 'uppercase' }}>Categoría</th>
                            <th style={{ padding: '0.65rem 1rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textAlign: 'center', textTransform: 'uppercase' }}>Cortes</th>
                            <th style={{ padding: '0.65rem 1rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textAlign: 'center', textTransform: 'uppercase' }}>Unidades</th>
                            <th style={{ padding: '0.65rem 1rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textAlign: 'left', textTransform: 'uppercase' }}>% del Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {catEntries.map(([key, cat], i) => {
                            const pct = totalCatUnits > 0 ? Math.round((cat.units / totalCatUnits) * 100) : 0;
                            const color = palette[i % palette.length];
                            return (
                              <tr key={key} style={{ borderTop: '1px solid #f1f5f9', backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
                                    <span style={{ fontWeight: '700', fontSize: '0.875rem' }}>{cat.nombre}</span>
                                  </div>
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.85rem', color: '#64748b', fontWeight: '700' }}>{cat.cuts}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '900', fontSize: '1rem', color: color }}>{cat.units}</td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ flex: 1, height: '8px', backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                                      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: '999px', transition: 'width 0.3s' }} />
                                    </div>
                                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', minWidth: '32px' }}>{pct}%</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          <tr style={{ backgroundColor: '#0f172a', color: 'white' }}>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: '900', fontSize: '0.8rem' }}>TOTAL</td>
                            <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '900' }}>{catEntries.reduce((s, [, v]) => s + v.cuts, 0)}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '900', fontSize: '1rem' }}>{totalCatUnits}</td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: '800', fontSize: '0.8rem' }}>100%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}


              {/* Observaciones */}
              {viewingOrder.observaciones && (
                <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '12px', padding: '1rem 1.25rem' }}>
                  <p style={{ fontSize: '0.7rem', fontWeight: '800', color: '#92400e', textTransform: 'uppercase', margin: '0 0 0.35rem 0' }}>Notas / Observaciones</p>
                  <p style={{ fontSize: '0.9rem', color: '#78350f', margin: 0 }}>{viewingOrder.observaciones}</p>
                </div>
              )}

            </div>

            {/* Footer */}
            <div style={{ padding: '1rem 2rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', backgroundColor: '#f8fafc' }}>
              <button onClick={() => { setViewingOrder(null); setViewCuts([]); }} className="btn btn-secondary" style={{ padding: '0.6rem 1.5rem', fontWeight: '700' }}>Cerrar</button>
              <button onClick={() => window.print()} className="btn" style={{ padding: '0.6rem 1.5rem', fontWeight: '700', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Printer size={16} /> Imprimir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WIZARD MODAL */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(10px)' }}>
          <div className="card" style={{ width: '72vw', maxWidth: '1400px', padding: '0', maxHeight: '92vh', overflowY: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 60px -10px rgba(0, 0, 0, 0.6)', borderRadius: '20px' }}>
            
            {/* Wizard Header */}
            <div style={{ padding: '1.5rem 2.5rem', background: 'linear-gradient(135deg, #0f172a, #1e3a5f)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '20px 20px 0 0' }}>
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
                          {Array.from(new Set(fabrics.filter(f => (Number(f.metros) || 0) > 0).map(f => f.factura_relacionada).filter(Boolean))).map(factura => (
                            <option key={String(factura)} value={String(factura)}>{String(factura)}</option>
                          ))}
                        </select>
                        <button id="btn-buscar-telas" className="btn btn-primary" onClick={fetchFacturaFabrics} style={{ padding: '0 1rem', fontWeight: '800' }}>
                          <Search size={18} style={{ marginRight: '0.4rem' }} /> Cargar Telas
                        </button>
                        <button 
                          className="btn" 
                          onClick={() => fetchAndAppendFacturaFabrics(formData.factura_relacionada)} 
                          style={{ padding: '0 1rem', fontWeight: '800', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                        >
                          <Plus size={18} /> Sumar Factura
                        </button>
                      </div>
                    </div>
                    <div className="input-group">
                      <label style={{ fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Factor Longitud (Divisor)</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        min="0.01" 
                        value={longitud} 
                        onChange={e => handleLongitudChange(e.target.value)} 
                        style={{ padding: '0.875rem', borderRadius: '10px', border: '2.5px solid #e2e8f0', fontWeight: '900', color: 'var(--primary)', fontSize: '1.125rem', backgroundColor: 'white', width: '100%' }} 
                      />
                    </div>
                  </div>

                  {/* CONFIGURACIÓN DE COLORES Y CAPAS (ANTES PASO 2) */}
                  <div style={{ marginTop: '1rem', borderTop: '2px solid #f1f5f9', paddingTop: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: '900', color: '#0f172a' }}>Distribución de Colores y Capas</h3>
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
                            <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '800', color: '#0ea5e9' }}>METROS TOTALES</th>
                            <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '800', color: '#6366f1' }}>CAPAS ESTIMADAS</th>
                            <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: '800', color: '#f59e0b' }}>LONGITUD</th>
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
                                {fc.metros && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '800' }}>{fc.metros}</div>}
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                <div style={{ fontWeight: '800', fontSize: '0.95rem', color: '#0ea5e9' }}>
                                  {fc.metros ? Number(fc.metros).toFixed(2) : '---'}
                                </div>
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                <div style={{ fontWeight: '900', fontSize: '0.95rem', color: '#6366f1', backgroundColor: '#eef2ff', padding: '0.35rem 0.6rem', borderRadius: '8px', border: '1px solid #a5b4fc', display: 'inline-block', minWidth: '60px' }}>
                                  {fc.metros && Number(longitud) > 0 ? (Number(fc.metros) / Number(longitud)).toFixed(2) : '---'}
                                </div>
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  placeholder={!fc.metros || Number(fc.metros) <= 0 ? "Sin Tela" : longitud}
                                  value={fc.longitud_row !== undefined ? fc.longitud_row : ''}
                                  onChange={e => updateFabricColor(fc.id, 'longitud_row', e.target.value)}
                                  disabled={!fc.metros || Number(fc.metros) <= 0}
                                  style={{ width: '75px', padding: '0.5rem', borderRadius: '8px', border: '1.5px solid #fcd34d', textAlign: 'center', fontWeight: '800', color: (!fc.metros || Number(fc.metros) <= 0) ? '#94a3b8' : '#92400e', backgroundColor: (!fc.metros || Number(fc.metros) <= 0) ? '#e2e8f0' : '#fffbeb', cursor: (!fc.metros || Number(fc.metros) <= 0) ? 'not-allowed' : 'text' }}
                                />
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                 {(() => {
                                   const longitudNum = Number(longitud);
                                   const rowLng = fc.longitud_row && Number(fc.longitud_row) > 0 ? Number(fc.longitud_row) : null;
                                   const capasCalc = rowLng && longitudNum > 0 ? Math.round(rowLng / longitudNum) : '---';
                                   // sync layers state
                                   const numVal = rowLng && longitudNum > 0 ? Math.round(rowLng / longitudNum) : '';
                                   if (fc.layers !== numVal) {
                                     setTimeout(() => updateFabricColor(fc.id, 'layers', numVal), 0);
                                   }
                                   return (
                                     <div style={{ fontWeight: '900', fontSize: '1rem', color: '#0f172a', backgroundColor: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid #e2e8f0', display: 'inline-block', minWidth: '80px' }}>
                                       {capasCalc}
                                     </div>
                                   );
                                 })()}
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
                        <p style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Total Metros Tela</p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--primary)' }}>{totalKilos.toFixed(2)}</h3>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '0.7rem', fontWeight: '800', color: '#6366f1', textTransform: 'uppercase' }}>Total Longitudes</p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#6366f1' }}>
                          {fabricColors.reduce((sum, fc) => sum + (fc.longitud_row ? Number(fc.longitud_row) : 0), 0).toFixed(2)}
                        </h3>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '0.7rem', fontWeight: '800', color: isOverLimit ? '#ef4444' : '#64748b', textTransform: 'uppercase' }}>Total Capas Programadas</p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: isOverLimit ? '#ef4444' : '#1e293b' }}>{step2TotalLayers}</h3>
                      </div>
                    </div>
                  </div>

                  {/* --- SECCIÓN DE CORTES ADICIONALES --- */}
                  <div style={{ marginTop: '2rem', borderTop: '2.5px dashed #cbd5e1', paddingTop: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                      <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '950', color: '#0f172a', margin: 0 }}>Cortes Adicionales</h3>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>Seleccione facturas y telas adicionales para otros cortes.</p>
                      </div>
                      <button type="button" className="btn btn-secondary" onClick={addCorteAdicional} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: '800', backgroundColor: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe' }}>
                        <Plus size={16} /> Adicionar Corte
                      </button>
                    </div>

                    {cortesAdicionales.map((corte, corteIdx) => {
                      return (
                        <div key={corte.id} style={{ border: '2px solid #cbd5e1', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'white', marginBottom: '1.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: '900', margin: 0, color: '#0f172a' }}>{corte.nombre}</h3>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                              <button type="button" onClick={() => syncCorteLayers(corte.id)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', fontWeight: '800', backgroundColor: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <RefreshCw size={14} /> Sincronizar Capas
                              </button>
                              <button type="button" onClick={() => removeCorteAdicional(corte.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Trash2 size={18} /> Eliminar Corte
                              </button>
                            </div>
                          </div>

                          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
                              <div className="input-group">
                                <label style={{ fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Factura de Telas</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <select 
                                    style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '2px solid #e2e8f0', fontWeight: '700', backgroundColor: 'white' }} 
                                    value={corte.factura} 
                                    onChange={e => updateCorteField(corte.id, 'factura', e.target.value)} 
                                  >
                                    <option value="">Seleccionar Factura...</option>
                                    {Array.from(new Set(fabrics.filter(f => (Number(f.metros) || 0) > 0).map(f => f.factura_relacionada).filter(Boolean))).map(factura => (
                                      <option key={String(factura)} value={String(factura)}>{String(factura)}</option>
                                    ))}
                                  </select>
                                  <button type="button" className="btn btn-primary" onClick={() => fetchCorteAdicionalFabrics(corte.id, corte.factura)} style={{ padding: '0 1rem', fontWeight: '800' }}>
                                    <Search size={18} /> Cargar Telas
                                  </button>
                                </div>
                              </div>
                              <div className="input-group">
                                <label style={{ fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Factor Longitud</label>
                                <input 
                                  type="number" 
                                  step="0.01" 
                                  min="0.01" 
                                  value={corte.longitud} 
                                  onChange={e => updateCorteField(corte.id, 'longitud', e.target.value)} 
                                  style={{ padding: '0.75rem', borderRadius: '8px', border: '2px solid #e2e8f0', fontWeight: '900', color: 'var(--primary)' }} 
                                />
                              </div>
                            </div>

                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr style={{ textAlign: 'left', borderBottom: '2.5px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                                    <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)' }}>TELA (FACTURA)</th>
                                    <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textAlign: 'center' }}>N° CAPAS</th>
                                    <th style={{ padding: '1rem' }}></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {corte.fabricColors.map((fc: any, fcIdx: number) => {
                                    return (
                                      <tr key={fc.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '0.75rem' }}>
                                          <select
                                            style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontWeight: '700', backgroundColor: 'white' }}
                                            value={fc.fabric_id || ''}
                                            onChange={e => {
                                              const selectedFabricId = e.target.value;
                                              const foundFabric = fabrics.find(f => String(f.id) === String(selectedFabricId));
                                              updateCorteFabric(corte.id, fc.id, 'fabric_id', selectedFabricId || null);
                                              updateCorteFabric(corte.id, fc.id, 'nombre_tela', foundFabric ? foundFabric.nombre_tela : '');
                                              updateCorteFabric(corte.id, fc.id, 'metros', foundFabric ? (foundFabric.metros || '') : '');
                                              updateCorteFabric(corte.id, fc.id, 'kilos', foundFabric ? (foundFabric.kilos || '') : '');
                                            }}
                                          >
                                            <option value="">Seleccionar Tela...</option>
                                            {fabrics
                                              .filter(f => !corte.factura || String(f.factura_relacionada) === String(corte.factura))
                                              .map(f => (
                                                <option key={f.id} value={f.id}>
                                                  {f.nombre_tela}
                                                </option>
                                              ))}
                                          </select>
                                        </td>
                                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                          <div style={{ fontWeight: '900', fontSize: '1rem', display: 'inline-block', color: '#0f172a', backgroundColor: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid #e2e8f0', minWidth: '60px' }}>{fc.layers || 0}</div>
                                        </td>
                                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                          <button type="button" onClick={() => removeCorteFabric(corte.id, fc.id)} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }}><Trash2 size={20} /></button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="input-group" style={{ marginTop: '1rem' }}>
                    <label style={{ fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Notas Adicionales</label>
                    <textarea style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '2.5px solid #e2e8f0', minHeight: '80px' }} value={formData.observaciones} onChange={e => setFormData({...formData, observaciones: e.target.value})} placeholder="Instrucciones para el cortador..." />
                  </div>

                  <button className="btn btn-primary" style={{ width: '100%', padding: '1.25rem', fontSize: '1.125rem', fontWeight: '900' }} 
                    onClick={() => {
                      const validColors = fabricColors.filter(fc => fc.nombre_tela || fc.fabric_id || fc.color_id);

                      // Validar límite de 125 capas
                      const totalCapasProgramadas = validColors.reduce((sum, fc) => sum + (Number(fc.layers) || 0), 0);
                      if (totalCapasProgramadas > 125) {
                        alert(`⚠️ El total de capas programadas es ${totalCapasProgramadas}, lo que supera el límite máximo permitido de 125 capas por orden. Por favor ajusta las capas antes de continuar.`);
                        return;
                      }

                      setFabricColors(validColors.length > 0 ? validColors : [{ id: Date.now(), color_id: '', kilos: '', layers: '', observation: '', capas_definidas: '' }]);

                      if (formData.product_id && matrixCols.length === 1 && !matrixCols[0].product_id) {
                        setMatrixCols([{ ...matrixCols[0], product_id: formData.product_id }]);
                      }
                      
                      // Auto-fill Step 2 grid: value = layers × marker (NO division by longitud)
                      const newCells: Record<string, number> = { ...matrixCells };
                      validColors.forEach(fc => {
                        if (Number(fc.layers) > 0) {
                          matrixCols.forEach(col => {
                            newCells[`${fc.id}_${col.id}_1`] = Math.round((Number(fc.layers) || 0) * (col.marker1 === '' ? 0 : Number(col.marker1)));
                            newCells[`${fc.id}_${col.id}_2`] = Math.round((Number(fc.layers) || 0) * (col.marker2 === '' ? 0 : Number(col.marker2)));
                          });
                        }
                      });
                      setMatrixCells(newCells);

                      // ALSO auto-fill additional cuts matrices (inherited identical matrix columns and symmetric layers x markers)
                      const updatedCortes = cortesAdicionales.map(corte => {
                        const corteCells = { ...corte.matrixCells };
                        const updatedFabricColors = corte.fabricColors.map((existingFc: any, fcIdx: number) => {
                          const parentFc = validColors[fcIdx];
                          const parentLayers = parentFc ? (Number(parentFc.layers) || 0) : 0;
                          const fc = {
                            ...existingFc,
                            layers: parentLayers,
                            longitud_row: String(parentLayers * (Number(corte.longitud) || 1))
                          };

                          matrixCols.forEach(col => {
                            corteCells[`${fc.id}_${col.id}_1`] = Math.round((Number(fc.layers) || 0) * (col.marker1 === '' ? 0 : Number(col.marker1)));
                            corteCells[`${fc.id}_${col.id}_2`] = Math.round((Number(fc.layers) || 0) * (col.marker2 === '' ? 0 : Number(col.marker2)));
                          });

                          return fc;
                        });
                        return {
                          ...corte,
                          fabricColors: updatedFabricColors,
                          matrixCols: matrixCols.map(col => ({ ...col })),
                          matrixCells: corteCells
                        };
                      });
                      setCortesAdicionales(updatedCortes);
                      
                      setStep(2);
                    }} 
                    disabled={fabricColors.filter(f => f.nombre_tela || f.fabric_id || f.color_id || Number(f.layers) > 0).length === 0}>
                    Continuar a Programación Técnica <ArrowRight size={24} style={{ marginLeft: '1rem' }} />
                  </button>
                </div>
              )}

              {/* STEP 2: PROGRAMACIÓN TÉCNICA (ANTES PASO 3) */}
              {step === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  
                  {/* --- TOTALS DASHBOARD --- */}
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
                      <p style={{ fontSize: '0.65rem', color: '#7dd3fc', fontWeight: '800', margin: '0 0 0.5rem 0' }}>METROS TELA</p>
                      <h3 style={{ fontSize: '1.75rem', fontWeight: '900', color: '#e0f2fe', margin: 0 }}>{totalKilos.toFixed(2)}</h3>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', gap: '1rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: '950', margin: 0, color: '#0f172a' }}>Matriz de Programación Técnica</h3>
                      <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>Configure las tallas y marcaciones de producción.</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <button className="btn btn-secondary" onClick={addCorteAdicional} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: '800', backgroundColor: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe' }}>
                        <Plus size={16} /> Adicionar Corte
                      </button>
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
                          title={`Fórmula: Longitud (${longitud}) / Divisor (${totalMarcacionesActivas})`}
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
                                  <option value="">Seleccionar Referencia...</option>
                                  {products
                                    .filter((prod, index, self) => prod.category_id ? index === self.findIndex(p => p.category_id === prod.category_id) : true)
                                    .map(prod => <option key={prod.id} value={prod.id}>{categories.find(c => String(c.id) === String(prod.category_id))?.categoria || prod.codigo_referencia || prod.nombre_producto}</option>)}
                                </select>
                                {matrixCols.length > 1 && (
                                  <button onClick={() => removeMatrixCol(col.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}><X size={16}/></button>
                                )}
                              </div>
                            </th>
                          ))}
                          {matrixCols.length < 8 && (
                            <th rowSpan={3} style={{ padding: '1rem', borderLeft: '2px solid #e2e8f0', backgroundColor: '#f1f5f9' }}>
                              <button className="btn btn-secondary" onClick={addMatrixCol} style={{ padding: '0.5rem', fontSize: '0.75rem' }}><Plus size={16}/> Referencia</button>
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
                                    {[0,1,2,3,4,5,6,7].map(v => <option key={v} value={v}>{v}</option>)}
                                  </select>
                                </div>
                              </th>
                              <th style={{ padding: '0.25rem 0.5rem', borderLeft: '1px dashed #e2e8f0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                                  <span style={{ fontSize: '0.6rem', fontWeight: '700', color: '#6366f1' }}>Marc.</span>
                                  <select style={{ padding: '0.15rem 0.25rem', border: '1px solid #a5b4fc', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '800', backgroundColor: '#e0e7ff', color: '#3730a3', width: '40px' }} value={col.marker2} onChange={e => updateMatrixCol(col.id, 'marker2', e.target.value)}>
                                    {[0,1,2,3,4,5,6,7].map(v => <option key={v} value={v}>{v}</option>)}
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
                      </tbody>
                    </table>
                  </div>

                  {/* ── CORTES ADICIONALES (MATRICES HEREDADAS) ── */}
                  {cortesAdicionales.map((corte, corteIdx) => {
                    const corteTotalKilos = corte.fabricColors.reduce((sum: number, fc: any) => sum + (fc.longitud_row && Number(fc.longitud_row) > 0 ? Number(fc.longitud_row) : (Number(fc.metros) || 0)), 0);
                    const corteTotalLayers = corte.fabricColors.reduce((acc: number, fc: any) => acc + (Number(fc.layers) || 0), 0);
                    const corteTotalMarcacionesActivas = corte.matrixCols.reduce((acc: number, col: any) => {
                      const m1 = Number(col.marker1) || 0;
                      const m2 = Number(col.marker2) || 0;
                      return acc + m1 + m2;
                    }, 0);
                    const corteLongitudNum = Number(corte.longitud) || 0;
                    const corteConsumoPrenda = corteTotalMarcacionesActivas > 0 ? (corteLongitudNum / corteTotalMarcacionesActivas).toFixed(3) : '0.000';

                    return (
                      <div key={corte.id} style={{ border: '2px solid #cbd5e1', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'white', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1', cursor: 'pointer' }} onClick={() => updateCorteField(corte.id, 'collapsed', !corte.collapsed)}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <ChevronRight size={20} style={{ transform: corte.collapsed ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform 0.2s', color: '#64748b' }} />
                            <h3 style={{ fontSize: '1.125rem', fontWeight: '900', margin: 0, color: '#0f172a' }}>{corte.nombre}</h3>
                          </div>
                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'white', padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1' }} onClick={e => e.stopPropagation()}>
                              <label style={{ fontSize: '0.7rem', fontWeight: '800', color: '#475569', whiteSpace: 'nowrap' }}>FACTOR LONGITUD (DIVISOR):</label>
                              <input 
                                type="number" 
                                step="0.01" 
                                min="0.01" 
                                value={corte.longitud} 
                                onChange={e => updateCorteField(corte.id, 'longitud', e.target.value)} 
                                style={{ width: '70px', padding: '0.25rem 0.4rem', borderRadius: '6px', border: '1.5px solid #cbd5e1', fontWeight: '900', textAlign: 'center', fontSize: '0.85rem', color: 'var(--primary)' }} 
                              />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'white', padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1' }} onClick={e => e.stopPropagation()}>
                              <label style={{ fontSize: '0.7rem', fontWeight: '800', color: '#475569', whiteSpace: 'nowrap' }}>CONSUMO / PRENDA:</label>
                              <input 
                                type="text" 
                                readOnly 
                                value={corteConsumoPrenda} 
                                title={`Fórmula: Longitud (${corte.longitud}) / Divisor (${corteTotalMarcacionesActivas})`}
                                style={{ width: '70px', padding: '0.25rem 0.4rem', borderRadius: '6px', border: '1.5px solid #cbd5e1', fontWeight: '900', textAlign: 'center', fontSize: '0.85rem', color: '#10b981', backgroundColor: '#f8fafc', cursor: 'not-allowed' }} 
                              />
                            </div>
                            <button type="button" onClick={(e) => { e.stopPropagation(); syncCorteAdicionalMatrix(corte.id); }} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', fontWeight: '800', backgroundColor: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <RefreshCw size={14} /> Sincronizar con Corte 1
                            </button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); removeCorteAdicional(corte.id); }} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', fontWeight: '800' }}>
                              <Trash2 size={18} /> Eliminar Corte
                            </button>
                          </div>
                        </div>
                        
                        {!corte.collapsed && (
                          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {/* --- MATRIZ DEL CORTE ADICIONAL --- */}
                            <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '12px' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                                <thead>
                                  <tr style={{ borderBottom: '2px solid #cbd5e1', backgroundColor: '#f8fafc' }}>
                                    <th rowSpan={3} style={{ padding: '1rem', textAlign: 'left', backgroundColor: '#0f172a', color: 'white', minWidth: '200px', fontSize: '0.75rem' }}>
                                      MATRIZ {corte.nombre.toUpperCase()}
                                    </th>
                                    {corte.matrixCols.map((col: any) => (
                                      <th key={col.id} colSpan={2} style={{ padding: '0.5rem', borderLeft: '2px solid #e2e8f0' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <select style={{ width: '100%', padding: '0.5rem', border: 'none', background: 'transparent', fontWeight: '900', fontSize: '0.875rem' }} value={col.product_id} onChange={e => updateCorteMatrixCol(corte.id, col.id, 'product_id', e.target.value)}>
                                            <option value="">Seleccionar Referencia...</option>
                                            {products
                                              .filter((prod, index, self) => prod.category_id ? index === self.findIndex(p => p.category_id === prod.category_id) : true)
                                              .map(prod => <option key={prod.id} value={prod.id}>{categories.find(c => String(c.id) === String(prod.category_id))?.categoria || prod.codigo_referencia || prod.nombre_producto}</option>)}
                                          </select>
                                          {corte.matrixCols.length > 1 && (
                                            <button type="button" onClick={() => removeCorteMatrixCol(corte.id, col.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}><X size={16}/></button>
                                          )}
                                        </div>
                                      </th>
                                    ))}
                                    {corte.matrixCols.length < 8 && (
                                      <th rowSpan={3} style={{ padding: '1rem', borderLeft: '2px solid #cbd5e1', backgroundColor: '#f8fafc' }}>
                                        <button type="button" className="btn btn-secondary" onClick={() => addCorteMatrixCol(corte.id)} style={{ padding: '0.5rem', fontSize: '0.75rem' }}><Plus size={16}/> Referencia</button>
                                      </th>
                                    )}
                                  </tr>
                                  <tr style={{ borderBottom: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}>
                                    {corte.matrixCols.map((col: any) => (
                                      <React.Fragment key={`${col.id}-sizes`}>
                                        <th style={{ padding: '0.5rem', borderLeft: '2px solid #e2e8f0' }}>
                                          <select style={{ width: '100%', padding: '0.25rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700', backgroundColor: 'white' }} value={col.size1_id} onChange={e => updateCorteMatrixCol(corte.id, col.id, 'size1_id', e.target.value)}>
                                            <option value="">Talla 1...</option>
                                            {sizes.map(s => <option key={s.id} value={s.id}>{s.codigo_talla}</option>)}
                                          </select>
                                        </th>
                                        <th style={{ padding: '0.5rem', borderLeft: '1px dashed #e2e8f0' }}>
                                          <select style={{ width: '100%', padding: '0.25rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700', backgroundColor: 'white' }} value={col.size2_id} onChange={e => updateCorteMatrixCol(corte.id, col.id, 'size2_id', e.target.value)}>
                                            <option value="">Talla 2...</option>
                                            {sizes.map(s => <option key={s.id} value={s.id}>{s.codigo_talla}</option>)}
                                          </select>
                                        </th>
                                      </React.Fragment>
                                    ))}
                                  </tr>
                                  <tr style={{ borderBottom: '2px solid #cbd5e1', backgroundColor: '#eef2ff' }}>
                                    {corte.matrixCols.map((col: any) => (
                                      <React.Fragment key={`${col.id}-markers`}>
                                        <th style={{ padding: '0.25rem 0.5rem', borderLeft: '2px solid #cbd5e1' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                                            <span style={{ fontSize: '0.6rem', fontWeight: '700', color: '#6366f1' }}>Marc.</span>
                                            <select style={{ padding: '0.15rem 0.25rem', border: '1px solid #a5b4fc', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '800', backgroundColor: '#e0e7ff', color: '#3730a3', width: '40px' }} value={col.marker1} onChange={e => updateCorteMatrixCol(corte.id, col.id, 'marker1', e.target.value)}>
                                              {[0,1,2,3,4,5,6,7].map(v => <option key={v} value={v}>{v}</option>)}
                                            </select>
                                          </div>
                                        </th>
                                        <th style={{ padding: '0.25rem 0.5rem', borderLeft: '1px dashed #cbd5e1' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                                            <span style={{ fontSize: '0.6rem', fontWeight: '700', color: '#6366f1' }}>Marc.</span>
                                            <select style={{ padding: '0.15rem 0.25rem', border: '1px solid #a5b4fc', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '800', backgroundColor: '#e0e7ff', color: '#3730a3', width: '40px' }} value={col.marker2} onChange={e => updateCorteMatrixCol(corte.id, col.id, 'marker2', e.target.value)}>
                                              {[0,1,2,3,4,5,6,7].map(v => <option key={v} value={v}>{v}</option>)}
                                            </select>
                                          </div>
                                        </th>
                                      </React.Fragment>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {corte.fabricColors.map((fc: any, i: number) => {
                                    const colData = colors.find(c => c.id === fc.color_id);
                                    const fabricName = fc.nombre_tela || colData?.nombre_color || 'Tela Base';
                                    return (
                                      <tr key={fc.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '800', borderRight: '2px solid #cbd5e1', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: colData?.hex_color || '#94a3b8', flexShrink: 0 }}></div>
                                            <span>{fabricName}</span>
                                            <span style={{ color: '#64748b', fontWeight: '600' }}>/ {fc.layers || 0} capas</span>
                                          </div>
                                        </td>
                                        {corte.matrixCols.map((col: any) => {
                                           const val1 = corte.matrixCells[`${fc.id}_${col.id}_1`] || '';
                                           const val2 = corte.matrixCells[`${fc.id}_${col.id}_2`] || '';
                                           return (
                                             <React.Fragment key={`${col.id}-cells`}>
                                               <td style={{ padding: '0', borderLeft: '2px solid #cbd5e1', verticalAlign: 'middle' }}>
                                                 <input type="number" style={{ width: '100%', height: '100%', minHeight: '40px', padding: '0.5rem', border: 'none', textAlign: 'center', fontWeight: val1 ? '900' : '500', fontSize: '1rem', outline: 'none', backgroundColor: val1 ? '#ecfdf5' : 'transparent', color: val1 ? '#065f46' : 'inherit' }} value={val1} onChange={e => updateCorteMatrixCell(corte.id, fc.id, col.id, 1, e.target.value)} />
                                               </td>
                                               <td style={{ padding: '0', borderLeft: '1px dashed #cbd5e1', verticalAlign: 'middle' }}>
                                                 <input type="number" style={{ width: '100%', height: '100%', minHeight: '40px', padding: '0.5rem', border: 'none', textAlign: 'center', fontWeight: val2 ? '900' : '500', fontSize: '1rem', outline: 'none', backgroundColor: val2 ? '#ecfdf5' : 'transparent', color: val2 ? '#065f46' : 'inherit' }} value={val2} onChange={e => updateCorteMatrixCell(corte.id, fc.id, col.id, 2, e.target.value)} />
                                               </td>
                                             </React.Fragment>
                                           );
                                        })}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                              <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b' }}>TOTAL METROS TELA</p>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--primary)' }}>{corteTotalKilos.toFixed(2)}</h3>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: '0.7rem', fontWeight: '800', color: '#6366f1' }}>TOTAL LONGITUDES</p>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: '#6366f1' }}>
                                  {corte.fabricColors.reduce((sum: number, fc: any) => sum + (fc.longitud_row ? Number(fc.longitud_row) : 0), 0).toFixed(2)}
                                </h3>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b' }}>TOTAL CAPAS PROGRAMADAS</p>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: '#1e293b' }}>{corteTotalLayers}</h3>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {/* ────────────────────────── */}

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
                          <p style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', margin: '0 0 0.25rem 0' }}>TOTAL LONGITUDES</p>
                          <p style={{ fontSize: '1.25rem', fontWeight: '900', margin: 0, color: '#6366f1' }}>
                            {fabricColors.reduce((sum, fc) => sum + (fc.longitud_row ? Number(fc.longitud_row) : 0), 0).toFixed(2)}
                          </p>
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
                            <th style={{ padding: '0.6rem 1rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textAlign: 'center', border: '1px solid #e2e8f0' }}>METROS</th>
                            <th style={{ padding: '0.6rem 1rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textAlign: 'center', border: '1px solid #e2e8f0' }}>KILOS</th>
                            <th style={{ padding: '0.6rem 1rem', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textAlign: 'center', border: '1px solid #e2e8f0' }}>ESTADO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                             const allFabrics = [
                               ...fabricColors.filter(fc => fc.nombre_tela || fc.fabric_id).map(fc => ({ ...fc, isExtra: false, corteName: 'Corte 1' })),
                               ...cortesAdicionales.flatMap(corte => corte.fabricColors.filter((fc: any) => fc.nombre_tela || fc.fabric_id).map((fc: any) => ({ ...fc, isExtra: true, corteName: corte.nombre, longitud: corte.longitud })))
                             ];
                             return allFabrics.map((fc: any, i) => {
                              const capEst = Number(fc.capas_definidas) || 0;
                              const capProg = Math.round(Number(fc.layers) || 0);
                              const over = capEst > 0 && capProg > capEst;
                              const displayName = fc.isExtra ? `${fc.corteName} - ${fc.nombre_tela || 'Tela'}` : (fc.nombre_tela || `Tela #${i+1}`);
                              const estimatedMetros = fc.longitud_row && Number(fc.longitud_row) > 0 
                                ? Number(fc.longitud_row) 
                                : (capProg * (fc.isExtra ? (Number(fc.longitud) || 1) : longitudNum));
                              
                              const kilosRatio = (Number(fc.kilos) && Number(fc.metros)) ? (Number(fc.kilos) / Number(fc.metros)) : 0;
                              const estimatedKilos = kilosRatio > 0 ? (estimatedMetros * kilosRatio) : 0;

                              return (
                                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: over ? '#fef2f2' : 'white' }}>
                                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: '700', border: '1px solid #e2e8f0' }}>{displayName}</td>
                                  <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.85rem', color: '#64748b', fontWeight: '700', border: '1px solid #e2e8f0' }}>{capEst || '---'}</td>
                                  <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.85rem', fontWeight: '900', color: over ? '#ef4444' : '#1e293b', border: '1px solid #e2e8f0' }}>{capProg}</td>
                                  <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.85rem', color: '#0369a1', fontWeight: '700', border: '1px solid #e2e8f0' }}>{estimatedMetros.toFixed(2)}</td>
                                  <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.85rem', color: '#b45309', fontWeight: '700', border: '1px solid #e2e8f0' }}>{estimatedKilos > 0 ? estimatedKilos.toFixed(2) : '---'}</td>
                                  <td style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                                    {over
                                      ? <span style={{ backgroundColor: '#fee2e2', color: '#b91c1c', fontSize: '0.7rem', fontWeight: '800', padding: '0.2rem 0.6rem', borderRadius: '999px' }}>⚠ EXCEDE</span>
                                      : <span style={{ backgroundColor: '#dcfce7', color: '#166534', fontSize: '0.7rem', fontWeight: '800', padding: '0.2rem 0.6rem', borderRadius: '999px' }}>✓ OK</span>
                                    }
                                  </td>
                                </tr>
                              );
                            });
                          })()}
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
                        { l: 'Telas Programadas', v: fabricColors.filter(fc => fc.nombre_tela || fc.fabric_id).length + cortesAdicionales.reduce((sum, c) => sum + c.fabricColors.filter((fc: any) => fc.nombre_tela || fc.fabric_id).length, 0) },
                        { l: 'Total Capas', v: Math.round(totalLayersSummary) },
                        { l: 'Total Longitudes', v: fabricColors.reduce((sum, fc) => sum + (fc.longitud_row ? Number(fc.longitud_row) : 0), 0).toFixed(2) },
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
                              <td style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.8rem', fontWeight: '700' }}>
                                {(() => {
                                  const prod = products.find(p => String(p.id) === String(item.product_id));
                                  const cat = prod ? categories.find(c => String(c.id) === String(prod.category_id)) : null;
                                  return cat ? cat.categoria : (prod ? (prod.codigo_referencia || prod.nombre_producto) : '---');
                                })()}
                              </td>
                              <td style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.8rem' }}>{item.nombre_tela || '---'}</td>
                              <td style={{ border: '1px solid #e2e8f0', padding: '0.5rem', fontSize: '0.8rem', textAlign: 'center' }}>{sizes.find(s => String(s.id) === String(item.size_id))?.codigo_talla || '---'}</td>
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
