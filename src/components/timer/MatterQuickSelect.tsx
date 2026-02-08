import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useTimer } from "@/hooks/useTimer";
import type { Tables } from "@/integrations/supabase/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Play } from "lucide-react";

type Matter = Tables<"matters"> & { client: Tables<"clients"> };

const MatterQuickSelect = () => {
  const { actions, activeEntry } = useTimer();
  const { data: matters, isLoading } = useQuery<Matter[]>({
    queryKey: ["matters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matters")
        .select("*, client:clients(*)")
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-md" />
        ))}
      </div>
    );
  }

  if (!matters?.length) {
    return (
      <p className="mt-2 text-sm text-muted-foreground">
        No active matters. Create a matter first.
      </p>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {matters.map((matter) => {
        const isActive = activeEntry?.matter_id === matter.id;
        return (
          <Button
            key={matter.id}
            variant={isActive ? "default" : "outline"}
            size="sm"
            onClick={() =>
              actions.quickSwitch({
                id: matter.id,
                client_id: matter.client_id,
                name: matter.name,
              })
            }
            disabled={isActive}
            className="gap-1.5"
          >
            {!isActive && <Play className="h-3 w-3" />}
            {matter.name}
          </Button>
        );
      })}
    </div>
  );
};

export default MatterQuickSelect;
