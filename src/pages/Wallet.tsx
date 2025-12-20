import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ArrowDown, ArrowUp } from "lucide-react";
import { toast } from "sonner";

interface Transaction {
  id: number;
  transaction_type: "credit" | "debit";
  amount: string;
  description: string;
  created_at: string;
}

const Wallet = () => {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndFetchWallet();
  }, []);

  const checkAuthAndFetchWallet = async () => {
    const token = apiClient.getToken();
    if (!token) {
      navigate("/auth");
      return;
    }

    const userResponse = await apiClient.getCurrentUser();
    if (userResponse.error || !userResponse.data) {
      navigate("/auth");
      return;
    }

    // Check if user type allows wallets (student, faculty, external)
    // user_type can be a number or string, so check user_type_code or user_type_name
    const allowedWalletTypes = ['student', 'faculty', 'external'];
    const userTypeCode = userResponse.data?.user_type_code || 
      (typeof userResponse.data?.user_type === 'string' ? userResponse.data.user_type.toLowerCase() : null);
    const userCanHaveWallet = userTypeCode && allowedWalletTypes.includes(userTypeCode);

    if (!userCanHaveWallet) {
      toast.error("Only students, faculty, and external users can have wallets.");
      navigate("/dashboard");
      return;
    }

    setUserId(userResponse.data.id);
    await fetchWalletData();
  };

  const fetchWalletData = async () => {
    try {
      const walletResponse = await apiClient.getWallet();
      if (walletResponse.error) {
        if (walletResponse.error.includes("Only students, faculty, and external users")) {
          toast.error("Only students, faculty, and external users can have wallets.");
          navigate("/dashboard");
          return;
        }
        // If wallet doesn't exist yet, show empty state instead of error
        if (walletResponse.error.includes("404") || walletResponse.error.includes("Not found")) {
          setBalance(0);
          setTransactions([]);
          setLoading(false);
          return;
        }
        throw new Error(walletResponse.error);
      }
      
      if (walletResponse.data) {
        setBalance(Number(walletResponse.data.wallet.balance));
        setWalletId(String(walletResponse.data.wallet.id));
        
        // Use recent_transactions from the wallet response, or fetch separately
        if (walletResponse.data.recent_transactions && walletResponse.data.recent_transactions.length > 0) {
          setTransactions(walletResponse.data.recent_transactions);
        } else {
          await fetchTransactions();
        }
      }
    } catch (error: any) {
      console.error("Wallet error:", error);
      // Don't redirect on error, just show empty state
      setBalance(0);
      setTransactions([]);
      toast.error(error.message || "Failed to load wallet data. Showing empty wallet.");
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    const response = await apiClient.getWalletTransactions();
    if (response.data?.transactions) {
      setTransactions(response.data.transactions);
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

        <Card className="mb-8">
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
                        <p className="font-medium">{tx.description || "Transaction"}</p>
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