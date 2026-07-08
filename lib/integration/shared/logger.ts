import { supabase } from '../../supabase';

export interface LogParams {
  erpName: string;
  endpoint: string;
  method: string;
  statusCode?: number;
  responseTimeMs?: number;
  requestPayload?: any;
  responsePayload?: any;
  headers?: any;
  exception?: string;
}

export interface AuditParams {
  username?: string;
  action: string;
  ipAddress?: string;
  details?: string;
}

export class IntegrationLogger {
  /**
   * Logs an API request/response interaction into the database
   */
  static async logRequest(params: LogParams): Promise<void> {
    try {
      console.log(`[Integration Log] ${params.method} ${params.endpoint} - Status: ${params.statusCode || 'N/A'}`);
      
      const { error } = await supabase.from('erp_logs').insert([
        {
          erp_name: params.erpName,
          endpoint: params.endpoint,
          method: params.method,
          status_code: params.statusCode,
          response_time_ms: params.responseTimeMs,
          request_payload: params.requestPayload ? JSON.parse(JSON.stringify(params.requestPayload)) : null,
          response_payload: params.responsePayload ? JSON.parse(JSON.stringify(params.responsePayload)) : null,
          headers: params.headers ? JSON.parse(JSON.stringify(params.headers)) : null,
          exception: params.exception
        }
      ]);
      
      if (error) {
        console.error('Error guardando erp_log:', error);
      }
    } catch (e) {
      console.error('Fallo crítico al registrar erp_log:', e);
    }
  }

  /**
   * Logs an administrative action into the audit table
   */
  static async logAudit(params: AuditParams): Promise<void> {
    try {
      console.log(`[Audit Log] ${params.action} - Details: ${params.details || 'None'}`);
      
      const { error } = await supabase.from('erp_audit').insert([
        {
          username: params.username || 'System/API',
          action: params.action,
          ip_address: params.ipAddress || '127.0.0.1',
          details: params.details
        }
      ]);

      if (error) {
        console.error('Error guardando erp_audit:', error);
      }
    } catch (e) {
      console.error('Fallo crítico al registrar erp_audit:', e);
    }
  }
}
