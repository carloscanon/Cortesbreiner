import { NextResponse } from 'next/server';
import { AlegraClient } from '@/lib/alegra/client';

export const maxDuration = 30;

export async function POST(req: Request) {
  const startTime = Date.now();
  try {
    const body = await req.json();
    const { method = 'GET', endpoint, payload, headers } = body;

    if (!endpoint) {
      return NextResponse.json({
        success: false,
        error: 'El campo "endpoint" es obligatorio (ej: /invoices, /company, /contacts, /items).'
      }, { status: 400 });
    }

    const res = await AlegraClient.request(
      method.toUpperCase() as any,
      endpoint,
      payload,
      headers || {}
    );

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: res.ok,
      status: res.status,
      responseTimeMs: duration,
      request: res.rawRequest,
      response: res.data
    }, { status: res.status });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    return NextResponse.json({
      success: false,
      status: 500,
      responseTimeMs: duration,
      error: error.message || String(error)
    }, { status: 500 });
  }
}
