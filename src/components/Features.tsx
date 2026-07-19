import { Calendar, Clock, Zap, ShieldCheck, FlaskConical, LineChart } from "lucide-react";

const features = [
  {
    icon: Calendar,
    title: "Real-time booking",
    description:
      "Live slot calendars with immediate confirmation. See availability as it changes and reserve without waiting on email round-trips.",
  },
  {
    icon: FlaskConical,
    title: "Research-grade facilities",
    description:
      "Analytical and specialised instruments across participating departments, centres, and laboratories — clear specs, accessories, charges, and lab contacts on every equipment page.",
  },
  {
    icon: Zap,
    title: "Instant confirmation",
    description:
      "Your booking is saved the moment you confirm. Emails and notifications are sent in the background so the interface stays fast.",
  },
  {
    icon: Clock,
    title: "Sample & deadline tracking",
    description:
      "Submission countdowns, atmosphere-sensitive options, and dashboard reminders keep experiments on schedule.",
  },
  {
    icon: LineChart,
    title: "Results on your dashboard",
    description:
      "Download reports online when the lab publishes them — no routine visit required to collect paper copies.",
  },
  {
    icon: ShieldCheck,
    title: "Campus & external access",
    description:
      "Channel i login for IIT Roorkee users; secure registration and transparent pricing for institutes, industry, and startups.",
  },
];

const Features = () => {
  return (
    <section id="features" className="py-20 sm:py-28 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,hsl(175_40%_90%/0.5),transparent_55%)] dark:bg-[radial-gradient(ellipse_at_bottom,hsl(175_30%_20%/0.25),transparent_55%)]" />
      <div className="container relative mx-auto px-4">
        <div className="text-center mb-14 max-w-2xl mx-auto space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-400">
            Why book here
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-foreground">
            Built for scientific workflows
          </h2>
          <p className="text-lg text-muted-foreground">
            A modern institute-wide portal for students, faculty, project staff, and external researchers across departments, centres, and laboratories — from slot selection to online results.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group p-6 rounded-2xl bg-card/90 border border-border/80 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elegant)] hover:border-teal-300/50 dark:hover:border-teal-700/50 transition-all duration-300"
              >
                <div className="mb-4 inline-flex items-center justify-center w-11 h-11 rounded-xl bg-teal-700/10 text-teal-800 dark:text-teal-300 group-hover:bg-teal-700 group-hover:text-white transition-colors">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold mb-2 tracking-tight">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;
