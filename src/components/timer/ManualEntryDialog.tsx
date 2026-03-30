import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { usePolishDescription } from "@/hooks/usePolishDescription";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Loader2 } from "lucide-react";
import { format } from "date-fns";

type Matter = Tables<"matters"> & { client: Tables<"clients"> };

interface ManualEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ManualEntryDialog = ({ open, onOpenChange }: ManualEntryDialogProps) => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const polishMutation = usePolishDescription();

  const [selectedMatterId, setSelectedMatterId] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState(
    format(new Date(Date.now() - 3600000), "HH:mm")
  );
  const [endTime, setEndTime] = useState(format(new Date(), "HH:mm"));
  const [notes, setNotes] = useState("");

  const { data: matters = [] } = useQuery<Matter[]>({
    queryKey: ["matters-all-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matters")
        .select("*, client:clients(*)")
        .eq("status", "active")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const groupedMatters = useMemo(() => {
    const groups: Record<string, Matter[]> = {};
    matters.forEach((matter) => {
      const clientName = matter.client?.name ?? "Unknown";
      if (!groups[clientName]) groups[clientName] = [];
      groups[clientName].push(matter);
    });
    return groups;
  }, [matters]);

  const handlePolish = async () => {
    if (!notes.trim()) return;
    const polished = await polishMutation.mutateAsync(notes);
    setNotes(polished);
  };

  const selectedMatter = matters.find((m) => m.id === selectedMatterId);

  const createEntry = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      if (!selectedMatterId) throw new Error("Please select a matter");
      if (!selectedMatter) throw new Error("Matter not found");

      // Parse date and times
      const startDateTime = new Date(`${date}T${startTime}`);
      const endDateTime = new Date(`${date}T${endTime}`);

      if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
        throw new Error("Invalid date or time format");
      }

      if (endDateTime <= startDateTime) {
        throw new Error("End time must be after start time");
      }

      const { error } = await supabase.from("entries").insert({
        user_id: user.id,
        matter_id: selectedMatterId,
        client_id: selectedMatter.client_id,
        start_at: startDateTime.toISOString(),
        end_at: endDateTime.toISOString(),
        notes: notes || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entries-today"] });
      qc.invalidateQueries({ queryKey: ["matters-all-active"] });
      toast({ title: "Entry created successfully" });

      // Reset form
      setSelectedMatterId("");
      setDate(format(new Date(), "yyyy-MM-dd"));
      setStartTime(format(new Date(Date.now() - 3600000), "HH:mm"));
      setEndTime(format(new Date(), "HH:mm"));
      setNotes("");
      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast({
        title: "Failed to create entry",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Time Entry</DialogTitle>
          <DialogDescription>
            Manually create a time entry for work completed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="matter-select">Matter *</Label>
            <Select value={selectedMatterId} onValueChange={setSelectedMatterId}>
              <SelectTrigger id="matter-select">
                <SelectValue placeholder="Select a matter..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(groupedMatters).map(([clientName, clientMatters]) => (
                  <div key={clientName}>
                    {clientMatters.map((matter) => (
                      <SelectItem key={matter.id} value={matter.id}>
                        {clientName} — {matter.name}
                      </SelectItem>
                    ))}
                  </div>
                ))}
                {matters.length === 0 && (
                  <SelectItem disabled value="no-matters">
                    No active matters available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="entry-date">Date *</Label>
            <Input
              id="entry-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={createEntry.isPending}
            />
          </div>

          <div className="grid gap-3 grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start-time">Start Time *</Label>
              <Input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={createEntry.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-time">End Time *</Label>
              <Input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={createEntry.isPending}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="entry-notes">Notes (optional)</Label>
            <div className="relative">
              <Textarea
                id="entry-notes"
                placeholder="Describe the work completed..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={createEntry.isPending || polishMutation.isPending}
                className="pr-10"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2"
                onClick={handlePolish}
                disabled={!notes.trim() || polishMutation.isPending || createEntry.isPending}
                title="Polish notes with AI"
              >
                {polishMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createEntry.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => createEntry.mutate()}
            disabled={!selectedMatterId || createEntry.isPending}
            className="gap-2"
          >
            {createEntry.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Add Entry"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManualEntryDialog;
