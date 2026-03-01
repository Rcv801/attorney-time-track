import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
}

export default function PaymentDialog({ open, onOpenChange, invoiceId }: PaymentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Shell component for manual payment capture on invoice <span className="font-medium">{invoiceId}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="payment-amount">Amount</Label>
            <Input id="payment-amount" placeholder="0.00" disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-date">Payment date</Label>
            <Input id="payment-date" type="date" disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-reference">Reference / memo</Label>
            <Input id="payment-reference" placeholder="Check # or transfer note" disabled />
          </div>
          <p className="text-xs text-muted-foreground">
            TODO(phase2): Connect to payments table and update invoice status atomically.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button disabled>Save Payment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
