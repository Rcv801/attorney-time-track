import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { Copy, ExternalLink, FileDown, Loader2, Send } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSkeleton from "@/components/shared/LoadingSkeleton";
import InvoiceStatusBadge from "@/features/invoices/InvoiceStatusBadge";
import { useInvoiceDetailQuery } from "@/features/invoices/hooks";
import { formatCurrencyFromCents } from "@/features/invoices/format";
import PaymentDialog from "@/features/invoices/PaymentDialog";
import { generateInvoicePDF, downloadPDF } from "@/features/invoices/pdf/generateInvoicePDF";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { InvoiceStatus } from "@/features/invoices/types";
import { buildLedes1998B, downloadLedesFile } from "@/lib/ledes";

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
  email_from_name: string | null;
  email_from_address: string | null;
  reply_to_email: string | null;
  email_subject_template: string | null;
  email_body_template: string | null;
  stripe_connected: boolean | null;
  stripe_publishable_key: string | null;
  timekeeper_classification: string | null;
}

interface Client {
  id: string;
  name: string;
  email: string | null;
  notes: string | null;
}

interface MatterInfo {
  id: string;
  matter_number: string | null;
  name: string;
}

interface EmailDraftState {
  to: string;
  subject: string;
  body: string;
}

interface InvoiceEditState {
  issuedDate: string;
  dueDate: string;
  paymentTerms: string;
  notes: string;
}

interface SendInvoiceResponse {
  pdfPath: string;
  sentAt: string;
  providerMessageId: string | null;
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

function interpolateTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => variables[key] ?? "");
}

const InvoiceDetail = () => {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"void" | "delete" | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isDownloadingStoredPdf, setIsDownloadingStoredPdf] = useState(false);
  const [emailDraft, setEmailDraft] = useState<EmailDraftState>({
    to: "",
    subject: "",
    body: "",
  });
  const [editForm, setEditForm] = useState<InvoiceEditState>({
    issuedDate: "",
    dueDate: "",
    paymentTerms: "",
    notes: "",
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: invoice, isLoading, isError, error } = useInvoiceDetailQuery(invoiceId);

  useEffect(() => {
    if (!invoice) {
      return;
    }

    setEditForm({
      issuedDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      paymentTerms: invoice.paymentTerms ?? "",
      notes: invoice.notes ?? "",
    });
  }, [invoice]);

  // Fetch user settings for PDF
  const { data: userSettings } = useQuery<UserSettings>({
    queryKey: ["user-settings"],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("user_settings")
        .select("firm_name, attorney_name, bar_number, phone, address_line1, address_line2, city, state, zip, logo_url, email_from_name, email_from_address, reply_to_email, email_subject_template, email_body_template, stripe_connected, stripe_publishable_key, timekeeper_classification")
        .eq("user_id", user.id)
        .maybeSingle();
      return data as UserSettings;
    },
    enabled: !!user,
  });

  // Fetch client info for PDF / email
  const { data: clientInfo } = useQuery<Client>({
    queryKey: ["client-info", invoice?.clientId],
    queryFn: async () => {
      if (!invoice?.clientId) return null;
      const { data } = await supabase
        .from("clients")
        .select("id, name, email, notes")
        .eq("id", invoice.clientId)
        .maybeSingle();
      return data as Client;
    },
    enabled: !!user && !!invoice?.clientId,
  });

  const { data: matterInfo } = useQuery<MatterInfo | null>({
    queryKey: ["matter-info", invoice?.matterId],
    queryFn: async () => {
      if (!invoice?.matterId) return null;
      const { data } = await supabase
        .from("matters")
        .select("id, matter_number, name")
        .eq("id", invoice.matterId)
        .maybeSingle();
      return (data as MatterInfo | null) ?? null;
    },
    enabled: !!invoice?.matterId,
  });

  const statusMutation = useMutation({
    mutationFn: async (nextStatus: InvoiceStatus) => {
      if (!invoice) {
        throw new Error("Invoice data is still loading.");
      }

      const updates: Record<string, string | null> = {
        status: nextStatus,
      };

      const { error: updateError } = await supabase
        .from("invoices")
        .update(updates)
        .eq("id", invoice.id);

      if (updateError) {
        throw updateError;
      }
    },
    onSuccess: async (_, nextStatus) => {
      if (!invoice) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoice.id] }),
      ]);

      toast({
        title: "Invoice voided",
        description: `${invoice.invoiceNumber} has been closed and removed from collectible balance.`,
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

  const editInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!invoice) {
        throw new Error("Invoice data is still loading.");
      }

      const issuedDate = editForm.issuedDate.trim();
      const dueDate = editForm.dueDate.trim();

      if (!issuedDate || !dueDate) {
        throw new Error("Issue date and due date are required.");
      }

      if (new Date(`${dueDate}T00:00:00`).getTime() < new Date(`${issuedDate}T00:00:00`).getTime()) {
        throw new Error("Due date cannot be earlier than the issue date.");
      }

      const updates = {
        issued_date: issuedDate,
        due_date: dueDate,
        payment_terms: editForm.paymentTerms.trim() || null,
        notes: editForm.notes.trim() || null,
      };

      const { error: updateError } = await supabase.from("invoices").update(updates).eq("id", invoice.id);

      if (updateError) {
        throw updateError;
      }
    },
    onSuccess: async () => {
      if (!invoice) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoice.id] }),
      ]);

      toast({
        title: "Invoice updated",
        description: `${invoice.invoiceNumber} details were saved.`,
      });
      setIsEditDialogOpen(false);
    },
    onError: (mutationError: Error) => {
      toast({
        title: "Could not update invoice",
        description: mutationError.message,
        variant: "destructive",
      });
    },
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!invoice) {
        throw new Error("Invoice data is still loading.");
      }

      const { error: deleteError } = await supabase.from("invoices").delete().eq("id", invoice.id);

      if (deleteError) {
        throw deleteError;
      }
    },
    onSuccess: async () => {
      if (!invoice) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["invoice-builder-data"] }),
      ]);

      toast({
        title: "Invoice deleted",
        description: `${invoice.invoiceNumber} was removed and its draft entries are available to bill again.`,
      });
      setPendingAction(null);
      navigate("/invoices");
    },
    onError: (mutationError: Error) => {
      toast({
        title: "Could not delete invoice",
        description: mutationError.message,
        variant: "destructive",
      });
    },
  });

  const markManualSendMutation = useMutation({
    mutationFn: async () => {
      if (!invoice) {
        throw new Error("Invoice data is still loading.");
      }

      if (invoice.status !== "draft") {
        return;
      }

      const { error } = await supabase
        .from("invoices")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", invoice.id);

      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      if (!invoice) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoice.id] }),
      ]);
    },
    onError: (mutationError: Error) => {
      toast({
        title: "Could not mark invoice as sent",
        description: mutationError.message,
        variant: "destructive",
      });
    },
  });

  const sendInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!invoice) {
        throw new Error("Invoice data is still loading.");
      }

      if (!emailDraft.to.trim()) {
        throw new Error("Add a recipient email before sending.");
      }

      const { data, error: invokeError } = await supabase.functions.invoke("deliver-invoice", {
        body: {
          invoiceId: invoice.id,
          to: emailDraft.to.trim(),
          subject: emailDraft.subject.trim(),
          body: emailDraft.body.trim(),
        },
      });

      if (invokeError) {
        throw invokeError;
      }

      if (!data?.pdfPath || !data?.sentAt) {
        throw new Error("Invoice delivery did not return delivery metadata.");
      }

      return data as SendInvoiceResponse;
    },
    onSuccess: async () => {
      if (!invoice) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoice.id] }),
      ]);

      toast({
        title: "Invoice sent",
        description: `${invoice.invoiceNumber} was emailed from the backend and the PDF was stored for audit history.`,
      });
      setIsSendDialogOpen(false);
    },
    onError: (mutationError: Error) => {
      const msg = mutationError.message;
      const isNotDeployed = msg.includes("FunctionNotFound") || msg.includes("404") || msg.includes("Function not found");
      toast({
        title: "Could not send invoice",
        description: isNotDeployed
          ? "Email delivery is not yet configured. Use \"Copy Draft\" to send manually via your email client."
          : msg,
        variant: "destructive",
      });
    },
  });

  const paymentLinkMutation = useMutation({
    mutationFn: async () => {
      if (!invoice) {
        throw new Error("Invoice data is still loading.");
      }

      const { data, error: invokeError } = await supabase.functions.invoke("create-payment-link", {
        body: { invoiceId: invoice.id },
      });

      if (invokeError) {
        throw invokeError;
      }

      if (!data?.url) {
        throw new Error("Payment link generation did not return a Stripe URL.");
      }

      return data.url as string;
    },
    onSuccess: async (url) => {
      if (!invoice) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoice.id] }),
      ]);

      toast({
        title: "Payment link ready",
        description: `Stripe checkout was generated for ${invoice.invoiceNumber}.`,
      });
      window.open(url, "_blank", "noopener,noreferrer");
    },
    onError: (mutationError: Error) => {
      const msg = mutationError.message;
      const isNotDeployed = msg.includes("FunctionNotFound") || msg.includes("404") || msg.includes("Function not found");
      toast({
        title: "Could not generate payment link",
        description: isNotDeployed
          ? "Stripe integration is not yet configured. Record payments manually from the invoice detail page."
          : msg,
        variant: "destructive",
      });
    },
  });

  const openSendDialog = () => {
    if (!invoice) {
      return;
    }

    const firmName = userSettings?.firm_name?.trim() || userSettings?.attorney_name?.trim() || "Your firm";
    const subjectTemplate = userSettings?.email_subject_template?.trim() || "Invoice {number} from {firm_name}";
    const bodyTemplate =
      userSettings?.email_body_template?.trim() ||
      "Please find your invoice attached. You can pay online using the link below.\n\nPayment link: {payment_link}\nDue date: {due_date}\nBalance due: {balance_due}";

    const variables = {
      number: invoice.invoiceNumber,
      firm_name: firmName,
      client_name: invoice.clientName,
      matter_name: invoice.matterName,
      due_date: formatDate(invoice.dueDate),
      issue_date: formatDate(invoice.issueDate),
      payment_link: invoice.paymentLink ?? "Not yet configured",
      balance_due: formatCurrencyFromCents(invoice.balanceDueCents),
    };

    setEmailDraft({
      to: clientInfo?.email ?? "",
      subject: interpolateTemplate(subjectTemplate, variables),
      body: interpolateTemplate(bodyTemplate, variables),
    });
    setIsSendDialogOpen(true);
  };

  const handleDownloadPDF = async () => {
    if (!invoice) {
      return;
    }

    if (invoice.pdfUrl) {
      setIsDownloadingStoredPdf(true);
      try {
        const { data, error: downloadError } = await supabase.storage
          .from("invoice-pdfs")
          .download(invoice.pdfUrl);

        if (downloadError) {
          throw downloadError;
        }

        downloadPDF(data, `invoice-${invoice.invoiceNumber}.pdf`);

        toast({
          title: "Stored PDF downloaded",
          description: `Invoice ${invoice.invoiceNumber} was downloaded from secure storage.`,
        });
        return;
      } catch (err) {
        toast({
          title: "Could not download stored PDF",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setIsDownloadingStoredPdf(false);
      }
    }

    if (!userSettings || !clientInfo) {
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

  const handleExportLedes = () => {
    if (!invoice) {
      return;
    }

    if (invoice.lineItems.length === 0) {
      toast({
        title: "Cannot export LEDES",
        description: "This invoice has no line items to export.",
        variant: "destructive",
      });
      return;
    }

    const datedLineItems = invoice.lineItems.filter((lineItem) => lineItem.date);
    const sortedLineItemDates = datedLineItems
      .map((lineItem) => lineItem.date)
      .sort((left, right) => left.localeCompare(right));

    const billingStartDate = invoice.dateRangeStart ?? sortedLineItemDates[0] ?? invoice.issueDate;
    const billingEndDate =
      invoice.dateRangeEnd ?? sortedLineItemDates[sortedLineItemDates.length - 1] ?? invoice.issueDate;

    const ledes = buildLedes1998B({
      invoiceDate: invoice.issueDate,
      invoiceNumber: invoice.invoiceNumber,
      clientId: clientInfo?.id ?? invoice.clientId ?? invoice.clientName,
      lawFirmMatterId: matterInfo?.matter_number ?? invoice.matterId ?? invoice.matterName,
      invoiceTotal: invoice.totalCents / 100,
      billingStartDate,
      billingEndDate,
      invoiceDescription: invoice.notes?.trim() || "For services rendered",
      lawFirmId: userSettings?.bar_number?.trim() || user?.id || "UNKNOWN",
      clientMatterId: matterInfo?.matter_number ?? "",
      timekeeperId: userSettings?.bar_number?.trim() || user?.id || "UNKNOWN",
      timekeeperName:
        userSettings?.attorney_name?.trim() || userSettings?.firm_name?.trim() || "Timekeeper not configured",
      timekeeperClassification: userSettings?.timekeeper_classification?.trim() || "PARTNER",
      lineItems: invoice.lineItems.map((lineItem) => {
        const isAdjustment = lineItem.lineType === "adjustment" || lineItem.lineType === "discount";
        const units =
          lineItem.quantity ??
          (lineItem.lineType === "expense" ? 1 : lineItem.rateCents && lineItem.rateCents > 0
            ? lineItem.amountCents / lineItem.rateCents
            : 1);

        return {
          type: lineItem.lineType === "expense" ? "expense" : isAdjustment ? "adjustment" : "time",
          date: lineItem.date,
          description: lineItem.description,
          units,
          adjustmentAmount: isAdjustment ? lineItem.amountCents / 100 : 0,
          total: lineItem.amountCents / 100,
        };
      }),
    });

    downloadLedesFile(ledes, `${invoice.invoiceNumber}_LEDES1998B.ledes`);
    toast({
      title: "LEDES export ready",
      description: `${invoice.invoiceNumber} was downloaded in LEDES 1998B format.`,
    });
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
  const canEditInvoice = invoice.status !== "void" && invoice.status !== "written_off";
  const canDeleteInvoice = invoice.status === "draft" && invoice.payments.length === 0;
  const sendLabel = invoice.status === "draft" ? "Send Invoice" : "Resend Invoice";
  const isSendingInvoice = sendInvoiceMutation.isPending;
  const canGeneratePaymentLink =
    Boolean(userSettings?.stripe_connected) &&
    invoice.status !== "paid" &&
    invoice.status !== "void" &&
    invoice.status !== "written_off" &&
    invoice.balanceDueCents > 0;

  const handleCopyDraft = async () => {
    const composedDraft = `To: ${emailDraft.to || "Client email not set"}\nSubject: ${emailDraft.subject}\n\n${emailDraft.body}`;

    try {
      await navigator.clipboard.writeText(composedDraft);
      await markManualSendMutation.mutateAsync();
      toast({
        title: "Email draft copied",
        description: "Recipient, subject, and body are ready to paste into your email client. The invoice is now marked issued for manual collection.",
      });
    } catch (copyError) {
      toast({
        title: "Could not copy email draft",
        description: copyError instanceof Error ? copyError.message : "Clipboard access was denied.",
        variant: "destructive",
      });
    }
  };

  const handleCopyPaymentLink = async () => {
    if (!invoice.paymentLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(invoice.paymentLink);
      toast({
        title: "Payment link copied",
        description: "The Stripe checkout link is ready to paste into email or chat.",
      });
    } catch (copyError) {
      toast({
        title: "Could not copy payment link",
        description: copyError instanceof Error ? copyError.message : "Clipboard access was denied.",
        variant: "destructive",
      });
    }
  };

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
            onClick={() => setIsEditDialogOpen(true)}
            disabled={!canEditInvoice || editInvoiceMutation.isPending}
          >
            Edit Details
          </Button>
          <Button
            variant="outline"
            onClick={openSendDialog}
            disabled={!canSendInvoice || statusMutation.isPending || isSendingInvoice}
          >
            {isSendingInvoice ? "Sending..." : sendLabel}
          </Button>
          <Button onClick={() => setIsPaymentDialogOpen(true)} disabled={isPaymentLocked}>
            Record Payment
          </Button>
          <Button
            variant="outline"
            onClick={() => paymentLinkMutation.mutate()}
            disabled={!canGeneratePaymentLink || paymentLinkMutation.isPending}
          >
            {paymentLinkMutation.isPending ? "Generating..." : invoice.paymentLink ? "Refresh Payment Link" : "Generate Payment Link"}
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadPDF}
            disabled={isGeneratingPDF || isDownloadingStoredPdf}
          >
            {isGeneratingPDF || isDownloadingStoredPdf ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            {isDownloadingStoredPdf
              ? "Downloading..."
              : isGeneratingPDF
                ? "Generating..."
                : invoice.pdfUrl
                  ? "Download Stored PDF"
                  : "Download PDF"}
          </Button>
          <Button variant="outline" onClick={handleExportLedes}>
            <FileDown className="mr-2 h-4 w-4" />
            Export LEDES
          </Button>
          <Button
            variant="destructive"
            onClick={() => setPendingAction("void")}
            disabled={!canVoidInvoice || statusMutation.isPending}
          >
            Void
          </Button>
          {canDeleteInvoice && (
            <Button
              variant="outline"
              onClick={() => setPendingAction("delete")}
              disabled={deleteInvoiceMutation.isPending}
            >
              Delete Draft
            </Button>
          )}
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
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
              <p className="text-sm text-muted-foreground">Sent</p>
              <p className="font-medium">{invoice.sentAt ? formatDate(invoice.sentAt) : "Not yet sent"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Payment Link</p>
              <div className="space-y-2">
                <p className="font-medium">
                  {invoice.paymentLink
                    ? "Configured"
                    : userSettings?.stripe_connected
                      ? "Not yet generated"
                      : "Stripe not connected"}
                </p>
                {invoice.paymentLink && (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="secondary" onClick={handleCopyPaymentLink}>
                      <Copy className="mr-2 h-3.5 w-3.5" />
                      Copy Link
                    </Button>
                    <Button type="button" size="sm" variant="secondary" asChild>
                      <a href={invoice.paymentLink} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-2 h-3.5 w-3.5" />
                        Open Link
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Stored PDF</p>
              <p className="font-medium">{invoice.pdfUrl ? "Stored in Supabase" : "Not yet stored"}</p>
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

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Invoice Details</DialogTitle>
            <DialogDescription>
              Update invoice dates, payment terms, and notes without rebuilding the draft.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invoice-issued-date-edit">Issue date</Label>
                <Input
                  id="invoice-issued-date-edit"
                  type="date"
                  value={editForm.issuedDate}
                  onChange={(event) => setEditForm((current) => ({ ...current, issuedDate: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice-due-date-edit">Due date</Label>
                <Input
                  id="invoice-due-date-edit"
                  type="date"
                  value={editForm.dueDate}
                  onChange={(event) => setEditForm((current) => ({ ...current, dueDate: event.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice-payment-terms-edit">Payment terms</Label>
              <Input
                id="invoice-payment-terms-edit"
                value={editForm.paymentTerms}
                onChange={(event) => setEditForm((current) => ({ ...current, paymentTerms: event.target.value }))}
                placeholder="Net 30"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice-notes-edit">Notes</Label>
              <Textarea
                id="invoice-notes-edit"
                rows={6}
                value={editForm.notes}
                onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Optional billing notes that appear on the invoice."
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => editInvoiceMutation.mutate()} disabled={editInvoiceMutation.isPending}>
              {editInvoiceMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{sendLabel}</DialogTitle>
            <DialogDescription>
              Review the recipient and message. For beta, Copy Draft plus Preview PDF is a valid manual-send path even if backend delivery is not configured.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>From</Label>
              <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                {userSettings?.email_from_name?.trim() || userSettings?.firm_name?.trim() || userSettings?.attorney_name?.trim()
                  ? `${userSettings?.email_from_name?.trim() || userSettings?.firm_name?.trim() || userSettings?.attorney_name?.trim()}`
                  : "Workspace default sender"}
                {userSettings?.email_from_address?.trim() ? ` <${userSettings.email_from_address.trim()}>` : ""}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice-email-to">To</Label>
              <Input
                id="invoice-email-to"
                type="email"
                value={emailDraft.to}
                onChange={(event) => setEmailDraft((current) => ({ ...current, to: event.target.value }))}
                placeholder="client@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice-email-subject">Subject</Label>
              <Input
                id="invoice-email-subject"
                value={emailDraft.subject}
                onChange={(event) => setEmailDraft((current) => ({ ...current, subject: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice-email-body">Body</Label>
              <Textarea
                id="invoice-email-body"
                rows={12}
                value={emailDraft.body}
                onChange={(event) => setEmailDraft((current) => ({ ...current, body: event.target.value }))}
              />
            </div>

            <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              {invoice.paymentLink
                ? "Payment link is configured and included in the email body."
                : "Payment link is not configured yet. Manual-pay-first beta is still valid: use Copy Draft, share the PDF, and record payment manually."}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCopyDraft}>
              <Copy className="mr-2 h-4 w-4" />
              Copy Draft
            </Button>
            <Button type="button" variant="outline" onClick={handleDownloadPDF} disabled={isGeneratingPDF}>
              {isGeneratingPDF ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
              {isGeneratingPDF ? "Generating..." : invoice.pdfUrl ? "Download Stored PDF" : "Preview PDF"}
            </Button>
            <Button type="button" onClick={() => sendInvoiceMutation.mutate()} disabled={isSendingInvoice}>
              {isSendingInvoice ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {isSendingInvoice ? "Sending..." : sendLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <AlertDialog open={pendingAction === "delete"} onOpenChange={(open) => setPendingAction(open ? "delete" : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete draft {invoice.invoiceNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the draft invoice and returns its linked entries to the unbilled queue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteInvoiceMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteInvoiceMutation.mutate()}
              disabled={deleteInvoiceMutation.isPending}
            >
              {deleteInvoiceMutation.isPending ? "Deleting..." : "Delete Draft"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default InvoiceDetail;