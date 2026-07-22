"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Power } from "lucide-react";
import { toast } from "sonner";
import { toggleActivoProducto } from "@/app/dashboard/inventario/actions";

export function ToggleActivoButton({
  id,
  activo,
}: {
  id: string;
  activo: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    const confirmed = window.confirm(
      activo
        ? "¿Desactivar este producto? No aparecerá en búsquedas ni en el POS."
        : "¿Reactivar este producto?"
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const result = await toggleActivoProducto(id, !activo);
      if (result.error) {
        toast.error(result.error);
      } else {
        if (activo) {
          toast.warning("Producto desactivado");
        } else {
          toast.success("Producto reactivado");
        }
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant={activo ? "destructive" : "outline"}
      size="sm"
      onClick={handleToggle}
      disabled={loading}
    >
      <Power className="size-4" />
      {activo ? "Desactivar" : "Reactivar"}
    </Button>
  );
}
