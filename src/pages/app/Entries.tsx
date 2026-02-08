import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, MoreHorizontal, Archive, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useState } from "react";
import { DateRange } from "react-day-picker";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatDuration, formatBillableHours, roundToSixMinutes, calculateBillingAmount, getEffectiveRate } from "@/lib/billing";
import { differenceInSeconds } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSkeleton from "@/components/shared/LoadingSkeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Entry = Tables<"entries"> & {
  matter: Tables<"matters"> | null;
  client: Tables<"clients"> | null;
};

const Entries = () => {
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });

  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: entries, isLoading } = useQuery<Entry[]>({
    queryKey: ["entries", date?.from?.toISOString(), date?.to?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from("entries")
        .select("*, matter:matters(*), client:clients(*)")
        .eq("archived", false);

      if (date?.from) {
        query = query.gte("start_at", startOfDay(date.from).toISOString());
      }
      if (date?.to) {
        query = query.lte("start_at", endOfDay(date.to).toISOString());
      }

      const { data, error } = await query.order("start_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!date?.from,
  });

  const archiveEntry = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from("entries")
        .update({ archived: true })
        .eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entries"] });
      toast({ title: "Entry archived" });
    },
    onError: (e: Error) => {
      toast({ title: "Cannot archive entry", description: e.message, variant: "destructive" });
    },
  });

  const deleteEntry = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase.from("entries").delete().eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entries"] });
      toast({ title: "Entry deleted" });
    },
    onError: (e: Error) => {
      toast({ title: "Cannot delete entry", description: e.message, variant: "destructive" });
    },
  });

  const getEntrySeconds = (entry: Entry) => {
    if (!entry.end_at) return 0;
    return Math.max(
      differenceInSeconds(new Date(entry.end_at), new Date(entry.start_at)) -
        (entry.total_paused_seconds || 0),
      0
    );
  };

  const totalSeconds = entries?.reduce((sum, e) => sum + getEntrySeconds(e), 0) ?? 0;
  const completedCount = entries?.filter((e) => e.end_at).length ?? 0;

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Time Entries</h1>
          <p className="text-muted-foreground mt-1">
            {completedCount} entries · {formatBillableHours(roundToSixMinutes(totalSeconds))}
          </p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-normal",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, "LLL dd")} – {format(date.to, "LLL dd, y")}
                  </>
                ) : (
                  format(date.from, "LLL dd, y")
                )
              ) : (
                "Pick a date range"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={setDate}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>

      {entries && entries.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matter</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Billable</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  const secs = getEntrySeconds(entry);
                  const rate = getEffectiveRate(
                    entry.matter?.hourly_rate,
                    entry.client?.hourly_rate ?? 0
                  );
                  const amount = calculateBillingAmount(secs, rate);
                  const isActive = !entry.end_at;

                  return (
                    <TableRow key={entry.id} className={cn(isActive && "bg-green-50/50 dark:bg-green-950/20")}>
                      <TableCell className="font-medium">
                        {entry.matter?.name ?? "—"}
                        {isActive && (
                          <Badge variant="outline" className="ml-2 text-green-600 border-green-300">
                            Running
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {entry.client?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(entry.start_at), "MMM d, h:mm a")}
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {isActive ? "In progress" : formatDuration(secs)}
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {isActive ? "—" : `$${amount.toFixed(2)}`}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {entry.notes || "—"}
                      </TableCell>
                      <TableCell>
                        {!isActive && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Entry actions">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => archiveEntry.mutate(entry.id)}>
                                <Archive className="mr-2 h-4 w-4" />
                                Archive
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => deleteEntry.mutate(entry.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="No entries found"
          description="No time entries in the selected date range. Start a timer from the Dashboard."
        />
      )}
    </div>
  );
};

export default Entries;
