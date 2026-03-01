import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useInvoiceBuilderMockData } from "./hooks";
import { formatCurrencyFromCents } from "./format";

const STEPS = [
  "1. Select Client & Matter",
  "2. Choose Unbilled Entries",
  "3. Preview Totals",
];

export default function InvoiceBuilder() {
  const { data, setSelection } = useInvoiceBuilderMockData();

  const filteredMatters = useMemo(() => {
    if (!data.selection.clientId) {
      return [];
    }
    return data.matters.filter((matter) => matter.clientId === data.selection.clientId);
  }, [data.matters, data.selection.clientId]);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice Builder</CardTitle>
        <CardDescription>Scaffolded multi-step flow for invoice creation. Ready for Supabase wiring.</CardDescription>
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
                setSelection((previous) => ({
                  ...previous,
                  clientId,
                  matterId: undefined,
                }))
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
              value={data.selection.matterId}
              onValueChange={(matterId) =>
                setSelection((previous) => ({
                  ...previous,
                  matterId,
                }))
              }
              disabled={!data.selection.clientId}
            >
              <SelectTrigger id="invoice-matter">
                <SelectValue placeholder="Select matter" />
              </SelectTrigger>
              <SelectContent>
                {filteredMatters.map((matter) => (
                  <SelectItem key={matter.id} value={matter.id}>
                    {matter.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Unbilled Entries</h3>
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
                      {entry.date} · {entry.hours.toFixed(1)} hrs @ {formatCurrencyFromCents(entry.rateCents)}/hr
                    </p>
                  </div>
                  <p className="text-sm font-medium">{formatCurrencyFromCents(entry.amountCents)}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-md bg-muted/40 p-4">
          <h3 className="text-sm font-semibold">Preview Totals</h3>
          <Separator className="my-3" />
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
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            TODO(phase2): Wire create-invoice transaction, trust accounting validation, and PDF generation.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" disabled>
              Save Draft
            </Button>
            <Button disabled>Create Invoice</Button>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
