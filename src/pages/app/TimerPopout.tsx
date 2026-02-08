import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import SEO from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import MatterSelector from "@/components/MatterSelector";
import QuickNoteInput from "@/components/QuickNoteInput";
import EntryFormDialog from "@/components/EntryFormDialog";
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

export default function TimerPopout() {
  const qc = useQueryClient();
  const { user }_ = useAuth();
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
  const [notes, setNotes] = useState(activeEntry?.notes ?? "");

  // Fetch matters
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

  const activeMatter = activeEntry?.matter;
  const activeRate =
    activeMatter?.hourly_rate ?? activeMatter?.client?.hourly_rate ?? 0;
  const billableHours = roundToSixMinutes(elapsed);
  const activeAmount = calculateBillingAmount(elapsed, activeRate);

  const elapsedHMS = formatDuration(elapsed);
  const fmt = useMemo(() => new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }), []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="Timer Popout – Time App"
        description="Compact popout timer with matter, notes, and start/stop controls."
      />
      <header className="flex items-center justify-between px-4 py-2 border-b">
        <h1 className="text-base font-semibold">Timer Popout</h1>
        <div className="text-xs text-muted-foreground">
          {activeEntry ? fmt.format(activeAmount) : ""}
        </div>
      </header>
      <main className="p-4 space-y-4">
        {/* Timer Display */}
        <div className="text-center space-y-1">
          <div className="text-5xl font-bold tracking-tight">{elapsedHMS}</div>
          {activeEntry && (
            <div className="text-sm text-muted-foreground">
              {formatBillableHours(billableHours)} • {fmt.format(activeAmount)}
            </div>
          )}
        </div>

        {/* Quick Note Input */}
        {quickSwitchState.show && (
          <div className="bg-muted rounded-lg p-3">
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
          <label className="text-sm font-medium">Matter</label>
          <MatterSelector
            matters={matters}
            entries={todays}
            value={activeEntry?.matter_id ?? ""}
            onChange={handleMatterSelect}
            disabled={quickSwitchState.show || isLoading}
          />
          {activeMatter && (
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline">{activeMatter.client?.name}</Badge>
              {activeRate > 0 ? (
                <span className="text-muted-foreground">@${activeRate}/hr</span>
              ) : (
                <Badge variant="destructive" className="text-xs">No rate set</Badge>
              )}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-2">
          <Textarea
            rows={4}
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                Expand Notes
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit notes</DialogTitle>
              </DialogHeader>
              <Textarea
                rows={12}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-2">
          {activeEntry ? (
            <>
              <div className="flex gap-2">
                {isPaused ? (
                  <Button
                    onClick={actions.resume}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    Resume
                  </Button>
                ) : (
                  <Button
                    onClick={actions.pause}
                    disabled={isLoading}
                    variant="secondary"
                    className="flex-1"
                  >
                    Pause
                  </Button>
                )}
                <Button
                  onClick={actions.stop}
                  disabled={quickSwitchState.show}
                  className="flex-1"
                >
                  Stop
                </Button>
              </div>
              {activeEntry?.id && (
                <EntryFormDialog
                  trigger={
                    <Button variant="outline" size="sm" className="w-full">
                      Edit Active
                    </Button>
                  }
                  title="Edit active entry"
                  initial={{
                    id: activeEntry.id,
                    matter_id: activeEntry.matter_id ?? "",
                    client_id: activeEntry.client_id,
                    start_at: activeEntry.start_at,
                    end_at: activeEntry.end_at,
                    notes: activeEntry.notes,
                  }}
                  matters={matters}
                  entries={todays}
                  onSubmit={async (v) => {
                    const { error } = await supabase
                      .from("entries")
                      .update({
                        matter_id: v.matter_id,
                        client_id: v.client_id,
                        start_at: v.start_at,
                        end_at: v.end_at ?? null,
                        notes: v.notes ?? null,
                      })
                      .eq("id", v.id!);
                    if (error) {
                      toast({ title: "Error updating entry", description: error.message, variant: "destructive" });
                    } else {
                      qc.invalidateQueries({ queryKey: ["active-entry"] });
                      toast({ title: "Entry updated" });
                    }
                  }}
                />
              )}
            </>
          ) : (
            <>
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
                disabled={isLoading}
                className="w-full"
              >
                Start
              </Button>
              <EntryFormDialog
                trigger={
                  <Button variant="secondary" size="sm" className="w-full">
                    Add Entry
                  </Button>
                }
                title="Add entry"
                matters={matters}
                entries={todays}
                onSubmit={async (v) => {
                  if (!user) return;
                  const { error } = await supabase.from("entries").insert({
                    user_id: user.id,
                    matter_id: v.matter_id,
                    client_id: v.client_id,
                    start_at: v.start_at,
                    end_at: v.end_at ?? null,
                    notes: v.notes ?? null,
                  });
                  if (error) {
                    toast({ title: "Error creating entry", description: error.message, variant: "destructive" });
                  } else {
                    qc.invalidateQueries({ queryKey: ["active-entry"] });
                    toast({ title: "Entry created" });
                  }
                }}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
