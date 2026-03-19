import { WizardData, BOT_TYPES } from "./types";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

interface Props {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
}

// Unique accent per bot type
const BOT_TYPE_ACCENT: Record<string, { from: string; to: string; glow: string; bg: string; mid: string }> = {
  sales:   { from: "#7c3aed", to: "#3b82f6", mid: "#6366f1", glow: "hsl(263 70% 58%)", bg: "from-violet-500/12 to-blue-500/6"   },
  booking: { from: "#0ea5e9", to: "#06b6d4", mid: "#38bdf8", glow: "hsl(199 89% 48%)", bg: "from-sky-500/12 to-cyan-500/6"      },
  support: { from: "#10b981", to: "#059669", mid: "#34d399", glow: "hsl(160 84% 39%)", bg: "from-emerald-500/12 to-green-500/6" },
  lead:    { from: "#f59e0b", to: "#d97706", mid: "#fbbf24", glow: "hsl(38 92% 50%)",  bg: "from-amber-500/12 to-orange-500/6"  },
  faq:     { from: "#8b5cf6", to: "#a78bfa", mid: "#c084fc", glow: "hsl(258 90% 66%)", bg: "from-purple-500/12 to-violet-400/6" },
  order:   { from: "#ec4899", to: "#f43f5e", mid: "#f472b6", glow: "hsl(330 81% 60%)", bg: "from-pink-500/12 to-rose-500/6"    },
  custom:  { from: "#64748b", to: "#475569", mid: "#94a3b8", glow: "hsl(215 16% 47%)", bg: "from-slate-500/12 to-slate-600/6"  },
};

// 3D tilt on mouse move
const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width - 0.5;
  const y = (e.clientY - rect.top) / rect.height - 0.5;
  e.currentTarget.style.transform = `perspective(600px) rotateX(${-y * 16}deg) rotateY(${x * 16}deg) translateZ(12px) scale(1.03)`;
  e.currentTarget.style.transition = "transform 0.07s ease-out";
};

const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>, selected: boolean) => {
  e.currentTarget.style.transform = selected ? "scale(1.04)" : "";
  e.currentTarget.style.transition = "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)";
};

export function StepBotType({ data, onChange }: Props) {
  const { t } = useI18n();

  return (
    <div className="space-y-7">
      {/* Hero heading */}
      <div className="text-center space-y-2 animate-fade-up">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
            Шаг 1 — Выбор типа
          </span>
          <Sparkles className="h-4 w-4 text-primary animate-pulse" />
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
              onMouseMove={handleMouseMove}
              onMouseLeave={(e) => handleMouseLeave(e, selected)}
              aria-label={`Select ${t(`bottype.${bt.id}` as any)} bot type`}
              className={cn(
                "group relative flex flex-col items-center gap-3 rounded-2xl p-5 text-center",
                "outline-none focus-visible:ring-2 focus-visible:ring-primary",
                // No border class — we handle it with absolute elements
                selected && "animate-card-pop scale-[1.04]",
              )}
              style={{
                animationDelay: `${i * 45}ms`,
                // Remove any pre-existing transition so onMouseMove can override
              }}
            >
              {/* ─── Spinning gradient border (selected only) ─── */}
              {selected && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute -inset-[2px] rounded-[18px] overflow-hidden z-0"
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: "-100%",
                      background: `conic-gradient(from 0deg, transparent 0deg, transparent 100deg, ${accent.from} 155deg, ${accent.mid} 180deg, ${accent.to} 205deg, transparent 260deg, transparent 360deg)`,
                      animation: "border-spin 2.5s linear infinite",
                    }}
                  />
                </div>
              )}

              {/* ─── Card base background ─── */}
              <div
                className="absolute inset-[2px] rounded-[16px] z-[1]"
                style={{ background: "hsl(var(--card))" }}
              />

              {/* ─── Unselected border ─── */}
              {!selected && (
                <div className="absolute inset-0 rounded-2xl border-2 border-border/60 group-hover:border-primary/40 transition-colors duration-200 z-[1]" />
              )}

              {/* ─── Gradient tint fill ─── */}
              <div
                className={cn(
                  "absolute inset-[2px] rounded-[16px] bg-gradient-to-br transition-opacity duration-300 z-[2]",
                  accent.bg,
                  selected ? "opacity-100" : "opacity-0 group-hover:opacity-70"
                )}
              />

              {/* ─── Selected inner glow radial ─── */}
              {selected && (
                <div
                  className="absolute inset-[2px] rounded-[16px] z-[3]"
                  style={{
                    background: `radial-gradient(ellipse at 50% 20%, ${accent.from}40, transparent 65%)`,
                    animation: "neon-pulse 2.2s ease-in-out infinite",
                  }}
                />
              )}

              {/* ─── Drop shadow glow for selected card container ─── */}
              {selected && (
                <div
                  className="absolute inset-0 rounded-2xl z-0 opacity-70"
                  style={{
                    boxShadow: `0 0 0 2px ${accent.from}90, 0 0 32px ${accent.glow}55, 0 8px 40px ${accent.glow}25`,
                  }}
                />
              )}

              {/* ─── Emoji icon ─── */}
              <span
                className="relative z-10 text-5xl sm:text-6xl leading-none select-none transition-transform duration-300 group-hover:scale-110"
                style={selected ? { filter: `drop-shadow(0 0 16px ${accent.glow})` } : {}}
              >
                {bt.icon}
              </span>

              {/* ─── Label ─── */}
              <span
                className={cn(
                  "relative z-10 text-sm font-bold transition-colors duration-200 leading-tight",
                  selected ? "text-foreground" : "text-foreground/80"
                )}
              >
                {t(`bottype.${bt.id}` as any)}
              </span>

              {/* ─── Description ─── */}
              <span className="relative z-10 text-xs text-muted-foreground leading-snug line-clamp-2">
                {t(`bottype.${bt.id}_desc` as any)}
              </span>

              {/* ─── Selected checkmark badge ─── */}
              {selected && (
                <div
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full flex items-center justify-center text-white text-[11px] font-bold shadow-lg z-20 animate-pop-in"
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
          className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/8 px-4 py-3 animate-fade-up"
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
