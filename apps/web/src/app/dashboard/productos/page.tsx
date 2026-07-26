import { getPermisoParaHerramienta, listProductos, listSubProductos } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { ProductosTool } from "@/components/productos-tool";

const HERRAMIENTA_CODIGO = "productos";

export default async function ProductosPage() {
  const session = await getCurrentSession();
  const permiso = session?.perfil ? await getPermisoParaHerramienta(session.perfil.id, HERRAMIENTA_CODIGO) : null;

  if (!permiso) {
    return <SinAcceso herramienta="Productos y Sub-productos" />;
  }

  const [productos, subProductos] = await Promise.all([listProductos(), listSubProductos()]);

  return (
    <ProductosTool productosIniciales={productos} subProductosIniciales={subProductos} canGestionar={permiso.gestionar} />
  );
}
