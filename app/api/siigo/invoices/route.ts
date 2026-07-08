import { NextResponse } from 'next/server';
import { SiigoClient } from '../../../../lib/integration/siigo/client';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dateStart = searchParams.get('created_start') || '';
    const dateEnd = searchParams.get('created_end') || '';
    const customerId = searchParams.get('customer_identification') || '';
    const page = searchParams.get('page') || '1';

    let queryStr = `?page=${page}`;
    if (dateStart) queryStr += `&created_start=${dateStart}`;
    if (dateEnd) queryStr += `&created_end=${dateEnd}`;
    if (customerId) queryStr += `&customer_identification=${customerId}`;

    console.log(`[SIIGO API] Consultando facturas: GET /invoices${queryStr}`);
    
    // Consumimos directamente la API oficial de SIIGO
    const data = await SiigoClient.request('GET', `/invoices${queryStr}`);
    
    const results = data?.results || [];

    if (results.length > 0) {
      // 1. Extraer identificaciones únicas de clientes
      const uniqueIdents = Array.from(
        new Set(
          results
            .map((inv: any) => inv.customer?.identification)
            .filter(Boolean)
        )
      ) as string[];

      // 2. Consultar el nombre de cada cliente en paralelo
      const customerNameMap: Record<string, string[]> = {};
      
      await Promise.all(
        uniqueIdents.map(async (ident) => {
          try {
            const customerData = await SiigoClient.request('GET', `/customers?identification=${ident}`);
            const customerArray = customerData?.results || customerData;
            if (Array.isArray(customerArray) && customerArray.length > 0) {
              const cust = customerArray[0];
              customerNameMap[ident] = cust.name || [cust.commercial_name || 'Sin Nombre'];
            }
          } catch (err) {
            console.error(`No se pudo resolver el nombre para el cliente ${ident}:`, err);
          }
        })
      );

      // 3. Inyectar los nombres resueltos en la lista de facturas
      results.forEach((inv: any) => {
        if (inv.customer && inv.customer.identification) {
          inv.customer.name = customerNameMap[inv.customer.identification] || ['Cliente SIIGO'];
        }
      });
    }

    return NextResponse.json(data);
  } catch (e: any) {
    console.error('Error al obtener facturas desde SIIGO:', e);
    return NextResponse.json({ 
      error: e.message || String(e),
      details: e.details || null
    }, { status: e.statusCode || 500 });
  }
}
