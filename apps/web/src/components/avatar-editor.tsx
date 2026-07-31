"use client";

import { useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { actualizarAvatarAction } from "@/app/dashboard/avatar/actions";

interface AvatarEditorProps {
  username: string;
  idArchivoAdjuntoInicial: string | null;
}

function iniciales(username: string) {
  return username.slice(0, 2).toUpperCase();
}

export function AvatarEditor({ username, idArchivoAdjuntoInicial }: AvatarEditorProps) {
  const [idArchivoAdjunto, setIdArchivoAdjunto] = useState(idArchivoAdjuntoInicial);
  const [revision, setRevision] = useState(0);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // El `?v=` fuerza al navegador a refetchear tras un reemplazo — el ID (y
  // por lo tanto la URL) no cambia nunca, ver domain/archivos-adjuntos.md.
  const src = idArchivoAdjunto ? `/api/archivos-adjuntos/${idArchivoAdjunto}?inline=1&v=${revision}` : undefined;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPending(true);
    setError(null);

    const formData = new FormData();
    formData.set("file", file);
    const result = await actualizarAvatarAction(formData);
    setPending(false);
    e.target.value = "";

    if (result.error || !result.data) {
      setError(result.error ?? "Error subiendo la imagen.");
      return;
    }
    setIdArchivoAdjunto(result.data.id);
    setRevision((r) => r + 1);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="group/editor relative shrink-0 cursor-pointer">
        <Avatar className="size-8">
          {src && <AvatarImage src={src} alt={username} />}
          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">{iniciales(username)}</AvatarFallback>
        </Avatar>
        <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-muted opacity-0 ring-2 ring-background transition-opacity group-hover/editor:opacity-100">
          <Pencil className="size-2.5 text-foreground" />
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Foto de perfil</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-2">
            <Avatar className="size-32">
              {src && <AvatarImage src={src} alt={username} />}
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-semibold">{iniciales(username)}</AvatarFallback>
            </Avatar>

            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            <Button type="button" onClick={() => inputRef.current?.click()} disabled={pending}>
              {pending ? "Subiendo…" : idArchivoAdjunto ? "Reemplazar imagen" : "Cargar nueva imagen"}
            </Button>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
