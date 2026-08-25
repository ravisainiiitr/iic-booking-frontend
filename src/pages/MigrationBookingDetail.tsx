import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";

export default function MigrationBookingDetail() {
  const { legacyBookingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isStaff =
    String(user?.user_type || "").toLowerCase() === "admin" ||
    ["manager", "operator"].includes(String(user?.user_type || "").toLowerCase());

  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isStaff || !legacyBookingId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await apiClient.getLegacyBookingDetail(Number(legacyBookingId));
        if (res.error) throw new Error(res.error);
        setDetail(res.data || null);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Not found");
      } finally {
        setLoading(false);
      }
    })();
  }, [isStaff, legacyBookingId]);

  if (!isStaff) {
    return (
      <div className="container mx-auto max-w-3xl p-6">
        <p className="text-muted-foreground">Access denied.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/portal-migration/legacy-bookings")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Legacy booking {legacyBookingId}</h1>
          <p className="text-sm text-muted-foreground">Occupancy audit — not a new-portal Booking row.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Block metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {loading ? (
            <p>Loading…</p>
          ) : !detail ? (
            <p>No active block found. Booking may be discovery-only until T0.</p>
          ) : (
            <>
              <p>
                <span className="text-muted-foreground">Block status:</span>{" "}
                <Badge>{String(detail.block_status || "—")}</Badge>
              </p>
              <p>
                <span className="text-muted-foreground">User mapping:</span>{" "}
                {String(detail.user_mapping_status || "—")} ({String(detail.user_mapping_source || "")})
              </p>
              <p>
                <span className="text-muted-foreground">Equipment:</span> legacy {String(detail.legacy_equipment_id)}{" "}
                → new {String(detail.new_equipment_id)}
              </p>
              <p>
                <span className="text-muted-foreground">Window:</span> {String(detail.start_at)} — {String(detail.end_at)}
              </p>
              <p>
                <span className="text-muted-foreground">Slots claimed:</span>{" "}
                {Array.isArray(detail.slot_ids) ? detail.slot_ids.length : 0}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Link to="/admin/portal-migration" className="text-sm underline">
        Back to migration overview
      </Link>
    </div>
  );
}
