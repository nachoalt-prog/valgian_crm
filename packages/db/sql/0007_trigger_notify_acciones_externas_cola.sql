-- Notifica al proceso Next.js (LISTEN persistente, ver instrumentation-node.ts)
-- que hay una fila nueva en ACCIONES_EXTERNAS_COLA. Mismo patrón que
-- 0004_trigger_notify_generacion_documento.sql: el payload es solo el ID
-- (NOTIFY limita a 8000 bytes, y aunque no lo limitara, el barrido siempre
-- vuelve a consultar la tabla entera, nunca confía en el payload) — ver
-- domain/acciones-externas.md. Este NOTIFY solo acelera el primer intento de
-- una fila recién encolada; los reintentos los toma el barrido periódico
-- (la fila se reprocesa in-place, no genera un NOTIFY nuevo).
CREATE OR REPLACE FUNCTION fn_notify_acciones_externas_cola()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_notify('acciones_externas_cola', NEW."ID"::text);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_acciones_externas_cola_notify ON "ACCIONES_EXTERNAS_COLA";

CREATE TRIGGER trg_acciones_externas_cola_notify
AFTER INSERT ON "ACCIONES_EXTERNAS_COLA"
FOR EACH ROW
EXECUTE FUNCTION fn_notify_acciones_externas_cola();
