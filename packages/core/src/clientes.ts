import { eq } from "drizzle-orm";
import { db, clientes, caracteres, tiposDocumento, generos, provincias } from "@valgian/db";

export interface ClienteConNombres {
  id: string;
  idLegajo: string | null;
  idCaracter: string | null;
  caracterNombre: string | null;
  esTitular: boolean | null;
  idTipoDocumento: string | null;
  tipoDocumentoCodigo: string | null;
  nroDocumento: string | null;
  apellido: string | null;
  nombre: string;
  idGenero: string | null;
  generoNombre: string | null;
  idProvincia: string | null;
  provinciaNombre: string | null;
}

export async function listClientesPorLegajo(idLegajo: string): Promise<ClienteConNombres[]> {
  return db
    .select({
      id: clientes.id,
      idLegajo: clientes.idLegajo,
      idCaracter: clientes.idCaracter,
      caracterNombre: caracteres.nombre,
      esTitular: clientes.esTitular,
      idTipoDocumento: clientes.idTipoDocumento,
      tipoDocumentoCodigo: tiposDocumento.codigo,
      nroDocumento: clientes.nroDocumento,
      apellido: clientes.apellido,
      nombre: clientes.nombre,
      idGenero: clientes.idGenero,
      generoNombre: generos.nombre,
      idProvincia: clientes.idProvincia,
      provinciaNombre: provincias.nombre,
    })
    .from(clientes)
    .leftJoin(caracteres, eq(caracteres.id, clientes.idCaracter))
    .leftJoin(tiposDocumento, eq(tiposDocumento.id, clientes.idTipoDocumento))
    .leftJoin(generos, eq(generos.id, clientes.idGenero))
    .leftJoin(provincias, eq(provincias.id, clientes.idProvincia))
    .where(eq(clientes.idLegajo, idLegajo))
    .orderBy(clientes.nombre);
}

export interface ClienteInput {
  idLegajo: string;
  idCaracter: string | null;
  esTitular: boolean;
  idTipoDocumento: string | null;
  nroDocumento: string | null;
  apellido: string | null;
  nombre: string;
  idGenero: string | null;
  idProvincia: string | null;
}

interface Resultado<T> {
  data?: T;
  error?: string;
}

export async function createCliente(data: ClienteInput, idUsuarioAudit: string): Promise<Resultado<typeof clientes.$inferSelect>> {
  const ahora = new Date();
  const [fila] = await db
    .insert(clientes)
    .values({ ...data, altaFecha: ahora, altaUsuario: idUsuarioAudit, auditFecha: ahora, auditUsuario: idUsuarioAudit })
    .returning();
  return { data: fila };
}

export async function updateCliente(id: string, data: ClienteInput, idUsuarioAudit: string): Promise<Resultado<typeof clientes.$inferSelect>> {
  const [fila] = await db
    .update(clientes)
    .set({ ...data, auditFecha: new Date(), auditUsuario: idUsuarioAudit })
    .where(eq(clientes.id, id))
    .returning();
  return { data: fila };
}

export async function deleteCliente(id: string): Promise<Resultado<true>> {
  await db.delete(clientes).where(eq(clientes.id, id));
  return { data: true };
}
