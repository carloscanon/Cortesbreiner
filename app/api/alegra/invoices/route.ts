import { NextResponse } from 'next/server';
import { AlegraClient } from '@/lib/alegra/client';

export const maxDuration = 45;

/**
 * Resolves or creates a Contact in Alegra based on identification/name/email.
 */
async function resolveAlegraContact(clientInput: any): Promise<number | string> {
  // If already an ID number or string ID
  if (typeof clientInput === 'number' || (typeof clientInput === 'string' && /^\d+$/.test(clientInput))) {
    return Number(clientInput);
  }

  if (typeof clientInput === 'object') {
    if (clientInput.id) {
      return Number(clientInput.id);
    }

    const identification = String(clientInput.identification || clientInput.nit || '').trim();
    const fullName = String(clientInput.name || clientInput.clientName || 'CLIENTE MOSTRADOR').trim().toUpperCase();
    const email = String(clientInput.email || '').trim() || 'facturacion@febrainershop.com';
    const phone = String(clientInput.phone || clientInput.mobile || '').trim();

    // 1. Search existing contact by identification
    if (identification && identification !== '222222222222') {
      try {
        const searchRes = await AlegraClient.request('GET', `/contacts?identification=${encodeURIComponent(identification)}`);
        if (searchRes.ok && Array.isArray(searchRes.data) && searchRes.data.length > 0) {
          return Number(searchRes.data[0].id);
        }
      } catch (eSearch) {
        console.warn('Error searching contact by identification:', eSearch);
      }
    }

    // 2. Search existing contact by query
    if (fullName && fullName !== 'CLIENTE MOSTRADOR') {
      try {
        const searchRes = await AlegraClient.request('GET', `/contacts?query=${encodeURIComponent(fullName)}&limit=1`);
        if (searchRes.ok && Array.isArray(searchRes.data) && searchRes.data.length > 0) {
          return Number(searchRes.data[0].id);
        }
      } catch (eQuery) {
        console.warn('Error searching contact by query:', eQuery);
      }
    }

    // 3. Create new Contact in Alegra
    // Split full name into firstName and lastName for nameObject
    const nameParts = fullName.split(' ').filter(Boolean);
    const firstName = nameParts[0] || 'CLIENTE';
    const lastName = nameParts.slice(1).join(' ') || 'GENERAL';

    const isNit = identification.length >= 9 && identification.includes('-');
    const docType = isNit ? 'NIT' : 'CC';
    const cleanDocNumber = identification || '222222222222';

    const newContactPayload: any = {
      name: fullName,
      nameObject: {
        firstName,
        lastName
      },
      identification: cleanDocNumber,
      identificationObject: {
        type: docType,
        number: cleanDocNumber
      },
      email: email || 'cliente@febrainershop.com',
      type: ['client'],
      kindOfPerson: isNit ? 'LEGAL_ENTITY' : 'PERSON_ENTITY',
      regime: isNit ? 'COMMON_REGIME' : 'SIMPLIFIED_REGIME'
    };
    if (phone) newContactPayload.mobile = phone;

    try {
      const createContactRes = await AlegraClient.createContact(newContactPayload);
      if (createContactRes.ok && createContactRes.data?.id) {
        return Number(createContactRes.data.id);
      }
      console.warn('Create contact warning:', createContactRes.data);
    } catch (eCreate) {
      console.error('Error creating contact in Alegra:', eCreate);
    }

    // If creation failed with already exists or duplicate, search again
    if (cleanDocNumber) {
      try {
        const retrySearch = await AlegraClient.request('GET', `/contacts?identification=${encodeURIComponent(cleanDocNumber)}`);
        if (retrySearch.ok && Array.isArray(retrySearch.data) && retrySearch.data.length > 0) {
          return Number(retrySearch.data[0].id);
        }
      } catch (eRetry) {}
    }
  }

  // Fallback contact ID if impossible to create
  return 22;
}

/**
 * Resolves item list to ensure valid registered Alegra item IDs, prices and units.
 * Desglosa el IVA para que el precio ingresado sea el total exacto pagado en la compra (IVA incluido).
 */
async function resolveAlegraItems(rawItems: any[]): Promise<any[]> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    // Default fallback item: total $35,000 COP IVA incluido -> base $29,411.76 + IVA 19% ($5,588.24) = $35,000
    return [{
      id: 17,
      price: 29411.76,
      quantity: 1,
      unit: 'unit',
      tax: [{ id: 4 }]
    }];
  }

  return rawItems.map(item => {
    const itemId = item.id || 17; // fallback to 17 (TOP) if unmapped
    const rawTotalPrice = Number(item.price) || 0;
    const quantity = Number(item.quantity) || 1;
    const description = item.description || item.name || undefined;

    // Si el ítem ya viene con IVA especificado y queremos que NO sume IVA extra
    // desglosamos la base gravable: base = totalPrice / 1.19
    const hasIva19 = !item.tax || (Array.isArray(item.tax) && item.tax.some((t: any) => t.id === 4 || t.id === '4' || t.name === 'IVA'));
    
    let basePrice = rawTotalPrice;
    if (hasIva19 && rawTotalPrice > 0) {
      basePrice = Math.round((rawTotalPrice / 1.19) * 100) / 100;
    }

    const formattedItem: any = {
      id: Number(itemId),
      price: basePrice,
      quantity,
      unit: 'unit'
    };

    if (description) formattedItem.description = description;
    if (item.discount) formattedItem.discount = Number(item.discount);

    if (hasIva19) {
      formattedItem.tax = [{ id: 4 }];
    } else if (item.tax) {
      formattedItem.tax = item.tax;
    }

    return formattedItem;
  });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start') ? Number(searchParams.get('start')) : 0;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 30;
    const order_direction = (searchParams.get('order_direction') as 'ASC' | 'DESC') || 'DESC';

    const res = await AlegraClient.getInvoices({ start, limit, order_direction, metadata: true });

    return NextResponse.json({
      success: res.ok,
      status: res.status,
      data: res.data,
      rawRequest: res.rawRequest
    }, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || String(error)
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { invoice, autoStamp = true } = body;

    if (!invoice) {
      return NextResponse.json({
        success: false,
        error: 'El campo "invoice" es obligatorio con la información de la factura.'
      }, { status: 400 });
    }

    // 1. Prepare & sanitize invoice payload
    const sanitizedInvoice = { ...invoice };

    // Resolve client ID automatically
    try {
      sanitizedInvoice.client = await resolveAlegraContact(sanitizedInvoice.client);
    } catch (eClient: any) {
      console.warn('Error resolving Alegra contact:', eClient.message);
    }

    // Resolve items with IVA desglose
    sanitizedInvoice.items = await resolveAlegraItems(sanitizedInvoice.items);

    // Set defaults for electronic invoice
    if (!sanitizedInvoice.date) {
      sanitizedInvoice.date = new Date().toISOString().split('T')[0];
    }
    if (!sanitizedInvoice.dueDate) {
      sanitizedInvoice.dueDate = sanitizedInvoice.date;
    }
    if (!sanitizedInvoice.paymentForm) {
      sanitizedInvoice.paymentForm = 'CASH';
    }
    if (!sanitizedInvoice.paymentMethod) {
      sanitizedInvoice.paymentMethod = 'CASH';
    }

    // 2. Create Invoice in Alegra
    const createRes = await AlegraClient.createInvoice(sanitizedInvoice);

    if (!createRes.ok) {
      return NextResponse.json({
        success: false,
        status: createRes.status,
        error: createRes.data?.message || 'Error al crear la factura en Alegra',
        details: createRes.data,
        rawRequest: createRes.rawRequest
      }, { status: createRes.status });
    }

    const createdInvoice = createRes.data;
    let stampRes: any = null;

    // 3. Auto-Stamp with DIAN if requested
    if (autoStamp && createdInvoice?.id) {
      try {
        stampRes = await AlegraClient.stampInvoice(createdInvoice.id);
      } catch (eStamp: any) {
        stampRes = { ok: false, error: eStamp.message || String(eStamp) };
      }
    }

    return NextResponse.json({
      success: true,
      status: 201,
      invoice: createdInvoice,
      stamp: stampRes?.data || stampRes,
      rawRequest: createRes.rawRequest,
      stampRawRequest: stampRes?.rawRequest
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || String(error)
    }, { status: 500 });
  }
}
