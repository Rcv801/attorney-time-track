import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Matter = Tables<"matters"> & { client: Tables<"clients"> };
type Entry = Tables<"entries">;
type ActiveEntry = Entry & { matter: Matter };

interface TimerContextType {
  activeEntry: ActiveEntry | null;
  elapsed: number;
  isRunning: boolean;
  isPaused: boolean;
  isLoading: boolean;
  quickSwitchState: {
    show: boolean;
    nextMatterId: string | null;
    stoppedMatterName: string;
  };
  actions: {
    start: (matterId: string, clientId: string) => void;
    stop: () => void;
    pause: () => void;
    resume: () => void;
    quickSwitch: (nextMatter: { id: string; client_id: string; name: string }) => void;
    submitQuickAction: (notes: string) => void;
    cancelQuickAction: () => void;
  };
}

const TimerContext = createContext<TimerContextType | null>(null);

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [elapsed, setElapsed] = useState<number>(0);
  const [quickSwitchState, setQuickSwitchState] = useState({
    show: false,
    nextMatterId: null as string | null,
    stoppedMatterName: "",
  });

  const { data: activeEntry, isLoading: isLoadingActive } = useQuery({
    queryKey: ["active-entry", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("entries")
        .select("*, matter:matters(*, client:clients(*))")
        .eq("user_id", user.id)
        .is("end_at", null)
        .order("start_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ActiveEntry | null;
    },
  });

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

  const startTimer = useMutation({
    mutationFn: async (vars: { matterId: string; clientId: string }) => {
      if (!user) throw new Error("Not authenticated");

      const nowIso = new Date().toISOString();

      const { error: cleanupError } = await supabase
        .from("entries")
        .update({ end_at: nowIso, paused_at: null })
        .eq("user_id", user.id)
        .is("end_at", null);

      if (cleanupError) throw cleanupError;

      const { error } = await supabase.from("entries").insert({
        matter_id: vars.matterId,
        client_id: vars.clientId,
        start_at: nowIso,
        user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["active-entry", user?.id] }),
        qc.invalidateQueries({ queryKey: ["entries-today"] }),
        qc.invalidateQueries({ queryKey: ["entries"] }),
      ]);
      setQuickSwitchState({ show: false, nextMatterId: null, stoppedMatterName: "" });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      const isDuplicate = message.includes("single_active_entry") || message.includes("only one active");
      toast({
        title: isDuplicate ? "Timer already running" : "Cannot start timer",
        description: isDuplicate
          ? "Stop your current timer before starting a new one, or use quick-switch."
          : message,
        variant: "destructive",
      });
      // Refresh active entry state so the UI stays in sync
      if (isDuplicate) {
        qc.invalidateQueries({ queryKey: ["active-entry", user?.id] });
      }
    },
  });

  const stopTimer = useMutation({
    mutationFn: async (vars: { entryId: string; notes?: string }) => {
      if (!activeEntry) return;
      const updateData: Partial<Entry> & { end_at: string } = { end_at: new Date().toISOString() };
      if (vars.notes) updateData.notes = vars.notes;

      if (activeEntry.paused_at) {
        const pausedDuration = Math.floor((Date.now() - new Date(activeEntry.paused_at).getTime()) / 1000);
        updateData.total_paused_seconds = (activeEntry.total_paused_seconds || 0) + pausedDuration;
        updateData.paused_at = null;
      }

      const { error } = await supabase.from("entries").update(updateData).eq("id", vars.entryId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["active-entry", user?.id] }),
        qc.invalidateQueries({ queryKey: ["entries-today"] }),
        qc.invalidateQueries({ queryKey: ["entries"] }),
      ]);
      setQuickSwitchState({ show: false, nextMatterId: null, stoppedMatterName: "" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Cannot stop timer",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const pauseTimer = useMutation({
    mutationFn: async () => {
      if (!activeEntry) return;
      const { error } = await supabase.from("entries").update({ paused_at: new Date().toISOString() }).eq("id", activeEntry.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["active-entry", user?.id] }),
    onError: (error: unknown) =>
      toast({
        title: "Cannot pause",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      }),
  });

  const resumeTimer = useMutation({
    mutationFn: async () => {
      if (!activeEntry?.paused_at) return;
      const pausedDuration = Math.floor((Date.now() - new Date(activeEntry.paused_at).getTime()) / 1000);
      const newTotalPaused = (activeEntry.total_paused_seconds || 0) + pausedDuration;
      const { error } = await supabase.from("entries").update({ paused_at: null, total_paused_seconds: newTotalPaused }).eq("id", activeEntry.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["active-entry", user?.id] }),
    onError: (error: unknown) =>
      toast({
        title: "Cannot resume",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      }),
  });

  const handleStart = useCallback((matterId: string, clientId: string) => {
    startTimer.mutate({ matterId, clientId });
  }, [startTimer]);

  const handleStop = useCallback(() => {
    if (activeEntry) {
      setQuickSwitchState({
        show: true,
        nextMatterId: null,
        stoppedMatterName: activeEntry.matter?.name ?? "Unknown",
      });
    }
  }, [activeEntry]);

  const handlePause = useCallback(() => pauseTimer.mutate(), [pauseTimer]);
  const handleResume = useCallback(() => resumeTimer.mutate(), [resumeTimer]);

  const handleQuickSwitch = useCallback((nextMatter: { id: string; client_id: string; name: string }) => {
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
  }, [activeEntry, handleStart]);

  const submitQuickAction = useCallback((notes: string) => {
    if (!activeEntry) return;
    stopTimer.mutate(
      { entryId: activeEntry.id, notes },
      {
        onSuccess: () => {
          if (quickSwitchState.nextMatterId) {
            const nextMatter = (qc.getQueryData(["matters-all-active"]) as Matter[] | undefined)?.find(
              (matter) => matter.id === quickSwitchState.nextMatterId,
            );
            if (nextMatter) {
              startTimer.mutate({ matterId: nextMatter.id, clientId: nextMatter.client_id });
            }
          }
        },
      },
    );
  }, [activeEntry, quickSwitchState.nextMatterId, stopTimer, startTimer, qc]);

  const cancelQuickAction = useCallback(() => {
    setQuickSwitchState({ show: false, nextMatterId: null, stoppedMatterName: "" });
  }, []);

  const isRunning = !!activeEntry && !activeEntry.paused_at;
  const isPaused = !!activeEntry?.paused_at;
  const isLoading =
    isLoadingActive ||
    startTimer.isPending ||
    stopTimer.isPending ||
    pauseTimer.isPending ||
    resumeTimer.isPending;

  return (
    <TimerContext.Provider
      value={{
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
      }}
    >
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error("useTimer must be used within a TimerProvider");
  }
  return context;
}
