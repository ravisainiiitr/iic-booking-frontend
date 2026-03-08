import { useEffect, useState } from "react";
import { apiClient, BookingEvent } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { MessageSquare, Clock, User, CheckCircle, XCircle, Calendar, RefreshCw, DollarSign, CopyPlus, BadgeCheck } from "lucide-react";
import { format } from "date-fns";

interface BookingEventHistoryProps {
  bookingId: number;
  onEventAdded?: () => void;
}

const BookingEventHistory = ({ bookingId, onEventAdded }: BookingEventHistoryProps) => {
  const [events, setEvents] = useState<BookingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [sendNotification, setSendNotification] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, [bookingId]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getBookingEvents(bookingId);
      if (response.data) {
        setEvents(response.data.events || []);
      }
    } catch (error: any) {
      console.error("Error fetching booking events:", error);
      toast.error("Failed to load booking history");
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!comment.trim()) {
      toast.error("Please enter a comment");
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiClient.createBookingEventComment(
        bookingId,
        comment,
        sendNotification
      );

      if (response.error) {
        toast.error(response.error || "Failed to add comment");
      } else {
        toast.success("Comment added successfully");
        setComment("");
        setCommentDialogOpen(false);
        await fetchEvents();
        if (onEventAdded) {
          onEventAdded();
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to add comment");
    } finally {
      setSubmitting(false);
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "CREATED":
        return <Calendar className="h-4 w-4" />;
      case "CONFIRMED":
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case "CANCELLED":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "RESCHEDULED":
        return <RefreshCw className="h-4 w-4 text-orange-500" />;
      case "COMPLETED":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "REFUNDED":
        return <DollarSign className="h-4 w-4 text-green-500" />;
      case "ABSENT":
        return <XCircle className="h-4 w-4 text-yellow-500" />;
      case "COMMENT":
        return <MessageSquare className="h-4 w-4" />;
      case "REPEAT_SAMPLE_OFFERED":
        return <BadgeCheck className="h-4 w-4 text-blue-500" />;
      case "REPEAT_SAMPLE_CREATED":
        return <CopyPlus className="h-4 w-4 text-green-500" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case "CREATED":
        return "bg-blue-100 text-blue-800";
      case "CONFIRMED":
        return "bg-green-100 text-green-800";
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      case "RESCHEDULED":
        return "bg-orange-100 text-orange-800";
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "REFUNDED":
        return "bg-green-100 text-green-800";
      case "ABSENT":
        return "bg-yellow-100 text-yellow-800";
      case "COMMENT":
        return "bg-gray-100 text-gray-800";
      case "REPEAT_SAMPLE_OFFERED":
        return "bg-blue-100 text-blue-800";
      case "REPEAT_SAMPLE_CREATED":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading event history...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Booking Event History</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchEvents()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setCommentDialogOpen(true)}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Add Comment
          </Button>
        </div>
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No events yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <Card key={event.event_id} className="border-l-4 border-l-primary">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getEventIcon(event.event_type)}
                    <CardTitle className="text-base">
                      {event.event_type_display}
                    </CardTitle>
                    <Badge className={getEventColor(event.event_type)}>
                      {event.event_type_display}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(event.created_at), "MMM d, yyyy 'at' HH:mm:ss")}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {event.previous_status && event.new_status && (
                  <div className="mb-2 text-sm">
                    <span className="text-muted-foreground">Status changed: </span>
                    <Badge variant="outline" className="mr-1">
                      {event.previous_status_display || event.previous_status}
                    </Badge>
                    <span className="mx-1">→</span>
                    <Badge variant="outline">
                      {event.new_status_display || event.new_status}
                    </Badge>
                  </div>
                )}
                {event.comment && (
                  <p className="text-sm text-foreground mb-2">{event.comment}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {event.created_by_name && (
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>{event.created_by_name}</span>
                    </div>
                  )}
                  {event.notification_sent && (
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      <span>Notification sent</span>
                    </div>
                  )}
                </div>
                {event.metadata && Object.keys(event.metadata).length > 0 && (
                  <div className="mt-2 pt-2 border-t text-xs space-y-1">
                    {event.metadata.refund_amount != null && event.metadata.refund_amount !== undefined && (
                      <p className="text-muted-foreground">
                        Refund Amount: ₹{event.metadata.refund_amount}
                      </p>
                    )}
                    {event.metadata.uploaded_files_count != null && event.metadata.uploaded_files_count !== undefined && event.metadata.uploaded_files_count > 0 && (
                      <div className="text-muted-foreground">
                        <p className="font-medium text-foreground">
                          {event.metadata.uploaded_files_count} result file(s) sent to user email:
                        </p>
                        {Array.isArray(event.metadata.uploaded_files) && event.metadata.uploaded_files.length > 0 && (
                          <ul className="list-disc list-inside mt-1 ml-1">
                            {event.metadata.uploaded_files.map((name: string, i: number) => (
                              <li key={`${name}-${i}`}>{name}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Comment Dialog */}
      <Dialog open={commentDialogOpen} onOpenChange={setCommentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Comment to Booking</DialogTitle>
            <DialogDescription>
              Add a comment or note to this booking. This will be visible in the booking history.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="comment">Comment</Label>
              <Textarea
                id="comment"
                placeholder="Enter your comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="send-notification"
                checked={sendNotification}
                onCheckedChange={(checked) => setSendNotification(checked === true)}
              />
              <Label htmlFor="send-notification" className="text-sm font-normal cursor-pointer">
                Send notification to user
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCommentDialogOpen(false);
                setComment("");
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleAddComment} disabled={submitting || !comment.trim()}>
              {submitting ? "Adding..." : "Add Comment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BookingEventHistory;
