import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import UserGuideDialog from "@/components/UserGuide/UserGuideDialog";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeUserTypeCode } from "@/lib/userTypes";
import { buildGuide, GUIDE_AUDIENCE_LABELS, GUIDE_AUDIENCES, type GuideAudienceId, type GuideFeatureFlags } from "@/guides";
import { cn } from "@/lib/utils";

const ALL_ON: GuideFeatureFlags = {
  assistant: true,
  inChatBooking: true,
  projectGrant: true,
  directCash: true,
  onlineGateway: true,
  peerTransfer: true,
  creditFacility: true,
  studentRecharge: true,
  externalBooking: true,
  oicLeaveManagement: true,
  oicTaNomination: true,
};

/** Admin-only review of every role's guide, as each role sees it. Visit: /dev/user-guides */
const UserGuidePreview = () => {
  const { user, loading } = useAuth();
  const [audience, setAudience] = useState<GuideAudienceId>("student");
  const [allFeatures, setAllFeatures] = useState(true);
  const [open, setOpen] = useState(true);

  const guide = useMemo(() => buildGuide({ audience, flags: allFeatures ? ALL_ON : undefined }), [audience, allFeatures]);

  if (loading) return null;
  if (normalizeUserTypeCode(user?.user_type ?? null) !== "admin") return <Navigate to="/user-guide" replace />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      <div className="container mx-auto max-w-3xl space-y-6 px-4 py-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/dashboard">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Dashboard
          </Link>
        </Button>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <BookOpen className="h-5 w-5 text-primary" />
              User guide preview
            </CardTitle>
            <CardDescription>Each user only sees the guide for their own role. Pick a role to see it as they do.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {GUIDE_AUDIENCES.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setAudience(id);
                    setOpen(true);
                  }}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                    audience === id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  {GUIDE_AUDIENCE_LABELS[id]}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={allFeatures} onCheckedChange={setAllFeatures} />
              All optional features on (off = portal defaults)
            </label>
            <p className="text-xs text-muted-foreground">
              {guide.sections.length} chapters · {guide.whatsNew.items.length} What's New items
            </p>
            <Button onClick={() => setOpen(true)}>Open guide</Button>
          </CardContent>
        </Card>
      </div>

      <UserGuideDialog open={open} onOpenChange={setOpen} guide={guide} userName="Preview Reviewer" />
    </div>
  );
};

export default UserGuidePreview;
