import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bell, Calendar, AlertCircle, Loader2, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

interface Notice {
  notice_id?: number;
  id?: number;
  title: string;
  description: string;
  content?: string;
  created_at: string;
  updated_at?: string;
  notice_type?: string;
  type?: "info" | "warning" | "urgent";
  is_active?: boolean;
  priority?: number;
}

const NoticeBoard = () => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchNotices();
  }, []);

  const fetchNotices = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getPublicNotices();
      
      if (response.error) {
        console.error("Error fetching notices:", response.error);
        // Fallback to empty array if API fails
        setNotices([]);
        return;
      }

      if (response.data?.notices && Array.isArray(response.data.notices)) {
        // Transform API response to match component interface
        const transformedNotices: Notice[] = response.data.notices
          .filter((notice: Notice) => notice.is_active !== false) // Only show active notices
          .map((notice: Notice) => ({
            notice_id: notice.notice_id || notice.id || 0,
            id: notice.notice_id || notice.id || 0,
            title: notice.title,
            description: notice.description || "",
            content: notice.content || notice.description || "",
            created_at: notice.created_at,
            updated_at: notice.updated_at,
            notice_type: (notice.notice_type || notice.type || "info") as string,
            type: (notice.notice_type || notice.type || "info") as "info" | "warning" | "urgent",
            is_active: notice.is_active,
            priority: notice.priority,
          }))
          .sort((a, b) => {
            // Sort by priority/type: urgent > warning > info, then by date
            const typeOrder = { urgent: 3, warning: 2, info: 1 };
            const aOrder = typeOrder[a.type as keyof typeof typeOrder] || 0;
            const bOrder = typeOrder[b.type as keyof typeof typeOrder] || 0;
            if (aOrder !== bOrder) return bOrder - aOrder;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
        
        setNotices(transformedNotices);
      } else {
        setNotices([]);
      }
    } catch (error) {
      console.error("Error fetching notices:", error);
      setNotices([]);
    } finally {
      setLoading(false);
    }
  };
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
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Notice Board
        </CardTitle>
        <CardDescription>Latest updates and announcements</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0">
        <ScrollArea className="flex-1 pr-4">
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="p-4 rounded-lg border bg-card">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-full mb-2" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : notices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No notices available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {notices.map((notice) => (
                <div
                  key={notice.id}
                  className="p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {getTypeIcon(notice.type)}
                      <h4 className="font-semibold text-sm line-clamp-2">{notice.title}</h4>
                    </div>
                    <Badge variant={getTypeColor(notice.type)} className="shrink-0 text-xs">
                      {notice.type}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{notice.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(notice.created_at).toLocaleDateString()}</span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedNotice(notice);
                        setDialogOpen(true);
                      }}
                      className="text-xs text-primary hover:underline flex items-center gap-1 transition-colors"
                    >
                      <Info className="h-3 w-3" />
                      Show more info
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>

      {/* Notice Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedNotice && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <DialogTitle className="text-2xl flex items-center gap-2">
                      {getTypeIcon(selectedNotice.type)}
                      {selectedNotice.title}
                    </DialogTitle>
                    <DialogDescription className="mt-2">
                      <Badge variant={getTypeColor(selectedNotice.type)} className="mr-2">
                        {selectedNotice.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(selectedNotice.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                {/* Description */}
                {selectedNotice.description && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      Description
                    </h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedNotice.description}
                    </p>
                  </div>
                )}

                {/* Content (if different from description) */}
                {selectedNotice.content && selectedNotice.content !== selectedNotice.description && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      Details
                    </h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedNotice.content}
                    </p>
                  </div>
                )}

                {/* Updated date if different from created date */}
                {selectedNotice.updated_at && 
                 selectedNotice.updated_at !== selectedNotice.created_at && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      Last updated: {new Date(selectedNotice.updated_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default NoticeBoard;
