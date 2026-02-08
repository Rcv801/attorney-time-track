import { useTimer } from "@/hooks/useTimer";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

const QuickSwitchDialog = () => {
  const { quickSwitchState, actions } = useTimer();
  const [notes, setNotes] = useState("");

  const handleSave = () => {
    actions.submitQuickAction(notes);
    setNotes("");
  };

  const handleCancel = () => {
    actions.cancelQuickAction();
    setNotes("");
  };

  return (
    <Dialog open={quickSwitchState.show} onOpenChange={handleCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stop timer for {quickSwitchState.stoppedMatterName}?</DialogTitle>
          <DialogDescription>
            {quickSwitchState.nextMatterId ? "You are about to switch to another matter." : "You are about to stop the timer."}
            Add any notes for the previous timer session below.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Enter your notes here..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {quickSwitchState.nextMatterId ? "Switch & Save" : "Stop & Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuickSwitchDialog;
