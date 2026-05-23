'use client';

import { useState, useEffect } from 'react';
import { 
  Calculator, 
  Save, 
  ArrowLeft,
  Info,
  Layers,
  Scissors,
  Weight
} from 'lucide-react';
import Link from 'next/link';

export default function CutRegistrationPage() {
  const [formData, setFormData] = useState({
    yield: 4.5, // Rendimiento
    length: 3.2, // Largo trazo
    longitud: 1, // Longitud (default 1)
    layers: 100, // Capas
    color: 'Negro',
    initialKilos: 50,
  });

  const [sizes, setSizes] = useState({
    S: 1,
    M: 2,
    L: 1,
    XL: 1,
  });

  const [results, setResults] = useState({
    totalPrendas: 0,
    consumoKilos: 0,
    consumoPorPrenda: 0,
    kilosRestantes: 0,
    mermaPercent: 0,
    costoCorte: 0
  });

  useEffect(() => {
    const totalPorLoteRaw = Object.values(sizes).reduce((a, b) => a + b, 0);
    const totalPorLote = totalPorLoteRaw / formData.longitud;
    const totalPrendas = totalPorLote * formData.layers;
    const consumoKilos = totalPrendas / formData.yield;
    const marcacionesActivas = Object.values(sizes).filter(v => v >= 1).length;
    const consumoPorPrenda = marcacionesActivas > 0 ? formData.longitud / marcacionesActivas : 0;
    const kilosRestantes = formData.initialKilos - consumoKilos;
    const mermaPercent = ((formData.initialKilos - consumoKilos) / formData.initialKilos) * 100;
    
    setResults({
      totalPrendas,
      consumoKilos: Number(consumoKilos.toFixed(2)),
      consumoPorPrenda: Number(consumoPorPrenda.toFixed(2)),
      kilosRestantes: Number(kilosRestantes.toFixed(2)),
      mermaPercent: Number(mermaPercent.toFixed(2)),
      costoCorte: totalPrendas * 1500 // Ejemplo: 1500 por prenda
    });
  }, [formData, sizes]);

  const handleSizeChange = (size: string, val: string) => {
    setSizes(prev => ({ ...prev, [size]: parseInt(val) || 0 }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link href="/orders" className="btn btn-secondary" style={{ padding: '0.5rem' }}>
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1>Registro de Corte</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Orden OC-001 | Moda Latina | Lino Premium</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Main Parameters */}
          <div className="card">
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Scissors size={18} /> Parámetros del Trazo
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.5rem' }}>Rendimiento (Prendas/Kg)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={formData.yield}
                  onChange={(e) => setFormData({...formData, yield: parseFloat(e.target.value)})}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                />
              </div>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.5rem' }}>Largo Trazo (Mts)</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={formData.length}
                  onChange={(e) => setFormData({...formData, length: parseFloat(e.target.value)})}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                />
              </div>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.5rem' }}>Capas</label>
                <input 
                  type="number" 
                  value={formData.layers}
                  onChange={(e) => setFormData({...formData, layers: parseInt(e.target.value)})}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                />
              </div>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.5rem' }}>Color</label>
                <input 
                  type="text" 
                  value={formData.color}
                  onChange={(e) => setFormData({...formData, color: e.target.value})}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                />
              </div>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.5rem' }}>Kilos Iniciales</label>
                <input 
                  type="number" 
                  value={formData.initialKilos}
                  onChange={(e) => setFormData({...formData, initialKilos: parseFloat(e.target.value)})}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                />
              </div>
            </div>
          </div>

          {/* Size Matrix */}
          <div className="card">
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={18} /> Matriz de Tallas (Por Lote)
            </h3>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              {Object.keys(sizes).map((size) => (
                <div key={size} style={{ flex: 1, textAlign: 'center' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.75rem', color: 'var(--primary)' }}>{size}</label>
                  <input 
                    type="number" 
                    value={sizes[size as keyof typeof sizes]}
                    onChange={(e) => handleSizeChange(size, e.target.value)}
                    style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '2px solid var(--primary-lighter)', textAlign: 'center', fontSize: '1.125rem', fontWeight: '600' }}
                  />
                </div>
              ))}
              <div style={{ flex: 1, textAlign: 'center' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '700', marginBottom: '0.75rem', color: 'var(--text-muted)' }}>Total Lote</label>
                <div style={{ width: '100%', padding: '1rem', borderRadius: '12px', backgroundColor: '#f1f5f9', fontSize: '1.125rem', fontWeight: '600', border: '2px solid transparent' }}>
                  {Object.values(sizes).reduce((a, b) => a + b, 0)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Results Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ backgroundColor: 'var(--primary)', color: 'white', border: 'none' }}>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1rem' }}>Resumen de Producción</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', opacity: 0.8 }}>Total Prendas</span>
                <span style={{ fontSize: '1.25rem', fontWeight: '700' }}>{results.totalPrendas}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', opacity: 0.8 }}>Consumo Tela</span>
                <span style={{ fontSize: '1.125rem', fontWeight: '600' }}>{results.consumoKilos} Kg</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', opacity: 0.8 }}>Consumo / Prenda</span>
                <span style={{ fontSize: '1.125rem', fontWeight: '600' }}>{results.consumoPorPrenda} Kg</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', opacity: 0.8 }}>Kilos Restantes</span>
                <span style={{ fontSize: '1.125rem', fontWeight: '600' }}>{results.kilosRestantes} Kg</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', opacity: 0.8 }}>Merma %</span>
                <span style={{ fontSize: '1.125rem', fontWeight: '600', color: results.mermaPercent > 5 ? '#fca5a5' : '#86efac' }}>{results.mermaPercent}%</span>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>Costo Corte</span>
                <span style={{ fontSize: '1.25rem', fontWeight: '700' }}>${results.costoCorte.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <button className="btn btn-primary" style={{ width: '100%', padding: '1rem', justifyContent: 'center' }}>
            <Save size={18} /> Guardar Registro
          </button>
          
          <div className="card" style={{ padding: '1rem', backgroundColor: '#fefce8', border: '1px solid #fef08a' }}>
            <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#854d0e', fontWeight: '600' }}>
              <Info size={14} /> Recomendación
            </p>
            <p style={{ fontSize: '0.75rem', color: '#854d0e', marginTop: '0.5rem' }}>
              El rendimiento actual es óptimo para este tipo de tela. Se recomienda mantener las capas bajo 120 para asegurar la precisión del corte.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
