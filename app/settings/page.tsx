'use client';

import { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Users, 
  ShieldCheck, 
  Ruler, 
  Bell,
  Database,
  Plus,
  Trash2,
  Edit2
} from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('sizes');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1>Configuración del Sistema</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Parametriza roles, tallas y preferencias globales.</p>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem' }}>
        {/* Settings Navigation */}
        <div className="card" style={{ width: '280px', height: 'fit-content', padding: '1rem' }}>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {[
              { id: 'sizes', label: 'Tallas & Medidas', icon: Ruler },
              { id: 'roles', label: 'Roles & Permisos', icon: ShieldCheck },
              { id: 'users', label: 'Usuarios', icon: Users },
              { id: 'notifications', label: 'Notificaciones', icon: Bell },
              { id: 'database', label: 'Base de Datos', icon: Database },
            ].map((item) => (
              <li key={item.id}>
                <button 
                  onClick={() => setActiveTab(item.id)}
                  className="btn"
                  style={{ 
                    width: '100%', 
                    justifyContent: 'flex-start',
                    backgroundColor: activeTab === item.id ? 'var(--primary-lighter)' : 'transparent',
                    color: activeTab === item.id ? 'var(--primary)' : 'var(--text)',
                    padding: '0.75rem 1rem'
                  }}
                >
                  <item.icon size={18} />
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Settings Content */}
        <div className="card" style={{ flex: 1 }}>
          {activeTab === 'sizes' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h3>Gestión de Tallas</h3>
                <button className="btn btn-primary">
                  <Plus size={18} /> Nueva Talla
                </button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'].map((size, i) => (
                  <div key={size} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', border: '1px solid var(--border)', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--primary-lighter)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.75rem' }}>
                        {i + 1}
                      </div>
                      <span style={{ fontWeight: '600' }}>{size}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn-icon"><Edit2 size={16} color="var(--text-muted)" /></button>
                      <button className="btn-icon"><Trash2 size={16} color="#ef4444" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'roles' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h3>Roles y Permisos</h3>
                <button className="btn btn-primary">
                  <Plus size={18} /> Nuevo Rol
                </button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {[
                  { name: 'Administrador', desc: 'Control total del sistema y configuración.', users: 3 },
                  { name: 'Cortador', desc: 'Registro de órdenes y consumo de tela.', users: 8 },
                  { name: 'Operativo', desc: 'Consulta básica y movimientos de inventario.', users: 12 },
                  { name: 'Calidad', desc: 'Inspección de lotes y aprobación.', users: 4 },
                ].map((role) => (
                  <div key={role.name} style={{ padding: '1.5rem', border: '1px solid var(--border)', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h4 style={{ fontWeight: '700', marginBottom: '0.25rem' }}>{role.name}</h4>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{role.desc}</p>
                        <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--primary)' }}>{role.users} usuarios asignados</span>
                      </div>
                      <button className="btn btn-secondary" style={{ fontSize: '0.75rem' }}>Editar Permisos</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
