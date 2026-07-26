import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-ivory-50 px-6 pt-24 text-center">
      <p className="text-xs uppercase tracking-[0.35em] text-gold-500">
        404
      </p>
      <h1 className="mt-4 font-display text-3xl text-navy-950 sm:text-4xl">
        Page Not Found
      </h1>
      <p className="mt-4 max-w-sm text-sm text-navy-700/75">
        This page doesn&rsquo;t exist, or your invitation link may be
        incomplete. Please check the link and try again.
      </p>
      <div className="mt-8">
        <Button asChild>
          <Link href="/">Return Home</Link>
        </Button>
      </div>
    </div>
  );
}
