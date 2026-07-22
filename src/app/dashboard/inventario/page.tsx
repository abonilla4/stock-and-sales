import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, getPerfil } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, Package, AlertTriangle } from "lucide-react";

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getPerfil();
  const isAdmin = profile?.role === "admin";

  const params = await searchParams;
  const query = params.q ?? "";
  const categoriaFilter = params.categoria ?? "";

  // Fetch productos con join a categoría y proveedor
  let productosQuery = supabase
    .from("productos")
    .select(
      "id, sku, nombre, stock_actual, stock_minimo, precio_venta_usd, activo, unidad_medida, categoria_id, categorias(nombre), proveedores(nombre)"
    )
    .order("created_at", { ascending: false });

  if (query) {
    productosQuery = productosQuery.or(
      `nombre.ilike.%${query}%,sku.ilike.%${query}%`
    );
  }

  if (categoriaFilter) {
    productosQuery = productosQuery.eq("categoria_id", categoriaFilter);
  }

  const { data: productos, error } = await productosQuery;

  // Fetch categorías para el filtro
  const { data: categorias } = await supabase
    .from("categorias")
    .select("id, nombre")
    .order("nombre");

  if (error) {
    console.error("Error fetching productos:", error);
  }

  const stockBajoCount =
    productos?.filter((p) => p.activo && p.stock_actual <= p.stock_minimo)
      .length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventario</h1>
          <p className="text-sm text-muted-foreground">
            {productos?.length ?? 0} producto(s)
            {stockBajoCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-warning">
                <AlertTriangle className="size-3.5" />
                {stockBajoCount} con stock bajo
              </span>
            )}
          </p>
        </div>
        {isAdmin && (
          <Button render={<Link href="/dashboard/inventario/nuevo" />}>
            <Plus className="size-4" />
            Nuevo producto
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <form className="relative flex-1" action="/dashboard/inventario">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            placeholder="Buscar por nombre o SKU..."
            defaultValue={query}
            className="pl-9"
          />
          {categoriaFilter && (
            <input type="hidden" name="categoria" value={categoriaFilter} />
          )}
        </form>

        {/* Filtro por categoría */}
        <div className="flex gap-2 overflow-x-auto">
          <Link href="/dashboard/inventario">
            <Badge
              variant={!categoriaFilter ? "default" : "outline"}
              className="cursor-pointer whitespace-nowrap"
            >
              Todas
            </Badge>
          </Link>
          {categorias?.map((cat) => (
            <Link
              key={cat.id}
              href={`/dashboard/inventario?categoria=${cat.id}${query ? `&q=${query}` : ""}`}
            >
              <Badge
                variant={categoriaFilter === cat.id ? "default" : "outline"}
                className="cursor-pointer whitespace-nowrap"
              >
                {cat.nombre}
              </Badge>
            </Link>
          ))}
        </div>
      </div>

      {/* Tabla */}
      {productos && productos.length > 0 ? (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Mínimo</TableHead>
                <TableHead className="text-right">Precio USD</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productos.map((p) => {
                const stockBajo = p.activo && p.stock_actual <= p.stock_minimo;
                const categoria = p.categorias as unknown as { nombre: string } | null;
                return (
                  <TableRow
                    key={p.id}
                    className={!p.activo ? "opacity-50" : ""}
                  >
                    <TableCell className="font-mono text-xs">
                      {p.sku}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/dashboard/inventario/${p.id}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {p.nombre}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {categoria?.nombre ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          stockBajo
                            ? "font-semibold text-warning"
                            : "text-foreground"
                        }
                      >
                        {p.stock_actual}
                      </span>
                      <span className="ml-1 text-xs text-muted-foreground">
                        {p.unidad_medida}
                      </span>
                      {stockBajo && (
                        <AlertTriangle className="ml-1 inline size-3.5 text-warning" />
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {p.stock_minimo}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${Number(p.precio_venta_usd).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {p.activo ? (
                        <Badge variant="success">Activo</Badge>
                      ) : (
                        <Badge variant="secondary">Inactivo</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <Package className="size-12 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-medium">
            {query || categoriaFilter
              ? "Sin resultados"
              : "Aún no hay productos"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {query || categoriaFilter
              ? "Intenta con otros términos de búsqueda."
              : "Agrega tu primer producto para empezar a gestionar el inventario."}
          </p>
          {!query && !categoriaFilter && isAdmin && (
            <Button className="mt-4" render={<Link href="/dashboard/inventario/nuevo" />}>
              <Plus className="size-4" />
              Agregar el primero
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
