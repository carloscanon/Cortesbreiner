import { supabase } from './supabase';

/**
 * Calcula los metros planeados y reales de una lista de cortes agrupados
 * por fabric_id + color_id.
 *
 * REGLA DE NEGOCIO:
 * Cada corte en la BD representa UNA talla/tamaño de una tendida.
 * Múltiples cortes comparten la misma tendida (mismo stroke_length + layers).
 * Los metros de una tendida = stroke_length × layers.
 * Para evitar contar la misma tendida N veces (una por talla), se
 * deduplicamos por (stroke_length, layers): tomamos el valor único.
 *
 * Si hay varios grupos de tendida distintos (stroke_length diferente),
 * se suma cada tendida una sola vez.
 */
function calcMetrosFromCuts(
  matchingCuts: any[],
  useLayersProduced: boolean,
  hasAnyProgress: boolean
): { planeados: number; reales: number } {
  // Agrupar por stroke_length para deduplicar tendidas
  // (todos los cortes del mismo stroke_length pertenecen a la misma tendida)
  const tendidaMap: Record<string, { layers: number; layersProduced: number }> = {};

  matchingCuts.forEach(c => {
    const key = String(Number(c.stroke_length) || 0);
    const prev = tendidaMap[key];
    const layers = Number(c.layers) || 0;
    const layersProduced = Number(c.layers_produced) || 0;

    if (!prev) {
      tendidaMap[key] = { layers, layersProduced };
    } else {
      // Si hay diferencia de capas entre cortes de misma tendida, tomar el mayor
      tendidaMap[key] = {
        layers: Math.max(prev.layers, layers),
        layersProduced: Math.max(prev.layersProduced, layersProduced)
      };
    }
  });

  let planeados = 0;
  let reales = 0;

  Object.entries(tendidaMap).forEach(([strokeKey, { layers, layersProduced }]) => {
    const stroke = Number(strokeKey);
    planeados += stroke * layers;

    const realLayers = hasAnyProgress ? layersProduced : layers;
    reales += stroke * realLayers;
  });

  return { planeados, reales };
}

export async function syncOrderMovements(orderId: string, status: string) {
  try {
    if (!orderId) return;

    // 1. Fetch cuts for the order
    const { data: cuts, error: cutsErr } = await supabase
      .from('cuts')
      .select('*')
      .eq('order_id', orderId);
    
    if (cutsErr) throw cutsErr;
    if (!cuts || cuts.length === 0) return;

    // 1b. Fetch rendimiento_estimado for all fabrics referenced in cuts
    const fabricIds = [...new Set(cuts.map(c => c.fabric_id).filter(Boolean))];
    const fabricRendimientoMap: Record<string, number> = {};
    if (fabricIds.length > 0) {
      const { data: fabrics } = await supabase
        .from('fabrics')
        .select('id, rendimiento_estimado')
        .in('id', fabricIds);
      (fabrics || []).forEach((f: any) => {
        fabricRendimientoMap[String(f.id)] = Number(f.rendimiento_estimado) > 0 ? Number(f.rendimiento_estimado) : 3.5;
      });
    }

    // 2. Fetch existing inventory movements for this order
    const { data: existingMovs, error: movsErr } = await supabase
      .from('inventory_movements')
      .select('*')
      .eq('order_id', orderId);

    if (movsErr) throw movsErr;

    // 3. Map order status to inventory movement estado
    const statusLower = (status || '').toLowerCase();
    let targetEstado = 'planeacion';
    if (statusLower === 'planeada' || statusLower === 'en corte') {
      targetEstado = 'planeacion';
    } else if (statusLower === 'tendido' || statusLower === 'cortando' || statusLower === 'cortado') {
      targetEstado = 'corte';
    } else if (statusLower === 'en confección' || statusLower === 'en confeccion' || statusLower === 'terminada' || statusLower === 'completada') {
      targetEstado = 'confeccion';
    }

    // Check if any progress has been reported for this order
    const hasAnyProgress = cuts.some(c => (Number(c.layers_produced) || 0) > 0);

    // 4. Calculate metros for each fabric and color combo
    // Group by fabric_id + color_id (each combo represents a different color/roll)
    const fabricColorKeys = new Set<string>();
    cuts.forEach(c => {
      if (!c.fabric_id) return;
      fabricColorKeys.add(`${c.fabric_id}_${c.color_id || 'none'}`);
    });

    const movementsToInsert: any[] = [];
    const movementsToUpdate: { id: string; metros_planeados: number; metros_reales: number; kilos_planeados: number; kilos_reales: number; estado: string }[] = [];

    fabricColorKeys.forEach(key => {
      const [fabricId, colorIdStr] = key.split('_');
      const colorId = colorIdStr === 'none' ? null : colorIdStr;

      // Filter cuts for this fabric & color
      const matchingCuts = cuts.filter(c => 
        String(c.fabric_id) === fabricId && 
        String(c.color_id || 'none') === (colorId || 'none')
      );

      // Rendimiento for this fabric
      const rendimiento = fabricRendimientoMap[fabricId] || 3.5;

      // Metros usando deduplicación de tendidas
      const { planeados, reales } = calcMetrosFromCuts(matchingCuts, hasAnyProgress, hasAnyProgress);

      const metrosReales = (targetEstado === 'planeacion') ? 0 : reales;

      // Kilos calculados a partir de rendimiento_estimado
      const kilosPlaneados = planeados / rendimiento;
      const kilosReales = metrosReales / rendimiento;

      // Check if we have an existing movement for this fabric & color
      const matchedMov = existingMovs?.find(m => 
        String(m.fabric_id) === fabricId && 
        String(m.color_id || 'none') === (colorId || 'none')
      );

      if (matchedMov) {
        movementsToUpdate.push({
          id: matchedMov.id,
          metros_planeados: planeados,
          metros_reales: metrosReales,
          kilos_planeados: kilosPlaneados,
          kilos_reales: kilosReales,
          estado: targetEstado
        });
      } else {
        movementsToInsert.push({
          order_id: orderId,
          fabric_id: fabricId,
          color_id: colorId,
          metros_planeados: planeados,
          metros_reales: metrosReales,
          kilos_planeados: kilosPlaneados,
          kilos_reales: kilosReales,
          tipo_movimiento: 'egreso',
          estado: targetEstado,
          observaciones: `Registro automático - Estado: ${status}`
        });
      }
    });

    // Perform DB updates
    for (const mov of movementsToUpdate) {
      await supabase
        .from('inventory_movements')
        .update({
          metros_planeados: mov.metros_planeados,
          metros_reales: mov.metros_reales,
          kilos_planeados: mov.kilos_planeados,
          kilos_reales: mov.kilos_reales,
          estado: mov.estado,
          updated_at: new Date().toISOString()
        })
        .eq('id', mov.id);
    }

    if (movementsToInsert.length > 0) {
      await supabase
        .from('inventory_movements')
        .insert(movementsToInsert);
    }

  } catch (err) {
    console.error('Error in syncOrderMovements:', err);
  }
}
