import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import SEO from "@/components/SEO";
import EntryFormDialog from "@/components/EntryFormDialog";
import InvoiceCreateDialog from "@/components/InvoiceCreateDialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays } from "date-fns";
import {
  roundToSixMinutes,
  formatBillableHours,
} from "@/lib/billing";
import {
  startOfLocalDayUtc,
  endOfLocalDayUtc,
  utcToLocal,
  getUserTimeZone
} from "@/lib/dates";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, FileText, Archive, CheckCircle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Matter = Tables<"matters"> & { client: Tables<"clients"> };
type Entry = Tables<"entries">;

export default function Entries() {
  const [from, setFrom] = useState<string>(() => format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [to, setTo] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [showArchived, setShowArchived] = useState(false);
  const [recordedFilter, setRecordedFilter] = useState<
    "all" | "recorded" | "unrecorded"
  >("all");
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(
    new Set()
  );
  const [selectedArchiveEntries, setSelectedArchiveEntries] = useState<
    Set<string>
  >(new Set());

  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const fmt = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  });
  const tz = getUserTimeZone();

  // Fetch entries with matter and client info
  const { data: allEntries } = useQuery({
    queryKey: ["entries", from, to, showArchived, recordedFilter],
    queryFn: async () => {
      const fromDate = startOfLocalDayUtc(new Date(from));
      const toDate = endOfLocalDayUtc(new Date(to));

      let query = supabase
        .from("entries")
        .select(
          "*, matter:matters(*, client:clients(*))"
        )
        .gte("start_at", fromDate.toISOString())
        .lte("start_at", toDate.toISOString())
        .order("start_at", { ascending: false });

      if (!showArchived) {
        query = query.eq("archived", false);
      }

      if (recordedFilter === "recorded") {
        query = query.eq("billed", true);
      } else if (recordedFilter === "unrecorded") {
        query = query.eq("billed", false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as (Entry & { matter: Matter })[];
    },
  });

  const data = allEntries || [];

  // Fetch matters for the entry dialog
  const { data: matters } = useQuery({
    queryKey: ["matters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matters")
        .select("*, client:clients(*)")
        .order("name");
      if (error) throw error;
      return data as Matter[];
    },
  });

  // Calculate totals with 6-minute rounding
  const totals = useMemo(() => {
    let seconds = 0;
    let amount = 0;
    data.forEach((e) => {
      const s =
        e.duration_sec ??
        (e.end_at
          ? (new Date(e.end_at).getTime() - new Date(e.start_at).getTime()) /
            1000
          : 0);
      seconds += s;
      const billableHours = roundToSixMinutes(s);
      const rate =
        e.matter?.hourly_rate ?? e.matter?.client?.hourly_rate ?? 0;
      amount += billableHours * rate;
    });
    return { seconds, amount };
  }, [data]);

  const toHhMm = (s: number) =>
    `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(
      Math.floor((s % 3600) / 60)
    ).padStart(2, "0")}`;

  // CSV export
  const csv = useMemo(() => {
    if (!data?.length) return "";
    const header = [
      "Client",
      "Matter",
      "Start",
      "End",
      "Duration(sec)",
      "Billable Hours",
      "Amount",
      "Billed",
      "Notes",
    ];
    const rows = data.map((e) => {
      const s =
        e.duration_sec ??
        (e.end_at
          ? (new Date(e.end_at).getTime() - new Date(e.start_at).getTime()) /
            1000
          : 0);
      const billableHours = roundToSixMinutes(s);
      const rate =
        e.matter?.hourly_rate ?? e.matter?.client?.hourly_rate ?? 0;
      const amt = billableHours * rate;
      return [
        e.matter?.client?.name ?? "Unknown",
        e.matter?.name ?? "Unknown",
        e.start_at,
        e.end_at ?? "",
        s,
        billableHours.toFixed(1),
        amt.toFixed(2),
        e.billed ? "Yes" : "No",
        (e.notes ?? "").replace(/\n/g, " "),
      ];
    });
    return [header, ...rows]
      .map((r) =>
        r
          .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
  }, [data]);

  const onCreate = async (values: {
    matter_id: string;
    client_id: string;
    start_at: string;
    end_at?: string | null;
    notes?: string | null;
  }) => {
    if (!user) {
      toast({
        title: "Not signed in",
        description: "Please sign in to add an entry.",
      });
      return;
    }
    const { error } = await supabase.from("entries").insert({
      user_id: user.id,
      matter_id: values.matter_id,
      client_id: values.client_id,
      start_at: values.start_at,
      end_at: values.end_at ?? null,
      notes: values.notes ?? null,
    });
    if (error) {
      toast({ title: "Could not add entry", description: error.message });
    } else {
      qc.invalidateQueries({ queryKey: ["entries"] });
      toast({ title: "Entry added" });
    }
  };

  const onUpdate = async (values: {
    id?: string;
    matter_id: string;
    client_id: string;
    start_at: string;
    end_at?: string | null;
    notes?: string | null;
  }) => {
    if (!values.id) return;
    const { error } = await supabase
      .from("entries")
      .update({
        matter_id: values.matter_id,
        client_id: values.client_id,
        start_at: values.start_at,
        end_at: values.end_at ?? null,
        notes: values.notes ?? null,
      })
      .eq("id", values.id);
    if (error) {
      toast({ title: "Could not update entry", description: error.message });
    } else {
      qc.invalidateQueries({ queryKey: ["entries"] });
      toast({ title: "Entry updated" });
    }
  };

  const onToggleBilled = async (id: string, billed: boolean) => {
    const { error } = await supabase
      .from("entries")
      .update({ billed })
      .eq("id", id);
    if (error) {
      toast({
        title: "Could not update time recorded status",
        description: error.message,
      });
    } else {
      qc.invalidateQueries({ queryKey: ["entries"] });
      toast({
        title: billed ? "Marked as time recorded" : "Marked as draft",
      });
    }
  };

  const onToggleArchived = async (id: string, archived: boolean) => {
    const { error } = await supabase
      .from("entries")
      .update({ archived })
      .eq("id", id);
    if (error) {
      toast({
        title: "Could not update archive status",
        description: error.message,
      });
    } else {
      qc.invalidateQueries({ queryKey: ["entries"] });
      toast({ title: archived ? "Entry archived" : "Entry unarchived" });
    }
  };

  const toggleEntrySelection = (entryId: string) => {
    const newSelection = new Set(selectedEntries);
    if (newSelection.has(entryId)) {
      newSelection.delete(entryId);
    } else {
      newSelection.add(entryId);
    }
    setSelectedEntries(newSelection);
  };

  const toggleArchiveSelection = (entryId: string) => {
    const newSelection = new Set(selectedArchiveEntries);
    if (newSelection.has(entryId)) {
      newSelection.delete(entryId);
    } else {
      newSelection.add(entryId);
    }
    setSelectedArchiveEntries(newSelection);
  };

  const clearArchiveSelection = () => {
    setSelectedArchiveEntries(new Set());
  };

  const onBulkArchive = async () => {
    const entryIds = Array.from(selectedArchiveEntries);
    const { error } = await supabase
      .from("entries")
      .update({ archived: true })
      .in("id", entryIds);

    if (error) {
      toast({ title: "Could not archive entries", description: error.message });
    } else {
      qc.invalidateQueries({ queryKey: ["entries"] });
      toast({ title: `Archived ${entryIds.length} entries` });
      clearArchiveSelection();
    }
  };

  const onDelete = async (id: string) => {
    const { error } = await supabase.from("entries").delete().eq("id", id);
    if (error) {
      toast({ title: "Could not delete entry", description: error.message });
    } else {
      qc.invalidateQueries({ queryKey: ["entries"] });
      toast({ title: "Entry deleted" });
    }
  };

  const downloadCSV = () => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "entries.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <SEO
        title="Entries – Time App"
        description="Browse and export time entries."
      />

      {/* Filter Card */}
      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm">From</span>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">To</span>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <Button onClick={downloadCSV} disabled={!csv}>
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            Print
          </Button>
          <EntryFormDialog
            trigger={<Button variant="secondary">Add Entry</Button>}
            title="Add entry"
            matters={matters}
            entries={data}
            onSubmit={onCreate}
          />
          <Button
            variant="outline"
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2"
          >
            {showArchived ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            {showArchived ? "Hide Archived" : "Show Archived"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const nextFilter =
                recordedFilter === "all"
                  ? "recorded"
                  : recordedFilter === "recorded"
                  ? "unrecorded"
                  : "all";
              setRecordedFilter(nextFilter);
              qc.invalidateQueries({ queryKey: ["entries"] });
            }}
            className="flex items-center gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            {recordedFilter === "all"
              ? "Show Recorded Entries"
              : recordedFilter === "recorded"
              ? "Show Unrecorded Entries"
              : "Show All Entries"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                disabled={selectedArchiveEntries.size === 0}
                className="flex items-center gap-2"
              >
                <Archive className="h-4 w-4" />
                Archive Selected ({selectedArchiveEntries.size})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Archive Entries</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to archive {selectedArchiveEntries.size}{" "}
                  selected entries? Archived entries will be hidden from the
                  default view but can still be accessed using the "Show
                  Archived" filter.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={clearArchiveSelection}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction onClick={onBulkArchive}>
                  Archive Entries
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <div className="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              Totals: {formatBillableHours(roundToSixMinutes(totals.seconds))} •{" "}
              {fmt.format(totals.amount)}
            </span>
            <span className="text-xs">Using time zone: {tz}</span>
          </div>
        </CardContent>
      </Card>

      {/* Selected Archive Banner */}
      {selectedArchiveEntries.size > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedArchiveEntries.size} entries selected for archiving
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearArchiveSelection}
                >
                  Clear Selection
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="default"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Archive className="h-4 w-4" />
                      Archive Selected
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Archive Entries</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to archive{" "}
                        {selectedArchiveEntries.size} selected entries?
                        Archived entries will be hidden from the default view
                        but can still be accessed using the "Show Archived"
                        filter.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={onBulkArchive}>
                        Archive Entries
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entries List */}
      <Card>
        <CardHeader>
          <CardTitle>Entries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data?.map((e) => {
            const duration = e.duration_sec ?? 0;
            const billableHours = roundToSixMinutes(duration);
            const rate =
              e.matter?.hourly_rate ?? e.matter?.client?.hourly_rate ?? 0;
            const amount = billableHours * rate;
            const localStart = utcToLocal(e.start_at);
            const localEnd = e.end_at ? utcToLocal(e.end_at) : null;

            return (
              <div
                key={e.id}
                className={`flex flex-col gap-3 border rounded p-4 text-sm ${
                  e.invoice_id ? "bg-muted/50 opacity-75" : ""
                }`}
              >
                {/* Header row with checkbox/icon, client/matter, and status */}
                <div className="flex flex-wrap items-center gap-3">
                  {!e.invoice_id && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Checkbox
                        checked={selectedEntries.has(e.id)}
                        onCheckedChange={() => toggleEntrySelection(e.id)}
                        aria-label="Select entry for invoicing"
                      />
                      <span className="text-xs text-muted-foreground">
                        Add to invoice
                      </span>
                    </div>
                  )}
                  {e.invoice_id && (
                    <div className="flex items-center shrink-0">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  {!e.archived && !e.invoice_id && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Checkbox
                        checked={selectedArchiveEntries.has(e.id)}
                        onCheckedChange={() => toggleArchiveSelection(e.id)}
                        aria-label="Select entry for archiving"
                      />
                      <span className="text-xs text-muted-foreground">
                        Archive
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          e.matter?.client?.color ?? "#9ca3af",
                      }}
                    />
                    <span className="font-medium truncate">
                      {e.matter?.client?.name} — {e.matter?.name}
                    </span>
                    {e.matter?.matter_number && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        #{e.matter.matter_number}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Checkbox
                      id={`billed-${e.id}`}
                      checked={!!e.billed}
                      onCheckedChange={(v) =>
                        onToggleBilled(e.id, Boolean(v))
                      }
                      aria-label="Mark entry as time recorded"
                      disabled={!!e.invoice_id}
                    />
                    <label
                      htmlFor={`billed-${e.id}`}
                      className="text-xs whitespace-nowrap"
                    >
                      {e.invoice_id
                        ? "Invoiced"
                        : e.archived
                        ? "Archived"
                        : "Time Recorded"}
                    </label>
                  </div>
                </div>

                {/* Time details row */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Start:</span>
                    <span className="whitespace-nowrap">
                      {localStart.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-medium">End:</span>
                    <span className="whitespace-nowrap">
                      {localEnd
                        ? localEnd.toLocaleString()
                        : "–"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Duration:</span>
                    <span className="whitespace-nowrap">
                      {formatBillableHours(billableHours)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Amount:</span>
                    <span className="whitespace-nowrap font-medium text-foreground">
                      {fmt.format(amount)}
                    </span>
                  </div>
                </div>

                {/* Notes */}
                {e.notes && (
                  <div className="text-sm break-words">{e.notes}</div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <EntryFormDialog
                    trigger={
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!!e.invoice_id}
                        title={
                          e.invoice_id
                            ? "Cannot edit invoiced entries"
                            : "Edit entry"
                        }
                      >
                        Edit
                      </Button>
                    }
                    title="Edit entry"
                    initial={{
                      id: e.id,
                      matter_id: e.matter_id ?? "",
                      client_id: e.client_id,
                      start_at: e.start_at,
                      end_at: e.end_at,
                      notes: e.notes,
                    }}
                    matters={matters}
                    entries={data}
                    onSubmit={onUpdate}
                  />
                  {e.archived && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onToggleArchived(e.id, false)}
                      className="flex items-center gap-1"
                    >
                      <Archive className="h-3 w-3" />
                      Unarchive
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={!!e.invoice_id}
                        title={
                          e.invoice_id
                            ? "Cannot delete invoiced entries"
                            : "Delete entry"
                        }
                      >
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete entry?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. The entry will be
                          permanently removed.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete(e.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
