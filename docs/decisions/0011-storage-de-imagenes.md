# 0011 - Storage de archivos: íconos por clave estable, archivos reales en sistema de archivos

## Estado

Aceptada

## Contexto

Aparecieron necesidades de guardar archivos en la infraestructura de aplicación: íconos para las opciones de menú (conjunto chico, controlado por el equipo, no subido por usuarios finales), foto de perfil de usuario (archivo real, subido por cada usuario), y archivos adjuntos genéricos que puede tener cualquier entidad del sistema (facturas, comprobantes, documentos — subidos por un usuario o generados por el propio sistema).

Todas necesitan resolverse en un modelo de instancia-por-cliente (ADR 0001), donde no hay un backend central que pueda corregir datos de todas las instancias a la vez, y donde cada instancia vive en su propia carpeta `apps/<client-slug>` (ADR 0012).

## Decisión

**Íconos de menú**: `MENUES_OPCIONES.ICONO` no guarda el nombre de un ícono de lucide-react directamente. Guarda una clave propia y estable (ej. `icon.legajos`), que un único diccionario en código mapea al componente real de lucide-react.

**Foto de perfil**: se guarda como archivo en el sistema de archivos de la instancia (volumen de Docker dedicado, `apps/<client-slug>/uploads/avatares/`), no como binario en la base de datos. `USUARIOS.AVATAR_PATH` guarda solo la ruta relativa. Al ser un único archivo por usuario, no necesita sharding — el volumen ya está acotado por la cantidad de usuarios.

**Archivos adjuntos genéricos**: se agregan dos tablas.

- `TIPOS_ARCHIVOS_ADJUNTOS` (catálogo, poblado con tipos comunes en el seed principal, `packages/core/src/seed.ts`): `ID`, `CODIGO`, `NOMBRE`, `EXTENSION`, `MIMETYPE`, `PERMITE_CARGA`, `PERMITE_DOWNLOAD`, `RENDERIZAR`.
- `ARCHIVOS_ADJUNTOS`: `ID`, `ID_ENTIDAD` (FK a `ENTIDADES`), `ID_REGISTRO` (uuid sin FK — mismo patrón polimórfico que `TRAMITES.ID_REGISTRO`), `ID_TIPO_ARCHIVO_ADJUNTO` (FK), `NOMBRE_ORIGINAL`, `RUTA_ARCHIVO`, `TAMANIO_BYTES`, más las columnas de auditoría estándar `ALTA_FECHA`/`ALTA_USUARIO`/`AUDIT_FECHA`/`AUDIT_USUARIO`.

Igual que la foto de perfil: el archivo real vive en el filesystem de la instancia, nunca en una columna. Se guarda en `apps/<client-slug>/uploads/adjuntos/<1 carácter hexadecimal del propio ID>/<ID>.<extensión>` — el primer carácter del UUID actúa como carpeta (16 buckets fijos), evitando que se acumulen decenas de miles de archivos en una sola carpeta sin necesidad de asignar nada a mano. El nombre real en disco es siempre el `ID` de la fila, nunca `NOMBRE_ORIGINAL` (evita path traversal y colisiones); el nombre subido por el usuario queda solo en esa columna, para mostrarlo en pantalla.

## Alternativas consideradas

- **Nombre de ícono de lucide-react guardado directo en la base**: descartado — si una versión futura de la librería renombra un ícono, habría que corregir datos en cada instancia de cliente por separado, en vez de corregir una línea de código que se despliega con el próximo update.
- **Archivos (avatares y adjuntos) como bytea en Postgres**: descartado — infla la base, hace más lentos los backups y las queries no relacionadas con archivos, y es menos eficiente para servir que un archivo estático. Con adjuntos esto pesa más que con avatares, porque el volumen esperado es mucho mayor (facturas, comprobantes, generados también por el propio sistema y no solo por carga manual de un usuario).
- **Sharding de adjuntos por fecha de alta** (ej. carpeta por año/mes): descartado — crece sin límite y no tiene ningún techo real, porque el sistema también genera adjuntos por sí solo, no depende únicamente del ritmo de carga de un usuario.
- **Sharding en 2 niveles de 2 caracteres (256 o 65.536 buckets) como default**: descartado por ahora — de más para la escala nicho actual (ADR 0001). Un solo carácter (16 buckets) alcanza cómodo; queda como ajuste puntual por instancia si un cliente concreto necesita más profundidad.
- **Columnas `RUTA1`/`RUTA2` separadas en `ARCHIVOS_ADJUNTOS`** (patrón visto en otro sistema): descartado — el shard ya se deriva del propio `ID` y queda calculado una sola vez dentro del string completo de `RUTA_ARCHIVO`; no hace falta guardarlo aparte.
- **Storage S3-compatible (Minio self-hosted o cloud) desde el arranque**: evaluado y descartado por ahora — agrega una dependencia más por instancia sin necesidad clara a esta escala. Queda como posible evolución futura (ver Consecuencias).

## Consecuencias

- El diccionario clave→ícono vive en código versionado; renombres de la librería de íconos se resuelven ahí, nunca tocando datos de instancias existentes.
- El volumen de archivos (`uploads/` dentro de cada `apps/<client-slug>`) se suma a lo que hay que respaldar por instancia, junto con la base de datos — a incorporar en la estrategia de backups pendiente (ver `open-issues.md`).
- Cambiar la profundidad de sharding para un cliente puntual (de 1 a 2 caracteres) no requiere migrar los archivos ya guardados — la ruta completa queda grabada por fila en `RUTA_ARCHIVO`, nunca se recalcula.
- Si en el futuro se necesita servir archivos desde múltiples instancias de aplicación en paralelo (no el caso hoy) o migrar a un storage más escalable, conviene que el acceso a archivos esté abstraído detrás de una interfaz simple en código (`guardarArchivo`/`leerArchivo`/`borrarArchivo`), para poder cambiar de backend (filesystem → S3-compatible) sin tocar cada punto de uso. Con archivos adjuntos en juego, esto deja de ser una comodidad y pasa a ser cada vez más necesario.
- Queda pendiente, sin resolver en este ADR, la política de borrado de adjuntos: soft-delete del registro vs. borrado físico del archivo, y qué pasa si uno de los dos falla.
