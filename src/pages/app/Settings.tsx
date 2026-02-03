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
    if (confirm !== "DELETE" || !user) return;
    
    try {
      // Delete all entries for this user (respects RLS)
      const { error: entriesError } = await supabase
        .from("entries")
        .delete()
        .eq("user_id", user.id);
      
      if (entriesError) throw entriesError;
      
      // Delete all invoices for this user (this will cascade to invoice_id in entries)
      const { error: invoicesError } = await supabase
        .from("invoices")
        .delete()
        .eq("user_id", user.id);
      
      if (invoicesError) throw invoicesError;
      
      // Delete all clients for this user
      const { error: clientsError } = await supabase
        .from("clients")
        .delete()
        .eq("user_id", user.id);
      
      if (clientsError) throw clientsError;
      
      setConfirm("");
      alert("All your data has been deleted successfully.");
      
      // Optionally refresh the page to clear any cached data
      window.location.reload();
    } catch (error: any) {
      alert(`Error deleting data: ${error.message}`);
      console.error("Delete error:", error);
    }
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
