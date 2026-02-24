# SixMin Legal — Cowork Folder Instructions

You are working on **SixMin Legal** (formerly "Attorney Time Track"), a lean time tracking and billing app for solo attorneys. Built by a practicing attorney. Anti-Clio. Anti-bloat.

## Project Context

- **Live app:** https://attorney-time-track.vercel.app/
- **GitHub:** Rcv801/attorney-time-track
- **Stack:** React 18 + TypeScript + Vite + Supabase + shadcn/ui + Tailwind CSS + TanStack Query + React Router
- **Deploy:** Vercel (auto-deploys from main branch)

## Current State

Phase 1 is complete and live:
- Timer with pause/resume, 6-minute increment rounding
- Matters (Client → Matter hierarchy), matter pinning, quick-switch timer
- Clients page: CRUD, hourly rates, color coding
- Entries page: date filtering, CSV export
- Dashboard: today's entries, active timer with billing amount
- Supabase auth with RequireAuth, RLS on all tables

Phase 2 is fully spec'd. All specs are in `specs/phase2/`. Read them before starting any task.

## Architecture Decisions (Non-Negotiable)

- **Money fields:** Use `NUMERIC(10,2)` — never FLOAT
- **Trust ledger:** Append-only — no UPDATE or DELETE ever, trigger-enforced
- **Invoice line items:** Snapshot data at creation time — never reference live entry data
- **Stripe:** Direct (not Connect) — users connect their own Stripe account
- **PDF generation:** HTML → PDF via Supabase Edge Function
- **Settings:** Single `user_settings` table, not columns on profiles
- **Free tier:** Limit of 3 active matters only — no other limits
- **Tax field:** In schema (default 0), hidden in UI until needed
- **Client matter reference:** `client_matter_number` on matters table — needed for LEDES

## Key Spec Files

- `specs/phase2/00-overnight-summary.md` — overview of all specs + key decisions
- `specs/phase2/01-invoicing-data-model.md` — migration SQL for invoices, payments, line items
- `specs/phase2/02-trust-iolta-schema.md` — trust ledger schema
- `specs/phase2/03-stripe-integration-plan.md` — Stripe integration
- `specs/phase2/04-ledes-export-spec.md` — LEDES TypeScript exporter
- `specs/phase2/05-invoice-ui-components.md` — Invoice UI component specs
- `specs/phase2/06-reports-page-spec.md` — Reports page
- `specs/phase2/07-settings-page-spec.md` — Settings page
- `specs/phase2/12-phase2-implementation-plan.md` — Sprint plan (start here)

## Code Style

- TypeScript strict mode — no `any`
- shadcn/ui components for all UI — do not introduce new component libraries
- TanStack Query for all server state — no raw fetch in components
- Supabase client from `src/integrations/supabase/client.ts`
- Types from `src/integrations/supabase/types.ts` — regenerate after any migration
- Tailwind for all styling — no inline styles, no CSS modules
- Named exports for components
- Co-locate hooks with the page/component that owns them unless reusable

## Supabase

- Project config in `supabase/` directory
- Run migrations via Supabase Dashboard SQL editor or `supabase db push`
- After any migration: regenerate types with `supabase gen types typescript --linked > src/integrations/supabase/types.ts`
- RLS must be enabled on every new table — no exceptions
- Edge Functions go in `supabase/functions/`

## What NOT to Build

- No case/document management
- No CRM or client intake
- No general ledger accounting
- No AI writing (beyond billing narratives — future)
- No calendaring
- No marketing tools

## Tone

Solo attorneys are busy and hate bloat. Every UI decision should reduce friction. If something takes more than 2 clicks, ask whether it needs to exist.
