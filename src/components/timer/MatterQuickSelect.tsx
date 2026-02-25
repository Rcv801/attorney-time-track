import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useTimer } from "@/hooks/useTimer";
import type { Tables } from "@/integrations/supabase/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Pin, PinOff, Search, Plus } from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
  const { actions, activeEntry } = useTimer();
  const [pinnedIds, setPinnedIds] = useState<string[]>(getPinnedIds);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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
      <p className="text-sm text-muted-foreground">
        No active matters. Create a client and matter first.
      </p>
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
