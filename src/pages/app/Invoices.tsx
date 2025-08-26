import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FileText, Download, Eye, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function Invoices() {
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: invoices } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          id,
          invoice_name,
          date_range_start,
          date_range_end,
          total_amount,
          file_url,
          notes,
          created_at,
          client:clients(name)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    }
  });

  const { data: invoiceEntries } = useQuery({
    queryKey: ["invoice-entries", selectedInvoice?.id],
    queryFn: async () => {
      if (!selectedInvoice?.id) return [];
      const { data, error } = await supabase
        .from("entries")
        .select(`
          id,
          start_at,
          end_at,
          duration_sec,
          notes,
          client:clients(name,hourly_rate)
        `)
        .eq("invoice_id", selectedInvoice.id)
        .order("start_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedInvoice?.id
  });

  const onDeleteInvoice = async (invoiceId: string) => {
    // First, remove invoice_id from entries
    const { error: entriesError } = await supabase
      .from("entries")
      .update({ invoice_id: null })
      .eq("invoice_id", invoiceId);
    
    if (entriesError) {
      toast({ title: "Could not unlink entries", description: entriesError.message });
      return;
    }

    // Then delete the invoice
    const { error } = await supabase
      .from("invoices")
      .delete()
      .eq("id", invoiceId);
    
    if (error) {
      toast({ title: "Could not delete invoice", description: error.message });
    } else {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["entries"] });
      toast({ title: "Invoice deleted and entries unlinked" });
      setSelectedInvoice(null);
    }
  };

  const downloadFile = async (fileUrl: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("invoices")
        .download(fileUrl);
      
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: "Could not download file", description: "Please try again." });
    }
  };

  const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });
  const toHhMm = (s: number) => `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}`;

  return (
    <div className="space-y-6">
      <SEO title="Invoices – Time App" description="Manage invoices and associated time entries." canonical={window.location.href} />
      
      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {invoices?.length === 0 && (
            <p className="text-muted-foreground text-center py-8">
              No invoices yet. Create an invoice from the Entries page.
            </p>
          )}
          
          {invoices?.map((invoice) => (
            <div key={invoice.id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium">{invoice.invoice_name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {invoice.client?.name} • {new Date(invoice.date_range_start).toLocaleDateString()} - {new Date(invoice.date_range_end).toLocaleDateString()}
                  </p>
                  <p className="text-lg font-semibold mt-1">{fmt.format(Number(invoice.total_amount))}</p>
                  {invoice.notes && (
                    <p className="text-sm text-muted-foreground mt-2">{invoice.notes}</p>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedInvoice(invoice)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{invoice.invoice_name}</DialogTitle>
                      </DialogHeader>
                      
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <strong>Client:</strong> {invoice.client?.name}
                          </div>
                          <div>
                            <strong>Total:</strong> {fmt.format(Number(invoice.total_amount))}
                          </div>
                          <div>
                            <strong>Period:</strong> {new Date(invoice.date_range_start).toLocaleDateString()} - {new Date(invoice.date_range_end).toLocaleDateString()}
                          </div>
                          <div>
                            <strong>Created:</strong> {new Date(invoice.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        
                        {invoice.notes && (
                          <div>
                            <strong>Notes:</strong>
                            <p className="text-muted-foreground">{invoice.notes}</p>
                          </div>
                        )}
                        
                        <div>
                          <h4 className="font-medium mb-2">Associated Time Entries</h4>
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {invoiceEntries?.map((entry) => (
                              <div key={entry.id} className="border rounded p-2 text-sm">
                                <div className="grid grid-cols-3 gap-2">
                                  <div>{new Date(entry.start_at).toLocaleDateString()}</div>
                                  <div>{entry.duration_sec ? toHhMm(entry.duration_sec) : "–"}</div>
                                  <div>{fmt.format((entry.duration_sec || 0) / 3600 * Number(entry.client?.hourly_rate || 0))}</div>
                                </div>
                                {entry.notes && (
                                  <p className="text-muted-foreground mt-1">{entry.notes}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  {invoice.file_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadFile(invoice.file_url, `${invoice.invoice_name}.pdf`)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  )}
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Invoice?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will delete the invoice and unlink all associated time entries. 
                          The time entries will remain but will no longer be marked as invoiced.
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDeleteInvoice(invoice.id)}>
                          Delete Invoice
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              
              {invoice.file_url && (
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>Invoice file attached</span>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}