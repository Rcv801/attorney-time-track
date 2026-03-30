# SixMin Legal — Board Manual-Pay-First Beta Path

Last updated: March 20, 2026

## Board Verdict

The board can run a meaningful beta today on the manual-pay-first path.

What works now:
- create a client and matter
- capture billable time and expenses
- draft an invoice
- preview or download the invoice PDF
- copy an invoice email draft for manual sending
- record a manual payment and watch AR status update

What is still env-dependent:
- backend invoice email delivery
- Stripe payment-link generation
- stored PDF download from Supabase storage

## Shortest Smoke Path

Use this path for the fastest realistic board test.

1. Open https://attorney-time-track.vercel.app/ and log in.
2. Go to **Settings** and save at least:
   - Firm Name
   - Attorney Name
   - Payment Terms = `Net 30`
3. Go to **Clients & Matters**.
4. Create one client, for example `Acme Corp`.
5. Create one matter under that client, for example `Acme v. Beta LLC`.
6. Go to **Dashboard**.
7. Start the timer on that matter, let it run briefly, then stop it.
8. Go to **Entries** → **Expenses** and add one billable expense, for example `Court filing fee` for `$350`.
9. Go to **Invoices** → **New Invoice`.
10. Select the client and matter.
11. Check at least one time entry and the expense under **Unbilled Work**.
12. Confirm **Draft Preview** updates live.
13. Click **Create Draft Invoice**.
14. On **Invoice Detail**, verify:
    - invoice number exists
    - status is `Draft`
    - line items include both time and expense rows
    - balance due matches the draft total
15. Click **Download PDF** and confirm the invoice renders locally.
16. Click **Send Invoice** and use:
    - **Copy Draft** to copy the email text
    - **Preview PDF** or **Download PDF** for the attachment
17. Treat that point as the beta-safe send flow even if backend delivery is not configured.
18. Back on **Invoice Detail**, click **Record Payment**.
19. Save a manual payment with method `Check` and a reference like `Check #1234`.
20. Confirm:
    - the payment appears in the payments table
    - balance due drops
    - status moves to `Paid` if the invoice was fully paid
21. Go to **Reports** and confirm billed / collected / outstanding numbers reflect the new invoice and payment.

## Exact Stop Point If Env Is Missing

If operator env is incomplete, the board test should stop at this exact step:

1. Open **Send Invoice** on the invoice detail page.
2. Use **Copy Draft** and **Preview PDF** successfully.
3. Do not require the backend **Send Invoice** button to succeed.

That is the intended beta stop point for missing delivery env. The product is still meaningfully testable because the manual-pay-first loop remains intact.

## Expected Outcomes

By the end of the smoke path, the board should have evidence that:

- time and expenses become invoiceable work
- invoice totals and line items are generated correctly
- a client-ready PDF can be produced without backend delivery
- manual payment recording updates invoice balance and AR state
- reports reflect the billing activity

## Known Beta Constraints

- **Client email is manual**: the `clients` table does not yet store an email address, so the send dialog `To` field starts blank.
- **Client postal address is not modeled**: PDFs show firm details but not a structured client address block.
- **Stripe is optional for this beta**: if not configured, ignore `Generate Payment Link` and continue with manual payment recording.
- **Backend send is optional for this beta**: if delivery env is missing, use `Copy Draft` plus the generated PDF.
- **Stored PDF is optional for this beta**: if Supabase storage is not configured, use the local PDF download path.
