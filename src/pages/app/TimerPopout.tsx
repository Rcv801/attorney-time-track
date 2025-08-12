import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import SEO from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";
import EntryFormDialog from "@/components/EntryFormDialog";

export default function TimerPopout() {
  const qc = useQueryClient();
  const { user } = useAuth();
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
    },
  });

  const stopMut = useMutation({
    mutationFn: async () => {
      if (!active?.id) return;
      const { error } = await supabase.from("entries").update({ end_at: new Date().toISOString(), notes }).eq("id", active.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["active-entry"] });
    },
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
    <div className="min-h-screen bg-background text-foreground">
      <SEO title="Timer Popout – Time App" description="Compact popout timer with client, notes, and start/stop controls." canonical={window.location.href} />
      <header className="flex items-center justify-between px-4 py-2 border-b">
        <h1 className="text-base font-semibold">Timer Popout</h1>
        <div className="text-xs text-muted-foreground">{running ? fmt.format(activeAmount || 0) : ''}</div>
      </header>
      <main className="p-4 space-y-4">
        <div className="text-5xl font-bold tracking-tight">{elapsedHMS}</div>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <Select onValueChange={setClientId} value={clientId || active?.client_id || ""}>
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
          <div className="flex flex-col gap-2">
            <Textarea rows={6} placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
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
          <div className="flex items-center gap-2">
            {running ? (
              <>
                <Button onClick={() => stopMut.mutate()} disabled={stopMut.isPending}>Stop</Button>
                {active?.id && (
                  <EntryFormDialog
                    trigger={<Button variant="outline" size="sm">Edit Active</Button>}
                    title="Edit active entry"
                    initial={{ id: active.id, client_id: active.client_id, start_at: active.start_at, end_at: active.end_at, notes: active.notes }}
                    clients={clients}
                    onSubmit={async (v) => {
                      await supabase.from("entries").update({
                        client_id: v.client_id,
                        start_at: v.start_at,
                        end_at: v.end_at ?? null,
                        notes: v.notes ?? null,
                      }).eq("id", v.id!);
                      qc.invalidateQueries({ queryKey: ["active-entry"] });
                    }}
                  />
                )}
              </>
            ) : (
              <>
                <Button onClick={() => startMut.mutate()} disabled={startMut.isPending || !clientId || !user}>Start</Button>
                <EntryFormDialog
                  trigger={<Button variant="secondary" size="sm">Add Entry</Button>}
                  title="Add entry"
                  clients={clients}
                  onSubmit={async (v) => {
                    if (!user) return;
                    await supabase.from("entries").insert({
                      user_id: user.id,
                      client_id: v.client_id,
                      start_at: v.start_at,
                      end_at: v.end_at ?? null,
                      notes: v.notes ?? null,
                    });
                    qc.invalidateQueries({ queryKey: ["active-entry"] });
                  }}
                />
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
