import type { ComponentType } from "react";
import { DatosLegajoTool } from "@/components/datos-legajo-tool";
import { ClientesAbmTool } from "@/components/clientes-abm-tool";
import { GestionEntidadTool } from "@/components/gestion-entidad-tool";
import { HistorialTool } from "@/components/historial-tool";
import { TramitesAbmTool } from "@/components/tramites-abm-tool";
import { ArchivosAdjuntosTool } from "@/components/archivos-adjuntos-tool";

export interface LegajoHerramientaProps {
  idLegajo: string;
  // ID de ENTIDADES para "legajos" — lo necesitan las herramientas genéricas de
  // motor de estados (ej. Gestión de Entidad); las demás lo ignoran.
  idEntidad?: string;
  canGestionar: boolean;
  // Todas las solapas quedan montadas desde que se abre el modal (ver
  // legajo-layout-modal.tsx) para no re-fetchear al cambiar de pestaña. `revision`
  // sube cada vez que CUALQUIER herramienta reporta un cambio vía `onCambio`, así
  // que una herramienta que necesite mantenerse sincronizada con lo que hacen las
  // demás (ej. Historial, o el ESTADO en Datos de Legajo) solo tiene que sumarla
  // a las dependencias de su propio efecto de carga.
  revision: number;
  onCambio: () => void;
}

/**
 * HERRAMIENTAS.CODIGO -> componente embebible dentro de una solapa de
 * LAYOUTS_LEGAJO. Mismo criterio de indirección que lib/icons.ts (ADR 0011):
 * la clave es estable, no el nombre del componente.
 */
export const LEGAJO_HERRAMIENTAS: Record<string, ComponentType<LegajoHerramientaProps>> = {
  LEGAJO_DAT_1: DatosLegajoTool,
  LEGAJO_CLI_1: ClientesAbmTool,
  GESTION_ENTIDAD_1: GestionEntidadTool,
  HISTORIAL_1: HistorialTool,
  TRAMITES_1: TramitesAbmTool,
  LEGAJO_ADJ_1: ArchivosAdjuntosTool,
};
