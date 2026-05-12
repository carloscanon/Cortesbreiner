'use client';

import { 
  Plus, 
  MapPin, 
  Phone, 
  Star, 
  Calendar,
  Users,
  Search,
  MoreVertical
} from 'lucide-react';

const workshops = [
  { 
    id: 1, 
    name: 'Taller San Jose', 
    manager: 'Marta Rodriguez', 
    address: 'Calle 45 # 12-34', 
    phone: '310 123 4567',
    capacity: 200, 
    specialty: 'Camisas / Blusas',
    rating: 4.8,
    activeLots: 3
  },
  { 
    id: 2, 
    name: 'Confecciones Elite', 
    manager: 'Jorge Perez', 
    address: 'Av. Siempre Viva 123', 
    phone: '312 987 6543',
    capacity: 500, 
    specialty: 'Jeans / Denim',
    rating: 4.5,
    activeLots: 5
  },
  { 
    id: 3, 
    name: 'Satélite La Aurora', 
    manager: 'Lucia Gomez', 
    address: 'Carrera 10 # 56-78', 
    phone: '315 456 7890',
    capacity: 150, 
    specialty: 'Ropa Deportiva',
    rating: 4.9,
    activeLots: 2
  },
];

export default function WorkshopsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Talleres Satélite</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Administra tus talleres externos y controla la producción delegada.</p>
        </div>
        <button className="btn btn-primary">
          <Plus size={18} /> Registrar Taller
        </button>
      </div>

      <div style={{ position: 'relative' }}>
        <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input 
          type="text" 
          placeholder="Buscar taller por nombre, especialidad o responsable..." 
          style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 3rem', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '0.875rem' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {workshops.map((workshop) => (
          <div key={workshop.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '1.125rem', marginBottom: '0.25rem' }}>{workshop.name}</h3>
                <span className="badge badge-info" style={{ fontSize: '0.625rem' }}>{workshop.specialty}</span>
              </div>
              <button className="btn-icon"><MoreVertical size={16} color="var(--text-muted)" /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                <Users size={16} />
                <span>Responsable: <strong>{workshop.manager}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                <MapPin size={16} />
                <span>{workshop.address}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                <Phone size={16} />
                <span>{workshop.phone}</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
              <div>
                <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Capacidad Diaria</p>
                <p style={{ fontSize: '1rem', fontWeight: '700', marginTop: '0.25rem' }}>{workshop.capacity} pnd</p>
              </div>
              <div>
                <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Lotes Activos</p>
                <p style={{ fontSize: '1rem', fontWeight: '700', marginTop: '0.25rem' }}>{workshop.activeLots}</p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Star size={16} fill="#F59E0B" color="#F59E0B" />
                <span style={{ fontSize: '0.875rem', fontWeight: '700' }}>{workshop.rating}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/ 5.0</span>
              </div>
              <button className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}>
                Enviar Lote
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
