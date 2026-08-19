'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  Plus, MapPin, Phone, Star, Users, Search,
  Trash2, X, Loader2, Edit2, Factory, Save, BarChart3, Coins, Layers,
  HelpCircle, BookOpen, MessageSquare
} from 'lucide-react';

const EMPTY_FORM = {
  nombre_taller: '',
  responsable: '',
  direccion: '',
  telefono: '',
  especialidad: '',
  capacidad_mensual: '',
  activo: true,
  desc_costuras: '0',
  desc_lavanderia: '0',
  desc_empaque: '0',
};

export default function WorkshopsPage() {
  const { config } = useAuth();
  const avatarSize = config?.['workshop_avatar_size'] || 'normal';
  let avatarWidth = '45px';
  let avatarFontSize = '0.95rem';
  if (avatarSize === 'small') {
    avatarWidth = '32px';
    avatarFontSize = '0.75rem';
  } else if (avatarSize === 'large') {
    avatarWidth = '64px';
    avatarFontSize = '1.35rem';
  } else if (avatarSize === 'xlarge') {
    avatarWidth = '80px';
    avatarFontSize = '1.7rem';
  }

  const [workshops, setWorkshops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [orderCounts, setOrderCounts] = useState<Record<string, number>>({});
  const [selectedWorkshopForOrders, setSelectedWorkshopForOrders] = useState<any>(null);
  const [workshopOrders, setWorkshopOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [activeTab, setActiveTab] = useState<'workshops' | 'rates' | 'special_rates' | 'chat'>('workshops');
  // Chat Workshop States
  const [chatRooms, setChatRooms] = useState<any[]>([]);
  const [activeRoom, setActiveRoom] = useState<any>(null);
  const [activeRoomMessages, setActiveRoomMessages] = useState<any[]>([]);
  const [adminChatInput, setAdminChatInput] = useState('');
  const [sendingAdminMsg, setSendingAdminMsg] = useState(false);
  const [chatSubTab, setChatSubTab] = useState<'rooms' | 'alerts'>('rooms');

  // ERP Alerts/Anuncios States
  const [erpAlertsList, setErpAlertsList] = useState<any[]>([]);
  const [newAlertTitle, setNewAlertTitle] = useState('');
  const [newAlertMessage, setNewAlertMessage] = useState('');
  const [newAlertCriticidad, setNewAlertCriticidad] = useState('Media');
  const [savingAlert, setSavingAlert] = useState(false);

  const [categories, setCategories] = useState<any[]>([]);
  const [workshopRates, setWorkshopRates] = useState<any[]>([]);
  const [savingRates, setSavingRates] = useState(false);
  const [selectedRateWorkshopId, setSelectedRateWorkshopId] = useState<string>('');
  const [selectedSpecialWorkshopId, setSelectedSpecialWorkshopId] = useState<string>('');
  const [specialCosts, setSpecialCosts] = useState<any[]>([]);
  const [savingSpecials, setSavingSpecials] = useState(false);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [specialSearch, setSpecialSearch] = useState('');
  const [standardSpecialInput, setStandardSpecialInput] = useState('');
  const [showWorkshopsHelp, setShowWorkshopsHelp] = useState<boolean>(false);
  const [workshopProfiles, setWorkshopProfiles] = useState<any[]>([]);

  useEffect(() => {
    fetchWorkshops();
    fetchOrderCounts();
  }, []);

  // Load Workshop Chat Rooms
  const fetchChatRooms = async () => {
    try {
      const { data } = await supabase
        .from('workshop_chat_rooms')
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
        .from('workshop_chat_messages')
        .select('*')
        .eq('room_id', room.id)
        .order('created_at', { ascending: true });
      setActiveRoomMessages(messages || []);

      // Reset ERP unread count
      await supabase
        .from('workshop_chat_rooms')
        .update({ unread_count_erp: 0 })
        .eq('id', room.id);
      
      // Update local rooms list
      setChatRooms(prev => prev.map(r => r.id === room.id ? { ...r, unread_count_erp: 0 } : r));
    } catch (e) {
      console.error(e);
    }
  };

  const selectWorkshopChat = async (workshop: any) => {
    try {
      let { data: room } = await supabase
        .from('workshop_chat_rooms')
        .select('*')
        .eq('workshop_id', workshop.id)
        .maybeSingle();

      if (!room) {
        const { data: newRoom, error: createError } = await supabase
          .from('workshop_chat_rooms')
          .insert({
            workshop_id: workshop.id,
            name: workshop.nombre_taller,
            last_message: 'Chat iniciado.',
            unread_count_erp: 0,
            unread_count_workshop: 0
          })
          .select()
          .single();
        if (createError) throw createError;
        room = newRoom;
      }

      await selectChatRoom(room);
    } catch (e) {
      console.error('Error selecting workshop chat:', e);
    }
  };

  // Send admin chat message to workshop
  const handleSendAdminMessage = async () => {
    if (!adminChatInput.trim() || !activeRoom || sendingAdminMsg) return;
    setSendingAdminMsg(true);
    const text = adminChatInput.trim();
    setAdminChatInput('');
    try {
      const { data: newMsg, error } = await supabase
        .from('workshop_chat_messages')
        .insert({
          room_id: activeRoom.id,
          sender_name: 'Administración ERP',
          sender_role: 'admin',
          message: text
        })
        .select()
        .single();
      if (error) throw error;

      const { data: freshRoom } = await supabase
        .from('workshop_chat_rooms')
        .select('unread_count_workshop')
        .eq('id', activeRoom.id)
        .single();

      const newUnreadCount = ((freshRoom?.unread_count_workshop || 0) + 1);

      await supabase
        .from('workshop_chat_rooms')
        .update({
          last_message: text,
          last_message_time: new Date().toISOString(),
          unread_count_workshop: newUnreadCount
        })
        .eq('id', activeRoom.id);

      setActiveRoomMessages((prev: any[]) => [...prev, newMsg]);
      setActiveRoom((prev: any) => prev ? { ...prev, unread_count_workshop: newUnreadCount } : null);
      fetchChatRooms();
    } catch (e) {
      console.error('Error sending erp message:', e);
      setAdminChatInput(text);
    } finally {
      setSendingAdminMsg(false);
    }
  };

  // Workshop Alerts/Anuncios Handlers
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
      alert('✓ Alerta formal general publicada a todos los talleres satélite.');
      fetchErpAlertsList();
    } catch (err: any) {
      alert('Error publicando alerta: ' + err.message);
    } finally {
      setSavingAlert(false);
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta alerta general? Desaparecerá de todos los talleres.')) return;
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

  useEffect(() => {
    if (activeTab === 'chat') {
      fetchChatRooms();
      fetchErpAlertsList();
    }
  }, [activeTab]);

  useEffect(() => {
    if (!activeRoom) return;
    const channelMessages = supabase
      .channel('workshop_chat_messages_global')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'workshop_chat_messages', filter: `room_id=eq.${activeRoom.id}` }, (payload) => {
        setActiveRoomMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
        fetchChatRooms();
      })
      .subscribe();

    const channelRooms = supabase
      .channel('workshop_chat_rooms_global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workshop_chat_rooms' }, () => {
        fetchChatRooms();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channelMessages);
      supabase.removeChannel(channelRooms);
    };
  }, [activeRoom]);

  const fetchWorkshops = async () => {
    setLoading(true);
    try {
      const [
        { data: wData },
        { data: cData },
        { data: rData },
        { data: pData },
        { data: specCostsData },
        { data: profilesData }
      ] = await Promise.all([
        supabase.from('workshops').select('*').order('nombre_taller', { ascending: true }),
        supabase.from('categories').select('*').order('categoria', { ascending: true }),
        supabase.from('workshop_rates').select('*'),
        supabase.from('products').select('*').order('nombre_producto', { ascending: true }),
        supabase.from('workshop_special_costs').select('*'),
        supabase.from('profiles').select('id, full_name, avatar_url, workshop_id').not('workshop_id', 'is', null)
      ]);
      
      setWorkshopProfiles(profilesData || []);
      
      // Automigration from localStorage to Database
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('cortesbreiner_base_rates');
        if (stored) {
          try {
            const localBaseRates = JSON.parse(stored);
            const updates = [];
            const updatedCData = cData ? [...cData] : [];
            
            for (const catId of Object.keys(localBaseRates)) {
              // Extract the clean UUID (in case they have a prefixed "f" key, we strip it)
              const cleanId = catId.startsWith('f') && catId.length === 37 ? catId.substring(1) : catId;
              const rate = localBaseRates[catId];
              const dbCat = updatedCData.find(c => String(c.id) === String(cleanId));
              if (dbCat && rate > 0 && (!dbCat.base_rate || dbCat.base_rate === 0)) {
                // Queue the database update
                updates.push(
                  supabase
                    .from('categories')
                    .update({ base_rate: rate })
                    .eq('id', cleanId)
                );
                dbCat.base_rate = rate;
              }
            }
            if (updates.length > 0) {
              await Promise.all(updates);
              console.log(`Migrated ${updates.length} base rates from localStorage to DB`);
            }
            // Clear once migrated successfully
            localStorage.removeItem('cortesbreiner_base_rates');
          } catch (e) {
            console.error('Error migrating base rates from localStorage:', e);
          }
        }
      }

      setWorkshops(wData || []);
      setCategories(cData || []);
      setWorkshopRates(rData || []);
      setProductsList(pData || []);
      setSpecialCosts(specCostsData || []);
      
      if (wData && wData.length > 0 && !selectedRateWorkshopId) {
        setSelectedRateWorkshopId(wData[0].id);
      }
      if (wData && wData.length > 0 && !selectedSpecialWorkshopId) {
        setSelectedSpecialWorkshopId(wData[0].id);
      }
    } catch (err: any) {
      console.error('Error loading workshop rates or categories:', err.message);
      // Fallback in case table workshop_rates does not exist yet
      const { data: wData } = await supabase.from('workshops').select('*').order('nombre_taller', { ascending: true });
      const { data: cData } = await supabase.from('categories').select('*').order('categoria', { ascending: true });
      const { data: pData } = await supabase.from('products').select('*').order('nombre_producto', { ascending: true });
      setWorkshops(wData || []);
      setCategories(cData || []);
      setProductsList(pData || []);
      if (wData && wData.length > 0 && !selectedRateWorkshopId) {
        setSelectedRateWorkshopId(wData[0].id);
      }
      if (wData && wData.length > 0 && !selectedSpecialWorkshopId) {
        setSelectedSpecialWorkshopId(wData[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderCounts = async () => {
    try {
      const { data: activeSewing } = await supabase
        .from('sewing_orders')
        .select('id, parent_order_id, workshop_id')
        .eq('status', 'En Confección');

      const counts: Record<string, number> = {};
      (activeSewing || []).forEach((so: any) => {
        const wId = String(so.workshop_id);
        counts[wId] = (counts[wId] || 0) + 1;
      });

      setOrderCounts(counts);
    } catch (err: any) {
      console.error("Error fetching order counts:", err.message);
    }
  };

  const handleViewOrders = async (w: any) => {
    setSelectedWorkshopForOrders(w);
    setLoadingOrders(true);
    try {
      // 1. Obtener todas las órdenes de confección activas para este taller
      const { data: sewingOrders } = await supabase
        .from('sewing_orders')
        .select('*, parent_order:orders(*, fabrics(nombre_tela), cuts(*, cut_sizes(*))), products(*), sewing_order_sizes(*, sizes(*))')
        .eq('workshop_id', w.id);

      if (!sewingOrders || sewingOrders.length === 0) {
        setWorkshopOrders([]);
        setLoadingOrders(false);
        return;
      }

      // 2. Mapear cada orden de confección en la información rica para mostrar
      const richOrders = sewingOrders.map(so => {
        const order = so.parent_order || {};
        
        // Sumar prendas del lote
        const totalGarments = (so.sewing_order_sizes || []).reduce(
          (sum: number, sz: any) => sum + (sz.cantidad_planeada || 0), 
          0
        );

        // Kilos proporcionales: Si la orden padre tiene kilos, prorratear en base a prendas del lote respecto a prendas totales de la orden
        let workshopKilos = 0;
        const totalOrderGarments = (order.cuts || []).reduce((sum: number, cut: any) => {
          return sum + (cut.cut_sizes || []).reduce((s: number, cs: any) => s + (Number(cs.quantity) || 0), 0);
        }, 0);

        if (totalOrderGarments > 0) {
          const totalKilos = (order.cuts || []).reduce((sum: number, cut: any) => sum + (Number(cut.kilos) || 0), 0);
          workshopKilos = totalKilos * (totalGarments / totalOrderGarments);
        }

        const isPending = so.status !== 'Terminada';

        return {
          id: so.id,
          internal_code: so.confeccion_code,
          order_internal_code: order.internal_code || '',
          parent_primary_code: order.parent_primary_code || '',
          is_composite: !!order.is_composite,
          client_name: order.client_name || '—',
          fabrics: order.fabrics,
          workshopGarments: totalGarments,
          pendingGarments: isPending ? totalGarments : 0,
          workshopKilos: parseFloat(workshopKilos.toFixed(2)),
          productName: so.products?.nombre_producto || 'Referencia',
          status: so.status || 'En Confección',
          isPending
        };
      });

      // 3. Separar en Principales (Padres / Independientes) y Secundarias (Hijas)
      const primaryOrders: any[] = [];
      const childOrdersMap: Record<string, any[]> = {};
      const claimedChildIds = new Set<string>();

      richOrders.forEach(o => {
        const orderCode = (o.order_internal_code || o.internal_code || '').trim();
        const isChild = orderCode.startsWith('CMP-S-');

        if (isChild) {
          // Extraer la clave base de la orden padre (ej: CMP-S-P06XX-P1 -> P06XX)
          const match = orderCode.match(/^CMP-S-(.*?)(?:-P\d+)?$/i);
          const cleanParentKey = match ? match[1] : orderCode.replace(/^CMP-S-/i, '');
          
          if (!childOrdersMap[cleanParentKey]) childOrdersMap[cleanParentKey] = [];
          childOrdersMap[cleanParentKey].push(o);
        } else {
          primaryOrders.push(o);
        }
      });

      // Ensamblar la lista estructurada: Las hijas quedan anidadas dentro de su padre principal
      const structuredOrders = primaryOrders.map(p => {
        const pCode = (p.order_internal_code || p.internal_code || '').trim();
        const match = pCode.match(/^CMP-P-(.*)$/i);
        const cleanCode = match ? match[1] : pCode.replace(/^(CMP-P-|OC-)/i, '');
        const children = childOrdersMap[cleanCode] || [];
        children.forEach(c => claimedChildIds.add(c.id));
        return {
          ...p,
          childOrders: children
        };
      });

      // Añadir de forma persistente cualquier orden hija cuyos padres no estén presentes como fila propia
      richOrders.forEach(o => {
        const orderCode = o.order_internal_code || '';
        const isChild = orderCode.startsWith('CMP-S-') || !!o.parent_primary_code;
        if (isChild && !claimedChildIds.has(o.id)) {
          structuredOrders.push({
            ...o,
            childOrders: []
          });
        }
      });

      setWorkshopOrders(structuredOrders);
    } catch (err: any) {
      console.error("Error fetching workshop details:", err.message);
    } finally {
      setLoadingOrders(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (w: any) => {
    setEditingId(w.id);
    setForm({
      nombre_taller: w.nombre_taller || '',
      responsable: w.responsable || '',
      direccion: w.direccion || '',
      telefono: w.telefono || '',
      especialidad: w.especialidad || '',
      capacidad_mensual: w.capacidad_mensual || '',
      activo: w.activo ?? true,
      desc_costuras: (w.desc_costuras ?? 0).toString(),
      desc_lavanderia: (w.desc_lavanderia ?? 0).toString(),
      desc_empaque: (w.desc_empaque ?? 0).toString(),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.nombre_taller.trim()) return alert('El nombre del taller es obligatorio.');
    setSaving(true);
    
    const payload = {
      ...form,
      name: form.nombre_taller,
      capacidad_mensual: form.capacidad_mensual ? parseInt(form.capacidad_mensual, 10) : null,
      capacidad_diaria: null, // deprecated
      desc_costuras: form.desc_costuras ? parseFloat(form.desc_costuras) : 0,
      desc_lavanderia: form.desc_lavanderia ? parseFloat(form.desc_lavanderia) : 0,
      desc_empaque: form.desc_empaque ? parseFloat(form.desc_empaque) : 0,
    };

    if (editingId) {
      const { error } = await supabase.from('workshops').update(payload).eq('id', editingId);
      if (error) alert('Error al actualizar: ' + error.message);
    } else {
      const { error } = await supabase.from('workshops').insert([payload]);
      if (error) alert('Error al crear: ' + error.message);
    }
    setSaving(false);
    setShowModal(false);
    fetchWorkshops();
  };

  const handleSaveRates = async () => {
    setSavingRates(true);
    try {
      // Upsert rates lists
      const { error } = await supabase
        .from('workshop_rates')
        .upsert(workshopRates, { onConflict: 'workshop_id,category_id' });

      if (error) {
        alert('Error al guardar tarifas: ' + error.message);
      } else {
        alert('✅ Tarifas guardadas exitosamente.');
        fetchWorkshops();
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSavingRates(false);
    }
  };

  const handleRateChange = (workshopId: string, categoryId: string, val: string) => {
    const numericRate = val === '' ? 0 : parseFloat(val);
    setWorkshopRates(prev => {
      const copy = [...prev];
      const idx = copy.findIndex(r => String(r.workshop_id).toLowerCase() === String(workshopId).toLowerCase() && String(r.category_id).toLowerCase() === String(categoryId).toLowerCase());
      if (idx >= 0) {
        copy[idx] = { ...copy[idx], rate: numericRate };
      } else {
        copy.push({ workshop_id: workshopId, category_id: categoryId, rate: numericRate });
      }
      return copy;
    });
  };

  const handleBaseRateChange = async (categoryId: string, val: string) => {
    const numeric = val === '' ? 0 : parseFloat(val);
    
    // Update local categories state immediately
    setCategories(prev => prev.map(cat => cat.id === categoryId ? { ...cat, base_rate: numeric } : cat));
    
    // Save directly to categories table in database
    const { error } = await supabase
      .from('categories')
      .update({ base_rate: numeric })
      .eq('id', categoryId);
      
    if (error) {
      console.error('Error updating base rate in DB:', error.message);
    }
  };

  const handleProductSpecialRateChange = (workshopId: string, productId: string, val: string) => {
    const numericRate = val === '' ? 0 : parseFloat(val);
    setSpecialCosts(prev => {
      const copy = [...prev];
      const idx = copy.findIndex(r =>
        String(r.workshop_id).toLowerCase() === String(workshopId).toLowerCase() &&
        String(r.product_id).toLowerCase() === String(productId).toLowerCase()
      );
      if (idx >= 0) {
        copy[idx] = { ...copy[idx], special_rate: numericRate };
      } else {
        copy.push({ workshop_id: workshopId, product_id: productId, special_rate: numericRate });
      }
      return copy;
    });
  };

  const handleSpecialCostChangeForCategory = (workshopId: string, categoryId: string, val: string) => {
    const numericRate = val === '' ? 0 : parseFloat(val);
    const productsInCat = productsList.filter(p => String(p.category_id) === String(categoryId));
    
    setSpecialCosts(prev => {
      let copy = [...prev];
      productsInCat.forEach(prod => {
        const idx = copy.findIndex(r =>
          String(r.workshop_id).toLowerCase() === String(workshopId).toLowerCase() &&
          String(r.product_id).toLowerCase() === String(prod.id).toLowerCase()
        );
        if (idx >= 0) {
          copy[idx] = { ...copy[idx], special_rate: numericRate };
        } else {
          copy.push({ workshop_id: workshopId, product_id: String(prod.id), special_rate: numericRate });
        }
      });
      return copy;
    });
  };

  const handleApplyStandardSpecialToAllProducts = (workshopId: string, val: string) => {
    const numericRate = parseFloat(val);
    if (isNaN(numericRate) || numericRate < 0) {
      alert('Ingresa una tarifa numérica válida para parametrizar.');
      return;
    }
    setSpecialCosts(prev => {
      let copy = [...prev];
      productsList.forEach(prod => {
        const idx = copy.findIndex(r =>
          String(r.workshop_id).toLowerCase() === String(workshopId).toLowerCase() &&
          String(r.product_id).toLowerCase() === String(prod.id).toLowerCase()
        );
        if (idx >= 0) {
          copy[idx] = { ...copy[idx], special_rate: numericRate };
        } else {
          copy.push({ workshop_id: workshopId, product_id: String(prod.id), special_rate: numericRate });
        }
      });
      return copy;
    });
    alert(`⚡ Se ha asignado la tarifa especial de $${numericRate.toLocaleString('es-CO')} COP a todas las referencias del taller. Haz clic en "Guardar Costos Especiales" para confirmar.`);
  };

  const handleSaveSpecials = async () => {
    if (!selectedSpecialWorkshopId) return alert('Selecciona un taller satélite.');
    setSavingSpecials(true);
    try {
      const seen = new Set();
      const recordsToUpsert: any[] = [];

      for (const item of specialCosts) {
        if (String(item.workshop_id).toLowerCase() === String(selectedSpecialWorkshopId).toLowerCase() && item.product_id) {
          const key = `${String(item.workshop_id).toLowerCase()}_${String(item.product_id).toLowerCase()}`;
          if (!seen.has(key)) {
            seen.add(key);
            recordsToUpsert.push({
              workshop_id: item.workshop_id,
              product_id: item.product_id,
              special_rate: Number(item.special_rate) || 0
            });
          }
        }
      }

      if (recordsToUpsert.length === 0) {
        alert('No hay tarifas especiales para guardar en este taller.');
        setSavingSpecials(false);
        return;
      }

      const { error } = await supabase
        .from('workshop_special_costs')
        .upsert(recordsToUpsert, { onConflict: 'workshop_id,product_id' });

      if (error) {
        alert('Error al guardar costos especiales: ' + error.message);
      } else {
        alert('✅ Costos especiales por referencia guardados exitosamente.');
        const { data: freshSpecials } = await supabase.from('workshop_special_costs').select('*');
        if (freshSpecials) setSpecialCosts(freshSpecials);
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSavingSpecials(false);
    }
  };

  const handleApplyBaseRates = async (workshopId: string) => {
    const updatedRates = [...workshopRates];
    const ratesToUpsert: any[] = [];

    categories.forEach(cat => {
      const baseVal = cat.base_rate || 0;
      const idx = updatedRates.findIndex(r => String(r.workshop_id).toLowerCase() === String(workshopId).toLowerCase() && String(r.category_id).toLowerCase() === String(cat.id).toLowerCase());
      
      const item = { workshop_id: workshopId, category_id: cat.id, rate: baseVal };
      ratesToUpsert.push(item);

      if (idx >= 0) {
        updatedRates[idx] = { ...updatedRates[idx], rate: baseVal };
      } else {
        updatedRates.push(item);
      }
    });

    setWorkshopRates(updatedRates);

    // Save automatically to DB
    const { error } = await supabase
      .from('workshop_rates')
      .upsert(ratesToUpsert, { onConflict: 'workshop_id,category_id' });

    if (error) {
      console.error('Error saving rates automatically:', error.message);
      alert('❌ Error al guardar tarifas en la base de datos: ' + error.message);
    } else {
      // Refresh to ensure we have the primary key IDs from Supabase loaded in state
      const { data } = await supabase.from('workshop_rates').select('*');
      if (data) setWorkshopRates(data);
    }
  };

  const handleApplyBaseToAll = async () => {
    if (!confirm('¿Aplicar los costos base de referencia a TODOS los talleres? Esto guardará y actualizará los valores en la base de datos de manera definitiva.')) return;
    
    const updatedRates = [...workshopRates];
    const ratesToUpsert: any[] = [];

    workshops.forEach(w => {
      categories.forEach(cat => {
        const baseVal = cat.base_rate || 0;
        const idx = updatedRates.findIndex(r => String(r.workshop_id).toLowerCase() === String(w.id).toLowerCase() && String(r.category_id).toLowerCase() === String(cat.id).toLowerCase());
        
        const item = { workshop_id: w.id, category_id: cat.id, rate: baseVal };
        ratesToUpsert.push(item);

        if (idx >= 0) {
          updatedRates[idx] = { ...updatedRates[idx], rate: baseVal };
        } else {
          updatedRates.push(item);
        }
      });
    });

    setWorkshopRates(updatedRates);

    // Save automatically to DB in batch
    const { error } = await supabase
      .from('workshop_rates')
      .upsert(ratesToUpsert, { onConflict: 'workshop_id,category_id' });

    if (error) {
      console.error('Error saving rates automatically for all workshops:', error.message);
      alert('❌ Error al aplicar tarifas: ' + error.message);
    } else {
      alert('⚡ Costos base aplicados y guardados exitosamente en la base de datos para TODOS los talleres.');
      const { data } = await supabase.from('workshop_rates').select('*');
      if (data) setWorkshopRates(data);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este taller? Esta acción no se puede deshacer.')) return;
    const { error } = await supabase.from('workshops').delete().eq('id', id);
    if (error) {
      if (error.message.includes('foreign key constraint')) {
        alert('❌ No se puede eliminar este taller porque tiene envíos (remisiones) u órdenes de trabajo asociadas. Por favor, edítalo y cambia su estado a "Inactivo" para ocultarlo sin perder el historial.');
      } else {
        alert('Error al eliminar: ' + error.message);
      }
      return;
    }
    fetchWorkshops();
  };

  const filtered = workshops.filter(w =>
    w.nombre_taller?.toLowerCase().includes(search.toLowerCase()) ||
    w.responsable?.toLowerCase().includes(search.toLowerCase()) ||
    w.especialidad?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#80082E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Producción Externa
          </span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '950', margin: '0.25rem 0 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.5rem', backgroundColor: '#80082E', borderRadius: '12px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Factory size={24} />
            </div>
            Talleres Satélite
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Administra tus talleres externos y controla la producción delegada.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={() => setShowWorkshopsHelp(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.6rem 1.1rem', borderRadius: '10px',
              border: '1.5px solid var(--border)', cursor: 'pointer',
              fontSize: '0.8rem', fontWeight: '800',
              backgroundColor: 'white', color: 'var(--text-muted)',
              transition: 'all 0.15s ease',
            }}
          >
            <HelpCircle size={16} /> Ayuda
          </button>
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={18} /> Registrar Taller
          </button>
        </div>
      </div>

      {/* Modal de Ayuda del módulo Talleres */}
      {showWorkshopsHelp && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', width: '100%', maxWidth: '680px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 40px 80px -20px rgba(0,0,0,0.35)' }}>
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg, var(--primary) 0%, #0891b2 100%)', padding: '2rem', borderRadius: '24px 24px 0 0', color: 'white', position: 'sticky', top: 0, zIndex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <BookOpen size={24} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8 }}>Centro de Ayuda</p>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '950' }}>Guía de Talleres Satélite</h2>
                  </div>
                </div>
                <button onClick={() => setShowWorkshopsHelp(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '10px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', flexShrink: 0 }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Contenido */}
            <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

              {/* Directorio */}
              <div>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: '900', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: '#eef2ff', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '900', flexShrink: 0 }}>1</span>
                  Directorio de Talleres
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingLeft: '2rem' }}>
                  {[
                    { icon: '🏭', title: 'Registrar un Taller', desc: 'Haz clic en “Registrar Taller” para crear un nuevo satélite. Completa nombre, responsable, dirección, teléfono, especialidad y capacidad diaria.' },
                    { icon: '📈', title: 'Ver el reporte de carga', desc: 'El ícono de gráfica junto a cada taller muestra las órdenes activas, prendas pendientes y kilos de tela asignados.' },
                    { icon: '✏️', title: 'Editar un Taller', desc: 'Haz clic en el ícono de edición para modificar los datos del taller en cualquier momento.' },
                    { icon: '🗑️', title: 'Eliminar un Taller', desc: 'Solo puedes eliminar talleres que no tengan órdenes activas. Esta acción es permanente.' },
                  ].map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.75rem', padding: '0.8rem 1rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{s.icon}</span>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: '800', color: '#1e293b' }}>{s.title}</p>
                        <p style={{ margin: '0.15rem 0 0', fontSize: '0.72rem', color: '#64748b', lineHeight: '1.4' }}>{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tarifas */}
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: '900', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '900', flexShrink: 0 }}>2</span>
                  Tarifas y Costos por Categoría
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingLeft: '2rem' }}>
                  {[
                    { icon: '💲', title: 'Tarifa base global', desc: 'Es el precio base de confección por prenda, definido en Ajustes del sistema. Aplica a todos los talleres que no tengan tarifa específica.' },
                    { icon: '🏷️', title: 'Tarifa por categoría', desc: 'Puedes asignar un precio diferente según la categoría del producto (ej: camisetas, pantalones). Esto sobrescribe la tarifa base para ese tipo de prenda.' },
                    { icon: '🏠', title: 'Override por taller', desc: 'Selecciona un taller específico en el dropdown para definir tarifas personalizadas solo para ese taller. Si no se define, usa la tarifa de categoría o la base global.' },
                  ].map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.75rem', padding: '0.8rem 1rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{s.icon}</span>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: '800', color: '#1e293b' }}>{s.title}</p>
                        <p style={{ margin: '0.15rem 0 0', fontSize: '0.72rem', color: '#64748b', lineHeight: '1.4' }}>{s.desc}</p>
                      </div>
                    </div>
                  ))}
                  <div style={{ padding: '0.85rem 1rem', backgroundColor: '#fffbeb', borderRadius: '10px', border: '1px solid #fed7aa', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '1rem', flexShrink: 0 }}>⚡</span>
                    <p style={{ margin: 0, fontSize: '0.73rem', color: '#92400e', lineHeight: '1.45', fontWeight: '600' }}>
                      <strong>Jerarquía de tarifas:</strong> Costo Especial (por orden) → Tarifa por Taller y Categoría → Tarifa de Categoría Global → Tarifa Base Global.
                    </p>
                  </div>
                </div>
              </div>

              {/* Costos Especiales */}
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: '900', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: '#fff7ed', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '900', flexShrink: 0 }}>3</span>
                  Costos Especiales
                </h3>
                <div style={{ paddingLeft: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#475569', lineHeight: '1.5', padding: '0.85rem 1rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    Los costos especiales se activan cuando una orden de confección tiene marcado el flag "Precio Especial" ✅. 
                    En ese caso, el sistema consulta esta tabla para obtener la tarifa correcta por categoría y taller, 
                    y la usa para calcular el pago en lugar de la tarifa normal.
                  </p>
                  {[
                    '⚠️ Si el precio especial está activo en una orden pero no hay costo especial configurado para esa categoría y taller, el sistema usa la tarifa base.',
                    '📋 Puedes dejar el campo vacío (0) para indicar que no aplica costo especial para esa combinación.',
                    '💾 Siempre haz clic en "Guardar Tarifas Especiales" para que los cambios tengan efecto.',
                  ].map((tip, i) => (
                    <p key={i} style={{ margin: 0, fontSize: '0.75rem', color: '#475569', padding: '0.5rem 0.75rem', backgroundColor: '#fafafa', borderRadius: '8px', borderLeft: '3px solid #f59e0b', lineHeight: '1.4' }}>{tip}</p>
                  ))}
                </div>
              </div>

              {/* Botón cerrar */}
              <button
                onClick={() => setShowWorkshopsHelp(false)}
                style={{ padding: '0.85rem', borderRadius: '12px', border: 'none', cursor: 'pointer', backgroundColor: 'var(--primary)', color: 'white', fontWeight: '800', fontSize: '0.875rem', width: '100%' }}
              >
                Entendido — Cerrar guía
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Selector */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '1.5rem', marginBottom: '0.5rem' }}>
        <button 
          onClick={() => setActiveTab('workshops')}
          style={{
            padding: '0.75rem 0.5rem', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: '0.875rem', fontWeight: '800',
            color: activeTab === 'workshops' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'workshops' ? '3px solid var(--primary)' : '3px solid transparent',
            display: 'flex', alignItems: 'center', gap: '0.5rem'
          }}
        >
          <Factory size={16} /> Directorio de Talleres
        </button>
        <button 
          onClick={() => setActiveTab('rates')}
          style={{
            padding: '0.75rem 0.5rem', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: '0.875rem', fontWeight: '800',
            color: activeTab === 'rates' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'rates' ? '3px solid var(--primary)' : '3px solid transparent',
            display: 'flex', alignItems: 'center', gap: '0.5rem'
          }}
        >
          <Coins size={16} /> Tarifas y Costos por Categoría
        </button>
        <button 
          onClick={() => setActiveTab('special_rates')}
          style={{
            padding: '0.75rem 0.5rem', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: '0.875rem', fontWeight: '800',
            color: activeTab === 'special_rates' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'special_rates' ? '3px solid var(--primary)' : '3px solid transparent',
            display: 'flex', alignItems: 'center', gap: '0.5rem'
          }}
        >
          <Star size={16} /> Costos Especiales por Producto
        </button>
        <button 
          onClick={() => setActiveTab('chat')}
          style={{
            padding: '0.75rem 0.5rem', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: '0.875rem', fontWeight: '800',
            color: activeTab === 'chat' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'chat' ? '3px solid var(--primary)' : '3px solid transparent',
            display: 'flex', alignItems: 'center', gap: '0.5rem'
          }}
        >
          <MessageSquare size={16} /> Chat Talleres
        </button>
      </div>

      {activeTab === 'workshops' ? (
        <>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Buscar por nombre, especialidad o responsable..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 3rem', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
            />
          </div>

          {/* Cards grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              <Loader2 className="animate-spin" style={{ margin: 'auto' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              No hay talleres registrados. Crea el primero.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
              {filtered.map(w => {
                const managerProfile = workshopProfiles.find(p => p.workshop_id === w.id && p.avatar_url);
                const avatarUrl = managerProfile?.avatar_url || null;

                return (
                  <div key={w.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Card header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
                        {avatarUrl ? (
                          <img 
                            src={avatarUrl} 
                            alt={w.nombre_taller} 
                            style={{ width: avatarWidth, height: avatarWidth, borderRadius: '12px', objectFit: 'cover', border: '1px solid #cbd5e1' }}
                          />
                        ) : (
                          <div style={{ 
                            width: avatarWidth, height: avatarWidth, borderRadius: '12px', 
                            background: 'linear-gradient(135deg, #80082E 0%, #D81B60 100%)',
                            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: avatarFontSize, fontWeight: '950', border: '1px solid rgba(255,255,255,0.1)'
                          }}>
                            {w.nombre_taller ? w.nombre_taller.substring(0, 2).toUpperCase() : 'TA'}
                          </div>
                        )}
                        <div>
                          <h3 style={{ fontSize: '1.125rem', marginBottom: '0.25rem', margin: 0, fontWeight: '900', color: '#0f172a' }}>{w.nombre_taller}</h3>
                          {w.especialidad && (
                            <span className="badge badge-info" style={{ fontSize: '0.625rem' }}>{w.especialidad}</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button
                        onClick={() => handleViewOrders(w)}
                        style={{ padding: '0.4rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f5f3ff', cursor: 'pointer', color: '#7c3aed' }}
                        title="Ver Reporte de Carga"
                      >
                        <BarChart3 size={15} />
                      </button>
                      <button
                        onClick={() => openEdit(w)}
                        style={{ padding: '0.4rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: 'var(--primary)' }}
                        title="Editar"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(w.id)}
                        style={{ padding: '0.4rem', borderRadius: '8px', border: '1px solid #fecaca', background: '#fff5f5', cursor: 'pointer', color: '#ef4444' }}
                        title="Eliminar"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Info rows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {w.responsable && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        <Users size={15} />
                        <span>Responsable: <strong>{w.responsable}</strong></span>
                      </div>
                    )}
                    {w.direccion && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        <MapPin size={15} />
                        <span>{w.direccion}</span>
                      </div>
                    )}
                    {w.telefono && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        <Phone size={15} />
                        <span>{w.telefono}</span>
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                    <div>
                      <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Capacidad Mensual</p>
                      <p style={{ fontSize: '1rem', fontWeight: '700', marginTop: '0.25rem' }}>
                        {w.capacidad_mensual ? `${w.capacidad_mensual} pnd` : (w.capacidad_diaria ? `${w.capacidad_diaria} pnd (diaria)` : '—')}
                      </p>
                    </div>
                    <div 
                      onClick={() => handleViewOrders(w)}
                      style={{ cursor: 'pointer', transition: 'all 0.2s', padding: '0.25rem', borderRadius: '4px' }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <p style={{ fontSize: '0.625rem', color: 'var(--primary)', fontWeight: '800', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        Órdenes Asignadas <Search size={10} />
                      </p>
                      <p style={{ fontSize: '1rem', fontWeight: '700', marginTop: '0.25rem', color: 'var(--text)' }}>
                        {orderCounts[w.id] || 0}
                      </p>
                    </div>
                  </div>

                  {/* Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className={`badge ${w.activo ? 'badge-success' : 'badge-warning'}`}>
                      {w.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </>
      ) : activeTab === 'rates' ? (
        <div style={{ backgroundColor: 'white', border: '1px solid var(--border)', borderRadius: '16px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>Maestro de Tarifas de Confección</h2>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0' }}>Establece el costo por prenda de costura a pagar a cada taller satélite según la categoría de producto.</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                onClick={() => {
                  const withRates = categories.filter(c => c.base_rate > 0);
                  const firstW = workshops[0];
                  const firstC = categories[0];
                  const matchSample = firstW && firstC ? workshopRates.find(r => String(r.workshop_id).toLowerCase() === String(firstW.id).toLowerCase() && String(r.category_id).toLowerCase() === String(firstC.id).toLowerCase()) : null;
                  alert(
                    `DIAGNÓSTICO:\n` +
                    `- Categorías totales: ${categories.length}\n` +
                    `- Con costo base > 0: ${withRates.length} (Ejs: ${withRates.slice(0, 3).map(c => `${c.categoria}: $${c.base_rate}`).join(', ')})\n` +
                    `- Registros en workshopRates: ${workshopRates.length}\n` +
                    `- Primer Taller: ${firstW ? firstW.nombre_taller : 'Ninguno'} (${firstW ? firstW.id : 'N/A'})\n` +
                    `- Primera Categoría: ${firstC ? firstC.categoria : 'Ninguna'} (${firstC ? firstC.id : 'N/A'})\n` +
                    `- Coincidencia de tarifa: ${matchSample ? `Existe (tarifa: ${matchSample.rate})` : 'No existe'}`
                  );
                }}
                style={{
                  padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', background: 'white',
                  fontSize: '0.8rem', fontWeight: '800', color: '#475569', borderRadius: '8px',
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem'
                }}
              >
                🔍 Diagnóstico
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleSaveRates}
                disabled={savingRates}
                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
              >
                {savingRates ? <Loader2 className="animate-spin" size={16} /> : <><Save size={16} /> Guardar Tarifas</>}
              </button>
            </div>
          </div>

          <div style={{ padding: '1.25rem', backgroundColor: '#f0f9ff', borderRadius: '12px', border: '1px solid #bae6fd', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '850', color: '#0369a1' }}>⚙️ CONFIGURAR COSTOS BASE DE REFERENCIA:</span>
              <button 
                onClick={handleApplyBaseToAll} 
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.72rem', fontWeight: '800', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              >
                ⚡ Aplicar Base a TODOS los Talleres
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem' }}>
              {categories.map(cat => (
                <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <label style={{ fontSize: '0.68rem', fontWeight: '800', color: '#0369a1', textTransform: 'uppercase' }}>{cat.categoria}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                    <span style={{ color: '#0284c7', fontWeight: '700', fontSize: '0.75rem' }}>$</span>
                    <input 
                      type="number" 
                      min="0"
                      value={cat.base_rate || ''} 
                      onChange={e => handleBaseRateChange(cat.id, e.target.value)}
                      placeholder="0"
                      style={{ width: '100%', padding: '0.3rem 0.5rem', borderRadius: '6px', border: '1px solid #7dd3fc', fontSize: '0.78rem', textAlign: 'right', fontWeight: '700', color: '#0369a1' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '1.25rem', backgroundColor: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '850', color: '#334155' }}>TALLER SATÉLITE SELECCIONADO:</span>
                <select
                  value={selectedRateWorkshopId}
                  onChange={e => setSelectedRateWorkshopId(e.target.value)}
                  style={{ padding: '0.45rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '750', color: '#0f172a', backgroundColor: 'white', minWidth: '220px' }}
                >
                  <option value="">Selecciona un taller...</option>
                  {workshops.map(w => (
                    <option key={w.id} value={w.id}>{w.nombre_taller}</option>
                  ))}
                </select>
              </div>

              {selectedRateWorkshopId && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleApplyBaseRates(selectedRateWorkshopId)}
                    style={{ padding: '0.45rem 0.85rem', fontSize: '0.75rem', fontWeight: '800', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    ⚡ Aplicar Costos Base a este Taller
                  </button>
                </div>
              )}
            </div>

            {!selectedRateWorkshopId ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                Selecciona un taller satélite para comenzar a configurar sus costos específicos por prenda.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
                {categories.map(cat => {
                  const match = workshopRates.find(r => String(r.workshop_id).toLowerCase() === String(selectedRateWorkshopId).toLowerCase() && String(r.category_id).toLowerCase() === String(cat.id).toLowerCase());
                  const currentRate = match ? match.rate : 0;
                  return (
                    <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.85rem 1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: '850', color: '#0f172a', textTransform: 'uppercase' }}>{cat.categoria || '(Sin Categoría)'}</span>
                      <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '700' }}>
                        Costo Base: <span style={{ color: '#0284c7', fontWeight: '800' }}>${cat.base_rate || 0}</span>
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                        <span style={{ color: '#94a3b8', fontWeight: '700', fontSize: '0.8rem' }}>$</span>
                        <input
                          type="number"
                          min="0"
                          value={currentRate || ''}
                          onChange={e => handleRateChange(selectedRateWorkshopId, cat.id, e.target.value)}
                          placeholder="0"
                          style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', textAlign: 'right', fontWeight: '750', color: '#0f172a' }}
                        />
                        <button
                          onClick={() => handleRateChange(selectedRateWorkshopId, cat.id, String(cat.base_rate || 0))}
                          style={{ padding: '0.35rem 0.5rem', fontSize: '0.68rem', fontWeight: '800', border: '1px solid #bae6fd', background: '#f0f9ff', color: '#0369a1', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                          title="Copia el costo base de referencia a esta prenda para este taller"
                        >
                          ⚡ Base
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'special_rates' ? (
        <div style={{ backgroundColor: 'white', border: '1px solid var(--border)', borderRadius: '16px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>⭐ Matriz de Costos Especiales por Referencia y Producto</h2>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0' }}>Parametriza y ajusta tarifas especiales por cada producto/referencia o establece una tarifa especial estándar general para el taller.</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button 
                className="btn btn-primary" 
                onClick={handleSaveSpecials}
                disabled={savingSpecials || !selectedSpecialWorkshopId}
                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
              >
                {savingSpecials ? <Loader2 className="animate-spin" size={16} /> : <><Save size={16} /> Guardar Costos Especiales</>}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '1.25rem', backgroundColor: '#f8fafc' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '850', color: '#334155' }}>SELECCIONAR TALLER SATÉLITE:</span>
                <select
                  value={selectedSpecialWorkshopId}
                  onChange={e => setSelectedSpecialWorkshopId(e.target.value)}
                  style={{ padding: '0.45rem 1rem', borderRadius: '8px', border: '1.5px solid #80082E', fontSize: '0.85rem', fontWeight: '800', color: '#0f172a', backgroundColor: 'white', minWidth: '240px' }}
                >
                  <option value="">Selecciona un taller...</option>
                  {workshops.map(w => (
                    <option key={w.id} value={w.id}>{w.nombre_taller}</option>
                  ))}
                </select>
              </div>

              {selectedSpecialWorkshopId && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Search size={16} style={{ color: '#64748b' }} />
                  <input
                    type="text"
                    placeholder="Buscar referencia o producto..."
                    value={specialSearch}
                    onChange={e => setSpecialSearch(e.target.value)}
                    style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', minWidth: '220px' }}
                  />
                </div>
              )}
            </div>

            {!selectedSpecialWorkshopId ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                👈 Selecciona un taller satélite arriba para configurar sus costos especiales por referencia y producto.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '0.5rem' }}>
                
                {/* Panel de Parametrización Estándar Especial para Todos los Productos */}
                <div style={{ padding: '1rem 1.25rem', backgroundColor: '#fffbe7', border: '1.5px solid #fcd34d', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: '#78350f', display: 'block' }}>⚡ Parametrización Rápida: Precio Especial Estándar</strong>
                    <span style={{ fontSize: '0.72rem', color: '#92400e' }}>Aplica un valor de tarifa especial uniforme a TODAS las referencias de este taller con 1 solo clic.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: '800', color: '#78350f', fontSize: '0.85rem' }}>$</span>
                    <input
                      type="number"
                      min="0"
                      value={standardSpecialInput}
                      onChange={e => setStandardSpecialInput(e.target.value)}
                      placeholder="Ej: 5700"
                      style={{ width: '110px', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1.5px solid #f59e0b', fontSize: '0.85rem', fontWeight: '800', textAlign: 'right', backgroundColor: 'white' }}
                    />
                    <button
                      type="button"
                      onClick={() => handleApplyStandardSpecialToAllProducts(selectedSpecialWorkshopId, standardSpecialInput)}
                      style={{ padding: '0.45rem 0.9rem', fontSize: '0.78rem', fontWeight: '900', backgroundColor: '#d97706', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      ⚡ Aplicar a Todas las Referencias
                    </button>
                  </div>
                </div>

                {/* Listado por Categoría con Referencias Individuales */}
                {categories.map(cat => {
                  const productsInCat = productsList.filter(p => {
                    const matchesCat = String(p.category_id) === String(cat.id);
                    if (!matchesCat) return false;
                    if (!specialSearch.trim()) return true;
                    const searchLower = specialSearch.toLowerCase().trim();
                    const nameMatch = (p.nombre_producto || p.name || '').toLowerCase().includes(searchLower);
                    const codeMatch = (p.codigo_referencia || p.reference_code || '').toLowerCase().includes(searchLower);
                    return nameMatch || codeMatch;
                  });

                  if (specialSearch.trim() && productsInCat.length === 0) return null;

                  return (
                    <div key={cat.id} style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem 1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                      
                      {/* Cabecera de Categoría + Control Rápido por Categoría */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', paddingBottom: '0.6rem', borderBottom: '1px solid #f1f5f9' }}>
                        <div>
                          <span style={{ fontSize: '0.88rem', fontWeight: '950', color: '#0f172a', textTransform: 'uppercase' }}>{cat.categoria || '(Sin Categoría)'}</span>
                          <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '700', marginLeft: '0.75rem' }}>
                            Tarifa Base General: <strong style={{ color: '#0284c7' }}>${cat.base_rate?.toLocaleString('es-CO') || '0'} COP</strong>
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.7rem', color: '#475569', fontWeight: '700' }}>Fijar a toda la categoría:</span>
                          <span style={{ color: '#94a3b8', fontWeight: '700', fontSize: '0.8rem' }}>$</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="Aplicar a cat."
                            onChange={e => handleSpecialCostChangeForCategory(selectedSpecialWorkshopId, cat.id, e.target.value)}
                            style={{ width: '100px', padding: '0.3rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', textAlign: 'right', fontWeight: '800' }}
                          />
                        </div>
                      </div>

                      {/* Lista de Referencias/Productos de esta categoría */}
                      {productsInCat.length === 0 ? (
                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>No hay productos asociados a esta categoría.</p>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                          {productsInCat.map(prod => {
                            const match = specialCosts.find(r =>
                              String(r.workshop_id).toLowerCase() === String(selectedSpecialWorkshopId).toLowerCase() &&
                              String(r.product_id).toLowerCase() === String(prod.id).toLowerCase()
                            );
                            const currentRate = match ? match.special_rate : 0;
                            return (
                              <div key={prod.id} style={{ padding: '0.65rem 0.85rem', borderRadius: '8px', backgroundColor: currentRate > 0 ? '#f0fdf4' : '#f8fafc', border: `1.5px solid ${currentRate > 0 ? '#bbf7d0' : '#e2e8f0'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ overflow: 'hidden' }}>
                                  <strong style={{ fontSize: '0.78rem', color: '#0f172a', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {prod.nombre_producto || prod.name}
                                  </strong>
                                  {prod.codigo_referencia && (
                                    <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '700' }}>Ref: {prod.codigo_referencia}</span>
                                  )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', flexShrink: 0 }}>
                                  <span style={{ color: currentRate > 0 ? '#16a34a' : '#94a3b8', fontWeight: '900', fontSize: '0.78rem' }}>$</span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={currentRate || ''}
                                    onChange={e => handleProductSpecialRateChange(selectedSpecialWorkshopId, prod.id, e.target.value)}
                                    placeholder="0"
                                    style={{ width: '85px', padding: '0.35rem 0.45rem', borderRadius: '6px', border: `1.5px solid ${currentRate > 0 ? '#16a34a' : '#cbd5e1'}`, fontSize: '0.8rem', textAlign: 'right', fontWeight: '900', color: currentRate > 0 ? '#15803d' : '#0f172a', backgroundColor: 'white' }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Sección para Productos sin categoría */}
                {(() => {
                  const uncategorizedProducts = productsList.filter(p => {
                    if (p.category_id) return false;
                    if (!specialSearch.trim()) return true;
                    const searchLower = specialSearch.toLowerCase().trim();
                    const nameMatch = (p.nombre_producto || p.name || '').toLowerCase().includes(searchLower);
                    const codeMatch = (p.codigo_referencia || p.reference_code || '').toLowerCase().includes(searchLower);
                    return nameMatch || codeMatch;
                  });

                  if (uncategorizedProducts.length === 0) return null;

                  return (
                    <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem 1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                      <div style={{ marginBottom: '0.75rem', paddingBottom: '0.6rem', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: '950', color: '#64748b', textTransform: 'uppercase' }}>📦 Referencias Generales (Sin Categoría)</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                        {uncategorizedProducts.map(prod => {
                          const match = specialCosts.find(r =>
                            String(r.workshop_id).toLowerCase() === String(selectedSpecialWorkshopId).toLowerCase() &&
                            String(r.product_id).toLowerCase() === String(prod.id).toLowerCase()
                          );
                          const currentRate = match ? match.special_rate : 0;
                          return (
                            <div key={prod.id} style={{ padding: '0.65rem 0.85rem', borderRadius: '8px', backgroundColor: currentRate > 0 ? '#f0fdf4' : '#f8fafc', border: `1.5px solid ${currentRate > 0 ? '#bbf7d0' : '#e2e8f0'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ overflow: 'hidden' }}>
                                <strong style={{ fontSize: '0.78rem', color: '#0f172a', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {prod.nombre_producto || prod.name}
                                </strong>
                                {prod.codigo_referencia && (
                                  <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '700' }}>Ref: {prod.codigo_referencia}</span>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', flexShrink: 0 }}>
                                <span style={{ color: currentRate > 0 ? '#16a34a' : '#94a3b8', fontWeight: '900', fontSize: '0.78rem' }}>$</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={currentRate || ''}
                                  onChange={e => handleProductSpecialRateChange(selectedSpecialWorkshopId, prod.id, e.target.value)}
                                  placeholder="0"
                                  style={{ width: '85px', padding: '0.35rem 0.45rem', borderRadius: '6px', border: `1.5px solid ${currentRate > 0 ? '#16a34a' : '#cbd5e1'}`, fontSize: '0.8rem', textAlign: 'right', fontWeight: '900', color: currentRate > 0 ? '#15803d' : '#0f172a', backgroundColor: 'white' }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

              </div>
            )}
          </div>
        </div>
      ) : (
        /* CHAT CON TALLERES SATÉLITE (ESTILO WHATSAPP WEB) */
        <div style={{
          display: 'grid',
          gridTemplateColumns: '340px 1fr',
          backgroundColor: 'white',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          height: 'calc(100vh - 220px)',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          marginTop: '0.5rem'
        }}>
          {/* Left Column: Workshops & Announcements Menu */}
          <div style={{
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#f8fafc',
            height: '100%',
            overflow: 'hidden'
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
                  🏭 Talleres
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
                workshops.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    No hay talleres satélite registrados.
                  </div>
                ) : (
                  (() => {
                    const workshopRoomsMap = workshops.map(w => {
                      const room = chatRooms.find(r => r.workshop_id === w.id);
                      return {
                        workshop: w,
                        room: room,
                        unread_count_erp: room?.unread_count_erp || 0,
                        last_message: room?.last_message || 'Inicia una conversación...',
                        last_message_time: room?.last_message_time || null
                      };
                    }).sort((a, b) => {
                      const timeA = a.last_message_time ? new Date(a.last_message_time).getTime() : 0;
                      const timeB = b.last_message_time ? new Date(b.last_message_time).getTime() : 0;
                      return timeB - timeA;
                    });

                    return workshopRoomsMap.map(({ workshop, room, unread_count_erp, last_message, last_message_time }) => (
                      <div
                        key={workshop.id}
                        onClick={() => selectWorkshopChat(workshop)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.85rem',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          backgroundColor: activeRoom?.workshop_id === workshop.id ? '#f1f5f9' : 'transparent',
                          transition: 'background-color 0.2s',
                          marginBottom: '0.25rem'
                        }}
                      >
                        <div style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '50%',
                          backgroundColor: '#fce7f3',
                          color: '#80082E',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '900',
                          fontSize: '1rem',
                          flexShrink: 0
                        }}>
                          🏭
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                            <span style={{ fontSize: '0.825rem', fontWeight: '850', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {workshop.nombre_taller}
                            </span>
                            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              {last_message_time ? new Date(last_message_time).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                              {last_message}
                            </span>
                            {unread_count_erp > 0 && (
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
                              }}>{unread_count_erp}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ));
                  })()
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
            background: '#efeae2 url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png") repeat',
            height: '100%',
            overflow: 'hidden'
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
                        placeholder="Ej: Ajuste de Tarifas Confección"
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
                        placeholder="Escribe el comunicado oficial para que aparezca en la campana de todos los talleres y puntos de venta..."
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
                  <h4 style={{ margin: 0, fontWeight: '850', fontSize: '1rem', color: '#0f172a' }}>Módulo de Chat con Talleres Satélite</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.8 }}>Selecciona un taller de la lista para ver el chat en vivo.</p>
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
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
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#fce7f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                      🏭
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: '900', color: '#0f172a' }}>{activeRoom.name}</h4>
                      <span style={{ fontSize: '0.65rem', color: '#16a34a', fontWeight: '750' }}>Taller satélite conectado</span>
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
                        Comienza a escribir. Tu mensaje aparecerá inmediatamente en el portal del taller.
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
                      placeholder="Escribe un mensaje para el taller..."
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

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(6px)' }}>
          <div className="card" style={{ width: '95%', maxWidth: '560px', padding: '0', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '1.25rem 1.75rem', background: 'var(--primary)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.125rem', color: 'white' }}>{editingId ? 'Editar Taller' : 'Registrar Nuevo Taller'}</h2>
              <button onClick={() => setShowModal(false)} style={{ color: 'white', background: 'rgba(255,255,255,0.1)', border: 'none', padding: '0.4rem', borderRadius: '50%', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.35rem' }}>Nombre del Taller *</label>
                  <input
                    type="text" placeholder="Ej: Taller San José"
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                    value={form.nombre_taller}
                    onChange={e => setForm({ ...form, nombre_taller: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.35rem' }}>Responsable</label>
                  <input
                    type="text" placeholder="Nombre del encargado"
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                    value={form.responsable}
                    onChange={e => setForm({ ...form, responsable: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.35rem' }}>Teléfono</label>
                  <input
                    type="text" placeholder="310 123 4567"
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                    value={form.telefono}
                    onChange={e => setForm({ ...form, telefono: e.target.value })}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.35rem' }}>Dirección</label>
                  <input
                    type="text" placeholder="Calle 45 # 12-34"
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                    value={form.direccion}
                    onChange={e => setForm({ ...form, direccion: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.35rem' }}>Especialidad</label>
                  <input
                    type="text" placeholder="Ej: Camisas / Blusas"
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                    value={form.especialidad}
                    onChange={e => setForm({ ...form, especialidad: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.35rem' }}>Capacidad Mensual (pnd)</label>
                  <input
                    type="number" min="0" placeholder="5000"
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                    value={form.capacidad_mensual}
                    onChange={e => setForm({ ...form, capacidad_mensual: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.35rem' }}>Estado</label>
                  <select
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                    value={form.activo ? 'true' : 'false'}
                    onChange={e => setForm({ ...form, activo: e.target.value === 'true' })}
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
                
                <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.8rem', fontWeight: '900', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    💵 Tarifas de Descuento por Defectos ($) y Empaque
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', marginBottom: '0.25rem' }}>Costuras ($)</label>
                      <input
                        type="number" min="0" placeholder="500"
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.8rem' }}
                        value={form.desc_costuras || ''}
                        onChange={e => setForm({ ...form, desc_costuras: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', marginBottom: '0.25rem' }}>Lavandería ($)</label>
                      <input
                        type="number" min="0" placeholder="500"
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.8rem' }}
                        value={form.desc_lavanderia || ''}
                        onChange={e => setForm({ ...form, desc_lavanderia: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', marginBottom: '0.25rem' }}>📦 Empaque por Prenda ($)</label>
                      <input
                        type="number" min="0" placeholder="0"
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #bbf7d0', fontSize: '0.8rem', backgroundColor: '#f0fdf4' }}
                        value={form.desc_empaque || ''}
                        onChange={e => setForm({ ...form, desc_empaque: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.875rem', justifyContent: 'center' }}
                disabled={saving}
                onClick={handleSave}
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> {editingId ? 'Guardar Cambios' : 'Crear Taller'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Orders Modal / Report */}
      {selectedWorkshopForOrders && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)', padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '750px', padding: '0', maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: '20px', overflow: 'hidden', backgroundColor: 'white' }}>
            <div style={{ padding: '1.25rem 2rem', background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '950', color: 'white', margin: 0 }}>Reporte de Carga de Taller</h2>
                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.85)', margin: '0.15rem 0 0', fontWeight: '600' }}>Taller: {selectedWorkshopForOrders.nombre_taller}</p>
              </div>
              <button onClick={() => setSelectedWorkshopForOrders(null)} style={{ color: 'white', background: 'rgba(255,255,255,0.15)', border: 'none', padding: '0.5rem', cursor: 'pointer', borderRadius: '50%', display: 'flex' }}>
                <X size={18} />
              </button>
            </div>
            
            <div style={{ padding: '2rem', overflowY: 'auto', flex: 1, backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {loadingOrders ? (
                <div style={{ textAlign: 'center', padding: '4rem' }}><Loader2 className="animate-spin" size={32} style={{ margin: 'auto', color: '#7c3aed' }} /></div>
              ) : workshopOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#64748b', backgroundColor: 'white', borderRadius: '16px', border: '2px dashed #cbd5e1' }}>
                  <Search size={40} style={{ opacity: 0.15, margin: '0 auto 1rem' }} />
                  <p style={{ margin: 0, fontWeight: '850', fontSize: '1rem', color: '#0f172a' }}>No hay órdenes asignadas a este taller.</p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>Las asignaciones se realizan en el Wizard de Confección.</p>
                </div>
              ) : (
                <>
                  {/* KPI Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                    {[
                      {
                        label: 'Órdenes Pendientes',
                        value: workshopOrders.filter(o => o.isPending).length,
                        color: '#3b82f6',
                        desc: 'En producción'
                      },
                      {
                        label: 'Prendas Pendientes',
                        value: workshopOrders.reduce((sum, o) => sum + o.pendingGarments, 0),
                        color: '#eab308',
                        desc: 'Unidades en costura'
                      },
                      {
                        label: 'Kilos de Tela Enviados',
                        value: `${workshopOrders.reduce((sum, o) => sum + o.workshopKilos, 0).toFixed(1)} kg`,
                        color: '#10b981',
                        desc: 'Peso total enviado'
                      }
                    ].map((kpi, idx) => (
                      <div key={idx} style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
                        <p style={{ fontSize: '0.625rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{kpi.label}</p>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '950', margin: '0.2rem 0', color: kpi.color }}>{kpi.value}</h3>
                        <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: 0 }}>{kpi.desc}</p>
                      </div>
                    ))}
                  </div>

                  {/* Orders Detail Table */}
                  <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '850', color: '#475569' }}>Orden</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '850', color: '#475569' }}>Cliente / Tela</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '850', color: '#475569' }}>Prendas Totales</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '850', color: '#475569' }}>Prendas Pendientes</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '850', color: '#475569' }}>Kilos</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: '850', color: '#475569' }}>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {workshopOrders.map(order => {
                            const isPending = order.isPending;
                            const statusColor = order.status === 'En Confección' ? { bg: '#eff6ff', color: '#2563eb' }
                              : order.status === 'Terminada' ? { bg: '#f0fdf4', color: '#16a34a' }
                              : { bg: '#f1f5f9', color: '#475569' };

                            const hasChildren = (order.childOrders || []).length > 0;

                            return (
                              <React.Fragment key={order.id}>
                                <tr style={{ borderBottom: hasChildren ? 'none' : '1px solid #f1f5f9', backgroundColor: order.order_internal_code?.startsWith('CMP-P-') ? '#f0fdf4' : 'white' }}>
                                  <td style={{ padding: '0.75rem 1rem', fontWeight: '900', color: '#7c3aed' }}>
                                    <div>OC-{order.internal_code}</div>
                                    {order.order_internal_code?.startsWith('CMP-P-') && (
                                      <span style={{ fontSize: '0.63rem', fontWeight: 900, color: '#15803d', backgroundColor: '#dcfce7', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid #86efac' }}>
                                        ⭐ Orden Principal (A Liquidar)
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ padding: '0.75rem 1rem' }}>
                                    <div style={{ fontWeight: '700', color: '#0f172a' }}>{order.client_name}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Ref: {order.productName} · Tela: {order.fabrics?.nombre_tela || 'Tela Externa'}</div>
                                  </td>
                                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '850', color: '#0f172a' }}>
                                    {order.workshopGarments} <span style={{ fontSize: '0.65rem', color: '#64748b' }}>prendas</span>
                                  </td>
                                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '800', color: isPending ? '#eab308' : '#94a3b8' }}>
                                    {order.pendingGarments}
                                  </td>
                                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '700' }}>
                                    {Number(order.workshopKilos || 0).toFixed(2)} kg
                                  </td>
                                  <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                    <span style={{ padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '0.625rem', fontWeight: '800', backgroundColor: statusColor.bg, color: statusColor.color, whiteSpace: 'nowrap' }}>
                                      {order.status.toUpperCase()}
                                    </span>
                                  </td>
                                </tr>

                                {/* Fila Informativa Anidada de Órdenes Secundarias (Telas de Complemento) */}
                                {hasChildren && (
                                  <tr style={{ borderBottom: '1.5px solid #cbd5e1', backgroundColor: '#ecfdf5' }}>
                                    <td colSpan={6} style={{ padding: '0.65rem 1rem 0.85rem 2.25rem' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                        <span style={{ fontSize: '0.72rem', fontWeight: '950', color: '#047857', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                          🎨 ÓRDENES SECUNDARIAS COMPLEMENTARIAS ARRASTRADAS (Telas de complemento entregadas con el lote):
                                        </span>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                                          {order.childOrders.map((ch: any) => (
                                            <div key={ch.id} style={{ fontSize: '0.7rem', fontWeight: '850', backgroundColor: '#ffffff', color: '#065f46', padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid #6ee7b7', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                              <span>🎨 Lote Secundario: <strong style={{ color: '#047857' }}>OC-{ch.internal_code}</strong></span>
                                              <span style={{ color: '#a7f3d0' }}>•</span>
                                              <span>Tela: <strong>{ch.fabrics?.nombre_tela || 'Secundaria'}</strong></span>
                                              <span style={{ color: '#a7f3d0' }}>•</span>
                                              <span>Ref: {ch.productName}</span>
                                              <span style={{ color: '#a7f3d0' }}>•</span>
                                              <span><strong>{ch.workshopGarments}</strong> prendas ({ch.workshopKilos} kg)</span>
                                              <span style={{ fontSize: '0.62rem', fontWeight: 900, color: '#065f46', backgroundColor: '#d1fae5', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid #6ee7b7' }}>ℹ️ Material Informativo (Sin costo adic.)</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
