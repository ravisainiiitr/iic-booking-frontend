import EquipmentCatalogCard from "@/components/EquipmentCatalogCard";
import DepartmentFilter, { type DepartmentFilterValue } from "@/components/DepartmentFilter";
import { accentForEquipmentId } from "@/lib/equipmentCardAccents";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
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
  video_url?: string | null;
  category?: number | null;
  category_name?: string | null;
  category_code?: string | null;
  internal_department?: number | null;
  internal_department_name?: string | null;
  internal_department_code?: string | null;
  avg_rating?: number | null;
  rating_count?: number | null;
  rating_dist?: Record<string, number> | null;
}

const EquipmentGrid = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<DepartmentFilterValue>("all");
  const [equipment, setEquipment] = useState<ApiEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    equipmentId: number;
    equipmentName: string;
    newStatus: "ACTIVE" | "MAINTENANCE" | "REPAIR";
  } | null>(null);

  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isAdminOrOIC = ["admin", "manager", "operator"].includes(userTypeStr);

  const fetchEquipment = useCallback(async (search?: string, departmentId: DepartmentFilterValue = "all") => {
    try {
      setLoading(true);
      const response = await apiClient.getEquipments(
        search,
        undefined,
        undefined,
        true,
        departmentId,
      );

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.data?.equipments && Array.isArray(response.data.equipments)) {
        const filteredEquipment = response.data.equipments.filter(
          (eq: ApiEquipment) => eq.status_display !== "Disposed",
        );
        setEquipment(filteredEquipment);
      } else {
        setEquipment([]);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load equipment";
      console.error("Error fetching equipment:", error);
      toast.error(message);
      setEquipment([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchEquipment(searchQuery.trim() || undefined, selectedDepartmentId);
    }, searchQuery.trim() ? 500 : 0);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, selectedDepartmentId, fetchEquipment]);

  const transformEquipment = (eqList: ApiEquipment[]) => {
    return eqList.map((eq) => ({
      id: eq.equipment_id,
      name: eq.name,
      category: eq.category_name || "",
      description: `${eq.name}`,
      image: eq.image_url ? apiClient.getEquipmentImageUrl(eq.equipment_id) : "/placeholder.svg",
      video: eq.video_url || undefined,
      available: eq.status === "ACTIVE",
      status: eq.status,
      statusDisplay: eq.status_display,
      departmentName: eq.internal_department_name || null,
      departmentCode: eq.internal_department_code || null,
      avgRating: eq.avg_rating ?? null,
      ratingCount: eq.rating_count ?? null,
      ratingDist: eq.rating_dist ?? null,
      address: eq.location || "Institute Instrumentation Centre, IIT Roorkee",
      technicalPerson: "",
      contactNumber: "",
    }));
  };

  const handleStatusChange = async (equipmentId: number, newStatus: "ACTIVE" | "MAINTENANCE" | "REPAIR") => {
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
      await fetchEquipment(searchQuery.trim() || undefined, selectedDepartmentId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const displayEquipment = useMemo(() => {
    return transformEquipment(equipment);
  }, [equipment, statusUpdatingId, isAdminOrOIC]);

  const hasActiveFilters = selectedDepartmentId !== "all" || searchQuery.trim().length > 0;

  return (
    <section id="equipment" className="py-12">
      <div className="mb-12">
        <div className="text-center mb-8">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 min-h-[1.4em] leading-[1.35] pb-[0.25em] overflow-visible bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Equipment Catalog
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Browse our extensive collection of advanced scientific instruments
          </p>
        </div>

        <div className="max-w-3xl mx-auto mb-8 flex flex-col sm:flex-row gap-3">
          <DepartmentFilter
            value={selectedDepartmentId}
            onChange={setSelectedDepartmentId}
            className="sm:w-64 shrink-0"
            triggerClassName="h-12 text-base w-full"
          />
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search equipment by name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-base"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground animate-spin" />
            )}
          </div>
        </div>
      </div>

      {loading && equipment.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="aspect-square w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : displayEquipment.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">
            {hasActiveFilters
              ? "No equipment found for the selected department or search."
              : "No equipment available."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {displayEquipment.map((equipmentItem) => (
            <EquipmentCatalogCard
              key={equipmentItem.id}
              item={equipmentItem as any}
              accent={accentForEquipmentId(equipmentItem.id)}
              canChangeSlotStatus={isAdminOrOIC}
              statusUpdatingId={statusUpdatingId}
              onRequestStatusChange={(next) => setPendingStatusChange(next)}
            />
          ))}
        </div>
      )}

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
              onClick={() =>
                pendingStatusChange && handleStatusChange(pendingStatusChange.equipmentId, pendingStatusChange.newStatus)
              }
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};

export default EquipmentGrid;
