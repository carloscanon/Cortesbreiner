'use client';

import { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  ChevronDown,
  ExternalLink,
  Trash2,
  Edit
} from 'lucide-react';

const initialOrders = [
  { id: 1, consecutive: 'OC-001', client: 'Moda Latina', brand: 'Exito', fabric: 'Lino Premium', date: '2024-05-10', priority: 'Alta', status: 'En Corte' },
  { id: 2, consecutive: 'OC-002', client: 'Textiles SAS', brand: 'Mango', fabric: 'Algodón 100%', date: '2024-05-11', priority: 'Media', status: 'Planeada' },
  { id: 3, consecutive: 'OC-003', client: 'Studio F', brand: 'Studio F', fabric: 'Denim Stretch', date: '2024-05-12', priority: 'Baja', status: 'Terminada' },
  { id: 4, consecutive: 'OC-004', client: 'Arturo Calle', brand: 'AC Sport', fabric: 'Poliéster DryFit', date: '2024-05-13', priority: 'Alta', status: 'En Corte' },
  { id: 5, consecutive: 'OC-005', client: 'Gef', brand: 'Gef Kids', fabric: 'Jersey Soft', date: '2024-05-14', priority: 'Media', status: 'Planeada' },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState(initialOrders);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Órdenes de Corte</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Gestiona y monitorea todas las órdenes de producción.</p>
        </div>
        <button className="btn btn-primary">
          <Plus size={18} /> Nueva Orden
        </button>
      </div>

      <div className="card" style={{ padding: '0' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Buscar por cliente, marca o referencia..." 
              style={{ width: '100%', padding: '0.625rem 1rem 0.625rem 3rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
            />
          </div>
          <button className="btn btn-secondary">
            <Filter size={18} /> Filtros
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', backgroundColor: '#f8fafc' }}>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Consecutivo</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cliente / Marca</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tela</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Prioridad</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Estado</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.2s' }}>
                <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', fontWeight: '600', color: 'var(--primary)' }}>{order.consecutive}</td>
                <td style={{ padding: '1rem 1.5rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: '500' }}>{order.client}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{order.brand}</div>
                </td>
                <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem' }}>{order.fabric}</td>
                <td style={{ padding: '1rem 1.5rem' }}>
                  <span className={`badge ${
                    order.priority === 'Alta' ? 'badge-danger' : 
                    order.priority === 'Media' ? 'badge-warning' : 'badge-info'
                  }`}>
                    {order.priority}
                  </span>
                </td>
                <td style={{ padding: '1rem 1.5rem' }}>
                  <span className={`badge ${
                    order.status === 'En Corte' ? 'badge-info' : 
                    order.status === 'Terminada' ? 'badge-success' : 'badge-warning'
                  }`}>
                    {order.status}
                  </span>
                </td>
                <td style={{ padding: '1rem 1.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-icon" style={{ color: 'var(--text-muted)' }}><Edit size={16} /></button>
                    <button className="btn-icon" style={{ color: 'var(--text-muted)' }}><ExternalLink size={16} /></button>
                    <button className="btn-icon" style={{ color: '#ef4444' }}><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Mostrando 5 de 24 órdenes</p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>Anterior</button>
            <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>Siguiente</button>
          </div>
        </div>
      </div>
    </div>
  );
}
