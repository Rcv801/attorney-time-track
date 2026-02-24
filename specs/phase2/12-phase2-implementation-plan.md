# 12 — Phase 2 Implementation Plan

*Phase 2 Spec — Created February 18, 2026*

---

## Implementation Order

The order prioritizes: (1) database foundation first, (2) core billing workflow, (3) payments, (4) polish & marketing.

---

## Sprint 1: Database & Settings Foundation (Week 1-2)

| # | Task | Spec | Size | Depends On |
|---|------|------|------|-----------|
| 1.1 | Run invoicing migration SQL | 01 | S | — |
| 1.2 | Run trust/IOLTA migration SQL | 02 | S | — |
| 1.3 | Regenerate Supabase TypeScript types | — | S | 1.1, 1.2 |
| 1.4 | Create `user_settings` table + migration | 07 | S | — |
| 1.5 | Build Settings page (firm info, billing defaults) | 07 | M | 1.4 |
| 1.6 | Build onboarding flow (signup → setup → first client) | 11 | M | 1.4 |
| 1.7 | Add expense CRUD (form + list on Entries page) | 01 | M | 1.1 |

**Deliverable:** Database is production-ready. Settings page works. New users get smooth onboarding. Expenses can be tracked.

---

## Sprint 2: Invoice Builder (Week 3-4)

| # | Task | Spec | Size | Depends On |
|---|------|------|------|-----------|
| 2.1 | InvoicesPage with empty state | 05 | S | 1.1 |
| 2.2 | InvoiceList component (table, filters, status badges) | 05 | M | 2.1 |
| 2.3 | InvoiceBuilder Step 1: Client/Matter select | 05 | S | 2.1 |
| 2.4 | InvoiceBuilder Step 2: Entry selector (unbilled entries) | 05 | M | 2.3 |
| 2.5 | InvoiceBuilder Step 3: Preview + totals | 05 | M | 2.4 |
| 2.6 | Invoice creation logic (insert invoice + line items + mark entries billed) | 05 | M | 2.5 |
| 2.7 | InvoiceDetail page (view invoice, line items, totals) | 05 | M | 2.6 |
| 2.8 | Invoice number sequence integration | 01 | S | 2.6 |
| 2.9 | Add /invoices route to React Router | — | S | 2.1 |

**Deliverable:** Full invoice creation workflow. Select entries → preview → create invoice. View created invoices.

---

## Sprint 3: PDF, Email & Payments (Week 5-6)

| # | Task | Spec | Size | Depends On |
|---|------|------|------|-----------|
| 3.1 | Invoice PDF generation (Edge Function or client-side) | 05 | L | 2.7 |
| 3.2 | Invoice email sending (Edge Function) | 05 | M | 3.1 |
| 3.3 | PaymentDialog component (record manual payments) | 05 | M | 2.7 |
| 3.4 | Payment history on InvoiceDetail | 05 | S | 3.3 |
| 3.5 | Stripe key storage + Settings UI | 03 | M | 1.5 |
| 3.6 | `create-payment-link` Edge Function | 03 | M | 3.5 |
| 3.7 | `stripe-webhook` Edge Function | 03 | M | 3.6 |
| 3.8 | Payment link on invoice email | 03 | S | 3.2, 3.6 |
| 3.9 | Invoice status auto-update on payment (verify trigger) | 01 | S | 3.3 |

**Deliverable:** Full billing cycle works. Generate PDF → email with payment link → record payments → auto-update status.

---

## Sprint 4: Trust UI & LEDES (Week 7-8)

| # | Task | Spec | Size | Depends On |
|---|------|------|------|-----------|
| 4.1 | Trust balance display on matter detail | 02 | S | 1.2 |
| 4.2 | Trust deposit form (record deposits) | 02 | M | 4.1 |
| 4.3 | Trust ledger view (transaction history per matter) | 02 | M | 4.2 |
| 4.4 | Trust application on invoices (apply trust to invoice balance) | 02, 05 | M | 4.2, 2.6 |
| 4.5 | Trust disbursement on invoice creation | 02 | M | 4.4 |
| 4.6 | LEDES export function (`src/lib/ledes.ts`) | 04 | M | — |
| 4.7 | LEDES export button on InvoiceDetail | 04 | S | 4.6, 2.7 |
| 4.8 | UTBMS task code selector on entries (optional field) | 04 | S | 4.6 |

**Deliverable:** Trust accounting UI is complete. LEDES export works from any invoice.

---

## Sprint 5: Reports & Polish (Week 9-10)

| # | Task | Spec | Size | Depends On |
|---|------|------|------|-----------|
| 5.1 | Reports page — summary cards | 06 | M | 1.1 |
| 5.2 | Revenue chart (billed vs collected by month) | 06 | M | 5.1 |
| 5.3 | Hours by matter chart | 06 | S | 5.1 |
| 5.4 | AR aging table/chart | 06 | M | 5.1 |
| 5.5 | Hours by client pie chart | 06 | S | 5.1 |
| 5.6 | Report CSV export | 06 | S | 5.1 |
| 5.7 | Dashboard enhancements (unbilled total, outstanding AR) | — | S | 5.1 |
| 5.8 | Invoice void/write-off flow | 05 | S | 2.7 |
| 5.9 | Overdue invoice auto-detection (cron or on-load check) | — | S | 2.7 |

**Deliverable:** Reports page live. Dashboard shows key financial metrics. Invoice lifecycle is complete.

---

## Sprint 6: Landing Page & Launch Prep (Week 11-12)

| # | Task | Spec | Size | Depends On |
|---|------|------|------|-----------|
| 6.1 | Landing page (sixminlegal.com) | 09 | L | — |
| 6.2 | Comparison pages (/compare/clio, etc.) | 10 | M | 6.1 |
| 6.3 | SEO setup (meta tags, sitemap, schema.org) | 10 | S | 6.1 |
| 6.4 | Blog setup + first 2 posts | 10 | M | 6.1 |
| 6.5 | Free tier implementation (3-matter limit) | — | M | — |
| 6.6 | Stripe subscription billing (for SixMin itself) | — | L | 3.5 |
| 6.7 | Data export (CSV/JSON) in Settings | 07 | M | 1.5 |
| 6.8 | End-to-end testing (happy path) | — | L | All |
| 6.9 | Bug fixes, polish, edge cases | — | L | All |

**Deliverable:** Ready for public launch.

---

## Complexity Guide

| Size | Estimated Time | Example |
|------|---------------|---------|
| **S** | 1-3 hours | Add a route, a badge component, a database column |
| **M** | 4-8 hours | A full form with validation, an Edge Function, a chart |
| **L** | 1-3 days | PDF generation, landing page, Stripe subscription system |

---

## Parallelization Opportunities

These can be worked on simultaneously by different people (or in parallel sessions):

| Track A (Backend/DB) | Track B (Frontend/UI) | Track C (Marketing) |
|----------------------|----------------------|---------------------|
| 1.1-1.2 Migrations | 1.5 Settings page | 6.1 Landing page |
| 3.5-3.7 Stripe Edge Functions | 2.1-2.5 Invoice Builder | 6.2-6.4 SEO + Blog |
| 4.6 LEDES export lib | 4.1-4.3 Trust UI | 6.5 Free tier logic |

---

## Dependency Graph (Critical Path)

```
Migrations (1.1, 1.2)
    ↓
Types regenerated (1.3)
    ↓
Settings page (1.5) ──────────────────→ Stripe setup (3.5)
    ↓                                        ↓
Onboarding (1.6)                     Payment link (3.6)
    ↓                                        ↓
InvoiceBuilder (2.1-2.6)             Webhook (3.7)
    ↓                                        ↓
InvoiceDetail (2.7)                  Payment recording (3.3)
    ↓                                        ↓
PDF generation (3.1)                 Trust UI (4.1-4.5)
    ↓                                        ↓
Email sending (3.2)                  LEDES export (4.6-4.7)
    ↓                                        ↓
Reports (5.1-5.6)                    Landing page (6.1)
    ↓                                        ↓
Launch prep (6.5-6.9)               SEO + Blog (6.2-6.4)
```

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|-----------|
| PDF generation complexity | Could take 3+ days | Start with simple HTML→PDF via Puppeteer. Iterate on design later. |
| Stripe webhook reliability | Missed payments | Implement idempotency keys. Add manual payment recording as fallback. |
| Trust balance race conditions | Data integrity | DB trigger validates balance. Use `record_trust_transaction` helper exclusively. |
| LEDES format edge cases | Invalid exports | Test against real LEDES validators. Start with simple invoices. |
| Scope creep on landing page | Delays launch | Ship MVP landing page. Iterate based on feedback. |
| Onboarding drop-off | Low activation | Measure at each step. Minimize required fields. |

---

## Success Metrics (Phase 2 Complete)

| Metric | Target |
|--------|--------|
| Full billing cycle works | ✅ Track → Invoice → Pay → Record |
| Trust accounting functional | ✅ Deposit → Disburse → Audit trail |
| LEDES export valid | ✅ Passes LEDES validator |
| Reports show key metrics | ✅ Revenue, hours, AR aging |
| Landing page live | ✅ sixminlegal.com |
| Free tier functional | ✅ 3 matters, limited features |
| < 5 min onboarding | ✅ Measured via analytics |
| 0 trust accounting bugs | ✅ Critical — bar discipline risk |
