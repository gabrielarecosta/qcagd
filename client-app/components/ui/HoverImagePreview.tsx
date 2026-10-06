import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  images?: string[];
  name?: string;
  price?: number;
  presentation?: string;
  codigo?: string;
  children: React.ReactNode;
  style?: ViewStyle | any;
  delayMs?: number; // Por defecto 800 ms
}

/**
 * Componente que envuelve una tarjeta y al mantener el mouse encima,
 * muestra un popover flotante en alta resolución y tamaño ampliado con la foto
 * y carrusel en loop automático cada 2 segundos si hay múltiples imágenes.
 */
export function HoverImagePreview({
  imageUri,
  images,
  name,
  price,
  presentation,
  codigo,
  children,
  style,
  delayMs = 800,
}: HoverImagePreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [currentImgIdx, setCurrentImgIdx] = useState(0);
  const timeoutRef = useRef<any>(null);
  const targetRef = useRef<any>(null);

  // Pool consolidado de imágenes sin duplicados
  const allImages = useMemo(() => {
    const pool = [
      imageUri,
      ...(Array.isArray(images) ? images : []),
    ].filter((img): img is string => typeof img === 'string' && img.trim().length > 0);
    return Array.from(new Set(pool));
  }, [imageUri, images]);

  // Carrusel automático en loop con intervalo de 2 segundos
  useEffect(() => {
    if (!isOpen || allImages.length <= 1) {
      setCurrentImgIdx(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentImgIdx((prev) => (prev + 1) % allImages.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [isOpen, allImages.length]);

  const calculatePosition = (rect: DOMRect) => {
    if (typeof window === 'undefined') return;

    const PREVIEW_WIDTH = 420;
    const PREVIEW_HEIGHT = 490;
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
    if (allImages.length === 0 || Platform.OS !== 'web') return;

    const rect = e.currentTarget?.getBoundingClientRect?.();
    if (!rect) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      calculatePosition(rect);
      setCurrentImgIdx(0);
      setIsOpen(true);
    }, delayMs);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsOpen(false);
    setCurrentImgIdx(0);
  };

  // Si el usuario hace scroll, ocultamos la previsualización de inmediato
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    const handleScroll = () => {
      setIsOpen(false);
      setCurrentImgIdx(0);
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

  if (Platform.OS !== 'web' || allImages.length === 0) {
    return <View style={style}>{children}</View>;
  }

  const renderPreview = () => {
    if (!isOpen || allImages.length === 0 || typeof document === 'undefined') {
      return null;
    }

    const currentImg = allImages[currentImgIdx] || allImages[0];

    const content = (
      <div
        style={{
          position: 'fixed',
          top: coords.top,
          left: coords.left,
          width: 420,
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.08)',
          zIndex: 9999999,
          pointerEvents: 'none',
          padding: 14,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
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
              fontSize: 12,
              fontWeight: 700,
              color: '#1A56DB',
              backgroundColor: '#EFF6FF',
              padding: '4px 10px',
              borderRadius: 6,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span>🔍 Vista previa ampliada</span>
            {allImages.length > 1 && (
              <span style={{ color: '#2563EB', fontWeight: 600, fontSize: 11 }}>
                ({currentImgIdx + 1}/{allImages.length})
              </span>
            )}
          </div>
          {codigo ? (
            <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>
              Cód: {codigo}
            </span>
          ) : null}
        </div>

        {/* Imagen en grande con soporte para carrusel en loop */}
        <div
          style={{
            width: '100%',
            height: 350,
            backgroundColor: '#F8FAFC',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            border: '1px solid #E2E8F0',
            position: 'relative',
          }}
        >
          <img
            key={currentImg}
            src={currentImg}
            alt={name || 'Producto'}
            style={{
              maxWidth: '94%',
              maxHeight: '94%',
              objectFit: 'contain',
              display: 'block',
              transition: 'opacity 0.25s ease-in-out',
            }}
          />

          {allImages.length > 1 && (
            <div
              style={{
                position: 'absolute',
                bottom: 10,
                left: 0,
                right: 0,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 6,
                zIndex: 2,
              }}
            >
              {allImages.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: currentImgIdx === i ? 18 : 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: currentImgIdx === i ? '#1A56DB' : 'rgba(15, 23, 42, 0.28)',
                    transition: 'all 0.25s ease',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Datos del producto */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {name ? (
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: '#0F172A',
                lineHeight: 1.35,
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
              <span style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>
                {presentation}
              </span>
            ) : <span />}

            {typeof price === 'number' && price > 0 ? (
              <span style={{ fontSize: 18, fontWeight: 800, color: '#1A56DB' }}>
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
