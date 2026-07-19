import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Timer } from "lucide-react";

interface BookingBufferConfigData {
  id: number;
  buffer_days: number;
  enabled: boolean;
  sample_retention_days: number;
  auto_archive_enabled: boolean;
}

export default function AdminBookingBufferConfig() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isAdmin = userTypeStr === "admin";

  const [id, setId] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bufferDays, setBufferDays] = useState(2);
  const [enabled, setEnabled] = useState(true);
  const [sampleRetentionDays, setSampleRetentionDays] = useState(60);
  const [autoArchiveEnabled, setAutoArchiveEnabled] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!isAdmin) {
      toast.error("Only admin can access Booking Buffer Configuration.");
      navigate("/admin-settings/equipment");
    }
  }, [navigate, isAuthenticated, user, isAdmin, authLoading]);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    apiClient
      .adminSingletonGet<BookingBufferConfigData>("bookingBufferConfig")
      .then((res) => {
        if (res.error) {
          toast.error(res.error);
          return;
        }
        if (res.data) {
          setId(res.data.id ?? 1);
          setBufferDays(res.data.buffer_days ?? 2);
          setEnabled(res.data.enabled ?? true);
          setSampleRetentionDays(res.data.sample_retention_days ?? 60);
          setAutoArchiveEnabled(res.data.auto_archive_enabled ?? true);
        }
      })
      .catch(() => toast.error("Failed to load booking buffer configuration."))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  const handleSave = async () => {
    setSaving(true);
    const res = await apiClient.adminSingletonUpdate<BookingBufferConfigData>(
      "bookingBufferConfig",
      {
        buffer_days: bufferDays,
        enabled,
        sample_retention_days: sampleRetentionDays,
        auto_archive_enabled: autoArchiveEnabled,
      },
      id
    );
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Booking buffer configuration updated.");
  };

  if (!isAdmin && !authLoading) return null;

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin-settings/equipment")} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Equipment settings
          </Button>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Timer className="h-8 w-8 text-primary" />
            Booking Buffer Configuration
          </h1>
          <p className="text-muted-foreground mt-1">
            Controls the daily "Booking Not Utilized" check and sample auto-archive after analysis.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Buffer &amp; retention settings</CardTitle>
              <CardDescription>
                A scheduled task runs daily at 20:00. Booked slots older than the buffer, without a received/rejected/
                processing sample, are marked "Booking Not Utilized" (no refund).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label className="text-base">Enable "Booking Not Utilized" check</Label>
                  <p className="text-sm text-muted-foreground">When off, the daily 20:00 check is skipped.</p>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buffer-days">Buffer time (days)</Label>
                <Input
                  id="buffer-days"
                  type="number"
                  min={0}
                  value={bufferDays}
                  onChange={(e) => setBufferDays(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-40"
                />
                <p className="text-sm text-muted-foreground">
                  Wait this many days after a booked slot's start time before auto-marking it. Set to 0 to disable.
                </p>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label className="text-base">Enable sample auto-archive</Label>
                  <p className="text-sm text-muted-foreground">When off, the daily auto-archive task is skipped.</p>
                </div>
                <Switch checked={autoArchiveEnabled} onCheckedChange={setAutoArchiveEnabled} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sample-retention-days">Sample retention (days)</Label>
                <Input
                  id="sample-retention-days"
                  type="number"
                  min={0}
                  value={sampleRetentionDays}
                  onChange={(e) => setSampleRetentionDays(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-40"
                />
                <p className="text-sm text-muted-foreground">
                  After a sample is marked "Analyzed", wait this many days before auto-archiving it. Set to 0 to
                  disable.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save
                </Button>
                <Button variant="outline" onClick={() => navigate("/admin-settings/equipment")}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
