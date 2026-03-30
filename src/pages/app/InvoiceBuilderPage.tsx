import { Link } from "react-router-dom";
import InvoiceBuilder from "@/features/invoices/InvoiceBuilder";

const InvoiceBuilderPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-600">
          <Link to="/invoices" className="hover:underline hover:text-slate-700">
            Invoices
          </Link>{" "}
          / New Invoice
        </p>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">New Invoice</h1>
        <p className="mt-1 text-slate-600">
          Select unbilled time and expenses, review the live totals, and create a draft invoice for payment collection.
        </p>
      </div>

      <InvoiceBuilder />
    </div>
  );
};

export default InvoiceBuilderPage;
