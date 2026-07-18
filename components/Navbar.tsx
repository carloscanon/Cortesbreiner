'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Bell, Mail, User, Loader2, Store, Settings, Factory } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const { user, profile, loading, signOut, config } = useAuth();
  const pathname = usePathname();
  const [allowedModules, setAllowedModules] = useState<string[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  const avatarSizeParam = config?.['nav_avatar_size'] || 'normal';
  let avatarWidth = '40px';
  let iconSize = 20;
  let gapSize = '1.25rem';
  let badgeTop = '-2px';
  let badgeRight = '-2px';

  if (avatarSizeParam === 'large') {
    avatarWidth = '55px';
    iconSize = 26;
    gapSize = '1.5rem';
    badgeTop = '-4px';
    badgeRight = '-4px';
  } else if (avatarSizeParam === 'xlarge') {
    avatarWidth = '70px';
    iconSize = 32;
    gapSize = '1.75rem';
    badgeTop = '-5px';
    badgeRight = '-5px';
  } else if (avatarSizeParam === 'xxlarge') {
    avatarWidth = '85px';
    iconSize = 38;
    gapSize = '2rem';
    badgeTop = '-6px';
    badgeRight = '-6px';
  }

  const handleMailClick = () => {
    if (profile?.roles?.name === 'Taller') {
      if (pathname === '/') {
        window.dispatchEvent(new CustomEvent('open-workshop-chat'));
      } else {
        window.location.href = '/?open_chat=true';
      }
    } else {
      window.location.href = '/workshops?tab=chat';
    }
  };

  const handleBellClick = () => {
    handleMailClick();
  };
  const fetchUnreadCount = async () => {
    try {
      const isWorkshopUser = profile?.roles?.name === 'Taller';
      if (isWorkshopUser) {
        const workshopId = profile?.workshop_id;
        if (workshopId) {
          const { data } = await supabase
            .from('workshop_chat_rooms')
            .select('unread_count_workshop')
            .eq('workshop_id', workshopId)
            .maybeSingle();
          if (data) {
            setUnreadChatCount(data.unread_count_workshop || 0);
          }
        }
      } else {
        const { data } = await supabase
          .from('workshop_chat_rooms')
          .select('unread_count_erp');
        if (data) {
          const total = data.reduce((sum, r) => sum + (r.unread_count_erp || 0), 0);
          setUnreadChatCount(total);
        }
      }
    } catch (err) {
      console.error('Error fetching unread chat count:', err);
    }
  };

  useEffect(() => {
    if (!profile) return;
    fetchUnreadCount();

    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 60000); // 60 seconds (1 minute)

    return () => clearInterval(interval);
  }, [profile]);

  useEffect(() => {
    const handleClose = () => setShowUserDropdown(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

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

        <button className="btn-icon" style={{ position: 'relative', cursor: 'pointer' }} onClick={handleMailClick} title="Mensajes / Chat">
          <Mail size={iconSize} color="var(--text-muted)" />
        </button>
        <button className="btn-icon" style={{ position: 'relative', cursor: 'pointer' }} onClick={handleBellClick} title="Notificaciones / Comunicados">
          <Bell size={iconSize} color="var(--text-muted)" />
          {unreadChatCount > 0 && (
            <span style={{ 
              position: 'absolute', 
              top: badgeTop, 
              right: badgeRight, 
              backgroundColor: '#ef4444', 
              color: 'white',
              borderRadius: '999px',
              fontSize: '0.625rem',
              fontWeight: '900',
              padding: '0.1rem 0.35rem',
              minWidth: '16px',
              textAlign: 'center',
              lineHeight: '1.2',
              border: '1.5px solid white'
            }}>
              {unreadChatCount}
            </span>
          )}
        </button>
        
        <Link href="/settings" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.15s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
          <Settings size={iconSize} color="var(--text-muted)" />
        </Link>

        <div 
          onClick={(e) => {
            e.stopPropagation();
            setShowUserDropdown(!showUserDropdown);
          }}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.75rem', 
            paddingLeft: gapSize, 
            borderLeft: '1px solid var(--border)',
            cursor: 'pointer',
            position: 'relative',
            userSelect: 'none'
          }}
        >
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <Loader2 size={16} className="animate-spin" color="var(--primary)" />
               <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cargando...</span>
            </div>
          ) : (
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.15rem', display: 'block' }}>
                {profile?.full_name || user?.email?.split('@')[0] || 'Invitado'}
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                {(() => {
                  const roleName = profile?.roles?.name?.toLowerCase() || '';
                  const isWorkshop = roleName.includes('taller') || roleName.includes('workshop') || pathname?.startsWith('/workshops');
                  return (
                    <span style={{ 
                      fontSize: '0.625rem', 
                      backgroundColor: isWorkshop ? '#fce7f3' : '#e0f2fe', 
                      color: isWorkshop ? '#80082E' : '#0369a1', 
                      padding: '2px 8px', 
                      borderRadius: '12px',
                      fontWeight: '800',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      {isWorkshop ? 'TALLER' : 'ERP'}
                    </span>
                  );
                })()}
              </div>
            </div>
          )}
          <div style={{ 
            width: avatarWidth, 
            height: avatarWidth, 
            borderRadius: '50%', 
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            border: '2px solid var(--border)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            flexShrink: 0,
            transition: 'width 0.25s, height 0.25s'
          }}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <User size={iconSize} color="var(--text-muted)" />
            )}
          </div>

          {/* User Session Dropdown Card (POS-style) */}
          {showUserDropdown && (
            <div 
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: '50px',
                right: 0,
                width: '260px',
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '1.25rem',
                boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                zIndex: 1600,
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                cursor: 'default',
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <div style={{ 
                  width: '50px', 
                  height: '50px', 
                  borderRadius: '50%', 
                  overflow: 'hidden', 
                  border: '1px solid #cbd5e1'
                }}>
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' }}>
                      <User size={24} color="#64748b" />
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <strong style={{ fontSize: '0.85rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {profile?.full_name || 'Usuario'}
                  </strong>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.email || ''}
                  </span>
                </div>
              </div>
              
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.72rem', color: '#475569' }}>
                <div>💼 <strong>Rol:</strong> {profile?.roles?.name || 'Usuario'}</div>
                {profile?.workshops && (
                  <div>🏭 <strong>Taller:</strong> {profile.workshops.nombre_taller}</div>
                )}
              </div>

              <button 
                onClick={async () => {
                  if (signOut) {
                    await signOut();
                  } else {
                    await supabase.auth.signOut();
                  }
                  window.location.href = '/login';
                }}
                style={{
                  width: '100%',
                  padding: '0.55rem',
                  background: '#fef2f2',
                  color: '#ef4444',
                  border: '1px solid #fee2e2',
                  borderRadius: '10px',
                  fontSize: '0.75rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fef2f2'; }}
              >
                🚪 Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
