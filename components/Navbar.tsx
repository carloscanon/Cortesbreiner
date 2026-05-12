'use client';

import { Search, Bell, Mail, User } from 'lucide-react';

export default function Navbar() {
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
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '0.875rem', fontWeight: '600' }}>Carlos Cañón</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Admin</p>
          </div>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: '50%', 
            backgroundColor: '#e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}>
            <User size={24} color="#94a3b8" />
          </div>
        </div>
      </div>
    </header>
  );
}
