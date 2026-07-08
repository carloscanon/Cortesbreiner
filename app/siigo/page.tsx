'use strict';

'use client';

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Terminal, 
  Activity, 
  RefreshCw, 
  Play, 
  Database, 
  Save, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Trash2,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';

export default function SiigoIntegrationPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'console' | 'config' | 'logs'>('dashboard');
  
  // Config state
  const [config, setConfig] = useState({
    api_url: 'https://api.siigo.com/v1',
    environment: 'sandbox',
    username: '',
    access_key: '',
    partner_id: '',
    timeout_ms: 10000,
    max_retries: 3,
    retry_delay_ms: 1000,
    headers: '{}',
    is_active: true,
    has_key: false
  });
  const [showKey, setShowKey] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Connection test state
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{ success: boolean; message: string; token_preview?: string } | null>(null);

  // Console state (Postman / Swagger)
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('GET_document_types');
  const [consolePayload, setConsolePayload] = useState<string>('{}');
  const [consoleResponse, setConsoleResponse] = useState<any>(null);
  const [consoleLoading, setConsoleLoading] = useState(false);
  const [consoleResponseTime, setConsoleResponseTime] = useState<number | null>(null);
  const [consoleStatus, setConsoleStatus] = useState<number | null>(null);

  // Monitor metrics state
  const [metrics, setMetrics] = useState({
    summary: { totalCalls: 0, availability: 100, avgLatency: 0, errorCalls: 0 },
    topEndpoints: [] as { endpoint: string; count: number }[],
    chartData: [] as any[]
  });
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  // Logs state
  const [logs, setLogs] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [logFilterStatus, setLogFilterStatus] = useState('');
  const [logFilterMethod, setLogFilterMethod] = useState('');

  // Endpoints list
  const ENDPOINTS = [
    { id: 'GET_document_types', name: 'Listar Tipos de Comprobante', method: 'GET', endpoint: '/document-types?type=FV', defaultPayload: null },
    { id: 'GET_customers', name: 'Buscar Cliente (ID 10101010)', method: 'GET', endpoint: '/customers?identification=10101010', defaultPayload: null },
    { id: 'POST_customer', name: 'Crear Cliente', method: 'POST', endpoint: '/customers', defaultPayload: JSON.stringify({
      person_type: "Person",
      id_type: "13",
      identification: "10202020",
      name: ["Sofía", "Martínez"],
      commercial_name: "Sofía Martínez",
      vat_responsible: false,
      address: { address: "Avenida Suba #115-40", city: { country_code: "Co", state_code: "11", city_code: "11001" } },
      phones: [{ number: "3201112233" }],
      contacts: [{ first_name: "Sofía", last_name: "Martínez", email: "sofia@correo.com" }]
    }, null, 2) },
    { id: 'GET_products', name: 'Buscar Producto (POLO-01)', method: 'GET', endpoint: '/products?code=POLO-01', defaultPayload: null },
    { id: 'POST_product', name: 'Crear Producto', method: 'POST', endpoint: '/products', defaultPayload: JSON.stringify({
      code: "POLO-02",
      name: "Camisa Polo Negra Premium",
      description: "Polo de algodón peinado",
      account_group: 72,
      prices: [{ currency_code: "COP", price_list: [{ position: 1, value: 55000 }] }]
    }, null, 2) },
    { id: 'POST_invoice', name: 'Crear Factura', method: 'POST', endpoint: '/invoices', defaultPayload: JSON.stringify({
      document: { id: 24446 },
      date: new Date().toISOString().split('T')[0],
      customer: { identification: "10101010", branch_office: 0 },
      items: [{ code: "POLO-01", quantity: 1, price: 45000 }],
      payments: [{ id: 5463, value: 45000 }]
    }, null, 2) },
    { id: 'POST_voucher', name: 'Crear Recibo de Caja (Pago)', method: 'POST', endpoint: '/vouchers', defaultPayload: JSON.stringify({
      document: { id: 38472 },
      date: new Date().toISOString().split('T')[0],
      customer: { identification: "10101010" },
      items: [{ document: { consecutive: "FV-1-101" }, value: 90000 }],
      payments: [{ id: 5463, value: 90000 }]
    }, null, 2) }
  ];

  useEffect(() => {
    fetchConfig();
    fetchMetrics();
    fetchLogs();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/siigo/config');
      const data = await res.json();
      if (data && !data.error) {
        setConfig({
          ...data,
          access_key: '', // Nunca mostramos la clave real en la UI
          headers: JSON.stringify(data.headers || {}, null, 2)
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const res = await fetch('/api/siigo/dashboard');
      const data = await res.json();
      if (data && !data.error) {
        setMetrics(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/siigo/logs?status=${logFilterStatus}&method=${logFilterMethod}`);
      const data = await res.json();
      if (data && !data.error) {
        setLogs(data.logs || []);
        setAudit(data.audit || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      let parsedHeaders = {};
      try {
        parsedHeaders = JSON.parse(config.headers);
      } catch (parseErr) {
        alert('El JSON de Custom Headers no es válido.');
        setSavingConfig(false);
        return;
      }

      const res = await fetch('/api/siigo/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          headers: parsedHeaders
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('Configuración guardada exitosamente.');
        fetchConfig();
        fetchMetrics();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err: any) {
      alert('Error en conexión: ' + err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const testConnection = async () => {
    setTestingConnection(true);
    setConnectionResult(null);
    try {
      const res = await fetch('/api/siigo/auth/test', { method: 'POST' });
      const data = await res.json();
      setConnectionResult(data);
      fetchLogs();
    } catch (err: any) {
      setConnectionResult({ success: false, message: err.message || String(err) });
    } finally {
      setTestingConnection(false);
    }
  };

  const runEndpoint = async () => {
    const endpointObj = ENDPOINTS.find(e => e.id === selectedEndpoint);
    if (!endpointObj) return;

    setConsoleLoading(true);
    setConsoleResponse(null);
    setConsoleResponseTime(null);
    setConsoleStatus(null);

    try {
      let payloadObj = null;
      if (endpointObj.method !== 'GET' && consolePayload) {
        try {
          payloadObj = JSON.parse(consolePayload);
        } catch (jsonErr) {
          alert('El payload no es un JSON válido.');
          setConsoleLoading(false);
          return;
        }
      }

      const res = await fetch('/api/siigo/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: endpointObj.method,
          endpoint: endpointObj.endpoint,
          payload: payloadObj
        })
      });

      const data = await res.json();
      setConsoleResponseTime(data.responseTimeMs);
      setConsoleStatus(res.status);

      if (res.ok) {
        setConsoleResponse(data.data || data);
      } else {
        setConsoleResponse(data);
      }
      fetchLogs();
      fetchMetrics();
    } catch (err: any) {
      setConsoleResponse({ error: err.message || String(err) });
    } finally {
      setConsoleLoading(false);
    }
  };

  const selectEndpoint = (id: string) => {
    setSelectedEndpoint(id);
    const found = ENDPOINTS.find(e => e.id === id);
    if (found) {
      setConsolePayload(found.defaultPayload || '{}');
      setConsoleResponse(null);
      setConsoleStatus(null);
      setConsoleResponseTime(null);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'system-ui, sans-serif', color: '#1e293b', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, color: '#0f172a' }}>
            <Database size={28} color="#4f46e5" /> Integración SIIGO API
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
            Módulo corporativo desacoplado con Clean Architecture y monitoreo en tiempo real.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            onClick={testConnection} 
            disabled={testingConnection}
            style={{ 
              backgroundColor: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', 
              padding: '0.6rem 1.2rem', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.2s'
            }}
          >
            <RefreshCw size={16} className={testingConnection ? 'spin' : ''} />
            {testingConnection ? 'Probando...' : 'Probar Conexión'}
          </button>
        </div>
      </div>

      {/* Connection Test Results Notification */}
      {connectionResult && (
        <div style={{ 
          padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', 
          backgroundColor: connectionResult.success ? '#f0fdf4' : '#fef2f2',
          border: `1.5px solid ${connectionResult.success ? '#bbf7d0' : '#fecaca'}`,
          display: 'flex', flexDirection: 'column', gap: '0.25rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {connectionResult.success ? <CheckCircle size={18} color="#15803d" /> : <XCircle size={18} color="#b91c1c" />}
            <span style={{ fontWeight: '700', color: connectionResult.success ? '#15803d' : '#b91c1c', fontSize: '0.9rem' }}>
              {connectionResult.success ? 'Conexión Exitosa' : 'Fallo en la Conexión'}
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0.25rem 0 0' }}>{connectionResult.message}</p>
          {connectionResult.token_preview && (
            <p style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', margin: 0 }}>
              Token obtenido: <code>{connectionResult.token_preview}</code>
            </p>
          )}
        </div>
      )}

      {/* ── TABS ── */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #e2e8f0', marginBottom: '1.5rem' }}>
        <button 
          onClick={() => setActiveTab('dashboard')} 
          style={{ padding: '0.75rem 1.25rem', border: 'none', borderBottom: activeTab === 'dashboard' ? '3px solid #4f46e5' : '3px solid transparent', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: '700', color: activeTab === 'dashboard' ? '#4f46e5' : '#64748b', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Activity size={16} /> Dashboard
        </button>
        <button 
          onClick={() => setActiveTab('console')} 
          style={{ padding: '0.75rem 1.25rem', border: 'none', borderBottom: activeTab === 'console' ? '3px solid #4f46e5' : '3px solid transparent', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: '700', color: activeTab === 'console' ? '#4f46e5' : '#64748b', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Terminal size={16} /> Consola de Pruebas
        </button>
        <button 
          onClick={() => setActiveTab('config')} 
          style={{ padding: '0.75rem 1.25rem', border: 'none', borderBottom: activeTab === 'config' ? '3px solid #4f46e5' : '3px solid transparent', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: '700', color: activeTab === 'config' ? '#4f46e5' : '#64748b', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Settings size={16} /> Configuración
        </button>
        <button 
          onClick={() => { setActiveTab('logs'); fetchLogs(); }} 
          style={{ padding: '0.75rem 1.25rem', border: 'none', borderBottom: activeTab === 'logs' ? '3px solid #4f46e5' : '3px solid transparent', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: '700', color: activeTab === 'logs' ? '#4f46e5' : '#64748b', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Database size={16} /> Logs & Auditoría
        </button>
      </div>

      {/* ── TAB CONTENT ── */}
      <div>
        
        {/* ── DASHBOARD TAB ── */}
        {activeTab === 'dashboard' && (
          <div>
            {loadingMetrics ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Cargando métricas...</div>
            ) : (
              <div>
                {/* KPIs Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                  <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase' }}>Peticiones Realizadas (7D)</div>
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#0f172a', marginTop: '0.5rem' }}>{metrics.summary.totalCalls}</div>
                  </div>
                  <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase' }}>Disponibilidad / Éxito</div>
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: metrics.summary.availability > 95 ? '#16a34a' : '#ea580c', marginTop: '0.5rem' }}>
                      {metrics.summary.availability}%
                    </div>
                  </div>
                  <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase' }}>Latencia Promedio</div>
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#0f172a', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      {metrics.summary.avgLatency} <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '500' }}>ms</span>
                    </div>
                  </div>
                  <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase' }}>Peticiones Fallidas</div>
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: metrics.summary.errorCalls > 0 ? '#ef4444' : '#0f172a', marginTop: '0.5rem' }}>
                      {metrics.summary.errorCalls}
                    </div>
                  </div>
                </div>

                {/* Grafico */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', minHeight: '350px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1.5rem' }}>Volumen de Integración (Últimos 7 días)</h3>
                    <div style={{ width: '100%', height: '280px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={metrics.chartData}>
                          <defs>
                            <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="day" />
                          <YAxis />
                          <Tooltip />
                          <Area type="monotone" dataKey="Peticiones" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorCalls)" />
                          <Area type="monotone" dataKey="Errores" stroke="#ef4444" strokeWidth={2} fillOpacity={0} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>Top Endpoints Utilizados</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {metrics.topEndpoints.length === 0 ? (
                        <p style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>Sin datos disponibles.</p>
                      ) : (
                        metrics.topEndpoints.map((ep, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                            <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', wordBreak: 'break-all', maxWidth: '80%' }}>
                              {ep.endpoint}
                            </span>
                            <span style={{ fontSize: '0.75rem', fontWeight: '800', backgroundColor: '#e2e8f0', padding: '0.2rem 0.5rem', borderRadius: '999px' }}>
                              {ep.count}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CONSOLE TAB ── */}
        {activeTab === 'console' && (
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem' }}>
            {/* Endpoints Sidebar */}
            <div style={{ backgroundColor: 'white', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Servicios SIIGO</h3>
              {ENDPOINTS.map(ep => (
                <button
                  key={ep.id}
                  onClick={() => selectEndpoint(ep.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.75rem',
                    borderRadius: '8px', border: selectedEndpoint === ep.id ? '1.5px solid #4f46e5' : '1px solid #e2e8f0',
                    backgroundColor: selectedEndpoint === ep.id ? '#f5f3ff' : 'transparent',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
                  }}
                >
                  <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#0f172a' }}>{ep.name}</span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ 
                      fontSize: '0.65rem', fontWeight: '800', padding: '0.1rem 0.35rem', borderRadius: '4px',
                      backgroundColor: ep.method === 'GET' ? '#dcfce7' : '#dbeafe',
                      color: ep.method === 'GET' ? '#15803d' : '#1e40af'
                    }}>{ep.method}</span>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>{ep.endpoint.substring(0, 30)}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Editor & Response Areas */}
            <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: '1.5rem' }}>
              <div style={{ backgroundColor: 'white', padding: '1rem 1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ 
                    fontWeight: '800', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.85rem',
                    backgroundColor: ENDPOINTS.find(e => e.id === selectedEndpoint)?.method === 'GET' ? '#dcfce7' : '#dbeafe',
                    color: ENDPOINTS.find(e => e.id === selectedEndpoint)?.method === 'GET' ? '#15803d' : '#1e40af'
                  }}>{ENDPOINTS.find(e => e.id === selectedEndpoint)?.method}</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '0.9rem' }}>
                    {ENDPOINTS.find(e => e.id === selectedEndpoint)?.endpoint}
                  </span>
                </div>
                <button
                  onClick={runEndpoint}
                  disabled={consoleLoading}
                  style={{
                    backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '8px',
                    padding: '0.5rem 1.25rem', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.4rem'
                  }}
                >
                  <Play size={16} />
                  {consoleLoading ? 'Ejecutando...' : 'Ejecutar'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', minHeight: '400px' }}>
                {/* Request Payload Editor */}
                <div style={{ backgroundColor: 'white', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#64748b', marginBottom: '0.75rem' }}>Request Body (JSON)</h4>
                  <textarea
                    value={consolePayload}
                    onChange={e => setConsolePayload(e.target.value)}
                    disabled={ENDPOINTS.find(e => e.id === selectedEndpoint)?.method === 'GET'}
                    placeholder={ENDPOINTS.find(e => e.id === selectedEndpoint)?.method === 'GET' ? 'Petición GET no requiere Body' : '{\n  "key": "value"\n}'}
                    style={{
                      flexGrow: 1, fontFamily: 'monospace', fontSize: '0.85rem', padding: '0.75rem',
                      border: '1px solid #cbd5e1', borderRadius: '8px', resize: 'none', outline: 'none',
                      backgroundColor: ENDPOINTS.find(e => e.id === selectedEndpoint)?.method === 'GET' ? '#f1f5f9' : 'white'
                    }}
                  />
                </div>

                {/* Response Code Area */}
                <div style={{ backgroundColor: 'white', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#64748b', margin: 0 }}>Response</h4>
                    {consoleStatus && (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ 
                          fontSize: '0.75rem', fontWeight: '800', padding: '0.2rem 0.5rem', borderRadius: '4px',
                          backgroundColor: consoleStatus < 400 ? '#dcfce7' : '#fecaca',
                          color: consoleStatus < 400 ? '#15803d' : '#b91c1c'
                        }}>Status: {consoleStatus}</span>
                        {consoleResponseTime && (
                          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                            <Clock size={12} /> {consoleResponseTime} ms
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ 
                    flexGrow: 1, backgroundColor: '#0f172a', borderRadius: '8px', padding: '0.75rem',
                    overflow: 'auto', maxHeight: '420px'
                  }}>
                    {consoleLoading ? (
                      <p style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.85rem' }}>Cargando datos...</p>
                    ) : consoleResponse ? (
                      <pre style={{ margin: 0, color: '#38bdf8', fontFamily: 'monospace', fontSize: '0.8rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {JSON.stringify(consoleResponse, null, 2)}
                      </pre>
                    ) : (
                      <p style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.85rem', textAlign: 'center', marginTop: '2rem' }}>
                        Presiona "Ejecutar" para ver la respuesta.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── CONFIGURATION TAB ── */}
        {activeTab === 'config' && (
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '16px', border: '1px solid #e2e8f0', maxWidth: '800px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Settings size={20} color="#4f46e5" /> Configuración de Conectividad SIIGO
            </h3>
            
            <form onSubmit={handleSaveConfig} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '700', display: 'block', marginBottom: '0.35rem' }}>API URL</label>
                <input
                  type="text"
                  value={config.api_url}
                  onChange={e => setConfig({ ...config, api_url: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '700', display: 'block', marginBottom: '0.35rem' }}>Ambiente</label>
                <select
                  value={config.environment}
                  onChange={e => setConfig({ ...config, environment: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: 'white' }}
                >
                  <option value="sandbox">Sandbox (Pruebas)</option>
                  <option value="production">Production (Producción)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '700', display: 'block', marginBottom: '0.35rem' }}>Usuario (Username / Email)</label>
                <input
                  type="text"
                  value={config.username}
                  onChange={e => setConfig({ ...config, username: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '700', display: 'block', marginBottom: '0.35rem' }}>Access Key</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showKey ? "text" : "password"}
                    value={config.access_key}
                    placeholder={config.has_key ? "••••••••••••••••••••••••" : "Ingresar nueva Access Key"}
                    onChange={e => setConfig({ ...config, access_key: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', paddingRight: '2.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#64748b' }}
                  >
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '700', display: 'block', marginBottom: '0.35rem' }}>Partner ID</label>
                <input
                  type="text"
                  value={config.partner_id}
                  onChange={e => setConfig({ ...config, partner_id: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '700', display: 'block', marginBottom: '0.35rem' }}>Timeout (ms)</label>
                <input
                  type="number"
                  value={config.timeout_ms}
                  onChange={e => setConfig({ ...config, timeout_ms: Number(e.target.value) })}
                  style={{ width: '100%', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '700', display: 'block', marginBottom: '0.35rem' }}>Reintentos Máximos</label>
                <input
                  type="number"
                  value={config.max_retries}
                  onChange={e => setConfig({ ...config, max_retries: Number(e.target.value) })}
                  style={{ width: '100%', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '700', display: 'block', marginBottom: '0.35rem' }}>Espera entre reintentos (ms)</label>
                <input
                  type="number"
                  value={config.retry_delay_ms}
                  onChange={e => setConfig({ ...config, retry_delay_ms: Number(e.target.value) })}
                  style={{ width: '100%', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: '700', display: 'block', marginBottom: '0.35rem' }}>Custom Headers (JSON)</label>
                <textarea
                  value={config.headers}
                  onChange={e => setConfig({ ...config, headers: e.target.value })}
                  style={{ width: '100%', height: '100px', fontFamily: 'monospace', fontSize: '0.8rem', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '6px', resize: 'none' }}
                />
              </div>

              <div style={{ gridColumn: 'span 2', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  id="is_active"
                  checked={config.is_active}
                  onChange={e => setConfig({ ...config, is_active: e.target.checked })}
                />
                <label htmlFor="is_active" style={{ fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer' }}>Módulo de integración Activo</label>
              </div>

              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button
                  type="submit"
                  disabled={savingConfig}
                  style={{
                    backgroundColor: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px',
                    padding: '0.65rem 1.5rem', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.4rem'
                  }}
                >
                  <Save size={16} />
                  {savingConfig ? 'Guardando...' : 'Guardar Configuración'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── LOGS & AUDIT TAB ── */}
        {activeTab === 'logs' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
            
            {/* Request Logs */}
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0 }}>Historial de Peticiones</h3>
                
                {/* Filtros */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select
                    value={logFilterMethod}
                    onChange={e => { setLogFilterMethod(e.target.value); setTimeout(() => fetchLogs(), 50); }}
                    style={{ padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.75rem', backgroundColor: 'white' }}
                  >
                    <option value="">Todos los Métodos</option>
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                  <select
                    value={logFilterStatus}
                    onChange={e => { setLogFilterStatus(e.target.value); setTimeout(() => fetchLogs(), 50); }}
                    style={{ padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.75rem', backgroundColor: 'white' }}
                  >
                    <option value="">Todos los Estatus</option>
                    <option value="success">Exitoso (2xx)</option>
                    <option value="error">Error (4xx/5xx)</option>
                  </select>
                  <button 
                    onClick={fetchLogs} 
                    style={{ padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#f1f5f9', cursor: 'pointer' }}
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>

              {loadingLogs ? (
                <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Cargando logs...</p>
              ) : logs.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontStyle: 'italic' }}>No se encontraron logs de integración.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #f1f5f9', color: '#64748b' }}>
                        <th style={{ padding: '0.5rem' }}>Fecha/Hora</th>
                        <th style={{ padding: '0.5rem' }}>Método</th>
                        <th style={{ padding: '0.5rem' }}>Endpoint</th>
                        <th style={{ padding: '0.5rem' }}>Estatus</th>
                        <th style={{ padding: '0.5rem' }}>Duración</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '0.5rem', color: '#64748b' }}>{new Date(log.created_at).toLocaleString('es-CO')}</td>
                          <td style={{ padding: '0.5rem' }}>
                            <span style={{ 
                              fontWeight: '800', padding: '0.15rem 0.35rem', borderRadius: '4px', fontSize: '0.7rem',
                              backgroundColor: log.method === 'GET' ? '#dcfce7' : '#dbeafe',
                              color: log.method === 'GET' ? '#15803d' : '#1e40af'
                            }}>{log.method}</span>
                          </td>
                          <td style={{ padding: '0.5rem', fontFamily: 'monospace', color: '#334155' }}>
                            {log.endpoint.replace('https://api.siigo.com/v1', '')}
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            {log.status_code ? (
                              <span style={{ 
                                fontWeight: '700', padding: '0.15rem 0.35rem', borderRadius: '4px', fontSize: '0.7rem',
                                backgroundColor: log.status_code < 400 ? '#f0fdf4' : '#fef2f2',
                                color: log.status_code < 400 ? '#16a34a' : '#ef4444'
                              }}>{log.status_code}</span>
                            ) : (
                              <span style={{ fontWeight: '700', padding: '0.15rem 0.35rem', borderRadius: '4px', fontSize: '0.7rem', backgroundColor: '#fef2f2', color: '#ef4444' }}>FAIL</span>
                            )}
                          </td>
                          <td style={{ padding: '0.5rem', color: '#64748b' }}>{log.response_time_ms ? `${log.response_time_ms}ms` : 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Audit Trail */}
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1.25rem' }}>Registro de Auditoría</h3>
              {loadingLogs ? (
                <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Cargando auditoría...</p>
              ) : audit.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.85rem', fontStyle: 'italic' }}>Sin auditorías registradas.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {audit.map((aud) => (
                    <div key={aud.id} style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', marginBottom: '0.25rem' }}>
                        <span>👤 {aud.username}</span>
                        <span>{new Date(aud.created_at).toLocaleTimeString('es-CO')}</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#4f46e5' }}>{aud.action}</span>
                      <p style={{ fontSize: '0.75rem', margin: '0.25rem 0 0', color: '#334155' }}>{aud.details}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </div>
      
      {/* Dynamic inline spinning animation */}
      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>

    </div>
  );
}
