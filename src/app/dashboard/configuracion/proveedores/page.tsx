import { redirect } from "next/navigation";
import { createClient, getPerfil } from "@/lib/supabase/server";
import { ProveedoresClient } from "./proveedores-client";

export default async function ProveedoresPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getPerfil();
  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  const { data: proveedores } = await supabase
    .from("proveedores")
    .select("*")
    .order("nombre");

  // Get product counts per provider
  const { data: productCounts } = await supabase
    .from("productos")
    .select("proveedor_id");

  const countMap: Record<string, number> = {};
  productCounts?.forEach((p) => {
    if (p.proveedor_id) {
      countMap[p.proveedor_id] = (countMap[p.proveedor_id] ?? 0) + 1;
    }
  });

  return (
    <ProveedoresClient
      proveedores={proveedores ?? []}
      productCountMap={countMap}
    />
  );
}
