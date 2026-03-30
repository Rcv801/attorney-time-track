import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subMonths,
  subQuarters,
  subYears,
} from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Calendar as CalendarIcon, PieChart as PieChartIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSkeleton from "@/components/shared/LoadingSkeleton";
import { cn } from "@/lib/utils";
import { calculateBillingAmount, getEffectiveRate, roundToSixMinutes } from "@/lib/billing";

type PeriodPreset =
  | "this_week"
  | "this_month"
  | "this_quarter"
  | "this_year"
  | "last_month"
  | "last_quarter"
  | "last_year"
  | "custom";

type ClientOption = {
  id: string;
  name: string;
};

type MatterOption = {
  id: string;
  client_id: string;
  name: string;
};

type EntryRow = {
  id: string;
  start_at: string;
  end_at: string | null;
  total_paused_seconds: number | null;
  notes: string | null;
  invoice_id: string | null;
  client_id: string;
  matter_id: string | null;
  client: { id: string; name: string; hourly_rate: number | null } | null;
  matter: { id: string; name: string; hourly_rate: number | null } | null;
};

type InvoiceSummaryRow = {
  id: string;
  client_id: string | null;
  client_name: string | null;
  matter_id: string | null;
  matter_name: string | null;
  issued_date: string | null;
  total: number | null;
  balance_due: number | null;
  status: string | null;
  invoice_number: string | null;
};

type PaymentRow = {
  id: string;
  amount: number | null;
  payment_date: string;
  status: string;
  invoice: { client_id: string | null; matter_id: string | null } | null;
};

type ReportPayload = {
  clients: ClientOption[];
  matters: MatterOption[];
  summary: {
    hours: number;
    billed: number;
    collected: number;
    outstanding: number;
  };
  previousSummary: {
    hours: number;
    billed: number;
    collected: number;
    outstanding: number;
  };
  revenueSeries: Array<{ month: string; billed: number; collected: number }>;
  hoursByMatter: Array<{ id: string; name: string; hours: number }>;
  hoursByClient: Array<{ id: string; name: string; hours: number; value: number }>;
  arAging: Array<{ bucket: string; total: number; count: number; tone: string }>;
  csvRows: Array<{
    date: string;
    client: string;
    matter: string;
    description: string;
    hours: number;
    rate: number;
    amount: number;
    invoiceNumber: string;
    status: string;
  }>;
};

const PERIOD_OPTIONS: Array<{ value: PeriodPreset; label: string }> = [
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "this_year", label: "This Year" },
  { value: "last_month", label: "Last Month" },
  { value: "last_quarter", label: "Last Quarter" },
  { value: "last_year", label: "Last Year" },
  { value: "custom", label: "Custom Range" },
];

const PIE_COLORS = ["#0f766e", "#f59e0b", "#2563eb", "#dc2626", "#7c3aed", "#0891b2"];

function getPeriodRange(period: PeriodPreset, customRange: DateRange | undefined) {
  const now = new Date();

  switch (period) {
    case "this_week":
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case "this_month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "this_quarter":
      return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case "this_year":
      return { start: startOfYear(now), end: endOfYear(now) };
    case "last_month": {
      const reference = subMonths(now, 1);
      return { start: startOfMonth(reference), end: endOfMonth(reference) };
    }
    case "last_quarter": {
      const reference = subQuarters(now, 1);
      return { start: startOfQuarter(reference), end: endOfQuarter(reference) };
    }
    case "last_year": {
      const reference = subYears(now, 1);
      return { start: startOfYear(reference), end: endOfYear(reference) };
    }
    case "custom":
      if (customRange?.from) {
        return {
          start: startOfDay(customRange.from),
          end: endOfDay(customRange.to ?? customRange.from),
        };
      }
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

function getPreviousRange(start: Date, end: Date) {
  const length = differenceInCalendarDays(endOfDay(end), startOfDay(start)) + 1;
  const previousEnd = addDays(startOfDay(start), -1);
  const previousStart = addDays(previousEnd, -(length - 1));
  return { start: startOfDay(previousStart), end: endOfDay(previousEnd) };
}

function getEntrySeconds(entry: EntryRow) {
  if (entry.end_at) {
    const rawSeconds = Math.max(
      (new Date(entry.end_at).getTime() - new Date(entry.start_at).getTime()) / 1000 - (entry.total_paused_seconds ?? 0),
      0,
    );
    return rawSeconds;
  }

  return 0;
}

function toCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function toCurrencyPrecise(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function toHours(hours: number) {
  return `${hours.toFixed(1)} hr`;
}

function toTrend(current: number, previous: number) {
  if (previous === 0) {
    if (current === 0) {
      return "0%";
    }
    return "+100%";
  }

  const change = ((current - previous) / previous) * 100;
  const prefix = change > 0 ? "+" : "";
  return `${prefix}${change.toFixed(0)}%`;
}

function downloadCsv(filename: string, rows: ReportPayload["csvRows"]) {
  const header = ["Date", "Client", "Matter", "Description", "Hours", "Rate", "Amount", "Invoice #", "Status"];
  const csv = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.date,
        row.client,
        row.matter,
        row.description,
        row.hours.toFixed(1),
        row.rate.toFixed(2),
        row.amount.toFixed(2),
        row.invoiceNumber,
        row.status,
      ]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(","),
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const Reports = () => {
  const [period, setPeriod] = useState<PeriodPreset>("this_month");
  const [clientId, setClientId] = useState<string>("all");
  const [matterId, setMatterId] = useState<string>("all");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();

  const activeRange = useMemo(() => getPeriodRange(period, customRange), [customRange, period]);
  const previousRange = useMemo(() => getPreviousRange(activeRange.start, activeRange.end), [activeRange.end, activeRange.start]);
  const chartRange = useMemo(() => ({ start: startOfMonth(subMonths(new Date(), 5)), end: endOfMonth(new Date()) }), []);
  const broadStart = activeRange.start < previousRange.start
    ? (activeRange.start < chartRange.start ? activeRange.start : chartRange.start)
    : (previousRange.start < chartRange.start ? previousRange.start : chartRange.start);

  const filterQuery = useQuery({
    queryKey: ["report-filters"],
    queryFn: async () => {
      const [{ data: clients, error: clientsError }, { data: matters, error: mattersError }] = await Promise.all([
        supabase.from("clients").select("id, name").eq("archived", false).order("name"),
        supabase.from("matters").select("id, client_id, name").eq("status", "active").order("name"),
      ]);

      if (clientsError) {
        throw clientsError;
      }

      if (mattersError) {
        throw mattersError;
      }

      return {
        clients: (clients ?? []) as ClientOption[],
        matters: (matters ?? []) as MatterOption[],
      };
    },
  });

  const reportQuery = useQuery<ReportPayload>({
    queryKey: [
      "reports",
      period,
      clientId,
      matterId,
      activeRange.start.toISOString(),
      activeRange.end.toISOString(),
    ],
    queryFn: async () => {
      const applyEntryFilters = (query: ReturnType<typeof supabase.from>) => {
        let next = query
          .from("entries")
          .select("id, start_at, end_at, total_paused_seconds, notes, invoice_id, client_id, matter_id, client:clients(id, name, hourly_rate), matter:matters(id, name, hourly_rate)")
          .eq("archived", false)
          .gte("start_at", broadStart.toISOString())
          .lte("start_at", activeRange.end.toISOString());

        if (clientId !== "all") {
          next = next.eq("client_id", clientId);
        }
        if (matterId !== "all") {
          next = next.eq("matter_id", matterId);
        }
        return next;
      };

      const applyInvoiceFilters = (query: ReturnType<typeof supabase.from>) => {
        let next = query.from("invoice_summary").select("id, client_id, client_name, matter_id, matter_name, issued_date, total, balance_due, status, invoice_number");
        if (clientId !== "all") {
          next = next.eq("client_id", clientId);
        }
        if (matterId !== "all") {
          next = next.eq("matter_id", matterId);
        }
        return next;
      };

      const applyPaymentFilters = (query: ReturnType<typeof supabase.from>) => {
        let next = query
          .from("payments")
          .select("id, amount, payment_date, status, invoice:invoices!inner(client_id, matter_id)")
          .gte("payment_date", format(broadStart, "yyyy-MM-dd"))
          .lte("payment_date", format(activeRange.end, "yyyy-MM-dd"));

        if (clientId !== "all") {
          next = next.eq("invoice.client_id", clientId);
        }
        if (matterId !== "all") {
          next = next.eq("invoice.matter_id", matterId);
        }
        return next;
      };

      const [entriesResult, invoicesResult, openInvoicesResult, paymentsResult] = await Promise.all([
        applyEntryFilters(supabase).order("start_at", { ascending: false }),
        applyInvoiceFilters(supabase)
          .gte("issued_date", format(broadStart, "yyyy-MM-dd"))
          .lte("issued_date", format(activeRange.end, "yyyy-MM-dd"))
          .order("issued_date", { ascending: true }),
        applyInvoiceFilters(supabase)
          .not("status", "in", "(paid,void,draft,written_off)")
          .gt("balance_due", 0),
        applyPaymentFilters(supabase).order("payment_date", { ascending: true }),
      ]);

      if (entriesResult.error) {
        throw entriesResult.error;
      }
      if (invoicesResult.error) {
        throw invoicesResult.error;
      }
      if (openInvoicesResult.error) {
        throw openInvoicesResult.error;
      }
      if (paymentsResult.error) {
        throw paymentsResult.error;
      }

      const entries = (entriesResult.data ?? []) as unknown as EntryRow[];
      const invoices = (invoicesResult.data ?? []) as unknown as InvoiceSummaryRow[];
      const openInvoices = (openInvoicesResult.data ?? []) as unknown as InvoiceSummaryRow[];
      const payments = (paymentsResult.data ?? []) as unknown as PaymentRow[];

      const currentEntries = entries.filter((entry) =>
        isWithinInterval(new Date(entry.start_at), { start: activeRange.start, end: activeRange.end }),
      );
      const previousEntries = entries.filter((entry) =>
        isWithinInterval(new Date(entry.start_at), { start: previousRange.start, end: previousRange.end }),
      );
      const currentInvoices = invoices.filter((invoice) => {
        if (!invoice.issued_date) return false;
        return isWithinInterval(new Date(`${invoice.issued_date}T00:00:00`), { start: activeRange.start, end: activeRange.end });
      });
      const previousInvoices = invoices.filter((invoice) => {
        if (!invoice.issued_date) return false;
        return isWithinInterval(new Date(`${invoice.issued_date}T00:00:00`), { start: previousRange.start, end: previousRange.end });
      });
      const currentPayments = payments.filter((payment) =>
        isWithinInterval(new Date(`${payment.payment_date}T00:00:00`), { start: activeRange.start, end: activeRange.end }),
      );
      const previousPayments = payments.filter((payment) =>
        isWithinInterval(new Date(`${payment.payment_date}T00:00:00`), { start: previousRange.start, end: previousRange.end }),
      );

      const summarizeEntries = (rows: EntryRow[]) =>
        rows.reduce((sum, entry) => sum + roundToSixMinutes(getEntrySeconds(entry)), 0);

      const summarizeInvoices = (rows: InvoiceSummaryRow[]) =>
        rows.filter((invoice) => invoice.status !== "void").reduce((sum, invoice) => sum + (invoice.total ?? 0), 0);

      const summarizeOutstanding = (rows: InvoiceSummaryRow[]) =>
        rows
          .filter((invoice) => !["void", "draft", "written_off"].includes(invoice.status ?? ""))
          .reduce((sum, invoice) => sum + (invoice.balance_due ?? 0), 0);

      const summarizePayments = (rows: PaymentRow[]) =>
        rows.filter((payment) => payment.status === "completed").reduce((sum, payment) => sum + (payment.amount ?? 0), 0);

      const hoursByMatterMap = new Map<string, { id: string; name: string; hours: number }>();
      const hoursByClientMap = new Map<string, { id: string; name: string; hours: number; value: number }>();

      const csvRows = currentEntries.map((entry) => {
        const seconds = getEntrySeconds(entry);
        const hours = roundToSixMinutes(seconds);
        const rate = getEffectiveRate(entry.matter?.hourly_rate, entry.client?.hourly_rate ?? 0);
        const amount = calculateBillingAmount(seconds, rate);

        if (entry.matter?.id) {
          const existingMatter = hoursByMatterMap.get(entry.matter.id) ?? { id: entry.matter.id, name: entry.matter.name, hours: 0 };
          existingMatter.hours += hours;
          hoursByMatterMap.set(entry.matter.id, existingMatter);
        }

        if (entry.client?.id) {
          const existingClient =
            hoursByClientMap.get(entry.client.id) ?? { id: entry.client.id, name: entry.client.name, hours: 0, value: 0 };
          existingClient.hours += hours;
          existingClient.value += amount;
          hoursByClientMap.set(entry.client.id, existingClient);
        }

        const invoice = currentInvoices.find((candidate) => candidate.id === entry.invoice_id);

        return {
          date: format(new Date(entry.start_at), "yyyy-MM-dd"),
          client: entry.client?.name ?? "Unknown Client",
          matter: entry.matter?.name ?? "General",
          description: entry.notes?.trim() || "No description",
          hours,
          rate,
          amount,
          invoiceNumber: invoice?.invoice_number ?? "Unbilled",
          status: invoice?.status ?? "unbilled",
        };
      });

      const revenueSeries = Array.from({ length: 6 }).map((_, index) => {
        const monthDate = startOfMonth(subMonths(new Date(), 5 - index));
        const monthKey = format(monthDate, "yyyy-MM");

        const billed = invoices
          .filter((invoice) => invoice.issued_date?.startsWith(monthKey) && invoice.status !== "void")
          .reduce((sum, invoice) => sum + (invoice.total ?? 0), 0);
        const collected = payments
          .filter((payment) => payment.payment_date.startsWith(monthKey) && payment.status === "completed")
          .reduce((sum, payment) => sum + (payment.amount ?? 0), 0);

        return {
          month: format(monthDate, "MMM"),
          billed,
          collected,
        };
      });

      const arAgingBuckets = [
        { bucket: "Current", min: 0, max: 30, tone: "text-emerald-600" },
        { bucket: "31-60", min: 31, max: 60, tone: "text-amber-500" },
        { bucket: "61-90", min: 61, max: 90, tone: "text-orange-500" },
        { bucket: "90+", min: 91, max: Number.POSITIVE_INFINITY, tone: "text-red-600" },
      ];

      const arAging = arAgingBuckets.map((bucket) => {
        const bucketInvoices = openInvoices.filter((invoice) => {
          if (!invoice.issued_date) {
            return false;
          }
          const age = differenceInCalendarDays(new Date(), new Date(`${invoice.issued_date}T00:00:00`));
          return age >= bucket.min && age <= bucket.max;
        });

        return {
          bucket: bucket.bucket,
          total: bucketInvoices.reduce((sum, invoice) => sum + (invoice.balance_due ?? 0), 0),
          count: bucketInvoices.length,
          tone: bucket.tone,
        };
      });

      return {
        clients: filterQuery.data?.clients ?? [],
        matters: filterQuery.data?.matters ?? [],
        summary: {
          hours: summarizeEntries(currentEntries),
          billed: summarizeInvoices(currentInvoices),
          collected: summarizePayments(currentPayments),
          outstanding: summarizeOutstanding(openInvoices),
        },
        previousSummary: {
          hours: summarizeEntries(previousEntries),
          billed: summarizeInvoices(previousInvoices),
          collected: summarizePayments(previousPayments),
          outstanding: summarizeOutstanding(openInvoices),
        },
        revenueSeries,
        hoursByMatter: Array.from(hoursByMatterMap.values()).sort((a, b) => b.hours - a.hours).slice(0, 10),
        hoursByClient: Array.from(hoursByClientMap.values()).sort((a, b) => b.hours - a.hours).slice(0, 6),
        arAging,
        csvRows,
      };
    },
    enabled: filterQuery.isSuccess,
  });

  const visibleMatters = useMemo(() => {
    const allMatters = filterQuery.data?.matters ?? [];
    if (clientId === "all") {
      return allMatters;
    }
    return allMatters.filter((matter) => matter.client_id === clientId);
  }, [clientId, filterQuery.data?.matters]);

  if (filterQuery.isLoading || reportQuery.isLoading) {
    return <LoadingSkeleton />;
  }

  if (filterQuery.isError || reportQuery.isError || !reportQuery.data) {
    return (
      <EmptyState
        title="Could not load reports"
        description={
          filterQuery.error instanceof Error
            ? filterQuery.error.message
            : reportQuery.error instanceof Error
              ? reportQuery.error.message
              : "Refresh and try again."
        }
        icon={<PieChartIcon className="h-12 w-12" />}
      />
    );
  }

  const { summary, previousSummary, revenueSeries, hoursByMatter, hoursByClient, arAging, csvRows } = reportQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="section-title mb-1.5">Analytics</p>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Tight billing visibility for hours, revenue, and receivables.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => downloadCsv(`sixmin-report-${period}.csv`, csvRows)}
          disabled={csvRows.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Card className="premium-card rounded-xl border border-slate-200 shadow-md">
        <CardContent className="grid gap-3 p-6 md:grid-cols-2 xl:grid-cols-[220px_220px_220px_1fr]">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-900">Period</p>
            <Select value={period} onValueChange={(value: PeriodPreset) => setPeriod(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-900">Client</p>
            <Select
              value={clientId}
              onValueChange={(value) => {
                setClientId(value);
                setMatterId("all");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {filterQuery.data.clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-900">Matter</p>
            <Select value={matterId} onValueChange={setMatterId}>
              <SelectTrigger>
                <SelectValue placeholder="All matters" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All matters</SelectItem>
                {visibleMatters.map((matter) => (
                  <SelectItem key={matter.id} value={matter.id}>
                    {matter.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-900">Range</p>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", period !== "custom" && "opacity-70")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(activeRange.start, "LLL d, y")} - {format(activeRange.end, "LLL d, y")}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-0">
                <Calendar
                  mode="range"
                  selected={customRange}
                  onSelect={(range) => {
                    setPeriod("custom");
                    setCustomRange(range);
                  }}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Hours Tracked" value={toHours(summary.hours)} trend={toTrend(summary.hours, previousSummary.hours)} />
        <SummaryCard title="Billed" value={toCurrency(summary.billed)} trend={toTrend(summary.billed, previousSummary.billed)} />
        <SummaryCard title="Collected" value={toCurrency(summary.collected)} trend={toTrend(summary.collected, previousSummary.collected)} />
        <SummaryCard title="Outstanding" value={toCurrency(summary.outstanding)} trend={toTrend(summary.outstanding, previousSummary.outstanding)} />
      </div>

      {csvRows.length === 0 ? (
        <EmptyState
          title="No data for this period"
          description="Track time or generate invoices in the selected range to unlock reporting."
          icon={<PieChartIcon className="h-12 w-12" />}
        />
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
            <Card className="premium-card rounded-xl border border-slate-200 shadow-md">
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="font-bold text-slate-900">Revenue by Month</CardTitle>
                <CardDescription className="text-slate-600">Billed versus collected for the last six months.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueSeries}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" />
                      <YAxis tickFormatter={(value) => `$${Math.round(value / 1000)}k`} />
                      <RechartsTooltip formatter={(value: number) => toCurrencyPrecise(Number(value))} />
                      <Bar dataKey="billed" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="collected" fill="#0f766e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="premium-card rounded-xl border border-slate-200 shadow-md">
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="font-bold text-slate-900">AR Aging</CardTitle>
                <CardDescription className="text-slate-600">Open invoice balances grouped by issue age.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bucket</TableHead>
                      <TableHead>Invoices</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {arAging.map((row) => (
                      <TableRow key={row.bucket}>
                        <TableCell className={cn("font-medium", row.tone)}>{row.bucket}</TableCell>
                        <TableCell>{row.count}</TableCell>
                        <TableCell className="text-right">{toCurrencyPrecise(row.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="premium-card rounded-xl border border-slate-200 shadow-md">
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="font-bold text-slate-900">Hours by Matter</CardTitle>
                <CardDescription className="text-slate-600">Top matters by billable time in the current range.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hoursByMatter} layout="vertical" margin={{ left: 16, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={(value) => `${value}h`} />
                      <YAxis type="category" dataKey="name" width={120} tickLine={false} axisLine={false} />
                      <RechartsTooltip formatter={(value: number) => toHours(Number(value))} />
                      <Bar dataKey="hours" fill="#0f766e" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="premium-card rounded-xl border border-slate-200 shadow-md">
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="font-bold text-slate-900">Hours by Client</CardTitle>
                <CardDescription className="text-slate-600">Where tracked time was spent in the selected range.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 lg:grid-cols-[240px_1fr] lg:items-center">
                <div className="mx-auto h-[220px] w-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={hoursByClient} dataKey="hours" nameKey="name" innerRadius={52} outerRadius={88} paddingAngle={2}>
                        {hoursByClient.map((slice, index) => (
                          <Cell key={slice.id} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(value: number) => toHours(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  {hoursByClient.map((client, index) => (
                    <div key={client.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/40 hover:bg-slate-100/60 hover:border-slate-300 hover:shadow-sm p-3 transition-colors">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{client.name}</p>
                          <p className="text-sm text-slate-600">{toCurrencyPrecise(client.value)}</p>
                        </div>
                      </div>
                      <p className="font-mono text-sm text-slate-900">{toHours(client.hours)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

function SummaryCard({ title, value, trend }: { title: string; value: string; trend: string }) {
  const positive = trend.startsWith("+");
  const neutral = trend === "0%";

  return (
    <Card className="premium-card rounded-xl border border-slate-200 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
        <p className={cn("mt-2 text-sm", neutral ? "text-slate-600" : positive ? "text-emerald-600" : "text-red-600")}>
          {trend} vs prior period
        </p>
      </CardContent>
    </Card>
  );
}

export default Reports;
