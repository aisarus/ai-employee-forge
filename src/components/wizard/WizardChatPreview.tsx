import { useEffect, useState } from "react";
import { ArrowLeft, Phone, Search, Send } from "lucide-react";

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "🤖";
}

interface WizardChatPreviewProps {
  botName: string;
  botDescription: string;
  lang: "ru" | "en";
}

export function WizardChatPreview({ botName, botDescription, lang }: WizardChatPreviewProps) {
  const name = botName || (lang === "ru" ? "Ваш бот" : "Your bot");
  const [phase, setPhase] = useState<"typing" | "message">("typing");

  const greeting = lang === "ru"
    ? `Привет! Я ${name} — готов помочь 👋`
    : `Hi there! I'm ${name} — ready to assist! 👋`;

  // Re-animate when bot name changes
  useEffect(() => {
    setPhase("typing");
    const t = setTimeout(() => setPhase("message"), 1500);
    return () => clearTimeout(t);
  }, [botName]);

  return (
    <div className="flex flex-col w-full max-w-[290px]">
      {/* Label */}
      <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest mb-3 text-center">
        {lang === "ru" ? "Превью чата" : "Chat Preview"}
      </p>

      {/* Telegram-style chat */}
      <div className="flex flex-col rounded-2xl overflow-hidden border border-border shadow-xl" style={{ height: 400 }}>
        {/* Header */}
        <div className="bg-[hsl(200,80%,45%)] text-white px-3 py-2.5 flex items-center gap-2.5 shrink-0">
          <ArrowLeft className="h-4 w-4 shrink-0 opacity-70" />
          <div className="relative inline-flex shrink-0">
            <span className="avatar-pulse-ring" style={{ animationDelay: "0s" }} />
            <span className="avatar-pulse-ring" style={{ animationDelay: "0.7s" }} />
            <span className="avatar-pulse-ring" style={{ animationDelay: "1.4s" }} />
            <div className="h-9 w-9 rounded-full bg-[hsl(200,80%,55%)] flex items-center justify-center text-sm font-bold relative z-10 select-none">
              {getInitials(name)}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate leading-tight">{name}</p>
            <p className="text-[10px] opacity-60">bot</p>
          </div>
          <Phone className="h-4 w-4 opacity-50 shrink-0" />
          <Search className="h-4 w-4 opacity-50 shrink-0" />
        </div>

        {/* Chat area */}
        <div className="flex-1 p-3 overflow-hidden flex flex-col gap-2" style={{ background: "hsl(var(--muted))" }}>
          {/* Date separator */}
          <div className="flex justify-center">
            <span className="text-[10px] text-muted-foreground bg-background/60 px-2 py-0.5 rounded-full">
              {lang === "ru" ? "Сегодня" : "Today"}
            </span>
          </div>

          {/* Typing indicator or greeting bubble */}
          <div className="flex justify-start">
            {phase === "typing" ? (
              <div className="rounded-2xl rounded-bl-sm bg-background px-3 py-2 shadow-sm border border-border/60 animate-in fade-in duration-200">
                <div className="flex gap-1 items-center" style={{ height: 16 }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "200ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "400ms" }} />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl rounded-bl-sm bg-background px-3 py-2 shadow-sm border border-border/60 max-w-[85%] animate-in fade-in slide-in-from-bottom-2 duration-400">
                <p className="text-sm text-foreground leading-snug">{greeting}</p>
                <p className="text-[10px] text-muted-foreground text-right mt-1">
                  {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Input bar */}
        <div className="px-2 py-2 bg-background border-t border-border/50 flex items-center gap-2 shrink-0">
          <div className="flex-1 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground select-none">
            {lang === "ru" ? "Написать сообщение..." : "Write a message..."}
          </div>
          <div className="h-8 w-8 rounded-full bg-[hsl(200,80%,45%)] flex items-center justify-center shrink-0">
            <Send className="h-3.5 w-3.5 text-white" />
          </div>
        </div>
      </div>
    </div>
  );
}
