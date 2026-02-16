# Bill4Time Competitive Teardown
**Date:** 2026-02-15
**Account:** Trial (VantreaseLaw)
**URL:** secure.bill4time.com

---

## Overview
Bill4Time is our #1 direct competitor. Legal-specific time tracking & billing at $39-59/user/mo. ASP.NET web app (yes, `.aspx` pages in 2026). They've been around since ~2010.

## Navigation & Information Architecture
11 top-level nav items: Dashboard, Clients, Matters, Time & Expenses, Tasks, Document Storage, Calendar, Invoicing, Statements, Reports, Accounting

**Verdict:** Overwhelming for a solo attorney. That's 11 sections to learn. Our app should have 4-5 max.

## Dashboard
- Widget-based layout with ~14 widgets: Time Entry, Billable Amount chart, Billable Hours chart, Labor Hours chart, Recent Matters, Recent Time Entries, Favorite Reports, Today's Schedule, Effective Billing Rate, Billable Utilization, Client Unpaid, Recent Documents, Upcoming Tasks, New Clients & Matters, My Timers, Expense Entry
- Quick time entry form embedded directly on dashboard (date, user, client, matter, activity, description, hours)
- Quick expense entry form also on dashboard
- Charts show daily/weekly billable amounts and hours
- "Setup Wizard" banner persists (7-step: Setup → Clients → Matters → Time Entries → Expenses → Invoices → Payments)

**What's good:** Dashboard time entry is smart — reduces clicks for the most common action.
**What sucks:** Too many widgets. Information overload. A solo attorney doesn't need "Billable Utilization" charts and "Effective Billing Rate" gauges. That's big-firm analytics.

## Timer
- "My Timers" widget on dashboard with "Add Timer" button
- Timer appears to be secondary to manual time entry (manual entry form is more prominent)
- No visible one-click start from the nav bar

**What sucks:** Timer is buried in a dashboard widget. Our app puts the timer front and center — that's a key UX win.

## Time Entry
- Manual entry: Date, User dropdown, Client dropdown, Matter dropdown, Activity dropdown, Description, Hours
- "Add Time" and "Add Bulk Time" buttons
- Requires Activity Type on time entries (configurable in settings)
- Timer Interval: **6 Minutes** (configurable in System settings)

**What's good:** Bulk time entry is useful for attorneys who log at end of day.
**What sucks:** Too many dropdowns for a quick entry. Client → Matter → Activity is 3 selections before you even type a description.

## Invoicing
- Table view: Type, Id, Client, Matter, Description, Invoice Date, Created, Status, Payment Status, Total
- Buttons: Create Invoice, Create Draft, Create Statements, Print Invoices
- "New Experience" toggle (beta) with enhanced filtering, bulk actions, and **LEDES billing**
- Filters available

**Key intel:** LEDES is in their "New Experience" beta — it's not seamlessly integrated, it's an add-on toggle. This suggests LEDES was an afterthought.

## Accounting / Trust
- Summary cards: Trust Balance, Paid (month to date), Balance Due, Unbilled Amount
- Buttons: Receive Payment, Balance Adjustment, **Trust Transfer**
- Client Balances table: Client Name, Account Manager, Last Payment, Last Payment Date, Billed Balance, Unbilled Balance, Total Balance, **Trust Balance**
- "Use Trust Accounting" is a system toggle (checkbox in Settings > System)

**What's good:** Trust accounting is integrated into the accounting view with clear trust balance per client.
**What sucks:** It's a separate "Accounting" section — not visible from the matter or client view without navigating away. Trust should be visible wherever you're looking at a client.

## Settings (System Tab) — Key Configuration
Left column (toggles):
- Track Client Locations
- Track Internal (Non-Client) Time
- Track Matter Start/Due Dates
- Verify Time/Fee Entries Before Billing
- Verify Expenses Before Billing
- Allow "Non-Matter Related" Time/Expense Entries
- ✅ Require Activity Type on Time Entries
- ✅ Use Trust Accounting
- Allow Overtime Billing Rates
- Sort Matters Alphabetically
- Enable LEDES File Export (requires Federal Taxpayer ID)
- Enable ABA Standard Codes
- Enable Custom Invoice Numbers
- Participate in Beta Access

Right column (values):
- Accounting Type: Bill4Time Accounting
- Accounting Isolation: Matter
- Project Mnemonic: Matter
- Timer Interval: **6 Minutes**
- Default Currency: USD

**Key intel:** LEDES requires a Federal Taxpayer ID — friction. Trust Accounting is a simple on/off toggle. Timer interval is configurable. These are all table-stakes features we need.

## Reports
Categories: Accounting, User, Financial, Matter, Productivity, Summary, Advanced (New)

Reports list (Accounting tab):
- Discount Report
- Inactivity Report
- Internal Time
- Invoice Count
- Invoice Email
- Invoice Template Report
- Invoice Write Up/Down
- Tax Report
- User Audit Log
- User Permission
- User Rates

**What's good:** Comprehensive reporting. Bookmarkable reports.
**What sucks:** Overwhelming for a solo attorney who just wants "how much am I owed?" and "what did I bill this month?"

## Other Notable Features
- **Document Storage** — built-in document management (not something we need)
- **Calendar** — built-in scheduling
- **Tasks** — task management
- **Statements** — separate from invoices (client account statements)
- **Conflict Check** — search for conflicts of interest (nice legal-specific feature)
- **QuickBooks Export** — settings integration
- **Custom Fields** — configurable
- **API** — they have one (settings tab)
- **MFA** — available but not enabled by default
- **Payments & Client Portal** — "Bill4Time Payments" being pushed hard (banner on login + dashboard alert)

## Tech Stack Observations
- **ASP.NET Web Forms** — `.aspx` pages, `javascript:;` links, server-side rendering
- Old-school combo boxes with text inputs (not modern select components)
- **Error on direct URL navigation** — navigating to `/TimeExpense/default.aspx` returned a server error. Fragile routing.
- Setup Wizard uses a progress bar stepper (not bad)
- Charts are SVG-based (likely a charting library)
- Mobile: reportedly buggy (confirmed by reviews)

## UX Pain Points (Our Opportunities)
1. **Login requires 3 fields** — Company ID + Username + Password. A relic of multi-tenant architecture exposed to the user. Nobody should have to remember a "Company ID." Our login: email + password (or magic link).
2. **Information overload** — 11 nav items, 14+ dashboard widgets. Solo attorneys don't need this.
2. **Timer is buried** — dashboard widget, not front-and-center.
3. **Too many clicks for time entry** — Client → Matter → Activity → Description → Hours. Should be 2-3 fields max for quick entries.
4. **Trust accounting is siloed** — separate Accounting section instead of inline with matters/clients.
5. **LEDES is an afterthought** — hidden behind a beta toggle requiring a Tax ID.
6. **Old tech stack** — ASP.NET Web Forms feels like 2012. Slow, fragile, no SPA feel.
7. **Settings complexity** — 11 settings tabs. Our settings should fit on one page.
8. **Reports are enterprise-grade** — 7 report categories when a solo needs 3 reports total.

## What They Do Well (Don't Underestimate)
1. **Dashboard time entry** — entering time directly from dashboard reduces friction
2. **Bulk time entry** — important for end-of-day loggers
3. **Trust balance visibility** — summary cards on accounting page are clear
4. **Comprehensive feature set** — they cover everything a firm might need
5. **Conflict check** — nice legal-specific touch
6. **Customizable mnemonics** — "Matter" vs "Project" etc. (some firms use different terms)
7. **QuickBooks integration** — table stakes for billing software

## Pricing Intelligence
- Trial account (we're on it)
- "Activate your account" banner = trial-to-paid conversion flow
- No visible pricing on the settings/subscription page without clicking through
- Pushing "Bill4Time Payments" hard (their payment processing play — likely their real revenue growth)

## Actionable Takeaways for Attorney Time Track

### Must Match
- [ ] Dashboard time entry (quick-add without navigating away)
- [ ] Trust accounting with per-client balances
- [ ] 6-minute timer interval (already have this)
- [ ] LEDES export
- [ ] QuickBooks integration (Phase 2/3)
- [ ] Bulk time entry option

### Must Beat
- [ ] **Timer UX** — ours should be 1-click, always visible, not buried in a widget
- [ ] **Simplicity** — 4-5 nav items, not 11. Less is more for solos.
- [ ] **Trust inline** — show trust balance on the matter/client view, not a separate section
- [ ] **LEDES at base tier** — not a beta feature or premium add-on
- [ ] **Modern stack** — fast SPA, responsive mobile, no page reloads
- [ ] **Onboarding** — get to first time entry in <60 seconds, not a 7-step wizard

### Skip (Not Our Market)
- Document Storage
- Calendar/Scheduling
- Tasks
- Conflict Check (nice but Phase 3+)
- Multiple user management (v1 is solo)
- Advanced reporting categories
- Custom Fields
- ABA Standard Codes

---

*Teardown conducted via trial account on 2026-02-15. Screenshots saved in browser media.*
