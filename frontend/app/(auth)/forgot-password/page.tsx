"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordInput } from "@/components/PasswordInput";
import { ApiError } from "@/lib/api/http";
import { confirmPasswordReset, requestPasswordResetOtp } from "@/lib/auth/authApi";
import { useCountdown } from "@/lib/hooks/useCountdown";

const inputClass =
  "rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-base text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:text-zinc-50 dark:focus:border-zinc-50";

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

  return (
    <>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Reset your password
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {step === "email" && "Enter your email to receive a reset code."}
        {step === "otp" && `Enter the code sent to ${email}.`}
        {step === "password" && "Choose a new password."}
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}

      {step === "email" && (
        <form onSubmit={handleRequestOtp} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="you@example.com"
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-foreground text-background mt-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
          >
            {isSubmitting ? "Sending..." : "Send reset code"}
          </button>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={handleContinueFromCode} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            One-time code
            <input
              type="text"
              inputMode="numeric"
              required
              minLength={6}
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`${inputClass} tracking-widest`}
              placeholder="123456"
            />
          </label>

          <button
            type="submit"
            className="bg-foreground text-background mt-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Continue
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={secondsRemaining > 0}
            className="text-sm font-medium text-zinc-600 hover:underline disabled:opacity-60 disabled:hover:no-underline dark:text-zinc-400"
          >
            {secondsRemaining > 0 ? `Resend code (${secondsRemaining}s)` : "Resend code"}
          </button>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setStep("email");
            }}
            className="text-sm font-medium text-zinc-600 hover:underline dark:text-zinc-400"
          >
            Use a different email
          </button>
        </form>
      )}

      {step === "password" && (
        <form onSubmit={handleConfirm} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            New password
            <PasswordInput
              value={newPassword}
              onChange={setNewPassword}
              className={inputClass}
              placeholder="••••••••"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Confirm new password
            <PasswordInput
              value={confirmPassword}
              onChange={setConfirmPassword}
              className={inputClass}
              placeholder="••••••••"
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-foreground text-background mt-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
          >
            {isSubmitting ? "Resetting..." : "Reset password"}
          </button>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setStep("otp");
            }}
            className="text-sm font-medium text-zinc-600 hover:underline dark:text-zinc-400"
          >
            Back
          </button>
        </form>
      )}

      <div className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        Remembered your password?{" "}
        <Link href="/login" className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
          Log in
        </Link>
      </div>
    </>
  );
}
