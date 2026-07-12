"use client";

import { useEffect, useRef, useState } from "react";

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Smoothly counts from the previously shown value to `value` using a rAF
 * ease-out curve. Respects prefers-reduced-motion (jumps to the final value).
 * The number animates on first load and again whenever the value changes
 * (e.g. a manual refresh), which is the dashboard's signature "smooth" moment.
 */
export function AnimatedNumber({
  value,
  duration = 700,
  className,
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const from = displayRef.current;
    const to = value;

    if (reduceMotion || from === to) {
      setDisplay(to);
      displayRef.current = to;
      return;
    }

    let start: number | null = null;
    const step = (now: number) => {
      if (start === null) start = now;
      const progress = Math.min((now - start) / duration, 1);
      const current = Math.round(from + (to - from) * easeOutCubic(progress));
      setDisplay(current);
      displayRef.current = current;
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        displayRef.current = to;
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return <span className={className}>{display.toLocaleString()}</span>;
}
