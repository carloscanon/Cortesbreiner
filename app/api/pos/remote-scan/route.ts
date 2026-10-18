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
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        try { supabaseAdmin.removeChannel(channel); } catch {}
        resolve();
      }, 3000);

      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try {
            await channel.send({
              type: 'broadcast',
              event: 'scan',
              payload: {
                barcode: cleanBarcode,
                scannerDevice: scannerDevice || 'Celular Remoto',
                timestamp: Date.now()
              }
            });
          } catch (e) {
            console.warn('Channel send error:', e);
          } finally {
            clearTimeout(timer);
            try { supabaseAdmin.removeChannel(channel); } catch {}
            resolve();
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timer);
          try { supabaseAdmin.removeChannel(channel); } catch {}
          resolve();
        }
      });
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
