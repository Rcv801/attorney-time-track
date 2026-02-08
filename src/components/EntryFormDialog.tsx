import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import MatterSelector from "./MatterSelector";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { localToUtc, getUserTimeZone } from "@/lib/dates";
import type { Tables } from "@/integrations/supabase/types";

type Matter = Tables<"matters"> & { client: Tables<"clients"> };
type Entry = Tables<"entries">;

interface EntryFormDialogProps {
  trigger?: React.ReactNode;
  title?: string;
  matters: Matter[] | undefined;
  entries: Entry[] | undefined;
  initial?: {
    id?: string;
    matter_id: string;
    client_id: string;
    start_at: string;
    end_at: string | null;
    notes: string | null;
  };
  onSubmit: (values: {
    id?: string;
    matter_id: string;
    client_id: string;
    start_at: string;
    end_at?: string | null;
    notes?: string | null;
  }) => void;
}

const toLocalInput = (dateStr: string, formatStr: string) => {
    const tz = getUserTimeZone();
    const localDate = toZonedTime(new Date(dateStr), tz);
    return format(localDate, formatStr);
};

export default function EntryFormDialog({
  trigger,
  title = "Add entry",
  matters,
  entries,
  initial,
  onSubmit,
}: EntryFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [matterId, setMatterId] = useState(initial?.matter_id ?? "");
  const [date, setDate] = useState(
    initial?.start_at
      ? toLocalInput(initial.start_at, "yyyy-MM-dd")
      : format(new Date(), "yyyy-MM-dd")
  );
  const [startTime, setStartTime] = useState(
    initial?.start_at
      ? toLocalInput(initial.start_at, "HH:mm")
      : "09:00"
  );
  const [endTime, setEndTime] = useState(
    initial?.end_at ? toLocalInput(initial.end_at, "HH:mm") : ""
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");

  // Reset form when dialog opens
  useEffect(() => {
    if (open && initial) {
      setMatterId(initial.matter_id ?? "");
      setDate(toLocalInput(initial.start_at, "yyyy-MM-dd"));
      setStartTime(toLocalInput(initial.start_at, "HH:mm"));
      setEndTime(
        initial.end_at ? toLocalInput(initial.end_at, "HH:mm") : ""
      );
      setNotes(initial.notes ?? "");
    } else if (open && !initial) {
      setMatterId("");
      setDate(format(new Date(), "yyyy-MM-dd"));
      setStartTime("09:00");
      setEndTime("");
      setNotes("");
    }
  }, [open, initial]);

  const selectedMatter = matters?.find((m) => m.id === matterId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matterId || !selectedMatter) return;

    const startAt = localToUtc(`${date}T${startTime}`);
    const endAt = endTime ? localToUtc(`${date}T${endTime}`) : null;

    onSubmit({
      id: initial?.id,
      matter_id: matterId,
      client_id: selectedMatter.client_id,
      start_at: startAt.toISOString(),
      end_at: endAt?.toISOString() ?? null,
      notes: notes.trim() || null,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="secondary">Add Entry</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Matter Selection */}
          <div className="space-y-2">
            <Label>Matter *</Label>
            <MatterSelector
              matters={matters}
              entries={entries}
              value={matterId}
              onChange={setMatterId}
              placeholder="Select a matter..."
            />
            {selectedMatter && (
              <div className="flex items-center gap-2 text-sm">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{
                    backgroundColor: selectedMatter.client?.color ?? "#9ca3af",
                  }}
                />
                <span className="text-muted-foreground">
                  {selectedMatter.client?.name}
                </span>
              </div>
            )}
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date">Date *</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start">Start Time *</Label>
              <Input
                id="start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">End Time</Label>
              <Input
                id="end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for running timer
              </p>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What did you work on?"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!matterId}>
              {initial?.id ? "Save Changes" : "Add Entry"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
