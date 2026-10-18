import Link from "next/link";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <Logo className="text-lg" />
      <p className="text-6xl">♞</p>
      <h1 className="text-2xl font-semibold">That square is empty</h1>
      <p className="max-w-sm text-muted-foreground">The page you were looking for doesn’t exist or was moved.</p>
      <Link href="/" className={buttonVariants()}>
        Back to tournaments
      </Link>
    </main>
  );
}
