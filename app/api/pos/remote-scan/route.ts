import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { channelId, barcode, scannerDevice } = body;

    if (!channelId || !barcode) {
      return NextResponse.json(
        { error: 'channelId y barcode son obligatorios' },
        { status: 400 }
      );
    }

    const cleanBarcode = String(barcode).trim();
    const cleanChannel = String(channelId).trim();

    // Broadcast through Supabase Realtime channel
    const channel = supabaseAdmin.channel(`pos-remote-${cleanChannel}`);
    
    await channel.send({
      type: 'broadcast',
      event: 'scan',
      payload: {
        barcode: cleanBarcode,
        scannerDevice: scannerDevice || 'Celular Remoto',
        timestamp: Date.now()
      }
    });

    return NextResponse.json({
      success: true,
      barcode: cleanBarcode,
      channelId: cleanChannel,
      timestamp: Date.now()
    });
  } catch (err: any) {
    console.error('Error in /api/pos/remote-scan:', err);
    return NextResponse.json(
      { error: err?.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
