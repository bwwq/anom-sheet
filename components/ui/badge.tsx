import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeProps = React.ComponentProps<"span"> & {
  tone?: "default" | "muted" | "dark";
};

function Badge({ className, tone = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md border px-2 text-xs font-medium",
        tone === "default" && "border-zinc-700 bg-zinc-950 text-zinc-300",
        tone === "muted" && "border-zinc-800 bg-zinc-900 text-zinc-400",
        tone === "dark" && "border-zinc-600 bg-zinc-800 text-zinc-100",
        className
      )}
      {...props}
    />
  );
}

export { Badge };
