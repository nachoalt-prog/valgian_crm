"use client";

import { useEffect, useState } from "react";
import { Mail, PlusCircle, Trash2, Star } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { listEmailsPorClienteAction, createEmailAction, updateEmailAction, deleteEmailAction } from "@/app/dashboard/clientes/actions";
import type { EmailFila } from "@valgian/core";

interface EmailsClienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idCliente: string;
  nombreCliente: string;
  canGestionar: boolean;
}

export function EmailsClienteDialog({ open, onOpenChange, idCliente, nombreCliente, canGestionar }: EmailsClienteDialogProps) {
  const [emails, setEmails] = useState<EmailFila[] | null>(null);
  const [nuevoEmail, setNuevoEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<EmailFila | null>(null);

  async function recargar() {
    setEmails(await listEmailsPorClienteAction(idCliente));
  }

  useEffect(() => {
    if (!open) return;
    setEmails(null);
    setNuevoEmail("");
    setError(null);
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, idCliente]);

  async function handleAgregar(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevoEmail.trim()) return;
    setPending(true);
    setError(null);
    const esElPrimero = (emails?.length ?? 0) === 0;
    const result = await createEmailAction({ idCliente, email: nuevoEmail.trim(), principal: esElPrimero });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setNuevoEmail("");
    await recargar();
  }

  async function handleHacerPrincipal(fila: EmailFila) {
    const result = await updateEmailAction(fila.id, { idCliente, email: fila.email, principal: true });
    if (result.error) {
      setError(result.error);
      return;
    }
    await recargar();
  }

  async function handleBorrar() {
    if (!deleteConfirm) return;
    const result = await deleteEmailAction(deleteConfirm.id);
    if (result?.error) {
      setError(result.error);
      setDeleteConfirm(null);
      return;
    }
    setDeleteConfirm(null);
    await recargar();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="size-4 text-primary" />
              Emails de {nombreCliente}
            </DialogTitle>
          </DialogHeader>

          {emails === null ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-28">Principal</TableHead>
                    {canGestionar && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emails.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-xs text-muted-foreground">
                        Sin emails cargados.
                      </TableCell>
                    </TableRow>
                  )}
                  {emails.map((fila) => (
                    <TableRow key={fila.id}>
                      <TableCell className="text-xs">{fila.email}</TableCell>
                      <TableCell>
                        {fila.principal ? (
                          <Badge variant="outline" className="gap-1 text-[10px]">
                            <Star className="size-3 fill-current" />
                            Principal
                          </Badge>
                        ) : canGestionar ? (
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => handleHacerPrincipal(fila)}>
                            Marcar principal
                          </Button>
                        ) : null}
                      </TableCell>
                      {canGestionar && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteConfirm(fila)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {canGestionar && (
                <form onSubmit={handleAgregar} className="flex items-end gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Input type="email" placeholder="nuevo@email.com" value={nuevoEmail} onChange={(e) => setNuevoEmail(e.target.value)} required />
                  </div>
                  <Button type="submit" size="icon" disabled={pending}>
                    <PlusCircle className="size-4" />
                  </Button>
                </form>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(o) => !o && setDeleteConfirm(null)}
        title="Eliminar Email"
        description={`¿Eliminás "${deleteConfirm?.email}"?`}
        onConfirm={handleBorrar}
      />
    </>
  );
}
