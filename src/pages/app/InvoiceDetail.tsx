import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import InvoiceStatusBadge from "@/features/invoices/InvoiceStatusBadge";
import { useInvoiceDetailMock } from "@/features/invoices/hooks";
import { formatCurrencyFromCents } from "@/features/invoices/format";
import PaymentDialog from "@/features/invoices/PaymentDialog";

const InvoiceDetail = () => {
  const { invoiceId } = useParams();
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const { data: invoice, isNotFound } = useInvoiceDetailMock(invoiceId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link to="/invoices" className="hover:underline">
              Invoices
            </Link>{" "}
            / {invoice.invoiceNumber}
          </p>
          <h1 className="text-3xl font-bold">Invoice Detail</h1>
          <p className="mt-1 text-muted-foreground">Shell page for line items, history, and payment recording.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled>
            Send Email
          </Button>
          <Button onClick={() => setIsPaymentDialogOpen(true)}>Record Payment</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {invoice.invoiceNumber}
            <InvoiceStatusBadge status={invoice.status} />
          </CardTitle>
          <CardDescription>
            {invoice.clientName} · {invoice.matterName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Issue Date</p>
              <p className="font-medium">{invoice.issueDate}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Due Date</p>
              <p className="font-medium">{invoice.dueDate}</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrencyFromCents(invoice.subtotalCents)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatCurrencyFromCents(invoice.taxCents)}</span>
            </div>
            <div className="flex items-center justify-between font-semibold">
              <span>Total</span>
              <span>{formatCurrencyFromCents(invoice.totalCents)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Paid</span>
              <span>{formatCurrencyFromCents(invoice.amountPaidCents)}</span>
            </div>
          </div>

          <Separator />

          <p className="text-sm text-muted-foreground">
            TODO(phase2): Add line-item table, payment timeline, and Stripe payment-link state.
          </p>
          {isNotFound && (
            <p className="text-sm text-amber-600">Using placeholder content because this invoice was not found.</p>
          )}
        </CardContent>
      </Card>

      <PaymentDialog
        open={isPaymentDialogOpen}
        onOpenChange={setIsPaymentDialogOpen}
        invoiceId={invoice.id}
      />
    </div>
  );
};

export default InvoiceDetail;
