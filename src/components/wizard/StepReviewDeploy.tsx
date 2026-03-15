import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { WizardData, BOT_TYPES } from "./types";
import { Bot, Send, CheckCircle2, AlertCircle, Zap, Workflow, Plug, Brain, Key } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";

interface Props {
  data: WizardData;
  confirmed: boolean;
  onConfirmChange: (v: boolean) => void;
}

export function StepReviewDeploy({ data, confirmed, onConfirmChange }: Props) {
  const { t } = useI18n();

  const openaiKeyOk = !!data.openai_api_key.trim() && data.openai_api_key.startsWith("sk-");
  const tokenOk     = !!data.telegram_bot_token.trim();

  const checks = [
    { label: t("wizard.bot_name"),      ok: !!data.bot_name.trim() },
    { label: t("wizard.short_desc"),    ok: !!data.short_description.trim() },
    { label: t("wizard.welcome_msg"),   ok: !!data.welcome_message.trim() },
    { label: t("wizard.openai_key_label"), ok: openaiKeyOk },
    { label: t("wizard.bot_token"),     ok: tokenOk },
    { label: t("wizard.display_name"),  ok: !!(data.telegram_display_name || data.bot_name).trim() },
  ];

  const allOk = checks.every((c) => c.ok);
  const botType = BOT_TYPES.find((tp) => tp.id === data.bot_type);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-foreground">{t("wizard.review_title")}</h2>
        <p className="text-sm text-muted-foreground">{t("wizard.review_desc")}</p>
      </div>

      {/* Identity */}
      <Card className="p-4 space-y-2 bg-muted/30">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" /> {t("wizard.identity_section")}
        </h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {botType && (
            <>
              <span className="text-muted-foreground">{t("wizard.summary_type")}</span>
              <span className="text-foreground font-medium">{botType.icon} {t(`bottype.${botType.id}` as any)}</span>
            </>
          )}
          <span className="text-muted-foreground">{t("wizard.name")}</span>
          <span className="text-foreground font-medium">{data.bot_name || "—"}</span>
          <span className="text-muted-foreground">{t("wizard.language")}</span>
          <span className="text-foreground">{data.default_language}</span>
          <span className="text-muted-foreground">{t("wizard.tone")}</span>
          <span className="text-foreground">{data.tone}</span>
        </div>
      </Card>

      {/* Actions & data — only shown if relevant */}
      {(data.bot_actions.length > 0 || data.data_fields.length > 0) && (
        <Card className="p-4 space-y-2 bg-muted/30">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> {t("wizard.actions_data_section")}
          </h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {data.bot_actions.length > 0 && (
              <>
                <span className="text-muted-foreground">{t("wizard.summary_actions")}</span>
                <span className="text-foreground">{data.bot_actions.length} {t("wizard.configured")}</span>
              </>
            )}
            {data.data_fields.length > 0 && (
              <>
                <span className="text-muted-foreground">{t("wizard.data_fields_label")}</span>
                <span className="text-foreground">{data.data_fields.length} {t("wizard.fields_count")}</span>
              </>
            )}
          </div>
        </Card>
      )}

      {/* Logic & workflow — only shown if configured */}
      {(data.workflow_steps.length > 0 || data.logic_rules.length > 0) && (
        <Card className="p-4 space-y-2 bg-muted/30">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Workflow className="h-4 w-4 text-primary" /> {t("wizard.logic_workflow_section")}
          </h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {data.workflow_steps.length > 0 && (
              <>
                <span className="text-muted-foreground">{t("wizard.workflow_steps")}</span>
                <span className="text-foreground">{data.workflow_steps.length} {t("wizard.steps_count")}</span>
              </>
            )}
            {data.logic_rules.length > 0 && (
              <>
                <span className="text-muted-foreground">{t("wizard.logic_rules")}</span>
                <span className="text-foreground">{data.logic_rules.length} {t("wizard.rules_count")}</span>
              </>
            )}
          </div>
        </Card>
      )}

      {/* Integrations — only shown if connected */}
      {(data.connectors.length > 0 || data.action_triggers.length > 0) && (
        <Card className="p-4 space-y-2 bg-muted/30">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Plug className="h-4 w-4 text-primary" /> {t("wizard.connections")}
          </h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {data.connectors.length > 0 && (
              <>
                <span className="text-muted-foreground">{t("wizard.trig_sum_conn")}</span>
                <span className="text-foreground">{data.connectors.map((c) => c.display_name).join(", ")}</span>
              </>
            )}
            {data.action_triggers.length > 0 && (
              <>
                <span className="text-muted-foreground">{t("wizard.trig_sum_triggers")}</span>
                <span className="text-foreground">{data.action_triggers.length} {t("wizard.configured")}</span>
              </>
            )}
          </div>
        </Card>
      )}

      {/* API Keys status */}
      <Card className="p-4 space-y-2 bg-muted/30">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" /> {t("wizard.review_keys_section")}
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Brain className="h-3.5 w-3.5" /> {t("wizard.openai_key_label")}
            </span>
            {openaiKeyOk ? (
              <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" /> {t("wizard.review_key_set")}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-destructive text-xs font-medium">
                <AlertCircle className="h-3.5 w-3.5" /> {t("wizard.review_key_missing")}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Key className="h-3.5 w-3.5" /> {t("wizard.bot_token")}
            </span>
            {tokenOk ? (
              <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" /> {t("wizard.review_key_set")}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-destructive text-xs font-medium">
                <AlertCircle className="h-3.5 w-3.5" /> {t("wizard.review_key_missing")}
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Telegram settings */}
      <Card className="p-4 space-y-2 bg-muted/30">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Send className="h-4 w-4 text-primary" /> {t("wizard.telegram_section")}
        </h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <span className="text-muted-foreground">{t("wizard.display_name")}</span>
          <span className="text-foreground font-medium">{data.telegram_display_name || data.bot_name || "—"}</span>
          <span className="text-muted-foreground">{t("wizard.description_label")}</span>
          <span className="text-foreground truncate">{data.telegram_short_description || data.short_description || "—"}</span>
          <span className="text-muted-foreground">{t("wizard.commands")}</span>
          <span className="text-foreground">{data.telegram_commands.length} {t("wizard.commands_count")}</span>
        </div>
      </Card>

      {/* Deployment checklist */}
      <Card className="p-4 space-y-2 bg-muted/30">
        <h3 className="text-sm font-semibold text-foreground">{t("wizard.checklist")}</h3>
        <div className="space-y-1.5">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-2 text-sm">
              {c.ok
                ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                : <AlertCircle  className="h-4 w-4 text-destructive shrink-0" />}
              <span className={c.ok ? "text-foreground" : "text-destructive"}>{c.label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Confirm checkbox */}
      <div className="flex items-start gap-3 rounded-lg border border-border p-4 bg-background/50">
        <Checkbox
          id="confirm"
          checked={confirmed}
          onCheckedChange={(v) => onConfirmChange(!!v)}
          disabled={!allOk}
        />
        <label htmlFor="confirm" className="text-sm leading-relaxed cursor-pointer text-foreground">
          {t("wizard.confirm_label")}
        </label>
      </div>

      {!allOk && (
        <p className="text-xs text-destructive text-center">{t("wizard.fill_required")}</p>
      )}
    </div>
  );
}
