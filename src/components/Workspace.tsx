import { useState, useEffect, useRef } from "react";
import { Copy, Pencil, Send, Check, Rocket, Loader2, BarChart2, ShieldCheck, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeployWizard } from "./DeployWizard";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/hooks/useI18n";

export function Workspace() {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [deployOpen, setDeployOpen] = useState(false);
  const [agentId, setAgentId] = useState<string | undefined>();
  const [systemPrompt, setSystemPrompt] = useState("");
  const [metrics, setMetrics] = useState<any>(null);
  const [explain, setExplain] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    let savedPrompt = localStorage.getItem("generatedPrompt") || "Prompt not loaded.";
    const savedAgentId = localStorage.getItem("currentAgentId");
    if (savedAgentId) setAgentId(savedAgentId);
    let rawData = localStorage.getItem("tfmData");
    
    try {
      if (rawData) {
        const parsedData = JSON.parse(rawData);
        if (parsedData.modeFreeMetrics) setMetrics(parsedData.modeFreeMetrics);
        if (parsedData.explanations && parsedData.explanations.length > 0) {
          setExplain(parsedData.explanations[0]);
        }
      }
      
      if (savedPrompt.trim().startsWith('{')) {
        const parsed = JSON.parse(savedPrompt);
        if (parsed.improvedPrompt) {
          savedPrompt = typeof parsed.improvedPrompt === 'string' 
            ? parsed.improvedPrompt 
            : JSON.stringify(parsed.improvedPrompt, null, 2);
        }
      }
    } catch(e) {}
    
    setSystemPrompt(savedPrompt);
    setMessages([{ role: "assistant", content: t("workspace.chat_intro") }]);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(systemPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isTyping) return;
    const userMessage = chatInput;
    setChatInput("");
    
    const newMessages = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setIsTyping(true);

    try {
      const OPENAI_API_KEY = localStorage.getItem("userOpenAiKey") || ""; 
      
      if (!OPENAI_API_KEY.startsWith("sk-")) {
        setMessages([...newMessages, { role: "assistant", content: t("workspace.no_key") }]);
        setIsTyping(false);
        return;
      }

      const chatHistory = newMessages
        .filter(m => m.content !== t("workspace.chat_intro"))
        .map(m => ({ role: m.role, content: m.content }));

      const { data, error } = await supabase.functions.invoke("test-bot", {
        body: {
          messages: chatHistory,
          systemPrompt,
          openaiKey: OPENAI_API_KEY,
        },
      });

      if (error) {
        setMessages([...newMessages, { role: "assistant", content: `❌ Error: ${error.message}` }]);
      } else if (data?.content) {
        setMessages([...newMessages, { role: "assistant", content: data.content }]);
      } else if (data?.error) {
        setMessages([...newMessages, { role: "assistant", content: `❌ API Error: ${data.error}` }]);
      }
    } catch (error) {
      setMessages([...newMessages, { role: "assistant", content: t("workspace.network_error") }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col animate-fade-in h-full w-full bg-background overflow-hidden">
      
      {metrics && (
        <div className="grid grid-cols-3 gap-4 p-4 md:p-6 pb-0 shrink-0">
          <Card className="glass-strong p-4 flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg"><BarChart2 className="text-primary w-5 h-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{t("workspace.rgi")}</p>
              <h4 className="text-2xl font-bold text-primary">+{metrics.rgiPercent}%</h4>
            </div>
          </Card>
          <Card className="glass-strong p-4 flex items-center gap-4">
            <div className="p-3 bg-success/10 rounded-lg"><ShieldCheck className="text-success w-5 h-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{t("workspace.qg")}</p>
              <h4 className="text-2xl font-bold text-success">+{metrics.qualityGainPercent}%</h4>
            </div>
          </Card>
          <Card className="glass-strong p-4 flex items-center gap-4">
            <div className="p-3 bg-accent/50 rounded-lg"><Zap className="text-accent-foreground w-5 h-5" /></div>
            <div className="overflow-hidden">
              <p className="text-xs text-muted-foreground font-medium">{t("workspace.issues_fixed")}</p>
              <p className="text-xs font-semibold truncate w-full" title={explain?.mainIssues?.join(", ")}>
                {explain?.mainIssues?.[0] || t("workspace.structure_enhanced")}
              </p>
            </div>
          </Card>
        </div>
      )}

      <div className="grid flex-1 gap-4 p-4 md:p-6 lg:grid-cols-2 min-h-0">
        <Card className="flex flex-col glass-strong overflow-hidden h-full border-primary/20">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3 bg-muted/20 border-b border-border/50">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              {t("workspace.agent_persona")}
            </CardTitle>
            <div className="flex gap-1.5">
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/20" onClick={() => {
                if (isEditing) {
                  localStorage.setItem("generatedPrompt", systemPrompt);
                }
                setIsEditing(!isEditing);
                if (!isEditing) setTimeout(() => textareaRef.current?.focus(), 50);
              }}>
                {isEditing ? <Check className="h-3.5 w-3.5 text-success" /> : <Pencil className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/20" onClick={handleCopy}>
                {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            {isEditing ? (
              <textarea
                ref={textareaRef}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="h-full w-full resize-none bg-background/30 p-5 font-mono text-[13px] leading-relaxed text-foreground focus:outline-none selection:bg-primary/30"
              />
            ) : (
              <pre className="h-full overflow-auto bg-background/30 p-5 font-mono text-[13px] leading-relaxed text-foreground whitespace-pre-wrap selection:bg-primary/30">
                {systemPrompt}
              </pre>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col glass-strong overflow-hidden h-full">
          <CardHeader className="pb-3 bg-muted/20 border-b border-border/50">
            <CardTitle className="text-sm font-semibold">{t("workspace.live_sandbox")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col overflow-hidden p-0">
            <div className="flex-1 space-y-4 overflow-auto p-4 bg-dot-pattern">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed shadow-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-card border border-border text-card-foreground rounded-bl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl px-4 py-2.5 bg-card border border-border rounded-bl-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-border/50 bg-background/50">
              <div className="flex gap-2">
                <Input
                  placeholder={t("workspace.test_placeholder")}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  className="bg-card shadow-sm border-border/50"
                  disabled={isTyping}
                />
                <Button className="shrink-0 shadow-sm" onClick={handleSendMessage} disabled={isTyping || !chatInput.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="p-4 md:px-6 border-t border-border/50 bg-background/80 backdrop-blur-xl flex justify-end shrink-0 z-10">
        <Button size="lg" className="gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform" onClick={() => setDeployOpen(true)}>
          <Rocket className="h-4 w-4" />
          {t("workspace.deploy_bot")}
        </Button>
      </div>

      <DeployWizard
        open={deployOpen}
        onOpenChange={setDeployOpen}
        agentId={agentId}
        systemPrompt={systemPrompt}
        initialData={{
          bot_name: localStorage.getItem("botName") || "",
          short_description: localStorage.getItem("botDescription") || "",
        }}
      />
    </div>
  );
}
