"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CategoriasProductosPanel } from "@/components/categorias-productos-panel";
import { ProductosPanel } from "@/components/productos-panel";
import type { CategoriaProductoConContador, ProductoConCategoria } from "@valgian/core";
import {
  createCategoriaProductoAction,
  updateCategoriaProductoAction,
  deleteCategoriaProductoAction,
  createProductoAction,
  updateProductoAction,
  deleteProductoAction,
} from "@/app/dashboard/productos/actions";

interface MonedaOption {
  id: string;
  codigo: string;
  nombre: string;
}

interface ProductosToolProps {
  categoriasIniciales: CategoriaProductoConContador[];
  productosIniciales: ProductoConCategoria[];
  monedas: MonedaOption[];
  canGestionar: boolean;
}

export function ProductosTool({ categoriasIniciales, productosIniciales, monedas, canGestionar }: ProductosToolProps) {
  const router = useRouter();
  const [selectedCategoriaId, setSelectedCategoriaId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function avisarSinPermiso() {
    setAviso("No tenés permiso de gestión sobre esta herramienta.");
    setTimeout(() => setAviso(null), 3500);
  }

  async function handleSaveCategoria(
    data: { modulo: string | null; codigo: string; nombre: string; spPago: string | null; spAnularPago: string | null },
    id?: string,
  ) {
    const result = id ? await updateCategoriaProductoAction(id, data) : await createCategoriaProductoAction(data);
    if (!result.error) router.refresh();
    return result;
  }

  async function handleDeleteCategoria(id: string) {
    const result = await deleteCategoriaProductoAction(id);
    if (!result.error) {
      router.refresh();
      if (selectedCategoriaId === id) setSelectedCategoriaId(null);
    }
    return result;
  }

  async function handleSaveProducto(data: { idCategoria: string; idMoneda: string | null; codigo: string; nombre: string }, id?: string) {
    const result = id ? await updateProductoAction(id, data) : await createProductoAction(data);
    if (!result.error) router.refresh();
    return result;
  }

  async function handleDeleteProducto(id: string) {
    const result = await deleteProductoAction(id);
    if (!result.error) router.refresh();
    return result;
  }

  const selectedCategoria = categoriasIniciales.find((c) => c.id === selectedCategoriaId) ?? null;

  return (
    <div className="flex h-full gap-4">
      {aviso && (
        <div className="fixed top-20 right-4 z-50 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive shadow-lg">
          {aviso}
        </div>
      )}

      <aside className="w-72 shrink-0 overflow-hidden rounded-xl border border-border">
        <CategoriasProductosPanel
          categorias={categoriasIniciales}
          selectedCategoriaId={selectedCategoriaId}
          onSelectCategoria={(id) => setSelectedCategoriaId((prev) => (prev === id ? null : id))}
          canGestionar={canGestionar}
          onSinPermiso={avisarSinPermiso}
          onSave={handleSaveCategoria}
          onDelete={handleDeleteCategoria}
        />
      </aside>

      <div className="flex-1 overflow-hidden rounded-xl border border-border">
        <ProductosPanel
          productos={productosIniciales}
          selectedCategoria={selectedCategoria}
          monedas={monedas}
          canGestionar={canGestionar}
          onSinPermiso={avisarSinPermiso}
          onSave={handleSaveProducto}
          onDelete={handleDeleteProducto}
        />
      </div>
    </div>
  );
}
