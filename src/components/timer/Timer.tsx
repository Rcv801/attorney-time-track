import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Play, Pause, Square, Loader2, Search } from "lucide-react";
import { useTimer } from "@/hooks/useTimer";
import { formatDuration } from "@/lib/billing";
import { cn } from "@/lib/utils";
import QuickSwitchDialog from "./QuickSwitchDialog";

type Matter = Tables<"matters"> & { client: Tables<"clients"> };

const Timer = () => {
  const {
    activeEntry,
    elapsed,
    isRunning,
    isPaused,
    isLoading,
    actions,
  } = useTimer();

  const [matterPickerOpen, setMatterPickerOpen] = useState(false);
  const [search, setSearch] = useState("");

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
      <Card>
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
          <div
            className={cn(
              "text-5xl font-mono font-bold text-center tabular-nums tracking-tight py-2",
              isRunning && "text-green-600 dark:text-green-400",
              isPaused && "text-yellow-600 dark:text-yellow-400 animate-pulse",
            )}
            role="timer"
            aria-live="polite"
            aria-label={`Timer: ${formatDuration(elapsed)}`}
          >
            {formatDuration(elapsed)}
          </div>
          <div className="flex justify-center gap-3">
            <Button
              size="icon"
              variant="outline"
              onClick={handleTogglePlay}
              disabled={isLoading}
              aria-label={isRunning ? "Pause timer" : isPaused ? "Resume timer" : "Start timer"}
              className="h-12 w-12 rounded-full"
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
              className="h-12 w-12 rounded-full"
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
        </DialogContent>
      </Dialog>

      <QuickSwitchDialog />
    </>
  );
};

export default Timer;
