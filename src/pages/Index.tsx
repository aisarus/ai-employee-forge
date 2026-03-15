import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Key, Bot, ChevronDown, ChevronUp, Settings2, ArrowRight, MessageSquare, Zap, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GnomeAssembly } from "@/components/GnomeAssembly";
import { runTriTfmPipeline } from "@/lib/tri-tfm";
import { useI18n } from "@/hooks/useI18n";

type WorkflowState = "input" | "loading";

const HOW_STEPS = [
  { icon: MessageSquare, key: "how.step1_title", descKey: "how.step1_desc" },
  { icon: Zap,           key: "how.step2_title", descKey: "how.step2_desc" },
  { icon: Send,          key: "how.step3_title", descKey: "how.step3_desc" },
] as const;

const Index = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [state, setState] = useState<WorkflowState>("input");
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

  const handleGenerate = useCallback(() => {
    if (!prompt.trim()) return;
    setState("loading");
  }, [prompt]);

  useEffect(() => {
    if (state !== "loading") return;

    const runPipeline = async () => {
      try {
        const behaviorContext = `Bot name: ${botName || "AI Assistant"}\nTone: ${tone}\nResponse style: ${responseStyle}\n\nBusiness rules:\n${prompt}`;

        const result = await runTriTfmPipeline({
          prompt: behaviorContext,
          apiKey,
          config: { maxIterations: 5, useProposerCriticVerifier: true, proposerCriticOnly: true },
          onProgress: (stage, detail) => setProgressMsg(detail || stage),
        });

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
        console.error("TRI-TFM pipeline error:", e);
        navigate("/workspace");
      }
    };
    runPipeline();
  }, [state]);

  if (state === "loading") {
    return <div className="flex flex-1 items-center justify-center"><GnomeAssembly /></div>;
  }

  const canGenerate = prompt.trim().length > 0 && apiKey.startsWith("sk-");

  return (
    <div className="flex flex-1 flex-col items-center justify-start p-4 sm:p-6 pt-8 sm:pt-12 animate-fade-in">
      <div className="w-full max-w-xl space-y-8">

        {/* ── Hero ─────────────────────────────────────────────────── */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Bot className="h-3.5 w-3.5" /> {t("create.badge")}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground leading-tight">
            {t("create.title")}
          </h1>
          <p className="text-muted-foreground text-base max-w-md mx-auto leading-relaxed">
            {t("create.subtitle")}
          </p>
        </div>

        {/* ── How it works ─────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {HOW_STEPS.map(({ icon: Icon, key, descKey }, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 text-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-xs font-semibold text-foreground">{t(key as any)}</p>
              <p className="text-[11px] text-muted-foreground leading-tight hidden sm:block">{t(descKey as any)}</p>
            </div>
          ))}
        </div>

        {/* ── Main form ────────────────────────────────────────────── */}
        <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-5 backdrop-blur-sm shadow-sm">

          {/* Description textarea */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t("create.instructions_label")} *</Label>
            <Textarea
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t("create.instructions_placeholder")}
              className="resize-none bg-background/60 text-sm leading-relaxed"
            />
          </div>

          {/* Bot name — optional */}
          <div className="space-y-2">
            <Label htmlFor="botName" className="flex items-center gap-1.5 text-sm">
              <Bot className="h-3.5 w-3.5" /> {t("create.bot_name")}
              <span className="text-muted-foreground font-normal ml-1">{t("create.optional")}</span>
            </Label>
            <Input
              id="botName"
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder={t("create.bot_name_placeholder")}
              className="bg-background/60"
            />
          </div>

          {/* Advanced toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex w-full items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            <Settings2 className="h-3.5 w-3.5" />
            {t("create.advanced")}
            {showAdvanced ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-2 gap-3 border-t border-border/50 pt-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("create.tone")}</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger className="bg-background/60 h-8 text-xs"><SelectValue /></SelectTrigger>
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
                  <SelectTrigger className="bg-background/60 h-8 text-xs"><SelectValue /></SelectTrigger>
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

          {/* API Key */}
          <div className="space-y-1.5 border-t border-border/50 pt-3">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Key className="h-3 w-3" /> {t("create.api_key_label")}
            </Label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={t("create.api_key_placeholder")}
                className="flex h-9 w-full rounded-md border border-input bg-background/60 pl-9 pr-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">{t("create.api_key_hint")}</p>
          </div>

          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={!canGenerate}
            size="lg"
            className="w-full gap-2 mt-1"
          >
            <Sparkles className="h-4 w-4" />
            {t("create.generate")}
            <ArrowRight className="h-4 w-4 ml-auto" />
          </Button>

          {!apiKey.startsWith("sk-") && apiKey.length > 0 && (
            <p className="text-xs text-destructive text-center">{t("create.api_key_error")}</p>
          )}
          {!apiKey && (
            <p className="text-xs text-muted-foreground text-center">{t("create.api_key_needed")}</p>
          )}
        </div>

      </div>
    </div>
  );
};

export default Index;
