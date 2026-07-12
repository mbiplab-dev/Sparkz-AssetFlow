"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    <Card className="rounded-xl border border-border bg-card p-0 shadow-none ring-1 ring-border">
      <CardHeader className="gap-1.5 px-6 pt-6 pb-0">
        <p className="font-display text-xs font-semibold tracking-wide text-primary uppercase">
          AssetFlow
        </p>
        <CardTitle className="font-display text-2xl font-bold tracking-tight text-foreground">
          Log in
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Welcome back. Enter your email and password.
        </CardDescription>
      </CardHeader>

      <CardContent className="px-6 pt-6">
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
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
                  className="text-xs font-medium text-primary hover:underline"
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
              {isSubmitting ? "Logging in…" : "Log in"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>

      <CardFooter className="flex flex-col items-stretch gap-3 border-t border-border bg-transparent px-6 py-5">
        <Link
          href="/login_otp"
          className="text-center text-sm font-medium text-primary hover:underline"
        >
          Log in with OTP instead
        </Link>
        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Create account
          </Link>
        </p>
        <p className="text-center text-xs text-muted-foreground">
          Sign up creates an employee account — admin roles are assigned later.
        </p>
      </CardFooter>
    </Card>
  );
}
