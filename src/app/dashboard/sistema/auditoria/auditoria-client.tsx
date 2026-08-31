"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  ScrollText,
  Search,
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { RegistroAuditoria } from "@/lib/types/database";

const TODAS = "__todas__";

interface Filtros {
  accion: string;
  exito: "todos" | "exitosos" | "fallidos";
  desde: string;
  hasta: string;
}

interface AuditoriaClientProps {
  eventos: RegistroAuditoria[];
  accionesDisponibles: string[];
  total: number;
  pagina: number;
  filasPorPagina: number;
  filtros: Filtros;
  errorCarga: string | null;
}

function formatFechaHora(iso: string) {
  return new Date(iso).toLocaleString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** `ROL_ASIGNADO` → `Rol asignado`. Legible sin perder el código original. */
function etiquetaAccion(accion: string) {
  const texto = accion.replace(/_/g, " ").toLowerCase();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function AuditoriaClient({
  eventos,
  accionesDisponibles,
  total,
  pagina,
  filasPorPagina,
  filtros,
  errorCarga,
}: AuditoriaClientProps) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [borrador, setBorrador] = useState<Filtros>(filtros);

  const hayFiltrosActivos =
    borrador.accion !== "" ||
    borrador.exito !== "todos" ||
    borrador.desde !== "" ||
    borrador.hasta !== "";

  const totalPaginas = Math.max(1, Math.ceil(total / filasPorPagina));

  function navegar(siguientes: Filtros, paginaDestino: number) {
    const params = new URLSearchParams();
    if (siguientes.accion) params.set("accion", siguientes.accion);
    if (siguientes.exito !== "todos") params.set("exito", siguientes.exito);
    if (siguientes.desde) params.set("desde", siguientes.desde);
    if (siguientes.hasta) params.set("hasta", siguientes.hasta);
    if (paginaDestino > 1) params.set("pagina", String(paginaDestino));

    const query = params.toString();
    startTransition(() => {
      router.push(`/dashboard/sistema/auditoria${query ? `?${query}` : ""}`);
    });
  }

  function aplicarFiltros() {
    // Cualquier cambio de filtro vuelve a la primera página: mantener la
    // página anterior mostraría un vacío engañoso.
    navegar(borrador, 1);
  }

  function limpiarFiltros() {
    const vacios: Filtros = {
      accion: "",
      exito: "todos",
      desde: "",
      hasta: "",
    };
    setBorrador(vacios);
    navegar(vacios, 1);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
            <ScrollText className="size-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Registro de auditoría
            </h1>
            <p className="text-sm text-muted-foreground">
              Eventos de autorización y cambios de permisos del sistema.
            </p>
          </div>
        </div>
        <Badge variant="secondary">
          {total} {total === 1 ? "evento" : "eventos"}
        </Badge>
      </header>

      {/* Filtros */}
      <div className="rounded-lg border bg-card p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="filtro-accion">Acción</Label>
            <Select
              value={borrador.accion === "" ? TODAS : borrador.accion}
              onValueChange={(v) =>
                setBorrador((prev) => ({
                  ...prev,
                  accion: !v || v === TODAS ? "" : v,
                }))
              }
            >
              <SelectTrigger id="filtro-accion" className="w-full">
                <SelectValue placeholder="Todas las acciones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS}>Todas las acciones</SelectItem>
                {accionesDisponibles.map((a) => (
                  <SelectItem key={a} value={a}>
                    {etiquetaAccion(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="filtro-resultado">Resultado</Label>
            <Select
              value={borrador.exito}
              onValueChange={(v) =>
                setBorrador((prev) => ({
                  ...prev,
                  exito: (v ?? "todos") as Filtros["exito"],
                }))
              }
            >
              <SelectTrigger id="filtro-resultado" className="w-full">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="exitosos">Solo exitosos</SelectItem>
                <SelectItem value="fallidos">Solo fallidos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="filtro-desde">Desde</Label>
            <Input
              id="filtro-desde"
              type="date"
              value={borrador.desde}
              max={borrador.hasta || undefined}
              onChange={(e) =>
                setBorrador((prev) => ({ ...prev, desde: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="filtro-hasta">Hasta</Label>
            <Input
              id="filtro-hasta"
              type="date"
              value={borrador.hasta}
              min={borrador.desde || undefined}
              onChange={(e) =>
                setBorrador((prev) => ({ ...prev, hasta: e.target.value }))
              }
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={aplicarFiltros} disabled={pendiente} size="sm">
            <Search className="mr-2 size-4" />
            Aplicar filtros
          </Button>
          {hayFiltrosActivos && (
            <Button
              onClick={limpiarFiltros}
              disabled={pendiente}
              variant="outline"
              size="sm"
            >
              <X className="mr-2 size-4" />
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {errorCarga && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-destructive">
              No se pudo cargar el registro de auditoría.
            </p>
            <p className="text-muted-foreground">{errorCarga}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => startTransition(() => router.refresh())}
            >
              Reintentar
            </Button>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Fecha</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Resultado</TableHead>
              <TableHead>Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {eventos.length === 0 && !errorCarga ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  {hayFiltrosActivos
                    ? "Ningún evento coincide con estos filtros — prueba ampliando el rango de fechas."
                    : "Aún no hay eventos registrados. Aparecerán aquí cuando se autorice una excepción o se configure un permiso."}
                </TableCell>
              </TableRow>
            ) : (
              eventos.map((evento) => (
                <TableRow key={evento.id}>
                  <TableCell className="whitespace-nowrap font-mono text-xs">
                    {formatFechaHora(evento.created_at)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {evento.email ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {etiquetaAccion(evento.accion)}
                  </TableCell>
                  <TableCell>
                    {evento.exito ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="size-3.5" />
                        Exitoso
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
                        <XCircle className="size-3.5" />
                        Fallido
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-md text-sm text-muted-foreground">
                    {evento.detalle ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Página {pagina} de {totalPaginas}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagina <= 1 || pendiente}
              onClick={() => navegar(borrador, pagina - 1)}
            >
              <ChevronLeft className="mr-1 size-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagina >= totalPaginas || pendiente}
              onClick={() => navegar(borrador, pagina + 1)}
            >
              Siguiente
              <ChevronRight className="ml-1 size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
