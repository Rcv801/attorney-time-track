import { Button } from "@/components/ui/button";
import { PlusCircle, MoreHorizontal, Edit, Trash2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSkeleton from "@/components/shared/LoadingSkeleton";
import { Archive } from "lucide-react";
import FormDialog from "@/components/shared/FormDialog";
import { MatterForm, type MatterFormValues } from "@/components/forms/MatterForm";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo } from "react";
import { getEffectiveRate } from "@/lib/billing";

type Matter = Tables<"matters"> & { client: Tables<"clients"> };

const Matters = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: matters, isLoading } = useQuery<Matter[]>({
    queryKey: ["matters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matters")
        .select("*, client:clients(*)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMatter = useMutation({
    mutationFn: async (vars: MatterFormValues) => {
      const { error } = await supabase.from("matters").insert({
        ...vars,
        user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matters"] });
      toast({ title: "Matter created" });
      setDialogOpen(false);
    },
    onError: (e: Error) => {
      toast({ title: "Cannot create matter", description: e.message, variant: "destructive" });
    },
  });

  const deleteMatter = useMutation({
    mutationFn: async (matterId: string) => {
      const { error } = await supabase.from("matters").delete().eq("id", matterId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matters"] });
      toast({ title: "Matter deleted" });
    },
    onError: (e: Error) => {
      toast({ title: "Cannot delete matter", description: e.message, variant: "destructive" });
    },
  });

  const filteredMatters = useMemo(() => {
    if (!matters) return [];
    if (!search.trim()) return matters;
    const q = search.toLowerCase();
    return matters.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.matter_number?.toLowerCase().includes(q) ||
        m.client?.name.toLowerCase().includes(q)
    );
  }, [matters, search]);

  const mattersByClient = useMemo(() => {
    return filteredMatters.reduce((acc, matter) => {
      const clientName = matter.client?.name || "Unassigned";
      if (!acc[clientName]) acc[clientName] = [];
      acc[clientName].push(matter);
      return acc;
    }, {} as Record<string, Matter[]>);
  }, [filteredMatters]);

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Matters</h1>
          <p className="text-muted-foreground mt-1">
            {matters?.length ?? 0} matter{matters?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <FormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          trigger={
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              New Matter
            </Button>
          }
          title="Create a new matter"
          description="Enter the matter details below."
        >
          <MatterForm
            onSubmit={(data) => createMatter.mutate(data)}
            isSubmitting={createMatter.isPending}
          />
        </FormDialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search matters..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {Object.keys(mattersByClient).length > 0 ? (
        <div className="space-y-8">
          {Object.entries(mattersByClient).map(([clientName, clientMatters]) => (
            <div key={clientName}>
              <h2 className="text-lg font-semibold text-muted-foreground mb-3">{clientName}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {clientMatters.map((matter) => (
                  <Card key={matter.id} className="group transition-shadow hover:shadow-md">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-start justify-between text-base">
                        <span className="leading-tight">{matter.name}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-label={`Actions for ${matter.name}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => deleteMatter.mutate(matter.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </CardTitle>
                      {matter.matter_number && (
                        <CardDescription>#{matter.matter_number}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="pb-2">
                      <p className="text-lg font-semibold">
                        ${getEffectiveRate(matter.hourly_rate, matter.client?.hourly_rate ?? 0)}/hr
                      </p>
                      {matter.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {matter.description}
                        </p>
                      )}
                    </CardContent>
                    <CardFooter>
                      <Badge variant={matter.status === "active" ? "default" : "secondary"}>
                        {matter.status}
                      </Badge>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : search ? (
        <div className="text-center py-12 text-muted-foreground">
          No matters match "{search}"
        </div>
      ) : (
        <EmptyState
          title="No matters yet"
          description="Create your first matter to start tracking time."
          buttonText="Create Matter"
          onButtonClick={() => setDialogOpen(true)}
          icon={<Archive className="h-16 w-16" />}
        />
      )}
    </div>
  );
};

export default Matters;
