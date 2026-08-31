"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ShieldCheck, Lock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { Permiso, RolUsuario } from "@/lib/types/database";
import { configurarPermiso } from "./actions";

/**
 * Roles en el mismo orden del enum en BD: de mayor a menor privilegio.
 */
const ROLES: { valor: RolUsuario; etiqueta: string; nota: string }[] = [
  {
    valor: "desarrollador",
    etiqueta: "Desarrollador",
    nota: "Proveedor del servicio. Siempre tiene todo; no se le puede retirar nada.",
  },
  { valor: "admin", etiqueta: "Admin", nota: "Dueño o encargado del negocio." },
  { valor: "cajero", etiqueta: "Cajero", nota: "Operador de mostrador." },
];

/**
 * Espejo del kernel de `asignar_permiso` (migración 00028), solo para
 * deshabilitar controles que la RPC va a rechazar. Es cortesía visual: la
 * autoridad es la función en la base de datos, que rechaza igual aunque
 * alguien manipule la petición saltándose esta UI.
 */
const CRITICOS_AUTORIZACION = [
  "ventas.autorizar_stock_negativo",
  "ventas.autorizar_descuento",
  "ventas.anular",
];

const CRITICOS_SISTEMA = ["sistema.gestionar_usuarios", "sistema.asignar_roles"];

/**
 * Devuelve el motivo por el que el kernel rechazaría este cambio, o null si
 * lo aceptaría. Replica las reglas (c), (d) y (e) de la RPC.
 */
function motivoDeBloqueo(
  rol: RolUsuario,
  codigo: string,
  activoActual: boolean
): string | null {
  // (e) Anti-lockout: al desarrollador no se le retira nada.
  if (rol === "desarrollador") {
    return "El rol desarrollador conserva todos los permisos: es el ancla de confianza del sistema.";
  }

  // El kernel solo rechaza al OTORGAR. Revocar un permiso ya activo se permite.
  const esOtorgamiento = !activoActual;
  if (!esOtorgamiento) return null;

  // (d) Permisos de sistema: exclusivos del desarrollador.
  if (CRITICOS_SISTEMA.includes(codigo)) {
    return "Permiso exclusivo del rol desarrollador.";
  }

  // (c) Autorización de excepciones: nunca a un rol operativo.
  if (CRITICOS_AUTORIZACION.includes(codigo) && rol !== "admin") {
    return "Permiso crítico: solo puede asignarse a admin o desarrollador. Un cajero que se autoriza a sí mismo destruye la separación de funciones.";
  }

  return null;
}

interface PermisosClientProps {
  permisos: Permiso[];
  asignaciones: { rol: RolUsuario; permiso_codigo: string }[];
  errorCarga: string | null;
}

/** Clave de celda en el set de asignaciones. */
const clave = (rol: RolUsuario, codigo: string) => `${rol}::${codigo}`;

export function PermisosClient({
  permisos,
  asignaciones,
  errorCarga,
}: PermisosClientProps) {
  const router = useRouter();

  const [activos, setActivos] = useState<Set<string>>(
    () => new Set(asignaciones.map((a) => clave(a.rol, a.permiso_codigo)))
  );
  const [guardando, setGuardando] = useState<string | null>(null);

  const grupos = useMemo(() => {
    const mapa = new Map<string, Permiso[]>();
    for (const permiso of permisos) {
      const lista = mapa.get(permiso.grupo) ?? [];
      lista.push(permiso);
      mapa.set(permiso.grupo, lista);
    }
    return [...mapa.entries()];
  }, [permisos]);

  async function alternar(rol: RolUsuario, permiso: Permiso, siguiente: boolean) {
    const celda = clave(rol, permiso.codigo);
    setGuardando(celda);

    // Optimista: el switch responde de inmediato y se revierte si el kernel
    // rechaza. Una acción que parece no hacer nada invita a repetirla.
    setActivos((prev) => {
      const copia = new Set(prev);
      if (siguiente) copia.add(celda);
      else copia.delete(celda);
      return copia;
    });

    try {
      const resultado = await configurarPermiso(rol, permiso.codigo, siguiente);

      if (resultado.error) {
        setActivos((prev) => {
          const copia = new Set(prev);
          if (siguiente) copia.delete(celda);
          else copia.add(celda);
          return copia;
        });
        toast.error(resultado.error);
        return;
      }

      toast.success(
        siguiente
          ? `Permiso otorgado a ${rol}: ${permiso.descripcion}`
          : `Permiso revocado a ${rol}: ${permiso.descripcion}`
      );
      router.refresh();
    } finally {
      setGuardando(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
          <ShieldCheck className="size-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Matriz de permisos
          </h1>
          <p className="text-sm text-muted-foreground">
            Qué puede hacer cada rol. Los cambios aplican de inmediato a todos
            los usuarios de ese rol.
          </p>
        </div>
      </header>

      {errorCarga && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-destructive">
              No se pudo cargar la matriz de permisos.
            </p>
            <p className="text-muted-foreground">{errorCarga}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => router.refresh()}
            >
              Reintentar
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        {ROLES.map((rol) => (
          <div key={rol.valor} className="rounded-lg border bg-card p-3">
            <p className="text-sm font-medium">{rol.etiqueta}</p>
            <p className="mt-1 text-xs text-muted-foreground">{rol.nota}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[640px] caption-bottom text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-4 py-3 text-left font-medium">Permiso</th>
              {ROLES.map((rol) => (
                <th
                  key={rol.valor}
                  className="w-32 px-4 py-3 text-center font-medium"
                >
                  {rol.etiqueta}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grupos.length === 0 ? (
              <tr>
                <td
                  colSpan={ROLES.length + 1}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  El catálogo de permisos está vacío. Verifica que la migración
                  00026 se haya aplicado en este proyecto.
                </td>
              </tr>
            ) : (
              grupos.map(([grupo, permisosDelGrupo]) => (
                <Fragment key={grupo}>
                  <tr className="border-b bg-muted/20">
                    <td
                      colSpan={ROLES.length + 1}
                      className="px-4 py-2 font-mono text-[10px] font-medium uppercase tracking-widest text-muted-foreground"
                    >
                      {grupo}
                    </td>
                  </tr>
                  {permisosDelGrupo.map((permiso) => (
                    <tr
                      key={permiso.codigo}
                      className="border-b last:border-0 hover:bg-muted/20"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {permiso.descripcion}
                          </span>
                          {permiso.es_critico && (
                            <Badge variant="destructive" className="text-[10px]">
                              Crítico
                            </Badge>
                          )}
                        </div>
                        <code className="text-xs text-muted-foreground">
                          {permiso.codigo}
                        </code>
                      </td>

                      {ROLES.map((rol) => {
                        const celda = clave(rol.valor, permiso.codigo);
                        const activo = activos.has(celda);
                        const bloqueo = motivoDeBloqueo(
                          rol.valor,
                          permiso.codigo,
                          activo
                        );

                        return (
                          <td key={rol.valor} className="px-4 py-3">
                            <div className="flex justify-center">
                              {bloqueo ? (
                                <span
                                  title={bloqueo}
                                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                                >
                                  <Lock className="size-3.5" />
                                  {activo ? "Siempre" : "No permitido"}
                                </span>
                              ) : (
                                <Switch
                                  checked={activo}
                                  disabled={guardando === celda}
                                  aria-label={`${permiso.descripcion} para ${rol.etiqueta}`}
                                  onCheckedChange={(siguiente) =>
                                    alternar(rol.valor, permiso, siguiente)
                                  }
                                />
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Los controles bloqueados son una cortesía visual. La autoridad es la
        función <code>asignar_permiso</code> en la base de datos, que rechaza
        estas combinaciones aunque la petición se envíe saltándose esta
        pantalla.
      </p>
    </div>
  );
}
