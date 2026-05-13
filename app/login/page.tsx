'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Lock, Mail, ArrowRight, Loader2, Scissors, AlertCircle, Image as ImageIcon } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchLogo = async () => {
      const { data } = await supabase.from('company_params').select('value').eq('name', 'logo_url').single();
      if (data?.value) setLogoUrl(data.value);
    };
    fetchLogo();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      minHeight: '100vh', 
      backgroundColor: 'white',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999
    }}>
      {/* Left Side: Illustration/Brand */}
      <div style={{ 
        flex: 1, 
        backgroundColor: 'var(--primary)', 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        padding: '4rem',
        color: 'white',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ 
            height: '180px', 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            marginBottom: '2.5rem',
            overflow: 'hidden'
          }}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" style={{ height: '100%', width: 'auto', objectFit: 'contain' }} />
            ) : (
              <Scissors size={60} color="white" />
            )}
          </div>
          <h1 style={{ fontSize: '3rem', color: 'white', marginBottom: '1.5rem', lineHeight: 1.1 }}>
            Gestiona tu producción textil con precisión quirúrgica.
          </h1>
          <p style={{ fontSize: '1.125rem', opacity: 0.8, maxWidth: '500px' }}>
            La plataforma líder para el control de cortes, inventarios y talleres satélite en tiempo real.
          </p>
        </div>

        {/* Decorative elements */}
        <div style={{ position: 'absolute', bottom: '-10%', right: '-5%', width: '400px', height: '400px', backgroundColor: 'var(--primary-light)', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.5 }}></div>
      </div>

      {/* Right Side: Login Form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <div style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '0.5rem' }}>Bienvenido de nuevo</h2>
            <p style={{ color: 'var(--text-muted)' }}>Ingresa tus credenciales para acceder a la plataforma.</p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Correo Electrónico</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="email" 
                  required
                  placeholder="ejemplo@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 3rem', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                />
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: '600' }}>Contraseña</label>
                <a href="#" style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '600' }}>¿Olvidaste tu contraseña?</a>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="password" 
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 3rem', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
                />
              </div>
            </div>

            {error && (
              <div style={{ padding: '0.75rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '8px', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '0.875rem', fontSize: '1rem' }}
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : <>Iniciar Sesión <ArrowRight size={20} /></>}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            ¿No tienes una cuenta? <a href="#" style={{ color: 'var(--primary)', fontWeight: '700' }}>Contacta a soporte</a>
          </p>
        </div>
      </div>
    </div>
  );
}
