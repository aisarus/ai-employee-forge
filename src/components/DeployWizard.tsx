import { useState, useEffect, useMemo, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WizardData, DEFAULT_WIZARD_DATA, getWizardSteps, BOT_TYPE_PRESETS, BOT_TYPES } from "./wizard/types";
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
import { ChevronLeft, ChevronRight, Rocket, Loader2, Sparkles, Zap, RotateCcw, Cloud } from "lucide-react";
import { buildFullSystemPrompt } from "./wizard/promptBuilder";
import { useI18n } from "@/hooks/useI18n";
import { useConnectors } from "@/hooks/useConnectors";
import { useWizardDraft } from "@/hooks/useWizardDraft";
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

const CONF_COLORS = ["#7c3aed","#3b82f6","#10b981","#f59e0b","#ec4899","#06b6d4","#a78bfa","#34d399","#f472b6","#60a5fa"];

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
  // "idle" | "saving" | "saved"
  const [syncState, setSyncState] = useState<"idle" | "saving" | "saved">("idle");

  const { saveToCloud, loadFromCloud, clearCloud } = useWizardDraft<{
    data: WizardData;
    step: number;
    maxVisitedStep: number;
  }>(agentId);

  const activeSteps = getWizardSteps(data.bot_type);
  const currentStepId = activeSteps[step] ?? "bot_type";
  const isLastStep = step === activeSteps.length - 1;
  const progressPct = Math.round(((step + 1) / activeSteps.length) * 100);

  // Pre-generate confetti
  const confettiPieces = useMemo(() =>
    Array.from({ length: 55 }, (_, i) => ({
      id: i,
      left: `${(i / 55) * 100 + (Math.sin(i * 2.7) * 4)}%`,
      color: CONF_COLORS[i % CONF_COLORS.length],
      duration: `${2.0 + (i % 9) * 0.2}s`,
      delay: `${(i % 16) * 0.055}s`,
      cx: `${Math.sin(i * 1.3) * 140}px`,
      radius: i % 3 === 0 ? "50%" : i % 3 === 1 ? "2px" : "1px 5px",
      size: `${7 + (i % 5)}px`,
    })),
  []);

  // Pre-generate background particles
  const bgParticles = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => ({
      key: i,
      style: {
        width:  `${4 + (i % 3) * 3}px`,
        height: `${4 + (i % 3) * 3}px`,
        left:   `${9 + i * 13}%`,
        top:    `${18 + (i % 4) * 17}%`,
        background: `hsl(${258 + i * 12} 70% 65%)`,
        "--p-dur":     `${3.4 + i * 0.65}s`,
        "--p-delay":   `${i * 0.48}s`,
        "--p-opacity": `${0.12 + (i % 3) * 0.07}`,
      } as React.CSSProperties,
    })),
  []);

  // ── Restore from localStorage (+ cloud fallback) on open ───────────────────
  useEffect(() => {
    if (!open) return;
    setDeployed(false);
    setConfirmed(false);
    setSyncState("idle");

    const storedKey = localStorage.getItem("userOpenAiKey") || "";
    let localDraft: Partial<WizardData> | null = null;
    let savedStep = 0;
    let savedMax = 0;

    if (agentId) {
      try {
        const raw = localStorage.getItem(`wizard_draft_${agentId}`);
        if (raw) localDraft = JSON.parse(raw) as Partial<WizardData>;
      } catch {}
      savedStep = Number(localStorage.getItem(`wizard_step_${agentId}`) || 0);
      savedMax  = Number(localStorage.getItem(`wizard_max_step_${agentId}`) || savedStep);
    }

    const applyDraft = (draft: Partial<WizardData>, stepN: number, maxN: number) => {
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
      setStep(Math.max(0, stepN));
      setMaxVisitedStep(Math.max(0, maxN));
    };

    if (localDraft) {
      // We already have a local draft — use it immediately
      applyDraft(localDraft, savedStep, savedMax);
    } else {
      // No local draft — apply defaults first, then try cloud
      applyDraft({}, 0, 0);
      if (agentId) {
        loadFromCloud().then((cloud) => {
          if (cloud?.data) {
            applyDraft(cloud.data.data, cloud.data.step ?? 0, cloud.data.maxVisitedStep ?? 0);
            // Mirror cloud draft to localStorage for subsequent Alt+Tabs
            try {
              localStorage.setItem(`wizard_draft_${agentId}`, JSON.stringify(cloud.data.data));
              localStorage.setItem(`wizard_step_${agentId}`, String(cloud.data.step ?? 0));
              localStorage.setItem(`wizard_max_step_${agentId}`, String(cloud.data.maxVisitedStep ?? 0));
            } catch {}
            toast.info(t("wizard.draft_restored"));
          }
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const persistData = useCallback((d: WizardData, stepN?: number, maxN?: number) => {
    if (!agentId) return;
    try {
      localStorage.setItem(`wizard_draft_${agentId}`, JSON.stringify(d));
      if (stepN !== undefined) localStorage.setItem(`wizard_step_${agentId}`, String(stepN));
      if (maxN  !== undefined) localStorage.setItem(`wizard_max_step_${agentId}`, String(maxN));
    } catch {}
    // Cloud sync (debounced 4 s)
    setSyncState("saving");
    saveToCloud(
      { data: d, step: stepN ?? 0, maxVisitedStep: maxN ?? 0 },
      () => setSyncState("saved"),
    );
  }, [agentId, saveToCloud]);

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

  const handleReset = useCallback(() => {
    if (!window.confirm(t("wizard.reset_confirm"))) return;
    if (agentId) {
      localStorage.removeItem(`wizard_draft_${agentId}`);
      localStorage.removeItem(`wizard_step_${agentId}`);
      localStorage.removeItem(`wizard_max_step_${agentId}`);
      clearCloud();
    }
    const fresh: WizardData = {
      ...DEFAULT_WIZARD_DATA,
      ...initialData,
      openai_api_key: localStorage.getItem("userOpenAiKey") || "",
    };
    setData(fresh);
    setStep(0);
    setMaxVisitedStep(0);
    setConfirmed(false);
    setDeployed(false);
    setBotUsername("");
    setSyncState("idle");
    toast.info(t("wizard.reset_draft"));
  }, [agentId, clearCloud, initialData, t]);

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
      // Persist step advancement to cloud too
      setData((d) => { persistData(d, next, Math.max(maxVisitedStep, next)); return d; });
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
      clearCloud();
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
      case "api_keys": {
        const key = data.openai_api_key.trim();
        return !!key && (key.startsWith("sk-") || key.startsWith("AIza"));
      }
      case "telegram_config":  return !!data.telegram_bot_token.trim();
      case "deploy":           return confirmed;
      default:                 return true;
    }
  };

  // ── Success screen ─────────────────────────────────────────────────────────
  if (deployed) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg border-border/40 bg-card overflow-hidden p-0">
          {/* Confetti */}
          {confettiPieces.map(p => (
            <div
              key={p.id}
              className="confetti-piece"
              style={{
                left: p.left,
                background: p.color,
                width: p.size,
                height: p.size,
                "--conf-d": p.duration,
                "--conf-delay": p.delay,
                "--conf-cx": p.cx,
                "--conf-r": p.radius,
              } as React.CSSProperties}
            />
          ))}

          {/* Aurora background */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="aurora-orb aurora-orb-1" style={{ opacity: 0.35 }} />
            <div className="aurora-orb aurora-orb-2" style={{ opacity: 0.28 }} />
            <div className="aurora-orb aurora-orb-3" style={{ opacity: 0.18 }} />
          </div>

          {/* Mesh gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-500/5 pointer-events-none" />

          <div className="relative flex flex-col items-center gap-6 py-14 px-8 text-center">
            {/* Rocket with layered glow rings */}
            <div className="animate-success-pop relative">
              {/* Outer glow rings */}
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-3xl scale-[2.5]" />
              <div className="absolute inset-0 rounded-full bg-blue-500/15 blur-2xl scale-[1.8]" />
              {/* Ring */}
              <div className="relative flex h-32 w-32 items-center justify-center rounded-full border border-primary/30 bg-gradient-to-br from-primary/25 via-primary/10 to-transparent shadow-2xl shadow-primary/30">
                <span className="text-7xl select-none" style={{ filter: "drop-shadow(0 0 28px hsl(263 70% 58%))" }}>
                  🚀
                </span>
              </div>
            </div>

            <div className="space-y-3 animate-fade-up" style={{ animationDelay: "200ms" }}>
              <h2 className="text-4xl font-extrabold gradient-text">{t("wizard.deployed")}</h2>
              {botUsername && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    {t("wizard.bot_live")}
                  </p>
                  <a
                    href={`https://t.me/${botUsername}`}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-2 font-bold text-primary underline underline-offset-4 text-lg hover:text-primary/80 transition-colors"
                  >
                    @{botUsername}
                  </a>
                </div>
              )}
            </div>

            {/* Decorative divider */}
            <div className="glow-line w-48 animate-fade-up" style={{ animationDelay: "300ms" }} />

            <button
              onClick={() => { setDeployed(false); onOpenChange(false); }}
              className="btn-gradient deploy-throb h-13 px-14 rounded-2xl text-primary-foreground font-bold text-base animate-fade-up flex items-center gap-2.5"
              style={{ animationDelay: "400ms", height: "52px" }}
            >
              <Zap className="h-4 w-4 relative z-10" />
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
      <DialogContent className="w-full sm:max-w-4xl h-[100dvh] sm:h-auto sm:max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden rounded-none sm:rounded-2xl border-border/40 bg-card">

        {/* Aurora backdrop */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-none sm:rounded-2xl z-0">
          <div className="aurora-orb aurora-orb-1" style={{ opacity: 0.13, width: "70%", height: "60%", top: "-20%", left: "-15%" }} />
          <div className="aurora-orb aurora-orb-2" style={{ opacity: 0.09, width: "55%", height: "50%", bottom: "-15%", right: "-10%" }} />
          <div className="aurora-orb aurora-orb-3" style={{ opacity: 0.06 }} />
          {bgParticles.map(p => <div key={p.key} className="wizard-particle" style={p.style} />)}
        </div>

        {/* Mobile-only top progress bar */}
        <div className="sm:hidden relative h-1 shrink-0 bg-border/40 overflow-hidden z-10">
          <div className="wizard-prog-fill absolute inset-y-0 left-0" style={{ width: `${progressPct}%` }} />
        </div>

        {/* ─── Two-column layout ─── */}
        <div className="relative z-10 flex flex-1 min-h-0 overflow-hidden">

          {/* ══════════ LEFT SIDEBAR (desktop only) ══════════ */}
          <aside className="hidden sm:flex flex-col w-[200px] shrink-0 border-r border-border/20 relative overflow-hidden">
            {/* Sidebar glass background */}
            <div className="absolute inset-0 glass-sidebar pointer-events-none" />

            <div className="relative flex flex-col h-full p-4">

              {/* Brand header */}
              <div className="mb-5 flex items-center gap-2.5 shrink-0">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center shadow-lg shadow-primary/30 shrink-0">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold gradient-text leading-none">Bot Forge</p>
                  <p className="text-[9px] text-muted-foreground/50 leading-tight mt-0.5">AI Employee Builder</p>
                </div>
              </div>

              {/* Selected bot type badge */}
              {data.bot_type && (
                <div className="mb-3 shrink-0 flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-2.5 py-2 animate-fade-up">
                  <span className="text-lg leading-none">{BOT_TYPES.find(b => b.id === data.bot_type)?.icon}</span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-primary truncate">{t(`bottype.${data.bot_type}` as any)}</p>
                    <p className="text-[9px] text-muted-foreground/55 leading-tight">Selected type</p>
                  </div>
                </div>
              )}

              {/* Step list */}
              <nav className="flex-1 space-y-0.5 overflow-auto min-h-0" style={{ scrollbarWidth: "none" }}>
                {activeSteps.map((sid, i) => {
                  const isActive    = i === step;
                  const isDone      = i < step;
                  const isVisited   = i > step && i <= maxVisitedStep;
                  const isClickable = isDone || isVisited;

                  return (
                    <button
                      key={sid}
                      onClick={() => isClickable ? goToStep(i, i > step ? "forward" : "back") : undefined}
                      title={t(STEP_I18N[sid] as any) || sid}
                      className={cn(
                        "w-full flex items-center gap-2 px-2.5 py-[7px] rounded-xl text-left transition-all duration-200 group",
                        isActive    && "sidebar-step-active-glow bg-primary/12 border border-primary/20",
                        isClickable && "cursor-pointer hover:bg-muted/50",
                        !isDone && !isActive && !isVisited && "opacity-35 cursor-default",
                      )}
                    >
                      {/* Number / checkmark dot */}
                      <div className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-bold transition-all duration-300 text-[9px]",
                        isActive  && "bg-primary text-primary-foreground step-dot-active scale-110",
                        isDone    && "bg-primary/30 text-primary",
                        isVisited && "bg-primary/15 text-primary/70 ring-1 ring-primary/25",
                        !isDone && !isActive && !isVisited && "bg-muted/60 text-muted-foreground/30",
                      )}>
                        {isDone ? (
                          <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="1.5,5 4,7.5 8.5,2" />
                          </svg>
                        ) : <span>{i + 1}</span>}
                      </div>

                      {/* Step name */}
                      <span className={cn(
                        "text-[11px] truncate transition-colors flex-1 min-w-0",
                        isActive  && "font-semibold text-primary",
                        isDone    && "text-foreground/65",
                        isVisited && "text-foreground/45",
                        !isDone && !isActive && !isVisited && "text-muted-foreground/30",
                      )}>
                        {t(STEP_I18N[sid] as any) || sid}
                      </span>

                      {/* Emoji for active */}
                      {isActive && (
                        <span className="text-sm shrink-0 leading-none">{STEP_ICONS[sid]}</span>
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* Bottom progress */}
              <div className="mt-4 pt-3 border-t border-border/20 shrink-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/40">Progress</span>
                  <span className="text-[10px] font-mono text-muted-foreground/50">{progressPct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 via-primary to-blue-500 transition-all duration-700 ease-out"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-[9px] text-muted-foreground/35 mt-1.5 text-right tabular-nums">
                  {step + 1} / {activeSteps.length}
                </p>

                {/* Cloud sync indicator */}
                {syncState !== "idle" && (
                  <div className="flex items-center gap-1 mt-2">
                    <Cloud className={cn("h-2.5 w-2.5", syncState === "saved" ? "text-emerald-500/70" : "text-muted-foreground/40 animate-pulse")} />
                    <span className="text-[9px] text-muted-foreground/50">
                      {syncState === "saved" ? t("wizard.draft_synced") : t("wizard.draft_syncing")}
                    </span>
                  </div>
                )}

                {/* Reset draft button */}
                <button
                  onClick={handleReset}
                  className="mt-2 w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] text-muted-foreground/50 hover:text-destructive hover:bg-destructive/8 transition-colors"
                >
                  <RotateCcw className="h-2.5 w-2.5 shrink-0" />
                  {t("wizard.reset_draft")}
                </button>
              </div>
            </div>
          </aside>

          {/* ══════════ RIGHT CONTENT ══════════ */}
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

            {/* Desktop progress fill bar */}
            <div className="hidden sm:block relative h-[2px] shrink-0 bg-border/30 overflow-hidden">
              <div className="wizard-prog-fill absolute inset-y-0 left-0" style={{ width: `${progressPct}%` }} />
            </div>

            {/* ── Header ──────────────────────────────────────────────── */}
            <div className="relative px-4 sm:px-6 pt-4 pb-4 border-b border-border/30 shrink-0">

              {/* Mobile: step dots */}
              <div className="flex sm:hidden items-center gap-0 mb-3">
                {activeSteps.map((sid, i) => {
                  const isActive    = i === step;
                  const isCompleted = i < step;
                  const isVisited   = i > step && i <= maxVisitedStep;
                  const isClickable = isCompleted || isVisited;
                  const dotSize     = activeSteps.length > 10 ? "h-3 w-3 text-[7px]" : "h-5 w-5 text-[9px]";
                  return (
                    <div key={sid} className="flex items-center flex-1 min-w-0">
                      <button
                        onClick={() => { if (isClickable) goToStep(i, i > step ? "forward" : "back"); }}
                        title={t(STEP_I18N[sid] as any) || sid}
                        className={cn(
                          "flex shrink-0 items-center justify-center rounded-full font-bold transition-all duration-300",
                          dotSize,
                          isActive
                            ? "bg-primary text-primary-foreground step-dot-active scale-[1.25]"
                            : isCompleted
                              ? "bg-primary/30 text-primary cursor-pointer hover:bg-primary/50"
                              : isVisited
                                ? "bg-primary/15 text-primary/70 cursor-pointer ring-1 ring-primary/25"
                                : "bg-muted/70 text-muted-foreground/40 cursor-default"
                        )}
                      >
                        {isCompleted ? (
                          <svg viewBox="0 0 10 10" className="h-2 w-2" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="1.5,5 4,7.5 8.5,2" />
                          </svg>
                        ) : <span>{i + 1}</span>}
                      </button>
                      {i < activeSteps.length - 1 && (
                        <div className={cn(
                          "flex-1 h-px mx-0.5 transition-all duration-500",
                          i < step ? "bg-gradient-to-r from-primary/60 to-primary/30" : "bg-border/50"
                        )} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Step title row */}
              <div className="flex items-center gap-3">
                {/* Icon with glow */}
                <div className="relative shrink-0">
                  <div className="absolute inset-0 rounded-full blur-xl opacity-60" style={{ background: "hsl(263 70% 58% / 0.4)" }} />
                  <span
                    className="relative text-3xl sm:text-4xl leading-none select-none block"
                    style={{ filter: "drop-shadow(0 0 14px hsl(263 70% 58% / 0.7))" }}
                  >
                    {STEP_ICONS[currentStepId]}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="text-base sm:text-xl font-extrabold gradient-text leading-tight truncate">
                    {t(STEP_I18N[currentStepId] as any) || currentStepId}
                  </h2>
                  <p className="text-[10px] sm:text-xs text-muted-foreground/50 mt-0.5 tabular-nums">
                    {step + 1} / {activeSteps.length}
                  </p>
                </div>

                {/* Mini progress (desktop only) */}
                <div className="hidden sm:flex items-center gap-2 shrink-0">
                  <div className="w-20 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground/50 tabular-nums font-mono">{progressPct}%</span>
                </div>
              </div>
            </div>

            {/* ── Step content ────────────────────────────────────────── */}
            <div className="relative flex-1 overflow-auto px-5 sm:px-7 py-6 dot-grid">
              {/* Top fade */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-card/70 to-transparent z-10" />

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

            {/* ── Footer nav ──────────────────────────────────────────── */}
            <div className="relative px-5 sm:px-6 py-4 border-t border-border/30 bg-card/80 backdrop-blur-sm flex items-center justify-between shrink-0 gap-3">
              {/* Subtle top glow */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={goBack}
                  disabled={step === 0}
                  className="gap-1.5 text-sm disabled:opacity-25 hover:bg-muted/60 rounded-xl h-10"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t("wizard.back")}
                </Button>

                {/* Mobile: Reset button (desktop has it in the sidebar) */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="sm:hidden gap-1 text-destructive hover:text-destructive hover:bg-destructive/10 h-9 px-2"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Mobile cloud sync indicator */}
              {syncState !== "idle" && (
                <div className="sm:hidden flex items-center gap-1 text-[10px] text-muted-foreground/50">
                  <Cloud className={cn("h-3 w-3", syncState === "saved" ? "text-emerald-500/70" : "animate-pulse")} />
                  {syncState === "saved" ? t("wizard.draft_synced") : t("wizard.draft_syncing")}
                </div>
              )}

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
                    "btn-gradient h-10 px-7 rounded-xl text-primary-foreground font-semibold text-sm flex items-center gap-1.5",
                    "disabled:opacity-35 disabled:cursor-not-allowed",
                    canNext() && "hover:scale-[1.03] transition-transform"
                  )}
                >
                  <span className="relative z-10">{t("wizard.next")}</span>
                  <ChevronRight className="h-4 w-4 relative z-10" />
                </button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
