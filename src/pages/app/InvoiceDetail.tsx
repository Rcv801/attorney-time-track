import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDown, Loader2 } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSkeleton from "@/components/shared/LoadingSkeleton";
import InvoiceStatusBadge from "@/features/invoices/InvoiceStatusBadge";
import { useInvoiceDetailQuery } from "@/features/invoices/hooks";
import { formatCurrencyFromCents } from "@/features/invoices/format";
import { downloadInvoicePDF } from "@/features/invoices/pdf";
import PaymentDialog from "@/features/invoices/PaymentDialog";
import { generateInvoicePDF, downloadPDF } from "@/features/invoices/pdf/generateInvoicePDF";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { InvoiceStatus } from "@/features/invoices/types";

interface UserSettings {
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
  id: string;
  name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  email: string | null;
}

const paymentMethodLabels: Record<string, string> = {
  stripe_card: "Stripe card",
  stripe_ach: "Stripe ACH",
  check: "Check",
  cash: "Cash",
  wire: "Wire",
  trust_application: "Trust application",
  other: "Other",
};

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

function formatQuantity(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "—";
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

const InvoiceDetail = () => {
  const { invoiceId } = useParams();
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"void" | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: invoice, isLoading, isError, error } = useInvoiceDetailQuery(invoiceId);

  // Fetch user settings for PDF
  const { data: userSettings } = useQuery<UserSettings>({
    queryKey: ["user-settings"],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("user_settings")
        .select("firm_name, attorney_name, bar_number, phone, address_line1, address_line2, city, state, zip, logo_url")
        .eq("user_id", user.id)
        .maybeSingle();
      return data as UserSettings;
    },
    enabled: !!user,
  });

  // Fetch client info for PDF
  const { data: clientInfo } = useQuery<Client>({
    queryKey: ["client-info", invoice?.clientName],
    queryFn: async () => {
      if (!invoice) return null;
      const { data } = await supabase
        .from("clients")
        .select("id, name, address_line1, address_line2, city, state, zip, email")
        .ilike("name", invoice.clientName)
        .eq("user_id", user?.id)
        .maybeSingle();
      return data as Client;
    },
    enabled: !!user && !!invoice,
  });

  const handleDownloadPDF = async () => {
    if (!invoice || !userSettings || !clientInfo) {
      toast({
        title: "Cannot generate PDF",
        description: "Missing firm or client information.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingPDF(true);
    try {
      const lineItems = invoice.lineItems.map((item) => ({
        date: item.date,
        description: item.description,
        lineType: item.lineType,
        quantity: item.quantity ?? null,
        rateCents: item.rateCents ?? null,
        amountCents: item.amountCents,
      }));

      const blob = await generateInvoicePDF(
        {
          invoiceNumber: invoice.invoiceNumber,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          paymentTerms: invoice.paymentTerms,
          notes: invoice.notes,
          subtotalCents: invoice.subtotalCents,
          taxCents: invoice.taxCents,
          trustAppliedCents: invoice.trustAppliedCents,
          amountPaidCents: invoice.amountPaidCents,
          balanceDueCents: invoice.balanceDueCents,
        },
        {
          name: clientInfo.name,
          address_line1: clientInfo.address_line1,
          address_line2: clientInfo.address_line2,
          city: clientInfo.city,
          state: clientInfo.state,
          zip: clientInfo.zip,
          email: clientInfo.email,
        },
        invoice.matterName,
        lineItems,
        userSettings
      );

      downloadPDF(blob, `invoice-${invoice.invoiceNumber}.pdf`);
      
      toast({
        title: "PDF downloaded",
        description: `Invoice ${invoice.invoiceNumber} has been downloaded.`,
      });
    } catch (err) {
      toast({
        title: "PDF generation failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (isError) {
    return (
      <EmptyState
        title="Could not load invoice"
        description={error instanceof Error ? error.message : "Refresh and try again."}
      />
    );
  }

  if (!invoice) {
    return (
      <EmptyState
        title="Invoice not found"
        description="This invoice may have been deleted or you may not have access to it."
      />
    );
  }

  const isPaymentLocked = invoice.status === "void" || invoice.status === "written_off";
  const canSendInvoice = invoice.status !== "paid" && invoice.status !== "void" && invoice.status !== "written_off";
  const canVoidInvoice = invoice.status !== "void" && invoice.status !== "written_off" && invoice.status !== "paid";
  const sendLabel = invoice.status === "draft" ? "Send Invoice" : "Resend Invoice";

  const statusMutation = useMutation({
    mutationFn: async (nextStatus: InvoiceStatus) => {
      const updates: Record<string, string | null> = {
        status: nextStatus,
      };

      if (nextStatus === "sent") {
        updates.sent_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from("invoices")
        .update(updates)
        .eq("id", invoice.id);

      if (updateError) {
        throw updateError;
      }
    },
    onSuccess: async (_, nextStatus) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoice.id] }),
      ]);

      toast({
        title: nextStatus === "sent" ? "Invoice marked sent" : "Invoice voided",
        description:
          nextStatus === "sent"
            ? `${invoice.invoiceNumber} is now ready to track as client-facing AR.`
            : `${invoice.invoiceNumber} has been closed and removed from collectible balance.`,
      });
      setPendingAction(null);
    },
    onError: (mutationError: Error) => {
      toast({
        title: "Could not update invoice",
        description: mutationError.message,
        variant: "destructive",
      });
    },
  });

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
          <p className="mt-1 text-muted-foreground">Line items, payment history, and live balance tracking.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => statusMutation.mutate("sent")}
            disabled={!canSendInvoice || statusMutation.isPending}
          >
            {statusMutation.isPending ? "Saving..." : sendLabel}
          </Button>
          <Button onClick={() => setIsPaymentDialogOpen(true)} disabled={isPaymentLocked}>
            Record Payment
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadPDF}
            disabled={isGeneratingPDF}
          >
            {isGeneratingPDF ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
            {isGeneratingPDF ? "Generating..." : "Download PDF"}
          </Button>
          <Button
            variant="destructive"
            onClick={() => setPendingAction("void")}
            disabled={!canVoidInvoice || statusMutation.isPending}
          >
            Void
          </Button>
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
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Issue Date</p>
              <p className="font-medium">{formatDate(invoice.issueDate)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Due Date</p>
              <p className="font-medium">{formatDate(invoice.dueDate)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Payment Terms</p>
              <p className="font-medium">{invoice.paymentTerms ?? "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Payment Link</p>
              <p className="font-medium">{invoice.paymentLink ? "Configured" : "Not yet configured"}</p>
            </div>
          </div>

          <Separator />

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Subtotal</p>
                <p className="text-xl font-semibold">{formatCurrencyFromCents(invoice.subtotalCents)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Tax</p>
                <p className="text-xl font-semibold">{formatCurrencyFromCents(invoice.taxCents)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Trust Applied</p>
                <p className="text-xl font-semibold">{formatCurrencyFromCents(invoice.trustAppliedCents)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Paid</p>
                <p className="text-xl font-semibold">{formatCurrencyFromCents(invoice.amountPaidCents)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Balance Due</p>
                <p className="text-xl font-semibold">{formatCurrencyFromCents(invoice.balanceDueCents)}</p>
              </CardContent>
            </Card>
          </div>

          {invoice.notes && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{invoice.notes}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
          <CardDescription>Rendered from invoice line items stored in Supabase.</CardDescription>
        </CardHeader>
        <CardContent>
          {invoice.lineItems.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.lineItems.map((lineItem) => (
                  <TableRow key={lineItem.id}>
                    <TableCell>{formatDate(lineItem.date)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{lineItem.description}</div>
                      {lineItem.matterName && (
                        <div className="text-xs text-muted-foreground">{lineItem.matterName}</div>
                      )}
                    </TableCell>
                    <TableCell className="capitalize">{lineItem.lineType.replace("_", " ")}</TableCell>
                    <TableCell>{formatQuantity(lineItem.quantity)}</TableCell>
                    <TableCell>
                      {lineItem.rateCents === null || lineItem.rateCents === undefined
                        ? "—"
                        : formatCurrencyFromCents(lineItem.rateCents)}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrencyFromCents(lineItem.amountCents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              title="No line items yet"
              description="This invoice has not been populated with line items."
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payments</CardTitle>
          <CardDescription>Manual and automated payments recorded against this invoice.</CardDescription>
        </CardHeader>
        <CardContent>
          {invoice.payments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                    <TableCell>{paymentMethodLabels[payment.paymentMethod] ?? payment.paymentMethod}</TableCell>
                    <TableCell>{payment.referenceNumber || "—"}</TableCell>
                    <TableCell className="capitalize">{payment.status}</TableCell>
                    <TableCell className="text-right">{formatCurrencyFromCents(payment.amountCents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              title="No payments recorded"
              description="Record a payment to update the invoice balance and accounts receivable state."
            />
          )}
        </CardContent>
      </Card>

      <PaymentDialog
        open={isPaymentDialogOpen}
        onOpenChange={setIsPaymentDialogOpen}
        invoiceId={invoice.id}
        invoiceNumber={invoice.invoiceNumber}
        balanceDueCents={invoice.balanceDueCents}
      />

      <AlertDialog open={pendingAction === "void"} onOpenChange={(open) => setPendingAction(open ? "void" : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void {invoice.invoiceNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This keeps the invoice for audit history but removes it from active collection workflow.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => statusMutation.mutate("void")}
              disabled={statusMutation.isPending}
            >
              {statusMutation.isPending ? "Voiding..." : "Void Invoice"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default InvoiceDetail;
