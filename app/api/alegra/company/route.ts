import { NextResponse } from 'next/server';
import { AlegraClient } from '@/lib/alegra/client';

export const maxDuration = 30;

export async function GET() {
  const startTime = Date.now();
  try {
    const res = await AlegraClient.getCompany();
    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: res.ok,
      status: res.status,
      responseTimeMs: duration,
      request: res.rawRequest,
      company: res.data
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
