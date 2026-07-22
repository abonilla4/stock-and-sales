# 001 — Skeleton de carga neutro para el Dashboard

- **Status**: DONE
- **Commit**: 1c2dd30
- **Severity**: HIGH
- **Category**: Purpose & frequency / missed opportunity
- **Estimated scope**: 1 archivo nuevo + 1 clase en 1 archivo existente

## Problem

`/dashboard` es un server component async (`src/app/dashboard/page.tsx:16`) que espera 4 queries de Supabase, y **no existe ningún `loading.tsx` en todo `src/`** (verificado con glob). Al navegar al dashboard la UI se congela sin feedback y las 4 tarjetas KPI + el panel de alertas teletransportan al llegar los datos. Es la página más visitada de la app.

Restricciones de diseño (del propietario del producto, no negociables):

1. **Skeleton 100% neutro**: solo `bg-muted` (el componente `Skeleton` existente). Nada de navy ni ámbar — mientras los datos no llegan no se sabe si hay alerta, y ningún skeleton debe anticipar el estado "Stock bajo en alerta".
2. **Cero layout shift en la fila KPI**: la fila de tarjetas no puede cambiar de altura al resolver, ni en estado alerta ni en estado quieto.

## Target

Geometría unificada — las 3 variantes (skeleton, alerta, quieto) miden **exactamente 132px** por tarjeta KPI:

| Variante | header | número | caption | total |
|---|---|---|---|---|
| Skeleton (×4) | 24px | `h-10` = 40px | slot vacío `mt-1 h-4` = 20px | 132px |
| Real alerta (`bg-primary`) | 24px | `text-4xl` (line-height 40px) | `text-xs` + `mt-1` = 20px | 132px |
| Real quieta | 24px | `text-2xl` **+ `leading-10`** → caja de 40px | `text-xs` + `mt-1` = 20px | 132px |

- El slot del caption es un `<div className="mt-1 h-4" />` **vacío a propósito** (sin pulse, sin color): reserva la altura de la señal de estado sin anticiparla.
- La tarjeta quieta real gana una sola clase (`leading-10`) para que su cifra ocupe la misma caja de 40px que la cifra de alerta (`text-4xl` tiene line-height 2.5rem = 40px).
- Las 3 tarjetas informativas reales miden 104px y ya se estiran al alto de fila por `align-items: stretch` del grid — no necesitan cambio.
- El panel de alertas queda **aproximado a propósito** (el número real de filas es incognoscible en el skeleton); el requisito de cero-shift aplica solo a la fila KPI.

`src/app/dashboard/loading.tsx` — archivo completo:

```tsx
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function KpiSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-10 w-14" />
        {/* Slot reservado para el caption de estado: vacío a propósito. No rellenar ni eliminar. */}
        <div className="mt-1 h-4" />
      </CardContent>
    </Card>
  );
}

export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <span className="sr-only">Cargando resumen del inventario…</span>
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-1 h-4 w-52" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiSkeleton />
        <KpiSkeleton />
        <KpiSkeleton />
        <KpiSkeleton />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-56" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
```

`src/app/dashboard/page.tsx` — única clase añadida (`leading-10`) en la tarjeta quieta:

```tsx
// actual (línea ~106):
<p className="font-mono text-2xl font-semibold tabular-nums">0</p>
// target:
<p className="font-mono text-2xl font-semibold tabular-nums leading-10">0</p>
```

## Repo conventions to follow

- `Skeleton` ya existe en `src/components/ui/skeleton.tsx` con `cn("animate-pulse rounded-md bg-muted", className)` — usarlo tal cual, sin variantes de color.
- La estructura del skeleton replica las clases de layout reales de `src/app/dashboard/page.tsx` (`space-y-6`, `grid gap-4 sm:grid-cols-2 lg:grid-cols-4`, `Card`/`CardHeader`/`CardContent`) para que el swap skeleton→contenido no mueva nada.
- `animate-pulse` es un keyframe de **opacidad solamente** → ya cumple `prefers-reduced-motion` (no hay movimiento que suprimir). No añadir `motion-safe:` ni variantes.
- `loading.tsx` es server component: sin `"use client"`, sin props.

## Steps

1. Crear `src/app/dashboard/loading.tsx` con el contenido exacto de la sección Target.
2. En `src/app/dashboard/page.tsx`, localizar el `<p>` del estado quieto de la tarjeta "Stock bajo" (contiene `{`0`}` y clases `font-mono text-2xl font-semibold tabular-nums`) y añadir `leading-10` al final de su `className`.

## Boundaries

- NO añadir color a los skeletons (nada de `bg-primary`, `text-warning`, `border-warning-border` ni similares en `loading.tsx`).
- NO cambiar la lógica de datos ni el markup de los estados alerta/panel de `page.tsx` — la única edición ahí es `leading-10`.
- NO crear `loading.tsx` para otras rutas (fuera de scope; puede ser un plan futuro).
- NO añadir dependencias. NO convertir nada en client component.
- Si el código encontrado no coincide con lo citado (drift desde el commit `1c2dd30`), STOP y reportar en vez de improvisar.

## Verification

- **Mechanical** (la carpeta ya se renombró a `Stock-and-Sales`, sin `&` — npm scripts normales):
  - `npm run lint` → 0 errores.
  - `npm run build` → compila; aparece la ruta `/dashboard` sin errores.
- **Feel check**:
  - DevTools Network → throttle "Slow 3G"; navegar a `/dashboard` → skeleton neutro visible durante la carga (solo grises `bg-muted`, sin navy ni ámbar).
  - Con al menos un producto bajo el mínimo: al resolver, **la fila KPI no se mueve ni un píxel** (comparar posición del panel inferior antes/después).
  - Con stock sano (tarjeta quieta): igual — la fila KPI no se mueve; la cifra `0` ocupa la misma caja que la cifra de alerta.
  - Rendering → emulate `prefers-reduced-motion`: el pulse (opacidad) puede seguir; no hay ningún movimiento adicional.
- **Done when**: skeleton neutro renderiza en `/dashboard`, y la fila KPI tiene altura idéntica antes y después de resolver los datos en ambos estados.
