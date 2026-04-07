import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Package, Loader2, Search } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { toast } from "sonner";
import { type EquipmentData } from "@/data/equipmentData";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import EquipmentCatalogCard, { type EquipmentCatalogCardItem } from "@/components/EquipmentCatalogCard";
import { accentForEquipmentId } from "@/lib/equipmentCardAccents";

interface Equipment extends EquipmentData, EquipmentCatalogCardItem {
  status?: string;
  statusDisplay?: string;
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
  avg_rating?: number | null;
  rating_count?: number | null;
  created_at: string;
  updated_at: string;
}


const EquipmentList = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    equipmentId: number;
    equipmentName: string;
    newStatus: "ACTIVE" | "MAINTENANCE" | "REPAIR";
  } | null>(null);

  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const canChangeSlotStatus = ["admin", "manager", "operator"].includes(userTypeStr);
  const canBookForUser = ["admin", "manager", "operator"].includes(userTypeStr);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const token = apiClient.getToken();
      if (!token) {
        setLoading(false);
        navigate("/auth");
        return;
      }

      const userResponse = await apiClient.getCurrentUser();
      if (cancelled) return;
      if (userResponse.error || !userResponse.data) {
        setLoading(false);
        navigate("/auth");
        return;
      }

      try {
        setLoading(true);
        // Request rating aggregates so cards can display overall rating (avg + count).
        const response = await apiClient.getEquipments(undefined, undefined, undefined, true);
        if (cancelled) return;

        if (response.error) {
          toast.error(response.error || "Failed to load equipment");
          setEquipment([]);
          return;
        }

        const rawList = response.data?.equipments;
        const list = Array.isArray(rawList) ? rawList : [];
        if (list.length === 0) {
          toast.info("No equipment available");
          setEquipment([]);
          return;
        }

        const ut = userResponse.data?.user_type;
        const userTypeStrForFilter = ut != null ? String(ut).toLowerCase() : "";
        const canChangeSlotStatusFilter = ["admin", "manager", "operator"].includes(userTypeStrForFilter);

        const transformedEquipment: Equipment[] = list
          .filter((eq: ApiEquipment) => {
            // Never hide maintenance statuses from regular users; only hide truly disposed equipment.
            return eq.status_display !== "Disposed";
          })
          .map((eq: ApiEquipment) => ({
            id: eq.equipment_id,
            name: eq.name,
            category: eq.category_name || "",
            description: eq.name,
            image: eq.image_url ? apiClient.getEquipmentImageUrl(eq.equipment_id) : "/placeholder.svg",
            video: "",
            available: eq.status === "ACTIVE",
            status: eq.status,
            statusDisplay: eq.status_display,
            address: eq.location || "",
            technicalPerson: "",
            contactNumber: "",
            internalRate: 0,
            externalRate: 0,
            avgRating: eq.avg_rating ?? null,
            ratingCount: eq.rating_count ?? null,
          }));

        setEquipment(transformedEquipment);
      } catch (error: any) {
        if (!cancelled) {
          toast.error(error.message || "Failed to load equipment");
          setEquipment([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const fetchEquipment = async () => {
    try {
      const response = await apiClient.getEquipments(undefined, undefined, undefined, true);
      if (response.error) {
        toast.error(response.error || "Failed to load equipment");
        return;
      }
      const rawList = response.data?.equipments;
      const list = Array.isArray(rawList) ? rawList : [];
      const transformedEquipment: Equipment[] = list
        .filter((eq: ApiEquipment) => eq.status_display !== "Disposed")
        .map((eq: ApiEquipment) => ({
          id: eq.equipment_id,
          name: eq.name,
          category: eq.category_name || "",
          description: eq.name,
          image: eq.image_url ? apiClient.getEquipmentImageUrl(eq.equipment_id) : "/placeholder.svg",
          video: "",
          available: eq.status === "ACTIVE",
          status: eq.status,
          statusDisplay: eq.status_display,
          address: eq.location || "",
          technicalPerson: "",
          contactNumber: "",
          internalRate: 0,
          externalRate: 0,
          avgRating: eq.avg_rating ?? null,
          ratingCount: eq.rating_count ?? null,
        }));
      setEquipment(transformedEquipment);
    } catch (error: any) {
      toast.error(error.message || "Failed to load equipment");
    }
  };

  const handleStatusToggle = async (equipmentId: number, newStatus: "ACTIVE" | "MAINTENANCE" | "REPAIR") => {
    setStatusUpdatingId(equipmentId);
    setPendingStatusChange(null);
    try {
      const res = await apiClient.updateEquipmentStatus(equipmentId, newStatus);
      if (res.error) {
        toast.error(res.error || "Failed to update status");
        return;
      }
      const label =
        newStatus === "ACTIVE"
          ? "Operational"
          : newStatus === "MAINTENANCE"
            ? "Maintenance Scheduled"
            : "Under Maintenance";
      toast.success(`Equipment set to ${label}`);
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
              const accent = accentForEquipmentId(item.id);
              return (
                <EquipmentCatalogCard
                  key={item.id}
                  item={item}
                  accent={accent}
                  canChangeSlotStatus={canChangeSlotStatus}
                  statusUpdatingId={statusUpdatingId}
                  onRequestStatusChange={(next) => setPendingStatusChange(next)}
                />
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
                  <strong>
                    {pendingStatusChange.newStatus === "ACTIVE"
                      ? "Operational"
                      : pendingStatusChange.newStatus === "MAINTENANCE"
                        ? "Maintenance Scheduled"
                        : "Under Maintenance"}
                  </strong>
                  ?
                  {pendingStatusChange.newStatus !== "ACTIVE" && (
                    <span className="block mt-2">Non-operational equipment will not be available for booking.</span>
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
