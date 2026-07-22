# 002 — Motion del colapsable, chevron y overlay del sidebar

- **Status**: DONE
- **Commit**: 1c2dd30
- **Severity**: MEDIUM
- **Category**: Interruptibility / physicality / accessibility
- **Estimated scope**: 2 archivos (`src/app/globals.css`, `src/components/sidebar.tsx`)

## Problem

Tres teleports en el sidebar, todos en `src/components/sidebar.tsx`:

1. **Colapsable de Configuración** (`sidebar.tsx:180-203`): el submenú se monta/desmonta con render condicional — abre y cierra de golpe:

```tsx
{isExpanded && (
  <ul className="mt-1 ml-4 space-y-1 border-l border-sidebar-border pl-3">
```

2. **Chevron** (`sidebar.tsx:174-178`): swap instantáneo entre dos iconos distintos:

```tsx
{isExpanded ? (
  <ChevronDown className="size-3.5 text-sidebar-foreground/50" />
) : (
  <ChevronRight className="size-3.5 text-sidebar-foreground/50" />
)}
```

3. **Overlay móvil** (`sidebar.tsx:112-117`): aparece/desaparece de golpe mientras el drawer sí se desliza (`transition-transform` en `sidebar.tsx:121`) — movimiento sin fundido acompañante.

Reglas aplicables: expand/collapse es UI reversible a mitad de recorrido → **transiciones CSS, nunca keyframes** (retargetan desde el estado actual); entradas/salidas → `ease-out`; UI bajo 300ms; movimiento suprimido bajo `prefers-reduced-motion` manteniendo feedback de opacidad.

## Target

### 1. Tokens de easing — `src/app/globals.css`

Añadir dentro del bloque `@theme inline { … }` (después de la línea `--font-heading: var(--font-sans);`), valores exactos:

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
```

Esto genera las utilidades `ease-out` (redefinida) y `ease-drawer`. Nada en el repo las usa hoy → sin colisiones.

### 2. Colapsable — altura animada con `grid-template-rows`, siempre montado

```tsx
<div
  className={cn(
    "grid duration-200 ease-out motion-safe:transition-[grid-template-rows]",
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
      {/* …children sin cambios… */}
    </ul>
  </div>
</div>
```

Notas exactas:
- El wrapper externo anima `grid-template-rows: 0fr → 1fr` (200ms, `ease-out`). Va gateado con `motion-safe:` porque es **movimiento** — bajo reduced-motion la altura cambia instantáneo.
- El wrapper interno lleva `overflow-hidden` + fade de `opacity`/`visibility` **sin gatear** — bajo reduced-motion el fundido de opacidad permanece. `visibility` transiciona de forma discreta: permanece `visible` durante el fade de salida y se vuelve `hidden` al final → los links colapsados salen del tab order y del hit-testing (no dejar foco de teclado atrapado en contenido invisible).
- El `mt-1` queda **dentro** del contenedor con `overflow-hidden` (BFC): al colapsar, la altura 0 lo oculta todo.
- En el `<button>` del toggle, añadir `aria-expanded={isExpanded}`.

### 3. Chevron — un solo icono que rota

```tsx
<ChevronDown
  className={cn(
    "size-3.5 text-sidebar-foreground/50 duration-200 ease-out motion-safe:transition-transform",
    isExpanded ? "rotate-0" : "-rotate-90"
  )}
/>
```

`ChevronDown` a `-rotate-90` apunta a la derecha (equivale al `ChevronRight` colapsado actual). Eliminar `ChevronRight` del import de `lucide-react` (`sidebar.tsx:5-17`).

### 4. Overlay móvil — siempre montado, fade de opacidad

```tsx
{/* Overlay for mobile — siempre montado para poder fundir */}
<div
  aria-hidden="true"
  onClick={onClose}
  className={cn(
    "fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 ease-out lg:hidden",
    open ? "opacity-100" : "pointer-events-none opacity-0"
  )}
/>
```

Opacidad pura → sin gateo `motion-safe:`.

### 5. Drawer móvil — curva de drawer

En la clase del `<aside>` (`sidebar.tsx:121`), cambiar:

```tsx
// actual:
"… bg-sidebar transition-transform duration-200 lg:static lg:translate-x-0"
// target:
"… bg-sidebar duration-200 ease-drawer motion-safe:transition-transform lg:static lg:translate-x-0"
```

(El `transition-transform` pasa a estar gateado con `motion-safe:`; `duration-200 ease-drawer` sin gatear son inertes sin transition-property.)

## Repo conventions to follow

- Transiciones **explícitas por propiedad** (`transition-[grid-template-rows]`, `transition-opacity`, `transition-transform`) — nunca `transition-all` (regla del repo: AUDIT.md §5).
- Clases condicionales con el helper `cn()` de `@/lib/utils`, como ya hace todo el archivo.
- Los ítems "Próximamente" (`sidebar.tsx:226-237`) **no se tocan**: son `<span>` sin hover ni transición a propósito — ya pasaron el audit.
- Duración 200ms en todo el plan: dentro del presupuesto (dropdowns 150–250ms, drawers 200–500ms).

## Steps

1. `src/app/globals.css`: añadir los dos tokens `--ease-out` y `--ease-drawer` al bloque `@theme inline` (ver Target §1).
2. `src/components/sidebar.tsx`: reemplazar el bloque del overlay condicional `{open && (...)}` por la versión siempre montada (Target §4).
3. En la clase del `<aside>`, aplicar el cambio de Target §5.
4. En el `<button>` del toggle de Configuración, añadir `aria-expanded={isExpanded}`.
5. Reemplazar el swap condicional de chevrons por el `ChevronDown` rotatorio (Target §3); eliminar `ChevronRight` del import.
6. Reemplazar el render condicional `{isExpanded && (<ul …>)}` por la estructura de dos wrappers de Target §2, manteniendo el `<ul>` y sus children intactos.

## Boundaries

- NO tocar los ítems "Próximamente" ni los `transition-colors` de los links de Operación (ya correctos).
- NO cambiar markup/estructura fuera de lo listado: el `<ul>` de children y sus `<Link>` quedan byte a byte iguales.
- NO usar keyframes (`animate-in`, `slide-in-from-*`, etc.) en el colapsable — solo transiciones.
- NO añadir dependencias (nada de framer-motion para esto).
- Si el código encontrado no coincide con lo citado (drift desde `1c2dd30`), STOP y reportar.

## Verification

- **Mechanical** (la carpeta ya se renombró a `Stock-and-Sales`, sin `&` — npm scripts normales):
  - `npm run lint` → 0 errores (vigilar que `ChevronRight` ya no se importa).
  - `npm run build` → compila.
- **Feel check**:
  - Click repetido rápido en "Configuración" a mitad de animación → la altura/rotación **retargetan desde el punto actual**, nunca reinician desde cero.
  - DevTools → Animations → playback 10%: el chevron **rota** (−90°→0°), no salta de icono; el submenú crece en altura con fade simultáneo.
  - Móvil (o viewport < lg): abrir/cerrar el drawer → el overlay funde mientras el drawer desliza; con el drawer cerrado, el overlay no intercepta clicks (pointer-events-none).
  - Tab por teclado con el submenú colapsado → el foco **no** entra en los links invisibles; el toggle anuncia `aria-expanded`.
  - Rendering → emulate `prefers-reduced-motion: reduce`: altura y rotación instantáneas; fades de opacidad permanecen.
- **Done when**: expand/collapse de Configuración anima altura + fade en 200ms interrumpible, el chevron rota, el overlay móvil funde, y nada de ello usa keyframes ni `transition-all`.

## Errata (post-ejecución, 2026-07-21)

La nota del Target §5 ("`duration-200 ease-drawer` sin gatear son inertes sin transition-property") es **incorrecta**: el valor inicial de `transition-property` es `all`, así que `duration-200` sin `transition-property` explícita produce `transition: all 200ms` — el gateo `motion-safe:` por sí solo **no** suprime el movimiento bajo `prefers-reduced-motion`. Detectado en el feel check con reduce emulado: altura, rotación y drawer seguían animando (sonda: `transition-property: all; transition-duration: 0.2s`).

**Fix aplicado** (3 clases añadidas, desviación mínima del Target literal para cumplir su propia Verification): `motion-reduce:transition-none` en las 3 superficies con movimiento gateado — wrapper del colapsable, chevron y `<aside>`. Los fades de opacidad (wrapper interno y overlay) quedan como estaban: transiciones explícitas sin gatear, permanecen bajo reduce. Verificado tras el fix: altura/rotación/translate instantáneos (0 muestras intermedias), fades permanecen (6 muestras intermedias), y el comportamiento normal (no-reduce) intacto.
