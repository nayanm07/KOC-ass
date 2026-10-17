"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Logo } from "@/components/logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogin } from "@/hooks/use-auth";
import { errorMessage } from "@/lib/api";

const DEMO_ACCOUNTS = [
  { label: "Coach", email: "coach@koc.test", password: "Coach@1234" },
  { label: "Aarav", email: "aarav@koc.test", password: "Student@1234" },
  { label: "Diya", email: "diya@koc.test", password: "Student@1234" },
  { label: "Kabir", email: "kabir@koc.test", password: "Student@1234" },
  { label: "Meera", email: "meera@koc.test", password: "Student@1234" },
];

function LoginForm() {
  const next = useSearchParams().get("next");
  const login = useLogin(next);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="space-y-3 text-center">
        <Logo className="mx-auto text-lg" />
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to play and manage tournaments</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            login.mutate({ email, password });
          }}
        >
          {login.isError && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(login.error)}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={login.isPending || login.isSuccess}>
            {login.isPending ? "Signing in…" : login.isSuccess ? "Redirecting…" : "Sign in"}
          </Button>
        </form>

        <div className="space-y-2 border-t pt-4">
          <p className="text-xs text-muted-foreground">Demo accounts (seeded) — click to fill:</p>
          <div className="flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map((a) => (
              <Button
                key={a.email}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEmail(a.email);
                  setPassword(a.password);
                }}
              >
                {a.label}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
