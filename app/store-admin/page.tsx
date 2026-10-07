'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Store, Plus, Trash2, Edit3, Settings, ShieldAlert,
  BarChart3, RefreshCw, Layers, CheckCircle2, XCircle, AlertTriangle,
  FolderOpen, Calendar, DollarSign, Tag, Clock, ArrowRight, UserCheck,
  Loader2, X, Activity, ShoppingBag, CreditCard, ChevronRight, Users,
  ListPlus, DollarSign as MoneyIcon, Search, Shirt, Package, ShoppingCart
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

type TabType = 'dashboard' | 'stores' | 'registers' | 'sessions' | 'promotions' | 'inventory_monitoring' | 'shifts' | 'price_lists' | 'sales_billing' | 'ux_manager' | 'chat_erp';

export default function StoreAdminPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  // UX Manager states
  const [themes, setThemes] = useState<any[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<any>(null);
  const [previewTab, setPreviewTab] = useState<'dashboard' | 'pos' | 'login' | 'inventario'>('dashboard');
  const [editingStyles, setEditingStyles] = useState<any>({
    colors: {
      primary: '#f97316', secondary: '#475569', background: '#f8fafc', cards: '#ffffff',
      buttons: '#f97316', menus: '#1e293b', tables: '#ffffff', titles: '#0f172a',
      text: '#334155', icons: '#f97316', alerts: '#ef4444', success: '#10b981',
      error: '#dc2626', warning: '#f59e0b', transaction: '#10b981'
    },
    typography: { fontFamily: 'Inter', fontSize: '14px', fontWeight: '500', letterSpacing: '0px' },
    buttons: { borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', hoverScale: '1.02' },
    cards: { borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' },
    sidebar: { 
      width: '260px', 
      color: '#1e293b',
      icon_ventas: 'ShoppingCart',
      icon_turnos: 'Clock',
      icon_reportes: 'FileText',
      icon_mas: 'MoreHorizontal',
      iconSize: '20'
    },
    logo: {
      store_logo_url: '',
      platform_logo_url: '',
      headerText: 'Breiner',
      headerTextSize: '20px',
      headerTextColor: '#80082E',
      headerTextPlacement: 'right'
    }
  });

  // Real-time live theme preview broadcaster
  const broadcastThemePreview = (newStyles: any) => {
    if (typeof window === 'undefined') return;
    try {
      // 1. Same-device Broadcast Channel
      const localBC = new BroadcastChannel('pos-live-theme-preview');
      localBC.postMessage({ styles: newStyles });
      localBC.close();

      // 2. Multi-device Supabase Broadcast Channel
      supabase.channel('pos-live-theme-broadcast').send({
        type: 'broadcast',
        event: 'preview-theme',
        payload: { styles: newStyles }
      });
    } catch (e) {
      console.warn("Failed to broadcast theme preview:", e);
    }
  };

  // Listen to editingStyles changes and broadcast preview in real-time
  useEffect(() => {
    if (editingStyles && Object.keys(editingStyles).length > 0) {
      broadcastThemePreview(editingStyles);
    }
  }, [editingStyles]);

  const updateEditingStyles = (newStyles: any) => {
    setEditingStyles(newStyles);
  };
  const [scopeSelection, setScopeSelection] = useState<'all' | 'store' | 'campaign'>('all');
  const [assignedStoreId, setAssignedStoreId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [themeName, setThemeName] = useState<string>('');
  const [themeDescription, setThemeDescription] = useState<string>('');
  const [savingTheme, setSavingTheme] = useState<boolean>(false);
  const [themeActive, setThemeActive] = useState<boolean>(false);

  // Masters & Data
  const [stores, setStores] = useState<any[]>([]);
  const [registers, setRegisters] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [storeInventory, setStoreInventory] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [profilesList, setProfilesList] = useState<any[]>([]);
  const [salesList, setSalesList] = useState<any[]>([]);
  const [billingSearch, setBillingSearch] = useState('');
  const [shifts, setShifts] = useState<any[]>([]);
  const [priceLists, setPriceLists] = useState<any[]>([]);
  const [priceListItems, setPriceListItems] = useState<any[]>([]);

  // Inventory Monitoring States
  const [invSearchQuery, setInvSearchQuery] = useState('');
  const [invStoreFilter, setInvStoreFilter] = useState('all');
  const [invPage, setInvPage] = useState(0);

  // Selected list for editing pricing items
  const [selectedPriceListPricing, setSelectedPriceListPricing] = useState<any>(null);
  const [pricingInputs, setPricingInputs] = useState<{ [key: string]: string }>({});

  // Modals & Saving
  const [loading, setLoading] = useState(true);
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);

  // Sales billing console & Credit Notes
  const [selectedSales, setSelectedSales] = useState<string[]>([]);
  const [invoicingMass, setInvoicingMass] = useState(false);
  const [availableDocTypes, setAvailableDocTypes] = useState<any[]>([]);
  const [selectedDocTypeId, setSelectedDocTypeId] = useState<string>('auto');
  const [massInvoicingProgress, setMassInvoicingProgress] = useState<{
    current: number;
    total: number;
    currentTicket: string;
    status: string;
    successCount: number;
    errorCount: number;
  } | null>(null);
  const [showPriceListModal, setShowPriceListModal] = useState(false);
  const [showStoreInvModal, setShowStoreInvModal] = useState(false);

  // Credit Note Modal State
  const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);
  const [selectedSaleForCN, setSelectedSaleForCN] = useState<any>(null);
  const [creditNoteReason, setCreditNoteReason] = useState('Anulación por error en facturación');
  const [creditNoteType, setCreditNoteType] = useState('01'); // 01: Devolución parcial/total
  const [processingCreditNote, setProcessingCreditNote] = useState(false);

  // Invoice Tracking & Audit Log Modal State
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [selectedSaleForTracking, setSelectedSaleForTracking] = useState<any>(null);
  const [saleTrackingLogs, setSaleTrackingLogs] = useState<any[]>([]);
  const [loadingTrackingLogs, setLoadingTrackingLogs] = useState(false);

  // SIIGO Diagnostic & Service Tracking Panel (Live Test Console)
  const [siigoTestEndpoint, setSiigoTestEndpoint] = useState('/customers');
  const [siigoTestMethod, setSiigoTestMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('GET');
  const [siigoTestPayload, setSiigoTestPayload] = useState('{\n  "page": 1,\n  "page_size": 5\n}');
  const [siigoTestResponse, setSiigoTestResponse] = useState<any>(null);
  const [siigoTestLoading, setSiigoTestLoading] = useState(false);
  const [siigoAuthStatus, setSiigoAuthStatus] = useState<any>(null);
  const [siigoTestingAuth, setSiigoTestingAuth] = useState(false);

  // SuperAdmin Debug JSON & DocTypes Library Modal States
  const [showDebugPayloadModal, setShowDebugPayloadModal] = useState(false);
  const [debugPayloadSale, setDebugPayloadSale] = useState<any>(null);
  const [debugPayloadContent, setDebugPayloadContent] = useState<any>(null);

  const [showDocTypesLibraryModal, setShowDocTypesLibraryModal] = useState(false);
  const [docTypesLibraryList, setDocTypesLibraryList] = useState<any[]>([]);
  const [docTypesLibraryLoading, setDocTypesLibraryLoading] = useState(false);

  // Chat ERP States
  const [chatRooms, setChatRooms] = useState<any[]>([]);
  const [activeRoom, setActiveRoom] = useState<any>(null);
  const [activeRoomMessages, setActiveRoomMessages] = useState<any[]>([]);
  const [adminChatInput, setAdminChatInput] = useState('');
  const [sendingAdminMsg, setSendingAdminMsg] = useState(false);
  const [chatSubTab, setChatSubTab] = useState<'rooms' | 'alerts'>('rooms');
  
  // Load ERP Chat Rooms
  const fetchChatRooms = async () => {
    try {
      const { data } = await supabase
        .from('pos_chat_rooms')
        .select('*')
        .order('last_message_time', { ascending: false });
      setChatRooms(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  // Select a Chat Room and load messages + clear unread
  const selectChatRoom = async (room: any) => {
    setActiveRoom(room);
    try {
      const { data: messages } = await supabase
        .from('pos_chat_messages')
        .select('*')
        .eq('room_id', room.id)
        .order('created_at', { ascending: true });
      setActiveRoomMessages(messages || []);

      // Reset ERP unread count
      await supabase
        .from('pos_chat_rooms')
        .update({ unread_count_erp: 0 })
        .eq('id', room.id);
      
      // Update local rooms list
      setChatRooms(prev => prev.map(r => r.id === room.id ? { ...r, unread_count_erp: 0 } : r));
    } catch (e) {
      console.error(e);
    }
  };

  // Send admin chat message
  const handleSendAdminMessage = async () => {
    if (!adminChatInput.trim() || !activeRoom || sendingAdminMsg) return;
    setSendingAdminMsg(true);
    const text = adminChatInput.trim();
    setAdminChatInput('');
    try {
      const { data: newMsg, error } = await supabase
        .from('pos_chat_messages')
        .insert({
          room_id: activeRoom.id,
          sender_name: 'Administración ERP',
          sender_role: 'admin',
          message: text
        })
        .select()
        .single();
      if (error) throw error;

      // Fetch fresh room data to get exact unread_count_pos
      const { data: freshRoom } = await supabase
        .from('pos_chat_rooms')
        .select('unread_count_pos')
        .eq('id', activeRoom.id)
        .single();

      const newUnreadCount = ((freshRoom?.unread_count_pos || 0) + 1);

      // Update room metadata in DB
      await supabase
        .from('pos_chat_rooms')
        .update({
          last_message: text,
          last_message_time: new Date().toISOString(),
          unread_count_pos: newUnreadCount
        })
        .eq('id', activeRoom.id);

      setActiveRoomMessages((prev: any[]) => [...prev, newMsg]);
      // Update local state copy to match new value
      setActiveRoom((prev: any) => prev ? { ...prev, unread_count_pos: newUnreadCount } : null);
      fetchChatRooms();
    } catch (e) {
      console.error('Error sending erp message:', e);
      setAdminChatInput(text);
    } finally {
      setSendingAdminMsg(false);
    }
  };

  const fetchSiigoDocTypes = async () => {
    try {
      const res = await fetch('/api/siigo/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'GET', endpoint: '/document-types?type=FV' })
      });
      const json = await res.json();
      const list = json.data || json;
      if (Array.isArray(list)) {
        setAvailableDocTypes(list);
      }
    } catch (e) {
      console.warn("Could not fetch SIIGO document types:", e);
    }
  };

  // ERP Alerts/Anuncios States & Handlers
  const [erpAlertsList, setErpAlertsList] = useState<any[]>([]);
  const [newAlertTitle, setNewAlertTitle] = useState('');
  const [newAlertMessage, setNewAlertMessage] = useState('');
  const [newAlertCriticidad, setNewAlertCriticidad] = useState('Media');
  const [savingAlert, setSavingAlert] = useState(false);

  const fetchErpAlertsList = async () => {
    try {
      const { data } = await supabase
        .from('novelties')
        .select('*')
        .eq('modulo_relac', 'alerta_general')
        .order('created_at', { ascending: false });
      setErpAlertsList(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlertTitle.trim() || !newAlertMessage.trim() || savingAlert) return;
    setSavingAlert(true);
    try {
      const { error } = await supabase
        .from('novelties')
        .insert({
          cod_novedad: newAlertTitle.trim(),
          nombre: newAlertMessage.trim(),
          modulo_relac: 'alerta_general',
          criticidad: newAlertCriticidad,
          estado: 'pendiente'
        });
      if (error) throw error;
      
      setNewAlertTitle('');
      setNewAlertMessage('');
      setNewAlertCriticidad('Media');
      alert('✓ Alerta formal general publicada a todos los puntos de venta.');
      fetchErpAlertsList();
    } catch (err: any) {
      alert('Error publicando alerta: ' + err.message);
    } finally {
      setSavingAlert(false);
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta alerta general? Desaparecerá de todos los puntos de venta.')) return;
    try {
      const { error } = await supabase
        .from('novelties')
        .delete()
        .eq('id', alertId);
      if (error) throw error;
      fetchErpAlertsList();
    } catch (err: any) {
      alert('Error eliminando alerta: ' + err.message);
    }
  };



  // Forms
  const [storeForm, setStoreForm] = useState({ id: '', codigo: '', nombre: '', direccion: '', ciudad: '', responsable: '', telefono: '', bodega_asociada_id: '', resolucion_nro: '', estado: 'activo' });
  const [registerForm, setRegisterForm] = useState({ id: '', store_id: '', codigo_caja: '', estado: 'cerrada' });
  const [promoForm, setPromoForm] = useState({ id: '', nombre: '', tipo: 'Porcentaje', valor: 0, fecha_inicio: '', fecha_fin: '', activo: true });
  const [shiftForm, setShiftForm] = useState({ id: '', store_id: '', user_id: '', assigned_register_id: '', fecha: '', hora_entrada: '08:00', hora_salida: '17:00', estado: 'programado', observaciones: '' });
  const [priceListForm, setPriceListForm] = useState({ id: '', nombre: '', descripcion: '', activo: true, tipo_descuento_global: 'valor', valor_descuento_global: '' });
  const [storeInvForm, setStoreInvForm] = useState({ store_id: '', product_id: '', size_id: '', color_id: '', cantidad: 1, type: 'ingreso' });

  const [savingStore, setSavingStore] = useState(false);
  const [savingRegister, setSavingRegister] = useState(false);
  const [savingPromo, setSavingPromo] = useState(false);
  const [savingShift, setSavingShift] = useState(false);
  const [savingPriceList, setSavingPriceList] = useState(false);
  const [savingStoreInv, setSavingStoreInv] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: st } = await supabase.from('stores').select('*, warehouses:bodega_asociada_id(id, nombre_bodega)').order('codigo');
      const { data: reg } = await supabase.from('pos_registers').select('*, stores(nombre)').order('codigo_caja');
      const { data: ses } = await supabase.from('pos_cash_sessions').select('*, pos_registers(*, stores(*))').order('fecha_apertura', { ascending: false });
      const { data: promo } = await supabase.from('pos_promotions').select('*').order('created_at', { ascending: false });
      
      // Load real stock from finished_goods_stock joined with warehouses, products, colors, sizes
      const { data: fgInv } = await supabase
        .from('finished_goods_stock')
        .select('*, warehouses(id, nombre_bodega), products(id, nombre_producto, codigo_referencia, imagen_url), colors(id, nombre_color, codigo_color), sizes(id, nombre_talla, codigo_talla)')
        .gt('cantidad_disponible', 0)
        .order('created_at', { ascending: false });
      
      const { data: wh } = await supabase.from('warehouses').select('*').eq('estado', 'activo');
      const { data: prod } = await supabase.from('products').select('*').order('nombre_producto');
      const { data: col } = await supabase.from('colors').select('*');
      const { data: sz } = await supabase.from('sizes').select('*').order('orden_visual');
      const { data: sales } = await supabase.from('pos_sales').select('*, stores(nombre), pos_payments(*), pos_sale_items(*, products(*), colors(*), sizes(*))').order('created_at', { ascending: false });
      
      let profs: any[] = [];
      try {
        const res = await fetch('/api/users/list');
        if (res.ok) {
          const data = await res.json();
          profs = data.users || [];
        } else {
          const { data } = await supabase.from('profiles').select('id, full_name, email');
          profs = data || [];
        }
      } catch (e) {
        const { data } = await supabase.from('profiles').select('id, full_name, email');
        profs = data || [];
      }

      // Safe fetch for staff shifts
      let shData: any[] = [];
      try {
        const { data } = await supabase.from('store_staff_shifts').select('*, stores(nombre)').order('fecha', { ascending: false });
        shData = data || [];
      } catch (err) {
        console.warn("Table store_staff_shifts does not exist or has RLS error.");
      }

      // Safe fetch for price lists
      let plData: any[] = [];
      let pliData: any[] = [];
      try {
        const { data } = await supabase.from('pos_price_lists').select('*').order('nombre');
        plData = data || [];
        const { data: items } = await supabase.from('pos_price_list_items').select('*');
        pliData = items || [];
      } catch (err) {
        console.warn("Tables pos_price_lists or pos_price_list_items do not exist yet.");
      }

      setStores(st || []);
      setRegisters(reg || []);
      setSessions(ses || []);
      setPromotions(promo || []);
      setStoreInventory(fgInv || []);
      setWarehouses(wh || []);
      setProducts(prod || []);
      setColors(col || []);
      setSizes(sz || []);
      setProfilesList(profs || []);
      setSalesList(sales || []);
      setShifts(shData);
      setPriceLists(plData);
      setPriceListItems(pliData);

      // Fetch visual themes
      let themesData: any[] = [];
      try {
        const { data } = await supabase.from('pos_themes').select('*').order('name');
        themesData = data || [];
      } catch (err) {
        console.warn("Table pos_themes does not exist or has RLS error.");
      }
      setThemes(themesData);

      // Populate pricing inputs mapping
      const mapping: { [key: string]: string } = {};
      pliData.forEach(item => {
        mapping[`${item.price_list_id}_${item.product_id}`] = String(item.precio);
      });
      setPricingInputs(mapping);

      // Fetch chat rooms
      await fetchChatRooms();
      
      // Fetch ERP Alerts List
      await fetchErpAlertsList();

      // Fetch SIIGO Document Types for Document Selector
      fetchSiigoDocTypes();

    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Realtime subscription for ERP Chat Inbox updates
  useEffect(() => {
    const messagesChannel = supabase
      .channel('erp_chat_messages_global')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pos_chat_messages' },
        (payload) => {
          // If message is from a store and it belongs to active room, append it
          if (activeRoom && payload.new.room_id === activeRoom.id) {
            setActiveRoomMessages(prev => {
              if (prev.some(m => m.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            });
          }
          // Refresh list of rooms to show last message & unread badges
          fetchChatRooms();
        }
      )
      .subscribe();

    const roomsChannel = supabase
      .channel('erp_chat_rooms_global')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pos_chat_rooms' },
        () => {
          fetchChatRooms();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(roomsChannel);
    };
  }, [activeRoom]);

  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingStore(true);
    try {
      if (storeForm.id) {
        await supabase.from('stores').update({
          codigo: storeForm.codigo,
          nombre: storeForm.nombre,
          direccion: storeForm.direccion,
          ciudad: storeForm.ciudad,
          responsable: storeForm.responsable,
          telefono: storeForm.telefono,
          bodega_asociada_id: storeForm.bodega_asociada_id || null,
          resolucion_nro: storeForm.resolucion_nro,
          estado: storeForm.estado
        }).eq('id', storeForm.id);
      } else {
        await supabase.from('stores').insert([{
          codigo: storeForm.codigo,
          nombre: storeForm.nombre,
          direccion: storeForm.direccion,
          ciudad: storeForm.ciudad,
          responsable: storeForm.responsable,
          telefono: storeForm.telefono,
          bodega_asociada_id: storeForm.bodega_asociada_id || null,
          resolucion_nro: storeForm.resolucion_nro,
          estado: storeForm.estado
        }]);
      }
      setShowStoreModal(false);
      setStoreForm({ id: '', codigo: '', nombre: '', direccion: '', ciudad: '', responsable: '', telefono: '', bodega_asociada_id: '', resolucion_nro: '', estado: 'activo' });
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingStore(false);
    }
  };

  const handleSaveRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRegister(true);
    try {
      if (registerForm.id) {
        await supabase.from('pos_registers').update({
          store_id: registerForm.store_id,
          codigo_caja: registerForm.codigo_caja
        }).eq('id', registerForm.id);
      } else {
        await supabase.from('pos_registers').insert([{
          store_id: registerForm.store_id,
          codigo_caja: registerForm.codigo_caja,
          estado: 'cerrada'
        }]);
      }
      setShowRegisterModal(false);
      setRegisterForm({ id: '', store_id: '', codigo_caja: '', estado: 'cerrada' });
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingRegister(false);
    }
  };

  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPromo(true);
    try {
      if (promoForm.id) {
        await supabase.from('pos_promotions').update({
          nombre: promoForm.nombre,
          tipo: promoForm.tipo,
          valor: Number(promoForm.valor),
          fecha_inicio: promoForm.fecha_inicio || null,
          fecha_fin: promoForm.fecha_fin || null,
          activo: promoForm.activo
        }).eq('id', promoForm.id);
      } else {
        await supabase.from('pos_promotions').insert([{
          nombre: promoForm.nombre,
          tipo: promoForm.tipo,
          valor: Number(promoForm.valor),
          fecha_inicio: promoForm.fecha_inicio || null,
          fecha_fin: promoForm.fecha_fin || null,
          activo: promoForm.activo
        }]);
      }
      setShowPromoModal(false);
      setPromoForm({ id: '', nombre: '', tipo: 'Porcentaje', valor: 0, fecha_inicio: '', fecha_fin: '', activo: true });
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingPromo(false);
    }
  };

  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingShift(true);
    try {
      if (shiftForm.id) {
        await supabase.from('store_staff_shifts').update({
          store_id: shiftForm.store_id,
          user_id: shiftForm.user_id,
          fecha: shiftForm.fecha,
          hora_entrada: shiftForm.hora_entrada,
          hora_salida: shiftForm.hora_salida,
          estado: shiftForm.estado,
          observaciones: shiftForm.observaciones
        }).eq('id', shiftForm.id);
      } else {
        await supabase.from('store_staff_shifts').insert([{
          store_id: shiftForm.store_id,
          user_id: shiftForm.user_id,
          fecha: shiftForm.fecha,
          hora_entrada: shiftForm.hora_entrada,
          hora_salida: shiftForm.hora_salida,
          estado: shiftForm.estado,
          observaciones: shiftForm.observaciones,
          created_by: profile?.full_name || profile?.email || 'Admin'
        }]);
      }
      setShowShiftModal(false);
      setShiftForm({ id: '', store_id: '', user_id: '', assigned_register_id: '', fecha: '', hora_entrada: '08:00', hora_salida: '17:00', estado: 'programado', observaciones: '' });
      fetchData();
    } catch (err: any) {
      alert("Error guardando turno. " + err.message);
    } finally {
      setSavingShift(false);
    }
  };

  const handleSavePriceList = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPriceList(true);
    try {
      const payload = {
        nombre: priceListForm.nombre,
        descripcion: priceListForm.descripcion,
        activo: priceListForm.activo,
        tipo_descuento_global: priceListForm.tipo_descuento_global,
        valor_descuento_global: priceListForm.valor_descuento_global === '' ? null : Number(priceListForm.valor_descuento_global)
      };

      if (priceListForm.id) {
        await supabase.from('pos_price_lists').update(payload).eq('id', priceListForm.id);
      } else {
        await supabase.from('pos_price_lists').insert([payload]);
      }
      setShowPriceListModal(false);
      setPriceListForm({ id: '', nombre: '', descripcion: '', activo: true, tipo_descuento_global: 'valor', valor_descuento_global: '' });
      fetchData();
    } catch (err: any) {
      alert("Error guardando lista de precios: " + err.message);
    } finally {
      setSavingPriceList(false);
    }
  };

  const handleMassInvoicing = async () => {
    if (selectedSales.length === 0) return alert('Debes seleccionar al menos una venta para facturar.');
    setInvoicingMass(true);
    let successCount = 0;
    let errorCount = 0;
    const errorsList: string[] = [];

    setMassInvoicingProgress({
      current: 0,
      total: selectedSales.length,
      currentTicket: '',
      status: 'Consultando tipos de comprobante y formas de pago en SIIGO...',
      successCount: 0,
      errorCount: 0
    });

    try {
      // 1. Obtain active document type ID, payment type ID, and seller ID from SIIGO
      let docTypeId = 2430; // default fallback
      let paymentId = 5636;  // default fallback
      let sellerId: number | null = null;

      try {
        if (selectedDocTypeId !== 'auto') {
          docTypeId = Number(selectedDocTypeId);
        } else {
          const docRes = await fetch('/api/siigo/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ method: 'GET', endpoint: '/document-types?type=FV' })
          });
          const docJson = await docRes.json();
          const docTypes = docJson.data || docJson;
          if (Array.isArray(docTypes) && docTypes.length > 0) {
            // Prioritize document type with code 'FV-10' or name 'FV-10'
            const fv10Type = docTypes.find((d: any) => d.code === 'FV-10' || (d.name && d.name.includes('FV-10')) || (d.code && d.code.includes('FV-10')));
            const genericFv = docTypes.find((d: any) => d.type === 'FV' || d.document_type === 'FV' || (d.name && d.name.toLowerCase().includes('factura')));
            
            if (fv10Type && fv10Type.id) {
              docTypeId = fv10Type.id;
            } else if (genericFv && genericFv.id) {
              docTypeId = genericFv.id;
            } else if (docTypes[0].id) {
              docTypeId = docTypes[0].id;
            }
          }
        }

        const payRes = await fetch('/api/siigo/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ method: 'GET', endpoint: '/payment-types?document_type=FV' })
        });
        const payJson = await payRes.json();
        const payTypes = payJson.data || payJson;
        if (Array.isArray(payTypes) && payTypes.length > 0 && payTypes[0].id) {
          paymentId = payTypes[0].id;
        }

        const userRes = await fetch('/api/siigo/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ method: 'GET', endpoint: '/users' })
        });
        const userJson = await userRes.json();
        const usersList = userJson.data?.results || userJson.results || userJson.data || userJson;
        if (Array.isArray(usersList) && usersList.length > 0 && usersList[0].id) {
          sellerId = usersList[0].id;
        }
      } catch (e) {
        console.warn("Could not dynamically resolve doc/payment/seller types, using fallbacks:", e);
      }

      const salesToInvoice = salesList.filter(s => selectedSales.includes(s.id));
      let index = 0;

      for (const sale of salesToInvoice) {
        index++;
        setMassInvoicingProgress({
          current: index,
          total: salesToInvoice.length,
          currentTicket: `#${sale.consecutive}`,
          status: `Facturando ticket #${sale.consecutive} (${sale.client_name || 'Cliente'})...`,
          successCount,
          errorCount
        });

        try {
          // Format client names properly (First and Last name array for SIIGO)
          const rawName = (sale.client_name || 'Cliente Mostrador').trim();
          const nameParts = rawName.split(' ');
          const firstName = nameParts[0] || 'Cliente';
          const lastName = nameParts.slice(1).join(' ') || 'Mostrador';

          // Prepare SIIGO Invoice Payload strictly aligned with official SIIGO API v1 documentation
          const invoicePayload = {
            document: { id: docTypeId },
            date: new Date().toISOString().split('T')[0],
            customer: {
              person_type: 'Person',
              id_type: '13', // Cédula de Ciudadanía
              identification: sale.client_document && sale.client_document.length >= 5 ? sale.client_document.trim() : '222222222222',
              branch_office: 0,
              name: [firstName, lastName],
              address: {
                address: 'Calle 10 # 43',
                city: {
                  country_code: 'Co',
                  state_code: '11',
                  city_code: '11001'
                }
              },
              phones: [
                {
                  number: '3006003344'
                }
              ],
              contacts: [
                {
                  first_name: firstName,
                  last_name: lastName,
                  email: 'factura@tienda.com'
                }
              ]
            },
            items: sale.pos_sale_items?.length > 0 ? sale.pos_sale_items.map((item: any) => ({
              code: item.products?.codigo_referencia || 'PROD',
              description: item.products?.nombre_producto || 'Prenda POS',
              quantity: Number(item.cantidad) || 1,
              price: Number(item.precio_unitario) || Number(item.precio) || 0
            })) : [{
              code: 'VENTA',
              description: `Venta Ticket #${sale.consecutive}`,
              quantity: 1,
              price: Number(sale.total) || 0
            }],
            seller: sellerId ? sellerId : 1,
            payments: [{
              id: paymentId,
              value: Number(sale.total) || 0,
              due_date: new Date().toISOString().split('T')[0]
            }]
          };

          // Execute real request through proxy
          const response = await fetch('/api/siigo/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              method: 'POST',
              endpoint: '/invoices',
              payload: invoicePayload
            })
          });

          const resData = await response.json();

          // Strict validation: response must have HTTP 2xx success status or resData.success === true with valid invoice data
          if (response.ok && resData.success && (resData.data?.id || resData.data?.name || resData.data?.number)) {
            successCount++;
            const siigoInvNumber = resData.data?.name || resData.data?.number || resData.data?.id;
            await supabase
              .from('pos_sales')
              .update({ 
                sincronizado_erp: true,
                observaciones: `Facturado SIIGO Exitósamente: ${siigoInvNumber}`
              })
              .eq('id', sale.id);

            // Save success audit log entry
            try {
              await supabase.from('siigo_sync_logs').insert([{
                sale_id: sale.id,
                endpoint: '/invoices',
                status: 'success',
                request_body: invoicePayload,
                response_body: resData,
                error_message: null
              }]);
            } catch (lErr) {}
          } else {
            errorCount++;
            let errMsg = 'Error 400 de SIIGO';
            if (resData.details?.message) errMsg = resData.details.message;
            else if (resData.error) errMsg = typeof resData.error === 'string' ? resData.error : JSON.stringify(resData.error);
            else if (resData.message) errMsg = resData.message;
            else if (resData.data) errMsg = typeof resData.data === 'string' ? resData.data : JSON.stringify(resData.data);

            // Extract nested SIIGO validation errors array if available
            if (resData.details?.Errors && Array.isArray(resData.details.Errors)) {
              errMsg += ' — ' + resData.details.Errors.map((e: any) => `${e.Code || ''}: ${e.Message || e.Detail || ''}`).join(' | ');
            } else if (resData.data?.Errors && Array.isArray(resData.data.Errors)) {
              errMsg += ' — ' + resData.data.Errors.map((e: any) => `${e.Code || ''}: ${e.Message || e.Detail || ''}`).join(' | ');
            }

            errorsList.push(`Ticket #${sale.consecutive}: ${errMsg}`);
            
            // Mark sync status as failed with error details in observations
            await supabase
              .from('pos_sales')
              .update({ 
                sincronizado_erp: false,
                observaciones: `Error SIIGO: ${errMsg.substring(0, 200)}`
              })
              .eq('id', sale.id);

            // Save error audit log entry
            try {
              await supabase.from('siigo_sync_logs').insert([{
                sale_id: sale.id,
                endpoint: '/invoices',
                status: 'error',
                request_body: invoicePayload,
                response_body: resData,
                error_message: errMsg
              }]);
            } catch (lErr) {}
          }
        } catch (itemErr: any) {
          errorCount++;
          errorsList.push(`Ticket #${sale.consecutive}: ${itemErr.message || String(itemErr)}`);
        }

        setMassInvoicingProgress({
          current: index,
          total: salesToInvoice.length,
          currentTicket: `#${sale.consecutive}`,
          status: `Procesado ticket #${sale.consecutive}`,
          successCount,
          errorCount
        });
      }
      
      let summaryMsg = `📊 Resumen de Facturación SIIGO:\n\n✅ Exitosas: ${successCount}\n❌ Fallidas: ${errorCount}`;
      if (errorsList.length > 0) {
        summaryMsg += `\n\nDetalle de errores:\n` + errorsList.join('\n');
      }
      alert(summaryMsg);
      setSelectedSales([]);
      fetchData();
    } catch (err: any) {
      alert("Error al facturar masivamente: " + err.message);
    } finally {
      setInvoicingMass(false);
      setMassInvoicingProgress(null);
    }
  };

  const handleCreateCreditNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSaleForCN) return;
    setProcessingCreditNote(true);

    try {
      // 1. Prepare Credit Note Payload for SIIGO via Proxy route
      const cnPayload = {
        document: { id: 24 }, // Default credit note doc type code in SIIGO
        date: new Date().toISOString().split('T')[0],
        invoice: selectedSaleForCN.sincronizado_erp ? selectedSaleForCN.consecutive : undefined,
        customer: {
          identification: selectedSaleForCN.client_document || '222222222222',
          name: selectedSaleForCN.client_name || 'Cliente Mostrador'
        },
        items: selectedSaleForCN.pos_sale_items?.map((item: any) => ({
          code: item.products?.codigo_referencia || 'ITEM',
          description: item.products?.nombre_producto || 'Prenda POS',
          quantity: item.cantidad || 1,
          price: item.precio_unitario || (selectedSaleForCN.total / (selectedSaleForCN.pos_sale_items?.length || 1))
        })) || [],
        reason: creditNoteReason,
        type: creditNoteType
      };

      // 2. Call live SIIGO API proxy
      const response = await fetch('/api/siigo/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'POST',
          endpoint: '/credit-notes',
          payload: cnPayload
        })
      });

      const resData = await response.json();

      // 3. Mark sale as 'anulada' / credited in Supabase database
      const { error: dbErr } = await supabase
        .from('pos_sales')
        .update({
          estado: 'anulada',
          observaciones: `Nota Crédito generada: ${creditNoteReason} (Respuesta SIIGO: ${resData.success ? 'Exitosa' : resData.error || 'Procesado local'})`
        })
        .eq('id', selectedSaleForCN.id);

      if (dbErr) throw dbErr;

      // 4. Record entry in SIIGO sync log
      try {
        await supabase.from('siigo_sync_logs').insert([{
          sale_id: selectedSaleForCN.id,
          endpoint: '/v1/credit-notes',
          status: resData.success ? 'success' : 'warning',
          request_body: cnPayload,
          response_body: resData,
          error_message: resData.error || null
        }]);
      } catch (logErr) {
        console.warn("Could not log to siigo_sync_logs:", logErr);
      }

      alert(`✓ Nota Crédito procesada exitosamente para la venta #${selectedSaleForCN.consecutive}.`);
      setShowCreditNoteModal(false);
      setSelectedSaleForCN(null);
      fetchData();
    } catch (err: any) {
      alert('Error al generar la Nota Crédito: ' + (err.message || String(err)));
    } finally {
      setProcessingCreditNote(false);
    }
  };

  const handleOpenTrackingModal = async (sale: any) => {
    setSelectedSaleForTracking(sale);
    setShowTrackingModal(true);
    setLoadingTrackingLogs(true);
    try {
      const { data, error } = await supabase
        .from('siigo_sync_logs')
        .select('*')
        .eq('sale_id', sale.id)
        .order('created_at', { ascending: false });
      if (error) console.warn("Could not fetch siigo_sync_logs:", error);
      setSaleTrackingLogs(data || []);
    } catch (err) {
      console.error(err);
      setSaleTrackingLogs([]);
    } finally {
      setLoadingTrackingLogs(false);
    }
  };

  const handleTestSiigoAuth = async () => {
    setSiigoTestingAuth(true);
    setSiigoAuthStatus(null);
    try {
      const res = await fetch('/api/siigo/auth/test', { method: 'POST' });
      const data = await res.json();
      setSiigoAuthStatus(data);
    } catch (err: any) {
      setSiigoAuthStatus({ success: false, message: err.message || String(err) });
    } finally {
      setSiigoTestingAuth(false);
    }
  };

  const handleRunSiigoProxy = async () => {
    setSiigoTestLoading(true);
    setSiigoTestResponse(null);
    const start = Date.now();
    try {
      let parsedPayload = undefined;
      if (siigoTestMethod !== 'GET' && siigoTestPayload.trim()) {
        parsedPayload = JSON.parse(siigoTestPayload);
      }

      const res = await fetch('/api/siigo/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: siigoTestMethod,
          endpoint: siigoTestEndpoint.trim(),
          payload: parsedPayload
        })
      });

      const resData = await res.json();
      setSiigoTestResponse({
        status: res.status,
        statusText: res.statusText,
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
        body: resData
      });
    } catch (err: any) {
      setSiigoTestResponse({
        status: 500,
        statusText: 'Client Exception',
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
        body: { error: err.message || String(err) }
      });
    } finally {
      setSiigoTestLoading(false);
    }
  };

  const handleSaveStoreInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingStoreInv(true);
    try {
      const { data: storeStock } = await supabase
        .from('store_inventory')
        .select('*')
        .eq('store_id', storeInvForm.store_id)
        .eq('product_id', storeInvForm.product_id)
        .eq('size_id', storeInvForm.size_id)
        .is('color_id', storeInvForm.color_id ? storeInvForm.color_id : null);

      const currentQty = storeStock?.[0] ? Number(storeStock[0].cantidad_disponible) : 0;
      let newQty = currentQty;
      const adjustQty = Number(storeInvForm.cantidad);

      if (storeInvForm.type === 'ingreso') {
        newQty += adjustQty;
      } else if (storeInvForm.type === 'salida') {
        newQty = Math.max(0, newQty - adjustQty);
      } else if (storeInvForm.type === 'fijar') {
        newQty = adjustQty;
      }

      if (storeStock?.[0]) {
        await supabase
          .from('store_inventory')
          .update({ cantidad_disponible: newQty })
          .eq('id', storeStock[0].id);
      } else {
        await supabase
          .from('store_inventory')
          .insert({
            store_id: storeInvForm.store_id,
            product_id: storeInvForm.product_id,
            color_id: storeInvForm.color_id || null,
            size_id: storeInvForm.size_id,
            cantidad_disponible: newQty
          });
      }

      // Write store Kardex log
      await supabase.from('store_kardex').insert({
        store_id: storeInvForm.store_id,
        product_id: storeInvForm.product_id,
        color_id: storeInvForm.color_id || null,
        size_id: storeInvForm.size_id,
        tipo_movimiento: storeInvForm.type === 'ingreso' ? 'Ajuste Entrada' : storeInvForm.type === 'salida' ? 'Ajuste Salida' : 'Carga Inicial',
        cantidad: storeInvForm.type === 'salida' ? -adjustQty : adjustQty,
        saldo_anterior: currentQty,
        saldo_nuevo: newQty,
        documento_ref: 'Ajuste Administrativo',
        usuario: profile?.full_name || profile?.email || 'Admin'
      });

      alert("✓ Inventario de tienda ajustado con éxito.");
      setShowStoreInvModal(false);
      setStoreInvForm({ store_id: '', product_id: '', size_id: '', color_id: '', cantidad: 1, type: 'ingreso' });
      fetchData();
    } catch (err: any) {
      alert("Error ajustando inventario: " + err.message);
    } finally {
      setSavingStoreInv(false);
    }
  };

  const handleUpdateCategoryDiscount = async (listId: string, category: string, type: string, valueStr: string) => {
    const val = Number(valueStr);
    try {
      const existing = priceListItems.find(item => item.price_list_id === listId && item.categoria === category);
      if (isNaN(val) || val <= 0) {
        if (existing) {
          await supabase.from('pos_price_list_items').delete().eq('id', existing.id);
        }
      } else {
        if (existing) {
          await supabase.from('pos_price_list_items').update({ tipo_descuento: type, valor_descuento: val }).eq('id', existing.id);
        } else {
          await supabase.from('pos_price_list_items').insert([{
            price_list_id: listId,
            categoria: category,
            tipo_descuento: type,
            valor_descuento: val
          }]);
        }
      }
      alert("✓ Descuento de categoría actualizado.");
      fetchData();
    } catch (err: any) {
      alert("Error al actualizar descuento: " + err.message);
    }
  };

  const handleDeleteShift = async (id: string) => {
    if (!confirm("¿Seguro que deseas eliminar este turno programado?")) return;
    try {
      await supabase.from('store_staff_shifts').delete().eq('id', id);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Dashboard calculations
  const totalRevenue = salesList.reduce((sum, s) => sum + Number(s.total || 0), 0);
  const avgTicket = salesList.length > 0 ? (totalRevenue / salesList.length) : 0;
  const cashDiscrepancies = sessions.reduce((sum, s) => sum + Number(s.diferencia || 0), 0);

  // Sales by store
  const salesByStore = stores.map(store => {
    const storeSales = salesList.filter(s => s.store_id === store.id);
    const storeRevenue = storeSales.reduce((sum, s) => sum + Number(s.total || 0), 0);
    return {
      name: store.nombre,
      revenue: storeRevenue,
      salesCount: storeSales.length,
      avgTicket: storeSales.length > 0 ? (storeRevenue / storeSales.length) : 0
    };
  });

  // Sales by payment method
  const paymentMethodsTotal = salesList.reduce((acc: any, s) => {
    (s.pos_payments || []).forEach((p: any) => {
      const method = p.metodo_pago || 'Efectivo';
      acc[method] = (acc[method] || 0) + Number(p.monto || 0);
    });
    return acc;
  }, { Efectivo: 0, Tarjeta: 0, Transferencia: 0, Mixto: 0 });

  // UX Manager Handlers
  const handleSaveTheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!themeName) return alert('Por favor ingresa un nombre para el tema.');
    setSavingTheme(true);
    try {
      // If activating this theme, deactivate others in the same scope
      if (themeActive) {
        if (scopeSelection === 'store' && assignedStoreId) {
          await supabase
            .from('pos_themes')
            .update({ is_active: false })
            .eq('scope', 'store')
            .eq('store_id', assignedStoreId);
        } else if (scopeSelection === 'all') {
          await supabase
            .from('pos_themes')
            .update({ is_active: false })
            .eq('scope', 'all');
        }
      }

      const themePayload: any = {
        name: themeName,
        description: themeDescription,
        styles: editingStyles,
        scope: scopeSelection,
        store_id: scopeSelection === 'store' && assignedStoreId ? assignedStoreId : null,
        start_date: scopeSelection === 'campaign' && startDate ? startDate : null,
        end_date: scopeSelection === 'campaign' && endDate ? endDate : null,
        is_active: themeActive
      };

      if (selectedTheme?.id) {
        themePayload.id = selectedTheme.id;
      }

      const { error } = await supabase
        .from('pos_themes')
        .upsert(themePayload, { onConflict: 'name' });

      if (error) throw error;
      alert('✓ Tema visual guardado con éxito.');
      fetchData();
      setSelectedTheme(null);
    } catch (err: any) {
      alert('Error al guardar tema: ' + err.message);
    } finally {
      setSavingTheme(false);
    }
  };

  const handleToggleThemeActive = async (theme: any) => {
    try {
      if (!theme.is_active) {
        await supabase
          .from('pos_themes')
          .update({ is_active: false })
          .eq('scope', theme.scope);
      }

      const { error } = await supabase
        .from('pos_themes')
        .update({ is_active: !theme.is_active })
        .eq('id', theme.id);

      if (error) throw error;
      alert(`✓ Tema ${theme.name} ${!theme.is_active ? 'activado' : 'desactivado'} con éxito.`);
      fetchData();
    } catch (err: any) {
      alert('Error al cambiar estado del tema: ' + err.message);
    }
  };

  const handleDuplicateTheme = async (theme: any) => {
    try {
      const duplicatedPayload = {
        name: `${theme.name} (Copia - ${Math.floor(Math.random() * 900 + 100)})`,
        description: `Duplicado de: ${theme.description}`,
        styles: theme.styles,
        scope: theme.scope,
        store_id: theme.store_id,
        start_date: theme.start_date,
        end_date: theme.end_date,
        is_active: false
      };

      const { error } = await supabase
        .from('pos_themes')
        .insert([duplicatedPayload]);

      if (error) throw error;
      alert(`✓ Tema duplicado como "${theme.name} (Copia)".`);
      fetchData();
    } catch (err: any) {
      alert('Error al duplicar tema: ' + err.message);
    }
  };

  const handleDeleteTheme = async (themeId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este tema visual permanentemente?')) return;
    try {
      const { error } = await supabase
        .from('pos_themes')
        .delete()
        .eq('id', themeId);

      if (error) throw error;
      alert('✓ Tema eliminado con éxito.');
      fetchData();
    } catch (err: any) {
      alert('Error al eliminar tema: ' + err.message);
    }
  };

  // Platform admin restriction check
  const roleName = profile?.roles?.name?.toLowerCase() || '';
  const isPlatformAdmin = roleName === 'administrador de plataforma' || roleName.includes('admin');
  const isSuperUser = roleName.includes('super') || roleName.includes('admin master') || profile?.role_id === 'superadmin';

  useEffect(() => {
    if (profile) {
      if (!isPlatformAdmin && (activeTab === 'price_lists' || activeTab === 'promotions' || activeTab === 'sales_billing')) {
        setActiveTab('dashboard');
      }
      if (!isSuperUser && activeTab === 'ux_manager') {
        setActiveTab('dashboard');
      }
    }
  }, [activeTab, isPlatformAdmin, isSuperUser, profile]);

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'var(--text)', margin: 0 }}>Administración de Tiendas (POS)</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>Panel centralizado para control de sucursales, turnos de personal, listas de precios, terminales y arqueos comerciales</p>
        </div>

        {activeTab !== 'dashboard' && activeTab !== 'sessions' && activeTab !== 'sales_billing' && activeTab !== 'ux_manager' && (
          <button
            onClick={() => {
              if (activeTab === 'stores') setStoreForm({ id: '', codigo: '', nombre: '', direccion: '', ciudad: '', responsable: '', telefono: '', bodega_asociada_id: '', resolucion_nro: '', estado: 'activo' });
              else if (activeTab === 'registers') setRegisterForm({ id: '', store_id: '', codigo_caja: '', estado: 'cerrada' });
              else if (activeTab === 'promotions') setPromoForm({ id: '', nombre: '', tipo: 'Porcentaje', valor: 0, fecha_inicio: '', fecha_fin: '', activo: true });
              else if (activeTab === 'shifts') setShiftForm({ id: '', store_id: '', user_id: '', assigned_register_id: '', fecha: new Date().toISOString().split('T')[0], hora_entrada: '08:00', hora_salida: '17:00', estado: 'programado', observaciones: '' });
              else if (activeTab === 'price_lists') setPriceListForm({ id: '', nombre: '', descripcion: '', activo: true, tipo_descuento_global: 'valor', valor_descuento_global: '' });
              else if (activeTab === 'inventory_monitoring') setStoreInvForm({ store_id: '', product_id: '', size_id: '', color_id: '', cantidad: 1, type: 'ingreso' });
              
              if (activeTab === 'stores') setShowStoreModal(true);
              else if (activeTab === 'registers') setShowRegisterModal(true);
              else if (activeTab === 'promotions') setShowPromoModal(true);
              else if (activeTab === 'shifts') setShowShiftModal(true);
              else if (activeTab === 'price_lists') setShowPriceListModal(true);
              else if (activeTab === 'inventory_monitoring') setShowStoreInvModal(true);
            }}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '750' }}
          >
            <Plus size={16} /> {activeTab === 'inventory_monitoring' ? 'Ajustar Inventario' : 'Agregar nuevo'}
          </button>
        )}
      </div>

      {/* Tabs — Modern pill navigation */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
        {([
          { id: 'dashboard', label: 'Resumen Gerencial', icon: <BarChart3 size={14} /> },
          { id: 'stores', label: 'Sucursales', icon: <Store size={14} /> },
          { id: 'shifts', label: 'Turnos', icon: <Clock size={14} /> },
          { id: 'price_lists', label: 'Precios', icon: <Tag size={14} />, adminOnly: true },
          { id: 'registers', label: 'Cajas', icon: <CreditCard size={14} /> },
          { id: 'sessions', label: 'Sesiones y Arqueos', icon: <Activity size={14} /> },
          { id: 'promotions', label: 'Promociones', icon: <ShoppingBag size={14} />, adminOnly: true },
          { id: 'sales_billing', label: 'Facturación', icon: <DollarSign size={14} />, adminOnly: true },
          { id: 'ux_manager', label: 'Temas UX', icon: <Settings size={14} />, superAdminOnly: true },
          { id: 'chat_erp', label: 'Chat Puntos', icon: <Users size={14} /> }
        ] as Array<{id: string; label: string; icon: React.ReactNode; adminOnly?: boolean; superAdminOnly?: boolean}>).filter(t => 
          (!t.adminOnly || isPlatformAdmin) && (!t.superAdminOnly || isSuperUser)
        ).map(t => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => {
                setActiveTab(t.id as TabType);
                setSelectedPriceListPricing(null);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.9rem',
                fontWeight: isActive ? '800' : '600',
                fontSize: '0.78rem',
                border: isActive ? '1.5px solid #80082E' : '1.5px solid #e2e8f0',
                borderRadius: '20px',
                color: isActive ? '#fff' : 'var(--text-muted)',
                background: isActive ? 'linear-gradient(135deg, #80082E, #D81B60)' : '#fff',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
                boxShadow: isActive ? '0 2px 8px rgba(128,8,46,0.25)' : '0 1px 2px rgba(0,0,0,0.04)'
              }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.borderColor = '#80082E'; e.currentTarget.style.color = '#80082E'; e.currentTarget.style.background = 'rgba(128,8,46,0.04)'; } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = '#fff'; } }}
            >
              {t.icon} {t.label}
            </button>
          );
        })}
      </div>

      {/* Grid or Lists */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Loader2 size={36} className="animate-spin" style={{ color: 'var(--primary)' }} />
        </div>
      ) : (
        <>
          {/* DASHBOARD GERENCIAL TAB */}
          {activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {/* Executive KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                
                <div className="card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', border: '1px solid #bfdbfe' }}>
                  <div style={{ padding: '0.75rem', borderRadius: '12px', backgroundColor: 'white', color: '#1e40af' }}>
                    <DollarSign size={24} />
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ventas Totales</span>
                    <span style={{ fontSize: '1.5rem', fontWeight: '950', color: '#1e3a8a' }}>${totalRevenue.toLocaleString('es-CO')}</span>
                  </div>
                </div>

                <div className="card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', border: '1px solid #bbf7d0' }}>
                  <div style={{ padding: '0.75rem', borderRadius: '12px', backgroundColor: 'white', color: '#166534' }}>
                    <ShoppingBag size={24} />
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Transacciones</span>
                    <span style={{ fontSize: '1.5rem', fontWeight: '950', color: '#14532d' }}>{salesList.length}</span>
                  </div>
                </div>

                <div className="card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)', border: '1px solid #e9d5ff' }}>
                  <div style={{ padding: '0.75rem', borderRadius: '12px', backgroundColor: 'white', color: '#6b21a8' }}>
                    <Activity size={24} />
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#6b21a8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ticket Promedio</span>
                    <span style={{ fontSize: '1.5rem', fontWeight: '950', color: '#581c87' }}>${Math.round(avgTicket).toLocaleString('es-CO')}</span>
                  </div>
                </div>

                <div className="card" style={{
                  padding: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  background: Math.abs(cashDiscrepancies) > 0 ? 'linear-gradient(135deg, #fff5f5 0%, #fee2e2 100%)' : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                  border: Math.abs(cashDiscrepancies) > 0 ? '1px solid #fecaca' : '1px solid var(--border)'
                }}>
                  <div style={{ padding: '0.75rem', borderRadius: '12px', backgroundColor: 'white', color: Math.abs(cashDiscrepancies) > 0 ? '#c53030' : '#475569' }}>
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: Math.abs(cashDiscrepancies) > 0 ? '#9b2c2c' : '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Diferencia Caja</span>
                    <span style={{ fontSize: '1.5rem', fontWeight: '950', color: Math.abs(cashDiscrepancies) > 0 ? '#742a2a' : '#1e293b' }}>
                      {cashDiscrepancies > 0 ? `+` : ''}${cashDiscrepancies.toLocaleString('es-CO')}
                    </span>
                  </div>
                </div>

              </div>

              {/* Charts & Detail Widgets */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
                
                {/* Sales by Store */}
                <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '900', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>Ventas por Sucursal</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {salesByStore.map((st, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ fontWeight: '800' }}>{st.name}</span>
                          <span style={{ fontWeight: '950' }}>${st.revenue.toLocaleString('es-CO')} ({st.salesCount} vts)</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${totalRevenue > 0 ? (st.revenue / totalRevenue) * 100 : 0}%`,
                            height: '100%',
                            backgroundColor: 'var(--primary)',
                            borderRadius: '4px'
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sales by Payment Method */}
                <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '900', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>Métodos de Pago Utilizados</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    {Object.entries(paymentMethodsTotal).map(([method, val]: any) => (
                      <div key={method} style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>{method}</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: '900', color: '#0f172a' }}>${val.toLocaleString('es-CO')}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* STORES TAB */}
          {activeTab === 'stores' && (
            <div className="card" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden', backgroundColor: 'white', border: '1px solid var(--border)' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2.5px solid var(--border)', textAlign: 'left', backgroundColor: '#f8fafc' }}>
                      <th style={{ padding: '1rem' }}>Código</th>
                      <th style={{ padding: '1rem' }}>Nombre Sucursal</th>
                      <th style={{ padding: '1rem' }}>Ciudad / Dirección</th>
                      <th style={{ padding: '1rem' }}>Responsable</th>
                      <th style={{ padding: '1rem' }}>Bodega Producto Terminado</th>
                      <th style={{ padding: '1rem' }}>Resolución DIAN</th>
                      <th style={{ padding: '1rem' }}>Estado</th>
                      <th style={{ padding: '1rem', textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stores.map((s) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover:bg-slate-50">
                        <td style={{ padding: '1rem', fontWeight: '800' }}>{s.codigo}</td>
                        <td style={{ padding: '1rem', fontWeight: '750' }}>{s.nombre}</td>
                        <td style={{ padding: '1rem' }}>{s.ciudad} - {s.direccion}</td>
                        <td style={{ padding: '1rem', color: 'var(--primary)', fontWeight: '700' }}>{s.responsable || 'Sin asignar'}</td>
                        <td style={{ padding: '1rem' }}>{s.warehouses?.nombre_bodega || '—'}</td>
                        <td style={{ padding: '1rem' }}>{s.resolucion_nro || '—'}</td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            backgroundColor: s.estado === 'activo' ? '#dcfce7' : '#fee2e2',
                            color: s.estado === 'activo' ? '#166534' : '#991b1b'
                          }}>{s.estado}</span>
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <button
                            onClick={() => {
                              setStoreForm(s);
                              setShowStoreModal(true);
                            }}
                            style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', marginRight: '0.5rem', color: '#475569' }}
                          >
                            <Edit3 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STAFF SHIFTS TAB */}
          {activeTab === 'shifts' && (
            <div className="card" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden', backgroundColor: 'white', border: '1px solid var(--border)' }}>
              {shifts.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  <Users size={48} style={{ strokeWidth: 1, marginBottom: '1rem' }} />
                  <h4 style={{ margin: 0, fontWeight: '800' }}>No hay turnos programados</h4>
                  <p style={{ fontSize: '0.8rem', marginTop: '0.25rem', textAlign: 'center' }}>Crea un turno programado para controlar la asistencia del personal de caja.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2.5px solid var(--border)', textAlign: 'left', backgroundColor: '#f8fafc' }}>
                        <th style={{ padding: '1rem' }}>Fecha</th>
                        <th style={{ padding: '1rem' }}>Tienda / Sucursal</th>
                        <th style={{ padding: '1rem' }}>Empleado / Cajero</th>
                        <th style={{ padding: '1rem' }}>Horario Programado</th>
                        <th style={{ padding: '1rem' }}>Estado Asistencia</th>
                        <th style={{ padding: '1rem' }}>Observaciones</th>
                        <th style={{ padding: '1rem', textAlign: 'center' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shifts.map((sh) => {
                        const profileObj = profilesList.find(u => u.full_name === sh.user_id || u.email === sh.user_id || u.id === sh.user_id);
                        return (
                          <tr key={sh.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '1rem', fontWeight: '800' }}>{sh.fecha}</td>
                            <td style={{ padding: '1rem', fontWeight: '750' }}>{sh.stores?.nombre || '—'}</td>
                            <td style={{ padding: '1rem' }}>{profileObj ? (profileObj.full_name || profileObj.email) : sh.user_id}</td>
                            <td style={{ padding: '1rem', fontWeight: '700' }}><Clock size={12} style={{ marginRight: '0.25rem' }} /> {sh.hora_entrada.substring(0, 5)} - {sh.hora_salida.substring(0, 5)}</td>
                            <td style={{ padding: '1rem' }}>
                              <span style={{
                                padding: '0.25rem 0.5rem',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: '800',
                                backgroundColor: sh.estado === 'programado' ? '#e0f2fe' : sh.estado === 'cumplido' ? '#dcfce7' : sh.estado === 'tardanza' ? '#fef3c7' : '#fee2e2',
                                color: sh.estado === 'programado' ? '#0369a1' : sh.estado === 'cumplido' ? '#166534' : sh.estado === 'tardanza' ? '#b45309' : '#991b1b'
                              }}>{sh.estado.toUpperCase()}</span>
                            </td>
                            <td style={{ padding: '1rem', fontStyle: 'italic', color: '#64748b' }}>{sh.observaciones || '—'}</td>
                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                              <button
                                onClick={() => {
                                  setShiftForm(sh);
                                  setShowShiftModal(true);
                                }}
                                style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', marginRight: '0.5rem', color: '#475569' }}
                              >
                                <Edit3 size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteShift(sh.id)}
                                style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#991b1b' }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* PRICE LISTS TAB */}
          {activeTab === 'price_lists' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {/* Back button if in Pricing details view */}
              {selectedPriceListPricing && (
                <div style={{ display: 'flex', justifyItems: 'center', gap: '0.5rem' }}>
                  <button
                    onClick={() => setSelectedPriceListPricing(null)}
                    className="btn"
                    style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
                  >
                    ← Volver a Listas
                  </button>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900' }}>
                    Configurando Precios Especiales para: <span style={{ color: 'var(--primary)' }}>{selectedPriceListPricing.nombre}</span>
                  </h3>
                </div>
              )}

              {!selectedPriceListPricing ? (
                /* Master Price Lists Table */
                <div className="card" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden', backgroundColor: 'white', border: '1px solid var(--border)' }}>
                  {priceLists.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      <ListPlus size={48} style={{ strokeWidth: 1, marginBottom: '1rem' }} />
                      <h4 style={{ margin: 0, fontWeight: '800' }}>No hay listas de precios especiales</h4>
                      <p style={{ fontSize: '0.8rem', marginTop: '0.25rem', textAlign: 'center' }}>Crea listas de precios (Mayoristas, Convenios, Escuelas, etc.) para que se puedan utilizar en caja.</p>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '2.5px solid var(--border)', textAlign: 'left', backgroundColor: '#f8fafc' }}>
                            <th style={{ padding: '1rem' }}>Nombre de Lista</th>
                            <th style={{ padding: '1rem' }}>Descripción / Canal</th>
                            <th style={{ padding: '1rem' }}>Precios Configurados</th>
                            <th style={{ padding: '1rem' }}>Estado</th>
                            <th style={{ padding: '1rem', textAlign: 'center' }}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {priceLists.map((pl) => {
                            const customPricesCount = priceListItems.filter(item => item.price_list_id === pl.id).length;
                            return (
                              <tr key={pl.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '1rem', fontWeight: '800' }}>{pl.nombre}</td>
                                <td style={{ padding: '1rem' }}>{pl.descripcion || '—'}</td>
                                <td style={{ padding: '1rem', fontWeight: '700', color: 'var(--primary)' }}>{customPricesCount} prendas con precio especial</td>
                                <td style={{ padding: '1rem' }}>
                                  <span style={{
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '12px',
                                    fontSize: '0.75rem',
                                    fontWeight: '700',
                                    backgroundColor: pl.activo ? '#dcfce7' : '#fee2e2',
                                    color: pl.activo ? '#166534' : '#991b1b'
                                  }}>{pl.activo ? 'Activa' : 'Inactiva'}</span>
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                  <button
                                    onClick={() => setSelectedPriceListPricing(pl)}
                                    style={{
                                      padding: '0.4rem 0.85rem',
                                      borderRadius: '8px',
                                      backgroundColor: 'var(--primary)',
                                      color: 'white',
                                      border: 'none',
                                      fontWeight: '800',
                                      fontSize: '0.75rem',
                                      cursor: 'pointer',
                                      marginRight: '0.75rem'
                                    }}
                                  >
                                    Asignar Precios Especiales
                                  </button>
                                  <button
                                    onClick={() => {
                                      setPriceListForm({
                                        ...pl,
                                        valor_descuento_global: pl.valor_descuento_global ?? '',
                                        tipo_descuento_global: pl.tipo_descuento_global || 'valor'
                                      });
                                      setShowPriceListModal(true);
                                    }}
                                    style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#475569' }}
                                  >
                                    <Edit3 size={16} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                /* Edit pricing items per list view */
                <div className="card" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden', backgroundColor: 'white', border: '1px solid var(--border)' }}>
                  <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', backgroundColor: '#f8fafc' }}>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                      Escribe el descuento para cada categoría en esta lista. Si se deja en blanco, la caja usará el <strong>Precio Base General</strong> por defecto.
                    </p>
                  </div>
                  
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2.5px solid var(--border)', textAlign: 'left', backgroundColor: '#f8fafc' }}>
                          <th style={{ padding: '1rem' }}>Categoría</th>
                          <th style={{ padding: '1rem' }}>Tipo de Descuento</th>
                          <th style={{ padding: '1rem' }}>Valor a Descontar</th>
                          <th style={{ padding: '1rem', textAlign: 'center' }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from(new Set(products.map(p => p.categoria).filter(Boolean))).map((catName) => {
                          const cat = catName as string;
                          const inputKeyType = `${selectedPriceListPricing.id}_${cat}_type`;
                          const inputKeyVal = `${selectedPriceListPricing.id}_${cat}_val`;
                          
                          // Pre-fill existing value
                          const existing = priceListItems.find(item => item.price_list_id === selectedPriceListPricing.id && item.categoria === cat);
                          const currentType = pricingInputs[inputKeyType] || (existing ? existing.tipo_descuento : 'valor');
                          const currentVal = pricingInputs[inputKeyVal] !== undefined ? pricingInputs[inputKeyVal] : (existing ? existing.valor_descuento : '');
                          
                          return (
                            <tr key={cat} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '1rem', fontWeight: '800', color: 'var(--primary)' }}>{cat}</td>
                              <td style={{ padding: '1rem' }}>
                                <select
                                  value={currentType}
                                  onChange={e => setPricingInputs({ ...pricingInputs, [inputKeyType]: e.target.value })}
                                  style={{
                                    padding: '0.4rem 0.75rem',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border)',
                                    fontSize: '0.85rem',
                                    width: '150px'
                                  }}
                                >
                                  <option value="valor">Valor Fijo ($)</option>
                                  <option value="porcentaje">Porcentaje (%)</option>
                                </select>
                              </td>
                              <td style={{ padding: '1rem' }}>
                                <input
                                  type="number"
                                  placeholder={currentType === 'porcentaje' ? 'Ej: 10' : 'Ej: 5000'}
                                  value={currentVal}
                                  onChange={e => setPricingInputs({ ...pricingInputs, [inputKeyVal]: e.target.value })}
                                  style={{
                                    padding: '0.4rem 0.75rem',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border)',
                                    fontSize: '0.85rem',
                                    width: '130px',
                                    fontWeight: '700'
                                  }}
                                />
                              </td>
                              <td style={{ padding: '1rem', textAlign: 'center' }}>
                                <button
                                  onClick={() => handleUpdateCategoryDiscount(selectedPriceListPricing.id, cat, currentType, currentVal.toString())}
                                  style={{
                                    padding: '0.4rem 0.85rem',
                                    borderRadius: '6px',
                                    backgroundColor: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    fontWeight: '800',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Guardar
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* REGISTERS TAB */}
          {activeTab === 'registers' && (
            <div className="card" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden', backgroundColor: 'white', border: '1px solid var(--border)' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2.5px solid var(--border)', textAlign: 'left', backgroundColor: '#f8fafc' }}>
                      <th style={{ padding: '1rem' }}>Código Caja</th>
                      <th style={{ padding: '1rem' }}>Tienda / Sucursal</th>
                      <th style={{ padding: '1rem' }}>Estado Actual</th>
                      <th style={{ padding: '1rem', textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registers.map((r) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '1rem', fontWeight: '800' }}>{r.codigo_caja}</td>
                        <td style={{ padding: '1rem' }}>{r.stores?.nombre || '—'}</td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            backgroundColor: r.estado === 'abierta' ? '#dcfce7' : '#f1f5f9',
                            color: r.estado === 'abierta' ? '#166534' : '#475569'
                          }}>{r.estado.toUpperCase()}</span>
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <button
                            onClick={() => {
                              setRegisterForm(r);
                              setShowRegisterModal(true);
                            }}
                            style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#475569' }}
                          >
                            <Edit3 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SESSIONS TAB */}
          {activeTab === 'sessions' && (
            <div className="card" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden', backgroundColor: 'white', border: '1px solid var(--border)' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2.5px solid var(--border)', textAlign: 'left', backgroundColor: '#f8fafc' }}>
                      <th style={{ padding: '1rem' }}>Apertura</th>
                      <th style={{ padding: '1rem' }}>Sucursal / Caja</th>
                      <th style={{ padding: '1rem' }}>Cajero</th>
                      <th style={{ padding: '1rem' }}>Base Apertura</th>
                      <th style={{ padding: '1rem' }}>Cierre Esperado</th>
                      <th style={{ padding: '1rem' }}>Cierre Real</th>
                      <th style={{ padding: '1rem' }}>Diferencia / Arqueo</th>
                      <th style={{ padding: '1rem' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '1rem' }}>
                          {new Date(s.fecha_apertura).toLocaleString('es-CO')}
                        </td>
                        <td style={{ padding: '1rem', fontWeight: '750' }}>
                          {s.pos_registers?.stores?.nombre} - <span style={{ color: 'var(--primary)' }}>{s.pos_registers?.codigo_caja}</span>
                        </td>
                        <td style={{ padding: '1rem' }}>{s.usuario_apertura}</td>
                        <td style={{ padding: '1rem' }}>${s.monto_apertura.toLocaleString('es-CO')}</td>
                        <td style={{ padding: '1rem' }}>
                          {s.monto_cierre_esperado !== null ? `$${s.monto_cierre_esperado.toLocaleString('es-CO')}` : '—'}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          {s.monto_cierre_real !== null ? `$${s.monto_cierre_real.toLocaleString('es-CO')}` : '—'}
                        </td>
                        <td style={{ padding: '1rem', fontWeight: '800' }}>
                          {s.diferencia !== null ? (
                            <span style={{ color: s.diferencia === 0 ? '#166534' : '#991b1b' }}>
                              {s.diferencia > 0 ? `+` : ''}${s.diferencia.toLocaleString('es-CO')}
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            backgroundColor: s.estado === 'abierta' ? '#dcfce7' : '#f1f5f9',
                            color: s.estado === 'abierta' ? '#166534' : '#475569'
                          }}>{s.estado.toUpperCase()}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PROMOTIONS TAB */}
          {activeTab === 'promotions' && (
            <div className="card" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden', backgroundColor: 'white', border: '1px solid var(--border)' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2.5px solid var(--border)', textAlign: 'left', backgroundColor: '#f8fafc' }}>
                      <th style={{ padding: '1rem' }}>Nombre Promoción</th>
                      <th style={{ padding: '1rem' }}>Tipo</th>
                      <th style={{ padding: '1rem' }}>Valor Descuento</th>
                      <th style={{ padding: '1rem' }}>Vigencia</th>
                      <th style={{ padding: '1rem' }}>Estado</th>
                      <th style={{ padding: '1rem', textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {promotions.map((p) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '1rem', fontWeight: '800' }}>{p.nombre}</td>
                        <td style={{ padding: '1rem' }}>{p.tipo}</td>
                        <td style={{ padding: '1rem', fontWeight: '750', color: 'var(--primary)' }}>
                          {p.tipo === 'Porcentaje' ? `${p.valor}%` : `$${p.valor.toLocaleString('es-CO')}`}
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.8rem' }}>
                          {p.fecha_inicio ? new Date(p.fecha_inicio).toLocaleDateString() : '—'} a {p.fecha_fin ? new Date(p.fecha_fin).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            backgroundColor: p.activo ? '#dcfce7' : '#fee2e2',
                            color: p.activo ? '#166534' : '#991b1b'
                          }}>{p.activo ? 'Activa' : 'Inactiva'}</span>
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <button
                            onClick={() => {
                              setPromoForm({
                                ...p,
                                fecha_inicio: p.fecha_inicio ? p.fecha_inicio.substring(0, 10) : '',
                                fecha_fin: p.fecha_fin ? p.fecha_fin.substring(0, 10) : ''
                              });
                              setShowPromoModal(true);
                            }}
                            style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#475569' }}
                          >
                            <Edit3 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* INVENTORY MONITORING TAB */}
          {activeTab === 'inventory_monitoring' && (() => {
            const sQuery = invSearchQuery.trim().toLowerCase();
            const filteredInv = storeInventory.filter((item) => {
              // Store filter
              if (invStoreFilter !== 'all') {
                const matchedStore = stores.find(st => st.id === invStoreFilter);
                if (matchedStore) {
                  if (item.warehouse_id !== matchedStore.bodega_asociada_id) return false;
                } else if (item.warehouse_id !== invStoreFilter) {
                  return false;
                }
              }

              // Search query filter
              if (sQuery) {
                const pName = (item.products?.nombre_producto || '').toLowerCase();
                const pRef = (item.products?.codigo_referencia || '').toLowerCase();
                const cName = (item.colors?.nombre_color || '').toLowerCase();
                const cCode = (item.colors?.codigo_color || '').toLowerCase();
                const sCode = (item.sizes?.codigo_talla || '').toLowerCase();
                const sName = (item.sizes?.nombre_talla || '').toLowerCase();
                const whName = (item.warehouses?.nombre_bodega || '').toLowerCase();
                const matches = pName.includes(sQuery) || pRef.includes(sQuery) || cName.includes(sQuery) || cCode.includes(sQuery) || sCode.includes(sQuery) || sName.includes(sQuery) || whName.includes(sQuery);
                if (!matches) return false;
              }

              return true;
            });

            const totalUnits = filteredInv.reduce((sum, item) => sum + (Number(item.cantidad_disponible) || 0), 0);
            const distinctProducts = new Set(filteredInv.map(item => item.product_id)).size;
            const lowStockCount = filteredInv.filter(item => Number(item.cantidad_disponible) <= 5).length;
            const pageSize = 20;
            const totalPages = Math.ceil(filteredInv.length / pageSize);
            const paginatedInv = filteredInv.slice(invPage * pageSize, (invPage + 1) * pageSize);

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* KPI Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div className="card" style={{ padding: '1.25rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '14px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unidades Disponibles</span>
                    <span style={{ display: 'block', fontSize: '1.6rem', fontWeight: '950', color: '#14532d', marginTop: '0.25rem' }}>
                      {totalUnits.toLocaleString('es-CO')} <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>uds</span>
                    </span>
                  </div>

                  <div className="card" style={{ padding: '1.25rem', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '14px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Referencias con Stock</span>
                    <span style={{ display: 'block', fontSize: '1.6rem', fontWeight: '950', color: '#0c4a6e', marginTop: '0.25rem' }}>
                      {distinctProducts} <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>productos</span>
                    </span>
                  </div>

                  <div className="card" style={{ padding: '1.25rem', backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '14px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Variantes con Bajo Stock (≤ 5)</span>
                    <span style={{ display: 'block', fontSize: '1.6rem', fontWeight: '950', color: '#9a3412', marginTop: '0.25rem' }}>
                      {lowStockCount} <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>variantes</span>
                    </span>
                  </div>

                  <div className="card" style={{ padding: '1.25rem', backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '14px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#7e22ce', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Registros SKU</span>
                    <span style={{ display: 'block', fontSize: '1.6rem', fontWeight: '950', color: '#581c87', marginTop: '0.25rem' }}>
                      {filteredInv.length} <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>ítems</span>
                    </span>
                  </div>
                </div>

                {/* Filter and Search Controls */}
                <div className="card" style={{ padding: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', borderRadius: '14px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '280px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input
                        type="text"
                        placeholder="Buscar por referencia, nombre, color o talla..."
                        value={invSearchQuery}
                        onChange={(e) => { setInvSearchQuery(e.target.value); setInvPage(0); }}
                        style={{
                          width: '100%',
                          padding: '0.65rem 1rem 0.65rem 2.4rem',
                          borderRadius: '10px',
                          border: '1.5px solid var(--border)',
                          fontSize: '0.85rem',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: '800', color: '#64748b' }}>Tienda / Bodega:</label>
                    <select
                      value={invStoreFilter}
                      onChange={(e) => { setInvStoreFilter(e.target.value); setInvPage(0); }}
                      style={{
                        padding: '0.65rem 1rem',
                        borderRadius: '10px',
                        border: '1.5px solid var(--border)',
                        fontSize: '0.85rem',
                        fontWeight: '700',
                        backgroundColor: '#ffffff',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="all">Todas las tiendas ({stores.length})</option>
                      {stores.map(st => (
                        <option key={st.id} value={st.id}>
                          {st.nombre} {st.warehouses?.nombre_bodega ? `(${st.warehouses.nombre_bodega})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Stock Table */}
                <div className="card" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden', backgroundColor: 'white', border: '1px solid var(--border)' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2.5px solid var(--border)', textAlign: 'left', backgroundColor: '#f8fafc' }}>
                          <th style={{ padding: '1rem' }}>Sucursal / Bodega</th>
                          <th style={{ padding: '1rem' }}>Producto</th>
                          <th style={{ padding: '1rem' }}>Referencia</th>
                          <th style={{ padding: '1rem' }}>Color</th>
                          <th style={{ padding: '1rem' }}>Talla</th>
                          <th style={{ padding: '1rem', textAlign: 'right' }}>Stock Disponible</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedInv.map((item) => {
                          const matchedStore = stores.find(st => st.bodega_asociada_id === item.warehouse_id);
                          const storeLabel = matchedStore?.nombre || item.warehouses?.nombre_bodega || 'Bodega';
                          const isLow = Number(item.cantidad_disponible) <= 5;

                          return (
                            <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}>
                              <td style={{ padding: '1rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontWeight: '850', color: '#0f172a' }}>{storeLabel}</span>
                                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{item.warehouses?.nombre_bodega || 'Bodega'}</span>
                                </div>
                              </td>
                              <td style={{ padding: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                  {item.products?.imagen_url ? (
                                    <img src={item.products.imagen_url} alt="" style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0' }} />
                                  ) : (
                                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                      <Shirt size={18} />
                                    </div>
                                  )}
                                  <span style={{ fontWeight: '800', color: '#0f172a' }}>{item.products?.nombre_producto || 'Sin nombre'}</span>
                                </div>
                              </td>
                              <td style={{ padding: '1rem', fontWeight: '900', color: 'var(--primary)' }}>
                                {item.products?.codigo_referencia || '—'}
                              </td>
                              <td style={{ padding: '1rem' }}>
                                <span style={{
                                  backgroundColor: '#f1f5f9',
                                  color: '#334155',
                                  padding: '0.2rem 0.6rem',
                                  borderRadius: '6px',
                                  fontWeight: '750',
                                  fontSize: '0.78rem'
                                }}>
                                  {item.colors?.nombre_color || '—'}
                                </span>
                              </td>
                              <td style={{ padding: '1rem' }}>
                                <span style={{
                                  backgroundColor: '#f8fafc',
                                  border: '1px solid #e2e8f0',
                                  color: '#0f172a',
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '6px',
                                  fontWeight: '800',
                                  fontSize: '0.8rem'
                                }}>
                                  {item.sizes?.codigo_talla || item.sizes?.nombre_talla || '—'}
                                </span>
                              </td>
                              <td style={{ padding: '1rem', textAlign: 'right' }}>
                                <span style={{
                                  backgroundColor: isLow ? '#fef2f2' : '#ecfdf5',
                                  color: isLow ? '#dc2626' : '#059669',
                                  border: `1px solid ${isLow ? '#fecaca' : '#a7f3d0'}`,
                                  padding: '0.35rem 0.75rem',
                                  borderRadius: '8px',
                                  fontWeight: '900',
                                  fontSize: '0.88rem'
                                }}>
                                  {item.cantidad_disponible} uds
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        {paginatedInv.length === 0 && (
                          <tr>
                            <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                              <Package size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                              <p style={{ margin: 0, fontWeight: '700' }}>No se encontraron prendas en el inventario con los filtros seleccionados.</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', backgroundColor: '#f8fafc' }}>
                      <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '700' }}>
                        Mostrando {invPage * pageSize + 1} - {Math.min((invPage + 1) * pageSize, filteredInv.length)} de {filteredInv.length} registros
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => setInvPage(p => Math.max(0, p - 1))}
                          disabled={invPage === 0}
                          className="btn"
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', fontWeight: '750', backgroundColor: invPage === 0 ? '#e2e8f0' : '#ffffff', cursor: invPage === 0 ? 'not-allowed' : 'pointer' }}
                        >
                          Anterior
                        </button>
                        <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', fontSize: '0.8rem', fontWeight: '800', color: '#334155' }}>
                          Página {invPage + 1} de {totalPages}
                        </span>
                        <button
                          onClick={() => setInvPage(p => p + 1)}
                          disabled={invPage + 1 >= totalPages}
                          className="btn"
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', fontWeight: '750', backgroundColor: invPage + 1 >= totalPages ? '#e2e8f0' : '#ffffff', cursor: invPage + 1 >= totalPages ? 'not-allowed' : 'pointer' }}
                        >
                          Siguiente
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* SALES BILLING AND MASSIVE ERP INVOICING TAB */}
          {activeTab === 'sales_billing' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {/* Consolidation Cards for Selected Sales */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
                
                <div className="card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)', border: '1px solid #e9d5ff' }}>
                  <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#6b21a8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Monto Seleccionado</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: '950', color: '#581c87' }}>
                    ${salesList.filter(s => selectedSales.includes(s.id)).reduce((sum, s) => sum + Number(s.total || 0), 0).toLocaleString('es-CO')}
                  </span>
                </div>

                <div className="card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', border: '1px solid #bfdbfe' }}>
                  <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Seleccionadas</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: '950', color: '#1e3a8a' }}>
                    {selectedSales.length} transacciones
                  </span>
                </div>

                <div className="card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', border: '1px solid #bbf7d0' }}>
                  <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Facturados Exitosos (SIIGO)</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: '950', color: '#14532d', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle2 size={22} color="#16a34a" />
                    {salesList.filter(s => s.sincronizado_erp && s.estado !== 'anulada').length}
                  </span>
                </div>

                <div className="card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)', border: '1px solid #fecdd3' }}>
                  <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#9f1239', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pendientes / Con Error</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: '950', color: '#881337', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertTriangle size={22} color="#e11d48" />
                    {salesList.filter(s => !s.sincronizado_erp && s.estado !== 'anulada').length}
                  </span>
                </div>

                <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '0.7rem', fontWeight: '850', color: '#475569', textTransform: 'uppercase' }}>Tipo de Comprobante SIIGO</label>
                      <button
                        type="button"
                        onClick={async () => {
                          setShowDocTypesLibraryModal(true);
                          setDocTypesLibraryLoading(true);
                          try {
                            const res = await fetch('/api/siigo/proxy?endpoint=/document-types');
                            const json = await res.json();
                            setDocTypesLibraryList(json.data || json || []);
                          } catch (e) {
                            console.error(e);
                          } finally {
                            setDocTypesLibraryLoading(false);
                          }
                        }}
                        style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--primary)', fontSize: '0.72rem', fontWeight: '850', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                      >
                        📚 Ver Documentación / Biblioteca
                      </button>
                    </div>
                    <select
                      value={selectedDocTypeId}
                      onChange={(e) => setSelectedDocTypeId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.45rem 0.65rem',
                        borderRadius: '8px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '0.78rem',
                        fontWeight: '750',
                        backgroundColor: '#ffffff',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="auto">⚡ Detección Automática (Factura FV)</option>
                      {availableDocTypes.map((dt: any) => (
                        <option key={dt.id} value={dt.id}>
                          {dt.code || dt.id} - {dt.name} ({dt.type || 'FV'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={handleMassInvoicing}
                    disabled={selectedSales.length === 0 || invoicingMass}
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      fontWeight: '850',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 4px 12px rgba(249,115,22,0.25)'
                    }}
                  >
                    {invoicingMass ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                    Facturar Masivamente ({selectedSales.length})
                  </button>
                </div>

              </div>

              {/* LIVE REAL-TIME INVOICING PROGRESS FEED */}
              {massInvoicingProgress && (
                <div style={{
                  padding: '1.25rem',
                  borderRadius: '16px',
                  backgroundColor: '#0f172a',
                  color: 'white',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Loader2 size={18} className="animate-spin" color="#38bdf8" />
                      <span style={{ fontWeight: '850', fontSize: '0.9rem', color: '#f8fafc' }}>
                        Facturando en Vivo con SIIGO: Ticket {massInvoicingProgress.currentTicket} ({massInvoicingProgress.current} de {massInvoicingProgress.total})
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                      Progreso: {Math.round((massInvoicingProgress.current / massInvoicingProgress.total) * 100)}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ width: '100%', height: '8px', backgroundColor: '#334155', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${(massInvoicingProgress.current / massInvoicingProgress.total) * 100}%`,
                      backgroundColor: '#38bdf8',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                    <span style={{ color: '#cbd5e1' }}>{massInvoicingProgress.status}</span>
                    <div style={{ display: 'flex', gap: '1rem', fontWeight: '800' }}>
                      <span style={{ color: '#4ade80' }}>✅ Exitosas: {massInvoicingProgress.successCount}</span>
                      <span style={{ color: '#f87171' }}>❌ Con Error: {massInvoicingProgress.errorCount}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Buscador de Facturación */}
              <div style={{ display: 'flex', marginBottom: '1rem' }}>
                <input
                  type="text"
                  placeholder="Buscar por cliente, cédula, ticket o vendedor..."
                  value={billingSearch}
                  onChange={(e) => setBillingSearch(e.target.value)}
                  style={{ width: '100%', maxWidth: '400px', padding: '0.625rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem', outline: 'none' }}
                />
              </div>

              {/* Sales List Table with checkboxes */}
              <div className="card" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden', backgroundColor: 'white', border: '1px solid var(--border)' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2.5px solid var(--border)', textAlign: 'left', backgroundColor: '#f8fafc' }}>
                        <th style={{ padding: '1rem', width: '40px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={
                              salesList.filter(s => !billingSearch || s.client_name?.toLowerCase().includes(billingSearch.toLowerCase()) || s.client_document?.includes(billingSearch) || String(s.consecutive).includes(billingSearch) || s.vendedor?.toLowerCase().includes(billingSearch.toLowerCase())).length > 0 &&
                              selectedSales.length === salesList.filter(s => !billingSearch || s.client_name?.toLowerCase().includes(billingSearch.toLowerCase()) || s.client_document?.includes(billingSearch) || String(s.consecutive).includes(billingSearch) || s.vendedor?.toLowerCase().includes(billingSearch.toLowerCase())).length
                            }
                            onChange={(e) => {
                              const filtered = salesList.filter(s => !billingSearch || s.client_name?.toLowerCase().includes(billingSearch.toLowerCase()) || s.client_document?.includes(billingSearch) || String(s.consecutive).includes(billingSearch) || s.vendedor?.toLowerCase().includes(billingSearch.toLowerCase()));
                              if (e.target.checked) {
                                setSelectedSales(filtered.map(s => s.id));
                              } else {
                                setSelectedSales([]);
                              }
                            }}
                          />
                        </th>
                        <th style={{ padding: '1rem' }}>Ticket POS</th>
                        <th style={{ padding: '1rem' }}>Tienda</th>
                        <th style={{ padding: '1rem' }}>Cliente Persona</th>
                        <th style={{ padding: '1rem' }}>Detalle Prendas</th>
                        <th style={{ padding: '1rem', textAlign: 'right' }}>Total</th>
                        <th style={{ padding: '1rem' }}>Método Pago</th>
                        <th style={{ padding: '1rem', textAlign: 'center' }}>Estado ERP</th>
                        <th style={{ padding: '1rem', textAlign: 'center' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesList.filter(s => !billingSearch || s.client_name?.toLowerCase().includes(billingSearch.toLowerCase()) || s.client_document?.includes(billingSearch) || String(s.consecutive).includes(billingSearch) || s.vendedor?.toLowerCase().includes(billingSearch.toLowerCase())).map((sale) => (
                        <tr key={sale.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '1rem', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={selectedSales.includes(sale.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedSales([...selectedSales, sale.id]);
                                } else {
                                  setSelectedSales(selectedSales.filter(id => id !== sale.id));
                                }
                              }}
                            />
                          </td>
                          <td style={{ padding: '1rem', fontWeight: '800' }}>#{sale.consecutive}</td>
                          <td style={{ padding: '1rem', fontWeight: '700' }}>{sale.stores?.nombre}</td>
                          <td style={{ padding: '1rem' }}>
                            <span style={{ display: 'block', fontWeight: '750' }}>{sale.client_name}</span>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>C.C. {sale.client_document}</span>
                          </td>
                          <td style={{ padding: '1rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.75rem' }}>
                              {sale.pos_sale_items?.map((item: any) => (
                                <span key={item.id}>
                                  {item.cantidad}x {item.products?.nombre_producto} ({item.sizes?.codigo_talla || '—'})
                                </span>
                              ))}
                            </div>
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '800' }}>${sale.total.toLocaleString('es-CO')}</td>
                          <td style={{ padding: '1rem' }}>
                            {sale.pos_payments?.map((p: any) => p.metodo_pago).join(', ') || 'Efectivo'}
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center' }}>
                            <span style={{
                              padding: '0.25rem 0.5rem',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: '800',
                              backgroundColor: sale.estado === 'anulada' ? '#fee2e2' : (sale.sincronizado_erp ? '#dcfce7' : '#fef3c7'),
                              color: sale.estado === 'anulada' ? '#991b1b' : (sale.sincronizado_erp ? '#166534' : '#92400e')
                            }}>
                              {sale.estado === 'anulada' ? 'Anulada / NC' : (sale.sincronizado_erp ? 'Facturado / ERP' : 'Pendiente')}
                            </span>
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', alignItems: 'center' }}>
                              <button
                                onClick={() => handleOpenTrackingModal(sale)}
                                title="Ver historial de auditoría y trazabilidad SIIGO"
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.75rem',
                                  fontWeight: '850',
                                  backgroundColor: '#f1f5f9',
                                  color: '#334155',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem'
                                }}
                              >
                                <Activity size={12} />
                                Seguimiento
                              </button>
                              <button
                                onClick={async () => {
                                  setDebugPayloadSale(sale);
                                  setShowDebugPayloadModal(true);
                                  try {
                                    const { data } = await supabase
                                      .from('siigo_sync_logs')
                                      .select('*')
                                      .eq('sale_id', sale.id)
                                      .order('created_at', { ascending: false })
                                      .limit(1);
                                    if (data && data.length > 0) {
                                      setDebugPayloadContent({ request: data[0].request_body, response: data[0].response_body });
                                    } else {
                                      setDebugPayloadContent(null);
                                    }
                                  } catch (e) {
                                    setDebugPayloadContent(null);
                                  }
                                }}
                                title="Inspeccionar Payload JSON (Modo SuperAdmin Debug)"
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.75rem',
                                  fontWeight: '850',
                                  backgroundColor: '#0f172a',
                                  color: '#38bdf8',
                                  border: '1px solid #334155',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem'
                                }}
                              >
                                🔍 JSON Debug
                              </button>
                              {sale.estado !== 'anulada' ? (
                                <button
                                  onClick={() => {
                                    setSelectedSaleForCN(sale);
                                    setShowCreditNoteModal(true);
                                  }}
                                  style={{
                                    padding: '0.35rem 0.65rem',
                                    fontSize: '0.75rem',
                                    fontWeight: '850',
                                    backgroundColor: '#fee2e2',
                                    color: '#b91c1c',
                                    border: '1px solid #fca5a5',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem'
                                  }}
                                >
                                  <RefreshCw size={12} />
                                  Nota Crédito
                                </button>
                              ) : (
                                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '700' }}>Nota emitida</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SIIGO SERVICE DIAGNOSTICS & TRACKING PANEL */}
              <div className="card" style={{ padding: '1.5rem', borderRadius: '16px', backgroundColor: '#fafafa', border: '1.5px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.75rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '900', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Activity size={18} color="var(--primary)" />
                      Seguimiento y Pruebas en Vivo de Servicios SIIGO
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                      Módulo de prueba de API en tiempo real sin datos simulados (Integración Directa).
                    </p>
                  </div>
                  <button
                    onClick={handleTestSiigoAuth}
                    disabled={siigoTestingAuth}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.78rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    {siigoTestingAuth ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Probar Autenticación API
                  </button>
                </div>

                {siigoAuthStatus && (
                  <div style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    backgroundColor: siigoAuthStatus.success ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${siigoAuthStatus.success ? '#bbf7d0' : '#fecaca'}`,
                    color: siigoAuthStatus.success ? '#166534' : '#991b1b',
                    fontSize: '0.825rem',
                    fontWeight: '750'
                  }}>
                    {siigoAuthStatus.success ? '✓ ' : '✕ '} {siigoAuthStatus.message}
                    {siigoAuthStatus.token_preview && (
                      <code style={{ display: 'block', fontSize: '0.72rem', marginTop: '0.25rem', color: '#334155' }}>
                        Token: {siigoAuthStatus.token_preview}
                      </code>
                    )}
                  </div>
                )}

                {/* SIIGO Endpoint Interactive Console */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                  {/* Request Form */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', backgroundColor: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                    <span style={{ fontWeight: '850', fontSize: '0.825rem', color: '#0f172a' }}>⚡ Consola de Peticiones API</span>
                    
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <select
                        value={siigoTestMethod}
                        onChange={(e: any) => setSiigoTestMethod(e.target.value)}
                        style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: '800', fontSize: '0.8rem' }}
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                      </select>
                      <input
                        type="text"
                        value={siigoTestEndpoint}
                        onChange={(e) => setSiigoTestEndpoint(e.target.value)}
                        placeholder="/v1/customers o /v1/invoices"
                        style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', fontFamily: 'monospace' }}
                      />
                    </div>

                    {siigoTestMethod !== 'GET' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#475569', marginBottom: '0.25rem' }}>Payload JSON</label>
                        <textarea
                          rows={6}
                          value={siigoTestPayload}
                          onChange={(e) => setSiigoTestPayload(e.target.value)}
                          style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem', fontFamily: 'monospace', resize: 'vertical' }}
                        />
                      </div>
                    )}

                    <button
                      onClick={handleRunSiigoProxy}
                      disabled={siigoTestLoading}
                      className="btn btn-primary"
                      style={{ width: '100%', justifyContent: 'center', fontWeight: '850', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                      {siigoTestLoading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                      Enviar Petición a SIIGO
                    </button>
                  </div>

                  {/* Response Inspector (Raw JSON Viewer for Admins / SuperAdmins) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: '#0f172a', color: '#f8fafc', padding: '1rem', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>
                      <span style={{ fontWeight: '850', fontSize: '0.8rem', color: '#38bdf8' }}>
                        🖥️ Inspector de Respuesta SIIGO {(profile as any)?.isSuperUser || (profile as any)?.role_id === 'superadmin' ? '(Modo SuperAdmin)' : ''}
                      </span>
                      {siigoTestResponse && (
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                          HTTP {siigoTestResponse.status} • {siigoTestResponse.durationMs}ms
                        </span>
                      )}
                    </div>

                    <pre style={{
                      margin: 0,
                      flex: 1,
                      minHeight: '180px',
                      maxHeight: '280px',
                      overflowY: 'auto',
                      fontSize: '0.72rem',
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      color: siigoTestResponse?.status >= 400 ? '#fca5a5' : '#86efac'
                    }}>
                      {siigoTestResponse ? JSON.stringify(siigoTestResponse, null, 2) : '// Presiona "Enviar Petición" para inspeccionar la respuesta en vivo de los servidores de SIIGO...'}
                    </pre>
                  </div>
                </div>
              </div>

            </div>
          )}

          {activeTab === 'ux_manager' && (
            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2rem', alignItems: 'start' }}>
              {/* Left Column: List of Themes & Visual Builder Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                {/* Visual Themes Selector */}
                <div className="card" style={{ padding: '1.5rem', borderRadius: '16px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '900', color: '#0f172a', marginBottom: '1rem' }}>Temas Visuales</h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '200px', overflowY: 'auto', paddingRight: '0.5rem', marginBottom: '1rem' }}>
                    {themes.map(t => (
                      <div 
                        key={t.id} 
                        onClick={() => {
                          setSelectedTheme(t);
                          setThemeName(t.name);
                          setThemeDescription(t.description || '');
                          updateEditingStyles(t.styles || {});
                          setScopeSelection(t.scope);
                          setAssignedStoreId(t.store_id || '');
                          setStartDate(t.start_date ? t.start_date.split('T')[0] : '');
                          setEndDate(t.end_date ? t.end_date.split('T')[0] : '');
                          setThemeActive(t.is_active || false);
                        }}
                        style={{ 
                          padding: '0.75rem', 
                          borderRadius: '10px', 
                          border: selectedTheme?.id === t.id ? '2px solid var(--primary)' : '1px solid #e2e8f0',
                          backgroundColor: selectedTheme?.id === t.id ? '#fffaf8' : 'white',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: '800', fontSize: '0.85rem', color: '#0f172a' }}>{t.name}</div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{t.scope === 'all' ? 'Todas las tiendas' : t.scope === 'store' ? 'Tienda específica' : 'Campaña especial'}</div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                          <button 
                            onClick={() => handleToggleThemeActive(t)}
                            title={t.is_active ? "Desactivar tema" : "Activar tema"}
                            style={{ padding: '0.2rem', backgroundColor: t.is_active ? '#dcfce7' : '#f1f5f9', borderRadius: '4px', border: 'none' }}
                          >
                            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: t.is_active ? '#16a34a' : '#94a3b8' }} />
                          </button>
                          <button 
                            onClick={() => handleDuplicateTheme(t)}
                            title="Duplicar tema"
                            style={{ padding: '0.25rem', color: '#64748b' }}
                          >
                            <FolderOpen size={14} />
                          </button>
                          <button 
                            onClick={() => handleDeleteTheme(t.id)}
                            title="Eliminar tema"
                            style={{ padding: '0.25rem', color: '#ef4444' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button 
                    onClick={() => {
                      setSelectedTheme(null);
                      setThemeName('');
                      setThemeDescription('');
                      setThemeActive(false);
                      setEditingStyles({
                        colors: {
                          primary: '#f97316', secondary: '#475569', background: '#f8fafc', cards: '#ffffff',
                          buttons: '#f97316', menus: '#1e293b', tables: '#ffffff', titles: '#0f172a',
                          text: '#334155', icons: '#f97316', alerts: '#ef4444', success: '#10b981',
                          error: '#dc2626', warning: '#f59e0b'
                        },
                        typography: { fontFamily: 'Inter', fontSize: '14px', fontWeight: '500', letterSpacing: '0px' },
                        buttons: { borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', hoverScale: '1.02' },
                        cards: { borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' },
                        sidebar: { width: '260px', color: '#1e293b' }
                      });
                      setScopeSelection('all');
                    }}
                    className="btn btn-secondary" 
                    style={{ width: '100%', justifyContent: 'center', fontSize: '0.78rem', fontWeight: '800' }}
                  >
                    + Crear Nuevo Tema
                  </button>
                </div>

                {/* Import / Export Controls */}
                <div className="card" style={{ padding: '1rem 1.5rem', borderRadius: '16px', display: 'flex', gap: '0.5rem' }}>
                  <button 
                    onClick={() => {
                      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(editingStyles, null, 2));
                      const downloadAnchor = document.createElement('a');
                      downloadAnchor.setAttribute("href",     dataStr);
                      downloadAnchor.setAttribute("download", `${themeName || 'theme'}_config.json`);
                      document.body.appendChild(downloadAnchor);
                      downloadAnchor.click();
                      downloadAnchor.remove();
                    }}
                    className="btn" 
                    style={{ flex: 1, padding: '0.5rem', fontSize: '0.72rem', backgroundColor: '#f1f5f9', fontWeight: '800', justifyContent: 'center' }}
                  >
                    📥 Exportar JSON
                  </button>
                  <button 
                    onClick={() => {
                      const fileInput = document.createElement('input');
                      fileInput.type = 'file';
                      fileInput.accept = '.json';
                      fileInput.onchange = e => {
                        const file = (e.target as any).files[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = evt => {
                          try {
                            const parsed = JSON.parse(evt.target?.result as string);
                            setEditingStyles(parsed);
                            alert("✓ Tema importado exitosamente a la vista previa.");
                          } catch (err) {
                            alert("Error al parsear el archivo JSON.");
                          }
                        };
                        reader.readAsText(file);
                      };
                      fileInput.click();
                    }}
                    className="btn" 
                    style={{ flex: 1, padding: '0.5rem', fontSize: '0.72rem', backgroundColor: '#f1f5f9', fontWeight: '800', justifyContent: 'center' }}
                  >
                    📤 Importar JSON
                  </button>
                </div>

                {/* Theme Constructor Settings Form */}
                <div className="card" style={{ 
                  padding: '1.5rem', 
                  borderRadius: '16px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '1.25rem',
                  maxHeight: 'calc(100vh - 280px)',
                  overflowY: 'auto',
                  border: '1.5px solid #cbd5e1'
                }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '900', color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.75rem', margin: 0 }}>
                    {selectedTheme ? '🏷️ Editar Tema' : '🛠️ Constructor Visual'}
                  </h3>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '0.25rem' }}>Nombre del Tema</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ej: Brainer Classic"
                      value={themeName}
                      onChange={e => setThemeName(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '0.25rem' }}>Descripción</label>
                    <textarea 
                      placeholder="Breve descripción de la apariencia..."
                      value={themeDescription}
                      onChange={e => setThemeDescription(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.825rem', minHeight: '50px' }}
                    />
                  </div>

                  {/* Accordion Controls for Colors & Typography */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem', backgroundColor: '#f8fafc' }}>
                      <span style={{ fontWeight: '850', fontSize: '0.78rem', color: '#0f172a', display: 'block', marginBottom: '0.5rem' }}>🎨 Configurar Colores</span>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        {[
                          { label: 'Color Principal', key: 'primary' },
                          { label: 'Color Secundario', key: 'secondary' },
                          { label: 'Fondo General', key: 'background' },
                          { label: 'Fondo Tarjetas', key: 'cards' },
                          { label: 'Color Botones', key: 'buttons' },
                          { label: 'Color Textos', key: 'text' },
                          { label: 'Color Títulos', key: 'titles' },
                          { label: 'Color Bordes', key: 'border' },
                          { label: 'Color Transacción / Total Venta', key: 'transaction' }
                        ].map(c => (
                          <div key={c.key}>
                            <label style={{ display: 'block', fontSize: '0.65rem', color: '#64748b', fontWeight: '750', marginBottom: '0.15rem' }}>{c.label}</label>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              <input 
                                type="color" 
                                value={editingStyles.colors?.[c.key] || '#ffffff'}
                                onChange={e => {
                                  setEditingStyles({
                                    ...editingStyles,
                                    colors: { ...editingStyles.colors, [c.key]: e.target.value }
                                  });
                                }}
                                style={{ width: '24px', height: '24px', padding: 0, border: 'none', cursor: 'pointer', backgroundColor: 'transparent' }}
                              />
                              <input 
                                type="text"
                                value={editingStyles.colors?.[c.key] || ''}
                                onChange={e => {
                                  setEditingStyles({
                                    ...editingStyles,
                                    colors: { ...editingStyles.colors, [c.key]: e.target.value }
                                  });
                                }}
                                style={{ width: '100%', fontSize: '0.7rem', padding: '2px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem', backgroundColor: '#f8fafc' }}>
                      <span style={{ fontWeight: '850', fontSize: '0.78rem', color: '#0f172a', display: 'block', marginBottom: '0.5rem' }}>📐 Bordes y Componentes</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', fontWeight: '750' }}>Radio de Bordes (Cards)</label>
                          <select 
                            value={editingStyles.cards?.borderRadius || '16px'} 
                            onChange={e => setEditingStyles({ ...editingStyles, cards: { ...editingStyles.cards, borderRadius: e.target.value } })}
                            style={{ width: '100%', padding: '0.25rem', fontSize: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                          >
                            <option value="0px">Sin redondeo (Recto)</option>
                            <option value="6px">Suave (6px)</option>
                            <option value="12px">Redondo (12px)</option>
                            <option value="16px">Boutique (16px)</option>
                            <option value="24px">Muy redondo (24px)</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', fontWeight: '750' }}>Tipografía POS</label>
                          <select 
                            value={editingStyles.typography?.fontFamily || 'Inter'} 
                            onChange={e => setEditingStyles({ ...editingStyles, typography: { ...editingStyles.typography, fontFamily: e.target.value } })}
                            style={{ width: '100%', padding: '0.25rem', fontSize: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                          >
                            <option value="Inter">Inter (Clásica)</option>
                            <option value="Outfit">Outfit (Moderna)</option>
                            <option value="Roboto">Roboto (Limpia)</option>
                            <option value="monospace">Retro Terminal (Monospaced)</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', fontWeight: '750' }}>Tamaño de Letra</label>
                          <select 
                            value={editingStyles.typography?.fontSize || '14px'} 
                            onChange={e => setEditingStyles({ ...editingStyles, typography: { ...editingStyles.typography, fontSize: e.target.value } })}
                            style={{ width: '100%', padding: '0.25rem', fontSize: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                          >
                            <option value="12px">Pequeño (12px)</option>
                            <option value="13px">Mediano-Pequeño (13px)</option>
                            <option value="14px">Estándar (14px)</option>
                            <option value="15px">Mediano (15px)</option>
                            <option value="16px">Grande (16px)</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', fontWeight: '750' }}>Peso de Letra (Grosor)</label>
                          <select 
                            value={editingStyles.typography?.fontWeight || '500'} 
                            onChange={e => setEditingStyles({ ...editingStyles, typography: { ...editingStyles.typography, fontWeight: e.target.value } })}
                            style={{ width: '100%', padding: '0.25rem', fontSize: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                          >
                            <option value="300">Ligero (300)</option>
                            <option value="400">Regular (400)</option>
                            <option value="500">Medio (500)</option>
                            <option value="600">Seminegrita (600)</option>
                            <option value="700">Negrita (700)</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', fontWeight: '750' }}>Espaciado de Letra</label>
                          <select 
                            value={editingStyles.typography?.letterSpacing || '0px'} 
                            onChange={e => setEditingStyles({ ...editingStyles, typography: { ...editingStyles.typography, letterSpacing: e.target.value } })}
                            style={{ width: '100%', padding: '0.25rem', fontSize: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                          >
                            <option value="-0.5px">Condensado (-0.5px)</option>
                            <option value="0px">Normal (0px)</option>
                            <option value="0.5px">Espaciado (0.5px)</option>
                            <option value="1px">Amplio (1px)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* 🖼️ Logos y Branding POS */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem', backgroundColor: '#f8fafc' }}>
                      <span style={{ fontWeight: '850', fontSize: '0.78rem', color: '#0f172a', display: 'block', marginBottom: '0.5rem' }}>🖼️ Logos y Branding POS</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', fontWeight: '750' }}>Logo de la Tienda (URL)</label>
                          <input 
                            type="text" 
                            placeholder="https://example.com/logo-tienda.png"
                            value={editingStyles.logo?.store_logo_url || ''} 
                            onChange={e => setEditingStyles({ ...editingStyles, logo: { ...editingStyles.logo, store_logo_url: e.target.value } })}
                            style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#ffffff' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', fontWeight: '750' }}>Logo de la Plataforma (URL)</label>
                          <input 
                            type="text" 
                            placeholder="https://example.com/logo-plataforma.png"
                            value={editingStyles.logo?.platform_logo_url || ''} 
                            onChange={e => setEditingStyles({ ...editingStyles, logo: { ...editingStyles.logo, platform_logo_url: e.target.value } })}
                            style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#ffffff' }}
                          />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', fontWeight: '750' }}>Texto de Cabecera</label>
                            <input 
                              type="text" 
                              placeholder="Breiner"
                              value={editingStyles.logo?.headerText ?? 'Breiner'} 
                              onChange={e => setEditingStyles({ ...editingStyles, logo: { ...editingStyles.logo, headerText: e.target.value } })}
                              style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#ffffff' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', fontWeight: '750' }}>Color del Texto</label>
                            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                              <input 
                                type="color" 
                                value={editingStyles.logo?.headerTextColor || '#80082E'} 
                                onChange={e => setEditingStyles({ ...editingStyles, logo: { ...editingStyles.logo, headerTextColor: e.target.value } })}
                                style={{ width: '28px', height: '24px', padding: 0, border: 'none', cursor: 'pointer', backgroundColor: 'transparent' }}
                              />
                              <input 
                                type="text"
                                value={editingStyles.logo?.headerTextColor || '#80082E'} 
                                onChange={e => setEditingStyles({ ...editingStyles, logo: { ...editingStyles.logo, headerTextColor: e.target.value } })}
                                style={{ flex: 1, padding: '0.25rem 0.4rem', fontSize: '0.7rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                              />
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', fontWeight: '750' }}>Tamaño de Texto</label>
                            <select 
                              value={editingStyles.logo?.headerTextSize || '20px'} 
                              onChange={e => setEditingStyles({ ...editingStyles, logo: { ...editingStyles.logo, headerTextSize: e.target.value } })}
                              style={{ width: '100%', padding: '0.25rem', fontSize: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#ffffff' }}
                            >
                              <option value="14px">Pequeño (14px)</option>
                              <option value="16px">Medio (16px)</option>
                              <option value="18px">Normal (18px)</option>
                              <option value="20px">Grande (20px)</option>
                              <option value="24px">Muy Grande (24px)</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', fontWeight: '750' }}>Ubicación Texto</label>
                            <select 
                              value={editingStyles.logo?.headerTextPlacement || 'right'} 
                              onChange={e => setEditingStyles({ ...editingStyles, logo: { ...editingStyles.logo, headerTextPlacement: e.target.value } })}
                              style={{ width: '100%', padding: '0.25rem', fontSize: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#ffffff' }}
                            >
                              <option value="right">Derecha del Logo</option>
                              <option value="left">Izquierda del Logo</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 🗂️ Íconos de Barra Lateral POS */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem', backgroundColor: '#f8fafc' }}>
                      <span style={{ fontWeight: '850', fontSize: '0.78rem', color: '#0f172a', display: 'block', marginBottom: '0.5rem' }}>🗂️ Íconos de Barra Lateral POS</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', fontWeight: '750' }}>Ícono Ventas</label>
                          <select 
                            value={editingStyles.sidebar?.icon_ventas || 'ShoppingCart'} 
                            onChange={e => setEditingStyles({ ...editingStyles, sidebar: { ...editingStyles.sidebar, icon_ventas: e.target.value } })}
                            style={{ width: '100%', padding: '0.25rem', fontSize: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#ffffff' }}
                          >
                            <option value="ShoppingCart">Carrito (ShoppingCart)</option>
                            <option value="ShoppingBag">Bolsa (ShoppingBag)</option>
                            <option value="Tag">Etiqueta (Tag)</option>
                            <option value="CreditCard">Tarjeta (CreditCard)</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', fontWeight: '750' }}>Ícono Turnos</label>
                          <select 
                            value={editingStyles.sidebar?.icon_turnos || 'Clock'} 
                            onChange={e => setEditingStyles({ ...editingStyles, sidebar: { ...editingStyles.sidebar, icon_turnos: e.target.value } })}
                            style={{ width: '100%', padding: '0.25rem', fontSize: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#ffffff' }}
                          >
                            <option value="Clock">Reloj (Clock)</option>
                            <option value="Lock">Cerrar (Lock)</option>
                            <option value="Unlock">Abrir (Unlock)</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', fontWeight: '750' }}>Ícono Reportes</label>
                          <select 
                            value={editingStyles.sidebar?.icon_reportes || 'FileText'} 
                            onChange={e => setEditingStyles({ ...editingStyles, sidebar: { ...editingStyles.sidebar, icon_reportes: e.target.value } })}
                            style={{ width: '100%', padding: '0.25rem', fontSize: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#ffffff' }}
                          >
                            <option value="FileText">Reportes Texto (FileText)</option>
                            <option value="BarChart">Gráfico Barras (BarChart)</option>
                            <option value="TrendingUp">Tendencia (TrendingUp)</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', fontWeight: '750' }}>Ícono Más</label>
                          <select 
                            value={editingStyles.sidebar?.icon_mas || 'MoreHorizontal'} 
                            onChange={e => setEditingStyles({ ...editingStyles, sidebar: { ...editingStyles.sidebar, icon_mas: e.target.value } })}
                            style={{ width: '100%', padding: '0.25rem', fontSize: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#ffffff' }}
                          >
                            <option value="MoreHorizontal">Puntos (MoreHorizontal)</option>
                            <option value="Settings">Ajustes (Settings)</option>
                            <option value="HelpCircle">Ayuda (HelpCircle)</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.68rem', color: '#64748b', fontWeight: '750' }}>Tamaño de Íconos (px)</label>
                          <select 
                            value={editingStyles.sidebar?.iconSize || '20'} 
                            onChange={e => setEditingStyles({ ...editingStyles, sidebar: { ...editingStyles.sidebar, iconSize: e.target.value } })}
                            style={{ width: '100%', padding: '0.25rem', fontSize: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#ffffff' }}
                          >
                            <option value="20">Normal (20px)</option>
                            <option value="24">Grande (24px)</option>
                            <option value="28">Muy Grande (28px)</option>
                            <option value="32">Extra Grande (32px)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Scope & Scheduling */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '0.35rem' }}>Asignación de Tienda</label>
                    <select 
                      value={scopeSelection}
                      onChange={e => setScopeSelection(e.target.value as any)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', marginBottom: '0.5rem' }}
                    >
                      <option value="all">Todas las tiendas (Global)</option>
                      <option value="store">Tienda específica</option>
                      <option value="campaign">Campaña Temporal (Fecha)</option>
                    </select>

                    {scopeSelection === 'store' && (
                      <select
                        value={assignedStoreId}
                        onChange={e => setAssignedStoreId(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      >
                        <option value="">Selecciona una tienda...</option>
                        {stores.map(st => <option key={st.id} value={st.id}>{st.nombre}</option>)}
                      </select>
                    )}

                    {scopeSelection === 'campaign' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.65rem', color: '#64748b' }}>Inicio</label>
                          <input 
                            type="date" 
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            style={{ width: '100%', padding: '0.35rem', fontSize: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.65rem', color: '#64748b' }}>Fin</label>
                          <input 
                            type="date" 
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            style={{ width: '100%', padding: '0.35rem', fontSize: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.75rem 0' }}>
                    <input 
                      type="checkbox" 
                      id="themeActiveCheckbox"
                      checked={themeActive} 
                      onChange={e => setThemeActive(e.target.checked)} 
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                    <label htmlFor="themeActiveCheckbox" style={{ fontSize: '0.78rem', fontWeight: '850', color: '#1e293b', cursor: 'pointer' }}>
                      Activar este tema inmediatamente
                    </label>
                  </div>

                  <button 
                    onClick={handleSaveTheme}
                    disabled={savingTheme}
                    className="btn btn-primary" 
                    style={{ width: '100%', justifyContent: 'center', fontWeight: '800', marginTop: '0.5rem' }}
                  >
                    {savingTheme ? 'Guardando...' : (selectedTheme ? 'Actualizar Tema' : 'Publicar Tema')}
                  </button>
                </div>
              </div>

              {/* Right Column: Live Simulator Viewport */}
              <div className="card" style={{ padding: '2rem', borderRadius: '20px', backgroundColor: '#f1f5f9', display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: '650px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #cbd5e1', paddingBottom: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '950', color: '#0f172a', margin: 0 }}>Simulador en Tiempo Real</h3>
                    <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>Elige una pantalla y observa cómo cambian la tipografía y los colores de manera interactiva</p>
                  </div>

                  {/* Simulator Screen Selectors */}
                  <div style={{ display: 'flex', backgroundColor: '#e2e8f0', padding: '0.2rem', borderRadius: '8px' }}>
                    {[
                      { id: 'dashboard', label: '📊 Dashboard' },
                      { id: 'pos', label: '🛒 POS (Ventas)' },
                      { id: 'login', label: '🔑 Login' },
                      { id: 'inventario', label: '📦 Inventario' }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setPreviewTab(tab.id as any)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: '800',
                          border: 'none',
                          backgroundColor: previewTab === tab.id ? 'white' : 'transparent',
                          color: previewTab === tab.id ? '#0f172a' : '#64748b',
                          cursor: 'pointer',
                          boxShadow: previewTab === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Interactive Mockup Container */}
                <div 
                  style={{ 
                    flex: 1, 
                    borderRadius: editingStyles.cards?.borderRadius || '16px', 
                    backgroundColor: editingStyles.colors?.background || '#f8fafc', 
                    border: `1.5px solid ${editingStyles.colors?.border || '#cbd5e1'}`, 
                    boxShadow: editingStyles.cards?.boxShadow || '0 4px 6px rgba(0,0,0,0.05)',
                    fontFamily: editingStyles.typography?.fontFamily || 'Inter',
                    fontSize: editingStyles.typography?.fontSize || '14px',
                    color: editingStyles.colors?.text || '#334155',
                    padding: '1.5rem',
                    overflowY: 'auto',
                    position: 'relative'
                  }}
                >
                  {/* SIMULATOR SCREEN: DASHBOARD */}
                  {previewTab === 'dashboard' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ color: editingStyles.colors?.titles || '#0f172a', fontWeight: '850', fontSize: '1.1rem', margin: 0 }}>Resumen de Producción</h4>
                        <span style={{ fontSize: '0.75rem', color: editingStyles.colors?.secondary || '#64748b' }}>Sucursal Principal</span>
                      </div>

                      {/* Mini KPIs Widgets */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                        {[
                          { label: 'Ventas de Hoy', value: '$2,450,000', color: editingStyles.colors?.success || '#10b981' },
                          { label: 'Ordenes Activas', value: '14 Lotes', color: editingStyles.colors?.primary || '#f97316' },
                          { label: 'Errores / Rechazos', value: '2 uds', color: editingStyles.colors?.error || '#dc2626' }
                        ].map((w, idx) => (
                          <div 
                            key={idx} 
                            style={{ 
                              backgroundColor: editingStyles.colors?.cards || '#ffffff', 
                              padding: '0.75rem', 
                              borderRadius: editingStyles.cards?.borderRadius || '10px',
                              border: `1px solid ${editingStyles.colors?.border || '#cbd5e1'}`
                            }}
                          >
                            <div style={{ fontSize: '0.625rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '800' }}>{w.label}</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: '950', marginTop: '0.2rem', color: w.color }}>{w.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Simulated Chart & Metrics List */}
                      <div 
                        style={{ 
                          backgroundColor: editingStyles.colors?.cards || '#ffffff', 
                          padding: '1rem', 
                          borderRadius: editingStyles.cards?.borderRadius || '12px',
                          border: `1px solid ${editingStyles.colors?.border || '#cbd5e1'}`
                        }}
                      >
                        <span style={{ fontSize: '0.75rem', fontWeight: '800', color: editingStyles.colors?.titles || '#0f172a', display: 'block', marginBottom: '0.5rem' }}>Rendimiento Mensual</span>
                        <div style={{ height: '80px', display: 'flex', alignItems: 'flex-end', gap: '0.5rem', padding: '0.5rem 0', borderBottom: '1px solid #cbd5e1' }}>
                          <div style={{ flex: 1, height: '40%', backgroundColor: editingStyles.colors?.primary || '#f97316', borderRadius: '4px' }} />
                          <div style={{ flex: 1, height: '75%', backgroundColor: editingStyles.colors?.primary || '#f97316', borderRadius: '4px' }} />
                          <div style={{ flex: 1, height: '90%', backgroundColor: editingStyles.colors?.primary || '#f97316', borderRadius: '4px' }} />
                          <div style={{ flex: 1, height: '60%', backgroundColor: editingStyles.colors?.primary || '#f97316', borderRadius: '4px' }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SIMULATOR SCREEN: POS SALES */}
                  {previewTab === 'pos' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                      
                      {/* Products Grid Column */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input 
                            type="text" 
                            disabled
                            placeholder="Buscar producto por referencia..." 
                            style={{ flex: 1, padding: '0.4rem 0.6rem', border: `1px solid ${editingStyles.colors?.border || '#cbd5e1'}`, borderRadius: '6px', fontSize: '0.75rem' }}
                          />
                          <button style={{ backgroundColor: editingStyles.colors?.buttons || '#f97316', color: 'white', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.75rem', border: 'none', fontWeight: '850' }}>Filtrar</button>
                        </div>

                        {/* Sample Products Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                          {[
                            { name: 'Jean Skinny Fit Blue', price: '$85.000', ref: 'JSFB-01' },
                            { name: 'Camisa Lino Blanca', price: '$72.000', ref: 'CLB-02' }
                          ].map((p, idx) => (
                            <div 
                              key={idx}
                              style={{ 
                                backgroundColor: editingStyles.colors?.cards || '#ffffff', 
                                padding: '0.6rem', 
                                borderRadius: editingStyles.cards?.borderRadius || '8px',
                                border: `1px solid ${editingStyles.colors?.border || '#cbd5e1'}`,
                                cursor: 'pointer'
                              }}
                            >
                              <div style={{ fontWeight: '850', fontSize: '0.75rem', color: editingStyles.colors?.titles || '#0f172a' }}>{p.name}</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
                                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{p.ref}</span>
                                <span style={{ fontSize: '0.78rem', fontWeight: '950', color: editingStyles.colors?.primary || '#f97316' }}>{p.price}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Shopping Cart Summary Column */}
                      <div 
                        style={{ 
                          backgroundColor: editingStyles.colors?.cards || '#ffffff', 
                          border: `1.5px solid ${editingStyles.colors?.border || '#cbd5e1'}`,
                          borderRadius: editingStyles.cards?.borderRadius || '12px',
                          padding: '0.75rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem'
                        }}
                      >
                        <span style={{ fontWeight: '950', fontSize: '0.8rem', color: editingStyles.colors?.titles || '#0f172a' }}>Detalle de Venta</span>
                        <div style={{ flex: 1, borderBottom: `1px solid ${editingStyles.colors?.border || '#cbd5e1'}`, paddingBottom: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                            <span>1x Jean Skinny Fit Blue</span>
                            <span style={{ fontWeight: '750' }}>$85.000</span>
                          </div>
                        </div>

                        {/* Order Action Buttons */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: '900' }}>
                            <span>Total</span>
                            <span style={{ color: editingStyles.colors?.primary || '#f97316' }}>$85.000</span>
                          </div>
                          <button style={{ width: '100%', padding: '0.4rem', border: 'none', backgroundColor: editingStyles.colors?.buttons || '#f97316', color: 'white', fontWeight: '850', borderRadius: '6px', fontSize: '0.72rem', cursor: 'pointer' }}>Cobrar Factura</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SIMULATOR SCREEN: LOGIN */}
                  {previewTab === 'login' && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '220px' }}>
                      <div 
                        style={{ 
                          width: '100%', 
                          maxWidth: '280px', 
                          backgroundColor: editingStyles.colors?.cards || '#ffffff', 
                          padding: '1.25rem', 
                          borderRadius: editingStyles.cards?.borderRadius || '16px',
                          border: `1px solid ${editingStyles.colors?.border || '#cbd5e1'}`,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem'
                        }}
                      >
                        <div style={{ textAlign: 'center', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '1rem', fontWeight: '950', color: editingStyles.colors?.primary || '#f97316' }}>BREINER</span>
                          <span style={{ display: 'block', fontSize: '0.625rem', color: '#64748b', fontWeight: '600' }}>Ingreso al Punto de Venta</span>
                        </div>

                        <div>
                          <input 
                            type="text" 
                            disabled 
                            placeholder="Usuario o Email" 
                            style={{ width: '100%', padding: '0.4rem', border: `1px solid ${editingStyles.colors?.border || '#cbd5e1'}`, borderRadius: '6px', fontSize: '0.72rem' }}
                          />
                        </div>
                        <div>
                          <input 
                            type="password" 
                            disabled 
                            placeholder="Contraseña" 
                            style={{ width: '100%', padding: '0.4rem', border: `1px solid ${editingStyles.colors?.border || '#cbd5e1'}`, borderRadius: '6px', fontSize: '0.72rem' }}
                          />
                        </div>

                        <button style={{ width: '100%', padding: '0.45rem', border: 'none', backgroundColor: editingStyles.colors?.buttons || '#f97316', color: 'white', fontWeight: '850', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer' }}>Iniciar Sesión</button>
                      </div>
                    </div>
                  )}

                  {/* SIMULATOR SCREEN: INVENTORY */}
                  {previewTab === 'inventario' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: '900', color: editingStyles.colors?.titles || '#0f172a' }}>Inventario de Tienda</span>
                        <span style={{ fontSize: '0.68rem', padding: '2px 8px', backgroundColor: '#e0f2fe', color: '#0369a1', borderRadius: '999px', fontWeight: '800' }}>42 uds en Stock</span>
                      </div>

                      {/* Mock Table */}
                      <div style={{ border: `1px solid ${editingStyles.colors?.border || '#cbd5e1'}`, borderRadius: '8px', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: `1.5px solid ${editingStyles.colors?.border || '#cbd5e1'}`, textAlign: 'left' }}>
                              <th style={{ padding: '0.4rem 0.6rem' }}>Producto</th>
                              <th style={{ padding: '0.4rem 0.6rem', textAlign: 'center' }}>Talla / Color</th>
                              <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>Stock Físico</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              { name: 'Jean Skinny Fit Blue', spec: 'Talla 30 / Azul', stock: '24' },
                              { name: 'Camisa Lino Blanca', spec: 'Talla M / Blanco', stock: '18' }
                            ].map((row, idx) => (
                              <tr key={idx} style={{ borderBottom: `1px solid ${editingStyles.colors?.border || '#cbd5e1'}`, backgroundColor: editingStyles.colors?.cards || '#ffffff' }}>
                                <td style={{ padding: '0.4rem 0.6rem', fontWeight: '750' }}>{row.name}</td>
                                <td style={{ padding: '0.4rem 0.6rem', textAlign: 'center', color: '#64748b' }}>{row.spec}</td>
                                <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', fontWeight: '800', color: editingStyles.colors?.success || '#10b981' }}>{row.stock} uds</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Dynamic Preview Indicator Label at bottom */}
                  <div style={{ position: 'absolute', bottom: '0.5rem', right: '0.5rem', fontSize: '0.625rem', fontWeight: '800', opacity: '0.4', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Breiner POS Simulator v3
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* PRICE LIST CREATION MODAL */}
      {showPriceListModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: '90%', maxWidth: '400px', padding: '2rem', borderRadius: '16px', backgroundColor: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: '900' }}>{priceListForm.id ? 'Editar Lista de Precios' : 'Nueva Lista de Precios'}</h3>
              <button onClick={() => setShowPriceListModal(false)} style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSavePriceList} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Nombre de la Lista</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Lista Mayoristas"
                  value={priceListForm.nombre}
                  onChange={e => setPriceListForm({ ...priceListForm, nombre: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Descripción / Canal</label>
                <textarea
                  placeholder="Ej: Lista de precios especial para ventas al por mayor"
                  value={priceListForm.descripcion}
                  onChange={e => setPriceListForm({ ...priceListForm, descripcion: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem', minHeight: '60px', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Tipo de Descuento (Global)</label>
                  <select
                    value={priceListForm.tipo_descuento_global}
                    onChange={e => setPriceListForm({ ...priceListForm, tipo_descuento_global: e.target.value })}
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                  >
                    <option value="valor">Valor Fijo ($)</option>
                    <option value="porcentaje">Porcentaje (%)</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Valor a Descontar (Global)</label>
                  <input
                    type="number"
                    placeholder={priceListForm.tipo_descuento_global === 'porcentaje' ? 'Ej: 10' : 'Ej: 5000'}
                    value={priceListForm.valor_descuento_global}
                    onChange={e => setPriceListForm({ ...priceListForm, valor_descuento_global: e.target.value })}
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                  />
                  <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem', marginBottom: 0 }}>Dejar vacío si no aplica a todo el inventario.</p>
                </div>
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={priceListForm.activo}
                    onChange={e => setPriceListForm({ ...priceListForm, activo: e.target.checked })}
                  />
                  Lista Activa
                </label>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowPriceListModal(false)} className="btn" style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" disabled={savingPriceList} className="btn btn-primary" style={{ flex: 1 }}>
                  {savingPriceList ? 'Guardando...' : 'Guardar Lista'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SHIFT SCHEDULE / ASSIGN MODAL */}
      {showShiftModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: '90%', maxWidth: '450px', padding: '2rem', borderRadius: '16px', backgroundColor: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: '900' }}>{shiftForm.id ? 'Editar Turno' : 'Programar Turno'}</h3>
              <button onClick={() => setShowShiftModal(false)} style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSaveShift} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Sucursal / Tienda</label>
                <select
                  required
                  value={shiftForm.store_id}
                  onChange={e => setShiftForm({ ...shiftForm, store_id: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                >
                  <option value="">Seleccionar tienda...</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Empleado / Cajero</label>
                <select
                  required
                  value={shiftForm.user_id}
                  onChange={e => setShiftForm({ ...shiftForm, user_id: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                >
                  <option value="">Seleccionar empleado...</option>
                  {profilesList.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Fecha</label>
                <input
                  type="date"
                  required
                  value={shiftForm.fecha}
                  onChange={e => setShiftForm({ ...shiftForm, fecha: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Hora Entrada</label>
                  <input
                    type="time"
                    required
                    value={shiftForm.hora_entrada}
                    onChange={e => setShiftForm({ ...shiftForm, hora_entrada: e.target.value })}
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Hora Salida</label>
                  <input
                    type="time"
                    required
                    value={shiftForm.hora_salida}
                    onChange={e => setShiftForm({ ...shiftForm, hora_salida: e.target.value })}
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Estado Asistencia</label>
                <select
                  value={shiftForm.estado}
                  onChange={e => setShiftForm({ ...shiftForm, estado: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                >
                  <option value="programado">Programado</option>
                  <option value="cumplido">Cumplido / Asistido</option>
                  <option value="tardanza">Retraso / Tardanza</option>
                  <option value="ausente">Ausente / Falta</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Observaciones</label>
                <textarea
                  placeholder="Comentarios adicionales"
                  value={shiftForm.observaciones}
                  onChange={e => setShiftForm({ ...shiftForm, observaciones: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem', minHeight: '60px', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowShiftModal(false)} className="btn" style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" disabled={savingShift} className="btn btn-primary" style={{ flex: 1 }}>
                  {savingShift ? 'Guardando...' : 'Guardar Turno'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STORE CREATE/EDIT MODAL */}
      {showStoreModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: '90%', maxWidth: '500px', padding: '2rem', borderRadius: '16px', backgroundColor: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: '900' }}>{storeForm.id ? 'Editar Sucursal' : 'Nueva Sucursal'}</h3>
              <button onClick={() => setShowStoreModal(false)} style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSaveStore} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Código sucursal</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: TN-01"
                  value={storeForm.codigo}
                  onChange={e => setStoreForm({ ...storeForm, codigo: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Nombre sucursal</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Outlet Breiner"
                  value={storeForm.nombre}
                  onChange={e => setStoreForm({ ...storeForm, nombre: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Ciudad</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Medellín"
                  value={storeForm.ciudad}
                  onChange={e => setStoreForm({ ...storeForm, ciudad: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Dirección física</label>
                <input
                  type="text"
                  placeholder="Ej: Calle 10 # 43"
                  value={storeForm.direccion}
                  onChange={e => setStoreForm({ ...storeForm, direccion: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Responsable Tienda</label>
                <select
                  required
                  value={storeForm.responsable}
                  onChange={e => setStoreForm({ ...storeForm, responsable: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                >
                  <option value="">Seleccionar responsable...</option>
                  {profilesList.map(u => (
                    <option key={u.id} value={u.full_name || u.email}>{u.full_name || u.email}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Teléfono contacto</label>
                <input
                  type="text"
                  placeholder="Número telefónico"
                  value={storeForm.telefono}
                  onChange={e => setStoreForm({ ...storeForm, telefono: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Bodega central asociada</label>
                <select
                  value={storeForm.bodega_asociada_id}
                  onChange={e => setStoreForm({ ...storeForm, bodega_asociada_id: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                >
                  <option value="">Ninguna...</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.nombre_bodega}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Resolución DIAN</label>
                <input
                  type="text"
                  placeholder="Nro Facturación DIAN"
                  value={storeForm.resolucion_nro}
                  onChange={e => setStoreForm({ ...storeForm, resolucion_nro: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Estado</label>
                <select
                  value={storeForm.estado}
                  onChange={e => setStoreForm({ ...storeForm, estado: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                >
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>

              <div style={{ gridColumn: 'span 2', display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowStoreModal(false)} className="btn" style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" disabled={savingStore} className="btn btn-primary" style={{ flex: 1 }}>
                  {savingStore ? 'Guardando...' : 'Guardar Sucursal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REGISTER CREATE/EDIT MODAL */}
      {showRegisterModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: '90%', maxWidth: '400px', padding: '2rem', borderRadius: '16px', backgroundColor: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: '900' }}>{registerForm.id ? 'Editar Caja' : 'Nueva Caja POS'}</h3>
              <button onClick={() => setShowRegisterModal(false)} style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSaveRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Código caja</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: CAJA-01"
                  value={registerForm.codigo_caja}
                  onChange={e => setRegisterForm({ ...registerForm, codigo_caja: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Sucursal asignada</label>
                <select
                  required
                  value={registerForm.store_id}
                  onChange={e => setRegisterForm({ ...registerForm, store_id: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                >
                  <option value="">Seleccionar Sucursal...</option>
                  {stores.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowRegisterModal(false)} className="btn" style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" disabled={savingRegister} className="btn btn-primary" style={{ flex: 1 }}>
                  {savingRegister ? 'Guardando...' : 'Guardar Caja'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROMO CREATE/EDIT MODAL */}
      {showPromoModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: '90%', maxWidth: '400px', padding: '2rem', borderRadius: '16px', backgroundColor: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: '900' }}>{promoForm.id ? 'Editar Promoción' : 'Nueva Promoción'}</h3>
              <button onClick={() => setShowPromoModal(false)} style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSavePromo} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Nombre Promoción</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Black Friday 15%"
                  value={promoForm.nombre}
                  onChange={e => setPromoForm({ ...promoForm, nombre: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Tipo descuento</label>
                <select
                  value={promoForm.tipo}
                  onChange={e => setPromoForm({ ...promoForm, tipo: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                >
                  <option value="Porcentaje">Porcentaje (%)</option>
                  <option value="Valor Fijo">Monto Fijo ($)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Valor descuento</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={promoForm.valor}
                  onChange={e => setPromoForm({ ...promoForm, valor: Number(e.target.value) })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Fecha Inicio</label>
                <input
                  type="date"
                  value={promoForm.fecha_inicio}
                  onChange={e => setPromoForm({ ...promoForm, fecha_inicio: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Fecha Fin</label>
                <input
                  type="date"
                  value={promoForm.fecha_fin}
                  onChange={e => setPromoForm({ ...promoForm, fecha_fin: e.target.value })}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={promoForm.activo}
                    onChange={e => setPromoForm({ ...promoForm, activo: e.target.checked })}
                  />
                  Habilitar promoción
                </label>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowPromoModal(false)} className="btn" style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" disabled={savingPromo} className="btn btn-primary" style={{ flex: 1 }}>
                  {savingPromo ? 'Guardando...' : 'Guardar Promoción'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREDIT NOTE MODAL */}
      {showCreditNoteModal && selectedSaleForCN && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: '90%', maxWidth: '500px', padding: '2rem', borderRadius: '16px', backgroundColor: 'white', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: '900', fontSize: '1.1rem', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <RefreshCw size={18} />
                  Generar Nota Crédito SIIGO
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Venta Ticket #{selectedSaleForCN.consecutive} • ${selectedSaleForCN.total?.toLocaleString('es-CO')}</span>
              </div>
              <button onClick={() => setShowCreditNoteModal(false)} style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleCreateCreditNote} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Cliente Titular</label>
                <input
                  type="text"
                  readOnly
                  value={`${selectedSaleForCN.client_name || 'Cliente Mostrador'} (C.C. ${selectedSaleForCN.client_document || 'N/A'})`}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', backgroundColor: '#f8fafc', color: '#334155' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Tipo de Nota Crédito</label>
                <select
                  value={creditNoteType}
                  onChange={(e) => setCreditNoteType(e.target.value)}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                >
                  <option value="01">01 - Devolución parcial o total de los bienes</option>
                  <option value="02">02 - Anulación de factura electrónica</option>
                  <option value="03">03 - Rebaja o descuento parcial o total</option>
                  <option value="04">04 - Ajuste de precio</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Motivo / Justificación</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explica la razón del reembolso o nota crédito..."
                  value={creditNoteReason}
                  onChange={(e) => setCreditNoteReason(e.target.value)}
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button type="button" onClick={() => setShowCreditNoteModal(false)} className="btn" style={{ flex: 1 }}>Cancelar</button>
                <button
                  type="submit"
                  disabled={processingCreditNote}
                  className="btn"
                  style={{
                    flex: 1,
                    backgroundColor: '#dc2626',
                    color: 'white',
                    fontWeight: '850',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                >
                  {processingCreditNote ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Emitir Nota Crédito
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INVOICE TRACKING & AUDIT LOG MODAL */}
      {showTrackingModal && selectedSaleForTracking && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: '90%', maxWidth: '700px', padding: '2rem', borderRadius: '16px', backgroundColor: 'white', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: '900', fontSize: '1.1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Activity size={18} color="var(--primary)" />
                  Trazabilidad y Auditoría SIIGO — Ticket #{selectedSaleForTracking.consecutive}
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Cliente: {selectedSaleForTracking.client_name || 'Cliente Mostrador'} • Total: ${selectedSaleForTracking.total?.toLocaleString('es-CO')}
                </span>
              </div>
              <button onClick={() => setShowTrackingModal(false)} style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>

            {/* Sale Status Info Card */}
            <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#475569' }}>Estado Actual en Sistema:</span>
                <span style={{
                  padding: '0.25rem 0.6rem',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: '850',
                  backgroundColor: selectedSaleForTracking.estado === 'anulada' ? '#fee2e2' : (selectedSaleForTracking.sincronizado_erp ? '#dcfce7' : '#fef3c7'),
                  color: selectedSaleForTracking.estado === 'anulada' ? '#991b1b' : (selectedSaleForTracking.sincronizado_erp ? '#166534' : '#92400e')
                }}>
                  {selectedSaleForTracking.estado === 'anulada' ? 'Anulada / Nota Crédito' : (selectedSaleForTracking.sincronizado_erp ? '✓ Facturado Exitosamente en SIIGO' : '⚠️ Pendiente / Rechazado')}
                </span>
              </div>

              {selectedSaleForTracking.observaciones && (
                <div style={{ fontSize: '0.78rem', color: '#334155', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                  <strong>Detalle de Observaciones / Error:</strong> {selectedSaleForTracking.observaciones}
                </div>
              )}
            </div>

            {/* Audit Logs Timeline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '900', color: '#0f172a' }}>📋 Historial de Peticiones y Logs SIIGO</h4>

              {loadingTrackingLogs ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
                  <p style={{ margin: 0, fontSize: '0.8rem' }}>Cargando registros de auditoría...</p>
                </div>
              ) : saleTrackingLogs.length === 0 ? (
                <div style={{ padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '10px', textAlign: 'center', color: '#64748b', fontSize: '0.8rem', border: '1px solid #e2e8f0' }}>
                  No se encontraron logs de sincronización grabados para esta venta. Intenta facturarla masivamente para generar registros.
                </div>
              ) : (
                saleTrackingLogs.map((log) => (
                  <div key={log.id} style={{
                    padding: '1rem',
                    borderRadius: '10px',
                    backgroundColor: log.status === 'success' ? '#f0fdf4' : (log.status === 'warning' ? '#fffbeb' : '#fef2f2'),
                    border: `1px solid ${log.status === 'success' ? '#bbf7d0' : (log.status === 'warning' ? '#fde68a' : '#fecaca')}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: '850', color: log.status === 'success' ? '#166534' : '#991b1b' }}>
                        {log.status === 'success' ? '✓ Petición Exitosa' : '✕ Fallo en SIIGO'} ({log.endpoint})
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>
                        {new Date(log.created_at).toLocaleString('es-CO')}
                      </span>
                    </div>

                    {log.error_message && (
                      <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: '750' }}>
                        Error: {log.error_message}
                      </div>
                    )}

                    <details open style={{ fontSize: '0.72rem', backgroundColor: 'rgba(0,0,0,0.04)', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                      <summary style={{ cursor: 'pointer', fontWeight: '850', color: '#0f172a' }}>🔍 Inspeccionar Payload Enviado & Respuesta SIIGO (JSON)</summary>
                      <pre style={{ margin: '0.5rem 0 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '0.7rem', maxHeight: '180px', overflowY: 'auto', color: log.status === 'success' ? '#166534' : '#b91c1c' }}>
                        {JSON.stringify({ request: log.request_body, response: log.response_body }, null, 2)}
                      </pre>
                    </details>
                  </div>
                ))
              )}
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowTrackingModal(false)} className="btn btn-primary" style={{ padding: '0.5rem 1.5rem', fontSize: '0.825rem' }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUPERADMIN DEBUG JSON MODAL */}
      {showDebugPayloadModal && debugPayloadSale && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, backdropFilter: 'blur(5px)' }}>
          <div className="card" style={{ width: '90%', maxWidth: '850px', padding: '1.75rem', borderRadius: '16px', backgroundColor: '#0f172a', color: '#f8fafc', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: '900', fontSize: '1.1rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Activity size={20} />
                  [SuperAdmin Debug] Payload & Respuesta SIIGO — Ticket #{debugPayloadSale.consecutive}
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Sucursal: {debugPayloadSale.stores?.nombre || 'General'} • Total: ${debugPayloadSale.total?.toLocaleString('es-CO')}
                </span>
              </div>
              <button onClick={() => setShowDebugPayloadModal(false)} style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#94a3b8' }}><X size={22} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              {/* Left Column: Request Payload */}
              <div style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '12px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ fontWeight: '850', fontSize: '0.8rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  📤 Payload HTTP POST (/v1/invoices)
                </span>
                <pre style={{ margin: 0, fontSize: '0.72rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#86efac', maxHeight: '380px', overflowY: 'auto' }}>
                  {JSON.stringify(debugPayloadContent?.request || {
                    document: { id: "FV-10 (Auto/Selected)" },
                    date: new Date().toISOString().split('T')[0],
                    customer: {
                      person_type: 'Person',
                      id_type: '13',
                      identification: debugPayloadSale.client_document || '222222222222',
                      name: [(debugPayloadSale.client_name || 'Cliente Mostrador').split(' ')[0], (debugPayloadSale.client_name || 'Cliente Mostrador').split(' ').slice(1).join(' ') || 'Mostrador']
                    },
                    items: debugPayloadSale.pos_sale_items?.map((item: any) => ({
                      code: item.products?.codigo_referencia || 'PROD',
                      description: item.products?.nombre_producto || 'Prenda POS',
                      quantity: Number(item.cantidad) || 1,
                      price: Number(item.precio_unitario) || 0
                    })),
                    seller: 1,
                    payments: [{ id: 2430, value: debugPayloadSale.total, due_date: new Date().toISOString().split('T')[0] }]
                  }, null, 2)}
                </pre>
              </div>

              {/* Right Column: Server Response */}
              <div style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '12px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ fontWeight: '850', fontSize: '0.8rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  📥 Respuesta del Servidor SIIGO API
                </span>
                <pre style={{ margin: 0, fontSize: '0.72rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: debugPayloadContent?.response?.status >= 400 || debugPayloadSale.sincronizado_erp === false ? '#fca5a5' : '#6ee7b7', maxHeight: '380px', overflowY: 'auto' }}>
                  {JSON.stringify(debugPayloadContent?.response || {
                    sincronizado_erp: debugPayloadSale.sincronizado_erp,
                    observaciones: debugPayloadSale.observaciones || 'Sin registros de respuesta previa'
                  }, null, 2)}
                </pre>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDebugPayloadModal(false)} className="btn btn-primary" style={{ padding: '0.5rem 1.5rem', fontSize: '0.825rem' }}>
                Cerrar Visor Debug
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUPERADMIN DOCUMENT TYPES LIBRARY MODAL */}
      {showDocTypesLibraryModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, backdropFilter: 'blur(5px)' }}>
          <div className="card" style={{ width: '90%', maxWidth: '900px', padding: '1.75rem', borderRadius: '16px', backgroundColor: 'white', color: '#0f172a', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', maxHeight: '85vh', overflowY: 'auto', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: '900', fontSize: '1.1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FolderOpen size={20} color="var(--primary)" />
                  Biblioteca de Tipos de Comprobante SIIGO (Documentación de la Cuenta)
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Catálogo oficial devuelto por GET /v1/document-types para la parametrización de comprobantes de ingreso y facturación
                </span>
              </div>
              <button onClick={() => setShowDocTypesLibraryModal(false)} style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#64748b' }}><X size={22} /></button>
            </div>

            {docTypesLibraryLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 0.75rem' }} />
                <p style={{ margin: 0, fontSize: '0.85rem' }}>Consultando comprobantes habilitados en la cuenta de SIIGO API...</p>
              </div>
            ) : docTypesLibraryList.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                No se pudieron obtener los tipos de comprobante de la cuenta. Verifica las credenciales de API.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: '#475569', backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <strong>Resumen de Comprobantes Registrados ({docTypesLibraryList.length}):</strong>
                </div>

                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                        <th style={{ padding: '0.65rem 0.85rem' }}>ID</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Código</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Nombre / Descripción</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Tipo (`type`)</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Consecutivo</th>
                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Num. Auto</th>
                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Centro Costo</th>
                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {docTypesLibraryList.map((dt: any) => (
                        <tr key={dt.id} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: dt.code === 'FV-10' || dt.type === 'FV' ? '#f0fdf4' : 'transparent' }}>
                          <td style={{ padding: '0.65rem 0.85rem', fontWeight: '850', fontFamily: 'monospace' }}>{dt.id}</td>
                          <td style={{ padding: '0.65rem 0.85rem', fontWeight: '850', color: dt.code === 'FV-10' ? '#166534' : '#0f172a' }}>
                            {dt.code} {dt.code === 'FV-10' && '⭐'}
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <span style={{ display: 'block', fontWeight: '750' }}>{dt.name}</span>
                            {dt.description && <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b' }}>{dt.description}</span>}
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <span style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '800', backgroundColor: dt.type === 'FV' ? '#dcfce7' : (dt.type === 'RC' ? '#fef3c7' : '#f1f5f9'), color: dt.type === 'FV' ? '#166534' : (dt.type === 'RC' ? '#92400e' : '#475569') }}>
                              {dt.type} ({dt.type === 'FV' ? 'Factura Venta' : (dt.type === 'RC' ? 'Recibo / Ingreso' : dt.type)})
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', fontFamily: 'monospace', fontWeight: '750' }}>{dt.consecutive || '—'}</td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>{dt.automatic_number ? 'SI' : 'NO'}</td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>{dt.cost_center ? 'SI' : 'NO'}</td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                            <span style={{ padding: '0.15rem 0.45rem', borderRadius: '8px', fontSize: '0.7rem', fontWeight: '800', backgroundColor: dt.active !== false ? '#dcfce7' : '#fee2e2', color: dt.active !== false ? '#15803d' : '#b91c1c' }}>
                              {dt.active !== false ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDocTypesLibraryModal(false)} className="btn btn-primary" style={{ padding: '0.5rem 1.5rem', fontSize: '0.825rem' }}>
                Cerrar Biblioteca
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHAT CON PUNTOS DE VENTA (ESTILO WHATSAPP WEB) */}
      {activeTab === 'chat_erp' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '340px 1fr',
          backgroundColor: 'white',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          height: 'calc(100vh - 220px)',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          marginTop: '1.5rem'
        }}>
          {/* Left Column: Chats & Announcements Menu */}
          <div style={{
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#f8fafc'
          }}>
            {/* Header */}
            <div style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid var(--border)',
              backgroundColor: 'white'
            }}>
              <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: '900', color: '#0f172a' }}>Mensajería y Comunicados</h3>
              
              {/* Tabs selector */}
              <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '0.2rem', gap: '0.2rem' }}>
                <button
                  onClick={() => setChatSubTab('rooms')}
                  style={{
                    flex: 1,
                    padding: '0.4rem',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    cursor: 'pointer',
                    backgroundColor: chatSubTab === 'rooms' ? 'white' : 'transparent',
                    color: chatSubTab === 'rooms' ? '#0f172a' : '#64748b',
                    boxShadow: chatSubTab === 'rooms' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
                  }}
                >
                  💬 Sucursales
                </button>
                <button
                  onClick={() => {
                    setChatSubTab('alerts');
                    fetchErpAlertsList();
                  }}
                  style={{
                    flex: 1,
                    padding: '0.4rem',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    cursor: 'pointer',
                    backgroundColor: chatSubTab === 'alerts' ? 'white' : 'transparent',
                    color: chatSubTab === 'alerts' ? '#0f172a' : '#64748b',
                    boxShadow: chatSubTab === 'alerts' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
                  }}
                >
                  📢 Alertas Oficiales
                </button>
              </div>
            </div>

            {/* List Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
              {chatSubTab === 'rooms' ? (
                chatRooms.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    No se han registrado salas de chat de sucursales aún.
                  </div>
                ) : (
                  chatRooms.map(room => (
                    <div
                      key={room.id}
                      onClick={() => selectChatRoom(room)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.85rem',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        backgroundColor: activeRoom?.id === room.id ? '#f1f5f9' : 'transparent',
                        transition: 'background-color 0.2s',
                        marginBottom: '0.25rem'
                      }}
                    >
                      <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--primary-light, #fee2e2)',
                        color: 'var(--primary, #80082E)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '900',
                        fontSize: '1rem',
                        flexShrink: 0
                      }}>
                        🏪
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                          <span style={{ fontSize: '0.825rem', fontWeight: '850', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {room.name}
                          </span>
                          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {room.last_message_time ? new Date(room.last_message_time).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                            {room.last_message || 'Inicia una conversación...'}
                          </span>
                          {room.unread_count_erp > 0 && (
                            <span style={{
                              backgroundColor: '#22c55e',
                              color: 'white',
                              fontSize: '0.6rem',
                              fontWeight: '900',
                              borderRadius: '50%',
                              width: '16px',
                              height: '16px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>{room.unread_count_erp}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )
              ) : (
                /* Alerts column list view */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', padding: '0.25rem 0.5rem', textTransform: 'uppercase' }}>
                    Alertas Publicadas
                  </div>
                  {erpAlertsList.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      Sin anuncios publicados.
                    </div>
                  ) : (
                    erpAlertsList.map(item => (
                      <div
                        key={item.id}
                        style={{
                          padding: '0.75rem',
                          borderRadius: '8px',
                          backgroundColor: 'white',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem',
                          position: 'relative'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{
                            fontSize: '0.55rem',
                            fontWeight: '900',
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            color: 'white',
                            backgroundColor: item.criticidad === 'Alta' ? '#ef4444' : item.criticidad === 'Media' ? '#f59e0b' : '#3b82f6'
                          }}>{item.criticidad}</span>
                          <button
                            onClick={() => handleDeleteAlert(item.id)}
                            style={{ border: 'none', backgroundColor: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '0.1rem' }}
                            title="Eliminar comunicado"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <span style={{ fontSize: '0.78rem', fontWeight: '850', color: '#0f172a' }}>{item.cod_novedad}</span>
                        <p style={{ fontSize: '0.7rem', color: '#64748b', margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.3' }}>{item.nombre}</p>
                        <span style={{ fontSize: '0.55rem', color: '#94a3b8', marginTop: '0.25rem', fontFamily: 'monospace' }}>
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Messages View or Publish Alerts Form */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            background: '#efeae2 url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png") repeat'
          }}>
            {chatSubTab === 'alerts' ? (
              /* Alerts creation form view */
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.7)',
                backdropFilter: 'blur(5px)',
                padding: '2rem'
              }}>
                <div style={{
                  width: '100%',
                  maxWidth: '450px',
                  backgroundColor: 'white',
                  padding: '2rem',
                  borderRadius: '16px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
                  border: '1px solid var(--border)'
                }}>
                  <h3 style={{ margin: '0 0 1.25rem 0', fontWeight: '900', fontSize: '1.1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    📢 Crear Alerta / Comunicado Oficial
                  </h3>
                  
                  <form onSubmit={handleCreateAlert} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Título del Comunicado</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: Mantenimiento del Servidor POS"
                        value={newAlertTitle}
                        onChange={e => setNewAlertTitle(e.target.value)}
                        style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.85rem', outline: 'none' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Criticidad / Nivel</label>
                      <select
                        value={newAlertCriticidad}
                        onChange={e => setNewAlertCriticidad(e.target.value)}
                        style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.85rem', outline: 'none' }}
                      >
                        <option value="Alta">Alta (Roja - Emergencia)</option>
                        <option value="Media">Media (Amarilla - Advertencia)</option>
                        <option value="Baja">Baja (Azul - Informativa)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Mensaje del Anuncio</label>
                      <textarea
                        required
                        rows={4}
                        placeholder="Escribe el comunicado oficial para que aparezca en la campana de todos los puntos de venta..."
                        value={newAlertMessage}
                        onChange={e => setNewAlertMessage(e.target.value)}
                        style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.85rem', outline: 'none', resize: 'none', fontFamily: 'inherit' }}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={savingAlert}
                      style={{
                        padding: '0.75rem',
                        backgroundColor: 'var(--primary, #80082E)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: '850',
                        fontSize: '0.825rem',
                        cursor: 'pointer',
                        transition: 'opacity 0.2s'
                      }}
                    >
                      {savingAlert ? 'Publicando...' : '📢 Emitir Alerta General'}
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              /* Regular Chat room selector view */
              !activeRoom ? (
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                gap: '0.5rem',
                backgroundColor: 'rgba(255,255,255,0.7)',
                backdropFilter: 'blur(5px)'
              }}>
                <div style={{ fontSize: '3rem' }}>💬</div>
                <h4 style={{ margin: 0, fontWeight: '850', fontSize: '1rem', color: '#0f172a' }}>Módulo de Chat con Puntos</h4>
                <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.8 }}>Selecciona una sucursal de la lista para ver el chat en vivo.</p>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Active Header */}
                <div style={{
                  padding: '0.85rem 1.25rem',
                  backgroundColor: 'white',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                    🏪
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: '900', color: '#0f172a' }}>{activeRoom.name}</h4>
                    <span style={{ fontSize: '0.65rem', color: '#16a34a', fontWeight: '750' }}>Canal de venta abierto</span>
                  </div>
                </div>

                {/* Messages Body */}
                <div style={{
                  flex: 1,
                  padding: '1.5rem',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem'
                }}>
                  {activeRoomMessages.length === 0 ? (
                    <div style={{ alignSelf: 'center', backgroundColor: '#e1f5fe', padding: '0.5rem 1rem', borderRadius: '10px', fontSize: '0.75rem', color: '#0288d1', fontWeight: '700', textAlign: 'center' }}>
                      Comienza a escribir. Tu mensaje aparecerá inmediatamente en el Punto de Venta.
                    </div>
                  ) : (
                    activeRoomMessages.map((msg, i) => {
                      const isMe = msg.sender_role === 'admin';
                      return (
                        <div key={i} style={{
                          alignSelf: isMe ? 'flex-end' : 'flex-start',
                          maxWidth: '75%',
                          backgroundColor: isMe ? '#d9fdd3' : '#ffffff',
                          color: '#0f172a',
                          padding: '0.5rem 0.85rem',
                          borderRadius: isMe ? '10px 0px 10px 10px' : '0px 10px 10px 10px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.15rem'
                        }}>
                          <span style={{ fontSize: '0.625rem', fontWeight: '900', color: isMe ? '#16a34a' : 'var(--primary, #80082E)' }}>{msg.sender_name}</span>
                          <span style={{ fontSize: '0.825rem', whiteSpace: 'pre-wrap', lineHeight: '1.3' }}>{msg.message}</span>
                          <span style={{ fontSize: '0.55rem', color: '#94a3b8', alignSelf: 'flex-end', fontFamily: 'monospace', marginTop: '0.15rem' }}>
                            {new Date(msg.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Input Area */}
                <div style={{
                  padding: '0.85rem 1.25rem',
                  backgroundColor: '#f0f2f5',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  borderTop: '1px solid #cbd5e1'
                }}>
                  <input
                    type="text"
                    placeholder="Escribe un mensaje para la sucursal..."
                    value={adminChatInput}
                    onChange={e => setAdminChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSendAdminMessage(); }}
                    style={{
                      flex: 1,
                      padding: '0.65rem 1rem',
                      borderRadius: '20px',
                      border: 'none',
                      backgroundColor: 'white',
                      color: '#0f172a',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  />
                  <button
                    onClick={handleSendAdminMessage}
                    disabled={sendingAdminMsg || !adminChatInput.trim()}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: sendingAdminMsg || !adminChatInput.trim() ? '#cbd5e1' : 'var(--primary, #80082E)',
                      color: 'white',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                    }}
                  >
                    {sendingAdminMsg ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                        <path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

