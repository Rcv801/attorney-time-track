import { useEffect, useState } from "react";
import { useTimer } from "@/hooks/useTimer";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2 } from "lucide-react";
import { usePolishDescription } from "@/hooks/usePolishDescription";

const QuickSwitchDialog = () => {
  const { quickSwitchState, actions, isLoading } = useTimer();
  const [notes, setNotes] = useState("");
  const polishMutation = usePolishDescription();

  useEffect(() => {
    if (!quickSwitchState.show) {
      setNotes("");
    }
  }, [quickSwitchState.show]);

  const handlePolish = async () => {
    if (!notes.trim()) return;
    const polished = await polishMutation.mutateAsync(notes);
    setNotes(polished);
  };

  const handleSave = () => {
    actions.submitQuickAction(notes);
  };

  const handleCancel = () => {
    actions.cancelQuickAction();
  };

  return (
    <Dialog open={quickSwitchState.show} onOpenChange={handleCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stop timer for {quickSwitchState.stoppedMatterName}?</DialogTitle>
          <DialogDescription>
            {quickSwitchState.nextMatterId
              ? "You are about to switch to another matter."
              : "You are about to stop the timer."}{" "}
            Add any notes for the previous timer session below.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="relative">
            <Textarea
              placeholder="Enter your notes here..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isLoading || polishMutation.isPending}
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2"
              onClick={handlePolish}
              disabled={!notes.trim() || polishMutation.isPending || isLoading}
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
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {quickSwitchState.nextMatterId ? "Switch & Save" : "Stop & Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuickSwitchDialog;
