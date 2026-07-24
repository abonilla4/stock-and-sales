import { redirect } from "next/navigation";
import { createClient, getPerfil } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { OfflineNetworkProvider } from "@/components/offline-network-context";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getPerfil();
  const role = profile?.role ?? "admin"; // Default to admin if not found

  return (
    <OfflineNetworkProvider>
      <DashboardShell userEmail={user.email ?? ""} role={role}>
        {children}
      </DashboardShell>
    </OfflineNetworkProvider>
  );
}
