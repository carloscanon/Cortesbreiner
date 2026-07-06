'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { syncOrderMovements } from '@/lib/inventory-sync';
import {
  Truck, Factory, CheckCircle, Clock, Search,
  Loader2, Package, ArrowRight, ArrowLeft, Plus, X,
  Scissors, Layers, ShirtIcon, Clipboard, Tag, Printer
} from 'lucide-react';

type Stage = 'matriz_corte' | 'talleres';

const fetchAll = async (queryFn: () => any) => {
  let allData: any[] = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await queryFn().range(from, from + step - 1);
    if (error) throw error;
    if (data && data.length > 0) {
      allData = [...allData, ...data];
      from += step;
      if (data.length < step) break;
    } else {
      break;
    }
  }
  return allData;
};

export default function SewingPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [accessories, setAccessories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categoriesMaster, setCategoriesMaster] = useState<any[]>([]);
  const [fabricsMaster, setFabricsMaster] = useState<any[]>([]);
  const [sizesMaster, setSizesMaster] = useState<any[]>([]);
  const [colorsMaster, setColorsMaster] = useState<any[]>([]);
  const [productAccessoriesList, setProductAccessoriesList] = useState<any[]>([]);
  const [sewingOrders, setSewingOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Wizard state
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [currentStage, setCurrentStage] = useState<Stage>('matriz_corte');
  const [saving, setSaving] = useState(false);

  // Form data
  const [prepNotes, setPrepNotes] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
  const [workshopNotes, setWorkshopNotes] = useState('');
  const [rowWorkshops, setRowWorkshops] = useState<Record<string, string>>({}); // key is catId_size, value is workshopId
  const [cutAccessories, setCutAccessories] = useState<Record<string, { accId: string; qty: string }[]>>({}); // key is cutId, value is list of accessories
  const [specialRates, setSpecialRates] = useState<Record<string, string>>({}); // key is workshopId_productId, value is special rate string

  // Inline inputs for cut accessories
  const [inlineAccId, setInlineAccId] = useState<Record<string, string>>({}); // cutId -> accId
  const [inlineAccQty, setInlineAccQty] = useState<Record<string, string>>({}); // cutId -> qty

  // Print state variables
  const [printOrder, setPrintOrder] = useState<any>(null);
  const [printWorkshop, setPrintWorkshop] = useState<any>(null);
  const [printSewingOrder, setPrintSewingOrder] = useState<any>(null); // sewing_order seleccionado para imprimir
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [customGafetes, setCustomGafetes] = useState<Record<string, string>>({});
  const [printMode, setPrintMode] = useState<'report' | 'sticker'>('report');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { data: ordersData, error: ordersError },
        { data: workshopsData, error: workshopsError },
        { data: accData, error: accError },
        { data: catData, error: catError },
        { data: fabData, error: fabError },
        { data: sizesData, error: sizesError },
        { data: colorsData, error: colorsError },
        productsList,
        allProductAccs,
        { data: sewingOrdersData, error: sewingOrdersError }
      ] = await Promise.all([
        supabase
          .from('orders')
          .select('*, fabrics(nombre_tela), workshops(nombre_taller, responsable), cuts(*, cut_sizes(*))')
          .in('status', ['Cortado', 'En Confección', 'Terminada', 'Enviada'])
          .order('created_at', { ascending: false }),
        supabase.from('workshops').select('*').order('nombre_taller'),
        supabase.from('accessories').select('*').order('nombre'),
        supabase.from('categories').select('*'),
        supabase.from('fabrics').select('*'),
        supabase.from('sizes').select('*').order('orden_visual', { ascending: true }),
        supabase.from('colors').select('*'),
        fetchAll(() => supabase.from('products').select('*')),
        fetchAll(() => supabase.from('product_accessories').select('*, accessories(nombre, unidad_medida), products(nombre_producto)')),
        supabase.from('sewing_orders').select('*, parent_order:orders(*, fabrics(nombre_tela), cuts(*, cut_sizes(*))), products(*), workshops(*), sewing_order_sizes(*, sizes(*))')
      ]);

      if (ordersError) throw ordersError;
      if (workshopsError) throw workshopsError;
      if (accError) throw accError;
      if (catError) throw catError;
      if (fabError) throw fabError;
      if (sizesError) throw sizesError;
      if (colorsError) throw colorsError;
      if (sewingOrdersError) throw sewingOrdersError;

      setOrders(ordersData || []);
      setWorkshops(workshopsData || []);
      setAccessories(accData || []);
      setProducts(productsList || []);
      setCategoriesMaster(catData || []);
      setFabricsMaster(fabData || []);
      setSizesMaster(sizesData || []);
      setColorsMaster(colorsData || []);
      setProductAccessoriesList(allProductAccs || []);
      setSewingOrders(sewingOrdersData || []);
    } catch (err: any) {
      console.error('Error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const openWizard = (order: any) => {
    setSelectedOrder(order);
    setCurrentStage('matriz_corte');
    setPrepNotes('');
    setDeliveryDate(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
    setWorkshopNotes('');
    setRowWorkshops({});
    setCutAccessories({});
    setInlineAccId({});
    setInlineAccQty({});
    setSpecialRates({});
  };

  // Add accessory to specific cut (Reference + Color)
  const addAccessoryToCut = (cutId: string) => {
    const accId = inlineAccId[cutId];
    const cut = selectedOrder.cuts.find((c: any) => String(c.id) === String(cutId));
    const defaultQty = cut ? String(cut.layers_produced || 0) : '0';
    const qty = inlineAccQty[cutId] || defaultQty;
    if (!accId || !qty) return;

    setCutAccessories(prev => {
      const list = prev[cutId] || [];
      return {
        ...prev,
        [cutId]: [...list, { accId, qty }]
      };
    });

    setInlineAccId(prev => ({ ...prev, [cutId]: '' }));
    setInlineAccQty(prev => ({ ...prev, [cutId]: '' }));
  };

  const removeAccessoryFromCut = (cutId: string, idx: number) => {
    setCutAccessories(prev => {
      const list = prev[cutId] || [];
      return {
        ...prev,
        [cutId]: list.filter((_, i) => i !== idx)
      };
    });
  };

  // Helper to build matrix rows
  const getMatrixData = (order: any) => {
    if (!order || !order.cuts) return { uniqueSizes: [], matrixRows: {} };

    const uniqueSizes: string[] = [];
    const matrixRows: Record<string, {
      fabricId: string;
      fabricName: string;
      productId: string;
      productName: string;
      categoryId: string;
      categoryName: string;
      colorId: string;
      colorName: string;
      sizes: Record<string, number>;
      total: number;
    }> = {};

    order.cuts.forEach((cut: any) => {
      const fabricId = String(cut.fabric_id);
      const fabricObj = fabricsMaster.find((f: any) => String(f.id) === fabricId);
      const fName = fabricObj ? fabricObj.nombre_tela : (order.fabrics?.nombre_tela || 'Tela Externa');

      const prod = products.find((p: any) => String(p.id) === String(cut.product_id));
      const prodName = prod ? prod.nombre_producto : 'Sin Referencia';
      const cat = prod ? categoriesMaster.find((c: any) => String(c.id) === String(prod.category_id)) : null;
      const catId = cat ? String(cat.id) : 'sin_cat';
      const catName = cat ? (cat.categoria || 'Sin Categoría') : 'Sin Categoría';

      const colorObj = colorsMaster.find((c: any) => String(c.id) === String(cut.color_id));
      const colorName = colorObj ? colorObj.nombre_color : 'Sin Color';

      const rowKey = `${fabricId}_${cut.product_id}_${cut.color_id || 'no_color'}`;
      if (!matrixRows[rowKey]) {
        matrixRows[rowKey] = {
          fabricId,
          fabricName: fName,
          productId: String(cut.product_id),
          productName: prodName,
          categoryId: catId,
          categoryName: catName,
          colorId: String(cut.color_id || ''),
          colorName: colorName,
          sizes: {},
          total: 0
        };
      }

      const layersProyec = cut.layers || 1;
      const layersProduced = cut.layers_produced || 0;

      (cut.cut_sizes || []).forEach((cs: any) => {
        const sizeObj = sizesMaster.find((s: any) => String(s.id) === String(cs.size_id));
        const sz = sizeObj ? sizeObj.codigo_talla : 'S/T';

        if (!uniqueSizes.includes(sz)) {
          uniqueSizes.push(sz);
        }

        let realQty = 0;
        if (cs.quantity_produced !== undefined && cs.quantity_produced !== null) {
          realQty = Number(cs.quantity_produced);
        } else {
          const proyecQty = Number(cs.quantity) || 0;
          const ppc = layersProyec > 0 ? proyecQty / layersProyec : 0;
          realQty = Math.round(ppc * layersProduced);
        }

        matrixRows[rowKey].sizes[sz] = (matrixRows[rowKey].sizes[sz] || 0) + realQty;
        matrixRows[rowKey].total += realQty;
      });
    });

    uniqueSizes.sort((a, b) => {
      const idxA = sizesMaster.findIndex(s => s.codigo_talla === a);
      const idxB = sizesMaster.findIndex(s => s.codigo_talla === b);
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });

    return { uniqueSizes, matrixRows };
  };

  const getSpreadsheetMatrixData = (order: any) => {
    if (!order || !order.cuts) return { orderCategories: [], categorySizes: {}, colorRows: [], categoryRatios: {} };

    const orderCategories: any[] = [];
    order.cuts.forEach((cut: any) => {
      const prod = products.find((p: any) => String(p.id) === String(cut.product_id));
      if (prod && !orderCategories.some(oc => oc.id === prod.id)) {
        orderCategories.push({
          id: prod.id,
          categoria: prod.nombre_producto
        });
      }
    });

    const categorySizes: Record<string, string[]> = {};
    orderCategories.forEach(cat => {
      const sizesSet = new Set<string>();
      order.cuts.forEach((cut: any) => {
        const prod = products.find((p: any) => String(p.id) === String(cut.product_id));
        if (prod && String(prod.id) === String(cat.id)) {
          (cut.cut_sizes || []).forEach((cs: any) => {
            const sizeObj = sizesMaster.find(s => String(s.id) === String(cs.size_id));
            if (sizeObj) {
              sizesSet.add(sizeObj.codigo_talla);
            }
          });
        }
      });
      const sortedSizes = Array.from(sizesSet).sort((a, b) => {
        const idxA = sizesMaster.findIndex(s => s.codigo_talla === a);
        const idxB = sizesMaster.findIndex(s => s.codigo_talla === b);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      });
      categorySizes[cat.id] = sortedSizes;
    });

    const fabricRowsMap: Record<string, {
      fabricId: string;
      fabricName: string;
      kilos: number;
      layers: number;
      quantities: Record<string, number>;
    }> = {};

    order.cuts.forEach((cut: any) => {
      const fabricId = String(cut.fabric_id);
      const fabricObj = fabricsMaster.find((f: any) => String(f.id) === fabricId);
      const fName = fabricObj ? fabricObj.nombre_tela : (order.fabrics?.nombre_tela || 'Tela Externa');

      const rowKey = fabricId;

      if (!fabricRowsMap[rowKey]) {
        fabricRowsMap[rowKey] = {
          fabricId,
          fabricName: fName,
          kilos: 0,
          layers: 0,
          quantities: {}
        };
      }

      fabricRowsMap[rowKey].kilos += Number(cut.kilos) || 0;
      fabricRowsMap[rowKey].layers += Number(cut.layers_produced || cut.layers || 0);

      const prod = products.find((p: any) => String(p.id) === String(cut.product_id));
      const catId = prod ? String(prod.id) : 'sin_prod';

      const layersProyec = cut.layers || 1;
      const layersProduced = cut.layers_produced || 0;

      (cut.cut_sizes || []).forEach((cs: any) => {
        const sizeObj = sizesMaster.find((s: any) => String(s.id) === String(cs.size_id));
        const sz = sizeObj ? sizeObj.codigo_talla : 'S/T';

        let realQty = 0;
        if (cs.quantity_produced !== undefined && cs.quantity_produced !== null) {
          realQty = Number(cs.quantity_produced);
        } else {
          const proyecQty = Number(cs.quantity) || 0;
          const ppc = layersProyec > 0 ? proyecQty / layersProyec : 0;
          realQty = Math.round(ppc * layersProduced);
        }

        const key = `${catId}_${sz}`;
        fabricRowsMap[rowKey].quantities[key] = (fabricRowsMap[rowKey].quantities[key] || 0) + realQty;
      });
    });

    const colorRows = Object.values(fabricRowsMap);

    const categoryRatios: Record<string, number> = {};
    order.cuts.forEach((cut: any) => {
      const prod = products.find((p: any) => String(p.id) === String(cut.product_id));
      const catId = prod ? String(prod.id) : 'sin_prod';
      const layersProyec = cut.layers || 1;

      (cut.cut_sizes || []).forEach((cs: any) => {
        const sizeObj = sizesMaster.find((s: any) => String(s.id) === String(cs.size_id));
        if (sizeObj) {
          const sz = sizeObj.codigo_talla;
          const key = `${catId}_${sz}`;
          const ratio = Math.round((Number(cs.quantity) || 0) / layersProyec);
          categoryRatios[key] = Math.max(categoryRatios[key] || 0, ratio);
        }
      });
    });

    return { orderCategories, categorySizes, colorRows, categoryRatios };
  };

  // Helper to build assignments grouped STRICTLY by Product and Size
  const getCategoryAssignmentsData = (order: any) => {
    const categoryAssignments: Record<string, {
      categoryId: string;
      categoryName: string;
      sizes: Record<string, number>;
      total: number;
    }> = {};

    if (!order || !order.cuts) return categoryAssignments;

    order.cuts.forEach((cut: any) => {
      const prod = products.find((p: any) => String(p.id) === String(cut.product_id));
      const catId = prod ? String(prod.id) : 'sin_prod';
      const catName = prod ? (prod.nombre_producto || 'Sin Referencia') : 'Sin Referencia';

      if (!categoryAssignments[catId]) {
        categoryAssignments[catId] = {
          categoryId: catId,
          categoryName: catName,
          sizes: {},
          total: 0
        };
      }

      const layersProyec = cut.layers || 1;
      const layersProduced = cut.layers_produced || 0;

      (cut.cut_sizes || []).forEach((cs: any) => {
        const sizeObj = sizesMaster.find((s: any) => String(s.id) === String(cs.size_id));
        const sz = sizeObj ? sizeObj.codigo_talla : 'S/T';

        let realQty = 0;
        if (cs.quantity_produced !== undefined && cs.quantity_produced !== null) {
          realQty = Number(cs.quantity_produced);
        } else {
          const proyecQty = Number(cs.quantity) || 0;
          const ppc = layersProyec > 0 ? proyecQty / layersProyec : 0;
          realQty = Math.round(ppc * layersProduced);
        }

        categoryAssignments[catId].sizes[sz] = (categoryAssignments[catId].sizes[sz] || 0) + realQty;
        categoryAssignments[catId].total += realQty;
      });
    });

    return categoryAssignments;
  };

  const handleFinalize = async () => {
    const categoryAssignments = getCategoryAssignmentsData(selectedOrder);
    
    // Check workshop assignment for every category_size combo with qty > 0
    const missingKeys: string[] = [];
    const assignments: { categoryId: string; categoryName: string; size: string; qty: number; wId: string }[] = [];
    
    Object.entries(categoryAssignments).forEach(([catId, cat]) => {
      Object.entries(cat.sizes).forEach(([sz, qty]) => {
        if (qty > 0) {
          const cellKey = `${catId}_${sz}`;
          const wId = rowWorkshops[cellKey];
          if (!wId) {
            missingKeys.push(cellKey);
          } else {
            assignments.push({
              categoryId: catId,
              categoryName: cat.categoryName,
              size: sz,
              qty,
              wId
            });
          }
        }
      });
    });

    if (missingKeys.length > 0) {
      return alert('Por favor, asigne un taller a todas las categorías y tallas que tengan unidades cortadas antes de formalizar.');
    }

    setSaving(true);
    try {
      // Build cut accessories log
      let cutAccLog = '';
      let hasCutAccs = false;
      Object.entries(cutAccessories).forEach(([cutId, accs]) => {
        if (accs.length > 0) {
          hasCutAccs = true;
        }
      });

      if (hasCutAccs) {
        cutAccLog = '\n\n[ACCESORIOS POR REFERENCIA Y COLOR]:\n';
        selectedOrder.cuts.forEach((cut: any) => {
          const accs = cutAccessories[cut.id] || [];
          if (accs.length > 0) {
            const prod = products.find(p => String(p.id) === String(cut.product_id));
            const colorObj = colorsMaster.find(c => String(c.id) === String(cut.color_id));
            cutAccLog += `▸ ${prod?.nombre_producto || 'Ref'} (${colorObj?.nombre_color || 'Color'}):\n`;
            accs.forEach(ca => {
              const accObj = accessories.find(a => String(a.id) === String(ca.accId));
              cutAccLog += `  - ${accObj?.nombre || 'Accesorio'}: ${ca.qty} ${accObj?.unidad_medida || 'u'}\n`;
            });
          }
        });
      }

      // Build workshop assignments log per category and talla
      let workshopLog = '\n\n[ASIGNACIÓN DE TALLERES POR TALLA Y CATEGORÍA]:\n';
      assignments.forEach(asg => {
        const workshop = workshops.find(w => String(w.id) === String(asg.wId));
        workshopLog += `▸ Categoría: ${asg.categoryName} - Talla ${asg.size} [${asg.qty} uds] ➔ Taller: ${workshop?.nombre_taller || 'Desconocido'} (${workshop?.responsable || '—'})\n`;
      });

      const firstWorkshopId = assignments[0]?.wId || null;
      const timestamp = new Date().toLocaleString('es-ES');
      const confLog = `\n\n=== ENTRADA A CONFECCIÓN (${timestamp}) ===\n` +
        `▸ Preparación: ${prepNotes || 'Sin novedades.'}\n` +
        cutAccLog +
        workshopLog +
        `▸ Fecha Compromiso: ${deliveryDate}\n` +
        (workshopNotes ? `▸ Notas: ${workshopNotes}` : '');

      const assignmentsJson = {
        rowWorkshops,
        cutAccessories,
        prepNotes,
        workshopNotes,
        deliveryDate
      };
      const serializedData = `\n\n<!--ASSIGNMENTS_JSON:${JSON.stringify(assignmentsJson)}-->`;

      const { error } = await supabase.from('orders').update({
        status: 'En Confección',
        workshop_id: firstWorkshopId,
        observaciones: (selectedOrder.observaciones || '') + confLog + serializedData
      }).eq('id', selectedOrder.id);

      if (error) throw error;

      // Prepare database records
      const assignmentsToInsert = assignments.map(asg => {
        return {
          order_id: selectedOrder.id,
          category_id: asg.categoryId,
          size_code: asg.size,
          workshop_id: asg.wId,
          quantity: asg.qty
        };
      });

      const accessoriesToInsert: any[] = [];
      if (selectedOrder && selectedOrder.cuts) {
        selectedOrder.cuts.forEach((cut: any) => {
          let totalCutQty = 0;
          const layersProyec = cut.layers || 1;
          const layersProduced = cut.layers_produced || 0;
          
          (cut.cut_sizes || []).forEach((cs: any) => {
            let realQty = 0;
            if (cs.quantity_produced !== undefined && cs.quantity_produced !== null) {
              realQty = Number(cs.quantity_produced);
            } else {
              const proyecQty = Number(cs.quantity) || 0;
              const ppc = layersProyec > 0 ? proyecQty / layersProyec : 0;
              realQty = Math.round(ppc * layersProduced);
            }
            totalCutQty += realQty;
          });

          if (totalCutQty <= 0) return;

          const prodObj = products.find(p => String(p.id) === String(cut.product_id));
          const prodName = prodObj?.nombre_producto;
          const prodAccs = productAccessoriesList.filter(pa => {
            if (String(pa.product_id) === String(cut.product_id)) return true;
            const paProdName = pa.products?.nombre_producto;
            return paProdName && prodName && paProdName.toLowerCase().trim() === prodName.toLowerCase().trim();
          });

          prodAccs.forEach(pa => {
            const qtyPerProduct = Number(pa.cantidad) || 0;
            const totalRequired = totalCutQty * qtyPerProduct;
            
            if (totalRequired > 0) {
              accessoriesToInsert.push({
                order_id: selectedOrder.id,
                cut_id: cut.id,
                accessory_id: pa.accessory_id,
                quantity: Math.round(totalRequired)
              });
            }
          });
        });
      }

      // Try database insertion
      try {
        // Limpiar asignaciones previas
        await supabase.from('sewing_orders').delete().eq('parent_order_id', selectedOrder.id);
        await supabase.from('sewing_accessories').delete().eq('order_id', selectedOrder.id);

        // Agrupar asignaciones por (taller_id, producto_id)
        const sewingOrdersMap: Record<string, {
          workshopId: string;
          productId: string;
          cantidadPlaneada: number;
          sizes: { sizeId: string; qty: number }[];
          specialRate: number | null;
        }> = {};

        assignments.forEach(asg => {
          const productId = asg.categoryId; // categoryId contiene realmente el product_id
          const key = `${asg.wId}_${productId}`;
          
          const sizeObj = sizesMaster.find(s => String(s.codigo_talla).toLowerCase() === String(asg.size).toLowerCase());
          const sizeId = sizeObj ? sizeObj.id : null;

          const specialRate = specialRates[key] ? Number(specialRates[key]) : null;

          if (!sewingOrdersMap[key]) {
            sewingOrdersMap[key] = {
              workshopId: asg.wId,
              productId,
              cantidadPlaneada: 0,
              sizes: [],
              specialRate
            };
          }

          sewingOrdersMap[key].cantidadPlaneada += asg.qty;
          if (sizeId) {
            sewingOrdersMap[key].sizes.push({ sizeId, qty: asg.qty });
          }
        });

        // Inicializar contador global de correlativos de confección
        let displayIdx = 0;

        const cleanCode = (selectedOrder.internal_code || '').replace(/^OC-?/i, '') || selectedOrder.consecutive || '—';

        // Insertar cada orden de confección independiente
        for (const lot of Object.values(sewingOrdersMap)) {
          displayIdx++;
          const confCode = `${cleanCode}-${displayIdx}`;

          // Insertar en sewing_orders
          const { data: insertedOrder, error: orderErr } = await supabase.from('sewing_orders').insert({
            parent_order_id: selectedOrder.id,
            confeccion_code: confCode,
            workshop_id: lot.workshopId,
            product_id: lot.productId,
            status: 'En Confección',
            cantidad_planeada: lot.cantidadPlaneada,
            cantidad_confeccionada: 0,
            tarifa_especial: lot.specialRate
          }).select().single();

          if (orderErr) throw orderErr;

          // Insertar todas las tallas asociadas en sewing_order_sizes
          if (insertedOrder && lot.sizes.length > 0) {
            const sizesToInsert = lot.sizes.map(s => ({
              sewing_order_id: insertedOrder.id,
              size_id: s.sizeId,
              cantidad_planeada: s.qty,
              cantidad_confeccionada: 0
            }));
            const { error: sizesErr } = await supabase.from('sewing_order_sizes').insert(sizesToInsert);
            if (sizesErr) console.warn("Error inserting sewing_order_sizes:", sizesErr.message);
          }
        }

        if (accessoriesToInsert.length > 0) {
          const { error: accDbErr } = await supabase.from('sewing_accessories').insert(accessoriesToInsert);
          if (accDbErr) console.warn("DB accessories insert failed:", accDbErr.message);
        }

        // ── MOVIMIENTOS DE INVENTARIO → estado: 'confeccion' ────────────────────────────
        await syncOrderMovements(selectedOrder.id, 'En Confección');
      } catch (dbErr: any) {
        console.warn("DB operations failed:", dbErr.message);
      }
      
      const orderWithAssignments = {
        ...selectedOrder,
        observaciones: (selectedOrder.observaciones || '') + confLog + serializedData,
        dbAssignments: assignmentsJson
      };
      
      setSelectedOrder(null);
      fetchData();
      setPrintOrder(orderWithAssignments);
      setShowPrintModal(true);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRevertToCortado = async (order: any) => {
    if (!window.confirm(`¿Seguro que deseas revertir el estado de la orden (OC-${(order.internal_code || '').replace(/^OC-?/i, '')}) a 'Cortado' y desasignar todos los talleres?`)) return;
    
    try {
      setSaving(true);
      
      // Limpiar logs y metadatos JSON de las observaciones de la orden
      let cleanObs = order.observaciones || '';
      cleanObs = cleanObs.replace(/=== ENTRADA A CONFECCIÓN[\s\S]*?(?=\n\n|$)/g, '');
      cleanObs = cleanObs.replace(/<!--ASSIGNMENTS_JSON:[\s\S]*?-->/g, '');
      cleanObs = cleanObs.trim();

      // Cambiar estado principal en Supabase
      const { error } = await supabase.from('orders').update({
        status: 'Cortado',
        workshop_id: null,
        observaciones: cleanObs
      }).eq('id', order.id);

      if (error) throw error;

      // Limpiar tablas relacionales
      try {
        await supabase.from('sewing_orders').delete().eq('parent_order_id', order.id);
        await supabase.from('sewing_accessories').delete().eq('order_id', order.id);
      } catch (dbErr) {
        console.warn("DB assignments delete warning:", dbErr);
      }

      // Sincronizar movimientos de inventario a estado 'corte'
      await syncOrderMovements(order.id, 'Cortado');

      alert('La orden ha sido revertida a Cortado y los talleres han sido desasignados.');
      fetchData();
    } catch (err: any) {
      alert('Error al revertir la orden: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const fetchOrderAssignmentsFromDB = async (orderId: string) => {
    try {
      const { data: assignmentsData, error: assError } = await supabase
        .from('sewing_assignments')
        .select('*')
        .eq('order_id', orderId);

      const { data: accessoriesData, error: accError } = await supabase
        .from('sewing_accessories')
        .select('*')
        .eq('order_id', orderId);

      if (assError || accError) {
        console.warn("Could not fetch assignments from DB, falling back to JSON serialization:", assError || accError);
        return null;
      }

      if (!assignmentsData || assignmentsData.length === 0) {
        return null;
      }

      // Reconstruct rowWorkshops
      const rowWorkshops: Record<string, string> = {};
      assignmentsData.forEach((asg: any) => {
        const cellKey = `${asg.category_id}_${asg.size_code}`;
        rowWorkshops[cellKey] = asg.workshop_id;
        
        // Map to product ID if saved as category ID
        const matchingProducts = products.filter(p => String(p.category_id) === String(asg.category_id));
        matchingProducts.forEach(p => {
          rowWorkshops[`${p.id}_${asg.size_code}`] = asg.workshop_id;
        });
      });

      // Reconstruct cutAccessories
      const cutAccessories: Record<string, { accId: string; qty: string }[]> = {};
      (accessoriesData || []).forEach((acc: any) => {
        if (!cutAccessories[acc.cut_id]) {
          cutAccessories[acc.cut_id] = [];
        }
        cutAccessories[acc.cut_id].push({
          accId: acc.accessory_id,
          qty: String(acc.quantity)
        });
      });

      return {
        rowWorkshops,
        cutAccessories
      };
    } catch (err) {
      console.error("Error fetching assignments from DB:", err);
      return null;
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

  const getAssignmentsData = (order: any) => {
    if (!order) return { rowWorkshops: {}, cutAccessories: {}, prepNotes: '', workshopNotes: '', deliveryDate: '' };
    
    let rawAss: any = null;
    if (order.dbAssignments) {
      rawAss = order.dbAssignments;
    } else {
      rawAss = getAssignmentsFromJson(order);
    }

    if (rawAss) {
      const rowWorkshops: Record<string, string> = {};
      if (rawAss.rowWorkshops) {
        Object.entries(rawAss.rowWorkshops).forEach(([key, wId]) => {
          rowWorkshops[key] = String(wId);
          const parts = key.split('_');
          if (parts.length >= 2) {
            const idPart = parts[0];
            const sizePart = parts.slice(1).join('_');
            
            const matchingProducts = products.filter(p => String(p.category_id) === String(idPart));
            matchingProducts.forEach(p => {
              rowWorkshops[`${p.id}_${sizePart}`] = String(wId);
            });
          }
        });
      }
      return {
        ...rawAss,
        rowWorkshops
      };
    }

    // Fallback: assign everything to order.workshop_id
    const rowWorkshops: Record<string, string> = {};
    if (order && order.cuts) {
      order.cuts.forEach((cut: any) => {
        const prod = products.find(p => String(p.id) === String(cut.product_id));
        const catId = prod ? String(prod.id) : 'sin_prod';
        
        (cut.cut_sizes || []).forEach((cs: any) => {
          const sizeObj = sizesMaster.find(s => String(s.id) === String(cs.size_id));
          const sz = sizeObj ? sizeObj.codigo_talla : 'S/T';
          const cellKey = `${catId}_${sz}`;
          rowWorkshops[cellKey] = String(order.workshop_id || '');
        });
      });
    }

    return {
      rowWorkshops,
      cutAccessories: {},
      prepNotes: 'Orden anterior (previa a actualización).',
      workshopNotes: 'Sin notas adicionales.',
      deliveryDate: order.fecha_entrega || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
    };
  };

  const handleOpenPrintModal = async (order: any) => {
    setLoading(true);
    const dbAssignments = await fetchOrderAssignmentsFromDB(order.id);
    
    let finalAssignments = dbAssignments;
    if (!finalAssignments) {
      finalAssignments = getAssignmentsData(order);
    }
    
    setPrintOrder({
      ...order,
      dbAssignments: finalAssignments
    });
    setShowPrintModal(true);
    setLoading(false);
  };

  const getWorkshopItems = (order: any, targetWorkshopId: string, rowWorkshopsData: Record<string, string>) => {
    const items: {
      productName: string;
      colorName: string;
      categoryName: string;
      fabricName: string;
      sizeCode: string;
      quantity: number;
      cutId: string;
    }[] = [];

    if (!order || !order.cuts) return items;

    order.cuts.forEach((cut: any) => {
      const prod = products.find(p => String(p.id) === String(cut.product_id));
      const catId = prod ? String(prod.id) : 'sin_prod';
      
      const categoryObj = prod ? categoriesMaster.find(c => String(c.id) === String(prod.category_id)) : null;
      const categoryName = categoryObj ? categoryObj.categoria : (prod ? (prod.categoria || 'Sin Categoría') : 'Sin Categoría');
      
      let colorObj = colorsMaster.find(c => String(c.id) === String(cut.color_id));
      let colorName = colorObj ? colorObj.nombre_color : 'Sin Color';

      const fabricObj = fabricsMaster.find(f => String(f.id) === String(cut.fabric_id));
      let fabricName = fabricObj ? fabricObj.nombre_tela : '—';

      // Si el color viene como 'Sin Color', intentar extraerlo del nombre de la tela
      // Ej: "JABON/, CAFE 80431" -> Separar por comas, barras o espacios y buscar coincidencias con el maestro de colores
      if ((!colorName || colorName === 'Sin Color' || !isNaN(Number(colorName))) && fabricName && fabricName !== '—') {
        const fabricNameUpper = fabricName.toUpperCase();
        
        // Unir el maestro de colores de base de datos con un listado estático básico de respaldo (para asegurar detección de colores comunes)
        const baseColorsList = [
          'VERDE OLIVA', 'VERDE MILITAR', 'AZUL TURQUESA', 'AZUL REY', 'AZUL MARINO',
          'VINO', 'CAFE', 'CAFÉ', 'CAMEL', 'VERDE', 'AZUL', 'ROJO', 'NEGRO', 'BLANCO',
          'GRIS', 'AMARILLO', 'ROSA', 'BEIGE', 'HUESO', 'MOSTAZA', 'LILA', 'FUCSIA'
        ];

        const dbColors = (colorsMaster || []).map(c => c.nombre_color).filter(Boolean);
        const combinedColorNames = Array.from(new Set([...dbColors, ...baseColorsList]))
          .sort((a, b) => b.length - a.length);

        const matchedColorName = combinedColorNames.find(color => {
          const masterColorUpper = color.toUpperCase().trim();
          // regex flexible que busca el color como palabra completa o aislado por espacios, comas o barras
          const regex = new RegExp(`(?:^|[^A-ZÀ-ÿ])(${masterColorUpper})(?:$|[^A-ZÀ-ÿ])`, 'i');
          return regex.test(fabricNameUpper);
        });

        if (matchedColorName) {
          colorName = matchedColorName;
          // Limpiar la tela para quitar la parte del color si es necesario o dejar la tela limpia
          const regex = new RegExp(matchedColorName, 'gi');
          fabricName = fabricName.replace(regex, '').replace(/[\s,\/]+$/, '').trim();
        }
      }

      // Si por alguna razón el colorName sigue siendo un número o nulo, reestablecer a "Sin Color"
      if (!colorName || !isNaN(Number(colorName)) || String(colorName).trim() === '') {
        colorName = 'Sin Color';
      }

      const layersProyec = cut.layers || 1;
      const layersProduced = cut.layers_produced || 0;

      (cut.cut_sizes || []).forEach((cs: any) => {
        const sizeObj = sizesMaster.find(s => String(s.id) === String(cs.size_id));
        const sz = sizeObj ? sizeObj.codigo_talla : 'S/T';

        const cellKey = `${catId}_${sz}`;
        const assignedWorkshopId = rowWorkshopsData[cellKey];

        if (String(assignedWorkshopId).toLowerCase() === String(targetWorkshopId).toLowerCase()) {
          const proyecQty = Number(cs.quantity) || 0;
          const ppc = proyecQty / layersProyec;
          const realQty = Math.round(ppc * layersProduced);
          
          if (realQty > 0) {
            items.push({
              productName: prod ? prod.nombre_producto : 'Sin Referencia',
              colorName,
              categoryName,
              fabricName,
              sizeCode: sz,
              quantity: realQty,
              cutId: String(cut.id)
            });
          }
        }
      });
    });

    return items;
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const { data: currentOrder } = await supabase
        .from('orders')
        .select('observaciones')
        .eq('id', id)
        .single();

      const timestamp = new Date().toLocaleString('es-ES');
      let observaciones = currentOrder?.observaciones || '';
      
      if (status === 'Enviada' && !observaciones.includes('=== ENVIADA')) {
        observaciones += `\n\n=== ENVIADA (${timestamp}) ===\n`;
      } else if (status === 'En Confección' && !observaciones.includes('=== ENTRADA A CONFECCIÓN')) {
        observaciones += `\n\n=== ENTRADA A CONFECCIÓN (${timestamp}) ===\n`;
      } else if (status === 'Terminada' && !observaciones.includes('=== RECIBIDO DE CONFECCIÓN')) {
        observaciones += `\n\n=== RECIBIDO DE CONFECCIÓN (${timestamp}) ===\n`;
      }

      const { error } = await supabase.from('orders').update({ status, observaciones }).eq('id', id);
      if (error) throw error;

      // Automatically create a quality inspection if the order is completed/received in sewing ('Terminada')
      if (status === 'Terminada') {
        const { data: fullOrder } = await supabase
          .from('orders')
          .select('*, workshops(nombre_taller), cuts(*, cut_sizes(*))')
          .eq('id', id)
          .single();

        const { data: childSewingOrders } = await supabase
          .from('sewing_orders')
          .select('*, workshops(nombre_taller)')
          .eq('parent_order_id', id);

        if (childSewingOrders && childSewingOrders.length > 0) {
          for (const so of childSewingOrders) {
            const { data: existingInspections } = await supabase
              .from('quality_inspections')
              .select('id')
              .eq('sewing_order_id', so.id);

            if (!existingInspections || existingInspections.length === 0) {
              const workshopName = so.workshops?.nombre_taller || 'Taller Satélite';
              await supabase
                .from('quality_inspections')
                .insert([{
                  order_id: id,
                  sewing_order_id: so.id,
                  workshop_name: workshopName,
                  items_inspected: so.cantidad_planeada || 0,
                  items_approved: 0,
                  items_rejected: 0,
                  status: 'Pendiente',
                  notes: 'Creado automáticamente al recibir de confección.'
                }]);
            }
          }
        } else {
          // Fallback to parent order if no child sewing orders exist
          const totalQty = fullOrder ? getTotalPrendas(fullOrder) : 0;
          const workshopName = fullOrder?.workshops?.nombre_taller || 'Taller Satélite';

          const { data: existingInspections } = await supabase
            .from('quality_inspections')
            .select('id')
            .eq('order_id', id);

          if (!existingInspections || existingInspections.length === 0) {
            await supabase
              .from('quality_inspections')
              .insert([{
                order_id: id,
                workshop_name: workshopName,
                items_inspected: totalQty,
                items_approved: 0,
                items_rejected: 0,
                status: 'Pendiente',
                notes: 'Creado automáticamente al recibir de confección.'
              }]);
          }
        }
      }

      fetchData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleReceiveSewingOrder = async (so: any) => {
    try {
      // 1. Update status in sewing_orders table
      const { error } = await supabase
        .from('sewing_orders')
        .update({ status: 'Terminada' })
        .eq('id', so.id);
      if (error) throw error;

      // 2. Automatically create a quality inspection for this child order
      const { data: existingInspections } = await supabase
        .from('quality_inspections')
        .select('id')
        .eq('sewing_order_id', so.id);

      if (!existingInspections || existingInspections.length === 0) {
        const workshopName = so.workshops?.nombre_taller || 'Taller Satélite';
        await supabase
          .from('quality_inspections')
          .insert([{
            order_id: so.parent_order_id,
            sewing_order_id: so.id,
            workshop_name: workshopName,
            items_inspected: so.cantidad_planeada || 0,
            items_approved: 0,
            items_rejected: 0,
            status: 'Pendiente',
            notes: 'Creado automáticamente al recibir de confección.'
          }]);
      }

      // 3. Check if all sewing orders for this parent_order are 'Terminada'
      // If so, update parent order status to 'Terminada'
      const { data: siblingOrders } = await supabase
        .from('sewing_orders')
        .select('status')
        .eq('parent_order_id', so.parent_order_id);

      const allFinished = siblingOrders && siblingOrders.every(s => s.status === 'Terminada');
      if (allFinished) {
        await supabase
          .from('orders')
          .update({ status: 'Terminada' })
          .eq('id', so.parent_order_id);
      }

      // Refresh data
      fetchData();
    } catch (err: any) {
      alert('Error al recibir de taller: ' + err.message);
    }
  };

  const getConfectionDates = (order: any) => {
    let fechaGenerada = '—';
    let fechaEnviada = '—';

    if (order.observaciones) {
      const matchGen = order.observaciones.match(/=== ENTRADA A CONFECCIÓN \((.*?)\) ===/);
      if (matchGen && matchGen[1]) {
        fechaGenerada = matchGen[1].split(' ')[0] || matchGen[1];
      } else {
        if (order.status !== 'Cortado' && order.created_at) {
          fechaGenerada = new Date(order.created_at).toLocaleDateString('es-ES');
        }
      }

      const matchEnv = order.observaciones.match(/=== ENVIADA \((.*?)\) ===/);
      if (matchEnv && matchEnv[1]) {
        fechaEnviada = matchEnv[1].split(' ')[0] || matchEnv[1];
      }
    } else {
      if (order.status !== 'Cortado' && order.created_at) {
        fechaGenerada = new Date(order.created_at).toLocaleDateString('es-ES');
      }
    }

    return { fechaGenerada, fechaEnviada };
  };


  const getTotalPrendas = (order: any) => {
    if (!order.cuts) return order.capas_proyectadas || 0;
    return order.cuts.reduce((sum: number, c: any) => {
      const layersProyec = c.layers || 1;
      const layersProduced = c.layers_produced || 0;
      return sum + (c.cut_sizes || []).reduce((s: number, cs: any) => {
        const qty = Number(cs.quantity) || 0;
        const ppc = qty / layersProyec;
        return s + Math.round(ppc * layersProduced);
      }, 0);
    }, 0);
  };

  // Paginación local para la tabla principal (10 en 10)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Cortadas son las órdenes padre que están listas para iniciar
  const parentFiltered = orders.filter(o => {
    const matchSearch = (o.internal_code || '').toLowerCase().includes(search.toLowerCase()) ||
                        (o.client_name || '').toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });
  const cortadas = parentFiltered.filter(o => o.status === 'Cortado');

  // Filtrado de las órdenes de confección (hijas) para la tabla y contadores
  const filteredSewingOrders = sewingOrders.filter(so => {
    const parentCode = so.parent_order?.internal_code || '';
    const consecutive = so.parent_order?.consecutive?.toString() || '';
    const client = so.parent_order?.client_name || '';
    const code = so.confeccion_code || '';
    const workshop = so.workshops?.nombre_taller || '';
    const ref = so.products?.nombre_producto || '';
    
    const matchSearch = 
      parentCode.toLowerCase().includes(search.toLowerCase()) ||
      consecutive.toLowerCase().includes(search.toLowerCase()) ||
      client.toLowerCase().includes(search.toLowerCase()) ||
      code.toLowerCase().includes(search.toLowerCase()) ||
      ref.toLowerCase().includes(search.toLowerCase()) ||
      workshop.toLowerCase().includes(search.toLowerCase());

    const matchStatus = filterStatus === 'all' ? true : so.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const enConfeccion = sewingOrders.filter(so => so.status === 'En Confección');
  const terminadas = sewingOrders.filter(so => so.status === 'Terminada');

  const totalItems = filteredSewingOrders.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  // Obtener los items de la página activa
  const paginatedTableOrders = filteredSewingOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const stageConfig: { id: Stage; label: string; icon: any }[] = [
    { id: 'matriz_corte', label: 'Matriz de Corte', icon: Clipboard },
    { id: 'talleres', label: 'Asignación de Talleres', icon: Factory },
  ];
  const stageIndex = stageConfig.findIndex(s => s.id === currentStage);

  const { uniqueSizes, matrixRows } = getMatrixData(selectedOrder);
  const matrixRowEntries = Object.entries(matrixRows);
  const { orderCategories, categorySizes, colorRows, categoryRatios } = getSpreadsheetMatrixData(selectedOrder);
  const categoryAssignments = getCategoryAssignmentsData(selectedOrder);
  const categoryAssignmentEntries = Object.entries(categoryAssignments);

  // Reiniciar a la página 1 cuando cambie la búsqueda o filtro
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterStatus]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '4rem' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#7c3aed', textTransform: 'uppercase' }}>
            Etapa de Producción
          </span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '950', margin: '0.25rem 0 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.5rem', backgroundColor: '#7c3aed', borderRadius: '12px', color: 'white' }}>
              <Truck size={24} />
            </div>
            Confección
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Gestión del flujo de órdenes cortadas hacia talleres satélite.
          </p>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
        {[
          { label: 'Listas para Confección', value: cortadas.length, color: '#f59e0b', icon: Scissors, desc: 'Cortadas pendientes de despacho' },
          { label: 'En Taller', value: enConfeccion.length, color: '#7c3aed', icon: Factory, desc: 'Órdenes en proceso de costura' },
          { label: 'Terminadas', value: terminadas.length, color: '#10b981', icon: CheckCircle, desc: 'Recibidas del taller' }
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', border: `1px solid ${k.color}25`, borderRadius: '16px' }}>
            <div style={{ padding: '0.875rem', backgroundColor: `${k.color}15`, color: k.color, borderRadius: '14px', flexShrink: 0 }}>
              <k.icon size={26} />
            </div>
            <div>
              <p style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</p>
              <h3 style={{ fontSize: '2rem', fontWeight: '950', margin: '0.1rem 0', color: k.color }}>{k.value}</h3>
              <p style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{k.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Cortadas list ── */}
      {cortadas.length > 0 && (
        <div className="card" style={{ padding: 0, border: '1px solid #fef3c7', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.5rem', backgroundColor: '#fef3c7', borderBottom: '1px solid #fde68a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: '900', color: '#92400e', margin: 0, textTransform: 'uppercase' }}>
              Órdenes listas para iniciar Confección ({cortadas.length})
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {cortadas.map(order => (
              <div key={order.id} style={{
                padding: '1rem 1.5rem', borderBottom: '1px solid #fef3c7',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                backgroundColor: 'white'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                     <span style={{ fontWeight: '900', color: '#0f172a' }}>OC-{order.internal_code}</span>
                    <span style={{ fontSize: '0.65rem', backgroundColor: '#fef3c7', color: '#92400e', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: '700' }}>CORTADO</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{order.client_name} · {order.fabrics?.nombre_tela} · <strong>{getTotalPrendas(order)} prendas</strong></span>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => openWizard(order)}
                  style={{ backgroundColor: '#7c3aed', borderColor: '#7c3aed', padding: '0.6rem 1.25rem', fontSize: '0.8rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <ArrowRight size={15} />
                  Iniciar Confección
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── En Confección / Terminadas list ── */}
      <div className="card" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Buscar por código o cliente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.5rem', borderRadius: '10px', border: '1.5px solid var(--border)', fontSize: '0.85rem' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {['all', 'En Confección', 'Terminada', 'Enviada'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)} className="btn" style={{
                fontSize: '0.72rem', fontWeight: '700', padding: '0.5rem 0.875rem',
                backgroundColor: filterStatus === s ? '#7c3aed' : 'white',
                color: filterStatus === s ? 'white' : 'var(--text)',
                border: '1px solid var(--border)', borderRadius: '8px'
              }}>{s === 'all' ? 'Todas' : s}</button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                {['Orden', 'Cliente / Tela', 'Prendas', 'Taller', 'Fechas', 'Estado', 'Acción'].map(h => (
                  <th key={h} style={{ padding: '0.875rem 1.25rem', fontSize: '0.68rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', textAlign: h === 'Acción' ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: '4rem', textAlign: 'center' }}><Loader2 className="animate-spin" size={28} style={{ margin: 'auto', color: '#7c3aed' }} /></td></tr>
              ) : paginatedTableOrders.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>No hay órdenes en este estado.</td></tr>
                            ) : paginatedTableOrders.map(so => {
                const statusColor = so.status === 'En Confección' ? { bg: '#eff6ff', color: '#2563eb' }
                  : so.status === 'Terminada' ? { bg: '#f0fdf4', color: '#16a34a' }
                  : { bg: '#f5f3ff', color: '#7c3aed' };
                return (
                  <tr key={so.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1rem 1.25rem', fontWeight: '900', color: '#7c3aed', fontSize: '0.9rem' }}>
                      {so.confeccion_code || '—'}
                    </td>
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <div style={{ fontWeight: '700', fontSize: '0.85rem', color: '#0f172a' }}>{so.parent_order?.client_name || '—'}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        Ref: {so.products?.nombre_producto || '—'} | Tela: {so.parent_order?.fabrics?.nombre_tela || '—'}
                      </div>
                    </td>
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <span style={{ fontWeight: '800', fontSize: '0.9rem' }}>{so.cantidad_planeada || 0}</span>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: '0.25rem' }}>uds</span>
                    </td>
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <div style={{ fontWeight: '700', fontSize: '0.82rem' }}>{so.workshops?.nombre_taller || '—'}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{so.workshops?.responsable || '—'}</div>
                    </td>
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', fontSize: '0.72rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#475569' }}>
                          <span style={{ fontWeight: '600', color: '#94a3b8' }}>Enviada:</span>
                          <span style={{ fontWeight: '700' }}>{so.created_at ? new Date(so.created_at).toLocaleDateString('es-ES') : '—'}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <span style={{ padding: '0.3rem 0.75rem', borderRadius: '999px', fontSize: '0.65rem', fontWeight: '800', backgroundColor: statusColor.bg, color: statusColor.color }}>
                        {so.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {so.parent_order && (
                          <button
                            className="btn"
                            style={{ fontSize: '0.75rem', fontWeight: '700', padding: '0.45rem 0.875rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                            onClick={() => handleOpenPrintModal(so.parent_order)}
                          >
                            <Printer size={13} /> Órdenes Taller
                          </button>
                        )}
                        {so.status === 'En Confección' && (
                          <>
                            {so.parent_order && (
                              <button
                                className="btn"
                                style={{ fontSize: '0.75rem', fontWeight: '700', padding: '0.45rem 0.875rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px' }}
                                onClick={() => handleRevertToCortado(so.parent_order)}
                              >
                                Revertir a Cortado
                              </button>
                            )}
                            <button
                              className="btn"
                              style={{ fontSize: '0.75rem', fontWeight: '700', padding: '0.45rem 0.875rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px' }}
                              onClick={() => handleReceiveSewingOrder(so)}
                            >
                              Recibir de Taller
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Controles de Paginación */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', backgroundColor: '#f8fafc', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700' }}>
              Mostrando página <strong>{currentPage}</strong> de {totalPages} ({totalItems} órdenes en total)
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="btn"
                style={{
                  fontSize: '0.72rem', fontWeight: '800', padding: '0.4rem 0.8rem',
                  backgroundColor: 'white', color: currentPage === 1 ? '#cbd5e1' : '#4f46e5',
                  border: '1px solid #e2e8f0', borderRadius: '6px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                }}
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="btn"
                style={{
                  fontSize: '0.72rem', fontWeight: '800', padding: '0.4rem 0.8rem',
                  backgroundColor: 'white', color: currentPage === totalPages ? '#cbd5e1' : '#4f46e5',
                  border: '1px solid #e2e8f0', borderRadius: '6px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                }}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── WIZARD MODAL ── */}
      {selectedOrder && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '780px', padding: 0, maxHeight: '95vh', display: 'flex', flexDirection: 'column', borderRadius: '20px', overflow: 'hidden' }}>

            {/* Modal header */}
            <div style={{ padding: '1.5rem 2rem', background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '0.65rem', fontWeight: '800', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Proceso de Confección</p>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '950', color: 'white', margin: '0.25rem 0 0' }}>OC-{selectedOrder.internal_code} — {getTotalPrendas(selectedOrder)} prendas cortadas</h2>
              </div>
              <button onClick={() => setSelectedOrder(null)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', cursor: 'pointer', borderRadius: '8px', padding: '0.5rem' }}>
                <X size={20} />
              </button>
            </div>

            {/* Step indicator */}
            <div style={{ padding: '1.25rem 2rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {stageConfig.map((s, i) => {
                const done = i < stageIndex;
                const active = i === stageIndex;
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: i < 2 ? 1 : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        backgroundColor: done ? '#10b981' : active ? '#7c3aed' : '#e2e8f0',
                        color: done || active ? 'white' : '#94a3b8',
                        fontSize: '0.75rem', fontWeight: '900',
                        boxShadow: active ? '0 0 0 4px #7c3aed25' : 'none'
                      }}>
                        {done ? <CheckCircle size={14} /> : i + 1}
                      </div>
                      <span style={{ fontSize: '0.7rem', fontWeight: active ? '900' : '600', color: active ? '#7c3aed' : done ? '#10b981' : '#94a3b8', whiteSpace: 'nowrap' }}>
                        {s.label}
                      </span>
                    </div>
                    {i < 2 && <div style={{ flex: 1, height: '2px', backgroundColor: done ? '#10b981' : '#e2e8f0', borderRadius: '2px', minWidth: '20px' }} />}
                  </div>
                );
              })}
            </div>

            {/* Stage content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>

              {/* ── STAGE 1: Matriz de Corte Final (Transpuesta & Informativo) ── */}
              {currentStage === 'matriz_corte' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ padding: '1.25rem', backgroundColor: '#f5f3ff', borderRadius: '12px', border: '1.5px solid #ddd6fe' }}>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: '900', color: '#4c1d95', margin: '0 0 0.5rem' }}>Matriz de Corte Final</h3>
                    <p style={{ fontSize: '0.75rem', color: '#6d28d9', margin: '0 0 1rem' }}>
                      Unidades reales obtenidas del corte (no proyectado).
                    </p>

                    {colorRows.length > 0 ? (
                      <div style={{ overflowX: 'auto', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #ddd6fe', padding: '0.5rem' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                          <thead>
                            {/* Fila única: Solo nombre de referencia */}
                            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                              <th style={{ padding: '0.6rem', textAlign: 'left', fontWeight: '900', color: '#475569', borderBottom: '2px solid #cbd5e1' }}>Tela</th>
                              <th style={{ padding: '0.6rem', textAlign: 'center', fontWeight: '900', color: '#475569', borderBottom: '2px solid #cbd5e1' }}>Kilos</th>
                              {orderCategories.map((cat: any) => (
                                <th key={cat.id} style={{ padding: '0.6rem', textAlign: 'center', fontWeight: '950', color: '#1e1b4b', borderLeft: '2px solid #cbd5e1', borderBottom: '2px solid #7c3aed', backgroundColor: '#faf5ff' }}>
                                  {cat.categoria}
                                </th>
                              ))}
                              <th style={{ padding: '0.6rem', textAlign: 'center', fontWeight: '950', color: '#475569', backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {/* Fila de Ratios / Marcación de Trazos */}
                            <tr style={{ backgroundColor: '#fdf4ff', fontWeight: '700', borderBottom: '2px solid #ddd6fe' }}>
                              <td style={{ padding: '0.6rem', fontWeight: '900', color: '#701a75' }}>Marcación (Molds)</td>
                              <td style={{ padding: '0.6rem', textAlign: 'center', color: '#a21caf' }}>—</td>
                              {orderCategories.map((cat: any) => {
                                const catTotal = (categorySizes[cat.id] || []).reduce((sum, sz) => sum + (categoryRatios[`${cat.id}_${sz}`] || 0), 0);
                                return (
                                  <td key={`ratio_${cat.id}`} style={{ padding: '0.5rem', textAlign: 'center', borderLeft: '2px solid #cbd5e1', color: '#701a75', fontWeight: '900' }}>
                                    {catTotal}
                                  </td>
                                );
                              })}
                              <td style={{ padding: '0.6rem', textAlign: 'center', fontWeight: '900', backgroundColor: '#f5d0fe', color: '#701a75' }}>
                                {orderCategories.reduce((accTotal: number, cat: any) => {
                                  return accTotal + (categorySizes[cat.id] || []).reduce((subSum: number, sz: string) => subSum + (categoryRatios[`${cat.id}_${sz}`] || 0), 0);
                                }, 0)}
                              </td>
                            </tr>

                            {/* Filas de Datos por Color */}
                            {colorRows.map((colorRow: any) => {
                              let rowTotal = 0;
                              return (
                                <tr key={colorRow.fabricId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '0.6rem', fontWeight: '700', color: '#475569' }}>{colorRow.fabricName}</td>
                                  <td style={{ padding: '0.6rem', textAlign: 'center', fontWeight: '600', color: '#475569' }}>{colorRow.kilos.toFixed(2)} kg</td>
                                  {orderCategories.map((cat: any) => {
                                    const catQty = (categorySizes[cat.id] || []).reduce((sum: number, sz: string) => sum + (colorRow.quantities[`${cat.id}_${sz}`] || 0), 0);
                                    rowTotal += catQty;
                                    return (
                                      <td key={`qty_${colorRow.fabricId}_${cat.id}`} style={{ padding: '0.6rem', textAlign: 'center', borderLeft: '2px solid #cbd5e1', fontWeight: '700', color: catQty > 0 ? '#1e293b' : '#cbd5e1' }}>
                                        {catQty}
                                      </td>
                                    );
                                  })}
                                  <td style={{ padding: '0.6rem', textAlign: 'center', fontWeight: '900', color: '#0f172a', backgroundColor: '#f8fafc' }}>
                                    {rowTotal}
                                  </td>
                                </tr>
                              );
                            })}

                            {/* Totales de Columnas */}
                            <tr style={{ backgroundColor: '#f8fafc', fontWeight: '950', borderTop: '2px solid #cbd5e1' }}>
                              <td style={{ padding: '0.6rem', color: '#1e293b' }}>TOTALES</td>
                              <td style={{ padding: '0.6rem', textAlign: 'center', color: '#7c3aed' }}>
                                {colorRows.reduce((sum: number, r: any) => sum + r.kilos, 0).toFixed(2)} kg
                              </td>
                              {orderCategories.map((cat: any) => {
                                const catTotal = colorRows.reduce((sum: number, r: any) => sum + (categorySizes[cat.id] || []).reduce((s: number, sz: string) => s + (r.quantities[`${cat.id}_${sz}`] || 0), 0), 0);
                                return (
                                  <td key={`tot_${cat.id}`} style={{ padding: '0.6rem', textAlign: 'center', color: '#7c3aed', fontWeight: '900', borderLeft: '2px solid #cbd5e1' }}>
                                    {catTotal}
                                  </td>
                                );
                              })}
                              <td style={{ padding: '0.6rem', textAlign: 'center', color: '#7c3aed', fontWeight: '950', backgroundColor: '#f1f5f9' }}>
                                {colorRows.reduce((sum: number, r: any) => {
                                  let rowSum = 0;
                                  Object.values(r.quantities || {}).forEach((val: any) => {
                                    rowSum += Number(val) || 0;
                                  });
                                  return sum + rowSum;
                                }, 0)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', padding: '1rem' }}>No hay información de corte.</p>
                    )}
                  </div>
                </div>
              )}

              {/* ── STAGE 2: Asignación de Talleres por Categoría y Talla + Despacho ── */}
              {currentStage === 'talleres' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  
                  {/* Transposed workshop assignment grid */}
                  {categoryAssignmentEntries.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                        Asignación de Talleres por Categoría y Talla
                      </label>
                      <div style={{ overflowX: 'auto', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '0.5rem' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                              <th style={{ padding: '0.6rem', textAlign: 'left', fontWeight: '800', color: '#475569', minWidth: '100px' }}>Talla</th>
                              {categoryAssignmentEntries.map(([catId, cat]) => {
                                const prodAccs = productAccessoriesList.filter(pa => {
                                  if (String(pa.product_id) === String(catId)) return true;
                                  const paProdName = pa.products?.nombre_producto;
                                  return paProdName && cat.categoryName && paProdName.toLowerCase().trim() === cat.categoryName.toLowerCase().trim();
                                });
                                return (
                                  <th key={catId} style={{ padding: '0.6rem', textAlign: 'center', fontWeight: '800', color: '#475569' }}>
                                    📦 {cat.categoryName}
                                    <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 'normal' }}>Total: {cat.total} uds</div>
                                    {prodAccs.length > 0 ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginTop: '0.35rem', alignItems: 'center' }}>
                                        {prodAccs.map(pa => (
                                          <span key={pa.id} style={{ display: 'inline-block', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '0.05rem 0.3rem', borderRadius: '4px', fontSize: '0.6rem', fontWeight: '700', border: '1px solid #bae6fd', maxWidth: '180px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                            {pa.accessories?.nombre || 'Accesorio'} ({Number(pa.cantidad).toFixed(2)} {pa.accessories?.unidad_medida || 'Unidad'})
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <div style={{ fontSize: '0.6rem', color: '#94a3b8', fontStyle: 'italic', marginTop: '0.2rem' }}>Sin accesorios</div>
                                    )}
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {uniqueSizes.map(sz => (
                              <tr key={sz} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '0.6rem', fontWeight: '900', color: '#7c3aed' }}>
                                  Talla {sz}
                                </td>
                                {categoryAssignmentEntries.map(([catId, cat]) => {
                                  const qty = cat.sizes[sz] || 0;
                                  const cellKey = `${catId}_${sz}`;
                                  if (qty === 0) {
                                    return (
                                      <td key={cellKey} style={{ padding: '0.6rem', textAlign: 'center', color: '#cbd5e1', backgroundColor: '#f8fafc' }}>
                                        —
                                      </td>
                                    );
                                  }
                                  return (
                                    <td key={cellKey} style={{ padding: '0.6rem', border: `1px solid ${rowWorkshops[cellKey] ? '#bbf7d0' : '#f1f5f9'}` }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 'bold' }}>
                                          {qty} uds
                                        </span>
                                        <select
                                          value={rowWorkshops[cellKey] || ''}
                                          onChange={e => setRowWorkshops(prev => ({ ...prev, [cellKey]: e.target.value }))}
                                          style={{
                                            padding: '0.3rem 0.5rem', borderRadius: '6px', border: '1.5px solid #cbd5e1',
                                            fontSize: '0.72rem', backgroundColor: 'white', width: '100%', minWidth: '130px',
                                            borderColor: rowWorkshops[cellKey] ? '#22c55e' : '#cbd5e1',
                                            boxShadow: rowWorkshops[cellKey] ? '0 0 0 1px #22c55e' : 'none'
                                          }}
                                        >
                                          <option value="">Seleccionar Taller...</option>
                                          {workshops.map(w => (
                                            <option key={w.id} value={w.id}>{w.nombre_taller}</option>
                                          ))}
                                        </select>
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Sección para Tarifas Especiales de Confección */}
                  {(() => {
                    const uniqueCombinations: { wId: string; catId: string }[] = [];
                    Object.entries(rowWorkshops).forEach(([cellKey, wId]) => {
                      if (!wId) return;
                      const [catId] = cellKey.split('_');
                      const exists = uniqueCombinations.some(c => c.wId === wId && c.catId === catId);
                      if (!exists) {
                        uniqueCombinations.push({ wId, catId });
                      }
                    });

                    if (uniqueCombinations.length === 0) return null;

                    return (
                      <div style={{ marginTop: '1.5rem', padding: '1.25rem', backgroundColor: '#fafafa', borderRadius: '12px', border: '1.5px dashed #e2e8f0' }}>
                        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.82rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          💰 Tarifas Especiales de Confección (Opcional)
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          {uniqueCombinations.map(({ wId, catId }) => {
                            const ws = workshops.find(w => String(w.id) === String(wId));
                            const prod = products.find(p => String(p.id) === String(catId));
                            const prodName = prod ? prod.nombre_producto : 'Referencia';
                            const key = `${wId}_${catId}`;
                            return (
                              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', padding: '0.75rem', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                                <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#1e293b' }}>
                                  🏭 {ws ? ws.nombre_taller : 'Taller'}
                                </span>
                                <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '600' }}>
                                  🧵 {prodName}
                                </span>
                                <input
                                  type="number"
                                  placeholder="Tarifa por ud (ej. 4500)"
                                  value={specialRates[key] || ''}
                                  onChange={e => setSpecialRates(prev => ({ ...prev, [key]: e.target.value }))}
                                  style={{
                                    marginTop: '0.25rem', padding: '0.4rem 0.6rem', borderRadius: '6px',
                                    border: '1.5px solid #e2e8f0', fontSize: '0.75rem', fontWeight: '700'
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  <div style={{ marginTop: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                      Observaciones de Preparación
                    </label>
                    <textarea
                      placeholder="Ej. Piezas verificadas, sin faltantes, listas para empaque..."
                      value={prepNotes}
                      onChange={e => setPrepNotes(e.target.value)}
                      style={{ width: '100%', padding: '0.875rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.875rem', minHeight: '60px', resize: 'vertical' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                      Fecha Compromiso de Entrega General
                    </label>
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={e => setDeliveryDate(e.target.value)}
                      style={{ width: '100%', padding: '0.875rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.875rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                      Instrucciones Especiales de Costura / Confección
                    </label>
                    <textarea
                      placeholder="Instrucciones especiales, referencias de costuras, acabados..."
                      value={workshopNotes}
                      onChange={e => setWorkshopNotes(e.target.value)}
                      style={{ width: '100%', padding: '0.875rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.875rem', minHeight: '60px', resize: 'vertical' }}
                    />
                  </div>

                  {/* Summary before confirm */}
                  <div style={{ padding: '1.25rem', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1.5px solid #bbf7d0', fontSize: '0.8rem', color: '#15803d' }}>
                    <p style={{ fontWeight: '800', marginBottom: '0.6rem', fontSize: '0.85rem' }}>✅ Resumen de la Asignación</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', color: '#166534' }}>
                      <p style={{ margin: 0 }}>• <strong>Preparación:</strong> {prepNotes || 'Sin novedades'}</p>
                      {(() => {
                        let totalCutAccs = 0;
                        Object.values(cutAccessories).forEach(list => totalCutAccs += list.length);
                        return totalCutAccs > 0 ? (
                          <p style={{ margin: 0 }}>• <strong>Accesorios asignados a referencia + color:</strong> {totalCutAccs} insumos</p>
                        ) : null;
                      })()}
                      <p style={{ margin: 0 }}>• <strong>Talleres designados por Talla y Categoría:</strong></p>
                      <div style={{ marginLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {(() => {
                          const list: any[] = [];
                          Object.entries(categoryAssignments).forEach(([catId, cat]) => {
                            Object.entries(cat.sizes).forEach(([sz, qty]) => {
                              if (qty > 0) {
                                const cellKey = `${catId}_${sz}`;
                                const wId = rowWorkshops[cellKey];
                                const w = workshops.find(t => String(t.id) === String(wId));
                                list.push(
                                  <p key={cellKey} style={{ margin: 0, fontSize: '0.75rem' }}>
                                    - {cat.categoryName} - Talla <strong>{sz}</strong> ({qty} uds) ➔ <strong>{w?.nombre_taller || 'No asignado'}</strong>
                                  </p>
                                );
                              }
                            });
                          });
                          return list;
                        })()}
                      </div>
                      <p style={{ margin: 0 }}>• <strong>Fecha de Entrega:</strong> {deliveryDate}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation footer */}
            <div style={{ padding: '1.25rem 2rem', borderTop: '1px solid #e2e8f0', backgroundColor: '#fafafa', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  if (stageIndex === 0) setSelectedOrder(null);
                  else setCurrentStage(stageConfig[stageIndex - 1].id);
                }}
                style={{ padding: '0.75rem 1.5rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <ArrowLeft size={16} />
                {stageIndex === 0 ? 'Cancelar' : 'Atrás'}
              </button>

              {stageIndex < stageConfig.length - 1 ? (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setCurrentStage(stageConfig[stageIndex + 1].id);
                  }}
                  style={{ padding: '0.75rem 2rem', fontWeight: '800', backgroundColor: '#7c3aed', border: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  Siguiente <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={handleFinalize}
                  disabled={saving}
                  style={{ padding: '0.75rem 2rem', fontWeight: '800', backgroundColor: '#059669', border: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {saving ? <Loader2 className="animate-spin" size={16} /> : <Truck size={16} />}
                  {saving ? 'Enviando...' : 'Formalizar a Confección'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SELECCIONAR TALLER PARA IMPRIMIR ── */}
      {showPrintModal && printOrder && (
        <div className="no-print" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, backdropFilter: 'blur(8px)', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '550px', padding: '2rem', display: 'flex', flexDirection: 'column', borderRadius: '20px', gap: '1.5rem', backgroundColor: 'white' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '950', color: '#0f172a', margin: 0 }}>
                Imprimir Órdenes por Taller
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.82rem', marginTop: '0.25rem' }}>
                Seleccione el taller satélite asignado para generar su relación de confección individualizada.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto' }}>
              {(() => {
                const activeSewingOrders = sewingOrders.filter(so => 
                  String(so.parent_order_id) === String(printOrder.id)
                );
                
                if (activeSewingOrders.length === 0) {
                  return <p style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center', padding: '1rem' }}>No hay órdenes de confección creadas para esta orden.</p>;
                }

                return activeSewingOrders.map((so: any) => {
                  const workshopObj = workshops.find(w => String(w.id) === String(so.workshop_id));
                  const prodObj = products.find(p => String(p.id) === String(so.product_id));
                  const totalUds = so.cantidad_planeada || 0;

                  return (
                    <div key={so.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '12px',
                      backgroundColor: '#f8fafc'
                    }}>
                      <div>
                        <h4 style={{ fontWeight: '800', fontSize: '0.875rem', color: '#0f172a', margin: 0 }}>
                          {workshopObj ? workshopObj.nombre_taller : `Taller ID: ${so.workshop_id}`}
                        </h4>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.1rem 0 0' }}>
                          Código Seguimiento: <strong style={{ color: '#7c3aed' }}>{so.confeccion_code}</strong>
                        </p>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.1rem 0 0' }}>
                          Referencia: <strong>{prodObj ? prodObj.nombre_producto : 'Producto'}</strong>
                        </p>
                        {/* Control de Tarifa Especial, Lavandería y Empaque Individual */}
                        <div style={{ marginTop: '0.6rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                          {/* Precio Especial */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <input
                              type="checkbox"
                              id={`sp-${so.id}`}
                              checked={so.tarifa_especial !== null && so.tarifa_especial > 0}
                              onChange={async (e) => {
                                const isChecked = e.target.checked;
                                const val = isChecked ? 1 : null;
                                setSewingOrders(prev => prev.map(o => o.id === so.id ? { ...o, tarifa_especial: val } : o));
                                await supabase.from('sewing_orders').update({ tarifa_especial: val }).eq('id', so.id);
                              }}
                              style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#ea580c' }}
                            />
                            <label htmlFor={`sp-${so.id}`} style={{ fontSize: '0.72rem', fontWeight: '800', color: '#ea580c', cursor: 'pointer' }}>
                              ⭐ Especial
                            </label>
                          </div>

                          {/* Lavandería */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <input
                              type="checkbox"
                              id={`lav-${so.id}`}
                              checked={so.lavanderia || false}
                              onChange={async (e) => {
                                const isChecked = e.target.checked;
                                setSewingOrders(prev => prev.map(o => o.id === so.id ? { ...o, lavanderia: isChecked } : o));
                                await supabase.from('sewing_orders').update({ lavanderia: isChecked }).eq('id', so.id);
                              }}
                              style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#2563eb' }}
                            />
                            <label htmlFor={`lav-${so.id}`} style={{ fontSize: '0.72rem', fontWeight: '800', color: '#2563eb', cursor: 'pointer' }}>
                              💧 Lavandería
                            </label>
                          </div>

                          {/* Empaque */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <input
                              type="checkbox"
                              id={`emp-${so.id}`}
                              checked={so.empaque || false}
                              onChange={async (e) => {
                                const isChecked = e.target.checked;
                                setSewingOrders(prev => prev.map(o => o.id === so.id ? { ...o, empaque: isChecked } : o));
                                await supabase.from('sewing_orders').update({ empaque: isChecked }).eq('id', so.id);
                              }}
                              style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#16a34a' }}
                            />
                            <label htmlFor={`emp-${so.id}`} style={{ fontSize: '0.72rem', fontWeight: '800', color: '#16a34a', cursor: 'pointer' }}>
                              📦 Empaque
                            </label>
                          </div>
                        </div>
                      </div>
                      <button
                        className="btn"
                        style={{
                          backgroundColor: '#7c3aed', color: 'white', border: 'none',
                          padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800',
                          display: 'flex', alignItems: 'center', gap: '0.25rem'
                        }}
                        onClick={() => {
                          setPrintWorkshop(workshopObj || { id: so.workshop_id, nombre_taller: `Taller ${so.workshop_id}` });
                          setPrintSewingOrder(so);
                        }}
                      >
                        <Printer size={13} /> Generar PDF
                      </button>
                    </div>
                  );
                });
              })()}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowPrintModal(false);
                  setPrintOrder(null);
                }}
                style={{ padding: '0.6rem 1.5rem', fontWeight: '700' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PRINTABLE WORKSHOP ORDER PREVIEW ── */}
      {printOrder && printWorkshop && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(8px)', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '800px', padding: 0, maxHeight: '95vh', display: 'flex', flexDirection: 'column', borderRadius: '20px', overflow: 'hidden', backgroundColor: 'white' }}>
             {/* Modal header (no-print) */}
             <div className="no-print" style={{ padding: '1rem 2rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                 <span style={{ fontWeight: '900', fontSize: '0.85rem', color: '#0f172a' }}>Vista Previa</span>
                 <div style={{ display: 'inline-flex', backgroundColor: '#e2e8f0', padding: '0.2rem', borderRadius: '8px' }}>
                   <button
                     onClick={() => setPrintMode('report')}
                     style={{
                       border: 'none',
                       backgroundColor: printMode === 'report' ? 'white' : 'transparent',
                       color: printMode === 'report' ? '#0f172a' : '#475569',
                       padding: '0.3rem 0.75rem',
                       borderRadius: '6px',
                       fontSize: '0.72rem',
                       fontWeight: '800',
                       cursor: 'pointer',
                       boxShadow: printMode === 'report' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                     }}
                   >
                     📄 Reporte
                   </button>
                   <button
                     onClick={() => setPrintMode('sticker')}
                     style={{
                       border: 'none',
                       backgroundColor: printMode === 'sticker' ? 'white' : 'transparent',
                       color: printMode === 'sticker' ? '#0f172a' : '#475569',
                       padding: '0.3rem 0.75rem',
                       borderRadius: '6px',
                       fontSize: '0.72rem',
                       fontWeight: '800',
                       cursor: 'pointer',
                       boxShadow: printMode === 'sticker' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                     }}
                   >
                     🏷️ Sticker 10x10
                   </button>
                 </div>
               </div>
               <div style={{ display: 'flex', gap: '0.5rem' }}>
                 <button
                   className="btn"
                   onClick={() => window.print()}
                   style={{ backgroundColor: '#7c3aed', color: 'white', border: 'none', padding: '0.45rem 1rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}
                 >
                   <Printer size={13} /> Imprimir / PDF
                 </button>
                 <button
                   className="btn btn-secondary"
                   onClick={() => {
                     setPrintWorkshop(null);
                     setPrintMode('report');
                   }}
                   style={{ padding: '0.45rem 1rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700' }}
                 >
                   Cerrar
                 </button>
               </div>
             </div>

             {/* Printable container */}
             <div className="printable-workshop-order" style={printMode === 'sticker' ? {
               flex: 1,
               overflowY: 'auto',
               padding: '2rem',
               backgroundColor: '#f1f5f9',
               color: 'black',
               display: 'flex',
               justifyContent: 'center',
               alignItems: 'center'
             } : {
               flex: 1,
               overflowY: 'auto',
               padding: '2.5rem',
               backgroundColor: 'white',
               color: 'black'
             }}>
              {(() => {
                const dataAss = getAssignmentsData(printOrder);
                const rowWorkshopsMap = dataAss?.rowWorkshops || {};

                // Recalculate quantities directly from cuts + assignment map (avoid stale sewing_order_sizes)
                const workshopItems: any[] = [];

                // Group quantities by cutId+sizeCode for this workshop
                const qtyByCutSize: Record<string, number> = {};

                (printOrder.cuts || []).forEach((cut: any) => {
                  const targetProdId = cut.product_id;
                  const layersProyec = cut.layers || 1;
                  const layersProduced = cut.layers_produced || 0;

                  (cut.cut_sizes || []).forEach((cs: any) => {
                    const sizeObj = sizesMaster.find(s => String(s.id) === String(cs.size_id));
                    const sz = sizeObj ? sizeObj.codigo_talla : 'S/T';
                    const cellKey = `${targetProdId}_${sz}`;
                    const assignedWId = rowWorkshopsMap[cellKey];

                    // Only include cells assigned to the selected workshop
                    if (!assignedWId || String(assignedWId) !== String(printWorkshop.id)) return;

                    let realQty = 0;
                    if (cs.quantity_produced !== undefined && cs.quantity_produced !== null) {
                      realQty = Number(cs.quantity_produced);
                    } else {
                      const proyecQty = Number(cs.quantity) || 0;
                      const ppc = layersProyec > 0 ? proyecQty / layersProyec : 0;
                      realQty = Math.round(ppc * layersProduced);
                    }
                    if (realQty <= 0) return;

                    const key = `${cut.id}_${sz}`;
                    qtyByCutSize[key] = (qtyByCutSize[key] || 0) + realQty;
                  });
                });

                // Build workshopItems from the aggregated quantities
                const seenCutSizes = new Set<string>();
                (printOrder.cuts || []).forEach((cut: any) => {
                  const targetProdId = cut.product_id;
                  const prodObj = products.find(p => String(p.id) === String(targetProdId));
                  const prodName = prodObj?.nombre_producto || 'Referencia';

                  const categoryObj = prodObj ? categoriesMaster.find(c => String(c.id) === String(prodObj.category_id)) : null;
                  const categoryName = categoryObj ? categoryObj.categoria : (prodObj ? (prodObj.categoria || 'Sin Categoría') : 'Sin Categoría');

                  const fabricObj = cut ? fabricsMaster.find(f => String(f.id) === String(cut.fabric_id)) : null;
                  const fabricName = fabricObj ? fabricObj.nombre_tela : '—';

                  const colorObj = cut ? colorsMaster.find(c => String(c.id) === String(cut.color_id)) : null;
                  const colorName = colorObj ? colorObj.nombre_color : 'Sin Color';

                  let displayFabricName = fabricName;
                  let displayColorName = colorName;
                  if (fabricName.includes(',')) {
                    const commaIdx = fabricName.indexOf(',');
                    displayFabricName = fabricName.substring(0, commaIdx).trim();
                    const extractedColor = fabricName.substring(commaIdx + 1).trim();
                    if (extractedColor) {
                      displayColorName = extractedColor;
                    }
                  }

                  (cut.cut_sizes || []).forEach((cs: any) => {
                    const sizeObj = sizesMaster.find(s => String(s.id) === String(cs.size_id));
                    const sz = sizeObj ? sizeObj.codigo_talla : 'S/T';
                    const key = `${cut.id}_${sz}`;

                    if (!qtyByCutSize[key] || seenCutSizes.has(key)) return;
                    seenCutSizes.add(key);

                    workshopItems.push({
                      productName: prodName,
                      colorName: displayColorName,
                      categoryName,
                      fabricName: displayFabricName,
                      sizeCode: sz,
                      quantity: qtyByCutSize[key],
                      cutId: cut?.id || ''
                    });
                  });
                });


                const workshopAccs: { name: string; unit: string; qty: number }[] = [];
                
                workshopItems.forEach((item: any) => {
                  const cut = printOrder.cuts?.find((c: any) => String(c.id) === String(item.cutId));
                  if (!cut || !cut.product_id) return;
 
                  const prodAccs = productAccessoriesList.filter(pa => {
                    if (String(pa.product_id) === String(cut.product_id)) return true;
                    const paProdName = pa.products?.nombre_producto;
                    return paProdName && item.productName && paProdName.toLowerCase().trim() === item.productName.toLowerCase().trim();
                  });
                  prodAccs.forEach((pa: any) => {
                    let accName = pa.accessories?.nombre || 'Accesorio';
                    const rawUnit = pa.accessories?.unidad_medida || '';
                    const accUnit = rawUnit && isNaN(Number(rawUnit)) ? rawUnit : 'Unidad';
                    const qtyPerProduct = Number(pa.cantidad) || 0;
                    const totalRequired = item.quantity * qtyPerProduct;
                    
                    const isGafete = accName.toLowerCase().includes('gafe') || accName.toLowerCase().includes('gafete');
                    if (isGafete) {
                      const targetColorName = item.colorName;
                      const matchingColorGafete = accessories.find(a => {
                        const nameLower = (a.nombre || '').toLowerCase();
                        return (nameLower.includes('gafe') || nameLower.includes('gafete')) && 
                               nameLower.includes(targetColorName.toLowerCase());
                      });
 
                      const baseGafeteName = customGafetes[accName] || (matchingColorGafete ? matchingColorGafete.nombre : accName);
                      accName = `${baseGafeteName} (${targetColorName})`;
                    }
                  
                    if (totalRequired > 0) {
                      const existing = workshopAccs.find(wa => wa.name === accName);
                      if (existing) {
                        existing.qty += totalRequired;
                      } else {
                        workshopAccs.push({
                          name: accName,
                          unit: accUnit,
                          qty: totalRequired
                        });
                      }
                    }
                  });
                });

                 if (printMode === 'sticker') {
                   const stickerGrouped: {
                     colorName: string;
                     categoryName: string;
                     fabricName: string;
                     sizes: { [size: string]: number };
                     totalQuantity: number;
                   }[] = [];

                   workshopItems.forEach((item: any) => {
                     const existing = stickerGrouped.find(g => 
                       g.categoryName.toLowerCase() === item.categoryName.toLowerCase() && 
                       g.colorName.toLowerCase() === item.colorName.toLowerCase()
                     );
                     if (existing) {
                       existing.sizes[item.sizeCode] = (existing.sizes[item.sizeCode] || 0) + item.quantity;
                       existing.totalQuantity += item.quantity;
                     } else {
                       stickerGrouped.push({
                         categoryName: item.categoryName,
                         colorName: item.colorName,
                         fabricName: item.fabricName,
                         sizes: { [item.sizeCode]: item.quantity },
                         totalQuantity: item.quantity
                       });
                     }
                   });
                   
                   stickerGrouped.sort((a, b) => a.categoryName.localeCompare(b.categoryName, 'es'));
                   
                   const totalUnits = stickerGrouped.reduce((sum, item) => sum + item.totalQuantity, 0);
                   return (
                     <div className="print-stickers-page" style={{
                       width: '100mm',
                       height: '100mm',
                       padding: '8mm',
                       boxSizing: 'border-box',
                       display: 'flex',
                       flexDirection: 'column',
                       justifyContent: 'space-between',
                       border: '2.5px solid #000',
                       backgroundColor: 'white',
                       boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                       color: 'black',
                       fontFamily: 'system-ui, sans-serif'
                     }}>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                         <div style={{ textAlign: 'center', borderBottom: '2.5px solid #000', paddingBottom: '0.35rem', marginBottom: '0.2rem' }}>
                           <h2 style={{ fontSize: '1.25rem', fontWeight: '950', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cortesbreiner</h2>
                           <p style={{ fontSize: '0.6rem', color: '#333', fontWeight: '750', margin: 0, letterSpacing: '0.05em' }}>DESPACHO DE PRENDAS A SATÉLITE</p>
                         </div>
                         
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.72rem' }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                             <span><strong>ORDEN CONFECCIÓN:</strong></span>
                             <span style={{ fontWeight: '900', color: '#7c3aed' }}>{printSewingOrder.confeccion_code}</span>
                           </div>
                           <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                             <span><strong>TALLER SATÉLITE:</strong></span>
                             <span style={{ fontWeight: '800' }}>{printWorkshop.nombre_taller}</span>
                           </div>
                           <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                             <span><strong>CLIENTE:</strong></span>
                             <span>{printOrder.client_name}</span>
                           </div>
                           <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                             <span><strong>TELA PRINCIPAL:</strong></span>
                             <span>{printOrder.fabrics?.nombre_tela || '—'}</span>
                           </div>
                           <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                             <span><strong>FECHA COMPROMISO:</strong></span>
                             <span><strong>{dataAss.deliveryDate || '—'}</strong></span>
                           </div>
                         </div>

                         <div style={{ marginTop: '0.3rem', borderTop: '1.5px dashed #000', paddingTop: '0.3rem' }}>
                           <p style={{ margin: '0 0 0.15rem 0', fontSize: '0.625rem', fontWeight: '800', textTransform: 'uppercase', color: '#444' }}>DETALLE DE PRENDAS:</p>
                           <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', fontSize: '0.625rem', maxHeight: '2.5rem', overflow: 'hidden' }}>
                             {stickerGrouped.slice(0, 5).map((item, idx) => (
                               <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                 <span style={{ fontWeight: '600' }}>• {item.categoryName} ({item.colorName})</span>
                                 <strong style={{ fontSize: '0.68rem' }}>{item.totalQuantity} uds</strong>
                               </div>
                             ))}
                             {stickerGrouped.length > 5 && (
                               <div style={{ fontSize: '0.55rem', fontStyle: 'italic', textAlign: 'center', color: '#666' }}>+ {stickerGrouped.length - 5} más categorías/colores...</div>
                             )}
                           </div>
                         </div>
                       </div>

                       <div style={{ borderTop: '2.5px solid #000', paddingTop: '0.35rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <span style={{ fontSize: '0.65rem', fontWeight: '900', textTransform: 'uppercase' }}>Total Unidades:</span>
                         <span style={{ fontSize: '1.15rem', fontWeight: '950', color: '#7c3aed' }}>{totalUnits} uds</span>
                       </div>
                     </div>
                   );
                 }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2.5px solid #0f172a', paddingBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ backgroundColor: '#0f172a', padding: '0.4rem', borderRadius: '8px', color: 'white' }}>
                          <Truck size={22} />
                        </div>
                        <div>
                          <h2 style={{ fontSize: '1.15rem', fontWeight: '950', margin: 0, letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
                            Relación de Despacho a Confección
                          </h2>
                          <p style={{ fontSize: '0.7rem', color: '#475569', margin: 0 }}>
                            Cortesbreiner Sistema de Control Satélite · {new Date().toLocaleDateString('es-ES')}
                          </p>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '0.8rem', margin: 0, fontWeight: '750' }}>Orden de Confección</p>
                        <p style={{ fontSize: '0.95rem', fontWeight: '950', color: '#7c3aed', margin: 0 }}>
                          {printSewingOrder.confeccion_code}
                        </p>
                        {printOrder.pedido_especial && (
                          <span style={{
                            marginTop: '0.35rem', display: 'inline-block',
                            padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.68rem', fontWeight: '900',
                            backgroundColor: '#ea580c', color: 'white', border: '1px solid #f97316'
                          }}>
                            ⭐ PRECIO ESPECIAL
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Workshop Info */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.78rem' }}>
                      <div>
                        <p style={{ margin: '0 0 0.25rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', fontSize: '0.625rem' }}>Taller Satélite Destinatario</p>
                        <p style={{ margin: 0, fontWeight: '900', fontSize: '0.9rem', color: '#0f172a' }}>{printWorkshop.nombre_taller}</p>
                        <p style={{ margin: '0.15rem 0 0', color: '#334155' }}>Responsable: <strong>{printWorkshop.responsable || '—'}</strong></p>
                        <p style={{ margin: '0.15rem 0 0', color: '#475569' }}>Teléfono: {printWorkshop.telefono || '—'}</p>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 0.25rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', fontSize: '0.625rem' }}>Detalle de Entrega</p>
                        <p style={{ margin: 0 }}>Cliente: <strong>{printOrder.client_name}</strong></p>
                        <p style={{ margin: '0.15rem 0 0', color: '#7c3aed' }}>Fecha de Entrega Compromiso: <strong>{dataAss.deliveryDate || '—'}</strong></p>
                        <p style={{ margin: '0.15rem 0 0' }}>Tela Principal: {printOrder.fabrics?.nombre_tela || '—'}</p>
                      </div>
                    </div>

                    {/* Items Table */}
                    <div>
                      <h3 style={{ fontSize: '0.8rem', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', margin: '0 0 0.5rem', borderBottom: '1.5px solid #cbd5e1', paddingBottom: '0.25rem' }}>
                        📋 Prendas y Cantidades
                      </h3>
                      {(() => {
                        const groupedItems: {
                          colorName: string;
                          categoryName: string;
                          fabricName: string;
                          sizes: { [size: string]: number };
                          totalQuantity: number;
                        }[] = [];

                        workshopItems.forEach((item: any) => {
                          const existing = groupedItems.find(g => 
                            g.categoryName.toLowerCase() === item.categoryName.toLowerCase() && 
                            g.colorName.toLowerCase() === item.colorName.toLowerCase()
                          );
                          if (existing) {
                            existing.sizes[item.sizeCode] = (existing.sizes[item.sizeCode] || 0) + item.quantity;
                            existing.totalQuantity += item.quantity;
                            // Aggregate fabric names if different
                            if (!existing.fabricName.split(' / ').includes(item.fabricName) && item.fabricName !== '—') {
                              existing.fabricName = existing.fabricName === '—' ? item.fabricName : `${existing.fabricName} / ${item.fabricName}`;
                            }
                          } else {
                            groupedItems.push({
                              categoryName: item.categoryName,
                              colorName: item.colorName,
                              fabricName: item.fabricName,
                              sizes: { [item.sizeCode]: item.quantity },
                              totalQuantity: item.quantity
                            });
                          }
                        });

                        groupedItems.sort((a, b) => a.categoryName.localeCompare(b.categoryName, 'es'));

                        return (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1' }}>
                                <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '800' }}>Categoría</th>
                                <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '800' }}>Color</th>
                                <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '800' }}>Tela</th>
                                <th style={{ padding: '0.5rem', textAlign: 'center', fontWeight: '800' }}>Distribución Tallas</th>
                                <th style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '900', width: '120px' }}>Cantidad Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {groupedItems.map((item, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                  <td style={{ padding: '0.5rem', color: '#475569', fontWeight: '700' }}>{item.categoryName}</td>
                                  <td style={{ padding: '0.5rem', fontWeight: '600' }}>{item.colorName}</td>
                                  <td style={{ padding: '0.5rem', color: '#475569' }}>{item.fabricName}</td>
                                  <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: '800', color: '#7c3aed' }}>
                                    {Object.entries(item.sizes).map(([sz, qty]) => `${sz}(${qty})`).join(' · ')}
                                  </td>
                                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '800' }}>{item.totalQuantity} uds</td>
                                </tr>
                              ))}
                              <tr style={{ backgroundColor: '#f8fafc', fontWeight: '900', borderTop: '1.5px solid #cbd5e1' }}>
                                <td colSpan={4} style={{ padding: '0.6rem 0.5rem', textTransform: 'uppercase', fontSize: '0.7rem', color: '#334155' }}>Total Unidades Enviadas</td>
                                <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', color: '#7c3aed', fontSize: '0.85rem', fontWeight: '950' }}>
                                  {groupedItems.reduce((sum, item) => sum + item.totalQuantity, 0)} uds
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        );
                      })()}
                    </div>

                    {/* Accessories Table */}
                    <div>
                      <h3 style={{ fontSize: '0.8rem', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', margin: '0 0 0.5rem', borderBottom: '1.5px solid #cbd5e1', paddingBottom: '0.25rem' }}>
                        🔗 Accesorios e Insumos Entregados
                      </h3>
                      {workshopAccs.length > 0 ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1' }}>
                              <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '800' }}>Insumo / Accesorio</th>
                              <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '800' }}>Unidad</th>
                              <th style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '900' }}>Cantidad Proporcional</th>
                            </tr>
                          </thead>
                          <tbody>
                            {workshopAccs.map((wa, idx) => {
                              const isGafete = wa.name.toLowerCase().includes('gafe') || wa.name.toLowerCase().includes('gafete') || accessories.some(a => a.nombre === wa.name && (a.nombre.toLowerCase().includes('gafe') || a.nombre.toLowerCase().includes('gafete')));
                              const gafeteOptions = accessories.filter(a => 
                                a.nombre?.toLowerCase().includes('gafe') || a.nombre?.toLowerCase().includes('gafete')
                              );

                              return (
                                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                  <td style={{ padding: '0.5rem', fontWeight: '700' }}>
                                    {isGafete ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span className="print-only">{wa.name}</span>
                                        <select
                                          className="no-print"
                                          value={wa.name.includes(' (') ? wa.name.split(' (')[0] : wa.name}
                                          onChange={e => {
                                            const newName = e.target.value;
                                            setCustomGafetes(prev => ({
                                              ...prev,
                                              [wa.name]: newName
                                            }));
                                          }}
                                          style={{ padding: '0.2rem 0.4rem', fontSize: '0.72rem', borderRadius: '4px', border: '1px solid #cbd5e1', cursor: 'pointer', backgroundColor: 'white' }}
                                        >
                                          {gafeteOptions.map(opt => (
                                            <option key={opt.id} value={opt.nombre}>{opt.nombre}</option>
                                          ))}
                                        </select>
                                        <span className="no-print" style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 'bold' }}>
                                          ({wa.name.includes(' (') ? wa.name.slice(wa.name.indexOf(' (')) : ''})
                                        </span>
                                      </div>
                                    ) : (
                                      wa.name
                                    )}
                                  </td>
                                  <td style={{ padding: '0.5rem', color: '#475569' }}>{wa.unit}</td>
                                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '800', color: '#059669' }}>{Math.round(wa.qty)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      ) : (
                        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0, fontStyle: 'italic' }}>No se relacionan accesorios para este lote.</p>
                      )}
                    </div>

                    {/* Special notes */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.72rem' }}>
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem' }}>
                        <p style={{ fontWeight: '850', color: '#334155', margin: '0 0 0.25rem', textTransform: 'uppercase', fontSize: '0.6rem' }}>Observaciones de Preparación</p>
                        <p style={{ margin: 0, color: '#475569' }}>{dataAss.prepNotes || 'Sin novedades.'}</p>
                      </div>
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem' }}>
                        <p style={{ fontWeight: '850', color: '#334155', margin: '0 0 0.25rem', textTransform: 'uppercase', fontSize: '0.6rem' }}>Instrucciones de Costura</p>
                        <p style={{ margin: 0, color: '#475569' }}>{dataAss.workshopNotes || 'Sin instrucciones adicionales.'}</p>
                      </div>
                    </div>

                    {/* Signature block */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', marginTop: '2.5rem', paddingTop: '1.5rem' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ borderBottom: '1px solid #0f172a', width: '100%', marginBottom: '0.4rem' }}></div>
                        <p style={{ fontSize: '0.625rem', fontWeight: '800', textTransform: 'uppercase', margin: 0 }}>Entregado por (Planta)</p>
                        <p style={{ fontSize: '0.58rem', color: '#64748b', margin: '0.1rem 0 0' }}>Cortesbreiner Producción</p>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ borderBottom: '1px solid #0f172a', width: '100%', marginBottom: '0.4rem' }}></div>
                        <p style={{ fontSize: '0.625rem', fontWeight: '800', textTransform: 'uppercase', margin: 0 }}>Recibido por Taller Satélite</p>
                        <p style={{ fontSize: '0.58rem', color: '#64748b', margin: '0.1rem 0 0' }}>{printWorkshop.nombre_taller}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .print-only {
          display: none;
        }
        @media print {
          @page {
            size: ${printMode === 'sticker' ? '100mm 100mm' : 'auto'};
            margin: 0;
          }
          body * {
            visibility: hidden !important;
          }
          .printable-workshop-order, .printable-workshop-order * {
            visibility: visible !important;
          }
          .printable-workshop-order {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            color: black !important;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: inline !important;
          }
        }
      `}} />
    </div>
  );
}
