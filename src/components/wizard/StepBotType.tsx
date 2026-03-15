import { WizardData, BOT_TYPES } from "./types";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/utils";

interface Props {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
}

export function StepBotType({ data, onChange }: Props) {
  const { t } = useI18n();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-1.5">
        <h2 className="text-xl font-bold text-foreground">{t("wizard.bot_type_title")}</h2>
        <p className="text-sm text-muted-foreground">{t("wizard.bot_type_desc")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {BOT_TYPES.map((bt, i) => {
          const selected = data.bot_type === bt.id;
          return (
            <button
              key={bt.id}
              onClick={() => onChange({ bot_type: bt.id })}
              className={cn(
                "flex flex-col items-center gap-2 rounded-2xl border-2 p-5 text-center transition-all duration-200 hover:border-primary/40 hover:bg-primary/5 hover:scale-[1.03]",
                selected
                  ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)),0_0_20px_hsl(var(--primary)/0.3)]"
                  : "border-border bg-card/50"
              )}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <span className="text-4xl">{bt.icon}</span>
              <span className={cn("text-sm font-semibold", selected ? "text-primary" : "text-foreground")}>
                {t(`bottype.${bt.id}` as any)}
              </span>
              <span className="text-xs text-muted-foreground leading-tight">
                {t(`bottype.${bt.id}_desc` as any)}
              </span>
            </button>
          );
        })}
      </div>

      {data.bot_type && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
          {t("wizard.bot_type_selected_hint")}
        </div>
      )}
    </div>
  );
}
