import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Calendar, AlertCircle } from "lucide-react";

interface Notice {
  id: number;
  title: string;
  description: string;
  date: string;
  type: "info" | "warning" | "urgent";
}

const notices: Notice[] = [
  {
    id: 1,
    title: "Equipment Maintenance Scheduled",
    description: "XRD will be under maintenance from Dec 25-26, 2024",
    date: "2024-12-20",
    type: "warning",
  },
  {
    id: 2,
    title: "New Equipment Available",
    description: "MALDI-TOF/TOF MS is now available for booking",
    date: "2024-12-18",
    type: "info",
  },
  {
    id: 3,
    title: "Urgent: TEM Downtime",
    description: "TEM is temporarily unavailable due to technical issues",
    date: "2024-12-17",
    type: "urgent",
  },
  {
    id: 4,
    title: "Holiday Schedule",
    description: "Limited operations during Dec 24-26. Plan bookings accordingly",
    date: "2024-12-15",
    type: "info",
  },
  {
    id: 5,
    title: "Training Session",
    description: "FE-SEM training session scheduled for internal users on Dec 28",
    date: "2024-12-14",
    type: "info",
  },
];

const NoticeBoard = () => {
  const getTypeColor = (type: Notice["type"]) => {
    switch (type) {
      case "urgent":
        return "destructive";
      case "warning":
        return "default";
      case "info":
        return "secondary";
    }
  };

  const getTypeIcon = (type: Notice["type"]) => {
    switch (type) {
      case "urgent":
        return <AlertCircle className="h-4 w-4" />;
      case "warning":
        return <Bell className="h-4 w-4" />;
      case "info":
        return <Bell className="h-4 w-4" />;
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Notice Board
        </CardTitle>
        <CardDescription>Latest updates and announcements</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {notices.map((notice) => (
              <div
                key={notice.id}
                className="p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {getTypeIcon(notice.type)}
                    <h4 className="font-semibold text-sm">{notice.title}</h4>
                  </div>
                  <Badge variant={getTypeColor(notice.type)} className="shrink-0 text-xs">
                    {notice.type}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{notice.description}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>{new Date(notice.date).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default NoticeBoard;
