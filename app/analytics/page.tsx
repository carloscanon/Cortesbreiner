'use client';

import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Target,
  Award,
  AlertTriangle
} from 'lucide-react';

const productionData = [
  { name: 'Lun', real: 400, meta: 450 },
  { name: 'Mar', real: 520, meta: 450 },
  { name: 'Mie', real: 480, meta: 450 },
  { name: 'Jue', real: 610, meta: 450 },
  { name: 'Vie', real: 380, meta: 450 },
  { name: 'Sab', real: 200, meta: 150 },
];

const workshopEfficiency = [
  { name: 'Taller San Jose', value: 94 },
  { name: 'Confecciones Elite', value: 88 },
  { name: 'Satélite La Aurora', value: 92 },
  { name: 'Moda Rapida', value: 75 },
];

const wasteData = [
  { name: 'Ene', value: 4.2 },
  { name: 'Feb', value: 3.8 },
  { name: 'Mar', value: 5.1 },
  { name: 'Abr', value: 4.5 },
  { name: 'May', value: 3.9 },
];

export default function AnalyticsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1>Reportes e Inteligencia de Negocio</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Análisis profundo de la eficiencia operativa y desperdicios.</p>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <Activity size={20} color="var(--primary)" />
            <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '600' }}>+12%</span>
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: '700' }}>92.4%</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Eficiencia Global</p>
        </div>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <Target size={20} color="var(--primary)" />
            <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '600' }}>98%</span>
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: '700' }}>2,590</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Prendas / Meta Diaria</p>
        </div>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <AlertTriangle size={20} color="#f59e0b" />
            <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: '600' }}>-2%</span>
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: '700' }}>4.1%</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Merma Promedio</p>
        </div>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <Award size={20} color="var(--primary)" />
            <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '600' }}>TOP</span>
          </div>
          <p style={{ fontSize: '1.125rem', fontWeight: '700' }}>Taller San Jose</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Más Eficiente</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Daily Production vs Target */}
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem' }}>Producción Diaria vs Meta</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productionData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="real" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="meta" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Waste Trend */}
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem' }}>Tendencia de Merma (%)</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={wasteData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={3} dot={{ fill: 'var(--primary)', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Efficiency by Workshop */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Eficiencia por Taller Satélite</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2rem' }}>
            {workshopEfficiency.map((w, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto 1rem auto' }}>
                  <svg width="120" height="120" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                    <circle cx="60" cy="60" r="50" fill="none" stroke="var(--primary)" strokeWidth="10" 
                      strokeDasharray={`${w.value * 3.14}, 314`}
                      transform="rotate(-90 60 60)"
                    />
                  </svg>
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: '700' }}>{w.value}%</span>
                  </div>
                </div>
                <p style={{ fontSize: '0.875rem', fontWeight: '600' }}>{w.name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
