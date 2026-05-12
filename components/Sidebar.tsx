'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Database, 
  Package, 
  Scissors, 
  Truck, 
  BarChart3, 
  Settings, 
  HelpCircle, 
  LogOut,
  Layers
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/' },
  { icon: Database, label: 'Maestros', href: '/masters' },
  { icon: Package, label: 'Inventario', href: '/inventory' },
  { icon: Scissors, label: 'Órdenes', href: '/orders' },
  { icon: Layers, label: 'Seguimiento', href: '/tracking' },
  { icon: BarChart3, label: 'Analíticas', href: '/analytics' },
];

const bottomItems = [
  { icon: Settings, label: 'Ajustes', href: '/settings' },
  { icon: HelpCircle, label: 'Ayuda', href: '/help' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { signOut } = useAuth();

  return (
    <aside className="sidebar">
      <div style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          backgroundColor: 'var(--primary)', 
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: '700'
        }}>B</div>
        <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', fontWeight: '700' }}>Breiner</h2>
      </div>

      <nav style={{ flex: 1 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Menú</p>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.label}>
                <Link 
                  href={item.href}
                  className={`btn ${isActive ? 'btn-primary' : ''}`}
                  style={{ 
                    width: '100%', 
                    justifyContent: 'flex-start',
                    backgroundColor: isActive ? 'var(--primary)' : 'transparent',
                    color: isActive ? 'white' : 'var(--text)',
                    padding: '0.75rem 1rem'
                  }}
                >
                  <item.icon size={20} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <p style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', margin: '2rem 0 1rem 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>General</p>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {bottomItems.map((item) => (
            <li key={item.label}>
              <Link 
                href={item.href}
                className="btn"
                style={{ 
                  width: '100%', 
                  justifyContent: 'flex-start',
                  color: 'var(--text)',
                  padding: '0.75rem 1rem'
                }}
              >
                <item.icon size={20} />
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <button 
              onClick={() => signOut()}
              className="btn"
              style={{ 
                width: '100%', 
                justifyContent: 'flex-start',
                color: '#ef4444',
                padding: '0.75rem 1rem'
              }}
            >
              <LogOut size={20} />
              Cerrar Sesión
            </button>
          </li>
        </ul>
      </nav>

      <div className="card" style={{ marginTop: '2rem', padding: '1rem', backgroundColor: 'var(--primary)', color: 'white', border: 'none' }}>
        <p style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>App Móvil</p>
        <p style={{ fontSize: '0.75rem', opacity: 0.8, marginBottom: '1rem' }}>Gestiona tu producción desde cualquier lugar.</p>
        <button className="btn" style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', fontSize: '0.75rem' }}>Descargar</button>
      </div>
    </aside>
  );
}
