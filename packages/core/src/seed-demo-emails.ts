import { eq, and, sql } from "drizzle-orm";
import {
  db,
  closeDb,
  usuarios,
  entidades,
  estrategias,
  estados,
  estimulos,
  transiciones,
  acciones,
  transicionesAcciones,
  placeholders,
  categoriasTiposTramite,
  tiposTramite,
  legajos,
  clientes,
  tramites,
  historial,
} from "@valgian/db";
import { gestionarTramite } from "./tramites";
import { crearMensajeriaPlantilla, getMensajeriaPlantillaPorCodigo } from "./mensajeria-plantillas";
import { aplicarEstimulo } from "./motor-estados";

const ADMIN_USERNAME = "admin";

/**
 * Seed especial de datos de prueba para Mensajería — separado de
 * packages/core/src/seed-demo.ts a propósito (es un conjunto de datos grande
 * y autocontenido, pensado para probar el circuito completo de placeholders
 * → plantillas → trámites → motor de estados → mensajería, no para mezclarse
 * con los datos de legajos/clientes genéricos). Depende de seed-demo.ts
 * (usa los legajos/clientes/EMAILS que ese seed ya creó).
 */

async function getAdminUsuario() {
  const [admin] = await db.select().from(usuarios).where(eq(usuarios.username, ADMIN_USERNAME));
  if (!admin) throw new Error(`No existe el usuario "${ADMIN_USERNAME}" — corré el seed principal ("pnpm db:seed") primero.`);
  return admin;
}

async function getEntidadPorCodigo(codigo: string) {
  const [entidad] = await db.select().from(entidades).where(eq(entidades.codigo, codigo));
  if (!entidad) throw new Error(`No existe ENTIDADES.CODIGO = "${codigo}" — corré el seed principal primero.`);
  return entidad;
}

async function getLegajoPorNumero(numero: string) {
  const [legajo] = await db.select().from(legajos).where(eq(legajos.numero, numero));
  if (!legajo) throw new Error(`No existe LEGAJOS.NUMERO = "${numero}" — corré packages/core/src/seed-demo.ts primero.`);
  return legajo;
}

async function getTitularDelLegajo(idLegajo: string) {
  const [titular] = await db.select().from(clientes).where(and(eq(clientes.idLegajo, idLegajo), eq(clientes.esTitular, true)));
  if (!titular) throw new Error(`No existe un cliente titular para el legajo ${idLegajo}.`);
  return titular;
}

async function ensureCategoriaTipoTramite(codigo: string, nombre: string) {
  const [existente] = await db.select().from(categoriasTiposTramite).where(eq(categoriasTiposTramite.codigo, codigo));
  if (existente) return existente;

  const [creada] = await db.insert(categoriasTiposTramite).values({ codigo, nombre }).returning();
  return creada;
}

async function ensureTipoTramite(params: { codigo: string; nombre: string; idCategoria: string; idEstrategia: string; idEntidad: string }) {
  const [existente] = await db.select().from(tiposTramite).where(eq(tiposTramite.codigo, params.codigo));
  if (existente) return existente;

  const [creado] = await db.insert(tiposTramite).values(params).returning();
  return creado;
}

async function ensureEstrategia(codigo: string, nombre: string, idEntidad: string) {
  const [existente] = await db.select().from(estrategias).where(eq(estrategias.codigo, codigo));
  if (existente) return existente;

  const [creada] = await db.insert(estrategias).values({ codigo, nombre, idEntidad }).returning();
  return creada;
}

async function ensureEstado(idEstrategia: string, codigo: string, nombre: string, esInicial: boolean, esFinal: boolean) {
  const [existente] = await db.select().from(estados).where(and(eq(estados.idEstrategia, idEstrategia), eq(estados.codigo, codigo)));
  if (existente) return existente;

  const [creado] = await db.insert(estados).values({ idEstrategia, codigo, nombre, esInicial, esFinal }).returning();
  return creado;
}

async function ensureEstimulo(idEstrategia: string, codigo: string, nombre: string) {
  const [existente] = await db.select().from(estimulos).where(and(eq(estimulos.idEstrategia, idEstrategia), eq(estimulos.codigo, codigo)));
  if (existente) return existente;

  const [creado] = await db.insert(estimulos).values({ idEstrategia, codigo, nombre }).returning();
  return creado;
}

async function ensureTransicion(idEstrategia: string, idEstado0: string, idEstimulo: string, idEstado1: string) {
  const [existente] = await db
    .select()
    .from(transiciones)
    .where(and(eq(transiciones.idEstrategia, idEstrategia), eq(transiciones.idEstado0, idEstado0), eq(transiciones.idEstimulo, idEstimulo)));
  if (existente) return existente;

  const [creada] = await db.insert(transiciones).values({ idEstrategia, idEstado0, idEstimulo, idEstado1 }).returning();
  return creada;
}

async function getTransicion(idEstrategia: string, idEstado0: string, idEstimulo: string) {
  const [transicion] = await db
    .select()
    .from(transiciones)
    .where(and(eq(transiciones.idEstrategia, idEstrategia), eq(transiciones.idEstado0, idEstado0), eq(transiciones.idEstimulo, idEstimulo)));
  if (!transicion) throw new Error(`No existe la transición (estrategia=${idEstrategia}, estado0=${idEstado0}, estimulo=${idEstimulo}).`);
  return transicion;
}

async function ensureAccion(params: { idEstrategia: string; codigo: string; nombre: string; comando: string }) {
  const [existente] = await db
    .select()
    .from(acciones)
    .where(and(eq(acciones.idEstrategia, params.idEstrategia), eq(acciones.codigo, params.codigo)));
  if (existente) return existente;

  const [creada] = await db.insert(acciones).values(params).returning();
  return creada;
}

async function ensureTransicionAccion(idTransicion: string, idAccion: string, orden: number) {
  const [existente] = await db
    .select()
    .from(transicionesAcciones)
    .where(and(eq(transicionesAcciones.idTransicion, idTransicion), eq(transicionesAcciones.idAccion, idAccion)));
  if (existente) return existente;

  const [creada] = await db.insert(transicionesAcciones).values({ idTransicion, idAccion, orden }).returning();
  return creada;
}

async function ensurePlaceholderDemo(params: { codigo: string; nombre: string; query: string; escapar: boolean }) {
  const [existente] = await db.select().from(placeholders).where(eq(placeholders.codigo, params.codigo));
  if (existente) return existente;

  const [creado] = await db.insert(placeholders).values(params).returning();
  return creado;
}

async function ensureMensajeriaPlantillaDemo(params: { codigo: string; nombre: string; descripcion?: string; asunto: string; html: string; idUsuario: string }) {
  const existente = await getMensajeriaPlantillaPorCodigo(params.codigo);
  if (existente) return existente;

  const resultado = await crearMensajeriaPlantilla({
    codigo: params.codigo,
    nombre: params.nombre,
    descripcion: params.descripcion ?? null,
    asunto: params.asunto,
    buffer: Buffer.from(params.html, "utf-8"),
    nombreOriginal: `${params.codigo}.html`,
    mimetype: "text/html",
    idUsuario: params.idUsuario,
  });
  if (resultado.error || !resultado.data) throw new Error(`Error creando la plantilla de mensajería demo "${params.codigo}": ${resultado.error}`);

  return getMensajeriaPlantillaPorCodigo(params.codigo);
}

/** Idempotente por (ID_TIPO_TRAMITE, ID_REGISTRO) — no re-aplica el estímulo de creación en corridas siguientes. */
async function ensureTramiteDemo(params: { idTipoTramite: string; idRegistro: string; idEstimulo: string; idUsuario: string; observacion?: string }) {
  const [existente] = await db
    .select()
    .from(tramites)
    .where(and(eq(tramites.idTipoTramite, params.idTipoTramite), eq(tramites.idRegistro, params.idRegistro)));
  if (existente) return existente;

  const resultado = await gestionarTramite({
    idTipoTramite: params.idTipoTramite,
    idRegistro: params.idRegistro,
    datos: [],
    idEstimulo: params.idEstimulo,
    idUsuario: params.idUsuario,
    observacion: params.observacion ?? null,
  });
  if (resultado.error) throw new Error(`Error creando trámite demo: ${resultado.error}`);

  const [fila] = await db.select().from(tramites).where(eq(tramites.id, resultado.data!.idTramite));
  return fila;
}

/** Aplica un estímulo sobre un trámite ya existente UNA sola vez (idempotente vía HISTORIAL). */
async function ensureEstimuloAplicadoUnaVez(idEntidad: string, idRelacion: string, idEstimulo: string, idUsuario: string, observacion?: string) {
  const [existente] = await db
    .select()
    .from(historial)
    .where(and(eq(historial.idEntidad, idEntidad), eq(historial.idRelacion, idRelacion), eq(historial.idEstimulo, idEstimulo)));
  if (existente) return;

  const resultado = await aplicarEstimulo(idEntidad, idRelacion, idEstimulo, idUsuario, observacion ?? null);
  if (resultado.error) throw new Error(`Error aplicando el estímulo demo "${idEstimulo}": ${resultado.error}`);
}

async function main() {
  const admin = await getAdminUsuario();
  const entidadTramites = await getEntidadPorCodigo("tramites");
  const entidadLegajos = await getEntidadPorCodigo("legajos");
  const entidadClientes = await getEntidadPorCodigo("clientes");

  // --- Procedures compartidos por las 4 acciones de este seed — resuelven el
  // destino (email) a partir del trámite y llaman a sp_encolar_mensaje_sin_commit
  // (packages/db/sql/0016), nunca a sp_mensajeria_encolar directo (no se puede
  // desde ACCIONES.COMANDO — ver domain/acciones-externas.md).
  await db.execute(sql`
    CREATE OR REPLACE PROCEDURE sp_notificar_titular_legajo_demo(p_id_tramite uuid, p_codigo_plantilla text)
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_id_legajo uuid;
      v_destino text;
      v_id_plantilla uuid;
      v_id_accion_externa uuid;
      v_id_entidad uuid;
    BEGIN
      SELECT t."ID_REGISTRO" INTO v_id_legajo
      FROM "TRAMITES" t
      JOIN "TIPOS_TRAMITE" tt ON tt."ID" = t."ID_TIPO_TRAMITE"
      JOIN "ENTIDADES" en ON en."ID" = tt."ID_ENTIDAD"
      WHERE t."ID" = p_id_tramite AND en."CODIGO" = 'legajos';
      IF v_id_legajo IS NULL THEN RETURN; END IF;

      SELECT e."EMAIL" INTO v_destino
      FROM "EMAILS" e
      JOIN "CLIENTES" c ON c."ID" = e."ID_CLIENTE"
      WHERE c."ID_LEGAJO" = v_id_legajo AND c."ES_TITULAR" = true AND e."PRINCIPAL" = true
      LIMIT 1;
      IF v_destino IS NULL THEN RETURN; END IF;

      SELECT "ID" INTO v_id_plantilla FROM "MENSAJERIA_PLANTILLAS" WHERE "CODIGO" = p_codigo_plantilla;
      SELECT "ID" INTO v_id_accion_externa FROM "ACCIONES_EXTERNAS" WHERE "CODIGO" = 'mensajeria_smtp';
      SELECT "ID" INTO v_id_entidad FROM "ENTIDADES" WHERE "CODIGO" = 'legajos';

      CALL sp_encolar_mensaje_sin_commit(v_id_plantilla, v_id_accion_externa, v_id_entidad, v_id_legajo, v_destino, jsonb_build_object('id_tramite', p_id_tramite::text));
    END;
    $$;
  `);

  await db.execute(sql`
    CREATE OR REPLACE PROCEDURE sp_notificar_cliente_tramite_demo(p_id_tramite uuid, p_codigo_plantilla text)
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_id_cliente uuid;
      v_destino text;
      v_id_plantilla uuid;
      v_id_accion_externa uuid;
      v_id_entidad uuid;
    BEGIN
      SELECT t."ID_REGISTRO" INTO v_id_cliente
      FROM "TRAMITES" t
      JOIN "TIPOS_TRAMITE" tt ON tt."ID" = t."ID_TIPO_TRAMITE"
      JOIN "ENTIDADES" en ON en."ID" = tt."ID_ENTIDAD"
      WHERE t."ID" = p_id_tramite AND en."CODIGO" = 'clientes';
      IF v_id_cliente IS NULL THEN RETURN; END IF;

      SELECT "EMAIL" INTO v_destino FROM "EMAILS" WHERE "ID_CLIENTE" = v_id_cliente AND "PRINCIPAL" = true LIMIT 1;
      IF v_destino IS NULL THEN RETURN; END IF;

      SELECT "ID" INTO v_id_plantilla FROM "MENSAJERIA_PLANTILLAS" WHERE "CODIGO" = p_codigo_plantilla;
      SELECT "ID" INTO v_id_accion_externa FROM "ACCIONES_EXTERNAS" WHERE "CODIGO" = 'mensajeria_smtp';
      SELECT "ID" INTO v_id_entidad FROM "ENTIDADES" WHERE "CODIGO" = 'clientes';

      CALL sp_encolar_mensaje_sin_commit(v_id_plantilla, v_id_accion_externa, v_id_entidad, v_id_cliente, v_destino, jsonb_build_object('id_tramite', p_id_tramite::text));
    END;
    $$;
  `);

  // --- Placeholders: conjunto TRA_LEGAJO_* — parten de un trámite sobre LEGAJOS ---
  const phLegajoNumero = await ensurePlaceholderDemo({
    codigo: "TRA_LEGAJO_NUMERO",
    nombre: "Número del legajo (demo mensajería)",
    query: `SELECT l."NUMERO" AS valor FROM "TRAMITES" t JOIN "LEGAJOS" l ON l."ID" = t."ID_REGISTRO" WHERE t."ID" = ($1::jsonb->>'id_tramite')::uuid`,
    escapar: true,
  });
  const phLegajoEstado = await ensurePlaceholderDemo({
    codigo: "TRA_LEGAJO_ESTADO",
    nombre: "Estado del legajo (demo mensajería)",
    query: `
      SELECT e."NOMBRE" AS valor
      FROM "TRAMITES" t
      JOIN "LEGAJOS" l ON l."ID" = t."ID_REGISTRO"
      JOIN "ESTADOS" e ON e."ID" = l."ID_ESTADO"
      WHERE t."ID" = ($1::jsonb->>'id_tramite')::uuid
    `,
    escapar: true,
  });
  const phLegajoTitularNombre = await ensurePlaceholderDemo({
    codigo: "TRA_LEGAJO_TITULAR_NOMBRE",
    nombre: "Nombre del titular del legajo (demo mensajería)",
    query: `
      SELECT c."APELLIDO" || ', ' || c."NOMBRE" AS valor
      FROM "TRAMITES" t
      JOIN "LEGAJOS" l ON l."ID" = t."ID_REGISTRO"
      JOIN "CLIENTES" c ON c."ID_LEGAJO" = l."ID" AND c."ES_TITULAR" = true
      WHERE t."ID" = ($1::jsonb->>'id_tramite')::uuid
    `,
    escapar: true,
  });
  const phLegajoFechaAlta = await ensurePlaceholderDemo({
    codigo: "TRA_LEGAJO_FECHA_ALTA",
    nombre: "Fecha de alta del legajo (demo mensajería)",
    query: `
      SELECT to_char(l."ALTA_FECHA", 'DD/MM/YYYY') AS valor
      FROM "TRAMITES" t JOIN "LEGAJOS" l ON l."ID" = t."ID_REGISTRO"
      WHERE t."ID" = ($1::jsonb->>'id_tramite')::uuid
    `,
    escapar: true,
  });

  // --- Placeholders: conjunto TRA_CLIENTE_* — parten de un trámite sobre CLIENTES ---
  const phClienteNombre = await ensurePlaceholderDemo({
    codigo: "TRA_CLIENTE_NOMBRE",
    nombre: "Nombre del cliente (demo mensajería)",
    query: `SELECT c."APELLIDO" || ', ' || c."NOMBRE" AS valor FROM "TRAMITES" t JOIN "CLIENTES" c ON c."ID" = t."ID_REGISTRO" WHERE t."ID" = ($1::jsonb->>'id_tramite')::uuid`,
    escapar: true,
  });
  const phClienteDocumento = await ensurePlaceholderDemo({
    codigo: "TRA_CLIENTE_DOCUMENTO",
    nombre: "Documento del cliente (demo mensajería)",
    query: `
      SELECT td."CODIGO" || ' ' || c."NRO_DOCUMENTO" AS valor
      FROM "TRAMITES" t
      JOIN "CLIENTES" c ON c."ID" = t."ID_REGISTRO"
      LEFT JOIN "TIPOS_DOCUMENTO" td ON td."ID" = c."ID_TIPO_DOCUMENTO"
      WHERE t."ID" = ($1::jsonb->>'id_tramite')::uuid
    `,
    escapar: true,
  });
  const phClienteLegajoNumero = await ensurePlaceholderDemo({
    codigo: "TRA_CLIENTE_LEGAJO_NUMERO",
    nombre: "Número del legajo del cliente (demo mensajería)",
    query: `
      SELECT l."NUMERO" AS valor
      FROM "TRAMITES" t
      JOIN "CLIENTES" c ON c."ID" = t."ID_REGISTRO"
      JOIN "LEGAJOS" l ON l."ID" = c."ID_LEGAJO"
      WHERE t."ID" = ($1::jsonb->>'id_tramite')::uuid
    `,
    escapar: true,
  });
  const phClienteLegajoEstado = await ensurePlaceholderDemo({
    codigo: "TRA_CLIENTE_LEGAJO_ESTADO",
    nombre: "Estado del legajo del cliente (demo mensajería)",
    query: `
      SELECT e."NOMBRE" AS valor
      FROM "TRAMITES" t
      JOIN "CLIENTES" c ON c."ID" = t."ID_REGISTRO"
      JOIN "LEGAJOS" l ON l."ID" = c."ID_LEGAJO"
      JOIN "ESTADOS" e ON e."ID" = l."ID_ESTADO"
      WHERE t."ID" = ($1::jsonb->>'id_tramite')::uuid
    `,
    escapar: true,
  });

  // --- 4 plantillas de prueba, 2 por conjunto de tags ---
  const estiloBase = `body{font-family:sans-serif;background:#f0f2f5;padding:24px;color:#1a1a2e;} .card{max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:28px 32px;box-shadow:0 4px 20px rgba(0,0,0,0.08);} h1{font-size:16px;color:#003e96;margin-bottom:14px;} p{font-size:14px;line-height:1.6;} .badge{display:inline-block;background:#e6f0ff;color:#003e96;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600;}`;

  await ensureMensajeriaPlantillaDemo({
    codigo: "demo_tra_legajo_resumen_1",
    nombre: "Resumen de legajo (demo)",
    descripcion: "Usa TRA_LEGAJO_NUMERO y TRA_LEGAJO_ESTADO.",
    asunto: `Actualización de tu legajo ##${phLegajoNumero.codigo}##`,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${estiloBase}</style></head><body>
      <div class="card">
        <h1>Resumen de tu legajo</h1>
        <p>Tu legajo <strong>##${phLegajoNumero.codigo}##</strong> está actualmente en estado <span class="badge">##${phLegajoEstado.codigo}##</span>.</p>
      </div>
    </body></html>`,
    idUsuario: admin.id,
  });

  await ensureMensajeriaPlantillaDemo({
    codigo: "demo_tra_legajo_titular_1",
    nombre: "Saludo al titular del legajo (demo)",
    descripcion: "Usa TRA_LEGAJO_TITULAR_NOMBRE y TRA_LEGAJO_FECHA_ALTA.",
    asunto: `Hola ##${phLegajoTitularNombre.codigo}##`,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${estiloBase}</style></head><body>
      <div class="card">
        <h1>Hola, ##${phLegajoTitularNombre.codigo}##</h1>
        <p>Tu legajo está registrado con nosotros desde el <strong>##${phLegajoFechaAlta.codigo}##</strong>. Gracias por confiar en nosotros.</p>
      </div>
    </body></html>`,
    idUsuario: admin.id,
  });

  await ensureMensajeriaPlantillaDemo({
    codigo: "demo_tra_cliente_datos_1",
    nombre: "Confirmación de datos del cliente (demo)",
    descripcion: "Usa TRA_CLIENTE_NOMBRE y TRA_CLIENTE_DOCUMENTO.",
    asunto: "Confirmación de tus datos",
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${estiloBase}</style></head><body>
      <div class="card">
        <h1>Confirmación de datos</h1>
        <p>Hola <strong>##${phClienteNombre.codigo}##</strong>, confirmamos que tenemos registrado tu documento <span class="badge">##${phClienteDocumento.codigo}##</span>.</p>
      </div>
    </body></html>`,
    idUsuario: admin.id,
  });

  await ensureMensajeriaPlantillaDemo({
    codigo: "demo_tra_cliente_legajo_1",
    nombre: "Legajo asociado al cliente (demo)",
    descripcion: "Usa TRA_CLIENTE_NOMBRE, TRA_CLIENTE_LEGAJO_NUMERO y TRA_CLIENTE_LEGAJO_ESTADO.",
    asunto: "Tu legajo asociado",
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${estiloBase}</style></head><body>
      <div class="card">
        <h1>Tu legajo asociado</h1>
        <p><strong>##${phClienteNombre.codigo}##</strong>, tu legajo <strong>##${phClienteLegajoNumero.codigo}##</strong> está en estado <span class="badge">##${phClienteLegajoEstado.codigo}##</span>.</p>
      </div>
    </body></html>`,
    idUsuario: admin.id,
  });

  // --- Tipo de trámite 1: sobre LEGAJOS, estrategia propia y aislada ---
  const categoriaPruebasMensajeria = await ensureCategoriaTipoTramite("pruebas_mensajeria", "Pruebas de Mensajería");

  const estrategiaMsgLegajo = await ensureEstrategia("MSG_LEGAJO_1", "Mensajería demo — trámites de legajo", entidadTramites.id);
  const estadoActivoLegajo = await ensureEstado(estrategiaMsgLegajo.id, "activo", "Activo", true, false);
  const estimuloNotifResumen = await ensureEstimulo(estrategiaMsgLegajo.id, "notificar_resumen", "Notificar resumen (demo)");
  const estimuloNotifTitular = await ensureEstimulo(estrategiaMsgLegajo.id, "notificar_titular", "Notificar titular (demo)");
  await ensureTransicion(estrategiaMsgLegajo.id, estadoActivoLegajo.id, estimuloNotifResumen.id, estadoActivoLegajo.id);
  await ensureTransicion(estrategiaMsgLegajo.id, estadoActivoLegajo.id, estimuloNotifTitular.id, estadoActivoLegajo.id);

  const accionNotifResumen = await ensureAccion({
    idEstrategia: estrategiaMsgLegajo.id,
    codigo: "accion_notificar_resumen_legajo",
    nombre: "Notificar resumen de legajo (demo)",
    comando: `CALL sp_notificar_titular_legajo_demo($1, 'demo_tra_legajo_resumen_1')`,
  });
  const accionNotifTitular = await ensureAccion({
    idEstrategia: estrategiaMsgLegajo.id,
    codigo: "accion_notificar_titular_legajo",
    nombre: "Notificar titular de legajo (demo)",
    comando: `CALL sp_notificar_titular_legajo_demo($1, 'demo_tra_legajo_titular_1')`,
  });
  await ensureTransicionAccion((await getTransicion(estrategiaMsgLegajo.id, estadoActivoLegajo.id, estimuloNotifResumen.id)).id, accionNotifResumen.id, 1);
  await ensureTransicionAccion((await getTransicion(estrategiaMsgLegajo.id, estadoActivoLegajo.id, estimuloNotifTitular.id)).id, accionNotifTitular.id, 1);

  const tipoTramiteMsgLegajo = await ensureTipoTramite({
    codigo: "TEST_MSG_LEGAJO_1",
    nombre: "Prueba mensajería (legajo)",
    idCategoria: categoriaPruebasMensajeria.id,
    idEstrategia: estrategiaMsgLegajo.id,
    idEntidad: entidadLegajos.id,
  });

  // --- Tipo de trámite 2: sobre CLIENTES, estrategia propia y aislada ---
  const estrategiaMsgCliente = await ensureEstrategia("MSG_CLIENTE_1", "Mensajería demo — trámites de cliente", entidadTramites.id);
  const estadoActivoCliente = await ensureEstado(estrategiaMsgCliente.id, "activo", "Activo", true, false);
  const estimuloNotifDatos = await ensureEstimulo(estrategiaMsgCliente.id, "notificar_datos", "Notificar datos (demo)");
  const estimuloNotifLegajoCliente = await ensureEstimulo(estrategiaMsgCliente.id, "notificar_legajo", "Notificar legajo asociado (demo)");
  await ensureTransicion(estrategiaMsgCliente.id, estadoActivoCliente.id, estimuloNotifDatos.id, estadoActivoCliente.id);
  await ensureTransicion(estrategiaMsgCliente.id, estadoActivoCliente.id, estimuloNotifLegajoCliente.id, estadoActivoCliente.id);

  const accionNotifDatos = await ensureAccion({
    idEstrategia: estrategiaMsgCliente.id,
    codigo: "accion_notificar_datos_cliente",
    nombre: "Notificar datos de cliente (demo)",
    comando: `CALL sp_notificar_cliente_tramite_demo($1, 'demo_tra_cliente_datos_1')`,
  });
  const accionNotifLegajoCliente = await ensureAccion({
    idEstrategia: estrategiaMsgCliente.id,
    codigo: "accion_notificar_legajo_cliente",
    nombre: "Notificar legajo asociado a cliente (demo)",
    comando: `CALL sp_notificar_cliente_tramite_demo($1, 'demo_tra_cliente_legajo_1')`,
  });
  await ensureTransicionAccion((await getTransicion(estrategiaMsgCliente.id, estadoActivoCliente.id, estimuloNotifDatos.id)).id, accionNotifDatos.id, 1);
  await ensureTransicionAccion((await getTransicion(estrategiaMsgCliente.id, estadoActivoCliente.id, estimuloNotifLegajoCliente.id)).id, accionNotifLegajoCliente.id, 1);

  const tipoTramiteMsgCliente = await ensureTipoTramite({
    codigo: "TEST_MSG_CLIENTE_1",
    nombre: "Prueba mensajería (cliente)",
    idCategoria: categoriaPruebasMensajeria.id,
    idEstrategia: estrategiaMsgCliente.id,
    idEntidad: entidadClientes.id,
  });

  // --- Instancias de trámite de prueba + disparo de las 4 acciones ---
  const legajo1 = await getLegajoPorNumero("DEMO-0001");
  const tramiteLegajo = await ensureTramiteDemo({
    idTipoTramite: tipoTramiteMsgLegajo.id,
    idRegistro: legajo1.id,
    idEstimulo: estimuloNotifResumen.id,
    idUsuario: admin.id,
    observacion: "Trámite demo — dispara el resumen del legajo por mail.",
  });
  await ensureEstimuloAplicadoUnaVez(entidadTramites.id, tramiteLegajo.id, estimuloNotifTitular.id, admin.id, "Trámite demo — saludo al titular por mail.");

  const legajo2 = await getLegajoPorNumero("DEMO-0002");
  const titular2 = await getTitularDelLegajo(legajo2.id);
  const tramiteCliente = await ensureTramiteDemo({
    idTipoTramite: tipoTramiteMsgCliente.id,
    idRegistro: titular2.id,
    idEstimulo: estimuloNotifDatos.id,
    idUsuario: admin.id,
    observacion: "Trámite demo — confirma datos del cliente por mail.",
  });
  await ensureEstimuloAplicadoUnaVez(entidadTramites.id, tramiteCliente.id, estimuloNotifLegajoCliente.id, admin.id, "Trámite demo — avisa el legajo asociado por mail.");

  console.log(
    "Seed de demo de emails/mensajería aplicado (idempotente): 8 placeholders (TRA_LEGAJO_*/TRA_CLIENTE_*), 4 plantillas, 2 tipos de trámite con máquina de estados propia (2 estímulos/transiciones/acciones cada uno), 2 trámites de prueba con las 4 acciones disparadas.",
  );
}

main()
  .catch((err) => {
    console.error("Error corriendo el seed de demo de emails:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
