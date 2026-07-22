import { redirect } from "next/navigation";
import { createClient, getPerfil } from "@/lib/supabase/server";
import { CategoriasClient } from "./categorias-client";

export default async function CategoriasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getPerfil();
  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  const { data: categorias } = await supabase
    .from("categorias")
    .select("*")
    .order("nombre");

  // Get product counts per category
  const { data: productCounts } = await supabase
    .from("productos")
    .select("categoria_id");

  const countMap: Record<string, number> = {};
  productCounts?.forEach((p) => {
    if (p.categoria_id) {
      countMap[p.categoria_id] = (countMap[p.categoria_id] ?? 0) + 1;
    }
  });

  return (
    <CategoriasClient
      categorias={categorias ?? []}
      productCountMap={countMap}
    />
  );
}
