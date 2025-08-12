import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SEO from "@/components/SEO";

function toISO(d: Date) { return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString(); }

export default function Reports() {
  const [from, setFrom] = useState<string>(() => toISO(new Date(new Date().setDate(new Date().getDate()-7))).slice(0,10));
  const [to, setTo] = useState<string>(() => toISO(new Date()).slice(0,10));
  const rounding = localStorage.getItem("rounding") === "1";

  const { data } = useQuery({
    queryKey: ["report", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entries")
        .select("id,start_at,end_at,duration_sec,notes,client:clients(name,id)")
        .gte("start_at", new Date(from + 'T00:00:00.000Z').toISOString())
        .lte("start_at", new Date(to + 'T23:59:59.999Z').toISOString());
      if (error) throw error; return data as any[];
    },
  });

  const grouped = useMemo(() => {
    const byClient = new Map<string, { name: string; total: number }>();
    let grand = 0;
    (data ?? []).forEach(e => {
      const sec = e.duration_sec ?? (e.end_at ? (new Date(e.end_at).getTime()-new Date(e.start_at).getTime())/1000 : 0);
      const clientName = e.client?.name ?? "Unknown";
      const cur = byClient.get(clientName) ?? { name: clientName, total: 0 };
      cur.total += sec; grand += sec; byClient.set(clientName, cur);
    });
    const round = (s: number) => rounding ? Math.round(s/60)*60 : s;
    return { rows: Array.from(byClient.values()).map(r => ({ ...r, total: round(r.total) })), grand: round(grand) };
  }, [data, rounding]);

  const toHhMm = (s: number) => `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}`;

  const csv = useMemo(() => {
    if (!data?.length) return "";
    const rows = [["Client","Total (hh:mm)"], ...grouped.rows.map(r => [r.name, toHhMm(r.total)])];
    return rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(",")).join("\n");
  }, [grouped, data]);

  const downloadCSV = () => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'report.csv'; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <SEO title="Reports – Time App" description="Totals by client with CSV export and print." canonical={window.location.href} />
      <Card>
        <CardHeader><CardTitle>Report range</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2"><span className="text-sm">From</span><Input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} /></div>
          <div className="flex items-center gap-2"><span className="text-sm">To</span><Input type="date" value={to} onChange={(e)=>setTo(e.target.value)} /></div>
          <Button onClick={downloadCSV} disabled={!csv}>Export CSV</Button>
          <Button variant="outline" onClick={()=>window.print()}>Print</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Totals by client</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {grouped.rows.map(r => (
            <div key={r.name} className="flex justify-between border rounded p-2">
              <div className="font-medium">{r.name}</div>
              <div>{toHhMm(r.total)}</div>
            </div>
          ))}
          <div className="flex justify-between border rounded p-2 font-semibold">
            <div>Grand total</div>
            <div>{toHhMm(grouped.grand)}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
