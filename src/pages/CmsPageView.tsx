import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiClient, type CmsPageBlock, type ColumnsBlock } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Mail, Phone, MapPin, Briefcase } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NoticeBoard from "@/components/NoticeBoard";

/** Strip script/style and event handlers to reduce XSS risk for HTML blocks. */
function sanitizeHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "");
}

function getYoutubeEmbedUrl(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

function BlockRenderer({ block }: { block: CmsPageBlock }) {
  if (block.type === "columns") {
    const colBlock = block as ColumnsBlock;
    const cols = colBlock.columns ?? [];
    const count = colBlock.columnCount ?? 2;
    return (
      <div className={`grid gap-x-8 gap-y-6 my-6 ${count === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
        {cols.slice(0, count).map((columnBlocks, colIdx) => (
          <div key={colIdx} className="space-y-4 min-w-0">
            {columnBlocks.map((b, i) => (
              <BlockRenderer key={i} block={b} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  switch (block.type) {
    case "heading": {
      const level = Math.min(4, Math.max(1, block.level ?? 1));
      const Tag = `h${level}` as keyof JSX.IntrinsicElements;
      return (
        <Tag className="scroll-mt-20 font-semibold text-foreground mt-6 mb-2 first:mt-0">
          {block.text}
        </Tag>
      );
    }
    case "paragraph": {
      const text = block.text ?? block.content ?? "";
      if (text.includes("<") && text.includes(">")) {
        return (
          <div
            className="text-muted-foreground leading-relaxed mb-4 prose prose-neutral dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(text) }}
          />
        );
      }
      return <p className="text-muted-foreground leading-relaxed mb-4">{text}</p>;
    }
    case "image":
      if (!block.url) return null;
      return (
        <figure className="my-6">
          <img
            src={block.url}
            alt={block.alt ?? ""}
            className="max-w-full h-auto rounded-lg border border-border"
          />
          {(block.caption ?? block.alt) ? (
            <figcaption className="text-sm text-muted-foreground mt-2">{block.caption ?? block.alt}</figcaption>
          ) : null}
        </figure>
      );
    case "list": {
      const items = Array.isArray(block.items) ? block.items : [];
      if (block.ordered) {
        return (
          <ol className="list-decimal list-inside space-y-1 mb-4 text-muted-foreground">
            {items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ol>
        );
      }
      return (
        <ul className="list-disc list-inside space-y-1 mb-4 text-muted-foreground">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    }
    case "quote":
      return (
        <blockquote className="border-l-4 border-primary pl-4 py-2 my-4 italic text-muted-foreground">
          {block.text}
        </blockquote>
      );
    case "divider":
      return <hr className="my-8 border-border" />;
    case "button":
      if (!block.url && !block.buttonText) return null;
      return (
        <p className="my-4">
          <Button asChild variant="default">
            <a
              href={block.url || "#"}
              {...(block.openInNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              {block.buttonText || "Link"}
            </a>
          </Button>
        </p>
      );
    case "spacer":
      return <div style={{ height: Math.max(0, Number(block.height) || 24) }} aria-hidden />;
    case "embed": {
      const url = block.url?.trim();
      if (!url) return null;
      if (block.embedType === "youtube") {
        const embedUrl = getYoutubeEmbedUrl(url);
        if (embedUrl) {
          return (
            <div className="my-6 aspect-video max-w-2xl rounded-lg overflow-hidden border border-border">
              <iframe
                src={embedUrl}
                title="YouTube embed"
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          );
        }
      }
      return (
        <div className="my-6 aspect-video max-w-2xl rounded-lg overflow-hidden border border-border">
          <iframe src={url} title="Embed" className="w-full h-full" allowFullScreen />
        </div>
      );
    }
    case "html":
      return (
        <div
          className="my-4 prose prose-neutral dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.html ?? "") }}
        />
      );
    case "callout": {
      const variant = block.variant ?? "info";
      const bg = { info: "bg-primary/10 border-primary/30", warning: "bg-amber-500/10 border-amber-500/30", success: "bg-green-500/10 border-green-500/30", default: "bg-muted border-border" }[variant];
      return (
        <div className={`my-4 rounded-lg border p-4 ${bg}`}>
          <p className="text-foreground leading-relaxed m-0">{block.text}</p>
        </div>
      );
    }
    case "id_card": {
      const contactNum = block.contactNumber ?? (block as { contact_number?: string }).contact_number ?? "";
      const resumeUrl = block.resumeUrl ?? (block as { resume_url?: string }).resume_url ?? "";
      const cardWidth = (block.cardWidth ?? (block as { card_width?: string }).card_width ?? "").trim();
      const cardHeight = (block.cardHeight ?? (block as { card_height?: string }).card_height ?? "").trim();
      const hasAny = block.name || block.designation || block.email || block.location || contactNum || block.role || block.url;
      if (!hasAny) return null;
      const containerStyle: React.CSSProperties = {};
      if (cardWidth) containerStyle.width = cardWidth;
      if (cardHeight) containerStyle.height = cardHeight;
      const resumeLink = (content: React.ReactNode) =>
        resumeUrl ? (
          <a href={resumeUrl} target="_blank" rel="noopener noreferrer" className="cursor-pointer hover:opacity-90 transition-opacity outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded">
            {content}
          </a>
        ) : (
          <>{content}</>
        );
      return (
        <div className="my-6" style={Object.keys(containerStyle).length ? containerStyle : undefined}>
          <div className="flex h-full w-full flex-col rounded-xl border-2 border-border bg-card overflow-hidden shadow-md min-h-0">
            <div className="flex flex-1 min-h-0 min-w-0">
              {block.url ? (
                resumeLink(
                  <div className="w-32 sm:w-40 shrink-0 aspect-square bg-muted overflow-hidden">
                    <img
                      src={block.url}
                      alt={block.name ? `${block.name} photo` : "Photo"}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )
              ) : null}
              <div className="p-4 flex-1 min-w-0 flex flex-col justify-center space-y-1.5">
                {block.name ? (
                  <p className="font-semibold text-lg text-foreground">
                    {resumeLink(<span className={resumeUrl ? "hover:underline" : ""}>{block.name}</span>)}
                  </p>
                ) : null}
                {block.designation ? <p className="text-sm text-muted-foreground">{block.designation}</p> : null}
                {block.email ? (
                  <p className="flex items-center gap-2 text-sm min-w-0">
                    <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <a href={`mailto:${block.email}`} className="text-primary hover:underline truncate">{block.email}</a>
                  </p>
                ) : null}
                {block.location ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span className="truncate">{block.location}</span>
                  </p>
                ) : null}
                {contactNum ? (
                  <p className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <a href={`tel:${contactNum.replace(/\s/g, "")}`} className="text-primary hover:underline">{contactNum}</a>
                  </p>
                ) : null}
              </div>
            </div>
            {block.role ? (
              <div className="w-full flex items-start gap-3 text-base font-medium text-foreground bg-muted px-4 py-3 min-h-[3.5rem] border-t border-border">
                <Briefcase className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
                <span className="leading-snug break-words">{block.role}</span>
              </div>
            ) : null}
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}

export default function CmsPageView() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState<{ title: string; slug: string; content: CmsPageBlock[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setError("Missing slug");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    apiClient
      .getCmsPageBySlug(slug)
      .then((res) => {
        if (res.error) {
          setError(res.error);
          setPage(null);
        } else if (res.data) {
          setPage(res.data);
        } else {
          setError("Page not found");
        }
      })
      .catch(() => setError("Failed to load page"))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="page-shell flex flex-col">
        <Header />
        <main className="flex-1 pt-24 pb-12 container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 flex items-center justify-center min-h-[200px]">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
            <div className="flex">
              <NoticeBoard />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="page-shell flex flex-col">
        <Header />
        <main className="flex-1 pt-24 pb-12 container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 flex items-center justify-center min-h-[200px]">
              <div className="text-center space-y-4">
                <p className="text-destructive">{error ?? "Page not found."}</p>
                <Button variant="outline" onClick={() => navigate("/")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to home
                </Button>
              </div>
            </div>
            <div className="flex">
              <NoticeBoard />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="page-shell flex flex-col">
      <Header />
      <main className="flex-1 pt-24 pb-12 container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Button
              variant="ghost"
              size="sm"
              className="mb-6 -ml-2"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-3xl font-bold text-foreground mb-8">{page.title}</h1>
            <div className="prose prose-neutral dark:prose-invert max-w-none">
              {page.content.map((block, idx) => (
                <BlockRenderer key={idx} block={block} />
              ))}
            </div>
          </div>
          <div className="flex">
            <NoticeBoard />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
