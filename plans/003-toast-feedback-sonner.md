# 003 — Feedback de acciones con Sonner (tokens del sistema)

- **Status**: DONE
- **Commit base**: c70f231 (commit 1: identidad visual + 001/002)
- **Severity**: MEDIUM
- **Category**: Feedback / consistencia de tokens
- **Scope real**: 4 archivos (+20/−3)

## Problem

El feedback con Sonner **ya existía** en las tres superficies (ver "Ya estaba listo" abajo), pero con dos defectos:

1. **Colores fuera del sistema**: `<Toaster richColors>` usa la paleta default de sonner (HSL propios), no los tokens del proyecto. Medido en baseline:
   - success: bg `rgb(236, 253, 243)`, border `rgb(191, 252, 217)`, texto `rgb(0, 138, 46)`
   - error: bg `rgb(255, 240, 240)`, border `rgb(255, 224, 225)`, texto `rgb(230, 0, 0)`
2. **Deletes en verde**: "Categoría eliminada", "Proveedor eliminado" y "Producto desactivado" se renderizaban como `toast.success` — semántica incorrecta para una acción destructiva/irreversible.

## Ya estaba listo (obviado, no se tocó)

- `toast.success/error/warning` ya se llamaban en: `producto-form.tsx` (crear/editar), `toggle-activo-button.tsx`, `categorias-client.tsx`, `proveedores-client.tsx`, `movimiento-dialog.tsx` (incl. `toast.warning(advertencia)` para stock<0).
- `<Toaster richColors position="bottom-right" />` ya montado en `src/app/layout.tsx:36`.
- Deps `sonner@2.0.7` y `next-themes` ya instaladas. (Nota: `useTheme` en `sonner.tsx` es scaffold inerte — no hay `ThemeProvider` en la app; siempre resuelve `"system"`.)
- **Reduced-motion**: sonner 2.0.7 ya gatea TODO el motion de toasts con `@media (prefers-reduced-motion) { [data-sonner-toast], [data-sonner-toast] > * { transition: none !important; animation: none !important; } }` (`node_modules/sonner/dist/styles.css:703-710`). Verificado empíricamente abajo — no requirió fix.

## Decisión de diseño

- crear/editar/reactivar → `toast.success` (tokens success)
- eliminar/desactivar → `toast.warning` (tokens warning) — ámbar para acciones destructivas
- error → tokens `destructive` derivados (el sistema no define `destructive-subtle/border`: se deriva vía `color-mix` del token existente — mismo hue, sin colores nuevos)

## Diff real

```diff
--- a/src/components/ui/sonner.tsx
+++ b/src/components/ui/sonner.tsx
@@ style prop del <Sonner> @@
           "--normal-border": "var(--border)",
           "--border-radius": "var(--radius)",
+          // richColors mapeado a los tokens del sistema (no usar la paleta default de sonner).
+          // OJO: para border se referencia el alias --color-* — var(--success-border) sería
+          // autorreferencia cíclica (mismo nombre que la var de sonner) → invalid at computed-value time.
+          "--success-bg": "var(--success-subtle)",
+          "--success-border": "var(--color-success-border)",
+          "--success-text": "var(--success)",
+          "--warning-bg": "var(--warning-subtle)",
+          "--warning-border": "var(--color-warning-border)",
+          "--warning-text": "var(--warning)",
+          // El sistema no define destructive-subtle: se deriva del token vía color-mix (mismo hue, sin colores nuevos)
+          "--error-bg": "color-mix(in oklch, var(--destructive) 8%, var(--background))",
+          "--error-border": "color-mix(in oklch, var(--destructive) 30%, var(--background))",
+          "--error-text": "var(--destructive)",
```
```diff
--- a/src/app/dashboard/configuracion/categorias/categorias-client.tsx
-      toast.success("Categoría eliminada");
+      toast.warning("Categoría eliminada");
--- a/src/app/dashboard/configuracion/proveedores/proveedores-client.tsx
-      toast.success("Proveedor eliminado");
+      toast.warning("Proveedor eliminado");
--- a/src/app/dashboard/inventario/[id]/toggle-activo-button.tsx
-        toast.success(activo ? "Producto desactivado" : "Producto reactivado");
+        if (activo) {
+          toast.warning("Producto desactivado");
+        } else {
+          toast.success("Producto reactivado");
+        }
```

## Measurements (Edge headless + playwright-core, acciones reales E2E)

### Colores computados: baseline → post

| Toast | Prop | Baseline (sonner default) | Post (token) | ¿Match token? |
|---|---|---|---|---|
| success | bg | `rgb(236, 253, 243)` | `lab(94.539 -7.91529 3.50081)` | == `--success-subtle` ✓ |
| success | border | `rgb(191, 252, 217)` | `lab(84.434 -15.9159 7.03363)` | == `--success-border` ✓ |
| success | texto+icono | `rgb(0, 138, 46)` | `lab(43.1914 -29.8087 11.733)` | == `--success` ✓ |
| warning | bg | `rgb(255, 252, 235)`¹ | `lab(95.4899 0.507593 11.6018)` | == `--warning-subtle` ✓ |
| warning | border | —¹ | `lab(82.7523 4.65983 27.8115)` | == `--warning-border` ✓ |
| warning | texto+icono | —¹ | `lab(48.4573 25.3022 49.0811)` | == `--warning` ✓ |
| error | bg | `rgb(255, 240, 240)` | `oklch(0.9569 0.0214 27.33)` | == mix 8% destructive ✓ |
| error | border | `rgb(255, 224, 225)` | `oklch(0.8661 0.0749 27.33)` | == mix 30% destructive ✓ |
| error | texto+icono | `rgb(230, 0, 0)` | `lab(48.4493 77.4328 61.5452)` | == `--destructive` ✓ |

¹ En baseline no existía ningún toast `warning` en las acciones medidas (los deletes eran `success`); los defaults de sonner para warning son `hsl(49,100%,97%)`/`hsl(49,91%,84%)`/`hsl(31,92%,45%)` (`styles.css:475-477`).

### Tipos por acción (E2E, las 3 superficies)

| Acción | type baseline | type post |
|---|---|---|
| Categoría creada / Proveedor creado / Producto actualizado | success | success |
| Duplicado (categoría) | error | error |
| Categoría eliminada / Proveedor eliminado | success | **warning** |
| Producto desactivado | success | **warning** |
| Producto reactivado | success | success |

### Timing entrada/salida (toast success, sondeo cada 25ms)

- Declarado en vendor: `transition: transform 400ms, opacity 400ms, height 400ms, box-shadow 200ms` (`styles.css:89`).
- **Entrada**: 434ms medidos (≈400ms + granularidad del sondeo). Primera muestra: `opacity: 0`, `translateY(53.5px)` — entra deslizando desde abajo con fade; 11 muestras intermedias.
- **Salida**: 167ms medidos (5 intermedios), vida total 4.2s (duration default 4000ms + ~200ms). El nodo se **desmonta ~170ms después de iniciar el fade** — comportamiento del vendor, idéntico en baseline (168ms) y post: no es regresión ni se modificó.
- Sin cambios de motion en este plan: el timing es 100% vendor.

### Reduced-motion (`prefers-reduced-motion: reduce` emulado, contexto separado)

- `transition-property: none`, `transition-duration: 0s` computados en el toast (gate `!important` del vendor).
- **0 muestras intermedias** de opacidad en la entrada (0→1 instantáneo), opacidad final 1.
- Nada que fixear — confirmado por observación, no asumido.

## Errata (post-ejecución, 2026-07-22): borde cíclico

La primera versión del mapeo usaba `"--success-border": "var(--success-border)"` — **autorreferencia cíclica**: la var de sonner y el token del sistema comparten nombre. Declarar `--success-border: var(--success-border)` inline en el toaster es un ciclo → *invalid at computed-value time* → `border-color: var(--success-border)` cae a `currentColor`. Detectado en la medición post: el border del toast medía `lab(43.19…)` (color del texto) en vez de `lab(84.43…)` (`--success-border`).

**Fix**: referenciar el alias de `@theme` — `"--success-border": "var(--color-success-border)"` (y `--color-warning-border`), que rompe el ciclo (`--color-success-border` en `:root` ya apunta al token crudo). Re-medido tras el fix: border == token exacto en ambos tipos.

## Verification

- **Mechanical**: `npm run lint` → 0 errores (1 warning preexistente en `global-error.tsx`). `npm run build` → compila (`ƒ /` dynamic).
- **E2E** (harness playwright-core en `C:\Users\aboni\AppData\Local\Temp\opencode\check-003*.js`, fuera del proyecto): flujos crear/editar/eliminar en Categorías, crear/eliminar en Proveedores, editar + desactivar/reactivar en Inventario, duplicado → error, reduce emulado.
- **Higiene de datos**: categorías/proveedor `ZZ-TEST-003*` creados y eliminados dentro del propio flujo; producto desactivado→reactivado (queda activo); descripción editada y revertida (solo `updated_at` cambia).
- **Done when**: todo toast de acción renderiza estrictamente tokens del sistema (0 colores de la paleta default de sonner), deletes en warning, y reduced-motion verificado instantáneo.
