import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ExternalLink, Zap } from "lucide-react";

interface DeployModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const steps = [
  { num: 1, text: "Open Telegram and search for @BotFather" },
  { num: 2, text: 'Send /newbot and follow the instructions to create your bot' },
  { num: 3, text: "Copy the API token and paste it below" },
];

export function DeployModal({ open, onOpenChange }: DeployModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Connect Telegram & Activate</DialogTitle>
          <DialogDescription>Follow these steps to deploy your AI agent to Telegram.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Steps */}
          <div className="space-y-3">
            {steps.map((s) => (
              <div key={s.num} className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {s.num}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>

          {/* Token input */}
          <div className="space-y-2">
            <Label htmlFor="token" className="text-sm">Telegram Bot Token</Label>
            <Input
              id="token"
              placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v..."
              className="bg-background/50 font-mono text-xs"
            />
          </div>

          {/* Pricing */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">AutoBot Pro Plan</p>
                <p className="text-xs text-muted-foreground">Unlimited agents • Priority support</p>
              </div>
              <p className="text-2xl font-bold text-primary">$29<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
            </div>
          </div>

          {/* CTA */}
          <Button className="w-full gap-2" size="lg">
            <Zap className="h-4 w-4" />
            Subscribe via Gumroad & Launch
            <ExternalLink className="h-3.5 w-3.5 ml-1 opacity-50" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
