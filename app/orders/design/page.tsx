'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  UploadCloud, FileText, CheckCircle, AlertTriangle, 
  ArrowLeft, RefreshCw, Layers, Droplets, Save, X, Loader2, RotateCcw, Settings2,
  FileSpreadsheet, Download, Trash2, Search
} from 'lucide-react';

interface ParsedFabric {
  codigo_tela: string;
  nombre_tela: string;
  costo_unitario: number;
  cantidad_factura: number;
  rendimiento?: number;
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
  const [supplierData, setSupplierData] = useState<{ nit: string, razon_social: string, direccion?: string, ciudad?: string, departamento?: string, telefono?: string, email?: string } | null>(null);
  const [importMode, setImportMode] = useState<'xml' | 'csv' | 'pdf' | 'manage'>('xml');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [isDeletingInvoice, setIsDeletingInvoice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<string | null>(null);
  const [fabricsInModal, setFabricsInModal] = useState<any[]>([]);
  const [isLoadingFabricsModal, setIsLoadingFabricsModal] = useState(false);
  
  // Advanced Global Settings
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [globalComposition, setGlobalComposition] = useState('91% Poliester y 9% Spandex');
  const [globalWidth, setGlobalWidth] = useState('1.50');
  const [globalWeight, setGlobalWeight] = useState('1');
  const [globalYield, setGlobalYield] = useState('3.5');
  const [globalLargo, setGlobalLargo] = useState('1'); // Largo del tendido

  // Track inserted codes for Undo
  const [newlyInsertedCodes, setNewlyInsertedCodes] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchLoadedInvoices = async () => {
    setIsLoadingInvoices(true);
    try {
      const { data, error } = await supabase
        .from('fabrics')
        .select('factura_relacionada, created_at')
        .not('factura_relacionada', 'is', null)
        .neq('factura_relacionada', '');

      if (error) throw error;

      const groups: Record<string, { invoiceNumber: string; fabricCount: number; minCreatedAt: string }> = {};

      data?.forEach(row => {
        const inv = row.factura_relacionada;
        if (!groups[inv]) {
          groups[inv] = {
            invoiceNumber: inv,
            fabricCount: 0,
            minCreatedAt: row.created_at
          };
        }
        groups[inv].fabricCount += 1;
        if (row.created_at < groups[inv].minCreatedAt) {
          groups[inv].minCreatedAt = row.created_at;
        }
      });

      const list = Object.values(groups).sort((a, b) => {
        return new Date(b.minCreatedAt).getTime() - new Date(a.minCreatedAt).getTime();
      });

      setInvoices(list);
    } catch (err: any) {
      setError('Error al cargar la lista de facturas: ' + err.message);
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  const handleDeleteInvoice = async (invoiceNum: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar la factura "${invoiceNum}" y todas las telas asociadas? Esta acción no se puede deshacer.`)) {
      return;
    }

    setIsDeletingInvoice(invoiceNum);
    setError(null);

    try {
      const { data: fabricsInInvoice, error: fabricsErr } = await supabase
        .from('fabrics')
        .select('id, nombre_tela, codigo_tela')
        .eq('factura_relacionada', invoiceNum);

      if (fabricsErr) throw new Error('No se pudieron consultar las telas de la factura: ' + fabricsErr.message);

      if (fabricsInInvoice && fabricsInInvoice.length > 0) {
        const fabricIds = fabricsInInvoice.map(f => f.id);

        const { data: cutsData, error: cutsErr } = await supabase
          .from('cuts')
          .select('id, fabric_id')
          .in('fabric_id', fabricIds)
          .limit(5);

        if (cutsErr) throw new Error('No se pudo verificar el consumo en la mesa de corte: ' + cutsErr.message);
        if (cutsData && cutsData.length > 0) {
          throw new Error('La factura no puede eliminarse porque algunas de sus telas ya están programadas o usadas en la mesa de corte.');
        }

        const { data: ordersData, error: ordersErr } = await supabase
          .from('orders')
          .select('id, fabric_id')
          .in('fabric_id', fabricIds)
          .limit(5);

        if (ordersErr) throw new Error('No se pudo verificar el consumo en órdenes de producción: ' + ordersErr.message);
        if (ordersData && ordersData.length > 0) {
          throw new Error('La factura no puede eliminarse porque algunas de sus telas ya están asociadas a órdenes de producción.');
        }

        const { data: inventoryData, error: inventoryErr } = await supabase
          .from('fabric_inventory')
          .select('id, fabric_id')
          .in('fabric_id', fabricIds)
          .limit(5);

        if (inventoryErr) throw new Error('No se pudo verificar el inventario de rollos: ' + inventoryErr.message);
        if (inventoryData && inventoryData.length > 0) {
          throw new Error('La factura no puede eliminarse porque algunas de sus telas tienen rollos registrados en el Inventario de Telas.');
        }

        const { error: deleteErr } = await supabase
          .from('fabrics')
          .delete()
          .eq('factura_relacionada', invoiceNum);

        if (deleteErr) throw new Error('Error al eliminar las telas de la factura: ' + deleteErr.message);
      }

      alert(`La factura "${invoiceNum}" y todas sus telas asociadas han sido eliminadas exitosamente.`);
      fetchLoadedInvoices();
      
      if (invoiceNumber === invoiceNum) {
        setParsedItems([]);
        setFile(null);
        setInvoiceNumber('');
        setSuccess(false);
      }

    } catch (err: any) {
      setError(err.message || 'Error desconocido al eliminar la factura.');
    } finally {
      setIsDeletingInvoice(null);
    }
  };

  const handleOpenFabricsModal = async (invoiceNum: string) => {
    setSelectedInvoiceForModal(invoiceNum);
    setIsLoadingFabricsModal(true);
    setFabricsInModal([]);
    try {
      const { data, error } = await supabase
        .from('fabrics')
        .select('codigo_tela, nombre_tela, kilos, capas, costo_unitario, costo_con_iva')
        .eq('factura_relacionada', invoiceNum)
        .order('codigo_tela', { ascending: true });

      if (error) throw error;
      setFabricsInModal(data || []);
    } catch (err: any) {
      setError('Error al cargar las telas de la factura: ' + err.message);
    } finally {
      setIsLoadingFabricsModal(false);
    }
  };

  useEffect(() => {
    if (importMode === 'manage') {
      fetchLoadedInvoices();
    }
  }, [importMode]);

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

  const loadPdfJS = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).pdfjsLib) {
        resolve((window as any).pdfjsLib);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        const pdfjsLib = (window as any).pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(pdfjsLib);
      };
      script.onerror = () => {
        reject(new Error('No se pudo cargar la librería PDF.js desde CDN. Revisa tu conexión a internet.'));
      };
      document.head.appendChild(script);
    });
  };

  const parsePDFInvoice = async (pdfFile: File, targetInvoice: string): Promise<ParsedFabric[]> => {
    const pdfjsLib = await loadPdfJS();
    const arrayBuffer = await pdfFile.arrayBuffer();
    
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }
    
    const lines = fullText.split('\n');
    const items: ParsedFabric[] = [];
    
    const { data: existingFabrics, error: dbError } = await supabase
      .from('fabrics')
      .select('id, codigo_tela, nombre_tela, factura_relacionada')
      .eq('factura_relacionada', targetInvoice);
      
    if (dbError) throw dbError;
    
    const textileRegex = /(tela|col|algodon|licra|poliester|lino|spandex|jersey|tejido|rib|satin|denim|viscosa|nailon|encaje|kg|kilo|cant|roll)/i;
    
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      
      const numbers = line.match(/\d+([.,]\d+)?/g);
      
      if (numbers && numbers.length >= 2) {
        const floatNumbers = numbers.map(num => parseFloat(num.replace(',', '.')));
        const priceCandidate = floatNumbers.find(n => n >= 500) || floatNumbers[floatNumbers.length - 1] || 0;
        const qtyCandidate = floatNumbers.find(n => n > 0 && n < 500 && n !== priceCandidate) || floatNumbers[0] || 0;
        
        if (qtyCandidate > 0 && priceCandidate > 0) {
          let textParts = line.split(/\s+/).filter(part => {
            return !part.match(/^\d+([.,]\d+)?$/) && !part.includes('$');
          });
          
          let code = '';
          let name = '';
          
          if (textParts.length > 0) {
            const firstWord = textParts[0];
            if (firstWord.match(/[A-Za-z0-9_-]+/) && firstWord.length > 2) {
              code = firstWord;
              name = textParts.slice(1).join(' ');
            } else {
              code = `TELA-${Math.floor(Math.random() * 1000)}`;
              name = textParts.join(' ');
            }
          } else {
            code = `TELA-${Math.floor(Math.random() * 1000)}`;
            name = 'Tela extraída de PDF';
          }
          
          if (name.trim().length < 3) {
            name = `Tela en línea: ${line.substring(0, 30)}...`;
          }
          
          name = name.replace(/[^\w\sñáéíóúÑÁÉÍÓÚ]/g, '').trim();
          const match = existingFabrics?.find(f => f.codigo_tela === code);
          
          items.push({
            codigo_tela: code,
            nombre_tela: name,
            costo_unitario: priceCandidate,
            cantidad_factura: qtyCandidate,
            status: match ? 'existing' : 'new',
            db_id: match?.id
          });
        }
      }
    }
    
    if (items.length === 0) {
      items.push({
        codigo_tela: `PDF-GEN-${Math.floor(Math.random()*1000)}`,
        nombre_tela: 'Tela importada de PDF (Completar manualmente)',
        costo_unitario: 15000,
        cantidad_factura: 100,
        status: 'new'
      });
    }
    
    return items;
  };

  const downloadCSVTemplate = () => {
    const csvContent = "\ufeff" + 
      "codigo_tela;nombre_tela;cantidad_kilos;costo_unitario\n" +
      "TELA-001;Algodon Licrado Negro;150.5;18500\n" +
      "TELA-002;Fibrana Estampada Azul;95.0;22000\n" +
      "TELA-003;Lino Spandex Blanco;120.0;25000\n";
      
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "plantilla_carga_telas.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const processFile = async (selectedFile: File) => {
    const isXml = selectedFile.name.toLowerCase().endsWith('.xml');
    const isCsv = selectedFile.name.toLowerCase().endsWith('.csv');
    const isPdf = selectedFile.name.toLowerCase().endsWith('.pdf');
    
    if (!isXml && !isCsv && !isPdf) {
      setError('Por favor, sube un archivo válido (.xml, .csv o .pdf).');
      return;
    }
    setError(null);
    setFile(selectedFile);
    setIsParsing(true);
    setSuccess(false);
    setNewlyInsertedCodes([]);

    try {
      if (isPdf) {
        const targetInvoiceNumber = invoiceNumber || `FAC-PDF-${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;
        if (!invoiceNumber) {
          setInvoiceNumber(targetInvoiceNumber);
        }
        
        const items = await parsePDFInvoice(selectedFile, targetInvoiceNumber);
        
        setParsedItems(items);
        setImportMode('pdf'); // switch tab automatically
      } else if (isCsv) {
        let text = await selectedFile.text();
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) {
          throw new Error("El archivo CSV está vacío o no contiene suficientes líneas.");
        }
        
        // Detect separator: comma or semicolon
        const firstLine = lines[0];
        const separator = firstLine.includes(';') ? ';' : ',';
        
        // Parse headers
        const headers = firstLine.split(separator).map(h => h.trim().toLowerCase());
        
        // Find column indexes
        let codeIdx = headers.findIndex(h => h.includes('cod') || h.includes('ref') || h.includes('item'));
        let nameIdx = headers.findIndex(h => h.includes('nom') || h.includes('desc') || h.includes('tela'));
        let qtyIdx = headers.findIndex(h => h.includes('kil') || h.includes('cant') || h.includes('qty'));
        let priceIdx = headers.findIndex(h => h.includes('cost') || h.includes('prec') || h.includes('price'));
        
        // Fallbacks if headers are not matched
        if (codeIdx === -1) codeIdx = 0;
        if (nameIdx === -1) nameIdx = 1;
        if (qtyIdx === -1) qtyIdx = 2;
        if (priceIdx === -1) priceIdx = 3;
        
        const items: ParsedFabric[] = [];
        
        const targetInvoiceNumber = invoiceNumber || `FAC-MAN-${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;
        if (!invoiceNumber) {
          setInvoiceNumber(targetInvoiceNumber);
        }
        
        // Fetch existing fabrics associated with this invoice to check for duplicates
        const { data: existingFabrics, error: dbError } = await supabase
          .from('fabrics')
          .select('id, codigo_tela, nombre_tela, factura_relacionada')
          .eq('factura_relacionada', targetInvoiceNumber);
          
        if (dbError) throw dbError;
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const parts = line.split(separator).map(p => {
            let clean = p.trim();
            if (clean.startsWith('"') && clean.endsWith('"')) {
              clean = clean.substring(1, clean.length - 1).trim();
            }
            return clean;
          });
          
          if (parts.length < 2) continue; // Skip empty/invalid lines
          
          const code = parts[codeIdx] || `GEN-${Math.floor(Math.random()*1000)}`;
          const name = parts[nameIdx] || 'Tela sin nombre';
          const cantidad = parseFloat(parts[qtyIdx]?.replace(',', '.') || '0') || 0;
          const precio = parseFloat(parts[priceIdx]?.replace(',', '.') || '0') || 0;
          
          const match = existingFabrics?.find(f => f.codigo_tela === code);
          
          items.push({
            codigo_tela: code,
            nombre_tela: name,
            costo_unitario: precio,
            cantidad_factura: cantidad,
            status: match ? 'existing' : 'new',
            db_id: match?.id
          });
        }
        
        if (items.length === 0) {
          throw new Error("No se encontraron telas válidas en el archivo CSV.");
        }
        
        if (!invoiceNumber) {
          const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
          setInvoiceNumber(`FAC-MAN-${dateStr}`);
        }
        
        setParsedItems(items);
        setImportMode('csv'); // switch tab automatically
      } else {
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

        let targetDoc: Document | any = xmlDoc;

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
            targetDoc = internalDoc;
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

        // Extract Supplier Data (NIT and Company Name)
        // Try searching in targetDoc first (which is internalDoc if it was an AttachedDocument), fallback to xmlDoc
        let supplierParties = getElements(targetDoc, 'cac:AccountingSupplierParty');
        if (supplierParties.length === 0 && targetDoc !== xmlDoc) {
          supplierParties = getElements(xmlDoc, 'cac:AccountingSupplierParty');
        }
        if (supplierParties.length === 0) {
          supplierParties = getElements(targetDoc, 'cac:SenderParty');
        }
        let extractedSupplier = null;
        if (supplierParties.length > 0) {
          const supplierNode = supplierParties[0];
          // Extracción del NIT
          let nit = '';
          const companyIds = getElements(supplierNode, 'cbc:CompanyID');
          if (companyIds.length > 0) {
            nit = companyIds[0]?.textContent || '';
          } else {
            const ids = getElements(supplierNode, 'cbc:ID');
            if (ids.length > 0) nit = ids[0]?.textContent || '';
          }
          
          // Extracción del Nombre / Razón Social
          let name = '';
          const regNames = getElements(supplierNode, 'cbc:RegistrationName');
          if (regNames.length > 0) {
            name = regNames[0]?.textContent || '';
          } else {
            const names = getElements(supplierNode, 'cbc:Name');
            if (names.length > 0) name = names[0]?.textContent || '';
          }
          
          // Extracción de Dirección y Ciudad
          let direccion = '';
          let ciudad = '';
          let departamento = '';
          const addressNodes = getElements(supplierNode, 'cac:RegistrationAddress');
          if (addressNodes.length > 0) {
            const addrNode = addressNodes[0];
            const cityNodes = getElements(addrNode, 'cbc:CityName');
            if (cityNodes.length > 0) ciudad = cityNodes[0]?.textContent || '';
            const deptoNodes = getElements(addrNode, 'cbc:CountrySubentity');
            if (deptoNodes.length > 0) departamento = deptoNodes[0]?.textContent || '';
            const lineNodes = getElements(addrNode, 'cbc:Line');
            if (lineNodes.length > 0) direccion = lineNodes[0]?.textContent || '';
          }

          // Extracción de Contacto
          let telefono = '';
          let email = '';
          const contactNodes = getElements(supplierNode, 'cac:Contact');
          if (contactNodes.length > 0) {
            const contactNode = contactNodes[0];
            const telNodes = getElements(contactNode, 'cbc:Telephone');
            if (telNodes.length > 0) telefono = telNodes[0]?.textContent || '';
            const mailNodes = getElements(contactNode, 'cbc:ElectronicMail');
            if (mailNodes.length > 0) email = mailNodes[0]?.textContent || '';
          }
          
          if (nit || name) {
            extractedSupplier = { 
              nit, 
              razon_social: name || 'Proveedor Desconocido',
              direccion,
              ciudad,
              departamento,
              telefono,
              email
            };
            setSupplierData(extractedSupplier);
          } else {
            setSupplierData(null);
          }
        } else {
          setSupplierData(null);
        }

        // Fetch existing fabrics associated with this invoice to check for duplicates
        const { data: existingFabrics, error: dbError } = await supabase
          .from('fabrics')
          .select('id, codigo_tela, nombre_tela, factura_relacionada')
          .eq('factura_relacionada', extractedInvoiceId);
          
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
        setImportMode('xml'); // switch tab automatically
      }
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al leer el archivo.');
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

      const newItems = parsedItems
        .filter(item => item.status === 'new')
        .map(item => {
          newCodes.push(item.codigo_tela);
          return {
            codigo_tela: item.codigo_tela,
            nombre_tela: item.nombre_tela.substring(0, 100),
            costo_unitario: item.costo_unitario,
            costo_con_iva: item.costo_unitario * 1.19,
            tipo_tela: importMode === 'csv' ? 'Carga Manual CSV' : importMode === 'pdf' ? 'Importada PDF' : 'Importada XML',
            composicion: globalComposition,
            ancho: parseFloat(globalWidth) || 1.5,
            gramaje: parseFloat(globalWeight) || 1,
            rendimiento_estimado: item.rendimiento !== undefined ? item.rendimiento : (parseFloat(globalYield) || 3.5),
            kilos: item.cantidad_factura,
            metros: parseFloat((item.cantidad_factura * (item.rendimiento !== undefined ? item.rendimiento : (parseFloat(globalYield) || 3.5))).toFixed(2)),
            capas: ((item.cantidad_factura * (item.rendimiento !== undefined ? item.rendimiento : (parseFloat(globalYield) || 3.5))) / (parseFloat(globalLargo) || 1)).toFixed(2),
            factura_relacionada: invoiceNumber
          };
        });

      const existingItems = parsedItems
        .filter(item => item.status === 'existing' && item.db_id)
        .map(item => ({
          id: item.db_id,
          codigo_tela: item.codigo_tela,
          nombre_tela: item.nombre_tela.substring(0, 100),
          costo_unitario: item.costo_unitario,
          costo_con_iva: item.costo_unitario * 1.19,
          tipo_tela: importMode === 'csv' ? 'Carga Manual CSV' : importMode === 'pdf' ? 'Importada PDF' : 'Importada XML',
          composicion: globalComposition,
          ancho: parseFloat(globalWidth) || 1.5,
          gramaje: parseFloat(globalWeight) || 1,
          rendimiento_estimado: item.rendimiento !== undefined ? item.rendimiento : (parseFloat(globalYield) || 3.5),
          kilos: item.cantidad_factura,
          metros: parseFloat((item.cantidad_factura * (item.rendimiento !== undefined ? item.rendimiento : (parseFloat(globalYield) || 3.5))).toFixed(2)),
          capas: ((item.cantidad_factura * (item.rendimiento !== undefined ? item.rendimiento : (parseFloat(globalYield) || 3.5))) / (parseFloat(globalLargo) || 1)).toFixed(2),
          factura_relacionada: invoiceNumber
        }));

      // Si hay supplierData (Proveedor de la factura XML), verificar e insertar si no existe
      if (supplierData && supplierData.nit) {
        const { data: existingSupplier, error: supplierCheckError } = await supabase
          .from('suppliers')
          .select('id')
          .eq('nit', supplierData.nit)
          .single();
          
        if (supplierCheckError && supplierCheckError.code !== 'PGRST116') {
          console.error("Error al buscar proveedor:", supplierCheckError);
        }
        
        if (!existingSupplier) {
          const { error: supplierInsertError } = await supabase
            .from('suppliers')
            .insert({
              nit: supplierData.nit,
              razon_social: supplierData.razon_social,
              tipo_proveedor: 'Telas',
              direccion: supplierData.direccion || '',
              ciudad: supplierData.ciudad || '',
              departamento: supplierData.departamento || '',
              telefono: supplierData.telefono || '',
              email: supplierData.email || '',
              contacto: ''
            });
            
          if (supplierInsertError) {
            console.error("Error al crear proveedor:", supplierInsertError);
          }
        } else {
          const { error: supplierUpdateError } = await supabase
            .from('suppliers')
            .update({
              razon_social: supplierData.razon_social,
              direccion: supplierData.direccion || '',
              ciudad: supplierData.ciudad || '',
              departamento: supplierData.departamento || '',
              telefono: supplierData.telefono || '',
              email: supplierData.email || ''
            })
            .eq('id', existingSupplier.id);
            
          if (supplierUpdateError) {
            console.error("Error al actualizar proveedor:", supplierUpdateError);
          }
        }
      }

      // INSERT nuevas (guardamos para obtener los IDs autogenerados)
      let insertedFabrics: any[] = [];
      if (newItems.length > 0) {
        const { data: insertedData, error: insertError } = await supabase
          .from('fabrics')
          .insert(newItems)
          .select();
        if (insertError) throw insertError;
        insertedFabrics = insertedData || [];
      }

      // UPDATE existentes (con id)
      for (const item of existingItems) {
        const { error: updateError } = await supabase
          .from('fabrics')
          .update(item)
          .eq('id', item.id);
        if (updateError) throw updateError;
      }

      // AUTO-ENTRADA AL INVENTARIO DE TELAS
      // Obtenemos el primer color del maestro y la primera bodega para asignación por defecto
      const { data: colorsList } = await supabase.from('colors').select('id').limit(1);
      const { data: warehousesList } = await supabase.from('warehouses').select('nombre_bodega').limit(1);
      
      const defaultColorId = colorsList?.[0]?.id || null;
      const defaultLocation = warehousesList?.[0]?.nombre_bodega || 'Bodega Principal';

      const inventoryRollsToInsert: any[] = [];

      // Procesar telas nuevas insertadas
      insertedFabrics.forEach((fab, index) => {
        const sourceItem = newItems[index];
        const qtyKilos = Number(fab.kilos) || 0;
        const qtyMeters = Number(fab.metros) || 0;

        if (qtyKilos > 0) {
          inventoryRollsToInsert.push({
            fabric_id: fab.id,
            color_id: defaultColorId,
            roll_number: `${invoiceNumber || 'FAC'}-${fab.codigo_tela || index}`,
            kilos: qtyKilos,
            meters: qtyMeters,
            location: defaultLocation,
            status: 'Disponible'
          });
        }
      });

      // Procesar telas existentes actualizadas (solo si aún no tienen rollos registrados para evitar duplicación)
      for (const item of existingItems) {
        const { data: existingRolls } = await supabase
          .from('fabric_inventory')
          .select('id')
          .eq('fabric_id', item.id)
          .limit(1);

        if (!existingRolls || existingRolls.length === 0) {
          const qtyKilos = Number(item.kilos) || 0;
          const qtyMeters = Number(item.metros) || 0;

          if (qtyKilos > 0) {
            inventoryRollsToInsert.push({
              fabric_id: item.id,
              color_id: defaultColorId,
              roll_number: `${invoiceNumber || 'FAC'}-${item.codigo_tela}`,
              kilos: qtyKilos,
              meters: qtyMeters,
              location: defaultLocation,
              status: 'Disponible'
            });
          }
        }
      }

      // Insertar rollos generados en fabric_inventory
      if (inventoryRollsToInsert.length > 0) {
        const { error: invInsertError } = await supabase
          .from('fabric_inventory')
          .insert(inventoryRollsToInsert);
        
        if (invInsertError) {
          console.error("Error al registrar rollos automáticos en el inventario:", invInsertError);
        }
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
          <p style={{ color: 'var(--text-muted)' }}>Carga facturas electrónicas XML de la DIAN, archivos PDF o utiliza nuestra plantilla CSV/Excel para extraer telas y programar tu producción.</p>
        </div>
      </div>

      {/* Import Mode Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.75rem' }}>
        <button 
          onClick={() => { setImportMode('xml'); setError(null); }}
          style={{
            padding: '0.75rem 1.5rem',
            fontWeight: '850',
            fontSize: '0.9rem',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: importMode === 'xml' ? 'var(--primary)' : '#f1f5f9',
            color: importMode === 'xml' ? 'white' : '#475569',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Layers size={18} /> Factura XML (DIAN)
        </button>
        <button 
          onClick={() => { setImportMode('csv'); setError(null); }}
          style={{
            padding: '0.75rem 1.5rem',
            fontWeight: '850',
            fontSize: '0.9rem',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: importMode === 'csv' ? 'var(--primary)' : '#f1f5f9',
            color: importMode === 'csv' ? 'white' : '#475569',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <FileSpreadsheet size={18} /> Plantilla Excel / CSV
        </button>
        <button 
          onClick={() => { setImportMode('pdf'); setError(null); }}
          style={{
            padding: '0.75rem 1.5rem',
            fontWeight: '850',
            fontSize: '0.9rem',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: importMode === 'pdf' ? 'var(--primary)' : '#f1f5f9',
            color: importMode === 'pdf' ? 'white' : '#475569',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <FileText size={18} /> Factura PDF
        </button>
        <button 
          onClick={() => { setImportMode('manage'); setError(null); }}
          style={{
            padding: '0.75rem 1.5rem',
            fontWeight: '850',
            fontSize: '0.9rem',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: importMode === 'manage' ? 'var(--primary)' : '#f1f5f9',
            color: importMode === 'manage' ? 'white' : '#475569',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginLeft: 'auto'
          }}
        >
          <Settings2 size={18} /> Gestión de Facturas
        </button>
      </div>

      {importMode === 'manage' ? (
        <div className="card" style={{ padding: '2rem', width: '100%', minHeight: '400px', display: 'flex', flexDirection: 'column', gap: '1.5rem', border: '1px solid #cbd5e1', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', backgroundColor: 'white', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e293b', margin: 0 }}>
                <Layers size={24} style={{ color: 'var(--primary)' }} /> Facturas de Telas Importadas
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>Administra y elimina de forma segura las facturas de telas cargadas en el sistema.</p>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: '300px' }}>
                <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input 
                  type="text" 
                  placeholder="Buscar factura..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '0.625rem 1rem 0.625rem 2.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.875rem', fontWeight: '600' }}
                />
              </div>
              <button 
                onClick={fetchLoadedInvoices}
                disabled={isLoadingInvoices}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.625rem 1rem',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  fontWeight: '700',
                  color: '#475569',
                  transition: 'all 0.2s'
                }}
              >
                <RefreshCw size={16} className={isLoadingInvoices ? 'animate-spin' : ''} /> Refrescar
              </button>
            </div>
          </div>

          {error && (
            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #ef4444', color: '#b91c1c', padding: '1rem', borderRadius: '12px', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: '800', margin: 0 }}>Error de Validación</p>
                <p style={{ fontSize: '0.875rem', fontWeight: '600', marginTop: '0.25rem', margin: 0 }}>{error}</p>
              </div>
            </div>
          )}

          {isLoadingInvoices ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '4rem 0', gap: '1rem' }}>
              <Loader2 size={40} className="animate-spin" style={{ color: 'var(--primary)' }} />
              <p style={{ color: '#64748b', fontWeight: '700' }}>Cargando listado de facturas...</p>
            </div>
          ) : invoices.filter(inv => inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '5rem 0', backgroundColor: '#f8fafc', borderRadius: '12px', border: '2px dashed #e2e8f0' }}>
              <Layers size={48} style={{ color: '#94a3b8', margin: '0 auto 1rem' }} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: '850', color: '#334155', marginBottom: '0.5rem' }}>
                {searchQuery ? 'No se encontraron facturas coincidentes' : 'No hay facturas cargadas'}
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.875rem', maxWidth: '400px', margin: '0 auto' }}>
                {searchQuery ? 'Prueba escribiendo otro número de factura en la barra de búsqueda.' : 'Las facturas que cargues usando XML, CSV o PDF aparecerán listadas aquí para su gestión.'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>Factura Relacionada</th>
                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>Fecha de Carga</th>
                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Total Telas</th>
                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices
                    .filter(inv => inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((inv) => (
                      <tr key={inv.invoiceNumber} style={{ borderBottom: '1px solid #e2e8f0', transition: 'background-color 0.2s' }}>
                        <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.9rem', fontWeight: '800', color: '#0f172a' }}>
                          {inv.invoiceNumber}
                        </td>
                        <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.85rem', color: '#475569', fontWeight: '600' }}>
                          {new Date(inv.minCreatedAt).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                          <span 
                            onClick={() => handleOpenFabricsModal(inv.invoiceNumber)}
                            style={{ 
                              backgroundColor: '#eff6ff', 
                              color: '#1d4ed8', 
                              padding: '0.35rem 0.85rem', 
                              borderRadius: '99px', 
                              fontSize: '0.8rem', 
                              fontWeight: '800', 
                              border: '1px solid #bfdbfe',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              transition: 'all 0.2s',
                              userSelect: 'none'
                            }}
                            onMouseOver={e => {
                              e.currentTarget.style.backgroundColor = '#dbeafe';
                              e.currentTarget.style.transform = 'scale(1.05)';
                            }}
                            onMouseOut={e => {
                              e.currentTarget.style.backgroundColor = '#eff6ff';
                              e.currentTarget.style.transform = 'scale(1)';
                            }}
                          >
                            {inv.fabricCount} {inv.fabricCount === 1 ? 'tela' : 'telas'}
                          </span>
                        </td>
                        <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                          <button 
                            onClick={() => handleDeleteInvoice(inv.invoiceNumber)}
                            disabled={isDeletingInvoice !== null}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.5rem',
                              backgroundColor: '#fef2f2',
                              color: '#dc2626',
                              border: '1.5px solid #fca5a5',
                              padding: '0.5rem 1rem',
                              borderRadius: '8px',
                              fontWeight: '800',
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            {isDeletingInvoice === inv.invoiceNumber ? (
                              <>
                                <Loader2 size={14} className="animate-spin" />
                                Validando...
                              </>
                            ) : (
                              <>
                                <Trash2 size={14} />
                                Eliminar Factura
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: parsedItems.length > 0 ? '300px 1fr' : '1fr', gap: '2rem' }}>
        
        {/* Upload Zone */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {importMode === 'csv' && (
            <button 
              onClick={downloadCSVTemplate}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                backgroundColor: '#ecfdf5',
                color: '#059669',
                border: '1.5px solid #a7f3d0',
                padding: '0.85rem',
                borderRadius: '12px',
                fontWeight: '800',
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#d1fae5';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#ecfdf5';
              }}
            >
              <Download size={18} /> Descargar Plantilla Excel / CSV
            </button>
          )}

          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              border: `2.5px dashed ${isDragging ? 'var(--primary)' : '#cbd5e1'}`,
              backgroundColor: isDragging ? '#f0f9ff' : 'white',
              borderRadius: '16px',
              padding: '3rem 2rem',
              textAlign: 'center',
              transition: 'all 0.2s',
              cursor: 'pointer',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              accept={importMode === 'xml' ? '.xml, text/xml' : importMode === 'csv' ? '.csv, text/csv' : '.pdf, application/pdf'} 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              style={{ display: 'none' }} 
            />
            {isParsing ? (
              <Loader2 size={48} className="animate-spin" style={{ color: 'var(--primary)', margin: '0 auto 1rem' }} />
            ) : importMode === 'xml' ? (
              <UploadCloud size={48} style={{ color: isDragging ? 'var(--primary)' : '#94a3b8', margin: '0 auto 1rem' }} />
            ) : importMode === 'csv' ? (
              <FileSpreadsheet size={48} style={{ color: isDragging ? 'var(--primary)' : '#94a3b8', margin: '0 auto 1rem' }} />
            ) : (
              <FileText size={48} style={{ color: isDragging ? 'var(--primary)' : '#94a3b8', margin: '0 auto 1rem' }} />
            )}
            <h3 style={{ fontSize: '1.125rem', fontWeight: '800', marginBottom: '0.5rem' }}>
              {isParsing ? 'Analizando archivo...' : importMode === 'xml' ? 'Sube tu factura XML' : importMode === 'csv' ? 'Sube tu plantilla CSV' : 'Sube tu factura PDF'}
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

              {/* Proveedor de la Factura Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', marginTop: '0.5rem' }}>
                <div className="form-group">
                  <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Proveedor de la Factura (Automático)</label>
                  <div style={{ padding: '0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', backgroundColor: supplierData ? '#f0fdf4' : '#f8fafc', width: '100%', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {supplierData ? (
                      <>
                        <div style={{ fontWeight: '800', color: '#166534' }}>{supplierData.razon_social}</div>
                        <div style={{ fontSize: '0.85rem', color: '#15803d' }}>NIT: {supplierData.nit}</div>
                        <div style={{ fontSize: '0.75rem', marginLeft: 'auto', backgroundColor: '#dcfce7', padding: '0.2rem 0.5rem', borderRadius: '4px', color: '#166534', fontWeight: '700' }}>Se registrará en el Maestro</div>
                      </>
                    ) : (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>No se detectó proveedor en el archivo.</div>
                    )}
                  </div>
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
                      <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textAlign: 'right' }}>RENDIMIENTO</th>
                      <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '800', color: '#0ea5e9', textAlign: 'right' }}>METROS CALC.</th>
                      <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--primary)', textAlign: 'right' }}>CAPAS EST.</th>
                      <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textAlign: 'right' }}>COSTO U.</th>
                      <th style={{ padding: '1rem 1.5rem' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedItems.map((item, idx) => {
                      const rowYield = item.rendimiento !== undefined ? item.rendimiento : (parseFloat(globalYield) || 3.5);
                      return (
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
                        <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                          <input type="number" step="0.01" value={item.rendimiento !== undefined ? item.rendimiento : globalYield} onChange={e => handleUpdateItem(idx, 'rendimiento', parseFloat(e.target.value) || 0)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', width: '80px', textAlign: 'right', fontWeight: '700' }} />
                        </td>
                        <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontWeight: '800', color: '#0ea5e9' }}>
                          {(item.cantidad_factura * rowYield).toFixed(2)}
                        </td>
                        <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontWeight: '900', color: 'var(--primary)' }}>
                          {((item.cantidad_factura * rowYield) / (parseFloat(globalLargo) || 1)).toFixed(2)}
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
                      );
                    })}
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
      )}

      {/* Modal de Detalle de Telas de la Factura */}
      {selectedInvoiceForModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(8px)',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '850px',
            maxHeight: '85vh',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid #cbd5e1',
            animation: 'scaleUp 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc'
            }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Layers size={22} style={{ color: 'var(--primary)' }} /> Telas en Factura: {selectedInvoiceForModal}
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.8rem', margin: '0.25rem 0 0 0', fontWeight: '500' }}>Listado maestro de telas cargadas bajo este comprobante.</p>
              </div>
              <button 
                onClick={() => setSelectedInvoiceForModal(null)} 
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: '50%',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = '#e2e8f0'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              {isLoadingFabricsModal ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', gap: '1rem' }}>
                  <Loader2 size={36} className="animate-spin" style={{ color: 'var(--primary)' }} />
                  <p style={{ color: '#64748b', fontWeight: '700', fontSize: '0.9rem' }}>Consultando base de datos...</p>
                </div>
              ) : fabricsInModal.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#64748b', padding: '2rem 0', fontWeight: '600' }}>No se encontraron telas asociadas a esta factura.</p>
              ) : (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                        <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>Código</th>
                        <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>Nombre / Descripción</th>
                        <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', textAlign: 'right' }}>Kilos</th>
                        <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', textAlign: 'right' }}>Metros Est.</th>
                        <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', textAlign: 'right' }}>Capas Est.</th>
                        <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', textAlign: 'right' }}>Costo Unitario</th>
                        <th style={{ padding: '0.75rem 1rem', fontSize: '0.7rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', textAlign: 'right' }}>Costo + IVA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fabricsInModal.map((fabric, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: index % 2 === 0 ? 'white' : '#f8fafc' }}>
                          <td style={{ padding: '0.85rem 1rem', fontWeight: '800', color: '#0f172a' }}>{fabric.codigo_tela}</td>
                          <td style={{ padding: '0.85rem 1rem', color: '#334155', fontWeight: '500' }}>{fabric.nombre_tela}</td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: '700' }}>{(fabric.kilos || 0).toLocaleString()} kg</td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: '800', color: '#0ea5e9' }}>{fabric.metros ? Number(fabric.metros).toFixed(2) : ((fabric.kilos || 0) * (parseFloat(globalYield) || 3.5)).toFixed(2)}</td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: '700', color: 'var(--primary)' }}>{fabric.capas ? Number(fabric.capas).toFixed(2) : '0.00'}</td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: '600' }}>${(fabric.costo_unitario || 0).toLocaleString('es-CO')}</td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: '700', color: '#16a34a' }}>${Math.round(fabric.costo_con_iva || (fabric.costo_unitario * 1.19)).toLocaleString('es-CO')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc'
            }}>
              <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', color: '#475569', fontWeight: '700' }}>
                <span>Total Items: <strong style={{ color: '#0f172a' }}>{fabricsInModal.length}</strong></span>
                <span>Kilos Totales: <strong style={{ color: 'var(--primary)' }}>{fabricsInModal.reduce((sum, f) => sum + (f.kilos || 0), 0).toFixed(1)} kg</strong></span>
              </div>
              <button 
                onClick={() => setSelectedInvoiceForModal(null)} 
                className="btn btn-secondary"
                style={{ padding: '0.625rem 1.25rem', fontSize: '0.85rem', fontWeight: '800' }}
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
