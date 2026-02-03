import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";
import EntryFormDialog from "@/components/EntryFormDialog";
import StopTimerDialog from "@/components/StopTimerDialog";

function startOfLocalDayUtc() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return new Date(start.getTime() - start.getTimezoneOffset() * 60000);
}

export default function Dashboard() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [clientId, setClientId] = useState<string>("");
  const [elapsed, setElapsed] = useState<number>(0);
  const [showStopDialog, setShowStopDialog] = useState(false);

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id,name,color,hourly_rate").order("name");
      if (error) throw error; return data as any[];
    },
  });

  const { data: active } = useQuery({
    queryKey: ["active-entry"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entries")
        .select("id,start_at,notes,client_id,end_at,paused_at,total_paused_seconds")
        .is("end_at", null)
        .maybeSingle();
      if (error) throw error; return data as any;
    },
  });

  useEffect(() => {
    if (!active?.start_at) { setElapsed(0); return; }
    
    // Parse timestamps once to avoid repeated parsing
    const startTime = new Date(active.start_at).getTime();
    const pausedAtTime = active.paused_at ? new Date(active.paused_at).getTime() : null;
    const totalPaused = active.total_paused_seconds || 0;
    
    // Update elapsed time every second
    // This approach prevents drift by calculating from Date.now() on each tick
    // rather than incrementing a counter
    const i = setInterval(() => {
      if (pausedAtTime) {
        // Timer is paused: show time from start to pause point, minus total paused duration
        const pausedElapsed = Math.floor((pausedAtTime - startTime) / 1000) - totalPaused;
        setElapsed(pausedElapsed);
      } else {
        // Timer is running: calculate current elapsed time minus total paused duration
        // Using Date.now() ensures accuracy and prevents drift over long periods
        const currentElapsed = Math.floor((Date.now() - startTime) / 1000) - totalPaused;
        setElapsed(currentElapsed);
      }
    }, 1000);
    
    return () => clearInterval(i);
  }, [active?.start_at, active?.paused_at, active?.total_paused_seconds]);

  const { data: todays } = useQuery({
    queryKey: ["entries-today"],
    queryFn: async () => {
      const from = startOfLocalDayUtc().toISOString();
      const { data, error } = await supabase
        .from("entries")
        .select("id,client_id,start_at,end_at,duration_sec,notes,client:clients(name,hourly_rate,color)")
        .gte("start_at", from)
        .order("start_at", { ascending: false });
      if (error) throw error; return data as any[];
    },
  });

  const startMut = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("Select a client");
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("entries").insert({ client_id: clientId, start_at: new Date().toISOString(), user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["active-entry"] });
      qc.invalidateQueries({ queryKey: ["entries-today"] });
    },
    onError: (e: any) => toast({ title: "Cannot start", description: e.message }),
  });

  const pauseMut = useMutation({
    mutationFn: async () => {
      if (!active?.id) return;
      const { error } = await supabase.from("entries").update({ 
        paused_at: new Date().toISOString()
      }).eq("id", active.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["active-entry"] });
    },
    onError: (e: any) => toast({ title: "Cannot pause", description: e.message }),
  });

  const resumeMut = useMutation({
    mutationFn: async () => {
      if (!active?.id || !active?.paused_at) return;
      const pausedDuration = Math.floor((Date.now() - new Date(active.paused_at).getTime()) / 1000);
      const newTotalPaused = (active.total_paused_seconds || 0) + pausedDuration;
      
      const { error } = await supabase.from("entries").update({ 
        paused_at: null,
        total_paused_seconds: newTotalPaused
      }).eq("id", active.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["active-entry"] });
    },
    onError: (e: any) => toast({ title: "Cannot resume", description: e.message }),
  });

  const stopMut = useMutation({
    mutationFn: async (notes: string) => {
      if (!active?.id) return;
      let updateData: any = { end_at: new Date().toISOString(), notes };
      
      // If paused, calculate final paused time
      if (active.paused_at) {
        const pausedDuration = Math.floor((Date.now() - new Date(active.paused_at).getTime()) / 1000);
        updateData.total_paused_seconds = (active.total_paused_seconds || 0) + pausedDuration;
        updateData.paused_at = null;
      }
      
      const { error } = await supabase.from("entries").update(updateData).eq("id", active.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setShowStopDialog(false);
      qc.invalidateQueries({ queryKey: ["active-entry"] });
      qc.invalidateQueries({ queryKey: ["entries-today"] });
    },
    onError: (e: any) => toast({ title: "Cannot stop", description: e.message }),
  });

  const handleStopTimer = () => {
    setShowStopDialog(true);
  };

  const handleConfirmStop = (notes: string) => {
    stopMut.mutate(notes);
  };

  const running = Boolean(active);
  const paused = Boolean(active?.paused_at);
  const activeRate = clients?.find(c => c.id === (active?.client_id ?? clientId))?.hourly_rate ?? 0;
  
  // Calculate billing amount based on elapsed time (which already excludes paused duration)
  // This ensures paused timers show accurate billing amounts
  const activeAmount = running ? (elapsed/3600) * Number(activeRate ?? 0) : 0;
  const elapsedHMS = useMemo(() => {
    let s = 0;
    if (running && active?.start_at) {
      s = elapsed;
    } else if (active?.start_at && active?.end_at) {
      s = Math.floor((new Date(active.end_at).getTime() - new Date(active.start_at).getTime()) / 1000);
    }
    const hh = String(Math.floor(s / 3600)).padStart(2, "0");
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }, [elapsed, running, active]);
  const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const onCreate = async (values: { client_id: string; start_at: string; end_at?: string | null; notes?: string | null }) => {
    if (!user) return;
    const { error } = await supabase.from("entries").insert({
      user_id: user.id,
      client_id: values.client_id,
      start_at: values.start_at,
      end_at: values.end_at ?? null,
      notes: values.notes ?? null,
    });
    if (!error) {
      qc.invalidateQueries({ queryKey: ["entries-today"] });
    }
  };

  const onUpdate = async (values: { id?: string; client_id: string; start_at: string; end_at?: string | null; notes?: string | null }) => {
    if (!values.id) return;
    const { error } = await supabase.from("entries").update({
      client_id: values.client_id,
      start_at: values.start_at,
      end_at: values.end_at ?? null,
      notes: values.notes ?? null,
    }).eq("id", values.id);
    if (!error) {
      qc.invalidateQueries({ queryKey: ["entries-today"] });
    }
  };

  return (
    <div className="space-y-6">
      <SEO title="Dashboard – Time App" description="Track time with a Start/Stop timer and see today’s entries." canonical={window.location.href} />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Timer</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('/popout/timer', 'timer-popout', 'width=380,height=560,menubar=no,toolbar=no,location=no,status=no')}
          >
            Open Popout
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-6xl md:text-7xl font-bold">{elapsedHMS}</div>
          {running && <div className="text-muted-foreground">So far: {fmt.format(activeAmount || 0)}</div>}
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">Using time zone: {tz}</div>
              <EntryFormDialog
                trigger={<Button variant="secondary" size="sm">Add Entry</Button>}
                title="Add entry"
                clients={clients}
                onSubmit={onCreate}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="md:col-span-1">
                <label className="text-sm font-medium mb-2 block">Client</label>
                <Select onValueChange={setClientId} value={clientId || active?.client_id || ""} disabled={running}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="inline-flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: c.color ?? '#9ca3af' }} />{c.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-1 space-y-2">
                {running ? (
                  <div className="space-y-2">
                    {paused ? (
                      <Button onClick={() => resumeMut.mutate()} disabled={resumeMut.isPending} className="w-full">Resume</Button>
                    ) : (
                      <Button onClick={() => pauseMut.mutate()} disabled={pauseMut.isPending} variant="secondary" className="w-full">Pause</Button>
                    )}
                    <Button onClick={handleStopTimer} disabled={stopMut.isPending} className="w-full">Stop</Button>
                  </div>
                ) : (
                  <Button onClick={() => startMut.mutate()} disabled={startMut.isPending || !clientId || !user} className="w-full">Start</Button>
                )}
              </div>
            </div>
        </CardContent>
      </Card>

      <StopTimerDialog
        open={showStopDialog}
        onOpenChange={setShowStopDialog}
        onConfirm={handleConfirmStop}
        isLoading={stopMut.isPending}
      />

      <Card>
        <CardHeader>
          <CardTitle>Today’s entries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {todays?.length ? todays.map((e) => {
            const amount = e.duration_sec ? (Number(e.client?.hourly_rate ?? 0) * (e.duration_sec / 3600)) : 0;
            return (
              <div key={e.id} className="flex items-center justify-between border rounded p-2">
                <div className="text-sm">
                  <div className="font-medium">{e.client?.name}</div>
                  <div className="text-muted-foreground">{new Date(e.start_at).toLocaleTimeString()} – {e.end_at ? new Date(e.end_at).toLocaleTimeString() : "…"}</div>
                  <div>{e.notes}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm font-medium">{amount ? fmt.format(amount) : ""}</div>
                  <EntryFormDialog
                    trigger={<Button variant="outline" size="sm">Edit</Button>}
                    title="Edit entry"
                    initial={{ id: e.id, client_id: e.client?.id ?? e.client_id, start_at: e.start_at, end_at: e.end_at, notes: e.notes }}
                    clients={clients}
                    onSubmit={onUpdate}
                  />
                  <Button variant="outline" size="sm" onClick={async () => {
                    await supabase.from("entries").delete().eq("id", e.id);
                    qc.invalidateQueries({ queryKey: ["entries-today"] });
                  }}>Delete</Button>
                </div>
              </div>
            );
          }) : <div className="text-sm text-muted-foreground">No entries yet.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
