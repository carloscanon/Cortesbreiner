import { supabaseAdmin } from '../../supabase';
import { decrypt } from '../shared/crypto';
import { IntegrationLogger } from '../shared/logger';
import { ErpException } from '../core/errors';
import { siigoTokenManager } from './token-manager';

export interface SiigoConfig {
  apiUrl: string;
  environment: string;
  username: string;
  accessKey: string;
  partnerId: string;
  timeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
  headers: Record<string, string>;
}

export class SiigoClient {
  private static cachedConfig: SiigoConfig | null = null;
  private static configLoadedAt: number = 0;
  private static CACHE_TTL = 30000; // 30 segundos de cache para la config

  /**
   * Obtiene la configuración activa de SIIGO desde la base de datos
   */
  public static async getConfig(): Promise<SiigoConfig> {
    const now = Date.now();
    if (this.cachedConfig && (now - this.configLoadedAt < this.CACHE_TTL)) {
      return this.cachedConfig;
    }

    const { data, error } = await supabaseAdmin
      .from('erp_config')
      .select('*')
      .eq('erp_name', 'SIIGO')
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      throw new Error(`Error cargando la configuración de SIIGO: ${error.message}`);
    }

    if (!data) {
      // Configuración por defecto (Sandbox)
      return {
        apiUrl: 'https://api.siigo.com/v1',
        environment: 'sandbox',
        username: '',
        accessKey: '',
        partnerId: '',
        timeoutMs: 10000,
        maxRetries: 3,
        retryDelayMs: 1000,
        headers: {}
      };
    }

    let accessKey = '';
    try {
      accessKey = decrypt(data.access_key_encrypted);
    } catch (e) {
      console.error('Error al desencriptar access_key de Siigo:', e);
    }

    this.cachedConfig = {
      apiUrl: data.api_url || 'https://api.siigo.com/v1',
      environment: data.environment || 'sandbox',
      username: data.username || '',
      accessKey: accessKey,
      partnerId: data.partner_id || '',
      timeoutMs: data.timeout_ms || 10000,
      maxRetries: data.max_retries || 3,
      retryDelayMs: data.retry_delay_ms || 1000,
      headers: data.headers || {}
    };
    this.configLoadedAt = now;

    return this.cachedConfig;
  }

  /**
   * Limpia el cache de configuración
   */
  public static clearCache(): void {
    this.cachedConfig = null;
    this.configLoadedAt = 0;
  }

  /**
   * Realiza una petición HTTP con reintentos automáticos, timeouts, manejo de 401 e historial en base de datos.
   */
  public static async request(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    endpoint: string,
    body: any = null,
    customHeaders: Record<string, string> = {},
    isAuthRequest = false
  ): Promise<any> {
    const config = await this.getConfig();
    const url = `${config.apiUrl}${endpoint}`;
    
    // Preparar headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Partner-Id': config.partnerId || '',
      ...config.headers,
      ...customHeaders
    };

    // Agregar token de autorización si no es la llamada de auth
    if (!isAuthRequest) {
      const token = await siigoTokenManager.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    let attempt = 0;
    const maxRetries = isAuthRequest ? 1 : config.maxRetries;
    const startTime = Date.now();

    while (attempt < maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

      try {
        const fetchOptions: RequestInit = {
          method,
          headers,
          signal: controller.signal
        };

        if (body) {
          fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        const response = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);

        const responseTime = Date.now() - startTime;
        let responseData: any = null;
        
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          responseData = await response.json();
        } else {
          responseData = await response.text();
        }

        // Registrar Log
        await IntegrationLogger.logRequest({
          erpName: 'SIIGO',
          endpoint: url,
          method,
          statusCode: response.status,
          responseTimeMs: responseTime,
          requestPayload: body,
          responsePayload: responseData,
          headers: { ...headers, Authorization: headers['Authorization'] ? 'Bearer [HIDDEN]' : undefined }
        });

        // Manejar Exclusiones y Reintentos
        if (response.ok) {
          return responseData;
        }

        // Manejar expiración de token en caliente (401)
        if (response.status === 401 && !isAuthRequest) {
          console.warn('SIIGO Token expirado o inválido (401). Refrescando...');
          // Forzar renovación
          await siigoTokenManager.refreshToken();
          const newToken = await siigoTokenManager.getToken();
          if (newToken) {
            headers['Authorization'] = `Bearer ${newToken}`;
          }
          // Resetear intento y reintentar de inmediato
          attempt = 0;
          continue;
        }

        // Si falló y no es reintentable de inmediato, lanzar error
        if (response.status >= 400 && response.status < 500) {
          throw ErpException.fromHttpCode(response.status, responseData?.message || responseData?.Message || `Error ${response.status}`, responseData);
        }

        // Si es error 5xx, se reintentará en el bucle
        throw ErpException.fromHttpCode(response.status, `Error de Servidor SIIGO ${response.status}`, responseData);

      } catch (err: any) {
        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;

        let exceptionMsg = err.message || String(err);
        let errorType: 'TIMEOUT' | 'NETWORK_ERROR' | 'SERVER_ERROR' = 'NETWORK_ERROR';

        if (err.name === 'AbortError') {
          exceptionMsg = `Timeout superado (${config.timeoutMs}ms)`;
          errorType = 'TIMEOUT';
        }

        // Guardar logs de errores críticos no capturados por HTTP
        if (attempt >= maxRetries) {
          await IntegrationLogger.logRequest({
            erpName: 'SIIGO',
            endpoint: url,
            method,
            exception: exceptionMsg,
            responseTimeMs: responseTime,
            requestPayload: body
          });

          if (errorType === 'TIMEOUT') {
            throw new ErpException(exceptionMsg, 'TIMEOUT');
          }
          if (err instanceof ErpException) {
            throw err;
          }
          throw new ErpException(exceptionMsg, 'NETWORK_ERROR');
        }

        // Esperar antes de reintentar
        console.warn(`Intento ${attempt} fallido para ${method} ${endpoint}: ${exceptionMsg}. Reintentando en ${config.retryDelayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, config.retryDelayMs));
      }
    }
  }
}
