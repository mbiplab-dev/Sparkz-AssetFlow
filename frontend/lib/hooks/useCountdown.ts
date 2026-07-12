"use client";

import { useEffect, useState } from "react";

/** Counts down from a started value to 0; used for a resend-code cooldown. */
export function useCountdown() {
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  useEffect(() => {
    if (secondsRemaining <= 0) return;
    const timer = setTimeout(() => setSecondsRemaining((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsRemaining]);

  return { secondsRemaining, start: setSecondsRemaining };
}
