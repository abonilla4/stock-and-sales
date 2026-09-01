"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  UserPlus,
  Loader2,
  AlertTriangle,
  ShieldCheck,
  Ban,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import {
  ROLES_ASIGNABLES,
  MIN_LONGITUD_PASSWORD,
} from "@/lib/schemas/actions-schemas";
import type { RolUsuario, UsuarioListado } from "@/lib/types/database";
import {
  crearUsuario,
  cambiarRolUsuario,
  cambiarEstadoUsuario,
} from "./actions";

const ETIQUETA_ROL: Record<RolUsuario, string> = {
  desarrollador: "Desarrollador",
  admin: "Admin",
  cajero: "Cajero",
};

interface UsuariosClientProps {
  usuarios: UsuarioListado[];
  usuarioActualId: string | null;
  errorCarga: string | null;
}

function formatFecha(iso: string | null) {
  if (!iso) return "Nunca";
  return new Date(iso).toLocaleString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Una fecha de baneo en el futuro es lo que Auth entiende por "desactivado". */
function estaActivo(usuario: UsuarioListado) {
  if (!usuario.banned_until) return true;
  return new Date(usuario.banned_until).getTime() <= Date.now();
}

export function UsuariosClient({
  usuarios,
  usuarioActualId,
  errorCarga,
}: UsuariosClientProps) {
  const router = useRouter();

  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rolNuevo, setRolNuevo] = useState<RolUsuario>("cajero");
  const [creando, setCreando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);

  const [filaOcupada, setFilaOcupada] = useState<string | null>(null);

  function abrirDialogo() {
    setEmail("");
    setPassword("");
    setRolNuevo("cajero");
    setErrorFormulario(null);
    setDialogoAbierto(true);
  }

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault();
    setErrorFormulario(null);

    if (!email.trim()) {
      setErrorFormulario("El correo electrónico es obligatorio.");
      return;
    }
    if (password.length < MIN_LONGITUD_PASSWORD) {
      setErrorFormulario(
        `La contraseña debe tener al menos ${MIN_LONGITUD_PASSWORD} caracteres.`
      );
      return;
    }

    setCreando(true);
    try {
      const res = await crearUsuario(email.trim(), password, rolNuevo);
      if (res.error) {
        setErrorFormulario(res.error);
        return;
      }
      toast.success(`Usuario ${email.trim()} creado como ${ETIQUETA_ROL[rolNuevo]}.`);
      // La operación ya ocurrió en Auth; si no quedó auditada hay que decirlo,
      // no dejarlo solo en los logs del servidor.
      if (res.advertencia) toast.warning(res.advertencia, { duration: 12000 });
      setDialogoAbierto(false);
      router.refresh();
    } finally {
      setCreando(false);
    }
  }

  async function handleCambiarRol(usuario: UsuarioListado, rol: RolUsuario) {
    setFilaOcupada(usuario.id);
    try {
      const res = await cambiarRolUsuario(usuario.id, rol);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${usuario.email} ahora es ${ETIQUETA_ROL[rol]}.`);
      router.refresh();
    } finally {
      setFilaOcupada(null);
    }
  }

  async function handleCambiarEstado(usuario: UsuarioListado, activar: boolean) {
    if (
      !activar &&
      !window.confirm(
        `¿Desactivar a ${usuario.email}? No podrá iniciar sesión hasta que lo reactives.`
      )
    ) {
      return;
    }

    setFilaOcupada(usuario.id);
    try {
      const res = await cambiarEstadoUsuario(usuario.id, activar);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        activar ? `${usuario.email} reactivado.` : `${usuario.email} desactivado.`
      );
      if (res.advertencia) toast.warning(res.advertencia, { duration: 12000 });
      router.refresh();
    } finally {
      setFilaOcupada(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
            <Users className="size-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Usuarios</h1>
            <p className="text-sm text-muted-foreground">
              Altas, roles y desactivación de cuentas.
            </p>
          </div>
        </div>
        <Button onClick={abrirDialogo}>
          <UserPlus className="mr-2 size-4" />
          Nuevo usuario
        </Button>
      </header>

      {errorCarga && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-destructive">
              No se pudo cargar la lista de usuarios.
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

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Correo</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="whitespace-nowrap">Último acceso</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.length === 0 && !errorCarga ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No hay usuarios para mostrar.
                </TableCell>
              </TableRow>
            ) : (
              usuarios.map((usuario) => {
                const activo = estaActivo(usuario);
                const esDesarrollador = usuario.role === "desarrollador";
                const esYo = usuario.id === usuarioActualId;
                const ocupada = filaOcupada === usuario.id;

                return (
                  <TableRow key={usuario.id}>
                    <TableCell className="text-sm font-medium">
                      {usuario.email}
                      {esYo && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          (tú)
                        </span>
                      )}
                    </TableCell>

                    <TableCell>
                      {esDesarrollador || esYo ? (
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          {esDesarrollador && (
                            <ShieldCheck className="size-3.5 text-muted-foreground" />
                          )}
                          {ETIQUETA_ROL[usuario.role]}
                        </span>
                      ) : (
                        <Select
                          value={usuario.role}
                          disabled={ocupada}
                          onValueChange={(v) =>
                            v && handleCambiarRol(usuario, v as RolUsuario)
                          }
                        >
                          <SelectTrigger className="h-8 w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES_ASIGNABLES.map((rol) => (
                              <SelectItem key={rol} value={rol}>
                                {ETIQUETA_ROL[rol]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>

                    <TableCell>
                      {activo ? (
                        <Badge variant="secondary">Activo</Badge>
                      ) : (
                        <Badge variant="destructive">Desactivado</Badge>
                      )}
                    </TableCell>

                    <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                      {formatFecha(usuario.last_sign_in_at)}
                    </TableCell>

                    <TableCell className="text-right">
                      {esDesarrollador || esYo ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={ocupada}
                          onClick={() => handleCambiarEstado(usuario, !activo)}
                        >
                          {ocupada ? (
                            <Loader2 className="mr-2 size-3.5 animate-spin" />
                          ) : activo ? (
                            <Ban className="mr-2 size-3.5" />
                          ) : (
                            <RotateCcw className="mr-2 size-3.5" />
                          )}
                          {activo ? "Desactivar" : "Reactivar"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        El rol <strong>desarrollador</strong> no se asigna ni se retira desde
        aquí: solo por SQL directo sobre el proyecto. Es el ancla de confianza
        del modelo de permisos.
      </p>

      <Dialog
        open={dialogoAbierto}
        onOpenChange={(abierto) => {
          if (!abierto && !creando) setDialogoAbierto(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
            <DialogDescription>
              La cuenta queda confirmada y lista para iniciar sesión de
              inmediato. Comparte la contraseña por un canal seguro.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCrear} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="nuevo-email">Correo electrónico</Label>
              <Input
                id="nuevo-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cajero@negocio.com"
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nuevo-password">Contraseña</Label>
              <Input
                id="nuevo-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={MIN_LONGITUD_PASSWORD}
                required
              />
              <p className="text-xs text-muted-foreground">
                Mínimo {MIN_LONGITUD_PASSWORD} caracteres.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nuevo-rol">Rol</Label>
              <Select
                value={rolNuevo}
                onValueChange={(v) => v && setRolNuevo(v as RolUsuario)}
              >
                <SelectTrigger id="nuevo-rol" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES_ASIGNABLES.map((rol) => (
                    <SelectItem key={rol} value={rol}>
                      {ETIQUETA_ROL[rol]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {errorFormulario && (
              <p className="text-xs font-medium text-destructive">
                {errorFormulario}
              </p>
            )}

            <DialogFooter className="sm:justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={creando}
                onClick={() => setDialogoAbierto(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={creando}>
                {creando && <Loader2 className="mr-2 size-4 animate-spin" />}
                Crear usuario
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
