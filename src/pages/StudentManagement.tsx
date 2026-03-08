import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import DashboardHeader from "@/components/DashboardHeader";
import { ArrowLeft, Users, Loader2, Wallet } from "lucide-react";
import { format } from "date-fns";

type WalletStudentRow = {
  id: number;
  student: number;
  student_name: string;
  student_email: string;
  student_phone?: string | null;
  student_profile_picture?: string | null;
  status: string;
  status_display: string;
  created_at: string;
  updated_at: string;
  responded_at: string | null;
};

const StudentManagement = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [students, setStudents] = useState<WalletStudentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isFaculty = userTypeStr === "faculty";

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!isFaculty) {
      navigate("/dashboard");
      return;
    }
    fetchStudents();
  }, [navigate, isAuthenticated, user, authLoading, isFaculty]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await apiClient.getWalletJoinRequests();
      if (res.data?.requests) {
        const approved = res.data.requests.filter(
          (r: { status: string }) => r.status === "APPROVED"
        ) as WalletStudentRow[];
        setStudents(approved);
      } else {
        setStudents([]);
      }
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || (!user && isAuthenticated)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>

          <Card className="overflow-hidden border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-teal-500/10 to-cyan-500/10 dark:from-teal-500/20 dark:to-cyan-500/20">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Student Management</CardTitle>
                    <CardDescription className="mt-0.5">
                      Students for whom you are the supervisor
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="gap-2 border-teal-200 dark:border-teal-800"
                  onClick={() => navigate("/wallet")}
                >
                  <Wallet className="h-4 w-4" />
                  Manage in Wallet
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : students.length === 0 ? (
                <div className="py-16 text-center">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground font-medium">No students in your wallet yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Students who request to join your wallet will appear here after you approve them.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => navigate("/wallet")}
                  >
                    Go to Wallet
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[56px]"> </TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="hidden sm:table-cell">Phone</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Approved at</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="w-[56px]">
                            <Avatar className="h-9 w-9 rounded-lg">
                              <AvatarImage
                                src={row.student_profile_picture ? apiClient.getProfilePictureUrl(row.student) : undefined}
                                alt={row.student_name}
                                className="object-cover"
                              />
                              <AvatarFallback className="rounded-lg bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 text-sm">
                                {(row.student_name || row.student_email || "?").charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium">{row.student_name || "—"}</p>
                          </TableCell>
                          <TableCell>
                            <p className="text-muted-foreground text-sm">{row.student_email || "—"}</p>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                            {row.student_phone || "—"}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground text-sm whitespace-nowrap">
                            {row.responded_at
                              ? format(new Date(row.responded_at), "dd MMM yyyy, HH:mm")
                              : row.updated_at
                                ? format(new Date(row.updated_at), "dd MMM yyyy")
                                : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default StudentManagement;
