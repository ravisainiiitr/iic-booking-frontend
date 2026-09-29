import { Building2, Mail, Phone } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ContactIdCardProps {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
  officeAddress?: string | null;
  photoUrl?: string | null;
  roleLabel: string;
}

function PhoneLink({ phone }: { phone: string }) {
  return (
    <a
      href={`tel:${phone.replace(/[^\d+]/g, "")}`}
      className="flex min-w-0 items-center gap-2 text-muted-foreground transition-colors hover:text-primary"
    >
      <Phone className="h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0 tabular-nums">{phone}</span>
    </a>
  );
}

function initialsOf(value: string): string {
  return (
    value
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U"
  );
}

/** Staff contact shown as an ID card: large photo on the left, role, name and contact details on the right. */
export default function ContactIdCard({
  name,
  email,
  phone,
  alternatePhone,
  officeAddress,
  photoUrl,
  roleLabel,
}: ContactIdCardProps) {
  const displayName = name || email || "Unknown";
  const extraPhone = alternatePhone?.trim();
  const address = officeAddress?.trim();
  return (
    <div className="flex overflow-hidden rounded-2xl border bg-card shadow-sm ring-1 ring-border/40">
      <div className="flex shrink-0 items-center justify-center bg-gradient-to-b from-primary to-slate-900 p-3 sm:p-4">
        <Avatar className="h-32 w-28 rounded-xl border-2 border-white/70 shadow-lg sm:h-36 sm:w-32">
          <AvatarImage src={photoUrl || undefined} alt={displayName} className="object-cover" />
          <AvatarFallback className="rounded-xl bg-white/20 text-3xl font-bold text-white">
            {initialsOf(displayName)}
          </AvatarFallback>
        </Avatar>
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 px-4 py-4 sm:px-5">
        <span className="w-fit rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary dark:text-sky-200">
          {roleLabel}
        </span>
        <p className="text-lg font-bold leading-tight text-foreground [overflow-wrap:anywhere] sm:text-xl">
          {displayName}
        </p>
        <div className="h-px w-full bg-border" />
        <div className="space-y-1.5 text-sm sm:text-base">
          {email ? (
            <a
              href={`mailto:${email}`}
              className="flex min-w-0 items-center gap-2 text-muted-foreground transition-colors hover:text-primary"
            >
              <Mail className="h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 [overflow-wrap:anywhere]">{email}</span>
            </a>
          ) : null}
          {phone ? <PhoneLink phone={phone} /> : null}
          {extraPhone && extraPhone !== phone?.trim() ? <PhoneLink phone={extraPhone} /> : null}
          {address ? (
            <p className="flex min-w-0 items-start gap-2 text-muted-foreground">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 whitespace-pre-line [overflow-wrap:anywhere]">{address}</span>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
