# Sistema de Gestión y Distribución de Química / Distribuidora 🧪

Este proyecto es una demostración técnica y funcional completa para una química y distribuidora de artículos de limpieza e industriales (más de 6000 productos). Está estructurado como un monorepositorio modular que separa el panel de control administrativo y la aplicación móvil del cliente final/repartidor.

---

## 🏗️ Arquitectura del Monorepositorio

```
QUIMICA/
├── shared/                  # Módulo Compartido (Datos mock, Modelos TypeScript y Lógica)
│   ├── types/               # Modelos estrictos (Product, Client, Order, Delivery, etc.)
│   ├── data/                # Bases de datos simuladas realistas (6000 productos, clientes, rutas)
│   ├── utils/               # Validadores y formateadores de datos (Dinero, cambio, fechas, Excel)
│   └── services/            # Lógica y cómputo de reportes e IPN de Mercado Pago
│
├── mobile-app/              # Aplicación Mobile (React Native + Expo Router + TypeScript)
│   ├── app/                 # Rutas de navegación (Tabs: Inicio, Catálogo, Carrito, Reparto, Perfil)
│   ├── components/          # Tarjetas e interfaces nativas
│   └── metro.config.js      # Bundler configurado para compilar código desde '/shared'
│
└── admin-panel/             # Panel Web de Gestión (React + Vite + TypeScript)
    ├── src/
    │   ├── views/           # Vistas del CRM (Dashboard, Pedidos, Catálogo, Repartos, Caja, etc.)
    │   └── store/           # Zustand - Unificador del estado global del panel
```

---

## ⚙️ Características Principales

### 1. Panel de Administración Web (`admin-panel/`)
CRM interactivo optimizado para PC, con navegación lateral de 13 módulos:
- **Dashboard Operativo:** Resumen en vivo de ventas del día, alertas críticas de stock y notificaciones.
- **Selector de Sucursal Global:** Filtra la base de datos de manera transversal para ver métricas y stock específicos de `GENERAL DEHEZA 1`, `GENERAL DEHEZA 2`, `RIO CUARTO` o `GIGENA`.
- **Carga desde Excel (SheetJS):** Permite subir plantillas de artículos validando columnas y celdas. Soporta modos de *Agregar Nuevos*, *Actualizar Existentes* o *Sobrescribir Catálogo*.
- **Planificador de Rutas:** Permite asignar pedidos en estado "listo" a choferes, especificando zonas, turnos y paradas.
- **Caja y Pagos:** Muestra conciliación de efectivo, transferencias bancarias y simulación interactiva de notificaciones IPN (Webhooks) de Mercado Pago.
- **Configuración de Calendarios:** Control de feriados, fechas bloqueadas, horarios de atención y retiro en local.

### 2. App Mobile Expo (`mobile-app/`)
Diseño de alto contraste y tipografía legible pensado para personas adultas (+40 años):
- **Búsqueda Inteligente:** Búsqueda rápida en catálogo de 6000 productos por código, presentación, nombre y filtros de categorías gigantes.
- **Pedido Rápido:** Toggles de cantidades con un toque, estimación del vuelto en efectivo ("¿Con cuánto abona?") y coordinación directa por WhatsApp.
- **Doble Rol Integrado (Cliente / Repartidor):** Login simulado que adapta la app para el chofer de reparto, mostrando sus paradas del día, montos a cobrar, vuelto a entregar y reportes de entrega.

---

## 🚀 Cómo Empezar

### Requisitos Previos
- **Node.js** v18 o superior.
- **npm** o **yarn**.

---

### 1. Correr el Panel Web Administrativo
```bash
# Entrar al directorio
cd admin-panel

# Instalar dependencias (Zustand, SheetJS, Vite)
npm install

# Correr en modo de desarrollo local
npm run dev
```
El panel estará disponible en la dirección local provista por Vite (usualmente `http://localhost:5173`).

---

### 2. Correr la Aplicación Mobile Expo
```bash
# Entrar al directorio
cd mobile-app

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo de Expo
npx expo start
```
Use la aplicación Expo Go en su smartphone Android/iOS para escanear el código QR y correr la aplicación en tiempo real.

---

### 3. Compilación y Validación de Tipos
Para validar la coherencia y robustez del código de TypeScript:
```bash
# En /admin-panel
npm run build

# En /mobile-app
npx tsc --noEmit
```

---

## 📅 Estado de la Base de Datos
Todo el backend está simulado de manera reactiva mediante la store de Zustand y servicios de mock en `/shared`. El código está estructurado para una integración inmediata con **Supabase** o una base de datos relacional SQL mediante el reemplazo de los métodos del servicio común.
# qcagd
