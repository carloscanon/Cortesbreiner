import { supabase } from '../../supabase';
import { encrypt, decrypt } from '../shared/crypto';
import { SiigoClient } from './client';

export class SiigoTokenManager {
  private currentAuthPromise: Promise<string | null> | null = null;

  /**
   * Obtiene un token válido. Si no existe o está vencido, solicita uno nuevo.
   */
  public async getToken(): Promise<string | null> {
    try {
      // 1. Consultar base de datos
      const { data, error } = await supabase
        .from('erp_tokens')
        .select('*')
        .eq('erp_name', 'SIIGO')
        .maybeSingle();

      if (error) {
        console.error('Error obteniendo token de SIIGO desde DB:', error);
      }

      if (data) {
        const expiresAt = new Date(data.expires_at).getTime();
        // Margen de seguridad de 5 minutos antes de expirar
        const safetyMargin = 5 * 60 * 1000;
        
        if (expiresAt > Date.now() + safetyMargin) {
          try {
            return decrypt(data.access_token_encrypted);
          } catch (decErr) {
            console.error('Error desencriptando token, se solicitará uno nuevo:', decErr);
          }
        }
      }

      // 2. Si no hay token o está vencido, renovar
      return await this.refreshToken();
    } catch (e) {
      console.error('Excepción crítica en SiigoTokenManager.getToken:', e);
      return null;
    }
  }

  /**
   * Renueva el token realizando la petición a SIIGO.
   * Evita solicitudes simultáneas en paralelo utilizando una promesa compartida (Locking).
   */
  public async refreshToken(): Promise<string | null> {
    if (this.currentAuthPromise) {
      return this.currentAuthPromise;
    }

    this.currentAuthPromise = (async () => {
      try {
        console.log('Iniciando renovación de token de SIIGO...');
        const config = await SiigoClient.getConfig();

        if (!config.username || !config.accessKey) {
          console.warn('Configuración de credenciales de SIIGO incompleta. No se puede obtener token.');
          return null;
        }

        const authPayload = {
          username: config.username,
          access_key: config.accessKey
        };

        // Realizamos la llamada a /auth usando SiigoClient
        const response = await SiigoClient.request(
          'POST',
          '/auth',
          authPayload,
          {},
          true // Indica que es llamada de autenticación para evitar bucles de 401
        );

        const token = response?.access_token;
        const expiresIn = response?.expires_in || 86400; // segundos

        if (!token) {
          throw new Error('La respuesta de autenticación de SIIGO no contiene access_token');
        }

        const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
        const encryptedToken = encrypt(token);

        // Guardar token en DB (Upsert)
        const { error } = await supabase
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

        if (error) {
          console.error('Error al guardar token de SIIGO en la DB:', error);
        }

        console.log('Token de SIIGO renovado y almacenado exitosamente.');
        return token;
      } catch (err) {
        console.error('Error crítico al autenticar con SIIGO:', err);
        return null;
      } finally {
        this.currentAuthPromise = null;
      }
    })();

    return this.currentAuthPromise;
  }
}

export const siigoTokenManager = new SiigoTokenManager();
