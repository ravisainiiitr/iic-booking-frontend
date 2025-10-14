import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Play, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { format, addDays, startOfWeek, addWeeks, isSameDay } from "date-fns";

interface Equipment {
  id: string;
  name: string;
  description: string;
  image_url: string;
  video_url: string | null;
  rate_per_hour: number;
  available: boolean;
}

// Time slots from 9:00 AM to 5:30 PM (1-hour slots)
const TIME_SLOTS = [
  "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"
];

interface TimeSlot {
  date: Date;
  time: string;
  isBooked: boolean;
}

const BookEquipment = () => {
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  const [bookedSlots, setBookedSlots] = useState<TimeSlot[]>([]);

  useEffect(() => {
    checkAuth();
    fetchEquipment();
  }, []);

  useEffect(() => {
    if (selectedEquipment) {
      fetchBookedSlots();
    }
  }, [selectedEquipment, currentWeekStart]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    } else {
      setUserId(session.user.id);
    }
  };

  const fetchEquipment = async () => {
    const { data, error } = await supabase
      .from("equipment")
      .select("*")
      .eq("available", true);

    if (!error && data) {
      setEquipment(data);
    }
    setLoading(false);
  };

  const fetchBookedSlots = async () => {
    if (!selectedEquipment) return;

    const weekEnd = addDays(currentWeekStart, 7);
    
    const { data, error } = await supabase
      .from("bookings")
      .select("start_time, end_time")
      .eq("equipment_id", selectedEquipment.id)
      .gte("start_time", currentWeekStart.toISOString())
      .lt("start_time", weekEnd.toISOString());

    if (!error && data) {
      const slots: TimeSlot[] = [];
      data.forEach((booking) => {
        const start = new Date(booking.start_time);
        const end = new Date(booking.end_time);
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        
        for (let i = 0; i < hours; i++) {
          const slotDate = new Date(start.getTime() + i * 60 * 60 * 1000);
          slots.push({
            date: slotDate,
            time: format(slotDate, "HH:mm"),
            isBooked: true
          });
        }
      });
      setBookedSlots(slots);
    }
  };

  const isSlotBooked = (date: Date, time: string): boolean => {
    return bookedSlots.some(slot => 
      isSameDay(slot.date, date) && slot.time === time
    );
  };

  const isSlotSelected = (date: Date, time: string): boolean => {
    return selectedSlots.some(slot => 
      isSameDay(slot.date, date) && slot.time === time
    );
  };

  const toggleSlot = (date: Date, time: string) => {
    if (isSlotBooked(date, time)) return;

    const slot: TimeSlot = { date, time, isBooked: false };
    
    if (isSlotSelected(date, time)) {
      setSelectedSlots(prev => prev.filter(s => 
        !(isSameDay(s.date, date) && s.time === time)
      ));
    } else {
      setSelectedSlots(prev => [...prev, slot]);
    }
  };

  const calculateTotalCost = (): number => {
    if (!selectedEquipment) return 0;
    return selectedSlots.length * Number(selectedEquipment.rate_per_hour);
  };

  const goToPreviousWeek = () => {
    setCurrentWeekStart(addWeeks(currentWeekStart, -1));
    setSelectedSlots([]);
  };

  const goToNextWeek = () => {
    setCurrentWeekStart(addWeeks(currentWeekStart, 1));
    setSelectedSlots([]);
  };

  const handleBooking = async () => {
    if (!userId || !selectedEquipment || selectedSlots.length === 0) {
      toast.error("Please select at least one time slot");
      return;
    }

    try {
      // Sort slots by date and time
      const sortedSlots = [...selectedSlots].sort((a, b) => a.date.getTime() - b.date.getTime());
      
      // Group consecutive slots into bookings
      const bookings: Array<{start: Date, end: Date}> = [];
      let currentBooking: {start: Date, end: Date} | null = null;

      sortedSlots.forEach((slot, index) => {
        const slotDateTime = new Date(slot.date);
        const [hours, minutes] = slot.time.split(':');
        slotDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        if (!currentBooking) {
          currentBooking = {
            start: slotDateTime,
            end: new Date(slotDateTime.getTime() + 60 * 60 * 1000)
          };
        } else {
          // Check if this slot is consecutive
          if (slotDateTime.getTime() === currentBooking.end.getTime()) {
            currentBooking.end = new Date(slotDateTime.getTime() + 60 * 60 * 1000);
          } else {
            bookings.push(currentBooking);
            currentBooking = {
              start: slotDateTime,
              end: new Date(slotDateTime.getTime() + 60 * 60 * 1000)
            };
          }
        }

        if (index === sortedSlots.length - 1 && currentBooking) {
          bookings.push(currentBooking);
        }
      });

      // Insert all bookings
      const insertPromises = bookings.map(booking => {
        const hours = (booking.end.getTime() - booking.start.getTime()) / (1000 * 60 * 60);
        return supabase.from("bookings").insert({
          user_id: userId,
          equipment_id: selectedEquipment.id,
          start_time: booking.start.toISOString(),
          end_time: booking.end.toISOString(),
          total_hours: hours,
          total_cost: hours * Number(selectedEquipment.rate_per_hour),
          status: "pending",
        });
      });

      const results = await Promise.all(insertPromises);
      const errors = results.filter(r => r.error);

      if (errors.length > 0) {
        throw new Error("Failed to create some bookings");
      }

      toast.success(`${bookings.length} booking(s) created successfully!`);
      navigate("/my-bookings");
    } catch (error: any) {
      toast.error(error.message || "Failed to create booking");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Book Equipment</h1>

        {!selectedEquipment ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {equipment.map((item) => (
              <Card key={item.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="relative aspect-video mb-4 rounded-lg overflow-hidden bg-muted">
                    {playingVideo === item.id && item.video_url ? (
                      <video
                        src={item.video_url}
                        controls
                        autoPlay
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <>
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                        {item.video_url && (
                          <button
                            onClick={() => setPlayingVideo(item.id)}
                            className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors group"
                          >
                            <Play className="h-16 w-16 text-white group-hover:scale-110 transition-transform" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  <CardTitle>{item.name}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                  <div className="text-lg font-semibold text-primary mt-2">
                    ${Number(item.rate_per_hour).toFixed(2)}/hour
                  </div>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full"
                    onClick={() => setSelectedEquipment(item)}
                  >
                    Select Equipment
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Book {selectedEquipment.name}</CardTitle>
                    <CardDescription>
                      ${Number(selectedEquipment.rate_per_hour).toFixed(2)}/hour - Select your preferred time slots
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedEquipment(null);
                      setSelectedSlots([]);
                    }}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
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
                    {TIME_SLOTS.map((time) => (
                      <div key={time} className="grid grid-cols-8 gap-2 mb-2">
                        <div className="text-sm p-2 font-medium flex items-center">
                          {time}
                        </div>
                        {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
                          const day = addDays(currentWeekStart, dayOffset);
                          const isBooked = isSlotBooked(day, time);
                          const isSelected = isSlotSelected(day, time);
                          const slotDateTime = new Date(day);
                          slotDateTime.setHours(parseInt(time.split(':')[0]), 0, 0, 0);
                          const isPast = slotDateTime < new Date();

                          return (
                            <button
                              key={dayOffset}
                              onClick={() => toggleSlot(day, time)}
                              disabled={isBooked || isPast}
                              className={`
                                p-3 rounded-md text-sm transition-all
                                ${isBooked ? 'bg-destructive/20 text-destructive cursor-not-allowed' : ''}
                                ${isPast && !isBooked ? 'bg-muted text-muted-foreground cursor-not-allowed' : ''}
                                ${isSelected ? 'bg-primary text-primary-foreground' : ''}
                                ${!isBooked && !isPast && !isSelected ? 'bg-muted hover:bg-accent' : ''}
                              `}
                            >
                              {isBooked ? 'Booked' : isSelected ? 'Selected' : isPast ? 'Past' : 'Available'}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Booking Summary */}
                {selectedSlots.length > 0 && (
                  <div className="mt-6 p-4 bg-muted rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Selected Slots: {selectedSlots.length}</span>
                      <span className="text-sm text-muted-foreground">
                        Total Hours: {selectedSlots.length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Cost</span>
                      <span className="text-2xl font-bold">${calculateTotalCost().toFixed(2)}</span>
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
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default BookEquipment;