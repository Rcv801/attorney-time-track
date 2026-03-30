import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrencyFromCents } from "./format";

const PAYMENT_METHODS = [
  { value: "check", label: "Check" },
  { value: "wire", label: "Wire" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
] as const;

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  balanceDueCents: number;
  disabled?: boolean;
}

export default function PaymentDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  balanceDueCents,
  disabled = false,
}: PaymentDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]["value"]>("check");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setAmount(balanceDueCents > 0 ? (balanceDueCents / 100).toFixed(2) : "");
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setPaymentMethod("check");
      setReferenceNumber("");
      setNotes("");
    }
  }, [open, balanceDueCents]);

  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("You must be signed in to record a payment.");
      }

      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Enter a payment amount greater than zero.");
      }

      if (parsedAmount > balanceDueCents / 100) {
        throw new Error("Payment amount cannot exceed the remaining balance.");
      }

      if (!paymentDate) {
        throw new Error("Choose a payment date.");
      }

      const { error } = await supabase.from("payments").insert({
        user_id: user.id,
        invoice_id: invoiceId,
        amount: parsedAmount,
        payment_method: paymentMethod,
        payment_date: paymentDate,
        reference_number: referenceNumber.trim() || null,
        notes: notes.trim() || null,
        status: "completed",
        account_type: "operating",
      });

      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["invoice-detail", invoiceId] }),
      ]);

      toast({
        title: "Payment recorded",
        description: `Saved a payment for ${invoiceNumber}.`,
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Could not record payment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isPaidInFull = balanceDueCents <= 0;
  const isReadOnly = disabled || isPaidInFull;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Add a manual payment for <span className="font-medium">{invoiceNumber}</span>. The invoice balance and
            status update automatically after save.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Remaining balance</span>
              <span className="font-semibold">{formatCurrencyFromCents(balanceDueCents)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-amount">Amount</Label>
            <Input
              id="payment-amount"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={isReadOnly || paymentMutation.isPending}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="payment-date">Payment date</Label>
              <Input
                id="payment-date"
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
                disabled={isReadOnly || paymentMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label>Method</Label>
              <Select
                value={paymentMethod}
                onValueChange={(value) => setPaymentMethod(value as (typeof PAYMENT_METHODS)[number]["value"])}
                disabled={isReadOnly || paymentMutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a method" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-reference">Reference / memo</Label>
            <Input
              id="payment-reference"
              placeholder="Check # or transfer note"
              value={referenceNumber}
              onChange={(event) => setReferenceNumber(event.target.value)}
              disabled={isReadOnly || paymentMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-notes">Internal notes</Label>
            <Textarea
              id="payment-notes"
              placeholder="Optional collection note"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={isReadOnly || paymentMutation.isPending}
            />
          </div>

          {disabled && !isPaidInFull && (
            <p className="text-sm text-slate-500">Payments can only be recorded after the invoice leaves draft status.</p>
          )}

          {isPaidInFull && (
            <p className="text-sm text-slate-500">This invoice is already fully paid.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={paymentMutation.isPending}>
            Close
          </Button>
          <Button onClick={() => paymentMutation.mutate()} disabled={isReadOnly || paymentMutation.isPending}>
            {paymentMutation.isPending ? "Saving..." : "Save Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
