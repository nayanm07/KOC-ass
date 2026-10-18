"use client";

import { useEffect } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

/** Route-level error boundary: an unexpected render error never leaves a blank screen */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <Logo className="text-lg" />
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-sm text-muted-foreground">
        An unexpected error occurred. Your games are safe on the server — try again.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => (window.location.href = "/")}>
          Go home
        </Button>
      </div>
    </main>
  );
}
