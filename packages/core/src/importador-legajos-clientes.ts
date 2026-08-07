import { db, importLegajosClientesStg } from "@valgian/db";
import { registrarCargadorImportador, derivarPlantillaImportador, mapearFilasImportador } from "./importadores";

const TABLA_STAGING = "IMPORT_LEGAJOS_CLIENTES_STG";

/**
 * Primer importador real (Fase 3, ADR 0021, domain/importadores.md) — una
 * fila trae datos de un LEGAJO y/o un CLIENTE. La validación real y el
 * upsert viven en sp_import_legajos_clientes (packages/db/sql/0023_...);
 * acá solo se vuelca el archivo ya parseado a la tabla de staging.
 *
 * Sin plantilla hardcodeada: derivarPlantillaImportador la arma en runtime
 * desde el schema real de IMPORT_LEGAJOS_CLIENTES_STG — agregar una columna
 * a la tabla ya alcanza para que el archivo modelo y la detección de
 * encabezado se actualicen solas, sin tocar este archivo.
 */
export function registrarImportadorLegajosClientes(): void {
  registrarCargadorImportador("legajos_clientes", async (idEjecucion, filas) => {
    const columnas = await derivarPlantillaImportador(TABLA_STAGING);
    const mapeadas = mapearFilasImportador(filas, columnas);
    if (mapeadas.length === 0) return;

    await db.insert(importLegajosClientesStg).values(
      mapeadas.map(({ nroFila, campos }) => ({ idEjecucion, nroFila, ...campos }) as typeof importLegajosClientesStg.$inferInsert),
    );
  });
}
