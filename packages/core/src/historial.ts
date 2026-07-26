import { and, eq, desc, aliasedTable } from "drizzle-orm";
import { db, historial, estados, estimulos, usuarios } from "@valgian/db";

const estado0Table = aliasedTable(estados, "estado0Table");
const estado1Table = aliasedTable(estados, "estado1Table");

export interface HistorialFila {
  id: string;
  estado0Nombre: string | null;
  estimuloNombre: string | null;
  estado1Nombre: string | null;
  auditFecha: Date | null;
  auditUsuarioNombre: string | null;
  accionesStatus: number | null;
  accionesError: string | null;
  observacion: string | null;
}

/** Historial completo de transiciones de un registro puntual — ver domain/motor-de-estados.md. */
export async function listHistorial(idEntidad: string, idRelacion: string): Promise<HistorialFila[]> {
  return db
    .select({
      id: historial.id,
      estado0Nombre: estado0Table.nombre,
      estimuloNombre: estimulos.nombre,
      estado1Nombre: estado1Table.nombre,
      auditFecha: historial.auditFecha,
      auditUsuarioNombre: usuarios.username,
      accionesStatus: historial.accionesStatus,
      accionesError: historial.accionesError,
      observacion: historial.observacion,
    })
    .from(historial)
    .leftJoin(estado0Table, eq(estado0Table.id, historial.idEstado0))
    .leftJoin(estimulos, eq(estimulos.id, historial.idEstimulo))
    .leftJoin(estado1Table, eq(estado1Table.id, historial.idEstado1))
    .leftJoin(usuarios, eq(usuarios.id, historial.auditUsuario))
    .where(and(eq(historial.idEntidad, idEntidad), eq(historial.idRelacion, idRelacion)))
    .orderBy(desc(historial.auditFecha));
}
