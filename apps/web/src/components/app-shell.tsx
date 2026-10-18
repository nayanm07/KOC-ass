"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Logo } from "@/components/logo";
import { SocketProvider, useSocket } from "@/components/socket-provider";
import { ErrorState, LoadingState } from "@/components/states";
import { homeFor, useLogout, useMe } from "@/hooks/use-auth";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

const NAV: Record<Role, { href: string; label: string }[]> = {
  coach: [{ href: "/coach", label: "Tournaments" }],
  student: [
    { href: "/student", label: "Tournaments" },
    { href: "/student/matches", label: "My matches" },
  ],
};

function ConnectionPill() {
  const { connection } = useSocket();
  const label = connection === "connected" ? "Live" : connection === "connecting" ? "Connecting…" : "Offline";
  return (
    <span
      className={cn(
        "hidden items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs font-medium md:inline-flex",
        connection === "connected" && "bg-emerald-50 text-emerald-700",
        connection === "connecting" && "bg-amber-50 text-amber-700",
        connection === "disconnected" && "bg-red-50 text-red-700",
      )}
      title={`Real-time connection: ${label}`}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          connection === "connected" ? "bg-emerald-500" : connection === "connecting" ? "animate-pulse bg-amber-500" : "bg-red-500",
        )}
      />
      {label}
    </span>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/**
 * Layout for signed-in areas. Frontend half of role enforcement: middleware redirects early,
 * and this re-checks against the verified /me response. `role` omitted = any signed-in user.
 */
export function AppShell({ role, children }: { role?: Role; children: React.ReactNode }) {
  const me = useMe();
  const logout = useLogout();
  const router = useRouter();
  const pathname = usePathname();

  const user = me.data;
  const wrongRole = !!user && !!role && user.role !== role;

  useEffect(() => {
    if (me.isSuccess && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (wrongRole && user) router.replace(homeFor(user.role));
  }, [me.isSuccess, user, wrongRole, router, pathname]);

  if (me.isPending) return <LoadingState label="Checking your session…" />;
  if (me.isError)
    return (
      <div className="mx-auto max-w-md p-8">
        <ErrorState error={me.error} onRetry={() => me.refetch()} />
      </div>
    );
  if (!user || wrongRole) return <LoadingState label="Redirecting…" />;

  const navRole = user.role;
  return (
    <SocketProvider userId={user.id}>
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:gap-8">
            <Link href={homeFor(navRole)} aria-label="Home">
              <Logo iconOnlyOnMobile />
            </Link>
            <nav className="flex h-full items-stretch gap-1">
              {NAV[navRole].map((item) => {
                const active = item.href === homeFor(navRole) ? pathname === item.href || pathname.startsWith(`${item.href}/tournaments`) : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative flex items-center px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-primary",
                      active && "text-primary",
                    )}
                  >
                    {item.label}
                    {active && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand-orange" />}
                  </Link>
                );
              })}
            </nav>
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <ConnectionPill />
              <span className="hidden h-6 w-px bg-border md:block" />
              <span
                className="flex size-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
                aria-hidden
              >
                {initials(user.name)}
              </span>
              <span className="hidden leading-tight sm:block">
                <span className="block text-sm font-semibold text-primary">{user.name}</span>
                <span className="block font-mono text-[10px] tracking-wider text-brand-orange uppercase">
                  {navRole === "coach" ? "♚ Coach" : "♟ Student"}
                </span>
              </span>
              <button
                type="button"
                aria-label="Log out"
                title="Log out"
                disabled={logout.isPending}
                onClick={() => logout.mutate()}
                className="ml-1 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>

        <footer className="border-t bg-[#f3eee4]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-sm">
            <span className="font-semibold text-primary">
              Kingdom of Chess <span className="font-normal text-muted-foreground">— Tournaments</span>
            </span>
            <span className="font-mono text-xs text-muted-foreground">© {new Date().getFullYear()} Kingdom of Chess</span>
          </div>
        </footer>
      </div>
    </SocketProvider>
  );
}
