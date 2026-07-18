import { useEffect, useState } from "react";
import DashboardHeader from "@/components/DashboardHeader";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type RewardSummary = {
  points_balance: string;
  currency_per_point: string;
  currency_value_balance: string;
  lifetime_earned_points: string;
  lifetime_redeemed_points: string;
};

type RewardEntry = {
  id: number;
  entry_type: string;
  points: string;
  currency_value: string;
  source_type: string;
  description: string | null;
  created_at: string;
};

export default function Rewards() {
  const [summary, setSummary] = useState<RewardSummary | null>(null);
  const [entries, setEntries] = useState<RewardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const [s, l] = await Promise.all([apiClient.getMyRewardSummary(), apiClient.getMyRewardLedger()]);
      if (!mounted) return;
      setSummary((s.data as RewardSummary) || null);
      setEntries((l.data?.entries as RewardEntry[]) || []);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">TA Reward Points</h1>
          <p className="text-muted-foreground mt-1">Track earned points and redemptions.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
            <CardDescription>Current balance and lifetime totals</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : !summary ? (
              <p className="text-sm text-muted-foreground">No reward data available.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-md border p-4"><p className="text-xs text-muted-foreground">Points Balance</p><p className="text-xl font-semibold">{summary.points_balance}</p></div>
                <div className="rounded-md border p-4"><p className="text-xs text-muted-foreground">Value</p><p className="text-xl font-semibold">₹{summary.currency_value_balance}</p></div>
                <div className="rounded-md border p-4"><p className="text-xs text-muted-foreground">Lifetime Earned</p><p className="text-xl font-semibold">{summary.lifetime_earned_points}</p></div>
                <div className="rounded-md border p-4"><p className="text-xs text-muted-foreground">Lifetime Redeemed</p><p className="text-xl font-semibold">{summary.lifetime_redeemed_points}</p></div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ledger</CardTitle>
            <CardDescription>All point transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{new Date(e.created_at).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline">{e.entry_type}</Badge></TableCell>
                    <TableCell>{e.source_type}</TableCell>
                    <TableCell>{e.points}</TableCell>
                    <TableCell>₹{e.currency_value}</TableCell>
                    <TableCell>{e.description || "—"}</TableCell>
                  </TableRow>
                ))}
                {!loading && entries.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No entries yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
