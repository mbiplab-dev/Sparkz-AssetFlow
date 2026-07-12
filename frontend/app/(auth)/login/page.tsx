"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordInput } from "@/components/PasswordInput";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api/http";

const inputClass =
  "rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-base text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:text-zinc-50 dark:focus:border-zinc-50";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login({ email, password });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Log in</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Welcome back. Enter your email and password.
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
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
          {isSubmitting ? "Logging in..." : "Log in"}
        </button>
      </form>

      <div className="mt-6 flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <Link
          href="/login_otp"
          className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
        >
          Log in with OTP instead
        </Link>
        <Link
          href="/forgot-password"
          className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
        >
          Forgot password?
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
