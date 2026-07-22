"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Loader2, Tags } from "lucide-react";
import { toast } from "sonner";
import type { Categoria } from "@/lib/types/database";
import {
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
} from "./actions";

interface CategoriasClientProps {
  categorias: Categoria[];
  productCountMap: Record<string, number>;
}

export function CategoriasClient({
  categorias,
  productCountMap,
}: CategoriasClientProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Categoria | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      let result;
      if (editingCat) {
        result = await actualizarCategoria(editingCat.id, formData);
      } else {
        result = await crearCategoria(formData);
      }

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(
        editingCat ? "Categoría actualizada" : "Categoría creada"
      );
      setDialogOpen(false);
      setEditingCat(null);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, nombre: string) {
    const confirmed = window.confirm(
      `¿Eliminar la categoría "${nombre}"? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    const result = await eliminarCategoria(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.warning("Categoría eliminada");
      router.refresh();
    }
  }

  function openCreate() {
    setEditingCat(null);
    setDialogOpen(true);
  }

  function openEdit(cat: Categoria) {
    setEditingCat(cat);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categorías</h1>
          <p className="text-sm text-muted-foreground">
            {categorias.length} categoría(s) registrada(s)
          </p>
        </div>

        <Dialog
          open={dialogOpen}
          onOpenChange={(v) => {
            setDialogOpen(v);
            if (!v) setEditingCat(null);
          }}
        >
          <DialogTrigger
            render={<Button onClick={openCreate} />}
          >
            <Plus className="size-4" />
            Nueva categoría
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingCat ? "Editar categoría" : "Nueva categoría"}
              </DialogTitle>
            </DialogHeader>
            <form action={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cat-nombre">Nombre *</Label>
                <Input
                  id="cat-nombre"
                  name="nombre"
                  required
                  defaultValue={editingCat?.nombre ?? ""}
                  key={editingCat?.id ?? "new"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-descripcion">Descripción</Label>
                <Textarea
                  id="cat-descripcion"
                  name="descripcion"
                  rows={2}
                  defaultValue={editingCat?.descripcion ?? ""}
                  key={(editingCat?.id ?? "new") + "-desc"}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="size-4 animate-spin" />}
                  {editingCat ? "Guardar" : "Crear"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {categorias.length > 0 ? (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Productos</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categorias.map((cat) => {
                const count = productCountMap[cat.id] ?? 0;
                return (
                  <TableRow key={cat.id}>
                    <TableCell className="font-medium">{cat.nombre}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {cat.descripcion ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{count}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => openEdit(cat)}
                          title="Editar"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleDelete(cat.id, cat.nombre)}
                          title="Eliminar"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <Tags className="size-12 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-medium">
            Aún no hay categorías
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea la primera categoría para clasificar tus productos.
          </p>
          <Button className="mt-4" onClick={openCreate}>
            <Plus className="size-4" />
            Agregar la primera
          </Button>
        </div>
      )}
    </div>
  );
}
