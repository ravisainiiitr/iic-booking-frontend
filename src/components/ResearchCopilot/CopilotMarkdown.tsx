import { Fragment, useMemo } from "react";
import { type Inline, parseMarkdown } from "./markdown";

type Props = {
  text: string;
  onNavigate: (href: string) => void;
};

function Inlines({ items, onNavigate }: { items: Inline[]; onNavigate: (href: string) => void }) {
  return (
    <>
      {items.map((it, i) => {
        if (it.kind === "text") return <Fragment key={i}>{it.text}</Fragment>;
        if (it.kind === "bold") {
          return (
            <strong key={i} className="font-semibold">
              <Inlines items={it.children} onNavigate={onNavigate} />
            </strong>
          );
        }
        if (it.kind === "code") {
          return (
            <code key={i} className="rounded bg-black/10 px-1 py-0.5 text-xs dark:bg-white/10">
              {it.text}
            </code>
          );
        }
        if (it.external) {
          return (
            <a
              key={i}
              href={it.href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-amber-800 underline underline-offset-2 dark:text-amber-200"
            >
              <Inlines items={it.children} onNavigate={onNavigate} />
            </a>
          );
        }
        return (
          <a
            key={i}
            href={it.href}
            onClick={(e) => {
              e.preventDefault();
              onNavigate(it.href);
            }}
            className="font-medium text-amber-800 underline underline-offset-2 dark:text-amber-200"
          >
            <Inlines items={it.children} onNavigate={onNavigate} />
          </a>
        );
      })}
    </>
  );
}

/** Booking Assistant reply text: safe markdown rendered as React elements (no HTML injection). */
export function CopilotMarkdown({ text, onNavigate }: Props) {
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  return (
    <div className="space-y-2 break-words text-sm leading-relaxed">
      {blocks.map((b, i) => {
        if (b.kind === "rule") return <hr key={i} className="border-border/60" />;
        if (b.kind === "heading") {
          return (
            <p key={i} className="font-semibold">
              <Inlines items={b.inlines} onNavigate={onNavigate} />
            </p>
          );
        }
        if (b.kind === "paragraph") {
          return (
            <p key={i}>
              {b.lines.map((line, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  <Inlines items={line} onNavigate={onNavigate} />
                </Fragment>
              ))}
            </p>
          );
        }
        const ListTag = b.ordered ? "ol" : "ul";
        return (
          <ListTag
            key={i}
            start={b.ordered && b.start !== 1 ? b.start : undefined}
            className={`space-y-1 pl-5 ${b.ordered ? "list-decimal" : "list-disc"} marker:text-muted-foreground`}
          >
            {b.items.map((item, j) => (
              <li key={j}>
                <Inlines items={item.inlines} onNavigate={onNavigate} />
                {item.sub.length > 0 && (
                  <ul className="mt-1 list-[circle] space-y-1 pl-5 marker:text-muted-foreground">
                    {item.sub.map((s, k) => (
                      <li key={k}>
                        <Inlines items={s} onNavigate={onNavigate} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ListTag>
        );
      })}
    </div>
  );
}
