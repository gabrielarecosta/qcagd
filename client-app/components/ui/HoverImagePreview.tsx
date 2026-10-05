import React, { useState, useRef, useEffect } from 'react';
import { View, Platform, ViewStyle } from 'react-native';
import { formatPrice } from '../../utils/formatters';

let createPortal: any = null;
if (Platform.OS === 'web') {
  try {
    createPortal = require('react-dom').createPortal;
  } catch (_) {}
}

export interface HoverImagePreviewProps {
  imageUri?: string | null;
  name?: string;
  price?: number;
  presentation?: string;
  codigo?: string;
  children: React.ReactNode;
  style?: ViewStyle | any;
  delayMs?: number; // Por defecto 1000 ms (1 segundo)
}

/**
 * Componente que envuelve una imagen y al mantener el mouse encima durante 1 segundo,
 * muestra un popover flotante en alta resolución con la foto ampliada y los detalles del producto.
 */
export function HoverImagePreview({
  imageUri,
  name,
  price,
  presentation,
  codigo,
  children,
  style,
  delayMs = 1000,
}: HoverImagePreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const timeoutRef = useRef<any>(null);
  const targetRef = useRef<any>(null);

  const calculatePosition = (rect: DOMRect) => {
    if (typeof window === 'undefined') return;

    const PREVIEW_WIDTH = 290;
    const PREVIEW_HEIGHT = 350;
    const MARGIN = 14;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Horizontal: prioritariamente a la derecha, si no entra a la izquierda, o centrado
    let left = rect.right + MARGIN;
    if (left + PREVIEW_WIDTH > viewportWidth - MARGIN) {
      left = rect.left - PREVIEW_WIDTH - MARGIN;
      if (left < MARGIN) {
        left = Math.max(MARGIN, (viewportWidth - PREVIEW_WIDTH) / 2);
      }
    }

    // Vertical: alineado al borde superior del elemento, sin salirse de pantalla
    let top = rect.top - 15;
    if (top + PREVIEW_HEIGHT > viewportHeight - MARGIN) {
      top = viewportHeight - PREVIEW_HEIGHT - MARGIN;
    }
    if (top < MARGIN) {
      top = MARGIN;
    }

    setCoords({ top, left });
  };

  const handleMouseEnter = (e: any) => {
    if (!imageUri || Platform.OS !== 'web') return;

    const rect = e.currentTarget?.getBoundingClientRect?.();
    if (!rect) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      calculatePosition(rect);
      setIsOpen(true);
    }, delayMs);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsOpen(false);
  };

  // Si el usuario hace scroll, ocultamos la previsualización de inmediato
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    const handleScroll = () => {
      setIsOpen(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (Platform.OS !== 'web' || !imageUri) {
    return <View style={style}>{children}</View>;
  }

  const renderPreview = () => {
    if (!isOpen || !imageUri || typeof document === 'undefined') {
      return null;
    }

    const content = (
      <div
        style={{
          position: 'fixed',
          top: coords.top,
          left: coords.left,
          width: 290,
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(0, 0, 0, 0.08)',
          zIndex: 9999999,
          pointerEvents: 'none',
          padding: 12,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          animation: 'previewFadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <style>{`
          @keyframes previewFadeIn {
            from {
              opacity: 0;
              transform: scale(0.95) translateY(4px);
            }
            to {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }
        `}</style>

        {/* Badge superior */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#1A56DB',
              backgroundColor: '#EFF6FF',
              padding: '3px 8px',
              borderRadius: 6,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>🔍 Vista previa</span>
          </div>
          {codigo ? (
            <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>
              Cód: {codigo}
            </span>
          ) : null}
        </div>

        {/* Imagen en grande */}
        <div
          style={{
            width: '100%',
            height: 250,
            backgroundColor: '#F8FAFC',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            border: '1px solid #F1F5F9',
          }}
        >
          <img
            src={imageUri}
            alt={name || 'Producto'}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </div>

        {/* Datos del producto */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {name ? (
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: '#0F172A',
                lineHeight: 1.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {name}
            </div>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
            {presentation ? (
              <span style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>
                {presentation}
              </span>
            ) : <span />}

            {typeof price === 'number' && price > 0 ? (
              <span style={{ fontSize: 16, fontWeight: 800, color: '#1A56DB' }}>
                {formatPrice(price)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    );

    if (createPortal && document.body) {
      return createPortal(content, document.body);
    }
    return content;
  };

  return (
    <View
      ref={targetRef}
      style={style}
      // @ts-ignore
      onMouseEnter={handleMouseEnter}
      // @ts-ignore
      onMouseLeave={handleMouseLeave}
      // @ts-ignore
      onClick={handleMouseLeave}
    >
      {children}
      {renderPreview()}
    </View>
  );
}
