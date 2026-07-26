# 0012 - Apps por cliente, versionado pineado y módulos opcionales

## Estado

Aceptada

## Contexto

ADR 0001 define que cada cliente tiene su propia instancia a nivel de infraestructura (deploy separado, DB separada). Falta el equivalente a nivel de código: cómo se refleja "un cliente" dentro del monorepo, cómo convive el core (obligatorio para todos) con módulos opcionales (algunos clientes sí, otros no) y con código exclusivo de un solo cliente, y cómo se controla qué versión de cada cosa corre cada cliente al momento de actualizar.

Hoy solo existe `apps/web` (genérica, sirve de demo) y `packages/core` / `packages/db`, todo enlazado con `workspace:*`. No hay separación de módulos ni de clientes todavía — el proyecto está en la etapa de demo (ver `docs/architecture/vision.md`).

## Decisión

- Cada cliente real tiene su propia carpeta `apps/<client-slug>`, generada a partir de `apps/web` como plantilla. `apps/web` se mantiene como la instancia de demo/ventas — no se convierte en la app de un cliente.
- Código exclusivo de un cliente (algo que nadie más tiene) vive directo en `apps/<client-slug>/src/...`. No se crea un paquete aparte para esto: al no compartirse con nadie, envolverlo en un paquete solo agrega indirección sin beneficio.
- Funcionalidad opcional que puede usar más de un cliente (pero no todos) vive en `packages/modules/<nombre>`, siguiendo el contrato en `docs/contracts/modulo.md`.
- `packages/core` y `packages/db` son lo único que absolutamente todos los clientes tienen siempre, al 100%. El core nunca puede depender de un módulo ni de código de un cliente (ver contrato de módulo, regla de dependencia).
- Cada `apps/<client-slug>/package.json` fija una versión exacta (ej. `"1.4.2"`) de `@valgian/core` y de cada `@valgian/module-*` que use — no `workspace:*` — apenas exista más de una app. `apps/web` (demo) puede seguir en `workspace:*` porque siempre corre contra el último código.

## Alternativas consideradas

- **`workspace:*` en todas las apps (resolución automática a la última versión)**: descartado porque una vez que hay más de un cliente, actualizar el core en el repo actualizaría a todos simultáneamente en el próximo build, sin forma de controlar el rollout por cliente.
- **Git tags + deploy manual por tag, sin tocar `package.json`**: descartado — la versión que corre cada cliente quedaría implícita en el historial de deploys en lugar de explícita en el código, lo cual es más fácil de perder de vista o de equivocar en un manual pensado para alguien sin contexto.
- **Un paquete `client-overrides/<cliente>` separado para código exclusivo**: descartado por ahora — agrega una capa sin necesidad real, ya que `apps/<client-slug>` ya es exclusivo de ese cliente.

## Consecuencias

- Actualizar deja de ser automático: cada actualización (de core o de módulo) es un cambio explícito de versión en el `package.json` de cada app afectada. Ver `docs/runbooks/actualizaciones.md` para el procedimiento paso a paso.
- Se puede saber qué versión de core/módulo corre cada cliente simplemente abriendo su `package.json` — no hace falta revisar logs de deploy.
- Onboardear un cliente nuevo implica un paso manual (crear su carpeta `apps/<client-slug>` desde la plantilla) — no está automatizado todavía; se puede reconsiderar si el número de clientes crece.
