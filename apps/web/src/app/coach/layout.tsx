import { AppShell } from "@/components/app-shell";

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="coach">{children}</AppShell>;
}
