import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium tracking-wide transition-luxury duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:shadow-md hover:brightness-110",
        // Uses gold-600 (a darker coral shade) rather than the primary
        // gold-500 token — after the EveryMoment rebrand, gold-500
        // (#ff6b57) is bright enough that its usual 60%-opacity border/
        // text combo reads as near-invisible against the light cream
        // background (worse still once disabled:opacity-50 stacks on
        // top), e.g. the promo-code "Apply" button in
        // features/start/payment-panel.tsx. gold-600 is darker/more
        // saturated and reads clearly at full opacity on both the cream
        // background and any dark-navy surface this variant is used on.
        outline:
          "border border-gold-600 text-gold-600 bg-transparent hover:bg-gold-600/10",
        ghost: "bg-transparent hover:bg-white/10 text-inherit",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-6 py-2",
        sm: "h-9 px-4 text-xs",
        lg: "h-13 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
