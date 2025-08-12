import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SEO from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";

export default function Clients() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>("#4f46e5");
  const [rate, setRate] = useState<string>("0");

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id,name,archived,color,hourly_rate").order("name");
      if (error) throw error; return data;
    },
  });

  const add = async () => {
    if (!name.trim() || !user) return;
    const hourly_rate = Number.parseFloat(rate || "0");
    await supabase.from("clients").insert({ name, user_id: user.id, color, hourly_rate });
    setName("");
    qc.invalidateQueries({ queryKey: ["clients"] });
  };

  const toggleArchive = async (id: string, archived: boolean) => {
    await supabase.from("clients").update({ archived: !archived }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["clients"] });
  };

  const rename = async (id: string, currentName: string, currentRate: number, currentColor?: string | null) => {
    const v = prompt("New name?", currentName) ?? currentName;
    const r = prompt("Hourly rate?", String(currentRate ?? 0)) ?? String(currentRate ?? 0);
    const c = prompt("Color (hex)", currentColor ?? "#4f46e5") ?? (currentColor ?? "#4f46e5");
    await supabase.from("clients").update({ name: v, hourly_rate: Number.parseFloat(r || "0"), color: c }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["clients"] });
  };

  return (
    <div className="space-y-6">
      <SEO title="Clients – Time App" description="Manage clients for time tracking." canonical={window.location.href} />
      <Card>
        <CardHeader>
          <CardTitle>Add client</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-4 gap-2 items-center">
          <Input placeholder="Client name" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex items-center gap-2">
            <span className="text-sm">Color</span>
            <input type="color" value={color} onChange={(e)=>setColor(e.target.value)} className="h-9 w-12 rounded" />
          </div>
          <Input type="number" step="0.01" placeholder="Hourly rate" value={rate} onChange={(e)=>setRate(e.target.value)} />
          <Button onClick={add} disabled={!name.trim()}>Add</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>All clients</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {clients?.map((c) => (
            <div key={c.id} className="flex items-center justify-between border rounded p-2">
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: c.color ?? '#9ca3af' }} />
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.archived ? "Archived" : "Active"} • ${Number(c.hourly_rate ?? 0).toFixed(2)}/hr</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={c.color ?? '#9ca3af'}
                  onChange={async (e) => {
                    await supabase.from('clients').update({ color: e.target.value }).eq('id', c.id)
                    qc.invalidateQueries({ queryKey: ['clients'] })
                  }}
                  className="h-9 w-12 rounded border"
                  aria-label="Client color"
                />
                <Button variant="outline" size="sm" onClick={() => rename(c.id, c.name, Number(c.hourly_rate ?? 0), c.color)}>Edit</Button>
                <Button variant="secondary" size="sm" onClick={() => toggleArchive(c.id, c.archived)}>{c.archived ? 'Unarchive' : 'Archive'}</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
