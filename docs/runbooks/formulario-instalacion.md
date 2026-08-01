# Formulario: instalación nueva para un cliente

Completar este formulario con toda la información necesaria para dar de alta un cliente nuevo — lo completa quien tiene los datos (comercial, el propio cliente, quien negoció el alta), no necesariamente quien va a instalar.

Una vez completo, hay dos caminos:
- **A mano**: dárselo a quien vaya a instalar para que siga `docs/runbooks/nueva-instalacion.md` con estos datos a la vista.
- **Por defecto**: pasarle este archivo completo a Claude Code y pedirle que ejecute `docs/runbooks/nueva-instalacion.md` con esta información — tiene todo lo que necesita acá adentro, no hace falta explicarle nada más.

No dejar ningún `[COMPLETAR]` sin llenar antes de entregarlo — si un dato todavía no se sabe, escribir `[PENDIENTE: por qué]` en vez de dejarlo vacío, para que quede claro que es una decisión consciente de completar después, no un olvido.

---

## 1. Datos del cliente

- **Nombre del cliente / empresa**: [COMPLETAR]
- **`client-slug`** (identifica su carpeta `apps/<client-slug>`, sin espacios ni mayúsculas, ej. `acme`): [COMPLETAR]
- **Zona horaria** (ej. `America/Argentina/Buenos_Aires`, `Europe/Madrid`): [COMPLETAR]
- **Módulos contratados** (`packages/modules/<nombre>`, ver ADR 0012 — dejar vacío si no tiene ninguno; ej. `cotizaciones-argentina`): [COMPLETAR]

## 2. Infraestructura

- **Hosting elegido** (self-hosted / VPS propio / RDS / Azure Database for PostgreSQL / Google Cloud SQL / otro): [COMPLETAR]
- **¿Quién provisiona el servidor y la base?** (nosotros / el cliente / un tercero): [COMPLETAR]
- **Credenciales/acceso a la base ya provisionada** (host, puerto, usuario, o dónde están guardadas de forma segura — nunca escribir la contraseña en este archivo en texto plano, referenciar dónde está): [COMPLETAR]

## 3. Procesos (Scheduler)

- **¿Este cliente usa Procesos periódicos?** (sí/no): [COMPLETAR]
- Si sí, **cantidad de jobs ejecutores en paralelo (N)** — ver ADR 0015. Si no se tiene una estimación de carga, usar `3` como default razonable: [COMPLETAR]

## 4. Acciones Externas

La infraestructura (`ACCIONES_EXTERNAS`/`ACCIONES_EXTERNAS_COLA`, worker de Node) es parte del core, la tiene toda instalación sin configuración extra — lo que varía por cliente es qué componentes concretos usa. Ver `domain/acciones-externas.md`.

- **¿Este cliente va a mandar mails desde el sistema?** (`email` — sprint posterior, todavía no implementado; dejar `[PENDIENTE: no implementado todavía]` si aplica): [COMPLETAR]
- Si sí (cuando esté implementado) — datos SMTP: host, puerto, usuario, contraseña (referenciar dónde está guardada de forma segura, no en texto plano acá), remitente default: [COMPLETAR]
- **¿Va a disparar webhooks salientes genéricos?** (`webhook` — sprint posterior, todavía no implementado; dejar `[PENDIENTE: no implementado todavía]` si aplica): [COMPLETAR]
- **¿Consulta cotizaciones de moneda?** (componente `consulta_cotizacion`, hoy solo Argentina — ver módulo `cotizaciones-argentina` en la sección 1 y el recurso "Cotizaciones (Argentina)" en la sección 6a; no necesita ninguna credencial, DolarApi no requiere autenticación): [COMPLETAR]

## 5. Generación de Documentos

- **¿Este cliente genera documentos (PDF desde plantillas HTML)?** (sí/no): [COMPLETAR]

## 6. Recursos

Ver ADR 0017 para la diferencia entre recurso estándar y custom.

**6a. Recursos estándar** — revisar `docs/project/catalogo-recursos-estandar.md` y tildar los que este cliente necesita. Si un recurso tildado depende de otro (columna "Depende de" de esa tabla), tildar también la dependencia aunque no se haya pedido explícitamente.

- [COMPLETAR: listar los recursos estándar elegidos, uno por línea]

**6b. Recursos custom** — algo hecho a medida para este cliente puntual, sin equivalente en el catálogo (no hace falta que sea código: puede ser una bandeja, un tipo de trámite o un reporte armado específicamente para este caso). Describir acá qué es y qué necesita — quien instale lo va a construir directo para esta instancia, no hay un seed compartido:

- [COMPLETAR: describir cada recurso custom, o dejar vacío si no hay ninguno]

## 7. Configuración de negocio inicial

- **Título/nombre a mostrar en la interfaz**: [COMPLETAR]
- **Color primario / secundario** (hex, `#RRGGBB`): [COMPLETAR]
- **Logo / imagen de fondo** (archivo a subir, o ruta si ya está en algún lado): [COMPLETAR]
- **Usuario admin real** — nombre, email (la contraseña se define al crearlo, no acá): [COMPLETAR]

## 8. Notas / casos particulares

Cualquier cosa que no entre en las secciones de arriba pero quien instale necesite saber: [COMPLETAR o dejar vacío]

---

Ver `docs/runbooks/nueva-instalacion.md` para el paso a paso que consume esta información, y `docs/project/catalogo-recursos-estandar.md` para el catálogo de la sección 6a.
