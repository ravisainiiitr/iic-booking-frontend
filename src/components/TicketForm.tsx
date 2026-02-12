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
import { HelpCircle } from "lucide-react";

// Ticket Type Constants
export const TICKET_TYPE = {
  BOOKING: "booking",
  EQUIPMENT: "equipment",
  OTHER: "other",
} as const;

const ticketFormSchema = z.object({
  public_name: z.string().min(2, "Name must be at least 2 characters").optional().or(z.literal("")),
  public_email: z.string().email("Invalid email address").optional().or(z.literal("")),
  public_phone: z.string().optional().or(z.literal("")),
  ticket_type: z.enum([TICKET_TYPE.BOOKING, TICKET_TYPE.EQUIPMENT, TICKET_TYPE.OTHER], {
    required_error: "Please select a ticket type",
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
}

// Ticket type options for display
const TICKET_TYPE_OPTIONS = [
  { code: TICKET_TYPE.BOOKING, name: "Booking" },
  { code: TICKET_TYPE.EQUIPMENT, name: "Equipment" },
  { code: TICKET_TYPE.OTHER, name: "Other" },
] as const;

const TicketForm = ({ onSuccess, trigger, initialValues, hideTicketType = false }: TicketFormProps) => {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

      console.log("Sending ticket data:", ticketData);
      const response = await apiClient.createTicket(ticketData);
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
        public_name: "",
        public_email: "",
        public_phone: "",
        subject: initialValues?.subject || "",
        description: initialValues?.description || "",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <HelpCircle className="h-4 w-4" />
            Create Support Ticket
          </Button>
        )}
      </DialogTrigger>
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
            {!hideTicketType && (
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

export default TicketForm;
