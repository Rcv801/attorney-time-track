import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CreditCard, FileText, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import LoadingSkeleton from "@/components/shared/LoadingSkeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type SettingsForm = {
  firmName: string;
  attorneyName: string;
  barNumber: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  emailFromName: string;
  emailFromAddress: string;
  defaultRate: string;
  billingIncrement: string;
  roundingRule: string;
  timekeeperClassification: string;
  paymentTerms: string;
  defaultTaxRate: string;
  invoiceNotes: string;
  replyToEmail: string;
  emailSubjectTemplate: string;
  emailBodyTemplate: string;
  stripeConnected: boolean;
  stripePublishableKey: string;
};

type UserSettingsRow = {
  user_id: string;
  firm_name: string | null;
  attorney_name: string | null;
  bar_number: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  email_from_name: string | null;
  email_from_address: string | null;
  default_rate: number | null;
  billing_increment: number | null;
  rounding_rule: string | null;
  timekeeper_classification: string | null;
  payment_terms: string | null;
  default_tax_rate: number | null;
  invoice_notes: string | null;
  reply_to_email: string | null;
  email_subject_template: string | null;
  email_body_template: string | null;
  stripe_connected: boolean | null;
  stripe_publishable_key: string | null;
};

const BILLING_INCREMENT_OPTIONS = [
  { value: "6", label: "6 minutes" },
  { value: "10", label: "10 minutes" },
  { value: "15", label: "15 minutes" },
];

const ROUNDING_RULE_OPTIONS = [
  { value: "up", label: "Round up" },
  { value: "down", label: "Round down" },
  { value: "nearest", label: "Nearest" },
];

const TIMEKEEPER_CLASS_OPTIONS = [
  { value: "PARTNER", label: "Partner" },
  { value: "ASSOCIATE", label: "Associate" },
  { value: "PARALEGAL", label: "Paralegal" },
  { value: "CONTRACTOR", label: "Contractor" },
];

const PAYMENT_TERMS_OPTIONS = [
  { value: "Due on Receipt", label: "Due on Receipt" },
  { value: "Net 15", label: "Net 15" },
  { value: "Net 30", label: "Net 30" },
  { value: "Net 45", label: "Net 45" },
  { value: "Net 60", label: "Net 60" },
];

function createDefaultForm(userEmail?: string | null): SettingsForm {
  return {
    firmName: "",
    attorneyName: "",
    barNumber: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    zip: "",
    emailFromName: "",
    emailFromAddress: "",
    defaultRate: "300",
    billingIncrement: "6",
    roundingRule: "up",
    timekeeperClassification: "PARTNER",
    paymentTerms: "Net 30",
    defaultTaxRate: "0",
    invoiceNotes: "Thank you for your business.",
    replyToEmail: userEmail ?? "",
    emailSubjectTemplate: "Invoice {number} from {firm_name}",
    emailBodyTemplate:
      "Please find your invoice attached. You can pay online using the link below.\n\nThank you,\n{firm_name}",
    stripeConnected: false,
    stripePublishableKey: "",
  };
}

function toFormState(settings: UserSettingsRow | null, userEmail?: string | null): SettingsForm {
  const defaults = createDefaultForm(userEmail);

  if (!settings) {
    return defaults;
  }

  return {
    firmName: settings.firm_name ?? "",
    attorneyName: settings.attorney_name ?? "",
    barNumber: settings.bar_number ?? "",
    phone: settings.phone ?? "",
    addressLine1: settings.address_line1 ?? "",
    addressLine2: settings.address_line2 ?? "",
    city: settings.city ?? "",
    state: settings.state ?? "",
    zip: settings.zip ?? "",
    emailFromName: settings.email_from_name ?? "",
    emailFromAddress: settings.email_from_address ?? "",
    defaultRate: settings.default_rate?.toString() ?? defaults.defaultRate,
    billingIncrement: settings.billing_increment?.toString() ?? defaults.billingIncrement,
    roundingRule: settings.rounding_rule ?? defaults.roundingRule,
    timekeeperClassification: settings.timekeeper_classification ?? defaults.timekeeperClassification,
    paymentTerms: settings.payment_terms ?? defaults.paymentTerms,
    defaultTaxRate: formatTaxRatePercent(settings.default_tax_rate),
    invoiceNotes: settings.invoice_notes ?? defaults.invoiceNotes,
    replyToEmail: settings.reply_to_email ?? defaults.replyToEmail,
    emailSubjectTemplate: settings.email_subject_template ?? defaults.emailSubjectTemplate,
    emailBodyTemplate: settings.email_body_template ?? defaults.emailBodyTemplate,
    stripeConnected: Boolean(settings.stripe_connected),
    stripePublishableKey: settings.stripe_publishable_key ?? "",
  };
}

function normalizeText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatTaxRatePercent(value: number | null | undefined) {
  const percent = (value ?? 0) * 100;
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(4).replace(/\.?0+$/, "");
}

function parseTaxRatePercent(value: string) {
  return Number(value) / 100;
}

const STRIPE_WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-webhook`;

const Settings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SettingsForm>(() => createDefaultForm());

  const settingsQuery = useQuery<UserSettingsRow | null>({
    queryKey: ["user-settings"],
    queryFn: async () => {
      if (!user) {
        return null;
      }

      const { data, error } = await supabase
        .from("user_settings")
        .select(`
          user_id,
          firm_name,
          attorney_name,
          bar_number,
          phone,
          address_line1,
          address_line2,
          city,
          state,
          zip,
          email_from_name,
          email_from_address,
          default_rate,
          billing_increment,
          rounding_rule,
          timekeeper_classification,
          payment_terms,
          default_tax_rate,
          invoice_notes,
          reply_to_email,
          email_subject_template,
          email_body_template,
          stripe_connected,
          stripe_publishable_key
        `)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return (data as UserSettingsRow | null) ?? null;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user || settingsQuery.isLoading) {
      return;
    }

    setForm(toFormState(settingsQuery.data ?? null, user.email));
  }, [settingsQuery.data, settingsQuery.isLoading, user]);

  const validationError = useMemo(() => {
    if (!form.firmName.trim()) {
      return "Firm name is required.";
    }

    const defaultRate = Number(form.defaultRate);
    if (!Number.isFinite(defaultRate) || defaultRate <= 0) {
      return "Default billing rate must be greater than zero.";
    }

    const defaultTaxRate = parseTaxRatePercent(form.defaultTaxRate);
    if (!Number.isFinite(defaultTaxRate) || defaultTaxRate < 0) {
      return "Default tax rate cannot be negative.";
    }

    if (form.stripeConnected && !form.stripePublishableKey.trim()) {
      return "Add a Stripe publishable key before enabling Stripe payment links.";
    }

    return null;
  }, [form.defaultRate, form.defaultTaxRate, form.firmName, form.stripeConnected, form.stripePublishableKey]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("You must be signed in to update settings.");
      }

      if (validationError) {
        throw new Error(validationError);
      }

      const payload = {
        user_id: user.id,
        firm_name: form.firmName.trim(),
        attorney_name: normalizeText(form.attorneyName),
        bar_number: normalizeText(form.barNumber),
        phone: normalizeText(form.phone),
        address_line1: normalizeText(form.addressLine1),
        address_line2: normalizeText(form.addressLine2),
        city: normalizeText(form.city),
        state: normalizeText(form.state),
        zip: normalizeText(form.zip),
        email_from_name: normalizeText(form.emailFromName),
        email_from_address: normalizeText(form.emailFromAddress),
        default_rate: Number(form.defaultRate),
        billing_increment: Number(form.billingIncrement),
        rounding_rule: form.roundingRule,
        timekeeper_classification: form.timekeeperClassification,
        payment_terms: form.paymentTerms,
        default_tax_rate: parseTaxRatePercent(form.defaultTaxRate),
        invoice_notes: normalizeText(form.invoiceNotes),
        reply_to_email: normalizeText(form.replyToEmail),
        email_subject_template: normalizeText(form.emailSubjectTemplate),
        email_body_template: normalizeText(form.emailBodyTemplate),
        stripe_connected: form.stripeConnected,
        stripe_publishable_key: normalizeText(form.stripePublishableKey),
      };

      const { error } = await supabase.from("user_settings").upsert(payload);

      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["user-settings"] });
      toast({
        title: "Settings saved",
        description: "Firm details, billing defaults, and invoice templates were updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not save settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateField = <K extends keyof SettingsForm>(field: K, value: SettingsForm[K]) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  if (settingsQuery.isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="section-title mb-1.5">Configuration</p>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">
            Configure firm identity, billing defaults, and invoice messaging in one place.
          </p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !!validationError}>
          {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save Changes
        </Button>
      </div>

      {settingsQuery.isError ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>Could not load settings</CardTitle>
            <CardDescription>
              {settingsQuery.error instanceof Error ? settingsQuery.error.message : "Refresh and try again."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {validationError ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {validationError}
        </div>
      ) : null}

      <Card className="premium-card rounded-xl border border-slate-200 shadow-md">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Building2 className="h-5 w-5" />
            Firm Information
          </CardTitle>
          <CardDescription className="text-slate-600">Used on invoices, PDF headers, and client-facing billing documents.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firm-name">Firm name</Label>
            <Input id="firm-name" value={form.firmName} onChange={(event) => updateField("firmName", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="attorney-name">Attorney name</Label>
            <Input id="attorney-name" value={form.attorneyName} onChange={(event) => updateField("attorneyName", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bar-number">Bar number</Label>
            <Input id="bar-number" value={form.barNumber} onChange={(event) => updateField("barNumber", event.target.value)} placeholder="e.g., KY12345" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-from-name">From name</Label>
            <Input
              id="email-from-name"
              value={form.emailFromName}
              onChange={(event) => updateField("emailFromName", event.target.value)}
              placeholder="Smith Law LLC"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-from-address">From email</Label>
            <Input
              id="email-from-address"
              type="email"
              value={form.emailFromAddress}
              onChange={(event) => updateField("emailFromAddress", event.target.value)}
              placeholder="billing@yourfirm.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reply-to-email">Reply-to email</Label>
            <Input
              id="reply-to-email"
              type="email"
              value={form.replyToEmail}
              onChange={(event) => updateField("replyToEmail", event.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address-line-1">Address line 1</Label>
            <Input
              id="address-line-1"
              value={form.addressLine1}
              onChange={(event) => updateField("addressLine1", event.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address-line-2">Address line 2</Label>
            <Input
              id="address-line-2"
              value={form.addressLine2}
              onChange={(event) => updateField("addressLine2", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" value={form.city} onChange={(event) => updateField("city", event.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input id="state" value={form.state} onChange={(event) => updateField("state", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">ZIP</Label>
              <Input id="zip" value={form.zip} onChange={(event) => updateField("zip", event.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="premium-card rounded-xl border border-slate-200 shadow-md">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Wallet className="h-5 w-5" />
            Billing Defaults
          </CardTitle>
          <CardDescription className="text-slate-600">Set your default rate and rounding behavior for new billing work.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="default-rate">Default hourly rate</Label>
            <Input
              id="default-rate"
              type="number"
              min="0"
              step="0.01"
              value={form.defaultRate}
              onChange={(event) => updateField("defaultRate", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing-increment">Billing increment</Label>
            <Select value={form.billingIncrement} onValueChange={(value) => updateField("billingIncrement", value)}>
              <SelectTrigger id="billing-increment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BILLING_INCREMENT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rounding-rule">Rounding rule</Label>
            <Select value={form.roundingRule} onValueChange={(value) => updateField("roundingRule", value)}>
              <SelectTrigger id="rounding-rule">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROUNDING_RULE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="timekeeper-class">Timekeeper classification</Label>
            <Select
              value={form.timekeeperClassification}
              onValueChange={(value) => updateField("timekeeperClassification", value)}
            >
              <SelectTrigger id="timekeeper-class">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEKEEPER_CLASS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="premium-card rounded-xl border border-slate-200 shadow-md">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <CreditCard className="h-5 w-5" />
            Stripe Payments
          </CardTitle>
          <CardDescription className="text-slate-600">
            Turn on hosted Stripe Checkout links for invoices. The app stores the public key here, while the secret key and webhook secret must be configured in the Supabase project secrets.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="rounded-md border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p className="font-medium text-slate-900">Required operator config</p>
            <p className="mt-1 text-slate-700">Supabase project secrets must include <code>STRIPE_SECRET_KEY</code> and <code>STRIPE_WEBHOOK_SECRET</code>. Without those, the payment-link button will fail even if Stripe is enabled here.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="stripe-publishable-key">Stripe publishable key</Label>
              <Input
                id="stripe-publishable-key"
                value={form.stripePublishableKey}
                onChange={(event) => updateField("stripePublishableKey", event.target.value)}
                placeholder="pk_live_..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stripe-connected">Stripe status</Label>
              <Select
                value={form.stripeConnected ? "connected" : "disabled"}
                onValueChange={(value) => updateField("stripeConnected", value === "connected")}
              >
                <SelectTrigger id="stripe-connected">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disabled">Disabled</SelectItem>
                  <SelectItem value="connected">Enabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-md border border-slate-200 bg-slate-50/40 px-4 py-3 text-sm">
              <p className="font-medium text-slate-900">Webhook URL</p>
              <p className="mt-1 break-all text-slate-700">{STRIPE_WEBHOOK_URL}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50/40 px-4 py-3 text-sm">
              <p className="font-medium text-slate-900">Current app behavior</p>
              <p className="mt-1 text-slate-700">
                {form.stripeConnected
                  ? "Invoice detail will allow Generate Payment Link and include the link in invoice emails when server secrets are present."
                  : "Invoice detail stays in manual-pay mode until Stripe is enabled here."}
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-600">
            Stripe checkout uses card and ACH. Webhook events record payments automatically into SixMin when the Supabase webhook secret is configured.
          </p>
        </CardContent>
      </Card>

      <Card className="premium-card rounded-xl border border-slate-200 shadow-md">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <FileText className="h-5 w-5" />
            Invoice Templates
          </CardTitle>
          <CardDescription className="text-slate-600">Customize invoice defaults and the email copy clients receive with each bill.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="rounded-md border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Invoice emails use the configured sender when its domain is allowed by the delivery provider. Otherwise the app falls back to the workspace default sender and keeps your reply-to address.
          </div>
          <p className="text-sm text-slate-600">
            Available variables: {"{number}"}, {"{client_name}"}, {"{amount}"}, {"{due_date}"}, {"{firm_name}"}, {"{payment_link}"}.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="payment-terms">Payment terms</Label>
              <Select value={form.paymentTerms} onValueChange={(value) => updateField("paymentTerms", value)}>
                <SelectTrigger id="payment-terms">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERMS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax-rate">Default tax rate (%)</Label>
              <Input
                id="tax-rate"
                type="number"
                min="0"
                step="0.01"
                placeholder="8.25"
                value={form.defaultTaxRate}
                onChange={(event) => updateField("defaultTaxRate", event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoice-notes">Default invoice notes</Label>
            <Textarea
              id="invoice-notes"
              rows={4}
              value={form.invoiceNotes}
              onChange={(event) => updateField("invoiceNotes", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-subject">Email subject template</Label>
            <Input
              id="email-subject"
              value={form.emailSubjectTemplate}
              onChange={(event) => updateField("emailSubjectTemplate", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-body">Email body template</Label>
            <Textarea
              id="email-body"
              rows={8}
              value={form.emailBodyTemplate}
              onChange={(event) => updateField("emailBodyTemplate", event.target.value)}
            />
          </div>
          <p className="text-sm text-slate-600">
            Available variables: {"{number}"}, {"{client_name}"}, {"{amount}"}, {"{due_date}"}, {"{firm_name}"}, {"{payment_link}"}.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
