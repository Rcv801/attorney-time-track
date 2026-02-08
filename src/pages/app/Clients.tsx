import { Button } from "@/components/ui/button";
import { PlusCircle, MoreHorizontal, Edit, Trash2, Search, ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import FormDialog from "@/components/shared/FormDialog";
import { ClientForm, type ClientFormValues } from "@/components/forms/ClientForm";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import EmptyState from "@/components/shared/EmptyState";
import LoadingSkeleton from "@/components/shared/LoadingSkeleton";
import { Users } from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { getEffectiveRate } from "@/lib/billing";

type Client = Tables<"clients">;
type Matter = Tables<"matters">;

const Clients = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [search, setSearch] = useState("");
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut
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

  // Fetch matters for inline expansion
  const { data: allMatters } = useQuery<Matter[]>({
    queryKey: ["matters-for-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matters")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Count active matters per client
  const matterCounts = useMemo(() => {
    const counts: Record<string, { active: number; total: number; matters: Matter[] }> = {};
    allMatters?.forEach(m => {
      if (!counts[m.client_id]) counts[m.client_id] = { active: 0, total: 0, matters: [] };
      counts[m.client_id].total++;
      counts[m.client_id].matters.push(m);
      if (m.status === "active") counts[m.client_id].active++;
    });
    return counts;
  }, [allMatters]);

  const createClient = useMutation({
    mutationFn: async (vars: ClientFormValues) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("clients").insert({ ...vars, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); toast({ title: "Client created" }); setCreateDialogOpen(false); },
    onError: (e: Error) => { toast({ title: "Cannot create client", description: e.message, variant: "destructive" }); },
  });

  const updateClient = useMutation({
    mutationFn: async (vars: ClientFormValues & { id: string }) => {
      const { id, ...data } = vars;
      const { error } = await supabase.from("clients").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); toast({ title: "Client updated" }); setEditClient(null); },
    onError: (e: Error) => { toast({ title: "Cannot update client", description: e.message, variant: "destructive" }); },
  });

  const deleteClient = useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase.from("clients").update({ archived: true }).eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); toast({ title: "Client archived" }); },
    onError: (e: Error) => { toast({ title: "Cannot archive client", description: e.message, variant: "destructive" }); },
  });

  // Filter clients
  const filteredClients = useMemo(() => {
    if (!clients) return [];
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.notes?.toLowerCase().includes(q)
    );
  }, [clients, search]);

  // Group by first letter
  const clientsByLetter = useMemo(() => {
    const groups: Record<string, Client[]> = {};
    filteredClients.forEach(c => {
      const letter = c.name.charAt(0).toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(c);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredClients]);

  const toggleExpand = (clientId: string) => {
    setExpandedClients(prev => {
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

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Clients</h1>
          <p className="text-muted-foreground mt-1">
            {clients?.length ?? 0} active client{clients?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <FormDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          trigger={
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> New Client
            </Button>
          }
          title="Create a new client"
          description="Enter the client's information below."
        >
          <ClientForm onSubmit={(data) => createClient.mutate(data)} isSubmitting={createClient.isPending} />
        </FormDialog>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchRef}
          placeholder="Search clients... (⌘K)"
          className="pl-9 h-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {clientsByLetter.length > 0 ? (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/30 text-xs text-muted-foreground uppercase tracking-wider">
                <th className="px-3 py-2 w-8"></th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Rate</th>
                <th className="px-3 py-2 text-left">Active Matters</th>
                <th className="px-3 py-2 text-left">Updated</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {clientsByLetter.map(([letter, letterClients]) => (
                <React.Fragment key={letter}>
                  {/* Sticky letter header */}
                  <tr>
                    <td colSpan={6} className="px-3 py-1.5 bg-muted/50 border-b sticky top-0 z-10">
                      <span className="text-xs font-bold text-muted-foreground uppercase">{letter}</span>
                    </td>
                  </tr>
                  {letterClients.map(client => {
                    const counts = matterCounts[client.id];
                    const isExpanded = expandedClients.has(client.id);
                    return (
                      <React.Fragment key={client.id}>
                        <tr
                          className="group h-10 border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => toggleExpand(client.id)}
                        >
                          <td className="px-3 w-8">
                            {counts && counts.total > 0 ? (
                              isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            ) : <span className="w-4" />}
                          </td>
                          <td className="px-3">
                            <div>
                              <span className="text-sm font-medium">{client.name}</span>
                              {client.notes && (
                                <span className="text-xs text-muted-foreground ml-2 hidden md:inline truncate max-w-[200px]">
                                  — {client.notes}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 text-sm tabular-nums">${client.hourly_rate}/hr</td>
                          <td className="px-3">
                            {counts ? (
                              <Badge variant="secondary" className="text-xs">
                                {counts.active} active
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 text-sm text-muted-foreground whitespace-nowrap">
                            {formatDate(client.updated_at)}
                          </td>
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
                                <DropdownMenuItem onClick={() => setEditClient(client)}>
                                  <Edit className="mr-2 h-4 w-4" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => deleteClient.mutate(client.id)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Archive
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                        {/* Expanded matters inline */}
                        {isExpanded && counts?.matters.map(matter => (
                          <tr key={matter.id} className="h-9 border-b border-border/30 bg-muted/20">
                            <td className="px-3"></td>
                            <td className="px-3 pl-8" colSpan={2}>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground font-mono">
                                  {matter.matter_number ? `#${matter.matter_number}` : ""}
                                </span>
                                <span className="text-sm">{matter.name}</span>
                                <Badge
                                  variant={matter.status === "active" ? "default" : "secondary"}
                                  className="text-[10px] px-1.5 py-0 capitalize"
                                >
                                  {matter.status}
                                </Badge>
                              </div>
                            </td>
                            <td className="px-3 text-sm tabular-nums text-muted-foreground">
                              ${getEffectiveRate(matter.hourly_rate, client.hourly_rate)}/hr
                            </td>
                            <td className="px-3 text-xs text-muted-foreground">{formatDate(matter.updated_at)}</td>
                            <td></td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : search ? (
        <div className="text-center py-12 text-muted-foreground">
          No clients match "{search}"
        </div>
      ) : (
        <EmptyState
          title="No clients yet"
          description="Create your first client to start tracking time and billing."
          buttonText="Create Client"
          onButtonClick={() => setCreateDialogOpen(true)}
          icon={<Users className="h-16 w-16" />}
        />
      )}

      {/* Edit Client Dialog */}
      <FormDialog
        open={!!editClient}
        onOpenChange={(open) => !open && setEditClient(null)}
        title="Edit client"
        description="Update the client's information below."
      >
        {editClient && (
          <ClientForm
            initialValues={editClient}
            onSubmit={(data) => updateClient.mutate({ ...data, id: editClient.id })}
            isSubmitting={updateClient.isPending}
          />
        )}
      </FormDialog>
    </div>
  );
};

import React from "react";
export default Clients;
