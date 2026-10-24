import { NextResponse } from 'next/server';
import { AlegraClient } from '@/lib/alegra/client';

export const maxDuration = 30;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start') ? Number(searchParams.get('start')) : 0;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 30;
    const order_direction = (searchParams.get('order_direction') as 'ASC' | 'DESC') || 'DESC';

    const res = await AlegraClient.getInvoices({ start, limit, order_direction, metadata: true });

    return NextResponse.json({
      success: res.ok,
      status: res.status,
      data: res.data,
      rawRequest: res.rawRequest
    }, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || String(error)
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { invoice, autoStamp = true } = body;

    if (!invoice) {
      return NextResponse.json({
        success: false,
        error: 'El campo "invoice" es obligatorio con la información de la factura.'
      }, { status: 400 });
    }

    // 1. Create Invoice in Alegra
    const createRes = await AlegraClient.createInvoice(invoice);

    if (!createRes.ok) {
      return NextResponse.json({
        success: false,
        status: createRes.status,
        error: createRes.data?.message || 'Error al crear la factura en Alegra',
        details: createRes.data,
        rawRequest: createRes.rawRequest
      }, { status: createRes.status });
    }

    const createdInvoice = createRes.data;
    let stampRes: any = null;

    // 2. Auto-Stamp with DIAN if requested
    if (autoStamp && createdInvoice?.id) {
      try {
        stampRes = await AlegraClient.stampInvoice(createdInvoice.id);
      } catch (eStamp: any) {
        stampRes = { ok: false, error: eStamp.message || String(eStamp) };
      }
    }

    return NextResponse.json({
      success: true,
      status: 201,
      invoice: createdInvoice,
      stamp: stampRes?.data || stampRes,
      rawRequest: createRes.rawRequest,
      stampRawRequest: stampRes?.rawRequest
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || String(error)
    }, { status: 500 });
  }
}
