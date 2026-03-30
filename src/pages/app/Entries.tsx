import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, MoreHorizontal, Archive, Trash2, Plus, Pencil, Receipt } from "lucide-react";
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
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSkeleton from "@/components/shared/LoadingSkeleton";
import FormDialog from "@/components/shared/FormDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExpenseForm, type ExpenseFormValues } from "@/components/forms/ExpenseForm";

// ── Types ──────────────────────────────────────────────────────────

type Entry = Tables<"entries"> & {
  matter: Tables<"matters"> | null;
  client: Tables<"clients"> | null;
};

type Expense = Tables<"expenses"> & {
  matter: Tables<"matters"> | null;
  client: Tables<"clients"> | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  filing_fee: "Filing Fee",
  copies: "Copies",
  postage: "Postage",
  travel: "Travel",
  court_reporter: "Court Reporter",
  expert_witness: "Expert Witness",
  service_of_process: "Service of Process",
  other: "Other",
};

// ── Component ──────────────────────────────────────────────────────

const Entries = () => {
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  // ── Time Entries Query ────────────────────────────────────────────

  const { data: entries, isLoading: entriesLoading } = useQuery<Entry[]>({
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

  // ── Expenses Query ────────────────────────────────────────────────

  const { data: expenses, isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ["expenses", date?.from?.toISOString(), date?.to?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from("expenses")
        .select("*, matter:matters(*), client:clients(*)");

      if (date?.from) {
        query = query.gte("date", format(startOfDay(date.from), "yyyy-MM-dd"));
      }
      if (date?.to) {
        query = query.lte("date", format(endOfDay(date.to), "yyyy-MM-dd"));
      }

      const { data, error } = await query.order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!date?.from,
  });

  // ── Time Entry Mutations ──────────────────────────────────────────

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

  // ── Expense Mutations ─────────────────────────────────────────────

  const createExpense = useMutation({
    mutationFn: async (values: ExpenseFormValues) => {
      if (!user) throw new Error("Not authenticated");
      const matter = (await supabase.from("matters").select("client_id").eq("id", values.matter_id).single()).data;
      if (!matter) throw new Error("Matter not found");

      const { error } = await supabase.from("expenses").insert({
        user_id: user.id,
        matter_id: values.matter_id,
        client_id: matter.client_id,
        date: values.date,
        amount: values.amount,
        description: values.description,
        category: values.category || null,
        billable: values.billable,
        receipt_url: values.receipt_url || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      setExpenseDialogOpen(false);
      toast({ title: "Expense created" });
    },
    onError: (e: Error) => {
      toast({ title: "Cannot create expense", description: e.message, variant: "destructive" });
    },
  });

  const updateExpense = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: ExpenseFormValues }) => {
      const matter = (await supabase.from("matters").select("client_id").eq("id", values.matter_id).single()).data;
      if (!matter) throw new Error("Matter not found");

      const { error } = await supabase.from("expenses").update({
        matter_id: values.matter_id,
        client_id: matter.client_id,
        date: values.date,
        amount: values.amount,
        description: values.description,
        category: values.category || null,
        billable: values.billable,
        receipt_url: values.receipt_url || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      setEditingExpense(null);
      toast({ title: "Expense updated" });
    },
    onError: (e: Error) => {
      toast({ title: "Cannot update expense", description: e.message, variant: "destructive" });
    },
  });

  const deleteExpense = useMutation({
    mutationFn: async (expenseId: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast({ title: "Expense deleted" });
    },
    onError: (e: Error) => {
      // RLS blocks delete on non-unbilled; surface a friendly message
      const msg = e.message.includes("violates row-level security")
        ? "Only unbilled expenses can be deleted."
        : e.message;
      toast({ title: "Cannot delete expense", description: msg, variant: "destructive" });
    },
  });

  // ── Derived Data ──────────────────────────────────────────────────

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
  const expenseTotal = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) ?? 0;

  const isLoading = entriesLoading || expensesLoading;
  if (isLoading) return <LoadingSkeleton />;

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header with date picker */}
      <div className="flex items-center justify-between">
        <div>
          <p className="section-title mb-1.5">Time & Expenses</p>
          <h1 className="page-title">Entries</h1>
          <p className="page-subtitle">
            {completedCount} time entries · {formatBillableHours(roundToSixMinutes(totalSeconds))}
            {(expenses?.length ?? 0) > 0 && (
              <> · {expenses!.length} expenses · ${expenseTotal.toFixed(2)}</>
            )}
          </p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-normal",
                !date && "text-slate-500"
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

      {/* Tabs: Time Entries | Expenses */}
      <Tabs defaultValue="time">
        <TabsList>
          <TabsTrigger value="time">Time Entries</TabsTrigger>
          <TabsTrigger value="expenses">
            Expenses
            {(expenses?.length ?? 0) > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {expenses!.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Time Entries Tab ─────────────────────────────────── */}
        <TabsContent value="time">
          {entries && entries.length > 0 ? (
            <Card className="premium-card rounded-xl border border-slate-200 shadow-md">
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
                          <TableCell className="text-slate-600">
                            {entry.client?.name ?? "—"}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {format(new Date(entry.start_at), "MMM d, h:mm a")}
                          </TableCell>
                          <TableCell className="font-mono tabular-nums">
                            {isActive ? "In progress" : formatDuration(secs)}
                          </TableCell>
                          <TableCell className="font-mono tabular-nums">
                            {isActive ? "—" : `$${amount.toFixed(2)}`}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-slate-600">
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
        </TabsContent>

        {/* ── Expenses Tab ─────────────────────────────────────── */}
        <TabsContent value="expenses">
          <div className="flex justify-end mb-4">
            <FormDialog
              trigger={
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Expense
                </Button>
              }
              title="Add Expense"
              description="Record a new billable or non-billable expense."
              open={expenseDialogOpen}
              onOpenChange={setExpenseDialogOpen}
            >
              {({ close }) => (
                <ExpenseForm
                  onSubmit={(data) => createExpense.mutate(data)}
                  isSubmitting={createExpense.isPending}
                />
              )}
            </FormDialog>
          </div>

          {expenses && expenses.length > 0 ? (
            <Card className="premium-card rounded-xl border border-slate-200 shadow-md">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Matter</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-10">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell className="text-slate-600">
                          {format(new Date(expense.date + "T00:00:00"), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="font-medium">
                          {expense.matter?.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {expense.client?.name ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-slate-600">
                          {expense.description}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {expense.category ? CATEGORY_LABELS[expense.category] ?? expense.category : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          ${Number(expense.amount).toFixed(2)}
                          {!expense.billable && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              Non-billable
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={expense.status === "unbilled" ? "secondary" : expense.status === "invoiced" ? "default" : "outline"}
                          >
                            {expense.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Expense actions">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {expense.status === "unbilled" && (
                                <>
                                  <DropdownMenuItem onClick={() => setEditingExpense(expense)}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => deleteExpense.mutate(expense.id)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                              {expense.status !== "unbilled" && (
                                <DropdownMenuItem disabled>
                                  <Receipt className="mr-2 h-4 w-4" />
                                  {expense.status === "invoiced" ? "Already invoiced" : "Written off"}
                                </DropdownMenuItem>
                              )}
                              {expense.receipt_url && (
                                <DropdownMenuItem asChild>
                                  <a href={expense.receipt_url} target="_blank" rel="noopener noreferrer">
                                    <Receipt className="mr-2 h-4 w-4" />
                                    View Receipt
                                  </a>
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <EmptyState
              title="No expenses found"
              description="No expenses in the selected date range. Click 'Add Expense' to record one."
            />
          )}

          {/* Edit Expense Dialog */}
          {editingExpense && (
            <FormDialog
              trigger={<span />}
              title="Edit Expense"
              description="Update this expense record."
              open={!!editingExpense}
              onOpenChange={(open) => { if (!open) setEditingExpense(null); }}
            >
              {({ close }) => (
                <ExpenseForm
                  key={editingExpense.id}
                  defaultValues={{
                    date: editingExpense.date,
                    matter_id: editingExpense.matter_id,
                    amount: Number(editingExpense.amount),
                    description: editingExpense.description,
                    category: editingExpense.category,
                    billable: editingExpense.billable,
                    receipt_url: editingExpense.receipt_url ?? "",
                  }}
                  onSubmit={(data) => updateExpense.mutate({ id: editingExpense.id, values: data })}
                  isSubmitting={updateExpense.isPending}
                />
              )}
            </FormDialog>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Entries;
