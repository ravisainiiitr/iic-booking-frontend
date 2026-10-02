import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EditorContent, Extension, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { Mark, Node as PMNode } from "@tiptap/pm/model";
import { Color, FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import { Highlight } from "@tiptap/extension-highlight";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { TextAlign } from "@tiptap/extension-text-align";
import { Placeholder } from "@tiptap/extensions";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Baseline,
  Bold,
  Check,
  ChevronDown,
  Eye,
  Highlighter,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  PencilLine,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Underline,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RichTextContent } from "@/components/RichTextContent";
import {
  FONT_FAMILIES,
  FONT_SIZES,
  HIGHLIGHT_COLORS,
  NORMAL_FONT_SIZE,
  RICH_TEXT_PLAIN_MAX_LENGTH,
  TEXT_COLORS,
  fontFamilyToken,
  highlightColorToken,
  instructionToHtml,
  normalizeRichHtml,
  pointsFromSizeToken,
  richTextToPlain,
  sizeToken,
  textColorToken,
} from "@/lib/richText";
import { convertWordLists, normalizeLinkInput } from "@/lib/richTextEditing";

export type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  invalid?: boolean;
  minHeightClass?: string;
  maxLength?: number;
  /** Classes for the preview box so it matches where users see the text. */
  previewClassName?: string;
};

const COLOR_LABELS: Record<string, string> = {
  red: "Red", orange: "Orange", amber: "Amber", green: "Green", blue: "Blue", purple: "Purple",
  pink: "Pink", gray: "Grey", yellow: "Yellow",
};

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? "⌘" : "Ctrl";

/** Point size that matches the older "Heading" (h3, 1.25em) and "Large" (h4, 1.1em) styles. */
const HEADING_POINTS: Record<number, number> = { 3: 14, 4: 12 };

/** Size at the cursor or across the selection: "default", a point size, or "" when the selection is mixed. */
function selectionSize(ed: Editor): string {
  const { state } = ed;
  const { from, to, empty, $from } = state.selection;
  const sizeOf = (marks: readonly Mark[], parent: PMNode | null) => {
    const token = marks.find((m) => m.type.name === "textStyle")?.attrs.fontSize as string | undefined;
    const points = pointsFromSizeToken(token) ?? (parent?.type.name === "heading" ? HEADING_POINTS[parent.attrs.level] : null);
    return points ? String(points) : "default";
  };
  if (empty) return sizeOf(state.storedMarks ?? $from.marks(), $from.parent);
  const sizes = new Set<string>();
  state.doc.nodesBetween(from, to, (node, _pos, parent) => {
    if (node.isText) sizes.add(sizeOf(node.marks, parent));
  });
  if (sizes.size === 0) return sizeOf($from.marks(), $from.parent);
  return sizes.size === 1 ? [...sizes][0] : "";
}

function stepSize(ed: Editor, direction: 1 | -1): boolean {
  const current = selectionSize(ed);
  const points = current === "default" || current === "" ? NORMAL_FONT_SIZE : Number(current);
  const next = direction > 0 ? FONT_SIZES.find((s) => s > points) : [...FONT_SIZES].reverse().find((s) => s < points);
  if (next) ed.chain().focus().setFontSize(sizeToken(next)).run();
  return true;
}

const DEFAULT_PREVIEW_CLASS =
  "rounded-lg border-2 border-red-500/70 bg-red-50 px-4 py-3 text-base text-red-700 dark:border-red-500/50 dark:bg-red-950/40 dark:text-red-400";

function ToolButton({
  label,
  shortcut,
  icon,
  active,
  disabled,
  onClick,
}: {
  label: string;
  shortcut?: string;
  icon: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={shortcut ? `${label} (${shortcut})` : label}
          aria-pressed={active ?? undefined}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClick}
          className={cn(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40",
            active && "bg-primary/10 text-primary ring-1 ring-primary/30"
          )}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}
        {shortcut ? <span className="ml-1.5 text-muted-foreground">{shortcut}</span> : null}
      </TooltipContent>
    </Tooltip>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden />;
}

function ColorMenu({
  editor,
  kind,
  current,
}: {
  editor: Editor;
  kind: "text" | "highlight";
  current: string | null;
}) {
  const [open, setOpen] = useState(false);
  const names: readonly string[] = kind === "text" ? TEXT_COLORS : HIGHLIGHT_COLORS;
  const token = kind === "text" ? textColorToken : highlightColorToken;
  const label = kind === "text" ? "Text colour" : "Highlight";
  const apply = (name: string | null) => {
    const chain = editor.chain().focus();
    if (kind === "text") (name ? chain.setColor(token(name)) : chain.unsetColor()).run();
    else (name ? chain.setHighlight({ color: token(name) }) : chain.unsetHighlight()).run();
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={label}
              onMouseDown={(e) => e.preventDefault()}
              className="inline-flex h-8 shrink-0 items-center gap-0.5 rounded-md px-1.5 text-foreground hover:bg-muted"
            >
              {kind === "text" ? <Baseline className="h-4 w-4" /> : <Highlighter className="h-4 w-4" />}
              <span
                className="h-1.5 w-4 rounded-sm border border-border"
                style={{ background: current ?? (kind === "text" ? "currentColor" : "transparent") }}
                aria-hidden
              />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        className="w-auto p-2"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
        <div className="grid grid-cols-5 gap-1.5">
          <button
            type="button"
            title={kind === "text" ? "Default colour" : "No highlight"}
            aria-label={kind === "text" ? "Default colour" : "No highlight"}
            onClick={() => apply(null)}
            className="relative h-7 w-7 rounded-md border bg-background text-xs font-semibold hover:ring-2 hover:ring-ring"
          >
            {kind === "text" ? "A" : <span className="absolute inset-x-1 top-1/2 h-px -rotate-45 bg-destructive" />}
          </button>
          {names.map((name) => (
            <button
              key={name}
              type="button"
              title={COLOR_LABELS[name] ?? name}
              aria-label={COLOR_LABELS[name] ?? name}
              aria-pressed={current === token(name)}
              onClick={() => apply(name)}
              className={cn(
                "h-7 w-7 rounded-md border text-sm font-bold hover:ring-2 hover:ring-ring",
                current === token(name) && "ring-2 ring-primary"
              )}
              style={kind === "text" ? { color: token(name) } : { background: token(name) }}
            >
              {kind === "text" ? "A" : ""}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SizeMenu({ editor, current }: { editor: Editor; current: string }) {
  const [open, setOpen] = useState(false);
  const options = [{ value: "default", label: "Default" }, ...FONT_SIZES.map((s) => ({ value: String(s), label: String(s) }))];
  const shown = current === "default" ? "Default" : current;
  const apply = (value: string) => {
    const chain = editor.chain().focus();
    (value === "default" ? chain.unsetFontSize() : chain.setFontSize(sizeToken(Number(value)))).run();
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Font size: ${current === "" ? "mixed" : shown}`}
              aria-haspopup="listbox"
              onMouseDown={(e) => e.preventDefault()}
              className="inline-flex h-8 w-[5.5rem] shrink-0 items-center justify-between gap-1 rounded-md border bg-background px-1.5 text-sm tabular-nums hover:bg-muted"
            >
              <span className="truncate">{shown}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Font size
          <span className="ml-1.5 text-muted-foreground">
            {MOD}+] / {MOD}+[
          </span>
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        className="w-28 p-1"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div role="listbox" aria-label="Font size" className="max-h-80 overflow-y-auto">
          {options.map((option) => {
            const isSelected = option.value === current;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => apply(option.value)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1 text-left text-sm tabular-nums hover:bg-muted",
                  isSelected && "bg-primary/10 text-primary"
                )}
              >
                {option.label}
                {isSelected ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FontMenu({ editor, current }: { editor: Editor; current: string | null }) {
  const [open, setOpen] = useState(false);
  const selected = FONT_FAMILIES.find((f) => fontFamilyToken(f.name) === current) ?? null;
  const options = [{ name: null, label: "Default" }, ...FONT_FAMILIES];
  const apply = (name: string | null) => {
    const chain = editor.chain().focus();
    (name ? chain.setFontFamily(fontFamilyToken(name)) : chain.unsetFontFamily()).run();
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Font: ${selected?.label ?? "Default"}`}
              aria-haspopup="listbox"
              onMouseDown={(e) => e.preventDefault()}
              className="inline-flex h-8 w-36 shrink-0 items-center justify-between gap-1 rounded-md border bg-background px-1.5 text-sm hover:bg-muted"
            >
              <span className="truncate" style={selected ? { fontFamily: fontFamilyToken(selected.name) } : undefined}>
                {selected?.label ?? "Default font"}
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Font
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        className="w-52 p-1"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div role="listbox" aria-label="Font">
          {options.map((font) => {
            const isSelected = (font.name ?? null) === (selected?.name ?? null);
            return (
              <button
                key={font.name ?? "default"}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => apply(font.name)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted",
                  isSelected && "bg-primary/10 text-primary"
                )}
                style={font.name ? { fontFamily: fontFamilyToken(font.name) } : undefined}
              >
                <span>
                  {font.label}
                  {font.name === "devanagari" ? <span className="ml-1.5 text-muted-foreground">हिंदी</span> : null}
                </span>
                {isSelected ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function RichTextEditorCore({
  value,
  onChange,
  placeholder,
  ariaLabel,
  invalid,
  minHeightClass = "min-h-[8rem]",
  maxLength = RICH_TEXT_PLAIN_MAX_LENGTH,
  previewClassName = DEFAULT_PREVIEW_CLASS,
}: RichTextEditorProps) {
  const lastEmitted = useRef<string>(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const openLinkRef = useRef<() => void>(() => {});
  const [html, setHtml] = useState(() => instructionToHtml(value));
  const [showPreview, setShowPreview] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        trailingNode: false,
        heading: { levels: [3, 4] },
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
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Subscript.extend({ excludes: "superscript" }),
      Superscript.extend({ excludes: "subscript" }),
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right"] }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      Extension.create({
        name: "instructionShortcuts",
        addKeyboardShortcuts() {
          return {
            "Mod-k": () => {
              openLinkRef.current();
              return true;
            },
            "Mod-]": () => stepSize(this.editor, 1),
            "Mod-[": () => stepSize(this.editor, -1),
          };
        },
      }),
    ],
    [placeholder]
  );

  const editor = useEditor(
    {
      extensions,
      content: instructionToHtml(value),
      immediatelyRender: true,
      shouldRerenderOnTransaction: false,
      editorProps: {
        attributes: {
          class: cn("rich-text-content max-h-[28rem] overflow-y-auto px-3 py-2 text-sm outline-none", minHeightClass),
          role: "textbox",
          "aria-multiline": "true",
          ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
        },
        transformPastedHTML: (pasted) => normalizeRichHtml(convertWordLists(pasted)),
      },
      onUpdate: ({ editor: ed }) => {
        const next = ed.isEmpty ? "" : ed.getHTML();
        lastEmitted.current = next;
        setHtml(next);
        onChangeRef.current(next);
      },
    },
    [extensions]
  );

  useEffect(() => {
    if (!editor || value === lastEmitted.current) return;
    const next = instructionToHtml(value);
    editor.commands.setContent(next, { emitUpdate: false });
    lastEmitted.current = value;
    setHtml(next);
  }, [editor, value]);

  const state = useEditorState({
    editor,
    selector: ({ editor: ed }) => ({
      bold: ed.isActive("bold"),
      italic: ed.isActive("italic"),
      underline: ed.isActive("underline"),
      strike: ed.isActive("strike"),
      subscript: ed.isActive("subscript"),
      superscript: ed.isActive("superscript"),
      bullet: ed.isActive("bulletList"),
      ordered: ed.isActive("orderedList"),
      link: ed.isActive("link"),
      size: selectionSize(ed),
      align: ed.isActive({ textAlign: "center" }) ? "center" : ed.isActive({ textAlign: "right" }) ? "right" : "left",
      color: (ed.getAttributes("textStyle").color as string | undefined) ?? null,
      font: (ed.getAttributes("textStyle").fontFamily as string | undefined) ?? null,
      highlight: (ed.getAttributes("highlight").color as string | undefined) ?? null,
      canUndo: ed.can().undo(),
      canRedo: ed.can().redo(),
      canSink: ed.can().sinkListItem("listItem"),
      canLift: ed.can().liftListItem("listItem"),
    }),
  });

  openLinkRef.current = () => {
    if (!editor) return;
    setLinkValue((editor.getAttributes("link").href as string | undefined) ?? "");
    setLinkError(null);
    setLinkOpen(true);
  };

  const applyLink = () => {
    if (!editor) return;
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

  const plainLength = useMemo(() => richTextToPlain(html).length, [html]);
  const overLimit = plainLength > maxLength;

  if (!editor || !state) return null;

  return (
    <div
      className={cn(
        "rich-text-editor overflow-hidden rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring",
        (invalid || overLimit) && "border-destructive"
      )}
    >
      <div
        className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 px-1.5 py-1"
        role="toolbar"
        aria-label="Formatting"
      >
        <ToolButton label="Undo" shortcut={`${MOD}+Z`} icon={<Undo2 className="h-4 w-4" />} disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()} />
        <ToolButton label="Redo" shortcut={`${MOD}+Shift+Z`} icon={<Redo2 className="h-4 w-4" />} disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()} />
        <Divider />
        <FontMenu editor={editor} current={state.font} />
        <SizeMenu editor={editor} current={state.size} />
        <Divider />
        <ToolButton label="Bold" shortcut={`${MOD}+B`} icon={<Bold className="h-4 w-4" />} active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()} />
        <ToolButton label="Italic" shortcut={`${MOD}+I`} icon={<Italic className="h-4 w-4" />} active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <ToolButton label="Underline" shortcut={`${MOD}+U`} icon={<Underline className="h-4 w-4" />} active={state.underline} onClick={() => editor.chain().focus().toggleUnderline().run()} />
        <ToolButton label="Strikethrough" shortcut={`${MOD}+Shift+S`} icon={<Strikethrough className="h-4 w-4" />} active={state.strike} onClick={() => editor.chain().focus().toggleStrike().run()} />
        <ToolButton label="Subscript" shortcut={`${MOD}+,`} icon={<SubscriptIcon className="h-4 w-4" />} active={state.subscript} onClick={() => editor.chain().focus().toggleSubscript().run()} />
        <ToolButton label="Superscript" shortcut={`${MOD}+.`} icon={<SuperscriptIcon className="h-4 w-4" />} active={state.superscript} onClick={() => editor.chain().focus().toggleSuperscript().run()} />
        <ColorMenu editor={editor} kind="text" current={state.color} />
        <ColorMenu editor={editor} kind="highlight" current={state.highlight} />
        <Divider />
        <ToolButton label="Bulleted list" shortcut={`${MOD}+Shift+8`} icon={<List className="h-4 w-4" />} active={state.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <ToolButton label="Numbered list" shortcut={`${MOD}+Shift+7`} icon={<ListOrdered className="h-4 w-4" />} active={state.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <ToolButton label="Decrease indent" shortcut="Shift+Tab" icon={<IndentDecrease className="h-4 w-4" />} disabled={!state.canLift} onClick={() => editor.chain().focus().liftListItem("listItem").run()} />
        <ToolButton label="Increase indent" shortcut="Tab" icon={<IndentIncrease className="h-4 w-4" />} disabled={!state.canSink} onClick={() => editor.chain().focus().sinkListItem("listItem").run()} />
        <Divider />
        <ToolButton label="Align left" shortcut={`${MOD}+Shift+L`} icon={<AlignLeft className="h-4 w-4" />} active={state.align === "left"} onClick={() => editor.chain().focus().unsetTextAlign().run()} />
        <ToolButton label="Align centre" shortcut={`${MOD}+Shift+E`} icon={<AlignCenter className="h-4 w-4" />} active={state.align === "center"} onClick={() => editor.chain().focus().setTextAlign("center").run()} />
        <ToolButton label="Align right" shortcut={`${MOD}+Shift+R`} icon={<AlignRight className="h-4 w-4" />} active={state.align === "right"} onClick={() => editor.chain().focus().setTextAlign("right").run()} />
        <Divider />
        <ToolButton label={state.link ? "Edit link" : "Add link"} shortcut={`${MOD}+K`} icon={<Link2 className="h-4 w-4" />} active={state.link} onClick={() => openLinkRef.current()} />
        {state.link && (
          <ToolButton label="Remove link" icon={<Link2Off className="h-4 w-4" />} onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()} />
        )}
        <ToolButton
          label="Clear formatting"
          icon={<RemoveFormatting className="h-4 w-4" />}
          onClick={() => editor.chain().focus().unsetAllMarks().unsetTextAlign().setParagraph().run()}
        />
      </div>

      {linkOpen && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 px-2 py-1.5">
          <label htmlFor={`${ariaLabel ?? "rte"}-link`} className="text-xs font-medium text-muted-foreground">
            Link
          </label>
          <input
            id={`${ariaLabel ?? "rte"}-link`}
            autoFocus
            type="text"
            inputMode="url"
            value={linkValue}
            placeholder="https://… or name@iitr.ac.in"
            onChange={(e) => {
              setLinkValue(e.target.value);
              setLinkError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setLinkOpen(false);
                editor.commands.focus();
              }
            }}
            className="h-8 min-w-[12rem] flex-1 rounded-md border bg-background px-2 text-sm"
          />
          <button type="button" onClick={applyLink} className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90">
            Apply
          </button>
          <button
            type="button"
            onClick={() => {
              setLinkOpen(false);
              editor.commands.focus();
            }}
            className="h-8 rounded-md px-2 text-xs hover:bg-muted"
          >
            Cancel
          </button>
          {linkError && <p className="w-full text-xs text-destructive">{linkError}</p>}
        </div>
      )}

      <EditorContent editor={editor} />

      <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-2 py-1 text-xs text-muted-foreground">
        <span className="hidden sm:inline">Enter: new paragraph · Shift+Enter: new line · Tab / Shift+Tab: indent a list item</span>
        <div className="ml-auto flex items-center gap-3">
          <span className={cn("tabular-nums", overLimit && "font-semibold text-destructive")} aria-live="polite">
            {plainLength.toLocaleString()} / {maxLength.toLocaleString()} characters
          </span>
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            aria-expanded={showPreview}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-foreground hover:bg-muted"
          >
            {showPreview ? <PencilLine className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showPreview ? "Hide preview" : "Preview"}
          </button>
        </div>
      </div>

      {showPreview && (
        <div className="border-t bg-muted/10 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">What users will see</p>
          {html ? (
            <div className={previewClassName} role="note">
              <RichTextContent value={html} />
            </div>
          ) : (
            <p className="text-xs italic text-muted-foreground">Nothing will be shown.</p>
          )}
        </div>
      )}
    </div>
  );
}
