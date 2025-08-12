import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SEO from "@/components/SEO";

function toISO(d: Date) { return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString(); }

export default function Entries() {
  const [from, setFrom] = useState<string>(() => toISO(new Date(new Date().setDate(new Date().getDate()-7))).slice(0,10));
  const [to, setTo] = useState<string>(() => toISO(new Date()).slice(0,10));

  const { data } = useQuery({
    queryKey: ["entries", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entries")
        .select("id,start_at,end_at,duration_sec,notes,client:clients(name,hourly_rate,color)")
        .gte("start_at", new Date(from + 'T00:00:00.000Z').toISOString())
        .lte("start_at", new Date(to + 'T23:59:59.999Z').toISOString())
        .order("start_at", { ascending: false });
      if (error) throw error; return data as any[];
    }
  });

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
    const header = ["Client","Start","End","Duration(sec)","Amount","Notes"];
    const rows = data.map((e: any) => {
      const s = e.duration_sec ?? (e.end_at ? (new Date(e.end_at).getTime()-new Date(e.start_at).getTime())/1000 : 0);
      const amt = (s/3600) * Number(e.client?.hourly_rate ?? 0);
      return [e.client?.name, e.start_at, e.end_at ?? "", s, amt.toFixed(2), (e.notes ?? "").replace(/\n/g, " ")];
    });
    return [header, ...rows].map(r => r.map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(",")).join("\n");
  }, [data]);

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
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Entries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data?.map((e)=> (
            <div key={e.id} className="grid md:grid-cols-5 gap-2 border rounded p-2 text-sm">
              <div className="font-medium">{e.client?.name}</div>
              <div>{new Date(e.start_at).toLocaleString()}</div>
              <div>{e.end_at ? new Date(e.end_at).toLocaleString() : "–"}</div>
              <div>{e.duration_sec ? `${Math.floor(e.duration_sec/3600)}h ${Math.floor((e.duration_sec%3600)/60)}m` : "–"}</div>
              <div className="md:col-span-5">{e.notes}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
