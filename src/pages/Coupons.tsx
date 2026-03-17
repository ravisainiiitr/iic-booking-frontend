import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
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
import { Loader2, ArrowLeft, Tag } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { format } from "date-fns";

type CouponItem = {
  id: number;
  code: string;
  amount: string;
  balance?: string;
  valid_from: string | null;
  valid_until: string | null;
  is_expired?: boolean;
  max_uses: number | null;
  used_count: number;
};

type CouponUsageItem = {
  id: number;
  coupon_code: string;
  discount_amount: string;
  used_at: string | null;
  booking_id: number;
  equipment_name: string | null;
  equipment_code: string | null;
};

export default function Coupons() {
  const navigate = useNavigate();
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [usages, setUsages] = useState<CouponUsageItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      apiClient.getMyCoupons(),
      apiClient.getMyCouponUsages(),
    ]).then(([couponsRes, usagesRes]) => {
      if (!mounted) return;
      const couponsData = couponsRes as { data?: { coupons?: CouponItem[] }; coupons?: CouponItem[] };
      const usagesData = usagesRes as { data?: { usages?: CouponUsageItem[] }; usages?: CouponUsageItem[] };
      setCoupons(couponsData.data?.coupons ?? couponsData.coupons ?? []);
      setUsages(usagesData.data?.usages ?? usagesData.usages ?? []);
    }).catch(() => {
      if (mounted) setCoupons([]);
      if (mounted) setUsages([]);
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-accent/20">
      <DashboardHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">My Coupons</h1>
          <p className="text-muted-foreground mt-1">
            Coupons assigned to you. Use one when booking equipment to get a discount. Select the coupon at checkout.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Available coupons
            </CardTitle>
            <CardDescription>
              Balance can be used until exhausted or validity ends. Discount is capped to the booking charge; remaining balance is available for future bookings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : coupons.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No coupons assigned to you yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Balance (₹)</TableHead>
                    <TableHead>Valid until</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono">{c.code}</TableCell>
                      <TableCell>{c.balance ?? c.amount}</TableCell>
                      <TableCell>{c.valid_until ? format(new Date(c.valid_until), "dd MMM yyyy HH:mm") : "—"}</TableCell>
                      <TableCell>
                        {c.is_expired || (c.valid_until && new Date(c.valid_until) < new Date()) ? (
                          <span className="text-destructive font-medium">Expired</span>
                        ) : Number(c.balance ?? c.amount) <= 0 ? (
                          <span className="text-muted-foreground">Exhausted</span>
                        ) : (
                          <span className="text-green-600 dark:text-green-500">Available</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Consumption history</CardTitle>
            <CardDescription>
              When and where you used coupon discounts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : usages.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No coupon usage yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Coupon</TableHead>
                    <TableHead>Discount (₹)</TableHead>
                    <TableHead>Equipment</TableHead>
                    <TableHead>Used at</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usages.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono">{u.coupon_code}</TableCell>
                      <TableCell>-{u.discount_amount}</TableCell>
                      <TableCell>{u.equipment_name || u.equipment_code || "—"}</TableCell>
                      <TableCell>{u.used_at ? format(new Date(u.used_at), "dd MMM yyyy HH:mm") : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
