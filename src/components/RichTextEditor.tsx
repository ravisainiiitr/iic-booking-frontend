import { useEffect, useRef, type ReactNode } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  List,
  ListOrdered,
  RemoveFormatting,
  Strikethrough,
  Underline,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { looksLikeRichHtml, sanitizeRichHtml } from "@/lib/richText";

const FONT_FAMILIES = [
  "Arial",
  "Calibri",
  "Cambria",
  "Georgia",
  "Times New Roman",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Courier New",
];

/** execCommand font sizes 1–7, labelled with their approximate point sizes like a word processor. */
const FONT_SIZES = [
  { value: "1", label: "8" },
  { value: "2", label: "10" },
  { value: "3", label: "12" },
  { value: "4", label: "14" },
  { value: "5", label: "18" },
  { value: "6", label: "24" },
  { value: "7", label: "36" },
];

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function toEditorHtml(value: string): string {
  if (!value) return "";
  if (looksLikeRichHtml(value)) return sanitizeRichHtml(value);
  return escapeHtml(value).replace(/\n/g, "<br>");
}

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  invalid?: boolean;
  minHeightClass?: string;
};

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  ariaLabel,
  invalid,
  minHeightClass = "min-h-[7rem]",
}: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef<string>("");
  const savedRange = useRef<Range | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value === lastEmitted.current) return;
    el.innerHTML = toEditorHtml(value);
    lastEmitted.current = value;
  }, [value]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const text = (el.textContent || "").trim();
    const html = text ? sanitizeRichHtml(el.innerHTML) : "";
    lastEmitted.current = html;
    onChange(html);
  };

  const saveSelection = () => {
    const sel = window.getSelection();
    const el = ref.current;
    if (!sel || sel.rangeCount === 0 || !el) return;
    const range = sel.getRangeAt(0);
    if (el.contains(range.commonAncestorContainer)) savedRange.current = range.cloneRange();
  };

  const exec = (command: string, arg?: string) => {
    ref.current?.focus();
    const sel = window.getSelection();
    if (savedRange.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    document.execCommand("styleWithCSS", false, command === "fontSize" ? "false" : "true");
    document.execCommand(command, false, arg);
    emit();
  };

  const toolButton = (label: string, icon: ReactNode, command: string) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => exec(command)}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground hover:bg-muted"
    >
      {icon}
    </button>
  );

  return (
    <div
      className={cn(
        "rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring",
        invalid && "border-destructive"
      )}
    >
      <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 px-2 py-1.5" role="toolbar" aria-label="Formatting">
        <select
          aria-label="Font"
          title="Font"
          className="h-8 rounded-md border bg-background px-2 text-sm"
          defaultValue=""
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            if (e.target.value) exec("fontName", e.target.value);
            e.target.value = "";
          }}
        >
          <option value="">Font</option>
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f} style={{ fontFamily: f }}>
              {f}
            </option>
          ))}
        </select>
        <select
          aria-label="Font size"
          title="Font size"
          className="h-8 rounded-md border bg-background px-2 text-sm"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) exec("fontSize", e.target.value);
            e.target.value = "";
          }}
        >
          <option value="">Size</option>
          {FONT_SIZES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        {toolButton("Bold", <Bold className="h-4 w-4" />, "bold")}
        {toolButton("Italic", <Italic className="h-4 w-4" />, "italic")}
        {toolButton("Underline", <Underline className="h-4 w-4" />, "underline")}
        {toolButton("Strikethrough", <Strikethrough className="h-4 w-4" />, "strikeThrough")}
        <label
          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md px-1.5 text-xs hover:bg-muted"
          title="Font colour"
          onMouseDown={(e) => e.preventDefault()}
        >
          <span className="font-semibold underline decoration-2">A</span>
          <input
            type="color"
            aria-label="Font colour"
            className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
            defaultValue="#b91c1c"
            onChange={(e) => exec("foreColor", e.target.value)}
          />
        </label>
        <label
          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md px-1.5 text-xs hover:bg-muted"
          title="Highlight colour"
          onMouseDown={(e) => e.preventDefault()}
        >
          <span className="rounded bg-yellow-200 px-1 font-semibold text-black">ab</span>
          <input
            type="color"
            aria-label="Highlight colour"
            className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
            defaultValue="#fef08a"
            onChange={(e) => exec("hiliteColor", e.target.value)}
          />
        </label>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        {toolButton("Bulleted list", <List className="h-4 w-4" />, "insertUnorderedList")}
        {toolButton("Numbered list", <ListOrdered className="h-4 w-4" />, "insertOrderedList")}
        {toolButton("Align left", <AlignLeft className="h-4 w-4" />, "justifyLeft")}
        {toolButton("Align centre", <AlignCenter className="h-4 w-4" />, "justifyCenter")}
        {toolButton("Align right", <AlignRight className="h-4 w-4" />, "justifyRight")}
        {toolButton("Clear formatting", <RemoveFormatting className="h-4 w-4" />, "removeFormat")}
      </div>
      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={() => {
          saveSelection();
          emit();
        }}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        onBlur={saveSelection}
        className={cn(
          "max-h-[24rem] overflow-y-auto px-3 py-2 text-sm outline-none [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6",
          "empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]",
          minHeightClass
        )}
      />
    </div>
  );
}
