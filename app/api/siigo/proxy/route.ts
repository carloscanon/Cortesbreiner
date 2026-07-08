import { NextResponse } from 'next/server';
import { SiigoClient } from '../../../../lib/integration/siigo/client';
import { IntegrationLogger } from '../../../../lib/integration/shared/logger';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { method, endpoint, payload, headers } = body;

    if (!method || !endpoint) {
      return NextResponse.json({ error: 'Faltan campos obligatorios: method, endpoint' }, { status: 400 });
    }

    console.log(`[Proxy] Ejecutando petición dinámica: ${method} ${endpoint}`);
    
    const startTime = Date.now();
    let response;
    
    try {
      response = await SiigoClient.request(
        method,
        endpoint,
        payload,
        headers || {}
      );
    } catch (err: any) {
      // Si arrojó una excepción capturada ErpException, la enviamos con status
      return NextResponse.json({
        error: err.message,
        code: err.code,
        details: err.details,
        responseTimeMs: Date.now() - startTime
      }, { status: err.statusCode || 400 });
    }

    const duration = Date.now() - startTime;

    await IntegrationLogger.logAudit({
      action: `PROXY_REQUEST_${method}`,
      details: `Petición ejecutada exitosamente a ${endpoint}. Duración: ${duration}ms`
    });

    return NextResponse.json({
      success: true,
      data: response,
      responseTimeMs: duration
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
