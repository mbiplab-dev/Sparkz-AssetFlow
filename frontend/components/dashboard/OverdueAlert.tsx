import Link from "next/link";
import { Clock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function OverdueAlert({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <Alert
      variant="destructive"
      className="animate-in fade-in slide-in-from-top-2 fill-mode-both duration-400 ease-out"
    >
      <Clock />
      <AlertTitle>
        {count} asset{count === 1 ? "" : "s"} overdue for return
      </AlertTitle>
      <AlertDescription>
        Flagged for follow-up.{" "}
        <Link href="/allocation" className="font-medium underline underline-offset-2">
          Review overdue allocations
        </Link>
      </AlertDescription>
    </Alert>
  );
}
