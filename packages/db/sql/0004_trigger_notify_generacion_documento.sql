-- Notifica al proceso Next.js (LISTEN persistente, ver instrumentation.ts) que
-- hay una fila nueva para procesar en GENERACIONES_DOCUMENTO. El payload es
-- SOLO el ID de la fila (NOTIFY limita el payload a 8000 bytes, y aunque no lo
-- limitara: el listener siempre vuelve a consultar la tabla, nunca confía en
-- el contenido del payload) — ver domain/generacion-documentos.md.
CREATE OR REPLACE FUNCTION fn_notify_generacion_documento()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_notify('generaciones_documento', NEW."ID"::text);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generaciones_documento_notify ON "GENERACIONES_DOCUMENTO";

CREATE TRIGGER trg_generaciones_documento_notify
AFTER INSERT ON "GENERACIONES_DOCUMENTO"
FOR EACH ROW
EXECUTE FUNCTION fn_notify_generacion_documento();
