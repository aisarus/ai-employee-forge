import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, Zap, MessageCircle, Send, Loader2, CheckCircle, ChevronDown, Settings } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/hooks/useI18n";

interface DeployModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId?: string;
}

export function DeployModal({ open, onOpenChange, agentId }: DeployModalProps) {
  const { t } = useI18n();
  const [tgToken, setTgToken] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState(false);
  const [botUsername, setBotUsername] = useState("");

  const telegramSteps = [
    { num: 1, text: t("deploy.tg_step1") },
    { num: 2, text: t("deploy.tg_step2") },
    { num: 3, text: t("deploy.tg_step3") },
  ];

  const whatsappSteps = [
    { num: 1, text: t("deploy.wa_step1") },
    { num: 2, text: t("deploy.wa_step2") },
    { num: 3, text: t("deploy.wa_step3") },
  ];

  const handleDeployTelegram = async () => {
    if (!agentId) {
      toast.error(t("deploy.no_agent"));
      return;
    }
    setDeploying(true);

    try {
      const body: any = { agentId, telegramToken: tgToken };
      if (openaiKey.trim()) body.openaiApiKey = openaiKey.trim();
      const { data, error } = await supabase.functions.invoke("deploy-telegram", { body });

      if (error) throw new Error(error.message || "Deploy failed");
      if (data?.error) throw new Error(data.error);

      setDeployed(true);
      setBotUsername(data.botInfo?.username || "");
      toast.success(data.message || t("deploy.bot_deployed"));
    } catch (err: any) {
      toast.error(err.message || t("deploy.failed"));
    } finally {
      setDeploying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">{t("deploy.title")}</DialogTitle>
          <DialogDescription>{t("deploy.subtitle")}</DialogDescription>
        </DialogHeader>

        {deployed ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <CheckCircle className="h-12 w-12 text-success" />
            <div>
              <p className="text-lg font-semibold text-foreground">{t("deploy.bot_deployed")}</p>
              {botUsername && (
                <p className="text-sm text-muted-foreground mt-1">
                  {t("deploy.bot_live")}{" "}
                  <a href={`https://t.me/${botUsername}`} target="_blank" rel="noopener" className="text-primary underline">
                    @{botUsername}
                  </a>
                </p>
              )}
            </div>
            <Button onClick={() => { setDeployed(false); onOpenChange(false); }}>{t("deploy.done")}</Button>
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
                  <Label htmlFor="tg-token" className="text-sm">{t("deploy.bot_token")}</Label>
                  <Input
                    id="tg-token"
                    value={tgToken}
                    onChange={(e) => setTgToken(e.target.value)}
                    placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v..."
                    className="bg-background/50 font-mono text-xs"
                  />
                </div>
                <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <Settings className="h-3.5 w-3.5" />
                    <span>Advanced Settings</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 space-y-2">
                    <Label htmlFor="openai-key" className="text-sm">OpenAI API Key <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input
                      id="openai-key"
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                      placeholder="sk-..."
                      type="password"
                      className="bg-background/50 font-mono text-xs"
                    />
                    <p className="text-xs text-muted-foreground">Leave empty to use built-in AI. Provide your key for GPT-4o.</p>
                  </CollapsibleContent>
                </Collapsible>
                <Button
                  className="w-full gap-2"
                  size="lg"
                  onClick={handleDeployTelegram}
                  disabled={deploying || !agentId || !tgToken}
                >
                  {deploying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  {deploying ? t("deploy.deploying") : t("deploy.deploy_tg")}
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
                  <Label htmlFor="wa-phone" className="text-sm">{t("deploy.wa_phone")}</Label>
                  <Input id="wa-phone" placeholder="1234567890" className="bg-background/50 font-mono text-xs" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wa-token" className="text-sm">{t("deploy.wa_token")}</Label>
                  <Input id="wa-token" type="password" placeholder="EAAxxxxxxx..." className="bg-background/50 font-mono text-xs" />
                </div>
                <Button className="w-full gap-2" size="lg" disabled>
                  <MessageCircle className="h-4 w-4" />
                  {t("deploy.coming_soon")}
                </Button>
              </TabsContent>
            </Tabs>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 mt-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{t("deploy.pro_plan")}</p>
                  <p className="text-xs text-muted-foreground">{t("deploy.pro_desc")}</p>
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
