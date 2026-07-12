/**
 * Auth shell — warm paper canvas + elevated white card (ex-auth-form-card in DESIGN.md).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-background px-4 py-12 sm:py-16">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
