# Guía de Pruebas Manuales de Aceptación (UAT) 🧪
**Química Deheza — Aplicación del Cliente/Repartidor (`client-app`) y Panel de Administración (`admin-panel`)**

Este documento contiene el paso a paso simplificado para validar la funcionalidad y los elementos visuales básicos (botones, imágenes e inputs) del sistema completo.

---

## 📱 PARTE 1: Pruebas en la App de Clientes/Repartidores (`client-app`)

### Bloque 1.1: Flujo de Bienvenida y Registro

#### 1. Verificación de Pantalla de Bienvenida (Landing Page)
*   **Acción:** Iniciar la app en web (`npm run web` dentro de `client-app`) o en el celular sin haber iniciado sesión.
*   **Qué observar:**
    *   Se visualiza la imagen de bienvenida (`banner.png`).
    *   Se visualiza el botón principal de **INGRESAR**.
    *   Las pestañas de navegación inferiores (Inicio, Catálogo, Carrito, Mi Cuenta) están completamente ocultas.
*   **Resultado esperado:** La pantalla de bienvenida se muestra con el botón para ingresar, y el acceso a las pestañas de compra está bloqueado.

#### 2. Flujo de Registro de un Nuevo Cliente
*   **Acción:**
    1.  Presionar el botón **INGRESAR**.
    2.  Hacer clic en **Registrarse**.
    3.  Rellenar los campos del formulario: Nombre, Celular, Email, Dirección y Zona.
    4.  Hacer clic sobre las palabras subrayadas **"términos y condiciones"** en la parte inferior.
    5.  Cerrar el aviso de términos y condiciones.
    6.  Hacer clic en el checkbox para aceptar los términos y condiciones.
    7.  Presionar el botón **Registrarme e Ingresar**.
*   **Qué observar:**
    *   Al hacer clic en el texto subrayado, se despliega la ventana modal con los términos y condiciones de la empresa.
    *   Si se intenta registrar sin marcar la casilla de aceptación, el formulario muestra un error explicativo en letras rojas.
    *   Al marcar la casilla y guardar, se realiza el registro correcto en Supabase y el inicio de sesión automático.
*   **Resultado esperado:** Se crea el cliente en el sistema tras aceptar términos y se ingresa a la app.

---

### Bloque 1.2: Rol Cliente Final (Credenciales Demo)

#### 3. Login de Cliente Final
*   **Acción:**
    1.  Ir a la pantalla de ingreso.
    2.  Colocar el usuario **`ana`** y contraseña **`ana`**.
    3.  Presionar **Iniciar Sesión**.
*   **Qué observar:**
    *   Acceso inmediato a la cuenta de la cliente demo "Ana García".
    *   Las pestañas inferiores (Inicio, Catálogo, Carrito, Mi Cuenta) ahora son visibles y clicables.
    *   En la pantalla de Inicio se muestra el saludo con el nombre del cliente: *"¡Hola, Ana! 👋 ¿Qué necesitás hoy?"*.
*   **Resultado esperado:** Login correcto y desbloqueo de pestañas de compra.

#### 4. Búsqueda y Selección en Catálogo
*   **Acción:**
    1.  Ir a la pestaña **Catálogo**.
    2.  Ingresar un texto de búsqueda (ej: "ALA") en la barra superior.
    3.  Hacer clic en la categoría "Limpieza" para filtrar.
    4.  Presionar el botón **+** en dos artículos para sumarlos al carrito.
*   **Qué observar:**
    *   Se visualizan los botones de categorías y las imágenes de los productos.
    *   El listado de artículos se actualiza según el texto ingresado.
    *   **Priorización de Búsqueda:** Deben aparecer primero todas las coincidencias exactas del término (ej: "JABON ALA", "ALA LÍQUIDO") antes que las coincidencias parciales que lo contienen como subcadena (ej: "PALA", "BALANZA").
    *   El icono del **Carrito** en la barra inferior muestra un indicador numérico con la cantidad de artículos agregados.
*   **Resultado esperado:** Búsqueda priorizada por coincidencia exacta de palabra y actualización del contador.

#### 4b. Regla de Promociones en Bundle (Descuento solo por Combos completos)
*   **Acción:**
    1.  Tener en cuenta un producto con una promoción activa configurada por el administrador (ej: jabón líquido con descuento del 20% llevando un mínimo de 2 unidades).
    2.  Ir a la pestaña **Catálogo** y agregar **1 unidad** de este producto.
    3.  Aumentar la cantidad del producto a **2 unidades**.
    4.  Aumentar la cantidad del producto a **3 unidades**.
    5.  Ir a **Mis Pedidos** y verificar el desglose de precios.
*   **Qué observar:**
    *   Con **1 unidad**: Se cobra al precio regular base del producto (descuento 0%).
    *   Con **2 unidades**: Se aplica el 20% de descuento sobre las 2 unidades (combo completo de 2 unidades).
    *   Con **3 unidades**: Se aplica el 20% de descuento sobre las primeras 2 unidades, y la tercera unidad extra se cobra al **precio regular sin descuento**. El subtotal final debe coincidir con `(precio_promo * 2) + (precio_regular * 1)`.
*   **Resultado esperado:** El descuento se aplica estrictamente a múltiplos de la cantidad mínima de la promoción (en combos/bundles cerrados) y cualquier sobrante/extra se factura al precio base de lista.

#### 5. Gestión de Pedidos y Checkout (Formas de Pago)
*   **Acción:**
    1.  Ir a la pestaña **Mis Pedidos**.
    2.  Modificar cantidades con los botones **+** y **-**.
    3.  Presionar el botón de la papelera para quitar un artículo.
    4.  Presionar **Finalizar Pedido** (o realizar scroll hasta la parte del formulario).
    5.  En la sección **¿Cómo querés recibirlo?**, seleccionar "Envío por reparto".
    6.  En la sección **Horario de entrega**, seleccionar fecha y elegir una de las franjas horarias configuradas (Mañana, Mediodía, Siesta, Tarde, Tarde Noche).
    7.  En la sección **¿Cómo abonás?**, probar las tres opciones:
        *   **Contra entrega / Efectivo:** Ingresar un importe para abonar (ej. $10000) y observar el vuelto en pantalla.
        *   **Mercado Pago:** Leer el mensaje de redirección segura.
        *   **Transferencia Bancaria:** Validar que se muestre el cuadro detallado con los datos bancarios (CBU, Alias: `QUIMICA.DEHEZA.MP`, Titular).
    8.  Hacer clic en **Confirmar pedido** habiendo seleccionado la opción **Transferencia Bancaria**.
*   **Qué observar:**
    *   En el caso de Efectivo, el vuelto estimado se calcula automáticamente.
    *   En el caso de Mercado Pago, tras la confirmación se abrirá una redirección al sitio web de Mercado Pago.
    *   En el caso de **Transferencia**, una vez que presionas confirmar, el pedido se guarda en la base de datos y la pantalla de éxito ("¡Pedido confirmado!") mostrará un cuadro destacado con los datos bancarios y un botón verde **"Ya pagué, enviar comprobante"**.
    *   Al hacer clic en dicho botón verde, debe abrirse WhatsApp con un texto de confirmación pre-redactado para enviar el comprobante de pago al local.
*   **Resultado esperado:** Compra procesada, cálculo de vuelto exacto, redirección en Mercado Pago y derivación a WhatsApp con los datos del comprobante para Transferencia.

#### 6. Repetir Compra (Volver a comprar)
*   **Acción:**
    1.  Ir a la pestaña **Mis Pedidos**.
    2.  Desplazarse hasta el bloque inferior **Historial de pedidos**.
    3.  Identificar una compra pasada y presionar el botón **Volver a comprar**.
*   **Qué observar:**
    *   Los artículos de ese pedido del pasado se cargan automáticamente al carrito de compras actual en la parte superior de la pantalla.
    *   Se muestra una alerta emergente informando que los productos fueron cargados.
*   **Resultado esperado:** Los productos se cargan de inmediato en la misma pestaña sin cambiar de pantalla.

#### 6b. Previsualización de Carrito en Cabecera (Web / Escritorio PWA)
*   **Acción:**
    1.  Estando en la versión web (pantalla ancha en escritorio), verificar el extremo superior derecho del encabezado.
    2.  Hacer clic en el icono del **Carrito** (con badge numérico rojo).
    3.  Visualizar la tarjeta desplegable flotante con el resumen.
    4.  Hacer clic en el botón **"Ver Carrito Completo"** de la tarjeta.
*   **Qué observar:**
    *   Se muestra un popover / menú flotante de cabecera con el listado rápido de ítems agregados, sus precios y el total estimado.
    *   Al hacer clic en "Ver Carrito Completo", la ventana navega de forma instantánea a la pestaña principal de **Mi Pedido**.
*   **Resultado esperado:** Visualización rápida de los artículos desde el encabezado web y navegación fluida al hacer clic en el botón de redirección.

#### 6c. Seguimiento Múltiple de Repartos (Rol Cliente)
*   **Acción:**
    1.  Realizar dos pedidos independientes en la aplicación seleccionando entrega por reparto en diferentes fechas o turnos.
    2.  Navegar a la pestaña **Reparto** con la sesión del cliente iniciada.
*   **Qué observar:**
    *   La pantalla de seguimiento muestra de forma simultánea una tarjeta por cada uno de los pedidos activos (en estado Recibido, En preparación o En camino).
    *   Cada tarjeta muestra el número del pedido, su estado y el detalle de la fecha y franja horaria programadas para su reparto.
*   **Resultado esperado:** Visualización completa de todos los pedidos activos del cliente en curso, sin omitir turnos futuros.

---

### Bloque 1.3: Rol Repartidor (Chofer)

#### 7. Login de Repartidor
*   **Acción:**
    1.  Ir a Mi Cuenta y presionar **Cerrar Sesión**.
    2.  Ingresar a la pantalla de Login:
        *   **En versión móvil/PWA**: Tocar **INGRESAR** y seleccionar **Soy repartidor**.
        *   **En versión escritorio/Web**: En la pestaña de Login de la derecha, seleccionar la opción **Repartidor** en el selector de roles ("Cliente" / "Repartidor").
    3.  Colocar el email **`daniel@quimicadeheza.com`** y contraseña **`daniel`** (o el usuario `daniel`).
    4.  Presionar **Ingresar**.
*   **Qué observar:**
    *   Acceso al panel operativo del chofer.
    *   Las pestañas de Catálogo y Carrito se ocultan. Solo quedan visibles **Mis Repartos** y **Mi Cuenta**.
*   **Resultado esperado:** Restricción de permisos por rol y login operativo del repartidor aplicados correctamente en web, desktop y móvil.

#### 8. Control de Planilla de Ruta y KPIs
*   **Acción:**
    1.  Navegar a la pestaña **Reparto**.
*   **Qué observar:**
    *   Se muestra en pantalla la información del vehículo y la sucursal del chofer.
    *   Se visualiza la lista de entregas pendientes asignadas.
    *   Se ven los indicadores numéricos (KPIs) con la cantidad de pedidos y montos de cobranza acumulados.
*   **Resultado esperado:** La planilla de reparto se visualiza con los datos del chofer y sus entregas.

#### 9. Marcado de Entrega Exitosa
*   **Acción:**
    1.  En la primera tarjeta de entrega, presionar el botón **Marcar en camino**.
    2.  Tocar el botón **Marcar entregado**.
    3.  Ingresar el nombre del receptor en el input de texto y seleccionar método de pago. Presionar guardar.
*   **Qué observar:**
    *   El botón del pedido cambia para indicar que ya está entregado.
    *   Los contadores numéricos de cobros acumulados en la parte superior se actualizan sumando el importe de esta entrega.
*   **Resultado esperado:** Estado del pedido actualizado y KPIs acumulados correctamente.

#### 10. Marcado de Entrega Fallida
*   **Acción:**
    1.  En una parada de la lista, presionar el botón **No entregado**.
    2.  Seleccionar un motivo del menú desplegable (ej: "Cliente Ausente").
    3.  Escribir una observación en la caja de texto y guardar.
*   **Qué observar:**
    *   El pedido cambia su estado visible a "Pendiente de entrega" con el motivo correspondiente en pantalla.
*   **Resultado esperado:** Se registra el fallo y la observación en el sistema.

#### 10b. Expiración de Sesión por Inactividad (Seguridad)
*   **Acción:**
    1.  Iniciar sesión como cliente o repartidor.
    2.  Permanecer inactivo en la aplicación durante 15 minutos (sin mover el mouse, pulsar teclas, hacer scroll o tocar la pantalla).
*   **Qué observar:**
    *   Pasados los 15 minutos, la sesión se cierra de forma automática.
    *   Se despliega un aviso emergente informando que la sesión ha expirado por inactividad.
    *   Al ingresar al Login de clientes (o repartidor), el campo de usuario debe estar auto-completado con los datos del último ingreso (ej: `ana` o `daniel@quimicadeheza.com`), y se mostrará un banner amarillo superior con el mensaje de sesión expirada.
*   **Resultado esperado:** Cierre de sesión seguro y autocompletado en el formulario al intentar ingresar de nuevo.

---

## 💻 PARTE 2: Pruebas en el Panel de Administración (`admin-panel`)

### Bloque 2.1: Gestión e Importaciones

#### 11. Selector de Sucursal
*   **Acción:**
    1.  Cambiar la sucursal seleccionada en el menú superior (ej: de GENERAL DEHEZA 1 a RIO CUARTO).
*   **Qué observar:**
    *   Los datos numéricos del Dashboard y los stocks de los productos en el catálogo se actualizan según la sucursal elegida.
*   **Resultado esperado:** Sincronización del catálogo e inventarios por sucursal.

#### 12. Importación desde Excel
*   **Acción:**
    1.  Ir a **Importar Catálogo**.
    2.  Subir un archivo Excel con artículos de catálogo.
*   **Qué observar:**
    *   Se despliega en pantalla la tabla con la vista previa de las filas importadas.
    *   El sistema muestra alertas visuales (ej. alertas de conflicto) si detecta coincidencias en códigos comerciales.
    *   Permite seleccionar acciones mediante botones/dropdowns en la tabla.
    *   Presionar **Procesar Importación** y verificar que la barra de progreso se complete.
*   **Resultado esperado:** Procesamiento correcto de la planilla e inserción en base de datos.

---

### Bloque 2.2: Logística y Calendarios

#### 13. Planificación de Rutas de Reparto
*   **Acción:**
    1.  Acceder a **Planificador de Rutas**.
    2.  Seleccionar pedidos pendientes marcando los checkboxes de la lista.
    3.  Seleccionar un chofer (ej: Daniel Gómez), vehículo, fecha y turno en los controles correspondientes.
    4.  Presionar el botón **Generar Hoja de Ruta**.
*   **Qué observar:**
    *   Los pedidos elegidos desaparecen de la lista de pendientes y su estado pasa a `asignado`.
    *   Si revisas la app del repartidor Daniel Gómez, estos pedidos se visualizan en su lista de paradas.
*   **Resultado esperado:** Los pedidos son asignados al chofer y se actualiza su estado.

#### 14. Reportes de Caja
*   **Acción:**
    1.  Ir a **Caja y Cobranzas**.
    2.  Filtrar por la fecha de hoy.
*   **Qué observar:**
    *   Se muestra el desglose del dinero cobrado por el chofer agrupado por método de pago (Efectivo / Transferencia).
*   **Resultado esperado:** Los montos totales reportados en el panel de administración coinciden con las entregas completadas por el chofer.

#### 15. Configuración de Días Bloqueados (Calendario)
*   **Acción:**
    1.  Ir al módulo de **Calendarios**.
    2.  Seleccionar un día en el calendario y presionar el botón de **Bloquear Día** (Feriado).
    3.  Ingresar el motivo en la ventana emergente y guardar.
    4.  Abrir la app de clientes (`client-app`), iniciar checkout y desplegar el selector de fechas de entrega.
*   **Qué observar:**
    *   El día bloqueado no está disponible (aparece inhabilitado/gris) en el selector de fechas de entrega de la app de clientes.
*   **Resultado esperado:** La fecha queda bloqueada para pedidos en el checkout del cliente.

#### 16. Configuración de Contactos de la Química (Dirección, Teléfonos y Redes)
*   **Acción:**
    1.  En el panel de administración (`admin-panel`), ingresar a **Configuración App**.
    2.  Modificar los siguientes campos en la sección **Parámetros Generales y Canales de Soporte**:
        *   **WhatsApp de Soporte**: Ingresar un número telefónico (ej: `5493519999999`).
        *   **Dirección Física**: Cambiar la dirección (ej: `Avenida General Deheza 456`).
        *   **Teléfono Fijo / Contacto**: Modificar el número de contacto.
        *   **Instagram y Facebook**: Modificar los nombres de usuario.
    3.  Presionar el botón **Guardar Cambios Generales**.
    4.  Abrir la aplicación del cliente (`client-app`), ingresar al carrito y realizar una compra con pago por "Transferencia Bancaria". En la pantalla de confirmación, presionar el botón **"Ya pagué, enviar comprobante"**.
    *   En la sección **Mi Cuenta** del cliente, en el bloque de ayuda, se debe mostrar la nueva dirección (`Avenida General Deheza 456`), y los enlaces a Instagram y Facebook deben redirigir a las cuentas ingresadas en el administrador.
*   **Resultado esperado:** Los cambios de contacto realizados por el administrador se propagan instantáneamente y de forma dinámica en toda la aplicación del cliente.

#### 17. Gestión de Choferes, Datos de Vehículo y Baja con Doble Confirmación
*   **Acción:**
    1.  Ingresar al panel administrativo (`admin-panel`) e ir a **Personal e Internos**.
    2.  Hacer clic en **Registrar Colaborador**. Rellenar los campos:
        *   Nombre: `Chofer Test`
        *   Correo de Acceso: `chofer@test.com`
        *   Rol Operativo: `Chofer / Repartidor`
        *   Contraseña de Ingreso: `test1234`
        *   Vehículo: `Chevrolet Spin`
        *   Patente: `OP456KL`
        *   DNI: `28111222`
        *   URL Foto: `https://images.unsplash.com/photo-1534528741775-53994a69daeb`
    3.  Presionar **Registrar**.
    4.  Buscar a `Chofer Test` en la lista y presionar **✏️ Editar** para validar que los datos persistan correctamente en Supabase.
    5.  Hacer clic en **🗑️ Eliminar** sobre `Chofer Test`.
*   **Qué observar:**
    *   Al hacer clic en eliminar, aparece un primer modal de confirmación advirtiendo sobre la desactivación. Al presionar **Sí, continuar**, aparece un segundo modal de advertencia definitiva para confirmar la baja irreversible.
*   **Resultado esperado:** Registro exitoso de chofer con datos específicos de vehículo y foto, y proceso de eliminación seguro con doble confirmación.

#### 18. Auto-Recepción y Seguimiento en Tiempo Real por Repartidores
*   **Acción:**
    1.  Registrar una nueva compra en `client-app` (con pago en efectivo, por ejemplo).
    2.  Iniciar sesión en la app (`client-app`) como el repartidor recién creado (`chofer@test.com` y `test1234`).
    3.  Ir a la pestaña **Mis Repartos**.
    4.  Hacer clic en la pestaña **Disponibles**.
    5.  Localizar el pedido del cliente y presionar el botón **Tomar Pedido para mi Reparto**.
    6.  Volver a la pestaña **Mis Entregas** y presionar **Marcar en camino**. Después presionar **Marcar entregado**.
*   **Qué observar:**
    *   En la pestaña de **Disponibles**, figuran los pedidos de la sucursal que no tienen chofer asignado.
    *   Al presionar **Tomar Pedido**, se mueve automáticamente a **Mis Entregas**.
    *   El sistema registra automáticamente la hora exacta en la que se tomó el reparto (`taken_at`) y la hora exacta de la entrega (`delivered_at`) en la base de datos Supabase, asociándolo al chofer.
*   **Resultado esperado:** Recepción libre de pedidos por parte de los choferes y trazabilidad total de tiempos de entrega registrados en Supabase.
