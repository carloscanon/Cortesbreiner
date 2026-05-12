'use client';

import { Search, Bell, Mail, User, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function Navbar() {
  const { user, profile, loading } = useAuth();

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

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
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
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingLeft: '1.5rem', borderLeft: '1px solid var(--border)' }}>
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
            <User size={20} color="var(--text-muted)" />
          </div>
        </div>
      </div>
    </header>
  );
}
