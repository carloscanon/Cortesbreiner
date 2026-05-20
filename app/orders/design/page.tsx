'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  UploadCloud, FileText, CheckCircle, AlertTriangle, 
  ArrowLeft, RefreshCw, Layers, Droplets, Save, X, Loader2, RotateCcw, Settings2
} from 'lucide-react';

interface ParsedFabric {
  codigo_tela: string;
  nombre_tela: string;
  costo_unitario: number;
  cantidad_factura: number;
  status: 'new' | 'existing' | 'error';
  db_id?: number;
}

export default function DesignSubmodulePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedFabric[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  
  // Advanced Global Settings
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [globalComposition, setGlobalComposition] = useState('91% Poliester y 9% Spandex');
  const [globalWidth, setGlobalWidth] = useState('1.50');
  const [globalWeight, setGlobalWeight] = useState('1');
  const [globalYield, setGlobalYield] = useState('3.5');
  const [globalLargo, setGlobalLargo] = useState('10'); // Largo del tendido

  // Track inserted codes for Undo
  const [newlyInsertedCodes, setNewlyInsertedCodes] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (selectedFile: File) => {
    const isXmlExtension = selectedFile.name.toLowerCase().endsWith('.xml');
    const isXmlType = selectedFile.type === 'text/xml' || selectedFile.type === 'application/xml' || selectedFile.type === '';
    
    if (!isXmlExtension && !isXmlType) {
      setError('Por favor, sube un archivo XML válido.');
      return;
    }
    setError(null);
    setFile(selectedFile);
    setIsParsing(true);
    setSuccess(false);
    setNewlyInsertedCodes([]);

    try {
      let text = await selectedFile.text();
      let parser = new DOMParser();
      let xmlDoc = parser.parseFromString(text, 'text/xml');
      
      const parseError = xmlDoc.getElementsByTagName("parsererror");
      if (parseError.length > 0) {
        throw new Error("El archivo XML principal está malformado.");
      }

      // Robust cross-browser namespace-aware DOM element selector helper
      const getElements = (parent: any, tagName: string): any[] => {
        const cleanName = tagName.includes(':') ? tagName.split(':')[1] : tagName;
        
        // 1. Try standard lookup with prefix
        let res = parent.getElementsByTagName(tagName);
        if (res && res.length > 0) return Array.from(res);
        
        // 2. Try standard lookup without prefix
        res = parent.getElementsByTagName(cleanName);
        if (res && res.length > 0) return Array.from(res);
        
        // 3. Try namespace-aware lookup if available
        if (parent.getElementsByTagNameNS) {
          res = parent.getElementsByTagNameNS('*', cleanName);
          if (res && res.length > 0) return Array.from(res);
        }
        
        return [];
      };

      // Extract Invoice ID from root or internal
      let extractedInvoiceId = '';
      const cbcIds = getElements(xmlDoc, 'cbc:ID');
      if (cbcIds.length > 0) {
        // usually the first or second ID is the Invoice Number (e.g. 2312157378)
        extractedInvoiceId = cbcIds[0]?.textContent || '';
      }

      // 1. Detectar si es un contenedor AttachedDocument (DIAN) que contiene el Invoice en CDATA
      let invoiceLines = getElements(xmlDoc, 'cac:InvoiceLine');
      
      if (invoiceLines.length === 0) {
        // Intentar buscar dentro del CDATA de cbc:Description
        const descriptionNodes = getElements(xmlDoc, 'cbc:Description');
        let invoiceXmlString = null;
        
        for (let i = 0; i < descriptionNodes.length; i++) {
          const content = descriptionNodes[i].textContent || '';
          if (content.includes('<Invoice') || content.includes('<cac:InvoiceLine') || content.includes('InvoiceLine')) {
            invoiceXmlString = content;
            break;
          }
        }

        if (invoiceXmlString) {
          // Parsear el XML interno que estaba en el CDATA
          const internalDoc = parser.parseFromString(invoiceXmlString, 'text/xml');
          invoiceLines = getElements(internalDoc, 'cac:InvoiceLine');
          
          // Re-extract ID from internal invoice
          const internalIds = getElements(internalDoc, 'cbc:ID');
          if (internalIds.length > 0) {
            extractedInvoiceId = internalIds[0]?.textContent || extractedInvoiceId;
          }
        }
      }

      if (invoiceLines.length === 0) {
        throw new Error('No se encontraron líneas de factura (cac:InvoiceLine) ni en el archivo ni en el contenedor.');
      }

      // Attempt to clean extracted Invoice ID if it's a long UUID, look for numeric ones
      if (extractedInvoiceId && extractedInvoiceId.length > 20) {
        for (let i = 0; i < cbcIds.length; i++) {
          const val = cbcIds[i]?.textContent || '';
          if (val.match(/^[0-9]+$/)) { // Only numbers, highly likely the invoice number
            extractedInvoiceId = val;
            break;
          }
        }
      }

      setInvoiceNumber(extractedInvoiceId);

      // Fetch existing fabrics to check for duplicates
      const { data: existingFabrics, error: dbError } = await supabase
        .from('fabrics')
        .select('id, codigo_tela, nombre_tela');
        
      if (dbError) throw dbError;

      const items: ParsedFabric[] = [];

      for (let i = 0; i < invoiceLines.length; i++) {
        const line = invoiceLines[i];
        
        // Extract Quantity
        const qtyNodes = getElements(line, 'cbc:InvoicedQuantity');
        const cantidad = qtyNodes.length > 0 ? parseFloat(qtyNodes[0].textContent || '0') : 0;

        // Extract Price
        const priceNodes = getElements(line, 'cbc:PriceAmount');
        const precio = priceNodes.length > 0 ? parseFloat(priceNodes[0].textContent || '0') : 0;

        // Extract Item Data
        const itemNodes = getElements(line, 'cac:Item');
        let description = '';
        let code = '';
        
        if (itemNodes.length > 0) {
          const itemNode = itemNodes[0];
          const descNodes = getElements(itemNode, 'cbc:Description');
          description = descNodes.length > 0 ? descNodes[0]?.textContent || '' : '';
          
          // Buscar ID en SellersItemIdentification
          const sellersIdNodes = getElements(itemNode, 'cac:SellersItemIdentification');
          if (sellersIdNodes.length > 0) {
            const sellersIdNode = sellersIdNodes[0];
            const idNodes = getElements(sellersIdNode, 'cbc:ID');
            code = idNodes.length > 0 ? idNodes[0]?.textContent || '' : '';
          }
          
          // Fallback a StandardItemIdentification
          if (!code) {
            const standardIdNodes = getElements(itemNode, 'cac:StandardItemIdentification');
            if (standardIdNodes.length > 0) {
              const standardIdNode = standardIdNodes[0];
              const idNodes = getElements(standardIdNode, 'cbc:ID');
              code = idNodes.length > 0 ? idNodes[0]?.textContent || '' : '';
            }
          }
        }

        // Limpiar código de la descripción si viene doble (ej: "JABON/001-NEGRO 10 JABON/, NEGRO 10")
        let cleanName = description;
        if (code && cleanName.startsWith(code)) {
          cleanName = cleanName.substring(code.length).trim();
        }

        // Check against DB
        const match = existingFabrics?.find(f => f.codigo_tela === code);

        items.push({
          codigo_tela: code || `GEN-${Math.floor(Math.random()*1000)}`,
          nombre_tela: cleanName || 'Tela sin nombre',
          costo_unitario: precio,
          cantidad_factura: cantidad,
          status: match ? 'existing' : 'new',
          db_id: match?.id
        });
      }

      setParsedItems(items);
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al leer el archivo XML.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleSyncToDatabase = async () => {
    if (parsedItems.length === 0) return;
    setIsSaving(true);
    setError(null);
    
    try {
      const newCodes: string[] = [];

      const itemsToUpsert = parsedItems.map(item => {
        if (item.status === 'new') {
          newCodes.push(item.codigo_tela);
        }

        const payload: any = {
          codigo_tela: item.codigo_tela,
          nombre_tela: item.nombre_tela.substring(0, 100), // Safety clip
          costo_unitario: item.costo_unitario,
          costo_con_iva: item.costo_unitario * 1.19, // Asumiendo 19% IVA por defecto
          tipo_tela: 'Importada XML',
          composicion: globalComposition,
          ancho: parseFloat(globalWidth) || 1.5,
          gramaje: parseFloat(globalWeight) || 1,
          rendimiento_estimado: parseFloat(globalYield) || 3.5,
          kilos: item.cantidad_factura,
          capas: ((item.cantidad_factura * (parseFloat(globalYield) || 3.5)) / (parseFloat(globalLargo) || 1)).toFixed(2),
          factura_relacionada: invoiceNumber
        };
        
        if (item.db_id) {
          payload.id = item.db_id; // Forzar update si ya existe
        }
        
        return payload;
      });

      const { error: upsertError } = await supabase
        .from('fabrics')
        .upsert(itemsToUpsert, { onConflict: 'codigo_tela' }); // Usa codigo_tela o id dependiendo de la constraint

      if (upsertError) {
        // Fallback to id if onConflict codigo_tela fails (Supabase requires unique constraint for upsert)
        const { error: fallbackError } = await supabase.from('fabrics').upsert(itemsToUpsert);
        if (fallbackError) throw fallbackError;
      }

      setSuccess(true);
      setNewlyInsertedCodes(newCodes);
      setParsedItems(prev => prev.map(p => ({ ...p, status: 'existing' })));
    } catch (err: any) {
      setError('Error al guardar en la base de datos: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUndo = async () => {
    if (newlyInsertedCodes.length === 0) {
      setError("No hay telas nuevas para deshacer en esta sesión.");
      return;
    }

    setIsUndoing(true);
    setError(null);
    try {
      // Eliminar de Supabase las telas que fueron insertadas como NUEVAS
      const { error: deleteError } = await supabase
        .from('fabrics')
        .delete()
        .in('codigo_tela', newlyInsertedCodes);

      if (deleteError) throw deleteError;

      // Actualizar UI
      setSuccess(false);
      setNewlyInsertedCodes([]);
      setParsedItems(prev => prev.map(p => {
        if (newlyInsertedCodes.includes(p.codigo_tela)) {
          return { ...p, status: 'new', db_id: undefined };
        }
        return p;
      }));

    } catch (err: any) {
      setError("Error al deshacer: " + err.message);
    } finally {
      setIsUndoing(false);
    }
  };

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const newItems = [...parsedItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setParsedItems(newItems);
  };

  const removeItem = (index: number) => {
    setParsedItems(parsedItems.filter((_, i) => i !== index));
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2.5rem' }}>
        <div>
          <button onClick={() => router.push('/orders')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '1rem', fontWeight: '600' }}>
            <ArrowLeft size={16} /> Volver a Órdenes
          </button>
          <h1 style={{ fontSize: '2rem', fontWeight: '900', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Layers size={32} style={{ color: 'var(--primary)' }} /> Submódulo de Diseño
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Carga facturas electrónicas XML para extraer telas, configurar valores por defecto y actualizar tu maestro.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: parsedItems.length > 0 ? '300px 1fr' : '1fr', gap: '2rem' }}>
        
        {/* Upload Zone */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${isDragging ? 'var(--primary)' : '#cbd5e1'}`,
              backgroundColor: isDragging ? '#f0f9ff' : 'white',
              borderRadius: '16px',
              padding: '3rem 2rem',
              textAlign: 'center',
              transition: 'all 0.2s',
              cursor: 'pointer'
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              accept=".xml, text/xml" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              style={{ display: 'none' }} 
            />
            {isParsing ? (
              <Loader2 size={48} className="animate-spin" style={{ color: 'var(--primary)', margin: '0 auto 1rem' }} />
            ) : (
              <UploadCloud size={48} style={{ color: isDragging ? 'var(--primary)' : '#94a3b8', margin: '0 auto 1rem' }} />
            )}
            <h3 style={{ fontSize: '1.125rem', fontWeight: '800', marginBottom: '0.5rem' }}>
              {isParsing ? 'Analizando XML...' : 'Sube tu factura XML'}
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Arrastra y suelta aquí, o haz clic para buscar.
            </p>
          </div>

          {file && !isParsing && (
            <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ backgroundColor: '#f1f5f9', padding: '0.75rem', borderRadius: '8px' }}>
                <FileText size={24} style={{ color: '#475569' }} />
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <p style={{ fontWeight: '700', fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
          )}

          {error && (
            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #ef4444', color: '#b91c1c', padding: '1rem', borderRadius: '12px', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <p style={{ fontSize: '0.875rem', fontWeight: '600' }}>{error}</p>
            </div>
          )}

          {success && (
            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #22c55e', color: '#15803d', padding: '1.5rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <CheckCircle size={24} style={{ flexShrink: 0 }} />
                <p style={{ fontSize: '1rem', fontWeight: '800' }}>¡Sincronización Exitosa!</p>
              </div>
              <p style={{ fontSize: '0.875rem' }}>Las telas han sido guardadas en la base de datos de Maestros.</p>
              
              {newlyInsertedCodes.length > 0 && (
                <button 
                  className="btn btn-secondary" 
                  onClick={handleUndo}
                  disabled={isUndoing}
                  style={{ backgroundColor: '#fef2f2', color: '#dc2626', borderColor: '#fca5a5', fontWeight: '800', width: '100%', marginTop: '0.5rem' }}
                >
                  {isUndoing ? <Loader2 size={18} className="animate-spin" /> : <RotateCcw size={18} />}
                  Deshacer Importación
                </button>
              )}
            </div>
          )}
        </div>

        {/* Workspace Zone */}
        {parsedItems.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Global Settings Panel */}
            <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', border: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#334155' }}>
                <Settings2 size={20} /> Configuraciones Predeterminadas (Factura)
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Estos valores se aplicarán a todas las telas de esta factura al momento de sincronizar.</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                <div className="form-group">
                  <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Factura Relacionada</label>
                  <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} style={{ padding: '0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontWeight: '800', backgroundColor: 'white', width: '100%' }} />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Composición Predeterminada</label>
                  <input type="text" value={globalComposition} onChange={e => setGlobalComposition(e.target.value)} style={{ padding: '0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', backgroundColor: 'white', width: '100%' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1.5rem' }}>
                <div className="form-group">
                  <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Ancho (m)</label>
                  <input type="number" step="0.01" value={globalWidth} onChange={e => setGlobalWidth(e.target.value)} style={{ padding: '0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', backgroundColor: 'white', width: '100%' }} />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Gramaje (g/m²)</label>
                  <input type="number" step="0.01" value={globalWeight} onChange={e => setGlobalWeight(e.target.value)} style={{ padding: '0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', backgroundColor: 'white', width: '100%' }} />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Rendimiento</label>
                  <input type="number" step="0.01" value={globalYield} onChange={e => setGlobalYield(e.target.value)} style={{ padding: '0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', backgroundColor: 'white', width: '100%' }} />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase' }}>Largo Tendido (m)</label>
                  <input type="number" step="0.01" value={globalLargo} onChange={e => setGlobalLargo(e.target.value)} style={{ padding: '0.75rem', borderRadius: '8px', border: '2px solid var(--primary)', backgroundColor: 'white', width: '100%', fontWeight: '800' }} />
                </div>
              </div>
            </div>

            {/* Data Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fcfcfc' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Droplets size={20} style={{ color: 'var(--primary)' }} /> Telas Extraídas ({parsedItems.length})
                </h3>
                <button 
                  className="btn btn-primary" 
                  onClick={handleSyncToDatabase} 
                  disabled={isSaving || success}
                  style={{ padding: '1rem 2rem', fontSize: '1rem', fontWeight: '800' }}
                >
                  {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                  {success ? 'Ya Sincronizado' : 'Ejecutar Sincronización'}
                </button>
              </div>

              <div style={{ overflowX: 'auto', flex: 1, maxHeight: '600px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr style={{ textAlign: 'left', backgroundColor: 'white', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '800', color: '#64748b' }}>ESTADO</th>
                      <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '800', color: '#64748b' }}>CÓDIGO</th>
                      <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '800', color: '#64748b' }}>NOMBRE / DESCRIPCIÓN</th>
                      <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textAlign: 'right' }}>KILOS (XML)</th>
                      <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--primary)', textAlign: 'right' }}>CAPAS</th>
                      <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textAlign: 'right' }}>COSTO U.</th>
                      <th style={{ padding: '1rem 1.5rem' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedItems.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: item.status === 'new' ? '#f0fdf4' : 'white' }}>
                        <td style={{ padding: '1rem 1.5rem' }}>
                          {item.status === 'new' ? (
                            <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '0.25rem 0.75rem', borderRadius: '99px', fontSize: '0.7rem', fontWeight: '800' }}>NUEVA</span>
                          ) : (
                            <span style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '0.25rem 0.75rem', borderRadius: '99px', fontSize: '0.7rem', fontWeight: '800' }}>EXISTENTE</span>
                          )}
                        </td>
                        <td style={{ padding: '1rem 1.5rem' }}>
                          <input type="text" value={item.codigo_tela} onChange={e => handleUpdateItem(idx, 'codigo_tela', e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', width: '120px', fontWeight: '700' }} />
                        </td>
                        <td style={{ padding: '1rem 1.5rem' }}>
                          <input type="text" value={item.nombre_tela} onChange={e => handleUpdateItem(idx, 'nombre_tela', e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', width: '100%', minWidth: '250px' }} />
                        </td>
                        <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontWeight: '700' }}>
                          {item.cantidad_factura.toLocaleString()}
                        </td>
                        <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontWeight: '900', color: 'var(--primary)' }}>
                          {((item.cantidad_factura * (parseFloat(globalYield) || 3.5)) / (parseFloat(globalLargo) || 1)).toFixed(2)} capas
                        </td>
                        <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                            <span style={{ color: 'var(--text-muted)' }}>$</span>
                            <input type="number" value={item.costo_unitario} onChange={e => handleUpdateItem(idx, 'costo_unitario', parseFloat(e.target.value) || 0)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', width: '100px', textAlign: 'right', fontWeight: '700' }} />
                          </div>
                        </td>
                        <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                          <button onClick={() => removeItem(idx)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '1rem 1.5rem', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'right', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                Nota: Las telas marcadas como "NUEVA" serán creadas en el Maestro. Las "EXISTENTE" actualizarán su nombre y precio.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
