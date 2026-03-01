import { useMemo, useState } from "react";
import type {
  InvoiceBuilderData,
  InvoiceBuilderSelection,
  InvoiceBuilderSummary,
  InvoiceDetail,
  InvoiceListItem,
} from "./types";

const MOCK_INVOICES: InvoiceListItem[] = [
  {
    id: "inv_1001",
    invoiceNumber: "INV-1001",
    clientName: "Bluegrass Holdings",
    matterName: "Lease Dispute",
    issueDate: "2026-02-15",
    dueDate: "2026-03-01",
    totalAmountCents: 125000,
    paidAmountCents: 125000,
    status: "paid",
  },
  {
    id: "inv_1002",
    invoiceNumber: "INV-1002",
    clientName: "Appalachian Medical",
    matterName: "Contract Review",
    issueDate: "2026-02-20",
    dueDate: "2026-03-05",
    totalAmountCents: 64500,
    paidAmountCents: 0,
    status: "sent",
  },
  {
    id: "inv_1003",
    invoiceNumber: "INV-1003",
    clientName: "Mountain Equity Group",
    matterName: "Demand Letter",
    issueDate: "2026-02-10",
    dueDate: "2026-02-24",
    totalAmountCents: 82000,
    paidAmountCents: 0,
    status: "overdue",
  },
];

const EMPTY_BUILDER_SELECTION: InvoiceBuilderSelection = {
  selectedEntryIds: [],
};

export function useInvoicesQuery() {
  // TODO(phase2): Replace mock payload with Supabase query + React Query cache.
  const [hasSeedData] = useState(true);
  const data = hasSeedData ? MOCK_INVOICES : [];

  return {
    data,
    isLoading: false,
    isError: false,
  };
}

export function useInvoiceBuilderMockData() {
  const [selection, setSelection] = useState<InvoiceBuilderSelection>(EMPTY_BUILDER_SELECTION);

  const data = useMemo<InvoiceBuilderData>(() => {
    const clients = [
      { id: "client_1", name: "Bluegrass Holdings" },
      { id: "client_2", name: "Appalachian Medical" },
    ];

    const matters = [
      { id: "matter_1", clientId: "client_1", name: "Lease Dispute" },
      { id: "matter_2", clientId: "client_2", name: "Contract Review" },
    ];

    const unbilledEntries = [
      {
        id: "entry_1",
        date: "2026-02-25",
        description: "Drafted demand response",
        hours: 1.2,
        rateCents: 32500,
        amountCents: 39000,
      },
      {
        id: "entry_2",
        date: "2026-02-26",
        description: "Client strategy call",
        hours: 0.6,
        rateCents: 32500,
        amountCents: 19500,
      },
      {
        id: "entry_3",
        date: "2026-02-27",
        description: "Reviewed opposing counsel filing",
        hours: 0.8,
        rateCents: 32500,
        amountCents: 26000,
      },
    ];

    const selectedEntries = unbilledEntries.filter((entry) =>
      selection.selectedEntryIds.includes(entry.id)
    );

    const subtotalCents = selectedEntries.reduce((sum, entry) => sum + entry.amountCents, 0);
    const taxCents = 0;
    const totalCents = subtotalCents + taxCents;

    return {
      clients,
      matters,
      unbilledEntries,
      selection,
      summary: { subtotalCents, taxCents, totalCents },
    };
  }, [selection]);

  return {
    data,
    setSelection,
  };
}

export function useInvoiceDetailMock(invoiceId: string | undefined) {
  // TODO(phase2): Replace with invoice detail query (invoice + line items + payments).
  const fallback: InvoiceDetail = {
    id: invoiceId ?? "invoice_unknown",
    invoiceNumber: "INV-NEW",
    clientName: "Unknown Client",
    matterName: "Unknown Matter",
    issueDate: new Date().toISOString(),
    dueDate: new Date().toISOString(),
    status: "draft",
    subtotalCents: 0,
    taxCents: 0,
    totalCents: 0,
    amountPaidCents: 0,
  };

  const seeded = MOCK_INVOICES.find((invoice) => invoice.id === invoiceId);

  if (!seeded) {
    return {
      data: fallback,
      isLoading: false,
      isNotFound: true,
    };
  }

  const summary: InvoiceBuilderSummary = {
    subtotalCents: seeded.totalAmountCents,
    taxCents: 0,
    totalCents: seeded.totalAmountCents,
  };

  return {
    data: {
      id: seeded.id,
      invoiceNumber: seeded.invoiceNumber,
      clientName: seeded.clientName,
      matterName: seeded.matterName,
      issueDate: seeded.issueDate,
      dueDate: seeded.dueDate,
      status: seeded.status,
      subtotalCents: summary.subtotalCents,
      taxCents: summary.taxCents,
      totalCents: summary.totalCents,
      amountPaidCents: seeded.paidAmountCents,
      notes: "TODO: Pull invoice notes from invoice metadata table.",
    },
    isLoading: false,
    isNotFound: false,
  };
}
