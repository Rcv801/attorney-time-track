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

const formSchema = z.object({
  name: z.string().min(2, "Client name must be at least 2 characters."),
  hourly_rate: z.coerce.number().min(0, "Rate must be 0 or more."),
  notes: z.string().optional(),
});

export type ClientFormValues = z.infer<typeof formSchema>;

interface ClientFormProps {
  onSubmit: (data: ClientFormValues) => void;
  initialValues?: Partial<ClientFormValues>;
  isSubmitting?: boolean;
  submitButtonText?: string;
}

export function ClientForm({ 
  onSubmit, 
  initialValues, 
  isSubmitting,
  submitButtonText = "Save Client" 
}: ClientFormProps) {
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
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
