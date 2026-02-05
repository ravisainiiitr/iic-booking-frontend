import DashboardHeader from "@/components/DashboardHeader";
import TicketManagement from "@/components/TicketManagement";
import TicketForm from "@/components/TicketForm";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const Tickets = () => {
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Support Tickets</h1>
            <p className="text-muted-foreground mt-2">
              Manage your support tickets and track their status
            </p>
          </div>
          <TicketForm
            trigger={
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create New Ticket
              </Button>
            }
            onSuccess={() => {
              // Refresh will be handled by TicketManagement component
              window.location.reload();
            }}
          />
        </div>
        <TicketManagement />
      </div>
    </div>
  );
};

export default Tickets;
