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
  blocked_label?: string | null;
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
  split_booking_enabled?: boolean;
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
  const [userType, setUserType] = useState<string | number | null>(null);
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
  const [autoSlotSelection, setAutoSlotSelection] = useState<boolean>(true);
  const lastCalculatedValuesRef = useRef<string>('');
  const calculationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchingSlotsRef = useRef<boolean>(false);

  useEffect(() => {
    // Get user ID and type from localStorage (set by DashboardHeader) to avoid duplicate API calls
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setUserId(String(user.id));
        setUserType(user.user_type || null);
        // Initialize auto slot selection from user preference, default to true if not set
        setAutoSlotSelection(user.auto_slot_selection !== undefined ? user.auto_slot_selection : true);
        
        // Set initial week based on user type
        const now = new Date();
        const currentWeek = startOfWeek(now, { weekStartsOn: 0 });
        const userTypeValue: any = user.user_type;
        let normalizedType: string | null = null;
        if (typeof userTypeValue === 'string') {
          normalizedType = userTypeValue.toLowerCase();
        } else if (typeof userTypeValue === 'number') {
          normalizedType = userTypeValue === 1 ? 'student' : userTypeValue === 2 ? 'faculty' : null;
        }
        
        if (normalizedType === 'student' || normalizedType === 'faculty') {
          // Students/Faculty: Start with current week
          setCurrentWeekStart(currentWeek);
        } else {
          // Other users: Start with week beginning 15 days from current date
          const fifteenDaysFromNow = addDays(now, 15);
          setCurrentWeekStart(startOfWeek(fifteenDaysFromNow, { weekStartsOn: 0 }));
        }
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

    // Check if current week is allowed for this user
    if (!isWeekAllowed(currentWeekStart)) {
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

    // Check if current week is allowed for this user
    if (!isWeekAllowed(currentWeekStart)) {
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
  }, [showSlots, chargeCalculated, selectedEquipment, currentWeekStart, loadingSlots, lastFetchedWeek, fetchSlotsForWeek, userType]);

  // Auto-select slots when charge is calculated and auto slot selection is enabled
  useEffect(() => {
    // Only auto-select if:
    // 1. Charge is calculated
    // 2. Slots are shown
    // 3. Auto slot selection is enabled (from toggle on page)
    // 4. No slots are currently selected
    // 5. Equipment detail and daily slots are loaded (and not empty)
    // 6. Not currently loading slots
    if (!chargeCalculated || !showSlots || !autoSlotSelection || selectedSlots.length > 0 || 
        !equipmentDetail || !equipmentDetail.daily_slots || equipmentDetail.daily_slots.length === 0 || 
        loadingSlots || !calculatedCharge) {
      return;
    }
    

    const requiredMinutes = calculatedCharge.total_time_minutes;
    const slotDuration = equipmentDetail.slot_duration_minutes || 60;
    const oneSlot = slotDuration;
    const tenPercentSlot = 0.1 * oneSlot;

    // If required time <= one slot, select only one slot
    if (requiredMinutes <= oneSlot) {
      // Find the first available slot
      const availableSlot = equipmentDetail.daily_slots.find(slot => {
        if (slot.status !== "AVAILABLE") return false;
        const slotDate = startOfDay(parseISO(slot.date));
        const slotTime = format(parseISO(slot.start_datetime), "HH:mm");
        const slotDateTime = new Date(slotDate);
        const [hours, minutes] = slotTime.split(':').map(Number);
        slotDateTime.setHours(hours, minutes || 0, 0, 0);
        return slotDateTime >= new Date() && !isSlotBooked(slotDate, slotTime);
      });

      if (availableSlot) {
        const slotDate = startOfDay(parseISO(availableSlot.date));
        const slotTime = format(parseISO(availableSlot.start_datetime), "HH:mm");
        const slot: TimeSlot = {
          date: slotDate,
          time: slotTime,
          isBooked: false,
          slotId: availableSlot.id,
          slotData: availableSlot,
        };
        setSelectedSlots([slot]);
      }
      return;
    }

    // For required time > one slot, find consecutive slots
    // Calculate minimum number of slots needed to cover required time
    const minSlotsNeeded = Math.ceil(requiredMinutes / oneSlot);
    const minTimeNeeded = minSlotsNeeded * oneSlot;
    
    // Find an available slot that has enough consecutive slots following it
    // We need to find a starting slot that can form a chain of at least minSlotsNeeded consecutive slots
    let bestStartingSlot: TimeSlot | null = null;
    let bestSlotChain: TimeSlot[] = [];
    let bestTotalMinutes = 0;
    
    // Try each available slot as a potential starting point
    for (const slot of equipmentDetail.daily_slots) {
      if (slot.status !== "AVAILABLE") continue;
      const slotDate = startOfDay(parseISO(slot.date));
      const slotTime = format(parseISO(slot.start_datetime), "HH:mm");
      const slotDateTime = new Date(slotDate);
      const [hours, minutes] = slotTime.split(':').map(Number);
      slotDateTime.setHours(hours, minutes || 0, 0, 0);
      
      if (slotDateTime < new Date() || isSlotBooked(slotDate, slotTime)) continue;
      
      // Try building consecutive slots from this starting slot
      const testSlot: TimeSlot = {
        date: slotDate,
        time: slotTime,
        isBooked: false,
        slotId: slot.id,
        slotData: slot,
      };
      
      const chain: TimeSlot[] = [testSlot];
      let currentSlot = testSlot;
      let chainTotalMinutes = getSlotDurationMinutes(currentSlot);
      
      // Build consecutive chain from this slot
      // Continue until we can't find more consecutive slots OR we've covered the required time
      while (true) {
        // If we've covered the required time, we can stop
        if (chainTotalMinutes >= requiredMinutes - tenPercentSlot && chain.length >= minSlotsNeeded) {
          break;
        }
        
        const nextSlot = findNextConsecutiveSlot([currentSlot]);
        if (!nextSlot) {
          break; // No more consecutive slots
        }
        chain.push(nextSlot);
        chainTotalMinutes += getSlotDurationMinutes(nextSlot);
        currentSlot = nextSlot;
      }
      
      // Check if this chain is better than what we have
      const hasEnough = chain.length >= minSlotsNeeded || chainTotalMinutes >= requiredMinutes - tenPercentSlot;
      
      // Keep the best chain (prefer chains that have enough, but also keep the longest chain even if it doesn't have enough)
      if (hasEnough) {
        // This chain has enough slots - use it if it's better than what we have
        if (!bestStartingSlot || chain.length > bestSlotChain.length || 
            (chain.length === bestSlotChain.length && chainTotalMinutes > bestTotalMinutes)) {
          bestStartingSlot = testSlot;
          bestSlotChain = chain;
          bestTotalMinutes = chainTotalMinutes;
          // If we found a perfect match, use it immediately
          if (chain.length >= minSlotsNeeded && chainTotalMinutes >= requiredMinutes - tenPercentSlot) {
            break;
          }
        }
      } else {
        // This chain doesn't have enough, but keep it if it's the longest we've found so far
        if (!bestStartingSlot || chain.length > bestSlotChain.length) {
          bestStartingSlot = testSlot;
          bestSlotChain = chain;
          bestTotalMinutes = chainTotalMinutes;
        }
      }
    }

    if (!bestStartingSlot || bestSlotChain.length === 0) {
      
      // If split booking is enabled, try random slots
      if (equipmentDetail.split_booking_enabled) {
        const randomSlots = findRandomAvailableSlots(requiredMinutes, []);
        if (randomSlots.length > 0) {
          setSelectedSlots(randomSlots);
          return;
        }
      }
      
      // No slots found - show message to user
      toast.warning(
        `Unable to auto-select slots. Required time is ${requiredMinutes} minutes (${Math.ceil(requiredMinutes / oneSlot)} slots), but no consecutive slots are available. ` +
        `Please reduce the number of samples/inputs.`
      );
      return;
    }

    const autoSelectedSlots = bestSlotChain;
    const totalMinutes = bestTotalMinutes;

    // Check if we have enough consecutive slots
    // We have enough if:
    // 1. We have at least minSlotsNeeded slots (which should cover required time), OR
    // 2. Total minutes covers required time (within 10% variance)
    const hasEnoughConsecutiveSlots = autoSelectedSlots.length >= minSlotsNeeded || 
                                      totalMinutes >= requiredMinutes - tenPercentSlot;

    if (hasEnoughConsecutiveSlots && autoSelectedSlots.length > 0) {
      // We found enough consecutive slots, use them
      setSelectedSlots(autoSelectedSlots);
    } else if (equipmentDetail.split_booking_enabled) {
      // Consecutive slots not available, but split booking is enabled
      // Try to find random available slots
      const randomSlots = findRandomAvailableSlots(requiredMinutes, []);
      if (randomSlots.length > 0) {
        // Use random slots if found
        setSelectedSlots(randomSlots);
      } else {
        // No random slots available either
        toast.warning(
          `Unable to auto-select slots. Required time is ${requiredMinutes} minutes (${Math.ceil(requiredMinutes / oneSlot)} slots), but no available slots found. ` +
          `Please reduce the number of samples/inputs.`
        );
      }
    } else {
      // Consecutive slots not available and split booking is disabled
      // Only consecutive slots are allowed, so don't auto-select anything
      // Show message to user suggesting to reduce inputs
      const foundSlots = autoSelectedSlots.length;
      const foundMinutes = totalMinutes;
      const slotsShort = minSlotsNeeded - foundSlots;
      const minutesShort = requiredMinutes - foundMinutes;
      
      toast.warning(
        `Unable to auto-select enough consecutive slots. ` +
        `Required: ${requiredMinutes} minutes (${minSlotsNeeded} slots), ` +
        `Found: ${foundMinutes} minutes (${foundSlots} slots). ` +
        `Please reduce the number of samples/inputs to reduce the required time.`
      );
    }
  }, [chargeCalculated, showSlots, autoSlotSelection, selectedSlots.length, equipmentDetail, calculatedCharge, loadingSlots]);

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
    setUserType(userResponse.data.user_type || null);
    // Initialize auto slot selection from user preference, default to true if not set
    setAutoSlotSelection(userResponse.data.auto_slot_selection !== undefined ? userResponse.data.auto_slot_selection : true);
    
    // Set initial week based on user type
    const now = new Date();
    const currentWeek = startOfWeek(now, { weekStartsOn: 0 });
    const userTypeValue: any = userResponse.data.user_type;
    let normalizedType: string | null = null;
    if (typeof userTypeValue === 'string') {
      normalizedType = userTypeValue.toLowerCase();
    } else if (typeof userTypeValue === 'number') {
      normalizedType = userTypeValue === 1 ? 'student' : userTypeValue === 2 ? 'faculty' : null;
    }
    
    if (normalizedType === 'student' || normalizedType === 'faculty') {
      // Students/Faculty: Start with current week
      setCurrentWeekStart(currentWeek);
    } else {
      // Other users: Start with week beginning 15 days from current date
      const fifteenDaysFromNow = addDays(now, 15);
      setCurrentWeekStart(startOfWeek(fifteenDaysFromNow, { weekStartsOn: 0 }));
    }
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

  // Get representative slot duration (from first selected slot, or equipment default)
  const getOneSlotDurationMinutes = (slotOrNull?: TimeSlot | null): number => {
    if (slotOrNull?.slotData?.start_datetime && slotOrNull.slotData?.end_datetime) {
      try {
        const start = parseISO(slotOrNull.slotData.start_datetime);
        const end = parseISO(slotOrNull.slotData.end_datetime);
        return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
      } catch {
        // fall through to equipment
      }
    }
    if (selectedSlots.length > 0) {
      const d = getSlotDurationMinutes(selectedSlots[0]);
      if (d > 0) return d;
    }
    return equipmentDetail?.slot_duration_minutes || 60;
  };

  // Check if current selection is valid for booking per business rules:
  // a) Required <= one slot → exactly one slot allowed.
  // b) Required > one slot → multiple slots until required covered.
  // c) Remaining time < 10% of one slot → allow booking (partial tail).
  // d) If remaining time > 10% of one slot, allow minimum slots needed even if exceeds by more than 10%.
  const isSelectionValidForBooking = (): boolean => {
    if (!calculatedCharge || selectedSlots.length === 0) return false;
    const required = calculatedCharge.total_time_minutes;
    const selected = getTotalSelectedMinutes();
    const oneSlot = getOneSlotDurationMinutes(selectedSlots[0]);
    const tenPercentSlot = 0.1 * oneSlot;
    if (required <= oneSlot) {
      return selectedSlots.length === 1;
    }
    // Check if selection is within 10% variance (ideal case)
    if (selected >= required - tenPercentSlot && selected <= required + tenPercentSlot) {
      return true;
    }
    // If selection exceeds by more than 10%, check if it's the minimum needed to cover required time
    // Calculate minimum number of slots needed to cover required time
    const minSlotsNeeded = Math.ceil(required / oneSlot);
    const minTimeNeeded = minSlotsNeeded * oneSlot;
    // Allow if selected time is the minimum needed to cover required time
    if (selected >= minTimeNeeded && selectedSlots.length === minSlotsNeeded) {
      return true;
    }
    return false;
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

  // Find the next consecutive slot after the last selected slot
  const findNextConsecutiveSlot = (selectedSlots: TimeSlot[]): TimeSlot | null => {
    if (selectedSlots.length === 0 || !equipmentDetail?.daily_slots) return null;
    
    // Sort selected slots by start time
    const sortedSlots = [...selectedSlots].sort((a, b) => {
      if (!a.slotData?.start_datetime || !b.slotData?.start_datetime) return 0;
      return parseISO(a.slotData.start_datetime).getTime() - parseISO(b.slotData.start_datetime).getTime();
    });
    
    const lastSlot = sortedSlots[sortedSlots.length - 1];
    if (!lastSlot.slotData?.end_datetime) return null;
    
    const lastSlotEnd = parseISO(lastSlot.slotData.end_datetime);
    
    // Find the slot that starts exactly when the last slot ends
    const nextSlotData = equipmentDetail.daily_slots.find(slot => {
      if (slot.status !== "AVAILABLE") return false;
      
      const slotStart = parseISO(slot.start_datetime);
      const timeDiff = Math.abs(slotStart.getTime() - lastSlotEnd.getTime());
      
      // Allow a small tolerance (1 second) for time matching to handle potential rounding issues
      if (timeDiff > 1000) return false;
      
      // Also check if slot is not booked
      const slotDate = startOfDay(parseISO(slot.date));
      const slotTime = format(slotStart, "HH:mm");
      return !isSlotBooked(slotDate, slotTime);
    });
    
    if (!nextSlotData) return null;
    
    // Convert to TimeSlot format
    const slotDate = startOfDay(parseISO(nextSlotData.date));
    const slotTime = format(parseISO(nextSlotData.start_datetime), "HH:mm");
    
    return {
      date: slotDate,
      time: slotTime,
      isBooked: false,
      slotId: nextSlotData.id,
      slotData: nextSlotData,
    };
  };

  // Find all required consecutive slots starting from a given slot
  // If consecutive slots aren't available and split booking is enabled, find random slots
  const findAllRequiredConsecutiveSlots = (firstSlot: TimeSlot, requiredMinutes: number): TimeSlot[] => {
    if (!equipmentDetail?.daily_slots || !calculatedCharge) return [firstSlot];
    
    const slotDuration = getSlotDurationMinutes(firstSlot);
    const oneSlot = slotDuration;
    const tenPercentSlot = 0.1 * oneSlot;
    
    // If required time <= one slot, return only the first slot
    if (requiredMinutes <= oneSlot) {
      return [firstSlot];
    }
    
    // Calculate minimum number of slots needed
    const minSlotsNeeded = Math.ceil(requiredMinutes / oneSlot);
    
    // Build consecutive slots starting from the first slot
    const allSlots: TimeSlot[] = [firstSlot];
    let currentSlot = firstSlot;
    let totalMinutes = getSlotDurationMinutes(currentSlot);
    
    // Continue selecting consecutive slots until we've covered the minimum required time
    while (allSlots.length < minSlotsNeeded) {
      const nextSlot = findNextConsecutiveSlot([currentSlot]);
      if (!nextSlot || isSlotBooked(nextSlot.date, nextSlot.time)) {
        // No more consecutive slots available
        break;
      }
      allSlots.push(nextSlot);
      totalMinutes += getSlotDurationMinutes(nextSlot);
      currentSlot = nextSlot;
      
      // If we've covered the required time (within 10% variance), we can stop
      if (totalMinutes >= requiredMinutes - tenPercentSlot) {
        break;
      }
    }
    
    // Check if we have enough consecutive slots
    const hasEnoughConsecutiveSlots = allSlots.length >= minSlotsNeeded && 
                                      totalMinutes >= requiredMinutes - tenPercentSlot;
    
    if (hasEnoughConsecutiveSlots) {
      // We found enough consecutive slots, return them
      return allSlots;
    } else if (equipmentDetail.split_booking_enabled) {
      // Consecutive slots not available, but split booking is enabled
      // Try to find random available slots (including the first slot)
      const randomSlots = findRandomAvailableSlots(requiredMinutes, []);
      if (randomSlots.length > 0) {
        // Use random slots if found
        return randomSlots;
      }
      // If random slots also not available, return what we have (partial consecutive slots)
      return allSlots;
    } else {
      // Consecutive slots not available and split booking is disabled
      // Only consecutive slots are allowed, return what we have (partial consecutive slots)
      // User will need to manually adjust if not enough
      return allSlots;
    }
  };

  // Check if continuous slots are available for the required time starting from a given slot
  const checkContinuousSlotsAvailable = (startSlot: TimeSlot, requiredMinutes: number): boolean => {
    if (!equipmentDetail?.daily_slots || !startSlot.slotData) return false;
    
    let currentSlot = startSlot;
    let totalMinutes = getSlotDurationMinutes(currentSlot);
    
    while (totalMinutes < requiredMinutes) {
      const nextSlot = findNextConsecutiveSlot([currentSlot]);
      if (!nextSlot || isSlotBooked(nextSlot.date, nextSlot.time)) {
        return false; // No more consecutive slots available
      }
      totalMinutes += getSlotDurationMinutes(nextSlot);
      currentSlot = nextSlot;
    }
    
    return true; // Continuous slots are available
  };

  // Find random available slots (non-consecutive) when consecutive slots aren't available
  const findRandomAvailableSlots = (requiredMinutes: number, excludeSlots: TimeSlot[] = []): TimeSlot[] => {
    if (!equipmentDetail?.daily_slots) return [];
    
    const slotDuration = equipmentDetail.slot_duration_minutes || 60;
    const oneSlot = slotDuration;
    const minSlotsNeeded = Math.ceil(requiredMinutes / oneSlot);
    const tenPercentSlot = 0.1 * oneSlot;
    
    // Get all available slots, excluding already selected ones
    const availableSlots: TimeSlot[] = [];
    const excludeSlotIds = new Set(excludeSlots.map(s => s.slotId));
    
    equipmentDetail.daily_slots.forEach(slot => {
      if (slot.status !== "AVAILABLE") return;
      if (excludeSlotIds.has(slot.id)) return;
      
      const slotDate = startOfDay(parseISO(slot.date));
      const slotTime = format(parseISO(slot.start_datetime), "HH:mm");
      const slotDateTime = new Date(slotDate);
      const [hours, minutes] = slotTime.split(':').map(Number);
      slotDateTime.setHours(hours, minutes || 0, 0, 0);
      
      if (slotDateTime >= new Date() && !isSlotBooked(slotDate, slotTime)) {
        availableSlots.push({
          date: slotDate,
          time: slotTime,
          isBooked: false,
          slotId: slot.id,
          slotData: slot,
        });
      }
    });
    
    // Sort by datetime to get a consistent order
    availableSlots.sort((a, b) => {
      if (!a.slotData?.start_datetime || !b.slotData?.start_datetime) return 0;
      return parseISO(a.slotData.start_datetime).getTime() - parseISO(b.slotData.start_datetime).getTime();
    });
    
    // Select slots until we have enough to cover required time
    const selectedSlots: TimeSlot[] = [];
    let totalMinutes = 0;
    
    for (const slot of availableSlots) {
      if (selectedSlots.length >= minSlotsNeeded) break;
      
      selectedSlots.push(slot);
      totalMinutes += getSlotDurationMinutes(slot);
      
      // If we've covered the required time (within 10% variance), we can stop
      if (totalMinutes >= requiredMinutes - tenPercentSlot) {
        break;
      }
    }
    
    // Only return if we have enough slots to cover the required time
    if (selectedSlots.length > 0 && totalMinutes >= requiredMinutes - tenPercentSlot) {
      return selectedSlots;
    }
    
    return [];
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
          // If split booking is NOT enabled, strictly enforce consecutive-only selection
          if (!equipmentDetail?.split_booking_enabled) {
            toast.error("Please select consecutive slots only. You can select slots that are immediately before or after your current selection.");
            return prev; // Return previous state without changes
          }
          
          // Split booking is enabled - allow non-consecutive slots only if continuous slots aren't available
          if (equipmentDetail?.split_booking_enabled && calculatedCharge) {
            const required = calculatedCharge.total_time_minutes;
            const currentSelectedMinutes = prev.reduce((total, s) => total + getSlotDurationMinutes(s), 0);
            const remaining = required - currentSelectedMinutes;
            
            // Check if continuous slots are available from the last selected slot
            const lastSlot = prev[prev.length - 1];
            const continuousAvailable = checkContinuousSlotsAvailable(lastSlot, remaining);
            
            if (continuousAvailable) {
              toast.error("Please select consecutive slots only. Continuous slots are available for your booking.");
              return prev;
            }
            // If continuous slots aren't available, allow non-consecutive selection
          }
        }
        
        // Slot selection rules: (a) required <= one slot → single slot; (b) required > one slot → multiple until covered; (c) allow tail < 10% of one slot
        if (calculatedCharge) {
          const required = calculatedCharge.total_time_minutes;
          const slotDuration = getSlotDurationMinutes(slot);
          const currentSelectedMinutes = prev.reduce((total, s) => total + getSlotDurationMinutes(s), 0);
          const newTotalMinutes = currentSelectedMinutes + slotDuration;
          const oneSlotRef = prev.length > 0 ? getSlotDurationMinutes(prev[0]) : slotDuration;
          const tenPercentSlot = 0.1 * oneSlotRef;

          // (a) If required time <= one slot duration: allow only a single slot
          if (required <= oneSlotRef) {
            if (prev.length >= 1) {
              toast.error(`Only one slot is allowed when required time (${required} min) is within a single slot.`);
              return prev;
            }
            // For single slot requirement, just return the selected slot
            return [...prev, slot];
          }

          // (b) Required > one slot: allow multiple slots until required is covered (with up to 10% tail)
          if (currentSelectedMinutes >= required) {
            toast.error(`You have already covered the required time (${required} minutes).`);
            return prev;
          }
          // Calculate remaining time
          const remaining = Math.max(0, required - currentSelectedMinutes);
          // Allow selecting another slot if remaining time exceeds 10% of one slot
          // If remaining time is within 10% variance, don't allow selecting another slot
          if (remaining <= tenPercentSlot) {
            toast.error(
              `Cannot add this slot. Required time is ${required} minutes; only ${remaining} minutes remaining (within 10% variance).`
            );
            return prev;
          }
          
          // If this is the first slot selection, auto-select ALL required consecutive slots
          if (prev.length === 0) {
            const allRequiredSlots = findAllRequiredConsecutiveSlots(slot, required);
            return allRequiredSlots;
          }
          
          // For subsequent slot selections, just add the selected slot
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

  // Normalize user type to string for comparison
  const normalizeUserType = (type: string | number | null): string | null => {
    if (type === null || type === undefined) return null;
    if (typeof type === 'string') return type.toLowerCase();
    if (typeof type === 'number') {
      // Map common number codes to strings (adjust based on your backend mapping)
      // Common mappings: 1=student, 2=faculty, etc.
      const typeMap: Record<number, string> = {
        1: 'student',
        2: 'faculty',
        // Add other mappings as needed
      };
      return typeMap[type] || String(type);
    }
    return null;
  };

  // Check if a week is allowed for the current user
  const isWeekAllowed = (weekStart: Date): boolean => {
    if (!userType) return false;
    
    const normalizedType = normalizeUserType(userType);
    if (!normalizedType) return false;
    
    const now = new Date();
    const currentWeek = startOfWeek(now, { weekStartsOn: 0 });
    const nextWeek = addWeeks(currentWeek, 1);
    
    // For other users: 15 days from current date, then one week window
    const fifteenDaysFromNow = addDays(now, 15);
    const allowedWeekStart = startOfWeek(fifteenDaysFromNow, { weekStartsOn: 0 });
    
    // Normalize week starts for comparison
    const weekStartNormalized = startOfWeek(weekStart, { weekStartsOn: 0 });
    const currentWeekNormalized = startOfWeek(currentWeek, { weekStartsOn: 0 });
    const nextWeekNormalized = startOfWeek(nextWeek, { weekStartsOn: 0 });
    const allowedWeekStartNormalized = startOfWeek(allowedWeekStart, { weekStartsOn: 0 });
    
    if (normalizedType === 'student' || normalizedType === 'faculty') {
      // Students/Faculty: Can select current week OR next week only
      return (
        weekStartNormalized.getTime() === currentWeekNormalized.getTime() ||
        weekStartNormalized.getTime() === nextWeekNormalized.getTime()
      );
    } else {
      // Other users: Can select one week window starting 15 days from current date
      return weekStartNormalized.getTime() === allowedWeekStartNormalized.getTime();
    }
  };

  // Get allowed weeks for navigation
  const getAllowedWeeks = (): Date[] => {
    if (!userType) return [];
    
    const normalizedType = normalizeUserType(userType);
    if (!normalizedType) return [];
    
    const now = new Date();
    const currentWeek = startOfWeek(now, { weekStartsOn: 0 });
    const nextWeek = addWeeks(currentWeek, 1);
    
    // For other users: 15 days from current date, then one week window
    const fifteenDaysFromNow = addDays(now, 15);
    const allowedWeekStart = startOfWeek(fifteenDaysFromNow, { weekStartsOn: 0 });
    
    if (normalizedType === 'student' || normalizedType === 'faculty') {
      // Students/Faculty: Current week and next week
      return [currentWeek, nextWeek];
    } else {
      // Other users: One week window starting 15 days from current date
      return [allowedWeekStart];
    }
  };

  const goToPreviousWeek = () => {
    const allowedWeeks = getAllowedWeeks();
    const currentIndex = allowedWeeks.findIndex(week => 
      startOfWeek(week, { weekStartsOn: 0 }).getTime() === startOfWeek(currentWeekStart, { weekStartsOn: 0 }).getTime()
    );
    
    if (currentIndex > 0) {
      setCurrentWeekStart(allowedWeeks[currentIndex - 1]);
      setSelectedSlots([]);
    }
  };

  const goToNextWeek = () => {
    const allowedWeeks = getAllowedWeeks();
    const currentIndex = allowedWeeks.findIndex(week => 
      startOfWeek(week, { weekStartsOn: 0 }).getTime() === startOfWeek(currentWeekStart, { weekStartsOn: 0 }).getTime()
    );
    
    if (currentIndex < allowedWeeks.length - 1) {
      setCurrentWeekStart(allowedWeeks[currentIndex + 1]);
      setSelectedSlots([]);
    }
  };

  const canGoToPreviousWeek = (): boolean => {
    const allowedWeeks = getAllowedWeeks();
    const currentIndex = allowedWeeks.findIndex(week => 
      startOfWeek(week, { weekStartsOn: 0 }).getTime() === startOfWeek(currentWeekStart, { weekStartsOn: 0 }).getTime()
    );
    return currentIndex > 0;
  };

  const canGoToNextWeek = (): boolean => {
    const allowedWeeks = getAllowedWeeks();
    const currentIndex = allowedWeeks.findIndex(week => 
      startOfWeek(week, { weekStartsOn: 0 }).getTime() === startOfWeek(currentWeekStart, { weekStartsOn: 0 }).getTime()
    );
    return currentIndex < allowedWeeks.length - 1;
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

    // Validate selection per business rules (single slot when required <= one slot; multiple until covered; 10% tail allowed)
    if (calculatedCharge && !isSelectionValidForBooking()) {
      const required = calculatedCharge.total_time_minutes;
      const selected = getTotalSelectedMinutes();
      const oneSlot = getOneSlotDurationMinutes(selectedSlots[0]);
      if (required <= oneSlot && selectedSlots.length !== 1) {
        toast.error("Please select exactly one slot when required time is within a single slot.");
      } else {
        toast.error(
          `Selection does not match required time (${required} minutes). ` +
          `Selected: ${selected} minutes. Select slots that cover the required time (within 10% of one slot).`
        );
      }
      return;
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
                      {Number(selectedEquipment.internalRate) > 0 && (
                        <>₹{Number(selectedEquipment.internalRate).toFixed(2)}/hour</>
                      )}
                      {equipmentDetail?.slot_duration_minutes && (
                        <>
                          {Number(selectedEquipment.internalRate) > 0 && ' • '}
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
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Step 3: Select Time Slots</h3>
                        <div className="flex items-center gap-3">
                          <Label htmlFor="auto-slot-selection" className="text-sm font-normal cursor-pointer">
                            Auto-select all required slots
                          </Label>
                          <Switch
                            id="auto-slot-selection"
                            checked={autoSlotSelection}
                            onCheckedChange={(checked) => {
                              setAutoSlotSelection(checked);
                              // If enabling auto selection and no slots are selected, trigger auto-selection
                              if (checked && selectedSlots.length === 0 && calculatedCharge && equipmentDetail?.daily_slots) {
                                // This will be handled by the useEffect that watches autoSlotSelection
                              }
                            }}
                          />
                        </div>
                      </div>
                      {autoSlotSelection && (
                        <p className="text-sm text-muted-foreground mb-2">
                          When enabled, the system will automatically select all required consecutive slots. 
                          {equipmentDetail?.split_booking_enabled 
                            ? " If consecutive slots aren't available, random slots will be selected."
                            : " Only consecutive slots will be selected (non-consecutive selection is not allowed)."}
                        </p>
                      )}
                    </div>

                {/* Show loading while slots are being fetched (avoids grid full of disabled cells) */}
                {loadingSlots && (!equipmentDetail?.daily_slots || equipmentDetail.daily_slots.length === 0) && (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <span className="animate-pulse">Loading slots for this week…</span>
                  </div>
                )}

                {/* Week Navigation */}
                <div className="flex justify-between items-center mb-6">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={goToPreviousWeek}
                    disabled={!canGoToPreviousWeek()}
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Previous Week
                  </Button>
                  <div className="text-center">
                    <span className="font-semibold">
                      {format(currentWeekStart, "MMM dd")} - {format(addDays(currentWeekStart, 6), "MMM dd, yyyy")}
                    </span>
                    {userType && (normalizeUserType(userType) === 'student' || normalizeUserType(userType) === 'faculty') && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Available: Current week and next week only
                      </p>
                    )}
                    {userType && normalizeUserType(userType) !== 'student' && normalizeUserType(userType) !== 'faculty' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Available: One week window starting 15 days from today
                      </p>
                    )}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={goToNextWeek}
                    disabled={!canGoToNextWeek()}
                  >
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
                          const bookingId = slotData?.booking_id ?? null;
                          const blockedLabel = slotData?.blocked_label ?? null;
                          
                          // Build status label with special handling for BLOCKED and BOOKED
                          let rawSlotStatusLabel = slotData?.status_display || "";
                          if (!rawSlotStatusLabel && slotStatus) {
                            const statusMap: Record<string, string> = {
                              "AVAILABLE": "Available",
                              "BOOKED": "Booked",
                              "BLOCKED": "Blocked",
                              "UNDER_MAINTENANCE": "Under Maintenance",
                              "OPERATOR_ABSENT": "Operator Absent"
                            };
                            rawSlotStatusLabel = statusMap[slotStatus] || slotStatus.charAt(0).toUpperCase() + slotStatus.slice(1).toLowerCase();
                          }
                          
                          // For BOOKED status, append booking ID if available
                          let slotStatusLabel = rawSlotStatusLabel;
                          if (slotStatus === "BOOKED" && bookingId) {
                            slotStatusLabel = `${rawSlotStatusLabel} #${bookingId}`;
                          }
                          
                          // For BLOCKED status, use blocked_label if available, otherwise show "Blocked"
                          if (slotStatus === "BLOCKED") {
                            slotStatusLabel = blockedLabel || "Blocked";
                          }
                          
                          const slotDisplayLabel = bookingStatusDisplay || slotStatusLabel;

                          // Slot selection rules: (a) required <= one slot → single slot; (b) required > one slot → multiple until covered; (c) 10% tail allowed
                          const totalMinutes = calculatedCharge?.total_time_minutes ?? 0;
                          const currentSelectedMinutes = calculatedCharge
                            ? selectedSlots.reduce((sum, s) => sum + getSlotDurationMinutes(s), 0)
                            : 0;
                          const thisSlotDuration = slotData?.start_datetime && slotData?.end_datetime
                            ? Math.round((parseISO(slotData.end_datetime).getTime() - parseISO(slotData.start_datetime).getTime()) / (1000 * 60))
                            : (equipmentDetail?.slot_duration_minutes || 60);
                          const oneSlotRef = selectedSlots.length > 0 ? getSlotDurationMinutes(selectedSlots[0]) : thisSlotDuration;
                          const tenPercentSlot = 0.1 * oneSlotRef;

                          const limitReached = calculatedCharge
                            ? (totalMinutes <= oneSlotRef ? selectedSlots.length >= 1 : currentSelectedMinutes >= totalMinutes)
                            : false;
                          // Calculate remaining time to determine if we should allow another slot
                          const remainingMinutes = calculatedCharge 
                            ? Math.max(0, totalMinutes - currentSelectedMinutes)
                            : 0;
                          // Allow selecting another slot if remaining time exceeds 10% of one slot
                          const shouldAllowSlot = calculatedCharge && totalMinutes > oneSlotRef
                            ? remainingMinutes > tenPercentSlot
                            : false;
                          const wouldExceedLimit = calculatedCharge && !isSelected && !isBooked && !isPast && slotExists
                            ? (totalMinutes <= oneSlotRef)
                              ? selectedSlots.length >= 1
                              : !shouldAllowSlot // Disable if remaining time is within 10% variance
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
                          // If slot exists on holiday/Saturday/Sunday and has booking, show BOOKED status
                          let displayStatus = holidayName || "—";
                          let isDisabled = true;
                          
                          if (slotExists) {
                            // Priority: Show booking status if slot has booking (even on holidays/Saturday/Sunday)
                            if (isSlotBookedStatus || isBooked || bookingId) {
                              displayStatus = slotDisplayLabel || slotStatusLabel || "Unavailable";
                              isDisabled = true;
                            } else if (isSelected) {
                              displayStatus = "Selected";
                              isDisabled = false; // Allow deselecting
                            } else if (isPast) {
                              displayStatus = slotDisplayLabel || slotStatusLabel || "Available";
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
                          <span className="text-2xl font-bold">
                            ₹{calculatedCharge ? Number(calculatedCharge.total_charge).toFixed(2) : calculateTotalCost().toFixed(2)}
                          </span>
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