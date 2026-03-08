import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, ArrowLeft, Package, Loader2, Search, CalendarClock } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { toast } from "sonner";
import { type EquipmentData } from "@/data/equipmentData";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Equipment extends EquipmentData {
  status?: string;
}

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

// Gradient accent colors for card variety (cycle by index)
const CARD_ACCENTS = [
  { gradient: "from-indigo-500 to-blue-600", bar: "from-indigo-500 to-blue-500", button: "bg-indigo-600 hover:bg-indigo-700", border: "hover:border-indigo-200 dark:hover:border-indigo-800" },
  { gradient: "from-emerald-500 to-teal-600", bar: "from-emerald-500 to-teal-500", button: "bg-emerald-600 hover:bg-emerald-700", border: "hover:border-emerald-200 dark:hover:border-emerald-800" },
  { gradient: "from-violet-500 to-purple-600", bar: "from-violet-500 to-purple-500", button: "bg-violet-600 hover:bg-violet-700", border: "hover:border-violet-200 dark:hover:border-violet-800" },
  { gradient: "from-amber-500 to-orange-600", bar: "from-amber-500 to-orange-500", button: "bg-amber-600 hover:bg-amber-700", border: "hover:border-amber-200 dark:hover:border-amber-800" },
  { gradient: "from-sky-500 to-blue-600", bar: "from-sky-500 to-blue-500", button: "bg-sky-600 hover:bg-sky-700", border: "hover:border-sky-200 dark:hover:border-sky-800" },
  { gradient: "from-rose-500 to-pink-600", bar: "from-rose-500 to-pink-500", button: "bg-rose-600 hover:bg-rose-700", border: "hover:border-rose-200 dark:hover:border-rose-800" },
];

const EquipmentList = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    equipmentId: number;
    equipmentName: string;
    newStatus: "ACTIVE" | "INACTIVE";
  } | null>(null);

  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const canChangeSlotStatus = ["admin", "manager", "operator"].includes(userTypeStr);
  const canBookForUser = ["admin", "manager", "operator"].includes(userTypeStr);

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

      const transformedEquipment: Equipment[] = response.data.equipments
        .filter((eq: ApiEquipment) => {
          // Admin/OIC see all equipment (ACTIVE + INACTIVE); others see only ACTIVE
          if (canChangeSlotStatus) return eq.status_display !== "Disposed";
          return eq.status === "ACTIVE" && eq.status_display !== "Disposed";
        })
        .map((eq: ApiEquipment) => ({
          id: eq.equipment_id,
          name: eq.name,
          category: eq.category_name || "",
          description: eq.name,
          image: (eq.image_url || eq.s3_path) ? apiClient.getEquipmentImageUrl(eq.equipment_id) : "/placeholder.svg",
          video: "",
          available: eq.status === "ACTIVE",
          status: eq.status,
          address: eq.location || "",
          technicalPerson: "",
          contactNumber: "",
          internalRate: 0,
          externalRate: 0,
        }));

      setEquipment(transformedEquipment);
    } catch (error: any) {
      toast.error(error.message || "Failed to load equipment");
      setEquipment([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = async (equipmentId: number, newStatus: "ACTIVE" | "INACTIVE") => {
    setStatusUpdatingId(equipmentId);
    setPendingStatusChange(null);
    try {
      const res = await apiClient.updateEquipmentStatus(equipmentId, newStatus);
      if (res.error) {
        toast.error(res.error || "Failed to update status");
        return;
      }
      toast.success(`Equipment set to ${newStatus === "ACTIVE" ? "Active" : "Inactive"}`);
      await fetchEquipment();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const q = searchQuery.trim().toLowerCase();
  const filteredEquipment = q
    ? equipment.filter(
        (item) =>
          (item.name && item.name.toLowerCase().includes(q)) ||
          (item.category && item.category.toLowerCase().includes(q)) ||
          (item.description && item.description.toLowerCase().includes(q)) ||
          (item.address && item.address.toLowerCase().includes(q))
      )
    : equipment;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
        <DashboardHeader />
        <main className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center py-24">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg mb-6">
              <Loader2 className="h-7 w-7 animate-spin" />
            </div>
            <p className="text-lg font-medium text-foreground">Loading equipment...</p>
            <p className="text-sm text-muted-foreground mt-1">Fetching the latest catalog</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        {/* Hero section */}
        <div className="mb-10 rounded-2xl bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-600 p-8 text-white shadow-xl">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="mb-4 text-white/90 hover:text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Browse Equipment</h1>
              <p className="text-white/90 mt-0.5">
                Explore and book laboratory equipment
              </p>
            </div>
          </div>
        </div>

        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-6">
          Equipment catalog
        </p>

        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by name, category, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-11 rounded-xl border-border bg-background shadow-sm"
            />
          </div>
        </div>

        {equipment.length === 0 ? (
          <Card className="overflow-hidden border-0 shadow-lg rounded-2xl max-w-md mx-auto">
            <CardContent className="flex flex-col items-center justify-center py-16 px-8 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-indigo-100 dark:from-sky-900/30 dark:to-indigo-900/30 text-sky-600 dark:text-sky-400 mb-6">
                <Package className="h-10 w-10" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">No equipment available</h3>
              <p className="text-muted-foreground text-sm mb-6">
                There is no active equipment in the catalog at the moment. Check back later.
              </p>
              <Button variant="outline" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        ) : filteredEquipment.length === 0 ? (
          <Card className="overflow-hidden border-0 shadow-lg rounded-2xl max-w-md mx-auto">
            <CardContent className="flex flex-col items-center justify-center py-16 px-8 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 text-amber-600 dark:text-amber-400 mb-6">
                <Search className="h-10 w-10" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">No matching equipment</h3>
              <p className="text-muted-foreground text-sm mb-6">
                No equipment matches &quot;{searchQuery}&quot;. Try a different search term or clear the filter.
              </p>
              <Button variant="outline" onClick={() => setSearchQuery("")}>
                Clear search
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredEquipment.map((item, index) => {
              const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];
              return (
                <Card
                  key={item.id}
                  className={`cursor-pointer overflow-hidden border-0 shadow-md rounded-2xl transition-all duration-200 hover:shadow-xl hover:-translate-y-1 ${accent.border}`}
                  onClick={() => navigate(`/equipment/${item.id}`)}
                >
                  <div className="relative aspect-video overflow-hidden bg-muted">
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
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity" />
                        {item.video && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPlayingVideo(item.id.toString());
                            }}
                            className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/50 transition-colors"
                          >
                            <div className={`flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${accent.gradient} text-white shadow-lg hover:scale-110 transition-transform`}>
                              <Play className="h-7 w-7 fill-current" />
                            </div>
                          </button>
                        )}
                      </>
                    )}
                    {/* Accent bar on image */}
                    <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${accent.bar}`} />
                    {item.category && (
                      <span className="absolute top-3 left-3 rounded-full bg-white/90 dark:bg-black/50 px-2.5 py-1 text-xs font-medium text-foreground backdrop-blur-sm">
                        {item.category}
                      </span>
                    )}
                  </div>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg line-clamp-2">{item.name}</CardTitle>
                    <CardDescription className="text-sm line-clamp-2">{item.description}</CardDescription>
                    <div className={`h-1 w-12 rounded-full bg-gradient-to-r ${accent.bar} mt-3`} />
                    {Number(item.internalRate) > 0 && (
                      <div className="text-base font-semibold text-foreground mt-2">
                        ₹{Number(item.internalRate).toFixed(2)}/hour
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-2">
                      {canChangeSlotStatus && (
                        <div
                          className="flex items-center justify-between gap-2 rounded-lg border p-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Label htmlFor={`status-${item.id}`} className="text-sm font-medium cursor-pointer">
                            {item.status === "ACTIVE" ? "Active" : "Inactive"}
                          </Label>
                          <Switch
                            id={`status-${item.id}`}
                            checked={item.status === "ACTIVE"}
                            disabled={statusUpdatingId === item.id}
                            onCheckedChange={() =>
                              setPendingStatusChange({
                                equipmentId: Number(item.id),
                                equipmentName: item.name,
                                newStatus: item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                              })
                            }
                          />
                        </div>
                      )}
                      <Button
                        className={`w-full ${accent.button} text-white`}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(canBookForUser
                            ? `/book-equipment?equipment_id=${item.id}&mode=book`
                            : `/book-equipment?equipment_id=${item.id}`);
                        }}
                      >
                        Book now
                      </Button>
                      {canChangeSlotStatus && (
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
                      )}
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/equipment/${item.id}`);
                        }}
                      >
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <AlertDialog open={pendingStatusChange !== null} onOpenChange={(open) => !open && setPendingStatusChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm status change</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatusChange && (
                <>
                  Set <strong>{pendingStatusChange.equipmentName}</strong> to{" "}
                  <strong>{pendingStatusChange.newStatus === "ACTIVE" ? "Active" : "Inactive"}</strong>?
                  {pendingStatusChange.newStatus === "INACTIVE" && (
                    <span className="block mt-2">Inactive equipment will not be available for booking.</span>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingStatusChange && handleStatusToggle(pendingStatusChange.equipmentId, pendingStatusChange.newStatus)}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EquipmentList;
