"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { beginDraftAction } from "@/features/start/actions/begin";

/**
 * "Build your event site" CTA that goes straight into the wizard's first
 * step (occasion) instead of the /start intro page: it submits the same
 * beginDraftAction the /start button uses (creates the draft event, then
 * redirects). A form POST rather than a link on purpose — a GET that
 * creates drafts would be triggered by link prefetching and crawlers.
 */
export function StartBuildingButton({
  children,
  plain = false,
  className,
  formClassName,
  size,
}: {
  children: ReactNode;
  /** Render a bare <button> with `className` (text links, pills) instead of the shared Button component. */
  plain?: boolean;
  className?: string;
  formClassName?: string;
  size?: "sm" | "default" | "lg";
}) {
  return (
    <form action={beginDraftAction} className={formClassName}>
      <Submit plain={plain} className={className} size={size}>
        {children}
      </Submit>
    </form>
  );
}

function Submit({ children, plain, className, size }: { children: ReactNode; plain: boolean; className?: string; size?: "sm" | "default" | "lg" }) {
  const { pending } = useFormStatus();
  const content = pending ? (
    <>
      <Loader2 size={16} className="animate-spin" /> Starting…
    </>
  ) : (
    children
  );
  return plain ? (
    <button type="submit" disabled={pending} className={className}>
      {content}
    </button>
  ) : (
    <Button type="submit" disabled={pending} size={size} className={className}>
      {content}
    </Button>
  );
}
