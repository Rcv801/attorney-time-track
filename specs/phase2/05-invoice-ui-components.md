# 05 — Invoice UI Components

*Phase 2 Spec — Created February 18, 2026*

---

## Component Tree

```
App
├── /invoices                    → InvoicesPage
│   ├── InvoiceList              (table of all invoices)
│   │   ├── InvoiceStatusBadge
│   │   └── InvoiceActions       (dropdown: view, send, void, export)
│   └── InvoiceFilters           (status, client, date range)
│
├── /invoices/new                → InvoiceBuilder
│   ├── Step 1: ClientMatterSelect
│   ├── Step 2: EntrySelector    (pick unbilled entries)
│   │   └── EntryCheckboxRow
│   ├── Step 3: InvoicePreview
│   │   ├── InvoiceHeader        (firm info, client info)
│   │   ├── LineItemsTable
│   │   ├── InvoiceTotals        (subtotal, tax, trust, total)
│   │   └── InvoiceNotes         (payment terms, notes)
│   └── Step 4: ReviewAndSend
│
├── /invoices/:id                → InvoiceDetail
│   ├── InvoiceHeader
│   ├── LineItemsTable
│   ├── InvoiceTotals
│   ├── PaymentHistory
│   │   └── PaymentRow
│   ├── TrustApplication         (apply trust balance)
│   └── InvoiceActions           (send, record payment, export, void)
│
└── Components (shared)
    ├── InvoicePDF               (PDF generation layout)
    └── PaymentDialog            (record manual payment)
```

---

## Page: InvoicesPage (`/invoices`)

The main invoicing hub. Shows all invoices with filtering and bulk actions.

```tsx
// pages/app/Invoices.tsx

interface InvoicesPageState {
  statusFilter: InvoiceStatus | 'all';
  clientFilter: string | null;
  dateRange: { from: Date; to: Date } | null;
  searchQuery: string;
}
```

### Layout
- **Header:** "Invoices" title + summary stats (outstanding, overdue, collected this month)
- **Actions:** "New Invoice" button (→ InvoiceBuilder)
- **Filters:** Status tabs (All | Draft | Sent | Overdue | Paid | Void), client dropdown, date picker
- **Table:** Invoice list with columns below

### InvoiceList Columns
| Column | Content |
|--------|---------|
| Invoice # | `INV-01001` (link to detail) |
| Client | Client name |
| Matter | Matter name (or "Multiple") |
| Date | Issued date |
| Amount | Total |
| Balance | Balance due |
| Status | Badge (Draft/Sent/Paid/Overdue/Partial/Void) |
| Actions | Dropdown menu |

### InvoiceStatusBadge

```tsx
function InvoiceStatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: string; label: string }> = {
    draft: { variant: 'secondary', label: 'Draft' },
    sent: { variant: 'default', label: 'Sent' },
    viewed: { variant: 'outline', label: 'Viewed' },
    paid: { variant: 'success', label: 'Paid' },      // custom green variant
    partial: { variant: 'warning', label: 'Partial' }, // custom yellow variant
    overdue: { variant: 'destructive', label: 'Overdue' },
    void: { variant: 'secondary', label: 'Void' },
  };
  const v = variants[status] || variants.draft;
  return <Badge variant={v.variant as any}>{v.label}</Badge>;
}
```

---

## Page: InvoiceBuilder (`/invoices/new`)

Multi-step wizard for creating an invoice. Uses shadcn/ui Stepper pattern.

### Step 1: Select Client & Matter

```tsx
interface Step1Props {
  onSelect: (clientId: string, matterId?: string) => void;
}

// UI: Client dropdown → Matter dropdown (optional, for client-level invoices)
// Shows trust balance if available
// Shows unbilled entry count per matter
```

### Step 2: Select Entries

```tsx
interface Step2Props {
  clientId: string;
  matterId?: string;
  selectedEntryIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

// Fetches unbilled_entries view
// Checkbox table with:
//   □ | Date | Matter | Description | Hours | Rate | Amount
// "Select All" / "Deselect All" buttons
// Running total at bottom
// Date range filter (optional)
// Also shows unbilled expenses for selection
```

### Step 3: Preview

```tsx
interface Step3Props {
  invoiceData: {
    clientId: string;
    matterId?: string;
    entryIds: string[];
    expenseIds: string[];
    notes: string;
    paymentTerms: string;
    dueDate: string;
    taxRate: number;
    applyTrust: number; // amount to apply from trust
  };
  onEdit: () => void; // go back
  onConfirm: () => void;
}

// Shows full invoice preview (mimics PDF layout)
// Editable fields: notes, payment terms, due date, tax rate
// Trust application section (if trust balance > 0):
//   "Apply from trust: $____" (up to trust balance)
// Summary: Subtotal, Tax, Trust Applied, Balance Due
```

### Step 4: Review & Send

```tsx
interface Step4Props {
  invoiceId: string;
  onSendEmail: () => void;
  onDownloadPDF: () => void;
  onSaveDraft: () => void;
}

// Invoice is created in DB as 'draft'
// Options:
//   - "Save as Draft" (stay draft, go to detail page)
//   - "Download PDF" (generate + download)
//   - "Send to Client" (email invoice with payment link)
//     - Shows email preview: to, subject, body
//     - Option to include payment link (if Stripe connected)
```

---

## Page: InvoiceDetail (`/invoices/:id`)

View and manage a single invoice.

### Layout

```
┌─────────────────────────────────────────────┐
│ ← Back to Invoices                          │
│                                             │
│ Invoice INV-01001           [Actions ▼]     │
│ Status: Sent  •  Due: Mar 15, 2026          │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│ BILL TO              FROM                   │
│ Acme Corp            Vantrease Law PLLC     │
│ 123 Main St          456 Oak Ave            │
│ Louisville, KY       Lexington, KY          │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│ Date       Description          Hrs   Amt   │
│ 01/08/26   Draft motion...      3.5  $1,050 │
│ 01/15/26   Legal research...    2.0  $600   │
│ 01/22/26   Client conference    1.5  $450   │
│ 01/28/26   Court appearance     1.0  $300   │
│                                             │
│ EXPENSE                                     │
│ 01/10/26   Filing fee           —    $350   │
│                                             │
│                        Subtotal:   $2,750   │
│                        Tax (0%):   $0.00    │
│                        Trust:     -$500.00  │
│                        ─────────────────    │
│                        Balance Due: $2,250  │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│ Payment History                             │
│ 02/05/26  Stripe (Card)  $1,000  Completed  │
│ 02/10/26  Check #5678    $1,250  Completed  │
│                                             │
│ Balance: $0.00 — PAID                       │
│                                             │
└─────────────────────────────────────────────┘
```

### Actions Dropdown
- **Send/Resend** — Email to client
- **Record Payment** — Opens PaymentDialog
- **Apply Trust** — Draw from trust balance
- **Download PDF** — Generate and download
- **Export LEDES** — 1998B or 2000
- **Duplicate** — Create new invoice from this template
- **Void** — Mark as void (with confirmation)

---

## Component: PaymentDialog

Modal for recording manual payments (check, cash, wire).

```tsx
interface PaymentDialogProps {
  invoiceId: string;
  balanceDue: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Form fields:
// - Amount (default: balance due)
// - Payment Method: Select (Check, Cash, Wire, Other)
// - Date: Date picker (default: today)
// - Reference: Text input (check number, wire ref)
// - Account Type: Radio (Operating / Trust)
// - Notes: Textarea (optional)
```

---

## Component: InvoicePDF

PDF layout specification for `@react-pdf/renderer` or html-to-pdf approach.

### Recommended approach: HTML → PDF via Edge Function

Use a Supabase Edge Function with Puppeteer/Playwright to render an HTML template to PDF. This gives us full CSS control and avoids `@react-pdf/renderer` limitations.

### PDF Layout

```
┌─────────────────────────────────────────────────┐
│                                                   │
│  [FIRM LOGO]                                      │
│  Vantrease Law PLLC                               │
│  456 Oak Avenue                                   │
│  Lexington, KY 40502                              │
│  (859) 555-1234                                   │
│  ryan@vantreasselaw.com                           │
│                                                   │
│  ─────────────────────────────────────────────    │
│                                                   │
│  INVOICE                                          │
│  Invoice #: INV-01001                             │
│  Date: February 15, 2026                          │
│  Due Date: March 17, 2026                         │
│  Payment Terms: Net 30                            │
│                                                   │
│  BILL TO:                                         │
│  Acme Corporation                                 │
│  Attn: Jane Smith                                 │
│  123 Main Street                                  │
│  Louisville, KY 40202                             │
│                                                   │
│  RE: Smith v. Jones (Matter #2026-001)            │
│                                                   │
│  ─────────────────────────────────────────────    │
│                                                   │
│  PROFESSIONAL SERVICES                            │
│                                                   │
│  Date       Description              Hours  Amount│
│  ──────     ─────────────────────    ─────  ──────│
│  01/08/26   Drafted motion for       3.5   $1,050 │
│             summary judgment;                     │
│             reviewed case law                     │
│  01/15/26   Legal research           2.0   $600   │
│  ...                                              │
│                                                   │
│  EXPENSES                                         │
│                                                   │
│  Date       Description                    Amount │
│  01/10/26   Court filing fee               $350   │
│                                                   │
│  ─────────────────────────────────────────────    │
│                                                   │
│                   Subtotal:            $2,750.00  │
│                   Trust Applied:       ($500.00)  │
│                   Balance Due:         $2,250.00  │
│                                                   │
│  ─────────────────────────────────────────────    │
│                                                   │
│  Payment Instructions:                            │
│  Pay online: [payment link]                       │
│  Mail check to: [firm address]                    │
│  Make payable to: Vantrease Law PLLC              │
│                                                   │
│  Thank you for your business.                     │
│                                                   │
│  ─────────────────────────────────────────────    │
│  [Terms / Notes from invoice]                     │
│                                                   │
└─────────────────────────────────────────────────┘
```

### Page: 8.5" × 11" letter size
### Font: Inter or system serif for professional look
### Colors: Minimal — firm accent color for header, rest is black/gray

---

## Data Flow Summary

```
InvoiceBuilder
  1. User selects client/matter
  2. Fetches unbilled entries (unbilled_entries view)
  3. User checks entries to include
  4. Preview calculates totals
  5. On confirm:
     a. Call get_next_invoice_number() → invoice_number
     b. INSERT invoice (status: 'draft')
     c. INSERT invoice_line_items (snapshot of selected entries)
     d. UPDATE entries SET billed = true, invoice_id = new_id
     e. If trust applied: INSERT trust_ledger (disbursement)
  6. User can then Send (→ status: 'sent') or Save Draft

InvoiceDetail
  - Fetches invoice + line items + payments
  - Record Payment → INSERT payment → trigger updates invoice balance
  - Send → generates PDF, emails client, updates status + sent_at
  - LEDES Export → builds LedesInvoiceData, downloads file
```

---

## shadcn/ui Components Used

| Component | Usage |
|-----------|-------|
| `Card`, `CardHeader`, `CardContent` | Invoice cards, sections |
| `Table`, `TableRow`, `TableCell` | Entry selection, line items, payment history |
| `Badge` | Invoice status |
| `Button` | Actions |
| `Dialog` | PaymentDialog |
| `Select` | Client/matter/method selectors |
| `Input` | Amount, reference, search |
| `Textarea` | Notes, description |
| `Calendar` / `Popover` | Date pickers |
| `Checkbox` | Entry selection |
| `DropdownMenu` | Invoice actions |
| `Tabs` | Status filters |
| `Separator` | Visual dividers |
| `Stepper` (custom) | InvoiceBuilder steps |

---

## Queries (TanStack Query Keys)

```typescript
// Invoice list
queryKey: ['invoices', { status, clientId, dateRange }]

// Single invoice with details
queryKey: ['invoice', invoiceId]

// Unbilled entries for invoice builder
queryKey: ['unbilled-entries', { clientId, matterId }]

// Payments for an invoice
queryKey: ['payments', invoiceId]

// Invoice summary stats
queryKey: ['invoice-stats']
```
