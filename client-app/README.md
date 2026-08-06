# Aplicación Mobile - Cliente & Repartidor 📱

Esta es la aplicación móvil del cliente final y los choferes de reparto, construida sobre **React Native + Expo Router + TypeScript**.

## 🎨 Características de Diseño
- **Accesibilidad:** Fuentes de gran tamaño, alto contraste y botones táctiles sobredimensionados para facilitar el uso por parte de adultos (+40 años).
- **Catálogo Optimizado:** FlatList virtualizado para soportar navegación fluida sobre la base de datos simulada de 6000 artículos sin congelamientos.
- **Doble Rol:** Permite identificarse como cliente (compra, carrito, consultar reparto) o chofer (paradas del día, firmas, vuelto).

## 🚀 Comandos de Expo

### Instalar dependencias
```bash
npm install
```

### Iniciar Servidor de Desarrollo
```bash
npx expo start
```
Use la tecla `a` para abrir en emulador de Android, `i` para iOS, o escanee el código QR en la consola desde la cámara de su celular o la app Expo Go.

### Limpieza de Caché (en caso de problemas de carga)
```bash
npx expo start -c
```

### Comprobación Estricta de TypeScript
```bash
npx tsc --noEmit
```
