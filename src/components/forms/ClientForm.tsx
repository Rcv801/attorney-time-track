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
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

const createSchema = z.object({
  name: z.string().min(2, "Client name must be at least 2 characters."),
  first_matter_name: z.string().min(2, "Matter name must be at least 2 characters."),
  hourly_rate: z.coerce.number().min(0, "Rate must be 0 or more."),
  notes: z.string().optional(),
});

const editSchema = z.object({
  name: z.string().min(2, "Client name must be at least 2 characters."),
  hourly_rate: z.coerce.number().min(0, "Rate must be 0 or more."),
  notes: z.string().optional(),
});

export type ClientFormValues = z.infer<typeof createSchema>;
export type ClientEditFormValues = z.infer<typeof editSchema>;

interface ClientFormProps {
  onSubmit: (data: ClientFormValues | ClientEditFormValues) => void;
  initialValues?: Partial<ClientFormValues>;
  isSubmitting?: boolean;
  submitButtonText?: string;
  mode?: "create" | "edit";
}

export function ClientForm({ 
  onSubmit, 
  initialValues, 
  isSubmitting,
  submitButtonText = "Save Client",
  mode = "create",
}: ClientFormProps) {
  const isCreate = mode === "create";
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(isCreate ? createSchema : editSchema),
    defaultValues: {
      name: "",
      first_matter_name: "",
      hourly_rate: 0,
      notes: "",
      ...initialValues,
    },
  });

  // When initialValues changes (e.g., when a different client is selected for editing),
  // reset the form with the new values.
  useEffect(() => {
    if (initialValues) {
      form.reset(initialValues);
    }
  }, [initialValues, form]);


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Acme Inc." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {isCreate && (
          <FormField
            control={form.control}
            name="first_matter_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Matter Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Custody Case, Estate Planning" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name="hourly_rate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Default Hourly Rate ($)</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" placeholder="250" {...field} />
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
                <Textarea placeholder="Additional notes..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : submitButtonText}
        </Button>
      </form>
    </Form>
  );
}
