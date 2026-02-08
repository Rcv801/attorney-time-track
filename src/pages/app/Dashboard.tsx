import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, DollarSign, FileText, TrendingUp } from "lucide-react";
import Timer from "@/components/timer/Timer";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatDuration, formatBillableHours, roundToSixMinutes, calculateBillingAmount } from "@/lib/billing";
import { differenceInSeconds, startOfDay } from "date-fns";
import LoadingSkeleton from "@/components/shared/LoadingSkeleton";
import MatterQuickSelect from "@/components/timer/MatterQuickSelect";

type Entry = Tables<"entries"> & { matter: Tables<"matters"> & { client: Tables<"clients"> } };

const Dashboard = () => {
  const today = startOfDay(new Date()).toISOString();

  const { data: entries, isLoading } = useQuery<Entry[]>({
    queryKey: ["entries-today"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entries")
        .select("*, matter:matters(*, client:clients(*))")
        .gte("start_at", today)
        .order("start_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const getEntrySeconds = (entry: Entry) => {
    if (!entry.end_at) return 0;
    return Math.max(
      differenceInSeconds(new Date(entry.end_at), new Date(entry.start_at)) -
        (entry.total_paused_seconds || 0),
      0
    );
  };

  const totalSeconds = entries?.reduce((sum, e) => sum + getEntrySeconds(e), 0) ?? 0;
  const totalBillable = entries?.reduce((sum, e) => {
    const secs = getEntrySeconds(e);
    const rate = e.matter?.hourly_rate ?? e.matter?.client?.hourly_rate ?? 0;
    return sum + calculateBillingAmount(secs, rate);
  }, 0) ?? 0;
  const completedEntries = entries?.filter((e) => e.end_at).length ?? 0;

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Hours Today"
          value={formatBillableHours(roundToSixMinutes(totalSeconds))}
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Billable Amount"
          value={`$${totalBillable.toFixed(2)}`}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Entries Today"
          value={String(completedEntries)}
          icon={<FileText className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Active Time"
          value={formatDuration(totalSeconds)}
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {/* Timer — front and center */}
      <Timer />

      {/* Quick Start + Today's entries */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Quick Start</CardTitle>
            <p className="text-sm text-muted-foreground">
              Pin your most-used matters for one-click time tracking.
            </p>
          </CardHeader>
          <CardContent>
            <MatterQuickSelect />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Today's Entries</CardTitle>
          </CardHeader>
          <CardContent>
            {entries && entries.filter(e => e.end_at).length > 0 ? (
              <ul className="space-y-3">
                {entries
                  .filter((e) => e.end_at)
                  .map((entry) => {
                    const clientName = entry.matter?.client?.name;
                    const matterName = entry.matter?.name ?? "Unknown";
                    const displayName = clientName ? `${clientName} — ${matterName}` : matterName;
                    return (
                      <li
                        key={entry.id}
                        className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{displayName}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {entry.notes || "No notes"}
                          </p>
                        </div>
                        <p className="font-mono text-sm tabular-nums ml-4 shrink-0">
                          {formatDuration(getEntrySeconds(entry))}
                        </p>
                      </li>
                    );
                  })}
              </ul>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No entries yet today. Start a timer to begin tracking.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

export default Dashboard;
