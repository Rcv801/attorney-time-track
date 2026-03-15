import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSkeleton from "@/components/shared/LoadingSkeleton";
import { useInvoicesQuery } from "@/features/invoices/hooks";
import InvoiceStatusBadge from "@/features/invoices/InvoiceStatusBadge";
import { formatCurrencyFromCents } from "@/features/invoices/format";
import InvoiceBuilder from "@/features/invoices/InvoiceBuilder";

const Invoices = () => {
  const { data: invoices = [], isLoading, isError, error } = useInvoicesQuery();

  const hasInvoices = invoices.length > 0;

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Invoices</h1>
          <p className="mt-1 text-muted-foreground">Build, review, and track invoice payment status.</p>
        </div>
        <Button asChild>
          <Link to="/invoices/new">New Invoice</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoice List</CardTitle>
          <CardDescription>Live invoice balances, status, and receivables progress.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <EmptyState
            title="Bulk send coming soon"
            description="Email/PDF delivery actions and Stripe payment links are part of the next integration pass."
          />

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
                {invoices.map((invoice) => (
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
          ) : (
            <EmptyState
              title="No invoices yet"
              description="Generate your first invoice from unbilled entries to start tracking receivables."
            />
          )}
        </CardContent>
      </Card>

      <InvoiceBuilder />
    </div>
  );
};

export default Invoices;
