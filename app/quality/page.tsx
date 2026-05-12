'use client';

import { useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Search,
  ClipboardCheck,
  ChevronRight,
  MoreVertical,
  Filter
} from 'lucide-react';

const qualityItems = [
  { id: 1, order: 'OC-001', lot: 'Lote A', workshop: 'Taller San Jose', items: 400, date: '2024-05-12', status: 'Pendiente' },
  { id: 2, order: 'OC-002', lot: 'Lote B', workshop: 'Confecciones Elite', items: 250, date: '2024-05-11', status: 'Aprobado' },
  { id: 3, order: 'OC-003', lot: 'Lote C', workshop: 'Satélite La Aurora', items: 180, date: '2024-05-10', status: 'Reproceso' },
];

export default function QualityPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Control de Calidad</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Inspección detallada de lotes recibidos y terminados.</p>
        </div>
        <button className="btn btn-primary">
          <ClipboardCheck size={18} /> Nueva Inspección
        </button>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center', justifyCenter: 'center', color: '#166534' }}>
            <CheckCircle2 size={24} style={{ margin: 'auto' }} />
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>APROBADOS MES</p>
            <p style={{ fontSize: '1.5rem', fontWeight: '700' }}>142</p>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyCenter: 'center', color: '#92400e' }}>
            <AlertCircle size={24} style={{ margin: 'auto' }} />
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>EN REPROCESO</p>
            <p style={{ fontSize: '1.5rem', fontWeight: '700' }}>8</p>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyCenter: 'center', color: '#991b1b' }}>
            <XCircle size={24} style={{ margin: 'auto' }} />
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>RECHAZADOS</p>
            <p style={{ fontSize: '1.5rem', fontWeight: '700' }}>3</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '0' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Buscar inspección por orden o taller..." 
              style={{ width: '100%', padding: '0.625rem 1rem 0.625rem 3rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
            />
          </div>
          <button className="btn btn-secondary">
            <Filter size={18} /> Filtros
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {qualityItems.map((item) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', transition: 'background-color 0.2s', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--primary)' }}>{item.order}</span>
                  <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#cbd5e1' }}></span>
                  <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>{item.workshop}</span>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>Lote: <strong>{item.lot}</strong></span>
                  <span>Prendas: <strong>{item.items}</strong></span>
                  <span>Fecha: <strong>{item.date}</strong></span>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                <span className={`badge ${
                  item.status === 'Aprobado' ? 'badge-success' : 
                  item.status === 'Reproceso' ? 'badge-warning' : 'badge-info'
                }`}>
                  {item.status}
                </span>
                <ChevronRight size={18} color="var(--text-muted)" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
