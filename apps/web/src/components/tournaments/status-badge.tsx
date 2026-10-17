import { Badge } from "@/components/ui/badge";
import type { TournamentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: Record<TournamentStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  open: { label: "Registration open", className: "bg-sky-100 text-sky-800" },
  ongoing: { label: "● Live", className: "bg-emerald-100 text-emerald-800" },
  completed: { label: "Completed", className: "bg-amber-100 text-amber-900" },
};

export function TournamentStatusBadge({ status }: { status: TournamentStatus }) {
  const s = STYLES[status];
  return (
    <Badge variant="outline" className={cn("border-transparent", s.className)}>
      {s.label}
    </Badge>
  );
}
