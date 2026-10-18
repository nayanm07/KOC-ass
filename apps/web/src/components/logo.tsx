import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Brand mark: orange crown tile + "KINGDOM OF CHESS" wordmark. `tone="dark"` for navy backgrounds. */
export function Logo({
  className = "",
  tone = "light",
  iconOnlyOnMobile = false,
}: {
  className?: string;
  tone?: "light" | "dark";
  /** Hide the wordmark below the sm breakpoint (tight headers) */
  iconOnlyOnMobile?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-orange text-white shadow-sm">
        <Crown className="size-4.5" strokeWidth={2.4} />
      </span>
      <span className={cn("leading-none", iconOnlyOnMobile && "max-sm:hidden")}>
        <span className="block text-[15px] font-extrabold tracking-tight">
          <span className="text-brand-orange">KINGDOM</span>{" "}
          <span className={tone === "dark" ? "text-white" : "text-primary"}>OF CHESS</span>
        </span>
        <span
          className={cn(
            "mt-1 block font-mono text-[9px] tracking-[0.22em] uppercase",
            tone === "dark" ? "text-sky-200/70" : "text-muted-foreground",
          )}
        >
          Tournaments
        </span>
      </span>
    </span>
  );
}
