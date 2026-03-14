import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { WizardData, BOT_TYPES, BOT_ACTIONS, DataField } from "./types";
import { Plus, X, GripVertical, Zap, Database } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";

interface Props {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
}

const FIELD_TYPE_KEYS = [
  { value: "text", key: "field.text" },
  { value: "phone", key: "field.phone" },
  { value: "date", key: "field.date" },
  { value: "number", key: "field.number" },
  { value: "select", key: "field.select" },
] as const;

const BOT_TYPE_KEYS: Record<string, { label: string; desc: string }> = {
  sales: { label: "bottype.sales", desc: "bottype.sales_desc" },
  booking: { label: "bottype.booking", desc: "bottype.booking_desc" },
  support: { label: "bottype.support", desc: "bottype.support_desc" },
  lead: { label: "bottype.lead", desc: "bottype.lead_desc" },
  faq: { label: "bottype.faq", desc: "bottype.faq_desc" },
  order: { label: "bottype.order", desc: "bottype.order_desc" },
  custom: { label: "bottype.custom", desc: "bottype.custom_desc" },
};

const ACTION_KEYS: Record<string, string> = {
  "Answer questions": "action.answer_questions",
  "Recommend products": "action.recommend_products",
  "Collect customer details": "action.collect_details",
  "Create booking": "action.create_booking",
  "Reschedule booking": "action.reschedule",
  "Cancel booking": "action.cancel_booking",
  "Collect lead information": "action.collect_lead",
  "Create support ticket": "action.create_ticket",
  "Escalate to human": "action.escalate",
  "Offer alternatives": "action.offer_alternatives",
  "Ask clarifying questions": "action.clarifying_questions",
  "Send confirmation message": "action.send_confirmation",
  "Notify manager": "action.notify_manager",
  "Save order": "action.save_order",
  "Save lead": "action.save_lead",
  "Send webhook": "action.send_webhook",
};

export function StepActionsData({ data, onChange }: Props) {
  const { t } = useI18n();
  const [newFieldName, setNewFieldName] = useState("");

  const toggleAction = (action: string) => {
    const next = data.bot_actions.includes(action)
      ? data.bot_actions.filter((a) => a !== action)
      : [...data.bot_actions, action];
    onChange({ bot_actions: next });
  };

  const addField = () => {
    if (!newFieldName.trim()) return;
    const field: DataField = {
      id: crypto.randomUUID(),
      field_name: newFieldName.trim().toLowerCase().replace(/\s+/g, "_"),
      label: newFieldName.trim(),
      required: true,
      type: "text",
      ask_order: data.data_fields.length + 1,
    };
    onChange({ data_fields: [...data.data_fields, field] });
    setNewFieldName("");
  };

  const updateField = (id: string, patch: Partial<DataField>) => {
    onChange({
      data_fields: data.data_fields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    });
  };

  const removeField = (id: string) => {
    onChange({ data_fields: data.data_fields.filter((f) => f.id !== id) });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-foreground">{t("wizard.actions_title")}</h2>
        <p className="text-sm text-muted-foreground">{t("wizard.actions_desc")}</p>
      </div>

      {/* Bot Type */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">{t("wizard.bot_type")}</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {BOT_TYPES.map((bt) => {
            const keys = BOT_TYPE_KEYS[bt.id];
            return (
              <button
                key={bt.id}
                onClick={() => onChange({ bot_type: bt.id })}
                className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center transition-all hover:border-primary/50 ${
                  data.bot_type === bt.id
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card/50"
                }`}
              >
                <span className="text-2xl">{bt.icon}</span>
                <span className="text-xs font-semibold text-foreground">{keys ? t(keys.label as any) : bt.label}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">{keys ? t(keys.desc as any) : bt.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bot Actions */}
      <div className="space-y-3">
        <Label className="flex items-center gap-1.5 text-sm font-medium">
          <Zap className="h-3.5 w-3.5" /> {t("wizard.bot_actions")}
        </Label>
        <div className="flex flex-wrap gap-2">
          {BOT_ACTIONS.map((action) => (
            <button
              key={action}
              onClick={() => toggleAction(action)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                data.bot_actions.includes(action)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card/50 text-muted-foreground hover:border-primary/30"
              }`}
            >
              {ACTION_KEYS[action] ? t(ACTION_KEYS[action] as any) : action}
            </button>
          ))}
        </div>
      </div>

      {/* Data Collection Fields */}
      <div className="space-y-3">
        <Label className="flex items-center gap-1.5 text-sm font-medium">
          <Database className="h-3.5 w-3.5" /> {t("wizard.data_fields")}
        </Label>
        <p className="text-xs text-muted-foreground">{t("wizard.data_fields_desc")}</p>

        {data.data_fields.length > 0 && (
          <div className="space-y-2">
            {data.data_fields.map((field) => (
              <Card key={field.id} className="p-3 bg-muted/20 flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 grid grid-cols-3 gap-2 items-center">
                  <Input
                    value={field.label}
                    onChange={(e) => updateField(field.id, { label: e.target.value, field_name: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                    className="h-8 text-xs bg-background/50"
                    placeholder={t("field.name_placeholder")}
                  />
                  <Select value={field.type} onValueChange={(v) => updateField(field.id, { type: v as DataField["type"] })}>
                    <SelectTrigger className="h-8 text-xs bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPE_KEYS.map((ft) => (
                        <SelectItem key={ft.value} value={ft.value}>{t(ft.key as any)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={field.required}
                      onCheckedChange={(v) => updateField(field.id, { required: !!v })}
                    />
                    <span className="text-xs text-muted-foreground">{t("wizard.required")}</span>
                  </div>
                </div>
                <button onClick={() => removeField(field.id)} className="text-muted-foreground hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              </Card>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            value={newFieldName}
            onChange={(e) => setNewFieldName(e.target.value)}
            placeholder={t("wizard.field_placeholder")}
            className="bg-background/50"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addField())}
          />
          <Button variant="outline" size="sm" onClick={addField} className="shrink-0 gap-1">
            <Plus className="h-3.5 w-3.5" /> {t("wizard.add")}
          </Button>
        </div>
      </div>
    </div>
  );
}
