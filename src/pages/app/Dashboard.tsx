import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, DollarSign, FileText, TrendingUp, Plus, Sparkles, Loader2, Edit2, X } from "lucide-react";
import Timer from "@/components/timer/Timer";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePolishDescription } from "@/hooks/usePolishDescription";
import type { Tables } from "@/integrations/supabase/types";
import { formatDuration, formatBillableHours, roundToSixMinutes, calculateBillingAmount } from "@/lib/billing";
import { differenceInSeconds, startOfDay, startOfWeek } from "date-fns";
import LoadingSkeleton from "@/components/shared/LoadingSkeleton";
import MatterQuickSelect from "@/components/timer/MatterQuickSelect";
import ManualEntryDialog from "@/components/timer/ManualEntryDialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Entry = Tables<"entries"> & { matter: Tables<"matters"> & { client: Tables<"clients"> } };

const Dashboard = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const polishMutation = usePolishDescription();
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState("");

  const today = startOfDay(new Date()).toISOString();
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();

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

  const { data: weekEntries = [] } = useQuery<Entry[]>({
    queryKey: ["entries-week"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entries")
        .select("*, matter:matters(*, client:clients(*))")
        .gte("start_at", weekStart)
        .lt("start_at", new Date().toISOString())
        .eq("archived", false);
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

  const weekTotalSeconds = weekEntries.reduce((sum, e) => sum + getEntrySeconds(e), 0);
  const billableTarget = 6.0;
  const todayBillableHours = roundToSixMinutes(totalSeconds);
  const weekBillableHours = roundToSixMinutes(weekTotalSeconds);
  const billableProgress = Math.min((todayBillableHours / billableTarget) * 100, 100);

  const updateEntryNotes = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from("entries")
        .update({ notes: editingNotes || null })
        .eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entries-today"] });
      toast({ title: "Notes updated" });
      setEditingEntryId(null);
      setEditingNotes("");
    },
    onError: (e: Error) => {
      toast({
        title: "Failed to update notes",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  const handlePolishEntry = async () => {
    if (!editingNotes.trim()) return;
    const polished = await polishMutation.mutateAsync(editingNotes);
    setEditingNotes(polished);
  };

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="section-title mb-2 text-slate-600">Practice Command Center</p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-slate-600 mt-2 text-sm font-medium">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50/80 px-4 py-2 text-xs text-amber-900 font-medium shadow-sm">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          Tracking ready
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Billable Target"
          value={`${todayBillableHours.toFixed(1)} / ${billableTarget.toFixed(1)} hrs`}
          icon={<TrendingUp className="h-4 w-4 text-amber-600" />}
          progress={billableProgress}
          featured
        />
        <StatCard
          title="This Week"
          value={formatBillableHours(weekBillableHours)}
          icon={<Clock className="h-4 w-4 text-blue-600" />}
        />
        <StatCard
          title="Billable Amount"
          value={`$${totalBillable.toFixed(2)}`}
          icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
        />
        <StatCard
          title="Entries Today"
          value={String(completedEntries)}
          icon={<FileText className="h-4 w-4 text-slate-600" />}
        />
      </div>

      {/* Timer — front and center */}
      <Timer />

      {/* Quick Start + Today's entries */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="premium-card rounded-xl border border-slate-200 shadow-md">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-lg font-bold text-slate-900">Quick Start</CardTitle>
            <p className="text-sm text-slate-600 mt-1">
              Pin your most-used matters for one-click time tracking.
            </p>
          </CardHeader>
          <CardContent className="pt-4">
            <MatterQuickSelect />
          </CardContent>
        </Card>
        <Card className="premium-card rounded-xl border border-slate-200 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
            <CardTitle className="font-bold text-slate-900">Today's Entries</CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100"
              onClick={() => setManualEntryOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Add Entry
            </Button>
          </CardHeader>
          <CardContent className="pt-4">
            {entries && entries.filter(e => e.end_at).length > 0 ? (
              <ul className="space-y-3">
                {entries
                  .filter((e) => e.end_at)
                  .map((entry) => {
                    const clientName = entry.matter?.client?.name;
                    const matterName = entry.matter?.name ?? "Unknown";
                    const displayName = clientName ? `${clientName} — ${matterName}` : matterName;
                    const secs = getEntrySeconds(entry);
                    const rate = entry.matter?.hourly_rate ?? entry.matter?.client?.hourly_rate ?? 0;
                    const billAmount = calculateBillingAmount(secs, rate);
                    const isEditing = editingEntryId === entry.id;

                    return (
                      <li
                        key={entry.id}
                        className="flex flex-col rounded-lg border border-slate-200 bg-slate-50/40 p-3 transition-all duration-200 hover:bg-slate-100/60 hover:border-slate-300 hover:shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-900 truncate">{displayName}</p>
                            {isEditing ? (
                              <div className="mt-2 space-y-2">
                                <div className="relative">
                                  <textarea
                                    className="w-full rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-900 focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                                    value={editingNotes}
                                    onChange={(e) => setEditingNotes(e.target.value)}
                                    placeholder="Enter notes..."
                                    disabled={updateEntryNotes.isPending || polishMutation.isPending}
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-1 right-1"
                                    onClick={handlePolishEntry}
                                    disabled={!editingNotes.trim() || polishMutation.isPending || updateEntryNotes.isPending}
                                  >
                                    {polishMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Sparkles className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditingEntryId(null);
                                      setEditingNotes("");
                                    }}
                                    disabled={updateEntryNotes.isPending}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => updateEntryNotes.mutate(entry.id)}
                                    disabled={updateEntryNotes.isPending}
                                  >
                                    Save
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-slate-600 truncate">
                                {entry.notes || "No notes"}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <div className="font-mono text-sm tabular-nums text-slate-900">
                              <div className="font-semibold">{formatDuration(secs)}</div>
                              <div className="text-xs text-slate-600 font-medium">
                                ${billAmount.toFixed(2)}
                              </div>
                            </div>
                            {!isEditing && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingEntryId(entry.id);
                                  setEditingNotes(entry.notes || "");
                                }}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            ) : (
              <p className="text-center text-slate-500 py-8 text-sm">
                No entries yet today. Start a timer to begin tracking.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <ManualEntryDialog open={manualEntryOpen} onOpenChange={setManualEntryOpen} />
    </div>
  );
};

function StatCard({
  title,
  value,
  icon,
  progress,
  featured,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  progress?: number;
  featured?: boolean;
}) {
  return (
    <Card className={cn(
      "premium-card rounded-xl",
      featured && "border-2 border-amber-200 bg-gradient-to-br from-amber-50/80 to-white shadow-md"
    )}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold text-slate-600">{title}</CardTitle>
        <div className={cn(
          "rounded-lg p-2",
          featured ? "bg-amber-100" : "bg-slate-100"
        )}>
          {icon}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className={cn(
          "font-bold tracking-tight",
          featured ? "text-3xl text-slate-900" : "text-2xl text-slate-900"
        )}>{value}</p>
        {progress !== undefined && (
          <div className="space-y-1.5">
            <Progress value={progress} className="h-2.5 bg-amber-100" />
            <p className="text-xs text-slate-500 font-medium">{Math.round(progress)}% of daily target</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default Dashboard;
