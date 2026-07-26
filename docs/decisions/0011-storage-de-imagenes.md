# 0011 - Storage de imágenes: íconos por clave estable, avatares en sistema de archivos

## Estado

Aceptada

## Contexto

Aparecieron dos necesidades de imágenes en la infraestructura de aplicación: íconos para las opciones de menú (conjunto chico, controlado por el equipo, no subido por usuarios finales) y foto de perfil de usuario (archivo real, subido por cada usuario).

Ambas necesitan resolverse en un modelo de instancia-por-cliente (ADR 0001), donde no hay un backend central que pueda corregir datos de todas las instancias a la vez.

## Decisión

**Íconos de menú**: `MENUES_OPCIONES.ICONO` no guarda el nombre de un ícono de lucide-react directamente. Guarda una clave propia y estable (ej. `icon.legajos`), que un único diccionario en código mapea al componente real de lucide-react.

**Foto de perfil**: se guarda como archivo en el sistema de archivos de la instancia (volumen de Docker dedicado, ej. `uploads/`), no como binario en la base de datos. `USUARIOS.AVATAR_PATH` guarda solo la ruta relativa.

## Alternativas consideradas

- **Nombre de ícono de lucide-react guardado directo en la base**: descartado — si una versión futura de la librería renombra un ícono, habría que corregir datos en cada instancia de cliente por separado, en vez de corregir una línea de código que se despliega con el próximo update.
- **Imágenes de perfil como bytea en Postgres**: descartado — infla la base, hace más lentos los backups y las queries no relacionadas con imágenes, y es menos eficiente para servir que un archivo estático.
- **Storage S3-compatible (Minio self-hosted o cloud) desde el arranque**: evaluado y descartado por ahora — agrega una dependencia más por instancia sin necesidad clara a esta escala. Queda como posible evolución futura (ver Consecuencias).

## Consecuencias

- El diccionario clave→ícono vive en código versionado; renombres de la librería de íconos se resuelven ahí, nunca tocando datos de instancias existentes.
- El volumen de archivos (`uploads/`) se suma a lo que hay que respaldar por instancia, junto con la base de datos — a incorporar en la estrategia de backups pendiente (ver `open-issues.md`).
- Si en el futuro se necesita servir archivos desde múltiples instancias de aplicación en paralelo (no el caso hoy) o migrar a un storage más escalable, conviene que el acceso a archivos esté abstraído detrás de una interfaz simple en código, para poder cambiar de backend (filesystem → S3-compatible) sin tocar cada punto de uso.
