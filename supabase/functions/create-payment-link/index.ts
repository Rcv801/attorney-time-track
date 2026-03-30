import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.25.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      return new Response(JSON.stringify({ error: "Stripe server secret is missing in Supabase project secrets (STRIPE_SECRET_KEY)." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(JSON.stringify({ error: "Supabase env is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const invoiceId = typeof body?.invoiceId === "string" ? body.invoiceId : null;
    if (!invoiceId) {
      return new Response(JSON.stringify({ error: "invoiceId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: invoice, error: invoiceError }, { data: settings, error: settingsError }] =
      await Promise.all([
        supabase
          .from("invoice_summary")
          .select("id, invoice_number, client_id, client_name, due_date, balance_due, status, payment_link")
          .eq("id", invoiceId)
          .maybeSingle(),
        supabase
          .from("user_settings")
          .select("stripe_connected")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

    if (invoiceError) {
      throw invoiceError;
    }

    if (settingsError) {
      throw settingsError;
    }

    if (!invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!settings?.stripe_connected) {
      return new Response(JSON.stringify({ error: "Stripe payment links are disabled in Settings for this workspace." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (["paid", "void", "written_off"].includes(invoice.status ?? "")) {
      return new Response(JSON.stringify({ error: "This invoice is not collectible" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const balanceDue = Number(invoice.balance_due ?? 0);
    if (!(balanceDue > 0)) {
      return new Response(JSON.stringify({ error: "This invoice does not have an outstanding balance" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-06-20",
    });

    const origin = req.headers.get("origin") ?? Deno.env.get("APP_URL") ?? "http://localhost:5173";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card", "us_bank_account"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Invoice ${invoice.invoice_number}`,
              description: invoice.client_name
                ? `Legal services for ${invoice.client_name}`
                : `Legal services invoice ${invoice.invoice_number}`,
            },
            unit_amount: Math.round(balanceDue * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        invoice_id: invoice.id,
        user_id: user.id,
        account_type: "operating",
      },
      success_url: `${origin}/invoices/${invoice.id}?payment=success`,
      cancel_url: `${origin}/invoices/${invoice.id}?payment=cancelled`,
    });

    const { error: updateError } = await supabase
      .from("invoices")
      .update({ payment_link: session.url })
      .eq("id", invoice.id);

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({ url: session.url }), {
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
