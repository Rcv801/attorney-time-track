import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Download, Printer, Clock, DollarSign, TrendingUp, AlertCircle } from "lucide-react";
import SEO from "@/components/SEO";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from "date-fns";
import {
  roundToSixMinutes,
  formatBillableHours,
  getEffectiveRate,
} from "@/lib/billing";
import { startOfLocalDayUtc, endOfLocalDayUtc, getUserTimeZone } from "@/lib/dates";
import type { Tables } from "@/integrations/supabase/types";

type Matter = Tables<"matters"> & { client: Tables<"clients"> };
type Entry = Tables<"entries"> & { matter: Matter | null };

type QuickRange = "this-week" | "last-week" | "this-month" | "last-month" | "last-30" | "last-90" | "custom";

function getQuickRange(range: QuickRange): { from: string; to: string } {
  const now = new Date();
  switch (range) {
    case "this-week":
      return { from: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
    case "last-week": {
      const lastWeek = subDays(startOfWeek(now, { weekStartsOn: 1 }), 7);
      return { from: format(lastWeek, "yyyy-MM-dd"), to: format(endOfWeek(lastWeek, { weekStartsOn: 1 }), "yyyy-MM-dd") };
    }
    case "this-month":
      return { from: format(startOfMonth(now), "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
    case "last-month": {
      const lm = subMonths(now, 1);
      return { from: format(startOfMonth(lm), "yyyy-MM-dd"), to: format(endOfMonth(lm), "yyyy-MM-dd") };
    }
    case "last-30":
      return { from: format(subDays(now, 30), "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
    case "last-90":
      return { from: format(subDays(now, 90), "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
    default:
      return { from: format(subDays(now, 7), "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
  }
}

type GroupBy = "client" | "matter" | "date";

export default function Reports() {
  const [quickRange, setQuickRange] = useState<QuickRange>("this-month");
  const [customFrom, setCustomFrom] = useState<string>(() => format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [customTo, setCustomTo] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
  const [groupBy, setGroupBy] = useState<GroupBy>("client");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const { from, to } = quickRange === "custom"
    ? { from: customFrom, to: customTo }
    : getQuickRange(quickRange);

  const tz = getUserTimeZone();
  const fmt = useMemo(() => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }), []);

  // Fetch entries with matter + client
  const { data: entries, isLoading } = useQuery({
    queryKey: ["report-entries", from, to],
    queryFn: async () => {
      const fromDate = startOfLocalDayUtc(new Date(from));
      const toDate = endOfLocalDayUtc(new Date(to));
      const { data, error } = await supabase
        .from("entries")
        .select("*, matter:matters(*, client:clients(*))")
        .gte("start_at", fromDate.toISOString())
        .lte("start_at", toDate.toISOString())
        .eq("archived", false)
        .order("start_at", { ascending: false });
      if (error) throw error;
      return data as Entry[];
    },
  });

  // Compute stats
  const stats = useMemo(() => {
    if (!entries?.length) return { totalSeconds: 0, totalBillableHours: 0, totalAmount: 0, unbilledAmount: 0, invoicedAmount: 0, entryCount: 0, matterCount: 0, avgDailyHours: 0 };

    let totalSeconds = 0;
    let totalAmount = 0;
    let unbilledAmount = 0;
    let invoicedAmount = 0;
    const matters = new Set<string>();
    const days = new Set<string>();

    entries.forEach((e) => {
      const sec = e.duration_sec ?? 0;
      totalSeconds += sec;
      const billable = roundToSixMinutes(sec);
      const rate = getEffectiveRate(e.matter?.hourly_rate, e.matter?.client?.hourly_rate ?? 0);
      const amt = billable * rate;
      totalAmount += amt;
      if (e.invoice_id) {
        invoicedAmount += amt;
      } else {
        unbilledAmount += amt;
      }
      if (e.matter_id) matters.add(e.matter_id);
      days.add(format(new Date(e.start_at), "yyyy-MM-dd"));
    });

    const totalBillableHours = roundToSixMinutes(totalSeconds);
    const avgDailyHours = days.size > 0 ? totalBillableHours / days.size : 0;

    return { totalSeconds, totalBillableHours, totalAmount, unbilledAmount, invoicedAmount, entryCount: entries.length, matterCount: matters.size, avgDailyHours };
  }, [entries]);

  // Group data
  const grouped = useMemo(() => {
    if (!entries?.length) return [];

    type GroupRow = {
      key: string;
      label: string;
      sublabel?: string;
      color?: string;
      seconds: number;
      billableHours: number;
      amount: number;
      unbilledAmount: number;
      entryCount: number;
      children?: GroupRow[];
    };

    if (groupBy === "client") {
      const byClient = new Map<string, { label: string; color: string; matters: Map<string, GroupRow>; seconds: number; amount: number; unbilledAmount: number; entryCount: number }>();

      entries.forEach((e) => {
        const clientName = e.matter?.client?.name ?? "Unknown";
        const clientColor = e.matter?.client?.color ?? "#9ca3af";
        const matterName = e.matter?.name ?? "No Matter";
        const matterKey = e.matter_id ?? "none";
        const sec = e.duration_sec ?? 0;
        const billable = roundToSixMinutes(sec);
        const rate = getEffectiveRate(e.matter?.hourly_rate, e.matter?.client?.hourly_rate ?? 0);
        const amt = billable * rate;
        const isUnbilled = !e.invoice_id;

        let client = byClient.get(clientName);
        if (!client) {
          client = { label: clientName, color: clientColor, matters: new Map(), seconds: 0, amount: 0, unbilledAmount: 0, entryCount: 0 };
          byClient.set(clientName, client);
        }
        client.seconds += sec;
        client.amount += amt;
        if (isUnbilled) client.unbilledAmount += amt;
        client.entryCount++;

        let matter = client.matters.get(matterKey);
        if (!matter) {
          matter = { key: matterKey, label: matterName, seconds: 0, billableHours: 0, amount: 0, unbilledAmount: 0, entryCount: 0 };
          client.matters.set(matterKey, matter);
        }
        matter.seconds += sec;
        matter.amount += amt;
        if (isUnbilled) matter.unbilledAmount += amt;
        matter.entryCount++;
      });

      return Array.from(byClient.values())
        .map((c) => ({
          key: c.label,
          label: c.label,
          color: c.color,
          seconds: c.seconds,
          billableHours: roundToSixMinutes(c.seconds),
          amount: c.amount,
          unbilledAmount: c.unbilledAmount,
          entryCount: c.entryCount,
          children: Array.from(c.matters.values())
            .map((m) => ({ ...m, billableHours: roundToSixMinutes(m.seconds) }))
            .sort((a, b) => b.amount - a.amount),
        }))
        .sort((a, b) => b.amount - a.amount);
    }

    if (groupBy === "matter") {
      const byMatter = new Map<string, GroupRow & { sublabel: string; color: string }>();
      entries.forEach((e) => {
        const matterKey = e.matter_id ?? "none";
        const matterName = e.matter?.name ?? "No Matter";
        const clientName = e.matter?.client?.name ?? "Unknown";
        const clientColor = e.matter?.client?.color ?? "#9ca3af";
        const sec = e.duration_sec ?? 0;
        const billable = roundToSixMinutes(sec);
        const rate = getEffectiveRate(e.matter?.hourly_rate, e.matter?.client?.hourly_rate ?? 0);
        const amt = billable * rate;
        const isUnbilled = !e.invoice_id;

        let matter = byMatter.get(matterKey);
        if (!matter) {
          matter = { key: matterKey, label: matterName, sublabel: clientName, color: clientColor, seconds: 0, billableHours: 0, amount: 0, unbilledAmount: 0, entryCount: 0 };
          byMatter.set(matterKey, matter);
        }
        matter.seconds += sec;
        matter.amount += amt;
        if (isUnbilled) matter.unbilledAmount += amt;
        matter.entryCount++;
      });

      return Array.from(byMatter.values())
        .map((m) => ({ ...m, billableHours: roundToSixMinutes(m.seconds) }))
        .sort((a, b) => b.amount - a.amount);
    }

    // Group by date
    const byDate = new Map<string, GroupRow>();
    entries.forEach((e) => {
      const dateKey = format(new Date(e.start_at), "yyyy-MM-dd");
      const dateLabel = format(new Date(e.start_at), "EEE, MMM d, yyyy");
      const sec = e.duration_sec ?? 0;
      const billable = roundToSixMinutes(sec);
      const rate = getEffectiveRate(e.matter?.hourly_rate, e.matter?.client?.hourly_rate ?? 0);
      const amt = billable * rate;
      const isUnbilled = !e.invoice_id;

      let day = byDate.get(dateKey);
      if (!day) {
        day = { key: dateKey, label: dateLabel, seconds: 0, billableHours: 0, amount: 0, unbilledAmount: 0, entryCount: 0 };
        byDate.set(dateKey, day);
      }
      day.seconds += sec;
      day.amount += amt;
      if (isUnbilled) day.unbilledAmount += amt;
      day.entryCount++;
    });

    return Array.from(byDate.values())
      .map((d) => ({ ...d, billableHours: roundToSixMinutes(d.seconds) }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [entries, groupBy]);

  // CSV export
  const downloadCSV = () => {
    const header = ["Group", "Subgroup", "Billable Hours", "Amount", "Unbilled", "Entries"];
    const rows: string[][] = [];

    grouped.forEach((g: any) => {
      rows.push([g.label, "", g.billableHours.toFixed(1), g.amount.toFixed(2), g.unbilledAmount.toFixed(2), String(g.entryCount)]);
      if (g.children) {
        g.children.forEach((c: any) => {
          rows.push(["", c.label, c.billableHours.toFixed(1), c.amount.toFixed(2), c.unbilledAmount.toFixed(2), String(c.entryCount)]);
        });
      }
    });

    const csvContent = [header, ...rows]
      .map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleGroup = (key: string) => {
    const next = new Set(expandedGroups);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedGroups(next);
  };

  return (
    <div className="space-y-6">
      <SEO title="Reports – Time App" description="Billing reports by client, matter, or date." />

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              Billable Hours
            </div>
            <div className="text-2xl font-bold">{stats.totalBillableHours.toFixed(1)}h</div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats.avgDailyHours.toFixed(1)}h avg/day • {stats.entryCount} entries
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              Total Billed
            </div>
            <div className="text-2xl font-bold">{fmt.format(stats.totalAmount)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats.matterCount} matters
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <AlertCircle className="h-4 w-4" />
              Unbilled
            </div>
            <div className="text-2xl font-bold text-orange-600">{fmt.format(stats.unbilledAmount)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Not yet invoiced
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              Invoiced
            </div>
            <div className="text-2xl font-bold text-green-600">{fmt.format(stats.invoicedAmount)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Already on invoices
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Report Settings</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-sm font-medium">Period</label>
            <Select value={quickRange} onValueChange={(v) => setQuickRange(v as QuickRange)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this-week">This Week</SelectItem>
                <SelectItem value="last-week">Last Week</SelectItem>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="last-30">Last 30 Days</SelectItem>
                <SelectItem value="last-90">Last 90 Days</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {quickRange === "custom" && (
            <>
              <div className="space-y-1">
                <label className="text-sm font-medium">From</label>
                <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-[160px]" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">To</label>
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-[160px]" />
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium">Group By</label>
            <Select value={groupBy} onValueChange={(v) => { setGroupBy(v as GroupBy); setExpandedGroups(new Set()); }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="matter">Matter</SelectItem>
                <SelectItem value="date">Date</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={downloadCSV} disabled={!entries?.length}>
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" />
              Print
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {groupBy === "client" ? "By Client" : groupBy === "matter" ? "By Matter" : "By Date"}
            </CardTitle>
            <span className="text-sm text-muted-foreground">
              {format(new Date(from), "MMM d, yyyy")} – {format(new Date(to), "MMM d, yyyy")}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading…</div>
          ) : !grouped.length ? (
            <div className="text-center py-8 text-muted-foreground">No entries in this period.</div>
          ) : (
            <div className="space-y-1">
              {/* Header */}
              <div className="grid grid-cols-[1fr_100px_120px_120px_60px] gap-2 text-xs font-medium text-muted-foreground px-3 py-2 border-b">
                <div>Name</div>
                <div className="text-right">Hours</div>
                <div className="text-right">Amount</div>
                <div className="text-right">Unbilled</div>
                <div className="text-right">Entries</div>
              </div>

              {grouped.map((row: any) => (
                <div key={row.key}>
                  {row.children ? (
                    <Collapsible open={expandedGroups.has(row.key)} onOpenChange={() => toggleGroup(row.key)}>
                      <CollapsibleTrigger asChild>
                        <button className="w-full grid grid-cols-[1fr_100px_120px_120px_60px] gap-2 items-center px-3 py-3 rounded-lg hover:bg-muted/50 transition-colors text-left">
                          <div className="flex items-center gap-2">
                            {expandedGroups.has(row.key) ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                            {row.color && <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: row.color }} />}
                            <span className="font-medium">{row.label}</span>
                            <Badge variant="outline" className="text-xs">{row.children.length} matters</Badge>
                          </div>
                          <div className="text-right font-medium">{row.billableHours.toFixed(1)}h</div>
                          <div className="text-right font-medium">{fmt.format(row.amount)}</div>
                          <div className="text-right text-orange-600">{row.unbilledAmount > 0 ? fmt.format(row.unbilledAmount) : "–"}</div>
                          <div className="text-right text-muted-foreground">{row.entryCount}</div>
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="ml-6 border-l-2 border-muted pl-4 space-y-1 mb-2">
                          {row.children.map((child: any) => (
                            <div key={child.key} className="grid grid-cols-[1fr_100px_120px_120px_60px] gap-2 items-center px-3 py-2 text-sm rounded hover:bg-muted/30">
                              <div className="text-muted-foreground">{child.label}</div>
                              <div className="text-right">{child.billableHours.toFixed(1)}h</div>
                              <div className="text-right">{fmt.format(child.amount)}</div>
                              <div className="text-right text-orange-600">{child.unbilledAmount > 0 ? fmt.format(child.unbilledAmount) : "–"}</div>
                              <div className="text-right text-muted-foreground">{child.entryCount}</div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ) : (
                    <div className="grid grid-cols-[1fr_100px_120px_120px_60px] gap-2 items-center px-3 py-3 rounded-lg hover:bg-muted/50">
                      <div className="flex items-center gap-2">
                        {row.color && <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: row.color }} />}
                        <span className="font-medium">{row.label}</span>
                        {row.sublabel && <span className="text-sm text-muted-foreground">({row.sublabel})</span>}
                      </div>
                      <div className="text-right font-medium">{row.billableHours.toFixed(1)}h</div>
                      <div className="text-right font-medium">{fmt.format(row.amount)}</div>
                      <div className="text-right text-orange-600">{row.unbilledAmount > 0 ? fmt.format(row.unbilledAmount) : "–"}</div>
                      <div className="text-right text-muted-foreground">{row.entryCount}</div>
                    </div>
                  )}
                </div>
              ))}

              {/* Grand Total */}
              <div className="grid grid-cols-[1fr_100px_120px_120px_60px] gap-2 items-center px-3 py-3 border-t-2 font-semibold mt-2">
                <div>Grand Total</div>
                <div className="text-right">{stats.totalBillableHours.toFixed(1)}h</div>
                <div className="text-right">{fmt.format(stats.totalAmount)}</div>
                <div className="text-right text-orange-600">{stats.unbilledAmount > 0 ? fmt.format(stats.unbilledAmount) : "–"}</div>
                <div className="text-right text-muted-foreground">{stats.entryCount}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
