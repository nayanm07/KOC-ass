"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
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
  { name: "Aarav Sharma", email: "aarav@koc.test", password: "Student@1234", role: "student" as const },
  { name: "Diya Patel", email: "diya@koc.test", password: "Student@1234", role: "student" as const },
  { name: "Kabir Singh", email: "kabir@koc.test", password: "Student@1234", role: "student" as const },
  { name: "Meera Iyer", email: "meera@koc.test", password: "Student@1234", role: "student" as const },
];

const FEATURES = [
  {
    icon: Zap,
    title: "Instant auto-matching",
    body: "Arena and round-robin pairing by standings — no waiting for a coach to pair you.",
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
    body: "Win 1 · Draw ½ · Loss 0, with Sonneborn-Berger tiebreaks and medals.",
    tone: "orange" as const,
  },
];

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
    <div className="flex items-center gap-4">
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-2xl bg-brand-orange text-white shadow-lg shadow-black/20",
          compact ? "size-11" : "size-14",
        )}
      >
        <Crown className={compact ? "size-6" : "size-7"} strokeWidth={2.4} />
      </span>
      <div>
        <p className={cn("leading-none font-extrabold tracking-tight", compact ? "text-2xl" : "text-[2.5rem]")}>
          <span className="text-white">KINGDOM</span> <span className="text-brand-orange">OF CHESS</span>
        </p>
        <p className="mt-1.5 font-mono text-[11px] tracking-[0.25em] text-sky-200/70 uppercase">Online chess academy</p>
      </div>
    </div>
  );
}

function BrandPanel() {
  return (
    <section
      className="relative hidden overflow-hidden bg-primary text-white lg:flex lg:flex-col lg:justify-between lg:p-16 xl:p-20"
      style={{
        // Subtle chessboard texture
        backgroundImage:
          "conic-gradient(rgba(255,255,255,0.045) 25%, transparent 0 50%, rgba(255,255,255,0.045) 0 75%, transparent 0)",
        backgroundSize: "96px 96px",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-primary/30 to-primary/80" />

      <div className="relative space-y-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 font-mono text-[11px] font-semibold tracking-[0.18em] text-sky-100/90 uppercase">
          <Crown className="size-3.5 text-brand-orange" /> Tournaments · Live play
        </span>
        <Wordmark />
      </div>

      <div className="relative max-w-xl space-y-6 py-12">
        <Eyebrow>Tournaments</Eyebrow>
        <h1 className="text-6xl leading-[0.95] font-extrabold tracking-tight xl:text-7xl">
          A tournament,
          <br />
          <span className="text-brand-orange italic">played live.</span>
        </h1>
        <p className="text-lg leading-relaxed text-sky-100/80">
          Join, get matched, play — and climb the tournament leaderboard in real time.
        </p>

        <ul className="space-y-3 pt-4">
          {FEATURES.map((f) => (
            <li
              key={f.title}
              className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm"
            >
              <span
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl",
                  f.tone === "orange" ? "bg-brand-orange text-white" : "bg-white/10 text-sky-100",
                )}
              >
                <f.icon className="size-5" />
              </span>
              <span>
                <span className="block font-semibold">{f.title}</span>
                <span className="block text-sm text-sky-100/70">{f.body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-5 py-4 text-sm">
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
  // State only mirrors the values for the demo-card highlight; submit reads the form itself.
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setEmail(emailRef.current?.value ?? "");
    setPassword(passwordRef.current?.value ?? "");
  }, []);

  const fill = (e: string, p: string) => {
    if (emailRef.current) emailRef.current.value = e;
    if (passwordRef.current) passwordRef.current.value = p;
    setEmail(e);
    setPassword(p);
  };

  const selected = DEMO_ACCOUNTS.find((a) => a.email === email && a.password === password)?.email;

  const fieldShell =
    "flex h-12 items-center gap-3 rounded-xl border border-input bg-[#fbf8f2] px-4 transition-colors focus-within:border-brand-orange focus-within:ring-3 focus-within:ring-brand-orange/25";

  return (
    <div className="w-full max-w-[34rem] rounded-3xl border border-border bg-card p-8 shadow-xl shadow-primary/5 sm:p-12">
      <Eyebrow>Sign in</Eyebrow>
      <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-primary">Welcome back</h2>
      <p className="mt-2 text-muted-foreground">Enter your academy email and password, or pick a demo account below.</p>

      <form
        className="mt-8 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          login.mutate({ email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") });
        }}
      >
        {login.isError && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
          >
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-semibold">Couldn’t sign you in</p>
              <p>{errorMessage(login.error)}</p>
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              className="rounded p-0.5 hover:bg-red-100"
              onClick={() => login.reset()}
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        <div className="space-y-2">
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
              className="h-full w-full bg-transparent text-primary outline-none placeholder:text-muted-foreground/70"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
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
              className="h-full w-full bg-transparent text-primary outline-none"
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
          disabled={login.isPending || login.isSuccess}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold tracking-[0.12em] text-primary-foreground uppercase shadow-lg shadow-primary/20 transition hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-brand-orange/40 focus-visible:outline-none disabled:opacity-70"
        >
          {login.isPending ? "Signing in…" : login.isSuccess ? "Redirecting…" : "Sign in"}
          {!login.isPending && !login.isSuccess && <ArrowRight className="size-4" />}
        </button>
      </form>

      <div className="my-8 flex items-center gap-4">
        <span className="h-px flex-1 bg-border" />
        <span className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">Or quick demo access</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-sm font-bold tracking-wide text-primary uppercase">Demo accounts</p>
        <p className="font-mono text-xs text-brand-orange">Click to fill</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {DEMO_ACCOUNTS.map((a, i) => {
          const active = selected === a.email;
          return (
            <button
              key={a.email}
              type="button"
              aria-pressed={active}
              onClick={() => {
                fill(a.email, a.password);
                login.reset();
              }}
              className={cn(
                "relative rounded-xl border p-3.5 text-left transition-colors focus-visible:ring-3 focus-visible:ring-brand-orange/40 focus-visible:outline-none",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-[#fbf8f2] hover:border-primary/40",
                i === DEMO_ACCOUNTS.length - 1 && DEMO_ACCOUNTS.length % 2 === 1 && "sm:col-span-2",
              )}
            >
              <span className="flex items-center gap-2 font-semibold">
                {a.role === "coach" ? (
                  <Crown className="size-4 text-brand-orange" />
                ) : (
                  <span aria-hidden className={active ? "text-white" : "text-primary"}>
                    ♟
                  </span>
                )}
                {a.name}
              </span>
              <span className={cn("mt-1 block font-mono text-[11px]", active ? "text-sky-100/80" : "text-muted-foreground")}>
                {a.role === "coach" ? "Coach" : "Student"} · {a.email}
              </span>
              {active && <CheckCircle2 className="absolute top-3.5 right-3.5 size-4 text-brand-orange" />}
            </button>
          );
        })}
      </div>

      <p className="mt-8 flex items-center justify-center gap-2 border-t pt-6 text-center text-sm text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0 text-brand-orange" />
        Built for young players aged 8–15.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <BrandPanel />
      <section className="flex flex-col items-center justify-center gap-8 px-4 py-10 sm:px-8">
        {/* Compact brand header on small screens (the panel is hidden there) */}
        <div className="w-full max-w-[34rem] rounded-3xl bg-primary p-6 text-white lg:hidden">
          <Wordmark compact />
          <p className="mt-5 text-3xl leading-tight font-extrabold tracking-tight">
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
