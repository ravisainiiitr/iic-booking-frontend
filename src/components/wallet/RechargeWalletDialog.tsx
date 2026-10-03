import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, CreditCard, Loader2, Plus, Search, Send } from "lucide-react";
import { toast } from "sonner";

import { apiClient } from "@/lib/api";
import { loadRazorpayScript } from "@/lib/razorpay";
import {
  AWAITING_APPROVAL_TEXT,
  DEFAULT_WALLET_MODE_FLAGS,
  walletModeFlagsForDepartment,
  type WalletModeFlags,
} from "@/lib/walletModes";
import {
  EMPTY_PROJECT_FORM,
  PROJECT_GRANT_UNDERTAKING,
  PROJECT_SEARCH_THRESHOLD,
  activeRechargeProjects,
  cashUndertakingText,
  filterProjects,
  formatMoney,
  formatProjectValidity,
  isRechargeDraftDirty,
  mapProjectApiErrors,
  rechargeFormBlocker,
  validateProjectForm,
  validateRechargeAmount,
  type OfflineRechargeMode,
  type ProjectFormErrors,
  type ProjectFormValues,
  type RechargeProject,
} from "@/lib/walletRecharge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Department = { id: number; name: string; code: string | null };
type SubWalletBalance = { department_id: number; balance: string };
type OtpStep = "form" | "otp" | "sric" | "done";
type StudentPath = "cash" | "online";
type RechargeMethod = OfflineRechargeMode | "online_gateway";

const ONLINE_MAX_AMOUNT = 100000;

type SubmittedRequest = {
  id: number;
  transaction_number?: string;
  request_id?: string;
  amount?: string | number;
  recharge_mode?: string;
  user_otp_verified?: boolean;
  sric_notification_sent?: boolean;
};

export type RechargeWalletDialogProps = {
  onClose: () => void;
  onSubmitted: () => void | Promise<void>;
  isFaculty: boolean;
  userType: unknown;
  /** IITR student on a shared faculty wallet with student recharge enabled. */
  isStudentRecharge: boolean;
  subWallets: SubWalletBalance[];
  initialDepartmentId?: number | null;
  initialAmount?: string | null;
  /** Admin switch: when false, faculty cannot raise Project Grant recharge requests. */
  projectGrantEnabled?: boolean;
  /** Admin switches for every funding option; overrides projectGrantEnabled when given. */
  modeFlags?: WalletModeFlags;
};

function initialMethod(isFaculty: boolean, flags: WalletModeFlags): RechargeMethod {
  if (isFaculty && flags.projectGrant) return "project_grant";
  if (flags.directCash) return "direct_cash_deposit";
  if (flags.onlineGateway) return "online_gateway";
  return isFaculty ? "project_grant" : "direct_cash_deposit";
}

function methodEnabled(method: RechargeMethod, flags: WalletModeFlags): boolean {
  if (method === "project_grant") return flags.projectGrant;
  if (method === "online_gateway") return flags.onlineGateway;
  return flags.directCash;
}

const PROJECT_INACTIVE_MESSAGE =
  "The selected project is no longer active. Please select another active project.";
const RESEND_COOLDOWN_SECONDS = 30;

function Section({
  index,
  title,
  description,
  children,
}: {
  index: number;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3" aria-labelledby={`recharge-step-${index}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {index}
        </span>
        <div className="min-w-0">
          <h3 id={`recharge-step-${index}`} className="text-sm font-semibold text-foreground">
            {title}
          </h3>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      <div className="pl-9">{children}</div>
    </section>
  );
}

function OptionCard({
  selected,
  onSelect,
  title,
  description,
  disabled,
  unavailable,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  disabled?: boolean;
  /** Switched off by the administrator: shown greyed out with the approval notice. */
  unavailable?: boolean;
}) {
  const active = selected && !unavailable;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed",
        unavailable ? "border-dashed bg-muted/30" : "disabled:opacity-60",
        active ? "border-primary bg-primary/5 ring-1 ring-primary" : !unavailable && "border-border hover:bg-muted/40",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
          active ? "border-primary" : "border-muted-foreground/60",
        )}
      >
        {active ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
      </span>
      <span className="min-w-0">
        <span className={cn("block text-sm font-medium", unavailable ? "text-muted-foreground" : "text-foreground")}>
          {title}
        </span>
        {unavailable ? (
          <span className="mt-1 inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            {AWAITING_APPROVAL_TEXT}
          </span>
        ) : (
          <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
        )}
      </span>
    </button>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-destructive">
      {message}
    </p>
  );
}

export default function RechargeWalletDialog({
  onClose,
  onSubmitted,
  isFaculty,
  userType,
  isStudentRecharge,
  subWallets,
  initialDepartmentId = null,
  initialAmount = null,
  projectGrantEnabled = false,
  modeFlags,
}: RechargeWalletDialogProps) {
  const [serverDisabled, setServerDisabled] = useState<Record<string, Partial<WalletModeFlags>>>({});
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [departmentId, setDepartmentId] = useState<number | null>(initialDepartmentId);
  const flags = useMemo<WalletModeFlags>(
    () => ({
      ...walletModeFlagsForDepartment(
        modeFlags ?? { ...DEFAULT_WALLET_MODE_FLAGS, projectGrant: projectGrantEnabled },
        departmentId,
      ),
      ...serverDisabled[String(departmentId ?? "")],
    }),
    [modeFlags, projectGrantEnabled, serverDisabled, departmentId],
  );
  const [mode, setMode] = useState<RechargeMethod>(() => initialMethod(isFaculty, flags));
  const [studentPath, setStudentPath] = useState<StudentPath>(() =>
    !flags.directCash && flags.onlineGateway ? "online" : "cash",
  );
  const [paying, setPaying] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const [amount, setAmount] = useState(initialAmount ?? "");
  const [amountTouched, setAmountTouched] = useState(Boolean(initialAmount));

  const [projects, setProjects] = useState<RechargeProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(isFaculty);
  const [projectsLoadFailed, setProjectsLoadFailed] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [changingProject, setChangingProject] = useState(false);
  const [projectQuery, setProjectQuery] = useState("");
  const [projectAlert, setProjectAlert] = useState<string | null>(null);
  const [projectNotice, setProjectNotice] = useState<string | null>(null);

  const [addingProject, setAddingProject] = useState(false);
  const [projectForm, setProjectForm] = useState<ProjectFormValues>(EMPTY_PROJECT_FORM);
  const [projectFormErrors, setProjectFormErrors] = useState<ProjectFormErrors>({});
  const [savingProject, setSavingProject] = useState(false);

  const [undertakingAccepted, setUndertakingAccepted] = useState(false);

  const [otpStep, setOtpStep] = useState<OtpStep>("form");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<number | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [showBlockers, setShowBlockers] = useState(false);

  const [submitted, setSubmitted] = useState<SubmittedRequest | null>(null);
  const [sendingSric, setSendingSric] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const inFlight = useRef(false);

  const isOnline = isStudentRecharge ? studentPath === "online" : mode === "online_gateway";
  const isProjectGrant = isFaculty && !isOnline && mode === "project_grant";
  const isCashPath = !isOnline && !isProjectGrant;
  const offlineMode: OfflineRechargeMode = isProjectGrant ? "project_grant" : "direct_cash_deposit";
  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );
  const selectedDepartment = useMemo(
    () => departments.find((d) => d.id === departmentId) ?? null,
    [departments, departmentId],
  );
  const undertakingText = isProjectGrant ? PROJECT_GRANT_UNDERTAKING : cashUndertakingText(userType, isFaculty);
  const amountError = validateRechargeAmount(amount);
  const busy = sendingOtp || verifying || savingProject || sendingSric || paying;

  const methodBlocker =
    isProjectGrant && !flags.projectGrant
      ? `Project Grant: ${AWAITING_APPROVAL_TEXT}.`
      : isCashPath && !flags.directCash
        ? `Direct Cash Deposit / Bank Transfer: ${AWAITING_APPROVAL_TEXT}.`
        : isOnline && !flags.onlineGateway
          ? `Online payment: ${AWAITING_APPROVAL_TEXT}.`
          : null;

  const blocker =
    methodBlocker ??
    (isOnline
      ? !departmentId
        ? "Select the department to recharge."
        : amountError ||
          (Number(amount) > ONLINE_MAX_AMOUNT
            ? `Online recharge is limited to ${formatMoney(ONLINE_MAX_AMOUNT)} per payment.`
            : null)
      : rechargeFormBlocker({
          isFaculty,
          mode: offlineMode,
          departmentId,
          amount,
          projectId: selectedProjectId,
          undertakingAccepted,
        }));

  const loadProjects = useCallback(async (): Promise<RechargeProject[]> => {
    setLoadingProjects(true);
    setProjectsLoadFailed(false);
    try {
      const res = await apiClient.getProjects();
      if (res.error || !res.data) {
        setProjectsLoadFailed(true);
        return [];
      }
      const active = activeRechargeProjects(res.data.projects || []);
      setProjects(active);
      return active;
    } catch {
      setProjectsLoadFailed(true);
      return [];
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    if (isFaculty) void loadProjects();
  }, [isFaculty, loadProjects]);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getDepartmentsForRecharge()
      .then((res) => {
        if (cancelled) return;
        const list = (res.data?.departments || []).filter((d: Department) => {
          const name = (d.name || "").trim().toLowerCase();
          const code = (d.code || "").trim().toLowerCase();
          return name !== "admin" && code !== "admin";
        });
        setDepartments(list);
        setDepartmentId((prev) => {
          if (prev != null && list.some((d) => d.id === prev)) return prev;
          if (list.length === 1) return list[0].id;
          const allowed = new Set(list.map((d) => d.id));
          const candidates = subWallets.filter((sw) => allowed.has(sw.department_id));
          if (candidates.length === 0) return null;
          return candidates.reduce((best, sw) =>
            parseFloat(String(sw.balance)) < parseFloat(String(best.balance)) ? sw : best,
          ).department_id;
        });
      })
      .finally(() => {
        if (!cancelled) setLoadingDepartments(false);
      });
    return () => {
      cancelled = true;
    };
    // Departments are loaded once per dialog session; sub-wallet balances only seed the default.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  const selectMode = (next: RechargeMethod) => {
    if (next === mode) return;
    setMode(next);
    setUndertakingAccepted(false);
    setFormError(null);
    setShowBlockers(false);
    if (next !== "project_grant") {
      setAddingProject(false);
      setChangingProject(false);
    }
  };

  useEffect(() => {
    if (otpStep !== "form") return;
    if (!isStudentRecharge && !methodEnabled(mode, flags)) {
      const next = initialMethod(isFaculty, flags);
      if (next !== mode && methodEnabled(next, flags)) {
        setMode(next);
        setUndertakingAccepted(false);
        setAddingProject(false);
        setChangingProject(false);
      }
    }
    if (isStudentRecharge) {
      if (studentPath === "cash" && !flags.directCash && flags.onlineGateway) setStudentPath("online");
      if (studentPath === "online" && !flags.onlineGateway) setStudentPath("cash");
    }
  }, [flags, mode, otpStep, isFaculty, isStudentRecharge, studentPath]);

  const handleModeDisabled = (code: string | undefined, message?: string | null) => {
    const key = String(departmentId ?? "");
    const disable = (flag: keyof WalletModeFlags) =>
      setServerDisabled((p) => ({ ...p, [key]: { ...p[key], [flag]: false } }));
    if (code === "project_grant_recharge_disabled") disable("projectGrant");
    if (code === "direct_cash_recharge_disabled") disable("directCash");
    if (code === "online_gateway_recharge_disabled") disable("onlineGateway");
    setOtpStep("form");
    setRequestId(null);
    setOtp("");
    setUndertakingAccepted(false);
    setAddingProject(false);
    setChangingProject(false);
    setFormError(message || `This recharge method is not available: ${AWAITING_APPROVAL_TEXT}.`);
  };

  const selectProject = (id: number) => {
    if (id !== selectedProjectId) setUndertakingAccepted(false);
    setSelectedProjectId(id);
    setChangingProject(false);
    setProjectAlert(null);
    setProjectNotice(null);
    setFormError(null);
  };

  const openProjectForm = () => {
    setAddingProject(true);
    setProjectFormErrors({});
    setProjectNotice(null);
  };

  const cancelProjectForm = () => {
    setAddingProject(false);
    setProjectForm(EMPTY_PROJECT_FORM);
    setProjectFormErrors({});
  };

  const updateProjectField = (field: keyof ProjectFormValues, value: string) => {
    setProjectForm((prev) => ({ ...prev, [field]: value }));
    setProjectFormErrors((prev) => {
      if (!prev[field] && !prev.form) return prev;
      const next = { ...prev };
      delete next[field];
      delete next.form;
      return next;
    });
  };

  const saveProject = async () => {
    if (savingProject) return;
    const errors = validateProjectForm(projectForm);
    setProjectFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSavingProject(true);
    try {
      const res = await apiClient.createProject({
        name: projectForm.name.trim(),
        project_code: projectForm.project_code.trim(),
        agency: projectForm.agency.trim(),
        start_date: projectForm.start_date || null,
        end_date: projectForm.end_date || null,
      });
      if (res.error || !res.data) {
        setProjectFormErrors(mapProjectApiErrors(res));
        return;
      }
      const createdId = res.data.id;
      const active = await loadProjects();
      setAddingProject(false);
      setProjectForm(EMPTY_PROJECT_FORM);
      setProjectFormErrors({});
      if (active.some((p) => p.id === createdId)) {
        selectProject(createdId);
        setProjectNotice("Project added successfully.");
      } else {
        setProjectAlert(
          "Project added, but it has already ended, so it cannot fund a recharge. Select another project or update its dates from your Profile.",
        );
      }
    } catch {
      setProjectFormErrors({ form: "The project could not be saved. Please check the details and try again." });
    } finally {
      setSavingProject(false);
    }
  };

  const handleProjectRejected = async (message: string) => {
    setOtpStep("form");
    setOtp("");
    setOtpError(null);
    setRequestId(null);
    setSelectedProjectId(null);
    setUndertakingAccepted(false);
    setChangingProject(false);
    setProjectQuery("");
    setProjectNotice(null);
    setProjectAlert(message);
    await loadProjects();
  };

  const sendOtp = async (isResend = false) => {
    if (inFlight.current) return;
    if (blocker) {
      setShowBlockers(true);
      setAmountTouched(true);
      return;
    }
    inFlight.current = true;
    setSendingOtp(true);
    setFormError(null);
    setOtpError(null);
    try {
      const res = await apiClient.sendUserOtpForRecharge(
        parseFloat(amount),
        departmentId as number,
        offlineMode === "project_grant" ? selectedProjectId : null,
        false,
        { rechargeMode: offlineMode, undertakingAccepted },
      );
      if (res.error || !res.data) {
        if (res.errorCode === "project_grant_recharge_disabled" || res.errorCode === "direct_cash_recharge_disabled") {
          handleModeDisabled(res.errorCode, res.error);
        } else if (res.errorCode === "project_inactive" || res.fieldErrors?.project_id) {
          await handleProjectRejected(PROJECT_INACTIVE_MESSAGE);
        } else if (res.errorCode === "undertaking_required") {
          setUndertakingAccepted(false);
          setOtpStep("form");
          setFormError(res.error || "Please accept the undertaking before continuing.");
        } else if (isResend) {
          setOtpError(res.error || "Could not resend the OTP. Please try again.");
        } else {
          setFormError(res.error || "Could not send the OTP. Please try again.");
        }
        return;
      }
      setRequestId(res.data.request_id);
      setOtp("");
      setOtpStep("otp");
      setResendIn(RESEND_COOLDOWN_SECONDS);
      if (isResend) toast.success("A new OTP has been sent to your registered email.");
    } catch {
      setFormError("Could not send the OTP. Please try again.");
    } finally {
      inFlight.current = false;
      setSendingOtp(false);
    }
  };

  const verifyAndSubmit = async () => {
    if (inFlight.current || !requestId) return;
    if (otp.length !== 6) {
      setOtpError("Enter the 6-digit OTP from your email.");
      return;
    }
    inFlight.current = true;
    setVerifying(true);
    setOtpError(null);
    try {
      const res = await apiClient.createWalletRechargeRequest(requestId, otp);
      if (res.error || !res.data) {
        if (res.errorCode === "project_grant_recharge_disabled" || res.errorCode === "direct_cash_recharge_disabled") {
          handleModeDisabled(res.errorCode, res.error);
        } else if (res.errorCode === "project_inactive") {
          await handleProjectRejected(PROJECT_INACTIVE_MESSAGE);
        } else if (res.errorCode === "undertaking_required") {
          setOtpStep("form");
          setRequestId(null);
          setUndertakingAccepted(false);
          setFormError(res.error || "Please accept the undertaking and request a new OTP.");
        } else {
          setOtpError(res.error || "Could not verify the OTP. Please try again.");
        }
        return;
      }
      const req = res.data.request as unknown as SubmittedRequest | undefined;
      const cash =
        mode === "direct_cash_deposit" ||
        !isFaculty ||
        String(req?.recharge_mode || "").toLowerCase() === "direct_cash_deposit";
      if (req) setSubmitted(req);
      setOtp("");
      const needsSric = isFaculty && !cash && req?.user_otp_verified && !req?.sric_notification_sent;
      setOtpStep(needsSric ? "sric" : "done");
      toast.success(res.data.message || "Recharge request submitted.");
      await onSubmitted();
    } catch {
      setOtpError("Could not verify the OTP. Please try again.");
    } finally {
      inFlight.current = false;
      setVerifying(false);
    }
  };

  const payOnline = async () => {
    if (inFlight.current) return;
    if (blocker || !departmentId) {
      setShowBlockers(true);
      setAmountTouched(true);
      return;
    }
    inFlight.current = true;
    setPaying(true);
    setFormError(null);
    const finish = () => {
      inFlight.current = false;
      setPaying(false);
      setCheckoutOpen(false);
    };
    try {
      const ok = await loadRazorpayScript();
      if (!ok || !window.Razorpay) {
        setFormError("Could not load the payment page. Check your connection and try again.");
        finish();
        return;
      }
      const res = await apiClient.createRazorpayOrder(parseFloat(amount), departmentId);
      if (res.error || !res.data) {
        if (res.errorCode === "online_gateway_recharge_disabled") handleModeDisabled(res.errorCode, res.error);
        else setFormError(res.error || "Could not start the payment. Please try again.");
        finish();
        return;
      }
      const order = res.data;
      const rzp = new window.Razorpay({
        key: order.key || order.key_id,
        amount: order.amount,
        currency: order.currency || "INR",
        name: "IIC Equipment Booking",
        description: `Wallet recharge — ${selectedDepartment?.name ?? "department"}`,
        order_id: order.order_id,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          const verify = await apiClient.verifyRazorpayCheckout(response);
          if (verify.error) {
            finish();
            setFormError(verify.error);
            return;
          }
          toast.success(`Payment successful. ${formatMoney(amount)} added to your wallet.`);
          await onSubmitted();
          onClose();
        },
        modal: { ondismiss: finish },
        theme: { color: "#1e4d8c" },
      });
      setCheckoutOpen(true);
      rzp.open();
    } catch {
      setFormError("Could not start the payment. Please try again.");
      finish();
    }
  };

  const sendToSric = async () => {
    if (!submitted || sendingSric) return;
    setSendingSric(true);
    try {
      const res = await apiClient.sendSricWalletRechargeNotification(submitted.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data?.message || "Request sent to the SRIC Office.");
      setSubmitted((prev) => (prev ? { ...prev, sric_notification_sent: true } : prev));
      setOtpStep("done");
      await onSubmitted();
    } finally {
      setSendingSric(false);
    }
  };

  const dirty = isRechargeDraftDirty({
    amount: initialAmount && amount === initialAmount ? "" : amount,
    projectId: selectedProjectId,
    undertakingAccepted,
    projectForm: addingProject ? projectForm : null,
    otpStep,
  });

  const requestClose = () => {
    if (busy) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  };

  const steps = useMemo(() => {
    const list: string[] = ["Method"];
    if (isProjectGrant) list.push("Project");
    list.push("Amount");
    if (!isOnline) list.push("Undertaking");
    list.push(isOnline ? "Payment" : "Verification");
    return list;
  }, [isProjectGrant, isOnline]);
  const stepIndex = (name: string) => steps.indexOf(name) + 1;

  const showProjectPicker = isProjectGrant && !addingProject && projects.length > 0 && (!selectedProject || changingProject);
  const visibleProjects = filterProjects(projects, projectQuery);
  const cashDescription = isFaculty
    ? "Use this option when an eligible project cannot be used to fund this recharge."
    : "Deposit cash or transfer funds to SRIC, then share the transaction number.";
  const onlineDescription = "Card, UPI or net banking through Razorpay. Credited instantly; a convenience fee applies.";

  const renderProjectSection = () => {
    if (loadingProjects && projects.length === 0) {
      return (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your projects…
        </p>
      );
    }
    return (
      <div className="space-y-3">
        {projectAlert ? (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {projectAlert}
          </p>
        ) : null}
        {projectsLoadFailed ? (
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
            <span className="text-muted-foreground">Your projects could not be loaded.</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadProjects()}>
              Retry
            </Button>
          </div>
        ) : null}

        {selectedProject && !changingProject && !addingProject ? (
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium text-foreground">{selectedProject.name}</p>
                <p className="text-xs text-muted-foreground">
                  Project code: <span className="font-mono text-foreground">{selectedProject.project_code}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Agency: {selectedProject.agency || "—"} · {formatProjectValidity(selectedProject.end_date)}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 self-start"
              onClick={() => {
                setChangingProject(true);
                setProjectNotice(null);
              }}
              disabled={busy}
            >
              Change project
            </Button>
          </div>
        ) : null}
        {projectNotice && selectedProject && !changingProject ? (
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400" role="status">
            {projectNotice}
          </p>
        ) : null}

        {showProjectPicker ? (
          <div className="space-y-2">
            {projects.length > PROJECT_SEARCH_THRESHOLD ? (
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={projectQuery}
                  onChange={(e) => setProjectQuery(e.target.value)}
                  placeholder="Search by name, code or agency"
                  className="h-9 pl-8"
                  aria-label="Search projects"
                />
              </div>
            ) : null}
            <div role="radiogroup" aria-label="Active projects" className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
              {visibleProjects.length === 0 ? (
                <p className="px-1 py-2 text-sm text-muted-foreground">No projects match your search.</p>
              ) : (
                visibleProjects.map((p) => {
                  const selected = p.id === selectedProjectId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => selectProject(p.id)}
                      className={cn(
                        "w-full rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                      )}
                    >
                      <span className="block text-sm font-medium text-foreground">{p.name}</span>
                      <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                        <span className="font-mono text-foreground/80">{p.project_code}</span>
                        <span aria-hidden>·</span>
                        <span>{p.agency || "—"}</span>
                        <span aria-hidden>·</span>
                        <span>{formatProjectValidity(p.end_date)}</span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <button
                type="button"
                onClick={openProjectForm}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Add a new project
              </button>
              {changingProject && selectedProject ? (
                <button
                  type="button"
                  onClick={() => setChangingProject(false)}
                  className="text-sm text-muted-foreground hover:underline"
                >
                  Keep {selectedProject.project_code}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {!addingProject && !loadingProjects && !projectsLoadFailed && projects.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4">
            <p className="text-sm font-medium text-foreground">No active project found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              You need an active project to recharge the wallet using project funds.
            </p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={openProjectForm}>
              <Plus className="mr-1 h-4 w-4" /> Add Project
            </Button>
          </div>
        ) : null}

        {addingProject ? (
          <form
            className="space-y-3 rounded-lg border bg-background p-4 shadow-sm"
            onSubmit={(e) => {
              e.preventDefault();
              void saveProject();
            }}
            noValidate
            aria-label="Add project"
          >
            <div>
              <p className="text-sm font-semibold text-foreground">Add Project</p>
              <p className="text-xs text-muted-foreground">
                The project is saved to your profile and selected for this recharge.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inline-project-name">Project Name *</Label>
              <Input
                id="inline-project-name"
                value={projectForm.name}
                onChange={(e) => updateProjectField("name", e.target.value)}
                aria-invalid={Boolean(projectFormErrors.name)}
                aria-describedby="inline-project-name-error"
                maxLength={255}
                autoFocus
              />
              <FieldError id="inline-project-name-error" message={projectFormErrors.name} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="inline-project-code">Project Code *</Label>
                <Input
                  id="inline-project-code"
                  value={projectForm.project_code}
                  onChange={(e) => updateProjectField("project_code", e.target.value)}
                  aria-invalid={Boolean(projectFormErrors.project_code)}
                  aria-describedby="inline-project-code-error"
                  maxLength={100}
                  className="font-mono"
                />
                <FieldError id="inline-project-code-error" message={projectFormErrors.project_code} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inline-project-agency">Funding Agency *</Label>
                <Input
                  id="inline-project-agency"
                  value={projectForm.agency}
                  onChange={(e) => updateProjectField("agency", e.target.value)}
                  aria-invalid={Boolean(projectFormErrors.agency)}
                  aria-describedby="inline-project-agency-error"
                  maxLength={255}
                />
                <FieldError id="inline-project-agency-error" message={projectFormErrors.agency} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="inline-project-start">Start Date</Label>
                <Input
                  id="inline-project-start"
                  type="date"
                  value={projectForm.start_date}
                  onChange={(e) => updateProjectField("start_date", e.target.value)}
                  aria-invalid={Boolean(projectFormErrors.start_date)}
                  aria-describedby="inline-project-start-error"
                />
                <FieldError id="inline-project-start-error" message={projectFormErrors.start_date} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inline-project-end">End Date</Label>
                <Input
                  id="inline-project-end"
                  type="date"
                  value={projectForm.end_date}
                  min={projectForm.start_date || undefined}
                  onChange={(e) => updateProjectField("end_date", e.target.value)}
                  aria-invalid={Boolean(projectFormErrors.end_date)}
                  aria-describedby="inline-project-end-error"
                />
                <FieldError id="inline-project-end-error" message={projectFormErrors.end_date} />
              </div>
            </div>
            {projectFormErrors.form ? (
              <p role="alert" className="text-sm text-destructive">
                {projectFormErrors.form}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" disabled={savingProject}>
                {savingProject ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                Save Project
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={cancelProjectForm} disabled={savingProject}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    );
  };

  const renderForm = () => (
    <div className="space-y-6">
      {isStudentRecharge ? (
        <Section index={stepIndex("Method")} title="Recharge method">
          <div role="radiogroup" aria-label="Recharge method" className="grid gap-2">
            <OptionCard
              selected={studentPath === "cash"}
              onSelect={() => {
                setStudentPath("cash");
                setUndertakingAccepted(false);
                setFormError(null);
              }}
              title="Direct Cash Deposit / Bank Transfer"
              description="Request routed to the SRIC Bill Section after OTP verification."
              disabled={busy || !flags.directCash}
              unavailable={!flags.directCash}
            />
            <OptionCard
              selected={studentPath === "online"}
              onSelect={() => {
                setStudentPath("online");
                setFormError(null);
              }}
              title="Pay online"
              description={onlineDescription}
              disabled={busy || !flags.onlineGateway}
              unavailable={!flags.onlineGateway}
            />
          </div>
        </Section>
      ) : (
        <Section index={stepIndex("Method")} title="Recharge method">
          <div role="radiogroup" aria-label="Recharge method" className="grid gap-2">
            {isFaculty ? (
              <OptionCard
                selected={mode === "project_grant"}
                onSelect={() => selectMode("project_grant")}
                title="Project Grant"
                description="Use an active project to fund this recharge."
                disabled={busy || !flags.projectGrant}
                unavailable={!flags.projectGrant}
              />
            ) : null}
            <OptionCard
              selected={mode === "direct_cash_deposit"}
              onSelect={() => selectMode("direct_cash_deposit")}
              title="Direct Cash Deposit / Bank Transfer"
              description={cashDescription}
              disabled={busy || !flags.directCash}
              unavailable={!flags.directCash}
            />
            <OptionCard
              selected={mode === "online_gateway"}
              onSelect={() => selectMode("online_gateway")}
              title="Pay online"
              description={onlineDescription}
              disabled={busy || !flags.onlineGateway}
              unavailable={!flags.onlineGateway}
            />
          </div>
        </Section>
      )}

      {isProjectGrant ? (
        <Section index={stepIndex("Project")} title="Project">
          {renderProjectSection()}
        </Section>
      ) : null}

      <Section index={stepIndex("Amount")} title="Amount">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="recharge-department">Credit to</Label>
            {loadingDepartments ? (
              <p className="text-sm text-muted-foreground">Loading departments…</p>
            ) : departments.length === 1 ? (
              <p id="recharge-department" className="text-sm text-foreground">
                {departments[0].name}
                {departments[0].code ? ` (${departments[0].code})` : ""}
              </p>
            ) : (
              <select
                id="recharge-department"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={departmentId ?? ""}
                onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : null)}
                disabled={busy}
              >
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                    {d.code ? ` (${d.code})` : ""}
                  </option>
                ))}
              </select>
            )}
            {showBlockers && !departmentId && !loadingDepartments ? (
              <FieldError id="recharge-department-error" message="Select the department to recharge." />
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recharge-amount">Amount (₹)</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                ₹
              </span>
              <Input
                id="recharge-amount"
                inputMode="decimal"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                onBlur={() => setAmountTouched(true)}
                aria-invalid={Boolean(amountTouched && amountError)}
                aria-describedby="recharge-amount-hint recharge-amount-error"
                className="pl-7 tabular-nums"
                disabled={busy}
              />
            </div>
            <p id="recharge-amount-hint" className="text-xs text-muted-foreground">
              {isOnline ? "Minimum ₹100, maximum ₹1,00,000 per payment." : "Minimum ₹100."}
            </p>
            {amountTouched ? <FieldError id="recharge-amount-error" message={amountError ?? undefined} /> : null}
          </div>
        </div>
      </Section>

      {isOnline ? (
        <Section index={stepIndex("Payment")} title="Payment">
          <p className="text-sm text-muted-foreground">
            You will be taken to the secure Razorpay payment page. A convenience fee and GST are added to the amount and
            shown there before you pay. The amount is added to the selected department as soon as the payment is
            confirmed.
          </p>
        </Section>
      ) : (
        <>
          <Section
            index={stepIndex("Undertaking")}
            title={isProjectGrant ? "Project undertaking" : "Undertaking"}
            description={isProjectGrant ? "This is your declaration. The portal does not check project account balances." : undefined}
          >
            <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
              <p className="text-sm leading-relaxed text-foreground">{undertakingText}</p>
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="recharge-undertaking"
                  checked={undertakingAccepted}
                  onCheckedChange={(checked) => {
                    setUndertakingAccepted(checked === true);
                    setFormError(null);
                  }}
                  disabled={busy || (isProjectGrant && !selectedProject)}
                  className="mt-0.5"
                />
                <Label htmlFor="recharge-undertaking" className="cursor-pointer text-sm font-medium leading-snug">
                  I agree to the above undertaking.
                </Label>
              </div>
              {isProjectGrant && !selectedProject ? (
                <p className="text-xs text-muted-foreground">Select a project first.</p>
              ) : null}
            </div>
          </Section>

          <Section index={stepIndex("Verification")} title="Verification">
            <p className="text-sm text-muted-foreground">
              An OTP will be sent to your registered email for verification.
              {isProjectGrant
                ? " After verification the request goes to the SRIC Office for approval."
                : " After verification, deposit cash or complete the bank transfer at the SRIC Bill Section and share the transaction number."}
            </p>
          </Section>
        </>
      )}
    </div>
  );

  const renderOtp = () => (
    <div className="space-y-5">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
        <dt className="text-muted-foreground">Method</dt>
        <dd className="font-medium">{isProjectGrant ? "Project Grant" : "Direct Cash Deposit / Bank Transfer"}</dd>
        {isProjectGrant && selectedProject ? (
          <>
            <dt className="text-muted-foreground">Project</dt>
            <dd>
              <span className="block font-medium">{selectedProject.name}</span>
              <span className="font-mono text-xs text-muted-foreground">{selectedProject.project_code}</span>
            </dd>
          </>
        ) : null}
        {selectedDepartment ? (
          <>
            <dt className="text-muted-foreground">Credit to</dt>
            <dd>{selectedDepartment.name}</dd>
          </>
        ) : null}
        <dt className="text-muted-foreground">Amount</dt>
        <dd className="font-semibold tabular-nums">{formatMoney(amount)}</dd>
        <dt className="text-muted-foreground">Undertaking</dt>
        <dd className="text-emerald-700 dark:text-emerald-400">Accepted</dd>
      </dl>
      <div className="space-y-1.5">
        <Label htmlFor="recharge-otp">Enter OTP</Label>
        <Input
          id="recharge-otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="6-digit code"
          value={otp}
          onChange={(e) => {
            setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
            setOtpError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void verifyAndSubmit();
          }}
          aria-invalid={Boolean(otpError)}
          aria-describedby="recharge-otp-hint recharge-otp-error"
          className="h-11 text-center font-mono text-xl tracking-[0.4em]"
          disabled={verifying}
          autoFocus
        />
        <p id="recharge-otp-hint" className="text-xs text-muted-foreground">
          We&apos;ve sent an OTP to your registered email. It expires in 10 minutes.
        </p>
        <FieldError id="recharge-otp-error" message={otpError ?? undefined} />
      </div>
      <button
        type="button"
        className="text-sm font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
        onClick={() => void sendOtp(true)}
        disabled={resendIn > 0 || sendingOtp || verifying}
      >
        {sendingOtp ? "Sending…" : resendIn > 0 ? `Resend OTP in ${resendIn}s` : "Resend OTP"}
      </button>
    </div>
  );

  const submittedIsCash =
    String(submitted?.recharge_mode || "").toLowerCase() === "direct_cash_deposit" || (!isFaculty && !isProjectGrant);
  const sricLabel = submittedIsCash ? "SRIC Bill Section" : "SRIC Office";

  const renderDone = () => (
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" /> Request submitted
        </p>
        {submitted?.transaction_number || submitted?.request_id ? (
          <p className="text-base font-semibold tracking-wide">
            Transaction ID: {submitted.transaction_number || submitted.request_id}
          </p>
        ) : null}
        {submitted?.amount != null ? (
          <p className="text-lg font-bold tabular-nums text-primary">{formatMoney(submitted.amount)}</p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Keep this transaction number to track your recharge request.
        </p>
        {submittedIsCash ? (
          <ol className="list-inside list-decimal space-y-1 text-sm text-foreground/90">
            <li>Visit the SRIC Bill Section to deposit cash (or complete the bank transfer).</li>
            <li>Share the transaction number with the SRIC Bill Section for immediate recharge.</li>
          </ol>
        ) : null}
        {otpStep === "sric" ? (
          <p className="text-sm text-muted-foreground">
            Send the request to the {sricLabel} by email if it was not already notified.
          </p>
        ) : null}
      </div>
    </div>
  );

  const title = otpStep === "otp" ? "Verify your request" : otpStep === "form" ? "Recharge Wallet" : "Recharge request submitted";
  const description =
    otpStep === "otp"
      ? "We've sent an OTP to your registered email."
      : otpStep === "form"
        ? "Choose how you want to add funds to your wallet."
        : "Your request has been recorded.";

  return (
    <>
      <Dialog
        open={!checkoutOpen}
        onOpenChange={(open) => {
          if (!open) requestClose();
        }}
      >
        <DialogContent
          className="flex max-h-[92dvh] max-w-xl flex-col gap-0 overflow-hidden p-0"
          onInteractOutside={(e) => {
            if (busy) e.preventDefault();
          }}
        >
          <DialogHeader className="space-y-1 border-b px-5 pb-4 pt-5 text-left sm:px-6">
            <DialogTitle className="text-lg">{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
            {otpStep === "form" && steps.length > 2 ? (
              <ol className="flex flex-wrap gap-x-3 gap-y-1 pt-2 text-xs text-muted-foreground" aria-label="Steps">
                {steps.map((s, i) => (
                  <li key={s} className="flex items-center gap-1">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground/70">
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ol>
            ) : null}
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            {otpStep === "form" ? renderForm() : otpStep === "otp" ? renderOtp() : renderDone()}
          </div>

          <div className="flex flex-col gap-2 border-t bg-muted/30 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="min-h-[1rem] text-xs text-muted-foreground sm:max-w-[55%]" aria-live="polite">
              {otpStep === "form"
                ? formError
                  ? <span className="text-destructive">{formError}</span>
                  : showBlockers && blocker
                    ? <span className="text-destructive">{blocker}</span>
                    : blocker ?? "Ready to continue."
                : null}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {otpStep === "form" ? (
                <>
                  <Button type="button" variant="ghost" onClick={requestClose} disabled={busy}>
                    Cancel
                  </Button>
                  {isOnline ? (
                    <Button type="button" onClick={() => void payOnline()} disabled={busy || Boolean(blocker)}>
                      {paying ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CreditCard className="mr-2 h-4 w-4" />
                      )}
                      Proceed to pay
                    </Button>
                  ) : (
                    <Button type="button" onClick={() => void sendOtp()} disabled={busy || Boolean(blocker)}>
                      {sendingOtp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Send OTP
                    </Button>
                  )}
                </>
              ) : otpStep === "otp" ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setOtpStep("form");
                      setOtp("");
                      setOtpError(null);
                      setRequestId(null);
                    }}
                    disabled={verifying}
                  >
                    Back
                  </Button>
                  <Button type="button" onClick={() => void verifyAndSubmit()} disabled={verifying || otp.length !== 6}>
                    {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Verify &amp; Submit
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={onClose} disabled={sendingSric}>
                    Close
                  </Button>
                  {otpStep === "sric" && submitted && !submitted.sric_notification_sent ? (
                    <Button type="button" onClick={() => void sendToSric()} disabled={sendingSric}>
                      {sendingSric ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Send to {sricLabel}
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this recharge request?</AlertDialogTitle>
            <AlertDialogDescription>
              The project, amount and other details you entered will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setConfirmDiscard(false);
                onClose();
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
