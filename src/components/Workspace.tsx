import { useState, useEffect } from "react";
import { Copy, Pencil, Send, Check, Rocket } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeployModal } from "./DeployModal";

const MOCK_CHAT = [
  { role: "user" as const, text: "Привет! Хочу заказать пиццу." },
  { role: "bot" as const, text: "Здравствуйте! Добро пожаловать в пиццерию 'Мамма Мия'! С удовольствием приму ваш заказ. Какую пиццу желаете?" },
  { role: "user" as const, text: "Давайте с ананасами." },
  { role: "bot" as const, text: "Прошу прощения, но мы принципиально не готовим пиццу с ананасами. Могу предложить вам нашу фирменную 'Маргариту' — она просто восхитительна! Попробуем её?" },
];

export function Workspace() {
  const [copied, setCopied] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [deployOpen, setDeployOpen] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");

  useEffect(() => {
    // Читаем реальный промпт из localStorage, который сохранил API
    const savedPrompt = localStorage.getItem("generatedPrompt");
    setSystemPrompt(savedPrompt || "Промпт не загрузился. Попробуйте еще раз.");
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(systemPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-1 flex-col animate-fade-in h-full w-full">
      <div className="grid flex-1 gap-4 p-4 md:p-6 lg:grid-cols-2 min-h-0">
        {/* Left: System Prompt */}
        <Card className="flex flex-col glass-strong overflow-hidden h-[calc(100vh-12rem)]">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold">System Prompt (Optimized)</CardTitle>
            <div className="flex gap-1.5">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopy}>
                {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <pre className="h-full overflow-auto rounded-lg bg-background/50 p-4 font-mono text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {systemPrompt}
            </pre>
          </CardContent>
        </Card>

        {/* Right: Test Chat */}
        <Card className="flex flex-col glass-strong overflow-hidden h-[calc(100vh-12rem)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Test your Agent</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto space-y-4 p-4">
            {MOCK_CHAT.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </CardContent>
          <div className="p-4 border-t border-border/50">
            <div className="flex gap-2">
              <Input 
                placeholder="Type a message..." 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="bg-background/50"
              />
              <Button size="icon"><Send className="h-4 w-4" /></Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Bottom Action Bar */}
      <div className="p-4 md:px-6 border-t border-border/50 bg-background/80 backdrop-blur-xl flex justify-end shrink-0">
        <Button size="lg" className="gap-2" onClick={() => setDeployOpen(true)}>
          <Rocket className="h-4 w-4" />
          Deploy to Telegram
        </Button>
      </div>

      <DeployModal open={deployOpen} onOpenChange={setDeployOpen} />
    </div>
  );
}
