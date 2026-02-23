import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useState, useRef } from "react";
import { ChevronUp, ChevronDown, Trash2, Copy, Plus, Upload, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export type BlockRecord = Record<string, unknown>;

const BLOCK_TYPES: { value: string; label: string }[] = [
  { value: "heading", label: "Heading" },
  { value: "paragraph", label: "Paragraph" },
  { value: "image", label: "Image" },
  { value: "list", label: "List" },
  { value: "quote", label: "Quote" },
  { value: "divider", label: "Divider" },
  { value: "button", label: "Button" },
  { value: "spacer", label: "Spacer" },
  { value: "embed", label: "Embed (Video/iframe)" },
  { value: "html", label: "Custom HTML" },
  { value: "callout", label: "Callout / Alert" },
  { value: "columns", label: "Columns" },
  { value: "id_card", label: "ID Card" },
];

function defaultBlock(type: string): BlockRecord {
  switch (type) {
    case "heading":
      return { type: "heading", level: 1, text: "" };
    case "paragraph":
      return { type: "paragraph", text: "" };
    case "image":
      return { type: "image", url: "", alt: "", caption: "" };
    case "list":
      return { type: "list", ordered: false, items: [] };
    case "quote":
      return { type: "quote", text: "" };
    case "divider":
      return { type: "divider" };
    case "button":
      return { type: "button", buttonText: "", url: "", openInNewTab: false };
    case "spacer":
      return { type: "spacer", height: 24 };
    case "embed":
      return { type: "embed", url: "", embedType: "youtube" };
    case "html":
      return { type: "html", html: "" };
    case "callout":
      return { type: "callout", text: "", variant: "info" };
    case "columns":
      return { type: "columns", columnCount: 2, columns: [[], []] };
    case "id_card":
      return { type: "id_card", url: "", name: "", designation: "", email: "", location: "", contactNumber: "", role: "", resumeUrl: "", cardWidth: "", cardHeight: "" };
    default:
      return { type: "paragraph", text: "" };
  }
}

function updateBlockInList(
  list: BlockRecord[],
  index: number,
  updater: (b: BlockRecord) => BlockRecord
): BlockRecord[] {
  return list.map((b, i) => (i === index ? updater(b) : b));
}

interface CmsBlockEditorProps {
  content: BlockRecord[];
  onChange: (content: BlockRecord[]) => void;
  /** Nested mode: hide "Columns" option and simplify toolbar */
  nested?: boolean;
}

export function CmsBlockEditor({ content, onChange, nested = false }: CmsBlockEditorProps) {
  const { toast } = useToast();
  const [uploadingImageIdx, setUploadingImageIdx] = useState<number | null>(null);
  const [uploadingResumeIdx, setUploadingResumeIdx] = useState<number | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const resumeInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const blocks = Array.isArray(content) ? content : [];

  const insertAt = (index: number, block: BlockRecord) => {
    const next = [...blocks];
    next.splice(index, 0, block);
    onChange(next);
  };

  const removeAt = (index: number) => {
    onChange(blocks.filter((_, i) => i !== index));
  };

  const move = (index: number, dir: "up" | "down") => {
    const to = dir === "up" ? index - 1 : index + 1;
    if (to < 0 || to >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[to]] = [next[to], next[index]];
    onChange(next);
  };

  const duplicateAt = (index: number) => {
    const block = blocks[index];
    if (!block) return;
    insertAt(index + 1, { ...block });
  };

  const setBlock = (index: number, updater: (b: BlockRecord) => BlockRecord) => {
    onChange(updateBlockInList(blocks, index, updater));
  };

  const setColumnBlocks = (blockIndex: number, columnIndex: number, columnBlocks: BlockRecord[]) => {
    const block = blocks[blockIndex] as Record<string, unknown> & { columns?: BlockRecord[][] };
    if (block?.type !== "columns" || !Array.isArray(block.columns)) return;
    const newCols = [...(block.columns || [])];
    newCols[columnIndex] = columnBlocks;
    setBlock(blockIndex, () => ({ ...block, columns: newCols }));
  };

  const blockTypes = nested ? BLOCK_TYPES.filter((t) => t.value !== "columns") : BLOCK_TYPES;

  return (
    <div className="space-y-3">
      {blocks.map((block, idx) => {
        const type = String(block.type ?? "paragraph");
        const isColumns = type === "columns";
        const columnCount = Math.min(3, Math.max(2, Number((block as { columnCount?: number }).columnCount) || 2));
        const columns = (block as { columns?: BlockRecord[][] }).columns ?? Array.from({ length: columnCount }, () => []);

        return (
          <div key={idx} className="rounded-lg border border-border bg-card overflow-hidden">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 bg-muted/50 border-b border-border">
              <Select
                value={type}
                onValueChange={(v) => {
                  setBlock(idx, () => defaultBlock(v));
                }}
              >
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {blockTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-0.5 ml-auto">
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(idx, "up")} disabled={idx === 0}>
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(idx, "down")} disabled={idx === blocks.length - 1}>
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicateAt(idx)}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertAt(idx + 1, defaultBlock("paragraph"))}>
                  <Plus className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeAt(idx)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Block fields */}
            <div className="p-3 space-y-3">
              {type === "heading" && (
                <>
                  <div className="flex gap-2 items-center">
                    <Label className="text-xs">Level</Label>
                    <Select
                      value={String(block.level ?? 1)}
                      onValueChange={(v) => setBlock(idx, (b) => ({ ...b, level: Number(v) }))}
                    >
                      <SelectTrigger className="w-16 h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4].map((n) => (
                          <SelectItem key={n} value={String(n)}>H{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    value={String(block.text ?? "")}
                    onChange={(e) => setBlock(idx, (b) => ({ ...b, text: e.target.value }))}
                    placeholder="Heading text"
                  />
                </>
              )}

              {type === "paragraph" && (
                <Textarea
                  value={String(block.text ?? block.content ?? "")}
                  onChange={(e) => setBlock(idx, (b) => ({ ...b, text: e.target.value, content: e.target.value }))}
                  placeholder="Paragraph text (multiple lines supported)"
                  rows={3}
                  className="resize-y"
                />
              )}

              {type === "image" && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={(el) => { fileInputRefs.current[idx] = el; }}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="sr-only"
                      aria-hidden
                      disabled={uploadingImageIdx === idx}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingImageIdx(idx);
                        const res = await apiClient.uploadCmsPageImage(file);
                        setUploadingImageIdx(null);
                        e.target.value = "";
                        if (res.error) {
                          toast({ title: "Upload failed", description: res.error, variant: "destructive" });
                          return;
                        }
                        if (res.data?.url) setBlock(idx, (b) => ({ ...b, url: res.data!.url }));
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingImageIdx === idx}
                      onClick={() => fileInputRefs.current[idx]?.click()}
                    >
                      {uploadingImageIdx === idx ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Upload image
                    </Button>
                    <span className="text-xs text-muted-foreground">or paste URL below</span>
                  </div>
                  {block.url ? (
                    <div className="rounded border border-border overflow-hidden max-w-[200px]">
                      <img src={String(block.url)} alt="" className="w-full h-auto object-cover" />
                    </div>
                  ) : null}
                  <Input
                    value={String(block.url ?? "")}
                    onChange={(e) => setBlock(idx, (b) => ({ ...b, url: e.target.value }))}
                    placeholder="Image URL"
                  />
                  <Input
                    value={String(block.alt ?? "")}
                    onChange={(e) => setBlock(idx, (b) => ({ ...b, alt: e.target.value }))}
                    placeholder="Alt text (accessibility)"
                  />
                  <Input
                    value={String(block.caption ?? "")}
                    onChange={(e) => setBlock(idx, (b) => ({ ...b, caption: e.target.value }))}
                    placeholder="Caption (optional)"
                  />
                </div>
              )}

              {type === "list" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={block.ordered === true}
                      onCheckedChange={(c) => setBlock(idx, (b) => ({ ...b, ordered: !!c }))}
                    />
                    <Label className="text-xs">Numbered list</Label>
                  </div>
                  <Textarea
                    value={Array.isArray(block.items) ? block.items.join("\n") : ""}
                    onChange={(e) =>
                      setBlock(idx, (b) => ({ ...b, items: e.target.value.split("\n").filter(Boolean) }))
                    }
                    placeholder="One item per line"
                    rows={4}
                    className="font-mono text-sm"
                  />
                </div>
              )}

              {type === "quote" && (
                <Textarea
                  value={String(block.text ?? "")}
                  onChange={(e) => setBlock(idx, (b) => ({ ...b, text: e.target.value }))}
                  placeholder="Quote text"
                  rows={2}
                />
              )}

              {type === "divider" && <p className="text-xs text-muted-foreground">Horizontal line (no options).</p>}

              {type === "button" && (
                <div className="space-y-2">
                  <Input
                    value={String(block.buttonText ?? "")}
                    onChange={(e) => setBlock(idx, (b) => ({ ...b, buttonText: e.target.value }))}
                    placeholder="Button text"
                  />
                  <Input
                    value={String(block.url ?? "")}
                    onChange={(e) => setBlock(idx, (b) => ({ ...b, url: e.target.value }))}
                    placeholder="Link URL"
                  />
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={block.openInNewTab === true}
                      onCheckedChange={(c) => setBlock(idx, (b) => ({ ...b, openInNewTab: !!c }))}
                    />
                    <Label className="text-xs">Open in new tab</Label>
                  </div>
                </div>
              )}

              {type === "spacer" && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Height (px)</Label>
                  <Input
                    type="number"
                    min={8}
                    max={200}
                    value={String(block.height ?? 24)}
                    onChange={(e) => setBlock(idx, (b) => ({ ...b, height: Number(e.target.value) || 24 }))}
                    className="w-20"
                  />
                </div>
              )}

              {type === "embed" && (
                <div className="space-y-2">
                  <Select
                    value={String(block.embedType ?? "youtube")}
                    onValueChange={(v) => setBlock(idx, (b) => ({ ...b, embedType: v as "youtube" | "iframe" }))}
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="youtube">YouTube</SelectItem>
                      <SelectItem value="iframe">Generic iframe URL</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={String(block.url ?? "")}
                    onChange={(e) => setBlock(idx, (b) => ({ ...b, url: e.target.value }))}
                    placeholder={block.embedType === "iframe" ? "Iframe embed URL" : "YouTube video URL (e.g. https://www.youtube.com/watch?v=...)"}
                  />
                </div>
              )}

              {type === "html" && (
                <Textarea
                  value={String(block.html ?? "")}
                  onChange={(e) => setBlock(idx, (b) => ({ ...b, html: e.target.value }))}
                  placeholder="Custom HTML (use with care; avoid script tags)"
                  rows={6}
                  className="font-mono text-sm"
                />
              )}

              {type === "callout" && (
                <div className="space-y-2">
                  <Select
                    value={String(block.variant ?? "info")}
                    onValueChange={(v) => setBlock(idx, (b) => ({ ...b, variant: v }))}
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="default">Default</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea
                    value={String(block.text ?? "")}
                    onChange={(e) => setBlock(idx, (b) => ({ ...b, text: e.target.value }))}
                    placeholder="Callout / alert text"
                    rows={3}
                  />
                </div>
              )}

              {type === "id_card" && (
                <div className="space-y-3">
                  <Label className="text-xs font-medium">Photo</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={(el) => { fileInputRefs.current[idx] = el; }}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="sr-only"
                      aria-hidden
                      disabled={uploadingImageIdx === idx}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingImageIdx(idx);
                        const res = await apiClient.uploadCmsPageImage(file);
                        setUploadingImageIdx(null);
                        e.target.value = "";
                        if (res.error) {
                          toast({ title: "Upload failed", description: res.error, variant: "destructive" });
                          return;
                        }
                        if (res.data?.url) setBlock(idx, (b) => ({ ...b, url: res.data!.url }));
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      disabled={uploadingImageIdx === idx}
                      onClick={() => fileInputRefs.current[idx]?.click()}
                    >
                      {uploadingImageIdx === idx ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                      Upload photo
                    </Button>
                    <span className="text-xs text-muted-foreground">or URL</span>
                  </div>
                  {block.url ? (
                    <div className="rounded border border-border overflow-hidden max-w-[120px]">
                      <img src={String(block.url)} alt="" className="w-full h-auto object-cover aspect-square" />
                    </div>
                  ) : null}
                  <Input
                    value={String(block.url ?? "")}
                    onChange={(e) => setBlock(idx, (b) => ({ ...b, url: e.target.value }))}
                    placeholder="Image URL"
                  />
                  <Input
                    value={String(block.name ?? "")}
                    onChange={(e) => setBlock(idx, (b) => ({ ...b, name: e.target.value }))}
                    placeholder="Name"
                  />
                  <Input
                    value={String(block.designation ?? "")}
                    onChange={(e) => setBlock(idx, (b) => ({ ...b, designation: e.target.value }))}
                    placeholder="Designation"
                  />
                  <Input
                    value={String(block.email ?? "")}
                    onChange={(e) => setBlock(idx, (b) => ({ ...b, email: e.target.value }))}
                    placeholder="Email"
                    type="email"
                  />
                  <Input
                    value={String(block.location ?? "")}
                    onChange={(e) => setBlock(idx, (b) => ({ ...b, location: e.target.value }))}
                    placeholder="Location"
                  />
                  <Input
                    value={String(block.contactNumber ?? "")}
                    onChange={(e) => setBlock(idx, (b) => ({ ...b, contactNumber: e.target.value }))}
                    placeholder="Contact Number"
                  />
                  <Input
                    value={String(block.role ?? "")}
                    onChange={(e) => setBlock(idx, (b) => ({ ...b, role: e.target.value }))}
                    placeholder="Role"
                  />
                  <Input
                    value={String(block.cardWidth ?? "")}
                    onChange={(e) => setBlock(idx, (b) => ({ ...b, cardWidth: e.target.value.trim() || undefined }))}
                    placeholder="Card width (e.g. 320px, 20rem)"
                  />
                  <Input
                    value={String(block.cardHeight ?? "")}
                    onChange={(e) => setBlock(idx, (b) => ({ ...b, cardHeight: e.target.value.trim() || undefined }))}
                    placeholder="Card height (e.g. 200px, 16rem)"
                  />
                  <div className="space-y-2 pt-1 border-t border-border">
                    <Label className="text-xs font-medium">Resume (link opens when clicking image or name)</Label>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={(el) => { resumeInputRefs.current[idx] = el; }}
                        type="file"
                        accept=".pdf,application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        className="sr-only"
                        aria-hidden
                        disabled={uploadingResumeIdx === idx}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadingResumeIdx(idx);
                          const res = await apiClient.uploadCmsPageDocument(file);
                          setUploadingResumeIdx(null);
                          e.target.value = "";
                          if (res.error) {
                            toast({ title: "Upload failed", description: res.error, variant: "destructive" });
                            return;
                          }
                          if (res.data?.url) setBlock(idx, (b) => ({ ...b, resumeUrl: res.data!.url }));
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        disabled={uploadingResumeIdx === idx}
                        onClick={() => resumeInputRefs.current[idx]?.click()}
                      >
                        {uploadingResumeIdx === idx ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                        Upload resume
                      </Button>
                      <span className="text-xs text-muted-foreground">or paste URL below</span>
                    </div>
                    <Input
                      value={String(block.resumeUrl ?? "")}
                      onChange={(e) => setBlock(idx, (b) => ({ ...b, resumeUrl: e.target.value }))}
                      placeholder="Resume URL (hyperlink)"
                    />
                  </div>
                </div>
              )}

              {isColumns && (
                <div className="space-y-3">
                  <div className="flex gap-2 items-center">
                    <Label className="text-xs">Columns</Label>
                    <Select
                      value={String(columnCount)}
                      onValueChange={(v) => {
                        const n = Number(v) as 2 | 3;
                        const current = (block as { columns?: BlockRecord[][] }).columns ?? [[], []];
                        const newCols = Array.from({ length: n }, (_, i) => current[i] ?? []);
                        setBlock(idx, (b) => ({ ...b, columnCount: n, columns: newCols }));
                      }}
                    >
                      <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2 columns</SelectItem>
                        <SelectItem value="3">3 columns</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className={`grid gap-3 ${columnCount === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                    {columns.slice(0, columnCount).map((colBlocks, colIdx) => (
                      <div key={colIdx} className="rounded border border-dashed border-border p-3 min-h-[80px] min-w-[260px] bg-muted/30">
                        <Label className="text-xs text-muted-foreground block mb-2">Column {colIdx + 1}</Label>
                        <CmsBlockEditor
                          nested
                          content={colBlocks}
                          onChange={(newCol) => setColumnBlocks(idx, colIdx, newCol)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => insertAt(blocks.length, defaultBlock("paragraph"))}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add block
      </Button>
    </div>
  );
}
