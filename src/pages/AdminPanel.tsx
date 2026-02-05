import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, X, Wrench } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";

interface Equipment {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  image_url: string | null;
  video_url: string | null;
  available: boolean;
  internal_rate: number | null;
  external_rate: number | null;
  location: string | null;
  technical_contact: string | null;
  full_details_url: string | null;
}

const AdminPanel = () => {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Equipment>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
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

      const isAdminByType = apiClient.isAdminPanelUser(userResponse.data.user_type);
      const adminCheck = await apiClient.checkAdminRole(String(userResponse.data.id));
      const isAdmin = isAdminByType || adminCheck.data?.is_admin === true;
      if (!isAdmin) {
        toast({
          title: "Access Denied",
          description: "You don't have admin permissions",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setIsAdmin(true);
      loadEquipment();
    } catch (error) {
      console.error("Error checking admin access:", error);
      navigate("/");
    } finally {
      setCheckingAuth(false);
    }
  };

  const loadEquipment = async () => {
    try {
      const response = await apiClient.getEquipments(undefined, undefined);
      if (response.error) {
        throw new Error(response.error);
      }
      const list = response.data?.equipments || [];
      setEquipment(
        list.map((e: { equipment_id: number; name: string; profile_type_display?: string; profile_type?: string; description?: string | null; image_url?: string | null; video_url?: string | null; status?: string; location?: string | null }) => ({
          id: String(e.equipment_id),
          name: e.name ?? "",
          category: e.profile_type_display ?? e.profile_type ?? null,
          description: e.description ?? null,
          image_url: e.image_url ?? null,
          video_url: e.video_url ?? null,
          available: e.status === "ACTIVE",
          internal_rate: null,
          external_rate: null,
          location: e.location ?? null,
          technical_contact: null,
          full_details_url: null,
        }))
      );
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load equipment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (item: Equipment) => {
    setEditingId(item.id);
    setFormData(item);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setFormData({});
  };

  const saveEquipment = async () => {
    if (!editingId) return;

    try {
      const response = await apiClient.updateEquipment(editingId, {
        name: formData.name,
        description: formData.description ?? undefined,
        status: formData.available ? "ACTIVE" : "INACTIVE",
        location: formData.location ?? undefined,
      });

      if (response.error) {
        throw new Error(response.error);
      }

      toast({
        title: "Success",
        description: "Equipment updated successfully",
      });

      await loadEquipment();
      cancelEditing();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update equipment",
        variant: "destructive",
      });
    }
  };

  if (checkingAuth || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-accent/20">
      <DashboardHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <h1 className="text-4xl font-bold flex items-center gap-2">
            <Wrench className="h-10 w-10" />
            Equipment Management
          </h1>
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {equipment.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{item.name}</span>
                    {editingId === item.id ? (
                      <div className="flex gap-2">
                        <Button onClick={saveEquipment} size="sm">
                          <Save className="h-4 w-4 mr-2" />
                          Save
                        </Button>
                        <Button onClick={cancelEditing} variant="outline" size="sm">
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button onClick={() => startEditing(item)} size="sm">
                        Edit
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {editingId === item.id ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="name">Equipment Name</Label>
                        <Input
                          id="name"
                          value={formData.name || ""}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="category">Category</Label>
                        <Input
                          id="category"
                          value={formData.category || ""}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="video_url">Video URL</Label>
                        <Input
                          id="video_url"
                          value={formData.video_url || ""}
                          onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                          placeholder="https://youtube.com/..."
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="location">Location</Label>
                        <Input
                          id="location"
                          value={formData.location || ""}
                          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="internal_rate">Internal Rate (₹/hour)</Label>
                        <Input
                          id="internal_rate"
                          type="number"
                          value={formData.internal_rate || ""}
                          onChange={(e) => setFormData({ ...formData, internal_rate: parseFloat(e.target.value) })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="external_rate">External Rate (₹/hour)</Label>
                        <Input
                          id="external_rate"
                          type="number"
                          value={formData.external_rate || ""}
                          onChange={(e) => setFormData({ ...formData, external_rate: parseFloat(e.target.value) })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="technical_contact">Technical Contact</Label>
                        <Input
                          id="technical_contact"
                          value={formData.technical_contact || ""}
                          onChange={(e) => setFormData({ ...formData, technical_contact: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="full_details_url">Full Details URL</Label>
                        <Input
                          id="full_details_url"
                          value={formData.full_details_url || ""}
                          onChange={(e) => setFormData({ ...formData, full_details_url: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="description">Description / More Info</Label>
                        <Textarea
                          id="description"
                          value={formData.description || ""}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          rows={4}
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="available"
                          checked={formData.available || false}
                          onCheckedChange={(checked) => setFormData({ ...formData, available: checked })}
                        />
                        <Label htmlFor="available">Available / Working Status</Label>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 text-sm">
                      <div>
                        <span className="font-semibold">Category:</span> {item.category || "N/A"}
                      </div>
                      <div>
                        <span className="font-semibold">Status:</span>{" "}
                        <span className={item.available ? "text-green-600" : "text-red-600"}>
                          {item.available ? "Available" : "Unavailable"}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold">Internal Rate:</span> ₹{item.internal_rate || 0}/hour
                      </div>
                      <div>
                        <span className="font-semibold">External Rate:</span> ₹{item.external_rate || 0}/hour
                      </div>
                      <div className="md:col-span-2">
                        <span className="font-semibold">Description:</span> {item.description || "N/A"}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminPanel;
