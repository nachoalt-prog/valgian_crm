/**
 * Traductor cron↔amigable — ver domain/procesos.md. El usuario nunca edita
 * PROCESOS.CRON directamente: arma la frecuencia con un puñado de presets
 * (los únicos patrones que esta instalación necesita hoy) y acá se traducen
 * a/desde la expresión cron de 5 campos que entiende fn_cron_matches
 * (packages/db/sql/0011_fn_cron_matches.sql) — que NO soporta nombres de
 * mes/día, por eso los presets nunca los generan.
 *
 * Vive en apps/web, NO en packages/core, a propósito: es la única función de
 * ese dominio que un componente "use client" necesita en tiempo de ejecución
 * (no solo tipos) — importar un valor real desde el barrel de @valgian/core
 * arrastra al bundle del navegador todo lo que ese barrel re-exporta
 * (incluido playwright/argon2 nativo, ver instrumentation-node.ts), aunque
 * este módulo en sí no dependa de nada de eso.
 */

export type CronFriendly =
  | { tipo: "minutos"; cada: number }
  | { tipo: "horas"; cada: number }
  | { tipo: "diario"; hora: number; minuto: number }
  | { tipo: "semanal"; diaSemana: number; hora: number; minuto: number }
  | { tipo: "mensual"; diaMes: number; hora: number; minuto: number };

const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function hhmm(hora: number, minuto: number): string {
  return `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;
}

export function cronDesdeFriendly(f: CronFriendly): string {
  switch (f.tipo) {
    case "minutos":
      return `*/${f.cada} * * * *`;
    case "horas":
      return `0 */${f.cada} * * *`;
    case "diario":
      return `${f.minuto} ${f.hora} * * *`;
    case "semanal":
      return `${f.minuto} ${f.hora} * * ${f.diaSemana}`;
    case "mensual":
      return `${f.minuto} ${f.hora} ${f.diaMes} * *`;
  }
}

/** Parsea un cron guardado a la forma estructurada — null si no matchea ninguno de los 5 presets. */
export function friendlyDesdeCron(cron: string): CronFriendly | null {
  const campos = cron.trim().split(/\s+/);
  if (campos.length !== 5) return null;
  const [minuto, hora, diaMes, mes, diaSemana] = campos;

  if (mes !== "*") return null;

  const matchPaso = (campo: string): number | null => {
    const m = /^\*\/(\d+)$/.exec(campo);
    return m ? Number(m[1]) : null;
  };

  // Cada N minutos: */N * * * *
  if (diaMes === "*" && diaSemana === "*" && hora === "*") {
    const n = matchPaso(minuto);
    if (n) return { tipo: "minutos", cada: n };
  }

  // Cada N horas: 0 */N * * * — hora="*" literal (sin paso) equivale a "cada 1 hora" (ej. "0 * * * *").
  if (minuto === "0" && diaMes === "*" && diaSemana === "*") {
    if (hora === "*") return { tipo: "horas", cada: 1 };
    const n = matchPaso(hora);
    if (n) return { tipo: "horas", cada: n };
  }

  const esNumero = (campo: string) => /^\d+$/.test(campo);
  if (!esNumero(minuto) || !esNumero(hora)) return null;
  const min = Number(minuto);
  const hs = Number(hora);

  // Diario: MM HH * * *
  if (diaMes === "*" && diaSemana === "*") {
    return { tipo: "diario", hora: hs, minuto: min };
  }

  // Semanal: MM HH * * D
  if (diaMes === "*" && esNumero(diaSemana)) {
    return { tipo: "semanal", diaSemana: Number(diaSemana) % 7, hora: hs, minuto: min };
  }

  // Mensual: MM HH D * *
  if (diaSemana === "*" && esNumero(diaMes)) {
    return { tipo: "mensual", diaMes: Number(diaMes), hora: hs, minuto: min };
  }

  return null;
}

/** Traduce un cron a una oración en español — para el listado (siempre devuelve algo, con fallback al cron crudo si no reconoce el patrón). */
export function cronATexto(cron: string): string {
  const f = friendlyDesdeCron(cron);
  if (!f) return cron;

  switch (f.tipo) {
    case "minutos":
      return f.cada === 1 ? "Cada minuto" : `Cada ${f.cada} minutos`;
    case "horas":
      return f.cada === 1 ? "Cada hora" : `Cada ${f.cada} horas`;
    case "diario":
      return `Todos los días a las ${hhmm(f.hora, f.minuto)}`;
    case "semanal":
      return `Los ${DIAS_SEMANA[f.diaSemana].toLowerCase()} a las ${hhmm(f.hora, f.minuto)}`;
    case "mensual":
      return `El día ${f.diaMes} de cada mes a las ${hhmm(f.hora, f.minuto)}`;
  }
}
