import { Clock, DollarSign, FileText, TrendingUp, Plus, Sparkles, Loader2, Edit2 } from "lucide-react";
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
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="section-title mb-1.5">Practice Command Center</p>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs font-semibold border-amber-200 text-amber-800 hover:bg-amber-50 hover:border-amber-300 self-start md:self-auto"
          onClick={() => setManualEntryOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Manual Entry
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stat-card-featured">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] font-semibold text-amber-700/70 uppercase tracking-wide">Billable Target</span>
            <div className="icon-badge icon-badge-amber">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="text-[1.75rem] font-extrabold tracking-tight text-slate-900 leading-none">
            {todayBillableHours.toFixed(1)} <span className="text-lg font-semibold text-slate-400">/ {billableTarget.toFixed(1)} hrs</span>
          </p>
          <div className="mt-3 space-y-1.5">
            <Progress value={billableProgress} className="h-2 bg-amber-100/80" />
            <p className="text-[11px] text-amber-700/60 font-medium">{Math.round(billableProgress)}% of daily target</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] font-semibold text-slate-400 uppercase tracking-wide">This Week</span>
            <div className="icon-badge icon-badge-blue">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="text-[1.75rem] font-extrabold tracking-tight text-slate-900 leading-none">
            {formatBillableHours(weekBillableHours)}
          </p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] font-semibold text-slate-400 uppercase tracking-wide">Billable Amount</span>
            <div className="icon-badge icon-badge-emerald">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="text-[1.75rem] font-extrabold tracking-tight text-slate-900 leading-none">
            ${totalBillable.toFixed(2)}
          </p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] font-semibold text-slate-400 uppercase tracking-wide">Entries Today</span>
            <div className="icon-badge icon-badge-slate">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <p className="text-[1.75rem] font-extrabold tracking-tight text-slate-900 leading-none">
            {String(completedEntries)}
          </p>
        </div>
      </div>

      {/* Quick Start + Today's entries */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="premium-card overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-slate-100/80">
            <h3 className="text-[15px] font-bold text-slate-900">Quick Start</h3>
            <p className="text-[13px] text-slate-400 mt-0.5">
              Pin your most-used matters for one-click tracking.
            </p>
          </div>
          <div className="p-5">
            <MatterQuickSelect />
          </div>
        </div>

        <div className="premium-card overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100/80">
            <h3 className="text-[15px] font-bold text-slate-900">Today's Entries</h3>
            <span className="text-[12px] font-semibold text-slate-400 tabular-nums">
              {completedEntries} {completedEntries === 1 ? 'entry' : 'entries'}
            </span>
          </div>
          <div className="p-5">
            {entries && entries.filter(e => e.end_at).length > 0 ? (
              <ul className="space-y-2.5">
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
                      <li key={entry.id} className="entry-item">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-semibold text-slate-800 truncate">{displayName}</p>
                            {isEditing ? (
                              <div className="mt-2 space-y-2">
                                <div className="relative">
                                  <textarea
                                    className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-800 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
                                    value={editingNotes}
                                    onChange={(e) => setEditingNotes(e.target.value)}
                                    placeholder="Enter notes..."
                                    disabled={updateEntryNotes.isPending || polishMutation.isPending}
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-1.5 right-1.5 h-7 w-7 text-amber-500 hover:text-amber-600 hover:bg-amber-50"
                                    onClick={handlePolishEntry}
                                    disabled={!editingNotes.trim() || polishMutation.isPending || updateEntryNotes.isPending}
                                  >
                                    {polishMutation.isPending ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Sparkles className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs"
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
                                    className="text-xs btn-premium"
                                    onClick={() => updateEntryNotes.mutate(entry.id)}
                                    disabled={updateEntryNotes.isPending}
                                  >
                                    Save
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-[12px] text-slate-400 truncate mt-0.5">
                                {entry.notes || "No notes"}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <div className="text-right">
                              <div className="text-[13px] font-bold font-mono tabular-nums text-slate-800">{formatDuration(secs)}</div>
                              <div className="text-[11px] text-emerald-600 font-semibold tabular-nums">
                                ${billAmount.toFixed(2)}
                              </div>
                            </div>
                            {!isEditing && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-slate-300 hover:text-slate-600"
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
              <div className="text-center py-10">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                  <FileText className="h-5 w-5 text-slate-300" />
                </div>
                <p className="text-[13px] text-slate-400 font-medium">
                  No entries yet today. Start a timer to begin tracking.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ManualEntryDialog open={manualEntryOpen} onOpenChange={setManualEntryOpen} />
    </div>
  );
};

export default Dashboard;
