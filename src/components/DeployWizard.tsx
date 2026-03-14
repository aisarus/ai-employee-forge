import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WizardData, DEFAULT_WIZARD_DATA, WIZARD_STEPS } from "./wizard/types";
import { StepIdentity } from "./wizard/StepIdentity";
import { StepWelcome } from "./wizard/StepWelcome";
import { StepActionsData } from "./wizard/StepActionsData";
import { StepWorkflowLogic } from "./wizard/StepWorkflowLogic";
import { StepBehaviorPreview } from "./wizard/StepBehaviorPreview";
import { StepTelegramConfig } from "./wizard/StepTelegramConfig";
import { StepTelegramPreview } from "./wizard/StepTelegramPreview";
import { StepReviewDeploy } from "./wizard/StepReviewDeploy";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Rocket, Loader2, CheckCircle } from "lucide-react";
import { buildActionsPromptBlock } from "./wizard/promptBuilder";
import { useI18n } from "@/hooks/useI18n";

interface DeployWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId?: string;
  systemPrompt?: string;
  initialData?: Partial<WizardData>;
}

const STEP_TITLE_KEYS = [
  "wizard.identity",
  "wizard.welcome",
  "wizard.actions",
  "wizard.workflow",
  "wizard.preview",
  "wizard.telegram_config",
  "wizard.telegram_preview",
  "wizard.deploy",
] as const;

export function DeployWizard({ open, onOpenChange, agentId, systemPrompt = "", initialData }: DeployWizardProps) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>({ ...DEFAULT_WIZARD_DATA, ...initialData });
  const [confirmed, setConfirmed] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState(false);
  const [botUsername, setBotUsername] = useState("");

  useEffect(() => {
    if (open) {
      setStep(0);
      setDeployed(false);
      setConfirmed(false);
      setData((prev) => ({
        ...DEFAULT_WIZARD_DATA,
        ...initialData,
        telegram_display_name: initialData?.bot_name || prev.bot_name || "",
        telegram_short_description: initialData?.short_description || prev.short_description || "",
        telegram_about_text: initialData?.about_text || prev.about_text || "",
      }));
    }
  }, [open, initialData]);

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
        } as any,
      }).eq("id", agentId);

      const { data: deployRes, error } = await supabase.functions.invoke("deploy-telegram", {
        body: {
          agentId,
          telegramToken: data.telegram_bot_token,
          displayName: data.telegram_display_name || data.bot_name,
          shortDescription: data.telegram_short_description || data.short_description,
          aboutText: data.telegram_about_text || data.about_text,
          commands: data.telegram_commands,
        },
      });

      if (error) throw error;
      if (deployRes?.error) throw new Error(deployRes.error);

      setBotUsername(deployRes?.botInfo?.username || "");
      setDeployed(true);
      toast.success(deployRes?.message || t("wizard.deployed"));
    } catch (err: any) {
      toast.error(err.message || t("wizard.deploy_failed"));
    } finally {
      setDeploying(false);
    }
  };

  const canNext = () => {
    switch (step) {
      case 0: return !!data.bot_name.trim() && !!data.short_description.trim();
      case 1: return !!data.welcome_message.trim();
      case 2: return true;
      case 3: return true;
      case 4: return true;
      case 5: return !!data.telegram_bot_token.trim();
      case 6: return true;
      case 7: return confirmed;
      default: return true;
    }
  };

  const isLastStep = step === WIZARD_STEPS.length - 1;

  if (deployed) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <CheckCircle className="h-14 w-14 text-success" />
            <div>
              <p className="text-xl font-bold text-foreground">{t("wizard.deployed")}</p>
              {botUsername && (
                <p className="text-sm text-muted-foreground mt-2">
                  {t("wizard.bot_live")}{" "}
                  <a href={`https://t.me/${botUsername}`} target="_blank" rel="noopener" className="text-primary underline font-medium">
                    @{botUsername}
                  </a>
                </p>
              )}
            </div>
            <Button onClick={() => { setDeployed(false); onOpenChange(false); }} size="lg">{t("wizard.done")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <div className="px-6 pt-5 pb-3 border-b border-border/50 bg-muted/20 shrink-0">
          <div className="flex items-center gap-1">
            {WIZARD_STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center flex-1">
                <button
                  onClick={() => i <= step && setStep(i)}
                  className={`flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-bold transition-colors ${
                    i === step
                      ? "bg-primary text-primary-foreground"
                      : i < step
                        ? "bg-primary/20 text-primary cursor-pointer"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </button>
                {i < WIZARD_STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-0.5 rounded ${i < step ? "bg-primary/30" : "bg-border"}`} />
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">{t(STEP_TITLE_KEYS[step] as any)}</p>
        </div>

        <div className="flex-1 overflow-auto px-6 py-5">
          {step === 0 && <StepIdentity data={data} onChange={onChange} onAvatarUpload={handleAvatarUpload} onAvatarRemove={handleAvatarRemove} />}
          {step === 1 && <StepWelcome data={data} onChange={onChange} />}
          {step === 2 && <StepActionsData data={data} onChange={onChange} />}
          {step === 3 && <StepWorkflowLogic data={data} onChange={onChange} />}
          {step === 4 && <StepBehaviorPreview data={data} systemPrompt={getEnrichedPrompt()} />}
          {step === 5 && <StepTelegramConfig data={data} onChange={onChange} />}
          {step === 6 && <StepTelegramPreview data={data} />}
          {step === 7 && <StepReviewDeploy data={data} confirmed={confirmed} onConfirmChange={setConfirmed} />}
        </div>

        <div className="px-6 py-4 border-t border-border/50 bg-muted/20 flex items-center justify-between shrink-0">
          <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 0} className="gap-1">
            <ChevronLeft className="h-4 w-4" /> {t("wizard.back")}
          </Button>
          {isLastStep ? (
            <Button onClick={handleDeploy} disabled={!confirmed || deploying} className="gap-2" size="lg">
              {deploying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              {deploying ? t("wizard.deploying") : t("wizard.deploy_telegram")}
            </Button>
          ) : (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext()} className="gap-1">
              {t("wizard.next")} <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
