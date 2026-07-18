import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, Layout, Menu, Loader2, Image } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { PageHero, PageShell, SettingsTile } from "@/components/PageShell";

const ContentManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [allowed, setAllowed] = useState(false);

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
      if (String(userRes.data.user_type ?? "").toLowerCase() !== "admin") {
        toast({ title: "Access Denied", description: "Only Admin can manage content.", variant: "destructive" });
        navigate("/dashboard");
        return;
      }
      setAllowed(true);
    };
    check();
  }, [navigate, toast]);

  if (!allowed) {
    return (
      <div className="page-shell flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
      </div>
    );
  }

  return (
    <PageShell>
      <main className="container mx-auto px-4 py-8">
        <PageHero
          title="Content Management"
          description="Manage menu, pages, home content, and hero images for the public site."
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="mb-4 text-white/90 hover:text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </PageHero>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SettingsTile
            icon={<Menu className="h-5 w-5" />}
            title="Menu & Submenu"
            description="Navigation items with priority ordering"
            onClick={() => navigate("/admin/section/cmsMenu")}
          />
          <SettingsTile
            icon={<Layout className="h-5 w-5" />}
            title="Pages"
            description="CMS pages published on the public site"
            onClick={() => navigate("/admin/section/cmsPages")}
          />
          <SettingsTile
            icon={<Home className="h-5 w-5" />}
            title="Home Page Content"
            description="Hero copy, CTAs, and homepage stats"
            onClick={() => navigate("/admin/section/cmsHome")}
          />
          <SettingsTile
            icon={<Image className="h-5 w-5" />}
            title="Hero / Background Images"
            description="Carousel slides behind the landing hero"
            onClick={() => navigate("/admin/hero-slides")}
          />
        </div>
      </main>
    </PageShell>
  );
};

export default ContentManagement;
