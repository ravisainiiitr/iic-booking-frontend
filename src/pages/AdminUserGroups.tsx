import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ComposeEmail, type ComposeSeed } from "@/components/userGroups/ComposeEmail";
import { GroupDetail } from "@/components/userGroups/GroupDetail";
import { GroupsList } from "@/components/userGroups/GroupsList";
import { SentEmails } from "@/components/userGroups/SentEmails";
import { useAuth } from "@/contexts/AuthContext";
import { EMPTY_FILTERS, facilityGroupsApi, type AudienceFilters, type GroupsOptions } from "@/lib/facilityGroupsApi";

type Tab = "groups" | "compose" | "sent";
const TABS: Tab[] = ["groups", "compose", "sent"];

export default function AdminUserGroups() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const isAdmin = String(user?.user_type ?? "").toLowerCase() === "admin";
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.includes(params.get("tab") as Tab) ? (params.get("tab") as Tab) : "groups";
  const groupId = Number(params.get("group")) || null;
  const [options, setOptions] = useState<GroupsOptions | null>(null);
  const [optionsError, setOptionsError] = useState("");
  const [seed, setSeed] = useState<ComposeSeed | null>(null);
  const [focusCampaign, setFocusCampaign] = useState<number | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    facilityGroupsApi
      .options()
      .then((res) => {
        setOptions(res);
        setOptionsError("");
      })
      .catch((err: Error) => setOptionsError(err.message || "Could not load user groups."));
  }, [isAdmin]);

  const go = useCallback(
    (next: Tab, extra: Record<string, string> = {}) => {
      const qs = new URLSearchParams({ tab: next, ...extra });
      if (next === "groups" && !extra.group) qs.delete("group");
      setParams(qs);
    },
    [setParams],
  );

  const startEmail = (groupIds: number[], filters: AudienceFilters = EMPTY_FILTERS) => {
    setSeed({ groupIds, filters, nonce: Date.now() });
    go("compose");
  };

  const clearFocus = useCallback(() => setFocusCampaign(null), []);

  return (
    <PageShell>
      <main className="container mx-auto px-4 py-5">
        <StandaloneOnly>
          <PageHero
            title="User Groups & Group Email"
            description="Everyone who books a facility joins its equipment, facility group and lab groups automatically. Look people up by department, export lists, and email whole groups."
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin-settings")}
              className="mb-4 text-white/90 hover:bg-white/20 hover:text-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Admin Settings
            </Button>
          </PageHero>
        </StandaloneOnly>

        {authLoading ? null : !isAdmin ? (
          <p className="rounded-lg border p-6 text-sm text-muted-foreground">Only the Main Administrator can manage user groups.</p>
        ) : (
          <Tabs value={tab} onValueChange={(v) => go(v as Tab)} className="space-y-4">
            <TabsList>
              <TabsTrigger value="groups">Groups</TabsTrigger>
              <TabsTrigger value="compose">Compose email</TabsTrigger>
              <TabsTrigger value="sent">Sent emails</TabsTrigger>
            </TabsList>
            {optionsError ? <p className="text-sm text-destructive">{optionsError}</p> : null}
            <TabsContent value="groups">
              {groupId ? (
                <GroupDetail
                  key={groupId}
                  groupId={groupId}
                  options={options}
                  onBack={() => go("groups")}
                  onEmail={(ids, filters) => startEmail(ids, filters)}
                />
              ) : (
                <GroupsList onOpen={(id) => go("groups", { group: String(id) })} onEmail={(ids) => startEmail(ids)} />
              )}
            </TabsContent>
            <TabsContent value="compose" forceMount className="data-[state=inactive]:hidden">
              <ComposeEmail
                seed={seed}
                options={options}
                onSent={(id) => {
                  setFocusCampaign(id);
                  go("sent");
                }}
              />
            </TabsContent>
            <TabsContent value="sent">
              <SentEmails focusId={focusCampaign} onFocusHandled={clearFocus} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </PageShell>
  );
}
