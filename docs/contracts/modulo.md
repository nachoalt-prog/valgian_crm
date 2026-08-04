# Contrato de módulo

Referenciado desde `docs/architecture/vision.md`. Define qué debe cumplir cualquier paquete en `packages/modules/<nombre>` para poder "enchufarse" al core sin modificarlo. Ver `docs/decisions/0012-apps-por-cliente-y-modulos-opcionales.md` para el contexto de por qué existe esta separación.

## Regla de dependencia (invariante, no negociable)

Un módulo puede importar `@valgian/core`. **`@valgian/core` no puede importar, ni directa ni transitivamente, nada de ningún módulo.**

¿Por qué es no negociable? Porque el core se manda a TODOS los clientes en cada actualización (ver runbook). Si el core llegara a depender de algo de un módulo, actualizar el core obligaría a actualizar (o al menos a compilar) ese módulo en clientes que ni lo tienen. El día que se viole esta regla, deja de ser cierto que "todos los clientes tienen el mismo core" — se rompe la premisa de todo este documento.

## Qué debe exportar un módulo

Un paquete de módulo (`packages/modules/<nombre>/package.json`, nombre `@valgian/module-<nombre>`) debe exponer, desde su `src/index.ts`:

1. **Manifiesto**: un objeto con `id`, `nombre` y `version` del módulo. Es lo mínimo para poder listar en cualquier lado "qué módulo es este".
2. **Rutas/componentes**: los componentes de página que la app anfitriona (`apps/<client-slug>`) monta en su propio árbol de rutas (App Router de Next.js). El módulo no define rutas por sí mismo — solo expone componentes; quien decide en qué URL viven es la app del cliente.
3. **Entradas de menú propias**: filas para `MENUES` / `MENUES_OPCIONES` que el módulo aporta al seedear o migrar. Nunca se hardcodea una entrada de menú de un módulo dentro de `packages/core`.
4. **Permisos propios**: filas de `PERMISOS` con un prefijo/scope propio del módulo (ej. `ventas.crear_pedido`), para que el sistema de roles del core (que sí es compartido) pueda asignarlos sin conocer al módulo de antemano.
5. **Migraciones propias**: si el módulo necesita tablas/SPs/FNs exclusivas, viven en `packages/modules/<nombre>/migrations/` (Drizzle propio, con su propio `schema.ts` si hace falta) — nunca anidadas dentro de `packages/db/migrations/`, para que el límite de "quién recibe esto" sea físicamente obvio con solo mirar de qué carpeta viene. Se aplican contra la MISMA base Postgres del cliente — no existe una base de datos separada por módulo. El aislamiento real (entre clientes, no entre módulos) ya lo resuelve la instancia separada de ADR 0001. Las tablas de un módulo pueden tener FK hacia tablas del core (ej. `CLIENTES`, `LEGAJOS`), nunca al revés. Ver ADR 0020 para el detalle completo (incluye el mecanismo de "parches" para corregir datos ya sembrados, distinto de las migraciones).

   **No confundir estructura con configuración**: los registros que el módulo necesita para funcionar (ej. una fila de `ACCIONES_EXTERNAS` que activa su handler, filas de catálogo que usa) casi siempre NO requieren una tabla propia — son configuración estándar sobre tablas genéricas del core, y van en el `seed.ts` del módulo (punto 6, más abajo), no en una migración. Una migración propia solo hace falta cuando el módulo necesita una tabla/columna que el core no tiene y que no tiene sentido generalizar.
6. **Seed de configuración propio**: `src/seed.ts` (patrón `ensureX`, insert-only — ver ADR 0020), corrido vía `pnpm --filter @valgian/module-<nombre> seed`, independiente del seed del core. Es donde van los registros del punto anterior — nunca se agregan a mano en el seed del core ni en el de otro módulo.

## Registro: explícito, no autodescubrimiento

Un módulo no se "detecta" solo. Cada app de cliente tiene un único archivo de bootstrap (ej. `apps/<client-slug>/src/modules.ts`) donde se importa y registra cada módulo que ese cliente tiene, una línea por módulo:

```ts
import { registrarModulo } from "@valgian/core";
import ventas from "@valgian/module-ventas";

registrarModulo(ventas);
```

"Tener" un módulo = (a) tenerlo como dependencia en el `package.json` de esa app, con versión pineada, y (b) esa línea de registro. Nada dinámico, nada por variable de entorno — así cualquiera puede abrir dos archivos y saber con certeza qué tiene un cliente y qué no, sin tener que ejecutar nada.

## Qué NO es un módulo

Código exclusivo de un solo cliente (algo que nadie más va a usar) no se empaqueta como módulo — vive directo en `apps/<client-slug>/src/...`. Un módulo existe solo cuando hay, o se espera que haya, más de un cliente usándolo. Si ese código exclusivo necesita tablas propias, mismo criterio que un módulo pero un nivel más abajo: `apps/<client-slug>/migrations/`, aplicado únicamente contra la base de ese cliente (ver ADR 0020).
