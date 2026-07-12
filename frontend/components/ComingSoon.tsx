import { Hammer } from "lucide-react";

/** Placeholder body for screens that aren't built yet, so nav never 404s. */
export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-muted mx-auto mt-10 flex w-full max-w-xl flex-col items-center gap-2 rounded-xl px-8 py-14 text-center">
      <Hammer className="text-ink-faint mb-2 size-8" />
      <h2 className="font-display text-ink text-lg font-semibold">{title}</h2>
      <p className="text-ink-muted text-sm">{description}</p>
    </div>
  );
}
