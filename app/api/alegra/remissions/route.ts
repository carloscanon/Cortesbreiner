import { NextResponse } from 'next/server';
import { AlegraClient } from '@/lib/alegra/client';
import { supabase } from '@/lib/supabase';

export const maxDuration = 45;

/**
 * Resolves or creates a Contact in Alegra based on identification/name/email.
 */
async function resolveAlegraContact(clientInput: any): Promise<number | string> {
  if (typeof clientInput === 'number' || (typeof clientInput === 'string' && /^\d+$/.test(clientInput))) {
    return Number(clientInput);
  }

  if (typeof clientInput === 'object') {
    if (clientInput.id) return Number(clientInput.id);

    const identification = String(clientInput.identification || clientInput.nit || '').trim();
    const fullName = String(clientInput.name || clientInput.clientName || 'CLIENTE MOSTRADOR').trim().toUpperCase();
    const email = String(clientInput.email || '').trim() || 'facturacion@febrainershop.com';
    const phone = String(clientInput.phone || clientInput.mobile || '').trim();

    if (identification && identification !== '222222222222') {
      try {
        const searchRes = await AlegraClient.request('GET', `/contacts?identification=${encodeURIComponent(identification)}`);
        if (searchRes.ok && Array.isArray(searchRes.data) && searchRes.data.length > 0) {
          return Number(searchRes.data[0].id);
        }
      } catch (eSearch) {}
    }

    if (fullName && fullName !== 'CLIENTE MOSTRADOR') {
      try {
        const searchRes = await AlegraClient.request('GET', `/contacts?query=${encodeURIComponent(fullName)}&limit=1`);
        if (searchRes.ok && Array.isArray(searchRes.data) && searchRes.data.length > 0) {
          return Number(searchRes.data[0].id);
        }
      } catch (eQuery) {}
    }

    const nameParts = fullName.split(' ').filter(Boolean);
    const firstName = nameParts[0] || 'CLIENTE';
    const lastName = nameParts.slice(1).join(' ') || 'GENERAL';

    const isNit = identification.length >= 9 && identification.includes('-');
    const docType = isNit ? 'NIT' : 'CC';
    const cleanDocNumber = identification || '222222222222';

    const newContactPayload: any = {
      name: fullName,
      nameObject: { firstName, lastName },
      identification: cleanDocNumber,
      identificationObject: { type: docType, number: cleanDocNumber },
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
    } catch (eCreate) {}

    if (cleanDocNumber) {
      try {
        const retrySearch = await AlegraClient.request('GET', `/contacts?identification=${encodeURIComponent(cleanDocNumber)}`);
        if (retrySearch.ok && Array.isArray(retrySearch.data) && retrySearch.data.length > 0) {
          return Number(retrySearch.data[0].id);
        }
      } catch (eRetry) {}
    }
  }

  return 22;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get('start') ? Number(searchParams.get('start')) : 0;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 30;

    const res = await AlegraClient.getRemissions({ start, limit });
    return NextResponse.json({
      success: res.ok,
      status: res.status,
      data: res.data,
      rawRequest: res.rawRequest
    }, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { remission } = body;

    if (!remission) {
      return NextResponse.json({
        success: false,
        error: 'El campo "remission" es obligatorio con la información de la remisión.'
      }, { status: 400 });
    }

    const sanitizedRemission = { ...remission };

    // Resolve client
    sanitizedRemission.client = await resolveAlegraContact(sanitizedRemission.client);

    // Ensure items format
    if (Array.isArray(sanitizedRemission.items)) {
      sanitizedRemission.items = sanitizedRemission.items.map((it: any) => ({
        id: Number(it.id || 17),
        name: it.name || 'Prenda POS',
        description: it.description || it.name || undefined,
        price: Number(it.price) || 0,
        quantity: Number(it.quantity) || 1
      }));
    } else {
      sanitizedRemission.items = [{
        id: 17,
        name: 'Prenda POS',
        price: Number(sanitizedRemission.total || 0),
        quantity: 1
      }];
    }

    if (!sanitizedRemission.date) {
      sanitizedRemission.date = new Date().toISOString().split('T')[0];
    }
    if (!sanitizedRemission.dueDate) {
      sanitizedRemission.dueDate = sanitizedRemission.date;
    }

    const createRes = await AlegraClient.createRemission(sanitizedRemission);

    if (!createRes.ok) {
      return NextResponse.json({
        success: false,
        status: createRes.status,
        error: createRes.data?.message || 'Error al crear la remisión en Alegra',
        details: createRes.data,
        rawRequest: createRes.rawRequest
      }, { status: createRes.status });
    }

    return NextResponse.json({
      success: true,
      status: 201,
      remission: createRes.data,
      rawRequest: createRes.rawRequest
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
  }
}
