import { WizardData, BOT_TYPES } from "./types";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

interface Props {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
}

// Unique accent per bot type: [gradient-from, gradient-to, ring/glow color]
const BOT_TYPE_ACCENT: Record<string, { from: string; to: string; glow: string; bg: string }> = {
  sales:   { from: "#7c3aed", to: "#3b82f6", glow: "hsl(263 70% 58%)", bg: "from-violet-500/10 to-blue-500/5"  },
  booking: { from: "#0ea5e9", to: "#06b6d4", glow: "hsl(199 89% 48%)", bg: "from-sky-500/10 to-cyan-500/5"    },
  support: { from: "#10b981", to: "#059669", glow: "hsl(160 84% 39%)", bg: "from-emerald-500/10 to-green-500/5"},
  lead:    { from: "#f59e0b", to: "#d97706", glow: "hsl(38 92% 50%)",  bg: "from-amber-500/10 to-orange-500/5" },
  faq:     { from: "#8b5cf6", to: "#a78bfa", glow: "hsl(258 90% 66%)", bg: "from-purple-500/10 to-violet-400/5"},
  order:   { from: "#ec4899", to: "#f43f5e", glow: "hsl(330 81% 60%)", bg: "from-pink-500/10 to-rose-500/5"   },
  custom:  { from: "#64748b", to: "#475569", glow: "hsl(215 16% 47%)", bg: "from-slate-500/10 to-slate-600/5"  },
};

export function StepBotType({ data, onChange }: Props) {
  const { t } = useI18n();

  return (
    <div className="space-y-7">
      {/* Hero heading */}
      <div className="text-center space-y-2 animate-fade-up">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
            Шаг 1 — Выбор типа
          </span>
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold gradient-text">
          {t("wizard.bot_type_title")}
        </h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          {t("wizard.bot_type_desc")}
        </p>
      </div>

      {/* Bot type grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {BOT_TYPES.map((bt, i) => {
          const selected = data.bot_type === bt.id;
          const accent = BOT_TYPE_ACCENT[bt.id] ?? BOT_TYPE_ACCENT.custom;

          return (
            <button
              key={bt.id}
              onClick={() => onChange({ bot_type: bt.id })}
              aria-label={`Select ${t(`bottype.${bt.id}` as any)} bot type`}
              className={cn(
                "group relative flex flex-col items-center gap-3 rounded-2xl border-2 p-5 text-center",
                "transition-all duration-250 outline-none focus-visible:ring-2 focus-visible:ring-primary",
                "hover:-translate-y-1 hover:shadow-lg",
                selected
                  ? "border-transparent scale-[1.04] shadow-xl animate-card-pop"
                  : "border-border/60 bg-card/60 hover:border-primary/40"
              )}
              style={{
                animationDelay: `${i * 45}ms`,
                ...(selected
                  ? {
                      background: `linear-gradient(145deg, hsl(var(--card)), hsl(var(--card)))`,
                      boxShadow: `0 0 0 2px ${accent.glow}, 0 0 28px ${accent.glow}55, 0 8px 32px ${accent.glow}22`,
                    }
                  : {}),
              }}
            >
              {/* Gradient tint layer */}
              <div
                className={cn(
                  "absolute inset-0 rounded-[14px] bg-gradient-to-br opacity-0 transition-opacity duration-300",
                  accent.bg,
                  selected ? "opacity-100" : "group-hover:opacity-60"
                )}
              />

              {/* Selected glow ring pulse */}
              {selected && (
                <div
                  className="absolute inset-0 rounded-[14px] opacity-30"
                  style={{
                    background: `radial-gradient(circle at 50% 30%, ${accent.from}55, transparent 70%)`,
                    animation: "neon-pulse 2s ease-in-out infinite",
                  }}
                />
              )}

              {/* Emoji icon */}
              <span
                className="relative z-10 text-4xl sm:text-5xl leading-none select-none transition-transform duration-300 group-hover:scale-110"
                style={selected ? { filter: `drop-shadow(0 0 12px ${accent.glow})` } : {}}
              >
                {bt.icon}
              </span>

              {/* Label */}
              <span
                className={cn(
                  "relative z-10 text-sm font-bold transition-colors duration-200 leading-tight",
                  selected ? "text-foreground" : "text-foreground/80"
                )}
              >
                {t(`bottype.${bt.id}` as any)}
              </span>

              {/* Description */}
              <span className="relative z-10 text-xs text-muted-foreground leading-snug line-clamp-2">
                {t(`bottype.${bt.id}_desc` as any)}
              </span>

              {/* Selected checkmark badge */}
              {selected && (
                <div
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full flex items-center justify-center text-white text-[11px] font-bold shadow-lg z-20"
                  style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
                >
                  ✓
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Hint after selection */}
      {data.bot_type && (
        <div
          className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 animate-fade-up"
          style={{ animationDelay: "0ms" }}
        >
          <span className="text-xl shrink-0">{BOT_TYPES.find(b => b.id === data.bot_type)?.icon}</span>
          <p className="text-sm text-muted-foreground">
            {t("wizard.bot_type_selected_hint")}
          </p>
          <span className="ml-auto text-xs font-semibold text-primary whitespace-nowrap">
            {t(`bottype.${data.bot_type}` as any)} →
          </span>
        </div>
      )}
    </div>
  );
}
