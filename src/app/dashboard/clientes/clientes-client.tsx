"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Search,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Phone,
  Eye,
  CreditCard,
} from "lucide-react";
import type { Cliente } from "@/lib/types/database";
import { ClienteFormDialog } from "@/components/clientes/cliente-form-dialog";

interface ClientesClientProps {
  clientesIniciales: Cliente[];
  tasaActiva: number;
}

export function ClientesClient({
  clientesIniciales,
  tasaActiva,
}: ClientesClientProps) {
  const [clientes] = useState<Cliente[]>(clientesIniciales);
  const [query, setQuery] = useState("");
  const [nuevoClienteOpen, setNuevoClienteOpen] = useState(false);

  // Filtrado por nombre, identificación o teléfono
  const clientesFiltrados = clientes.filter((c) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return (
      c.nombre.toLowerCase().includes(q) ||
      (c.identificacion && c.identificacion.toLowerCase().includes(q)) ||
      (c.telefono && c.telefono.toLowerCase().includes(q))
    );
  });

  // KPI Calculations
  const totalClientes = clientes.length;
  const clientesConDeuda = clientes.filter((c) => (c.saldo_fiado || 0) > 0);
  const totalDeudaUsd = clientes.reduce((acc, c) => acc + (c.saldo_fiado || 0), 0);
  const totalDeudaBs = totalDeudaUsd * tasaActiva;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes y Fiado</h1>
          <p className="text-sm text-muted-foreground">
            Gestión de clientes registrados, historial de créditos y cuentas por cobrar.
          </p>
        </div>

        <Button onClick={() => setNuevoClienteOpen(true)} className="shrink-0">
          <UserPlus className="mr-2 size-4" /> Nuevo Cliente
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Total Clientes */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <p className="font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Total Clientes
            </p>
            <Users className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-semibold tabular-nums">{totalClientes}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {clientesConDeuda.length} con cuentas pendientes
            </p>
          </CardContent>
        </Card>

        {/* Total Fiado USD */}
        <Card className={totalDeudaUsd > 0 ? "border-amber-300 dark:border-amber-800" : ""}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <p className="font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Por Cobrar (USD)
            </p>
            <DollarSign className="size-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              ${totalDeudaUsd.toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Total fiado acumulado en USD
            </p>
          </CardContent>
        </Card>

        {/* Total Fiado Bs */}
        <Card className={totalDeudaBs > 0 ? "border-amber-300 dark:border-amber-800" : ""}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <p className="font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Por Cobrar (Bs)
            </p>
            <CreditCard className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">
              Bs. {totalDeudaBs.toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              A tasa activa ({tasaActiva.toFixed(2)} Bs/$)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Clientes con Buscador */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Directorio de Clientes</CardTitle>
              <CardDescription>
                Lista completa de clientes con saldo fiado y opciones de cobranza.
              </CardDescription>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar por nombre, C.I. o telf..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {clientesFiltrados.length > 0 ? (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Cédula / RIF</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead className="text-right">Saldo Fiado (USD)</TableHead>
                    <TableHead className="text-right">Saldo Fiado (Bs)</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientesFiltrados.map((c) => {
                    const saldoUsd = c.saldo_fiado || 0;
                    const saldoBs = saldoUsd * tasaActiva;
                    const tieneDeuda = saldoUsd > 0;

                    return (
                      <TableRow key={c.id} className={tieneDeuda ? "bg-amber-50/30 dark:bg-amber-950/10" : ""}>
                        <TableCell>
                          <Link
                            href={`/dashboard/clientes/${c.id}`}
                            className="font-semibold text-foreground hover:underline"
                          >
                            {c.nombre}
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {c.identificacion ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {c.telefono ? (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="size-3" /> {c.telefono}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          <span className={tieneDeuda ? "text-amber-600 dark:text-amber-400 font-bold" : ""}>
                            ${saldoUsd.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          Bs. {saldoBs.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {tieneDeuda ? (
                            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                              <AlertCircle className="mr-1 size-3" /> Deuda pendiente
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                              <CheckCircle2 className="mr-1 size-3" /> Al día
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            render={
                              <Link href={`/dashboard/clientes/${c.id}`} />
                            }
                          >
                            <Eye className="mr-1.5 size-3.5" /> Ver Ficha
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Users className="mx-auto size-10 stroke-[1.25] text-muted-foreground/40 mb-2" />
              <p className="font-medium">No se encontraron clientes</p>
              <p className="text-xs text-muted-foreground mt-1">
                {query ? `Ningún cliente coincide con "${query}"` : "Registra tu primer cliente usando el botón superior."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Nuevo Cliente */}
      {nuevoClienteOpen && (
        <ClienteFormDialog
          open={nuevoClienteOpen}
          onOpenChange={setNuevoClienteOpen}
        />
      )}
    </div>
  );
}
