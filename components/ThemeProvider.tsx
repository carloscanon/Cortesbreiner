'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

// Converts a hex color to a lighter version by mixing with white
function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return `#${((lr << 16) | (lg << 8) | lb).toString(16).padStart(6, '0')}`;
}

export default function ThemeProvider() {
  const { config } = useAuth();

  useEffect(() => {
    const primary = config?.theme_primary_color;
    if (!primary || !/^#[0-9a-fA-F]{6}$/.test(primary)) return;

    const primaryLight = lighten(primary, 0.25);
    const primaryLighter = lighten(primary, 0.88);

    document.documentElement.style.setProperty('--primary', primary);
    document.documentElement.style.setProperty('--primary-light', primaryLight);
    document.documentElement.style.setProperty('--primary-lighter', primaryLighter);
  }, [config?.theme_primary_color]);

  return null;
}
