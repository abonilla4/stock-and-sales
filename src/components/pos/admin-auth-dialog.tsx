"use client";

import { useState } from "react";
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
import { Lock, Mail, ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { autorizarVentaAdmin } from "@/app/dashboard/pos/actions";
import type { PermisoAutorizacion } from "@/lib/schemas/actions-schemas";

interface AdminAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAutorizado: (adminUserId: string) => void;
  motivo?: string;
  /**
   * Permisos que el autorizador debe tener TODOS. Los decide quien abre el
   * diálogo según el motivo real de la excepción: una venta con stock
   * insuficiente y descuento excesivo exige los dos.
   */
  permisosRequeridos: PermisoAutorizacion[];
}

export function AdminAuthDialog({
  open,
  onOpenChange,
  onAutorizado,
  motivo,
  permisosRequeridos,
}: AdminAuthDialogProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    setError(null);

    try {
      const res = await autorizarVentaAdmin(
        email.trim(),
        password,
        permisosRequeridos
      );
      if (res.error) {
        setError(res.error);
        // La contraseña se limpia siempre; el correo se conserva porque
        // reescribirlo en cada reintento no aporta seguridad y sí fricción.
        setPassword("");
        return;
      }

      if (!res.adminUserId) {
        setError("Error inesperado: no se obtuvo el ID del administrador.");
        return;
      }

      toast.success("Autorización de Administrador concedida.");
      setEmail("");
      setPassword("");
      onOpenChange(false);
      onAutorizado(res.adminUserId);
    } catch {
      setError("Error inesperado al verificar autorización.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal={true}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/60 mb-2">
            <ShieldAlert className="size-6 text-amber-600 dark:text-amber-400" />
          </div>
          <DialogTitle className="text-center">Autorización de Administrador</DialogTitle>
          <DialogDescription className="text-center text-xs">
            {motivo ?? "Esta venta contiene excepciones (descuento superior al 5% o stock insuficiente). Un Administrador debe ingresar sus credenciales para autorizar la operación."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleVerify} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="admin-email">Correo del Administrador</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="admin-email"
                type="email"
                inputMode="email"
                autoComplete="off"
                placeholder="admin@negocio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
                autoFocus
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-password">Contraseña del Administrador</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="admin-password"
                type="password"
                autoComplete="off"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9"
                required
              />
            </div>
            {error && (
              <p className="text-xs text-destructive font-medium">{error}</p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Tu sesión no cambia: el Administrador autoriza esta venta sin
            desplazarte de la caja.
          </p>

          <DialogFooter className="sm:justify-between gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !email.trim() || !password}>
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Autorizar Venta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
