// Constantes de CANAL de MENSAJERIA_PLANTILLAS, seguras para Client Components
// — NUNCA importar esto (ni ningún valor, solo tipos) desde @valgian/core acá:
// es un barrel único que re-exporta todo, incluido auth/password.ts
// (@node-rs/argon2, bindings nativos de Node) — cualquier import de VALOR real
// desde @valgian/core en un Client Component arrastra eso al bundle del
// browser y rompe el build. Ver docs/domain/acciones-externas.md, MENSAJERIA_PLANTILLAS.CANAL.
export const CANALES_MENSAJERIA_PLANTILLA = [
  { value: "email", label: "Email", clase: "border-sky-500/30 bg-sky-500/10 text-sky-500" },
  { value: "sms", label: "SMS", clase: "border-violet-500/30 bg-violet-500/10 text-violet-500" },
  { value: "whatsapp", label: "WhatsApp", clase: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" },
] as const;
