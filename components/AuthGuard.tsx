'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user && pathname !== '/login') {
      router.push('/login');
    }
    if (!loading && user && pathname === '/login') {
      router.push('/');
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--background)' }}>
        <Loader2 size={40} className="animate-spin" color="var(--primary)" />
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
