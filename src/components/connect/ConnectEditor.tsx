import { useEffect, useRef, useState, type ReactNode } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, useEditorState, type Editor, type NodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import {
  Bold,
  Code,
  Eye,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Paperclip,
  PencilLine,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Underline,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { attachmentObjectUrl, connectApi, type AttachmentRef, type AuthorRef } from "@/lib/connectApi";
import { cn } from "@/lib/utils";
import { AttachmentList, PostBody } from "./PostBody";
import { formatBytes } from "./useConnect";

/** @mention stored as <span data-mention-id="123">@Name</span>; the server resolves and access-checks the id. */
const Mention = Node.create({
  name: "mention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,
  addAttributes() {
    return {
      id: { default: null, parseHTML: (el) => el.getAttribute("data-mention-id") },
      label: { default: "", parseHTML: (el) => (el.textContent || "").replace(/^@/, "") },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-mention-id]" }];
  },
  renderHTML({ node }) {
    return ["span", { "data-mention-id": node.attrs.id, class: "connect-mention" }, `@${node.attrs.label}`];
  },
  renderText({ node }) {
    return `@${node.attrs.label}`;
  },
});

function AuthImageView({ node }: NodeViewProps) {
  const [src, setSrc] = useState<string | null>(null);
  const id = node.attrs.attachmentId as string;
  useEffect(() => {
    let url: string | null = null;
    let alive = true;
    void attachmentObjectUrl(id).then((u) => {
      if (!alive) {
        if (u) URL.revokeObjectURL(u);
        return;
      }
      url = u;
      setSrc(u);
    });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  return (
    <NodeViewWrapper className="my-2">
      {src ? (
        <img src={src} alt={node.attrs.alt || ""} className="connect-inline-image max-h-96" />
      ) : (
        <div className="flex h-24 items-center justify-center rounded-md border bg-muted/40 text-xs text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Loading image…
        </div>
      )}
    </NodeViewWrapper>
  );
}

/** Inline image stored as <img data-attachment-id="uuid">: never a URL, always loaded through the access check. */
const AttachmentImage = Node.create({
  name: "attachmentImage",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      attachmentId: { default: null, parseHTML: (el) => el.getAttribute("data-attachment-id") },
      alt: { default: "", parseHTML: (el) => el.getAttribute("alt") || "" },
    };
  },
  parseHTML() {
    return [{ tag: "img[data-attachment-id]" }];
  },
  renderHTML({ node }) {
    return ["img", mergeAttributes({ "data-attachment-id": node.attrs.attachmentId, alt: node.attrs.alt || "" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(AuthImageView);
  },
});

function Tool({ label, onClick, active, disabled, children }: { label: string; onClick: () => void; active?: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40",
        active && "bg-primary/10 text-primary dark:text-sky-200",
      )}
    >
      {children}
    </button>
  );
}

const MENTION_TRIGGER = /(?:^|\s)@([\p{L}][\p{L}.\- ]{1,29})$/u;

export type ConnectEditorProps = {
  value: string;
  onChange: (html: string) => void;
  /** Community slug: uploads and @mention suggestions are scoped to it. Without it, uploads are disabled. */
  community?: string | null;
  attachments: AttachmentRef[];
  onAttachmentsChange: (items: AttachmentRef[]) => void;
  placeholder?: string;
  ariaLabel?: string;
  compact?: boolean;
  invalid?: boolean;
};

export function ConnectEditor({
  value,
  onChange,
  community,
  attachments,
  onAttachmentsChange,
  placeholder = "Describe the problem, what you tried and what you saw…",
  ariaLabel = "Message",
  compact = false,
  invalid = false,
}: ConnectEditorProps) {
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [mention, setMention] = useState<{ query: string; from: number; to: number } | null>(null);
  const [candidates, setCandidates] = useState<AuthorRef[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  const lastEmitted = useRef(value);

  const upload = async (files: File[], inlineImages: boolean, ed: Editor | null) => {
    if (!community) {
      toast.error("Choose a community before attaching files.");
      return;
    }
    for (const file of files) {
      const asImage = inlineImages && file.type.startsWith("image/");
      setUploading((n) => n + 1);
      const res = await connectApi.upload(community, file, asImage);
      setUploading((n) => n - 1);
      if (!res.data) {
        toast.error(res.error || `Could not attach ${file.name}.`);
        continue;
      }
      const item = res.data;
      onAttachmentsChange([...attachmentsRef.current, item]);
      if (asImage && ed) {
        ed.chain().focus().insertContent({ type: "attachmentImage", attrs: { attachmentId: item.id, alt: file.name } }).run();
      }
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [3, 4] },
        link: { openOnClick: false, autolink: true, protocols: ["http", "https", "mailto"], HTMLAttributes: { rel: "noopener noreferrer nofollow ugc" } },
      }),
      Placeholder.configure({ placeholder }),
      Mention,
      AttachmentImage,
    ],
    content: value || "",
    editorProps: {
      attributes: { "aria-label": ariaLabel, role: "textbox", "aria-multiline": "true" },
      handleDrop: (_view, event) => {
        const files = Array.from((event as DragEvent).dataTransfer?.files ?? []);
        if (!files.length) return false;
        event.preventDefault();
        void upload(files, true, editorRef.current);
        return true;
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (!files.length) return false;
        void upload(files, true, editorRef.current);
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.isEmpty ? "" : ed.getHTML();
      lastEmitted.current = html;
      onChange(html);
      const { from } = ed.state.selection;
      const before = ed.state.doc.textBetween(Math.max(0, from - 40), from, "\n", "￼");
      const match = before.match(MENTION_TRIGGER);
      setMention(match ? { query: match[1], from: from - match[1].length - 1, to: from } : null);
    },
  });
  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;

  // External value changes (draft restored, reset after posting).
  useEffect(() => {
    if (!editor || value === lastEmitted.current) return;
    lastEmitted.current = value;
    editor.commands.setContent(value || "", { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    if (!mention || !community) {
      setCandidates([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      const res = await connectApi.mentionCandidates(community, mention.query);
      setCandidates(res.data?.results ?? []);
    }, 200);
    return () => window.clearTimeout(handle);
  }, [mention, community]);

  const state = useEditorState({
    editor,
    selector: ({ editor: ed }) =>
      ed
        ? {
            bold: ed.isActive("bold"),
            italic: ed.isActive("italic"),
            underline: ed.isActive("underline"),
            strike: ed.isActive("strike"),
            code: ed.isActive("code"),
            codeBlock: ed.isActive("codeBlock"),
            quote: ed.isActive("blockquote"),
            bullet: ed.isActive("bulletList"),
            ordered: ed.isActive("orderedList"),
            heading: ed.isActive("heading", { level: 3 }),
            link: ed.isActive("link"),
            canUndo: ed.can().undo(),
            canRedo: ed.can().redo(),
          }
        : null,
  });

  const pickMention = (person: AuthorRef) => {
    if (!editor || !mention) return;
    editor
      .chain()
      .focus()
      .deleteRange({ from: mention.from, to: mention.to })
      .insertContent([{ type: "mention", attrs: { id: String(person.id), label: person.name } }, { type: "text", text: " " }])
      .run();
    setMention(null);
  };

  const applyLink = () => {
    if (!editor) return;
    const url = linkUrl.trim();
    if (!url) editor.chain().focus().unsetLink().run();
    else if (/^(https?:\/\/|mailto:)/i.test(url)) editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: `https://${url}` }).run();
    setLinkOpen(false);
    setLinkUrl("");
  };

  const removeAttachment = async (item: AttachmentRef) => {
    onAttachmentsChange(attachmentsRef.current.filter((a) => a.id !== item.id));
    await connectApi.removeUpload(item.id);
  };

  const s = state;
  return (
    <div className={cn("connect-editor rounded-xl border bg-background", invalid && "border-destructive")}>
      <div className="flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1" role="toolbar" aria-label="Formatting">
        <Tool label="Bold (Ctrl+B)" active={s?.bold} disabled={preview} onClick={() => editor?.chain().focus().toggleBold().run()}>
          <Bold className="h-4 w-4" />
        </Tool>
        <Tool label="Italic (Ctrl+I)" active={s?.italic} disabled={preview} onClick={() => editor?.chain().focus().toggleItalic().run()}>
          <Italic className="h-4 w-4" />
        </Tool>
        <Tool label="Underline" active={s?.underline} disabled={preview} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
          <Underline className="h-4 w-4" />
        </Tool>
        <Tool label="Strikethrough" active={s?.strike} disabled={preview} onClick={() => editor?.chain().focus().toggleStrike().run()}>
          <Strikethrough className="h-4 w-4" />
        </Tool>
        {!compact ? (
          <Tool label="Heading" active={s?.heading} disabled={preview} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>
            <Heading3 className="h-4 w-4" />
          </Tool>
        ) : null}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <Tool label="Bulleted list" active={s?.bullet} disabled={preview} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          <List className="h-4 w-4" />
        </Tool>
        <Tool label="Numbered list" active={s?.ordered} disabled={preview} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-4 w-4" />
        </Tool>
        <Tool label="Quote" active={s?.quote} disabled={preview} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
          <Quote className="h-4 w-4" />
        </Tool>
        <Tool label="Inline code" active={s?.code} disabled={preview} onClick={() => editor?.chain().focus().toggleCode().run()}>
          <Code className="h-4 w-4" />
        </Tool>
        <Tool label="Code block" active={s?.codeBlock} disabled={preview} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}>
          <SquareCode className="h-4 w-4" />
        </Tool>
        <Popover open={linkOpen} onOpenChange={setLinkOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Link"
              title="Link"
              disabled={preview}
              onMouseDown={(e) => e.preventDefault()}
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40",
                s?.link && "bg-primary/10 text-primary",
              )}
            >
              <Link2 className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="start">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                applyLink();
              }}
              className="space-y-2"
            >
              <label className="text-xs font-medium" htmlFor="connect-link-url">
                Link address
              </label>
              <Input id="connect-link-url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" autoFocus />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setLinkOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Apply
                </Button>
              </div>
            </form>
          </PopoverContent>
        </Popover>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <Tool label="Insert image" disabled={preview || !community} onClick={() => imageInput.current?.click()}>
          <ImagePlus className="h-4 w-4" />
        </Tool>
        <Tool label="Attach file" disabled={preview || !community} onClick={() => fileInput.current?.click()}>
          <Paperclip className="h-4 w-4" />
        </Tool>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <Tool label="Undo" disabled={preview || !s?.canUndo} onClick={() => editor?.chain().focus().undo().run()}>
          <Undo2 className="h-4 w-4" />
        </Tool>
        <Tool label="Redo" disabled={preview || !s?.canRedo} onClick={() => editor?.chain().focus().redo().run()}>
          <Redo2 className="h-4 w-4" />
        </Tool>
        <div className="ml-auto flex items-center gap-2 pr-1">
          {uploading ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" role="status">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Uploading…
            </span>
          ) : null}
          <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => setPreview((p) => !p)} aria-pressed={preview}>
            {preview ? <PencilLine className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            {preview ? "Write" : "Preview"}
          </Button>
        </div>
      </div>

      <div className={cn(preview && "hidden")}>
        <EditorContent editor={editor} className={cn("connect-prose", compact && "[&_.ProseMirror]:min-h-[6rem]")} />
      </div>
      {preview ? (
        <div className="min-h-[10rem] px-4 py-3">
          {value ? <PostBody html={value} /> : <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>}
          <AttachmentList items={attachments} />
        </div>
      ) : null}

      {mention && candidates.length ? (
        <ul className="mx-2 mb-2 max-h-48 overflow-y-auto rounded-lg border bg-popover p-1 shadow-md" role="listbox" aria-label="Mention someone">
          {candidates.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickMention(c)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                <span>{c.name}</span>
                {c.badge ? <span className="text-[11px] text-muted-foreground">{c.badge}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {attachments.filter((a) => !a.is_inline_image).length ? (
        <ul className="flex flex-wrap gap-2 border-t px-3 py-2" aria-label="Attached files">
          {attachments
            .filter((a) => !a.is_inline_image)
            .map((a) => (
              <li key={a.id} className="inline-flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1 text-xs">
                <Paperclip className="h-3.5 w-3.5" aria-hidden />
                <span className="max-w-[12rem] truncate">{a.name}</span>
                <span className="text-muted-foreground">{formatBytes(a.size)}</span>
                <button type="button" aria-label={`Remove ${a.name}`} onClick={() => void removeAttachment(a)} className="rounded p-0.5 hover:bg-muted">
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
        </ul>
      ) : null}
      <p className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">
        Drag files here or paste images. Images, PDF, Office documents and text or CSV files are accepted. Type @ to mention someone in this community.
      </p>

      <input
        ref={fileInput}
        type="file"
        multiple
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.txt,.csv,.tsv,.md,.log,.json,.xml,.dat,.xy,.asc"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void upload(files, false, editor);
        }}
      />
      <input
        ref={imageInput}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void upload(files, true, editor);
        }}
      />
    </div>
  );
}
