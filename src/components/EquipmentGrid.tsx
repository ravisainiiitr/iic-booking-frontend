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
  make?: string | null;
  show_make_on_card?: boolean;
  model_information?: string | null;
  show_model_on_card?: boolean;
  avg_rating?: number | null;
  rating_count?: number | null;
  rating_dist?: Record<string, number> | null;
}

const EquipmentGrid = () => {
  const { user, loading: authLoading } = useAuth();
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
  const isDeptAdmin = userTypeStr === "dept_admin";
  const daDepartmentId = (() => {
    const raw =
      user?.department ??
      (user as { department_id?: number | null } | null)?.department_id ??
      null;
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  })();

  const fetchEquipment = useCallback(async (search?: string, departmentId: DepartmentFilterValue = "all") => {
    try {
      setLoading(true);
      const effectiveDept: DepartmentFilterValue =
        isDeptAdmin && daDepartmentId != null ? daDepartmentId : departmentId;
      const response = await apiClient.getEquipments(
        search,
        undefined,
        undefined,
        true,
        effectiveDept,
      );

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.data?.equipments && Array.isArray(response.data.equipments)) {
        let filteredEquipment = response.data.equipments.filter(
          (eq: ApiEquipment) => eq.status_display !== "Disposed",
        );
        // Client-side safety net for Department Administrators.
        if (isDeptAdmin && daDepartmentId != null) {
          filteredEquipment = filteredEquipment.filter(
            (eq) => Number(eq.internal_department) === Number(daDepartmentId),
          );
        }
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
  }, [isDeptAdmin, daDepartmentId]);

  useEffect(() => {
    if (isDeptAdmin && daDepartmentId != null) {
      setSelectedDepartmentId(daDepartmentId);
    }
  }, [isDeptAdmin, daDepartmentId]);

  useEffect(() => {
    // Wait for auth hydrate so DA department is known before the first fetch.
    if (authLoading) return;
    const timeoutId = setTimeout(() => {
      fetchEquipment(searchQuery.trim() || undefined, selectedDepartmentId);
    }, searchQuery.trim() ? 500 : 0);

    return () => clearTimeout(timeoutId);
  }, [authLoading, searchQuery, selectedDepartmentId, fetchEquipment]);

  const transformEquipment = (eqList: ApiEquipment[]) => {
    return eqList.map((eq) => ({
      id: eq.equipment_id,
      name: eq.name,
      category: eq.category_name || "",
      description: `${eq.name}`,
      image: eq.image_url ? apiClient.getEquipmentImageProxyPath(eq.equipment_id) : "/placeholder.svg",
      hasImage: !!eq.image_url,
      video: eq.video_url || undefined,
      available: eq.status === "ACTIVE",
      status: eq.status,
      statusDisplay: eq.status_display,
      departmentName: eq.internal_department_name || null,
      departmentCode: eq.internal_department_code || null,
      make: eq.make || null,
      showMakeOnCard: Boolean(eq.show_make_on_card),
      modelInformation: eq.model_information || null,
      showModelOnCard: Boolean(eq.show_model_on_card),
      avgRating: eq.avg_rating ?? null,
      ratingCount: eq.rating_count ?? null,
      ratingDist: eq.rating_dist ?? null,
      address: eq.location || "IIT Roorkee",
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

  const hasActiveFilters =
    searchQuery.trim().length > 0 || (!isDeptAdmin && selectedDepartmentId !== "all");

  return (
    <section id="equipment" className="py-2">
      <div className="mb-8">
        <div className="max-w-3xl mx-auto mb-6 flex flex-col sm:flex-row gap-3">
          {isDeptAdmin ? (
            <div className="sm:w-64 shrink-0 rounded-xl border bg-muted/40 px-3 py-2.5 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Department</p>
              <p className="font-medium truncate mt-0.5">
                {user?.department_name
                  ? `${user.department_name}${user.department_code ? ` (${user.department_code})` : ""}`
                  : daDepartmentId != null
                    ? `Department #${daDepartmentId}`
                    : "Your department"}
              </p>
            </div>
          ) : (
            <DepartmentFilter
              value={selectedDepartmentId}
              onChange={setSelectedDepartmentId}
              className="sm:w-64 shrink-0"
              triggerClassName="h-12 text-base w-full"
            />
          )}
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
              ? isDeptAdmin
                ? "No equipment found for your department or search."
                : "No equipment found for the selected department or search."
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
