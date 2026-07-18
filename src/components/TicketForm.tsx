import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { HelpCircle, Paperclip, Trash2 } from "lucide-react";

// Ticket Type Constants
export const TICKET_TYPE = {
  BOOKING: "booking",
  EQUIPMENT: "equipment",
  PAYMENT: "payment",
  ACCOUNT: "account",
  TECHNICAL: "technical",
  LABORATORY: "laboratory",
  GENERAL: "general",
  OTHER: "other",
  QUALITY_IMPROVEMENT: "quality_improvement",
} as const;

export const QUALITY_IMPROVEMENT_SUBJECT = "Quality improvement suggestions/Bugs";

const ticketFormSchema = z.object({
  public_name: z.string().min(2, "Name must be at least 2 characters").optional().or(z.literal("")),
  public_email: z.string().email("Invalid email address").optional().or(z.literal("")),
  public_phone: z.string().optional().or(z.literal("")),
  ticket_type: z.string().min(1, "Please select a ticket type"),
  priority: z.enum(["low", "medium", "high", "urgent"], {
    required_error: "Please select a priority",
  }),
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
});

type TicketFormValues = z.infer<typeof ticketFormSchema>;

interface TicketFormProps {
  onSuccess?: () => void;
  trigger?: React.ReactNode;
  initialValues?: {
    ticket_type?: string;
    subject?: string;
    description?: string;
    related_equipment_id?: number;
    related_booking_id?: number;
  };
  hideTicketType?: boolean; // Hide ticket type field when auto-set
  /** When provided, dialog open state is controlled by parent */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// Ticket type options for display
const TICKET_TYPE_OPTIONS = [
  { code: TICKET_TYPE.BOOKING, name: "Booking Issues" },
  { code: TICKET_TYPE.EQUIPMENT, name: "Equipment Support" },
  { code: TICKET_TYPE.PAYMENT, name: "Payment Issues" },
  { code: TICKET_TYPE.ACCOUNT, name: "Account Support" },
  { code: TICKET_TYPE.TECHNICAL, name: "Technical Problems" },
  { code: TICKET_TYPE.LABORATORY, name: "Laboratory Requests" },
  { code: TICKET_TYPE.GENERAL, name: "General Enquiries" },
  { code: TICKET_TYPE.OTHER, name: "Other" },
  { code: TICKET_TYPE.QUALITY_IMPROVEMENT, name: "Quality improvement suggestions/Bugs" },
] as const;

const TICKET_PRIORITY_OPTIONS = [
  { code: "low", name: "Low" },
  { code: "medium", name: "Medium" },
  { code: "high", name: "High" },
  { code: "urgent", name: "Urgent" },
] as const;

const TicketForm = ({ onSuccess, trigger, initialValues, hideTicketType = false, open: controlledOpen, onOpenChange }: TicketFormProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  // Determine default ticket type based on initialValues
  const getDefaultTicketType = (): string => {
    if (initialValues?.ticket_type) {
      return initialValues.ticket_type;
    }
    if (initialValues?.related_booking_id) {
      return TICKET_TYPE.BOOKING;
    }
    if (initialValues?.related_equipment_id) {
      return TICKET_TYPE.EQUIPMENT;
    }
    return TICKET_TYPE.OTHER;
  };

  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketFormSchema),
    defaultValues: {
      ticket_type: getDefaultTicketType() as any,
      priority: "medium",
      public_name: "",
      public_email: "",
      public_phone: "",
      subject: initialValues?.subject || "",
      description: initialValues?.description || "",
    },
  });

  // Set initial values when they change or dialog opens
  useEffect(() => {
    if (open && initialValues) {
      if (initialValues.subject) {
        form.setValue("subject", initialValues.subject);
      }
      if (initialValues.description) {
        form.setValue("description", initialValues.description);
      }
      if (initialValues.ticket_type) {
        form.setValue("ticket_type", initialValues.ticket_type as any);
      } else {
        // Auto-select based on related items
        if (initialValues.related_booking_id) {
          form.setValue("ticket_type", TICKET_TYPE.BOOKING as any);
        } else if (initialValues.related_equipment_id) {
          form.setValue("ticket_type", TICKET_TYPE.EQUIPMENT as any);
        } else {
          form.setValue("ticket_type", TICKET_TYPE.OTHER as any);
        }
      }
    }
  }, [open, initialValues, form]);

  const onSubmit = async (data: TicketFormValues) => {
    console.log("Form submitted with data:", data);
    setIsSubmitting(true);
    try {
      // Validate ticket type is selected
      if (!data.ticket_type) {
        toast({
          title: "Error",
          description: "Please select a ticket type",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const ticketData: any = {
        ticket_type: data.ticket_type,
        priority: data.priority || "medium",
        subject: data.subject,
        description: data.description,
      };

      // Add related equipment if provided
      if (initialValues?.related_equipment_id) {
        ticketData.related_equipment = initialValues.related_equipment_id;
      }

      // Add related booking if provided
      if (initialValues?.related_booking_id) {
        ticketData.related_booking = initialValues.related_booking_id;
      }

      // If user is not authenticated, include public user info
      if (!isAuthenticated) {
        if (!data.public_email || data.public_email.trim() === "") {
          toast({
            title: "Error",
            description: "Email is required for public users.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
        ticketData.public_name = data.public_name || "";
        ticketData.public_email = data.public_email;
        ticketData.public_phone = data.public_phone || "";
      }

      // Attachment validations (client-side)
      if (attachment) {
        const maxBytes = 10 * 1024 * 1024; // 10MB
        if (attachment.size > maxBytes) {
          toast({
            title: "Error",
            description: "Attachment must be 10MB or smaller.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
      }

      console.log("Sending ticket data:", ticketData);
      const response = await apiClient.createTicket(ticketData, attachment);
      console.log("API response:", response);

      if (response.error) {
        toast({
          title: "Error",
          description: response.error || "Failed to create ticket",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: `Ticket #${response.data?.ticket_id} created successfully! We'll get back to you soon.`,
        });
        form.reset();
        setAttachment(null);
        setOpen(false);
        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create ticket",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset form when dialog closes
      form.reset({
        ticket_type: initialValues?.ticket_type || getDefaultTicketType() as any,
        priority: "medium",
        public_name: "",
        public_email: "",
        public_phone: "",
        subject: initialValues?.subject || "",
        description: initialValues?.description || "",
      });
      setAttachment(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="outline" className="gap-2">
              <HelpCircle className="h-4 w-4" />
              Create Support Ticket
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Support Ticket</DialogTitle>
          <DialogDescription>
            Have a question, request, or issue? Create a ticket and we'll help you out.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form 
            onSubmit={form.handleSubmit(onSubmit, (errors) => {
              console.log("Form validation errors:", errors);
              toast({
                title: "Validation Error",
                description: "Please check the form and fix any errors",
                variant: "destructive",
              });
            })} 
            className="space-y-4"
          >
            {!isAuthenticated && (
              <>
                <FormField
                  control={form.control}
                  name="public_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Your name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="public_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="your.email@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="public_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="+91 1234567890" {...field} />
                      </FormControl>
                      <FormDescription>Optional, but helpful for urgent issues</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
            {hideTicketType ? (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Ticket type: </span>
                <span className="font-medium">
                  {TICKET_TYPE_OPTIONS.find((t) => t.code === form.watch("ticket_type"))?.name ||
                    "Equipment Support"}
                </span>
              </div>
            ) : (
              <FormField
                control={form.control}
                name="ticket_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ticket Type *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select ticket type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TICKET_TYPE_OPTIONS.map((type) => (
                          <SelectItem key={type.code} value={type.code}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TICKET_PRIORITY_OPTIONS.map((p) => (
                        <SelectItem key={p.code} value={p.code}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject *</FormLabel>
                  <FormControl>
                    <Input placeholder="Brief description of your issue" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Please provide detailed information about your query, request, or issue..."
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel>Attachment (optional)</FormLabel>
              <FormControl>
                <div className="flex flex-col gap-2">
                  <Input
                    type="file"
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setAttachment(file);
                    }}
                  />
                  {attachment && (
                    <div className="flex items-center justify-between rounded-md border p-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{attachment.name}</span>
                        <span className="shrink-0 text-muted-foreground">
                          ({Math.ceil(attachment.size / 1024)} KB)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setAttachment(null)}
                        aria-label="Remove attachment"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </FormControl>
              <FormDescription>
                Upload a screenshot or document (max 10MB).
              </FormDescription>
            </FormItem>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating..." : "Create Ticket"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export { TicketForm };
export default TicketForm;
