import { useState, useMemo } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronDown, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Matter = Tables<"matters">;
type Client = Tables<"clients">;
type Entry = Tables<"entries">;

interface MatterSelectorProps {
  matters: (Matter & { client: Client })[] | undefined;
  entries: Entry[] | undefined;
  value: string;
  onChange: (matterId: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function MatterSelector({
  matters,
  entries,
  value,
  onChange,
  disabled,
  placeholder = "Select a matter...",
}: MatterSelectorProps) {
  const [open, setOpen] = useState(false);

  // Get recent matters from entries (last 30 days)
  const recentMatterIds = useMemo(() => {
    if (!entries) return [];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentEntries = entries.filter(
      (e) => new Date(e.start_at) >= thirtyDaysAgo && e.matter_id
    );

    // Count occurrences and get unique IDs sorted by frequency
    const counts = recentEntries.reduce((acc, e) => {
      acc[e.matter_id!] = (acc[e.matter_id!] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);
  }, [entries]);

  const recentMatters = useMemo(() => {
    if (!matters) return [];
    return recentMatterIds
      .map((id) => matters.find((m) => m.id === id))
      .filter((m): m is Matter & { client: Client } => m !== undefined)
      .filter((m) => m.status === "active");
  }, [matters, recentMatterIds]);

  // Group matters by client
  const groupedMatters = useMemo(() => {
    if (!matters) return [];
    const grouped = matters
      .filter((m) => m.status === "active")
      .reduce((acc, matter) => {
        const clientName = matter.client?.name ?? "Unknown Client";
        if (!acc[clientName]) {
          acc[clientName] = {
            client: matter.client,
            matters: [],
          };
        }
        acc[clientName].matters.push(matter);
        return acc;
      }, {} as Record<string, { client: Client; matters: (Matter & { client: Client })[] }>);

    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [matters]);

  const selectedMatter = matters?.find((m) => m.id === value);
  const selectedClient = selectedMatter?.client;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between"
        >
          {selectedMatter ? (
            <span className="flex items-center gap-2 truncate">
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{
                  backgroundColor: selectedClient?.color ?? "#9ca3af",
                }}
              />
              <span className="truncate">
                {selectedClient?.name} — {selectedMatter.name}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search matters..." />
          <CommandList>
            <CommandEmpty>No matters found.</CommandEmpty>

            {/* Recent Matters Section */}
            {recentMatters.length > 0 && (
              <CommandGroup heading="Recent">
                {recentMatters.map((matter) => (
                  <CommandItem
                    key={matter.id}
                    value={`recent-${matter.id}`}
                    onSelect={() => {
                      onChange(matter.id);
                      setOpen(false);
                    }}
                  >
                    <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="flex items-center gap-2 flex-1">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor: matter.client?.color ?? "#9ca3af",
                        }}
                      />
                      <span className="truncate">
                        {matter.client?.name} — {matter.name}
                      </span>
                    </span>
                    {value === matter.id && (
                      <Check className="ml-2 h-4 w-4" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Grouped by Client */}
            {groupedMatters.map(([clientName, { client, matters: clientMatters }]) => (
              <CommandGroup
                key={clientName}
                heading={
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: client?.color ?? "#9ca3af" }}
                    />
                    {clientName}
                  </span>
                }
              >
                {clientMatters.map((matter) => (
                  <CommandItem
                    key={matter.id}
                    value={`${clientName} ${matter.name} ${matter.matter_number ?? ""}`}
                    onSelect={() => {
                      onChange(matter.id);
                      setOpen(false);
                    }}
                  >
                    <span className="flex-1 truncate pl-4">{matter.name}</span>
                    {matter.matter_number && (
                      <Badge variant="outline" className="ml-2 shrink-0 text-xs">
                        #{matter.matter_number}
                      </Badge>
                    )}
                    {value === matter.id && (
                      <Check className="ml-2 h-4 w-4 shrink-0" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
