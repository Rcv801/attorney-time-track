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
        .select("id,start_at,end_at,duration_sec,notes,client:clients(name,id,hourly_rate)")
        .gte("start_at", new Date(from + 'T00:00:00.000Z').toISOString())
        .lte("start_at", new Date(to + 'T23:59:59.999Z').toISOString());
      if (error) throw error; return data as any[];
    },
  });

  const grouped = useMemo(() => {
    const byClient = new Map<string, { name: string; total: number; amount: number }>();
    let grandSec = 0; let grandAmt = 0;
    (data ?? []).forEach((e: any) => {
      const sec = e.duration_sec ?? (e.end_at ? (new Date(e.end_at).getTime()-new Date(e.start_at).getTime())/1000 : 0);
      const rate = Number(e.client?.hourly_rate ?? 0);
      const name = e.client?.name ?? "Unknown";
      const cur = byClient.get(name) ?? { name, total: 0, amount: 0 };
      cur.total += sec;
      cur.amount += (sec/3600) * rate;
      byClient.set(name, cur);
      grandSec += sec; grandAmt += (sec/3600) * rate;
    });
    const roundSec = (s: number) => rounding ? Math.ceil(s/60)*60 : s;
    const rows = Array.from(byClient.values()).map(r => ({
      name: r.name,
      total: roundSec(r.total),
      amount: (roundSec(r.total)/3600) * ((data?.find((e:any)=> e.client?.name===r.name)?.client?.hourly_rate) ?? 0) || r.amount,
    }));
    const grand = roundSec(grandSec);
    const grandAmount = rows.reduce((sum, r) => sum + r.amount, 0);
    return { rows, grand, grandAmount };
  }, [data, rounding]);

  const toHhMm = (s: number) => `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}`;
  const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });

  const csv = useMemo(() => {
    if (!data?.length) return "";
    const rows = [["Client","Total (hh:mm)","Amount"], ...grouped.rows.map(r => [r.name, toHhMm(r.total), (r.amount ?? 0).toFixed(2)])];
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
              <div className="text-right">
                <div>{toHhMm(r.total)}</div>
                <div className="text-sm text-muted-foreground">{fmt.format(r.amount ?? 0)}</div>
              </div>
            </div>
          ))}
          <div className="flex justify-between border rounded p-2 font-semibold">
            <div>Grand total</div>
            <div className="text-right">
              <div>{toHhMm(grouped.grand)}</div>
              <div className="text-sm text-muted-foreground">{fmt.format(grouped.grandAmount)}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
