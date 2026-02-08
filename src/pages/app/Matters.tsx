import { Button } from "@/components/ui/button";
import {
  PlusCircle, MoreHorizontal, Edit, Trash2, Search, Star, ChevronDown, ChevronRight,
  ArrowUpDown, Filter, Play,
} from "lucide-react";
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
import { useTimer } from "@/hooks/useTimer";
import type { Tables } from "@/integrations/supabase/types";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { getEffectiveRate } from "@/lib/billing";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Matter = Tables<"matters"> & { client: Tables<"clients"> };

type StatusFilter = "all" | "active" | "closed" | "archived";
type SortOption = "updated_at" | "name" | "matter_number" | "hourly_rate";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "closed", label: "Closed" },
  { value: "archived", label: "Archived" },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "updated_at", label: "Last Updated" },
  { value: "name", label: "Name" },
  { value: "matter_number", label: "Matter Number" },
  { value: "hourly_rate", label: "Rate" },
];

const Matters = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { actions: timerActions } = useTimer();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editMatter, setEditMatter] = useState<Matter | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("updated_at");
  const [collapsedClients, setCollapsedClients] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Cmd+K or / to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey && e.key === "k") || (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement))) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

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

  // Pin state - stored locally, synced to DB when is_pinned column exists
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("pinned_matters");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  const togglePin = useCallback((id: string) => {
    setPinnedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem("pinned_matters", JSON.stringify([...next]));
      // Also try to update DB (non-blocking)
      supabase.from("matters").update({ is_pinned: next.has(id) } as any).eq("id", id).then();
      return next;
    });
  }, []);

  const createMatter = useMutation({
    mutationFn: async (vars: MatterFormValues) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("matters").insert({ ...vars, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["matters"] }); toast({ title: "Matter created" }); setCreateDialogOpen(false); },
    onError: (e: Error) => { toast({ title: "Cannot create matter", description: e.message, variant: "destructive" }); },
  });

  const updateMatter = useMutation({
    mutationFn: async (vars: MatterFormValues & { id: string }) => {
      const { id, ...data } = vars;
      const { error } = await supabase.from("matters").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["matters"] }); toast({ title: "Matter updated" }); setEditMatter(null); },
    onError: (e: Error) => { toast({ title: "Cannot update matter", description: e.message, variant: "destructive" }); },
  });

  const deleteMatter = useMutation({
    mutationFn: async (matterId: string) => {
      const { error } = await supabase.from("matters").delete().eq("id", matterId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["matters"] }); toast({ title: "Matter deleted" }); },
    onError: (e: Error) => { toast({ title: "Cannot delete matter", description: e.message, variant: "destructive" }); },
  });

  // Unique clients for filter dropdown
  const clientOptions = useMemo(() => {
    if (!matters) return [];
    const map = new Map<string, { id: string; name: string; count: number }>();
    matters.forEach(m => {
      const cid = m.client?.id || "none";
      const cname = m.client?.name || "Unassigned";
      const existing = map.get(cid);
      if (existing) existing.count++; else map.set(cid, { id: cid, name: cname, count: 1 });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [matters]);

  // Filtering + sorting
  const processedMatters = useMemo(() => {
    if (!matters) return [];
    let filtered = matters;

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(m => m.status === statusFilter);
    }

    // Client filter
    if (clientFilter !== "all") {
      filtered = filtered.filter(m => (m.client?.id || "none") === clientFilter);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.matter_number?.toLowerCase().includes(q) ||
        m.client?.name.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q)
      );
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "name": return a.name.localeCompare(b.name);
        case "matter_number": return (a.matter_number || "").localeCompare(b.matter_number || "");
        case "hourly_rate": return (getEffectiveRate(b.hourly_rate, b.client?.hourly_rate ?? 0)) - (getEffectiveRate(a.hourly_rate, a.client?.hourly_rate ?? 0));
        case "updated_at":
        default: return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });

    return filtered;
  }, [matters, statusFilter, clientFilter, search, sortBy]);

  // Pinned matters
  const pinnedMatters = useMemo(() => processedMatters.filter(m => pinnedIds.has(m.id)), [processedMatters, pinnedIds]);
  const unpinnedMatters = useMemo(() => processedMatters.filter(m => !pinnedIds.has(m.id)), [processedMatters, pinnedIds]);

  // Group by client
  const mattersByClient = useMemo(() => {
    const groups: Record<string, { clientName: string; matters: Matter[] }> = {};
    unpinnedMatters.forEach(m => {
      const key = m.client?.id || "none";
      const name = m.client?.name || "Unassigned";
      if (!groups[key]) groups[key] = { clientName: name, matters: [] };
      groups[key].matters.push(m);
    });
    return Object.entries(groups).sort(([, a], [, b]) => a.clientName.localeCompare(b.clientName));
  }, [unpinnedMatters]);

  const toggleCollapse = (clientId: string) => {
    setCollapsedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId); else next.add(clientId);
      return next;
    });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const MatterRow = ({ matter, showClient = false }: { matter: Matter; showClient?: boolean }) => {
    const isPinned = pinnedIds.has(matter.id);
    const rate = getEffectiveRate(matter.hourly_rate, matter.client?.hourly_rate ?? 0);

    return (
      <tr
        className="group h-12 border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-colors"
        onClick={() => timerActions.start(matter.id, matter.client_id)}
      >
        <td className="px-3 w-8" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => togglePin(matter.id)}
            className={`transition-colors ${isPinned ? "text-yellow-500" : "text-muted-foreground/30 hover:text-yellow-500/70"}`}
            aria-label={isPinned ? "Unpin matter" : "Pin matter"}
          >
            <Star className={`h-4 w-4 ${isPinned ? "fill-current" : ""}`} />
          </button>
        </td>
        <td className="px-3 text-sm text-muted-foreground font-mono whitespace-nowrap">
          {matter.matter_number ? `#${matter.matter_number}` : "—"}
        </td>
        <td className="px-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate max-w-[200px] lg:max-w-[300px]">{matter.name}</span>
            {showClient && matter.client && (
              <span className="text-xs text-muted-foreground">({matter.client.name})</span>
            )}
          </div>
        </td>
        <td className="px-3">
          <Badge
            variant={matter.status === "active" ? "default" : "secondary"}
            className="text-xs capitalize"
          >
            {matter.status}
          </Badge>
        </td>
        <td className="px-3 text-sm tabular-nums">${rate}/hr</td>
        <td className="px-3 text-sm text-muted-foreground whitespace-nowrap">{formatDate(matter.updated_at)}</td>
        <td className="px-3 w-10" onClick={e => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost" size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => timerActions.start(matter.id, matter.client_id)}>
                <Play className="mr-2 h-4 w-4" /> Start Timer
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => togglePin(matter.id)}>
                <Star className="mr-2 h-4 w-4" /> {isPinned ? "Unpin" : "Pin"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setEditMatter(matter)}>
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
        </td>
      </tr>
    );
  };

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Matters</h1>
          <p className="text-muted-foreground mt-1">
            {matters?.length ?? 0} matter{matters?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <FormDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          trigger={
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> New Matter
            </Button>
          }
          title="Create a new matter"
          description="Enter the matter details below."
        >
          <MatterForm onSubmit={(data) => createMatter.mutate(data)} isSubmitting={createMatter.isPending} />
        </FormDialog>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 w-fit">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              statusFilter === tab.value
                ? "bg-background text-foreground shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search + filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            placeholder="Search matters... (⌘K)"
            className="pl-9 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-[180px] h-9">
            <Filter className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="All Clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clientOptions.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name} ({c.count})</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-[160px] h-9">
            <ArrowUpDown className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {processedMatters.length > 0 ? (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/30 text-xs text-muted-foreground uppercase tracking-wider">
                <th className="px-3 py-2 w-8"></th>
                <th className="px-3 py-2 text-left">Matter #</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Rate</th>
                <th className="px-3 py-2 text-left">Updated</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {/* Pinned matters section */}
              {pinnedMatters.length > 0 && (
                <>
                  <tr>
                    <td colSpan={7} className="px-3 py-2 bg-yellow-500/5 border-b">
                      <span className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Star className="h-3 w-3 fill-current" /> Pinned Matters ({pinnedMatters.length})
                      </span>
                    </td>
                  </tr>
                  {pinnedMatters.map(m => <MatterRow key={m.id} matter={m} showClient />)}
                </>
              )}

              {/* Client groups */}
              {mattersByClient.map(([clientId, { clientName, matters: clientMatters }]) => {
                const isCollapsed = collapsedClients.has(clientId);
                return (
                  <React.Fragment key={clientId}>
                    <tr
                      className="cursor-pointer hover:bg-muted/30 border-b"
                      onClick={() => toggleCollapse(clientId)}
                    >
                      <td colSpan={7} className="px-3 py-2">
                        <span className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          {clientName}
                          <span className="text-xs font-normal">({clientMatters.length} matter{clientMatters.length !== 1 ? "s" : ""})</span>
                        </span>
                      </td>
                    </tr>
                    {!isCollapsed && clientMatters.map(m => <MatterRow key={m.id} matter={m} />)}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : search || statusFilter !== "all" || clientFilter !== "all" ? (
        <div className="text-center py-12 text-muted-foreground">
          No matters match your filters
        </div>
      ) : (
        <EmptyState
          title="No matters yet"
          description="Create your first matter to start tracking time."
          buttonText="Create Matter"
          onButtonClick={() => setCreateDialogOpen(true)}
          icon={<Archive className="h-16 w-16" />}
        />
      )}

      {/* Edit Matter Dialog */}
      <FormDialog
        open={!!editMatter}
        onOpenChange={(open) => !open && setEditMatter(null)}
        title="Edit matter"
        description="Update the matter details below."
      >
        {editMatter && (
          <MatterForm
            defaultValues={{
              name: editMatter.name,
              matter_number: editMatter.matter_number || "",
              hourly_rate: editMatter.hourly_rate,
              client_id: editMatter.client_id,
              description: editMatter.description || "",
            }}
            onSubmit={(data) => updateMatter.mutate({ ...data, id: editMatter.id })}
            isSubmitting={updateMatter.isPending}
          />
        )}
      </FormDialog>
    </div>
  );
};

import React from "react";
export default Matters;
