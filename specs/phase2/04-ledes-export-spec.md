# 04 — LEDES Export Specification

*Phase 2 Spec — Created February 18, 2026*

---

## Why LEDES Matters

LEDES (Legal Electronic Data Exchange Standard) is required by insurance companies and corporate legal departments for electronic billing. Competitors gate this behind $65-99/month tiers. We include it for everyone — a key differentiator.

---

## Supported Formats

### LEDES 1998B (Primary)
- Most widely used format
- Pipe-delimited (`|`) flat file
- Fixed header row with column names
- One row per line item
- `.ledes` or `.txt` extension

### LEDES 2000 (Secondary)
- XML-based
- More structured, supports nested data
- Less commonly required
- `.xml` extension

We implement **1998B first** (covers 90%+ of use cases), then 2000 as needed.

---

## LEDES 1998B Format Specification

### File Structure
```
LEDES1998B[]
INVOICE_DATE|INVOICE_NUMBER|CLIENT_ID|LAW_FIRM_MATTER_ID|INVOICE_TOTAL|BILLING_START_DATE|BILLING_END_DATE|LAW_FIRM_ID|LAW_FIRM_NAME|CLIENT_MATTER_ID|LINE_ITEM_NUMBER|EXP/FEE/INV_ADJ_TYPE|LINE_ITEM_NUMBER_OF_UNITS|LINE_ITEM_ADJUSTMENT_AMOUNT|LINE_ITEM_TOTAL|LINE_ITEM_DATE|LINE_ITEM_TASK_CODE|LINE_ITEM_EXPENSE_CODE|LINE_ITEM_ACTIVITY_CODE|TIMEKEEPER_ID|TIMEKEEPER_NAME|TIMEKEEPER_CLASSIFICATION|LINE_ITEM_DESCRIPTION[]
```

- First line: `LEDES1998B[]` (format identifier)
- Second line: Column headers separated by `|`, ending with `[]`
- Subsequent lines: Data rows separated by `|`, ending with `[]`
- `[]` is the line terminator (not `\n` — but `\n` between lines is acceptable)

### Field Mapping: Our Data → LEDES

| LEDES Field | Our Source | Notes |
|-------------|-----------|-------|
| `INVOICE_DATE` | `invoices.issued_date` | Format: YYYYMMDD |
| `INVOICE_NUMBER` | `invoices.invoice_number` | |
| `CLIENT_ID` | `clients.id` (or client name) | Client's identifier |
| `LAW_FIRM_MATTER_ID` | `matters.matter_number` or `matters.id` | Firm's internal matter reference |
| `INVOICE_TOTAL` | `invoices.total` | Decimal, 2 places |
| `BILLING_START_DATE` | `invoices.date_range_start` | YYYYMMDD |
| `BILLING_END_DATE` | `invoices.date_range_end` | YYYYMMDD |
| `LAW_FIRM_ID` | User's bar number or firm ID (from settings) | |
| `LAW_FIRM_NAME` | Firm name (from settings) | |
| `CLIENT_MATTER_ID` | Client's matter reference (if provided) | Optional |
| `LINE_ITEM_NUMBER` | Sequential per invoice, starting at 1 | |
| `EXP/FEE/INV_ADJ_TYPE` | `F` for fees (time), `E` for expenses, `IF` for adjustments | |
| `LINE_ITEM_NUMBER_OF_UNITS` | `billed_hours` for time, `1` for expenses | |
| `LINE_ITEM_ADJUSTMENT_AMOUNT` | `0` (unless discount applied) | |
| `LINE_ITEM_TOTAL` | Line item amount | |
| `LINE_ITEM_DATE` | Entry date | YYYYMMDD |
| `LINE_ITEM_TASK_CODE` | UTBMS task code (if assigned) | e.g., L110 (research), L120 (drafting) |
| `LINE_ITEM_EXPENSE_CODE` | UTBMS expense code (if expense) | e.g., E101 (copies), E107 (travel) |
| `LINE_ITEM_ACTIVITY_CODE` | UTBMS activity code | e.g., A101 (plan/prepare) |
| `TIMEKEEPER_ID` | `user.id` or bar number | |
| `TIMEKEEPER_NAME` | User's full name | |
| `TIMEKEEPER_CLASSIFICATION` | `PARTNER`, `ASSOCIATE`, `PARALEGAL`, etc. | From settings |
| `LINE_ITEM_DESCRIPTION` | Entry description / notes | |

---

## TypeScript Implementation

```typescript
// src/lib/ledes.ts

import { formatDate } from 'date-fns';

// ============================================================
// Types
// ============================================================

export interface LedesInvoiceData {
  // Invoice
  invoiceNumber: string;
  issuedDate: string;      // ISO date
  dateRangeStart: string;  // ISO date
  dateRangeEnd: string;    // ISO date
  total: number;

  // Firm
  firmId: string;          // bar number or firm ID
  firmName: string;

  // Client
  clientId: string;
  clientName: string;
  clientMatterId?: string; // client's reference for the matter

  // Matter
  matterNumber: string;

  // Timekeeper
  timekeeperId: string;
  timekeeperName: string;
  timekeeperClassification: TimekeeperClass;

  // Line items
  lineItems: LedesLineItem[];
}

export interface LedesLineItem {
  type: 'time' | 'expense' | 'adjustment';
  date: string;           // ISO date
  description: string;
  units: number;          // hours for time, 1 for expenses
  rate?: number;          // hourly rate for time
  amount: number;
  taskCode?: string;      // UTBMS task code
  expenseCode?: string;   // UTBMS expense code
  activityCode?: string;  // UTBMS activity code
}

export type TimekeeperClass =
  | 'PARTNER'
  | 'ASSOCIATE'
  | 'PARALEGAL'
  | 'SR_COUNSEL'
  | 'OF_COUNSEL'
  | 'LAW_CLERK'
  | 'OTHER';

// ============================================================
// LEDES 1998B Export
// ============================================================

const LEDES_1998B_HEADER = 'LEDES1998B[]';
const LEDES_1998B_COLUMNS = [
  'INVOICE_DATE',
  'INVOICE_NUMBER',
  'CLIENT_ID',
  'LAW_FIRM_MATTER_ID',
  'INVOICE_TOTAL',
  'BILLING_START_DATE',
  'BILLING_END_DATE',
  'LAW_FIRM_ID',
  'LAW_FIRM_NAME',
  'CLIENT_MATTER_ID',
  'LINE_ITEM_NUMBER',
  'EXP/FEE/INV_ADJ_TYPE',
  'LINE_ITEM_NUMBER_OF_UNITS',
  'LINE_ITEM_ADJUSTMENT_AMOUNT',
  'LINE_ITEM_TOTAL',
  'LINE_ITEM_DATE',
  'LINE_ITEM_TASK_CODE',
  'LINE_ITEM_EXPENSE_CODE',
  'LINE_ITEM_ACTIVITY_CODE',
  'TIMEKEEPER_ID',
  'TIMEKEEPER_NAME',
  'TIMEKEEPER_CLASSIFICATION',
  'LINE_ITEM_DESCRIPTION',
];

function formatLedesDate(isoDate: string): string {
  // LEDES uses YYYYMMDD format
  return isoDate.replace(/-/g, '').substring(0, 8);
}

function escapeLedesField(value: string): string {
  // Remove pipe characters and brackets from field values
  return value.replace(/\|/g, ' ').replace(/\[/g, '(').replace(/\]/g, ')');
}

function formatDecimal(num: number): string {
  return num.toFixed(2);
}

function getLineItemType(type: LedesLineItem['type']): string {
  switch (type) {
    case 'time': return 'F';        // Fee
    case 'expense': return 'E';     // Expense
    case 'adjustment': return 'IF'; // Invoice Fee Adjustment
  }
}

export function exportLedes1998B(invoice: LedesInvoiceData): string {
  const lines: string[] = [];

  // Line 1: Format identifier
  lines.push(LEDES_1998B_HEADER);

  // Line 2: Column headers
  lines.push(LEDES_1998B_COLUMNS.join('|') + '[]');

  // Line 3+: Data rows
  invoice.lineItems.forEach((item, index) => {
    const row = [
      formatLedesDate(invoice.issuedDate),
      escapeLedesField(invoice.invoiceNumber),
      escapeLedesField(invoice.clientId),
      escapeLedesField(invoice.matterNumber),
      formatDecimal(invoice.total),
      formatLedesDate(invoice.dateRangeStart),
      formatLedesDate(invoice.dateRangeEnd),
      escapeLedesField(invoice.firmId),
      escapeLedesField(invoice.firmName),
      escapeLedesField(invoice.clientMatterId || ''),
      String(index + 1),
      getLineItemType(item.type),
      formatDecimal(item.units),
      formatDecimal(0), // adjustment amount
      formatDecimal(item.amount),
      formatLedesDate(item.date),
      escapeLedesField(item.taskCode || ''),
      escapeLedesField(item.expenseCode || ''),
      escapeLedesField(item.activityCode || ''),
      escapeLedesField(invoice.timekeeperId),
      escapeLedesField(invoice.timekeeperName),
      invoice.timekeeperClassification,
      escapeLedesField(item.description),
    ];

    lines.push(row.join('|') + '[]');
  });

  return lines.join('\n');
}

// ============================================================
// LEDES 2000 (XML) Export
// ============================================================

export function exportLedes2000(invoice: LedesInvoiceData): string {
  const escXml = (s: string) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<ledes:invoice xmlns:ledes="http://www.ledes.org/2000/schema">
  <ledes:header>
    <ledes:invoice_number>${escXml(invoice.invoiceNumber)}</ledes:invoice_number>
    <ledes:invoice_date>${formatLedesDate(invoice.issuedDate)}</ledes:invoice_date>
    <ledes:invoice_total>${formatDecimal(invoice.total)}</ledes:invoice_total>
    <ledes:billing_start_date>${formatLedesDate(invoice.dateRangeStart)}</ledes:billing_start_date>
    <ledes:billing_end_date>${formatLedesDate(invoice.dateRangeEnd)}</ledes:billing_end_date>
  </ledes:header>
  <ledes:law_firm>
    <ledes:law_firm_id>${escXml(invoice.firmId)}</ledes:law_firm_id>
    <ledes:law_firm_name>${escXml(invoice.firmName)}</ledes:law_firm_name>
  </ledes:law_firm>
  <ledes:client>
    <ledes:client_id>${escXml(invoice.clientId)}</ledes:client_id>
    <ledes:client_matter_id>${escXml(invoice.clientMatterId || '')}</ledes:client_matter_id>
  </ledes:client>
  <ledes:matter>
    <ledes:law_firm_matter_id>${escXml(invoice.matterNumber)}</ledes:law_firm_matter_id>
  </ledes:matter>
  <ledes:line_items>`;

  invoice.lineItems.forEach((item, index) => {
    xml += `
    <ledes:line_item>
      <ledes:line_item_number>${index + 1}</ledes:line_item_number>
      <ledes:line_item_type>${getLineItemType(item.type)}</ledes:line_item_type>
      <ledes:line_item_date>${formatLedesDate(item.date)}</ledes:line_item_date>
      <ledes:line_item_units>${formatDecimal(item.units)}</ledes:line_item_units>
      <ledes:line_item_total>${formatDecimal(item.amount)}</ledes:line_item_total>
      <ledes:line_item_description>${escXml(item.description)}</ledes:line_item_description>
      <ledes:timekeeper>
        <ledes:timekeeper_id>${escXml(invoice.timekeeperId)}</ledes:timekeeper_id>
        <ledes:timekeeper_name>${escXml(invoice.timekeeperName)}</ledes:timekeeper_name>
        <ledes:timekeeper_classification>${invoice.timekeeperClassification}</ledes:timekeeper_classification>
      </ledes:timekeeper>
      ${item.taskCode ? `<ledes:task_code>${escXml(item.taskCode)}</ledes:task_code>` : ''}
      ${item.expenseCode ? `<ledes:expense_code>${escXml(item.expenseCode)}</ledes:expense_code>` : ''}
      ${item.activityCode ? `<ledes:activity_code>${escXml(item.activityCode)}</ledes:activity_code>` : ''}
    </ledes:line_item>`;
  });

  xml += `
  </ledes:line_items>
</ledes:invoice>`;

  return xml;
}

// ============================================================
// Helper: Build LEDES data from our database records
// ============================================================

export interface InvoiceWithDetails {
  invoice: {
    invoice_number: string;
    issued_date: string;
    date_range_start: string;
    date_range_end: string;
    total: number;
  };
  client: {
    id: string;
    name: string;
  };
  matter: {
    matter_number: string | null;
    name: string;
  };
  lineItems: Array<{
    line_type: string;
    date: string;
    description: string;
    quantity: number;
    rate: number | null;
    amount: number;
  }>;
  firmSettings: {
    firmName: string;
    firmId: string; // bar number or tax ID
    timekeeperName: string;
    timekeeperClassification: TimekeeperClass;
  };
}

export function buildLedesData(data: InvoiceWithDetails): LedesInvoiceData {
  return {
    invoiceNumber: data.invoice.invoice_number,
    issuedDate: data.invoice.issued_date,
    dateRangeStart: data.invoice.date_range_start,
    dateRangeEnd: data.invoice.date_range_end,
    total: data.invoice.total,
    firmId: data.firmSettings.firmId,
    firmName: data.firmSettings.firmName,
    clientId: data.client.id,
    clientName: data.client.name,
    matterNumber: data.matter.matter_number || data.matter.name,
    timekeeperId: data.firmSettings.firmId,
    timekeeperName: data.firmSettings.timekeeperName,
    timekeeperClassification: data.firmSettings.timekeeperClassification,
    lineItems: data.lineItems.map(li => ({
      type: li.line_type === 'expense' ? 'expense' as const
           : li.line_type === 'adjustment' || li.line_type === 'discount' ? 'adjustment' as const
           : 'time' as const,
      date: li.date,
      description: li.description,
      units: li.quantity,
      rate: li.rate ?? undefined,
      amount: li.amount,
    })),
  };
}

// ============================================================
// Download helper (browser)
// ============================================================

export function downloadLedesFile(
  content: string,
  filename: string,
  format: '1998B' | '2000' = '1998B'
): void {
  const mimeType = format === '2000' ? 'application/xml' : 'text/plain';
  const extension = format === '2000' ? '.xml' : '.ledes';
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename + extension;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

---

## UTBMS Task Codes Reference (Common)

Include a reference mapping in the app for attorneys to select task codes:

| Code | Description |
|------|------------|
| L110 | Fact Investigation/Development |
| L120 | Analysis/Strategy |
| L130 | Experts/Consultants |
| L140 | Document Drafting |
| L150 | Document Review |
| L160 | Filing/Registration |
| L190 | Other Litigation Activity |
| L210 | Pre-Trial Pleadings & Motions |
| L220 | Hearings |
| L230 | Trial Preparation |
| L240 | Trial/Hearing |
| L310 | Post-Trial Motions & Submissions |
| L320 | Appeals |
| L510 | Counseling |
| L520 | Negotiation/Mediation |
| L530 | Settlement |

### Common Activity Codes

| Code | Description |
|------|------------|
| A101 | Plan and Prepare |
| A102 | Research |
| A103 | Draft/Revise |
| A104 | Review/Analyze |
| A105 | Communicate (Client) |
| A106 | Communicate (Other) |
| A107 | Court/Hearing Appearance |
| A108 | Inspect/Investigate |
| A109 | Travel |

### Common Expense Codes

| Code | Description |
|------|------------|
| E101 | Copies/Reproduction |
| E102 | Outside Printing |
| E103 | Word Processing |
| E104 | Facsimile |
| E105 | Telephone |
| E106 | Online Research |
| E107 | Delivery/Messenger |
| E108 | Postage |
| E109 | Court Fees |
| E110 | Subpoena Fees |
| E111 | Expert Fees |
| E112 | Witness Fees |
| E113 | Travel |

---

## Sample Output (1998B)

```
LEDES1998B[]
INVOICE_DATE|INVOICE_NUMBER|CLIENT_ID|LAW_FIRM_MATTER_ID|INVOICE_TOTAL|BILLING_START_DATE|BILLING_END_DATE|LAW_FIRM_ID|LAW_FIRM_NAME|CLIENT_MATTER_ID|LINE_ITEM_NUMBER|EXP/FEE/INV_ADJ_TYPE|LINE_ITEM_NUMBER_OF_UNITS|LINE_ITEM_ADJUSTMENT_AMOUNT|LINE_ITEM_TOTAL|LINE_ITEM_DATE|LINE_ITEM_TASK_CODE|LINE_ITEM_EXPENSE_CODE|LINE_ITEM_ACTIVITY_CODE|TIMEKEEPER_ID|TIMEKEEPER_NAME|TIMEKEEPER_CLASSIFICATION|LINE_ITEM_DESCRIPTION[]
20260215|INV-01001|acme-corp|2026-001|2750.00|20260101|20260131|KY12345|Vantrease Law PLLC||1|F|3.50|0.00|1050.00|20260108|L140||A103|KY12345|Ryan Vantrease|PARTNER|Drafted motion for summary judgment; reviewed case law and statutory authority[]
20260215|INV-01001|acme-corp|2026-001|2750.00|20260101|20260131|KY12345|Vantrease Law PLLC||2|F|2.00|0.00|600.00|20260115|L120||A102|KY12345|Ryan Vantrease|PARTNER|Legal research regarding applicable statute of limitations[]
20260215|INV-01001|acme-corp|2026-001|2750.00|20260101|20260131|KY12345|Vantrease Law PLLC||3|F|1.50|0.00|450.00|20260122|L510||A105|KY12345|Ryan Vantrease|PARTNER|Telephone conference with client regarding case strategy and settlement options[]
20260215|INV-01001|acme-corp|2026-001|2750.00|20260101|20260131|KY12345|Vantrease Law PLLC||4|E|1.00|0.00|350.00|20260110||E109||KY12345|Ryan Vantrease|PARTNER|Circuit Court filing fee - motion for summary judgment[]
20260215|INV-01001|acme-corp|2026-001|2750.00|20260101|20260131|KY12345|Vantrease Law PLLC||5|F|1.00|0.00|300.00|20260128|L220||A107|KY12345|Ryan Vantrease|PARTNER|Court appearance for status conference[]
```

---

## UI Integration

The LEDES export button appears on:
1. **Invoice Detail page** — "Export LEDES" dropdown (1998B / 2000)
2. **Invoice List page** — Batch export for selected invoices
3. File downloads immediately with name format: `{invoice_number}_LEDES.ledes`
