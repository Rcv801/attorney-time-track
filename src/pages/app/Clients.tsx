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

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id,name,archived").order("name");
      if (error) throw error; return data;
    },
  });

  const add = async () => {
    if (!name.trim() || !user) return;
    await supabase.from("clients").insert({ name, user_id: user.id });
    setName("");
    qc.invalidateQueries({ queryKey: ["clients"] });
  };

  const toggleArchive = async (id: string, archived: boolean) => {
    await supabase.from("clients").update({ archived: !archived }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["clients"] });
  };

  const rename = async (id: string) => {
    const v = prompt("New name?");
    if (!v) return;
    await supabase.from("clients").update({ name: v }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["clients"] });
  };

  return (
    <div className="space-y-6">
      <SEO title="Clients – Time App" description="Manage clients for time tracking." canonical={window.location.href} />
      <Card>
        <CardHeader>
          <CardTitle>Add client</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input placeholder="Client name" value={name} onChange={(e) => setName(e.target.value)} />
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
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.archived ? "Archived" : "Active"}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => rename(c.id)}>Rename</Button>
                <Button variant="secondary" size="sm" onClick={() => toggleArchive(c.id, c.archived)}>{c.archived ? "Unarchive" : "Archive"}</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
