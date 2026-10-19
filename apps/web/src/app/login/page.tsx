"use client";

import {
  AlertTriangle,
  ArrowRight,
  Check,
  Crown,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Radio,
  ShieldCheck,
  Timer,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useLogin } from "@/hooks/use-auth";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Seeded accounts (see README) — one click fills the form */
const DEMO_ACCOUNTS = [
  { name: "Coach Vikram", email: "coach@koc.test", password: "Coach@1234", role: "coach" as const },
  { name: "Aarav", email: "aarav@koc.test", password: "Student@1234", role: "student" as const },
  { name: "Diya", email: "diya@koc.test", password: "Student@1234", role: "student" as const },
  { name: "Kabir", email: "kabir@koc.test", password: "Student@1234", role: "student" as const },
  { name: "Meera", email: "meera@koc.test", password: "Student@1234", role: "student" as const },
];

const FEATURES = [
  {
    icon: Zap,
    title: "Instant auto-matching",
    body: "Arena and round-robin pairing by standings — no waiting for a coach.",
    tone: "orange" as const,
  },
  {
    icon: Timer,
    title: "One shared clock",
    body: "The server runs the clock, so both players always see the same time.",
    tone: "navy" as const,
  },
  {
    icon: Trophy,
    title: "Live leaderboard",
    body: "Win 1 · Draw ½ · Loss 0, Sonneborn-Berger tiebreaks and medals.",
    tone: "orange" as const,
  },
];

/** Hide decorative extras on short screens so the page never needs scrolling */
const SHORT = "[@media(max-height:820px)]:hidden";
const VERY_SHORT = "[@media(max-height:700px)]:hidden";

/** Monospace uppercase label with an em dash — the brand's eyebrow style */
function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("font-mono text-xs font-semibold tracking-[0.2em] text-brand-orange uppercase", className)}>
      — {children}
    </p>
  );
}

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3.5">
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-2xl bg-brand-orange text-white shadow-lg shadow-black/20",
          compact ? "size-10" : "size-12",
        )}
      >
        <Crown className={compact ? "size-5" : "size-6"} strokeWidth={2.4} />
      </span>
      <div>
        <p className={cn("leading-none font-extrabold tracking-tight", compact ? "text-xl" : "text-[2rem]")}>
          <span className="text-white">KINGDOM</span> <span className="text-brand-orange">OF CHESS</span>
        </p>
        <p className="mt-1.5 font-mono text-[10px] tracking-[0.25em] text-sky-200/70 uppercase">Online chess academy</p>
      </div>
    </div>
  );
}

function BrandPanel() {
  return (
    <section
      className="relative hidden overflow-hidden bg-primary text-white lg:flex lg:h-dvh lg:flex-col lg:justify-between lg:gap-6 lg:px-12 lg:py-10 xl:px-16"
      style={{
        // Subtle chessboard texture
        backgroundImage:
          "conic-gradient(rgba(255,255,255,0.045) 25%, transparent 0 50%, rgba(255,255,255,0.045) 0 75%, transparent 0)",
        backgroundSize: "88px 88px",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-primary/30 to-primary/80" />

      <div className="relative">
        <Wordmark />
      </div>

      <div className="relative max-w-xl space-y-5">
        <Eyebrow>Tournaments</Eyebrow>
        <h1 className="text-5xl leading-[0.95] font-extrabold tracking-tight xl:text-6xl [@media(max-height:700px)]:text-4xl">
          A tournament,
          <br />
          <span className="text-brand-orange italic">played live.</span>
        </h1>
        <p className="leading-relaxed text-sky-100/80 xl:text-lg">
          Join, get matched, play — and climb the tournament leaderboard in real time.
        </p>

        <ul className="space-y-2.5 pt-2">
          {FEATURES.map((f) => (
            <li
              key={f.title}
              className="flex items-center gap-3.5 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur-sm"
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl",
                  f.tone === "orange" ? "bg-brand-orange text-white" : "bg-white/10 text-sky-100",
                )}
              >
                <f.icon className="size-4.5" />
              </span>
              <span>
                <span className="block text-[15px] font-semibold">{f.title}</span>
                <span className={cn("block text-sm text-sky-100/70", SHORT)}>{f.body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div
        className={cn(
          "relative flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-5 py-3.5 text-sm",
          VERY_SHORT,
        )}
      >
        <span className="inline-flex items-center gap-3">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-orange opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-brand-orange" />
          </span>
          Moves sync live between both boards
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-brand-orange">
          <Radio className="size-3.5" /> Real-time
        </span>
      </div>
    </section>
  );
}

function LoginForm() {
  const next = useSearchParams().get("next");
  const login = useLogin(next);
  // Uncontrolled inputs: anything typed (or autofilled) before React hydrates is kept by the browser.
  // State only mirrors the values for the demo-chip highlight; submit reads the form itself.
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // Until React is interactive, a click would fall back to a native form submit — keep the button disabled
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setEmail(emailRef.current?.value ?? "");
    setPassword(passwordRef.current?.value ?? "");
    setReady(true);
  }, []);

  const fill = (e: string, p: string) => {
    if (emailRef.current) emailRef.current.value = e;
    if (passwordRef.current) passwordRef.current.value = p;
    setEmail(e);
    setPassword(p);
  };

  const selected = DEMO_ACCOUNTS.find((a) => a.email === email && a.password === password)?.email;

  const fieldShell =
    "flex h-11 items-center gap-3 rounded-xl border border-input bg-[#fbf8f2] px-4 transition-colors focus-within:border-brand-orange focus-within:ring-3 focus-within:ring-brand-orange/25";
  // Keep the cream field colour when Chrome autofills (it otherwise paints inputs light blue)
  const inputCls =
    "h-full w-full bg-transparent text-primary outline-none placeholder:text-muted-foreground/70 autofill:shadow-[inset_0_0_0_1000px_#fbf8f2] autofill:[-webkit-text-fill-color:var(--primary)]";

  return (
    <div className="w-full max-w-[30rem] rounded-3xl border border-border bg-card p-7 shadow-xl shadow-primary/5 sm:p-9">
      <Eyebrow>Sign in</Eyebrow>
      <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-primary">Welcome back</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">Use your academy email, or pick a demo account below.</p>

      <form
        // POST, never GET: even a pre-hydration native submit must not put credentials in the URL
        method="post"
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          login.mutate({ email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") });
        }}
      >
        {login.isError && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p className="flex-1 text-sm">
              <span className="font-semibold">Couldn’t sign you in. </span>
              {errorMessage(login.error)}
            </p>
            <button type="button" aria-label="Dismiss" className="rounded p-0.5 hover:bg-red-100" onClick={() => login.reset()}>
              <X className="size-4" />
            </button>
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Academy email
          </label>
          <div className={fieldShell}>
            <Mail className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={emailRef}
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@kingdomofchess.com"
              className={inputCls}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <div className={fieldShell}>
            <Lock className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={passwordRef}
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              className={inputCls}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="text-muted-foreground hover:text-primary"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((s) => !s)}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={!ready || login.isPending || login.isSuccess}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold tracking-[0.12em] text-primary-foreground uppercase shadow-lg shadow-primary/20 transition hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-brand-orange/40 focus-visible:outline-none disabled:opacity-70"
        >
          {login.isPending ? "Signing in…" : login.isSuccess ? "Redirecting…" : "Sign in"}
          {!login.isPending && !login.isSuccess && <ArrowRight className="size-4" />}
        </button>
      </form>

      <div className="my-5 flex items-center gap-4">
        <span className="h-px flex-1 bg-border" />
        <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Or quick demo access</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Demo accounts">
        {DEMO_ACCOUNTS.map((a) => {
          const active = selected === a.email;
          return (
            <button
              key={a.email}
              type="button"
              aria-pressed={active}
              title={`${a.role === "coach" ? "Coach" : "Student"} · ${a.email}`}
              onClick={() => {
                fill(a.email, a.password);
                login.reset();
              }}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-brand-orange/40 focus-visible:outline-none",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-[#fbf8f2] text-primary hover:border-primary/40",
              )}
            >
              {a.role === "coach" ? (
                <Crown className="size-3.5 text-brand-orange" />
              ) : (
                <span aria-hidden className="text-xs">
                  ♟
                </span>
              )}
              {a.name}
              {active && <Check className="size-3.5 text-brand-orange" />}
            </button>
          );
        })}
      </div>
      <p className="mt-2 font-mono text-[11px] text-muted-foreground">
        {selected ? `Filled ${selected} — press Sign in` : "Coach: Coach@1234 · Students: Student@1234"}
      </p>

      <p className={cn("mt-5 flex items-center justify-center gap-2 border-t pt-4 text-xs text-muted-foreground", VERY_SHORT)}>
        <ShieldCheck className="size-3.5 shrink-0 text-brand-orange" />
        Built for young players aged 8–15.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh lg:h-dvh lg:grid-cols-2 lg:overflow-hidden">
      <BrandPanel />
      {/* Each column fits the viewport; only the form column may scroll on very short screens */}
      <section className="flex flex-col items-center justify-center gap-5 px-4 py-6 sm:px-8 lg:h-dvh lg:overflow-y-auto">
        {/* Compact brand header on small screens (the panel is hidden there) */}
        <div className="w-full max-w-[30rem] rounded-3xl bg-primary px-6 py-5 text-white lg:hidden">
          <Wordmark compact />
          <p className="mt-3 text-2xl leading-tight font-extrabold tracking-tight">
            A tournament, <span className="text-brand-orange italic">played live.</span>
          </p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
