'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  ShieldAlert, ShieldCheck, DollarSign, Activity, Cpu, HardDrive, 
  Lock, RefreshCw, Users, Server, Ticket, KeyRound, AlertOctagon, 
  CheckCircle2, Clock, FileText, BarChart3, ChevronRight, Search, 
  MessageSquare, AlertTriangle, Layers, Send, HelpCircle, UserX, Database,
  Building2, Bot, Sliders, Eye, FileSpreadsheet, Download, Zap, Wifi,
  Globe, ArrowUpRight, ArrowDownRight, Radio, Check, X, Shield, Settings2,
  TrendingUp, BarChart2, Mail, Phone, ExternalLink, Filter
} from 'lucide-react';

type SuperAdminTab = 
  | 'dashboard_ejecutivo' 
  | 'empresas' 
  | 'licenciamiento' 
  | 'modulos' 
  | 'facturacion_saas' 
  | 'centro_consumo' 
  | 'auditoria_global' 
  | 'infraestructura' 
  | 'tickets' 
  | 'ia_asistente' 
  | 'reportes';

export default function SuperAdminPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<SuperAdminTab>('dashboard_ejecutivo');

  // Verify superuser access
  const roleName = profile?.roles?.name?.toLowerCase() || '';
  const isSuperUser = roleName.includes('super') || roleName.includes('admin master') || profile?.role_id === 'superadmin';

  // 1. Dashboard Ejecutivo Global State
  const [globalStats, setGlobalStats] = useState({
    empresas: {
      registradas: 142,
      activas: 128,
      trial: 8,
      suspendidas: 4,
      bloqueadas: 2,
      licenciaVencida: 3,
      nuevasMes: 12,
      mayorCrecimiento: ['Cortes Breiner S.A.S.', 'Textiles Andina', 'Moda & Estilo Ltda']
    },
    usuarios: {
      registrados: 1450,
      activosHoy: 682,
      conectadosRealtime: 142,
      porEmpresaAvg: 10.2,
      nuevosMes: 98,
      inactivos: 110
    },
    consumoConsolidado: {
      almacenamientoGb: 482.4,
      almacenamientoTotalGb: 1000,
      dbMb: 18400,
      archivos: 348200,
      imagenes: 245000,
      pdfs: 68400,
      stickersGenerados: 184500,
      facturasEmitidas: 94500,
      ordenesProduccion: 18400,
      transacciones: 485000,
      registrosProcesados: 1240000,
      impresiones: 285000,
      exportacionesExcel: 14200,
      exportacionesPdf: 9800,
      apiCalls: 485000,
      consumoIaTokens: 14200000,
      correosEnviados: 84500,
      whatsappEnviados: 42300,
      espacioRestanteGb: 517.6
    }
  });

  // 2. Empresas & Licenciamiento Fichas completas
  const [empresas, setEmpresas] = useState<any[]>([
    {
      id: 'EMP-001',
      razonSocial: 'Cortes Breiner S.A.S.',
      nit: '901.458.789-2',
      plan: 'Enterprise VIP',
      fechaInicio: '2025-01-01',
      fechaVencimiento: '2026-12-31',
      estado: 'Activa',
      renovacionAuto: true,
      valorMensual: 1200000,
      valorAnual: 14400000,
      usuariosMax: 50,
      usuariosActivos: 34,
      modulos: { produccion: true, confeccion: true, calidad: true, inventarios: true, pos: true, compras: true, ventas: true, talleres: true, crm: true, nomina: true, ia: true, reportes: true, bi: true },
      consumo: { gb: 48.5, api: 45000, iaTokens: 1200000, facturas: 8450, stickers: 12400 }
    },
    {
      id: 'EMP-002',
      razonSocial: 'Textiles Y Confecciones Andina',
      nit: '800.123.456-7',
      plan: 'Pro Industrial',
      fechaInicio: '2025-03-15',
      fechaVencimiento: '2026-03-15',
      estado: 'Activa',
      renovacionAuto: true,
      valorMensual: 750000,
      valorAnual: 9000000,
      usuariosMax: 20,
      usuariosActivos: 18,
      modulos: { produccion: true, confeccion: true, calidad: true, inventarios: true, pos: false, compras: true, ventas: true, talleres: true, crm: false, nomina: false, ia: true, reportes: true, bi: false },
      consumo: { gb: 24.2, api: 22000, iaTokens: 450000, facturas: 3200, stickers: 8900 }
    },
    {
      id: 'EMP-003',
      razonSocial: 'Creaciones Moda & Estilo Ltda',
      nit: '900.876.543-1',
      plan: 'Pyme Standard',
      fechaInicio: '2026-06-01',
      fechaVencimiento: '2026-08-01',
      estado: 'Trial',
      renovacionAuto: false,
      valorMensual: 350000,
      valorAnual: 4200000,
      usuariosMax: 10,
      usuariosActivos: 5,
      modulos: { produccion: true, confeccion: true, calidad: false, inventarios: true, pos: true, compras: false, ventas: true, talleres: false, crm: false, nomina: false, ia: false, reportes: true, bi: false },
      consumo: { gb: 5.1, api: 4800, iaTokens: 50000, facturas: 620, stickers: 1200 }
    }
  ]);
  const [selectedEmpresa, setSelectedEmpresa] = useState<any>(null);
  const [showCreateEmpresaModal, setShowCreateEmpresaModal] = useState(false);
  const [newEmpresa, setNewEmpresa] = useState({
    razonSocial: '',
    nit: '',
    planCode: 'Enterprise VIP',
    valorMensual: 1200000,
    usuariosMax: 20
  });

  const handleCreateEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpresa.razonSocial || !newEmpresa.nit) return;
    try {
      // 1. Insert tenant in Supabase
      const { data: tenantData, error: tenantErr } = await supabase.from('tenants').insert({
        razon_social: newEmpresa.razonSocial,
        nit: newEmpresa.nit,
        plan_code: newEmpresa.planCode,
        valor_mensual: newEmpresa.valorMensual,
        valor_anual: newEmpresa.valorMensual * 12,
        usuarios_permitidos: newEmpresa.usuariosMax,
        status: 'ACTIVA'
      }).select().single();

      if (tenantErr) throw tenantErr;

      // 2. Initialize tenant_modules in Supabase
      if (tenantData) {
        await supabase.from('tenant_modules').insert({
          tenant_id: tenantData.id,
          produccion: true, confeccion: true, calidad: true, inventarios: true, pos: true, compras: true, ventas: true, talleres: true, crm: true, nomina: true, ia: true, reportes: true, bi: true
        });

        // 3. Record Audit Log in Supabase
        await supabase.from('global_audit_logs').insert({
          tenant_id: tenantData.id,
          event_type: 'CREATE_TENANT',
          module_name: 'SuperAdmin',
          user_name: profile?.full_name || user?.email || 'SuperAdmin',
          affected_record: newEmpresa.razonSocial,
          criticidad: 'Alta',
          resultado: 'Exitoso',
          new_value: { nit: newEmpresa.nit, plan: newEmpresa.planCode }
        });
      }

      setShowCreateEmpresaModal(false);
      setNewEmpresa({ razonSocial: '', nit: '', planCode: 'Enterprise VIP', valorMensual: 1200000, usuariosMax: 20 });
      fetchSuperAdminData();
    } catch (err: any) {
      alert('Error creando empresa en base de datos: ' + err.message);
    }
  };
  const [dbLoading, setDbLoading] = useState(false);

  const fetchSuperAdminData = async () => {
    setDbLoading(true);
    try {
      // 1. Fetch Tenants & Modules
      const { data: dbTenants } = await supabase.from('tenants').select('*, tenant_modules(*)');
      if (dbTenants && dbTenants.length > 0) {
        const mapped = dbTenants.map((t: any) => ({
          id: t.id,
          razonSocial: t.razon_social,
          nit: t.nit,
          plan: t.plan_code || 'Standard',
          fechaInicio: t.fecha_inicio || '2025-01-01',
          fechaVencimiento: t.fecha_vencimiento || '2026-12-31',
          estado: t.status || 'Activa',
          renovacionAuto: t.renovacion_auto ?? true,
          valorMensual: Number(t.valor_mensual || 750000),
          valorAnual: Number(t.valor_anual || 9000000),
          usuariosMax: t.usuarios_permitidos || 20,
          usuariosActivos: 12,
          modulos: t.tenant_modules?.[0] || { produccion: true, confeccion: true, calidad: true, inventarios: true, pos: true, compras: true, ventas: true, talleres: true, crm: true, nomina: true, ia: true, reportes: true, bi: true },
          consumo: { gb: 24.2, api: 22000, iaTokens: 450000, facturas: 3200, stickers: 8900 }
        }));
        setEmpresas(mapped);
      }

      // 2. Fetch Audit Logs from DB
      const { data: dbAudit } = await supabase.from('global_audit_logs').select('*, tenants(razon_social)').order('created_at', { ascending: false }).limit(50);
      if (dbAudit && dbAudit.length > 0) {
        setAuditLogs(dbAudit.map((l: any) => ({
          id: l.id,
          empresa: l.tenants?.razon_social || 'Sistema Master',
          usuario: l.user_name || 'Usuario',
          fecha: new Date(l.created_at).toLocaleString('es-CO'),
          ip: l.ip_address || '127.0.0.1',
          browser: l.browser || 'Browser Native',
          modulo: l.module_name || 'General',
          accion: l.event_type,
          registro: l.affected_record || '—',
          valAnterior: l.previous_value ? JSON.stringify(l.previous_value) : '—',
          valNuevo: l.new_value ? JSON.stringify(l.new_value) : '—',
          timeMs: l.execution_time_ms || 120,
          criticidad: l.criticidad || 'Baja',
          resultado: l.resultado || 'Exitoso'
        })));
      }

      // 3. Fetch System Users & Profiles with Realtime Connection & Login History
      const { data: dbProfiles } = await supabase.from('profiles').select('*, roles(name)');
      const { data: allAuditLogs } = await supabase.from('global_audit_logs').select('*').order('created_at', { ascending: false }).limit(300);

      if (dbProfiles && dbProfiles.length > 0) {
        const mappedUsers = dbProfiles.map((p: any) => {
          const isCurrentUser = Boolean(
            (user?.email && p.email && user.email.toLowerCase().trim() === p.email.toLowerCase().trim()) ||
            (user?.id && p.id && user.id === p.id) ||
            (profile?.email && p.email && profile.email.toLowerCase().trim() === p.email.toLowerCase().trim())
          );

          const userLogs = (allAuditLogs || []).filter((l: any) => {
            if (l.user_id && p.id && l.user_id === p.id) return true;
            if (l.user_name && p.email && l.user_name.toLowerCase().includes(p.email.toLowerCase())) return true;
            if (l.user_name && p.full_name && l.user_name.toLowerCase().includes(p.full_name.toLowerCase())) return true;
            return false;
          });

          const loginEvents = userLogs.filter((l: any) => l.event_type === 'LOGIN_SUCCESS');
          const totalLogins = Math.max(loginEvents.length, isCurrentUser ? 1 : (userLogs.length > 0 ? 1 : 0));
          
          const latestLog = userLogs[0];
          const lastLogTime = latestLog ? new Date(latestLog.created_at) : null;
          
          // Connected if currentUser OR latest log is within last 24h
          const isConnected = isCurrentUser || (lastLogTime ? (Date.now() - lastLogTime.getTime()) < (24 * 60 * 60 * 1000) : false);

          let lastLoginDisplay = 'Sin registros de ingreso';
          if (isCurrentUser) {
            lastLoginDisplay = 'Ahora mismo (Sesión Activa)';
          } else if (lastLogTime) {
            lastLoginDisplay = lastLogTime.toLocaleString('es-CO');
          }

          return {
            id: p.id,
            name: p.full_name || (isCurrentUser ? (profile?.full_name || 'Super Administrador') : 'Usuario Plataforma'),
            email: p.email || (isCurrentUser ? user?.email : 'sin-email@empresa.com'),
            role: p.roles?.name || 'Operario',
            status: p.is_active ?? true ? 'Activo' : 'Inactivo',
            totalLogins,
            lastLogin: lastLoginDisplay,
            isConnected,
            createdAt: p.created_at ? new Date(p.created_at).toLocaleDateString('es-CO') : '2025-01-01'
          };
        });

        // Ensure current active user is always included if missing from profiles table
        if (user && !mappedUsers.some(u => u.email?.toLowerCase() === user.email?.toLowerCase())) {
          mappedUsers.unshift({
            id: user.id || 'current-user',
            name: profile?.full_name || user.email?.split('@')[0] || 'Super Admin Master',
            email: user.email || 'admin@cortesbreiner.com',
            role: 'SuperAdmin',
            status: 'Activo',
            totalLogins: 1,
            lastLogin: 'Ahora mismo (Sesión Activa)',
            isConnected: true,
            createdAt: new Date().toLocaleDateString('es-CO')
          });
        }

        setSystemUsers(mappedUsers);
      }

      // 4. Fetch Real Database Counts from System Tables
      const [{ count: realUserCount }, { count: realProductsCount }, { count: realCuttingCount }, { count: realInvoicesCount }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('cutting_orders').select('*', { count: 'exact', head: true }),
        supabase.from('siigo_invoices').select('*', { count: 'exact', head: true })
      ]);

      if (dbTenants) {
        setGlobalStats(prev => ({
          ...prev,
          empresas: {
            ...prev.empresas,
            registradas: dbTenants.length,
            activas: dbTenants.filter((t: any) => t.status === 'ACTIVA' || !t.status).length
          },
          usuarios: {
            ...prev.usuarios,
            registrados: realUserCount || prev.usuarios.registrados
          },
          consumoConsolidado: {
            ...prev.consumoConsolidado,
            facturasEmitidas: realInvoicesCount || prev.consumoConsolidado.facturasEmitidas,
            ordenesProduccion: realCuttingCount || prev.consumoConsolidado.ordenesProduccion,
            archivos: (realProductsCount || 0) * 4
          }
        }));
      }

    } catch (err) {
      console.warn('SuperAdmin live fetch info:', err);
    } finally {
      setDbLoading(false);
    }
  };

  // DB Save Module Matrix Permissions
  const handleToggleModule = async (empresaId: string, moduleKey: string, currentVal: boolean) => {
    // Local Update
    const updated = empresas.map(e => e.id === empresaId ? { ...e, modulos: { ...e.modulos, [moduleKey]: !currentVal } } : e);
    setEmpresas(updated);

    try {
      const targetEmp = empresas.find(e => e.id === empresaId);
      if (targetEmp) {
        await supabase.from('tenant_modules').upsert({
          tenant_id: empresaId,
          ...targetEmp.modulos,
          [moduleKey]: !currentVal
        }, { onConflict: 'tenant_id' });
      }
    } catch (e: any) {
      console.error('Error updating tenant module in DB:', e.message);
    }
  };

  const handleDeleteEmpresa = async (empresaId: string, razonSocial: string) => {
    if (!confirm(`¿Está seguro de eliminar permanentemente a ${razonSocial} de la base de datos?`)) return;
    try {
      await supabase.from('tenants').delete().eq('id', empresaId);
      await supabase.from('global_audit_logs').insert({
        event_type: 'DELETE_TENANT',
        module_name: 'SuperAdmin',
        user_name: profile?.full_name || user?.email || 'SuperAdmin',
        affected_record: razonSocial,
        criticidad: 'Crítica',
        resultado: 'Exitoso'
      });
      setEmpresas(prev => prev.filter(e => e.id !== empresaId));
    } catch (err: any) {
      alert('Error al eliminar empresa: ' + err.message);
    }
  };

  const handleUpdateEmpresaStatus = async (empresaId: string, nextStatus: string) => {
    try {
      await supabase.from('tenants').update({ status: nextStatus }).eq('id', empresaId);
      setEmpresas(prev => prev.map(e => e.id === empresaId ? { ...e, estado: nextStatus } : e));
      if (selectedEmpresa && selectedEmpresa.id === empresaId) {
        setSelectedEmpresa({ ...selectedEmpresa, estado: nextStatus });
      }
    } catch (err: any) {
      alert('Error al actualizar estado en DB: ' + err.message);
    }
  };

  const [userConnectionFilter, setUserConnectionFilter] = useState<'all' | 'online' | 'offline'>('all');

  const [systemUsers, setSystemUsers] = useState<any[]>([
    { id: '1', name: 'Carlos Breiner', email: 'carlos@cortesbreiner.com', role: 'SuperAdmin', status: 'Activo', totalLogins: 42, lastLogin: '2026-07-22 21:40', isConnected: true, createdAt: '2025-01-01' },
    { id: '2', name: 'Marlin Torres', email: 'marlin@cortesbreiner.com', role: 'Finanzas', status: 'Activo', totalLogins: 18, lastLogin: '2026-07-22 18:15', isConnected: false, createdAt: '2025-02-10' }
  ]);

  const handleToggleUserStatus = async (userId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'Activo' ? 'Inactivo' : 'Activo';
    const isActiveBool = nextStatus === 'Activo';

    setSystemUsers(prev => prev.map(u => u.id === userId ? { ...u, status: nextStatus } : u));

    try {
      await supabase.from('profiles').update({ is_active: isActiveBool }).eq('id', userId);

      await supabase.from('global_audit_logs').insert({
        event_type: 'USER_STATUS_CHANGE',
        module_name: 'SuperAdmin',
        user_name: profile?.full_name || user?.email || 'SuperAdmin',
        affected_record: userId,
        criticidad: 'Media',
        resultado: 'Exitoso',
        previous_value: { status: currentStatus },
        new_value: { status: nextStatus }
      });
    } catch (e: any) {
      console.error('Error updating user status in DB:', e.message);
    }
  };

  const handleDisconnectUser = async (userId: string, userEmail: string) => {
    if (!confirm(`¿Está seguro de expulsar y forzar la desconexión remota de la sesión de ${userEmail}?`)) return;

    try {
      // 1. Update user profile state in DB
      if (userId && userId !== 'current-user') {
        await supabase.from('profiles').update({ is_active: false }).eq('id', userId);
      }

      // 2. Broadcast FORCE_DISCONNECT audit log event
      await supabase.from('global_audit_logs').insert({
        event_type: 'FORCE_DISCONNECT',
        module_name: 'SuperAdmin',
        user_name: profile?.full_name || user?.email || 'SuperAdmin',
        affected_record: userEmail,
        user_id: userId !== 'current-user' ? userId : user?.id,
        criticidad: 'Crítica',
        resultado: 'Exitoso',
        new_value: { target_user: userEmail, action: 'REMOTE_SESSION_KILL' }
      });

      // 3. Update local state
      setSystemUsers(prev => prev.map(u => u.id === userId || u.email === userEmail ? { ...u, isConnected: false, status: 'Inactivo', lastLogin: 'Sesión desconectada remotamente' } : u));

      alert(`⚡ La sesión de ${userEmail} ha sido terminada y el usuario ha sido expulsado de la plataforma.`);

      // If disconnecting current user, log out immediately
      if (user?.email && userEmail && user.email.toLowerCase() === userEmail.toLowerCase()) {
        await supabase.auth.signOut();
        window.location.href = '/login?reason=self_disconnect';
      }
    } catch (e: any) {
      alert('Error al desconectar sesión de usuario: ' + e.message);
    }
  };

  useEffect(() => {
    fetchSuperAdminData();
  }, [user, profile]);

  // 3. SaaS Financial Stats
  const [saasFinancial] = useState({
    mrr: 84500000,
    arr: 1014000000,
    facturacionMensual: 89200000,
    facturacionAnual: 980000000,
    morosos: 3,
    proximasRenovaciones: 8,
    facturasPendientes: 12400000,
    facturasPagadas: 76800000,
    ingresosPorPlan: [
      { plan: 'Enterprise VIP', total: 48000000 },
      { plan: 'Pro Industrial', total: 24500000 },
      { plan: 'Pyme Standard', total: 12000000 }
    ],
    ingresosPorIa: 4800000,
    ingresosPorConsumoGB: 2100000
  });

  // 4. Auditoría Global Logs
  const [auditLogs, setAuditLogs] = useState<any[]>([
    { id: 'AUD-9012', empresa: 'Cortes Breiner S.A.S.', usuario: 'Carlos Breiner (SuperAdmin)', fecha: '2026-07-22 21:40:12', ip: '181.132.45.12', browser: 'Chrome 126.0 (Windows 11)', modulo: 'Financial War Room', accion: 'EXPORT_TAX_REPORT', registro: 'FV-12-8418', valAnterior: '—', valNuevo: 'Generado CSV', timeMs: 142, criticidad: 'Baja', resultado: 'Exitoso' },
    { id: 'AUD-9011', empresa: 'Textiles Andina', usuario: 'Marlin Torres (Contador)', fecha: '2026-07-22 21:15:00', ip: '190.27.120.89', browser: 'Firefox 127.0 (macOS)', modulo: 'SIIGO Live', accion: 'SYNC_CUSTOMER', registro: 'NIT 901458789', valAnterior: 'Inactivo', valNuevo: 'Activo', timeMs: 850, criticidad: 'Media', resultado: 'Exitoso' },
    { id: 'AUD-9010', empresa: 'Moda & Estilo Ltda', usuario: 'Javier Pérez (Corte)', fecha: '2026-07-22 20:30:45', ip: '181.54.12.90', browser: 'Edge 126.0 (Windows 10)', modulo: 'Confección', accion: 'CREATE_COMPOSITE_ORDER', registro: 'CONF-048', valAnterior: '3 cortes separados', valNuevo: 'Lote compuesto', timeMs: 320, criticidad: 'Alta', resultado: 'Exitoso' }
  ]);

  // Support Tickets State
  const [tickets, setTickets] = useState<any[]>([
    { id: 'TCK-1092', subject: 'Error de sincronización cliente SIIGO con NIT especial', requester: 'Maribel Gómez (Contabilidad)', priority: 'Alta', status: 'Abierto', category: 'Integración SIIGO', createdAt: '2026-07-22 14:30', messages: [{ sender: 'Maribel Gómez', text: 'Al guardar cliente con NIT de 10 dígitos saca error 500', time: '14:30' }] },
    { id: 'TCK-1088', subject: 'Ajuste de código de barras para escaner inalámbrico', requester: 'Javier Pérez (Corte)', priority: 'Media', status: 'En Proceso', category: 'Hardware/Impresión', createdAt: '2026-07-21 09:15', messages: [{ sender: 'Javier Pérez', text: 'Requiere código de 8 dígitos para lectura rápida', time: '09:15' }] },
    { id: 'TCK-1075', subject: 'Solicitud de activación módulo de Prenda Compuesta', requester: 'Taller Central', priority: 'Baja', status: 'Cerrado', category: 'Capacitación', createdAt: '2026-07-20 16:40', messages: [{ sender: 'Taller Central', text: 'Confirmado uso de módulo compuesto', time: '16:40' }] }
  ]);

  // 5. Infraestructura Realtime
  const [infra] = useState({
    cpu: 32, ram: 68, disco: 48, dbConnections: 24, redis: 'OK', cacheHitRatio: 98.4,
    workers: '8/8 Online', cronJobs: '12 Activos (0 Fallos)', apiLatencyMs: 45, webSockets: '142 Conexiones',
    backupStatus: 'Copia Completa OK (02:00 AM)', sslStatus: 'Válido (Expira en 280 días)'
  });

  // 6. Asistente IA Consultas
  const [iaQuery, setIaQuery] = useState('');
  const [iaResponses, setIaResponses] = useState<any[]>([
    { q: '¿Qué empresas consumen más almacenamiento?', a: '💡 **Cortes Breiner S.A.S.** encabeza el consumo con 48.5 GB (48.5% de su plan), seguida por **Textiles Andina** con 24.2 GB. Ambas están dentro de parámetros saludables.' },
    { q: '¿Qué clientes están próximos a vencer?', a: '⚠️ **Creaciones Moda & Estilo Ltda** vence el 01 de Agosto (en 9 días). Se sugiere enviar oferta de renovación anticipada con 10% de descuento.' }
  ]);

  const fmtCOP = (n: number) => `$${(Number(n) || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (authLoading) {
    return (
      <div style={{ display: 'flex', height: '70vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ border: '4px solid #f1f5f9', borderTop: '4px solid #80082E', borderRadius: '50%', width: '42px', height: '42px', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 700 }}>Autenticando credenciales de SuperUsuario Master...</p>
      </div>
    );
  }

  // Strict Lockout for Non-SuperUsers
  if (!isSuperUser) {
    return (
      <div style={{ display: 'flex', minHeight: '75vh', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ backgroundColor: 'white', border: '2px solid #ef4444', borderRadius: '20px', padding: '3rem 2.5rem', maxWidth: '520px', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(239, 68, 68, 0.15)' }}>
          <div style={{ width: '70px', height: '70px', borderRadius: '50%', backgroundColor: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', border: '2px solid #fca5a5' }}>
            <Lock size={36} />
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 950, color: '#0f172a', margin: '0 0 0.5rem' }}>Acceso Restringido - SuperAdmin Master</h2>
          <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
            Esta suite constituye la torre de control multitenant de Brainer ERP. Solo el perfil **SuperAdmin Master** posee permisos para supervisar licencias, auditoría global y consumo de servidor.
          </p>
          <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '10px', fontSize: '0.78rem', color: '#475569', fontWeight: 700 }}>
            Usuario actual: <span style={{ color: '#80082E' }}>{profile?.full_name || user?.email}</span> ({profile?.roles?.name || 'Sin rol master'})
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '4rem', fontFamily: "'Inter', system-ui, sans-serif" }}>
      
      {/* 👑 SUPER ADMIN TORRE DE CONTROL BANNER SUPERIOR ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', color: 'white',
        padding: '1.5rem 2rem', borderRadius: '20px', boxShadow: '0 10px 25px rgba(15, 23, 42, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg, #80082E 0%, #d97706 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 15px rgba(128, 8, 46, 0.4)', flexShrink: 0
          }}>
            <ShieldAlert size={30} color="white" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 950, margin: 0, letterSpacing: '-0.02em' }}>Super Admin Control Suite 360°</h1>
              <span style={{ backgroundColor: '#d97706', color: 'white', fontSize: '0.68rem', fontWeight: 900, padding: '0.2rem 0.65rem', borderRadius: '999px', textTransform: 'uppercase' }}>MASTER ERP SaaS</span>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: '0.25rem 0 0' }}>Torre de control multitena​nt para empresas, facturación SaaS, consumo, auditoría e IA</p>
          </div>
        </div>

        {/* Global Toolbar */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={() => alert('Generando backup global de base de datos multitenant...')}
            style={{ backgroundColor: '#334155', color: 'white', border: 'none', borderRadius: '10px', padding: '0.65rem 1.1rem', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Database size={15} /> Backup Global
          </button>
        </div>
      </div>

      {/* 🧭 NAVEGACIÓN DE PESTAÑAS 100% FLUIDA SIN SCROLL (UX ENTERPRISE) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '0.5rem',
        backgroundColor: 'white',
        padding: '0.6rem',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
      }}>
        {[
          { key: 'dashboard_ejecutivo', label: 'Dashboard Global', icon: '📊' },
          { key: 'empresas', label: 'Empresas & Licencias', icon: '🏢' },
          { key: 'modulos', label: 'Matriz de Módulos', icon: '🧩' },
          { key: 'facturacion_saas', label: 'Facturación SaaS', icon: '💳' },
          { key: 'centro_consumo', label: 'Centro de Consumo', icon: '⚡' },
          { key: 'auditoria_global', label: 'Auditoría Global', icon: '🛡️' },
          { key: 'infraestructura', label: 'Infraestructura', icon: '🖥️' },
          { key: 'tickets', label: 'Soporte & Tickets', icon: '🎫' },
          { key: 'ia_asistente', label: 'Asistente IA', icon: '🤖' },
          { key: 'reportes', label: 'Reportes Ejecutivos', icon: '📑' }
        ].map(({ key, label, icon }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key as SuperAdminTab)}
              style={{
                border: 'none',
                borderRadius: '10px',
                padding: '0.65rem 0.5rem',
                fontSize: '0.76rem',
                fontWeight: isActive ? '900' : '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease-in-out',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                backgroundColor: isActive ? '#80082E' : '#f8fafc',
                color: isActive ? 'white' : '#475569',
                boxShadow: isActive ? '0 4px 12px rgba(128, 8, 46, 0.25)' : 'none'
              }}
            >
              <span style={{ fontSize: '0.9rem' }}>{icon}</span>
              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{label}</span>
            </button>
          );
        })}
      </div>

      {/* ── 1. DASHBOARD EJECUTIVO GLOBAL ── */}
      {activeTab === 'dashboard_ejecutivo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Seccion 1: Métricas de Empresas */}
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', margin: '0 0 0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>🏢 MÉTRICAS GLOBAL DE EMPRESAS CLIENTES</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.15rem' }}>
              <div style={{ background: 'linear-gradient(135deg, #80082E 0%, #a21040 100%)', color: 'white', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 6px 16px rgba(128,8,46,0.2)' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.9 }}>EMPRESAS REGISTRADAS</span>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 950, margin: '0.2rem 0 0.1rem' }}>{globalStats.empresas.registradas}</h2>
                <span style={{ fontSize: '0.72rem', opacity: 0.85 }}>+{globalStats.empresas.nuevasMes} nuevas este mes</span>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', color: 'white', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 6px 16px rgba(5,150,105,0.2)' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.9 }}>EMPRESAS ACTIVAS</span>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 950, margin: '0.2rem 0 0.1rem' }}>{globalStats.empresas.activas}</h2>
                <span style={{ fontSize: '0.72rem', opacity: 0.85 }}>90.1% de retención operacional</span>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)', color: 'white', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 6px 16px rgba(217,119,6,0.2)' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.9 }}>EN PRUEBA (TRIAL)</span>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 950, margin: '0.2rem 0 0.1rem' }}>{globalStats.empresas.trial}</h2>
                <span style={{ fontSize: '0.72rem', opacity: 0.85 }}>Conversión estimada: 75%</span>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)', color: 'white', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 6px 16px rgba(220,38,38,0.2)' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.9 }}>SUSPENDIDAS / VENCIDAS</span>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 950, margin: '0.2rem 0 0.1rem' }}>{globalStats.empresas.suspendidas + globalStats.empresas.licenciaVencida}</h2>
                <span style={{ fontSize: '0.72rem', opacity: 0.85 }}>{globalStats.empresas.bloqueadas} bloqueadas por mora</span>
              </div>
            </div>
          </div>

          {/* Sección 2: Usuarios Consolidados */}
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', margin: '0 0 0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>👥 CONCURRENCIA Y USUARIOS MULTITENANT</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.15rem' }}>
              <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>USUARIOS REGISTRADOS</span>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 950, color: '#0f172a', margin: '0.2rem 0 0.1rem' }}>{globalStats.usuarios.registrados}</h2>
                <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 700 }}>+{globalStats.usuarios.nuevosMes} registrados este mes</span>
              </div>
              <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>ACTIVOS HOY</span>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 950, color: '#0f172a', margin: '0.2rem 0 0.1rem' }}>{globalStats.usuarios.activosHoy}</h2>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>47% del total de licencias</span>
              </div>
              <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>CONECTADOS EN TIEMPO REAL</span>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 950, color: '#2563eb', margin: '0.2rem 0 0.1rem' }}>{globalStats.usuarios.conectadosRealtime}</h2>
                <span style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 700 }}>● Sincronizados vía WebSockets</span>
              </div>
              <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>PROMEDIO POR EMPRESA</span>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 950, color: '#0f172a', margin: '0.2rem 0 0.1rem' }}>{globalStats.usuarios.porEmpresaAvg}</h2>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{globalStats.usuarios.inactivos} inactivos {'>'} 30 días</span>
              </div>
            </div>
          </div>

          {/* Sección 3: Consumo Consolidado de Recursos */}
          <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', margin: '0 0 1.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>⚡ CONSUMO CONSOLIDADO MULTITENANT</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>ALMACENAMIENTO GB</span>
                <strong style={{ fontSize: '1.1rem', color: '#80082E' }}>{globalStats.consumoConsolidado.almacenamientoGb} GB / {globalStats.consumoConsolidado.almacenamientoTotalGb} GB</strong>
                <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', marginTop: '0.2rem' }}>Restante: {globalStats.consumoConsolidado.espacioRestanteGb} GB</span>
              </div>
              <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>IMÁGENES & PDFS</span>
                <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{(globalStats.consumoConsolidado.imagenes + globalStats.consumoConsolidado.pdfs).toLocaleString()}</strong>
                <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', marginTop: '0.2rem' }}>{globalStats.consumoConsolidado.pdfs.toLocaleString()} PDFs generados</span>
              </div>
              <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>STICKERS ETIQUETAS</span>
                <strong style={{ fontSize: '1.1rem', color: '#2563eb' }}>{globalStats.consumoConsolidado.stickersGenerados.toLocaleString()}</strong>
                <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', marginTop: '0.2rem' }}>Impresiones 15x15 cm</span>
              </div>
              <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>FACTURAS EMITIDAS</span>
                <strong style={{ fontSize: '1.1rem', color: '#059669' }}>{globalStats.consumoConsolidado.facturasEmitidas.toLocaleString()}</strong>
                <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', marginTop: '0.2rem' }}>Integración SIIGO API</span>
              </div>
              <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>CONSUMO IA TOKENS</span>
                <strong style={{ fontSize: '1.1rem', color: '#7c3aed' }}>{(globalStats.consumoConsolidado.consumoIaTokens / 1000000).toFixed(1)}M Tokens</strong>
                <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', marginTop: '0.2rem' }}>{globalStats.consumoConsolidado.whatsappEnviados.toLocaleString()} msgs WhatsApp</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. FICHA COMPLETA DE EMPRESAS & LICENCIAMIENTO ── */}
      {activeTab === 'empresas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>Gestión de Empresas & Fichas de Licenciamiento</h3>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.15rem 0 0' }}>Administra planes, fechas de vencimiento, renovaciones y usuarios asignados por tenant</p>
              </div>
              <button
                onClick={() => setShowCreateEmpresaModal(true)}
                style={{ backgroundColor: '#80082E', color: 'white', border: 'none', borderRadius: '8px', padding: '0.6rem 1.25rem', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}
              >
                ➕ Registrar Nueva Empresa
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem' }}>Razón Social / NIT</th>
                    <th style={{ padding: '0.75rem' }}>Plan Contratado</th>
                    <th style={{ padding: '0.75rem' }}>Vencimiento</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Valor Mensual</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Usuarios Activos</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Estado</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Acciones Master</th>
                  </tr>
                </thead>
                <tbody>
                  {empresas.map((emp) => (
                    <tr key={emp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.85rem' }}>
                        <strong style={{ fontSize: '0.85rem', color: '#0f172a', display: 'block' }}>{emp.razonSocial}</strong>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>NIT: {emp.nit}</span>
                      </td>
                      <td style={{ padding: '0.85rem' }}>
                        <span style={{ backgroundColor: '#fdf2f4', color: '#80082E', border: '1px solid #fbcfe8', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>
                          {emp.plan}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem', color: '#475569', fontWeight: 700 }}>
                        {emp.fechaVencimiento}
                      </td>
                      <td style={{ padding: '0.85rem', textAlign: 'right', fontWeight: 900, color: '#059669' }}>
                        {fmtCOP(emp.valorMensual)}
                      </td>
                      <td style={{ padding: '0.85rem', textAlign: 'center', fontWeight: 800 }}>
                        {emp.usuariosActivos} / {emp.usuariosMax}
                      </td>
                      <td style={{ padding: '0.85rem', textAlign: 'center' }}>
                        <span style={{
                          backgroundColor: emp.estado === 'Activa' ? '#dcfce7' : emp.estado === 'Trial' ? '#fef3c7' : '#fef2f2',
                          color: emp.estado === 'Activa' ? '#15803d' : emp.estado === 'Trial' ? '#b45309' : '#dc2626',
                          padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 900
                        }}>
                          ● {emp.estado}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                          <button
                            onClick={() => setSelectedEmpresa(emp)}
                            style={{ backgroundColor: '#0f172a', color: 'white', border: 'none', padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer' }}
                          >
                            👁️ Ver Ficha
                          </button>
                          <button
                            onClick={() => handleDeleteEmpresa(emp.id, emp.razonSocial)}
                            style={{ backgroundColor: '#dc2626', color: 'white', border: 'none', padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer' }}
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. MATRIZ DE PERMISOS Y MÓDULOS POR EMPRESA ── */}
      {activeTab === 'modulos' && (
        <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', margin: '0 0 1rem' }}>Matriz Global de Módulos Contratados por Empresa</h3>
          <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 1.25rem' }}>Activa o desactiva módulos de forma inmediata por empresa cliente</p>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'center' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Empresa Cliente</th>
                <th style={{ padding: '0.75rem' }}>Producción</th>
                <th style={{ padding: '0.75rem' }}>Confección</th>
                <th style={{ padding: '0.75rem' }}>Calidad</th>
                <th style={{ padding: '0.75rem' }}>Inventario</th>
                <th style={{ padding: '0.75rem' }}>POS</th>
                <th style={{ padding: '0.75rem' }}>Compras</th>
                <th style={{ padding: '0.75rem' }}>Talleres</th>
                <th style={{ padding: '0.75rem' }}>CRM</th>
                <th style={{ padding: '0.75rem' }}>Nómina</th>
                <th style={{ padding: '0.75rem' }}>IA</th>
                <th style={{ padding: '0.75rem' }}>BI</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((emp) => (
                <tr key={emp.id} style={{ borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}>
                  <td style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 800, color: '#0f172a' }}>{emp.razonSocial}</td>
                  {['produccion', 'confeccion', 'calidad', 'inventarios', 'pos', 'compras', 'talleres', 'crm', 'nomina', 'ia', 'bi'].map((m) => (
                    <td key={m} style={{ padding: '0.75rem' }}>
                      <input
                        type="checkbox"
                        checked={!!emp.modulos[m]}
                        onChange={() => handleToggleModule(emp.id, m, !!emp.modulos[m])}
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 4. FACTURACIÓN SAAS (MRR / ARR / INGRESOS POR PLAN Y MÓDULO) ── */}
      {activeTab === 'facturacion_saas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem' }}>
            <div style={{ background: 'linear-gradient(135deg, #80082E 0%, #a21040 100%)', color: 'white', borderRadius: '16px', padding: '1.35rem', boxShadow: '0 6px 16px rgba(128,8,46,0.2)' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.9 }}>MRR (INGRESO MENSUAL RECURRENTE)</span>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 950, margin: '0.3rem 0 0.1rem' }}>{fmtCOP(saasFinancial.mrr)}</h2>
              <span style={{ fontSize: '0.72rem', opacity: 0.85 }}>Recaudo mensual de contratos</span>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', color: 'white', borderRadius: '16px', padding: '1.35rem', boxShadow: '0 6px 16px rgba(5,150,105,0.2)' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.9 }}>ARR (INGRESO ANUALIZADO)</span>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 950, margin: '0.3rem 0 0.1rem' }}>{fmtCOP(saasFinancial.arr)}</h2>
              <span style={{ fontSize: '0.72rem', opacity: 0.85 }}>Proyección anual de SaaS</span>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: 'white', borderRadius: '16px', padding: '1.35rem', boxShadow: '0 6px 16px rgba(37,99,235,0.2)' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.9 }}>FACTURADO ESTE MES</span>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 950, margin: '0.3rem 0 0.1rem' }}>{fmtCOP(saasFinancial.facturacionMensual)}</h2>
              <span style={{ fontSize: '0.72rem', opacity: 0.85 }}>{fmtCOP(saasFinancial.facturasPagadas)} cobrados</span>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)', color: 'white', borderRadius: '16px', padding: '1.35rem', boxShadow: '0 6px 16px rgba(234,88,12,0.2)' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.9 }}>MOROSIDAD / PENDIENTE</span>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 950, margin: '0.3rem 0 0.1rem' }}>{fmtCOP(saasFinancial.facturasPendientes)}</h2>
              <span style={{ fontSize: '0.72rem', opacity: 0.85 }}>{saasFinancial.morosos} empresas en mora</span>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. CENTRO DE CONSUMO & ALERTAS DE PLAN ── */}
      {activeTab === 'centro_consumo' && (
        <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', margin: '0 0 1rem' }}>Centro de Consumo por Empresa & Alertas del 80%, 90% y 100%</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem' }}>Empresa</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>GB Usados</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Consultas API</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Tokens IA</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Stickers</th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }}>Alerta Consumo</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((e) => {
                const pctStorage = Math.round((e.consumo.gb / 50) * 100);
                return (
                  <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 800, color: '#0f172a' }}>{e.razonSocial}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700 }}>{e.consumo.gb} GB (50 GB)</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>{e.consumo.api.toLocaleString()}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>{e.consumo.iaTokens.toLocaleString()}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>{e.consumo.stickers.toLocaleString()}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <span style={{
                        padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 900,
                        backgroundColor: pctStorage >= 90 ? '#fee2e2' : pctStorage >= 80 ? '#fef3c7' : '#dcfce7',
                        color: pctStorage >= 90 ? '#b91c1c' : pctStorage >= 80 ? '#b45309' : '#15803d'
                      }}>
                        {pctStorage >= 90 ? `🔴 Crítico (${pctStorage}%)` : pctStorage >= 80 ? `🟡 Advertencia (${pctStorage}%)` : `🟢 OK (${pctStorage}%)`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 6. AUDITORÍA GLOBAL Y GESTIÓN DE USUARIOS Y ACCESOS ── */}
      {activeTab === 'auditoria_global' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Panel de Gestión de Usuarios y Estado de Conexión */}
          <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>👥 Control de Accesos, Ingresos y Usuarios Conectados</h3>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.2rem 0 0' }}>Supervisa quiénes están conectados actualmente, historial de ingresos y gestiona permisos</p>
              </div>

              {/* Connection Filter Buttons */}
              <div style={{ display: 'flex', gap: '0.4rem', backgroundColor: '#f1f5f9', padding: '0.3rem', borderRadius: '10px' }}>
                <button
                  onClick={() => setUserConnectionFilter('all')}
                  style={{
                    border: 'none', borderRadius: '8px', padding: '0.35rem 0.85rem', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer',
                    backgroundColor: userConnectionFilter === 'all' ? '#80082E' : 'transparent',
                    color: userConnectionFilter === 'all' ? 'white' : '#475569'
                  }}
                >
                  Todos ({systemUsers.length})
                </button>
                <button
                  onClick={() => setUserConnectionFilter('online')}
                  style={{
                    border: 'none', borderRadius: '8px', padding: '0.35rem 0.85rem', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer',
                    backgroundColor: userConnectionFilter === 'online' ? '#15803d' : 'transparent',
                    color: userConnectionFilter === 'online' ? 'white' : '#475569'
                  }}
                >
                  🟢 Conectados ({systemUsers.filter(u => u.isConnected).length})
                </button>
                <button
                  onClick={() => setUserConnectionFilter('offline')}
                  style={{
                    border: 'none', borderRadius: '8px', padding: '0.35rem 0.85rem', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer',
                    backgroundColor: userConnectionFilter === 'offline' ? '#475569' : 'transparent',
                    color: userConnectionFilter === 'offline' ? 'white' : '#475569'
                  }}
                >
                  ⚪ Desconectados ({systemUsers.filter(u => !u.isConnected).length})
                </button>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                    <th style={{ padding: '0.7rem' }}>Usuario / Email</th>
                    <th style={{ padding: '0.7rem' }}>Rol</th>
                    <th style={{ padding: '0.7rem', textAlign: 'center' }}>Conexión</th>
                    <th style={{ padding: '0.7rem', textAlign: 'center' }}>Total Ingresos</th>
                    <th style={{ padding: '0.7rem' }}>Último Ingreso</th>
                    <th style={{ padding: '0.7rem', textAlign: 'center' }}>Permiso Acceso</th>
                    <th style={{ padding: '0.7rem', textAlign: 'center' }}>Acción Master</th>
                  </tr>
                </thead>
                <tbody>
                  {systemUsers
                    .filter(u => {
                      if (userConnectionFilter === 'online') return u.isConnected;
                      if (userConnectionFilter === 'offline') return !u.isConnected;
                      return true;
                    })
                    .map((u) => (
                      <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.7rem' }}>
                          <strong style={{ fontSize: '0.85rem', color: '#0f172a', display: 'block' }}>{u.name}</strong>
                          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{u.email}</span>
                        </td>
                        <td style={{ padding: '0.7rem', fontWeight: 700, color: '#80082E' }}>{u.role}</td>
                        <td style={{ padding: '0.7rem', textAlign: 'center' }}>
                          <span style={{
                            padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 900,
                            backgroundColor: u.isConnected ? '#dcfce7' : '#f1f5f9',
                            color: u.isConnected ? '#15803d' : '#64748b'
                          }}>
                            {u.isConnected ? '🟢 Conectado (Online)' : '⚪ Desconectado'}
                          </span>
                        </td>
                        <td style={{ padding: '0.7rem', textAlign: 'center' }}>
                          <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '0.2rem 0.65rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 900 }}>
                            🔑 {u.totalLogins || 0} ingresos
                          </span>
                        </td>
                        <td style={{ padding: '0.7rem', fontSize: '0.75rem', color: '#475569', fontWeight: 700 }}>
                          {u.lastLogin}
                        </td>
                        <td style={{ padding: '0.7rem', textAlign: 'center' }}>
                          <span style={{
                            padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 900,
                            backgroundColor: u.status === 'Activo' ? '#dcfce7' : '#fef2f2',
                            color: u.status === 'Activo' ? '#15803d' : '#dc2626'
                          }}>
                            ● {u.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.7rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                            {u.isConnected && (
                              <button
                                onClick={() => handleDisconnectUser(u.id, u.email)}
                                style={{
                                  backgroundColor: '#ea580c', color: 'white', border: 'none', padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer'
                                }}
                                title="Cerrar la sesión remota de este usuario inmediatamente"
                              >
                                🔌 Desconectar
                              </button>
                            )}
                            <button
                              onClick={() => handleToggleUserStatus(u.id, u.status)}
                              style={{
                                backgroundColor: u.status === 'Activo' ? '#dc2626' : '#059669',
                                color: 'white', border: 'none', padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer'
                              }}
                            >
                              {u.status === 'Activo' ? '🚫 Suspender' : '✅ Reactivar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Panel de Auditoría Forense de Logins y Acciones */}
          <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', margin: '0 0 1rem' }}>🛡️ Registro de Auditoría General de Ingresos y Acciones</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                  <th style={{ padding: '0.7rem' }}>Empresa</th>
                  <th style={{ padding: '0.7rem' }}>Usuario</th>
                  <th style={{ padding: '0.7rem' }}>Fecha / Hora</th>
                  <th style={{ padding: '0.7rem' }}>Módulo / Acción</th>
                  <th style={{ padding: '0.7rem' }}>IP / Dispositivo</th>
                  <th style={{ padding: '0.7rem', textAlign: 'right' }}>Latencia</th>
                  <th style={{ padding: '0.7rem', textAlign: 'center' }}>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((l) => (
                  <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.7rem', fontWeight: 800, color: '#80082E' }}>{l.empresa}</td>
                    <td style={{ padding: '0.7rem', fontWeight: 700, color: '#0f172a' }}>{l.usuario}</td>
                    <td style={{ padding: '0.7rem', color: '#64748b' }}>{l.fecha}</td>
                    <td style={{ padding: '0.7rem' }}>
                      <strong style={{ color: '#0f172a', display: 'block' }}>{l.modulo}</strong>
                      <span style={{ fontSize: '0.7rem', color: '#475569' }}>{l.accion}</span>
                    </td>
                    <td style={{ padding: '0.7rem', fontFamily: 'monospace', color: '#475569' }}>{l.ip}</td>
                    <td style={{ padding: '0.7rem', textAlign: 'right', fontWeight: 700, color: '#059669' }}>{l.timeMs} ms</td>
                    <td style={{ padding: '0.7rem', textAlign: 'center' }}>
                      <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 900 }}>
                        ✓ {l.resultado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 7. INFRAESTRUCTURA REALTIME ── */}
      {activeTab === 'infraestructura' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem' }}>
          <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.35rem' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>CPU SERVER ENGINE</span>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 950, color: '#0f172a', margin: '0.2rem 0' }}>{infra.cpu}%</h2>
            <span style={{ fontSize: '0.72rem', color: '#16a34a' }}>● Latencia API: {infra.apiLatencyMs}ms</span>
          </div>
          <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.35rem' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>MEMORIA RAM</span>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 950, color: '#0f172a', margin: '0.2rem 0' }}>{infra.ram}%</h2>
            <span style={{ fontSize: '0.72rem', color: '#2563eb' }}>Cache Hit Ratio: {infra.cacheHitRatio}%</span>
          </div>
          <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.35rem' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>WORKERS & CRON JOBS</span>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 950, color: '#0f172a', margin: '0.2rem 0' }}>{infra.workers}</h2>
            <span style={{ fontSize: '0.72rem', color: '#059669' }}>{infra.cronJobs}</span>
          </div>
          <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.35rem' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>ESTADO SSL & BACKUPS</span>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 950, color: '#0f172a', margin: '0.2rem 0' }}>🔒 SSL Válido</h2>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{infra.backupStatus}</span>
          </div>
        </div>
      )}

      {/* ── 8. SOPORTE & TICKETS ── */}
      {activeTab === 'tickets' && (
        <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', margin: '0 0 1rem' }}>Mesa de Soporte por Empresa</h3>
          <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 1.25rem' }}>Atención directa de casos críticos y SLA</p>
        </div>
      )}

      {/* ── 9. INTELIGENCIA ARTIFICIAL ASISTENTE ADMINISTRATIVO ── */}
      {activeTab === 'ia_asistente' && (
        <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <Bot size={28} style={{ color: '#80082E' }} />
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>Asistente de Inteligencia Artificial para Decisiones de Negocio</h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>Analiza patrones de consumo, uso de módulos y genera sugerencias comerciales</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            {iaResponses.map((item, idx) => (
              <div key={idx} style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '1rem' }}>
                <strong style={{ fontSize: '0.85rem', color: '#0f172a', display: 'block', marginBottom: '0.4rem' }}>❓ {item.q}</strong>
                <p style={{ fontSize: '0.82rem', color: '#334155', margin: 0, lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: item.a.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <input
              type="text"
              placeholder="Haz una pregunta a la IA sobre empresas, consumo o facturación..."
              value={iaQuery}
              onChange={(e) => setIaQuery(e.target.value)}
              style={{ flex: 1, padding: '0.7rem 1rem', borderRadius: '10px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem' }}
            />
            <button
              onClick={() => {
                if (!iaQuery) return;
                setIaResponses([...iaResponses, { q: iaQuery, a: '🤖 Analizando métricas multitenant... Las empresas con mayor uso de tokens IA este mes muestran una conversión a POS del 85%.' }]);
                setIaQuery('');
              }}
              style={{ backgroundColor: '#80082E', color: 'white', border: 'none', padding: '0.7rem 1.5rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer' }}
            >
              Consultar IA
            </button>
          </div>
        </div>
      )}

      {/* ── 10. REPORTES EJECUTIVOS ── */}
      {activeTab === 'reportes' && (
        <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', margin: '0 0 1rem' }}>Exportación & Reportes Programados (PDF, Excel, CSV)</h3>
          <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 1.25rem' }}>Genera reportes de consumo, licencias y auditoría para junta directiva</p>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={() => alert('Exportando consolidado a Excel...')} style={{ backgroundColor: '#059669', color: 'white', border: 'none', padding: '0.65rem 1.25rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}>📊 Exportar Consumo Excel</button>
            <button onClick={() => alert('Generando informe PDF...')} style={{ backgroundColor: '#dc2626', color: 'white', border: 'none', padding: '0.65rem 1.25rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}>📄 Exportar Auditoría PDF</button>
          </div>
        </div>
      )}

      {/* ➕ MODAL PARA CREAR NUEVA EMPRESA EN BASE DE DATOS ── */}
      {showCreateEmpresaModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1.5rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '2rem', width: '100%', maxWidth: '540px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 950, color: '#0f172a', margin: 0 }}>🏢 Registrar Nueva Empresa Cliente</h3>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.2rem 0 0' }}>Crea el tenant en Supabase con matriz de módulos por defecto</p>
              </div>
              <button onClick={() => setShowCreateEmpresaModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b', fontSize: '1.2rem', fontWeight: 900 }}>✕</button>
            </div>

            <form onSubmit={handleCreateEmpresa} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#475569', marginBottom: '0.35rem' }}>Razón Social / Nombre Comercial *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Confecciones El Dorado S.A.S."
                  value={newEmpresa.razonSocial}
                  onChange={e => setNewEmpresa({ ...newEmpresa, razonSocial: e.target.value })}
                  style={{ width: '100%', padding: '0.7rem 0.9rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#475569', marginBottom: '0.35rem' }}>NIT / Identificación Tributaria *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. 901.890.123-4"
                  value={newEmpresa.nit}
                  onChange={e => setNewEmpresa({ ...newEmpresa, nit: e.target.value })}
                  style={{ width: '100%', padding: '0.7rem 0.9rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#475569', marginBottom: '0.35rem' }}>Plan Contratado</label>
                  <select
                    value={newEmpresa.planCode}
                    onChange={e => setNewEmpresa({ ...newEmpresa, planCode: e.target.value })}
                    style={{ width: '100%', padding: '0.7rem 0.9rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem' }}
                  >
                    <option value="Enterprise VIP">Enterprise VIP</option>
                    <option value="Pro Industrial">Pro Industrial</option>
                    <option value="Pyme Standard">Pyme Standard</option>
                    <option value="Trial Free">Trial Free</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#475569', marginBottom: '0.35rem' }}>Valor Mensual (COP)</label>
                  <input
                    type="number"
                    value={newEmpresa.valorMensual}
                    onChange={e => setNewEmpresa({ ...newEmpresa, valorMensual: Number(e.target.value) })}
                    style={{ width: '100%', padding: '0.7rem 0.9rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowCreateEmpresaModal(false)} style={{ backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', padding: '0.7rem 1.25rem', fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" style={{ backgroundColor: '#80082E', color: 'white', border: 'none', borderRadius: '8px', padding: '0.7rem 1.5rem', fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer' }}>💾 Guardar Empresa en DB</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 👁️ MODAL FICHA COMPLETA DE EMPRESA Y ACCIONES DB ── */}
      {selectedEmpresa && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1.5rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '2rem', width: '100%', maxWidth: '620px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 950, color: '#0f172a', margin: 0 }}>🏢 {selectedEmpresa.razonSocial}</h3>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.2rem 0 0' }}>NIT: {selectedEmpresa.nit} | Ficha Completa de Licenciamiento</p>
              </div>
              <button onClick={() => setSelectedEmpresa(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b', fontSize: '1.2rem', fontWeight: 900 }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Plan Contratado</span>
                  <strong style={{ fontSize: '1rem', color: '#80082E' }}>{selectedEmpresa.plan}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Estado Actual</span>
                  <span style={{
                    padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.74rem', fontWeight: 900, display: 'inline-block', marginTop: '0.2rem',
                    backgroundColor: selectedEmpresa.estado === 'Activa' ? '#dcfce7' : selectedEmpresa.estado === 'Trial' ? '#fef3c7' : '#fef2f2',
                    color: selectedEmpresa.estado === 'Activa' ? '#15803d' : selectedEmpresa.estado === 'Trial' ? '#b45309' : '#dc2626'
                  }}>
                    ● {selectedEmpresa.estado}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Valor Mensual</span>
                  <strong style={{ fontSize: '0.95rem', color: '#059669' }}>{fmtCOP(selectedEmpresa.valorMensual)}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Fecha Vencimiento</span>
                  <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{selectedEmpresa.fechaVencimiento}</strong>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 900, color: '#0f172a', margin: '0 0 0.6rem' }}>Acciones de Gestión de Licencia:</h4>
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <button onClick={() => handleUpdateEmpresaStatus(selectedEmpresa.id, 'Activa')} style={{ backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 0.9rem', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}>✅ Activar Empresa</button>
                  <button onClick={() => handleUpdateEmpresaStatus(selectedEmpresa.id, 'Suspendida')} style={{ backgroundColor: '#d97706', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 0.9rem', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}>⚠️ Suspender Empresa</button>
                  <button onClick={() => handleUpdateEmpresaStatus(selectedEmpresa.id, 'Bloqueada')} style={{ backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 0.9rem', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}>🔒 Bloquear por Mora</button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                <button onClick={() => { handleDeleteEmpresa(selectedEmpresa.id, selectedEmpresa.razonSocial); setSelectedEmpresa(null); }} style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '8px', padding: '0.6rem 1.1rem', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}>🗑️ Eliminar Empresa Permanentemente</button>
                <button onClick={() => setSelectedEmpresa(null)} style={{ backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', padding: '0.6rem 1.25rem', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}>Cerrar Ficha</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
