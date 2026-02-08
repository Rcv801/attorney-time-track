import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tables } from "@/integrations/supabase/types";

type Matter = Tables<"matters">;
type Client = Tables<"clients">;

interface MatterFormDialogProps {
  trigger?: React.ReactNode;
  title?: string;
  clients: Client[] | undefined;
  initial?: Partial<Matter> & { id?: string };
  onSubmit: (values: {
    id?: string;
    client_id: string;
    name: string;
    matter_number?: string;
    description?: string;
    status: string;
    hourly_rate?: number;
    flat_fee?: number;
    billing_type: string;
  }) => void;
  defaultClientId?: string;
}

export default function MatterFormDialog({
  trigger,
  title = "New matter",
  clients,
  initial,
  onSubmit,
  defaultClientId,
}: MatterFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState(initial?.client_id ?? defaultClientId ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [matterNumber, setMatterNumber] = useState(initial?.matter_number ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState(initial?.status ?? "active");
  const [billingType, setBillingType] = useState(initial?.billing_type ?? "hourly");
  const [hourlyRate, setHourlyRate] = useState<string>(
    initial?.hourly_rate?.toString() ?? ""
  );
  const [flatFee, setFlatFee] = useState<string>(
    initial?.flat_fee?.toString() ?? ""
  );
  const [useCustomRate, setUseCustomRate] = useState(
    initial?.hourly_rate !== null && initial?.hourly_rate !== undefined
  );

  // Reset form when dialog opens with new initial data
  useEffect(() => {
    if (open && initial) {
      setClientId(initial.client_id ?? defaultClientId ?? "");
      setName(initial.name ?? "");
      setMatterNumber(initial.matter_number ?? "");
      setDescription(initial.description ?? "");
      setStatus(initial.status ?? "active");
      setBillingType(initial.billing_type ?? "hourly");
      setHourlyRate(initial.hourly_rate?.toString() ?? "");
      setFlatFee(initial.flat_fee?.toString() ?? "");
      setUseCustomRate(
        initial.hourly_rate !== null && initial.hourly_rate !== undefined
      );
    }
  }, [open, initial, defaultClientId]);

  const parseRate = (value: string): number | undefined => {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? undefined : parsed;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !name) return;

    onSubmit({
      id: initial?.id,
      client_id: clientId,
      name: name.trim(),
      matter_number: matterNumber.trim() || undefined,
      description: description.trim() || undefined,
      status,
      hourly_rate: billingType === "hourly" && useCustomRate && hourlyRate
        ? parseRate(hourlyRate)
        : undefined,
      flat_fee: billingType === "flat_fee" && flatFee
        ? parseRate(flatFee)
        : undefined,
      billing_type: billingType,
    });
    setOpen(false);
    
    // Reset form if not editing
    if (!initial?.id) {
      setName("");
      setMatterNumber("");
      setDescription("");
      setHourlyRate("");
      setFlatFee("");
      setUseCustomRate(false);
    }
  };

  const selectedClient = clients?.find((c) => c.id === clientId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button>New Matter</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client Selection */}
          <div className="space-y-2">
            <Label htmlFor="client">Client *</Label>
            <Select value={clientId} onValueChange={setClientId} required>
              <SelectTrigger id="client">
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients
                  ?.filter((c) => !c.archived)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ backgroundColor: c.color ?? "#9ca3af" }}
                        />
                        {c.name}
                        {c.hourly_rate > 0 && (
                          <span className="text-muted-foreground text-xs">
                            (${c.hourly_rate}/hr)
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Matter Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Matter Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Contract Dispute 2024"
              required
            />
          </div>

          {/* Matter Number */}
          <div className="space-y-2">
            <Label htmlFor="matter-number">Matter Number</Label>
            <Input
              id="matter-number"
              value={matterNumber}
              onChange={(e) => setMatterNumber(e.target.value)}
              placeholder="e.g., 2024-001"
            />
            <p className="text-xs text-muted-foreground">
              Optional reference number for your records
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this matter"
              rows={2}
            />
          </div>

          {/* Billing Type */}
          <div className="space-y-2">
            <Label>Billing Type</Label>
            <Select value={billingType} onValueChange={setBillingType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="flat_fee">Flat Fee</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Hourly Rate */}
          {billingType === "hourly" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="custom-rate">Custom Hourly Rate</Label>
                <Switch
                  checked={useCustomRate}
                  onCheckedChange={setUseCustomRate}
                />
              </div>
              {useCustomRate ? (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">$</span>
                  <Input
                    id="custom-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    placeholder="0.00"
                  />
                  <span className="text-muted-foreground whitespace-nowrap">/ hour</span>
                </div>
              ) : selectedClient ? (
                <p className="text-sm text-muted-foreground">
                  Using client rate: ${selectedClient.hourly_rate}/hour
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a client to see their rate
                </p>
              )}
            </div>
          )}

          {/* Flat Fee */}
          {billingType === "flat_fee" && (
            <div className="space-y-2">
              <Label htmlFor="flat-fee">Flat Fee Amount</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
                <Input
                  id="flat-fee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={flatFee}
                  onChange={(e) => setFlatFee(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          )}

          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!clientId || !name}>
              {initial?.id ? "Save Changes" : "Create Matter"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
