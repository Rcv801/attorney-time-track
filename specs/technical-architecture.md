# Attorney Time Track — Technical Architecture

*Created: February 9, 2026*
*Based on: MVP Feature List, Competitor Deep Dive, Niche Competitor Research*
*Status: PROPOSAL — Awaiting team review*

---

## Executive Summary

This document proposes the technical architecture for Attorney Time Track — a privacy-first, offline-capable legal billing application targeting solo attorneys and small firms. The architecture prioritizes three things in order: **data reliability** (attorneys face bar discipline for trust accounting errors), **privacy** (client data is privileged), and **speed** (every extra second of friction means lost adoption).

We currently have a working prototype built on React + Supabase + Vercel. This architecture evolves that foundation into a production-grade system while adding the local-first and offline capabilities that define our market positioning.

---

## 1. Proposed Tech Stack

### Frontend
| Technology | Purpose | Justification |
|-----------|---------|---------------|
| **React 18+** | UI framework | Already in use. Massive ecosystem, hiring pool, component library (shadcn/ui). No reason to switch. |
| **TypeScript** | Type safety | Already in use. Non-negotiable for financial software — catches billing calculation bugs at compile time. |
| **Vite** | Build tool | Already in use. Fast builds, excellent DX. |
| **shadcn/ui + Tailwind CSS** | Component library + styling | Already in use. Accessible, customizable, professional. Matches our "beautiful but lean" positioning. |
| **TanStack Query** | Server state management | Already in use via `@tanstack/react-query`. Handles caching, background sync, optimistic updates — critical for offline-first. |
| **Workbox (via vite-plugin-pwa)** | Service worker / PWA | Enables offline capability, asset caching, background sync. Required for our PWA strategy. |

### Local-First Data Layer
| Technology | Purpose | Justification |
|-----------|---------|---------------|
| **OPFS + SQLite (via wa-sqlite or sql.js)** | Client-side database | Browser-native SQLite via Origin Private File System. All data lives locally first. Fast queries, full SQL, works offline. |
| **CR-SQLite (or PowerSync)** | CRDT-based sync | Conflict-free replication for SQLite. Enables multi-device sync without data loss or conflicts. Attorneys editing the same matter from phone and desktop get automatic merge. |

**Why SQLite over IndexedDB?** IndexedDB is adequate for key-value storage but terrible for relational queries (joins across clients → matters → entries → invoices). Legal billing is inherently relational. SQLite gives us real SQL with proper transactions — essential for trust accounting integrity.

### Backend / Sync Server
| Technology | Purpose | Justification |
|-----------|---------|---------------|
| **Supabase** | Auth, sync server, optional cloud storage | Already in use. Provides Postgres, Row Level Security, real-time subscriptions, auth, and edge functions. We keep it as the **sync target**, not the primary data store. |
| **Supabase Edge Functions (Deno)** | Server-side logic | Invoice PDF generation, payment webhook processing, AI billing narrative generation. Lightweight, no server to manage. |
| **Supabase Realtime** | Multi-device sync trigger | Notifies other devices when data changes. Works with our CRDT sync layer. |

### Payments
| Technology | Purpose | Justification |
|-----------|---------|---------------|
| **Stripe Connect** | Operating account payments | Industry standard, excellent API, handles ACH + credit card. Lower fees than LawPay. |
| **LawPay API** | Trust/IOLTA payments | Legal-specific payment processor that maintains compliance with bar trust accounting rules. Separates trust and operating funds at the processor level. Required for trust compliance in most states. |

### AI Layer
| Technology | Purpose | Justification |
|-----------|---------|---------------|
| **Anthropic Claude API (via Edge Function)** | Billing narrative generation | Best-in-class for professional writing. Attorney reviews sparse timer notes → AI generates ethically appropriate billing descriptions. Runs server-side; raw client data never sent — only anonymized activity descriptions. |

### Mobile
| Technology | Purpose | Justification |
|-----------|---------|---------------|
| **PWA (Progressive Web App)** | Mobile access | MVP strategy. Install to home screen, works offline, push notifications. Eliminates App Store overhead. |
| **Capacitor (future)** | Native wrapper if needed | If we need native features (background timers, Siri integration), Capacitor wraps our React app in a native shell. Same codebase, native capabilities. Deferred to post-MVP. |

### Deployment
| Technology | Purpose | Justification |
|-----------|---------|---------------|
| **Vercel** | Frontend hosting + edge functions | Already in use. Automatic deploys from GitHub, global CDN, edge functions for server-side logic. |
| **Supabase Cloud** | Database + auth + realtime | Already in use. Managed Postgres with automatic backups, point-in-time recovery. |
| **GitHub Actions** | CI/CD | Automated testing, linting, type-checking on every PR. Deploy to Vercel on merge to main. |

---

## 2. Privacy-First Architecture

This is our core differentiator. The architecture follows a **local-first** model inspired by TimeNet Law's "Privacy Fortress" approach, but modernized for cross-platform web delivery.

### Data Residency Model

```
┌─────────────────────────────────────────────┐
│                 USER'S DEVICE                │
│  ┌─────────────────────────────────────────┐ │
│  │         SQLite (via OPFS)               │ │
│  │  ┌──────────────────────────────────┐   │ │
│  │  │ clients, matters, time_entries,  │   │ │
│  │  │ invoices, trust_ledger, expenses │   │ │
│  │  │ ALL DATA LIVES HERE FIRST        │   │ │
│  │  └──────────────────────────────────┘   │ │
│  └─────────────────────────────────────────┘ │
│                    │                         │
│              SYNC (opt-in)                   │
│              encrypted E2E                   │
│                    │                         │
└────────────────────┼────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│            SUPABASE (Cloud)                  │
│  ┌─────────────────────────────────────────┐ │
│  │  Encrypted sync replica                 │ │
│  │  (enables multi-device + backup)        │ │
│  │  Row Level Security enforced            │ │
│  │  We CAN'T read your data               │ │
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### Privacy Principles (Technical)

1. **Local-first by default.** The app works fully without any cloud connection. SQLite on the device is the source of truth.

2. **Cloud sync is opt-in.** Users who want multi-device access or cloud backup explicitly enable sync. Users who don't opt in have zero data on our servers.

3. **End-to-end encryption for synced data.** When sync is enabled, data is encrypted client-side before transmission. The encryption key is derived from the user's password + a device-specific salt. We cannot read synced data — even with full database access.

4. **AI narratives use anonymized context.** When generating billing narratives, we send activity type + duration + practice area to the AI — never client names, case numbers, or privileged details. Example: `"Draft motion, family law, 2.3 hours"` → AI generates: `"Drafted and revised motion for temporary custody orders; reviewed applicable case law and statutory authority; revised argument section based on factual developments."`

5. **No analytics on client data.** We track product usage (button clicks, feature adoption) via privacy-respecting analytics (Plausible or PostHog self-hosted). We never analyze, aggregate, or train on legal work product.

6. **Full data export always available.** CSV/JSON/PDF export of all data, anytime, no restrictions. If you leave, you take everything.

7. **Dedicated Privacy page.** Public-facing page explaining exactly what data we store, where, how it's encrypted, and what we can/cannot see. Inspired by TimeNet Law's "Privacy Fortress" — but with technical specifics, not just marketing copy.

---

## 3. Offline Capability & Sync

### How Offline Works

The app uses a **service worker** (via Workbox) to cache all application assets and a **local SQLite database** for all data operations.

```
ONLINE:                           OFFLINE:
┌──────────┐    sync    ┌──────┐  ┌──────────┐
│ Local DB │ ◄────────► │Cloud │  │ Local DB │ ← all operations
│ (SQLite) │            │(Supa)│  │ (SQLite) │    continue here
└──────────┘            └──────┘  └──────────┘
     ▲                                 ▲
     │                                 │
  App reads/writes              App reads/writes
  locally ALWAYS                locally ALWAYS
```

**Key principle:** The app ALWAYS reads from and writes to local SQLite. Cloud sync happens in the background. The user experience is identical online or offline.

### Sync Protocol

We use **CR-SQLite** (CRDT-enhanced SQLite) for conflict-free sync:

1. **Every write** generates a CRDT changeset (vector clock + last-write-wins for scalar fields, append-only for collections).
2. **When online,** changesets are pushed to Supabase in batches (debounced, every 5–30 seconds).
3. **Other devices** receive changesets via Supabase Realtime and merge into their local SQLite.
4. **Conflict resolution:** Last-write-wins for simple fields (client name, matter status). For time entries edited on multiple devices simultaneously, we keep both versions and flag for user review — never silently discard data.
5. **Initial sync** on a new device pulls the full encrypted dataset from Supabase and hydrates local SQLite.

### Sync States (User-Facing)

| Icon | State | Meaning |
|------|-------|---------|
| 🟢 | Synced | All local changes pushed to cloud, all remote changes pulled |
| 🟡 | Syncing | Changes in flight |
| 🔴 | Offline | Working locally, will sync when connection returns |
| ⚪ | Local Only | User has not enabled cloud sync |

### Trust Accounting: Extra Sync Safety

Trust/IOLTA transactions require special handling because errors can result in bar discipline:

- Trust ledger entries are **append-only** (no edits, no deletes — only correcting entries).
- Every trust transaction includes a **running balance assertion** that is validated on sync.
- If a sync conflict would produce an invalid trust balance, sync pauses and alerts the user rather than auto-resolving.
- All trust transactions include a full audit trail (timestamp, device, user, previous balance, new balance).

---

## 4. Database Schema

### Core Models

```sql
-- Users (synced via Supabase Auth)
CREATE TABLE users (
  id              TEXT PRIMARY KEY,  -- UUID from Supabase Auth
  email           TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  bar_number      TEXT,
  firm_name       TEXT,
  default_rate    REAL NOT NULL DEFAULT 0,  -- $/hour
  billing_increment REAL NOT NULL DEFAULT 0.1,  -- 6-minute default
  rounding_rule   TEXT NOT NULL DEFAULT 'up',  -- 'up', 'down', 'nearest'
  timezone        TEXT NOT NULL DEFAULT 'America/New_York',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  _crdt_clock     TEXT  -- CR-SQLite vector clock
);

-- Clients
CREATE TABLE clients (
  id              TEXT PRIMARY KEY,  -- UUID
  user_id         TEXT NOT NULL REFERENCES users(id),
  name            TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  address         TEXT,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'active',  -- 'active', 'archived'
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  _crdt_clock     TEXT
);

-- Matters (cases)
CREATE TABLE matters (
  id              TEXT PRIMARY KEY,  -- UUID
  user_id         TEXT NOT NULL REFERENCES users(id),
  client_id       TEXT NOT NULL REFERENCES clients(id),
  name            TEXT NOT NULL,
  matter_number   TEXT,  -- firm's internal reference
  status          TEXT NOT NULL DEFAULT 'active',  -- 'active', 'closed', 'archived'
  billing_type    TEXT NOT NULL DEFAULT 'hourly',  -- 'hourly', 'flat_fee', 'contingency'
  hourly_rate     REAL,  -- overrides user default if set
  flat_fee_amount REAL,  -- for flat-fee matters
  billing_increment REAL,  -- overrides user default if set
  opened_date     TEXT NOT NULL DEFAULT (date('now')),
  closed_date     TEXT,
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  _crdt_clock     TEXT
);

-- Time Entries
CREATE TABLE time_entries (
  id              TEXT PRIMARY KEY,  -- UUID
  user_id         TEXT NOT NULL REFERENCES users(id),
  matter_id       TEXT NOT NULL REFERENCES matters(id),
  date            TEXT NOT NULL,  -- YYYY-MM-DD
  duration_hours  REAL NOT NULL,  -- actual duration in decimal hours
  billed_hours    REAL NOT NULL,  -- after rounding rules applied
  rate            REAL NOT NULL,  -- rate at time of entry (snapshot)
  amount          REAL NOT NULL,  -- billed_hours * rate
  description     TEXT NOT NULL,  -- billing narrative
  ai_generated    INTEGER NOT NULL DEFAULT 0,  -- was description AI-generated?
  ai_raw_notes    TEXT,  -- original sparse notes before AI enhancement
  task_code       TEXT,  -- legal task code (e.g., 'research', 'drafting')
  timer_start     TEXT,  -- ISO timestamp if from timer
  timer_end       TEXT,
  status          TEXT NOT NULL DEFAULT 'draft',  -- 'draft', 'approved', 'invoiced', 'written_off'
  invoice_id      TEXT REFERENCES invoices(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  _crdt_clock     TEXT
);

-- Expenses
CREATE TABLE expenses (
  id              TEXT PRIMARY KEY,  -- UUID
  user_id         TEXT NOT NULL REFERENCES users(id),
  matter_id       TEXT NOT NULL REFERENCES matters(id),
  date            TEXT NOT NULL,
  amount          REAL NOT NULL,
  description     TEXT NOT NULL,
  category        TEXT,  -- 'filing_fee', 'copies', 'postage', 'travel', 'other'
  billable        INTEGER NOT NULL DEFAULT 1,
  status          TEXT NOT NULL DEFAULT 'draft',  -- 'draft', 'invoiced'
  invoice_id      TEXT REFERENCES invoices(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  _crdt_clock     TEXT
);

-- Invoices
CREATE TABLE invoices (
  id              TEXT PRIMARY KEY,  -- UUID
  user_id         TEXT NOT NULL REFERENCES users(id),
  client_id       TEXT NOT NULL REFERENCES clients(id),
  invoice_number  TEXT NOT NULL,  -- sequential, user-visible
  status          TEXT NOT NULL DEFAULT 'draft',  -- 'draft', 'sent', 'viewed', 'paid', 'partial', 'overdue', 'void'
  issued_date     TEXT NOT NULL,
  due_date        TEXT NOT NULL,
  subtotal        REAL NOT NULL DEFAULT 0,  -- sum of time + expenses
  tax_amount      REAL NOT NULL DEFAULT 0,
  total           REAL NOT NULL DEFAULT 0,
  amount_paid     REAL NOT NULL DEFAULT 0,
  balance_due     REAL NOT NULL DEFAULT 0,
  notes           TEXT,  -- invoice-level notes/terms
  payment_link    TEXT,  -- Stripe/LawPay payment URL
  pdf_url         TEXT,  -- stored PDF path
  sent_at         TEXT,
  paid_at         TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  _crdt_clock     TEXT
);

-- Invoice Line Items (denormalized snapshot of entries at invoice time)
CREATE TABLE invoice_line_items (
  id              TEXT PRIMARY KEY,
  invoice_id      TEXT NOT NULL REFERENCES invoices(id),
  time_entry_id   TEXT REFERENCES time_entries(id),
  expense_id      TEXT REFERENCES expenses(id),
  type            TEXT NOT NULL,  -- 'time', 'expense'
  date            TEXT NOT NULL,
  description     TEXT NOT NULL,
  quantity        REAL,  -- hours for time, 1 for expenses
  rate            REAL,  -- hourly rate for time, NULL for expenses
  amount          REAL NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  _crdt_clock     TEXT
);

-- Trust Ledger (APPEND-ONLY — no updates or deletes)
CREATE TABLE trust_ledger (
  id              TEXT PRIMARY KEY,  -- UUID
  user_id         TEXT NOT NULL REFERENCES users(id),
  client_id       TEXT NOT NULL REFERENCES clients(id),
  matter_id       TEXT REFERENCES matters(id),
  date            TEXT NOT NULL,
  type            TEXT NOT NULL,  -- 'deposit', 'disbursement', 'refund', 'transfer', 'correction'
  amount          REAL NOT NULL,  -- positive for deposits, negative for disbursements
  running_balance REAL NOT NULL,  -- balance AFTER this transaction
  description     TEXT NOT NULL,
  reference       TEXT,  -- check number, transaction ID, etc.
  invoice_id      TEXT REFERENCES invoices(id),  -- if disbursement applied to invoice
  reconciled      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  -- NO updated_at — trust entries are immutable
  _crdt_clock     TEXT
);

-- Payments (tracks actual money received)
CREATE TABLE payments (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  invoice_id      TEXT NOT NULL REFERENCES invoices(id),
  amount          REAL NOT NULL,
  payment_method  TEXT NOT NULL,  -- 'stripe', 'lawpay', 'check', 'cash', 'trust_application'
  payment_date    TEXT NOT NULL,
  reference       TEXT,  -- transaction ID from payment processor
  account_type    TEXT NOT NULL,  -- 'operating', 'trust'
  status          TEXT NOT NULL DEFAULT 'completed',  -- 'pending', 'completed', 'failed', 'refunded'
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  _crdt_clock     TEXT
);

-- Indexes for common queries
CREATE INDEX idx_time_entries_matter ON time_entries(matter_id, date);
CREATE INDEX idx_time_entries_user_date ON time_entries(user_id, date);
CREATE INDEX idx_time_entries_status ON time_entries(status);
CREATE INDEX idx_matters_client ON matters(client_id);
CREATE INDEX idx_matters_user_status ON matters(user_id, status);
CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_trust_ledger_client ON trust_ledger(client_id, date);
CREATE INDEX idx_expenses_matter ON expenses(matter_id);
```

### Schema Design Notes

- **UUIDs everywhere.** Required for offline-first — multiple devices need to create records without coordinating with a central server. UUIDs avoid ID collisions.
- **`_crdt_clock` column.** Used by CR-SQLite for conflict resolution. Transparent to application code.
- **Snapshot pattern for invoices.** `invoice_line_items` captures a point-in-time snapshot of entries. If an attorney edits a time entry after invoicing, the invoice remains unchanged (legal/accounting requirement).
- **Trust ledger is append-only.** Corrections are recorded as new entries, never by editing existing ones. This creates an unbreakable audit trail required by every state bar.
- **Rate snapshots on time entries.** The `rate` on a time entry captures the rate at the time of entry, not the current matter rate. Rate changes don't retroactively change unbilled time.

---

## 5. Authentication

### Approach: Supabase Auth + Local Key Derivation

Authentication serves two purposes: identity verification (for sync) and encryption key generation (for local data protection).

```
┌────────────────────────────────────────┐
│            Authentication Flow          │
│                                        │
│  1. User signs up/signs in             │
│     → Supabase Auth (email + password) │
│     → Returns JWT + refresh token      │
│                                        │
│  2. Derive encryption key              │
│     → PBKDF2(password, user_salt)      │
│     → Key stored in memory only        │
│     → Never sent to server             │
│                                        │
│  3. Local DB encrypted with key        │
│     → SQLite encryption extension      │
│     → Data at rest is encrypted        │
│                                        │
│  4. Sync uses JWT for authorization    │
│     → Supabase RLS enforces per-user   │
│     → Data encrypted before upload     │
└────────────────────────────────────────┘
```

### Auth Options

| Method | MVP? | Notes |
|--------|------|-------|
| **Email + Password** | ✅ Yes | Primary method. Simple, universal. |
| **Magic Link (passwordless)** | ✅ Yes | Email a login link. Great for attorneys who hate passwords. Requires deriving encryption key differently (from a stored device key). |
| **Google OAuth** | Phase 2 | Many attorneys use Google Workspace. Easy add via Supabase. |
| **Microsoft OAuth** | Phase 2 | Enterprise/firm SSO. Important for 5+ attorney firms. |
| **Passkeys/WebAuthn** | Phase 3 | Passwordless, phishing-resistant. The future, but adoption still low. |

### Local-Only Mode

Users who never enable cloud sync still need authentication — but only locally:
- On first use, they set a PIN or password.
- This derives the encryption key for local SQLite.
- No Supabase account is created.
- If they later want sync, they create a Supabase account and their local data encrypts + uploads.

### Session Management
- JWT tokens stored in `httpOnly` cookies (not localStorage) for cloud operations.
- Local DB encryption key held in memory — cleared on tab close or explicit logout.
- Configurable auto-lock timer (5/15/30/60 minutes) for shared workstation security.
- Biometric unlock on supported devices (via WebAuthn) for quick re-authentication.

---

## 6. Deployment & Infrastructure

### Production Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      VERCEL                              │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ React SPA   │  │ Edge Functions│  │ Cron Functions │  │
│  │ (CDN-cached)│  │ (API routes) │  │ (invoice gen)  │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
└───────────────────────────┬─────────────────────────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Supabase    │ │   Stripe     │ │  Anthropic   │
│  (Postgres + │ │  (Payments)  │ │  (AI Claude) │
│   Auth +     │ │              │ │              │
│   Realtime)  │ │              │ │              │
└──────────────┘ └──────────────┘ └──────────────┘
```

### Environment Strategy

| Environment | Purpose | URL | Database |
|------------|---------|-----|----------|
| **Development** | Local dev | `localhost:5173` | Local SQLite + Supabase dev project |
| **Staging** | Pre-production testing | `staging.attorneytimetrack.com` | Supabase staging project |
| **Production** | Live users | `app.attorneytimetrack.com` | Supabase production project |

### CI/CD Pipeline (GitHub Actions)

```yaml
# On every push to a PR branch:
- TypeScript type checking
- ESLint
- Unit tests (Vitest)
- Build verification

# On merge to main:
- All above checks
- Deploy to Vercel production (auto)
- Run database migrations (if any)
- Smoke test production endpoint
```

### Monitoring & Observability

| Tool | Purpose |
|------|---------|
| **Vercel Analytics** | Web vitals, deployment health |
| **Sentry** | Error tracking, performance monitoring |
| **Plausible** | Privacy-respecting product analytics (no cookies, no PII) |
| **Supabase Dashboard** | Database metrics, auth events, API usage |
| **UptimeRobot** | Availability monitoring + alerting |

### Backup Strategy

- **Supabase:** Daily automated backups with 7-day point-in-time recovery (Pro plan).
- **Local data:** User's device handles this (Time Machine, iCloud, etc.). We provide a manual "Export All Data" button for explicit backups.
- **Trust ledger:** Additional daily snapshot exported to encrypted cloud storage (for users with sync enabled). Trust data loss is a malpractice risk — we over-protect it.

### Cost Estimates (MVP Scale: 0-1,000 users)

| Service | Plan | Monthly Cost |
|---------|------|-------------|
| Vercel | Pro | $20/mo |
| Supabase | Pro | $25/mo |
| Stripe | Pay-as-you-go | 2.9% + $0.30/transaction |
| Anthropic Claude | API usage | ~$50-200/mo (depends on AI narrative usage) |
| Sentry | Developer | Free |
| Plausible | Growth | $9/mo |
| Domain + DNS | Cloudflare | $10/year |
| **Total fixed** | | **~$60-75/mo** |

Infrastructure costs stay under $100/month until we hit significant scale. The local-first architecture means our servers handle sync traffic, not primary app load — which scales dramatically better than cloud-first competitors.

---

## 7. Migration Path from Current Prototype

Our existing React + Supabase + Vercel prototype is not wasted work. The migration path:

### Phase 1: Add Local SQLite Layer (2-3 weeks)
1. Add `wa-sqlite` + OPFS for client-side SQLite
2. Create a data access layer that reads/writes local SQLite
3. Background sync service that mirrors local changes to Supabase
4. Existing Supabase tables become the sync target (schema aligned with above)

### Phase 2: PWA + Offline (1-2 weeks)
1. Add `vite-plugin-pwa` with Workbox configuration
2. Service worker caches all app assets
3. Add sync status indicator UI
4. Test full offline workflow: start timer → create entry → generate invoice → all offline

### Phase 3: E2E Encryption (2-3 weeks)
1. Implement client-side encryption/decryption layer
2. Key derivation from user credentials
3. Encrypted sync protocol
4. "Privacy Fortress" page with technical details

### Phase 4: Payments + AI (2-3 weeks)
1. Stripe Connect integration for operating account payments
2. LawPay integration for trust account payments
3. Claude API integration for billing narrative generation
4. Invoice PDF generation via Edge Function

---

## 8. Key Technical Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Browser SQLite (OPFS) not supported** | Older browsers can't use app offline | Graceful fallback to IndexedDB with limited query support; show browser upgrade prompt |
| **CRDT sync conflicts in trust ledger** | Data integrity risk → bar discipline | Trust ledger is append-only; conflicts impossible by design. Running balance validated on every sync. |
| **Solo developer building complex sync** | Technical complexity, bugs | Use proven libraries (CR-SQLite, PowerSync) rather than building sync from scratch |
| **AI generates inappropriate billing narrative** | Ethical/professional risk | AI output always marked as "suggested" — attorney must review and approve. Never auto-submitted. |
| **E2E encryption key loss** | User locked out of their data | Recovery via Supabase Auth password reset re-derives key. Secondary recovery via encrypted key backup. |
| **Supabase downtime** | Sync unavailable | App works fully offline from local SQLite. Sync resumes when Supabase recovers. No user-facing impact. |

---

## 9. What This Architecture Enables

- ✅ **5-minute onboarding:** Sign up → local DB created → start tracking. No server round-trips needed.
- ✅ **Sub-100ms interactions:** All reads/writes hit local SQLite. No network latency for any user action.
- ✅ **Full offline capability:** Timer, entries, invoices — everything works without internet.
- ✅ **Multi-device sync:** Optional, encrypted, conflict-free via CRDTs.
- ✅ **Privacy fortress:** Local-first + E2E encryption = we literally cannot read your data.
- ✅ **Trust accounting integrity:** Append-only ledger with balance assertions and audit trails.
- ✅ **AI billing narratives:** Server-side, anonymized, attorney-reviewed. Saves hours per month.
- ✅ **Lean infrastructure:** Under $100/month to run until 1,000+ users. Local-first means our servers do less work.
- ✅ **Cross-platform:** Web + PWA covers desktop, tablet, and mobile with one codebase.

---

*This architecture is designed to be built incrementally. We can ship improvements to the existing prototype while migrating to the local-first model underneath. No big-bang rewrite required.*
