/**
 * Auth shell — warm paper canvas + elevated white card.
 * Full-height, padded for phones, safe-area aware.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-8 sm:px-6 sm:py-12 md:py-16">
      <div className="w-full max-w-md min-w-0">{children}</div>
    </div>
  );
}
