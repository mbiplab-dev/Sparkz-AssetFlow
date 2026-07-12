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
import {
  normalizePhone,
  validateEmail,
  validateFullName,
  validatePassword,
  validatePhone,
} from "@/lib/auth/validation";

type FieldKey = "fullName" | "email" | "phone" | "password";

export default function SignupPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function clearFieldError(key: FieldKey) {
    setFieldErrors((f) => {
      if (!f[key]) return f;
      const next = { ...f };
      delete next[key];
      return next;
    });
  }

  function validateForm(): boolean {
    const next: Partial<Record<FieldKey, string>> = {};
    const nameErr = validateFullName(fullName);
    const emailErr = validateEmail(email);
    const phoneErr = validatePhone(phone);
    const passwordErr = validatePassword(password);
    if (nameErr) next.fullName = nameErr;
    if (emailErr) next.email = emailErr;
    if (phoneErr) next.phone = phoneErr;
    if (passwordErr) next.password = passwordErr;
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault();
    setError(null);
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await register({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: normalizePhone(phone),
        password,
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="rounded-xl border border-border bg-card p-0 shadow-none ring-1 ring-border">
      <CardHeader className="gap-1.5 px-4 pt-5 pb-0 sm:px-6 sm:pt-6">
        <p className="font-display text-xs font-semibold tracking-wide text-primary uppercase">
          AssetFlow
        </p>
        <CardTitle className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Create account
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Sign up creates an employee account — admin roles are assigned later.
        </CardDescription>
      </CardHeader>

      <CardContent className="px-4 pt-5 sm:px-6 sm:pt-6">
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
            <Field data-invalid={!!fieldErrors.fullName || undefined}>
              <FieldLabel htmlFor="signup-full-name">Full name</FieldLabel>
              <Input
                id="signup-full-name"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  clearFieldError("fullName");
                }}
                placeholder="Jane Doe"
                className="rounded-xs"
                aria-invalid={!!fieldErrors.fullName}
                aria-describedby={fieldErrors.fullName ? "signup-full-name-error" : undefined}
              />
              {fieldErrors.fullName && (
                <FieldError id="signup-full-name-error">{fieldErrors.fullName}</FieldError>
              )}
            </Field>

            <Field data-invalid={!!fieldErrors.email || undefined}>
              <FieldLabel htmlFor="signup-email">Email</FieldLabel>
              <Input
                id="signup-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearFieldError("email");
                }}
                placeholder="name@company.com"
                className="rounded-xs"
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? "signup-email-error" : undefined}
              />
              {fieldErrors.email && (
                <FieldError id="signup-email-error">{fieldErrors.email}</FieldError>
              )}
            </Field>

            <Field data-invalid={!!fieldErrors.phone || undefined}>
              <FieldLabel htmlFor="signup-phone">Phone number</FieldLabel>
              <Input
                id="signup-phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  clearFieldError("phone");
                }}
                placeholder="+1 555 123 4567"
                className="rounded-xs"
                aria-invalid={!!fieldErrors.phone}
                aria-describedby={fieldErrors.phone ? "signup-phone-error" : undefined}
              />
              {fieldErrors.phone && (
                <FieldError id="signup-phone-error">{fieldErrors.phone}</FieldError>
              )}
            </Field>

            <Field data-invalid={!!fieldErrors.password || undefined}>
              <FieldLabel htmlFor="signup-password">Password</FieldLabel>
              <PasswordInput
                id="signup-password"
                value={password}
                onChange={(v) => {
                  setPassword(v);
                  clearFieldError("password");
                }}
                autoComplete="new-password"
                aria-invalid={!!fieldErrors.password}
                aria-describedby={
                  fieldErrors.password ? "signup-password-error" : "signup-password-hint"
                }
              />
              {fieldErrors.password ? (
                <FieldError id="signup-password-error">{fieldErrors.password}</FieldError>
              ) : (
                <p id="signup-password-hint" className="text-xs text-muted-foreground">
                  Minimum 8 characters.
                </p>
              )}
            </Field>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 h-10 w-full rounded-full text-sm font-medium"
            >
              {isSubmitting ? "Creating account…" : "Create account"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>

      <CardFooter className="flex flex-col items-stretch border-t border-border bg-transparent px-4 py-4 sm:px-6 sm:py-5">
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
