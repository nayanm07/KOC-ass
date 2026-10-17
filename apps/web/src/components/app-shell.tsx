"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Logo } from "@/components/logo";
import { SocketProvider, useSocket } from "@/components/socket-provider";
import { ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

function ConnectionDot() {
  const { connection } = useSocket();
  const label = connection === "connected" ? "Live" : connection === "connecting" ? "Connecting…" : "Offline";
  return (
    <span className="hidden items-center gap-1.5 text-xs text-muted-foreground md:inline-flex" title={`Real-time connection: ${label}`}>
      <span
        className={cn(
          "size-2 rounded-full",
          connection === "connected" ? "bg-emerald-500" : connection === "connecting" ? "animate-pulse bg-amber-400" : "bg-red-500",
        )}
      />
      {label}
    </span>
  );
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
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link href={homeFor(navRole)}>
            <Logo />
          </Link>
          <nav className="flex gap-1">
            {NAV[navRole].map((item) => {
              const active = item.href === homeFor(navRole) ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-accent",
                    active && "bg-accent font-medium text-accent-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <ConnectionDot />
            <span className="hidden text-sm sm:inline">{user.name}</span>
            <Badge variant={navRole === "coach" ? "default" : "secondary"} className="capitalize">
              {navRole === "coach" ? "♚ Coach" : "♟ Student"}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Log out"
              title="Log out"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
    </SocketProvider>
  );
}
