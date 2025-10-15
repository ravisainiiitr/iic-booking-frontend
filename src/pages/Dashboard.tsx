import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, CreditCard, FileText, LogOut, Package, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [profileData, setProfileData] = useState<{ 
    full_name?: string; 
    avatar_url?: string;
    phone?: string;
    department?: string;
    supervisor_name?: string;
  } | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session) {
          navigate("/auth");
        } else {
          fetchWalletBalance(session.user.id);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (!session) {
        navigate("/auth");
      } else {
        fetchWalletBalance(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchWalletBalance = async (userId: string) => {
    const { data, error } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .single();

    if (!error && data) {
      setWalletBalance(Number(data.balance));
    }

    // Fetch profile data
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, avatar_url, phone, department, supervisor_name")
      .eq("id", userId)
      .single();

    if (profile) {
      setProfileData(profile);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
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
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">LabBooking Pro</h1>
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="text-muted-foreground">Balance:</span>{" "}
              <span className="font-semibold">${walletBalance.toFixed(2)}</span>
            </div>
            <Avatar className="h-8 w-8">
              <AvatarImage src={profileData?.avatar_url} alt={profileData?.full_name || user?.email || "User"} />
              <AvatarFallback>{(profileData?.full_name || user?.email || "U")[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profileData?.avatar_url} alt={profileData?.full_name || user?.email || "User"} />
              <AvatarFallback className="text-2xl">{(profileData?.full_name || user?.email || "U")[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-3xl font-bold mb-2">
                Welcome, {profileData?.full_name || user?.email}!
              </h2>
              <p className="text-muted-foreground">
                Manage your equipment bookings and account
              </p>
            </div>
          </div>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{profileData?.full_name ? user?.email : "Not set"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{profileData?.phone || "Not set"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Department</p>
                  <p className="font-medium">{profileData?.department || "Not set"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Supervisor</p>
                  <p className="font-medium">{profileData?.supervisor_name || "Not set"}</p>
                </div>
              </div>
              <Button 
                className="mt-4"
                variant="outline"
                onClick={() => navigate("/profile")}
              >
                <UserIcon className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate("/book-equipment")}
          >
            <CardHeader>
              <Package className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Book Equipment</CardTitle>
              <CardDescription>
                Browse and book available laboratory equipment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Browse Equipment</Button>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate("/my-bookings")}
          >
            <CardHeader>
              <Calendar className="h-10 w-10 text-primary mb-2" />
              <CardTitle>View Bookings</CardTitle>
              <CardDescription>
                Check your current and past bookings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="secondary">View Bookings</Button>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate("/wallet")}
          >
            <CardHeader>
              <CreditCard className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Wallet</CardTitle>
              <CardDescription>
                Recharge your wallet and view transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="secondary">Manage Wallet</Button>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate("/reports")}
          >
            <CardHeader>
              <FileText className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Reports</CardTitle>
              <CardDescription>
                View your booking history and statistics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="secondary">View Reports</Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;