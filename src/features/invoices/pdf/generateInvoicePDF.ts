import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrencyFromCents } from "../format";

type AutoTableDoc = jsPDF & {
  lastAutoTable?: {
    finalY: number;
  };
};

interface FirmSettings {
  firm_name: string | null;
  attorney_name: string | null;
  bar_number: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  logo_url: string | null;
}

interface Client {
  name: string;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  email?: string | null;
}

interface LineItem {
  date: string;
  description: string;
  lineType: string;
  quantity: number | null;
  rateCents: number | null;
  amountCents: number;
}

interface InvoiceData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  paymentTerms: string | null;
  notes: string | null;
  subtotalCents: number;
  taxCents: number;
  trustAppliedCents: number;
  amountPaidCents: number;
  balanceDueCents: number;
}

function formatDate(dateString: string): string {
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

function buildFirmAddress(settings: FirmSettings): string {
  const parts = [
    settings.address_line1,
    settings.address_line2,
    [settings.city, settings.state, settings.zip].filter(Boolean).join(", "),
  ].filter(Boolean);
  return parts.join("\n");
}

export async function generateInvoicePDF(
  invoice: InvoiceData,
  client: Client,
  matterName: string | null,
  lineItems: LineItem[],
  firmSettings: FirmSettings,
): Promise<Blob> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(firmSettings.firm_name || "Law Firm", margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const firmAddress = buildFirmAddress(firmSettings);
  if (firmAddress) {
    doc.text(firmAddress, margin, yPos);
    yPos += 5;
  }
  if (firmSettings.phone) {
    doc.text(firmSettings.phone, margin, yPos);
    yPos += 5;
  }
  if (firmSettings.bar_number) {
    doc.text(`Bar # ${firmSettings.bar_number}`, margin, yPos);
    yPos += 5;
  }

  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", pageWidth - margin, 30, { align: "right" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`# ${invoice.invoiceNumber}`, pageWidth - margin, 40, { align: "right" });
  doc.text(`Issue Date: ${formatDate(invoice.issueDate)}`, pageWidth - margin, 46, { align: "right" });
  doc.text(`Due Date: ${formatDate(invoice.dueDate)}`, pageWidth - margin, 52, { align: "right" });
  if (invoice.paymentTerms) {
    doc.text(`Terms: ${invoice.paymentTerms}`, pageWidth - margin, 58, { align: "right" });
  }

  yPos = 75;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Bill To:", margin, yPos);
  yPos += 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(client.name, margin, yPos);
  yPos += 5;

  if (client.address_line1) {
    doc.text(client.address_line1, margin, yPos);
    yPos += 5;
  }
  if (client.address_line2) {
    doc.text(client.address_line2, margin, yPos);
    yPos += 5;
  }
  if (client.city || client.state || client.zip) {
    const cityStateZip = [client.city, client.state, client.zip].filter(Boolean).join(", ");
    if (cityStateZip) {
      doc.text(cityStateZip, margin, yPos);
      yPos += 5;
    }
  }
  if (client.email) {
    doc.text(client.email, margin, yPos);
    yPos += 5;
  }

  if (matterName) {
    yPos += 3;
    doc.setFont("helvetica", "bold");
    doc.text("Matter:", margin, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(matterName, margin + 18, yPos);
  }

  yPos += 15;

  const tableData = lineItems.map((item) => [
    formatDate(item.date),
    item.description,
    item.lineType.replace("_", " "),
    item.quantity != null ? item.quantity.toFixed(2) : "—",
    item.rateCents != null ? formatCurrencyFromCents(item.rateCents) : "—",
    formatCurrencyFromCents(item.amountCents),
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [["Date", "Description", "Type", "Qty", "Rate", "Amount"]],
    body: tableData,
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [45, 55, 72],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 25 },
      3: { cellWidth: 20, halign: "right" },
      4: { cellWidth: 25, halign: "right" },
      5: { cellWidth: 30, halign: "right" },
    },
  });

  const autoTableDoc = doc as AutoTableDoc;
  yPos = (autoTableDoc.lastAutoTable?.finalY ?? yPos) + 15;

  const summaryX = pageWidth - margin - 60;

  doc.setFontSize(10);
  doc.text("Subtotal:", summaryX, yPos);
  doc.text(formatCurrencyFromCents(invoice.subtotalCents), pageWidth - margin, yPos, { align: "right" });
  yPos += 6;

  if (invoice.taxCents > 0) {
    doc.text("Tax:", summaryX, yPos);
    doc.text(formatCurrencyFromCents(invoice.taxCents), pageWidth - margin, yPos, { align: "right" });
    yPos += 6;
  }

  if (invoice.trustAppliedCents > 0) {
    doc.text("Trust Applied:", summaryX, yPos);
    doc.text(`-${formatCurrencyFromCents(invoice.trustAppliedCents)}`, pageWidth - margin, yPos, { align: "right" });
    yPos += 6;
  }

  if (invoice.amountPaidCents > 0) {
    doc.text("Payments:", summaryX, yPos);
    doc.text(`-${formatCurrencyFromCents(invoice.amountPaidCents)}`, pageWidth - margin, yPos, { align: "right" });
    yPos += 6;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Balance Due:", summaryX, yPos);
  doc.text(formatCurrencyFromCents(invoice.balanceDueCents), pageWidth - margin, yPos, { align: "right" });

  if (invoice.notes) {
    yPos += 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Notes:", margin, yPos);
    yPos += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    const splitNotes = doc.splitTextToSize(invoice.notes, pageWidth - margin * 2);
    doc.text(splitNotes, margin, yPos);
  }

  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  const footerY = doc.internal.pageSize.getHeight() - 10;
  doc.text("Thank you for your business.", pageWidth / 2, footerY, { align: "center" });

  return doc.output("blob");
}

export function downloadPDF(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
