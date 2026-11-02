import { useEffect, useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { apiClient, type WhatsAppOptIn } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/**
 * WhatsApp notifications (booking confirmed, cancelled, completed). Shown only while the portal's WhatsApp is on;
 * the user opts in with their number and can stop at any time here or by replying STOP.
 */
export default function WhatsAppCard() {
  const [state, setState] = useState<WhatsAppOptIn | null>(null);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = apiClient.getWhatsAppOptIn?.bind(apiClient);
    if (!load) return;
    load()
      .then((res) => {
        if (cancelled || !res?.data) return;
        setState(res.data);
        setPhone(res.data.phone || "");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state || (!state.available && !state.opted_in)) return null;

  const save = async (optedIn: boolean) => {
    setBusy(true);
    const res = await apiClient.setWhatsAppOptIn({ opted_in: optedIn, phone });
    setBusy(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not save your WhatsApp choice.");
      return;
    }
    setState(res.data);
    setPhone(res.data.phone || phone);
    toast.success(optedIn ? "WhatsApp notifications are on." : "WhatsApp notifications are off.");
  };

  return (
    <Card className="max-w-2xl mx-auto mt-6 border-border/70 shadow-[var(--shadow-card)] rounded-2xl overflow-hidden" data-testid="whatsapp-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageCircle className="h-5 w-5 text-emerald-600" aria-hidden /> WhatsApp notifications
        </CardTitle>
        <CardDescription>
          Get a WhatsApp message when a booking is confirmed, cancelled or completed. Email and in-app notifications
          stay as they are. Reply STOP on WhatsApp at any time to stop.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="whatsapp-phone">WhatsApp number</Label>
          <Input id="whatsapp-phone" inputMode="tel" autoComplete="tel" value={phone} disabled={busy}
                 onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="whatsapp-switch" className="text-sm">
            {state.opted_in ? "WhatsApp notifications are on" : "Send me WhatsApp notifications"}
          </Label>
          <div className="flex items-center gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden /> : null}
            <Switch id="whatsapp-switch" checked={state.opted_in} disabled={busy || (!state.available && !state.opted_in)}
                    onCheckedChange={(v) => void save(v)} />
          </div>
        </div>
        {state.opted_in ? (
          <Button type="button" variant="outline" size="sm" disabled={busy || !phone.trim()} onClick={() => void save(true)}>
            Update number
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
