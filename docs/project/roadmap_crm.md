# Roadmap — CRM Modular

Última actualización: 25 de julio de 2026
Estado del proyecto: Fase 0 en curso (documentación de arquitectura)

## PARTE A — Resumen ejecutivo (para el equipo)

### ¿Qué estamos construyendo?

Un CRM (sistema de gestión de clientes) diseñado desde el principio para ser modular: en vez de un producto rígido con funciones fijas, es una base sólida (contactos, empresas, usuarios, permisos) sobre la que se enchufan módulos según lo que cada negocio necesite — ventas, tickets de soporte, facturación, etc. Esto nos permite vender una versión adaptada a cada tipo de cliente sin reescribir el producto cada vez.

Cada cliente tiene su propia instancia (no es un sistema donde todos comparten la misma base de datos), lo que da mayor seguridad y flexibilidad para personalizar, a cambio de un poco más de trabajo operativo al desplegar actualizaciones — una decisión consciente dado el tamaño de negocio que buscamos hoy.

### ¿Cómo se está construyendo?

Un desarrollador (arquitecto/diseñador del producto) define toda la lógica, el diseño y las reglas de negocio. La escritura de código está fuertemente asistida por IA (Claude Code), lo que acelera mucho la parte mecánica del desarrollo. Es un proyecto part-time, de fines de semana y horas sueltas entre semana.

### Etapas del proyecto (visión simplificada)

| Etapa | Qué se logra | Estimado |
|---|---|---|
| 0. Planos | Toda la documentación y el diseño del producto, antes de escribir código | 3-5 semanas |
| 1. Cimientos | La base técnica funcionando (sin funciones de negocio todavía) | 1-2 semanas |
| 2. Núcleo | Contactos, empresas y usuarios funcionando | 6-8 semanas |
| 3. Ventas | El pipeline de ventas (la función más visible del CRM) | 6-7 semanas |
| 4. Modularidad | El sistema que permite prender/apagar funciones por cliente | 7-9 semanas |
| 5. Equipos | Múltiples usuarios por cliente, con permisos | 3-4 semanas |
| 6. Terminado | Que se vea y se sienta como un producto real | 6-8 semanas |
| 7. Demo lista | Desplegada, con datos de ejemplo, lista para mostrar | 3-4 semanas |

Estimado total: 9 a 12 meses, a ritmo part-time, hasta tener una demo mostrable a clientes potenciales. Esto no es producción para uso real todavía — es el punto en el que podemos empezar a validar el producto con clientes.

> **Nota (2026-07-25)**: este roadmap describe un dominio genérico (organización/contacto/empresa) que no coincide con el dominio real definido en `domain/core.md` (legajos/clientes/cuentas/productos). Está pendiente de reescritura para reflejar el dominio actual — ver `docs/open-issues.md` / decisión de priorizar una demo usable con el core ya definido antes de continuar fase por fase.

## PARTE B — Roadmap técnico detallado

### Convenciones de este documento

Cada fase tiene: objetivo, entregables documentales (lo que vos producís), entregables técnicos (lo que Claude Code ejecuta a partir de los documentos), criterios de salida (cómo sabés que la fase está terminada) y estimado de tiempo part-time (8-10 hs/semana).

Ninguna fase técnica (1 en adelante) arranca sin que su documentación correspondiente esté cerrada.

Los documentos viven en el repo desde el día uno, en `/docs`, y se actualizan a medida que el proyecto avanza — no son estáticos.

### Fase 0 — Documentación de arquitectura

Estimado: 3-5 semanas (24-40 hs)

**Objetivo**: dejar por escrito todo lo que Claude Code va a necesitar como fuente de verdad antes de tocar código. Nada se instala ni se prueba durante esta fase.

**Entregables documentales:**

- `docs/00-vision-y-stack.md` — visión del producto, decisiones de stack tomadas y el porqué de cada una
- `docs/01-modelo-de-dominio.md` — entidades del core, relaciones, qué es fijo vs. extensible
- `docs/02-contrato-de-modulos.md` — qué debe cumplir cualquier módulo para engancharse al core
- `docs/03-reglas-de-negocio.md` — casos límite y comportamientos no obvios
- `docs/04-estructura-y-convenciones.md` — layout del monorepo, convenciones de nombres y organización de archivos
- `docs/05-criterios-de-revision.md` — cómo se valida el trabajo entregado por Claude Code en cada fase

**Entregables técnicos:** ninguno.

**Criterios de salida:** los 6 documentos existen, están revisados por vos, y no tenés preguntas abiertas grandes sobre "cómo se relaciona esto con aquello" en el modelo de dominio ni en el contrato de módulos.

> **Nota (2026-07-25)**: la documentación real terminó organizada como carpetas (`architecture/`, `domain/`, `decisions/`, `open-issues.md`) según `docs/README.md`, no como los 6 archivos numerados de arriba. El contenido equivalente existe, pero estos criterios de salida están desactualizados en cuanto a nombres de archivo.

### Fase 1 — Fundaciones técnicas

Estimado: 1-2 semanas (8-15 hs, mayormente supervisión)
Depende de: Fase 0 completa

**Objetivo**: la cañería técnica funcionando — sin lógica de negocio.

**Entregables documentales:** ninguno nuevo (se usa lo de Fase 0 como prompt/contexto).

**Entregables técnicos (ejecutados por Claude Code):**

- Monorepo (Turborepo + pnpm) con la estructura definida en `04-estructura-y-convenciones.md`
- Docker Compose con Postgres local
- Drizzle conectado, con una tabla de prueba y primera migración corriendo
- CI básico (lint + build)

**Criterios de salida:** `pnpm dev` levanta la app, la conexión a la base funciona de punta a punta, el CI pasa en verde.

### Fase 2 — Núcleo del dominio

Estimado: 6-8 semanas (50-70 hs)
Depende de: Fase 1

**Objetivo**: las entidades centrales del CRM funcionando con CRUD completo.

**Entregables documentales (refinamiento de lo ya escrito, no desde cero):**

- Ampliación de `01-modelo-de-dominio.md` con los campos exactos de cada entidad (organización, usuario, contacto, empresa) y su tipo de dato
- Definición de qué campos van en `custom_fields` (JSONB) vs. columnas fijas

**Entregables técnicos:**

- Schema de Drizzle para las entidades core
- Pantallas de listado, detalle, alta y edición para cada entidad
- Sistema de permisos básico (lectura/escritura por rol)

**Criterios de salida:** se puede crear una organización, cargar usuarios, contactos y empresas, y navegar entre ellos sin errores, respetando el modelo documentado.

> **Nota (2026-07-25)**: esta descripción (organización/usuario/contacto/empresa) es la misma del dominio genérico desactualizado — el núcleo real a construir es el de `domain/core.md` (LEGAJOS, CLIENTES, CUENTAS, PRODUCTOS).

### Fase 3 — Pipeline de ventas

Estimado: 6-7 semanas (55 hs)
Depende de: Fase 2

**Objetivo**: el módulo de ventas — la parte más visible del producto en una demo.

**Entregables documentales:**

- Sección nueva en `03-reglas-de-negocio.md`: qué pasa en cada transición de etapa del pipeline, qué reglas de validación aplican, qué se considera un deal "cerrado" (ganado/perdido)

**Entregables técnicos:**

- Entidad deals y etapas de pipeline
- Vista kanban con drag-and-drop
- Actividades asociadas a deals (llamadas, notas, tareas)

**Criterios de salida:** se puede crear un deal, moverlo entre etapas, asociarle actividades, y ver el pipeline completo de un vistazo.

### Fase 4 — Sistema de módulos

Estimado: 7-9 semanas (55-70 hs)
Depende de: Fase 3 (necesita al menos un módulo real ya construido para validar el contrato contra un caso concreto)

**Objetivo**: formalizar el mecanismo de activar/desactivar funcionalidad por cliente — el corazón de la propuesta "modular".

**Entregables documentales:**

- Cierre definitivo de `02-contrato-de-modulos.md`, ya validado contra el módulo de ventas real (no solo en teoría)

**Entregables técnicos:**

- Mecanismo de registro de módulos (rutas, permisos, tablas)
- Tabla/config de `enabled_modules` por instancia
- Un segundo módulo simple (ej. "Tickets" básico) como prueba de que el contrato funciona con más de un caso

**Criterios de salida:** se puede apagar el módulo de Tickets sin romper nada, y prenderlo de nuevo, sin tocar código — solo configuración.

### Fase 5 — Multiusuario y permisos

Estimado: 3-4 semanas (30 hs)
Depende de: Fase 2 (puede correr en paralelo con Fases 3-4 si el tiempo lo permite)

**Objetivo**: que la demo se sienta como un producto de equipo, no de un solo usuario.

**Entregables documentales:**

- Matriz de roles y permisos (admin / vendedor / solo lectura) en `01-modelo-de-dominio.md`

**Entregables técnicos:**

- Invitación de usuarios a una organización
- Permisos granulares aplicados en cada pantalla ya construida

**Criterios de salida:** dos usuarios con roles distintos ven y pueden hacer cosas distintas dentro de la misma organización.

### Fase 6 — UI/UX y pulido

Estimado: 6-8 semanas (50-65 hs)
Depende de: Fases 2-5 sustancialmente avanzadas

**Objetivo**: que el producto se vea y se sienta terminado, no como un prototipo.

**Entregables documentales:**

- Guía de estilo mínima (paleta, tipografía, tono visual) si no se definió antes

**Entregables técnicos:**

- Dashboard con métricas básicas
- Estados vacíos, loading states, responsive mínimo
- Revisión visual pantalla por pantalla

**Criterios de salida:** alguien externo al proyecto lo mira y no lo describe como "un prototipo" sin que se lo digan.

### Fase 7 — Deploy y datos de demo

Estimado: 3-4 semanas (30 hs)
Depende de: Fase 6

**Objetivo**: una instancia real, desplegada, con datos ficticios convincentes, lista para mostrar a un cliente potencial.

**Entregables técnicos:**

- Deploy en infraestructura elegida (Fly.io / Railway / VPS)
- Script de seed con una empresa demo completa (contactos, deals, actividades)
- Dominio propio apuntando a la demo

**Criterios de salida:** podés mandar un link a alguien y que vea el producto funcionando con datos que cuentan una historia coherente (no "Test Test Test" en cada campo).

### Buffer general

Estimado: 5-6 semanas (40-50 hs), distribuido a lo largo de todo el proyecto, no al final. Con ritmo part-time, retomar contexto entre sesiones espaciadas también consume tiempo — este buffer lo contempla.

### Próximo paso inmediato

Arrancar Fase 0, documento 1: `01-modelo-de-dominio.md` (entidades del core, relaciones, qué es fijo vs. extensible vía `custom_fields`).

> **Nota (2026-07-25)**: superado — el modelo de dominio ya está definido en `domain/core.md`, `domain/motor-de-estados.md` y `domain/infraestructura.md`. Este roadmap completo necesita una pasada de reescritura para reflejar el estado real del proyecto; queda pendiente como tarea separada.
