import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { WizardData, BOT_TYPES, BOT_ACTIONS, DataField } from "./types";
import { Plus, X, GripVertical, Zap, Database } from "lucide-react";

interface Props {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
}

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "phone", label: "Phone" },
  { value: "date", label: "Date" },
  { value: "number", label: "Number" },
  { value: "select", label: "Select" },
] as const;

export function StepActionsData({ data, onChange }: Props) {
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
        <h2 className="text-xl font-bold text-foreground">What Your Bot Can Do</h2>
        <p className="text-sm text-muted-foreground">Choose the bot type, actions, and data it should collect.</p>
      </div>

      {/* Bot Type */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Bot Type</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {BOT_TYPES.map((bt) => (
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
              <span className="text-xs font-semibold text-foreground">{bt.label}</span>
              <span className="text-[10px] text-muted-foreground leading-tight">{bt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bot Actions */}
      <div className="space-y-3">
        <Label className="flex items-center gap-1.5 text-sm font-medium">
          <Zap className="h-3.5 w-3.5" /> Bot Actions
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
              {action}
            </button>
          ))}
        </div>
      </div>

      {/* Data Collection Fields */}
      <div className="space-y-3">
        <Label className="flex items-center gap-1.5 text-sm font-medium">
          <Database className="h-3.5 w-3.5" /> Data Collection Fields
        </Label>
        <p className="text-xs text-muted-foreground">Define what information the bot should collect from users.</p>

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
                    placeholder="Field name"
                  />
                  <Select value={field.type} onValueChange={(v) => updateField(field.id, { type: v as DataField["type"] })}>
                    <SelectTrigger className="h-8 text-xs bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((ft) => (
                        <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={field.required}
                      onCheckedChange={(v) => updateField(field.id, { required: !!v })}
                    />
                    <span className="text-xs text-muted-foreground">Required</span>
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
            placeholder="e.g., Phone Number, Delivery Address"
            className="bg-background/50"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addField())}
          />
          <Button variant="outline" size="sm" onClick={addField} className="shrink-0 gap-1">
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </div>
    </div>
  );
}
