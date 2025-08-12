import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import SEO from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

export default function Settings() {
  const { user, signOut } = useAuth();
  const [rounding, setRounding] = useState(localStorage.getItem("rounding") === "1");
  const [confirm, setConfirm] = useState("");

  const saveRounding = (v: boolean) => {
    setRounding(v);
    localStorage.setItem("rounding", v ? "1" : "0");
  };

  const seed = async () => {
    if (!user) return;
    const { data: client } = await supabase.from("clients").insert({ name: "Acme Corp", user_id: user.id }).select("id").single();
    if (client?.id) {
      const now = new Date();
      const earlier = new Date(now.getTime() - 45*60*1000);
      await supabase.from("entries").insert([
        { user_id: user.id, client_id: client.id, start_at: new Date(now.getTime()-2*3600*1000).toISOString(), end_at: new Date(now.getTime()-90*60*1000).toISOString(), notes: "Research" },
        { user_id: user.id, client_id: client.id, start_at: earlier.toISOString(), end_at: now.toISOString(), notes: "Drafting" },
      ]);
    }
  };

  const wipe = async () => {
    if (confirm !== "DELETE") return;
    await supabase.from("entries").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("clients").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    setConfirm("");
  };

  return (
    <div className="space-y-6">
      <SEO title="Settings – Time App" description="Account and preferences for Time App." canonical={window.location.href} />
      <Card>
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>Email: <span className="font-medium">{user?.email}</span></div>
          <Button variant="outline" onClick={signOut}>Sign out</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Preferences</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-3">
          <Switch checked={rounding} onCheckedChange={saveRounding} />
          <div>Round totals to nearest minute (display only)</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Data</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={seed}>Create sample data</Button>
          <div className="text-sm">Type DELETE to remove all your data.</div>
          <div className="flex gap-2">
            <Input value={confirm} onChange={(e)=>setConfirm(e.target.value)} placeholder="DELETE" />
            <Button variant="destructive" disabled={confirm!=="DELETE"} onClick={wipe}>Delete all my data</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
