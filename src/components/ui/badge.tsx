import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline"
}

const variantClasses = {
  default: "border-transparent bg-primary-500 text-white hover:bg-primary-600",
  secondary: "border-transparent bg-coal-100 text-coal-900 hover:bg-coal-200",
  destructive: "border-transparent bg-red-500 text-white hover:bg-red-600",
  outline: "text-coal-900 border-coal-300",
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }
