import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { MessageSquare, Send, Instagram, Globe, Webhook, Settings, ExternalLink } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";

const Integrations = () => {
  const { t } = useI18n();

  const INITIAL_INTEGRATIONS = [
    { id: "telegram", name: "Telegram", descKey: "integrations.telegram_desc" as const, icon: Send, connected: false, agents: 0 },
    { id: "whatsapp", name: "WhatsApp", descKey: "integrations.whatsapp_desc" as const, icon: MessageSquare, connected: false, agents: 0 },
    { id: "instagram", name: "Instagram DMs", descKey: "integrations.instagram_desc" as const, icon: Instagram, connected: false, agents: 0 },
    { id: "web", name: "Web Widget", descKey: "integrations.web_desc" as const, icon: Globe, connected: false, agents: 0 },
    { id: "webhook", name: "Custom Webhook", descKey: "integrations.webhook_desc" as const, icon: Webhook, connected: false, agents: 0 },
  ];

  const [integrations, setIntegrations] = useState(INITIAL_INTEGRATIONS);

  const toggle = (id: string) => {
    setIntegrations((prev) =>
      prev.map((i) => (i.id === id ? { ...i, connected: !i.connected } : i))
    );
  };

  return (
    <div className="flex-1 p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("integrations.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("integrations.subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map((int) => (
          <Card key={int.id} className="glass-strong hover:border-primary/30 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <int.icon className="h-5 w-5 text-primary" />
                </div>
                <Switch checked={int.connected} onCheckedChange={() => toggle(int.id)} />
              </div>
              <CardTitle className="text-sm font-semibold mt-3">{int.name}</CardTitle>
              <CardDescription className="text-xs">{t(int.descKey)}</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className={`text-xs ${int.connected ? "bg-success/15 text-success border-success/20" : ""}`}>
                  {int.connected ? t("integrations.connected") : t("integrations.disconnected")}
                </Badge>
                {int.connected ? (
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5">
                    <Settings className="h-3 w-3" /> {t("integrations.configure")}
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5">
                    <ExternalLink className="h-3 w-3" /> {t("integrations.setup")}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Integrations;
