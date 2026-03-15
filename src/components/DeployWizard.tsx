import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WizardData, DEFAULT_WIZARD_DATA, getWizardSteps, BOT_TYPE_PRESETS } from "./wizard/types";
import { StepBotType } from "./wizard/StepBotType";
import { StepIdentity } from "./wizard/StepIdentity";
import { StepWelcome } from "./wizard/StepWelcome";
import { StepActionsData } from "./wizard/StepActionsData";
import { StepWorkflowLogic } from "./wizard/StepWorkflowLogic";
import { StepConnections } from "./wizard/StepConnections";
import { StepDataMapping } from "./wizard/StepDataMapping";
import { StepTriggers } from "./wizard/StepTriggers";
import { StepBehaviorPreview } from "./wizard/StepBehaviorPreview";
import { StepApiKeys } from "./wizard/StepApiKeys";
import { StepTelegramConfig } from "./wizard/StepTelegramConfig";
import { StepTelegramPreview } from "./wizard/StepTelegramPreview";
import { StepReviewDeploy } from "./wizard/StepReviewDeploy";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Rocket, Loader2, CheckCircle, Send } from "lucide-react";
import { buildActionsPromptBlock } from "./wizard/promptBuilder";
import { useI18n } from "@/hooks/useI18n";

interface DeployWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId?: string;
  systemPrompt?: string;
  initialData?: Partial<WizardData>;
}

const STEP_I18N: Record<string, string> = {
  bot_type:         "wizard.step_bot_type",
  identity:         "wizard.identity",
  welcome:          "wizard.welcome",
  actions:          "wizard.actions",
  workflow:         "wizard.workflow",
  connections:      "wizard.connections",
  data_mapping:     "wizard.data_mapping",
  triggers:         "wizard.triggers",
  preview:          "wizard.preview",
  api_keys:         "wizard.step_api_keys",
  telegram_config:  "wizard.telegram_config",
  telegram_preview: "wizard.telegram_preview",
  deploy:           "wizard.deploy",
};

export function DeployWizard({ open, onOpenChange, agentId, systemPrompt = "", initialData }: DeployWizardProps) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>({ ...DEFAULT_WIZARD_DATA, ...initialData });
  const [confirmed, setConfirmed] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState(false);
  const [botUsername, setBotUsername] = useState("");

  const activeSteps = getWizardSteps(data.bot_type);
  const currentStepId = activeSteps[step] ?? "bot_type";
  const isLastStep = step === activeSteps.length - 1;

  useEffect(() => {
    if (open) {
      setStep(0);
      setDeployed(false);
      setConfirmed(false);
      const storedKey = localStorage.getItem("userOpenAiKey") || "";
      let draft: Partial<WizardData> = {};
      if (agentId) {
        try {
          const raw = sessionStorage.getItem(`wizard_draft_${agentId}`);
          if (raw) draft = JSON.parse(raw) as Partial<WizardData>;
        } catch {}
      }
      const merged: WizardData = {
        ...DEFAULT_WIZARD_DATA,
        ...draft,
        ...initialData,
        openai_api_key: initialData?.openai_api_key || draft.openai_api_key || storedKey,
        telegram_display_name: initialData?.bot_name || draft.telegram_display_name || "",
        telegram_short_description: initialData?.short_description || draft.telegram_short_description || "",
        telegram_about_text: initialData?.about_text || draft.telegram_about_text || "",
      };
      setData(merged);
      if (draft.bot_type && !initialData) {
        const savedStep = Number(sessionStorage.getItem(`wizard_step_${agentId}`) || 0);
        setStep(Math.max(0, savedStep));
      }
    }
  }, [open, initialData]);

  const persistData = (d: WizardData) => {
    if (agentId) {
      try { sessionStorage.setItem(`wizard_draft_${agentId}`, JSON.stringify(d)); } catch {}
    }
  };

  const onChange = (patch: Partial<WizardData>) => {
    setData((prev) => {
      const next = { ...prev, ...patch };
      if (patch.bot_name !== undefined && !prev.telegram_display_name) {
        next.telegram_display_name = patch.bot_name;
      }
      if (patch.short_description !== undefined && !prev.telegram_short_description) {
        next.telegram_short_description = patch.short_description;
      }
      if (patch.about_text !== undefined && !prev.telegram_about_text) {
        next.telegram_about_text = patch.about_text;
      }
      return next;
    });

    setTimeout(() => setData((d) => { persistData(d); return d; }), 0);

    if (patch.bot_type !== undefined && patch.bot_type !== data.bot_type && patch.bot_type !== "") {
      const preset = BOT_TYPE_PRESETS[patch.bot_type];
      if (preset) {
        setData((prev) => ({
          ...prev,
          ...patch,
          welcome_message:   prev.welcome_message   || t(preset.welcome_message_key  as any),
          fallback_message:  prev.fallback_message  || t(preset.fallback_message_key as any),
          bot_actions:       prev.bot_actions.length   > 0 ? prev.bot_actions   : preset.bot_actions,
          starter_buttons:   prev.starter_buttons.length > 0 ? prev.starter_buttons : preset.starter_buttons,
          data_fields:       prev.data_fields.length    > 0 ? prev.data_fields   : preset.data_fields,
          telegram_commands: prev.telegram_commands.filter(c => c.command !== "/start" && c.command !== "/help").length > 0
            ? prev.telegram_commands
            : preset.telegram_commands,
        }));
        setStep(1);
        if (agentId) sessionStorage.setItem(`wizard_step_${agentId}`, "1");
        return;
      }
      setStep(1);
      if (agentId) sessionStorage.setItem(`wizard_step_${agentId}`, "1");
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (!agentId) {
      const url = URL.createObjectURL(file);
      setData((prev) => ({ ...prev, bot_avatar_url: url, bot_avatar_file: file }));
      return;
    }
    try {
      const path = `${agentId}/avatar.png`;
      const { error } = await supabase.storage.from("bot-avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("bot-avatars").getPublicUrl(path);
      setData((prev) => ({ ...prev, bot_avatar_url: urlData.publicUrl + "?t=" + Date.now(), bot_avatar_file: null }));
      toast.success(t("wizard.avatar_uploaded"));
    } catch (err: any) {
      toast.error(t("wizard.upload_failed") + " " + err.message);
    }
  };

  const handleAvatarRemove = () => {
    setData((prev) => ({ ...prev, bot_avatar_url: "", bot_avatar_file: null }));
  };

  const getEnrichedPrompt = () => {
    const actionsBlock = buildActionsPromptBlock(data);
    if (!actionsBlock) return systemPrompt;
    return systemPrompt + "\n\n" + actionsBlock;
  };

  const handleDeploy = async () => {
    if (!agentId) {
      toast.error(t("wizard.no_agent"));
      return;
    }
    setDeploying(true);
    try {
      if (data.bot_avatar_file) {
        const path = `${agentId}/avatar.png`;
        await supabase.storage.from("bot-avatars").upload(path, data.bot_avatar_file, { upsert: true });
        const { data: urlData } = supabase.storage.from("bot-avatars").getPublicUrl(path);
        data.bot_avatar_url = urlData.publicUrl;
      }

      const enrichedPrompt = getEnrichedPrompt();

      await supabase.from("agents").update({
        name: data.bot_name,
        description: data.short_description,
        about_text: data.about_text,
        bot_username_hint: data.bot_username_hint,
        default_language: data.default_language,
        tone: data.tone.toLowerCase(),
        response_style: data.response_style.toLowerCase(),
        welcome_message: data.welcome_message,
        fallback_message: data.fallback_message,
        bot_avatar_url: data.bot_avatar_url,
        bot_type: data.bot_type,
        openai_api_key: data.openai_api_key,
        telegram_display_name: data.telegram_display_name || data.bot_name,
        telegram_short_description: data.telegram_short_description || data.short_description,
        telegram_about_text: data.telegram_about_text || data.about_text,
        telegram_commands: data.telegram_commands as any,
        system_prompt: enrichedPrompt,
        structured_prompt: {
          bot_type: data.bot_type,
          bot_actions: data.bot_actions,
          data_fields: data.data_fields,
          workflow_steps: data.workflow_steps,
          logic_rules: data.logic_rules,
          external_actions: data.external_actions,
          connectors: data.connectors.map(({ auth_value, ...c }) => c),
          data_sources: data.data_sources,
          field_mappings: data.field_mappings,
          action_triggers: data.action_triggers,
          integration_rules: data.integration_rules,
        } as any,
      }).eq("id", agentId);

      const { data: deployRes, error } = await supabase.functions.invoke("deploy-telegram", {
        body: {
          agentId,
          telegramToken: data.telegram_bot_token,
          openaiApiKey: data.openai_api_key,
          displayName: data.telegram_display_name || data.bot_name,
          shortDescription: data.telegram_short_description || data.short_description,
          aboutText: data.telegram_about_text || data.about_text,
          commands: data.telegram_commands,
        },
      });

      if (error) throw error;
      if (deployRes?.error) {
        const errKey = deployRes.error as string;
        const knownKey = errKey.startsWith("deploy_error.") ? errKey : null;
        const msg = knownKey ? t(knownKey as any) : errKey;
        const hint = deployRes.details ? ` (${deployRes.details})` : "";
        throw new Error(msg + hint);
      }

      if (agentId) {
        sessionStorage.removeItem(`wizard_draft_${agentId}`);
        sessionStorage.removeItem(`wizard_step_${agentId}`);
      }
      setBotUsername(deployRes?.botInfo?.username || "");
      setDeployed(true);
      toast.success(deployRes?.message || t("wizard.deployed"));
    } catch (err: any) {
      toast.error(err.message || t("wizard.deploy_failed"));
    } finally {
      setDeploying(false);
    }
  };

  const canNext = (): boolean => {
    switch (currentStepId) {
      case "bot_type":         return !!data.bot_type;
      case "identity":         return !!data.bot_name.trim() && !!data.short_description.trim();
      case "welcome":          return !!data.welcome_message.trim();
      case "api_keys":         return !!data.openai_api_key.trim() && data.openai_api_key.startsWith("sk-");
      case "telegram_config":  return !!data.telegram_bot_token.trim();
      case "deploy":           return confirmed;
      default:                 return true;
    }
  };

  // ── Deployed success screen ──────────────────────────────────────────────────
  if (deployed) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md border-border bg-card">
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="animate-scale-in">
              <Send className="h-14 w-14 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{t("wizard.deployed")}</p>
              {botUsername && (
                <p className="text-sm text-muted-foreground mt-2 animate-fade-in" style={{ animationDelay: "200ms" }}>
                  {t("wizard.bot_live")}{" "}
                  <a href={`https://t.me/${botUsername}`} target="_blank" rel="noopener" className="text-success underline font-medium">
                    @{botUsername}
                  </a>
                </p>
              )}
            </div>
            <button
              onClick={() => { setDeployed(false); onOpenChange(false); }}
              className="btn-gradient h-11 px-8 rounded-xl text-primary-foreground font-semibold text-sm animate-fade-in"
              style={{ animationDelay: "400ms" }}
            >
              <span className="relative z-10">{t("wizard.done")}</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Wizard dialog ────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-2xl h-[100dvh] sm:h-auto sm:max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-none sm:rounded-2xl border-border bg-card">

        {/* Progress header */}
        <div className="px-4 sm:px-6 pt-4 pb-3 border-b border-border/50 bg-card/80 shrink-0 space-y-3">
          {/* Step dots + connectors */}
          <div className="flex items-center gap-0.5">
            {activeSteps.map((sid, i) => (
              <div key={sid} className="flex items-center flex-1 min-w-0">
                <button
                  onClick={() => i < step && setStep(i)}
                  className={`flex shrink-0 items-center justify-center rounded-full font-bold transition-all duration-200
                    ${activeSteps.length > 9 ? "h-4 w-4 text-[8px]" : "h-5 w-5 text-[9px]"}
                    ${i === step
                      ? "bg-primary text-primary-foreground shadow-[0_0_10px_hsl(var(--primary)/0.6)] scale-110 ring-2 ring-primary/30"
                      : i < step
                        ? "bg-primary/25 text-primary cursor-pointer hover:bg-primary/40"
                        : "bg-muted text-muted-foreground"
                    }`}
                >
                  {i < step ? (
                    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="2,6 5,9 10,3" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </button>
                {i < activeSteps.length - 1 && (
                  <div className={`flex-1 h-px mx-0.5 transition-colors duration-300 ${i < step ? "bg-primary/40" : "bg-border"}`} />
                )}
              </div>
            ))}
          </div>

          {/* Current step info + counter */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground shrink-0">
                {step + 1}
              </span>
              <p className="text-sm font-semibold text-foreground">
                {t(STEP_I18N[currentStepId] as any) || currentStepId}
              </p>
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              {step + 1} <span className="text-muted-foreground/50">/</span> {activeSteps.length}
            </p>
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-auto px-6 py-5">
          {currentStepId === "bot_type"         && <StepBotType data={data} onChange={onChange} />}
          {currentStepId === "identity"         && <StepIdentity data={data} onChange={onChange} onAvatarUpload={handleAvatarUpload} onAvatarRemove={handleAvatarRemove} />}
          {currentStepId === "welcome"          && <StepWelcome data={data} onChange={onChange} />}
          {currentStepId === "actions"          && <StepActionsData data={data} onChange={onChange} />}
          {currentStepId === "workflow"         && <StepWorkflowLogic data={data} onChange={onChange} />}
          {currentStepId === "connections"      && <StepConnections data={data} onChange={onChange} />}
          {currentStepId === "data_mapping"     && <StepDataMapping data={data} onChange={onChange} />}
          {currentStepId === "triggers"         && <StepTriggers data={data} onChange={onChange} />}
          {currentStepId === "preview"          && <StepBehaviorPreview data={data} systemPrompt={getEnrichedPrompt()} />}
          {currentStepId === "api_keys"         && <StepApiKeys data={data} onChange={onChange} />}
          {currentStepId === "telegram_config"  && <StepTelegramConfig data={data} onChange={onChange} />}
          {currentStepId === "telegram_preview" && <StepTelegramPreview data={data} />}
          {currentStepId === "deploy"           && <StepReviewDeploy data={data} confirmed={confirmed} onConfirmChange={setConfirmed} />}
        </div>

        {/* Footer nav */}
        <div className="px-6 py-4 border-t border-border/50 bg-card/80 flex items-center justify-between shrink-0">
          <Button
            variant="outline"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" /> {t("wizard.back")}
          </Button>

          {isLastStep ? (
            <button
              onClick={handleDeploy}
              disabled={!confirmed || deploying}
              className={`btn-gradient h-11 px-8 rounded-xl text-primary-foreground font-semibold text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${confirmed ? "animate-pulse-glow" : ""}`}
            >
              {deploying ? <Loader2 className="h-4 w-4 animate-spin relative z-10" /> : <Rocket className="h-4 w-4 relative z-10" />}
              <span className="relative z-10">{deploying ? t("wizard.deploying") : t("wizard.deploy_telegram")}</span>
            </button>
          ) : (
            <Button
              onClick={() => {
                const next = step + 1;
                setStep(next);
                if (agentId) sessionStorage.setItem(`wizard_step_${agentId}`, String(next));
              }}
              disabled={!canNext()}
              className="gap-1"
            >
              {t("wizard.next")} <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
