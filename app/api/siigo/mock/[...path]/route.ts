import { NextResponse } from 'next/server';

// Datos temporales en memoria para simular la base de datos de SIIGO
const mockCustomers = [
  {
    id: "cust-01",
    person_type: "Person",
    id_type: "13",
    identification: "10101010",
    name: ["Carlos", "Breiner"],
    commercial_name: "Carlos Breiner",
    vat_responsible: false,
    address: { address: "Calle 45 #12-34", city: { country_code: "Co", state_code: "11", city_code: "11001" } },
    phones: [{ number: "3109998877" }],
    contacts: [{ first_name: "Carlos", last_name: "Breiner", email: "carlos@breiner.com" }]
  }
];

const mockProducts = [
  {
    id: "prod-01",
    code: "POLO-01",
    name: "Camisa Polo Tradicional",
    description: "Camisa Polo de algodón",
    account_group: 72,
    prices: [{ currency_code: "COP", price_list: [{ position: 1, value: 45000 }] }],
    stock: 120
  }
];

const mockInvoices = [
  {
    id: "inv-01",
    name: "FV-1-101",
    date: "2026-07-08",
    customer: { identification: "10101010" },
    items: [{ code: "POLO-01", quantity: 2, price: 45000 }],
    payments: [{ id: 5463, value: 90000 }],
    total: 90000
  }
];

export async function POST(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const resolvedParams = await params;
    const path = resolvedParams.path.join('/');
    const body = await req.json();

    console.log(`[SIIGO MOCK SERVER] POST /${path}`, body);

    if (path === 'auth') {
      if (!body.username || !body.access_key) {
        return NextResponse.json({ error: "username and access_key are required" }, { status: 400 });
      }
      return NextResponse.json({
        access_token: "mock-jwt-token-xyz-123456789",
        token_type: "Bearer",
        expires_in: 3600
      });
    }

    if (path === 'customers') {
      const newCustomer = {
        id: `cust-${Date.now()}`,
        ...body
      };
      mockCustomers.push(newCustomer);
      return NextResponse.json(newCustomer, { status: 201 });
    }

    if (path === 'products') {
      const newProduct = {
        id: `prod-${Date.now()}`,
        ...body
      };
      mockProducts.push(newProduct);
      return NextResponse.json(newProduct, { status: 201 });
    }

    if (path === 'invoices') {
      const newInvoice = {
        id: `inv-${Date.now()}`,
        name: `FV-1-${Math.floor(Math.random() * 9000) + 1000}`,
        ...body,
        total: (body.items || []).reduce((acc: number, curr: any) => acc + (curr.price * curr.quantity), 0)
      };
      mockInvoices.push(newInvoice);
      return NextResponse.json(newInvoice, { status: 201 });
    }

    if (path === 'vouchers') {
      return NextResponse.json({
        id: `vouch-${Date.now()}`,
        name: `RC-1-${Math.floor(Math.random() * 9000) + 1000}`,
        ...body
      }, { status: 201 });
    }

    return NextResponse.json({ error: `Mock endpoint POST /${path} not found` }, { status: 404 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const resolvedParams = await params;
    const path = resolvedParams.path.join('/');
    const { searchParams } = new URL(req.url);

    console.log(`[SIIGO MOCK SERVER] GET /${path}`);

    if (path === 'document-types') {
      return NextResponse.json([
        { id: 24446, code: "FV-1", name: "Factura de Venta POS", type: "FV" },
        { id: 38472, code: "RC-1", name: "Recibo de Caja Principal", type: "RC" }
      ]);
    }

    if (path === 'customers') {
      const ident = searchParams.get('identification');
      if (ident) {
        const found = mockCustomers.filter(c => c.identification === ident);
        return NextResponse.json({ results: found });
      }
      return NextResponse.json({ results: mockCustomers });
    }

    if (path === 'products') {
      const code = searchParams.get('code');
      if (code) {
        const found = mockProducts.filter(p => p.code === code);
        return NextResponse.json({ results: found });
      }
      return NextResponse.json({ results: mockProducts });
    }

    if (path.startsWith('invoices/')) {
      const id = path.split('/')[1];
      const invoice = mockInvoices.find(i => i.id === id || i.name === id);
      if (invoice) {
        return NextResponse.json(invoice);
      }
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (path === 'invoices') {
      return NextResponse.json({ results: mockInvoices });
    }

    return NextResponse.json({ error: `Mock endpoint GET /${path} not found` }, { status: 404 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
