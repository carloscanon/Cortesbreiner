'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Smartphone,
  Camera,
  CameraOff,
  Flashlight,
  FlipHorizontal,
  Volume2,
  VolumeX,
  Vibrate,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Keyboard,
  Barcode,
  ShoppingBag,
  RotateCcw,
  Wifi,
  WifiOff,
  X
} from 'lucide-react';

interface ScannedHistoryItem {
  id: string;
  barcode: string;
  name?: string;
  reference?: string;
  size?: string;
  color?: string;
  price?: number;
  time: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
}

function RemoteScannerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const sessionId = searchParams.get('session') || 'pos-default';
  const storeName = searchParams.get('store') || 'Tienda Principal';
  const registerName = searchParams.get('caja') || 'Caja POS';

  // Camera & Detection state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Preferences
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

  // Connection & realtime state
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [cartCount, setCartCount] = useState<number | null>(null);

  // Scanned history & feedback
  const [scannedItems, setScannedItems] = useState<ScannedHistoryItem[]>([]);
  const [activeFeedback, setActiveFeedback] = useState<{
    barcode: string;
    productName?: string;
    reference?: string;
    size?: string;
    color?: string;
    price?: number;
    success: boolean;
    message: string;
  } | null>(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualCodeInput, setManualCodeInput] = useState('');

  // Hardware refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zxingReaderRef = useRef<any>(null);
  const barcodeDetectorRef = useRef<any>(null);
  const scanLoopTimerRef = useRef<any>(null);
  const channelRef = useRef<any>(null);
  const lastScanTimestampRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Audio Beep
  const triggerAudioBeep = useCallback((freq = 1900, duration = 0.08) => {
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
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration + 0.01);
    } catch {
      // ignore
    }
  }, [soundEnabled]);

  // Haptic pulse
  const triggerHaptic = useCallback((pattern: number | number[] = 65) => {
    if (!vibrationEnabled || typeof window === 'undefined') return;
    try {
      if (navigator?.vibrate) {
        navigator.vibrate(pattern);
      }
    } catch {
      // ignore
    }
  }, [vibrationEnabled]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (scanLoopTimerRef.current) {
      clearTimeout(scanLoopTimerRef.current);
      scanLoopTimerRef.current = null;
    }
    if (zxingReaderRef.current) {
      try {
        zxingReaderRef.current.reset();
      } catch {}
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

  // Connect to Supabase Realtime channel
  const initRealtimeChannel = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channelName = `pos-remote-${sessionId}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } }
    });

    // Listen for scan acknowledgement from desktop POS
    channel.on('broadcast', { event: 'scan-ack' }, (payload: any) => {
      const data = payload.payload;
      if (!data) return;

      if (data.cartTotalItems !== undefined) {
        setCartCount(data.cartTotalItems);
      }

      setActiveFeedback({
        barcode: data.barcode,
        productName: data.productName,
        reference: data.reference,
        size: data.size,
        color: data.color,
        price: data.price,
        success: data.success !== false,
        message: data.message || (data.success !== false ? '✓ Agregado al carrito de caja' : 'No encontrado')
      });

      // Update in local history
      setScannedItems(prev => prev.map(item => {
        if (item.barcode === data.barcode) {
          return {
            ...item,
            name: data.productName || item.name,
            reference: data.reference,
            size: data.size,
            color: data.color,
            price: data.price,
            status: data.success !== false ? 'success' : 'error',
            message: data.message
          };
        }
        return item;
      }));

      setTimeout(() => {
        setActiveFeedback(null);
      }, 3500);
    });

    // POS ping/status response
    channel.on('broadcast', { event: 'pos-pong' }, (payload: any) => {
      setIsConnected(true);
      if (payload?.payload?.cartCount !== undefined) {
        setCartCount(payload.payload.cartCount);
      }
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
        setIsReconnecting(false);

        // Notify desktop POS that this phone has connected
        channel.send({
          type: 'broadcast',
          event: 'client-connected',
          payload: {
            device: typeof navigator !== 'undefined' ? navigator.userAgent : 'Móvil',
            timestamp: Date.now()
          }
        });
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        setIsConnected(false);
      }
    });

    channelRef.current = channel;
  }, [sessionId]);

  useEffect(() => {
    initRealtimeChannel();
    return () => {
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'client-disconnected',
          payload: { timestamp: Date.now() }
        });
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [initRealtimeChannel]);

  // Transmit barcode to POS
  const transmitBarcode = useCallback(async (code: string) => {
    const term = code.trim();
    if (!term) return;

    // Beep & Vibrate
    triggerAudioBeep();
    triggerHaptic(75);

    const nowStr = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const tempId = `scan-${Date.now()}`;

    // Add to local history immediately with pending status
    setScannedItems(prev => [
      {
        id: tempId,
        barcode: term,
        time: nowStr,
        status: 'pending',
        message: 'Enviando a caja POS...'
      },
      ...prev
    ]);

    setActiveFeedback({
      barcode: term,
      success: true,
      message: `Enviando a Caja ${registerName}...`
    });

    // 1. Direct Broadcast through Supabase Realtime channel
    if (channelRef.current) {
      try {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'scan',
          payload: {
            barcode: term,
            id: tempId,
            timestamp: Date.now(),
            scannerDevice: 'Celular'
          }
        });
      } catch (err) {
        console.warn('Realtime channel broadcast error:', err);
      }
    }

    // 2. Parallel HTTP Fallback guarantee
    try {
      fetch('/api/pos/remote-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: sessionId,
          barcode: term,
          scannerDevice: 'Celular Remoto'
        })
      }).catch(e => console.warn('HTTP fallback error:', e));
    } catch {
      // ignore
    }
  }, [sessionId, registerName, triggerAudioBeep, triggerHaptic]);

  // Camera Barcode Scanning Engine
  const startCamera = async (mode: 'environment' | 'user' = facingMode) => {
    stopCamera();
    setCameraLoading(true);
    setCameraError(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Tu navegador móvil no admite acceso a la cámara o requiere HTTPS.');
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
          const supported = await BDClass.getSupportedFormats();
          const target = ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code'].filter(f => supported.includes(f));
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

      // Continuous loop
      let isRunning = false;
      const scanFrame = async () => {
        if (!streamRef.current || !videoRef.current) return;
        if (!isRunning && videoRef.current.readyState >= 2) {
          isRunning = true;
          try {
            if (barcodeDetectorRef.current) {
              const detected = await barcodeDetectorRef.current.detect(videoRef.current);
              if (detected?.length > 0 && detected[0].rawValue) {
                const code = detected[0].rawValue.trim();
                const now = Date.now();
                if (code && (lastScanTimestampRef.current.code !== code || (now - lastScanTimestampRef.current.time) > 2000)) {
                  lastScanTimestampRef.current = { code, time: now };
                  transmitBarcode(code);
                }
              }
            } else if (zxingReaderRef.current) {
              try {
                const res = zxingReaderRef.current.decode(videoRef.current);
                if (res) {
                  const code = res.getText().trim();
                  const now = Date.now();
                  if (code && (lastScanTimestampRef.current.code !== code || (now - lastScanTimestampRef.current.time) > 2000)) {
                    lastScanTimestampRef.current = { code, time: now };
                    transmitBarcode(code);
                  }
                }
              } catch {
                // Not found is normal
              }
            }
          } catch {
            // frame error
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
      if (msg.includes('Permission') || msg.includes('NotAllowedError')) {
        setCameraError('Permiso denegado. Permite el acceso a la cámara en el navegador de tu celular.');
      } else {
        setCameraError(`Error al activar la cámara: ${msg}`);
      }
    }
  };

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      stopCamera();
    };
  }, []);

  // Torch Toggle
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
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startCamera(next);
  };

  // Handle Manual Code
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCodeInput.trim()) return;
    transmitBarcode(manualCodeInput.trim());
    setManualCodeInput('');
    setShowManualModal(false);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#090d16',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Top Header Bar */}
      <div style={{
        padding: '0.75rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#0f172a',
        borderBottom: '1px solid #1e293b',
        zIndex: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #80082E 0%, #d81b60 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            boxShadow: '0 2px 8px rgba(128, 8, 46, 0.4)'
          }}>
            <Smartphone size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: '900', color: 'white', lineHeight: 1.2 }}>
              Pistola Móvil POS
            </div>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>{registerName}</span>
              <span>·</span>
              <span>{storeName}</span>
            </div>
          </div>
        </div>

        {/* Connection status pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            padding: '0.3rem 0.65rem',
            borderRadius: '20px',
            backgroundColor: isConnected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${isConnected ? '#22c55e' : '#ef4444'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.68rem',
            fontWeight: '800',
            color: isConnected ? '#4ade80' : '#f87171'
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: isConnected ? '#22c55e' : '#ef4444',
              boxShadow: isConnected ? '0 0 6px #22c55e' : 'none'
            }} />
            <span>{isConnected ? 'En Línea' : 'Reconectando...'}</span>
          </div>

          {cartCount !== null && (
            <div style={{
              padding: '0.3rem 0.65rem',
              borderRadius: '20px',
              backgroundColor: '#80082E',
              color: 'white',
              fontSize: '0.68rem',
              fontWeight: '900',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem'
            }}>
              <ShoppingBag size={12} />
              <span>{cartCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Camera Viewport Area */}
      <div style={{
        position: 'relative',
        flex: 1,
        backgroundColor: '#000000',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
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

        {/* Reticle / Viewfinder Target */}
        {isCameraActive && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '78%',
            maxWidth: '320px',
            height: '190px',
            border: '2px solid rgba(255, 255, 255, 0.6)',
            borderRadius: '16px',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
            pointerEvents: 'none'
          }}>
            {/* Corners */}
            <div style={{ position: 'absolute', top: -3, left: -3, width: 24, height: 24, borderTop: '4px solid #10b981', borderLeft: '4px solid #10b981', borderTopLeftRadius: 8 }} />
            <div style={{ position: 'absolute', top: -3, right: -3, width: 24, height: 24, borderTop: '4px solid #10b981', borderRight: '4px solid #10b981', borderTopRightRadius: 8 }} />
            <div style={{ position: 'absolute', bottom: -3, left: -3, width: 24, height: 24, borderBottom: '4px solid #10b981', borderLeft: '4px solid #10b981', borderBottomLeftRadius: 8 }} />
            <div style={{ position: 'absolute', bottom: -3, right: -3, width: 24, height: 24, borderBottom: '4px solid #10b981', borderRight: '4px solid #10b981', borderBottomRightRadius: 8 }} />

            {/* Laser Line */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              right: 0,
              height: '2px',
              backgroundColor: '#10b981',
              boxShadow: '0 0 12px #10b981',
              animation: 'scanLaser 2s infinite ease-in-out'
            }} />

            <div style={{
              position: 'absolute',
              bottom: '-28px',
              left: 0,
              right: 0,
              textAlign: 'center',
              fontSize: '0.72rem',
              fontWeight: '800',
              color: 'rgba(255, 255, 255, 0.85)',
              textShadow: '0 1px 3px rgba(0,0,0,0.8)'
            }}>
              Apunta el código de barras aquí
            </div>
          </div>
        )}

        {/* Inactive Camera Gesture Prompt (e.g. for iOS Safari) */}
        {!isCameraActive && !cameraLoading && !cameraError && (
          <div style={{
            position: 'absolute',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            padding: '1.5rem',
            textAlign: 'center',
            zIndex: 10
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#80082E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: '0 4px 16px rgba(128,8,46,0.5)'
            }}>
              <Camera size={30} />
            </div>
            <button
              type="button"
              onClick={() => startCamera(facingMode)}
              style={{
                padding: '0.85rem 1.75rem',
                borderRadius: '14px',
                backgroundColor: '#80082E',
                color: 'white',
                border: 'none',
                fontWeight: '900',
                fontSize: '0.95rem',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(128,8,46,0.4)'
              }}
            >
              📷 Activar Cámara del Celular
            </button>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Toca para permitir acceso a la cámara y escanear
            </span>
          </div>
        )}

        {/* Loading Spinner */}
        {cameraLoading && (
          <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', color: 'white' }}>
            <Loader2 size={40} className="animate-spin" />
            <span style={{ fontSize: '0.85rem', fontWeight: '800' }}>Iniciando cámara...</span>
          </div>
        )}

        {/* Camera Error Message */}
        {cameraError && (
          <div style={{
            position: 'absolute',
            maxWidth: '85%',
            padding: '1.25rem',
            backgroundColor: 'rgba(239, 68, 68, 0.95)',
            color: 'white',
            borderRadius: '12px',
            textAlign: 'center',
            fontSize: '0.8rem'
          }}>
            <AlertTriangle size={28} style={{ margin: '0 auto 0.5rem' }} />
            <div style={{ lineHeight: 1.4 }}>{cameraError}</div>
            <button
              onClick={() => startCamera()}
              style={{
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                background: 'white',
                color: '#ef4444',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '900',
                cursor: 'pointer',
                fontSize: '0.78rem'
              }}
            >
              Reintentar Acceso
            </button>
          </div>
        )}

        {/* Overlaid Camera Action Controls */}
        <div style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
          zIndex: 10
        }}>
          {hasTorch && (
            <button
              type="button"
              onClick={toggleTorch}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: isTorchOn ? '#f59e0b' : 'rgba(15, 23, 42, 0.75)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(6px)',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}
              title="Linterna"
            >
              <Flashlight size={18} />
            </button>
          )}

          <button
            type="button"
            onClick={flipCamera}
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: 'rgba(15, 23, 42, 0.75)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(6px)',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}
            title="Cambiar Cámara"
          >
            <FlipHorizontal size={18} />
          </button>

          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: soundEnabled ? 'rgba(16, 185, 129, 0.8)' : 'rgba(15, 23, 42, 0.75)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(6px)',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}
            title="Sonido"
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </div>

        {/* Live Feedback Toast Floating Over Camera */}
        {activeFeedback && (
          <div style={{
            position: 'absolute',
            bottom: '1.25rem',
            left: '1rem',
            right: '1rem',
            backgroundColor: activeFeedback.success ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)',
            backdropFilter: 'blur(8px)',
            color: 'white',
            borderRadius: '16px',
            padding: '0.85rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
            zIndex: 15,
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {activeFeedback.success ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '900', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeFeedback.productName || `Código: ${activeFeedback.barcode}`}
                </div>
                <div style={{ fontSize: '0.72rem', opacity: 0.9 }}>
                  {activeFeedback.size ? `Talla: ${activeFeedback.size} · Color: ${activeFeedback.color || '-'} ` : ''}
                  {activeFeedback.price ? `· $${activeFeedback.price.toLocaleString('es-CO')}` : ''}
                </div>
              </div>
            </div>

            <button
              onClick={() => setActiveFeedback(null)}
              style={{ background: 'none', border: 'none', color: 'white', opacity: 0.8, cursor: 'pointer', padding: '0.25rem' }}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Bottom Action Drawer & Recent Scans */}
      <div style={{
        backgroundColor: '#0f172a',
        borderTop: '1px solid #1e293b',
        padding: '0.85rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        zIndex: 20
      }}>
        {/* Quick Action Button Bar */}
        <div style={{ display: 'flex', gap: '0.65rem' }}>
          <button
            type="button"
            onClick={() => setShowManualModal(true)}
            style={{
              flex: 1,
              padding: '0.65rem',
              borderRadius: '12px',
              border: '1px solid #334155',
              backgroundColor: '#1e293b',
              color: 'white',
              fontSize: '0.78rem',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem'
            }}
          >
            <Keyboard size={15} />
            <span>Digitar Código Manual</span>
          </button>

          <button
            type="button"
            onClick={() => initRealtimeChannel()}
            style={{
              padding: '0.65rem 0.85rem',
              borderRadius: '12px',
              border: '1px solid #334155',
              backgroundColor: '#1e293b',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Reconectar con Caja"
          >
            <RotateCcw size={15} />
          </button>
        </div>

        {/* Recent Scans Strip */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: '850', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Escaneadas en esta sesión ({scannedItems.length})
          </span>
          <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
            Caja: {registerName}
          </span>
        </div>

        {scannedItems.length > 0 && (
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            overflowX: 'auto',
            paddingBottom: '0.2rem'
          }}>
            {scannedItems.slice(0, 10).map((item, idx) => (
              <div
                key={item.id || idx}
                style={{
                  padding: '0.4rem 0.65rem',
                  borderRadius: '8px',
                  backgroundColor: item.status === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${item.status === 'success' ? '#22c55e' : '#334155'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.72rem',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                <span style={{
                  color: item.status === 'success' ? '#4ade80' : item.status === 'error' ? '#f87171' : '#facc15',
                  fontWeight: '900'
                }}>
                  {item.status === 'success' ? '✓' : item.status === 'error' ? '✕' : '•'}
                </span>
                <span style={{ fontWeight: '750' }}>{item.barcode}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual Code Entry Modal Dialog */}
      {showManualModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          padding: '1.25rem'
        }}>
          <div style={{
            backgroundColor: '#0f172a',
            border: '1.5px solid #334155',
            borderRadius: '18px',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '380px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '900', color: 'white', margin: 0 }}>
                ⌨️ Ingreso Manual de Código
              </h3>
              <button
                onClick={() => setShowManualModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>
              Si la etiqueta está arrugada o manchada, escribe los números y envíalos a la caja.
            </p>

            <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <input
                type="text"
                autoFocus
                placeholder="Ej. 0081963300..."
                value={manualCodeInput}
                onChange={e => setManualCodeInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: '2px solid #80082E',
                  backgroundColor: '#1e293b',
                  color: 'white',
                  fontSize: '1rem',
                  fontWeight: '800',
                  outline: 'none',
                  textAlign: 'center',
                  letterSpacing: '0.08em'
                }}
              />

              <div style={{ display: 'flex', gap: '0.65rem' }}>
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  style={{
                    flex: 1,
                    padding: '0.65rem',
                    borderRadius: '10px',
                    border: '1px solid #334155',
                    backgroundColor: 'transparent',
                    color: '#94a3b8',
                    fontWeight: '800',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={!manualCodeInput.trim()}
                  style={{
                    flex: 1,
                    padding: '0.65rem',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: '#80082E',
                    color: 'white',
                    fontWeight: '900',
                    fontSize: '0.8rem',
                    cursor: manualCodeInput.trim() ? 'pointer' : 'not-allowed',
                    opacity: manualCodeInput.trim() ? 1 : 0.6
                  }}
                >
                  Enviar a Caja
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MobileRemoteScannerPage() {
  return (
    <Suspense fallback={
      <div style={{
        height: '100vh',
        width: '100vw',
        backgroundColor: '#090d16',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <Loader2 size={36} className="animate-spin" style={{ color: '#80082E' }} />
        <span style={{ fontSize: '0.85rem', fontWeight: '800' }}>Cargando lector móvil POS...</span>
      </div>
    }>
      <RemoteScannerContent />
    </Suspense>
  );
}
