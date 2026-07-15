'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user && pathname !== '/login') {
      router.push('/login');
    }
    if (!loading && user && pathname === '/login') {
      router.push('/');
    }
    // Restrict Taller users to dashboard (/) and help (/help)
    if (!loading && user && profile?.roles?.name === 'Taller' && pathname !== '/' && pathname !== '/help') {
      router.push('/');
    }
    // Restrict POS users to POS (/pos), store admin (/store-admin) and help (/help)
    const roleNameLower = profile?.roles?.name?.toLowerCase() || '';
    const isPOS = roleNameLower.includes('pos') || 
                  roleNameLower.includes('post') || 
                  roleNameLower.includes('punto') || 
                  roleNameLower.includes('tienda') || 
                  roleNameLower.includes('vendedor') || 
                  roleNameLower.includes('cajero') ||
                  !!user?.user_metadata?.pos_role_id;
    if (!loading && user && isPOS && pathname !== '/pos' && pathname !== '/store-admin' && pathname !== '/help') {
      router.push('/pos');
    }
    // Block central ERP users (non-POS) from accessing POS paths (except superadmins/admins)
    const isSuperAdmin = roleNameLower.includes('admin') || roleNameLower.includes('super');
    if (!loading && user && !isPOS && !isSuperAdmin && (pathname === '/pos' || pathname === '/store-admin')) {
      router.push('/');
    }
    // Block non-superadmins from accessing the financial module
    if (!loading && user && pathname === '/financial' && !isSuperAdmin) {
      router.push('/');
    }
  }, [user, profile, loading, pathname, router]);

  const isProfileLoading = user && !profile && loading;

  if (loading || isProfileLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', flexDirection: 'column', gap: '1rem', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' }}>
        <Loader2 size={42} className="animate-spin" color="#80082E" />
        <span style={{ fontSize: '0.8rem', fontWeight: '900', color: 'rgba(255,255,255,0.75)', letterSpacing: '0.08em' }}>
          CARGANDO SISTEMA TEXTIL...
        </span>
      </div>
    );
  }

  // If we are on the login page, just show it
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // If not logged in and not loading, we'll be redirected by the useEffect
  // But to avoid flicker, we return null if not logged in
  if (!user) return null;

  return <>{children}</>;
}
