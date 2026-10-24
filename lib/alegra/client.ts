/**
 * Alegra API Client
 * Official Integration for Alegra Colombia Electronic Invoicing
 */

export const ALEGRA_CONFIG = {
  baseUrl: 'https://api.alegra.com/api/v1',
  user: process.env.ALEGRA_USER || 'febrainershop@gmail.com',
  token: process.env.ALEGRA_TOKEN || 'cd0f190db68b61f7db93',
};

export class AlegraClient {
  private static getAuthHeader(): string {
    const credentials = `${ALEGRA_CONFIG.user}:${ALEGRA_CONFIG.token}`;
    const base64 = typeof Buffer !== 'undefined' 
      ? Buffer.from(credentials).toString('base64')
      : btoa(credentials);
    return `Basic ${base64}`;
  }

  static async request(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: any,
    customHeaders: Record<string, string> = {}
  ): Promise<{ data: any; status: number; ok: boolean; rawRequest?: any }> {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${ALEGRA_CONFIG.baseUrl}${cleanEndpoint}`;

    const headers: Record<string, string> = {
      'Authorization': this.getAuthHeader(),
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);
    let data: any = null;
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { rawText: text };
    }

    return {
      data,
      status: res.status,
      ok: res.ok,
      rawRequest: {
        url,
        method,
        headers: { ...headers, Authorization: 'Basic [OCULTO]' },
        body
      }
    };
  }

  // Get Company Info
  static async getCompany() {
    return this.request('GET', '/company');
  }

  // Get Invoices list
  static async getInvoices(params: { start?: number; limit?: number; order_direction?: 'ASC' | 'DESC'; metadata?: boolean } = {}) {
    const qs = new URLSearchParams();
    if (params.start !== undefined) qs.set('start', String(params.start));
    if (params.limit !== undefined) qs.set('limit', String(params.limit || 30));
    if (params.order_direction) qs.set('order_direction', params.order_direction);
    if (params.metadata) qs.set('metadata', 'true');
    return this.request('GET', `/invoices?${qs.toString()}`);
  }

  // Get Single Invoice by ID
  static async getInvoice(id: string | number) {
    return this.request('GET', `/invoices/${id}`);
  }

  // Create Invoice in Alegra
  static async createInvoice(invoicePayload: any) {
    return this.request('POST', '/invoices', invoicePayload);
  }

  // Stamp Electronic Invoice (DIAN)
  static async stampInvoice(id: string | number) {
    return this.request('POST', `/invoices/${id}/stamp`);
  }

  // Get Contacts / Clients
  static async getContacts(params: { type?: 'client' | 'provider'; query?: string; limit?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.type) qs.set('type', params.type);
    if (params.query) qs.set('query', params.query);
    if (params.limit) qs.set('limit', String(params.limit));
    return this.request('GET', `/contacts?${qs.toString()}`);
  }

  // Create Contact
  static async createContact(contactPayload: any) {
    return this.request('POST', '/contacts', contactPayload);
  }

  // Get Items / Products
  static async getItems(params: { query?: string; limit?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.query) qs.set('query', params.query);
    if (params.limit) qs.set('limit', String(params.limit));
    return this.request('GET', `/items?${qs.toString()}`);
  }

  // Get Numbering Templates (Resoluciones)
  static async getNumberTemplates() {
    return this.request('GET', '/number-templates');
  }
}
