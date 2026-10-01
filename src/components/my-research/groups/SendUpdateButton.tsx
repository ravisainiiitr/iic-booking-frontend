import { useState } from "react";
import { ChevronDown, Send } from "lucide-react";
import type { GroupUpdateRequest } from "@/lib/researchGroupTypes";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ResearchUpdateForm, type UnpromptedUpdateTarget } from "./ResearchUpdateForm";
import { leadName } from "./groupLabels";

export interface SendUpdateGroup {
  id: string;
  name: string;
  owner: { name: string };
}

interface Props {
  /** Active groups the student is a member (not a manager) of. */
  groups: SendUpdateGroup[];
  onSent?: (req: GroupUpdateRequest) => void;
  variant?: "default" | "outline";
  className?: string;
}

/** Lets a student send a progress update without being asked; picks the supervisor when they are in several groups. */
export function SendUpdateButton({ groups, onSent, variant = "outline", className = "" }: Props) {
  const [target, setTarget] = useState<UnpromptedUpdateTarget | null>(null);
  if (groups.length === 0) return null;

  const pick = (g: SendUpdateGroup) => setTarget({ groupId: g.id, groupName: g.name, supervisorName: leadName(g.owner.name) });
  const buttonClass = `h-10 gap-1.5 sm:h-8 ${className}`;

  return (
    <>
      {groups.length === 1 ? (
        <Button size="sm" variant={variant} className={buttonClass} onClick={() => pick(groups[0])}>
          <Send className="h-4 w-4" aria-hidden /> Send update
        </Button>
      ) : (
        // Non-modal so the dialog opened from an item does not inherit the menu's pointer lock.
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant={variant} className={buttonClass}>
              <Send className="h-4 w-4" aria-hidden /> Send update <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-w-[min(22rem,calc(100vw-2rem))]">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Send to</DropdownMenuLabel>
            {groups.map((g) => (
              <DropdownMenuItem key={g.id} onClick={() => pick(g)} className="flex-col items-start gap-0">
                <span className="font-medium">{leadName(g.owner.name)}</span>
                <span className="text-xs text-muted-foreground">{g.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <ResearchUpdateForm
        request={null}
        unprompted={target}
        onOpenChange={(open) => !open && setTarget(null)}
        onSubmitted={(req) => onSent?.(req)}
      />
    </>
  );
}
