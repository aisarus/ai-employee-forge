import { cn } from "@/lib/utils";

interface AiThinkingDotsProps {
  /** Optional label shown before the dots */
  label?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: { dot: "w-1 h-1",   gap: "gap-[3px]", text: "text-[11px]" },
  md: { dot: "w-[5px] h-[5px]", gap: "gap-1",     text: "text-xs"    },
  lg: { dot: "w-2 h-2",   gap: "gap-1.5",  text: "text-sm"    },
};

/**
 * Animated "AI is thinking" dots indicator.
 * Uses CSS-only animation — no JS overhead.
 *
 * Usage:
 *   <AiThinkingDots label="Генерирую..." />
 *   <AiThinkingDots size="sm" />
 */
export function AiThinkingDots({ label, size = "md", className }: AiThinkingDotsProps) {
  const s = sizeMap[size];
  return (
    <span
      className={cn("inline-flex items-center gap-2 text-muted-foreground select-none", className)}
      aria-label={label ?? "Загрузка"}
      role="status"
    >
      {label && <span className={cn("font-medium", s.text)}>{label}</span>}
      <span className={cn("ai-thinking", s.gap)}>
        <span className={cn("ai-thinking-dot rounded-full bg-current", s.dot)} />
        <span className={cn("ai-thinking-dot rounded-full bg-current", s.dot)} />
        <span className={cn("ai-thinking-dot rounded-full bg-current", s.dot)} />
      </span>
    </span>
  );
}

/**
 * Full-width AI generation status bar.
 * Shows icon + pulsing message + thinking dots.
 */
export function AiGeneratingBar({
  message = "ИИ генерирует…",
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3",
        "animate-slide-down-fade",
        className
      )}
      role="status"
      aria-live="polite"
    >
      {/* Pulsing orb */}
      <span className="relative flex h-3 w-3 shrink-0">
        <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-60" />
        <span className="relative rounded-full bg-primary h-3 w-3" />
      </span>

      {/* Message */}
      <span className="text-sm font-medium text-primary/90 flex-1 ai-stream-cursor">
        {message}
      </span>

      {/* Dots */}
      <AiThinkingDots size="sm" className="text-primary/70" />
    </div>
  );
}
