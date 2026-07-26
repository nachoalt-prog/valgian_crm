import type { ComponentType } from "react";
import { DatosLegajoTool } from "@/components/datos-legajo-tool";
import { ClientesAbmTool } from "@/components/clientes-abm-tool";

export interface LegajoHerramientaProps {
  idLegajo: string;
  canGestionar: boolean;
}

/**
 * HERRAMIENTAS.CODIGO -> componente embebible dentro de una solapa de
 * LAYOUTS_LEGAJO. Mismo criterio de indirección que lib/icons.ts (ADR 0011):
 * la clave es estable, no el nombre del componente.
 */
export const LEGAJO_HERRAMIENTAS: Record<string, ComponentType<LegajoHerramientaProps>> = {
  LEGAJO_DAT_1: DatosLegajoTool,
  LEGAJO_CLI_1: ClientesAbmTool,
};
