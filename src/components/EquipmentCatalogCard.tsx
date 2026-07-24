import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarClock, Play, Star, StarHalf } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import EquipmentImage from "@/components/EquipmentImage";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export type EquipmentCardAccent = {
  gradient: string;
  bar: string;
  button: string;
  border: string;
};

export type EquipmentCatalogCardItem = {
  id: string | number;
  name: string;
  category?: string;
  description?: string;
  image: string;
  video?: string | null;
  status?: string | null;
  statusDisplay?: string | null;
  internalRate?: number | string | null;
  avgRating?: number | null;
  ratingCount?: number | null;
  departmentName?: string | null;
  departmentCode?: string | null;
  hasImage?: boolean;
  make?: string | null;
  showMakeOnCard?: boolean;
  modelInformation?: string | null;
  showModelOnCard?: boolean;
};

type Props = {
  item: EquipmentCatalogCardItem;
  accent: EquipmentCardAccent;
  canChangeSlotStatus: boolean;
  /** Admin / OIC / Department Administrator: Book now opens book-for-user flow. */
  canBookForOtherUsers?: boolean;
  statusUpdatingId?: number | null;
  onRequestStatusChange?: (next: { equipmentId: number; equipmentName: string; newStatus: "ACTIVE" | "REPAIR" }) => void;
};

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-foreground" title={value}>
        {value}
      </p>
    </div>
  );
}

export default function EquipmentCatalogCard({
  item,
  accent,
  canChangeSlotStatus,
  canBookForOtherUsers = false,
  statusUpdatingId,
  onRequestStatusChange,
}: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [playingVideo, setPlayingVideo] = useState(false);
  const isAccountsInCharge =
    user?.user_type != null && String(user.user_type).toLowerCase() === "finance";
  const isLabIncharge =
    user?.user_type != null && String(user.user_type).toLowerCase() === "operator";
  const canShowBookNow = !isAccountsInCharge && !isLabIncharge;

  const status = (item.status || "").toString();
  const isOperational = status === "ACTIVE";

  const avg = item.avgRating != null ? Number(item.avgRating) : null;
  const count = Number(item.ratingCount ?? 0);
  const full = avg != null ? Math.floor(avg) : 0;
  const half = avg != null ? avg - full >= 0.5 : false;

  const rateN = item.internalRate == null ? 0 : Number(item.internalRate);
  const metaRows: Array<{ label: string; value: string }> = [];
  if (item.departmentName) metaRows.push({ label: "Department", value: item.departmentName });
  if (item.showMakeOnCard && item.make?.trim()) metaRows.push({ label: "Make", value: item.make.trim() });
  if (item.showModelOnCard && item.modelInformation?.trim()) {
    metaRows.push({ label: "Model", value: item.modelInformation.trim() });
  }

  return (
    <Card
      className={cn(
        "group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm",
        "transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-lg hover:shadow-primary/10",
        accent.border
      )}
      onClick={() => navigate(`/equipment/${item.id}`)}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-100 dark:bg-slate-900">
        {playingVideo && item.video ? (
          <video
            src={item.video}
            controls
            autoPlay
            className="h-full w-full object-cover"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            <EquipmentImage
              equipmentId={Number(item.id)}
              enabled={item.hasImage !== false && !!item.image}
              alt={item.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/55 via-slate-950/10 to-transparent" />
            {item.video ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPlayingVideo(true);
                }}
                className="absolute inset-0 z-[1] flex items-center justify-center bg-black/20 transition-colors hover:bg-black/35"
                aria-label="Play video"
              >
                <div
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-110",
                    `bg-gradient-to-br ${accent.gradient}`
                  )}
                >
                  <Play className="h-6 w-6 fill-current" />
                </div>
              </button>
            ) : null}
          </>
        )}
        {item.category ? (
          <span className="absolute left-3 top-3 z-[2] max-w-[calc(100%-1.5rem)] truncate rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold tracking-wide text-primary-foreground shadow-sm">
            {item.category}
          </span>
        ) : null}
        <span
          className={cn(
            "absolute bottom-3 right-3 z-[2] rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm",
            isOperational
              ? "bg-white/95 text-primary"
              : "bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-100"
          )}
        >
          {item.statusDisplay || (isOperational ? "Operational" : status || "Not Operational")}
        </span>
      </div>

      <CardHeader className="flex-1 space-y-3 px-5 pb-3 pt-4">
        <div className="space-y-1.5">
          <CardTitle className="line-clamp-2 min-h-[2.75rem] text-[1.05rem] font-semibold leading-snug tracking-tight text-foreground">
            {item.name}
          </CardTitle>
          {count > 0 && avg != null ? (
            <span
              className="inline-flex items-center gap-1 text-sm text-muted-foreground"
              title={`${avg.toFixed(1)}/5 (${count})`}
            >
              <span className="inline-flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => {
                  if (s <= full) return <Star key={s} className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />;
                  if (s === full + 1 && half) return <StarHalf key={s} className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />;
                  return <Star key={s} className="h-3.5 w-3.5 text-muted-foreground/40" />;
                })}
              </span>
              <span className="font-medium text-foreground">{avg.toFixed(1)}</span>
              <span className="text-muted-foreground">({count})</span>
            </span>
          ) : null}
        </div>

        {metaRows.length > 0 ? (
          <div className="grid gap-2.5 border-t border-border/60 pt-3">
            {metaRows.map((row) => (
              <MetaField key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        ) : null}

        {item.description && item.description.trim() !== item.name.trim() ? (
          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">{item.description}</p>
        ) : null}

        {rateN > 0 ? (
          <p className="text-base font-semibold tabular-nums text-primary">₹{rateN.toFixed(2)}/hour</p>
        ) : null}
      </CardHeader>

      <CardContent className="mt-auto flex-shrink-0 border-t border-border/70 bg-slate-50/90 px-5 py-4 dark:bg-slate-950/40">
        <div className="flex flex-col gap-2.5">
          {canChangeSlotStatus && onRequestStatusChange ? (
            <div
              className="flex flex-col gap-1.5 rounded-lg border border-border/80 bg-card p-2.5"
              onClick={(e) => e.stopPropagation()}
            >
              <Label className="text-xs font-medium text-muted-foreground">Status</Label>
              <Select
                value={
                  item.status === "ACTIVE"
                    ? "ACTIVE"
                    : item.status === "REPAIR" || item.status === "MAINTENANCE" || item.status === "INACTIVE"
                      ? "REPAIR"
                      : (item.status as any) || "ACTIVE"
                }
                onValueChange={(value) => {
                  const next = value as "ACTIVE" | "REPAIR";
                  onRequestStatusChange({
                    equipmentId: Number(item.id),
                    equipmentName: item.name,
                    newStatus: next,
                  });
                }}
                disabled={statusUpdatingId === Number(item.id)}
              >
                <SelectTrigger className="h-9 w-full min-w-0 bg-background">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Operational</SelectItem>
                  <SelectItem value="REPAIR">Under Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {canShowBookNow && (
            <Button
              className={cn("w-full text-white", accent.button)}
              disabled={!isOperational}
              onClick={(e) => {
                e.stopPropagation();
                if (!isOperational) {
                  toast.error("This equipment is not operational and cannot be booked.");
                  return;
                }
                if (canBookForOtherUsers || canChangeSlotStatus) {
                  navigate(`/book-equipment?equipment_id=${item.id}&mode=book`);
                  return;
                }
                navigate(`/equipment/${item.id}`);
              }}
            >
              Book now
            </Button>
          )}

          {canChangeSlotStatus && !isAccountsInCharge ? (
            <Button
              variant="outline"
              className="w-full border-primary/25 bg-card text-primary hover:bg-primary/5 hover:text-primary"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/book-equipment?equipment_id=${item.id}&mode=status`);
              }}
            >
              <CalendarClock className="mr-2 h-4 w-4" />
              Change Slot Status
            </Button>
          ) : null}

          <Button
            variant="ghost"
            className="w-full text-muted-foreground hover:bg-primary/5 hover:text-primary"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/equipment/${item.id}`);
            }}
          >
            View Details and Charges
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
