import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WizardData } from "./types";
import { Bot, Globe, Palette, MessageCircle, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/hooks/useI18n";

interface Props {
  data: WizardData;
  systemPrompt: string;
}

const SAMPLE_INPUTS = ["Hello", "Can you help me?", "What can you do?"];

export function StepBehaviorPreview({ data, systemPrompt }: Props) {
  const { t } = useI18n();
  const [replies, setReplies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

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
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-foreground">{t("wizard.behavior_title")}</h2>
        <p className="text-sm text-muted-foreground">{t("wizard.behavior_desc")}</p>
      </div>

      <Card className="p-5 space-y-3 bg-muted/30 border-border/50">
        <h3 className="text-sm font-semibold text-foreground">{t("wizard.personality_summary")}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { icon: Bot, label: t("wizard.name"), value: data.bot_name || "—" },
            { icon: Globe, label: t("wizard.language"), value: data.default_language },
            { icon: Palette, label: t("wizard.tone"), value: data.tone },
            { icon: MessageCircle, label: t("wizard.style"), value: data.response_style },
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

      <div className="space-y-3">
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
              <Card key={i} className="p-4 space-y-2 bg-background/50">
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
