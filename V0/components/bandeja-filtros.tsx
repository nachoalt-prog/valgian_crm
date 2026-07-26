'use client'

import { useRef } from 'react'
import { Search, RotateCcw } from 'lucide-react'
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
import { FilterDef } from '@/lib/bandeja-types'
import { cn } from '@/lib/utils'

interface BandejaFiltrosProps {
  filters: FilterDef[]
  values: Record<string, string>
  onChange: (key: string, value: string) => void
  onSearch: () => void
  onReset: () => void
  loading?: boolean
}

export function BandejaFiltros({
  filters,
  values,
  onChange,
  onSearch,
  onReset,
  loading,
}: BandejaFiltrosProps) {
  const formRef = useRef<HTMLFormElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) onSearch()
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => { e.preventDefault(); onSearch() }}
      className="bg-card border-b border-border px-5 py-4 space-y-4"
    >
      {/* Grid de filtros */}
      <div className="grid grid-cols-6 gap-x-4 gap-y-3">
        {filters.map((f) => {
          const colSpan = f.span === 2 ? 'col-span-2' : 'col-span-1'

          // ── daterange: two date inputs side by side ──────────────────────
          if (f.type === 'daterange') {
            return (
              <div key={f.key} className={cn('flex flex-col gap-1', colSpan)}>
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={values[`${f.key}Desde`] ?? ''}
                    onChange={(e) => onChange(`${f.key}Desde`, e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="bg-muted border-border text-foreground text-xs h-8 w-full [color-scheme:dark]"
                    aria-label={`${f.label} desde`}
                  />
                  <span className="text-muted-foreground text-xs shrink-0">a</span>
                  <Input
                    type="date"
                    value={values[`${f.key}Hasta`] ?? ''}
                    onChange={(e) => onChange(`${f.key}Hasta`, e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="bg-muted border-border text-foreground text-xs h-8 w-full [color-scheme:dark]"
                    aria-label={`${f.label} hasta`}
                  />
                </div>
              </div>
            )
          }

          // ── select ────────────────────────────────────────────────────────
          if (f.type === 'select') {
            return (
              <div key={f.key} className={cn('flex flex-col gap-1', colSpan)}>
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                <Select
                  value={values[f.key] ?? ''}
                  onValueChange={(v) => onChange(f.key, v ?? '')}
                >
                  <SelectTrigger className="bg-muted border-border text-foreground h-8 text-xs">
                    <SelectValue placeholder={f.options?.[0]?.label ?? 'Seleccionar…'} />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground text-xs">
                    {f.options?.map((o) => (
                      <SelectItem key={o.value} value={o.value === '' ? '__all__' : o.value} className="text-xs focus:bg-muted">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          }

          // ── text / date (default) ─────────────────────────────────────────
          return (
            <div key={f.key} className={cn('flex flex-col gap-1', colSpan)}>
              <Label className="text-xs text-muted-foreground">{f.label}</Label>
              <Input
                type={f.type === 'date' ? 'date' : 'text'}
                value={values[f.key] ?? ''}
                placeholder={f.placeholder}
                onChange={(e) => onChange(f.key, e.target.value)}
                onKeyDown={handleKeyDown}
                className={cn(
                  'bg-muted border-border text-foreground placeholder:text-muted-foreground h-8 text-xs',
                  f.type === 'date' && '[color-scheme:dark]'
                )}
              />
            </div>
          )
        })}
      </div>

      {/* Acciones */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="text-muted-foreground hover:text-foreground h-8 text-xs gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Limpiar
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={loading}
          className="bg-primary text-primary-foreground hover:bg-primary/85 h-8 text-xs gap-1.5 px-5"
        >
          <Search className="w-3.5 h-3.5" />
          {loading ? 'Buscando…' : 'Buscar'}
        </Button>
      </div>
    </form>
  )
}
