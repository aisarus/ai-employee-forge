import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Key, Bot, ChevronDown, ChevronUp, Settings2, ArrowRight, MessageSquare, Zap, Send, Rocket, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GnomeAssembly } from "@/components/GnomeAssembly";
import { QuickStartWizard } from "@/components/QuickStartWizard";
import { runTriTfmPipeline } from "@/lib/tri-tfm";
import { useI18n } from "@/hooks/useI18n";
import { toast } from "sonner";

type PageMode = "select" | "quick_start" | "advanced_input" | "advanced_loading";

const Index = () => {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<PageMode>("select");

  // Advanced mode state
  const [botName, setBotName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState("professional");
  const [responseStyle, setResponseStyle] = useState("concise");
  const [apiKey, setApiKey] = useState(localStorage.getItem("userOpenAiKey") || "");
  const [progressMsg, setProgressMsg] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    localStorage.setItem("userOpenAiKey", apiKey);
  }, [apiKey]);

  const handleAdvancedGenerate = useCallback(() => {
    if (!prompt.trim()) return;
    setMode("advanced_loading");
  }, [prompt]);

  useEffect(() => {
    if (mode !== "advanced_loading") return;

    let cancelled = false;

    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        cancelled = true;
        toast.error(lang === "ru" ? "Превышено время ожидания (180 с). Попробуйте снова." : "Generation timed out after 180s. Please try again.");
        setMode("advanced_input");
      }
    }, 180_000);

    const runPipeline = async () => {
      try {
        const behaviorContext = `Bot name: ${botName || "AI Assistant"}\nTone: ${tone}\nResponse style: ${responseStyle}\n\nBusiness rules:\n${prompt}`;
        const result = await runTriTfmPipeline({
          prompt: behaviorContext,
          apiKey,
          config: { maxIterations: 5, useProposerCriticVerifier: true, proposerCriticOnly: true },
          onProgress: (stage, detail) => setProgressMsg(detail || stage),
        });

        if (cancelled) return;
        clearTimeout(timeoutId);

        if (user) {
          const { data: insertedAgent } = await supabase.from("agents").insert({
            user_id: user.id,
            name: botName || "AutoBot",
            description: prompt.slice(0, 120),
            raw_instructions: prompt,
            system_prompt: result.finalText || "Error generating prompt",
            tone,
            response_style: responseStyle,
          }).select("id").single();
          if (insertedAgent) localStorage.setItem("currentAgentId", insertedAgent.id);
        }

        localStorage.setItem("generatedPrompt", result.finalText || "");
        localStorage.setItem("tfmData", JSON.stringify(result));
        localStorage.setItem("botName", botName || "AI Assistant");
        navigate("/workspace");
      } catch (e) {
        clearTimeout(timeoutId);
        if (!cancelled) {
          console.error("TRI-TFM pipeline error:", e);
          navigate("/workspace");
        }
      }
    };
    runPipeline();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [mode]);

  // ── Mode: Quick Start ──────────────────────────────
  if (mode === "quick_start") {
    return <QuickStartWizard />;
  }

  // ── Mode: Advanced Loading ─────────────────────────
  if (mode === "advanced_loading") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <GnomeAssembly />
        {progressMsg && (
          <p className="text-sm text-muted-foreground animate-pulse max-w-xs text-center">{progressMsg}</p>
        )}
      </div>
    );
  }

  // ── Mode: Advanced Input ───────────────────────────
  if (mode === "advanced_input") {
    return (
      <div className="flex flex-1 flex-col items-center justify-start p-4 sm:p-6 pt-8 sm:pt-12 animate-fade-in dot-grid">
        <div className="w-full max-w-xl space-y-8">
          <div className="text-center space-y-3">
            <button onClick={() => setMode("select")} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              ← {lang === "ru" ? "Назад к выбору режима" : "Back to mode selection"}
            </button>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
              {lang === "ru" ? "Продвинутая настройка" : "Advanced Setup"}
            </h1>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              {lang === "ru"
                ? "Опишите бота → сгенерируйте мозг → настройте действия, интеграции и триггеры в визарде деплоя"
                : "Describe bot → generate brain → configure actions, integrations and triggers in the deploy wizard"}
            </p>
          </div>

          <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-6 backdrop-blur-xl shadow-lg shadow-black/20">
            <div className="space-y-2">
              <Label htmlFor="apiKey" className="flex items-center gap-1.5 text-sm font-medium">
                <Key className="h-3.5 w-3.5 text-primary" />
                Your AI API Key (OpenAI, Anthropic, or Google Gemini)
                <span className="text-red-400 ml-0.5">*</span>
              </Label>
              <p className="text-xs text-muted-foreground -mt-1">
                sk-... for OpenAI · sk-ant-... for Anthropic · AIza... for Gemini
              </p>
              <div className="relative">
                <Input
                  id="apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste your API key here"
                  className="bg-background/50 border-border pr-36"
                />
                {apiKey && (
                  <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium pointer-events-none ${
                    apiKey.startsWith("sk-ant-") ? "text-orange-400" :
                    apiKey.startsWith("sk-") ? "text-green-400" :
                    apiKey.startsWith("AIza") ? "text-blue-400" :
                    "text-muted-foreground"
                  }`}>
                    {apiKey.startsWith("sk-ant-") ? "Anthropic detected ✓" :
                     apiKey.startsWith("sk-") ? "OpenAI detected ✓" :
                     apiKey.startsWith("AIza") ? "Gemini detected ✓" :
                     "Unknown format"}
                  </span>
                )}
              </div>
              <p className="text-xs text-amber-500/80">Required for brain generation — your key is stored locally only.</p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("create.instructions_label")} *</Label>
              <Textarea
                rows={5}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t("create.instructions_placeholder")}
                className="resize-none bg-background/50 border-border text-sm leading-relaxed"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="botName" className="flex items-center gap-1.5 text-sm">
                <Bot className="h-3.5 w-3.5" /> {t("create.bot_name")}
                <span className="text-muted-foreground font-normal ml-1">{t("create.optional")}</span>
              </Label>
              <Input id="botName" value={botName} onChange={(e) => setBotName(e.target.value)} placeholder={t("create.bot_name_placeholder")} className="bg-background/50" />
            </div>

            <button type="button" onClick={() => setShowAdvanced(v => !v)} className="flex w-full items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
              <Settings2 className="h-3.5 w-3.5" />
              {t("create.advanced")}
              {showAdvanced ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-2 gap-3 border-t border-border/50 pt-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("create.tone")}</Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger className="bg-background/50 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">{t("create.tone.professional")}</SelectItem>
                      <SelectItem value="friendly">{t("create.tone.friendly")}</SelectItem>
                      <SelectItem value="formal">{t("create.tone.formal")}</SelectItem>
                      <SelectItem value="casual">{t("create.tone.casual")}</SelectItem>
                      <SelectItem value="humorous">{t("create.tone.humorous")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("create.response_style")}</Label>
                  <Select value={responseStyle} onValueChange={setResponseStyle}>
                    <SelectTrigger className="bg-background/50 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="concise">{t("create.style.concise")}</SelectItem>
                      <SelectItem value="detailed">{t("create.style.detailed")}</SelectItem>
                      <SelectItem value="step-by-step">{t("create.style.step_by_step")}</SelectItem>
                      <SelectItem value="conversational">{t("create.style.conversational")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <button
              onClick={handleAdvancedGenerate}
              disabled={!prompt.trim()}
              className="btn-gradient w-full h-12 rounded-xl text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-1"
            >
              <Sparkles className="h-4 w-4 relative z-10" />
              <span className="relative z-10">{t("create.generate")}</span>
              <ArrowRight className="h-4 w-4 ml-auto relative z-10" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Mode: Select (default) ─────────────────────────
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4 sm:p-6 animate-fade-in dot-grid">
      <div className="w-full max-w-2xl space-y-10">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Bot className="h-3.5 w-3.5" /> BotForge
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
            {lang === "ru" ? "Как вы хотите создать бота?" : "How do you want to build your bot?"}
          </h1>
          <p className="text-muted-foreground text-base max-w-md mx-auto leading-relaxed">
            {lang === "ru"
              ? "Выберите быстрый запуск или полную настройку"
              : "Choose a fast launch flow or a full advanced setup"}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {/* Quick Start */}
          <button
            onClick={() => setMode("quick_start")}
            className="group relative flex flex-col items-start gap-4 rounded-2xl border-2 border-border bg-card/60 p-6 text-left transition-all duration-200 hover:border-primary/60 hover:bg-primary/5 hover:shadow-[0_0_40px_hsl(var(--primary)/0.18)] hover:scale-[1.02] overflow-hidden"
          >
            {/* Subtle gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:to-cyan-400/5 transition-all duration-300 pointer-events-none rounded-2xl" />
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 group-hover:bg-primary/25 transition-colors">
              <Rocket className="h-6 w-6 text-primary" />
            </div>
            <div className="relative space-y-1.5">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-foreground">
                  {lang === "ru" ? "Быстрый старт" : "Quick Start"}
                </h3>
                <span className="text-[10px] font-semibold text-primary bg-primary/15 border border-primary/25 px-2 py-0.5 rounded-full">
                  {lang === "ru" ? "Рекомендуем" : "Recommended"}
                </span>
              </div>
              <p className="text-sm text-primary/80 font-medium leading-snug">
                {lang === "ru"
                  ? "Опишите бота → сгенерируйте мозг → задеплойте"
                  : "Describe → Generate brain → Deploy"}
              </p>
              <p className="text-xs text-muted-foreground">
                {lang === "ru"
                  ? "Лучший вариант для новых пользователей и простых ботов"
                  : "Best for first-time users or simple bots"}
              </p>
            </div>
            <div className="relative mt-auto pt-2 flex items-center gap-1 text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {lang === "ru" ? "Начать" : "Get started"} <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </button>

          {/* Advanced */}
          <button
            onClick={() => setMode("advanced_input")}
            className="group relative flex flex-col items-start gap-4 rounded-2xl border-2 border-border bg-card/60 p-6 text-left transition-all duration-200 hover:border-border/80 hover:bg-card/80 hover:shadow-lg hover:scale-[1.02] overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-transparent group-hover:from-muted/20 transition-all duration-300 pointer-events-none rounded-2xl" />
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-muted group-hover:bg-primary/15 transition-colors">
              <Wrench className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="relative space-y-1.5">
              <h3 className="text-lg font-bold text-foreground">
                {lang === "ru" ? "Продвинутая настройка" : "Advanced Setup"}
              </h3>
              <p className="text-sm text-muted-foreground font-medium leading-snug">
                {lang === "ru"
                  ? "Поведение, данные, интеграции и автоматизация"
                  : "Behavior · Integrations · Automation"}
              </p>
              <p className="text-xs text-muted-foreground/70">
                {lang === "ru"
                  ? "Для пользователей, которым нужен полный контроль"
                  : "For users who want full control"}
              </p>
            </div>
            <div className="relative mt-auto pt-2 flex items-center gap-1 text-xs font-semibold text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {lang === "ru" ? "Настроить" : "Configure"} <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Index;
