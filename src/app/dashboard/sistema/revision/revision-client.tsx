"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  Flag,
  Loader2,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { formatUSD, formatBs } from "@/lib/formatters";
import type {
  MetodoPago,
  ResultadoRevision,
  RevisionAutorizacion,
} from "@/lib/types/database";
import { revisarAutorizacionOffline } from "./actions";

export interface VentaOffline {
  id: string;
  fecha: string;
  total_usd: number;
  total_bs: number;
  metodo_pago: MetodoPago;
  motivos_autorizacion: string[] | null;
  cliente_nombre: string | null;
  revision: RevisionAutorizacion | null;
}

interface RevisionClientProps {
  pendientes: VentaOffline[];
  revisadas: VentaOffline[];
  errorCarga: string | null;
}

function formatFechaHora(iso: string) {
  return new Date(iso).toLocaleString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Montos({ usd, bs }: { usd: number; bs: number }) {
  return (
    <div className="whitespace-nowrap">
      <span className="font-medium">{formatUSD(usd)}</span>
      <span className="ml-2 text-xs text-muted-foreground">{formatBs(bs)}</span>
    </div>
  );
}

export function RevisionClient({
  pendientes,
  revisadas,
  errorCarga,
}: RevisionClientProps) {
  const router = useRouter();
  const [ventaEnRevision, setVentaEnRevision] = useState<VentaOffline | null>(
    null
  );
  const [resultado, setResultado] = useState<ResultadoRevision>("confirmada");
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);

  function abrirDialogo(venta: VentaOffline) {
    setVentaEnRevision(venta);
    setResultado("confirmada");
    setNotas("");
  }

  async function confirmar() {
    if (!ventaEnRevision) return;

    setGuardando(true);
    try {
      const res = await revisarAutorizacionOffline(
        ventaEnRevision.id,
        resultado,
        notas.trim() || null
      );

      if (res.error) {
        toast.error(res.error);
        return;
      }

      toast.success(
        resultado === "confirmada"
          ? "Venta confirmada como legítima."
          : "Venta marcada como irregular."
      );
      setVentaEnRevision(null);
      router.refresh();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
            <ClipboardCheck className="size-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Revisión de autorizaciones offline
            </h1>
            <p className="text-sm text-muted-foreground">
              Ventas que se completaron sin conexión y sin un administrador que
              las autorizara en el momento.
            </p>
          </div>
        </div>
        {pendientes.length > 0 && (
          <Badge variant="destructive">
            {pendientes.length} pendiente{pendientes.length === 1 ? "" : "s"}
          </Badge>
        )}
      </header>

      {errorCarga && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-destructive">
              No se pudo cargar la cola de revisión.
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

      {/* Pendientes */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Pendientes de revisión</h2>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Motivos</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendientes.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    <WifiOff className="mx-auto mb-2 size-5 opacity-40" />
                    No hay ventas offline pendientes de revisión.
                  </TableCell>
                </TableRow>
              ) : (
                pendientes.map((venta) => (
                  <TableRow key={venta.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {formatFechaHora(venta.fecha)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {venta.cliente_nombre ?? (
                        <span className="text-muted-foreground">
                          Contado sin cliente
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Montos usd={venta.total_usd} bs={venta.total_bs} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(venta.motivos_autorizacion ?? []).length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          venta.motivos_autorizacion?.map((motivo) => (
                            <Badge
                              key={motivo}
                              variant="secondary"
                              className="text-[10px]"
                            >
                              {motivo}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => abrirDialogo(venta)}>
                        Revisar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Ya revisadas */}
      {revisadas.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Ya revisadas</h2>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Fecha venta</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Dictamen</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="whitespace-nowrap">Revisada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revisadas.map((venta) => (
                  <TableRow key={venta.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {formatFechaHora(venta.fecha)}
                    </TableCell>
                    <TableCell>
                      <Montos usd={venta.total_usd} bs={venta.total_bs} />
                    </TableCell>
                    <TableCell>
                      {venta.revision?.resultado === "confirmada" ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="size-3.5" />
                          Confirmada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
                          <Flag className="size-3.5" />
                          Irregular
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs text-sm text-muted-foreground">
                      {venta.revision?.notas ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                      {venta.revision
                        ? formatFechaHora(venta.revision.created_at)
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* Diálogo de dictamen */}
      <Dialog
        open={ventaEnRevision !== null}
        onOpenChange={(abierto) => {
          if (!abierto && !guardando) setVentaEnRevision(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Revisar autorización offline</DialogTitle>
            <DialogDescription>
              {ventaEnRevision && (
                <>
                  Venta del {formatFechaHora(ventaEnRevision.fecha)} por{" "}
                  {formatUSD(ventaEnRevision.total_usd)} /{" "}
                  {formatBs(ventaEnRevision.total_bs)}. El dictamen queda
                  registrado con tu usuario y no se puede modificar después.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Dictamen</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setResultado("confirmada")}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    resultado === "confirmada"
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                      : "hover:bg-muted/40"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                    Confirmada
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    La excepción era legítima.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setResultado("irregular")}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    resultado === "irregular"
                      ? "border-destructive bg-destructive/5"
                      : "hover:bg-muted/40"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Flag className="size-4 text-destructive" />
                    Irregular
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Requiere seguimiento.
                  </span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notas-revision">
                Notas{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </Label>
              <Textarea
                id="notas-revision"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Qué se verificó, con quién se habló, qué se decidió…"
              />
            </div>
          </div>

          <DialogFooter className="sm:justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={guardando}
              onClick={() => setVentaEnRevision(null)}
            >
              Cancelar
            </Button>
            <Button type="button" disabled={guardando} onClick={confirmar}>
              {guardando && <Loader2 className="mr-2 size-4 animate-spin" />}
              Registrar dictamen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
