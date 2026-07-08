// Definición de tipos de dominio comunes desacoplados de cualquier ERP

export interface ErpCustomer {
  id?: string;
  identification: string;
  type: 'Person' | 'Company';
  name: string[]; // [FirstName, LastName] o [CompanyName]
  email: string;
  phone?: string;
  address?: {
    address: string;
    cityCode?: string;
    cityName?: string;
  };
}

export interface ErpProduct {
  id?: string;
  code: string;
  name: string;
  description?: string;
  price: number;
  taxId?: number;
  stock?: number;
  unitOfMeasure?: string;
}

export interface ErpInvoiceItem {
  productCode: string;
  quantity: number;
  price: number;
  discount?: number;
  taxId?: number;
}

export interface ErpInvoice {
  id?: string;
  consecutive?: string;
  customerIdentification: string;
  date: string;
  items: ErpInvoiceItem[];
  paymentMethodCode: string;
  notes?: string;
  total?: number;
}

export interface ErpPayment {
  id?: string;
  consecutive?: string;
  customerIdentification: string;
  date: string;
  value: number;
  paymentMethodCode: string;
  invoiceConsecutive?: string;
}
