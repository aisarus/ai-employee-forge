import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, CreditCard, Download, Zap, ArrowUpRight } from "lucide-react";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "/mo",
    features: ["1 Agent", "100 messages/mo", "Telegram only", "Community support"],
    current: false,
    cta: "Downgrade",
  },
  {
    name: "Pro",
    price: "$29",
    period: "/mo",
    features: ["Unlimited Agents", "10,000 messages/mo", "All platforms", "Priority support", "Custom branding"],
    current: true,
    cta: "Current Plan",
  },
  {
    name: "Enterprise",
    price: "$99",
    period: "/mo",
    features: ["Everything in Pro", "100,000 messages/mo", "Custom integrations", "Dedicated account manager", "SLA guarantee"],
    current: false,
    cta: "Upgrade",
  },
];

const INVOICES = [
  { id: "INV-0042", date: "Mar 1, 2026", amount: "$29.00", status: "Paid" },
  { id: "INV-0041", date: "Feb 1, 2026", amount: "$29.00", status: "Paid" },
  { id: "INV-0040", date: "Jan 1, 2026", amount: "$29.00", status: "Paid" },
];

const Billing = () => {
  const [usage] = useState({ messages: 4827, limit: 10000 });

  return (
    <div className="flex-1 p-6 space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Billing</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your subscription, usage, and invoices.</p>
      </div>

      {/* Usage */}
      <Card className="glass-strong">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Current Usage</CardTitle>
          <CardDescription className="text-xs">Billing cycle: Mar 1 – Mar 31, 2026</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Messages</span>
            <span className="font-medium text-foreground">{usage.messages.toLocaleString()} / {usage.limit.toLocaleString()}</span>
          </div>
          <Progress value={(usage.messages / usage.limit) * 100} className="h-2" />
          <p className="text-xs text-muted-foreground">{Math.round((usage.messages / usage.limit) * 100)}% of your monthly quota used</p>
        </CardContent>
      </Card>

      {/* Plans */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Plans</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <Card key={plan.name} className={`glass-strong transition-colors ${plan.current ? "border-primary/50 ring-1 ring-primary/20" : "hover:border-primary/30"}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">{plan.name}</CardTitle>
                  {plan.current && <Badge className="bg-primary/15 text-primary border-primary/20 text-xs">Active</Badge>}
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

      {/* Payment Method */}
      <Card className="glass-strong">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Payment Method</CardTitle>
            <Button variant="ghost" size="sm" className="h-7 text-xs">Update</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-14 items-center justify-center rounded-md bg-accent">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">•••• •••• •••• 4242</p>
              <p className="text-xs text-muted-foreground">Expires 12/2027</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card className="glass-strong">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Invoice History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {INVOICES.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-mono text-foreground">{inv.id}</span>
                  <span className="text-xs text-muted-foreground hidden sm:inline">{inv.date}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-foreground">{inv.amount}</span>
                  <Badge variant="outline" className="bg-success/15 text-success border-success/20 text-xs">{inv.status}</Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Billing;
