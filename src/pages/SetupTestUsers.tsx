import { useState } from "react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BackToDashboardButton } from "@/components/BackToDashboardButton";
import { useAuth } from "@/contexts/AuthContext";

type UserRole = 'admin' | 'iitr_student' | 'iitr_faculty' | 'officer_in_charge' | 'operator' | 'accounts' | 'external_academic' | 'external_rnd' | 'industrial_user';

interface TestUser {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
}

const testUsers: TestUser[] = [
  { email: 'admin@iitr.ac.in', password: 'admin@2025', full_name: 'System Administrator', role: 'admin' },
  { email: 'student@iitr.ac.in', password: 'student123', full_name: 'IITR Student', role: 'iitr_student' },
  { email: 'faculty@iitr.ac.in', password: 'faculty123', full_name: 'IITR Faculty', role: 'iitr_faculty' },
  { email: 'officer@iitr.ac.in', password: 'officer123', full_name: 'Officer in Charge', role: 'officer_in_charge' },
  { email: 'operator@iitr.ac.in', password: 'operator123', full_name: 'Lab Operator', role: 'operator' },
  { email: 'accounts@iitr.ac.in', password: 'accounts123', full_name: 'Accounts Department', role: 'accounts' },
  { email: 'academic@external.com', password: 'academic123', full_name: 'External Academic', role: 'external_academic' },
  { email: 'rnd@external.com', password: 'rnd123', full_name: 'External R&D', role: 'external_rnd' },
  { email: 'industrial@company.com', password: 'industrial123', full_name: 'Industrial User', role: 'industrial_user' },
];

export default function SetupTestUsers() {
  const { isAuthenticated } = useAuth();
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<string[]>([]);

  const createAllUsers = async () => {
    setCreating(true);
    const createdEmails: string[] = [];

    for (const user of testUsers) {
      try {
        const response = await apiClient.createUser({
          email: user.email,
          password: user.password,
          full_name: user.full_name,
          role: user.role
        });

        if (response.error) {
          if (response.error.includes('already') || response.error.includes('exists')) {
            console.log(`User ${user.email} already exists`);
            createdEmails.push(user.email);
          } else {
            throw new Error(response.error);
          }
        } else {
          createdEmails.push(user.email);
        }
      } catch (error: any) {
        console.error(`Failed to create ${user.email}:`, error);
        toast.error(`Failed to create ${user.email}: ${error.message}`);
      }
    }

    setCreated(createdEmails);
    setCreating(false);
    
    if (createdEmails.length === testUsers.length) {
      toast.success('All test users created successfully!');
    } else {
      toast.info(`Created ${createdEmails.length} out of ${testUsers.length} users`);
    }
  };

  return (
    <div className="page-shell flex flex-col min-h-screen">
      {isAuthenticated ? (
        <div className="border-b bg-card/80 px-4 py-3 flex justify-end">
          <BackToDashboardButton />
        </div>
      ) : null}
      <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Setup Test Users</CardTitle>
          <CardDescription>
            Create all test user accounts for the lab booking system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <h3 className="font-semibold mb-4">Test Users to Create:</h3>
            {testUsers.map((user) => (
              <div key={user.email} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">{user.email}</p>
                  <p className="text-sm text-muted-foreground">{user.full_name} - {user.role}</p>
                </div>
                {created.includes(user.email) && (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                )}
              </div>
            ))}
          </div>

          <Button 
            onClick={createAllUsers} 
            disabled={creating}
            className="w-full"
          >
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Users...
              </>
            ) : (
              'Create All Test Users'
            )}
          </Button>

          {created.length > 0 && (
            <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
              <h4 className="font-semibold mb-2">✅ Users Created</h4>
              <p className="text-sm">
                {created.length} user(s) created successfully. You can now login with these credentials at /auth
              </p>
            </div>
          )}

          <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <h4 className="font-semibold mb-2">📝 Note</h4>
            <p className="text-sm">
              All test users have simple passwords (e.g., student123, faculty123). 
              The admin account is: admin@iitr.ac.in / admin@2025
            </p>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}