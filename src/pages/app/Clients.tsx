import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import SEO from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";

export default function Clients() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>("#4f46e5");
  const [rate, setRate] = useState<string>("0");
  const [notes, setNotes] = useState<string>("");
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
    
    // Validate hourly rate
    if (isNaN(hourly_rate) || hourly_rate < 0 || hourly_rate > 10000) {
      alert("Hourly rate must be a number between $0 and $10,000");
      return;
    }
    
    await supabase.from("clients").insert({ name, user_id: user.id, color, hourly_rate, notes: notes || null });
    setName("");
    setRate("0");
    setColor("#4f46e5");
    setNotes("");
    qc.invalidateQueries({ queryKey: ["clients"] });
  };

  const toggleArchive = async (id: string, archived: boolean) => {
    await supabase.from("clients").update({ archived: !archived }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["clients"] });
  };

  const rename = async (id: string, currentName: string, currentRate: number) => {
    const v = prompt("New name?", currentName) ?? currentName;
    const rateStr = prompt("Hourly rate? (Must be between $0 and $10,000)", String(currentRate ?? 0)) ?? String(currentRate ?? 0);
    const newRate = Number.parseFloat(rateStr || "0");
    
    // Validate hourly rate
    if (isNaN(newRate) || newRate < 0 || newRate > 10000) {
      alert("Invalid hourly rate. Must be a number between $0 and $10,000.");
      return;
    }
    
    await supabase.from("clients").update({ name: v, hourly_rate: newRate }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["clients"] });
  };

  return (
    <div className="space-y-6">
      <SEO title="Clients – Time App" description="Manage clients for time tracking." canonical={window.location.href} />
      <Card>
        <CardHeader>
          <CardTitle>Add client</CardTitle>
        </CardHeader>
        <CardContent>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="secondary">Add Client</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Add client</SheetTitle>
                <SheetDescription>Provide client details, including hourly rate and notes.</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="client-name">Name</Label>
                  <Input id="client-name" placeholder="Acme Co." value={name} onChange={(e)=>setName(e.target.value)} />
                </div>
                <div className="flex items-center gap-3">
                  <Label htmlFor="client-color" className="whitespace-nowrap">Color</Label>
                  <input id="client-color" type="color" value={color} onChange={(e)=>setColor(e.target.value)} className="h-8 w-8 rounded-md border" aria-label="Client color" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-rate">Hourly rate</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input 
                      id="client-rate" 
                      type="number" 
                      inputMode="decimal" 
                      step="0.01" 
                      min="0" 
                      max="10000" 
                      value={rate} 
                      onChange={(e)=>setRate(e.target.value)} 
                      className="pl-7" 
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Must be between $0 and $10,000</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-notes">Notes</Label>
                  <Textarea id="client-notes" rows={5} placeholder="Notes about this client (optional)" value={notes} onChange={(e)=>setNotes(e.target.value)} />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <SheetClose asChild>
                  <Button variant="outline">Cancel</Button>
                </SheetClose>
                <SheetClose asChild>
                  <Button onClick={add} disabled={!name.trim()}>Save</Button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
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
                <Button variant="outline" size="sm" onClick={() => rename(c.id, c.name, Number(c.hourly_rate ?? 0))}>Edit</Button>
                <Button variant="secondary" size="sm" onClick={() => toggleArchive(c.id, c.archived)}>{c.archived ? 'Unarchive' : 'Archive'}</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
