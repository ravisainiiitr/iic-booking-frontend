import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowDown, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

interface Transaction {
  id: string;
  amount: number;
  transaction_type: string;
  description: string;
  created_at: string;
}

const rechargeSchema = z.object({
  amount: z.number().min(1, "Amount must be at least $1").max(10000, "Amount cannot exceed $10,000"),
});

const Wallet = () => {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndFetchWallet();
  }, []);

  const checkAuthAndFetchWallet = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    setUserId(session.user.id);
    fetchWalletData(session.user.id);
  };

  const fetchWalletData = async (userId: string) => {
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("id, balance")
      .eq("user_id", userId)
      .single();

    if (!walletError && wallet) {
      setBalance(Number(wallet.balance));
      setWalletId(wallet.id);
      fetchTransactions(userId);
    }
    setLoading(false);
  };

  const fetchTransactions = async (userId: string) => {
    const { data, error } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!error && data) {
      setTransactions(data);
    }
  };

  const handleRecharge = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const amount = parseFloat(rechargeAmount);
      const validated = rechargeSchema.parse({ amount });

      if (!userId || !walletId) {
        toast.error("User or wallet information not found");
        return;
      }

      // Update wallet balance
      const newBalance = balance + validated.amount;
      const { error: updateError } = await supabase
        .from("wallets")
        .update({ balance: newBalance })
        .eq("id", walletId);

      if (updateError) throw updateError;

      // Create transaction record
      const { error: txError } = await supabase.from("wallet_transactions").insert({
        wallet_id: walletId,
        user_id: userId,
        amount: validated.amount,
        transaction_type: "credit",
        description: "Wallet recharge",
      });

      if (txError) throw txError;

      setBalance(newBalance);
      setRechargeAmount("");
      toast.success(`Successfully recharged $${validated.amount.toFixed(2)}`);
      fetchTransactions(userId);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || "Failed to recharge wallet");
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Wallet</h1>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Current Balance</CardTitle>
              <CardDescription>Available funds in your wallet</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-primary">
                ${balance.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recharge Wallet</CardTitle>
              <CardDescription>Add funds to your wallet</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRecharge} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount ($)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="100.00"
                    value={rechargeAmount}
                    onChange={(e) => setRechargeAmount(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  Recharge
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>Recent wallet transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No transactions yet
              </p>
            ) : (
              <div className="space-y-4">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      {tx.transaction_type === "credit" ? (
                        <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                          <ArrowDown className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                          <ArrowUp className="h-5 w-5 text-red-600 dark:text-red-400" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{tx.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(tx.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`text-lg font-semibold ${
                        tx.transaction_type === "credit"
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {tx.transaction_type === "credit" ? "+" : "-"}$
                      {Number(tx.amount).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Wallet;