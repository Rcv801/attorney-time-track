# TimeSolv Teardown — Feb 15, 2026

**Account:** ryan@mvlawyers.com  
**Trial:** 10-day free trial (no credit card required)  
**URL:** https://apps.timesolv.com  
**Platform:** OutSystems (low-code platform) — .aspx pages  
**Parent company:** ProfitSolv (also owns Rocket Matter, CosmoLex, Tabs3, Orion, Mango)

---

## Pricing

| Plan | Monthly | Annual |
|------|---------|--------|
| **TimeSolv Pro** | — | **$38/user/mo** (billed annually) |
| **TimeSolv Legal** | — | **$53/user/mo** (billed annually) |

- Month-to-month pricing not shown — must contact sales
- "Volume pricing available when adding additional users — inquire with sales"
- **Hidden pricing is a red flag** — they don't want comparison shoppers
- Add-ons: CRM ($147-177/mo for up to 3 users), Websites ($149-159/mo), TimeSolvPay (payment processing)

### Our advantage
- Our $19-29/mo is 27-45% cheaper than their Pro tier, with legal features included
- They gate legal features (trust, LEDES, conflict check) behind the $53 Legal tier
- We include everything in one plan

---

## Auth & Onboarding

- **Login:** Username + password only. No Google, Apple, SSO, or magic link.
- **Login page:** Classic .aspx Web Forms — `Login.aspx`
- Ryan's experience: onboarding was "sort of quick" but **got stuck on spinning icon** "building my dashboard" — had to click around to clear it
- **10-day trial**, no credit card required
- First-run lands on Clients & Matters page (empty state) with a tooltip: "Please create one or more Matters first"

### vs. our plan
- We're doing Google Sign-In + Magic Link + email/password (3 options vs their 1)
- Their onboarding has friction — spinning dashboard builder is a bad first impression

---

## Navigation (12 top-level items!)

Flat horizontal menu bar with NO grouping:
1. **Dashboards** — `/App/Dashboard.aspx`
2. **Clients** — `/Client/ClientsAndProjects.aspx`
3. **Documents** — `/Client/DocumentList.aspx`
4. **Calendar** — `/App/Calendar.aspx`
5. **To-Do** — `/Client/Tasks.aspx`
6. **Time** — `/Time/TimeEntry.aspx`
7. **Expense** — `/Expense/ExpenseEntry.aspx`
8. **Invoices** — `/InvoicePayment/InvoiceDrafts.aspx`
9. **Payments** — `/InvoicePayment/Payments.aspx`
10. **TimeSolvPay** — `/InvoicePayment/Payments.aspx` (same URL as Payments!)
11. **Reports** — `/Reports/Reports.aspx`
12. **Account** — `/Admin/StaffList.aspx`
13. **CRM** — `/Client/CRM_LandingScreen.aspx`

**Problems:**
- 13 ungrouped top-level nav items — cognitive overload
- TimeSolvPay and Payments go to THE SAME URL — why are they separate nav items?
- No sidebar — everything is horizontal menu
- Time entry is item #6 — should be #1 for a time tracking app
- Documents, Calendar, To-Do, CRM are scope creep (they're becoming a practice management tool)

### vs. our plan
- We have 4 grouped sidebar sections (Track, Analyze, Manage, Admin) vs their 13 flat items
- Our timer is always visible in the top bar, not buried at item #6

---

## Dashboard

- Sub-tabs: Staff, Client, Financial, Hours, Amount, Billing Rate
- Interactive Highcharts graphs: "Target Billable Hours vs. Actual" (line chart), "Total and Actual Billable Hours" (bar chart by month)
- Filter by Professional and Year
- Useful for firms, overkill for solos
- No quick-action widgets — pure analytics view

---

## Time Entry

Form-based entry (not a persistent timer):
- **Fields:** For (professional), Date, Matter, Task Code, Hours, Rate, Description
- **Timer:** Checkbox "Start Timer" next to Hours field — NOT a persistent top-bar timer
- **Save options:** "Save & New" or "Save & Duplicate"
- **Table below:** Shows today's entries (Client-Matter, Hours, Timer, Rate, Total, Status)
- **Extra links:** "Analytics" and "Plan Task To-Do"
- Rate field shows "0" by default (must be configured per matter)
- **"Switch to Fixed Amount"** link — supports flat-fee billing

### Timer UX issues:
- Timer is a checkbox on a form — not visible when you navigate away from the Time page
- No "What are you working on?" prompt
- No persistent top bar
- Must select matter BEFORE starting timer (vs. Toggl's "start now, categorize later")

### vs. our plan
- Our persistent top-bar timer is always visible across all pages
- One-click start vs. their fill-form-then-check-box flow
- We'll let you start timer first, assign matter later

---

## Invoices

- Lands on "Draft Invoices" page
- Actions: New Draft Invoices, Change Invoice Date, Download, Send, Void
- Table columns: Client, Matter, Date, Amount, Status, Split
- Filter by Responsible Professional
- **Split Billing** — they support it (splitting invoices across parties)
- Batch operations via checkboxes

---

## Reports (29 reports in 6 categories!)

### Time and Expense (6)
- Time Entries, Time Entry Summary, Expense Entries, Missing Time, Time and Expense Entries, Task Summary

### Accounting (2)
- Accounts Receivable, Ledger Entries

### Invoices, Payments and Trusts (6)
- Invoice Summary with Payment Allocations, Aged Invoices, Invoices and WIP Aging, Cash Receipts, Payment History, **Trust Banking**

### Realization (3)
- Realization per Client, Realization per Invoice, Realization per Professional

### Performance (5)
- Firm Performance, Fees Budget, Client Rankings, Professional Profitability, Revenue

### Managing Matters (2)
- Resource Allocation, Budget

### Managing the Firm (5)
- Task Codes, Expense Codes, Professionals and Rates, Clients and Matters, Tax Listing, Abbreviations

**Analysis:** 29 reports is impressive for a firm tool but overwhelming for a solo. Most solos need 3-5: time summary, invoice aging, trust balance, revenue, and maybe client rankings.

### vs. our plan
- Start with 5-8 essential reports, add more based on user feedback
- Our reports should be visual/dashboard-style, not table dumps

---

## Account/Settings

- **Professionals page** — staff management (Username, Type: "TimeKeeper", Email, Security Type)
- **Subscription** — tabs: Account Info, Additional Contacts, Subscription, Billing History
- Payment via Authorize.net (PCI-compliant)
- Settings are scattered across multiple sub-pages under Account

---

## Feature Matrix (from pricing page)

### Pro tier includes:
- Time & Expense Tracking
- Auto Trust Transfer & Holds
- LEDES Billing
- Split Billing
- Flexible Billing Templates
- Online Payments
- Recurring Payments
- Client Portal
- Custom Abbreviations
- Flexible Billing Rates
- Batch Invoicing
- Trust Accounting
- Financial & Productivity Reports
- Bulk Payment Collection
- Built-in Payment Processing
- Phone, Email, Chat Support
- Dedicated Account Manager
- Live Onboarding & Migration

### Legal tier adds:
- Conflict Check
- Calendaring and Task Management
- Matter Custom Fields
- Matter Budgets
- Custom Data Views
- Mobile App (!)
- Document Management
- Secure Document Sharing & eSignatures (add-on)
- Outlook, O365, LawPay, Xero, QuickBooks integrations

**Note:** Mobile app is gated behind Legal tier ($53/user) — basic functionality locked behind a paywall.

---

## Tech Stack

- **Platform:** OutSystems (low-code)
- **Pages:** ASP.NET (.aspx URLs)
- **Charts:** Highcharts (interactive)
- **Payment:** Authorize.net
- **Footer:** "Built with the OutSystems Platform"
- **Hosting:** Azure (based on billing history URL pattern)

### Implications:
- Low-code platform = fast to build, but constrained UX
- Feels enterprise-y, not modern SPA
- Full page reloads between sections (not React/SPA)
- Limited ability to create polished, Toggl-like UX on OutSystems

---

## Strengths (what to respect)

1. **Comprehensive legal features** — trust accounting, LEDES, split billing, conflict check all built-in
2. **29 reports** — covers every angle for firm analytics
3. **25+ years in market** — established, trusted by bar associations
4. **97% collection rate** claim — strong marketing
5. **Mobile app** exists (even if gated)
6. **Split billing** — we should consider this for Phase 2+
7. **Task codes** — ABA-standard categorization
8. **Batch invoicing** — efficient for firms with many clients

## Weaknesses (where we win)

1. **Ugly, dated UI** — OutSystems low-code constraints show
2. **13 ungrouped nav items** — cognitive overload
3. **Timer is a checkbox** on a form — terrible UX vs. persistent top-bar
4. **No modern auth** — username/password only, no Google/Apple/SSO
5. **Onboarding friction** — spinning "building dashboard" blocker
6. **Hidden pricing** — no month-to-month shown, "contact sales" for volume
7. **Mobile gated at $53/user** — basic feature behind paywall
8. **Full page reloads** — not a modern SPA experience
9. **TimeSolvPay = duplicate nav item** — goes to same URL as Payments (sloppy)
10. **Parent company (ProfitSolv) owns 7+ products** — split focus, acquisition fatigue
11. **Feature creep** — Documents, Calendar, To-Do, CRM = practice management scope creep
12. **$38-53/user** — 2x our price for comparable features

---

## Key Takeaways for Attorney Time Track

1. **Their legal features are comprehensive** — we need trust, LEDES, and task codes to compete
2. **Split billing is a real feature** — consider for Phase 2/3
3. **Their timer UX is bad** — confirms our persistent top-bar approach is right
4. **Their reports are exhaustive** — but start lean, add based on demand
5. **Mobile gating is customer-hostile** — we should include mobile from day one (responsive web first)
6. **"Contact sales" pricing = opportunity** — transparent pricing is a competitive advantage
7. **Conflict check** is a Legal-tier feature — we could add it later as a differentiator even at $29/mo
8. **Batch invoicing** — good feature for firms, add to roadmap
9. **Realization reports** — these are genuinely useful for lawyers (billable vs billed vs collected)

---

## Threat Assessment: MEDIUM

TimeSolv is feature-rich but feels stuck in 2015. The OutSystems platform constrains their UX evolution. ProfitSolv owning 7+ products means split engineering attention. At $38-53/user, they're pricing themselves into the mid-market where they compete with Clio and MyCase. They've left the $19-29 solo/small firm lane wide open.

**Their moat:** 25 years of features, bar association partnerships, established trust.  
**Their weakness:** They can't out-UX us, they can't out-price us, and they're bloating into practice management.

We're building what TimeSolv should have been: focused, fast, and affordable.
