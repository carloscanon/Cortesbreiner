'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  RefreshCw, Search, Barcode, ArrowLeftRight, CheckCircle2,
  AlertTriangle, DollarSign, X, ShoppingCart, Plus, Minus, Trash2,
  FileText, User, Phone, CreditCard, ShieldCheck, Printer, Check,
  ChevronRight, Sparkles, Store, Package, Layers
} from 'lucide-react';

interface POSExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStore: any;
  currentSession: any;
  currentUser: any;
  userProfile: any;
  products: any[];
  colors: any[];
  sizes: any[];
  inventoryList: any[];
  onExchangeCompleted?: () => void;
  deductStockFn: (params: any) => Promise<void>;
}

export default function POSExchangeModal({
  isOpen,
  onClose,
  currentStore,
  currentSession,
  currentUser,
  userProfile,
  products,
  colors,
  sizes,
  inventoryList,
  onExchangeCompleted,
  deductStockFn
}: POSExchangeModalProps) {
  // Step navigation: 1: Search Invoice, 2: Select Returned Items, 3: Select New Items & Review, 4: Payment/Complete
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Search invoice states
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [foundSales, setFoundSales] = useState<any[]>([]);
  const [selectedSale, setSelectedSale] = useState<any | null>(null);

  // Return items states
  const [selectedReturnItems, setSelectedReturnItems] = useState<any[]>([]);
  const [returnReason, setReturnReason] = useState<string>('Cambio de Talla');
  const [returnCondition, setReturnCondition] = useState<'perfecto' | 'defecto'>('perfecto');
  const [returnNotes, setReturnNotes] = useState('');

  // Replacement items states
  const [newCart, setNewCart] = useState<any[]>([]);
  const [newBarcodeQuery, setNewBarcodeQuery] = useState('');
  const [newSearchQuery, setNewSearchQuery] = useState('');
  const [selectedNewProduct, setSelectedNewProduct] = useState<any | null>(null);
  const [selectedNewColor, setSelectedNewColor] = useState<string>('');
  const [selectedNewSize, setSelectedNewSize] = useState<string>('');
  const [newGarmentQty, setNewGarmentQty] = useState<number>(1);

  // Payment states for surplus
  const [paymentMethod, setPaymentMethod] = useState<string>('Efectivo');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [transferRef, setTransferRef] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedExchange, setCompletedExchange] = useState<any | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSearchQuery('');
      setFoundSales([]);
      setSelectedSale(null);
      setSelectedReturnItems([]);
      setNewCart([]);
      setReturnReason('Cambio de Talla');
      setReturnCondition('perfecto');
      setReturnNotes('');
      setPaymentMethod('Efectivo');
      setCashTendered('');
      setTransferRef('');
      setCompletedExchange(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 1. Search Sales / Invoices by Client Name, Document, Phone, Consecutive, or Barcode
  const handleSearchSales = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    try {
      let salesResults: any[] = [];

      // Check if it's a numeric consecutive (e.g. 49)
      const numConsecutive = parseInt(query, 10);

      // Search in pos_sales
      let posQuery = supabase
        .from('pos_sales')
        .select('*, pos_sale_items(*, products(*), colors(*), sizes(*)), pos_payments(*)')
        .order('created_at', { ascending: false })
        .limit(25);

      if (!isNaN(numConsecutive) && String(numConsecutive) === query) {
        posQuery = posQuery.or(`consecutive.eq.${numConsecutive},client_document.ilike.%${query}%,client_name.ilike.%${query}%`);
      } else {
        posQuery = posQuery.or(`client_name.ilike.%${query}%,client_document.ilike.%${query}%,observaciones.ilike.%${query}%`);
      }

      const { data: posData, error: posErr } = await posQuery;
      if (!posErr && posData) {
        salesResults = [...posData];
      }

      // Also search by individual barcode tag if entered
      if (query.length >= 6) {
        const { data: garment } = await supabase
          .from('individual_garments')
          .select('*')
          .eq('barcode', query)
          .maybeSingle();

        if (garment && salesResults.length === 0) {
          // Look for sales containing products of this garment reference
          const { data: gSales } = await supabase
            .from('pos_sales')
            .select('*, pos_sale_items(*, products(*), colors(*), sizes(*)), pos_payments(*)')
            .order('created_at', { ascending: false })
            .limit(10);

          if (gSales) {
            salesResults = [...salesResults, ...gSales];
          }
        }
      }

      // Search in SIIGO Invoices if few results
      if (salesResults.length === 0) {
        const { data: siigoInvs } = await supabase
          .from('siigo_invoices')
          .select('*')
          .or(`consecutive.ilike.%${query}%,customer_identification.ilike.%${query}%`)
          .limit(10);

        if (siigoInvs && siigoInvs.length > 0) {
          const mappedSiigo = siigoInvs.map((inv: any) => ({
            id: inv.id,
            consecutive: inv.consecutive,
            client_name: inv.customer_identification ? `Cliente NIT/CC ${inv.customer_identification}` : 'Cliente SIIGO',
            client_document: inv.customer_identification || '',
            vendedor: 'SIIGO Facturación',
            subtotal: inv.total || 0,
            descuento: 0,
            impuestos: 0,
            total: inv.total || 0,
            estado: 'completada',
            created_at: inv.created_at || inv.date,
            observaciones: inv.observations || 'Factura Electrónica SIIGO',
            pos_sale_items: Array.isArray(inv.items) ? inv.items.map((it: any, idx: number) => ({
              id: `siigo-item-${idx}`,
              cantidad: it.quantity || 1,
              precio_unitario: it.price || 0,
              total: (it.price || 0) * (it.quantity || 1),
              products: {
                id: it.product_id || `siigo-p-${idx}`,
                nombre_producto: it.description || it.code || 'Prenda SIIGO',
                codigo_referencia: it.code || 'REF-SIIGO'
              },
              colors: null,
              sizes: null
            })) : []
          }));
          salesResults = [...salesResults, ...mappedSiigo];
        }
      }

      setFoundSales(salesResults);
      if (salesResults.length === 0) {
        alert('No se encontraron facturas o ventas con los datos ingresados. Intenta con cédula, nombre, teléfono o número de factura.');
      }
    } catch (err: any) {
      console.error('Error searching sales:', err);
      alert('Error en la búsqueda: ' + err.message);
    } finally {
      setIsSearching(false);
    }
  };

  // Select a sale to exchange
  const handleSelectSale = (sale: any) => {
    setSelectedSale(sale);
    setSelectedReturnItems([]);
    setStep(2);
  };

  // Toggle return item selection
  const toggleReturnItem = (item: any) => {
    const exists = selectedReturnItems.find(r => r.id === item.id);
    if (exists) {
      setSelectedReturnItems(selectedReturnItems.filter(r => r.id !== item.id));
    } else {
      setSelectedReturnItems([...selectedReturnItems, {
        ...item,
        returnQty: 1,
        creditPrice: Number(item.precio_unitario || item.total || 0)
      }]);
    }
  };

  // Direct Barcode Scanning for New Item
  const handleScanNewBarcode = async (barcodeVal: string) => {
    const term = barcodeVal.trim();
    if (!term) return;

    try {
      const { data: garment } = await supabase
        .from('individual_garments')
        .select('*')
        .eq('barcode', term)
        .maybeSingle();

      let targetProduct: any = null;
      let targetColor: any = null;
      let targetSize: any = null;

      if (garment) {
        const cleanRef = (garment.reference_name || '').toLowerCase().trim();
        targetProduct = products.find(p => {
          const pName = (p.nombre_producto || '').toLowerCase().trim();
          const pRef = (p.codigo_referencia || '').toLowerCase().trim();
          return (pRef && cleanRef.includes(pRef)) || (pName && cleanRef.includes(pName)) || (pName && pName.includes(cleanRef));
        }) || products[0];

        if (garment.color_name) {
          const gCol = garment.color_name.toLowerCase().trim();
          targetColor = colors.find(c => (c.nombre_color || '').toLowerCase().trim() === gCol);
        }
        if (garment.size_code) {
          const gSz = garment.size_code.toLowerCase().trim();
          targetSize = sizes.find(s => (s.codigo_talla || s.nombre_talla || '').toLowerCase().trim() === gSz);
        }
      } else {
        // Search in products by code
        targetProduct = products.find(p => (p.codigo_referencia || '').toLowerCase() === term.toLowerCase());
      }

      if (targetProduct) {
        addNewItemToExchangeCart(targetProduct, targetColor?.id || null, targetSize?.id || null, 1);
        setNewBarcodeQuery('');
      } else {
        alert(`No se encontró ningún producto con el código "${term}". Puedes buscarlo manualmente.`);
      }
    } catch (err: any) {
      console.error('Error scanning barcode in exchange:', err);
    }
  };

  // Add new item to exchange cart
  const addNewItemToExchangeCart = (prod: any, colorId: string | null, sizeId: string | null, qty: number = 1) => {
    const colObj = colors.find(c => c.id === colorId);
    const szObj = sizes.find(s => s.id === sizeId);
    const unitPrice = Number(prod.precio || 35000);

    const existingIdx = newCart.findIndex(
      it => it.product_id === prod.id && it.color_id === colorId && it.size_id === sizeId
    );

    if (existingIdx !== -1) {
      const updated = [...newCart];
      updated[existingIdx].cantidad += qty;
      updated[existingIdx].subtotal = updated[existingIdx].cantidad * unitPrice;
      setNewCart(updated);
    } else {
      setNewCart([...newCart, {
        product_id: prod.id,
        nombre: prod.nombre_producto,
        codigo_referencia: prod.codigo_referencia,
        precio: unitPrice,
        color_id: colorId,
        size_id: sizeId,
        color_name: colObj ? colObj.nombre_color : 'Estándar',
        size_name: szObj ? (szObj.codigo_talla || szObj.nombre_talla) : 'Única',
        cantidad: qty,
        subtotal: unitPrice * qty
      }]);
    }

    // Reset selection modal
    setSelectedNewProduct(null);
    setSelectedNewColor('');
    setSelectedNewSize('');
  };

  // Update quantity of new item
  const handleUpdateNewQty = (index: number, delta: number) => {
    const updated = [...newCart];
    updated[index].cantidad += delta;
    if (updated[index].cantidad <= 0) {
      updated.splice(index, 1);
    } else {
      updated[index].subtotal = updated[index].cantidad * updated[index].precio;
    }
    setNewCart(updated);
  };

  // Calculations
  const totalCreditAmount = selectedReturnItems.reduce(
    (sum, it) => sum + (Number(it.creditPrice || it.precio_unitario || 0) * (Number(it.returnQty) || 1)),
    0
  );

  const totalNewAmount = newCart.reduce(
    (sum, it) => sum + Number(it.subtotal || 0),
    0
  );

  // Surplus calculation
  // Rule: totalNewAmount >= totalCreditAmount
  const surplusAmount = Math.max(0, totalNewAmount - totalCreditAmount);
  const creditDeficit = totalCreditAmount - totalNewAmount; // If > 0, replacement is cheaper than return (NOT ALLOWED)
  const isExchangeValid = totalCreditAmount > 0 && newCart.length > 0 && totalNewAmount >= totalCreditAmount;

  // Change / Vueltas for Cash payment
  const cashNum = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, cashNum - surplusAmount);

  // Process Exchange in Database
  const handleProcessExchange = async () => {
    if (!isExchangeValid) {
      alert(`⚠️ Regla de Cambio: El valor total de las prendas nuevas ($${totalNewAmount.toLocaleString('es-CO')}) debe ser igual o superior al saldo a favor ($${totalCreditAmount.toLocaleString('es-CO')}).`);
      return;
    }

    if (surplusAmount > 0 && paymentMethod === 'Efectivo' && cashNum > 0 && cashNum < surplusAmount) {
      alert('El monto en efectivo ingresado es menor al excedente a pagar.');
      return;
    }

    setIsProcessing(true);
    try {
      const storeName = currentStore?.nombre || 'POS';
      const prefix = storeName.substring(0, 3).toUpperCase();
      const vendedorName = userProfile?.full_name || currentUser?.email || 'Vendedor POS';

      // 1. REINGRESAR PRENDA(S) DEVUELTA(S) AL INVENTARIO DE LA TIENDA
      for (const retItem of selectedReturnItems) {
        if (returnCondition === 'perfecto') {
          // Reingresa al stock sumando la cantidad (-qty deducción = suma)
          await deductStockFn({
            store: currentStore,
            cartItem: {
              product_id: retItem.products?.id || retItem.product_id,
              color_id: retItem.colors?.id || retItem.color_id || null,
              size_id: retItem.sizes?.id || retItem.size_id || null,
              nombre: retItem.products?.nombre_producto || 'Prenda Devuelta',
              codigo_referencia: retItem.products?.codigo_referencia || '',
              precio: retItem.creditPrice,
              cantidad: -(retItem.returnQty || 1) // Negativo para que sume a la tienda
            },
            consecutive: `DEV-${selectedSale?.consecutive || '0000'}`,
            vendedor: vendedorName,
            productsList: products,
            colorsList: colors,
            sizesList: sizes,
            inventoryList: inventoryList
          });
        } else {
          // Prenda con Defecto -> Se registra en Kardex como Rechazo de Calidad
          try {
            await supabase.from('finished_goods_kardex').insert([{
              warehouse_dest_id: currentStore.bodega_asociada_id || null,
              product_id: retItem.products?.id || retItem.product_id,
              color_id: retItem.colors?.id || retItem.color_id || null,
              size_id: retItem.sizes?.id || retItem.size_id || null,
              tipo_movimiento: 'Rechazo Calidad POS (Garantía)',
              cantidad: retItem.returnQty || 1,
              saldo_anterior: 0,
              saldo_nuevo: 0,
              documento_origen: `Cambio/Garantía Factura #${selectedSale?.consecutive || '0000'}`,
              usuario: vendedorName
            }]);
          } catch (kErr) {
            console.warn('Defect kardex warning:', kErr);
          }
        }
      }

      // 2. DESCONTAR NUEVA(S) PRENDA(S) ENTREGADA(S) DEL INVENTARIO
      for (const newItem of newCart) {
        await deductStockFn({
          store: currentStore,
          cartItem: {
            product_id: newItem.product_id,
            color_id: newItem.color_id,
            size_id: newItem.size_id,
            nombre: newItem.nombre,
            codigo_referencia: newItem.codigo_referencia,
            precio: newItem.precio,
            cantidad: newItem.cantidad
          },
          consecutive: `CAMBIO-${selectedSale?.consecutive || '0000'}`,
          vendedor: vendedorName,
          productsList: products,
          colorsList: colors,
          sizesList: sizes,
          inventoryList: inventoryList
        });
      }

      // 3. REGISTRAR LA TRANSACCIÓN DE VENTA/CAMBIO EN `pos_sales`
      const exchangeNotes = `[CAMBIO DE PRENDA] Factura Origen: #${selectedSale?.consecutive || '0000'} | Saldo a Favor: $${totalCreditAmount.toLocaleString('es-CO')} | Nuevas Prendas: $${totalNewAmount.toLocaleString('es-CO')} | Excedente Cobrado: $${surplusAmount.toLocaleString('es-CO')} (${surplusAmount > 0 ? paymentMethod : 'Sin Excedente'}) | Motivo: ${returnReason} | Condición: ${returnCondition === 'perfecto' ? 'Perfecto Estado (Reingresada)' : 'Con Defecto (Garantía)'}${returnNotes ? ' | Obs: ' + returnNotes : ''}${transferRef ? ' | Ref Transf: ' + transferRef : ''}`;

      const { data: newSale, error: saleErr } = await supabase
        .from('pos_sales')
        .insert([{
          session_id: currentSession?.id || null,
          store_id: currentStore?.id || null,
          client_id: selectedSale?.client_id || null,
          client_name: selectedSale?.client_name || 'Cliente General',
          client_document: selectedSale?.client_document || '2222222222',
          vendedor: vendedorName,
          subtotal: totalNewAmount,
          descuento: totalCreditAmount, // Descuento/Crédito aplicado por la prenda devuelta
          impuestos: 0,
          total: surplusAmount, // Total cobrado al cliente en caja
          estado: 'completada',
          sincronizado_erp: false,
          observaciones: exchangeNotes
        }])
        .select()
        .single();

      if (saleErr) throw saleErr;

      // Guardar los items entregados en `pos_sale_items`
      for (const newItem of newCart) {
        await supabase.from('pos_sale_items').insert({
          sale_id: newSale.id,
          product_id: newItem.product_id,
          color_id: newItem.color_id,
          size_id: newItem.size_id,
          cantidad: newItem.cantidad,
          precio_unitario: newItem.precio,
          subtotal: newItem.subtotal,
          total: newItem.subtotal
        });
      }

      // Guardar el pago del excedente si hubo
      if (surplusAmount > 0) {
        await supabase.from('pos_payments').insert({
          sale_id: newSale.id,
          metodo_pago: paymentMethod + (transferRef ? ` (Ref: ${transferRef})` : ''),
          monto: surplusAmount,
          detalles: {
            tipo: 'Excedente de Cambio',
            efectivo_recibido: cashNum || surplusAmount,
            cambio_devuelto: changeDue
          }
        });
      }

      // Intentar registrar en tabla dedicada `pos_exchanges` (si existe en base de datos)
      try {
        await supabase.from('pos_exchanges').insert([{
          store_id: currentStore?.id || null,
          session_id: currentSession?.id || null,
          original_sale_id: selectedSale?.id || null,
          original_consecutive: String(selectedSale?.consecutive || ''),
          client_name: selectedSale?.client_name || 'Cliente General',
          client_document: selectedSale?.client_document || '',
          vendedor: vendedorName,
          returned_items: selectedReturnItems,
          new_items: newCart,
          credit_amount: totalCreditAmount,
          new_total: totalNewAmount,
          surplus_amount: surplusAmount,
          payment_method: surplusAmount > 0 ? paymentMethod : 'Mano a Mano ($0)',
          payment_details: { transferRef, cashNum, changeDue },
          reason: returnReason,
          defect_condition: returnCondition,
          notes: returnNotes
        }]);
      } catch (exErr) {
        console.warn('pos_exchanges table optional log:', exErr);
      }

      const completedData = {
        exchangeNumber: `CAM-${prefix}-${String(newSale.consecutive).padStart(4, '0')}`,
        originalConsecutive: selectedSale?.consecutive || 'N/A',
        storeName: currentStore?.nombre || 'Tienda Principal',
        vendedor: vendedorName,
        clientName: selectedSale?.client_name || 'Cliente General',
        clientDocument: selectedSale?.client_document || '2222222222',
        returnedItems: selectedReturnItems,
        newItems: newCart,
        creditAmount: totalCreditAmount,
        newTotal: totalNewAmount,
        surplusAmount: surplusAmount,
        paymentMethod: surplusAmount > 0 ? paymentMethod : 'Sin Excedente',
        changeDue: changeDue,
        date: new Date().toLocaleString('es-CO')
      };

      setCompletedExchange(completedData);
      setStep(4);

      if (onExchangeCompleted) {
        onExchangeCompleted();
      }
    } catch (err: any) {
      console.error('Error processing exchange:', err);
      alert('Error procesando el cambio en base de datos: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1rem'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '1050px',
        maxHeight: '92vh',
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid #e2e8f0'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 2rem',
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(244, 63, 94, 0.4)'
            }}>
              <RefreshCw size={22} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Módulo de Cambios y Garantías POS
                <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: '20px', backgroundColor: 'rgba(255,255,255,0.2)', fontWeight: '700' }}>
                  {currentStore?.nombre || 'Tienda'}
                </span>
              </h2>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                Búsqueda por factura/cédula/nombre, validación de prenda, cambio por valor igual o superior y cobro de excedente
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Step Indicators */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(255,255,255,0.08)', padding: '0.35rem 0.75rem', borderRadius: '12px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: step === 1 ? '900' : '600', color: step === 1 ? '#38bdf8' : '#94a3b8' }}>1. Factura</span>
              <ChevronRight size={14} color="#64748b" />
              <span style={{ fontSize: '0.75rem', fontWeight: step === 2 ? '900' : '600', color: step === 2 ? '#38bdf8' : '#94a3b8' }}>2. Prenda Origen</span>
              <ChevronRight size={14} color="#64748b" />
              <span style={{ fontSize: '0.75rem', fontWeight: step === 3 ? '900' : '600', color: step === 3 ? '#38bdf8' : '#94a3b8' }}>3. Nueva Prenda & Excedente</span>
            </div>

            <button
              onClick={onClose}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: 'rgba(255,255,255,0.1)',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.3)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.75rem', backgroundColor: '#f8fafc' }}>
          {/* ========================================================================= */}
          {/* STEP 1: SEARCH INVOICE / SALE */}
          {/* ========================================================================= */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{
                backgroundColor: '#ffffff',
                padding: '1.75rem',
                borderRadius: '18px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
              }}>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '850', color: '#1e293b', marginBottom: '0.75rem' }}>
                  🔍 Buscar Factura Original o Datos del Cliente
                </label>
                <form onSubmit={handleSearchSales} style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Digita Cédula / NIT, Nombre de cliente, Celular, o Número de Factura (ej: 49, FV-12-5969)..."
                      autoFocus
                      style={{
                        width: '100%',
                        padding: '0.85rem 1rem 0.85rem 2.85rem',
                        borderRadius: '12px',
                        border: '2px solid #cbd5e1',
                        fontSize: '0.95rem',
                        fontWeight: '600',
                        color: '#0f172a',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                        backgroundColor: '#f8fafc'
                      }}
                      onFocus={e => e.currentTarget.style.borderColor = '#ec4899'}
                      onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearching || !searchQuery.trim()}
                    style={{
                      padding: '0.85rem 1.75rem',
                      borderRadius: '12px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
                      color: '#ffffff',
                      fontWeight: '850',
                      fontSize: '0.9rem',
                      cursor: isSearching || !searchQuery.trim() ? 'not-allowed' : 'pointer',
                      opacity: isSearching || !searchQuery.trim() ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 4px 12px rgba(244,63,94,0.3)'
                    }}
                  >
                    {isSearching ? <RefreshCw size={18} className="animate-spin" /> : <Search size={18} />}
                    Buscar Factura
                  </button>
                </form>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '700' }}>Consejos de búsqueda:</span>
                  <span style={{ fontSize: '0.78rem', backgroundColor: '#f1f5f9', color: '#334155', padding: '0.2rem 0.6rem', borderRadius: '6px', fontWeight: '600' }}>🆔 Cédula / Documento</span>
                  <span style={{ fontSize: '0.78rem', backgroundColor: '#f1f5f9', color: '#334155', padding: '0.2rem 0.6rem', borderRadius: '6px', fontWeight: '600' }}>👤 Nombre completo</span>
                  <span style={{ fontSize: '0.78rem', backgroundColor: '#f1f5f9', color: '#334155', padding: '0.2rem 0.6rem', borderRadius: '6px', fontWeight: '600' }}>📱 Celular</span>
                  <span style={{ fontSize: '0.78rem', backgroundColor: '#f1f5f9', color: '#334155', padding: '0.2rem 0.6rem', borderRadius: '6px', fontWeight: '600' }}>🧾 N° Consecutivo Factura</span>
                </div>
              </div>

              {/* Found Sales Results List */}
              {foundSales.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '850', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={18} color="#ec4899" />
                    Facturas Encontradas ({foundSales.length})
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                    {foundSales.map((sale) => {
                      const itemsCount = (sale.pos_sale_items || []).reduce((sum: number, it: any) => sum + Number(it.cantidad || 1), 0);
                      const isAnulada = sale.estado === 'anulada';
                      return (
                        <div
                          key={sale.id}
                          onClick={() => !isAnulada && handleSelectSale(sale)}
                          style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '16px',
                            border: isAnulada ? '1.5px solid #cbd5e1' : '2px solid #e2e8f0',
                            padding: '1.25rem',
                            cursor: isAnulada ? 'not-allowed' : 'pointer',
                            opacity: isAnulada ? 0.6 : 1,
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: '0.75rem'
                          }}
                          onMouseEnter={e => {
                            if (!isAnulada) {
                              e.currentTarget.style.borderColor = '#ec4899';
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(236,72,153,0.15)';
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isAnulada) {
                              e.currentTarget.style.borderColor = '#e2e8f0';
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)';
                            }
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                              <span style={{
                                backgroundColor: '#fdf2f8',
                                color: '#be185d',
                                padding: '0.25rem 0.65rem',
                                borderRadius: '8px',
                                fontSize: '0.85rem',
                                fontWeight: '900',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                              }}>
                                🧾 Factura #{sale.consecutive}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>
                                {sale.created_at ? new Date(sale.created_at).toLocaleDateString('es-CO') : ''}
                              </span>
                            </div>

                            <div style={{ fontSize: '0.95rem', fontWeight: '850', color: '#0f172a', marginBottom: '0.2rem' }}>
                              {sale.client_name || 'Cliente General'}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                              <User size={13} /> CC/NIT: <strong style={{ color: '#334155' }}>{sale.client_document || 'N/A'}</strong>
                            </div>

                            {/* Items list preview */}
                            <div style={{
                              backgroundColor: '#f8fafc',
                              padding: '0.6rem 0.8rem',
                              borderRadius: '10px',
                              fontSize: '0.78rem',
                              color: '#475569',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.25rem',
                              maxHeight: '90px',
                              overflowY: 'auto'
                            }}>
                              {(sale.pos_sale_items || []).map((it: any, idx: number) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px', fontWeight: '600' }}>
                                    • {it.products?.nombre_producto || 'Prenda'} ({it.colors?.nombre_color || ''} {it.sizes?.codigo_talla || ''})
                                  </span>
                                  <span style={{ fontWeight: '800', color: '#0f172a' }}>
                                    ${Number(it.precio_unitario || it.total || 0).toLocaleString('es-CO')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderTop: '1px solid #f1f5f9',
                            paddingTop: '0.75rem'
                          }}>
                            <div>
                              <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', fontWeight: '700' }}>TOTAL PAGADO</span>
                              <span style={{ fontSize: '1.1rem', fontWeight: '950', color: '#059669' }}>
                                ${Number(sale.total || 0).toLocaleString('es-CO')}
                              </span>
                            </div>

                            <button
                              disabled={isAnulada}
                              style={{
                                backgroundColor: isAnulada ? '#cbd5e1' : '#ec4899',
                                color: '#ffffff',
                                border: 'none',
                                padding: '0.5rem 1rem',
                                borderRadius: '10px',
                                fontSize: '0.8rem',
                                fontWeight: '850',
                                cursor: isAnulada ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem'
                              }}
                            >
                              Seleccionar <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: SELECT RETURNED ITEMS & REASON */}
          {/* ========================================================================= */}
          {step === 2 && selectedSale && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Back button & Sale header */}
              <div style={{
                backgroundColor: '#ffffff',
                padding: '1.25rem 1.5rem',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button
                    onClick={() => setStep(1)}
                    style={{
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#f8fafc',
                      padding: '0.45rem 0.85rem',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: '800',
                      cursor: 'pointer',
                      color: '#475569'
                    }}
                  >
                    ← Cambiar Factura
                  </button>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '900', color: '#0f172a' }}>
                      Factura #{selectedSale.consecutive} — {selectedSale.client_name}
                    </h3>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      Doc: {selectedSale.client_document || 'N/A'} | Fecha: {new Date(selectedSale.created_at).toLocaleDateString('es-CO')}
                    </span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '700', display: 'block' }}>SALDO A FAVOR SELECCIONADO</span>
                  <span style={{ fontSize: '1.35rem', fontWeight: '950', color: '#ec4899' }}>
                    ${totalCreditAmount.toLocaleString('es-CO')} COP
                  </span>
                </div>
              </div>

              {/* Items selection container */}
              <div style={{
                backgroundColor: '#ffffff',
                padding: '1.5rem',
                borderRadius: '18px',
                border: '1px solid #e2e8f0'
              }}>
                <h4 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: '850', color: '#1e293b' }}>
                  👕 1. Marca la(s) prenda(s) que el cliente trae para cambio:
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {(selectedSale.pos_sale_items || []).map((item: any) => {
                    const isSelected = selectedReturnItems.some(r => r.id === item.id);
                    const prodName = item.products?.nombre_producto || 'Prenda';
                    const refCode = item.products?.codigo_referencia || '';
                    const colorName = item.colors?.nombre_color || 'Estándar';
                    const sizeCode = item.sizes?.codigo_talla || item.sizes?.nombre_talla || 'Única';
                    const unitPrice = Number(item.precio_unitario || item.total || 0);

                    return (
                      <div
                        key={item.id}
                        onClick={() => toggleReturnItem(item)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '1rem 1.25rem',
                          borderRadius: '14px',
                          border: isSelected ? '2px solid #ec4899' : '1.5px solid #e2e8f0',
                          backgroundColor: isSelected ? '#fdf2f8' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '6px',
                            border: isSelected ? '2px solid #ec4899' : '2px solid #94a3b8',
                            backgroundColor: isSelected ? '#ec4899' : '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {isSelected && <Check size={16} color="#ffffff" strokeWidth={3} />}
                          </div>

                          <div>
                            <div style={{ fontSize: '0.95rem', fontWeight: '850', color: '#0f172a' }}>
                              {prodName} {refCode && <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Ref: {refCode}</span>}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#475569', display: 'flex', gap: '0.75rem', marginTop: '0.15rem' }}>
                              <span>Color: <strong style={{ color: '#0f172a' }}>{colorName}</strong></span>
                              <span>•</span>
                              <span>Talla: <strong style={{ color: '#0f172a' }}>{sizeCode}</strong></span>
                              <span>•</span>
                              <span>Cant. comprada: <strong style={{ color: '#0f172a' }}>{item.cantidad || 1}</strong></span>
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>VALOR RECONOCIDO</span>
                          <span style={{ fontSize: '1.15rem', fontWeight: '900', color: isSelected ? '#ec4899' : '#0f172a' }}>
                            ${unitPrice.toLocaleString('es-CO')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reason and Condition selection */}
              {selectedReturnItems.length > 0 && (
                <div style={{
                  backgroundColor: '#ffffff',
                  padding: '1.5rem',
                  borderRadius: '18px',
                  border: '1px solid #e2e8f0',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1.5rem'
                }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '850', color: '#1e293b', marginBottom: '0.5rem' }}>
                      📋 Motivo del Cambio
                    </label>
                    <select
                      value={returnReason}
                      onChange={e => setReturnReason(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        borderRadius: '10px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        color: '#0f172a',
                        outline: 'none'
                      }}
                    >
                      <option value="Cambio de Talla">Cambio de Talla</option>
                      <option value="Cambio de Color">Cambio de Color</option>
                      <option value="Cambio por otra Referencia">Cambio por otra Referencia / Modelo</option>
                      <option value="Garantía / Defecto de Fábrica">Garantía / Defecto de Fábrica</option>
                      <option value="Gusto o Decisión del Cliente">Gusto / Decisión del Cliente</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '850', color: '#1e293b', marginBottom: '0.5rem' }}>
                      🛡️ Estado de la Prenda Recibida
                    </label>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button
                        type="button"
                        onClick={() => setReturnCondition('perfecto')}
                        style={{
                          flex: 1,
                          padding: '0.75rem',
                          borderRadius: '10px',
                          border: returnCondition === 'perfecto' ? '2px solid #10b981' : '1.5px solid #cbd5e1',
                          backgroundColor: returnCondition === 'perfecto' ? '#ecfdf5' : '#ffffff',
                          color: returnCondition === 'perfecto' ? '#047857' : '#475569',
                          fontWeight: '800',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        🌟 Perfecto Estado (Reingresar a Tienda)
                      </button>

                      <button
                        type="button"
                        onClick={() => setReturnCondition('defecto')}
                        style={{
                          flex: 1,
                          padding: '0.75rem',
                          borderRadius: '10px',
                          border: returnCondition === 'defecto' ? '2px solid #f59e0b' : '1.5px solid #cbd5e1',
                          backgroundColor: returnCondition === 'defecto' ? '#fffbeb' : '#ffffff',
                          color: returnCondition === 'defecto' ? '#b45309' : '#475569',
                          fontWeight: '800',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        ⚠️ Con Defecto (Bodega Rechazos)
                      </button>
                    </div>
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '850', color: '#1e293b', marginBottom: '0.5rem' }}>
                      📝 Observaciones Adicionales (Opcional)
                    </label>
                    <input
                      type="text"
                      value={returnNotes}
                      onChange={e => setReturnNotes(e.target.value)}
                      placeholder="Ej: Cliente solicitó talla M en lugar de S..."
                      style={{
                        width: '100%',
                        padding: '0.7rem 1rem',
                        borderRadius: '10px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '0.85rem',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  style={{
                    padding: '0.85rem 1.5rem',
                    borderRadius: '12px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontWeight: '800',
                    fontSize: '0.9rem',
                    cursor: 'pointer'
                  }}
                >
                  Atrás
                </button>

                <button
                  type="button"
                  disabled={selectedReturnItems.length === 0}
                  onClick={() => setStep(3)}
                  style={{
                    padding: '0.85rem 2rem',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
                    color: '#ffffff',
                    fontWeight: '850',
                    fontSize: '0.95rem',
                    cursor: selectedReturnItems.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: selectedReturnItems.length === 0 ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 12px rgba(244,63,94,0.3)'
                  }}
                >
                  Continuar a Selección de Nueva Prenda (${totalCreditAmount.toLocaleString('es-CO')}) <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: SELECT REPLACEMENT ITEMS & CALCULATE SURPLUS */}
          {/* ========================================================================= */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Top Financial Summary Banner */}
              <div style={{
                backgroundColor: '#ffffff',
                padding: '1.25rem 1.75rem',
                borderRadius: '18px',
                border: '1.5px solid #e2e8f0',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '1rem',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
              }}>
                <div style={{ borderRight: '1px solid #e2e8f0', paddingRight: '1rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '800', display: 'block' }}>1. SALDO A FAVOR (PRENDA DEVUELTA)</span>
                  <span style={{ fontSize: '1.35rem', fontWeight: '950', color: '#ec4899' }}>
                    ${totalCreditAmount.toLocaleString('es-CO')}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginTop: '0.1rem' }}>
                    {selectedReturnItems.length} prenda(s) devuelta(s)
                  </span>
                </div>

                <div style={{ borderRight: '1px solid #e2e8f0', paddingRight: '1rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '800', display: 'block' }}>2. TOTAL NUEVAS PRENDAS</span>
                  <span style={{ fontSize: '1.35rem', fontWeight: '950', color: '#0f172a' }}>
                    ${totalNewAmount.toLocaleString('es-CO')}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginTop: '0.1rem' }}>
                    {newCart.reduce((s, i) => s + i.cantidad, 0)} prenda(s) seleccionada(s)
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '800', display: 'block' }}>3. EXCEDENTE A COBRAR</span>
                  <span style={{ fontSize: '1.35rem', fontWeight: '950', color: surplusAmount > 0 ? '#2563eb' : '#059669' }}>
                    {surplusAmount > 0 ? `$${surplusAmount.toLocaleString('es-CO')}` : '$0 (Mano a Mano)'}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: surplusAmount > 0 ? '#2563eb' : '#059669', display: 'block', marginTop: '0.1rem', fontWeight: '700' }}>
                    {surplusAmount > 0 ? 'Cobro adicional al cliente' : 'Sin excedente requerido'}
                  </span>
                </div>
              </div>

              {/* Strict Business Rule Alert */}
              {newCart.length > 0 && totalNewAmount < totalCreditAmount && (
                <div style={{
                  backgroundColor: '#fef2f2',
                  border: '2px solid #ef4444',
                  borderRadius: '14px',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.85rem'
                }}>
                  <AlertTriangle size={24} color="#dc2626" style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: '850', color: '#991b1b' }}>
                      ⚠️ REGLA DE CAMBIO OBLIGATORIA: El valor de las nuevas prendas debe ser igual o superior al saldo a favor.
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#b91c1c', marginTop: '0.15rem' }}>
                      El valor actual (${totalNewAmount.toLocaleString('es-CO')}) es menor al saldo de la prenda devuelta (${totalCreditAmount.toLocaleString('es-CO')}). Faltan <strong>${creditDeficit.toLocaleString('es-CO')} COP</strong> en prendas para autorizar el cambio.
                    </div>
                  </div>
                </div>
              )}

              {/* Main Workspace: Left = Barcode & Catalog, Right = Selected New Items & Payment */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '1.5rem' }}>
                {/* Left Column: Fast Add / Catalog */}
                <div style={{
                  backgroundColor: '#ffffff',
                  padding: '1.5rem',
                  borderRadius: '18px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem'
                }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '850', color: '#1e293b', marginBottom: '0.5rem' }}>
                      🔫 Escanear Código de Barras de la Nueva Prenda
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <Barcode size={18} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                        <input
                          ref={barcodeInputRef}
                          type="text"
                          value={newBarcodeQuery}
                          onChange={e => setNewBarcodeQuery(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleScanNewBarcode(newBarcodeQuery);
                            }
                          }}
                          placeholder="Escanea con la pistola o digita código (ej: 0081995055)..."
                          style={{
                            width: '100%',
                            padding: '0.75rem 0.85rem 0.75rem 2.6rem',
                            borderRadius: '10px',
                            border: '1.5px solid #cbd5e1',
                            fontSize: '0.88rem',
                            outline: 'none',
                            backgroundColor: '#f8fafc'
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleScanNewBarcode(newBarcodeQuery)}
                        style={{
                          backgroundColor: '#0f172a',
                          color: '#ffffff',
                          border: 'none',
                          padding: '0.75rem 1.25rem',
                          borderRadius: '10px',
                          fontWeight: '800',
                          fontSize: '0.82rem',
                          cursor: 'pointer'
                        }}
                      >
                        Agregar
                      </button>
                    </div>
                  </div>

                  {/* Manual catalog filter */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '850', color: '#1e293b', marginBottom: '0.5rem' }}>
                      🔎 O Buscar Prenda en Catálogo
                    </label>
                    <input
                      type="text"
                      value={newSearchQuery}
                      onChange={e => setNewSearchQuery(e.target.value)}
                      placeholder="Buscar por nombre (ej: Top Lassie, Maya, Amelia)..."
                      style={{
                        width: '100%',
                        padding: '0.7rem 1rem',
                        borderRadius: '10px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '0.85rem',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Product Cards Grid */}
                  <div style={{
                    maxHeight: '320px',
                    overflowY: 'auto',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                    gap: '0.75rem',
                    paddingRight: '0.25rem'
                  }}>
                    {products
                      .filter(p => !newSearchQuery || (p.nombre_producto || '').toLowerCase().includes(newSearchQuery.toLowerCase()) || (p.codigo_referencia || '').includes(newSearchQuery))
                      .slice(0, 18)
                      .map(p => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedNewProduct(p);
                            setSelectedNewColor(colors[0]?.id || '');
                            setSelectedNewSize(sizes[0]?.id || '');
                          }}
                          style={{
                            border: selectedNewProduct?.id === p.id ? '2px solid #ec4899' : '1px solid #e2e8f0',
                            backgroundColor: selectedNewProduct?.id === p.id ? '#fdf2f8' : '#ffffff',
                            borderRadius: '12px',
                            padding: '0.75rem',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: '0.4rem',
                            transition: 'all 0.15s'
                          }}
                        >
                          <div style={{ fontSize: '0.82rem', fontWeight: '850', color: '#0f172a', lineHeight: 1.2 }}>
                            {p.nombre_producto}
                          </div>
                          {p.codigo_referencia && (
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              Ref: {p.codigo_referencia}
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: '950', color: '#ec4899' }}>
                              ${Number(p.precio || 35000).toLocaleString('es-CO')}
                            </span>
                            <button
                              type="button"
                              style={{
                                backgroundColor: '#ec4899',
                                color: '#ffffff',
                                border: 'none',
                                width: '24px',
                                height: '24px',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                              }}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* Color & Size Selector Drawer if product selected */}
                  {selectedNewProduct && (
                    <div style={{
                      backgroundColor: '#fdf2f8',
                      padding: '1rem',
                      borderRadius: '12px',
                      border: '1.5px solid #ec4899',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: '850', color: '#be185d' }}>
                          Configurar: {selectedNewProduct.nombre_producto}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedNewProduct(null)}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#be185d' }}
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: '#64748b', marginBottom: '0.25rem' }}>COLOR</label>
                          <select
                            value={selectedNewColor}
                            onChange={e => setSelectedNewColor(e.target.value)}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                          >
                            {colors.map(c => (
                              <option key={c.id} value={c.id}>{c.nombre_color}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: '#64748b', marginBottom: '0.25rem' }}>TALLA</label>
                          <select
                            value={selectedNewSize}
                            onChange={e => setSelectedNewSize(e.target.value)}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                          >
                            {sizes.map(s => (
                              <option key={s.id} value={s.id}>{s.codigo_talla || s.nombre_talla}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => addNewItemToExchangeCart(selectedNewProduct, selectedNewColor || null, selectedNewSize || null, 1)}
                        style={{
                          backgroundColor: '#ec4899',
                          color: '#ffffff',
                          border: 'none',
                          padding: '0.65rem',
                          borderRadius: '8px',
                          fontWeight: '850',
                          fontSize: '0.85rem',
                          cursor: 'pointer'
                        }}
                      >
                        + Agregar Prenda de Cambio al Carrito
                      </button>
                    </div>
                  )}
                </div>

                {/* Right Column: Selected Replacement Items & Surplus Payment */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{
                    backgroundColor: '#ffffff',
                    padding: '1.5rem',
                    borderRadius: '18px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                  }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '850', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <ShoppingCart size={18} color="#ec4899" />
                      Prendas de Reemplazo ({newCart.length})
                    </h4>

                    {newCart.length === 0 ? (
                      <div style={{
                        padding: '2rem 1rem',
                        textAlign: 'center',
                        color: '#94a3b8',
                        backgroundColor: '#f8fafc',
                        borderRadius: '12px',
                        border: '1.5px dashed #cbd5e1',
                        fontSize: '0.85rem'
                      }}>
                        Escanea o selecciona una prenda del catálogo a la izquierda para entregar al cliente.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '200px', overflowY: 'auto' }}>
                        {newCart.map((it, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '0.75rem 0.9rem',
                              backgroundColor: '#f8fafc',
                              borderRadius: '10px',
                              border: '1px solid #e2e8f0'
                            }}
                          >
                            <div style={{ maxWidth: '150px' }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: '850', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {it.nombre}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                {it.color_name} | Talla {it.size_name}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0.15rem' }}>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateNewQty(idx, -1)}
                                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0.2rem' }}
                                >
                                  <Minus size={12} />
                                </button>
                                <span style={{ fontSize: '0.82rem', fontWeight: '850', minWidth: '16px', textAlign: 'center' }}>
                                  {it.cantidad}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateNewQty(idx, 1)}
                                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0.2rem' }}
                                >
                                  <Plus size={12} />
                                </button>
                              </div>

                              <span style={{ fontSize: '0.9rem', fontWeight: '900', color: '#0f172a', minWidth: '70px', textAlign: 'right' }}>
                                ${(it.precio * it.cantidad).toLocaleString('es-CO')}
                              </span>

                              <button
                                type="button"
                                onClick={() => {
                                  const c = [...newCart];
                                  c.splice(idx, 1);
                                  setNewCart(c);
                                }}
                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', padding: '0.2rem' }}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Surplus Payment Section (If surplus > 0) */}
                  {surplusAmount > 0 && (
                    <div style={{
                      backgroundColor: '#eff6ff',
                      padding: '1.25rem',
                      borderRadius: '16px',
                      border: '1.5px solid #3b82f6',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: '850', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          💳 Método de Pago del Excedente (${surplusAmount.toLocaleString('es-CO')})
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                        {['Efectivo', 'Tarjeta', 'Transferencia'].map(m => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setPaymentMethod(m)}
                            style={{
                              padding: '0.6rem 0.5rem',
                              borderRadius: '8px',
                              border: paymentMethod === m ? '2px solid #2563eb' : '1px solid #bfdbfe',
                              backgroundColor: paymentMethod === m ? '#2563eb' : '#ffffff',
                              color: paymentMethod === m ? '#ffffff' : '#1e40af',
                              fontWeight: '850',
                              fontSize: '0.78rem',
                              cursor: 'pointer'
                            }}
                          >
                            {m}
                          </button>
                        ))}
                      </div>

                      {paymentMethod === 'Efectivo' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.25rem' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: '#1e40af', marginBottom: '0.2rem' }}>
                              Efectivo Recibido ($)
                            </label>
                            <input
                              type="number"
                              value={cashTendered}
                              onChange={e => setCashTendered(e.target.value)}
                              placeholder={`Mínimo: ${surplusAmount}`}
                              style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #bfdbfe', fontSize: '0.85rem', fontWeight: '700' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: '#1e40af', marginBottom: '0.2rem' }}>
                              Cambio / Vueltas
                            </label>
                            <div style={{ padding: '0.55rem', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #bfdbfe', fontSize: '0.9rem', fontWeight: '950', color: '#059669' }}>
                              ${changeDue.toLocaleString('es-CO')}
                            </div>
                          </div>
                        </div>
                      )}

                      {paymentMethod === 'Transferencia' && (
                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: '#1e40af', marginBottom: '0.2rem' }}>
                            N° Referencia o Comprobante de Transferencia
                          </label>
                          <input
                            type="text"
                            value={transferRef}
                            onChange={e => setTransferRef(e.target.value)}
                            placeholder="Ej: Aprobación #849302..."
                            style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #bfdbfe', fontSize: '0.85rem' }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Final Actions */}
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      style={{
                        padding: '0.85rem 1.25rem',
                        borderRadius: '12px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#475569',
                        fontWeight: '800',
                        fontSize: '0.88rem',
                        cursor: 'pointer'
                      }}
                    >
                      Atrás
                    </button>

                    <button
                      type="button"
                      disabled={!isExchangeValid || isProcessing}
                      onClick={handleProcessExchange}
                      style={{
                        flex: 1,
                        padding: '0.85rem 1.5rem',
                        borderRadius: '12px',
                        border: 'none',
                        background: !isExchangeValid ? '#cbd5e1' : surplusAmount > 0 ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                        color: '#ffffff',
                        fontWeight: '900',
                        fontSize: '0.95rem',
                        cursor: !isExchangeValid || isProcessing ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        boxShadow: isExchangeValid ? '0 4px 14px rgba(0,0,0,0.2)' : 'none'
                      }}
                    >
                      {isProcessing ? (
                        <>
                          <RefreshCw size={18} className="animate-spin" /> Procesando Cambio en BD...
                        </>
                      ) : surplusAmount > 0 ? (
                        <>
                          <CheckCircle2 size={18} /> Confirmar Cambio & Cobrar Excedente (${surplusAmount.toLocaleString('es-CO')})
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={18} /> Confirmar Cambio Mano a Mano ($0)
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 4: COMPLETED EXCHANGE RECEIPT / TICKET */}
          {/* ========================================================================= */}
          {step === 4 && completedExchange && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', padding: '1rem 0' }}>
              <div style={{
                width: '100%',
                maxWidth: '440px',
                backgroundColor: '#ffffff',
                borderRadius: '18px',
                border: '2px dashed #cbd5e1',
                padding: '2rem',
                boxShadow: '0 15px 30px rgba(0,0,0,0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                color: '#0f172a'
              }}>
                <div style={{ textAlign: 'center', borderBottom: '1px dashed #cbd5e1', paddingBottom: '1rem' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: '#ecfdf5',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 0.75rem'
                  }}>
                    <CheckCircle2 size={30} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '950', letterSpacing: '-0.02em' }}>
                    COMPROBANTE DE CAMBIO
                  </h3>
                  <div style={{ fontSize: '0.85rem', fontWeight: '850', color: '#ec4899', marginTop: '0.25rem' }}>
                    {completedExchange.exchangeNumber}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                    Factura Origen: #{completedExchange.originalConsecutive} | {completedExchange.date}
                  </div>
                </div>

                <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', borderBottom: '1px dashed #cbd5e1', paddingBottom: '0.75rem' }}>
                  <div><strong>Tienda:</strong> {completedExchange.storeName}</div>
                  <div><strong>Vendedor:</strong> {completedExchange.vendedor}</div>
                  <div><strong>Cliente:</strong> {completedExchange.clientName} (CC/NIT: {completedExchange.clientDocument})</div>
                </div>

                {/* Returned items */}
                <div style={{ fontSize: '0.8rem', borderBottom: '1px dashed #cbd5e1', paddingBottom: '0.75rem' }}>
                  <div style={{ fontWeight: '850', color: '#be185d', marginBottom: '0.35rem' }}>PRENDA(S) DEVUELTA(S):</div>
                  {completedExchange.returnedItems.map((r: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                      <span>• {r.products?.nombre_producto || 'Prenda'} ({r.colors?.nombre_color || ''} {r.sizes?.codigo_talla || ''})</span>
                      <span style={{ fontWeight: '800' }}>-${Number(r.creditPrice || r.precio_unitario || 0).toLocaleString('es-CO')}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '900', marginTop: '0.3rem', color: '#be185d' }}>
                    <span>Total Saldo a Favor:</span>
                    <span>${completedExchange.creditAmount.toLocaleString('es-CO')}</span>
                  </div>
                </div>

                {/* New items */}
                <div style={{ fontSize: '0.8rem', borderBottom: '1px dashed #cbd5e1', paddingBottom: '0.75rem' }}>
                  <div style={{ fontWeight: '850', color: '#059669', marginBottom: '0.35rem' }}>NUEVA(S) PRENDA(S) ENTREGADA(S):</div>
                  {completedExchange.newItems.map((n: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                      <span>• {n.nombre} ({n.color_name} {n.size_name}) x{n.cantidad}</span>
                      <span style={{ fontWeight: '800' }}>+${Number(n.subtotal || 0).toLocaleString('es-CO')}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '900', marginTop: '0.3rem', color: '#059669' }}>
                    <span>Total Nuevas Prendas:</span>
                    <span>${completedExchange.newTotal.toLocaleString('es-CO')}</span>
                  </div>
                </div>

                {/* Financial Summary */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: '900' }}>
                    <span>EXCEDENTE COBRADO:</span>
                    <span style={{ color: '#2563eb' }}>${completedExchange.surplusAmount.toLocaleString('es-CO')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                    <span>Método de Pago:</span>
                    <span>{completedExchange.paymentMethod}</span>
                  </div>
                  {completedExchange.changeDue > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#059669', fontWeight: '700' }}>
                      <span>Cambio / Vueltas:</span>
                      <span>${completedExchange.changeDue.toLocaleString('es-CO')}</span>
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'center', fontSize: '0.7rem', color: '#94a3b8' }}>
                  ¡Gracias por su visita! Todo cambio se rige bajo nuestras políticas de calidad.
                </div>
              </div>

              {/* Print and Close buttons */}
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.85rem 1.75rem',
                    borderRadius: '12px',
                    fontWeight: '850',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                >
                  <Printer size={18} /> Imprimir Comprobante
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    backgroundColor: '#ec4899',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.85rem 2rem',
                    borderRadius: '12px',
                    fontWeight: '850',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 12px rgba(236,72,153,0.3)'
                  }}
                >
                  Finalizar y Volver al POS
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
