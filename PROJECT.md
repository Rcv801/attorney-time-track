# Attorney Time Track — Project Context

## Overview
Lean time tracking & billing app for solo/small firm attorneys. "The anti-Clio."

## Repo & Deployment
- **GitHub:** Rcv801/attorney-time-track
- **Local:** ~/workspace/attorney-time-track
- **Stack:** React + TypeScript + Vite + Supabase + shadcn/ui + Tailwind
- **Live preview:** https://attorney-time-track.vercel.app/
- **Supabase project:** ibvmcjzhnkkgizagjmuo
- **Built with:** Lovable.dev (syncs with their platform)

## Dev Workflow
- **Feature branches + PRs** — main is protected, requires 1 approval
- Every merge to main auto-deploys to Vercel
- Bill creates PRs, pings Ryan on Telegram for review
- GitHub Projects board: https://github.com/users/Rcv801/projects/1

## Research
- `research/competitor-analysis.md` — competitive landscape, pricing, strategy
- `research/reddit-pain-points.md` — Reddit pain points, feature requests, opportunities

## Strategic Direction
- **Target market:** Solo practitioners and small firms (1-10 attorneys)
- **Price point:** $19/mo solo, $29/mo firm (the $15-30 range is empty in legal billing)
- **Differentiator:** Built by a practicing attorney, lean/focused, no bloat
- **Positioning:** Track time. Send invoices. Get paid. Nothing else.
- Solo attorneys overpay 50-75% for features they never use with Clio/MyCase/etc.

## Design Philosophy
Toggl's UX + Bill4Time's legal features + neither one's bloat = us at $19-29/mo.

### Timer & Top Bar
- Timer is persistent in the top bar — always visible, never buried
- Big play button + "What are you working on?" prompt
- Billable toggle in the top bar
- One-click start — seconds to first time entry after signup

### View Modes
- **Calendar** — drag-to-create, visual day/week layout
- **List** — grouped entries, quick edit inline
- **Timesheet** — grid view for batch entry (weekly)

### Sidebar Navigation
Clean grouped nav (inspired by Toggl, adapted for legal):
- **Track** — Overview, Timer
- **Analyze** — Reports, Approvals
- **Manage** — Matters, Clients, Billable Rates, Invoices
- **Admin** — Subscription, Settings

### Settings
- Single page — not buried in sub-menus
- Everything discoverable in one scroll

### Auth & Onboarding
- Google Sign-In (primary), Magic Link (fallback), Email+password (option)
- Supabase built-in support for all three
- Goal: frictionless onboarding matching Toggl's speed (Issue #13)

### Rounding
- 6-minute increment rounding per entry (already built)
- Better for lawyers than Toggl's report-level rounding

## Competitive Intelligence
- **Bill4Time** (HIGH threat) — $39-59/mo, most direct competitor. ASP.NET Web Forms in 2026, bloated UI (14+ dashboard widgets), timer buried, 3-field login, LEDES behind beta toggle. Teardown: `research/bill4time-teardown.md`
- **Toggl Track** (MED-HIGH) — $20/mo Premium, best-in-class timer UX, modern React SPA, 5 auth options. Zero legal features. Teardown: `research/toggl-teardown.md`
- **Time59** (MED-HIGH) — $199/yr flat, legal-specific but 2008-era UI, no mobile
- **TimeSolv** (MED) — $35-50/user, feature-rich but bloating
- **LeanLaw** (MED) — $55/mo but requires QuickBooks ($75-154 real cost)

## Key Findings from Research
- #1 pain point: Attorneys forget to track time → lost revenue
- #2: Existing tools too expensive for solos ($89-250/mo for Clio)
- #3: Everything is bloated — solos want billing, not all-in-one platforms
- Killer feature opportunity: Passive time capture (monitoring email/calendar, suggesting entries)
- No competitor was built by a practicing attorney
- Trust/IOLTA is a dealbreaker feature — must be in Phase 1
- LEDES at base tier = major differentiator (competitors charge $65-99 for it)
- The $20-34/mo price range is basically empty in legal billing

## Owner
- **Ryan Vantrease** (Rcv801) — practicing attorney, product vision
- **Bill Brasky** 🥃 — project leader, development, automation (replaced Atlas Feb 15, 2026)
