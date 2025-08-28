import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface StopTimerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (notes: string) => void;
  isLoading?: boolean;
}

export default function StopTimerDialog({ 
  open, 
  onOpenChange, 
  onConfirm, 
  isLoading = false 
}: StopTimerDialogProps) {
  const [notes, setNotes] = useState("");

  const handleSubmit = () => {
    onConfirm(notes);
    setNotes(""); // Reset notes after submission
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Notes</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="notes">What did you work on?</Label>
            <Textarea
              id="notes"
              placeholder="Describe what you accomplished during this time..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
            />
          </div>
        </div>
        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? "Stopping..." : "Stop Timer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}