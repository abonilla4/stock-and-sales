"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/app/dashboard/logout-button";

interface DashboardShellProps {
  children: React.ReactNode;
  userEmail: string;
  role: "admin" | "cajero";
}

export function DashboardShell({
  children,
  userEmail,
  role,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Build breadcrumb from pathname
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbLabels: Record<string, string> = {
    dashboard: "Dashboard",
    inventario: "Inventario",
    nuevo: "Nuevo Producto",
    editar: "Editar",
    configuracion: "Configuración",
    categorias: "Categorías",
    proveedores: "Proveedores",
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} role={role} />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
          >
            <Menu className="size-5" />
          </button>

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm">
            {segments.map((segment, i) => {
              const label =
                breadcrumbLabels[segment] || decodeURIComponent(segment);
              const isLast = i === segments.length - 1;
              return (
                <span key={segment + i} className="flex items-center gap-1.5">
                  {i > 0 && (
                    <span className="text-muted-foreground/50">/</span>
                  )}
                  <span
                    className={
                      isLast
                        ? "font-medium text-foreground"
                        : "text-muted-foreground"
                    }
                  >
                    {label}
                  </span>
                </span>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline-block">
              {userEmail}
            </span>
            <Badge
              variant="outline"
              className="hidden font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:inline-flex"
            >
              {role}
            </Badge>
            <LogoutButton />
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
