import { isNotNull } from "drizzle-orm";
import { db, monedas, cotizaciones } from "@valgian/db";

export interface MonedaConCodigoApi {
  id: string;
  codigo: string;
  nombre: string;
  codigoApi: string;
}

/** Solo las MONEDAS que se consultan contra una API externa (CODIGO_API no nulo) — ver domain/acciones-externas.md. */
export async function listMonedasConCodigoApi(): Promise<MonedaConCodigoApi[]> {
  const filas = await db.select().from(monedas).where(isNotNull(monedas.codigoApi));
  return filas.map((f) => ({ ...f, codigoApi: f.codigoApi as string }));
}

export interface CrearCotizacionInput {
  idMoneda: string;
  compra: number;
  venta: number;
  idAccionExternaCola?: string | null;
}

export async function crearCotizacion(input: CrearCotizacionInput): Promise<void> {
  await db.insert(cotizaciones).values({
    idMoneda: input.idMoneda,
    compra: input.compra,
    venta: input.venta,
    fechaConsulta: new Date(),
    idAccionExternaCola: input.idAccionExternaCola ?? null,
  });
}
