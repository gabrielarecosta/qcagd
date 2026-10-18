import { type PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        {/* PWA Manifest & Theme */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1A56DB" />
        <meta name="description" content="Sistema de Distribución y Gestión de Química General Deheza" />

        {/* iOS / Apple PWA Meta Tags - FULLSCREEN STANDALONE */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-touch-fullscreen" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Tienda QGD" />
        {/* Apple Touch Icons */}
        <link rel="apple-touch-icon" href="/logo2.png" />
        <link rel="apple-touch-icon-precomposed" href="/logo2.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/logo2.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/* Native Mobile App Look & Feel Reset */}
        <style>{`
          html, body, #root, #root > div {
            display: flex;
            flex-direction: column;
            flex: 1;
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            min-height: 100vh;
            overflow-x: hidden;
            background-color: #F8FAFC;
            -webkit-tap-highlight-color: transparent;
            -webkit-touch-callout: none;
            -webkit-user-select: none;
            user-select: none;
            touch-action: manipulation;
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          }

          input, textarea, [contenteditable="true"] {
            -webkit-user-select: text !important;
            user-select: text !important;
          }

          body, div, scroll-view {
            -webkit-overflow-scrolling: touch;
          }

          img {
            -webkit-user-drag: none;
            user-drag: none;
          }

          /* Scrollbar global estilizado y visible a la derecha */
          * {
            scrollbar-width: thin !important;
            scrollbar-color: #94A3B8 #F1F5F9 !important;
          }

          ::-webkit-scrollbar,
          *::-webkit-scrollbar {
            width: 8px !important;
            height: 8px !important;
            display: block !important;
          }
          ::-webkit-scrollbar-track,
          *::-webkit-scrollbar-track {
            background: #F1F5F9 !important;
            border-radius: 6px !important;
          }
          ::-webkit-scrollbar-thumb,
          *::-webkit-scrollbar-thumb {
            background: #94A3B8 !important;
            border-radius: 6px !important;
            border: 2px solid #F1F5F9 !important;
          }
          ::-webkit-scrollbar-thumb:hover,
          *::-webkit-scrollbar-thumb:hover {
            background: #64748B !important;
          }

          /* Barra de desplazamiento siempre visible y destacada a la derecha para pantallas principales y modales */
          [data-main-scroll="true"],
          [data-cart-scroll="true"],
          [data-testid="cart-preview-scroll"],
          .main-scroll-view {
            overflow-y: scroll !important;
            scrollbar-width: thin !important;
            scrollbar-color: #94A3B8 #F1F5F9 !important;
          }
          [data-main-scroll="true"]::-webkit-scrollbar,
          [data-cart-scroll="true"]::-webkit-scrollbar,
          [data-testid="cart-preview-scroll"]::-webkit-scrollbar,
          .main-scroll-view::-webkit-scrollbar {
            width: 8px !important;
            display: block !important;
          }
          [data-main-scroll="true"]::-webkit-scrollbar-track,
          [data-cart-scroll="true"]::-webkit-scrollbar-track,
          [data-testid="cart-preview-scroll"]::-webkit-scrollbar-track,
          .main-scroll-view::-webkit-scrollbar-track {
            background: #F1F5F9 !important;
            border-radius: 6px !important;
          }
          [data-main-scroll="true"]::-webkit-scrollbar-thumb,
          [data-cart-scroll="true"]::-webkit-scrollbar-thumb,
          [data-testid="cart-preview-scroll"]::-webkit-scrollbar-thumb,
          .main-scroll-view::-webkit-scrollbar-thumb {
            background: #94A3B8 !important;
            border-radius: 6px !important;
            border: 2px solid #F1F5F9 !important;
          }
          [data-main-scroll="true"]::-webkit-scrollbar-thumb:hover,
          [data-cart-scroll="true"]::-webkit-scrollbar-thumb:hover,
          [data-testid="cart-preview-scroll"]::-webkit-scrollbar-thumb:hover,
          .main-scroll-view::-webkit-scrollbar-thumb:hover {
            background: #64748B !important;
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}

