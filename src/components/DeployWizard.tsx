import { useState, useEffect, useMemo } from "react";
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
import { ChevronLeft, ChevronRight, Rocket, Loader2 } from "lucide-react";
import { buildFullSystemPrompt } from "./wizard/promptBuilder";
import { useI18n } from "@/hooks/useI18n";
import { useConnectors } from "@/hooks/useConnectors";
import { encryptKey } from "@/lib/crypto";
import { cn } from "@/lib/utils";

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

const STEP_ICONS: Record<string, string> = {
  bot_type:         "🤖",
  identity:         "✨",
  welcome:          "👋",
  actions:          "⚡",
  workflow:         "🔄",
  connections:      "🔗",
  data_mapping:     "🗂️",
  triggers:         "🎯",
  preview:          "👁️",
  api_keys:         "🔑",
  telegram_config:  "📱",
  telegram_preview: "📲",
  deploy:           "🚀",
};

// Confetti colour palette
const CONF_COLORS = ["#7c3aed","#3b82f6","#10b981","#f59e0b","#ec4899","#06b6d4","#a78bfa","#34d399"];

export function DeployWizard({ open, onOpenChange, agentId, systemPrompt = "", initialData }: DeployWizardProps) {
  const { t } = useI18n();
  const { saveConnectors } = useConnectors();
  const [step, setStep] = useState(0);
  const [maxVisitedStep, setMaxVisitedStep] = useState(0);
  const [data, setData] = useState<WizardData>({ ...DEFAULT_WIZARD_DATA, ...initialData });
  const [confirmed, setConfirmed] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState(false);
  const [botUsername, setBotUsername] = useState("");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [stepKey, setStepKey] = useState(0);

  const activeSteps = getWizardSteps(data.bot_type);
  const currentStepId = activeSteps[step] ?? "bot_type";
  const isLastStep = step === activeSteps.length - 1;
  const progressPct = Math.round(((step + 1) / activeSteps.length) * 100);

  // Pre-generate confetti so it doesn't re-generate on re-render
  const confettiPieces = useMemo(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: `${(i / 40) * 100 + (Math.sin(i * 2.7) * 5)}%`,
      color: CONF_COLORS[i % CONF_COLORS.length],
      duration: `${2.2 + (i % 7) * 0.22}s`,
      delay: `${(i % 12) * 0.07}s`,
      cx: `${Math.sin(i * 1.3) * 120}px`,
      radius: i % 3 === 0 ? "50%" : i % 3 === 1 ? "2px" : "1px 4px",
    })),
  []);

  // ── Restore from localStorage on open ──────────────────────────────────────
  useEffect(() => {
    if (open) {
      setDeployed(false);
      setConfirmed(false);
      const storedKey = localStorage.getItem("userOpenAiKey") || "";
      let draft: Partial<WizardData> = {};
      if (agentId) {
        try {
          const raw = localStorage.getItem(`wizard_draft_${agentId}`);
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
      if (agentId) {
        const savedStep = Number(localStorage.getItem(`wizard_step_${agentId}`) || 0);
        const savedMax = Number(localStorage.getItem(`wizard_max_step_${agentId}`) || savedStep);
        setStep(Math.max(0, savedStep));
        setMaxVisitedStep(Math.max(0, savedMax));
      } else {
        setStep(0);
        setMaxVisitedStep(0);
      }
    }
  }, [open, initialData]);

  const persistData = (d: WizardData) => {
    if (agentId) {
      try { localStorage.setItem(`wizard_draft_${agentId}`, JSON.stringify(d)); } catch {}
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
        goToStep(1, "forward");
        if (agentId) localStorage.setItem(`wizard_step_${agentId}`, "1");
        return;
      }
      goToStep(1, "forward");
      if (agentId) localStorage.setItem(`wizard_step_${agentId}`, "1");
    }
  };

  const goToStep = (n: number, dir: "forward" | "back") => {
    setDirection(dir);
    setStepKey(k => k + 1);
    setStep(n);
    if (n > maxVisitedStep) {
      setMaxVisitedStep(n);
      if (agentId) localStorage.setItem(`wizard_max_step_${agentId}`, String(n));
    }
  };

  const saveIntegrationData = async () => {
    if (!agentId) return;
    try {
      const { data: existing } = await supabase
        .from("agents")
        .select("structured_prompt")
        .eq("id", agentId)
        .single();
      const current = (existing?.structured_prompt as Record<string, unknown>) ?? {};
      await supabase.from("agents").update({
        structured_prompt: {
          ...current,
          data_sources:      data.data_sources,
          field_mappings:    data.field_mappings,
          action_triggers:   data.action_triggers,
          integration_rules: data.integration_rules,
        } as any,
      }).eq("id", agentId);
    } catch {
      // non-fatal
    }
  };

  const goNext = async () => {
    if (currentStepId === "data_mapping" || currentStepId === "triggers") {
      await saveIntegrationData();
    }
    const next = step + 1;
    goToStep(next, "forward");
    if (agentId) {
      localStorage.setItem(`wizard_step_${agentId}`, String(next));
    }
  };

  const goBack = () => {
    goToStep(step - 1, "back");
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

  const getEnrichedPrompt = () => buildFullSystemPrompt(data, systemPrompt);

  const handleDeploy = async () => {
    if (!agentId) { toast.error(t("wizard.no_agent")); return; }
    setDeploying(true);
    try {
      if (data.bot_avatar_file) {
        const path = `${agentId}/avatar.png`;
        await supabase.storage.from("bot-avatars").upload(path, data.bot_avatar_file, { upsert: true });
        const { data: urlData } = supabase.storage.from("bot-avatars").getPublicUrl(path);
        data.bot_avatar_url = urlData.publicUrl;
      }

      const enrichedPrompt = getEnrichedPrompt();
      const encryptedOpenaiKey = data.openai_api_key
        ? await encryptKey(data.openai_api_key)
        : null;

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
        openai_api_key: encryptedOpenaiKey,
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

      if (data.connectors.length > 0) {
        await saveConnectors(agentId, data.connectors);
      }

      const { data: deployRes, error } = await supabase.functions.invoke("deploy-telegram", {
        body: {
          agentId,
          telegramToken: data.telegram_bot_token,
          openaiApiKey: data.openai_api_key,
          displayName: data.telegram_display_name || data.bot_name,
          shortDescription: data.telegram_short_description || data.short_description,
          aboutText: data.telegram_about_text || data.about_text,
          commands: data.telegram_commands,
          welcomeMessage: data.welcome_message,
          fallbackMessage: data.fallback_message,
          starterButtons: data.starter_buttons,
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

      localStorage.removeItem(`wizard_draft_${agentId}`);
      localStorage.removeItem(`wizard_step_${agentId}`);
      localStorage.removeItem(`wizard_max_step_${agentId}`);
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

  // ── Success screen ─────────────────────────────────────────────────────────
  if (deployed) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md border-border/60 bg-card overflow-hidden">
          {/* Confetti */}
          {confettiPieces.map(p => (
            <div
              key={p.id}
              className="confetti-piece"
              style={{
                left: p.left,
                background: p.color,
                "--conf-d": p.duration,
                "--conf-delay": p.delay,
                "--conf-cx": p.cx,
                "--conf-r": p.radius,
              } as React.CSSProperties}
            />
          ))}

          {/* Aurora glow */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="aurora-orb aurora-orb-1" style={{ opacity: 0.3 }} />
            <div className="aurora-orb aurora-orb-2" style={{ opacity: 0.25 }} />
          </div>

          <div className="relative flex flex-col items-center gap-6 py-12 text-center">
            {/* Rocket icon with bounce */}
            <div className="animate-success-pop relative">
              <div className="absolute inset-0 rounded-full bg-primary/30 blur-3xl scale-[2]" />
              <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-primary/30 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent">
                <span className="text-6xl select-none" style={{ filter: "drop-shadow(0 0 20px hsl(263 70% 58%))" }}>
                  🚀
                </span>
              </div>
            </div>

            <div className="space-y-2 animate-fade-up" style={{ animationDelay: "200ms" }}>
              <h2 className="text-3xl font-extrabold gradient-text">{t("wizard.deployed")}</h2>
              {botUsername && (
                <p className="text-sm text-muted-foreground">
                  {t("wizard.bot_live")}{" "}
                  <a
                    href={`https://t.me/${botUsername}`}
                    target="_blank"
                    rel="noopener"
                    className="font-bold text-primary underline underline-offset-2"
                  >
                    @{botUsername}
                  </a>
                </p>
              )}
            </div>

            <button
              onClick={() => { setDeployed(false); onOpenChange(false); }}
              className="btn-gradient deploy-throb h-12 px-12 rounded-2xl text-primary-foreground font-bold text-base animate-fade-up"
              style={{ animationDelay: "380ms" }}
            >
              <span className="relative z-10">{t("wizard.done")}</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Main wizard dialog ─────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-3xl h-[100dvh] sm:h-auto sm:max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden rounded-none sm:rounded-2xl border-border/60 bg-card">

        {/* Aurora backdrop — decorative only */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-none sm:rounded-2xl">
          <div className="aurora-orb aurora-orb-1" style={{ opacity: 0.12, width: "70%", height: "55%", top: "-15%", left: "-15%" }} />
          <div className="aurora-orb aurora-orb-2" style={{ opacity: 0.09, width: "50%", height: "45%", bottom: "-15%", right: "-10%" }} />
          <div className="aurora-orb aurora-orb-3" style={{ opacity: 0.07 }} />
        </div>

        {/* ── Animated progress fill bar ─────────────────────────────────── */}
        <div className="relative h-1 shrink-0 bg-border/40 overflow-hidden">
          <div
            className="wizard-prog-fill absolute inset-y-0 left-0"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="relative px-4 sm:px-6 pt-4 pb-4 border-b border-border/40 shrink-0">

          {/* Step dots row */}
          <div className="flex items-center gap-0 mb-3">
            {activeSteps.map((sid, i) => {
              const isActive    = i === step;
              const isCompleted = i < step;
              const isVisited   = i > step && i <= maxVisitedStep;
              const isClickable = isCompleted || isVisited;
              const dotSize     = activeSteps.length > 10 ? "h-3.5 w-3.5 text-[7px]" : "h-6 w-6 text-[10px]";
              return (
                <div key={sid} className="flex items-center flex-1 min-w-0">
                  <button
                    onClick={() => { if (isClickable) goToStep(i, i > step ? "forward" : "back"); }}
                    title={t(STEP_I18N[sid] as any) || sid}
                    className={cn(
                      "flex shrink-0 items-center justify-center rounded-full font-bold transition-all duration-300",
                      dotSize,
                      isActive
                        ? "bg-primary text-primary-foreground step-dot-active scale-[1.3] ring-2 ring-primary/20"
                        : isCompleted
                          ? "bg-primary/30 text-primary cursor-pointer hover:bg-primary/50 hover:scale-110"
                          : isVisited
                            ? "bg-primary/15 text-primary/70 cursor-pointer hover:bg-primary/30 hover:scale-110 ring-1 ring-primary/25"
                            : "bg-muted/70 text-muted-foreground/40 cursor-default"
                    )}
                  >
                    {isCompleted ? (
                      <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="1.5,5 4,7.5 8.5,2" />
                      </svg>
                    ) : (
                      <span>{i + 1}</span>
                    )}
                  </button>

                  {i < activeSteps.length - 1 && (
                    <div className={cn(
                      "flex-1 h-px mx-0.5 transition-all duration-500",
                      i < step
                        ? "bg-gradient-to-r from-primary/60 to-primary/30"
                        : i < maxVisitedStep
                          ? "bg-gradient-to-r from-primary/20 to-primary/10"
                          : "bg-border/60"
                    )} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Current step info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <span
                className="text-2xl leading-none shrink-0 select-none"
                style={{ filter: "drop-shadow(0 0 8px hsl(263 70% 58% / 0.6))" }}
              >
                {STEP_ICONS[currentStepId]}
              </span>
              <p className="text-sm font-bold gradient-text truncate">
                {t(STEP_I18N[currentStepId] as any) || currentStepId}
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {/* Mini fill bar */}
              <div className="hidden sm:block w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground/60 tabular-nums font-mono">
                {step + 1}<span className="opacity-40">/</span>{activeSteps.length}
              </span>
            </div>
          </div>
        </div>

        {/* ── Step content ─────────────────────────────────────────────────── */}
        <div className="relative flex-1 overflow-auto px-5 sm:px-7 py-6 dot-grid">
          {/* Subtle inner glow at top */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-card/60 to-transparent" />

          <div
            key={stepKey}
            className={direction === "forward" ? "animate-wizard-forward" : "animate-wizard-back"}
          >
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
        </div>

        {/* ── Footer nav ───────────────────────────────────────────────────── */}
        <div className="relative px-5 sm:px-7 py-4 border-t border-border/40 bg-card/80 backdrop-blur-sm flex items-center justify-between shrink-0 gap-3">
          <Button
            variant="ghost"
            onClick={goBack}
            disabled={step === 0}
            className="gap-1.5 text-sm disabled:opacity-25 hover:bg-muted/60 rounded-xl"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("wizard.back")}
          </Button>

          {isLastStep ? (
            <button
              onClick={handleDeploy}
              disabled={!confirmed || deploying}
              className={cn(
                "btn-gradient h-11 px-8 rounded-2xl text-primary-foreground font-bold text-sm flex items-center gap-2.5",
                "disabled:opacity-35 disabled:cursor-not-allowed transition-transform",
                confirmed && !deploying && "deploy-throb hover:scale-[1.03]"
              )}
            >
              {deploying
                ? <Loader2 className="h-4 w-4 animate-spin relative z-10" />
                : <Rocket className="h-4 w-4 relative z-10" />}
              <span className="relative z-10">
                {deploying ? t("wizard.deploying") : t("wizard.deploy_telegram")}
              </span>
            </button>
          ) : (
            <button
              onClick={goNext}
              disabled={!canNext()}
              className={cn(
                "btn-gradient h-10 px-6 rounded-xl text-primary-foreground font-semibold text-sm flex items-center gap-1.5",
                "disabled:opacity-35 disabled:cursor-not-allowed",
                canNext() && "hover:scale-[1.03] transition-transform"
              )}
            >
              <span className="relative z-10">{t("wizard.next")}</span>
              <ChevronRight className="h-4 w-4 relative z-10" />
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
