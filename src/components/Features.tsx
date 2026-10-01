import { Calendar, Clock, Zap, ShieldCheck, FlaskConical, LineChart } from "lucide-react";

const features = [
  {
    icon: Calendar,
    title: "Real-time booking",
    description: "Live slot calendars — see availability and reserve instantly.",
  },
  {
    icon: FlaskConical,
    title: "Research-grade facilities",
    description: "Instruments across departments with specs, charges and lab contacts.",
  },
  {
    icon: Zap,
    title: "Instant confirmation",
    description: "Bookings save immediately; emails are sent in the background.",
  },
  {
    icon: Clock,
    title: "Sample & deadline tracking",
    description: "Submission countdowns and reminders keep experiments on schedule.",
  },
  {
    icon: LineChart,
    title: "Results on your dashboard",
    description: "Download reports online as soon as the lab publishes them.",
  },
  {
    icon: ShieldCheck,
    title: "Campus & external access",
    description: "Channel i login for IITR; transparent pricing for external users.",
  },
];

const Features = () => {
  return (
    <section id="features" className="pt-3 pb-6 sm:pt-4 sm:pb-8 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,hsl(215_40%_90%/0.5),transparent_55%)] dark:bg-[radial-gradient(ellipse_at_bottom,hsl(215_30%_20%/0.25),transparent_55%)]" />
      <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="mb-4 max-w-3xl space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary dark:text-sky-300">
            Why book here
          </p>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            Built for scientific workflows
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            One portal for IIT Roorkee and external researchers — from slot selection to online results.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group px-4 py-3 rounded-xl bg-card/90 border border-border/80 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elegant)] hover:border-primary/50 dark:hover:border-primary/50 transition-all duration-300"
              >
                <div className="flex items-center gap-2.5">
                  <div className="inline-flex shrink-0 items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary dark:text-sky-200 group-hover:bg-primary/90 group-hover:text-white transition-colors">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <h3 className="text-base font-semibold tracking-tight leading-tight">{feature.title}</h3>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground leading-snug">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;
