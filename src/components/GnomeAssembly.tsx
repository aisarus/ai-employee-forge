import { useEffect, useState } from "react";
import { Bot, Hammer, Wrench, Settings, Flower, Leaf, TreePine } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";

export function GnomeAssembly() {
  const { t } = useI18n();
  const [textIndex, setTextIndex] = useState(0);

  const loadingTexts = [
    t("loading.gnome1"),
    t("loading.gnome2"),
    t("loading.gnome3"),
    t("loading.gnome4"),
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setTextIndex((i) => (i + 1) % loadingTexts.length);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
      <div className="relative h-48 w-48 mb-8">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl animate-pulse" style={{ width: 120, height: 120, left: -20, top: -20 }} />
            <Bot className="h-20 w-20 text-primary animate-bot-build" />
          </div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-orbit-1">
            <div className="flex flex-col items-center gap-0.5">
              <Hammer className="h-5 w-5 text-amber-400 animate-hammer" />
            </div>
          </div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-orbit-2">
            <Wrench className="h-5 w-5 text-sky-400 animate-hammer" style={{ animationDelay: "0.15s" }} />
          </div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-orbit-3">
            <Settings className="h-5 w-5 text-emerald-400 animate-hammer" style={{ animationDelay: "0.3s" }} />
          </div>
        </div>

        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="absolute animate-float-up"
            style={{
              left: `${20 + i * 25}%`,
              top: `${60 + (i % 3) * 10}%`,
              animationDelay: `${i * 0.6}s`,
            }}
          >
            {i % 3 === 0 ? (
              <Flower className="h-4 w-4 text-pink-400/70" />
            ) : i % 3 === 1 ? (
              <Leaf className="h-4 w-4 text-emerald-400/70" />
            ) : (
              <TreePine className="h-3 w-3 text-green-400/70" />
            )}
          </div>
        ))}
      </div>

      <div className="h-6 text-center">
        <p className="text-sm text-muted-foreground transition-opacity duration-300">
          {loadingTexts[textIndex]}
        </p>
      </div>

      <div className="mt-6 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"
            style={{ animationDelay: `${i * 0.3}s` }}
          />
        ))}
      </div>
    </div>
  );
}
