-- ============================================================
-- MIGRACIÓN: POLÍTICA DE LECTURA PÚBLICA PARA SYSTEM_SETTINGS
-- Y CORRECCIÓN DEL TRIGGER DE AUDITORÍA
-- ============================================================
-- Necesario para que el cliente móvil pueda leer configuraciones
-- como el monto mínimo de compra sin autenticación.

-- Habilitar RLS en system_settings si no está habilitado
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Política de lectura anónima/pública para system_settings
-- (los clientes de la app deben leer configuraciones globales)
DROP POLICY IF EXISTS "Lectura pública de configuraciones" ON system_settings;
CREATE POLICY "Lectura pública de configuraciones"
  ON system_settings
  FOR SELECT
  USING (TRUE);

-- Política de escritura para todos (admin usa anon key)
DROP POLICY IF EXISTS "Escritura solo admin en system_settings" ON system_settings;
CREATE POLICY "Escritura solo admin en system_settings"
  ON system_settings
  FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

-- ============================================================
-- CORRECCIÓN: El trigger de auditoría usa NEW.id pero
-- system_settings tiene PK = key (no id).
-- Se dropea el trigger genérico y se crea uno específico.
-- ============================================================
DROP TRIGGER IF EXISTS trg_audit_system_settings ON system_settings;

CREATE OR REPLACE FUNCTION trg_fn_audit_system_settings()
RETURNS TRIGGER AS $$
DECLARE
    usr TEXT;
    act TEXT;
    r_id TEXT;
    v_old JSONB := NULL;
    v_new JSONB := NULL;
BEGIN
    usr := COALESCE(current_setting('app.current_user_email', true), 'admin@quimicadeheza.com');

    IF TG_OP = 'INSERT' THEN
        act := 'INSERT';
        r_id := NEW.key;
        v_new := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        act := 'UPDATE';
        r_id := NEW.key;
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        act := 'DELETE';
        r_id := OLD.key;
        v_old := to_jsonb(OLD);
    END IF;

    INSERT INTO audit_logs (
        usuario, accion, entidad, registro_id, valores_anteriores, valores_nuevos, origen, observacion
    ) VALUES (
        usr, act, 'system_settings', r_id, v_old, v_new, 'db_trigger', 'Operación automática de base de datos'
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_system_settings
  AFTER INSERT OR UPDATE OR DELETE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION trg_fn_audit_system_settings();

