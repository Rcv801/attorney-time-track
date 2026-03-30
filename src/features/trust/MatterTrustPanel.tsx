import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownCircle, ArrowUpCircle, Landmark, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;
type Matter = Tables<"matters">;
type Invoice = Tables<"invoices">;
type TrustLedgerEntry = Tables<"trust_ledger">;

type TrustBalanceView = {
  client_id: string | null;
  current_balance: number | null;
  last_transaction_at: string | null;
  last_transaction_date: string | null;
  matter_id: string | null;
  user_id: string | null;
};

type TransactionIntent =
  | "deposit"
  | "disbursement"
  | "refund"
  | "transfer_in"
  | "transfer_out"
  | "interest"
  | "bank_fee"
  | "apply_to_invoice";

const TRANSACTION_OPTIONS: Array<{
  value: TransactionIntent;
  label: string;
  help: string;
}> = [
  { value: "deposit", label: "Retainer deposit", help: "Adds client funds into trust." },
  { value: "apply_to_invoice", label: "Apply to invoice", help: "Draws trust against an open invoice." },
  { value: "disbursement", label: "Manual disbursement", help: "Moves earned fees or other funds out of trust." },
  { value: "refund", label: "Refund to client", help: "Returns unused trust funds to the client." },
  { value: "bank_fee", label: "Bank fee", help: "Records a bank charge against this matter's trust." },
  { value: "interest", label: "Interest", help: "Adds interest earned in trust." },
  { value: "transfer_in", label: "Transfer in", help: "Moves funds into this matter from another trust source." },
  { value: "transfer_out", label: "Transfer out", help: "Moves funds out of this matter to another trust source." },
];

const NEGATIVE_INTENTS = new Set<TransactionIntent>([
  "disbursement",
  "refund",
  "transfer_out",
  "bank_fee",
]);

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatCurrency(amount: number | null | undefined) {
  return currencyFormatter.format(amount ?? 0);
}

function formatDate(dateString: string | null | undefined) {
  if (!dateString) {
    return "No activity yet";
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return dateFormatter.format(date);
}

function getSignedAmount(intent: Exclude<TransactionIntent, "apply_to_invoice">, amount: number) {
  return NEGATIVE_INTENTS.has(intent) ? -Math.abs(amount) : Math.abs(amount);
}

interface MatterTrustPanelProps {
  client: Client;
  matter: Matter;
}

export default function MatterTrustPanel({ client, matter }: MatterTrustPanelProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [intent, setIntent] = useState<TransactionIntent>("deposit");
  const [amount, setAmount] = useState("");
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [payorPayee, setPayorPayee] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");

  const { data: trustBalance, isLoading: isBalanceLoading } = useQuery<TrustBalanceView | null>({
    queryKey: ["trust-balance", matter.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trust_balance_by_matter")
        .select("*")
        .eq("matter_id", matter.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    },
  });

  const { data: ledgerEntries, isLoading: isLedgerLoading } = useQuery<TrustLedgerEntry[]>({
    queryKey: ["trust-ledger", matter.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trust_ledger")
        .select("*")
        .eq("matter_id", matter.id)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(8);

      if (error) {
        throw error;
      }

      return data;
    },
  });

  const { data: openInvoices } = useQuery<Invoice[]>({
    queryKey: ["matter-open-invoices", matter.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("matter_id", matter.id)
        .in("status", ["draft", "sent", "viewed", "partial", "overdue"])
        .order("issued_date", { ascending: false });

      if (error) {
        throw error;
      }

      return data;
    },
  });

  const currentBalance = trustBalance?.current_balance ?? matter.trust_balance ?? 0;

  const totals = useMemo(() => {
    return (ledgerEntries ?? []).reduce(
      (summary, entry) => {
        if (entry.amount >= 0) {
          summary.inflows += entry.amount;
        } else {
          summary.outflows += Math.abs(entry.amount);
        }
        return summary;
      },
      { inflows: 0, outflows: 0 },
    );
  }, [ledgerEntries]);

  const selectedInvoice = useMemo(
    () => openInvoices?.find((invoice) => invoice.id === selectedInvoiceId) ?? null,
    [openInvoices, selectedInvoiceId],
  );

  const resetDialog = () => {
    setIntent("deposit");
    setAmount("");
    setTransactionDate(new Date().toISOString().slice(0, 10));
    setDescription("");
    setReference("");
    setPayorPayee("");
    setSelectedInvoiceId("");
  };

  const trustMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("You must be signed in to record trust activity.");
      }

      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Enter a trust amount greater than zero.");
      }

      if (!transactionDate) {
        throw new Error("Choose a transaction date.");
      }

      if (intent === "apply_to_invoice") {
        if (!selectedInvoiceId) {
          throw new Error("Select an invoice before applying trust.");
        }

        const { data, error } = await supabase.rpc("apply_trust_to_invoice", {
          p_user_id: user.id,
          p_invoice_id: selectedInvoiceId,
          p_amount: parsedAmount,
          p_description: description.trim() || undefined,
          p_reference: reference.trim() || undefined,
          p_transaction_date: transactionDate,
        });

        if (error) {
          throw error;
        }

        return data;
      }

      if (!description.trim()) {
        throw new Error("Add a description for the ledger entry.");
      }

      const { data, error } = await supabase.rpc("record_trust_transaction", {
        p_user_id: user.id,
        p_client_id: client.id,
        p_matter_id: matter.id,
        p_type: intent,
        p_amount: getSignedAmount(intent, parsedAmount),
        p_description: description.trim(),
        p_reference: reference.trim() || undefined,
        p_payor_payee: payorPayee.trim() || undefined,
        p_transaction_date: transactionDate,
      });

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["trust-balance", matter.id] }),
        queryClient.invalidateQueries({ queryKey: ["trust-ledger", matter.id] }),
        queryClient.invalidateQueries({ queryKey: ["matter-open-invoices", matter.id] }),
        queryClient.invalidateQueries({ queryKey: ["matters-for-clients"] }),
      ]);

      toast({
        title: "Trust ledger updated",
        description:
          intent === "apply_to_invoice"
            ? "Trust funds were applied to the invoice and the matter balance was updated."
            : "The trust ledger entry was recorded and the matter balance was updated.",
      });

      setIsDialogOpen(false);
      resetDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Trust update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const openDialogFor = (nextIntent: TransactionIntent) => {
    setIntent(nextIntent);
    setDescription(
      nextIntent === "deposit"
        ? "Initial retainer deposit"
        : nextIntent === "apply_to_invoice"
          ? `Trust applied to ${selectedInvoice?.invoice_number ?? "invoice"}`
          : "",
    );
    setIsDialogOpen(true);
  };

  return (
    <>
      <Card className="border-dashed bg-white/80 shadow-none">
        <CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="rounded-lg border bg-slate-50 border-slate-100 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Landmark className="h-4 w-4" />
                Trust Balance
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {isBalanceLoading ? "Loading..." : formatCurrency(currentBalance)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Last activity {formatDate(trustBalance?.last_transaction_at ?? trustBalance?.last_transaction_date)}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                  <ArrowDownCircle className="h-3.5 w-3.5" />
                  Total Deposits
                </div>
                <p className="mt-2 text-lg font-semibold tabular-nums">{formatCurrency(totals.inflows)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                  <ArrowUpCircle className="h-3.5 w-3.5" />
                  Total Drawdowns
                </div>
                <p className="mt-2 text-lg font-semibold tabular-nums">{formatCurrency(totals.outflows)}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => openDialogFor("deposit")}>
                Record Deposit
              </Button>
              <Button size="sm" variant="outline" onClick={() => openDialogFor("apply_to_invoice")}>
                Apply to Invoice
              </Button>
              <Button size="sm" variant="ghost" onClick={() => openDialogFor("disbursement")}>
                Manual Drawdown
              </Button>
            </div>

            <p className="text-xs text-slate-500">
              Trust entries are append-only. Corrections should be entered as new ledger activity, never edits.
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Open invoices for this matter</p>
                  <p className="text-xs text-slate-500">
                    Apply trust directly against outstanding balances without leaving the matter view.
                  </p>
                </div>
                <Badge variant="secondary">{openInvoices?.length ?? 0}</Badge>
              </div>
              <div className="divide-y">
                {openInvoices?.length ? (
                  openInvoices.map((invoice) => (
                    <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{invoice.invoice_number}</p>
                        <p className="text-xs text-slate-500">
                          Issued {formatDate(invoice.created_at)} • {invoice.status}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums">
                          {formatCurrency(invoice.balance_due)}
                        </p>
                        <p className="text-xs text-slate-500">
                          Trust applied {formatCurrency(invoice.trust_applied)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-6 text-sm text-slate-500">
                    No open invoices for this matter yet.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Recent trust ledger</p>
                  <p className="text-xs text-slate-500">
                    Matter-specific trust history with running balance snapshots.
                  </p>
                </div>
                <ReceiptText className="h-4 w-4 text-slate-500" />
              </div>

              {isLedgerLoading ? (
                <div className="px-4 py-6 text-sm text-slate-500">Loading trust ledger...</div>
              ) : ledgerEntries?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledgerEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap">{formatDate(entry.transaction_date)}</TableCell>
                        <TableCell>
                          <Badge variant={entry.amount >= 0 ? "secondary" : "outline"} className="capitalize">
                            {entry.transaction_type.replaceAll("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[260px] truncate" title={entry.description}>
                            {entry.description}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          <span className={entry.amount < 0 ? "text-amber-700" : "text-emerald-700"}>
                            {formatCurrency(entry.amount)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(entry.running_balance)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="px-4 py-6 text-sm text-slate-500">
                  No trust activity recorded for this matter yet.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open && !trustMutation.isPending) {
            resetDialog();
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Record trust activity</DialogTitle>
            <DialogDescription>
              {client.name} / {matter.name}. Use the trust helper so running balances stay consistent.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`trust-intent-${matter.id}`}>Transaction type</Label>
                <Select
                  value={intent}
                  onValueChange={(value: TransactionIntent) => {
                    setIntent(value);
                    if (value !== "apply_to_invoice") {
                      setSelectedInvoiceId("");
                    }
                  }}
                >
                  <SelectTrigger id={`trust-intent-${matter.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSACTION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  {TRANSACTION_OPTIONS.find((option) => option.value === intent)?.help}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`trust-amount-${matter.id}`}>Amount</Label>
                <Input
                  id={`trust-amount-${matter.id}`}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
                <p className="text-xs text-slate-500">
                  Available trust balance: {formatCurrency(currentBalance)}
                </p>
              </div>
            </div>

            {intent === "apply_to_invoice" && (
              <div className="space-y-2">
                <Label htmlFor={`trust-invoice-${matter.id}`}>Invoice</Label>
                <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
                  <SelectTrigger id={`trust-invoice-${matter.id}`}>
                    <SelectValue placeholder="Select an open invoice" />
                  </SelectTrigger>
                  <SelectContent>
                    {openInvoices?.map((invoice) => (
                      <SelectItem key={invoice.id} value={invoice.id}>
                        {invoice.invoice_number} • {formatCurrency(invoice.balance_due)} due
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedInvoice && (
                  <div className="rounded-md border bg-slate-50 border-slate-100 px-3 py-2 text-xs text-slate-500">
                    Outstanding balance: {formatCurrency(selectedInvoice.balance_due)}
                    <br />
                    Already applied from trust: {formatCurrency(selectedInvoice.trust_applied)}
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-2 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`trust-date-${matter.id}`}>Transaction date</Label>
                <Input
                  id={`trust-date-${matter.id}`}
                  type="date"
                  value={transactionDate}
                  onChange={(event) => setTransactionDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`trust-reference-${matter.id}`}>Reference</Label>
                <Input
                  id={`trust-reference-${matter.id}`}
                  placeholder="Check #, transfer ID, receipt"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`trust-description-${matter.id}`}>Description</Label>
              <Input
                id={`trust-description-${matter.id}`}
                placeholder="Initial retainer deposit"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            {intent !== "apply_to_invoice" && (
              <div className="space-y-2">
                <Label htmlFor={`trust-payor-${matter.id}`}>Payor / Payee</Label>
                <Input
                  id={`trust-payor-${matter.id}`}
                  placeholder="Client name, bank, or vendor"
                  value={payorPayee}
                  onChange={(event) => setPayorPayee(event.target.value)}
                />
              </div>
            )}

            <Separator />

            <div className="text-xs text-slate-500">
              Matter balance after this entry will be validated in the database. Invalid negative trust balances are rejected automatically.
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={trustMutation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={() => trustMutation.mutate()} disabled={trustMutation.isPending}>
              {trustMutation.isPending ? "Saving..." : "Save trust entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
