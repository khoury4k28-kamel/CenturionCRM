import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const base =
  "inline-flex items-center justify-center gap-1.5 font-medium tracking-tight rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-[var(--color-accent-solid)] text-[var(--color-accent-fg)] hover:bg-[var(--color-accent-hover)]",
  secondary:
    "bg-[var(--color-bg-elevated)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]",
  ghost: "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-elevated)]",
  danger: "bg-[var(--color-danger)] text-white hover:opacity-90",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-9 px-3.5 text-sm",
  lg: "h-11 px-5 text-base",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(base, variantStyles[variant], sizeStyles[size], className)}
      {...props}
    />
  );
});
