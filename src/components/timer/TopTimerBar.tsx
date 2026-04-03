import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Play, Pause, Square, Loader2, Search, Plus, Clock } from "lucide-react";
import { useTimer } from "@/hooks/useTimer";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatDuration } from "@/lib/billing";
import { cn } from "@/lib/utils";

type Matter = Tables<"matters"> & { client: Tables<"clients"> };

const TopTimerBar = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    activeEntry,
    elapsed,
    isRunning,
    isPaused,
    isLoading,
    actions,
  } = useTimer();

  const [matterPickerOpen, setMatterPickerOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [search, setSearch] = useState("");
  const [clientName, setClientName] = useState("");
  const [matterName, setMatterName] = useState("");
  const [hourlyRate, setHourlyRate] = useState("0");

  const { data: matters = [] } = useQuery<Matter[]>({
    queryKey: ["matters-all-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matters")
        .select("*, client:clients(*)")
        .eq("status", "active")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredMatters = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return matters;
    return matters.filter((matter) =>
      `${matter.client?.name ?? ""} ${matter.name}`.toLowerCase().includes(q)
    );
  }, [matters, search]);

  const handleStartForMatter = (matter: Matter) => {
    actions.start(matter.id, matter.client_id);
    setMatterPickerOpen(false);
    setSearch("");
  };

  const createClientAndMatter = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      if (!clientName.trim()) throw new Error("Client name is required");
      if (!matterName.trim()) throw new Error("Matter name is required");

      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert({
          name: clientName.trim(),
          hourly_rate: parseFloat(hourlyRate) || 0,
          user_id: user.id,
        })
        .select()
        .single();

      if (clientError) throw clientError;
      if (!newClient) throw new Error("Failed to create client.");

      const { data: newMatter, error: matterError } = await supabase
        .from("matters")
        .insert({
          name: matterName.trim(),
          client_id: newClient.id,
          user_id: user.id,
          status: "active",
        })
        .select()
        .single();

      if (matterError) {
        await supabase.from("clients").delete().eq("id", newClient.id);
        throw matterError;
      }

      return newMatter;
    },
    onSuccess: (newMatter) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["matters-for-clients"] });
      qc.invalidateQueries({ queryKey: ["matters-all-active"] });
      toast({ title: "Client and matter created" });
      actions.start(newMatter.id, newMatter.client_id);
      setClientName("");
      setMatterName("");
      setHourlyRate("0");
      setShowCreateForm(false);
      setMatterPickerOpen(false);
      setSearch("");
    },
    onError: (e: Error) => {
      toast({
        title: "Failed to create client and matter",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  const handleTogglePlay = () => {
    if (isRunning) {
      actions.pause();
      return;
    }
    if (isPaused) {
      actions.resume();
      return;
    }
    setMatterPickerOpen(true);
  };

  return (
    <>
      <div className="top-timer-bar">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {/* Timer controls cluster */}
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              onClick={handleTogglePlay}
              disabled={isLoading}
              aria-label={isRunning ? "Pause timer" : isPaused ? "Resume timer" : "Start timer"}
              className={cn(
                "h-9 w-9 rounded-full shadow-sm transition-all duration-200",
                isRunning
                  ? "bg-amber-500 hover:bg-amber-600 text-white"
                  : "timer-bar-play-btn",
              )}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isRunning ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4 ml-0.5" />
              )}
            </Button>

            {(isRunning || isPaused) && (
              <Button
                size="icon"
                variant="ghost"
                onClick={actions.stop}
                disabled={!activeEntry || isLoading}
                aria-label="Stop timer"
                className="h-9 w-9 rounded-full text-red-400 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-30"
              >
                <Square className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Timer display */}
          <div
            className={cn(
              "font-mono font-bold tabular-nums tracking-tight text-2xl transition-colors duration-300",
              isRunning && "text-emerald-400",
              isPaused && "text-amber-400 animate-pulse",
              !isRunning && !isPaused && "text-slate-500",
            )}
            role="timer"
            aria-live="polite"
            aria-label={`Timer: ${formatDuration(elapsed)}`}
          >
            {formatDuration(elapsed)}
          </div>

          {/* Active matter info */}
          {activeEntry ? (
            <div className="min-w-0 flex items-center gap-2">
              <div className="h-4 w-px bg-slate-600" />
              <div className="min-w-0">
                <span className="text-[13px] font-semibold text-slate-200 truncate block">
                  {activeEntry.matter?.name}
                </span>
                {activeEntry.matter?.client && (
                  <span className="text-[11px] text-slate-400 truncate block">
                    {activeEntry.matter.client.name}
                  </span>
                )}
              </div>

              {/* Running indicator */}
              {isRunning && (
                <span className="relative flex h-2 w-2 ml-1">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
              )}
              {isPaused && (
                <span className="inline-flex h-2 w-2 rounded-full bg-amber-400 ml-1" />
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-500">
              <div className="h-4 w-px bg-slate-700" />
              <Clock className="h-3.5 w-3.5" />
              <span className="text-[12px] font-medium">Ready to track</span>
            </div>
          )}
        </div>

        {/* Right side: quick info */}
        {!isRunning && !isPaused && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMatterPickerOpen(true)}
            className="text-[12px] font-semibold text-amber-400 hover:text-amber-300 hover:bg-white/5 gap-1.5 shrink-0"
          >
            <Play className="h-3 w-3" />
            Start Timer
          </Button>
        )}
      </div>

      {/* Matter picker dialog — identical logic to Timer.tsx */}
      <Dialog open={matterPickerOpen} onOpenChange={setMatterPickerOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Start timer</DialogTitle>
            <DialogDescription>
              Select a matter to begin tracking time.
            </DialogDescription>
          </DialogHeader>

          {!showCreateForm ? (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="search-input"
                  placeholder="Search by client or matter"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
                {filteredMatters.length > 0 ? (
                  filteredMatters.map((matter) => (
                    <button
                      key={matter.id}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-all duration-150 hover:bg-slate-50 group"
                      style={{ border: '1px solid transparent' }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'hsl(35 20% 90%)'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
                      onClick={() => handleStartForMatter(matter)}
                    >
                      <span className="truncate pr-3">
                        <span className="text-[13px] font-semibold text-slate-800">{matter.client?.name ?? "Unknown client"}</span>
                        <span className="text-[13px] text-slate-400">{" — "}{matter.name}</span>
                      </span>
                      <Play className="h-3.5 w-3.5 shrink-0 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                    </button>
                  ))
                ) : (
                  <p className="text-[13px] text-slate-400 text-center py-8">
                    No active matters match your search.
                  </p>
                )}
              </div>

              <Button
                variant="outline"
                className="w-full gap-2 text-[13px] font-semibold"
                onClick={() => setShowCreateForm(true)}
              >
                <Plus className="h-4 w-4" />
                New Client + Matter
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="timer-bar-client-name" className="text-[13px] font-semibold text-slate-700">Client Name *</Label>
                <Input
                  id="timer-bar-client-name"
                  placeholder="e.g., Acme Corp"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  disabled={createClientAndMatter.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timer-bar-matter-name" className="text-[13px] font-semibold text-slate-700">Matter Name *</Label>
                <Input
                  id="timer-bar-matter-name"
                  placeholder="e.g., Contract Review"
                  value={matterName}
                  onChange={(e) => setMatterName(e.target.value)}
                  disabled={createClientAndMatter.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timer-bar-hourly-rate" className="text-[13px] font-semibold text-slate-700">Hourly Rate (optional)</Label>
                <Input
                  id="timer-bar-hourly-rate"
                  type="number"
                  placeholder="0"
                  min="0"
                  step="0.01"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  disabled={createClientAndMatter.isPending}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowCreateForm(false);
                    setClientName("");
                    setMatterName("");
                    setHourlyRate("0");
                  }}
                  disabled={createClientAndMatter.isPending}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 gap-2 btn-premium"
                  onClick={() => createClientAndMatter.mutate()}
                  disabled={
                    !clientName.trim() ||
                    !matterName.trim() ||
                    createClientAndMatter.isPending
                  }
                >
                  {createClientAndMatter.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Create & Start
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TopTimerBar;
