import { getPermisoParaOperacion, OPERACION_ACCESO, listCategoriasProductos, listProductos, listMonedasAdmin } from "@valgian/core";
import { getCurrentSession } from "@/lib/current-user";
import { SinAcceso } from "@/components/sin-acceso";
import { ProductosTool } from "@/components/productos-tool";

const HERRAMIENTA_CODIGO = "productos";

export default async function ProductosPage() {
  const session = await getCurrentSession();
  const tieneAcceso = session?.perfil ? await getPermisoParaOperacion(session.perfil.id, HERRAMIENTA_CODIGO, OPERACION_ACCESO) : false;

  if (!tieneAcceso) {
    return <SinAcceso herramienta="Categorías de Producto y Productos" />;
  }

  const [categorias, productos, monedas] = await Promise.all([listCategoriasProductos(), listProductos(), listMonedasAdmin()]);

  return (
    <ProductosTool categoriasIniciales={categorias} productosIniciales={productos} monedas={monedas} canGestionar={tieneAcceso} />
  );
}
