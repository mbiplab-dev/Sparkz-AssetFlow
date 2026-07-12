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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/http";
import { confirmPasswordReset, requestPasswordResetOtp } from "@/lib/auth/authApi";
import { useCountdown } from "@/lib/hooks/useCountdown";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { secondsRemaining, start } = useCountdown();

  const [step, setStep] = useState<"email" | "otp" | "password">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRequestOtp(e: React.SubmitEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await requestPasswordResetOtp(email);
      setStep("otp");
      start(60);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleContinueFromCode(e: React.SubmitEvent) {
    e.preventDefault();
    setError(null);
    setStep("password");
  }

  async function handleResend() {
    setError(null);
    try {
      await requestPasswordResetOtp(email);
      start(60);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  async function handleConfirm(e: React.SubmitEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await confirmPasswordReset({ email, code, newPassword });
      router.push("/login");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const description =
    step === "email"
      ? "Enter your email to receive a reset code."
      : step === "otp"
        ? `Enter the code sent to ${email}.`
        : "Choose a new password.";

  return (
    <Card className="rounded-xl border border-border bg-card p-0 shadow-none ring-1 ring-border">
      <CardHeader className="gap-1.5 px-4 pt-5 pb-0 sm:px-6 sm:pt-6">
        <p className="font-display text-xs font-semibold tracking-wide text-primary uppercase">
          AssetFlow
        </p>
        <CardTitle className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Reset your password
        </CardTitle>
        <CardDescription className="text-muted-foreground break-words">
          {description}
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

        {step === "email" && (
          <form onSubmit={handleRequestOtp} noValidate>
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="reset-email">Email</FieldLabel>
                <Input
                  id="reset-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="rounded-xs"
                />
              </Field>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="mt-1 h-10 w-full rounded-full text-sm font-medium"
              >
                {isSubmitting ? "Sending…" : "Send reset code"}
              </Button>
            </FieldGroup>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleContinueFromCode} noValidate>
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="reset-code">One-time code</FieldLabel>
                <Input
                  id="reset-code"
                  type="text"
                  inputMode="numeric"
                  required
                  minLength={6}
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="rounded-xs tracking-widest"
                  placeholder="123456"
                />
              </Field>
              <Button type="submit" className="mt-1 h-10 w-full rounded-full text-sm font-medium">
                Continue
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleResend}
                disabled={secondsRemaining > 0}
                className="w-full"
              >
                {secondsRemaining > 0 ? `Resend code (${secondsRemaining}s)` : "Resend code"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setError(null);
                  setStep("email");
                }}
                className="w-full"
              >
                Use a different email
              </Button>
            </FieldGroup>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={handleConfirm} noValidate>
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="reset-new-password">New password</FieldLabel>
                <PasswordInput
                  id="reset-new-password"
                  value={newPassword}
                  onChange={setNewPassword}
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="reset-confirm-password">Confirm new password</FieldLabel>
                <PasswordInput
                  id="reset-confirm-password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
              </Field>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="mt-1 h-10 w-full rounded-full text-sm font-medium"
              >
                {isSubmitting ? "Resetting…" : "Reset password"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setError(null);
                  setStep("otp");
                }}
                className="w-full"
              >
                Back
              </Button>
            </FieldGroup>
          </form>
        )}
      </CardContent>

      <CardFooter className="flex flex-col items-stretch border-t border-border bg-transparent px-4 py-4 sm:px-6 sm:py-5">
        <p className="text-center text-sm text-muted-foreground">
          Remembered your password?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
