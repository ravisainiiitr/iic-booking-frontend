import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, MapPin, User, Phone, Play, Info, Loader2, Briefcase, Users, Wrench, IndianRupee, Star, StarHalf } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import EquipmentImage from "@/components/EquipmentImage";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import TicketForm from "@/components/TicketForm";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { TruncatableText } from "@/components/TruncatableText";

interface EquipmentCardProps {
  name: string;
  category: string;
  description: string;
  image: string;
  video?: string;
  available: boolean;
  status?: string;
  statusDisplay?: string;
  nextAvailable?: string;
  address: string;
  technicalPerson: string;
  contactNumber: string;
  internalRate?: number;
  externalEducationalRate?: number;
  externalGovtRate?: number;
  externalIndustryRate?: number;
  make?: string;
  model?: string;
  yearOfInstallation?: string;
  specifications?: string;
  sampleRequirements?: string;
  detailsUrl?: string;
  id?: string | number;
  /** When true, show status dropdown (admin/OIC only). */
  showStatusToggle?: boolean;
  /** Callback when status is changed. */
  onStatusChange?: (equipmentId: number, equipmentName: string, newStatus: "ACTIVE" | "MAINTENANCE" | "REPAIR") => void | Promise<void>;
  /** Equipment id that is currently updating (disables its switch). */
  statusUpdatingId?: number;
  avgRating?: number | null;
  ratingCount?: number | null;
  ratingDist?: Record<string, number> | null;
}

interface EquipmentDetail {
  equipment_id: number;
  code: string;
  name: string;
  description: string;
  location: string;
  important_instruction?: string | null;
  specifications?: Array<{
    equipment_specification_id: number;
    spec_key: string;
    spec_value: string;
  }>;
  accessories?: Array<{
    equipment_accessory_id: number;
    accessory_name: string;
    accessory_description?: string;
  }>;
  additional_accessories?: Array<{
    equipment_additional_accessory_id: number;
    additional_accessory_name: string;
    additional_accessory_description: string;
    is_optional: boolean;
  }>;
  operators?: Array<{
    equipment_operator_id: number;
    operator?: number;
    operator_name: string;
    operator_email?: string | null;
    operator_phone?: string | null;
    operator_profile_picture?: string | null;
  }>;
  managers?: Array<{
    equipment_manager_id: number;
    manager?: number;
    manager_name: string;
    manager_email?: string | null;
    manager_phone?: string | null;
    manager_profile_picture?: string | null;
  }>;
  profile_type?: string;
  base_charges_by_user_type?: Array<{
    user_type: string;
    user_type_display: string;
    profile_type_display: string | null;
    primary_unit_charge: string;
  }>;
}

const isEquipmentProxyImage = (url: string) =>
  typeof url === "string" && url.includes("/equipments/") && url.includes("/image/");

type EquipmentRatingsResponse = {
  equipment_id: number;
  avg_rating: number | null;
  rating_count: number;
  distribution: Record<string, number>;
  reviews: Array<{
    booking_id: string | number;
    rating: number;
    feedback: string;
    rated_at: string | null;
    user_id: number;
    user_name: string;
  }>;
  total_reviews: number;
  offset: number;
  limit: number;
  is_admin_panel_user: boolean;
};

const EquipmentCard = ({ 
  name, 
  category, 
  description, 
  image, 
  video, 
  available, 
  status,
  statusDisplay,
  nextAvailable, 
  address, 
  technicalPerson, 
  contactNumber,
  internalRate,
  externalEducationalRate,
  externalGovtRate,
  externalIndustryRate,
  make,
  model,
  yearOfInstallation,
  specifications,
  sampleRequirements,
  detailsUrl,
  id,
  showStatusToggle,
  onStatusChange,
  statusUpdatingId,
  avgRating,
  ratingCount,
  ratingDist,
}: EquipmentCardProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isPlaying, setIsPlaying] = useState(true); // Start as playing if video exists
  const videoRef = useRef<HTMLVideoElement>(null);
  const [equipmentDetail, setEquipmentDetail] = useState<EquipmentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [ratingData, setRatingData] = useState<EquipmentRatingsResponse | null>(null);
  const [ratingOffset, setRatingOffset] = useState(0);
  const [ratingHasMore, setRatingHasMore] = useState(false);

  const equipmentIdForImage = id != null && isEquipmentProxyImage(image) ? Number(id) : null;
  const displayImage =
    equipmentIdForImage != null
      ? user
        ? apiClient.getEquipmentImageUrl(equipmentIdForImage)
        : apiClient.getEquipmentImageProxyPath(equipmentIdForImage)
      : image;

  const ratingSummaryCount = Number(ratingCount ?? 0);
  const ratingSummaryAvg = avgRating != null ? Number(avgRating) : null;
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isAdminOrOIC = ["admin", "manager", "operator"].includes(userTypeStr);
  const ratingSummaryFullStars = ratingSummaryAvg != null ? Math.floor(ratingSummaryAvg) : 0;
  const ratingSummaryHasHalfStar = ratingSummaryAvg != null ? ratingSummaryAvg - ratingSummaryFullStars >= 0.5 : false;

  // Auto-play video when component mounts if video exists
  useEffect(() => {
    if (video && videoRef.current) {
      videoRef.current.play().catch(() => {
        // Autoplay was prevented, show play button
        setIsPlaying(false);
      });
    }
  }, [video]);

  // Fetch equipment details when dialog opens
  useEffect(() => {
    if (dialogOpen && id && !equipmentDetail) {
      fetchEquipmentDetail();
    }
  }, [dialogOpen, id]);

  const fetchEquipmentRatings = async (opts?: { reset?: boolean }) => {
    if (!id) return;
    const reset = opts?.reset === true;
    const nextOffset = reset ? 0 : ratingOffset;
    try {
      setRatingLoading(true);
      const res = await apiClient.getEquipmentRatings(Number(id), nextOffset, 10);
      if (res.error) {
        toast.error(res.error || "Failed to load ratings");
        return;
      }
      const data = res.data as EquipmentRatingsResponse;
      setRatingData((prev) => {
        if (reset || !prev) return data;
        return { ...data, reviews: [...prev.reviews, ...data.reviews] };
      });
      const total = data.total_reviews ?? 0;
      const got = data.reviews?.length ?? 0;
      const next = nextOffset + got;
      setRatingOffset(next);
      setRatingHasMore(next < total);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load ratings");
    } finally {
      setRatingLoading(false);
    }
  };

  useEffect(() => {
    if (ratingDialogOpen) {
      setRatingOffset(0);
      setRatingData(null);
      setRatingHasMore(false);
      fetchEquipmentRatings({ reset: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratingDialogOpen, id]);

  const fetchEquipmentDetail = async () => {
    if (!id) return;
    
    try {
      setLoadingDetail(true);
      const response = await apiClient.getEquipmentDetailById(id);
      
      if (response.error) {
        toast.error(response.error || "Failed to load equipment details");
        return;
      }

      if (response.data) {
        setEquipmentDetail(response.data as unknown as EquipmentDetail);
      }
    } catch (error: any) {
      console.error("Error fetching equipment detail:", error);
      toast.error(error.message || "Failed to load equipment details");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handlePlayVideo = () => {
    if (videoRef.current) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handlePauseVideo = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  return (
    <Card
      className="cursor-pointer overflow-hidden border-0 shadow-md rounded-2xl transition-all duration-200 hover:shadow-xl hover:-translate-y-1"
      onClick={() => {
        if (id == null) return;
        navigate(`/equipment/${id}`);
      }}
    >
      <div className="relative aspect-video overflow-hidden bg-muted">
        {video ? (
          <>
            <video 
              ref={videoRef}
              src={video}
              className="w-full h-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              onEnded={() => setIsPlaying(true)}
              onClick={(e) => {
                e.stopPropagation();
                handlePauseVideo();
              }}
              poster={displayImage}
            />
            {!isPlaying && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayVideo();
                }}
                className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors group/play z-10"
                aria-label="Play video"
              >
                <div className="bg-primary/90 hover:bg-primary rounded-full p-4 transition-all group-hover/play:scale-110">
                  <Play className="h-8 w-8 text-primary-foreground fill-current" />
                </div>
              </button>
            )}
          </>
        ) : equipmentIdForImage ? (
          <EquipmentImage
            equipmentId={equipmentIdForImage}
            enabled
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            fallback={image || "/placeholder.svg"}
          />
        ) : (
          <img 
            src={image} 
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        )}
        {category ? (
          <span className="absolute top-3 left-3 rounded-full bg-white/90 dark:bg-black/50 px-2.5 py-1 text-xs font-medium text-foreground backdrop-blur-sm">
            {category}
          </span>
        ) : null}
      </div>
      
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-lg line-clamp-2">{name}</CardTitle>
            {ratingSummaryCount > 0 && (
              <div className="mt-1">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRatingDialogOpen(true);
                  }}
                >
                  <span className="inline-flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => {
                      if (ratingSummaryAvg == null) {
                        return <Star key={s} className="h-4 w-4 text-muted-foreground" />;
                      }
                      if (s <= ratingSummaryFullStars) {
                        return <Star key={s} className="h-4 w-4 fill-amber-400 text-amber-500" />;
                      }
                      if (s === ratingSummaryFullStars + 1 && ratingSummaryHasHalfStar) {
                        return <StarHalf key={s} className="h-4 w-4 fill-amber-400 text-amber-500" />;
                      }
                      return <Star key={s} className="h-4 w-4 text-muted-foreground" />;
                    })}
                  </span>
                  <span className="font-medium">{ratingSummaryAvg != null ? ratingSummaryAvg.toFixed(1) : "—"}</span>
                  <span className="text-muted-foreground">({ratingSummaryCount})</span>
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {showStatusToggle && onStatusChange && id != null ? (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                  Status
                </Label>
                <Select
                  value={(status as any) || "ACTIVE"}
                  onValueChange={(value) => onStatusChange(Number(id), name, value as any)}
                  disabled={statusUpdatingId === Number(id)}
                >
                  <SelectTrigger className="h-8 w-[190px]">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Operational</SelectItem>
                    <SelectItem value="MAINTENANCE">Maintenance Scheduled</SelectItem>
                    <SelectItem value="REPAIR">Under Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              (() => {
                const displayStatus = statusDisplay || status || "";
                const isOperational = status === "ACTIVE";
                const variant = isOperational ? "default" : "secondary";
                const badgeClass = isOperational
                  ? "shrink-0 bg-green-600 hover:bg-green-700"
                  : "shrink-0";

                return (
                  <Badge variant={variant} className={badgeClass}>
                    {displayStatus || (isOperational ? "Operational" : "Not Operational")}
                  </Badge>
                );
              })()
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <CardDescription className="text-sm line-clamp-2">{description}</CardDescription>
        {typeof internalRate === "number" && internalRate > 0 ? (
          <div className="text-base font-semibold text-foreground">₹{Number(internalRate).toFixed(2)}/hour</div>
        ) : null}
        <div className="pt-1">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              setDialogOpen(true);
            }}
          >
            More info
          </Button>
        </div>
      </CardContent>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle className="text-2xl">{equipmentDetail?.name || name}</DialogTitle>
              {category ? <DialogDescription>{category}</DialogDescription> : null}
            </DialogHeader>
            {loadingDetail ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-6 py-4">
                {/* Description */}
                {(equipmentDetail?.description || description) && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2">Description</h4>
                    <p className="text-sm text-muted-foreground">
                      {equipmentDetail?.description || description}
                    </p>
                  </div>
                )}

                {/* Location */}
                {(equipmentDetail?.location || address) && (
                  <div className="border-t pt-4">
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground mb-1">Location</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-line">
                          {equipmentDetail?.location || address}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Charges by user type (exclude student and faculty) */}
                {(() => {
                  const chargeRows = equipmentDetail?.base_charges_by_user_type?.filter(
                    (row) =>
                      String(row.user_type || "").toLowerCase() !== "student" &&
                      String(row.user_type || "").toLowerCase() !== "faculty"
                  ) ?? [];
                  const profileType = (equipmentDetail?.profile_type || "").toUpperCase();
                  const chargeBasis =
                    profileType === "HOUR"
                      ? "Charges are per hour."
                      : profileType === "SAMPLE" || profileType === "SAMPLE_ELEMENT" || profileType === "MULTI_PARAM"
                        ? "Charges are per sample."
                        : "Charges are as per the equipment profile.";
                  return chargeRows.length > 0 ? (
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <IndianRupee className="h-4 w-4" />
                        Charges
                      </h4>
                      <div className="rounded-md border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/50 border-b">
                              <th className="text-left font-semibold p-3">User type</th>
                              <th className="text-right font-semibold p-3">Charge (₹)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {chargeRows.map((row) => (
                              <tr key={row.user_type} className="border-b last:border-0">
                                <td className="p-3 font-medium text-foreground">{row.user_type_display}</td>
                                <td className="p-3 text-right">₹{row.primary_unit_charge}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">{chargeBasis}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Charges are exclusive of GST @ 18%.</p>
                    </div>
                  ) : null;
                })()}

                {/* Important Instruction */}
                {equipmentDetail?.important_instruction && (
                  <div className="rounded-lg border-2 border-amber-500/80 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-500/60 p-4">
                    <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      Important Instruction
                    </h4>
                    <TruncatableText
                      text={equipmentDetail.important_instruction}
                      className="text-sm text-amber-900/90 dark:text-amber-100/90"
                    />
                  </div>
                )}

                {/* Equipment specifications: one section per spec_key */}
                {equipmentDetail?.specifications && equipmentDetail.specifications.length > 0 &&
                  equipmentDetail.specifications.map((spec) => (
                    <div key={spec.equipment_specification_id} className="border-t pt-4">
                      <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        {spec.spec_key}
                      </h4>
                      <div className="bg-muted/50 rounded-md p-3">
                        <TruncatableText
                          text={spec.spec_value}
                          className="text-sm text-muted-foreground"
                        />
                      </div>
                    </div>
                  ))}

                {/* Accessories */}
                {equipmentDetail?.accessories && equipmentDetail.accessories.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Wrench className="h-4 w-4" />
                      Accessories
                    </h4>
                    <div className="space-y-2">
                      {equipmentDetail.accessories.map((accessory: any) => (
                        <div key={accessory.equipment_accessory_id || accessory.accessory_name} className="bg-muted/50 rounded-md p-3">
                          <p className="text-sm font-semibold text-foreground">
                            {accessory.accessory_name}
                          </p>
                          {accessory.accessory_description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {accessory.accessory_description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional Accessories */}
                {equipmentDetail?.additional_accessories && equipmentDetail.additional_accessories.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      Additional Accessories
                    </h4>
                    <div className="space-y-2">
                      {equipmentDetail.additional_accessories.map((accessory) => (
                        <div key={accessory.equipment_additional_accessory_id} className="bg-muted/50 rounded-md p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-foreground">
                                {accessory.additional_accessory_name}
                              </p>
                              {accessory.additional_accessory_description && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {accessory.additional_accessory_description}
                                </p>
                              )}
                            </div>
                            {accessory.is_optional && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                Optional
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Operators */}
                {equipmentDetail?.operators && equipmentDetail.operators.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Operators
                    </h4>
                    <div className="space-y-3">
                      {equipmentDetail.operators.map((operator) => (
                        <div key={operator.equipment_operator_id} className="flex items-center gap-3 bg-muted/50 rounded-md p-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={operator.operator_profile_picture && operator.operator != null ? apiClient.getProfilePictureUrl(operator.operator) : undefined} />
                            <AvatarFallback>
                              {operator.operator_name?.charAt(0).toUpperCase() || "O"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-foreground">{operator.operator_name}</p>
                            {operator.operator_email && (
                              <p className="text-xs text-muted-foreground">{operator.operator_email}</p>
                            )}
                            {operator.operator_phone && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Phone className="h-3 w-3" />
                                {operator.operator_phone}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Managers */}
                {equipmentDetail?.managers && equipmentDetail.managers.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Officer In-charge
                    </h4>
                    <div className="space-y-3">
                      {equipmentDetail.managers.map((manager) => (
                        <div key={manager.equipment_manager_id} className="flex items-center gap-3 bg-muted/50 rounded-md p-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={manager.manager_profile_picture && manager.manager != null ? apiClient.getProfilePictureUrl(manager.manager) : undefined} />
                            <AvatarFallback>
                              {manager.manager_name?.charAt(0).toUpperCase() || "M"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-foreground">{manager.manager_name}</p>
                            {manager.manager_email && (
                              <p className="text-xs text-muted-foreground">{manager.manager_email}</p>
                            )}
                            {manager.manager_phone && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Phone className="h-3 w-3" />
                                {manager.manager_phone}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Raise Support Ticket Button */}
                <div className="border-t pt-4">
                  <TicketForm
                    trigger={
                      <Button className="w-full" variant="outline">
                        Raise support ticket
                      </Button>
                    }
                    initialValues={{
                      ticket_type: undefined, // Will be auto-selected to equipment type
                      subject: `Interest in ${equipmentDetail?.name || name}`,
                      description: `I am interested in using ${equipmentDetail?.name || name}${equipmentDetail?.code ? ` (Code: ${equipmentDetail.code})` : ''}.\n\nEquipment Details:\n- Name: ${equipmentDetail?.name || name}\n- Category: ${category}\n${equipmentDetail?.location ? `- Location: ${equipmentDetail.location}\n` : ''}${equipmentDetail?.description ? `- Description: ${equipmentDetail.description}\n` : ''}\n\nPlease let me know about availability and booking procedures.`,
                      related_equipment_id: equipmentDetail?.equipment_id || (id ? Number(id) : undefined),
                    }}
                    onSuccess={() => {
                      setDialogOpen(false);
                    }}
                  />
                </div>
              </div>
            )}
        </DialogContent>
      </Dialog>

      <Dialog open={ratingDialogOpen} onOpenChange={setRatingDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle className="text-xl">Ratings & reviews</DialogTitle>
              <DialogDescription>{name}</DialogDescription>
            </DialogHeader>

            {ratingLoading && !ratingData ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-5 py-2">
                <div className="flex items-center justify-between gap-4 border rounded-md p-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-0.5">
                      {(() => {
                        const avg = ratingData?.avg_rating != null ? Number(ratingData.avg_rating) : null;
                        const full = avg != null ? Math.floor(avg) : 0;
                        const half = avg != null ? avg - full >= 0.5 : false;
                        return [1, 2, 3, 4, 5].map((s) => {
                          if (avg == null) return <Star key={s} className="h-5 w-5 text-muted-foreground" />;
                          if (s <= full) return <Star key={s} className="h-5 w-5 fill-amber-400 text-amber-500" />;
                          if (s === full + 1 && half) return <StarHalf key={s} className="h-5 w-5 fill-amber-400 text-amber-500" />;
                          return <Star key={s} className="h-5 w-5 text-muted-foreground" />;
                        });
                      })()}
                    </span>
                    <div className="leading-tight">
                      <div className="text-lg font-semibold">
                        {ratingData?.avg_rating != null ? Number(ratingData.avg_rating).toFixed(1) : "—"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {ratingData?.rating_count ?? 0} rating(s)
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-semibold">Distribution</div>
                  {[5, 4, 3, 2, 1].map((s) => {
                    const dist = ratingData?.distribution || {};
                    const count = Number(dist[String(s)] ?? 0);
                    const total = Number(ratingData?.rating_count ?? 0) || 1;
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={s} className="flex items-center gap-3">
                        <div className="w-14 text-sm text-muted-foreground">{s}★</div>
                        <div className="flex-1 h-2 rounded bg-muted overflow-hidden">
                          <div className="h-2 bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="w-10 text-right text-sm text-muted-foreground">{count}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-semibold">Reviews</div>
                  {(ratingData?.reviews || []).length === 0 ? (
                    <div className="text-sm text-muted-foreground">No reviews yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {(ratingData?.reviews || []).map((r) => (
                        <div key={r.booking_id} className="border rounded-md p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star
                                    key={s}
                                    className={`h-4 w-4 ${
                                      s <= r.rating ? "fill-amber-400 text-amber-500" : "text-muted-foreground"
                                    }`}
                                  />
                                ))}
                              </div>
                              <div className="text-sm font-medium mt-1">{r.user_name}</div>
                              {r.rated_at && (
                                <div className="text-xs text-muted-foreground">{new Date(r.rated_at).toLocaleString()}</div>
                              )}
                            </div>

                            {isAdminOrOIC && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={async () => {
                                  const ok = window.confirm("Remove this rating? This will hide it from users and exclude it from averages.");
                                  if (!ok) return;
                                  const reason = window.prompt("Reason (optional):") || "";
                                  const res = await apiClient.removeBookingRating(r.booking_id, reason);
                                  if (res.error) {
                                    toast.error(res.error || "Failed to remove rating");
                                    return;
                                  }
                                  toast.success("Rating removed.");
                                  setRatingOffset(0);
                                  setRatingData(null);
                                  setRatingHasMore(false);
                                  await fetchEquipmentRatings({ reset: true });
                                }}
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                          {r.feedback ? (
                            <div className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{r.feedback}</div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {ratingHasMore && (
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={ratingLoading}
                      onClick={() => fetchEquipmentRatings({ reset: false })}
                    >
                      {ratingLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        "Load more"
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default EquipmentCard;
