import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 tnum",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary/15 text-primary border-primary/30",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive/15 text-destructive border-destructive/30",
        outline: "text-foreground border-border",
        success:
          "border-transparent bg-[hsl(142_70%_45%/0.15)] text-[hsl(142_70%_55%)] border-[hsl(142_70%_45%/0.3)]",
        warning:
          "border-transparent bg-[hsl(38_92%_50%/0.15)] text-[hsl(38_92%_60%)] border-[hsl(38_92%_50%/0.3)]",
        info: "border-transparent bg-[hsl(217_91%_60%/0.15)] text-[hsl(217_91%_70%)] border-[hsl(217_91%_60%/0.3)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
