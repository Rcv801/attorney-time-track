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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  notes: z.string().optional(),
  start_at: z.string().min(1, "Start time is required."),
  end_at: z.string().min(1, "End time is required."),
}).refine((data) => {
  if (data.start_at && data.end_at) {
    return new Date(data.end_at) > new Date(data.start_at);
  }
  return true;
}, {
  message: "End time must be after start time.",
  path: ["end_at"],
});

export type EntryFormValues = z.infer<typeof formSchema>;

interface EntryFormProps {
  entry: { notes?: string | null; start_at: string; end_at?: string | null };
  onSubmit: (data: EntryFormValues) => void;
  isSubmitting?: boolean;
}

export function EntryForm({ entry, onSubmit, isSubmitting }: EntryFormProps) {
  const form = useForm<EntryFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      notes: entry.notes || "",
      start_at: entry.start_at ? toLocalDatetime(entry.start_at) : "",
      end_at: entry.end_at ? toLocalDatetime(entry.end_at) : "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="start_at"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Start Time</FormLabel>
              <FormControl>
                <Input type="datetime-local" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="end_at"
          render={({ field }) => (
            <FormItem>
              <FormLabel>End Time</FormLabel>
              <FormControl>
                <Input type="datetime-local" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea placeholder="Work performed..." rows={3} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Entry"}
        </Button>
      </form>
    </Form>
  );
}

/** Convert ISO string to datetime-local input format */
function toLocalDatetime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
