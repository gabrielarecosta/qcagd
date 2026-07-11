# Panel Web Administrativo - Química & Distribuidora 💻

Este es el Panel de Administración Web (CRM) desarrollado en **React + Vite + TypeScript + CSS Moderno** para uso interno de la distribuidora.

## 📦 Estructura del Código

- `src/views/`: Contiene los componentes autocontenidos para cada una de las 13 pantallas administrativas.
  - `DashboardView.tsx`: Panel principal con KPIs clave, stock crítico y alertas.
  - `BranchesView.tsx` & `SectorsView.tsx`: Control de sucursales físicas y asignación de sectores internos.
  - `ProductsView.tsx` & `ExcelImportView.tsx`: ABM de catálogo completo de 6000 productos e importador masivo XLSX/CSV.
  - `ClientsView.tsx` & `OrdersView.tsx`: Directorio de clientes y monitorización en tiempo real del estado de pedidos.
  - `DeliveriesView.tsx` & `ZonesView.tsx`: Distribución de rutas de despacho de choferes, mínimos de compra y precios de envío.
  - `PaymentsView.tsx`: Conciliación de caja en efectivo y transferencias, con simulador webhook de Mercado Pago integrado.
  - `ClientConfigView.tsx`: Gestión de banners promocionales y visibilidad de categorías en la App Móvil.
  - `UsersView.tsx`: Roles de seguridad de colaboradores e internos.
  - `ReportsView.tsx`: Gráficos CSS para ventas diarias, facturación por sucursal y estadísticas de VIPs.
- `src/store/adminStore.ts`: Store centralizada usando **Zustand** que sincroniza e implementa las mutaciones sobre los datos simulados de la distribuidora.
- `src/index.css`: Hoja de estilos con variables de color premium, diseño de cuadrícula y utilidades responsivas.

## 🚀 Comandos Útiles

### Instalar dependencias
```bash
npm install
```

### Ejecutar Servidor Local (HMR)
```bash
npm run dev
```

### Compilar para Producción
Genera la carpeta `dist/` con recursos HTML/CSS/JS optimizados:
```bash
npm run build
```

### Previsualizar Compilación
```bash
npm run preview
```
