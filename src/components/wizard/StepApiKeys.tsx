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

function detectProvider(apiKey: string): Provider | null {
  if (!apiKey) return null;
  if (apiKey.startsWith("sk-ant-")) return "anthropic";
  if (apiKey.startsWith("AIza")) return "gemini";
  if (apiKey.startsWith("sk-")) return "openai";
  return null;
}

const PROVIDERS: { id: Provider; label: string; prefix: string; url: string; color: string }[] = [
  { id: "openai",    label: "OpenAI",          prefix: "sk-...",     url: "https://platform.openai.com/api-keys",         color: "#10b981" },
  { id: "anthropic", label: "Anthropic Claude", prefix: "sk-ant-...", url: "https://console.anthropic.com/settings/keys",  color: "#7c3aed" },
  { id: "gemini",    label: "Google Gemini",    prefix: "AIza...",    url: "https://aistudio.google.com/app/apikey",       color: "#f59e0b" },
];

export function StepApiKeys({ data, onChange }: Props) {
  const { t } = useI18n();
  const provider = detectProvider(data.openai_api_key);
  const isInvalidKey = data.openai_api_key.length > 4 && provider === null;
  const isValid = provider !== null;

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
        {isInvalidKey && (
          <p className="text-xs text-destructive flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" />
            {t("wizard.api_key_invalid")}
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
