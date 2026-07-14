import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarClock, Play, Star, StarHalf } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import EquipmentDepartmentLabel from "@/components/EquipmentDepartmentLabel";
import EquipmentImage from "@/components/EquipmentImage";

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
  statusUpdatingId?: number | null;
  onRequestStatusChange?: (next: { equipmentId: number; equipmentName: string; newStatus: "ACTIVE" | "MAINTENANCE" | "REPAIR" }) => void;
};

export default function EquipmentCatalogCard({
  item,
  accent,
  canChangeSlotStatus,
  statusUpdatingId,
  onRequestStatusChange,
}: Props) {
  const navigate = useNavigate();
  const [playingVideo, setPlayingVideo] = useState(false);

  const status = (item.status || "").toString();
  const isOperational = status === "ACTIVE";

  const avg = item.avgRating != null ? Number(item.avgRating) : null;
  const count = Number(item.ratingCount ?? 0);
  const full = avg != null ? Math.floor(avg) : 0;
  const half = avg != null ? avg - full >= 0.5 : false;

  return (
    <Card
      className={`relative flex h-full cursor-pointer flex-col overflow-hidden border-0 shadow-md rounded-2xl transition-all duration-200 hover:shadow-xl hover:-translate-y-1 ${accent.border}`}
      onClick={() => navigate(`/equipment/${item.id}`)}
    >
      <div className={`absolute inset-x-0 top-0 z-10 h-1 bg-gradient-to-r ${accent.bar}`} />
      <div className="relative aspect-video overflow-hidden bg-muted">
        {playingVideo && item.video ? (
          <video
            src={item.video}
            controls
            autoPlay
            className="w-full h-full object-cover"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            <EquipmentImage
              equipmentId={Number(item.id)}
              enabled={item.hasImage !== false && !!item.image}
              alt={item.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity" />
            {item.video ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPlayingVideo(true);
                }}
                className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors"
                aria-label="Play video"
              >
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${accent.gradient} text-white shadow-lg hover:scale-110 transition-transform`}
                >
                  <Play className="h-7 w-7 fill-current" />
                </div>
              </button>
            ) : null}
          </>
        )}
        <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${accent.bar}`} />
        {item.category ? (
          <span className="absolute top-3 left-3 max-w-[calc(100%-1.5rem)] truncate rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium tracking-wide text-foreground/90 backdrop-blur-sm dark:bg-black/55 dark:text-foreground">
            {item.category}
          </span>
        ) : null}
      </div>

      <CardHeader className="flex-1 pb-2">
        <CardTitle className="text-lg leading-snug line-clamp-2 min-h-[3.25rem]">{item.name}</CardTitle>
        {(item.departmentName) ? (
          <EquipmentDepartmentLabel
            name={item.departmentName}
            size="compact"
            accentBarClassName={accent.bar}
            className="mt-2"
          />
        ) : null}
        {item.showMakeOnCard && item.make?.trim() ? (
          <div className="mt-2 min-w-0 pl-[11px]">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/75">
              Make
            </p>
            <p className="mt-0.5 truncate text-sm font-medium leading-snug text-foreground/90">
              {item.make.trim()}
            </p>
          </div>
        ) : null}
        {item.showModelOnCard && item.modelInformation?.trim() ? (
          <div className="mt-2 min-w-0 pl-[11px]">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/75">
              Model
            </p>
            <p className="mt-0.5 truncate text-sm font-medium leading-snug text-foreground/90">
              {item.modelInformation.trim()}
            </p>
          </div>
        ) : null}
        <div className="mt-1.5 min-h-[1.25rem]">
          {count > 0 && avg != null ? (
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground" title={`${avg.toFixed(1)}/5 (${count})`}>
              <span className="inline-flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => {
                  if (s <= full) return <Star key={s} className="h-4 w-4 fill-amber-400 text-amber-500" />;
                  if (s === full + 1 && half) return <StarHalf key={s} className="h-4 w-4 fill-amber-400 text-amber-500" />;
                  return <Star key={s} className="h-4 w-4 text-muted-foreground" />;
                })}
              </span>
              <span className="font-medium text-foreground">{avg.toFixed(1)}</span>
              <span className="text-muted-foreground">({count})</span>
            </span>
          ) : null}
        </div>
        {item.description && item.description.trim() !== item.name.trim() ? (
          <CardDescription className="text-sm line-clamp-2 min-h-[2.5rem] leading-snug text-muted-foreground">
            {item.description}
          </CardDescription>
        ) : null}
        <div className={`h-1 w-12 rounded-full bg-gradient-to-r ${accent.bar} mt-3`} />
        {(() => {
          const r = item.internalRate;
          const n = r == null ? 0 : Number(r);
          return n > 0 ? (
            <div className="text-base font-semibold text-foreground mt-2">₹{n.toFixed(2)}/hour</div>
          ) : null;
        })()}
      </CardHeader>

      <CardContent className="mt-auto flex-shrink-0 pt-0">
        <div className="flex flex-col gap-3">
          {canChangeSlotStatus && onRequestStatusChange ? (
            <div
              className="flex flex-col gap-2 rounded-lg border border-border bg-card/30 p-3"
              onClick={(e) => e.stopPropagation()}
            >
              <Label className="text-sm font-medium leading-none">Status</Label>
              <div className="w-full min-w-0">
                <Select
                  value={(item.status as any) || "ACTIVE"}
                  onValueChange={(value) => {
                    const next = value as "ACTIVE" | "MAINTENANCE" | "REPAIR";
                    onRequestStatusChange({
                      equipmentId: Number(item.id),
                      equipmentName: item.name,
                      newStatus: next,
                    });
                  }}
                  disabled={statusUpdatingId === Number(item.id)}
                >
                  <SelectTrigger className="h-9 w-full min-w-0">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Operational</SelectItem>
                    <SelectItem value="MAINTENANCE">Maintenance Scheduled</SelectItem>
                    <SelectItem value="REPAIR">Under Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/30 p-3">
            <span className="shrink-0 text-sm font-medium text-muted-foreground">Current status</span>
            <span
              className={`min-w-0 text-right text-sm font-semibold ${isOperational ? "text-green-600" : "text-amber-600"}`}
            >
              {item.statusDisplay || (isOperational ? "Operational" : status || "Not Operational")}
            </span>
          </div>

          <Button
            className={`w-full ${accent.button} text-white`}
            disabled={!isOperational}
            onClick={(e) => {
              e.stopPropagation();
              if (!isOperational) {
                toast.error("This equipment is not operational and cannot be booked.");
                return;
              }
              navigate(`/equipment/${item.id}`);
            }}
          >
            Book now
          </Button>

          {canChangeSlotStatus ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/book-equipment?equipment_id=${item.id}&mode=status`);
              }}
            >
              <CalendarClock className="h-4 w-4 mr-2" />
              Change Slot Status
            </Button>
          ) : null}

          <Button
            variant="outline"
            className="w-full border-[#E4E6F0] bg-[#F7F8FC] text-foreground hover:bg-[#EEF0F8]"
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

