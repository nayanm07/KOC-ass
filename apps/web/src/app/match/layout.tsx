import { AppShell } from "@/components/app-shell";

/** Players and (coach) spectators — any signed-in role; the API enforces who may see which match */
export default function MatchLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
