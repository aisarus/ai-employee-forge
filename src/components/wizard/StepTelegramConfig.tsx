import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WizardData, BotCommand } from "./types";
import { Plus, X, Key, Send, Terminal, ExternalLink } from "lucide-react";

interface Props {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
}

export function StepTelegramConfig({ data, onChange }: Props) {
  const [newCmd, setNewCmd] = useState("");
  const [newCmdDesc, setNewCmdDesc] = useState("");

  const addCommand = () => {
    if (!newCmd.trim()) return;
    const cmd = newCmd.startsWith("/") ? newCmd.trim() : `/${newCmd.trim()}`;
    onChange({
      telegram_commands: [...data.telegram_commands, { command: cmd, description: newCmdDesc.trim() || cmd }],
    });
    setNewCmd("");
    setNewCmdDesc("");
  };

  const removeCommand = (idx: number) => {
    onChange({ telegram_commands: data.telegram_commands.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-foreground">Telegram Configuration</h2>
        <p className="text-sm text-muted-foreground">Connect your bot to Telegram and configure its settings.</p>
      </div>

      {/* BotFather instructions */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2"><Send className="h-4 w-4 text-primary" /> Get your bot token</p>
        <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Open Telegram and search for <a href="https://t.me/BotFather" target="_blank" rel="noopener" className="text-primary underline">@BotFather</a></li>
          <li>Send <code className="text-xs bg-muted px-1 py-0.5 rounded">/newbot</code> and follow the instructions</li>
          <li>Copy the API token and paste it below</li>
        </ol>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5 text-sm"><Key className="h-3.5 w-3.5" /> Bot Token *</Label>
        <Input
          type="password"
          value={data.telegram_bot_token}
          onChange={(e) => onChange({ telegram_bot_token: e.target.value })}
          placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v..."
          className="bg-background/50 font-mono text-xs"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-sm">Display Name *</Label>
          <Input
            value={data.telegram_display_name}
            onChange={(e) => onChange({ telegram_display_name: e.target.value })}
            placeholder={data.bot_name || "Bot display name"}
            className="bg-background/50"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm">Webhook Mode</Label>
          <Select value={data.webhook_mode} onValueChange={(v) => onChange({ webhook_mode: v })}>
            <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Auto-generate webhook URL">Auto-generate</SelectItem>
              <SelectItem value="Use custom webhook URL">Custom URL</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {data.webhook_mode === "Use custom webhook URL" && (
        <div className="space-y-2">
          <Label className="text-sm">Custom Webhook URL</Label>
          <Input
            value={data.custom_webhook_url}
            onChange={(e) => onChange({ custom_webhook_url: e.target.value })}
            placeholder="https://your-domain.com/webhook"
            className="bg-background/50 font-mono text-xs"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-sm">Telegram Description</Label>
        <Textarea
          value={data.telegram_short_description}
          onChange={(e) => onChange({ telegram_short_description: e.target.value })}
          placeholder={data.short_description || "Description shown in Telegram"}
          rows={2}
          className="bg-background/50 resize-none"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Telegram About Text</Label>
        <Textarea
          value={data.telegram_about_text}
          onChange={(e) => onChange({ telegram_about_text: e.target.value })}
          placeholder={data.about_text || "About text in bot profile"}
          rows={2}
          className="bg-background/50 resize-none"
        />
      </div>

      {/* Commands */}
      <div className="space-y-3">
        <Label className="flex items-center gap-1.5 text-sm"><Terminal className="h-3.5 w-3.5" /> Bot Commands</Label>
        <div className="space-y-2">
          {data.telegram_commands.map((cmd, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <code className="text-xs font-mono text-primary shrink-0">{cmd.command}</code>
              <span className="text-xs text-muted-foreground flex-1 truncate">— {cmd.description}</span>
              <button onClick={() => removeCommand(i)} className="text-muted-foreground hover:text-destructive shrink-0">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newCmd}
            onChange={(e) => setNewCmd(e.target.value)}
            placeholder="/command"
            className="bg-background/50 font-mono text-xs w-32 shrink-0"
          />
          <Input
            value={newCmdDesc}
            onChange={(e) => setNewCmdDesc(e.target.value)}
            placeholder="Description"
            className="bg-background/50 text-xs flex-1"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCommand())}
          />
          <Button variant="outline" size="sm" onClick={addCommand} className="shrink-0 gap-1">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
