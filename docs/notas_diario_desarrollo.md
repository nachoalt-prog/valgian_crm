Lo siguiente que me interesa hoy


- HOY
  - archivos adjuntos
    - Ampliar HERRAMIENTAS y PERMISOS: 
      - Crear nueva tabla OPERACIONES con ID, ID_HERRAMIENTA, CODIGO y NOMBRE
      - Modificar la tabla PERMISOS reemplazando ID_HERRAMIENTA por ID_OPERACION, descartar columna GESTIONAR
      - Modificar el ABM de Permisos 
        - Mantener la columna Herramienta, aunque ahora será indirecta
        - Añadir columna Operación
        - Eliminar columna Gestionar
        - Añadir posibilidad de ordenar por cada columna
        - En el modal de edición y creación: mantener combo de herramienta, pero que su selección determine las opciones en el nuevo combo a añadir con las operaciones. Eliminar 'Puede gestionar'
    - Migrar todas las herramientas al nuevo esquema con, de momento una única operación 'Acceso'.
    - Modificar la herramienta de adjuntos con el primer uso real de operaciones:
      - Crearle, además de 'Acceso' 4 acciones: Crear, Reemplazar, Descargar y Guardar
      - Añadir en la herramienta un botón para borrar (dentro del modal donde se previsualiza). Al darle al botón primero lanzar un confirm porque borrar un adjunto es algo serio. Si se avanza, hay que terminar borrando no solo el registro en la tabla sino el archivo físico del directorio de adjuntos.
      - Modificar la herramienta para que para cada acción a realizar (los 4 botones) valide si el perfil del usuario tiene permiso para hacerlo, caso contrario mostrar un error.
    
    ----------------------------------------------------------------
    - Extender el módulo de ARCHIVOS_ADJUNTOS moviendo las dos columnas ID_ENTIDAD y ID_RELACION una nueva tabla ARCHIVOS_ADJUNTOS_ENTIDADES donde también halla ID_ARCHIVO_ADJUNTO de forma que un mismo adjunto se pueda asociar a varias entidades
      - Modificar toda dependencia
      - Trigger on delete de ARCHIVOS_ADJUNTOS que borre toda relación en ARCHIVOS_ADJUNTOS_ENTIDADES
      - Antes de eliminar las columnas originales, migrar toda relación de adjuntos existentes en demo a la nueva tabla
    - Crear entidad Historial
    - Añadir trigger on insert de HISTORIAL
      - Si es un movimiento de legajo o trámite: buscar todo adjunto vinculado al mismo legajo o trámite, con fecha de carga dentro de los últimos 10 minutos y sin asociación contra entidad historial. Para todos los encontrados: ingresarles un registro en ARCHIVOS_ADJUNTOS_ENTIDADES vinculandolos a este registro de historial que se crea.
    - Modificar tanto LAYOUTS_LEGAJO_SOLAPAS como MENUES_OPCIONES para añadir una columna PARAMETROS tipo JSONB
    - Modificar todo uso de las tablas anteriores para soportar pasarle esos parámetros a las herramientas
    - Modificar el ABM de archivos adjuntos para soportar recibir por parámetro los falgs Crear, Borrar, Reemplazar y Descargar
      - Si recibe alguno en 0 o false debe impedir hacer esa acción. Para el caso de 'Crear' directamente no mostrar el botón Nuevo. Si no los recibe asume que se puede hacer todo, como si fueran todos 1 o true.
    - Añadir en la vista de historial (trámites y de legajos) una nueva columna 'Adjuntos' con un botón, que debe desplegar como modal el ABM de archivos_adjuntos pasándo como entidad el registro de historial, por tanto deberían verse los adjuntos de tal movimiento.
    - Añadir el ABM modal de adjuntos en una nueva solapa del modal de trámites, que muestre sus adjuntos asociados al trámite y permita cargar nuevos. Análogo a legajos.
    - No se previsualizan HTMLs ?
    - ABM tipos de adjunto ?
    - generación de adjuntos
      - modelos 


-------------------
NEXT TODO

  - procesos
    - Quiero añadir procesos automáticos programados, tipo Scheduler. Para eso se me ocurre una tabla de procesos con toda la configuración, pero necesito que 'algo' los dispare automáticamente cuando toca según lo que cada uno tenga configurado. Ese algo puede ser job de base de datos en la arquitectura actual? O qué recomendas?
  - tramites (que puedan servir tambien como tickets, simil manager o invgate)
    - campos obligatorios por estado
    - trámites vinculados
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