# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Stock & Sales

Sistema de inventario y control de ventas para ferretería de ubicación única. Soporta operación offline-first, moneda dual (USD/Bs), gestión de fiado, y presupuestos.

**Current state:** Phases 0-4 complete; offline (Phase 5) + presupuestos module implemented; phase 6 (security/testing) ongoing.

---

## Stack & Commands

| Component | Tech |
|---|---|
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript |
| Backend | Supabase (PostgreSQL + Auth) |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Validation | Zod |
| Offline DB | Dexie.js (IndexedDB wrapper) |
| PWA | Service worker + manifest |

### Development Commands

```bash
npm run dev        # Start dev server (http://localhost:3000)
npm run build      # Production build
npm run start      # Run production server
npm run lint       # ESLint check
npm test           # Run tests (tests/unit-critical-logic.test.ts)
```

---

## Project Structure

```
src/
├── app/
│   ├── login/              # Auth page
│   ├── dashboard/
│   │   ├── pos/            # Point of sale (cart, checkout)
│   │   ├── inventario/     # Products CRUD, movements
│   │   ├── clientes/       # Customers, credit tracking
│   │   ├── presupuestos/   # Quotes/estimates
│   │   ├── reportes/       # Sales, top products, margins
│   │   ├── configuracion/  # Exchange rate, categories, suppliers
│   │   └── layout.tsx
│   ├── layout.tsx          # Root layout
│   └── globals.css
├── components/
│   ├── ui/                 # shadcn/ui (button, card, dialog, etc.)
│   ├── pos/                # POS components (search, cart, checkout)
│   ├── clientes/           # Client dialogs
│   ├── presupuestos/       # Quote components
│   ├── reportes/           # Charts, KPIs
│   ├── dashboard-shell.tsx # Main layout + sidebar
│   ├── network-status-badge.tsx
│   ├── offline-network-context.tsx
│   └── sw-register.tsx
└── lib/
    ├── supabase/
    │   ├── client.ts       # Browser client (NEXT_PUBLIC keys)
    │   ├── server.ts       # Server client + auth
    │   └── middleware.ts   # Route protection
    ├── types/
    │   └── database.ts     # All DB table interfaces (manual)
    ├── schemas/
    │   └── actions-schemas.ts  # Zod validation for all forms
    ├── offline/
    │   ├── db.ts           # Dexie database schema
    │   ├── sync-cache.ts   # Offline queue + sync logic
    │   └── sales-manager.ts # Offline sales + idempotency
    ├── calculations.ts     # Currency, totals
    ├── formatters.ts       # Number/date formatting
    ├── precision.ts        # Decimal validation (units)
    └── config/
        ├── negocio.ts      # Business settings
        └── limites.ts      # Rate limits, pagination
```

---

## Critical Architecture

### 1. Offline-First (Dexie + Service Worker)

All data is read/written to IndexedDB first:
- Service worker syncs to Supabase when online
- Each offline sale gets `client_tx_id` for idempotency
- Conflict resolution: last-write-wins + audit log
- Network status badge always visible

**Key files:**
- `src/lib/offline/db.ts` — Dexie tables (productos, clientes, cola_ventas, etc.)
- `src/lib/offline/sales-manager.ts` — recordOfflineSale(), syncQueue()
- `src/components/sw-register.tsx` — Service worker registration

### 2. Stock Modifications — Centralized RPC Only

**Non-negotiable:** Stock changes go ONLY through `procesar_venta_transaccion` RPC:
- Never scattered UPDATEs
- No fallback paths
- Server-side transaction for atomicity
- Error → offline queue (Dexie) with state='error'

**Pattern:**
```typescript
// In src/app/dashboard/pos/actions.ts
export async function confirmarVentaPOS(data) {
  // 1. Validate with Zod
  const validated = confirmarVentaSchema.parse(data);
  
  // 2. Call RPC procesar_venta_transaccion
  const result = await rpc.procesar_venta_transaccion({...});
  
  // 3. On error, store in offline queue
  // 4. Return result; frontend handles sync retry
}
```

### 3. Price & Exchange Rate Snapshots

- Product price frozen at `detalle_venta.precio_unitario_usd`
- Exchange rate saved as `ventas.tasa_cambio_aplicada`
- **Never recalculate** historical sales with new rates
- Each sale is immutable snapshot

### 4. Row Level Security (RLS)

All tables have RLS enabled:
```sql
-- v1 (single-user):
USING (auth.uid() IS NOT NULL)
```
`profiles.role` field exists for future multi-user (admin/cajero).

### 5. Validation Pattern

All forms → Zod schema in `src/lib/schemas/actions-schemas.ts`:
- `confirmarVentaSchema` — sales (items, totals, exchange rate)
- `crearProductoSchema` — products (includes unit-specific rules)
- `crearPresupuestoSchema` — quotes

Unit validation: `esUnidadEntera()` from `src/lib/precision.ts` checks if unit allows decimals.

### 6. Presupuestos (Quotes) Module

Separate from sales:
- Can be converted to sale (links `venta.presupuesto_id`)
- Uses `client_tx_id` for conversion idempotency
- Design allows future: quote templates, auto-renewal, etc.

---

## From AGENTS.md — Enforced Rules

See @AGENTS.md for complete rules. Key constraints:

1. **No stock modification outside `procesar_venta_transaccion`** — not even error handling
2. **RLS on every table** — no public data
3. **Price/rate frozen at point of sale** — no retroactive recalc
4. **Single-user auth in v1** — profile.role designed for future
5. **develop branch for features** — main = production (irreversible)
6. **Vercel Preview Deployment mandatory** before main merge
7. **Supabase migrations in `supabase/migrations/`** — numbered, version-controlled

---

## Common Tasks

### Add a Product Field

1. Create migration: `supabase migration new add_field_name`
2. Update `src/lib/types/database.ts` (Producto interface)
3. Update `src/lib/offline/db.ts` (LocalProducto if cached)
4. Update Zod schema if user-facing: `src/lib/schemas/actions-schemas.ts`
5. Update form: `src/components/producto-form.tsx`

### Debug Offline Sync

1. DevTools → Application → IndexedDB → `StockSalesOfflineDB`
2. Inspect `cola_ventas` → check `estado_sync` (pendiente/error/sincronizado)
3. Browser console for sync logs + errors
4. If stuck: `db.clear()` clears offline DB (⚠️ loses local drafts)

### Add Server Action

1. Create in `src/app/dashboard/[section]/actions.ts`
2. Define Zod schema in `src/lib/schemas/actions-schemas.ts`
3. `"use server"` + validate + call Supabase
4. Return result; frontend handles async
5. Test with `npm test` if critical (stock, currency)

### Modify RPC

RPCs live in Supabase (not in this repo):
1. Supabase Dashboard → SQL Editor
2. Modify RPC (e.g., `procesar_venta_transaccion`)
3. Test with sample data
4. Document in PR if signature changes (affects offline queue)

---

## Testing

**What to test:** stock calculations, currency conversions, offline sync, idempotency.

**Run:**
```bash
npm test
```

**File:** `tests/unit-critical-logic.test.ts`

**Note:** Test file includes integration tests for RPC calls (connects to Supabase Cloud). ⚠️ Supabase keys are currently inline in the test file — if credentials rotate or keys are rotated, update them; never commit real keys to git (use env vars or .env.local in future).

Write tests for critical logic (calculations, RPC, offline) before or immediately after implementation.

---

## Deployment

- **Dev:** `npm run dev` (Supabase local or dev project)
- **Preview:** Auto per branch → Vercel Preview URL
- **Prod:** Merge to main (after approval) → Vercel prod + Supabase prod
  - **Irreversible:** production customers active
  - Environment variables in Vercel dashboard, never hardcoded

---

## Debugging

| Issue | Debug Path |
|---|---|
| Auth fails | Browser console: `supabase.auth.getSession()` |
| Offline queue stuck | Dexie DB: check `cola_ventas` state + network status |
| Price/stock discrepancy | Supabase: RPC logs + `movimientos_inventario` table |
| Presupuestos not syncing | Check `presupuesto_id` linking in sale conversion |
| RLS blocks read/write | Check auth context + row ownership in policies |

---

## Configuration & Guards

Configured in `.claude/settings.json` and `.claude/hooks/guard-git.sh`:
- ✋ Vercel CLI denied
- ✋ Destructive Supabase commands denied (write MCP tools)
- ✋ `.agents/Docs/` files read-only
- ✋ push/merge to main blocked by hook

**A deny applies to the action, not to the literal tool name.** The `execute_sql`
deny covers running SQL against Supabase Cloud *however the tool is exposed in
this session* — under a different MCP server name, an alias, a renamed
equivalent, or any other mechanism that does the same thing. The deny list names
`mcp__supabase__execute_sql`, but matching some other string is not permission.
The same holds for every other entry here.

**Never run SQL against Supabase Cloud yourself** — not writes, not reads of
business data, not "just to verify". Hand the exact query or RPC to the user;
they run it in the SQL Editor and return the output. Read-only catalog
introspection (listing tables, columns, applied migrations, policies, advisors)
is fine and needs no hand-off. See "Ejecución contra Supabase Cloud" in
@AGENTS.md for the full rule.

**If blocked:** that's the correct answer. Report and wait. No workarounds.

---

## References

**Project Docs** (in `.agents/Docs/`):
- `01-PRD.md` — Requirements & user story
- `02-TRD.md` — Technical requirements & offline strategy
- `03-Flujo-App.md` — User flows & POS checkout
- `04-UIUX-Brief.md` — Design principles & layout
- `05-Esquema-Backend.md` — DB schema (critical before modifying DB)
- `06-Plan-Implementacion.md` — Phases + Definition of Done

**Frameworks:**
- Next.js 16: https://nextjs.org/docs (⚠️ breaking changes; check node_modules/next/dist/docs/)
- Supabase: https://supabase.com/docs
- Zod: https://zod.dev
- Dexie: https://dexie.org
