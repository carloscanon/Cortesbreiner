'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RedirectToInventory() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/inventory');
  }, [router]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', color: '#64748b' }}>
      <p>Redireccionando al Inventario General...</p>
    </div>
  );
}
