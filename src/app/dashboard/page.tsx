import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export default async function DashboardPage() {
  let user = null;

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data?.user;
  } catch (error) {
    console.error("Error de Supabase en Dashboard:", error);
  }

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          Bienvenido a Stock & Sales
        </h1>
        <p className="mt-2 text-muted-foreground">
          Conectado como{" "}
          <span className="font-medium text-foreground">{user.email}</span>
        </p>
      </div>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        Este es el dashboard placeholder. Se construirá completamente en la Fase
        4 del plan de implementación.
      </p>
      <LogoutButton />
    </div>
  );
}
