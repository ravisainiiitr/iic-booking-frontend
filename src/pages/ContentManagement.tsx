import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ChevronRight, Home, Layout, Menu } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";

const ContentManagement = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold">Content Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage menu, pages, home content, and hero images for the public site.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Layout className="h-6 w-6" />
              Content Management (CMS)
            </CardTitle>
            <CardDescription>
              Main page and navigation: menu items (with priority) and home page hero, CTAs, and stats
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <button
              type="button"
              onClick={() => navigate("/admin/section/cmsMenu")}
              className="w-full flex items-center justify-between gap-3 rounded-lg border p-3 text-left hover:bg-accent/50 hover:border-primary/30 transition-colors"
            >
              <span className="flex items-center gap-3">
                <Menu className="h-5 w-5" />
                <span className="font-medium">Menu & Submenu</span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={() => navigate("/admin/section/cmsPages")}
              className="w-full flex items-center justify-between gap-3 rounded-lg border p-3 text-left hover:bg-accent/50 hover:border-primary/30 transition-colors"
            >
              <span className="flex items-center gap-3">
                <Layout className="h-5 w-5" />
                <span className="font-medium">Pages</span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={() => navigate("/admin/section/cmsHome")}
              className="w-full flex items-center justify-between gap-3 rounded-lg border p-3 text-left hover:bg-accent/50 hover:border-primary/30 transition-colors"
            >
              <span className="flex items-center gap-3">
                <Home className="h-5 w-5" />
                <span className="font-medium">Home Page Content</span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={() => navigate("/admin/hero-slides")}
              className="w-full flex items-center justify-between gap-3 rounded-lg border p-3 text-left hover:bg-accent/50 hover:border-primary/30 transition-colors"
            >
              <span className="flex items-center gap-3">
                <Layout className="h-5 w-5" />
                <span className="font-medium">Hero / Background Images</span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ContentManagement;
