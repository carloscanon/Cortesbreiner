import { ErpCustomer, ErpProduct, ErpInvoice, ErpPayment } from '../core/types';

export class SiigoMapper {
  /**
   * Mapea un ErpCustomer del Core al payload requerido por SIIGO
   */
  public static toSiigoCustomer(customer: ErpCustomer): any {
    const isCompany = customer.type === 'Company';
    return {
      person_type: customer.type,
      id_type: isCompany ? '31' : '13', // 31 = NIT, 13 = Cédula
      identification: customer.identification,
      name: customer.name,
      commercial_name: customer.name.join(' '),
      vat_responsible: isCompany,
      fiscal_responsibilities: [{ code: isCompany ? 'R-99-PN' : 'R-99-PN' }],
      address: {
        address: customer.address?.address || 'Sin Dirección',
        city: {
          country_code: 'Co',
          state_code: customer.address?.cityCode?.substring(0, 2) || '11',
          city_code: customer.address?.cityCode || '11001'
        }
      },
      phones: customer.phone ? [{ number: customer.phone }] : [],
      contacts: [
        {
          first_name: customer.name[0] || 'Contacto',
          last_name: customer.name[1] || 'S/N',
          email: customer.email
        }
      ]
    };
  }

  /**
   * Mapea la respuesta de SIIGO a un ErpCustomer del Core
   */
  public static toCoreCustomer(siigoCustomer: any): ErpCustomer {
    return {
      id: siigoCustomer.id,
      identification: siigoCustomer.identification,
      type: siigoCustomer.person_type === 'Company' ? 'Company' : 'Person',
      name: siigoCustomer.name || [siigoCustomer.commercial_name || ''],
      email: siigoCustomer.contacts?.[0]?.email || '',
      phone: siigoCustomer.phones?.[0]?.number,
      address: {
        address: siigoCustomer.address?.address || '',
        cityCode: siigoCustomer.address?.city?.city_code,
        cityName: siigoCustomer.address?.city?.city_name
      }
    };
  }

  /**
   * Mapea un ErpProduct del Core a SIIGO
   */
  public static toSiigoProduct(product: ErpProduct): any {
    return {
      code: product.code,
      name: product.name,
      description: product.description || product.name,
      account_group: 72, // Código contable por defecto
      tax_classification: 'Taxed',
      tax_included: false,
      prices: [
        {
          currency_code: 'COP',
          price_list: [
            {
              position: 1,
              value: product.price
            }
          ]
        }
      ]
    };
  }

  /**
   * Mapea producto de SIIGO a Core
   */
  public static toCoreProduct(siigoProd: any): ErpProduct {
    const priceObj = siigoProd.prices?.[0]?.price_list?.[0];
    return {
      id: siigoProd.id,
      code: siigoProd.code,
      name: siigoProd.name,
      description: siigoProd.description,
      price: priceObj ? priceObj.value : 0,
      stock: siigoProd.stock || 0
    };
  }

  /**
   * Mapea un ErpInvoice del Core a SIIGO
   */
  public static toSiigoInvoice(invoice: ErpInvoice): any {
    return {
      document: {
        id: 24446 // Comprobante por defecto en Siigo (Ej: Factura)
      },
      date: invoice.date,
      customer: {
        identification: invoice.customerIdentification,
        branch_office: 0
      },
      seller: 1234, // ID de vendedor por defecto
      items: invoice.items.map(item => ({
        code: item.productCode,
        quantity: item.quantity,
        price: item.price,
        description: 'Item de factura',
        tax: item.taxId ? { id: item.taxId } : undefined
      })),
      payments: [
        {
          id: Number(invoice.paymentMethodCode) || 5463, // ID medio de pago
          value: invoice.total || invoice.items.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0)
        }
      ],
      observations: invoice.notes || ''
    };
  }

  /**
   * Mapea factura de SIIGO a Core
   */
  public static toCoreInvoice(siigoInvoice: any): ErpInvoice {
    return {
      id: siigoInvoice.id,
      consecutive: siigoInvoice.name || siigoInvoice.number?.toString(),
      customerIdentification: siigoInvoice.customer?.identification,
      date: siigoInvoice.date,
      items: (siigoInvoice.items || []).map((it: any) => ({
        productCode: it.code,
        quantity: it.quantity,
        price: it.price,
        taxId: it.tax?.id
      })),
      paymentMethodCode: siigoInvoice.payments?.[0]?.id?.toString() || '',
      notes: siigoInvoice.observations,
      total: siigoInvoice.total
    };
  }

  /**
   * Mapea un ErpPayment a SIIGO (Comprobante / Recibo de Caja)
   */
  public static toSiigoPayment(payment: ErpPayment): any {
    return {
      document: {
        id: 38472 // Comprobante de Recibo de Caja
      },
      date: payment.date,
      customer: {
        identification: payment.customerIdentification
      },
      items: [
        {
          document: {
            consecutive: payment.invoiceConsecutive
          },
          value: payment.value
        }
      ],
      payments: [
        {
          id: Number(payment.paymentMethodCode) || 5463,
          value: payment.value
        }
      ]
    };
  }
}
