'use client';

import React, { useState, useEffect } from 'react';
import { 
  DollarSign, FileText, Activity, RefreshCw, Send, CheckCircle2, 
  XCircle, AlertTriangle, Eye, Download, Code, Play, Check, 
  ChevronRight, Search, Building2, User, CreditCard, Sparkles, Loader2
} from 'lucide-react';

export default function AlegraBillingModule({ isSuperAdmin = true }: { isSuperAdmin?: boolean }) {
  // Navigation Subtabs
  const [activeTab, setActiveTab] = useState<'invoices' | 'emit' | 'tester' | 'company'>('invoices');

  // Data states
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState<boolean>(false);
  const [invoicesPagination, setInvoicesPagination] = useState<{ total: number; start: number; limit: number }>({ total: 0, start: 0, limit: 15 });
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  // Company info state
  const [companyInfo, setCompanyInfo] = useState<any | null>(null);
  const [loadingCompany, setLoadingCompany] = useState<boolean>(false);

  // Invoice emission form state
  const [emitClientName, setEmitClientName] = useState('Consumidor Final');
  const [emitClientDoc, setEmitClientDoc] = useState('222222222222');
  const [emitClientEmail, setEmitClientEmail] = useState('febrainershop@gmail.com');
  const [emitDate, setEmitDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }));
  const [emitDueDate, setEmitDueDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }));
  const [emitItemName, setEmitItemName] = useState('Prenda Confecciones Breiner');
  const [emitItemPrice, setEmitItemPrice] = useState('50000');
  const [emitItemQty, setEmitItemQty] = useState('1');
  const [emitAutoStamp, setEmitAutoStamp] = useState(true);
  const [emitting, setEmitting] = useState(false);
  const [emitResult, setEmitResult] = useState<any | null>(null);

  // API Live Tester state (SuperAdmin request & response inspector)
  const [testMethod, setTestMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('GET');
  const [testEndpoint, setTestEndpoint] = useState('/invoices?limit=5');
  const [testPayload, setTestPayload] = useState('{\n  "limit": 5\n}');
  const [testing, setTesting] = useState(false);
  const [testExecutionResult, setTestExecutionResult] = useState<{
    status?: number;
    responseTimeMs?: number;
    request?: any;
    response?: any;
    error?: string;
  } | null>(null);

  // Load Invoices
  const fetchInvoices = async (start = 0) => {
    try {
      setLoadingInvoices(true);
      const res = await fetch(`/api/alegra/invoices?start=${start}&limit=15&order_direction=DESC`);
      const json = await res.json();
      if (json.success && json.data) {
        const list = Array.isArray(json.data) ? json.data : (json.data.data || []);
        const total = json.data.metadata?.total || list.length;
        setInvoices(list);
        setInvoicesPagination({ total, start, limit: 15 });
      }
    } catch (e) {
      console.error('Error fetching Alegra invoices:', e);
    } finally {
      setLoadingInvoices(false);
    }
  };

  // Load Company Info
  const fetchCompany = async () => {
    try {
      setLoadingCompany(true);
      const res = await fetch('/api/alegra/company');
      const json = await res.json();
      if (json.success && json.company) {
        setCompanyInfo(json.company);
      }
    } catch (e) {
      console.error('Error loading Alegra company:', e);
    } finally {
      setLoadingCompany(false);
    }
  };

  useEffect(() => {
    fetchInvoices(0);
    fetchCompany();
  }, []);

  // Execute Live API Request
  const handleExecuteApiTest = async () => {
    try {
      setTesting(true);
      setTestExecutionResult(null);

      let parsedPayload: any = null;
      if (testMethod === 'POST' || testMethod === 'PUT') {
        try {
          parsedPayload = JSON.parse(testPayload);
        } catch {
          alert('El cuerpo JSON de la petición tiene un formato inválido.');
          setTesting(false);
          return;
        }
      }

      const res = await fetch('/api/alegra/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: testMethod,
          endpoint: testEndpoint,
          payload: parsedPayload
        })
      });

      const json = await res.json();
      setTestExecutionResult(json);
    } catch (e: any) {
      setTestExecutionResult({
        status: 500,
        error: e.message || String(e)
      });
    } finally {
      setTesting(false);
    }
  };

  // Quick Preset Test loader
  const loadPresetTest = (preset: 'get_invoices' | 'get_company' | 'get_contacts' | 'get_items' | 'get_templates') => {
    if (preset === 'get_invoices') {
      setTestMethod('GET');
      setTestEndpoint('/invoices?limit=5');
      setTestPayload('{}');
    } else if (preset === 'get_company') {
      setTestMethod('GET');
      setTestEndpoint('/company');
      setTestPayload('{}');
    } else if (preset === 'get_contacts') {
      setTestMethod('GET');
      setTestEndpoint('/contacts?type=client&limit=5');
      setTestPayload('{}');
    } else if (preset === 'get_items') {
      setTestMethod('GET');
      setTestEndpoint('/items?limit=5');
      setTestPayload('{}');
    } else if (preset === 'get_templates') {
      setTestMethod('GET');
      setTestEndpoint('/number-templates');
      setTestPayload('{}');
    }
  };

  // Emit Electronic Invoice
  const handleEmitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setEmitting(true);
      setEmitResult(null);

      const priceNum = Number(emitItemPrice) || 0;
      const qtyNum = Number(emitItemQty) || 1;

      // Construct standard Alegra Colombia invoice payload
      const invoicePayload = {
        date: emitDate,
        dueDate: emitDueDate,
        client: {
          name: emitClientName.trim(),
          identification: emitClientDoc.trim(),
          email: emitClientEmail.trim()
        },
        items: [
          {
            name: emitItemName.trim(),
            price: priceNum,
            quantity: qtyNum
          }
        ],
        paymentForm: 'CASH',
        paymentMethod: 'CASH',
        anotation: 'Factura emitida automáticamente desde módulo financiero ERP Breiner'
      };

      const res = await fetch('/api/alegra/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice: invoicePayload,
          autoStamp: emitAutoStamp
        })
      });

      const json = await res.json();
      setEmitResult(json);

      if (json.success) {
        fetchInvoices(0);
      }
    } catch (err: any) {
      setEmitResult({
        success: false,
        error: err.message || String(err)
      });
    } finally {
      setEmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* 1. Header Banner & Account Status */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '18px',
        border: '1px solid #e2e8f0',
        padding: '1.5rem',
        boxShadow: '0 4px 14px rgba(0,0,0,0.02)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: '#0284c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: '950',
            fontSize: '1.4rem',
            boxShadow: '0 4px 10px rgba(2, 132, 199, 0.3)'
          }}>
            A
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '950', color: '#0f172a', margin: 0 }}>
                Facturación Electrónica ALEGRA
              </h2>
              <span style={{
                backgroundColor: '#dcfce7',
                color: '#15803d',
                padding: '0.2rem 0.6rem',
                borderRadius: '6px',
                fontSize: '0.68rem',
                fontWeight: '900',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}>
                <CheckCircle2 size={12} /> CONECTADO
              </span>
            </div>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
              Cuenta: <strong>{companyInfo?.name || 'BRAINER SHOP S.A.S.'}</strong> · NIT: <strong>{companyInfo?.identification || '901636406'}</strong> (febrainershop@gmail.com)
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          backgroundColor: '#f1f5f9',
          padding: '0.3rem',
          borderRadius: '12px',
          gap: '0.35rem'
        }}>
          <button
            onClick={() => setActiveTab('invoices')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              fontWeight: '900',
              fontSize: '0.75rem',
              backgroundColor: activeTab === 'invoices' ? '#ffffff' : 'transparent',
              color: activeTab === 'invoices' ? '#0284c7' : '#64748b',
              boxShadow: activeTab === 'invoices' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              cursor: 'pointer'
            }}
          >
            📋 Facturas Emitidas ({invoices.length})
          </button>

          <button
            onClick={() => setActiveTab('emit')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              fontWeight: '900',
              fontSize: '0.75rem',
              backgroundColor: activeTab === 'emit' ? '#ffffff' : 'transparent',
              color: activeTab === 'emit' ? '#0284c7' : '#64748b',
              boxShadow: activeTab === 'emit' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              cursor: 'pointer'
            }}
          >
            ⚡ Emitir Nueva Factura
          </button>

          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab('tester')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: 'none',
                fontWeight: '900',
                fontSize: '0.75rem',
                backgroundColor: activeTab === 'tester' ? '#0f172a' : 'transparent',
                color: activeTab === 'tester' ? '#38bdf8' : '#64748b',
                boxShadow: activeTab === 'tester' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <Code size={13} /> Consola API (Petición & Respuesta)
            </button>
          )}

          <button
            onClick={() => setActiveTab('company')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              fontWeight: '900',
              fontSize: '0.75rem',
              backgroundColor: activeTab === 'company' ? '#ffffff' : 'transparent',
              color: activeTab === 'company' ? '#0284c7' : '#64748b',
              boxShadow: activeTab === 'company' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              cursor: 'pointer'
            }}
          >
            🏢 Perfil Empresa
          </button>
        </div>
      </div>

      {/* 2. TAB CONTENT: INVOICES LIST */}
      {activeTab === 'invoices' && (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '18px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 14px rgba(0,0,0,0.02)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Header toolbar */}
          <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '950', color: '#0f172a' }}>
                Historial de Facturas en Alegra
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Total registradas: <strong>{invoicesPagination.total}</strong> comprobantes electrónicos
              </span>
            </div>
            <button
              onClick={() => fetchInvoices(0)}
              disabled={loadingInvoices}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: 'white',
                color: '#334155',
                fontSize: '0.75rem',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: loadingInvoices ? 'not-allowed' : 'pointer'
              }}
            >
              {loadingInvoices ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Actualizar Lista
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #0284c7', color: '#475569', textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: '950' }}>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'left' }}># Factura</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'left' }}>Fecha</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'left' }}>Cliente</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'left' }}>Documento</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Subtotal</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>IVA</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Total</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Estado DIAN</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const numStr = inv.numberTemplate?.fullNumber || inv.id;
                  const isStamped = inv.stamp?.legalStatus?.includes('STAMPED') || inv.stamp?.cufe;
                  const clientName = inv.client?.name || 'Cliente';
                  const clientDoc = inv.client?.identification || '-';

                  return (
                    <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: '950', color: '#0284c7' }}>
                        {numStr}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#64748b' }}>
                        {inv.date || '-'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: '800', color: '#0f172a' }}>
                        {clientName}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', color: '#475569' }}>
                        {clientDoc}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#475569' }}>
                        ${Number(inv.subtotal || 0).toLocaleString('es-CO')}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#475569' }}>
                        ${Number(inv.tax || 0).toLocaleString('es-CO')}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: '950', color: '#0f172a' }}>
                        ${Number(inv.total || 0).toLocaleString('es-CO')}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        <span style={{
                          padding: '0.2rem 0.55rem',
                          borderRadius: '6px',
                          fontSize: '0.62rem',
                          fontWeight: '950',
                          backgroundColor: isStamped ? '#dcfce7' : '#fef3c7',
                          color: isStamped ? '#15803d' : '#b45309',
                          textTransform: 'uppercase'
                        }}>
                          {isStamped ? '✓ Timbrada DIAN' : inv.status || 'Borrador'}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          style={{
                            padding: '0.35rem 0.65rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: 'white',
                            color: '#0284c7',
                            cursor: 'pointer',
                            fontSize: '0.7rem',
                            fontWeight: '850',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                        >
                          <Eye size={12} /> Detalle
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {invoices.length === 0 && !loadingInvoices && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                      No hay facturas registradas en Alegra actualmente.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. TAB CONTENT: EMIT NEW INVOICE */}
      {activeTab === 'emit' && (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '18px',
          border: '1px solid #e2e8f0',
          padding: '2rem',
          boxShadow: '0 4px 14px rgba(0,0,0,0.02)',
          maxWidth: '850px',
          margin: '0 auto',
          width: '100%'
        }}>
          <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '950', color: '#0f172a' }}>
              ⚡ Emitir Factura Electrónica en Alegra
            </h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Genera la factura y tímbrala directamente ante la DIAN usando la numeración autorizada <strong>FED</strong>.
            </p>
          </div>

          <form onSubmit={handleEmitInvoice} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Customer Information */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '850', color: '#475569', marginBottom: '0.35rem' }}>
                  NOMBRE CLIENTE / RAZÓN SOCIAL
                </label>
                <input
                  type="text"
                  required
                  value={emitClientName}
                  onChange={e => setEmitClientName(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '850', color: '#475569', marginBottom: '0.35rem' }}>
                  DOCUMENTO / NIT / CÉDULA
                </label>
                <input
                  type="text"
                  required
                  value={emitClientDoc}
                  onChange={e => setEmitClientDoc(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '850', color: '#475569', marginBottom: '0.35rem' }}>
                  CORREO ELECTRÓNICO
                </label>
                <input
                  type="email"
                  required
                  value={emitClientEmail}
                  onChange={e => setEmitClientEmail(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem' }}
                />
              </div>
            </div>

            {/* Dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '850', color: '#475569', marginBottom: '0.35rem' }}>
                  FECHA FACTURA
                </label>
                <input
                  type="date"
                  required
                  value={emitDate}
                  onChange={e => setEmitDate(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '850', color: '#475569', marginBottom: '0.35rem' }}>
                  FECHA VENCIMIENTO
                </label>
                <input
                  type="date"
                  required
                  value={emitDueDate}
                  onChange={e => setEmitDueDate(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem' }}
                />
              </div>
            </div>

            {/* Product Item Line */}
            <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '900', color: '#0f172a', marginBottom: '0.75rem' }}>
                DETALLE DEL ARTÍCULO
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '850', color: '#64748b', marginBottom: '0.3rem' }}>
                    Descripción / Concepto
                  </label>
                  <input
                    type="text"
                    required
                    value={emitItemName}
                    onChange={e => setEmitItemName(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', backgroundColor: 'white' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '850', color: '#64748b', marginBottom: '0.3rem' }}>
                    Precio Unitario ($)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={emitItemPrice}
                    onChange={e => setEmitItemPrice(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', backgroundColor: 'white' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '850', color: '#64748b', marginBottom: '0.3rem' }}>
                    Cantidad
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={emitItemQty}
                    onChange={e => setEmitItemQty(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', backgroundColor: 'white' }}
                  />
                </div>
              </div>
            </div>

            {/* Auto-Stamp Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <input
                type="checkbox"
                id="autoStampCheck"
                checked={emitAutoStamp}
                onChange={e => setEmitAutoStamp(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#0284c7', cursor: 'pointer' }}
              />
              <label htmlFor="autoStampCheck" style={{ fontSize: '0.8rem', fontWeight: '800', color: '#334155', cursor: 'pointer' }}>
                Timbrar automáticamente ante la DIAN (Obtener CUFE y validación oficial)
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={emitting}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: '#0284c7',
                color: 'white',
                fontWeight: '900',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: emitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
              }}
            >
              {emitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              {emitting ? 'Emitiendo en Alegra...' : 'Emitir Factura Electrónica'}
            </button>
          </form>

          {/* Result view */}
          {emitResult && (
            <div style={{ marginTop: '2rem', padding: '1.25rem', borderRadius: '12px', backgroundColor: emitResult.success ? '#f0fdf4' : '#fef2f2', border: `1.5px solid ${emitResult.success ? '#bbf7d0' : '#fecaca'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                {emitResult.success ? <CheckCircle2 size={18} color="#16a34a" /> : <XCircle size={18} color="#dc2626" />}
                <span style={{ fontWeight: '950', fontSize: '0.9rem', color: emitResult.success ? '#15803d' : '#b91c1c' }}>
                  {emitResult.success ? `¡Factura emitida exitosamente en Alegra! (#${emitResult.invoice?.numberTemplate?.fullNumber || emitResult.invoice?.id})` : `Error al emitir factura: ${emitResult.error}`}
                </span>
              </div>
              <pre style={{ margin: 0, padding: '0.75rem', backgroundColor: '#0f172a', color: '#f8fafc', borderRadius: '8px', fontSize: '0.72rem', overflowX: 'auto', maxHeight: '200px' }}>
                {JSON.stringify(emitResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* 4. TAB CONTENT: SUPERADMIN API TESTER (REQUEST & RESPONSE INSPECTOR) */}
      {activeTab === 'tester' && (
        <div style={{
          backgroundColor: '#0f172a',
          borderRadius: '18px',
          border: '1px solid #1e293b',
          padding: '1.75rem',
          color: '#f8fafc',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}>
          {/* Tester Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #334155', paddingBottom: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Code size={18} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '950', color: '#ffffff' }}>
                  Consola de Pruebas de Servicios ALEGRA (Inspector en Vivo)
                </h3>
              </div>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                Ejecuta peticiones reales contra la API de Alegra y analiza tanto la <strong>petición</strong> como la <strong>respuesta</strong> exacta del servidor.
              </p>
            </div>

            {/* Quick Presets */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8', alignSelf: 'center', fontWeight: '800' }}>PRESETS:</span>
              <button onClick={() => loadPresetTest('get_invoices')} style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#38bdf8', fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer' }}>
                /invoices
              </button>
              <button onClick={() => loadPresetTest('get_company')} style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#38bdf8', fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer' }}>
                /company
              </button>
              <button onClick={() => loadPresetTest('get_contacts')} style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#38bdf8', fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer' }}>
                /contacts
              </button>
              <button onClick={() => loadPresetTest('get_items')} style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#38bdf8', fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer' }}>
                /items
              </button>
              <button onClick={() => loadPresetTest('get_templates')} style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#38bdf8', fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer' }}>
                /number-templates
              </button>
            </div>
          </div>

          {/* Request Bar */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <select
              value={testMethod}
              onChange={(e: any) => setTestMethod(e.target.value)}
              style={{
                padding: '0.65rem 1rem',
                borderRadius: '8px',
                border: '1px solid #334155',
                backgroundColor: '#1e293b',
                color: testMethod === 'GET' ? '#38bdf8' : testMethod === 'POST' ? '#4ade80' : '#f59e0b',
                fontWeight: '950',
                fontSize: '0.85rem'
              }}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>

            <div style={{ flex: 1, position: 'relative' }}>
              <span style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                https://api.alegra.com/api/v1
              </span>
              <input
                type="text"
                value={testEndpoint}
                onChange={e => setTestEndpoint(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem 0.65rem 13.5rem',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  backgroundColor: '#1e293b',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  fontFamily: 'monospace'
                }}
              />
            </div>

            <button
              onClick={handleExecuteApiTest}
              disabled={testing}
              style={{
                padding: '0.65rem 1.5rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#0284c7',
                color: 'white',
                fontWeight: '900',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: testing ? 'not-allowed' : 'pointer'
              }}
            >
              {testing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="white" />}
              {testing ? 'Ejecutando...' : 'Enviar Petición'}
            </button>
          </div>

          {/* Payload input if POST/PUT */}
          {(testMethod === 'POST' || testMethod === 'PUT') && (
            <div>
              <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: '850', color: '#94a3b8', marginBottom: '0.35rem' }}>
                CUERPO DE LA PETICIÓN (JSON PAYLOAD):
              </span>
              <textarea
                rows={5}
                value={testPayload}
                onChange={e => setTestPayload(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#e2e8f0',
                  fontFamily: 'monospace',
                  fontSize: '0.78rem',
                  padding: '0.75rem',
                  outline: 'none'
                }}
              />
            </div>
          )}

          {/* Results: Side-by-side Request & Response */}
          {testExecutionResult && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
              
              {/* Request Details */}
              <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '1rem', border: '1px solid #334155' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '900', color: '#38bdf8' }}>
                    ↗️ PETICIÓN ENVIADA
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                    {testExecutionResult.responseTimeMs || 0}ms
                  </span>
                </div>
                <pre style={{ margin: 0, padding: '0.75rem', backgroundColor: '#090d16', color: '#94a3b8', borderRadius: '8px', fontSize: '0.7rem', maxHeight: '350px', overflowY: 'auto' }}>
                  {JSON.stringify(testExecutionResult.request || { method: testMethod, endpoint: testEndpoint }, null, 2)}
                </pre>
              </div>

              {/* Response Details */}
              <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '1rem', border: '1px solid #334155' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '900', color: (testExecutionResult.status && testExecutionResult.status < 300) ? '#4ade80' : '#f87171' }}>
                    ↙️ RESPUESTA DE ALEGRA ({testExecutionResult.status || 200})
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                    Estado: {testExecutionResult.status || 200} OK
                  </span>
                </div>
                <pre style={{ margin: 0, padding: '0.75rem', backgroundColor: '#090d16', color: '#e2e8f0', borderRadius: '8px', fontSize: '0.7rem', maxHeight: '350px', overflowY: 'auto' }}>
                  {JSON.stringify(testExecutionResult.response || testExecutionResult, null, 2)}
                </pre>
              </div>

            </div>
          )}

        </div>
      )}

      {/* 5. TAB CONTENT: COMPANY PROFILE */}
      {activeTab === 'company' && companyInfo && (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '18px',
          border: '1px solid #e2e8f0',
          padding: '2rem',
          boxShadow: '0 4px 14px rgba(0,0,0,0.02)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem'
        }}>
          <div>
            <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: '900', color: '#64748b' }}>RAZÓN SOCIAL</span>
            <span style={{ fontSize: '1.2rem', fontWeight: '950', color: '#0f172a' }}>{companyInfo.name}</span>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: '900', color: '#64748b' }}>NIT / IDENTIFICACIÓN</span>
            <span style={{ fontSize: '1.2rem', fontWeight: '950', color: '#0f172a' }}>{companyInfo.identification}</span>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: '900', color: '#64748b' }}>RÉGIMEN TRIBUTARIO</span>
            <span style={{ fontSize: '1rem', fontWeight: '850', color: '#0f172a' }}>{companyInfo.regime}</span>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: '900', color: '#64748b' }}>CORREO REGISTRADO</span>
            <span style={{ fontSize: '1rem', fontWeight: '850', color: '#0f172a' }}>{companyInfo.email}</span>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: '900', color: '#64748b' }}>DIRECCIÓN & CIUDAD</span>
            <span style={{ fontSize: '1rem', fontWeight: '850', color: '#0f172a' }}>{companyInfo.address?.address}, {companyInfo.address?.city}</span>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: '900', color: '#64748b' }}>HABILITACIÓN DIAN</span>
            <span style={{ fontSize: '1rem', fontWeight: '900', color: '#16a34a' }}>
              ✓ {companyInfo.setTest?.status || 'AUTORIZADO'}
            </span>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '1.5rem'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '650px',
            maxHeight: '85vh',
            overflowY: 'auto',
            padding: '1.75rem',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '950', color: '#0f172a' }}>
                  Factura {selectedInvoice.numberTemplate?.fullNumber || selectedInvoice.id}
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Fecha: {selectedInvoice.date}</span>
              </div>
              <button onClick={() => setSelectedInvoice(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.8rem' }}>
                <div><strong>Cliente:</strong> {selectedInvoice.client?.name}</div>
                <div><strong>Documento:</strong> {selectedInvoice.client?.identification}</div>
                <div><strong>Forma de Pago:</strong> {selectedInvoice.paymentForm}</div>
                <div><strong>Total Factura:</strong> ${Number(selectedInvoice.total || 0).toLocaleString('es-CO')}</div>
              </div>

              {selectedInvoice.stamp && (
                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.85rem', borderRadius: '8px', fontSize: '0.75rem' }}>
                  <div style={{ fontWeight: '900', color: '#166534', marginBottom: '0.3rem' }}>INFORMACIÓN DEL TIMBRADO DIAN:</div>
                  <div style={{ wordBreak: 'break-all', color: '#15803d', fontFamily: 'monospace' }}>
                    <strong>CUFE:</strong> {selectedInvoice.stamp.cufe || 'No disponible'}
                  </div>
                </div>
              )}

              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>Artículos:</span>
                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {(selectedInvoice.items || []).map((it: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '6px', fontSize: '0.78rem' }}>
                      <span>{it.quantity}x {it.name}</span>
                      <strong>${Number(it.total || 0).toLocaleString('es-CO')}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
