import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, Zap, ArrowUpRight } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";

const Billing = () => {
  const { t } = useI18n();
  const [usage] = useState({ messages: 0, limit: 10000 });

  const PLANS = [
    {
      name: "Free",
      price: "$0",
      period: "/mo",
      features: [
        `1 ${t("billing.agent")}`,
        `100 ${t("billing.messages_mo")}`,
        t("billing.telegram_only"),
        t("billing.community_support"),
      ],
      current: false,
      cta: t("billing.downgrade"),
    },
    {
      name: "Pro",
      price: "$29",
      period: "/mo",
      features: [
        t("billing.unlimited_agents"),
        `10,000 ${t("billing.messages_mo")}`,
        t("billing.all_platforms"),
        t("billing.priority_support"),
        t("billing.custom_branding"),
      ],
      current: true,
      cta: t("billing.current_plan"),
    },
    {
      name: "Enterprise",
      price: "$99",
      period: "/mo",
      features: [
        t("billing.everything_pro"),
        `100,000 ${t("billing.messages_mo")}`,
        t("billing.custom_integrations"),
        t("billing.dedicated_manager"),
        t("billing.sla"),
      ],
      current: false,
      cta: t("billing.upgrade"),
    },
  ];

  return (
    <div className="flex-1 p-6 space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("billing.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("billing.subtitle")}</p>
      </div>

      <Card className="glass-strong">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{t("billing.current_usage")}</CardTitle>
          <CardDescription className="text-xs">{t("billing.billing_cycle")}: Mar 1 – Mar 31, 2026</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("billing.messages")}</span>
            <span className="font-medium text-foreground">{usage.messages.toLocaleString()} / {usage.limit.toLocaleString()}</span>
          </div>
          <Progress value={(usage.messages / usage.limit) * 100} className="h-2" />
          <p className="text-xs text-muted-foreground">{usage.messages === 0 ? t("billing.no_messages") : `${Math.round((usage.messages / usage.limit) * 100)}% ${t("billing.quota_used")}`}</p>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">{t("billing.plans")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <Card key={plan.name} className={`glass-strong transition-colors ${plan.current ? "border-primary/50 ring-1 ring-primary/20" : "hover:border-primary/30"}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">{plan.name}</CardTitle>
                  {plan.current && <Badge className="bg-primary/15 text-primary border-primary/20 text-xs">{t("billing.active")}</Badge>}
                </div>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-success shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={plan.current ? "outline" : plan.name === "Enterprise" ? "default" : "secondary"}
                  className="w-full gap-2"
                  disabled={plan.current}
                >
                  {plan.name === "Enterprise" && <Zap className="h-4 w-4" />}
                  {plan.cta}
                  {plan.name === "Enterprise" && <ArrowUpRight className="h-3.5 w-3.5" />}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card className="glass-strong">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">{t("billing.payment_method")}</CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs">{t("billing.add_card")}</Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("billing.no_payment")}</p>
        </CardContent>
      </Card>

      <Card className="glass-strong">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{t("billing.invoices")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("billing.no_invoices")}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Billing;
