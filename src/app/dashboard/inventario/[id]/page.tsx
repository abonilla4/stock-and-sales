import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient, getPerfil } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
  Pencil,
  AlertTriangle,
  ArrowUpCircle,
  ArrowDownCircle,
  Settings2,
  ShoppingCart,
} from "lucide-react";
import { MovimientoDialog } from "@/components/movimiento-dialog";
import { ToggleActivoButton } from "./toggle-activo-button";

export default async function ProductoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getPerfil();
  const isAdmin = profile?.role === "admin";

  // Fetch producto con joins
  const { data: producto } = await supabase
    .from("productos")
    .select(
      "*, categorias(nombre), proveedores(nombre)"
    )
    .eq("id", id)
    .single();

  if (!producto) notFound();

  // Fetch movimientos de inventario
  const { data: movimientos } = await supabase
    .from("movimientos_inventario")
    .select("*")
    .eq("producto_id", id)
    .order("created_at", { ascending: false });

  const stockBajo =
    producto.activo && producto.stock_actual <= producto.stock_minimo;

  const categoria = producto.categorias as unknown as { nombre: string } | null;
  const proveedor = producto.proveedores as unknown as { nombre: string } | null;

  const tipoIconos: Record<string, React.ReactNode> = {
    entrada: <ArrowUpCircle className="size-4 text-success" />,
    salida: <ArrowDownCircle className="size-4 text-destructive" />,
    ajuste: <Settings2 className="size-4 text-warning" />,
    venta: <ShoppingCart className="size-4 text-primary" />,
  };

  const tipoLabels: Record<string, string> = {
    entrada: "Entrada",
    salida: "Salida",
    ajuste: "Ajuste",
    venta: "Venta",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {producto.nombre}
            </h1>
            {!producto.activo && <Badge variant="secondary">Inactivo</Badge>}
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="font-mono">{producto.sku}</span>
            {producto.codigo_barras && (
              <>
                <span>•</span>
                <span>{producto.codigo_barras}</span>
              </>
            )}
            {categoria && (
              <>
                <span>•</span>
                <span>{categoria.nombre}</span>
              </>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="flex gap-2">
            <MovimientoDialog
              productoId={producto.id}
              productoNombre={producto.nombre}
              stockActual={producto.stock_actual}
              unidadMedida={producto.unidad_medida}
            />
            <Button variant="outline" size="sm" render={<Link href={`/dashboard/inventario/${id}/editar`} />}>
              <Pencil className="size-4" />
              Editar
            </Button>
            <ToggleActivoButton id={producto.id} activo={producto.activo} />
          </div>
        )}
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="movimientos">
            Historial de movimientos
            {movimientos && movimientos.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 px-1.5 text-xs">
                {movimientos.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Info ── */}
        <TabsContent value="info" className="mt-4">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Stock */}
            <div
              className={`rounded-lg border p-4 ${
                stockBajo
                  ? "border-warning-border bg-warning-subtle"
                  : "border-border bg-card"
              }`}
            >
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Stock actual
              </p>
              <p
                className={`mt-1 text-3xl font-bold ${
                  stockBajo ? "text-warning" : "text-foreground"
                }`}
              >
                {producto.stock_actual}
                <span className="ml-1 text-base font-normal text-muted-foreground">
                  {producto.unidad_medida}(s)
                </span>
              </p>
              {stockBajo && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-warning">
                  <AlertTriangle className="size-3.5" />
                  Stock bajo — mínimo: {producto.stock_minimo}
                </div>
              )}
            </div>

            {/* Precios */}
            {isAdmin && (
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Precio de costo
                </p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  ${Number(producto.precio_costo_usd).toFixed(2)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">USD</p>
              </div>
            )}

            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Precio de venta
              </p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                ${Number(producto.precio_venta_usd).toFixed(2)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">USD</p>
            </div>

            {/* Detalles */}
            <div className="rounded-lg border border-border bg-card p-4 sm:col-span-2 lg:col-span-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Detalles
              </p>
              <Separator className="my-3" />
              <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">Categoría</dt>
                  <dd className="font-medium">
                    {categoria?.nombre ?? "Sin categoría"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Proveedor</dt>
                  <dd className="font-medium">
                    {proveedor?.nombre ?? "Sin proveedor"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Unidad de medida</dt>
                  <dd className="font-medium capitalize">
                    {producto.unidad_medida}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Stock mínimo</dt>
                  <dd className="font-medium">{producto.stock_minimo}</dd>
                </div>
              </dl>
              {producto.descripcion && (
                <>
                  <Separator className="my-3" />
                  <div>
                    <p className="text-xs text-muted-foreground">Descripción</p>
                    <p className="mt-1 text-sm">{producto.descripcion}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Tab: Movimientos ── */}
        <TabsContent value="movimientos" className="mt-4">
          {movimientos && movimientos.length > 0 ? (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimientos.map((mov) => (
                    <TableRow key={mov.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {tipoIconos[mov.tipo]}
                          <span className="text-sm font-medium">
                            {tipoLabels[mov.tipo]}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            mov.tipo === "entrada"
                              ? "text-success"
                              : "text-destructive"
                          }
                        >
                          {mov.tipo === "entrada" ? "+" : "−"}
                          {mov.cantidad}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">
                        {mov.motivo ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(mov.created_at).toLocaleString("es-VE", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No hay movimientos registrados todavía.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
