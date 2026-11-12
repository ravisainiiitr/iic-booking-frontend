import { useEffect, useState } from "react";
import { Loader2, MessageCircle, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";

const SNOOZE_DAYS = 14;
const snoozeKey = (userId: unknown) => `iic_whatsapp_prompt_snoozed:${String(userId ?? "")}`;

function snoozed(userId: unknown): boolean {
  try {
    const at = Number(localStorage.getItem(snoozeKey(userId)) || 0);
    return at > 0 && Date.now() - at < SNOOZE_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

/** "+919876543210" -> "+91 ••••••3210". */
function masked(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return phone;
  return `${phone.startsWith("+91") ? "+91 " : "+"}••••••${digits.slice(-4)}`;
}

/**
 * One-tap WhatsApp opt-in on the dashboard (9 Nov 2026). Shown while WhatsApp sending is on, the user has not
 * answered yet and their number can receive messages (the server's ``ask``). Yes opts them in with the number on their
 * profile; No thanks records the answer (it is not asked again); Not now hides it on this browser for two weeks.
 * Consent is the click itself, as Meta's opt-in policy and the DPDP Act require; nothing is on by default.
 */
export default function WhatsAppPrompt({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const [phone, setPhone] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<"yes" | "no" | null>(null);

  useEffect(() => {
    if (!user?.id || snoozed(user.id)) return;
    let cancelled = false;
    void apiClient.getWhatsAppOptIn().then((res) => {
      if (cancelled || !res.data?.ask) return;
      setPhone(res.data.phone);
      setShow(true);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!show) return null;

  const answer = async (optedIn: boolean) => {
    setBusy(optedIn ? "yes" : "no");
    const res = await apiClient.setWhatsAppOptIn({ opted_in: optedIn, source: "prompt" });
    setBusy(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setShow(false);
    toast.success(
      optedIn
        ? "Booking updates will also come on WhatsApp. Reply STOP there, or switch it off in My Profile, at any time."
        : "No WhatsApp messages. You can switch them on in My Profile.",
    );
  };

  const later = () => {
    try {
      localStorage.setItem(snoozeKey(user?.id), String(Date.now()));
    } catch {
      /* storage blocked: it shows again next visit */
    }
    setShow(false);
  };

  return (
    <section
      role="region"
      aria-label="Booking updates on WhatsApp"
      data-testid="whatsapp-prompt"
      className={`relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-white p-4 shadow-sm sm:flex-row sm:items-center dark:border-emerald-500/30 dark:from-emerald-500/10 dark:via-transparent dark:to-transparent ${className}`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 text-white shadow-lg shadow-emerald-500/25" aria-hidden>
        <MessageCircle className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Get booking updates on WhatsApp?</p>
        <p className="text-sm text-muted-foreground">
          Confirmations, reminders, payment and result updates from IIT Roorkee Equipment Booking, on {masked(phone)}.
          Emails continue as before. Reply STOP at any time.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button size="sm" className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700" disabled={busy !== null} onClick={() => void answer(true)}>
          {busy === "yes" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Yes, send me updates
        </Button>
        <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void answer(false)}>
          {busy === "no" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          No thanks
        </Button>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" aria-label="Not now" title="Not now" disabled={busy !== null} onClick={later}>
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </section>
  );
}
