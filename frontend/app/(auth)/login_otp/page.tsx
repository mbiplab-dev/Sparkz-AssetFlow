"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api/http";
import { useCountdown } from "@/lib/hooks/useCountdown";

const inputClass =
  "rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-base text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:text-zinc-50 dark:focus:border-zinc-50";

export default function LoginOtpPage() {
  const { requestLoginOtp, verifyLoginOtp } = useAuth();
  const router = useRouter();
  const { secondsRemaining, start } = useCountdown();

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSendOtp(e: React.SubmitEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await requestLoginOtp(email);
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
    setIsSubmitting(true);
    try {
      await verifyLoginOtp({ email, code: otp });
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
      await requestLoginOtp(email);
      start(60);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Log in with OTP</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {step === "email"
          ? "Enter your email to receive a one-time code."
          : `Enter the code sent to ${email}.`}
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}

      {step === "email" ? (
        <form onSubmit={handleSendOtp} className="mt-6 flex flex-col gap-4">
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
            {isSubmitting ? "Sending..." : "Send OTP"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            One-time code
            <input
              type="text"
              inputMode="numeric"
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className={`${inputClass} tracking-widest`}
              placeholder="123456"
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-foreground text-background mt-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
          >
            {isSubmitting ? "Verifying..." : "Verify & log in"}
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

      <div className="mt-6 flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <Link href="/login" className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
          Log in with password instead
        </Link>
        <span>
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
          >
            Sign up
          </Link>
        </span>
      </div>
    </>
  );
}
