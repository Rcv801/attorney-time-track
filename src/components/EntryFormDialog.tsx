import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Client = { id: string; name: string; color?: string | null };

export type EntryInitial = {
  id?: string;
  client_id?: string;
  start_at?: string; // ISO
  end_at?: string | null; // ISO or null
  notes?: string | null;
};

export function toLocalInputValue(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export function fromLocalInputValue(val: string) {
  // Interpret local datetime value and return ISO in UTC
  if (!val) return "";
  return new Date(val).toISOString();
}

export default function EntryFormDialog({
  trigger,
  title = "Add entry",
  initial,
  clients,
  onSubmit,
}: {
  trigger: React.ReactNode;
  title?: string;
  initial?: EntryInitial;
  clients: Client[] | undefined;
  onSubmit: (values: Required<Pick<EntryInitial, "client_id" | "start_at">> & Partial<Omit<EntryInitial, "client_id" | "start_at">>) => Promise<void> | void;
}) {
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState<string>(initial?.client_id ?? "");
  const [startLocal, setStartLocal] = useState<string>(toLocalInputValue(initial?.start_at));
  const [endLocal, setEndLocal] = useState<string>(toLocalInputValue(initial?.end_at ?? undefined));
  const [notes, setNotes] = useState<string>(initial?.notes ?? "");

  useEffect(() => {
    // Sync when initial changes (e.g., editing different rows)
    setClientId(initial?.client_id ?? "");
    setStartLocal(toLocalInputValue(initial?.start_at));
    setEndLocal(toLocalInputValue(initial?.end_at ?? undefined));
    setNotes(initial?.notes ?? "");
  }, [initial?.client_id, initial?.start_at, initial?.end_at, initial?.notes]);

  const canSave = clientId && startLocal && (!endLocal || new Date(endLocal) >= new Date(startLocal));

  const handleSave = async () => {
    if (!canSave) return;
    await onSubmit({
      client_id: clientId,
      start_at: fromLocalInputValue(startLocal),
      end_at: endLocal ? fromLocalInputValue(endLocal) : null,
      notes: notes || null,
      id: initial?.id,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="text-xs text-muted-foreground">Using time zone: {tz}</div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Client</label>
            <Select value={clientId} onValueChange={setClientId}>
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
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start</label>
              <Input type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End (optional)</label>
              <Input type="datetime-local" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes (optional)</label>
            <Textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {endLocal && startLocal && new Date(endLocal) < new Date(startLocal) && (
            <div className="text-sm text-destructive">End time must be after start time.</div>
          )}
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={!canSave}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
