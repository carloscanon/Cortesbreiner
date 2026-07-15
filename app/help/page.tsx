'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { 
  HelpCircle, 
  BookOpen, 
  Scissors, 
  Truck, 
  CheckCircle2, 
  DollarSign, 
  MessageCircle, 
  ChevronDown, 
  Search,
  Factory,
  Settings,
  ShieldAlert
} from 'lucide-react';

export default function HelpPage() {
  const { profile } = useAuth();
  const isTaller = profile?.roles?.name === 'Taller';
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const faqs = [
    // FAQs for satellite workshops
    {
      id: 1,
      category: 'taller',
      question: '¿Cómo funciona el registro de avance de confección?',
      answer: 'Desde tu panel de inicio (Dashboard), verás una lista de "Estado y Detalle de Mis Talleres". Haz clic en el botón de expansión del taller y verás los lotes. El porcentaje de avance se actualiza automáticamente según la cantidad de prendas que la planta registre en la mesa de corte y producción.',
      icon: Scissors
    },
    {
      id: 2,
      category: 'taller',
      question: '¿Cómo imprimo o descargo la Relación de Despacho?',
      answer: 'Haz clic en el lote de confección (con código como OC-XXXX) en tu panel para abrir los detalles del lote. Allí verás toda la información detallada de tallas, colores e insumos. Puedes usar la función de impresión de tu navegador para imprimir este comprobante físico.',
      icon: BookOpen
    },
    {
      id: 3,
      category: 'taller',
      question: '¿Qué es el "Saldo Confeccionado" y cómo se calcula?',
      answer: 'Es el valor acumulado de las prendas que ya han sido confeccionadas por tu taller y aprobadas en el control de calidad. Se calcula multiplicando la cantidad de unidades aprobadas por la tarifa por unidad asignada a tu taller para esa referencia.',
      icon: DollarSign
    },
    {
      id: 4,
      category: 'taller',
      question: '¿Qué pasa si encuentro un error en la cantidad o tallas de un lote?',
      answer: 'No intentes modificar los datos. Ponte en contacto inmediato con el administrador de producción de la planta o el supervisor de despachos para que realicen la corrección desde el sistema central.',
      icon: ShieldAlert
    },
    // FAQs for plant/admin users
    {
      id: 5,
      category: 'admin',
      question: '¿Cómo asocio un usuario a un taller satélite específico?',
      answer: 'Ve al módulo de Ajustes > Usuarios. Al crear o editar un usuario con el rol "Taller", puedes asignarle su taller correspondiente en el selector. Esto limitará su acceso para que solo vea la información de sus propios lotes asignados.',
      icon: Factory
    },
    {
      id: 6,
      category: 'admin',
      question: '¿Cómo registro la inspección de calidad de una entrega?',
      answer: 'Dirígete al módulo de Calidad en el menú lateral. Selecciona el taller y la orden correspondiente, indica cuántas prendas fueron aprobadas y cuántas rechazadas/reprocesadas, y guarda el registro. Esto actualizará el saldo confeccionado del taller satélite en tiempo real.',
      icon: CheckCircle2
    },
    {
      id: 7,
      category: 'admin',
      question: '¿Dónde configuro las tarifas de confección de cada satélite?',
      answer: 'Las tarifas se pueden configurar en el módulo de Talleres o en el área de Ajustes > Maestros de Tarifas, asociando un precio específico por prenda y taller satélite.',
      icon: Settings
    }
  ];

  // Filter FAQs based on role and search query
  const filteredFaqs = faqs.filter(faq => {
    // If user is Taller, prioritize workshop FAQs. If admin, show all or admin FAQs.
    const matchesRole = isTaller ? faq.category === 'taller' : true;
    const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRole && matchesSearch;
  });

  const toggleFaq = (id: number) => {
    setExpandedFaq(expandedFaq === id ? null : id);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#80082E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Centro de Ayuda
          </span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '950', margin: '0.25rem 0 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.5rem', backgroundColor: '#80082E', borderRadius: '12px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <HelpCircle size={24} />
            </div>
            Soporte & Documentación
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem', margin: 0 }}>
            {isTaller 
              ? 'Guía de uso y respuestas a preguntas frecuentes para talleres satélite.' 
              : 'Documentación del sistema, guías administrativas y soporte técnico.'
            }
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ 
        position: 'relative', 
        backgroundColor: 'white', 
        borderRadius: '16px', 
        border: '1.5px solid #cbd5e1', 
        padding: '0.25rem 0.5rem 0.25rem 1.25rem',
        display: 'flex', 
        alignItems: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
        maxWidth: '600px'
      }}>
        <Search size={18} style={{ color: '#94a3b8', marginRight: '0.75rem' }} />
        <input 
          type="text" 
          placeholder="Busca por palabra clave (ej. avance, saldo, calidad)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ 
            border: 'none', 
            outline: 'none', 
            width: '100%', 
            padding: '0.75rem 0', 
            fontSize: '0.85rem', 
            fontWeight: '600',
            color: '#1e293b'
          }}
        />
      </div>

      {/* Main Sections */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
        
        {/* FAQs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '900', color: '#0f172a', margin: '0 0 0.5rem 0' }}>Preguntas Frecuentes</h2>
          
          {filteredFaqs.length === 0 ? (
            <div style={{ padding: '3rem', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1', textAlign: 'center', color: '#94a3b8' }}>
              No encontramos respuestas para "{searchQuery}". Intenta con otra palabra clave.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredFaqs.map((faq) => {
                const Icon = faq.icon;
                const isExpanded = expandedFaq === faq.id;
                return (
                  <div 
                    key={faq.id} 
                    style={{ 
                      backgroundColor: 'white', 
                      borderRadius: '14px', 
                      border: isExpanded ? '1.5px solid var(--primary)' : '1.5px solid #e2e8f0', 
                      overflow: 'hidden',
                      transition: 'all 0.15s ease',
                      boxShadow: isExpanded ? '0 10px 20px -10px rgba(0,0,0,0.05)' : 'none'
                    }}
                  >
                    <button 
                      onClick={() => toggleFaq(faq.id)}
                      style={{ 
                        width: '100%', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        padding: '1.25rem 1.5rem', 
                        border: 'none', 
                        background: 'none', 
                        cursor: 'pointer', 
                        textAlign: 'left' 
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ 
                          width: '36px', 
                          height: '36px', 
                          borderRadius: '10px', 
                          backgroundColor: isExpanded ? 'var(--primary-lighter)' : '#f1f5f9', 
                          color: isExpanded ? 'var(--primary)' : '#475569', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Icon size={18} />
                        </div>
                        <span style={{ fontSize: '0.875rem', fontWeight: '800', color: isExpanded ? 'var(--primary)' : '#1e293b' }}>
                          {faq.question}
                        </span>
                      </div>
                      <ChevronDown 
                        size={18} 
                        style={{ 
                          color: isExpanded ? 'var(--primary)' : '#94a3b8',
                          transform: isExpanded ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.2s ease'
                        }} 
                      />
                    </button>
                    
                    {isExpanded && (
                      <div style={{ 
                        padding: '0 1.5rem 1.25rem 4rem', 
                        fontSize: '0.825rem', 
                        color: '#475569', 
                        lineHeight: '1.5',
                        fontWeight: '500'
                      }}>
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Support Card */}
        <div style={{ 
          background: 'linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%)', 
          borderRadius: '20px', 
          padding: '2rem', 
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.5rem',
          boxShadow: '0 20px 40px -15px rgba(124,58,237,0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ 
              width: '56px', 
              height: '56px', 
              borderRadius: '16px', 
              backgroundColor: 'rgba(255,255,255,0.2)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <MessageCircle size={28} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900' }}>¿Aún tienes dudas?</h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.825rem', opacity: 0.9, fontWeight: '500' }}>
                Contacta directamente con soporte técnico o con la administración de planta para soporte inmediato.
              </p>
            </div>
          </div>
          <a 
            href="https://wa.me/573000000000" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ 
              backgroundColor: 'white', 
              color: 'var(--primary)', 
              padding: '0.8rem 1.5rem', 
              borderRadius: '12px', 
              fontWeight: '900', 
              fontSize: '0.825rem', 
              textDecoration: 'none',
              transition: 'transform 0.15s ease',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            Soporte por WhatsApp
          </a>
        </div>

      </div>
    </div>
  );
}
