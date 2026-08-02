-- Registro de los jobs de pg_cron para Procesos (ver ADR 0015). cron.schedule
-- con nombre (jobname) es idempotente — upsertea por nombre en vez de crear
-- un job nuevo cada vez, seguro de re-correr.
--
-- N=3 ejecutores — ajustable según la carga real de la instalación (más
-- PROCESOS concurrentes de larga duración → subir N; siempre con margen sobre
-- cron.max_running_jobs/max_worker_processes, ver docker/postgres/Dockerfile
-- y ADR 0015).
SELECT cron.schedule('ticker_procesos_evaluador', '* * * * *', 'CALL sp_evaluar_procesos()');
SELECT cron.schedule('ticker_procesos_ejecutor_1', '* * * * *', 'CALL sp_ejecutar_un_proceso_pendiente()');
SELECT cron.schedule('ticker_procesos_ejecutor_2', '* * * * *', 'CALL sp_ejecutar_un_proceso_pendiente()');
SELECT cron.schedule('ticker_procesos_ejecutor_3', '* * * * *', 'CALL sp_ejecutar_un_proceso_pendiente()');
SELECT cron.schedule('ticker_procesos_huerfanas', '* * * * *', 'CALL sp_barrer_procesos_huerfanos()');
