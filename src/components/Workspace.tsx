import { useState, useEffect } from "react";
import { Copy, Pencil, Send, Check, Rocket, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeployModal } from "./DeployModal";

export function Workspace() {
  const [copied, setCopied] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [deployOpen, setDeployOpen] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  
  // Real chat state
  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    // Read the generated prompt from API
    let savedPrompt = localStorage.getItem("generatedPrompt") || "Промпт не загрузился.";
    
    // Sometimes the API returns JSON string, let's try to extract the text if so
    try {
      if (savedPrompt.trim().startsWith('{')) {
        const parsed = JSON.parse(savedPrompt);
        // If it's our Proposer JSON format
        if (parsed.improvedPrompt) {
          savedPrompt = typeof parsed.improvedPrompt === 'string' 
            ? parsed.improvedPrompt 
            : JSON.stringify(parsed.improvedPrompt, null, 2);
        }
      }
    } catch(e) {
      // Not JSON, keep as is
    }
    
    setSystemPrompt(savedPrompt);
    
    // Initialize chat with a welcome message based on the prompt type (mocked logic)
    setMessages([
      { role: "assistant", content: "Привет! Я твой новый ИИ-сотрудник, работаю по инструкции слева. Напиши мне что-нибудь!" }
    ]);
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
    
    // Add user message to UI
    const newMessages = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setIsTyping(true);

    try {
      // NOTE: Replace this with your actual OpenAI Key for testing!
      // In production, this should go through your backend, not frontend directly.
      const OPENAI_API_KEY = localStorage.getItem("userOpenAiKey") || ""; 
      
      if (OPENAI_API_KEY.includes("ТВОЙ_КЛЮЧ")) {
        setTimeout(() => {
          setMessages([...newMessages, { role: "assistant", content: "⚠️ Вставь свой настоящий OpenAI ключ в файл Workspace.tsx (строка 45), чтобы чат ожил!" }]);
          setIsTyping(false);
        }, 1000);
        return;
      }

      // Build the message history for OpenAI
      const apiMessages = [
        { role: "system", content: systemPrompt },
        // Map frontend messages to OpenAI format (ignoring the first welcome message if it's not relevant, but let's keep it simple)
        ...newMessages.filter(m => m.content !== "Привет! Я твой новый ИИ-сотрудник, работаю по инструкции слева. Напиши мне что-нибудь!").map(m => ({
          role: m.role,
          content: m.content
        }))
      ];

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: apiMessages,
          temperature: 0.7
        })
      });

      const data = await response.json();
      
      if (data.choices && data.choices[0]) {
        setMessages([...newMessages, { role: "assistant", content: data.choices[0].message.content }]);
      } else {
        setMessages([...newMessages, { role: "assistant", content: `❌ Ошибка API: ${data.error?.message || "Unknown error"}` }]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages([...newMessages, { role: "assistant", content: "❌ Ошибка сети при вызове OpenAI." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-1 flex-col animate-fade-in">
      <div className="grid flex-1 gap-4 p-4 md:p-6 lg:grid-cols-2">
        
        {/* Left: System Prompt */}
        <Card className="flex flex-col glass-strong h-[calc(100vh-10rem)]">
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
            <pre className="h-full overflow-auto rounded-lg bg-background/50 p-4 font-mono text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {systemPrompt}
            </pre>
          </CardContent>
        </Card>

        {/* Right: Test Chat */}
        <Card className="flex flex-col glass-strong h-[calc(100vh-10rem)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Test your Agent</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 space-y-4 overflow-auto rounded-lg bg-background/50 p-4 mb-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-accent text-accent-foreground rounded-bl-md"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl px-4 py-2.5 bg-accent text-accent-foreground rounded-bl-md">
                    <Loader2 className="h-4 w-4 animate-spin opacity-50" />
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <Input
                placeholder="Type a message... (Press Enter to send)"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyPress}
                className="bg-background/50"
                disabled={isTyping}
              />
              <Button size="icon" className="shrink-0" onClick={handleSendMessage} disabled={isTyping || !chatInput.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom action bar */}
      <div className="sticky bottom-0 border-t border-border/50 bg-background/80 backdrop-blur-xl p-4">
        <div className="flex justify-end">
          <Button
            onClick={() => setDeployOpen(true)}
            className="bg-success text-success-foreground hover:bg-success/90 gap-2"
          >
            <Rocket className="h-4 w-4" />
            Deploy to Telegram
          </Button>
        </div>
      </div>

      <DeployModal open={deployOpen} onOpenChange={setDeployOpen} />
    </div>
  );
}
