import { useEffect, useRef, useState } from "react";
import { Extension } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { Bold, Italic, Link2, Link2Off } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeLinkInput } from "@/lib/richTextEditing";

function ToolButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active ?? undefined}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-primary/10 text-primary",
      )}
    >
      {children}
    </button>
  );
}

/** One-line editor for a flash message: bold, italic and links only; Enter does not add lines. */
export function FlashMessageEditor({
  value,
  onChange,
  invalid,
  id,
}: {
  value: string;
  onChange: (html: string) => void;
  invalid?: boolean;
  id?: string;
}) {
  const lastEmitted = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          blockquote: false,
          bulletList: false,
          orderedList: false,
          listItem: false,
          listKeymap: false,
          code: false,
          codeBlock: false,
          hardBreak: false,
          heading: false,
          horizontalRule: false,
          strike: false,
          underline: false,
          trailingNode: false,
          link: {
            openOnClick: false,
            autolink: true,
            linkOnPaste: true,
            defaultProtocol: "https",
            protocols: ["mailto"],
            HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
            isAllowedUri: (url, ctx) => /^(https?:|mailto:)/i.test(url) && ctx.defaultValidate(url),
          },
        }),
        Placeholder.configure({ placeholder: "e.g. Sample submission closes at 4 PM today" }),
        Extension.create({
          name: "flashSingleLine",
          addKeyboardShortcuts() {
            return { Enter: () => true, "Shift-Enter": () => true, "Mod-Enter": () => true };
          },
        }),
      ],
      content: value || "",
      immediatelyRender: true,
      shouldRerenderOnTransaction: false,
      editorProps: {
        attributes: {
          class: "min-h-[2.75rem] px-3 py-2 text-sm outline-none",
          role: "textbox",
          "aria-label": "Message",
          ...(id ? { id } : {}),
        },
        transformPastedHTML: (html) => html.replace(/<\/?(p|div|br|li|h[1-6])(\s[^>]*)?\/?>/gi, " "),
      },
      onUpdate: ({ editor: ed }) => {
        const next = ed.isEmpty ? "" : ed.getHTML().replace(/^<p>|<\/p>$/g, "").replace(/<\/p><p>/g, " ");
        lastEmitted.current = next;
        onChangeRef.current(next);
      },
    },
    [],
  );

  useEffect(() => {
    if (!editor || value === lastEmitted.current) return;
    editor.commands.setContent(value || "", { emitUpdate: false });
    lastEmitted.current = value;
  }, [editor, value]);

  const state = useEditorState({
    editor,
    selector: ({ editor: ed }) =>
      ed ? { bold: ed.isActive("bold"), italic: ed.isActive("italic"), link: ed.isActive("link") } : null,
  });

  if (!editor) return null;

  const openLink = () => {
    setLinkValue((editor.getAttributes("link").href as string | undefined) ?? "");
    setLinkError(null);
    setLinkOpen(true);
  };

  const applyLink = () => {
    const href = normalizeLinkInput(linkValue);
    if (!href) {
      setLinkError("Enter a web address (https://…) or an email address.");
      return;
    }
    const chain = editor.chain().focus().extendMarkRange("link");
    if (editor.state.selection.empty && !editor.isActive("link")) {
      chain.insertContent({ type: "text", text: href.replace(/^mailto:/i, ""), marks: [{ type: "link", attrs: { href } }] }).run();
    } else {
      chain.setLink({ href }).run();
    }
    setLinkOpen(false);
  };

  return (
    <div
      className={cn(
        "rich-text-editor overflow-hidden rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring",
        invalid && "border-destructive",
      )}
    >
      <div className="flex items-center gap-0.5 border-b bg-muted/40 px-1.5 py-1" role="toolbar" aria-label="Formatting">
        <ToolButton label="Bold" active={state?.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Italic" active={state?.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="h-4 w-4" />
        </ToolButton>
        <ToolButton label={state?.link ? "Edit link" : "Add link"} active={state?.link} onClick={openLink}>
          <Link2 className="h-4 w-4" />
        </ToolButton>
        {state?.link ? (
          <ToolButton label="Remove link" onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}>
            <Link2Off className="h-4 w-4" />
          </ToolButton>
        ) : null}
      </div>
      {linkOpen ? (
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 px-2 py-1.5">
          <input
            autoFocus
            value={linkValue}
            onChange={(e) => {
              setLinkValue(e.target.value);
              setLinkError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              } else if (e.key === "Escape") {
                setLinkOpen(false);
              }
            }}
            placeholder="https://…"
            aria-label="Link address"
            className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs"
          />
          <button type="button" onClick={applyLink} className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90">
            Apply
          </button>
          <button type="button" onClick={() => setLinkOpen(false)} className="h-8 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted">
            Cancel
          </button>
          {linkError ? <p className="basis-full text-xs text-destructive">{linkError}</p> : null}
        </div>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  );
}

export default FlashMessageEditor;
