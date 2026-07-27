import { supabase } from './supabase';

export interface PrintProfileElement {
  enabled: boolean;
  x: number; // mm
  y: number; // mm
  width: number; // mm
  height: number; // mm
  fontSize: number; // rem
  fontWeight: string;
  color: string;
  align: 'left' | 'center' | 'right';
  autoCenter?: boolean;
}

export interface PrintProfile {
  id: string;
  name: string;
  module: 'confeccion' | 'calidad' | 'inventario' | 'produccion' | 'compras' | 'recepcion' | 'logistica';
  paper_size: string; // e.g., 'A4', 'Zebra 50x80', 'Custom'
  width_mm: number;
  height_mm: number;
  columns: number;
  rows_per_page?: number;
  orientation: 'portrait' | 'landscape';
  margin_top: number;
  margin_bottom: number;
  margin_left: number;
  margin_right: number;
  spacing_x: number; // horizontal gap mm
  spacing_y: number; // vertical gap mm
  is_default: boolean;
  elements: Record<string, PrintProfileElement>;
  created_at?: string;
  updated_at?: string;
}

export interface GarmentLabelData {
  id: string;
  barcode: string;
  reference_name?: string;
  color_name?: string;
  size_code?: string;
  sku?: string;
  consecutive?: string;
  order_code?: string;
  lot_number?: string;
  created_at?: string;
  operator_name?: string;
  notes?: string;
  company_name?: string;
  brand_name?: string;
  collection_name?: string;
  price?: string | number;
  [key: string]: any;
}

export class PrintLabelService {
  /**
   * Fetch all print profiles from Supabase.
   */
  static async getProfiles(): Promise<PrintProfile[]> {
    try {
      const { data, error } = await supabase
        .from('print_profiles')
        .select('*')
        .order('is_default', { ascending: false });

      if (error || !data || data.length === 0) {
        return [this.getDefaultProfile('confeccion')];
      }
      return data as PrintProfile[];
    } catch {
      return [this.getDefaultProfile('confeccion')];
    }
  }

  /**
   * Get active profile for a specific module or default profile.
   */
  static async getActiveProfile(moduleName: string = 'confeccion'): Promise<PrintProfile> {
    const profiles = await this.getProfiles();
    const moduleProfile = profiles.find((p) => p.module === moduleName);
    if (moduleProfile) return moduleProfile;

    const defaultProfile = profiles.find((p) => p.is_default);
    if (defaultProfile) return defaultProfile;

    return profiles[0] || this.getDefaultProfile(moduleName);
  }

  /**
   * Save or update a print profile in Supabase.
   */
  static async saveProfile(profile: Partial<PrintProfile>): Promise<PrintProfile | null> {
    const { data, error } = await supabase
      .from('print_profiles')
      .upsert(profile)
      .select()
      .single();

    if (error) {
      console.error('Error saving print profile:', error);
      return null;
    }
    return data as PrintProfile;
  }

  /**
   * Calculate grid layout info without hardcoded values.
   */
  static calculateLayout(profile: PrintProfile, totalItems: number) {
    const printableWidth = profile.width_mm - profile.margin_left - profile.margin_right;
    const printableHeight = profile.height_mm - profile.margin_top - profile.margin_bottom;

    const cols = profile.columns || 3;
    const spacingX = profile.spacing_x ?? 2;
    const spacingY = profile.spacing_y ?? 2;

    // Label width calculated dynamically
    const labelWidth = (printableWidth - (cols - 1) * spacingX) / cols;

    // Estimate label height if not explicitly provided or fit to elements
    const labelHeight = profile.elements?.height
      ? profile.elements.height.height
      : Math.min(80, printableHeight);

    const rowsPerPage = profile.rows_per_page || Math.max(1, Math.floor((printableHeight + spacingY) / (labelHeight + spacingY)));
    const labelsPerPage = cols * rowsPerPage;
    const totalPages = Math.ceil(totalItems / labelsPerPage) || 1;

    return {
      printableWidth,
      printableHeight,
      cols,
      rowsPerPage,
      labelsPerPage,
      totalPages,
      labelWidth,
      labelHeight,
      spacingX,
      spacingY
    };
  }

  /**
   * Generate fallback default profile if DB has none.
   */
  static getDefaultProfile(moduleName: string = 'confeccion'): PrintProfile {
    return {
      id: 'default-profile',
      name: 'Stickers Confección (Zebra 3 Cols)',
      module: moduleName as any,
      paper_size: 'Zebra 100x100mm',
      width_mm: 100,
      height_mm: 100,
      columns: 3,
      rows_per_page: 1,
      orientation: 'portrait',
      margin_top: 3,
      margin_bottom: 3,
      margin_left: 3,
      margin_right: 3,
      spacing_x: 2,
      spacing_y: 2,
      is_default: true,
      elements: {
        company: { enabled: true, x: 0, y: 0, width: 30, height: 5, fontSize: 0.6, fontWeight: '900', color: '#80082E', align: 'center', autoCenter: true },
        title: { enabled: true, x: 0, y: 6, width: 30, height: 6, fontSize: 0.65, fontWeight: '900', color: '#1e293b', align: 'center', autoCenter: true },
        client: { enabled: true, x: 0, y: 13, width: 30, height: 5, fontSize: 0.55, fontWeight: '700', color: '#64748b', align: 'center', autoCenter: true },
        barcode: { enabled: true, x: 0, y: 19, width: 24, height: 12, fontSize: 0.55, fontWeight: '950', color: '#000000', align: 'center', autoCenter: true },
        total: { enabled: true, x: 0, y: 34, width: 30, height: 6, fontSize: 0.85, fontWeight: '900', color: '#ffffff', align: 'center', autoCenter: true }
      }
    };
  }
}
