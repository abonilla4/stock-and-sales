import { redirect, notFound } from "next/navigation";
import { createClient, getPerfil } from "@/lib/supabase/server";
import { ProductoForm } from "@/components/producto-form";
import type { Producto } from "@/lib/types/database";

export default async function EditarProductoPage({
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
  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  const [{ data: producto }, { data: categorias }, { data: proveedores }] =
    await Promise.all([
      supabase.from("productos").select("*").eq("id", id).single(),
      supabase.from("categorias").select("*").order("nombre"),
      supabase.from("proveedores").select("*").order("nombre"),
    ]);

  if (!producto) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Editar producto</h1>
        <p className="text-sm text-muted-foreground">
          {producto.nombre} — <span className="font-mono">{producto.sku}</span>
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <ProductoForm
          producto={producto as Producto}
          categorias={categorias ?? []}
          proveedores={proveedores ?? []}
          mode="editar"
        />
      </div>
    </div>
  );
}
