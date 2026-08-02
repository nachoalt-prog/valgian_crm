-- Unicidad de EMAILS.PRINCIPAL por ID_CLIENTE — mismo criterio que
-- CLIENTES.ES_TITULAR por ID_LEGAJO (ver 0001_trigger_clientes_titular.sql):
-- al marcar un email como principal, el resto de los emails del mismo
-- cliente se ponen en false automáticamente.
CREATE OR REPLACE FUNCTION fn_emails_principal_unico()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "EMAILS"
  SET "PRINCIPAL" = false
  WHERE "ID_CLIENTE" = NEW."ID_CLIENTE"
    AND "ID" <> NEW."ID";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_emails_principal_unico
AFTER INSERT OR UPDATE OF "PRINCIPAL", "ID_CLIENTE" ON "EMAILS"
FOR EACH ROW
WHEN (NEW."PRINCIPAL" IS TRUE)
EXECUTE FUNCTION fn_emails_principal_unico();
