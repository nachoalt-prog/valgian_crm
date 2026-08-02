# postgres:17-alpine + pg_cron (ver ADR 0015, domain/procesos.md) — compilado
# desde el código fuente CONTRA esta misma imagen base (usa el pg_config de
# acá adentro) en vez de instalar el paquete apk postgresql-pg_cron (solo
# disponible en el repo "edge" de Alpine, con riesgo real de mismatch de ABI
# contra los binarios de Postgres que trae la imagen oficial — no son el mismo
# build).
#
# `with_llvm` se fuerza a "no" en Makefile.global antes de compilar: pgxs
# intenta generar bitcode JIT (requiere clang/llvm EXACTAMENTE en la versión
# con la que se compiló este Postgres, ej. busca literalmente /usr/bin/clang
# y /usr/lib/llvmNN/bin/llvm-lto) — algo irrelevante para pg_cron (no ejecuta
# queries, no se beneficia de JIT) y frágil de sostener contra los paquetes
# que vaya rotando Alpine con el tiempo. Se desactiva en vez de perseguir esa
# compatibilidad.
ARG POSTGRES_VERSION=17
FROM postgres:${POSTGRES_VERSION}-alpine

RUN apk add --no-cache --virtual .build-deps build-base git && \
  PGXS_GLOBAL="$(dirname "$(pg_config --pgxs)")/../Makefile.global" && \
  sed -i "s/^with_llvm[[:space:]]*=[[:space:]]*yes/with_llvm = no/" "$PGXS_GLOBAL" && \
  git clone --depth=1 https://github.com/citusdata/pg_cron /tmp/pg_cron && \
  make -C /tmp/pg_cron install && \
  rm -rf /tmp/pg_cron && \
  apk del .build-deps && \
  echo "shared_preload_libraries = 'pg_cron'" >> /usr/local/share/postgresql/postgresql.conf.sample && \
  echo "cron.database_name = 'valgian_crm'" >> /usr/local/share/postgresql/postgresql.conf.sample && \
  echo "cron.use_background_workers = on" >> /usr/local/share/postgresql/postgresql.conf.sample
