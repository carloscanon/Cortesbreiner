'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Camera,
  CameraOff,
  Flashlight,
  FlipHorizontal,
  Volume2,
  VolumeX,
  Vibrate,
  VibrateOff,
  RotateCcw,
  Plus,
  Download,
  Share2,
  Trash2,
  FileText,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  History,
  Settings,
  X,
  Search,
  Wifi,
  WifiOff,
  Copy,
  ChevronDown,
  ChevronUp,
  Layers,
  ArrowRight,
  ExternalLink,
  Barcode
} from 'lucide-react';

export type ScanMode = 'all' | 'grouped';
export type CaptureMethod = 'camera' | 'manual';

export interface ScanRecord {
  id: string;
  consecutivo: number;
  codigo_barras: string;
  fecha_hora: string;
  metodo: CaptureMethod;
  cantidad: number;
}

export interface ScannerSession {
  id: string;
  nombre: string;
  fecha_creacion: string;
  modo: ScanMode;
  registros: ScanRecord[];
}

const STORAGE_SESSION_KEY = 'CB_BARCODE_SCANNER_SESSION_V1';
const STORAGE_HISTORY_KEY = 'CB_BARCODE_SCANNER_HISTORY_V1';
const STORAGE_CONFIG_KEY = 'CB_BARCODE_SCANNER_CONFIG_V1';

function formatCurrentDateTime(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function getFileTimestamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export default function MobileBarcodeScannerPage() {
  // Session & records state
  const [session, setSession] = useState<ScannerSession>({
    id: `ses_${Date.now()}`,
    nombre: `Sesión ${new Date().toLocaleDateString('es-CO')}`,
    fecha_creacion: formatCurrentDateTime(),
    modo: 'all',
    registros: []
  });

  // Camera & scanner state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'scanning' | 'paused' | 'error' | 'denied'>('idle');
  const [cameraErrorMessage, setCameraErrorMessage] = useState('');
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorchCapability, setHasTorchCapability] = useState(false);

  // User preferences
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [cooldownSeconds, setCooldownSeconds] = useState(1.5);

  // UI state
  const [scanFlash, setScanFlash] = useState(false);
  const [lastScannedRecord, setLastScannedRecord] = useState<ScanRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOnline, setIsOnline] = useState(true);

  // Modals
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualCodeInput, setManualCodeInput] = useState('');
  const [manualQuantityInput, setManualQuantityInput] = useState('1');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'txt' | 'csv'>('txt');
  const [exportScope, setExportScope] = useState<'all' | 'unique'>('all');
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareStatus, setShareStatus] = useState<{ type: 'ready' | 'success' | 'fallback' | 'error'; message: string; downloadedFile?: string }>({
    type: 'ready',
    message: ''
  });
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<ScannerSession[]>([]);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Scanner references
  const html5QrcodeRef = useRef<any>(null);
  const lastScanTimestampRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const isPausedRef = useRef(false);

  // Sync isPausedRef with cameraState
  useEffect(() => {
    isPausedRef.current = cameraState === 'paused';
  }, [cameraState]);

  // Online / offline detector
  useEffect(() => {
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load preferences and session from localStorage
  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem(STORAGE_CONFIG_KEY);
      if (savedConfig) {
        const parsedCfg = JSON.parse(savedConfig);
        if (parsedCfg.soundEnabled !== undefined) setSoundEnabled(parsedCfg.soundEnabled);
        if (parsedCfg.vibrationEnabled !== undefined) setVibrationEnabled(parsedCfg.vibrationEnabled);
        if (parsedCfg.cooldownSeconds !== undefined) setCooldownSeconds(parsedCfg.cooldownSeconds);
      }

      const savedSession = localStorage.getItem(STORAGE_SESSION_KEY);
      if (savedSession) {
        const parsedSes: ScannerSession = JSON.parse(savedSession);
        if (parsedSes && Array.isArray(parsedSes.registros)) {
          setSession(parsedSes);
          if (parsedSes.registros.length > 0) {
            setLastScannedRecord(parsedSes.registros[parsedSes.registros.length - 1]);
          }
        }
      }

      const savedHistory = localStorage.getItem(STORAGE_HISTORY_KEY);
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        if (Array.isArray(parsedHistory)) setSessionHistory(parsedHistory);
      }
    } catch (e) {
      console.warn('Error reading local storage:', e);
    }
  }, []);

  // Save session changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    } catch (e) {
      console.warn('Error saving session to local storage:', e);
    }
  }, [session]);

  // Save preferences
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify({ soundEnabled, vibrationEnabled, cooldownSeconds }));
    } catch (e) {
      console.warn('Error saving config:', e);
    }
  }, [soundEnabled, vibrationEnabled, cooldownSeconds]);

  // Audio Beep generator via Web Audio API (zero external assets needed)
  const triggerAudioBeep = (frequency = 1850, duration = 0.08) => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration + 0.01);
    } catch (e) {
      console.warn('Audio synthesis failed:', e);
    }
  };

  // Haptic feedback
  const triggerHaptic = (pattern: number | number[] = 75) => {
    if (!vibrationEnabled || typeof window === 'undefined') return;
    try {
      if (navigator && navigator.vibrate) {
        navigator.vibrate(pattern);
      }
    } catch (e) {
      // Ignore vibration error
    }
  };

  // Add scan record logic
  const handleProcessBarcode = (rawCode: string, method: CaptureMethod = 'camera', customQty = 1) => {
    const code = String(rawCode).trim();
    if (!code) return;

    // Check anti-duplicate cooldown for camera reads
    const now = Date.now();
    if (method === 'camera') {
      if (lastScanTimestampRef.current.code === code && now - lastScanTimestampRef.current.time < cooldownSeconds * 1000) {
        return; // Ignore duplicate within cooldown
      }
      lastScanTimestampRef.current = { code, time: now };
    }

    // Feedback
    setScanFlash(true);
    setTimeout(() => setScanFlash(false), 300);
    triggerAudioBeep();
    triggerHaptic(method === 'camera' ? 70 : [40, 30, 40]);

    setSession((prev) => {
      const nowStr = formatCurrentDateTime();
      let updatedRegistros: ScanRecord[] = [];

      if (prev.modo === 'grouped') {
        // Grouped mode: check if barcode exists
        const existingIdx = prev.registros.findIndex((r) => r.codigo_barras === code);
        if (existingIdx >= 0) {
          updatedRegistros = [...prev.registros];
          const current = updatedRegistros[existingIdx];
          const updatedRecord: ScanRecord = {
            ...current,
            cantidad: current.cantidad + (customQty || 1),
            fecha_hora: nowStr
          };
          updatedRegistros[existingIdx] = updatedRecord;
          setLastScannedRecord(updatedRecord);
          return { ...prev, registros: updatedRegistros };
        }
      }

      // Default or new grouped record
      const newRecord: ScanRecord = {
        id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        consecutivo: prev.registros.length + 1,
        codigo_barras: code,
        fecha_hora: nowStr,
        metodo: method,
        cantidad: customQty || 1
      };

      updatedRegistros = [...prev.registros, newRecord];
      setLastScannedRecord(newRecord);
      return { ...prev, registros: updatedRegistros };
    });
  };

  // Camera initialization and stop
  const stopCamera = async () => {
    if (html5QrcodeRef.current) {
      try {
        if (html5QrcodeRef.current.isScanning) {
          await html5QrcodeRef.current.stop();
        }
        await html5QrcodeRef.current.clear();
      } catch (err) {
        console.warn('Error stopping html5Qrcode:', err);
      }
      html5QrcodeRef.current = null;
    }
    setIsCameraActive(false);
    setCameraState('idle');
    setIsTorchOn(false);
    setHasTorchCapability(false);
  };

  const startCamera = async (deviceIdToUse?: string) => {
    setCameraState('starting');
    setCameraErrorMessage('');

    try {
      // Dynamic import of html5-qrcode
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');

      // Stop previous instance if any
      if (html5QrcodeRef.current) {
        try {
          if (html5QrcodeRef.current.isScanning) {
            await html5QrcodeRef.current.stop();
          }
        } catch {
          // ignore
        }
      }

      // Check available cameras
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setAvailableCameras(devices.map((d) => ({ id: d.id, label: d.label || `Cámara ${d.id.substring(0, 5)}` })));
          if (!deviceIdToUse && !selectedCameraId) {
            // Find environment camera if possible
            const backCam = devices.find((d) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('trasera') || d.label.toLowerCase().includes('environment'));
            const chosenId = backCam ? backCam.id : devices[devices.length - 1].id;
            setSelectedCameraId(chosenId);
            deviceIdToUse = chosenId;
          }
        }
      } catch (camErr) {
        console.warn('Could not list cameras, will use facingMode default', camErr);
      }

      const scannerId = 'barcode-reader-view';
      const scanner = new Html5Qrcode(scannerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.QR_CODE
        ],
        verbose: false
      });

      html5QrcodeRef.current = scanner;

      const cameraConstraint = deviceIdToUse || selectedCameraId || { facingMode: 'environment' };

      const qrConfig = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          // Landscape horizontal box for barcodes
          const w = Math.floor(viewfinderWidth * 0.85);
          const h = Math.floor(Math.min(viewfinderHeight * 0.45, 180));
          return { width: Math.max(w, 220), height: Math.max(h, 110) };
        },
        aspectRatio: 1.0,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      };

      await scanner.start(
        cameraConstraint,
        qrConfig,
        (decodedText: string) => {
          if (!isPausedRef.current) {
            handleProcessBarcode(decodedText, 'camera');
          }
        },
        () => {
          // Frame error (no barcode detected in frame) - ignore silently
        }
      );

      setIsCameraActive(true);
      setCameraState('scanning');

      // Check flashlight torch support
      try {
        const capabilities = scanner.getRunningTrackCapabilities();
        if (capabilities && (capabilities as any).torch) {
          setHasTorchCapability(true);
        }
      } catch {
        setHasTorchCapability(false);
      }
    } catch (err: any) {
      console.error('Camera start error:', err);
      const errMsg = err?.message || String(err);
      if (errMsg.includes('NotAllowedError') || errMsg.includes('Permission denied')) {
        setCameraState('denied');
        setCameraErrorMessage('Permiso de cámara denegado. Concede permiso en el navegador para escanear.');
      } else {
        setCameraState('error');
        setCameraErrorMessage(`No se pudo iniciar la cámara: ${errMsg}`);
      }
      setIsCameraActive(false);
    }
  };

  const togglePauseScanning = () => {
    if (cameraState === 'scanning') {
      setCameraState('paused');
    } else if (cameraState === 'paused') {
      setCameraState('scanning');
    }
  };

  const toggleTorch = async () => {
    if (!html5QrcodeRef.current || !hasTorchCapability) return;
    try {
      const nextState = !isTorchOn;
      await html5QrcodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState }]
      });
      setIsTorchOn(nextState);
    } catch (e) {
      console.warn('Torch toggle error:', e);
    }
  };

  // Switch camera
  const handleSwitchCamera = async () => {
    if (availableCameras.length <= 1) return;
    const currentIdx = availableCameras.findIndex((c) => c.id === selectedCameraId);
    const nextIdx = (currentIdx + 1) % availableCameras.length;
    const nextCameraId = availableCameras[nextIdx].id;
    setSelectedCameraId(nextCameraId);
    await stopCamera();
    await startCamera(nextCameraId);
  };

  // Undo last reading
  const handleUndoLastScan = () => {
    if (session.registros.length === 0) return;

    setSession((prev) => {
      const updated = [...prev.registros];
      const last = updated[updated.length - 1];

      if (prev.modo === 'grouped' && last.cantidad > 1) {
        // Decrement count
        updated[updated.length - 1] = {
          ...last,
          cantidad: last.cantidad - 1
        };
      } else {
        // Pop last item
        updated.pop();
      }

      setLastScannedRecord(updated.length > 0 ? updated[updated.length - 1] : null);
      return { ...prev, registros: updated };
    });

    triggerAudioBeep(650, 0.1);
    triggerHaptic(40);
  };

  // Delete single record
  const handleDeleteRecord = (id: string) => {
    setSession((prev) => {
      const updated = prev.registros.filter((r) => r.id !== id);
      // Recompute consecutivos
      const renumbered = updated.map((r, i) => ({ ...r, consecutivo: i + 1 }));
      setLastScannedRecord(renumbered.length > 0 ? renumbered[renumbered.length - 1] : null);
      return { ...prev, registros: renumbered };
    });
  };

  // Change mode
  const handleChangeMode = (newMode: ScanMode) => {
    if (newMode === session.modo) return;
    if (session.registros.length > 0) {
      const confirmChange = confirm(
        newMode === 'grouped'
          ? '¿Cambiar a Modo Agrupado? Los registros actuales se consolidarán por código único acumulando sus cantidades.'
          : '¿Cambiar a Modo Registro Individual? Los próximos escaneos generarán una fila por lectura.'
      );
      if (!confirmChange) return;

      if (newMode === 'grouped') {
        // Consolidate current records
        const map = new Map<string, ScanRecord>();
        session.registros.forEach((r) => {
          if (map.has(r.codigo_barras)) {
            const cur = map.get(r.codigo_barras)!;
            cur.cantidad += r.cantidad;
            cur.fecha_hora = r.fecha_hora;
          } else {
            map.set(r.codigo_barras, { ...r });
          }
        });
        const groupedList = Array.from(map.values()).map((r, i) => ({ ...r, consecutivo: i + 1 }));
        setSession((prev) => ({ ...prev, modo: newMode, registros: groupedList }));
        return;
      }
    }
    setSession((prev) => ({ ...prev, modo: newMode }));
  };

  // Manual code addition
  const handleAddManualCode = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = manualCodeInput.trim();
    if (!cleanCode) return;
    const qty = Math.max(1, parseInt(manualQuantityInput) || 1);
    handleProcessBarcode(cleanCode, 'manual', qty);
    setManualCodeInput('');
    setManualQuantityInput('1');
    setShowManualModal(false);
  };

  // Start new session
  const handleStartNewSession = () => {
    if (session.registros.length > 0) {
      // Archive current session
      const updatedHistory = [session, ...sessionHistory.slice(0, 19)];
      setSessionHistory(updatedHistory);
      try {
        localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(updatedHistory));
      } catch (e) {
        console.warn('Error saving history:', e);
      }
    }

    const newSession: ScannerSession = {
      id: `ses_${Date.now()}`,
      nombre: `Sesión ${new Date().toLocaleDateString('es-CO')} ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`,
      fecha_creacion: formatCurrentDateTime(),
      modo: session.modo,
      registros: []
    };

    setSession(newSession);
    setLastScannedRecord(null);
    setShowNewSessionModal(false);
    triggerAudioBeep(1200, 0.08);
  };

  // Restore history session
  const handleLoadArchivedSession = (archived: ScannerSession) => {
    if (confirm(`¿Cargar la sesión "${archived.nombre}" del ${archived.fecha_creacion}? Los registros no guardados de la sesión actual se archivarán.`)) {
      if (session.registros.length > 0) {
        const updatedHistory = [session, ...sessionHistory.filter((s) => s.id !== archived.id).slice(0, 19)];
        setSessionHistory(updatedHistory);
        localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(updatedHistory));
      }
      setSession(archived);
      setLastScannedRecord(archived.registros.length > 0 ? archived.registros[archived.registros.length - 1] : null);
      setShowHistoryModal(false);
    }
  };

  // Computed summary
  const totalReadingsCount = useMemo(() => {
    return session.registros.reduce((acc, curr) => acc + (curr.cantidad || 1), 0);
  }, [session.registros]);

  const uniqueCodesCount = useMemo(() => {
    const set = new Set(session.registros.map((r) => r.codigo_barras));
    return set.size;
  }, [session.registros]);

  const filteredRegistros = useMemo(() => {
    if (!searchQuery.trim()) return [...session.registros].reverse();
    const q = searchQuery.toLowerCase().trim();
    return session.registros.filter((r) => r.codigo_barras.toLowerCase().includes(q) || String(r.consecutivo).includes(q)).reverse();
  }, [session.registros, searchQuery]);

  // File generation helpers (TXT and CSV)
  const generateFileContent = (format: 'txt' | 'csv', scope: 'all' | 'unique') => {
    if (session.registros.length === 0) return { content: '', filename: '', mimeType: '' };

    const timestamp = getFileTimestamp();
    const filename = `escaneo_${timestamp}.${format}`;

    if (format === 'txt') {
      let lines: string[] = [];
      if (scope === 'unique') {
        const uniqueSet = new Set(session.registros.map((r) => r.codigo_barras));
        lines = Array.from(uniqueSet);
      } else {
        session.registros.forEach((r) => {
          const qty = r.cantidad || 1;
          for (let i = 0; i < qty; i++) {
            lines.push(r.codigo_barras);
          }
        });
      }
      return {
        content: lines.join('\r\n'),
        filename,
        mimeType: 'text/plain;charset=utf-8'
      };
    } else {
      // CSV format
      const header = 'consecutivo,codigo_barras,fecha_hora,metodo,cantidad\r\n';
      let rows: string[] = [];

      if (scope === 'unique') {
        const map = new Map<string, { fecha: string; metodo: string; totalQty: number }>();
        session.registros.forEach((r) => {
          if (map.has(r.codigo_barras)) {
            const item = map.get(r.codigo_barras)!;
            item.totalQty += r.cantidad || 1;
            item.fecha = r.fecha_hora;
          } else {
            map.set(r.codigo_barras, { fecha: r.fecha_hora, metodo: r.metodo, totalQty: r.cantidad || 1 });
          }
        });

        let idx = 1;
        map.forEach((val, code) => {
          rows.push(`${idx},"${code}",${val.fecha},${val.metodo},${val.totalQty}`);
          idx++;
        });
      } else {
        session.registros.forEach((r) => {
          rows.push(`${r.consecutivo},"${r.codigo_barras}",${r.fecha_hora},${r.metodo},${r.cantidad}`);
        });
      }

      // Add UTF-8 BOM so Excel opens it with perfect character and leading zero preservation
      const bom = '\uFEFF';
      return {
        content: bom + header + rows.join('\r\n'),
        filename,
        mimeType: 'text/csv;charset=utf-8'
      };
    }
  };

  const handleDownloadFile = () => {
    if (session.registros.length === 0) {
      alert('No hay lecturas registradas para exportar.');
      return;
    }
    const { content, filename, mimeType } = generateFileContent(exportFormat, exportScope);
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  // WhatsApp sharing logic
  const handleShareToWhatsApp = async (chosenFormat: 'txt' | 'csv' = exportFormat) => {
    if (session.registros.length === 0) {
      alert('No hay lecturas registradas para compartir.');
      return;
    }

    const { content, filename, mimeType } = generateFileContent(chosenFormat, exportScope);
    const blob = new Blob([content], { type: mimeType });
    const file = new File([blob], filename, { type: mimeType.split(';')[0] });

    setShowShareModal(true);

    // 1. Try Web Share API Level 2 (with files)
    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `Escaneo de Códigos (${filename})`,
          text: `📦 Archivo de códigos de barras (${totalReadingsCount} lecturas, ${uniqueCodesCount} únicos). ${session.nombre}`
        });
        setShareStatus({
          type: 'success',
          message: 'Se abrió el menú de compartir de tu dispositivo. Selecciona WhatsApp para enviar el archivo directamente.'
        });
        return;
      } catch (shareErr: any) {
        if (shareErr.name === 'AbortError') {
          // User canceled share sheet
          setShowShareModal(false);
          return;
        }
        console.warn('Web Share API error:', shareErr);
      }
    }

    // 2. Fallback: Automatically download file and offer WhatsApp direct link with summary
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (dlErr) {
      console.warn('Fallback download error:', dlErr);
    }

    setShareStatus({
      type: 'fallback',
      downloadedFile: filename,
      message: `El archivo ${filename} se ha descargado en tu dispositivo. Puedes adjuntarlo en WhatsApp usando el ícono de clip 📎 o enviar el resumen de texto.`
    });
  };

  const getWhatsAppMessageText = () => {
    const sample = session.registros.slice(-10).map((r) => `• ${r.codigo_barras}${r.cantidad > 1 ? ` (x${r.cantidad})` : ''}`).join('%0A');
    return `📦 *REPORTE DE ESCANEO DE CÓDIGOS*%0A*Sesión:* ${encodeURIComponent(session.nombre)}%0A*Total lecturas:* ${totalReadingsCount}%0A*Códigos únicos:* ${uniqueCodesCount}%0A*Fecha:* ${encodeURIComponent(session.fecha_creacion)}%0A%0A*Últimas lecturas:*%0A${sample}%0A%0A_Adjunto archivo descargado para listado completo._`;
  };

  const copyBarcodesToClipboard = () => {
    const list = session.registros.map((r) => `${r.codigo_barras}${r.cantidad > 1 ? `\t${r.cantidad}` : ''}`).join('\n');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(list).then(() => {
        alert('Códigos copiados al portapapeles.');
      });
    }
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="scanner-standalone-container" style={{ minHeight: '100vh', backgroundColor: '#090d16', color: '#f8fafc', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* TOP HEADER */}
      <header style={{ padding: '0.85rem 1rem', backgroundColor: '#0f172a', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 30, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 12px rgba(2,132,199,0.5)' }}>
            <Barcode size={22} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '900', letterSpacing: '-0.02em', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              Escáner Móvil
              {isOnline ? (
                <span title="Conectado a Internet" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.65rem', color: '#4ade80', fontWeight: '700', padding: '0.1rem 0.35rem', backgroundColor: '#14532d40', borderRadius: '4px' }}>
                  <Wifi size={10} /> Online
                </span>
              ) : (
                <span title="Modo sin conexión activo" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.65rem', color: '#facc15', fontWeight: '700', padding: '0.1rem 0.35rem', backgroundColor: '#713f1240', borderRadius: '4px' }}>
                  <WifiOff size={10} /> Offline
                </span>
              )}
            </h1>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
              {session.nombre}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {/* Audio toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Sonido activado' : 'Sonido silenciado'}
            style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: soundEnabled ? '#1e293b' : '#0f172a', color: soundEnabled ? '#38bdf8' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>

          {/* History modal */}
          <button
            onClick={() => setShowHistoryModal(true)}
            title="Historial de sesiones"
            style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <History size={18} />
          </button>

          {/* Settings modal */}
          <button
            onClick={() => setShowSettingsModal(true)}
            title="Ajustes de escaneo"
            style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* MODE SELECTOR BANNER */}
      <div style={{ padding: '0.5rem 1rem', backgroundColor: '#0b1324', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Modalidad:
        </span>
        <div style={{ display: 'flex', backgroundColor: '#1e293b', padding: '2px', borderRadius: '8px', border: '1px solid #334155' }}>
          <button
            onClick={() => handleChangeMode('all')}
            style={{
              padding: '0.3rem 0.65rem',
              borderRadius: '6px',
              border: 'none',
              fontSize: '0.72rem',
              fontWeight: '850',
              cursor: 'pointer',
              backgroundColor: session.modo === 'all' ? '#0284c7' : 'transparent',
              color: session.modo === 'all' ? '#ffffff' : '#94a3b8',
              transition: 'all 0.15s ease'
            }}
          >
            📋 Registrar Todas
          </button>
          <button
            onClick={() => handleChangeMode('grouped')}
            style={{
              padding: '0.3rem 0.65rem',
              borderRadius: '6px',
              border: 'none',
              fontSize: '0.72rem',
              fontWeight: '850',
              cursor: 'pointer',
              backgroundColor: session.modo === 'grouped' ? '#059669' : 'transparent',
              color: session.modo === 'grouped' ? '#ffffff' : '#94a3b8',
              transition: 'all 0.15s ease'
            }}
          >
            🔢 Agrupar Duplicados
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '0.85rem', maxWidth: '640px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        
        {/* CAMERA VIEWFINDER CARD */}
        <div style={{
          position: 'relative',
          borderRadius: '16px',
          overflow: 'hidden',
          backgroundColor: '#020617',
          border: scanFlash ? '3px solid #22c55e' : (isCameraActive ? '2px solid #0284c7' : '2px dashed #334155'),
          boxShadow: scanFlash ? '0 0 25px rgba(34,197,94,0.6)' : '0 10px 25px rgba(0,0,0,0.5)',
          transition: 'border 0.2s ease, box-shadow 0.2s ease',
          minHeight: isCameraActive ? '260px' : '180px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          {/* HTML5 QRCODE CONTAINER */}
          <div
            id="barcode-reader-view"
            style={{
              width: '100%',
              display: isCameraActive ? 'block' : 'none',
              minHeight: '260px'
            }}
          />

          {/* CAMERA STATUS OVERLAY WHEN INACTIVE */}
          {!isCameraActive && (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Camera size={28} color="#64748b" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '850', color: '#f8fafc' }}>
                  {cameraState === 'denied' ? 'Permiso de Cámara Denegado' : 'Cámara en Espera'}
                </h3>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', color: '#94a3b8', maxWidth: '280px' }}>
                  {cameraState === 'denied'
                    ? cameraErrorMessage
                    : 'Apunta con la cámara de tu celular a códigos EAN, UPC, Code 128 o Code 39.'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => startCamera()}
                  style={{
                    padding: '0.75rem 1.4rem',
                    borderRadius: '12px',
                    border: 'none',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    fontWeight: '900',
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 14px rgba(2,132,199,0.4)'
                  }}
                >
                  <Camera size={18} />
                  Iniciar Escaneo con Cámara
                </button>

                <button
                  type="button"
                  onClick={() => setShowManualModal(true)}
                  style={{
                    padding: '0.75rem 1.1rem',
                    borderRadius: '12px',
                    border: '1.5px solid #334155',
                    backgroundColor: '#1e293b',
                    color: '#f8fafc',
                    fontWeight: '850',
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <Plus size={18} />
                  Ingreso Manual
                </button>
              </div>
            </div>
          )}

          {/* ACTIVE CAMERA CONTROLS OVERLAY */}
          {isCameraActive && (
            <>
              {/* LASER LINE ANIMATION */}
              {cameraState === 'scanning' && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '10%',
                  right: '10%',
                  height: '2px',
                  backgroundColor: '#ef4444',
                  boxShadow: '0 0 10px #ef4444, 0 0 20px #ef4444',
                  pointerEvents: 'none',
                  zIndex: 10
                }} />
              )}

              {/* TOP BAR OVERLAY */}
              <div style={{
                position: 'absolute',
                top: '0.6rem',
                left: '0.6rem',
                right: '0.6rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                zIndex: 15,
                pointerEvents: 'auto'
              }}>
                <span style={{
                  padding: '0.25rem 0.6rem',
                  borderRadius: '20px',
                  fontSize: '0.7rem',
                  fontWeight: '850',
                  backgroundColor: cameraState === 'paused' ? 'rgba(234,179,8,0.85)' : 'rgba(34,197,94,0.85)',
                  color: '#020617',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#020617' }} />
                  {cameraState === 'paused' ? 'En Pausa' : 'Escaneando'}
                </span>

                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {hasTorchCapability && (
                    <button
                      type="button"
                      onClick={toggleTorch}
                      title={isTorchOn ? 'Apagar linterna' : 'Encender linterna'}
                      style={{
                        padding: '0.4rem',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: isTorchOn ? '#facc15' : 'rgba(15,23,42,0.85)',
                        color: isTorchOn ? '#020617' : '#f8fafc',
                        cursor: 'pointer'
                      }}
                    >
                      <Flashlight size={16} />
                    </button>
                  )}

                  {availableCameras.length > 1 && (
                    <button
                      type="button"
                      onClick={handleSwitchCamera}
                      title="Cambiar cámara"
                      style={{
                        padding: '0.4rem',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: 'rgba(15,23,42,0.85)',
                        color: '#f8fafc',
                        cursor: 'pointer'
                      }}
                    >
                      <FlipHorizontal size={16} />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={stopCamera}
                    title="Detener cámara"
                    style={{
                      padding: '0.4rem',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: 'rgba(239,68,68,0.85)',
                      color: '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    <CameraOff size={16} />
                  </button>
                </div>
              </div>

              {/* BOTTOM BAR OVERLAY WITH QUICK PAUSE */}
              <div style={{
                position: 'absolute',
                bottom: '0.6rem',
                left: '0.6rem',
                right: '0.6rem',
                display: 'flex',
                justifyContent: 'center',
                zIndex: 15
              }}>
                <button
                  type="button"
                  onClick={togglePauseScanning}
                  style={{
                    padding: '0.4rem 1rem',
                    borderRadius: '20px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    backgroundColor: cameraState === 'paused' ? '#16a34a' : 'rgba(15,23,42,0.85)',
                    color: '#ffffff',
                    fontWeight: '800',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    backdropFilter: 'blur(4px)',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.5)'
                  }}
                >
                  {cameraState === 'paused' ? '▶️ Reanudar Lectura' : '⏸️ Pausar Cámara'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* ONE-HANDED QUICK ACTIONS ROW */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setShowManualModal(true)}
            style={{
              padding: '0.75rem',
              borderRadius: '12px',
              border: '1.5px solid #334155',
              backgroundColor: '#131b2e',
              color: '#f8fafc',
              fontWeight: '850',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem'
            }}
          >
            <Plus size={16} color="#38bdf8" />
            Ingreso Manual
          </button>

          <button
            type="button"
            onClick={handleUndoLastScan}
            disabled={session.registros.length === 0}
            style={{
              padding: '0.75rem',
              borderRadius: '12px',
              border: '1.5px solid #334155',
              backgroundColor: session.registros.length === 0 ? '#0b1324' : '#131b2e',
              color: session.registros.length === 0 ? '#475569' : '#f87171',
              fontWeight: '850',
              fontSize: '0.85rem',
              cursor: session.registros.length === 0 ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem'
            }}
          >
            <RotateCcw size={16} />
            Deshacer Última
          </button>
        </div>

        {/* STATS & LAST SCAN DISPLAY CARD */}
        <div style={{
          padding: '1rem',
          borderRadius: '16px',
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          {/* Counters Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div style={{
              padding: '0.75rem',
              borderRadius: '12px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                Total Lecturas
              </span>
              <span style={{ fontSize: '1.6rem', fontWeight: '950', color: '#38bdf8' }}>
                {totalReadingsCount}
              </span>
            </div>

            <div style={{
              padding: '0.75rem',
              borderRadius: '12px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                Códigos Únicos
              </span>
              <span style={{ fontSize: '1.6rem', fontWeight: '950', color: '#4ade80' }}>
                {uniqueCodesCount}
              </span>
            </div>
          </div>

          {/* Last Scanned Code Spotlight */}
          <div style={{
            padding: '0.85rem 1rem',
            borderRadius: '12px',
            backgroundColor: lastScannedRecord ? 'rgba(56,189,248,0.08)' : '#1e293b',
            border: lastScannedRecord ? '1.5px solid #0284c7' : '1px dashed #334155',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <span style={{ fontSize: '0.68rem', color: '#38bdf8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
                Última Lectura Confirmada
              </span>
              <span style={{ fontSize: '1.15rem', fontWeight: '900', color: '#f8fafc', fontFamily: 'monospace', letterSpacing: '0.04em' }}>
                {lastScannedRecord ? lastScannedRecord.codigo_barras : '— Ninguno aún —'}
              </span>
              {lastScannedRecord && (
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginTop: '0.1rem' }}>
                  {lastScannedRecord.fecha_hora} • {lastScannedRecord.metodo === 'camera' ? '📷 Cámara' : '⌨️ Manual'}
                </span>
              )}
            </div>

            {lastScannedRecord && (
              <span style={{
                padding: '0.25rem 0.55rem',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: '900',
                backgroundColor: '#0284c7',
                color: '#ffffff'
              }}>
                x{lastScannedRecord.cantidad}
              </span>
            )}
          </div>
        </div>

        {/* RECORDS LIST CONTAINER */}
        <div style={{
          borderRadius: '16px',
          backgroundColor: '#0f172a',
          border: '1px solid #1e293b',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          flex: 1,
          minHeight: '220px'
        }}>
          {/* List Search & Header */}
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                type="text"
                placeholder="Buscar código o consecutivo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem 0.45rem 2rem',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  backgroundColor: '#1e293b',
                  color: '#f8fafc',
                  fontSize: '0.8rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '800' }}>
              {filteredRegistros.length} registros
            </span>
          </div>

          {/* List Content */}
          <div style={{ overflowY: 'auto', maxHeight: '320px', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {filteredRegistros.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                <Barcode size={36} color="#334155" style={{ margin: '0 auto 0.5rem' }} />
                {session.registros.length === 0
                  ? 'No hay códigos escaneados todavía. Apunta con la cámara o ingresa un código manualmente.'
                  : 'No se encontraron coincidencias para la búsqueda.'}
              </div>
            ) : (
              filteredRegistros.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: '10px',
                    backgroundColor: '#131b2e',
                    border: '1px solid #1e293b',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 0 }}>
                    <span style={{
                      padding: '0.2rem 0.4rem',
                      borderRadius: '6px',
                      fontSize: '0.68rem',
                      fontWeight: '900',
                      backgroundColor: '#1e293b',
                      color: '#94a3b8',
                      fontFamily: 'monospace'
                    }}>
                      #{item.consecutivo}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <span style={{
                        display: 'block',
                        fontWeight: '850',
                        fontSize: '0.9rem',
                        color: '#f8fafc',
                        fontFamily: 'monospace',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {item.codigo_barras}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                        {item.fecha_hora.split(' ')[1]} • {item.metodo === 'camera' ? '📷' : '⌨️'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      padding: '0.2rem 0.5rem',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: '900',
                      backgroundColor: item.cantidad > 1 ? '#059669' : '#1e293b',
                      color: item.cantidad > 1 ? '#ffffff' : '#94a3b8'
                    }}>
                      x{item.cantidad}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleDeleteRecord(item.id)}
                      title="Eliminar este registro"
                      style={{
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: '#64748b',
                        padding: '0.25rem',
                        cursor: 'pointer',
                        borderRadius: '6px'
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </main>

      {/* BOTTOM FIXED PRIMARY ACTIONS (THUMB ZONE) */}
      <footer style={{
        position: 'sticky',
        bottom: 0,
        backgroundColor: '#0f172a',
        borderTop: '1px solid #1e293b',
        padding: '0.75rem 1rem',
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr 0.8fr',
        gap: '0.5rem',
        boxShadow: '0 -6px 20px rgba(0,0,0,0.4)',
        zIndex: 25,
        maxWidth: '640px',
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box'
      }}>
        {/* COMPARTIR POR WHATSAPP */}
        <button
          type="button"
          disabled={session.registros.length === 0}
          onClick={() => handleShareToWhatsApp('txt')}
          style={{
            padding: '0.85rem 0.5rem',
            borderRadius: '12px',
            border: 'none',
            backgroundColor: session.registros.length === 0 ? '#1e293b' : '#22c55e',
            color: session.registros.length === 0 ? '#64748b' : '#020617',
            fontWeight: '900',
            fontSize: '0.85rem',
            cursor: session.registros.length === 0 ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            boxShadow: session.registros.length > 0 ? '0 4px 14px rgba(34,197,94,0.35)' : 'none'
          }}
        >
          <Share2 size={18} />
          WhatsApp
        </button>

        {/* EXPORTAR ARCHIVO */}
        <button
          type="button"
          disabled={session.registros.length === 0}
          onClick={() => setShowExportModal(true)}
          style={{
            padding: '0.85rem 0.5rem',
            borderRadius: '12px',
            border: '1.5px solid #334155',
            backgroundColor: '#1e293b',
            color: session.registros.length === 0 ? '#64748b' : '#f8fafc',
            fontWeight: '850',
            fontSize: '0.85rem',
            cursor: session.registros.length === 0 ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem'
          }}
        >
          <Download size={18} color="#38bdf8" />
          Exportar
        </button>

        {/* NUEVA SESIÓN */}
        <button
          type="button"
          onClick={() => setShowNewSessionModal(true)}
          style={{
            padding: '0.85rem 0.5rem',
            borderRadius: '12px',
            border: '1.5px solid #334155',
            backgroundColor: '#131b2e',
            color: '#94a3b8',
            fontWeight: '850',
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem'
          }}
        >
          <RotateCcw size={16} />
          Nueva
        </button>
      </footer>

      {/* ========================================================================= */}
      {/* MODAL 1: INGRESO MANUAL */}
      {/* ========================================================================= */}
      {showManualModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ width: '100%', maxWidth: '520px', backgroundColor: '#0f172a', borderTopLeftRadius: '20px', borderTopRightRadius: '20px', border: '1px solid #334155', padding: '1.25rem', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={20} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '850', color: '#f8fafc' }}>
                  Ingreso Manual de Código
                </h3>
              </div>
              <button onClick={() => setShowManualModal(false)} style={{ border: 'none', backgroundColor: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddManualCode} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  Código de Barras *
                </label>
                <input
                  type="text"
                  autoFocus
                  inputMode="text"
                  placeholder="Digita o pega el código de barras..."
                  value={manualCodeInput}
                  onChange={(e) => setManualCodeInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.85rem',
                    borderRadius: '10px',
                    border: '1.5px solid #0284c7',
                    backgroundColor: '#1e293b',
                    color: '#f8fafc',
                    fontSize: '1.1rem',
                    fontFamily: 'monospace',
                    fontWeight: '800',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  Cantidad a Registrar
                </label>
                <input
                  type="number"
                  min="1"
                  value={manualQuantityInput}
                  onChange={(e) => setManualQuantityInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '10px',
                    border: '1px solid #334155',
                    backgroundColor: '#1e293b',
                    color: '#f8fafc',
                    fontSize: '1rem',
                    fontWeight: '800',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  style={{ flex: 1, padding: '0.85rem', borderRadius: '10px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#94a3b8', fontWeight: '800', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!manualCodeInput.trim()}
                  style={{
                    flex: 2,
                    padding: '0.85rem',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    fontWeight: '900',
                    cursor: manualCodeInput.trim() ? 'pointer' : 'not-allowed',
                    opacity: manualCodeInput.trim() ? 1 : 0.5
                  }}
                >
                  Registrar Código
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EXPORTAR ARCHIVO PLANO (TXT / CSV) */}
      {/* ========================================================================= */}
      {showExportModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(4px)' }}>
          <div style={{ width: '100%', maxWidth: '440px', backgroundColor: '#0f172a', borderRadius: '18px', border: '1px solid #334155', padding: '1.25rem', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Download size={20} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '850', color: '#f8fafc' }}>
                  Exportar Archivo Plano
                </h3>
              </div>
              <button onClick={() => setShowExportModal(false)} style={{ border: 'none', backgroundColor: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Formato selector */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                Formato de Archivo
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setExportFormat('txt')}
                  style={{
                    padding: '0.85rem',
                    borderRadius: '12px',
                    border: exportFormat === 'txt' ? '2px solid #0284c7' : '1px solid #334155',
                    backgroundColor: exportFormat === 'txt' ? 'rgba(2,132,199,0.15)' : '#1e293b',
                    color: exportFormat === 'txt' ? '#38bdf8' : '#94a3b8',
                    fontWeight: '850',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <FileText size={24} />
                  <span>Texto Plano (.TXT)</span>
                  <span style={{ fontSize: '0.65rem', fontWeight: '600', color: '#64748b' }}>Un código por línea</span>
                </button>

                <button
                  type="button"
                  onClick={() => setExportFormat('csv')}
                  style={{
                    padding: '0.85rem',
                    borderRadius: '12px',
                    border: exportFormat === 'csv' ? '2px solid #10b981' : '1px solid #334155',
                    backgroundColor: exportFormat === 'csv' ? 'rgba(16,185,129,0.15)' : '#1e293b',
                    color: exportFormat === 'csv' ? '#34d399' : '#94a3b8',
                    fontWeight: '850',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <FileSpreadsheet size={24} />
                  <span>Excel / CSV (.CSV)</span>
                  <span style={{ fontSize: '0.65rem', fontWeight: '600', color: '#64748b' }}>Estructurado con columnas</span>
                </button>
              </div>
            </div>

            {/* Scope selector */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                Alcance de la Exportación
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.85rem', backgroundColor: '#1e293b', borderRadius: '10px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '750', color: '#f8fafc' }}>
                  <input
                    type="radio"
                    name="scope"
                    checked={exportScope === 'all'}
                    onChange={() => setExportScope('all')}
                  />
                  <span>Todas las lecturas registradas ({totalReadingsCount})</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.85rem', backgroundColor: '#1e293b', borderRadius: '10px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '750', color: '#f8fafc' }}>
                  <input
                    type="radio"
                    name="scope"
                    checked={exportScope === 'unique'}
                    onChange={() => setExportScope('unique')}
                  />
                  <span>Solo códigos únicos ({uniqueCodesCount})</span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#94a3b8', fontWeight: '800', cursor: 'pointer' }}
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={handleDownloadFile}
                style={{
                  flex: 2,
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  fontWeight: '900',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem'
                }}
              >
                <Download size={16} />
                Descargar Archivo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: COMPARTIR POR WHATSAPP Y FALLBACK */}
      {/* ========================================================================= */}
      {showShareModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(4px)' }}>
          <div style={{ width: '100%', maxWidth: '460px', backgroundColor: '#0f172a', borderRadius: '18px', border: '1px solid #334155', padding: '1.25rem', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Share2 size={20} color="#22c55e" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '850', color: '#f8fafc' }}>
                  Compartir por WhatsApp
                </h3>
              </div>
              <button onClick={() => setShowShareModal(false)} style={{ border: 'none', backgroundColor: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Notification message */}
            <div style={{ padding: '0.85rem', borderRadius: '12px', backgroundColor: shareStatus.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(2,132,199,0.15)', border: `1px solid ${shareStatus.type === 'success' ? '#22c55e' : '#0284c7'}` }}>
              <span style={{ fontSize: '0.82rem', color: '#f8fafc', lineHeight: 1.4, display: 'block' }}>
                {shareStatus.message || 'Se ha generado el archivo con las lecturas escaneadas.'}
              </span>
            </div>

            {/* Action options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {/* Button to open WhatsApp directly with prefilled text */}
              <a
                href={`https://api.whatsapp.com/send?text=${getWhatsAppMessageText()}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '0.85rem',
                  borderRadius: '12px',
                  backgroundColor: '#22c55e',
                  color: '#020617',
                  fontWeight: '900',
                  fontSize: '0.85rem',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 12px rgba(34,197,94,0.3)'
                }}
              >
                <ExternalLink size={18} />
                Abrir WhatsApp con Resumen de Códigos
              </a>

              {/* Copy barcodes list to clipboard */}
              <button
                type="button"
                onClick={copyBarcodesToClipboard}
                style={{
                  padding: '0.75rem',
                  borderRadius: '12px',
                  border: '1.5px solid #334155',
                  backgroundColor: '#1e293b',
                  color: '#f8fafc',
                  fontWeight: '850',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem'
                }}
              >
                <Copy size={16} color="#38bdf8" />
                Copiar Códigos al Portapapeles
              </button>
            </div>

            {/* Instructions box */}
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.4, backgroundColor: '#090d16', padding: '0.75rem', borderRadius: '10px', border: '1px solid #1e293b' }}>
              <strong>💡 Cómo adjuntar el archivo completo en WhatsApp:</strong>
              <ol style={{ margin: '0.35rem 0 0', paddingLeft: '1.2rem' }}>
                <li>Abre la conversación o grupo en WhatsApp.</li>
                <li>Toca el ícono de <strong>clip 📎</strong> o <strong>Documento</strong>.</li>
                <li>Selecciona el archivo descargado en la carpeta <strong>Descargas</strong>.</li>
              </ol>
            </div>

            <button
              type="button"
              onClick={() => setShowShareModal(false)}
              style={{ padding: '0.75rem', borderRadius: '10px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#94a3b8', fontWeight: '800', cursor: 'pointer' }}
            >
              Listo / Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: NUEVA SESIÓN DE ESCANEO */}
      {/* ========================================================================= */}
      {showNewSessionModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(4px)' }}>
          <div style={{ width: '100%', maxWidth: '420px', backgroundColor: '#0f172a', borderRadius: '18px', border: '1px solid #334155', padding: '1.25rem', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <RotateCcw size={22} color="#f59e0b" />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '850', color: '#f8fafc' }}>
                ¿Iniciar Nueva Sesión?
              </h3>
            </div>

            <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.4 }}>
              Esta acción archivará los <strong>{session.registros.length} registros</strong> actuales en tu historial local y comenzará una nueva sesión en blanco desde el consecutivo #1.
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setShowNewSessionModal(false)}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#94a3b8', fontWeight: '800', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleStartNewSession}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: 'none', backgroundColor: '#f59e0b', color: '#020617', fontWeight: '900', cursor: 'pointer' }}
              >
                Confirmar y Reiniciar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: HISTORIAL DE SESIONES LOCALES */}
      {/* ========================================================================= */}
      {showHistoryModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(4px)' }}>
          <div style={{ width: '100%', maxWidth: '480px', backgroundColor: '#0f172a', borderRadius: '18px', border: '1px solid #334155', padding: '1.25rem', boxSizing: 'border-box', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <History size={20} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '850', color: '#f8fafc' }}>
                  Sesiones Archivadas ({sessionHistory.length})
                </h3>
              </div>
              <button onClick={() => setShowHistoryModal(false)} style={{ border: 'none', backgroundColor: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.25rem' }}>
              {sessionHistory.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                  No hay sesiones archivadas anteriormente en este dispositivo.
                </div>
              ) : (
                sessionHistory.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '10px',
                      backgroundColor: '#131b2e',
                      border: '1px solid #1e293b',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <span style={{ display: 'block', fontWeight: '850', fontSize: '0.85rem', color: '#f8fafc' }}>
                        {item.nombre}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        {item.fecha_creacion} • {item.registros.length} lecturas
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleLoadArchivedSession(item)}
                      style={{
                        padding: '0.4rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid #0284c7',
                        backgroundColor: 'rgba(2,132,199,0.15)',
                        color: '#38bdf8',
                        fontSize: '0.75rem',
                        fontWeight: '850',
                        cursor: 'pointer'
                      }}
                    >
                      Cargar
                    </button>
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowHistoryModal(false)}
              style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: '10px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#94a3b8', fontWeight: '800', cursor: 'pointer' }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: AJUSTES Y CONFIGURACIÓN */}
      {/* ========================================================================= */}
      {showSettingsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(4px)' }}>
          <div style={{ width: '100%', maxWidth: '440px', backgroundColor: '#0f172a', borderRadius: '18px', border: '1px solid #334155', padding: '1.25rem', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Settings size={20} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '850', color: '#f8fafc' }}>
                  Ajustes del Lector
                </h3>
              </div>
              <button onClick={() => setShowSettingsModal(false)} style={{ border: 'none', backgroundColor: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Audio toggle */}
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                <div>
                  <span style={{ display: 'block', fontWeight: '800', fontSize: '0.85rem', color: '#f8fafc' }}>
                    Sonido de Confirmación (Beep)
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Emite un tono acústico breve al detectar un código
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                />
              </label>

              {/* Vibration toggle */}
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                <div>
                  <span style={{ display: 'block', fontWeight: '800', fontSize: '0.85rem', color: '#f8fafc' }}>
                    Vibración Háptica
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Vibra brevemente el dispositivo al escanear
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={vibrationEnabled}
                  onChange={(e) => setVibrationEnabled(e.target.checked)}
                />
              </label>

              {/* Duplicate debounce cooldown */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ fontWeight: '800', fontSize: '0.85rem', color: '#f8fafc' }}>
                    Pausa Antiduplicados
                  </span>
                  <span style={{ fontWeight: '850', fontSize: '0.8rem', color: '#38bdf8' }}>
                    {cooldownSeconds}s
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.5"
                  value={cooldownSeconds}
                  onChange={(e) => setCooldownSeconds(parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                  Tiempo de espera para evitar leer el mismo código repetidamente.
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowSettingsModal(false)}
              style={{ marginTop: '1.25rem', width: '100%', padding: '0.75rem', borderRadius: '10px', border: 'none', backgroundColor: '#0284c7', color: '#ffffff', fontWeight: '900', cursor: 'pointer' }}
            >
              Guardar Ajustes
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
