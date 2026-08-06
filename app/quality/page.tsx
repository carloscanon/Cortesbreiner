'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { syncQualityApprovalToInventory, revertQualityApprovalFromInventory } from '@/lib/finished-goods-sync';
import {
  CheckCircle2, XCircle, AlertCircle, Search, ClipboardCheck,
  Plus, X, Loader2, ClipboardList, Package, Bell, QrCode, Award, Star, Activity
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
  has_lavanderia: false,
  has_saldos: false,
  costuras: '0',
  incompleto: '0',
  has_incompleto: false,
  danadas_facturar: '0',
  has_danadas_facturar: false,
  valor_prenda: '3500',
  descuento_defectos: '0',
  valor_pagar: '0',
  pago_status: 'Pendiente de aprobación financiera',
  received_at: null as string | null,
  inspected_at: null as string | null,
  packaged_at: null as string | null,
  closed_at: null as string | null,
  operator_name: ''
};

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
// Componente de código de barras usando bwip-js (estándar industrial ISO/IEC)
// Renderiza en canvas oculto y exporta como <img> para impresión confiable
function BarcodeCanvas({ text, type, height, garmentId }: { text: string; type: string; height: number; garmentId?: string }) {
  const [imgSrc, setImgSrc] = useState<string>('');

  useEffect(() => {
    if (!text) return;

    if (type === 'qr') return;

    const canvas = document.createElement('canvas');
    const bcid = type === 'code39' ? 'code39' : 'code128';
    const encodetext = type === 'code39'
      ? text.toUpperCase().replace(/[^0-9A-Z\-\. ]/g, '')
      : text;

    import('bwip-js').then((bwipjs) => {
      try {
        bwipjs.toCanvas(canvas, {
          bcid,
          text: encodetext,
          scale: 4,
          height: 14,
          includetext: false,
          paddingleft: 8,
          paddingright: 8,
          paddingtop: 2,
          paddingbottom: 2,
          backgroundcolor: 'ffffff',
          barcolor: '000000',
        });
        setImgSrc(canvas.toDataURL('image/png'));
      } catch (e) {
        console.error('bwip-js error:', e);
      }
    });
  }, [text, type, height]);

  if (type === 'qr') {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}&margin=6&ecc=M`;
    return (
      <img
        src={qrUrl}
        alt={text}
        data-barcode-garment-id={garmentId}
        style={{
          width: `${height * 1.6}px`,
          height: `${height * 1.6}px`,
          display: 'block',
          margin: '0 auto',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact'
        }}
      />
    );
  }

  if (!imgSrc) {
    return <div style={{ height: `${height}px`, width: '100%' }} />;
  }

  return (
    <img
      src={imgSrc}
      alt={text}
      data-barcode-garment-id={garmentId}
      style={{
        display: 'block',
        margin: '0 auto',
        maxWidth: '100%',
        height: `${height}px`,
        objectFit: 'contain',
        imageRendering: 'crisp-edges',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact'
      }}
    />
  );
}

export default function QualityPage() {
  const [inspections, setInspections] = useState<any[]>([]);
  const [sewingOrders, setSewingOrders] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [fabrics, setFabrics] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [workshopSpecialCosts, setWorkshopSpecialCosts] = useState<any[]>([]);
  const [workshopRates, setWorkshopRates] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('Pendiente');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [dbNotifications, setDbNotifications] = useState<any[]>([]);
  const [activeStage, setActiveStage] = useState<number>(1);
  const [individualGarments, setIndividualGarments] = useState<any[]>([]);
  const [loadingGarments, setLoadingGarments] = useState(false);
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [selectedGarment, setSelectedGarment] = useState<any>(null);
  const [defectChecklist, setDefectChecklist] = useState<Record<string, boolean>>({});
  const [garmentNotes, setGarmentNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [showLabelsModal, setShowLabelsModal] = useState(false);
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [rollbackItem, setRollbackItem] = useState<any>(null);
  const [selectedRollbackOption, setSelectedRollbackOption] = useState<string>('stage_1');
  const [executingRollback, setExecutingRollback] = useState(false);
  const [rowApproved, setRowApproved] = useState<Record<string, number>>({});
  const [rowRejected, setRowRejected] = useState<Record<string, number>>({});
  const [receivingCheckId, setReceivingCheckId] = useState<string | null>(null);

  // Dynamic Sticker Config State
  const [stickerConfig, setStickerConfig] = useState<{
    headerText: string;
    headerFontSize: number;
    refFontSize: number;
    refFontWeight: string;
    barcodeHeight: number;
    barcodeLineWidth: number;
    barcodeFontSize: number;
    barcodeType?: string;
    alignment?: string;
    orientation?: string;
    columnsPerRow?: number;
    stickerWidthMm?: number;
    stickerHeightMm?: number;
    gapMm?: number;
    sizeFontSize: number;
    sizeBgColor: string;
  }>({
    headerText: 'CORTES BREINER',
    headerFontSize: 11,
    refFontSize: 14,
    refFontWeight: '900',
    barcodeHeight: 55,
    barcodeLineWidth: 2,
    barcodeFontSize: 13,
    barcodeType: 'code128',
    alignment: 'center',
    orientation: 'portrait',
    columnsPerRow: 3,
    stickerWidthMm: 50,
    stickerHeightMm: 80,
    gapMm: 2,
    sizeFontSize: 18,
    sizeBgColor: '#0f172a'
  });

  useEffect(() => {
    fetchAll(() => supabase.from('products').select('*')).then(setProducts);
    supabase.from('sizes').select('*').order('orden_visual', { ascending: true }).then(({ data }) => setSizes(data || []));
    supabase.from('colors').select('*').then(({ data }) => setColors(data || []));
    supabase.from('fabrics').select('*').then(({ data }) => setFabrics(data || []));
    supabase.from('categories').select('*').then(({ data }) => setCategories(data || []));
    supabase.from('workshop_special_costs').select('*').then(({ data }) => setWorkshopSpecialCosts(data || []));
    supabase.from('workshop_rates').select('*').then(({ data }) => setWorkshopRates(data || []));
    supabase.from('company_params').select('*').eq('name', 'print_sticker_config').maybeSingle().then(({ data }) => {
      if (data && data.value) {
        try { setStickerConfig(prev => ({ ...prev, ...JSON.parse(data.value) })); } catch (e) {}
      }
    });
    fetchInspections();
    fetchSewingOrders();
    fetchNotifications();
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*, roles(id, name)')
          .eq('id', user.id)
          .single();
        if (profile) {
          setCurrentUser(profile);
          setUserRole(profile.roles?.name || null);
          setForm((f: any) => ({ ...f, operator_name: profile.full_name || '' }));
        }
      }
    } catch (err: any) {
      console.error('Error loading user:', err.message);
    }
  };

  const fetchInspections = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('quality_inspections')
      .select(`*, orders(id,consecutive,internal_code,client_name,brand), sewing_orders(id,confeccion_code,status,workshops(nombre_taller))`)
      .order('created_at', { ascending: false });
    setInspections(data || []);
    setLoading(false);
  };

  const fetchSewingOrders = async () => {
    const { data } = await supabase
      .from('sewing_orders')
      .select(`id,confeccion_code,parent_order_id,orders(id,consecutive,internal_code,client_name,brand),workshops(id,nombre_taller)`)
      .order('created_at', { ascending: false });
    setSewingOrders(data || []);
  };

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*, workshops(nombre_taller)')
      .order('created_at', { ascending: false })
      .limit(8);
    setDbNotifications(data || []);
  };

  const handleConfirmReceivedCheck = async (inspection: any) => {
    const novedades = prompt(
      `¿Confirmar recepción de prendas de la orden ${inspection.sewing_orders?.confeccion_code}?\n\nNovedades de recepción (déjalo vacío si todo llegó conforme):`,
      ""
    );
    if (novedades === null) return;
    setReceivingCheckId(inspection.id);
    try {
      await supabase.from('sewing_orders').update({ status: 'Terminada' }).eq('id', inspection.sewing_order_id);
      const formattedNotes = (inspection.notes || '') + `\n[Recibido en Calidad] ${novedades || 'Sin novedades'}`;
      await supabase.from('quality_inspections').update({
        status: 'Pendiente',
        notes: formattedNotes,
        received_at: new Date().toISOString()
      }).eq('id', inspection.id);
      await supabase.from('notifications').insert({
        title: `Lote Recepcionado: ${inspection.sewing_orders?.confeccion_code || 'OC'}`,
        message: `Ingresado al módulo de calidad. Novedades: ${novedades || 'Ninguna'}.`,
        type: 'recepcion', severity: novedades ? 'medium' : 'low',
        inspection_id: inspection.id
      });
      fetchInspections();
      fetchNotifications();
    } catch (err: any) {
      alert('Error al confirmar recibido: ' + err.message);
    } finally {
      setReceivingCheckId(null);
    }
  };

  const fetchIndividualGarments = async (id: string, isSewingOrder: boolean = true, detailRowsInput?: any[]) => {
    setLoadingGarments(true);
    const query = supabase.from('individual_garments').select('*');
    if (isSewingOrder) query.eq('sewing_order_id', id);
    else query.eq('order_id', id);
    const { data } = await query.order('barcode', { ascending: true });
    const garments = data || [];
    setIndividualGarments(garments);

    const rows = detailRowsInput || (orderDetail ? getDetailRows(orderDetail) : []);
    if (rows.length > 0) {
      const newApproved: Record<string, number> = {};
      const newRejected: Record<string, number> = {};
      rows.forEach((row: any) => {
        if (garments.length > 0) {
          const matchingGarments = garments.filter(g =>
            (g.reference_name || '').toUpperCase().trim() === (row.productName || '').toUpperCase().trim() &&
            (g.color_name || '').toUpperCase().trim() === (row.colorName || '').toUpperCase().trim() &&
            (g.size_code || '').toUpperCase().trim() === (row.size || '').toUpperCase().trim()
          );
          newApproved[row.key] = matchingGarments.filter(g => g.status === 'Aprobada').length;
          newRejected[row.key] = matchingGarments.filter(g => g.status !== 'Aprobada').length;
        } else {
          // Pre-populate with planned quantities if no barcodes generated yet
          newApproved[row.key] = Number(row.quantity) || 0;
          newRejected[row.key] = 0;
        }
      });
      setRowApproved(newApproved);
      setRowRejected(newRejected);
    }
    setLoadingGarments(false);
  };

  const generateIndividualGarments = async () => {
    if (!orderDetail) return;
    setLoadingGarments(true);
    const isSewingOrder = !!orderDetail.sewing_order_sizes;
    const detailRows = getDetailRows(orderDetail);

    const inserts: any[] = [];
    const updates: any[] = [];
    const deletes: string[] = [];

    detailRows.forEach((row: any) => {
      const approvedQty = Number(rowApproved[row.key]) || 0;
      const rejectedQty = Number(rowRejected[row.key]) || 0;

      const existing = individualGarments.filter(g =>
        (g.reference_name || '').toUpperCase().trim() === (row.productName || '').toUpperCase().trim() &&
        (g.color_name || '').toUpperCase().trim() === (row.colorName || '').toUpperCase().trim() &&
        (g.size_code || '').toUpperCase().trim() === (row.size || '').toUpperCase().trim()
      );

      const targets: string[] = [];
      for (let i = 0; i < approvedQty; i++) targets.push('Aprobada');
      for (let i = 0; i < rejectedQty; i++) targets.push('Rechazada');

      const maxLen = Math.max(existing.length, targets.length);
      for (let i = 0; i < maxLen; i++) {
        const g = existing[i];
        const targetStatus = targets[i];

        if (g && targetStatus) {
          if (g.status !== targetStatus) {
            updates.push({ id: g.id, status: targetStatus });
          }
        } else if (targetStatus) {
          inserts.push({
            sewing_order_id: isSewingOrder ? orderDetail.id : null,
            order_id: isSewingOrder ? (orderDetail.parent_order_id || orderDetail.parent_order?.id || null) : orderDetail.id,
            quality_inspection_id: editingId || null,
            barcode: '', 
            reference_name: row.productName,
            color_name: row.colorName,
            size_code: row.size || 'ST',
            status: targetStatus,
            defect_checklist: {}
          });
        } else if (g) {
          deletes.push(g.id);
        }
      }
    });

    if (inserts.length > 0) {
      const { data: maxGarment } = await supabase
        .from('individual_garments')
        .select('barcode')
        .gte('barcode', '00000000')
        .lte('barcode', '9999999999')
        .order('barcode', { ascending: false })
        .limit(1)
        .maybeSingle();

      let maxGlobalSeq = 0;
      if (maxGarment?.barcode) {
        const num = parseInt(maxGarment.barcode, 10);
        if (!isNaN(num)) {
          maxGlobalSeq = num;
        }
      }

      inserts.forEach(ins => {
        maxGlobalSeq++;
        ins.barcode = maxGlobalSeq.toString().padStart(10, '0');
      });
    }

    try {
      if (deletes.length > 0) {
        const { error: delErr } = await supabase.from('individual_garments').delete().in('id', deletes);
        if (delErr) throw delErr;
      }

      if (updates.length > 0) {
        await Promise.all(updates.map(upd =>
          supabase.from('individual_garments').update({ status: upd.status }).eq('id', upd.id)
        ));
      }

      if (inserts.length > 0) {
        const { error: insErr } = await supabase.from('individual_garments').insert(inserts);
        if (insErr) throw insErr;
      }

      alert('✅ Prendas individuales actualizadas exitosamente.');
      await fetchIndividualGarments(orderDetail.id, isSewingOrder, detailRows);
    } catch (err: any) {
      alert('Error al generar/actualizar prendas: ' + err.message);
    } finally {
      setLoadingGarments(false);
    }
  };

  const handleUpdateGarment = async (garmentId: string, updates: any) => {
    const { error } = await supabase.from('individual_garments').update(updates).eq('id', garmentId);
    if (error) { alert('Error al actualizar prenda: ' + error.message); return; }
    if (orderDetail) await fetchIndividualGarments(orderDetail.id);
    setSelectedGarment((prev: any) => prev && prev.id === garmentId ? { ...prev, ...updates } : prev);
    if (!form.inspected_at) setForm((prev: any) => ({ ...prev, inspected_at: new Date().toISOString() }));
  };

  const handleReworkNotification = async (garment: any, defectType: string) => {
    await supabase.from('garment_rework_history').insert({
      garment_id: garment.id, defect_type: defectType, status: 'Enviado',
      notes: `Enviado a corrección: ${defectType}`, operator: form.operator_name || 'Inspector'
    });
    await supabase.from('notifications').insert({
      title: `Prenda a Reproceso: ${garment.barcode}`,
      message: `Defecto: ${defectType}. Taller: ${orderDetail?.workshops?.nombre_taller || '—'}.`,
      type: 'reproceso', severity: 'medium', inspection_id: editingId || null
    });
    fetchNotifications();
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
    } else alert(`No se encontró la prenda con código: ${cleanCode}`);
  };

  // Resolves garment rate with cascade: special_cost → workshop_rates → category.base_rate → 3500
  const resolveGarmentRate = (workshopId: string, productId: string, categoryId: string): number => {
    // 1. Tarifa especial por taller+producto (Costos Especiales por Producto)
    if (workshopId && productId) {
      const special = workshopSpecialCosts.find(
        (sc: any) => String(sc.workshop_id).toLowerCase() === String(workshopId).toLowerCase() &&
                     String(sc.product_id).toLowerCase() === String(productId).toLowerCase()
      );
      if (special && Number(special.special_rate) > 0) return Number(special.special_rate);
    }
    // 2. Tarifa por taller+categoría (Tarifas por Categoría)
    if (workshopId && categoryId) {
      const catRate = workshopRates.find(
        (wr: any) => String(wr.workshop_id).toLowerCase() === String(workshopId).toLowerCase() &&
                     String(wr.category_id).toLowerCase() === String(categoryId).toLowerCase()
      );
      if (catRate && Number(catRate.rate) > 0) return Number(catRate.rate);
    }
    // 3. Tarifa base de la categoría
    if (categoryId) {
      const cat = categories.find((c: any) => String(c.id) === String(categoryId));
      if (cat && Number(cat.base_rate) > 0) return Number(cat.base_rate);
    }
    // 4. Fallback
    return 3500;
  };

  /** Detecta la fuente de la tarifa de una orden de confección para mostrarla en UI */
  const getRateSource = (sewingOrderData: any, prodObj: any): { rate: number; source: string; isSpecialProduct: boolean } => {
    const workshopId = sewingOrderData?.workshop_id || '';
    const productId = String(prodObj?.id || '');
    const categoryId = String(prodObj?.category_id || '');
    
    // 1. Tarifa manual en OC (si es un número real > 1, no el flag de activación = 1)
    const soTarifa = Number(sewingOrderData?.tarifa_especial);
    if (soTarifa > 1) return { rate: soTarifa, source: 'Tarifa manual en OC', isSpecialProduct: false };
    
    // 2. Tarifa especial (si está activo el flag)
    const isSpecialEnabled = sewingOrderData?.tarifa_especial !== null && 
                             sewingOrderData?.tarifa_especial !== undefined && 
                             (sewingOrderData.tarifa_especial === true || Number(sewingOrderData.tarifa_especial) > 0);
    
    if (isSpecialEnabled) {
      // Costo especial por taller+producto
      const special = workshopSpecialCosts.find(
        (sc: any) => String(sc.workshop_id).toLowerCase() === String(workshopId).toLowerCase() &&
                     String(sc.product_id).toLowerCase() === String(productId).toLowerCase()
      );
      if (special && Number(special.special_rate) > 0)
        return { rate: Number(special.special_rate), source: `Costo especial: ${prodObj?.nombre_producto || 'Producto'}`, isSpecialProduct: true };
      
      // Fallback por cualquier producto de la misma categoría (para costo especial)
      if (categoryId) {
        const categoryProducts = products.filter((p: any) => String(p.category_id) === String(categoryId));
        const catSpecial = workshopSpecialCosts.find(
          (sc: any) => String(sc.workshop_id).toLowerCase() === String(workshopId).toLowerCase() &&
                       categoryProducts.some((p: any) => String(p.id).toLowerCase() === String(sc.product_id).toLowerCase())
        );
        if (catSpecial && Number(catSpecial.special_rate) > 0) {
          return { rate: Number(catSpecial.special_rate), source: `Costo especial categoría: ${prodObj?.nombre_producto || 'Producto'}`, isSpecialProduct: true };
        }
      }
    }
    
    // 3. Tarifa por categoría del taller
    const catRate = workshopRates.find(
      (wr: any) => String(wr.workshop_id).toLowerCase() === String(workshopId).toLowerCase() &&
                   String(wr.category_id).toLowerCase() === String(categoryId).toLowerCase()
    );
    if (catRate && Number(catRate.rate) > 0)
      return { rate: Number(catRate.rate), source: 'Tarifa por categoría del taller', isSpecialProduct: false };
    
    // 4. Tarifa base de la categoría
    const cat = categories.find((c: any) => String(c.id) === String(categoryId));
    if (cat && Number(cat.base_rate) > 0)
      return { rate: Number(cat.base_rate), source: 'Tarifa base de la categoría', isSpecialProduct: false };
    
    return { rate: 3500, source: 'Fallback ($3.500)', isSpecialProduct: false };
  };

  const fetchOrderDetail = async (id: string, isSewingOrder: boolean = true) => {
    setLoadingDetail(true);
    setOrderDetail(null);
    setSelectedGarment(null);
    if (isSewingOrder) {
      const { data } = await supabase
        .from('sewing_orders')
        .select(`*, parent_order:orders(*, fabrics(nombre_tela), workshops(nombre_taller,responsable,desc_costuras,desc_lavanderia,desc_empaque), cuts(id,color_id,fabric_id,product_id,layers,layers_produced,cut_sizes(*), fabrics(nombre_tela), colors(id,nombre_color,codigo_color,hex_color), products(*, categories(categoria)))), sewing_order_sizes(*, sizes(*)), workshops(nombre_taller,responsable,desc_costuras,desc_lavanderia,desc_empaque)`)
        .eq('id', id).single();
      setOrderDetail(data);
      const detailRows = getDetailRows(data);
      await fetchIndividualGarments(id, true, detailRows);
      if (data) {
        const prod = products.find((p: any) => String(p.id) === String(data.product_id));
        const { rate: garmentRate } = getRateSource(data, prod);
        const plannedSum = detailRows.reduce((s: number, r: any) => s + (Number(r.quantity) || 0), 0);
        setForm((f: any) => ({
          ...f,
          valor_prenda: garmentRate.toString(),
          items_inspected: (!f.items_inspected || f.items_inspected === '0') ? plannedSum.toString() : f.items_inspected
        }));
      }
    } else {
      const { data } = await supabase.from('orders').select('*, fabrics(nombre_tela), workshops(nombre_taller,responsable,desc_costuras,desc_lavanderia,desc_empaque), cuts(id,color_id,fabric_id,product_id,layers,layers_produced, cut_sizes(*), fabrics(nombre_tela), colors(id,nombre_color,codigo_color,hex_color), products(*, categories(categoria)))').eq('id', id).single();
      setOrderDetail(data);
      const detailRows = getDetailRows(data);
      await fetchIndividualGarments(id, false, detailRows);
      const plannedSum = detailRows.reduce((s: number, r: any) => s + (Number(r.quantity) || 0), 0);
      setForm((f: any) => ({
        ...f,
        items_inspected: (!f.items_inspected || f.items_inspected === '0') ? plannedSum.toString() : f.items_inspected
      }));
    }
    // Consultar si ya existe un borrador / inspección previa para esta orden
    const { data: existingInsps } = await supabase
      .from('quality_inspections')
      .select('*')
      .eq(isSewingOrder ? 'sewing_order_id' : 'order_id', id)
      .order('created_at', { ascending: false });

    if (existingInsps && existingInsps.length > 0) {
      const existing = existingInsps[0];
      setEditingId(existing.id);
      const danadasMatch = (existing.notes || '').match(/\[DAÑADAS FACTURAR:\s*(\d+)\]/i);
      const loadedDanadas = existing.danadas_facturar !== undefined && existing.danadas_facturar !== null ? Number(existing.danadas_facturar) : (danadasMatch ? Number(danadasMatch[1]) : 0);
      const lav = Number(existing.lavanderia) || 0;
      const sal = Number(existing.saldos) || 0;
      const inc = Number(existing.incompleto) || 0;
      setForm((f: any) => ({
        ...f,
        id: existing.id,
        items_inspected: (existing.items_inspected || f.items_inspected || 0).toString(),
        items_approved: (existing.items_approved || 0).toString(),
        items_rejected: (existing.items_rejected || 0).toString(),
        lavanderia: lav.toString(),
        has_lavanderia: lav > 0,
        saldos: sal.toString(),
        has_saldos: sal > 0,
        incompleto: inc.toString(),
        has_incompleto: inc > 0,
        costuras: (existing.costuras || 0).toString(),
        danadas_facturar: loadedDanadas.toString(),
        has_danadas_facturar: loadedDanadas > 0,
        notes: existing.notes || f.notes || '',
        status: existing.status || f.status || 'Pendiente',
        current_stage: existing.current_stage || f.current_stage || 1
      }));
    }

    setLoadingDetail(false);
  };

  const getFabricName = () => {
    if (!orderDetail) return '—';
    const fabricId = orderDetail.parent_order?.fabric_id || orderDetail.fabric_id;
    if (!fabricId) {
      const cutsList = orderDetail.parent_order?.cuts || orderDetail.cuts || [];
      const firstCut = cutsList[0];
      if (firstCut?.fabrics?.nombre_tela) return firstCut.fabrics.nombre_tela;
      if (firstCut?.fabric_id) {
        const fab = fabrics.find(f => String(f.id) === String(firstCut.fabric_id));
        if (fab) return fab.nombre_tela;
      }
      return '—';
    }
    const fab = fabrics.find(f => String(f.id) === String(fabricId));
    return fab ? fab.nombre_tela : '—';
  };

  const getDetailRows = (order: any) => {
    if (!order) return [];
    if (order.sewing_order_sizes) {
      const sewingOrder = order;
      const parent = sewingOrder.parent_order;
      if (!parent?.cuts) return [];
      const rows: any[] = [];
      parent.cuts.forEach((cut: any) => {
        if (String(cut.product_id) !== String(sewingOrder.product_id)) return;
        const prod = products.find((p: any) => String(p.id) === String(cut.product_id)) || cut.products;
        
        // Resolución de Tela y Color desde el objeto de Tela o Corte
        const fabricObj = fabrics.find((f: any) => String(f.id) === String(cut.fabric_id)) || cut.fabrics;
        let rawFabricName = fabricObj?.nombre_tela || fabricObj?.nombre || fabricObj?.codigo_tela || cut.tela || cut.fabric_name || '';

        // 1. Intentar obtener el color desde la relación/ID directa con el maestro
        const joinedColor = cut.colors;
        const localColor = cut.color_id ? colors.find((c: any) => String(c.id) === String(cut.color_id)) : null;
        let colorObj = joinedColor || localColor;

        let rawColorString = cut.color || cut.color_name || cut.nombre_color || '';
        let fabricName = rawFabricName || '—';

        // Si la cadena de tela contiene una coma (ej: "JABON/, NEGRO 10" o "JABON, NEGRO 10")
        if (rawFabricName.includes(',')) {
          const parts = rawFabricName.split(',').map((p: string) => p.trim());
          fabricName = parts[0].replace(/\/$/, '').trim() || '—'; // "JABON"
          if (!rawColorString && parts[1]) {
            rawColorString = parts[1]; // "NEGRO 10"
          }
        }

        // Si tenemos un string de color pero no objeto del maestro, buscar en el maestro de colores
        if (!colorObj && rawColorString) {
          // Extraer prefijo o nombre (ej: "NEGRO 10" -> "NEGRO")
          const cleanPrefix = rawColorString.split('/')[0].split('-')[0].trim().toUpperCase();
          const firstWord = cleanPrefix.split(' ')[0];
          
          if (cleanPrefix) {
            colorObj = colors.find((c: any) => {
              const cName = (c.nombre_color || '').trim().toUpperCase();
              const cCode = (c.codigo_color || '').trim().toUpperCase();
              return cName === cleanPrefix || cCode === cleanPrefix || cName === firstWord || cCode === firstWord;
            });
          }
        }

        // Determinar nombre y hex final del color
        let colorName = colorObj?.nombre_color || colorObj?.codigo_color || '';
        if (!colorName && rawColorString) {
          colorName = rawColorString.trim();
        }
        const colorHex = colorObj?.hex_color || localColor?.hex_color || '';

        const categoryObj = categories.find((cat: any) => String(cat.id) === String(prod?.category_id)) || prod?.categories;
        const categoryName = categoryObj ? (categoryObj.categoria || categoryObj.nombre_categoria) : '';
        const productName = prod ? (prod.nombre_producto || prod.name || prod.codigo_referencia || 'Sin Referencia') : 'Sin Referencia';
        const layersProyec = cut.layers || 1;
        const layersProduced = cut.layers_produced || 0;

        (cut.cut_sizes || []).forEach((cs: any) => {
          const sizeObj = sizes.find((s: any) => String(s.id) === String(cs.size_id));
          const sz = sizeObj ? sizeObj.codigo_talla : 'S/T';
          const sosMatch = sewingOrder.sewing_order_sizes.find((sos: any) => String(sos.size_id) === String(cs.size_id));
          if (!sosMatch || (Number(sosMatch.cantidad_planeada) || 0) <= 0) return;

          let realQty = cs.quantity_produced !== undefined && cs.quantity_produced !== null
            ? Number(cs.quantity_produced)
            : Math.round((Number(cs.quantity) || 0) / layersProyec * layersProduced);
          if (realQty <= 0) realQty = Number(cs.quantity) || 0;

          if (realQty > 0) {
            rows.push({ key: `${cut.id}_${cs.id}`, productName, colorName, colorHex, fabricName, categoryName, size: sz, quantity: realQty });
          }
        });
      });
      return rows;
    }
    if (!order.cuts) return [];
    const rows: any[] = [];
    order.cuts.forEach((cut: any) => {
      const prod = products.find((p: any) => String(p.id) === String(cut.product_id)) || cut.products;
      
      // Resolución de Tela y Color desde el objeto de Tela o Corte
      const fabricObj = fabrics.find((f: any) => String(f.id) === String(cut.fabric_id)) || cut.fabrics;
      let rawFabricName = fabricObj?.nombre_tela || fabricObj?.nombre || fabricObj?.codigo_tela || cut.tela || cut.fabric_name || '';

      // 1. Intentar obtener el color desde la relación/ID directa con el maestro
      const joinedColor = cut.colors;
      const localColor = cut.color_id ? colors.find((c: any) => String(c.id) === String(cut.color_id)) : null;
      let colorObj = joinedColor || localColor;

      let rawColorString = cut.color || cut.color_name || cut.nombre_color || '';
      let fabricName = rawFabricName || '—';

      // Si la cadena de tela contiene una coma (ej: "JABON/, NEGRO 10")
      if (rawFabricName.includes(',')) {
        const parts = rawFabricName.split(',').map((p: string) => p.trim());
        fabricName = parts[0].replace(/\/$/, '').trim() || '—'; // "JABON"
        if (!rawColorString && parts[1]) {
          rawColorString = parts[1]; // "NEGRO 10"
        }
      }

      // Si tenemos un string de color pero no objeto del maestro, buscar en el maestro de colores
      if (!colorObj && rawColorString) {
        const cleanPrefix = rawColorString.split('/')[0].split('-')[0].trim().toUpperCase();
        const firstWord = cleanPrefix.split(' ')[0];
        
        if (cleanPrefix) {
          colorObj = colors.find((c: any) => {
            const cName = (c.nombre_color || '').trim().toUpperCase();
            const cCode = (c.codigo_color || '').trim().toUpperCase();
            return cName === cleanPrefix || cCode === cleanPrefix || cName === firstWord || cCode === firstWord;
          });
        }
      }

      // Determinar nombre y hex final del color
      let colorName = colorObj?.nombre_color || colorObj?.codigo_color || '';
      if (!colorName && rawColorString) {
        colorName = rawColorString.trim();
      }
      const colorHex = colorObj?.hex_color || localColor?.hex_color || '';

      const categoryObj = categories.find((cat: any) => String(cat.id) === String(prod?.category_id)) || prod?.categories;
      const categoryName = categoryObj ? (categoryObj.categoria || categoryObj.nombre_categoria) : '';
      const productName = prod ? (prod.nombre_producto || prod.name || prod.codigo_referencia || 'Sin Referencia') : 'Sin Referencia';
      const layersProyec = cut.layers || 1;
      const layersProduced = cut.layers_produced || 0;
      (cut.cut_sizes || []).forEach((cs: any) => {
        const sizeObj = sizes.find((s: any) => String(s.id) === String(cs.size_id));
        const sz = sizeObj ? sizeObj.codigo_talla : 'S/T';
        let qty = cs.quantity_produced !== undefined && cs.quantity_produced !== null ? Number(cs.quantity_produced) : Math.round((Number(cs.quantity) || 0) / layersProyec * layersProduced);
        if (qty <= 0) qty = Number(cs.quantity) || 0;
        if (qty > 0) rows.push({ key: `${cut.id}_${cs.id}`, productName, colorName, colorHex, fabricName, categoryName, size: sz, quantity: qty });
      });
    });
    return rows;
  };

  const computeTotalsFromRows = (rows: any[]) => {
    let totalApproved = 0, totalRejected = 0;
    rows.forEach(row => { totalApproved += rowApproved[row.key] || 0; totalRejected += rowRejected[row.key] || 0; });
    return { totalApproved, totalRejected };
  };

  const handleSave = async (nextStageToSave?: number, isFinalizingBatch: boolean = false) => {
    if (!form.sewing_order_id && !form.order_id) return alert('Selecciona una orden.');
    setSaving(true);
    const selectedSewingOrder = sewingOrders.find((so: any) => so.id === form.sewing_order_id);
    const parentOrderId = selectedSewingOrder ? selectedSewingOrder.parent_order_id : form.order_id;
    const selectedOrder = orders.find((o: any) => o.id === parentOrderId);
    const isSewingOrder = orderDetail ? !!orderDetail.sewing_order_sizes : !!selectedSewingOrder;
    const rows = getDetailRows(orderDetail);
    const totalRecFromRows = rows.reduce((s: number, r: any) => s + (Number(r.quantity) || 0), 0);
    let lavVal = Number(form.lavanderia) || 0, salVal = Number(form.saldos) || 0, cosVal = Number(form.costuras) || 0, incVal = Number(form.incompleto) || 0;
    let finalApproved = 0;
    let finalRejected = 0;

    if (activeStage !== 1 && individualGarments.length > 0) {
      finalApproved = individualGarments.filter(g => g.status === 'Aprobada').length;
      const gRej = individualGarments.filter(g => g.status === 'Rechazada').length;
      finalRejected = gRej > 0 ? gRej : (Number(form.items_rejected) || 0);
      cosVal = finalRejected;
      incVal = 0;
    } else {
      const { totalApproved, totalRejected } = computeTotalsFromRows(rows);
      finalApproved = Object.keys(rowApproved).length > 0 ? totalApproved : (Number(form.items_approved) || 0);
      finalRejected = Object.keys(rowRejected).length > 0 ? totalRejected : (Number(form.items_rejected) || 0);
      cosVal = finalRejected;
    }

    const totalInspected = Number(form.items_inspected) || totalRecFromRows || (finalApproved + finalRejected);
    
    // Sincronizar todas las variables del formulario antes de construir el payload final
    form.items_approved = finalApproved.toString();
    form.items_rejected = finalRejected.toString();
    form.items_inspected = totalInspected.toString();
    form.costuras = cosVal.toString();
    form.lavanderia = lavVal.toString();
    form.saldos = salVal.toString();
    form.incompleto = incVal.toString();

    if (finalRejected > totalInspected) { setSaving(false); return alert(`❌ Rechazadas (${finalRejected}) no puede superar el total inspeccionadas (${totalInspected}).`); }
    if (finalApproved + finalRejected > totalInspected) { setSaving(false); return alert(`❌ Aprobadas + rechazadas supera total inspeccionado.`); }

    const valPrenda = Number(form.valor_prenda) || 3500;
    const workshopObj = selectedSewingOrder?.workshops || selectedOrder?.workshops || orderDetail?.workshops || orderDetail?.parent_order?.workshops;
    const rateCosturas = workshopObj ? Number(workshopObj.desc_costuras ?? 0) : 0;
    const rateLavanderia = workshopObj ? Number(workshopObj.desc_lavanderia ?? 0) : 0;
    const rateEmpaque = workshopObj ? Number(workshopObj.desc_empaque ?? 0) : 0;
    const descDefectos = (cosVal * rateCosturas) + (lavVal * rateLavanderia);
    const isEmpaqueEnabled = selectedSewingOrder?.empaque ?? orderDetail?.empaque ?? false;
    const pagoEmpaque = isEmpaqueEnabled ? (finalApproved * rateEmpaque) : 0;
    const valPagar = (finalApproved * valPrenda) + pagoEmpaque - descDefectos;

    // Calcular el stage a persistir
    const resolvedStage = nextStageToSave !== undefined ? nextStageToSave : activeStage;
    const isClosing = isFinalizingBatch || form.status === 'Aprobado';

    const danadasVal = Number(form.danadas_facturar) || 0;
    let formattedNotes = form.notes || '';
    formattedNotes = formattedNotes.replace(/\[DAÑADAS FACTURAR:\s*\d+\]/gi, '').trim();
    if (danadasVal > 0) {
      formattedNotes = (formattedNotes ? `${formattedNotes}\n` : '') + `[DAÑADAS FACTURAR: ${danadasVal}]`;
    }

    const payload: any = {
      order_id: parentOrderId || null,
      sewing_order_id: form.sewing_order_id || null,
      workshop_name: selectedSewingOrder?.workshops?.nombre_taller || selectedOrder?.workshops?.nombre_taller || form.workshop_name || '',
      items_inspected: totalInspected, items_approved: finalApproved, items_rejected: finalRejected,
      lavanderia: lavVal, saldos: salVal, costuras: cosVal, incompleto: incVal,
      status: isClosing ? (form.status === 'Pendiente' ? 'Aprobado' : form.status) : (form.status || 'En Proceso'),
      notes: formattedNotes,
      valor_prenda: valPrenda,
      descuento_defectos: descDefectos,
      pago_empaque: pagoEmpaque,
      valor_pagar: valPagar,
      pago_status: isClosing ? (form.pago_status || 'Autorizado para Pago') : 'Pendiente de aprobación financiera',
      received_at: form.received_at || (activeStage === 1 ? new Date().toISOString() : null),
      inspected_at: form.inspected_at || (activeStage === 1 ? new Date().toISOString() : null),
      packaged_at: form.packaged_at || (activeStage === 3 ? new Date().toISOString() : null),
      closed_at: isClosing ? (form.closed_at || new Date().toISOString()) : null,
      operator_name: form.operator_name || null,
      current_stage: resolvedStage
    };

    let error = null;
    let savedInspectionId = editingId;
    if (editingId) {
      const res = await supabase.from('quality_inspections').update(payload).eq('id', editingId);
      error = res.error;
    } else {
      const res = await supabase.from('quality_inspections').insert([payload]).select().single();
      error = res.error;
      if (res.data) savedInspectionId = res.data.id;
    }

    if (!error && savedInspectionId) {
      if (activeStage === 1 && rows.length > 0) {
        const inserts: any[] = [];
        const updates: any[] = [];
        const deletes: string[] = [];

        rows.forEach((row: any) => {
          const approvedQty = Number(rowApproved[row.key]) || 0;
          const rejectedQty = Number(rowRejected[row.key]) || 0;
          const sizeCode = row.size || 'ST';

          const existing = individualGarments.filter(g =>
            (g.reference_name || '').toUpperCase().trim() === (row.productName || '').toUpperCase().trim() &&
            (g.color_name || '').toUpperCase().trim() === (row.colorName || '').toUpperCase().trim() &&
            (g.size_code || '').toUpperCase().trim() === (row.size || '').toUpperCase().trim()
          );

          const targets: string[] = [];
          for (let i = 0; i < approvedQty; i++) targets.push('Aprobada');
          for (let i = 0; i < rejectedQty; i++) targets.push('Rechazada');

          const maxLen = Math.max(existing.length, targets.length);
          for (let i = 0; i < maxLen; i++) {
            const g = existing[i];
            const targetStatus = targets[i];

            if (g && targetStatus) {
              if (g.status !== targetStatus) {
                updates.push({ id: g.id, status: targetStatus });
              }
              if (!g.quality_inspection_id) {
                updates.push({ id: g.id, status: targetStatus, updateInspectionId: true });
              }
            } else if (targetStatus) {
              inserts.push({
                sewing_order_id: isSewingOrder ? orderDetail.id : null,
                order_id: isSewingOrder ? (orderDetail.parent_order_id || orderDetail.parent_order?.id || null) : orderDetail.id,
                quality_inspection_id: savedInspectionId,
                barcode: '', 
                reference_name: row.productName,
                color_name: row.colorName,
                size_code: sizeCode,
                status: targetStatus
              });
            } else if (g) {
              deletes.push(g.id);
            }
          }
        });

        if (inserts.length > 0) {
          const { data: maxGarment } = await supabase
            .from('individual_garments')
            .select('barcode')
            .gte('barcode', '00000000')
            .lte('barcode', '9999999999')
            .order('barcode', { ascending: false })
            .limit(1)
            .maybeSingle();

          let maxGlobalSeq = 0;
          if (maxGarment?.barcode) {
            const num = parseInt(maxGarment.barcode, 10);
            if (!isNaN(num)) {
              maxGlobalSeq = num;
            }
          }

          inserts.forEach(ins => {
            maxGlobalSeq++;
            ins.barcode = maxGlobalSeq.toString().padStart(10, '0');
          });
        }

        let garmentErr = null;
        if (deletes.length > 0) {
          const { error: delErr } = await supabase.from('individual_garments').delete().in('id', deletes);
          if (delErr) garmentErr = delErr;
        }

        if (!garmentErr && updates.length > 0) {
          const updateMap = new Map<string, any>();
          updates.forEach(u => {
            const existingU = updateMap.get(u.id) || {};
            updateMap.set(u.id, { ...existingU, status: u.status, quality_inspection_id: savedInspectionId });
          });
          const results = await Promise.all(Array.from(updateMap.entries()).map(([id, payload]) =>
            supabase.from('individual_garments').update(payload).eq('id', id)
          ));
          const failed = results.find(r => r.error);
          if (failed) garmentErr = failed.error;
        }

        if (!garmentErr && inserts.length > 0) {
          const { error: insErr } = await supabase.from('individual_garments').insert(inserts);
          if (insErr) garmentErr = insErr;
        }

        if (garmentErr) {
          alert('❌ Error al reconciliar/guardar prendas individuales: ' + garmentErr.message);
          setSaving(false);
          return;
        }
      } else {
        if (form.sewing_order_id) {
          await supabase.from('individual_garments').update({ quality_inspection_id: savedInspectionId }).eq('sewing_order_id', form.sewing_order_id).is('quality_inspection_id', null);
        } else if (parentOrderId) {
          await supabase.from('individual_garments').update({ quality_inspection_id: savedInspectionId }).eq('order_id', parentOrderId).is('quality_inspection_id', null);
        }
      }
      const rejectPct = totalInspected > 0 ? (finalRejected / totalInspected) * 100 : 0;
      if (rejectPct > 8) {
        await supabase.from('notifications').insert({
          title: `⚠️ Alerta Rechazo Elevado`,
          message: `Taller "${payload.workshop_name}" presenta ${rejectPct.toFixed(1)}% de rechazos en el lote.`,
          type: 'rechazo', severity: 'high', inspection_id: savedInspectionId
        });
      }
    }

    if (error) {
      alert('Error al guardar: ' + error.message);
    } else {
      if (isClosing && savedInspectionId) {
        await syncQualityApprovalToInventory(savedInspectionId);
      }
      if (nextStageToSave !== undefined && !isFinalizingBatch) {
        if (savedInspectionId) {
          setEditingId(savedInspectionId);
          setForm((prev: any) => ({ ...prev, id: savedInspectionId }));
        }
        setActiveStage(nextStageToSave);
        if (orderDetail) {
          await fetchIndividualGarments(orderDetail.id, isSewingOrder, rows);
        }
        if (nextStageToSave === 1) {
          alert('💾 Avance guardado temporalmente en la Etapa 1. Puedes continuar la inspección cuando desees.');
        }
      } else {
        closeModal();
      }
      fetchInspections();
      fetchNotifications();
    }
    setSaving(false);
  };

  const handleSuperAdminRollbackOrder = (item: any) => {
    setRollbackItem(item);
    setSelectedRollbackOption('stage_1');
    setShowRollbackModal(true);
  };

  const handleExecuteRollbackOption = async (targetOption: string) => {
    if (!rollbackItem) return;
    const item = rollbackItem;
    const orderCode = item.sewing_orders?.confeccion_code || (item.orders?.consecutive ? `OC-${item.orders.consecutive.toString().padStart(4, '0')}` : 'Seleccionada');
    
    setExecutingRollback(true);
    try {
      const inspectionId = item.id;
      const orderId = item.order_id || item.sewing_orders?.parent_order_id;
      const sewingOrderId = item.sewing_order_id;

      if (targetOption === 'stage_1') {
        // Devolver a Etapa 1: Recepción e Inspección
        if (inspectionId) {
          await revertQualityApprovalFromInventory(inspectionId);
          await supabase.from('quality_inspections').update({
            current_stage: 1,
            status: 'En Proceso',
            closed_at: null,
            pago_status: 'Pendiente de aprobación financiera'
          }).eq('id', inspectionId);
        }
        alert(`✅ La inspección del lote ${orderCode} ha sido devuelta a la Etapa 1 (Recepción e Inspección).`);

      } else if (targetOption === 'stage_2') {
        // Devolver a Etapa 2: Reproceso y Arreglos
        if (inspectionId) {
          await revertQualityApprovalFromInventory(inspectionId);
          await supabase.from('quality_inspections').update({
            current_stage: 2,
            status: 'Reproceso',
            closed_at: null,
            pago_status: 'Pendiente de aprobación financiera'
          }).eq('id', inspectionId);
        }
        alert(`✅ La inspección del lote ${orderCode} ha sido devuelta a la Etapa 2 (Reproceso y Arreglos).`);

      } else if (targetOption === 'stage_3') {
        // Devolver a Etapa 3: Doblado y Empaque
        if (inspectionId) {
          await revertQualityApprovalFromInventory(inspectionId);
          await supabase.from('quality_inspections').update({
            current_stage: 3,
            status: 'Empacado',
            closed_at: null,
            pago_status: 'Pendiente de aprobación financiera'
          }).eq('id', inspectionId);
        }
        alert(`✅ La inspección del lote ${orderCode} ha sido devuelta a la Etapa 3 (Doblado y Empaque).`);

      } else if (targetOption === 'stage_4') {
        // Reabrir Liquidación (Etapa 4)
        if (inspectionId) {
          await revertQualityApprovalFromInventory(inspectionId);
          await supabase.from('quality_inspections').update({
            current_stage: 4,
            status: 'En Proceso',
            closed_at: null,
            pago_status: 'Pendiente de aprobación financiera'
          }).eq('id', inspectionId);
        }
        alert(`✅ El lote ${orderCode} ha sido reabierto en la Etapa 4 (Liquidación). Se descontó el inventario registrado previamente.`);

      } else if (targetOption === 'sewing') {
        // Devolver a Taller de Confección
        if (inspectionId) await revertQualityApprovalFromInventory(inspectionId);
        if (inspectionId) await supabase.from('individual_garments').delete().eq('quality_inspection_id', inspectionId);
        if (sewingOrderId) await supabase.from('individual_garments').delete().eq('sewing_order_id', sewingOrderId);
        if (inspectionId) await supabase.from('quality_inspections').delete().eq('id', inspectionId);

        if (sewingOrderId) {
          await supabase.from('sewing_orders').update({ status: 'En Confección' }).eq('id', sewingOrderId);
        }
        alert(`✅ La orden ${orderCode} ha sido devuelta al Taller de Confección (En Confección).`);

      } else if (targetOption === 'tendido') {
        // Devolver a Fin de Tendido / Salida de Corte (Remueve subórdenes de confección)
        if (inspectionId) await revertQualityApprovalFromInventory(inspectionId);
        if (inspectionId) await supabase.from('individual_garments').delete().eq('quality_inspection_id', inspectionId);
        if (sewingOrderId) await supabase.from('individual_garments').delete().eq('sewing_order_id', sewingOrderId);
        if (orderId) await supabase.from('individual_garments').delete().eq('order_id', orderId);

        if (inspectionId) await supabase.from('quality_inspections').delete().eq('id', inspectionId);

        if (orderId) {
          const { data: sewingOrders } = await supabase.from('sewing_orders').select('id').eq('parent_order_id', orderId);
          const sewingIds = (sewingOrders || []).map((s: any) => s.id);
          if (sewingIds.length > 0) {
            await supabase.from('sewing_order_sizes').delete().in('sewing_order_id', sewingIds);
            await supabase.from('sewing_orders').delete().eq('parent_order_id', orderId);
          }
          await supabase.from('orders').update({ status: 'Cortado' }).eq('id', orderId);
        } else if (sewingOrderId) {
          await supabase.from('sewing_order_sizes').delete().eq('sewing_order_id', sewingOrderId);
          await supabase.from('sewing_orders').delete().eq('id', sewingOrderId);
        }
        alert(`✅ La orden ${orderCode} ha sido devuelta a Fin de Tendido / Salida de Corte (Estado: Cortado). Se eliminaron las subórdenes relacionales.`);

      } else if (targetOption === 'pre_cut') {
        // Reinicio Total hasta Antes de Corte
        if (inspectionId) await revertQualityApprovalFromInventory(inspectionId);
        if (inspectionId) await supabase.from('individual_garments').delete().eq('quality_inspection_id', inspectionId);
        if (sewingOrderId) await supabase.from('individual_garments').delete().eq('sewing_order_id', sewingOrderId);
        if (orderId) await supabase.from('individual_garments').delete().eq('order_id', orderId);

        if (inspectionId) await supabase.from('quality_inspections').delete().eq('id', inspectionId);

        if (sewingOrderId) {
          await supabase.from('sewing_order_sizes').delete().eq('sewing_order_id', sewingOrderId);
          await supabase.from('sewing_orders').delete().eq('id', sewingOrderId);
        } else if (orderId) {
          await supabase.from('sewing_orders').delete().eq('parent_order_id', orderId);
        }

        if (orderId) {
          const { data: cuts } = await supabase.from('cutting_orders').select('id').eq('order_id', orderId);
          if (cuts && cuts.length > 0) {
            for (const cut of cuts) {
              await supabase.from('cut_sizes').delete().eq('cutting_order_id', cut.id);
              await supabase.from('cutting_items').delete().eq('cutting_order_id', cut.id);
            }
            await supabase.from('cutting_orders').delete().eq('order_id', orderId);
          }
          await supabase.from('orders').update({ status: 'CREADO', workshop_id: null }).eq('id', orderId);
        }
        alert(`✅ La orden ${orderCode} ha sido reiniciada por completo hasta antes de corte.`);
      }

      await supabase.from('global_audit_logs').insert({
        event_type: 'SUPERADMIN_ROLLBACK_ORDER',
        module_name: 'Calidad',
        user_name: currentUser?.full_name || currentUser?.email || 'SuperAdmin Master',
        user_id: currentUser?.id,
        affected_record: orderCode,
        criticidad: 'Crítica',
        resultado: 'Exitoso',
        new_value: { action: targetOption, order_code: orderCode, order_id: orderId, inspection_id: inspectionId }
      });

      setShowRollbackModal(false);
      setRollbackItem(null);
      closeModal();
      fetchInspections();
      fetchNotifications();
    } catch (err: any) {
      alert('Error ejecutando el rollback: ' + err.message);
    } finally {
      setExecutingRollback(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    const updates: any = { status };
    if (status === 'Aprobado' || status === 'Empacado') updates.closed_at = new Date().toISOString();
    await supabase.from('quality_inspections').update(updates).eq('id', id);
    if (status === 'Aprobado') await syncQualityApprovalToInventory(id);
    fetchInspections();
  };

  const closeModal = () => {
    setShowModal(false); setEditingId(null); setForm(EMPTY_FORM);
    setOrderDetail(null); setIndividualGarments([]); setSelectedGarment(null);
    setRowApproved({}); setRowRejected({}); setActiveStage(1);
  };

  const openReview = async (item: any) => {
    setEditingId(item.id);
    const danadasMatch = (item.notes || '').match(/\[DAÑADAS FACTURAR:\s*(\d+)\]/i);
    const loadedDanadas = item.danadas_facturar !== undefined && item.danadas_facturar !== null ? Number(item.danadas_facturar) : (danadasMatch ? Number(danadasMatch[1]) : 0);
    setForm({
      id: item.id, order_id: item.order_id || '', sewing_order_id: item.sewing_order_id || '',
      workshop_name: item.workshop_name || '',
      items_inspected: (item.items_inspected || 0).toString(),
      items_approved: (item.items_approved || 0).toString(),
      items_rejected: (item.items_rejected || 0).toString(),
      lavanderia: (item.lavanderia || 0).toString(), saldos: (item.saldos || 0).toString(),
      has_lavanderia: Number(item.lavanderia) > 0,
      has_saldos: Number(item.saldos) > 0,
      costuras: (item.costuras || 0).toString(), incompleto: (item.incompleto || 0).toString(),
      has_incompleto: Number(item.incompleto) > 0,
      danadas_facturar: loadedDanadas.toString(),
      has_danadas_facturar: loadedDanadas > 0,
      status: item.status, notes: item.notes || '',
      valor_prenda: (item.valor_prenda || 3500).toString(),
      descuento_defectos: (item.descuento_defectos || 0).toString(),
      valor_pagar: (item.valor_pagar || 0).toString(),
      pago_status: item.pago_status || 'Pendiente de aprobación financiera',
      received_at: item.received_at || null, inspected_at: item.inspected_at || null,
      packaged_at: item.packaged_at || null, closed_at: item.closed_at || null,
      operator_name: item.operator_name || (currentUser?.full_name) || '',
      current_stage: item.current_stage || 1
    });
    setRowApproved({}); setRowRejected({});
    const stageMap: Record<string, number> = { 'Pendiente': 1, 'Reproceso': 1, 'Doblado': 3, 'Empacado': 3, 'Aprobado': 4, 'Rechazado': 4 };
    setActiveStage(item.current_stage || stageMap[item.status] || 1);
    setShowModal(true);
    await fetchOrderDetail(item.sewing_order_id || item.order_id, !!item.sewing_order_id);
  };

  const printLabelsForInspection = async (item: any) => {
    const sewingId = item.sewing_order_id;
    const orderId = item.order_id;
    let garments: any[] = [];
    if (sewingId) {
      const { data } = await supabase.from('individual_garments').select('*').eq('sewing_order_id', sewingId).order('barcode', { ascending: true });
      garments = data || [];
    } else if (orderId) {
      const { data } = await supabase.from('individual_garments').select('*').eq('order_id', orderId).order('barcode', { ascending: true });
      garments = data || [];
    }
    if (garments.length === 0) { alert('Sin prendas unitarias registradas. Abre la inspección y genera prendas en la Etapa 2.'); return; }
    setIndividualGarments(garments);
    setOrderDetail((prev: any) => prev ? prev : { consecutive: item.sewing_orders?.confeccion_code || '' });
    setShowLabelsModal(true);
  };

  // KPI calculations
  const completedInsps = inspections.filter(i => i.closed_at && i.received_at);
  const avgHours = completedInsps.length > 0
    ? completedInsps.reduce((sum, i) => sum + (new Date(i.closed_at).getTime() - new Date(i.received_at).getTime()) / 3600000, 0) / completedInsps.length
    : 0;

  const approved = inspections.filter(i => i.status === 'Aprobado').length;
  const rejected = inspections.filter(i => i.status === 'Rechazado').length;
  const totalInspectedUnits = inspections.reduce((sum, i) => sum + (i.items_inspected || 0), 0);
  const totalApprovedUnits = inspections.reduce((sum, i) => sum + (i.items_approved || 0), 0);
  const qualityPct = totalInspectedUnits > 0 ? ((totalApprovedUnits / totalInspectedUnits) * 100).toFixed(1) : '100';
  const totalValueDiscounted = inspections.reduce((sum, i) => sum + (Number(i.descuento_defectos) || 0), 0);
  const totalValueToPay = inspections.filter(i => i.pago_status === 'Pendiente de aprobación financiera').reduce((sum, i) => sum + (Number(i.valor_pagar) || 0), 0);

  const workshopPerformance = Object.entries(
    inspections.reduce((acc: Record<string, any>, item: any) => {
      const wName = item.workshop_name || item.sewing_orders?.workshops?.nombre_taller || 'Taller Desconocido';
      if (!acc[wName]) acc[wName] = { name: wName, inspected: 0, approved: 0, rejected: 0 };
      acc[wName].inspected += item.items_inspected || 0;
      acc[wName].approved += item.items_approved || 0;
      acc[wName].rejected += item.items_rejected || 0;
      return acc;
    }, {})
  ).map(([_, w]: any) => {
    const qualityRate = w.inspected > 0 ? (w.approved / w.inspected) * 100 : 100;
    const reworksRate = w.inspected > 0 ? (w.rejected / w.inspected) * 100 : 0;
    const stars = qualityRate >= 97 ? 5 : qualityRate >= 93 ? 4 : qualityRate >= 88 ? 3 : 2;
    return { name: w.name, production: w.inspected, quality: qualityRate, rework: reworksRate, stars };
  }).sort((a, b) => b.quality - a.quality);

  const filtered = inspections.filter(i => {
    const orderCode = i.sewing_orders?.confeccion_code || (i.orders?.consecutive ? `OC-${i.orders.consecutive.toString().padStart(4, '0')}` : '');
    const client = i.orders?.client_name || '';
    const workshop = i.workshop_name || i.sewing_orders?.workshops?.nombre_taller || '';
    const matchSearch = orderCode.toLowerCase().includes(search.toLowerCase()) || client.toLowerCase().includes(search.toLowerCase()) || workshop.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus ? i.status === filterStatus : true;
    return matchSearch && matchStatus;
  });

  const detailRows = orderDetail ? getDetailRows(orderDetail) : [];
  const { totalApproved: rowTotalApproved, totalRejected: rowTotalRejected } = computeTotalsFromRows(detailRows);

  const totalApp = detailRows.length > 0 
    ? rowTotalApproved 
    : (Number(form.items_approved) || 0);

  const totalRej = detailRows.length > 0 
    ? rowTotalRejected 
    : (Number(form.items_rejected) || 0);

  const totalRec = detailRows.length > 0
    ? detailRows.reduce((s, r) => s + r.quantity, 0)
    : (Number(form.items_inspected) || (totalApp + totalRej));
  const totalRep = individualGarments.filter(g => g.status === 'Reproceso').length;
  const allResolved = totalRec > 0 && (totalApp + totalRej === totalRec) && totalRep === 0;

  const STAGE_LABELS = ['1. Recepción e Inspección', '2. Etiquetado', '3. Doblado y Empaque', '4. Liquidación'];
  const roleNameStr = (userRole || currentUser?.roles?.name || '').toLowerCase();
  const isSuperAdmin = roleNameStr.includes('super') || roleNameStr.includes('admin master') || currentUser?.role_id === 'superadmin';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '4rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#80082E', textTransform: 'uppercase' }}>Etapa de Producción</span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '950', margin: '0.25rem 0 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.5rem', backgroundColor: '#80082E', borderRadius: '12px', color: 'white' }}><ClipboardCheck size={24} /></div>
            Control de Calidad
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Módulo independiente de 7 etapas: trazabilidad por prenda, reprocesos y liquidación financiera.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setOrderDetail(null); setShowModal(true); }}>
          <Plus size={18} /> Nueva Inspección
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        {[
          { label: 'Tiempo Promedio Inspección', value: avgHours > 0 ? `${avgHours.toFixed(1)}h` : '—', color: '#6366f1', icon: Activity, desc: 'Desde recepción a cierre de lote' },
          { label: 'Pendientes Financieros', value: `$${totalValueToPay.toLocaleString('es-CO')}`, color: '#f59e0b', icon: AlertCircle, desc: 'En espera de aprobación financiera' },
          { label: 'Descuentos por Defectos', value: `$${totalValueDiscounted.toLocaleString('es-CO')}`, color: '#ef4444', icon: XCircle, desc: 'Aplicado en liquidaciones del período' },
          { label: '% Calidad General', value: `${qualityPct}%`, color: '#10b981', icon: Award, desc: `${approved} lotes aprobados / ${rejected} rechazados` },
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid var(--border)', borderRadius: '16px', backgroundColor: 'white' }}>
            <div style={{ padding: '0.75rem', backgroundColor: `${k.color}18`, color: k.color, borderRadius: '12px', flexShrink: 0 }}><k.icon size={22} /></div>
            <div>
              <p style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{k.label}</p>
              <h3 style={{ fontSize: '1.35rem', fontWeight: '950', margin: '0.1rem 0', color: '#0f172a' }}>{k.value}</h3>
              <p style={{ fontSize: '0.65rem', color: '#64748b', margin: 0 }}>{k.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Two-column: Workshop Ranking + Live Notifications */}
      <div style={{ display: 'grid', gridTemplateColumns: workshopPerformance.length > 0 ? '3fr 2fr' : '1fr', gap: '1.5rem' }}>
        {workshopPerformance.length > 0 && (
          <div className="card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: '900', color: '#0f172a', margin: '0 0 0.25rem' }}>Ranking de Satélites</h3>
            <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0 0 1rem' }}>Desempeño de calidad y defectos por taller.</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', backgroundColor: '#f8fafc' }}>
                    {['Taller', 'Producción', 'Calidad %', 'Defectos %', 'Estrellas'].map(h => (
                      <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: '900', color: '#475569', fontSize: '0.68rem', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {workshopPerformance.map((w, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.65rem 0.75rem', fontWeight: '800', color: '#0f172a' }}>{w.name}</td>
                      <td style={{ padding: '0.65rem 0.75rem', fontWeight: '700' }}>{w.production.toLocaleString()} uds</td>
                      <td style={{ padding: '0.65rem 0.75rem', fontWeight: '800', color: w.quality >= 95 ? '#16a34a' : w.quality >= 90 ? '#d97706' : '#dc2626' }}>{w.quality.toFixed(1)}%</td>
                      <td style={{ padding: '0.65rem 0.75rem', fontWeight: '700', color: '#dc2626' }}>{w.rework.toFixed(1)}%</td>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.85rem' }}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={11} fill={i < w.stars ? '#eab308' : 'none'} stroke={i < w.stars ? '#eab308' : '#d1d5db'} style={{ display: 'inline-block' }} />
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Live Notifications Feed */}
        <div className="card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: '900', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Bell size={16} style={{ color: '#80082E' }} /> Alertas y Novedades
              </h3>
              <p style={{ fontSize: '0.68rem', color: '#64748b', margin: '0.1rem 0 0' }}>Feed en vivo desde base de datos.</p>
            </div>
            <button onClick={fetchNotifications} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#80082E', fontSize: '0.68rem', fontWeight: '800' }}>↻ Actualizar</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '240px', overflowY: 'auto' }}>
            {dbNotifications.length === 0 ? (
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center', padding: '1.5rem 0' }}>Sin alertas registradas.</p>
            ) : dbNotifications.map((n: any) => {
              const colors: Record<string, { bg: string; border: string; dot: string }> = {
                high: { bg: '#fff5f5', border: '#fecdd3', dot: '#ef4444' },
                medium: { bg: '#fffbeb', border: '#fde68a', dot: '#f59e0b' },
                low: { bg: '#f0f9ff', border: '#bae6fd', dot: '#3b82f6' }
              };
              const c = colors[n.severity] || colors.low;
              return (
                <div key={n.id} style={{ padding: '0.65rem 0.75rem', borderRadius: '10px', border: `1.5px solid ${c.border}`, backgroundColor: c.bg, display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: c.dot, marginTop: '0.3rem', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: '0.74rem', color: '#1e293b', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</strong>
                    <span style={{ fontSize: '0.68rem', color: '#475569', display: 'block', marginTop: '0.1rem' }}>{n.message}</span>
                    <span style={{ fontSize: '0.6rem', color: '#94a3b8', display: 'block', marginTop: '0.15rem' }}>
                      {new Date(n.created_at).toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Inspection List */}
      <div className="card" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input type="text" placeholder="Buscar por orden, cliente o taller..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.5rem', borderRadius: '10px', border: '1.5px solid var(--border)', fontSize: '0.85rem' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {['', ...STATUS_OPTIONS].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)} className="btn" style={{
                fontSize: '0.72rem', fontWeight: '700', padding: '0.5rem 0.875rem',
                backgroundColor: filterStatus === s ? '#80082E' : 'white',
                color: filterStatus === s ? 'white' : 'var(--text)',
                border: '1px solid var(--border)', borderRadius: '8px'
              }}>{s === '' ? 'Todos' : s}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}><Loader2 className="animate-spin" style={{ margin: 'auto', color: '#80082E' }} size={28} /></div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <ClipboardList size={40} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p>No hay inspecciones registradas.</p>
            </div>
          ) : filtered.map((item: any) => {
            const orderCode = item.sewing_orders?.confeccion_code || (item.orders?.consecutive ? `OC-${item.orders.consecutive.toString().padStart(4, '0')}` : '—');
            const client = item.orders?.client_name || '—';
            const workshop = item.workshop_name || item.sewing_orders?.workshops?.nombre_taller || '—';
            const date = item.created_at ? new Date(item.created_at).toLocaleDateString('es-CO') : '—';
            const statusColor = item.status === 'Aprobado' ? { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' }
              : item.status === 'Reproceso' ? { bg: '#fffbeb', color: '#92400e', border: '#fde68a' }
              : item.status === 'Rechazado' ? { bg: '#fff1f2', color: '#9f1239', border: '#fecdd3' }
              : { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
            return (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: statusColor.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: '800', color: '#80082E' }}>{orderCode}</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#0f172a' }}>{client}</span>
                    {(item.sewing_orders?.status === 'Enviado a Calidad' || item.sewing_orders?.status === 'Validación Calidad') ? (
                      <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '999px', backgroundColor: '#fffbeb', color: '#d97706', border: '1px solid #fcd34d', fontWeight: '800' }}>⚠️ PENDIENTE CHECK DE RECIBO</span>
                    ) : (
                      <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '999px', backgroundColor: statusColor.bg, color: statusColor.color, border: `1px solid ${statusColor.border}`, fontWeight: '700' }}>{item.status.toUpperCase()}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.72rem', color: '#64748b', flexWrap: 'wrap' }}>
                    <span>🏭 {workshop}</span>
                    {item.items_inspected > 0 && <span>📦 {item.items_inspected} prendas</span>}
                    {item.items_approved > 0 && <span style={{ color: '#16a34a', fontWeight: '700' }}>✓ {item.items_approved} aprobadas</span>}
                    {item.items_rejected > 0 && <span style={{ color: '#ef4444', fontWeight: '700' }}>✗ {item.items_rejected} rechazadas</span>}
                    <span>📅 {date}</span>
                  </div>
                  {item.received_at && item.closed_at && (
                    <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                      ⏱ Ciclo: {((new Date(item.closed_at).getTime() - new Date(item.received_at).getTime()) / 3600000).toFixed(1)}h
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                  {isSuperAdmin && (
                    <button className="btn"
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.72rem', fontWeight: '900', backgroundColor: '#dc2626', color: 'white', border: '1px solid #991b1b', borderRadius: '8px', cursor: 'pointer' }}
                      onClick={() => handleSuperAdminRollbackOrder(item)}
                      title="Acción exclusiva de SuperAdmin: Deshace y borra todo el flujo hasta cortes sin dejar registros">
                      🚨 Deshacer Orden (SuperAdmin)
                    </button>
                  )}
                  {(item.sewing_orders?.status === 'Enviado a Calidad' || item.sewing_orders?.status === 'Validación Calidad') ? (
                    <button className="btn" disabled={receivingCheckId === item.id}
                      style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: '900', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                      onClick={() => handleConfirmReceivedCheck(item)}>
                      {receivingCheckId === item.id ? 'Confirmando...' : '✓ Dar Check de Recibido'}
                    </button>
                  ) : (
                    <>
                      {(item.status === 'Aprobado' || item.status === 'Doblado' || item.status === 'Empacado') && (
                        <button className="btn"
                          style={{ padding: '0.4rem 0.75rem', fontSize: '0.72rem', fontWeight: '800', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                          onClick={() => printLabelsForInspection(item)}>🖨️ Etiquetas</button>
                      )}
                      <button className="btn"
                        style={{ padding: '0.4rem 0.9rem', fontSize: '0.72rem', fontWeight: '800', backgroundColor: '#80082E', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                        onClick={() => openReview(item)}>Revisar</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── MODAL WIZARD 7 ETAPAS ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.87)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '860px', padding: 0, maxHeight: '95vh', display: 'flex', flexDirection: 'column', borderRadius: '20px', overflow: 'hidden' }}>

            {/* Modal Header */}
            <div style={{ padding: '1.25rem 2rem', background: 'linear-gradient(135deg, #80082E 0%, #D81B60 100%)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <p style={{ fontSize: '0.65rem', fontWeight: '800', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Proceso de Control de Calidad Independiente</p>
                <h2 style={{ fontSize: '1.15rem', fontWeight: '950', color: 'white', margin: '0.1rem 0 0' }}>
                  {orderDetail ? `${orderDetail.confeccion_code || 'OC'} — ${orderDetail.workshops?.nombre_taller || orderDetail.parent_order?.workshops?.nombre_taller || 'Inspección'}` : 'Selecciona una orden de confección'}
                </h2>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {isSuperAdmin && editingId && (
                  <button className="btn"
                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.72rem', fontWeight: '900', backgroundColor: '#dc2626', color: 'white', border: '1px solid #991b1b', borderRadius: '8px', cursor: 'pointer' }}
                    onClick={() => handleSuperAdminRollbackOrder(orderDetail || inspections.find(i => i.id === editingId) || { id: editingId, order_id: form.order_id, sewing_order_id: form.sewing_order_id })}
                    title="Acción exclusiva de SuperAdmin: deshacer completamente esta orden hasta cortes">
                    🚨 Deshacer Todo (SuperAdmin)
                  </button>
                )}
                <button onClick={closeModal} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', cursor: 'pointer', borderRadius: '8px', padding: '0.5rem' }}><X size={18} /></button>
              </div>
            </div>

            {/* Stage Stepper */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', padding: '0.4rem 0.75rem', overflowX: 'auto', gap: '0.25rem', flexShrink: 0 }}>
              {STAGE_LABELS.map((label, idx) => {
                const step = idx + 1;
                const isActive = activeStage === step;
                const isDisabled = step > (form.current_stage || 1);
                return (
                  <button key={step} disabled={isDisabled} onClick={() => setActiveStage(step)} style={{
                    flex: 1, minWidth: '90px', padding: '0.45rem 0.25rem', fontSize: '0.66rem', fontWeight: '800',
                    border: 'none', backgroundColor: isActive ? 'white' : 'transparent',
                    color: isActive ? '#80082E' : (isDisabled ? '#cbd5e1' : '#64748b'), borderRadius: '8px',
                    borderBottom: isActive ? '2.5px solid #80082E' : 'none', cursor: isDisabled ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                    boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                    opacity: isDisabled ? 0.6 : 1
                  }}>
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Order Selector (new only) */}
              {!editingId && activeStage === 1 && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.35rem', color: '#374151' }}>Orden de Confección *</label>
                  <select style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '1.5px solid var(--border)', fontSize: '0.875rem' }}
                    value={form.sewing_order_id} onChange={async e => {
                      setForm({ ...form, sewing_order_id: e.target.value });
                      if (e.target.value) await fetchOrderDetail(e.target.value, true);
                      else setOrderDetail(null);
                    }}>
                    <option value="">Seleccionar Orden de Confección...</option>
                    {sewingOrders.map((so: any) => (
                      <option key={so.id} value={so.id}>{so.confeccion_code} — {so.orders?.client_name} ({so.workshops?.nombre_taller || 'Sin taller'})</option>
                    ))}
                  </select>
                </div>
              )}

              {orderDetail && (
                <>
                  {/* STAGE 1: Recepción e Inspección (Fusionadas) */}
                  {activeStage === 1 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {/* Recepción */}
                      <div className="card" style={{ padding: '1.25rem', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                        <h3 style={{ fontSize: '0.85rem', fontWeight: '900', color: '#1e293b', margin: '0 0 0.35rem' }}>📦 Recepción del Lote</h3>
                        <p style={{ fontSize: '0.74rem', color: '#64748b', margin: '0 0 0.75rem' }}>Registra la fecha de ingreso y las novedades físicas del paquete.</p>
                        {/* Producto y Categoría en encabezado */}
                        {detailRows.length > 0 && (() => {
                          const uniqueProducts = [...new Set(detailRows.map((r: any) => r.productName))].filter(Boolean);
                          const uniqueCategories = [...new Set(detailRows.map((r: any) => r.categoryName))].filter(Boolean);
                          return (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '1.1rem', padding: '0.9rem 1.1rem', backgroundColor: '#eef2ff', border: '2px solid #818cf8', borderRadius: '12px', alignItems: 'center', boxShadow: '0 2px 8px #818cf820' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: '900', color: '#3730a3', textTransform: 'uppercase', letterSpacing: '0.07em' }}>🏷️ Producto:</span>
                              {uniqueProducts.map((p: any) => (
                                <span key={p} style={{ fontSize: '0.92rem', fontWeight: '900', color: '#1e1b4b', background: '#ffffff', padding: '0.3rem 0.85rem', borderRadius: '8px', border: '2px solid #818cf8', boxShadow: '0 1px 4px #6366f130', letterSpacing: '0.01em' }}>{p}</span>
                              ))}
                              {uniqueCategories.length > 0 && (
                                <>
                                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0.15rem', fontWeight: '700' }}>│</span>
                                  <span style={{ fontSize: '0.75rem', fontWeight: '900', color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '0.07em' }}>📂 Categoría:</span>
                                  {uniqueCategories.map((cat: any) => (
                                    <span key={cat} style={{ fontSize: '0.92rem', fontWeight: '800', color: '#4c1d95', background: '#ede9fe', padding: '0.3rem 0.85rem', borderRadius: '8px', border: '2px solid #a78bfa', boxShadow: '0 1px 4px #7c3aed20', letterSpacing: '0.01em' }}>{cat}</span>
                                  ))}
                                </>
                              )}
                            </div>
                          );
                        })()}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '0.25rem' }}>Fecha y hora de recepción</label>
                            <input type="datetime-local" value={form.received_at ? form.received_at.slice(0, 16) : ''}
                              onChange={e => setForm({ ...form, received_at: new Date(e.target.value).toISOString() })}
                              style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.8rem' }} />
                            {!form.received_at && (
                              <button type="button" onClick={() => setForm({ ...form, received_at: new Date().toISOString() })}
                                style={{ marginTop: '0.4rem', fontSize: '0.7rem', color: '#80082E', fontWeight: '800', background: 'none', border: 'none', cursor: 'pointer' }}>
                                🕒 Marcar ahora
                              </button>
                            )}
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '0.25rem' }}>Novedades de recepción</label>
                            <textarea placeholder="Ej: bolsas húmedas, cantidad incompleta..." value={form.notes}
                              onChange={e => setForm({ ...form, notes: e.target.value })}
                              style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.8rem', minHeight: '60px', resize: 'none' }} />
                          </div>
                        </div>
                      </div>

                      {/* Inspección por Color / Talla */}
                      {detailRows.length > 0 && (
                        <div className="card" style={{ padding: '1.25rem', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                          <h3 style={{ fontSize: '0.85rem', fontWeight: '900', color: '#1e293b', margin: '0 0 0.25rem' }}>🔍 Inspección por Referencia, Color y Talla</h3>
                          <p style={{ fontSize: '0.74rem', color: '#64748b', margin: '0 0 1rem' }}>Ingresa cuántas prendas de cada variante están aprobadas y cuántas no pasan. El total rechazado se calculará automáticamente.</p>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                  {['Color', 'Tela', 'Talla', 'Planeadas', 'Aprobadas ✓', 'No Aprobadas ✗', 'Estado'].map(h => (
                                    <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: '900', color: '#475569', fontSize: '0.68rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {detailRows.map((row: any) => {
                                  const planned = Number(row.quantity) || 0;
                                  const approved = rowApproved[row.key] ?? null;
                                  const rejected = rowRejected[row.key] ?? null;
                                  const approvedN = approved !== null ? Number(approved) : 0;
                                  const rejectedN = rejected !== null ? Number(rejected) : 0;
                                  const filled = approved !== null || rejected !== null;
                                  const sumTotal = approvedN + rejectedN;
                                  const overLimit = sumTotal > planned;
                                  const allApproved = filled && approvedN === planned && rejectedN === 0;
                                  const someRejected = filled && rejectedN > 0;
                                  const statusColor = overLimit ? { bg: '#fff1f2', color: '#dc2626', label: `⚠️ Excede (${sumTotal}/${planned})` }
                                    : !filled ? { bg: '#f8fafc', color: '#94a3b8', label: '—' }
                                    : allApproved ? { bg: '#f0fdf4', color: '#16a34a', label: '✓ Todo OK' }
                                    : someRejected ? { bg: '#fff1f2', color: '#dc2626', label: `✗ ${rejectedN} rechazada${rejectedN > 1 ? 's' : ''}` }
                                    : { bg: '#fffbeb', color: '#d97706', label: 'Parcial' };
                                  return (
                                    <tr key={row.key} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: statusColor.bg }}>
                                      <td style={{ padding: '0.5rem 0.75rem' }}>
                                        {row.colorName ? (
                                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: '800', fontSize: '0.78rem', color: '#0f172a' }}>
                                            {row.colorHex && <span style={{ width: '14px', height: '14px', borderRadius: '4px', backgroundColor: row.colorHex, border: '1px solid #cbd5e1', flexShrink: 0, display: 'inline-block' }} />}
                                            {row.colorName}
                                          </span>
                                        ) : <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>Sin color</span>}
                                       </td>
                                      <td style={{ padding: '0.6rem 0.75rem', color: '#64748b', fontWeight: '600', fontSize: '0.75rem' }}>{row.fabricName || '—'}</td>
                                      <td style={{ padding: '0.6rem 0.75rem' }}>
                                        <span style={{ fontWeight: '900', padding: '0.15rem 0.5rem', borderRadius: '6px', backgroundColor: '#e0e7ff', color: '#3730a3', fontSize: '0.73rem' }}>{row.size}</span>
                                      </td>
                                      <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#475569' }}>{planned}</td>
                                      <td style={{ padding: '0.4rem 0.5rem' }}>
                                        <input type="number" min="0" max={planned - rejectedN}
                                          value={approved ?? ''}
                                          placeholder="0"
                                          onChange={e => {
                                            const rawVal = e.target.value === '' ? null : Math.max(0, Number(e.target.value));
                                            const currentRejected = rowRejected[row.key] !== null ? Number(rowRejected[row.key]) : 0;
                                            const maxAllowed = Math.max(0, planned - currentRejected);
                                            const val = rawVal === null ? null : Math.min(rawVal, maxAllowed);
                                            setRowApproved(prev => ({ ...prev, [row.key]: val as any }));
                                          }}
                                          style={{ width: '60px', padding: '0.35rem 0.45rem', borderRadius: '6px', border: `1.5px solid ${overLimit ? '#ef4444' : '#a7f3d0'}`, fontSize: '0.8rem', fontWeight: '800', color: '#065f46', textAlign: 'center', backgroundColor: overLimit ? '#fef2f2' : '#f0fdf4' }} />
                                      </td>
                                      <td style={{ padding: '0.4rem 0.5rem' }}>
                                        <input type="number" min="0" max={planned - approvedN}
                                          value={rejected ?? ''}
                                          placeholder="0"
                                          onChange={e => {
                                            const rawVal = e.target.value === '' ? null : Math.max(0, Number(e.target.value));
                                            const currentApproved = rowApproved[row.key] !== null ? Number(rowApproved[row.key]) : 0;
                                            const maxAllowed = Math.max(0, planned - currentApproved);
                                            const val = rawVal === null ? null : Math.min(rawVal, maxAllowed);
                                            setRowRejected(prev => ({ ...prev, [row.key]: val as any }));
                                          }}
                                          style={{ width: '60px', padding: '0.35rem 0.45rem', borderRadius: '6px', border: `1.5px solid ${overLimit ? '#ef4444' : '#fca5a5'}`, fontSize: '0.8rem', fontWeight: '800', color: '#991b1b', textAlign: 'center', backgroundColor: overLimit ? '#fef2f2' : '#fff1f2' }} />
                                      </td>
                                      <td style={{ padding: '0.6rem 0.75rem' }}>
                                        <span style={{ fontSize: '0.68rem', fontWeight: '800', padding: '0.15rem 0.5rem', borderRadius: '999px', backgroundColor: statusColor.bg, color: statusColor.color, border: `1px solid ${statusColor.color}30` }}>
                                          {statusColor.label}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr style={{ borderTop: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                                  <td colSpan={3} style={{ padding: '0.6rem 0.75rem', fontWeight: '900', fontSize: '0.8rem', color: '#0f172a' }}>TOTALES</td>
                                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: '900', color: '#475569' }}>{detailRows.reduce((s: number, r: any) => s + (Number(r.quantity) || 0), 0)}</td>
                                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: '900', color: '#16a34a' }}>{rowTotalApproved}</td>
                                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: '900', color: '#dc2626' }}>{rowTotalRejected}</td>
                                  <td style={{ padding: '0.6rem 0.75rem' }}>
                                    {rowTotalApproved + rowTotalRejected > 0 && (
                                      <span style={{ fontSize: '0.72rem', fontWeight: '900', color: rowTotalRejected === 0 ? '#16a34a' : '#d97706' }}>
                                        {rowTotalRejected === 0 ? '✓ Lote OK' : `⚠️ ${((rowTotalRejected / (rowTotalApproved + rowTotalRejected)) * 100).toFixed(1)}% rechazado`}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                          {/* Total items inspected field & Observaciones */}
                          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#475569', whiteSpace: 'nowrap' }}>Total prendas recibidas:</label>
                                <input type="number" min="0" value={form.items_inspected}
                                  onChange={e => setForm({ ...form, items_inspected: e.target.value })}
                                  style={{ width: '80px', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', fontWeight: '800', textAlign: 'center' }} />
                              </div>
                              {form.inspected_at ? (
                                <span style={{ fontSize: '0.68rem', color: '#16a34a', fontWeight: '700' }}>✓ Inspeccionado el {new Date(form.inspected_at).toLocaleString('es-CO')}</span>
                              ) : (
                                <button type="button" onClick={() => setForm({ ...form, inspected_at: new Date().toISOString() })}
                                  style={{ fontSize: '0.7rem', color: '#80082E', fontWeight: '800', background: 'none', border: 'none', cursor: 'pointer' }}>🕒 Marcar hora de inspección</button>
                              )}
                            </div>

                            {/* Campo de Observaciones Detalladas de Inspección */}
                            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem' }}>
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#1e293b', marginBottom: '0.35rem' }}>
                                📝 Observaciones de la Inspección de Calidad
                              </label>
                              <textarea
                                placeholder="Escribe aquí las observaciones detalladas del estado de las prendas, fallas de costura, tonos de tela, hilos, etc..."
                                value={form.notes}
                                onChange={e => setForm({ ...form, notes: e.target.value })}
                                style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1.5px solid #cbd5e1', fontSize: '0.8rem', minHeight: '75px', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Clasificación de Bodega (Lavandería y Saldos - Bodegas de Fábrica) */}
                      <div className="card" style={{ padding: '1.25rem', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#f8fafc' }}>
                        <h3 style={{ fontSize: '0.85rem', fontWeight: '900', color: '#1e293b', margin: '0 0 0.25rem' }}>
                          🧺 Clasificación y Destino de Bodega (Lavandería y Saldos)
                        </h3>
                        <p style={{ fontSize: '0.74rem', color: '#64748b', margin: '0 0 1rem' }}>
                          Selecciona si el lote incluye prendas para lavado o saldos y registra la cantidad de prendas para su asignación a bodegas de Fábrica.
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                          
                          {/* Opción 1: Lavandería */}
                          <div style={{
                            padding: '1rem',
                            borderRadius: '10px',
                            border: (form.has_lavanderia || Number(form.lavanderia) > 0) ? '2px solid #2563eb' : '1.5px solid #cbd5e1',
                            backgroundColor: (form.has_lavanderia || Number(form.lavanderia) > 0) ? '#eff6ff' : 'white',
                            transition: 'all 0.15s ease-in-out'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <label style={{ fontSize: '0.8rem', fontWeight: '900', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input type="checkbox"
                                  checked={form.has_lavanderia || Number(form.lavanderia) > 0}
                                  onChange={e => {
                                    const isChecked = e.target.checked;
                                    setForm((f: any) => ({
                                      ...f,
                                      has_lavanderia: isChecked,
                                      lavanderia: isChecked ? (f.lavanderia && f.lavanderia !== '0' ? f.lavanderia : '1') : '0'
                                    }));
                                  }}
                                  style={{ width: '17px', height: '17px', accentColor: '#2563eb', cursor: 'pointer' }} />
                                🧼 Requiere Proceso de Lavandería
                              </label>
                              <span style={{ fontSize: '0.65rem', fontWeight: '800', padding: '0.2rem 0.6rem', borderRadius: '999px', backgroundColor: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe' }}>
                                Bodega Lavanderia (Fabrica)
                              </span>
                            </div>

                            {(form.has_lavanderia || Number(form.lavanderia) > 0) && (
                              <div style={{ marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px dashed #bfdbfe' }}>
                                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: '#1e3a8a', marginBottom: '0.3rem' }}>
                                  Cantidad de prendas que se lavan:
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <input type="number" min="1"
                                    value={form.lavanderia}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setForm((f: any) => ({ ...f, lavanderia: val, has_lavanderia: Number(val) > 0 }));
                                    }}
                                    style={{ width: '100px', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1.5px solid #2563eb', fontSize: '0.85rem', fontWeight: '800', color: '#1e40af', backgroundColor: 'white' }} />
                                  <span style={{ fontSize: '0.72rem', color: '#3b82f6', fontWeight: '700' }}>prendas enviadas a lavado</span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Opción 2: Saldos */}
                          <div style={{
                            padding: '1rem',
                            borderRadius: '10px',
                            border: (form.has_saldos || Number(form.saldos) > 0) ? '2px solid #d97706' : '1.5px solid #cbd5e1',
                            backgroundColor: (form.has_saldos || Number(form.saldos) > 0) ? '#fffbeb' : 'white',
                            transition: 'all 0.15s ease-in-out'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <label style={{ fontSize: '0.8rem', fontWeight: '900', color: '#92400e', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input type="checkbox"
                                  checked={form.has_saldos || Number(form.saldos) > 0}
                                  onChange={e => {
                                    const isChecked = e.target.checked;
                                    setForm((f: any) => ({
                                      ...f,
                                      has_saldos: isChecked,
                                      saldos: isChecked ? (f.saldos && f.saldos !== '0' ? f.saldos : '1') : '0'
                                    }));
                                  }}
                                  style={{ width: '17px', height: '17px', accentColor: '#d97706', cursor: 'pointer' }} />
                                🏷️ Trasladar Prendas a Saldos
                              </label>
                              <span style={{ fontSize: '0.65rem', fontWeight: '800', padding: '0.2rem 0.6rem', borderRadius: '999px', backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                                Bodega Saldos (Fabrica)
                              </span>
                            </div>

                            {(form.has_saldos || Number(form.saldos) > 0) && (
                              <div style={{ marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px dashed #fde68a' }}>
                                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: '#78350f', marginBottom: '0.3rem' }}>
                                  Cantidad de prendas que pasan a saldos:
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <input type="number" min="1"
                                    value={form.saldos}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setForm((f: any) => ({ ...f, saldos: val, has_saldos: Number(val) > 0 }));
                                    }}
                                    style={{ width: '100px', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1.5px solid #d97706', fontSize: '0.85rem', fontWeight: '800', color: '#92400e', backgroundColor: 'white' }} />
                                  <span style={{ fontSize: '0.72rem', color: '#d97706', fontWeight: '700' }}>prendas enviadas a saldos</span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Opción 3: Incompleto / Faltantes */}
                          <div style={{
                            padding: '1rem',
                            borderRadius: '10px',
                            border: (form.has_incompleto || Number(form.incompleto) > 0) ? '2px solid #dc2626' : '1.5px solid #cbd5e1',
                            backgroundColor: (form.has_incompleto || Number(form.incompleto) > 0) ? '#fef2f2' : 'white',
                            transition: 'all 0.15s ease-in-out'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <label style={{ fontSize: '0.8rem', fontWeight: '900', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input type="checkbox"
                                  checked={form.has_incompleto || Number(form.incompleto) > 0}
                                  onChange={e => {
                                    const isChecked = e.target.checked;
                                    setForm((f: any) => ({
                                      ...f,
                                      has_incompleto: isChecked,
                                      incompleto: isChecked ? (f.incompleto && f.incompleto !== '0' ? f.incompleto : '1') : '0'
                                    }));
                                  }}
                                  style={{ width: '17px', height: '17px', accentColor: '#dc2626', cursor: 'pointer' }} />
                                ⚠️ Novedad por Faltante / Lote Incompleto
                              </label>
                              <span style={{ fontSize: '0.65rem', fontWeight: '800', padding: '0.2rem 0.6rem', borderRadius: '999px', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}>
                                Bodega Incompletos (Fábrica)
                              </span>
                            </div>

                            {(form.has_incompleto || Number(form.incompleto) > 0) && (
                              <div style={{ marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px dashed #fca5a5' }}>
                                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: '#7f1d1d', marginBottom: '0.3rem' }}>
                                  Cantidad de prendas faltantes en el paquete/lote:
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <input type="number" min="1"
                                    value={form.incompleto}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setForm((f: any) => ({ ...f, incompleto: val, has_incompleto: Number(val) > 0 }));
                                    }}
                                    style={{ width: '100px', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1.5px solid #dc2626', fontSize: '0.85rem', fontWeight: '800', color: '#991b1b', backgroundColor: 'white' }} />
                                  <span style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: '700' }}>prendas faltantes reportadas</span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Opción 4: Prendas Dañadas (Facturar a Taller) */}
                          <div style={{
                            padding: '1rem',
                            borderRadius: '10px',
                            border: (form.has_danadas_facturar || Number(form.danadas_facturar) > 0) ? '2px solid #be123c' : '1.5px solid #cbd5e1',
                            backgroundColor: (form.has_danadas_facturar || Number(form.danadas_facturar) > 0) ? '#fff1f2' : 'white',
                            transition: 'all 0.15s ease-in-out'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <label style={{ fontSize: '0.8rem', fontWeight: '900', color: '#9f1239', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input type="checkbox"
                                  checked={form.has_danadas_facturar || Number(form.danadas_facturar) > 0}
                                  onChange={e => {
                                    const isChecked = e.target.checked;
                                    setForm((f: any) => ({
                                      ...f,
                                      has_danadas_facturar: isChecked,
                                      danadas_facturar: isChecked ? (f.danadas_facturar && f.danadas_facturar !== '0' ? f.danadas_facturar : '1') : '0'
                                    }));
                                  }}
                                  style={{ width: '17px', height: '17px', accentColor: '#be123c', cursor: 'pointer' }} />
                                🔥 Prendas Dañadas (Facturar a Taller)
                              </label>
                              <span style={{ fontSize: '0.65rem', fontWeight: '800', padding: '0.2rem 0.6rem', borderRadius: '999px', backgroundColor: '#ffe4e6', color: '#9f1239', border: '1px solid #fecdd3' }}>
                                Cobro a Taller
                              </span>
                            </div>

                            {(form.has_danadas_facturar || Number(form.danadas_facturar) > 0) && (
                              <div style={{ marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px dashed #fecdd3' }}>
                                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: '#881337', marginBottom: '0.3rem' }}>
                                  Cantidad de prendas dañadas a facturar/cobrar:
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <input type="number" min="1"
                                    value={form.danadas_facturar}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setForm((f: any) => ({ ...f, danadas_facturar: val, has_danadas_facturar: Number(val) > 0 }));
                                    }}
                                    style={{ width: '100px', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1.5px solid #be123c', fontSize: '0.85rem', fontWeight: '800', color: '#9f1239', backgroundColor: 'white' }} />
                                  <span style={{ fontSize: '0.72rem', color: '#be123c', fontWeight: '700' }}>prendas dañadas a cobrar</span>
                                </div>
                              </div>
                            )}
                          </div>

                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => handleSave(1)}
                          disabled={saving}
                          style={{
                            padding: '0.55rem 1.35rem',
                            fontSize: '0.8rem',
                            fontWeight: '800',
                            backgroundColor: '#2563eb',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
                          }}
                        >
                          {saving ? <Loader2 className="animate-spin" size={14} /> : '💾 Guardar Avance Temporal (Borrador)'}
                        </button>
                        <button onClick={() => handleSave(2)} className="btn btn-primary" style={{ padding: '0.55rem 1.5rem', fontSize: '0.8rem' }}>
                          Guardar y Proceder a Etiquetado →
                        </button>
                      </div>
                    </div>
                  )}
                  {/* STAGE 2: Etiquetado (Generación de Códigos de Barras) */}
                  {activeStage === 2 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div className="card" style={{ padding: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                          <QrCode size={42} style={{ color: '#0f172a', margin: '0 auto 0.75rem' }} />
                          <h3 style={{ fontSize: '0.85rem', fontWeight: '900', color: '#1e293b', margin: '0 0 0.25rem' }}>🏷️ Generación de Etiquetas y Códigos de Barras</h3>
                          <p style={{ fontSize: '0.74rem', color: '#64748b', margin: 0 }}>Se generarán códigos de barras numéricos para las <strong>{rowTotalApproved} prendas aprobadas</strong>. Una vez generados, imprime las etiquetas para despacho.</p>
                        </div>
                        {individualGarments.length === 0 ? (
                          <div style={{ textAlign: 'center' }}>
                            <button onClick={generateIndividualGarments} disabled={loadingGarments || rowTotalApproved === 0} className="btn"
                              style={{ fontSize: '0.82rem', fontWeight: '900', padding: '0.7rem 2rem', backgroundColor: '#80082E', color: 'white', border: 'none', borderRadius: '8px', cursor: rowTotalApproved === 0 ? 'not-allowed' : 'pointer', opacity: rowTotalApproved === 0 ? 0.5 : 1 }}>
                              {loadingGarments ? '⏳ Generando etiquetas...' : `⚙️ Generar ${rowTotalApproved} Etiquetas Aprobadas`}
                            </button>
                            {rowTotalApproved === 0 && <p style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: '0.5rem', fontWeight: '700' }}>Debes registrar prendas aprobadas en la Etapa 1 primero.</p>}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ padding: '0.75rem', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', fontSize: '0.78rem', color: '#16a34a', fontWeight: '800', textAlign: 'center' }}>
                              ✓ {individualGarments.length} etiquetas generadas.
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                              <button type="button"
                                onClick={() => printLabelsForInspection({ 
                                  sewing_order_id: orderDetail?.sewing_order_sizes ? orderDetail.id : null, 
                                  order_id: orderDetail?.sewing_order_sizes ? null : orderDetail.id, 
                                  id: editingId 
                                })}
                                style={{ padding: '0.65rem 1.75rem', fontSize: '0.82rem', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' }}>
                                🖨️ Abrir Panel de Impresión
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <button onClick={() => setActiveStage(1)} style={{ padding: '0.5rem 1.15rem', fontSize: '0.78rem', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>← Atrás</button>
                        <button onClick={() => handleSave(3)} className="btn btn-primary" style={{ padding: '0.55rem 1.5rem', fontSize: '0.8rem' }}>Proceder a Doblado y Empaque →</button>
                      </div>
                    </div>
                  )}

                  {/* STAGE 3: Doblado y Empaque */}
                  {activeStage === 3 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div className="card" style={{ padding: '1.25rem', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                        <h3 style={{ fontSize: '0.85rem', fontWeight: '900', color: '#1e293b', margin: '0 0 0.35rem' }}>📦 Doblado y Empaque</h3>
                        {rowTotalApproved === 0 ? (
                          <div style={{ padding: '1.25rem', textAlign: 'center', backgroundColor: '#fff1f2', borderRadius: '8px', border: '1px solid #fecdd3', color: '#9f1239', fontSize: '0.78rem', fontWeight: '700' }}>
                            🔒 BLOQUEADO: Debes ingresar las cantidades aprobadas en la Etapa 1 antes de proceder al empaque.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {/* Resumen Prominente de Cantidad a Empacar */}
                            <div style={{
                              padding: '1rem 1.25rem',
                              backgroundColor: '#f0fdf4',
                              border: '1.5px solid #86efac',
                              borderRadius: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '0.75rem'
                            }}>
                              <div>
                                <span style={{ fontSize: '0.68rem', color: '#166534', fontWeight: '800', textTransform: 'uppercase', display: 'block' }}>
                                  Cantidad de Prendas Aprobadas a Doblar y Empacar
                                </span>
                                <h2 style={{ fontSize: '1.4rem', fontWeight: '950', color: '#15803d', margin: '0.1rem 0 0' }}>
                                  📦 {rowTotalApproved} {rowTotalApproved === 1 ? 'Prenda' : 'Prendas'}
                                </h2>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '0.7rem', color: '#475569', fontWeight: '700', display: 'block' }}>
                                  Total aprobadas del lote
                                </span>
                                {rowTotalRejected > 0 && (
                                  <span style={{ fontSize: '0.68rem', color: '#dc2626', fontWeight: '800' }}>
                                    (⚠️ {rowTotalRejected} rechazada{rowTotalRejected > 1 ? 's' : ''} excluidas de empaque)
                                  </span>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '0.25rem' }}>Fecha y hora de empaque</label>
                                <input type="datetime-local" value={form.packaged_at ? form.packaged_at.slice(0, 16) : ''}
                                  onChange={e => setForm({ ...form, packaged_at: new Date(e.target.value).toISOString() })}
                                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.8rem' }} />
                                {!form.packaged_at && (
                                  <button type="button" onClick={() => setForm({ ...form, packaged_at: new Date().toISOString() })}
                                    style={{ marginTop: '0.4rem', fontSize: '0.7rem', color: '#80082E', fontWeight: '800', background: 'none', border: 'none', cursor: 'pointer' }}>🕒 Marcar ahora</button>
                                )}
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '0.25rem' }}>Operario de empaque</label>
                                <input type="text" placeholder="Nombre del empacador..." value={form.operator_name}
                                  onChange={e => setForm({ ...form, operator_name: e.target.value })}
                                  style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.8rem' }} />
                              </div>
                            </div>

                            {/* Campo de Observaciones de Doblado y Empaque */}
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#1e293b', marginBottom: '0.25rem' }}>
                                📝 Observaciones de Doblado y Empaque
                              </label>
                              <textarea
                                placeholder="Escribe aquí novedades del empaque, bolsas, embalaje, ganchos o cualquier detalle del lote..."
                                value={form.notes}
                                onChange={e => setForm({ ...form, notes: e.target.value })}
                                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.8rem', minHeight: '70px', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <button onClick={() => setActiveStage(2)} style={{ padding: '0.5rem 1.15rem', fontSize: '0.78rem', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>← Atrás</button>
                        <button onClick={() => handleSave(4)} disabled={rowTotalApproved === 0} className="btn btn-primary" style={{ padding: '0.55rem 1.5rem', fontSize: '0.8rem', opacity: rowTotalApproved === 0 ? 0.5 : 1 }}>Proceder a Liquidación →</button>
                      </div>
                    </div>
                  )}

                  {/* STAGE 4: Liquidación y Cierre — Solo Administradores */}
                  {activeStage === 4 && (() => {
                    const normalizedRole = userRole?.toLowerCase() || '';
                    const isAdmin = normalizedRole === 'admin' || 
                                    normalizedRole === 'administrador' || 
                                    normalizedRole === 'superadministrador' || 
                                    normalizedRole.includes('admin');

                    // Bloqueo de acceso para no-admins
                    if (!isAdmin) {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', padding: '2.5rem 1rem', textAlign: 'center' }}>
                          <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem' }}>🔒</div>
                          <div>
                            <h4 style={{ fontSize: '1rem', fontWeight: '950', color: '#9f1239', margin: '0 0 0.35rem' }}>Acceso Restringido</h4>
                            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>La liquidación del taller solo puede ser completada por un <strong>Administrador</strong>. Solicita a tu administrador que ingrese al sistema para finalizar este lote.</p>
                          </div>
                          <button onClick={() => setActiveStage(3)} style={{ padding: '0.5rem 1.5rem', fontSize: '0.78rem', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' }}>← Volver a Empaque</button>
                        </div>
                      );
                    }

                    const wObj = orderDetail.workshops || orderDetail.parent_order?.workshops;
                    const rCosturas = wObj ? Number(wObj.desc_costuras ?? 0) : 0;
                    const rLavanderia = wObj ? Number(wObj.desc_lavanderia ?? 0) : 0;
                    const rEmpaque = wObj ? Number(wObj.desc_empaque ?? 0) : 0;

                    // Resolver tarifa correcta usando la misma lógica que el contexto
                    const prodId = orderDetail.product_id || orderDetail.cuts?.[0]?.product_id;
                    const prodObj = products.find((p: any) => String(p.id) === String(prodId));
                    const { rate: autoRate, source: rateSource, isSpecialProduct: isRateSpecial } = getRateSource(orderDetail, prodObj);

                    let cosDef = totalRej;
                    const valPrendaNum = (Number(form.valor_prenda) > 1) ? Number(form.valor_prenda) : autoRate;
                    const isEmpaque = orderDetail.empaque || false;
                    const appValue = totalApp * valPrendaNum;
                    const pagoEmpaque = isEmpaque ? totalApp * rEmpaque : 0;
                    const defDiscount = cosDef * rCosturas;
                    const netPayable = appValue + pagoEmpaque - defDiscount;
                    const isPedidoEspecial = !!(orderDetail.parent_order?.pedido_especial);

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div style={{ border: '1.5px solid #ddd6fe', borderRadius: '14px', padding: '1.5rem', backgroundColor: '#faf5ff' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #ddd6fe', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                               <h4 style={{ fontSize: '0.9rem', fontWeight: '950', color: '#5b21b6', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>💵 Liquidación y Cierre de Lote</h4>
                               {isPedidoEspecial && <span style={{ backgroundColor: '#fff7ed', border: '1.5px solid #fb923c', borderRadius: '20px', padding: '0.1rem 0.6rem', fontSize: '0.62rem', fontWeight: '900', color: '#c2410c' }}>⭐ Pedido Especial</span>}
                               {isRateSpecial && <span style={{ backgroundColor: '#f0fdf4', border: '1.5px solid #4ade80', borderRadius: '20px', padding: '0.1rem 0.6rem', fontSize: '0.62rem', fontWeight: '900', color: '#15803d' }}>💲 Costo Especial</span>}
                             </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '0.6rem', color: '#94a3b8', display: 'block' }}>Fuente: {rateSource}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                  <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#5b21b6' }}>$/prenda:</span>
                                  <input type="number" value={valPrendaNum} onChange={e => setForm({ ...form, valor_prenda: e.target.value })}
                                    style={{ width: '90px', padding: '0.25rem 0.5rem', borderRadius: '6px', border: `1.5px solid ${isRateSpecial ? '#4ade80' : '#c084fc'}`, fontSize: '0.78rem', fontWeight: '800', textAlign: 'center', backgroundColor: isRateSpecial ? '#f0fdf4' : 'white' }} />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Resumen Prominente de Conteo y Clasificación */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.85rem', backgroundColor: 'white', padding: '1rem', borderRadius: '12px', border: '1.5px solid #e9d5ff', marginBottom: '1.25rem', boxShadow: '0 2px 8px rgba(91,33,182,0.05)' }}>
                            {[
                              { label: 'Ingresadas', value: totalRec, color: '#334155', bg: '#f8fafc' },
                              { label: 'Aprobadas ✓', value: totalApp, color: '#16a34a', bg: '#f0fdf4' },
                              { label: 'Rechazadas ✗', value: totalRej, color: '#dc2626', bg: '#fef2f2' },
                              { label: 'Reproceso', value: totalRep, color: '#d97706', bg: '#fffbeb' },
                            ].map(item => (
                              <div key={item.label} style={{ textAlign: 'center', backgroundColor: item.bg, padding: '0.65rem 0.5rem', borderRadius: '8px', border: `1px solid ${item.color}25` }}>
                                <p style={{ margin: 0, fontSize: '0.72rem', color: item.color, fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{item.label}</p>
                                <p style={{ margin: '0.2rem 0 0', fontSize: '1.45rem', fontWeight: '950', color: item.color }}>{item.value}</p>
                              </div>
                            ))}
                          </div>

                          {/* Sección Destino a Bodegas de Fábrica (Sin Descuento Financiero) */}
                          <div style={{ backgroundColor: '#eff6ff', border: '1.5px solid #93c5fd', borderRadius: '12px', padding: '0.85rem 1.15rem', marginBottom: '1.25rem' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: '900', color: '#1e40af', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span>🧺 Destino a Bodegas de Fábrica (Sin Descuento Financiero al Taller):</span>
                            </div>
                            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#1e3a8a', fontWeight: '800' }}>
                                <span>🧼 Bodega Lavandería:</span>
                                <span style={{ backgroundColor: '#dbeafe', color: '#1e40af', padding: '0.15rem 0.65rem', borderRadius: '6px', fontWeight: '950', fontSize: '0.9rem' }}>
                                  {Number(form.lavanderia) || 0} prendas
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#92400e', fontWeight: '800' }}>
                                <span>🏷️ Bodega Saldos:</span>
                                <span style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '0.15rem 0.65rem', borderRadius: '6px', fontWeight: '950', fontSize: '0.9rem' }}>
                                  {Number(form.saldos) || 0} prendas
                                </span>
                              </div>
                            </div>
                            <span style={{ fontSize: '0.7rem', color: '#2563eb', display: 'block', marginTop: '0.4rem', fontStyle: 'italic' }}>
                              ℹ️ Nota: Estas prendas ingresan directamente a sus bodegas de Fábrica sin deducción económica sobre la tarifa del taller.
                            </span>
                          </div>

                          {/* Desglose Financiero de Liquidación */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', borderTop: '2px dashed #ddd6fe', paddingTop: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#334155' }}>
                              <span>Valor base confección ({totalApp} aprobadas × ${valPrendaNum.toLocaleString('es-CO')}):</span>
                              <span style={{ fontWeight: '800' }}>${appValue.toLocaleString('es-CO')} COP</span>
                            </div>
                            {isEmpaque && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#16a34a' }}>
                                <span>Adicional por empaque ({totalApp} prendas × ${rEmpaque.toLocaleString('es-CO')}):</span>
                                <span style={{ fontWeight: '800' }}>+${pagoEmpaque.toLocaleString('es-CO')} COP</span>
                              </div>
                            )}
                            {totalRej > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#64748b' }}>
                                <span>Valor no liquidado por prendas rechazadas ({totalRej} rechazadas × ${valPrendaNum.toLocaleString('es-CO')}):</span>
                                <span style={{ fontWeight: '800', color: '#64748b' }}>${(totalRej * valPrendaNum).toLocaleString('es-CO')} COP</span>
                              </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#dc2626' }}>
                              <span>Descuento aplicado por defectos ({cosDef} prendas × ${rCosturas.toLocaleString('es-CO')} penalización):</span>
                              <span style={{ fontWeight: '900', color: '#dc2626' }}>-${defDiscount.toLocaleString('es-CO')} COP</span>
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.15rem', color: '#5b21b6', fontWeight: '950', backgroundColor: '#f3e8ff', padding: '0.85rem 1.15rem', borderRadius: '10px', border: '1.5px solid #c084fc', marginTop: '0.5rem' }}>
                              <span>TOTAL A PAGAR AL TALLER:</span>
                              <span style={{ fontSize: '1.35rem', color: '#5b21b6' }}>${netPayable.toLocaleString('es-CO')} COP</span>
                            </div>
                          </div>
                          <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#5b21b6', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Estado del Lote</label>
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                {['Aprobado', 'Empacado', 'Rechazado'].map(s => (
                                  <button key={s} type="button" onClick={() => setForm({ ...form, status: s })}
                                    style={{ flex: 1, padding: '0.4rem 0.25rem', borderRadius: '8px', border: `2px solid ${form.status === s ? '#80082E' : '#e2e8f0'}`, backgroundColor: form.status === s ? '#fdf2f4' : 'white', color: form.status === s ? '#80082E' : '#64748b', fontWeight: '800', fontSize: '0.68rem', cursor: 'pointer' }}>
                                    {s}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#5b21b6', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Aprobación Financiera</label>
                              <select value={form.pago_status} onChange={e => setForm({ ...form, pago_status: e.target.value })}
                                style={{ width: '100%', padding: '0.45rem', borderRadius: '8px', border: '1.5px solid #c084fc', fontSize: '0.75rem', fontWeight: '700', color: '#5b21b6', cursor: 'pointer' }}>
                                <option value="Pendiente de aprobación financiera">⏳ Pendiente de aprobación</option>
                                <option value="Autorizado para Pago">✅ Autorizado para Pago</option>
                                <option value="Pagado">💵 Pagado</option>
                              </select>
                            </div>
                          </div>
                        </div>
                        <button className="btn" disabled={saving} onClick={() => handleSave(4, true)}
                          style={{ width: '100%', padding: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', fontSize: '0.9rem', fontWeight: '950', backgroundColor: '#10b981', color: 'white', border: 'none', cursor: 'pointer' }}>
                          {saving ? <Loader2 className="animate-spin" size={18} /> : <><CheckCircle2 size={18} /> CERRAR Y FINALIZAR LOTE</>}
                        </button>
                        <button onClick={() => setActiveStage(3)} style={{ padding: '0.45rem', fontSize: '0.78rem', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>← Atrás</button>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de etiquetas — vista previa en pantalla */}
      {showLabelsModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', maxWidth: '850px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1.5px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>🖨️ Impresión de Etiquetas Unitarias</h3>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.1rem 0 0' }}>
                  {individualGarments.length} prendas — {Math.ceil(individualGarments.length / (stickerConfig.columnsPerRow || 3))} fila(s) de {stickerConfig.columnsPerRow || 3} etiquetas c/u.
                </p>
              </div>
              <button type="button" onClick={() => setShowLabelsModal(false)} style={{ border: 'none', background: 'none', fontSize: '1.25rem', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
            </div>

            {/* Vista previa (solo pantalla, sin lógica de impresión) */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {(() => {
                  const cols = stickerConfig.columnsPerRow || 3;
                  const rows: any[][] = [];
                  for (let i = 0; i < individualGarments.length; i += cols) {
                    rows.push(individualGarments.slice(i, i + cols));
                  }
                  return rows.map((rowGarments, rIdx) => (
                    <div key={rIdx} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '0.75rem' }}>
                      {rowGarments.map((g: any) => (
                        <div key={g.id} style={{
                          backgroundColor: 'white', border: '1.5px solid #0f172a', borderRadius: '8px',
                          padding: '0.75rem 0.6rem', display: 'flex', flexDirection: 'column',
                          height: `${Math.max(260, Math.round((stickerConfig.stickerHeightMm || 80) * 3.8))}px`,
                          justifyContent: 'space-between', boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', borderBottom: '1.5px solid #e2e8f0', paddingBottom: '0.4rem' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#80082E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
                              <line x1="20" y1="4" x2="8.12" y2="15.88"/>
                              <line x1="14.47" y1="14.48" x2="20" y2="20"/>
                              <line x1="8.12" y1="8.12" x2="12" y2="12"/>
                            </svg>
                            <span style={{ fontSize: `${stickerConfig.headerFontSize}px`, fontWeight: '900', color: '#80082E' }}>
                              {stickerConfig.headerText || 'CORTES BREINER'}
                            </span>
                          </div>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', padding: '0.5rem 0' }}>
                            <span style={{ fontSize: `${stickerConfig.refFontSize}px`, fontWeight: stickerConfig.refFontWeight as any, color: '#1e293b', textAlign: 'center', lineHeight: 1.2 }}>
                              {(g.reference_name || 'Referencia').replace(/\s*\[.*?\]/g, '').trim()}
                            </span>
                            {g.color_name && <span style={{ fontSize: `${Math.max(10, stickerConfig.refFontSize - 3)}px`, color: '#64748b', fontWeight: '800' }}>{g.color_name}</span>}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                              <BarcodeCanvas text={g.barcode || '00420001'} type={stickerConfig.barcodeType || 'code128'} height={stickerConfig.barcodeHeight || 55} garmentId={g.id} />
                              <span style={{ fontSize: `${stickerConfig.barcodeFontSize || 12}px`, fontWeight: '950', color: '#000', letterSpacing: '0.14em', marginTop: '0.15rem', fontFamily: 'monospace' }}>
                                {g.barcode || '00420001'}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'center', borderTop: '1.5px solid #e2e8f0', paddingTop: '0.4rem' }}>
                            <span style={{ fontSize: `${stickerConfig.sizeFontSize}px`, fontWeight: '950', backgroundColor: stickerConfig.sizeBgColor || '#0f172a', color: 'white', padding: '0.1rem 0.75rem', borderRadius: '4px' }}>
                              {g.size_code || 'S/T'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Selector de código de barras */}
            <div style={{ padding: '0.85rem 1.5rem', borderTop: '1.5px solid #e2e8f0', borderBottom: '1.5px solid #e2e8f0', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#1e293b' }}>📐 Estándar de Código de Barras:</span>
                <select
                  value={stickerConfig.barcodeType || 'code128'}
                  onChange={e => setStickerConfig({ ...stickerConfig, barcodeType: e.target.value })}
                  style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1.5px solid #94a3b8', fontSize: '0.78rem', fontWeight: '800', backgroundColor: 'white', color: '#0f172a', cursor: 'pointer' }}
                >
                  <option value="code128">⚡ CODE 128 — Universal</option>
                  <option value="code39">🏷️ CODE 39 — Solo números y letras</option>
                  <option value="qr">📱 QR 2D</option>
                </select>
              </div>
            </div>

            <div style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                💡 {stickerConfig.stickerWidthMm || 50}mm × {stickerConfig.stickerHeightMm || 80}mm · {stickerConfig.columnsPerRow || 3} col/fila · sep {stickerConfig.gapMm ?? 2}mm
              </span>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" onClick={() => setShowLabelsModal(false)} style={{ fontSize: '0.8rem', padding: '0.55rem 1.25rem', border: '1.5px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', backgroundColor: 'white' }}>Cerrar</button>
                <button
                  type="button"
                  onClick={() => {
                    const cols = stickerConfig.columnsPerRow || 3;
                    const wMm = stickerConfig.stickerWidthMm || 50;
                    const hMm = stickerConfig.stickerHeightMm || 80;
                    const gapMm = stickerConfig.gapMm ?? 2;
                    // Ancho total de página = (ancho etiqueta × columnas) + separadores entre columnas
                    const pageWMm = (wMm * cols) + (gapMm * (cols - 1));

                    const rows: any[][] = [];
                    for (let i = 0; i < individualGarments.length; i += cols) {
                      rows.push(individualGarments.slice(i, i + cols));
                    }

                    const barcodeImages: Record<string, string> = {};
                    const imgs = document.querySelectorAll('img[data-barcode-garment-id]');
                    imgs.forEach((img) => {
                      const id = (img as HTMLImageElement).dataset.barcodeGarmentId;
                      const src = (img as HTMLImageElement).src;
                      if (id && src) {
                        barcodeImages[id] = src;
                      }
                    });

                    const rowsHtml = rows.map(rowGarments => {
                      const cardsHtml = rowGarments.map((g: any, idx: number) => {
                        const imgSrc = barcodeImages[g.id] || '';
                        const refName = (g.reference_name || 'Referencia').replace(/\s*\[.*?\]/g, '').trim();
                        // Separador a la derecha excepto en la última columna de la fila
                        const marginRight = (idx < rowGarments.length - 1) ? `margin-right:${gapMm}mm;` : '';
                        return `
                          <div class="card" style="${marginRight}">
                            <div class="top">
                              <span style="font-size:${stickerConfig.headerFontSize}px;font-weight:900;color:#80082E;">
                                ${stickerConfig.headerText || 'CORTES BREINER'}
                              </span>
                            </div>
                            <div class="mid">
                              <span style="font-size:${stickerConfig.refFontSize}px;font-weight:${stickerConfig.refFontWeight};color:#1e293b;text-align:center;">
                                ${refName}
                              </span>
                              ${g.color_name ? `<span style="font-size:${Math.max(10, stickerConfig.refFontSize - 3)}px;color:#64748b;">${g.color_name}</span>` : ''}
                              ${imgSrc ? `<img src="${imgSrc}" style="max-width:90%;height:auto;" />` : ''}
                              <span style="font-size:${stickerConfig.barcodeFontSize || 12}px;font-family:monospace;letter-spacing:0.12em;font-weight:900;">
                                ${g.barcode || '00420001'}
                              </span>
                            </div>
                            <div class="bot">
                              <span style="font-size:${stickerConfig.sizeFontSize}px;font-weight:900;background:${stickerConfig.sizeBgColor || '#0f172a'};color:white;padding:1px 8px;border-radius:3px;">
                                ${g.size_code || 'S/T'}
                              </span>
                            </div>
                          </div>`;
                      }).join('');
                      return `<div class="row">${cardsHtml}</div>`;
                    }).join('');

                    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Etiquetas Zebra</title>
  <style>
    @page { size: ${pageWMm}mm ${hMm}mm; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: white; width: ${pageWMm}mm; }
    .row {
      display: flex;
      flex-direction: row;
      width: ${pageWMm}mm;
      height: ${hMm}mm;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
    }
    .card {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      width: ${wMm}mm;
      min-width: ${wMm}mm;
      max-width: ${wMm}mm;
      height: ${hMm}mm;
      padding: 2mm;
      border: 0.5px solid #666;
      overflow: hidden;
      flex-shrink: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .top {
      display: flex;
      align-items: center;
      gap: 3px;
      border-bottom: 0.5px solid #ccc;
      padding-bottom: 1mm;
    }
    .mid {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1mm;
    }
    .bot {
      display: flex;
      justify-content: center;
      border-top: 0.5px solid #ccc;
      padding-top: 1mm;
    }
  </style>
</head>
<body>${rowsHtml}</body>
</html>`;

                    const popup = window.open('', '_blank', 'width=800,height=600');
                    if (!popup) {
                      alert('Por favor permita los popups para imprimir etiquetas.');
                      return;
                    }
                    popup.document.write(html);
                    popup.document.close();
                    popup.focus();
                    setTimeout(() => {
                      popup.print();
                      popup.close();
                    }, 600);
                  }}
                  style={{ fontSize: '0.8rem', padding: '0.55rem 1.5rem', border: 'none', borderRadius: '8px', cursor: 'pointer', backgroundColor: '#80082E', color: 'white', fontWeight: '800' }}
                >
                  🖨 Imprimir (Zebra)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SuperAdmin Rollback Interactive Modal */}
      {showRollbackModal && rollbackItem && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', maxWidth: '580px', width: '100%', padding: '1.75rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '2px solid #dc2626' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.65rem', fontWeight: '950', color: '#dc2626', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', padding: '0.15rem 0.6rem', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  🚨 ACCIÓN EXCLUSIVA SUPERADMINISTRADOR
                </span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: '950', color: '#0f172a', margin: '0.35rem 0 0' }}>
                  Deshacer / Revertir Etapa de Proceso
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.15rem 0 0' }}>
                  Selecciona a qué punto exacto del flujo deseas devolver la orden <strong>{rollbackItem.sewing_orders?.confeccion_code || rollbackItem.confeccion_code || rollbackItem.order_id || 'seleccionada'}</strong>.
                </p>
              </div>
              <button onClick={() => setShowRollbackModal(false)} style={{ border: 'none', background: 'none', fontSize: '1.25rem', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '360px', overflowY: 'auto' }}>
              {[
                { id: 'stage_1', title: '↩️ Devolver a Etapa 1: Recepción e Inspección', desc: 'Regresa el lote al inicio de revisión de calidad. Se descuenta inventario si fue sincronizado.' },
                { id: 'stage_2', title: '↩️ Devolver a Etapa 2: Reproceso y Arreglos', desc: 'Permite reevaluar o ajustar prendas con defectos en reproceso.' },
                { id: 'stage_3', title: '↩️ Devolver a Etapa 3: Doblado y Empaque', desc: 'Permite reabrir empaque y re-imprimir etiquetas.' },
                { id: 'stage_4', title: '🔄 Reabrir Liquidación (Etapa 4)', desc: 'Deshace el cierre del lote y revierte el kardex para reajustar los valores a pagar.' },
                { id: 'sewing', title: '🧵 Re-enviar a Taller de Confección', desc: 'Elimina la inspección actual y devuelve la orden al módulo de confección.' },
                { id: 'tendido', title: '✂️ Devolver a Fin de Tendido (Salida de Corte)', desc: 'Elimina subórdenes de confección e inspección, dejando la orden en estado Cortado (lista para enviar a taller).' },
                { id: 'pre_cut', title: '💥 Reinicio Total hasta Antes de Corte', desc: 'Resetea la orden de producción a estado CREADO borrando confección y corte.' },
              ].map(opt => (
                <label
                  key={opt.id}
                  onClick={() => setSelectedRollbackOption(opt.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.85rem 1rem',
                    borderRadius: '10px',
                    border: `2px solid ${selectedRollbackOption === opt.id ? '#dc2626' : '#e2e8f0'}`,
                    backgroundColor: selectedRollbackOption === opt.id ? '#fef2f2' : '#f8fafc',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <input
                    type="radio"
                    name="rollbackOption"
                    checked={selectedRollbackOption === opt.id}
                    onChange={() => setSelectedRollbackOption(opt.id)}
                    style={{ marginTop: '0.2rem' }}
                  />
                  <div>
                    <strong style={{ fontSize: '0.82rem', color: selectedRollbackOption === opt.id ? '#991b1b' : '#0f172a', display: 'block' }}>{opt.title}</strong>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{opt.desc}</span>
                  </div>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setShowRollbackModal(false)}
                disabled={executingRollback}
                style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', backgroundColor: 'white', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={executingRollback}
                onClick={() => handleExecuteRollbackOption(selectedRollbackOption)}
                style={{ padding: '0.55rem 1.5rem', borderRadius: '8px', border: 'none', backgroundColor: '#dc2626', color: 'white', fontSize: '0.8rem', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {executingRollback ? <Loader2 className="animate-spin" size={16} /> : '⚠️ Confirmar y Ejecutar Rollback'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* Ocultar el bloque de impresión en pantalla */
        #printable-labels-container { display: none; }

        @media print {
          @page {
            size: ${(stickerConfig.stickerWidthMm || 50) * (stickerConfig.columnsPerRow || 3)}mm ${stickerConfig.stickerHeightMm || 80}mm;
            margin: 0;
          }

          /*
            Ocultar todo el body con visibility:hidden.
            A diferencia de display:none, los hijos PUEDEN
            sobreescribir con visibility:visible.
          */
          body {
            visibility: hidden !important;
          }

          /* Mostrar solo el bloque de impresión y sus hijos */
          #printable-labels-container {
            display: block !important;
            visibility: visible !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          #printable-labels-container * {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Cada fila = exactamente 1 página del rollo Zebra */
          .plr {
            display: grid !important;
            grid-template-columns: repeat(${stickerConfig.columnsPerRow || 3}, 1fr) !important;
            width: 100% !important;
            height: ${stickerConfig.stickerHeightMm || 80}mm !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
          }

          /* Tarjeta individual */
          .plc {
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            height: ${stickerConfig.stickerHeightMm || 80}mm !important;
            box-sizing: border-box !important;
            padding: 2mm !important;
            margin: 0 !important;
            border: 0.5px solid #444 !important;
            background: white !important;
            overflow: hidden !important;
          }
          .plc-top {
            display: flex !important;
            align-items: center !important;
            gap: 3px !important;
            border-bottom: 0.5px solid #ccc !important;
            padding-bottom: 1mm !important;
          }
          .plc-mid {
            flex: 1 !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 1mm !important;
          }
          .plc-bot {
            display: flex !important;
            justify-content: center !important;
            border-top: 0.5px solid #ccc !important;
            padding-top: 1mm !important;
          }
        }
      `}</style>
    </div>
  );
}
