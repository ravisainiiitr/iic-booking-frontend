import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, MapPin, User, Phone, Play, Info, Loader2, Briefcase, Users, Wrench, Heart, IndianRupee } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import TicketForm from "@/components/TicketForm";

interface EquipmentCardProps {
  name: string;
  category: string;
  description: string;
  image: string;
  video?: string;
  available: boolean;
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
}

interface EquipmentDetail {
  equipment_id: number;
  code: string;
  name: string;
  description: string;
  location: string;
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
    operator_name: string;
    operator_email?: string | null;
    operator_phone?: string | null;
    operator_profile_picture?: string | null;
  }>;
  managers?: Array<{
    equipment_manager_id: number;
    manager_name: string;
    manager_email?: string | null;
    manager_phone?: string | null;
    manager_profile_picture?: string | null;
  }>;
  base_charges_by_user_type?: Array<{
    user_type: string;
    user_type_display: string;
    profile_type_display: string | null;
    primary_unit_charge: string;
  }>;
}

const EquipmentCard = ({ 
  name, 
  category, 
  description, 
  image, 
  video, 
  available, 
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
  id
}: EquipmentCardProps) => {
  const [isPlaying, setIsPlaying] = useState(true); // Start as playing if video exists
  const videoRef = useRef<HTMLVideoElement>(null);
  const [equipmentDetail, setEquipmentDetail] = useState<EquipmentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

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
    <Card className="group overflow-hidden hover:shadow-lg transition-all duration-300 border-border hover:border-primary/30">
      <div className="aspect-square overflow-hidden bg-muted relative">
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
              onClick={handlePauseVideo}
              poster={image}
            />
            {!isPlaying && (
              <button
                onClick={handlePlayVideo}
                className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors group/play z-10"
                aria-label="Play video"
              >
                <div className="bg-primary/90 hover:bg-primary rounded-full p-4 transition-all group-hover/play:scale-110">
                  <Play className="h-8 w-8 text-primary-foreground fill-current" />
                </div>
              </button>
            )}
          </>
        ) : (
          <img 
            src={image} 
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        )}
      </div>
      
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-xl line-clamp-1">{name}</CardTitle>
          <Badge variant={available ? "default" : "destructive"} className={available ? "shrink-0 bg-green-600 hover:bg-green-700" : "shrink-0"}>
            {available ? "Working" : "Not Working"}
          </Badge>
        </div>
        <CardDescription className="text-sm">{category}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {description}
        </p>
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button 
          className="flex-1 gap-2" 
          disabled={!available}
          onClick={() => {
            window.location.href = `/equipment/${id}`;
          }}
        >
          <Calendar className="h-4 w-4" />
          Book Now
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex-1">
              More Info
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">{equipmentDetail?.name || name}</DialogTitle>
              <DialogDescription>{category}</DialogDescription>
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
                        <p className="text-sm text-muted-foreground">
                          {equipmentDetail?.location || address}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Base charges by user type */}
                {equipmentDetail?.base_charges_by_user_type && equipmentDetail.base_charges_by_user_type.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <IndianRupee className="h-4 w-4" />
                      Base charges (user type wise)
                    </h4>
                    <div className="rounded-md border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50 border-b">
                            <th className="text-left font-semibold p-3">User type</th>
                            <th className="text-left font-semibold p-3">Profile</th>
                            <th className="text-right font-semibold p-3">Charge (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {equipmentDetail.base_charges_by_user_type.map((row) => (
                            <tr key={row.user_type} className="border-b last:border-0">
                              <td className="p-3 font-medium text-foreground">{row.user_type_display}</td>
                              <td className="p-3 text-muted-foreground">{row.profile_type_display || "—"}</td>
                              <td className="p-3 text-right">₹{row.primary_unit_charge}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Specifications */}
                {equipmentDetail?.specifications && equipmentDetail.specifications.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      Specifications
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {equipmentDetail.specifications.map((spec) => (
                        <div key={spec.equipment_specification_id} className="bg-muted/50 rounded-md p-3">
                          <p className="text-xs font-semibold text-foreground">{spec.spec_key}</p>
                          <p className="text-sm text-muted-foreground">{spec.spec_value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
                            <AvatarImage src={operator.operator_profile_picture || undefined} />
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
                      Managers
                    </h4>
                    <div className="space-y-3">
                      {equipmentDetail.managers.map((manager) => (
                        <div key={manager.equipment_manager_id} className="flex items-center gap-3 bg-muted/50 rounded-md p-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={manager.manager_profile_picture || undefined} />
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

                {/* Show Interest Button */}
                <div className="border-t pt-4">
                  <TicketForm
                    trigger={
                      <Button className="w-full" variant="outline">
                        <Heart className="h-4 w-4 mr-2" />
                        Show Interest
                      </Button>
                    }
                    initialValues={{
                      ticket_type_id: undefined, // Will be set to equipment-related type if available
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
      </CardFooter>
    </Card>
  );
};

export default EquipmentCard;
