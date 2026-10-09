import EquipmentCatalogCard from "@/components/EquipmentCatalogCard";
import DepartmentFilter, { type DepartmentFilterValue } from "@/components/DepartmentFilter";
import { accentForEquipmentId } from "@/lib/equipmentCardAccents";
import {
  catalogDepartmentFromParam,
  filterCatalogEquipmentForDisplay,
  isCatalogFamilyParent,
} from "@/lib/equipmentCatalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import type { CardModeAvailability } from "@/lib/modeAvailability";
import type { EquipmentDisruptionNotice } from "@/lib/disruptions";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { NoticeExpiryDialog } from "@/components/NoticeExpiryDialog";
import { useDisruptionPrompt, type DisruptionPromptOutcome } from "@/components/disruptions/useDisruptionPrompt";

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
  parent_equipment?: number | null;
  enable_multi_mode?: boolean;
  avg_rating?: number | null;
  rating_count?: number | null;
  rating_dist?: Record<string, number> | null;
  publication_count?: number | null;
  featured_publication_title?: string | null;
  featured_citation?: string | null;
  from_price?: number | string | null;
  from_price_unit?: string | null;
  mode_availability?: CardModeAvailability | null;
  disruption_notice?: EquipmentDisruptionNotice | null;
}

const EquipmentGrid = () => {
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  // Department and OIC scope live in the URL with `family` so Back from an equipment page restores the view.
  const [urlDepartment] = useState(() => catalogDepartmentFromParam(searchParams.get("dept")));
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<DepartmentFilterValue>(
    () => urlDepartment ?? "all",
  );
  /** Block first catalog fetch until IIC default (or DA dept) is resolved — avoids flash of all departments. */
  const [departmentReady, setDepartmentReady] = useState(() => urlDepartment != null);
  const [equipment, setEquipment] = useState<ApiEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const disruptionPrompt = useDisruptionPrompt();
  const [noticeExpiryPrompt, setNoticeExpiryPrompt] = useState<{
    noticeId: number;
    equipmentName: string;
  } | null>(null);
  /** OIC: default managed instruments; toggle to browse full catalog. */
  const oicCatalogScope: "managed" | "all" = searchParams.get("scope") === "all" ? "all" : "managed";
  const setOicCatalogScope = (scope: "managed" | "all") => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (scope === "all") next.set("scope", "all");
        else next.delete("scope");
        return next;
      },
      { replace: true },
    );
  };

  const familyRaw = searchParams.get("family");
  const expandedParentId = (() => {
    if (!familyRaw) return null;
    const n = Number(familyRaw);
    return Number.isFinite(n) ? n : null;
  })();

  const openFamilyView = useCallback(
    (parentId: number) => {
      setSearchQuery("");
      const next = new URLSearchParams(searchParams);
      next.set("family", String(parentId));
      setSearchParams(next, { replace: false });
      window.requestAnimationFrame(() => {
        document.getElementById("equipment")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    [searchParams, setSearchParams],
  );

  const clearFamilyView = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("family");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  // Admin / OIC only — Lab Operator cannot change operational status.
  const canChangeEquipmentStatus = ["admin", "manager"].includes(userTypeStr);
  const canBookForOtherUsers = ["admin", "manager", "dept_admin"].includes(userTypeStr);
  const isOic = userTypeStr === "manager";
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
        isOic ? oicCatalogScope : null,
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
  }, [isDeptAdmin, daDepartmentId, isOic, oicCatalogScope]);

  useEffect(() => {
    if (isDeptAdmin && daDepartmentId != null) {
      setSelectedDepartmentId(daDepartmentId);
      setDepartmentReady(true);
    }
  }, [isDeptAdmin, daDepartmentId]);

  useEffect(() => {
    // Wait for auth + department default so we never flash "all departments" equipment.
    if (authLoading) return;
    if (!departmentReady) return;
    const timeoutId = setTimeout(() => {
      fetchEquipment(searchQuery.trim() || undefined, selectedDepartmentId);
    }, searchQuery.trim() ? 500 : 0);

    return () => clearTimeout(timeoutId);
  }, [authLoading, departmentReady, searchQuery, selectedDepartmentId, fetchEquipment]);

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
      publicationCount: eq.publication_count ?? null,
      featuredPublicationTitle: eq.featured_publication_title ?? null,
      featuredCitation: eq.featured_citation ?? null,
      fromPrice: eq.from_price ?? null,
      fromPriceUnit: eq.from_price_unit ?? null,
      modeAvailability: eq.mode_availability ?? null,
      disruptionNotice: eq.disruption_notice ?? null,
      address: eq.location || "IIT Roorkee",
      technicalPerson: "",
      contactNumber: "",
    }));
  };

  const requestStatusChange = async (next: {
    equipmentId: number;
    equipmentName: string;
    newStatus: "ACTIVE" | "REPAIR";
  }) => {
    const outcome = await disruptionPrompt.askForEquipmentStatusChange({
      equipmentId: next.equipmentId,
      equipmentName: next.equipmentName,
      newStatus: next.newStatus,
      canAttachReport: true,
    });
    if (outcome === null) return;
    await handleStatusChange(next.equipmentId, next.newStatus, next.equipmentName, outcome);
  };

  const handleStatusChange = async (
    equipmentId: number,
    newStatus: "ACTIVE" | "REPAIR",
    equipmentName?: string,
    outcome?: DisruptionPromptOutcome
  ) => {
    setStatusUpdatingId(equipmentId);
    try {
      const res = await apiClient.updateEquipmentStatus(equipmentId, newStatus, outcome?.fields);
      if (res.error) {
        toast.error(res.error || "Failed to update status");
        return;
      }
      const label = newStatus === "ACTIVE" ? "Operational" : "Under Maintenance";
      toast.success(`Equipment set to ${label}`);
      await outcome?.afterApply(res.data?.disruption_events);
      const nb = res.data?.notice_board;
      if (nb?.notice_closed_on_operational) {
        toast.message("Linked notice board entry was closed (expiry set to now).");
      }
      if (nb?.notice_prompt_for_actor && nb.notice_request_id) {
        setNoticeExpiryPrompt({
          noticeId: Number(nb.notice_request_id),
          equipmentName: equipmentName || "Equipment",
        });
      } else if (nb?.needs_notice_expiry && nb.notice_request_id) {
        toast.message("Notice board draft created. OIC can set expiry under Notice board requests.");
      }
      await fetchEquipment(searchQuery.trim() || undefined, selectedDepartmentId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const visibleEquipment = useMemo(
    () =>
      filterCatalogEquipmentForDisplay(equipment, expandedParentId, {
        searchActive: Boolean(searchQuery.trim()),
      }),
    [equipment, expandedParentId, searchQuery],
  );

  const displayEquipment = useMemo(() => {
    return transformEquipment(visibleEquipment);
  }, [visibleEquipment, statusUpdatingId, canChangeEquipmentStatus]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 || (!isDeptAdmin && selectedDepartmentId !== "all");

  return (
    <section id="equipment" className="py-2">
      <div className="mb-4">
        {isOic ? (
          <div className="max-w-3xl mx-auto mb-3 flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={oicCatalogScope === "managed" ? "default" : "outline"}
              onClick={() => setOicCatalogScope("managed")}
            >
              My equipment
            </Button>
            <Button
              type="button"
              size="sm"
              variant={oicCatalogScope === "all" ? "default" : "outline"}
              onClick={() => setOicCatalogScope("all")}
            >
              All equipment
            </Button>
          </div>
        ) : null}
        {expandedParentId != null ? (
          <div className="max-w-3xl mx-auto mb-3 flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
            <span>This instrument has several modes. Select one to continue.</span>
            <Button type="button" size="sm" variant="outline" onClick={clearFamilyView}>
              Back to all
            </Button>
          </div>
        ) : null}
        <div className="w-full mb-4 flex flex-col gap-2.5 md:flex-row md:items-center md:gap-3">
          {isDeptAdmin ? (
            <div className="min-w-0 w-full md:w-1/2 md:shrink-0 rounded-xl border bg-muted/40 px-3 text-sm flex items-center gap-2 h-11">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground shrink-0">Dept</p>
              <p className="font-semibold truncate whitespace-nowrap">
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
              onChange={(v) => {
                setSelectedDepartmentId(v);
                setDepartmentReady(true);
                setSearchParams(
                  (prev) => {
                    const next = new URLSearchParams(prev);
                    next.set("dept", String(v));
                    return next;
                  },
                  { replace: true },
                );
              }}
              onResolved={(v) => {
                setSelectedDepartmentId(v);
                setDepartmentReady(true);
              }}
              hideLabel
              className="md:w-1/2 md:shrink-0"
              triggerClassName="h-11 min-w-0 w-full rounded-xl text-sm font-semibold shadow-sm"
              defaultDepartmentName="Institute Instrumentation Centre"
              disabled={!departmentReady && !isDeptAdmin}
            />
          )}
          <div className="relative w-full min-w-0 md:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              aria-label="Search equipment by name or code"
              placeholder="Search by name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-11 rounded-xl border-border bg-background shadow-sm"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
            )}
          </div>
        </div>
      </div>

      {(!departmentReady || (loading && equipment.length === 0)) ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayEquipment.map((equipmentItem) => (
            <EquipmentCatalogCard
              key={equipmentItem.id}
              item={equipmentItem as any}
              accent={accentForEquipmentId(equipmentItem.id)}
              canChangeSlotStatus={canChangeEquipmentStatus && !(isOic && oicCatalogScope === "all")}
              canBookForOtherUsers={canBookForOtherUsers}
              statusUpdatingId={statusUpdatingId}
              onRequestStatusChange={(next) => void requestStatusChange(next)}
              onOpenEquipment={(id) => {
                if (
                  expandedParentId == null &&
                  isCatalogFamilyParent(equipment, id, { searchActive: Boolean(searchQuery.trim()) })
                ) {
                  openFamilyView(id);
                  return true;
                }
                return false;
              }}
            />
          ))}
        </div>
      )}

      {disruptionPrompt.element}
      <NoticeExpiryDialog
        open={noticeExpiryPrompt != null}
        noticeId={noticeExpiryPrompt?.noticeId ?? null}
        equipmentName={noticeExpiryPrompt?.equipmentName}
        onOpenChange={(open) => {
          if (!open) setNoticeExpiryPrompt(null);
        }}
      />
    </section>
  );
};
export default EquipmentGrid;
