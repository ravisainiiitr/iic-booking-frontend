import { BookOpen } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { useUserGuide } from "@/components/UserGuide/UserGuideProvider";
import { useAuth } from "@/contexts/AuthContext";
import { formatUserDisplayName } from "@/lib/displayName";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEmbeddedMode } from "@/contexts/EmbeddedModeContext";

/**
 * Full-page / in-dashboard workspace view of the role-specific user guide.
 */
export default function UserGuidePage() {
  const { guide } = useUserGuide();
  const { user } = useAuth();
  const embedded = useEmbeddedMode();
  const displayName = formatUserDisplayName(user) || "there";

  if (!guide) {
    return (
      <div className="page-shell">
        {!embedded ? <DashboardHeader /> : null}
        <main className="container mx-auto max-w-3xl px-4 py-6">
          <Card>
            <CardHeader>
              <CardTitle>User Guide</CardTitle>
              <CardDescription>No guide is available for your account type yet.</CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      {!embedded ? <DashboardHeader /> : null}
      <main className="container mx-auto max-w-3xl px-4 py-6 sm:py-6 space-y-6">
        <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-primary/5 via-card to-accent/10 p-5 sm:p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                  {guide.title}
                </h1>
                <Badge variant="secondary" className="font-medium">
                  {guide.audienceLabel}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{guide.subtitle}</p>
              <p className="text-sm text-foreground/90 pt-1">
                Welcome, <span className="font-medium">{displayName}</span>. {guide.welcomeBody}
              </p>
            </div>
          </div>
        </div>

        <nav className="rounded-xl border border-border/60 bg-card px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Contents
          </p>
          <ol className="grid gap-1 sm:grid-cols-2 text-sm">
            {guide.sections.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#guide-${section.id}`}
                  className="text-primary hover:underline underline-offset-2"
                >
                  {index + 1}. {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {guide.sections.map((section, index) => (
          <Card key={section.id} id={`guide-${section.id}`} className="scroll-mt-4 border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-baseline gap-2">
                <span className="text-muted-foreground font-normal text-sm tabular-nums">
                  {index + 1}.
                </span>
                {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed text-foreground/90">
              {section.paragraphs.map((p) => (
                <p key={p.slice(0, 48)}>{p}</p>
              ))}
              {section.steps?.length ? (
                <ol className="space-y-3 list-decimal pl-5">
                  {section.steps.map((step) => (
                    <li key={step.title} className="pl-1">
                      <p className="font-medium text-foreground">{step.title}</p>
                      <p className="text-muted-foreground mt-0.5">{step.body}</p>
                      {step.screenshotSrc ? (
                        <figure className="mt-3 overflow-hidden rounded-lg border border-border/70 bg-muted/20 shadow-sm">
                          <img
                            src={step.screenshotSrc}
                            alt={step.screenshotCaption || step.title}
                            className="w-full h-auto object-contain object-top max-h-[28rem]"
                            loading="lazy"
                          />
                          {step.screenshotCaption ? (
                            <figcaption className="border-t border-border/60 px-3 py-1.5 text-xs text-muted-foreground">
                              {step.screenshotCaption}
                            </figcaption>
                          ) : null}
                        </figure>
                      ) : step.screenshotCaption ? (
                        <p className="mt-2 rounded-md border border-dashed border-muted-foreground/40 bg-muted/20 px-2.5 py-2 text-xs italic text-muted-foreground">
                          [Screenshot: {step.screenshotCaption}]
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : null}
              {section.bullets?.length ? (
                <ul className="space-y-1.5 list-disc pl-5 text-muted-foreground">
                  {section.bullets.map((b) => (
                    <li key={b.slice(0, 48)} className="pl-1 text-foreground/85">
                      {b}
                    </li>
                  ))}
                </ul>
              ) : null}
              {section.callouts?.length ? (
                <div className="space-y-2">
                  {section.callouts.map((c) => (
                    <div
                      key={c.slice(0, 48)}
                      className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
                    >
                      {c}
                    </div>
                  ))}
                </div>
              ) : null}
              {section.faqs?.length ? (
                <div className="space-y-3">
                  {section.faqs.map((faq) => (
                    <div key={faq.question} className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
                      <p className="font-medium text-foreground">Q: {faq.question}</p>
                      <p className="mt-1 text-muted-foreground">A: {faq.answer}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}