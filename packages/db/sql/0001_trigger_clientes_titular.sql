-- Unicidad de CLIENTES.ES_TITULAR por ID_LEGAJO (domain/core.md, sección
-- Clientes, regla "unicidad de titular"): al marcar una fila como titular,
-- el resto de los clientes del mismo legajo se ponen en false automáticamente.
CREATE OR REPLACE FUNCTION fn_clientes_titular_unico()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "CLIENTES"
  SET "ES_TITULAR" = false
  WHERE "ID_LEGAJO" = NEW."ID_LEGAJO"
    AND "ID" <> NEW."ID";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clientes_titular_unico
AFTER INSERT OR UPDATE OF "ES_TITULAR", "ID_LEGAJO" ON "CLIENTES"
FOR EACH ROW
WHEN (NEW."ES_TITULAR" IS TRUE)
EXECUTE FUNCTION fn_clientes_titular_unico();
