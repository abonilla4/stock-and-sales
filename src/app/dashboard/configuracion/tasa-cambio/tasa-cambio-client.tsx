"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign, Clock, CheckCircle2, History, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { TasaCambio } from "@/lib/types/database";
import { registrarTasaCambio } from "./actions";

interface TasaCambioClientProps {
  tasaActiva: TasaCambio | null;
  historial: TasaCambio[];
  isAdmin: boolean;
}

export function TasaCambioClient({
  tasaActiva,
  historial,
  isAdmin,
}: TasaCambioClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [nuevaTasa, setNuevaTasa] = useState("");

  const fechaActiva = tasaActiva ? new Date(tasaActiva.fecha) : null;
  const horasTranscurridas = fechaActiva
    ? (new Date().getTime() - fechaActiva.getTime()) / (1000 * 60 * 60)
    : null;
  const esDesactualizada = horasTranscurridas !== null && horasTranscurridas >= 24;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const res = await registrarTasaCambio(formData);

      if (res.error) {
        toast.error(res.error);
        return;
      }

      toast.success("Nueva tasa de cambio registrada correctamente");
      setNuevaTasa("");
      router.refresh();
    } catch {
      toast.error("Error inesperado al registrar la tasa.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tasa de cambio (USD / Bs)</h1>
        <p className="text-sm text-muted-foreground">
          Gestión manual de la tasa del día. El histórico es acumulativo y cada venta guarda un snapshot congelado.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Tarjeta 1: Tasa Activa Actual */}
        <Card className={esDesactualizada ? "border-amber-300 dark:border-amber-800" : ""}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Tasa activa actual</CardTitle>
              {tasaActiva ? (
                esDesactualizada ? (
                  <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
                    <Clock className="mr-1 size-3" /> Desactualizada (&gt;24h)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">
                    <CheckCircle2 className="mr-1 size-3" /> Al día
                  </Badge>
                )
              ) : (
                <Badge variant="secondary">Sin registrar</Badge>
              )}
            </div>
            <CardDescription>
              Tasa utilizada para la conversión en el punto de venta (POS) y cobro de clientes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold tracking-tight">
                {tasaActiva ? `${tasaActiva.tasa.toFixed(2)}` : "—"}
              </span>
              <span className="text-lg font-medium text-muted-foreground">Bs / USD</span>
            </div>

            {tasaActiva && (
              <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                <p>
                  <strong className="text-foreground">Última actualización:</strong>{" "}
                  {new Date(tasaActiva.fecha).toLocaleString("es-VE", {
                    dateStyle: "full",
                    timeStyle: "medium",
                  })}
                </p>
                <p>
                  <strong className="text-foreground">Fuente:</strong> {tasaActiva.fuente}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tarjeta 2: Registrar nueva tasa (solo Admin) */}
        {isAdmin ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Actualizar tasa de cambio</CardTitle>
              <CardDescription>
                Ingresa el nuevo valor oficial en Bolívares por Dólar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tasa">Nueva tasa (Bs / USD)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="tasa"
                      name="tasa"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="Ej: 40.50"
                      value={nuevaTasa}
                      onChange={(e) => setNuevaTasa(e.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Formato decimal de tasa (ej: 36.50 o 40.20).
                  </p>
                </div>

                <Button type="submit" disabled={loading || !nuevaTasa} className="w-full">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" /> Guardando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 size-4" /> Establecer nueva tasa activa
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="flex flex-col justify-center text-center p-6 bg-muted/20">
            <p className="text-sm text-muted-foreground">
              Solo un usuario con rol de <strong>Administrador</strong> puede actualizar la tasa de cambio.
            </p>
          </Card>
        )}
      </div>

      {/* Historial de tasas */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" />
            <CardTitle className="text-base font-semibold">Historial de tasas de cambio</CardTitle>
          </div>
          <CardDescription>
            Registro histórico append-only de todas las tasas utilizadas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {historial.length > 0 ? (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha y hora</TableHead>
                    <TableHead className="text-right">Tasa (Bs/USD)</TableHead>
                    <TableHead>Fuente</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historial.map((item, index) => {
                    const esActual = tasaActiva?.id === item.id;
                    return (
                      <TableRow key={item.id} className={esActual ? "bg-muted/50 font-medium" : ""}>
                        <TableCell className="text-sm">
                          {new Date(item.fecha).toLocaleString("es-VE", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          Bs. {item.tasa.toFixed(2)}
                        </TableCell>
                        <TableCell className="capitalize text-muted-foreground text-xs">
                          {item.fuente}
                        </TableCell>
                        <TableCell>
                          {index === 0 ? (
                            <Badge variant="default" className="text-xs">
                              Activa
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              Histórica
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay tasas de cambio registradas aún.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
