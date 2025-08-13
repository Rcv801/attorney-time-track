import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SEO from "@/components/SEO";
import EntryFormDialog from "@/components/EntryFormDialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
function toISO(d: Date) { return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString(); }

export default function Entries() {
  const [from, setFrom] = useState<string>(() => toISO(new Date(new Date().setDate(new Date().getDate()-7))).slice(0,10));
  const [to, setTo] = useState<string>(() => toISO(new Date()).slice(0,10));

  const { data } = useQuery({
    queryKey: ["entries", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entries")
        .select("id,client_id,start_at,end_at,duration_sec,notes,billed,client:clients(name,hourly_rate)")
        .gte("start_at", new Date(from + 'T00:00:00.000Z').toISOString())
        .lte("start_at", new Date(to + 'T23:59:59.999Z').toISOString())
        .order("start_at", { ascending: false });
      if (error) throw error; return data as any[];
    }
  });

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id,name,color,hourly_rate").order("name");
      if (error) throw error; return data as any[];
    },
  });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });

  const totals = useMemo(() => {
    let seconds = 0; let amount = 0;
    (data ?? []).forEach((e: any) => {
      const s = e.duration_sec ?? (e.end_at ? (new Date(e.end_at).getTime()-new Date(e.start_at).getTime())/1000 : 0);
      seconds += s;
      amount += (s/3600) * Number(e.client?.hourly_rate ?? 0);
    });
    return { seconds, amount };
  }, [data]);

  const toHhMm = (s: number) => `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}`;

  const csv = useMemo(() => {
    if (!data?.length) return "";
    const header = ["Client","Start","End","Duration(sec)","Amount","Billed","Notes"];
    const rows = data.map((e: any) => {
      const s = e.duration_sec ?? (e.end_at ? (new Date(e.end_at).getTime()-new Date(e.start_at).getTime())/1000 : 0);
      const amt = (s/3600) * Number(e.client?.hourly_rate ?? 0);
      return [e.client?.name, e.start_at, e.end_at ?? "", s, amt.toFixed(2), e.billed ? "Yes" : "No", (e.notes ?? "").replace(/\n/g, " ")];
    });
    return [header, ...rows].map(r => r.map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(",")).join("\n");
  }, [data]);

  const onCreate = async (values: { client_id: string; start_at: string; end_at?: string | null; notes?: string | null }) => {
    if (!user) { toast({ title: "Not signed in", description: "Please sign in to add an entry." }); return; }
    const { error } = await supabase.from("entries").insert({
      user_id: user.id,
      client_id: values.client_id,
      start_at: values.start_at,
      end_at: values.end_at ?? null,
      notes: values.notes ?? null,
    });
    if (error) { toast({ title: "Could not add entry", description: error.message }); }
    else { qc.invalidateQueries({ queryKey: ["entries"] }); toast({ title: "Entry added" }); }
  };

  const onUpdate = async (values: { id?: string; client_id: string; start_at: string; end_at?: string | null; notes?: string | null }) => {
    if (!values.id) return;
    const { error } = await supabase.from("entries").update({
      client_id: values.client_id,
      start_at: values.start_at,
      end_at: values.end_at ?? null,
      notes: values.notes ?? null,
    }).eq("id", values.id);
    if (error) { toast({ title: "Could not update entry", description: error.message }); }
    else { qc.invalidateQueries({ queryKey: ["entries"] }); toast({ title: "Entry updated" }); }
  };

  const onToggleBilled = async (id: string, billed: boolean) => {
    const { error } = await supabase.from("entries").update({ billed }).eq("id", id);
    if (error) {
      toast({ title: "Could not update billed status", description: error.message });
    } else {
      qc.invalidateQueries({ queryKey: ["entries"] });
      toast({ title: billed ? "Marked as billed" : "Marked as unbilled" });
    }
  };

  const onDelete = async (id: string) => {
    const { error } = await supabase.from("entries").delete().eq("id", id);
    if (error) {
      toast({ title: "Could not delete entry", description: error.message });
    } else {
      qc.invalidateQueries({ queryKey: ["entries"] });
      toast({ title: "Entry deleted" });
    }
  };

  const downloadCSV = () => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'entries.csv'; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-6">
      <SEO title="Entries – Time App" description="Browse and export time entries." canonical={window.location.href} />
      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm">From</span>
            <Input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">To</span>
            <Input type="date" value={to} onChange={(e)=>setTo(e.target.value)} />
          </div>
          <Button onClick={downloadCSV} disabled={!csv}>Export CSV</Button>
          <Button variant="outline" onClick={()=>window.print()}>Print</Button>
          <EntryFormDialog
            trigger={<Button variant="secondary">Add Entry</Button>}
            title="Add entry"
            clients={clients}
            onSubmit={onCreate}
          />
          <div className="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
            <span>Totals: {toHhMm(totals.seconds)} • {fmt.format(totals.amount)}</span>
            <span className="text-xs">Using time zone: {tz}</span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Entries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data?.map((e)=> (
            <div key={e.id} className="grid md:grid-cols-6 gap-2 border rounded p-2 text-sm">
              <div className="font-medium">{e.client?.name}</div>
              <div>{new Date(e.start_at).toLocaleString()}</div>
              <div>{e.end_at ? new Date(e.end_at).toLocaleString() : "–"}</div>
              <div>{e.duration_sec ? `${Math.floor(e.duration_sec/3600)}h ${Math.floor((e.duration_sec%3600)/60)}m` : "–"}</div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`billed-${e.id}`}
                  checked={!!e.billed}
                  onCheckedChange={(v) => onToggleBilled(e.id, Boolean(v))}
                  aria-label="Mark entry as billed"
                />
                <label htmlFor={`billed-${e.id}`} className="text-xs">Billed</label>
              </div>
              <div className="md:col-span-6">{e.notes}</div>
              <div className="md:col-span-6 flex justify-end gap-2">
                <EntryFormDialog
                  trigger={<Button variant="outline" size="sm">Edit</Button>}
                  title="Edit entry"
                  initial={{ id: e.id, client_id: e.client_id, start_at: e.start_at, end_at: e.end_at, notes: e.notes }}
                  clients={clients}
                  onSubmit={onUpdate}
                />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">Delete</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete entry?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. The entry will be permanently removed.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDelete(e.id)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
