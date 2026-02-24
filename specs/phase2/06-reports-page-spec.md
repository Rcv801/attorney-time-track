# 06 — Reports Page Specification

*Phase 2 Spec — Created February 18, 2026*

---

## Philosophy

Attorneys need 5-6 numbers, not a BI dashboard. Keep it lean. Every report answers a specific question a solo attorney actually asks.

---

## Page Layout (`/reports`)

```
┌────────────────────────────────────────────────────┐
│ Reports                                             │
│                                                     │
│ [Period: This Month ▼] [Client: All ▼] [Export CSV] │
│                                                     │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐│
│ │ Hours    │ │ Billed   │ │ Collected│ │ Outstand ││
│ │ 42.3     │ │ $12,690  │ │ $8,450   │ │ $4,240  ││
│ │ ▲ 12%    │ │ ▲ 8%     │ │ ▼ 3%     │ │ ▲ 15%   ││
│ └──────────┘ └──────────┘ └──────────┘ └─────────┘│
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │  Revenue Chart (BarChart)                       │ │
│ │  Billed vs Collected by month                   │ │
│ │  ████ $12k  ████ $11k  ████ $14k  ...          │ │
│ │  ░░░░ $8k   ░░░░ $10k  ░░░░ $9k               │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌───────────────────────┐ ┌─────────────────────┐   │
│ │ Hours by Matter       │ │ AR Aging            │   │
│ │ (Horizontal BarChart) │ │                     │   │
│ │ Smith v Jones   18.2  │ │ Current:    $1,200  │   │
│ │ Doe Estate      12.5  │ │ 30 days:   $1,540  │   │
│ │ Acme Contract   8.1   │ │ 60 days:   $800    │   │
│ │ ...                   │ │ 90+ days:  $700    │   │
│ └───────────────────────┘ └─────────────────────┘   │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Hours by Client (PieChart)                      │ │
│ │ 🔵 Acme Corp 35%  🟢 Smith 28%  🟡 Doe 22%    │ │
│ └─────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

---

## Reports Defined

### 1. Summary Cards (Top Row)

| Card | Value | Calculation | Trend |
|------|-------|-------------|-------|
| **Hours Tracked** | Total billable hours in period | SUM of rounded hours from entries | vs. previous period |
| **Billed** | Total amount invoiced | SUM of invoice totals (non-void) | vs. previous period |
| **Collected** | Total payments received | SUM of completed payments | vs. previous period |
| **Outstanding** | Unpaid invoice balance | SUM of balance_due on non-void invoices | vs. previous period |

Trend: percentage change vs. same-length prior period (e.g., this month vs. last month).

### 2. Revenue Chart (Billed vs. Collected by Month)

- **Chart type:** `BarChart` (recharts) — grouped bars
- **X-axis:** Months (last 6 or 12 months)
- **Y-axis:** Dollar amount
- **Series:** Billed (blue), Collected (green)
- **Tooltip:** Exact amounts on hover

```tsx
<BarChart data={monthlyRevenue}>
  <XAxis dataKey="month" />
  <YAxis tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
  <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
  <Bar dataKey="billed" fill="#3b82f6" name="Billed" />
  <Bar dataKey="collected" fill="#22c55e" name="Collected" />
</BarChart>
```

### 3. Hours by Matter

- **Chart type:** Horizontal `BarChart`
- **Data:** Top 10 matters by hours in period
- **Shows:** Matter name + total hours
- **Clicking a bar** → filters to that matter

### 4. AR Aging

- **Chart type:** Table or stacked bar
- **Buckets:** Current (0-30), 31-60, 61-90, 90+
- **Data:** Unpaid invoices grouped by age since issued_date
- **Color coding:** Current (green), 31-60 (yellow), 61-90 (orange), 90+ (red)

```sql
-- AR Aging query
SELECT
  CASE
    WHEN CURRENT_DATE - issued_date <= 30 THEN 'current'
    WHEN CURRENT_DATE - issued_date <= 60 THEN '31-60'
    WHEN CURRENT_DATE - issued_date <= 90 THEN '61-90'
    ELSE '90+'
  END AS aging_bucket,
  COUNT(*) AS invoice_count,
  SUM(balance_due) AS total_outstanding
FROM invoices
WHERE user_id = $1
  AND status NOT IN ('paid', 'void', 'draft', 'written_off')
  AND balance_due > 0
GROUP BY aging_bucket
ORDER BY
  CASE aging_bucket
    WHEN 'current' THEN 1
    WHEN '31-60' THEN 2
    WHEN '61-90' THEN 3
    ELSE 4
  END;
```

### 5. Hours by Client

- **Chart type:** `PieChart` or `DonutChart`
- **Data:** Top clients by hours in period
- **Shows:** Client name + percentage + hours

### 6. Utilization Rate (Optional — show if data available)

- **Calculation:** (Billable hours / Available hours) × 100
- **Available hours:** Configurable in settings (default: 8 hrs/day × business days)
- **Display:** Simple percentage with gauge or progress bar
- **Note:** Only meaningful for attorneys who track most of their day

---

## Filters

| Filter | Type | Options |
|--------|------|---------|
| **Period** | Select | This Week, This Month, This Quarter, This Year, Last Month, Last Quarter, Last Year, Custom Range |
| **Client** | Select | All Clients, or specific client |
| **Matter** | Select | All Matters, or specific matter (filtered by client) |

All charts and cards update when filters change.

---

## Data Queries

```typescript
// Summary stats
const { data: stats } = useQuery({
  queryKey: ['report-stats', { period, clientId, matterId }],
  queryFn: async () => {
    // Hours: from entries
    // Billed: from invoices
    // Collected: from payments
    // Outstanding: from invoices where balance_due > 0
  }
});

// Monthly revenue (last 12 months)
const { data: monthlyRevenue } = useQuery({
  queryKey: ['report-revenue-monthly', { clientId }],
  queryFn: async () => {
    // GROUP BY month from invoices + payments
  }
});

// Hours by matter
const { data: hoursByMatter } = useQuery({
  queryKey: ['report-hours-matter', { period, clientId }],
  queryFn: async () => {
    // SUM hours from entries GROUP BY matter_id
  }
});

// AR aging
const { data: arAging } = useQuery({
  queryKey: ['report-ar-aging'],
  queryFn: async () => {
    // Aging bucket query above
  }
});
```

---

## CSV Export

"Export CSV" button generates a detailed time entry report:

| Date | Client | Matter | Description | Hours | Rate | Amount | Invoice # | Status |
|------|--------|--------|-------------|-------|------|--------|-----------|--------|

Uses the current filters. Downloads as `sixmin-report-{period}.csv`.

---

## Implementation Notes

- Use `recharts` (already installed) for all charts
- Responsive: charts stack vertically on mobile
- Loading states: skeleton cards + chart placeholders
- Empty states: "No data for this period" with illustration
- Colors: Use Tailwind color palette for chart series
- All money formatted with `$` and 2 decimal places
- Period comparisons use exact prior period (e.g., Feb vs Jan, Q1 vs Q4)
