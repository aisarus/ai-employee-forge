import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, Zap, MessageCircle, Send } from "lucide-react";

interface DeployModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function DeployModal({ open, onOpenChange }: DeployModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">Deploy Your Bot</DialogTitle>
          <DialogDescription>Choose a platform and connect your bot.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="telegram" className="pt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="telegram" className="gap-2">
              <Send className="h-4 w-4" /> Telegram
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-2">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </TabsTrigger>
          </TabsList>

          {/* Telegram */}
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
              <Input id="tg-token" placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v..." className="bg-background/50 font-mono text-xs" />
            </div>
          </TabsContent>

          {/* WhatsApp */}
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
          </TabsContent>
        </Tabs>

        {/* Pricing */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 mt-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">BotForge Pro Plan</p>
              <p className="text-xs text-muted-foreground">Unlimited agents • Priority support</p>
            </div>
            <p className="text-2xl font-bold text-primary">$29<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
          </div>
        </div>

        <Button className="w-full gap-2" size="lg">
          <Zap className="h-4 w-4" />
          Subscribe & Launch
          <ExternalLink className="h-3.5 w-3.5 ml-1 opacity-50" />
        </Button>
      </DialogContent>
    </Dialog>
  );
}
