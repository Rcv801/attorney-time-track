export type InvoiceStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "paid"
  | "partial"
  | "overdue"
  | "void"
  | "written_off";

export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  clientName: string;
  matterName: string;
  issueDate: string;
  dueDate: string;
  totalAmountCents: number;
  paidAmountCents: number;
  balanceDueCents: number;
  status: InvoiceStatus;
}

export interface InvoiceLineItem {
  id: string;
  date: string;
  description: string;
  lineType: string;
  matterName?: string | null;
  quantity?: number | null;
  rateCents?: number | null;
  amountCents: number;
}

export interface InvoicePayment {
  id: string;
  amountCents: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber?: string | null;
  status: string;
  notes?: string | null;
  createdAt: string;
}

export interface InvoiceBuilderClientOption {
  id: string;
  name: string;
}

export interface InvoiceBuilderMatterOption {
  id: string;
  clientId: string;
  name: string;
  trustBalanceCents: number;
}

export interface InvoiceBuilderEntry {
  id: string;
  date: string;
  description: string;
  hours: number;
  rateCents: number;
  amountCents: number;
}

export interface InvoiceBuilderExpense {
  id: string;
  date: string;
  description: string;
  amountCents: number;
  category?: string | null;
}

export interface InvoiceBuilderSelection {
  clientId?: string;
  matterId?: string;
  selectedEntryIds: string[];
  selectedExpenseIds: string[];
}

export interface InvoiceBuilderSummary {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  trustAppliedCents: number;
  balanceDueCents: number;
}

export interface InvoiceBuilderData {
  clients: InvoiceBuilderClientOption[];
  matters: InvoiceBuilderMatterOption[];
  unbilledEntries: InvoiceBuilderEntry[];
  unbilledExpenses: InvoiceBuilderExpense[];
  selection: InvoiceBuilderSelection;
  summary: InvoiceBuilderSummary;
}

export interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  matterId?: string | null;
  matterName: string;
  issueDate: string;
  dueDate: string;
  dateRangeStart?: string | null;
  dateRangeEnd?: string | null;
  status: InvoiceStatus;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  amountPaidCents: number;
  balanceDueCents: number;
  trustAppliedCents: number;
  paymentTerms?: string | null;
  paymentLink?: string | null;
  pdfUrl?: string | null;
  sentAt?: string | null;
  notes?: string;
  lineItems: InvoiceLineItem[];
  payments: InvoicePayment[];
}
