import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Users, Clock } from "lucide-react";

interface Stat {
  label: string;
  value: string;
  change: string;
  icon: React.ReactNode;
  trend: "up" | "down";
}

const stats: Stat[] = [
  {
    label: "Total Bookings",
    value: "248",
    change: "+12%",
    icon: <BarChart3 className="h-4 w-4" />,
    trend: "up",
  },
  {
    label: "Active Users",
    value: "89",
    change: "+8%",
    icon: <Users className="h-4 w-4" />,
    trend: "up",
  },
  {
    label: "Equipment Usage",
    value: "76%",
    change: "+5%",
    icon: <TrendingUp className="h-4 w-4" />,
    trend: "up",
  },
  {
    label: "Avg. Session",
    value: "2.4h",
    change: "-3%",
    icon: <Clock className="h-4 w-4" />,
    trend: "down",
  },
];

const Analytics = () => {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Analytics Overview
        </CardTitle>
        <CardDescription>This month's statistics</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="p-4 rounded-lg border bg-gradient-to-br from-card to-accent/5 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-md bg-primary/10 text-primary">
                  {stat.icon}
                </div>
                <span
                  className={`text-xs font-medium ${
                    stat.trend === "up" ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {stat.change}
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default Analytics;
