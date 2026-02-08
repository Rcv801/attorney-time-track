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
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";

type Client = Tables<"clients">;

const formSchema = z.object({
  name: z.string().min(2, "Matter name must be at least 2 characters."),
  matter_number: z.string().optional(),
  hourly_rate: z.coerce.number().min(0, "Rate must be 0 or more.").nullable().optional(),
  client_id: z.string().min(1, "Please select a client."),
  description: z.string().optional(),
});

export type MatterFormValues = z.infer<typeof formSchema>;

interface MatterFormProps {
  onSubmit: (data: MatterFormValues) => void;
  defaultValues?: Partial<MatterFormValues>;
  isSubmitting?: boolean;
}

export function MatterForm({ onSubmit, defaultValues, isSubmitting }: MatterFormProps) {
  const form = useForm<MatterFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      matter_number: "",
      hourly_rate: null,
      client_id: "",
      description: "",
      ...defaultValues,
    },
  });

  const { data: clients, isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="client_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Client</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={clientsLoading ? "Loading..." : "Select a client"} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                  {clients?.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No clients yet. Create one first.
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
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Matter Name</FormLabel>
              <FormControl>
                <Input placeholder="Smith v. Jones" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="matter_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Matter Number (optional)</FormLabel>
              <FormControl>
                <Input placeholder="2024-001" {...field} />
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
              <FormLabel>Hourly Rate Override ($)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Leave blank to use client rate"
                  {...field}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
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
              <FormLabel>Description (optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Brief description of this matter..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Matter"}
        </Button>
      </form>
    </Form>
  );
}
