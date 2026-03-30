import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useTimer } from "@/hooks/useTimer";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Pin, PinOff, Search, Plus, Loader2 } from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type Matter = Tables<"matters"> & { client: Tables<"clients"> };

const PINNED_KEY = "att-pinned-matters";

function getPinnedIds(): string[] {
  try {
    const stored = localStorage.getItem(PINNED_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function savePinnedIds(ids: string[]) {
  localStorage.setItem(PINNED_KEY, JSON.stringify(ids));
}

const MatterQuickSelect = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const { actions, activeEntry } = useTimer();
  const [pinnedIds, setPinnedIds] = useState<string[]>(getPinnedIds);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [matterName, setMatterName] = useState("");
  const [hourlyRate, setHourlyRate] = useState("0");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Persist pinned IDs
  useEffect(() => {
    savePinnedIds(pinnedIds);
  }, [pinnedIds]);

  // Focus search input when popover opens
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setSearchQuery("");
    }
  }, [searchOpen]);

  const { data: allMatters, isLoading } = useQuery<Matter[]>({
    queryKey: ["matters-all-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matters")
        .select("*, client:clients(*)")
        .eq("status", "active")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Split into pinned and unpinned
  const pinnedMatters = useMemo(() => {
    if (!allMatters) return [];
    return pinnedIds
      .map(id => allMatters.find(m => m.id === id))
      .filter(Boolean) as Matter[];
  }, [allMatters, pinnedIds]);

  // Search results
  const searchResults = useMemo(() => {
    if (!allMatters || !searchQuery.trim()) return allMatters ?? [];
    const q = searchQuery.toLowerCase();
    return allMatters.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.client?.name?.toLowerCase().includes(q)
    );
  }, [allMatters, searchQuery]);

  // Fallback quick-start list when nothing is pinned yet
  const quickStartMatters = useMemo(() => {
    if (!allMatters) return [];
    return allMatters.slice(0, 6);
  }, [allMatters]);

  const createClientAndMatter = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      if (!clientName.trim()) throw new Error("Client name is required");
      if (!matterName.trim()) throw new Error("Matter name is required");

      // Create the client
      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert({
          name: clientName.trim(),
          hourly_rate: parseFloat(hourlyRate) || 0,
          user_id: user.id,
        })
        .select()
        .single();

      if (clientError) throw clientError;
      if (!newClient) throw new Error("Failed to create client.");

      // Create the matter
      const { data: newMatter, error: matterError } = await supabase
        .from("matters")
        .insert({
          name: matterName.trim(),
          client_id: newClient.id,
          user_id: user.id,
          status: "active",
        })
        .select()
        .single();

      if (matterError) {
        // Rollback client creation if matter fails
        await supabase.from("clients").delete().eq("id", newClient.id);
        throw matterError;
      }

      return newMatter;
    },
    onSuccess: (newMatter) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["matters-for-clients"] });
      qc.invalidateQueries({ queryKey: ["matters-all-active"] });
      toast({ title: "Client and matter created" });

      // Start timer on the new matter
      actions.quickSwitch({
        id: newMatter.id,
        client_id: newMatter.client_id,
        name: newMatter.name,
      });

      // Reset form and close dialog
      setClientName("");
      setMatterName("");
      setHourlyRate("0");
      setCreateDialogOpen(false);
    },
    onError: (e: Error) => {
      toast({
        title: "Failed to create client and matter",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  const togglePin = (matterId: string) => {
    setPinnedIds(prev =>
      prev.includes(matterId)
        ? prev.filter(id => id !== matterId)
        : [...prev, matterId]
    );
  };

  const formatMatterName = (matter: Matter) => {
    const clientName = matter.client?.name ?? "Unknown";
    return `${clientName} — ${matter.name}`;
  };

  if (isLoading) {
    return (
      <div className="flex flex-wrap gap-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-9 w-32 rounded-md" />
        ))}
      </div>
    );
  }

  if (!allMatters?.length) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          No active matters. Create a client and matter first.
        </p>
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Create Client + Matter
        </Button>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Client and Matter</DialogTitle>
              <DialogDescription>
                Create a new client and their first matter to start tracking time.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="qs-client-name">Client Name *</Label>
                <Input
                  id="qs-client-name"
                  placeholder="e.g., Acme Corp"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  disabled={createClientAndMatter.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qs-matter-name">Matter Name *</Label>
                <Input
                  id="qs-matter-name"
                  placeholder="e.g., Contract Review"
                  value={matterName}
                  onChange={(e) => setMatterName(e.target.value)}
                  disabled={createClientAndMatter.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qs-hourly-rate">Hourly Rate (optional)</Label>
                <Input
                  id="qs-hourly-rate"
                  type="number"
                  placeholder="0"
                  min="0"
                  step="0.01"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  disabled={createClientAndMatter.isPending}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setCreateDialogOpen(false);
                  setClientName("");
                  setMatterName("");
                  setHourlyRate("0");
                }}
                disabled={createClientAndMatter.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => createClientAndMatter.mutate()}
                disabled={
                  !clientName.trim() ||
                  !matterName.trim() ||
                  createClientAndMatter.isPending
                }
                className="gap-2"
              >
                {createClientAndMatter.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Create & Start
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Pinned matters grid */}
      {pinnedMatters.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {pinnedMatters.map((matter) => {
            const isActive = activeEntry?.matter_id === matter.id;
            return (
              <div key={matter.id} className="group relative">
                <Button
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
                  className="gap-1.5 pr-8"
                >
                  {!isActive && <Play className="h-3 w-3" />}
                  {formatMatterName(matter)}
                </Button>
                <button
                  onClick={(e) => { e.stopPropagation(); togglePin(matter.id); }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
                  aria-label="Unpin matter"
                >
                  <PinOff className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            No pinned matters yet. Use one of these to start now:
          </p>
          <div className="flex flex-wrap gap-2">
            {quickStartMatters.map((matter) => {
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
                  {formatMatterName(matter)}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* Add matter button with search popover */}
      <Popover open={searchOpen} onOpenChange={setSearchOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
            <Plus className="h-3.5 w-3.5" />
            Add to Quick Start
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Search matters..."
                className="pl-8 h-8 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {searchResults.length > 0 ? (
              searchResults.map(matter => {
                const isPinned = pinnedIds.includes(matter.id);
                return (
                  <button
                    key={matter.id}
                    onClick={() => togglePin(matter.id)}
                    className="w-full flex items-center justify-between rounded-md px-2.5 py-2 text-sm hover:bg-muted transition-colors text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{matter.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{matter.client?.name}</p>
                    </div>
                    {isPinned ? (
                      <PinOff className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-2" />
                    ) : (
                      <Pin className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-2" />
                    )}
                  </button>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No matters found</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default MatterQuickSelect;
