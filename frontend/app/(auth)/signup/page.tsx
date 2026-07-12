"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordInput } from "@/components/PasswordInput";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api/http";
import { useCountdown } from "@/lib/hooks/useCountdown";

const inputClass =
  "rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-base text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:text-zinc-50 dark:focus:border-zinc-50";

export default function SignupPage() {
  const { requestSignupOtp, verifySignupOtp } = useAuth();
  const router = useRouter();
  const { secondsRemaining, start } = useCountdown();

  const [step, setStep] = useState<"details" | "otp">("details");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRequestOtp(e: React.SubmitEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await requestSignupOtp({ name, age: Number(age), email, password });
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
      await verifySignupOtp({ email, code });
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
      await requestSignupOtp({ name, age: Number(age), email, password });
      start(60);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  function handleBack() {
    setError(null);
    setStep("details");
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Create an account</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {step === "details" ? "Tell us a bit about yourself." : `Enter the code sent to ${email}.`}
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}

      {step === "details" ? (
        <form onSubmit={handleRequestOtp} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Name
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Jane Doe"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Age
            <input
              type="number"
              required
              min={1}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className={inputClass}
              placeholder="25"
            />
          </label>

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

          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Password
            <PasswordInput
              value={password}
              onChange={setPassword}
              className={inputClass}
              placeholder="••••••••"
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-foreground text-background mt-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
          >
            {isSubmitting ? "Continue..." : "Continue"}
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
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`${inputClass} tracking-widest`}
              placeholder="123456"
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-foreground text-background mt-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
          >
            {isSubmitting ? "Verifying..." : "Verify & create account"}
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
            onClick={handleBack}
            className="text-sm font-medium text-zinc-600 hover:underline dark:text-zinc-400"
          >
            Back
          </button>
        </form>
      )}

      <div className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
          Log in
        </Link>
      </div>
    </>
  );
}
