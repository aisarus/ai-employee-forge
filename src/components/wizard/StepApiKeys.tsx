import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WizardData } from "./types";
import { Brain, ExternalLink, ShieldCheck } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { encryptKey } from "@/lib/crypto";

interface Props {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
}

export function StepApiKeys({ data, onChange }: Props) {
  const { t } = useI18n();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-1.5">
        <h2 className="text-xl font-bold text-foreground">{t("wizard.api_keys_title")}</h2>
        <p className="text-sm text-muted-foreground">{t("wizard.api_keys_desc")}</p>
      </div>

      {/* OpenAI Key */}
      <div className="rounded-2xl border border-border bg-card/50 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
            <Brain className="h-4 w-4 text-primary shrink-0" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">{t("wizard.openai_key_label")}</h3>
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5">
          <p className="text-xs font-medium text-foreground">{t("wizard.openai_how_to_get")}</p>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>
              {t("wizard.openai_step1")}{" "}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener"
                className="text-primary underline inline-flex items-center gap-0.5"
              >
                platform.openai.com <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li>{t("wizard.openai_step2")}</li>
            <li>{t("wizard.openai_step3")}</li>
          </ol>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">{t("wizard.openai_key_label")} *</Label>
          <Input
            type="password"
            value={data.openai_api_key}
            onChange={(e) => {
              onChange({ openai_api_key: e.target.value });
              // Store an AES-256-GCM encrypted copy in localStorage
              encryptKey(e.target.value).then((enc) => {
                localStorage.setItem("userOpenAiKey", enc);
              });
            }}
            placeholder="sk-..."
            className="bg-background/50 font-mono text-xs focus:border-primary/50"
            autoComplete="off"
            aria-describedby="openai-key-error"
          />
          {data.openai_api_key && !data.openai_api_key.startsWith("sk-") && (
            <p id="openai-key-error" className="text-xs text-destructive">{t("wizard.openai_key_invalid")}</p>
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
