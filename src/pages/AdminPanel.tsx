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
import { Loader2, Save, X } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

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

      const adminCheck = await apiClient.checkAdminRole(userResponse.data.id);
      if (adminCheck.error || !adminCheck.data) {
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
      const response = await apiClient.getEquipment();
      if (response.error) {
        throw new Error(response.error);
      }
      setEquipment(response.data || []);
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
        category: formData.category,
        description: formData.description,
        video_url: formData.video_url,
        available: formData.available,
        internal_rate: formData.internal_rate,
        external_rate: formData.external_rate,
        location: formData.location,
        technical_contact: formData.technical_contact,
        full_details_url: formData.full_details_url,
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
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8">Admin Panel - Equipment Management</h1>

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
      <Footer />
    </div>
  );
};

export default AdminPanel;
