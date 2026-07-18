import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, ImageIcon } from "lucide-react";

interface HeroSlideItem {
  id: number;
  order: number;
  alt_text: string;
  is_active: boolean;
  image_url: string | null;
  created_at?: string;
  updated_at?: string;
}

export default function AdminHeroSlides() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [slides, setSlides] = useState<HeroSlideItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [order, setOrder] = useState(0);
  const [altText, setAltText] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      const token = apiClient.getToken();
      if (!token) {
        navigate("/auth");
        return;
      }
      const userRes = await apiClient.getCurrentUser();
      if (userRes.error || !userRes.data) {
        navigate("/auth");
        return;
      }
      const isAdmin = apiClient.isAdminPanelUser(userRes.data.user_type);
      const roleRes = await apiClient.checkAdminRole(String(userRes.data.id));
      if (!isAdmin && roleRes.data?.is_admin !== true) {
        toast({ title: "Access Denied", variant: "destructive" });
        navigate("/dashboard");
        return;
      }
      setAuthChecked(true);
    };
    check();
  }, [navigate, toast]);

  useEffect(() => {
    if (!authChecked) return;
    const fetchSlides = async () => {
      setLoading(true);
      const res = await apiClient.adminList<HeroSlideItem>("cmsHeroSlides");
      if (res.error) {
        toast({ title: "Error", description: res.error, variant: "destructive" });
        setSlides([]);
      } else {
        setSlides(Array.isArray(res.data) ? res.data : []);
      }
      setLoading(false);
    };
    fetchSlides();
  }, [authChecked, toast]);

  const openAdd = () => {
    setEditingId(null);
    setOrder(slides.length);
    setAltText("");
    setIsActive(true);
    setImageFile(null);
    setImagePreview(null);
    setModalOpen(true);
  };

  const openEdit = (slide: HeroSlideItem) => {
    setEditingId(slide.id);
    setOrder(slide.order);
    setAltText(slide.alt_text || "");
    setIsActive(slide.is_active);
    setImageFile(null);
    setImagePreview(slide.image_url || null);
    setModalOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    } else {
      setImageFile(null);
      setImagePreview(null);
    }
  };

  const handleSave = async () => {
    if (editingId === null) {
      if (!imageFile) {
        toast({ title: "Image required", description: "Please select an image.", variant: "destructive" });
        return;
      }
      setSaving(true);
      const res = await apiClient.adminCmsHeroSlideCreate(
        { order, alt_text: altText, is_active: isActive },
        imageFile
      );
      setSaving(false);
      if (res.error) {
        toast({ title: "Error", description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: "Success", description: "Hero slide added." });
      setModalOpen(false);
      const listRes = await apiClient.adminList<HeroSlideItem>("cmsHeroSlides");
      if (!listRes.error && Array.isArray(listRes.data)) setSlides(listRes.data);
    } else {
      setSaving(true);
      const res = await apiClient.adminCmsHeroSlideUpdate(
        editingId,
        { order, alt_text: altText, is_active: isActive },
        imageFile ?? undefined
      );
      setSaving(false);
      if (res.error) {
        toast({ title: "Error", description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: "Success", description: "Hero slide updated." });
      setModalOpen(false);
      const listRes = await apiClient.adminList<HeroSlideItem>("cmsHeroSlides");
      if (!listRes.error && Array.isArray(listRes.data)) setSlides(listRes.data);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this hero slide?")) return;
    const res = await apiClient.adminDelete("cmsHeroSlides", id);
    if (res.error) {
      toast({ title: "Error", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: "Deleted", description: "Hero slide removed." });
    setSlides((prev) => prev.filter((s) => s.id !== id));
  };

  if (!authChecked) return null;

  return (
    <div className="page-shell">
      <DashboardHeader />
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" className="mb-4 gap-2" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-6 w-6" />
              Hero / Background Images (Main Page)
            </CardTitle>
            <CardDescription>
              Add or edit images for the main page hero carousel. These appear as the background on the home page. Order by the &quot;Order&quot; number (lower = first).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-end mb-4">
              <Button onClick={openAdd} className="gap-2">
                <Plus className="h-4 w-4" />
                Add image
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : slides.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No hero images yet. Add images to show them on the main page carousel. If none are added, the app uses default placeholder images.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {slides.map((slide) => (
                  <div
                    key={slide.id}
                    className="border rounded-lg overflow-hidden bg-muted/30"
                  >
                    <div className="aspect-video bg-muted flex items-center justify-center">
                      {slide.image_url ? (
                        <img
                          src={slide.image_url}
                          alt={slide.alt_text || "Hero slide"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-12 w-12 text-muted-foreground" />
                      )}
                    </div>
                    <div className="p-3 flex justify-between items-center">
                      <div>
                        <p className="font-medium text-sm">Order: {slide.order}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                          {slide.alt_text || "—"}
                        </p>
                        {!slide.is_active && (
                          <span className="text-xs text-amber-600">Inactive</span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(slide)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDelete(slide.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId === null ? "Add hero image" : "Edit hero image"}</DialogTitle>
            <DialogDescription>
              Upload a landscape image for the main page carousel. Recommended: high resolution, wide aspect.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Image *</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
              />
              {editingId !== null && !imageFile && (
                <p className="text-xs text-muted-foreground">Leave empty to keep current image.</p>
              )}
              {imagePreview && (
                <div className="mt-2 rounded border overflow-hidden max-h-40">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Order (lower = first)</Label>
              <Input
                type="number"
                min={0}
                value={order}
                onChange={(e) => setOrder(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>Alt text (accessibility)</Label>
              <Input
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="e.g. Laboratory equipment"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="active"
                checked={isActive}
                onCheckedChange={(c) => setIsActive(c === true)}
              />
              <Label htmlFor="active">Active (show on main page)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || (editingId === null && !imageFile)}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
