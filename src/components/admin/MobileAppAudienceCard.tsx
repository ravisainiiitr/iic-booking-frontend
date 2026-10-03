import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { apiClient, type MobileAppSettingsPayload } from "@/lib/api";
import { formatBytes } from "@/components/staff-app/androidApp";

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

/** Main Administrator: which user types may sign in through the IIC Booking Android app. */
export default function MobileAppAudienceCard() {
  const [settings, setSettings] = useState<MobileAppSettingsPayload | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiClient.getMobileAppSettings().then((res) => {
      if (res.data) {
        setSettings(res.data);
        setSelected(res.data.audience_user_types);
      } else {
        setError(res.error || "Could not load mobile app settings.");
      }
    });
  }, []);

  const toggle = (code: string, on: boolean) =>
    setSelected((prev) => (on ? [...prev.filter((c) => c !== code), code] : prev.filter((c) => c !== code)));

  const save = async () => {
    if (selected.length === 0) {
      toast.error("Choose at least one user type.");
      return;
    }
    setSaving(true);
    const res = await apiClient.updateMobileAppSettings(selected);
    setSaving(false);
    if (!res.data) {
      toast.error(res.error || "Could not save.");
      return;
    }
    setSettings(res.data);
    setSelected(res.data.audience_user_types);
    toast.success("Mobile app audience saved. Phones of removed roles are signed out when they next refresh.");
  };

  const dirty = !!settings && !sameSet(selected, settings.audience_user_types);
  const latest = settings?.latest_release;

  return (
    <Card className="mt-6 max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Mobile app audience
        </CardTitle>
        <CardDescription>
          Who may sign in through the IIC Booking Android app. The website is not affected. Removing a role signs its phones out
          within a few minutes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!settings && !error && (
          <div className="flex items-center gap-2 py-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        )}
        {settings && (
          <>
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="sr-only">User types allowed in the app</legend>
              {settings.choices.map(({ code, name }) => (
                <div key={code} className="flex items-center gap-2">
                  <Checkbox id={`app-aud-${code}`} checked={selected.includes(code)} onCheckedChange={(v) => toggle(code, v === true)} />
                  <Label htmlFor={`app-aud-${code}`} className="font-normal">
                    {name}
                    {settings.default_audience_user_types.includes(code) && (
                      <span className="ml-1 text-xs text-muted-foreground">(default)</span>
                    )}
                  </Label>
                </div>
              ))}
            </fieldset>
            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Message shown to others: </span>
              {settings.refusal_message}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void save()} disabled={saving || !dirty}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
              {dirty && (
                <Button variant="ghost" onClick={() => setSelected(settings.audience_user_types)} disabled={saving}>
                  Undo changes
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {latest ? (
                <>
                  Published app: version {latest.version_name} (build {latest.version_code}), {formatBytes(latest.size_bytes)}.{" "}
                  <Link to="/app-download" className="text-primary underline-offset-4 hover:underline">
                    Download page
                  </Link>
                </>
              ) : (
                "No app version has been published yet."
              )}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
