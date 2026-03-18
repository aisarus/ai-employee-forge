import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WizardData } from "./types";
import { Brain, ExternalLink, ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/utils";

interface Props {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
}

type Provider = "openai" | "anthropic" | "gemini";

// Key format rules (prefix + min length + allowed chars).
// Lengths based on provider documentation (conservative minimums).
const KEY_RULES: Record<Provider, { prefix: string; minLen: number; pattern: RegExp }> = {
  openai:    { prefix: "sk-",     minLen: 48, pattern: /^sk-[A-Za-z0-9_-]+$/ },
  anthropic: { prefix: "sk-ant-", minLen: 60, pattern: /^sk-ant-[A-Za-z0-9_-]+$/ },
  gemini:    { prefix: "AIza",    minLen: 39, pattern: /^AIza[A-Za-z0-9_-]+$/ },
};

interface KeyValidation {
  provider: Provider | null;
  /** null = no error (key empty or fully valid) */
  error: string | null;
  valid: boolean;
}

function validateApiKey(apiKey: string): KeyValidation {
  if (!apiKey) return { provider: null, error: null, valid: false };

  // Determine provider by prefix (most-specific first to avoid sk- matching sk-ant-)
  let provider: Provider | null = null;
  if (apiKey.startsWith("sk-ant-")) provider = "anthropic";
  else if (apiKey.startsWith("AIza"))   provider = "gemini";
  else if (apiKey.startsWith("sk-"))    provider = "openai";

  if (!provider) {
    return { provider: null, error: apiKey.length > 4 ? "wizard.api_key_invalid" : null, valid: false };
  }

  const rule = KEY_RULES[provider];

  if (!rule.pattern.test(apiKey)) {
    return { provider, error: "wizard.api_key_chars_invalid", valid: false };
  }
  if (apiKey.length < rule.minLen) {
    return { provider, error: "wizard.api_key_too_short", valid: false };
  }

  return { provider, error: null, valid: true };
}

const PROVIDERS: { id: Provider; label: string; prefix: string; url: string; color: string }[] = [
  { id: "openai",    label: "OpenAI",          prefix: "sk-...",     url: "https://platform.openai.com/api-keys",         color: "#10b981" },
  { id: "anthropic", label: "Anthropic Claude", prefix: "sk-ant-...", url: "https://console.anthropic.com/settings/keys",  color: "#7c3aed" },
  { id: "gemini",    label: "Google Gemini",    prefix: "AIza...",    url: "https://aistudio.google.com/app/apikey",       color: "#f59e0b" },
];

export function StepApiKeys({ data, onChange }: Props) {
  const { t } = useI18n();
  const { provider, error: keyError, valid: isValid } = validateApiKey(data.openai_api_key);
  const isInvalidKey = !!keyError;

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Heading */}
      <div className="text-center space-y-1.5">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30"
            style={{
              background: "linear-gradient(135deg, hsl(263 70% 58% / 0.15), hsl(210 90% 55% / 0.1))",
              boxShadow: "0 0 20px hsl(263 70% 58% / 0.25)",
            }}
          >
            <Brain className="h-6 w-6 text-primary animate-brain-pulse" />
          </div>
        </div>
        <h2 className="text-2xl font-extrabold gradient-text">{t("wizard.api_keys_title")}</h2>
        <p className="text-sm text-muted-foreground">{t("wizard.api_keys_desc")}</p>
      </div>

      {/* Provider cards */}
      <div className="grid grid-cols-3 gap-2.5">
        {PROVIDERS.map(p => {
          const isActive = provider === p.id;
          return (
            <a
              key={p.id}
              href={p.url}
              target="_blank"
              rel="noopener"
              className={cn(
                "relative flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all duration-200 group",
                isActive
                  ? "border-transparent shadow-lg"
                  : "border-border/60 hover:border-primary/30 hover:-translate-y-0.5"
              )}
              style={isActive ? {
                boxShadow: `0 0 0 1.5px ${p.color}, 0 4px 20px ${p.color}33`,
                background: `linear-gradient(135deg, ${p.color}18, ${p.color}08)`,
              } : {}}
            >
              {isActive && (
                <CheckCircle2
                  className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-card"
                  style={{ color: p.color }}
                />
              )}
              <span className="text-xs font-bold text-foreground leading-tight">{p.label}</span>
              <span className="text-[10px] font-mono text-muted-foreground/70">{p.prefix}</span>
              <span className="text-[10px] text-primary/70 group-hover:text-primary flex items-center gap-0.5 transition-colors">
                Получить ключ <ExternalLink className="h-2.5 w-2.5" />
              </span>
            </a>
          );
        })}
      </div>

      {/* Key input */}
      <div className="rounded-2xl border border-border/60 bg-card/50 p-5 space-y-3">
        <Label className="text-sm font-semibold">{t("wizard.api_key_label")} *</Label>
        <div className="relative">
          <Input
            type="password"
            value={data.openai_api_key}
            onChange={(e) => {
              onChange({ openai_api_key: e.target.value });
              localStorage.setItem("userOpenAiKey", e.target.value);
            }}
            placeholder="sk-...  /  sk-ant-...  /  AIza..."
            className={cn(
              "bg-background/60 font-mono text-xs pr-10 focus:border-primary/50 transition-all",
              isValid && "border-green-500/50 focus:border-green-500/70",
              isInvalidKey && "border-destructive/50"
            )}
            autoComplete="off"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isValid && <CheckCircle2 className="h-4 w-4 text-green-500" />}
            {isInvalidKey && <AlertCircle className="h-4 w-4 text-destructive" />}
          </div>
        </div>

        {isValid && (
          <p className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {PROVIDERS.find(p => p.id === provider)?.label} — ключ распознан
          </p>
        )}
        {isInvalidKey && keyError && (
          <p className="text-xs text-destructive flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" />
            {t(keyError)}
          </p>
        )}
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-3 rounded-xl border border-border/50 p-3.5 bg-muted/30">
        <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">{t("wizard.api_keys_security")}</p>
      </div>
    </div>
  );
}
