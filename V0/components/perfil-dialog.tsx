'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Perfil, PerfilFormData } from '@/lib/types'

interface PerfilDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  perfil?: Perfil | null
  onSave: (data: PerfilFormData, id?: string) => void
}

export function PerfilDialog({ open, onOpenChange, perfil, onSave }: PerfilDialogProps) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<PerfilFormData>()

  useEffect(() => {
    if (open) {
      reset(
        perfil
          ? { codigo: perfil.codigo, nombre: perfil.nombre, idInterfaz: perfil.idInterfaz ?? undefined }
          : { codigo: '', nombre: '', idInterfaz: undefined }
      )
    }
  }, [open, perfil, reset])

  const onSubmit = (data: PerfilFormData) => {
    onSave(data, perfil?.id)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle className="text-primary">
            {perfil ? 'Editar Perfil' : 'Nuevo Perfil'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="codigo" className="text-foreground/80 text-xs uppercase tracking-wider">
              Código <span className="text-destructive">*</span>
            </Label>
            <Input
              id="codigo"
              placeholder="ADM"
              {...register('codigo', { required: 'El código es requerido' })}
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
            {errors.codigo && (
              <p className="text-destructive text-xs">{errors.codigo.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nombre" className="text-foreground/80 text-xs uppercase tracking-wider">
              Nombre <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nombre"
              placeholder="Administrador"
              {...register('nombre', { required: 'El nombre es requerido' })}
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
            {errors.nombre && (
              <p className="text-destructive text-xs">{errors.nombre.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="idInterfaz" className="text-foreground/80 text-xs uppercase tracking-wider">
              ID Interfaz
            </Label>
            <Input
              id="idInterfaz"
              placeholder="uuid opcional"
              {...register('idInterfaz')}
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground font-mono text-sm"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </Button>
            <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">
              {perfil ? 'Guardar cambios' : 'Crear perfil'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
