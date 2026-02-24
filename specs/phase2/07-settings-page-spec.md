# 07 — Settings Page Specification

*Phase 2 Spec — Created February 18, 2026*

---

## Design Principle

One scrollable page. Not 11 tabs like Bill4Time. Every setting a solo attorney needs, nothing they don't.

---

## Page Layout (`/settings`)

Vertically stacked sections with cards. Left-aligned labels, right-aligned controls.

```
┌─────────────────────────────────────────────────┐
│ Settings                           [Save Changes]│
│                                                   │
│ ┌───────────────────────────────────────────────┐ │
│ │ 📋 Firm Information                           │ │
│ │                                               │ │
│ │ Firm Name        [Vantrease Law PLLC        ] │ │
│ │ Attorney Name    [Ryan Vantrease            ] │ │
│ │ Bar Number       [KY12345                   ] │ │
│ │ Email            [ryan@vantreasselaw.com     ] │ │
│ │ Phone            [(859) 555-1234            ] │ │
│ │ Address Line 1   [456 Oak Avenue            ] │ │
│ │ Address Line 2   [                          ] │ │
│ │ City, State ZIP  [Lexington] [KY] [40502   ] │ │
│ │ Firm Logo        [Upload] (or drag & drop)    │ │
│ │                                               │ │
│ │ Used on invoices, PDF headers, LEDES export.  │ │
│ └───────────────────────────────────────────────┘ │
│                                                   │
│ ┌───────────────────────────────────────────────┐ │
│ │ 💰 Billing Defaults                          │ │
│ │                                               │ │
│ │ Default Rate     [$300.00     ] /hour          │ │
│ │ Billing Increment [6 minutes ▼]               │ │
│ │   (Options: 6 min, 10 min, 15 min)            │ │
│ │ Rounding Rule    [Round up ▼]                 │ │
│ │   (Options: Round up, Round down, Nearest)    │ │
│ │ Timekeeper Class [Partner ▼]                  │ │
│ │   (For LEDES: Partner, Associate, etc.)       │ │
│ │                                               │ │
│ │ These are defaults. Override per-client or    │ │
│ │ per-matter on their respective pages.         │ │
│ └───────────────────────────────────────────────┘ │
│                                                   │
│ ┌───────────────────────────────────────────────┐ │
│ │ 🧾 Invoice Defaults                          │ │
│ │                                               │ │
│ │ Invoice Prefix   [INV-                      ] │ │
│ │ Next Number      [01001                     ] │ │
│ │ Payment Terms    [Net 30 ▼]                   │ │
│ │   (Options: Due on Receipt, Net 15, 30, 45, 60│ │
│ │ Tax Rate (%)     [0.00                      ] │ │
│ │ Default Notes    [Thank you for your business]│ │
│ │                  [Payment is due within...   ]│ │
│ │                                               │ │
│ └───────────────────────────────────────────────┘ │
│                                                   │
│ ┌───────────────────────────────────────────────┐ │
│ │ 💳 Payment Processing                        │ │
│ │                                               │ │
│ │ Stripe:  ● Connected  [Disconnect]            │ │
│ │   — or —                                      │ │
│ │          [Connect Stripe Account]             │ │
│ │                                               │ │
│ │ • Clients pay by card or ACH bank transfer    │ │
│ │ • Fees: 2.9% + $0.30 (card) / 0.8% max $5    │ │
│ │ • Funds deposit directly to your bank         │ │
│ │                                               │ │
│ │ [  ] Pass processing fees to client           │ │
│ │   (Check local bar rules before enabling)     │ │
│ └───────────────────────────────────────────────┘ │
│                                                   │
│ ┌───────────────────────────────────────────────┐ │
│ │ ✉️  Email                                     │ │
│ │                                               │ │
│ │ Reply-To Email   [ryan@vantreasselaw.com    ] │ │
│ │ Email Subject    [Invoice {number} from      ]│ │
│ │                  [{firm_name}                ]│ │
│ │ Email Body       [Please find attached...    ]│ │
│ │                  [(rich text editor)         ]│ │
│ │                                               │ │
│ │ Variables: {number}, {client_name},            │ │
│ │ {amount}, {due_date}, {firm_name},             │ │
│ │ {payment_link}                                │ │
│ └───────────────────────────────────────────────┘ │
│                                                   │
│ ┌───────────────────────────────────────────────┐ │
│ │ 📊 Data & Privacy                            │ │
│ │                                               │ │
│ │ [Export All Data (CSV)]                       │ │
│ │ [Export All Data (JSON)]                      │ │
│ │                                               │ │
│ │ Download all your time entries, invoices,      │ │
│ │ payments, and trust records. Your data is     │ │
│ │ always yours.                                  │ │
│ │                                               │ │
│ │ [Delete Account]  (danger zone)               │ │
│ └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## Database: `user_settings` Table

Rather than adding 20 columns to `profiles`, create a dedicated settings table:

```sql
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Firm info
  firm_name TEXT,
  attorney_name TEXT,
  bar_number TEXT,
  phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  logo_url TEXT,

  -- Billing defaults
  default_rate NUMERIC(10,2) DEFAULT 300.00,
  billing_increment INTEGER DEFAULT 6, -- minutes
  rounding_rule TEXT DEFAULT 'up' CHECK (rounding_rule IN ('up', 'down', 'nearest')),
  timekeeper_classification TEXT DEFAULT 'PARTNER',

  -- Invoice defaults
  payment_terms TEXT DEFAULT 'Net 30',
  default_tax_rate NUMERIC(5,4) DEFAULT 0,
  invoice_notes TEXT,

  -- Email
  reply_to_email TEXT,
  email_subject_template TEXT DEFAULT 'Invoice {number} from {firm_name}',
  email_body_template TEXT DEFAULT 'Please find your invoice attached. You can pay online using the link below.',

  -- Stripe
  stripe_connected BOOLEAN DEFAULT FALSE,
  stripe_publishable_key TEXT,
  pass_fees_to_client BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY settings_select ON user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY settings_insert ON user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY settings_update ON user_settings FOR UPDATE USING (auth.uid() = user_id);
```

---

## Implementation Notes

- Auto-save on blur (debounced) or explicit "Save Changes" button — prefer explicit save to avoid confusion
- Show toast on successful save
- Firm logo: upload to Supabase Storage bucket `firm-logos/{user_id}/logo.png`
- Invoice prefix + next number: synced with `invoice_sequences` table
- Email templates: support variable interpolation with `{}` syntax
- Stripe section: conditionally shows Connect button or Connected status
- Data export: generates ZIP with CSVs for each table
- Delete account: confirmation dialog with email re-entry
