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
  const [notes, setNotes] = useState("");
  const [elapsed, setElapsed] = useState<number>(0);

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
        .select("id,start_at,notes,client_id,end_at")
        .is("end_at", null)
        .maybeSingle();
      if (error) throw error; return data as any;
    },
  });

  useEffect(() => {
    if (!active?.start_at) { setElapsed(0); return; }
    const start = new Date(active.start_at).getTime();
    const i = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(i);
  }, [active?.start_at]);

  const { data: todays } = useQuery({
    queryKey: ["entries-today"],
    queryFn: async () => {
      const from = startOfLocalDayUtc().toISOString();
      const { data, error } = await supabase
        .from("entries")
        .select("id,start_at,end_at,duration_sec,notes,client:clients(name,hourly_rate,color)")
        .gte("start_at", from)
        .order("start_at", { ascending: false });
      if (error) throw error; return data as any[];
    },
  });

  const startMut = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("Select a client");
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("entries").insert({ client_id: clientId, start_at: new Date().toISOString(), notes, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      setNotes("");
      qc.invalidateQueries({ queryKey: ["active-entry"] });
      qc.invalidateQueries({ queryKey: ["entries-today"] });
    },
    onError: (e: any) => toast({ title: "Cannot start", description: e.message }),
  });

  const stopMut = useMutation({
    mutationFn: async () => {
      if (!active?.id) return;
      const { error } = await supabase.from("entries").update({ end_at: new Date().toISOString(), notes }).eq("id", active.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["active-entry"] });
      qc.invalidateQueries({ queryKey: ["entries-today"] });
    },
    onError: (e: any) => toast({ title: "Cannot stop", description: e.message }),
  });

  const running = Boolean(active);
  const activeRate = clients?.find(c => c.id === (active?.client_id ?? clientId))?.hourly_rate ?? 0;
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

  return (
    <div className="space-y-6">
      <SEO title="Dashboard – Time App" description="Track time with a Start/Stop timer and see today’s entries." canonical={window.location.href} />
      <Card>
        <CardHeader>
          <CardTitle>Timer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-5xl font-bold">{elapsedHMS}</div>
          {running && <div className="text-muted-foreground">So far: {fmt.format(activeAmount || 0)}</div>}
          <div className="grid sm:grid-cols-3 gap-3">
            <Select onValueChange={setClientId} value={clientId}>
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
            <div className="flex flex-col gap-2">
              <Textarea rows={7} placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">Expand</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit notes</DialogTitle>
                  </DialogHeader>
                  <Textarea rows={12} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </DialogContent>
              </Dialog>
            </div>
            {running ? (
              <Button onClick={() => stopMut.mutate()} disabled={stopMut.isPending}>Stop</Button>
            ) : (
              <Button onClick={() => startMut.mutate()} disabled={startMut.isPending || !clientId || !user}>Start</Button>
            )}
          </div>
        </CardContent>
      </Card>

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
