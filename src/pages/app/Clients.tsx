import { Button } from "@/components/ui/button";
import { PlusCircle, MoreHorizontal, Edit, Trash2, DollarSign } from "lucide-react";
import FormDialog from "@/components/shared/FormDialog";
import { ClientForm, type ClientFormValues } from "@/components/forms/ClientForm";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSkeleton from "@/components/shared/LoadingSkeleton";
import { Users } from "lucide-react";
import { useState } from "react";

type Client = Tables<"clients">;

const Clients = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("archived", false)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const createClient = useMutation({
    mutationFn: async (vars: ClientFormValues) => {
      const { error } = await supabase.from("clients").insert({
        ...vars,
        user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast({ title: "Client created" });
      setDialogOpen(false);
    },
    onError: (e: Error) => {
      toast({ title: "Cannot create client", description: e.message, variant: "destructive" });
    },
  });

  const deleteClient = useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase.from("clients").update({ archived: true }).eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast({ title: "Client archived" });
    },
    onError: (e: Error) => {
      toast({ title: "Cannot archive client", description: e.message, variant: "destructive" });
    },
  });

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Clients</h1>
          <p className="text-muted-foreground mt-1">
            {clients?.length ?? 0} active client{clients?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <FormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          trigger={
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              New Client
            </Button>
          }
          title="Create a new client"
          description="Enter the client's information below."
        >
          <ClientForm
            onSubmit={(data) => createClient.mutate(data)}
            isSubmitting={createClient.isPending}
          />
        </FormDialog>
      </div>

      {clients && clients.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <Card key={client.id} className="group transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-lg leading-tight">{client.name}</CardTitle>
                  {client.notes && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{client.notes}</p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={`Actions for ${client.name}`}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => deleteClient.mutate(client.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Archive
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  <span>${client.hourly_rate}/hr</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No clients yet"
          description="Create your first client to start tracking time and billing."
          buttonText="Create Client"
          onButtonClick={() => setDialogOpen(true)}
          icon={<Users className="h-16 w-16" />}
        />
      )}
    </div>
  );
};

export default Clients;
