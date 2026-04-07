import { useCallback, useEffect, useState, useRef, Fragment } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  ArrowLeft,
  FileUp,
  Loader2,
  Wallet,
  CheckCircle2,
  Circle,
  Mail,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Download,
  Pencil,
  Check,
  ClipboardList,
  Search,
  User,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import DashboardHeader from "@/components/DashboardHeader";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

/** Unique key for an entry: date + receipt_no + emp_no (cumulative table dedup). */
function rowKey(r: WalletRechargeParseRow): string {
  return `${r.date ?? ""}|${r.receipt_no}|${r.emp_no}`;
}

/** When employee ID matches a user, Name comes from the directory (replaces parsed file text in the UI). */
function walletHistoryDisplayName(row: WalletRechargeParseRow): string {
  if (row.matched_user) {
    return (row.matched_user.name || row.name || "").trim() || "—";
  }
  return row.name || "—";
}

/** When employee ID matches a user, Department shows their profile department from the database when set. */
function walletHistoryDisplayDepartment(row: WalletRechargeParseRow): string {
  if (row.matched_user) {
    const dn = (row.matched_user.department_name ?? "").trim();
    if (dn) return dn;
  }
  return row.department || "—";
}

function mergeParseRowLists(a: WalletRechargeParseRow[], b: WalletRechargeParseRow[]): WalletRechargeParseRow[] {
  const byKey = new Map<string, WalletRechargeParseRow>();
  a.forEach((r) => byKey.set(rowKey(r), r));
  b.forEach((r) => byKey.set(rowKey(r), r));
  return Array.from(byKey.values());
}

/** Matches backend "first text attachment" heuristics — skip images/signatures listed before the .txt file. */
function isLikelyWalletAttachmentFilename(filename: string): boolean {
  return /\.(txt|csv|tsv)$/i.test((filename || "").trim());
}

type ImapApiParams = {
  email: string;
  password: string;
  host: string;
  port: number;
  use_ssl: boolean;
  folder: string;
};

/** Same logic as clicking "Use & parse" on an attachment: fetch, merge into prevRows, save. */
async function parseImapAttachmentAndSave(
  apiParams: ImapApiParams,
  uid: string,
  attachmentIndex: number | undefined,
  prevRows: WalletRechargeParseRow[],
): Promise<{
  nextRows: WalletRechargeParseRow[];
  parsedCount: number;
  emptyMessage?: string;
  saveError?: string;
}> {
  const parseRes = await apiClient.walletImapFetchAndParse({
    ...apiParams,
    email_uid: uid,
    attachment_index: attachmentIndex,
  });
  if (parseRes.error) {
    throw new Error(parseRes.error);
  }
  const list = (parseRes.data?.rows ?? []).map((r) => ({
    ...r,
    source_imap_uid: uid,
  }));
  if (list.length === 0) {
    return { nextRows: prevRows, parsedCount: 0, emptyMessage: parseRes.data?.message };
  }
  const merged = mergeParseRowLists(prevRows, list);
  const saveRes = await apiClient.saveWalletRechargeParseEntries(merged);
  const nextRows = !saveRes.error && saveRes.data?.rows ? saveRes.data.rows : merged;
  return {
    nextRows,
    parsedCount: list.length,
    saveError: saveRes.error || undefined,
  };
}

const IMAP_PARAMS_STORAGE_KEY = "wallet_recharge_imap_params";
const IMAP_DELETE_WHEN_DONE_KEY = "wallet_recharge_imap_delete_when_processed";

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

/** Automatic IMAP list+parse while the wallet page is open (interval in ms). */
const WALLET_IMAP_AUTO_FETCH_MS = 30 * 60 * 1000;

/**
 * Scheduled (automatic) email fetch only: Mon–Sat, 09:00–17:30 IST.
 * Manual "Fetch" is not gated by this.
 */
function isWalletImapAutoFetchWindowIST(): boolean {
  const d = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(d);
  const w = parts.find((p) => p.type === "weekday")?.value;
  if (w === "Sun") return false;
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? NaN);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? NaN);
  if (Number.isNaN(h) || Number.isNaN(m)) return false;
  const minutes = h * 60 + m;
  return minutes >= 9 * 60 && minutes <= 17 * 60 + 30;
}

/** Shared panel style for wallet management sections */
const WALLET_CARD =
  "rounded-xl border border-border/70 bg-card/95 shadow-sm backdrop-blur-sm transition-shadow duration-300 hover:shadow-md hover:border-border";

type EligibleWalletUser = {
  id: number;
  name: string;
  email: string;
  emp_id: string;
  user_type: string;
  department_name: string | null;
  department_id: number | null;
  phone_number?: string | null;
  secondary_phone_number?: string | null;
  contact_number?: string | null;
};

/** Row from `GET /wallet/search-faculty/` — used to fill employee no., name, department on edit dialog. */
type EditDialogFacultyHit = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  profile_picture?: string | null;
  has_wallet: boolean;
  department?: string | null;
  emp_id?: string | null;
};

/** Read-only summary for manual recharge from eligible-user API row. */
function manualSnapshotFromUser(u: EligibleWalletUser | undefined): {
  name: string;
  email: string;
  contactNumber: string;
  departmentName: string | null;
  empId: string;
} | null {
  if (!u) return null;
  const contact =
    (u.contact_number || "").trim() ||
    [u.phone_number, u.secondary_phone_number].filter(Boolean).join(" · ").trim();
  return {
    name: (u.name || "").trim(),
    email: (u.email || "").trim(),
    contactNumber: contact,
    departmentName: u.department_name ?? null,
    empId: (u.emp_id || "").trim(),
  };
}

/** Find eligible wallet user by exact employee/student ID (admin API). */
async function resolveEligibleUserByEmp(empNo: string): Promise<EligibleWalletUser | null> {
  const t = empNo.trim();
  if (!t) return null;
  const res = await apiClient.adminWalletEligibleUsers(t);
  if (res.error || !res.data?.users?.length) return null;
  const users = res.data.users;
  const lower = t.toLowerCase();
  return (
    users.find((u) => (u.emp_id || "").trim().toLowerCase() === lower) ??
    users.find((u) => (u.emp_id || "").trim() === t) ??
    null
  );
}

const WalletRechargeParsePage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isWalletRechargeStaff = userTypeStr === "admin" || userTypeStr === "finance";

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [rows, setRows] = useState<WalletRechargeParseRow[]>([]);
  const rowsRef = useRef<WalletRechargeParseRow[]>([]);
  rowsRef.current = rows;
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
  const [manualUserSearch, setManualUserSearch] = useState("");
  const [eligibleUsers, setEligibleUsers] = useState<EligibleWalletUser[]>([]);
  const [manualUserId, setManualUserId] = useState<number | "">("");
  /** Filled when a user is chosen from the list (read-only profile fields on screen). */
  const [manualUserSnapshot, setManualUserSnapshot] = useState<ReturnType<typeof manualSnapshotFromUser>>(null);
  const [manualAmount, setManualAmount] = useState("");
  const [manualReceipt, setManualReceipt] = useState("");
  const [manualDate, setManualDate] = useState("");
  const [manualPayment, setManualPayment] = useState("");
  const [manualDeptId, setManualDeptId] = useState<number | "">("");
  const [manualLoading, setManualLoading] = useState(false);
  const [rechargeDepartments, setRechargeDepartments] = useState<
    Array<{ id: number; name: string; code: string | null; department_type: string }>
  >([]);
  const [autoFetchStatus, setAutoFetchStatus] = useState<string | null>(null);
  /** When enabled, delete mailbox messages by UID after all rows from that message are processed. */
  const [imapDeleteWhenProcessed, setImapDeleteWhenProcessed] = useState(() => {
    try {
      return localStorage.getItem(IMAP_DELETE_WHEN_DONE_KEY) === "1";
    } catch {
      return false;
    }
  });
  /** Edit unmatched row in a modal (server id is fixed for the apply API). */
  const [editRowDialogOpen, setEditRowDialogOpen] = useState(false);
  const [editRowSourceId, setEditRowSourceId] = useState<number | null>(null);
  const [editRowForm, setEditRowForm] = useState<WalletRechargeParseRow | null>(null);
  const [editRowEmpResolvedName, setEditRowEmpResolvedName] = useState<string | null>(null);
  const [editRowEmpLookupLoading, setEditRowEmpLookupLoading] = useState(false);
  const editRowFacultySearchReqSeq = useRef(0);
  const [editRowFacultyQuery, setEditRowFacultyQuery] = useState("");
  const [editRowFacultyResults, setEditRowFacultyResults] = useState<EditDialogFacultyHit[]>([]);
  const [editRowFacultySearchLoading, setEditRowFacultySearchLoading] = useState(false);
  const [editRowFacultyPopoverOpen, setEditRowFacultyPopoverOpen] = useState(false);
  const [applyingRowId, setApplyingRowId] = useState<number | null>(null);
  /** Unmatched row → create WalletRechargeRequest + email faculty (parse entry id fixed). */
  const [manualReqOpen, setManualReqOpen] = useState(false);
  const [manualReqRow, setManualReqRow] = useState<WalletRechargeParseRow | null>(null);
  const [manualReqSearch, setManualReqSearch] = useState("");
  const [manualReqUsers, setManualReqUsers] = useState<EligibleWalletUser[]>([]);
  const [manualReqUserId, setManualReqUserId] = useState<number | "">("");
  const [manualReqDeptId, setManualReqDeptId] = useState<number | "">("");
  const [manualReqProjectId, setManualReqProjectId] = useState<number | "">("");
  const [manualReqProjects, setManualReqProjects] = useState<
    Array<{ id: number; name: string; project_code: string; agency: string }>
  >([]);
  const [manualReqProjectsLoading, setManualReqProjectsLoading] = useState(false);
  const [manualReqNote, setManualReqNote] = useState("");
  const [manualReqLoading, setManualReqLoading] = useState(false);
  const [historyMatchFilter, setHistoryMatchFilter] = useState<"all" | "matched" | "unmatched">("all");

  const [pipelineFilter, setPipelineFilter] = useState<"all" | "pending" | "unmatched_no_parse">("pending");
  const [pipelineRows, setPipelineRows] = useState<Record<string, unknown>[]>([]);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  /** Bumps on each pipeline fetch so stale responses do not overwrite rows. */
  const pipelineLoadSeq = useRef(0);
  /** Overlapping loads (Strict Mode, filter change while in flight): only clear spinner when all finish. */
  const pipelineInflightRef = useRef(0);

  const loadFacultyPipeline = useCallback(async () => {
    if (!isWalletRechargeStaff) return;
    const seq = ++pipelineLoadSeq.current;
    pipelineInflightRef.current += 1;
    setPipelineLoading(true);
    try {
      const res = await apiClient.getWalletRechargePipelineRequests(pipelineFilter);
      if (seq !== pipelineLoadSeq.current) return;
      if (!res.error && res.data?.requests) {
        setPipelineRows(res.data.requests);
      } else {
        setPipelineRows([]);
        if (res.error) toast.error(res.error);
      }
    } catch (e) {
      if (seq !== pipelineLoadSeq.current) return;
      setPipelineRows([]);
      toast.error(e instanceof Error ? e.message : "Failed to load faculty recharge requests");
    } finally {
      pipelineInflightRef.current = Math.max(0, pipelineInflightRef.current - 1);
      if (pipelineInflightRef.current === 0) {
        setPipelineLoading(false);
      }
    }
  }, [isWalletRechargeStaff, pipelineFilter]);

  useEffect(() => {
    void loadFacultyPipeline();
  }, [loadFacultyPipeline]);

  const tryDeleteProcessedImapEmails = async (rowsSnapshot: WalletRechargeParseRow[]) => {
    if (!imapDeleteWhenProcessed) return;
    const em = imapEmail.trim();
    const pw = imapPassword;
    if (!em || !pw) return;
    const byUid = new Map<string, WalletRechargeParseRow[]>();
    for (const r of rowsSnapshot) {
      const u = r.source_imap_uid?.trim();
      if (!u) continue;
      if (!byUid.has(u)) byUid.set(u, []);
      byUid.get(u)!.push(r);
    }
    const uids: string[] = [];
    for (const [uid, list] of byUid) {
      if (list.length > 0 && list.every((x) => x.processed)) uids.push(uid);
    }
    if (uids.length === 0) return;
    const base = {
      email: em,
      password: pw,
      host: imapHost.trim() || "imap.gmail.com",
      port: imapPort,
      use_ssl: imapUseSsl,
      folder: imapFolder.trim() || "INBOX",
    };
    let anyDeleted = false;
    for (const uid of uids) {
      const res = await apiClient.walletImapDeleteEmailIfProcessed({ ...base, email_uid: uid });
      if (res.error) {
        toast.warning(`Could not delete IMAP message (UID ${uid}): ${res.error}`);
      } else {
        anyDeleted = true;
        toast.success(`Deleted email from mailbox (UID ${uid}).`);
      }
    }
    if (anyDeleted) {
      const refetch = await apiClient.getWalletRechargeParseEntries();
      if (!refetch.error && refetch.data?.rows) setRows(refetch.data.rows);
    }
  };

  useEffect(() => {
    if (!isWalletRechargeStaff) return;
    const previousTitle = document.title;
    document.title = "Wallet Management | INSTITUTE INSTRUMENTATION CENTRE - IIC";
    return () => {
      document.title = previousTitle;
    };
  }, [isWalletRechargeStaff]);

  useEffect(() => {
    if (!isWalletRechargeStaff) return;
    apiClient.getDepartmentsForRecharge().then((r) => {
      if (!r.error && r.data?.departments) setRechargeDepartments(r.data.departments);
    });
  }, [isWalletRechargeStaff]);

  useEffect(() => {
    if (rechargeDepartments.length === 1) {
      setManualDeptId(rechargeDepartments[0].id);
    }
  }, [rechargeDepartments]);

  useEffect(() => {
    if (!isWalletRechargeStaff) return;
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
  }, [isWalletRechargeStaff]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!isWalletRechargeStaff) {
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
  }, [navigate, isAuthenticated, user, isWalletRechargeStaff, authLoading]);

  /** Keep read-only profile summary in sync if search results refresh while the same user stays selected. */
  useEffect(() => {
    if (manualUserId === "") return;
    const u = eligibleUsers.find((x) => x.id === manualUserId);
    if (u) setManualUserSnapshot(manualSnapshotFromUser(u));
  }, [eligibleUsers, manualUserId]);

  useEffect(() => {
    if (!editRowDialogOpen || !editRowForm) return;
    const t = (editRowForm.emp_no || "").trim();
    if (!t) {
      setEditRowEmpResolvedName(null);
      setEditRowEmpLookupLoading(false);
      return;
    }
    const id = window.setTimeout(async () => {
      setEditRowEmpLookupLoading(true);
      try {
        const u = await resolveEligibleUserByEmp(t);
        setEditRowEmpResolvedName(u?.name ?? null);
      } finally {
        setEditRowEmpLookupLoading(false);
      }
    }, 400);
    return () => window.clearTimeout(id);
  }, [editRowDialogOpen, editRowForm?.emp_no]);

  useEffect(() => {
    if (!editRowDialogOpen) {
      editRowFacultySearchReqSeq.current += 1;
      return;
    }
    const q = editRowFacultyQuery.trim();
    if (q.length < 2) {
      setEditRowFacultyResults([]);
      setEditRowFacultySearchLoading(false);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      const seq = ++editRowFacultySearchReqSeq.current;
      setEditRowFacultySearchLoading(true);
      void apiClient.searchFacultyByName(q, 15).then((res) => {
        if (seq !== editRowFacultySearchReqSeq.current) return;
        setEditRowFacultySearchLoading(false);
        if (res.error) {
          setEditRowFacultyResults([]);
          return;
        }
        setEditRowFacultyResults(res.data?.results ?? []);
      });
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [editRowDialogOpen, editRowFacultyQuery]);

  const applyEditRowFacultyFromSearch = (faculty: EditDialogFacultyHit) => {
    editRowFacultySearchReqSeq.current += 1;
    setEditRowFacultyPopoverOpen(false);
    setEditRowFacultyQuery("");
    setEditRowFacultyResults([]);
    setEditRowFacultySearchLoading(false);
    setEditRowForm((f) =>
      f
        ? {
            ...f,
            emp_no: (faculty.emp_id ?? "").trim(),
            department: faculty.department ?? "",
          }
        : null,
    );
    setEditRowEmpResolvedName(faculty.name ?? null);
  };

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

  const historyMatchedCount = rows.filter((r) => r.matched_user).length;
  const historyUnmatchedCount = rows.length - historyMatchedCount;
  const filteredHistoryRows = rows.filter((r) => {
    if (historyMatchFilter === "matched") return !!r.matched_user;
    if (historyMatchFilter === "unmatched") return !r.matched_user;
    return true;
  });

  const isUnmatchedEditable = (r: WalletRechargeParseRow) =>
    r.id != null && !r.processed && !r.matched_user;

  const openManualRechargeRequestDialog = (row: WalletRechargeParseRow) => {
    if (row.id == null) return;
    setManualReqRow(row);
    setManualReqSearch("");
    setManualReqUsers([]);
    setManualReqUserId("");
    setManualReqDeptId(rechargeDepartments.length === 1 ? rechargeDepartments[0].id : "");
    setManualReqProjectId("");
    setManualReqProjects([]);
    setManualReqNote("");
    setManualReqOpen(true);
  };

  const searchManualReqUsers = async () => {
    const res = await apiClient.adminWalletEligibleUsers(manualReqSearch.trim() || undefined);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setManualReqUsers(res.data?.users ?? []);
    if ((res.data?.users?.length ?? 0) === 0) toast.info("No users found.");
  };

  useEffect(() => {
    if (!manualReqOpen || manualReqUserId === "") {
      setManualReqProjects([]);
      setManualReqProjectId("");
      return;
    }
    const u = manualReqUsers.find((x) => x.id === manualReqUserId);
    const isFaculty = u != null && String(u.user_type).toLowerCase() === "faculty";
    if (!isFaculty) {
      setManualReqProjects([]);
      setManualReqProjectId("");
      return;
    }
    let cancelled = false;
    setManualReqProjectsLoading(true);
    void apiClient.getWalletRechargeTargetUserProjects(Number(manualReqUserId)).then((res) => {
      if (cancelled) return;
      setManualReqProjectsLoading(false);
      if (!res.error && res.data?.projects) {
        setManualReqProjects(res.data.projects);
        if (res.data.projects.length === 1) {
          setManualReqProjectId(res.data.projects[0].id);
        }
      } else {
        setManualReqProjects([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [manualReqOpen, manualReqUserId, manualReqUsers]);

  const handleManualRechargeRequestSubmit = async () => {
    if (!manualReqRow?.id || manualReqUserId === "" || manualReqDeptId === "") {
      toast.error("Select a user and sub-wallet department.");
      return;
    }
    const sel = manualReqUsers.find((x) => x.id === manualReqUserId);
    const isFaculty = sel != null && String(sel.user_type).toLowerCase() === "faculty";
    if (isFaculty && manualReqProjectId === "") {
      toast.error("Select a project for faculty users.");
      return;
    }
    setManualReqLoading(true);
    try {
      const res = await apiClient.createWalletRechargeRequestFromUnmatchedParseRow({
        parse_entry_id: manualReqRow.id,
        user_id: Number(manualReqUserId),
        department_id: Number(manualReqDeptId),
        project_id: isFaculty ? Number(manualReqProjectId) : null,
        note: manualReqNote.trim() || undefined,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setManualReqOpen(false);
      setManualReqRow(null);
      toast.success(res.data?.message ?? "Recharge request created; faculty notified.");
      void loadFacultyPipeline();
    } catch (e: unknown) {
      toast.error((e as { message?: string })?.message ?? "Request failed");
    } finally {
      setManualReqLoading(false);
    }
  };

  const openEditRowDialog = (row: WalletRechargeParseRow) => {
    if (row.id == null) return;
    setEditRowSourceId(row.id);
    setEditRowForm({ ...row });
    setEditRowEmpResolvedName(row.matched_user?.name ?? null);
    setEditRowFacultyQuery("");
    setEditRowFacultyResults([]);
    setEditRowFacultyPopoverOpen(false);
    editRowFacultySearchReqSeq.current += 1;
    setEditRowDialogOpen(true);
  };

  const handleApplyEditRowDialog = async () => {
    if (editRowSourceId == null || !editRowForm) return;
    setApplyingRowId(editRowSourceId);
    try {
      const d = editRowForm;
      const nameForSave = (editRowEmpResolvedName ?? d.name ?? "").trim();
      const res = await apiClient.applyWalletRechargeParseEntry({
        id: editRowSourceId,
        date: d.date,
        receipt_no: d.receipt_no,
        name: nameForSave,
        emp_no: d.emp_no,
        department: d.department,
        amount: d.amount,
        payment: d.payment,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setEditRowDialogOpen(false);
      setEditRowForm(null);
      setEditRowSourceId(null);
      const refetch = await apiClient.getWalletRechargeParseEntries();
      if (!refetch.error && refetch.data?.rows) {
        setRows(refetch.data.rows);
        await tryDeleteProcessedImapEmails(refetch.data.rows);
      }
      const credited = res.data?.credited ?? 0;
      const updated = res.data?.row;
      const errs = res.data?.errors ?? [];
      if (credited > 0) {
        toast.success("Row updated and credited.");
      } else if (updated?.matched_user && !updated.processed) {
        toast.info("Row saved and matched; credit did not complete — see warnings or use Credit matched rows.");
      } else if (updated?.matched_user && updated.processed) {
        toast.success("Row updated; this receipt is already credited.");
      } else {
        toast.success("Row updated; still no user for this Employee/Student ID.");
      }
      errs.forEach((msg) => toast.warning(msg));
    } catch (e: unknown) {
      toast.error((e as { message?: string })?.message ?? "Apply failed");
    } finally {
      setApplyingRowId(null);
      void loadFacultyPipeline();
    }
  };

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
        if (!refetch.error && refetch.data?.rows) {
          setRows(refetch.data.rows);
          await tryDeleteProcessedImapEmails(refetch.data.rows);
        }
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
      void loadFacultyPipeline();
    }
  };

  const searchEligibleUsers = async () => {
    const res = await apiClient.adminWalletEligibleUsers(manualUserSearch.trim() || undefined);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setEligibleUsers(res.data?.users ?? []);
    if ((res.data?.users?.length ?? 0) === 0) toast.info("No users found.");
  };

  const handleManualRecharge = async () => {
    if (!manualUserId || !manualAmount || !manualReceipt || !manualDeptId) {
      toast.error("Search and select a user, then choose department, amount, and receipt number.");
      return;
    }
    setManualLoading(true);
    try {
      const res = await apiClient.adminManualWalletRecharge({
        user_id: Number(manualUserId),
        amount: manualAmount,
        department_id: Number(manualDeptId),
        receipt_no: manualReceipt.trim(),
        date: manualDate.trim() || null,
        payment: manualPayment.trim() || undefined,
        name: manualUserSnapshot?.name?.trim() || undefined,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (res.data?.rows) setRows(res.data.rows);
      toast.success(res.data?.message ?? "Wallet credited.");
      void loadFacultyPipeline();
    } finally {
      setManualLoading(false);
    }
  };

  const handleImapFetch = async () => {
    if (!imapEmail.trim() || !imapPassword) {
      toast.error("Enter email and password for IMAP.");
      return;
    }
    const imapParams = {
      email: imapEmail.trim(),
      password: imapPassword,
      host: imapHost.trim() || "imap.gmail.com",
      port: imapPort,
      use_ssl: imapUseSsl,
      folder: imapFolder.trim() || "INBOX",
    };

    setImapLoading(true);
    setImapEmails([]);
    try {
      const res = await apiClient.walletImapListEmails({
        ...imapParams,
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
        return;
      }

      // Process every listed email (with or without sender/subject filters — filters only narrow the list API).
      // Same as Attachments → expand → Use & parse. Row-level Use & parse uses *no* index (first text/csv);
      // per-file buttons use att.index. We skip non-.txt/.csv/.tsv parts so index-0 images do not produce empty parses.
      const errors: string[] = [];
      const saveErrors: string[] = [];
      let currentRows = rowsRef.current;
      let totalRowCount = 0;
      let attachmentParseCount = 0;

      for (const em of emails) {
        setImapAttachmentsLoadingUid(em.uid);
        const attRes = await apiClient.walletImapEmailAttachments({
          ...imapParams,
          email_uid: em.uid,
        });
        setImapAttachmentsLoadingUid(null);

        if (attRes.error) {
          errors.push(`${em.subject || em.uid}: ${attRes.error}`);
          continue;
        }
        const attachments = attRes.data?.attachments ?? [];
        setImapAttachmentsByUid((prev) => ({ ...prev, [em.uid]: attachments }));
        setImapExpandedUid(em.uid);

        const parseable = attachments.filter((a) => isLikelyWalletAttachmentFilename(a.filename));
        /** Same as row "Use & parse" (no index) when we cannot guess by filename but parts exist. */
        const parseTasks: Array<{ label: string; attachmentIndex: number | undefined }> = [];
        if (parseable.length > 0) {
          for (const a of parseable) {
            parseTasks.push({ label: a.filename, attachmentIndex: a.index });
          }
        } else if (attachments.length > 0) {
          parseTasks.push({ label: "(first text attachment)", attachmentIndex: undefined });
        }

        for (const task of parseTasks) {
          setImapFetchingUid(em.uid);
          try {
            const { nextRows, parsedCount, saveError } = await parseImapAttachmentAndSave(
              imapParams,
              em.uid,
              task.attachmentIndex,
              currentRows,
            );
            currentRows = nextRows;
            setRows(nextRows);
            rowsRef.current = nextRows;
            attachmentParseCount += 1;
            if (parsedCount > 0) {
              totalRowCount += parsedCount;
            }
            if (saveError) {
              saveErrors.push(`${em.subject || em.uid} / ${task.label}: ${saveError}`);
            }
          } catch (e: unknown) {
            errors.push(`${em.subject || em.uid} / ${task.label}: ${e instanceof Error ? e.message : "parse failed"}`);
          } finally {
            setImapFetchingUid(null);
          }
        }
      }

      if (saveErrors.length > 0) {
        saveErrors.slice(0, 3).forEach((msg) => toast.warning(msg + " Table updated locally."));
        if (saveErrors.length > 3) {
          toast.warning(`…and ${saveErrors.length - 3} more save issue(s). Table updated locally where possible.`);
        }
      }

      if (errors.length > 0) {
        errors.slice(0, 5).forEach((msg) => toast.warning(msg));
        if (errors.length > 5) {
          toast.warning(`…and ${errors.length - 5} more issue(s).`);
        }
      }

      if (attachmentParseCount === 0) {
        toast.info("No attachments found in the listed emails, or none could be opened.");
      } else if (totalRowCount > 0) {
        toast.success(
          `Processed ${attachmentParseCount} attachment(s) from ${emails.length} email(s). ${totalRowCount} row(s) merged into the table.`
        );
      } else {
        toast.info(
          "Attachment(s) were read but no rows matched the expected format (or files were empty)."
        );
      }
      await tryDeleteProcessedImapEmails(currentRows);
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(err?.message ?? "Failed to list emails");
    } finally {
      setImapLoading(false);
      setImapAttachmentsLoadingUid(null);
      setImapFetchingUid(null);
    }
  };

  const imapFetchRef = useRef(handleImapFetch);
  imapFetchRef.current = handleImapFetch;

  useEffect(() => {
    if (!isWalletRechargeStaff) return;
    const tick = () => {
      if (!imapEmail.trim() || !imapPassword) return;
      if (!isWalletImapAutoFetchWindowIST()) return;
      setAutoFetchStatus("Scheduled fetch (every 30 min)…");
      void Promise.resolve(imapFetchRef.current()).finally(() => setAutoFetchStatus(null));
    };
    const id = window.setInterval(tick, WALLET_IMAP_AUTO_FETCH_MS);
    return () => window.clearInterval(id);
  }, [isWalletRechargeStaff, imapEmail, imapPassword]);

  const handleImapUseAndParse = async (uid: string, attachmentIndex?: number) => {
    if (!imapEmail.trim() || !imapPassword) {
      toast.error("Enter email and password for IMAP.");
      return;
    }
    const apiParams: ImapApiParams = {
      email: imapEmail.trim(),
      password: imapPassword,
      host: imapHost.trim() || "imap.gmail.com",
      port: imapPort,
      use_ssl: imapUseSsl,
      folder: imapFolder.trim() || "INBOX",
    };
    setImapFetchingUid(uid);
    try {
      const { nextRows, parsedCount, emptyMessage } = await parseImapAttachmentAndSave(
        apiParams,
        uid,
        attachmentIndex,
        rowsRef.current,
      );
      setRows(nextRows);
      rowsRef.current = nextRows;
      if (parsedCount > 0) {
        toast.success(`Parsed ${parsedCount} row(s) from email.`);
      } else {
        toast.info(emptyMessage ?? "No rows parsed from attachment.");
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
    if (Array.isArray(imapAttachmentsByUid[uid])) {
      setImapExpandedUid(uid);
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

  if (!isWalletRechargeStaff && !authLoading) return null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-muted/40 via-background to-primary/[0.06] dark:from-slate-950 dark:via-background dark:to-primary/10">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-30%,hsl(var(--primary)/0.12),transparent_55%)] dark:bg-[radial-gradient(ellipse_120%_80%_at_50%_-30%,hsl(var(--primary)/0.18),transparent_55%)]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.35)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.35)_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-40 dark:opacity-25" />
      <DashboardHeader />
      <main className="relative mx-auto w-full max-w-[min(100%,1920px)] px-4 py-8 sm:px-6 lg:px-8 xl:px-10 sm:py-10">
        <div className="mb-8 sm:mb-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin-settings")}
            className="mb-4 -ml-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin Settings
          </Button>
          <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/80 p-6 shadow-sm backdrop-blur-md sm:p-8">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-primary/20 to-transparent blur-2xl dark:from-primary/25" />
            <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-gradient-to-tr from-amber-500/10 to-transparent blur-2xl" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 space-y-3">
                <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  Administration · Finance
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md">
                    <Wallet className="h-6 w-6" />
                  </div>
                  <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                    Wallet Management
                  </h1>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Manual credits, file import, IMAP parsing, and a shared <span className="font-medium text-foreground/90">Wallet Recharge History</span> for reconciliation — dates, receipts, names, employee IDs, departments, amounts, and payment details.
                </p>
              </div>
            </div>
          </div>
        </div>

        <Card className={cn(WALLET_CARD, "mb-6")}>
          <CardHeader className="pb-2 space-y-0">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-800 dark:text-sky-300">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div className="min-w-0 space-y-1.5">
                <CardTitle className="text-base font-semibold tracking-tight">Faculty recharge requests</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  Initiated by IITR Faculty after project selection and email OTP. When SRIC sends the accounts file,
                  parsed rows with the same <span className="font-medium text-foreground/90">Emp No.</span> and{" "}
                  <span className="font-medium text-foreground/90">amount</span> auto-credit the wallet and close the
                  request. Use <strong className="font-medium">Pending — no matching parse row</strong> to focus requests
                  still waiting for a history line.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="pipeline-filter">Filter</Label>
                <select
                  id="pipeline-filter"
                  className="flex h-10 w-full min-w-[min(100vw-2rem,280px)] rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={pipelineFilter}
                  onChange={(e) =>
                    setPipelineFilter(e.target.value as "all" | "pending" | "unmatched_no_parse")
                  }
                >
                  <option value="all">All (faculty, OTP verified)</option>
                  <option value="pending">Pending — awaiting credit</option>
                  <option value="unmatched_no_parse">Pending — no matching Wallet Recharge History row</option>
                </select>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void loadFacultyPipeline()}
                disabled={pipelineLoading}
              >
                {pipelineLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Refresh list
              </Button>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Faculty</TableHead>
                    <TableHead>Emp No.</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Parse match</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pipelineRows.length === 0 && !pipelineLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                        No requests for this filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pipelineRows.map((row) => {
                      const id = Number(row.id);
                      const created = row.created_at != null ? String(row.created_at) : "—";
                      const name = String(row.user_name ?? "");
                      const email = String(row.user_email ?? "");
                      const emp = String((row as { user_emp_id?: string }).user_emp_id ?? "");
                      const amt = row.amount != null ? String(row.amount) : "—";
                      const dept = String(row.department_name ?? "—");
                      const pcode = String(row.project_code ?? "");
                      const pname = String(row.project_name ?? "");
                      const st = String(row.status_display ?? row.status ?? "—");
                      const hasParse = row.has_matching_parse_entry === true;
                      return (
                        <TableRow key={id}>
                          <TableCell className="font-mono text-xs">{id}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {created.length > 16 ? created.slice(0, 16) : created}
                          </TableCell>
                          <TableCell className="max-w-[10rem]">
                            <div className="text-sm font-medium truncate">{name || email}</div>
                            <div className="text-xs text-muted-foreground truncate">{email}</div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{emp || "—"}</TableCell>
                          <TableCell className="text-right font-medium">₹{amt}</TableCell>
                          <TableCell className="text-sm max-w-[8rem]">{dept}</TableCell>
                          <TableCell className="text-sm max-w-[10rem]">
                            {pcode ? (
                              <>
                                <span className="font-mono text-xs">{pcode}</span>
                                {pname ? <div className="text-xs text-muted-foreground truncate">{pname}</div> : null}
                              </>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{st}</TableCell>
                          <TableCell>
                            {hasParse ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                                Yes
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-900 dark:text-amber-200">
                                No
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(WALLET_CARD, "mb-6")}>
          <CardHeader className="pb-2 space-y-0">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                <Wallet className="h-5 w-5" />
              </div>
              <div className="min-w-0 space-y-1.5">
                <CardTitle className="text-base font-semibold tracking-tight">Manual wallet recharge</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  Search and select a user. Employee number and name are filled automatically from the directory. The wallet is created if missing. Credits the department sub-wallet, logs a parse row (shows as processed), sends email to the faculty with{" "}
                  <span className="font-medium text-foreground/90">iicbooking@iitr.ac.in</span> in CC. Duplicate receipt + date + employee combinations are rejected.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="manual-user-search">Search users</Label>
                <Input
                  id="manual-user-search"
                  value={manualUserSearch}
                  onChange={(e) => setManualUserSearch(e.target.value)}
                  placeholder="Name, email, or employee no."
                  className="mt-1"
                />
              </div>
              <Button type="button" variant="secondary" onClick={() => void searchEligibleUsers()}>
                Search
              </Button>
            </div>
            {eligibleUsers.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="manual-user-select">User</Label>
                <select
                  id="manual-user-select"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={manualUserId === "" ? "" : String(manualUserId)}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) {
                      setManualUserId("");
                      setManualUserSnapshot(null);
                      return;
                    }
                    const id = Number(v);
                    setManualUserId(id);
                    const u = eligibleUsers.find((x) => x.id === id);
                    if (u?.department_id) setManualDeptId(u.department_id);
                    setManualUserSnapshot(manualSnapshotFromUser(u));
                  }}
                >
                  <option value="">— Select —</option>
                  {eligibleUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email} · {u.emp_id || "—"} · {u.email}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {manualUserId !== "" && manualUserSnapshot && (
              <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.07] via-muted/20 to-transparent px-4 py-4 space-y-3 shadow-inner dark:from-emerald-500/10">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Name</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {manualUserSnapshot.name || "—"}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</p>
                    <p className="mt-1 text-sm text-foreground break-all">{manualUserSnapshot.email || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contact number</p>
                    <p className="mt-1 text-sm text-foreground tabular-nums">
                      {manualUserSnapshot.contactNumber || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Department</p>
                    <p className="mt-1 text-sm text-foreground">{manualUserSnapshot.departmentName || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Employee number</p>
                    <p className="mt-1 font-mono text-sm font-semibold text-foreground tabular-nums">
                      {manualUserSnapshot.empId || "—"}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">From directory (selected user).</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="manual-dept">Department (sub-wallet)</Label>
                <select
                  id="manual-dept"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={manualDeptId === "" ? "" : String(manualDeptId)}
                  onChange={(e) => setManualDeptId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">— Select —</option>
                  {rechargeDepartments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                      {d.code ? ` (${d.code})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="manual-amount">Amount (₹)</Label>
                <Input
                  id="manual-amount"
                  type="text"
                  inputMode="decimal"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="manual-receipt">Receipt No.</Label>
                <Input
                  id="manual-receipt"
                  value={manualReceipt}
                  onChange={(e) => setManualReceipt(e.target.value)}
                  placeholder="Unique receipt reference"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="manual-date">Date (optional)</Label>
                <Input
                  id="manual-date"
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="manual-payment">Payment details (optional)</Label>
                <Input
                  id="manual-payment"
                  value={manualPayment}
                  onChange={(e) => setManualPayment(e.target.value)}
                  placeholder="Manual admin recharge"
                  className="mt-1"
                />
              </div>
            </div>
            <Button type="button" onClick={() => void handleManualRecharge()} disabled={manualLoading}>
              {manualLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Credit wallet &amp; save parse row
            </Button>
          </CardContent>
        </Card>

        <Card className={cn(WALLET_CARD, "mb-6")}>
          <CardHeader className="pb-2">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-400">
                <FileUp className="h-5 w-5" />
              </div>
              <div className="min-w-0 space-y-1.5">
                <CardTitle className="text-base font-semibold tracking-tight">Upload and parse</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  File should have headers: SlNo, Dated, ReceiptNo, Amount(Rs), Payment Details, Received From (with EMP NO-xxxx, DEPT-...). Name and Department are extracted from &quot;Received From&quot;; we match rows to users by Employee/Student ID.
                </CardDescription>
              </div>
            </div>
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

        <Card className={cn(WALLET_CARD, "mb-6")}>
          <CardHeader
            className="cursor-pointer pb-2 select-none"
            onClick={() => setImapSectionOpen(!imapSectionOpen)}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-700 dark:text-violet-400">
                <Mail className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base font-semibold tracking-tight pr-2">
                    Fetch file from email (IMAP)
                  </CardTitle>
                  {imapSectionOpen ? (
                    <ChevronUp className="h-5 w-5 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
                  )}
                </div>
                <CardDescription className="text-sm leading-relaxed">
                  Enter IMAP credentials and optional filters. Use <span className="font-medium text-foreground/90">Fetch</span> anytime to refresh the list and process attachments manually — it is always available when credentials are filled in. The last 50 messages are listed (or all messages matching your filters — up to 5000 when a subject filter is set); each listed email can be processed like Attachments → Use &amp; parse for wallet-sized files (.txt / .csv / .tsv), merged into the table.
                  While this page stays open, the same flow also runs automatically every <span className="font-medium text-foreground/90">30 minutes</span> when email and password are present — only <span className="font-medium text-foreground/90">Monday–Saturday, 9:00 AM–5:30 PM IST</span> (automatic fetch only; use Fetch manually anytime).
                  Use your normal email password for IMAP; for Gmail with 2FA you may need an App Password.
                </CardDescription>
              </div>
            </div>
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
              <div className="flex flex-wrap items-start gap-3 rounded-lg border border-border/60 bg-muted/15 px-3 py-3 w-full">
                <Checkbox
                  id="imap-delete-when-done"
                  checked={imapDeleteWhenProcessed}
                  onCheckedChange={(v) => {
                    const on = v === true;
                    try {
                      localStorage.setItem(IMAP_DELETE_WHEN_DONE_KEY, on ? "1" : "0");
                    } catch {
                      // ignore
                    }
                    setImapDeleteWhenProcessed(on);
                  }}
                />
                <div className="space-y-1 min-w-0">
                  <Label htmlFor="imap-delete-when-done" className="text-sm font-medium leading-snug cursor-pointer">
                    Delete email from server when fully processed
                  </Label>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
                    Optional: remove each IMAP message after every wallet row linked to that message (same UID) is credited. Manual <span className="font-medium text-foreground/80">Fetch</span> always works; deletion uses your IMAP credentials and needs delete permission on the mailbox.
                  </p>
                </div>
              </div>
              {autoFetchStatus && (
                <p className="text-sm text-muted-foreground">{autoFetchStatus}</p>
              )}
              {(imapFetchingUid || imapAttachmentsLoadingUid) && (
                <p className="text-sm text-muted-foreground">
                  {imapAttachmentsLoadingUid
                    ? "Loading attachments from email…"
                    : "Parsing attachment…"}
                </p>
              )}
              {imapEmails.length > 0 && (
                <div className="border rounded-md overflow-hidden">
                  <p className="text-sm font-medium p-2 bg-muted/50">
                    {imapEmails.length} email(s) listed
                    {imapSubjectFilter.trim() ? " (all subject matches, capped by server)" : " (last 50 in folder)"}
                  </p>
                  <div className="max-h-[400px] overflow-auto">
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
          <div className="mb-6 rounded-xl border border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            {message}
          </div>
        )}

        {entriesLoading && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-4 py-3 text-sm text-muted-foreground shadow-sm">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
            Loading wallet recharge history…
          </div>
        )}
        {!entriesLoading && rows.length > 0 && (
          <Card className={cn(WALLET_CARD, "mb-6")}>
            <CardHeader className="pb-2">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-400">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <CardTitle className="text-base font-semibold tracking-tight">Wallet Recharge History</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    For rows where the employee ID matches a user, <span className="font-medium text-foreground/90">Name</span> and <span className="font-medium text-foreground/90">Department</span> columns show values from the user directory (replacing parsed file text in the table). Use Show entries to filter. Stored on the server; merge key is Date, Receipt No, and Emp No. Unmatched rows: <span className="font-medium text-foreground/90">Edit</span> to fix the employee number and credit, or <span className="font-medium text-foreground/90">Faculty request</span> to create a recharge request for the correct user (faculty email + Recharge Request History; accounts team notified). Clear table resets all.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {rows.filter((r) => r.processed).length} of {rows.length} processed
                    {rowsToProcess.length > 0 && ` · ${rowsToProcess.length} matched, unprocessed`}
                  </span>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="wallet-history-match-filter" className="text-sm whitespace-nowrap shrink-0">
                      Show entries
                    </Label>
                    <select
                      id="wallet-history-match-filter"
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm min-w-[200px]"
                      value={historyMatchFilter}
                      onChange={(e) =>
                        setHistoryMatchFilter(e.target.value as "all" | "matched" | "unmatched")
                      }
                    >
                      <option value="all">All ({rows.length})</option>
                      <option value="matched">Matched ({historyMatchedCount})</option>
                      <option value="unmatched">Unmatched ({historyUnmatchedCount})</option>
                    </select>
                  </div>
                </div>
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
              <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/20">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 hover:bg-transparent">
                    <TableHead>Date</TableHead>
                    <TableHead>Receipt No</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Emp No</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Amount (Rs)</TableHead>
                    <TableHead>Payment Details</TableHead>
                    <TableHead className="text-muted-foreground">Matched User</TableHead>
                    <TableHead>Processed</TableHead>
                    <TableHead className="w-[200px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistoryRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        {historyMatchFilter === "all"
                          ? "No rows to display."
                          : `No ${historyMatchFilter} entries match this filter.`}
                        {historyMatchFilter !== "all" && rows.length > 0 && (
                          <span className="block text-xs mt-1">Try changing &quot;Show entries&quot; above.</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredHistoryRows.map((row, idx) => {
                    const editable = isUnmatchedEditable(row);
                    return (
                      <TableRow key={row.id ?? idx}>
                        <TableCell>{row.date ?? "—"}</TableCell>
                        <TableCell>{row.receipt_no || "—"}</TableCell>
                        <TableCell
                          className="max-w-[200px]"
                          title={
                            row.matched_user
                              ? "Name from user directory (matched by employee ID)"
                              : undefined
                          }
                        >
                          {walletHistoryDisplayName(row)}
                        </TableCell>
                        <TableCell>{row.emp_no || "—"}</TableCell>
                        <TableCell
                          className="max-w-[220px]"
                          title={
                            row.matched_user
                              ? "Department from user profile when available; otherwise parsed text"
                              : undefined
                          }
                        >
                          {walletHistoryDisplayDepartment(row)}
                        </TableCell>
                        <TableCell>{row.amount ?? "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={row.payment}>
                          {row.payment || "—"}
                        </TableCell>
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
                        <TableCell className="text-right">
                          {editable ? (
                            <div className="flex flex-wrap justify-end gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                className="text-xs"
                                disabled={applyingRowId !== null || manualReqLoading}
                                onClick={() => openEditRowDialog(row)}
                              >
                                <Pencil className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="text-xs"
                                disabled={applyingRowId !== null || manualReqLoading}
                                onClick={() => openManualRechargeRequestDialog(row)}
                                title="Create recharge request and notify faculty"
                              >
                                <Mail className="h-3 w-3 mr-1" />
                                Faculty request
                              </Button>
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                  )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog
          open={editRowDialogOpen}
          onOpenChange={(open) => {
            setEditRowDialogOpen(open);
            if (!open) {
              setEditRowForm(null);
              setEditRowSourceId(null);
              setEditRowEmpResolvedName(null);
              setEditRowFacultyQuery("");
              setEditRowFacultyResults([]);
              setEditRowFacultyPopoverOpen(false);
              editRowFacultySearchReqSeq.current += 1;
            }
          }}
        >
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto border-border/60 bg-card/95 shadow-xl">
            <DialogHeader>
              <DialogTitle>Edit wallet recharge row</DialogTitle>
              <DialogDescription>
                Update fields as needed. Search the faculty directory by name or email, or enter the employee/student number — the name is loaded automatically when it matches an eligible user.
              </DialogDescription>
            </DialogHeader>
            {editRowForm && (
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="edit-row-faculty-search">Find faculty (directory)</Label>
                  <Popover
                    open={
                      editRowFacultyPopoverOpen &&
                      editRowFacultyQuery.trim().length >= 2
                    }
                    onOpenChange={setEditRowFacultyPopoverOpen}
                  >
                    <PopoverTrigger asChild>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <Input
                          id="edit-row-faculty-search"
                          type="text"
                          placeholder="Type name or email (min. 2 characters)…"
                          value={editRowFacultyQuery}
                          onChange={(e) => {
                            const v = e.target.value;
                            setEditRowFacultyQuery(v);
                            setEditRowFacultyPopoverOpen(v.trim().length >= 2);
                          }}
                          onFocus={() => {
                            if (editRowFacultyQuery.trim().length >= 2) {
                              setEditRowFacultyPopoverOpen(true);
                            }
                          }}
                          className="pl-9"
                          autoComplete="off"
                        />
                        {editRowFacultySearchLoading && (
                          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[--radix-popover-trigger-width] p-0"
                      align="start"
                      onOpenAutoFocus={(e) => e.preventDefault()}
                    >
                      <style>{`
                        [cmdk-item][data-selected="true"] p,
                        [cmdk-item][data-selected="true"] span,
                        [cmdk-item][data-selected="true"] svg {
                          color: white !important;
                        }
                        [cmdk-item][data-selected="true"] span.bg-muted {
                          background-color: rgba(255, 255, 255, 0.2) !important;
                        }
                      `}</style>
                      <Command shouldFilter={false}>
                        <CommandList>
                          <CommandEmpty>
                            {editRowFacultySearchLoading
                              ? "Searching…"
                              : "No faculty members found"}
                          </CommandEmpty>
                          <CommandGroup>
                            {editRowFacultyResults.map((faculty) => (
                              <CommandItem
                                key={faculty.id}
                                value={`${faculty.id}-${faculty.email}`}
                                onSelect={() => applyEditRowFacultyFromSearch(faculty)}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  applyEditRowFacultyFromSearch(faculty);
                                }}
                                className="cursor-pointer data-[selected='true']:text-white data-[selected=true]:text-white [&[data-selected='true']_p]:!text-white [&[data-selected='true']_span]:!text-white/90 [&[data-selected='true']_svg]:!text-white"
                              >
                                <div className="flex items-center gap-3 w-full py-1">
                                  {faculty.profile_picture ? (
                                    <img
                                      src={apiClient.getProfilePictureUrl(faculty.id)}
                                      alt={faculty.name}
                                      className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                                    />
                                  ) : (
                                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 [&[data-selected='true']_&]:bg-white/20">
                                      <User className="h-4 w-4 text-foreground/70" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0 space-y-0.5">
                                    <p className="text-sm font-medium truncate text-foreground">{faculty.name}</p>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="text-xs truncate text-foreground/80">{faculty.email}</p>
                                      {faculty.emp_id ? (
                                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-foreground/70">
                                          {faculty.emp_id}
                                        </span>
                                      ) : null}
                                    </div>
                                    {faculty.department ? (
                                      <p className="text-xs truncate text-foreground/70">{faculty.department}</p>
                                    ) : null}
                                  </div>
                                  {faculty.has_wallet ? (
                                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Selecting a result fills employee number, name (from directory), and department from our database.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-row-date">Date</Label>
                  <Input
                    id="edit-row-date"
                    type="date"
                    value={
                      editRowForm.date && String(editRowForm.date).length >= 10
                        ? String(editRowForm.date).slice(0, 10)
                        : ""
                    }
                    onChange={(e) =>
                      setEditRowForm((f) =>
                        f ? { ...f, date: e.target.value ? e.target.value : null } : null,
                      )
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-row-receipt">Receipt No.</Label>
                  <Input
                    id="edit-row-receipt"
                    value={editRowForm.receipt_no}
                    onChange={(e) =>
                      setEditRowForm((f) => (f ? { ...f, receipt_no: e.target.value } : null))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-row-emp">Employee number</Label>
                  <div className="relative">
                    <Input
                      id="edit-row-emp"
                      value={editRowForm.emp_no}
                      onChange={(e) =>
                        setEditRowForm((f) => (f ? { ...f, emp_no: e.target.value } : null))
                      }
                      placeholder="Employee / student ID"
                      autoComplete="off"
                    />
                    {editRowEmpLookupLoading && (
                      <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Name (from directory)</Label>
                  <div className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm min-h-[2.5rem]">
                    {editRowEmpResolvedName ? (
                      <span className="font-medium text-foreground">{editRowEmpResolvedName}</span>
                    ) : (
                      <span className="text-muted-foreground">No match yet — check employee number</span>
                    )}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-row-dept">Department (text)</Label>
                  <Input
                    id="edit-row-dept"
                    value={editRowForm.department}
                    onChange={(e) =>
                      setEditRowForm((f) => (f ? { ...f, department: e.target.value } : null))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-row-amount">Amount (Rs)</Label>
                  <Input
                    id="edit-row-amount"
                    value={editRowForm.amount}
                    onChange={(e) =>
                      setEditRowForm((f) => (f ? { ...f, amount: e.target.value } : null))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-row-payment">Payment details</Label>
                  <Input
                    id="edit-row-payment"
                    value={editRowForm.payment}
                    onChange={(e) =>
                      setEditRowForm((f) => (f ? { ...f, payment: e.target.value } : null))
                    }
                  />
                </div>
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditRowDialogOpen(false)}
                disabled={applyingRowId !== null}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleApplyEditRowDialog()}
                disabled={applyingRowId !== null || !editRowForm}
              >
                {applyingRowId !== null ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving…
                  </>
                ) : (
                  "Save & apply"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={manualReqOpen}
          onOpenChange={(open) => {
            setManualReqOpen(open);
            if (!open) {
              setManualReqRow(null);
              setManualReqSearch("");
              setManualReqUsers([]);
              setManualReqUserId("");
              setManualReqDeptId("");
              setManualReqProjectId("");
              setManualReqProjects([]);
              setManualReqNote("");
            }
          }}
        >
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto border-border/60 bg-card/95 shadow-xl">
            <DialogHeader>
              <DialogTitle>Faculty recharge request (unmatched row)</DialogTitle>
              <DialogDescription>
                Creates an entry in Recharge Request History and sends the same notifications as after a faculty confirms OTP:
                pending request email to the faculty and the approval email to accounts. Amount and receipt come from this parse row.
                Use when the file employee ID does not match anyone but you know who should receive the recharge.
              </DialogDescription>
            </DialogHeader>
            {manualReqRow && (
              <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Receipt:</span>{" "}
                  <span className="font-medium">{manualReqRow.receipt_no || "—"}</span>
                  {" · "}
                  <span className="text-muted-foreground">Amount:</span>{" "}
                  <span className="font-medium">{manualReqRow.amount ?? "—"}</span>
                </p>
                <p className="text-muted-foreground text-xs">
                  File Emp No.: {(manualReqRow.emp_no || "").trim() || "—"} (unmatched in directory)
                </p>
              </div>
            )}
            <div className="grid gap-4 py-2">
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[200px]">
                  <Label htmlFor="manual-req-user-search">Find user</Label>
                  <Input
                    id="manual-req-user-search"
                    value={manualReqSearch}
                    onChange={(e) => setManualReqSearch(e.target.value)}
                    placeholder="Name, email, or employee no."
                    className="mt-1"
                  />
                </div>
                <Button type="button" variant="secondary" onClick={() => void searchManualReqUsers()}>
                  Search
                </Button>
              </div>
              {manualReqUsers.length > 0 && (
                <div className="grid gap-2">
                  <Label htmlFor="manual-req-user-select">Wallet user</Label>
                  <select
                    id="manual-req-user-select"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={manualReqUserId === "" ? "" : String(manualReqUserId)}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) {
                        setManualReqUserId("");
                        return;
                      }
                      const id = Number(v);
                      setManualReqUserId(id);
                      const u = manualReqUsers.find((x) => x.id === id);
                      if (u?.department_id) setManualReqDeptId(u.department_id);
                    }}
                  >
                    <option value="">— Select —</option>
                    {manualReqUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email} · {u.emp_id || "—"} · {u.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="manual-req-dept">Department (sub-wallet)</Label>
                <select
                  id="manual-req-dept"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={manualReqDeptId === "" ? "" : String(manualReqDeptId)}
                  onChange={(e) => setManualReqDeptId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">— Select —</option>
                  {rechargeDepartments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                      {d.code ? ` (${d.code})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              {manualReqUserId !== "" &&
                manualReqUsers.some(
                  (x) => x.id === manualReqUserId && String(x.user_type).toLowerCase() === "faculty",
                ) && (
                  <div className="grid gap-2">
                    <Label htmlFor="manual-req-project">Project (faculty)</Label>
                    {manualReqProjectsLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading projects…
                      </div>
                    ) : (
                      <select
                        id="manual-req-project"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={manualReqProjectId === "" ? "" : String(manualReqProjectId)}
                        onChange={(e) =>
                          setManualReqProjectId(e.target.value ? Number(e.target.value) : "")
                        }
                      >
                        <option value="">— Select project —</option>
                        {manualReqProjects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {p.project_code ? ` (${p.project_code})` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                    {!manualReqProjectsLoading && manualReqProjects.length === 0 && (
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        No active projects for this faculty — they must add a project before a recharge request can be created.
                      </p>
                    )}
                  </div>
                )}
              <div className="grid gap-2">
                <Label htmlFor="manual-req-note">Note to include (optional)</Label>
                <Input
                  id="manual-req-note"
                  value={manualReqNote}
                  onChange={(e) => setManualReqNote(e.target.value)}
                  placeholder="e.g. Wrong EMP NO in bank file"
                  maxLength={500}
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setManualReqOpen(false)}
                disabled={manualReqLoading}
              >
                Cancel
              </Button>
              <Button type="button" onClick={() => void handleManualRechargeRequestSubmit()} disabled={manualReqLoading}>
                {manualReqLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating…
                  </>
                ) : (
                  "Create request & notify"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default WalletRechargeParsePage;
