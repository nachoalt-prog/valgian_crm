"use client";

import { useEffect, useRef, useState } from "react";
import { Wand2, CheckCircle2, XCircle, Loader2, ChevronLeft, ChevronRight, Upload, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ImportadorParaWizard, EjecucionImportadorEstado, ResultadosValidacion } from "@valgian/core";
import {
  listImportadoresParaWizardAction,
  cargarArchivoWizardAction,
  getEjecucionImportadorAction,
  getResultadosValidacionAction,
  confirmarImportacionWizardAction,
  cancelarImportacionWizardAction,
} from "@/app/dashboard/importar/actions";

type Paso = "elegir" | "archivo" | "validacion" | "resultado";

const PASOS: { id: Paso; label: string }[] = [
  { id: "elegir", label: "Importador" },
  { id: "archivo", label: "Archivo" },
  { id: "validacion", label: "Validación" },
  { id: "resultado", label: "Resultado" },
];

function badgeEstadoValidacion(valor: unknown) {
  const v = String(valor ?? "").toLowerCase();
  if (v === "ok") {
    return (
      <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
        OK
      </Badge>
    );
  }
  if (v === "advertencia") {
    return (
      <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-500">
        Advertencia
      </Badge>
    );
  }
  if (v === "error") return <Badge variant="destructive">Error</Badge>;
  return <Badge variant="secondary">{v || "—"}</Badge>;
}

/**
 * Wizard genérico — funciona con cualquier IMPORTADORES activo, elegido por
 * combo. El paso de validación no conoce de antemano el schema de la tabla de
 * staging (mapeo fijo por importador): arma la tabla dinámicamente vía
 * getResultadosValidacionAction (introspección de information_schema, ver
 * domain/importadores.md). Todo el flujo es sincrónico — cargarArchivoWizard/
 * confirmarImportacionWizard llaman al PROCEDURE directo y esperan a que
 * termine, no hay cola ni polling de por medio (a diferencia del modo automático).
 */
export function ImportarWizard() {
  const [paso, setPaso] = useState<Paso>("elegir");
  const [importadoresList, setImportadoresList] = useState<ImportadorParaWizard[] | null>(null);
  const [importadorElegido, setImportadorElegido] = useState<ImportadorParaWizard | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [idEjecucion, setIdEjecucion] = useState<string | null>(null);
  const [ejecucion, setEjecucion] = useState<EjecucionImportadorEstado | null>(null);
  const [resultados, setResultados] = useState<ResultadosValidacion | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listImportadoresParaWizardAction().then((res) => setImportadoresList(res.data ?? []));
  }, []);

  function elegirImportador(imp: ImportadorParaWizard) {
    setImportadorElegido(imp);
    setArchivo(null);
    setError(null);
    setPaso("archivo");
  }

  async function cargarYValidar() {
    if (!importadorElegido || !archivo) return;
    setPending(true);
    setError(null);

    const formData = new FormData();
    formData.append("archivo", archivo);
    const result = await cargarArchivoWizardAction(importadorElegido.id, formData);
    if (result.error || !result.data) {
      setPending(false);
      setError(result.error ?? "Error cargando el archivo.");
      return;
    }

    const id = result.data.idEjecucion;
    setIdEjecucion(id);
    const ej = await getEjecucionImportadorAction(id);
    if (ej.data) setEjecucion(ej.data);

    if (ej.data?.estado === "error") {
      setPending(false);
      setPaso("resultado");
      return;
    }

    const res = await getResultadosValidacionAction(id, 0);
    if (res.data) setResultados(res.data);
    setPending(false);
    setPaso("validacion");
  }

  async function irAPagina(pagina: number) {
    if (!idEjecucion) return;
    const res = await getResultadosValidacionAction(idEjecucion, pagina);
    if (res.data) setResultados(res.data);
  }

  async function confirmar() {
    if (!idEjecucion) return;
    setPending(true);
    setError(null);
    const result = await confirmarImportacionWizardAction(idEjecucion);
    if (result?.error) {
      setPending(false);
      setError(result.error);
      return;
    }
    const ej = await getEjecucionImportadorAction(idEjecucion);
    if (ej.data) setEjecucion(ej.data);
    setPending(false);
    setPaso("resultado");
  }

  async function cancelarYVolver() {
    if (idEjecucion) await cancelarImportacionWizardAction(idEjecucion);
    reiniciar();
  }

  function reiniciar() {
    setPaso("elegir");
    setImportadorElegido(null);
    setArchivo(null);
    setIdEjecucion(null);
    setEjecucion(null);
    setResultados(null);
    setError(null);
  }

  const pasoActualIndex = PASOS.findIndex((p) => p.id === paso);
  const resumen = ejecucion?.resumenValidacion as { total?: number; ok?: number; advertencia?: number; error?: number } | null;
  const resumenImpacto = ejecucion?.resumenImpacto as Record<string, unknown> | null;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border">
      <div className="flex items-center gap-2 border-b border-border px-5 py-4">
        <Wand2 className="size-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">Asistente de Importación</h2>
      </div>

      <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-5 py-3 text-xs">
        {PASOS.map((p, i) => (
          <div key={p.id} className="flex items-center gap-2">
            <span
              className={
                i === pasoActualIndex
                  ? "rounded-full bg-primary px-2 py-0.5 font-medium text-primary-foreground"
                  : i < pasoActualIndex
                    ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-500"
                    : "rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
              }
            >
              {i + 1}. {p.label}
            </span>
            {i < PASOS.length - 1 && <ChevronRight className="size-3 text-muted-foreground" />}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {paso === "elegir" && (
          <div className="mx-auto max-w-2xl space-y-4">
            <p className="text-sm text-muted-foreground">Elegí qué importador vas a usar.</p>
            {importadoresList === null ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : importadoresList.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay importadores activos configurados.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {importadoresList.map((imp) => (
                  <Card key={imp.id} className="relative transition-colors hover:border-primary">
                    <button type="button" onClick={() => elegirImportador(imp)} className="block w-full text-left">
                      <CardContent className="space-y-1 pr-8">
                        <p className="font-medium text-foreground">{imp.nombre}</p>
                        <p className="font-mono text-xs text-muted-foreground">{imp.codigo}</p>
                        <p className="text-xs text-muted-foreground">Archivos: {imp.extensionesPermitidas}</p>
                      </CardContent>
                    </button>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <a
                            href={`/api/importadores/${imp.id}/modelo`}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute top-3 right-3 flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-primary"
                            aria-label="Descargar archivo modelo"
                          >
                            <HelpCircle className="size-3.5" />
                          </a>
                        }
                      />
                      <TooltipContent side="top" className="text-xs">
                        Descargar archivo modelo
                      </TooltipContent>
                    </Tooltip>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {paso === "archivo" && importadorElegido && (
          <div className="mx-auto max-w-md space-y-4">
            <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" onClick={() => setPaso("elegir")}>
              <ChevronLeft className="size-3.5" />
              Volver
            </Button>
            <p className="text-sm text-muted-foreground">
              Importador: <span className="font-medium text-foreground">{importadorElegido.nombre}</span>
            </p>
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-8">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept={importadorElegido.extensionesPermitidas
                    .split(",")
                    .map((e) => `.${e.trim()}`)
                    .join(",")}
                  onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                />
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="size-3.5" />
                  {archivo ? "Cambiar archivo" : "Elegir archivo"}
                </Button>
                {archivo && <p className="text-xs text-muted-foreground">{archivo.name}</p>}
              </CardContent>
            </Card>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" disabled={!archivo || pending} onClick={cargarYValidar}>
              {pending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Cargando…
                </>
              ) : (
                "Cargar y validar"
              )}
            </Button>
          </div>
        )}

        {paso === "validacion" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary">Total: {resumen?.total ?? 0}</Badge>
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
                OK: {resumen?.ok ?? 0}
              </Badge>
              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-500">
                Advertencia: {resumen?.advertencia ?? 0}
              </Badge>
              <Badge variant="destructive">Error: {resumen?.error ?? 0}</Badge>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {resultados?.columnas.map((c) => (
                      <TableHead key={c}>{c}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultados?.filas.map((fila, idx) => (
                    <TableRow key={idx}>
                      {resultados.columnas.map((c) => (
                        <TableCell key={c} className={c === "MENSAJE_VALIDACION" ? "text-xs text-muted-foreground" : "text-sm"}>
                          {c === "ESTADO_VALIDACION" ? badgeEstadoValidacion(fila[c]) : String(fila[c] ?? "—")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {resultados && (resultados.pagina > 0 || resultados.hayMas) && (
              <div className="flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" disabled={resultados.pagina === 0} onClick={() => irAPagina(resultados.pagina - 1)}>
                  Anterior
                </Button>
                <span className="text-xs text-muted-foreground">Página {resultados.pagina + 1}</span>
                <Button variant="outline" size="sm" disabled={!resultados.hayMas} onClick={() => irAPagina(resultados.pagina + 1)}>
                  Siguiente
                </Button>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={cancelarYVolver} disabled={pending}>
                Cancelar
              </Button>
              <Button onClick={confirmar} disabled={pending}>
                {pending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> Importando…
                  </>
                ) : (
                  `Importar ${resumen?.total ?? 0} registro${resumen?.total === 1 ? "" : "s"}`
                )}
              </Button>
            </div>
          </div>
        )}

        {paso === "resultado" && ejecucion && (
          <div className="mx-auto max-w-md space-y-4 text-center">
            {ejecucion.estado === "completado" ? (
              <>
                <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
                <p className="font-medium text-foreground">Importación completada</p>
                {resumenImpacto && (
                  <ul className="mx-auto w-fit space-y-1 text-left text-sm text-muted-foreground">
                    {Object.entries(resumenImpacto).map(([k, v]) => (
                      <li key={k}>
                        <span className="font-mono text-foreground">{k}</span>: {String(v)}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <>
                <XCircle className="mx-auto size-10 text-destructive" />
                <p className="font-medium text-foreground">La importación terminó en error</p>
                {ejecucion.error && <p className="text-sm text-destructive">{ejecucion.error}</p>}
              </>
            )}
            <Button onClick={reiniciar}>Nueva importación</Button>
          </div>
        )}
      </div>
    </div>
  );
}
