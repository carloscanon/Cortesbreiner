'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { usePathname } from 'next/navigation';

// Converts a hex color to a lighter version by mixing with white
function lighten(hex: string, amount: number): string {
  if (!hex || !hex.startsWith('#')) return hex;
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return `#${((lr << 16) | (lg << 8) | lb).toString(16).padStart(6, '0')}`;
}

export function applyThemeStyles(styles: any) {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  const colors = styles?.colors || {};
  const typography = styles?.typography || {};
  const cards = styles?.cards || {};
  const sidebar = styles?.sidebar || {};
  const logo = styles?.logo || {};

  if (colors.primary) {
    root.style.setProperty('--primary', colors.primary);
    root.style.setProperty('--primary-light', lighten(colors.primary, 0.25));
    root.style.setProperty('--primary-lighter', lighten(colors.primary, 0.88));
  }
  if (colors.background) root.style.setProperty('--background', colors.background);
  if (colors.cards) root.style.setProperty('--surface', colors.cards);
  if (colors.secondary) root.style.setProperty('--secondary', colors.secondary);
  if (colors.text) root.style.setProperty('--text', colors.text);
  if (colors.border) root.style.setProperty('--border', colors.border);
  
  if (colors.transaction) {
    root.style.setProperty('--transaction-color', colors.transaction);
    root.style.setProperty('--transaction-color-light', lighten(colors.transaction, 0.15));
  } else {
    root.style.removeProperty('--transaction-color');
    root.style.removeProperty('--transaction-color-light');
  }

  if (logo.store_logo_url) {
    root.style.setProperty('--store-logo', `url(${logo.store_logo_url})`);
  } else {
    root.style.removeProperty('--store-logo');
  }

  if (logo.platform_logo_url) {
    root.style.setProperty('--platform-logo', `url(${logo.platform_logo_url})`);
  } else {
    root.style.removeProperty('--platform-logo');
  }

  if (sidebar.icon_ventas) root.style.setProperty('--sidebar-icon-ventas', sidebar.icon_ventas);
  if (sidebar.icon_turnos) root.style.setProperty('--sidebar-icon-turnos', sidebar.icon_turnos);
  if (sidebar.icon_reportes) root.style.setProperty('--sidebar-icon-reportes', sidebar.icon_reportes);
  if (sidebar.icon_mas) root.style.setProperty('--sidebar-icon-mas', sidebar.icon_mas);
  if (sidebar.iconSize) root.style.setProperty('--sidebar-icon-size', sidebar.iconSize);

  if (cards.borderRadius) root.style.setProperty('--radius', cards.borderRadius);
  if (sidebar.width) root.style.setProperty('--sidebar-width', sidebar.width);
  if (typography.fontFamily) root.style.setProperty('--font-family', typography.fontFamily);
  if (typography.fontSize) root.style.setProperty('--font-size', typography.fontSize);
  if (typography.fontWeight) root.style.setProperty('--font-weight', typography.fontWeight);
  if (typography.letterSpacing) root.style.setProperty('--letter-spacing', typography.letterSpacing);
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
  const pathname = usePathname();
  const [themeTrigger, setThemeTrigger] = useState(0);

  // Listen to external theme change triggers & Supabase Realtime
  useEffect(() => {
    const handleReload = () => setThemeTrigger(prev => prev + 1);
    window.addEventListener('pos-theme-changed', handleReload);

    // Setup Supabase Realtime channel
    const channel = supabase
      .channel('public:pos_themes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pos_themes' },
        () => {
          setThemeTrigger(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('pos-theme-changed', handleReload);
      supabase.removeChannel(channel);
    };
  }, []);

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

  // Apply dynamic visual theme from pos_themes only on POS pages
  useEffect(() => {
    async function loadActiveTheme() {
      const isPos = pathname?.startsWith('/pos');
      const root = document.documentElement;

      if (!isPos) {
        // Revert custom variables to original ERP defaults, but respect custom branding parameters
        if (config?.theme_primary_color) {
          root.style.setProperty('--primary', config.theme_primary_color);
          root.style.setProperty('--primary-light', lighten(config.theme_primary_color, 0.25));
          root.style.setProperty('--primary-lighter', lighten(config.theme_primary_color, 0.88));
        } else {
          root.style.removeProperty('--primary');
          root.style.removeProperty('--primary-light');
          root.style.removeProperty('--primary-lighter');
        }

        root.style.removeProperty('--background');
        root.style.removeProperty('--surface');
        root.style.removeProperty('--secondary');
        root.style.removeProperty('--text');
        root.style.removeProperty('--border');
        root.style.removeProperty('--sidebar-width');
        root.style.removeProperty('--font-weight');
        root.style.removeProperty('--letter-spacing');

        if (config?.theme_font_family) {
          root.style.setProperty('--font-family', config.theme_font_family);
        } else {
          root.style.removeProperty('--font-family');
        }

        if (config?.theme_font_size) {
          root.style.setProperty('--font-size', config.theme_font_size);
        } else {
          root.style.removeProperty('--font-size');
        }

        if (config?.theme_modal_radius) {
          root.style.setProperty('--radius', config.theme_modal_radius);
        } else {
          root.style.removeProperty('--radius');
        }

        if (config?.theme_modal_blur) {
          root.style.setProperty('--modal-blur', config.theme_modal_blur);
        } else {
          root.style.removeProperty('--modal-blur');
        }
        return;
      }

      try {
        let activeStoreId = typeof window !== 'undefined' ? localStorage.getItem('pos_selected_store_id') : null;
        if (!activeStoreId) {
          const { data: authData } = await supabase.auth.getUser();
          activeStoreId = authData?.user?.user_metadata?.store_id;
        }

        const { data: themes, error } = await supabase
          .from('pos_themes')
          .select('*');

        if (error) throw error;
        if (!themes || themes.length === 0) return;

        const now = new Date();
        let matched = themes.find(t => {
          if (t.start_date && t.end_date) {
            const start = new Date(t.start_date);
            const end = new Date(t.end_date);
            return now >= start && now <= end && (t.store_id === activeStoreId || t.scope === 'all');
          }
          return false;
        });

        if (!matched && activeStoreId) {
          matched = themes.find(t => t.scope === 'store' && t.store_id === activeStoreId && t.is_active);
        }

        if (!matched) {
          matched = themes.find(t => t.scope === 'all' && t.is_active);
        }

        if (matched) {
          applyThemeStyles(matched.styles);
        }
      } catch (err) {
        console.error("Error loading theme from database:", err);
      }
    }
    loadActiveTheme();
  }, [pathname, config?.theme_primary_color, themeTrigger]);

  // Realtime Live Preview (Native Broadcast Channel & Supabase Broadcast Channel)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Same-device Broadcast Channel
    const localBC = new BroadcastChannel('pos-live-theme-preview');
    localBC.onmessage = (event) => {
      if (event.data?.styles) {
        applyThemeStyles(event.data.styles);
      }
    };

    // 2. Multi-device Supabase Broadcast Channel
    const channel = supabase
      .channel('pos-live-theme-broadcast')
      .on('broadcast', { event: 'preview-theme' }, (payload) => {
        if (payload.payload?.styles) {
          applyThemeStyles(payload.payload.styles);
        }
      })
      .subscribe();

    return () => {
      localBC.close();
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
