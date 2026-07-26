# 0007 - Tailwind CSS + shadcn/ui

## Estado

Aceptada

## Contexto

Se necesita un sistema de diseño consistente desde el arranque, sin construir componentes base desde cero, y con posibilidad de personalizar la apariencia por cliente en el futuro.

## Decisión

Tailwind CSS como sistema de utilidades, shadcn/ui como base de componentes.

## Alternativas consideradas

No se evaluaron alternativas en profundidad — la combinación es estándar en el ecosistema Next.js actual y cumple los requisitos sin fricción conocida.

## Consecuencias

- shadcn/ui entrega el código de los componentes directamente al proyecto (no es una dependencia externa cerrada), lo que facilita personalizar la apariencia por cliente si hace falta.
