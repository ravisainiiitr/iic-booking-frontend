import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { toast } from "sonner";
import { format, addDays, startOfWeek, addWeeks, isSameDay, parseISO, startOfDay } from "date-fns";
import { type EquipmentData } from "@/data/equipmentData";

interface Equipment extends EquipmentData {}

interface DailySlot {
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
}

interface EquipmentDetail {
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
  slot_duration_minutes?: number;
  daily_slots?: DailySlot[];
  weekly_holidays?: Record<string, string>;
  input_fields?: Array<any>;
  charge_profiles?: Array<any>;
  [key: string]: any;
}

interface TimeSlot {
  date: Date;
  time: string;
  isBooked: boolean;
  slotId?: number;
  slotData?: DailySlot;
}

// Time slots from 9:00 AM to 5:30 PM (1-hour slots)
const TIME_SLOTS = [
  "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"
];

const BookEquipment = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loadingEquipmentDetail, setLoadingEquipmentDetail] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [equipmentDetail, setEquipmentDetail] = useState<EquipmentDetail | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  const [inputFieldValues, setInputFieldValues] = useState<Record<string, string | boolean | string[]>>({});
  const [chargeCalculated, setChargeCalculated] = useState(false);
  const [calculatedCharge, setCalculatedCharge] = useState<{
    total_charge: string;
    total_time_minutes: number;
    charge_breakdown: Array<{ description: string; amount: number }>;
  } | null>(null);
  const [loadingCharge, setLoadingCharge] = useState(false);
  const [showSlots, setShowSlots] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [lastFetchedWeek, setLastFetchedWeek] = useState<string | null>(null);
  const [chargeCalculationFailed, setChargeCalculationFailed] = useState(false);
  const lastCalculatedValuesRef = useRef<string>('');
  const calculationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchingSlotsRef = useRef<boolean>(false);

  useEffect(() => {
    // Get user ID from localStorage (set by DashboardHeader) to avoid duplicate API calls
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setUserId(String(user.id));
      } catch (e) {
        // If localStorage fails, check auth
        checkAuth();
      }
    } else {
      // If no user in localStorage, check auth
      checkAuth();
    }
  }, []);

  const fetchEquipmentDetail = useCallback(async (equipmentId: number | string) => {
    try {
      setLoadingEquipmentDetail(true);
      const response = await apiClient.getEquipmentDetailById(equipmentId);
      
      if (response.error) {
        toast.error(response.error || "Failed to load equipment details");
        setLoadingEquipmentDetail(false);
        return;
      }

      if (!response.data) {
        toast.error("Equipment details not found");
        setLoadingEquipmentDetail(false);
        return;
      }

      const eq = response.data;
      
      // Store full equipment detail for slot processing
      // But don't process slots yet - wait for charge calculation
      setEquipmentDetail(eq);
      
      // Reset charge calculation state when equipment changes
      setChargeCalculated(false);
      setCalculatedCharge(null);
      setShowSlots(false);
      setSelectedSlots([]);
      setLastFetchedWeek(null);
      setChargeCalculationFailed(false);
      lastCalculatedValuesRef.current = ''; // Reset the hash
      fetchingSlotsRef.current = false; // Reset fetching flag
      
      // Initialize input field values with default values
      if (eq.input_fields && eq.input_fields.length > 0) {
        
        const initialValues: Record<string, string | boolean | string[]> = {};
        eq.input_fields.forEach((field: any) => {
          const fieldType = String(field.field_type || '').toUpperCase().trim();
          if (fieldType === 'TOGGLE') {
            initialValues[field.field_key] = field.default_value === 'true' || field.default_value === true;
          } else if (fieldType === 'MULTI_SELECT') {
            initialValues[field.field_key] = field.default_value ? field.default_value.split(',') : [];
          } else {
            // TEXT, NUMERIC, RADIO, COMBO - all use string values
            initialValues[field.field_key] = field.default_value || '';
          }
        });
        setInputFieldValues(initialValues);
      }
      
      // Get pricing from charge_profiles (use first active profile or student profile)
      const studentProfile = eq.charge_profiles?.find(
        (p: any) => p.user_type === "student" && p.is_active
      );
      const firstActiveProfile = eq.charge_profiles?.find((p: any) => p.is_active);
      const pricingProfile = studentProfile || firstActiveProfile;
      
      // Transform API response to match EquipmentData interface
      const transformedEquipment: Equipment = {
        id: eq.equipment_id,
        name: eq.name,
        category: eq.profile_type_display || eq.profile_type || "Uncategorized",
        description: eq.description || `${eq.name} - ${eq.profile_type_display || ""}`,
        image: eq.image_url || "/placeholder.svg",
        video: "", // API doesn't provide video_url in detail response
        available: eq.status === "ACTIVE",
        address: eq.location || "",
        technicalPerson: "", // API doesn't provide technical_contact in detail response
        contactNumber: "", // API doesn't provide this separately
        internalRate: pricingProfile ? parseFloat(pricingProfile.primary_unit_charge || "0") : 0,
        externalRate: pricingProfile ? parseFloat(pricingProfile.secondary_unit_charge || "0") : 0,
      };

      setSelectedEquipment(transformedEquipment);
    } catch (error: any) {
      toast.error(error.message || "Failed to load equipment details");
    } finally {
      setLoadingEquipmentDetail(false);
    }
  }, []);

  const handleEquipmentSelect = useCallback((equipmentId: number | string) => {
    fetchEquipmentDetail(equipmentId);
  }, [fetchEquipmentDetail]);

  // Handle equipment_id from URL query parameters
  useEffect(() => {
    const equipmentId = searchParams.get('equipment_id');
    
    // If no equipment_id, redirect to equipment listing
    if (!equipmentId && !selectedEquipment) {
      navigate('/equipments');
      return;
    }
    
    // Auto-select equipment if equipment_id is provided in URL
    if (equipmentId && !selectedEquipment && !loadingEquipmentDetail) {
      handleEquipmentSelect(equipmentId);
    }
  }, [searchParams, selectedEquipment, loadingEquipmentDetail, handleEquipmentSelect, navigate]);

  // Reset input field values when equipment changes
  useEffect(() => {
    if (!equipmentDetail) {
      setInputFieldValues({});
      setChargeCalculated(false);
      setCalculatedCharge(null);
      setShowSlots(false);
    }
  }, [equipmentDetail]);

  // Calculate charge based on input fields
  const calculateCharge = useCallback(async () => {
    if (!selectedEquipment || !equipmentDetail) {
      return;
    }

    // Skip if already loading to prevent concurrent calls
    if (loadingCharge) {
      return;
    }

    // Create a hash of current input values to check if we already calculated for these values
    const currentValuesHash = JSON.stringify(inputFieldValues);
    if (lastCalculatedValuesRef.current === currentValuesHash) {
      return; // Already calculated for these values
    }

    // Validate required input fields before calculating (only if input fields exist)
    // Note: This validation is already done in the useEffect, but keeping as a safety check
    if (equipmentDetail.input_fields && equipmentDetail.input_fields.length > 0) {
      const requiredFields = equipmentDetail.input_fields.filter((field: any) => field.is_required);
      for (const field of requiredFields) {
        const value = inputFieldValues[field.field_key];
        if (value === undefined || value === null || value === '' || 
            (Array.isArray(value) && value.length === 0)) {
          // Don't show error toast for auto-calculation, just return
          return;
        }
      }
    }
    
    // If no input fields, we still need to call the API with empty values
    // This ensures slots only appear after successful charge calculation

    try {
      setLoadingCharge(true);
      const response = await apiClient.calculateEquipmentCharge(
        selectedEquipment.id,
        inputFieldValues
      );

      if (response.error) {
        // Set failed state to show "coming soon" message
        setChargeCalculationFailed(true);
        setChargeCalculated(false);
        setCalculatedCharge(null);
        setShowSlots(false);
        // Store the hash even on failure to prevent retrying with same values
        lastCalculatedValuesRef.current = currentValuesHash;
        // Only show error toast if it's a critical error, not validation errors
        if (!response.error.includes("required") && !response.error.includes("field")) {
          // Don't show toast, just show "coming soon" message
        }
        return;
      }

      if (response.data) {
        setCalculatedCharge({
          total_charge: response.data.total_charge,
          total_time_minutes: response.data.total_time_minutes,
          charge_breakdown: response.data.charge_breakdown || [],
        });
        setChargeCalculated(true);
        setShowSlots(true);
        setChargeCalculationFailed(false); // Reset failed state on success
        // Store the hash of values we just calculated for
        lastCalculatedValuesRef.current = currentValuesHash;
      }
    } catch (error: any) {
      // Set failed state to show "coming soon" message
      setChargeCalculationFailed(true);
      setChargeCalculated(false);
      setCalculatedCharge(null);
      setShowSlots(false);
      // Store the hash even on failure to prevent retrying with same values
      lastCalculatedValuesRef.current = currentValuesHash;
      // Don't show error toast, just show "coming soon" message
    } finally {
      setLoadingCharge(false);
    }
  }, [selectedEquipment, equipmentDetail, inputFieldValues, loadingCharge]);

  // Auto-calculate charge when input fields change
  useEffect(() => {
    // Clear any existing timeout
    if (calculationTimeoutRef.current) {
      clearTimeout(calculationTimeoutRef.current);
    }

    // Don't calculate if equipment is not loaded
    if (!selectedEquipment || !equipmentDetail) {
      return;
    }

    // Skip if already loading
    if (loadingCharge) {
      return;
    }

    // Check if all required fields are filled (if there are input fields)
    const hasInputFields = equipmentDetail.input_fields && equipmentDetail.input_fields.length > 0;
    let allRequiredFilled = true;

    if (hasInputFields) {
      const requiredFields = equipmentDetail.input_fields.filter((field: any) => field.is_required);
      allRequiredFilled = requiredFields.every((field: any) => {
        const value = inputFieldValues[field.field_key];
        return value !== undefined && value !== null && value !== '' && 
               !(Array.isArray(value) && value.length === 0);
      });
    }

    // Calculate charge if:
    // 1. No input fields (always calculate with empty values)
    // 2. Has input fields and all required fields are filled
    if (!hasInputFields || allRequiredFilled) {
      // Create hash of current values
      const currentValuesHash = JSON.stringify(inputFieldValues);
      
      // Skip if we already calculated (or failed) for these exact values
      if (lastCalculatedValuesRef.current === currentValuesHash) {
        return;
      }

      // If previous calculation failed, reset the failed state when values change
      if (chargeCalculationFailed && lastCalculatedValuesRef.current !== currentValuesHash) {
        setChargeCalculationFailed(false);
      }

      // Debounce the calculation to avoid too many API calls
      calculationTimeoutRef.current = setTimeout(() => {
        calculateCharge();
      }, 500); // Wait 500ms after user stops typing

      return () => {
        if (calculationTimeoutRef.current) {
          clearTimeout(calculationTimeoutRef.current);
        }
      };
    } else {
      // Reset charge calculation if required fields are not filled
      if (chargeCalculated || chargeCalculationFailed) {
        setChargeCalculated(false);
        setCalculatedCharge(null);
        setShowSlots(false);
        setChargeCalculationFailed(false);
        lastCalculatedValuesRef.current = ''; // Reset the hash
      }
    }
  }, [inputFieldValues, selectedEquipment, equipmentDetail, loadingCharge, chargeCalculated, chargeCalculationFailed, calculateCharge]);

  // Fetch slots for the current week
  const fetchSlotsForWeek = useCallback(async () => {
    if (!selectedEquipment) return;
    
    // Prevent concurrent calls using ref
    if (fetchingSlotsRef.current || loadingSlots) {
      return;
    }

    const weekStart = startOfWeek(currentWeekStart, { weekStartsOn: 0 });
    const weekEnd = addDays(weekStart, 7);
    const startDateStr = format(weekStart, "yyyy-MM-dd");
    const endDateStr = format(weekEnd, "yyyy-MM-dd");
    
    // Check if we already fetched slots for this week
    const weekKey = `${startDateStr}_${endDateStr}`;
    if (lastFetchedWeek === weekKey) {
      return;
    }

    try {
      fetchingSlotsRef.current = true;
      setLoadingSlots(true);
      const slotsResponse = await apiClient.getEquipmentSlots(
        selectedEquipment.id,
        startDateStr,
        endDateStr
      );

      if (slotsResponse.data && slotsResponse.data.slots) {
        // Update equipmentDetail with fetched slots and holidays
        setEquipmentDetail(prev => {
          if (!prev) return prev;
          const newSlots = slotsResponse.data!.slots;
          const newHolidays = slotsResponse.data?.holidays ?? {};
          const currentSlots = prev.daily_slots || [];
          if (JSON.stringify(currentSlots) === JSON.stringify(newSlots) && JSON.stringify(prev.weekly_holidays ?? {}) === JSON.stringify(newHolidays)) {
            return prev;
          }
          return {
            ...prev,
            daily_slots: newSlots,
            weekly_holidays: newHolidays,
          };
        });
        setLastFetchedWeek(weekKey);
      }
    } catch (error: any) {
      console.error("Error fetching slots:", error);
    } finally {
      setLoadingSlots(false);
      fetchingSlotsRef.current = false;
    }
  }, [selectedEquipment, currentWeekStart, loadingSlots, lastFetchedWeek]);

  const processDailySlots = useCallback(() => {
    if (!equipmentDetail?.daily_slots) {
      return;
    }

    const weekEnd = addDays(currentWeekStart, 7);

    equipmentDetail.daily_slots.forEach((slot) => {
      try {
        // Parse the date string (format: "2026-01-05")
        const slotDate = startOfDay(parseISO(slot.date));
        const startDate = parseISO(slot.start_datetime);
        const weekStart = startOfDay(currentWeekStart);
        const weekEndDate = startOfDay(weekEnd);
        
        // Only include slots within the current week view (compare dates only, not times)
        // Check if slot date is within the week range (inclusive start, exclusive end)
        const slotTime = slotDate.getTime();
        const weekStartTime = weekStart.getTime();
        const weekEndTime = weekEndDate.getTime();
        
        if (slotTime >= weekStartTime && slotTime < weekEndTime) {
          // Use slot.status to determine if it's booked or not
          const isBooked = slot.status !== "AVAILABLE";
        }
      } catch (error) {
        console.error("Error processing slot:", error, slot);
      }
    });
  }, [equipmentDetail, currentWeekStart]);

  useEffect(() => {
    // Only process slots if charge has been calculated and slots should be shown
    if (selectedEquipment && equipmentDetail && showSlots && chargeCalculated) {
      if (equipmentDetail.profile_type === "HOUR" && equipmentDetail.daily_slots && equipmentDetail.daily_slots.length > 0) {
        // Use daily_slots from API response
        processDailySlots();
      } else {
        // No daily slots available, clear booked slots
      }
    }
  }, [selectedEquipment, currentWeekStart, equipmentDetail, processDailySlots, showSlots, chargeCalculated]);

  // Safety check: keep only slots that fit within total (each slot counts as min(slotDuration, remaining))
  useEffect(() => {
    if (calculatedCharge && selectedSlots.length > 0) {
      const totalLimit = calculatedCharge.total_time_minutes;
      let currentTotal = 0;
      let fitCount = 0;
      for (const slot of selectedSlots) {
        const slotDuration = getSlotDurationMinutes(slot);
        const contribution = Math.min(slotDuration, totalLimit - currentTotal);
        if (contribution <= 0) break;
        fitCount += 1;
        currentTotal += contribution;
      }
      if (fitCount < selectedSlots.length) {
        setSelectedSlots(prev => {
          let total = 0;
          const validSlots: TimeSlot[] = [];
          for (const slot of prev) {
            const slotDuration = getSlotDurationMinutes(slot);
            const contribution = Math.min(slotDuration, totalLimit - total);
            if (contribution <= 0) break;
            validSlots.push(slot);
            total += contribution;
          }
          toast.error(
            `Selected slots exceeded the limit. Reduced to ${validSlots.length} slot(s) (${total} minutes / ${totalLimit} minutes).`
          );
          return validSlots;
        });
      }
    }
  }, [selectedSlots, calculatedCharge]);

  // Fetch slots when charge is calculated and slots should be shown, or when week changes
  useEffect(() => {
    // Only fetch if slots should be shown and charge is calculated
    if (!showSlots || !chargeCalculated || !selectedEquipment || loadingSlots || fetchingSlotsRef.current) {
      return;
    }

    // Get the current week key
    const weekStart = startOfWeek(currentWeekStart, { weekStartsOn: 0 });
    const weekEnd = addDays(weekStart, 7);
    const startDateStr = format(weekStart, "yyyy-MM-dd");
    const endDateStr = format(weekEnd, "yyyy-MM-dd");
    const weekKey = `${startDateStr}_${endDateStr}`;
    
    // Skip if we already fetched for this week
    if (lastFetchedWeek === weekKey) {
      return;
    }

    // Fetch slots
    fetchSlotsForWeek();
  }, [showSlots, chargeCalculated, selectedEquipment, currentWeekStart, loadingSlots, lastFetchedWeek, fetchSlotsForWeek]);

  const checkAuth = async () => {
    const token = apiClient.getToken();
    if (!token) {
      navigate("/auth");
      return;
    }

    const userResponse = await apiClient.getCurrentUser();
    if (userResponse.error || !userResponse.data) {
      navigate("/auth");
      return;
    }

    setUserId(String(userResponse.data.id));
  };


  const isSlotBooked = (date: Date, time: string): boolean => {
    const slotData = getSlotData(date, time);
    return slotData ? slotData.status !== "AVAILABLE" : false;
  };

  const isSlotSelected = (date: Date, time: string): boolean => {
    return selectedSlots.some(slot => 
      isSameDay(slot.date, date) && slot.time === time
    );
  };

  const getSlotData = (date: Date, time: string): DailySlot | undefined => {
    if (!equipmentDetail?.daily_slots) return undefined;
    
    const normalizedDate = startOfDay(date);
    const expectedDateStr = format(normalizedDate, "yyyy-MM-dd");
    
    return equipmentDetail.daily_slots.find(slot => {
      const slotDateStr = typeof slot.date === "string"
        ? (slot.date.includes("T") ? format(parseISO(slot.date), "yyyy-MM-dd") : slot.date)
        : "";
      const slotTime = slot.start_datetime
        ? format(parseISO(slot.start_datetime), "HH:mm")
        : "";
      return slotDateStr === expectedDateStr && slotTime === time;
    });
  };

  // Calculate slot duration in minutes from slot data
  const getSlotDurationMinutes = (slot: TimeSlot): number => {
    if (slot.slotData?.start_datetime && slot.slotData?.end_datetime) {
      try {
        const start = parseISO(slot.slotData.start_datetime);
        const end = parseISO(slot.slotData.end_datetime);
        return Math.round((end.getTime() - start.getTime()) / (1000 * 60)); // Convert to minutes
      } catch (error) {
        console.error("Error calculating slot duration:", error);
      }
    }
    // Fallback to equipment slot_duration_minutes if slot data not available
    return equipmentDetail?.slot_duration_minutes || 60;
  };

  // Calculate total selected minutes from actual slot durations
  const getTotalSelectedMinutes = (): number => {
    if (selectedSlots.length === 0) return 0;
    return selectedSlots.reduce((total, slot) => {
      return total + getSlotDurationMinutes(slot);
    }, 0);
  };

  // Effective selected minutes capped at total (e.g. one 60-min slot for 7-min total counts as 7)
  const getEffectiveSelectedMinutes = (): number => {
    const raw = getTotalSelectedMinutes();
    if (!calculatedCharge) return raw;
    return Math.min(raw, calculatedCharge.total_time_minutes);
  };

  // Get remaining minutes that can be selected
  const getRemainingMinutes = (): number => {
    if (!calculatedCharge) return 0;
    return Math.max(0, calculatedCharge.total_time_minutes - getEffectiveSelectedMinutes());
  };

  // Check if a slot is consecutive to selected slots
  const isConsecutiveSlot = (newSlot: TimeSlot, selectedSlots: TimeSlot[]): boolean => {
    if (selectedSlots.length === 0) return true; // First slot is always allowed
    
    if (!newSlot.slotData?.start_datetime || !newSlot.slotData?.end_datetime) {
      return false;
    }
    
    const newSlotStart = parseISO(newSlot.slotData.start_datetime);
    const newSlotEnd = parseISO(newSlot.slotData.end_datetime);
    
    // Sort selected slots by start time
    const sortedSlots = [...selectedSlots].sort((a, b) => {
      if (!a.slotData?.start_datetime || !b.slotData?.start_datetime) return 0;
      return parseISO(a.slotData.start_datetime).getTime() - parseISO(b.slotData.start_datetime).getTime();
    });
    
    // Get first and last selected slots
    const firstSlot = sortedSlots[0];
    const lastSlot = sortedSlots[sortedSlots.length - 1];
    
    if (!firstSlot.slotData?.start_datetime || !firstSlot.slotData?.end_datetime ||
        !lastSlot.slotData?.start_datetime || !lastSlot.slotData?.end_datetime) {
      return false;
    }
    
    const firstSlotStart = parseISO(firstSlot.slotData.start_datetime);
    const firstSlotEnd = parseISO(firstSlot.slotData.end_datetime);
    const lastSlotStart = parseISO(lastSlot.slotData.start_datetime);
    const lastSlotEnd = parseISO(lastSlot.slotData.end_datetime);
    
    // Check if new slot is immediately before the first slot (consecutive at the start)
    const isBeforeFirst = newSlotEnd.getTime() === firstSlotStart.getTime();
    
    // Check if new slot is immediately after the last slot (consecutive at the end)
    const isAfterLast = newSlotStart.getTime() === lastSlotEnd.getTime();
    
    return isBeforeFirst || isAfterLast;
  };

  const toggleSlot = (date: Date, time: string) => {
    if (isSlotBooked(date, time)) return;

    const slotData = getSlotData(date, time);
    const slot: TimeSlot = { 
      date, 
      time, 
      isBooked: false,
      slotId: slotData?.id,
      slotData: slotData,
    };
    
    // Use functional update to ensure we're working with the latest state
    setSelectedSlots(prev => {
      // Check if slot is already selected using current state
      const isAlreadySelected = prev.some(s => 
        isSameDay(s.date, date) && s.time === time
      );
      
      if (isAlreadySelected) {
        // Deselecting is always allowed
        return prev.filter(s => 
          !(isSameDay(s.date, date) && s.time === time)
        );
      } else {
        // Check if slot is consecutive to already selected slots
        if (prev.length > 0 && !isConsecutiveSlot(slot, prev)) {
          toast.error("Please select consecutive slots only. You can select slots that are immediately before or after your current selection.");
          return prev; // Return previous state without changes
        }
        
        // STRICT VALIDATION: Check against latest state before adding
        if (calculatedCharge) {
          // Calculate current selected minutes from actual slot durations (most up-to-date)
          const currentSelectedMinutes = prev.reduce((total, s) => {
            return total + getSlotDurationMinutes(s);
          }, 0);
          
          // Calculate duration of the slot being added
          const slotDuration = getSlotDurationMinutes(slot);
          const newTotalMinutes = currentSelectedMinutes + slotDuration;
          console.log("newTotalMinutes", newTotalMinutes);
          console.log("calculatedCharge.total_time_minutes", calculatedCharge.total_time_minutes);
          console.log("currentSelectedMinutes", currentSelectedMinutes);
          // STRICT CHECK: Prevent selecting if it would exceed the limit
          if (newTotalMinutes < calculatedCharge.total_time_minutes) {
            const remaining = calculatedCharge.total_time_minutes - currentSelectedMinutes;
            console.log("remaining", remaining);
            toast.error(
              `Cannot select more slots. Maximum ${calculatedCharge.total_time_minutes} minutes allowed. ` +
              `You have selected ${currentSelectedMinutes} minutes. ${remaining > 0 ? `Only ${remaining} minutes remaining.` : 'Limit reached.'}`
            );
            return prev; // Return previous state without changes
          }
          
          // Additional safety check: prevent if already at or over limit
          if (currentSelectedMinutes >= calculatedCharge.total_time_minutes) {
            toast.error(`You have already reached the maximum allowed time (${calculatedCharge.total_time_minutes} minutes).`);
            return prev; // Return previous state without changes
          }
          
          // Validation passed, add the slot
          return [...prev, slot];
        } else {
          // If charge not calculated, don't allow slot selection
          toast.error("Please wait for charge calculation to complete before selecting slots.");
          return prev; // Return previous state without changes
        }
      }
    });
  };

  // Use weekly slots from API whenever we have daily_slots (any profile type: HOUR, SAMPLE, etc.)
  const useWeeklySlots = (): boolean => {
    return equipmentDetail?.daily_slots !== undefined && equipmentDetail.daily_slots.length > 0;
  };

  // Get unique time slots from daily_slots
  const getTimeSlotsFromDailySlots = (): string[] => {
    if (!equipmentDetail?.daily_slots || equipmentDetail.daily_slots.length === 0) {
      console.log("No daily_slots found, using default TIME_SLOTS");
      return []; // Return empty array if no daily_slots
    }
    
    const uniqueTimes = new Set<string>();
    equipmentDetail.daily_slots.forEach(slot => {
      try {
        const startDate = parseISO(slot.start_datetime);
        const timeStr = format(startDate, "HH:mm");
        uniqueTimes.add(timeStr);
      } catch (error) {
        console.error("Error parsing slot time:", error, slot);
      }
    });
    
    const sortedTimes = Array.from(uniqueTimes).sort();
    // If we have slots, return them; otherwise fallback to default
    return sortedTimes.length > 0 ? sortedTimes : [];
  };

  const calculateTotalCost = (): number => {
    if (!selectedEquipment || selectedSlots.length === 0) return 0;
    // Use calculated charge if available
    if (calculatedCharge) {
      // Calculate cost per minute based on total charge and time
      const costPerMinute = Number(calculatedCharge.total_charge) / calculatedCharge.total_time_minutes;
      const selectedMinutes = getTotalSelectedMinutes(); // Use actual selected minutes
      return selectedMinutes * costPerMinute;
    }
    // Fallback: assume 1 hour per slot if charge not calculated
    return selectedSlots.length * Number(selectedEquipment.internalRate);
  };

  const goToPreviousWeek = () => {
    setCurrentWeekStart(addWeeks(currentWeekStart, -1));
    setSelectedSlots([]);
  };

  const goToNextWeek = () => {
    setCurrentWeekStart(addWeeks(currentWeekStart, 1));
    setSelectedSlots([]);
  };

  // Handle input field changes - charge will auto-calculate via useEffect
  const handleInputFieldChange = (fieldKey: string, value: string | boolean | string[]) => {
    setInputFieldValues(prev => ({
      ...prev,
      [fieldKey]: value
    }));
  };

  const handleBooking = async () => {
    if (!userId || !selectedEquipment || selectedSlots.length === 0) {
      toast.error("Please select at least one time slot");
      return;
    }

    // Validate that selected slots don't exceed total_time_minutes
    if (calculatedCharge) {
      const selectedMinutes = getTotalSelectedMinutes();
      if (selectedMinutes > calculatedCharge.total_time_minutes) {
        toast.error(
          `Selected slots exceed the allowed time. Maximum ${calculatedCharge.total_time_minutes} minutes allowed, but ${selectedMinutes} minutes selected.`
        );
        return;
      }
    }

    try {
      // Sort slots by start_datetime from slot data
      const sortedSlots = [...selectedSlots].sort((a, b) => {
        const aStart = a.slotData?.start_datetime ? parseISO(a.slotData.start_datetime).getTime() : a.date.getTime();
        const bStart = b.slotData?.start_datetime ? parseISO(b.slotData.start_datetime).getTime() : b.date.getTime();
        return aStart - bStart;
      });
      
      // Group consecutive slots into bookings using actual slot start/end times
      const bookings: Array<{start: Date, end: Date}> = [];
      let currentBooking: {start: Date, end: Date} | null = null;

      sortedSlots.forEach((slot, index) => {
        // Use actual slot start/end times from API if available
        let slotStart: Date;
        let slotEnd: Date;
        
        if (slot.slotData?.start_datetime && slot.slotData?.end_datetime) {
          slotStart = parseISO(slot.slotData.start_datetime);
          slotEnd = parseISO(slot.slotData.end_datetime);
        } else {
          // Fallback to date + time parsing
          const slotDateTime = new Date(slot.date);
          const [hours, minutes] = slot.time.split(':');
          slotDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          slotStart = slotDateTime;
          slotEnd = new Date(slotDateTime.getTime() + 60 * 60 * 1000); // Default 1 hour
        }

        if (!currentBooking) {
          currentBooking = {
            start: slotStart,
            end: slotEnd
          };
        } else {
          // Check if this slot is consecutive (starts exactly when previous ends)
          if (slotStart.getTime() === currentBooking.end.getTime()) {
            // Extend the booking to include this slot
            currentBooking.end = slotEnd;
          } else {
            // Start a new booking
            bookings.push(currentBooking);
            currentBooking = {
              start: slotStart,
              end: slotEnd
            };
          }
        }

        if (index === sortedSlots.length - 1 && currentBooking) {
          bookings.push(currentBooking);
        }
      });

      // Validate required input fields
      if (equipmentDetail?.input_fields) {
        const requiredFields = equipmentDetail.input_fields.filter((field: any) => field.is_required);
        for (const field of requiredFields) {
          const value = inputFieldValues[field.field_key];
          if (value === undefined || value === null || value === '' || 
              (Array.isArray(value) && value.length === 0)) {
            toast.error(`Please fill in the required field: ${field.field_label}`);
            return;
          }
        }
      }

      // Calculate cost per minute from calculated charge
      let costPerMinute = 0;
      if (calculatedCharge && calculatedCharge.total_time_minutes > 0) {
        costPerMinute = Number(calculatedCharge.total_charge) / calculatedCharge.total_time_minutes;
      } else if (selectedEquipment.internalRate) {
        // Fallback to internal rate per hour, convert to per minute
        costPerMinute = Number(selectedEquipment.internalRate) / 60;
      }

      // Create all bookings using the equipment-specific booking endpoint
      const bookingPromises = bookings.map(booking => {
        // Calculate actual minutes for this booking
        const minutes = (booking.end.getTime() - booking.start.getTime()) / (1000 * 60);
        const hours = minutes / 60;
        const totalCost = minutes * costPerMinute;
        
        return apiClient.bookEquipment(selectedEquipment.id, {
          start_time: booking.start.toISOString(),
          end_time: booking.end.toISOString(),
          total_hours: hours,
          total_cost: totalCost,
          status: "pending",
          input_values: inputFieldValues, // Include input field values
        });
      });

      const results = await Promise.all(bookingPromises);
      const errors = results.filter((r): r is typeof r & { error: string } => !!r.error);

      if (errors.length > 0) {
        const message = errors[0].error || "Failed to create some bookings";
        throw new Error(message);
      }

      toast.success(`${bookings.length} booking(s) created successfully!`);
      navigate("/my-bookings");
    } catch (error: any) {
      toast.error(error.message || "Failed to create booking");
    }
  };

  if (!selectedEquipment || !equipmentDetail) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
        <DashboardHeader />
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No equipment selected for booking</p>
              <Button onClick={() => navigate('/equipments')}>
                Browse Equipment
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20 relative">
      {loadingEquipmentDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card p-6 rounded-lg flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-sm text-muted-foreground">Loading equipment details...</p>
          </div>
        </div>
      )}
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">
          Book {selectedEquipment.name}
        </h1>

        <div className="max-w-6xl mx-auto">
          <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Book {selectedEquipment.name}</CardTitle>
                    <CardDescription>
                      ₹{Number(selectedEquipment.internalRate).toFixed(2)}/hour
                      {equipmentDetail?.slot_duration_minutes && (
                        <>
                          {' • '}
                          {equipmentDetail.slot_duration_minutes >= 60 ? (
                            <>
                              Slot Duration: {Math.floor(equipmentDetail.slot_duration_minutes / 60)}h
                              {equipmentDetail.slot_duration_minutes % 60 > 0 && ` ${equipmentDetail.slot_duration_minutes % 60}m`}
                            </>
                          ) : (
                            <>Slot Duration: {equipmentDetail.slot_duration_minutes} {equipmentDetail.slot_duration_minutes === 1 ? 'minute' : 'minutes'}</>
                          )}
                        </>
                      )}
                      {' - Select your preferred time slots'}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Navigate back to equipment detail page
                      navigate(`/equipment/${selectedEquipment.id}`);
                    }}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Step 1: Input Fields Section */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-4">Step 1: Provide Additional Information</h3>
                  {equipmentDetail?.input_fields && equipmentDetail.input_fields.length > 0 ? (
                    <div className="mb-4 p-4 rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {equipmentDetail.input_fields.map((field: any) => {
                          // Normalize field_type to uppercase for case-insensitive matching
                          const fieldType = String(field.field_type || '').toUpperCase().trim();
                          
                          // Helper function to render the appropriate input component
                          // Only supports: NUMERIC, TEXT, RADIO, COMBO, MULTI_SELECT, TOGGLE
                          const renderInputField = () => {
                            switch (fieldType) {
                              case 'TEXT':
                                return (
                                  <Input
                                    id={field.field_key}
                                    value={inputFieldValues[field.field_key] as string || ''}
                                    onChange={(e) => handleInputFieldChange(field.field_key, e.target.value)}
                                    required={field.is_required}
                                    placeholder={field.default_value || ''}
                                    disabled={false}
                                  />
                                );
                              
                              case 'NUMERIC':
                                return (
                                  <Input
                                    id={field.field_key}
                                    type="number"
                                    value={inputFieldValues[field.field_key] as string || ''}
                                    onChange={(e) => handleInputFieldChange(field.field_key, e.target.value)}
                                    onBlur={(e) => {
                                      const value = e.target.value;
                                      if (value && isNaN(Number(value))) {
                                        handleInputFieldChange(field.field_key, '');
                                      }
                                    }}
                                    required={field.is_required}
                                    min={field.options?.min || undefined}
                                    max={field.options?.max || undefined}
                                    step={field.options?.step || '1'}
                                    placeholder={field.default_value || '0'}
                                  />
                                );
                              
                              case 'RADIO':
                                return (
                                  <RadioGroup
                                    value={inputFieldValues[field.field_key] as string || field.default_value || ''}
                                    onValueChange={(value) => handleInputFieldChange(field.field_key, value)}
                                    required={field.is_required}
                                  >
                                    {field.options && field.options.length > 0 ? (
                                      field.options.map((option: any) => {
                                        const optionValue = String(option.value || option);
                                        const optionLabel = option.label || option;
                                        return (
                                          <div key={optionValue} className="flex items-center space-x-2">
                                            <RadioGroupItem value={optionValue} id={`${field.field_key}-${optionValue}`} />
                                            <Label
                                              htmlFor={`${field.field_key}-${optionValue}`}
                                              className="font-normal cursor-pointer"
                                            >
                                              {optionLabel}
                                            </Label>
                                          </div>
                                        );
                                      })
                                    ) : (
                                      <p className="text-sm text-muted-foreground">No options available</p>
                                    )}
                                  </RadioGroup>
                                );
                              
                              case 'COMBO':
                                return (
                                  <Select
                                    value={inputFieldValues[field.field_key] as string || field.default_value || ''}
                                    onValueChange={(value) => handleInputFieldChange(field.field_key, value)}
                                    required={field.is_required}
                                    disabled={false}
                                  >
                                    <SelectTrigger id={field.field_key} className="w-full">
                                      <SelectValue placeholder={field.help_text || "Select an option"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {field.options && field.options.length > 0 ? (
                                        field.options.map((option: any) => {
                                          const optionValue = String(option.value || option);
                                          const optionLabel = option.label || option;
                                          return (
                                            <SelectItem key={optionValue} value={optionValue}>
                                              {optionLabel}
                                            </SelectItem>
                                          );
                                        })
                                      ) : field.default_value ? (
                                        <SelectItem value={field.default_value}>
                                          {field.default_value}
                                        </SelectItem>
                                      ) : (
                                        <SelectItem value="" disabled>No options available</SelectItem>
                                      )}
                                    </SelectContent>
                                  </Select>
                                );
                              
                              case 'MULTI_SELECT':
                                return (
                                  <div className="space-y-2">
                                    {field.options && field.options.length > 0 ? (
                                      field.options.map((option: any) => {
                                        const optionValue = option.value || option;
                                        const optionLabel = option.label || option;
                                        const currentValues = (inputFieldValues[field.field_key] as string[]) || [];
                                        const isChecked = currentValues.includes(optionValue);
                                        
                                        return (
                                          <div key={optionValue} className="flex items-center space-x-2">
                                            <Checkbox
                                              id={`${field.field_key}-${optionValue}`}
                                              checked={isChecked}
                                              onCheckedChange={(checked) => {
                                                const currentValues = (inputFieldValues[field.field_key] as string[]) || [];
                                                if (checked) {
                                                  handleInputFieldChange(field.field_key, [...currentValues, optionValue]);
                                                } else {
                                                  handleInputFieldChange(field.field_key, currentValues.filter(v => v !== optionValue));
                                                }
                                              }}
                                            />
                                            <Label
                                              htmlFor={`${field.field_key}-${optionValue}`}
                                              className="font-normal cursor-pointer"
                                            >
                                              {optionLabel}
                                            </Label>
                                          </div>
                                        );
                                      })
                                    ) : (
                                      <p className="text-sm text-muted-foreground">No options available</p>
                                    )}
                                  </div>
                                );
                              
                              case 'TOGGLE':
                                return (
                                  <div className="flex items-center justify-between">
                                    <Label htmlFor={field.field_key} className="font-normal cursor-pointer">
                                      {field.help_text || field.field_label}
                                    </Label>
                                    <Switch
                                      id={field.field_key}
                                      checked={inputFieldValues[field.field_key] === true || inputFieldValues[field.field_key] === 'true'}
                                      onCheckedChange={(checked) => handleInputFieldChange(field.field_key, checked)}
                                      required={field.is_required}
                                    />
                                  </div>
                                );
                              
                              default:
                                // Fallback for unknown field types - show error message
                                console.error(`Unsupported field type "${field.field_type}" (normalized: "${fieldType}") for field "${field.field_key}". Supported types: NUMERIC, TEXT, RADIO, COMBO, MULTI_SELECT, TOGGLE`);
                                return (
                                  <div className="p-3 border border-destructive rounded-md bg-destructive/10">
                                    <p className="text-sm text-destructive font-medium">
                                      Unsupported field type: {field.field_type}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Supported types: NUMERIC, TEXT, RADIO, COMBO, MULTI_SELECT, TOGGLE
                                    </p>
                                  </div>
                                );
                            }
                          };
                          
                          return (
                            <div key={field.field_key} className="space-y-2">
                              <Label htmlFor={field.field_key}>
                                {field.field_label}
                                {field.is_required && <span className="text-destructive ml-1">*</span>}
                              </Label>
                              {field.help_text && (
                                <p className="text-xs text-muted-foreground">{field.help_text}</p>
                              )}
                              {renderInputField()}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground mb-4">No additional information required for this equipment.</p>
                  )}
                  
                  {/* Loading indicator for auto-calculation */}
                  {loadingCharge && (
                    <div className="flex justify-center items-center gap-2 mt-4 text-sm text-muted-foreground">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      Calculating charge...
                    </div>
                  )}
                  
                  {/* Coming Soon message if charge calculation failed */}
                  {chargeCalculationFailed && !loadingCharge && (
                    <div className="mt-6 p-6 bg-muted rounded-lg border-2 border-dashed text-center">
                      <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
                      <p className="text-sm text-muted-foreground">
                        Charge calculation is currently unavailable. Please check back later.
                      </p>
                    </div>
                  )}
                </div>

                {/* Step 2: Calculated Charge Display */}
                {chargeCalculated && calculatedCharge && !chargeCalculationFailed && (
                  <div className="mb-6 p-6 bg-primary/10 rounded-lg border-2 border-primary">
                    <h3 className="text-lg font-semibold mb-4">Step 2: Charge Calculation</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Total Time:</span>
                        <span className="text-sm">
                          {Math.floor(calculatedCharge.total_time_minutes / 60)}h {calculatedCharge.total_time_minutes % 60}m
                        </span>
                      </div>
                      {calculatedCharge.charge_breakdown && calculatedCharge.charge_breakdown.length > 0 && (
                        <div className="mt-4 space-y-1">
                          <p className="text-sm font-medium mb-2">Charge Breakdown:</p>
                          {calculatedCharge.charge_breakdown.map((item, index) => (
                            <div key={index} className="flex justify-between text-sm">
                              <span className="text-muted-foreground">{item.description}</span>
                              <span>₹{Number(item.amount).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-4 border-t">
                        <span className="text-lg font-semibold">Total Charge:</span>
                        <span className="text-2xl font-bold text-primary">₹{Number(calculatedCharge.total_charge).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Slot Selection (only shown after charge calculation) */}
                {showSlots && chargeCalculated && (
                  <>
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold mb-4">Step 3: Select Time Slots</h3>
                    </div>

                {/* Show loading while slots are being fetched (avoids grid full of disabled cells) */}
                {loadingSlots && (!equipmentDetail?.daily_slots || equipmentDetail.daily_slots.length === 0) && (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <span className="animate-pulse">Loading slots for this week…</span>
                  </div>
                )}

                {/* Week Navigation */}
                <div className="flex justify-between items-center mb-6">
                  <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Previous Week
                  </Button>
                  <span className="font-semibold">
                    {format(currentWeekStart, "MMM dd")} - {format(addDays(currentWeekStart, 6), "MMM dd, yyyy")}
                  </span>
                  <Button variant="outline" size="sm" onClick={goToNextWeek}>
                    Next Week
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>

                {/* Slot Grid */}
                <div className="overflow-x-auto">
                  <div className="min-w-[800px]">
                    {/* Header with days */}
                    <div className="grid grid-cols-8 gap-2 mb-2">
                      <div className="font-semibold text-sm p-2">Time</div>
                      {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
                        const day = addDays(currentWeekStart, dayOffset);
                        return (
                          <div key={dayOffset} className="font-semibold text-sm p-2 text-center">
                            <div>{format(day, "EEE")}</div>
                            <div className="text-muted-foreground">{format(day, "MMM dd")}</div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Time slots */}
                    {(() => {
                      const useWeekly = useWeeklySlots();
                      const timeSlots = useWeekly ? getTimeSlotsFromDailySlots() : TIME_SLOTS;
                      const slotsToDisplay = timeSlots.length > 0 ? timeSlots : TIME_SLOTS;
                      const hasSlotsFromApi = (equipmentDetail?.daily_slots?.length ?? 0) > 0;
                      const fetchedButEmpty = !loadingSlots && lastFetchedWeek && !hasSlotsFromApi;

                      if (slotsToDisplay.length === 0) {
                        return (
                          <div className="col-span-8 p-4 text-center text-muted-foreground">
                            <p>No time slots available for this equipment.</p>
                            {equipmentDetail?.daily_slots && equipmentDetail.daily_slots.length > 0 && (
                              <p className="text-xs mt-2">
                                Found {equipmentDetail.daily_slots.length} slots in API response.
                                Try navigating to a different week.
                              </p>
                            )}
                          </div>
                        );
                      }

                      if (fetchedButEmpty) {
                        return (
                          <div className="col-span-8 p-4 text-center text-muted-foreground">
                            <p>No slots available for this week.</p>
                            <p className="text-xs mt-2">Try another week using the buttons above, or contact support if the issue continues.</p>
                          </div>
                        );
                      }
                      
                      return slotsToDisplay.map((time) => (
                      <div key={time} className="grid grid-cols-8 gap-2 mb-2">
                        <div className="text-sm p-2 font-medium flex items-center">
                          {time}
                        </div>
                        {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
                          const day = addDays(currentWeekStart, dayOffset);
                          const isBooked = isSlotBooked(day, time);
                          const isSelected = isSlotSelected(day, time);
                          
                          // Parse time to get hours and minutes
                          const [hours, minutes] = time.split(':').map(Number);
                          const slotDateTime = new Date(day);
                          slotDateTime.setHours(hours, minutes || 0, 0, 0);
                          const isPast = slotDateTime < new Date();
                          
                          // Check if slot exists in daily_slots for this day and time
                          const slotData = useWeeklySlots() ? getSlotData(day, time) : undefined;
                          const slotExists = slotData !== undefined;
                          const isAvailable = slotExists && !isBooked && !isPast;
                          
                          // Get slot status from the actual slot data; prefer booking status if booking exists, else slot status (never empty when slot exists)
                          const slotStatus = slotData?.status ?? "";
                          const isSlotBookedStatus = slotStatus !== "" && slotStatus !== "AVAILABLE";
                          const dateStr = format(day, "yyyy-MM-dd");
                          const holidayName = equipmentDetail?.weekly_holidays?.[dateStr];
                          const bookingStatusDisplay = slotData?.booking_status_display ?? null;
                          const rawSlotStatusLabel = slotData?.status_display || (slotStatus ? slotStatus.charAt(0).toUpperCase() + slotStatus.slice(1).toLowerCase() : "");
                          const slotStatusLabel = slotExists && slotData
                            ? (rawSlotStatusLabel || (slotData.status === "AVAILABLE" ? "Available" : slotData.status === "BOOKED" ? "Booked" : slotData.status === "BLOCKED" ? "Blocked" : "Available"))
                            : rawSlotStatusLabel;
                          const slotDisplayLabel = bookingStatusDisplay || slotStatusLabel;

                          // Enable slot when slot duration >= remaining time (e.g. 60 min slot is fine for 7 min total)
                          const totalMinutes = calculatedCharge?.total_time_minutes ?? 0;
                          const currentSelectedMinutes = calculatedCharge ? getEffectiveSelectedMinutes() : 0;
                          const remainingMinutes = Math.max(0, totalMinutes - currentSelectedMinutes);

                          const thisSlotDuration = slotData?.start_datetime && slotData?.end_datetime
                            ? Math.round((parseISO(slotData.end_datetime).getTime() - parseISO(slotData.start_datetime).getTime()) / (1000 * 60))
                            : (equipmentDetail?.slot_duration_minutes || 60);

                          // Slot is usable if it covers remaining time (duration >= remaining). Count only min(slot, remaining) toward limit.
                          const effectiveDurationIfSelected = Math.min(thisSlotDuration, remainingMinutes);
                          const wouldExceedLimit = calculatedCharge && !isSelected && !isBooked && !isPast && slotExists
                            ? (currentSelectedMinutes + effectiveDurationIfSelected) > totalMinutes
                            : false;

                          const limitReached = calculatedCharge
                            ? currentSelectedMinutes >= calculatedCharge.total_time_minutes
                            : false;
                          
                          // Check if slot is consecutive to selected slots
                          const testSlot: TimeSlot = {
                            date: day,
                            time,
                            isBooked: false,
                            slotId: slotData?.id,
                            slotData: slotData,
                          };
                          const isConsecutive = selectedSlots.length === 0 || isConsecutiveSlot(testSlot, selectedSlots);
                          const notConsecutive = selectedSlots.length > 0 && !isSelected && !isConsecutive;
                          
                          // Disable if charge not calculated
                          const chargeNotCalculated = !calculatedCharge;
                          
                          // Determine the actual status to display: booking status > holiday name > slot status (never N/A)
                          let displayStatus = holidayName || "—";
                          let isDisabled = true;
                          
                          if (slotExists) {
                            if (isSlotBookedStatus || isBooked) {
                              displayStatus = slotDisplayLabel || slotStatusLabel || "Unavailable";
                              isDisabled = true;
                            } else if (isSelected) {
                              displayStatus = "Selected";
                              isDisabled = false; // Allow deselecting
                            } else if (isPast) {
                              displayStatus = "Past";
                              isDisabled = true;
                            } else if (chargeNotCalculated) {
                              displayStatus = slotDisplayLabel || slotStatusLabel || "—";
                              isDisabled = true;
                            } else if (notConsecutive) {
                              displayStatus = "Available";
                              isDisabled = true;
                            } else if (limitReached || wouldExceedLimit) {
                              displayStatus = "Available";
                              isDisabled = true;
                            } else {
                              displayStatus = "Available";
                              isDisabled = false;
                            }
                          } else {
                            displayStatus = holidayName || "—";
                          }

                          return (
                            <button
                              key={dayOffset}
                              onClick={() => {
                                // Double-check disabled state before allowing toggle
                                if (isDisabled) {
                                  if (notConsecutive) {
                                    toast.error("Please select consecutive slots only. You can select slots that are immediately before or after your current selection.");
                                  } else if (limitReached) {
                                    toast.error(`You have reached the maximum allowed time (${calculatedCharge?.total_time_minutes || 0} minutes).`);
                                  } else if (wouldExceedLimit) {
                                    const remaining = getRemainingMinutes();
                                    toast.error(`Cannot select more slots. Only ${remaining} minutes remaining.`);
                                  }
                                  return;
                                }
                                toggleSlot(day, time);
                              }}
                              disabled={isDisabled}
                              className={`
                                p-3 rounded-md text-sm transition-all min-h-[48px] flex items-center justify-center
                                ${!slotExists ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}
                                ${isSlotBookedStatus || isBooked ? 'bg-destructive/20 text-destructive cursor-not-allowed' : ''}
                                ${isPast && !isSlotBookedStatus && !isBooked && slotExists ? 'bg-muted text-muted-foreground cursor-not-allowed' : ''}
                                ${isSelected ? 'bg-primary text-primary-foreground' : ''}
                                ${isAvailable && !isSelected && !isPast && !isDisabled ? 'bg-green-100 hover:bg-green-200 text-green-800 cursor-pointer' : ''}
                                ${isAvailable && !isSelected && !isPast && isDisabled ? 'bg-green-100 text-green-800 cursor-not-allowed opacity-60' : ''}
                              `}
                            >
                              {displayStatus}
                            </button>
                          );
                        })}
                      </div>
                      ));
                    })()}
                  </div>
                </div>

                    {/* Booking Summary */}
                    {selectedSlots.length > 0 && (
                      <div className="mt-6 p-4 bg-muted rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium">Selected Slots: {selectedSlots.length}</span>
                          <span className="text-sm text-muted-foreground">
                            {calculatedCharge ? (
                              <>
                                {getEffectiveSelectedMinutes()} minutes / {calculatedCharge.total_time_minutes} minutes
                              </>
                            ) : (
                              <>Total Hours: {selectedSlots.length}</>
                            )}
                          </span>
                        </div>
                        {calculatedCharge && (
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-muted-foreground">Remaining:</span>
                            <span className={`text-sm font-medium ${getRemainingMinutes() === 0 ? 'text-destructive' : ''}`}>
                              {getRemainingMinutes()} minutes
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Total Cost</span>
                          <span className="text-2xl font-bold">₹{calculateTotalCost().toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="mt-6 flex gap-4">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setSelectedSlots([])}
                        disabled={selectedSlots.length === 0}
                      >
                        Clear Selection
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={handleBooking}
                        disabled={selectedSlots.length === 0}
                      >
                        Confirm Booking ({selectedSlots.length} slot{selectedSlots.length !== 1 ? 's' : ''})
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
      </main>
    </div>
  );
};

export default BookEquipment;