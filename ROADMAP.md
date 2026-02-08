# Attorney Time Track — Product Vision & Roadmap

**Last updated:** February 7, 2026

---

## Positioning

**Tagline:** "Track time. Send invoices. Get paid. Nothing else."

**Target Market:** Solo attorneys and small firms (1-5 people) who are currently using spreadsheets/legal pads or overpaying for bloated platforms like Clio/MyCase.

**The Opportunity:** The $15-30/mo price point is completely empty in legal billing. Everything is either a $9 generic tracker with no legal features or a $39+ bloated practice management suite.

---

## Core Features (The "Why This Exists")

### 1. Timer + Time Entry
- ✅ **Pause/resume** — built
- ✅ **Manual entry for forgotten time** — built
- ✅ **Popout timer window** — built
- ✅ **6-minute increment rounding** — legal standard (0.1 hr increments)
- ✅ **Quick-switch timer** — tap matter to switch, inline notes, recent matters list
- 📋 **Gentle nudge notifications** — "You haven't logged time in 2 hours" (Phase 3)

### 2. Matters (THE Missing Piece)
Attorneys track time per **matter** (case), not just per client. One client can have multiple active matters.

- 🔄 **Matters data model** — Client → Matters → Entries (NEEDS IMPLEMENTATION)
- Matter status: Active / Closed
- Matter number for reference
- Time entries attach to a matter
- This is what separates a legal tool from a generic tracker

### 3. Invoicing
- 🔄 **Generate invoice PDF from unbilled entries** — filtered by matter (NEEDS IMPLEMENTATION)
- Professional output with firm name, matter details, itemized entries
- Hourly + flat fee billing support
- Email invoice directly to client
- ✅ **Mark entries as invoiced** — partially built, needs protection from editing
- 🔄 **Payment tracking** — paid/unpaid/partial (NEEDS IMPLEMENTATION)

### 4. Trust/IOLTA Tracking
Table stakes for legal. This is why attorneys can't just use Toggl.

- 🔄 **Retainer deposits per matter** (NEEDS IMPLEMENTATION)
- 🔄 **Auto-draw-down as time is billed** (NEEDS IMPLEMENTATION)
- 🔄 **Current balance display per matter** (NEEDS IMPLEMENTATION)

### 5. Online Payments
- 🔄 **Stripe integration** (NEEDS IMPLEMENTATION)
- Pay link in invoice email
- Proper handling of trust vs. operating account deposits

---

## Supporting Features (Usable, Not Bloated)

### 6. Clients Management
- ✅ **Add, edit, archive clients** — built
- ✅ **Hourly rate per client** — built
- ✅ **Color coding** — built
- 🔄 **Parent of matters** — needs Matters model first

### 7. Dashboard
- ✅ **Today's entries list** — built
- ✅ **Active timer with billing amount** — built
- 🔄 **Quick stats** — hours this week, unbilled amount (Phase 2)

### 8. Reports (Lean)
- Hours by matter/client/period
- Revenue collected vs. outstanding
- Utilization rate
- **NO fancy analytics dashboards** — just the numbers attorneys need

### 9. Settings
- Firm name & address (for invoice header)
- Default billing rate
- Billing increment (6-minute default)
- Basic invoice template customization

### 10. LEDES Export
- Format required by insurance companies and corporate clients
- Competitors lock this behind $65-99/mo tiers
- We include it for everyone — huge differentiator

### 11. Mobile-Responsive
- Web app works perfectly on phone
- PWA so it can be "installed" from browser
- Timer is the #1 mobile use case

---

## Never Build (How We Stay Lean)

These are the features that make competitors bloated and expensive. Let Clio and MyCase fight over this market:

- ❌ Case management / document management
- ❌ CRM / client intake forms
- ❌ Full accounting / general ledger
- ❌ Document automation / templates
- ❌ AI writing assistant
- ❌ Calendar management
- ❌ Email integration
- ❌ Marketing tools / website builders
- ❌ Conflict checking (maybe V3+)

---

## Implementation Roadmap

### Phase 1 — MVP (Build Now)
1. **Matters data model** — database schema, types, relationships
2. **6-minute increment rounding** — display and storage
3. **Quick-switch timer** — tap matter to switch timers
4. **Invoice generation** — PDF from time entries
5. **Basic trust/retainer balance** — per matter

### Phase 2 — Launch-Ready
6. Email invoices to clients
7. Stripe payment integration
8. Payment status tracking (paid/unpaid/partial)
9. LEDES export
10. Reports page (hours, revenue, outstanding AR)

### Phase 3 — Growth
11. PWA / mobile optimization
12. Gentle nudge notifications
13. Flat fee billing workflows
14. Multi-user support (Firm plan)
15. QuickBooks sync

---

## Pricing Strategy

Based on research: the $15-30/mo range is completely empty.

| Plan | Price | Features |
|------|-------|----------|
| **Free** | $0 | 1 user, 3 active matters, basic invoicing (get them in the door) |
| **Solo** | $19/mo ($15/mo annual) | Unlimited matters, trust tracking, LEDES, payments |
| **Firm** | $29/user/mo ($23/mo annual) | Multi-user, reporting, batch billing |

**Value prop:** Undercuts every legal competitor by 50%+ while covering everything a solo actually needs.

---

## Key Research Insights

From `research/competitor-analysis.md` and `research/reddit-pain-points.md`:

1. **#1 pain point:** Attorneys forget to track time → lost revenue
2. **#2:** Existing tools too expensive ($89-250/mo for Clio)
3. **#3:** Everything is bloated — solos want billing, not all-in-one
4. **Killer feature opportunity:** Passive time capture (monitoring email/calendar)
5. **No competitor was built by a practicing attorney** — genuine differentiator

---

## Success Criteria

The app succeeds if a solo attorney can:
1. Sign up in under 2 minutes
2. Add a client and matter in under 1 minute
3. Track time across 3-4 matters in a day without friction
4. Generate and send an invoice in under 5 minutes
5. Never think "I should just go back to my spreadsheet"

---

## Current Status (Feb 7, 2026)

**Built ✅:**
- Running timer with start/stop/pause/resume
- Client selector with color coding and hourly rates
- Manual entry form (date, client, start/end, notes)
- Today's entries list with edit/delete
- Full entries page with date filtering, CSV export, print, archive
- Timer popout window
- Stop timer dialog with notes
- Clients page (add, edit, archive, color, rate)
- Invoice creation dialog (UI only)
- Supabase auth with RequireAuth
- Real-time billing amount display

**Missing 🔄:**
- Matters data model
- 6-minute increment rounding
- Quick-switch timer
- Invoice PDF generation
- Trust/retainer tracking
- LEDES export
- Stripe payments
- Email delivery
- Reports

---

*This document should be updated as features are completed or priorities shift.*
