import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import UserProfile from "@/components/UserProfile";
import { MapPin } from "lucide-react";
import { Info } from "lucide-react";
import { Calendar } from "lucide-react";
import { format, startOfWeek, addWeeks, addDays, isSameDay, parseISO, startOfDay, endOfWeek } from "date-fns";
import DashboardHeader from "@/components/DashboardHeader";
import Footer from "@/components/Footer";

interface EquipmentProfile {
  equipment_id: number;
  code: string;
  name: string;
  description: string;
  profile_type: string;
  profile_type_display: string;
  status: string;
  status_display: string;
  location: string;
  image_url: string;
  specifications: Array<{
    equipment_specification_id: number;
    spec_key: string;
    spec_value: string;
    created_at: string;
  }>;
  accessories: Array<any>;
  additional_accessories: Array<{
    equipment_additional_accessory_id: number;
    additional_accessory_name: string;
    additional_accessory_description: string;
    is_optional: boolean;
    created_at: string;
  }>;
  daily_slots?: Array<{
    id: number;
    slot_master: number;
    slot_number: number;
    slot_name: string;
    equipment_code: string;
    date: string;
    start_datetime: string;
    end_datetime: string;
    status: string;
    status_display?: string;
    booking_id?: number | null;
    booking_status?: string | null;
    booking_status_display?: string | null;
    created_at: string;
    updated_at: string;
  }>;
  operators?: Array<{
    equipment_operator_id: number;
    operator: number;
    operator_name: string;
    operator_email?: string | null;
    operator_phone?: string | null;
    operator_profile_picture?: string | null;
    created_at: string;
  }>;
  managers?: Array<{
    equipment_manager_id: number;
    manager: number;
    manager_name: string;
    manager_email?: string | null;
    manager_phone?: string | null;
    manager_profile_picture?: string | null;
    created_at: string;
  }>;
}

const EquipmentProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState<EquipmentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [userType, setUserType] = useState<number | string | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [apiSlots, setApiSlots] = useState<Array<{
    id: number;
    slot_master: number;
    slot_number: number;
    slot_name: string;
    equipment_code: string;
    date: string;
    start_datetime: string;
    end_datetime: string;
    status: string;
    status_display?: string;
    booking_id?: number | null;
    booking_status?: string | null;
    booking_status_display?: string | null;
    created_at: string;
    updated_at: string;
  }> | null>(null);
  const [weeklyHolidays, setWeeklyHolidays] = useState<Record<string, string>>({});

  const fetchSlotsForWeek = useCallback(async (isAuto = false) => {
    if (!equipment || !id) return;

    const weekStart = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
    const startDateStr = format(weekStart, "yyyy-MM-dd");
    const endDateStr = format(weekEnd, "yyyy-MM-dd");

    try {
      const slotsResponse = await apiClient.getEquipmentSlots(id, startDateStr, endDateStr);
      if (slotsResponse.data) {
        setApiSlots(slotsResponse.data.slots || []);
        setWeeklyHolidays(slotsResponse.data.holidays ?? {});
      }
    } catch (error: any) {
      console.error("Error calling slots API:", error);
      if (!isAuto) {
        toast.error("Failed to load available slots");
      }
    }
  }, [equipment, id, currentWeekStart]);

  useEffect(() => {
    if (id) {
      fetchEquipmentProfile();
    }
    fetchCurrentUser();
  }, [id]);

  const fetchCurrentUser = async () => {
    try {
      // First try to get from localStorage
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        setUserType(user.user_type);
        return;
      }

      // If not in localStorage, fetch from API
      const response = await apiClient.getCurrentUser();
      if (response.data) {
        setUserType(response.data.user_type);
        localStorage.setItem('user', JSON.stringify(response.data));
      }
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  };

  // Check if user type is allowed to book equipment
  // Allowed types: Student, Faculty, External, RND, Institute
  const canBookEquipment = (): boolean => {
    if (!userType) return false;

    const allowedStringTypes = ['student', 'faculty', 'external', 'rnd', 'industry'];
    
    // Handle string user_type (case-insensitive)
    if (typeof userType === 'string') {
      const userTypeLower = userType.toLowerCase();
      return allowedStringTypes.some(type => userTypeLower.includes(type));
    }
    
    // Handle number user_type
    // Based on common mappings: 1=student, 2=faculty, 3=external
    // Allow numbers 1-5 to cover RND and Institute if they exist
    if (typeof userType === 'number') {
      // Allow student (1), faculty (2), external (3), and potentially RND (4) and Institute (5)
      return userType >= 1 && userType <= 5;
    }
    
    return false;
  };

  const fetchEquipmentProfile = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const response = await apiClient.getEquipmentDetailById(id);

      if (response.error) {
        toast.error(response.error || "Failed to load equipment profile");
        navigate("/equipments");
        return;
      }

      if (!response.data) {
        toast.error("Equipment not found");
        navigate("/equipments");
        return;
      }

      setEquipment(response.data);
      fetchSlotsForWeek(true);
    } catch (error: any) {
      toast.error(error.message || "Failed to load equipment profile");
      navigate("/book-equipment");
    } finally {
      setLoading(false);
    }
  };

  const getTimeSlotsFromDailySlots = (): string[] => {
    const slotsToUse = apiSlots;
    
    if (!slotsToUse || slotsToUse.length === 0) {
      return [];
    }
    
    const uniqueTimes = new Set<string>();
    slotsToUse.forEach(slot => {
      try {
        const startDate = parseISO(slot.start_datetime);
        uniqueTimes.add(format(startDate, "HH:mm"));
      } catch (error) {
        console.error("Error parsing slot time:", error, slot);
      }
    });
    
    return Array.from(uniqueTimes).sort();
  };

  const getSlotData = (date: Date, time: string) => {
    if (!apiSlots || apiSlots.length === 0) return undefined;
    
    const normalizedDate = startOfDay(date);
    return apiSlots.find(slot => {
      const slotDate = startOfDay(parseISO(slot.date));
      const slotTime = format(parseISO(slot.start_datetime), "HH:mm");
      return isSameDay(slotDate, normalizedDate) && slotTime === time;
    });
  };

  // Calculate slot duration from slot data if not provided
  const getSlotDuration = (): number => {
    // If not available, calculate from the first available slot
    if (apiSlots && apiSlots.length > 0) {
      const firstSlot = apiSlots[0];
      try {
        const startTime = parseISO(firstSlot.start_datetime);
        const endTime = parseISO(firstSlot.end_datetime);
        const diffMs = endTime.getTime() - startTime.getTime();
        const diffMinutes = Math.round(diffMs / (1000 * 60));
        return diffMinutes > 0 ? diffMinutes : 0;
      } catch (error) {
        console.error("Error calculating slot duration:", error);
      }
    }
    
    return 0;
  };


  const goToPreviousWeek = () => {
    const newWeekStart = addWeeks(currentWeekStart, -1);
    setCurrentWeekStart(newWeekStart);
    fetchSlotsForWeek(true);
  };

  const goToNextWeek = () => {
    const newWeekStart = addWeeks(currentWeekStart, 1);
    setCurrentWeekStart(newWeekStart);
    fetchSlotsForWeek(true);
  };

  useEffect(() => {
    fetchSlotsForWeek(true);
  }, [fetchSlotsForWeek]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!equipment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Equipment not found</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <DashboardHeader />
      <main className="flex-1 container mx-auto px-4 py-8">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Section - Equipment Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Equipment Header */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle className="text-3xl">{equipment.name}</CardTitle>
                      <Badge
                        variant={equipment.status === "ACTIVE" ? "default" : "secondary"}
                      >
                        {equipment.status_display}
                      </Badge>
                    </div>
                    <CardDescription className="text-lg mt-2">
                      {equipment.description}
                    </CardDescription>
                    <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        <span>{equipment.location}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-mono">{equipment.code}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                  <img
                    src={equipment.image_url}
                    alt={equipment.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Slot Display - Weekly Calendar */}
            <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Available Time Slots
                  </CardTitle>
                  <CardDescription>
                    {getSlotDuration()} minutes per slot - Weekly View
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Week Navigation */}
                  <div className="flex justify-between items-center mb-6">
                    <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
                      <ChevronLeft className="h-4 w-4 mr-2" />
                      Previous Week
                    </Button>
                    <span className="font-semibold">
                      {format(startOfWeek(currentWeekStart, { weekStartsOn: 1 }), "MMM dd")} - {format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), "MMM dd, yyyy")}
                    </span>
                    <Button variant="outline" size="sm" onClick={goToNextWeek}>
                      Next Week
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>

                  <div className="overflow-x-auto">
                    <div className="min-w-[800px]">
                      {/* Header with days */}
                      <div className="grid grid-cols-8 gap-2 mb-2">
                        <div className="font-semibold text-sm p-2">Time</div>
                        {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
                          const weekStartMonday = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
                          const day = addDays(weekStartMonday, dayOffset);
                          return (
                            <div key={dayOffset} className="font-semibold text-sm p-2 text-center">
                              <div>{format(day, "EEE")}</div>
                              <div className="text-muted-foreground">{format(day, "MMM dd")}</div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Time slots */}
                      {getTimeSlotsFromDailySlots().length > 0 &&
                        getTimeSlotsFromDailySlots().map((time) => (
                          <div key={time} className="grid grid-cols-8 gap-2 mb-2">
                            <div className="text-sm p-2 font-medium flex items-center">
                              {time}
                            </div>
                            {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
                              const weekStartMonday = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
                              const day = addDays(weekStartMonday, dayOffset);
                              const slotData = getSlotData(day, time);
                              const slotExists = slotData !== undefined;
                              const dateStr = format(day, "yyyy-MM-dd");
                              const [hours, minutes] = time.split(':').map(Number);
                              const slotDateTime = new Date(day);
                              slotDateTime.setHours(hours, minutes || 0, 0, 0);
                              const isPast = slotDateTime < new Date();
                              const isAvailable = slotExists && slotData?.status === "AVAILABLE" && !isPast;
                              const bookingStatusDisplay = slotData?.booking_status_display ?? null;
                              const slotStatusLabel = slotData?.status_display || (slotData?.status ? slotData.status.charAt(0).toUpperCase() + slotData.status.slice(1).toLowerCase() : "");
                              const slotDisplayLabel = bookingStatusDisplay || slotStatusLabel;
                              const displayStatus = slotExists
                                ? (slotData?.status !== "AVAILABLE"
                                    ? (slotDisplayLabel || slotStatusLabel || "Unavailable")
                                    : isPast
                                      ? (slotDisplayLabel || slotStatusLabel || "Available")
                                      : "Available")
                                : (weeklyHolidays[dateStr] || "—");

                              return (
                                <div
                                  key={dayOffset}
                                  className={`
                                    p-3 rounded-md text-sm min-h-[48px] flex items-center justify-center
                                    ${!slotExists ? 'bg-gray-100 text-gray-400' : ''}
                                    ${slotExists && slotData?.status !== "AVAILABLE" ? 'bg-destructive/20 text-destructive' : ''}
                                    ${isPast && slotExists ? 'bg-muted text-muted-foreground' : ''}
                                    ${isAvailable ? 'bg-green-100 text-green-800' : ''}
                                  `}
                                >
                                  {displayStatus}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
          </div>

          {/* Right Section - Equipment Details */}
          <div className="lg:col-span-1 space-y-6">
            <div className="sticky top-6 space-y-6">
              {/* Book Equipment Button */}
              {canBookEquipment() && (
                <Card>
                  <CardContent className="pt-6">
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={() => {
                        navigate(`/book-equipment?equipment_id=${equipment.equipment_id}`);
                      }}
                    >
                      Book This Equipment
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Specifications */}
              {equipment.specifications && equipment.specifications.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      Specifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {equipment.specifications.map((spec) => (
                        <div key={spec.equipment_specification_id} className="flex flex-col">
                          <span className="font-semibold text-sm text-muted-foreground">
                            {spec.spec_key}
                          </span>
                          <span className="text-base">{spec.spec_value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Accessories */}
              {equipment.accessories && equipment.accessories.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Accessories</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {equipment.accessories.map((accessory: any, index: number) => (
                        <div key={index}>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{accessory.name || accessory.accessory_name || `Accessory ${index + 1}`}</span>
                          </div>
                          {accessory.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {accessory.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Additional Accessories */}
              {equipment.additional_accessories && equipment.additional_accessories.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Additional Accessories</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {equipment.additional_accessories.map((accessory) => (
                        <div key={accessory.equipment_additional_accessory_id}>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{accessory.additional_accessory_name}</span>
                            {accessory.is_optional && (
                              <Badge variant="outline" className="text-xs">Optional</Badge>
                            )}
                          </div>
                          {accessory.additional_accessory_description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {accessory.additional_accessory_description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Operators */}
              {equipment.operators && equipment.operators.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      Lab Operators
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {equipment.operators.map((operator) => (
                        <div key={operator.equipment_operator_id}>
                          <UserProfile
                            name={operator.operator_name}
                            email={operator.operator_email}
                            phone={operator.operator_phone}
                            profilePicture={operator.operator_profile_picture}
                            size="md"
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Managers */}
              {equipment.managers && equipment.managers.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      Officers in Charge
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {equipment.managers.map((manager) => (
                        <div key={manager.equipment_manager_id}>
                          <UserProfile
                            name={manager.manager_name}
                            email={manager.manager_email}
                            phone={manager.manager_phone}
                            profilePicture={manager.manager_profile_picture}
                            size="md"
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default EquipmentProfile;

