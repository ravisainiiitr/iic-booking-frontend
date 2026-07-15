import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, Home, PackagePlus } from "lucide-react";

type Dept = { id: number; name: string; code: string };

const EMPTY_FORM = {
  name: "",
  code: "",
  description: "",
  make: "",
  model_information: "",
  year_of_installation: "",
  location: "",
  specifications: "",
  sample_requirements: "",
  slots_per_day: "",
  slot_duration_minutes: "",
  slot_start_time: "",
  slot_end_time: "",
  charge_calculation_basis: "",
  time_calculation_basis: "",
  charge_iitr_student: "",
  charge_iitr_faculty: "",
  charge_external_educational_student: "",
  charge_external_govt_rnd: "",
  charge_industry: "",
  charge_startup_incubated_iitr: "",
  charge_external_startup_msme: "",
  internal_department: "" as string,
  proposed_oic_name: "",
  proposed_oic_email: "",
  proposed_operator_name: "",
  proposed_operator_email: "",
  submitter_name: "",
  submitter_email: "",
  submitter_phone: "",
  notes: "",
  website: "",
};

const CHARGE_FIELDS: Array<{ key: keyof typeof EMPTY_FORM; label: string }> = [
  { key: "charge_iitr_student", label: "a. IIT Roorkee Students" },
  { key: "charge_iitr_faculty", label: "b. IIT Roorkee Faculty" },
  { key: "charge_external_educational_student", label: "c. External Educational Student" },
  { key: "charge_external_govt_rnd", label: "d. External Government R&D Organization" },
  { key: "charge_industry", label: "e. Industry" },
  { key: "charge_startup_incubated_iitr", label: "f. Startup Incubated at IIT Roorkee" },
  { key: "charge_external_startup_msme", label: "g. External Startup/MSME" },
];

const ProposeEquipment = () => {
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [equipmentImage, setEquipmentImage] = useState<File | null>(null);
  const [supportingDocument, setSupportingDocument] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    apiClient.getEquipmentAdditionFormChoices().then((res) => {
      if (res.data?.internal_departments) {
        setDepartments(res.data.internal_departments);
      }
    });
  }, []);

  const setField = (key: keyof typeof EMPTY_FORM, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      toast.error("Name and code are required.");
      return;
    }
    if (!form.submitter_name.trim() || !form.submitter_email.trim()) {
      toast.error("Your name and email are required.");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      const textKeys: Array<keyof typeof EMPTY_FORM> = [
        "name",
        "code",
        "description",
        "make",
        "model_information",
        "year_of_installation",
        "location",
        "specifications",
        "sample_requirements",
        "slots_per_day",
        "slot_duration_minutes",
        "slot_start_time",
        "slot_end_time",
        "charge_calculation_basis",
        "time_calculation_basis",
        "charge_iitr_student",
        "charge_iitr_faculty",
        "charge_external_educational_student",
        "charge_external_govt_rnd",
        "charge_industry",
        "charge_startup_incubated_iitr",
        "charge_external_startup_msme",
        "proposed_oic_name",
        "proposed_oic_email",
        "proposed_operator_name",
        "proposed_operator_email",
        "submitter_name",
        "submitter_email",
        "submitter_phone",
        "notes",
        "website",
      ];
      for (const key of textKeys) {
        fd.append(key, String(form[key] ?? "").trim());
      }
      if (form.internal_department) {
        fd.append("internal_department", form.internal_department);
      }
      if (equipmentImage) fd.append("equipment_image", equipmentImage);
      if (supportingDocument) fd.append("supporting_document", supportingDocument);

      const res = await apiClient.submitEquipmentAdditionRequest(fd);
      if (res.error) {
        const firstField =
          res.fieldErrors &&
          Object.values(res.fieldErrors)
            .flat()
            .find(Boolean);
        toast.error(
          typeof firstField === "string"
            ? firstField
            : Array.isArray(firstField)
              ? String(firstField[0])
              : res.error
        );
        return;
      }
      setSubmitted(true);
      setEquipmentImage(null);
      setSupportingDocument(null);
      toast.success(res.data?.message || "Request submitted.");
    } catch {
      toast.error("Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetAll = () => {
    setSubmitted(false);
    setForm(EMPTY_FORM);
    setEquipmentImage(null);
    setSupportingDocument(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800">
            <PackagePlus className="h-6 w-6 text-indigo-600" />
            <span className="font-semibold tracking-tight">Propose new equipment</span>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <Home className="h-4 w-4 mr-1" />
              Home
            </Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {submitted ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="h-6 w-6" />
                Request submitted
              </CardTitle>
              <CardDescription>
                An administrator will review your proposal. After approval, slots and charges are
                configured before booking opens.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={resetAll}>Submit another</Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Request to add equipment</CardTitle>
              <CardDescription>
                Provide equipment details for admin review. Internal department list shows IIT Roorkee
                Departments/Centres only.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="relative space-y-8">
                <div className="absolute -left-[9999px] opacity-0 h-0 overflow-hidden" aria-hidden="true">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.website}
                    onChange={(e) => setField("website", e.target.value)}
                  />
                </div>

                <section className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Identity
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="eq-name">Equipment name *</Label>
                      <Input
                        id="eq-name"
                        value={form.name}
                        onChange={(e) => setField("name", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="eq-code">Proposed code *</Label>
                      <Input
                        id="eq-code"
                        value={form.code}
                        onChange={(e) => setField("code", e.target.value)}
                        placeholder="e.g. SEM-01"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Internal department (IIT Roorkee Dept/Centre)</Label>
                      <Select
                        value={form.internal_department || "__none__"}
                        onValueChange={(v) =>
                          setField("internal_department", v === "__none__" ? "" : v)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Not specified</SelectItem>
                          {departments.map((d) => (
                            <SelectItem key={d.id} value={String(d.id)}>
                              {d.name} ({d.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="eq-location">Location</Label>
                      <Input
                        id="eq-location"
                        value={form.location}
                        onChange={(e) => setField("location", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="eq-desc">Description</Label>
                      <Textarea
                        id="eq-desc"
                        value={form.description}
                        onChange={(e) => setField("description", e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-4 border-t pt-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    General information
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="eq-make">Make</Label>
                      <Input
                        id="eq-make"
                        value={form.make}
                        onChange={(e) => setField("make", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="eq-model">Model</Label>
                      <Input
                        id="eq-model"
                        value={form.model_information}
                        onChange={(e) => setField("model_information", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="eq-year">Year of installation</Label>
                      <Input
                        id="eq-year"
                        value={form.year_of_installation}
                        onChange={(e) => setField("year_of_installation", e.target.value)}
                        placeholder="e.g. 2022"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="eq-image">Equipment image</Label>
                    <Input
                      id="eq-image"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setEquipmentImage(e.target.files?.[0] ?? null)}
                    />
                    {equipmentImage && (
                      <p className="text-xs text-muted-foreground">{equipmentImage.name}</p>
                    )}
                  </div>
                </section>

                <section className="space-y-4 border-t pt-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Specifications
                  </h3>
                  <Textarea
                    value={form.specifications}
                    onChange={(e) => setField("specifications", e.target.value)}
                    rows={4}
                    placeholder="Key specifications…"
                  />
                </section>

                <section className="space-y-4 border-t pt-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Sample requirements and preparation
                  </h3>
                  <Textarea
                    value={form.sample_requirements}
                    onChange={(e) => setField("sample_requirements", e.target.value)}
                    rows={4}
                    placeholder="Sample type, size, preparation steps…"
                  />
                </section>

                <section className="space-y-4 border-t pt-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Slot requirements
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="slots-day">Number of slots per day</Label>
                      <Input
                        id="slots-day"
                        type="number"
                        min={1}
                        value={form.slots_per_day}
                        onChange={(e) => setField("slots_per_day", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="slot-dur">Slot duration (minutes)</Label>
                      <Input
                        id="slot-dur"
                        type="number"
                        min={1}
                        value={form.slot_duration_minutes}
                        onChange={(e) => setField("slot_duration_minutes", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="slot-start">Start time</Label>
                      <Input
                        id="slot-start"
                        type="time"
                        value={form.slot_start_time}
                        onChange={(e) => setField("slot_start_time", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="slot-end">End time</Label>
                      <Input
                        id="slot-end"
                        type="time"
                        value={form.slot_end_time}
                        onChange={(e) => setField("slot_end_time", e.target.value)}
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-4 border-t pt-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Charging
                  </h3>
                  <div className="space-y-2">
                    <Label htmlFor="charge-basis">Charge calculation basis</Label>
                    <Textarea
                      id="charge-basis"
                      value={form.charge_calculation_basis}
                      onChange={(e) => setField("charge_calculation_basis", e.target.value)}
                      rows={2}
                      placeholder="e.g. per sample, per hour, per parameter…"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time-basis">Time calculation basis</Label>
                    <Textarea
                      id="time-basis"
                      value={form.time_calculation_basis}
                      onChange={(e) => setField("time_calculation_basis", e.target.value)}
                      rows={2}
                      placeholder="How booking time is derived…"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Category-wise charges (specify per hour, per sample, or other unit):
                  </p>
                  <div className="grid gap-3">
                    {CHARGE_FIELDS.map(({ key, label }) => (
                      <div key={key} className="space-y-1.5">
                        <Label htmlFor={key}>{label}</Label>
                        <Input
                          id={key}
                          value={form[key]}
                          onChange={(e) => setField(key, e.target.value)}
                          placeholder="e.g. ₹500 / hour"
                        />
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-4 border-t pt-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Attachments
                  </h3>
                  <div className="space-y-2">
                    <Label htmlFor="eq-doc">Supporting document (PDF or other)</Label>
                    <Input
                      id="eq-doc"
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,image/*,application/pdf"
                      onChange={(e) => setSupportingDocument(e.target.files?.[0] ?? null)}
                    />
                    {supportingDocument && (
                      <p className="text-xs text-muted-foreground">{supportingDocument.name}</p>
                    )}
                  </div>
                </section>

                <section className="space-y-4 border-t pt-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Proposed contacts (optional)
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="oic-name">Officer In-charge name</Label>
                      <Input
                        id="oic-name"
                        value={form.proposed_oic_name}
                        onChange={(e) => setField("proposed_oic_name", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="oic-email">Officer In-charge email</Label>
                      <Input
                        id="oic-email"
                        type="email"
                        value={form.proposed_oic_email}
                        onChange={(e) => setField("proposed_oic_email", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="op-name">Lab operator name</Label>
                      <Input
                        id="op-name"
                        value={form.proposed_operator_name}
                        onChange={(e) => setField("proposed_operator_name", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="op-email">Lab operator email</Label>
                      <Input
                        id="op-email"
                        type="email"
                        value={form.proposed_operator_email}
                        onChange={(e) => setField("proposed_operator_email", e.target.value)}
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-4 border-t pt-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Your details *
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="sub-name">Your name *</Label>
                      <Input
                        id="sub-name"
                        value={form.submitter_name}
                        onChange={(e) => setField("submitter_name", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sub-email">Your email *</Label>
                      <Input
                        id="sub-email"
                        type="email"
                        value={form.submitter_email}
                        onChange={(e) => setField("submitter_email", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="sub-phone">Phone</Label>
                      <Input
                        id="sub-phone"
                        value={form.submitter_phone}
                        onChange={(e) => setField("submitter_phone", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="notes">Notes for admin</Label>
                      <Textarea
                        id="notes"
                        value={form.notes}
                        onChange={(e) => setField("notes", e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>
                </section>

                <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit request"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default ProposeEquipment;
