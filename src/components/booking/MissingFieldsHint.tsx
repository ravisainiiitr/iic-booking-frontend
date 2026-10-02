import { Fragment } from "react";
import { Info } from "lucide-react";

type Props = {
  fields: Array<{ key: string; label: string }>;
  onFocusField: (key: string) => void;
};

/** "Fill in Number of samples and Sample type to see charges and available slots." — each name jumps to its field. */
export function MissingFieldsHint({ fields, onFocusField }: Props) {
  if (fields.length === 0) return null;
  return (
    <p
      className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground"
      data-testid="missing-fields-hint"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span>
        Fill in{" "}
        {fields.map((f, i) => (
          <Fragment key={f.key}>
            {i > 0 && (i === fields.length - 1 ? " and " : ", ")}
            <button
              type="button"
              className="font-medium text-primary underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              onClick={() => onFocusField(f.key)}
            >
              {f.label}
            </button>
          </Fragment>
        ))}{" "}
        to see charges and available slots.
      </span>
    </p>
  );
}

export default MissingFieldsHint;
