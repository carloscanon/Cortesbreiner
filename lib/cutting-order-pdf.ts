import bwipjs from 'bwip-js';

export interface CuttingOrderPDFData {
  internal_code: string;
  client_name?: string;
  brand?: string;
  scheduled_date?: string;
  cortador_name?: string;
  status?: string;
  priority?: string;
  largo_trazo?: number;
  capas_proyectadas?: number;
  total_kilos_proyectados?: number;
  observaciones?: string;
  created_at?: string;
  created_by?: string;
  fabrics?: Array<{
    nombre_tela?: string;
    nombre_color?: string;
    layers?: number;
    metros?: number;
    kilos?: number;
  }>;
  sizes?: Array<{
    talla: string;
    quantity: number;
  }>;
  categories?: Array<{
    nombre: string;
    cuts: number;
    units: number;
  }>;
  items?: Array<{
    referencia?: string;
    categoria?: string;
    tela?: string;
    talla?: string;
    capas?: number;
    marcacion?: string | number;
    total?: number;
  }>;
}

/**
 * Generates a clean barcode image as a Data URL for inclusion in the PDF/print window.
 */
export async function generateBarcodeDataUrl(text: string): Promise<string> {
  if (!text) return '';
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas');
      bwipjs.toCanvas(canvas, {
        bcid: 'code128',
        text: text.toUpperCase().replace(/[^0-9A-Z\-\. ]/g, ''),
        scale: 3,
        height: 12,
        includetext: false,
        paddingleft: 4,
        paddingright: 4,
        backgroundcolor: 'ffffff',
        barcolor: '000000',
      });
      resolve(canvas.toDataURL('image/png'));
    } catch (e) {
      console.error('Error generating barcode for PDF:', e);
      resolve('');
    }
  });
}

/**
 * Trigger clean PDF download / print dialog formatted specifically as a Cutting Order invoice voucher.
 */
export async function downloadCuttingOrderPDF(data: CuttingOrderPDFData) {
  const code = data.internal_code || 'S-N';
  const barcodeUrl = await generateBarcodeDataUrl(`OC-${code}`);

  const totalUnits = data.items?.reduce((acc, item) => acc + (item.total || 0), 0)
    || data.sizes?.reduce((acc, s) => acc + (s.quantity || 0), 0)
    || 0;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Orden de Corte OC-${code}</title>
      <style>
        @page {
          size: letter;
          margin: 12mm 15mm;
        }
        * {
          box-sizing: border-box;
          font-family: 'Helvetica Neue', Arial, sans-serif;
        }
        body {
          margin: 0;
          padding: 0;
          color: #0f172a;
          background: #ffffff;
          font-size: 11px;
          line-height: 1.4;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2.5px solid #80082E;
          padding-bottom: 10px;
          margin-bottom: 12px;
        }
        .company-title {
          font-size: 18px;
          font-weight: 900;
          color: #80082E;
          letter-spacing: 0.5px;
          margin: 0;
        }
        .company-sub {
          font-size: 10px;
          color: #64748b;
          font-weight: 700;
          margin: 2px 0 0 0;
        }
        .doc-badge {
          text-align: right;
        }
        .doc-title {
          font-size: 16px;
          font-weight: 900;
          color: #0f172a;
          margin: 0;
        }
        .barcode-img {
          height: 36px;
          margin-top: 4px;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 12px;
        }
        .box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 8px 12px;
        }
        .box-title {
          font-size: 9px;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          border-bottom: 1px solid #cbd5e1;
          padding-bottom: 3px;
          margin-bottom: 6px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 3px;
        }
        .info-label {
          color: #475569;
          font-weight: 600;
        }
        .info-val {
          font-weight: 800;
          color: #0f172a;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 12px;
          font-size: 10px;
        }
        th {
          background: #80082E;
          color: #ffffff;
          font-weight: 800;
          font-size: 9px;
          text-transform: uppercase;
          padding: 6px 8px;
          text-align: left;
          border: 1px solid #80082E;
        }
        td {
          padding: 5px 8px;
          border: 1px solid #cbd5e1;
        }
        tr:nth-child(even) td {
          background: #f8fafc;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .bold { font-weight: 800; }
        .summary-card {
          background: #ecfdf5;
          border: 1.5px solid #a7f3d0;
          border-radius: 6px;
          padding: 8px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .summary-val {
          font-size: 16px;
          font-weight: 900;
          color: #047857;
        }
        .signatures {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 20px;
          margin-top: 30px;
          padding-top: 10px;
        }
        .sig-box {
          border-top: 1.5px solid #0f172a;
          text-align: center;
          padding-top: 4px;
          font-size: 9px;
          font-weight: 800;
          color: #475569;
          text-transform: uppercase;
        }
        @media print {
          body { background: transparent; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1 class="company-title">CORTES BREINER S.A.S.</h1>
          <p class="company-sub">SISTEMA INTEGRAL DE CONTROL DE PRODUCCIÓN Y TENDIDO</p>
        </div>
        <div class="doc-badge">
          <p class="doc-title">ORDEN DE CORTE OC-${code}</p>
          ${barcodeUrl ? `<img src="${barcodeUrl}" class="barcode-img" alt="OC-${code}" />` : ''}
        </div>
      </div>

      <div class="grid-2">
        <div class="box">
          <div class="box-title">Datos Principales de la Orden</div>
          <div class="info-row"><span class="info-label">Código Interno:</span><span class="info-val">OC-${code}</span></div>
          <div class="info-row"><span class="info-label">Factura / Marca:</span><span class="info-val">${data.brand || data.client_name || '---'}</span></div>
          <div class="info-row"><span class="info-label">Cortador Asignado:</span><span class="info-val">${data.cortador_name || 'No asignado'}</span></div>
          <div class="info-row"><span class="info-label">Fecha Programada:</span><span class="info-val">${data.scheduled_date || 'Sin fecha'}</span></div>
        </div>
        <div class="box">
          <div class="box-title">Especificación Técnica del Trazo</div>
          <div class="info-row"><span class="info-label">Estado Actual:</span><span class="info-val">${data.status || 'Planeada'}</span></div>
          <div class="info-row"><span class="info-label">Largo del Trazo:</span><span class="info-val">${data.largo_trazo ? `${Number(data.largo_trazo).toFixed(2)} mts` : '---'}</span></div>
          <div class="info-row"><span class="info-label">Capas Programadas:</span><span class="info-val">${data.capas_proyectadas || 0}</span></div>
          <div class="info-row"><span class="info-label">Total Kilos Estimados:</span><span class="info-val">${data.total_kilos_proyectados ? `${Number(data.total_kilos_proyectados).toFixed(2)} kg` : '0 kg'}</span></div>
        </div>
      </div>

      ${data.fabrics && data.fabrics.length > 0 ? `
        <div style="font-weight:800; font-size:10px; margin-bottom:4px; color:#80082E; text-transform:uppercase;">Resumen de Telas y Capas</div>
        <table>
          <thead>
            <tr>
              <th>Tela</th>
              <th>Color</th>
              <th class="text-center">Capas</th>
              <th class="text-center">Metros</th>
              <th class="text-center">Kilos</th>
            </tr>
          </thead>
          <tbody>
            ${data.fabrics.map(f => `
              <tr>
                <td class="bold">${f.nombre_tela || 'Tela Base'}</td>
                <td>${f.nombre_color || '---'}</td>
                <td class="text-center bold">${Math.round(f.layers || 0)}</td>
                <td class="text-center">${f.metros ? Number(f.metros).toFixed(2) + ' m' : '---'}</td>
                <td class="text-center">${f.kilos ? Number(f.kilos).toFixed(2) + ' kg' : '---'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      ${data.items && data.items.length > 0 ? `
        <div style="font-weight:800; font-size:10px; margin-bottom:4px; color:#80082E; text-transform:uppercase;">Desglose por Trazo y Tallas</div>
        <table>
          <thead>
            <tr>
              <th>Referencia</th>
              <th>Tela</th>
              <th class="text-center">Talla</th>
              <th class="text-center">Capas</th>
              <th class="text-center">Marcación</th>
              <th class="text-right">Total Unds</th>
            </tr>
          </thead>
          <tbody>
            ${data.items.map(item => `
              <tr>
                <td class="bold">${item.referencia || '---'}</td>
                <td>${item.tela || '---'}</td>
                <td class="text-center bold">${item.talla || '---'}</td>
                <td class="text-center">${Math.round(item.capas || 0)}</td>
                <td class="text-center">${item.marcacion ?? '---'}</td>
                <td class="text-right bold" style="color:#047857;">${item.total || 0}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : data.sizes && data.sizes.length > 0 ? `
        <div style="font-weight:800; font-size:10px; margin-bottom:4px; color:#80082E; text-transform:uppercase;">Resumen por Tallas</div>
        <table>
          <thead>
            <tr>
              ${data.sizes.map(s => `<th class="text-center">${s.talla}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            <tr>
              ${data.sizes.map(s => `<td class="text-center bold" style="font-size:12px; color:#047857;">${s.quantity}</td>`).join('')}
            </tr>
          </tbody>
        </table>
      ` : ''}

      <div class="summary-card">
        <span style="font-weight:800; font-size:11px; color:#065f46;">TOTAL UNIDADES DE PRENDA PROGRAMADAS:</span>
        <span class="summary-val">${totalUnits} UNIDADES</span>
      </div>

      ${data.observaciones ? `
        <div class="box" style="margin-bottom:12px; background:#fffbeb; border-color:#fcd34d;">
          <div class="box-title" style="color:#92400e; border-color:#fef08a;">Observaciones / Notas de Planta</div>
          <div style="color:#78350f; font-size:10px;">${data.observaciones}</div>
        </div>
      ` : ''}

      <div class="signatures">
        <div class="sig-box">Planeación de Corte</div>
        <div class="sig-box">Cortador Responsable</div>
        <div class="sig-box">Control de Calidad</div>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=900,height=1000');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  } else {
    alert('Por favor permite las ventanas emergentes (popups) para descargar el PDF de la orden de corte.');
  }
}
