"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  BarChart3,
  Settings,
  Tags,
  Truck,
  DollarSign,
  ChevronDown,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  children?: { label: string; href: string; icon: React.ReactNode }[];
}

const operacionItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard className="size-4" />,
  },
  {
    label: "Punto de Venta",
    href: "/dashboard/pos",
    icon: <ShoppingCart className="size-4" />,
  },
  {
    label: "Inventario",
    href: "/dashboard/inventario",
    icon: <Package className="size-4" />,
  },
  {
    label: "Clientes",
    href: "/dashboard/clientes",
    icon: <Users className="size-4" />,
  },
  {
    label: "Reportes",
    href: "/dashboard/reportes",
    icon: <BarChart3 className="size-4" />,
  },
  {
    label: "Configuración",
    href: "/dashboard/configuracion",
    icon: <Settings className="size-4" />,
    children: [
      {
        label: "Tasa de cambio",
        href: "/dashboard/configuracion/tasa-cambio",
        icon: <DollarSign className="size-4" />,
      },
      {
        label: "Categorías",
        href: "/dashboard/configuracion/categorias",
        icon: <Tags className="size-4" />,
      },
      {
        label: "Proveedores",
        href: "/dashboard/configuracion/proveedores",
        icon: <Truck className="size-4" />,
      },
    ],
  },
];

const proximosItems: NavItem[] = [];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-5 pb-1.5 font-mono text-[10px] font-medium uppercase tracking-widest text-sidebar-foreground/45 first:pt-0">
      {children}
    </p>
  );
}

export function Sidebar({
  open,
  onClose,
  role,
}: {
  open?: boolean;
  onClose?: () => void;
  role: "admin" | "cajero";
}) {
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = useState<string[]>([
    "/dashboard/configuracion",
  ]);

  const visibleNavItems = operacionItems.filter((item) => {
    if (item.label === "Configuración" && role !== "admin") return false;
    return true;
  });

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const toggleSection = (href: string) => {
    setExpandedSections((prev) =>
      prev.includes(href)
        ? prev.filter((s) => s !== href)
        : [...prev, href]
    );
  };

  return (
    <>
      {/* Overlay for mobile — siempre montado para poder fundir */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 ease-out lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar duration-200 ease-drawer motion-safe:transition-transform motion-reduce:transition-none lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary">
              <Package className="size-4 text-primary-foreground" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-sidebar-foreground">
              Stock & Sales
            </span>
          </Link>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground lg:hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <SectionLabel>Operación</SectionLabel>
          <ul className="space-y-1">
            {visibleNavItems.map((item) => {
              const active = isActive(item.href);
              const hasChildren = item.children && item.children.length > 0;
              const isExpanded = expandedSections.includes(item.href);

              return (
                <li key={item.href}>
                  {hasChildren ? (
                    <>
                      <button
                        onClick={() => toggleSection(item.href)}
                        aria-expanded={isExpanded}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                          active
                            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                        )}
                      >
                        {item.icon}
                        <span className="flex-1 text-left">{item.label}</span>
                        <ChevronDown
                          className={cn(
                            "size-3.5 text-sidebar-foreground/50 duration-200 ease-out motion-safe:transition-transform motion-reduce:transition-none",
                            isExpanded ? "rotate-0" : "-rotate-90"
                          )}
                        />
                      </button>
                      <div
                        className={cn(
                          "grid duration-200 ease-out motion-safe:transition-[grid-template-rows] motion-reduce:transition-none",
                          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                        )}
                      >
                        <div
                          className={cn(
                            "overflow-hidden transition-[opacity,visibility] duration-200 ease-out",
                            isExpanded ? "visible opacity-100" : "invisible opacity-0"
                          )}
                        >
                          <ul className="mt-1 ml-4 space-y-1 border-l border-sidebar-border pl-3">
                            {item.children!.map((child) => {
                              const childActive = isActive(child.href);
                              return (
                                <li key={child.href}>
                                  <Link
                                    href={child.href}
                                    onClick={onClose}
                                    className={cn(
                                      "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors",
                                      childActive
                                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                                        : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                                    )}
                                  >
                                    {child.icon}
                                    {child.label}
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    </>
                  ) : (
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                      )}
                    >
                      {item.icon}
                      {item.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>

          <SectionLabel>Próximamente</SectionLabel>
          <ul className="space-y-1">
            {proximosItems.map((item) => (
              <li key={item.href}>
                <span
                  aria-disabled="true"
                  className="flex cursor-default items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/45 select-none"
                >
                  {item.icon}
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-sidebar-foreground/40">
            Stock & Sales — v1.0
          </p>
        </div>
      </aside>
    </>
  );
}
