-- Borra las asociaciones de ARCHIVOS_ADJUNTOS_ENTIDADES cuando se borra el
-- adjunto dueño — sin esto, borrarArchivo() fallaría por la FK (NO ACTION)
-- si el archivo tiene alguna asociación. BEFORE DELETE: para cuando Postgres
-- chequea la FK al final del statement, los hijos ya no existen. Ver
-- domain/archivos-adjuntos.md.
CREATE OR REPLACE FUNCTION fn_cascade_archivos_adjuntos_entidades()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM "ARCHIVOS_ADJUNTOS_ENTIDADES" WHERE "ID_ARCHIVO_ADJUNTO" = OLD."ID";
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_archivos_adjuntos_cascade_entidades ON "ARCHIVOS_ADJUNTOS";

CREATE TRIGGER trg_archivos_adjuntos_cascade_entidades
BEFORE DELETE ON "ARCHIVOS_ADJUNTOS"
FOR EACH ROW
EXECUTE FUNCTION fn_cascade_archivos_adjuntos_entidades();
