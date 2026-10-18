import { Trophy } from "lucide-react";
import type { TournamentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("font-mono text-[11px] font-semibold tracking-[0.2em] text-brand-orange uppercase", className)}>
      — {children}
    </p>
  );
}

/** White rounded panel with optional eyebrow, title, subtitle and right-hand slot */
export function Panel({
  eyebrow,
  title,
  subtitle,
  right,
  children,
  className,
}: {
  eyebrow?: string;
  title?: string;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border bg-card p-5 shadow-sm sm:p-7", className)}>
      {(title || eyebrow || right) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            {eyebrow && <Eyebrow className="mb-1.5">{eyebrow}</Eyebrow>}
            {title && <h2 className="text-xl font-bold tracking-tight text-primary sm:text-2xl">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** Initials avatar; top-3 get medal-ish tones */
export function Avatar({ name, rank }: { name: string; rank?: number }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
        rank === 1 && "bg-primary text-primary-foreground",
        rank === 2 && "bg-[#b4510d] text-white",
        rank === 3 && "bg-[#e7e0d2] text-primary",
        (!rank || rank > 3) && "bg-[#f1ece2] text-primary",
      )}
    >
      {initials(name)}
    </span>
  );
}

export const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

/** 1.5 → "1½", 0.5 → "½" */
export function formatPoints(p: number): string {
  const whole = Math.floor(p);
  const half = p - whole >= 0.5;
  if (!half) return String(whole);
  return whole === 0 ? "½" : `${whole}½`;
}

/** "1 pt", "2½ pts" */
export const ptsLabel = (p: number) => `${formatPoints(p)} pt${p === 1 ? "" : "s"}`;

export const STATUS_PILL: Record<TournamentStatus, { label: string; cls: string }> = {
  ongoing: { label: "Live", cls: "bg-emerald-50 text-emerald-700" },
  open: { label: "Registration open", cls: "bg-sky-50 text-sky-700" },
  draft: { label: "Draft", cls: "bg-slate-100 text-slate-600" },
  completed: { label: "Completed", cls: "bg-amber-50 text-amber-800" },
};

export function StatusPill({ status, className }: { status: TournamentStatus; className?: string }) {
  const p = STATUS_PILL[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs font-medium", p.cls, className)}>
      {status === "completed" ? <Trophy className="size-3.5" /> : <span className="size-1.5 rounded-full bg-current" />}
      {p.label}
    </span>
  );
}

/** Result chip in mono: 1–0 / 0–1 / ½–½ */
export function ResultChip({ result }: { result: "white_win" | "black_win" | "draw" }) {
  const text = result === "white_win" ? "1–0" : result === "black_win" ? "0–1" : "½–½";
  return (
    <span
      className={cn(
        "inline-flex min-w-12 justify-center rounded-md px-2 py-1 font-mono text-sm font-semibold",
        result === "draw" ? "bg-sky-50 text-sky-700" : "bg-[#f1ece2] text-primary",
      )}
    >
      {text}
    </span>
  );
}

export const btn = {
  primary:
    "inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-60",
  orange:
    "inline-flex h-10 items-center gap-2 rounded-xl bg-brand-orange px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-orange/90 disabled:cursor-not-allowed disabled:opacity-50",
  soft: "inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-medium text-primary transition hover:bg-accent disabled:opacity-60",
  danger:
    "inline-flex h-10 items-center gap-2 rounded-xl bg-red-50 px-4 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-60",
  icon: "inline-flex size-10 items-center justify-center rounded-xl border border-border bg-white text-primary transition hover:bg-accent",
};
