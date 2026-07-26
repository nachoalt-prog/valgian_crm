'use client'

import { FolderOpen, Inbox, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ColumnDef } from '@/lib/bandeja-types'
import { Legajo } from '@/lib/bandeja-types'
import { cn } from '@/lib/utils'

// Estado del badge por valor de estado
const ESTADO_STYLE: Record<string, string> = {
  Activo:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Inactivo:  'bg-muted text-muted-foreground border-border',
  Observado: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Cerrado:   'bg-red-500/15 text-red-400 border-red-500/30',
}

interface BandejaResultadosProps<T extends { id: string }> {
  columns: ColumnDef<T>[]
  rows: T[]
  loading: boolean
  searched: boolean
  onOpen: (row: T) => void
  estadoKey?: keyof T  // columna a renderizar como badge de estado
}

export function BandejaResultados<T extends { id: string } & Legajo>({
  columns,
  rows,
  loading,
  searched,
  onOpen,
  estadoKey = 'estado',
}: BandejaResultadosProps<T>) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header de tabla */}
      <div className="shrink-0 flex items-center border-b border-border bg-muted/40 px-4 pr-3">
        {columns.map((col) => (
          <div
            key={String(col.key)}
            className={cn(
              'py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground',
              col.width ?? 'flex-1',
              col.width && col.width !== 'flex-1' ? '' : 'flex-1'
            )}
          >
            {col.label}
          </div>
        ))}
        {/* Espacio para columna de acciones */}
        <div className="w-20 shrink-0" aria-hidden />
      </div>

      {/* Cuerpo */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm">Buscando…</span>
        </div>
      ) : !searched ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground select-none">
          <Inbox className="w-12 h-12 text-muted-foreground/30" />
          <p className="text-sm">Aplicá los filtros y presioná <span className="text-primary font-medium">Buscar</span> para ver resultados.</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground select-none">
          <Inbox className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-sm">No se encontraron legajos con los filtros aplicados.</p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="divide-y divide-border">
            {rows.map((row, idx) => (
              <div
                key={row.id}
                className={cn(
                  'flex items-center px-4 pr-3 py-0 hover:bg-muted/30 transition-colors group',
                  idx % 2 === 0 ? 'bg-transparent' : 'bg-muted/10'
                )}
              >
                {columns.map((col) => {
                  const raw = row[col.key as keyof T]
                  const value = col.render
                    ? col.render(row)
                    : String(raw ?? '—')

                  const isEstado = col.key === estadoKey
                  const estadoStr = isEstado ? String(raw) : ''

                  return (
                    <div
                      key={String(col.key)}
                      className={cn(
                        'py-3 text-sm truncate',
                        col.width ?? 'flex-1',
                        col.width && col.width !== 'flex-1' ? 'shrink-0' : 'flex-1 min-w-0'
                      )}
                    >
                      {isEstado ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[11px] px-2 py-0 font-medium border',
                            ESTADO_STYLE[estadoStr] ?? 'bg-muted text-muted-foreground border-border'
                          )}
                        >
                          {estadoStr}
                        </Badge>
                      ) : (
                        <span className="truncate block">{value}</span>
                      )}
                    </div>
                  )
                })}
                {/* Acción */}
                <div className="w-20 shrink-0 flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onOpen(row)}
                    className="h-7 px-2.5 text-xs gap-1.5 text-primary hover:text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={`Abrir legajo ${row.id}`}
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    Abrir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Footer con conteo */}
      {searched && !loading && rows.length > 0 && (
        <div className="shrink-0 px-4 py-2 border-t border-border bg-card/50 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {rows.length} resultado{rows.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  )
}
