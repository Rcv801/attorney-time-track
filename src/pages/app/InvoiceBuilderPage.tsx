import { Link } from "react-router-dom";
import InvoiceBuilder from "@/features/invoices/InvoiceBuilder";

const InvoiceBuilderPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link to="/invoices" className="hover:underline">
            Invoices
          </Link>{" "}
          / New Invoice
        </p>
        <h1 className="text-3xl font-bold">New Invoice</h1>
        <p className="mt-1 text-muted-foreground">Scaffolded flow for selecting unbilled entries and previewing totals.</p>
      </div>

      <InvoiceBuilder />
    </div>
  );
};

export default InvoiceBuilderPage;
