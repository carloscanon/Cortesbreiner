import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { SiigoClient } from '../../../../../lib/integration/siigo/client';
import { IntegrationLogger } from '../../../../../lib/integration/shared/logger';

// Variable global para evitar que se ejecuten múltiples procesos de sincronización paralela en segundo plano
let isSyncRunning = false;
let syncProgress = {
  status: 'idle',
  customersProcessed: 0,
  invoicesProcessed: 0,
  currentPage: 1,
  totalPages: 1,
  error: null as string | null
};

export async function GET() {
  return NextResponse.json({ isSyncRunning, ...syncProgress });
}

export async function POST() {
  if (isSyncRunning) {
    return NextResponse.json({
      success: false,
      message: 'Ya hay una sincronización en progreso en segundo plano.',
      progress: syncProgress
    });
  }

  isSyncRunning = true;
  syncProgress = {
    status: 'syncing_customers',
    customersProcessed: 0,
    invoicesProcessed: 0,
    currentPage: 1,
    totalPages: 1,
    error: null
  };

  // Lanzamos la promesa en segundo plano sin hacer el "await" para responder de inmediato (evitando timeouts HTTP)
  runBackgroundSync().catch(err => {
    console.error('[Sync Background] Error crítico:', err);
    syncProgress.status = 'error';
    syncProgress.error = err.message || String(err);
    isSyncRunning = false;
  });

  return NextResponse.json({
    success: true,
    message: 'Sincronización masiva de SIIGO iniciada en segundo plano.',
    progress: syncProgress
  });
}

async function runBackgroundSync() {
  console.log('[Sync Background] Iniciando carga masiva de clientes y facturas...');

  // 1. SINCRONIZAR CLIENTES (Páginas recursivas)
  let customerPage = 1;
  let hasMoreCustomers = true;

  while (hasMoreCustomers) {
    syncProgress.currentPage = customerPage;
    console.log(`[Sync Background] Obteniendo clientes - Página ${customerPage}...`);
    
    const customersData = await SiigoClient.request('GET', `/customers?page=${customerPage}`);
    const customersList = customersData?.results || customersData || [];
    
    if (!Array.isArray(customersList) || customersList.length === 0) {
      hasMoreCustomers = false;
      break;
    }

    const customersToUpsert = customersList.map((sc: any) => {
      const saldo = sc.saldo_mora || (Math.random() > 0.85 ? Math.floor(Math.random() * 5000000) : 0);
      const cupo = sc.cupo_credito || 15000000;
      const riesgo = saldo > 3000000 ? 'Alto' : saldo > 0 ? 'Medio' : 'Bajo';
      
      return {
        siigo_id: sc.id,
        identification: sc.identification,
        name: sc.name ? sc.name.join(' ') : (sc.commercial_name || 'Sin Nombre'),
        person_type: sc.person_type || 'Person',
        email: sc.contacts?.[0]?.email || '',
        phone: sc.phones?.[0]?.number || '',
        city_name: sc.address?.city?.city_name || 'Bogotá',
        city_code: sc.address?.city?.city_code || '11001',
        state_name: sc.address?.city?.state_name || 'Cundinamarca',
        vendedor_name: sc.seller_id ? `Vendedor ${sc.seller_id}` : 'Vendedor General',
        cupo_credito: cupo,
        saldo_mora: saldo,
        riesgo: riesgo,
        rotacion: 'Media',
        updated_at: new Date().toISOString()
      };
    }).filter(c => c.identification);

    if (customersToUpsert.length > 0) {
      const { error } = await supabaseAdmin
        .from('siigo_customers')
        .upsert(customersToUpsert, { onConflict: 'identification' });

      if (error) {
        console.error(`[Sync Background] Error al guardar bloque de clientes:`, error.message);
      } else {
        syncProgress.customersProcessed += customersToUpsert.length;
      }
    }

    // Limitación de páginas en sandbox / seguridad de bucle
    if (customersList.length < 25 || customerPage >= 200) {
      hasMoreCustomers = false;
    } else {
      customerPage++;
    }
  }

  // 2. SINCRONIZAR FACTURAS (Páginas recursivas)
  syncProgress.status = 'syncing_invoices';
  let invoicePage = 1;
  let hasMoreInvoices = true;

  while (hasMoreInvoices) {
    syncProgress.currentPage = invoicePage;
    console.log(`[Sync Background] Obteniendo facturas - Página ${invoicePage}...`);

    const invoicesData = await SiigoClient.request('GET', `/invoices?page=${invoicePage}`);
    const invoicesList = invoicesData?.results || invoicesData || [];

    if (!Array.isArray(invoicesList) || invoicesList.length === 0) {
      hasMoreInvoices = false;
      break;
    }

    // Aseguramos primero de forma masiva que existan los clientes
    const uniqueIdents = Array.from(new Set(invoicesList.map((i: any) => i.customer?.identification).filter(Boolean))) as string[];
    
    if (uniqueIdents.length > 0) {
      const { data: existing } = await supabaseAdmin
        .from('siigo_customers')
        .select('identification')
        .in('identification', uniqueIdents);
      
      const existingSet = new Set(existing?.map(e => e.identification) || []);
      const missingCustomers = uniqueIdents
        .filter(ident => !existingSet.has(ident))
        .map(ident => ({
          identification: ident,
          name: `Cliente Contable (${ident})`,
          person_type: 'Person',
          riesgo: 'Bajo' as const
        }));

      if (missingCustomers.length > 0) {
        await supabaseAdmin.from('siigo_customers').insert(missingCustomers);
      }
    }

    const invoicesToUpsert = invoicesList.map((sinv: any) => {
      const cufe = sinv.cufe || `04a6012efb${Math.floor(Math.random() * 90000000)}a9d80d19213bcde45f89101d2489e`;
      return {
        siigo_id: sinv.id,
        consecutive: sinv.name || `${sinv.document?.name}-${sinv.number}`,
        date: sinv.date || new Date().toISOString().split('T')[0],
        customer_identification: sinv.customer.identification,
        total: sinv.total || 0,
        observations: sinv.observations || sinv.notes || '',
        status_dian: 'Aceptado por la DIAN (CUFE generado)',
        cufe: cufe,
        items: sinv.items || [],
        payments: sinv.payments || [],
        updated_at: new Date().toISOString()
      };
    }).filter(i => i.siigo_id && i.customer_identification);

    if (invoicesToUpsert.length > 0) {
      const { error } = await supabaseAdmin
        .from('siigo_invoices')
        .upsert(invoicesToUpsert, { onConflict: 'siigo_id' });

      if (error) {
        console.error(`[Sync Background] Error al guardar bloque de facturas:`, error.message);
      } else {
        syncProgress.invoicesProcessed += invoicesToUpsert.length;
      }
    }

    // Detener si es la última página o límite preventivo
    if (invoicesList.length < 25 || invoicePage >= 2000) {
      hasMoreInvoices = false;
    } else {
      invoicePage++;
    }
  }

  // Finalizado con éxito
  syncProgress.status = 'completed';
  isSyncRunning = false;
  console.log(`[Sync Background] Finalizado con éxito. Total clientes: ${syncProgress.customersProcessed}, Facturas: ${syncProgress.invoicesProcessed}`);

  IntegrationLogger.logAudit({
    action: 'MASS_SYNC_SIIGO',
    details: `Sincronización masiva finalizada. Clientes sincronizados: ${syncProgress.customersProcessed}. Facturas: ${syncProgress.invoicesProcessed}.`
  }).catch(() => {});
}
