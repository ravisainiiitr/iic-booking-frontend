import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Package, Loader2, Search } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import DepartmentFilter, { type DepartmentFilterValue } from "@/components/DepartmentFilter";
import { toast } from "sonner";
import { type EquipmentData } from "@/data/equipmentData";
import { Input } from "@/components/ui/input";
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
  internal_department?: number | null;
  internal_department_name?: string | null;
  internal_department_code?: string | null;
  make?: string | null;
  show_make_on_card?: boolean;
  model_information?: string | null;
  show_model_on_card?: boolean;
  avg_rating?: number | null;
  rating_count?: number | null;
  created_at: string;
  updated_at: string;
}

const transformApiEquipment = (list: ApiEquipment[]): Equipment[] =>
  list
    .filter((eq) => eq.status_display !== "Disposed")
    .map((eq) => ({
      id: eq.equipment_id,
      name: eq.name,
      category: eq.category_name || "",
      description: eq.name,
      image: eq.image_url ? apiClient.getEquipmentImageProxyPath(eq.equipment_id) : "/placeholder.svg",
      hasImage: !!eq.image_url,
      video: "",
      available: eq.status === "ACTIVE",
      status: eq.status,
      statusDisplay: eq.status_display,
      departmentName: eq.internal_department_name || null,
      departmentCode: eq.internal_department_code || null,
      make: eq.make || null,
      showMakeOnCard: Boolean(eq.show_make_on_card),
      modelInformation: eq.model_information || null,
      showModelOnCard: Boolean(eq.show_model_on_card),
      address: eq.location || "",
      technicalPerson: "",
      contactNumber: "",
      internalRate: 0,
      externalRate: 0,
      avgRating: eq.avg_rating ?? null,
      ratingCount: eq.rating_count ?? null,
    }));

const EquipmentList = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<DepartmentFilterValue>("all");
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    equipmentId: number;
    equipmentName: string;
    newStatus: "ACTIVE" | "REPAIR";
  } | null>(null);

  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  // Admin / OIC only — Lab In-charge (operator) cannot change operational status.
  const canChangeEquipmentStatus = ["admin", "manager"].includes(userTypeStr);
  const canBookForOtherUsers = ["admin", "manager", "dept_admin"].includes(userTypeStr);
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

  const [authReady, setAuthReady] = useState(false);

  const fetchEquipment = useCallback(
    async (search?: string, departmentId: DepartmentFilterValue = "all") => {
      const effectiveDept: DepartmentFilterValue =
        isDeptAdmin && daDepartmentId != null ? daDepartmentId : departmentId;
      const response = await apiClient.getEquipments(search, undefined, undefined, true, effectiveDept);
      if (response.error) {
        throw new Error(response.error || "Failed to load equipment");
      }
      const rawList = response.data?.equipments;
      let list = Array.isArray(rawList) ? rawList : [];
      if (isDeptAdmin && daDepartmentId != null) {
        list = list.filter((eq) => Number(eq.internal_department) === Number(daDepartmentId));
      }
      return transformApiEquipment(list);
    },
    [isDeptAdmin, daDepartmentId],
  );

  useEffect(() => {
    if (isDeptAdmin && daDepartmentId != null) {
      setSelectedDepartmentId(daDepartmentId);
    }
  }, [isDeptAdmin, daDepartmentId]);

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
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
      setAuthReady(true);
    };

    checkAuth();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    if (!authReady) return;

    let cancelled = false;

    const reload = async () => {
      try {
        setLoading(true);
        const transformed = await fetchEquipment(
          searchQuery.trim() || undefined,
          selectedDepartmentId,
        );
        if (!cancelled) setEquipment(transformed);
      } catch (error: unknown) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Failed to load equipment");
          setEquipment([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const timeoutId = setTimeout(reload, searchQuery.trim() ? 500 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [authReady, searchQuery, selectedDepartmentId, fetchEquipment]);

  const handleStatusToggle = async (equipmentId: number, newStatus: "ACTIVE" | "REPAIR") => {
    setStatusUpdatingId(equipmentId);
    setPendingStatusChange(null);
    try {
      const res = await apiClient.updateEquipmentStatus(equipmentId, newStatus);
      if (res.error) {
        toast.error(res.error || "Failed to update status");
        return;
      }
      const label = newStatus === "ACTIVE" ? "Operational" : "Under Maintenance";
      toast.success(`Equipment set to ${label}`);
      const transformed = await fetchEquipment(searchQuery.trim() || undefined, selectedDepartmentId);
      setEquipment(transformed);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    (!isDeptAdmin && selectedDepartmentId !== "all");

  if (loading && equipment.length === 0) {
    return (
      <div className="page-shell">
        <DashboardHeader />
        <main className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center py-24">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-lg mb-6">
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
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-10 rounded-2xl bg-gradient-to-r from-teal-800 via-teal-700 to-cyan-700 p-8 text-white shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Browse Equipment</h1>
              <p className="text-white/90 mt-0.5">Explore and book laboratory equipment</p>
            </div>
          </div>
        </div>

        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-6">
          Equipment catalog
        </p>

        <div className="mb-6 flex flex-col sm:flex-row gap-3 max-w-3xl">
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
              triggerClassName="h-11 rounded-xl w-full"
              disabled={loading}
            />
          )}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-11 rounded-xl border-border bg-background shadow-sm"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground animate-spin" />
            )}
          </div>
        </div>

        {equipment.length === 0 ? (
          <Card className="overflow-hidden border-0 shadow-lg rounded-2xl max-w-md mx-auto">
            <CardContent className="flex flex-col items-center justify-center py-16 px-8 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-100 to-cyan-100 dark:from-teal-900/30 dark:to-cyan-900/30 text-teal-700 dark:text-teal-400 mb-6">
                {hasActiveFilters ? <Search className="h-10 w-10" /> : <Package className="h-10 w-10" />}
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {hasActiveFilters ? "No matching equipment" : "No equipment available"}
              </h3>
              <p className="text-muted-foreground text-sm mb-6">
                {hasActiveFilters
                  ? "No equipment matches the selected department or search. Try different filters."
                  : "There is no active equipment in the catalog at the moment. Check back later."}
              </p>
              {hasActiveFilters && !isDeptAdmin ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedDepartmentId("all");
                  }}
                >
                  Clear filters
                </Button>
              ) : hasActiveFilters && isDeptAdmin ? (
                <Button variant="outline" onClick={() => setSearchQuery("")}>
                  Clear search
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {equipment.map((item) => (
              <EquipmentCatalogCard
                key={item.id}
                item={item}
                accent={accentForEquipmentId(item.id)}
                canChangeSlotStatus={canChangeEquipmentStatus}
                canBookForOtherUsers={canBookForOtherUsers}
                statusUpdatingId={statusUpdatingId}
                onRequestStatusChange={(next) => setPendingStatusChange(next)}
              />
            ))}
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
                    {pendingStatusChange.newStatus === "ACTIVE" ? "Operational" : "Under Maintenance"}
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
                pendingStatusChange &&
                handleStatusToggle(pendingStatusChange.equipmentId, pendingStatusChange.newStatus)
              }
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
