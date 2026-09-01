import Link from "next/link";
import {
  ScrollText,
  ShieldCheck,
  ClipboardCheck,
  Users,
  ChevronRight,
  Settings2,
} from "lucide-react";
import { obtenerMisPermisos } from "@/lib/auth/permisos";

/**
 * Índice del panel de sistema. Solo lista las secciones para las que el
 * usuario tiene permiso — pero ocultar una tarjeta no protege nada: cada
 * sub-ruta aplica su propio gate en el servidor.
 */
const SECCIONES = [
  {
    href: "/dashboard/sistema/auditoria",
    permiso: "sistema.ver_auditoria",
    titulo: "Registro de auditoría",
    descripcion:
      "Eventos de autorización y cambios de permisos, con usuario y fecha.",
    icono: ScrollText,
  },
  {
    href: "/dashboard/sistema/permisos",
    permiso: "sistema.asignar_roles",
    titulo: "Matriz de permisos",
    descripcion: "Qué puede hacer cada rol. Aplica de inmediato.",
    icono: ShieldCheck,
  },
  {
    href: "/dashboard/sistema/revision",
    // Reutiliza el permiso de autorización de excepciones, no uno propio.
    permiso: "ventas.autorizar_stock_negativo",
    titulo: "Revisión de autorizaciones offline",
    descripcion:
      "Ventas completadas sin conexión que nadie autorizó en el momento.",
    icono: ClipboardCheck,
  },
  {
    href: "/dashboard/sistema/usuarios",
    permiso: "sistema.gestionar_usuarios",
    titulo: "Usuarios",
    descripcion: "Altas, roles y desactivación de cuentas.",
    icono: Users,
  },
];

export default async function SistemaPage() {
  const permisos = await obtenerMisPermisos();
  const visibles = SECCIONES.filter((s) => permisos.has(s.permiso));

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
          <Settings2 className="size-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Sistema</h1>
          <p className="text-sm text-muted-foreground">
            Administración de accesos y trazabilidad.
          </p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {visibles.map((seccion) => {
          const Icono = seccion.icono;
          return (
            <Link
              key={seccion.href}
              href={seccion.href}
              className="group flex items-start gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/40"
            >
              <Icono className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{seccion.titulo}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {seccion.descripcion}
                </p>
              </div>
              <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
