import { IErpConnector } from '../core/IErpConnector';
import { ErpCustomer, ErpProduct, ErpInvoice, ErpPayment } from '../core/types';
import { SiigoClient } from './client';
import { SiigoMapper } from './mapper';
import { ErpException } from '../core/errors';

export class SiigoConnector implements IErpConnector {
  
  public async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // Test requesting metadata or active session validation by getting a dummy product or listing documents
      // An easy test is asking for documents config (GET /document-types)
      const data = await SiigoClient.request('GET', '/document-types?type=FV');
      if (data) {
        return { success: true, message: 'Conectado exitosamente con la API de SIIGO.' };
      }
      return { success: false, message: 'No se recibieron datos de la API de SIIGO.' };
    } catch (e: any) {
      return { success: false, message: e.message || String(e) };
    }
  }

  public async getCustomer(identification: string): Promise<ErpCustomer | null> {
    try {
      const data = await SiigoClient.request('GET', `/customers?identification=${identification}`);
      // Customers lists can return an array or single item depending on pagination
      const customerArray = data?.results || data;
      if (Array.isArray(customerArray) && customerArray.length > 0) {
        return SiigoMapper.toCoreCustomer(customerArray[0]);
      }
      return null;
    } catch (e: any) {
      if (e instanceof ErpException && e.code === 'NOT_FOUND') {
        return null;
      }
      throw e;
    }
  }

  public async createCustomer(customer: ErpCustomer): Promise<ErpCustomer> {
    const payload = SiigoMapper.toSiigoCustomer(customer);
    const data = await SiigoClient.request('POST', '/customers', payload);
    return SiigoMapper.toCoreCustomer(data);
  }

  public async getProduct(code: string): Promise<ErpProduct | null> {
    try {
      const data = await SiigoClient.request('GET', `/products?code=${code}`);
      const productArray = data?.results || data;
      if (Array.isArray(productArray) && productArray.length > 0) {
        return SiigoMapper.toCoreProduct(productArray[0]);
      }
      return null;
    } catch (e: any) {
      if (e instanceof ErpException && e.code === 'NOT_FOUND') {
        return null;
      }
      throw e;
    }
  }

  public async createProduct(product: ErpProduct): Promise<ErpProduct> {
    const payload = SiigoMapper.toSiigoProduct(product);
    const data = await SiigoClient.request('POST', '/products', payload);
    return SiigoMapper.toCoreProduct(data);
  }

  public async createInvoice(invoice: ErpInvoice): Promise<ErpInvoice> {
    const payload = SiigoMapper.toSiigoInvoice(invoice);
    const data = await SiigoClient.request('POST', '/invoices', payload);
    return SiigoMapper.toCoreInvoice(data);
  }

  public async getInvoice(consecutive: string): Promise<ErpInvoice | null> {
    try {
      const data = await SiigoClient.request('GET', `/invoices/${consecutive}`);
      if (data) {
        return SiigoMapper.toCoreInvoice(data);
      }
      return null;
    } catch (e: any) {
      if (e instanceof ErpException && e.code === 'NOT_FOUND') {
        return null;
      }
      throw e;
    }
  }

  public async createPayment(payment: ErpPayment): Promise<ErpPayment> {
    const payload = SiigoMapper.toSiigoPayment(payment);
    const data = await SiigoClient.request('POST', '/vouchers', payload);
    return {
      id: data.id,
      consecutive: data.name || data.number?.toString(),
      customerIdentification: payment.customerIdentification,
      date: payment.date,
      value: payment.value,
      paymentMethodCode: payment.paymentMethodCode,
      invoiceConsecutive: payment.invoiceConsecutive
    };
  }
}
