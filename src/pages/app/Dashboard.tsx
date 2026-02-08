import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";
import EntryFormDialog from "@/components/EntryFormDialog";
import MatterSelector from "@/components/MatterSelector";
import QuickNoteInput from "@/components/QuickNoteInput";
import { useTimer } from "@/hooks/useTimer";
import {
  calculateBillingAmount,
  formatDuration,
  roundToSixMinutes,
  formatBillableHours,
} from "@/lib/billing";
import { startOfLocalDayUtc } from "@/lib/dates";
import type { Tables } from "@/integrations/supabase/types";

type Matter = Tables<"matters"> & { client: Tables<"clients"> };
type Entry = Tables<"entries">;

export default function Dashboard() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    activeEntry,
    elapsed,
    isRunning,
    isPaused,
    isLoading,
    quickSwitchState,
    actions,
  } = useTimer();

  // Fetch matters with client info
  const { data: matters } = useQuery({
    queryKey: ["matters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matters")
        .select("*, client:clients(*)")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data as Matter[];
    },
  });

  // Fetch today's entries
  const { data: todays } = useQuery({
    queryKey: ["entries-today"],
    queryFn: async () => {
      const from = startOfLocalDayUtc(new Date()).toISOString();
      const { data, error } = await supabase
        .from("entries")
        .select("*, matter:matters(*, client:clients(*))")
        .gte("start_at", from)
        .order("start_at", { ascending: false });
      if (error) throw error;
      return data as (Entry & { matter: Matter })[];
    },
  });

  const handleMatterSelect = (selectedMatterId: string) => {
    if (!selectedMatterId) return;
    const matter = matters?.find((m) => m.id === selectedMatterId);
    if (matter) {
      actions.quickSwitch({ id: matter.id, client_id: matter.client_id, name: matter.name });
    }
  };

  const handleQuickNoteSubmit = (notes: string) => {
    actions.submitQuickAction(notes);
  };
  
  const handleQuickNoteSkip = () => {
    actions.submitQuickAction(""); // Submit with empty notes
  };

  // Calculate billing info with 6-minute rounding
  const activeMatter = activeEntry?.matter;
  const activeRate = activeMatter?.hourly_rate ?? activeMatter?.client?.hourly_rate ?? 0;
  const billableHours = roundToSixMinutes(elapsed);
  const activeAmount = calculateBillingAmount(elapsed, activeRate);

  // Formatter - memoized to avoid recreating on every render
  const fmt = useMemo(() => new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }), []);

  // Entry mutations for manual add/edit with error handling
  const onCreate = async (values: {
    matter_id: string;
    client_id: string;
    start_at: string;
    end_at?: string | null;
    notes?: string | null;
  }) => {
    if (!user) return;
    const { error } = await supabase.from("entries").insert({
      user_id: user.id,
      matter_id: values.matter_id,
      client_id: values.client_id,
      start_at: values.start_at,
      end_at: values.end_at ?? null,
      notes: values.notes ?? null,
    });
    if (error) {
      toast({ title: "Error creating entry", description: error.message, variant: "destructive" });
    } else {
      qc.invalidateQueries({ queryKey: ["entries-today"] });
      toast({ title: "Entry created" });
    }
  };

  const onUpdate = async (values: {
    id?: string;
    matter_id: string;
    client_id: string;
    start_at: string;
    end_at?: string | null;
    notes?: string | null;
  }) => {
    if (!values.id) return;
    const { error } = await supabase
      .from("entries")
      .update({
        matter_id: values.matter_id,
        client_id: values.client_id,
        start_at: values.start_at,
        end_at: values.end_at ?? null,
        notes: values.notes ?? null,
      })
      .eq("id", values.id);
    if (error) {
      toast({ title: "Error updating entry", description: error.message, variant: "destructive" });
    } else {
      qc.invalidateQueries({ queryKey: ["entries-today"] });
      toast({ title: "Entry updated" });
    }
  };

  return (
    <div className="space-y-6">
      <SEO
        title="Dashboard – Time App"
        description="Track time with a Start/Stop timer and see today's entries."
      />

      {/* Timer Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Timer</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              window.open(
                "/app/TimerPopout",
                "timer-popout",
                "width=380,height=560,menubar=no,toolbar=no,location=no,status=no"
              )
            }
          >
            Open Popout
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Timer Display */}
          <div className="text-center">
            <div className="text-6xl md:text-7xl font-bold">
              {formatDuration(elapsed)}
            </div>
            {activeEntry && (
              <div className="mt-2 space-y-1">
                <div className="text-lg text-muted-foreground">
                  So far: {fmt.format(activeAmount)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatBillableHours(billableHours)}
                </div>
              </div>
            )}
          </div>

          {/* Quick Note Input (shown when switching/stopping) */}
          {quickSwitchState.show && (
            <div className="bg-muted rounded-lg p-4">
              <QuickNoteInput
                matterName={quickSwitchState.stoppedMatterName}
                onSubmit={handleQuickNoteSubmit}
                onSkip={handleQuickNoteSkip}
                isLoading={isLoading}
              />
            </div>
          )}

          {/* Matter Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Matter</label>
              <EntryFormDialog
                trigger={
                  <Button variant="ghost" size="sm">
                    Add Entry
                  </Button>
                }
                title="Add entry"
                matters={matters}
                entries={todays}
                onSubmit={onCreate}
              />
            </div>
            <MatterSelector
              matters={matters}
              entries={todays}
              value={activeEntry?.matter_id ?? ""}
              onChange={handleMatterSelect}
              disabled={quickSwitchState.show || isLoading}
            />
            {activeMatter && (
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline">{activeMatter.client?.name}</Badge>
                {activeRate > 0 ? (
                  <span className="text-muted-foreground">
                    @ ${activeRate}/hr
                  </span>
                ) : (
                  <Badge variant="destructive" className="text-xs">No rate set</Badge>
                )}
              </div>
            )}
          </div>

          {/* Control Buttons */}
          <div className="space-y-2">
            {activeEntry ? (
              <div className="grid grid-cols-2 gap-2">
                {isPaused ? (
                  <Button
                    onClick={actions.resume}
                    disabled={isLoading}
                    className="w-full"
                  >
                    Resume
                  </Button>
                ) : (
                  <Button
                    onClick={actions.pause}
                    disabled={isLoading}
                    variant="secondary"
                    className="w-full"
                  >
                    Pause
                  </Button>
                )}
                <Button
                  onClick={actions.stop}
                  disabled={quickSwitchState.show || isLoading}
                  variant="default"
                  className="w-full"
                >
                  Stop
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => {
                  const matterId = (document.querySelector('[data-radix-collection-item]:not([data-disabled])') as HTMLElement)?.dataset.value;
                  if (matterId) {
                      const matter = matters?.find(m => m.id === matterId);
                      if (matter) {
                          actions.start(matter.id, matter.client_id);
                      }
                  }
                }}
                disabled={isLoading || !user}
                className="w-full"
              >
                Start Timer
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Today's Entries */}
      <Card>
        <CardHeader>
          <CardTitle>Today's Entries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {todays?.length ? (
            todays.map((e) => {
              const duration = e.duration_sec ?? 0;
              const billable = roundToSixMinutes(duration);
              const rate =
                e.matter?.hourly_rate ?? e.matter?.client?.hourly_rate ?? 0;
              const amount = billable * rate;

              return (
                <div
                  key={e.id}
                  className="flex items-center justify-between border rounded-lg p-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            e.matter?.client?.color ?? "#9ca3af",
                        }}
                      />
                      <span className="font-medium truncate">
                        {e.matter?.client?.name} — {e.matter?.name}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {new Date(e.start_at).toLocaleTimeString()} –{" "}
                      {e.end_at
                        ? new Date(e.end_at).toLocaleTimeString()
                        : "…"}
                      {" "}• {formatBillableHours(billable)}
                    </div>
                    {e.notes && (
                      <div className="text-sm mt-1 truncate">{e.notes}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <div className="text-right">
                      <div className="font-medium">{fmt.format(amount)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDuration(duration)}
                      </div>
                    </div>
                    <EntryFormDialog
                      trigger={<Button variant="outline" size="sm">Edit</Button>}
                      title="Edit entry"
                      initial={{
                        id: e.id,
                        matter_id: e.matter_id ?? "",
                        client_id: e.client_id,
                        start_at: e.start_at,
                        end_at: e.end_at,
                        notes: e.notes,
                      }}
                      matters={matters}
                      entries={todays}
                      onSubmit={onUpdate}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        await supabase.from("entries").delete().eq("id", e.id);
                        qc.invalidateQueries({ queryKey: ["entries-today"] });
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-sm text-muted-foreground text-center py-8">
              No entries yet. Select a matter and start the timer.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
