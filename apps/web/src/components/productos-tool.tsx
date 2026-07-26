"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProductosPanel } from "@/components/productos-panel";
import { SubProductosPanel } from "@/components/sub-productos-panel";
import type { ProductoConContador, SubProductoConProducto } from "@valgian/core";
import {
  createProductoAction,
  updateProductoAction,
  deleteProductoAction,
  createSubProductoAction,
  updateSubProductoAction,
  deleteSubProductoAction,
} from "@/app/dashboard/productos/actions";

interface ProductosToolProps {
  productosIniciales: ProductoConContador[];
  subProductosIniciales: SubProductoConProducto[];
  canGestionar: boolean;
}

export function ProductosTool({ productosIniciales, subProductosIniciales, canGestionar }: ProductosToolProps) {
  const router = useRouter();
  const [selectedProductoId, setSelectedProductoId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function avisarSinPermiso() {
    setAviso("No tenés permiso de gestión sobre esta herramienta.");
    setTimeout(() => setAviso(null), 3500);
  }

  async function handleSaveProducto(data: { modulo: string | null; codigo: string; nombre: string }, id?: string) {
    const result = id ? await updateProductoAction(id, data) : await createProductoAction(data);
    if (!result.error) router.refresh();
    return result;
  }

  async function handleDeleteProducto(id: string) {
    const result = await deleteProductoAction(id);
    if (!result.error) {
      router.refresh();
      if (selectedProductoId === id) setSelectedProductoId(null);
    }
    return result;
  }

  async function handleSaveSubProducto(data: { idProducto: string; codigo: string; nombre: string }, id?: string) {
    const result = id ? await updateSubProductoAction(id, data) : await createSubProductoAction(data);
    if (!result.error) router.refresh();
    return result;
  }

  async function handleDeleteSubProducto(id: string) {
    const result = await deleteSubProductoAction(id);
    if (!result.error) router.refresh();
    return result;
  }

  const selectedProducto = productosIniciales.find((p) => p.id === selectedProductoId) ?? null;

  return (
    <div className="flex h-full gap-4">
      {aviso && (
        <div className="fixed top-20 right-4 z-50 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive shadow-lg">
          {aviso}
        </div>
      )}

      <aside className="w-72 shrink-0 overflow-hidden rounded-xl border border-border">
        <ProductosPanel
          productos={productosIniciales}
          selectedProductoId={selectedProductoId}
          onSelectProducto={(id) => setSelectedProductoId((prev) => (prev === id ? null : id))}
          canGestionar={canGestionar}
          onSinPermiso={avisarSinPermiso}
          onSave={handleSaveProducto}
          onDelete={handleDeleteProducto}
        />
      </aside>

      <div className="flex-1 overflow-hidden rounded-xl border border-border">
        <SubProductosPanel
          subProductos={subProductosIniciales}
          selectedProducto={selectedProducto}
          canGestionar={canGestionar}
          onSinPermiso={avisarSinPermiso}
          onSave={handleSaveSubProducto}
          onDelete={handleDeleteSubProducto}
        />
      </div>
    </div>
  );
}
