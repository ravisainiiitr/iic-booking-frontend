import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Play } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { toast } from "sonner";
import { type EquipmentData } from "@/data/equipmentData";

interface Equipment extends EquipmentData {}

interface ApiEquipment {
  equipment_id: number;
  code: string;
  name: string;
  profile_type: string;
  profile_type_display: string;
  status: string;
  status_display: string;
  location: string;
  image_url: string;
  category_name?: string | null;
  created_at: string;
  updated_at: string;
}

const EquipmentList = () => {
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
    fetchEquipment();
  }, []);

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
  };

  const fetchEquipment = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getEquipments();
      
      if (response.error) {
        toast.error(response.error || "Failed to load equipment");
        setLoading(false);
        return;
      }

      if (!response.data || !response.data.equipments || response.data.equipments.length === 0) {
        toast.info("No equipment available");
        setEquipment([]);
        setLoading(false);
        return;
      }

      // Transform API response to match EquipmentData interface
      const transformedEquipment: Equipment[] = response.data.equipments
        .filter((eq: ApiEquipment) => eq.status === "ACTIVE") // Only show active equipment
        .map((eq: ApiEquipment) => ({
          id: eq.equipment_id,
          name: eq.name,
          category: eq.category_name || "",
          description: eq.name,
          image: eq.image_url || "/placeholder.svg",
          video: "", // API doesn't provide video_url
          available: eq.status === "ACTIVE",
          address: eq.location || "",
          technicalPerson: "", // API doesn't provide this
          contactNumber: "", // API doesn't provide this
          internalRate: 0, // API doesn't provide rate in this endpoint
          externalRate: 0, // API doesn't provide rate in this endpoint
        }));

      setEquipment(transformedEquipment);
    } catch (error: any) {
      toast.error(error.message || "Failed to load equipment");
      setEquipment([]);
    } finally {
      setLoading(false);
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
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Browse Equipment</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {equipment.map((item) => (
            <Card 
              key={item.id} 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/equipment/${item.id}`)}
            >
              <CardHeader>
                <div className="relative aspect-video mb-4 rounded-lg overflow-hidden bg-muted">
                  {playingVideo === item.id.toString() && item.video ? (
                    <video
                      src={item.video}
                      controls
                      autoPlay
                      className="w-full h-full object-cover"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                   <>
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                      {item.video && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPlayingVideo(item.id.toString());
                          }}
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
                {Number(item.internalRate) > 0 && (
                  <div className="text-lg font-semibold text-primary mt-2">
                    ₹{Number(item.internalRate).toFixed(2)}/hour
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/equipment/${item.id}`);
                  }}
                >
                  View Details
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

export default EquipmentList;
