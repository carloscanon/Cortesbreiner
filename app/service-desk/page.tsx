'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  AlertCircle, CheckCircle2, Clock, Filter, MessageSquare, 
  MoreVertical, Plus, Search, Tag, User, Activity, X, Send, Save, ArrowRight
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function ServiceDeskPage() {
  const { user, profile } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Drawer & Modal States
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTicket, setNewTicket] = useState({ title: '', description: '', priority: 'Media', category: 'Otro' });
  const [users, setUsers] = useState<any[]>([]);

  // ITIL Status Columns
  const columns = ['Nuevo', 'Asignado', 'En Curso', 'Resuelto', 'Cerrado'];

  useEffect(() => {
    fetchTickets();
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data } = await supabase.from('users').select('id, nombre, role');
    if (data) setUsers(data);
  };

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('service_desk_tickets')
        .select(`*, reporter:reporter_id(nombre, role), assignee:assignee_id(nombre, role)`)
        .order('created_at', { ascending: false });
      if (!error && data) setTickets(data);
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  const fetchTicketDetails = async (ticketId: string) => {
    const { data } = await supabase
      .from('service_desk_comments')
      .select('*, author:author_id(nombre)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    setComments(data || []);
  };

  const handleOpenTicket = (ticket: any) => {
    setSelectedTicket(ticket);
    setIsDrawerOpen(true);
    fetchTicketDetails(ticket.id);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.from('service_desk_tickets').insert([{
      title: newTicket.title,
      description: newTicket.description,
      priority: newTicket.priority,
      category: newTicket.category,
      reporter_id: user?.id,
      status: 'Nuevo'
    }]).select();

    if (!error && data) {
      setTickets([data[0], ...tickets]);
      setIsCreateModalOpen(false);
      setNewTicket({ title: '', description: '', priority: 'Media', category: 'Otro' });
    }
  };

  const handleUpdateStatus = async (ticketId: string, newStatus: string) => {
    await supabase.from('service_desk_tickets').update({ status: newStatus }).eq('id', ticketId);
    
    // Auto-add system note
    await supabase.from('service_desk_comments').insert([{
      ticket_id: ticketId, author_id: user?.id, content: `Cambió el estado a: ${newStatus}`, is_system_note: true
    }]);

    fetchTickets();
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket({ ...selectedTicket, status: newStatus });
      fetchTicketDetails(ticketId);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedTicket) return;
    await supabase.from('service_desk_comments').insert([{
      ticket_id: selectedTicket.id, author_id: user?.id, content: newComment, is_system_note: false
    }]);
    setNewComment('');
    fetchTicketDetails(selectedTicket.id);
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
    <div style={{ padding: '1.5rem', height: '100vh', display: 'flex', flexDirection: 'column', maxWidth: '1600px', margin: '0 auto', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '900', color: '#0f172a', margin: '0 0 0.4rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Activity size={26} color="#2563eb" />
            Mesa de Servicio (ITIL)
          </h1>
          <p style={{ color: '#64748b', margin: 0, fontSize: '0.9rem' }}>
            Gestión centralizada de incidencias, calidad e inventario con control de ANS.
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
              style={{ padding: '0.5rem 1rem 0.5rem 2.4rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', width: '250px' }}
            />
          </div>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 1rem', fontWeight: '700', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)' }}
          >
            <Plus size={18} /> Nueva Incidencia
          </button>
        </div>
      </div>

      {/* KANBAN BOARD */}
      <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', flex: 1, minHeight: 0 }}>
        {columns.map((col, idx) => {
          const colTickets = filteredTickets.filter(t => t.status === col);
          const nextCol = columns[idx + 1];
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
                      <div 
                        key={ticket.id} 
                        onClick={() => handleOpenTicket(ticket)}
                        style={{ backgroundColor: 'white', borderRadius: '10px', padding: '1rem', border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative' }}
                      >
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
                          {ticket.assignee && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid #f1f5f9' }}>
                              <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5', fontWeight: '800', fontSize: '0.6rem' }}>
                                {ticket.assignee.nombre?.charAt(0) || 'U'}
                              </div>
                              <span style={{ fontWeight: '600', color: '#334155' }}>{ticket.assignee.nombre}</span>
                            </div>
                          )}
                        </div>

                        {nextCol && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleUpdateStatus(ticket.id, nextCol); }}
                            style={{ position: 'absolute', bottom: '1rem', right: '1rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.25rem', cursor: 'pointer', color: '#475569' }}
                            title={`Mover a ${nextCol}`}
                          >
                            <ArrowRight size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* DRAWER DETALLE DE INCIDENCIA */}
      {isDrawerOpen && selectedTicket && (
        <div style={{ position: 'fixed', top: 0, right: 0, width: '450px', height: '100vh', backgroundColor: 'white', boxShadow: '-4px 0 15px rgba(0,0,0,0.1)', zIndex: 1000, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #cbd5e1' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: '#f8fafc' }}>
            <div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '900', color: '#2563eb' }}>{selectedTicket.ticket_number}</span>
                <span style={{ fontSize: '0.7rem', fontWeight: '800', padding: '0.2rem 0.5rem', borderRadius: '6px', backgroundColor: '#e2e8f0', color: '#475569' }}>
                  {selectedTicket.status}
                </span>
              </div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>{selectedTicket.title}</h2>
            </div>
            <button onClick={() => setIsDrawerOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
              <X size={20} />
            </button>
          </div>

          <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <h4 style={{ fontSize: '0.8rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Descripción</h4>
              <p style={{ fontSize: '0.85rem', color: '#334155', lineHeight: '1.5', margin: 0, backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                {selectedTicket.description || 'Sin descripción detallada.'}
              </p>
            </div>

            {/* Asignación y Cambio de Estado */}
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#475569', marginBottom: '0.4rem' }}>Estado</label>
                <select 
                  value={selectedTicket.status} 
                  onChange={(e) => handleUpdateStatus(selectedTicket.id, e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                >
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0' }} />

            {/* Historial y Comentarios */}
            <div>
              <h4 style={{ fontSize: '0.8rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '1rem' }}>Historial y Notas de Trabajo</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
                {comments.length === 0 ? (
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Aún no hay notas.</span>
                ) : (
                  comments.map(c => (
                    <div key={c.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: c.is_system_note ? '#f1f5f9' : '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.is_system_note ? '#64748b' : '#4f46e5', fontWeight: '800', fontSize: '0.75rem', flexShrink: 0 }}>
                        {c.is_system_note ? <Activity size={14} /> : (c.author?.nombre?.charAt(0) || 'U')}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.2rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#334155' }}>{c.is_system_note ? 'Sistema' : c.author?.nombre}</span>
                          <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{new Date(c.created_at).toLocaleString()}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: c.is_system_note ? '#64748b' : '#0f172a', fontStyle: c.is_system_note ? 'italic' : 'normal', backgroundColor: c.is_system_note ? 'transparent' : '#f8fafc', padding: c.is_system_note ? 0 : '0.75rem', borderRadius: '0 8px 8px 8px', border: c.is_system_note ? 'none' : '1px solid #e2e8f0' }}>
                          {c.content}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Agregar Comentario */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text"
                  placeholder="Escribe una nota de trabajo..."
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                  style={{ flex: 1, padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
                <button 
                  onClick={handleAddComment}
                  disabled={!newComment.trim()}
                  style={{ backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', padding: '0 1rem', cursor: 'pointer', opacity: newComment.trim() ? 1 : 0.5 }}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {isCreateModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '500px', padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', fontWeight: '800' }}>Reportar Nueva Incidencia</h2>
            <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Título</label>
                <input required type="text" value={newTicket.title} onChange={e => setNewTicket({...newTicket, title: e.target.value})} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Descripción</label>
                <textarea required rows={4} value={newTicket.description} onChange={e => setNewTicket({...newTicket, description: e.target.value})} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontFamily: 'inherit' }} />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Prioridad</label>
                  <select value={newTicket.priority} onChange={e => setNewTicket({...newTicket, priority: e.target.value})} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    <option value="Baja">Baja</option>
                    <option value="Media">Media</option>
                    <option value="Alta">Alta</option>
                    <option value="Crítica">Crítica</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.4rem' }}>Categoría</label>
                  <select value={newTicket.category} onChange={e => setNewTicket({...newTicket, category: e.target.value})} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    <option value="Inventario">Inventario</option>
                    <option value="Calidad">Calidad</option>
                    <option value="Confección">Confección</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setIsCreateModalOpen(false)} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', fontWeight: '700' }}>Cancelar</button>
                <button type="submit" style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', backgroundColor: '#2563eb', color: 'white', fontWeight: '700' }}>Guardar Ticket</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
