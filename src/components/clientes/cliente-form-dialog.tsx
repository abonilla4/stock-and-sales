"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Cliente } from "@/lib/types/database";
import { crearCliente, actualizarCliente } from "@/app/dashboard/clientes/actions";

interface ClienteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteAEditar?: Cliente | null;
}

export function ClienteFormDialog({
  open,
  onOpenChange,
  clienteAEditar,
}: ClienteFormDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const esEdicion = !!clienteAEditar;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const res = esEdicion
        ? await actualizarCliente(clienteAEditar.id, formData)
        : await crearCliente(formData);

      if (res.error) {
        toast.error(res.error);
        return;
      }

      toast.success(
        esEdicion
          ? "Cliente actualizado correctamente"
          : "Nuevo cliente registrado exitosamente"
      );
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Error inesperado al guardar datos del cliente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary mb-1">
            {esEdicion ? <UserCheck className="size-5" /> : <UserPlus className="size-5" />}
          </div>
          <DialogTitle className="text-center">
            {esEdicion ? "Editar Cliente" : "Registrar Nuevo Cliente"}
          </DialogTitle>
          <DialogDescription className="text-center text-xs">
            {esEdicion
              ? "Modifica los datos personales o de contacto del cliente."
              : "Ingresa los datos del nuevo cliente para control de saldo fiado y ventas."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre completo o Razón Social *</Label>
            <Input
              id="nombre"
              name="nombre"
              placeholder="Ej: Juan Pérez / Comercial Ferretero C.A."
              defaultValue={clienteAEditar?.nombre ?? ""}
              required
              autoFocus
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="identificacion">Cédula / RIF</Label>
              <Input
                id="identificacion"
                name="identificacion"
                placeholder="Ej: V-18234567 / J-30495867-0"
                defaultValue={clienteAEditar?.identificacion ?? ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono / WhatsApp</Label>
              <Input
                id="telefono"
                name="telefono"
                type="tel"
                placeholder="Ej: 0414-1234567"
                defaultValue={clienteAEditar?.telefono ?? ""}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notas">Notas u observaciones</Label>
            <Textarea
              id="notas"
              name="notas"
              placeholder="Dirección, referencias de contacto o límites de crédito..."
              rows={3}
              defaultValue={clienteAEditar?.notas ?? ""}
            />
          </div>

          <DialogFooter className="sm:justify-between gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              {esEdicion ? "Guardar Cambios" : "Registrar Cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
