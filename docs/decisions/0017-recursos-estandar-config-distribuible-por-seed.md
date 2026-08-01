# 0017 - Recursos: configuración de negocio distribuible por seed, estándar vs. custom

## Estado

Aceptada — primer recurso estándar real implementado (Cotizaciones/Argentina, ver `project/catalogo-recursos-estandar.md` y `domain/acciones-externas.md`), catálogo con un solo item, sigue creciendo de a uno.

## Contexto

ADR 0012 ya define **Módulo** (`packages/modules/<nombre>`): un paquete de CÓDIGO opcional, algunos clientes lo tienen y otros no. Pero hay otro eje de "esto es opcional por cliente" que no es código: una bandeja puntual configurada dentro del motor genérico de Bandejas (`domain/bandejas.md`), un tipo de trámite puntual dentro del motor de estados (`domain/tramites.md`), un reporte puntual dentro del motor de Reportes (`domain/reportes.md`), a futuro un wizard puntual — son filas de configuración (`BANDEJAS`, `TIPOS_TRAMITE`, `REPORTES`, sus vínculos), no paquetes. El motor en sí (Bandejas, Reportes, Procesos, motor de estados) es parte del **core**, lo tienen todos los clientes; una configuración puntual dentro de ese motor no.

Sin un nombre y un lugar propio para este concepto, la tentación natural es forzarlo dentro de "Módulo" — lo cual sería incorrecto: un módulo se versiona en `package.json` y se actualiza recompilando (`docs/runbooks/actualizaciones.md`); esto se instala corriendo un seed sobre datos que ya existen en el schema del core, sin tocar código ni versión de ningún paquete.

Un primer intento de nombrar esto como "sub-herramienta" se descartó por chocar con el vocabulario ya establecido del schema: `HERRAMIENTAS` (`packages/db/src/schema.ts`) es una tabla plana, sin ninguna columna de jerarquía — y las entidades reales detrás del concepto (`BANDEJAS`, `REPORTES`) ni siquiera tienen FK hacia `HERRAMIENTAS`, se gobiernan por un mecanismo de permiso paralelo y más fino (`BANDEJAS_PERFILES`/`REPORTES_PERFILES`). "Sub-herramienta" sugería gramaticalmente una relación estructural que no existe.

## Decisión

**Recurso**: una configuración de negocio concreta y opcional, dentro de un motor genérico que SÍ es parte del core, encapsulada en su propio seed (`packages/core/src/seeds/<slug>.ts` o equivalente), instalable independientemente en cada cliente según lo que necesite. Puede declarar dependencias de OTROS recursos (ej. una bandeja que filtra por un `FILTRO` que a su vez es harina de otro recurso).

Se distinguen dos categorías, mismo eje que ADR 0012 ya aplica a código (reusable en `packages/modules/*` vs. exclusivo de un cliente en `apps/<client-slug>/src/...`), ahora aplicado a configuración/datos:

- **Recurso estándar**: pensado para reusarse en distintas instalaciones — va al **catálogo compartido** (`docs/project/catalogo-recursos-estandar.md`), tiene su propio seed versionado como cualquier otra pieza reusable del proyecto.
- **Recurso custom (a medida)**: construido específicamente para un cliente puntual, sin vocación de reuso — **no entra al catálogo compartido**. Se documenta únicamente en el formulario de instalación de ESE cliente (`docs/runbooks/formulario-instalacion.md`), igual que código exclusivo de cliente vive directo en `apps/<client-slug>/src` sin pasar por `packages/modules`.

El catálogo de recursos estándar es un documento vivo — se consulta en dos momentos: al escribir el formulario de una instalación nueva (`docs/runbooks/formulario-instalacion.md`, se elige cuáles recursos estándar aplican) y al ejecutar el paso a paso (`docs/runbooks/nueva-instalacion.md`, se corren los seeds correspondientes en el orden que respete las dependencias).

No se retroactivan automáticamente los seeds ya existentes (`seed-config.ts`, `seed-demo.ts`) a este formato — hoy agrupan varias configuraciones juntas en un solo archivo. Separarlos en recursos individuales es trabajo pendiente, a hacer de a poco a medida que se necesite instalar selectivamente lo que hoy viene todo junto.

## Alternativas consideradas

- **"Sub-herramienta"** (nombre descartado): ver Contexto — sugiere una jerarquía en `HERRAMIENTAS` que no existe en el schema. Además convivía con el prefijo "sub-" del concepto tentativo no relacionado `SUB_MENUES` (jerarquía de navegación en menúes, mencionado suelto en `notas_diario_desarrollo.md`), riesgo de confusión cruzada entre dos ideas distintas con el mismo prefijo.
- **Meter esto dentro del concepto de Módulo (ADR 0012)**: descartado — un módulo es código versionado que se compila; un recurso es datos que se insertan sobre schema que ya existe. Forzarlos al mismo concepto rompería el checklist de actualización de módulos (`runbooks/actualizaciones.md`), que asume que "actualizar" significa bump de versión + build.
- **Sin distinción estándar/custom, todo en la misma bolsa**: descartado — sin esta distinción no queda claro cuándo algo amerita entrar al catálogo compartido (con el costo de mantenerlo prolijo y documentado) versus cuándo es simplemente una necesidad puntual de un cliente que no vale la pena catalogar. La distinción también evita que el catálogo se infle con entradas de un solo uso que nadie más va a instalar nunca.
- **Sin catálogo formal, decidir en cada instalación nueva "a ojo" qué seeds correr**: descartado — es exactamente el tipo de conocimiento tácito que este proyecto viene evitando activamente (ver el resto de `docs/`, escrito para que "cualquiera, sin conocer el proyecto de antemano" pueda seguirlo).

## Consecuencias

- **Convención de ubicación resuelta con el primer caso real** (Cotizaciones/Argentina, `packages/core/src/seed-configuracion-argentina.ts`): un recurso estándar nuevo NO va en un directorio `seeds/<slug>.ts` aparte — va como un archivo plano más en `packages/core/src/`, mismo nivel que `seed.ts`/`seed-config.ts`/`seed-demo.ts`, con su propio script `db:seed:<slug>` en `package.json`. Más consistente con lo que ya existía que inventar una carpeta nueva.
- `docs/project/catalogo-recursos-estandar.md` es un documento vivo — crece con cada recurso estándar nuevo que se construye, no es un catálogo cerrado de una vez. Los recursos custom NUNCA aparecen ahí, solo en el formulario del cliente que los tiene.
- Migrar el contenido de `seed-config.ts`/`seed-demo.ts` al formato de recursos individuales es trabajo pendiente, no bloqueante para escribir el paso a paso de instalación (que, hasta que eso pase, sigue dependiendo de esos dos seeds tal como están).
- Un recurso puede depender de código que NO es del core (ej. Cotizaciones/Argentina solo tiene sentido con el módulo `@valgian/module-cotizaciones-argentina` instalado) sin dejar de ser un recurso — la tabla del catálogo no tiene una columna para esto (declarar dependencia de OTRO recurso, no de un módulo), así que esa relación se documenta en la columna "Descripción" caso a caso.
