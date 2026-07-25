"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/app/dashboard/logout-button";
import { NetworkStatusBadge } from "@/components/network-status-badge";

import Link from "next/link";

interface DashboardShellProps {
  children: React.ReactNode;
  userEmail: string;
  role: "admin" | "cajero";
}

const isUUID = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

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
    dashboard: "Inicio",
    inventario: "Inventario",
    nuevo: "Nuevo Producto",
    editar: "Editar",
    configuracion: "Configuración",
    categorias: "Categorías",
    proveedores: "Proveedores",
    clientes: "Clientes",
    pos: "Punto de Venta",
    reportes: "Reportes",
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
              const prevSegment = segments[i - 1];
              let label = breadcrumbLabels[segment];

              if (!label) {
                if (isUUID(segment)) {
                  if (prevSegment === "inventario") label = "Detalle de Producto";
                  else if (prevSegment === "clientes") label = "Detalle de Cliente";
                  else label = "Detalle";
                } else {
                  label = decodeURIComponent(segment);
                }
              }

              const isLast = i === segments.length - 1;
              const href = "/" + segments.slice(0, i + 1).join("/");

              return (
                <span key={segment + i} className="flex items-center gap-1.5">
                  {i > 0 && (
                    <span className="text-muted-foreground/40 font-mono">/</span>
                  )}
                  {isLast ? (
                    <span className="font-medium text-foreground">
                      {label}
                    </span>
                  ) : (
                    <Link
                      href={href}
                      className="text-muted-foreground hover:text-foreground hover:underline transition-colors"
                    >
                      {label}
                    </Link>
                  )}
                </span>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {/* Indicador de estado de red (Offline/Online + Sincronización) */}
            <NetworkStatusBadge />

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
