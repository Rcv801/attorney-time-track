import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Matter = Tables<"matters"> & { client: Tables<"clients"> };
type Entry = Tables<"entries">;
type ActiveEntry = Entry & { matter: Matter };

export function useTimer() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [elapsed, setElapsed] = useState<number>(0);
  const [quickSwitchState, setQuickSwitchState] = useState<{
    show: boolean;
    nextMatterId: string | null;
    stoppedMatterName: string;
  }>({ show: false, nextMatterId: null, stoppedMatterName: "" });

  // Fetch active timer entry
  const { data: activeEntry, isLoading: isLoadingActive } = useQuery({
    queryKey: ["active-entry"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entries")
        .select("*, matter:matters(*, client:clients(*))")
        .is("end_at", null)
        .maybeSingle();
      if (error) throw error;
      return data as ActiveEntry | null;
    },
  });

  // Timer interval effect
  useEffect(() => {
    if (!activeEntry?.start_at) {
      setElapsed(0);
      return;
    }

    const startTime = new Date(activeEntry.start_at).getTime();
    const pausedAtTime = activeEntry.paused_at ? new Date(activeEntry.paused_at).getTime() : null;
    const totalPaused = activeEntry.total_paused_seconds || 0;

    const intervalId = setInterval(() => {
      if (pausedAtTime) {
        const pausedElapsed = Math.floor((pausedAtTime - startTime) / 1000) - totalPaused;
        setElapsed(pausedElapsed < 0 ? 0 : pausedElapsed);
      } else {
        const currentElapsed = Math.floor((Date.now() - startTime) / 1000) - totalPaused;
        setElapsed(currentElapsed < 0 ? 0 : currentElapsed);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [activeEntry?.start_at, activeEntry?.paused_at, activeEntry?.total_paused_seconds]);

  // Mutations
  const startTimer = useMutation({
    mutationFn: async (vars: { matterId: string; clientId: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { matterId, clientId } = vars;
      const { error } = await supabase.from("entries").insert({
        matter_id: matterId,
        client_id: clientId,
        start_at: new Date().toISOString(),
        user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["active-entry"] });
      qc.invalidateQueries({ queryKey: ["entries-today"] });
      setQuickSwitchState({ show: false, nextMatterId: null, stoppedMatterName: "" });
    },
    onError: (e: any) => {
      toast({ title: "Cannot start timer", description: e.message, variant: "destructive" });
    },
  });

  const stopTimer = useMutation({
    mutationFn: async (vars: { entryId: string; notes?: string }) => {
      if (!activeEntry) return;
      const { entryId, notes } = vars;
      const updateData: Partial<Entry> & { end_at: string } = { end_at: new Date().toISOString() };
      if (notes) updateData.notes = notes;

      if (activeEntry.paused_at) {
        const pausedDuration = Math.floor((Date.now() - new Date(activeEntry.paused_at).getTime()) / 1000);
        updateData.total_paused_seconds = (activeEntry.total_paused_seconds || 0) + pausedDuration;
        updateData.paused_at = null;
      }

      const { error } = await supabase.from("entries").update(updateData).eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["active-entry"] });
      qc.invalidateQueries({ queryKey: ["entries-today"] });
      setQuickSwitchState({ show: false, nextMatterId: null, stoppedMatterName: "" });
    },
    onError: (e: any) => {
      toast({ title: "Cannot stop timer", description: e.message, variant: "destructive" });
    },
  });

  const pauseTimer = useMutation({
    mutationFn: async () => {
      if (!activeEntry) return;
      const { error } = await supabase.from("entries").update({ paused_at: new Date().toISOString() }).eq("id", activeEntry.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["active-entry"] }),
    onError: (e: any) => toast({ title: "Cannot pause", description: e.message, variant: "destructive" }),
  });

  const resumeTimer = useMutation({
    mutationFn: async () => {
      if (!activeEntry?.paused_at) return;
      const pausedDuration = Math.floor((Date.now() - new Date(activeEntry.paused_at).getTime()) / 1000);
      const newTotalPaused = (activeEntry.total_paused_seconds || 0) + pausedDuration;
      const { error } = await supabase.from("entries").update({ paused_at: null, total_paused_seconds: newTotalPaused }).eq("id", activeEntry.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["active-entry"] }),
    onError: (e: any) => toast({ title: "Cannot resume", description: e.message, variant: "destructive" }),
  });

  // Event Handlers
  const handleStart = (matterId: string, clientId: string) => {
    startTimer.mutate({ matterId, clientId });
  };

  const handleStop = () => {
    if (activeEntry) {
      setQuickSwitchState({
        show: true,
        nextMatterId: null, // This is a manual stop, not a switch
        stoppedMatterName: activeEntry.matter?.name ?? "Unknown",
      });
    }
  };

  const handlePause = () => pauseTimer.mutate();
  const handleResume = () => resumeTimer.mutate();

  const handleQuickSwitch = (nextMatter: { id: string; client_id: string; name: string }) => {
    if (!activeEntry) {
      handleStart(nextMatter.id, nextMatter.client_id);
      return;
    }

    if (activeEntry.matter_id === nextMatter.id) return;

    setQuickSwitchState({
      show: true,
      nextMatterId: nextMatter.id,
      stoppedMatterName: activeEntry.matter?.name ?? "Unknown",
    });
  };

  const submitQuickAction = (notes: string) => {
    if (!activeEntry) return;
    stopTimer.mutate(
      { entryId: activeEntry.id, notes },
      {
        onSuccess: () => {
          if (quickSwitchState.nextMatterId) {
            const nextMatter = (qc.getQueryData(["matters"]) as Matter[] | undefined)?.find(m => m.id === quickSwitchState.nextMatterId);
            if(nextMatter) {
              startTimer.mutate({ matterId: nextMatter.id, clientId: nextMatter.client_id });
            }
          }
        },
      }
    );
  };

  const cancelQuickAction = () => {
     setQuickSwitchState({ show: false, nextMatterId: null, stoppedMatterName: "" });
  };


  const isRunning = !!activeEntry && !activeEntry.paused_at;
  const isPaused = !!activeEntry?.paused_at;
  const isLoading = isLoadingActive || startTimer.isPending || stopTimer.isPending || pauseTimer.isPending || resumeTimer.isPending;

  return {
    activeEntry,
    elapsed,
    isRunning,
    isPaused,
    isLoading,
    quickSwitchState,
    actions: {
      start: handleStart,
      stop: handleStop,
      pause: handlePause,
      resume: handleResume,
      quickSwitch: handleQuickSwitch,
      submitQuickAction,
      cancelQuickAction,
    },
  };
}
