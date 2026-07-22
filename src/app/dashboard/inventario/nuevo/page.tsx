import { redirect } from "next/navigation";
import { createClient, getPerfil } from "@/lib/supabase/server";
import { ProductoForm } from "@/components/producto-form";

export default async function NuevoProductoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getPerfil();
  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  // Cargar categorías y proveedores para los selects
  const [{ data: categorias }, { data: proveedores }] = await Promise.all([
    supabase.from("categorias").select("*").order("nombre"),
    supabase.from("proveedores").select("*").order("nombre"),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nuevo producto</h1>
        <p className="text-sm text-muted-foreground">
          Completa los datos del producto. Los campos con{" "}
          <span className="text-destructive">*</span> son obligatorios.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <ProductoForm
          categorias={categorias ?? []}
          proveedores={proveedores ?? []}
          mode="crear"
        />
      </div>
    </div>
  );
}
