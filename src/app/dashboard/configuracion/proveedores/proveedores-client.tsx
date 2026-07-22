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
import { Plus, Pencil, Trash2, Loader2, Truck } from "lucide-react";
import { toast } from "sonner";
import type { Proveedor } from "@/lib/types/database";
import {
  crearProveedor,
  actualizarProveedor,
  eliminarProveedor,
} from "./actions";

interface ProveedoresClientProps {
  proveedores: Proveedor[];
  productCountMap: Record<string, number>;
}

export function ProveedoresClient({
  proveedores,
  productCountMap,
}: ProveedoresClientProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProv, setEditingProv] = useState<Proveedor | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      let result;
      if (editingProv) {
        result = await actualizarProveedor(editingProv.id, formData);
      } else {
        result = await crearProveedor(formData);
      }

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(
        editingProv ? "Proveedor actualizado" : "Proveedor creado"
      );
      setDialogOpen(false);
      setEditingProv(null);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, nombre: string) {
    const confirmed = window.confirm(
      `¿Eliminar al proveedor "${nombre}"? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    const result = await eliminarProveedor(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Proveedor eliminado");
      router.refresh();
    }
  }

  function openCreate() {
    setEditingProv(null);
    setDialogOpen(true);
  }

  function openEdit(prov: Proveedor) {
    setEditingProv(prov);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Proveedores</h1>
          <p className="text-sm text-muted-foreground">
            {proveedores.length} proveedor(es) registrado(s)
          </p>
        </div>

        <Dialog
          open={dialogOpen}
          onOpenChange={(v) => {
            setDialogOpen(v);
            if (!v) setEditingProv(null);
          }}
        >
          <DialogTrigger
            render={<Button onClick={openCreate} />}
          >
            <Plus className="size-4" />
            Nuevo proveedor
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingProv ? "Editar proveedor" : "Nuevo proveedor"}
              </DialogTitle>
            </DialogHeader>
            <form action={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="prov-nombre">Nombre *</Label>
                <Input
                  id="prov-nombre"
                  name="nombre"
                  required
                  defaultValue={editingProv?.nombre ?? ""}
                  key={editingProv?.id ?? "new"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prov-telefono">Teléfono</Label>
                <Input
                  id="prov-telefono"
                  name="telefono"
                  placeholder="Ej: +58 412 1234567"
                  defaultValue={editingProv?.telefono ?? ""}
                  key={(editingProv?.id ?? "new") + "-tel"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prov-contacto">Persona de contacto</Label>
                <Input
                  id="prov-contacto"
                  name="contacto"
                  placeholder="Nombre del contacto"
                  defaultValue={editingProv?.contacto ?? ""}
                  key={(editingProv?.id ?? "new") + "-con"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prov-notas">Notas</Label>
                <Textarea
                  id="prov-notas"
                  name="notas"
                  rows={2}
                  placeholder="Observaciones, horarios, dirección..."
                  defaultValue={editingProv?.notas ?? ""}
                  key={(editingProv?.id ?? "new") + "-notas"}
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
                  {editingProv ? "Guardar" : "Crear"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {proveedores.length > 0 ? (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead className="text-right">Productos</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proveedores.map((prov) => {
                const count = productCountMap[prov.id] ?? 0;
                return (
                  <TableRow key={prov.id}>
                    <TableCell className="font-medium">{prov.nombre}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {prov.telefono ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {prov.contacto ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{count}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => openEdit(prov)}
                          title="Editar"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleDelete(prov.id, prov.nombre)}
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
          <Truck className="size-12 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-medium">
            Aún no hay proveedores
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Registra tu primer proveedor para asignarlo a tus productos.
          </p>
          <Button className="mt-4" onClick={openCreate}>
            <Plus className="size-4" />
            Agregar el primero
          </Button>
        </div>
      )}
    </div>
  );
}
