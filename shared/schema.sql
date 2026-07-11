-- ============================================================
-- SCRIPT DE MIGRACIÓN Y ESQUEMA DE BASE DE DATOS
-- Sistema de Distribución y Gestión de Química Deheza
-- ============================================================

-- 1. LIMPIEZA DE TABLAS PREVIAS (Para inicialización controlada)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS payment_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS export_history CASCADE;
DROP TABLE IF EXISTS import_rows CASCADE;
DROP TABLE IF EXISTS imports CASCADE;
DROP TABLE IF EXISTS exchange_rates CASCADE;
DROP TABLE IF EXISTS receipts CASCADE;
DROP TABLE IF EXISTS delivery_events CASCADE;
DROP TABLE IF EXISTS delivery_assignments CASCADE;
DROP TABLE IF EXISTS deliveries CASCADE;
DROP TABLE IF EXISTS delivery_routes CASCADE;
DROP TABLE IF EXISTS delivery_zones CASCADE;
DROP TABLE IF EXISTS order_status_history CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS inventory_movements CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS product_prices CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS customer_addresses CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS drivers CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS sectors CASCADE;
DROP TABLE IF EXISTS branches CASCADE;

-- 2. CREACIÓN DE TABLAS DE INFRAESTRUCTURA

-- Sucursales
CREATE TABLE branches (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    direccion TEXT,
    telefono TEXT,
    whatsapp TEXT,
    horario_atencion TEXT,
    activo BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Sectores Internos
CREATE TABLE sectors (
    id TEXT PRIMARY KEY,
    branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Perfiles de Usuario (Usuarios internos)
CREATE TABLE profiles (
    id TEXT PRIMARY KEY, -- En producción referencia auth.users.id (UUID). Aquí usamos TEXT para compatibilidad demo.
    nombre TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('admin', 'encargado_sucursal', 'ventas', 'deposito', 'repartidor', 'caja', 'solo_lectura')),
    branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
    sector_id TEXT REFERENCES sectors(id) ON DELETE SET NULL,
    activo BOOLEAN DEFAULT TRUE NOT NULL,
    telefono TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by TEXT
);

-- Choferes / Repartidores (Relación 1 a 1 opcional con profiles para datos específicos)
CREATE TABLE drivers (
    id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    vehiculo_info TEXT,
    activo BOOLEAN DEFAULT TRUE NOT NULL
);

-- Clientes Minoristas
CREATE TABLE customers (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    razon_social TEXT,
    cuit TEXT,
    telefono TEXT NOT NULL,
    whatsapp TEXT,
    email TEXT,
    direccion TEXT NOT NULL,
    zona TEXT NOT NULL,
    branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
    tipo_cliente TEXT DEFAULT 'minorista' NOT NULL CHECK (tipo_cliente IN ('mayorista', 'minorista')),
    activo BOOLEAN DEFAULT TRUE NOT NULL,
    observaciones TEXT,
    fecha_alta TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by TEXT
);

-- Direcciones adicionales del cliente
CREATE TABLE customer_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
    direccion TEXT NOT NULL,
    zona TEXT NOT NULL,
    indicaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Catálogo de Productos
CREATE TABLE products (
    id TEXT PRIMARY KEY,
    codigo TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    categoria TEXT NOT NULL,
    subcategoria TEXT,
    presentacion TEXT NOT NULL,
    unidad TEXT DEFAULT 'unidad' NOT NULL,
    precio NUMERIC DEFAULT 0.0 NOT NULL,
    precio_mayorista NUMERIC,
    descripcion TEXT,
    imagen TEXT,
    activo BOOLEAN DEFAULT TRUE NOT NULL,
    visible_en_app BOOLEAN DEFAULT TRUE NOT NULL,
    destacado BOOLEAN DEFAULT FALSE NOT NULL,
    dolarizado BOOLEAN DEFAULT FALSE NOT NULL,
    precio_usd NUMERIC DEFAULT 0.0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by TEXT
);

-- Historial de Precios de Productos
CREATE TABLE product_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    precio_anterior NUMERIC NOT NULL,
    precio_nuevo NUMERIC NOT NULL,
    cambio_tipo TEXT NOT NULL CHECK (cambio_tipo IN ('manual', 'masivo', 'dolarizacion')),
    criterio TEXT, -- ej. "Marca: Ala", "Categoría: Limpieza", "Porcentaje: 10%"
    cotizacion_usd NUMERIC,
    usuario_responsable TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Inventario / Stock por Sucursal
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
    stock NUMERIC DEFAULT 0.0 NOT NULL,
    stock_minimo NUMERIC DEFAULT 5.0 NOT NULL,
    disponible BOOLEAN DEFAULT FALSE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE (product_id, branch_id)
);

-- Movimientos de Stock
CREATE TABLE inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
    cantidad_anterior NUMERIC,
    cantidad_modificada NUMERIC NOT NULL,
    cantidad_resultante NUMERIC,
    tipo_movimiento TEXT NOT NULL CHECK (tipo_movimiento IN (
        'carga_inicial', 'importacion', 'venta', 'reserva', 'liberacion_reserva',
        'cancelacion', 'devolucion', 'ajuste_manual', 'correccion', 'ingreso', 'egreso', 'rotura_perdida'
    )),
    motivo TEXT,
    pedido_id TEXT, -- Puede referenciar orders.id (no FK estricta para evitar bloqueos)
    importacion_id UUID,
    usuario_responsable TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Pedidos (Orders)
CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    numero TEXT UNIQUE NOT NULL,
    cliente_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    total NUMERIC DEFAULT 0.0 NOT NULL,
    estado TEXT DEFAULT 'recibido' NOT NULL CHECK (estado IN (
        'recibido', 'en_preparacion', 'listo_para_reparto', 'asignado', 'en_reparto',
        'entregado', 'pendiente_de_entrega', 'reprogramado', 'cancelado'
    )),
    observaciones TEXT, -- Internas
    observaciones_cliente TEXT, -- Visibles para el cliente
    repartidor_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    estimated_delivery_date TEXT, -- ej. "2026-07-15"
    estimated_delivery_shift TEXT CHECK (estimated_delivery_shift IN ('mañana', 'tarde')),
    delivery_zone TEXT,
    delivery_route_id TEXT,
    payment_method TEXT DEFAULT 'efectivo' NOT NULL,
    payment_status TEXT DEFAULT 'pendiente' NOT NULL,
    abona_con NUMERIC,
    cambio_estimado NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by TEXT
);

-- Detalle de Pedidos (Order Items)
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
    product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
    codigo TEXT NOT NULL,
    nombre TEXT NOT NULL,
    presentacion TEXT,
    precio_unitario NUMERIC NOT NULL,
    cantidad NUMERIC NOT NULL,
    subtotal NUMERIC NOT NULL
);

-- Historial de Cambios de Estado de Pedidos
CREATE TABLE order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
    estado_anterior TEXT NOT NULL,
    estado_nuevo TEXT NOT NULL,
    usuario TEXT NOT NULL,
    observacion TEXT,
    repartidor_relacionado TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Zonas de Entrega
CREATE TABLE delivery_zones (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE,
    activo BOOLEAN DEFAULT TRUE NOT NULL
);

-- Recorridos / Rutas de Entrega
CREATE TABLE delivery_routes (
    id TEXT PRIMARY KEY,
    branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
    repartidor_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    fecha TEXT NOT NULL, -- formato YYYY-MM-DD
    estado TEXT DEFAULT 'pendiente' NOT NULL CHECK (estado IN ('pendiente', 'armado', 'en_camino', 'entregado', 'no_entregado', 'reprogramado')),
    zona TEXT NOT NULL,
    horario_estimado TEXT,
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Entregas Asociadas a una Hoja de Ruta
CREATE TABLE deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id TEXT REFERENCES delivery_routes(id) ON DELETE CASCADE NOT NULL,
    order_id TEXT REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
    estado TEXT DEFAULT 'pendiente' NOT NULL,
    secuencia INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Asignaciones de Reparto
CREATE TABLE delivery_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id TEXT REFERENCES delivery_routes(id) ON DELETE CASCADE NOT NULL,
    order_id TEXT REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Eventos de Entrega / Paradas del Chofer
CREATE TABLE delivery_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id TEXT REFERENCES delivery_routes(id) ON DELETE CASCADE NOT NULL,
    cliente_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    evento TEXT NOT NULL, -- ej. "ENTREGA_CONFIRMADA", "REPROGRAMADO", "NO_ENTREGADO"
    completado BOOLEAN NOT NULL,
    hora_real TEXT,
    motivo_no_entrega TEXT,
    receptor_nombre TEXT,
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Remitos de Pedidos
CREATE TABLE receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
    numero_remito TEXT UNIQUE NOT NULL,
    receptor_nombre TEXT,
    receptor_firma TEXT, -- Puede almacenar base64 o URL de firma
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Cotizaciones de Moneda Extranjera
CREATE TABLE exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    valor_anterior NUMERIC,
    valor_nuevo NUMERIC NOT NULL,
    usuario_responsable TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Importaciones Excel
CREATE TABLE imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_archivo TEXT NOT NULL,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    usuario TEXT NOT NULL,
    cantidad_filas INTEGER DEFAULT 0 NOT NULL,
    productos_creados INTEGER DEFAULT 0 NOT NULL,
    productos_actualizados INTEGER DEFAULT 0 NOT NULL,
    filas_rechazadas INTEGER DEFAULT 0 NOT NULL,
    errores JSONB,
    estado TEXT NOT NULL CHECK (estado IN ('procesando', 'completado', 'error')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Detalle de filas de importación
CREATE TABLE import_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_id UUID REFERENCES imports(id) ON DELETE CASCADE NOT NULL,
    fila_numero INTEGER NOT NULL,
    datos JSONB NOT NULL,
    estado TEXT NOT NULL CHECK (estado IN ('exitoso', 'error')),
    error_detalle TEXT
);

-- Historial de Exportaciones
CREATE TABLE export_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario TEXT NOT NULL,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    tipo TEXT NOT NULL, -- ej. "productos", "pedidos", "movimientos"
    filtros JSONB,
    cantidad_registros INTEGER NOT NULL,
    nombre_archivo TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Configuraciones de Sistema
CREATE TABLE system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_by TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Historial de Pagos
CREATE TABLE payment_logs (
    id TEXT PRIMARY KEY,
    order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
    branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    monto NUMERIC NOT NULL,
    metodo TEXT NOT NULL,
    estado TEXT NOT NULL,
    referencia_mock TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Notificaciones del Sistema
CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    tipo TEXT NOT NULL,
    leido BOOLEAN DEFAULT FALSE NOT NULL,
    referencia_id TEXT,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Registro Centralizado de Auditoría
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario TEXT NOT NULL,
    accion TEXT NOT NULL, -- "INSERT", "UPDATE", "DELETE", "IMPORT", "EXPORT", etc.
    entidad TEXT NOT NULL, -- Tabla afectada
    registro_id TEXT, -- ID del registro afectado
    valores_anteriores JSONB,
    valores_nuevos JSONB,
    origen TEXT DEFAULT 'frontend' NOT NULL, -- "frontend", "backend", "db_trigger"
    observacion TEXT,
    referencia_relacionada TEXT, -- pedido_id, importacion_id, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);


-- ============================================================
-- 3. TRIGGERS Y FUNCIONES DE AUTOMATIZACIÓN SQL
-- ============================================================

-- A. Normalización Automática de Códigos de Producto (BEFORE INSERT/UPDATE)
CREATE OR REPLACE FUNCTION trg_fn_normalize_product_code()
RETURNS TRIGGER AS $$
BEGIN
    NEW.codigo := UPPER(TRIM(NEW.codigo));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_normalize_product_code
BEFORE INSERT OR UPDATE OF codigo ON products
FOR EACH ROW EXECUTE FUNCTION trg_fn_normalize_product_code();


-- B. Registro Automático de Movimientos de Stock (BEFORE INSERT on inventory_movements)
-- Este trigger permite que al insertar un movimiento de stock, se recalcule el stock anterior,
-- se calcule el nuevo stock, se actualice el inventario y se asignen automáticamente estos valores al movimiento.
CREATE OR REPLACE FUNCTION trg_fn_process_inventory_movement()
RETURNS TRIGGER AS $$
DECLARE
    curr_stock NUMERIC;
    curr_min NUMERIC;
    curr_disp BOOLEAN;
BEGIN
    -- Obtener o crear fila de inventario
    SELECT stock, stock_minimo INTO curr_stock, curr_min
    FROM inventory
    WHERE product_id = NEW.product_id AND branch_id = NEW.branch_id;

    IF NOT FOUND THEN
        curr_stock := 0.0;
        curr_min := 5.0;
        INSERT INTO inventory (product_id, branch_id, stock, stock_minimo, disponible)
        VALUES (NEW.product_id, NEW.branch_id, 0.0, curr_min, FALSE);
    END IF;

    NEW.cantidad_anterior := curr_stock;
    NEW.cantidad_resultante := curr_stock + NEW.cantidad_modificada;

    -- Validar que el stock no sea menor a cero
    IF NEW.cantidad_resultante < 0.0 THEN
        -- Aquí podemos forzar el bloqueo de venta sin stock si se desea
        -- NEW.cantidad_resultante := 0; -- o levantar excepción
        RAISE EXCEPTION 'Stock insuficiente para el producto % en la sucursal %. (Stock actual: %, requerido: %)', 
            NEW.product_id, NEW.branch_id, curr_stock, ABS(NEW.cantidad_modificada);
    END IF;

    -- Actualizar stock
    UPDATE inventory
    SET stock = NEW.cantidad_resultante,
        disponible = (NEW.cantidad_resultante > 0.0),
        updated_at = NOW()
    WHERE product_id = NEW.product_id AND branch_id = NEW.branch_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_process_inventory_movement
BEFORE INSERT ON inventory_movements
FOR EACH ROW EXECUTE FUNCTION trg_fn_process_inventory_movement();


-- C. Historial y Trazabilidad Automática de Cambios de Precio (AFTER UPDATE on products)
CREATE OR REPLACE FUNCTION trg_fn_track_product_price_changes()
RETURNS TRIGGER AS $$
DECLARE
    usuario_act TEXT;
    tipo_c_val TEXT;
    criterio_val TEXT;
    cotizacion_val NUMERIC;
BEGIN
    IF OLD.precio <> NEW.precio OR OLD.precio_usd <> NEW.precio_usd OR OLD.dolarizado <> NEW.dolarizado THEN
        -- Obtener usuario responsable de variables de sesión si está seteada, sino fallback
        usuario_act := COALESCE(current_setting('app.current_user_email', true), 'admin@quimicadeheza.com');
        tipo_c_val := COALESCE(current_setting('app.price_change_type', true), 'manual');
        criterio_val := COALESCE(current_setting('app.price_change_criteria', true), 'Edición de producto');
        
        -- Obtener cotización actual
        SELECT valor_nuevo INTO cotizacion_val FROM exchange_rates ORDER BY created_at DESC LIMIT 1;

        INSERT INTO product_prices (
            product_id, precio_anterior, precio_nuevo, cambio_tipo, criterio, cotizacion_usd, usuario_responsable
        ) VALUES (
            NEW.id, OLD.precio, NEW.precio, tipo_c_val, criterio_val, cotizacion_val, usuario_act
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_track_product_price_changes
AFTER UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION trg_fn_track_product_price_changes();


-- D. Central de Auditoría Automatizada (AFTER INSERT/UPDATE/DELETE)
CREATE OR REPLACE FUNCTION trg_fn_audit_log_changes()
RETURNS TRIGGER AS $$
DECLARE
    usr TEXT;
    act TEXT;
    tbl TEXT;
    r_id TEXT;
    v_old JSONB := NULL;
    v_new JSONB := NULL;
BEGIN
    tbl := TG_TABLE_NAME::TEXT;
    usr := COALESCE(current_setting('app.current_user_email', true), 'admin@quimicadeheza.com');

    IF TG_OP = 'INSERT' THEN
        act := 'INSERT';
        r_id := NEW.id::TEXT;
        v_new := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        act := 'UPDATE';
        r_id := NEW.id::TEXT;
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        act := 'DELETE';
        r_id := OLD.id::TEXT;
        v_old := to_jsonb(OLD);
    END IF;

    -- Evitar auditar la tabla de logs misma
    IF tbl <> 'audit_logs' AND tbl <> 'product_prices' AND tbl <> 'inventory_movements' THEN
        INSERT INTO audit_logs (
            usuario, accion, entidad, registro_id, valores_anteriores, valores_nuevos, origen, observacion
        ) VALUES (
            usr, act, tbl, r_id, v_old, v_new, 'db_trigger', 'Operación automática de base de datos'
        );
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Asignar auditorías a tablas clave
CREATE TRIGGER trg_audit_products AFTER INSERT OR UPDATE OR DELETE ON products FOR EACH ROW EXECUTE FUNCTION trg_fn_audit_log_changes();
CREATE TRIGGER trg_audit_customers AFTER INSERT OR UPDATE OR DELETE ON customers FOR EACH ROW EXECUTE FUNCTION trg_fn_audit_log_changes();
CREATE TRIGGER trg_audit_orders AFTER INSERT OR UPDATE OR DELETE ON orders FOR EACH ROW EXECUTE FUNCTION trg_fn_audit_log_changes();
CREATE TRIGGER trg_audit_system_settings AFTER INSERT OR UPDATE OR DELETE ON system_settings FOR EACH ROW EXECUTE FUNCTION trg_fn_audit_log_changes();


-- E. Reserva Automática de Stock (AFTER INSERT on order_items)
CREATE OR REPLACE FUNCTION trg_fn_order_item_stock_reserve()
RETURNS TRIGGER AS $$
DECLARE
    ord_branch TEXT;
    usr TEXT;
BEGIN
    -- Obtener la sucursal del pedido y usuario
    SELECT branch_id, COALESCE(deleted_by, 'client') INTO ord_branch, usr FROM orders WHERE id = NEW.order_id;
    
    -- Insertar movimiento negativo en stock (el trigger de inventory_movements restará el stock automáticamente)
    INSERT INTO inventory_movements (
        product_id, branch_id, cantidad_modificada, tipo_movimiento, motivo, pedido_id, usuario_responsable
    ) VALUES (
        NEW.product_id, ord_branch, -NEW.cantidad, 'reserva', 'Reserva automática por nuevo pedido', NEW.order_id, usr
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_item_stock_reserve
AFTER INSERT ON order_items
FOR EACH ROW EXECUTE FUNCTION trg_fn_order_item_stock_reserve();


-- F. Devolución de Stock al Cancelar y Historial de Estado (AFTER UPDATE on orders)
CREATE OR REPLACE FUNCTION trg_fn_order_stock_cancel()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
    usr TEXT;
BEGIN
    -- Si el estado cambia a cancelado, devolver stock
    IF OLD.estado <> 'cancelado' AND NEW.estado = 'cancelado' THEN
        usr := COALESCE(current_setting('app.current_user_email', true), 'admin@quimicadeheza.com');
        
        -- Recorrer items de la orden y sumar stock
        FOR item IN SELECT product_id, cantidad FROM order_items WHERE order_id = NEW.id LOOP
            INSERT INTO inventory_movements (
                product_id, branch_id, cantidad_modificada, tipo_movimiento, motivo, pedido_id, usuario_responsable
            ) VALUES (
                item.product_id, NEW.branch_id, item.cantidad, 'cancelacion', 'Liberación de stock por pedido cancelado', NEW.id, usr
            );
        END LOOP;
    END IF;
    
    -- Registrar historial de cambios de estado
    IF OLD.estado <> NEW.estado THEN
        usr := COALESCE(current_setting('app.current_user_email', true), 'admin@quimicadeheza.com');
        INSERT INTO order_status_history (
            order_id, estado_anterior, estado_nuevo, usuario, observacion
        ) VALUES (
            NEW.id, OLD.estado, NEW.estado, usr, COALESCE(NEW.observaciones, 'Cambio de estado del pedido')
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_stock_cancel
AFTER UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION trg_fn_order_stock_cancel();



-- ============================================================
-- 4. SEGURIDAD: ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Habilitar RLS en tablas críticas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Políticas Públicas/Generales Simplificadas para la Demo (En producción se restringe por auth.role)
CREATE POLICY "Acceso total para administradores" ON profiles FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Acceso total para clientes" ON customers FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Acceso total para direcciones" ON customer_addresses FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Acceso total para productos" ON products FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Acceso total para precios" ON product_prices FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Acceso total para inventario" ON inventory FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Acceso total para movimientos" ON inventory_movements FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Acceso total para pedidos" ON orders FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Acceso total para items de pedido" ON order_items FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Acceso total para rutas de entrega" ON delivery_routes FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Acceso total para eventos de entrega" ON delivery_events FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Acceso total para logs de auditoria" ON audit_logs FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Acceso total para logs de pagos" ON payment_logs FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Acceso total para notificaciones" ON notifications FOR ALL USING (TRUE) WITH CHECK (TRUE);


-- ============================================================
-- 5. SEMILLAS / DATOS DE INICIALIZACIÓN MÍNIMOS
-- ============================================================

-- A. Sucursales
INSERT INTO branches (id, nombre, direccion, telefono, whatsapp, horario_atencion, activo) VALUES
('branch-gd1', 'GENERAL DEHEZA 1', 'Av. San Martín 150', '+54 358 405-1111', '5493584051111', 'Lunes a Viernes de 8 a 17 hs.', TRUE),
('branch-gd2', 'GENERAL DEHEZA 2', 'Ruta 158 km 220', '+54 358 405-2222', '5493584052222', 'Lunes a Viernes de 8 a 17 hs.', TRUE),
('branch-rc', 'RIO CUARTO', 'Bv. Roca 850', '+54 358 464-3333', '5493584643333', 'Lunes, Miércoles y Viernes de 9 a 16 hs.', TRUE),
('branch-gig', 'GIGENA', 'Córdoba 54', '+54 358 493-4444', '5493584934444', 'Martes y Jueves de 9 a 15 hs.', TRUE);

-- B. Sectores Internos (Para General Deheza 1)
INSERT INTO sectors (id, branch_id, nombre, descripcion, activo) VALUES
('sector-1', 'branch-gd1', 'Administración', 'Gestión general, facturación e importación de artículos', TRUE),
('sector-2', 'branch-gd1', 'Ventas', 'Atención a clientes y toma de pedidos', TRUE),
('sector-3', 'branch-gd1', 'Depósito', 'Control de stock y almacenamiento', TRUE),
('sector-4', 'branch-gd1', 'Reparto', 'Logística y despacho de camiones', TRUE),
('sector-5', 'branch-gd1', 'Caja', 'Gestión de pagos y cobros en efectivo', TRUE);

-- C. Perfiles Demo para Pruebas de Ingreso
INSERT INTO profiles (id, nombre, email, rol, branch_id, sector_id, activo, telefono) VALUES
('user-admin-1', 'Gabriel Areco', 'admin@quimicadeheza.com', 'admin', 'branch-gd1', 'sector-1', TRUE, '+54 358 400-0001'),
('rep-daniel', 'Daniel Gómez', 'daniel@quimicadeheza.com', 'repartidor', 'branch-gd1', 'sector-4', TRUE, '+54 9 358 405-9999');

-- D. Chofer Daniel
INSERT INTO drivers (id, vehiculo_info, activo) VALUES
('rep-daniel', 'Camión Mercedes Benz - Patente AA123BB', TRUE);

-- E. Cliente Demo Ana García (Necesario para login de cliente)
INSERT INTO customers (id, nombre, cuit, telefono, whatsapp, email, direccion, zona, branch_id, tipo_cliente, activo, observaciones) VALUES
('cli-ana-garcia', 'Ana García', '27-30444555-6', '+54 358 411-2222', '5493584112222', 'ana@gmail.com', 'Calle Falsa 123', 'Zona Centro', 'branch-gd1', 'minorista', TRUE, 'Cliente minorista demo');

-- F. Cotización del Dólar Inicial
INSERT INTO exchange_rates (valor_anterior, valor_nuevo, usuario_responsable) VALUES
(NULL, 1000.00, 'admin@quimicadeheza.com');

-- G. Zonas de Entrega
INSERT INTO delivery_zones (id, nombre, descripcion, branch_id, activo) VALUES
('zona-centro', 'Zona Centro', 'Centro de General Deheza', 'branch-gd1', TRUE),
('zona-norte', 'Zona Norte', 'Norte de General Deheza', 'branch-gd1', TRUE);
