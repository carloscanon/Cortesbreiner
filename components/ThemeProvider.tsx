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

export function applyTheme(isDark: boolean) {
  if (isDark) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

export function isDarkMode(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem('theme');
  if (stored) return stored === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export default function ThemeProvider() {
  const { config } = useAuth();

  // Apply saved theme on mount (before config loads)
  useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (stored === 'light') {
      document.documentElement.removeAttribute('data-theme');
    }
  }, []);

  // Apply theme from company_params when config loads
  useEffect(() => {
    if (!config) return;
    const darkMode = config?.dark_mode;
    if (darkMode === 'true') {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else if (darkMode === 'false') {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  }, [config?.dark_mode]);

  // Apply primary color override
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
