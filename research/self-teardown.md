# Attorney Time Track — Self Teardown & Improvement Plan

**Date:** Feb 15, 2026  
**Reviewer:** Bill Brasky 🥃  
**Compared against:** Toggl Track, Bill4Time, TimeSolv  

Ryan's assessment: "Way too basic and cheap looking." He's right. Here's the honest breakdown.

---

## What We Have (3 pages + login)

### Routes
1. `/login` — Sign In / Sign Up / Forgot Password / Magic Link
2. `/` — Dashboard (stats + timer + quick start + today's entries)
3. `/entries` — Time entries table with date range filter
4. `/clients-matters` — Client list with expandable matters

That's it. Three functional pages. Toggl has 15+. Even TimeSolv has 13 nav items.

---

## Page-by-Page Critique

### Login Page 🔴 Needs Major Work

**Current state:**
- Dark navy background with a single centered card
- Generic "AT" logo in a rounded square
- "TimeTrack" name (not even our actual product name)
- Email + password only on Sign In tab
- Sign Up tab = same form, just "Create Account" button
- "Forgot password?" and "Magic link" as tiny text links at the bottom
- "Database error saving new user" on sign-up attempt — **BROKEN**

**vs. Toggl:**
- Toggl has a marketing-quality login page with branding, social proof, and 5 auth options
- Google Sign-In button is prominent, not hidden
- Apple, Passkey, SSO options visible
- Clean white background, professional feel

**vs. Bill4Time:**
- Even Bill4Time's ugly 3-field login looks more "serious" than ours
- They at least have a real logo

**What's wrong:**
1. **No branding** — "AT" in a box is placeholder-tier. No logo, no tagline, no identity.
2. **No Google Sign-In** — Our planned primary auth method isn't implemented yet
3. **Dark theme by default** — Feels like a developer tool, not a legal product. Attorneys expect professional/light themes.
4. **Sign-up is broken** — "Database error saving new user" is a showstopper
5. **No value proposition** — Zero indication of what this product does. No "Track time. Send invoices. Get paid."
6. **Magic link is hidden** — It's a tiny text link, should be a prominent button
7. **No social proof** — No reviews, no logos, no "trusted by X attorneys"
8. **Product name is wrong** — Shows "TimeTrack" not "Attorney Time Track"

### Dashboard 🟡 Decent Structure, Needs Polish

**Current state:**
- "Dashboard" heading with today's date
- 4 stat cards: Hours Today, Billable Amount, Entries Today, Active Time
- Timer card below stats (with Play/Pause/Stop buttons)
- Two-column layout: Quick Start (matter pins) + Today's Entries list

**What works:**
- Stat cards are a good pattern (Toggl does something similar)
- Timer has visual states (green for running, yellow/pulse for paused)
- Quick Switch (Ctrl+K) is a power-user feature we should keep
- Today's Entries list is useful

**What's wrong:**
1. **Timer is NOT in the top bar** — It's a card buried in the dashboard content area. When you navigate to Entries or Clients, the timer disappears. This is our #1 design principle and it's not implemented.
2. **No "What are you working on?" prompt** — Timer is contextless without an active matter
3. **No billable toggle** visible in the timer area
4. **Timer card takes up too much space** — Should be a sleek bar, not a card
5. **Stats show $0.00/0h for new users** — Empty state isn't motivating. "Start tracking to see your first stats" would be better.
6. **No onboarding flow** — New user lands on empty dashboard with no guidance
7. **Quick Start is empty** — No pinned matters on first use, no explanation of how to use it

### Entries Page 🟡 Functional but Basic

**Current state:**
- "Time Entries" heading with entry count + total hours
- Date range picker (calendar popup, defaults to last 7 days)
- Table: Matter, Client, Date, Duration, Billable, Notes, Actions (archive/delete)
- Running entries show "In progress" badge in green
- Empty state: "No entries found" message

**What works:**
- Clean table layout
- Date range picker is functional
- Archive vs Delete distinction is good
- Running entry highlighting

**What's wrong:**
1. **List view only** — No Calendar view, no Timesheet/grid view. We planned three views.
2. **No inline editing** — Can't click a cell to edit. Must... actually there's no edit at all?
3. **No manual entry creation** — There's no "Add Entry" button. You can only create entries via the timer.
4. **No entry editing** — Only archive or delete. No way to adjust time, add notes after the fact.
5. **No grouping** — Entries aren't grouped by matter or date. Just a flat chronological list.
6. **No bulk actions** — Can't select multiple entries to invoice, export, or batch-edit.
7. **No export** — No CSV, no LEDES, no PDF. Can't get data out.
8. **No billable/non-billable toggle per entry**
9. **No rounding display** — 6-min rounding is applied but user can't see original vs. rounded

### Clients & Matters Page 🟢 Best Page We Have

**Current state:**
- Client list with search, grouped by first letter
- Expandable rows showing matters underneath
- Shows: Name, Rate, Active Matters count, Last Updated
- Create client dialog with first matter creation
- Edit and Archive via dropdown menu
- Keyboard shortcut for search (⌘K)

**What works:**
- Alphabetical grouping is professional
- Expandable matters inline is efficient UX
- Badge showing active matter count
- Search with keyboard shortcut
- Create flow includes first matter (smart — reduces steps)

**What's wrong:**
1. **No matter-level actions** — Can't edit, archive, or manage matters directly
2. **No matter creation** from this page (only when creating a new client)
3. **No contact details** — No email, phone, address for clients
4. **No billing settings per client** — No default billing rate override, retainer balance, LEDES ID
5. **No notes/history** — Can't see billing history or recent activity per client

### Sidebar / Navigation 🔴 Too Bare

**Current state:**
- "AT" logo + "TimeTrack" text
- 3 nav items: Dashboard, Clients & Matters, Entries
- Sign Out button at bottom
- Ctrl+K shortcut hint
- Collapsible/resizable

**vs. our planned design:**
We wanted 4 grouped sections:
- Track (Overview, Timer)
- Analyze (Reports, Approvals)
- Manage (Matters, Clients, Billable Rates, Invoices)
- Admin (Subscription, Settings)

**What we have:** 3 ungrouped links. No sections, no hierarchy, no indication of what's coming.

---

## Theme & Visual Design 🔴 "Developer Prototype" Feel

**The core problem Ryan identified:**

1. **Default shadcn dark theme** — This is literally the out-of-the-box shadcn/ui dark theme with zero customization. Every shadcn tutorial project looks exactly like this.
2. **No brand colors** — Primary is just "dark navy." No accent color, no warmth, no personality.
3. **No logo** — "AT" in a rounded square is a Lovable.dev placeholder.
4. **No custom typography** — System font stack. No distinctive heading font.
5. **Card-heavy layout** — Everything is in a Card component. Dashboard = cards of cards. Feels like a component showcase, not a product.
6. **No illustrations or visual warmth** — Zero imagery, zero character.
7. **Dark mode default** — Most legal software uses light mode as default. Dark mode should be an option, not the default. Attorneys printing invoices or sharing screens expect light.
8. **Low contrast** — Dark theme with muted colors makes everything feel dim and low-energy.

**What Toggl gets right (that we don't):**
- Distinct purple/pink brand color that's instantly recognizable
- Light default theme, dark as option
- Timer has visual weight — the play button is large and colorful
- Grouped sidebar with icons and subtle color accents
- White space is used deliberately
- Components feel custom, not off-the-shelf

---

## Missing Pages & Features (vs. competitors)

| Feature | Us | Toggl | Bill4Time | TimeSolv |
|---------|-----|-------|-----------|----------|
| Persistent timer bar | ❌ | ✅ | ❌ (widget) | ❌ (checkbox) |
| Calendar view | ❌ | ✅ | ❌ | ✅ |
| Timesheet view | ❌ | ✅ | ❌ | ❌ |
| Inline entry editing | ❌ | ✅ | ❌ | ❌ |
| Manual entry creation | ❌ | ✅ | ✅ | ✅ |
| Invoice generation | ❌ | ❌ | ✅ | ✅ |
| Trust accounting | ❌ | ❌ | ✅ | ✅ |
| Reports | ❌ | ✅ | ✅ | ✅ (29!) |
| Settings page | ❌ | ✅ | ✅ | ✅ |
| LEDES export | ❌ | ❌ | ✅ (beta) | ✅ |
| Google Sign-In | ❌ | ✅ | ❌ | ❌ |
| Light theme | ❌ | ✅ (default) | ✅ | ✅ |
| Real logo | ❌ | ✅ | ✅ | ✅ |
| Onboarding flow | ❌ | ✅ | ❌ | Broken |
| Mobile responsive | ? | ✅ | ❌ | ⚠️ (gated) |

---

## Priority Improvements (ordered by impact)

### 🔴 Critical (Before showing to anyone)

1. **Fix sign-up bug** — "Database error saving new user" is a showstopper
2. **Light theme as default** — Switch from dark to light. Keep dark as option.
3. **Persistent timer in top bar** — This is our core UX promise. Timer must be visible on every page, not just Dashboard.
4. **Real product name** — Change "TimeTrack" to "Attorney Time Track" throughout
5. **Brand identity** — Logo, color palette, typography. Doesn't need to be perfect, but can't be shadcn defaults.

### 🟡 High Priority (Phase 1 completion)

6. **Manual entry creation** — "Add Entry" button on Entries page
7. **Entry editing** — Click to edit time, notes, matter
8. **Google Sign-In** — Issue #13, our primary auth plan
9. **Invoice page** — Issue #1, core Phase 1 deliverable
10. **Trust/IOLTA UI** — Issue #2, dealbreaker feature for lawyers

### 🟢 Important (Quality & polish)

11. **Onboarding flow** — Guide new users to create first client → first matter → first time entry
12. **Sidebar restructure** — Implement the 4-group nav design
13. **Calendar & Timesheet views** — Two additional entry views
14. **Entry grouping** — Group by date, matter, or client
15. **Billable/non-billable toggle** per entry and in timer

### 🔵 Nice to Have (before launch)

16. **Custom landing page** for logged-out users (marketing page)
17. **Settings page** — Profile, billing preferences, rounding options
18. **Reports** — Start with 5 essentials: time summary, invoice aging, trust balance, revenue, client ranking
19. **Export** — CSV at minimum, LEDES for Phase 2
20. **Dark/Light mode toggle** in UI

---

## The Honest Assessment

Ryan's right. This looks like what it is: a Lovable.dev scaffold with shadcn default theme. It's a functional prototype, not a product. The code quality is actually decent (React Query, proper Supabase integration, TypeScript throughout), but the **visual design says "weekend project."**

**The good news:** The architecture is solid. Supabase auth, React Query for data fetching, shadcn components are customizable. We don't need to rebuild — we need to **skin it properly and fill in the missing pages.**

**What we need to feel like a real product:**
1. A real brand (logo + colors + typography)
2. Light theme default
3. Persistent timer bar
4. 3-4 more pages (Invoices, Reports, Settings, maybe IOLTA)
5. Entry editing and manual creation
6. Onboarding flow

With those, we go from "developer prototype" to "early-access product." Not polished, but credible.

---

## Comparison Screenshots Reference

For visual comparison, see:
- `research/toggl-teardown.md` — Best-in-class UX target
- `research/bill4time-teardown.md` — What "just legal features" looks like
- `research/timesolv-teardown.md` — What "dated but feature-complete" looks like
- Our login page screenshot: dark, generic, placeholder logo
