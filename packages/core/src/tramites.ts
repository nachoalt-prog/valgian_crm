import { eq, and, sql } from "drizzle-orm";
import { db, tramites, tramitesCamposDatos, tiposTramite, categoriasTiposTramite, entidades, clientes, cuentas, legajos, estados } from "@valgian/db";
import { validarIdentificador, getEstimulosDesdeEstado, type EstimuloDisponible } from "./motor-estados";

/**
 * Trámites — formularios configurables por tipo, con su propio ciclo de
 * estados (reutiliza el motor de estados genérico). Ver domain/tramites.md.
 */

export interface CandidatoAplicarA {
  id: string;
  label: string;
}

async function aplicarFiltroOrden(nombreFn: string, candidatos: CandidatoAplicarA[]): Promise<CandidatoAplicarA[]> {
  if (candidatos.length === 0) return [];
  validarIdentificador(nombreFn);
  const fn = sql.raw(nombreFn);
  // `${ids}::uuid[]` no sirve: postgres.js serializa un array JS pasado como
  // parámetro suelto como una fila (record), no como un array literal —
  // armamos el ARRAY[...] explícito con cada elemento parametrizado por separado.
  const arrayLiteral = sql.join(
    candidatos.map((c) => sql`${c.id}::uuid`),
    sql`, `,
  );
  const filas = await db.execute<{ id: string }>(
    sql`SELECT id FROM unnest(${fn}(ARRAY[${arrayLiteral}])) WITH ORDINALITY AS t(id, ord) ORDER BY ord`,
  );
  const porId = new Map(candidatos.map((c) => [c.id, c]));
  return filas.map((f) => porId.get(f.id)).filter((c): c is CandidatoAplicarA => !!c);
}

/**
 * Candidatos para el desplegable "Aplicar a" del ABM de Trámites — depende de
 * a qué ENTIDADES apunta el tipo de trámite elegido. Por ahora `idLegajoRecibido`
 * es siempre un legajo (la herramienta solo recibe legajos de momento).
 */
export async function resolverCandidatosAplicarA(idTipoTramite: string, idLegajoRecibido: string): Promise<CandidatoAplicarA[]> {
  const [tipo] = await db
    .select({ filtro: tiposTramite.filtro, entidadCodigo: entidades.codigo })
    .from(tiposTramite)
    .leftJoin(entidades, eq(entidades.id, tiposTramite.idEntidad))
    .where(eq(tiposTramite.id, idTipoTramite));

  if (!tipo) return [];

  if (tipo.entidadCodigo === "legajos") {
    const [legajo] = await db.select({ numero: legajos.numero }).from(legajos).where(eq(legajos.id, idLegajoRecibido));
    return legajo ? [{ id: idLegajoRecibido, label: legajo.numero }] : [];
  }

  let candidatos: CandidatoAplicarA[];

  if (tipo.entidadCodigo === "clientes") {
    const filas = await db
      .select({ id: clientes.id, apellido: clientes.apellido, nombre: clientes.nombre })
      .from(clientes)
      .where(eq(clientes.idLegajo, idLegajoRecibido))
      .orderBy(clientes.apellido, clientes.nombre);
    candidatos = filas.map((f) => ({ id: f.id, label: `${f.apellido ?? ""}, ${f.nombre}` }));
  } else if (tipo.entidadCodigo === "cuentas") {
    const filas = await db
      .select({ id: cuentas.id, numero: cuentas.numero })
      .from(cuentas)
      .where(eq(cuentas.idLegajo, idLegajoRecibido))
      .orderBy(cuentas.numero);
    candidatos = filas.map((f) => ({ id: f.id, label: f.numero }));
  } else {
    return [];
  }

  return tipo.filtro ? aplicarFiltroOrden(tipo.filtro, candidatos) : candidatos;
}

/** Label human-readable de un registro puntual, según a qué ENTIDADES pertenece — mismo criterio que resolverCandidatosAplicarA. */
async function resolverLabelRegistro(entidadCodigo: string | null, idRegistro: string): Promise<string | null> {
  if (entidadCodigo === "legajos") {
    const [legajo] = await db.select({ numero: legajos.numero }).from(legajos).where(eq(legajos.id, idRegistro));
    return legajo?.numero ?? null;
  }
  if (entidadCodigo === "clientes") {
    const [cliente] = await db.select({ apellido: clientes.apellido, nombre: clientes.nombre }).from(clientes).where(eq(clientes.id, idRegistro));
    return cliente ? `${cliente.apellido ?? ""}, ${cliente.nombre}` : null;
  }
  if (entidadCodigo === "cuentas") {
    const [cuenta] = await db.select({ numero: cuentas.numero }).from(cuentas).where(eq(cuentas.id, idRegistro));
    return cuenta?.numero ?? null;
  }
  return null;
}

export interface CabeceraTramite {
  tipoNombre: string;
  categoriaNombre: string | null;
  entidadLabel: string | null;
}

/** Datos fijos para la cabecera tipo-ticket del Modal de Trámites (tipo/categoría/entidad). */
export async function getCabeceraTramite(idTipoTramite: string, idRegistro: string): Promise<CabeceraTramite | null> {
  const [tipo] = await db
    .select({
      tipoNombre: tiposTramite.nombre,
      categoriaNombre: categoriasTiposTramite.nombre,
      entidadCodigo: entidades.codigo,
    })
    .from(tiposTramite)
    .leftJoin(categoriasTiposTramite, eq(categoriasTiposTramite.id, tiposTramite.idCategoria))
    .leftJoin(entidades, eq(entidades.id, tiposTramite.idEntidad))
    .where(eq(tiposTramite.id, idTipoTramite));

  if (!tipo) return null;

  const entidadLabel = await resolverLabelRegistro(tipo.entidadCodigo, idRegistro);
  return { tipoNombre: tipo.tipoNombre, categoriaNombre: tipo.categoriaNombre, entidadLabel };
}

export interface EstimulosDisponiblesTramiteResult {
  estadoActual: { id: string; nombre: string } | null;
  estimulos: EstimuloDisponible[];
}

/**
 * Estímulos aplicables para el Modal de Trámites. Si `idTramite` es null (alta
 * nueva) se parte del estado inicial de la estrategia del tipo de trámite.
 */
export async function getEstimulosDisponiblesTramite(
  idTipoTramite: string,
  idTramite: string | null,
  perfilId: string,
): Promise<EstimulosDisponiblesTramiteResult> {
  let estadoActual: { id: string; nombre: string } | null = null;

  if (idTramite) {
    const [fila] = await db
      .select({ id: estados.id, nombre: estados.nombre })
      .from(tramites)
      .innerJoin(estados, eq(estados.id, tramites.idEstado))
      .where(eq(tramites.id, idTramite));
    estadoActual = fila ?? null;
  } else {
    const [tipo] = await db.select({ idEstrategia: tiposTramite.idEstrategia }).from(tiposTramite).where(eq(tiposTramite.id, idTipoTramite));
    if (tipo?.idEstrategia) {
      const [inicial] = await db
        .select({ id: estados.id, nombre: estados.nombre })
        .from(estados)
        .where(and(eq(estados.idEstrategia, tipo.idEstrategia), eq(estados.esInicial, true)));
      estadoActual = inicial ?? null;
    }
  }

  if (!estadoActual) return { estadoActual: null, estimulos: [] };

  const disponibles = await getEstimulosDesdeEstado(estadoActual.id, perfilId);
  return { estadoActual, estimulos: disponibles };
}

export interface TramiteCampoValor {
  idTipoTramiteCampo: string | null;
  valorTexto: string | null;
  valorNumero: number | null;
  valorFecha: Date | null;
  valorBooleano: boolean | null;
  idArchivoAdjunto: string | null;
}

export interface TramiteDetalle {
  id: string;
  idTipoTramite: string | null;
  idRegistro: string | null;
  idEstado: string | null;
  numero: string;
  valores: TramiteCampoValor[];
}

/** Datos de un trámite existente, para prellenar el Modal de Trámites al editar. */
export async function getTramiteDetalle(idTramite: string): Promise<TramiteDetalle | null> {
  const [fila] = await db.select().from(tramites).where(eq(tramites.id, idTramite));
  if (!fila) return null;

  const valores = await db
    .select({
      idTipoTramiteCampo: tramitesCamposDatos.idTipoTramiteCampo,
      valorTexto: tramitesCamposDatos.valorTexto,
      valorNumero: tramitesCamposDatos.valorNumero,
      valorFecha: tramitesCamposDatos.valorFecha,
      valorBooleano: tramitesCamposDatos.valorBooleano,
      idArchivoAdjunto: tramitesCamposDatos.idArchivoAdjunto,
    })
    .from(tramitesCamposDatos)
    .where(eq(tramitesCamposDatos.idTramite, idTramite));

  return { id: fila.id, idTipoTramite: fila.idTipoTramite, idRegistro: fila.idRegistro, idEstado: fila.idEstado, numero: fila.numero, valores };
}

export interface TramiteListadoFila {
  id: string;
  idTipoTramite: string;
  idRegistro: string | null;
  tipoTramiteNombre: string | null;
  estadoNombre: string | null;
  altaFecha: Date | null;
  altaUsuarioNombre: string | null;
  auditFecha: Date | null;
  auditUsuarioNombre: string | null;
}

export interface FiltrosTramitesLegajo {
  idTipoTramite?: string;
  altaFechaDesde?: string;
  altaFechaHasta?: string;
  auditFechaDesde?: string;
  auditFechaHasta?: string;
  altaUsuario?: string;
  auditUsuario?: string;
}

/**
 * Trámites de un legajo: los propios, más los de sus clientes y sus cuentas.
 * Consulta bespoke (no pasa por el motor de Bandejas/Filtros) porque está
 * acotada a un legajo puntual — ver domain/tramites.md.
 */
export async function listTramitesPorLegajo(idLegajo: string, filtros: FiltrosTramitesLegajo = {}): Promise<TramiteListadoFila[]> {
  const condiciones = [];
  if (filtros.idTipoTramite) condiciones.push(sql`"ID_TIPO_TRAMITE" = ${filtros.idTipoTramite}`);
  if (filtros.altaFechaDesde) condiciones.push(sql`"ALTA_FECHA" >= ${filtros.altaFechaDesde}`);
  if (filtros.altaFechaHasta) condiciones.push(sql`"ALTA_FECHA" <= ${filtros.altaFechaHasta}`);
  if (filtros.auditFechaDesde) condiciones.push(sql`"AUDIT_FECHA" >= ${filtros.auditFechaDesde}`);
  if (filtros.auditFechaHasta) condiciones.push(sql`"AUDIT_FECHA" <= ${filtros.auditFechaHasta}`);
  if (filtros.altaUsuario) condiciones.push(sql`"ALTA_USUARIO_ID" = ${filtros.altaUsuario}`);
  if (filtros.auditUsuario) condiciones.push(sql`"AUDIT_USUARIO_ID" = ${filtros.auditUsuario}`);
  const whereClause = condiciones.length > 0 ? sql.join(condiciones, sql` AND `) : sql`true`;

  const query = sql`
    SELECT * FROM (
      SELECT
        t."ID" AS id,
        t."ID_TIPO_TRAMITE" AS "ID_TIPO_TRAMITE",
        t."ID_REGISTRO" AS "ID_REGISTRO",
        tt."NOMBRE" AS tipo_tramite_nombre,
        e."NOMBRE" AS estado_nombre,
        t."ALTA_FECHA" AS "ALTA_FECHA",
        ua."USERNAME" AS alta_usuario_nombre,
        t."ALTA_USUARIO" AS "ALTA_USUARIO_ID",
        t."AUDIT_FECHA" AS "AUDIT_FECHA",
        ug."USERNAME" AS audit_usuario_nombre,
        t."AUDIT_USUARIO" AS "AUDIT_USUARIO_ID"
      FROM "TRAMITES" t
      JOIN "TIPOS_TRAMITE" tt ON tt."ID" = t."ID_TIPO_TRAMITE"
      JOIN "ENTIDADES" ent ON ent."ID" = tt."ID_ENTIDAD"
      LEFT JOIN "ESTADOS" e ON e."ID" = t."ID_ESTADO"
      LEFT JOIN "USUARIOS" ua ON ua."ID" = t."ALTA_USUARIO"
      LEFT JOIN "USUARIOS" ug ON ug."ID" = t."AUDIT_USUARIO"
      WHERE
        (ent."CODIGO" = 'legajos' AND t."ID_REGISTRO" = ${idLegajo})
        OR (ent."CODIGO" = 'clientes' AND t."ID_REGISTRO" IN (SELECT "ID" FROM "CLIENTES" WHERE "ID_LEGAJO" = ${idLegajo}))
        OR (ent."CODIGO" = 'cuentas' AND t."ID_REGISTRO" IN (SELECT "ID" FROM "CUENTAS" WHERE "ID_LEGAJO" = ${idLegajo}))
    ) x
    WHERE ${whereClause}
    ORDER BY "AUDIT_FECHA" DESC NULLS LAST
  `;

  const filas = await db.execute<{
    id: string;
    ID_TIPO_TRAMITE: string;
    ID_REGISTRO: string | null;
    tipo_tramite_nombre: string | null;
    estado_nombre: string | null;
    ALTA_FECHA: Date | null;
    alta_usuario_nombre: string | null;
    AUDIT_FECHA: Date | null;
    audit_usuario_nombre: string | null;
  }>(query);

  return filas.map((f) => ({
    id: f.id,
    idTipoTramite: f.ID_TIPO_TRAMITE,
    idRegistro: f.ID_REGISTRO,
    tipoTramiteNombre: f.tipo_tramite_nombre,
    estadoNombre: f.estado_nombre,
    altaFecha: f.ALTA_FECHA,
    altaUsuarioNombre: f.alta_usuario_nombre,
    auditFecha: f.AUDIT_FECHA,
    auditUsuarioNombre: f.audit_usuario_nombre,
  }));
}

export interface DatoTramiteInput {
  idTipoTramiteCampo: string;
  valorTexto?: string | null;
  valorNumero?: number | null;
  valorFecha?: Date | null;
  valorBooleano?: boolean | null;
  idArchivoAdjunto?: string | null;
}

const CODIGOS_NUMERO = new Set(["INPUT_NUMBER", "INPUT_RANGE"]);
const CODIGOS_FECHA = new Set(["INPUT_DATETIME"]);
const CODIGOS_BOOLEANO = new Set(["INPUT_CHECKBOX"]);
const CODIGOS_ARCHIVO = new Set(["FILE"]);

/**
 * Un campo OBLIGATORIO se considera vacío según su tipo — un checkbox
 * obligatorio exige estar tildado, un SELECT_MULTIPLE exige al menos un
 * valor elegido. Usado tanto en el server action (gestionarTramiteAction,
 * defensa en profundidad) como, con una copia mínima equivalente, en el
 * Modal de Trámites del lado del cliente (no puede importar de acá: arrastraría
 * el cliente de Postgres al bundle del navegador).
 */
export function esValorVacio(valor: unknown, codigoTipoCampo: string | null): boolean {
  if (valor === null || valor === undefined || valor === "") return true;
  if (codigoTipoCampo === "SELECT_MULTIPLE") return !Array.isArray(valor) || valor.length === 0;
  if (codigoTipoCampo && CODIGOS_BOOLEANO.has(codigoTipoCampo)) return valor !== true;
  return false;
}

/**
 * Resuelve en qué columna de TRAMITES_CAMPOS_DATOS va el valor crudo de un
 * campo, según el CODIGO de su TIPOS_CAMPOS. SELECT_MULTIPLE es un caso
 * especial: varios valores en un solo registro, serializados como JSON en
 * VALOR_TEXTO (ver domain/tramites.md).
 */
export function mapearValorCampo(codigoTipoCampo: string | null, idTipoTramiteCampo: string, valorCrudo: unknown): DatoTramiteInput {
  const base: DatoTramiteInput = { idTipoTramiteCampo };
  if (valorCrudo === null || valorCrudo === undefined || valorCrudo === "") return base;

  if (codigoTipoCampo === "SELECT_MULTIPLE") return { ...base, valorTexto: JSON.stringify(valorCrudo) };
  if (codigoTipoCampo && CODIGOS_NUMERO.has(codigoTipoCampo)) return { ...base, valorNumero: Number(valorCrudo) };
  if (codigoTipoCampo && CODIGOS_FECHA.has(codigoTipoCampo)) return { ...base, valorFecha: new Date(valorCrudo as string) };
  if (codigoTipoCampo && CODIGOS_BOOLEANO.has(codigoTipoCampo)) return { ...base, valorBooleano: Boolean(valorCrudo) };
  if (codigoTipoCampo && CODIGOS_ARCHIVO.has(codigoTipoCampo)) return { ...base, idArchivoAdjunto: String(valorCrudo) };
  return { ...base, valorTexto: String(valorCrudo) };
}

/** Mapeo inverso de {@link mapearValorCampo} — reconstruye el valor "crudo" que espera el formulario a partir de la fila guardada. */
export function reconstruirValorCampo(codigoTipoCampo: string | null, fila: TramiteCampoValor): unknown {
  if (codigoTipoCampo === "SELECT_MULTIPLE") return fila.valorTexto ? JSON.parse(fila.valorTexto) : [];
  if (codigoTipoCampo && CODIGOS_NUMERO.has(codigoTipoCampo)) return fila.valorNumero;
  if (codigoTipoCampo && CODIGOS_FECHA.has(codigoTipoCampo)) return fila.valorFecha;
  if (codigoTipoCampo && CODIGOS_BOOLEANO.has(codigoTipoCampo)) return fila.valorBooleano ?? false;
  if (codigoTipoCampo && CODIGOS_ARCHIVO.has(codigoTipoCampo)) return fila.idArchivoAdjunto;
  return fila.valorTexto ?? "";
}

export interface GestionarTramiteInput {
  idTramite?: string | null;
  idTipoTramite: string;
  idRegistro: string;
  datos: DatoTramiteInput[];
  idEstimulo: string;
  idUsuario: string;
  observacion?: string | null;
}

interface Resultado<T> {
  data?: T;
  error?: string;
}

/** Ejecuta SP_GESTIONAR_TRAMITE — ver packages/db/sql/0003_sp_gestionar_tramite.sql. */
export async function gestionarTramite(input: GestionarTramiteInput): Promise<Resultado<{ idTramite: string }>> {
  const idTramite = input.idTramite ?? crypto.randomUUID();
  try {
    await db.execute(
      sql`CALL sp_gestionar_tramite(${idTramite}, ${input.idTipoTramite}, ${input.idRegistro}, ${JSON.stringify(input.datos)}::jsonb, ${input.idEstimulo}, ${input.idUsuario}, ${input.observacion ?? null})`,
    );
    return { data: { idTramite } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error gestionando el trámite.";
    return { error: message };
  }
}
