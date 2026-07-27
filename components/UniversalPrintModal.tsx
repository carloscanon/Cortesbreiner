'use client';

import React, { useState, useEffect } from 'react';
import { PrintLabelService, PrintProfile, GarmentLabelData } from '@/lib/PrintLabelService';
import { X, Printer, Download, RefreshCw, Sliders, CheckCircle2 } from 'lucide-react';

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: GarmentLabelData[];
  defaultModuleName?: string;
}

export default function UniversalPrintModal({
  isOpen,
  onClose,
  items,
  defaultModuleName = 'confeccion'
}: PrintModalProps) {
  const [profiles, setProfiles] = useState<PrintProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<PrintProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadProfiles();
    }
  }, [isOpen]);

  const loadProfiles = async () => {
    setLoading(true);
    const availableProfiles = await PrintLabelService.getProfiles();
    setProfiles(availableProfiles);

    const initial =
      availableProfiles.find((p) => p.module === defaultModuleName) ||
      availableProfiles.find((p) => p.is_default) ||
      availableProfiles[0] ||
      PrintLabelService.getDefaultProfile(defaultModuleName);

    setSelectedProfile(initial);
    setLoading(false);
  };

  if (!isOpen) return null;

  const profile = selectedProfile || PrintLabelService.getDefaultProfile(defaultModuleName);
  const layout = PrintLabelService.calculateLayout(profile, items.length);

  // Group garments into pages according to layout
  const pages: GarmentLabelData[][] = [];
  for (let i = 0; i < items.length; i += layout.labelsPerPage) {
    pages.push(items.slice(i, i + layout.labelsPerPage));
  }

  const handlePrint = () => {
    setIsGenerating(true);
    setTimeout(() => {
      window.print();
      setIsGenerating(false);
    }, 300);
  };

  const handleDownloadPDF = () => {
    window.print();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '1.5rem'
      }}
    >
      <div
        className="card"
        style={{
          width: '95%',
          maxWidth: '1100px',
          height: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 2rem',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '900', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Printer size={22} color="#34d399" /> Motor de Impresión Industrial - Etiquetas Unitarias
            </h2>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
              Impresión vectorial parametrizada ({items.length} etiquetas registradas)
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              borderRadius: '50%',
              padding: '0.5rem',
              display: 'flex'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Main Body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Sidebar Controls */}
          <div
            style={{
              width: '320px',
              borderRight: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              overflowY: 'auto'
            }}
          >
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#475569', marginBottom: '0.5rem' }}>
                🖨️ PERFIL DE IMPRESIÓN ACTIVO
              </label>
              <select
                className="select"
                style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontWeight: '700', fontSize: '0.85rem' }}
                value={profile.id}
                onChange={(e) => {
                  const selected = profiles.find((p) => p.id === e.target.value);
                  if (selected) setSelectedProfile(selected);
                }}
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.paper_size || `${p.width_mm}x${p.height_mm}mm`})
                  </option>
                ))}
              </select>
            </div>

            {/* Profile Summary Card */}
            <div style={{ padding: '1rem', backgroundColor: 'white', border: '1.5px solid #e2e8f0', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.78rem' }}>
              <span style={{ fontWeight: '800', color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.3rem', marginBottom: '0.2rem' }}>
                📋 Especificaciones del Perfil
              </span>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Papel:</span>
                <span style={{ fontWeight: '700', color: '#0f172a' }}>{profile.paper_size || 'Zebra 100x100mm'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Dimensiones:</span>
                <span style={{ fontWeight: '700', color: '#0f172a' }}>{profile.width_mm}mm × {profile.height_mm}mm</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Distribución:</span>
                <span style={{ fontWeight: '700', color: '#0f172a' }}>{layout.cols} columnas / fila</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Márgenes:</span>
                <span style={{ fontWeight: '700', color: '#0f172a' }}>T:{profile.margin_top} L:{profile.margin_left} R:{profile.margin_right} B:{profile.margin_bottom}mm</span>
              </div>
            </div>

            {/* Stats */}
            <div style={{ padding: '1rem', backgroundColor: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.78rem' }}>
              <span style={{ fontWeight: '800', color: '#166534' }}>📊 Resumen de Generación</span>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#15803d' }}>Total Etiquetas:</span>
                <span style={{ fontWeight: '900', color: '#166534', fontSize: '0.9rem' }}>{items.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#15803d' }}>Total Páginas PDF:</span>
                <span style={{ fontWeight: '900', color: '#166534', fontSize: '0.9rem' }}>{layout.totalPages}</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: 'auto' }}>
              <button
                onClick={handlePrint}
                disabled={isGenerating}
                style={{
                  padding: '0.85rem',
                  fontSize: '0.88rem',
                  fontWeight: '900',
                  backgroundColor: '#80082E',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 12px rgba(128, 8, 46, 0.25)'
                }}
              >
                <Printer size={18} /> {isGenerating ? 'Enviando...' : 'IMPRIMIR ETIQUETAS'}
              </button>

              <button
                onClick={handleDownloadPDF}
                style={{
                  padding: '0.75rem',
                  fontSize: '0.82rem',
                  fontWeight: '800',
                  backgroundColor: '#0f172a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <Download size={16} /> Descargar PDF
              </button>
            </div>
          </div>

          {/* Live Preview Canvas */}
          <div
            style={{
              flex: 1,
              backgroundColor: '#cbd5e1',
              padding: '2rem',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'white', padding: '0.4rem 1rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: '800', color: '#475569', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              👁️ Vista Previa Vectorial ({layout.totalPages} Página{layout.totalPages > 1 ? 's' : ''})
            </div>

            {pages.map((pageGarments, pageIdx) => (
              <div
                key={pageIdx}
                style={{
                  width: `${profile.width_mm * 3.78}px`,
                  height: `${profile.height_mm * 3.78}px`,
                  backgroundColor: 'white',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                  padding: `${profile.margin_top * 3.78}px ${profile.margin_right * 3.78}px ${profile.margin_bottom * 3.78}px ${profile.margin_left * 3.78}px`,
                  boxSizing: 'border-box',
                  display: 'grid',
                  gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
                  gap: `${layout.spacingX * 3.78}px`,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {pageGarments.map((g, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: '1px solid #0f172a',
                      borderRadius: '4px',
                      padding: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      backgroundColor: 'white',
                      overflow: 'hidden',
                      boxSizing: 'border-box'
                    }}
                  >
                    {/* Header */}
                    {profile.elements?.company?.enabled !== false && (
                      <div style={{ textAlign: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '2px' }}>
                        <span style={{ fontSize: `${(profile.elements?.company?.fontSize || 0.6) * 0.75}rem`, fontWeight: '900', color: profile.elements?.company?.color || '#80082E' }}>
                          {g.company_name || 'CORTES BREINER'}
                        </span>
                      </div>
                    )}

                    {/* Reference Name */}
                    {profile.elements?.title?.enabled !== false && (
                      <div style={{ textAlign: 'center', margin: '2px 0' }}>
                        <span style={{ fontSize: `${(profile.elements?.title?.fontSize || 0.65) * 0.75}rem`, fontWeight: '900', color: profile.elements?.title?.color || '#1e293b' }}>
                          {g.reference_name || 'Referencia'}
                        </span>
                      </div>
                    )}

                    {/* Color */}
                    {profile.elements?.client?.enabled !== false && g.color_name && (
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: `${(profile.elements?.client?.fontSize || 0.55) * 0.75}rem`, fontWeight: '700', color: profile.elements?.client?.color || '#64748b' }}>
                          {g.color_name}
                        </span>
                      </div>
                    )}

                    {/* Barcode */}
                    {profile.elements?.barcode?.enabled !== false && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '2px 0' }}>
                        <div style={{ display: 'flex', gap: '1px', height: `${(profile.elements?.barcode?.height || 12) * 1.5}px`, width: `${(profile.elements?.barcode?.width || 22) * 2.5}px`, maxWidth: '100%', justifyContent: 'center' }}>
                          {Array.from({ length: 24 }).map((_, bIdx) => (
                            <div key={bIdx} style={{ flexGrow: bIdx % 3 === 0 ? 2 : 1, height: '100%', backgroundColor: '#000000' }} />
                          ))}
                        </div>
                        <span style={{ fontSize: '0.5rem', fontWeight: '950', letterSpacing: '0.04em', marginTop: '1px' }}>
                          {g.barcode}
                        </span>
                      </div>
                    )}

                    {/* Size Badge */}
                    {profile.elements?.total?.enabled !== false && (
                      <div style={{ display: 'flex', justifyContent: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '2px' }}>
                        <span style={{ fontSize: `${(profile.elements?.total?.fontSize || 0.85) * 0.65}rem`, fontWeight: '900', backgroundColor: '#0f172a', color: 'white', padding: '1px 6px', borderRadius: '3px' }}>
                          {g.size_code || 'S/T'}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Embedded Print CSS Rule */}
      <style>{`
        @media print {
          @page {
            size: ${profile.width_mm}mm ${profile.height_mm}mm !important;
            margin: 0 !important;
          }
          body * {
            visibility: hidden !important;
          }
          #print-export-root, #print-export-root * {
            visibility: visible !important;
          }
          #print-export-root {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: ${profile.width_mm}mm !important;
            z-index: 9999999 !important;
          }
        }
      `}</style>
    </div>
  );
}
