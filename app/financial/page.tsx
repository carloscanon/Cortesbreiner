'use strict';

'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  FileText,
  Package,
  Layers,
  Scissors,
  Settings,
  Users,
  DollarSign,
  TrendingDown,
  Activity,
  AlertTriangle,
  ArrowRight,
  UserCheck,
  CheckCircle,
  Truck,
  HelpCircle,
  MapPin,
  BadgePercent
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts';

export default function FinancialControlCenter() {
  const [activeMenu, setActiveMenu] = useState<'dashboard' | 'crm' | 'trazabilidad' | 'costos' | 'satelites'>('dashboard');
  const [kpis, setKpis] = useState<any>(null);
  const [satellites, setSatellites] = useState<any[]>([]);
  const [costs, setCosts] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // CRM state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<any>(null);

  // Trazabilidad state
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [traceResult, setTraceResult] = useState<any>(null);
  const [loadingTrace, setLoadingTrace] = useState(false);

  // Simulación de clientes (CRM)
  const CRM_CLIENTS = [
    {
      id: 'cli-01',
      name: 'Distribuidora Textil Andina',
      nit: '900.123.456-1',
      city: 'Medellín',
      dept: 'Antioquia',
      vendedor: 'Mauricio Gómez',
      canal: 'Mayorista',
      linea: 'Pantalones & Denim',
      cupo: 50000000,
      saldo: 12500000,
      estado: 'Activo',
      riesgo: 'Bajo', // Bajo, Medio, Alto
      compras: {
        ultimaCompra: '2026-07-06',
        promedioMensual: 14500000,
        totalHistorico: 128000000,
        favorito: 'Jeans Slim Fit Caballero',
        frecuencia: 'Semanal',
        rotacion: 'Alta',
        devoluciones: 1.2, // %
        descuentos: 5 // %
      },
      produccion: {
        pedidosActivos: 2,
        pedidosTerminados: 14,
        pedidosRetrasados: 0,
        corte: 300,
        confeccion: 450,
        calidad: 0
      },
      cartera: {
        age30: 8500000,
        age60: 4000000,
        age90: 0,
        age90plus: 0,
        promedioPago: 22, // días
        mora: 0
      }
    },
    {
      id: 'cli-02',
      name: 'Moda Joven del Centro S.A.S.',
      nit: '830.987.654-3',
      city: 'Bogotá',
      dept: 'Cundinamarca',
      vendedor: 'Diana Restrepo',
      canal: 'Retail / Tiendas',
      linea: 'Camisetas & Polos',
      cupo: 20000000,
      saldo: 18500000,
      estado: 'Activo',
      riesgo: 'Alto',
      compras: {
        ultimaCompra: '2026-06-20',
        promedioMensual: 6000000,
        totalHistorico: 48000000,
        favorito: 'Camiseta Básica Algodón',
        frecuencia: 'Quincenal',
        rotacion: 'Media',
        devoluciones: 4.8,
        descuentos: 10
      },
      produccion: {
        pedidosActivos: 1,
        pedidosTerminados: 6,
        pedidosRetrasados: 1,
        corte: 150,
        confeccion: 200,
        calidad: 80
      },
      cartera: {
        age30: 4500000,
        age60: 6000000,
        age90: 5000000,
        age90plus: 3000000,
        promedioPago: 48,
        mora: 18
      }
    }
  ];

  useEffect(() => {
    fetchFinancialData();
  }, []);

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/siigo/financial/metrics');
      const data = await res.json();
      if (data && !data.error) {
        setKpis(data.kpis);
        setSatellites(data.satelites || []);
        setCosts(data.costosBreakdown);
      }
    } catch (e) {
      console.error('Error al cargar métricas financieras:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleTraceInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceQuery) return;
    setLoadingTrace(true);
    setTraceResult(null);

    // Simulamos la consulta de trazabilidad 360° SAP style cruzando datos locales con SIIGO
    setTimeout(() => {
      setTraceResult({
        invoice: {
          consecutive: invoiceQuery.toUpperCase().startsWith('FV') ? invoiceQuery.toUpperCase() : `FV-1-${invoiceQuery}`,
          date: '2026-07-08',
          total: 4500000,
          statusDian: 'Aceptado por la DIAN (CUFE generado)',
          cufe: '04a6012efb723a9d80d19213bcde45f89101d2489e',
          pdfUrl: '#',
          xmlUrl: '#'
        },
        cliente: {
          nit: '900.123.456-1',
          name: 'Distribuidora Textil Andina',
          city: 'Medellín'
        },
        items: [
          { code: 'POLO-01', name: 'Camisa Polo Tradicional', quantity: 100, price: 45000 }
        ],
        produccion: {
          pedidoBrainer: 'PE-2026-894',
          ordenProduccion: 'OP-564',
          matrizCorte: 'MC-241',
          tallerSewing: 'Taller Confecciones Oriente',
          controlCalidad: 'Aprobado (100 prendas, 0 defectos)',
          despacho: 'Guía Logística #9871542 (Coordinadora)',
          pago: 'Comprobante RC-1-4921 (Recibo de Caja SIIGO)'
        }
      });
      setLoadingTrace(false);
    }, 8000);
  };

  const filteredClients = CRM_CLIENTS.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.nit.includes(searchTerm)
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', backgroundColor: '#0f172a', color: '#f1f5f9' }}>
      
      {/* ── MENÚ LATERAL ── */}
      <div style={{ width: '280px', backgroundColor: '#1e293b', borderRight: '1px solid #334155', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '950', background: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
            BRAINER ERP
          </h2>
          <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '700', letterSpacing: '0.05em' }}>
            FINANCIAL CONTROL CENTER
          </span>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button
            onClick={() => setActiveMenu('dashboard')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '8px',
              border: 'none', backgroundColor: activeMenu === 'dashboard' ? '#4f46e5' : 'transparent',
              color: 'white', fontWeight: '700', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem'
            }}
          >
            <Activity size={18} /> Dashboard General
          </button>
          <button
            onClick={() => { setActiveMenu('crm'); setSelectedClient(null); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '8px',
              border: 'none', backgroundColor: activeMenu === 'crm' ? '#4f46e5' : 'transparent',
              color: 'white', fontWeight: '700', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem'
            }}
          >
            <Users size={18} /> CRM & Clientes
          </button>
          <button
            onClick={() => setActiveMenu('trazabilidad')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '8px',
              border: 'none', backgroundColor: activeMenu === 'trazabilidad' ? '#4f46e5' : 'transparent',
              color: 'white', fontWeight: '700', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem'
            }}
          >
            <FileText size={18} /> Trazabilidad 360°
          </button>
          <button
            onClick={() => setActiveMenu('costos')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '8px',
              border: 'none', backgroundColor: activeMenu === 'costos' ? '#4f46e5' : 'transparent',
              color: 'white', fontWeight: '700', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem'
            }}
          >
            <BadgePercent size={18} /> Margen y Utilidad
          </button>
          <button
            onClick={() => setActiveMenu('satelites')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '8px',
              border: 'none', backgroundColor: activeMenu === 'satelites' ? '#4f46e5' : 'transparent',
              color: 'white', fontWeight: '700', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem'
            }}
          >
            <Scissors size={18} /> Dashboard Satélites
          </button>
        </nav>

        <div style={{ marginTop: 'auto', padding: '1rem', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}>
          <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '700', display: 'block' }}>ESTADO CONEXIÓN</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16a34a' }}></span>
            <span style={{ fontSize: '0.75rem', fontWeight: '700' }}>SIIGO Live API</span>
          </div>
        </div>
      </div>

      {/* ── CONTENIDO PRINCIPAL ── */}
      <div style={{ flexGrow: 1, padding: '2.5rem', overflowY: 'auto' }}>
        
        {loading ? (
          <div style={{ display: 'flex', height: '80vh', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ border: '4px solid #334155', borderTop: '4px solid #6366f1', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }}></div>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Consolidando datos financieros y operativos...</p>
            </div>
          </div>
        ) : (
          <div>
            
            {/* ── 1. WAR ROOM DASHBOARD ── */}
            {activeMenu === 'dashboard' && kpis && (
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', marginBottom: '1.5rem' }}>War Room Gerencial</h1>

                {/* KPIs Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
                  
                  {/* Ventas del Día */}
                  <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Ventas del Día</span>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', margin: '0.25rem 0' }}>
                      ${kpis.ventasDia.toLocaleString('es-CO')}
                    </h3>
                    <span style={{ fontSize: '0.7rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '0.1rem', fontWeight: '700' }}>
                      <TrendingUp size={12} /> +12% vs ayer
                    </span>
                    <div style={{ position: 'absolute', right: '-10px', bottom: '-10px', opacity: 0.05 }}><DollarSign size={80} /></div>
                  </div>

                  {/* Ventas Mes */}
                  <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Ventas Mes (SIIGO)</span>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', margin: '0.25rem 0' }}>
                      ${kpis.ventasMes.toLocaleString('es-CO')}
                    </h3>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Consolidado DIAN</span>
                    <div style={{ position: 'absolute', right: '-10px', bottom: '-10px', opacity: 0.05 }}><TrendingUp size={80} /></div>
                  </div>

                  {/* Facturas emitidas */}
                  <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Facturas Emitidas</span>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', margin: '0.25rem 0' }}>
                      {kpis.facturasSiigo}
                    </h3>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Enviadas a SIIGO</span>
                    <div style={{ position: 'absolute', right: '-10px', bottom: '-10px', opacity: 0.05 }}><FileText size={80} /></div>
                  </div>

                  {/* Pedidos Brainer */}
                  <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Pedidos Brainer</span>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', margin: '0.25rem 0' }}>
                      {kpis.pedidosBrainer}
                    </h3>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Órdenes totales registradas</span>
                    <div style={{ position: 'absolute', right: '-10px', bottom: '-10px', opacity: 0.05 }}><Package size={80} /></div>
                  </div>

                  {/* Prendas en confección */}
                  <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Prendas en Confección</span>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', margin: '0.25rem 0' }}>
                      {kpis.prendasConfeccion.toLocaleString('es-CO')}
                    </h3>
                    <span style={{ fontSize: '0.7rem', color: '#6366f1', fontWeight: '700' }}>En talleres satélites</span>
                    <div style={{ position: 'absolute', right: '-10px', bottom: '-10px', opacity: 0.05 }}><Layers size={80} /></div>
                  </div>

                  {/* Cartera */}
                  <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Cartera por Cobrar</span>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', margin: '0.25rem 0' }}>
                      ${kpis.cartera.toLocaleString('es-CO')}
                    </h3>
                    <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: '700' }}>{kpis.facturasVencidas} facturas vencidas</span>
                    <div style={{ position: 'absolute', right: '-10px', bottom: '-10px', opacity: 0.05 }}><DollarSign size={80} /></div>
                  </div>

                  {/* Margen Promedio */}
                  <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Margen Promedio</span>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#10b981', margin: '0.25rem 0' }}>
                      {kpis.margenPromedio}%
                    </h3>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Operación + Tela</span>
                    <div style={{ position: 'absolute', right: '-10px', bottom: '-10px', opacity: 0.05 }}><BadgePercent size={80} /></div>
                  </div>

                </div>

                {/* Gráficos de monitoreo en cruzado */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                  
                  {/* Flujo de caja proyectado */}
                  <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '1.5rem', borderRadius: '16px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1.5rem' }}>Evolución de Ingresos y Egresos de Confección</h3>
                    <div style={{ width: '100%', height: '280px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={[
                          { name: 'Ene', Ingresos: 85000000, Egresos: 55000000 },
                          { name: 'Feb', Ingresos: 92000000, Egresos: 62000000 },
                          { name: 'Mar', Ingresos: 110000000, Egresos: 75000000 },
                          { name: 'Abr', Ingresos: 98000000, Egresos: 71000000 },
                          { name: 'May', Ingresos: 125000000, Egresos: 83000000 },
                          { name: 'Jun', Ingresos: 140000000, Egresos: 92000000 }
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                          <XAxis dataKey="name" stroke="#94a3b8" />
                          <YAxis stroke="#94a3b8" />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }} />
                          <Area type="monotone" dataKey="Ingresos" stroke="#10b981" strokeWidth={2} fillOpacity={0.1} fill="#10b981" />
                          <Area type="monotone" dataKey="Egresos" stroke="#ef4444" strokeWidth={2} fillOpacity={0} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Estado de Despacho vs Facturado */}
                  <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1.25rem' }}>Órdenes en Producción</h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flexGrow: 1, justifyContent: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>En Confección</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>7,920 prendas</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: '#334155', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: '70%', height: '100%', backgroundColor: '#6366f1' }}></div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>En Calidad / Empaque</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>1,840 prendas</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: '#334155', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: '35%', height: '100%', backgroundColor: '#10b981' }}></div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Listo para Despacho</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>36 pedidos</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: '#334155', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: '50%', height: '100%', backgroundColor: '#f59e0b' }}></div>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* ── 2. CRM & CLIENTES ── */}
            {activeMenu === 'crm' && (
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', marginBottom: '1.5rem' }}>CRM de Clientes & Terceros</h1>

                {!selectedClient ? (
                  <div>
                    {/* Búsqueda */}
                    <div style={{ marginBottom: '1.5rem' }}>
                      <input
                        type="text"
                        placeholder="Buscar por NIT o nombre de cliente..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ width: '100%', maxWidth: '500px', padding: '0.65rem 1rem', border: '1px solid #334155', borderRadius: '8px', backgroundColor: '#1e293b', color: 'white', fontSize: '0.85rem', outline: 'none' }}
                      />
                    </div>

                    {/* Grilla de Clientes */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
                      {filteredClients.map(c => (
                        <div
                          key={c.id}
                          onClick={() => setSelectedClient(c)}
                          style={{
                            backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px',
                            padding: '1.5rem', cursor: 'pointer',
                            transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '1rem'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: 'white', margin: 0 }}>{c.name}</h3>
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>NIT: {c.nit}</span>
                            </div>
                            <span style={{
                              fontSize: '0.65rem', fontWeight: '800', padding: '0.2rem 0.5rem', borderRadius: '4px',
                              backgroundColor: c.riesgo === 'Bajo' ? '#dcfce7' : '#fecaca',
                              color: c.riesgo === 'Bajo' ? '#15803d' : '#b91c1c'
                            }}>
                              Riesgo: {c.riesgo}
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.8rem', borderTop: '1px solid #334155', paddingTop: '0.75rem' }}>
                            <div>
                              <span style={{ color: '#94a3b8', display: 'block' }}>Ciudad</span>
                              <strong>{c.city}</strong>
                            </div>
                            <div>
                              <span style={{ color: '#94a3b8', display: 'block' }}>Cupo Disponible</span>
                              <strong style={{ color: '#10b981' }}>${(c.cupo - c.saldo).toLocaleString('es-CO')}</strong>
                            </div>
                            <div>
                              <span style={{ color: '#94a3b8', display: 'block' }}>Saldo en Mora</span>
                              <strong style={{ color: c.saldo > 0 ? '#ef4444' : '#white' }}>${c.saldo.toLocaleString('es-CO')}</strong>
                            </div>
                            <div>
                              <span style={{ color: '#94a3b8', display: 'block' }}>Última Compra</span>
                              <strong>{c.compras.ultimaCompra}</strong>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Botón Volver */}
                    <button
                      onClick={() => setSelectedClient(null)}
                      style={{
                        backgroundColor: '#334155', color: 'white', border: 'none', borderRadius: '6px',
                        padding: '0.45rem 1rem', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', marginBottom: '1.5rem'
                      }}
                    >
                      ← Volver a Clientes
                    </button>

                    {/* Ficha CRM de Cliente */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
                      
                      {/* Sidebar del Cliente */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        
                        {/* Info General Card */}
                        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.5rem' }}>
                          <h2 style={{ fontSize: '1.1rem', fontWeight: '800', margin: '0 0 1rem', color: 'white' }}>{selectedClient.name}</h2>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8rem' }}>
                            <div>
                              <span style={{ color: '#94a3b8', display: 'block' }}>NIT</span>
                              <strong>{selectedClient.nit}</strong>
                            </div>
                            <div>
                              <span style={{ color: '#94a3b8', display: 'block' }}>Ubicación</span>
                              <strong>{selectedClient.city}, {selectedClient.dept}</strong>
                            </div>
                            <div>
                              <span style={{ color: '#94a3b8', display: 'block' }}>Canal de Venta</span>
                              <strong>{selectedClient.canal}</strong>
                            </div>
                            <div>
                              <span style={{ color: '#94a3b8', display: 'block' }}>Vendedor Asignado</span>
                              <strong>{selectedClient.vendedor}</strong>
                            </div>
                            <div>
                              <span style={{ color: '#94a3b8', display: 'block' }}>Cupo de Crédito</span>
                              <strong>${selectedClient.cupo.toLocaleString('es-CO')}</strong>
                            </div>
                            <div>
                              <span style={{ color: '#94a3b8', display: 'block' }}>Semáforo de Riesgo</span>
                              <strong style={{ color: selectedClient.riesgo === 'Bajo' ? '#10b981' : '#ef4444' }}>
                                Riesgo {selectedClient.riesgo}
                              </strong>
                            </div>
                          </div>
                        </div>

                        {/* Inteligencia Artificial de Cartera (IA) */}
                        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.5rem' }}>
                          <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.75rem' }}>
                            ✨ Inteligencia Comercial (IA)
                          </h3>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.75rem', color: '#cbd5e1' }}>
                            <p>
                              🤖 <strong>Comportamiento:</strong> Las compras de este cliente disminuyeron un 8% el último mes debido a una rotación media en la línea de <em>{selectedClient.linea}</em>.
                            </p>
                            <p>
                              🛍️ <strong>Recomendación:</strong> Ofrecer un incentivo de descuento en su producto favorito <em>({selectedClient.compras.favorito})</em> para reactivar pedidos.
                            </p>
                          </div>
                        </div>

                      </div>

                      {/* Detalles Financieros y Operativos */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        
                        {/* Secciones de KPIs de Compras y Cartera */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                          
                          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.25rem' }}>
                            <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#94a3b8', margin: '0 0 0.75rem' }}>Comportamiento Comercial</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                              <div>Total Compras: <strong>${selectedClient.compras.totalHistorico.toLocaleString('es-CO')}</strong></div>
                              <div>Promedio Mensual: <strong>${selectedClient.compras.promedioMensual.toLocaleString('es-CO')}</strong></div>
                              <div>Rotación: <strong>{selectedClient.compras.rotacion}</strong></div>
                              <div>Frecuencia: <strong>{selectedClient.compras.frecuencia}</strong></div>
                            </div>
                          </div>

                          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.25rem' }}>
                            <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#94a3b8', margin: '0 0 0.75rem' }}>Cartera & Cobro</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                              <div>Saldo Total: <strong>${selectedClient.saldo.toLocaleString('es-CO')}</strong></div>
                              <div>Promedio de Pago: <strong>{selectedClient.cartera.promedioPago} días</strong></div>
                              <div>Días en Mora: <strong style={{ color: selectedClient.cartera.mora > 0 ? '#ef4444' : '#10b981' }}>{selectedClient.cartera.mora} días</strong></div>
                            </div>
                          </div>

                        </div>

                        {/* Producción Cruzada */}
                        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.5rem' }}>
                          <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'white', marginBottom: '1rem' }}>Producción Activa en Taller</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', textAlign: 'center' }}>
                            <div style={{ padding: '0.75rem', backgroundColor: '#0f172a', borderRadius: '8px' }}>
                              <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>En Corte</span>
                              <strong style={{ fontSize: '1.1rem' }}>{selectedClient.produccion.corte}</strong>
                            </div>
                            <div style={{ padding: '0.75rem', backgroundColor: '#0f172a', borderRadius: '8px' }}>
                              <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>En Confección</span>
                              <strong style={{ fontSize: '1.1rem', color: '#6366f1' }}>{selectedClient.produccion.confeccion}</strong>
                            </div>
                            <div style={{ padding: '0.75rem', backgroundColor: '#0f172a', borderRadius: '8px' }}>
                              <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>En Control Calidad</span>
                              <strong style={{ fontSize: '1.1rem', color: '#f59e0b' }}>{selectedClient.produccion.calidad}</strong>
                            </div>
                            <div style={{ padding: '0.75rem', backgroundColor: '#0f172a', borderRadius: '8px' }}>
                              <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Pedidos Activos</span>
                              <strong style={{ fontSize: '1.1rem', color: '#10b981' }}>{selectedClient.produccion.pedidosActivos}</strong>
                            </div>
                          </div>
                        </div>

                      </div>

                    </div>
                  </div>
                )}

              </div>
            )}

            {/* ── 3. TRAZABILIDAD 360° ── */}
            {activeMenu === 'trazabilidad' && (
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', marginBottom: '1.5rem' }}>Trazabilidad 360° SAP style</h1>
                
                <form onSubmit={handleTraceInvoice} style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', maxWidth: '500px' }}>
                  <input
                    type="text"
                    placeholder="Ingresa número de factura (ej: 101)"
                    value={invoiceQuery}
                    onChange={e => setInvoiceQuery(e.target.value)}
                    style={{ flexGrow: 1, padding: '0.6rem 1rem', border: '1px solid #334155', borderRadius: '8px', backgroundColor: '#1e293b', color: 'white', fontSize: '0.85rem', outline: 'none' }}
                  />
                  <button
                    type="submit"
                    disabled={loadingTrace}
                    style={{
                      backgroundColor: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px',
                      padding: '0.6rem 1.5rem', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer'
                    }}
                  >
                    {loadingTrace ? 'Buscando...' : 'Consultar'}
                  </button>
                </form>

                {loadingTrace && (
                  <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                    <div style={{ border: '3px solid #334155', borderTop: '3px solid #6366f1', borderRadius: '50%', width: '30px', height: '30px', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }}></div>
                    Cruzando producción en taller con facturación contable de SIIGO...
                  </div>
                )}

                {traceResult && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
                    
                    {/* Factura SIIGO */}
                    <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ borderBottom: '1px solid #334155', paddingBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Factura de Venta</span>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'white', margin: 0 }}>{traceResult.invoice.consecutive}</h3>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8rem' }}>
                        <div>Cliente: <strong>{traceResult.cliente.name}</strong></div>
                        <div>NIT: <strong>{traceResult.cliente.nit}</strong></div>
                        <div>Total: <strong>${traceResult.invoice.total.toLocaleString('es-CO')}</strong></div>
                        <div>DIAN Status: <strong style={{ color: '#10b981' }}>{traceResult.invoice.statusDian}</strong></div>
                        <div style={{ wordBreak: 'break-all' }}>CUFE: <code style={{ color: '#f59e0b', fontSize: '0.7rem' }}>{traceResult.invoice.cufe}</code></div>
                      </div>
                    </div>

                    {/* Cadena de Trazabilidad */}
                    <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.5rem' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'white', marginBottom: '1.5rem' }}>Flujo Operativo Cruzado</h4>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative', paddingLeft: '1.5rem' }}>
                        <div style={{ position: 'absolute', left: '4px', top: '5px', bottom: '5px', width: '2px', backgroundColor: '#334155' }}></div>

                        {/* Pedido */}
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '-25px', top: '3px', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#6366f1' }}></span>
                          <div style={{ fontSize: '0.8rem' }}>
                            <span style={{ color: '#94a3b8', display: 'block' }}>1. Pedido Comercial</span>
                            <strong>Código de Pedido: {traceResult.produccion.pedidoBrainer}</strong>
                          </div>
                        </div>

                        {/* Orden Produccion */}
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '-25px', top: '3px', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#6366f1' }}></span>
                          <div style={{ fontSize: '0.8rem' }}>
                            <span style={{ color: '#94a3b8', display: 'block' }}>2. Orden de Producción</span>
                            <strong>Código OP: {traceResult.produccion.ordenProduccion}</strong>
                          </div>
                        </div>

                        {/* Matriz Corte */}
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '-25px', top: '3px', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#6366f1' }}></span>
                          <div style={{ fontSize: '0.8rem' }}>
                            <span style={{ color: '#94a3b8', display: 'block' }}>3. Corte & Insumos</span>
                            <strong>Matriz de Trazabilidad: {traceResult.produccion.matrizCorte}</strong>
                          </div>
                        </div>

                        {/* Confeccion */}
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '-25px', top: '3px', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#6366f1' }}></span>
                          <div style={{ fontSize: '0.8rem' }}>
                            <span style={{ color: '#94a3b8', display: 'block' }}>4. Confección en Satélite</span>
                            <strong>Asignado a: {traceResult.produccion.tallerSewing}</strong>
                          </div>
                        </div>

                        {/* Calidad */}
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '-25px', top: '3px', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
                          <div style={{ fontSize: '0.8rem' }}>
                            <span style={{ color: '#94a3b8', display: 'block' }}>5. Control de Calidad</span>
                            <strong>Estatus: {traceResult.produccion.controlCalidad}</strong>
                          </div>
                        </div>

                        {/* Despacho */}
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '-25px', top: '3px', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
                          <div style={{ fontSize: '0.8rem' }}>
                            <span style={{ color: '#94a3b8', display: 'block' }}>6. Despacho & Logística</span>
                            <strong>Logística: {traceResult.produccion.despacho}</strong>
                          </div>
                        </div>

                        {/* Pago */}
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '-25px', top: '3px', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f59e0b' }}></span>
                          <div style={{ fontSize: '0.8rem' }}>
                            <span style={{ color: '#94a3b8', display: 'block' }}>7. Recaudo (Conciliación Contable)</span>
                            <strong>Pago Asignado: {traceResult.produccion.pago}</strong>
                          </div>
                        </div>

                      </div>
                    </div>

                  </div>
                )}

              </div>
            )}

            {/* ── 4. MARGEN Y UTILIDAD ── */}
            {activeMenu === 'costos' && costs && (
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', marginBottom: '1.5rem' }}>Análisis de Margen y Costo Operativo</h1>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  
                  {/* Desglose de Costos de Producción */}
                  <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1.5rem' }}>Desglose de Costo de Pedido Promedio</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                          <span>Costo Tela (Kilos consumidos)</span>
                          <strong>${costs.tela.toLocaleString('es-CO')} (53%)</strong>
                        </div>
                        <div style={{ width: '100%', height: '8px', backgroundColor: '#334155', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: '53%', height: '100%', backgroundColor: '#3b82f6' }}></div>
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                          <span>Costo Satélite (Mano de Obra)</span>
                          <strong>${costs.satelite.toLocaleString('es-CO')} (28%)</strong>
                        </div>
                        <div style={{ width: '100%', height: '8px', backgroundColor: '#334155', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: '28%', height: '100%', backgroundColor: '#6366f1' }}></div>
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                          <span>Costo Estampado / Bordado</span>
                          <strong>${costs.estampado.toLocaleString('es-CO')} (12%)</strong>
                        </div>
                        <div style={{ width: '100%', height: '8px', backgroundColor: '#334155', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: '12%', height: '100%', backgroundColor: '#f59e0b' }}></div>
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                          <span>Transporte & Logística</span>
                          <strong>${costs.logistica.toLocaleString('es-CO')} (7%)</strong>
                        </div>
                        <div style={{ width: '100%', height: '8px', backgroundColor: '#334155', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: '7%', height: '100%', backgroundColor: '#10b981' }}></div>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Rentabilidad del Negocio */}
                  <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0 }}>Margen de Utilidad Neto</h3>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: '1rem', borderRadius: '8px' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Ingresos Totales (Estimados)</span>
                        <h4 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0 }}>${costs.ventas.toLocaleString('es-CO')}</h4>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Utilidad Operativa</span>
                        <h4 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#10b981', margin: 0 }}>${costs.utilidad.toLocaleString('es-CO')}</h4>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Margen de Utilidad:</span>
                        <strong>{Math.round((costs.utilidad / costs.ventas) * 100)}%</strong>
                      </div>
                      <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '0.25rem 0 0' }}>
                        * Este margen cruza automáticamente los metros de tela consumidos en corte, las liquidaciones pagadas a talleres satélites y la facturación reportada en SIIGO.
                      </p>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* ── 5. DASHBOARD SATÉLITES ── */}
            {activeMenu === 'satelites' && (
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'white', marginBottom: '1.5rem' }}>Desempeño de Satélites (Talleres Confección)</h1>

                <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.5rem' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #334155', color: '#94a3b8' }}>
                          <th style={{ padding: '0.75rem' }}>Taller Satélite</th>
                          <th style={{ padding: '0.75rem' }}>Prendas Procesadas</th>
                          <th style={{ padding: '0.75rem' }}>Valor Facturado/Pagado</th>
                          <th style={{ padding: '0.75rem' }}>Tasa de Rechazo (Calidad)</th>
                          <th style={{ padding: '0.75rem' }}>Calificación Eficiencia</th>
                          <th style={{ padding: '0.75rem' }}>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {satellites.map((sat: any) => (
                          <tr key={sat.id} style={{ borderBottom: '1px solid #334155' }}>
                            <td style={{ padding: '0.75rem', fontWeight: '700', color: 'white' }}>{sat.nombre}</td>
                            <td style={{ padding: '0.75rem' }}>{sat.prendas.toLocaleString('es-CO')}</td>
                            <td style={{ padding: '0.75rem', fontWeight: '700' }}>${sat.valor_pagado.toLocaleString('es-CO')}</td>
                            <td style={{ padding: '0.75rem', color: sat.defect_rate > 5 ? '#ef4444' : '#10b981', fontWeight: '700' }}>
                              {sat.defect_rate}%
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                              <span style={{ 
                                fontWeight: '700', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem',
                                backgroundColor: sat.rentabilidad > 95 ? '#dcfce7' : '#fef3c7',
                                color: sat.rentabilidad > 95 ? '#15803d' : '#d97706'
                              }}>{sat.rentabilidad}%</span>
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                              <span style={{ 
                                fontSize: '0.75rem', fontWeight: '800', 
                                color: sat.estado === 'Activo' ? '#10b981' : '#64748b' 
                              }}>{sat.estado}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

      </div>

      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

    </div>
  );
}
