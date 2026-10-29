import Link from "next/link";
import { CloudCog } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <CloudCog className="size-6" />
      </div>
      <h1 className="font-heading text-5xl font-semibold">404</h1>
      <p className="max-w-sm text-muted-foreground">
        This page drifted out of the region. It might have been moved, terminated, or never existed.
      </p>
      <Button render={<Link href="/" />}>Back to CloudLedger</Button>
    </div>
  );
}
