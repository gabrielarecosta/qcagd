import { type PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* PWA Manifest Link */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1A56DB" />
        <meta name="description" content="Sistema de Distribución y Gestión de Química Deheza" />
      </head>
      <body>{children}</body>
    </html>
  );
}
