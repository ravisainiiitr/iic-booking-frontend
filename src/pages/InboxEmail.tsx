import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Inbox, Loader2, Mail, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { toast } from "sonner";
import { format } from "date-fns";

type InboxEmail = {
  uid: string;
  subject: string;
  from: string;
  date: string | null;
  date_raw: string;
  body_plain: string;
  body_html: string;
};

type FolderWithCount = { name: string; count: number };

const InboxEmailPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isAdmin = userTypeStr === "admin";

  const [emails, setEmails] = useState<InboxEmail[]>([]);
  const [mailboxTotal, setMailboxTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [folders, setFolders] = useState<FolderWithCount[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string>("INBOX");

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!isAdmin) {
      toast.error("Only admin can access Inbox.");
      navigate("/admin-settings");
      return;
    }
  }, [navigate, isAuthenticated, user, isAdmin, authLoading]);

  const loadFolders = async () => {
    setLoadingFolders(true);
    try {
      const res = await apiClient.listInboxFolders();
      const data = res as { folders?: FolderWithCount[]; error?: string };
      if (data.error) {
        toast.error(data.error);
        return;
      }
      const list = Array.isArray(data.folders) ? data.folders : [];
      setFolders(list);
      if (list.length > 0 && !list.some((f) => f.name === selectedFolder)) {
        setSelectedFolder(list[0].name);
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      toast.error(err?.response?.data?.error ?? err?.message ?? "Failed to load folders");
    } finally {
      setLoadingFolders(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadFolders();
  }, [isAdmin]);

  const fetchEmails = async () => {
    setLoading(true);
    setMailboxTotal(null);
    try {
      const res = await apiClient.fetchInboxEmails({
        mailbox: selectedFolder,
        max_count: 50,
      });
      const data = res as { emails?: InboxEmail[]; count?: number; mailbox_total?: number; error?: string };
      if (data.error) {
        toast.error(data.error);
        setEmails([]);
        return;
      }
      const list = Array.isArray(data.emails) ? data.emails : [];
      setEmails(list);
      setMailboxTotal(data.mailbox_total ?? null);
      setExpandedId(null);
      if (list.length > 0) {
        toast.success(`Fetched ${list.length} email(s) from ${selectedFolder}.`);
      } else if ((data.mailbox_total ?? 0) === 0) {
        toast.info(`${selectedFolder} is empty. Try another folder.`);
      } else {
        toast.info(`${selectedFolder} has ${data.mailbox_total} message(s); none could be fetched (server may use a different format).`);
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      const msg = err?.response?.data?.error ?? err?.message ?? "Failed to fetch emails";
      toast.error(msg);
      setEmails([]);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin && !authLoading) return null;

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin-settings/communication")}
              className="mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Communication
            </Button>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Inbox className="h-8 w-8" />
              Inbox Email
            </h1>
            <p className="text-muted-foreground mt-1">
              Fetch and view emails received in the configured IMAP mailbox.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" onClick={loadFolders} disabled={loadingFolders}>
              {loadingFolders ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Refresh folders
            </Button>
            <Select value={selectedFolder} onValueChange={setSelectedFolder}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select folder" />
              </SelectTrigger>
              <SelectContent>
                {folders.map((f) => (
                  <SelectItem key={f.name} value={f.name}>
                    {f.name} ({f.count})
                  </SelectItem>
                ))}
                {folders.length === 0 && !loadingFolders && (
                  <SelectItem value="INBOX">INBOX</SelectItem>
                )}
              </SelectContent>
            </Select>
            <Button onClick={fetchEmails} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            Fetch email
          </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Inbox</CardTitle>
            <CardDescription>
              Choose a folder (with message count), then click &quot;Fetch email&quot; to load messages from the
              configured IMAP server (e.g. mapi.iitr.ac.in).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading && emails.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-10 w-10 animate-spin mr-2" />
                Connecting to mailbox…
              </div>
            ) : emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Inbox className="h-12 w-12 mb-4 opacity-50" />
                <p>No emails loaded.</p>
                {mailboxTotal !== null && (
                  <p className="text-sm mt-1">
                    {mailboxTotal === 0
                      ? `${selectedFolder} is empty. Try another folder from the dropdown above.`
                      : `${selectedFolder} reports ${mailboxTotal} message(s). If you expected mail, the server may use a different IMAP format.`}
                  </p>
                )}
                {mailboxTotal === null && (
                  <p className="text-sm mt-1">Click &quot;Fetch email&quot; to load inbox messages.</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {emails.map((em) => (
                  <Collapsible
                    key={em.uid}
                    open={expandedId === em.uid}
                    onOpenChange={(open) => setExpandedId(open ? em.uid : null)}
                  >
                    <Card className="overflow-hidden">
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/50 transition-colors"
                        >
                          <span className="mt-0.5 text-muted-foreground">
                            {expandedId === em.uid ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{em.subject || "(No subject)"}</div>
                            <div className="text-sm text-muted-foreground truncate mt-0.5">{em.from}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {em.date ? format(new Date(em.date), "dd MMM yyyy, HH:mm") : em.date_raw || "—"}
                            </div>
                          </div>
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t bg-muted/30 px-4 py-3">
                          <div className="text-sm whitespace-pre-wrap break-words">
                            {em.body_plain || em.body_html || "(No body)"}
                          </div>
                          {em.body_html && !em.body_plain && (
                            <div
                              className="mt-3 text-sm prose prose-sm max-w-none dark:prose-invert"
                              dangerouslySetInnerHTML={{ __html: em.body_html }}
                            />
                          )}
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default InboxEmailPage;
