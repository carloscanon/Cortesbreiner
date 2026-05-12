'use client';

import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  PieChart as PieChartIcon,
  Search,
  ArrowUpRight,
  Download
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

const data = [
  { name: 'Ene', costo: 4000, venta: 6000 },
  { name: 'Feb', costo: 3000, venta: 5500 },
  { name: 'Mar', costo: 5000, venta: 8000 },
  { name: 'Abr', costo: 4500, venta: 7200 },
  { name: 'May', costo: 6000, venta: 9500 },
];

export default function CostsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Análisis de Costos</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Monitorea la rentabilidad y eficiencia económica de tu producción.</p>
        </div>
        <button className="btn btn-secondary">
          <Download size={18} /> Exportar Reporte
        </button>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="card">
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>COSTO TOTAL MES</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: '700' }}>$24,500</p>
            <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: '600' }}>+12%</span>
          </div>
        </div>
        <div className="card">
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>VENTA TOTAL MES</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: '700' }}>$42,800</p>
            <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '600' }}>+18%</span>
          </div>
        </div>
        <div className="card">
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>MARGEN PROMEDIO</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: '700' }}>42.7%</p>
            <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '600' }}>+2.4%</span>
          </div>
        </div>
        <div className="card">
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>COSTO POR MERMA</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: '700' }}>$1,240</p>
            <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: '600' }}>-5%</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem' }}>Histórico de Costos vs Ventas</h3>
          <div style={{ height: '350px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorVenta" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(val) => `$${val}`} />
                <Tooltip />
                <Area type="monotone" dataKey="venta" stroke="var(--primary)" fillOpacity={1} fill="url(#colorVenta)" strokeWidth={3} />
                <Area type="monotone" dataKey="costo" stroke="#94a3b8" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '1.5rem' }}>Desglose de Costos (OC-001)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { label: 'Tela Consumida', value: 4500000, percent: 65 },
              { label: 'Mano de Obra Corte', value: 850000, percent: 12 },
              { label: 'Taller Satélite', value: 1200000, percent: 18 },
              { label: 'Logística', value: 350000, percent: 5 },
            ].map((item, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                  <span style={{ fontWeight: '600' }}>${item.value.toLocaleString()}</span>
                </div>
                <div style={{ height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px' }}>
                  <div style={{ width: `${item.percent}%`, height: '100%', backgroundColor: i === 0 ? 'var(--primary)' : 'var(--primary-light)', borderRadius: '3px' }}></div>
                </div>
              </div>
            ))}
            
            <div style={{ marginTop: '1.5rem', padding: '1.5rem', backgroundColor: 'var(--primary-lighter)', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--primary)' }}>Costo Unitario</span>
                <span style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary)' }}>$12,450</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--primary)', opacity: 0.8 }}>Basado en 400 prendas producidas.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
