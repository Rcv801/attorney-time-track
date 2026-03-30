import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

      // Create the client
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

      // Create the matter
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
        // Rollback client creation if matter fails
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

      // Start timer on the new matter
      actions.start(newMatter.id, newMatter.client_id);

      // Reset form and close dialog
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

    // No active entry: start-first flow with searchable matter picker
    setMatterPickerOpen(true);
  };

  return (
    <>
      <Card className="premium-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            {isRunning && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
              </span>
            )}
            {isPaused && (
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
            )}
            {activeEntry ? activeEntry.matter?.name : "Timer"}
          </CardTitle>
          {activeEntry?.matter?.client && (
            <p className="text-sm text-muted-foreground">
              {activeEntry.matter.client.name}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-border/70 bg-background/45 px-4 py-5">
            <div
              className={cn(
                "text-4xl md:text-5xl font-mono font-bold text-center tabular-nums tracking-tight",
                isRunning && "text-green-600 dark:text-green-400",
                isPaused && "text-yellow-600 dark:text-yellow-400 animate-pulse",
              )}
              role="timer"
              aria-live="polite"
              aria-label={`Timer: ${formatDuration(elapsed)}`}
            >
              {formatDuration(elapsed)}
            </div>
          </div>
          <div className="flex justify-center gap-2.5 md:gap-3">
            <Button
              size="icon"
              variant="outline"
              onClick={handleTogglePlay}
              disabled={isLoading}
              aria-label={isRunning ? "Pause timer" : isPaused ? "Resume timer" : "Start timer"}
              className="h-11 w-11 md:h-12 md:w-12 rounded-full"
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
              variant="destructive"
              onClick={actions.stop}
              disabled={!activeEntry || isLoading}
              aria-label="Stop timer"
              className="h-11 w-11 md:h-12 md:w-12 rounded-full"
            >
              <Square className="h-5 w-5" />
            </Button>
          </div>
          {!activeEntry && (
            <p className="text-center text-xs text-muted-foreground">
              Click play to choose a matter and start tracking.
            </p>
          )}
        </CardContent>
      </Card>

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
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by client or matter"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {filteredMatters.length > 0 ? (
                  filteredMatters.map((matter) => (
                    <Button
                      key={matter.id}
                      variant="outline"
                      className="w-full justify-between h-auto py-2"
                      onClick={() => handleStartForMatter(matter)}
                    >
                      <span className="text-left truncate pr-3">
                        <span className="font-medium">{matter.client?.name ?? "Unknown client"}</span>
                        <span className="text-muted-foreground">{" — "}{matter.name}</span>
                      </span>
                      <Play className="h-4 w-4 shrink-0" />
                    </Button>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No active matters match your search.
                  </p>
                )}
              </div>

              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => setShowCreateForm(true)}
              >
                <Plus className="h-4 w-4" />
                New Client + Matter
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client-name">Client Name *</Label>
                <Input
                  id="client-name"
                  placeholder="e.g., Acme Corp"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  disabled={createClientAndMatter.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="matter-name">Matter Name *</Label>
                <Input
                  id="matter-name"
                  placeholder="e.g., Contract Review"
                  value={matterName}
                  onChange={(e) => setMatterName(e.target.value)}
                  disabled={createClientAndMatter.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hourly-rate">Hourly Rate (optional)</Label>
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
                  className="flex-1 gap-2"
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
