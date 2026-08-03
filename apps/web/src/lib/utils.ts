import type { KeyboardEvent } from "react"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Tab dentro de un <textarea> controlado inserta un carácter tab en vez de
 * mover el foco al siguiente elemento (comportamiento default del navegador).
 * Usado en los campos de Observación (gestion-entidad-tool.tsx, tramite-modal.tsx).
 */
export function handleTabEnTextarea(e: KeyboardEvent<HTMLTextAreaElement>, setValor: (valor: string) => void) {
  if (e.key !== "Tab") return
  e.preventDefault()
  const el = e.currentTarget
  const inicio = el.selectionStart
  const fin = el.selectionEnd
  setValor(el.value.slice(0, inicio) + "\t" + el.value.slice(fin))
  requestAnimationFrame(() => {
    el.selectionStart = el.selectionEnd = inicio + 1
  })
}
