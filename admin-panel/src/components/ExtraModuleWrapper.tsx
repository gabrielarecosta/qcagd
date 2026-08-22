import React from 'react';

interface ExtraModuleWrapperProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function ExtraModuleWrapper({ 
  children, 
  title = "Funcionalidad Extendida (Cotiza Aparte)",
  description = "Esta sección está contemplada como un módulo adicional opcional según la propuesta técnico-comercial. Se puede activar e incorporar en una etapa de trabajo independiente."
}: ExtraModuleWrapperProps) {
  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '300px' }}>
      {/* Contenido con desfoque blureado suave visible */}
      <div style={{ 
        filter: 'blur(1.5px)', 
        opacity: 0.85, 
        pointerEvents: 'none', 
        userSelect: 'none',
        transition: 'all 0.3s ease'
      }}>
        {children}
      </div>

      {/* Cartel Flotante sobre el blureado */}
      <div style={{
        position: 'absolute',
        top: '30px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(8px)',
        color: '#ffffff',
        padding: '20px 28px',
        borderRadius: '14px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.25)',
        textAlign: 'center',
        maxWidth: '520px',
        width: '90%',
        border: '1.5px solid #ef4444'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '20px' }}>🔒</span>
          <span style={{ 
            backgroundColor: '#ef4444', 
            color: '#ffffff', 
            fontSize: '11px', 
            fontWeight: 800, 
            padding: '3px 8px', 
            borderRadius: '6px', 
            textTransform: 'uppercase', 
            letterSpacing: '0.5px' 
          }}>
            📌 MÓDULO ADICIONAL OPCIONAL
          </span>
        </div>
        <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
          {title}
        </h3>
        <p style={{ margin: 0, fontSize: '12.5px', color: '#cbd5e1', lineHeight: '1.5' }}>
          {description}
        </p>
      </div>
    </div>
  );
}
