import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WizardData, BotCommand } from "./types";
import { Plus, X, Key, Send, Terminal, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";

interface Props {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
}

type TokenState = "idle" | "checking" | "valid" | "invalid";

export function StepTelegramConfig({ data, onChange }: Props) {
  const { t } = useI18n();
  const [newCmd, setNewCmd] = useState("");
  const [newCmdDesc, setNewCmdDesc] = useState("");
  const [tokenState, setTokenState] = useState<TokenState>("idle");
  const [botUsername, setBotUsername] = useState("");
  const [tokenError, setTokenError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const token = data.telegram_bot_token.trim();
    if (!token) {
      setTokenState("idle");
      setBotUsername("");
      setTokenError("");
      return;
    }

    const looksValid = /^\d{8,12}:[A-Za-z0-9_-]{30,}$/.test(token);
    if (!looksValid) {
      setTokenState("invalid");
      setTokenError(t("wizard.tg_token_format_error"));
      setBotUsername("");
      return;
    }

    setTokenState("checking");
    setBotUsername("");
    setTokenError("");

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, { method: "POST" });
        const json = await res.json();
        if (json.ok && json.result?.username) {
          setTokenState("valid");
          setBotUsername(json.result.username);
          if (!data.telegram_display_name && !data.bot_name) {
            onChange({ telegram_display_name: json.result.first_name || "" });
          }
        } else {
          setTokenState("invalid");
          setTokenError(t("wizard.tg_token_invalid"));
          setBotUsername("");
        }
      } catch {
        setTokenState("invalid");
        setTokenError(t("wizard.tg_token_network_error"));
        setBotUsername("");
      }
    }, 700);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [data.telegram_bot_token]);

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
        <h2 className="text-xl font-bold text-foreground">{t("wizard.tg_config_title")}</h2>
        <p className="text-sm text-muted-foreground">{t("wizard.tg_config_desc")}</p>
      </div>

      {/* How to get token */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Send className="h-4 w-4 text-primary" /> {t("wizard.get_token")}
        </p>
        <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
          <li>
            {t("wizard.tg_step1")}{" "}
            <a href="https://t.me/BotFather" target="_blank" rel="noopener" className="text-primary underline">
              @BotFather
            </a>
          </li>
          <li>
            {t("wizard.tg_step2_send")}{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">/newbot</code>{" "}
            {t("wizard.tg_step2_follow")}
          </li>
          <li>{t("wizard.tg_step3")}</li>
        </ol>
      </div>

      {/* Token input */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5 text-sm">
          <Key className="h-3.5 w-3.5" /> {t("wizard.bot_token")} *
        </Label>
        <div className="relative">
          <Input
            type="password"
            value={data.telegram_bot_token}
            onChange={(e) => onChange({ telegram_bot_token: e.target.value })}
            placeholder="123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
            className={`bg-background/50 font-mono text-xs pr-10 ${
              tokenState === "valid"
                ? "border-success focus-visible:ring-success/30"
                : tokenState === "invalid"
                  ? "border-destructive focus-visible:ring-destructive/30"
                  : "focus:border-primary/50"
            }`}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {tokenState === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {tokenState === "valid"   && <CheckCircle2 className="h-4 w-4 text-success" />}
            {tokenState === "invalid" && <XCircle className="h-4 w-4 text-destructive" />}
          </div>
        </div>

        {tokenState === "valid" && botUsername && (
          <p className="text-xs text-success flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {t("wizard.tg_token_ok")} <span className="font-mono font-semibold">@{botUsername}</span>
          </p>
        )}
        {tokenState === "invalid" && tokenError && (
          <p className="text-xs text-destructive">{tokenError}</p>
        )}
      </div>

      {/* Display name + webhook */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-sm">{t("wizard.display_name")} *</Label>
          <Input
            value={data.telegram_display_name}
            onChange={(e) => onChange({ telegram_display_name: e.target.value })}
            placeholder={data.bot_name || "Bot display name"}
            className="bg-background/50"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm">{t("wizard.webhook_mode")}</Label>
          <Select value={data.webhook_mode} onValueChange={(v) => onChange({ webhook_mode: v })}>
            <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Auto-generate webhook URL">{t("wizard.webhook_auto")}</SelectItem>
              <SelectItem value="Use custom webhook URL">{t("wizard.webhook_custom")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {data.webhook_mode === "Use custom webhook URL" && (
        <div className="space-y-2">
          <Label className="text-sm">{t("wizard.custom_webhook_url")}</Label>
          <Input
            value={data.custom_webhook_url}
            onChange={(e) => onChange({ custom_webhook_url: e.target.value })}
            placeholder="https://your-domain.com/webhook"
            className="bg-background/50 font-mono text-xs"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-sm">{t("wizard.tg_description")}</Label>
        <Textarea
          value={data.telegram_short_description}
          onChange={(e) => onChange({ telegram_short_description: e.target.value })}
          placeholder={data.short_description || ""}
          rows={2}
          className="bg-background/50 resize-none"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm">{t("wizard.tg_about")}</Label>
        <Textarea
          value={data.telegram_about_text}
          onChange={(e) => onChange({ telegram_about_text: e.target.value })}
          placeholder={data.about_text || ""}
          rows={2}
          className="bg-background/50 resize-none"
        />
      </div>

      {/* Bot commands */}
      <div className="space-y-3">
        <Label className="flex items-center gap-1.5 text-sm">
          <Terminal className="h-3.5 w-3.5" /> {t("wizard.bot_commands")}
        </Label>
        <div className="space-y-2">
          {data.telegram_commands.map((cmd, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-card/30 px-3 py-2">
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
            placeholder={t("wizard.command_placeholder")}
            className="bg-background/50 font-mono text-xs w-32 shrink-0"
          />
          <Input
            value={newCmdDesc}
            onChange={(e) => setNewCmdDesc(e.target.value)}
            placeholder={t("wizard.command_desc_placeholder")}
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
