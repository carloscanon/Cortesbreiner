import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({ error: 'Faltan credenciales de Supabase' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 1. Cargar Bodegas para mapear Bodega Tránsito y Locales
    const { data: warehouses } = await supabase.from('warehouses').select('*');
    const transitWarehouse = warehouses?.find(w => w.nombre_bodega.toLowerCase().includes('transito') || w.nombre_bodega.toLowerCase().includes('confeccion'));
    const principalWarehouse = warehouses?.find(w => w.nombre_bodega.toLowerCase().includes('principal'));

    // 2. REGLA 1: Bodega Tránsito (Confección)
    // Prendas en Bodega Tránsito que ya fueron aprobadas por Calidad
    let transitApprovedGarments: any[] = [];
    let transitNonSatelliteGarments: any[] = [];

    if (transitWarehouse) {
      const { data: tGarments } = await supabase
        .from('individual_garments')
        .select(`
          *,
          quality_inspections (id, status, current_stage)
        `)
        .eq('warehouse_id', transitWarehouse.id)
        .neq('status', 'vendido');

      if (tGarments && tGarments.length > 0) {
        transitApprovedGarments = tGarments.filter((g: any) => {
          const ins = Array.isArray(g.quality_inspections) ? g.quality_inspections[0] : g.quality_inspections;
          return ins && (ins.status === 'Aprobado' || g.status === 'Aprobada');
        });
      }
    }

    // 3. REGLAS DE TRÁSITO: Sincronización Bidireccional
    // Inventario en Tránsito vs Traslados Pendientes de Recepción
    const { data: pendingTransfers } = await supabase
      .from('finished_goods_transfers')
      .select(`
        *,
        orig:warehouses!finished_goods_transfers_warehouse_orig_id_fkey (nombre_bodega),
        dest:warehouses!finished_goods_transfers_warehouse_dest_id_fkey (nombre_bodega),
        finished_goods_transfer_items (*)
      `)
      .in('estado', ['Pendiente', 'EN_TRANSITO', 'ENVIADO']);

    let totalPendingTransferUnits = 0;
    (pendingTransfers || []).forEach(tx => {
      (tx.finished_goods_transfer_items || []).forEach((it: any) => {
        totalPendingTransferUnits += Number(it.cantidad || 0);
      });
    });

    // 4. REGLA 5: Doble Existencia / Prendas en múltiples ubicaciones
    const { data: allGarments } = await supabase
      .from('individual_garments')
      .select('barcode, warehouse_id, store_id, status')
      .neq('status', 'vendido');

    const barcodeLocationMap: Record<string, string[]> = {};
    (allGarments || []).forEach((g: any) => {
      if (!g.barcode) return;
      const bc = g.barcode.trim().toUpperCase();
      if (!barcodeLocationMap[bc]) barcodeLocationMap[bc] = [];
      const loc = g.store_id ? `Store:${g.store_id}` : `Warehouse:${g.warehouse_id}`;
      if (!barcodeLocationMap[bc].includes(loc)) {
        barcodeLocationMap[bc].push(loc);
      }
    });

    const duplicateBarcodes = Object.entries(barcodeLocationMap).filter(([_, locs]) => locs.length > 1);

    // 5. Matriz de Reconciliación por Bodega
    const reconciliationMatrix: any[] = [];
    
    (warehouses || []).forEach(w => {
      const isTransit = w.id === transitWarehouse?.id;
      const pendingTxForWh = (pendingTransfers || []).filter(t => t.warehouse_dest_id === w.id);
      const pendingUnits = pendingTxForWh.reduce((sum, tx) => {
        return sum + (tx.finished_goods_transfer_items || []).reduce((s: number, i: any) => s + Number(i.cantidad || 0), 0);
      }, 0);

      reconciliationMatrix.push({
        warehouseId: w.id,
        warehouseName: w.nombre_bodega,
        isTransit,
        pendingTransfersCount: pendingTxForWh.length,
        pendingUnits,
        status: isTransit ? (transitApprovedGarments.length > 0 ? 'ERROR' : 'OK') : 'OK'
      });
    });

    // 6. Determinar Semáforo Global de Consistencia
    let globalStatus: 'CONSISTENTE' | 'CON_DIFERENCIAS' | 'INCONSISTENTE' = 'CONSISTENTE';
    const issuesList: string[] = [];

    if (transitApprovedGarments.length > 0) {
      globalStatus = 'INCONSISTENTE';
      issuesList.push(`${transitApprovedGarments.length} prendas aprobadas por Calidad aún permanecen en Bodega Tránsito (Confección).`);
    }

    if (duplicateBarcodes.length > 0) {
      globalStatus = 'INCONSISTENTE';
      issuesList.push(`${duplicateBarcodes.length} prendas individuales registradas simultáneamente en múltiples ubicaciones.`);
    }

    if (issuesList.length === 0 && pendingTransfers && pendingTransfers.length > 0) {
      globalStatus = 'CON_DIFERENCIAS';
      issuesList.push(`Hay ${pendingTransfers.length} traslados (${totalPendingTransferUnits} Uds) actualmente en estado Pendiente de Recepción.`);
    }

    return NextResponse.json({
      success: true,
      globalStatus, // 'CONSISTENTE' | 'CON_DIFERENCIAS' | 'INCONSISTENTE'
      totalPendingTransfers: pendingTransfers?.length || 0,
      totalPendingTransferUnits,
      transitApprovedGarmentsCount: transitApprovedGarments.length,
      duplicateBarcodesCount: duplicateBarcodes.length,
      issuesList,
      reconciliationMatrix,
      pendingTransfers: pendingTransfers || []
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al ejecutar auditoría de consistencia' }, { status: 500 });
  }
}
