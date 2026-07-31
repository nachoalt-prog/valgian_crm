Lo siguiente que me interesa hoy


- HOY
    
    ----------------------------------------------------------------
    - Extender el módulo de ARCHIVOS_ADJUNTOS moviendo las dos columnas ID_ENTIDAD y ID_RELACION una nueva tabla ARCHIVOS_ADJUNTOS_ENTIDADES donde también halla ID_ARCHIVO_ADJUNTO de forma que un mismo adjunto se pueda asociar a varias entidades
      - Modificar toda dependencia
      - Trigger on delete de ARCHIVOS_ADJUNTOS que borre toda relación en ARCHIVOS_ADJUNTOS_ENTIDADES
      - Antes de eliminar las columnas originales, migrar toda relación de adjuntos existentes en demo a la nueva tabla
    - Crear entidad Historial
    - Añadir trigger on insert de HISTORIAL
      - Si es un movimiento de legajo o trámite: buscar todo adjunto vinculado al mismo legajo o trámite, con fecha de carga dentro de los últimos 10 minutos y sin asociación contra entidad historial. Para todos los encontrados: ingresarles un registro en ARCHIVOS_ADJUNTOS_ENTIDADES vinculandolos a este registro de historial que se crea.
    - Modificar tanto LAYOUTS_LEGAJO_SOLAPAS como MENUES_OPCIONES para añadir una columna PARAMETROS tipo JSONB. Modificar también los ABM.
    - Modificar todo uso de las tablas anteriores para soportar pasarle esos parámetros a las herramientas
    - Modificar el ABM de archivos adjuntos para soportar recibir por parámetro los falgs Crear, Borrar, Reemplazar y Descargar
      - Si recibe alguno en 0 o false debe impedir hacer esa acción. Para el caso de 'Crear' directamente no mostrar el botón Nuevo. Si no los recibe asume que se puede hacer todo, como si fueran todos 1 o true. Esto se hace, después de validar permiso a las operaciones, es adicional.
    - Añadir en la vista de historial (trámites y de legajos) una nueva columna 'Adjuntos' con un botón, que debe desplegar como modal el ABM de archivos_adjuntos pasándo como entidad el registro de historial, por tanto deberían verse los adjuntos de tal movimiento.
    - Añadir el ABM modal de adjuntos en una nueva solapa del modal de trámites, que muestre sus adjuntos asociados al trámite y permita cargar nuevos. Análogo a legajos.

-----------------------------------------------------------------------------------------------
    - No se previsualizan HTMLs ?
    - ABM tipos de adjunto ?
    - generación de adjuntos
      - modelos 
    - En muchas herramientas se muestra tanto código como nombre de los registros. Habría que mostrar solo nombre (esto no incluye ventanas de edición de datos).


-------------------
NEXT TODO

  - procesos
    - Quiero añadir procesos automáticos programados, tipo Scheduler. Para eso se me ocurre una tabla de procesos con toda la configuración, pero necesito que 'algo' los dispare automáticamente cuando toca según lo que cada uno tenga configurado. Ese algo puede ser job de base de datos en la arquitectura actual? O qué recomendas?
  - tramites (que puedan servir tambien como tickets, simil manager o invgate)
    - cabecera fija con campos de TRAMITES (tipo, categoria, entidad, numero, estado)
    - trámites vinculados
    - campos obligatorios por estado
    - solapa de archivos adjuntos
  - impedir gestión del mismo trámite o legajo a dos usuarios a la vez
  - reportes
  - colapsar menues
  - modo claro y oscuro
  - que al editar interfaces, haya un selector de colores interactivo
  - HISTORIAL: verificar índice en historial por ID_ENTIDAD, ID_REGISTRO y FECHA / además generar partición ID_ENTIDAD

BACKLOG
  - importadores
  - exportadores
  - mensajería 
  - dashboards
  - puntos de venta o sucursales
  - wizards ?
  - deudores_login autogestion
  - webservices c
  - webservices p
  - integracion IA
  - varios seeds por bloque de módulos
  - distribucion de actualizaciones
  - hosting y inaccesibilidas a fuentes

------------tentativo
- Qué tan costoso sería añadir un nivel más a los menues? o sea SUB_MENUES, con un id_menu.
  - reemplazar el id_menu en las opciones por id_sub_menu
  - Que en la barra lateral se muestre un nuevo nivel de agrupación por debajo de los menues, y recién dentro de ese las opciones
  - 

---------------------- Esto pendiente de pensar (IMG) ---------------------------
Hay que incorporar un sistema para carga de archivos. Que permita 

Para cualquier usuario, al pasar el mouse por su foto de perfil (el circulito en la esquina superior derecha de la pantalla) se debe mostrar sobre esta un ícono de lapiz (para editar). Al presionarlo debe desplegarse por encima de la pantalla (blureando todo por detrás) la imagen de perfil, al lado un botón 'Cargar nueva imagen' que permita 
---------------------- Esto pendiente de pensar (IMG) ---------------------------