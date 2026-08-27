'use client';

import { useState } from 'react';
import FabricsInventory from '@/components/FabricsInventory';
import FinishedGoodsInventory from '@/components/FinishedGoodsInventory';
import AccessoriesInventory from '@/components/AccessoriesInventory';
import { Package, Layers, Tag } from 'lucide-react';

export default function ConsolidatedInventoryPage() {
  const [activeInventory, setActiveInventory] = useState<'terminado' | 'telas' | 'accesorios'>('terminado');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '4rem' }}>
      {/* Unified Tab Switcher */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '1rem',
        backgroundColor: 'white',
        padding: '1rem 1.5rem',
        borderRadius: '16px',
        border: '1px solid #f1f5f9',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.01)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: '10px', 
            backgroundColor: '#80082E', 
            color: 'white', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(128, 8, 46, 0.25)'
          }}>
            <Package size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: '950', margin: 0, color: '#0f172a' }}>Inventario Operativo General</h1>
            <p style={{ color: '#64748b', fontSize: '0.75rem', margin: 0 }}>Gestión de Materia Prima, Accesorios e Insumos y Producto Terminado</p>
          </div>
        </div>

        <div style={{ 
          display: 'flex', 
          backgroundColor: '#f1f5f9', 
          padding: '0.25rem', 
          borderRadius: '12px',
          gap: '0.25rem',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setActiveInventory('terminado')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              border: 'none',
              backgroundColor: activeInventory === 'terminado' ? '#80082E' : 'transparent',
              color: activeInventory === 'terminado' ? 'white' : '#475569',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: '800',
              cursor: 'pointer',
              boxShadow: activeInventory === 'terminado' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s'
            }}
          >
            <Package size={14} />
            Producto Terminado Operativo
          </button>

          <button
            onClick={() => setActiveInventory('telas')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              border: 'none',
              backgroundColor: activeInventory === 'telas' ? 'white' : 'transparent',
              color: activeInventory === 'telas' ? '#80082E' : '#475569',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: '800',
              cursor: 'pointer',
              boxShadow: activeInventory === 'telas' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s'
            }}
          >
            <Layers size={14} />
            Materia Prima (Telas)
          </button>

          <button
            onClick={() => setActiveInventory('accesorios')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              border: 'none',
              backgroundColor: activeInventory === 'accesorios' ? 'white' : 'transparent',
              color: activeInventory === 'accesorios' ? '#80082E' : '#475569',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: '800',
              cursor: 'pointer',
              boxShadow: activeInventory === 'accesorios' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s'
            }}
          >
            <Tag size={14} />
            Accesorios e Insumos
          </button>
        </div>
      </div>

      {/* Render selected sub-inventory */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #f1f5f9', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
        {activeInventory === 'terminado' ? (
          <FinishedGoodsInventory />
        ) : activeInventory === 'telas' ? (
          <FabricsInventory />
        ) : (
          <AccessoriesInventory />
        )}
      </div>
    </div>
  );
}
