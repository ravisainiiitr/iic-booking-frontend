import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Play } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

interface Equipment {
  id: string;
  name: string;
  description: string;
  image_url: string;
  video_url: string | null;
  rate_per_hour: number;
  available: boolean;
}

const bookingSchema = z.object({
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
}).refine(
  (data) => new Date(data.endTime) > new Date(data.startTime),
  { message: "End time must be after start time", path: ["endTime"] }
);

const BookEquipment = () => {
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [totalCost, setTotalCost] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
    fetchEquipment();
  }, []);

  useEffect(() => {
    if (startTime && endTime && selectedEquipment) {
      calculateCost();
    }
  }, [startTime, endTime, selectedEquipment]);

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

  const calculateCost = () => {
    if (!selectedEquipment || !startTime || !endTime) return;

    const start = new Date(startTime);
    const end = new Date(endTime);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    
    if (hours > 0) {
      setTotalCost(hours * Number(selectedEquipment.rate_per_hour));
    }
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validated = bookingSchema.parse({ startTime, endTime });
      
      if (!userId || !selectedEquipment) {
        toast.error("Please select equipment and ensure you're logged in");
        return;
      }

      const start = new Date(validated.startTime);
      const end = new Date(validated.endTime);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

      const { error } = await supabase.from("bookings").insert({
        user_id: userId,
        equipment_id: selectedEquipment.id,
        start_time: validated.startTime,
        end_time: validated.endTime,
        total_hours: hours,
        total_cost: totalCost,
        status: "pending",
      });

      if (error) throw error;

      toast.success("Booking created successfully!");
      navigate("/my-bookings");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || "Failed to create booking");
      }
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
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Book {selectedEquipment.name}</CardTitle>
              <CardDescription>
                ${Number(selectedEquipment.rate_per_hour).toFixed(2)}/hour
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBooking} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="start-time">Start Time</Label>
                  <Input
                    id="start-time"
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-time">End Time</Label>
                  <Input
                    id="end-time"
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </div>
                {totalCost > 0 && (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Cost</p>
                    <p className="text-2xl font-bold">${totalCost.toFixed(2)}</p>
                  </div>
                )}
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setSelectedEquipment(null)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1">
                    Confirm Booking
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default BookEquipment;