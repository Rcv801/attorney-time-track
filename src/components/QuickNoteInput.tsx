import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, SkipForward } from "lucide-react";

interface QuickNoteInputProps {
  matterName: string;
  onSubmit: (notes: string) => void;
  onSkip: () => void;
  isLoading?: boolean;
}

export default function QuickNoteInput({
  matterName,
  onSubmit,
  onSkip,
  isLoading,
}: QuickNoteInputProps) {
  const [notes, setNotes] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input when component mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(notes.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onSkip();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Stopped: <span className="font-medium text-foreground">{matterName}</span>
      </p>
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What did you work on? (optional)"
          disabled={isLoading}
          className="flex-1"
        />
        <Button
          type="submit"
          size="icon"
          disabled={isLoading}
          className="shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onSkip}
          disabled={isLoading}
          className="shrink-0"
          title="Skip (no notes)"
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Press Enter to save, Escape to skip
      </p>
    </form>
  );
}
