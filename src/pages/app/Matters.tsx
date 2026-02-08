import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Briefcase, Plus } from "lucide-react";
import SEO from "@/components/SEO";
import MatterFormDialog from "@/components/MatterFormDialog";
import type { Tables } from "@/integrations/supabase/types";

type Matter = Tables<"matters">;
type Client = Tables<"clients">;

export default function Matters() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: matters } = useQuery({
    queryKey: ["matters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matters")
        .select("*, client:clients(name, color, hourly_rate)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as (Matter & { client: Client })[];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, color, hourly_rate, archived")
        .order("name");
      if (error) throw error;
      return data as Client[];
    },
  });

  const createMatter = useMutation({
    mutationFn: async (values: {
      client_id: string;
      name: string;
      matter_number?: string;
      description?: string;
      status: string;
      hourly_rate?: number;
      flat_fee?: number;
      billing_type: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("matters").insert({
        ...values,
        user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matters"] });
      toast({ title: "Matter created" });
    },
    onError: (e: any) => {
      toast({ title: "Error creating matter", description: e.message });
    },
  });

  const updateMatter = useMutation({
    mutationFn: async (values: {
      id: string;
      client_id: string;
      name: string;
      matter_number?: string;
      description?: string;
      status: string;
      hourly_rate?: number;
      flat_fee?: number;
      billing_type: string;
    }) => {
      const { error } = await supabase
        .from("matters")
        .update({
          client_id: values.client_id,
          name: values.name,
          matter_number: values.matter_number,
          description: values.description,
          status: values.status,
          hourly_rate: values.hourly_rate,
          flat_fee: values.flat_fee,
          billing_type: values.billing_type,
        })
        .eq("id", values.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matters"] });
      toast({ title: "Matter updated" });
    },
    onError: (e: any) => {
      toast({ title: "Error updating matter", description: e.message });
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async ({
      id,
      currentStatus,
    }: {
      id: string;
      currentStatus: string;
    }) => {
      const newStatus = currentStatus === "active" ? "closed" : "active";
      const { error } = await supabase
        .from("matters")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matters"] });
    },
  });

  const activeMatters = matters?.filter((m) => m.status === "active") ?? [];
  const closedMatters = matters?.filter((m) => m.status === "closed") ?? [];

  const formatRate = (matter: Matter & { client: Client }) => {
    if (matter.billing_type === "flat_fee") {
      return matter.flat_fee && matter.flat_fee > 0
        ? `$${matter.flat_fee.toFixed(2)} flat fee`
        : "Flat fee (not set)";
    }
    const rate = matter.hourly_rate ?? matter.client?.hourly_rate ?? 0;
    if (matter.hourly_rate && matter.hourly_rate > 0) {
      return `$${rate}/hr (custom)`;
    }
    return rate > 0 ? `$${rate}/hr` : "No rate set";
  };

  return (
    <div className="space-y-6">
      <SEO title="Matters" description="Manage your legal matters" />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Matters</h1>
        <MatterFormDialog
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Matter
            </Button>
          }
          title="New Matter"
          clients={clients}
          onSubmit={(values) => createMatter.mutate(values)}
        />
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            Active ({activeMatters.length})
          </TabsTrigger>
          <TabsTrigger value="closed">
            Closed ({closedMatters.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {activeMatters.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Briefcase className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No active matters yet. Create your first matter to start
                  tracking time.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeMatters.map((matter) => (
                <MatterCard
                  key={matter.id}
                  matter={matter}
                  clients={clients}
                  onToggleStatus={() =>
                    toggleStatus.mutate({
                      id: matter.id,
                      currentStatus: matter.status,
                    })
                  }
                  onUpdate={(values) => updateMatter.mutate({ ...values, id: matter.id })}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="closed" className="space-y-4">
          {closedMatters.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No closed matters.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {closedMatters.map((matter) => (
                <MatterCard
                  key={matter.id}
                  matter={matter}
                  clients={clients}
                  onToggleStatus={() =>
                    toggleStatus.mutate({
                      id: matter.id,
                      currentStatus: matter.status,
                    })
                  }
                  onUpdate={(values) => updateMatter.mutate({ ...values, id: matter.id })}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MatterCard({
  matter,
  clients,
  onToggleStatus,
  onUpdate,
}: {
  matter: Matter & { client: Client };
  clients: Client[] | undefined;
  onToggleStatus: () => void;
  onUpdate: (values: {
    client_id: string;
    name: string;
    matter_number?: string;
    description?: string;
    status: string;
    hourly_rate?: number;
    flat_fee?: number;
    billing_type: string;
  }) => void;
}) {
  const formatRate = () => {
    if (matter.billing_type === "flat_fee") {
      return matter.flat_fee && matter.flat_fee > 0
        ? `$${matter.flat_fee.toFixed(2)} flat`
        : "Flat fee";
    }
    const rate = matter.hourly_rate ?? matter.client?.hourly_rate ?? 0;
    return rate > 0 ? `$${rate}/hr` : "No rate";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: matter.client?.color ?? "#9ca3af" }}
            />
            <span className="text-sm text-muted-foreground">
              {matter.client?.name}
            </span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <MatterFormDialog
                trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Edit</DropdownMenuItem>}
                title="Edit Matter"
                clients={clients}
                initial={matter}
                defaultClientId={matter.client_id}
                onSubmit={onUpdate}
              />
              <DropdownMenuItem onClick={onToggleStatus}>
                {matter.status === "active" ? "Close Matter" : "Reopen Matter"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <CardTitle className="text-lg">{matter.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {matter.matter_number && (
          <p className="text-sm text-muted-foreground">
            #{matter.matter_number}
          </p>
        )}
        {matter.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {matter.description}
          </p>
        )}
        <div className="flex items-center gap-2 pt-2">
          <Badge variant={matter.status === "active" ? "default" : "secondary"}>
            {matter.status === "active" ? "Active" : "Closed"}
          </Badge>
          <Badge variant="outline">{formatRate()}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
