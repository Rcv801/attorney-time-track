import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

type Matter = Tables<"matters"> & { client: Tables<"clients"> | null };

const EXPENSE_CATEGORIES = [
  { value: "filing_fee", label: "Filing Fee" },
  { value: "copies", label: "Copies" },
  { value: "postage", label: "Postage" },
  { value: "travel", label: "Travel" },
  { value: "court_reporter", label: "Court Reporter" },
  { value: "expert_witness", label: "Expert Witness" },
  { value: "service_of_process", label: "Service of Process" },
  { value: "other", label: "Other" },
] as const;

const formSchema = z.object({
  date: z.string().min(1, "Date is required."),
  matter_id: z.string().min(1, "Please select a matter."),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0."),
  description: z.string().min(1, "Description is required."),
  category: z.string().nullable().optional(),
  billable: z.boolean(),
  receipt_url: z.string().url("Must be a valid URL.").or(z.literal("")).optional(),
});

export type ExpenseFormValues = z.infer<typeof formSchema>;

interface ExpenseFormProps {
  onSubmit: (data: ExpenseFormValues) => void;
  defaultValues?: Partial<ExpenseFormValues>;
  isSubmitting?: boolean;
}

export function ExpenseForm({ onSubmit, defaultValues, isSubmitting }: ExpenseFormProps) {
  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      matter_id: "",
      amount: undefined as unknown as number,
      description: "",
      category: null,
      billable: true,
      receipt_url: "",
      ...defaultValues,
    },
  });

  const { data: matters, isLoading: mattersLoading } = useQuery<Matter[]>({
    queryKey: ["matters-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matters")
        .select("*, client:clients(*)")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="matter_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Matter</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={mattersLoading ? "Loading..." : "Select a matter"} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {matters?.map((matter) => (
                    <SelectItem key={matter.id} value={matter.id}>
                      {matter.client?.name ? `${matter.client.name} — ` : ""}
                      {matter.name}
                    </SelectItem>
                  ))}
                  {matters?.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-slate-500">
                      No active matters. Create one first.
                    </div>
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount ($)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  {...field}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="e.g., Court filing fee for motion to dismiss" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category (optional)</FormLabel>
              <Select
                onValueChange={(val) => field.onChange(val === "__none__" ? null : val)}
                defaultValue={field.value ?? "__none__"}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="billable"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="font-normal">Billable</FormLabel>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="receipt_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Receipt URL (optional)</FormLabel>
              <FormControl>
                <Input type="url" placeholder="https://..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Expense"}
        </Button>
      </form>
    </Form>
  );
}
