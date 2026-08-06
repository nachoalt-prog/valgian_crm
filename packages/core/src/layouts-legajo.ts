import { and, eq } from "drizzle-orm";
import { db, layoutsLegajo, layoutsLegajoSolapas, bandejas, herramientas } from "@valgian/db";
import { getPermisosParaHerramientas, OPERACION_ACCESO } from "./permissions";

export interface SolapaLegajo {
  id: string;
  orden: number;
  nombre: string;
  herramientaCodigo: string | null;
  canGestionar: boolean;
  // Config de esta instancia puntual — ver domain/infraestructura.md, "Parámetros por punto de acceso".
  parametros: Record<string, unknown> | null;
}

export interface LayoutLegajo {
  id: string;
  codigo: string;
  nombre: string;
  solapas: SolapaLegajo[];
}

/**
 * Resuelve qué LAYOUTS_LEGAJO corresponde a una bandeja, y filtra sus solapas
 * según los permisos del perfil actual — una solapa con herramienta asignada
 * pero sin fila en PERMISOS para esa herramienta queda directamente afuera
 * (mismo criterio que el resto de la app: sin PERMISOS, sin acceso).
 */
export async function getLayoutParaBandeja(bandejaId: string, perfilId: string): Promise<LayoutLegajo | null> {
  const [bandeja] = await db.select({ idLayout: bandejas.idLayout }).from(bandejas).where(eq(bandejas.id, bandejaId));
  if (!bandeja?.idLayout) return null;

  const [layout] = await db.select().from(layoutsLegajo).where(eq(layoutsLegajo.id, bandeja.idLayout));
  if (!layout) return null;

  const solapasRaw = await db
    .select({
      id: layoutsLegajoSolapas.id,
      orden: layoutsLegajoSolapas.orden,
      nombre: layoutsLegajoSolapas.nombre,
      herramientaCodigo: herramientas.codigo,
      parametros: layoutsLegajoSolapas.parametros,
    })
    .from(layoutsLegajoSolapas)
    .leftJoin(herramientas, eq(herramientas.id, layoutsLegajoSolapas.idHerramienta))
    .where(and(eq(layoutsLegajoSolapas.idLayout, layout.id), eq(layoutsLegajoSolapas.visible, true)))
    .orderBy(layoutsLegajoSolapas.orden);

  // Un solo IN en vez de un chequeo de permiso por solapa (antes: hasta 2
  // round-trips secuenciales POR solapa — con 6-7 solapas por layout, era el
  // principal contribuyente a la latencia de abrir un legajo).
  const codigosConHerramienta = solapasRaw.map((s) => s.herramientaCodigo).filter((c): c is string => !!c);
  const codigosConAcceso = await getPermisosParaHerramientas(perfilId, codigosConHerramienta, OPERACION_ACCESO);

  const solapas: SolapaLegajo[] = [];
  for (const s of solapasRaw) {
    if (!s.herramientaCodigo) {
      solapas.push({ id: s.id, orden: s.orden ?? 0, nombre: s.nombre, herramientaCodigo: null, canGestionar: false, parametros: null });
      continue;
    }
    if (!codigosConAcceso.has(s.herramientaCodigo)) continue;
    solapas.push({
      id: s.id,
      orden: s.orden ?? 0,
      nombre: s.nombre,
      herramientaCodigo: s.herramientaCodigo,
      canGestionar: true,
      parametros: s.parametros,
    });
  }

  return { id: layout.id, codigo: layout.codigo, nombre: layout.nombre, solapas };
}
