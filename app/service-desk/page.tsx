'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Filter, 
  MessageSquare, 
  MoreVertical, 
  Plus, 
  Search, 
  Tag, 
  User, 
  Activity,
  ListTodo
} from 'lucide-react';
import Link from 'next/link';

export default function ServiceDeskPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // ITIL Status Columns
  const columns = ['Nuevo', 'Asignado', 'En Curso', 'Resuelto', 'Cerrado'];

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('service_desk_tickets')
        .select(`
          *,
          reporter:reporter_id(nombre, role),
          assignee:assignee_id(nombre, role)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('La tabla service_desk_tickets aún no existe o hay error:', error);
        setTickets([]);
      } else {
        setTickets(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Crítica': return { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' };
      case 'Alta': return { bg: '#ffedd5', text: '#9a3412', border: '#fdba74' };
      case 'Media': return { bg: '#fef3c7', text: '#92400e', border: '#fde68a' };
      case 'Baja': return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
      default: return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
    }
  };

  const filteredTickets = tickets.filter(t => 
    (t.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.ticket_number || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#0f172a', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Activity size={28} color="#2563eb" />
            Mesa de Servicio (ITIL)
          </h1>
          <p style={{ color: '#64748b', margin: 0, fontSize: '0.95rem' }}>
            Gestión centralizada de incidencias, calidad e inventario con control de Acuerdos de Nivel de Servicio (ANS).
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              type="text" 
              placeholder="Buscar incidencia (INC-)..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: '0.6rem 1rem 0.6rem 2.4rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', width: '280px' }}
            />
          </div>
          <button style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', padding: '0.6rem 1.2rem', fontWeight: '700', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)' }}>
            <Plus size={18} /> Nueva Incidencia
          </button>
        </div>
      </div>

      {/* KANBAN BOARD */}
      <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem', minHeight: '65vh' }}>
        {columns.map(col => {
          const colTickets = filteredTickets.filter(t => t.status === col);
          return (
            <div key={col} style={{ flex: '0 0 320px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '1rem', borderBottom: '2px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '800', color: '#334155', textTransform: 'uppercase' }}>
                  {col}
                </h3>
                <span style={{ backgroundColor: '#e2e8f0', color: '#475569', fontSize: '0.75rem', fontWeight: '800', padding: '0.1rem 0.6rem', borderRadius: '99px' }}>
                  {colTickets.length}
                </span>
              </div>
              
              <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, overflowY: 'auto' }}>
                {colTickets.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                    No hay incidencias
                  </div>
                ) : (
                  colTickets.map(ticket => {
                    const pColors = getPriorityColor(ticket.priority);
                    return (
                      <div key={ticket.id} style={{ backgroundColor: 'white', borderRadius: '10px', padding: '1rem', border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: '900', color: '#2563eb' }}>{ticket.ticket_number}</span>
                          <span style={{ 
                            fontSize: '0.65rem', fontWeight: '800', padding: '0.2rem 0.5rem', borderRadius: '6px', 
                            backgroundColor: pColors.bg, color: pColors.text, border: `1px solid ${pColors.border}`
                          }}>
                            {ticket.priority}
                          </span>
                        </div>
                        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: '700', color: '#0f172a', lineHeight: '1.3' }}>
                          {ticket.title}
                        </h4>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.75rem', color: '#64748b' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Tag size={14} /> {ticket.category}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Clock size={14} color="#ea580c" /> Vence: {ticket.sla_deadline ? new Date(ticket.sla_deadline).toLocaleString() : 'Sin definir'}
                          </div>
                          {ticket.assignee && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid #f1f5f9' }}>
                              <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5', fontWeight: '800', fontSize: '0.6rem' }}>
                                {ticket.assignee.nombre?.charAt(0) || 'U'}
                              </div>
                              <span style={{ fontWeight: '600', color: '#334155' }}>{ticket.assignee.nombre}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
