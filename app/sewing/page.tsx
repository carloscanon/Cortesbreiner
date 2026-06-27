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

  // Inline inputs for cut accessories
  const [inlineAccId, setInlineAccId] = useState<Record<string, string>>({}); // cutId -> accId
  const [inlineAccQty, setInlineAccQty] = useState<Record<string, string>>({}); // cutId -> qty

  // Print state variables
  const [printOrder, setPrintOrder] = useState<any>(null);
  const [printWorkshop, setPrintWorkshop] = useState<any>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [customGafetes, setCustomGafetes] = useState<Record<string, string>>({});

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*, fabrics(nombre_tela), workshops(nombre_taller, responsable), cuts(*, cut_sizes(*))')
        .in('status', ['Cortado', 'En Confección', 'Terminada', 'Enviada'])
        .order('created_at', { ascending: false });

      const { data: workshopsData } = await supabase
        .from('workshops').select('*').order('nombre_taller');

      const { data: accData } = await supabase
        .from('accessories').select('*').order('nombre');

      // Fetch products referenced in cuts, plus all duplicate/matching products by name
      const uniqueProductIds = new Set<string>();
      (ordersData || []).forEach((o: any) => {
        (o.cuts || []).forEach((c: any) => {
          if (c.product_id) uniqueProductIds.add(String(c.product_id));
        });
      });

      let productsList: any[] = [];
      if (uniqueProductIds.size > 0) {
        const { data: directProds } = await supabase
          .from('products')
          .select('*')
          .in('id', Array.from(uniqueProductIds));
        
        const productNames = new Set<string>();
        (directProds || []).forEach((p: any) => {
          if (p.nombre_producto) productNames.add(p.nombre_producto);
        });

        if (productNames.size > 0) {
          const { data: matchedProds } = await supabase
            .from('products')
            .select('*')
            .in('nombre_producto', Array.from(productNames));
          productsList = matchedProds || [];
        } else {
          productsList = directProds || [];
        }
      }

      const { data: catData } = await supabase.from('categories').select('*');
      const { data: fabData } = await supabase.from('fabrics').select('*');
      const { data: sizesData } = await supabase.from('sizes').select('*').order('orden_visual', { ascending: true });
      const { data: colorsData } = await supabase.from('colors').select('*');
      const { data: allProductAccs } = await supabase.from('product_accessories').select('*, accessories(nombre, unidad_medida)');

      setOrders(ordersData || []);
      setWorkshops(workshopsData || []);
      setAccessories(accData || []);
      setProducts(productsList);
      setCategoriesMaster(catData || []);
      setFabricsMaster(fabData || []);
      setSizesMaster(sizesData || []);
      setColorsMaster(colorsData || []);
      setProductAccessoriesList(allProductAccs || []);
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
    const assignments: { categoryName: string; size: string; qty: number; wId: string }[] = [];
    
    Object.entries(categoryAssignments).forEach(([catId, cat]) => {
      Object.entries(cat.sizes).forEach(([sz, qty]) => {
        if (qty > 0) {
          const cellKey = `${catId}_${sz}`;
          const wId = rowWorkshops[cellKey];
          if (!wId) {
            missingKeys.push(cellKey);
          } else {
            assignments.push({
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
            const mappingProdObj = products.find(p => String(p.id) === String(pa.product_id));
            return mappingProdObj && prodName && mappingProdObj.nombre_producto?.toLowerCase().trim() === prodName.toLowerCase().trim();
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
        await supabase.from('sewing_assignments').delete().eq('order_id', selectedOrder.id);
        await supabase.from('sewing_accessories').delete().eq('order_id', selectedOrder.id);

        if (assignmentsToInsert.length > 0) {
          const { error: assDbErr } = await supabase.from('sewing_assignments').insert(assignmentsToInsert);
          if (assDbErr) console.warn("DB assignments insert failed:", assDbErr.message);
        }

        if (accessoriesToInsert.length > 0) {
          const { error: accDbErr } = await supabase.from('sewing_accessories').insert(accessoriesToInsert);
          if (accDbErr) console.warn("DB accessories insert failed:", accDbErr.message);
        }

        // ── MOVIMIENTOS DE INVENTARIO → estado: 'confeccion' ────────────────────────────
        await syncOrderMovements(selectedOrder.id, 'En Confección');
      } catch (dbErr: any) {
        console.warn("DB operations failed (check schema):", dbErr.message);
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
      sizeCode: string;
      quantity: number;
      cutId: string;
    }[] = [];

    if (!order || !order.cuts) return items;

    order.cuts.forEach((cut: any) => {
      const prod = products.find(p => String(p.id) === String(cut.product_id));
      const catId = prod ? String(prod.id) : 'sin_prod';
      const categoryName = prod ? (prod.nombre_producto || 'Sin Referencia') : 'Sin Referencia';
      
      const colorObj = colorsMaster.find(c => String(c.id) === String(cut.color_id));
      const colorName = colorObj ? colorObj.nombre_color : 'Color';

      const layersProyec = cut.layers || 1;
      const layersProduced = cut.layers_produced || 0;

      (cut.cut_sizes || []).forEach((cs: any) => {
        const sizeObj = sizesMaster.find(s => String(s.id) === String(cs.size_id));
        const sz = sizeObj ? sizeObj.codigo_talla : 'S/T';

        const cellKey = `${catId}_${sz}`;
        const assignedWorkshopId = rowWorkshopsData[cellKey];

        if (String(assignedWorkshopId) === String(targetWorkshopId)) {
          const proyecQty = Number(cs.quantity) || 0;
          const ppc = proyecQty / layersProyec;
          const realQty = Math.round(ppc * layersProduced);
          
          if (realQty > 0) {
            items.push({
              productName: prod ? prod.nombre_producto : 'Sin Referencia',
              colorName,
              categoryName,
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
      const { error } = await supabase.from('orders').update({ status }).eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
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

  const filtered = orders.filter(o => {
    const matchSearch = (o.internal_code || '').toLowerCase().includes(search.toLowerCase()) ||
                        (o.client_name || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' ? true : o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const cortadas = filtered.filter(o => o.status === 'Cortado');
  const enConfeccion = filtered.filter(o => o.status === 'En Confección');
  const terminadas = filtered.filter(o => o.status === 'Terminada' || o.status === 'Enviada');

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

      {/* ── Cortadas pendientes: mini-panel ── */}
      {cortadas.length > 0 && (
        <div className="card" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden', border: '2px solid #fde68a' }}>
          <div style={{ padding: '1rem 1.5rem', backgroundColor: '#fffbeb', borderBottom: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Scissors size={18} style={{ color: '#d97706' }} />
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
                {['Orden', 'Cliente / Tela', 'Prendas', 'Taller', 'Estado', 'Acción'].map(h => (
                  <th key={h} style={{ padding: '0.875rem 1.25rem', fontSize: '0.68rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', textAlign: h === 'Acción' ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: '4rem', textAlign: 'center' }}><Loader2 className="animate-spin" size={28} style={{ margin: 'auto', color: '#7c3aed' }} /></td></tr>
              ) : filtered.filter(o => o.status !== 'Cortado').length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>No hay órdenes en este estado.</td></tr>
              ) : filtered.filter(o => o.status !== 'Cortado').map(order => {
                const statusColor = order.status === 'En Confección' ? { bg: '#eff6ff', color: '#2563eb' }
                  : order.status === 'Terminada' ? { bg: '#f0fdf4', color: '#16a34a' }
                  : { bg: '#f5f3ff', color: '#7c3aed' };
                return (
                  <tr key={order.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1rem 1.25rem', fontWeight: '900', color: '#7c3aed', fontSize: '0.9rem' }}>
                      OC-{order.internal_code}
                    </td>
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <div style={{ fontWeight: '700', fontSize: '0.85rem', color: '#0f172a' }}>{order.client_name}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{order.fabrics?.nombre_tela}</div>
                    </td>
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <span style={{ fontWeight: '800', fontSize: '0.9rem' }}>{getTotalPrendas(order)}</span>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: '0.25rem' }}>uds</span>
                    </td>
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <div style={{ fontWeight: '700', fontSize: '0.82rem' }}>{order.workshops?.nombre_taller || '—'}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{order.workshops?.responsable}</div>
                    </td>
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <span style={{ padding: '0.3rem 0.75rem', borderRadius: '999px', fontSize: '0.65rem', fontWeight: '800', backgroundColor: statusColor.bg, color: statusColor.color }}>
                        {order.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button
                          className="btn"
                          style={{ fontSize: '0.75rem', fontWeight: '700', padding: '0.45rem 0.875rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                          onClick={() => handleOpenPrintModal(order)}
                        >
                          <Printer size={13} /> Órdenes Taller
                        </button>
                        {order.status === 'En Confección' && (
                          <button
                            className="btn"
                            style={{ fontSize: '0.75rem', fontWeight: '700', padding: '0.45rem 0.875rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px' }}
                            onClick={() => handleUpdateStatus(order.id, 'Terminada')}
                          >
                            Recibir de Taller
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
                            {/* Fila 1: Nombres de Categorías (llamados Productos en la interfaz) */}
                            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                              <th style={{ padding: '0.6rem', textAlign: 'left', fontWeight: '900', color: '#475569', borderBottom: '2px solid #cbd5e1' }} rowSpan={2}>Tela</th>
                              <th style={{ padding: '0.6rem', textAlign: 'center', fontWeight: '900', color: '#475569', borderBottom: '2px solid #cbd5e1' }} rowSpan={2}>Kilos</th>
                              <th style={{ padding: '0.6rem', textAlign: 'center', fontWeight: '900', color: '#475569', borderBottom: '2px solid #cbd5e1' }} rowSpan={2}>Capas</th>
                              {orderCategories.map((cat: any) => {
                                const colSpan = categorySizes[cat.id]?.length || 1;
                                return (
                                  <th key={cat.id} colSpan={colSpan} style={{ padding: '0.6rem', textAlign: 'center', fontWeight: '950', color: '#1e1b4b', borderLeft: '2px solid #cbd5e1', borderBottom: '2px solid #7c3aed', backgroundColor: '#faf5ff' }}>
                                    {cat.categoria}
                                  </th>
                                );
                              })}
                              <th style={{ padding: '0.6rem', textAlign: 'center', fontWeight: '950', color: '#475569', backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }} rowSpan={2}>Total Color</th>
                            </tr>
                            {/* Fila 2: Tallas correspondientes */}
                            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                              {orderCategories.map((cat: any) => (
                                (categorySizes[cat.id] || []).map((sz: string, idx: number) => (
                                  <th key={`${cat.id}_${sz}`} style={{ padding: '0.4rem', textAlign: 'center', fontWeight: '800', color: '#475569', borderLeft: idx === 0 ? '2px solid #cbd5e1' : '1px solid #e2e8f0', fontSize: '0.72rem' }}>
                                    {sz}
                                  </th>
                                ))
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {/* Fila de Ratios / Marcación de Trazos */}
                            <tr style={{ backgroundColor: '#fdf4ff', fontWeight: '700', borderBottom: '2px solid #ddd6fe' }}>
                              <td style={{ padding: '0.6rem', fontWeight: '900', color: '#701a75' }}>Marcación (Molds)</td>
                              <td style={{ padding: '0.6rem', textAlign: 'center', color: '#a21caf' }}>—</td>
                              <td style={{ padding: '0.6rem', textAlign: 'center', color: '#a21caf' }}>—</td>
                              {orderCategories.map((cat: any) => (
                                (categorySizes[cat.id] || []).map((sz: string, idx: number) => {
                                  const ratio = categoryRatios[`${cat.id}_${sz}`] || 0;
                                  return (
                                    <td key={`ratio_${cat.id}_${sz}`} style={{ padding: '0.5rem', textAlign: 'center', borderLeft: idx === 0 ? '2px solid #cbd5e1' : '1px solid #f5d0fe', color: '#701a75', fontWeight: '900' }}>
                                      {ratio}
                                    </td>
                                  );
                                })
                              ))}
                              <td style={{ padding: '0.6rem', textAlign: 'center', fontWeight: '900', backgroundColor: '#f5d0fe', color: '#701a75' }}>
                                {orderCategories.reduce((accTotal, cat) => {
                                  return accTotal + (categorySizes[cat.id] || []).reduce((subSum, sz) => subSum + (categoryRatios[`${cat.id}_${sz}`] || 0), 0);
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
                                  <td style={{ padding: '0.6rem', textAlign: 'center', fontWeight: '800', color: '#7c3aed' }}>{colorRow.layers}</td>
                                  {orderCategories.map((cat: any) => (
                                    (categorySizes[cat.id] || []).map((sz: string, idx: number) => {
                                      const qty = colorRow.quantities[`${cat.id}_${sz}`] || 0;
                                      rowTotal += qty;
                                      return (
                                        <td key={`qty_${colorRow.fabricId}_${cat.id}_${sz}`} style={{ padding: '0.6rem', textAlign: 'center', borderLeft: idx === 0 ? '2px solid #cbd5e1' : '1px solid #f1f5f9', fontWeight: '700', color: qty > 0 ? '#1e293b' : '#cbd5e1' }}>
                                          {qty || 0}
                                        </td>
                                      );
                                    })
                                  ))}
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
                              <td style={{ padding: '0.6rem', textAlign: 'center', color: '#7c3aed' }}>
                                {colorRows.reduce((sum: number, r: any) => sum + r.layers, 0)}
                              </td>
                              {orderCategories.map((cat: any) => (
                                (categorySizes[cat.id] || []).map((sz: string, idx: number) => {
                                  const colSum = colorRows.reduce((sum: number, r: any) => sum + (r.quantities[`${cat.id}_${sz}`] || 0), 0);
                                  return (
                                    <td key={`tot_${cat.id}_${sz}`} style={{ padding: '0.6rem', textAlign: 'center', color: '#7c3aed', fontWeight: '900', borderLeft: idx === 0 ? '2px solid #cbd5e1' : '1px solid #e2e8f0' }}>
                                      {colSum}
                                    </td>
                                  );
                                })
                              ))}
                              <td style={{ padding: '0.6rem', textAlign: 'center', color: '#7c3aed', fontWeight: '950', backgroundColor: '#f1f5f9' }}>
                                {colorRows.reduce((sum: number, r: any) => {
                                  return sum + Object.values(r.quantities).reduce((a: any, b: any) => a + b, 0);
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
                                  const paProd = products.find(p => p.id === pa.product_id);
                                  return paProd && cat.categoryName && paProd.nombre_producto?.toLowerCase().trim() === cat.categoryName.toLowerCase().trim();
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

                  <div>
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
                const dataAss = getAssignmentsData(printOrder);
                const assignedWorkshopIds = Array.from(new Set(Object.values(dataAss.rowWorkshops).filter(Boolean)));
                
                if (assignedWorkshopIds.length === 0) {
                  return <p style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center', padding: '1rem' }}>No hay talleres asignados a esta orden.</p>;
                }

                return assignedWorkshopIds.map((wId: any) => {
                  const workshopObj = workshops.find(w => String(w.id) === String(wId));
                  const itemsForW = getWorkshopItems(printOrder, String(wId), dataAss.rowWorkshops);
                  const totalUds = itemsForW.reduce((sum, item) => sum + item.quantity, 0);

                  if (totalUds === 0) return null;

                  return (
                    <div key={wId} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '12px',
                      backgroundColor: '#f8fafc'
                    }}>
                      <div>
                        <h4 style={{ fontWeight: '800', fontSize: '0.875rem', color: '#0f172a', margin: 0 }}>
                          {workshopObj ? workshopObj.nombre_taller : `Taller ID: ${wId}`}
                        </h4>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.1rem 0 0' }}>
                          Código Seguimiento: <strong style={{ color: '#7c3aed' }}>{((printOrder.internal_code || '').replace(/^OC-?/i, '') || printOrder.consecutive)}-{assignedWorkshopIds.indexOf(wId) + 1}</strong>
                        </p>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.1rem 0 0' }}>
                          Responsable: {workshopObj?.responsable || '—'} · <strong>{totalUds} prendas</strong>
                        </p>
                      </div>
                      <button
                        className="btn"
                        style={{
                          backgroundColor: '#7c3aed', color: 'white', border: 'none',
                          padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800',
                          display: 'flex', alignItems: 'center', gap: '0.25rem'
                        }}
                        onClick={() => {
                          setPrintWorkshop(workshopObj || { id: wId, nombre_taller: `Taller ${wId}` });
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
              <span style={{ fontWeight: '900', fontSize: '0.85rem', color: '#0f172a' }}>Vista Previa de Impresión - Taller: {printWorkshop.nombre_taller}</span>
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
                  onClick={() => setPrintWorkshop(null)}
                  style={{ padding: '0.45rem 1rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700' }}
                >
                  Cerrar
                </button>
              </div>
            </div>

            {/* Printable container */}
            <div className="printable-workshop-order" style={{ flex: 1, overflowY: 'auto', padding: '2.5rem', backgroundColor: 'white', color: 'black' }}>
              {(() => {
                const dataAss = getAssignmentsData(printOrder);
                const workshopItems = getWorkshopItems(printOrder, String(printWorkshop.id), dataAss.rowWorkshops);
                
                // Calculate accessories required based on product definitions
                const workshopAccs: { name: string; unit: string; qty: number }[] = [];
                
                workshopItems.forEach(item => {
                  const cut = printOrder.cuts?.find((c: any) => String(c.id) === String(item.cutId));
                  if (!cut || !cut.product_id) return;

                  // Find accessories for this product matching by product name (to handle duplicates/references gracefully)
                  const prodObj = products.find(p => String(p.id) === String(cut.product_id));
                  const prodName = prodObj?.nombre_producto;
                  const prodAccs = productAccessoriesList.filter(pa => {
                    const mappingProdObj = products.find(p => String(p.id) === String(pa.product_id));
                    return mappingProdObj && prodName && mappingProdObj.nombre_producto?.toLowerCase().trim() === prodName.toLowerCase().trim();
                  });
                  prodAccs.forEach(pa => {
                    let accName = pa.accessories?.nombre || 'Accesorio';
                    const accUnit = pa.accessories?.unidad_medida || 'uds';
                    const qtyPerProduct = Number(pa.cantidad) || 0;
                    const totalRequired = item.quantity * qtyPerProduct;
                    
                    // If it is a gafe/gafete, check for custom selection
                    const isGafete = accName.toLowerCase().includes('gafe') || accName.toLowerCase().includes('gafete');
                    if (isGafete && customGafetes[accName]) {
                      accName = customGafetes[accName];
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
                        {(() => {
                          const cleanCode = (printOrder.internal_code || '').replace(/^OC-?/i, '') || printOrder.consecutive;
                          const uniqueWIds = Array.from(new Set(Object.values(dataAss.rowWorkshops).filter(Boolean))) as string[];
                          const wIdx = uniqueWIds.indexOf(String(printWorkshop.id)) + 1;
                          const displayIdx = wIdx > 0 ? wIdx : 1;
                          return (
                            <p style={{ fontSize: '0.95rem', fontWeight: '950', color: '#7c3aed', margin: 0 }}>
                              {cleanCode}-{displayIdx}
                            </p>
                          );
                        })()}
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
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1' }}>
                            <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '800' }}>Referencia</th>
                            <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '800' }}>Color</th>
                            <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '800' }}>Categoría</th>
                            <th style={{ padding: '0.5rem', textAlign: 'center', fontWeight: '800' }}>Talla</th>
                            <th style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '900' }}>Cantidad</th>
                          </tr>
                        </thead>
                        <tbody>
                          {workshopItems.map((item, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '0.5rem', fontWeight: '700' }}>{item.productName}</td>
                              <td style={{ padding: '0.5rem' }}>{item.colorName}</td>
                              <td style={{ padding: '0.5rem', color: '#475569' }}>{item.categoryName}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: '800', color: '#7c3aed' }}>{item.sizeCode}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '800' }}>{item.quantity} uds</td>
                            </tr>
                          ))}
                          <tr style={{ backgroundColor: '#f8fafc', fontWeight: '900', borderTop: '1.5px solid #cbd5e1' }}>
                            <td colSpan={4} style={{ padding: '0.6rem 0.5rem', textTransform: 'uppercase' }}>Total Unidades Enviadas</td>
                            <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', color: '#7c3aed', fontSize: '0.85rem' }}>
                              {workshopItems.reduce((sum, item) => sum + item.quantity, 0)} uds
                            </td>
                          </tr>
                        </tbody>
                      </table>
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
                                          value={wa.name}
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
                                      </div>
                                    ) : (
                                      wa.name
                                    )}
                                  </td>
                                  <td style={{ padding: '0.5rem', color: '#475569' }}>{wa.unit}</td>
                                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '800', color: '#059669' }}>{wa.qty} {wa.unit}</td>
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
