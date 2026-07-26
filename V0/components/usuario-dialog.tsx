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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Perfil, Usuario, UsuarioFormData } from '@/lib/types'

interface UsuarioDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  usuario?: Usuario | null
  perfiles: Perfil[]
  defaultPerfilId?: string | null
  onSave: (data: UsuarioFormData, id?: string) => void
}

export function UsuarioDialog({
  open,
  onOpenChange,
  usuario,
  perfiles,
  defaultPerfilId,
  onSave,
}: UsuarioDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UsuarioFormData>()

  const perfilValue = watch('idPerfil')

  useEffect(() => {
    if (open) {
      reset(
        usuario
          ? {
              idPerfil: usuario.idPerfil ?? undefined,
              username: usuario.username,
              password: '',
              avatarPath: usuario.avatarPath ?? undefined,
            }
          : {
              idPerfil: defaultPerfilId ?? undefined,
              username: '',
              password: '',
              avatarPath: undefined,
            }
      )
    }
  }, [open, usuario, defaultPerfilId, reset])

  const onSubmit = (data: UsuarioFormData) => {
    onSave(data, usuario?.id)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle className="text-accent">
            {usuario ? 'Editar Usuario' : 'Nuevo Usuario'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="idPerfil" className="text-foreground/80 text-xs uppercase tracking-wider">
              Perfil <span className="text-destructive">*</span>
            </Label>
            <Select
              value={perfilValue ?? ''}
              onValueChange={(v) => setValue('idPerfil', v)}
            >
              <SelectTrigger className="bg-muted border-border text-foreground w-full">
                {perfilValue
                  ? (() => {
                      const p = perfiles.find((x) => x.id === perfilValue)
                      return p ? (
                        <span>
                          <span className="font-mono text-primary mr-1.5">[{p.codigo}]</span>
                          {p.nombre}
                        </span>
                      ) : <SelectValue placeholder="Seleccioná un perfil…" />
                    })()
                  : <SelectValue placeholder="Seleccioná un perfil…" />
                }
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                {perfiles.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="focus:bg-muted">
                    <span className="font-mono text-primary mr-2">[{p.codigo}]</span>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="username" className="text-foreground/80 text-xs uppercase tracking-wider">
              Username <span className="text-destructive">*</span>
            </Label>
            <Input
              id="username"
              placeholder="jdoe"
              autoComplete="off"
              {...register('username', { required: 'El username es requerido' })}
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
            {errors.username && (
              <p className="text-destructive text-xs">{errors.username.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-foreground/80 text-xs uppercase tracking-wider">
              Contraseña {!usuario && <span className="text-destructive">*</span>}
              {usuario && <span className="text-muted-foreground text-xs normal-case ml-1">(dejá vacío para no cambiar)</span>}
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              {...register('password', {
                required: !usuario ? 'La contraseña es requerida' : false,
              })}
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
            {errors.password && (
              <p className="text-destructive text-xs">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="avatarPath" className="text-foreground/80 text-xs uppercase tracking-wider">
              Avatar Path
            </Label>
            <Input
              id="avatarPath"
              placeholder="/avatars/user.png"
              {...register('avatarPath')}
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
            <Button type="submit" className="bg-accent text-accent-foreground hover:bg-accent/90">
              {usuario ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
