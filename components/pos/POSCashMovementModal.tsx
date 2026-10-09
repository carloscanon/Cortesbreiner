'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  DollarSign, ArrowDownRight, ArrowUpRight, CheckCircle2,
  X, AlertTriangle, FileText, User, Calendar, Tag, RefreshCw,
  Landmark, ShieldCheck, Plus, Layers
} from 'lucide-react';

export interface POSCashConcept {
  id: string;
  name: string;
  nombre?: string;
  type: 'ingreso' | 'egreso' | 'ambos' | 'Ingreso' | 'Egreso';
  tipo?: 'ingreso' | 'egreso' | 'ambos' | 'Ingreso' | 'Egreso';
  description?: string;
  descripcion?: string;
  is_active: boolean;
  activo?: boolean;
}

export const DEFAULT_CASH_CONCEPTS: POSCashConcept[] = [
  { id: '1', name: 'Pago Parqueaderos', nombre: 'Pago Parqueaderos', type: 'egreso', tipo: 'Egreso', description: 'Gastos de estacionamiento para clientes o tienda', descripcion: 'Gastos de estacionamiento para clientes o tienda', is_active: true, activo: true },
  { id: '2', name: 'Sencillo / Cambio de Efectivo', nombre: 'Sencillo / Cambio de Efectivo', type: 'ambos', tipo: 'Egreso', description: 'Cambio o ingreso de billetes/monedas para caja', descripcion: 'Cambio o ingreso de billetes/monedas para caja', is_active: true, activo: true },
  { id: '3', name: 'Aseo y Cafetería', nombre: 'Aseo y Cafetería', type: 'egreso', tipo: 'Egreso', description: 'Compra de insumos de limpieza, café, agua, refrigerios', descripcion: 'Compra de insumos de limpieza, café, agua, refrigerios', is_active: true, activo: true },
  { id: '4', name: 'Cadenas / Gastos Menores', nombre: 'Cadenas / Gastos Menores', type: 'egreso', tipo: 'Egreso', description: 'Suministros, bolsas, cintas, papelería, gastos de local', descripcion: 'Suministros, bolsas, cintas, papelería, gastos de local', is_active: true, activo: true },
  { id: '5', name: 'Base de Caja Adicional', nombre: 'Base de Caja Adicional', type: 'ingreso', tipo: 'Ingreso', description: 'Inyección de dinero en efectivo para fondo de caja', descripcion: 'Inyección de dinero en efectivo para fondo de caja', is_active: true, activo: true },
  { id: '6', name: 'Transporte y Domicilios', nombre: 'Transporte y Domicilios', type: 'egreso', tipo: 'Egreso', description: 'Pagos de fletes, mensajería, taxis o domicilios', descripcion: 'Pagos de fletes, mensajería, taxis o domicilios', is_active: true, activo: true },
  { id: '7', name: 'Otros Gastos Operativos', nombre: 'Otros Gastos Operativos', type: 'egreso', tipo: 'Egreso', description: 'Gastos varios autorizados por la administración', descripcion: 'Gastos varios autorizados por la administración', is_active: true, activo: true }
];

interface POSCashMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStore?: any;
  currentSession?: any;
  currentUser?: any;
  userProfile?: any;
  sessionId?: string;
  sessionUser?: string;
  storeId?: string;
  registerId?: string;
  primaryColor?: string;
  secondaryColor?: string;
  concepts: POSCashConcept[];
  onMovementSaved: () => void;
}

export default function POSCashMovementModal({
  isOpen,
  onClose,
  currentStore,
  currentSession,
  currentUser,
  userProfile,
  sessionId,
  sessionUser,
  storeId,
  registerId,
  primaryColor = '#80082E',
  secondaryColor = '#D81B60',
  concepts,
  onMovementSaved
}: POSCashMovementModalProps) {
  const [movementType, setMovementType] = useState<'ingreso' | 'egreso'>('egreso');
  const [selectedConcept, setSelectedConcept] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [observations, setObservations] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Normalizer helper
  const normalizedConcepts = (concepts && concepts.length > 0 ? concepts : DEFAULT_CASH_CONCEPTS).map(c => ({
    id: c.id,
    name: c.name || c.nombre || '',
    type: (c.type || c.tipo || 'egreso').toString().toLowerCase(),
    description: c.description || c.descripcion || '',
    is_active: c.is_active !== undefined ? c.is_active : (c.activo !== undefined ? c.activo : true)
  }));

  // Filter concepts based on movement type
  const availableConcepts = normalizedConcepts
    .filter(c => c.is_active && (c.type === movementType || c.type === 'ambos'));

  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setObservations('');
      setIsProcessing(false);
      if (availableConcepts.length > 0) {
        setSelectedConcept(availableConcepts[0].name);
      }
    }
  }, [isOpen, movementType]);

  if (!isOpen) return null;

  const activeSessionId = sessionId || currentSession?.id;
  const activeStoreId = storeId || currentStore?.id || null;
  const activeRegisterId = registerId || currentSession?.register_id || null;
  const activeUserName = sessionUser || userProfile?.full_name || currentUser?.email || 'Cajero';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Por favor ingresa un monto válido mayor a 0.');
      return;
    }
    if (!selectedConcept) {
      alert('Por favor selecciona un concepto para el movimiento.');
      return;
    }
    if (!activeSessionId) {
      alert('Debes tener una sesión de caja activa abierta para registrar movimientos de dinero.');
      return;
    }

    setIsProcessing(true);
    try {
      const userName = activeUserName;

      // 1. Insert in pos_cash_movements if table exists
      try {
        await supabase.from('pos_cash_movements').insert([{
          session_id: activeSessionId,
          store_id: activeStoreId,
          register_id: activeRegisterId,
          tipo: movementType,
          concepto: selectedConcept,
          monto: numAmount,
          observaciones: observations.trim() || null,
          usuario: userName
        }]);
      } catch (tableErr) {
        console.warn('pos_cash_movements insert warning:', tableErr);
      }

      // 2. Also register in pos_payments or update session observations for tracking
      const newObs = `[MOVIMIENTO CAJA - ${movementType.toUpperCase()}]: $${numAmount.toLocaleString('es-CO')} | Concepto: ${selectedConcept}${observations ? ` | Obs: ${observations}` : ''} | Por: ${userName}`;

      const { data: sessData } = await supabase
        .from('pos_cash_sessions')
        .select('observaciones')
        .eq('id', currentSession.id)
        .maybeSingle();

      const existingObs = sessData?.observaciones || '';
      await supabase
        .from('pos_cash_sessions')
        .update({
          observaciones: existingObs ? `${existingObs} \n${newObs}` : newObs
        })
        .eq('id', currentSession.id);

      // Save to local storage for offline session ledger
      const localLedgerKey = `pos_cash_ledger_${currentSession.id}`;
      const existingLedger = JSON.parse(localStorage.getItem(localLedgerKey) || '[]');
      existingLedger.push({
        id: `mov_${Date.now()}`,
        tipo: movementType,
        concepto: selectedConcept,
        monto: numAmount,
        observaciones: observations,
        usuario: userName,
        created_at: new Date().toISOString()
      });
      localStorage.setItem(localLedgerKey, JSON.stringify(existingLedger));

      alert(`✅ ${movementType === 'ingreso' ? 'Ingreso' : 'Retiro'} de $${numAmount.toLocaleString('es-CO')} registrado exitosamente.`);
      onMovementSaved();
      onClose();
    } catch (err: any) {
      console.error('Error saving cash movement:', err);
      alert('Error guardando movimiento de caja: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.78)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '1rem'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '480px',
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid #e2e8f0'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.75rem',
          background: movementType === 'ingreso' 
            ? 'linear-gradient(135deg, #065f46 0%, #047857 100%)' 
            : 'linear-gradient(135deg, #991b1b 0%, #b91c1c 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'background 0.3s'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {movementType === 'ingreso' ? <ArrowDownRight size={22} color="#ffffff" /> : <ArrowUpRight size={22} color="#ffffff" />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900' }}>
                Movimiento de Caja
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(255,255,255,0.85)' }}>
                {movementType === 'ingreso' ? 'Ingreso / Entrada de dinero en efectivo' : 'Retiro / Egreso de dinero (Gastos menores)'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'rgba(255,255,255,0.15)',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Movement Type Toggle */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              Tipo de Operación
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setMovementType('egreso')}
                style={{
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: movementType === 'egreso' ? '2px solid #ef4444' : '1.5px solid #cbd5e1',
                  backgroundColor: movementType === 'egreso' ? '#fef2f2' : '#ffffff',
                  color: movementType === 'egreso' ? '#b91c1c' : '#64748b',
                  fontWeight: '900',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem'
                }}
              >
                <ArrowUpRight size={16} /> 🔴 Retiro / Gasto
              </button>

              <button
                type="button"
                onClick={() => setMovementType('ingreso')}
                style={{
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: movementType === 'ingreso' ? '2px solid #10b981' : '1.5px solid #cbd5e1',
                  backgroundColor: movementType === 'ingreso' ? '#ecfdf5' : '#ffffff',
                  color: movementType === 'ingreso' ? '#047857' : '#64748b',
                  fontWeight: '900',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem'
                }}
              >
                <ArrowDownRight size={16} /> 🟢 Entrada / Ingreso
              </button>
            </div>
          </div>

          {/* Concept Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              Concepto del Movimiento (Parametrizable en Ajustes UX)
            </label>
            <select
              value={selectedConcept}
              onChange={e => setSelectedConcept(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
                fontSize: '0.9rem',
                fontWeight: '700',
                color: '#0f172a',
                outline: 'none',
                backgroundColor: '#f8fafc'
              }}
            >
              {availableConcepts.map(c => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Amount Input */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              Monto en Efectivo ($ COP)
            </label>
            <div style={{ position: 'relative' }}>
              <DollarSign size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                type="number"
                min="100"
                step="100"
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Ej: 15000"
                style={{
                  width: '100%',
                  padding: '0.8rem 1rem 0.8rem 2.6rem',
                  borderRadius: '10px',
                  border: '2px solid #cbd5e1',
                  fontSize: '1.1rem',
                  fontWeight: '950',
                  color: '#0f172a',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Observations */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              Observaciones / Justificación (Opcional)
            </label>
            <input
              type="text"
              value={observations}
              onChange={e => setObservations(e.target.value)}
              placeholder="Ej: Pago parqueadero cliente, compra de bolsas..."
              style={{
                width: '100%',
                padding: '0.7rem 1rem',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '0.85rem',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#475569',
                fontWeight: '800',
                fontSize: '0.88rem',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isProcessing || !amount}
              style={{
                flex: 1.5,
                padding: '0.85rem',
                borderRadius: '12px',
                border: 'none',
                background: movementType === 'ingreso'
                  ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                  : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                color: '#ffffff',
                fontWeight: '900',
                fontSize: '0.92rem',
                cursor: isProcessing || !amount ? 'not-allowed' : 'pointer',
                opacity: isProcessing || !amount ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                boxShadow: '0 4px 14px rgba(0,0,0,0.18)'
              }}
            >
              {isProcessing ? <RefreshCw size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              Confirmar {movementType === 'ingreso' ? 'Ingreso' : 'Retiro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
