import { EmptyState } from "@/components/states";

export default function MyMatches() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">My matches</h1>
      <EmptyState title="No matches yet" description="Join a tournament and hit “Find opponent” to play your first game." />
    </div>
  );
}
