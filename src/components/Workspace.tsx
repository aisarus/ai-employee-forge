import { useState } from "react";
import { Copy, Pencil, Send, Check, Rocket } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DeployModal } from "./DeployModal";

const MOCK_PROMPT = `## Role
You are a friendly AI assistant for "Bloom & Petal" flower shop.

## Task 1: Order Processing
- Greet the customer warmly
- Help them choose flowers from the catalog
- Collect delivery address and phone number

## Constraints
- Delivery fee: $5 flat rate
- If roses are out of stock → suggest tulips
- Never discuss competitor prices
- Always confirm order before finalizing

## Output Format
Respond conversationally. Use emojis sparingly.
End each interaction with order summary.`;

const MOCK_CHAT = [
  { role: "user" as const, text: "Hi! I'd like to order some roses for delivery." },
  { role: "bot" as const, text: "Hello! 🌹 Welcome to Bloom & Petal! I'd love to help you with roses. Unfortunately, our red roses are currently out of stock. However, we have beautiful fresh tulips available — would you like to try those instead?" },
  { role: "user" as const, text: "Sure, tulips sound great! I'll take a dozen." },
  { role: "bot" as const, text: "Wonderful choice! A dozen tulips it is. 🌷 That'll be $24.99 + $5 delivery. Could you please share your delivery address and phone number so we can get those to you?" },
];

export function Workspace() {
  const [copied, setCopied] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [deployOpen, setDeployOpen] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(MOCK_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-1 flex-col animate-fade-in">
      <div className="grid flex-1 gap-4 p-4 md:p-6 lg:grid-cols-2">
        {/* Left: System Prompt */}
        <Card className="flex flex-col glass-strong">
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
          <CardContent className="flex-1">
            <pre className="h-full overflow-auto rounded-lg bg-background/50 p-4 font-mono text-xs leading-relaxed text-muted-foreground">
              {MOCK_PROMPT}
            </pre>
          </CardContent>
        </Card>

        {/* Right: Chat */}
        <Card className="flex flex-col glass-strong">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Test your Agent</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-auto rounded-lg bg-background/50 p-4 mb-3">
              {MOCK_CHAT.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-accent text-accent-foreground rounded-bl-md"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Type a message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="bg-background/50"
              />
              <Button size="icon" className="shrink-0">
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
