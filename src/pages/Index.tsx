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

type WorkflowState = "input" | "loading" | "workspace";

const Index = () => {
  const { user } = useAuth();
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

        await supabase.from("agents").insert({
          name: botName || "AutoBot",
          description: botDescription || prompt,
          system_prompt: result.finalText || "Error generating prompt",
        });

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
            Build your AI Bot
          </h1>
          <p className="text-muted-foreground text-base max-w-lg mx-auto leading-relaxed">
            Describe your business in plain text, we do the prompt engineering.
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
              placeholder="Paste your OpenAI API Key (sk-...)"
              className="flex h-10 w-full rounded-md border border-input bg-background/50 pl-10 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Bot identity */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="botName" className="flex items-center gap-1.5 text-sm">
                <Bot className="h-3.5 w-3.5" /> Bot Name
              </Label>
              <Input
                id="botName"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                placeholder="e.g., Flora Assistant"
                className="bg-card/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="botDesc" className="flex items-center gap-1.5 text-sm">
                <FileText className="h-3.5 w-3.5" /> Description
              </Label>
              <Input
                id="botDesc"
                value={botDescription}
                onChange={(e) => setBotDescription(e.target.value)}
                placeholder="e.g., Flower shop sales bot"
                className="bg-card/50"
              />
            </div>
          </div>

          {/* Behavior config */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm">
                <Settings2 className="h-3.5 w-3.5" /> Tone
              </Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger className="bg-card/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="formal">Formal</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="humorous">Humorous</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm">
                Response Style
              </Label>
              <Select value={responseStyle} onValueChange={setResponseStyle}>
                <SelectTrigger className="bg-card/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="concise">Concise</SelectItem>
                  <SelectItem value="detailed">Detailed</SelectItem>
                  <SelectItem value="step-by-step">Step-by-step</SelectItem>
                  <SelectItem value="conversational">Conversational</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Raw instructions */}
          <Textarea
            rows={6}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., I sell flowers. Delivery is $5. If roses are out of stock, offer tulips. Ask for address and phone number."
            className="resize-none bg-card/50 backdrop-blur-sm text-sm leading-relaxed"
          />

          <Button
            onClick={handleGenerate}
            disabled={!prompt.trim() || !apiKey.startsWith("sk-")}
            size="lg"
            className="w-full gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Generate AI Brain
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
