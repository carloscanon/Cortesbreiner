'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Bell, Mail, User, Loader2, Store, Settings, Factory } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const { user, profile, loading } = useAuth();
  const pathname = usePathname();
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
          console.error('Error fetching navbar permissions:', err);
        }
      }
    };

    fetchPermissions();
  }, [profile]);

  if (pathname?.startsWith('/pos')) return null;

  return (
    <header style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      padding: '1rem 0',
      marginBottom: '2rem'
    }}>
      <div style={{ position: 'relative', width: '400px' }}>
        <Search 
          size={18} 
          style={{ 
            position: 'absolute', 
            left: '1rem', 
            top: '50%', 
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)'
          }} 
        />
        <input 
          type="text" 
          placeholder="Buscar orden, tela..." 
          style={{ 
            width: '100%',
            padding: '0.75rem 1rem 0.75rem 3rem',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            fontSize: '0.875rem',
            outline: 'none',
            transition: 'border-color 0.2s'
          }}
          onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
          onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
        />
        <div style={{
          position: 'absolute',
          right: '1rem',
          top: '50%',
          transform: 'translateY(-50%)',
          backgroundColor: '#f1f5f9',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '0.625rem',
          color: 'var(--text-muted)',
          fontWeight: '700'
        }}>⌘ K</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        {(() => {
          const roleNameLower = profile?.roles?.name?.toLowerCase() || '';
          const isSuperAdmin = roleNameLower.includes('super');
          
          const hasStoreAccess = isSuperAdmin || allowedModules.includes('store_admin');
          const hasWorkshopsAccess = isSuperAdmin || allowedModules.includes('workshops');

          if (!hasStoreAccess && !hasWorkshopsAccess) return null;

          return (
            <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
              {hasStoreAccess && (
                <Link 
                  href="/store-admin" 
                  style={{
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.45rem 0.85rem',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    color: 'white',
                    background: 'linear-gradient(135deg, #80082E, #D81B60)',
                    boxShadow: '0 2px 6px rgba(128,8,46,0.2)',
                    transition: 'transform 0.15s ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1.0)'}
                >
                  <Store size={14} /> Tiendas POS
                </Link>
              )}

              {hasWorkshopsAccess && (
                <Link 
                  href="/workshops" 
                  style={{
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.45rem 0.85rem',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    color: 'white',
                    background: 'linear-gradient(135deg, #80082E, #D81B60)',
                    boxShadow: '0 2px 6px rgba(128,8,46,0.2)',
                    transition: 'transform 0.15s ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1.0)'}
                >
                  <Factory size={14} /> Satélites / Talleres
                </Link>
              )}
            </div>
          );
        })()}

        <button className="btn-icon" style={{ position: 'relative' }}>
          <Mail size={20} color="var(--text-muted)" />
        </button>
        <button className="btn-icon" style={{ position: 'relative' }}>
          <Bell size={20} color="var(--text-muted)" />
          <span style={{ 
            position: 'absolute', 
            top: '-2px', 
            right: '-2px', 
            width: '8px', 
            height: '8px', 
            backgroundColor: '#ef4444', 
            borderRadius: '50%',
            border: '2px solid white'
          }}></span>
        </button>
        
        <Link href="/settings" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.15s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
          <Settings size={20} color="var(--text-muted)" />
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingLeft: '1.25rem', borderLeft: '1px solid var(--border)' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <Loader2 size={16} className="animate-spin" color="var(--primary)" />
               <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cargando...</span>
            </div>
          ) : (
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--text)', marginBottom: '0.1rem' }}>
                {profile?.full_name || user?.email?.split('@')[0] || 'Invitado'}
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <span style={{ 
                  fontSize: '0.625rem', 
                  backgroundColor: 'var(--primary-lighter)', 
                  color: 'var(--primary)', 
                  padding: '2px 8px', 
                  borderRadius: '6px',
                  fontWeight: '800',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  {profile?.roles?.name || 'Sin Rol'}
                </span>
              </div>
            </div>
          )}
          <div style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: '12px', 
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            border: '1px solid var(--border)'
          }}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <User size={20} color="var(--text-muted)" />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
