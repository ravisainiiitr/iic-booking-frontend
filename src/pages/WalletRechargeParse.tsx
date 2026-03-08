import { useEffect, useState, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, type WalletRechargeParseRow } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, FileUp, Loader2, Wallet, CheckCircle2, Circle, Mail, ChevronDown, ChevronUp, Paperclip, Download, Pencil, Check } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { toast } from "sonner";

/** Unique key for an entry: date + receipt_no + emp_no (cumulative table dedup). */
function rowKey(r: WalletRechargeParseRow): string {
  return `${r.date ?? ""}|${r.receipt_no}|${r.emp_no}`;
}

const IMAP_PARAMS_STORAGE_KEY = "wallet_recharge_imap_params";

type ImapSavedParams = {
  email: string;
  password: string;
  host: string;
  port: number;
  use_ssl: boolean;
  folder: string;
  sender_filter: string;
  subject_filter: string;
};

function loadSavedImapParams(): ImapSavedParams | null {
  try {
    const s = localStorage.getItem(IMAP_PARAMS_STORAGE_KEY);
    if (!s) return null;
    const parsed = JSON.parse(s) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      email: typeof parsed.email === "string" ? parsed.email : "",
      password: typeof parsed.password === "string" ? parsed.password : "",
      host: typeof parsed.host === "string" ? parsed.host : "imap.gmail.com",
      port: typeof parsed.port === "number" ? parsed.port : 993,
      use_ssl: parsed.use_ssl === true || parsed.use_ssl === false ? parsed.use_ssl : true,
      folder: typeof parsed.folder === "string" ? parsed.folder : "INBOX",
      sender_filter: typeof parsed.sender_filter === "string" ? parsed.sender_filter : "",
      subject_filter: typeof parsed.subject_filter === "string" ? parsed.subject_filter : "",
    };
  } catch {
    return null;
  }
}

function saveImapParamsToStorage(params: ImapSavedParams): void {
  try {
    localStorage.setItem(IMAP_PARAMS_STORAGE_KEY, JSON.stringify(params));
  } catch {
    // ignore
  }
}

const WalletRechargeParsePage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isAdmin = userTypeStr === "admin";

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [rows, setRows] = useState<WalletRechargeParseRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  // IMAP fetch from email
  const [imapEmail, setImapEmail] = useState("");
  const [imapPassword, setImapPassword] = useState("");
  const [imapHost, setImapHost] = useState("imap.gmail.com");
  const [imapPort, setImapPort] = useState(993);
  const [imapUseSsl, setImapUseSsl] = useState(true);
  const [imapFolder, setImapFolder] = useState("INBOX");
  const [imapSenderFilter, setImapSenderFilter] = useState("");
  const [imapSubjectFilter, setImapSubjectFilter] = useState("");
  const [imapEmails, setImapEmails] = useState<Array<{ uid: string; subject: string; from_addr: string; date: string }>>([]);
  const [imapLoading, setImapLoading] = useState(false);
  const [imapFetchingUid, setImapFetchingUid] = useState<string | null>(null);
  const [imapSectionOpen, setImapSectionOpen] = useState(false);
  const [imapExpandedUid, setImapExpandedUid] = useState<string | null>(null);
  const [imapAttachmentsByUid, setImapAttachmentsByUid] = useState<Record<string, Array<{ index: number; filename: string; size?: number }>>>({});
  const [imapAttachmentsLoadingUid, setImapAttachmentsLoadingUid] = useState<string | null>(null);
  const [imapParamsLocked, setImapParamsLocked] = useState(false);
  const [imapEditingFields, setImapEditingFields] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isAdmin) return;
    const saved = loadSavedImapParams();
    if (saved) {
      setImapEmail(saved.email);
      setImapPassword(saved.password);
      setImapHost(saved.host);
      setImapPort(saved.port);
      setImapUseSsl(saved.use_ssl);
      setImapFolder(saved.folder);
      setImapSenderFilter(saved.sender_filter);
      setImapSubjectFilter(saved.subject_filter);
      setImapParamsLocked(true);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!isAdmin) {
      toast.error("Only admin users can parse wallet recharge files.");
      navigate("/admin-settings");
      return;
    }
    let cancelled = false;
    setEntriesLoading(true);
    apiClient.getWalletRechargeParseEntries().then((res) => {
      if (cancelled) return;
      setEntriesLoading(false);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setRows(res.data?.rows ?? []);
    });
    return () => { cancelled = true; };
  }, [navigate, isAuthenticated, user, isAdmin, authLoading]);

  const handleParse = async () => {
    if (!file) {
      toast.error("Please select a file first.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await apiClient.parseWalletRechargeFile(file);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const list = res.data?.rows ?? [];
      const merged = (() => {
        const byKey = new Map<string, WalletRechargeParseRow>();
        rows.forEach((r) => byKey.set(rowKey(r), r));
        list.forEach((r) => byKey.set(rowKey(r), r));
        return Array.from(byKey.values());
      })();
      setRows(merged);
      const saveRes = await apiClient.saveWalletRechargeParseEntries(merged);
      if (saveRes.error) {
        toast.warning(saveRes.error + " Table updated locally.");
        return;
      }
      if (saveRes.data?.rows) setRows(saveRes.data.rows);
      if (res.data?.message) setMessage(res.data.message);
      if (list.length > 0) {
        const prevKeys = new Set(rows.map((r) => rowKey(r)));
        const added = list.filter((r) => !prevKeys.has(rowKey(r))).length;
        const matched = list.filter((r) => r.matched_user).length;
        toast.success(
          added === list.length
            ? `Parsed ${list.length} row(s). ${matched} matched by Employee/Student ID.`
            : `Parsed ${list.length} row(s); ${added} new entries added (${list.length - added} already in table, updated). ${matched} matched.`
        );
      } else {
        toast.info(res.data?.message ?? "No rows parsed. Check file format (e.g. SlNo, Dated, ReceiptNo, Amount(Rs), Payment Details, Received From).");
      }
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(err?.message ?? "Failed to parse file");
    } finally {
      setLoading(false);
    }
  };

  const rowsToProcess = rows.filter((r) => r.matched_user && !r.processed);
  const handleProcessMatched = async () => {
    if (rowsToProcess.length === 0) {
      toast.error("No matched, unprocessed rows to credit. Parse a file and ensure rows have a matched user.");
      return;
    }
    setProcessing(true);
    try {
      const res = await apiClient.processWalletRechargeRows(rowsToProcess);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const processedReceipts = res.data?.processed_receipts ?? [];
      if (processedReceipts.length > 0) {
        const refetch = await apiClient.getWalletRechargeParseEntries();
        if (!refetch.error && refetch.data?.rows) setRows(refetch.data.rows);
        toast.success(
          `Credited ${res.data?.credited ?? 0} row(s). Email sent to Supervisor(s).${(res.data?.errors?.length ?? 0) > 0 ? ` ${res.data!.errors.length} warning(s).` : ""}`
        );
        res.data?.errors?.forEach((msg) => toast.warning(msg));
      } else {
        if ((res.data?.errors?.length ?? 0) > 0) {
          res.data!.errors.forEach((msg) => toast.warning(msg));
        }
        toast.info(res.data?.errors?.[0] ?? "No rows were credited (may already be processed or skipped).");
      }
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(err?.message ?? "Failed to process rows");
    } finally {
      setProcessing(false);
    }
  };

  const handleImapFetch = async () => {
    if (!imapEmail.trim() || !imapPassword) {
      toast.error("Enter email and password for IMAP.");
      return;
    }
    setImapLoading(true);
    setImapEmails([]);
    try {
      const res = await apiClient.walletImapListEmails({
        email: imapEmail.trim(),
        password: imapPassword,
        host: imapHost.trim() || "imap.gmail.com",
        port: imapPort,
        use_ssl: imapUseSsl,
        folder: imapFolder.trim() || "INBOX",
        sender_filter: imapSenderFilter.trim() || undefined,
        subject_filter: imapSubjectFilter.trim() || undefined,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const emails = res.data?.emails ?? [];
      setImapEmails(emails);
      if (emails.length === 0) {
        toast.info("No emails found.");
      } else {
        const hasFilters = !!(imapSenderFilter.trim() || imapSubjectFilter.trim());
        if (hasFilters) {
          // Auto fetch and parse first matching email
          const first = emails[0];
          if (first?.uid) {
            setImapFetchingUid(first.uid);
            try {
              const parseRes = await apiClient.walletImapFetchAndParse({
                email: imapEmail.trim(),
                password: imapPassword,
                email_uid: first.uid,
                host: imapHost.trim() || "imap.gmail.com",
                port: imapPort,
                use_ssl: imapUseSsl,
                folder: imapFolder.trim() || "INBOX",
              });
              if (parseRes.error) {
                toast.error(parseRes.error);
                return;
              }
              const list = parseRes.data?.rows ?? [];
              if (list.length > 0) {
                const merged = (() => {
                  const byKey = new Map<string, WalletRechargeParseRow>();
                  rows.forEach((r) => byKey.set(rowKey(r), r));
                  list.forEach((r) => byKey.set(rowKey(r), r));
                  return Array.from(byKey.values());
                })();
                setRows(merged);
                const saveRes = await apiClient.saveWalletRechargeParseEntries(merged);
                if (!saveRes.error && saveRes.data?.rows) setRows(saveRes.data.rows);
                toast.success(`Parsed ${list.length} row(s) from email.`);
              } else {
                toast.info(parseRes.data?.message ?? "No rows parsed from attachment.");
              }
            } catch {
              toast.error("Failed to parse attachment.");
            } finally {
              setImapFetchingUid(null);
            }
          }
        } else {
          toast.success(`Listed ${emails.length} email(s). Use "Use & parse" on an email to parse its attachment.`);
        }
      }
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(err?.message ?? "Failed to list emails");
    } finally {
      setImapLoading(false);
    }
  };

  const handleImapUseAndParse = async (uid: string, attachmentIndex?: number) => {
    if (!imapEmail.trim() || !imapPassword) {
      toast.error("Enter email and password for IMAP.");
      return;
    }
    setImapFetchingUid(uid);
    try {
      const parseRes = await apiClient.walletImapFetchAndParse({
        email: imapEmail.trim(),
        password: imapPassword,
        email_uid: uid,
        attachment_index: attachmentIndex,
        host: imapHost.trim() || "imap.gmail.com",
        port: imapPort,
        use_ssl: imapUseSsl,
        folder: imapFolder.trim() || "INBOX",
      });
      if (parseRes.error) {
        toast.error(parseRes.error);
        return;
      }
      const list = parseRes.data?.rows ?? [];
      if (list.length > 0) {
        const merged = (() => {
          const byKey = new Map<string, WalletRechargeParseRow>();
          rows.forEach((r) => byKey.set(rowKey(r), r));
          list.forEach((r) => byKey.set(rowKey(r), r));
          return Array.from(byKey.values());
        })();
        setRows(merged);
        const saveRes = await apiClient.saveWalletRechargeParseEntries(merged);
        if (!saveRes.error && saveRes.data?.rows) setRows(saveRes.data.rows);
        toast.success(`Parsed ${list.length} row(s) from email.`);
      } else {
        toast.info(parseRes.data?.message ?? "No rows parsed from attachment.");
      }
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(err?.message ?? "Failed to parse");
    } finally {
      setImapFetchingUid(null);
    }
  };

  const handleImapShowAttachments = async (uid: string) => {
    if (imapExpandedUid === uid) {
      setImapExpandedUid(null);
      return;
    }
    if (!imapEmail.trim() || !imapPassword) {
      toast.error("Enter email and password for IMAP.");
      return;
    }
    setImapAttachmentsLoadingUid(uid);
    try {
      const res = await apiClient.walletImapEmailAttachments({
        email: imapEmail.trim(),
        password: imapPassword,
        email_uid: uid,
        host: imapHost.trim() || "imap.gmail.com",
        port: imapPort,
        use_ssl: imapUseSsl,
        folder: imapFolder.trim() || "INBOX",
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const attachments = res.data?.attachments ?? [];
      setImapAttachmentsByUid((prev) => ({ ...prev, [uid]: attachments }));
      setImapExpandedUid(uid);
      if (attachments.length === 0) toast.info("No attachments in this email.");
    } finally {
      setImapAttachmentsLoadingUid(null);
    }
  };

  const handleImapDownload = async (uid: string, attachmentIndex: number, filename: string) => {
    if (!imapEmail.trim() || !imapPassword) return;
    try {
      const res = await apiClient.walletImapDownloadAttachment({
        email: imapEmail.trim(),
        password: imapPassword,
        email_uid: uid,
        attachment_index: attachmentIndex,
        host: imapHost.trim() || "imap.gmail.com",
        port: imapPort,
        use_ssl: imapUseSsl,
        folder: imapFolder.trim() || "INBOX",
      });
      if (res.error || !res.data?.content_base64) {
        toast.error(res.error ?? "Download failed");
        return;
      }
      const bin = atob(res.data.content_base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.data.filename || filename || "attachment";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Download started.");
    } catch (e: unknown) {
      toast.error((e as { message?: string })?.message ?? "Download failed");
    }
  };

  const isImapFieldEditable = (field: string) => !imapParamsLocked || !!imapEditingFields[field];
  const setImapFieldEditable = (field: string, editable: boolean) => {
    setImapEditingFields((prev) => ({ ...prev, [field]: editable }));
  };
  const handleImapSaveParams = () => {
    saveImapParamsToStorage({
      email: imapEmail.trim(),
      password: imapPassword,
      host: imapHost.trim() || "imap.gmail.com",
      port: imapPort,
      use_ssl: imapUseSsl,
      folder: imapFolder.trim() || "INBOX",
      sender_filter: imapSenderFilter.trim(),
      subject_filter: imapSubjectFilter.trim(),
    });
    setImapParamsLocked(true);
    setImapEditingFields({});
    toast.success("IMAP parameters saved. They will load next time.");
  };

  if (!isAdmin && !authLoading) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin-settings")}
              className="mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin Settings
            </Button>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Wallet className="h-8 w-8" />
              Parse Wallet Recharge File
            </h1>
            <p className="text-muted-foreground mt-1">
              Upload an IIC fund transfer / wallet recharge file (tab or comma separated). Parsed data is shown in a table: Date, Receipt No, Name, Emp No, Department, Amount (Rs), Payment Details.
            </p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileUp className="h-5 w-5" />
              Upload and parse
            </CardTitle>
            <CardDescription>
              File should have headers: SlNo, Dated, ReceiptNo, Amount(Rs), Payment Details, Received From (with EMP NO-xxxx, DEPT-...). Name and Department are extracted from &quot;Received From&quot;; we match rows to users by Employee/Student ID.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-muted-foreground block mb-1">File</label>
              <input
                type="file"
                accept=".txt,.csv,text/plain,text/csv"
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:font-medium"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button onClick={handleParse} disabled={loading || !file}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <FileUp className="h-4 w-4 mr-2" />
              )}
              {loading ? "Parsing…" : "Upload and parse"}
            </Button>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader
            className="cursor-pointer pb-2"
            onClick={() => setImapSectionOpen(!imapSectionOpen)}
          >
            <CardTitle className="text-base flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Fetch file from email (IMAP)
              </span>
              {imapSectionOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </CardTitle>
            <CardDescription>
              Enter IMAP credentials and optional filters. Click Fetch: with no filters, the last 50 emails are listed; with sender/subject filter, the first matching email&apos;s attachment is parsed automatically.
              Use your normal email password for IMAP; for Gmail with 2FA you may need an App Password.
            </CardDescription>
          </CardHeader>
          {imapSectionOpen && (
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleImapSaveParams}
                  className="shrink-0"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Save parameters
                </Button>
                <span className="text-xs text-muted-foreground">
                  {imapParamsLocked ? "Parameters are read-only. Use Edit next to a field to change it." : "Edit fields and click Save to store for next time."}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    Email
                    {imapParamsLocked && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1 text-xs"
                        onClick={() => setImapFieldEditable("email", true)}
                      >
                        <Pencil className="h-3 w-3 mr-0.5" /> Edit
                      </Button>
                    )}
                  </label>
                  <input
                    type="email"
                    value={imapEmail}
                    onChange={(e) => setImapEmail(e.target.value)}
                    placeholder="your@email.com"
                    readOnly={!isImapFieldEditable("email")}
                    className={`w-full rounded-md border border-input bg-background px-3 py-2 text-sm ${!isImapFieldEditable("email") ? "bg-muted/50 cursor-not-allowed" : ""}`}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    Password
                    {imapParamsLocked && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1 text-xs"
                        onClick={() => setImapFieldEditable("password", true)}
                      >
                        <Pencil className="h-3 w-3 mr-0.5" /> Edit
                      </Button>
                    )}
                  </label>
                  <input
                    type="password"
                    value={imapPassword}
                    onChange={(e) => setImapPassword(e.target.value)}
                    placeholder="••••••••"
                    readOnly={!isImapFieldEditable("password")}
                    className={`w-full rounded-md border border-input bg-background px-3 py-2 text-sm ${!isImapFieldEditable("password") ? "bg-muted/50 cursor-not-allowed" : ""}`}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    IMAP host
                    {imapParamsLocked && (
                      <Button type="button" variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={() => setImapFieldEditable("host", true)}>
                        <Pencil className="h-3 w-3 mr-0.5" /> Edit
                      </Button>
                    )}
                  </label>
                  <input
                    type="text"
                    value={imapHost}
                    onChange={(e) => setImapHost(e.target.value)}
                    placeholder="imap.gmail.com"
                    readOnly={!isImapFieldEditable("host")}
                    className={`w-full rounded-md border border-input bg-background px-3 py-2 text-sm ${!isImapFieldEditable("host") ? "bg-muted/50 cursor-not-allowed" : ""}`}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    Port
                    {imapParamsLocked && (
                      <Button type="button" variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={() => setImapFieldEditable("port", true)}>
                        <Pencil className="h-3 w-3 mr-0.5" /> Edit
                      </Button>
                    )}
                  </label>
                  <input
                    type="number"
                    value={imapPort}
                    onChange={(e) => setImapPort(parseInt(e.target.value, 10) || 993)}
                    readOnly={!isImapFieldEditable("port")}
                    className={`w-full rounded-md border border-input bg-background px-3 py-2 text-sm ${!isImapFieldEditable("port") ? "bg-muted/50 cursor-not-allowed" : ""}`}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={imapUseSsl}
                      onChange={(e) => setImapUseSsl(e.target.checked)}
                      disabled={!isImapFieldEditable("use_ssl")}
                      className="rounded"
                    />
                    Use SSL
                    {imapParamsLocked && (
                      <Button type="button" variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={() => setImapFieldEditable("use_ssl", true)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </label>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    Folder
                    {imapParamsLocked && (
                      <Button type="button" variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={() => setImapFieldEditable("folder", true)}>
                        <Pencil className="h-3 w-3 mr-0.5" /> Edit
                      </Button>
                    )}
                  </label>
                  <input
                    type="text"
                    value={imapFolder}
                    onChange={(e) => setImapFolder(e.target.value)}
                    placeholder="INBOX"
                    readOnly={!isImapFieldEditable("folder")}
                    className={`w-full rounded-md border border-input bg-background px-3 py-2 text-sm ${!isImapFieldEditable("folder") ? "bg-muted/50 cursor-not-allowed" : ""}`}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    Sender filter (optional)
                    {imapParamsLocked && (
                      <Button type="button" variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={() => setImapFieldEditable("sender_filter", true)}>
                        <Pencil className="h-3 w-3 mr-0.5" /> Edit
                      </Button>
                    )}
                  </label>
                  <input
                    type="text"
                    value={imapSenderFilter}
                    onChange={(e) => setImapSenderFilter(e.target.value)}
                    placeholder="sender@example.com"
                    readOnly={!isImapFieldEditable("sender_filter")}
                    className={`w-full rounded-md border border-input bg-background px-3 py-2 text-sm ${!isImapFieldEditable("sender_filter") ? "bg-muted/50 cursor-not-allowed" : ""}`}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    Subject filter (optional)
                    {imapParamsLocked && (
                      <Button type="button" variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={() => setImapFieldEditable("subject_filter", true)}>
                        <Pencil className="h-3 w-3 mr-0.5" /> Edit
                      </Button>
                    )}
                  </label>
                  <input
                    type="text"
                    value={imapSubjectFilter}
                    onChange={(e) => setImapSubjectFilter(e.target.value)}
                    placeholder="Wallet recharge"
                    readOnly={!isImapFieldEditable("subject_filter")}
                    className={`w-full rounded-md border border-input bg-background px-3 py-2 text-sm ${!isImapFieldEditable("subject_filter") ? "bg-muted/50 cursor-not-allowed" : ""}`}
                  />
                </div>
              </div>
              <Button onClick={handleImapFetch} disabled={imapLoading}>
                {imapLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                {imapLoading ? "Fetching…" : "Fetch"}
              </Button>
              {imapFetchingUid && (
                <p className="text-sm text-muted-foreground">Parsing attachment…</p>
              )}
              {imapEmails.length > 0 && (
                <div className="border rounded-md overflow-hidden">
                  <p className="text-sm font-medium p-2 bg-muted/50">Last {imapEmails.length} email(s)</p>
                  <div className="max-h-[300px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>From</TableHead>
                          <TableHead>Subject</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="w-[100px]">Attachments</TableHead>
                          <TableHead className="w-[120px]">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {imapEmails.map((em) => (
                          <Fragment key={em.uid}>
                            <TableRow>
                              <TableCell className="text-sm truncate max-w-[180px]" title={em.from_addr}>
                                {em.from_addr || "—"}
                              </TableCell>
                              <TableCell className="text-sm truncate max-w-[200px]" title={em.subject}>
                                {em.subject || "—"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{em.date || "—"}</TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleImapShowAttachments(em.uid)}
                                  disabled={imapAttachmentsLoadingUid !== null}
                                >
                                  {imapAttachmentsLoadingUid === em.uid ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : imapExpandedUid === em.uid ? (
                                    "Hide"
                                  ) : (
                                    <>
                                      <Paperclip className="h-4 w-4 mr-1" />
                                      Attachments
                                    </>
                                  )}
                                </Button>
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleImapUseAndParse(em.uid)}
                                  disabled={imapFetchingUid !== null}
                                >
                                  {imapFetchingUid === em.uid ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    "Use & parse"
                                  )}
                                </Button>
                              </TableCell>
                            </TableRow>
                            {imapExpandedUid === em.uid && imapAttachmentsByUid[em.uid] && (
                              <TableRow>
                                <TableCell colSpan={5} className="bg-muted/30 p-3">
                                  <p className="text-xs font-medium text-muted-foreground mb-2">Attachments from sender</p>
                                  <ul className="space-y-2">
                                    {imapAttachmentsByUid[em.uid].map((att) => (
                                      <li key={att.index} className="flex flex-wrap items-center gap-2 text-sm">
                                        <span className="font-medium truncate max-w-[200px]" title={att.filename}>
                                          {att.filename}
                                        </span>
                                        {att.size != null && (
                                          <span className="text-muted-foreground text-xs">
                                            ({(att.size / 1024).toFixed(1)} KB)
                                          </span>
                                        )}
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleImapDownload(em.uid, att.index, att.filename)}
                                        >
                                          <Download className="h-4 w-4 mr-1" />
                                          Download
                                        </Button>
                                        <Button
                                          size="sm"
                                          onClick={() => handleImapUseAndParse(em.uid, att.index)}
                                          disabled={imapFetchingUid !== null}
                                        >
                                          {imapFetchingUid === em.uid ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                          ) : (
                                            <CheckCircle2 className="h-4 w-4 mr-1" />
                                          )}
                                          Use & parse
                                        </Button>
                                      </li>
                                    ))}
                                  </ul>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {message && (
          <p className="text-sm text-muted-foreground mb-4">{message}</p>
        )}

        {entriesLoading && (
          <p className="text-sm text-muted-foreground mb-4">Loading stored entries…</p>
        )}
        {!entriesLoading && rows.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Parsed entries</CardTitle>
              <CardDescription>
                Table is stored on the server and shared across devices and users. Cumulative: new parsed rows are added only when an entry with the same Date, Receipt No, and Emp No does not already exist. Use &quot;Clear table&quot; to reset.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <span className="text-sm text-muted-foreground">
                  {rows.filter((r) => r.processed).length} of {rows.length} processed
                  {rowsToProcess.length > 0 && ` · ${rowsToProcess.length} matched, unprocessed`}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const res = await apiClient.clearWalletRechargeParseEntries();
                      if (res.error) {
                        toast.error(res.error);
                        return;
                      }
                      setRows([]);
                      setMessage(null);
                      toast.info("Table cleared.");
                    }}
                  >
                    Clear table
                  </Button>
                  <Button
                  size="sm"
                  onClick={handleProcessMatched}
                  disabled={processing || rowsToProcess.length === 0}
                >
                  {processing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  {processing ? "Processing…" : "Credit matched rows"}
                </Button>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Receipt No</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Emp No</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Amount (Rs)</TableHead>
                    <TableHead>Payment Details</TableHead>
                    <TableHead className="text-muted-foreground">Matched User</TableHead>
                    <TableHead>Processed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{row.date ?? "—"}</TableCell>
                      <TableCell>{row.receipt_no || "—"}</TableCell>
                      <TableCell>{row.name || "—"}</TableCell>
                      <TableCell>{row.emp_no || "—"}</TableCell>
                      <TableCell>{row.department || "—"}</TableCell>
                      <TableCell>{row.amount ?? "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={row.payment}>{row.payment || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.matched_user ? (
                          <span className="font-medium text-foreground">
                            {row.matched_user.emp_id}
                            <span className="font-normal ml-1">({row.matched_user.name})</span>
                          </span>
                        ) : (
                          row.emp_no ? `No match for ${row.emp_no}` : "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {row.processed ? (
                          <span className="inline-flex items-center text-green-600">
                            <CheckCircle2 className="h-4 w-4 mr-1" aria-hidden /> Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-muted-foreground">
                            <Circle className="h-4 w-4 mr-1" aria-hidden /> No
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default WalletRechargeParsePage;
