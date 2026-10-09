'use client';

import React from 'react';
import { Printer, CheckCircle2, X, ShoppingBag, Sparkles, ArrowRight, User, Calendar, CreditCard, Building2 } from 'lucide-react';

export interface POSReceiptData {
  saleId?: string;
  consecutive: number | string;
  consecutiveFormatted?: string;
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  storeNit?: string;
  vendedor?: string;
  cashier?: string;
  clientName: string;
  clientDocument?: string;
  clientDoc?: string;
  items: Array<{
    nombre: string;
    codigo_referencia?: string;
    color_name?: string;
    color?: string;
    size_name?: string;
    talla?: string;
    cantidad: number;
    precio: number;
    subtotal: number;
  }>;
  subtotal: number;
  descuento?: number;
  discount?: number;
  impuestos?: number;
  iva?: number;
  total: number;
  paymentMethod?: string;
  payments: Array<{
    metodo_pago: string;
    monto: number;
  }>;
  observaciones?: string;
  notes?: string;
  date?: string;
  dateFormatted?: string;
}

interface POSReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: POSReceiptData | null;
  onNewSale?: () => void;
  primaryColor?: string;
}

export default function POSReceiptModal({
  isOpen,
  onClose,
  receiptData,
  onNewSale,
  primaryColor = '#80082E'
}: POSReceiptModalProps) {
  if (!isOpen || !receiptData) return null;

  const handlePrint = () => {
    window.print();
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
        maxHeight: '92vh',
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid #e2e8f0'
      }}>
        {/* Header Question */}
        <div style={{
          padding: '1.25rem 1.5rem',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CheckCircle2 size={20} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '900' }}>
                ¡Venta Registrada con Éxito!
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                ¿Deseas imprimir la tirilla de pago?
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
              backgroundColor: 'rgba(255,255,255,0.1)',
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

        {/* Printable Thermal Receipt Card */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', backgroundColor: '#f8fafc' }}>
          <div id="pos-thermal-receipt" style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '2px dashed #cbd5e1',
            padding: '1.75rem 1.5rem',
            fontFamily: 'monospace',
            fontSize: '0.82rem',
            color: '#0f172a',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
          }}>
            {/* Store details */}
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #cbd5e1', paddingBottom: '0.75rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '950', letterSpacing: '0.05em' }}>
                CONFECCIONES BREINER
              </h2>
              <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '0.15rem' }}>
                {receiptData.storeName}
              </div>
              {receiptData.storeAddress && (
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{receiptData.storeAddress}</div>
              )}
              {receiptData.storePhone && (
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Tel: {receiptData.storePhone}</div>
              )}
              {receiptData.storeNit && (
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{receiptData.storeNit}</div>
              )}
              <div style={{ fontSize: '0.88rem', fontWeight: '900', color: primaryColor || '#80082E', marginTop: '0.35rem' }}>
                TICKET #{receiptData.consecutiveFormatted || receiptData.consecutive}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                Fecha: {receiptData.dateFormatted || receiptData.date || new Date().toLocaleString('es-CO')}
              </div>
            </div>

            {/* Client & Seller */}
            <div style={{ fontSize: '0.75rem', borderBottom: '1px dashed #cbd5e1', paddingBottom: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              <div><strong>Vendedor:</strong> {receiptData.vendedor || receiptData.cashier || 'Cajero POS'}</div>
              <div><strong>Cliente:</strong> {receiptData.clientName}</div>
              {(receiptData.clientDocument || receiptData.clientDoc) && (
                <div><strong>CC/NIT:</strong> {receiptData.clientDocument || receiptData.clientDoc}</div>
              )}
            </div>

            {/* Items list */}
            <div style={{ borderBottom: '1px dashed #cbd5e1', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 0.8fr 1.5fr', fontWeight: '900', fontSize: '0.72rem', color: '#475569', marginBottom: '0.4rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.2rem' }}>
                <span>DESCRIPCIÓN</span>
                <span style={{ textAlign: 'center' }}>CANT</span>
                <span style={{ textAlign: 'right' }}>VALOR</span>
              </div>
              {receiptData.items.map((it, idx) => {
                const col = it.color_name || it.color || '';
                const siz = it.size_name || it.talla || '';
                return (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2.5fr 0.8fr 1.5fr', fontSize: '0.75rem', marginBottom: '0.3rem', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: '850' }}>{it.nombre}</div>
                      {(col || siz) && (
                        <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                          {col} {siz ? `• Talla ${siz}` : ''}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'center', fontWeight: '800' }}>{it.cantidad}</div>
                    <div style={{ textAlign: 'right', fontWeight: '900' }}>
                      ${Number(it.subtotal || it.precio * it.cantidad).toLocaleString('es-CO')}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem', borderBottom: '1px dashed #cbd5e1', paddingBottom: '0.6rem' }}>
              {Number(receiptData.descuento || receiptData.discount || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
                  <span>Descuento / Crédito:</span>
                  <span>-${Number(receiptData.descuento || receiptData.discount).toLocaleString('es-CO')}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: '950', color: '#0f172a' }}>
                <span>TOTAL A PAGAR:</span>
                <span>${Number(receiptData.total).toLocaleString('es-CO')}</span>
              </div>
            </div>

            {/* Payment method */}
            <div style={{ fontSize: '0.75rem', borderBottom: '1px dashed #cbd5e1', paddingBottom: '0.5rem' }}>
              <strong>Forma(s) de Pago:</strong>
              {receiptData.payments && receiptData.payments.length > 0 ? (
                receiptData.payments.map((p, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.15rem' }}>
                    <span>• {p.metodo_pago}</span>
                    <span style={{ fontWeight: '800' }}>${Number(p.monto).toLocaleString('es-CO')}</span>
                  </div>
                ))
              ) : (
                <div style={{ marginTop: '0.15rem' }}>• {receiptData.paymentMethod || 'Efectivo'}</div>
              )}
            </div>

            {(receiptData.observaciones || receiptData.notes) && (
              <div style={{ fontSize: '0.68rem', color: '#64748b', borderBottom: '1px dashed #cbd5e1', paddingBottom: '0.5rem' }}>
                <strong>Notas:</strong> {receiptData.observaciones || receiptData.notes}
              </div>
            )}

            {/* Footer */}
            <div style={{ textAlign: 'center', fontSize: '0.7rem', color: '#64748b', lineHeight: 1.4 }}>
              ¡Gracias por su compra!
              <br />
              Conserve este ticket para cambios o garantías (máximo 30 días).
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{
          padding: '1.25rem 1.5rem',
          backgroundColor: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          gap: '0.75rem'
        }}>
          <button
            type="button"
            onClick={handlePrint}
            style={{
              flex: 1,
              padding: '0.85rem 1rem',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              color: '#ffffff',
              fontWeight: '900',
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 14px rgba(0,0,0,0.18)'
            }}
          >
            <Printer size={18} /> Imprimir Tirilla
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              if (onNewSale) onNewSale();
            }}
            style={{
              flex: 1,
              padding: '0.85rem 1rem',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              fontWeight: '900',
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 14px rgba(16,185,129,0.3)'
            }}
          >
            <Sparkles size={18} /> Nueva Venta
          </button>
        </div>
      </div>
    </div>
  );
}
