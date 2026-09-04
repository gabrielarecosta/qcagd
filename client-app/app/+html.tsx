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

          ::-webkit-scrollbar {
            width: 4px;
            height: 4px;
          }
          ::-webkit-scrollbar-track {
            background: transparent;
          }
          ::-webkit-scrollbar-thumb {
            background: rgba(148, 163, 184, 0.4);
            border-radius: 4px;
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}

