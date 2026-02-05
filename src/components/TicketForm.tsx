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

const ticketFormSchema = z.object({
  public_name: z.string().min(2, "Name must be at least 2 characters").optional().or(z.literal("")),
  public_email: z.string().email("Invalid email address").optional().or(z.literal("")),
  public_phone: z.string().optional().or(z.literal("")),
  ticket_type: z.number({ required_error: "Please select a ticket type" }).min(1, "Please select a ticket type"),
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
});

type TicketFormValues = z.infer<typeof ticketFormSchema>;

interface TicketFormProps {
  onSuccess?: () => void;
  trigger?: React.ReactNode;
  initialValues?: {
    ticket_type_id?: number;
    subject?: string;
    description?: string;
    related_equipment_id?: number;
  };
}

interface TicketType {
  ticket_type_id: number;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
}

const TicketForm = ({ onSuccess, trigger, initialValues }: TicketFormProps) => {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketFormSchema),
    defaultValues: {
      ticket_type: initialValues?.ticket_type_id || undefined as any,
      public_name: "",
      public_email: "",
      public_phone: "",
      subject: initialValues?.subject || "",
      description: initialValues?.description || "",
    },
  });

  useEffect(() => {
    if (open) {
      loadTicketTypes();
    }
  }, [open]);
  
  // Set initial values when they change or dialog opens
  useEffect(() => {
    if (open && initialValues) {
      if (initialValues.subject) {
        form.setValue("subject", initialValues.subject);
      }
      if (initialValues.description) {
        form.setValue("description", initialValues.description);
      }
    }
  }, [open, initialValues, form]);

  const loadTicketTypes = async () => {
    setLoadingTypes(true);
    try {
      const response = await apiClient.getTicketTypes();
      if (response.error) {
        toast({
          title: "Error",
          description: response.error || "Failed to load ticket types",
          variant: "destructive",
        });
      } else {
        const types = response.data?.ticket_types || [];
        setTicketTypes(types);
        
        if (types.length > 0) {
          // If initialValues has related_equipment_id, prefer equipment-related ticket types
          let selectedType;
          if (initialValues?.related_equipment_id) {
            // Try to find equipment-related ticket types first
            selectedType = types.find(t => 
              t.code === "equipment_issue" || 
              t.code === "equipment_request" ||
              t.code === "equipment_interest" ||
              t.name.toLowerCase().includes("equipment")
            );
            // Fallback to "request" if no equipment type found
            if (!selectedType) {
              selectedType = types.find(t => t.code === "request");
            }
          } else {
            // For general tickets, try "request" type first
            selectedType = types.find(t => t.code === "request" || t.code === "show_interest");
          }
          
          // Final fallback to first available type
          if (!selectedType) {
            selectedType = types[0];
          }
          
          if (selectedType) {
            form.setValue("ticket_type", selectedType.ticket_type_id, { shouldValidate: true });
          }
        } else {
          toast({
            title: "Warning",
            description: "No ticket types available. Please contact support.",
            variant: "destructive",
          });
        }
        
      }
    } catch (error: any) {
      console.error("Error loading ticket types:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load ticket types",
        variant: "destructive",
      });
    } finally {
      setLoadingTypes(false);
    }
  };

  const onSubmit = async (data: TicketFormValues) => {
    console.log("Form submitted with data:", data);
    setIsSubmitting(true);
    try {
      // Validate ticket type is selected
      if (!data.ticket_type || data.ticket_type < 1) {
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
        ticket_type: initialValues?.ticket_type_id || undefined as any,
        public_name: "",
        public_email: "",
        public_phone: "",
        subject: initialValues?.subject || "",
        description: initialValues?.description || "",
      });
      setTicketTypes([]);
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
            <FormField
              control={form.control}
              name="ticket_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ticket Type *</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      const numValue = parseInt(value);
                      field.onChange(numValue);
                    }}
                    value={field.value && field.value > 0 ? field.value.toString() : undefined}
                    disabled={loadingTypes || ticketTypes.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={loadingTypes ? "Loading..." : ticketTypes.length === 0 ? "No ticket types available" : "Select ticket type"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ticketTypes.map((type) => (
                        <SelectItem key={type.ticket_type_id} value={type.ticket_type_id.toString()}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                  {ticketTypes.length === 0 && !loadingTypes && (
                    <p className="text-sm text-destructive">No ticket types available. Please contact support.</p>
                  )}
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
                disabled={isSubmitting || loadingTypes || ticketTypes.length === 0}
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
