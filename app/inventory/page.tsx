'use client';

import { useState } from 'react';
import { 
  Package, 
  Search, 
  Filter, 
  ArrowUpDown,
  MoreVertical,
  Plus,
  MoveHorizontal
} from 'lucide-react';

const inventoryData = [
  { id: 1, roll: 'R-1024', fabric: 'Lino Premium', color: 'Verde Bosque', kilos: 25.4, meters: 150, location: 'Bodega A-1', status: 'Disponible' },
  { id: 2, roll: 'R-1025', fabric: 'Algodón 100%', color: 'Blanco Óptico', kilos: 18.2, meters: 120, location: 'Bodega B-3', status: 'En Corte' },
  { id: 3, roll: 'R-1026', fabric: 'Denim Stretch', color: 'Azul Indigo', kilos: 45.0, meters: 200, location: 'Bodega A-2', status: 'Disponible' },
  { id: 4, roll: 'R-1027', fabric: 'Poliéster DryFit', color: 'Gris Melange', kilos: 12.8, meters: 90, location: 'Bodega C-1', status: 'Bajo Stock' },
  { id: 5, roll: 'R-1028', fabric: 'Jersey Soft', color: 'Rosa Pastel', kilos: 30.5, meters: 180, location: 'Bodega B-2', status: 'Disponible' },
];

export default function InventoryPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Inventario de Telas</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Control detallado de rollos, kilos y metros disponibles.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-secondary">
            <MoveHorizontal size={18} /> Traslado
          </button>
          <button className="btn btn-primary">
            <Plus size={18} /> Entrada de Tela
          </button>
        </div>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="card">
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>TOTAL KILOS</p>
          <p style={{ fontSize: '1.5rem', fontWeight: '700', marginTop: '0.5rem' }}>1,240.5 Kg</p>
        </div>
        <div className="card">
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>TOTAL METROS</p>
          <p style={{ fontSize: '1.5rem', fontWeight: '700', marginTop: '0.5rem' }}>8,450 Mts</p>
        </div>
        <div className="card">
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>ROLLOS ACTIVOS</p>
          <p style={{ fontSize: '1.5rem', fontWeight: '700', marginTop: '0.5rem' }}>86</p>
        </div>
        <div className="card">
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>PENDIENTE ENTRADA</p>
          <p style={{ fontSize: '1.5rem', fontWeight: '700', marginTop: '0.5rem' }}>12</p>
        </div>
      </div>

      <div className="card" style={{ padding: '0' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Buscar por rollo, tela o color..." 
              style={{ width: '100%', padding: '0.625rem 1rem 0.625rem 3rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-secondary">
              <ArrowUpDown size={18} /> Ordenar
            </button>
            <button className="btn btn-secondary">
              <Filter size={18} /> Filtros
            </button>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', backgroundColor: '#f8fafc' }}>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Rollo</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tela / Color</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Kilos</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Metros</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ubicación</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Estado</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {inventoryData.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', fontWeight: '600' }}>{item.roll}</td>
                <td style={{ padding: '1rem 1.5rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: '500' }}>{item.fabric}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.color}</div>
                </td>
                <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem' }}>{item.kilos} Kg</td>
                <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem' }}>{item.meters} Mts</td>
                <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{item.location}</td>
                <td style={{ padding: '1rem 1.5rem' }}>
                  <span className={`badge ${
                    item.status === 'Disponible' ? 'badge-success' : 
                    item.status === 'En Corte' ? 'badge-info' : 'badge-warning'
                  }`}>
                    {item.status}
                  </span>
                </td>
                <td style={{ padding: '1rem 1.5rem' }}>
                  <button className="btn-icon"><MoreVertical size={16} color="var(--text-muted)" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
