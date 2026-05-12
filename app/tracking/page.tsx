'use client';

import { 
  Package, 
  Truck, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  ArrowRight,
  Search,
  Filter
} from 'lucide-react';

const trackingData = [
  { id: 1, lot: 'Lote #105', order: 'OC-001', workshop: 'Taller San Jose', status: 'En Confección', progress: 65, delivery: '2024-05-18' },
  { id: 2, lot: 'Lote #106', order: 'OC-001', workshop: 'Confecciones Elite', status: 'Enviado', progress: 10, delivery: '2024-05-22' },
  { id: 3, lot: 'Lote #102', order: 'OC-002', workshop: 'Satélite La Aurora', status: 'Terminado', progress: 100, delivery: '2024-05-10' },
  { id: 4, lot: 'Lote #108', order: 'OC-004', workshop: 'Moda Rapida', status: 'Retrasado', progress: 40, delivery: '2024-05-15' },
];

export default function TrackingPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Seguimiento de Producción</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Monitorea el progreso de cada lote en tiempo real.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div className="card" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
            <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>12 Lotes Activos</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '0' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Buscar lote, orden o taller..." 
              style={{ width: '100%', padding: '0.625rem 1rem 0.625rem 3rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
            />
          </div>
          <button className="btn btn-secondary">
            <Filter size={18} /> Filtros
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {trackingData.map((item) => (
            <div key={item.id} style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                    <h3 style={{ fontSize: '1rem' }}>{item.lot}</h3>
                    <span className="badge badge-info" style={{ fontSize: '0.625rem' }}>{item.order}</span>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Taller: <strong>{item.workshop}</strong></p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={`badge ${
                    item.status === 'Terminado' ? 'badge-success' : 
                    item.status === 'Retrasado' ? 'badge-danger' : 'badge-warning'
                  }`}>
                    {item.status}
                  </span>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Entrega: {item.delivery}</p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ flex: 1, height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${item.progress}%`, 
                    height: '100%', 
                    backgroundColor: item.status === 'Retrasado' ? '#ef4444' : 'var(--primary)', 
                    borderRadius: '4px',
                    transition: 'width 1s ease-in-out'
                  }}></div>
                </div>
                <span style={{ fontSize: '0.875rem', fontWeight: '700', width: '40px' }}>{item.progress}%</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                <div style={{ display: 'flex', gap: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: item.progress >= 25 ? 1 : 0.4 }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: item.progress >= 25 ? 'var(--primary-lighter)' : '#f1f5f9', color: item.progress >= 25 ? 'var(--primary)' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Package size={12} />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: '500' }}>Corte</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: item.progress >= 50 ? 1 : 0.4 }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: item.progress >= 50 ? 'var(--primary-lighter)' : '#f1f5f9', color: item.progress >= 50 ? 'var(--primary)' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Truck size={12} />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: '500' }}>Enviado</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: item.progress >= 75 ? 1 : 0.4 }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: item.progress >= 75 ? 'var(--primary-lighter)' : '#f1f5f9', color: item.progress >= 75 ? 'var(--primary)' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Clock size={12} />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: '500' }}>Confección</span>
                  </div>
                </div>
                <button style={{ color: 'var(--primary)', fontSize: '0.875rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  Detalles <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
