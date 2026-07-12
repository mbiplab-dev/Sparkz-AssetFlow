"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { validateEmail } from "@/lib/auth/validation";
import { useCountdown } from "@/lib/hooks/useCountdown";

export default function LoginOtpPage() {
  const { requestLoginOtp, verifyLoginOtp } = useAuth();
  const router = useRouter();
  const { secondsRemaining, start } = useCountdown();

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [otpError, setOtpError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSendOtp(e: React.SubmitEvent) {
    e.preventDefault();
    setError(null);

    const emailErr = validateEmail(email);
    if (emailErr) {
      setEmailError(emailErr);
      return;
    }
    setEmailError(undefined);

    setIsSubmitting(true);
    try {
      await requestLoginOtp(email.trim());
      setStep("otp");
      start(60);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerify(e: React.SubmitEvent) {
    e.preventDefault();
    setError(null);

    const code = otp.trim();
    if (!/^\d{6}$/.test(code)) {
      setOtpError("Enter the 6-digit code from your email.");
      return;
    }
    setOtpError(undefined);

    setIsSubmitting(true);
    try {
      await verifyLoginOtp({ email: email.trim(), code });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    setError(null);
    try {
      await requestLoginOtp(email.trim());
      start(60);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  function handleBackToEmail() {
    setError(null);
    setOtpError(undefined);
    setOtp("");
    setStep("email");
  }

  return (
    <Card className="border-border bg-card ring-border rounded-xl border p-0 shadow-none ring-1">
      <CardHeader className="gap-1.5 px-4 pt-5 pb-0 sm:px-6 sm:pt-6">
        <p className="font-display text-primary text-xs font-semibold tracking-wide uppercase">
          AssetFlow
        </p>
        <CardTitle className="font-display text-foreground text-xl font-bold tracking-tight sm:text-2xl">
          {step === "email" ? "Log in with OTP" : "Enter code"}
        </CardTitle>
        <CardDescription className="text-muted-foreground break-words">
          {step === "email"
            ? "Enter your email to receive a one-time code."
            : `Enter the 6-digit code sent to ${email.trim()}.`}
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

        {step === "email" ? (
          <form onSubmit={handleSendOtp} noValidate>
            <FieldGroup className="gap-4">
              <Field data-invalid={!!emailError || undefined}>
                <FieldLabel htmlFor="login-otp-email">Email</FieldLabel>
                <Input
                  id="login-otp-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError(undefined);
                  }}
                  placeholder="name@company.com"
                  className="rounded-xs"
                  aria-invalid={!!emailError}
                  aria-describedby={emailError ? "login-otp-email-error" : undefined}
                />
                {emailError && <FieldError id="login-otp-email-error">{emailError}</FieldError>}
              </Field>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="mt-1 h-10 w-full rounded-full text-sm font-medium"
              >
                {isSubmitting ? "Sending…" : "Send code"}
              </Button>
            </FieldGroup>
          </form>
        ) : (
          <form onSubmit={handleVerify} noValidate>
            <FieldGroup className="gap-4">
              <Field data-invalid={!!otpError || undefined}>
                <FieldLabel htmlFor="login-otp-code">One-time code</FieldLabel>
                <Input
                  id="login-otp-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                    if (otpError) setOtpError(undefined);
                  }}
                  placeholder="123456"
                  className="rounded-xs tracking-widest"
                  aria-invalid={!!otpError}
                  aria-describedby={otpError ? "login-otp-code-error" : undefined}
                />
                {otpError && <FieldError id="login-otp-code-error">{otpError}</FieldError>}
              </Field>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="mt-1 h-10 w-full rounded-full text-sm font-medium"
              >
                {isSubmitting ? "Verifying…" : "Verify & log in"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={handleResend}
                disabled={secondsRemaining > 0}
                className="text-muted-foreground h-9 w-full text-sm font-medium"
              >
                {secondsRemaining > 0 ? `Resend code (${secondsRemaining}s)` : "Resend code"}
              </Button>

              <Button
                type="button"
                variant="link"
                onClick={handleBackToEmail}
                className="text-primary h-auto p-0 text-sm font-medium"
              >
                Use a different email
              </Button>
            </FieldGroup>
          </form>
        )}
      </CardContent>

      <CardFooter className="border-border flex flex-col items-stretch gap-3 border-t bg-transparent px-4 py-4 sm:px-6 sm:py-5">
        <Link
          href="/login"
          className="text-primary text-center text-sm font-medium hover:underline"
        >
          Log in with password instead
        </Link>
        <p className="text-muted-foreground text-center text-sm">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-primary font-medium hover:underline">
            Create account
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
