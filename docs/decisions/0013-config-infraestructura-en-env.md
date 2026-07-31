# 0013 - Config de infraestructura por instalación en .env, config de negocio en la base

## Estado

Aceptada

## Contexto

Al preparar el storage de archivos adjuntos para eventualmente soportar un segundo modo (filesystem → S3-compatible, ver ADR 0011), surgió la pregunta de dónde vive ese tipo de parámetro: `MODALIDAD_ALMACENAMIENTO_ADJUNTOS` (y antes, `UPLOADS_DIR`, `DATABASE_URL`) no son datos que un usuario del sistema configure desde una pantalla — son decisiones de **cómo está desplegada esta instancia puntual** (ADR 0001: instancia por cliente), fijas para toda la vida de ese despliegue salvo una intervención de infraestructura.

Se evaluó agregar una tabla `PARAMETROS_CONFIGURACION` genérica para centralizar este tipo de valores junto con la configuración de negocio que ya vive en la base (ESTRATEGIAS, FILTROS, HERRAMIENTAS, etc.).

## Decisión

**Config de infraestructura por instalación → variables de entorno (`.env`)**. Todo lo que responde "¿cómo está desplegada ESTA instancia?" (connection string de la base, directorio de uploads, modalidad de storage, límites de recursos) vive en `.env`, se lee una vez al arrancar el proceso, y cambiarlo implica reiniciar — exactamente el mismo criterio que ya usan `DATABASE_URL` (packages/db/src/client.ts) y `UPLOADS_DIR` (packages/core/src/archivos-adjuntos.ts).

**Config de negocio → base de datos**. Todo lo que un admin de la instancia podría querer ajustar desde una pantalla sin tocar el deploy (estrategias, filtros, permisos, tipos de archivo, placeholders, modelos) sigue viviendo en tablas, como hasta ahora.

No se crea `PARAMETROS_CONFIGURACION` ni ningún mecanismo genérico de config — cada variable de infraestructura nueva se agrega puntualmente donde se usa, con su propio nombre descriptivo y su propio default sensato, igual que `UPLOADS_DIR`.

## Alternativas consideradas

- **Tabla `PARAMETROS_CONFIGURACION` genérica**: descartada. Mezclaría dos categorías de configuración con ciclos de vida y audiencias completamente distintas (infraestructura: el operador que despliega, cambia rara vez, requiere reinicio de todas formas para muchos casos — vs. negocio: el admin de la instancia, cambia con frecuencia, sin reiniciar nada). Además introduce una capa de indirección (leer de la base en vez de `process.env`) sin ganar nada a cambio, ya que estos valores no necesitan ser editables en caliente.
- **Implementar S3 ahora, aunque nadie lo pidió todavía**: descartado. Sería código que nadie puede probar de verdad hasta que exista una instalación real que lo necesite — mejor dejar el punto de extensión preparado (`getModalidadAlmacenamiento()`, con los 4 puntos de ramificación comentados en `archivos-adjuntos.ts`) y esperar el caso real.
- **Un switch/interfaz de storage ahora** (aunque solo haya una implementación): descartado por sobre-ingeniería — no se usa ese estilo en el resto de `packages/core`, y una abstracción con un solo caso real no aporta nada, solo ruido.

## Consecuencias

- Cualquier variable de infraestructura nueva sigue el mismo patrón: nombre descriptivo en `.env`, default sensato en código, sin tabla de por medio.
- El día que exista una instalación real que necesite un segundo modo de storage, el trabajo es: implementar la rama nueva en los 4 puntos ya marcados en `archivos-adjuntos.ts`, sumar el valor a `MODALIDADES_ALMACENAMIENTO_SOPORTADAS`, y documentar la variable — no hace falta ningún cambio de arquitectura.
- `getModalidadAlmacenamiento()` falla fuerte (excepción) si `MODALIDAD_ALMACENAMIENTO_ADJUNTOS` trae un valor no reconocido — un typo en el deploy se detecta al arrancar el proceso, no en el primer intento de guardar un archivo en producción.
