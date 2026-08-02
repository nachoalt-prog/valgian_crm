import { and, eq } from "drizzle-orm";
import { db, menues, menuesOpciones, permisos, operaciones, interfacesMenues } from "@valgian/db";
import { OPERACION_ACCESO } from "./permissions";

interface MenuOpcion {
  id: string;
  codigo: string;
  nombre: string;
  icono: string | null;
  orden: number | null;
}

interface MenuGrupo {
  nombre: string;
  orden: number | null;
  abierto: boolean | null;
  opciones: MenuOpcion[];
}

/**
 * Menú visible para un perfil: MENUES_OPCIONES cuya HERRAMIENTA tiene una fila en
 * PERMISOS para este perfil (la existencia de la fila ya implica acceso — no hay
 * columna VER separada), dentro de los menúes asociados a la INTERFAZ del perfil.
 * Ver domain/infraestructura.md.
 */
export async function getMenuForPerfil(perfilId: string, interfazId: string | null): Promise<MenuGrupo[]> {
  if (!interfazId) return [];

  const filas = await db
    .select({
      menuId: menues.id,
      menuNombre: menues.nombre,
      menuOrden: menues.orden,
      menuAbierto: menues.abierto,
      opcionId: menuesOpciones.id,
      opcionCodigo: menuesOpciones.codigo,
      opcionNombre: menuesOpciones.nombre,
      icono: menuesOpciones.icono,
      orden: menuesOpciones.orden,
    })
    .from(interfacesMenues)
    .innerJoin(menues, eq(menues.id, interfacesMenues.idMenu))
    .innerJoin(menuesOpciones, eq(menuesOpciones.idMenu, menues.id))
    .innerJoin(operaciones, and(eq(operaciones.idHerramienta, menuesOpciones.idHerramienta), eq(operaciones.codigo, OPERACION_ACCESO)))
    .innerJoin(permisos, and(eq(permisos.idOperacion, operaciones.id), eq(permisos.idPerfil, perfilId)))
    .where(eq(interfacesMenues.idInterfaz, interfazId));

  const grupos = new Map<string, MenuGrupo>();
  for (const fila of filas) {
    if (!grupos.has(fila.menuId)) {
      grupos.set(fila.menuId, { nombre: fila.menuNombre, orden: fila.menuOrden, abierto: fila.menuAbierto, opciones: [] });
    }
    grupos.get(fila.menuId)!.opciones.push({
      id: fila.opcionId,
      codigo: fila.opcionCodigo,
      nombre: fila.opcionNombre,
      icono: fila.icono,
      orden: fila.orden,
    });
  }

  const listaGrupos = Array.from(grupos.values());
  for (const grupo of listaGrupos) {
    grupo.opciones.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  }
  listaGrupos.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

  return listaGrupos;
}
