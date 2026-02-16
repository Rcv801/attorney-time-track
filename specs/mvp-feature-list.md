# Attorney Time Track — MVP Feature List

*Created: February 9, 2026*
*Based on: Competitive analysis, Reddit pain-point research, niche competitor study*
*Philosophy: The Anti-Clio — track time, send invoices, get paid. Nothing else.*

---

## Core Must-Haves

These are the essential features any viable legal time-tracking and billing tool needs to ship with. Without these, we don't have a product.

### 1. Instant Matter-Switching Timer
A persistent, always-accessible timer that lets attorneys switch between matters with a single click or tap. Attorneys bounce between 6–10 matters daily; every extra click is lost adoption. The timer should show the current matter and elapsed time at all times.

### 2. Manual / After-the-Fact Time Entry
Attorneys forget to start timers — it's the #1 pain point in every Reddit thread. Make it dead simple to enter time after the fact with date, duration, matter, and description. Forgive bad habits instead of punishing them.

### 3. Smart Autocomplete for Clients, Matters & Task Codes
Type 2–3 characters to find a client or matter. Comes pre-populated with common legal task codes (Research, Drafting, Court Appearance, Client Communication, etc.) and allows users to add their own custom codes for frequent tasks, reducing entry friction to near-zero.

### 4. 0.1-Hour (6-Minute) Billing Increments
The legal billing standard. Automatic rounding with configurable rules (round up to nearest tenth, minimum increment, etc.).

### 5. Multiple Billing Types
Support hourly, flat-fee, and contingency billing at the matter level. Different practice areas bill differently — this can't be an afterthought.

### 6. Professional Invoice Generation
Generate clean, customizable invoices directly from tracked time entries. Support PDF export and direct email to clients. Attorneys shouldn't need a separate tool to turn time into invoices.

### 7. Online Payment Acceptance
Integrate with Stripe and/or LawPay so clients can pay invoices online. Payment links on every invoice. Separate processing for trust vs. operating accounts to maintain compliance.

### 8. Trust / IOLTA Account Tracking
Track retainer deposits, disbursements, and per-client balances. Attorneys face bar discipline for trust accounting errors — this is table stakes for any legal billing tool. Keep it lightweight (not full general-ledger accounting), but accurate.

### 9. LEDES Billing Export
Many attorneys billing insurance defense or corporate clients are required to submit in LEDES format. Competitors lock this behind $65–99/mo tiers. We include it for everyone.

### 10. Matter Organization
Basic matter/case structure: client → matter, with status, billing rate, and key dates. Not full case management — just enough to organize billing around.

### 11. Mobile-Responsive Web App (PWA)
Attorneys are in court, in meetings, in their car. A fast, mobile-first progressive web app for time entry and timer control is essential. No native app needed at MVP — a great PWA is enough.

### 12. Expense Tracking
Log hard costs (filing fees, copies, postage) against matters for inclusion on invoices. Simple line items with date, amount, description, and matter.

### 13. Attorney & Task Analytics
Generate reports on key practice metrics. For solos, this includes revenue by period, hours by matter, and accounts receivable. For firms, admins can view billable hours and revenue broken down by attorney. All users can analyze their own time, breaking it down by task type (e.g., 'Drafting', 'Court Appearance') to understand where their time is going.

### 14. Automated Email Activity Summaries
Users can configure automatic email summaries of their billing activity on a daily or weekly schedule. Summaries include total hours billed, revenue generated, and a per-client/matter breakdown. Firm admins can receive firm-wide summaries across all attorneys. Fully configurable — choose frequency, level of detail, and whether to include only active matters or everything.

### 15. Data Export
Full CSV/Excel export of all time entries, invoices, and financial data. No lock-in. Attorneys should be able to leave at any time with all their data.

### 15. 5-Minute Onboarding
No demos, no sales calls, no "guided implementation." Sign up → set your billing rate → create a matter → start tracking. The entire setup flow should take under 5 minutes.

---

## Unique Differentiators

These features set Attorney Time Track apart from every competitor. They address the deepest pain points uncovered in our research and embody the Anti-Clio philosophy.

### 16. AI-Powered Billing Narrative Generation
The killer feature. Attorneys spend 10–30 hours/month cleaning up and writing billing descriptions. Our AI takes sparse timer notes and activity context and drafts professional, ethically appropriate billing narratives. The attorney reviews, edits if needed, and approves. This alone can save days per month.

**Why it matters:** "Spending 10-30 hrs per month to do 'billing'… is this normal?" — a post with 111 upvotes on r/Lawyertalk. Yes, it's normal. We make it not.

### 17. Privacy-First / Local-First Architecture
All data encrypted at rest and in transit. Option for local-only data storage (never touches our servers unless the user opts in to sync). No selling data, no training AI on client information, no third-party analytics tracking. A dedicated privacy page explaining exactly what we do and don't do with data.

**Why it matters:** TimeNet Law built fierce loyalty with a "Privacy Fortress" approach. Attorneys handle privileged, confidential client data — privacy isn't a feature, it's an ethical obligation. No competitor in the modern/cloud space takes this seriously.

### 18. Gentle Nudge System
Configurable, non-annoying reminders: "You haven't logged time in 2 hours — working on something?" Frequency, timing, and channels (push notification, in-app, email) are fully user-controlled. Can be turned off entirely.

**Why it matters:** The core problem isn't bad software — it's that attorneys forget to track time. A smart nudge system bridges the gap between good intentions and consistent time capture.

### 19. One-Click Invoice Generation & Send
Select a date range, review auto-compiled entries (with AI-generated narratives), and send professional invoices in one click. The goal: make "billing day" disappear as a concept.

**Why it matters:** End-of-month billing is universally dreaded. Competitors require multi-step, multi-day invoice generation workflows. We compress it to minutes.

### 20. Radically Simple, Transparent Pricing
One plan. Every feature included. No tiers, no add-ons, no "contact sales." Price listed publicly on the website. Target: **$19/user/month** ($15/user/month annual) — 50–75% cheaper than every legal-specific competitor.

**Why it matters:** The $15–30/month price point is completely empty in the legal billing market. Between Harvest ($11/mo, no legal features) and MyCase ($39/mo, bloated suite), there is nothing. We own this gap.

### 21. Built by a Practicing Attorney
Not a feature per se, but the most powerful differentiator we have. The founder lives these pain points daily. Every UX decision is informed by actual legal practice, not product manager guesswork. This becomes the core of our brand voice and marketing.

**Why it matters:** No major competitor was built by a practicing attorney. Reddit threads consistently show attorneys trust other attorneys' recommendations over vendor marketing.

### 22. Anti-Bloat Commitment
A public, documented commitment to what we will **never** build: full practice management, CRM, document automation, marketing tools, email management, website builders. We do time tracking, invoicing, and trust accounting — and we do them better than anyone.

**Why it matters:** Every competitor started focused and bloated over time (usually after PE/VC investment). Attorneys are tired of paying for features they don't use. Our restraint is our edge — inspired by Time59's 18 years of radical feature discipline.

### 23. Spreadsheet Import & Easy Migration
One-click import from Excel/CSV for existing time entries, client lists, and matter data. Many solo attorneys have years of data in spreadsheets. We meet them where they are and make switching painless.

**Why it matters:** Switching costs are a major reason attorneys stay on tools they hate. Eliminate the friction and they'll switch.

### 24. Offline-Capable
Full functionality without an internet connection. Entries sync when connectivity returns. Attorneys work in courthouses, rural areas, and planes — they can't depend on WiFi to track time.

**Why it matters:** Aligns with our privacy-first architecture and solves a real-world reliability problem that pure cloud competitors can't address.

---

## What We Deliberately Exclude (The Anti-Feature List)

Staying lean is a feature. We will **not** build:

- ❌ Full case/practice management
- ❌ CRM or client intake forms
- ❌ General ledger accounting
- ❌ Document automation or management
- ❌ AI writing/drafting (beyond billing narratives)
- ❌ Marketing tools or website builders
- ❌ Email management
- ❌ Calendaring (we integrate, not replace)

These are what make competitors bloated and expensive. Let Clio fight for that market. We own billing.

---

## Summary

| Category | Count | Philosophy |
|----------|-------|------------|
| Core Must-Haves | 15 | Everything a legal billing tool needs to be taken seriously |
| Unique Differentiators | 9 | What makes us the obvious choice for solo/small firm attorneys |
| Anti-Features | 8 | What keeps us lean, fast, and affordable |

**Target user:** Solo attorneys and small firms (1–5 attorneys) who are either overpaying for Clio/MyCase or cobbling together spreadsheets and generic tools.

**Target price:** $19/user/month (all features included, no tiers).

**Core promise:** Track time in seconds. Generate invoices in minutes. Get paid in days. Nothing else.
