import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { WizardData } from "./types";
import { Bot, Globe, Palette, MessageCircle, Send, Terminal, CheckCircle2, AlertCircle } from "lucide-react";

interface Props {
  data: WizardData;
  confirmed: boolean;
  onConfirmChange: (v: boolean) => void;
}

const CHECKLIST = [
  "Bot name reviewed",
  "Bot avatar uploaded or confirmed optional",
  "Welcome message reviewed",
  "Telegram description reviewed",
  "Telegram commands reviewed",
  "Bot token provided",
  "Telegram preview reviewed",
];

export function StepReviewDeploy({ data, confirmed, onConfirmChange }: Props) {
  const checks = [
    { label: "Bot name", ok: !!data.bot_name.trim() },
    { label: "Short description", ok: !!data.short_description.trim() },
    { label: "Welcome message", ok: !!data.welcome_message.trim() },
    { label: "Bot token", ok: !!data.telegram_bot_token.trim() },
    { label: "Display name", ok: !!(data.telegram_display_name || data.bot_name).trim() },
  ];

  const allOk = checks.every((c) => c.ok);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-foreground">Review & Deploy</h2>
        <p className="text-sm text-muted-foreground">Review everything before deploying your bot.</p>
      </div>

      {/* Identity Summary */}
      <Card className="p-4 space-y-2 bg-muted/30">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /> Identity</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <span className="text-muted-foreground">Name</span><span className="text-foreground font-medium">{data.bot_name || "—"}</span>
          <span className="text-muted-foreground">Language</span><span className="text-foreground">{data.default_language}</span>
          <span className="text-muted-foreground">Tone</span><span className="text-foreground">{data.tone}</span>
          <span className="text-muted-foreground">Style</span><span className="text-foreground">{data.response_style}</span>
        </div>
      </Card>

      {/* Telegram Summary */}
      <Card className="p-4 space-y-2 bg-muted/30">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Send className="h-4 w-4 text-primary" /> Telegram</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <span className="text-muted-foreground">Display Name</span><span className="text-foreground font-medium">{data.telegram_display_name || data.bot_name || "—"}</span>
          <span className="text-muted-foreground">Description</span><span className="text-foreground truncate">{data.telegram_short_description || data.short_description || "—"}</span>
          <span className="text-muted-foreground">Commands</span><span className="text-foreground">{data.telegram_commands.length} commands</span>
        </div>
      </Card>

      {/* Checklist */}
      <Card className="p-4 space-y-2 bg-muted/30">
        <h3 className="text-sm font-semibold text-foreground">Deployment Checklist</h3>
        <div className="space-y-1.5">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-2 text-sm">
              {c.ok ? (
                <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              )}
              <span className={c.ok ? "text-foreground" : "text-destructive"}>{c.label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Confirmation */}
      <div className="flex items-start gap-3 rounded-lg border border-border p-4 bg-background/50">
        <Checkbox
          id="confirm"
          checked={confirmed}
          onCheckedChange={(v) => onConfirmChange(!!v)}
          disabled={!allOk}
        />
        <label htmlFor="confirm" className="text-sm leading-relaxed cursor-pointer text-foreground">
          I reviewed the bot identity, Telegram settings, and preview before deployment.
        </label>
      </div>

      {!allOk && (
        <p className="text-xs text-destructive text-center">Please fill in all required fields before deploying.</p>
      )}
    </div>
  );
}
