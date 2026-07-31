"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileIcon, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getArchivoAdjuntoAction } from "@/app/dashboard/archivos-adjuntos/actions";
import type { ArchivoAdjuntoDetalle } from "@valgian/core";

interface ArchivoAdjuntoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idArchivoExistente: string | null;
  // NULL para archivos globales sin registro dueño (ej. plantillas de documento).
  idEntidad: string | null;
  idRegistro: string | null;
  // Qué HERRAMIENTAS.CODIGO valida el permiso de gestión del lado del servidor.
  herramientaCodigo: string;
  canGestionar: boolean;
  onGuardado: () => void;
  // Restringe a estos CODIGO de TIPOS_ARCHIVOS_ADJUNTOS (ej. ["html"] para plantillas). Sin restricción si se omite.
  tiposPermitidos?: string[];
}

function formatearTamanio(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ArchivoAdjuntoDialog({
  open,
  onOpenChange,
  idArchivoExistente,
  idEntidad,
  idRegistro,
  herramientaCodigo,
  canGestionar,
  onGuardado,
  tiposPermitidos,
}: ArchivoAdjuntoDialogProps) {
  const [archivo, setArchivo] = useState<ArchivoAdjuntoDetalle | null | undefined>(idArchivoExistente ? undefined : null);
  const [staged, setStaged] = useState<File | null>(null);
  // Derivado sync de `staged`, no necesita estado propio — solo la limpieza
  // (revokeObjectURL) es un efecto secundario real.
  const previewStagedUrl = useMemo(() => (staged ? URL.createObjectURL(staged) : null), [staged]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!idArchivoExistente) return;
    let cancelado = false;
    getArchivoAdjuntoAction(idArchivoExistente).then((res) => {
      if (!cancelado) setArchivo(res.data ?? null);
    });
    return () => {
      cancelado = true;
    };
  }, [idArchivoExistente]);

  useEffect(() => {
    if (!previewStagedUrl) return;
    return () => URL.revokeObjectURL(previewStagedUrl);
  }, [previewStagedUrl]);

  function handleSeleccionar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setStaged(file);
      setError(null);
    }
    e.target.value = "";
  }

  async function handleGuardar() {
    if (!staged) return;
    setPending(true);
    setError(null);

    const formData = new FormData();
    formData.set("file", staged);
    formData.set("herramientaCodigo", herramientaCodigo);
    if (tiposPermitidos?.length) formData.set("tiposPermitidos", tiposPermitidos.join(","));
    if (!archivo) {
      formData.set("idEntidad", idEntidad ?? "");
      formData.set("idRegistro", idRegistro ?? "");
    }

    const url = archivo ? `/api/archivos-adjuntos/${archivo.id}` : "/api/archivos-adjuntos";
    const res = await fetch(url, { method: archivo ? "PUT" : "POST", body: formData });
    const body = await res.json();
    setPending(false);

    if (!res.ok) {
      setError(body.error ?? "Error guardando el archivo.");
      return;
    }

    setStaged(null);
    onGuardado();
    onOpenChange(false);
  }

  function handleDescargar() {
    if (!archivo) return;
    window.location.href = `/api/archivos-adjuntos/${archivo.id}`;
  }

  const nombreMostrado = staged?.name ?? archivo?.nombreOriginal ?? null;
  const puedeDescargar = !!archivo?.permiteDownload && !staged;
  const mimetypeStaged = staged?.type ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-w-5xl! flex-col">
        <DialogHeader>
          <DialogTitle>{archivo ? "Archivo adjunto" : "Nuevo archivo adjunto"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-hidden py-2">
          <div className="flex flex-1 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30">
            {previewStagedUrl && mimetypeStaged?.startsWith("image/") ? (
              <img src={previewStagedUrl} alt={nombreMostrado ?? ""} className="max-h-full max-w-full object-contain" />
            ) : previewStagedUrl && mimetypeStaged === "application/pdf" ? (
              <embed src={previewStagedUrl} type="application/pdf" className="h-full w-full" />
            ) : !staged && archivo?.renderizar && archivo.mimetype?.startsWith("image/") ? (
              <img src={`/api/archivos-adjuntos/${archivo.id}?inline=1`} alt={archivo.nombreOriginal ?? ""} className="max-h-full max-w-full object-contain" />
            ) : !staged && archivo?.renderizar && archivo.mimetype === "application/pdf" ? (
              <embed src={`/api/archivos-adjuntos/${archivo.id}?inline=1`} type="application/pdf" className="h-full w-full" />
            ) : archivo === undefined ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <FileIcon className="size-10 opacity-40" />
                <p className="text-xs">{nombreMostrado ?? "Sin previsualización"}</p>
              </div>
            )}
          </div>

          {nombreMostrado && (
            <p className="truncate text-center text-xs text-muted-foreground">
              {nombreMostrado} {archivo && !staged ? `· ${formatearTamanio(archivo.tamanioBytes)}` : ""}
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center justify-center gap-2">
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept={tiposPermitidos?.map((t) => `.${t}`).join(",")}
              onChange={handleSeleccionar}
            />
            {canGestionar && (
              <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={pending}>
                {archivo ? "Reemplazar" : "Cargar"}
              </Button>
            )}
            {puedeDescargar && (
              <Button type="button" variant="outline" onClick={handleDescargar}>
                <Download className="size-3.5" />
                Descargar
              </Button>
            )}
            {canGestionar && (
              <Button type="button" onClick={handleGuardar} disabled={!staged || pending}>
                {pending ? "Guardando…" : "Guardar"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
