export type Ledes1998BLineType = "time" | "expense" | "adjustment";

export interface Ledes1998BLineItem {
  type: Ledes1998BLineType;
  date: string;
  description: string;
  units: number;
  adjustmentAmount: number;
  total: number;
  taskCode?: string;
  expenseCode?: string;
  activityCode?: string;
}

export interface Ledes1998BInvoice {
  invoiceDate: string;
  invoiceNumber: string;
  clientId: string;
  lawFirmMatterId: string;
  invoiceTotal: number;
  billingStartDate: string;
  billingEndDate: string;
  invoiceDescription: string;
  lawFirmId: string;
  clientMatterId?: string;
  timekeeperId: string;
  timekeeperName: string;
  timekeeperClassification: string;
  lineItems: Ledes1998BLineItem[];
}

const LEDES_1998B_HEADER = "LEDES1998B[]";

const LEDES_1998B_COLUMNS = [
  "INVOICE_DATE",
  "INVOICE_NUMBER",
  "CLIENT_ID",
  "LAW_FIRM_MATTER_ID",
  "INVOICE_TOTAL",
  "BILLING_START_DATE",
  "BILLING_END_DATE",
  "INVOICE_DESCRIPTION",
  "LINE_ITEM_NUMBER",
  "EXP/FEE/INV_ADJ_TYPE",
  "LINE_ITEM_NUMBER_OF_UNITS",
  "LINE_ITEM_ADJUSTMENT_AMOUNT",
  "LINE_ITEM_TOTAL",
  "LINE_ITEM_DATE",
  "LINE_ITEM_TASK_CODE",
  "LINE_ITEM_EXPENSE_CODE",
  "LINE_ITEM_ACTIVITY_CODE",
  "TIMEKEEPER_ID",
  "LINE_ITEM_DESCRIPTION",
  "LAW_FIRM_ID",
  "LINE_ITEM_UNIT_COST",
  "TIMEKEEPER_NAME",
  "TIMEKEEPER_CLASSIFICATION",
  "CLIENT_MATTER_ID",
] as const;

function formatLedesDate(value: string) {
  return value.replace(/-/g, "").slice(0, 8);
}

function sanitizeField(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/\|/g, " ")
    .replace(/\[/g, "(")
    .replace(/\]/g, ")")
    .replace(/\r?\n|\r/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatAmount(value: number) {
  return value.toFixed(2);
}

function formatLineType(type: Ledes1998BLineType) {
  switch (type) {
    case "expense":
      return "E";
    case "adjustment":
      return "IF";
    default:
      return "F";
  }
}

export function buildLedes1998B(invoice: Ledes1998BInvoice) {
  const lines = [LEDES_1998B_HEADER, `${LEDES_1998B_COLUMNS.join("|")}[]`];

  invoice.lineItems.forEach((lineItem, index) => {
    const row = [
      formatLedesDate(invoice.invoiceDate),
      sanitizeField(invoice.invoiceNumber),
      sanitizeField(invoice.clientId),
      sanitizeField(invoice.lawFirmMatterId),
      formatAmount(invoice.invoiceTotal),
      formatLedesDate(invoice.billingStartDate),
      formatLedesDate(invoice.billingEndDate),
      sanitizeField(invoice.invoiceDescription),
      String(index + 1),
      formatLineType(lineItem.type),
      formatAmount(lineItem.units),
      formatAmount(lineItem.adjustmentAmount),
      formatAmount(lineItem.total),
      formatLedesDate(lineItem.date),
      sanitizeField(lineItem.taskCode),
      sanitizeField(lineItem.expenseCode),
      sanitizeField(lineItem.activityCode),
      sanitizeField(invoice.timekeeperId),
      sanitizeField(lineItem.description),
      sanitizeField(invoice.lawFirmId),
      lineItem.units > 0 ? formatAmount(lineItem.total / lineItem.units) : "",
      sanitizeField(invoice.timekeeperName),
      sanitizeField(invoice.timekeeperClassification),
      sanitizeField(invoice.clientMatterId),
    ];

    lines.push(`${row.join("|")}[]`);
  });

  return lines.join("\n");
}

export function downloadLedesFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
