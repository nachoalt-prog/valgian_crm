import { eq, aliasedTable } from "drizzle-orm";
import { db, legajos, estados, usuarios } from "@valgian/db";

const altaUsuarios = aliasedTable(usuarios, "altaUsuarios");
const auditUsuarios = aliasedTable(usuarios, "auditUsuarios");

export interface LegajoDetalle {
  id: string;
  numero: string;
  estadoNombre: string | null;
  altaFecha: Date | null;
  altaUsuarioNombre: string | null;
  auditFecha: Date | null;
  auditUsuarioNombre: string | null;
}

export async function getLegajoDetalle(id: string): Promise<LegajoDetalle | null> {
  const [fila] = await db
    .select({
      id: legajos.id,
      numero: legajos.numero,
      estadoNombre: estados.nombre,
      altaFecha: legajos.altaFecha,
      altaUsuarioNombre: altaUsuarios.username,
      auditFecha: legajos.auditFecha,
      auditUsuarioNombre: auditUsuarios.username,
    })
    .from(legajos)
    .leftJoin(estados, eq(estados.id, legajos.idEstado))
    .leftJoin(altaUsuarios, eq(altaUsuarios.id, legajos.altaUsuario))
    .leftJoin(auditUsuarios, eq(auditUsuarios.id, legajos.auditUsuario))
    .where(eq(legajos.id, id));

  return fila ?? null;
}

interface Resultado<T> {
  data?: T;
  error?: string;
}

export async function updateLegajoNumero(id: string, numero: string, idUsuarioAudit: string): Promise<Resultado<true>> {
  await db.update(legajos).set({ numero, auditFecha: new Date(), auditUsuario: idUsuarioAudit }).where(eq(legajos.id, id));
  return { data: true };
}
