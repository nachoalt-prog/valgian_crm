Lo siguiente que me interesa hoy
  - Que los menues sean botónes que retraigan y desplieguen las opciones que tienen dentro (o sea, el botón del menú se ve siempre, pero oculta o muestra sus opciones)
  - tramites
    - cabecera fija con campos de TRAMITES (tipo, categoria, entidad, numero, estado)
  - modo claro y oscuro un switch muy prolijito arriba de cerrar sesion en la barra lateral izquierda.
    - Guardar la preferencia en una cookie (o localStorage) del lado del cliente.
    - Si no hay preferencia guardada, usás prefers-color-scheme del sistema operativo como default.
      - Con SSR/App Router, si usás cookie (no localStorage) se debería poder leerla en el servidor y evitar el "flash" de tema incorrecto al cargar la página (el clásico FOUC de dark mode).
      next-themes internamente usa localStorage por default, pero también podés configurarlo para usar cookies si necesitás que el servidor sepa el tema en el primer render (SSR-safe, sin flash).
  - que al editar interfaces, el selector de colores sea interactivo, tipo el circulo con todos los colores. Pero también dejar poner un código de color a mano.


-----------------------------------------------------------------------------------------------
- HOY
-------------------
  - reportes
    - Crear tabla REPORTES..
    - Crear reporte de Auditoría de generación de documentos (GENERACIONES_DOCUMENTO)
 
-------------------
NEXT TODO

  - procesos
    - Quiero añadir procesos automáticos programados, tipo Scheduler. Para eso se me ocurre una tabla de procesos con toda la configuración, pero necesito que 'algo' los dispare automáticamente cuando toca según lo que cada uno tenga configurado. Ese algo puede ser job de base de datos en la arquitectura actual? O qué recomendas?
  - reportes
    - Auditoría de procesos
  - tramites
    - que puedan servir tambien como tickets, simil manager o invgate. Por tema comentarios.
    - trámites vinculados
    - campos obligatorios por estado
    - solapa de archivos adjuntos
    - Prueba de generación de adjuntos con tablas dinámicas
    - impedir gestión del mismo trámite o legajo a dos usuarios a la vez
  - Prolijidad
    - emprolijar ABM de Permisos
    - En muchas herramientas se muestra tanto código como nombre de los registros. Habría que mostrar solo nombre (esto no incluye ventanas de edición de datos).
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