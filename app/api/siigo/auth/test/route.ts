import { NextResponse } from 'next/server';
import { SiigoConnector } from '../../../../../lib/integration/siigo/SiigoConnector';
import { siigoTokenManager } from '../../../../../lib/integration/siigo/token-manager';
import { IntegrationLogger } from '../../../../../lib/integration/shared/logger';

export async function POST() {
  try {
    console.log('[API] Probando autenticación con SIIGO...');
    
    // Forzamos actualización de token
    const token = await siigoTokenManager.refreshToken();
    
    if (!token) {
      return NextResponse.json({
        success: false,
        message: 'No se pudo obtener el token de acceso. Verifica las credenciales en configuración.'
      });
    }

    const connector = new SiigoConnector();
    const connectionTest = await connector.testConnection();

    await IntegrationLogger.logAudit({
      action: 'TEST_CONNECTION',
      details: `Resultado: ${connectionTest.success ? 'EXITOSO' : 'FALLIDO'}. Mensaje: ${connectionTest.message}`
    });

    return NextResponse.json({
      success: connectionTest.success,
      message: connectionTest.message,
      token_preview: `${token.substring(0, 15)}...[REDACTED]...${token.substring(token.length - 15)}`
    });
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      message: e.message || String(e)
    });
  }
}
