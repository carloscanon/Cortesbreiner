import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';
import { encrypt } from '../../../../lib/integration/shared/crypto';
import { SiigoClient } from '../../../../lib/integration/siigo/client';
import { IntegrationLogger } from '../../../../lib/integration/shared/logger';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('erp_config')
      .select('*')
      .eq('erp_name', 'SIIGO')
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json({
        erp_name: 'SIIGO',
        api_url: 'https://api.siigo.com/v1',
        environment: 'sandbox',
        username: '',
        partner_id: '',
        timeout_ms: 10000,
        max_retries: 3,
        retry_delay_ms: 1000,
        headers: {},
        is_active: true
      });
    }

    // Retornamos los datos excepto el access_key encriptado por seguridad
    const { access_key_encrypted, ...cleanConfig } = data;
    return NextResponse.json({
      ...cleanConfig,
      has_key: !!access_key_encrypted
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      api_url,
      environment,
      username,
      access_key,
      partner_id,
      timeout_ms,
      max_retries,
      retry_delay_ms,
      headers,
      is_active
    } = body;

    if (!api_url || !username) {
      return NextResponse.json({ error: 'Faltan campos obligatorios: api_url, username' }, { status: 400 });
    }

    // Obtener la configuración actual para mantener la contraseña si no se envió una nueva
    const { data: existing } = await supabase
      .from('erp_config')
      .select('access_key_encrypted')
      .eq('erp_name', 'SIIGO')
      .maybeSingle();

    let accessKeyEncrypted = existing?.access_key_encrypted || '';

    if (access_key) {
      accessKeyEncrypted = encrypt(access_key);
    } else if (!accessKeyEncrypted) {
      return NextResponse.json({ error: 'El access_key es obligatorio' }, { status: 400 });
    }

    const { error } = await supabase
      .from('erp_config')
      .upsert(
        {
          erp_name: 'SIIGO',
          api_url,
          environment,
          username,
          access_key_encrypted: accessKeyEncrypted,
          partner_id,
          timeout_ms: Number(timeout_ms) || 10000,
          max_retries: Number(max_retries) || 3,
          retry_delay_ms: Number(retry_delay_ms) || 1000,
          headers: typeof headers === 'object' ? headers : {},
          is_active: is_active !== false,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'erp_name' }
      );

    if (error) throw error;

    // Limpiar cache local en el proceso Node
    SiigoClient.clearCache();

    await IntegrationLogger.logAudit({
      action: 'SAVE_CONFIG',
      details: `Configuración de SIIGO guardada por ${username}. Ambiente: ${environment}`
    });

    return NextResponse.json({ success: true, message: 'Configuración guardada exitosamente.' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
