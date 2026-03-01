export type InvoiceStatus = "draft" | "sent" | "paid" | "partially_paid" | "overdue";

export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  clientName: string;
  matterName: string;
  issueDate: string;
  dueDate: string;
  totalAmountCents: number;
  paidAmountCents: number;
  status: InvoiceStatus;
}

export interface InvoiceBuilderClientOption {
  id: string;
  name: string;
}

export interface InvoiceBuilderMatterOption {
  id: string;
  clientId: string;
  name: string;
}

export interface InvoiceBuilderEntry {
  id: string;
  date: string;
  description: string;
  hours: number;
  rateCents: number;
  amountCents: number;
}

export interface InvoiceBuilderSelection {
  clientId?: string;
  matterId?: string;
  selectedEntryIds: string[];
}

export interface InvoiceBuilderSummary {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
}

export interface InvoiceBuilderData {
  clients: InvoiceBuilderClientOption[];
  matters: InvoiceBuilderMatterOption[];
  unbilledEntries: InvoiceBuilderEntry[];
  selection: InvoiceBuilderSelection;
  summary: InvoiceBuilderSummary;
}

export interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  clientName: string;
  matterName: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  amountPaidCents: number;
  notes?: string;
}
