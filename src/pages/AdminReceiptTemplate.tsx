import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, History, Loader2, Receipt, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

import { heroButtonClass, PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  apiClient,
  type PaymentReceipt,
  type ReceiptTemplateState,
  type ReceiptTemplateValues,
} from "@/lib/api";
import { generatePaymentReceiptPdf, hexToRgb01 } from "@/lib/paymentReceiptPdf";

type TextField = Exclude<keyof ReceiptTemplateValues, "show_gstin" | "show_logo" | "show_watermark">;
type FlagField = "show_gstin" | "show_logo" | "show_watermark";

interface FieldSpec {
  key: TextField;
  label: string;
  multiline?: boolean;
  max: number;
  hint?: string;
}

const SECTIONS: { title: string; description: string; fields: FieldSpec[] }[] = [
  {
    title: "Header",
    description: "Who issues the receipt, printed beside the institute crest.",
    fields: [
      { key: "institution_name", label: "Institution", max: 160, hint: "Printed in capitals." },
      { key: "office_name", label: "Office", max: 160 },
      { key: "address", label: "Address", max: 240 },
      { key: "institute_gstin", label: "GSTIN", max: 15, hint: "For reference only: this receipt is not a tax invoice." },
      { key: "contact_email", label: "Contact email", max: 120, hint: "Also used in the payment-questions note." },
      { key: "website", label: "Website", max: 120, hint: "Shown in the footer, e.g. equip.iitr.ac.in" },
    ],
  },
  {
    title: "Title",
    description: "The heading and the name of the portal under it.",
    fields: [
      { key: "receipt_heading", label: "Receipt heading", max: 60 },
      { key: "service_name", label: "Portal name", max: 120 },
    ],
  },
  {
    title: "Notes",
    description: "Printed under the amounts, as many as fit on the page (the first always does).",
    fields: [
      { key: "not_a_tax_invoice", label: "Tax invoice note", multiline: true, max: 400 },
      { key: "refund_note", label: "Refund note", multiline: true, max: 400 },
      { key: "extra_note", label: "Extra note (optional)", multiline: true, max: 400, hint: "Leave blank for none." },
      { key: "computer_generated", label: "Signature line", max: 160, hint: "Printed in the box at the foot, in place of a signature." },
    ],
  },
];

const FLAGS: { key: FlagField; label: string; hint: string }[] = [
  { key: "show_gstin", label: "Show GSTIN", hint: "Print the GSTIN in the header." },
  { key: "show_logo", label: "Show crest", hint: "Print the IIT Roorkee crest in the header." },
  { key: "show_watermark", label: "Crest watermark", hint: "A faint crest behind the body (needs the crest)." },
];

const TEXT_KEYS: TextField[] = [
  ...SECTIONS.flatMap((s) => s.fields.map((f) => f.key)),
  "brand_color",
  "accent_color",
];

/** WCAG contrast of white text on a colour, as the server checks it. */
function whiteContrast(hex: string): number | null {
  const c = hexToRgb01(hex);
  if (!c) return null;
  const lin = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const l = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  return 1.05 / (l + 0.05);
}

/** A sample UPI payment shown in the preview: the template is the only thing that changes. */
export function sampleReceipt(v: ReceiptTemplateValues, collectedBy: string): PaymentReceipt {
  return {
    receipt_number: "IITR/IIC/2026/00001", title: v.receipt_heading, not_a_tax_invoice: v.not_a_tax_invoice, test_mode: false,
    collected_by: collectedBy || "DEAN SRIC IIT ROORKEE", institution: v.institution_name, service_name: v.service_name,
    payer_name: "Sample Payer", purpose: "Booking balance payment", description: "Analysis charges for 'Sample XRD'",
    booking_reference: "IICXRD202600001", equipment: "Sample XRD", booking_total: "1180.00", booking_gst: "180.00",
    razorpay_payment_id: "pay_SAMPLE", razorpay_order_id: "order_SAMPLE", method: "upi", bank_reference: "531234567890",
    settlement_utr: "", payment_mode: "UPI",
    payment_details: [["UPI reference no. (RRN)", "531234567890"], ["UPI transaction ID", "AXL0123456789"],
      ["Payer UPI ID", "sa*******@okhdfcbank"], ["Payer bank / app", "HDFC Bank (Google Pay)"]],
    computer_generated: v.computer_generated, office: v.office_name,
    institute_gstin: v.show_gstin ? v.institute_gstin : "",
    payer_organisation: "Sample Institute, Department of Physics", payer_email: "payer@example.org",
    template: {
      address: v.address, contact_email: v.contact_email, website: v.website, refund_note: v.refund_note,
      extra_note: v.extra_note, brand_color: v.brand_color, accent_color: v.accent_color, show_gstin: v.show_gstin,
      show_logo: v.show_logo, show_watermark: v.show_watermark,
    },
    paid_at: new Date().toISOString(), status: "Captured", currency: "INR", base_amount: "1180.00",
    convenience_fee: "0", gst_on_fee: "0", gst_on_fee_percent: "18", total_paid: "1180.00",
  };
}

export default function AdminReceiptTemplate() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const isAdmin = String(user?.user_type ?? "").toLowerCase() === "admin";

  const [state, setState] = useState<ReceiptTemplateState | null>(null);
  const [form, setForm] = useState<ReceiptTemplateValues | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const previewSeq = useRef(0);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!isAdmin) {
      toast.error("Only the Main Administrator can change the receipt template.");
      navigate("/dashboard");
    }
  }, [authLoading, isAuthenticated, user, isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    apiClient.adminGetReceiptTemplate().then((res) => {
      if (res.error || !res.data) {
        toast.error(res.error || "Could not load the receipt template.");
        return;
      }
      setState(res.data);
      setForm(res.data.stored);
    });
  }, [isAdmin]);

  // What a receipt would print with the values on screen: blanks fall back to the defaults.
  const effective = useMemo<ReceiptTemplateValues | null>(() => {
    if (!form || !state) return null;
    const out = { ...form };
    for (const k of TEXT_KEYS) {
      if (k === "extra_note") continue;
      if (!String(form[k] ?? "").trim()) (out as Record<string, unknown>)[k] = state.defaults[k];
    }
    return out;
  }, [form, state]);

  const dirtyKeys = useMemo(() => {
    if (!form || !state) return [] as (keyof ReceiptTemplateValues)[];
    return (Object.keys(form) as (keyof ReceiptTemplateValues)[]).filter((k) => {
      const a = form[k];
      const b = state.stored[k];
      return typeof a === "string" ? a.trim() !== String(b ?? "").trim() : a !== b;
    });
  }, [form, state]);

  useEffect(() => {
    if (!effective || !state || typeof URL.createObjectURL !== "function") return;
    const seq = ++previewSeq.current;
    const timer = window.setTimeout(async () => {
      setPreviewBusy(true);
      try {
        const blob = await generatePaymentReceiptPdf(sampleReceipt(effective, state.collected_by));
        if (seq !== previewSeq.current) return;
        const url = URL.createObjectURL(blob);
        setPreviewUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return url;
        });
      } catch {
        // The form still works without a preview.
      } finally {
        if (seq === previewSeq.current) setPreviewBusy(false);
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [effective, state]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const set = <K extends keyof ReceiptTemplateValues>(key: K, value: ReceiptTemplateValues[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  const brandContrast = form?.brand_color ? whiteContrast(form.brand_color) : null;
  const brandTooLight = brandContrast !== null && brandContrast < 4.5;

  const save = async () => {
    if (!form || !dirtyKeys.length) return;
    if (brandTooLight) {
      setErrors((e) => ({ ...e, brand_color: "Too light: white text on this colour would be hard to read." }));
      return;
    }
    setSaving(true);
    const payload = Object.fromEntries(dirtyKeys.map((k) => [k, form[k]])) as Partial<ReceiptTemplateValues>;
    const res = await apiClient.adminSaveReceiptTemplate(payload);
    setSaving(false);
    if (res.error || !res.data) {
      const fieldErrors: Record<string, string> = {};
      for (const [k, v] of Object.entries(res.fieldErrors || {})) fieldErrors[k] = Array.isArray(v) ? v.join(" ") : String(v);
      setErrors(fieldErrors);
      toast.error(Object.keys(fieldErrors).length ? "Some values need correcting." : res.error || "Could not save.");
      return;
    }
    setState(res.data);
    setForm(res.data.stored);
    setErrors({});
    toast.success("Receipt template saved. Receipts opened from now on use it.");
  };

  const resetAll = () => {
    if (!state || !form) return;
    const blank = { ...form };
    for (const k of TEXT_KEYS) (blank as Record<string, unknown>)[k] = "";
    blank.show_gstin = true;
    blank.show_logo = true;
    blank.show_watermark = true;
    setForm(blank);
    setErrors({});
  };

  const goBack = () => {
    if (dirtyKeys.length && !window.confirm("You have unsaved changes. Leave without saving?")) return;
    navigate("/dashboard");
  };

  return (
    <PageShell>
      <main className="container mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-4 sm:py-5">
        <StandaloneOnly>
          <PageHero
            compact
            title="Receipt Template"
            description="The wording and look of the receipt users download after an online payment."
            icon={<Receipt className="h-5 w-5" />}
            actions={
              <Button variant="outline" size="sm" className={heroButtonClass.secondary} onClick={goBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            }
          />
        </StandaloneOnly>

        {!form || !state || !effective ? (
          <div className="flex items-center gap-2 py-16 text-muted-foreground justify-center">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading the receipt template…
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <Card>
                <CardContent className="space-y-1 pt-4 text-sm text-muted-foreground">
                  <p>
                    A blank field uses the built-in wording, shown in grey. Amounts, payer details and payment references
                    always come from the payment itself.
                  </p>
                  <p>
                    Changes apply to every receipt opened or downloaded after saving, including receipts for earlier payments.
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Collected by:</span> {state.collected_by}. This name must match
                    the Razorpay account, so it is changed with the payment settings, not here.
                  </p>
                </CardContent>
              </Card>

              {SECTIONS.map((section) => (
                <Card key={section.title}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{section.title}</CardTitle>
                    <CardDescription>{section.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {section.fields.map((f) => {
                      const id = `rt-${f.key}`;
                      const value = String(form[f.key] ?? "");
                      const common = {
                        id,
                        value,
                        maxLength: f.max,
                        placeholder: String(state.defaults[f.key] || ""),
                        "aria-invalid": Boolean(errors[f.key]) || undefined,
                        "aria-describedby": `${id}-help`,
                      };
                      return (
                        <div key={f.key} className="space-y-1">
                          <Label htmlFor={id}>{f.label}</Label>
                          {f.multiline ? (
                            <Textarea {...common} rows={2} onChange={(e) => set(f.key, e.target.value)} />
                          ) : (
                            <Input {...common} onChange={(e) => set(f.key, e.target.value)} />
                          )}
                          <p id={`${id}-help`} className={errors[f.key] ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                            {errors[f.key] || f.hint || (value ? "" : "Using the built-in wording.")}
                          </p>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Look</CardTitle>
                  <CardDescription>Colours of the bands, amount box and lines, and the crest.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(["brand_color", "accent_color"] as const).map((key) => {
                    const id = `rt-${key}`;
                    const shown = form[key] || state.defaults[key];
                    return (
                      <div key={key} className="space-y-1">
                        <Label htmlFor={id}>{key === "brand_color" ? "Main colour" : "Accent colour"}</Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            aria-label={key === "brand_color" ? "Pick the main colour" : "Pick the accent colour"}
                            className="h-9 w-12 cursor-pointer rounded border bg-background p-0.5"
                            value={hexToRgb01(shown) ? shown : "#000000"}
                            onChange={(e) => set(key, e.target.value.toUpperCase())}
                          />
                          <Input
                            id={id}
                            className="w-32 font-mono"
                            value={form[key]}
                            maxLength={7}
                            placeholder={state.defaults[key]}
                            aria-invalid={Boolean(errors[key]) || (key === "brand_color" && brandTooLight) || undefined}
                            aria-describedby={`${id}-help`}
                            onChange={(e) => set(key, e.target.value.trim())}
                          />
                        </div>
                        <p
                          id={`${id}-help`}
                          className={errors[key] || (key === "brand_color" && brandTooLight) ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
                        >
                          {errors[key] ||
                            (key === "brand_color" && brandTooLight
                              ? "Too light: white text on this colour would be hard to read. Choose a darker colour."
                              : key === "brand_color"
                                ? "Header and footer bands, amount box and total row (white text sits on it)."
                                : "Thin lines and highlights.")}
                        </p>
                      </div>
                    );
                  })}
                  {FLAGS.map((flag) => (
                    <div key={flag.key} className="flex items-start justify-between gap-4">
                      <div>
                        <Label htmlFor={`rt-${flag.key}`}>{flag.label}</Label>
                        <p className="text-xs text-muted-foreground">{flag.hint}</p>
                      </div>
                      <Switch id={`rt-${flag.key}`} checked={form[flag.key]} onCheckedChange={(v) => set(flag.key, Boolean(v))} />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border bg-background/95 p-3 shadow-sm backdrop-blur">
                <Button onClick={save} disabled={saving || !dirtyKeys.length}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save template
                </Button>
                <Button variant="outline" onClick={() => setForm(state.stored)} disabled={saving || !dirtyKeys.length}>
                  Discard changes
                </Button>
                <Button variant="ghost" onClick={resetAll} disabled={saving}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Use built-in defaults
                </Button>
                <span className="text-xs text-muted-foreground" aria-live="polite">
                  {dirtyKeys.length ? `${dirtyKeys.length} unsaved change${dirtyKeys.length === 1 ? "" : "s"}` : "All changes saved"}
                </span>
              </div>

              {state.history.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <History className="h-4 w-4" /> Changes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5 text-sm">
                      {state.history.map((h, i) => (
                        <li key={`${h.changed_at}-${i}`} className="flex flex-wrap gap-x-2">
                          <span className="text-muted-foreground">
                            {new Date(h.changed_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                          </span>
                          <span className="font-medium">{h.changed_by || "Unknown"}</span>
                          <span className="text-muted-foreground">changed {h.fields.map((f) => f.replace(/_/g, " ")).join(", ")}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="lg:sticky lg:top-4 lg:self-start">
              <Card className="overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    Preview {previewBusy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  </CardTitle>
                  <CardDescription>A sample UPI payment with the values on screen, before saving.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {previewUrl ? (
                    <iframe title="Receipt preview" src={`${previewUrl}#toolbar=0&view=FitH`} className="h-[75vh] w-full border-0 bg-muted" />
                  ) : (
                    <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Preparing preview…</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </PageShell>
  );
}
