import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { WizardData, StarterButton, BOT_TYPE_PRESETS } from "./types";
import { Plus, X, MessageSquare, Hand, Sparkles } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";

interface Props {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
}

// Template keys per bot type — shown as quick-fill chips above textarea
const WELCOME_TEMPLATE_KEYS: Record<string, string[]> = {
  support:  ["template.support.w1", "template.support.w2"],
  faq:      ["template.faq.w1",     "template.faq.w2"],
  sales:    ["template.sales.w1",   "template.sales.w2"],
  booking:  ["template.booking.w1", "template.booking.w2"],
  lead:     ["template.lead.w1",    "template.lead.w2"],
  order:    ["template.order.w1",   "template.order.w2"],
  custom:   ["template.custom.w1"],
};

export function StepWelcome({ data, onChange }: Props) {
  const { t } = useI18n();
  const [newButtonText, setNewButtonText] = useState("");

  const addButton = () => {
    if (!newButtonText.trim()) return;
    onChange({
      starter_buttons: [...data.starter_buttons, { text: newButtonText.trim(), action_type: "quick_reply" }],
    });
    setNewButtonText("");
  };

  const removeButton = (idx: number) => {
    onChange({ starter_buttons: data.starter_buttons.filter((_, i) => i !== idx) });
  };

  const templateKeys = data.bot_type ? (WELCOME_TEMPLATE_KEYS[data.bot_type] ?? []) : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-foreground">{t("wizard.welcome_title")}</h2>
        <p className="text-sm text-muted-foreground">{t("wizard.welcome_desc")}</p>
      </div>

      {/* Welcome message with template chips */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5 text-sm">
          <Hand className="h-3.5 w-3.5" /> {t("wizard.welcome_msg")} *
        </Label>

        {/* Template quick-fill buttons */}
        {templateKeys.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> {t("wizard.welcome_templates_hint")}
            </p>
            <div className="flex flex-wrap gap-2">
              {templateKeys.map((key) => {
                const text = t(key as any);
                const isActive = data.welcome_message === text;
                return (
                  <button
                    key={key}
                    onClick={() => onChange({ welcome_message: text })}
                    className={`rounded-lg border px-3 py-1.5 text-xs text-left transition-colors max-w-xs truncate ${
                      isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:bg-primary/5"
                    }`}
                  >
                    {text.split("\n")[0]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <Textarea
          value={data.welcome_message}
          onChange={(e) => onChange({ welcome_message: e.target.value })}
          placeholder={t("wizard.welcome_msg_placeholder")}
          rows={4}
          className="bg-background/50 resize-none"
        />
      </div>

      {/* Starter buttons */}
      <div className="space-y-3">
        <Label className="text-sm">{t("wizard.starter_buttons")}</Label>
        <div className="flex flex-wrap gap-2">
          {data.starter_buttons.map((btn, i) => (
            <div key={i} className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm">
              {btn.text}
              <button onClick={() => removeButton(i)} className="ml-1 text-muted-foreground hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newButtonText}
            onChange={(e) => setNewButtonText(e.target.value)}
            placeholder={t("wizard.starter_placeholder")}
            className="bg-background/50"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addButton())}
          />
          <Button variant="outline" size="sm" onClick={addButton} className="shrink-0 gap-1">
            <Plus className="h-3.5 w-3.5" /> {t("wizard.add")}
          </Button>
        </div>
      </div>

      {/* Fallback message */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5 text-sm">
          <MessageSquare className="h-3.5 w-3.5" /> {t("wizard.fallback_msg")}
        </Label>
        <Textarea
          value={data.fallback_message}
          onChange={(e) => onChange({ fallback_message: e.target.value })}
          placeholder={t("wizard.fallback_placeholder")}
          rows={3}
          className="bg-background/50 resize-none"
        />
      </div>
    </div>
  );
}
