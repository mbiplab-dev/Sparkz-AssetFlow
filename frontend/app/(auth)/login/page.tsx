"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppIcon, DomainIcons } from "@/components/icons";
import { PasswordInput } from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api/http";
import { validateEmail, validatePassword } from "@/lib/auth/validation";
import { cn } from "@/lib/utils";

/** Seeded accounts from `make seed-dev` / `make init`. */
const DEMO_ACCOUNTS = [
  {
    id: "admin",
    label: "Demo Admin",
    description: "Full org setup & all modules",
    email: "admin@assetflow.local",
    password: "Admin@12345",
    icon: DomainIcons.secure,
    accent: "border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary",
  },
  {
    id: "asset_manager",
    label: "Demo Asset Manager",
    description: "Register, allocate, maintenance",
    email: "manager.eng@assetflow.local",
    password: "Demo@12345",
    icon: DomainIcons.assets,
    accent: "border-accent-teal/40 bg-accent-teal/10 hover:bg-accent-teal/15 text-accent-teal",
  },
  {
    id: "department_head",
    label: "Demo Dept Head",
    description: "Dept approvals & bookings",
    email: "head.it@assetflow.local",
    password: "Demo@12345",
    icon: DomainIcons.organization,
    accent:
      "border-accent-purple-deep/25 bg-accent-purple/15 hover:bg-accent-purple/25 text-accent-purple-deep",
  },
  {
    id: "employee",
    label: "Demo Employee",
    description: "Own assets, book, raise requests",
    email: "employee1@assetflow.local",
    password: "Demo@12345",
    icon: DomainIcons.people,
    accent:
      "border-accent-orange/35 bg-accent-orange/10 hover:bg-accent-orange/15 text-accent-orange-deep",
  },
] as const;

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [demoBusy, setDemoBusy] = useState<string | null>(null);

  async function handleDemoLogin(account: (typeof DEMO_ACCOUNTS)[number]) {
    setError(null);
    setFieldErrors({});
    setEmail(account.email);
    setPassword(account.password);
    setDemoBusy(account.id);
    setIsSubmitting(true);
    try {
      await login({ email: account.email, password: account.password });
      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Demo login failed. Seed data may be missing — run `make init` or `make seed-dev`.",
      );
    } finally {
      setIsSubmitting(false);
      setDemoBusy(null);
    }
  }

  function validate(): boolean {
    const next = {
      email: validateEmail(email) ?? undefined,
      password: validatePassword(password) ?? undefined,
    };
    setFieldErrors(next);
    return !next.email && !next.password;
  }

  async function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="border-border bg-card ring-border rounded-xl border p-0 shadow-none ring-1">
      <CardHeader className="gap-1.5 px-4 pt-5 pb-0 sm:px-6 sm:pt-6">
        <p className="font-display text-primary text-xs font-semibold tracking-wide uppercase">
          AssetFlow
        </p>
        <CardTitle className="font-display text-foreground text-xl font-bold tracking-tight sm:text-2xl">
          Log in
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Welcome back. Enter your email and password, or pick a demo role.
        </CardDescription>
      </CardHeader>

      <CardContent className="px-4 pt-5 sm:px-6 sm:pt-6">
        {error && (
          <div
            role="alert"
            className="border-destructive/20 bg-destructive/10 text-destructive mb-4 rounded-lg border px-3 py-2 text-sm"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <FieldGroup className="gap-4">
            <Field data-invalid={!!fieldErrors.email || undefined}>
              <FieldLabel htmlFor="login-email">Email</FieldLabel>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined }));
                }}
                placeholder="name@company.com"
                className="rounded-xs"
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
              />
              {fieldErrors.email && (
                <FieldError id="login-email-error">{fieldErrors.email}</FieldError>
              )}
            </Field>

            <Field data-invalid={!!fieldErrors.password || undefined}>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor="login-password">Password</FieldLabel>
                <Link
                  href="/forgot-password"
                  className="text-primary text-xs font-medium hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <PasswordInput
                id="login-password"
                value={password}
                onChange={(v) => {
                  setPassword(v);
                  if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined }));
                }}
                autoComplete="current-password"
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
              />
              {fieldErrors.password && (
                <FieldError id="login-password-error">{fieldErrors.password}</FieldError>
              )}
            </Field>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 h-10 w-full rounded-full text-sm font-medium"
            >
              {isSubmitting && !demoBusy ? "Logging in…" : "Log in"}
            </Button>
          </FieldGroup>
        </form>

        <div className="mt-5">
          <div className="mb-2.5 flex items-center gap-2">
            <div className="bg-border h-px flex-1" />
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Quick demo login
            </span>
            <div className="bg-border h-px flex-1" />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DEMO_ACCOUNTS.map((account) => {
              const busy = demoBusy === account.id;
              return (
                <button
                  key={account.id}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleDemoLogin(account)}
                  className={cn(
                    "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                    account.accent,
                  )}
                >
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-white/70 ring-1 ring-inset ring-black/[0.04]">
                    <AppIcon icon={account.icon} className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-ink block text-sm font-semibold">
                      {busy ? "Signing in…" : account.label}
                    </span>
                    <span className="text-ink-muted block text-[11px] leading-snug">
                      {account.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-muted-foreground mt-2 text-center text-[11px]">
            Requires seeded data — run <span className="font-mono">make init</span> or{" "}
            <span className="font-mono">make seed-dev</span>.
          </p>
        </div>
      </CardContent>

      <CardFooter className="border-border flex flex-col items-stretch gap-3 border-t bg-transparent px-4 py-4 sm:px-6 sm:py-5">
        <Link
          href="/login_otp"
          className="text-primary text-center text-sm font-medium hover:underline"
        >
          Log in with OTP instead
        </Link>
        <p className="text-muted-foreground text-center text-sm">
          New here?{" "}
          <Link href="/signup" className="text-primary font-medium hover:underline">
            Create account
          </Link>
        </p>
        <p className="text-muted-foreground text-center text-xs">
          Sign up creates an employee account — admin roles are assigned later.
        </p>
      </CardFooter>
    </Card>
  );
}
