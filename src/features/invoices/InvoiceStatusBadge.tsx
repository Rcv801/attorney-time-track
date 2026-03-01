import { Badge } from "@/components/ui/badge";
import type { InvoiceStatus } from "./types";

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
}

const LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  partially_paid: "Partially Paid",
  overdue: "Overdue",
};

export default function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  if (status === "paid") {
    return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">{LABELS[status]}</Badge>;
  }

  if (status === "overdue") {
    return <Badge variant="destructive">{LABELS[status]}</Badge>;
  }

  if (status === "partially_paid") {
    return <Badge className="bg-amber-500 text-white hover:bg-amber-500">{LABELS[status]}</Badge>;
  }

  return <Badge variant="secondary">{LABELS[status]}</Badge>;
}
