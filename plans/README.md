# Planes de animación — Stock & Sales

Generados por `improve-animations` (audit `quick` con foco del usuario). Commit base: `1c2dd30`.

| # | Título | Severidad | Estado |
|---|--------|-----------|--------|
| [001](001-dashboard-loading-skeleton.md) | Skeleton de carga neutro para el Dashboard | HIGH | DONE |
| [002](002-sidebar-collapsible-motion.md) | Motion del colapsable, chevron y overlay del sidebar | MEDIUM | DONE |

## Orden recomendado de ejecución

1. **001** primero — severidad HIGH, afecta a la página más visitada.
2. **002** después.

## Dependencias

- Ninguna entre planes: archivos disjuntos (001: `dashboard/loading.tsx` + `dashboard/page.tsx`; 002: `globals.css` + `sidebar.tsx`).
- Ambos comparten solo la verificación estándar: `npm run lint` y `npm run build`. (Nota histórica resuelta: la carpeta se renombró de `Stock&Sales` a `Stock-and-Sales`, así que los npm scripts ya funcionan con normalidad.)

## Ya auditado y correcto (no requiere plan)

- Ítems "Próximamente" del sidebar: `<span>` sin hover ni transición (`sidebar.tsx:226-237`).
- Tarjeta Stock bajo alerta↔quieto: cambio entre renders de servidor, no in-place — no se debe animación.
- Indicador de item activo en nav: cambia con la navegación; hover con `transition-colors` (~150ms) es correcto.
- Dropdowns/select/dialog: `zoom-in-95` + `origin-(--transform-origin)` + `duration-100` — dentro de la barra.
