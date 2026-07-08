import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

export async function GET() {
  try {
    // 1. Obtener logs de los últimos 7 días
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: logs, error } = await supabase
      .from('erp_logs')
      .select('*')
      .eq('erp_name', 'SIIGO')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    const totalCalls = logs ? logs.length : 0;
    
    // Calcular tasa de error y disponibilidad
    const successCalls = logs ? logs.filter(l => l.status_code && l.status_code >= 200 && l.status_code < 400).length : 0;
    const errorCalls = totalCalls - successCalls;
    const availability = totalCalls > 0 ? (successCalls / totalCalls) * 100 : 100;

    // Latencia promedio
    const latencySum = logs ? logs.reduce((acc, curr) => acc + (curr.response_time_ms || 0), 0) : 0;
    const avgLatency = totalCalls > 0 ? latencySum / totalCalls : 0;

    // Agrupación por endpoint
    const endpointCounts: Record<string, number> = {};
    if (logs) {
      logs.forEach(l => {
        // Limpiamos el query param o ids dinámicos para agrupar
        const cleanEndpoint = l.endpoint.split('?')[0].replace(/\/[0-9a-fA-F-]{36}/, '/{id}');
        endpointCounts[cleanEndpoint] = (endpointCounts[cleanEndpoint] || 0) + 1;
      });
    }

    const topEndpoints = Object.entries(endpointCounts)
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Agrupación por día para el gráfico de uso diario
    const dailyUsage: Record<string, { calls: number; errors: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' });
      dailyUsage[key] = { calls: 0, errors: 0 };
    }

    if (logs) {
      logs.forEach(l => {
        const key = new Date(l.created_at).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' });
        if (dailyUsage[key] !== undefined) {
          dailyUsage[key].calls++;
          if (!l.status_code || l.status_code >= 400) {
            dailyUsage[key].errors++;
          }
        }
      });
    }

    const chartData = Object.entries(dailyUsage).map(([day, stats]) => ({
      day,
      Peticiones: stats.calls,
      Errores: stats.errors
    }));

    return NextResponse.json({
      summary: {
        totalCalls,
        availability: Number(availability.toFixed(1)),
        avgLatency: Number(avgLatency.toFixed(0)),
        errorCalls
      },
      topEndpoints,
      chartData
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
