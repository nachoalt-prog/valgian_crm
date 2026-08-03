-- Genera TRAMITES.NUMERO automáticamente al crear un trámite — ver
-- domain/tramites.md. PREFIJO (CATEGORIAS_TIPOS_TRAMITE, vía TIPOS_TRAMITE) +
-- secuencial con padding a 6 dígitos por defecto (más si el número lo
-- necesita, ej. a partir de 1000000 usa 7 dígitos sin recortar).
--
-- Concurrencia: INSERT ... ON CONFLICT DO UPDATE ... RETURNING es una única
-- sentencia atómica — dos altas concurrentes de la misma categoría nunca
-- pueden leer el mismo ULTIMO_NUMERO (Postgres serializa a nivel de fila acá,
-- sin necesitar un lock explícito ni SEQUENCE dinámicas por prefijo). Mismo
-- patrón ON CONFLICT DO UPDATE que ya usa sp_gestionar_tramite.sql para
-- upsertear TRAMITES_CAMPOS_DATOS.
CREATE TABLE IF NOT EXISTS "TRAMITES_NUMERO_SECUENCIA" (
  "ID_CATEGORIA" uuid PRIMARY KEY REFERENCES "CATEGORIAS_TIPOS_TRAMITE"("ID"),
  "ULTIMO_NUMERO" integer NOT NULL
);

CREATE OR REPLACE FUNCTION fn_tramites_generar_numero() RETURNS trigger AS $$
DECLARE
  v_id_categoria uuid;
  v_prefijo text;
  v_numero integer;
BEGIN
  SELECT ctt."ID", ctt."PREFIJO" INTO v_id_categoria, v_prefijo
  FROM "TIPOS_TRAMITE" tt
  JOIN "CATEGORIAS_TIPOS_TRAMITE" ctt ON ctt."ID" = tt."ID_CATEGORIA"
  WHERE tt."ID" = NEW."ID_TIPO_TRAMITE";

  IF v_prefijo IS NULL THEN
    RAISE EXCEPTION 'El tipo de trámite % no tiene categoría con prefijo asignado — no se puede generar NUMERO', NEW."ID_TIPO_TRAMITE";
  END IF;

  INSERT INTO "TRAMITES_NUMERO_SECUENCIA" ("ID_CATEGORIA", "ULTIMO_NUMERO") VALUES (v_id_categoria, 1)
  ON CONFLICT ("ID_CATEGORIA") DO UPDATE SET "ULTIMO_NUMERO" = "TRAMITES_NUMERO_SECUENCIA"."ULTIMO_NUMERO" + 1
  RETURNING "ULTIMO_NUMERO" INTO v_numero;

  NEW."NUMERO" := v_prefijo || lpad(v_numero::text, GREATEST(6, length(v_numero::text)), '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tramites_generar_numero ON "TRAMITES";
CREATE TRIGGER trg_tramites_generar_numero
  BEFORE INSERT ON "TRAMITES"
  FOR EACH ROW
  EXECUTE FUNCTION fn_tramites_generar_numero();
