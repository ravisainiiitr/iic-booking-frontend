import { useState } from "react";
import DashboardHeader from "@/components/DashboardHeader";
import TicketManagement from "@/components/TicketManagement";
import TicketForm from "@/components/TicketForm";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const Tickets = () => {
  const [listKey, setListKey] = useState(0);

  return (
    <div className="page-shell">
      <DashboardHeader />
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Support Tickets</h1>
            <p className="text-muted-foreground mt-2">
              View conversations, attachments, and status updates for your requests
            </p>
          </div>
          <TicketForm
            trigger={
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create New Ticket
              </Button>
            }
            onSuccess={() => setListKey((k) => k + 1)}
          />
        </div>
        <TicketManagement key={listKey} />
      </div>
    </div>
  );
};

export default Tickets;
