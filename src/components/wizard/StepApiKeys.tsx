import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WizardData } from "./types";
import { Brain, ExternalLink, ShieldCheck } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";

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

const PROVIDER_LABELS: Record<Provider, string> = {
  openai: "OpenAI detected",
  anthropic: "Anthropic detected",
  gemini: "Google Gemini detected",
};

export function StepApiKeys({ data, onChange }: Props) {
  const { t } = useI18n();
  const provider = detectProvider(data.openai_api_key);
  const isInvalidKey = data.openai_api_key.length > 0 && provider === null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-1.5">
        <h2 className="text-xl font-bold text-foreground">{t("wizard.api_keys_title")}</h2>
        <p className="text-sm text-muted-foreground">{t("wizard.api_keys_desc")}</p>
      </div>

      {/* AI API Key */}
      <div className="rounded-2xl border border-border bg-card/50 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
            <Brain className="h-4 w-4 text-primary shrink-0" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">AI API Key (OpenAI / Anthropic / Gemini)</h3>
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5">
          <p className="text-xs font-medium text-foreground">Поддерживаемые провайдеры:</p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>
              <span className="font-medium text-foreground">OpenAI</span> — sk-...{" "}
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener"
                className="text-primary underline inline-flex items-center gap-0.5">
                platform.openai.com <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li>
              <span className="font-medium text-foreground">Anthropic Claude</span> — sk-ant-...{" "}
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener"
                className="text-primary underline inline-flex items-center gap-0.5">
                console.anthropic.com <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li>
              <span className="font-medium text-foreground">Google Gemini</span> — AIza...{" "}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener"
                className="text-primary underline inline-flex items-center gap-0.5">
                aistudio.google.com <ExternalLink className="h-3 w-3" />
              </a>
            </li>
          </ul>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">{t("wizard.api_key_label")} *</Label>
          <Input
            type="password"
            value={data.openai_api_key}
            onChange={(e) => {
              onChange({ openai_api_key: e.target.value });
              // Store an AES-256-GCM encrypted copy in localStorage
              localStorage.setItem("userOpenAiKey", e.target.value);
            }}
            placeholder="sk-...  /  sk-ant-...  /  AIza..."
            className="bg-background/50 font-mono text-xs focus:border-primary/50"
            autoComplete="off"
            aria-describedby="api-key-hint"
          />
          {provider && (
            <p id="api-key-hint" className="text-xs text-green-600 dark:text-green-400">
              ✓ {PROVIDER_LABELS[provider]}
            </p>
          )}
          {isInvalidKey && (
            <p id="api-key-hint" className="text-xs text-destructive">
              {t("wizard.api_key_invalid")}
            </p>
          )}
        </div>
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-2.5 rounded-xl border border-border p-3 bg-card/30">
        <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">{t("wizard.api_keys_security")}</p>
      </div>
    </div>
  );
}

