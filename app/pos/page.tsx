'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ShoppingCart, Search, Barcode, QrCode, Tag, User, CreditCard,
  Wifi, WifiOff, RefreshCw, Plus, Minus, Trash2, CheckCircle2,
  DollarSign, FileText, Lock, Unlock, AlertCircle, Sparkles, X, Loader2,
  RefreshCcw, ArrowLeftRight, Clock, MoreHorizontal, XCircle,
  ShoppingBag, Shirt, Users, Receipt, Landmark, BarChart3, Award, Settings,
  Bell, MessageSquare, Heart, LogOut, Package, Building2, Warehouse
} from 'lucide-react';
import * as Icons from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import POSTransferManager from '@/components/pos/POSTransferManager';
import POSExchangeModal from '@/components/pos/POSExchangeModal';
import POSWarehouseStockModal from '@/components/pos/POSWarehouseStockModal';
import POSReceiptModal, { POSReceiptData } from '@/components/pos/POSReceiptModal';
import POSCashMovementModal, { POSCashConcept, DEFAULT_CASH_CONCEPTS } from '@/components/pos/POSCashMovementModal';

const BodysuitIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 100 130" style={{ width: '100%', height: '100%', maxHeight: '90px' }} xmlns="http://www.w3.org/2000/svg">
    {/* Body Outline */}
    <path 
      d="M 28 15 
         C 32 30, 42 35, 50 35 
         C 58 35, 68 30, 72 15 
         L 76 40 
         C 74 65, 68 85, 64 95 
         C 62 100, 56 103, 53 108
         L 53 113
         C 52 115, 48 115, 47 113
         L 47 108
         C 44 103, 38 100, 36 95 
         C 32 85, 26 65, 24 40 
         Z" 
      fill={color} 
      stroke="#1e293b" 
      strokeWidth="2.5" 
      strokeLinejoin="round" 
    />
    <path d="M 28 15 C 35 20, 42 22, 50 22 C 58 22, 65 20, 72 15" fill="none" stroke="#475569" strokeWidth="1.5" />
    <path d="M 47 108 C 48 107, 52 107, 53 108" fill="none" stroke="#475569" strokeWidth="2" />
  </svg>
);

const getProductColor = (prod: any) => {
  const name = (prod.nombre_producto || '').toLowerCase();
  if (name.includes('negro')) return '#1e293b';
  if (name.includes('blanco')) return '#ffffff';
  if (name.includes('rojo')) return '#ef4444';
  if (name.includes('azul')) return '#3b82f6';
  if (name.includes('verde')) return '#10b981';
  if (name.includes('rosa') || name.includes('rosado')) return '#f472b6';
  if (name.includes('gris')) return '#94a3b8';
  if (name.includes('amarillo')) return '#f59e0b';
  
  const str = prod.id || prod.nombre_producto || '';
  const hash = str.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 60%)`;
};

export function getPremiumReferenceCategory(p: any): string {
  if (!p) return 'General';
  const name = (p.nombre_producto || '').trim();
  const cat = (p.categories?.categoria || p.categoria || '').trim();
  
  let cleanName = name.replace(/^(no\s*usar|doble\s*no\s*ingresar)\s+/i, '').trim();
  
  if (cleanName.toLowerCase().includes('premium')) {
    return cleanName;
  }
  if (cat && cat.toLowerCase().includes('premium')) {
    return cat;
  }
  if (cleanName) {
    return cleanName;
  }
  if (cat) {
    return cat;
  }
  return p.codigo_referencia ? `Ref: ${p.codigo_referencia}` : 'General';
}

export function isBodyProduct(product: any): boolean {
  if (!product) return false;
  const name = (product.nombre_producto || '').toLowerCase();
  const cat = (product.categories?.categoria || product.categoria || '').toLowerCase();
  const ref = (product.codigo_referencia || '').toLowerCase();
  const desc = (product.descripcion || '').toLowerCase();
  return name.includes('body') || cat.includes('body') || ref.includes('body') || desc.includes('body');
}

export function isTopProduct(product: any): boolean {
  if (!product) return false;
  const name = (product.nombre_producto || '').toLowerCase();
  const cat = (product.categories?.categoria || product.categoria || '').toLowerCase();
  const ref = (product.codigo_referencia || '').toLowerCase();
  const desc = (product.descripcion || '').toLowerCase();
  return name.includes('top') || cat.includes('top') || ref.includes('top') || desc.includes('top');
}

export function parsePriceListRules(pl: any) {
  let cantidad_minima = 1;
  let aplica_todas_categorias = true;
  let categorias_permitidas: string[] = [];
  let body_discount_type = 'precio_fijo';
  let body_discount_val: number | string = '';
  let top_discount_type = 'precio_fijo';
  let top_discount_val: number | string = '';
  let userDesc = pl?.descripcion || '';

  if (userDesc) {
    // 1. Check for Base64 format: [REGLAS_B64:...]
    const b64Match = userDesc.match(/\[REGLAS_B64:([A-Za-z0-9+/=]+)\]/);
    if (b64Match && b64Match[1]) {
      try {
        const decoded = typeof atob === 'function' ? atob(b64Match[1]) : Buffer.from(b64Match[1], 'base64').toString('utf-8');
        const parsed = JSON.parse(decoded);
        if (parsed.cantidad_minima !== undefined && parsed.cantidad_minima !== null) {
          cantidad_minima = Math.max(1, Number(parsed.cantidad_minima) || 1);
        }
        if (parsed.aplica_todas_categorias !== undefined) {
          aplica_todas_categorias = Boolean(parsed.aplica_todas_categorias);
        }
        if (Array.isArray(parsed.categorias_permitidas)) {
          categorias_permitidas = parsed.categorias_permitidas;
        }
        if (parsed.body_discount_type) body_discount_type = parsed.body_discount_type;
        if (parsed.body_discount_val !== undefined && parsed.body_discount_val !== null) body_discount_val = parsed.body_discount_val;
        if (parsed.top_discount_type) top_discount_type = parsed.top_discount_type;
        if (parsed.top_discount_val !== undefined && parsed.top_discount_val !== null) top_discount_val = parsed.top_discount_val;
      } catch (e) {
        console.warn('Error parsing Base64 rules in POS:', e);
      }
    } else {
      // 2. Fallback to legacy [REGLAS:{...}] format
      const idx = userDesc.indexOf('[REGLAS:');
      if (idx !== -1) {
        const rawJsonPart = userDesc.substring(idx + 8);
        const lastBracket = rawJsonPart.lastIndexOf(']');
        const jsonStr = lastBracket !== -1 ? rawJsonPart.substring(0, lastBracket) : rawJsonPart;
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.cantidad_minima !== undefined && parsed.cantidad_minima !== null) {
            cantidad_minima = Math.max(1, Number(parsed.cantidad_minima) || 1);
          }
          if (parsed.aplica_todas_categorias !== undefined) {
            aplica_todas_categorias = Boolean(parsed.aplica_todas_categorias);
          }
          if (Array.isArray(parsed.categorias_permitidas)) {
            categorias_permitidas = parsed.categorias_permitidas;
          }
          if (parsed.body_discount_type) body_discount_type = parsed.body_discount_type;
          if (parsed.body_discount_val !== undefined && parsed.body_discount_val !== null) body_discount_val = parsed.body_discount_val;
          if (parsed.top_discount_type) top_discount_type = parsed.top_discount_type;
          if (parsed.top_discount_val !== undefined && parsed.top_discount_val !== null) top_discount_val = parsed.top_discount_val;
        } catch (e) {
          console.warn('Error parsing legacy rules JSON in POS:', e);
        }
      }
    }
  }

  if (pl?.cantidad_minima !== undefined && pl?.cantidad_minima !== null && !isNaN(Number(pl.cantidad_minima))) {
    cantidad_minima = Math.max(1, Number(pl.cantidad_minima));
  }
  if (pl?.aplica_todas_categorias !== undefined && pl?.aplica_todas_categorias !== null) {
    aplica_todas_categorias = Boolean(pl.aplica_todas_categorias);
  }
  if (Array.isArray(pl?.categorias_permitidas)) {
    categorias_permitidas = pl.categorias_permitidas;
  }

  userDesc = userDesc
    .replace(/\[REGLAS_B64:[A-Za-z0-9+/=]+\]/g, '')
    .replace(/\[REGLAS:[\s\S]*$/g, '')
    .replace(/\s*\}\]\}\]\s*/g, '')
    .trim();

  return {
    cantidad_minima,
    aplica_todas_categorias,
    categorias_permitidas,
    body_discount_type,
    body_discount_val,
    top_discount_type,
    top_discount_val,
    userDesc
  };
}

const DynamicIcon = ({ name, size, ...props }: { name: string; size: number; [key: string]: any }) => {
  const IconComponent = (Icons as any)[name] || Icons.HelpCircle;
  return <IconComponent size={size} {...props} />;
};

export interface POSTransferMethod {
  id: string;
  banco: string;
  tipo_cuenta: string;
  numero_cuenta: string;
  titular: string;
  identificacion: string;
  qr_image_url?: string;
  color: string;
  instrucciones?: string;
  activo: boolean;
}

const DEFAULT_TRANSFER_METHODS: POSTransferMethod[] = [
  {
    id: 'bancolombia-1',
    banco: 'Bancolombia',
    tipo_cuenta: 'Ahorros',
    numero_cuenta: '123-456789-01',
    titular: 'Confecciones Breiner SAS',
    identificacion: 'NIT 901.456.789-1',
    color: '#FDDA24',
    instrucciones: 'Asegúrate de mostrar el comprobante emitido con la fecha de hoy.',
    activo: true
  },
  {
    id: 'nequi-1',
    banco: 'Nequi',
    tipo_cuenta: 'Celular / Billetera',
    numero_cuenta: '310 890 1234',
    titular: 'Confecciones Breiner SAS',
    identificacion: 'NIT 901.456.789-1',
    color: '#20002C',
    instrucciones: 'Transferencia directa Nequi a Nequi sin costo.',
    activo: true
  },
  {
    id: 'daviplata-1',
    banco: 'Daviplata',
    tipo_cuenta: 'Celular / Billetera',
    numero_cuenta: '310 890 1234',
    titular: 'Confecciones Breiner SAS',
    identificacion: 'NIT 901.456.789-1',
    color: '#ED1C24',
    instrucciones: 'Transferencia inmediata Daviplata.',
    activo: true
  }
];

export default function POSPage() {
  const fetchAllPages = async (queryBuilder: any) => {
    let allData: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await queryBuilder.range(page * pageSize, (page + 1) * pageSize - 1);
      if (error) {
        console.error('Error in fetchAllPages:', error);
        break;
      }
      if (data && data.length > 0) {
        allData = [...allData, ...data];
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }
    return allData;
  };

  const router = useRouter();
  const [activeTheme, setActiveTheme] = useState<any>(null);
  const { user, profile, config, loading: authLoading, signOut } = useAuth();

  // Mode: Offline Simulation
  const [isOnline, setIsOnline] = useState(true);
  const [syncQueue, setSyncQueue] = useState<any[]>([]);

  // Masters
  const [stores, setStores] = useState<any[]>([]);
  const [registers, setRegisters] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [priceLists, setPriceLists] = useState<any[]>([]);
  const [priceListItems, setPriceListItems] = useState<any[]>([]);
  const [selectedPriceListId, setSelectedPriceListId] = useState<string>('');

  // Session
  const [selectedStore, setSelectedStore] = useState<any>(null);
  const [selectedRegister, setSelectedRegister] = useState<any>(null);
  const [currentSession, setCurrentSession] = useState<any>(null);

  // Cart & Sales Flow
  const [cart, setCart] = useState<any[]>([]);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [selectedProductForVariants, setSelectedProductForVariants] = useState<any>(null);
  const [productVariants, setProductVariants] = useState<any[]>([]);
  const [variantSearch, setVariantSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [resolvedBarcodeRef, setResolvedBarcodeRef] = useState<string | null>(null);
  const [scannedGarment, setScannedGarment] = useState<any>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<any>({ name: 'Cliente General', document: '2222222222' });
  const [currentSessionSalesTotal, setCurrentSessionSalesTotal] = useState(0);

  const fetchSessionSalesTotal = async (sessionId: string) => {
    if (!sessionId) return;
    try {
      const { data, error } = await supabase
        .from('pos_sales')
        .select('total')
        .eq('session_id', sessionId);
      if (error) throw error;
      const total = data?.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0) || 0;
      setCurrentSessionSalesTotal(total);
    } catch (err) {
      console.error('Error fetching session sales total:', err);
    }
  };

  const fetchSessionSalesDetails = async (sessionId: string) => {
    if (!sessionId) return;
    try {
      const { data, error } = await supabase
        .from('pos_sales')
        .select('*, pos_payments(*), items:pos_sale_items(*, products(nombre_producto, codigo_referencia, imagen_url))')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSessionSalesDetails(data || []);
      const total = data?.reduce((sum: number, s: any) => sum + (Number(s.total) || 0), 0) || 0;
      setCurrentSessionSalesTotal(total);
    } catch (err) {
      console.error('Error fetching session sales details:', err);
    }
  };
  const [activeMenuId, setActiveMenuId] = useState('pos');
  const [salesPage, setSalesPage] = useState(0);
  const [inventoryPage, setInventoryPage] = useState(0);
  const [posProductsPage, setPosProductsPage] = useState(0);
  const [userAssignedStoreId, setUserAssignedStoreId] = useState<string | null>(null);
  const [userAssignedRegisterId, setUserAssignedRegisterId] = useState<string | null>(null);
  const [shiftsPage, setShiftsPage] = useState(0);
  const [reportDateRange, setReportDateRange] = useState('today');
  
  // Inline CRM states
  const [crmCustomers, setCrmCustomers] = useState<any[]>([]);
  const [crmSearch, setCrmSearch] = useState('');
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustDoc, setNewCustDoc] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustTypeDoc, setNewCustTypeDoc] = useState('Cedula');
  const [newCustTypePerson, setNewCustTypePerson] = useState('Natural');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustCity, setNewCustCity] = useState('');
  const [newCustAvatarUrl, setNewCustAvatarUrl] = useState('');
  const [newCustPriceListId, setNewCustPriceListId] = useState('');
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [showPosClientModal, setShowPosClientModal] = useState(false);

  // Inline inventory states
  const [inventoryList, setInventoryList] = useState<any[]>([]);
  const [individualGarments, setIndividualGarments] = useState<any[]>([]);
  const [inventoryViewMode, setInventoryViewMode] = useState<'etiquetas' | 'resumen'>('etiquetas');
  const [garmentsPage, setGarmentsPage] = useState(0);
  const [invSearch, setInvSearch] = useState('');

  // Inline sales logs states
  const [salesLogs, setSalesLogs] = useState<any[]>([]);

  // Live Theme Designer / UX Manager states
  const DEFAULT_THEME = {
    primary: '#80082E', secondary: '#D81B60',
    bg: '#f1f5f9', cards: '#ffffff', text: '#0f172a',
    sidebarText: '#ffffff', buttonText: '#ffffff',
    border: '#e2e8f0', accent: '#10b981',
    fontFamily: 'Outfit', fontSize: '14px', fontWeight: '500',
    productIconSize: 135, catalogColumns: 7, hideProductBorders: false,
    productImageAspect: 'cover', productPriceFontSize: '0.95rem', cartWidth: 420,
    cartItemImageSize: 42
  };
  const [customPrimary, setCustomPrimary] = useState('#80082E');
  const [customSecondary, setCustomSecondary] = useState('#D81B60');
  const [customBg, setCustomBg] = useState('#f1f5f9');
  const [customCards, setCustomCards] = useState('#ffffff');
  const [customText, setCustomText] = useState('#0f172a');
  const [customModalText, setCustomModalText] = useState('#0f172a');
  const [customTotalColor, setCustomTotalColor] = useState('#80082E');
  const [customTotalFontSize, setCustomTotalFontSize] = useState('1.35rem');
  const [customTotalPadding, setCustomTotalPadding] = useState('0.85rem 1.25rem');
  const [customTotalFontWeight, setCustomTotalFontWeight] = useState('950');
  const [customHeaderTotalColor, setCustomHeaderTotalColor] = useState('#80082E');
  const [customHeaderTotalFontSize, setCustomHeaderTotalFontSize] = useState('1.25rem');
  const [customHeaderTotalPadding, setCustomHeaderTotalPadding] = useState('0.65rem 1.5rem');
  const [customHeaderTotalFontWeight, setCustomHeaderTotalFontWeight] = useState('955');
  const [customCloseSessionBg, setCustomCloseSessionBg] = useState('#fee2e2');
  const [customCloseSessionBorder, setCustomCloseSessionBorder] = useState('#fca5a5');
  const [customCloseSessionText, setCustomCloseSessionText] = useState('#dc2626');
  const [customCloseSessionFontSize, setCustomCloseSessionFontSize] = useState('0.78rem');
  const [customCloseSessionPadding, setCustomCloseSessionPadding] = useState('0.55rem 1rem');
  const [customCloseSessionFontWeight, setCustomCloseSessionFontWeight] = useState('850');
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [customBorder, setCustomBorder] = useState('#e2e8f0');
  const [customAccent, setCustomAccent] = useState('#10b981');
  const [customSidebarText, setCustomSidebarText] = useState('#ffffff');
  const [customButtonText, setCustomButtonText] = useState('#ffffff');
  const [customFontFamily, setCustomFontFamily] = useState('Outfit');
  const [customFontSize, setCustomFontSize] = useState('14px');
  const [customFontWeight, setCustomFontWeight] = useState('500');
  const [customSidebarFontFamily, setCustomSidebarFontFamily] = useState('Outfit');
  const [customSidebarFontSize, setCustomSidebarFontSize] = useState('13px');
  const [productIconSize, setProductIconSize] = useState(135);
  const [catalogColumns, setCatalogColumns] = useState(7);
  const [catalogColumnsTablet, setCatalogColumnsTablet] = useState(4);
  const [hideProductBorders, setHideProductBorders] = useState(false);
  const [productImageAspect, setProductImageAspect] = useState<'cover' | 'contain' | 'vertical'>('cover');
  const [productImageFit, setProductImageFit] = useState<'cover' | 'contain'>('cover');
  const [productPriceFontSize, setProductPriceFontSize] = useState('0.95rem');
  const [customTotalLabel, setCustomTotalLabel] = useState('TOTAL A COBRAR');
  const [cartWidth, setCartWidth] = useState(420);
  const [cartItemImageSize, setCartItemImageSize] = useState(42);
  const [customLogoUrl, setCustomLogoUrl] = useState('');
  const [customLogoWidth, setCustomLogoWidth] = useState(38);
  const [customHeaderText, setCustomHeaderText] = useState('Breiner');
  const [customHeaderTextSize, setCustomHeaderTextSize] = useState('20px');
  const [customHeaderTextColor, setCustomHeaderTextColor] = useState('#80082E');
  const [customHeaderTextPlacement, setCustomHeaderTextPlacement] = useState('right');
  
  // Staff & Shifts POS states
  const [staffUsers, setStaffUsers] = useState<any[]>([]);
  const [staffRoles, setStaffRoles] = useState<any[]>([]);
  const [staffPermissions, setStaffPermissions] = useState<any[]>([]);
  const [staffShifts, setStaffShifts] = useState<any[]>([]);
  const [hasActiveShift, setHasActiveShift] = useState<boolean | null>(null);
  const [checkingShift, setCheckingShift] = useState(false);
  const [staffTab, setStaffTab] = useState<'vendedores' | 'roles' | 'turnos'>('vendedores');
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRoleId, setNewUserRoleId] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [staffAssignments, setStaffAssignments] = useState<any[]>([]);
  const [newUserAvatarBase64, setNewUserAvatarBase64] = useState('');
  const [newUserAvatarName, setNewUserAvatarName] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [selectedShiftDate, setSelectedShiftDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }));
  const [selectedShiftEndDate, setSelectedShiftEndDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }));
  const [isWeeklyShift, setIsWeeklyShift] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([1,2,3,4,5,6]); // Lun a Sab
  const [selectedShiftUser, setSelectedShiftUser] = useState('');
  const [selectedShiftIn, setSelectedShiftIn] = useState('08:00');
  const [selectedShiftOut, setSelectedShiftOut] = useState('17:00');
  
  // Custom header dimensions & Profile states
  const [customSearchWidth, setCustomSearchWidth] = useState(45);
  const [customSearchHeight, setCustomSearchHeight] = useState(42);
  const [customHeaderIconSize, setCustomHeaderIconSize] = useState(18);
  const [showUserProfileCard, setShowUserProfileCard] = useState(false);
  
  const [logoUploading, setLogoUploading] = useState(false);
  const [uxTab, setUxTab] = useState<'colors' | 'typography' | 'catalog' | 'logo' | 'transfer' | 'cash_concepts'>('colors');
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeSaved, setThemeSaved] = useState(false);

  // Transfer Methods State
  const [transferMethods, setTransferMethods] = useState<POSTransferMethod[]>(DEFAULT_TRANSFER_METHODS);
  const [selectedTransferMethodId, setSelectedTransferMethodId] = useState<string>('bancolombia-1');
  const [transferReferenceCode, setTransferReferenceCode] = useState<string>('');
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);
  const [zoomQrModalUrl, setZoomQrModalUrl] = useState<string | null>(null);
  const [showSessionTransactionsModal, setShowSessionTransactionsModal] = useState(false);
  const [sessionSalesDetails, setSessionSalesDetails] = useState<any[]>([]);
  const [transferUploading, setTransferUploading] = useState(false);

  // UX Transfer Edit/Create Form State
  const [newTransferBank, setNewTransferBank] = useState('');
  const [newTransferType, setNewTransferType] = useState('Ahorros');
  const [newTransferNumber, setNewTransferNumber] = useState('');
  const [newTransferHolder, setNewTransferHolder] = useState('Confecciones Breiner SAS');
  const [newTransferDoc, setNewTransferDoc] = useState('NIT 901.456.789-1');
  const [newTransferColor, setNewTransferColor] = useState('#80082E');
  const [newTransferInstructions, setNewTransferInstructions] = useState('');
  const [newTransferQrUrl, setNewTransferQrUrl] = useState('');
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null);
  // Receipt modal state
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [lastReceiptData, setLastReceiptData] = useState<POSReceiptData | null>(null);

  // Cash Movement modal & Concepts state
  const [showCashMovementModal, setShowCashMovementModal] = useState(false);
  const [cashConcepts, setCashConcepts] = useState<POSCashConcept[]>(DEFAULT_CASH_CONCEPTS);
  const [newConceptName, setNewConceptName] = useState('');
  const [newConceptType, setNewConceptType] = useState<'Ingreso' | 'Egreso'>('Egreso');
  const [newConceptDesc, setNewConceptDesc] = useState('');

  const handleCopyAccount = (text: string, id: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedAccount(id);
      setTimeout(() => setCopiedAccount(null), 2500);
    }
  };

  // Compute allowed modules for POS sidebar
  const currentUserAssignment = staffAssignments.find(a => a.userId === profile?.id);
  const currentUserPOSRole = staffRoles.find(r => r.id === currentUserAssignment?.posRoleId);
  const isPOSAdmin = profile?.roles?.name?.toLowerCase().includes('admin') || 
                     profile?.roles?.name?.toLowerCase().includes('tienda') || 
                     profile?.roles?.name?.toLowerCase().includes('punto');
                     
  const allowedPOSModules = isPOSAdmin 
    ? ['pos', 'traslados', 'clientes', 'ventas', 'reportes', 'promociones', 'ajustes'] 
    : (currentUserPOSRole?.permissions ? [...currentUserPOSRole.permissions, 'traslados'] : ['pos', 'traslados']);

  const mainItems = [
    { id: 'pos', label: 'Punto de Venta', icon: ShoppingBag, module: 'pos' },
    { id: 'stock_bodegas', label: '🏢 Stock por Bodega', icon: Building2, module: 'pos' },
    { id: 'traslados', label: '🚚📦 Traslados', icon: ArrowLeftRight, module: 'traslados' },
    { id: 'productos', label: 'Productos', icon: Shirt, module: 'pos' },
    { id: 'clientes', label: 'Clientes', icon: Users, module: 'clientes' },
    { id: 'ventas', label: 'Ventas', icon: Receipt, module: 'ventas' },
    { id: 'cambios', label: '🔄 Cambios / Devolución', icon: RefreshCcw, module: 'pos' },
    { id: 'cotizaciones', label: 'Cotizaciones', icon: FileText, module: 'pos' },
    { id: 'cajas', label: 'Cajas', icon: Landmark, module: 'pos' },
  ].filter(item => allowedPOSModules.includes(item.module));

  const managementItems = [
    { id: 'reportes', label: 'Reportes', icon: BarChart3, module: 'reportes', show: allowedPOSModules.includes('reportes') },
    { id: 'promociones', label: 'Promociones', icon: Award, module: 'promociones', show: allowedPOSModules.includes('promociones') },
    { id: 'personal', label: 'Personal', icon: Users, module: 'personal', show: isPOSAdmin },
    { id: 'ajustes', label: 'Ajustes / UX', icon: Settings, module: 'ajustes', show: allowedPOSModules.includes('ajustes') }
  ].filter(item => item.show !== false);

  // Load shifts for managerial report
  const [managerShifts, setManagerShifts] = useState<any[]>([]);
  const fetchManagerShifts = async () => {
    try {
      const { data } = await supabase
        .from('pos_cash_sessions')
        .select('*')
        .order('fecha_apertura', { ascending: false });
      setManagerShifts(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  // Load inline CRM customers
  const fetchCrmCustomers = async () => {
    try {
      if (!selectedStore) return;
      const { data } = await supabase
        .from('siigo_customers')
        .select('*')
        .eq('store_id', selectedStore.id)
        .order('name');
      setCrmCustomers(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  // Load inline Inventory  // Inline inventory & reconciliation states
  const [activeProdTab, setActiveProdTab] = useState<'inventario' | 'recepcion'>('inventario');
  
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
  const [selectedTransfer, setSelectedTransfer] = useState<any>(null);
  const [scannedReconBarcodes, setScannedReconBarcodes] = useState<string[]>([]);
  const [reconBarcodeInput, setReconBarcodeInput] = useState('');

  const fetchInlineInventory = async () => {
    try {
      if (!selectedStore) return;
      if (selectedStore.bodega_asociada_id) {
        const inv = await fetchAllPages(supabase.from('finished_goods_stock').select('*, products(*), sizes(*), colors(*)').eq('warehouse_id', selectedStore.bodega_asociada_id));
        setInventoryList(inv || []);
      } else {
        const inv = await fetchAllPages(supabase.from('store_inventory').select('*, products(*), sizes(*), colors(*)').eq('store_id', selectedStore.id));
        setInventoryList(inv || []);
      }

      // Fetch individual garment barcode tags physically in this store or its associated warehouse
      let garmentFilter = `store_id.eq.${selectedStore.id}`;
      if (selectedStore.bodega_asociada_id) {
        garmentFilter += `,warehouse_id.eq.${selectedStore.bodega_asociada_id}`;
      }
      const garments = await fetchAllPages(supabase.from('individual_garments').select('*').or(garmentFilter).order('created_at', { ascending: false }));
      setIndividualGarments(garments || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPendingTransfers = async () => {
    try {
      if (!selectedStore) return;
      
      let filter = `warehouse_dest_id.eq.${selectedStore.id}`;
      if (selectedStore.bodega_asociada_id) {
        filter += `,warehouse_dest_id.eq.${selectedStore.bodega_asociada_id}`;
      }
      
      const { data } = await supabase
        .from('finished_goods_transfers')
        .select('*, items:finished_goods_transfer_items(*, product:products(nombre_producto, codigo_referencia))')
        .or(filter)
        .eq('estado', 'Pendiente')
        .order('created_at', { ascending: false });
      setPendingTransfers(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleScanReconciliation = (e: React.FormEvent) => {
    e.preventDefault();
    const bc = reconBarcodeInput.trim();
    if (!bc) return;
    
    // Check if barcode exists in selected transfer
    let found = false;
    for (const item of selectedTransfer?.items || []) {
      if (item.barcodes && item.barcodes.includes(bc)) {
        found = true;
        break;
      }
    }
    
    if (found) {
      if (!scannedReconBarcodes.includes(bc)) {
        setScannedReconBarcodes([...scannedReconBarcodes, bc]);
      }
    } else {
      alert(`El código ${bc} no pertenece a este traslado.`);
    }
    setReconBarcodeInput('');
  };

  const handleAcceptTransfer = async () => {
    if (!selectedTransfer || !selectedStore) return;
    try {
      const destWhId = selectedTransfer.warehouse_dest_id || selectedStore.bodega_asociada_id || selectedStore.id;

      // 1. Update transfer status
      await supabase.from('finished_goods_transfers')
        .update({ estado: 'Recibido', observaciones: `Recibido por POS. Conciliadas ${scannedReconBarcodes.length} prendas.` })
        .eq('id', selectedTransfer.id);
        
      // 2. Insert items into store_inventory
      const ops = (selectedTransfer.items || []).map(async (item: any) => {
         const { data: existing } = await supabase.from('store_inventory')
           .select('id, cantidad_disponible')
           .eq('store_id', selectedStore.id)
           .eq('product_id', item.product_id)
           .eq('size_id', item.size_id)
           .eq('color_id', item.color_id || '00000000-0000-0000-0000-000000000000')
           .limit(1);
           
         if (existing && existing.length > 0) {
           await supabase.from('store_inventory').update({ cantidad_disponible: Number(existing[0].cantidad_disponible || 0) + Number(item.cantidad || 0) }).eq('id', existing[0].id);
         } else {
           await supabase.from('store_inventory').insert([{
             store_id: selectedStore.id,
             product_id: item.product_id,
             size_id: item.size_id,
             color_id: item.color_id,
             cantidad_disponible: item.cantidad
           }]);
         }
      });
      await Promise.all(ops);

      // 3. Update finished_goods_stock in destination warehouse & write to finished_goods_kardex
      if (destWhId) {
        for (const item of (selectedTransfer.items || [])) {
          let destQuery = supabase
            .from('finished_goods_stock')
            .select('*')
            .eq('warehouse_id', destWhId)
            .eq('product_id', item.product_id);

          if (item.size_id) destQuery = destQuery.eq('size_id', item.size_id);
          if (item.color_id) destQuery = destQuery.eq('color_id', item.color_id);

          const { data: destStock } = await destQuery.limit(1);
          const currentDestQty = destStock?.[0] ? Number(destStock[0].cantidad_disponible || 0) : 0;

          if (destStock?.[0]) {
            await supabase
              .from('finished_goods_stock')
              .update({ cantidad_disponible: currentDestQty + Number(item.cantidad) })
              .eq('id', destStock[0].id);
          } else {
            await supabase
              .from('finished_goods_stock')
              .insert({
                warehouse_id: destWhId,
                product_id: item.product_id,
                color_id: item.color_id || null,
                size_id: item.size_id,
                cantidad_disponible: Number(item.cantidad)
              });
          }

          // Kardex entry
          await supabase.from('finished_goods_kardex').insert({
            product_id: item.product_id,
            color_id: item.color_id || null,
            size_id: item.size_id,
            tipo_movimiento: 'Transferencia (Entrada)',
            cantidad: Number(item.cantidad),
            saldo_anterior: currentDestQty,
            saldo_nuevo: currentDestQty + Number(item.cantidad),
            warehouse_orig_id: selectedTransfer.warehouse_orig_id,
            warehouse_dest_id: destWhId,
            documento_origen: `Transferencia #${selectedTransfer.consecutive || selectedTransfer.id?.slice(0, 6)}`,
            usuario: 'POS Store / Usuario',
            observaciones: `Recepción confirmada en POS (${selectedStore.nombre_tienda || 'Tienda'})`
          });
        }
      }

      // 4. Update individual_garments location & status to destination warehouse
      const allBarcodesToUpdate = new Set<string>([...scannedReconBarcodes]);
      (selectedTransfer.items || []).forEach((it: any) => {
        if (it.barcodes && Array.isArray(it.barcodes)) {
          it.barcodes.forEach((b: string) => allBarcodesToUpdate.add(b));
        }
      });

      if (allBarcodesToUpdate.size > 0 && destWhId) {
        await supabase
          .from('individual_garments')
          .update({
            warehouse_id: destWhId,
            status: 'Aprobada'
          })
          .in('barcode', Array.from(allBarcodesToUpdate));
      } else if (destWhId) {
        for (const item of (selectedTransfer.items || [])) {
          const { data: transitGarms } = await supabase
            .from('individual_garments')
            .select('id')
            .eq('status', 'en_transito')
            .limit(Number(item.cantidad));

          if (transitGarms && transitGarms.length > 0) {
            await supabase
              .from('individual_garments')
              .update({
                warehouse_id: destWhId,
                status: 'Aprobada'
              })
              .in('id', transitGarms.map(g => g.id));
          }
        }
      }
      
      alert('✓ Traslado recibido, conciliado e ingresado al stock de la bodega exitosamente.');
      setSelectedTransfer(null);
      setScannedReconBarcodes([]);
      fetchPendingTransfers();
      fetchInlineInventory(); // refresh inventory
    } catch (e: any) {
      console.error(e);
      alert('Error recibiendo traslado: ' + (e?.message || 'Error desconocido'));
    }
  };

  const handleRejectTransfer = async () => {
    if (!selectedTransfer) return;
    const reason = prompt("Razón de rechazo:");
    if (reason === null) return;
    try {
      await supabase.from('finished_goods_transfers')
        .update({ estado: 'Rechazado', observaciones: reason })
        .eq('id', selectedTransfer.id);
      alert('Traslado rechazado.');
      setSelectedTransfer(null);
      fetchPendingTransfers();
    } catch (e) {
      console.error(e);
    }
  };

  // Load inline Sales Logs
  const fetchInlineSales = async () => {
    try {
      if (!selectedStore) return;
      const { data } = await supabase
        .from('pos_sales')
        .select('*, pos_payments(*), items:pos_sale_items(*)')
        .eq('store_id', selectedStore.id)
        .order('created_at', { ascending: false });
      setSalesLogs(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  // Synchronize Live UX custom theme states with activeTheme once loaded
  useEffect(() => {
    if (activeTheme?.styles?.colors) {
      const c = activeTheme.styles.colors;
      if (c.primary) setCustomPrimary(c.primary);
      if (c.secondary) setCustomSecondary(c.secondary);
      if (c.background) setCustomBg(c.background);
      if (c.cards) setCustomCards(c.cards);
      if (c.text) setCustomText(c.text);
      if (c.modalText) setCustomModalText(c.modalText);
      if (c.border) setCustomBorder(c.border);
      if (c.accent) setCustomAccent(c.accent);
      if (c.sidebarText) setCustomSidebarText(c.sidebarText);
      if (c.buttonText) setCustomButtonText(c.buttonText);
      if (c.totalColor) setCustomTotalColor(c.totalColor);
    }
    if (activeTheme?.styles?.typography) {
      const t = activeTheme.styles.typography;
      if (t.fontFamily) setCustomFontFamily(t.fontFamily);
      if (t.fontSize) setCustomFontSize(t.fontSize);
      if (t.fontWeight) setCustomFontWeight(t.fontWeight);
      if (t.sidebarFontFamily) setCustomSidebarFontFamily(t.sidebarFontFamily);
      if (t.sidebarFontSize) setCustomSidebarFontSize(t.sidebarFontSize);
    }
    if (activeTheme?.styles?.catalog) {
      const cat = activeTheme.styles.catalog;
      if (cat.productIconSize) setProductIconSize(Number(cat.productIconSize));
      if (cat.catalogColumns) setCatalogColumns(Number(cat.catalogColumns));
      if (cat.catalogColumnsTablet) setCatalogColumnsTablet(Number(cat.catalogColumnsTablet));
      setHideProductBorders(!!cat.hideProductBorders);
      if (cat.productImageAspect) setProductImageAspect(cat.productImageAspect);
      if (cat.productImageFit) setProductImageFit(cat.productImageFit);
      if (cat.productPriceFontSize) setProductPriceFontSize(cat.productPriceFontSize);
      if (cat.cartWidth) setCartWidth(Number(cat.cartWidth));
      if (cat.cartItemImageSize) setCartItemImageSize(Number(cat.cartItemImageSize));
      if (cat.totalLabel) setCustomTotalLabel(cat.totalLabel);
      if (cat.searchWidth) setCustomSearchWidth(Number(cat.searchWidth));
      if (cat.searchHeight) setCustomSearchHeight(Number(cat.searchHeight));
      if (cat.headerIconSize) setCustomHeaderIconSize(Number(cat.headerIconSize));
      
      const col = activeTheme.styles.colors || {};
      if (col.totalFontSize) setCustomTotalFontSize(col.totalFontSize);
      if (col.totalPadding) setCustomTotalPadding(col.totalPadding);
      if (col.totalFontWeight) setCustomTotalFontWeight(col.totalFontWeight);
      if (col.headerTotalColor) setCustomHeaderTotalColor(col.headerTotalColor);
      if (col.headerTotalFontSize) setCustomHeaderTotalFontSize(col.headerTotalFontSize);
      if (col.headerTotalPadding) setCustomHeaderTotalPadding(col.headerTotalPadding);
      if (col.headerTotalFontWeight) setCustomHeaderTotalFontWeight(col.headerTotalFontWeight);
      if (col.closeSessionBg) setCustomCloseSessionBg(col.closeSessionBg);
      if (col.closeSessionBorder) setCustomCloseSessionBorder(col.closeSessionBorder);
      if (col.closeSessionText) setCustomCloseSessionText(col.closeSessionText);
      if (col.closeSessionFontSize) setCustomCloseSessionFontSize(col.closeSessionFontSize);
      if (col.closeSessionPadding) setCustomCloseSessionPadding(col.closeSessionPadding);
      if (col.closeSessionFontWeight) setCustomCloseSessionFontWeight(col.closeSessionFontWeight);
    }
    if (activeTheme?.styles?.logo) {
      const log = activeTheme.styles.logo;
      if (log.store_logo_url) setCustomLogoUrl(log.store_logo_url);
      if (log.width) setCustomLogoWidth(Number(log.width));
      setCustomHeaderText(log.headerText || 'Breiner');
      setCustomHeaderTextSize(log.headerTextSize || '20px');
      setCustomHeaderTextColor(log.headerTextColor || '#80082E');
      setCustomHeaderTextPlacement(log.headerTextPlacement || 'right');
    }
    // Load custom POS roles and permissions
    if (activeTheme?.styles?.pos_roles_config) {
      setStaffRoles(activeTheme.styles.pos_roles_config);
    } else {
      setStaffRoles([
        { id: 'pos-vendedor', name: 'Vendedor', permissions: ['pos', 'clientes'] },
        { id: 'pos-supervisor', name: 'Supervisor', permissions: ['pos', 'clientes', 'ventas', 'reportes', 'promociones'] }
      ]);
    }
    // Load custom POS staff assignments (linking users to store + role)
    if (activeTheme?.styles?.pos_staff_assignments) {
      setStaffAssignments(activeTheme.styles.pos_staff_assignments);
    } else {
      setStaffAssignments([]);
    }

    // Load custom transfer methods
    if (activeTheme?.styles?.transfer_methods && activeTheme.styles.transfer_methods.length > 0) {
      setTransferMethods(activeTheme.styles.transfer_methods);
    }

    // Load custom cash concepts
    if (activeTheme?.styles?.cash_concepts && activeTheme.styles.cash_concepts.length > 0) {
      setCashConcepts(activeTheme.styles.cash_concepts);
    } else {
      const localStored = localStorage.getItem('pos_cash_concepts');
      if (localStored) {
        try {
          setCashConcepts(JSON.parse(localStored));
        } catch (e) {
          setCashConcepts(DEFAULT_CASH_CONCEPTS);
        }
      }
    }
  }, [activeTheme]);

  // Create or Update Theme in DB
  const saveCustomTheme = async (rolesOverride?: any[], assignmentsOverride?: any[], transferMethodsOverride?: any[], cashConceptsOverride?: any[]) => {
    setThemeSaving(true);
    try {
      // Step 1: Deactivate all other themes so POS Custom Theme wins
      await supabase
        .from('pos_themes')
        .update({ is_active: false })
        .neq('name', 'POS Custom Theme');

      const targetRoles = rolesOverride || staffRoles;
      const targetAssignments = assignmentsOverride || staffAssignments;
      const targetTransferMethods = transferMethodsOverride || transferMethods;
      const targetCashConcepts = cashConceptsOverride || cashConcepts;

      // Step 2: Upsert the custom theme with all current values
      const payload = {
        name: 'POS Custom Theme',
        description: 'Tema personalizado en vivo desde el POS UX Manager',
        scope: 'all',
        is_active: true,
        styles: {
          colors: {
            primary: customPrimary,
            secondary: customSecondary,
            background: customBg,
            cards: customCards,
            buttons: `linear-gradient(90deg, ${customPrimary} 0%, ${customSecondary} 100%)`,
            menus: `linear-gradient(180deg, ${customPrimary} 0%, #1a0008 100%)`,
            text: customText,
            modalText: customModalText,
            border: customBorder,
            accent: customAccent,
            sidebarText: customSidebarText,
            buttonText: customButtonText,
            totalColor: customTotalColor,
            totalFontSize: customTotalFontSize,
            totalPadding: customTotalPadding,
            totalFontWeight: customTotalFontWeight,
            headerTotalColor: customHeaderTotalColor,
            headerTotalFontSize: customHeaderTotalFontSize,
            headerTotalPadding: customHeaderTotalPadding,
            headerTotalFontWeight: customHeaderTotalFontWeight,
            closeSessionBg: customCloseSessionBg,
            closeSessionBorder: customCloseSessionBorder,
            closeSessionText: customCloseSessionText,
            closeSessionFontSize: customCloseSessionFontSize,
            closeSessionPadding: customCloseSessionPadding,
            closeSessionFontWeight: customCloseSessionFontWeight,
            transaction: customAccent
          },
          typography: {
            fontFamily: customFontFamily,
            fontSize: customFontSize,
            fontWeight: customFontWeight,
            sidebarFontFamily: customSidebarFontFamily,
            sidebarFontSize: customSidebarFontSize
          },
          catalog: {
            productIconSize,
            catalogColumns,
            catalogColumnsTablet,
            hideProductBorders,
            productImageAspect,
            productImageFit,
            productPriceFontSize,
            cartWidth,
            cartItemImageSize,
            totalLabel: customTotalLabel,
            searchWidth: customSearchWidth,
            searchHeight: customSearchHeight,
            headerIconSize: customHeaderIconSize
          },
          logo: {
            store_logo_url: customLogoUrl,
            width: customLogoWidth,
            headerText: customHeaderText,
            headerTextSize: customHeaderTextSize,
            headerTextColor: customHeaderTextColor,
            headerTextPlacement: customHeaderTextPlacement
          },
          transfer_methods: targetTransferMethods,
          cash_concepts: targetCashConcepts,
          pos_roles_config: targetRoles,
          pos_staff_assignments: targetAssignments
        }
      };
      const { error } = await supabase
        .from('pos_themes')
        .upsert(payload, { onConflict: 'name' });
      if (error) throw error;
      setThemeSaved(true);
      setTimeout(() => setThemeSaved(false), 3000);
      
      // Update activeTheme state locally to prevent page reload requirements
      setActiveTheme(payload as any);
    } catch (e: any) {
      console.error('Error saving custom theme:', e);
    } finally {
      setThemeSaving(false);
    }
  };

  const resetTheme = () => {
    setCustomPrimary(DEFAULT_THEME.primary);
    setCustomSecondary(DEFAULT_THEME.secondary);
    setCustomBg(DEFAULT_THEME.bg);
    setCustomCards(DEFAULT_THEME.cards);
    setCustomText(DEFAULT_THEME.text);
    setCustomBorder(DEFAULT_THEME.border);
    setCustomAccent(DEFAULT_THEME.accent);
    setCustomSidebarText(DEFAULT_THEME.sidebarText);
    setCustomButtonText(DEFAULT_THEME.buttonText);
    setCustomFontFamily(DEFAULT_THEME.fontFamily);
    setCustomFontSize(DEFAULT_THEME.fontSize);
    setCustomFontWeight(DEFAULT_THEME.fontWeight);
    setProductIconSize(DEFAULT_THEME.productIconSize);
    setCatalogColumns(DEFAULT_THEME.catalogColumns);
    setHideProductBorders(DEFAULT_THEME.hideProductBorders);
    setProductImageAspect(DEFAULT_THEME.productImageAspect as any);
    setProductPriceFontSize(DEFAULT_THEME.productPriceFontSize);
    setCartWidth(DEFAULT_THEME.cartWidth);
    setCartItemImageSize(DEFAULT_THEME.cartItemImageSize);
    setCustomLogoUrl('');
    setCustomLogoWidth(38);
    setProductImageFit('cover');
    setCustomSidebarFontFamily('Outfit');
    setCustomSidebarFontSize('13px');
    setCustomModalText('#0f172a');
    setCustomTotalColor('#80082E');
    setCustomTotalLabel('TOTAL A COBRAR');
    setCustomSearchWidth(45);
    setCustomSearchHeight(42);
    setCustomHeaderIconSize(18);
  };

  const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Mixto'>('Efectivo');
  const [mixedCashAmount, setMixedCashAmount] = useState<string>('');
  const [mixedCardAmount, setMixedCardAmount] = useState<string>('');
  const [mixedTransferAmount, setMixedTransferAmount] = useState<string>('');
  const [showMixedTransfer, setShowMixedTransfer] = useState(false);
  const [cartNotes, setCartNotes] = useState('');
  const [observaciones, setObservaciones] = useState('');

  // Return / Exchange flow state
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [showWarehouseStockModal, setShowWarehouseStockModal] = useState(false);
  const [returnProduct, setReturnProduct] = useState<any>(null);
  const [returnSizeId, setReturnSizeId] = useState('');
  const [returnColorId, setReturnColorId] = useState('');
  const [returnPrice, setReturnPrice] = useState('35000');

  // UI state

  const [loading, setLoading] = useState(true);
  const [showOpenSessionModal, setShowOpenSessionModal] = useState(false);
  const [showCloseSessionModal, setShowCloseSessionModal] = useState(false);
  const [openingCash, setOpeningCash] = useState('50000');
  const [closingCashReal, setClosingCashReal] = useState('');

  // Chat states
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatRoom, setChatRoom] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [chatInputValue, setChatInputValue] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Alerts states
  const [alerts, setAlerts] = useState<any[]>([]);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);

  // Fetch active alerts
  const fetchAlerts = async () => {
    try {
      const { data } = await supabase
        .from('novelties')
        .select('*')
        .eq('modulo_relac', 'alerta_general')
        .order('created_at', { ascending: false });
      setAlerts(data || []);
      
      // Calculate unread count (stored in localStorage)
      const lastReadAlerts = localStorage.getItem('pos_last_read_alerts') || '1970-01-01T00:00:00.000Z';
      const unread = (data || []).filter(a => new Date(a.created_at) > new Date(lastReadAlerts)).length;
      setUnreadAlertsCount(unread);
    } catch (e) {
      console.error(e);
    }
  };

  // Sync Alerts on load
  useEffect(() => {
    fetchAlerts();
    
    // Subscribe to new alerts in novelties table
    const alertsChannel = supabase
      .channel('pos_global_alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'novelties', filter: 'modulo_relac=eq.alerta_general' },
        (payload) => {
          setAlerts(prev => [payload.new, ...prev]);
          setUnreadAlertsCount(count => count + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(alertsChannel);
    };
  }, []);

  // Initialize/Fetch store Chat Room
  const initChatRoom = async (store: any) => {
    if (!store) return;
    try {
      // Find or create chat room for this store
      let { data: room, error } = await supabase
        .from('pos_chat_rooms')
        .select('*')
        .eq('store_id', store.id)
        .maybeSingle();

      if (!room) {
        const { data: newRoom, error: createError } = await supabase
          .from('pos_chat_rooms')
          .insert({
            store_id: store.id,
            name: store.nombre,
            last_message: 'Chat iniciado.',
            unread_count_erp: 0,
            unread_count_pos: 0
          })
          .select()
          .single();
        if (createError) throw createError;
        room = newRoom;
      }

      setChatRoom(room);
      if (room) {
        // Load existing messages
        const { data: messages } = await supabase
          .from('pos_chat_messages')
          .select('*')
          .eq('room_id', room.id)
          .order('created_at', { ascending: true });
        setChatMessages(messages || []);
        setUnreadChatCount(room.unread_count_pos || 0);
      }
    } catch (e) {
      console.error('Error initializing chat room:', e);
    }
  };

  // Sync Chat Room when selectedStore changes
  useEffect(() => {
    if (selectedStore) {
      initChatRoom(selectedStore);
    }
  }, [selectedStore]);

  // Realtime subscription for new messages and room status updates
  useEffect(() => {
    if (!chatRoom) return;

    // Messages channel
    const messagesChannel = supabase
      .channel(`chat_messages_${chatRoom.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pos_chat_messages', filter: `room_id=eq.${chatRoom.id}` },
        (payload) => {
          setChatMessages((prev) => {
            if (prev.some(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();

    // Rooms update channel to sync unread counts dynamically when ERP changes them
    const roomsChannel = supabase
      .channel(`chat_room_sync_${chatRoom.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pos_chat_rooms', filter: `id=eq.${chatRoom.id}` },
        (payload) => {
          if (!showChatModal) {
            setUnreadChatCount(payload.new.unread_count_pos || 0);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(roomsChannel);
    };
  }, [chatRoom, showChatModal]);

  // Send message function
  const handleSendChatMessage = async () => {
    if (!chatInputValue.trim() || !chatRoom || sendingMessage) return;
    setSendingMessage(true);
    const msgText = chatInputValue.trim();
    setChatInputValue('');
    try {
      const { data: insertedMsg, error } = await supabase
        .from('pos_chat_messages')
        .insert({
          room_id: chatRoom.id,
          sender_id: user?.id || null,
          sender_name: profile?.full_name || 'Vendedor POS',
          sender_role: 'vendedor',
          message: msgText
        })
        .select()
        .single();

      if (error) throw error;

      // Update room metadata (last message, erp unread count)
      await supabase
        .from('pos_chat_rooms')
        .update({
          last_message: msgText,
          last_message_time: new Date().toISOString(),
          unread_count_erp: (chatRoom.unread_count_erp || 0) + 1
        })
        .eq('id', chatRoom.id);

      setChatMessages((prev) => [...prev, insertedMsg]);
    } catch (e) {
      console.error('Error sending message:', e);
      setChatInputValue(msgText); // Restore input value
    } finally {
      setSendingMessage(false);
    }
  };


  const loadTheme = async () => {
    try {
      let activeStoreId = typeof window !== 'undefined' ? localStorage.getItem('pos_selected_store_id') : null;
      const { data: themes } = await supabase.from('pos_themes').select('*');
      if (themes && themes.length > 0) {
        const now = new Date();

        // Priority 1: User's custom POS theme always wins
        const customTheme = themes.find(t => t.name === 'POS Custom Theme' && t.is_active);
        if (customTheme) {
          setActiveTheme(customTheme);
          return;
        }

        // Priority 2: Date-range active themes for this store or all
        let matched = themes.find(t => {
          if (t.start_date && t.end_date) {
            const start = new Date(t.start_date);
            const end = new Date(t.end_date);
            return now >= start && now <= end && (t.store_id === activeStoreId || t.scope === 'all');
          }
          return false;
        });

        // Priority 3: Store-specific active theme
        if (!matched && activeStoreId) {
          matched = themes.find(t => t.scope === 'store' && t.store_id === activeStoreId && t.is_active);
        }

        // Priority 4: Global active theme
        if (!matched) {
          matched = themes.find(t => t.scope === 'all' && t.is_active);
        }

        setActiveTheme(matched || null);
      } else {
        setActiveTheme(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadTheme();

    const channel = supabase
      .channel('pos_page_themes_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pos_themes' },
        () => {
          loadTheme();
        }
      )
      .subscribe();

    const handleThemeChanged = () => {
      loadTheme();
    };
    window.addEventListener('pos-theme-changed', handleThemeChanged);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('pos-theme-changed', handleThemeChanged);
    };
  }, []);

  useEffect(() => {
    fetchInitialData();
    const savedQueue = localStorage.getItem('pos_sync_queue');
    if (savedQueue) {
      setSyncQueue(JSON.parse(savedQueue));
    }
  }, []);

  useEffect(() => {
    if (selectedStore) {
      fetchInlineInventory();
      fetchPendingTransfers();
      fetchCrmCustomers();
    }
  }, [selectedStore]);

    useEffect(() => {
    if ((!profile?.id && !user?.id) || stores.length === 0) return;
    const checkAssignedStore = async () => {
      try {
        const uId = profile?.id || user?.id;
        let assignedId = '';
        let assignedRegCode = '';

        // 1. Check store_staff_shifts table
        const { data: shifts } = await supabase
          .from('store_staff_shifts')
          .select('store_id, observaciones')
          .eq('user_id', uId)
          .order('created_at', { ascending: false });

        if (shifts && shifts.length > 0 && shifts[0].store_id) {
          assignedId = shifts[0].store_id;
          const obs = shifts[0].observaciones || '';
          if (obs.includes('REG:')) {
            assignedRegCode = obs.split('REG:')[1].split('|')[0].trim();
          }
        }

        // 2. Check staffAssignments in theme meta
        if (!assignedId && staffAssignments && staffAssignments.length > 0) {
          const assignedMeta = staffAssignments.find((a: any) => a.userId === uId);
          if (assignedMeta && assignedMeta.storeId) {
            assignedId = assignedMeta.storeId;
          }
        }

        // 3. Check if user profile is listed as store responsable
        if (!assignedId) {
          const uName = (profile?.full_name || '').toLowerCase();
          const uEmail = (user?.email || '').toLowerCase();
          const respStore = stores.find(s => {
            const resp = (s.responsable || '').toLowerCase();
            return resp && (resp.includes(uName) || (uName && uName.includes(resp)) || resp.includes(uEmail));
          });
          if (respStore) {
            assignedId = respStore.id;
          }
        }

        if (assignedId) {
          setUserAssignedStoreId(assignedId);
          const found = stores.find(s => s.id === assignedId);
          if (found) {
            setSelectedStore(found);
            localStorage.setItem('pos_selected_store_id', assignedId);
            await loadRegistersForStore(assignedId);
            const { data: storeRegs } = await supabase.from('pos_registers').select('*').eq('store_id', assignedId);

            if (assignedRegCode) {
              const foundReg = storeRegs?.find((r: any) => r.id === assignedRegCode || r.codigo_caja === assignedRegCode);
              if (foundReg) {
                setSelectedRegister(foundReg);
                setUserAssignedRegisterId(foundReg.id);
                localStorage.setItem('pos_selected_register_id', foundReg.id);
              }
            }
          }
        }
      } catch (err) {
        console.error('Error checking assigned user store:', err);
      }
    };
    checkAssignedStore();
  }, [profile, user, stores, staffAssignments]);

  useEffect(() => {
    if (authLoading || stores.length === 0) return;

    const initSavedSession = async () => {
      const savedStoreId = localStorage.getItem('pos_selected_store_id');
      const savedRegisterId = localStorage.getItem('pos_selected_register_id');
      if (savedStoreId) {
        const foundStore = stores.find(s => s.id === savedStoreId);
        if (foundStore) {
          setSelectedStore(foundStore);
          await loadRegistersForStore(savedStoreId, savedRegisterId || undefined);
        }
      }
    };
    initSavedSession();
  }, [authLoading, stores]);

  useEffect(() => {
    if (isOnline && syncQueue.length > 0) {
      syncQueueOfflineSales();
    }
  }, [isOnline, syncQueue]);

  useEffect(() => {
    if (selectedStore && profile?.id) {
      checkUserShift(selectedStore.id, profile.id);
    } else {
      setHasActiveShift(null);
    }
  }, [selectedStore, profile]);

  useEffect(() => {
    if (activeMenuId === 'personal') {
      fetchStaffData();
    }
  }, [activeMenuId, selectedStore]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: st } = await supabase.from('stores').select('*').eq('estado', 'activo');
      const prod = await fetchAllPages(supabase.from('products').select('*, categories(*)'));
      const { data: col } = await supabase.from('colors').select('*');
      const { data: sz } = await supabase.from('sizes').select('*').order('orden_visual');
      const { data: promo } = await supabase.from('pos_promotions').select('*').eq('activo', true);

      let plData: any[] = [];
      let pliData: any[] = [];
      try {
        const { data: lists } = await supabase.from('pos_price_lists').select('*').eq('activo', true);
        const { data: items } = await supabase.from('pos_price_list_items').select('*');
        plData = lists || [];
        pliData = items || [];
      } catch (e) {
        console.warn("Price list tables might not exist yet.");
      }

      setStores(st || []);
      setProducts(prod || []);
      setColors(col || []);
      setSizes(sz || []);
      setPromotions(promo || []);
      setPriceLists(plData);
      setPriceListItems(pliData);
      
    } catch (err) {
      console.error('Error loading initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Check active shift for current logged user
  const checkUserShift = async (storeId: string, userId: string) => {
    if (!storeId || !userId) return;
    setCheckingShift(true);
    try {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
      const { data, error } = await supabase
        .from('store_staff_shifts')
        .select('*')
        .eq('store_id', storeId)
        .eq('user_id', userId)
        .eq('fecha', today)
        .eq('estado', 'programado');
      
      if (error) throw error;
      setHasActiveShift(data && data.length > 0);
    } catch (e) {
      console.error('Error checking user shift:', e);
      setHasActiveShift(true); // Fallback friendly
    } finally {
      setCheckingShift(false);
    }
  };

  // Load staff administration data
  const fetchStaffData = async () => {
    if (!selectedStore) return;
    try {
      // 1. Fetch profiles
      const { data: usersData } = await supabase
        .from('profiles')
        .select('*, roles(name)')
        .order('full_name');
      
      // Filter users: include if user is already assigned in POS metadata, or fits standard POS role terms
      const filteredUsers = (usersData || []).filter(u => {
        if (u.id === profile?.id) return true;
        // Include if already assigned
        const isAssigned = staffAssignments.some(a => a.userId === u.id);
        if (isAssigned) return true;

        // Otherwise check search terms in roles
        const roleName = (u.roles?.name || '').toLowerCase();
        return roleName.includes('pos') || 
               roleName.includes('post') || 
               roleName.includes('punto') || 
               roleName.includes('tienda') || 
               roleName.includes('vendedor') || 
               roleName.includes('cajero') ||
               (u.email && u.email.toLowerCase().includes('tienda'));
      });
      setStaffUsers(filteredUsers);

      // 2. Keep POS-specific roles configuration (from theme), do not overwrite with central ERP roles
      // 3. Central ERP permission fetching is skipped to prevent conflicts with POS roles

      // 4. Fetch shifts with user profile names join
      const { data: shiftsData } = await supabase
        .from('store_staff_shifts')
        .select('*, profiles:user_id(full_name)')
        .eq('store_id', selectedStore.id)
        .order('fecha', { ascending: false });
      setStaffShifts(shiftsData || []);
    } catch (e) {
      console.error('Error fetching staff data:', e);
    }
  };

  const handleCreateStaffUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserPassword || !newUserName || !newUserRoleId || !selectedStore) {
      alert('Por favor llene todos los campos obligatorios.');
      return;
    }
    setCreatingUser(true);
    try {
      // Find global POS role ID first
      const { data: globalRoles } = await supabase.from('roles').select('id, name');
      const basePOSRole = globalRoles?.find(r => 
        r.name?.toLowerCase() === 'pos' || r.name?.toLowerCase() === 'post'
      );
      // Ensure targetGlobalRoleId is ALWAYS a valid UUID from the roles table (never a custom POS role string)
      const targetGlobalRoleId = basePOSRole?.id || (globalRoles && globalRoles.length > 0 ? globalRoles[0].id : null);

      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword,
          full_name: newUserName,
          role_id: targetGlobalRoleId,
          pos_role_id: newUserRoleId,
          avatarBase64: newUserAvatarBase64 || null,
          avatarName: newUserAvatarName || null
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error creando usuario.');

      // Save user assignment to POS metadata
      const newAssignment = {
        userId: result.userId,
        storeId: selectedStore.id,
        posRoleId: newUserRoleId
      };
      const updatedAssignments = [...staffAssignments, newAssignment];
      setStaffAssignments(updatedAssignments);
      await saveCustomTheme(staffRoles, updatedAssignments);

      alert('Vendedor creado exitosamente.');
      setShowNewUserModal(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
      setNewUserRoleId('');
      setNewUserAvatarBase64('');
      setNewUserAvatarName('');
      await fetchStaffData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setCreatingUser(false);
    }
  };

  const handleCreatePOSRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    const newId = 'pos-role-' + Date.now();
    const newRole = { id: newId, name: newRoleName.trim(), permissions: ['pos'] };
    const updatedRoles = [...staffRoles, newRole];
    setStaffRoles(updatedRoles);
    setNewRoleName('');
    await saveCustomTheme(updatedRoles);
  };

  const handleDeletePOSRole = async (id: string) => {
    if (id === 'pos-vendedor' || id === 'pos-supervisor') {
      alert('Los roles base "Vendedor" y "Supervisor" no pueden eliminarse.');
      return;
    }
    if (!confirm('¿Seguro que deseas eliminar este rol del POS?')) return;
    const updatedRoles = staffRoles.filter(r => r.id !== id);
    setStaffRoles(updatedRoles);
    await saveCustomTheme(updatedRoles);
  };

  const handleTogglePOSPermission = async (roleId: string, moduleName: string) => {
    const updatedRoles = staffRoles.map(r => {
      if (r.id === roleId) {
        const perms = r.permissions || [];
        const hasIt = perms.includes(moduleName);
        return {
          ...r,
          permissions: hasIt ? perms.filter((p: string) => p !== moduleName) : [...perms, moduleName]
        };
      }
      return r;
    });
    setStaffRoles(updatedRoles);
    await saveCustomTheme(updatedRoles);
  };

  const handleSaveStaffShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShiftUser || !selectedShiftDate || !selectedStore || (isWeeklyShift && !selectedShiftEndDate)) {
      alert('Por favor complete todos los datos.');
      return;
    }
    
    try {
      const inserts = [];
      if (!isWeeklyShift) {
        inserts.push({
          store_id: selectedStore.id,
          user_id: selectedShiftUser,
          fecha: selectedShiftDate,
          hora_entrada: selectedShiftIn,
          hora_salida: selectedShiftOut,
          estado: 'programado'
        });
      } else {
        const start = new Date(selectedShiftDate + 'T00:00:00');
        const end = new Date(selectedShiftEndDate + 'T00:00:00');
        if (end < start) {
          alert('La fecha final debe ser mayor o igual a la inicial'); return;
        }
        
        let curr = new Date(start);
        while (curr <= end) {
          if (selectedDays.includes(curr.getDay())) {
            inserts.push({
              store_id: selectedStore.id,
              user_id: selectedShiftUser,
              fecha: curr.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }),
              hora_entrada: selectedShiftIn,
              hora_salida: selectedShiftOut,
              estado: 'programado'
            });
          }
          curr.setDate(curr.getDate() + 1);
        }
        
        if (inserts.length === 0) {
          alert('No hay fechas coincidentes con los días seleccionados en ese rango.');
          return;
        }
      }

      const { error } = await supabase.from('store_staff_shifts').insert(inserts);

      if (error) throw error;
      alert(`Turno${inserts.length > 1 ? 's' : ''} programado${inserts.length > 1 ? 's' : ''} exitosamente.`);
      setSelectedShiftUser('');
      await fetchStaffData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleStartShift = async (shiftId: string) => {
    try {
      const { error } = await supabase.from('store_staff_shifts').update({ estado: 'en curso' }).eq('id', shiftId);
      if (error) throw error;
      alert('El turno ha sido marcado como "en curso" (abierto).');
      fetchStaffData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleTogglePermission = async (roleId: string, permissionId: string, hasPerm: boolean) => {
    try {
      if (hasPerm) {
        // Delete permission
        await supabase
          .from('role_permissions')
          .delete()
          .eq('role_id', roleId)
          .eq('permission_id', permissionId);
      } else {
        // Insert permission
        await supabase
          .from('role_permissions')
          .insert([{ role_id: roleId, permission_id: permissionId }]);
      }
      await fetchStaffData();
    } catch (err: any) {
      console.error(err);
    }
  };

  const loadRegistersForStore = async (storeId: string, preselectRegisterId?: string) => {
    try {
      const { data: reg } = await supabase.from('pos_registers').select('*').eq('store_id', storeId);
      setRegisters(reg || []);
      
      if (reg && reg.length > 0) {
        // Priority 1: Check if ANY register in this store has an active open session
        const regIds = reg.map((r: any) => r.id);
        const { data: openSessions } = await supabase
          .from('pos_cash_sessions')
          .select('*')
          .in('register_id', regIds)
          .eq('estado', 'abierta')
          .order('fecha_apertura', { ascending: false });

        if (openSessions && openSessions.length > 0) {
          const activeSession = openSessions[0];
          const matchedReg = reg.find(r => r.id === activeSession.register_id) || reg[0];
          setSelectedRegister(matchedReg);
          localStorage.setItem('pos_selected_register_id', matchedReg.id);
          setCurrentSession(activeSession);
          localStorage.setItem('pos_active_session_id', activeSession.id);
          fetchSessionSalesTotal(activeSession.id);
          fetchSessionSalesDetails(activeSession.id);
          fetchCrmCustomers();
          fetchInlineInventory();
          fetchInlineSales();
          setShowOpenSessionModal(false);
          return;
        }

        // Priority 2: Fallback to preselected or first register
        let foundReg = preselectRegisterId ? reg.find(r => r.id === preselectRegisterId) : null;
        if (!foundReg) {
          foundReg = reg[0];
          localStorage.setItem('pos_selected_register_id', foundReg.id);
        }
        setSelectedRegister(foundReg);
        await checkActiveSession(foundReg.id);
      } else {
        setSelectedRegister(null);
        setCurrentSession(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const checkActiveSession = async (registerId: string) => {
    try {
      const { data: session } = await supabase
        .from('pos_cash_sessions')
        .select('*')
        .eq('register_id', registerId)
        .eq('estado', 'abierta')
        .order('fecha_apertura', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (session) {
        setCurrentSession(session);
        localStorage.setItem('pos_active_session_id', session.id);
        fetchSessionSalesTotal(session.id);
        fetchSessionSalesDetails(session.id);
        fetchCrmCustomers();
        fetchInlineInventory();
        fetchInlineSales();
        setShowOpenSessionModal(false);
      } else {
        setCurrentSession(null);
        localStorage.removeItem('pos_active_session_id');
        setShowOpenSessionModal(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenStoreChange = async (storeId: string) => {
    if (userAssignedStoreId && storeId !== userAssignedStoreId) {
      alert('🔒 Tienes una tienda asignada en la Administración del POS y no puedes cambiar a otra sucursal.');
      return;
    }
    const store = stores.find(s => s.id === storeId);
    setSelectedStore(store);
    setSelectedRegister(null);
    setCurrentSession(null);
    localStorage.setItem('pos_selected_store_id', storeId);
    window.dispatchEvent(new Event('pos-theme-changed'));
    await loadRegistersForStore(storeId);
  };

  const handleRegisterChange = async (registerId: string) => {
    const reg = registers.find(r => r.id === registerId);
    setSelectedRegister(reg);
    localStorage.setItem('pos_selected_register_id', registerId);
    await checkActiveSession(registerId);
  };

  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setSessionError(null);
    
    let targetRegister = selectedRegister;
    
    // Auto-select first register if none is active
    if (!targetRegister && registers.length > 0) {
      targetRegister = registers[0];
      setSelectedRegister(registers[0]);
      localStorage.setItem('pos_selected_register_id', registers[0].id);
    }
    
    if (!targetRegister) {
      setSessionError('Debes seleccionar o crear una Caja en la barra superior antes de abrir el turno.');
      return;
    }
    
    try {
      const { data: newSession, error } = await supabase
        .from('pos_cash_sessions')
        .insert([{
          register_id: targetRegister.id,
          usuario_apertura: profile?.full_name || user?.email || 'Cajero',
          monto_apertura: Number(openingCash),
          estado: 'abierta'
        }])
        .select()
        .single();

      if (error) throw error;
      await supabase.from('pos_registers').update({ estado: 'abierta' }).eq('id', targetRegister.id);
      
      setCurrentSession(newSession);
      localStorage.setItem('pos_active_session_id', newSession.id);
      setCurrentSessionSalesTotal(0);
      setSessionSalesDetails([]);
      setSessionError(null);
      setShowOpenSessionModal(false);
    } catch (err: any) {
      console.error('Error abriendo caja:', err);
      setSessionError(err.message || 'Error desconocido al abrir caja. Verifica la conexión y permisos.');
    }
  };

  const handleCloseSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession) return;
    try {
      const { data: sales } = await supabase
        .from('pos_sales')
        .select('*, pos_payments(*)')
        .eq('session_id', currentSession.id);

      const cashSalesTotal = sales?.reduce((sum, sale) => {
        const cashPays = sale.pos_payments?.filter((p: any) => p.metodo_pago === 'Efectivo') || [];
        return sum + cashPays.reduce((acc: number, p: any) => acc + (Number(p.monto) || 0), 0);
      }, 0) || 0;

      const expected = Number(currentSession.monto_apertura) + cashSalesTotal;
      const real = Number(closingCashReal);
      const diff = real - expected;

      await supabase
        .from('pos_cash_sessions')
        .update({
          monto_cierre_real: real,
          monto_cierre_esperado: expected,
          diferencia: diff,
          estado: 'cerrada',
          fecha_cierre: new Date().toISOString()
        })
        .eq('id', currentSession.id);

      if (selectedRegister?.id) {
        await supabase.from('pos_registers').update({ estado: 'cerrada' }).eq('id', selectedRegister.id);
      }

      localStorage.removeItem('pos_active_session_id');
      setCurrentSession(null);
      setSessionSalesDetails([]);
      setCurrentSessionSalesTotal(0);
      setClosingCashReal('');
      setShowCloseSessionModal(false);
      alert(`✅ Turno de caja cerrado exitosamente.\nEsperado en Efectivo: $${expected.toLocaleString('es-CO')}\nContado Real: $${real.toLocaleString('es-CO')}\nDiferencia: $${diff.toLocaleString('es-CO')}`);
    } catch (err: any) {
      alert('Error cerrando caja: ' + err.message);
    }
  };

  const deductStockForSaleItem = async ({
    store,
    cartItem,
    consecutive,
    vendedor,
    productsList,
    colorsList,
    sizesList,
    inventoryList: localInvList
  }: {
    store: any;
    cartItem: any;
    consecutive: number | string;
    vendedor: string;
    productsList: any[];
    colorsList: any[];
    sizesList: any[];
    inventoryList: any[];
  }) => {
    if (!store) return;
    const storeName = store?.nombre || 'POS';
    const prefix = storeName.substring(0, 3).toUpperCase();
    const docRef = `Venta POS #${prefix}-${String(consecutive).padStart(4, '0')}`;
    const qtyToDeduct = Number(cartItem.cantidad) || 1;
    const isDevolucion = qtyToDeduct < 0;
    const movType = isDevolucion ? 'Devolución' : 'Venta POS';

    const productObj = productsList.find(p => p.id === cartItem.product_id) || {
      id: cartItem.product_id,
      nombre_producto: cartItem.nombre,
      codigo_referencia: cartItem.codigo_referencia
    };
    const colorObj = colorsList.find(c => c.id === cartItem.color_id);
    const sizeObj = sizesList.find(s => s.id === cartItem.size_id);

    // 1. UPDATE FINISHED_GOODS_STOCK (If store has an associated warehouse)
    if (store.bodega_asociada_id) {
      const whId = store.bodega_asociada_id;
      let targetStock: any = null;

      // Priority 1: Exact warehouse + product_id + size_id + color_id
      let q1 = supabase.from('finished_goods_stock').select('*')
        .eq('warehouse_id', whId)
        .eq('product_id', cartItem.product_id);
      if (cartItem.size_id) q1 = q1.eq('size_id', cartItem.size_id);
      if (cartItem.color_id) q1 = q1.eq('color_id', cartItem.color_id);
      else q1 = q1.is('color_id', null);
      const { data: d1 } = await q1;
      if (d1 && d1.length > 0) targetStock = d1[0];

      // Priority 2: Exact product_id + size_id with positive stock in this warehouse
      if (!targetStock) {
        let q2 = supabase.from('finished_goods_stock').select('*')
          .eq('warehouse_id', whId)
          .eq('product_id', cartItem.product_id);
        if (cartItem.size_id) q2 = q2.eq('size_id', cartItem.size_id);
        const { data: d2 } = await q2.order('cantidad_disponible', { ascending: false });
        if (d2 && d2.length > 0) targetStock = d2[0];
      }

      // Priority 3: Match from active in-memory inventory list for this warehouse
      if (!targetStock && localInvList && localInvList.length > 0) {
        const matchInv = localInvList.find(inv => {
          const sameProd = inv.product_id === cartItem.product_id || 
            (inv.products?.nombre_producto && cartItem.nombre && inv.products.nombre_producto.trim().toLowerCase() === cartItem.nombre.trim().toLowerCase());
          const sameSize = !cartItem.size_id || inv.size_id === cartItem.size_id;
          const sameColor = !cartItem.color_id || inv.color_id === cartItem.color_id;
          return sameProd && sameSize && sameColor;
        }) || localInvList.find(inv => {
          const sameProd = inv.product_id === cartItem.product_id || 
            (inv.products?.nombre_producto && cartItem.nombre && inv.products.nombre_producto.trim().toLowerCase() === cartItem.nombre.trim().toLowerCase());
          const sameSize = !cartItem.size_id || inv.size_id === cartItem.size_id;
          return sameProd && sameSize && Number(inv.cantidad_disponible) > 0;
        });

        if (matchInv) {
          const { data: d3 } = await supabase.from('finished_goods_stock').select('*').eq('id', matchInv.id);
          if (d3 && d3.length > 0) targetStock = d3[0];
        }
      }

      // Priority 4: Match by product name in finished_goods_stock of this warehouse
      if (!targetStock && (productObj.nombre_producto || cartItem.nombre)) {
        const pName = (productObj.nombre_producto || cartItem.nombre || '').trim();
        const { data: d4 } = await supabase.from('finished_goods_stock')
          .select('*, products!inner(*)')
          .eq('warehouse_id', whId)
          .ilike('products.nombre_producto', pName)
          .order('cantidad_disponible', { ascending: false });
        if (d4 && d4.length > 0) targetStock = d4[0];
      }

      // Priority 5: Any row with this product_id in this warehouse
      if (!targetStock) {
        const { data: d5 } = await supabase.from('finished_goods_stock').select('*')
          .eq('warehouse_id', whId)
          .eq('product_id', cartItem.product_id)
          .order('cantidad_disponible', { ascending: false });
        if (d5 && d5.length > 0) targetStock = d5[0];
      }

      let currentQty = 0;
      let finalProductId = cartItem.product_id;
      let finalSizeId = cartItem.size_id;
      let finalColorId = cartItem.color_id;

      if (targetStock) {
        currentQty = Number(targetStock.cantidad_disponible) || 0;
        finalProductId = targetStock.product_id || cartItem.product_id;
        finalSizeId = targetStock.size_id || cartItem.size_id;
        finalColorId = targetStock.color_id || cartItem.color_id;
        const newQty = currentQty - qtyToDeduct;

        await supabase.from('finished_goods_stock')
          .update({ 
            cantidad_disponible: newQty,
            updated_at: new Date().toISOString()
          })
          .eq('id', targetStock.id);
      } else {
        const newQty = 0 - qtyToDeduct;
        await supabase.from('finished_goods_stock').insert([{
          warehouse_id: whId,
          product_id: cartItem.product_id,
          size_id: cartItem.size_id || null,
          color_id: cartItem.color_id || null,
          cantidad_disponible: newQty,
          cantidad_reservada: 0,
          cantidad_en_transito: 0
        }]);
      }

      // Kardex record
      try {
        await supabase.from('finished_goods_kardex').insert([{
          warehouse_dest_id: whId,
          product_id: finalProductId,
          color_id: finalColorId || null,
          size_id: finalSizeId || null,
          tipo_movimiento: movType,
          cantidad: Math.abs(qtyToDeduct),
          saldo_anterior: currentQty,
          saldo_nuevo: currentQty - qtyToDeduct,
          documento_origen: docRef,
          usuario: vendedor || 'Vendedor'
        }]);
      } catch (eKardex) {
        console.warn("finished_goods_kardex insert warning:", eKardex);
      }
    }

    // 2. ALSO UPDATE STORE_INVENTORY (If store_inventory rows exist for this store)
    try {
      let sQuery = supabase.from('store_inventory').select('*')
        .eq('store_id', store.id)
        .eq('product_id', cartItem.product_id);
      if (cartItem.size_id) sQuery = sQuery.eq('size_id', cartItem.size_id);
      if (cartItem.color_id) sQuery = sQuery.eq('color_id', cartItem.color_id);
      const { data: sData } = await sQuery;

      if (sData && sData.length > 0) {
        const sStock = sData[0];
        const sCurrentQty = Number(sStock.cantidad_disponible) || 0;
        await supabase.from('store_inventory')
          .update({ 
            cantidad_disponible: sCurrentQty - qtyToDeduct,
            updated_at: new Date().toISOString()
          })
          .eq('id', sStock.id);

        await supabase.from('store_kardex').insert([{
          store_id: store.id,
          product_id: cartItem.product_id,
          color_id: cartItem.color_id || null,
          size_id: cartItem.size_id || null,
          tipo_movimiento: movType,
          cantidad: Math.abs(qtyToDeduct),
          saldo_anterior: sCurrentQty,
          saldo_nuevo: sCurrentQty - qtyToDeduct,
          documento_ref: docRef,
          usuario: vendedor || 'Vendedor'
        }]);
      } else if (!store.bodega_asociada_id) {
        const newQty = 0 - qtyToDeduct;
        await supabase.from('store_inventory').insert([{
          store_id: store.id,
          product_id: cartItem.product_id,
          size_id: cartItem.size_id || null,
          color_id: cartItem.color_id || null,
          cantidad_disponible: newQty,
          cantidad_reservada: 0
        }]);

        await supabase.from('store_kardex').insert([{
          store_id: store.id,
          product_id: cartItem.product_id,
          color_id: cartItem.color_id || null,
          size_id: cartItem.size_id || null,
          tipo_movimiento: movType,
          cantidad: Math.abs(qtyToDeduct),
          saldo_anterior: 0,
          saldo_nuevo: newQty,
          documento_ref: docRef,
          usuario: vendedor || 'Vendedor'
        }]);
      }
    } catch (errStoreInv) {
      console.warn("store_inventory sync warning:", errStoreInv);
    }

    // 3. FIFO DEDUCTION OF INDIVIDUAL_GARMENTS (Barcode tags)
    if (qtyToDeduct > 0) {
      try {
        const refName = productObj?.nombre_producto || productObj?.codigo_referencia || cartItem.nombre;
        const sizeCode = sizeObj?.codigo_talla;
        const colorName = colorObj?.nombre_color;

        let gQuery = supabase.from('individual_garments')
          .select('id, barcode')
          .in('status', ['Aprobada', 'Terminada', 'En Inventario', 'Recibido']);

        if (store.bodega_asociada_id) {
          gQuery = gQuery.or(`warehouse_id.eq.${store.bodega_asociada_id},store_id.eq.${store.id}`);
        } else {
          gQuery = gQuery.eq('store_id', store.id);
        }

        if (sizeCode) gQuery = gQuery.eq('size_code', sizeCode);
        if (colorName) gQuery = gQuery.eq('color_name', colorName);

        let { data: localGarms } = await gQuery.limit(qtyToDeduct);
        let matchedGarments = localGarms || [];

        if (matchedGarments.length < qtyToDeduct && refName) {
          let gRefQuery = supabase.from('individual_garments')
            .select('id, barcode')
            .in('status', ['Aprobada', 'Terminada', 'En Inventario', 'Recibido']);
          if (store.bodega_asociada_id) {
            gRefQuery = gRefQuery.or(`warehouse_id.eq.${store.bodega_asociada_id},store_id.eq.${store.id}`);
          } else {
            gRefQuery = gRefQuery.eq('store_id', store.id);
          }
          gRefQuery = gRefQuery.or(`reference_name.eq.${refName},reference_name.ilike.%${refName}%`);
          const { data: refGarms } = await gRefQuery.limit(qtyToDeduct - matchedGarments.length);
          if (refGarms && refGarms.length > 0) {
            const existingIds = new Set(matchedGarments.map(g => g.id));
            refGarms.forEach(g => { if (!existingIds.has(g.id)) matchedGarments.push(g); });
          }
        }

        if (matchedGarments.length === 0 && sizeCode && refName) {
          const { data: globalGarms } = await supabase.from('individual_garments')
            .select('id, barcode')
            .in('status', ['Aprobada', 'Terminada', 'En Inventario', 'Recibido'])
            .eq('size_code', sizeCode)
            .or(`reference_name.eq.${refName},reference_name.ilike.%${refName}%`)
            .limit(qtyToDeduct);
          matchedGarments = globalGarms || [];
        }

        if (matchedGarments.length > 0) {
          const ids = matchedGarments.map(g => g.id);
          await supabase.from('individual_garments')
            .update({ 
              status: 'Vendido', 
              sold_at: new Date().toISOString(),
              notes: `${docRef} - Vendedor: ${vendedor || 'Vendedor'}` 
            })
            .in('id', ids);
        }
      } catch (eGarm) {
        console.warn("individual_garments FIFO deduction warning:", eGarm);
      }
    }
  };

  const syncQueueOfflineSales = async () => {
    const queue = [...syncQueue];
    const remainingQueue: any[] = [];

    for (const item of queue) {
      try {
        const { data: newSale, error: saleErr } = await supabase
          .from('pos_sales')
          .insert([{
            session_id: item.sale.session_id,
            store_id: item.sale.store_id,
            client_name: item.sale.client_name,
            client_document: item.sale.client_document,
            vendedor: item.sale.vendedor,
            subtotal: item.sale.subtotal,
            descuento: item.sale.descuento,
            impuestos: item.sale.impuestos,
            total: item.sale.total,
            sincronizado_erp: true
          }])
          .select()
          .single();

        if (saleErr) throw saleErr;

        for (const cartItem of item.items) {
          await supabase.from('pos_sale_items').insert({
            sale_id: newSale.id,
            product_id: cartItem.product_id,
            color_id: cartItem.color_id,
            size_id: cartItem.size_id,
            cantidad: cartItem.cantidad,
            precio_unitario: cartItem.precio,
            subtotal: cartItem.precio * cartItem.cantidad,
            total: cartItem.precio * cartItem.cantidad
          });

          await deductStockForSaleItem({
            store: selectedStore || { id: item.sale.store_id, nombre: 'POS' },
            cartItem,
            consecutive: newSale.consecutive,
            vendedor: item.sale.vendedor,
            productsList: products,
            colorsList: colors,
            sizesList: sizes,
            inventoryList: inventoryList
          });
        }

        if (item.payments && Array.isArray(item.payments) && item.payments.length > 0) {
          for (const p of item.payments) {
            await supabase.from('pos_payments').insert({
              sale_id: newSale.id,
              metodo_pago: p.metodo_pago,
              monto: p.monto
            });
          }
        } else if (item.payment) {
          await supabase.from('pos_payments').insert({
            sale_id: newSale.id,
            metodo_pago: item.payment.metodo_pago,
            monto: item.payment.monto
          });
        }

      } catch (err) {
        console.error('Error in sync queue:', err);
        remainingQueue.push(item);
      }
    }

    setSyncQueue(remainingQueue);
    localStorage.setItem('pos_sync_queue', JSON.stringify(remainingQueue));
    if (queue.length > remainingQueue.length) {
      fetchInlineInventory();
      fetchInlineSales();
      if (currentSession) fetchSessionSalesTotal(currentSession.id);
    }
  };

  const getProductPrice = (product: any, priceListId: string, customItems: any[], totalCartQty: number = 1) => {
    let basePrice = product.precio || 35000;
    if (!priceListId) return basePrice;

    const pl = priceLists.find(l => l.id === priceListId);
    if (!pl || !pl.activo) return basePrice;

    const rules = parsePriceListRules(pl);
    const minQty = rules.cantidad_minima || 1;

    // Regla 1: Volumen mínimo de prendas
    if (totalCartQty < minQty) {
      return basePrice;
    }

    const prodCategory = getPremiumReferenceCategory(product);
    const prodRef = product.codigo_referencia || '';
    const prodId = product.id || '';
    const prodName = (product.nombre_producto || '').toLowerCase();

    // Regla 2: Filtro de Categorías / Referencias Permitidas
    if (!rules.aplica_todas_categorias && rules.categorias_permitidas && rules.categorias_permitidas.length > 0) {
      const isAllowed = rules.categorias_permitidas.some(allowed => {
        const a = (allowed || '').toLowerCase();
        return a === prodCategory.toLowerCase() ||
               a === prodRef.toLowerCase() ||
               a === prodId.toLowerCase() ||
               a === `ref:${prodRef}`.toLowerCase() ||
               a === `prod:${prodId}`.toLowerCase() ||
               prodName.includes(a);
      });
      if (!isAllowed) {
        return basePrice;
      }
    }

    // Regla 3: Precios / Descuentos específicos por Producto o Referencia (Prioridad Máxima)
    const specialProd = customItems.find(item => 
      item.price_list_id === priceListId && 
      (item.categoria === prodId || item.categoria === prodRef || item.categoria === `PROD:${prodId}` || item.categoria === `REF:${prodRef}`)
    );

    if (specialProd && specialProd.valor_descuento !== null && specialProd.valor_descuento !== undefined && Number(specialProd.valor_descuento) > 0) {
      const discountVal = Number(specialProd.valor_descuento);
      if (specialProd.tipo_descuento === 'precio_fijo') {
        return Math.max(0, discountVal);
      } else if (specialProd.tipo_descuento === 'porcentaje') {
        return Math.max(0, basePrice - (basePrice * (discountVal / 100)));
      } else {
        return Math.max(0, basePrice - discountVal);
      }
    }

    // Regla 4: Precios / Descuentos específicos por Categoría (Referencia Premium)
    const specialCat = customItems.find(item => {
      if (item.price_list_id !== priceListId) return false;
      const catKey = (item.categoria || '').toLowerCase();
      return catKey === prodCategory.toLowerCase() ||
             prodName.includes(catKey) ||
             (product.categories?.categoria && product.categories.categoria.toLowerCase() === catKey);
    });

    if (specialCat && specialCat.valor_descuento !== null && specialCat.valor_descuento !== undefined && Number(specialCat.valor_descuento) > 0) {
      const discountVal = Number(specialCat.valor_descuento);
      if (specialCat.tipo_descuento === 'precio_fijo') {
        return Math.max(0, discountVal);
      } else if (specialCat.tipo_descuento === 'porcentaje') {
        return Math.max(0, basePrice - (basePrice * (discountVal / 100)));
      } else {
        return Math.max(0, basePrice - discountVal);
      }
    }

    // Regla 5: Precios / Descuentos por Tipo de Prenda: BODY y TOP
    if (isBodyProduct(product)) {
      const bodyItem = customItems.find(item => item.price_list_id === priceListId && item.categoria?.toUpperCase() === 'BODY');
      const bodyVal = bodyItem?.valor_descuento !== undefined && bodyItem?.valor_descuento !== null
        ? Number(bodyItem.valor_descuento)
        : (rules.body_discount_val !== '' && rules.body_discount_val !== undefined ? Number(rules.body_discount_val) : null);
      const bodyType = bodyItem?.tipo_descuento || rules.body_discount_type || 'precio_fijo';
      
      if (bodyVal !== null && !isNaN(bodyVal) && bodyVal > 0) {
        if (bodyType === 'precio_fijo') {
          return Math.max(0, bodyVal);
        } else if (bodyType === 'porcentaje') {
          return Math.max(0, basePrice - (basePrice * (bodyVal / 100)));
        } else {
          return Math.max(0, basePrice - bodyVal);
        }
      }
    } else if (isTopProduct(product)) {
      const topItem = customItems.find(item => item.price_list_id === priceListId && item.categoria?.toUpperCase() === 'TOP');
      const topVal = topItem?.valor_descuento !== undefined && topItem?.valor_descuento !== null
        ? Number(topItem.valor_descuento)
        : (rules.top_discount_val !== '' && rules.top_discount_val !== undefined ? Number(rules.top_discount_val) : null);
      const topType = topItem?.tipo_descuento || rules.top_discount_type || 'precio_fijo';
      
      if (topVal !== null && !isNaN(topVal) && topVal > 0) {
        if (topType === 'precio_fijo') {
          return Math.max(0, topVal);
        } else if (topType === 'porcentaje') {
          return Math.max(0, basePrice - (basePrice * (topVal / 100)));
        } else {
          return Math.max(0, basePrice - topVal);
        }
      }
    }

    // Regla 6: Descuento global de la lista
    if (pl.valor_descuento_global !== null && pl.valor_descuento_global !== undefined && Number(pl.valor_descuento_global) > 0) {
      const globalVal = Number(pl.valor_descuento_global);
      if (pl.tipo_descuento_global === 'porcentaje') {
        return Math.max(0, basePrice - (basePrice * (globalVal / 100)));
      } else {
        return Math.max(0, basePrice - globalVal);
      }
    }

    return basePrice;
  };

  useEffect(() => {
    setCart(prevCart => {
      const totalQty = prevCart.reduce((sum, item) => sum + (item.is_return ? 0 : (item.cantidad || 0)), 0);
      let changed = false;
      const updated = prevCart.map(item => {
        if (item.is_return) return item;
        const productObj = products.find(p => p.id === item.product_id);
        if (productObj) {
          const newPrice = getProductPrice(productObj, selectedPriceListId, priceListItems, totalQty);
          if (newPrice !== item.precio) {
            changed = true;
            return { ...item, precio: newPrice };
          }
        }
        return item;
      });
      return changed ? updated : prevCart;
    });
  }, [selectedPriceListId, products, priceListItems, priceLists, cart.reduce((sum, item) => sum + (item.is_return ? 0 : (item.cantidad || 0)), 0)]);

  const doAddToCart = (product: any, colorId: string | null, sizeId: string | null) => {
    const existingIndex = cart.findIndex(item => item.product_id === product.id && item.size_id === sizeId && item.color_id === colorId && !item.is_return);
    const simulatedCart = existingIndex > -1
      ? cart.map((it, i) => i === existingIndex ? { ...it, cantidad: it.cantidad + 1 } : it)
      : [...cart, { product_id: product.id, cantidad: 1 }];
    const totalQty = simulatedCart.reduce((sum, item) => sum + (item.is_return ? 0 : (item.cantidad || 0)), 0);

    const resolvedPrice = getProductPrice(product, selectedPriceListId, priceListItems, totalQty);

    if (existingIndex > -1) {
      const newCart = [...cart];
      newCart[existingIndex].cantidad += 1;
      newCart[existingIndex].precio = resolvedPrice;
      setCart(newCart);
    } else {
      setCart([...cart, {
        product_id: product.id,
        nombre: product.nombre_producto,
        codigo_referencia: product.codigo_referencia,
        precio: resolvedPrice,
        color_id: colorId,
        size_id: sizeId,
        cantidad: 1,
        is_return: false,
        imagen_url: product.imagen_url
      }]);
    }
  };

  const resolveProductForGarment = (garment: any) => {
    if (!garment) return null;
    const refRaw = (garment.reference_name || '').trim().toLowerCase();
    const cleanRef = refRaw.replace(/\s*premium\s*/gi, '').trim();

    // 1. Direct ID match from sewing_orders
    if (garment.sewing_orders?.product_id) {
      const p = products.find(prod => prod.id === garment.sewing_orders.product_id);
      if (p) return p;
    }

    // 2. Exact match by reference code or full name
    let found = products.find(p => {
      const pName = (p.nombre_producto || '').trim().toLowerCase();
      const pCode = (p.codigo_referencia || '').trim().toLowerCase();
      return pName === refRaw || pCode === refRaw;
    });
    if (found) return found;

    // 3. Clean name match (e.g. "Top Lassie Corto" matches "Top Lassie Corto Premium", Ref 21060)
    found = products.find(p => {
      const pName = (p.nombre_producto || '').trim().toLowerCase();
      const pClean = pName.replace(/\s*premium\s*/gi, '').trim();
      const pCat = (p.categories?.categoria || '').trim().toLowerCase();
      const pCode = (p.codigo_referencia || '').trim().toLowerCase();
      return pClean === cleanRef || pCat === cleanRef || pCode === cleanRef ||
        (cleanRef.length >= 4 && pClean.includes(cleanRef)) ||
        (cleanRef.length >= 4 && cleanRef.includes(pClean));
    });
    if (found) return found;

    // 4. Keyword / category match
    found = products.find(p => {
      const pName = (p.nombre_producto || '').trim().toLowerCase();
      const pCat = (p.categories?.categoria || '').trim().toLowerCase();
      const words = cleanRef.split(' ').filter((w: string) => w.length > 3);
      return words.length > 0 && words.every((w: string) => pName.includes(w) || pCat.includes(w));
    });

    return found || null;
  };

  const resolveColorForGarment = (colorNameRaw: string) => {
    const gColor = (colorNameRaw || '').trim().toLowerCase();
    if (!gColor) return null;
    return colors.find(c => {
      const cName = (c.nombre_color || '').trim().toLowerCase();
      const cCode = (c.codigo_color || '').trim().toLowerCase();
      return cName === gColor || (cCode && gColor.includes(cCode)) || 
        (cName.length >= 4 && gColor.includes(cName)) || 
        (gColor.length >= 4 && cName.includes(gColor));
    }) || null;
  };

  const resolveSizeForGarment = (sizeCodeRaw: string) => {
    const gSize = (sizeCodeRaw || '').trim().toLowerCase().replace(/[\s\-_a]/g, '');
    if (!gSize) return null;
    return sizes.find(s => {
      const sName = (s.nombre_talla || '').trim().toLowerCase().replace(/[\s\-_a]/g, '');
      const sCode = (s.codigo_talla || '').trim().toLowerCase().replace(/[\s\-_a]/g, '');
      return sCode === gSize || sName === gSize || 
        (gSize === 'unica' && (sCode === 'unica' || sCode === 'u' || sName === 'unica' || sName === 'u')) || 
        (gSize === 'u' && (sCode === 'unica' || sCode === 'u' || sName === 'unica' || sName === 'u')) || 
        (gSize === 'lxl' && (sCode === 'lxl' || sName.includes('lx') || sCode.includes('lxl'))) || 
        (gSize === 'sm' && (sCode === 'sm' || sName.includes('sm') || sCode.includes('sm')));
    }) || null;
  };

  const handleScanBarcodeDirect = async (barcodeToScan: string) => {
    const term = barcodeToScan.trim();
    if (!term) return;

    // 1. Search in individual_garments
    try {
      let { data: garment } = await supabase
        .from('individual_garments')
        .select('*, sewing_orders(*, products(*))')
        .eq('barcode', term)
        .maybeSingle();

      if (!garment && term.length >= 5) {
        const { data: partial } = await supabase
          .from('individual_garments')
          .select('*, sewing_orders(*, products(*))')
          .ilike('barcode', `%${term}%`)
          .limit(1)
          .maybeSingle();
        garment = partial;
      }

      if (garment) {
        let matchedProduct = resolveProductForGarment(garment);
        
        // If not found in loaded products, query Supabase products directly
        if (!matchedProduct) {
          const cleanRef = (garment.reference_name || '').replace(/\s*premium\s*/gi, '').trim();
          const { data: dbProd } = await supabase
            .from('products')
            .select('*, categories(*)')
            .or(`nombre_producto.ilike.%${cleanRef}%,codigo_referencia.ilike.%${cleanRef}%,codigo_referencia.eq.21060`)
            .limit(1)
            .maybeSingle();
          if (dbProd) matchedProduct = dbProd;
        }

        if (matchedProduct) {
          const matchedColor = resolveColorForGarment(garment.color_name || '');
          const matchedSize = resolveSizeForGarment(garment.size_code || '');

          doAddToCart(matchedProduct, matchedColor?.id || null, matchedSize?.id || null);
          setSearchQuery('');
          setScannedGarment(null);
          setResolvedBarcodeRef(null);
          return;
        }
      }
    } catch (e) {
      console.error('Error scanning barcode in individual_garments:', e);
    }

    // 2. Direct product match (SKU, reference code, barcode, or name)
    const directProd = products.find(p => 
      p.codigo_referencia?.trim().toLowerCase() === term.toLowerCase() ||
      p.sku?.trim().toLowerCase() === term.toLowerCase() ||
      p.nombre_producto?.trim().toLowerCase() === term.toLowerCase()
    );

    if (directProd) {
      handleAddToCart(directProd);
      setSearchQuery('');
      return;
    }

    // 3. Fallback to first filtered product
    if (filteredProducts.length > 0) {
      handleAddToCart(filteredProducts[0]);
      setSearchQuery('');
    }
  };

  const handleAddToCart = (product: any) => {
    // 1. If scanned barcode is active, match EXACT variant and add immediately
    if (scannedGarment) {
      const resolved = resolveProductForGarment(scannedGarment);
      if (resolved && (resolved.id === product.id || resolved.nombre_producto === product.nombre_producto)) {
        const matchedColor = resolveColorForGarment(scannedGarment.color_name || '');
        const matchedSize = resolveSizeForGarment(scannedGarment.size_code || '');
        doAddToCart(product, matchedColor?.id || null, matchedSize?.id || null);
        setSearchQuery('');
        setScannedGarment(null);
        setResolvedBarcodeRef(null);
        return;
      }
    }

    const inStockItems = inventoryList.filter(inv => 
      (inv.product_id === product.id || (inv.products?.nombre_producto && inv.products.nombre_producto.trim().toLowerCase() === product.nombre_producto?.trim().toLowerCase())) &&
      Number(inv.cantidad_disponible) > 0
    );

    // 2. Variant selection
    if (inStockItems.length === 1) {
       doAddToCart(product, inStockItems[0].color_id, inStockItems[0].size_id);
       return;
    }

    if (inStockItems.length > 1) {
      setSelectedProductForVariants(product);
      setProductVariants(inStockItems);
      setVariantSearch('');
      setShowVariantModal(true);
      return;
    }

    // Fallback: If no inventory registered yet, allow adding with default or generic color/size
    const defaultColor = colors[0]?.id || null;
    const defaultSize = sizes.find(s => s.codigo_talla === 'UNICA' || s.codigo_talla === 'U')?.id || sizes[0]?.id || null;
    doAddToCart(product, defaultColor, defaultSize);
  };

  const handleQuickAddGarmentToCart = (garment: any) => {
    // 1. Find product in catalog
    let matchedProduct = resolveProductForGarment(garment);

    if (!matchedProduct) {
      alert(`No se encontró el producto en catálogo para la referencia "${garment.reference_name}".`);
      return;
    }

    // 2. Match color and size
    const matchedColor = resolveColorForGarment(garment.color_name || '');
    const matchedSize = resolveSizeForGarment(garment.size_code || '');

    doAddToCart(matchedProduct, matchedColor?.id || null, matchedSize?.id || null);
    setActiveMenuId('pos');
  };

  const handleAddReturnToCart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnProduct) return;
    
    setCart([...cart, {
      product_id: returnProduct.id,
      nombre: `[DEVOLUCIÓN] ${returnProduct.nombre_producto}`,
      codigo_referencia: returnProduct.codigo_referencia,
      precio: Number(returnPrice),
      color_id: returnColorId || null,
      size_id: returnSizeId || null,
      cantidad: -1, // Negative quantity registers credit & restores stock
      is_return: true
    }]);

    setShowReturnModal(false);
    setReturnProduct(null);
    setReturnSizeId('');
    setReturnColorId('');
  };

  const handleUpdateQty = (index: number, qty: number) => {
    const newCart = [...cart];
    newCart[index].cantidad += qty;
    if (newCart[index].cantidad === 0) {
      newCart.splice(index, 1);
    }
    setCart(newCart);
  };

  const handleCheckout = async () => {
    if (!currentSession && isOnline) return alert('Debes abrir caja antes de registrar ventas.');
    if (cart.length === 0) return alert('El carrito está vacío.');

    const localDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    
    const activePromo = promotions.find(p => {
      if (!p.activo) return false;
      const startStr = p.fecha_inicio ? p.fecha_inicio.substring(0, 10) : null;
      const endStr = p.fecha_fin ? p.fecha_fin.substring(0, 10) : null;
      if (startStr && localDateStr < startStr) return false;
      if (endStr && localDateStr > endStr) return false;
      return true;
    });

    const subtotal = cart.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    let discountAmount = 0;
    if (activePromo && subtotal > 0) {
      if (activePromo.tipo === 'Porcentaje') {
        discountAmount = subtotal * (Number(activePromo.valor) / 100);
      } else if (activePromo.tipo === 'Valor Fijo') {
        discountAmount = Number(activePromo.valor);
      }
    }
    const total = Math.max(0, subtotal - discountAmount);

    const activeTransferObj = transferMethods.find(m => m.id === selectedTransferMethodId) || transferMethods.find(m => m.activo !== false);
    let finalObs = cartNotes.trim();

    // Build payment records array
    const paymentsToInsert: { metodo_pago: string; monto: number }[] = [];

    if (paymentMethod === 'Mixto') {
      const numCash = Number(mixedCashAmount) || 0;
      const numCard = Number(mixedCardAmount) || 0;
      const numTransfer = Number(mixedTransferAmount) || 0;
      const totalPaid = numCash + numCard + numTransfer;

      if (totalPaid < total) {
        return alert(`⚠️ En Pago Mixto, el total asignado ($${totalPaid.toLocaleString('es-CO')}) es menor al total a pagar ($${total.toLocaleString('es-CO')}). Faltan $${(total - totalPaid).toLocaleString('es-CO')}.`);
      }

      if (numCard + numTransfer > total) {
        return alert(`⚠️ La suma de Tarjeta ($${numCard.toLocaleString('es-CO')}) y Transferencia ($${numTransfer.toLocaleString('es-CO')}) supera el total de la venta ($${total.toLocaleString('es-CO')}). Solo el efectivo admite excedente para vueltos.`);
      }

      const cashApplied = Math.max(0, total - numCard - numTransfer);
      const change = Math.max(0, numCash - cashApplied);

      const parts: string[] = [];
      if (cashApplied > 0) {
        paymentsToInsert.push({ metodo_pago: 'Efectivo', monto: cashApplied });
        parts.push(`Efectivo: $${cashApplied.toLocaleString('es-CO')}${change > 0 ? ` (Entregado: $${numCash.toLocaleString('es-CO')}, Vueltos: $${change.toLocaleString('es-CO')})` : ''}`);
      }
      if (numCard > 0) {
        paymentsToInsert.push({ metodo_pago: 'Tarjeta', monto: numCard });
        parts.push(`Tarjeta: $${numCard.toLocaleString('es-CO')}`);
      }
      if (numTransfer > 0) {
        const transferLabel = activeTransferObj ? `Transferencia (${activeTransferObj.banco})` : 'Transferencia';
        paymentsToInsert.push({ metodo_pago: transferLabel, monto: numTransfer });
        parts.push(`${transferLabel}: $${numTransfer.toLocaleString('es-CO')}${transferReferenceCode ? ` [Ref: ${transferReferenceCode}]` : ''}`);
      }

      if (paymentsToInsert.length === 0) {
        return alert('⚠️ Debes ingresar los montos correspondientes para el pago mixto.');
      }

      const mixedDetail = `[Pago Mixto: ${parts.join(' + ')}]`;
      finalObs = finalObs ? `${finalObs} | ${mixedDetail}` : mixedDetail;
    } else if (paymentMethod === 'Transferencia') {
      const transferLabel = activeTransferObj ? `Transferencia (${activeTransferObj.banco})` : 'Transferencia';
      const refDetail = `[Transferencia: ${activeTransferObj ? `${activeTransferObj.banco} (${activeTransferObj.tipo_cuenta} #${activeTransferObj.numero_cuenta})` : 'Bancaria'}${transferReferenceCode ? ` - Ref/Aprob: ${transferReferenceCode}` : ''}]`;
      finalObs = finalObs ? `${finalObs} | ${refDetail}` : refDetail;
      paymentsToInsert.push({ metodo_pago: transferLabel, monto: total });
    } else {
      paymentsToInsert.push({ metodo_pago: paymentMethod, monto: total });
    }

    const salePayload = {
      session_id: currentSession?.id || null,
      store_id: selectedStore?.id || null,
      client_name: selectedCustomer.name,
      client_document: selectedCustomer.document,
      vendedor: profile?.full_name || user?.email || 'Vendedor',
      subtotal,
      descuento: discountAmount,
      impuestos: 0,
      total,
      observaciones: finalObs
    };

    const paymentPayload = paymentsToInsert[0] || {
      metodo_pago: paymentMethod === 'Transferencia' && activeTransferObj ? `Transferencia (${activeTransferObj.banco})` : paymentMethod,
      monto: total
    };

    if (!isOnline) {
      const newQueueItem = {
        sale: salePayload,
        items: cart,
        payments: paymentsToInsert,
        payment: paymentPayload,
        timestamp: new Date().toISOString()
      };
      
      const updatedQueue = [...syncQueue, newQueueItem];
      setSyncQueue(updatedQueue);
      localStorage.setItem('pos_sync_queue', JSON.stringify(updatedQueue));
      alert('⚠️ Sin conexión. Venta guardada en la cola de sincronía del terminal.');
      setCart([]);
      setCartNotes('');
      setTransferReferenceCode('');
      setMixedCashAmount('');
      setMixedCardAmount('');
      setMixedTransferAmount('');
      return;
    }

    try {
      const { data: newSale, error: saleErr } = await supabase
        .from('pos_sales')
        .insert([salePayload])
        .select()
        .single();

      if (saleErr) throw saleErr;

      for (const cartItem of cart) {
        await supabase.from('pos_sale_items').insert({
          sale_id: newSale.id,
          product_id: cartItem.product_id,
          color_id: cartItem.color_id,
          size_id: cartItem.size_id,
          cantidad: cartItem.cantidad,
          precio_unitario: cartItem.precio,
          subtotal: cartItem.precio * cartItem.cantidad,
          total: cartItem.precio * cartItem.cantidad
        });

        await deductStockForSaleItem({
          store: selectedStore,
          cartItem,
          consecutive: newSale.consecutive,
          vendedor: profile?.full_name || user?.email || 'Vendedor',
          productsList: products,
          colorsList: colors,
          sizesList: sizes,
          inventoryList: inventoryList
        });
      }

      for (const p of paymentsToInsert) {
        await supabase.from('pos_payments').insert({
          sale_id: newSale.id,
          metodo_pago: p.metodo_pago,
          monto: p.monto
        });
      }

      const consecutiveStr = `${(selectedStore?.nombre || 'POS').substring(0, 3).toUpperCase()}-${String(newSale.consecutive).padStart(4, '0')}`;
      
      const receiptPayload: POSReceiptData = {
        storeName: selectedStore?.nombre || 'TIENDA PRINCIPAL',
        storeAddress: selectedStore?.direccion || 'Sede Comercial',
        storePhone: selectedStore?.telefono || '300 000 0000',
        storeNit: selectedStore?.nit || 'NIT 901.456.789-1',
        consecutive: consecutiveStr,
        date: new Date().toLocaleString('es-CO'),
        cashier: profile?.full_name || user?.email || 'Cajero POS',
        clientName: selectedCustomer.name || 'Cliente General',
        clientDoc: selectedCustomer.document || '2222222222',
        items: cart.map(item => ({
          nombre: item.nombre,
          codigo_referencia: item.codigo_referencia,
          talla: sizes.find(s => s.id === item.size_id)?.codigo_talla || 'U',
          color: colors.find(c => c.id === item.color_id)?.nombre_color || 'Standard',
          cantidad: item.cantidad,
          precio: item.precio,
          subtotal: item.precio * item.cantidad
        })),
        subtotal,
        discount: discountAmount,
        iva: ivaAmount,
        total,
        paymentMethod: paymentMethod,
        payments: paymentsToInsert,
        notes: finalObs
      };

      setLastReceiptData(receiptPayload);
      setShowReceiptModal(true);

      setCart([]);
      setCartNotes('');
      setTransferReferenceCode('');
      setMixedCashAmount('');
      setMixedCardAmount('');
      setMixedTransferAmount('');
      if (currentSession) {
        fetchSessionSalesTotal(currentSession.id);
        fetchSessionSalesDetails(currentSession.id);
      }
      fetchInlineInventory();
      fetchInlineSales();
    } catch (err: any) {
      alert('Error guardando venta: ' + err.message);
    }
  };

  const getAppliedPromotion = () => {
    if (promotions.length === 0) return null;
    const localDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    
    return promotions.find(p => {
      if (!p.activo) return false;
      const startStr = p.fecha_inicio ? p.fecha_inicio.substring(0, 10) : null;
      const endStr = p.fecha_fin ? p.fecha_fin.substring(0, 10) : null;
      if (startStr && localDateStr < startStr) return false;
      if (endStr && localDateStr > endStr) return false;
      return true;
    });
  };

  const activePromo = getAppliedPromotion();
  const subtotalCart = cart.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  
  let discountAmount = 0;
  if (activePromo && subtotalCart > 0) {
    if (activePromo.tipo === 'Porcentaje') {
      discountAmount = subtotalCart * (Number(activePromo.valor) / 100);
    } else if (activePromo.tipo === 'Valor Fijo') {
      discountAmount = Number(activePromo.valor);
    }
  }
  
  const totalCartPrice = Math.max(0, subtotalCart - discountAmount);
  const ivaAmount = Math.round(totalCartPrice - (totalCartPrice / 1.19));

  useEffect(() => {
    const term = searchQuery.trim();
    if (term.length >= 4) {
      const lookupBarcode = async () => {
        try {
          let { data } = await supabase
            .from('individual_garments')
            .select('barcode, reference_name, color_name, size_code, warehouse_id, sewing_orders(product_id)')
            .eq('barcode', term)
            .limit(1)
            .maybeSingle();

          if (!data && term.length >= 5) {
            const { data: partial } = await supabase
              .from('individual_garments')
              .select('barcode, reference_name, color_name, size_code, warehouse_id, sewing_orders(product_id)')
              .ilike('barcode', `%${term}%`)
              .limit(1)
              .maybeSingle();
            data = partial;
          }

          if (data) {
            setResolvedBarcodeRef(data.reference_name || (data as any).sewing_orders?.product_id || null);
            setScannedGarment(data);
          } else {
            setResolvedBarcodeRef(null);
            setScannedGarment(null);
          }
        } catch (e) {
          console.error('Error looking up garment tag/barcode:', e);
          setResolvedBarcodeRef(null);
          setScannedGarment(null);
        }
      };
      lookupBarcode();
    } else {
      setResolvedBarcodeRef(null);
      setScannedGarment(null);
    }
  }, [searchQuery]);

  const filteredProducts = products.filter(p => {
    // 1. If a specific individual barcode tag is scanned/detected, return ONLY the exact matched product
    if (scannedGarment) {
      const resolved = resolveProductForGarment(scannedGarment);
      if (resolved) {
        return p.id === resolved.id;
      }
    }

    const sq = searchQuery.trim().toLowerCase();
    if (!sq) {
      // Check if the product has > 0 inventory in the current store (by product ID or matching product name)
      const hasInventory = inventoryList.some(inv => 
        (inv.product_id === p.id || (inv.products?.nombre_producto && inv.products.nombre_producto.trim().toLowerCase() === p.nombre_producto?.trim().toLowerCase())) && 
        Number(inv.cantidad_disponible) > 0
      );
      return hasInventory;
    }

    const matchesName = p.nombre_producto?.toLowerCase().includes(sq);
    const matchesCode = p.codigo_referencia?.toLowerCase().includes(sq);
    const matchesCategory = p.categories?.categoria?.toLowerCase().includes(sq);

    return matchesName || matchesCode || matchesCategory;
  });

  return (
    <div className="pos-container" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: customBg,
      color: customText,
      fontFamily: `'${customFontFamily}', sans-serif`,
      fontSize: customFontSize,
      fontWeight: customFontWeight as any,
      letterSpacing: '0px',
      overflow: 'hidden',
      userSelect: 'none'
    }}>
      {/* Dynamic Google Fonts Loader */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=${customFontFamily.replace(/\s+/g, '+')}:wght@300;400;500;600;700;800;900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=${customSidebarFontFamily.replace(/\s+/g, '+')}:wght@300;400;500;600;700;800;900&display=swap');
        .pos-container * {
          font-family: '${customFontFamily}', sans-serif;
        }
        .pos-sidebar, .pos-sidebar * {
          font-family: '${customSidebarFontFamily}', sans-serif !important;
        }
        .kpi-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 20px rgba(0,0,0,0.08) !important;
          border-color: rgba(0,0,0,0.05) !important;
        }
        .pos-modal, .pos-modal h3, .pos-modal h4, .pos-modal p, .pos-modal label, .pos-modal span, .pos-modal div {
          color: ${customModalText} !important;
        }
      `}</style>
      <style dangerouslySetInnerHTML={{ __html: `
        /* POS custom scrollbars */
        .pos-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .pos-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .pos-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .pos-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        @media (max-width: 768px) {
          .pos-sidebar {
            display: none !important;
          }
        }
      ` }} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Sidebar (Wine Burgundy theme) */}
        <div className="pos-sidebar" style={{
          width: '240px',
          background: `linear-gradient(180deg, ${customPrimary} 0%, #1a0008 100%)`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '1.5rem 0.75rem',
          height: '100%',
          flexShrink: 0,
          color: 'white',
          boxShadow: '4px 0 20px rgba(0,0,0,0.15)'
        }}>
          {/* Logo & Branding */}
          <div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              flexDirection: customHeaderTextPlacement === 'left' ? 'row-reverse' : 'row',
              justifyContent: customHeaderTextPlacement === 'left' ? 'flex-end' : 'flex-start',
              gap: '0.75rem', 
              marginBottom: '2rem', 
              paddingLeft: '0.5rem' 
            }}>
              {customLogoUrl || config?.logo_url ? (
                <div style={{
                  width: `${customLogoWidth}px`,
                  height: `${customLogoWidth}px`,
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  transition: 'all 0.2s ease',
                  flexShrink: 0
                }}>
                  <img src={customLogoUrl || config?.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
              ) : (
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: customPrimary,
                  fontWeight: '900',
                  fontSize: '1.25rem',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  flexShrink: 0
                }}>
                  B
                </div>
              )}
              {customHeaderText && (
                <div>
                  <div style={{ 
                    fontWeight: '950', 
                    fontSize: customHeaderTextSize || '1rem', 
                    color: customHeaderTextColor || '#80082E',
                    letterSpacing: '0.05em', 
                    lineHeight: '1.1' 
                  }}>
                    {customHeaderText.toUpperCase()}
                  </div>
                  <div style={{ 
                    fontWeight: '600', 
                    fontSize: '0.625rem', 
                    letterSpacing: '0.15em', 
                    opacity: 0.8,
                    color: customHeaderTextColor || '#80082E'
                  }}>
                    CONFECCIONES
                  </div>
                </div>
              )}
            </div>

          {/* Navigation links list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            {/* Section label */}
            <div style={{ fontSize: '0.55rem', fontWeight: '900', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', padding: '0.5rem 1rem 0.4rem', marginBottom: '0.1rem' }}>
              MENÚ PRINCIPAL
            </div>
            {mainItems.map(item => {
              const isActive = activeMenuId === item.id || (item.id === 'pos' && (activeMenuId === 'devoluciones' || activeMenuId === 'cambios'));
              return (
                <div key={item.id} onClick={() => {
                  if (item.id === 'stock_bodegas') {
                    setShowWarehouseStockModal(true);
                  } else if (item.id === 'cambios' || item.id === 'devoluciones') {
                    setShowExchangeModal(true);
                  } else {
                    setActiveMenuId(item.id);
                    if (item.id === 'clientes') fetchCrmCustomers();
                    if (item.id === 'productos') { fetchInlineInventory(); fetchPendingTransfers(); }
                    if (item.id === 'ventas') { fetchInlineSales(); fetchManagerShifts(); }
                  }
                }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.6rem 0.75rem 0.6rem 1rem',
                    borderRadius: '10px', cursor: 'pointer',
                    background: isActive ? `linear-gradient(90deg, ${customPrimary} 0%, ${customSecondary} 100%)` : 'transparent',
                    color: customSidebarText, fontWeight: isActive ? '900' : '600', 
                    fontSize: customSidebarFontSize,
                    fontFamily: customSidebarFontFamily,
                    boxShadow: isActive ? '0 4px 16px rgba(0,0,0,0.3)' : 'none',
                    border: isActive ? '1px solid rgba(255,255,255,0.18)' : '1px solid transparent',
                    borderLeft: isActive ? '3px solid rgba(255,255,255,0.6)' : '3px solid transparent',
                    opacity: isActive ? 1 : 0.72, transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.opacity = '1'; e.currentTarget.style.borderLeft = '3px solid rgba(255,255,255,0.25)'; } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = '0.72'; e.currentTarget.style.borderLeft = '3px solid transparent'; } }}
                >
                  <item.icon size={16} strokeWidth={2.2} style={{ flexShrink: 0 }} />
                  <span style={{ letterSpacing: '0.01em' }}>{item.label}</span>
                </div>
              );
            })}

            {/* Separator */}
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '0.5rem 1rem' }} />
            <div style={{ fontSize: '0.55rem', fontWeight: '900', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', padding: '0.1rem 1rem 0.4rem' }}>
              GESTIÓN
            </div>
            {managementItems.map(item => {
              const isActive = activeMenuId === item.id;
              return (
                <div key={item.id} onClick={() => {
                  setActiveMenuId(item.id);
                  if (item.id === 'reportes') { fetchInlineSales(); fetchManagerShifts(); }
                }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.6rem 0.75rem 0.6rem 1rem',
                    borderRadius: '10px', cursor: 'pointer',
                    background: isActive ? `linear-gradient(90deg, ${customPrimary} 0%, ${customSecondary} 100%)` : 'transparent',
                    color: customSidebarText, fontWeight: isActive ? '900' : '600', 
                    fontSize: customSidebarFontSize,
                    fontFamily: customSidebarFontFamily,
                    boxShadow: isActive ? '0 4px 16px rgba(0,0,0,0.3)' : 'none',
                    border: isActive ? '1px solid rgba(255,255,255,0.18)' : '1px solid transparent',
                    borderLeft: isActive ? '3px solid rgba(255,255,255,0.6)' : '3px solid transparent',
                    opacity: isActive ? 1 : 0.72, transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.opacity = '1'; e.currentTarget.style.borderLeft = '3px solid rgba(255,255,255,0.25)'; } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = '0.72'; e.currentTarget.style.borderLeft = '3px solid transparent'; } }}
                >
                  <item.icon size={16} strokeWidth={2.2} style={{ flexShrink: 0 }} />
                  <span style={{ letterSpacing: '0.01em' }}>{item.label}</span>
                </div>
              );
            })}
          </div>
          </div>

          {/* Active Shift Details Box — Premium Dark Card */}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{
              background: 'linear-gradient(145deg, rgba(15,10,40,0.85) 0%, rgba(40,15,60,0.7) 100%)',
              borderRadius: '16px',
              padding: '1.1rem',
              border: '1px solid rgba(255,255,255,0.12)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Decorative glow orb */}
              <div style={{
                position: 'absolute', top: '-20px', right: '-20px',
                width: '80px', height: '80px',
                borderRadius: '50%',
                background: currentSession
                  ? 'radial-gradient(circle, rgba(34,197,94,0.25) 0%, transparent 70%)'
                  : 'radial-gradient(circle, rgba(239,68,68,0.2) 0%, transparent 70%)',
                pointerEvents: 'none'
              }} />

              {/* Header row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div style={{
                    width: '7px', height: '7px', borderRadius: '50%',
                    backgroundColor: currentSession ? '#22c55e' : '#ef4444',
                    boxShadow: currentSession ? '0 0 8px #22c55e' : '0 0 8px #ef4444',
                    animation: currentSession ? 'pulse 2s infinite' : 'none'
                  }} />
                  <span style={{ fontSize: '0.6rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.6)' }}>
                    TURNO ACTIVO
                  </span>
                </div>
                <span style={{
                  background: currentSession ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)',
                  color: currentSession ? '#86efac' : '#fca5a5',
                  border: `1px solid ${currentSession ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`,
                  fontSize: '0.52rem', fontWeight: '900',
                  padding: '0.18rem 0.5rem', borderRadius: '20px',
                  textTransform: 'uppercase', letterSpacing: '0.05em'
                }}>
                  {currentSession ? 'En curso' : 'Cerrado'}
                </span>
              </div>

              {/* Sales Total Highlight */}
              <div style={{
                background: 'linear-gradient(90deg, rgba(128,8,46,0.4) 0%, rgba(216,27,96,0.3) 100%)',
                borderRadius: '10px',
                padding: '0.7rem 0.85rem',
                marginBottom: '0.85rem',
                border: '1px solid rgba(216,27,96,0.2)'
              }}>
                <div style={{ fontSize: '0.55rem', fontWeight: '800', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.2rem' }}>Ventas del Turno</div>
                <div style={{ fontSize: '1.3rem', fontWeight: '950', color: 'white', fontFamily: 'monospace', lineHeight: 1 }}>
                  ${currentSession ? currentSessionSalesTotal.toLocaleString('es-CO') : '0'}
                </div>
              </div>

              {/* KPI Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[
                  { label: 'Apertura', value: currentSession ? new Date(currentSession.fecha_apertura).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—' },
                  { label: 'Terminal', value: selectedRegister?.codigo_caja || '—' },
                  { label: 'Efectivo inicial', value: currentSession ? `$${Number(currentSession.monto_apertura).toLocaleString('es-CO')}` : '—' },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                    <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.45)', fontWeight: '700' }}>{row.label}</span>
                    <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.85)', fontWeight: '800' }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {currentSession && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      fetchSessionSalesDetails(currentSession.id);
                      setShowSessionTransactionsModal(true);
                    }}
                    style={{
                      width: '100%',
                      marginTop: '0.75rem',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.2)',
                      background: 'rgba(255,255,255,0.1)',
                      color: 'white',
                      fontSize: '0.68rem',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                  >
                    📊 Transacciones ({sessionSalesDetails.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCashMovementModal(true)}
                    style={{
                      width: '100%',
                      marginTop: '0.4rem',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      background: 'rgba(16, 185, 129, 0.18)',
                      color: '#6ee7b7',
                      fontSize: '0.68rem',
                      fontWeight: '850',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.3)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.18)'}
                  >
                    💵 Movimiento de Caja (Ingreso / Retiro)
                  </button>
                </>
              )}
            </div>

            {/* Open / Close session button */}
            {currentSession ? (
              <button
                onClick={() => setShowCloseSessionModal(true)}
                style={{
                  width: '100%',
                  padding: '0.7rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(239,68,68,0.4)',
                  background: 'rgba(239,68,68,0.1)',
                  color: '#fca5a5',
                  fontSize: '0.75rem',
                  fontWeight: '850',
                  cursor: 'pointer',
                  textAlign: 'center',
                  letterSpacing: '0.03em',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.22)'; e.currentTarget.style.color = 'white'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#fca5a5'; }}
              >
                ⏹ Cerrar Turno
              </button>
            ) : (
              <button
                onClick={() => setShowOpenSessionModal(true)}
                style={{
                  width: '100%',
                  padding: '0.7rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(90deg, #80082E 0%, #D81B60 100%)',
                  color: 'white',
                  fontSize: '0.75rem',
                  fontWeight: '900',
                  cursor: 'pointer',
                  textAlign: 'center',
                  letterSpacing: '0.03em',
                  boxShadow: '0 4px 16px rgba(216,27,96,0.4)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 24px rgba(216,27,96,0.6)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(216,27,96,0.4)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                ▶ Abrir Turno
              </button>
            )}
          </div>

        </div>

        {/* Main Workspace Column — font applied here */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: `'${customFontFamily}', sans-serif`, fontSize: customFontSize }}>
          
          {/* Top Header */}
          <div style={{
            height: '65px',
            backgroundColor: 'white',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1.5rem',
            flexShrink: 0
          }}>
            {/* Connection Status Badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: '#f1f5f9',
              padding: '0.45rem 1rem',
              borderRadius: '20px',
              fontSize: '0.72rem',
              fontWeight: '800',
              border: '1px solid #e2e8f0'
            }}>
              <span>ERP CENTRAL</span>
              <span style={{ display: 'inline-block', width: '6px', height: '6px', backgroundColor: isOnline ? '#22c55e' : '#ef4444', borderRadius: '50%' }} />
              <span style={{ color: '#64748b' }}>{isOnline ? 'Conectado' : 'Sin conexión'}</span>
            </div>

            {/* Centralized Search Bar */}
            <div style={{ position: 'relative', width: `${customSearchWidth}%`, transition: 'all 0.2s ease' }}>
              <Search size={16} style={{ position: 'absolute', left: '1.15rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Buscar por etiqueta, código de barras, nombre o referencia..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleScanBarcodeDirect(searchQuery);
                  }
                }}
                style={{
                  width: '100%',
                  height: `${customSearchHeight}px`,
                  padding: '0.2rem 3rem 0.2rem 2.65rem',
                  borderRadius: '24px',
                  border: `2px solid ${searchQuery ? customPrimary : '#cbd5e1'}`,
                  backgroundColor: '#f8fafc',
                  fontSize: '0.85rem',
                  fontWeight: '750',
                  color: '#0f172a',
                  outline: 'none',
                  boxShadow: searchQuery ? `0 0 10px ${customPrimary}1a` : 'none',
                  transition: 'all 0.15s ease'
                }}
                onFocus={e => { e.currentTarget.style.borderColor = customPrimary; e.currentTarget.style.boxShadow = `0 4px 14px ${customPrimary}20`; e.currentTarget.style.backgroundColor = '#ffffff'; }}
                onBlur={e => { if (!searchQuery) { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.backgroundColor = '#f8fafc'; } }}
              />
              <span style={{ position: 'absolute', right: '2.5rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.62rem', fontWeight: '900', color: '#94a3b8', backgroundColor: '#e2e8f0', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                Ctrl+K
              </span>
              <QrCode size={16} style={{ position: 'absolute', right: '1.15rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', cursor: 'pointer' }} />

              {/* Tag / Barcode live detected popup */}
              {scannedGarment && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  right: 0,
                  zIndex: 1000,
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #10b981',
                  borderRadius: '14px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 12px 28px rgba(0,0,0,0.14)',
                  animation: 'fadeIn 0.2s ease-out'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ backgroundColor: '#ecfdf5', color: '#059669', padding: '0.25rem 0.65rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      🏷️ Etiqueta #{scannedGarment.barcode}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#0f172a' }}>{scannedGarment.reference_name}</span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Color: <strong style={{ color: '#0f172a' }}>{scannedGarment.color_name}</strong> | Talla: <strong style={{ color: '#0f172a' }}>{scannedGarment.size_code}</strong></span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleScanBarcodeDirect(scannedGarment.barcode)}
                    style={{
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      padding: '0.45rem 1rem',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: '850',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      boxShadow: '0 2px 8px rgba(16,185,129,0.3)'
                    }}
                    >
                      <ShoppingCart size={14} /> Agregar
                    </button>
                </div>
              )}
            </div>

            {/* User status widgets */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowWarehouseStockModal(true)}
                style={{
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.45rem 0.95rem',
                  borderRadius: '10px',
                  fontSize: '0.78rem',
                  fontWeight: '850',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  boxShadow: '0 2px 8px rgba(59,130,246,0.35)',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <Building2 size={14} /> 🏢 Stock en Bodegas
              </button>

              <button
                type="button"
                onClick={() => setShowExchangeModal(true)}
                style={{
                  backgroundColor: '#ec4899',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.45rem 0.95rem',
                  borderRadius: '10px',
                  fontSize: '0.78rem',
                  fontWeight: '850',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  boxShadow: '0 2px 8px rgba(236,72,153,0.35)',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <RefreshCcw size={14} /> Módulo de Cambios
              </button>

              {currentSession && (
                <button
                  type="button"
                  onClick={() => setShowCashMovementModal(true)}
                  style={{
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.45rem 0.95rem',
                    borderRadius: '10px',
                    fontSize: '0.78rem',
                    fontWeight: '850',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    boxShadow: '0 2px 8px rgba(16,185,129,0.35)',
                    transition: 'all 0.15s'
                  }}
                  title="Registrar Ingreso o Egreso de efectivo menor (Parqueadero, aseo, sencillo, etc.)"
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <DollarSign size={14} /> 💵 Movimiento Caja
                </button>
              )}

              <div 
                onClick={() => {
                  setShowAlertsModal(true);
                  setUnreadAlertsCount(0);
                  localStorage.setItem('pos_last_read_alerts', new Date().toISOString());
                }}
                style={{ position: 'relative', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
              >
                <Bell size={customHeaderIconSize} />
                {unreadAlertsCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    backgroundColor: customPrimary,
                    color: customButtonText,
                    fontSize: '0.55rem',
                    fontWeight: '900',
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                  }}>{unreadAlertsCount}</span>
                )}
              </div>

              <div 
                onClick={async () => {
                  setShowChatModal(!showChatModal);
                  if (!showChatModal && chatRoom) {
                    setUnreadChatCount(0);
                    await supabase
                      .from('pos_chat_rooms')
                      .update({ unread_count_pos: 0 })
                      .eq('id', chatRoom.id);
                  }
                }} 
                style={{ position: 'relative', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
              >
                <MessageSquare size={customHeaderIconSize} />
                {unreadChatCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    backgroundColor: customPrimary,
                    color: customButtonText,
                    fontSize: '0.55rem',
                    fontWeight: '900',
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                  }}>{unreadChatCount}</span>
                )}
              </div>
              
              <div 
                onClick={() => setActiveMenuId('ajustes')} 
                style={{ cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
              >
                <Settings size={customHeaderIconSize} />
              </div>

              <div style={{ borderLeft: '1px solid #e2e8f0', height: '24px' }} />

              {/* User Profile Badge & Floating Info Card */}
              <div 
                onClick={() => setShowUserProfileCard(!showUserProfileCard)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', cursor: 'pointer', position: 'relative', userSelect: 'none' }}
              >
                <div style={{ 
                  width: '44px', 
                  height: '44px', 
                  borderRadius: '50%', 
                  overflow: 'hidden', 
                  backgroundColor: '#e2e8f0',
                  border: `2px solid ${customPrimary}`,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                }}>
                  <img 
                    src={profile?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop'} 
                    alt="User Profile" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: '950', color: '#0f172a', lineHeight: '1.2' }}>{profile?.full_name || 'Usuario'}</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: '900', color: customPrimary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{profile?.roles?.name || 'Vendedor'}</span>
                </div>

                {/* Floating User Card */}
                {showUserProfileCard && (
                  <div 
                    onClick={e => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      top: '55px',
                      right: 0,
                      width: '260px',
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '16px',
                      padding: '1.25rem',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                      zIndex: 1100,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      cursor: 'default'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <img 
                        src={profile?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop'} 
                        alt="" 
                        style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <strong style={{ fontSize: '0.85rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.full_name || 'Vendedor'}</strong>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email || 'vendedor@tienda.com'}</span>
                      </div>
                    </div>
                    
                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.72rem', color: '#475569' }}>
                      <div>💼 <strong>Rol:</strong> {profile?.roles?.name || 'Vendedor'}</div>
                      <div>🏭 <strong>Sucursal:</strong> {selectedStore?.nombre || 'Ninguna'}</div>
                    </div>

                    <button 
                      onClick={async () => {
                        await signOut();
                        router.push('/login');
                      }}
                      style={{
                        width: '100%',
                        padding: '0.55rem',
                        background: '#fef2f2',
                        color: '#ef4444',
                        border: '1px solid #fee2e2',
                        borderRadius: '10px',
                        fontSize: '0.75rem',
                        fontWeight: '800',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#fef2f2'; }}
                    >
                      <LogOut size={13} /> Cerrar Sesión
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* POS Sub-Header parameters bar */}
          <div style={{
            display: 'flex',
            padding: '1rem 1.5rem',
            backgroundColor: 'white',
            borderBottom: '1px solid #e2e8f0',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}>
            {/* Selectors grid */}
            <div style={{ display: 'flex', gap: '1.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.625rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.25rem', letterSpacing: '0.05em' }}>SUCURSAL / TIENDA</label>
                <select
                  value={selectedStore?.id || ''}
                  onChange={e => handleOpenStoreChange(e.target.value)}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    color: '#0f172a',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.78rem',
                    fontWeight: '800',
                    outline: 'none',
                    width: '250px'
                  }}
                >
                  {!userAssignedStoreId && <option value="">Seleccionar Sucursal...</option>}
                  {stores.filter(s => !userAssignedStoreId || s.id === userAssignedStoreId).map(s => <option key={s.id} value={s.id}>{userAssignedStoreId ? `🔒 ${s.nombre} (Asignada)` : s.nombre}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.625rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.25rem', letterSpacing: '0.05em' }}>TERMINAL / CAJA</label>
                <select
                  disabled={!selectedStore}
                  value={selectedRegister?.id || ''}
                  onChange={e => handleRegisterChange(e.target.value)}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    color: '#0f172a',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.78rem',
                    fontWeight: '800',
                    outline: 'none',
                    width: '200px'
                  }}
                >
                  {!userAssignedRegisterId && <option value="">Seleccionar Caja...</option>}
                  {registers.filter(r => !userAssignedRegisterId || r.id === userAssignedRegisterId || r.codigo_caja === userAssignedRegisterId).map(r => <option key={r.id} value={r.id}>{userAssignedRegisterId ? `🔒 ${r.codigo_caja} (Asignada)` : r.codigo_caja}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.625rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.25rem', letterSpacing: '0.05em' }}>LISTA DE PRECIOS</label>
                <select
                  value={selectedPriceListId}
                  onChange={e => setSelectedPriceListId(e.target.value)}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    color: '#0f172a',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.78rem',
                    fontWeight: '800',
                    outline: 'none',
                    width: '240px'
                  }}
                >
                  <option value="">Precio Base General</option>
                  {priceLists.map(pl => (
                    <option key={pl.id} value={pl.id}>{pl.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Right actions & totals info */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              {/* TOTAL VENTA highlighted box */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: customHeaderTotalColor,
                color: customButtonText,
                padding: customHeaderTotalPadding,
                borderRadius: '10px',
                minWidth: '250px',
                boxShadow: `0 4px 20px rgba(0,0,0,0.2)`,
                border: '1.5px solid rgba(255,255,255,0.15)',
                transition: 'all 0.2s ease'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.52rem', fontWeight: '855', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.8 }}>TOTAL VENTA</span>
                  <span style={{ fontSize: customHeaderTotalFontSize, fontWeight: customHeaderTotalFontWeight as any, fontFamily: 'monospace' }}>
                    ${totalCartPrice.toLocaleString('es-CO')}
                  </span>
                </div>
                <Lock size={16} style={{ opacity: 0.8 }} />
              </div>

              {/* Close cash shift button */}
              {currentSession && (
                <button
                  onClick={() => setShowCloseSessionModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: customCloseSessionPadding,
                    borderRadius: '8px',
                    background: customCloseSessionBg,
                    border: `1.5px solid ${customCloseSessionBorder}`,
                    color: customCloseSessionText,
                    fontSize: customCloseSessionFontSize,
                    fontWeight: customCloseSessionFontWeight as any,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <XCircle size={14} /> Cerrar Caja
                </button>
              )}
            </div>
          </div>

          {/* Sub-workspace layout splitting Grid/Products and Right cart checkout panel */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            
            {/* Product Catalog view column - switches by activeMenuId */}
            {activeMenuId === 'productos' ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1.5rem', overflowY: 'auto', gap: '1.25rem', backgroundColor: '#f8fafc' }} className="pos-scrollbar">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>Inventario y Recepción</h2>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{selectedStore?.nombre || 'Sucursal'}</span>
                </div>
                
                {/* Tabs */}
                <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #cbd5e1' }}>
                  <button 
                    onClick={() => setActiveProdTab('inventario')}
                    style={{ padding: '0.5rem 1rem', background: 'none', border: 'none', borderBottom: activeProdTab === 'inventario' ? '3px solid #80082E' : '3px solid transparent', color: activeProdTab === 'inventario' ? '#80082E' : '#64748b', fontWeight: activeProdTab === 'inventario' ? '900' : '600', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    Inventario Actual
                  </button>
                  <button 
                    onClick={() => setActiveProdTab('recepcion')}
                    style={{ padding: '0.5rem 1rem', background: 'none', border: 'none', borderBottom: activeProdTab === 'recepcion' ? '3px solid #80082E' : '3px solid transparent', color: activeProdTab === 'recepcion' ? '#80082E' : '#64748b', fontWeight: activeProdTab === 'recepcion' ? '900' : '600', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                  >
                    Recepción / Conciliación
                    {pendingTransfers.length > 0 && (
                      <span style={{ backgroundColor: '#ef4444', color: 'white', borderRadius: '50%', padding: '0.1rem 0.4rem', fontSize: '0.6rem' }}>{pendingTransfers.length}</span>
                    )}
                  </button>
                </div>

                {activeProdTab === 'inventario' ? (
                  <>
                    {/* View mode toggle pills */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: '#e2e8f0', padding: '0.25rem', borderRadius: '10px' }}>
                        <button
                          onClick={() => { setInventoryViewMode('etiquetas'); setGarmentsPage(0); }}
                          style={{
                            padding: '0.45rem 0.9rem',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: inventoryViewMode === 'etiquetas' ? '#ffffff' : 'transparent',
                            color: inventoryViewMode === 'etiquetas' ? customPrimary : '#64748b',
                            fontWeight: inventoryViewMode === 'etiquetas' ? '900' : '700',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            boxShadow: inventoryViewMode === 'etiquetas' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          🏷️ Por Etiquetas ({individualGarments.length})
                        </button>
                        <button
                          onClick={() => { setInventoryViewMode('resumen'); setInventoryPage(0); }}
                          style={{
                            padding: '0.45rem 0.9rem',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: inventoryViewMode === 'resumen' ? '#ffffff' : 'transparent',
                            color: inventoryViewMode === 'resumen' ? customPrimary : '#64748b',
                            fontWeight: inventoryViewMode === 'resumen' ? '900' : '700',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            boxShadow: inventoryViewMode === 'resumen' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          📦 Resumen por Referencia ({inventoryList.length} SKUs)
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ background: '#f8fafc', padding: '0.4rem 1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                          <span style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: '850', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {inventoryViewMode === 'etiquetas' ? 'Prendas con Etiqueta' : 'Total Disponible'}
                          </span>
                          <span style={{ fontSize: '1.2rem', color: '#10b981', fontWeight: '950' }}>
                            {inventoryViewMode === 'etiquetas' ? individualGarments.length : inventoryList.reduce((acc, curr) => acc + (Number(curr.cantidad_disponible) || 0), 0)}
                          </span>
                        </div>
                        <div style={{ background: '#fff7ed', padding: '0.4rem 1.25rem', borderRadius: '10px', border: '1px solid #ffedd5', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                          <span style={{ fontSize: '0.62rem', color: '#ea580c', fontWeight: '850', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {inventoryViewMode === 'etiquetas' ? 'Prendas Aprobadas' : 'Reservado'}
                          </span>
                          <span style={{ fontSize: '1.2rem', color: '#ea580c', fontWeight: '950' }}>
                            {inventoryViewMode === 'etiquetas' ? individualGarments.filter(g => g.status === 'Aprobada').length : inventoryList.reduce((acc, curr) => acc + (Number(curr.cantidad_reservada) || 0), 0)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Search Bar */}
                    <div style={{ marginBottom: '1rem' }}>
                      <input
                        type="text"
                        placeholder={inventoryViewMode === 'etiquetas' ? "Buscar por código de etiqueta (ej: 0081963300), referencia, color o talla..." : "Buscar por referencia, nombre, color o talla..."}
                        value={invSearch}
                        onChange={e => { setInvSearch(e.target.value); setGarmentsPage(0); setInventoryPage(0); }}
                        style={{ padding: '0.65rem 1rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', outline: 'none', width: '100%', maxWidth: '420px', backgroundColor: '#ffffff' }}
                      />
                    </div>

                    {/* VISTA POR ETIQUETAS INDIVIDUALES */}
                    {inventoryViewMode === 'etiquetas' && (() => {
                      const sQuery = invSearch.trim().toLowerCase();
                      const filteredGarments = individualGarments.filter(g => {
                        if (!sQuery) return true;
                        const bCode = (g.barcode || '').toLowerCase();
                        const rName = (g.reference_name || '').toLowerCase();
                        const cName = (g.color_name || '').toLowerCase();
                        const sCode = (g.size_code || '').toLowerCase();
                        const status = (g.status || '').toLowerCase();
                        return bCode.includes(sQuery) || rName.includes(sQuery) || cName.includes(sQuery) || sCode.includes(sQuery) || status.includes(sQuery);
                      });

                      const gPageSize = 15;
                      const gTotalPages = Math.ceil(filteredGarments.length / gPageSize);
                      const paginatedGarments = filteredGarments.slice(garmentsPage * gPageSize, (garmentsPage + 1) * gPageSize);

                      return (
                        <>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid #80082E', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', fontSize: '0.65rem' }}>
                                <th style={{ padding: '0.75rem', textAlign: 'left' }}># Código Etiqueta</th>
                                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Prenda / Referencia</th>
                                <th style={{ padding: '0.75rem', textAlign: 'center' }}>Color</th>
                                <th style={{ padding: '0.75rem', textAlign: 'center' }}>Talla</th>
                                <th style={{ padding: '0.75rem', textAlign: 'center' }}>Estado</th>
                                <th style={{ padding: '0.75rem', textAlign: 'center' }}>Fecha Ingreso</th>
                                <th style={{ padding: '0.75rem', textAlign: 'center' }}>Acción</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedGarments.map((garment, idx) => (
                                <tr key={garment.id || idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fcfcfd' }}>
                                  <td style={{ padding: '0.75rem', fontWeight: '900', color: '#0f172a' }}>
                                    <span style={{
                                      backgroundColor: '#f1f5f9',
                                      border: '1px solid #e2e8f0',
                                      padding: '0.2rem 0.55rem',
                                      borderRadius: '6px',
                                      fontFamily: 'monospace',
                                      fontSize: '0.85rem',
                                      color: '#0f172a',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.3rem'
                                    }}>
                                      🏷️ {garment.barcode}
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.75rem', fontWeight: '800', color: '#0f172a' }}>
                                    {garment.reference_name || 'Sin referencia'}
                                  </td>
                                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                    <span style={{ backgroundColor: '#f1f5f9', color: '#334155', padding: '0.15rem 0.5rem', borderRadius: '6px', fontWeight: '750', fontSize: '0.75rem' }}>
                                      {garment.color_name || '—'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                    <span style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', color: '#0f172a', padding: '0.15rem 0.45rem', borderRadius: '6px', fontWeight: '800', fontSize: '0.75rem' }}>
                                      {garment.size_code || '—'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                    <span style={{
                                      backgroundColor: garment.status === 'Aprobada' ? '#ecfdf5' : '#fff7ed',
                                      color: garment.status === 'Aprobada' ? '#059669' : '#ea580c',
                                      border: `1px solid ${garment.status === 'Aprobada' ? '#a7f3d0' : '#fed7aa'}`,
                                      padding: '0.15rem 0.45rem',
                                      borderRadius: '6px',
                                      fontWeight: '850',
                                      fontSize: '0.7rem'
                                    }}>
                                      {garment.status || 'Disponible'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b', fontSize: '0.72rem' }}>
                                    {garment.created_at ? new Date(garment.created_at).toLocaleDateString('es-CO') : '—'}
                                  </td>
                                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                    <button
                                      onClick={() => handleQuickAddGarmentToCart(garment)}
                                      style={{
                                        backgroundColor: '#10b981',
                                        color: 'white',
                                        border: 'none',
                                        padding: '0.35rem 0.75rem',
                                        borderRadius: '6px',
                                        fontSize: '0.72rem',
                                        fontWeight: '850',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                        boxShadow: '0 2px 6px rgba(16,185,129,0.25)'
                                      }}
                                    >
                                      <ShoppingCart size={13} /> Vender
                                    </button>
                                  </td>
                                </tr>
                              ))}
                              {filteredGarments.length === 0 && (
                                <tr>
                                  <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                                    <Package size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                                    <p style={{ margin: 0, fontWeight: '700' }}>No se encontraron prendas con etiquetas registradas en esta bodega/tienda.</p>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>

                          {gTotalPages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700' }}>
                                Mostrando {garmentsPage * gPageSize + 1} a {Math.min((garmentsPage + 1) * gPageSize, filteredGarments.length)} de {filteredGarments.length} prendas con etiqueta
                              </span>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button onClick={() => setGarmentsPage(p => Math.max(0, p - 1))} disabled={garmentsPage === 0} style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: garmentsPage === 0 ? '#f1f5f9' : 'white', cursor: garmentsPage === 0 ? 'not-allowed' : 'pointer', fontSize: '0.75rem', fontWeight: '700' }}>Anterior</button>
                                <button onClick={() => setGarmentsPage(p => p + 1)} disabled={(garmentsPage + 1) * gPageSize >= filteredGarments.length} style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: (garmentsPage + 1) * gPageSize >= filteredGarments.length ? '#f1f5f9' : 'white', cursor: (garmentsPage + 1) * gPageSize >= filteredGarments.length ? 'not-allowed' : 'pointer', fontSize: '0.75rem', fontWeight: '700' }}>Siguiente</button>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {/* VISTA RESUMIDA POR REFERENCIA */}
                    {inventoryViewMode === 'resumen' && (() => {
                      const sQuery = invSearch.trim().toLowerCase();
                      const filteredInv = inventoryList.filter(inv => {
                        if (!sQuery) return true;
                        const pName = (inv.products?.nombre_producto || '').toLowerCase();
                        const pRef = (inv.products?.codigo_referencia || '').toLowerCase();
                        const cName = (inv.colors?.nombre_color || '').toLowerCase();
                        const cCode = (inv.colors?.codigo_color || '').toLowerCase();
                        const sCode = (inv.sizes?.codigo_talla || '').toLowerCase();
                        const sName = (inv.sizes?.nombre_talla || '').toLowerCase();
                        return pName.includes(sQuery) || pRef.includes(sQuery) || cName.includes(sQuery) || cCode.includes(sQuery) || sCode.includes(sQuery) || sName.includes(sQuery);
                      });

                      return (
                        <>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid #80082E', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', fontSize: '0.65rem' }}>
                                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Producto</th>
                                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Referencia</th>
                                <th style={{ padding: '0.75rem', textAlign: 'center' }}>Color</th>
                                <th style={{ padding: '0.75rem', textAlign: 'center' }}>Talla</th>
                                <th style={{ padding: '0.75rem', textAlign: 'center' }}>Disponible</th>
                                <th style={{ padding: '0.75rem', textAlign: 'center' }}>Reservado</th>
                                <th style={{ padding: '0.75rem', textAlign: 'center' }}>Etiquetas</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredInv.slice(inventoryPage * 10, (inventoryPage + 1) * 10).map((inv, idx) => {
                                const matchingGarmentCount = individualGarments.filter(g => 
                                  (g.reference_name || '').toLowerCase() === (inv.products?.nombre_producto || '').toLowerCase()
                                ).length;

                                return (
                                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '0.75rem', fontWeight: '800', color: '#0f172a' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {inv.products?.imagen_url && (
                                          <img src={inv.products.imagen_url} alt="" style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover' }} />
                                        )}
                                        {inv.products?.nombre_producto || 'Sin nombre'}
                                      </div>
                                    </td>
                                    <td style={{ padding: '0.75rem', color: '#64748b', fontWeight: '850' }}>{inv.products?.codigo_referencia || '-'}</td>
                                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>{inv.colors?.nombre_color || '-'}</td>
                                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>{inv.sizes?.codigo_talla || '-'}</td>
                                    <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '900', color: Number(inv.cantidad_disponible) > 5 ? '#10b981' : '#ef4444' }}>
                                      {inv.cantidad_disponible}
                                    </td>
                                    <td style={{ padding: '0.75rem', textAlign: 'center', color: '#64748b' }}>{inv.cantidad_reservada || 0}</td>
                                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                      <button
                                        onClick={() => {
                                          setInvSearch(inv.products?.nombre_producto || '');
                                          setInventoryViewMode('etiquetas');
                                        }}
                                        style={{
                                          padding: '0.25rem 0.6rem',
                                          borderRadius: '6px',
                                          border: '1px solid #cbd5e1',
                                          backgroundColor: '#f8fafc',
                                          fontSize: '0.72rem',
                                          fontWeight: '800',
                                          color: customPrimary,
                                          cursor: 'pointer'
                                        }}
                                      >
                                        🏷️ {matchingGarmentCount > 0 ? `${matchingGarmentCount} tags` : 'Ver tags'}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                              {filteredInv.length === 0 && (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No se encontraron productos en el inventario de esta tienda.</td></tr>
                              )}
                            </tbody>
                          </table>

                          {filteredInv.length > 10 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700' }}>
                                Mostrando {inventoryPage * 10 + 1} a {Math.min((inventoryPage + 1) * 10, filteredInv.length)} de {filteredInv.length} productos
                              </span>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button onClick={() => setInventoryPage(p => Math.max(0, p - 1))} disabled={inventoryPage === 0} style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: inventoryPage === 0 ? '#f1f5f9' : 'white', cursor: inventoryPage === 0 ? 'not-allowed' : 'pointer', fontSize: '0.75rem', fontWeight: '700' }}>Anterior</button>
                                <button onClick={() => setInventoryPage(p => p + 1)} disabled={(inventoryPage + 1) * 10 >= filteredInv.length} style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: (inventoryPage + 1) * 10 >= filteredInv.length ? '#f1f5f9' : 'white', cursor: (inventoryPage + 1) * 10 >= filteredInv.length ? 'not-allowed' : 'pointer', fontSize: '0.75rem', fontWeight: '700' }}>Siguiente</button>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '10px', padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1.4rem' }}>🚚📦</span>
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: '900', color: '#80082E' }}>Módulo Completo de Traslados entre Tiendas y Bodegas</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Despacha y recibe mercancía con pistola de código de barras, comprobantes y conciliación de faltantes en tiempo real.</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => setActiveMenuId('traslados')} 
                        style={{ backgroundColor: '#80082E', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 1rem', fontSize: '0.78rem', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        Abrir Módulo de Traslados →
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                    {/* Lista de traslados */}
                    <div style={{ width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: '#475569', margin: 0, textTransform: 'uppercase' }}>Traslados Pendientes</h3>
                      {pendingTransfers.length === 0 ? (
                        <div style={{ padding: '1rem', backgroundColor: 'white', borderRadius: '8px', border: '1px dashed #cbd5e1', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                          No hay mercancía en tránsito hacia esta tienda.
                        </div>
                      ) : (
                        pendingTransfers.map(tr => (
                          <div 
                            key={tr.id}
                            onClick={() => { setSelectedTransfer(tr); setScannedReconBarcodes([]); setReconBarcodeInput(''); }}
                            style={{ padding: '1rem', backgroundColor: selectedTransfer?.id === tr.id ? '#fef2f2' : 'white', border: selectedTransfer?.id === tr.id ? '2px solid #80082E' : '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: '900', color: '#0f172a' }}>TR-{String(tr.consecutive).padStart(4, '0')}</span>
                              <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', backgroundColor: '#fef08a', color: '#854d0e', borderRadius: '4px', fontWeight: '800' }}>{tr.estado}</span>
                            </div>
                            <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Enviado por: {tr.usuario}</span>
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'block', marginTop: '0.4rem' }}>{new Date(tr.created_at).toLocaleString('es-CO')}</span>
                          </div>
                        ))
                      )}
                    </div>
                    
                    {/* Área de Conciliación */}
                    {selectedTransfer ? (
                      <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                          <div>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: '900', color: '#0f172a', margin: '0 0 0.2rem' }}>Conciliar TR-{String(selectedTransfer.consecutive).padStart(4, '0')}</h3>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{selectedTransfer.observaciones || 'Sin observaciones'}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={handleRejectTransfer} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #ef4444', backgroundColor: 'white', color: '#ef4444', fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer' }}>Reportar Novedad</button>
                            <button onClick={handleAcceptTransfer} style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', backgroundColor: '#10b981', color: 'white', fontWeight: '800', fontSize: '0.75rem', cursor: 'pointer' }}>Aceptar Traslado</button>
                          </div>
                        </div>

                        {/* Scanner */}
                        <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '1.5rem' }}>
                          <form onSubmit={handleScanReconciliation} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Escanear Prenda (Pistola)</label>
                              <input 
                                type="text"
                                autoFocus
                                value={reconBarcodeInput}
                                onChange={(e) => setReconBarcodeInput(e.target.value)}
                                placeholder="Haz clic aquí y dispara la lectora..."
                                style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '2px solid #80082E', fontSize: '1rem', outline: 'none' }}
                              />
                            </div>
                            <button type="submit" disabled={!reconBarcodeInput.trim()} style={{ marginTop: '1.5rem', padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', backgroundColor: '#80082E', color: 'white', fontWeight: '800', cursor: 'pointer' }}>Validar</button>
                          </form>
                        </div>
                        
                        {/* Status Bar */}
                        {(() => {
                          const totalExpected = selectedTransfer.items?.reduce((sum: number, it: any) => sum + (it.cantidad || 0), 0) || 0;
                          const totalScanned = scannedReconBarcodes.length;
                          const progress = totalExpected > 0 ? (totalScanned / totalExpected) * 100 : 0;
                          
                          return (
                            <div style={{ marginBottom: '1.5rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#334155' }}>Progreso de Conciliación</span>
                                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: progress === 100 ? '#10b981' : '#3b82f6' }}>{totalScanned} de {totalExpected} prendas ({Math.round(progress)}%)</span>
                              </div>
                              <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', backgroundColor: progress === 100 ? '#10b981' : '#3b82f6', width: `${progress}%`, transition: 'width 0.3s' }} />
                              </div>
                            </div>
                          );
                        })()}

                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid #e2e8f0', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', fontSize: '0.65rem' }}>
                              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Ítem / Producto</th>
                              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Esperado</th>
                              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Escaneados</th>
                              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedTransfer.items?.map((it: any, idx: number) => {
                              const expected = it.cantidad || 0;
                              const barcodes = it.barcodes || [];
                              const scanned = scannedReconBarcodes.filter(b => barcodes.includes(b)).length;
                              const isComplete = scanned >= expected;
                              
                              return (
                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: isComplete ? '#f0fdf4' : 'transparent' }}>
                                  <td style={{ padding: '0.75rem', fontWeight: '700', color: '#0f172a' }}>
                                    {it.product?.nombre_producto || 'Desconocido'}
                                    <span style={{ display: 'block', fontSize: '0.65rem', color: '#64748b', fontWeight: 'normal' }}>Ref: {it.product?.codigo_referencia}</span>
                                    {barcodes && barcodes.length > 0 && (
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.4rem' }}>
                                        {barcodes.map((bc: string) => {
                                          const isScanned = scannedReconBarcodes.includes(bc);
                                          return (
                                            <span key={bc} style={{ 
                                              fontSize: '0.6rem', padding: '0.15rem 0.35rem', borderRadius: '4px', fontFamily: 'monospace',
                                              backgroundColor: isScanned ? '#dcfce7' : '#f1f5f9', 
                                              color: isScanned ? '#166534' : '#64748b',
                                              border: isScanned ? '1px solid #bbf7d0' : '1px dashed #cbd5e1'
                                            }}>
                                              {bc}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '800' }}>{expected}</td>
                                  <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '800', color: isComplete ? '#10b981' : '#3b82f6' }}>{scanned}</td>
                                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                    {isComplete ? (
                                      <span style={{ padding: '0.2rem 0.5rem', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '800' }}>COMPLETO</span>
                                    ) : (
                                      <span style={{ padding: '0.2rem 0.5rem', backgroundColor: '#f1f5f9', color: '#64748b', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '800' }}>FALTAN {expected - scanned}</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', borderRadius: '12px', border: '1px dashed #cbd5e1', padding: '3rem', color: '#64748b' }}>
                        <span style={{ fontSize: '2rem', marginBottom: '1rem' }}>📦</span>
                        <h3 style={{ margin: 0, fontWeight: '800', color: '#334155' }}>Selecciona un traslado</h3>
                        <p style={{ fontSize: '0.85rem' }}>Haz clic en un traslado pendiente a la izquierda para empezar a conciliar la mercancía.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : activeMenuId === 'traslados' ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', backgroundColor: '#f8fafc' }}>
                <POSTransferManager 
                  currentStore={selectedStore} 
                  user={user} 
                  profile={profile} 
                  onRefreshInventory={() => {
                    fetchInlineInventory();
                    fetchPendingTransfers();
                  }}
                  primaryColor={customPrimary}
                  secondaryColor={customSecondary}
                />
              </div>
            ) : activeMenuId === 'clientes' ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1.5rem', overflowY: 'auto', gap: '1.25rem', backgroundColor: '#f8fafc' }} className="pos-scrollbar">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>CRM de Clientes</h2>
                  <button onClick={() => setShowNewCustomerForm(v => !v)} style={{ padding: '0.5rem 1rem', background: 'linear-gradient(90deg,#80082E,#D81B60)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '800', cursor: 'pointer' }}>
                    + Nuevo Cliente
                  </button>
                </div>
                {showNewCustomerForm && (
                  <div style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '900', color: '#0f172a' }}>
                      {editingCustomerId ? 'Editar Cliente Contable' : 'Registrar Nuevo Cliente Contable'}
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <input placeholder="Nombre / Razón Social" value={newCustName} onChange={e => setNewCustName(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }} />
                      <input placeholder="Documento / NIT" value={newCustDoc} disabled={!!editingCustomerId} onChange={e => setNewCustDoc(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', backgroundColor: editingCustomerId ? '#f1f5f9' : 'white' }} />
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span style={{ fontSize: '0.625rem', color: '#64748b', fontWeight: '700' }}>Tipo de Identificación</span>
                        <select value={newCustTypeDoc} onChange={e => setNewCustTypeDoc(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', backgroundColor: 'white' }}>
                          <option value="Cedula">Cédula de Ciudadanía</option>
                          <option value="Nit">NIT (Empresa)</option>
                          <option value="CedulaExtranjeria">Cédula de Extranjería</option>
                          <option value="Pasaporte">Pasaporte</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span style={{ fontSize: '0.625rem', color: '#64748b', fontWeight: '700' }}>Tipo de Persona</span>
                        <select value={newCustTypePerson} onChange={e => setNewCustTypePerson(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', backgroundColor: 'white' }}>
                          <option value="Natural">Persona Natural</option>
                          <option value="Juridica">Persona Jurídica</option>
                        </select>
                      </div>

                      <input placeholder="Email corporativo" value={newCustEmail} onChange={e => setNewCustEmail(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }} />
                      <input placeholder="Teléfono celular" value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }} />
                      <input placeholder="Dirección física" value={newCustAddress} onChange={e => setNewCustAddress(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }} />
                      <input placeholder="Ciudad / Municipio" value={newCustCity} onChange={e => setNewCustCity(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }} />
                      
                      <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span style={{ fontSize: '0.625rem', color: '#64748b', fontWeight: '700' }}>Lista de Precios Asociada</span>
                        <select value={newCustPriceListId} onChange={e => setNewCustPriceListId(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', backgroundColor: 'white' }}>
                          <option value="">Ninguna (Precio Base)</option>
                          {priceLists.map(pl => (
                            <option key={pl.id} value={pl.id}>{pl.nombre}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem', border: '1px dashed #cbd5e1', borderRadius: '8px' }}>
                        {newCustAvatarUrl ? (
                          <img src={newCustAvatarUrl} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} alt="Avatar" />
                        ) : (
                          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', color: '#64748b' }}>👤</div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#475569' }}>Foto de Perfil / Avatar</span>
                          <input type="file" accept="image/*" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const reader = new FileReader();
                              reader.onload = async () => {
                                const base64 = reader.result as string;
                                const res = await fetch('/api/products/upload-image', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ base64Image: base64, filename: `customer_${Date.now()}.png` })
                                });
                                const data = await res.json();
                                if (data.url) {
                                  setNewCustAvatarUrl(data.url);
                                }
                              };
                              reader.readAsDataURL(file);
                            } catch (err: any) {
                              alert('Error al subir imagen: ' + err.message);
                            }
                          }} style={{ fontSize: '0.65rem' }} />
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button onClick={async () => {
                        if (!newCustName || !selectedStore) return;
                        try {
                          const payload: any = { 
                            name: newCustName, 
                            identification: newCustDoc, 
                            email: newCustEmail, 
                            phone: newCustPhone,
                            store_id: selectedStore.id,
                            tipo_documento: newCustTypeDoc,
                            tipo_persona: newCustTypePerson,
                            direccion: newCustAddress,
                            ciudad: newCustCity,
                            avatar_url: newCustAvatarUrl,
                            price_list_id: newCustPriceListId || null
                          };
                          if (editingCustomerId) {
                            payload.id = editingCustomerId;
                          }
                          const { error } = await supabase.from('siigo_customers').upsert(payload, { onConflict: 'identification' });
                          if (error) throw error;
                          
                          setNewCustName(''); setNewCustDoc(''); setNewCustEmail(''); setNewCustPhone('');
                          setNewCustAddress(''); setNewCustCity(''); setNewCustAvatarUrl(''); setNewCustPriceListId('');
                          setNewCustTypeDoc('Cedula'); setNewCustTypePerson('Natural');
                          setEditingCustomerId(null);
                          setShowNewCustomerForm(false); 
                          fetchCrmCustomers();
                        } catch (err: any) {
                          alert('Error al guardar cliente: ' + err.message);
                        }
                      }} style={{ padding: '0.5rem 1rem', background: '#80082E', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '800', cursor: 'pointer' }}>
                        {editingCustomerId ? 'Actualizar Cliente' : 'Guardar Cliente'}
                      </button>
                      <button onClick={() => { 
                        setNewCustName(''); setNewCustDoc(''); setNewCustEmail(''); setNewCustPhone('');
                        setNewCustAddress(''); setNewCustCity(''); setNewCustAvatarUrl('');
                        setNewCustTypeDoc('Cedula'); setNewCustTypePerson('Natural');
                        setEditingCustomerId(null);
                        setShowNewCustomerForm(false); 
                      }} style={{ padding: '0.5rem 1rem', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '800', cursor: 'pointer' }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
                <input type="text" placeholder="Buscar cliente del punto por nombre o documento..." value={crmSearch} onChange={e => setCrmSearch(e.target.value)}
                  style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', outline: 'none' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {crmCustomers.filter(c => !crmSearch || (c.name || '').toLowerCase().includes(crmSearch.toLowerCase()) || (c.identification || '').includes(crmSearch)).map((c, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1rem', background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {c.avatar_url ? (
                          <img src={c.avatar_url} style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="Avatar" />
                        ) : (
                          <div style={{
                            width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                            background: 'linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)',
                            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.78rem', fontWeight: '900'
                          }}>
                            {(c.name || 'C').substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: '800', fontSize: '0.85rem', color: '#0f172a' }}>{c.name}</span>
                            <span style={{ fontSize: '0.58rem', fontWeight: '700', padding: '0.15rem 0.35rem', borderRadius: '4px', backgroundColor: '#e2e8f0', color: '#475569' }}>
                              {c.tipo_persona === 'Juridica' || c.person_type === 'Company' ? 'Empresa / Jurídico' : 'Persona Natural'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.2rem' }}>
                            <strong>{c.tipo_documento || 'Doc'}:</strong> {c.identification} · <strong>Cel:</strong> {c.phone || 'N/A'} · <strong>Email:</strong> {c.email || 'N/A'}
                          </div>
                          {(c.direccion || c.address_line) && (
                            <div style={{ fontSize: '0.625rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                              📍 {c.direccion || c.address_line} {c.ciudad || c.city_name ? `, ${c.ciudad || c.city_name}` : ''}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => {
                          setEditingCustomerId(c.id);
                          setNewCustName(c.name || '');
                          setNewCustDoc(c.identification || '');
                          setNewCustEmail(c.email || '');
                          setNewCustPhone(c.phone || '');
                          setNewCustTypeDoc(c.tipo_documento || 'Cedula');
                          setNewCustTypePerson(c.tipo_persona || 'Natural');
                          setNewCustAddress(c.direccion || c.address_line || '');
                          setNewCustCity(c.ciudad || c.city_name || '');
                          setNewCustAvatarUrl(c.avatar_url || '');
                          setNewCustPriceListId(c.price_list_id || '');
                          setShowNewCustomerForm(true);
                        }} style={{ padding: '0.35rem 0.6rem', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer' }}>
                          ✏️ Editar
                        </button>
                        <button onClick={() => { 
                          setSelectedCustomer({ name: c.name, document: c.identification }); 
                          if (c.price_list_id) setSelectedPriceListId(c.price_list_id);
                          else setSelectedPriceListId('');
                          setActiveMenuId('pos'); 
                        }} style={{ padding: '0.35rem 0.75rem', background: 'linear-gradient(90deg,#80082E,#D81B60)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer' }}>
                          Seleccionar
                        </button>
                      </div>
                    </div>
                  ))}
                  {crmCustomers.length === 0 && <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem', fontSize: '0.8rem' }}>No hay clientes registrados.</div>}
                </div>
              </div>
            ) : activeMenuId === 'ventas' ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1.5rem', overflowY: 'auto', gap: '1.25rem', backgroundColor: '#f8fafc' }} className="pos-scrollbar">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>Historial de Ventas POS</h2>
                  <select
                    value={reportDateRange}
                    onChange={(e) => { setReportDateRange(e.target.value); setSalesPage(0); }}
                    style={{ padding: '0.45rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.75rem', backgroundColor: 'white', color: '#334155', fontWeight: '700' }}
                  >
                    <option value="today">Ventas del Día</option>
                    <option value="all">Histórico Completo</option>
                  </select>
                </div>
                {(() => {
                  const filteredSales = salesLogs.filter((s: any) => {
                    if (reportDateRange === 'today') {
                      const localStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
                      return s.created_at && s.created_at.includes(localStr);
                    }
                    return true;
                  });

                  return (
                    <>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #80082E', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', fontSize: '0.65rem' }}>
                            <th style={{ padding: '0.75rem', textAlign: 'left' }}>#</th>
                            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Fecha</th>
                            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Cajero</th>
                            <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center' }}>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSales.slice(salesPage * 10, (salesPage + 1) * 10).map((s, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '0.75rem', fontWeight: '800', color: '#80082E' }}>
                                {(selectedStore?.nombre || 'POS').substring(0, 3).toUpperCase()}-{String(s.consecutive || 0).padStart(4, '0')}
                              </td>
                              <td style={{ padding: '0.75rem', color: '#64748b' }}>{s.created_at ? new Date(s.created_at).toLocaleString('es-CO') : '-'}</td>
                              <td style={{ padding: '0.75rem' }}>{s.vendedor || s.usuario_apertura || '-'}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '900', color: '#0f172a' }}>${Number(s.total).toLocaleString('es-CO')}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: '900', fontSize: '0.625rem', textTransform: 'uppercase' }}>
                                  {s.estado || 'Completada'}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {filteredSales.length === 0 && (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No hay ventas registradas.</td></tr>
                          )}
                        </tbody>
                      </table>

                      {filteredSales.length > 10 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700' }}>
                            Mostrando {salesPage * 10 + 1} a {Math.min((salesPage + 1) * 10, filteredSales.length)} de {filteredSales.length} ventas
                          </span>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => setSalesPage(p => Math.max(0, p - 1))} disabled={salesPage === 0} style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: salesPage === 0 ? '#f1f5f9' : 'white', cursor: salesPage === 0 ? 'not-allowed' : 'pointer', fontSize: '0.75rem', fontWeight: '700' }}>Anterior</button>
                            <button onClick={() => setSalesPage(p => p + 1)} disabled={(salesPage + 1) * 10 >= filteredSales.length} style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: (salesPage + 1) * 10 >= filteredSales.length ? '#f1f5f9' : 'white', cursor: (salesPage + 1) * 10 >= filteredSales.length ? 'not-allowed' : 'pointer', fontSize: '0.75rem', fontWeight: '700' }}>Siguiente</button>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : activeMenuId === 'reportes' ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1.5rem', overflowY: 'auto', gap: '1.5rem', backgroundColor: '#f8fafc' }} className="pos-scrollbar">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>Resumen Gerencial de Gestión</h2>
                  <select
                    value={reportDateRange}
                    onChange={(e) => { setReportDateRange(e.target.value); }}
                    style={{ padding: '0.45rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.75rem', backgroundColor: 'white', color: '#334155', fontWeight: '700' }}
                  >
                    <option value="today">Ventas del Día</option>
                    <option value="all">Histórico Completo</option>
                  </select>
                </div>
                {/* Dashboard KPI cards styled as requested */}
                {(() => {
                  const filteredSales = salesLogs.filter((s: any) => {
                    if (reportDateRange === 'today') {
                      const localStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
                      return s.created_at && s.created_at.includes(localStr);
                    }
                    return true;
                  });

                  const totalSales = filteredSales.reduce((s, v) => s + (Number(v.total) || 0), 0);
                  const totalTx = filteredSales.length;
                  const avgTicket = totalTx > 0 ? Math.round(totalSales / totalTx) : 0;
                  const totalDiff = managerShifts.reduce((s, sh) => s + (Number(sh.diferencia) || 0), 0);
                  const totalItemsSold = filteredSales.reduce((s, v) => {
                    return s + (v.items?.reduce((is: number, i: any) => is + Number(i.cantidad || 0), 0) || 0);
                  }, 0);

                  const payEfectivo = filteredSales.reduce((s, v) => {
                    const pays = v.pos_payments?.filter((p: any) => p.metodo_pago === 'Efectivo') || [];
                    return s + pays.reduce((sum: number, p: any) => sum + Number(p.monto || 0), 0);
                  }, 0);
                  const payTarjeta = filteredSales.reduce((s, v) => {
                    const pays = v.pos_payments?.filter((p: any) => p.metodo_pago === 'Tarjeta' || p.metodo_pago === 'Datafono') || [];
                    return s + pays.reduce((sum: number, p: any) => sum + Number(p.monto || 0), 0);
                  }, 0);
                  const payTransferencia = filteredSales.reduce((s, v) => {
                    const pays = v.pos_payments?.filter((p: any) => p.metodo_pago?.toLowerCase().includes('transferencia')) || [];
                    return s + pays.reduce((sum: number, p: any) => sum + Number(p.monto || 0), 0);
                  }, 0);
                  const payMixto = filteredSales.reduce((s, v) => {
                    return s + (v.pos_payments?.length > 1 ? Number(v.total) : 0);
                  }, 0);

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {/* Top KPI Cards Row */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
                        
                        {/* Ventas Totales */}
                        <div className="kpi-card" style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
                          padding: '1.25rem', borderRadius: '16px', border: '1px solid #dbeafe',
                          background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', 
                          boxShadow: '0 4px 12px rgba(59,130,246,0.06)',
                          transition: 'all 0.25s ease', cursor: 'default'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{
                              width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'white',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              boxShadow: '0 2px 6px rgba(59,130,246,0.1)', color: '#1d4ed8', fontWeight: '900', fontSize: '1.15rem'
                            }}>$</div>
                            <div>
                              <span style={{ fontSize: '0.625rem', fontWeight: '900', color: '#1d4ed8', letterSpacing: '0.05em' }}>VENTAS TOTALES</span>
                              <h3 style={{ fontSize: '1.25rem', fontWeight: '950', color: '#1e3a8a', margin: '0.15rem 0 0 0' }}>${totalSales.toLocaleString('es-CO')}</h3>
                            </div>
                          </div>
                          {/* Sparkline chart SVG */}
                          <svg width="60" height="30" style={{ overflow: 'visible', opacity: 0.85 }}>
                            <path d="M0,25 Q15,10 30,18 T60,5" fill="none" stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round" />
                            <path d="M0,25 Q15,10 30,18 T60,5 L60,30 L0,30 Z" fill="url(#blue-grad)" opacity="0.15" />
                            <defs>
                              <linearGradient id="blue-grad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#1d4ed8" />
                                <stop offset="100%" stopColor="#eff6ff" />
                              </linearGradient>
                            </defs>
                          </svg>
                        </div>

                        {/* Transacciones */}
                        <div className="kpi-card" style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
                          padding: '1.25rem', borderRadius: '16px', border: '1px solid #dcfce7',
                          background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', 
                          boxShadow: '0 4px 12px rgba(16,185,129,0.06)',
                          transition: 'all 0.25s ease', cursor: 'default'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{
                              width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'white',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              boxShadow: '0 2px 6px rgba(16,185,129,0.1)', color: '#15803d', fontWeight: '900', fontSize: '1.15rem'
                            }}>🛍️</div>
                            <div>
                              <span style={{ fontSize: '0.625rem', fontWeight: '900', color: '#15803d', letterSpacing: '0.05em' }}>TRANSACCIONES</span>
                              <h3 style={{ fontSize: '1.25rem', fontWeight: '950', color: '#14532d', margin: '0.15rem 0 0 0' }}>{totalTx}</h3>
                            </div>
                          </div>
                          {/* Sparkline chart SVG */}
                          <svg width="60" height="30" style={{ overflow: 'visible', opacity: 0.85 }}>
                            <rect x="0" y="10" width="8" height="20" rx="2" fill="#15803d" opacity="0.3" />
                            <rect x="15" y="18" width="8" height="12" rx="2" fill="#15803d" opacity="0.5" />
                            <rect x="30" y="5" width="8" height="25" rx="2" fill="#15803d" opacity="0.7" />
                            <rect x="45" y="12" width="8" height="18" rx="2" fill="#15803d" />
                          </svg>
                        </div>

                        {/* Ticket Promedio */}
                        <div className="kpi-card" style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
                          padding: '1.25rem', borderRadius: '16px', border: '1px solid #f3e8ff',
                          background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)', 
                          boxShadow: '0 4px 12px rgba(139,92,246,0.06)',
                          transition: 'all 0.25s ease', cursor: 'default'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{
                              width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'white',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              boxShadow: '0 2px 6px rgba(139,92,246,0.1)', color: '#6d28d9', fontWeight: '900', fontSize: '1.15rem'
                            }}>📈</div>
                            <div>
                              <span style={{ fontSize: '0.625rem', fontWeight: '900', color: '#6d28d9', letterSpacing: '0.05em' }}>TICKET PROMEDIO</span>
                              <h3 style={{ fontSize: '1.25rem', fontWeight: '950', color: '#3b0764', margin: '0.15rem 0 0 0' }}>${avgTicket.toLocaleString('es-CO')}</h3>
                            </div>
                          </div>
                          {/* Sparkline chart SVG */}
                          <svg width="60" height="30" style={{ overflow: 'visible', opacity: 0.85 }}>
                            <path d="M0,15 C15,0 15,30 30,15 C45,0 45,30 60,15" fill="none" stroke="#6d28d9" strokeWidth="2.5" strokeLinecap="round" />
                          </svg>
                        </div>

                        {/* Unidades Vendidas */}
                        <div className="kpi-card" style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
                          padding: '1.25rem', borderRadius: '16px', border: '1px solid #fef3c7',
                          background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', 
                          boxShadow: '0 4px 12px rgba(217,119,6,0.06)',
                          transition: 'all 0.25s ease', cursor: 'default'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{
                              width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'white',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              boxShadow: '0 2px 6px rgba(217,119,6,0.1)', color: '#d97706', fontWeight: '900', fontSize: '1.15rem'
                            }}>👕</div>
                            <div>
                              <span style={{ fontSize: '0.625rem', fontWeight: '900', color: '#d97706', letterSpacing: '0.05em' }}>UNIDADES VENDIDAS</span>
                              <h3 style={{ fontSize: '1.25rem', fontWeight: '950', color: '#78350f', margin: '0.15rem 0 0 0' }}>{totalItemsSold}</h3>
                            </div>
                          </div>
                          <svg width="60" height="30" style={{ overflow: 'visible', opacity: 0.85 }}>
                            <path d="M0,25 Q15,5 30,15 T60,10" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" />
                          </svg>
                        </div>

                        {/* Diferencia Caja */}
                        <div className="kpi-card" style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
                          padding: '1.25rem', borderRadius: '16px', border: '1px solid #fee2e2',
                          background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)', 
                          boxShadow: '0 4px 12px rgba(239,68,68,0.06)',
                          transition: 'all 0.25s ease', cursor: 'default'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{
                              width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'white',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              boxShadow: '0 2px 6px rgba(239,68,68,0.1)', color: '#b91c1c', fontWeight: '900', fontSize: '1.15rem'
                            }}>⚠️</div>
                            <div>
                              <span style={{ fontSize: '0.625rem', fontWeight: '900', color: '#b91c1c', letterSpacing: '0.05em' }}>DIFERENCIA CAJA</span>
                              <h3 style={{ fontSize: '1.25rem', fontWeight: '950', color: totalDiff >= 0 ? '#14532d' : '#7f1d1d', margin: '0.15rem 0 0 0' }}>
                                {totalDiff < 0 ? '-' : ''}${Math.abs(totalDiff).toLocaleString('es-CO')}
                              </h3>
                            </div>
                          </div>
                          {/* Sparkline chart SVG */}
                          <svg width="60" height="30" style={{ overflow: 'visible', opacity: 0.85 }}>
                            <path d="M0,15 L20,22 L40,8 L60,18" fill="none" stroke={totalDiff >= 0 ? '#15803d' : '#b91c1c'} strokeWidth="2.5" strokeLinecap="round" />
                          </svg>
                        </div>

                      </div>

                      {/* Row 2: Columns */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        
                        {/* Ventas por Sucursal */}
                        <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                          <h4 style={{ margin: '0 0 1.25rem 0', fontSize: '0.85rem', fontWeight: '900', color: '#1e293b' }}>Ventas por Sucursal</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: '800', color: '#334155' }}>
                              <span>{selectedStore?.nombre || 'Sucursal Principal'}</span>
                              <span style={{ color: '#64748b' }}>${totalSales.toLocaleString('es-CO')} ({totalTx} vts)</span>
                            </div>
                            <div style={{ width: '100%', height: '8px', borderRadius: '4px', backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                              <div style={{ width: '100%', height: '100%', backgroundColor: '#f97316' }} />
                            </div>
                          </div>
                        </div>

                        {/* Metodos de Pago */}
                        <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                          <h4 style={{ margin: '0 0 1.25rem 0', fontSize: '0.85rem', fontWeight: '900', color: '#1e293b' }}>Métodos de Pago Utilizados</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            
                            {/* Efectivo */}
                            <div style={{ padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #f1f5f9', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.55rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>Efectivo</span>
                                <span style={{ fontSize: '0.55rem', fontWeight: '800', color: '#f97316' }}>{totalSales > 0 ? Math.round((payEfectivo / totalSales) * 100) : 0}%</span>
                              </div>
                              <div style={{ fontSize: '0.85rem', fontWeight: '900', color: '#0f172a' }}>${payEfectivo.toLocaleString('es-CO')}</div>
                              <div style={{ width: '100%', height: '4px', borderRadius: '2px', backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                                <div style={{ width: `${totalSales > 0 ? (payEfectivo / totalSales) * 100 : 0}%`, height: '100%', backgroundColor: '#f97316' }} />
                              </div>
                            </div>

                            {/* Tarjeta */}
                            <div style={{ padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #f1f5f9', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.55rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>Tarjeta</span>
                                <span style={{ fontSize: '0.55rem', fontWeight: '800', color: '#3b82f6' }}>{totalSales > 0 ? Math.round((payTarjeta / totalSales) * 100) : 0}%</span>
                              </div>
                              <div style={{ fontSize: '0.85rem', fontWeight: '900', color: '#0f172a' }}>${payTarjeta.toLocaleString('es-CO')}</div>
                              <div style={{ width: '100%', height: '4px', borderRadius: '2px', backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                                <div style={{ width: `${totalSales > 0 ? (payTarjeta / totalSales) * 100 : 0}%`, height: '100%', backgroundColor: '#3b82f6' }} />
                              </div>
                            </div>

                            {/* Transferencia */}
                            <div style={{ padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #f1f5f9', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.55rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>Transferencia</span>
                                <span style={{ fontSize: '0.55rem', fontWeight: '800', color: '#10b981' }}>{totalSales > 0 ? Math.round((payTransferencia / totalSales) * 100) : 0}%</span>
                              </div>
                              <div style={{ fontSize: '0.85rem', fontWeight: '900', color: '#0f172a' }}>${payTransferencia.toLocaleString('es-CO')}</div>
                              <div style={{ width: '100%', height: '4px', borderRadius: '2px', backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                                <div style={{ width: `${totalSales > 0 ? (payTransferencia / totalSales) * 100 : 0}%`, height: '100%', backgroundColor: '#10b981' }} />
                              </div>
                            </div>

                            {/* Mixto */}
                            <div style={{ padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #f1f5f9', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.55rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>Mixto</span>
                                <span style={{ fontSize: '0.55rem', fontWeight: '800', color: '#8b5cf6' }}>{totalSales > 0 ? Math.round((payMixto / totalSales) * 100) : 0}%</span>
                              </div>
                              <div style={{ fontSize: '0.85rem', fontWeight: '900', color: '#0f172a' }}>${payMixto.toLocaleString('es-CO')}</div>
                              <div style={{ width: '100%', height: '4px', borderRadius: '2px', backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                                <div style={{ width: `${totalSales > 0 ? (payMixto / totalSales) * 100 : 0}%`, height: '100%', backgroundColor: '#8b5cf6' }} />
                              </div>
                            </div>

                          </div>
                        </div>

                      </div>
                    </div>
                  );
                })()}
                {/* Shifts Log */}
                <h3 style={{ fontSize: '0.9rem', fontWeight: '900', color: '#0f172a', margin: '0.5rem 0 0 0' }}>Bitácora de Turnos de Caja</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #80082E', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', fontSize: '0.65rem' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left' }}>Cajero</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left' }}>Apertura</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right' }}>Efectivo Inicial</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right' }}>Efectivo Real</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right' }}>Diferencia</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {managerShifts.slice(shiftsPage * 10, (shiftsPage + 1) * 10).map((sh, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem', fontWeight: '800' }}>{sh.usuario_apertura}</td>
                        <td style={{ padding: '0.75rem', color: '#64748b' }}>{new Date(sh.fecha_apertura).toLocaleString('es-CO')}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>${Number(sh.monto_apertura).toLocaleString('es-CO')}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{sh.monto_cierre_real != null ? `$${Number(sh.monto_cierre_real).toLocaleString('es-CO')}` : '-'}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '800', color: Number(sh.diferencia) >= 0 ? '#10b981' : '#ef4444' }}>
                          {sh.diferencia != null ? `$${Number(sh.diferencia).toLocaleString('es-CO')}` : '-'}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <span style={{ backgroundColor: sh.estado === 'abierta' ? '#dcfce7' : '#f1f5f9', color: sh.estado === 'abierta' ? '#15803d' : '#475569', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: '900', textTransform: 'uppercase', fontSize: '0.625rem' }}>
                            {sh.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {managerShifts.length === 0 && (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No hay turnos registrados.</td></tr>
                    )}
                  </tbody>
                </table>
                {managerShifts.length > 10 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700' }}>
                      Mostrando {shiftsPage * 10 + 1} a {Math.min((shiftsPage + 1) * 10, managerShifts.length)} de {managerShifts.length} turnos
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => setShiftsPage(p => Math.max(0, p - 1))} disabled={shiftsPage === 0} style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: shiftsPage === 0 ? '#f1f5f9' : 'white', cursor: shiftsPage === 0 ? 'not-allowed' : 'pointer', fontSize: '0.75rem', fontWeight: '700' }}>Anterior</button>
                      <button onClick={() => setShiftsPage(p => p + 1)} disabled={(shiftsPage + 1) * 10 >= managerShifts.length} style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: (shiftsPage + 1) * 10 >= managerShifts.length ? '#f1f5f9' : 'white', cursor: (shiftsPage + 1) * 10 >= managerShifts.length ? 'not-allowed' : 'pointer', fontSize: '0.75rem', fontWeight: '700' }}>Siguiente</button>
                    </div>
                  </div>
                )}
              </div>
            ) : activeMenuId === 'promociones' ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1.5rem', overflowY: 'auto', gap: '1.5rem', backgroundColor: '#f8fafc' }} className="pos-scrollbar">
                <h2 style={{ fontSize: '1.1rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>Promociones Retail Activas</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
                  {promotions.map((p, idx) => (
                    <div key={idx} style={{ padding: '1.5rem', borderRadius: '14px', border: '1px solid #e2e8f0', background: 'white', position: 'relative', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                      <span style={{
                        position: 'absolute', top: '1rem', right: '1rem',
                        backgroundColor: p.activo ? '#dcfce7' : '#fee2e2',
                        color: p.activo ? '#15803d' : '#991b1b',
                        padding: '0.2rem 0.5rem', borderRadius: '6px',
                        fontSize: '0.65rem', fontWeight: '900', textTransform: 'uppercase'
                      }}>{p.activo ? 'Activa' : 'Inactiva'}</span>
                      <h3 style={{ fontSize: '1rem', fontWeight: '900', color: '#0f172a', margin: '0 0 0.4rem 0', paddingRight: '4rem' }}>{p.nombre}</h3>
                      <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 1rem 0' }}>{p.descripcion || 'Sin descripción'}</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: '800', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                        <div><span style={{ opacity: 0.6 }}>TIPO:</span> {p.tipo || '—'}</div>
                        <div><span style={{ opacity: 0.6 }}>VALOR:</span> {p.tipo === 'Porcentaje' ? `${p.valor}%` : `$${Number(p.valor||0).toLocaleString('es-CO')}`}</div>
                      </div>
                      {(p.fecha_inicio || p.fecha_fin) && (
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                          {p.fecha_inicio && `Desde: ${p.fecha_inicio.substring(0,10)}`}
                          {p.fecha_inicio && p.fecha_fin && ' — '}
                          {p.fecha_fin && `Hasta: ${p.fecha_fin.substring(0,10)}`}
                        </div>
                      )}
                    </div>
                  ))}
                  {promotions.length === 0 && (
                    <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                      No hay promociones retail registradas en el sistema.
                    </div>
                  )}
                </div>
              </div>
            ) : activeMenuId === 'personal' ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', backgroundColor: '#f8fafc', padding: '1.5rem' }} className="pos-scrollbar">
                
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '950', color: '#0f172a', margin: 0 }}>👥 Gestión de Personal</h2>
                    <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.2rem 0 0' }}>Administra vendedores, roles, permisos y turnos de caja en {selectedStore?.nombre || 'esta sucursal'}</p>
                  </div>
                  {staffTab === 'vendedores' && (
                    <button 
                      onClick={() => setShowNewUserModal(true)} 
                      style={{ padding: '0.55rem 1.25rem', background: `linear-gradient(90deg, ${customPrimary} 0%, ${customSecondary} 100%)`, border: 'none', borderRadius: '10px', fontSize: '0.78rem', fontWeight: '900', color: 'white', cursor: 'pointer', boxShadow: '0 4px 12px rgba(128,8,46,0.15)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Plus size={16} /> Agregar Vendedor
                    </button>
                  )}
                </div>

                {/* Sub-tabs pills */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  {[
                    { id: 'vendedores', label: 'Vendedores' },
                    { id: 'roles', label: 'Roles y Permisos' },
                    { id: 'turnos', label: 'Programación de Turnos' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setStaffTab(tab.id as any)}
                      style={{
                        padding: '0.45rem 1rem',
                        fontWeight: '800',
                        fontSize: '0.75rem',
                        border: staffTab === tab.id ? `1.5px solid ${customPrimary}` : '1.5px solid #cbd5e1',
                        borderRadius: '20px',
                        background: staffTab === tab.id ? `${customPrimary}12` : 'white',
                        color: staffTab === tab.id ? customPrimary : '#64748b',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Sub-tabs Content */}
                {staffTab === 'vendedores' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1', color: '#64748b', fontWeight: '800' }}>
                            <th style={{ padding: '0.85rem 1rem' }}>Nombre Completo</th>
                            <th style={{ padding: '0.85rem 1rem' }}>Correo Electrónico</th>
                            <th style={{ padding: '0.85rem 1rem' }}>Rol Asignado</th>
                            <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {staffUsers
                            .filter(u => {
                              // Is this user linked to the current store via assignments?
                              return staffAssignments.some(a => a.userId === u.id && a.storeId === selectedStore?.id);
                            })
                            .map((usr) => {
                              const userAssignment = staffAssignments.find(a => a.userId === usr.id && a.storeId === selectedStore?.id);
                              const matchedRoleObj = staffRoles.find(r => r.id === userAssignment?.posRoleId);
                              const posRoleName = matchedRoleObj ? matchedRoleObj.name : 'Vendedor';

                              return (
                                <tr key={usr.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '0.85rem 1rem', fontWeight: '800', color: '#0f172a' }}>{usr.full_name}</td>
                                  <td style={{ padding: '0.85rem 1rem', color: '#475569' }}>{usr.email || '—'}</td>
                                  <td style={{ padding: '0.85rem 1rem' }}>
                                    <span style={{ padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.65rem', fontWeight: '800', backgroundColor: '#eef2ff', color: '#80082E' }}>
                                      {posRoleName}
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                                    <button onClick={async () => {
                                      if (confirm(`¿Estás seguro de desvincular a ${usr.full_name} de la tienda?`)) {
                                        const updatedAssignments = staffAssignments.filter(a => !(a.userId === usr.id && a.storeId === selectedStore?.id));
                                        setStaffAssignments(updatedAssignments);
                                        await saveCustomTheme(staffRoles, updatedAssignments);
                                        await fetchStaffData();
                                      }
                                    }} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: '700', fontSize: '0.72rem' }}>
                                      Desvincular
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          {staffUsers.filter(u => staffAssignments.some(a => a.userId === u.id && a.storeId === selectedStore?.id)).length === 0 && (
                            <tr>
                              <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                                No hay vendedores registrados en esta sucursal. Presiona "Agregar Vendedor" para crearlos.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Vendedores de otros puntos que se pueden vincular a este punto rápidamente */}
                    <div style={{ marginTop: '1.5rem' }}>
                      <h3 style={{ fontSize: '0.9rem', fontWeight: '900', color: '#0f172a', marginBottom: '0.5rem' }}>Vincular Vendedores Existentes</h3>
                      <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0 0 1rem' }}>Vendedores en el sistema sin sucursal asignada que puedes vincular a esta tienda:</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                        {staffUsers
                          .filter(u => {
                            // Only users not assigned to ANY store in the assignments list
                            return !staffAssignments.some(a => a.userId === u.id);
                          })
                          .map(usr => (
                            <div key={usr.id} style={{ padding: '1rem', borderRadius: '12px', background: 'white', border: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <strong style={{ fontSize: '0.82rem', color: '#0f172a', display: 'block' }}>{usr.full_name}</strong>
                                <span style={{ fontSize: '0.68rem', color: '#64748b' }}>{usr.email || 'Sin correo'}</span>
                              </div>
                              <button onClick={async () => {
                                const newAss = {
                                  userId: usr.id,
                                  storeId: selectedStore.id,
                                  posRoleId: 'pos-vendedor' // fallback default role
                                };
                                const updatedAssignments = [...staffAssignments, newAss];
                                setStaffAssignments(updatedAssignments);
                                await saveCustomTheme(staffRoles, updatedAssignments);
                                await fetchStaffData();
                              }} style={{ padding: '0.35rem 0.75rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.68rem', fontWeight: '800', color: '#475569', cursor: 'pointer' }}>
                                Vincular
                              </button>
                            </div>
                          ))}
                        {staffUsers.filter(u => !staffAssignments.some(a => a.userId === u.id)).length === 0 && (
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>No hay usuarios sin sucursal disponibles.</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {staffTab === 'roles' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    
                    {/* Add Custom POS Role Form */}
                    <div style={{ padding: '1.25rem', background: 'white', borderRadius: '16px', border: '1px solid #cbd5e1' }}>
                      <h3 style={{ fontSize: '0.9rem', fontWeight: '900', color: '#0f172a', margin: '0 0 0.5rem' }}>Crear Nuevo Rol del POS</h3>
                      <form onSubmit={handleCreatePOSRole} style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                        <input
                          type="text"
                          required
                          placeholder="Ej. Cajero Principal, Supervisor Nocturno"
                          value={newRoleName}
                          onChange={e => setNewRoleName(e.target.value)}
                          style={{ flex: 1, padding: '0.5rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                        />
                        <button type="submit" style={{ padding: '0.5rem 1rem', background: '#80082E', border: 'none', borderRadius: '8px', color: 'white', fontWeight: '800', fontSize: '0.8rem', cursor: 'pointer' }}>
                          Crear Rol
                        </button>
                      </form>
                    </div>

                    <div style={{ padding: '1.25rem', background: 'white', borderRadius: '16px', border: '1px solid #cbd5e1' }}>
                      <h3 style={{ fontSize: '0.9rem', fontWeight: '900', color: '#0f172a', margin: '0 0 0.5rem' }}>Configurador de Permisos del POS</h3>
                      <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 1.25rem' }}>Asigna los módulos del POS a los que cada rol tiene acceso de visualización y ejecución en la tienda:</p>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {staffRoles.map(role => {
                          const rolePermissions = role.permissions || [];
                          return (
                            <div key={role.id} style={{ padding: '1rem', borderRadius: '12px', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: '900', color: '#80082E', textTransform: 'uppercase' }}>Rol: {role.name}</h4>
                                {role.id !== 'pos-vendedor' && role.id !== 'pos-supervisor' && (
                                  <button onClick={() => handleDeletePOSRole(role.id)} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '800' }}>
                                    Eliminar Rol
                                  </button>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                {[
                                  { module: 'pos', name: 'Punto de Venta (Ventas/Caja)' },
                                  { module: 'clientes', name: 'CRM (Gestión de Clientes)' },
                                  { module: 'reportes', name: 'Módulo de Reportes' },
                                  { module: 'promociones', name: 'Promociones' },
                                  { module: 'ajustes', name: 'Ajustes UX / Temas' }
                                ].map(m => {
                                  const matchesPerm = rolePermissions.includes(m.module);
                                  return (
                                    <label key={m.module} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: '750', color: '#334155', cursor: 'pointer', background: 'white', padding: '0.4rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                                      <input
                                        type="checkbox"
                                        checked={matchesPerm}
                                        onChange={() => handleTogglePOSPermission(role.id, m.module)}
                                        style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#80082E' }}
                                      />
                                      {m.name}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {staffTab === 'turnos' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1.5rem', alignItems: 'start' }}>
                    
                    {/* Add shift Form */}
                    <div style={{ padding: '1.25rem', background: 'white', borderRadius: '16px', border: '1px solid #cbd5e1' }}>
                      <h3 style={{ fontSize: '0.9rem', fontWeight: '900', color: '#0f172a', margin: '0 0 1rem' }}>Programar Turno</h3>
                      <form onSubmit={handleSaveStaffShift} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Vendedor</label>
                          <select
                            value={selectedShiftUser}
                            onChange={e => setSelectedShiftUser(e.target.value)}
                            required
                            style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', background: 'white' }}
                          >
                            <option value="">Seleccione vendedor...</option>
                            {staffUsers
                              .filter(u => staffAssignments.some(a => a.userId === u.id && a.storeId === selectedStore?.id))
                              .map(u => (
                                <option key={u.id} value={u.id}>{u.full_name}</option>
                              ))}
                          </select>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <input 
                            type="checkbox" 
                            id="isWeekly" 
                            checked={isWeeklyShift} 
                            onChange={e => setIsWeeklyShift(e.target.checked)} 
                          />
                          <label htmlFor="isWeekly" style={{ fontSize: '0.75rem', fontWeight: '800', color: '#0f172a' }}>Programar Múltiples Días (Semanal)</label>
                        </div>

                        {isWeeklyShift ? (
                          <>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                              <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Fecha Inicio</label>
                                <input
                                  type="date"
                                  value={selectedShiftDate}
                                  onChange={e => setSelectedShiftDate(e.target.value)}
                                  required
                                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                                />
                              </div>
                              <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Fecha Fin</label>
                                <input
                                  type="date"
                                  value={selectedShiftEndDate}
                                  onChange={e => setSelectedShiftEndDate(e.target.value)}
                                  required
                                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                                />
                              </div>
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Días de la semana</label>
                              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                {[{d: 1, l: 'L'}, {d: 2, l: 'M'}, {d: 3, l: 'X'}, {d: 4, l: 'J'}, {d: 5, l: 'V'}, {d: 6, l: 'S'}, {d: 0, l: 'D'}].map(day => (
                                  <button
                                    type="button"
                                    key={day.d}
                                    onClick={() => setSelectedDays(prev => prev.includes(day.d) ? prev.filter(x => x !== day.d) : [...prev, day.d])}
                                    style={{
                                      width: '32px', height: '32px', borderRadius: '50%',
                                      border: selectedDays.includes(day.d) ? 'none' : '1px solid #cbd5e1',
                                      backgroundColor: selectedDays.includes(day.d) ? '#80082E' : 'white',
                                      color: selectedDays.includes(day.d) ? 'white' : '#64748b',
                                      fontWeight: '800', fontSize: '0.75rem', cursor: 'pointer'
                                    }}
                                  >{day.l}</button>
                                ))}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Fecha de Turno</label>
                            <input
                              type="date"
                              value={selectedShiftDate}
                              onChange={e => setSelectedShiftDate(e.target.value)}
                              required
                              style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                            />
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Hora Entrada</label>
                            <input
                              type="time"
                              value={selectedShiftIn}
                              onChange={e => setSelectedShiftIn(e.target.value)}
                              required
                              style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Hora Salida</label>
                            <input
                              type="time"
                              value={selectedShiftOut}
                              onChange={e => setSelectedShiftOut(e.target.value)}
                              required
                              style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                            />
                          </div>
                        </div>

                        <button type="submit" style={{ width: '100%', padding: '0.65rem', background: customPrimary, border: 'none', borderRadius: '8px', color: 'white', fontWeight: '800', fontSize: '0.75rem', cursor: 'pointer', marginTop: '0.5rem' }}>
                          Programar Turno
                        </button>
                      </form>
                    </div>

                    {/* Shifts list */}
                    <div style={{ padding: '1.25rem', background: 'white', borderRadius: '16px', border: '1px solid #cbd5e1' }}>
                      <h3 style={{ fontSize: '0.9rem', fontWeight: '900', color: '#0f172a', margin: '0 0 1rem' }}>Turnos Programados</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {staffShifts.map(sh => (
                          <div key={sh.id} style={{ padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <strong style={{ fontSize: '0.82rem', color: '#0f172a', display: 'block' }}>{sh.profiles?.full_name || 'Vendedor'}</strong>
                              <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                📅 {sh.fecha} | ⏰ {sh.hora_entrada} - {sh.hora_salida}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '0.62rem', fontWeight: '800', padding: '0.15rem 0.45rem', borderRadius: '20px', backgroundColor: '#eef2ff', color: '#80082E' }}>
                                {sh.estado}
                              </span>
                              {sh.estado === 'programado' && (
                                <button onClick={() => handleStartShift(sh.id)} style={{ border: 'none', padding: '0.2rem 0.5rem', borderRadius: '4px', background: '#10b981', color: 'white', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '800' }} title="Abrir Turno">
                                  Activar
                                </button>
                              )}
                              <button onClick={async () => {
                                if (confirm('¿Desea cancelar este turno?')) {
                                  await supabase.from('store_staff_shifts').delete().eq('id', sh.id);
                                  await fetchStaffData();
                                }
                              }} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '800' }} title="Cancelar Turno">
                                ❌
                              </button>
                            </div>
                          </div>
                        ))}
                        {staffShifts.length === 0 && (
                          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                            No hay turnos programados en esta sucursal.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* CREATE USER MODAL */}
                {showNewUserModal && (
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(4px)' }}>
                    <div className="pos-modal" style={{ width: '90%', maxWidth: '400px', padding: '2rem', background: 'white', borderRadius: '20px', border: '1px solid #cbd5e1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontWeight: '900', fontSize: '1.1rem', color: '#0f172a' }}>Agregar Nuevo Vendedor</h3>
                        <button onClick={() => setShowNewUserModal(false)} style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}><X size={20} /></button>
                      </div>

                      <form onSubmit={handleCreateStaffUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Nombre Completo</label>
                          <input
                            type="text"
                            required
                            placeholder="Ej. Juan Pérez"
                            value={newUserName}
                            onChange={e => setNewUserName(e.target.value)}
                            style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Correo Electrónico</label>
                          <input
                            type="email"
                            required
                            placeholder="juan@tienda.com"
                            value={newUserEmail}
                            onChange={e => setNewUserEmail(e.target.value)}
                            style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Contraseña</label>
                          <input
                            type="password"
                            required
                            placeholder="Mínimo 6 caracteres"
                            value={newUserPassword}
                            onChange={e => setNewUserPassword(e.target.value)}
                            style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Rol Asignado</label>
                          <select
                            required
                            value={newUserRoleId}
                            onChange={e => setNewUserRoleId(e.target.value)}
                            style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', background: 'white' }}
                          >
                            <option value="">Seleccione rol...</option>
                            {staffRoles.map(r => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Foto / Avatar del Vendedor</label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  const base64String = (reader.result as string).split(',')[1];
                                  setNewUserAvatarBase64(base64String);
                                  setNewUserAvatarName(file.name);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            style={{ width: '100%', fontSize: '0.8rem' }}
                          />
                        </div>

                        <button type="submit" disabled={creatingUser} style={{ width: '100%', padding: '0.75rem', background: `linear-gradient(90deg, ${customPrimary} 0%, ${customSecondary} 100%)`, border: 'none', borderRadius: '8px', color: 'white', fontWeight: '900', fontSize: '0.8rem', cursor: 'pointer', marginTop: '0.5rem' }}>
                          {creatingUser ? 'Creando...' : 'Crear Vendedor'}
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            ) : activeMenuId === 'ajustes' ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', backgroundColor: '#f4f6f9' }} className="pos-scrollbar">
                {/* Header */}
                <div style={{ padding: '1.5rem 1.5rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
                  <div>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>🎨 UX Manager</h2>
                    <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.25rem 0 0' }}>Personaliza colores, tipografía y catálogo del POS en tiempo real</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.6rem' }}>
                    <button onClick={resetTheme} style={{ padding: '0.5rem 1rem', background: 'white', border: '1.5px solid #cbd5e1', borderRadius: '8px', fontSize: '0.72rem', fontWeight: '800', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      ↺ Restablecer
                    </button>
                    <button onClick={() => saveCustomTheme()} disabled={themeSaving} style={{ padding: '0.5rem 1.25rem', background: themeSaved ? '#10b981' : `linear-gradient(90deg,${customPrimary},${customSecondary})`, border: 'none', borderRadius: '8px', fontSize: '0.72rem', fontWeight: '900', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', boxShadow: '0 3px 10px rgba(128,8,46,0.25)', transition: 'all 0.3s' }}>
                      {themeSaving ? '⏳ Guardando...' : themeSaved ? '✓ Guardado!' : '💾 Guardar Tema'}
                    </button>
                  </div>
                </div>

                {/* Tab Nav */}
                <div style={{ padding: '1rem 1.5rem 0', display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                  {([
                    { id: 'colors', label: '🎨 Colores' },
                    { id: 'typography', label: '🔤 Tipografía' },
                    { id: 'catalog', label: '🖼️ Catálogo' },
                    { id: 'logo', label: '🏢 Logo Empresa' },
                    { id: 'transfer', label: '💳 Medios de Transferencia' },
                    { id: 'cash_concepts', label: '💵 Conceptos de Caja' }
                  ] as const).map(tab => (
                    <button key={tab.id} onClick={() => setUxTab(tab.id)} style={{
                      padding: '0.55rem 1.1rem',
                      background: uxTab === tab.id ? 'white' : 'transparent',
                      border: uxTab === tab.id ? `1.5px solid ${customPrimary}` : '1.5px solid transparent',
                      borderRadius: '8px 8px 0 0',
                      fontSize: '0.75rem', fontWeight: '850', cursor: 'pointer',
                      color: uxTab === tab.id ? customPrimary : '#64748b',
                      transition: 'all 0.15s'
                    }}>{tab.label}</button>
                  ))}
                </div>

                {/* Tab Content */}
                <div style={{ flex: 1, padding: '1.25rem 1.5rem 1.5rem', display: 'flex', gap: '1.5rem', overflow: 'hidden', flexWrap: 'wrap' }}>
                  {/* Left: Controls */}
                  <div style={{ 
                    flex: 1, 
                    minWidth: '320px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '1rem',
                    maxHeight: '66vh',
                    overflowY: 'auto',
                    paddingRight: '0.75rem'
                  }} className="pos-scrollbar">

                    {/* === COLORS TAB === */}
                    {uxTab === 'colors' && (
                      <div style={{ background: 'white', borderRadius: '14px', padding: '1.25rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '900', color: '#0f172a' }}>Paleta de Colores</h3>
                        {([
                          { label: 'Color Primario', desc: 'Sidebar, botones y encabezados', value: customPrimary, setter: setCustomPrimary, def: DEFAULT_THEME.primary },
                          { label: 'Color Secundario', desc: 'Degradado de botones y sidebar', value: customSecondary, setter: setCustomSecondary, def: DEFAULT_THEME.secondary },
                          { label: 'Fondo General', desc: 'Color de fondo del área de trabajo', value: customBg, setter: setCustomBg, def: DEFAULT_THEME.bg },
                          { label: 'Tarjetas / Cards', desc: 'Fondo de tarjetas de productos', value: customCards, setter: setCustomCards, def: DEFAULT_THEME.cards },
                          { label: 'Texto Principal', desc: 'Color del texto base del POS', value: customText, setter: setCustomText, def: DEFAULT_THEME.text },
                          { label: 'Bordes', desc: 'Color de líneas divisoras y bordes', value: customBorder, setter: setCustomBorder, def: DEFAULT_THEME.border },
                          { label: 'Color de Acento', desc: 'Ventas completadas, indicadores de éxito', value: customAccent, setter: setCustomAccent, def: DEFAULT_THEME.accent },
                          { label: 'Texto del Menú Lateral', desc: 'Color de los textos e íconos del sidebar', value: customSidebarText, setter: setCustomSidebarText, def: DEFAULT_THEME.sidebarText },
                          { label: 'Texto de Botones', desc: 'Color del texto en botones del POS (TOTAL VENTA, etc)', value: customButtonText, setter: setCustomButtonText, def: DEFAULT_THEME.buttonText },
                          { label: 'Texto de Ventanas Modales', desc: 'Color del texto dentro de las ventanas modales del POS', value: customModalText, setter: setCustomModalText, def: '#0f172a' },
                          { label: 'Color del Renglón Total', desc: 'Color para el texto del totalizador en el pie del carrito', value: customTotalColor, setter: setCustomTotalColor, def: '#80082E' },
                        ] as Array<{label:string;desc:string;value:string;setter:(v:string)=>void;def:string}>).map((item, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.65rem', borderRadius: '10px', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                            <input
                              type="color"
                              value={item.value}
                              onChange={e => item.setter(e.target.value)}
                              style={{ width: '44px', height: '44px', borderRadius: '10px', border: '2px solid #e2e8f0', cursor: 'pointer', padding: '2px', flexShrink: 0 }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.78rem', fontWeight: '850', color: '#0f172a' }}>{item.label}</div>
                              <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.1rem' }}>{item.desc}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <input
                                type="text"
                                value={item.value}
                                onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) item.setter(e.target.value); }}
                                style={{ width: '82px', padding: '0.3rem 0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.72rem', fontFamily: 'monospace', color: '#0f172a' }}
                              />
                              {item.value !== item.def && (
                                <button onClick={() => item.setter(item.def)} title="Restablecer" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.9rem', padding: '0.2rem' }}>↺</button>
                              )}
                            </div>
                          </div>
                        ))}

                        {/* 📊 Configuración de Renglón Total Venta */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '0.5rem' }}>
                          <h4 style={{ margin: 0, fontSize: '0.78rem', fontWeight: '900', color: '#0f172a' }}>📊 Renglón de Total Venta</h4>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              <label style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: '750' }}>Tamaño de Fuente</label>
                              <select 
                                value={customTotalFontSize} 
                                onChange={e => setCustomTotalFontSize(e.target.value)}
                                style={{ padding: '0.4rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.75rem', backgroundColor: 'white' }}
                              >
                                <option value="1rem">Normal (1rem)</option>
                                <option value="1.15rem">Medio (1.15rem)</option>
                                <option value="1.35rem">Grande (1.35rem)</option>
                                <option value="1.6rem">Muy Grande (1.6rem)</option>
                                <option value="1.85rem">Gigante (1.85rem)</option>
                              </select>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              <label style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: '750' }}>Grosor de Letra</label>
                              <select 
                                value={customTotalFontWeight} 
                                onChange={e => setCustomTotalFontWeight(e.target.value)}
                                style={{ padding: '0.4rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.75rem', backgroundColor: 'white' }}
                              >
                                <option value="500">Normal (500)</option>
                                <option value="700">Negrita (700)</option>
                                <option value="800">Extra Negrita (800)</option>
                                <option value="950">Máximo (950)</option>
                              </select>
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <label style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: '750' }}>Espaciado Renglón (Padding)</label>
                            <select 
                              value={customTotalPadding} 
                              onChange={e => setCustomTotalPadding(e.target.value)}
                              style={{ padding: '0.4rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.75rem', backgroundColor: 'white', width: '100%' }}
                            >
                              <option value="0.4rem 0.75rem">Compacto (0.4rem)</option>
                              <option value="0.65rem 1rem">Mediano (0.65rem)</option>
                              <option value="0.85rem 1.25rem">Predeterminado (0.85rem)</option>
                              <option value="1.2rem 1.5rem">Amplio (1.2rem)</option>
                              <option value="1.5rem 2rem">Super Espaciado (1.5rem)</option>
                            </select>
                          </div>
                        </div>

                        {/* 📊 Configuración de Totalizador Superior (Header) */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '0.5rem' }}>
                          <h4 style={{ margin: 0, fontSize: '0.78rem', fontWeight: '900', color: '#0f172a' }}>📊 Totalizador Superior (Header Venta)</h4>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <label style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: '750' }}>Color de Fondo</label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <input 
                                type="color" 
                                value={customHeaderTotalColor} 
                                onChange={e => setCustomHeaderTotalColor(e.target.value)}
                                style={{ width: '40px', height: '40px', padding: '2px', border: '1.5px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', backgroundColor: 'transparent' }}
                              />
                              <input 
                                type="text"
                                value={customHeaderTotalColor} 
                                onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) setCustomHeaderTotalColor(e.target.value); }}
                                style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.78rem' }}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              <label style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: '750' }}>Tamaño de Fuente</label>
                              <select 
                                value={customHeaderTotalFontSize} 
                                onChange={e => setCustomHeaderTotalFontSize(e.target.value)}
                                style={{ padding: '0.4rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.75rem', backgroundColor: 'white' }}
                              >
                                <option value="0.9rem">Compacto (0.9rem)</option>
                                <option value="1.1rem">Normal (1.1rem)</option>
                                <option value="1.25rem">Medio (1.25rem)</option>
                                <option value="1.45rem">Grande (1.45rem)</option>
                                <option value="1.7rem">Muy Grande (1.7rem)</option>
                              </select>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              <label style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: '750' }}>Grosor de Letra</label>
                              <select 
                                value={customHeaderTotalFontWeight} 
                                onChange={e => setCustomHeaderTotalFontWeight(e.target.value)}
                                style={{ padding: '0.4rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.75rem', backgroundColor: 'white' }}
                              >
                                <option value="500">Normal (500)</option>
                                <option value="700">Negrita (700)</option>
                                <option value="800">Extra Negrita (800)</option>
                                <option value="955">Máximo (955)</option>
                              </select>
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <label style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: '750' }}>Espaciado (Padding)</label>
                            <select 
                              value={customHeaderTotalPadding} 
                              onChange={e => setCustomHeaderTotalPadding(e.target.value)}
                              style={{ padding: '0.4rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.75rem', backgroundColor: 'white', width: '100%' }}
                            >
                              <option value="0.3rem 0.65rem">Compacto (0.3rem)</option>
                              <option value="0.5rem 1rem">Mediano (0.5rem)</option>
                              <option value="0.65rem 1.5rem">Predeterminado (0.65rem)</option>
                              <option value="1rem 1.8rem">Amplio (1rem)</option>
                            </select>
                          </div>
                        </div>

                        {/* 🔒 Configuración de Botón Cerrar Caja */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '0.5rem' }}>
                          <h4 style={{ margin: 0, fontSize: '0.78rem', fontWeight: '900', color: '#0f172a' }}>🔒 Botón Cerrar Caja</h4>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              <label style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: '750' }}>Color de Fondo</label>
                              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                <input 
                                  type="color" 
                                  value={customCloseSessionBg} 
                                  onChange={e => setCustomCloseSessionBg(e.target.value)}
                                  style={{ width: '38px', height: '38px', padding: '2px', border: '1.5px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}
                                />
                                <input 
                                  type="text"
                                  value={customCloseSessionBg} 
                                  onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) setCustomCloseSessionBg(e.target.value); }}
                                  style={{ flex: 1, padding: '0.35rem', borderRadius: '6px', border: '1.5px solid #cbd5e1', fontSize: '0.72rem' }}
                                />
                              </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              <label style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: '750' }}>Color de Borde</label>
                              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                <input 
                                  type="color" 
                                  value={customCloseSessionBorder} 
                                  onChange={e => setCustomCloseSessionBorder(e.target.value)}
                                  style={{ width: '38px', height: '38px', padding: '2px', border: '1.5px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}
                                />
                                <input 
                                  type="text"
                                  value={customCloseSessionBorder} 
                                  onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) setCustomCloseSessionBorder(e.target.value); }}
                                  style={{ flex: 1, padding: '0.35rem', borderRadius: '6px', border: '1.5px solid #cbd5e1', fontSize: '0.72rem' }}
                                />
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <label style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: '750' }}>Color del Texto / Ícono</label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <input 
                                type="color" 
                                value={customCloseSessionText} 
                                onChange={e => setCustomCloseSessionText(e.target.value)}
                                style={{ width: '40px', height: '40px', padding: '2px', border: '1.5px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', backgroundColor: 'transparent' }}
                              />
                              <input 
                                type="text"
                                value={customCloseSessionText} 
                                onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) setCustomCloseSessionText(e.target.value); }}
                                style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.78rem' }}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              <label style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: '750' }}>Tamaño de Fuente</label>
                              <select 
                                value={customCloseSessionFontSize} 
                                onChange={e => setCustomCloseSessionFontSize(e.target.value)}
                                style={{ padding: '0.4rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.75rem', backgroundColor: 'white' }}
                              >
                                <option value="0.7rem">Compacto (0.7rem)</option>
                                <option value="0.78rem">Normal (0.78rem)</option>
                                <option value="0.88rem">Destacado (0.88rem)</option>
                                <option value="1rem">Grande (1rem)</option>
                              </select>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              <label style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: '750' }}>Grosor de Letra</label>
                              <select 
                                value={customCloseSessionFontWeight} 
                                onChange={e => setCustomCloseSessionFontWeight(e.target.value)}
                                style={{ padding: '0.4rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.75rem', backgroundColor: 'white' }}
                              >
                                <option value="500">Normal (500)</option>
                                <option value="700">Negrita (700)</option>
                                <option value="850">Extra Negrita (850)</option>
                              </select>
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <label style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: '750' }}>Espaciado (Padding)</label>
                            <select 
                              value={customCloseSessionPadding} 
                              onChange={e => setCustomCloseSessionPadding(e.target.value)}
                              style={{ padding: '0.4rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.75rem', backgroundColor: 'white', width: '100%' }}
                            >
                              <option value="0.35rem 0.65rem">Compacto (0.35rem)</option>
                              <option value="0.55rem 1rem">Predeterminado (0.55rem)</option>
                              <option value="0.75rem 1.35rem">Espacioso (0.75rem)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* === TYPOGRAPHY TAB === */}
                    {uxTab === 'typography' && (
                      <div style={{ background: 'white', borderRadius: '14px', padding: '1.25rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '900', color: '#0f172a' }}>Configuración de Tipografía</h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: '850', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Familia de Fuente</label>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                            {['Outfit', 'Inter', 'Roboto', 'Poppins', 'DM Sans', 'Nunito', 'Montserrat', 'Raleway', 'Open Sans'].map(f => (
                              <button key={f} onClick={() => setCustomFontFamily(f)} style={{
                                padding: '0.5rem', borderRadius: '8px', border: `1.5px solid ${customFontFamily === f ? customPrimary : '#e2e8f0'}`,
                                background: customFontFamily === f ? `${customPrimary}18` : 'white',
                                color: customFontFamily === f ? customPrimary : '#475569',
                                fontSize: '0.75rem', fontWeight: '800', fontFamily: f, cursor: 'pointer', transition: 'all 0.15s'
                              }}>{f}</button>
                            ))}
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: '850', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tamaño de Fuente Base — <strong style={{ color: customPrimary }}>{customFontSize}</strong></label>
                          <input type="range" min="11" max="18" step="0.5" value={parseFloat(customFontSize)}
                            onChange={e => setCustomFontSize(`${e.target.value}px`)}
                            style={{ width: '100%', accentColor: customPrimary }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#94a3b8' }}>
                            <span>11px (Compacto)</span><span>18px (Grande)</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: '850', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Peso de Fuente</label>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {[['300', 'Light'], ['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold'], ['800', 'Black']].map(([w, lbl]) => (
                              <button key={w} onClick={() => setCustomFontWeight(w)} style={{
                                flex: 1, padding: '0.45rem 0.3rem', borderRadius: '8px',
                                border: `1.5px solid ${customFontWeight === w ? customPrimary : '#e2e8f0'}`,
                                background: customFontWeight === w ? `${customPrimary}18` : 'white',
                                color: customFontWeight === w ? customPrimary : '#475569',
                                fontSize: '0.65rem', fontWeight: w as any, cursor: 'pointer', transition: 'all 0.15s'
                              }}>{lbl}</button>
                            ))}
                          </div>
                        </div>

                        {/* Live Text Preview */}
                        <div style={{ padding: '1rem', borderRadius: '10px', background: customBg, border: `1px solid ${customBorder}` }}>
                          <p style={{ margin: 0, fontFamily: customFontFamily, fontSize: customFontSize, fontWeight: customFontWeight as any, color: customText, lineHeight: 1.5 }}>
                            Vista previa: Camisa Clásica Blanca — <strong style={{ color: customPrimary }}>$89.900</strong>
                          </p>
                          <p style={{ margin: '0.4rem 0 0', fontFamily: customFontFamily, fontSize: `${parseFloat(customFontSize) * 0.85}px`, fontWeight: '500', color: '#94a3b8' }}>
                            REF: CBR-2024-001 · Talla M · Color Blanco
                          </p>
                        </div>

                        {/* Divider */}
                        <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '0.5rem 0' }} />

                        {/* SIDEBAR TYPOGRAPHY CONTROLS */}
                        <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: '900', color: '#0f172a' }}>Tipografía del Menú Lateral (Sidebar)</h4>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: '850', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fuente del Menú Lateral</label>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                            {['Outfit', 'Inter', 'Roboto', 'Poppins', 'DM Sans', 'Nunito', 'Montserrat', 'Raleway', 'Open Sans'].map(f => (
                              <button key={f} onClick={() => setCustomSidebarFontFamily(f)} style={{
                                padding: '0.5rem', borderRadius: '8px', border: `1.5px solid ${customSidebarFontFamily === f ? customPrimary : '#e2e8f0'}`,
                                background: customSidebarFontFamily === f ? `${customPrimary}18` : 'white',
                                color: customSidebarFontFamily === f ? customPrimary : '#475569',
                                fontSize: '0.75rem', fontWeight: '800', fontFamily: f, cursor: 'pointer', transition: 'all 0.15s'
                              }}>{f}</button>
                            ))}
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ fontSize: '0.72rem', fontWeight: '850', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tamaño de Fuente del Menú Lateral</label>
                            <span style={{ fontSize: '0.8rem', fontWeight: '900', color: customPrimary }}>{customSidebarFontSize}</span>
                          </div>
                          <input type="range" min="10" max="18" step="0.5" value={parseFloat(customSidebarFontSize)}
                            onChange={e => setCustomSidebarFontSize(`${e.target.value}px`)}
                            style={{ width: '100%', accentColor: customPrimary }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#94a3b8' }}>
                            <span>Compacto (10px)</span><span>Predeterminado (13px)</span><span>Grande (18px)</span>
                          </div>
                        </div>

                        {/* Custom Header Text Settings */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '0.5rem' }}>
                          <h4 style={{ margin: 0, fontSize: '0.78rem', fontWeight: '900', color: '#0f172a' }}>✍️ Texto del Nombre de Empresa</h4>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label style={{ fontSize: '0.72rem', fontWeight: '850', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nombre de Empresa a Mostrar</label>
                            <input 
                              type="text"
                              value={customHeaderText}
                              onChange={e => setCustomHeaderText(e.target.value)}
                              placeholder="Breiner"
                              style={{ padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.825rem', outline: 'none' }}
                            />
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <label style={{ fontSize: '0.72rem', fontWeight: '850', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tamaño de Texto</label>
                              <select 
                                value={customHeaderTextSize} 
                                onChange={e => setCustomHeaderTextSize(e.target.value)}
                                style={{ padding: '0.5rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.78rem', backgroundColor: 'white' }}
                              >
                                <option value="12px">Pequeño (12px)</option>
                                <option value="14px">Medio (14px)</option>
                                <option value="16px">Normal (16px)</option>
                                <option value="18px">Grande (18px)</option>
                                <option value="20px">Muy Grande (20px)</option>
                                <option value="24px">Gigante (24px)</option>
                              </select>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <label style={{ fontSize: '0.72rem', fontWeight: '850', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ubicación</label>
                              <select 
                                value={customHeaderTextPlacement} 
                                onChange={e => setCustomHeaderTextPlacement(e.target.value)}
                                style={{ padding: '0.5rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.78rem', backgroundColor: 'white' }}
                              >
                                <option value="right">Derecha del Logo</option>
                                <option value="left">Izquierda del Logo</option>
                              </select>
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label style={{ fontSize: '0.72rem', fontWeight: '850', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Color del Texto</label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <input 
                                type="color" 
                                value={customHeaderTextColor} 
                                onChange={e => setCustomHeaderTextColor(e.target.value)}
                                style={{ width: '40px', height: '40px', padding: '2px', border: '1.5px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', backgroundColor: 'transparent' }}
                              />
                              <input 
                                type="text"
                                value={customHeaderTextColor} 
                                onChange={e => setCustomHeaderTextColor(e.target.value)}
                                style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.78rem' }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* === CATALOG TAB === */}
                    {uxTab === 'catalog' && (
                      <div style={{ background: 'white', borderRadius: '14px', padding: '1.25rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '900', color: '#0f172a' }}>Vista del Catálogo de Productos</h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ fontSize: '0.72rem', fontWeight: '850', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Altura de Imagen / Icono</label>
                            <span style={{ fontSize: '0.85rem', fontWeight: '900', color: customPrimary }}>{productIconSize}px</span>
                          </div>
                          <input type="range" min="80" max="260" step="5" value={productIconSize}
                            onChange={e => setProductIconSize(Number(e.target.value))}
                            style={{ width: '100%', accentColor: customPrimary }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#94a3b8' }}>
                            <span>80px (Compacto)</span>
                            <span>160px (Default)</span>
                            <span>260px (Grande)</span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                            {[{ label: 'Pequeño', v: 80 }, { label: 'Mediano', v: 135 }, { label: 'Grande', v: 180 }, { label: 'Gigante', v: 220 }].map(p => (
                              <button key={p.v} onClick={() => setProductIconSize(p.v)} style={{
                                flex: 1, padding: '0.4rem', borderRadius: '6px',
                                border: `1.5px solid ${productIconSize === p.v ? customPrimary : '#e2e8f0'}`,
                                background: productIconSize === p.v ? `${customPrimary}18` : 'white',
                                color: productIconSize === p.v ? customPrimary : '#475569',
                                fontSize: '0.65rem', fontWeight: '800', cursor: 'pointer', transition: 'all 0.15s'
                              }}>{p.label}</button>
                            ))}
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ fontSize: '0.72rem', fontWeight: '850', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Columnas de Grilla</label>
                            <span style={{ fontSize: '0.85rem', fontWeight: '900', color: customPrimary }}>{catalogColumns} col{catalogColumns === 7 ? ' ★ Default' : ''}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            {[2, 3, 4, 5, 6, 7, 8].map(c => (
                              <button key={c} onClick={() => setCatalogColumns(c)} style={{
                                flex: 1, minWidth: '2rem', padding: '0.55rem 0.3rem', borderRadius: '8px',
                                border: `1.5px solid ${catalogColumns === c ? customPrimary : '#e2e8f0'}`,
                                background: catalogColumns === c ? `${customPrimary}18` : 'white',
                                color: catalogColumns === c ? customPrimary : '#475569',
                                fontSize: '0.78rem', fontWeight: c === 7 ? '900' : '700',
                                cursor: 'pointer', transition: 'all 0.15s',
                                position: 'relative'
                              }}>
                                {c}{c === 7 ? ' ★' : ''}
                              </button>
                            ))}
                          </div>
                          <p style={{ fontSize: '0.62rem', color: '#94a3b8', margin: 0 }}>★ = Layout predeterminado (7 columnas)</p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px dashed #cbd5e1', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                             <label style={{ fontSize: '0.72rem', fontWeight: '850', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📱 Columnas en Tablets / Móviles</label>
                             <span style={{ fontSize: '0.85rem', fontWeight: '900', color: customPrimary }}>{catalogColumnsTablet} col</span>
                           </div>
                           <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                             {[2, 3, 4, 5, 6].map(c => (
                               <button key={c} onClick={() => setCatalogColumnsTablet(c)} style={{
                                 flex: 1, minWidth: '2rem', padding: '0.55rem 0.3rem', borderRadius: '8px',
                                 border: `1.5px solid ${catalogColumnsTablet === c ? customPrimary : '#e2e8f0'}`,
                                 background: catalogColumnsTablet === c ? `${customPrimary}18` : 'white',
                                 color: catalogColumnsTablet === c ? customPrimary : '#475569',
                                 fontSize: '0.78rem', fontWeight: '800',
                                 cursor: 'pointer', transition: 'all 0.15s'
                               }}>
                                 {c}
                               </button>
                             ))}
                           </div>
                           <p style={{ fontSize: '0.62rem', color: '#94a3b8', margin: 0 }}>Define el número de columnas en pantallas medianas y táctiles</p>
                         </div>

                        {/* Switch for hiding borders */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                          <div>
                            <div style={{ fontSize: '0.78rem', fontWeight: '850', color: '#0f172a' }}>Ocultar bordes de productos</div>
                            <div style={{ fontSize: '0.62rem', color: '#94a3b8', marginTop: '0.1rem' }}>Remueve las líneas de borde de las tarjetas e imágenes</div>
                          </div>
                          <input
                            type="checkbox"
                            checked={hideProductBorders}
                            onChange={e => setHideProductBorders(e.target.checked)}
                            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: customPrimary }}
                          />
                        </div>

                        {/* Aspect Ratio control */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: '850', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Aspecto de Imagen</label>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            {[
                              { key: 'cover', label: '🔲 Cuadrada (Cover)' },
                              { key: 'contain', label: '📐 Completa (Contain)' },
                              { key: 'vertical', label: '📐 Vertical (Retrato)' }
                            ].map(opt => (
                              <button key={opt.key} onClick={() => setProductImageAspect(opt.key as any)} style={{
                                flex: 1, padding: '0.55rem 0.25rem', borderRadius: '8px',
                                border: `1.5px solid ${productImageAspect === opt.key ? customPrimary : '#e2e8f0'}`,
                                background: productImageAspect === opt.key ? `${customPrimary}18` : 'white',
                                color: productImageAspect === opt.key ? customPrimary : '#475569',
                                fontSize: '0.72rem', fontWeight: '800', cursor: 'pointer', transition: 'all 0.15s'
                              }}>{opt.label}</button>
                            ))}
                          </div>
                        </div>

                        {/* Image Fit control */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: '850', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ajuste de Imagen del Catálogo (Evitar Cortes)</label>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            {[
                              { key: 'cover', label: '🔲 Cortar y llenar (Cover)' },
                              { key: 'contain', label: '📐 Ajustar completa (Contain)' }
                            ].map(opt => (
                              <button key={opt.key} onClick={() => setProductImageFit(opt.key as any)} style={{
                                flex: 1, padding: '0.55rem 0.25rem', borderRadius: '8px',
                                border: `1.5px solid ${productImageFit === opt.key ? customPrimary : '#e2e8f0'}`,
                                background: productImageFit === opt.key ? `${customPrimary}18` : 'white',
                                color: productImageFit === opt.key ? customPrimary : '#475569',
                                fontSize: '0.72rem', fontWeight: '800', cursor: 'pointer', transition: 'all 0.15s'
                              }}>{opt.label}</button>
                            ))}
                          </div>
                        </div>

                        {/* Price Font Size control */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ fontSize: '0.72rem', fontWeight: '850', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tamaño de Fuente del Precio</label>
                            <span style={{ fontSize: '0.8rem', fontWeight: '900', color: customPrimary }}>{productPriceFontSize}</span>
                          </div>
                          <input type="range" min="0.75" max="1.4" step="0.05" value={parseFloat(productPriceFontSize)}
                            onChange={e => setProductPriceFontSize(`${e.target.value}rem`)}
                            style={{ width: '100%', accentColor: customPrimary }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#94a3b8' }}>
                            <span>Pequeño (0.75rem)</span><span>Grande (1.4rem)</span>
                          </div>
                        </div>

                        {/* Cart Width control */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ fontSize: '0.72rem', fontWeight: '850', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ancho de la Columna del Carrito</label>
                            <span style={{ fontSize: '0.8rem', fontWeight: '900', color: customPrimary }}>{cartWidth}px</span>
                          </div>
                          <input type="range" min="320" max="550" step="10" value={cartWidth}
                            onChange={e => setCartWidth(Number(e.target.value))}
                            style={{ width: '100%', accentColor: customPrimary }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#94a3b8' }}>
                            <span>Compacto (320px)</span><span>Predeterminado (420px)</span><span>Ancho (550px)</span>
                          </div>
                        </div>

                        {/* Cart Item Image Size control */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ fontSize: '0.72rem', fontWeight: '850', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tamaño de Imagen en el Carrito</label>
                            <span style={{ fontSize: '0.8rem', fontWeight: '900', color: customPrimary }}>{cartItemImageSize}px</span>
                          </div>
                          <input type="range" min="30" max="80" step="2" value={cartItemImageSize}
                            onChange={e => setCartItemImageSize(Number(e.target.value))}
                            style={{ width: '100%', accentColor: customPrimary }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#94a3b8' }}>
                            <span>Mini (30px)</span><span>Predeterminado (42px)</span><span>Grande (80px)</span>
                          </div>
                        </div>

                        {/* Total Label Text control */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: '850', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Texto de Etiqueta del Total</label>
                          <input
                            type="text"
                            value={customTotalLabel}
                            onChange={e => setCustomTotalLabel(e.target.value.toUpperCase())}
                            placeholder="TOTAL A COBRAR"
                            style={{ padding: '0.6rem 0.85rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.82rem', fontWeight: '800', color: '#0f172a', background: '#f8fafc', outline: 'none', transition: 'border 0.2s' }}
                            onFocus={e => e.currentTarget.style.borderColor = customPrimary}
                            onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                          />
                          <p style={{ fontSize: '0.6rem', color: '#94a3b8', margin: 0 }}>Personaliza el texto que aparece en el renglón del total del carrito</p>
                        </div>

                        {/* Search Width Control */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ fontSize: '0.72rem', fontWeight: '855', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ancho del Buscador</label>
                            <span style={{ fontSize: '0.8rem', fontWeight: '900', color: customPrimary }}>{customSearchWidth}%</span>
                          </div>
                          <input type="range" min="25" max="70" step="5" value={customSearchWidth}
                            onChange={e => setCustomSearchWidth(Number(e.target.value))}
                            style={{ width: '100%', accentColor: customPrimary }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#94a3b8' }}>
                            <span>Compacto (25%)</span><span>Por defecto (45%)</span><span>Expandido (70%)</span>
                          </div>
                        </div>

                        {/* Search Height Control */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ fontSize: '0.72rem', fontWeight: '855', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Altura del Buscador</label>
                            <span style={{ fontSize: '0.8rem', fontWeight: '900', color: customPrimary }}>{customSearchHeight}px</span>
                          </div>
                          <input type="range" min="32" max="54" step="2" value={customSearchHeight}
                            onChange={e => setCustomSearchHeight(Number(e.target.value))}
                            style={{ width: '100%', accentColor: customPrimary }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#94a3b8' }}>
                            <span>Compacto (32px)</span><span>Predeterminado (42px)</span><span>Destacado (54px)</span>
                          </div>
                        </div>

                        {/* Header Icons Size Control */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ fontSize: '0.72rem', fontWeight: '855', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tamaño de Iconos de Cabecera</label>
                            <span style={{ fontSize: '0.8rem', fontWeight: '900', color: customPrimary }}>{customHeaderIconSize}px</span>
                          </div>
                          <input type="range" min="14" max="26" step="1" value={customHeaderIconSize}
                            onChange={e => setCustomHeaderIconSize(Number(e.target.value))}
                            style={{ width: '100%', accentColor: customPrimary }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#94a3b8' }}>
                            <span>Pequeño (14px)</span><span>Predeterminado (18px)</span><span>Grande (26px)</span>
                          </div>
                        </div>

                        {/* Icon size preview */}
                        <div style={{ padding: '0.75rem', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: '700', textTransform: 'uppercase' }}>Vista previa de tarjeta</div>
                          <div style={{ width: '130px', background: customCards, borderRadius: '10px', border: hideProductBorders ? 'none' : `1px solid ${customBorder}`, padding: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', boxShadow: hideProductBorders ? '0 1px 3px rgba(0,0,0,0.05)' : 'none' }}>
                            <div style={{ 
                              width: '100%', 
                              height: productImageAspect === 'vertical' ? `${Math.round(productIconSize * 0.55 * 1.35)}px` : `${Math.round(productIconSize * 0.55)}px`, 
                              borderRadius: '6px', 
                              border: hideProductBorders ? 'none' : `3px double ${customPrimary}`, 
                              background: '#f1f5f9', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              color: '#cbd5e1', 
                              fontSize: '1.2rem', 
                              overflow: 'hidden',
                              transition: 'height 0.2s'
                            }}>
                              <span style={{ fontSize: '1.8rem' }}>👕</span>
                            </div>
                            <div style={{ fontSize: '0.65rem', fontWeight: '900', color: customText, fontFamily: customFontFamily }}>Camisa Clásica</div>
                            <div style={{ fontSize: productPriceFontSize, fontWeight: '955', color: customPrimary, fontFamily: 'monospace' }}>$89.900</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* === LOGO TAB === */}
                    {uxTab === 'logo' && (
                      <div style={{ background: 'white', borderRadius: '14px', padding: '1.25rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '900', color: '#0f172a' }}>Logo Personalizado de la Empresa</h3>

                        {/* File Upload Control */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: '850', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subir Imagen de Logo</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <label style={{
                              padding: '0.65rem 1.25rem',
                              backgroundColor: logoUploading ? '#cbd5e1' : customPrimary,
                              color: customButtonText,
                              borderRadius: '8px',
                              fontSize: '0.75rem',
                              fontWeight: '800',
                              cursor: logoUploading ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                              transition: 'opacity 0.2s'
                            }}>
                              {logoUploading ? <Loader2 size={14} className="animate-spin" /> : '📁'} 
                              {logoUploading ? 'Subiendo...' : 'Seleccionar Archivo'}
                              <input
                                type="file"
                                accept="image/*"
                                disabled={logoUploading}
                                style={{ display: 'none' }}
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  setLogoUploading(true);
                                  try {
                                    const reader = new FileReader();
                                    reader.onloadend = async () => {
                                      const base64Content = (reader.result as string).split(',')[1];
                                      const payload = {
                                        name: 'empresa_logo_' + Date.now(),
                                        value: '',
                                        fileBase64: base64Content,
                                        fileName: `logo-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
                                      };
                                      const res = await fetch('/api/settings', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify(payload)
                                      });
                                      if (!res.ok) {
                                        const err = await res.json();
                                        throw new Error(err.error || 'Error en subida');
                                      }
                                      const data = await res.json();
                                      if (data.value) {
                                        setCustomLogoUrl(data.value);
                                      }
                                    };
                                    reader.readAsDataURL(file);
                                  } catch (err: any) {
                                    alert('Error subiendo imagen: ' + err.message);
                                  } finally {
                                    setLogoUploading(false);
                                  }
                                }}
                              />
                            </label>
                            {customLogoUrl && (
                              <button
                                onClick={() => setCustomLogoUrl('')}
                                style={{
                                  padding: '0.65rem 1rem',
                                  backgroundColor: '#fee2e2',
                                  color: '#ef4444',
                                  border: 'none',
                                  borderRadius: '8px',
                                  fontSize: '0.75rem',
                                  fontWeight: '800',
                                  cursor: 'pointer'
                                }}
                              >
                                Quitar Logo
                              </button>
                            )}
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: '850', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>O ingresar URL Directa</label>
                          <input 
                            type="text" 
                            placeholder="https://ejemplo.com/mi_logo.png"
                            value={customLogoUrl}
                            onChange={e => setCustomLogoUrl(e.target.value)}
                            style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.825rem', outline: 'none' }}
                          />
                        </div>

                        {/* Slider to change Logo Width */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ fontSize: '0.72rem', fontWeight: '850', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ancho del Logo en el Sidebar</label>
                            <span style={{ fontSize: '0.8rem', fontWeight: '900', color: customPrimary }}>{customLogoWidth}px</span>
                          </div>
                          <input type="range" min="30" max="150" step="5" value={customLogoWidth}
                            onChange={e => setCustomLogoWidth(Number(e.target.value))}
                            style={{ width: '100%', accentColor: customPrimary }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#94a3b8' }}>
                            <span>Pequeño (30px)</span><span>Predeterminado (38px)</span><span>Grande (150px)</span>
                          </div>
                        </div>

                        {/* Image Preview */}
                        {customLogoUrl && (
                          <div style={{ padding: '1rem', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ fontSize: '0.625rem', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase' }}>Vista previa del logo</div>
                            <div style={{ 
                              width: `${customLogoWidth}px`, 
                              height: `${customLogoWidth}px`, 
                              borderRadius: '8px', 
                              backgroundColor: 'white', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              overflow: 'hidden', 
                              boxShadow: '0 2px 8px rgba(0,0,0,0.08)' 
                            }}>
                              <img src={customLogoUrl} alt="Preview Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* === TRANSFER METHODS TAB === */}
                    {uxTab === 'transfer' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* Form Card */}
                        <div style={{ background: 'white', borderRadius: '14px', padding: '1.25rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '900', color: '#0f172a' }}>
                                {editingTransferId ? '✏️ Editar Medio de Transferencia' : '➕ Configurar Nueva Cuenta / QR'}
                              </h3>
                              <p style={{ margin: '0.2rem 0 0', fontSize: '0.7rem', color: '#64748b' }}>
                                Parametriza las cuentas y códigos QR que se mostrarán debajo del botón Transferencia en el POS.
                              </p>
                            </div>
                            {editingTransferId && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTransferId(null);
                                  setNewTransferBank('');
                                  setNewTransferNumber('');
                                  setNewTransferHolder('Confecciones Breiner SAS');
                                  setNewTransferDoc('NIT 901.456.789-1');
                                  setNewTransferColor('#80082E');
                                  setNewTransferInstructions('');
                                  setNewTransferQrUrl('');
                                }}
                                style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer', color: '#64748b' }}
                              >
                                Cancelar Edición
                              </button>
                            )}
                          </div>

                          <form
                            onSubmit={async (e) => {
                              e.preventDefault();
                              if (!newTransferBank.trim() || !newTransferNumber.trim()) {
                                alert('Por favor ingresa el nombre del banco y el número de cuenta.');
                                return;
                              }

                              let updated: POSTransferMethod[];
                              if (editingTransferId) {
                                updated = transferMethods.map(m => m.id === editingTransferId ? {
                                  ...m,
                                  banco: newTransferBank.trim(),
                                  tipo_cuenta: newTransferType,
                                  numero_cuenta: newTransferNumber.trim(),
                                  titular: newTransferHolder.trim(),
                                  identificacion: newTransferDoc.trim(),
                                  color: newTransferColor,
                                  instrucciones: newTransferInstructions.trim(),
                                  qr_image_url: newTransferQrUrl.trim()
                                } : m);
                              } else {
                                const newId = 'tr-' + Date.now();
                                const newMethod: POSTransferMethod = {
                                  id: newId,
                                  banco: newTransferBank.trim(),
                                  tipo_cuenta: newTransferType,
                                  numero_cuenta: newTransferNumber.trim(),
                                  titular: newTransferHolder.trim(),
                                  identificacion: newTransferDoc.trim(),
                                  color: newTransferColor,
                                  instrucciones: newTransferInstructions.trim(),
                                  qr_image_url: newTransferQrUrl.trim(),
                                  activo: true
                                };
                                updated = [...transferMethods, newMethod];
                              }

                              setTransferMethods(updated);
                              await saveCustomTheme(staffRoles, staffAssignments, updated);
                              
                              // Reset form
                              setEditingTransferId(null);
                              setNewTransferBank('');
                              setNewTransferNumber('');
                              setNewTransferInstructions('');
                              setNewTransferQrUrl('');
                            }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
                          >
                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '0.75rem' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                                  Banco o Billetera
                                </label>
                                <input
                                  type="text"
                                  required
                                  placeholder="Ej. Bancolombia, Nequi, Daviplata"
                                  value={newTransferBank}
                                  onChange={e => setNewTransferBank(e.target.value)}
                                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', outline: 'none' }}
                                />
                              </div>

                              <div>
                                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                                  Tipo de Cuenta
                                </label>
                                <select
                                  value={newTransferType}
                                  onChange={e => setNewTransferType(e.target.value)}
                                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', backgroundColor: 'white' }}
                                >
                                  <option value="Ahorros">Ahorros</option>
                                  <option value="Corriente">Corriente</option>
                                  <option value="Celular / Billetera">Celular / Billetera</option>
                                  <option value="Llave / Transfiya">Llave / Transfiya</option>
                                  <option value="QR Interbancario">QR Interbancario</option>
                                </select>
                              </div>

                              <div>
                                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                                  Color Distintivo
                                </label>
                                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                  <input
                                    type="color"
                                    value={newTransferColor}
                                    onChange={e => setNewTransferColor(e.target.value)}
                                    style={{ width: '38px', height: '38px', padding: '2px', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                                  />
                                  <input
                                    type="text"
                                    value={newTransferColor}
                                    onChange={e => setNewTransferColor(e.target.value)}
                                    style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem', fontFamily: 'monospace' }}
                                  />
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                                  Número de Cuenta o Teléfono
                                </label>
                                <input
                                  type="text"
                                  required
                                  placeholder="Ej. 123-456789-01 o 310..."
                                  value={newTransferNumber}
                                  onChange={e => setNewTransferNumber(e.target.value)}
                                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', fontFamily: 'monospace', outline: 'none' }}
                                />
                              </div>

                              <div>
                                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                                  Titular de la Cuenta
                                </label>
                                <input
                                  type="text"
                                  placeholder="Confecciones Breiner SAS"
                                  value={newTransferHolder}
                                  onChange={e => setNewTransferHolder(e.target.value)}
                                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', outline: 'none' }}
                                />
                              </div>

                              <div>
                                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                                  NIT o Cédula
                                </label>
                                <input
                                  type="text"
                                  placeholder="NIT 901.456.789-1"
                                  value={newTransferDoc}
                                  onChange={e => setNewTransferDoc(e.target.value)}
                                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', outline: 'none' }}
                                />
                              </div>
                            </div>

                            {/* Carga de Imagen de Código QR */}
                            <div style={{ padding: '0.85rem', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <label style={{ fontSize: '0.72rem', fontWeight: '850', color: '#0f172a', textTransform: 'uppercase' }}>
                                📷 Imagen del Código QR de Pago (Aparecerá en el POS)
                              </label>
                              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <label style={{
                                  padding: '0.55rem 1rem',
                                  backgroundColor: transferUploading ? '#cbd5e1' : customPrimary,
                                  color: 'white',
                                  borderRadius: '8px',
                                  fontSize: '0.75rem',
                                  fontWeight: '800',
                                  cursor: transferUploading ? 'not-allowed' : 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.4rem',
                                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                                }}>
                                  {transferUploading ? <Loader2 size={14} className="animate-spin" /> : '📁'} 
                                  {transferUploading ? 'Subiendo QR...' : 'Subir Imagen QR'}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    disabled={transferUploading}
                                    style={{ display: 'none' }}
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      setTransferUploading(true);
                                      try {
                                        const reader = new FileReader();
                                        reader.onloadend = async () => {
                                          const base64Content = (reader.result as string).split(',')[1];
                                          const payload = {
                                            name: `transfer_qr_${Date.now()}`,
                                            value: '',
                                            fileBase64: base64Content,
                                            fileName: `qr-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
                                          };
                                          const res = await fetch('/api/settings', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(payload)
                                          });
                                          if (!res.ok) {
                                            const err = await res.json();
                                            throw new Error(err.error || 'Error subiendo QR');
                                          }
                                          const data = await res.json();
                                          if (data.value) {
                                            setNewTransferQrUrl(data.value);
                                          }
                                        };
                                        reader.readAsDataURL(file);
                                      } catch (err: any) {
                                        alert('Error al subir imagen QR: ' + err.message);
                                      } finally {
                                        setTransferUploading(false);
                                      }
                                    }}
                                  />
                                </label>

                                <input
                                  type="text"
                                  placeholder="O pegar URL directa de la imagen QR..."
                                  value={newTransferQrUrl}
                                  onChange={e => setNewTransferQrUrl(e.target.value)}
                                  style={{ flex: 1, padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.78rem', outline: 'none' }}
                                />

                                {newTransferQrUrl && (
                                  <button
                                    type="button"
                                    onClick={() => setNewTransferQrUrl('')}
                                    style={{ padding: '0.55rem 0.85rem', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800', cursor: 'pointer' }}
                                  >
                                    Quitar QR
                                  </button>
                                )}
                              </div>

                              {newTransferQrUrl && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                                  <div style={{ width: '60px', height: '60px', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <img src={newTransferQrUrl} alt="Preview QR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                  </div>
                                  <span style={{ fontSize: '0.68rem', color: '#16a34a', fontWeight: '750' }}>✓ Imagen QR cargada y lista para mostrarse en el POS.</span>
                                </div>
                              )}
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                                Instrucciones o Nota para el Cliente (Opcional)
                              </label>
                              <input
                                type="text"
                                placeholder="Ej. Enviar comprobante al WhatsApp 310... o verificar titular antes de enviar."
                                value={newTransferInstructions}
                                onChange={e => setNewTransferInstructions(e.target.value)}
                                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', outline: 'none' }}
                              />
                            </div>

                            <button
                              type="submit"
                              style={{
                                padding: '0.75rem',
                                background: `linear-gradient(90deg, ${customPrimary} 0%, ${customSecondary} 100%)`,
                                border: 'none',
                                borderRadius: '8px',
                                color: 'white',
                                fontWeight: '900',
                                fontSize: '0.82rem',
                                cursor: 'pointer',
                                boxShadow: '0 3px 10px rgba(128,8,46,0.2)'
                              }}
                            >
                              {editingTransferId ? '💾 Actualizar Medio de Transferencia' : '➕ Guardar y Publicar en POS'}
                            </button>
                          </form>
                        </div>

                        {/* List of Configured Transfer Accounts */}
                        <div style={{ background: 'white', borderRadius: '14px', padding: '1.25rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                          <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '900', color: '#0f172a' }}>
                            Cuentas y Códigos QR Configurados ({transferMethods.length})
                          </h4>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                            {transferMethods.map((m, idx) => (
                              <div
                                key={m.id || idx}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  padding: '0.85rem 1rem',
                                  borderRadius: '10px',
                                  border: `1.5px solid ${m.activo ? '#cbd5e1' : '#f1f5f9'}`,
                                  backgroundColor: m.activo ? '#ffffff' : '#f8fafc',
                                  opacity: m.activo ? 1 : 0.6
                                }}
                              >
                                <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
                                  {/* QR Thumbnail */}
                                  {m.qr_image_url ? (
                                    <div 
                                      onClick={() => setZoomQrModalUrl(m.qr_image_url || null)}
                                      style={{ width: '48px', height: '48px', borderRadius: '6px', border: '1px solid #cbd5e1', overflow: 'hidden', cursor: 'pointer', backgroundColor: 'white', flexShrink: 0 }}
                                      title="Clic para ampliar"
                                    >
                                      <img src={m.qr_image_url} alt="QR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    </div>
                                  ) : (
                                    <div style={{ width: '48px', height: '48px', borderRadius: '6px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
                                      📲
                                    </div>
                                  )}

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                      <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: m.color || '#80082E', color: ['#FDDA24', '#ffffff', '#fef08a'].includes(m.color) ? '#0f172a' : 'white', fontSize: '0.68rem', fontWeight: '900' }}>
                                        {m.banco}
                                      </span>
                                      <span style={{ fontSize: '0.75rem', fontWeight: '850', color: '#0f172a', fontFamily: 'monospace' }}>
                                        {m.numero_cuenta}
                                      </span>
                                      <span style={{ fontSize: '0.65rem', color: '#64748b' }}>
                                        ({m.tipo_cuenta})
                                      </span>
                                    </div>
                                    <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                                      Titular: <strong>{m.titular}</strong> · {m.identificacion}
                                    </span>
                                    {m.instrucciones && (
                                      <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>
                                        Nota: {m.instrucciones}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const updated = transferMethods.map(item => item.id === m.id ? { ...item, activo: !item.activo } : item);
                                      setTransferMethods(updated);
                                      await saveCustomTheme(staffRoles, staffAssignments, updated);
                                    }}
                                    style={{
                                      padding: '0.35rem 0.65rem',
                                      borderRadius: '6px',
                                      border: '1px solid #cbd5e1',
                                      backgroundColor: m.activo ? '#dcfce7' : '#fee2e2',
                                      color: m.activo ? '#166534' : '#991b1b',
                                      fontSize: '0.68rem',
                                      fontWeight: '800',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {m.activo ? '✓ Activo' : '✕ Inactivo'}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingTransferId(m.id);
                                      setNewTransferBank(m.banco);
                                      setNewTransferType(m.tipo_cuenta || 'Ahorros');
                                      setNewTransferNumber(m.numero_cuenta);
                                      setNewTransferHolder(m.titular || 'Confecciones Breiner SAS');
                                      setNewTransferDoc(m.identificacion || 'NIT 901.456.789-1');
                                      setNewTransferColor(m.color || '#80082E');
                                      setNewTransferInstructions(m.instrucciones || '');
                                      setNewTransferQrUrl(m.qr_image_url || '');
                                    }}
                                    style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', color: '#0f172a', fontSize: '0.68rem', fontWeight: '800', cursor: 'pointer' }}
                                  >
                                    ✏️ Editar
                                  </button>

                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!confirm(`¿Eliminar la cuenta ${m.banco} (${m.numero_cuenta})?`)) return;
                                      const updated = transferMethods.filter(item => item.id !== m.id);
                                      setTransferMethods(updated);
                                      await saveCustomTheme(staffRoles, staffAssignments, updated);
                                    }}
                                    style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid #fca5a5', background: '#fff1f2', color: '#dc2626', fontSize: '0.68rem', fontWeight: '800', cursor: 'pointer' }}
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* === CASH CONCEPTS TAB === */}
                    {uxTab === 'cash_concepts' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* New Concept Form */}
                        <div style={{ background: 'white', borderRadius: '14px', padding: '1.25rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '900', color: '#0f172a' }}>
                              ➕ Parametrizar Nuevo Concepto de Caja (Ingreso / Egreso)
                            </h3>
                            <p style={{ margin: '0.2rem 0 0', fontSize: '0.7rem', color: '#64748b' }}>
                              Define los conceptos permitidos para registrar ingresos extraordinarios o egresos menores (parqueaderos, aseo, cadenas, etc.).
                            </p>
                          </div>

                          <form
                            onSubmit={async (e) => {
                              e.preventDefault();
                              if (!newConceptName.trim()) {
                                alert('Por favor ingresa el nombre del concepto.');
                                return;
                              }

                              const newConcept: POSCashConcept = {
                                id: 'cpt-' + Date.now(),
                                name: newConceptName.trim(),
                                nombre: newConceptName.trim(),
                                type: newConceptType.toLowerCase() as any,
                                tipo: newConceptType,
                                description: newConceptDesc.trim(),
                                descripcion: newConceptDesc.trim(),
                                is_active: true,
                                activo: true
                              };

                              const updated = [...cashConcepts, newConcept];
                              setCashConcepts(updated);
                              localStorage.setItem('pos_cash_concepts', JSON.stringify(updated));

                              // Try inserting into DB table if available
                              try {
                                await supabase.from('pos_cash_concepts').insert([{
                                  nombre: newConcept.nombre,
                                  tipo: newConcept.tipo,
                                  descripcion: newConcept.descripcion,
                                  activo: true
                                }]);
                              } catch (e) {
                                console.warn('pos_cash_concepts DB table insert notice:', e);
                              }

                              await saveCustomTheme(staffRoles, staffAssignments, transferMethods, updated);
                              setNewConceptName('');
                              setNewConceptDesc('');
                              alert('✓ Concepto de caja creado y guardado.');
                            }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
                          >
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                                  Nombre del Concepto
                                </label>
                                <input
                                  type="text"
                                  required
                                  placeholder="Ej. Pago Parqueaderos, Sencillo / Cambio, Aseo y Cafetería..."
                                  value={newConceptName}
                                  onChange={e => setNewConceptName(e.target.value)}
                                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', outline: 'none' }}
                                />
                              </div>

                              <div>
                                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                                  Tipo de Movimiento
                                </label>
                                <select
                                  value={newConceptType}
                                  onChange={e => setNewConceptType(e.target.value as 'Ingreso' | 'Egreso')}
                                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', backgroundColor: 'white' }}
                                >
                                  <option value="Egreso">🔴 Egreso (Salida / Gasto)</option>
                                  <option value="Ingreso">🟢 Ingreso (Entrada / Recibo)</option>
                                </select>
                              </div>
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                                Descripción / Observaciones por Defecto (Opcional)
                              </label>
                              <input
                                type="text"
                                placeholder="Ej. Gastos menores autorizados de la tienda o ingresos por sencillo"
                                value={newConceptDesc}
                                onChange={e => setNewConceptDesc(e.target.value)}
                                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', outline: 'none' }}
                              />
                            </div>

                            <button
                              type="submit"
                              style={{
                                padding: '0.65rem 1rem',
                                background: `linear-gradient(90deg, ${customPrimary} 0%, ${customSecondary} 100%)`,
                                border: 'none',
                                borderRadius: '8px',
                                color: 'white',
                                fontWeight: '900',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.4rem',
                                boxShadow: '0 3px 10px rgba(128,8,46,0.2)'
                              }}
                            >
                              <Plus size={15} /> Parametrizar y Guardar Concepto
                            </button>
                          </form>
                        </div>

                        {/* List of Concepts */}
                        <div style={{ background: 'white', borderRadius: '14px', padding: '1.25rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                          <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '900', color: '#0f172a' }}>
                            Conceptos Parametrizados en el Sistema ({cashConcepts.length})
                          </h4>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                            {cashConcepts.map((cpt, idx) => (
                              <div
                                key={cpt.id || idx}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  padding: '0.85rem 1rem',
                                  borderRadius: '10px',
                                  border: `1.5px solid ${cpt.activo ? '#cbd5e1' : '#f1f5f9'}`,
                                  backgroundColor: cpt.activo ? '#ffffff' : '#f8fafc',
                                  opacity: cpt.activo ? 1 : 0.6
                                }}
                              >
                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                  <span style={{
                                    padding: '0.2rem 0.6rem',
                                    borderRadius: '6px',
                                    fontSize: '0.68rem',
                                    fontWeight: '900',
                                    backgroundColor: cpt.tipo === 'Ingreso' ? '#ecfdf5' : '#fee2e2',
                                    color: cpt.tipo === 'Ingreso' ? '#047857' : '#b91c1c',
                                    border: `1px solid ${cpt.tipo === 'Ingreso' ? '#a7f3d0' : '#fca5a5'}`
                                  }}>
                                    {cpt.tipo === 'Ingreso' ? '🟢 Ingreso' : '🔴 Egreso'}
                                  </span>

                                  <div>
                                    <div style={{ fontSize: '0.82rem', fontWeight: '850', color: '#0f172a' }}>
                                      {cpt.nombre}
                                    </div>
                                    {cpt.descripcion && (
                                      <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                                        {cpt.descripcion}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const updated = cashConcepts.map(c => c.id === cpt.id ? { ...c, activo: !c.activo } : c);
                                      setCashConcepts(updated);
                                      localStorage.setItem('pos_cash_concepts', JSON.stringify(updated));
                                      await saveCustomTheme(staffRoles, staffAssignments, transferMethods, updated);
                                    }}
                                    style={{
                                      padding: '0.35rem 0.65rem',
                                      borderRadius: '6px',
                                      border: '1px solid #cbd5e1',
                                      backgroundColor: cpt.activo ? '#dcfce7' : '#fee2e2',
                                      color: cpt.activo ? '#166534' : '#991b1b',
                                      fontSize: '0.68rem',
                                      fontWeight: '800',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {cpt.activo ? '✓ Activo' : '✕ Inactivo'}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!confirm(`¿Eliminar el concepto "${cpt.nombre}"?`)) return;
                                      const updated = cashConcepts.filter(c => c.id !== cpt.id);
                                      setCashConcepts(updated);
                                      localStorage.setItem('pos_cash_concepts', JSON.stringify(updated));
                                      await saveCustomTheme(staffRoles, staffAssignments, transferMethods, updated);
                                    }}
                                    style={{
                                      padding: '0.35rem 0.65rem',
                                      borderRadius: '6px',
                                      border: '1px solid #fca5a5',
                                      background: '#fff1f2',
                                      color: '#dc2626',
                                      fontSize: '0.68rem',
                                      fontWeight: '800',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: Live full preview */}
                  <div style={{ width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: '850', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vista Previa en Vivo</div>
                    <div style={{ borderRadius: '14px', overflow: 'hidden', border: `1px solid ${customBorder}`, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
                      {/* Mock sidebar */}
                      <div style={{ background: `linear-gradient(180deg,${customPrimary} 0%,#3B0010 100%)`, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <div style={{ fontSize: '0.6rem', fontWeight: '900', color: 'white', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>BREINER CONFECCIONES</div>
                        {['Punto de Venta', 'Productos', 'Clientes', 'Reportes'].map((m, i) => (
                          <div key={i} style={{ padding: '0.3rem 0.5rem', borderRadius: '6px', fontSize: '0.65rem', fontWeight: '700', color: i === 0 ? customPrimary : 'rgba(255,255,255,0.7)', background: i === 0 ? `linear-gradient(90deg,${customPrimary},${customSecondary})` : 'transparent' }}>{m}</div>
                        ))}
                      </div>
                      {/* Mock workspace */}
                      <div style={{ background: customBg, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ background: `linear-gradient(90deg,${customPrimary},${customSecondary})`, borderRadius: '6px', padding: '0.4rem 0.75rem' }}>
                          <div style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.7)', fontFamily: customFontFamily }}>TOTAL VENTA</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: '900', color: 'white', fontFamily: 'monospace' }}>$145.440</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                          {['Camisa', 'Pantaloneta'].map(p => (
                            <div key={p} style={{ background: customCards, borderRadius: '8px', border: `1px solid ${customBorder}`, padding: '0.4rem' }}>
                              <div style={{ height: `${Math.min(productIconSize * 0.3, 40)}px`, borderRadius: '4px', background: '#f1f5f9', border: `2px double ${customPrimary}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', marginBottom: '0.25rem' }}>👕</div>
                              <div style={{ fontSize: '0.55rem', fontWeight: '900', color: customText, fontFamily: customFontFamily }}>{p}</div>
                              <div style={{ fontSize: '0.6rem', fontWeight: '950', color: customPrimary, fontFamily: 'monospace' }}>$89.900</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ background: customAccent, borderRadius: '6px', padding: '0.3rem 0.5rem', textAlign: 'center', fontSize: '0.6rem', fontWeight: '900', color: 'white', fontFamily: customFontFamily }}>✓ Venta Registrada</div>
                      </div>
                    </div>

                    {/* Save hint */}
                    <div style={{ padding: '0.75rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', fontSize: '0.68rem', color: '#92400e', lineHeight: 1.5 }}>
                      💡 Los cambios se aplican en tiempo real. Presiona <strong>Guardar Tema</strong> para persistirlos en la base de datos.
                    </div>
                  </div>
                </div>
              </div>
            ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1.5rem', overflowY: 'auto', gap: '1.25rem', position: 'relative' }} className="pos-scrollbar">
              
              {!currentSession && isOnline && (
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  background: 'rgba(244, 246, 249, 0.94)',
                  backdropFilter: 'blur(8px)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 50,
                  padding: '2rem',
                  textAlign: 'center'
                }}>
                  <div style={{
                    background: 'white',
                    padding: '2.5rem',
                    borderRadius: '20px',
                    border: '1px solid #cbd5e1',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    maxWidth: '400px'
                  }}>
                    <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', marginBottom: '1.25rem' }}>
                      <Lock size={30} />
                    </div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '950', color: '#0f172a', margin: 0 }}>Caja POS Cerrada</h3>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.5rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                      Debes dar inicio al turno de caja y registrar la base de efectivo inicial antes de poder facturar.
                    </p>
                    <button
                      onClick={() => setShowOpenSessionModal(true)}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: '#80082E',
                        border: 'none',
                        borderRadius: '8px',
                        color: 'white',
                        fontWeight: '85b',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 10px rgba(128,8,46,0.2)'
                      }}
                    >
                      Abrir Turno de Caja
                    </button>
                  </div>
                </div>
              )}

              {/* Tag/Categories Filter Slider */}
              <div style={{ display: 'flex', gap: '0.65rem', overflowX: 'auto', paddingBottom: '0.35rem', flexShrink: 0 }} className="pos-scrollbar">
                {[
                  { label: 'Todos', active: true, icon: Sparkles },
                  { label: 'Camisetas', active: false, icon: Shirt },
                  { label: 'Camisas', active: false, icon: Shirt },
                  { label: 'Pantalones', active: false, icon: Shirt },
                  { label: 'Chaquetas', active: false, icon: Shirt },
                  { label: 'Vestidos', active: false, icon: Shirt },
                  { label: 'Shorts', active: false, icon: Shirt },
                  { label: 'Accesorios', active: false, icon: Shirt },
                  { label: 'Más...', active: false, icon: MoreHorizontal }
                ].map((cat, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.45rem 1rem',
                    borderRadius: '30px',
                    cursor: 'pointer',
                    backgroundColor: cat.active ? '#80082E' : 'white',
                    color: cat.active ? 'white' : '#64748b',
                    border: cat.active ? 'none' : '1px solid #cbd5e1',
                    fontSize: '0.78rem',
                    fontWeight: '800',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap'
                  }}>
                    <cat.icon size={13} />
                    <span>{cat.label}</span>
                  </div>
                ))}
              </div>

               {/* Redesigned Card Catalog Grid layout with media queries */}
               <style>{`
                 @media (max-width: 1024px) {
                   .pos-catalog-grid {
                     grid-template-columns: repeat(${catalogColumnsTablet}, 1fr) !important;
                   }
                 }
                 @media (min-width: 1025px) {
                   .pos-catalog-grid {
                     grid-template-columns: repeat(${catalogColumns}, 1fr) !important;
                   }
                 }
               `}</style>
               <div className="pos-catalog-grid" style={{ display: 'grid', gap: '1.25rem', alignContent: 'start' }}>
                {filteredProducts.map(p => {
                  const getInitials = (name: string) => {
                    if (!name) return 'PR';
                    const parts = name.trim().split(/\s+/);
                    if (parts.length >= 2) {
                      return (parts[0][0] + parts[1][0]).toUpperCase();
                    }
                    return name.slice(0, 2).toUpperCase();
                  };
                  const initials = getInitials(p.nombre_producto || '');

                  return (
                    <div
                      key={p.id}
                      onClick={() => handleAddToCart(p)}
                      style={{
                        padding: '0.85rem',
                        background: 'white',
                        borderRadius: '12px',
                        border: hideProductBorders ? 'none' : '1px solid #cbd5e1',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.65rem',
                        position: 'relative',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        boxShadow: hideProductBorders ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.06)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      {/* Double Initials Badge left-top */}
                      <span style={{
                        position: 'absolute',
                        top: '0.75rem',
                        left: '0.75rem',
                        backgroundColor: '#80082E',
                        color: 'white',
                        fontSize: '0.6rem',
                        fontWeight: '900',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10
                      }}>
                        {initials}
                      </span>

                      {/* Heart Favorite badge top right */}
                      <div style={{
                        position: 'absolute',
                        top: '0.75rem',
                        right: '0.75rem',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        zIndex: 10
                      }}>
                        <Heart size={16} />
                      </div>

                      {/* Product display card (Double border outline with model preview mock) */}
                      <div style={{
                        width: '100%',
                        height: productImageAspect === 'vertical' ? `${Math.round(productIconSize * 1.4)}px` : `${productIconSize}px`,
                        borderRadius: '10px',
                        border: hideProductBorders ? 'none' : '4px double #80082E',
                        backgroundColor: '#f8fafc',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        position: 'relative'
                      }}>
                        {p.imagen_url ? (
                          <img 
                            src={p.imagen_url} 
                            alt={p.nombre_producto} 
                            style={{ 
                              width: '100%', 
                              height: '100%', 
                              objectFit: productImageFit 
                            }} 
                          />
                        ) : (
                          /* Soft mock placeholder of a clothing model avatar */
                          <div style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#f1f5f9',
                            fontWeight: '800',
                            fontSize: '0.85rem',
                            color: '#94a3b8'
                          }}>
                            <Shirt size={40} style={{ strokeWidth: 1 }} />
                          </div>
                        )}
                      </div>

                      {/* Product descriptive tags and title */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minHeight: '3.6rem', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                          <span style={{ fontSize: '0.55rem', fontWeight: '800', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            REF: {p.codigo_referencia || '-'} {p.categories?.categoria ? `| ${p.categories.categoria}` : ''}
                          </span>
                          <h4 style={{
                            fontSize: catalogColumns >= 7 ? '0.72rem' : '0.825rem',
                            fontWeight: '850',
                            color: '#0f172a',
                            margin: 0,
                            lineHeight: '1.25',
                            whiteSpace: 'normal',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }} title={p.nombre_producto}>
                            {p.nombre_producto}
                          </h4>
                        </div>
                        <span style={{ fontSize: '0.62rem', color: '#94a3b8', fontWeight: '750' }}>Blanca - Algodón</span>
                      </div>

                      {/* Price and aggregate tag bar */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.15rem' }}>
                        <span style={{ fontSize: productPriceFontSize, fontWeight: '955', color: '#80082E', fontFamily: 'monospace' }}>
                          ${getProductPrice(p, selectedPriceListId, priceListItems).toLocaleString('es-CO')}
                        </span>
                        
                        <div style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #80082E 0%, #D81B60 100%)',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 6px rgba(216,27,96,0.3)'
                        }}>
                          <Plus size={14} strokeWidth={3} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            )}

            {/* Shopping Cart & Billing panel view column (Right column) */}
            <div style={{
              width: `${cartWidth}px`,
              backgroundColor: 'white',
              borderLeft: '1px solid #cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
              boxShadow: '-4px 0 15px rgba(0,0,0,0.03)'
            }}>
              {/* Header inside shopping cart panel */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #cbd5e1'
              }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>
                  Carrito de Compra ({cart.length})
                </h3>

                <button
                  onClick={() => { setCart([]); setCartNotes(''); }}
                  style={{
                    backgroundColor: '#fee2e2',
                    color: '#dc2626',
                    border: 'none',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                >
                  Vaciar carrito
                </button>
              </div>

              {/* Items in cart list */}
              <div style={{ flex: 1, padding: '1rem 1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.85rem' }} className="pos-scrollbar">
                {cart.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#94a3b8', gap: '0.5rem' }}>
                    <ShoppingCart size={40} style={{ strokeWidth: 1.2, color: '#cbd5e1' }} />
                    <span style={{ fontSize: '0.78rem' }}>Carrito vacío</span>
                  </div>
                ) : (
                  cart.map((item, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      gap: '0.75rem',
                      alignItems: 'center',
                      paddingBottom: '0.85rem',
                      borderBottom: '1px solid #f1f5f9'
                    }}>
                      {/* Mini Preview model placeholder */}
                      <div style={{ width: `${cartItemImageSize}px`, height: `${cartItemImageSize}px`, borderRadius: '6px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                        {(() => {
                          const prod = products.find(p => p.id === item.id);
                          const imgUrl = prod?.imagen_url || item.imagen_url;
                          return imgUrl ? (
                            <img src={imgUrl} alt={item.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <Shirt size={Math.round(cartItemImageSize * 0.52)} style={{ color: '#cbd5e1' }} />
                          );
                        })()}
                      </div>

                      {/* Detail text metadata */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '855', fontSize: '0.78rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{item.nombre}</div>
                        <div style={{ fontSize: '0.625rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                          REF: {item.codigo_referencia || '0132'} - Talla: {sizes.find(s => s.id === item.size_id)?.codigo_talla || 'M'} - Color: {colors.find(c => c.id === item.color_id)?.nombre_color || 'Blanco'}
                        </div>

                        {/* Quantity Adjuster inline */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem' }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            padding: '0.15rem 0.4rem',
                            backgroundColor: '#f8fafc'
                          }}>
                            <button type="button" onClick={() => handleUpdateQty(idx, -1)} style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#64748b', fontSize: '0.68rem' }}>-</button>
                            <span style={{ fontSize: '0.7rem', fontWeight: '850', color: '#0f172a', minWidth: '12px', textAlign: 'center' }}>{item.cantidad}</span>
                            <button type="button" onClick={() => handleUpdateQty(idx, 1)} style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#0f172a', fontSize: '0.68rem' }}>+</button>
                          </div>
                          
                          {/* Item Trash delete button */}
                          <button onClick={() => {
                            const newCart = [...cart];
                            newCart.splice(idx, 1);
                            setCart(newCart);
                          }} style={{ border: 'none', backgroundColor: 'transparent', color: '#dc2626', cursor: 'pointer', padding: '0.2rem' }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Price tag */}
                      <span style={{ fontSize: '0.85rem', fontWeight: '900', color: '#0f172a', fontFamily: 'monospace' }}>
                        ${(item.precio * item.cantidad).toLocaleString('es-CO')}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Checkout cost adjustments form layout */}
              <div style={{
                padding: '0.65rem 0.85rem',
                borderTop: '1px solid #cbd5e1',
                backgroundColor: '#f8fafc',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem'
              }}>
                {/* Cliente selector card widget */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.45rem',
                  backgroundColor: 'white',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '0.6rem 0.75rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <User size={16} style={{ color: '#80082E', flexShrink: 0 }} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.55rem', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase' }}>CLIENTE</span>
                        <span style={{ fontSize: '0.78rem', fontWeight: '900', color: '#0f172a' }}>{selectedCustomer.name}</span>
                      </div>
                    </div>
                    <button onClick={() => setShowPosClientModal(true)} style={{
                      backgroundColor: '#fff0f3',
                      color: '#80082E',
                      border: 'none',
                      padding: '0.25rem 0.65rem',
                      borderRadius: '6px',
                      fontSize: '0.7rem',
                      fontWeight: '850',
                      cursor: 'pointer'
                    }}>
                      Cambiar
                    </button>
                  </div>

                  {/* Price list selector & rule evaluation badge */}
                  {(() => {
                    const totalCartGarments = cart.reduce((sum, item) => sum + (item.is_return ? 0 : (item.cantidad || 0)), 0);
                    const activePL = priceLists.find(l => l.id === selectedPriceListId);
                    
                    if (!activePL) {
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.35rem', borderTop: '1px dashed #e2e8f0' }}>
                          <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '700' }}>Lista de Precios:</span>
                          <select
                            value={selectedPriceListId}
                            onChange={e => setSelectedPriceListId(e.target.value)}
                            style={{ fontSize: '0.68rem', padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#475569', fontWeight: '750' }}
                          >
                            <option value="">Precio Base Estándar</option>
                            {priceLists.filter(l => l.activo).map(l => (
                              <option key={l.id} value={l.id}>{l.nombre}</option>
                            ))}
                          </select>
                        </div>
                      );
                    }

                    const plRules = parsePriceListRules(activePL);
                    const minQty = plRules.cantidad_minima || 1;
                    const isRuleActive = totalCartGarments >= minQty;
                    const missingGarments = Math.max(0, minQty - totalCartGarments);

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', paddingTop: '0.4rem', borderTop: '1px dashed #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Tag size={13} style={{ color: isRuleActive ? '#10b981' : '#f59e0b' }} />
                            <span style={{ fontSize: '0.7rem', fontWeight: '850', color: '#0f172a' }}>{activePL.nombre}</span>
                          </div>
                          <select
                            value={selectedPriceListId}
                            onChange={e => setSelectedPriceListId(e.target.value)}
                            style={{ fontSize: '0.65rem', padding: '0.15rem 0.35rem', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#475569', fontWeight: '700' }}
                          >
                            <option value="">Precio Base</option>
                            {priceLists.filter(l => l.activo).map(l => (
                              <option key={l.id} value={l.id}>{l.nombre}</option>
                            ))}
                          </select>
                        </div>

                        {/* Visual Rule Feedback Badge */}
                        <div style={{
                          padding: '0.35rem 0.55rem',
                          borderRadius: '6px',
                          backgroundColor: isRuleActive ? '#ecfdf5' : '#fffbeb',
                          border: `1px solid ${isRuleActive ? '#a7f3d0' : '#fde68a'}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.2rem',
                          fontSize: '0.65rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            {isRuleActive ? (
                              <span style={{ color: '#065f46', fontWeight: '850', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                ✓ Regla Activa ({totalCartGarments}/{minQty} prendas): Precios Especiales aplicados
                              </span>
                            ) : (
                              <span style={{ color: '#92400e', fontWeight: '850', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                ⚠️ Mínimo {minQty} prendas (Llevas {totalCartGarments}, faltan {missingGarments} para el descuento)
                              </span>
                            )}
                          </div>

                          {/* Body & Top price indicator badges */}
                          {(() => {
                            const existBody = priceListItems.find(item => item.price_list_id === activePL.id && item.categoria?.toUpperCase() === 'BODY');
                            const existTop = priceListItems.find(item => item.price_list_id === activePL.id && item.categoria?.toUpperCase() === 'TOP');
                            const bodyVal = existBody?.valor_descuento || plRules.body_discount_val;
                            const bodyType = existBody?.tipo_descuento || plRules.body_discount_type || 'precio_fijo';
                            const topVal = existTop?.valor_descuento || plRules.top_discount_val;
                            const topType = existTop?.tipo_descuento || plRules.top_discount_type || 'precio_fijo';

                            if (!bodyVal && !topVal) return null;

                            return (
                              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.15rem' }}>
                                {bodyVal && Number(bodyVal) > 0 ? (
                                  <span style={{ backgroundColor: '#fce7f3', color: '#9d174d', padding: '1px 5px', borderRadius: '4px', fontWeight: '800', fontSize: '0.6rem', border: '1px solid #fbcfe8' }}>
                                    👗 Body: {bodyType === 'precio_fijo' ? `$${Number(bodyVal).toLocaleString('es-CO')}` : bodyType === 'porcentaje' ? `${bodyVal}% OFF` : `-$${Number(bodyVal).toLocaleString('es-CO')}`}
                                  </span>
                                ) : null}
                                {topVal && Number(topVal) > 0 ? (
                                  <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '4px', fontWeight: '800', fontSize: '0.6rem', border: '1px solid #bae6fd' }}>
                                    👚 Top: {topType === 'precio_fijo' ? `$${Number(topVal).toLocaleString('es-CO')}` : topType === 'porcentaje' ? `${topVal}% OFF` : `-$${Number(topVal).toLocaleString('es-CO')}`}
                                  </span>
                                ) : null}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* METODOS DE PAGO buttons segment */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.625rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.35rem', letterSpacing: '0.05em' }}>MÉTODO DE PAGO</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.35rem' }}>
                    {['Efectivo', 'Tarjeta', 'Transferencia', 'Mixto'].map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPaymentMethod(m as any)}
                        style={{
                          padding: '0.45rem 0.15rem',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.7rem',
                          fontWeight: '850',
                          backgroundColor: paymentMethod === m ? '#80082E' : 'white',
                          color: paymentMethod === m ? 'white' : '#64748b',
                          cursor: 'pointer',
                          transition: 'all 0.1s'
                        }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>

                  {/* 📲 CUENTAS Y CÓDIGOS QR DE TRANSFERENCIA (DEBAJO DEL BOTÓN TRANSFERENCIA) */}
                  {paymentMethod === 'Transferencia' && (
                    <div style={{
                      marginTop: '0.65rem',
                      padding: '0.85rem',
                      borderRadius: '12px',
                      backgroundColor: '#f8fafc',
                      border: '1.5px solid #cbd5e1',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: '900', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          📲 Cuentas / Billeteras para Transferir
                        </span>
                        {isPOSAdmin && (
                          <button
                            type="button"
                            onClick={() => { setActiveMenuId('ajustes'); setUxTab('transfer'); }}
                            style={{ fontSize: '0.65rem', color: customPrimary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: '800', textDecoration: 'underline' }}
                          >
                            ⚙️ Parametrizar
                          </button>
                        )}
                      </div>

                      {/* Selector de Cuentas / Bancos */}
                      <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.2rem' }} className="pos-scrollbar">
                        {transferMethods.filter(m => m.activo !== false).map(method => {
                          const isSel = selectedTransferMethodId === method.id;
                          return (
                            <button
                              key={method.id}
                              type="button"
                              onClick={() => setSelectedTransferMethodId(method.id)}
                              style={{
                                padding: '0.35rem 0.65rem',
                                borderRadius: '20px',
                                border: isSel ? `2px solid ${method.color || customPrimary}` : '1px solid #cbd5e1',
                                backgroundColor: isSel ? (method.color || customPrimary) : 'white',
                                color: isSel ? (['#FDDA24', '#ffffff', '#fef08a'].includes(method.color) ? '#0f172a' : 'white') : '#475569',
                                fontSize: '0.68rem',
                                fontWeight: '850',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                whiteSpace: 'nowrap',
                                boxShadow: isSel ? '0 2px 6px rgba(0,0,0,0.1)' : 'none',
                                transition: 'all 0.15s'
                              }}
                            >
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: method.color || '#80082E' }} />
                              {method.banco}
                            </button>
                          );
                        })}
                      </div>

                      {/* Tarjeta con los datos de la cuenta activa */}
                      {(() => {
                        const activeMethod = transferMethods.find(m => m.id === selectedTransferMethodId) || transferMethods.find(m => m.activo !== false);
                        if (!activeMethod) {
                          return (
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', textAlign: 'center', padding: '0.5rem' }}>
                              No hay cuentas de transferencia configuradas.
                            </div>
                          );
                        }

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                            {/* Número de cuenta y botón copiar */}
                            <div style={{
                              background: 'white',
                              borderRadius: '10px',
                              padding: '0.65rem 0.85rem',
                              border: '1px solid #e2e8f0',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <div>
                                <div style={{ fontSize: '0.62rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
                                  {activeMethod.banco} · {activeMethod.tipo_cuenta}
                                </div>
                                <div style={{ fontSize: '0.95rem', fontWeight: '950', color: '#0f172a', fontFamily: 'monospace', letterSpacing: '0.04em' }}>
                                  {activeMethod.numero_cuenta}
                                </div>
                                <div style={{ fontSize: '0.62rem', color: '#64748b' }}>
                                  {activeMethod.titular} {activeMethod.identificacion ? `(${activeMethod.identificacion})` : ''}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleCopyAccount(activeMethod.numero_cuenta, activeMethod.id)}
                                style={{
                                  padding: '0.4rem 0.65rem',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  backgroundColor: copiedAccount === activeMethod.id ? '#dcfce7' : '#f1f5f9',
                                  color: copiedAccount === activeMethod.id ? '#166534' : '#334155',
                                  fontSize: '0.68rem',
                                  fontWeight: '800',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem'
                                }}
                              >
                                {copiedAccount === activeMethod.id ? '✓ Copiado' : '📋 Copiar'}
                              </button>
                            </div>

                            {/* Imagen de QR de pago debajo de la transferencia */}
                            {activeMethod.qr_image_url ? (
                              <div style={{
                                background: 'white',
                                borderRadius: '10px',
                                padding: '0.75rem',
                                border: '1px dashed #cbd5e1',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '0.35rem'
                              }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>
                                  📷 Código QR {activeMethod.banco} para Pago
                                </div>
                                <div 
                                  onClick={() => setZoomQrModalUrl(activeMethod.qr_image_url || null)}
                                  style={{
                                    width: '135px',
                                    height: '135px',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    cursor: 'pointer',
                                    border: '1px solid #e2e8f0',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                                    backgroundColor: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                  title="Haz clic para ampliar en grande"
                                >
                                  <img 
                                    src={activeMethod.qr_image_url} 
                                    alt={`QR ${activeMethod.banco}`} 
                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                                  />
                                </div>
                                <span style={{ fontSize: '0.58rem', color: '#94a3b8' }}>🔍 Clic para ampliar en pantalla completa</span>
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.62rem', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '0.2rem' }}>
                                (Sin imagen QR cargada aún. Puedes subir el QR en Ajustes UX)
                              </div>
                            )}

                            {activeMethod.instrucciones && (
                              <div style={{ fontSize: '0.65rem', color: '#64748b', backgroundColor: '#f1f5f9', padding: '0.35rem 0.55rem', borderRadius: '6px', lineHeight: 1.3 }}>
                                ℹ️ {activeMethod.instrucciones}
                              </div>
                            )}

                            {/* Campo de Código de Aprobación */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <label style={{ fontSize: '0.65rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>
                                Nro. Comprobante / Aprobación (Opcional)
                              </label>
                              <input
                                type="text"
                                placeholder="Ej. #892134 Bancolombia"
                                value={transferReferenceCode}
                                onChange={e => setTransferReferenceCode(e.target.value)}
                                style={{
                                  padding: '0.45rem 0.65rem',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '0.75rem',
                                  outline: 'none',
                                  fontFamily: 'monospace',
                                  backgroundColor: 'white'
                                }}
                              />
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* 🔀 DESGLOSE DE PAGO MIXTO (COMPACTO Y ÁGIL) */}
                  {paymentMethod === 'Mixto' && (() => {
                    const numCash = Number(mixedCashAmount) || 0;
                    const numCard = Number(mixedCardAmount) || 0;
                    const numTransfer = Number(mixedTransferAmount) || 0;
                    const totalPaid = numCash + numCard + numTransfer;
                    const remaining = totalCartPrice - totalPaid;
                    const isExact = remaining === 0 && totalPaid > 0;
                    const isUnder = remaining > 0;
                    const isOver = remaining < 0;
                    const excessNonCash = (numCard + numTransfer) > totalCartPrice;

                    return (
                      <div style={{
                        marginTop: '0.45rem',
                        padding: '0.55rem',
                        borderRadius: '8px',
                        backgroundColor: '#f1f5f9',
                        border: '1.5px solid #cbd5e1',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem'
                      }}>
                        {/* Header con Acciones Rápidas */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            🔀 Desglose Mixto
                          </span>
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button
                              type="button"
                              onClick={() => {
                                const half = Math.round(totalCartPrice / 2);
                                setMixedCashAmount(String(half));
                                setMixedCardAmount(String(totalCartPrice - half));
                                setMixedTransferAmount('');
                              }}
                              style={{
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: 'white',
                                fontSize: '0.6rem',
                                fontWeight: '850',
                                color: customPrimary,
                                cursor: 'pointer'
                              }}
                              title="Dividir 50% Efectivo y 50% Tarjeta"
                            >
                              ⚡ 50/50
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowMixedTransfer(!showMixedTransfer)}
                              style={{
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: showMixedTransfer ? '#fef3c7' : 'white',
                                fontSize: '0.6rem',
                                fontWeight: '850',
                                color: showMixedTransfer ? '#92400e' : '#64748b',
                                cursor: 'pointer'
                              }}
                            >
                              {showMixedTransfer ? '− Transf' : '+ Transf'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMixedCashAmount('');
                                setMixedCardAmount('');
                                setMixedTransferAmount('');
                              }}
                              style={{
                                padding: '0.15rem 0.35rem',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: 'white',
                                fontSize: '0.6rem',
                                fontWeight: '800',
                                color: '#94a3b8',
                                cursor: 'pointer'
                              }}
                              title="Limpiar campos"
                            >
                              ↺
                            </button>
                          </div>
                        </div>

                        {/* Renglón: EFECTIVO */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          backgroundColor: 'white',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          padding: '0.25rem 0.5rem'
                        }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#166534', minWidth: '58px' }}>
                            💵 Efectivo
                          </span>
                          <span style={{ fontSize: '0.75rem', fontWeight: '900', color: '#94a3b8' }}>$</span>
                          <input
                            type="number"
                            placeholder="0"
                            value={mixedCashAmount}
                            onChange={e => setMixedCashAmount(e.target.value)}
                            style={{
                              flex: 1,
                              border: 'none',
                              outline: 'none',
                              fontSize: '0.8rem',
                              fontWeight: '900',
                              fontFamily: 'monospace',
                              color: '#0f172a',
                              minWidth: '45px'
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const rest = Math.max(0, totalCartPrice - numCard - numTransfer);
                              setMixedCashAmount(String(rest));
                            }}
                            style={{
                              fontSize: '0.55rem',
                              color: '#166534',
                              backgroundColor: '#dcfce7',
                              border: 'none',
                              padding: '0.18rem 0.45rem',
                              borderRadius: '4px',
                              fontWeight: '850',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                            title="Asignar el saldo restante a Efectivo"
                          >
                            Resto (${Math.max(0, totalCartPrice - numCard - numTransfer).toLocaleString('es-CO')})
                          </button>
                        </div>

                        {/* Renglón: TARJETA */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          backgroundColor: 'white',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          padding: '0.25rem 0.5rem'
                        }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#1e40af', minWidth: '58px' }}>
                            💳 Tarjeta
                          </span>
                          <span style={{ fontSize: '0.75rem', fontWeight: '900', color: '#94a3b8' }}>$</span>
                          <input
                            type="number"
                            placeholder="0"
                            value={mixedCardAmount}
                            onChange={e => setMixedCardAmount(e.target.value)}
                            style={{
                              flex: 1,
                              border: 'none',
                              outline: 'none',
                              fontSize: '0.8rem',
                              fontWeight: '900',
                              fontFamily: 'monospace',
                              color: '#0f172a',
                              minWidth: '45px'
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const rest = Math.max(0, totalCartPrice - numCash - numTransfer);
                              setMixedCardAmount(String(rest));
                            }}
                            style={{
                              fontSize: '0.55rem',
                              color: '#1e40af',
                              backgroundColor: '#dbeafe',
                              border: 'none',
                              padding: '0.18rem 0.45rem',
                              borderRadius: '4px',
                              fontWeight: '850',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                            title="Asignar el saldo restante a Tarjeta"
                          >
                            Resto (${Math.max(0, totalCartPrice - numCash - numTransfer).toLocaleString('es-CO')})
                          </button>
                        </div>

                        {/* Renglón: TRANSFERENCIA (OPCIONAL) */}
                        {showMixedTransfer && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              backgroundColor: 'white',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              padding: '0.25rem 0.5rem'
                            }}>
                              <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#92400e', minWidth: '58px' }}>
                                📲 Transf.
                              </span>
                              <span style={{ fontSize: '0.75rem', fontWeight: '900', color: '#94a3b8' }}>$</span>
                              <input
                                type="number"
                                placeholder="0"
                                value={mixedTransferAmount}
                                onChange={e => setMixedTransferAmount(e.target.value)}
                                style={{
                                  flex: 1,
                                  border: 'none',
                                  outline: 'none',
                                  fontSize: '0.8rem',
                                  fontWeight: '900',
                                  fontFamily: 'monospace',
                                  color: '#0f172a',
                                  minWidth: '45px'
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const rest = Math.max(0, totalCartPrice - numCash - numCard);
                                  setMixedTransferAmount(String(rest));
                                }}
                                style={{
                                  fontSize: '0.55rem',
                                  color: '#92400e',
                                  backgroundColor: '#fef3c7',
                                  border: 'none',
                                  padding: '0.18rem 0.45rem',
                                  borderRadius: '4px',
                                  fontWeight: '850',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                Resto
                              </button>
                            </div>
                            {numTransfer > 0 && (
                              <div style={{ display: 'flex', gap: '0.25rem', overflowX: 'auto', paddingBottom: '0.1rem' }} className="pos-scrollbar">
                                {transferMethods.filter(m => m.activo !== false).map(method => {
                                  const isSel = selectedTransferMethodId === method.id;
                                  return (
                                    <button
                                      key={method.id}
                                      type="button"
                                      onClick={() => setSelectedTransferMethodId(method.id)}
                                      style={{
                                        padding: '0.15rem 0.4rem',
                                        borderRadius: '12px',
                                        border: isSel ? `2px solid ${method.color || customPrimary}` : '1px solid #cbd5e1',
                                        backgroundColor: isSel ? (method.color || customPrimary) : 'white',
                                        color: isSel ? 'white' : '#475569',
                                        fontSize: '0.58rem',
                                        fontWeight: '850',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      {method.banco}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Indicador de Estado Compacto de 1 línea */}
                        <div style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '5px',
                          backgroundColor: excessNonCash ? '#fef2f2' : isExact ? '#f0fdf4' : isUnder ? '#fffbeb' : '#eff6ff',
                          border: excessNonCash ? '1px solid #fca5a5' : isExact ? '1px solid #86efac' : isUnder ? '1px solid #fde68a' : '1px solid #bfdbfe',
                          fontSize: '0.65rem',
                          fontWeight: '850',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span>Asignado: <strong>${totalPaid.toLocaleString('es-CO')}</strong></span>
                          {excessNonCash ? (
                            <span style={{ color: '#dc2626' }}>⚠️ Excede total</span>
                          ) : isExact ? (
                            <span style={{ color: '#16a34a' }}>✓ Cubierto exacto</span>
                          ) : isUnder ? (
                            <span style={{ color: '#b45309' }}>Faltan <strong>${remaining.toLocaleString('es-CO')}</strong></span>
                          ) : isOver ? (
                            <span style={{ color: '#1d4ed8' }}>Vueltos: <strong>${Math.abs(remaining).toLocaleString('es-CO')}</strong></span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Observaciones a la venta (Compacto) */}
                <input
                  type="text"
                  value={cartNotes}
                  onChange={(e) => setCartNotes(e.target.value)}
                  placeholder="Observaciones / Notas de venta (opcional)..."
                  style={{
                    width: '100%',
                    padding: '0.35rem 0.6rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.72rem',
                    outline: 'none',
                    backgroundColor: 'white'
                  }}
                />

                {/* Subtotals & Taxes breakdown details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.72rem', color: '#64748b', borderTop: '1px solid #cbd5e1', paddingTop: '0.45rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Subtotal (Base Imponible)</span>
                    <span style={{ fontWeight: '750', color: '#0f172a' }}>${(totalCartPrice - ivaAmount).toLocaleString('es-CO')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Descuento {activePromo && `(${activePromo.nombre})`}</span>
                    <span style={{ fontWeight: '750', color: discountAmount > 0 ? '#16a34a' : '#64748b' }}>
                      {discountAmount > 0 ? `-$${discountAmount.toLocaleString('es-CO')}` : '$0'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Impuestos (IVA 19% Incluido)</span>
                    <span style={{ fontWeight: '750', color: '#0f172a' }}>${ivaAmount.toLocaleString('es-CO')}</span>
                  </div>
                </div>

                {/* TOTAL A COBRAR output label */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', borderTop: '1px dashed #cbd5e1', paddingTop: '0.5rem' }}>
                  
                  {/* Destacado Renglón Total a Cobrar */}
                  <div style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                    padding: customTotalPadding, borderRadius: '10px', 
                    background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
                    border: '1px solid #dbeafe', boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                    transition: 'all 0.2s ease'
                  }}>
                    <span style={{ fontSize: customTotalFontSize, fontWeight: customTotalFontWeight as any, color: customTotalColor, letterSpacing: '0.01em' }}>{customTotalLabel}</span>
                    <span style={{ fontSize: customTotalFontSize, fontWeight: customTotalFontWeight as any, color: customTotalColor, letterSpacing: '-0.02em' }}>
                      ${totalCartPrice.toLocaleString('es-CO')}
                    </span>
                  </div>
                  
                  {/* Action Registrar Venta Trigger Button spanning nearly side-to-side */}
                  <button
                    onClick={handleCheckout}
                    disabled={(!currentSession && isOnline) || cart.length === 0}
                    style={{
                      width: '100%',
                      padding: '0.8rem 1.25rem',
                      background: `linear-gradient(90deg, ${customPrimary} 0%, ${customSecondary} 100%)`,
                      color: customButtonText,
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '0.88rem',
                      fontWeight: '900',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.12)',
                      opacity: cart.length === 0 ? 0.6 : 1,
                      transition: 'transform 0.2s, box-shadow 0.2s'
                    }}
                    onMouseEnter={e => { if (cart.length > 0) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)'; } }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)'; }}
                  >
                    <CreditCard size={18} /> Registrar Venta <span style={{ opacity: 0.6, fontSize: '0.7rem', marginLeft: '0.25rem' }}>F2</span> <Lock size={13} style={{ opacity: 0.6, marginLeft: '0.25rem' }} />
                  </button>
                </div>

              </div>
            </div>

          </div>

          {/* Redesigned Footer Shortcut Keys Bar */}
          <div style={{
            height: '42px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #cbd5e1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1rem',
            flexShrink: 0
          }}>
            {[
              { key: 'F1', label: 'Nueva Venta' },
              { key: 'F2', label: 'Buscar Cliente' },
              { key: 'F3', label: 'Descuento' },
              { key: 'F4', label: 'Cotización' },
              { key: 'F5', label: 'Apartado' },
              { key: 'F6', label: 'Devolución' },
              { key: 'F7', label: 'Suspender' },
              { key: 'F8', label: 'Parqueo' },
              { key: 'F9', label: 'Más Opciones' }
            ].map(shortcut => (
              <div key={shortcut.key} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.75rem',
                fontWeight: '750',
                color: '#64748b'
              }}>
                <span style={{
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  padding: '0.1rem 0.35rem',
                  fontSize: '0.625rem',
                  fontWeight: '900',
                  color: '#475569'
                }}>{shortcut.key}</span>
                <span>{shortcut.label}</span>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* MODAL DE SELECCIÓN Y CREACIÓN DE CLIENTE EN POS */}
      {showPosClientModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(4px)' }}>
          <div className="pos-modal" style={{ width: '90%', maxWidth: '650px', backgroundColor: 'white', borderRadius: '16px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900', color: '#0f172a' }}>Seleccionar o Crear Cliente</h3>
              <button onClick={() => { setShowPosClientModal(false); setShowNewCustomerForm(false); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={24} /></button>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <button onClick={() => setShowNewCustomerForm(false)} style={{ flex: 1, padding: '0.6rem', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', backgroundColor: !showNewCustomerForm ? '#80082E' : '#f1f5f9', color: !showNewCustomerForm ? 'white' : '#64748b' }}>Buscar Cliente</button>
              <button onClick={() => { 
                setNewCustName(''); setNewCustDoc(''); setNewCustEmail(''); setNewCustPhone('');
                setNewCustAddress(''); setNewCustCity(''); setNewCustAvatarUrl(''); setNewCustPriceListId('');
                setNewCustTypeDoc('Cedula'); setNewCustTypePerson('Natural');
                setEditingCustomerId(null);
                setShowNewCustomerForm(true); 
              }} style={{ flex: 1, padding: '0.6rem', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', backgroundColor: showNewCustomerForm ? '#80082E' : '#f1f5f9', color: showNewCustomerForm ? 'white' : '#64748b' }}>Nuevo Cliente</button>
            </div>

            {!showNewCustomerForm ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input type="text" placeholder="Buscar cliente por nombre o documento..." value={crmSearch} onChange={e => setCrmSearch(e.target.value)} style={{ padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', width: '100%' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto' }}>
                  {crmCustomers.filter(c => !crmSearch || (c.name || '').toLowerCase().includes(crmSearch.toLowerCase()) || (c.identification || '').includes(crmSearch)).map((c, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1rem', background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {c.avatar_url ? (
                          <img src={c.avatar_url} style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="Avatar" />
                        ) : (
                          <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', color: '#64748b', flexShrink: 0 }}>👤</div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#1e293b' }}>{c.name || 'Sin Nombre'}</span>
                          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{c.tipo_documento}: {c.identification}</span>
                        </div>
                      </div>
                      <button onClick={() => { 
                        setSelectedCustomer({ name: c.name, document: c.identification }); 
                        if (c.price_list_id) setSelectedPriceListId(c.price_list_id);
                        else setSelectedPriceListId('');
                        setShowPosClientModal(false); 
                      }} style={{ padding: '0.35rem 0.75rem', background: '#80082E', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer' }}>
                        Seleccionar
                      </button>
                    </div>
                  ))}
                  {crmCustomers.length === 0 && <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem', fontSize: '0.8rem' }}>No hay clientes registrados.</div>}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <input placeholder="Nombre / Razón Social" value={newCustName} onChange={e => setNewCustName(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }} />
                  <input placeholder="Documento / NIT" value={newCustDoc} disabled={!!editingCustomerId} onChange={e => setNewCustDoc(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', backgroundColor: editingCustomerId ? '#f1f5f9' : 'white' }} />
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <span style={{ fontSize: '0.625rem', color: '#64748b', fontWeight: '700' }}>Tipo de Identificación</span>
                    <select value={newCustTypeDoc} onChange={e => setNewCustTypeDoc(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', backgroundColor: 'white' }}>
                      <option value="Cedula">Cédula de Ciudadanía</option>
                      <option value="Nit">NIT (Empresa)</option>
                      <option value="CedulaExtranjeria">Cédula de Extranjería</option>
                      <option value="Pasaporte">Pasaporte</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <span style={{ fontSize: '0.625rem', color: '#64748b', fontWeight: '700' }}>Tipo de Persona</span>
                    <select value={newCustTypePerson} onChange={e => setNewCustTypePerson(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', backgroundColor: 'white' }}>
                      <option value="Natural">Persona Natural</option>
                      <option value="Juridica">Persona Jurídica</option>
                    </select>
                  </div>

                  <input placeholder="Email corporativo" value={newCustEmail} onChange={e => setNewCustEmail(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }} />
                  <input placeholder="Teléfono celular" value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }} />
                  <input placeholder="Dirección física" value={newCustAddress} onChange={e => setNewCustAddress(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }} />
                  <input placeholder="Ciudad / Municipio" value={newCustCity} onChange={e => setNewCustCity(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }} />
                  
                  <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <span style={{ fontSize: '0.625rem', color: '#64748b', fontWeight: '700' }}>Lista de Precios Asociada</span>
                    <select value={newCustPriceListId} onChange={e => setNewCustPriceListId(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', backgroundColor: 'white' }}>
                      <option value="">Ninguna (Precio Base)</option>
                      {priceLists.map(pl => (
                        <option key={pl.id} value={pl.id}>{pl.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button onClick={async () => {
                    if (!newCustName || !selectedStore) return;
                    try {
                      const payload: any = { 
                        name: newCustName, 
                        identification: newCustDoc, 
                        email: newCustEmail, 
                        phone: newCustPhone,
                        store_id: selectedStore.id,
                        tipo_documento: newCustTypeDoc,
                        tipo_persona: newCustTypePerson,
                        direccion: newCustAddress,
                        ciudad: newCustCity,
                        avatar_url: newCustAvatarUrl,
                        price_list_id: newCustPriceListId || null
                      };
                      if (editingCustomerId) payload.id = editingCustomerId;
                      const { data, error } = await supabase.from('siigo_customers').upsert(payload, { onConflict: 'identification' }).select().single();
                      if (error) throw error;
                      
                      fetchCrmCustomers();
                      
                      // Auto select it for POS!
                      setSelectedCustomer({ name: data.name, document: data.identification }); 
                      if (data.price_list_id) setSelectedPriceListId(data.price_list_id);
                      else setSelectedPriceListId('');
                      
                      setShowPosClientModal(false);
                      setShowNewCustomerForm(false);
                    } catch (err: any) {
                      alert('Error al guardar cliente: ' + err.message);
                    }
                  }} style={{ flex: 1, padding: '0.75rem', background: '#80082E', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer' }}>
                    Guardar y Seleccionar
                  </button>
                  <button onClick={() => setShowNewCustomerForm(false)} style={{ padding: '0.75rem 1.5rem', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer' }}>
                    Atrás
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SELECTOR DE VARIANTES MODAL */}
      {showVariantModal && selectedProductForVariants && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="pos-modal" style={{
            width: '90%',
            maxWidth: '500px',
            padding: '2.5rem',
            background: 'var(--surface, #ffffff)',
            border: '1px solid var(--border, #cbd5e1)',
            borderRadius: '20px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: '900', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: customPrimary }}><Shirt size={22} /> Escoger Variante</h3>
              <button onClick={() => setShowVariantModal(false)} style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                El producto <strong>{selectedProductForVariants.nombre_producto}</strong> tiene varias combinaciones de talla y color en esta tienda. Selecciona la que deseas vender:
              </p>

              <div style={{ position: 'relative', width: '100%' }}>
                 <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                 <input
                   type="text"
                   autoFocus
                   placeholder="Buscar por color o talla..."
                   value={variantSearch}
                   onChange={(e) => setVariantSearch(e.target.value)}
                   style={{ padding: '0.6rem 1rem 0.6rem 2.25rem', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '0.85rem', width: '100%', outline: 'none' }}
                 />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                {productVariants.filter(inv => {
                  if (!variantSearch) return true;
                  const searchUpper = variantSearch.toUpperCase();
                  const cName = (inv.colors?.nombre_color || '').toUpperCase();
                  const sCode = (inv.sizes?.codigo_talla || '').toUpperCase();
                  return cName.includes(searchUpper) || sCode.includes(searchUpper);
                }).map((inv, idx) => {
                  const cName = inv.colors?.nombre_color || '(Sin color)';
                  const sCode = inv.sizes?.codigo_talla || '(Sin talla)';
                  return (
                    <button 
                      key={idx}
                      onClick={() => {
                        doAddToCart(selectedProductForVariants, inv.color_id, inv.size_id);
                        setShowVariantModal(false);
                      }}
                      style={{
                        padding: '1rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#f8fafc',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <div>
                        <span style={{ display: 'block', fontWeight: '800', color: '#0f172a', fontSize: '0.9rem' }}>Color: {cName}</span>
                        <span style={{ display: 'block', color: '#64748b', fontSize: '0.8rem', marginTop: '0.2rem' }}>Talla: {sCode}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ display: 'block', fontWeight: '900', color: '#10b981', fontSize: '0.95rem' }}>Stock: {inv.cantidad_disponible}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POS EXCHANGE & RETURN MODAL */}
      <POSExchangeModal
        isOpen={showExchangeModal || showReturnModal}
        onClose={() => {
          setShowExchangeModal(false);
          setShowReturnModal(false);
        }}
        currentStore={selectedStore}
        currentSession={currentSession}
        currentUser={user}
        userProfile={profile}
        products={products}
        colors={colors}
        sizes={sizes}
        inventoryList={inventoryList}
        deductStockFn={deductStockForSaleItem}
        onExchangeCompleted={() => {
          if (currentSession) {
            fetchSessionSalesTotal(currentSession.id);
            fetchSessionSalesDetails(currentSession.id);
          }
          fetchInlineInventory();
          fetchInlineSales();
        }}
      />

      {/* POS WAREHOUSE STOCK LOOKUP MODAL */}
      <POSWarehouseStockModal
        isOpen={showWarehouseStockModal}
        onClose={() => setShowWarehouseStockModal(false)}
        currentStore={selectedStore}
        products={products}
        colors={colors}
        sizes={sizes}
        onAddToCart={(prod, colId, szId) => doAddToCart(prod, colId, szId)}
        onOpenTransfers={() => setActiveMenuId('traslados')}
      />

      {/* OPEN CASH SESSION MODAL */}
      {showOpenSessionModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="pos-modal" style={{
            width: '90%',
            maxWidth: '420px',
            padding: '2.5rem',
            background: 'var(--surface, #ffffff)',
            border: '1px solid var(--border, #cbd5e1)',
            borderRadius: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: '900', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: customPrimary }}><Unlock size={22} /> Apertura de Turno</h3>
              <button type="button" onClick={() => setShowOpenSessionModal(false)} style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleOpenSession} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {sessionError && (
                <div style={{ padding: '0.85rem 1rem', borderRadius: '10px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: '0.78rem', fontWeight: '800', lineHeight: 1.4 }}>
                  ⚠️ {sessionError}
                </div>
              )}
              {hasActiveShift === false && profile?.roles?.name !== 'admin_store' && profile?.roles?.name !== 'admin' ? (
                <div style={{ padding: '1rem', borderRadius: '12px', background: '#fffbeb', border: '1px dashed #fef3c7', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#b45309', fontWeight: '800', fontSize: '0.82rem' }}>
                    <AlertCircle size={16} /> TURNO NO PROGRAMADO
                  </div>
                  <p style={{ fontSize: '0.74rem', color: '#b45309', margin: 0, lineHeight: 1.4 }}>
                    Aviso: No tienes un turno programado para hoy en esta sucursal, pero puedes abrir caja y trabajar normalmente.
                  </p>
                </div>
              ) : (
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                  Declara la base inicial de efectivo en caja para comenzar a registrar transacciones.
                </p>
              )}
              
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>Base Inicial en Efectivo ($)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={openingCash}
                  onChange={e => setOpeningCash(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.85rem 1rem',
                    borderRadius: '10px',
                    background: 'var(--surface, #ffffff)',
                    border: '1px solid var(--border, #cbd5e1)',
                    color: '#0f172a',
                    fontSize: '0.9rem',
                    outline: 'none',
                    opacity: 1
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  background: `linear-gradient(90deg, ${customPrimary} 0%, ${customSecondary} 100%)`,
                  border: 'none',
                  borderRadius: '10px',
                  color: 'white',
                  fontWeight: '800',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(216,27,96,0.3)'
                }}
              >
                Abrir Caja
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CLOSE CASH SESSION MODAL */}
      {showCloseSessionModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="pos-modal" style={{
            width: '90%',
            maxWidth: '420px',
            padding: '2.5rem',
            background: 'var(--surface, #ffffff)',
            border: '1px solid var(--border, #cbd5e1)',
            borderRadius: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: '900', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#dc2626' }}><Lock size={22} /> Cerrar Caja y Arqueo</h3>
              <button type="button" onClick={() => setShowCloseSessionModal(false)} style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleCloseSession} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                Declara el efectivo total que contaste físicamente en caja para realizar el arqueo contra el sistema.
              </p>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>Efectivo Físico Contado ($)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={closingCashReal}
                  onChange={e => setClosingCashReal(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.85rem 1rem',
                    borderRadius: '10px',
                    background: 'var(--surface, #ffffff)',
                    border: '1px solid var(--border, #cbd5e1)',
                    color: '#0f172a',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  backgroundColor: '#dc2626',
                  border: 'none',
                  borderRadius: '10px',
                  color: 'white',
                  fontWeight: '800',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.2)'
                }}
              >
                Cerrar Caja
              </button>
            </form>
          </div>
        </div>
      )}

      {/* WHATSAPP STYLE REALTIME CHAT DRAWER */}
      {showChatModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', display: 'flex', justifyContent: 'flex-end', zIndex: 1100, backdropFilter: 'blur(3px)' }} onClick={() => setShowChatModal(false)}>
          <div style={{
            width: '100%',
            maxWidth: '380px',
            height: '100%',
            background: '#efeae2', /* Classic WhatsApp Chat BG */
            boxShadow: '-10px 0 30px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative'
          }} onClick={e => e.stopPropagation()}>
            
            {/* Header */}
            <div style={{
              padding: '1rem 1.25rem',
              background: customPrimary,
              color: customButtonText,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 8px rgba(0,0,0,0.06)',
              zIndex: 10
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', overflow: 'hidden' }}>
                  <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=128&auto=format&fit=crop" alt="Admin" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: '900' }}>Administrador ERP</span>
                  <span style={{ fontSize: '0.65rem', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e' }} /> En línea
                  </span>
                </div>
              </div>
              <button onClick={() => setShowChatModal(false)} style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: customButtonText }}><X size={20} /></button>
            </div>

            {/* Messages Body */}
            <div style={{
              flex: 1,
              padding: '1.25rem',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              background: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png") repeat'
            }} className="pos-scrollbar">
              <div style={{ alignSelf: 'center', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(4px)', padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.625rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                Mensajería con Oficina Central
              </div>

              {chatMessages.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#64748b', gap: '0.5rem', padding: '2rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem' }}>💬</div>
                  <span style={{ fontSize: '0.78rem', fontWeight: '700' }}>¡Sin mensajes aún!</span>
                  <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>Escribe un mensaje abajo para comunicarte con administración.</span>
                </div>
              ) : (
                chatMessages.map((msg, i) => {
                  const isAdmin = msg.sender_role === 'admin';
                  return (
                    <div key={i} style={{
                      alignSelf: isAdmin ? 'flex-start' : 'flex-end',
                      maxWidth: '85%',
                      backgroundColor: isAdmin ? '#ffffff' : '#d9fdd3', /* WhatsApp classic colors */
                      color: '#0f172a',
                      padding: '0.5rem 0.75rem',
                      borderRadius: isAdmin ? '0px 10px 10px 10px' : '10px 0px 10px 10px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.15rem'
                    }}>
                      <span style={{ fontSize: '0.6rem', fontWeight: '900', color: isAdmin ? customPrimary : '#16a34a' }}>{msg.sender_name}</span>
                      <span style={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap', lineHeight: '1.3' }}>{msg.message}</span>
                      <span style={{ fontSize: '0.55rem', color: '#94a3b8', alignSelf: 'flex-end', fontFamily: 'monospace', marginTop: '0.15rem' }}>
                        {new Date(msg.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input Bar */}
            <div style={{
              padding: '0.75rem 1rem',
              backgroundColor: '#f0f2f5',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              borderTop: '1px solid #e9edef'
            }}>
              <input
                type="text"
                placeholder="Escribe un mensaje..."
                value={chatInputValue}
                onChange={e => setChatInputValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSendChatMessage(); }}
                style={{
                  flex: 1,
                  padding: '0.65rem 1rem',
                  borderRadius: '20px',
                  border: 'none',
                  background: 'white',
                  color: '#0f172a',
                  fontSize: '0.82rem',
                  outline: 'none'
                }}
              />
              <button
                onClick={handleSendChatMessage}
                disabled={sendingMessage || !chatInputValue.trim()}
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: sendingMessage || !chatInputValue.trim() ? '#cbd5e1' : customPrimary,
                  color: customButtonText,
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                }}
              >
                {sendingMessage ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z" />
                  </svg>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* GLOBAL ALERTS/ANUNCIOS MODAL */}
      {showAlertsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, backdropFilter: 'blur(4px)' }}>
          <div style={{
            width: '90%',
            maxWidth: '500px',
            padding: '2rem',
            background: 'white',
            border: '1px solid #cbd5e1',
            borderRadius: '24px',
            boxShadow: '0 20px 45px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: '900', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a' }}>
                🔔 Comunicados y Alertas Oficiales
              </h3>
              <button onClick={() => setShowAlertsModal(false)} style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '0.25rem' }} className="pos-scrollbar">
              {alerts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '0.85rem' }}>
                  No hay comunicados formales de administración en este momento.
                </div>
              ) : (
                alerts.map((item, idx) => {
                  const isHigh = item.criticidad === 'Alta';
                  const isMed = item.criticidad === 'Media';
                  return (
                    <div
                      key={item.id || idx}
                      style={{
                        padding: '1rem',
                        borderRadius: '12px',
                        borderLeft: `5px solid ${isHigh ? '#ef4444' : isMed ? '#f59e0b' : '#3b82f6'}`,
                        backgroundColor: isHigh ? '#fef2f2' : isMed ? '#fffbeb' : '#eff6ff',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.625rem', fontWeight: '900', textTransform: 'uppercase', color: isHigh ? '#b91c1c' : isMed ? '#b45309' : '#1d4ed8' }}>
                          Prioridad {item.criticidad}
                        </span>
                        <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                          {new Date(item.created_at).toLocaleDateString('es-CO')}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.85rem', fontWeight: '850', color: '#1e293b' }}>{item.cod_novedad}</span>
                      <p style={{ fontSize: '0.78rem', color: '#475569', margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{item.nombre}</p>
                    </div>
                  );
                })
              )}
            </div>

            <button
              onClick={() => setShowAlertsModal(false)}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: customPrimary,
                color: customButtonText,
                border: 'none',
                borderRadius: '10px',
                fontWeight: '800',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              Cerrar Bandeja
            </button>
          </div>
        </div>
      )}

      {/* 🔍 MODAL DE ZOOM / AMPLIACIÓN DE CÓDIGO QR */}
      {zoomQrModalUrl && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, backdropFilter: 'blur(5px)' }} onClick={() => setZoomQrModalUrl(null)}>
          <div style={{
            width: '90%',
            maxWidth: '380px',
            backgroundColor: 'white',
            borderRadius: '24px',
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
            position: 'relative'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.4rem' }}>📱</span>
                <span style={{ fontSize: '0.95rem', fontWeight: '900', color: '#0f172a' }}>Escanear Código QR</span>
              </div>
              <button onClick={() => setZoomQrModalUrl(null)} style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>

            <div style={{ width: '260px', height: '260px', borderRadius: '16px', overflow: 'hidden', border: '2px solid #e2e8f0', padding: '0.5rem', backgroundColor: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
              <img src={zoomQrModalUrl} alt="QR Zoom" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>

            <p style={{ fontSize: '0.78rem', color: '#64748b', textAlign: 'center', margin: 0, lineHeight: 1.4 }}>
              Abre la cámara o app bancaria en tu teléfono móvil y apunta al código QR para transferir.
            </p>

            <button
              onClick={() => setZoomQrModalUrl(null)}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: customPrimary,
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontWeight: '800',
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              Listo / Cerrar
            </button>
          </div>
        </div>
      )}

      {/* 📊 MODAL DE HISTORIAL Y TRANSACCIONES DEL TURNO ACTIVO */}
      {showSessionTransactionsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, backdropFilter: 'blur(4px)' }}>
          <div style={{
            width: '92%',
            maxWidth: '850px',
            backgroundColor: 'white',
            borderRadius: '20px',
            padding: '1.75rem',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            boxShadow: '0 25px 60px rgba(0,0,0,0.2)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.85rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.4rem' }}>📊</span>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', color: '#0f172a' }}>
                    Resumen y Transacciones del Turno Activo
                  </h3>
                  <span style={{ padding: '0.2rem 0.6rem', borderRadius: '20px', backgroundColor: '#dcfce7', color: '#166534', fontSize: '0.68rem', fontWeight: '900' }}>
                    🟢 EN CURSO
                  </span>
                </div>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                  Caja: <strong>{selectedRegister?.codigo_caja || 'Caja Principal'}</strong> · Cajero: <strong>{currentSession?.usuario_apertura || 'Cajero'}</strong> · Apertura: <strong>{currentSession ? new Date(currentSession.fecha_apertura).toLocaleString('es-CO') : '—'}</strong>
                </p>
              </div>
              <button onClick={() => setShowSessionTransactionsModal(false)} style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#64748b' }}><X size={22} /></button>
            </div>

            {/* KPI Cards Grid */}
            {(() => {
              const cashSales = sessionSalesDetails.reduce((sum, s) => {
                const pays = s.pos_payments?.filter((pay: any) => pay.metodo_pago === 'Efectivo') || [];
                return sum + pays.reduce((acc: number, p: any) => acc + Number(p.monto || 0), 0);
              }, 0);
              const cardSales = sessionSalesDetails.reduce((sum, s) => {
                const pays = s.pos_payments?.filter((pay: any) => pay.metodo_pago === 'Tarjeta' || pay.metodo_pago === 'Datafono') || [];
                return sum + pays.reduce((acc: number, p: any) => acc + Number(p.monto || 0), 0);
              }, 0);
              const transferSales = sessionSalesDetails.reduce((sum, s) => {
                const pays = s.pos_payments?.filter((pay: any) => pay.metodo_pago?.toLowerCase().includes('transferencia')) || [];
                return sum + pays.reduce((acc: number, p: any) => acc + Number(p.monto || 0), 0);
              }, 0);
              const mixedCount = sessionSalesDetails.filter((s: any) => (s.pos_payments && s.pos_payments.length > 1) || s.observaciones?.includes('Pago Mixto')).length;
              const totalVendido = sessionSalesDetails.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
              const totalCajaEfectivo = Number(currentSession?.monto_apertura || 0) + cashSales;

              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.65rem' }}>
                  <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase' }}>Base Apertura</div>
                    <div style={{ fontSize: '1rem', fontWeight: '950', color: '#0f172a', fontFamily: 'monospace', marginTop: '0.2rem' }}>
                      ${Number(currentSession?.monto_apertura || 0).toLocaleString('es-CO')}
                    </div>
                  </div>

                  <div style={{ background: '#ecfdf5', padding: '0.75rem', borderRadius: '10px', border: '1px solid #a7f3d0' }}>
                    <div style={{ fontSize: '0.6rem', color: '#047857', fontWeight: '800', textTransform: 'uppercase' }}>Total Facturado</div>
                    <div style={{ fontSize: '1rem', fontWeight: '950', color: '#065f46', fontFamily: 'monospace', marginTop: '0.2rem' }}>
                      ${totalVendido.toLocaleString('es-CO')}
                    </div>
                    <div style={{ fontSize: '0.58rem', color: '#059669', marginTop: '0.1rem' }}>{sessionSalesDetails.length} transacciones {mixedCount > 0 ? `(${mixedCount} mixtas)` : ''}</div>
                  </div>

                  <div style={{ background: '#eff6ff', padding: '0.75rem', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                    <div style={{ fontSize: '0.6rem', color: '#1d4ed8', fontWeight: '800', textTransform: 'uppercase' }}>Efectivo en Caja</div>
                    <div style={{ fontSize: '1rem', fontWeight: '950', color: '#1e40af', fontFamily: 'monospace', marginTop: '0.2rem' }}>
                      ${totalCajaEfectivo.toLocaleString('es-CO')}
                    </div>
                    <div style={{ fontSize: '0.58rem', color: '#3b82f6', marginTop: '0.1rem' }}>Ventas: ${cashSales.toLocaleString('es-CO')}</div>
                  </div>

                  <div style={{ background: '#fef3c7', padding: '0.75rem', borderRadius: '10px', border: '1px solid #fde68a' }}>
                    <div style={{ fontSize: '0.6rem', color: '#b45309', fontWeight: '800', textTransform: 'uppercase' }}>Transferencias</div>
                    <div style={{ fontSize: '1rem', fontWeight: '950', color: '#92400e', fontFamily: 'monospace', marginTop: '0.2rem' }}>
                      ${transferSales.toLocaleString('es-CO')}
                    </div>
                  </div>

                  <div style={{ background: '#f5f3ff', padding: '0.75rem', borderRadius: '10px', border: '1px solid #ddd6fe' }}>
                    <div style={{ fontSize: '0.6rem', color: '#6d28d9', fontWeight: '800', textTransform: 'uppercase' }}>Tarjetas</div>
                    <div style={{ fontSize: '1rem', fontWeight: '950', color: '#5b21b6', fontFamily: 'monospace', marginTop: '0.2rem' }}>
                      ${cardSales.toLocaleString('es-CO')}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Transactions Table */}
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: '380px', border: '1px solid #e2e8f0', borderRadius: '12px' }} className="pos-scrollbar">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1', position: 'sticky', top: 0, zIndex: 5 }}>
                    <th style={{ padding: '0.65rem 0.85rem', color: '#475569', fontWeight: '900' }}># Ticket</th>
                    <th style={{ padding: '0.65rem 0.85rem', color: '#475569', fontWeight: '900' }}>Hora</th>
                    <th style={{ padding: '0.65rem 0.85rem', color: '#475569', fontWeight: '900' }}>Cliente</th>
                    <th style={{ padding: '0.65rem 0.85rem', color: '#475569', fontWeight: '900' }}>Método de Pago</th>
                    <th style={{ padding: '0.65rem 0.85rem', color: '#475569', fontWeight: '900' }}>Detalle / Ref</th>
                    <th style={{ padding: '0.65rem 0.85rem', color: '#475569', fontWeight: '900', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionSalesDetails.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                        No se han registrado ventas aún en este turno de caja.
                      </td>
                    </tr>
                  ) : (
                    sessionSalesDetails.map((sale, idx) => {
                      const isMixed = (sale.pos_payments && sale.pos_payments.length > 1) || sale.observaciones?.includes('Pago Mixto');
                      const pay = sale.pos_payments?.[0];
                      const payMethod = isMixed ? 'Mixto' : (pay?.metodo_pago || 'Efectivo');
                      const isTransfer = payMethod.toLowerCase().includes('transferencia');
                      const isCard = payMethod.toLowerCase().includes('tarjeta');

                      return (
                        <tr key={sale.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.65rem 0.85rem', fontWeight: '900', color: '#0f172a', fontFamily: 'monospace' }}>
                            #{(selectedStore?.nombre || 'POS').substring(0, 3).toUpperCase()}-{String(sale.consecutive).padStart(4, '0')}
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', color: '#64748b' }}>
                            {new Date(sale.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <span style={{ fontWeight: '800', color: '#1e293b', display: 'block' }}>{sale.client_name || 'Cliente General'}</span>
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{sale.client_document}</span>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem' }}>
                            <span style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.65rem',
                              fontWeight: '900',
                              backgroundColor: isMixed ? '#f3e8ff' : isTransfer ? '#fef3c7' : isCard ? '#eff6ff' : '#ecfdf5',
                              color: isMixed ? '#7e22ce' : isTransfer ? '#92400e' : isCard ? '#1e40af' : '#065f46'
                            }}>
                              {isMixed ? '🔀 Mixto' : payMethod}
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', fontSize: '0.7rem', color: '#64748b', maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={sale.observaciones || ''}>
                            {sale.observaciones || (sale.pos_payments && sale.pos_payments.length > 1 ? sale.pos_payments.map((p: any) => `${p.metodo_pago}: $${Number(p.monto).toLocaleString('es-CO')}`).join(' + ') : `${sale.items?.length || 1} prenda(s)`)}
                          </td>
                          <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: '950', color: '#0f172a', fontFamily: 'monospace' }}>
                            ${Number(sale.total || 0).toLocaleString('es-CO')}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  fetchSessionSalesDetails(currentSession.id);
                  alert('✓ Transacciones sincronizadas con el servidor.');
                }}
                style={{
                  padding: '0.6rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  color: '#475569',
                  fontSize: '0.75rem',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                🔄 Actualizar Datos
              </button>

              <button
                type="button"
                onClick={() => setShowSessionTransactionsModal(false)}
                style={{
                  padding: '0.6rem 1.5rem',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: customPrimary,
                  color: 'white',
                  fontSize: '0.78rem',
                  fontWeight: '850',
                  cursor: 'pointer'
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thermal Receipt Modal (Optional Print on demand) */}
      <POSReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        receiptData={lastReceiptData}
        primaryColor={customPrimary}
      />

      {/* Cash Movement (Ingresos / Egresos de Caja) Modal */}
      {currentSession && (
        <POSCashMovementModal
          isOpen={showCashMovementModal}
          onClose={() => setShowCashMovementModal(false)}
          sessionId={currentSession.id}
          sessionUser={profile?.full_name || user?.email || 'Cajero'}
          storeId={selectedStore?.id || ''}
          registerId={selectedRegister?.id || ''}
          primaryColor={customPrimary}
          secondaryColor={customSecondary}
          concepts={cashConcepts}
          onMovementSaved={() => {
            if (currentSession) {
              fetchSessionSalesTotal(currentSession.id);
              fetchSessionSalesDetails(currentSession.id);
            }
          }}
        />
      )}
    </div>
  );
}

