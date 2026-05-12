'use client';

import { 
  ArrowUpRight, 
  Plus, 
  Upload, 
  Clock, 
  Play, 
  Square,
  MoreVertical,
  CheckCircle2,
  Scissors,
  Package
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const barData = [
  { name: 'L', value: 40 },
  { name: 'M', value: 70 },
  { name: 'X', value: 85 },
  { name: 'J', value: 45 },
  { name: 'V', value: 55 },
  { name: 'S', value: 30 },
];

const pieData = [
  { name: 'Completado', value: 41 },
  { name: 'En Proceso', value: 35 },
  { name: 'Pendiente', value: 24 },
];

const COLORS = ['#104433', '#A7F3D0', '#e2e8f0'];

export default function Dashboard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>Panel de Control</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Planifica, prioriza y gestiona las órdenes de corte con facilidad.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-primary">
            <Plus size={18} /> Nueva Orden
          </button>
          <button className="btn btn-secondary">
            <Upload size={18} /> Importar Datos
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="dashboard-grid">
        <div className="card stat-card" style={{ backgroundColor: 'var(--primary)', color: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.875rem', opacity: 0.8 }}>Órdenes Totales</span>
            <ArrowUpRight size={16} />
          </div>
          <div className="stat-value">24</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', opacity: 0.8 }}>
             <span>▲ 5% incremento del mes pasado</span>
          </div>
          <div style={{ marginTop: '1rem', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px' }}>
            <div style={{ width: '74%', height: '100%', background: 'white', borderRadius: '2px' }}></div>
          </div>
        </div>

        <div className="card stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Órdenes Cortadas</span>
            <ArrowUpRight size={16} color="var(--text-muted)" />
          </div>
          <div className="stat-value">10</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
             <span>▲ 8% incremento del mes pasado</span>
          </div>
        </div>

        <div className="card stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">En Proceso</span>
            <ArrowUpRight size={16} color="var(--text-muted)" />
          </div>
          <div className="stat-value">12</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
             <span>▲ 2% incremento del mes pasado</span>
          </div>
        </div>

        <div className="card stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label">Pendientes</span>
            <ArrowUpRight size={16} color="var(--text-muted)" />
          </div>
          <div className="stat-value">2</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
             <span>Requieren aprobación</span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1.5rem' }}>
        {/* Fabric Consumption Chart */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Consumo de Tela</h3>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: 'transparent' }} 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar 
                  dataKey="value" 
                  fill="var(--primary)" 
                  radius={[6, 6, 0, 0]} 
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Next Cut Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ marginBottom: '0.5rem' }}>Próximo Corte</h3>
            <p style={{ fontSize: '0.875rem', fontWeight: '600' }}>Producción MANGO LXL</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
              <Clock size={14} />
              <span>Hoy: 02:00 pm - 04:00 pm</span>
            </div>
          </div>
          
          <div style={{ marginTop: '2rem' }}>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              <Scissors size={18} /> Iniciar Corte
            </button>
          </div>
        </div>

        {/* Latest Orders */}
        <div className="card" style={{ gridRow: 'span 2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3>Últimas Órdenes</h3>
            <button style={{ color: 'var(--primary)', fontSize: '0.75rem', fontWeight: '600' }}>+ Nueva</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {[
              { title: 'Desarrollo API', date: 'Nov 26, 2024', color: '#6366f1' },
              { title: 'Flujo de Onboarding', date: 'Nov 20, 2024', color: '#10b981' },
              { title: 'Construir Dashboard', date: 'Nov 10, 2024', color: '#8b5cf6' },
              { title: 'Optimizar Carga', date: 'Dec 5, 2024', color: '#f59e0b' },
            ].map((order, i) => (
              <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: `${order.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Package size={16} color={order.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: '600' }}>{order.title}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Due date: {order.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Team Collaboration */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3>Colaboración de Equipo</h3>
            <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>+ Añadir Miembro</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { name: 'Alexandra Deff', task: 'Trabajando en Repositorio GitHub', status: 'Completado' },
              { name: 'Edwin Adenike', task: 'Trabajando en Sistema de Autenticación', status: 'En Proceso' },
              { name: 'Isaac Oluwatemilorun', task: 'Trabajando en Funcionalidad de Búsqueda', status: 'Pendiente' },
              { name: 'David Oshodi', task: 'Trabajando en Layout Responsivo', status: 'En Proceso' },
            ].map((member, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#f1f5f9' }}></div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '0.8125rem', fontWeight: '600' }}>{member.name}</p>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>{member.task}</p>
                </div>
                <span className={`badge ${
                  member.status === 'Completado' ? 'badge-success' : 
                  member.status === 'En Proceso' ? 'badge-info' : 'badge-warning'
                }`} style={{ fontSize: '0.625rem' }}>
                  {member.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Project Progress */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 style={{ alignSelf: 'flex-start', marginBottom: '1rem' }}>Progreso de Proyectos</h3>
          <div style={{ height: '180px', width: '100%', position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
              <p style={{ fontSize: '1.5rem', fontWeight: '700' }}>41%</p>
              <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>Proyectos Terminados</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {pieData.map((entry, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS[index] }}></div>
                <span>{entry.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Time Tracker */}
        <div className="card" style={{ backgroundColor: 'var(--primary)', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem' }}>Rastreador de Tiempo</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: '700', letterSpacing: '0.1em' }}>01:24:08</div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'white', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Play size={20} fill="var(--primary)" />
            </button>
            <button style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#ef4444', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Square size={16} fill="white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
