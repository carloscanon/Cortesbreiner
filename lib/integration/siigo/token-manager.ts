import { supabaseAdmin } from '../../supabase';
import { encrypt, decrypt } from '../shared/crypto';
import { SiigoClient } from './client';

export class SiigoTokenManager {
  private currentAuthPromise: Promise<string | null> | null = null;

  /**
   * Obtiene un token válido desde la base de datos.
   * Si no existe o está vencido, solicita uno nuevo.
   */
  public async getToken(): Promise<string | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('erp_tokens')
        .select('*')
        .eq('erp_name', 'SIIGO')
        .maybeSingle();

      if (error) {
        console.error('Error obteniendo token de SIIGO desde DB:', error);
      }

      if (data) {
        const expiresAt = new Date(data.expires_at).getTime();
        const safetyMargin = 5 * 60 * 1000; // 5 minutos antes de expirar

        if (expiresAt > Date.now() + safetyMargin) {
          try {
            return decrypt(data.access_token_encrypted);
          } catch (decErr) {
            console.error('Error desencriptando token, se solicitará uno nuevo:', decErr);
          }
        }
      }

      return await this.refreshToken();
    } catch (e) {
      console.error('Excepción crítica en SiigoTokenManager.getToken:', e);
      return null;
    }
  }

  /**
   * Renueva el token haciendo una petición directa al endpoint /auth de SIIGO.
   * El endpoint de auth es: https://api.siigo.com/auth (SIN /v1)
   * Usa un lock de promesa para evitar solicitudes paralelas simultáneas.
   */
  public async refreshToken(): Promise<string | null> {
    // Lock: si ya hay una renovación en progreso, esperar esa misma promesa
    if (this.currentAuthPromise) {
      return this.currentAuthPromise;
    }

    this.currentAuthPromise = (async () => {
      try {
        console.log('[SIIGO] Iniciando renovación de token...');
        const config = await SiigoClient.getConfig();

        if (!config.username || !config.accessKey) {
          console.warn('[SIIGO] Credenciales incompletas. Configura usuario y access_key en /siigo.');
          return null;
        }

        // ⚠️ IMPORTANTE: El endpoint de auth de SIIGO NO tiene /v1
        // La URL base es https://api.siigo.com/auth, no https://api.siigo.com/v1/auth
        const baseUrl = config.apiUrl.replace(/\/v\d+\/?$/, ''); // Elimina "/v1" al final si existe
        const authUrl = `${baseUrl}/auth`;

        console.log(`[SIIGO] Autenticando en: ${authUrl}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

        let response: Response;
        try {
          response = await fetch(authUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Partner-Id': config.partnerId || ''
            },
            body: JSON.stringify({
              username: config.username,
              access_key: config.accessKey
            }),
            signal: controller.signal
          });
        } finally {
          clearTimeout(timeoutId);
        }

        let responseData: any;
        try {
          responseData = await response.json();
        } catch {
          throw new Error(`SIIGO auth respondió sin JSON válido. Status: ${response.status}`);
        }

        if (!response.ok) {
          throw new Error(
            `SIIGO Auth falló (HTTP ${response.status}): ${responseData?.message || responseData?.Message || JSON.stringify(responseData)}`
          );
        }

        const token = responseData?.access_token;
        const expiresIn = responseData?.expires_in || 86400;

        if (!token) {
          throw new Error('La respuesta de SIIGO no contiene access_token');
        }

        const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
        const encryptedToken = encrypt(token);

        const { error: dbError } = await supabaseAdmin
          .from('erp_tokens')
          .upsert(
            {
              erp_name: 'SIIGO',
              access_token_encrypted: encryptedToken,
              expires_at: expiresAt,
              updated_at: new Date().toISOString()
            },
            { onConflict: 'erp_name' }
          );

        if (dbError) {
          console.error('[SIIGO] Error al guardar token en DB:', dbError);
        }

        console.log('[SIIGO] Token renovado y almacenado exitosamente.');
        return token;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.error('[SIIGO] Timeout al conectar con SIIGO Auth (8s)');
        } else {
          console.error('[SIIGO] Error crítico al autenticar:', err.message || err);
        }
        return null;
      } finally {
        this.currentAuthPromise = null;
      }
    })();

    return this.currentAuthPromise;
  }
}

export const siigoTokenManager = new SiigoTokenManager();
