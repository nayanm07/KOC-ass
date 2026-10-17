import { EmptyState } from "@/components/states";

export default function CoachHome() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tournaments</h1>
      <EmptyState title="Tournament management" description="Create and manage tournaments — coming in the next step." />
    </div>
  );
}
