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
import { Lock, ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { autorizarVentaAdmin } from "@/app/dashboard/pos/actions";

interface AdminAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAutorizado: () => void;
}

export function AdminAuthDialog({
  open,
  onOpenChange,
  onAutorizado,
}: AdminAuthDialogProps) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError(null);

    try {
      const res = await autorizarVentaAdmin(password);
      if (res.error) {
        setError(res.error);
        return;
      }

      toast.success("Autorización de Administrador concedida.");
      setPassword("");
      onOpenChange(false);
      onAutorizado();
    } catch {
      setError("Error inesperado al verificar autorización.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/60 mb-2">
            <ShieldAlert className="size-6 text-amber-600 dark:text-amber-400" />
          </div>
          <DialogTitle className="text-center">Autorización de Administrador</DialogTitle>
          <DialogDescription className="text-center text-xs">
            Esta venta contiene uno o más productos con stock insuficiente. Ingresa la contraseña de un Administrador para autorizar el descuento y permitir stock negativo auditado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleVerify} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="admin-password">Contraseña del Administrador</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="admin-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9"
                autoFocus
                required
              />
            </div>
            {error && (
              <p className="text-xs text-destructive font-medium">{error}</p>
            )}
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
            <Button type="submit" disabled={loading || !password}>
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Autorizar Venta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
