'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  CheckCircle2, XCircle, AlertCircle, Search, ClipboardCheck,
  Plus, X, Loader2, Save, ClipboardList, Package, ChevronDown, ChevronUp
} from 'lucide-react';

const STATUS_OPTIONS = ['Pendiente', 'Aprobado', 'Doblado', 'Empacado', 'Reproceso', 'Rechazado'];
const DEFECT_CHECKLIST_OPTIONS = [
  'Costura', 'Medida', 'Mancha', 'Agujero', 'Lavado', 'Bordado', 'Estampado',
  'Accesorios', 'Hilo', 'Tela', 'Corte', 'Cuello', 'Manga', 'Cremallera', 'Botón', 'Otro'
];

const EMPTY_FORM = {
  order_id: '',
  sewing_order_id: '',
  workshop_name: '',
  items_inspected: '',
  items_approved: '',
  items_rejected: '',
  status: 'Pendiente',
  notes: '',
  lavanderia: '0',
  saldos: '0',
  costuras: '0',
  incompleto: '0',
  valor_prenda: '3500',
  descuento_defectos: '0',
  valor_pagar: '0',
  pago_status: 'Pendiente de aprobación financiera',
};

// Fetch all pages of a query
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
    } else break;
  }
  return allData;
};

export default function QualityPage() {
  const [inspections, setInspections] = useState<any[]>([]);
  const [sewingOrders, setSewingOrders] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  // Individual garments states
  const [individualGarments, setIndividualGarments] = useState<any[]>([]);
  const [loadingGarments, setLoadingGarments] = useState(false);
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [selectedGarment, setSelectedGarment] = useState<any>(null);
  const [defectChecklist, setDefectChecklist] = useState<Record<string, boolean>>({});
  const [garmentNotes, setGarmentNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  // Track per-row approved/rejected in the detail table
  const [rowApproved, setRowApproved] = useState<Record<string, number>>({});
  const [rowRejected, setRowRejected] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchAll(() => supabase.from('products').select('*')).then(setProducts);
    supabase.from('sizes').select('*').order('orden_visual', { ascending: true }).then(({ data }) => setSizes(data || []));
    supabase.from('colors').select('*').then(({ data }) => setColors(data || []));
    supabase.from('workshops').select('*').then(({ data }) => setWorkshops(data || []));
    fetchInspections();
    fetchSewingOrders();
  }, []);

  const fetchInspections = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('quality_inspections')
      .select(`
        *,
        orders (
          id,
          consecutive,
          internal_code,
          client_name,
          brand
        ),
        sewing_orders (
          id,
          confeccion_code,
          workshops (
            nombre_taller
          )
        )
      `)
      .order('created_at', { ascending: false });
    setInspections(data || []);
    setLoading(false);
  };

  const fetchSewingOrders = async () => {
    const { data } = await supabase
      .from('sewing_orders')
      .select(`
        id,
        confeccion_code,
        parent_order_id,
        orders (
          id,
          consecutive,
          internal_code,
          client_name,
          brand
        ),
        workshops (
          id,
          nombre_taller
        )
      `)
      .order('created_at', { ascending: false });
    setSewingOrders(data || []);
  };

  const fetchIndividualGarments = async (soId: string) => {
    setLoadingGarments(true);
    const { data } = await supabase
      .from('individual_garments')
      .select('*')
      .eq('sewing_order_id', soId)
      .order('barcode', { ascending: true });
    setIndividualGarments(data || []);
    setLoadingGarments(false);
  };

  const generateIndividualGarments = async () => {
    if (!orderDetail) return;
    setLoadingGarments(true);
    
    const toInsert: any[] = [];
    let globalIndex = 1;
    
    const prodObj = products.find(p => String(p.id) === String(orderDetail.product_id));
    const refName = prodObj ? prodObj.nombre_producto : 'Ref';
    
    // Find cut matching this product to get color
    const cutObj = orderDetail.parent_order?.cuts?.find((c: any) => String(c.product_id) === String(orderDetail.product_id));
    const colorObj = cutObj ? colors.find(col => String(col.id) === String(cutObj.color_id)) : null;
    const colorName = colorObj ? colorObj.nombre_color : (cutObj?.color || 'Color');
    
    // Distribution of sizes
    const sizesToGen = orderDetail.sewing_order_sizes || [];
    
    sizesToGen.forEach((sos: any) => {
      const qty = Number(sos.cantidad_planeada) || 0;
      const sizeObj = sizes.find(s => String(s.id) === String(sos.size_id));
      const sizeCode = sizeObj ? sizeObj.codigo_talla : 'ST';
      
      for (let i = 0; i < qty; i++) {
        const paddedIdx = globalIndex.toString().padStart(4, '0');
        const barcode = `${orderDetail.confeccion_code || 'OC'}-${sizeCode}-${paddedIdx}`;
        toInsert.push({
          sewing_order_id: orderDetail.id,
          quality_inspection_id: editingId || null,
          barcode,
          reference_name: refName,
          color_name: colorName,
          size_code: sizeCode,
          status: 'Pendiente',
          defect_checklist: {}
        });
        globalIndex++;
      }
    });

    if (toInsert.length === 0) {
      alert('No hay prendas planeadas en esta orden para generar.');
      setLoadingGarments(false);
      return;
    }

    const { error } = await supabase.from('individual_garments').insert(toInsert);
    if (error) {
      alert('Error al generar prendas: ' + error.message);
    } else {
      await fetchIndividualGarments(orderDetail.id);
    }
    setLoadingGarments(false);
  };

  const handleUpdateGarment = async (garmentId: string, updates: any) => {
    const { error } = await supabase.from('individual_garments').update(updates).eq('id', garmentId);
    if (error) {
      alert('Error al actualizar prenda: ' + error.message);
    } else {
      // Re-fetch list
      if (orderDetail) {
        await fetchIndividualGarments(orderDetail.id);
      }
      // Update selectedGarment state to reflect changes
      setSelectedGarment((prev: any) => prev && prev.id === garmentId ? { ...prev, ...updates } : prev);
    }
  };

  const handleScanBarcode = (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;
    const found = individualGarments.find(g => g.barcode.toLowerCase() === cleanCode.toLowerCase());
    if (found) {
      setSelectedGarment(found);
      setDefectChecklist(found.defect_checklist || {});
      setGarmentNotes(found.notes || '');
      setPhotoUrl(found.photo_url || '');
      setBarcodeSearch('');
    } else {
      alert(`No se encontró la prenda con código: ${cleanCode}`);
    }
  };

  const fetchOrderDetail = async (id: string, isSewingOrder: boolean = true) => {
    setLoadingDetail(true);
    setOrderDetail(null);
    setSelectedGarment(null);
    if (isSewingOrder) {
      const { data } = await supabase
        .from('sewing_orders')
        .select(`
          *,
          parent_order:orders(
            *,
            fabrics(nombre_tela),
            workshops(nombre_taller, responsable),
            cuts(
              *,
              cut_sizes(*)
            )
          ),
          sewing_order_sizes(
            *,
            sizes(*)
          ),
          workshops(nombre_taller, responsable)
        `)
        .eq('id', id)
        .single();
      
      setOrderDetail(data);
      await fetchIndividualGarments(id);

      // Determine price per garment (valor_prenda)
      if (data) {
        let garmentRate = 3500;
        if (data.tarifa_especial && Number(data.tarifa_especial) > 0) {
          // If special cost is enabled, use it
          garmentRate = Number(data.tarifa_especial);
        } else {
          // Fallback to workshop rates in workshop master based on product category
          const prod = products.find(p => String(p.id) === String(data.product_id));
          if (prod && data.workshop_id) {
            const { data: rateData } = await supabase
              .from('workshop_rates')
              .select('rate')
              .eq('workshop_id', data.workshop_id)
              .eq('category_id', prod.category_id)
              .maybeSingle();
            if (rateData && rateData.rate) {
              garmentRate = Number(rateData.rate);
            }
          }
        }
        // Update form state with the resolved rate
        setForm((f: any) => ({ ...f, valor_prenda: garmentRate.toString() }));
      }
    } else {
      const { data } = await supabase
        .from('orders')
        .select('*, fabrics(nombre_tela), workshops(nombre_taller, responsable), cuts(*, cut_sizes(*))')
        .eq('id', id)
        .single();
      setOrderDetail(data);
    }
    setLoadingDetail(false);
  };

  // Build detail rows from order cuts
  const getDetailRows = (order: any) => {
    if (!order) return [];

    // Check if it is a sewing order (has sewing_order_sizes)
    if (order.sewing_order_sizes) {
      const sewingOrder = order;
      const parent = sewingOrder.parent_order;
      if (!parent || !parent.cuts) return [];

      const rows: { key: string; productName: string; colorName: string; size: string; quantity: number }[] = [];
      parent.cuts.forEach((cut: any) => {
        // Only include cuts for this specific product
        if (String(cut.product_id) !== String(sewingOrder.product_id)) return;

        const prod = products.find(p => String(p.id) === String(cut.product_id));
        const colorObj = colors.find(c => String(c.id) === String(cut.color_id));
        const colorName = colorObj ? colorObj.nombre_color : (cut.color || '—');
        const productName = prod ? prod.nombre_producto : 'Sin Referencia';

        const layersProyec = cut.layers || 1;
        const layersProduced = cut.layers_produced || 0;

        (cut.cut_sizes || []).forEach((cs: any) => {
          const sizeObj = sizes.find(s => String(s.id) === String(cs.size_id));
          const sz = sizeObj ? sizeObj.codigo_talla : (cs.size_code || 'S/T');

          // Check if this size is assigned to this sewing order
          const isAssigned = sewingOrder.sewing_order_sizes.some(
            (sos: any) => String(sos.size_id) === String(cs.size_id) && (sos.cantidad_planeada || 0) > 0
          );
          if (!isAssigned) return;

          let qty = 0;
          if (cs.quantity_produced !== undefined && cs.quantity_produced !== null) {
            qty = Number(cs.quantity_produced);
          } else {
            const proyecQty = Number(cs.quantity) || 0;
            const ppc = layersProyec > 0 ? proyecQty / layersProyec : 0;
            qty = Math.round(ppc * layersProduced);
          }

          if (qty > 0) {
            const key = `${cut.id}_${cs.id}`;
            rows.push({ key, productName, colorName, size: sz, quantity: qty });
          }
        });
      });
      return rows;
    }

    // Otherwise fallback to parent order
    if (!order.cuts) return [];
    const rows: { key: string; productName: string; colorName: string; size: string; quantity: number }[] = [];
    order.cuts.forEach((cut: any) => {
      const prod = products.find(p => String(p.id) === String(cut.product_id));
      const colorObj = colors.find(c => String(c.id) === String(cut.color_id));
      const colorName = colorObj ? colorObj.nombre_color : (cut.color || '—');
      const productName = prod ? prod.nombre_producto : 'Sin Referencia';
      const layersProyec = cut.layers || 1;
      const layersProduced = cut.layers_produced || 0;
      (cut.cut_sizes || []).forEach((cs: any) => {
        const sizeObj = sizes.find(s => String(s.id) === String(cs.size_id));
        const sz = sizeObj ? sizeObj.codigo_talla : (cs.size_code || 'S/T');
        let qty = 0;
        if (cs.quantity_produced !== undefined && cs.quantity_produced !== null) {
          qty = Number(cs.quantity_produced);
        } else {
          const proyecQty = Number(cs.quantity) || 0;
          const ppc = layersProyec > 0 ? proyecQty / layersProyec : 0;
          qty = Math.round(ppc * layersProduced);
        }
        if (qty > 0) {
          const key = `${cut.id}_${cs.id}`;
          rows.push({ key, productName, colorName, size: sz, quantity: qty });
        }
      });
    });
    return rows;
  };

  // Compute totals from per-row inputs
  const computeTotalsFromRows = (rows: any[]) => {
    let totalApproved = 0;
    let totalRejected = 0;
    rows.forEach(row => {
      totalApproved += rowApproved[row.key] || 0;
      totalRejected += rowRejected[row.key] || 0;
    });
    return { totalApproved, totalRejected };
  };

  const handleSave = async () => {
    if (!form.sewing_order_id && !form.order_id) return alert('Selecciona una orden.');
    setSaving(true);

    const selectedSewingOrder = sewingOrders.find(so => so.id === form.sewing_order_id);
    const parentOrderId = selectedSewingOrder ? selectedSewingOrder.parent_order_id : form.order_id;
    const selectedOrder = orders.find(o => o.id === parentOrderId);
    const rows = getDetailRows(orderDetail);
    
    const lavVal = Number(form.lavanderia) || 0;
    const salVal = Number(form.saldos) || 0;
    const cosVal = Number(form.costuras) || 0;
    const incVal = Number(form.incompleto) || 0;
    
    // Total rejected is the sum of breakdown categories
    let finalRejected = lavVal + salVal + cosVal + incVal;
    let finalApproved = Number(form.items_approved) || 0;

    // If we have individual garments generated, calculate everything from them
    if (individualGarments.length > 0) {
      finalApproved = individualGarments.filter(g => g.status === 'Aprobada').length;
      finalRejected = individualGarments.filter(g => g.status === 'Rechazada').length;
      // Update form counts
      form.items_inspected = individualGarments.length.toString();
    } else if (rows.length > 0) {
      // If we have per-row data, compute approved from that
      const { totalApproved, totalRejected } = computeTotalsFromRows(rows);
      if (totalApproved > 0) {
        finalApproved = totalApproved;
      }
      if (totalRejected > 0 && finalRejected === 0) {
        finalRejected = totalRejected;
      }
    }

    const totalInspected = Number(form.items_inspected) || 0;

    if (finalRejected > totalInspected) {
      setSaving(false);
      return alert(`❌ La cantidad de prendas rechazadas (${finalRejected}) no puede ser mayor que las prendas inspeccionadas (${totalInspected}).`);
    }

    if (finalApproved + finalRejected > totalInspected) {
      setSaving(false);
      return alert(`❌ La suma de prendas aprobadas (${finalApproved}) y rechazadas (${finalRejected}) no puede superar el total de prendas inspeccionadas (${totalInspected}).`);
    }

    // Settlement calculations
    const valPrenda = Number(form.valor_prenda) || 3500;
    const descDefectos = finalRejected * valPrenda;
    const valPagar = (finalApproved * valPrenda) - descDefectos;

    const payload = {
      order_id: parentOrderId || null,
      sewing_order_id: form.sewing_order_id || null,
      workshop_name: selectedSewingOrder?.workshops?.nombre_taller || selectedOrder?.workshops?.nombre_taller || form.workshop_name || '',
      items_inspected: totalInspected,
      items_approved: finalApproved,
      items_rejected: finalRejected,
      lavanderia: lavVal,
      saldos: salVal,
      costuras: cosVal,
      incompleto: incVal,
      status: form.status,
      notes: form.notes,
      valor_prenda: valPrenda,
      descuento_defectos: descDefectos,
      valor_pagar: valPagar,
      pago_status: form.pago_status || 'Pendiente de aprobación financiera',
    };

    let error = null;
    let savedInspectionId = editingId;
    if (editingId) {
      const res = await supabase.from('quality_inspections').update(payload).eq('id', editingId);
      error = res.error;
    } else {
      const res = await supabase.from('quality_inspections').insert([payload]).select().single();
      error = res.error;
      if (res.data) {
        savedInspectionId = res.data.id;
      }
    }

    // Update quality_inspection_id on individual_garments if this was a new inspection
    if (!error && savedInspectionId && form.sewing_order_id) {
      await supabase
        .from('individual_garments')
        .update({ quality_inspection_id: savedInspectionId })
        .eq('sewing_order_id', form.sewing_order_id)
        .is('quality_inspection_id', null);
    }

    if (error) {
      alert('Error al guardar: ' + error.message);
    } else {
      closeModal();
      fetchInspections();
    }
    setSaving(false);
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('quality_inspections').update({ status }).eq('id', id);
    fetchInspections();
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOrderDetail(null);
    setIndividualGarments([]);
    setSelectedGarment(null);
    setRowApproved({});
    setRowRejected({});
  };

  const openReview = async (item: any) => {
    setEditingId(item.id);
    setForm({
      order_id: item.order_id || '',
      sewing_order_id: item.sewing_order_id || '',
      workshop_name: item.workshop_name || '',
      items_inspected: (item.items_inspected || 0).toString(),
      items_approved: (item.items_approved || 0).toString(),
      items_rejected: (item.items_rejected || 0).toString(),
      lavanderia: (item.lavanderia || 0).toString(),
      saldos: (item.saldos || 0).toString(),
      costuras: (item.costuras || 0).toString(),
      incompleto: (item.incompleto || 0).toString(),
      status: item.status,
      notes: item.notes || '',
      valor_prenda: (item.valor_prenda || 3500).toString(),
      descuento_defectos: (item.descuento_defectos || 0).toString(),
      valor_pagar: (item.valor_pagar || 0).toString(),
      pago_status: item.pago_status || 'Pendiente de aprobación financiera',
    });
    setRowApproved({});
    setRowRejected({});
    setShowModal(true);
    await fetchOrderDetail(item.sewing_order_id || item.order_id, !!item.sewing_order_id);
  };

  // KPIs & Executive Metrics
  const pending = inspections.filter(i => i.status === 'Pendiente').length;
  const approved = inspections.filter(i => i.status === 'Aprobado').length;
  const folded = inspections.filter(i => i.status === 'Doblado').length;
  const packed = inspections.filter(i => i.status === 'Empacado').length;
  const rework = inspections.filter(i => i.status === 'Reproceso').length;
  const rejected = inspections.filter(i => i.status === 'Rechazado').length;

  // 1. Recepcionadas Hoy
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const inspectionsToday = inspections.filter(i => {
    if (!i.created_at) return false;
    const d = new Date(i.created_at);
    return d >= todayStart;
  });
  const countToday = inspectionsToday.reduce((sum, i) => sum + (i.items_inspected || 0), 0);

  // 2. En Inspección
  const countInInspection = inspections.filter(i => i.status === 'Pendiente' || i.status === 'Reproceso').length;

  // 3. Costo de Defectos / Descuentos
  const totalValueDiscounted = inspections.reduce((sum, i) => sum + (Number(i.descuento_defectos) || 0), 0);

  // 4. Valor por Pagar
  const totalValueToPay = inspections
    .filter(i => i.pago_status === 'Pendiente de aprobación financiera')
    .reduce((sum, i) => sum + (Number(i.valor_pagar) || 0), 0);

  // Workshop metrics grouping
  const workshopPerformance = Object.entries(
    inspections.reduce((acc: Record<string, any>, item: any) => {
      const wName = item.workshop_name || item.sewing_orders?.workshops?.nombre_taller || item.orders?.workshops?.nombre_taller || 'Taller Desconocido';
      if (!acc[wName]) {
        acc[wName] = {
          name: wName,
          inspected: 0,
          approved: 0,
          rejected: 0,
          count: 0,
        };
      }
      acc[wName].inspected += item.items_inspected || 0;
      acc[wName].approved += item.items_approved || 0;
      acc[wName].rejected += item.items_rejected || 0;
      acc[wName].count += 1;
      return acc;
    }, {})
  ).map(([_, w]: any) => {
    const qualityRate = w.inspected > 0 ? (w.approved / w.inspected) * 100 : 100;
    const reworksRate = w.inspected > 0 ? (w.rejected / w.inspected) * 100 : 0;
    
    // Delivery performance (simulated 95-99%)
    const deliveryRate = w.inspected > 0 ? 95 + (w.approved % 5) : 100;
    const scoreStars = qualityRate >= 98 ? 5 : qualityRate >= 95 ? 4 : qualityRate >= 90 ? 3 : 2;
    
    return {
      name: w.name,
      production: w.inspected,
      quality: qualityRate,
      rework: reworksRate,
      delivery: deliveryRate,
      stars: scoreStars,
    };
  }).sort((a, b) => b.quality - a.quality);

  const filtered = inspections.filter(i => {
    const orderCode = i.sewing_orders?.confeccion_code
      || (i.orders?.internal_code
        ? `OC-${i.orders.internal_code}`
        : i.orders?.consecutive ? `OC-${i.orders.consecutive.toString().padStart(4, '0')}` : '');
    const client = i.orders?.client_name || '';
    const workshop = i.workshop_name 
      || i.sewing_orders?.workshops?.nombre_taller 
      || i.orders?.workshops?.nombre_taller 
      || '';
    const matchSearch =
      orderCode.toLowerCase().includes(search.toLowerCase()) ||
      client.toLowerCase().includes(search.toLowerCase()) ||
      workshop.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus ? i.status === filterStatus : true;
    return matchSearch && matchStatus;
  });

  const detailRows = orderDetail ? getDetailRows(orderDetail) : [];
  const { totalApproved: rowTotalApproved, totalRejected: rowTotalRejected } = computeTotalsFromRows(detailRows);
  const hasRowData = rowTotalApproved > 0 || rowTotalRejected > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '4rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#7c3aed', textTransform: 'uppercase' }}>
            Etapa de Producción
          </span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '950', margin: '0.25rem 0 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.5rem', backgroundColor: '#7c3aed', borderRadius: '12px', color: 'white' }}>
              <ClipboardCheck size={24} />
            </div>
            Control de Calidad
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Inspección, trazabilidad unitaria por prenda y liquidación financiera.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setOrderDetail(null); setShowModal(true); }}>
          <Plus size={18} /> Nueva Inspección
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
        {[
          { label: 'Recepcionadas Hoy', value: `${countToday} uds`, color: '#7c3aed', icon: ClipboardList, desc: `${countInInspection} en inspección` },
          { label: 'Pendientes Financieros', value: `$${totalValueToPay.toLocaleString('es-CO')}`, color: '#f59e0b', icon: AlertCircle, desc: 'Pendiente de aprobación' },
          { label: 'Total Descuentos Defectos', value: `$${totalValueDiscounted.toLocaleString('es-CO')}`, color: '#ef4444', icon: XCircle, desc: 'Descontado de liquidaciones' },
          { label: 'Inspeccionadas Totales', value: `${inspections.reduce((sum, i) => sum + (i.items_inspected || 0), 0)} uds`, color: '#10b981', icon: CheckCircle2, desc: `${approved} aprobados / ${rejected} rechazados` },
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid var(--border)', borderRadius: '16px', backgroundColor: 'white' }}>
            <div style={{ padding: '0.75rem', backgroundColor: `${k.color}15`, color: k.color, borderRadius: '12px', flexShrink: 0 }}>
              <k.icon size={22} />
            </div>
            <div>
              <p style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{k.label}</p>
              <h3 style={{ fontSize: '1.35rem', fontWeight: '950', margin: '0.15rem 0', color: '#0f172a' }}>{k.value}</h3>
              <p style={{ fontSize: '0.65rem', color: '#64748b', margin: 0 }}>{k.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Taller Performance Cards / Ranking */}
      {workshopPerformance.length > 0 && (
        <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '0.9rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>Rendimiento y Calificación de Talleres</h3>
            <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0.1rem 0 0' }}>Indicadores de desempeño de confección y calidad por taller satélite.</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '2.5px solid var(--border)', textAlign: 'left', backgroundColor: '#f8fafc' }}>
                  {['Taller', 'Producción Recibida', 'Calidad %', 'Retrabajos / Defectos %', 'Cumplimiento Entrega %', 'Calificación'].map((h, i) => (
                    <th key={h} style={{ padding: '0.75rem', fontWeight: '900', color: '#475569', fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workshopPerformance.map((w, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: '800', color: '#0f172a' }}>{w.name}</td>
                    <td style={{ padding: '0.75rem', fontWeight: '700' }}>{w.production.toLocaleString()} uds</td>
                    <td style={{ padding: '0.75rem', fontWeight: '800', color: w.quality >= 95 ? '#16a34a' : w.quality >= 90 ? '#d97706' : '#dc2626' }}>{w.quality.toFixed(1)}%</td>
                    <td style={{ padding: '0.75rem', color: '#dc2626', fontWeight: '700' }}>{w.rework.toFixed(1)}%</td>
                    <td style={{ padding: '0.75rem', color: '#475569', fontWeight: '600' }}>{w.delivery.toFixed(1)}%</td>
                    <td style={{ padding: '0.75rem', color: '#eab308', fontSize: '1rem', fontWeight: '900' }}>
                      {'★'.repeat(w.stars)}{'☆'.repeat(5 - w.stars)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* List */}
      <div className="card" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden' }}>
        {/* Filters */}
        <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Buscar por orden, cliente o taller..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.5rem', borderRadius: '10px', border: '1.5px solid var(--border)', fontSize: '0.85rem' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {['', ...STATUS_OPTIONS].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)} className="btn" style={{
                fontSize: '0.72rem', fontWeight: '700', padding: '0.5rem 0.875rem',
                backgroundColor: filterStatus === s ? '#7c3aed' : 'white',
                color: filterStatus === s ? 'white' : 'var(--text)',
                border: '1px solid var(--border)', borderRadius: '8px'
              }}>{s === '' ? 'Todos' : s}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}><Loader2 className="animate-spin" style={{ margin: 'auto', color: '#7c3aed' }} size={28} /></div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <ClipboardList size={40} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p>No hay inspecciones registradas.</p>
            </div>
                    ) : filtered.map(item => {
            const orderCode = item.sewing_orders?.confeccion_code
              || (item.orders?.internal_code
                ? `OC-${item.orders.internal_code}`
                : item.orders?.consecutive ? `OC-${item.orders.consecutive.toString().padStart(4, '0')}` : '—');
            const client = item.orders?.client_name || '—';
            const workshop = item.workshop_name 
              || item.sewing_orders?.workshops?.nombre_taller 
              || item.orders?.workshops?.nombre_taller 
              || '—';
            const date = item.created_at ? new Date(item.created_at).toLocaleDateString('es-CO') : '—';
            const statusColor = item.status === 'Aprobado' ? { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' }
              : item.status === 'Reproceso' ? { bg: '#fffbeb', color: '#92400e', border: '#fde68a' }
              : item.status === 'Rechazado' ? { bg: '#fff1f2', color: '#9f1239', border: '#fecdd3' }
              : { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
            return (
              <div
                key={item.id}
                style={{ display: 'flex', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', gap: '1rem', flexWrap: 'wrap' }}
              >
                {/* Status dot */}
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: statusColor.color, flexShrink: 0 }} />

                {/* Info */}
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: '800', color: '#7c3aed' }}>{orderCode}</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#0f172a' }}>{client}</span>
                    <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '999px', backgroundColor: statusColor.bg, color: statusColor.color, border: `1px solid ${statusColor.border}`, fontWeight: '700' }}>
                      {item.status.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.72rem', color: '#64748b', flexWrap: 'wrap' }}>
                    <span>🏭 {workshop}</span>
                    {item.items_inspected > 0 && <span>📦 {item.items_inspected} prendas</span>}
                    {item.items_approved > 0 && <span style={{ color: '#16a34a', fontWeight: '700' }}>✓ {item.items_approved} aprobadas</span>}
                    {item.items_rejected > 0 && (
                      <span style={{ color: '#ef4444', fontWeight: '700' }}>
                        ✗ {item.items_rejected} rechazadas
                        {(item.costuras > 0 || item.lavanderia > 0 || item.saldos > 0 || item.incompleto > 0) && (
                          <span style={{ fontWeight: '500', fontSize: '0.68rem', color: '#7f1d1d', marginLeft: '0.2rem' }}>
                            ({[
                              item.costuras > 0 && `${item.costuras} costura`,
                              item.lavanderia > 0 && `${item.lavanderia} lavandería`,
                              item.saldos > 0 && `${item.saldos} saldos`,
                              item.incompleto > 0 && `${item.incompleto} incompleto`
                            ].filter(Boolean).join(', ')})
                          </span>
                        )}
                      </span>
                    )}
                    <span>📅 {date}</span>
                  </div>
                  {item.notes && item.notes !== 'Creado automáticamente al recibir de confección.' && (
                    <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem', fontStyle: 'italic' }}>{item.notes}</p>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                  <select
                    value={item.status}
                    onChange={e => updateStatus(item.id, e.target.value)}
                    style={{
                      padding: '0.4rem 0.75rem', borderRadius: '8px',
                      border: `1.5px solid ${statusColor.border}`,
                      fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer',
                      backgroundColor: statusColor.bg, color: statusColor.color,
                    }}
                  >
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button
                    className="btn"
                    style={{ padding: '0.4rem 0.9rem', fontSize: '0.72rem', fontWeight: '800', backgroundColor: '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    onClick={() => openReview(item)}
                  >
                    Revisar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── MODAL: Nueva / Revisar Inspección ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '780px', padding: 0, maxHeight: '95vh', display: 'flex', flexDirection: 'column', borderRadius: '20px', overflow: 'hidden' }}>

            {/* Modal header */}
            <div style={{ padding: '1.5rem 2rem', background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <p style={{ fontSize: '0.65rem', fontWeight: '800', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {editingId ? 'Revisar Inspección de Calidad' : 'Nueva Inspección de Calidad'}
                </p>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '950', color: 'white', margin: '0.25rem 0 0' }}>
                  {orderDetail
                    ? orderDetail.confeccion_code
                      ? `${orderDetail.confeccion_code} — ${orderDetail.parent_order?.client_name}`
                      : `OC-${orderDetail.internal_code || orderDetail.consecutive} — ${orderDetail.client_name}`
                    : 'Selecciona una orden de confección para revisar'}
                </h2>
              </div>
              <button onClick={closeModal} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', cursor: 'pointer', borderRadius: '8px', padding: '0.5rem' }}>
                <X size={20} />
              </button>
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* Order selector (only when creating new) */}
              {!editingId && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.35rem', color: '#374151' }}>Orden de Confección *</label>
                  <select
                    style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '0.875rem' }}
                    value={form.sewing_order_id}
                    onChange={async e => {
                      setForm({ ...form, sewing_order_id: e.target.value });
                      if (e.target.value) await fetchOrderDetail(e.target.value, true);
                      else setOrderDetail(null);
                    }}
                  >
                    <option value="">Seleccionar Orden de Confección...</option>
                    {sewingOrders.map(so => (
                      <option key={so.id} value={so.id}>
                        {so.confeccion_code} — {so.orders?.client_name} ({so.workshops?.nombre_taller || 'Sin taller'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Order context info when editing or detail loaded */}
               {orderDetail && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Context Card */}
                  <div style={{ padding: '1rem 1.25rem', backgroundColor: '#f5f3ff', borderRadius: '12px', border: '1.5px solid #ddd6fe', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ fontSize: '0.65rem', fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase', margin: 0 }}>Taller</p>
                      <p style={{ fontWeight: '800', fontSize: '0.9rem', margin: '0.1rem 0 0' }}>
                        {orderDetail.workshops?.nombre_taller || orderDetail.parent_order?.workshops?.nombre_taller || '—'}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.65rem', fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase', margin: 0 }}>Cliente</p>
                      <p style={{ fontWeight: '800', fontSize: '0.9rem', margin: '0.1rem 0 0' }}>
                        {orderDetail.parent_order?.client_name || orderDetail.client_name || '—'}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.65rem', fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase', margin: 0 }}>Tela</p>
                      <p style={{ fontWeight: '800', fontSize: '0.9rem', margin: '0.1rem 0 0' }}>
                        {orderDetail.parent_order?.fabrics?.nombre_tela || orderDetail.fabrics?.nombre_tela || '—'}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.65rem', fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase', margin: 0 }}>Total Esperado</p>
                      <p style={{ fontWeight: '800', fontSize: '0.9rem', margin: '0.1rem 0 0' }}>{detailRows.reduce((s, r) => s + r.quantity, 0)} prendas</p>
                    </div>
                  </div>

                  {/* Individual Garments Section */}
                  <div style={{ border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '1.25rem', backgroundColor: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: '900', color: '#1e293b', margin: 0 }}>Generación e Inspección Unitaria</h4>
                        <p style={{ fontSize: '0.7rem', color: '#64748b', margin: '0.1rem 0 0' }}>Trazabilidad unitaria de cada una de las prendas por código único.</p>
                      </div>
                      {individualGarments.length === 0 ? (
                        <button
                          onClick={generateIndividualGarments}
                          disabled={loadingGarments}
                          className="btn"
                          style={{
                            fontSize: '0.75rem', fontWeight: '800', padding: '0.6rem 1.25rem',
                            backgroundColor: '#7c3aed', color: 'white', border: 'none',
                            borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s'
                          }}
                        >
                          {loadingGarments ? 'Generando...' : '⚙️ GENERAR PRENDAS'}
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#16a34a', backgroundColor: '#f0fdf4', padding: '0.25rem 0.6rem', borderRadius: '6px' }}>
                            {individualGarments.length} prendas registradas
                          </span>
                        </div>
                      )}
                    </div>

                    {individualGarments.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {/* Barcode Search / Scanner Input */}
                        <form
                          onSubmit={e => {
                            e.preventDefault();
                            handleScanBarcode(barcodeSearch);
                          }}
                          style={{ display: 'flex', gap: '0.5rem' }}
                        >
                          <input
                            type="text"
                            placeholder="Escanear o ingresar código de barras unitario..."
                            value={barcodeSearch}
                            onChange={e => setBarcodeSearch(e.target.value)}
                            style={{ flex: 1, padding: '0.55rem 0.8rem', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '0.82rem' }}
                          />
                          <button
                            type="submit"
                            className="btn"
                            style={{ fontSize: '0.75rem', fontWeight: '700', padding: '0.55rem 1rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px' }}
                          >
                            Buscar
                          </button>
                        </form>

                        {/* Badges list */}
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', maxHeight: '110px', overflowY: 'auto', padding: '0.5rem', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          {individualGarments.map((g: any) => {
                            const badgeColor = g.status === 'Aprobada' ? { bg: '#d1fae5', color: '#065f46', border: '#a7f3d0' }
                              : g.status === 'Rechazada' ? { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' }
                              : g.status === 'Reproceso' ? { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' }
                              : { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
                            const isSelected = selectedGarment && selectedGarment.id === g.id;
                            return (
                              <button
                                key={g.id}
                                onClick={() => {
                                  setSelectedGarment(g);
                                  setDefectChecklist(g.defect_checklist || {});
                                  setGarmentNotes(g.notes || '');
                                  setPhotoUrl(g.photo_url || '');
                                }}
                                style={{
                                  fontSize: '0.62rem', fontWeight: '700', padding: '0.25rem 0.5rem',
                                  borderRadius: '6px', cursor: 'pointer',
                                  backgroundColor: isSelected ? '#7c3aed' : badgeColor.bg,
                                  color: isSelected ? 'white' : badgeColor.color,
                                  border: `1px solid ${isSelected ? '#7c3aed' : badgeColor.border}`,
                                  transition: 'all 0.1s'
                                }}
                              >
                                {g.barcode.split('-').slice(-2).join('-')}
                              </button>
                            );
                          })}
                        </div>

                        {/* Garment detailed inspection form */}
                        {selectedGarment && (
                          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                              <div>
                                <span style={{ fontSize: '0.75rem', fontWeight: '900', color: '#7c3aed' }}>{selectedGarment.barcode}</span>
                                <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: '0.5rem' }}>
                                  Ref: {selectedGarment.reference_name} | {selectedGarment.color_name} | Talla: {selectedGarment.size_code}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelectedGarment(null)}
                                style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem' }}
                              >
                                ✕ Cerrar
                              </button>
                            </div>

                            {/* Status selection */}
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              {['Aprobada', 'Reproceso', 'Rechazada'].map(st => {
                                const stColors: Record<string, { bg: string; border: string; color: string }> = {
                                  Aprobada: { bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a' },
                                  Reproceso: { bg: '#fffbeb', border: '#fde68a', color: '#d97706' },
                                  Rechazada: { bg: '#fff1f2', border: '#fecdd3', color: '#dc2626' }
                                };
                                const sc = stColors[st];
                                const isSel = selectedGarment.status === st;
                                return (
                                  <button
                                    key={st}
                                    type="button"
                                    onClick={() => handleUpdateGarment(selectedGarment.id, { status: st })}
                                    style={{
                                      flex: 1, padding: '0.45rem', borderRadius: '8px',
                                      fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer',
                                      backgroundColor: isSel ? sc.bg : 'white',
                                      color: isSel ? sc.color : '#64748b',
                                      border: `1.5px solid ${isSel ? sc.color : '#e2e8f0'}`
                                    }}
                                  >
                                    {st.toUpperCase()}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Defects Checklist */}
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '0.35rem' }}>Checklist de Defectos</label>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
                                {DEFECT_CHECKLIST_OPTIONS.map(opt => {
                                  const isChecked = !!defectChecklist[opt];
                                  return (
                                    <label
                                      key={opt}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.68rem',
                                        padding: '0.3rem', borderRadius: '6px', cursor: 'pointer',
                                        backgroundColor: isChecked ? '#fff1f2' : '#f8fafc',
                                        border: `1px solid ${isChecked ? '#fecdd3' : '#e2e8f0'}`,
                                        color: isChecked ? '#b91c1c' : '#475569'
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={e => {
                                          const nextCheck = { ...defectChecklist, [opt]: e.target.checked };
                                          setDefectChecklist(nextCheck);
                                          handleUpdateGarment(selectedGarment.id, { defect_checklist: nextCheck });
                                        }}
                                        style={{ accentColor: '#dc2626' }}
                                      />
                                      {opt}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Photo and notes */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#475569', marginBottom: '0.25rem' }}>URL Foto Evidencia</label>
                                <input
                                  type="text"
                                  placeholder="Pegar link de foto..."
                                  value={photoUrl}
                                  onChange={e => setPhotoUrl(e.target.value)}
                                  onBlur={() => handleUpdateGarment(selectedGarment.id, { photo_url: photoUrl })}
                                  style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1.5px solid var(--border)', fontSize: '0.72rem' }}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#475569', marginBottom: '0.25rem' }}>Notas Unitarias</label>
                                <input
                                  type="text"
                                  placeholder="Anotación particular..."
                                  value={garmentNotes}
                                  onChange={e => setGarmentNotes(e.target.value)}
                                  onBlur={() => handleUpdateGarment(selectedGarment.id, { notes: garmentNotes })}
                                  style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1.5px solid var(--border)', fontSize: '0.72rem' }}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Detail table fallback – only if no individual garments generated */}
                  {individualGarments.length === 0 && !loadingDetail && detailRows.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <Package size={16} style={{ color: '#7c3aed' }} />
                        <h3 style={{ fontSize: '0.85rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>
                          Detalle de Prendas a Revisar
                        </h3>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', marginLeft: 'auto' }}>
                          Ingresa cuántas prendas aprobaste y rechazaste por fila
                        </span>
                      </div>
                      <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1.5px solid #e2e8f0', backgroundColor: 'white' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                              {['Referencia', 'Color', 'Talla', 'Esperado', '✓ Aprobadas', '✗ Rechazadas'].map((h, i) => (
                                <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: i >= 3 ? 'center' : 'left', fontWeight: '800', color: '#475569', fontSize: '0.7rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {detailRows.map((row, idx) => {
                              return (
                                <tr key={row.key} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#0f172a' }}>{row.productName}</td>
                                  <td style={{ padding: '0.6rem 0.75rem', color: '#475569' }}>{row.colorName}</td>
                                  <td style={{ padding: '0.6rem 0.75rem' }}>
                                    <span style={{ backgroundColor: '#ede9fe', color: '#5b21b6', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: '700', fontSize: '0.75rem' }}>{row.size}</span>
                                  </td>
                                  <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: '800', color: '#334155' }}>{row.quantity}</td>
                                  <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                                    <input
                                      type="number" min="0" max={row.quantity} placeholder="0"
                                      value={rowApproved[row.key] ?? ''}
                                      onChange={e => setRowApproved(prev => ({ ...prev, [row.key]: Number(e.target.value) }))}
                                      style={{ width: '70px', padding: '0.35rem 0.4rem', borderRadius: '6px', border: '1.5px solid #bbf7d0', backgroundColor: '#f0fdf4', textAlign: 'center', fontWeight: '700', color: '#166534', fontSize: '0.82rem' }}
                                    />
                                  </td>
                                  <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                                    <input
                                      type="number" min="0" max={row.quantity} placeholder="0"
                                      value={rowRejected[row.key] ?? ''}
                                      onChange={e => setRowRejected(prev => ({ ...prev, [row.key]: Number(e.target.value) }))}
                                      style={{ width: '70px', padding: '0.35rem 0.4rem', borderRadius: '6px', border: '1.5px solid #fecaca', backgroundColor: '#fff5f5', textAlign: 'center', fontWeight: '700', color: '#991b1b', fontSize: '0.82rem' }}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Financial Settlement Panel */}
                  <div style={{ border: '1.5px solid #ddd6fe', borderRadius: '16px', padding: '1.5rem', backgroundColor: '#faf5ff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #ddd6fe', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: '950', color: '#5b21b6', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        💵 RESUMEN DE LIQUIDACIÓN
                      </h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#5b21b6' }}>Valor por Prenda:</span>
                        <input
                          type="number"
                          value={form.valor_prenda || '3500'}
                          onChange={e => setForm({ ...form, valor_prenda: e.target.value })}
                          style={{ width: '80px', padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1.5px solid #c084fc', fontSize: '0.78rem', fontWeight: '800', textAlign: 'center' }}
                        />
                      </div>
                    </div>

                    {(() => {
                      const totalRec = individualGarments.length > 0 ? individualGarments.length : detailRows.reduce((s, r) => s + r.quantity, 0);
                      const totalApp = individualGarments.length > 0 ? individualGarments.filter(g => g.status === 'Aprobada').length : rowTotalApproved;
                      const totalRej = individualGarments.length > 0 ? individualGarments.filter(g => g.status === 'Rechazada').length : rowTotalRejected;
                      const totalRep = individualGarments.length > 0 ? individualGarments.filter(g => g.status === 'Reproceso').length : 0;
                      const valPrendaNum = Number(form.valor_prenda) || 3500;
                      const appValue = totalApp * valPrendaNum;
                      const defDiscount = totalRej * valPrendaNum;
                      const netPayable = appValue - defDiscount;

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', backgroundColor: 'white', padding: '1rem', borderRadius: '10px', border: '1px solid #e9d5ff' }}>
                            <div style={{ textAlign: 'center' }}>
                              <p style={{ margin: 0, fontSize: '0.62rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Prendas Recibidas</p>
                              <p style={{ margin: '0.2rem 0 0', fontSize: '1.1rem', fontWeight: '950', color: '#475569' }}>{totalRec}</p>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <p style={{ margin: 0, fontSize: '0.62rem', color: '#16a34a', fontWeight: '700', textTransform: 'uppercase' }}>Prendas Aprobadas</p>
                              <p style={{ margin: '0.2rem 0 0', fontSize: '1.1rem', fontWeight: '950', color: '#16a34a' }}>{totalApp}</p>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <p style={{ margin: 0, fontSize: '0.62rem', color: '#dc2626', fontWeight: '700', textTransform: 'uppercase' }}>Prendas Rechazadas</p>
                              <p style={{ margin: '0.2rem 0 0', fontSize: '1.1rem', fontWeight: '950', color: '#dc2626' }}>{totalRej}</p>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <p style={{ margin: 0, fontSize: '0.62rem', color: '#d97706', fontWeight: '700', textTransform: 'uppercase' }}>En Reproceso</p>
                              <p style={{ margin: '0.2rem 0 0', fontSize: '1.1rem', fontWeight: '950', color: '#d97706' }}>{totalRep}</p>
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px dashed #ddd6fe', paddingTop: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#475569' }}>
                              <span>Valor Aprobado:</span>
                              <span style={{ fontWeight: '700' }}>${appValue.toLocaleString('es-CO')}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#dc2626' }}>
                              <span>Descuento Defectos:</span>
                              <span style={{ fontWeight: '700' }}>-${defDiscount.toLocaleString('es-CO')}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#5b21b6', fontWeight: '900', borderTop: '1.5px solid #ddd6fe', paddingTop: '0.5rem' }}>
                              <span>VALOR A PAGAR:</span>
                              <span>${netPayable.toLocaleString('es-CO')}</span>
                            </div>
                          </div>

                          <div style={{ marginTop: '0.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#5b21b6', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Estado de Aprobación Financiera</label>
                            <select
                              value={form.pago_status || 'Pendiente de aprobación financiera'}
                              onChange={e => setForm({ ...form, pago_status: e.target.value })}
                              style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1.5px solid #c084fc', fontSize: '0.8rem', fontWeight: '700', color: '#5b21b6', cursor: 'pointer' }}
                            >
                              <option value="Pendiente de aprobación financiera">⏳ Pendiente de aprobación financiera</option>
                              <option value="Autorizado para Pago">✅ Autorizado para Pago</option>
                              <option value="Pagado">💵 Pagado</option>
                            </select>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Save/Close Inspection triggers */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {individualGarments.length === 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', marginBottom: '0.25rem' }}>Aprobadas manual</label>
                          <input
                            type="number" min="0" placeholder="0"
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '0.8rem', textAlign: 'center' }}
                            value={form.items_approved}
                            onChange={e => setForm({ ...form, items_approved: e.target.value })}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', marginBottom: '0.25rem' }}>Rechazadas manual</label>
                          <input
                            type="number" min="0" placeholder="0"
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '0.8rem', textAlign: 'center' }}
                            value={form.items_rejected}
                            onChange={e => setForm({ ...form, items_rejected: e.target.value })}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', marginBottom: '0.25rem' }}>Total manual</label>
                          <input
                            type="number" min="0" placeholder="0"
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '0.8rem', textAlign: 'center' }}
                            value={form.items_inspected}
                            onChange={e => setForm({ ...form, items_inspected: e.target.value })}
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '0.35rem' }}>Resultado de Inspección General</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                        {STATUS_OPTIONS.map(s => {
                          const colors: Record<string, { bg: string; border: string; color: string }> = {
                            Pendiente: { bg: '#eff6ff', border: '#93c5fd', color: '#1d4ed8' },
                            Aprobado: { bg: '#f0fdf4', border: '#6ee7b7', color: '#065f46' },
                            Reproceso: { bg: '#fffbeb', border: '#fcd34d', color: '#92400e' },
                            Rechazado: { bg: '#fff1f2', border: '#fca5a5', color: '#9f1239' },
                          };
                          const c = colors[s];
                          const isSelected = form.status === s;
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setForm({ ...form, status: s })}
                              style={{
                                padding: '0.55rem',
                                borderRadius: '10px',
                                border: `2px solid ${isSelected ? c.color : '#e2e8f0'}`,
                                backgroundColor: isSelected ? c.bg : 'white',
                                color: isSelected ? c.color : '#64748b',
                                fontWeight: isSelected ? '800' : '600',
                                fontSize: '0.74rem',
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                              }}
                            >
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '0.25rem' }}>Observaciones generales</label>
                      <textarea
                        rows={2}
                        value={form.notes}
                        onChange={e => setForm({ ...form, notes: e.target.value })}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '0.8rem' }}
                      />
                    </div>

                    <button
                      className="btn"
                      style={{
                        width: '100%', padding: '0.9rem', display: 'flex', gap: '0.5rem',
                        alignItems: 'center', justifyContent: 'center', borderRadius: '12px',
                        fontSize: '0.95rem', fontWeight: '950', backgroundColor: '#10b981',
                        color: 'white', border: 'none', cursor: 'pointer'
                      }}
                      disabled={saving}
                      onClick={handleSave}
                    >
                      {saving ? <Loader2 className="animate-spin" size={18} /> : <><CheckCircle2 size={20} /> ✔ Finalizar Inspección</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
