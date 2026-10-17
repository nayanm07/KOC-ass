import { EmptyState } from "@/components/states";

export default function StudentHome() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tournaments</h1>
      <EmptyState title="Browse tournaments" description="Join open tournaments and find opponents — coming in the next step." />
    </div>
  );
}
