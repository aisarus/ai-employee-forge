import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AvatarUpload } from "./AvatarUpload";
import { WizardData, LANGUAGES, TONES, RESPONSE_STYLES } from "./types";
import { Bot, AtSign, Palette, MessageCircle, Globe } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/utils";

interface Props {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  onAvatarUpload: (file: File) => void;
  onAvatarRemove: () => void;
}

const TONE_META: Record<string, { emoji: string; desc: string; color: string }> = {
  Friendly:     { emoji: "😊", desc: "Warm & approachable", color: "from-emerald-500/15 to-teal-500/8" },
  Professional: { emoji: "💼", desc: "Polished & formal",   color: "from-blue-500/15 to-indigo-500/8"   },
  Formal:       { emoji: "🎩", desc: "Strict & precise",    color: "from-slate-500/15 to-zinc-500/8"     },
  Supportive:   { emoji: "🤝", desc: "Empathetic & caring", color: "from-pink-500/15 to-rose-500/8"      },
  Playful:      { emoji: "🎉", desc: "Fun & energetic",     color: "from-amber-500/15 to-orange-500/8"   },
  Concise:      { emoji: "⚡", desc: "Direct & brief",      color: "from-violet-500/15 to-purple-500/8"  },
};

const STYLE_META: Record<string, { emoji: string; desc: string; color: string }> = {
  Concise:        { emoji: "📌", desc: "Short answers",     color: "from-red-500/15 to-rose-500/8"       },
  Detailed:       { emoji: "📖", desc: "In-depth",          color: "from-blue-500/15 to-cyan-500/8"      },
  "Step-by-step": { emoji: "🪜", desc: "Numbered steps",    color: "from-green-500/15 to-emerald-500/8"  },
  "Bullet points":{ emoji: "📋", desc: "Lists & bullets",   color: "from-violet-500/15 to-purple-500/8"  },
  Conversational: { emoji: "💬", desc: "Chat-like flow",    color: "from-amber-500/15 to-yellow-500/8"   },
};

function PillSelector<T extends string>({
  options,
  value,
  onChange,
  meta,
  tKey,
  labelSuffix,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  meta: Record<string, { emoji: string; desc: string; color: string }>;
  tKey: (v: T) => string;
  labelSuffix?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const m = meta[opt as string] ?? { emoji: "•", desc: "", color: "from-muted/20 to-muted/10" };
        const isSelected = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            aria-label={`Select ${tKey(opt)}${labelSuffix ? ` ${labelSuffix}` : ""}`}
            className={cn(
              "group relative flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-left transition-all duration-200",
              "hover:-translate-y-0.5",
              isSelected
                ? "border-primary shadow-[0_0_14px_hsl(var(--primary)/0.22)]"
                : "border-border/60 hover:border-primary/40 bg-card/40"
            )}
          >
            {/* Gradient tint */}
            <div className={cn(
              "absolute inset-0 rounded-[10px] bg-gradient-to-br transition-opacity duration-200",
              m.color,
              isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-60"
            )} />

            <span className="relative z-10 text-lg leading-none">{m.emoji}</span>
            <div className="relative z-10">
              <p className={cn(
                "text-xs font-semibold leading-tight",
                isSelected ? "text-primary" : "text-foreground"
              )}>
                {tKey(opt)}
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight">{m.desc}</p>
            </div>
            {isSelected && (
              <span className="relative z-10 ml-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0 animate-pop-in" />
            )}
          </button>
        );
      })}
    </div>
  );
}

// Reusable section card
function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      "rounded-2xl border border-border/50 bg-card/30 backdrop-blur-sm p-4 space-y-4 transition-all duration-200 hover:border-border/80",
      className
    )}>
      {children}
    </div>
  );
}

function SectionLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/12">
        <span className="text-primary">{icon}</span>
      </div>
      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">{children}</span>
    </div>
  );
}

export function StepIdentity({ data, onChange, onAvatarUpload, onAvatarRemove }: Props) {
  const { t } = useI18n();

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-xl font-extrabold gradient-text">{t("wizard.define_identity")}</h2>
        <p className="text-sm text-muted-foreground">{t("wizard.define_identity_desc")}</p>
      </div>

      {/* Avatar upload — centered, prominent */}
      <div className="flex justify-center">
        <AvatarUpload
          avatarUrl={data.bot_avatar_url}
          name={data.bot_name}
          onUpload={onAvatarUpload}
          onRemove={onAvatarRemove}
        />
      </div>

      {/* Identity fields */}
      <SectionCard>
        <SectionLabel icon={<Bot className="h-3.5 w-3.5" />}>Identity</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Bot className="h-3 w-3 text-primary" />
              {t("wizard.bot_name")} <span className="text-primary">*</span>
            </Label>
            <Input
              value={data.bot_name}
              onChange={(e) => onChange({ bot_name: e.target.value })}
              placeholder="Flora Assistant"
              className="bg-background/50 h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <AtSign className="h-3 w-3" />
              {t("wizard.username_hint")}
            </Label>
            <Input
              value={data.bot_username_hint}
              onChange={(e) => onChange({ bot_username_hint: e.target.value })}
              placeholder="flora_support_bot"
              className="bg-background/50 h-9"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {t("wizard.short_desc")} <span className="text-primary">*</span>
          </Label>
          <Textarea
            value={data.short_description}
            onChange={(e) => onChange({ short_description: e.target.value })}
            placeholder={t("wizard.short_desc_placeholder")}
            rows={2}
            className="bg-background/50 resize-none text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t("wizard.about_bio")}</Label>
          <Textarea
            value={data.about_text}
            onChange={(e) => onChange({ about_text: e.target.value })}
            placeholder={t("wizard.about_placeholder")}
            rows={2}
            className="bg-background/50 resize-none text-sm"
          />
        </div>
      </SectionCard>

      {/* Language */}
      <SectionCard>
        <SectionLabel icon={<Globe className="h-3.5 w-3.5" />}>Language</SectionLabel>
        <Select value={data.default_language} onValueChange={(v) => onChange({ default_language: v })}>
          <SelectTrigger className="bg-background/50 w-52 h-9" aria-label="Select language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => (
              <SelectItem key={l} value={l}>{t(`lang.${l}` as any)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SectionCard>

      {/* Tone */}
      <SectionCard>
        <SectionLabel icon={<Palette className="h-3.5 w-3.5" />}>{t("wizard.tone")}</SectionLabel>
        <PillSelector
          options={TONES as unknown as readonly string[]}
          value={data.tone}
          onChange={(v) => onChange({ tone: v })}
          meta={TONE_META}
          tKey={(v) => t(`tone.${v}` as any) || v}
          labelSuffix="tone"
        />
      </SectionCard>

      {/* Response Style */}
      <SectionCard>
        <SectionLabel icon={<MessageCircle className="h-3.5 w-3.5" />}>{t("wizard.style")}</SectionLabel>
        <PillSelector
          options={RESPONSE_STYLES as unknown as readonly string[]}
          value={data.response_style}
          onChange={(v) => onChange({ response_style: v })}
          meta={STYLE_META}
          tKey={(v) => t(`style.${v}` as any) || v}
          labelSuffix="response style"
        />
      </SectionCard>
    </div>
  );
}
