import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Plus, Tag, UserPlus, History } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { format } from "date-fns";

type CouponRow = {
  id: number;
  code: string;
  amount: string;
  valid_from: string;
  valid_until: string;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  created_by_email: string | null;
  created_at: string;
};

type UsageRow = {
  id: number;
  coupon_code: string;
  booking_id: number;
  virtual_booking_id: string;
  user_email: string;
  discount_amount: string;
  used_at: string;
};

/** User type options for assign-coupon filter (matches backend UserType.get_choices()). */
const USER_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Officer In Charge" },
  { value: "operator", label: "Lab Incharge" },
  { value: "finance", label: "Accounts In Charge" },
  { value: "student", label: "Student" },
  { value: "individual_student", label: "Individual Student" },
  { value: "faculty", label: "Faculty" },
  { value: "external", label: "Educational Institute" },
  { value: "RND", label: "Govt R&D Organizations" },
  { value: "Industry", label: "Industry" },
  { value: "other", label: "Other" },
];

export default function AdminCoupons() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [usages, setUsages] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [usagesLoading, setUsagesLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignCouponId, setAssignCouponId] = useState<number | null>(null);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignUserSearch, setAssignUserSearch] = useState("");
  const [assignUserTypeFilter, setAssignUserTypeFilter] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<Array<{ id: number; email: string; name: string }>>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [createForm, setCreateForm] = useState({
    amount: "",
    valid_from: "",
    valid_until: "",
    max_uses: "",
    is_active: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"coupons" | "usages">("coupons");

  const loadCoupons = async () => {
    setLoading(true);
    try {
      const res = await apiClient.adminCouponsList();
      if (res.data && Array.isArray(res.data)) setCoupons(res.data as CouponRow[]);
      else if (Array.isArray(res)) setCoupons(res as CouponRow[]);
      else setCoupons([]);
    } catch {
      setCoupons([]);
    } finally {
      setLoading(false);
    }
  };

  const loadUsages = async () => {
    setUsagesLoading(true);
    try {
      const res = await apiClient.adminCouponUsages();
      const data = res as { results?: UsageRow[] };
      setUsages(data.results ?? []);
    } catch {
      setUsages([]);
    } finally {
      setUsagesLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
  }, []);

  useEffect(() => {
    if (activeTab === "usages") loadUsages();
  }, [activeTab]);

  const handleCreate = async () => {
    const amount = parseFloat(createForm.amount);
    if (!createForm.valid_from || !createForm.valid_until || isNaN(amount) || amount <= 0) {
      toast({ title: "Invalid form", description: "Amount, valid from and valid until are required.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.adminCouponCreate({
        amount,
        valid_from: createForm.valid_from,
        valid_until: createForm.valid_until,
        max_uses: createForm.max_uses ? parseInt(createForm.max_uses, 10) : null,
        is_active: createForm.is_active,
      });
      toast({ title: "Coupon created", description: "Code was generated. Assign it to users to share." });
      setCreateOpen(false);
      setCreateForm({ amount: "", valid_from: "", valid_until: "", max_uses: "", is_active: true });
      loadCoupons();
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error)?.message || "Failed to create coupon.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const openAssign = (couponId: number) => {
    setAssignCouponId(couponId);
    setAssignUserId("");
    setAssignUserSearch("");
    setAssignUserTypeFilter("");
    setUserSearchResults([]);
    setAssignOpen(true);
  };

  const runUserSearch = useCallback(async (search: string, userType: string) => {
    if (!search.trim() && !userType) {
      setUserSearchResults([]);
      return;
    }
    setUserSearchLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search.trim()) params.search = search.trim();
      if (userType) params.user_type = userType;
      const res = await apiClient.adminList("users", params) as { data?: { results?: Array<{ id: number; email?: string; name?: string }> } | Array<{ id: number; email?: string; name?: string }>; error?: string };
      if (res.error) {
        setUserSearchResults([]);
        return;
      }
      const data = res.data;
      const list = (data && typeof data === "object" && "results" in data && Array.isArray((data as { results: unknown[] }).results))
        ? (data as { results: Array<{ id: number; email?: string; name?: string }> }).results
        : Array.isArray(data) ? (data as Array<{ id: number; email?: string; name?: string }>) : [];
      setUserSearchResults(list.map((u) => ({ id: u.id, email: u.email || "", name: u.name || "" })));
    } catch {
      setUserSearchResults([]);
    } finally {
      setUserSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!assignOpen) return;
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    if (assignUserSearch.trim() || assignUserTypeFilter) {
      searchDebounceRef.current = setTimeout(() => {
        searchDebounceRef.current = null;
        runUserSearch(assignUserSearch, assignUserTypeFilter);
      }, 300);
    } else {
      setUserSearchResults([]);
    }
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [assignOpen, assignUserSearch, assignUserTypeFilter, runUserSearch]);

  const handleAssign = async () => {
    if (!assignCouponId || !assignUserId) {
      toast({ title: "Select a user", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.adminCouponAssign(assignCouponId, parseInt(assignUserId, 10));
      toast({ title: "Assigned", description: "Coupon has been assigned to the user." });
      setAssignOpen(false);
      setAssignCouponId(null);
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error)?.message || "Failed to assign.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-accent/20">
      <DashboardHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
        </div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Coupons</h1>
          <p className="text-muted-foreground mt-1">
            Create coupons, assign them to users, and view consumption history.
          </p>
        </div>

        <div className="flex gap-2 mb-4">
          <Button
            variant={activeTab === "coupons" ? "default" : "outline"}
            onClick={() => setActiveTab("coupons")}
          >
            <Tag className="h-4 w-4 mr-2" />
            Coupons
          </Button>
          <Button
            variant={activeTab === "usages" ? "default" : "outline"}
            onClick={() => setActiveTab("usages")}
          >
            <History className="h-4 w-4 mr-2" />
            Consumption history
          </Button>
        </div>

        {activeTab === "coupons" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Generated coupons</CardTitle>
                <CardDescription>Create new coupons and assign them to users.</CardDescription>
              </div>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create coupon
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Amount (₹)</TableHead>
                      <TableHead>Valid from</TableHead>
                      <TableHead>Valid until</TableHead>
                      <TableHead>Uses</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coupons.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono">{c.code}</TableCell>
                        <TableCell>{c.amount}</TableCell>
                        <TableCell>{format(new Date(c.valid_from), "dd MMM yyyy HH:mm")}</TableCell>
                        <TableCell>{format(new Date(c.valid_until), "dd MMM yyyy HH:mm")}</TableCell>
                        <TableCell>{c.used_count}{c.max_uses != null ? ` / ${c.max_uses}` : ""}</TableCell>
                        <TableCell>{c.is_active ? "Yes" : "No"}</TableCell>
                        <TableCell>{c.created_at ? format(new Date(c.created_at), "dd MMM yyyy") : "—"}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => openAssign(c.id)}>
                            <UserPlus className="h-4 w-4 mr-1" />
                            Assign
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {!loading && coupons.length === 0 && (
                <p className="text-muted-foreground text-center py-8">No coupons yet. Create one to get started.</p>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "usages" && (
          <Card>
            <CardHeader>
              <CardTitle>Consumption history</CardTitle>
              <CardDescription>When and by whom each coupon was used.</CardDescription>
            </CardHeader>
            <CardContent>
              {usagesLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Coupon</TableHead>
                      <TableHead>Booking</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Discount (₹)</TableHead>
                      <TableHead>Used at</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usages.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-mono">{u.coupon_code}</TableCell>
                        <TableCell>{u.virtual_booking_id || `#${u.booking_id}`}</TableCell>
                        <TableCell>{u.user_email}</TableCell>
                        <TableCell>{u.discount_amount}</TableCell>
                        <TableCell>{format(new Date(u.used_at), "dd MMM yyyy HH:mm")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {!usagesLoading && usages.length === 0 && (
                <p className="text-muted-foreground text-center py-8">No coupon usages yet.</p>
              )}
            </CardContent>
          </Card>
        )}

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create coupon</DialogTitle>
              <DialogDescription>Set amount and validity. Code is generated automatically (hard to guess).</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Amount (₹)</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={createForm.amount}
                  onChange={(e) => setCreateForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="e.g. 100"
                />
              </div>
              <div>
                <Label>Valid from</Label>
                <Input
                  type="datetime-local"
                  value={createForm.valid_from}
                  onChange={(e) => setCreateForm((f) => ({ ...f, valid_from: e.target.value }))}
                />
              </div>
              <div>
                <Label>Valid until</Label>
                <Input
                  type="datetime-local"
                  value={createForm.valid_until}
                  onChange={(e) => setCreateForm((f) => ({ ...f, valid_until: e.target.value }))}
                />
              </div>
              <div>
                <Label>Max uses (optional)</Label>
                <Input
                  type="number"
                  min="1"
                  value={createForm.max_uses}
                  onChange={(e) => setCreateForm((f) => ({ ...f, max_uses: e.target.value }))}
                  placeholder="Leave empty for unlimited"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={assignOpen} onOpenChange={(open) => { setAssignOpen(open); if (!open) setAssignCouponId(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign coupon to user</DialogTitle>
              <DialogDescription>Search by email or name; results update as you type. Optionally filter by user type.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>User type (optional)</Label>
                  <Select
                    value={assignUserTypeFilter || "all"}
                    onValueChange={(v) => setAssignUserTypeFilter(v === "all" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      {USER_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Search user (email or name)</Label>
                  <Input
                    value={assignUserSearch}
                    onChange={(e) => setAssignUserSearch(e.target.value)}
                    placeholder="Type to search..."
                    autoComplete="off"
                  />
                </div>
              </div>
              {userSearchLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching...
                </div>
              )}
              {!userSearchLoading && (assignUserSearch.trim() || assignUserTypeFilter) && userSearchResults.length === 0 && (
                <p className="text-sm text-muted-foreground">No users match. Try a different search or user type.</p>
              )}
              {userSearchResults.length > 0 && (
                <div className="border rounded p-2 max-h-48 overflow-auto">
                  {userSearchResults.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setAssignUserId(String(u.id))}
                      className={`block w-full text-left px-3 py-2 rounded ${assignUserId === String(u.id) ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                    >
                      {u.name || u.email} ({u.email})
                    </button>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
              <Button onClick={handleAssign} disabled={submitting || !assignUserId}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assign"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
