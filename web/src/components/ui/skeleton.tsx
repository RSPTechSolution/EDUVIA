import { cn } from "cn"

/** Placeholder block with a light sweep moving across it while content loads. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("skeleton-shimmer rounded-md bg-foreground/[0.08] dark:bg-white/[0.07]", className)}
      {...props}
    />
  )
}

export { Skeleton }
