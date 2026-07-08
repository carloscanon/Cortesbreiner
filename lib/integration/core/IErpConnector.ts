import { ErpCustomer, ErpProduct, ErpInvoice, ErpPayment } from './types';

/**
 * Interfaz genérica que define el contrato de cualquier conector ERP.
 * Permite cambiar el conector de SIIGO a SAP, Odoo, etc., sin modificar el núcleo de la app.
 */
export interface IErpConnector {
  // Conectividad & Autenticación
  testConnection(): Promise<{ success: boolean; message: string }>;
  
  // Clientes
  getCustomer(identification: string): Promise<ErpCustomer | null>;
  createCustomer(customer: ErpCustomer): Promise<ErpCustomer>;
  
  // Productos
  getProduct(code: string): Promise<ErpProduct | null>;
  createProduct(product: ErpProduct): Promise<ErpProduct>;
  
  // Facturas / Órdenes
  createInvoice(invoice: ErpInvoice): Promise<ErpInvoice>;
  getInvoice(consecutive: string): Promise<ErpInvoice | null>;

  // Comprobantes de Pago / Recibos de Caja
  createPayment(payment: ErpPayment): Promise<ErpPayment>;
}
