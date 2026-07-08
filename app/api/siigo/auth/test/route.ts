import { NextResponse } from 'next/server';
import { siigoTokenManager } from '../../../../../lib/integration/siigo/token-manager';
import { IntegrationLogger } from '../../../../../lib/integration/shared/logger';

export async function POST() {
  try {
    console.log('[API] Probando autenticación con SIIGO...');

    // Solo probar el token — no llamar testConnection() para evitar doble petición
    const token = await siigoTokenManager.refreshToken();

    if (!token) {
      // Log de forma no bloqueante
      IntegrationLogger.logAudit({
        action: 'TEST_CONNECTION',
        details: 'FALLIDO: No se obtuvo token. Verifica credenciales.'
      }).catch(() => {});

      return NextResponse.json({
        success: false,
        message: 'No se pudo obtener el token de acceso. Verifica el usuario y access_key en Configuración.'
      });
    }

    // Log de forma no bloqueante
    IntegrationLogger.logAudit({
      action: 'TEST_CONNECTION',
      details: 'EXITOSO: Token de SIIGO obtenido y almacenado.'
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Conectado exitosamente con la API de SIIGO. Token válido obtenido.',
      token_preview: `${token.substring(0, 15)}...[REDACTED]...${token.substring(token.length - 15)}`
    });
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      message: e.message || String(e)
    });
  }
}
