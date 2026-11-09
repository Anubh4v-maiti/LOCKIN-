import { cn } from "@/lib/utils";

export function LogoMark({ className, size = 34 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-primary text-primary-foreground",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" width={size} height={size} fill="none">
        <path
          d="M9 8.5v11.2c0 2.4 1.6 3.8 3.9 3.8H20"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M15.2 19.2l3.1 3.1 6.3-7.3"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="absolute inset-0 bg-gradient-to-br from-white/25 to-transparent" />
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="font-display text-[17px] font-bold tracking-[0.14em]">LOCKIN</span>
    </span>
  );
}

export function AuthBrand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <LogoMark size={42} />
      <div>
        <p className="font-display text-xl font-bold tracking-[0.16em]">LOCKIN</p>
        <p className="text-[11px] tracking-wide text-muted-foreground">
          Show up. Stack days. Become better.
        </p>
      </div>
    </div>
  );
}
