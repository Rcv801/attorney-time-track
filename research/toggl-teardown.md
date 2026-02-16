# Toggl Track Competitive Teardown
**Date:** 2026-02-15
**Account:** Trial (30 days, Premium)
**URL:** track.toggl.com

---

## Overview
Toggl Track is a general-purpose time tracker with 5M+ users. Not legal-specific, but markets to lawyers via dedicated landing pages. Pricing: Free (5 users), $10 Starter, $20 Premium. Modern React SPA.

## First Impressions
- **Login:** Email + Password, Google, Apple, Passkey, SSO — 5 auth options. Two fields. No "Company ID" nonsense.
- **Onboarding:** Fast. Ryan confirmed it was quick to get started.
- **Immediate landing:** Timer page with "What are you working on?" — you can start tracking within seconds of signing up.

## Navigation (Sidebar)
Clean, organized sidebar with clear sections:

**TRACK**
- Overview
- Timer

**ANALYZE**
- Reports (expandable)
- Approvals

**MANAGE**
- Projects
- Clients
- Members
- Billable rates
- Invoices
- Tags
- Goals
- Integrations (NEW)

**ADMIN**
- Subscription
- Settings

**Verdict:** ~13 items but well-grouped. Feels manageable because of the hierarchy. Bill4Time has 11 top-level items crammed into a flat nav bar — worse UX despite fewer items.

## Timer (Core Experience)
- **Always visible** at the top of every page — "What are you working on?" prompt
- **Big pink play button** — impossible to miss
- **Inline controls:** Project selector, tag selector, billable toggle ($), duration display
- **3 views:** Calendar, List view, Timesheet
- **Week view** with daily hour totals per day column
- **Manual mode** toggle available
- **Zoom controls** on calendar view

**What's brilliant:** The timer bar persists across all pages. You never have to navigate to "start tracking." This is the gold standard for timer UX.

**What we should steal:** Persistent timer bar. "What are you working on?" as the primary prompt. Calendar view for visual time blocking.

## Invoicing
- "Create invoice from reports" button (top right)
- **Workflow:** Track time → Go to Reports → Create invoice from report data
- **Connect QuickBooks** button prominent
- Empty state shows 3-step visual: Track time → Create invoice → View/edit invoice
- Invoicing is generated FROM time data, not as a separate module

**What's good:** Invoice creation from tracked time is a smart workflow — the data flows naturally.
**What's missing:** No trust/IOLTA. No LEDES. No legal invoice templates. No matter-based billing. It's a generic invoice.

## Billable Rates
5 levels of rate hierarchy (most granular wins):
1. Workspace rate (most general)
2. Workspace member rate
3. Project rate
4. Project member rate
5. Task-specific rate (most granular)

- Workspace Rate = STARTER tier ($10/mo)
- Member rates = PREMIUM tier ($20/mo)
- Labor costs tracking available
- Billable/Non-billable toggle per workspace

**What's good:** Granular rate hierarchy is well-designed. The cascade logic (most specific wins) is intuitive.
**What's missing:** No retainer/trust balance concept. No flat-fee billing. No contingency tracking. All hourly.

## Reports
Tabs: Summary, Detailed, Workload, Profitability, My reports

- **Summary:** Total Hours, Billable Hours, Amount, Average Daily Hours
- **Charts:** Duration by day (stack by Billable), Project breakdown (slice by Projects)
- **Filters:** Member, Client, Project, Task, Tag, Description
- **Rounding toggle** in reports header (not in time entry — applied at report/export level)
- **Save & share** reports
- **Export** available

**What's good:** Clean, visual, filterable. Rounding at report level is smart — you track actual time, round only when billing.
**What's notable:** Rounding is a REPORT feature, not a TIME ENTRY feature. Different philosophy from Bill4Time (which rounds on entry). Both approaches have merit.

## Settings
Tabs: General, Alerts, Reminders (locked), Billable rates (locked), CSV import, Data export, Single Sign On, Activity, Audit Log

**General settings:**
- Workspace name + logo
- Team member rights (who can see activity, create projects/clients/tags)
- Project & Billing defaults (set new projects as billable, hourly rate, currency)
- Time entry restrictions (required fields, lock entries — PREMIUM)
- Time entry settings (hide/show start+end times)
- Timesheet view (show/hide)
- Approvals (enable/disable)
- Smart Expense Management (AI-powered receipt scanning via Toggl Work)
- Reporting (collapse small entries in PDF exports)

**What's good:** Settings on ONE page (scrollable). Not 11 tabs like Bill4Time. Clean, scannable.
**What's notable:** "Smart Expense Management" with AI receipt scanning — they're adding AI features.

## What They Do Well (Study This)
1. **Timer UX is best-in-class** — persistent top bar, one-click start, always visible
2. **Clean information architecture** — grouped sidebar, not a flat nav
3. **Modern SPA** — fast, no page reloads, responsive
4. **Settings simplicity** — one scrollable page vs 11 tabs
5. **Auth options** — Email, Google, Apple, Passkey, SSO. Frictionless.
6. **Onboarding speed** — seconds to first time entry
7. **Visual design** — consistent, modern, playful illustrations for empty states
8. **Rounding in reports** — track real time, round when billing. Smart.
9. **Rate hierarchy** — 5 levels, most specific wins. Well thought out.
10. **QuickBooks integration** prominent on invoice page

## What They Don't Have (Our Opportunity)
1. **No trust/IOLTA accounting** — zero
2. **No LEDES export** — not available at any tier
3. **No matter-based billing** — uses "Projects" (generic)
4. **No legal terminology** — projects, not matters; tags, not activity codes
5. **No conflict checking**
6. **No retainer tracking**
7. **No legal invoice templates** (court-compliant formatting)
8. **No ABA standard codes**
9. **No 6-minute rounding on entry** — only at report level
10. **No trust balance per client**

## Tech Stack
- React SPA (modern)
- Clean URLs (/timer, /invoice, /reports)
- Fast navigation, no full page reloads
- Responsive design
- Desktop apps, mobile apps, browser extensions
- 100+ integrations (Clio included)

## UX Patterns to Steal
- **Persistent timer bar** across all pages
- **"What are you working on?"** as primary prompt (natural language, not form fields)
- **Calendar view** for visual time blocking
- **Empty states with illustrations** (friendly, not clinical)
- **Grouped sidebar navigation** with section headers
- **Rounding toggle in reports** (track actual, round on export)
- **Rate hierarchy cascade** (workspace → member → project → task)
- **One-page settings** (scrollable, not tabbed)

## UX Patterns to Improve On
- **Replace "Projects" with "Matters"** — legal-specific language matters
- **Add trust balance inline** — show it on the matter/client view
- **6-min rounding on entry AND report** — give attorneys the choice
- **Dashboard should show: hours today, unbilled total, upcoming deadlines** — not charts about "Workload" and "Profitability"
- **Invoice should pull from matter, not from report** — attorneys think matter-first

## Pricing Comparison
| Feature | Toggl Free | Toggl Starter ($10) | Toggl Premium ($20) | Us ($19-29) |
|---------|-----------|-------------------|-------------------|-------------|
| Timer | ✅ | ✅ | ✅ | ✅ |
| Billable rates | ❌ | ✅ Workspace level | ✅ All levels | ✅ All levels |
| Invoicing | ❌ | ❌ | ✅ | ✅ |
| Rounding | ❌ | ✅ | ✅ | ✅ |
| Trust/IOLTA | ❌ | ❌ | ❌ | ✅ |
| LEDES | ❌ | ❌ | ❌ | ✅ |
| Matter-based | ❌ | ❌ | ❌ | ✅ |
| QuickBooks | ❌ | ❌ | ✅ | Phase 2 |

**Our value prop vs Toggl:** "Everything Toggl Premium has, plus trust accounting, LEDES export, and legal-specific workflows — at the same price point."

---

## Strategic Summary

Toggl is the **UX benchmark**. Bill4Time is the **feature benchmark**. We need to combine:
- Toggl's simplicity and speed
- Bill4Time's legal-specific features (trust, LEDES, matters)
- Neither one's bloat

**The formula:** Toggl's UX + legal features + $19-29/mo = Attorney Time Track

---

*Teardown conducted via trial account on 2026-02-15. Screenshots saved in browser media.*
