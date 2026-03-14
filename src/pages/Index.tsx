import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect, useCallback } from "react";
import { Sparkles, Key, Bot, FileText, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GnomeAssembly } from "@/components/GnomeAssembly";
import { Workspace } from "@/components/Workspace";
import { runTriTfmPipeline } from "@/lib/tri-tfm";
import { useI18n } from "@/hooks/useI18n";

type WorkflowState = "input" | "loading" | "workspace";

const Index = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const [state, setState] = useState<WorkflowState>("input");
  const [botName, setBotName] = useState("");
  const [botDescription, setBotDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState("professional");
  const [responseStyle, setResponseStyle] = useState("concise");
  const [apiKey, setApiKey] = useState(localStorage.getItem("userOpenAiKey") || "");
  const [progressMsg, setProgressMsg] = useState("");

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
        const behaviorContext = `Bot name: ${botName || "AI Assistant"}\nBot description: ${botDescription || "General assistant"}\nTone: ${tone}\nResponse style: ${responseStyle}\n\nBusiness rules:\n${prompt}`;

        const result = await runTriTfmPipeline({
          prompt: behaviorContext,
          apiKey,
          config: {
            maxIterations: 5,
            useProposerCriticVerifier: true,
            proposerCriticOnly: true,
          },
          onProgress: (stage, detail) => {
            setProgressMsg(detail || stage);
          },
        });

        if (user) {
          const { data: insertedAgent } = await supabase.from("agents").insert({
            user_id: user.id,
            name: botName || "AutoBot",
            description: botDescription || prompt,
            raw_instructions: prompt,
            system_prompt: result.finalText || "Error generating prompt",
            tone,
            response_style: responseStyle,
          }).select("id").single();

          if (insertedAgent) {
            localStorage.setItem("currentAgentId", insertedAgent.id);
          }
        }

        localStorage.setItem("generatedPrompt", result.finalText || "");
        localStorage.setItem("tfmData", JSON.stringify(result));
        localStorage.setItem("botName", botName || "AI Assistant");
        localStorage.setItem("botDescription", botDescription || prompt);
        setState("workspace");
      } catch (e) {
        console.error("TRI-TFM pipeline error:", e);
        setState("workspace");
      }
    };
    runPipeline();
  }, [state]);

  if (state === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <GnomeAssembly />
      </div>
    );
  }

  if (state === "workspace") {
    return <Workspace />;
  }

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-8 animate-fade-in">
        <div className="space-y-3 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t("create.title")}
          </h1>
          <p className="text-muted-foreground text-base max-w-lg mx-auto leading-relaxed">
            {t("create.subtitle")}
          </p>
        </div>

        <div className="space-y-5">
          {/* API Key */}
          <div className="relative">
            <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t("create.api_key_placeholder")}
              className="flex h-10 w-full rounded-md border border-input bg-background/50 pl-10 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Bot identity */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="botName" className="flex items-center gap-1.5 text-sm">
                <Bot className="h-3.5 w-3.5" /> {t("create.bot_name")}
              </Label>
              <Input
                id="botName"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                placeholder={t("create.bot_name_placeholder")}
                className="bg-card/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="botDesc" className="flex items-center gap-1.5 text-sm">
                <FileText className="h-3.5 w-3.5" /> {t("create.description")}
              </Label>
              <Input
                id="botDesc"
                value={botDescription}
                onChange={(e) => setBotDescription(e.target.value)}
                placeholder={t("create.description_placeholder")}
                className="bg-card/50"
              />
            </div>
          </div>

          {/* Behavior config */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm">
                <Settings2 className="h-3.5 w-3.5" /> {t("create.tone")}
              </Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger className="bg-card/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">{t("create.tone.professional")}</SelectItem>
                  <SelectItem value="friendly">{t("create.tone.friendly")}</SelectItem>
                  <SelectItem value="formal">{t("create.tone.formal")}</SelectItem>
                  <SelectItem value="casual">{t("create.tone.casual")}</SelectItem>
                  <SelectItem value="humorous">{t("create.tone.humorous")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm">
                {t("create.response_style")}
              </Label>
              <Select value={responseStyle} onValueChange={setResponseStyle}>
                <SelectTrigger className="bg-card/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="concise">{t("create.style.concise")}</SelectItem>
                  <SelectItem value="detailed">{t("create.style.detailed")}</SelectItem>
                  <SelectItem value="step-by-step">{t("create.style.step_by_step")}</SelectItem>
                  <SelectItem value="conversational">{t("create.style.conversational")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Raw instructions */}
          <Textarea
            rows={6}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t("create.instructions_placeholder")}
            className="resize-none bg-card/50 backdrop-blur-sm text-sm leading-relaxed"
          />

          <Button
            onClick={handleGenerate}
            disabled={!prompt.trim() || !apiKey.startsWith("sk-")}
            size="lg"
            className="w-full gap-2"
          >
            <Sparkles className="h-4 w-4" />
            {t("create.generate")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
