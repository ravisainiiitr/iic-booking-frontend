import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, MapPin, Info, Settings, Calendar, Users, UserCog } from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/Header";
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
  s3_path: string;
  image_url: string;
  slot_duration_minutes: number;
  slots_per_day: number;
  internal_weekly_quota: number;
  external_weekly_quota: number;
  internal_monthly_quota: number;
  external_monthly_quota: number;
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
  input_fields: Array<{
    field_key: string;
    field_label: string;
    field_type: string;
    is_required: boolean;
    default_value: string;
    options: Array<any>;
    help_text: string;
    created_at: string;
    updated_at: string;
  }>;
  charge_profiles: Array<{
    equipment: number;
    user_type: string;
    is_active: boolean;
    primary_unit_charge: string;
    secondary_unit_charge: string;
    breakpoint: string;
    time_formula: string | null;
    created_at: string;
    updated_at: string;
  }>;
  slot_options: Array<any>;
  slot_masters: Array<{
    slot_number: number;
    slot_name: string;
    open_time: string;
    close_time: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }>;
  operators?: Array<{
    equipment_operator_id: number;
    operator: number;
    operator_name: string;
    created_at: string;
  }>;
  managers?: Array<{
    equipment_manager_id: number;
    manager: number;
    manager_name: string;
    created_at: string;
  }>;
  created_at: string;
  updated_at: string;
}

const EquipmentProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState<EquipmentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [fieldValues, setFieldValues] = useState<Record<string, string | boolean>>({});
  const [selectedSlots, setSelectedSlots] = useState<number[]>([]);
  const [user, setUser] = useState<any | null>(null);
  const [chargeCalculated, setChargeCalculated] = useState(false);
  const [calculatedTime, setCalculatedTime] = useState<number>(0);
  const [calculatedCharge, setCalculatedCharge] = useState<number>(0);
  const [chargeBreakdown, setChargeBreakdown] = useState<Array<{ description: string; amount: number }>>([]);
  const [calculating, setCalculating] = useState(false);
  const prevFieldValuesRef = useRef<Record<string, string | boolean>>({});
  const calculationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleCalculateChargeRef = useRef<((isAuto?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    if (id) {
      fetchEquipmentProfile();
      fetchCurrentUser();
    }
  }, [id]);

  const fetchEquipmentProfile = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const response = await apiClient.getEquipmentDetailById(id);

      if (response.error) {
        toast.error(response.error || "Failed to load equipment profile");
        navigate("/book-equipment");
        return;
      }

      if (!response.data) {
        toast.error("Equipment not found");
        navigate("/book-equipment");
        return;
      }

      setEquipment(response.data);
      
      // Initialize field values with default values
      const initialValues: Record<string, string | boolean> = {};
      if (response.data.input_fields) {
        response.data.input_fields.forEach((field) => {
          if (field.field_type === "TOGGLE") {
            initialValues[field.field_key] = field.default_value === "True" || field.default_value === "true";
          } else if (field.field_type === "SELECT" && field.options && field.options.length > 0) {
            initialValues[field.field_key] = field.default_value || field.options[0].value || "";
          } else if (field.field_type === "RADIO" && field.options && field.options.length > 0) {
            // For RADIO, use default_value if available, otherwise use first option
            const firstOption = typeof field.options[0] === "string" ? field.options[0] : (field.options[0].value || field.options[0]);
            initialValues[field.field_key] = field.default_value || String(firstOption);
          } else {
            initialValues[field.field_key] = field.default_value || "";
          }
        });
      }
      setFieldValues(initialValues);
    } catch (error: any) {
      toast.error(error.message || "Failed to load equipment profile");
      navigate("/book-equipment");
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const token = apiClient.getToken();
      if (!token) return;

      const userResponse = await apiClient.getCurrentUser();
      if (userResponse.data) {
        setUser(userResponse.data);
      }
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  };

  const formatTime = (time: string) => {
    // Convert "09:00:00" to "09:00 AM"
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const toggleSlot = (slotNumber: number) => {
    setSelectedSlots((prev) => {
      if (prev.includes(slotNumber)) {
        return prev.filter((num) => num !== slotNumber);
      } else {
        return [...prev, slotNumber];
      }
    });
    // Reset charge calculation when slots change
    setChargeCalculated(false);
  };

  const handleCalculateCharge = useCallback(async (isAuto = false) => {
    if (!equipment || !id) {
      if (!isAuto) {
        toast.error("Equipment information not available");
      }
      return;
    }

    // Validate required fields
    const requiredFields = equipment.input_fields?.filter((field) => field.is_required) || [];
    const missingFields = requiredFields.filter((field) => {
      const value = fieldValues[field.field_key];
      // For TOGGLE fields, false is a valid value
      if (field.field_type === "TOGGLE") {
        return value === undefined || value === null;
      }
      // For other fields, check if value is missing or empty
      return !value || value === "";
    });

    if (missingFields.length > 0) {
      if (!isAuto) {
        toast.error(`Please fill in required fields: ${missingFields.map((f) => f.field_label).join(", ")}`);
      }
      return;
    }

    try {
      setCalculating(true);
      const response = await apiClient.calculateEquipmentCharge(id, fieldValues);

      if (response.error) {
        if (!isAuto) {
          toast.error(response.error || "Failed to calculate charge");
        }
        return;
      }

      if (response.data) {
        setCalculatedTime(response.data.total_time_minutes);
        setCalculatedCharge(parseFloat(response.data.total_charge));
        setChargeBreakdown(response.data.charge_breakdown || []);
        setChargeCalculated(true);
        if (!isAuto) {
          toast.success("Charge calculated successfully");
        }
      }
    } catch (error: any) {
      if (!isAuto) {
        toast.error(error.message || "Failed to calculate charge");
      }
    } finally {
      setCalculating(false);
    }
  }, [equipment, id, fieldValues]);

  // Update the ref whenever the function changes
  useEffect(() => {
    handleCalculateChargeRef.current = handleCalculateCharge;
  }, [handleCalculateCharge]);

  // Auto-calculate charge when all required fields are filled
  useEffect(() => {
    if (!equipment || !id || calculating) {
      return;
    }

    // Check if fieldValues actually changed by comparing with previous values
    const fieldValuesChanged = JSON.stringify(fieldValues) !== JSON.stringify(prevFieldValuesRef.current);
    
    if (!fieldValuesChanged) {
      return; // No change, don't recalculate
    }

    // Update the ref with current values
    prevFieldValuesRef.current = { ...fieldValues };

    // Check if all required fields are filled
    const requiredFields = equipment.input_fields?.filter((field) => field.is_required) || [];
    const allRequiredFilled = requiredFields.every((field) => {
      const value = fieldValues[field.field_key];
      // For TOGGLE fields, false is a valid value
      if (field.field_type === "TOGGLE") {
        return value !== undefined && value !== null;
      }
      // For other fields, check if value exists and is not empty string
      return value !== undefined && value !== null && value !== "";
    });

    // Clear any existing timeout
    if (calculationTimeoutRef.current) {
      clearTimeout(calculationTimeoutRef.current);
    }

    if (allRequiredFilled && requiredFields.length > 0) {
      // Use a delay to debounce rapid changes
      calculationTimeoutRef.current = setTimeout(() => {
        if (handleCalculateChargeRef.current) {
          handleCalculateChargeRef.current(true); // Pass true to indicate auto-calculation
        }
      }, 500); // Increased debounce time to 500ms
    } else {
      // Reset calculation if required fields are not filled
      setChargeCalculated(false);
    }

    // Cleanup function
    return () => {
      if (calculationTimeoutRef.current) {
        clearTimeout(calculationTimeoutRef.current);
      }
    };
  }, [fieldValues, equipment, id, calculating]);

  const calculateTotalTime = (): number => {
    if (!equipment || selectedSlots.length === 0) return 0;
    return selectedSlots.length * equipment.slot_duration_minutes;
  };

  const calculateTotalCharge = (): number => {
    if (!equipment || selectedSlots.length === 0) return 0;

    // Get user type string from user_type number
    // Assuming: 1 = student, 2 = faculty, 3 = external (adjust based on your mapping)
    const getUserTypeString = (userTypeNum: number): string => {
      const mapping: Record<number, string> = {
        1: "student",
        2: "faculty",
        3: "external",
      };
      return mapping[userTypeNum] || "student";
    };

    const userTypeString = user?.user_type ? getUserTypeString(user.user_type) : "student";

    // Find matching charge profile
    const chargeProfile = equipment.charge_profiles?.find(
      (profile) => profile.user_type === userTypeString && profile.is_active
    );

    if (!chargeProfile) {
      // Fallback to first active profile
      const fallbackProfile = equipment.charge_profiles?.find((profile) => profile.is_active);
      if (!fallbackProfile) return 0;

      const totalSlots = selectedSlots.length;
      const primaryCharge = parseFloat(fallbackProfile.primary_unit_charge || "0");
      return totalSlots * primaryCharge;
    }

    // Calculate charge based on profile
    const totalSlots = selectedSlots.length;
    const primaryCharge = parseFloat(chargeProfile.primary_unit_charge || "0");
    
    // If there's a breakpoint and secondary charge, use tiered pricing
    if (chargeProfile.breakpoint && chargeProfile.secondary_unit_charge) {
      const breakpoint = parseFloat(chargeProfile.breakpoint);
      if (totalSlots > breakpoint) {
        const primarySlots = breakpoint;
        const secondarySlots = totalSlots - breakpoint;
        const secondaryCharge = parseFloat(chargeProfile.secondary_unit_charge || "0");
        return primarySlots * primaryCharge + secondarySlots * secondaryCharge;
      }
    }

    return totalSlots * primaryCharge;
  };

  const formatTimeDisplay = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} minutes`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) {
      return `${hours} hour${hours > 1 ? "s" : ""}`;
    }
    return `${hours} hour${hours > 1 ? "s" : ""} ${mins} minute${mins > 1 ? "s" : ""}`;
  };

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
          <Button onClick={() => navigate("/book-equipment")}>Back to Equipment List</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate("/book-equipment")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Equipment List
          </Button>
        </div>

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
                        <Info className="h-4 w-4" />
                        <span>{equipment.profile_type_display}</span>
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

            {/* Specifications */}
            {equipment.specifications && equipment.specifications.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
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

            {/* Operators and Managers */}
            {(equipment.operators && equipment.operators.length > 0) || 
             (equipment.managers && equipment.managers.length > 0) ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Operators & Managers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Operators */}
                    {equipment.operators && equipment.operators.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <UserCog className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold text-sm">Operators</span>
                        </div>
                        <div className="space-y-2">
                          {equipment.operators.map((operator) => (
                            <div key={operator.equipment_operator_id} className="flex items-center gap-2">
                              <Badge variant="secondary">{operator.operator_name}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Managers */}
                    {equipment.managers && equipment.managers.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <UserCog className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold text-sm">Managers</span>
                        </div>
                        <div className="space-y-2">
                          {equipment.managers.map((manager) => (
                            <div key={manager.equipment_manager_id} className="flex items-center gap-2">
                              <Badge variant="secondary">{manager.manager_name}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {/* Input Fields */}
            {equipment.input_fields && equipment.input_fields.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Booking Fields</CardTitle>
                  <CardDescription>
                    Fields required when booking this equipment
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {equipment.input_fields.map((field) => (
                      <div key={field.field_key} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={field.field_key} className="font-semibold">
                            {field.field_label}
                          </Label>
                          {field.is_required && (
                            <Badge variant="destructive" className="text-xs">Required</Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {field.field_type}
                          </Badge>
                        </div>
                        
                        {field.field_type === "TOGGLE" && (
                          <div className="flex items-center space-x-2">
                            <Switch
                              id={field.field_key}
                              checked={fieldValues[field.field_key] as boolean || false}
                            onCheckedChange={(checked) => {
                              setFieldValues((prev) => ({
                                ...prev,
                                [field.field_key]: checked,
                              }));
                            }}
                            />
                            <Label htmlFor={field.field_key} className="text-sm text-muted-foreground">
                              {fieldValues[field.field_key] ? "Yes" : "No"}
                            </Label>
                          </div>
                        )}
                        
                        {field.field_type === "NUMERIC" && (
                          <Input
                            id={field.field_key}
                            type="number"
                            value={fieldValues[field.field_key] as string || ""}
                            onChange={(e) => {
                              setFieldValues((prev) => ({
                                ...prev,
                                [field.field_key]: e.target.value,
                              }));
                            }}
                            placeholder={field.default_value || "Enter value"}
                            required={field.is_required}
                          />
                        )}
                        
                        {field.field_type === "TEXT" && (
                          <Input
                            id={field.field_key}
                            type="text"
                            value={fieldValues[field.field_key] as string || ""}
                            onChange={(e) => {
                              setFieldValues((prev) => ({
                                ...prev,
                                [field.field_key]: e.target.value,
                              }));
                            }}
                            placeholder={field.default_value || "Enter text"}
                            required={field.is_required}
                          />
                        )}
                        
                        {field.field_type === "SELECT" && (
                          <Select
                            value={(fieldValues[field.field_key] as string) || field.default_value || ""}
                            onValueChange={(value) => {
                              setFieldValues((prev) => ({
                                ...prev,
                                [field.field_key]: value,
                              }));
                            }}
                          >
                            <SelectTrigger id={field.field_key}>
                              <SelectValue placeholder="Select an option" />
                            </SelectTrigger>
                            <SelectContent>
                              {field.options && field.options.length > 0 ? (
                                field.options.map((option: any, index: number) => {
                                  // Handle both string arrays and object arrays
                                  const value = typeof option === "string" ? option : (option.value || option);
                                  const label = typeof option === "string" ? option : (option.label || option.value || option);
                                  return (
                                    <SelectItem key={index} value={String(value)}>
                                      {String(label)}
                                    </SelectItem>
                                  );
                                })
                              ) : (
                                field.default_value && (
                                  <SelectItem value={field.default_value}>
                                    {field.default_value}
                                  </SelectItem>
                                )
                              )}
                            </SelectContent>
                          </Select>
                        )}
                        
                        {field.field_type === "RADIO" && (
                          <RadioGroup
                            value={(fieldValues[field.field_key] as string) || field.default_value || ""}
                            onValueChange={(value) => {
                              setFieldValues((prev) => ({
                                ...prev,
                                [field.field_key]: value,
                              }));
                            }}
                          >
                            {field.options && field.options.length > 0 ? (
                              field.options.map((option: any, index: number) => {
                                // Handle both string arrays and object arrays
                                const value = typeof option === "string" ? option : (option.value || option);
                                const label = typeof option === "string" ? option : (option.label || option.value || option);
                                return (
                                  <div key={index} className="flex items-center space-x-2">
                                    <RadioGroupItem value={String(value)} id={`${field.field_key}-${index}`} />
                                    <Label htmlFor={`${field.field_key}-${index}`} className="font-normal cursor-pointer">
                                      {String(label)}
                                    </Label>
                                  </div>
                                );
                              })
                            ) : null}
                          </RadioGroup>
                        )}
                        
                        {field.field_type === "TEXTAREA" && (
                          <textarea
                            id={field.field_key}
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={fieldValues[field.field_key] as string || ""}
                            onChange={(e) => {
                              setFieldValues((prev) => ({
                                ...prev,
                                [field.field_key]: e.target.value,
                              }));
                            }}
                            placeholder={field.default_value || "Enter text"}
                            required={field.is_required}
                            rows={4}
                          />
                        )}
                        
                        {field.help_text && (
                          <p className="text-sm text-muted-foreground">{field.help_text}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Slot Masters */}
            {equipment.slot_masters && equipment.slot_masters.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Available Time Slots
                  </CardTitle>
                  <CardDescription>
                    {equipment.slot_duration_minutes} minutes per slot
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {equipment.slot_masters
                      .filter((slot) => slot.is_active)
                      .map((slot) => {
                        const isSelected = selectedSlots.includes(slot.slot_number);
                        return (
                          <button
                            key={slot.slot_number}
                            onClick={() => toggleSlot(slot.slot_number)}
                            className={`p-3 border rounded-lg text-center transition-all cursor-pointer ${
                              isSelected
                                ? "bg-primary text-primary-foreground border-primary"
                                : "hover:bg-accent hover:border-accent-foreground"
                            }`}
                          >
                            <div className="font-semibold text-sm">{slot.slot_name}</div>
                            <div className={`text-xs mt-1 ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                              {formatTime(slot.open_time)} - {formatTime(slot.close_time)}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Section - Output/Results */}
          <div className="lg:col-span-1 space-y-6">
            <div className="sticky top-6">
              {/* Calculation Results */}
              <Card>
                <CardHeader>
                  <CardTitle>Booking Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Selected Slots */}
                  {selectedSlots.length > 0 && (
                    <div>
                      <div className="text-sm font-medium mb-2">Selected Slots ({selectedSlots.length})</div>
                      <div className="flex flex-wrap gap-2">
                        {selectedSlots.map((slotNum) => {
                          const slot = equipment.slot_masters?.find((s) => s.slot_number === slotNum);
                          return (
                            <Badge key={slotNum} variant="secondary">
                              {slot?.slot_name || `Slot ${slotNum}`}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Total Time & Total Charge */}
                  {chargeCalculated ? (
                    <div className="space-y-4">
                      <Separator />
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Total Time:</span>
                        <span className="font-semibold text-lg">{formatTimeDisplay(calculatedTime)}</span>
                      </div>
                      {chargeBreakdown.length > 0 && (
                        <>
                          <Separator />
                          <div className="space-y-2">
                            <span className="text-sm font-medium">Charge Breakdown:</span>
                            {chargeBreakdown.map((item, index) => (
                              <div key={index} className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">{item.description}</span>
                                <span className="font-medium">₹{item.amount.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                      <Separator />
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Total Charge:</span>
                        <span className="font-semibold text-lg text-primary">₹{calculatedCharge.toFixed(2)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      {calculating ? (
                        <div className="space-y-2">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                          <p className="text-sm">Calculating...</p>
                        </div>
                      ) : (
                        <p className="text-sm">Fill in all required fields to see calculation</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Book Button */}
              <Card className="mt-6">
                <CardContent className="pt-6">
                  <Button
                    className="w-full"
                    size="lg"
                    disabled={selectedSlots.length === 0 || !chargeCalculated}
                    onClick={() => {
                      // Pass selected slots and field values to booking page
                      const params = new URLSearchParams({
                        equipment_id: String(equipment.equipment_id),
                        slots: selectedSlots.join(","),
                        total_time: String(calculatedTime),
                        total_charge: String(calculatedCharge),
                        ...Object.fromEntries(
                          Object.entries(fieldValues).map(([key, value]) => [
                            `field_${key}`,
                            String(value),
                          ])
                        ),
                      });
                      navigate(`/book-equipment?${params.toString()}`);
                    }}
                  >
                    {selectedSlots.length === 0
                      ? "Select Slots to Book"
                      : !chargeCalculated
                      ? "Calculate Charge First"
                      : `Book This Equipment (${selectedSlots.length} slot${selectedSlots.length > 1 ? "s" : ""})`}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default EquipmentProfile;

