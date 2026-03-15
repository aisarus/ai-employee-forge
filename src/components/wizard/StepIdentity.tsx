import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AvatarUpload } from "./AvatarUpload";
import { WizardData, LANGUAGES, TONES, RESPONSE_STYLES } from "./types";
import { Bot, AtSign, Palette, MessageCircle } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";

interface Props {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  onAvatarUpload: (file: File) => void;
  onAvatarRemove: () => void;
}

// Emoji / label metadata for visual selectors
const TONE_META: Record<string, { emoji: string; desc: string }> = {
  Friendly:     { emoji: "😊", desc: "Warm & approachable" },
  Professional: { emoji: "💼", desc: "Polished & formal" },
  Formal:       { emoji: "🎩", desc: "Strict & precise" },
  Supportive:   { emoji: "🤝", desc: "Empathetic & caring" },
  Playful:      { emoji: "🎉", desc: "Fun & energetic" },
  Concise:      { emoji: "⚡", desc: "Direct & brief" },
};

const STYLE_META: Record<string, { emoji: string; desc: string }> = {
  Concise:       { emoji: "📌", desc: "Short answers" },
  Detailed:      { emoji: "📖", desc: "In-depth responses" },
  "Step-by-step":{ emoji: "🪜", desc: "Numbered steps" },
  "Bullet points":{ emoji: "📋", desc: "Lists & bullets" },
  Conversational:{ emoji: "💬", desc: "Chat-like flow" },
};

function PillSelector<T extends string>({
  options,
  value,
  onChange,
  meta,
  tKey,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  meta: Record<string, { emoji: string; desc: string }>;
  tKey: (v: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const m = meta[opt as string] ?? { emoji: "•", desc: "" };
        const isSelected = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`group flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-left transition-all duration-150 ${
              isSelected
                ? "border-primary bg-primary/10 shadow-[0_0_12px_hsl(var(--primary)/0.2)]"
                : "border-border bg-card/40 hover:border-primary/40 hover:bg-primary/5"
            }`}
          >
            <span className="text-lg leading-none">{m.emoji}</span>
            <div>
              <p className={`text-xs font-semibold leading-tight ${isSelected ? "text-primary" : "text-foreground"}`}>
                {tKey(opt)}
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight">{m.desc}</p>
            </div>
            {isSelected && (
              <span className="ml-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function StepIdentity({ data, onChange, onAvatarUpload, onAvatarRemove }: Props) {
  const { t } = useI18n();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-foreground">{t("wizard.define_identity")}</h2>
        <p className="text-sm text-muted-foreground">{t("wizard.define_identity_desc")}</p>
      </div>

      <AvatarUpload
        avatarUrl={data.bot_avatar_url}
        name={data.bot_name}
        onUpload={onAvatarUpload}
        onRemove={onAvatarRemove}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm">
            <Bot className="h-3.5 w-3.5 text-primary" />
            {t("wizard.bot_name")} *
          </Label>
          <Input
            value={data.bot_name}
            onChange={(e) => onChange({ bot_name: e.target.value })}
            placeholder="Flora Assistant"
            className="bg-background/50"
          />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm">
            <AtSign className="h-3.5 w-3.5 text-muted-foreground" />
            {t("wizard.username_hint")}
          </Label>
          <Input
            value={data.bot_username_hint}
            onChange={(e) => onChange({ bot_username_hint: e.target.value })}
            placeholder="flora_support_bot"
            className="bg-background/50"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm">{t("wizard.short_desc")} *</Label>
        <Textarea
          value={data.short_description}
          onChange={(e) => onChange({ short_description: e.target.value })}
          placeholder={t("wizard.short_desc_placeholder")}
          rows={2}
          className="bg-background/50 resize-none"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm">{t("wizard.about_bio")}</Label>
        <Textarea
          value={data.about_text}
          onChange={(e) => onChange({ about_text: e.target.value })}
          placeholder={t("wizard.about_placeholder")}
          rows={2}
          className="bg-background/50 resize-none"
        />
      </div>

      {/* Language (keep as select — many options) */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5 text-sm">
          🌐 {t("wizard.language")} *
        </Label>
        <Select value={data.default_language} onValueChange={(v) => onChange({ default_language: v })}>
          <SelectTrigger className="bg-background/50 w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => (
              <SelectItem key={l} value={l}>{t(`lang.${l}` as any)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tone — visual pill selector */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5 text-sm">
          <Palette className="h-3.5 w-3.5 text-primary" />
          {t("wizard.tone")} *
        </Label>
        <PillSelector
          options={TONES as unknown as readonly string[]}
          value={data.tone}
          onChange={(v) => onChange({ tone: v })}
          meta={TONE_META}
          tKey={(v) => t(`tone.${v}` as any) || v}
        />
      </div>

      {/* Response Style — visual pill selector */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5 text-sm">
          <MessageCircle className="h-3.5 w-3.5 text-primary" />
          {t("wizard.style")} *
        </Label>
        <PillSelector
          options={RESPONSE_STYLES as unknown as readonly string[]}
          value={data.response_style}
          onChange={(v) => onChange({ response_style: v })}
          meta={STYLE_META}
          tKey={(v) => t(`style.${v}` as any) || v}
        />
      </div>
    </div>
  );
}
