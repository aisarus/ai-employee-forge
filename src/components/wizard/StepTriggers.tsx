import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WizardData, ActionTrigger, IntegrationRule, TRIGGER_WHEN_OPTIONS, TRIGGER_ACTIONS } from "./types";
import { Plus, X, ArrowRight, Zap, GitBranch, ClipboardCheck, ChevronDown, ChevronUp, Bell } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";

interface Props {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
}

const WHEN_KEYS: Record<string, string> = {
  after_required_fields_collected: "trigger.after_fields",
  after_user_confirmation: "trigger.after_confirm",
  on_urgent_issue: "trigger.on_urgent",
  on_new_lead: "trigger.on_lead",
  on_booking_confirmed: "trigger.on_booking",
  on_manual_review: "trigger.on_review",
  on_every_message: "trigger.on_every_msg",
  custom_condition: "trigger.custom",
};

const ACTION_KEYS: Record<string, string> = {
  "Check availability": "trig_act.check_avail",
  "Create order": "trig_act.create_order",
  "Update order": "trig_act.update_order",
  "Create booking": "trig_act.create_booking",
  "Reschedule booking": "trig_act.reschedule",
  "Cancel booking": "trig_act.cancel_booking",
  "Create support ticket": "trig_act.create_ticket",
  "Create lead": "trig_act.create_lead",
  "Save to Google Sheets": "trig_act.save_sheets",
  "Send email notification": "trig_act.send_email",
  "Send Telegram notification": "trig_act.send_tg",
  "Call webhook": "trig_act.call_webhook",
  "Call custom API": "trig_act.call_api",
};

const POLICY_KEYS: Record<string, string> = {
  ask_before_send: "trigger.policy_ask",
  automatic: "trigger.policy_auto",
  draft_only: "trigger.policy_draft",
};

export function StepTriggers({ data, onChange }: Props) {
  const { t } = useI18n();
  const [newTrigName, setNewTrigName] = useState("");
  const [newTrigWhen, setNewTrigWhen] = useState<string>(TRIGGER_WHEN_OPTIONS[0]);
  const [newTrigAction, setNewTrigAction] = useState("");
  const [newTrigDest, setNewTrigDest] = useState("");
  const [newTrigPolicy, setNewTrigPolicy] = useState<ActionTrigger["confirmation_policy"]>("automatic");

  const [newRuleIf, setNewRuleIf] = useState("");
  const [newRuleThen, setNewRuleThen] = useState("");
  const [showSummary, setShowSummary] = useState(true);

  const addTrigger = () => {
    if (!newTrigName.trim() || !newTrigAction) return;
    const trigger: ActionTrigger = {
      id: crypto.randomUUID(),
      name: newTrigName.trim(),
      when: newTrigWhen,
      action_type: newTrigAction,
      target_destination: newTrigDest,
      confirmation_policy: newTrigPolicy,
    };
    onChange({ action_triggers: [...data.action_triggers, trigger] });
    setNewTrigName("");
    setNewTrigAction("");
    setNewTrigDest("");
  };

  const removeTrigger = (id: string) => {
    onChange({ action_triggers: data.action_triggers.filter((tr) => tr.id !== id) });
  };

  const addRule = () => {
    if (!newRuleIf.trim() || !newRuleThen.trim()) return;
    const rule: IntegrationRule = {
      id: crypto.randomUUID(),
      if_condition: newRuleIf.trim(),
      then_action: newRuleThen.trim(),
    };
    onChange({ integration_rules: [...data.integration_rules, rule] });
    setNewRuleIf("");
    setNewRuleThen("");
  };

  const removeRule = (id: string) => {
    onChange({ integration_rules: data.integration_rules.filter((r) => r.id !== id) });
  };

  const writeDestinations = data.data_sources.filter((ds) => ds.mode === "write");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-foreground">{t("wizard.trig_title")}</h2>
        <p className="text-sm text-muted-foreground">{t("wizard.trig_desc")}</p>
      </div>

      {/* Action Triggers */}
      <div className="space-y-3">
        <Label className="flex items-center gap-1.5 text-sm font-medium">
          <Bell className="h-3.5 w-3.5" /> {t("wizard.trig_actions")}
        </Label>

        {data.action_triggers.length > 0 && (
          <div className="space-y-2">
            {data.action_triggers.map((tr) => (
              <Card key={tr.id} className="p-3 bg-muted/20 flex items-center gap-2 flex-wrap">
                <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-xs font-semibold text-foreground">{tr.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {WHEN_KEYS[tr.when] ? t(WHEN_KEYS[tr.when] as any) : tr.when}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-foreground">
                  {ACTION_KEYS[tr.action_type] ? t(ACTION_KEYS[tr.action_type] as any) : tr.action_type}
                </span>
                {tr.target_destination && (
                  <span className="text-[10px] text-muted-foreground">→ {tr.target_destination}</span>
                )}
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  tr.confirmation_policy === "automatic" ? "bg-success/10 text-success" :
                  tr.confirmation_policy === "ask_before_send" ? "bg-warning/10 text-warning" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {POLICY_KEYS[tr.confirmation_policy] ? t(POLICY_KEYS[tr.confirmation_policy] as any) : tr.confirmation_policy}
                </span>
                <button onClick={() => removeTrigger(tr.id)} className="text-muted-foreground hover:text-destructive ml-auto shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              </Card>
            ))}
          </div>
        )}

        <Card className="p-3 space-y-2 bg-background/50 border-dashed">
          <div className="grid grid-cols-2 gap-2">
            <Input value={newTrigName} onChange={(e) => setNewTrigName(e.target.value)} placeholder={t("wizard.trig_name_ph")} className="h-8 text-xs bg-background/50" />
            <Select value={newTrigWhen} onValueChange={(v) => setNewTrigWhen(v)}>
              <SelectTrigger className="h-8 text-xs bg-background/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRIGGER_WHEN_OPTIONS.map((w) => (
                  <SelectItem key={w} value={w}>{WHEN_KEYS[w] ? t(WHEN_KEYS[w] as any) : w}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={newTrigAction} onValueChange={setNewTrigAction}>
              <SelectTrigger className="h-8 text-xs bg-background/50"><SelectValue placeholder={t("wizard.trig_action_ph")} /></SelectTrigger>
              <SelectContent>
                {TRIGGER_ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>{ACTION_KEYS[a] ? t(ACTION_KEYS[a] as any) : a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-1">
              {writeDestinations.length > 0 ? (
                <Select value={newTrigDest} onValueChange={setNewTrigDest}>
                  <SelectTrigger className="h-8 text-xs bg-background/50 flex-1"><SelectValue placeholder={t("wizard.trig_dest_ph")} /></SelectTrigger>
                  <SelectContent>
                    {writeDestinations.map((ds) => (
                      <SelectItem key={ds.id} value={ds.name}>{ds.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={newTrigDest} onChange={(e) => setNewTrigDest(e.target.value)} placeholder={t("wizard.trig_dest_ph")} className="h-8 text-xs bg-background/50" />
              )}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <Select value={newTrigPolicy} onValueChange={(v) => setNewTrigPolicy(v as ActionTrigger["confirmation_policy"])}>
              <SelectTrigger className="h-8 text-xs bg-background/50 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["ask_before_send", "automatic", "draft_only"] as const).map((p) => (
                  <SelectItem key={p} value={p}>{POLICY_KEYS[p] ? t(POLICY_KEYS[p] as any) : p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={addTrigger} className="shrink-0 gap-1 ml-auto" disabled={!newTrigName.trim() || !newTrigAction}>
              <Plus className="h-3.5 w-3.5" /> {t("wizard.add")}
            </Button>
          </div>
        </Card>
      </div>

      {/* Integration Rules */}
      <div className="space-y-3">
        <Label className="flex items-center gap-1.5 text-sm font-medium">
          <GitBranch className="h-3.5 w-3.5" /> {t("wizard.trig_rules")}
        </Label>

        {data.integration_rules.length > 0 && (
          <div className="space-y-2">
            {data.integration_rules.map((rule) => (
              <Card key={rule.id} className="p-3 bg-muted/20 flex items-center gap-2">
                <span className="text-xs font-bold text-primary shrink-0">IF</span>
                <span className="text-xs text-foreground flex-1 truncate">{rule.if_condition}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-xs font-bold text-success shrink-0">THEN</span>
                <span className="text-xs text-foreground flex-1 truncate">{rule.then_action}</span>
                <button onClick={() => removeRule(rule.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              </Card>
            ))}
          </div>
        )}

        <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center">
          <Input value={newRuleIf} onChange={(e) => setNewRuleIf(e.target.value)} placeholder={t("wizard.trig_if_ph")} className="bg-background/50 text-xs" />
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <Input value={newRuleThen} onChange={(e) => setNewRuleThen(e.target.value)} placeholder={t("wizard.trig_then_ph")} className="bg-background/50 text-xs" />
          <Button variant="outline" size="sm" onClick={addRule} disabled={!newRuleIf.trim() || !newRuleThen.trim()}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Integration Summary */}
      <button
        onClick={() => setShowSummary(!showSummary)}
        className="w-full flex items-center justify-between rounded-lg border border-border p-3 bg-muted/20 hover:bg-muted/30 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <ClipboardCheck className="h-4 w-4 text-primary" /> {t("wizard.trig_summary")}
        </span>
        {showSummary ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {showSummary && (
        <Card className="p-4 bg-muted/20 space-y-2 text-sm">
          {data.connectors.length > 0 && (
            <p><span className="text-muted-foreground">{t("wizard.trig_sum_conn")}</span> <span className="text-foreground">{data.connectors.map((c) => c.display_name).join(", ")}</span></p>
          )}
          {data.data_sources.filter((d) => d.mode === "read").length > 0 && (
            <p><span className="text-muted-foreground">{t("wizard.trig_sum_reads")}</span> <span className="text-foreground">{data.data_sources.filter((d) => d.mode === "read").map((d) => d.name).join(", ")}</span></p>
          )}
          {data.data_sources.filter((d) => d.mode === "write").length > 0 && (
            <p><span className="text-muted-foreground">{t("wizard.trig_sum_writes")}</span> <span className="text-foreground">{data.data_sources.filter((d) => d.mode === "write").map((d) => d.name).join(", ")}</span></p>
          )}
          {data.action_triggers.length > 0 && (
            <p><span className="text-muted-foreground">{t("wizard.trig_sum_triggers")}</span> <span className="text-foreground">{data.action_triggers.length} {t("wizard.configured")}</span></p>
          )}
          {data.field_mappings.length > 0 && (
            <p><span className="text-muted-foreground">{t("wizard.trig_sum_mappings")}</span> <span className="text-foreground">{data.field_mappings.length} {t("wizard.fields_count")}</span></p>
          )}
          {data.integration_rules.length > 0 && (
            <p><span className="text-muted-foreground">{t("wizard.trig_sum_rules")}</span> <span className="text-foreground">{data.integration_rules.length} {t("wizard.rules_count")}</span></p>
          )}
          {data.connectors.length === 0 && data.action_triggers.length === 0 && (
            <p className="text-muted-foreground italic">{t("wizard.trig_sum_empty")}</p>
          )}
        </Card>
      )}
    </div>
  );
}
