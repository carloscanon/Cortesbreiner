'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Lock, Mail, ArrowRight, Loader2, Scissors, Layers, Package, AlertCircle, Image as ImageIcon } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  
  // Customization parameters for the title
  const [loginTitleText, setLoginTitleText] = useState('Breiner ERP');
  const [loginTitleColor, setLoginTitleColor] = useState('#ffffff');
  const [loginTitleFont, setLoginTitleFont] = useState('Outfit');
  const [loginTitleSize, setLoginTitleSize] = useState('1.75rem');
  const [loginTitleIcon, setLoginTitleIcon] = useState('Scissors'); // 'Scissors', 'Layers', 'Package', 'None'
  const [loginTitleWeight, setLoginTitleWeight] = useState('900'); // '900' (negrilla), '400' (normal)
  const [loginShowMessage, setLoginShowMessage] = useState(true); // show/hide tagline message

  const router = useRouter();

  useEffect(() => {
    const fetchLogoAndParams = async () => {
      const { data: params } = await supabase.from('company_params').select('*');
      if (params) {
        const logo = params.find(p => p.name === 'logo_url');
        if (logo?.value) setLogoUrl(logo.value);

        const txt = params.find(p => p.name === 'login_title_text');
        if (txt?.value) setLoginTitleText(txt.value);

        const color = params.find(p => p.name === 'login_title_color');
        if (color?.value) setLoginTitleColor(color.value);

        const font = params.find(p => p.name === 'login_title_font');
        if (font?.value) setLoginTitleFont(font.value);

        const size = params.find(p => p.name === 'login_title_size');
        if (size?.value) setLoginTitleSize(size.value);

        const icon = params.find(p => p.name === 'login_title_icon');
        if (icon?.value) setLoginTitleIcon(icon.value);

        const weight = params.find(p => p.name === 'login_title_weight');
        if (weight?.value) setLoginTitleWeight(weight.value);

        const showMsg = params.find(p => p.name === 'login_show_message');
        if (showMsg?.value !== undefined) setLoginShowMessage(showMsg.value !== 'false');
      }
    };
    fetchLogoAndParams();
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
          <h2 style={{ 
            fontSize: loginTitleSize, 
            fontWeight: loginTitleWeight, 
            color: loginTitleColor, 
            margin: '-1.5rem 0 2.5rem 0',
            textTransform: 'none',
            letterSpacing: '0.05em',
            opacity: 0.95,
            fontFamily: loginTitleFont === 'Outfit' ? 'Outfit, sans-serif' : 
                        loginTitleFont === 'Inter' ? 'Inter, sans-serif' : 
                        loginTitleFont === 'Roboto' ? 'Roboto, sans-serif' : 
                        loginTitleFont === 'Montserrat' ? 'Montserrat, sans-serif' : 
                        loginTitleFont === 'Playfair Display' ? '"Playfair Display", serif' :
                        loginTitleFont === 'Merriweather' ? 'Merriweather, serif' :
                        loginTitleFont === 'Lora' ? 'Lora, serif' :
                        loginTitleFont === 'Caveat' ? 'Caveat, cursive' : 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            {loginTitleIcon === 'Scissors' && <Scissors size={24} style={{ transform: 'rotate(-45deg)' }} />}
            {loginTitleIcon === 'Layers' && <Layers size={24} />}
            {loginTitleIcon === 'Package' && <Package size={24} />}
            {loginTitleText}
          </h2>
          <h1 style={{ fontSize: '3rem', color: 'white', marginBottom: loginShowMessage ? '1.5rem' : '0', lineHeight: 1.1 }}>
            Gestiona tu producción textil con precisión quirúrgica.
          </h1>
          {loginShowMessage && (
            <p style={{ fontSize: '1.125rem', opacity: 0.8, maxWidth: '500px' }}>
              La plataforma líder para el control de cortes, inventarios y talleres satélite en tiempo real.
            </p>
          )}
        </div>

        {/* Decorative elements */}
        <div style={{ position: 'absolute', bottom: '-10%', right: '-5%', width: '400px', height: '400px', backgroundColor: 'var(--primary-light)', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.5 }}></div>

        {/* Designed by footer */}
        <div style={{
          position: 'absolute',
          bottom: '1.5rem',
          left: '4rem',
          zIndex: 2
        }}>
          <a
            href="https://www.consultoresexpertos.org"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              textDecoration: 'none',
              color: 'rgba(255,255,255,0.45)',
              fontSize: '0.7rem',
              fontWeight: '500',
              letterSpacing: '0.06em',
              transition: 'color 0.2s ease, opacity 0.2s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
          >
            <span style={{
              display: 'inline-block',
              width: '1px',
              height: '10px',
              backgroundColor: 'rgba(255,255,255,0.3)',
              marginRight: '0.15rem'
            }} />
            Designed by{' '}
            <span style={{ fontWeight: '700', letterSpacing: '0.04em' }}>Consultores Expertos</span>
          </a>
        </div>
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
