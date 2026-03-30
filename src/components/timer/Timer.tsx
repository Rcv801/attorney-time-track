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
import { Play, Pause, Square, Loader2, Search, Plus } from "lucide-react";
import { useTimer } from "@/hooks/useTimer";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatDuration } from "@/lib/billing";
import { cn } from "@/lib/utils";
import QuickSwitchDialog from "./QuickSwitchDialog";

type Matter = Tables<"matters"> & { client: Tables<"clients"> };

const Timer = () => {
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
      <div className="premium-card overflow-hidden">
        {/* Timer header bar */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            {isRunning && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="status-dot status-dot-active" />
              </span>
            )}
            {isPaused && <span className="status-dot status-dot-paused" />}
            <h3 className="text-[15px] font-bold text-slate-900">
              {activeEntry ? activeEntry.matter?.name : "Timer"}
            </h3>
          </div>
          {activeEntry?.matter?.client && (
            <span className="text-[12px] text-slate-400 font-medium">
              {activeEntry.matter.client.name}
            </span>
          )}
        </div>

        {/* Timer display */}
        <div className="mx-5 rounded-xl p-6"
             style={{
               background: isRunning
                 ? 'linear-gradient(135deg, hsl(155 40% 97%) 0%, hsl(155 30% 95%) 100%)'
                 : isPaused
                 ? 'linear-gradient(135deg, hsl(38 50% 97%) 0%, hsl(38 40% 95%) 100%)'
                 : 'linear-gradient(135deg, hsl(215 15% 97%) 0%, hsl(215 10% 95%) 100%)',
               border: `1px solid ${isRunning ? 'hsl(155 30% 88%)' : isPaused ? 'hsl(38 40% 88%)' : 'hsl(215 10% 90%)'}`,
             }}>
          <div
            className={cn(
              "timer-display",
              isRunning && "timer-running",
              isPaused && "timer-paused",
              !isRunning && !isPaused && "text-slate-300",
            )}
            role="timer"
            aria-live="polite"
            aria-label={`Timer: ${formatDuration(elapsed)}`}
          >
            {formatDuration(elapsed)}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 px-5 py-5">
          <Button
            size="icon"
            onClick={handleTogglePlay}
            disabled={isLoading}
            aria-label={isRunning ? "Pause timer" : isPaused ? "Resume timer" : "Start timer"}
            className={cn(
              "h-12 w-12 rounded-full shadow-md transition-all duration-200",
              isRunning
                ? "bg-amber-500 hover:bg-amber-600 text-white"
                : "btn-premium",
            )}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isRunning ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={actions.stop}
            disabled={!activeEntry || isLoading}
            aria-label="Stop timer"
            className="h-12 w-12 rounded-full border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 hover:border-red-300 disabled:opacity-30"
          >
            <Square className="h-5 w-5" />
          </Button>
        </div>

        {!activeEntry && (
          <p className="text-center text-[12px] text-slate-400 pb-5 -mt-1">
            Click play to choose a matter and start tracking.
          </p>
        )}
      </div>

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
                <Label htmlFor="client-name" className="text-[13px] font-semibold text-slate-700">Client Name *</Label>
                <Input
                  id="client-name"
                  placeholder="e.g., Acme Corp"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  disabled={createClientAndMatter.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="matter-name" className="text-[13px] font-semibold text-slate-700">Matter Name *</Label>
                <Input
                  id="matter-name"
                  placeholder="e.g., Contract Review"
                  value={matterName}
                  onChange={(e) => setMatterName(e.target.value)}
                  disabled={createClientAndMatter.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hourly-rate" className="text-[13px] font-semibold text-slate-700">Hourly Rate (optional)</Label>
                <Input
                  id="hourly-rate"
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

      <QuickSwitchDialog />
    </>
  );
};

export default Timer;
