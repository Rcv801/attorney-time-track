import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type InvoiceRow = {
  id: string;
  client_id: string;
  matter_id: string | null;
  invoice_number: string;
  issued_date: string;
  due_date: string;
  status: string;
  subtotal: number | string | null;
  tax_amount: number | string | null;
  total: number | string | null;
  amount_paid: number | string | null;
  balance_due: number | string | null;
  trust_applied: number | string | null;
  notes: string | null;
  payment_terms: string | null;
  payment_link: string | null;
  pdf_url: string | null;
};

type LineItemRow = {
  date: string;
  description: string;
  line_type: string;
  quantity: number | string | null;
  rate: number | string | null;
  amount: number | string | null;
  matter_name: string | null;
};

type ClientRow = {
  name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  email: string | null;
};

type UserSettingsRow = {
  firm_name: string | null;
  attorney_name: string | null;
  bar_number: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  email_from_name: string | null;
  email_from_address: string | null;
  reply_to_email: string | null;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatMoney(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildAddress(parts: Array<string | null | undefined>) {
  return parts.filter((part): part is string => Boolean(part && part.trim()))
    .join("\n");
}

function sanitizeFilenamePart(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/-+/g, "-").replace(
    /^-|-$/g,
    "",
  ).toLowerCase();
}

function escapeHeaderValue(value: string) {
  return value.replace(/[\r\n<>"]/g, " ").replace(/\s+/g, " ").trim();
}

function getEmailDomain(value: string) {
  const parts = value.trim().toLowerCase().split("@");
  return parts.length === 2 ? parts[1] : null;
}

function formatFromAddress(args: {
  fallbackEmail: string;
  firmName: string | null;
  attorneyName: string | null;
  emailFromName: string | null;
  emailFromAddress: string | null;
}) {
  const fallbackEmail = args.fallbackEmail.trim();
  const fallbackDomain = getEmailDomain(fallbackEmail);
  const requestedFromAddress = args.emailFromAddress?.trim() || null;

  if (requestedFromAddress) {
    const requestedDomain = getEmailDomain(requestedFromAddress);
    if (!requestedDomain || !fallbackDomain || requestedDomain !== fallbackDomain) {
      throw new Error(
        `From email must use the ${fallbackDomain ?? "configured"} sending domain.`,
      );
    }
  }

  const address = requestedFromAddress ?? fallbackEmail;
  const displayName = escapeHeaderValue(
    args.emailFromName?.trim() ||
      args.firmName?.trim() ||
      args.attorneyName?.trim() ||
      "Invoice Billing",
  );

  return `${displayName} <${address}>`;
}

function getDeliveredInvoiceStatus(currentStatus: string) {
  return currentStatus === "draft" ? "sent" : currentStatus;
}

function wrapText(text: string, maxChars = 95) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars) {
      if (current) {
        lines.push(current);
      }
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

async function buildInvoicePdf(args: {
  invoice: InvoiceRow;
  client: ClientRow;
  settings: UserSettingsRow | null;
  lineItems: LineItemRow[];
  matterName: string | null;
}) {
  const { invoice, client, settings, lineItems, matterName } = args;
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = 750;
  const left = 48;
  const right = 564;
  const lineHeight = 14;

  const drawText = (
    text: string,
    x: number,
    yPos: number,
    size = 11,
    bold = false,
  ) => {
    page.drawText(text, {
      x,
      y: yPos,
      size,
      font: bold ? boldFont : font,
      color: rgb(0.1, 0.1, 0.12),
    });
  };

  const drawRightText = (
    text: string,
    yPos: number,
    size = 11,
    bold = false,
  ) => {
    const activeFont = bold ? boldFont : font;
    const width = activeFont.widthOfTextAtSize(text, size);
    drawText(text, right - width, yPos, size, bold);
  };

  const firmName = settings?.firm_name?.trim() ||
    settings?.attorney_name?.trim() || "Law Firm";
  drawText(firmName, left, y, 20, true);
  drawRightText("INVOICE", y, 24, true);
  y -= 26;

  const firmBlock = buildAddress([
    settings?.attorney_name,
    settings?.address_line1,
    settings?.address_line2,
    [settings?.city, settings?.state, settings?.zip].filter(Boolean).join(", "),
    settings?.phone,
    settings?.bar_number ? `Bar # ${settings.bar_number}` : null,
  ]);

  for (const line of firmBlock.split("\n").filter(Boolean)) {
    drawText(line, left, y);
    y -= lineHeight;
  }

  let headerY = 724;
  for (
    const line of [
      `Invoice # ${invoice.invoice_number}`,
      `Issue Date: ${formatDate(invoice.issued_date)}`,
      `Due Date: ${formatDate(invoice.due_date)}`,
      invoice.payment_terms ? `Terms: ${invoice.payment_terms}` : null,
    ].filter(Boolean) as string[]
  ) {
    drawRightText(line, headerY);
    headerY -= lineHeight;
  }

  y = Math.min(y, headerY) - 18;
  drawText("Bill To", left, y, 12, true);
  y -= 18;

  for (
    const line of buildAddress([
      client.name,
      client.address_line1,
      client.address_line2,
      [client.city, client.state, client.zip].filter(Boolean).join(", "),
      client.email,
    ]).split("\n")
  ) {
    drawText(line, left, y);
    y -= lineHeight;
  }

  if (matterName) {
    y -= 6;
    drawText(`Matter: ${matterName}`, left, y, 11, true);
    y -= lineHeight;
  }

  y -= 10;
  page.drawLine({
    start: { x: left, y },
    end: { x: right, y },
    thickness: 1,
    color: rgb(0.82, 0.84, 0.88),
  });
  y -= 18;

  drawText("Date", left, y, 10, true);
  drawText("Description", left + 70, y, 10, true);
  drawRightText("Amount", y, 10, true);
  y -= 14;

  for (const item of lineItems) {
    if (y < 140) {
      break;
    }

    drawText(formatDate(item.date), left, y, 10);
    const quantity = item.quantity == null
      ? ""
      : ` · Qty ${Number(item.quantity).toFixed(2)}`;
    const rate = item.rate == null ? "" : ` @ ${formatMoney(item.rate)}`;
    const detailLines = wrapText(`${item.description}${quantity}${rate}`, 62);
    drawText(detailLines[0] ?? item.description, left + 70, y, 10);
    drawRightText(formatMoney(item.amount), y, 10);
    y -= 14;

    for (const detailLine of detailLines.slice(1)) {
      drawText(detailLine, left + 70, y, 10);
      y -= 12;
    }
  }

  y -= 6;
  page.drawLine({
    start: { x: left + 300, y },
    end: { x: right, y },
    thickness: 1,
    color: rgb(0.82, 0.84, 0.88),
  });
  y -= 18;

  const summaryRows = [
    ["Subtotal", formatMoney(invoice.subtotal)],
    Number(invoice.tax_amount ?? 0) > 0
      ? ["Tax", formatMoney(invoice.tax_amount)]
      : null,
    Number(invoice.trust_applied ?? 0) > 0
      ? ["Trust Applied", `-${formatMoney(invoice.trust_applied)}`]
      : null,
    Number(invoice.amount_paid ?? 0) > 0
      ? ["Payments", `-${formatMoney(invoice.amount_paid)}`]
      : null,
    ["Balance Due", formatMoney(invoice.balance_due)],
  ].filter(Boolean) as Array<[string, string]>;

  for (const [label, value] of summaryRows) {
    drawText(
      label,
      left + 330,
      y,
      label === "Balance Due" ? 11 : 10,
      label === "Balance Due",
    );
    drawRightText(
      value,
      y,
      label === "Balance Due" ? 11 : 10,
      label === "Balance Due",
    );
    y -= label === "Balance Due" ? 18 : 14;
  }

  if (invoice.notes) {
    y -= 8;
    drawText("Notes", left, y, 11, true);
    y -= 14;
    for (const line of invoice.notes.split("\n")) {
      for (const wrapped of wrapText(line || " ", 95)) {
        if (y < 60) {
          break;
        }
        drawText(wrapped, left, y, 9);
        y -= 12;
      }
    }
  }

  drawText("Thank you for your business.", left, 36, 9);
  return await pdf.save();
}

async function recordAudit(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
) {
  const { error } = await supabase.from("invoice_delivery_audit").insert(
    payload,
  );
  if (error) {
    console.error("Failed to record invoice delivery audit", error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing auth header" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const invoiceFromEmail = Deno.env.get("INVOICE_FROM_EMAIL");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse({ error: "Supabase env is not configured" }, 500);
  }

  if (!resendApiKey || !invoiceFromEmail) {
    return jsonResponse(
      { error: "Invoice email delivery is not configured" },
      500,
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const invoiceId = typeof body?.invoiceId === "string"
      ? body.invoiceId
      : null;
    const recipientEmail = typeof body?.to === "string" ? body.to.trim() : "";
    const subject = typeof body?.subject === "string"
      ? body.subject.trim()
      : "";
    const messageBody = typeof body?.body === "string" ? body.body.trim() : "";

    if (!invoiceId || !recipientEmail || !subject || !messageBody) {
      return jsonResponse({
        error: "invoiceId, to, subject, and body are required",
      }, 400);
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(
        "id, client_id, matter_id, invoice_number, issued_date, due_date, status, subtotal, tax_amount, total, amount_paid, balance_due, trust_applied, notes, payment_terms, payment_link, pdf_url",
      )
      .eq("id", invoiceId)
      .maybeSingle();

    if (invoiceError) {
      throw invoiceError;
    }

    if (!invoice) {
      return jsonResponse({ error: "Invoice not found" }, 404);
    }

    if (["paid", "void", "written_off"].includes(invoice.status)) {
      return jsonResponse({ error: "This invoice cannot be delivered" }, 400);
    }

    const [
      { data: client, error: clientError },
      { data: settings, error: settingsError },
      { data: matter, error: matterError },
      { data: lineItems, error: lineItemsError },
    ] = await Promise.all([
      supabase
        .from("clients")
        .select("name, address_line1, address_line2, city, state, zip, email")
        .eq("id", invoice.client_id)
        .maybeSingle(),
      supabase
        .from("user_settings")
        .select(
          "firm_name, attorney_name, bar_number, phone, address_line1, address_line2, city, state, zip, email_from_name, email_from_address, reply_to_email",
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      invoice.matter_id
        ? supabase.from("matters").select("name").eq("id", invoice.matter_id)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("invoice_line_items")
        .select(
          "date, description, line_type, quantity, rate, amount, matter_name",
        )
        .eq("invoice_id", invoice.id)
        .order("sort_order", { ascending: true }),
    ]);

    if (clientError) throw clientError;
    if (settingsError) throw settingsError;
    if (matterError) throw matterError;
    if (lineItemsError) throw lineItemsError;

    if (!client) {
      return jsonResponse({
        error: "Client details are missing for this invoice",
      }, 400);
    }

    const pdfBytes = await buildInvoicePdf({
      invoice: invoice as InvoiceRow,
      client: client as ClientRow,
      settings: (settings as UserSettingsRow | null) ?? null,
      lineItems: (lineItems as LineItemRow[]) ?? [],
      matterName: matter?.name ?? lineItems?.[0]?.matter_name ?? null,
    });

    const pdfPath = `${user.id}/${invoice.id}/invoice-${
      sanitizeFilenamePart(invoice.invoice_number)
    }-${Date.now()}.pdf`;
    const uploadResult = await serviceSupabase.storage
      .from("invoice-pdfs")
      .upload(pdfPath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadResult.error) {
      throw uploadResult.error;
    }

    const { error: pdfUpdateError } = await supabase
      .from("invoices")
      .update({ pdf_url: pdfPath })
      .eq("id", invoice.id);

    if (pdfUpdateError) {
      throw pdfUpdateError;
    }

    const html = [
      `<p>${escapeHtml(messageBody).replaceAll("\n", "<br />")}</p>`,
      invoice.payment_link
        ? `<p><a href="${
          escapeHtml(invoice.payment_link)
        }" style="display:inline-block;padding:12px 20px;background:#111827;color:#ffffff;text-decoration:none;border-radius:6px;">Pay Invoice Online</a></p>`
        : "",
      `<p style="color:#6b7280;font-size:12px;">Invoice ${
        escapeHtml(invoice.invoice_number)
      } · Due ${escapeHtml(formatDate(invoice.due_date))} · Balance ${
        escapeHtml(formatMoney(invoice.balance_due))
      }</p>`,
    ]
      .filter(Boolean)
      .join("");

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: formatFromAddress({
          fallbackEmail: invoiceFromEmail,
          firmName: settings?.firm_name ?? null,
          attorneyName: settings?.attorney_name ?? null,
          emailFromName: settings?.email_from_name ?? null,
          emailFromAddress: settings?.email_from_address ?? null,
        }),
        to: [recipientEmail],
        subject,
        html,
        text: messageBody,
        reply_to: settings?.reply_to_email ?? undefined,
        attachments: [
          {
            filename: `invoice-${invoice.invoice_number}.pdf`,
            content: encodeBase64(pdfBytes),
          },
        ],
      }),
    });

    const resendPayload = await resendResponse.json();
    if (!resendResponse.ok) {
      const errorMessage = typeof resendPayload?.message === "string"
        ? resendPayload.message
        : "Resend did not accept the invoice email";

      await recordAudit(supabase, {
        invoice_id: invoice.id,
        user_id: user.id,
        recipient_email: recipientEmail,
        subject,
        body: messageBody,
        provider: "resend",
        status: "failed",
        error_message: errorMessage,
        pdf_path: pdfPath,
        metadata: { resend: resendPayload },
      });

      return jsonResponse({ error: errorMessage }, 502);
    }

    const sentAt = new Date().toISOString();
    const nextInvoiceStatus = getDeliveredInvoiceStatus(invoice.status);
    const { error: invoiceUpdateError } = await supabase
      .from("invoices")
      .update({
        status: nextInvoiceStatus,
        sent_at: sentAt,
        pdf_url: pdfPath,
      })
      .eq("id", invoice.id);

    if (invoiceUpdateError) {
      throw invoiceUpdateError;
    }

    await recordAudit(supabase, {
      invoice_id: invoice.id,
      user_id: user.id,
      recipient_email: recipientEmail,
      subject,
      body: messageBody,
      provider: "resend",
      provider_message_id: typeof resendPayload?.id === "string"
        ? resendPayload.id
        : null,
      status: "sent",
      pdf_path: pdfPath,
      metadata: { resend: resendPayload },
    });

    return jsonResponse({
      pdfPath,
      sentAt,
      providerMessageId: typeof resendPayload?.id === "string"
        ? resendPayload.id
        : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
