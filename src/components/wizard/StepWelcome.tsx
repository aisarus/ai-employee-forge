import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { WizardData, StarterButton } from "./types";
import { Plus, X, MessageSquare, Hand } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";

interface Props {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
}

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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-foreground">{t("wizard.welcome_title")}</h2>
        <p className="text-sm text-muted-foreground">{t("wizard.welcome_desc")}</p>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5 text-sm"><Hand className="h-3.5 w-3.5" /> {t("wizard.welcome_msg")} *</Label>
        <Textarea
          value={data.welcome_message}
          onChange={(e) => onChange({ welcome_message: e.target.value })}
          placeholder={t("wizard.welcome_msg_placeholder")}
          rows={4}
          className="bg-background/50 resize-none"
        />
      </div>

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

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5 text-sm"><MessageSquare className="h-3.5 w-3.5" /> {t("wizard.fallback_msg")}</Label>
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
