import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, Zap, MessageCircle, Send, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DeployModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId?: string;
}

const telegramSteps = [
  { num: 1, text: "Open Telegram and search for @BotFather" },
  { num: 2, text: "Send /newbot and follow the instructions to create your bot" },
  { num: 3, text: "Copy the API token and paste it below" },
];

const whatsappSteps = [
  { num: 1, text: "Go to Meta Business Suite and create a WhatsApp Business App" },
  { num: 2, text: "Get your Phone Number ID and Access Token from the API settings" },
  { num: 3, text: "Paste both credentials below" },
];

export function DeployModal({ open, onOpenChange, agentId }: DeployModalProps) {
  const [tgToken, setTgToken] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState(false);
  const [botUsername, setBotUsername] = useState("");

  const handleDeployTelegram = async () => {
    if (!agentId) {
      toast.error("No agent selected for deployment");
      return;
    }
    setDeploying(true);

    try {
      const { data, error } = await supabase.functions.invoke("deploy-telegram", {
        body: { agentId, telegramToken: tgToken },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setDeployed(true);
      setBotUsername(data.botInfo?.username || "");
      toast.success(data.message || "Bot deployed!");
    } catch (err: any) {
      toast.error(err.message || "Deployment failed");
    } finally {
      setDeploying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">Deploy Your Bot</DialogTitle>
          <DialogDescription>Choose a platform and connect your bot.</DialogDescription>
        </DialogHeader>

        {deployed ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <CheckCircle className="h-12 w-12 text-success" />
            <div>
              <p className="text-lg font-semibold text-foreground">Bot Deployed!</p>
              {botUsername && (
                <p className="text-sm text-muted-foreground mt-1">
                  Your bot is live at{" "}
                  <a href={`https://t.me/${botUsername}`} target="_blank" rel="noopener" className="text-primary underline">
                    @{botUsername}
                  </a>
                </p>
              )}
            </div>
            <Button onClick={() => { setDeployed(false); onOpenChange(false); }}>Done</Button>
          </div>
        ) : (
          <>
            <Tabs defaultValue="telegram" className="pt-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="telegram" className="gap-2">
                  <Send className="h-4 w-4" /> Telegram
                </TabsTrigger>
                <TabsTrigger value="whatsapp" className="gap-2">
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </TabsTrigger>
              </TabsList>

              <TabsContent value="telegram" className="space-y-5 pt-4">
                <div className="space-y-3">
                  {telegramSteps.map((s) => (
                    <div key={s.num} className="flex gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                        {s.num}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{s.text}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tg-token" className="text-sm">Bot Token</Label>
                  <Input
                    id="tg-token"
                    value={tgToken}
                    onChange={(e) => setTgToken(e.target.value)}
                    placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v..."
                    className="bg-background/50 font-mono text-xs"
                  />
                </div>
                <Button
                  className="w-full gap-2"
                  size="lg"
                  onClick={handleDeployTelegram}
                  disabled={deploying || !agentId}
                >
                  {deploying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  {deploying ? "Deploying..." : "Deploy to Telegram"}
                </Button>
              </TabsContent>

              <TabsContent value="whatsapp" className="space-y-5 pt-4">
                <div className="space-y-3">
                  {whatsappSteps.map((s) => (
                    <div key={s.num} className="flex gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                        {s.num}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{s.text}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wa-phone" className="text-sm">Phone Number ID</Label>
                  <Input id="wa-phone" placeholder="1234567890" className="bg-background/50 font-mono text-xs" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wa-token" className="text-sm">Access Token</Label>
                  <Input id="wa-token" type="password" placeholder="EAAxxxxxxx..." className="bg-background/50 font-mono text-xs" />
                </div>
                <Button className="w-full gap-2" size="lg" disabled>
                  <MessageCircle className="h-4 w-4" />
                  Coming Soon
                </Button>
              </TabsContent>
            </Tabs>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 mt-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">BotForge Pro Plan</p>
                  <p className="text-xs text-muted-foreground">Unlimited agents • Priority support</p>
                </div>
                <p className="text-2xl font-bold text-primary">$29<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
