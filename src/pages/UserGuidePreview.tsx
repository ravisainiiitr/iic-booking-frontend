import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import UserGuideDialog from "@/components/UserGuide/UserGuideDialog";
import { GUIDE_AUDIENCE_LABELS, getGuideContent, type GuideAudienceId } from "@/guides";
import { BookOpen, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const AUDIENCES: GuideAudienceId[] = [
  "student",
  "faculty",
  "external",
  "project_staff",
  "startup",
  "oic",
  "operator",
  "dept_admin",
  "admin",
  "finance",
  "external_relations",
];

/**
 * Local review page — switch audiences and open the same dialog users will see.
 * Visit: /dev/user-guides
 */
const UserGuidePreview = () => {
  const [audience, setAudience] = useState<GuideAudienceId>("student");
  const [open, setOpen] = useState(true);

  const guide = useMemo(() => getGuideContent(audience), [audience]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      <div className="container mx-auto max-w-3xl px-4 py-10 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Home
            </Link>
          </Button>
        </div>

        <Card className="border-primary/70 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <BookOpen className="h-5 w-5 text-primary" />
              User Guide Preview
            </CardTitle>
            <CardDescription>
              Review all role guides before production. This page is for local/QA use (
              <code className="text-xs">/dev/user-guides</code>).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {AUDIENCES.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setAudience(id);
                    setOpen(true);
                  }}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    audience === id
                      ? "border-primary bg-primary text-white"
                      : "bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  {GUIDE_AUDIENCE_LABELS[id]}
                </button>
              ))}
            </div>

            <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Selected: </span>
                <strong>{guide.audienceLabel}</strong>
              </p>
              <p className="text-muted-foreground">{guide.subtitle}</p>
              <p className="text-xs text-muted-foreground">
                {guide.sections.length} sections · Welcome screen + step navigation + PDF export
              </p>
            </div>

            <Button
              className="bg-primary hover:bg-primary/90"
              onClick={() => setOpen(true)}
            >
              Open guide dialog
            </Button>
          </CardContent>
        </Card>
      </div>

      <UserGuideDialog
        open={open}
        onOpenChange={setOpen}
        guide={guide}
        userName="Preview Reviewer"
      />
    </div>
  );
};

export default UserGuidePreview;
