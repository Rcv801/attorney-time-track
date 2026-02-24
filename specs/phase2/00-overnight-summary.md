# Phase 2 Overnight Specs — Summary

*Generated February 18, 2026*

---

## What Was Produced

12 specification files covering every aspect of Phase 2:

| # | File | What It Contains |
|---|------|-----------------|
| 01 | `01-invoicing-data-model.md` | Full Supabase migration SQL: expanded invoices table, invoice_line_items, payments, expenses, invoice_sequences, RLS policies, triggers for auto-balance updates, unbilled_entries view |
| 02 | `02-trust-iolta-schema.md` | Append-only trust_ledger table with balance validation triggers, immutability enforcement, running balance assertions, reconciliation support, helper function `record_trust_transaction()`, auto-sync to matters.trust_balance |
| 03 | `03-stripe-integration-plan.md` | Stripe Direct (not Connect) architecture, Edge Functions for payment link creation and webhook handling, trust vs operating account routing, PCI SAQ-A compliance, code snippets for all integration points |
| 04 | `04-ledes-export-spec.md` | Complete TypeScript LEDES 1998B + 2000 exporter with field mappings, UTBMS code reference tables, sample output, download helper, builder function from our data model |
| 05 | `05-invoice-ui-components.md` | Full component tree, InvoiceBuilder 4-step wizard, InvoiceList, InvoiceDetail, PaymentDialog, PDF layout spec, data flow, TanStack Query keys |
| 06 | `06-reports-page-spec.md` | 4 summary cards, revenue bar chart, hours by matter/client, AR aging, SQL queries, recharts implementation, CSV export, filter specs |
| 07 | `07-settings-page-spec.md` | One-page settings: firm info, billing defaults, invoice defaults, Stripe connection, email templates, data export. Includes `user_settings` table schema |
| 08 | `08-competitive-feature-matrix.md` | Feature-by-feature comparison tables: SixMin vs Bill4Time vs TimeSolv vs Toggl vs Clio across pricing, time tracking, invoicing, trust, LEDES, mobile, integrations, privacy, ownership |
| 09 | `09-landing-page-copy.md` | Full landing page copy: hero, problem statement, 6 feature sections, pricing with competitor comparison, "built by attorney" section, FAQ (8 questions), footer CTA, testimonial structure, SEO meta |
| 10 | `10-seo-keywords.md` | Primary/secondary/long-tail keywords with volume estimates, comparison page strategy, blog content plan (5 launch posts + monthly cadence), meta descriptions for 6 key pages, distribution channels |
| 11 | `11-onboarding-flow.md` | 3-step flow: signup → firm setup → first client/matter. Screen mockups with copy, validation rules, skip behavior, auto-start timer on completion, route guards, onboarding state tracking |
| 12 | `12-phase2-implementation-plan.md` | 6-sprint plan (12 weeks), 50+ tasks with sizes (S/M/L), dependency graph, parallelization matrix, risk register, success metrics |

---

## Key Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Stripe Direct, not Connect** | Simpler for solo attorneys. Each user connects their own Stripe account. We never touch funds. |
| **NUMERIC, not FLOAT for money** | Exact decimal arithmetic. Required for financial software. |
| **Append-only trust ledger** | Bar requirement. Corrections are new entries, never edits. Trigger-enforced immutability. |
| **Running balance assertions** | Every trust entry stores post-transaction balance. DB trigger validates chain. Prevents any bug from corrupting the ledger. |
| **Invoice line items snapshot data** | Line items capture entry data at invoice time. Editing an entry later doesn't change the invoice — accounting requirement. |
| **Payment trigger updates invoice balance** | Invoice `amount_paid`, `balance_due`, and `status` auto-update when payments are recorded. No manual reconciliation needed. |
| **`user_settings` table vs profiles columns** | Clean separation. Profiles = auth identity. Settings = app preferences. Easier to extend. |
| **HTML→PDF via Edge Function** | More flexible than `@react-pdf/renderer`. Full CSS control. Better for iteration. |
| **One-page settings** | Counter to Bill4Time's 11 tabs. Solo attorneys shouldn't need a manual for settings. |
| **LEDES included for all tiers** | Key differentiator. Competitors charge $55-119/mo for LEDES. We include it at $19/mo. |

---

## Open Questions for Ryan

1. **Invoice PDF approach:** Edge Function with Puppeteer (server-side) vs client-side library? Puppeteer is more flexible but adds Edge Function complexity. Client-side is simpler but less control over output.

2. **Email sending:** Supabase doesn't have built-in email sending. Options: Resend ($0 for 100 emails/day), Postmark ($1.25/1000), or Supabase's upcoming email service. Which do you prefer?

3. **Stripe OAuth vs manual key entry:** OAuth is better UX but requires registering as a Stripe platform. Manual key entry works immediately but is more technical for the user. Start with manual, add OAuth later?

4. **Free tier limits:** Spec says 3 active matters. Should we also limit: invoices per month? Entries per month? Or keep it simple at just matter count?

5. **Tax rate on invoices:** Most attorneys don't charge sales tax on legal services (exempt in most states). Should we include the tax field but default to 0? Or hide it entirely and add later?

6. **Client matter reference field:** Some clients (especially corporate) have their own matter reference numbers. Should this be on the matter model or only on invoices? Added to LEDES export mapping but not yet in the DB.

7. **Landing page tech:** Build with the existing Vite/React stack? Or separate Next.js site for better SEO (SSR/SSG)? Or a simple static site?

8. **When to do comparison page competitor teardowns?** The matrix is done but the actual `/compare/clio` pages need fresh pricing checks closer to launch.

---

## Estimated Total Effort

Based on the implementation plan (12-phase2-implementation-plan.md):

- **6 sprints × 2 weeks = ~12 weeks** for a single developer
- **With parallelization (2 tracks): ~8 weeks**
- **Critical path:** Migrations → Invoice Builder → PDF/Email → Payments → Launch

The database migrations (Sprint 1) should be run first — everything else depends on them.
