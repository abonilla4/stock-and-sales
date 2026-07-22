"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  User,
  Phone,
  FileText,
  DollarSign,
  Plus,
  Edit,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  History,
  ShoppingCart,
} from "lucide-react";
import type { Cliente, Venta, PagoFiado, MetodoPago } from "@/lib/types/database";
import { AbonoDialog } from "@/components/clientes/abono-dialog";
import { ClienteFormDialog } from "@/components/clientes/cliente-form-dialog";

interface ClienteDetalleClientProps {
  cliente: Cliente;
  ventas: Venta[];
  abonos: PagoFiado[];
  tasaActiva: number;
}

const METODOS_PAGO_LABELS: Record<MetodoPago, string> = {
  efectivo_usd: "Efectivo USD",
  efectivo_bs: "Efectivo Bs",
  pago_movil: "Pago Móvil",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  fiado: "Crédito",
};

export function ClienteDetalleClient({
  cliente,
  ventas,
  abonos,
  tasaActiva,
}: ClienteDetalleClientProps) {
  const [abonoOpen, setAbonoOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const saldoUsd = Number((cliente.saldo_fiado || 0).toFixed(2));
  const saldoBs = Number((saldoUsd * tasaActiva).toFixed(2));
  const tieneDeuda = saldoUsd > 0;

  return (
    <div className="space-y-6">
      {/* Botón Volver */}
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/dashboard/clientes" />}>
          <ArrowLeft className="mr-1.5 size-4" /> Volver a Clientes
        </Button>
      </div>

      {/* Header Ficha del Cliente */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div className="flex items-start gap-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
            <User className="size-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{cliente.nombre}</h1>
              {tieneDeuda ? (
                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  <AlertCircle className="mr-1 size-3" /> Deuda pendiente
                </Badge>
              ) : (
                <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <CheckCircle2 className="mr-1 size-3" /> Al día
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {cliente.identificacion && (
                <span className="font-mono">C.I. / RIF: {cliente.identificacion}</span>
              )}
              {cliente.telefono && (
                <span className="flex items-center gap-1">
                  <Phone className="size-3" /> {cliente.telefono}
                </span>
              )}
            </div>
            {cliente.notas && (
              <p className="text-xs text-muted-foreground pt-1 italic">
                "{cliente.notas}"
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Edit className="mr-1.5 size-3.5" /> Editar Datos
          </Button>

          <Button size="sm" onClick={() => setAbonoOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="mr-1.5 size-4" /> Registrar Abono
          </Button>
        </div>
      </div>

      {/* Hero Card: Saldo Pendiente Acumulado */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className={tieneDeuda ? "border-amber-300 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/20" : "border-emerald-300 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono font-medium uppercase tracking-widest text-muted-foreground">
              Saldo Pendiente a Crédito
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-extrabold tracking-tight ${tieneDeuda ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                ${saldoUsd.toFixed(2)}
              </span>
              <span className="text-lg font-semibold text-muted-foreground">USD</span>
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              Equivalente: <strong className="text-foreground">Bs. {saldoBs.toFixed(2)}</strong> (Tasa: {tasaActiva.toFixed(2)} Bs/$)
            </p>
          </CardContent>
        </Card>

        {/* Resumen de actividad */}
        <Card className="flex flex-col justify-center p-6 bg-card">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <span className="text-xs text-muted-foreground block">Ventas Registradas</span>
              <span className="text-2xl font-bold font-mono">{ventas.length}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Abonos Realizados</span>
              <span className="text-2xl font-bold font-mono">{abonos.length}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Pestañas de Historial */}
      <Tabs defaultValue="abonos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="abonos" className="flex items-center gap-1.5">
            <History className="size-4" /> Historial de Abonos ({abonos.length})
          </TabsTrigger>
          <TabsTrigger value="ventas" className="flex items-center gap-1.5">
            <ShoppingCart className="size-4" /> Historial de Ventas ({ventas.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Historial de Abonos / Pagos */}
        <TabsContent value="abonos">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Pagos y Abonos Recibidos</CardTitle>
              <CardDescription>
                Registro histórico de todos los abonos realizados por el cliente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {abonos.length > 0 ? (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha y hora</TableHead>
                        <TableHead>Método de Pago</TableHead>
                        <TableHead className="text-right">Monto (USD)</TableHead>
                        <TableHead className="text-right">Monto (Bs)</TableHead>
                        <TableHead>Notas / Referencia</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {abonos.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-sm">
                            {new Date(a.fecha).toLocaleString("es-VE", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize text-xs">
                              {METODOS_PAGO_LABELS[a.metodo_pago] ?? a.metodo_pago}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            +${Number(a.monto_usd).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            {a.monto_bs ? `Bs. ${Number(a.monto_bs).toFixed(2)}` : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground italic">
                            {a.notas ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Este cliente no ha registrado abonos aún.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Historial de Ventas */}
        <TabsContent value="ventas">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Ventas Asociadas</CardTitle>
              <CardDescription>
                Historial de compras realizadas por este cliente en el sistema.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ventas.length > 0 ? (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Folio / ID</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Método de Pago</TableHead>
                        <TableHead className="text-right">Tasa Snapshot</TableHead>
                        <TableHead className="text-right">Total USD</TableHead>
                        <TableHead className="text-right">Total Bs</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ventas.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell className="font-mono text-xs font-semibold">
                            {v.id.substring(0, 8).toUpperCase()}
                          </TableCell>
                          <TableCell className="text-xs">
                            {new Date(v.fecha).toLocaleString("es-VE", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={v.metodo_pago === "fiado" ? "secondary" : "outline"}
                              className={v.metodo_pago === "fiado" ? "border-amber-300 bg-amber-50 text-amber-800" : ""}
                            >
                              {METODOS_PAGO_LABELS[v.metodo_pago] ?? v.metodo_pago}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            Bs. {Number(v.tasa_cambio_aplicada).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold">
                            ${Number(v.total_usd).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            Bs. {Number(v.total_bs).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No hay ventas registradas para este cliente.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de Abono */}
      {abonoOpen && (
        <AbonoDialog
          open={abonoOpen}
          onOpenChange={setAbonoOpen}
          cliente={cliente}
          tasaActiva={tasaActiva}
        />
      )}

      {/* Modal de Edición de Cliente */}
      {editOpen && (
        <ClienteFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          clienteAEditar={cliente}
        />
      )}
    </div>
  );
}
