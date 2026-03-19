import { WizardData } from "./types";
import { Send, MoreVertical, ArrowLeft, Phone, Search } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "🤖";
}

interface MockupProps {
  data: WizardData;
}

export function TelegramProfileMockup({ data }: MockupProps) {
  const { t } = useI18n();
  const name = data.telegram_display_name || data.bot_name || "Bot";
  const desc = data.telegram_short_description || data.short_description || "";
  const about = data.telegram_about_text || data.about_text || "";

  return (
    <div className="rounded-xl overflow-hidden border border-border shadow-lg max-w-[320px] mx-auto bg-background">
      <div className="bg-[hsl(200,80%,45%)] text-[hsl(0,0%,100%)] p-4 pb-12 text-center relative">
        <div className="flex items-center gap-2 mb-6">
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm font-medium flex-1">{t("wizard.info")}</span>
          <MoreVertical className="h-5 w-5" />
        </div>
        <div className="relative inline-flex mx-auto">
          <span className="avatar-pulse-ring" style={{ animationDelay: "0s" }} />
          <span className="avatar-pulse-ring" style={{ animationDelay: "0.7s" }} />
          <span className="avatar-pulse-ring" style={{ animationDelay: "1.4s" }} />
          <div className="h-20 w-20 rounded-full border-2 border-[hsl(0,0%,100%)]/30 overflow-hidden bg-[hsl(200,80%,55%)] flex items-center justify-center text-2xl font-bold relative z-10">
            {data.bot_avatar_url ? (
              <img src={data.bot_avatar_url} className="h-full w-full object-cover" alt="" />
            ) : (
              getInitials(name)
            )}
          </div>
        </div>
        <p className="font-semibold mt-2 text-base">{name}</p>
        <p className="text-xs opacity-80">bot</p>
      </div>

      <div className="p-4 space-y-3 -mt-4 bg-background rounded-t-xl relative z-10">
        {about && (
          <div>
            <p className="text-[11px] text-primary font-medium uppercase tracking-wide">{t("wizard.bio")}</p>
            <p className="text-sm text-foreground mt-0.5">{about}</p>
          </div>
        )}
        {desc && (
          <div>
            <p className="text-[11px] text-primary font-medium uppercase tracking-wide">{t("wizard.description_label")}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
          </div>
        )}
        {data.bot_username_hint && (
          <div>
            <p className="text-[11px] text-primary font-medium uppercase tracking-wide">{t("wizard.username_label")}</p>
            <p className="text-sm text-primary mt-0.5">@{data.bot_username_hint}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function TelegramChatMockup({ data }: MockupProps) {
  const { t } = useI18n();
  const name = data.telegram_display_name || data.bot_name || "Bot";

  return (
    <div className="rounded-xl overflow-hidden border border-border shadow-lg max-w-[320px] mx-auto bg-background flex flex-col" style={{ height: 420 }}>
      <div className="bg-[hsl(200,80%,45%)] text-[hsl(0,0%,100%)] px-3 py-2.5 flex items-center gap-3">
        <ArrowLeft className="h-5 w-5 shrink-0" />
        <div className="relative inline-flex shrink-0">
          <span className="avatar-pulse-ring" style={{ animationDelay: "0s" }} />
          <span className="avatar-pulse-ring" style={{ animationDelay: "0.7s" }} />
          <span className="avatar-pulse-ring" style={{ animationDelay: "1.4s" }} />
          <div className="h-9 w-9 rounded-full overflow-hidden bg-[hsl(200,80%,55%)] flex items-center justify-center text-sm font-bold relative z-10">
            {data.bot_avatar_url ? (
              <img src={data.bot_avatar_url} className="h-full w-full object-cover" alt="" />
            ) : (
              getInitials(name)
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{name}</p>
          <p className="text-[11px] opacity-70">bot</p>
        </div>
        <Phone className="h-4 w-4 opacity-70" />
        <Search className="h-4 w-4 opacity-70" />
      </div>

      <div className="flex-1 p-3 space-y-2 overflow-auto" style={{ background: "hsl(var(--muted))" }}>
        {data.welcome_message && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-xl rounded-bl-sm bg-background px-3 py-2 shadow-sm border border-border">
              <p className="text-sm text-foreground whitespace-pre-line">{data.welcome_message}</p>
              <p className="text-[10px] text-muted-foreground text-right mt-1">12:00</p>
            </div>
          </div>
        )}

        {data.starter_buttons.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-center pt-1">
            {data.starter_buttons.map((btn, i) => (
              <div key={i} className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                {btn.text}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-2 py-2 bg-background border-t border-border flex items-center gap-2">
        <div className="flex-1 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground">{t("wizard.message_placeholder")}</div>
        <div className="h-8 w-8 rounded-full bg-[hsl(200,80%,45%)] flex items-center justify-center">
          <Send className="h-3.5 w-3.5 text-[hsl(0,0%,100%)]" />
        </div>
      </div>
    </div>
  );
}

export function TelegramStartMockup({ data }: MockupProps) {
  const name = data.telegram_display_name || data.bot_name || "Bot";
  const desc = data.telegram_short_description || data.short_description || "";

  return (
    <div className="rounded-xl overflow-hidden border border-border shadow-lg max-w-[320px] mx-auto bg-background flex flex-col" style={{ height: 380 }}>
      <div className="bg-[hsl(200,80%,45%)] text-[hsl(0,0%,100%)] px-3 py-2.5 flex items-center gap-3">
        <ArrowLeft className="h-5 w-5" />
        <p className="text-sm font-semibold flex-1">{name}</p>
        <MoreVertical className="h-5 w-5" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center" style={{ background: "hsl(var(--muted))" }}>
        <div className="relative inline-flex mb-3">
          <span className="avatar-pulse-ring" style={{ animationDelay: "0s" }} />
          <span className="avatar-pulse-ring" style={{ animationDelay: "0.7s" }} />
          <span className="avatar-pulse-ring" style={{ animationDelay: "1.4s" }} />
          <div className="h-20 w-20 rounded-full overflow-hidden bg-[hsl(200,80%,55%)] flex items-center justify-center text-2xl font-bold text-[hsl(0,0%,100%)] relative z-10">
            {data.bot_avatar_url ? (
              <img src={data.bot_avatar_url} className="h-full w-full object-cover" alt="" />
            ) : (
              getInitials(name)
            )}
          </div>
        </div>
        <p className="font-semibold text-foreground text-base">{name}</p>
        {desc && <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">{desc}</p>}
        <button className="mt-4 rounded-full bg-[hsl(200,80%,45%)] text-[hsl(0,0%,100%)] px-6 py-2 text-sm font-medium">
          START
        </button>
      </div>
    </div>
  );
}
