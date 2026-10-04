import { Calendar, FlaskConical, Mail, Phone, ShieldCheck, Wallet } from "lucide-react";

const BENEFITS = [
  { icon: Calendar, text: "Live slot availability and booking for institute equipment" },
  { icon: FlaskConical, text: "Sample submission, analysis status and results in one place" },
  { icon: Wallet, text: "Wallets, recharges and transparent charges" },
  { icon: ShieldCheck, text: "Your supervisor stays informed and in control" },
];

const STEPS = [
  { title: "Register", body: "Fill in this form. It takes about five minutes." },
  { title: "Verify your email", body: "Open the link we email you and confirm your details." },
  {
    title: "Supervisor approves within 24 h",
    body: "IITR Post-docs, Research Associates and Startups only. External users with an institution email skip this.",
  },
  { title: "Start booking", body: "Sign in with your email and password or a one-time code." },
];

/** Left panel on the Create account tab (desktop only). */
export function SignUpAside() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h2 className="text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">
          Welcome to the Institute Equipment Booking Portal
        </h2>
        <p className="max-w-md text-base leading-relaxed text-white/80">
          Create your account to book research equipment and analysis services at IIT Roorkee.
        </p>
      </div>

      <ul className="space-y-3 text-[15px] text-white/90">
        {BENEFITS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span className="pt-1 leading-relaxed">{text}</span>
          </li>
        ))}
      </ul>

      <section aria-labelledby="how-registration-works" className="rounded-2xl border border-white/15 bg-white/10 p-6 backdrop-blur-sm">
        <h3 id="how-registration-works" className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/75">
          How registration works
        </h3>
        <ol className="space-y-0">
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative flex gap-4 pb-5 last:pb-0">
              {index < STEPS.length - 1 ? (
                <span className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px bg-white/25" aria-hidden />
              ) : null}
              <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-primary">
                {index + 1}
              </span>
              <div className="pt-1">
                <p className="font-medium leading-tight">{step.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-white/75">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/80">
        <span className="font-medium text-white">Need help?</span>
        <a href="mailto:iic@iitr.ac.in" className="inline-flex items-center gap-1.5 underline-offset-2 hover:underline">
          <Mail className="h-4 w-4" aria-hidden />
          iic@iitr.ac.in
        </a>
        <a href="tel:01332284350" className="inline-flex items-center gap-1.5 underline-offset-2 hover:underline">
          <Phone className="h-4 w-4" aria-hidden />
          01332-284350
        </a>
      </p>
    </div>
  );
}
