import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WizardData } from "./types";
import { Bot, Globe, Palette, MessageCircle, Sparkles, Loader2, Brain, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/hooks/useI18n";

interface Props {
  data: WizardData;
  systemPrompt: string;
}

const SAMPLE_INPUTS = ["Hello", "Can you help me?", "What can you do?"];

/** Builds contextual synthetic log lines from wizard data */
function buildLogLines(data: WizardData, systemPrompt: string): Array<{ text: string; type: "info" | "ok" | "dim" }> {
  const lines: Array<{ text: string; type: "info" | "ok" | "dim" }> = [];
  lines.push({ text: "[INIT] Loading bot configuration…", type: "dim" });
  if (data.bot_name)      lines.push({ text: `[AGENT] Name: ${data.bot_name}  •  Type: ${data.bot_type || "custom"}`, type: "info" });
  lines.push({ text: `[PERSONA] Tone: ${data.tone}  •  Style: ${data.response_style}  •  Lang: ${data.default_language}`, type: "info" });
  if (data.short_description)
    lines.push({ text: `[BIO] "${data.short_description.slice(0, 60)}${data.short_description.length > 60 ? "…" : ""}"`, type: "dim" });
  if (data.workflow_steps?.length)
    lines.push({ text: `[FLOW] Injecting ${data.workflow_steps.length} workflow step${data.workflow_steps.length > 1 ? "s" : ""}`, type: "info" });
  if (data.logic_rules?.length)
    lines.push({ text: `[RULES] Applying ${data.logic_rules.length} logic rule${data.logic_rules.length > 1 ? "s" : ""}`, type: "info" });
  if (data.data_fields?.length)
    lines.push({ text: `[DATA] Mapping ${data.data_fields.length} data field${data.data_fields.length > 1 ? "s" : ""}`, type: "info" });
  if (data.connectors?.length)
    lines.push({ text: `[INT] Registering ${data.connectors.length} integration connector${data.connectors.length > 1 ? "s" : ""}`, type: "info" });
  if (data.welcome_message)
    lines.push({ text: `[MSG] Welcome message: ${data.welcome_message.slice(0, 48)}…`, type: "dim" });
  lines.push({ text: "[CORE] Assembling system prompt…", type: "info" });
  const tokens = Math.round(systemPrompt.length / 4);
  lines.push({ text: `[OK] Context ready  ·  ~${tokens} tokens  ·  ${systemPrompt.length} chars`, type: "ok" });
  return lines;
}

/** Animated AI brain context assembly panel */
function BrainContextAssembly({ data, systemPrompt, onDone }: { data: WizardData; systemPrompt: string; onDone: () => void }) {
  const logLines = buildLogLines(data, systemPrompt);
  const [visibleCount, setVisibleCount] = useState(0);
  const [done, setDone] = useState(false);
  // Total duration: show each line with 280ms gap, last line triggers done
  const LINE_INTERVAL = 260;

  useEffect(() => {
    if (visibleCount >= logLines.length) {
      const t = setTimeout(() => { setDone(true); onDone(); }, 400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setVisibleCount((v) => v + 1), LINE_INTERVAL);
    return () => clearTimeout(t);
  }, [visibleCount, logLines.length]);

  const progress = Math.round((visibleCount / logLines.length) * 100);

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-4 animate-step-enter">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center h-10 w-10 shrink-0">
          {/* Radar rings */}
          <span className="absolute inset-0 rounded-full border border-primary/30 animate-radar-ring" />
          <span className="absolute inset-0 rounded-full border border-primary/20 animate-radar-ring-2" />
          <span className="absolute inset-0 rounded-full border border-primary/10 animate-radar-ring-3" />
          <Brain className="h-5 w-5 text-primary animate-brain-pulse relative z-10" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {done ? "Контекст собран" : "ИИ собирает контекст…"}
          </p>
          <p className="text-xs text-muted-foreground">
            {done ? "Системный промпт готов к работе" : "Анализирую конфигурацию агента"}
          </p>
        </div>
        {done && <CheckCircle2 className="h-5 w-5 text-success shrink-0 animate-success-pop" />}
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full rounded-full bg-primary/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Log terminal */}
      <div className="rounded-lg bg-background/60 border border-border/50 px-4 py-3 font-mono text-[11px] space-y-1 max-h-48 overflow-y-auto">
        {logLines.slice(0, visibleCount).map((line, i) => (
          <div
            key={i}
            className="animate-log-appear"
            style={{ animationDelay: "0ms" }} // already revealed via visibleCount
          >
            <span
              className={
                line.type === "ok"   ? "text-green-400" :
                line.type === "info" ? "text-primary/80" :
                                       "text-muted-foreground/60"
              }
            >
              {line.text}
            </span>
          </div>
        ))}
        {!done && visibleCount < logLines.length && (
          <span className="text-primary/50 animate-cursor-blink">▋</span>
        )}
      </div>
    </div>
  );
}

export function StepBehaviorPreview({ data, systemPrompt }: Props) {
  const { t } = useI18n();
  const [replies, setReplies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [assemblyDone, setAssemblyDone] = useState(false);

  const generateReplies = async () => {
    setLoading(true);
    try {
      const apiKey = localStorage.getItem("userOpenAiKey") || "";
      const results: string[] = [];
      for (const input of SAMPLE_INPUTS) {
        const { data: resp } = await supabase.functions.invoke("test-bot", {
          body: {
            messages: [{ role: "user", content: input }],
            systemPrompt,
            openaiKey: apiKey,
          },
        });
        results.push(resp?.content || "⚠️ No response");
      }
      setReplies(results);
    } catch {
      setReplies(["Error generating preview"]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-1 animate-fade-up" style={{ animationDelay: "0ms" }}>
        <h2 className="text-xl font-bold text-foreground">{t("wizard.behavior_title")}</h2>
        <p className="text-sm text-muted-foreground">{t("wizard.behavior_desc")}</p>
      </div>

      {/* AI Brain context assembly */}
      <BrainContextAssembly data={data} systemPrompt={systemPrompt} onDone={() => setAssemblyDone(true)} />

      {/* Personality summary — fades in after assembly */}
      <div
        className={`transition-all duration-500 ${assemblyDone ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"}`}
      >
        <Card className="p-5 space-y-3 bg-muted/30 border-border/50">
          <h3 className="text-sm font-semibold text-foreground">{t("wizard.personality_summary")}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { icon: Bot,           label: t("wizard.name"),     value: data.bot_name || "—" },
              { icon: Globe,         label: t("wizard.language"), value: data.default_language },
              { icon: Palette,       label: t("wizard.tone"),     value: data.tone },
              { icon: MessageCircle, label: t("wizard.style"),    value: data.response_style },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <p className="text-sm font-medium text-foreground">{value}</p>
                </div>
              </div>
            ))}
          </div>
          {data.short_description && (
            <p className="text-sm text-muted-foreground border-t border-border/50 pt-3">{data.short_description}</p>
          )}
        </Card>
      </div>

      {/* Example replies section — fades in after assembly */}
      <div
        className={`space-y-3 transition-all duration-500 delay-100 ${assemblyDone ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"}`}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{t("wizard.example_replies")}</h3>
          <Button variant="outline" size="sm" onClick={generateReplies} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {loading ? t("wizard.generating") : t("wizard.generate_previews")}
          </Button>
        </div>

        {replies.length > 0 ? (
          <div className="space-y-3">
            {SAMPLE_INPUTS.map((input, i) => (
              <Card
                key={i}
                className="p-4 space-y-2 bg-background/50 animate-fade-up"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <p className="text-xs font-medium text-primary">{t("wizard.user_says")} "{input}"</p>
                <p className="text-sm text-foreground leading-relaxed">{replies[i] || "..."}</p>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center bg-background/50">
            <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{t("wizard.click_generate")}</p>
          </Card>
        )}
      </div>
    </div>
  );
}
