# 10 — SEO Keyword Strategy

*Phase 2 Spec — Created February 18, 2026*

---

## Primary Keywords (Target for homepage & core pages)

| Keyword | Est. Monthly Volume | Competition | Priority |
|---------|-------------------|-------------|----------|
| legal billing software | 2,400 | High | 🔴 Top |
| attorney billing software | 1,000 | Medium | 🔴 Top |
| legal time tracking software | 880 | Medium | 🔴 Top |
| lawyer time tracking | 720 | Medium | 🔴 Top |
| solo attorney billing software | 320 | Low | 🔴 Top |
| law firm billing software | 590 | High | 🟡 Medium |

## Secondary Keywords (Feature & comparison pages)

| Keyword | Est. Volume | Target Page |
|---------|------------|-------------|
| LEDES billing software | 390 | /features/ledes |
| trust accounting software for lawyers | 210 | /features/trust-accounting |
| IOLTA tracking software | 170 | /features/trust-accounting |
| legal invoicing software | 480 | /features/invoicing |
| Clio alternative | 720 | /compare/clio |
| Bill4Time alternative | 110 | /compare/bill4time |
| TimeSolv alternative | 90 | /compare/timesolv |
| cheap legal billing software | 210 | /pricing |
| affordable law firm software | 170 | /pricing |
| best time tracking app for lawyers | 390 | /blog/best-time-tracking-lawyers |

## Long-Tail Keywords (Blog content)

| Keyword | Target Content |
|---------|---------------|
| how to track billable hours as a solo attorney | Blog post |
| 6 minute billing increment explained | Blog post |
| LEDES 1998B format guide | Blog post / docs |
| IOLTA compliance requirements by state | Blog series |
| how to set up trust accounting for solo practice | Blog post |
| best billing software for solo attorney 2026 | Comparison page |
| Clio vs Bill4Time vs TimeSolv comparison | Comparison page |
| how to reduce time spent on billing | Blog post |
| legal billing best practices solo attorney | Blog post |
| attorney billing software under $20/month | Landing page |
| free time tracking for lawyers | Blog post (funnel to free tier) |
| LEDES export from time entries | Blog / docs |
| how much should legal billing software cost | Blog post |
| switching from spreadsheet to billing software | Blog post |
| why attorneys hate time tracking | Blog post |

---

## Content Strategy

### 1. Comparison Pages (High Intent)
Create dedicated `/compare/{competitor}` pages:

- **sixminlegal.com/compare/clio** — "SixMin vs Clio: Why Solo Attorneys Are Switching"
- **sixminlegal.com/compare/bill4time** — "SixMin vs Bill4Time: Feature-by-Feature"
- **sixminlegal.com/compare/timesolv** — "SixMin vs TimeSolv: Which Is Better for Solos?"
- **sixminlegal.com/compare/toggl** — "SixMin vs Toggl Track: Why Lawyers Need More"
- **sixminlegal.com/compare/mycase** — "SixMin vs MyCase: Billing Without the Bloat"

Template: Feature table + pricing comparison + "why switch" narrative.

### 2. Blog Posts (Top-of-Funnel)

**Launch batch (5 posts):**
1. "I Was Paying $89/Month for Clio. Here's Why I Built My Own." (founder story)
2. "The Solo Attorney's Guide to 6-Minute Billing Increments" (educational)
3. "LEDES Billing: What It Is, Why You Need It, and Why You Shouldn't Pay Extra for It" (pain point)
4. "5 Signs You're Overpaying for Legal Billing Software" (comparison/pain)
5. "Trust Accounting for Solo Attorneys: A Plain-English Guide" (educational)

**Monthly cadence (2 posts/month):**
- Alternate between educational (SEO) and opinion (social sharing)
- Target one primary keyword per post
- Include CTA to free tier in every post

### 3. Documentation / Help Center
- Doubles as SEO content for long-tail "how to" queries
- `/docs/ledes-export` — ranks for "LEDES 1998B format"
- `/docs/trust-accounting` — ranks for "IOLTA tracking"
- `/docs/getting-started` — ranks for "set up legal billing software"

---

## Meta Descriptions for Key Pages

### Homepage
```
SixMin Legal — Simple billing software for solo attorneys. Time tracking, invoicing, trust accounting, and LEDES export. $19/month, everything included. No bloat.
```

### Pricing
```
SixMin Legal pricing: $19/month for unlimited time tracking, invoicing, trust/IOLTA, and LEDES export. Free tier available. No hidden fees, no tiers, no surprises.
```

### Compare/Clio
```
SixMin vs Clio: Get legal billing, trust accounting, and LEDES export for $19/month — not $89+. Compare features, pricing, and see why solo attorneys are switching.
```

### Features/LEDES
```
LEDES export included in every SixMin plan — $19/month. Export LEDES 1998B and 2000 format from any invoice. Competitors charge $65-119/month for this.
```

### Features/Trust Accounting
```
Bar-audit-proof trust accounting for solo attorneys. Append-only IOLTA ledger with running balance assertions. Included in SixMin at $19/month.
```

### Blog/Founder Story
```
Why a practicing Kentucky attorney built SixMin Legal — and why he priced it at $19/month when competitors charge $89+. The story behind the anti-Clio.
```

---

## Technical SEO Checklist

- [ ] Semantic HTML (`h1`/`h2`/`h3` hierarchy)
- [ ] Schema.org `SoftwareApplication` markup on homepage
- [ ] Schema.org `FAQPage` markup on FAQ section
- [ ] Open Graph tags for social sharing
- [ ] Canonical URLs
- [ ] XML sitemap (auto-generated by framework)
- [ ] robots.txt (allow all, disallow /app/)
- [ ] Page speed: target <2s LCP (Vite + CDN handles this)
- [ ] Mobile-friendly (responsive, no horizontal scroll)
- [ ] Internal linking between comparison pages, features, and blog
- [ ] Alt text on all images/screenshots

---

## Distribution Channels

| Channel | Strategy |
|---------|----------|
| **Reddit** | r/LawFirm, r/soloattorneys, r/Lawyertalk — helpful comments, not spam. Share founder story post. |
| **Legal forums** | Lawyerist, Above the Law, state bar listservs |
| **Bar associations** | Apply for practice management advisor listings (state bars maintain approved vendor lists) |
| **Google Ads** | Target "clio alternative," "legal billing software cheap," "LEDES billing" — low competition keywords |
| **Twitter/X** | Attorney Twitter is active. Share tips, not ads. |
| **Product Hunt** | Launch listing for initial visibility |
| **LinkedIn** | Founder posts about building in public |
