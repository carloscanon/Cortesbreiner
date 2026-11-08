export interface ApprovedItemRow {
  reference: string;
  color: string;
  size: string;
  count: number;
}

export interface ApprovedOrderPdfData {
  orderCode: string;
  workshopName: string;
  inspector: string;
  formattedDate: string;
  totalApprovedQty: number;
  items: ApprovedItemRow[];
}

export function generateApprovedSummaryPdfHtml(data: ApprovedOrderPdfData) {
  const rowsHtml = data.items
    .map(
      (item, index) => `
      <tr style="${index % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
        <td style="padding: 10px 12px; text-align: center; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #64748b; font-size: 13px;">${index + 1}</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: 800; color: #0f172a; font-size: 13px;">${item.reference}</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #334155; font-size: 13px;">${item.color}</td>
        <td style="padding: 10px 14px; text-align: center; border-bottom: 1px solid #e2e8f0; font-weight: 900; color: #80082E; font-size: 13px;">
          <span style="display: inline-block; background-color: #fdf2f4; border: 1px solid #fecdd3; padding: 2px 10px; borderRadius: 6px;">${item.size}</span>
        </td>
        <td style="padding: 10px 14px; text-align: right; border-bottom: 1px solid #e2e8f0; font-weight: 900; color: #16a34a; font-size: 14px;">${item.count}</td>
      </tr>
    `
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Acta de Aprobación de Calidad - ${data.orderCode}</title>
      <style>
        @page {
          size: portrait;
          margin: 14mm 12mm 14mm 12mm;
        }
        * {
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        body {
          color: #0f172a;
          background-color: #fff;
          margin: 0;
          padding: 20px;
        }
        .header-container {
          border-bottom: 2.5px solid #80082E;
          padding-bottom: 14px;
          margin-bottom: 18px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .meta-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          background-color: #f8fafc;
          border: 1.5px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px 16px;
          margin-bottom: 20px;
        }
        .meta-item {
          display: flex;
          flex-direction: column;
        }
        .meta-label {
          font-size: 10px;
          text-transform: uppercase;
          color: #64748b;
          font-weight: 800;
          letter-spacing: 0.05em;
          margin-bottom: 2px;
        }
        .meta-value {
          font-size: 13px;
          font-weight: 900;
          color: #0f172a;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
        }
        th {
          background-color: #1e293b;
          color: #ffffff;
          padding: 10px 12px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 800;
        }
        .signatures {
          margin-top: 36px;
          display: flex;
          justify-content: space-between;
          gap: 40px;
          page-break-inside: avoid;
        }
        .sig-box {
          flex: 1;
          border-top: 1.5px solid #94a3b8;
          padding-top: 8px;
          text-align: center;
          font-size: 12px;
          font-weight: 800;
          color: #334155;
        }
        .sig-sub {
          font-size: 10px;
          color: #64748b;
          font-weight: 600;
          margin-top: 2px;
        }
        .toolbar {
          position: sticky;
          top: 0;
          background: #ffffff;
          padding: 12px 16px;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          border-bottom: 1px solid #e2e8f0;
          margin-bottom: 20px;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
        }
        .btn {
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 800;
          border-radius: 8px;
          cursor: pointer;
          border: none;
        }
        .btn-print {
          background-color: #2563eb;
          color: #ffffff;
        }
        .btn-close {
          background-color: #f1f5f9;
          color: #475569;
        }
        @media print {
          .toolbar {
            display: none !important;
          }
          body {
            padding: 0;
          }
          tr {
            page-break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      <div class="toolbar">
        <button class="btn btn-close" onclick="window.close()">✖ Cerrar</button>
        <button class="btn btn-print" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
      </div>

      <div class="header-container">
        <div>
          <div style="font-size: 11px; font-weight: 900; color: #80082E; letter-spacing: 0.1em; text-transform: uppercase;">
            Control de Calidad &amp; Producto Terminado
          </div>
          <h1 style="margin: 4px 0 2px 0; font-size: 20px; font-weight: 950; color: #0f172a;">
            ACTA DE ENTREGA — PRENDAS APROBADAS
          </h1>
          <div style="font-size: 12px; color: #64748b; font-weight: 600;">
            Comprobante oficial de validación física para ingreso a bodega de existencias
          </div>
        </div>
        <div style="text-align: right;">
          <div style="display: inline-block; background-color: #dcfce7; color: #15803d; border: 1.5px solid #86efac; padding: 6px 14px; border-radius: 9999px; font-weight: 900; font-size: 13px; letter-spacing: 0.05em;">
            ✓ ESTADO: APROBADO
          </div>
          <div style="font-size: 11px; color: #64748b; font-weight: 700; margin-top: 6px;">
            Bodega Destino: <strong>Bodega 101 Principal</strong>
          </div>
        </div>
      </div>

      <div class="meta-grid">
        <div class="meta-item">
          <span class="meta-label">Orden de Confección</span>
          <span class="meta-value" style="color: #80082E;">${data.orderCode}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Taller / Confeccionista</span>
          <span class="meta-value">${data.workshopName}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Inspector de Calidad</span>
          <span class="meta-value">${data.inspector}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Fecha y Hora de Aprobación</span>
          <span class="meta-value">${data.formattedDate}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Total Combinaciones</span>
          <span class="meta-value">${data.items.length} variantes</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Total Prendas Aprobadas</span>
          <span class="meta-value" style="color: #16a34a; font-size: 15px;">${data.totalApprovedQty} Unidades</span>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 45px; text-align: center;">#</th>
            <th style="text-align: left;">Referencia</th>
            <th style="text-align: left;">Color</th>
            <th style="text-align: center; width: 90px;">Talla</th>
            <th style="text-align: right; width: 130px;">Cant. Aprobada</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr style="background-color: #f1f5f9; font-weight: 950; border-top: 2px solid #0f172a;">
            <td colspan="4" style="padding: 12px 14px; text-align: right; font-size: 13px; text-transform: uppercase; color: #0f172a;">
              Total Unidades Aprobadas:
            </td>
            <td style="padding: 12px 14px; text-align: right; font-size: 16px; color: #16a34a; font-weight: 950;">
              ${data.totalApprovedQty}
            </td>
          </tr>
        </tfoot>
      </table>

      <div class="signatures">
        <div class="sig-box">
          <div>ENTREGADO POR CONTROL DE CALIDAD</div>
          <div class="sig-sub">Firma: ___________________________</div>
          <div class="sig-sub">Inspector: ${data.inspector}</div>
        </div>
        <div class="sig-box">
          <div>RECIBIDO EN BODEGA 101 PRINCIPAL</div>
          <div class="sig-sub">Firma: ___________________________</div>
          <div class="sig-sub">Responsable de Inventario / Bodega</div>
        </div>
      </div>

      <div style="margin-top: 24px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 8px;">
        Documento generado automáticamente por el Sistema de Gestión de Confección &amp; Calidad — ${new Date().toLocaleString('es-CO')}
      </div>

      <script>
        setTimeout(() => {
          window.print();
        }, 350);
      </script>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=950,height=1000');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
  } else {
    alert('Por favor habilita las ventanas emergentes (popups) en tu navegador para ver e imprimir el PDF de prendas aprobadas.');
  }
}
