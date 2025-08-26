import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { FileText } from "lucide-react";

interface InvoiceCreateDialogProps {
  selectedEntries: any[];
  onClose: () => void;
}

export default function InvoiceCreateDialog({ 
  selectedEntries, 
  onClose 
}: InvoiceCreateDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [invoiceName, setInvoiceName] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });

  // Calculate totals and date range from selected entries
  const totals = selectedEntries.reduce((acc, entry) => {
    const duration = entry.duration_sec || 0;
    const amount = (duration / 3600) * Number(entry.client?.hourly_rate || 0);
    acc.duration += duration;
    acc.amount += amount;
    
    const entryDate = new Date(entry.start_at);
    if (!acc.minDate || entryDate < acc.minDate) acc.minDate = entryDate;
    if (!acc.maxDate || entryDate > acc.maxDate) acc.maxDate = entryDate;
    
    return acc;
  }, { duration: 0, amount: 0, minDate: null as Date | null, maxDate: null as Date | null });

  const defaultInvoiceName = totals.minDate && totals.maxDate 
    ? `Invoice ${totals.minDate.toLocaleDateString()} - ${totals.maxDate.toLocaleDateString()}`
    : "Invoice";

  const handleOpen = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setInvoiceName(defaultInvoiceName);
      setNotes("");
      setFile(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || selectedEntries.length === 0) return;
    
    setIsLoading(true);
    
    try {
      let fileUrl = null;
      
      // Upload file if provided
      if (file) {
        const fileName = `${user.id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("invoices")
          .upload(fileName, file);
        
        if (uploadError) throw uploadError;
        fileUrl = fileName;
      }

      // Get client_id from first entry (assuming all entries are for same client)
      const clientId = selectedEntries[0]?.client_id;
      
      // Create invoice
      const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          user_id: user.id,
          client_id: clientId,
          invoice_name: invoiceName || defaultInvoiceName,
          date_range_start: totals.minDate?.toISOString(),
          date_range_end: totals.maxDate?.toISOString(),
          total_amount: totals.amount,
          file_url: fileUrl,
          notes: notes || null,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Update entries to link them to the invoice
      const entryIds = selectedEntries.map(e => e.id);
      const { error: updateError } = await supabase
        .from("entries")
        .update({ invoice_id: invoiceData.id })
        .in("id", entryIds);

      if (updateError) throw updateError;

      // Refresh data
      qc.invalidateQueries({ queryKey: ["entries"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      
      toast({ 
        title: "Invoice created", 
        description: `${selectedEntries.length} entries have been invoiced for ${fmt.format(totals.amount)}`
      });
      
      setIsOpen(false);
      onClose();
      
    } catch (error: any) {
      toast({ 
        title: "Could not create invoice", 
        description: error.message 
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (selectedEntries.length === 0) return null;

  const clientName = selectedEntries[0]?.client?.name;
  const toHhMm = (s: number) => `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}`;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button className="ml-auto">
          Create Invoice ({selectedEntries.length} entries)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <div className="text-sm font-medium">Client</div>
              <div className="text-sm text-muted-foreground">{clientName}</div>
            </div>
            <div>
              <div className="text-sm font-medium">Total Amount</div>
              <div className="text-lg font-semibold">{fmt.format(totals.amount)}</div>
            </div>
            <div>
              <div className="text-sm font-medium">Total Time</div>
              <div className="text-sm text-muted-foreground">{toHhMm(totals.duration)}</div>
            </div>
            <div>
              <div className="text-sm font-medium">Entries</div>
              <div className="text-sm text-muted-foreground">{selectedEntries.length} entries</div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoice-name">Invoice Name</Label>
            <Input
              id="invoice-name"
              value={invoiceName}
              onChange={(e) => setInvoiceName(e.target.value)}
              placeholder={defaultInvoiceName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoice-file">Invoice File (PDF, Image)</Label>
            <Input
              id="invoice-file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                {file.name}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes for this invoice..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Invoice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}