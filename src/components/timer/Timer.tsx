import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Pause, Square, Loader2 } from "lucide-react";
import { useTimer } from "@/hooks/useTimer";
import { formatDuration } from "@/lib/billing";
import MatterQuickSelect from "./MatterQuickSelect";
import { cn } from "@/lib/utils";
import QuickSwitchDialog from "./QuickSwitchDialog";

const Timer = () => {
  const {
    activeEntry,
    elapsed,
    isRunning,
    isPaused,
    isLoading,
    quickSwitchState,
    actions,
  } = useTimer();

  const handleTogglePlay = () => {
    if (isRunning) {
      actions.pause();
    } else if (isPaused) {
      actions.resume();
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            {isRunning && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
              </span>
            )}
            {isPaused && (
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
            )}
            {activeEntry ? activeEntry.matter?.name : "Timer"}
          </CardTitle>
          {activeEntry?.matter?.client && (
            <p className="text-sm text-muted-foreground">
              {activeEntry.matter.client.name}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={cn(
              "text-5xl font-mono font-bold text-center tabular-nums tracking-tight py-2",
              isRunning && "text-green-600 dark:text-green-400",
              isPaused && "text-yellow-600 dark:text-yellow-400 animate-pulse",
            )}
            role="timer"
            aria-live="polite"
            aria-label={`Timer: ${formatDuration(elapsed)}`}
          >
            {formatDuration(elapsed)}
          </div>
          <div className="flex justify-center gap-3">
            <Button
              size="icon"
              variant="outline"
              onClick={handleTogglePlay}
              disabled={!activeEntry || isLoading}
              aria-label={isRunning ? "Pause timer" : "Resume timer"}
              className="h-12 w-12 rounded-full"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isRunning ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </Button>
            <Button
              size="icon"
              variant="destructive"
              onClick={actions.stop}
              disabled={!activeEntry || isLoading}
              aria-label="Stop timer"
              className="h-12 w-12 rounded-full"
            >
              <Square className="h-5 w-5" />
            </Button>
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Quick Start</h3>
            <MatterQuickSelect />
          </div>
        </CardContent>
      </Card>
      <QuickSwitchDialog
        isOpen={quickSwitchState.show}
        onCancel={actions.cancelQuickAction}
        onSubmit={actions.submitQuickAction}
        stoppedMatterName={quickSwitchState.stoppedMatterName}
        isSwitching={!!quickSwitchState.nextMatterId}
      />
    </>
  );
};

export default Timer;
