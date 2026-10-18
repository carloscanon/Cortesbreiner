'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import bwipjs from 'bwip-js';
import {
  Smartphone,
  Camera,
  CameraOff,
  QrCode,
  X,
  Copy,
  Check,
  Share2,
  Flashlight,
  FlipHorizontal,
  Volume2,
  VolumeX,
  Vibrate,
  Sparkles,
  ShoppingBag,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Keyboard,
  Barcode
} from 'lucide-react';

export interface POSScannedItemRecord {
  barcode: string;
  name?: string;
  time: string;
  success?: boolean;
  message?: string;
}

interface POSCameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => Promise<{ success: boolean; message?: string; productName?: string } | void> | void;
  remoteSessionId: string;
  storeName?: string;
  registerName?: string;
  isPhoneConnected: boolean;
  recentScans: POSScannedItemRecord[];
  cartCount?: number;
}

export default function POSCameraScannerModal({
  isOpen,
  onClose,
  onScan,
  remoteSessionId,
  storeName = 'Tienda Principal',
  registerName = 'Caja 1',
  isPhoneConnected,
  recentScans,
  cartCount = 0
}: POSCameraScannerModalProps) {
  const [activeTab, setActiveTab] = useState<'remote' | 'direct'>('remote');
  const [qrSvg, setQrSvg] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [isProcessingDirectScan, setIsProcessingDirectScan] = useState(false);
  const [directScanFeedback, setDirectScanFeedback] = useState<{ message: string; success: boolean } | null>(null);

  // Local camera states (Direct tab)
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zxingReaderRef = useRef<any>(null);
  const barcodeDetectorRef = useRef<any>(null);
  const scanLoopTimerRef = useRef<any>(null);
  const lastScannedTimeRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Generate mobile scanner URL
  const mobileScannerUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/pos/remote-scanner?session=${encodeURIComponent(remoteSessionId)}&store=${encodeURIComponent(storeName)}&caja=${encodeURIComponent(registerName)}`
    : '';

  // Render QR SVG when modal opens or session changes
  useEffect(() => {
    if (!isOpen || !mobileScannerUrl) return;
    try {
      const svg = (bwipjs as any).toSVG({
        bcid: 'qrcode',
        text: mobileScannerUrl,
        scale: 4,
        padding: 6,
        backgroundcolor: 'ffffff'
      });
      setQrSvg(svg);
    } catch (err) {
      console.warn('Error generating QR SVG:', err);
    }
  }, [isOpen, mobileScannerUrl]);

  // Audio Beep
  const triggerBeep = useCallback((freq = 1900, duration = 0.08) => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioCtxRef.current && AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration + 0.01);
    } catch {
      // ignore audio errors
    }
  }, [soundEnabled]);

  // Stop local camera
  const stopCamera = useCallback(() => {
    if (scanLoopTimerRef.current) {
      clearTimeout(scanLoopTimerRef.current);
      scanLoopTimerRef.current = null;
    }
    if (zxingReaderRef.current) {
      try {
        zxingReaderRef.current.reset();
      } catch {
        // ignore
      }
      zxingReaderRef.current = null;
    }
    barcodeDetectorRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => {
        try { t.stop(); } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsTorchOn(false);
    setHasTorch(false);
    setCameraLoading(false);
  }, []);

  // Handle direct barcode processing
  const handleDirectProcessBarcode = useCallback(async (rawCode: string) => {
    const code = String(rawCode).trim();
    if (!code) return;

    const now = Date.now();
    if (lastScannedTimeRef.current.code === code && (now - lastScannedTimeRef.current.time) < 1800) {
      return; // cooldown
    }
    lastScannedTimeRef.current = { code, time: now };

    triggerBeep();
    if (navigator?.vibrate) {
      try { navigator.vibrate(60); } catch {}
    }

    setIsProcessingDirectScan(true);
    try {
      const res = await onScan(code);
      if (res && typeof res === 'object') {
        setDirectScanFeedback({
          success: res.success,
          message: res.message || (res.success ? `✓ Agregado: ${res.productName || code}` : `No encontrado: ${code}`)
        });
      } else {
        setDirectScanFeedback({
          success: true,
          message: `✓ Prenda escaneada: ${code}`
        });
      }
      setTimeout(() => setDirectScanFeedback(null), 3000);
    } catch (err: any) {
      setDirectScanFeedback({
        success: false,
        message: `Error al procesar: ${err?.message || code}`
      });
      setTimeout(() => setDirectScanFeedback(null), 3000);
    } finally {
      setIsProcessingDirectScan(false);
    }
  }, [onScan, triggerBeep]);

  // Start local camera
  const startCamera = async (mode: 'environment' | 'user' = facingMode) => {
    stopCamera();
    setCameraLoading(true);
    setCameraError(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Tu navegador no soporta acceso a la cámara o requiere HTTPS.');
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true
        });
      }

      streamRef.current = stream;

      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          const cap = (track as any).getCapabilities?.() || {};
          if (cap.torch) setHasTorch(true);
        } catch {
          setHasTorch(false);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        videoRef.current.muted = true;
        await videoRef.current.play().catch(() => {});
      }

      setIsCameraActive(true);
      setCameraLoading(false);

      // Check native BarcodeDetector
      let nativeOk = false;
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          const BDClass = (window as any).BarcodeDetector;
          const sup = await BDClass.getSupportedFormats();
          const target = ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code'].filter(f => sup.includes(f));
          if (target.length > 0) {
            barcodeDetectorRef.current = new BDClass({ formats: target });
            nativeOk = true;
          }
        } catch {
          nativeOk = false;
        }
      }

      // ZXing fallback
      if (!nativeOk) {
        try {
          const { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } = await import('@zxing/library');
          const hints = new Map();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.CODE_128,
            BarcodeFormat.CODE_39,
            BarcodeFormat.EAN_13,
            BarcodeFormat.EAN_8,
            BarcodeFormat.UPC_A,
            BarcodeFormat.UPC_E,
            BarcodeFormat.QR_CODE
          ]);
          hints.set(DecodeHintType.TRY_HARDER, true);
          zxingReaderRef.current = new BrowserMultiFormatReader(hints);
        } catch (e) {
          console.warn('ZXing init error:', e);
        }
      }

      // Frame detection loop
      let isRunning = false;
      const scanFrame = async () => {
        if (!streamRef.current || !videoRef.current) return;
        if (!isRunning && videoRef.current.readyState >= 2) {
          isRunning = true;
          try {
            if (barcodeDetectorRef.current) {
              const detected = await barcodeDetectorRef.current.detect(videoRef.current);
              if (detected?.length > 0 && detected[0].rawValue) {
                handleDirectProcessBarcode(detected[0].rawValue);
              }
            } else if (zxingReaderRef.current) {
              try {
                const res = zxingReaderRef.current.decode(videoRef.current);
                if (res) {
                  const txt = res.getText();
                  if (txt) handleDirectProcessBarcode(txt);
                }
              } catch {
                // Not found in frame is normal
              }
            }
          } catch {
            // Transient frame error
          } finally {
            isRunning = false;
          }
        }
        scanLoopTimerRef.current = window.setTimeout(scanFrame, 90);
      };

      scanLoopTimerRef.current = window.setTimeout(scanFrame, 180);
    } catch (err: any) {
      stopCamera();
      const msg = err?.message || String(err);
      if (msg.includes('Permission denied') || msg.includes('NotAllowedError')) {
        setCameraError('Permiso de cámara denegado. Permite el acceso a la cámara en el navegador.');
      } else {
        setCameraError(`No se pudo iniciar la cámara: ${msg}`);
      }
    }
  };

  // Toggle Torch
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    try {
      const track = streamRef.current.getVideoTracks()[0];
      if (track && (track as any).applyConstraints) {
        const next = !isTorchOn;
        await (track as any).applyConstraints({ advanced: [{ torch: next }] });
        setIsTorchOn(next);
      }
    } catch {
      // ignore
    }
  };

  // Flip Camera
  const flipCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Toggle active tab camera handling
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }
    if (activeTab === 'direct') {
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab]);

  // Copy link handler
  const handleCopyLink = () => {
    if (!mobileScannerUrl) return;
    navigator.clipboard.writeText(mobileScannerUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  // Share via WhatsApp
  const handleShareWhatsApp = () => {
    if (!mobileScannerUrl) return;
    const text = `Hola, este es el lector móvil para la ${registerName} en ${storeName}. Abre el enlace para escanear prendas en la tienda:\n${mobileScannerUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Manual code submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleDirectProcessBarcode(manualCode.trim());
    setManualCode('');
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '680px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #80082E 0%, #a2123f 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: '0 4px 12px rgba(128, 8, 46, 0.25)'
            }}>
              <Smartphone size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '950', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                Escanear Productos para la Venta
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  {storeName} · {registerName}
                </span>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#cbd5e1' }} />
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: '800',
                  color: isPhoneConnected ? '#059669' : '#f59e0b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}>
                  <span style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: isPhoneConnected ? '#10b981' : '#f59e0b',
                    boxShadow: isPhoneConnected ? '0 0 8px #10b981' : 'none'
                  }} />
                  {isPhoneConnected ? 'Celular Conectado' : 'Esperando Celular'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '0.5rem',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: '#f1f5f9',
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s'
            }}
            title="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc',
          padding: '0.5rem 1.5rem 0'
        }}>
          <button
            onClick={() => setActiveTab('remote')}
            style={{
              padding: '0.65rem 1.25rem',
              border: 'none',
              borderBottom: activeTab === 'remote' ? '3px solid #80082E' : '3px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'remote' ? '#80082E' : '#64748b',
              fontWeight: activeTab === 'remote' ? '900' : '700',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.15s'
            }}
          >
            <Smartphone size={16} />
            <span>Escanear con Celular (Recomendado)</span>
            {isPhoneConnected && (
              <span style={{
                backgroundColor: '#dcfce7',
                color: '#15803d',
                fontSize: '0.65rem',
                padding: '0.1rem 0.45rem',
                borderRadius: '10px',
                fontWeight: '900'
              }}>
                En línea
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('direct')}
            style={{
              padding: '0.65rem 1.25rem',
              border: 'none',
              borderBottom: activeTab === 'direct' ? '3px solid #80082E' : '3px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'direct' ? '#80082E' : '#64748b',
              fontWeight: activeTab === 'direct' ? '900' : '700',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.15s'
            }}
          >
            <Camera size={16} />
            <span>Cámara de este Equipo</span>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          
          {/* TAB 1: CELULAR REMOTO */}
          {activeTab === 'remote' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Status Banner */}
              <div style={{
                padding: '0.85rem 1.25rem',
                borderRadius: '12px',
                backgroundColor: isPhoneConnected ? '#f0fdf4' : '#fffbeb',
                border: `1.5px solid ${isPhoneConnected ? '#86efac' : '#fde68a'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: isPhoneConnected ? '#22c55e' : '#f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    flexShrink: 0
                  }}>
                    {isPhoneConnected ? <Check size={18} /> : <Loader2 size={18} className="animate-spin" />}
                  </div>
                  <div>
                    <strong style={{ fontSize: '0.82rem', color: isPhoneConnected ? '#14532d' : '#78350f', display: 'block' }}>
                      {isPhoneConnected ? '¡Celular vinculado y listo para escanear!' : 'Esperando conexión desde el celular...'}
                    </strong>
                    <span style={{ fontSize: '0.72rem', color: isPhoneConnected ? '#166534' : '#92400e' }}>
                      {isPhoneConnected
                        ? 'Apunta el celular a las etiquetas. Cada prenda se agregará automáticamente al carrito.'
                        : 'Apunta la cámara de cualquier celular al código QR de abajo para abrir la pistola móvil.'}
                    </span>
                  </div>
                </div>

                <div style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '20px',
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.75rem',
                  fontWeight: '850',
                  color: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  whiteSpace: 'nowrap'
                }}>
                  <ShoppingBag size={14} style={{ color: '#80082E' }} />
                  <span>{cartCount} en carrito</span>
                </div>
              </div>

              {/* QR Code and Quick Connect Section */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gap: '1.5rem',
                alignItems: 'center',
                backgroundColor: '#ffffff',
                border: '1.5px solid #e2e8f0',
                borderRadius: '16px',
                padding: '1.5rem'
              }}>
                {/* QR Vector Box */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <div style={{
                    padding: '0.65rem',
                    backgroundColor: 'white',
                    borderRadius: '14px',
                    border: '2px solid #80082E',
                    boxShadow: '0 8px 20px rgba(128, 8, 46, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '180px',
                    minHeight: '180px'
                  }}>
                    {qrSvg ? (
                      <div
                        dangerouslySetInnerHTML={{ __html: qrSvg }}
                        style={{ width: '170px', height: '170px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: '#94a3b8' }}>
                        <Loader2 size={32} className="animate-spin" />
                        <span style={{ fontSize: '0.7rem' }}>Generando QR...</span>
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#64748b' }}>
                    Apunta con la cámara de tu celular
                  </span>
                </div>

                {/* Steps and Action buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: '900', color: '#0f172a' }}>
                      Pistola Lectora Inalámbrica sin Instalación
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5 }}>
                      Cualquier vendedor puede escanear prendas en los percheros con su iPhone o Android y enviarlas en tiempo real a esta caja POS.
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.75rem', color: '#475569' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '0.7rem', color: '#80082E' }}>1</span>
                      <span>Enfoca el código QR con la cámara de tu smartphone.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '0.7rem', color: '#80082E' }}>2</span>
                      <span>Abre el enlace para iniciar el lector con apuntador láser.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '0.7rem', color: '#80082E' }}>3</span>
                      <span>¡Listo! Escanea los códigos de barras de las prendas.</span>
                    </div>
                  </div>

                  {/* Quick Action buttons */}
                  <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      style={{
                        padding: '0.5rem 0.95rem',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: copied ? '#ecfdf5' : '#ffffff',
                        color: copied ? '#059669' : '#0f172a',
                        fontSize: '0.75rem',
                        fontWeight: '800',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        transition: 'all 0.15s'
                      }}
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copied ? '¡Enlace Copiado!' : 'Copiar Enlace'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleShareWhatsApp}
                      style={{
                        padding: '0.5rem 0.95rem',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: '#25D366',
                        color: 'white',
                        fontSize: '0.75rem',
                        fontWeight: '800',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        boxShadow: '0 2px 8px rgba(37, 211, 102, 0.3)',
                        transition: 'all 0.15s'
                      }}
                    >
                      <Share2 size={14} />
                      <span>Enviar por WhatsApp</span>
                    </button>

                    <a
                      href={mobileScannerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '0.5rem 0.95rem',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#f8fafc',
                        color: '#475569',
                        fontSize: '0.75rem',
                        fontWeight: '800',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        textDecoration: 'none'
                      }}
                    >
                      <ExternalLink size={14} />
                      <span>Abrir en otra pestaña</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Recent Remote Scans Log */}
              <div style={{
                backgroundColor: '#f8fafc',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '850', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Últimas Prendas Escaneadas ({recentScans.length})
                  </span>
                  <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                    Actualización en tiempo real
                  </span>
                </div>

                {recentScans.length === 0 ? (
                  <div style={{
                    padding: '1.5rem',
                    textAlign: 'center',
                    color: '#94a3b8',
                    fontSize: '0.78rem',
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    border: '1px dashed #cbd5e1'
                  }}>
                    Aún no se han recibido escaneos en esta sesión. Los productos leídos desde el celular aparecerán aquí.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '180px', overflowY: 'auto' }}>
                    {recentScans.slice().reverse().map((scan, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.65rem 0.85rem',
                          backgroundColor: 'white',
                          borderRadius: '8px',
                          border: `1px solid ${scan.success !== false ? '#bbf7d0' : '#fecaca'}`
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <div style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: scan.success !== false ? '#dcfce7' : '#fee2e2',
                            color: scan.success !== false ? '#15803d' : '#dc2626',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.7rem',
                            fontWeight: '900'
                          }}>
                            {scan.success !== false ? '✓' : '✕'}
                          </div>
                          <div>
                            <strong style={{ fontSize: '0.78rem', color: '#0f172a', display: 'block' }}>
                              {scan.name || `Código: ${scan.barcode}`}
                            </strong>
                            <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                              Etiqueta: {scan.barcode} {scan.message ? `· ${scan.message}` : ''}
                            </span>
                          </div>
                        </div>
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: '700' }}>
                          {scan.time}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: CÁMARA DIRECTA DEL EQUIPO */}
          {activeTab === 'direct' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Camera Video Viewport */}
              <div style={{
                position: 'relative',
                width: '100%',
                height: '320px',
                borderRadius: '16px',
                backgroundColor: '#0f172a',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)'
              }}>
                <video
                  ref={videoRef}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                  playsInline
                  muted
                />

                {/* Scanning HUD Target Overlay */}
                {isCameraActive && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '280px',
                    height: '160px',
                    border: '2px solid rgba(255, 255, 255, 0.8)',
                    borderRadius: '14px',
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
                    pointerEvents: 'none'
                  }}>
                    {/* Corner Reticles */}
                    <div style={{ position: 'absolute', top: -3, left: -3, width: 22, height: 22, borderTop: '4px solid #10b981', borderLeft: '4px solid #10b981', borderTopLeftRadius: 6 }} />
                    <div style={{ position: 'absolute', top: -3, right: -3, width: 22, height: 22, borderTop: '4px solid #10b981', borderRight: '4px solid #10b981', borderTopRightRadius: 6 }} />
                    <div style={{ position: 'absolute', bottom: -3, left: -3, width: 22, height: 22, borderBottom: '4px solid #10b981', borderLeft: '4px solid #10b981', borderBottomLeftRadius: 6 }} />
                    <div style={{ position: 'absolute', bottom: -3, right: -3, width: 22, height: 22, borderBottom: '4px solid #10b981', borderRight: '4px solid #10b981', borderBottomRightRadius: 6 }} />

                    {/* Animated Red Laser Line */}
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: 0,
                      right: 0,
                      height: '2px',
                      backgroundColor: '#ef4444',
                      boxShadow: '0 0 10px #ef4444',
                      animation: 'scanLaser 2s infinite ease-in-out'
                    }} />
                  </div>
                )}

                {/* Loading / Error States */}
                {cameraLoading && (
                  <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', color: 'white' }}>
                    <Loader2 size={36} className="animate-spin" />
                    <span style={{ fontSize: '0.85rem', fontWeight: '800' }}>Iniciando cámara...</span>
                  </div>
                )}

                {cameraError && (
                  <div style={{ position: 'absolute', maxWidth: '85%', padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.95)', color: 'white', borderRadius: '10px', textAlign: 'center', fontSize: '0.8rem' }}>
                    <AlertCircle size={24} style={{ margin: '0 auto 0.5rem' }} />
                    <div>{cameraError}</div>
                    <button
                      onClick={() => startCamera()}
                      style={{ marginTop: '0.75rem', padding: '0.4rem 0.8rem', background: 'white', color: '#ef4444', border: 'none', borderRadius: '6px', fontWeight: '800', cursor: 'pointer', fontSize: '0.75rem' }}
                    >
                      Reintentar
                    </button>
                  </div>
                )}

                {/* Overlaid Camera Control Buttons */}
                {isCameraActive && (
                  <div style={{
                    position: 'absolute',
                    bottom: '1rem',
                    left: '1rem',
                    right: '1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <button
                      type="button"
                      onClick={flipCamera}
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: '20px',
                        border: 'none',
                        backgroundColor: 'rgba(0, 0, 0, 0.65)',
                        color: 'white',
                        fontSize: '0.72rem',
                        fontWeight: '800',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        backdropFilter: 'blur(4px)'
                      }}
                    >
                      <FlipHorizontal size={14} />
                      <span>Cambiar Cámara</span>
                    </button>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {hasTorch && (
                        <button
                          type="button"
                          onClick={toggleTorch}
                          style={{
                            padding: '0.5rem',
                            borderRadius: '50%',
                            border: 'none',
                            backgroundColor: isTorchOn ? '#f59e0b' : 'rgba(0, 0, 0, 0.65)',
                            color: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backdropFilter: 'blur(4px)'
                          }}
                          title="Linterna"
                        >
                          <Flashlight size={16} />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        style={{
                          padding: '0.5rem',
                          borderRadius: '50%',
                          border: 'none',
                          backgroundColor: soundEnabled ? '#10b981' : 'rgba(0, 0, 0, 0.65)',
                          color: 'white',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backdropFilter: 'blur(4px)'
                        }}
                        title={soundEnabled ? 'Sonido activado' : 'Sonido silenciado'}
                      >
                        {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Direct Scan Feedback Alert */}
              {directScanFeedback && (
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  backgroundColor: directScanFeedback.success ? '#ecfdf5' : '#fef2f2',
                  border: `1.5px solid ${directScanFeedback.success ? '#10b981' : '#ef4444'}`,
                  color: directScanFeedback.success ? '#065f46' : '#991b1b',
                  fontSize: '0.8rem',
                  fontWeight: '850',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  animation: 'fadeIn 0.15s ease-out'
                }}>
                  {directScanFeedback.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{directScanFeedback.message}</span>
                </div>
              )}

              {/* Manual Barcode Input Fallback */}
              <form
                onSubmit={handleManualSubmit}
                style={{
                  display: 'flex',
                  gap: '0.65rem',
                  alignItems: 'center',
                  backgroundColor: '#f8fafc',
                  padding: '0.75rem',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0'
                }}
              >
                <Barcode size={18} style={{ color: '#64748b', marginLeft: '0.35rem' }} />
                <input
                  type="text"
                  placeholder="Ingresar número de etiqueta o código manualmente..."
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.55rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    outline: 'none',
                    backgroundColor: 'white'
                  }}
                />
                <button
                  type="submit"
                  disabled={!manualCode.trim() || isProcessingDirectScan}
                  style={{
                    padding: '0.55rem 1.25rem',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#80082E',
                    color: 'white',
                    fontWeight: '850',
                    fontSize: '0.78rem',
                    cursor: manualCode.trim() ? 'pointer' : 'not-allowed',
                    opacity: manualCode.trim() ? 1 : 0.6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  {isProcessingDirectScan ? <Loader2 size={14} className="animate-spin" /> : 'Agregar'}
                </button>
              </form>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
            💡 Compatible con etiquetas individuales (10 dígitos), EAN-13, UPC y Code 128
          </span>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.55rem 1.35rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#0f172a',
              fontWeight: '800',
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            Listo / Volver a Caja
          </button>
        </div>
      </div>
    </div>
  );
}
