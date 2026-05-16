'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  LayoutDashboard, 
  Database, 
  Package, 
  Scissors, 
  Truck, 
  Settings, 
  HelpCircle, 
  LogOut,
  Layers,
  Factory,
  ShieldCheck,
  Calculator
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const allMenuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/', module: 'dashboard' },
  { icon: Scissors, label: 'Órdenes', href: '/orders', module: 'orders' },
  { icon: Database, label: 'Maestros', href: '/masters', module: 'masters' },
  { icon: Package, label: 'Inventario', href: '/inventory', module: 'inventory' },
  { icon: Calculator, label: 'Costos', href: '/costs', module: 'costs' },
  { icon: Layers, label: 'Seguimiento', href: '/tracking', module: 'tracking' },
  { icon: Factory, label: 'Talleres', href: '/workshops', module: 'workshops' },
  { icon: Truck, label: 'Confección', href: '/sewing', module: 'sewing' },
  { icon: ShieldCheck, label: 'Calidad', href: '/quality', module: 'quality' },
];

const allBottomItems = [
  { icon: Settings, label: 'Ajustes', href: '/settings', module: 'settings' },
  { icon: HelpCircle, label: 'Ayuda', href: '/help', module: 'help' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { signOut, user, profile, config } = useAuth();
  const [allowedModules, setAllowedModules] = useState<string[]>([]);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (profile?.role_id) {
        try {
          const { data: rolePerms } = await supabase
            .from('role_permissions')
            .select('permissions(module)')
            .eq('role_id', profile.role_id);

          if (rolePerms) {
            const modules = rolePerms.map((rp: any) => rp.permissions?.module).filter(Boolean);
            setAllowedModules(modules);
          }
        } catch (err) {
          console.error('Error fetching sidebar permissions:', err);
        }
      }
    };

    fetchPermissions();
  }, [profile]);

  const filteredMenuItems = allMenuItems.filter(item => 
    allowedModules.includes(item.module) || item.module === 'dashboard'
  );

  const filteredBottomItems = allBottomItems.filter(item => 
    allowedModules.includes(item.module) || item.module === 'help'
  );

  const logoUrl = config?.logo_url || '';
  const logoWidth = config?.logo_width || '150';
  const mobileAppImg = config?.mobile_app_image_url || '';

  return (
    <aside className="sidebar">
      <div style={{ 
        marginBottom: '2.5rem', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        minHeight: '80px',
        width: '100%'
      }}>
        {logoUrl ? (
          <div style={{ 
            width: '100%', 
            display: 'flex', 
            justifyContent: 'center',
            padding: '0 1rem'
          }}>
            <img 
              src={logoUrl} 
              alt="Logo" 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '120px', 
                width: `${logoWidth}px`,
                height: 'auto', 
                objectFit: 'contain',
                transition: 'width 0.3s ease'
              }} 
            />
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              width: '40px', height: '40px', backgroundColor: 'var(--primary)', 
              borderRadius: '8px', display: 'flex', alignItems: 'center', 
              justifyContent: 'center', color: 'white', fontWeight: '700' 
            }}>B</div>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', fontWeight: '700' }}>Breiner</h2>
          </div>
        )}
      </div>

      <nav style={{ flex: 1 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Menú</p>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filteredMenuItems.map((item) => {
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
          {filteredBottomItems.map((item) => (
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

      <div className="card" style={{ 
        marginTop: '2rem', 
        padding: '1.25rem', 
        backgroundColor: 'var(--primary)', 
        color: 'white', 
        border: 'none',
        position: 'relative',
        overflow: 'hidden',
        minHeight: '160px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end'
      }}>
        {mobileAppImg && (
          <div style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            opacity: 0.3,
            zIndex: 0
          }}>
            <img src={mobileAppImg} alt="App" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.25rem' }}>App Móvil</p>
          <p style={{ fontSize: '0.75rem', opacity: 0.9, marginBottom: '1rem', lineHeight: '1.4' }}>Gestiona tu producción desde cualquier lugar.</p>
          <button className="btn" style={{ 
            width: '100%', 
            backgroundColor: 'white', 
            color: 'var(--primary)', 
            fontSize: '0.75rem',
            fontWeight: '700',
            border: 'none'
          }}>Descargar Ahora</button>
        </div>
      </div>
    </aside>
  );
}
