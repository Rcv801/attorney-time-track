import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSkeleton from "@/components/shared/LoadingSkeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useInvoiceBuilderData } from "./hooks";
import { formatCurrencyFromCents } from "./format";

const STEPS = [
  "1. Select Client & Matter",
  "2. Choose Unbilled Entries",
  "3. Create Draft Invoice",
];

type CreatedInvoice = {
  id: string;
  invoice_number: string;
};

function addDays(dateString: string, days: number) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function InvoiceBuilder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data, defaults, isLoading, isError, error, setSelection } = useInvoiceBuilderData();
  const [issuedDate, setIssuedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => addDays(new Date().toISOString().slice(0, 10), 30));
  const [paymentTerms, setPaymentTerms] = useState("Net 30");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setPaymentTerms(defaults.paymentTerms);
    setNotes(defaults.invoiceNotes);
  }, [defaults.invoiceNotes, defaults.paymentTerms]);

  useEffect(() => {
    setDueDate(addDays(issuedDate, 30));
  }, [issuedDate]);

  const filteredMatters = useMemo(() => {
    if (!data.selection.clientId) {
      return [];
    }

    return data.matters.filter((matter) => matter.clientId === data.selection.clientId);
  }, [data.matters, data.selection.clientId]);

  const selectedEntries = useMemo(
    () => data.unbilledEntries.filter((entry) => data.selection.selectedEntryIds.includes(entry.id)),
    [data.selection.selectedEntryIds, data.unbilledEntries],
  );

  const createInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("You must be signed in to create an invoice.");
      }

      if (!data.selection.clientId) {
        throw new Error("Select a client before creating an invoice.");
      }

      if (data.selection.selectedEntryIds.length === 0) {
        throw new Error("Select at least one unbilled entry.");
      }

      const { data: invoice, error: createError } = await supabase.rpc("create_invoice_from_entries", {
        p_user_id: user.id,
        p_client_id: data.selection.clientId,
        p_matter_id: data.selection.matterId ?? null,
        p_entry_ids: data.selection.selectedEntryIds,
        p_issued_date: issuedDate,
        p_due_date: dueDate,
        p_tax_rate: defaults.taxRate,
        p_payment_terms: paymentTerms.trim() || null,
        p_notes: notes.trim() || null,
      });

      if (createError) {
        throw createError;
      }

      return invoice as CreatedInvoice;
    },
    onSuccess: async (invoice) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["invoice-builder-data"] }),
        queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoice.id] }),
      ]);

      toast({
        title: "Invoice created",
        description: `Draft ${invoice.invoice_number} is ready for review.`,
      });

      navigate(`/invoices/${invoice.id}`);
    },
    onError: (mutationError: Error) => {
      toast({
        title: "Could not create invoice",
        description: mutationError.message,
        variant: "destructive",
      });
    },
  });

  const toggleEntry = (entryId: string, checked: boolean) => {
    setSelection((previous) => {
      const selectedIds = checked
        ? [...previous.selectedEntryIds, entryId]
        : previous.selectedEntryIds.filter((id) => id !== entryId);

      return {
        ...previous,
        selectedEntryIds: selectedIds,
      };
    });
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (isError) {
    return (
      <EmptyState
        title="Could not load invoice builder"
        description={error instanceof Error ? error.message : "Refresh and try again."}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice Builder</CardTitle>
        <CardDescription>Create a draft invoice from live unbilled time entries.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ol className="grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step} className="rounded-md border border-dashed px-3 py-2">
              {step}
            </li>
          ))}
        </ol>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="invoice-client">Client</Label>
            <Select
              value={data.selection.clientId}
              onValueChange={(clientId) =>
                setSelection({
                  clientId,
                  matterId: undefined,
                  selectedEntryIds: [],
                })
              }
            >
              <SelectTrigger id="invoice-client">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {data.clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoice-matter">Matter</Label>
            <Select
              value={data.selection.matterId ?? "__all__"}
              onValueChange={(matterId) =>
                setSelection((previous) => ({
                  ...previous,
                  matterId: matterId === "__all__" ? undefined : matterId,
                  selectedEntryIds: [],
                }))
              }
              disabled={!data.selection.clientId}
            >
              <SelectTrigger id="invoice-matter">
                <SelectValue placeholder="All matters for this client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All matters</SelectItem>
                {filteredMatters.map((matter) => (
                  <SelectItem key={matter.id} value={matter.id}>
                    {matter.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="invoice-issued-date">Issue date</Label>
            <Input
              id="invoice-issued-date"
              type="date"
              value={issuedDate}
              onChange={(event) => setIssuedDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoice-due-date">Due date</Label>
            <Input
              id="invoice-due-date"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoice-payment-terms">Payment terms</Label>
            <Input
              id="invoice-payment-terms"
              value={paymentTerms}
              onChange={(event) => setPaymentTerms(event.target.value)}
              placeholder="Net 30"
            />
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Unbilled Entries</h3>
            <span className="text-xs text-muted-foreground">
              {data.unbilledEntries.length} available
            </span>
          </div>

          {data.selection.clientId ? (
            data.unbilledEntries.length > 0 ? (
              <div className="rounded-md border">
                {data.unbilledEntries.map((entry) => {
                  const isChecked = data.selection.selectedEntryIds.includes(entry.id);

                  return (
                    <div key={entry.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b px-4 py-3 last:border-b-0">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) => toggleEntry(entry.id, checked === true)}
                        aria-label={`Include ${entry.description}`}
                      />
                      <div>
                        <p className="text-sm font-medium">{entry.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.date} • {entry.hours.toFixed(1)} hrs @ {formatCurrencyFromCents(entry.rateCents)}/hr
                        </p>
                      </div>
                      <p className="text-sm font-medium">{formatCurrencyFromCents(entry.amountCents)}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="No unbilled entries"
                description="This client or matter does not have any completed unbilled time entries yet."
              />
            )
          ) : (
            <EmptyState
              title="Choose a client first"
              description="Select a client to load its unbilled entries."
            />
          )}
        </section>

        <section className="rounded-md bg-muted/40 p-4">
          <h3 className="text-sm font-semibold">Draft Preview</h3>
          <Separator className="my-3" />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-2">
              <Label htmlFor="invoice-notes">Notes</Label>
              <Textarea
                id="invoice-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional billing notes that appear on the invoice."
              />
              <p className="text-xs text-muted-foreground">
                {selectedEntries.length} entries selected for this draft.
              </p>
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrencyFromCents(data.summary.subtotalCents)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatCurrencyFromCents(data.summary.taxCents)}</span>
              </div>
              <div className="flex items-center justify-between font-semibold">
                <span>Total</span>
                <span>{formatCurrencyFromCents(data.summary.totalCents)}</span>
              </div>
              <p className="pt-3 text-xs text-muted-foreground">
                Invoice numbers are allocated automatically when the draft is created.
              </p>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => createInvoiceMutation.mutate()}
              disabled={createInvoiceMutation.isPending || selectedEntries.length === 0 || !data.selection.clientId}
            >
              {createInvoiceMutation.isPending ? "Creating..." : "Create Draft Invoice"}
            </Button>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
