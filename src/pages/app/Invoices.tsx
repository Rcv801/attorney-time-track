import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSkeleton from "@/components/shared/LoadingSkeleton";
import { useInvoicesQuery } from "@/features/invoices/hooks";
import InvoiceStatusBadge from "@/features/invoices/InvoiceStatusBadge";
import { formatCurrencyFromCents } from "@/features/invoices/format";
import type { InvoiceStatus } from "@/features/invoices/types";

const STATUS_OPTIONS: Array<{ value: "all" | InvoiceStatus; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "viewed", label: "Viewed" },
  { value: "partial", label: "Partial" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
  { value: "written_off", label: "Written off" },
];

const Invoices = () => {
  const { data: invoices = [], isLoading, isError, error } = useInvoicesQuery();
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | InvoiceStatus>("all");
  const [collectibleOnly, setCollectibleOnly] = useState(false);

  const hasInvoices = invoices.length > 0;
  const filteredInvoices = useMemo(() => {
    const normalizedQuery = searchValue.trim().toLowerCase();

    return invoices.filter((invoice) => {
      if (statusFilter !== "all" && invoice.status !== statusFilter) {
        return false;
      }

      if (collectibleOnly && invoice.balanceDueCents <= 0) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [invoice.invoiceNumber, invoice.clientName, invoice.matterName, invoice.status]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [collectibleOnly, invoices, searchValue, statusFilter]);

  const collectibleTotalCents = filteredInvoices.reduce((sum, invoice) => sum + invoice.balanceDueCents, 0);
  const overdueCount = filteredInvoices.filter((invoice) => invoice.status === "overdue").length;

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">Invoices</h1>
          <p className="mt-1 text-slate-600">Build, review, and track invoice payment status.</p>
        </div>
        <Button asChild>
          <Link to="/invoices/new">New Invoice</Link>
        </Button>
      </div>

      <Card className="premium-card rounded-xl border border-slate-200 shadow-md">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="font-bold text-slate-900">Invoice List</CardTitle>
          <CardDescription className="text-slate-600">Live invoice balances, status, and receivables progress.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_220px] xl:grid-cols-[minmax(0,2fr)_220px_auto]">
            <div className="space-y-2">
              <Label htmlFor="invoice-search">Search invoices</Label>
              <Input
                id="invoice-search"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Invoice number, client, matter, or status"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={(value: "all" | InvoiceStatus) => setStatusFilter(value)}>
                <SelectTrigger id="invoice-status-filter">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-3 rounded-md border px-4 py-3">
              <Checkbox checked={collectibleOnly} onCheckedChange={(checked) => setCollectibleOnly(checked === true)} />
              <div>
                <p className="text-sm font-medium">Collectible only</p>
                <p className="text-xs text-slate-600">Hide paid, void, and zero-balance invoices.</p>
              </div>
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-sm text-slate-600">Visible invoices</p>
              <p className="text-2xl font-semibold text-slate-900">{filteredInvoices.length}</p>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-sm text-slate-600">Outstanding in view</p>
              <p className="text-2xl font-semibold text-slate-900">{formatCurrencyFromCents(collectibleTotalCents)}</p>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-sm text-slate-600">Overdue in view</p>
              <p className="text-2xl font-semibold text-slate-900">{overdueCount}</p>
            </div>
          </div>

          {isError ? (
            <EmptyState
              title="Could not load invoices"
              description={error instanceof Error ? error.message : "Refresh and try again."}
            />
          ) : hasInvoices ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Matter</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      <Link to={`/invoices/${invoice.id}`} className="hover:underline">
                        {invoice.invoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{invoice.clientName}</TableCell>
                    <TableCell>{invoice.matterName}</TableCell>
                    <TableCell>
                      <InvoiceStatusBadge status={invoice.status} />
                    </TableCell>
                    <TableCell>{invoice.dueDate}</TableCell>
                    <TableCell className="text-right">{formatCurrencyFromCents(invoice.balanceDueCents)}</TableCell>
                    <TableCell className="text-right">{formatCurrencyFromCents(invoice.totalAmountCents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}

          {!isError && hasInvoices && filteredInvoices.length === 0 ? (
            <EmptyState
              title="No invoices match these filters"
              description="Adjust the search, status, or collectible toggle to expand the list."
            />
          ) : (
            !isError &&
            !hasInvoices && (
              <EmptyState
                title="No invoices yet"
                description="Generate your first invoice from unbilled entries to start tracking receivables."
              />
            )
          )}
        </CardContent>
      </Card>

    </div>
  );
};

export default Invoices;
