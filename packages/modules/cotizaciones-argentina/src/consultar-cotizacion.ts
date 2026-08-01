import { listMonedasConCodigoApi, crearCotizacion, finalizarIntentoAccionExterna, type FilaAccionExternaCola } from "@valgian/core";

/**
 * Handler del COMPONENTE 'consulta_cotizacion' — pega contra DolarApi (gratis,
 * sin auth) una vez por cada MONEDA con CODIGO_API configurado (data-driven,
 * sin lista hardcodeada acá) e inserta el resultado en COTIZACIONES. Si
 * alguna consulta puntual falla, sigue con las demás — pero al final, si
 * hubo al menos una falla, reporta error al despachador igual (ver
 * domain/acciones-externas.md).
 */

const DOLARAPI_BASE = "https://dolarapi.com/v1/dolares";

interface DolarApiRespuesta {
  compra: number;
  venta: number;
  casa: string;
  nombre: string;
  moneda: string;
  fechaActualizacion: string;
}

export async function consultarCotizacion(fila: FilaAccionExternaCola): Promise<void> {
  const inicio = Date.now();
  const monedas = await listMonedasConCodigoApi();

  const request: Record<string, string> = {};
  const response: Record<string, unknown> = {};
  const errores: string[] = [];
  let exitos = 0;

  for (const moneda of monedas) {
    const url = `${DOLARAPI_BASE}/${moneda.codigoApi}`;
    request[moneda.codigo] = url;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as DolarApiRespuesta;
      response[moneda.codigo] = data;

      await crearCotizacion({
        idMoneda: moneda.id,
        compra: data.compra,
        venta: data.venta,
        idAccionExternaCola: fila.id,
      });
      exitos++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      response[moneda.codigo] = { error: message };
      errores.push(`${moneda.codigo}: ${message}`);
    }
  }

  await finalizarIntentoAccionExterna(fila.id, {
    resultado: errores.length === 0 ? 0 : 1,
    resultadoDesc:
      errores.length === 0
        ? `${exitos}/${monedas.length} cotizaciones actualizadas.`
        : `${exitos}/${monedas.length} ok, fallaron: ${errores.join("; ")}`,
    request,
    response,
    tiempoConexionMs: Date.now() - inicio,
  });
}
