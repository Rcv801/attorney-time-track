import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.25.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!stripeSecretKey || !stripeWebhookSecret || !supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Webhook environment is incomplete. Expected STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return new Response(JSON.stringify({ error: "Missing stripe-signature header" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.text();
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-06-20",
    });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid webhook signature";
      return new Response(JSON.stringify({ error: message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoiceId = session.metadata?.invoice_id;
      const userId = session.metadata?.user_id;
      const paymentIntentId =
        typeof session.payment_intent === "string" ? session.payment_intent : null;

      if (invoiceId && userId && paymentIntentId) {
        const { data: existingPayment, error: lookupError } = await supabase
          .from("payments")
          .select("id")
          .eq("stripe_payment_intent_id", paymentIntentId)
          .maybeSingle();

        if (lookupError) {
          throw lookupError;
        }

        if (!existingPayment) {
          const paymentMethodTypes = session.payment_method_types ?? [];
          const paymentMethod = paymentMethodTypes.includes("us_bank_account")
            ? "stripe_ach"
            : "stripe_card";

          const { error: insertError } = await supabase.from("payments").insert({
            user_id: userId,
            invoice_id: invoiceId,
            amount: (session.amount_total ?? 0) / 100,
            payment_method: paymentMethod,
            payment_date: new Date().toISOString().slice(0, 10),
            stripe_payment_intent_id: paymentIntentId,
            account_type: session.metadata?.account_type === "trust" ? "trust" : "operating",
            status: "completed",
            reference_number: paymentIntentId,
            notes: "Recorded automatically from Stripe checkout.",
          });

          if (insertError) {
            throw insertError;
          }
        }
      }
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId =
        typeof charge.payment_intent === "string" ? charge.payment_intent : null;

      if (paymentIntentId) {
        const { error: refundError } = await supabase
          .from("payments")
          .update({ status: "refunded", notes: "Stripe refund received." })
          .eq("stripe_payment_intent_id", paymentIntentId);

        if (refundError) {
          throw refundError;
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
