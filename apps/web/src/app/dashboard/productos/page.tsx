import { getPermisoParaOperacion, OPERACION_ACCESO, listProductos, listSubProductos } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { ProductosTool } from "@/components/productos-tool";

const HERRAMIENTA_CODIGO = "productos";

export default async function ProductosPage() {
  const session = await getCurrentSession();
  const tieneAcceso = session?.perfil ? await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO) : false;

  if (!tieneAcceso) {
    return <SinAcceso herramienta="Productos y Sub-productos" />;
  }

  const [productos, subProductos] = await Promise.all([listProductos(), listSubProductos()]);

  return (
    <ProductosTool productosIniciales={productos} subProductosIniciales={subProductos} canGestionar={tieneAcceso} />
  );
}
