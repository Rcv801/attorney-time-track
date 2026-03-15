import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  InvoiceBuilderData,
  InvoiceBuilderSelection,
  InvoiceDetail,
  InvoiceLineItem,
  InvoiceListItem,
  InvoicePayment,
  InvoiceStatus,
} from "./types";

type InvoiceSummaryRow = {
  id: string;
  invoice_number: string;
  client_name: string | null;
  matter_name: string | null;
  issued_date: string;
  due_date: string;
  total: number | null;
  amount_paid: number | null;
  balance_due: number | null;
  status: string | null;
};

type InvoiceDetailRow = InvoiceSummaryRow & {
  subtotal: number | null;
  tax_amount: number | null;
  trust_applied: number | null;
  notes: string | null;
  payment_terms: string | null;
  payment_link: string | null;
};

type InvoiceLineItemRow = {
  id: string;
  date: string;
  description: string;
  line_type: string;
  matter_name: string | null;
  quantity: number | null;
  rate: number | null;
  amount: number;
};

type PaymentRow = {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_number: string | null;
  status: string;
  notes: string | null;
  created_at: string;
};

type ClientRow = {
  id: string;
  name: string;
};

type MatterRow = {
  id: string;
  client_id: string;
  name: string;
};

type UnbilledEntryRow = {
  id: string | null;
  client_id: string | null;
  matter_id: string | null;
  start_at: string | null;
  notes: string | null;
  billed_hours: number | null;
  effective_rate: number | null;
};

type UserSettingsRow = {
  payment_terms: string | null;
  default_tax_rate: number | null;
  invoice_notes: string | null;
};

const EMPTY_BUILDER_SELECTION: InvoiceBuilderSelection = {
  selectedEntryIds: [],
};

function dollarsToCents(amount: number | null | undefined) {
  return Math.round((amount ?? 0) * 100);
}

function isPastDue(dueDate: string | null | undefined) {
  if (!dueDate) {
    return false;
  }

  const due = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

function normalizeInvoiceStatus(
  status: string | null | undefined,
  dueDate: string | null | undefined,
  balanceDue: number | null | undefined,
): InvoiceStatus {
  switch (status) {
    case "draft":
      return "draft";
    case "sent":
    case "viewed":
    case "partial":
      if ((balanceDue ?? 0) > 0 && isPastDue(dueDate)) {
        return "overdue";
      }
      return status;
    case "paid":
      return "paid";
    case "overdue":
      return "overdue";
    case "void":
      return "void";
    case "written_off":
      return "written_off";
    default:
      return "draft";
  }
}

function mapInvoiceListItem(invoice: InvoiceSummaryRow): InvoiceListItem {
  const balanceDueCents = dollarsToCents(invoice.balance_due);
  const status = normalizeInvoiceStatus(invoice.status, invoice.due_date, invoice.balance_due);

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoice_number,
    clientName: invoice.client_name ?? "Unknown Client",
    matterName: invoice.matter_name ?? "General",
    issueDate: invoice.issued_date,
    dueDate: invoice.due_date,
    totalAmountCents: dollarsToCents(invoice.total),
    paidAmountCents: dollarsToCents(invoice.amount_paid),
    balanceDueCents: status === "void" || status === "written_off" ? 0 : balanceDueCents,
    status,
  };
}

function mapInvoiceLineItem(item: InvoiceLineItemRow): InvoiceLineItem {
  return {
    id: item.id,
    date: item.date,
    description: item.description,
    lineType: item.line_type,
    matterName: item.matter_name,
    quantity: item.quantity,
    rateCents: item.rate === null ? null : dollarsToCents(item.rate),
    amountCents: dollarsToCents(item.amount),
  };
}

function mapInvoicePayment(payment: PaymentRow): InvoicePayment {
  return {
    id: payment.id,
    amountCents: dollarsToCents(payment.amount),
    paymentDate: payment.payment_date,
    paymentMethod: payment.payment_method,
    referenceNumber: payment.reference_number,
    status: payment.status,
    notes: payment.notes,
    createdAt: payment.created_at,
  };
}

export function useInvoicesQuery() {
  return useQuery<InvoiceListItem[]>({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_summary")
        .select("id, invoice_number, client_name, matter_name, issued_date, due_date, total, amount_paid, balance_due, status")
        .order("issued_date", { ascending: false });

      if (error) {
        throw error;
      }

      return ((data ?? []) as unknown as InvoiceSummaryRow[]).map(mapInvoiceListItem);
    },
  });
}

export function useInvoiceBuilderData() {
  const [selection, setSelection] = useState<InvoiceBuilderSelection>(EMPTY_BUILDER_SELECTION);
  const builderQuery = useQuery({
    queryKey: ["invoice-builder-data"],
    queryFn: async () => {
      const [{ data: clients, error: clientsError }, { data: matters, error: mattersError }, { data: entries, error: entriesError }, { data: settings, error: settingsError }] =
        await Promise.all([
          supabase.from("clients").select("id, name").eq("archived", false).order("name"),
          supabase.from("matters").select("id, client_id, name").eq("status", "active").order("name"),
          supabase
            .from("unbilled_entries")
            .select("id, client_id, matter_id, start_at, notes, billed_hours, effective_rate")
            .order("start_at", { ascending: false }),
          supabase.from("user_settings").select("payment_terms, default_tax_rate, invoice_notes").maybeSingle(),
        ]);

      if (clientsError) {
        throw clientsError;
      }

      if (mattersError) {
        throw mattersError;
      }

      if (entriesError) {
        throw entriesError;
      }

      if (settingsError) {
        throw settingsError;
      }

      return {
        clients: (clients ?? []) as unknown as ClientRow[],
        matters: (matters ?? []) as unknown as MatterRow[],
        unbilledEntries: (entries ?? []) as unknown as UnbilledEntryRow[],
        settings: (settings ?? null) as UserSettingsRow | null,
      };
    },
  });

  const data = useMemo<InvoiceBuilderData>(() => {
    const clients = (builderQuery.data?.clients ?? []).map((client) => ({
      id: client.id,
      name: client.name,
    }));

    const matters = (builderQuery.data?.matters ?? []).map((matter) => ({
      id: matter.id,
      clientId: matter.client_id,
      name: matter.name,
    }));

    const unbilledEntries = (builderQuery.data?.unbilledEntries ?? [])
      .filter((entry) => {
        if (!entry.id || !entry.client_id) {
          return false;
        }

        if (selection.clientId && entry.client_id !== selection.clientId) {
          return false;
        }

        if (selection.matterId && entry.matter_id !== selection.matterId) {
          return false;
        }

        return true;
      })
      .map((entry) => {
        const hours = entry.billed_hours ?? 0;
        const rate = entry.effective_rate ?? 0;

        return {
          id: entry.id as string,
          date: entry.start_at?.slice(0, 10) ?? "",
          description: entry.notes?.trim() || "Time entry",
          hours,
          rateCents: dollarsToCents(rate),
          amountCents: dollarsToCents(hours * rate),
        };
      });

    const selectedEntries = unbilledEntries.filter((entry) => selection.selectedEntryIds.includes(entry.id));

    const subtotalCents = selectedEntries.reduce((sum, entry) => sum + entry.amountCents, 0);
    const taxRate = builderQuery.data?.settings?.default_tax_rate ?? 0;
    const taxCents = Math.round(subtotalCents * taxRate);
    const totalCents = subtotalCents + taxCents;

    return {
      clients,
      matters,
      unbilledEntries,
      selection,
      summary: { subtotalCents, taxCents, totalCents },
    };
  }, [builderQuery.data, selection]);

  return {
    data,
    defaults: {
      paymentTerms: builderQuery.data?.settings?.payment_terms ?? "Net 30",
      taxRate: builderQuery.data?.settings?.default_tax_rate ?? 0,
      invoiceNotes: builderQuery.data?.settings?.invoice_notes ?? "",
    },
    isLoading: builderQuery.isLoading,
    isError: builderQuery.isError,
    error: builderQuery.error,
    setSelection,
  };
}

export function useInvoiceDetailQuery(invoiceId: string | undefined) {
  return useQuery<InvoiceDetail | null>({
    queryKey: ["invoice-detail", invoiceId],
    enabled: Boolean(invoiceId),
    queryFn: async () => {
      if (!invoiceId) {
        return null;
      }

      const [{ data: invoice, error: invoiceError }, { data: lineItems, error: lineItemsError }, { data: payments, error: paymentsError }] =
        await Promise.all([
          supabase
            .from("invoice_summary")
            .select("id, invoice_number, client_name, matter_name, issued_date, due_date, status, subtotal, tax_amount, total, amount_paid, balance_due, trust_applied, notes, payment_terms, payment_link")
            .eq("id", invoiceId)
            .maybeSingle(),
          supabase
            .from("invoice_line_items")
            .select("id, date, description, line_type, matter_name, quantity, rate, amount")
            .eq("invoice_id", invoiceId)
            .order("sort_order", { ascending: true })
            .order("date", { ascending: true }),
          supabase
            .from("payments")
            .select("*")
            .eq("invoice_id", invoiceId)
            .order("payment_date", { ascending: false })
            .order("created_at", { ascending: false }),
        ]);

      if (invoiceError) {
        throw invoiceError;
      }

      if (lineItemsError) {
        throw lineItemsError;
      }

      if (paymentsError) {
        throw paymentsError;
      }

      if (!invoice) {
        return null;
      }

      const invoiceRow = invoice as unknown as InvoiceDetailRow;
      const lineItemRows = (lineItems ?? []) as unknown as InvoiceLineItemRow[];
      const paymentRows = (payments ?? []) as PaymentRow[];

      return {
        id: invoiceRow.id,
        invoiceNumber: invoiceRow.invoice_number,
        clientName: invoiceRow.client_name ?? "Unknown Client",
        matterName: invoiceRow.matter_name ?? "General",
        issueDate: invoiceRow.issued_date,
        dueDate: invoiceRow.due_date,
        status: normalizeInvoiceStatus(invoiceRow.status, invoiceRow.due_date, invoiceRow.balance_due),
        subtotalCents: dollarsToCents(invoiceRow.subtotal),
        taxCents: dollarsToCents(invoiceRow.tax_amount),
        totalCents: dollarsToCents(invoiceRow.total),
        amountPaidCents: dollarsToCents(invoiceRow.amount_paid),
        balanceDueCents:
          invoiceRow.status === "void" || invoiceRow.status === "written_off"
            ? 0
            : dollarsToCents(invoiceRow.balance_due),
        trustAppliedCents: dollarsToCents(invoiceRow.trust_applied),
        paymentTerms: invoiceRow.payment_terms,
        paymentLink: invoiceRow.payment_link,
        notes: invoiceRow.notes ?? undefined,
        lineItems: lineItemRows.map(mapInvoiceLineItem),
        payments: paymentRows.map(mapInvoicePayment),
      };
    },
  });
}
