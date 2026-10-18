'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

export default function AppLayoutWrapper({
  children,
  sidebar,
  navbar
}: {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  navbar: React.ReactNode;
}) {
  const pathname = usePathname();

  // Completely isolate /scanner and /pos/remote-scanner from the desktop ERP layout, sidebars, and headers
  if (pathname?.startsWith('/scanner') || pathname?.startsWith('/pos/remote-scanner')) {
    return <>{children}</>;
  }

  return (
    <div className="app-container">
      {sidebar}
      <main className="main-content">
        {navbar}
        {children}
      </main>
    </div>
  );
}
