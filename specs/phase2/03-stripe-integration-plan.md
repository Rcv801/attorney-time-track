# 03 — Stripe Integration Plan

*Phase 2 Spec — Created February 18, 2026*

---

## Architecture Decision: Stripe Direct (Not Stripe Connect)

**Decision: Use Stripe direct integration with separate payment intents.**

| Option | Pros | Cons |
|--------|------|------|
| **Stripe Connect** | Platform-level payment routing, marketplace support | Complexity overkill for solo app, onboarding friction (KYC per attorney), higher fees |
| **Stripe Direct** ✅ | Simple setup, attorney owns their Stripe account, lower fees | Each attorney manages their own Stripe dashboard |

For a solo attorney tool, each user creates their own Stripe account and connects it via API keys or OAuth. We never touch their money — we just generate payment links. This is the simplest, most compliant approach.

**Trust vs. Operating account separation:** Handled at the application level via metadata, not at the Stripe level. Stripe doesn't need to know about IOLTA — we route the accounting correctly in our database.

---

## Integration Architecture

```
┌──────────────────────────────────────────────────┐
│                   SixMin App                      │
│                                                    │
│  Invoice Created → Generate Stripe Payment Link    │
│              ↓                                     │
│  Payment Link embedded in invoice email / PDF      │
│              ↓                                     │
│  Client clicks link → Stripe Checkout Session      │
│              ↓                                     │
│  Stripe processes payment                          │
│              ↓                                     │
│  Webhook → Supabase Edge Function                  │
│              ↓                                     │
│  Edge Function updates payments table + invoice    │
└──────────────────────────────────────────────────┘
```

---

## Step-by-Step Implementation

### Step 1: Settings — Store Stripe Keys

Add to the `profiles` table (or a new `user_settings` table):

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_secret_key_encrypted TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_publishable_key TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_webhook_secret_encrypted TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_connected BOOLEAN DEFAULT FALSE;
```

> **Security note:** Secret keys must be encrypted at rest. Use Supabase Vault or encrypt client-side before storing. Never expose secret keys to the frontend.

Better approach — store in **Supabase Vault** (secrets management):

```sql
-- Store via Supabase Vault (Edge Function only)
SELECT vault.create_secret('stripe_sk_user_123', 'sk_live_...');
```

### Step 2: Create Payment Link (Edge Function)

```typescript
// supabase/functions/create-payment-link/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14";

serve(async (req) => {
  const { invoice_id } = await req.json();

  // Auth check
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // Get invoice
  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, client:clients(*)")
    .eq("id", invoice_id)
    .eq("user_id", user.id)
    .single();

  if (!invoice) return new Response("Invoice not found", { status: 404 });

  // Get user's Stripe key from Vault
  const stripeKey = await getStripeKey(user.id); // from Vault
  const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

  // Create Checkout Session
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: {
          name: `Invoice ${invoice.invoice_number}`,
          description: `Legal services — ${invoice.client.name}`,
        },
        unit_amount: Math.round(invoice.balance_due * 100), // cents
      },
      quantity: 1,
    }],
    payment_method_types: ["card", "us_bank_account"], // card + ACH
    metadata: {
      invoice_id: invoice.id,
      user_id: user.id,
      account_type: "operating", // or "trust" based on invoice context
    },
    success_url: `${Deno.env.get("APP_URL")}/invoices/${invoice.id}?payment=success`,
    cancel_url: `${Deno.env.get("APP_URL")}/invoices/${invoice.id}?payment=cancelled`,
    expires_after_completion: { type: "immediate" as any },
  });

  // Save payment link to invoice
  await supabase
    .from("invoices")
    .update({ payment_link: session.url })
    .eq("id", invoice_id);

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

### Step 3: Webhook Handler (Edge Function)

```typescript
// supabase/functions/stripe-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14";

serve(async (req) => {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  // Use service role for DB writes
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Verify webhook signature
  // Note: In production, get webhook secret per-user from metadata
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    apiVersion: "2024-12-18.acacia",
  });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    return new Response(`Webhook signature failed: ${err.message}`, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoiceId = session.metadata?.invoice_id;
      const userId = session.metadata?.user_id;
      const accountType = session.metadata?.account_type || "operating";

      if (!invoiceId || !userId) break;

      const amountPaid = (session.amount_total || 0) / 100;

      // Record payment (trigger will update invoice)
      await supabase.from("payments").insert({
        user_id: userId,
        invoice_id: invoiceId,
        amount: amountPaid,
        payment_method: session.payment_method_types?.[0] === "us_bank_account"
          ? "stripe_ach" : "stripe_card",
        payment_date: new Date().toISOString().split("T")[0],
        stripe_payment_intent_id: session.payment_intent as string,
        account_type: accountType,
        status: "completed",
      });

      // If payment to trust, also record trust ledger entry
      if (accountType === "trust") {
        const { data: invoice } = await supabase
          .from("invoices")
          .select("client_id, matter_id")
          .eq("id", invoiceId)
          .single();

        if (invoice?.matter_id) {
          await supabase.rpc("record_trust_transaction", {
            p_user_id: userId,
            p_client_id: invoice.client_id,
            p_matter_id: invoice.matter_id,
            p_type: "deposit",
            p_amount: amountPaid,
            p_description: `Online payment via Stripe`,
            p_reference: session.payment_intent as string,
          });
        }
      }

      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = charge.payment_intent as string;

      // Find the payment and update status
      await supabase
        .from("payments")
        .update({ status: "refunded" })
        .eq("stripe_payment_intent_id", paymentIntentId);

      break;
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
```

### Step 4: Payment Link in Invoice Email

```typescript
// When sending invoice email, include the payment link
const invoiceEmailHtml = `
  <h2>Invoice ${invoice.invoice_number}</h2>
  <p>Amount due: $${invoice.balance_due.toFixed(2)}</p>
  <p>Due date: ${invoice.due_date}</p>
  
  <a href="${invoice.payment_link}" 
     style="background: #2563eb; color: white; padding: 12px 24px; 
            text-decoration: none; border-radius: 6px; display: inline-block;">
    Pay Now — $${invoice.balance_due.toFixed(2)}
  </a>
  
  <p style="color: #666; font-size: 12px; margin-top: 24px;">
    Secure payment processed by Stripe. 
    We accept credit cards and bank transfers (ACH).
  </p>
`;
```

### Step 5: Frontend — Settings Page Stripe Setup

```tsx
// Components for Settings page
function StripeSetup() {
  const [connected, setConnected] = useState(false);
  
  // Option A: Manual key entry (simpler)
  // Option B: Stripe OAuth Connect flow (better UX)
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Processing</CardTitle>
        <p className="text-sm text-muted-foreground">
          Connect your Stripe account to accept online payments on invoices.
        </p>
      </CardHeader>
      <CardContent>
        {connected ? (
          <div className="flex items-center gap-2">
            <Badge variant="default">Connected</Badge>
            <span className="text-sm text-muted-foreground">
              Stripe account linked
            </span>
          </div>
        ) : (
          <Button onClick={initiateStripeOAuth}>
            Connect Stripe Account
          </Button>
        )}
        
        <div className="mt-4 space-y-2 text-sm text-muted-foreground">
          <p>• Clients can pay by credit card or ACH bank transfer</p>
          <p>• Stripe fees: 2.9% + $0.30 (card) / 0.8% capped at $5 (ACH)</p>
          <p>• Payments are deposited directly to your bank account</p>
          <p>• We never touch your funds</p>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Trust vs. Operating Account Handling

### The Problem
Bar rules require that client retainer payments go into a trust/IOLTA account, not the attorney's operating account. When a client pays a retainer via Stripe, the funds must be designated as trust funds.

### Our Approach
1. **Application-level separation, not Stripe-level.** The attorney has one Stripe account. We track whether a payment is trust or operating in our database.
2. **Invoice context determines account type.** If the invoice is for a retainer deposit → `account_type: 'trust'`. If it's for earned fees → `account_type: 'operating'`.
3. **The attorney is responsible for routing.** When Stripe deposits to their bank, they transfer trust funds to their IOLTA account. This is how most solo attorneys already work.
4. **Future enhancement:** Support Stripe Connected Accounts with separate bank accounts for trust vs. operating. This adds complexity but provides true fund separation at the payment processor level.

### Trust Payment Flow
```
Client pays retainer via Stripe
  → payment recorded as account_type: 'trust'
  → trust_ledger entry created (deposit)
  → matter trust_balance updated
  → Attorney transfers funds to IOLTA bank account (manual step)

Attorney bills against retainer
  → Invoice created
  → Trust disbursement recorded (trust_ledger)
  → matter trust_balance decreased
  → Attorney transfers earned fees from IOLTA to operating (manual step)
```

---

## PCI Compliance

**Our PCI compliance approach: SAQ-A (simplest level).**

We never see, store, or process card numbers. Stripe Checkout handles all payment UI in a Stripe-hosted page. Our responsibilities:

1. ✅ Use Stripe Checkout (not Stripe Elements embedded in our page)
2. ✅ Serve our app over HTTPS
3. ✅ Store Stripe API keys securely (Supabase Vault, never client-side)
4. ✅ Verify webhook signatures
5. ✅ Never log payment details (card numbers, CVV)

This keeps us at the lowest PCI compliance burden (SAQ-A) — essentially just a self-assessment questionnaire.

---

## Implementation Order

| Step | Task | Complexity |
|------|------|-----------|
| 1 | Add Stripe key storage to profiles / Vault | S |
| 2 | Settings page Stripe connection UI | S |
| 3 | `create-payment-link` Edge Function | M |
| 4 | `stripe-webhook` Edge Function | M |
| 5 | Payment link on invoice detail page | S |
| 6 | Payment recording + invoice balance update | S (triggers from 01-spec) |
| 7 | Trust account routing in webhook | M |
| 8 | Stripe OAuth flow (optional, better UX) | L |
| 9 | ACH support testing | S |
| 10 | Refund handling | M |

---

## Cost to Attorney

| Payment Method | Stripe Fee | Attorney Pays |
|---------------|------------|---------------|
| Credit/Debit Card | 2.9% + $0.30 | Standard |
| ACH Bank Transfer | 0.8%, max $5.00 | Much cheaper |

For a typical $2,000 legal invoice:
- Card: $58.30 fee (2.9% + $0.30)
- ACH: $5.00 fee (capped)

**Recommendation:** Default to showing both options. For larger invoices, ACH saves attorneys significant money. Consider a setting to pass fees through to clients (some states allow this).
