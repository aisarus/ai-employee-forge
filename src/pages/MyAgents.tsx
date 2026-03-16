import { useState, useEffect } from "react";
import { Bot, MoreVertical, Power, Pencil, Trash2, Plus, Search, MessageSquare, Zap, Send } from "lucide-react";
import { BOT_TYPES } from "@/components/wizard/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useI18n } from "@/hooks/useI18n";
import { DeployWizard } from "@/components/DeployWizard";
import { decryptKey } from "@/lib/crypto";

const statusColor: Record<string, string> = {
  active: "bg-success/15 text-success border-success/20",
  paused: "bg-warning/15 text-warning border-warning/20",
  draft: "bg-muted text-muted-foreground border-border",
};

const MyAgents = () => {
  const [search, setSearch] = useState("");
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editAgent, setEditAgent] = useState<any | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useI18n();

  const fetchAgents = async () => {
    const { data, error } = await supabase
      .from("agents")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(t("agents.load_failed"));
    } else {
      setAgents(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const toggleAgent = async (id: string, currentActive: boolean) => {
    const { error } = await supabase
      .from("agents")
      .update({ is_active: !currentActive })
      .eq("id", id);
    if (error) toast.error(t("agents.update_failed"));
    else fetchAgents();
  };

  const deleteAgent = async (id: string) => {
    const { error } = await supabase.from("agents").delete().eq("id", id);
    if (error) toast.error(t("agents.delete_failed"));
    else {
      toast.success(t("agents.deleted"));
      fetchAgents();
    }
  };

  const openEdit = async (agent: any) => {
    // S1: Decrypt openai_api_key from DB before passing to wizard
    let openaiKey = agent.openai_api_key || "";
    if (openaiKey) {
      try {
        openaiKey = await decryptKey(openaiKey);
      } catch {
        // Legacy plaintext row — use as-is
      }
    }
    setEditAgent({ ...agent, openai_api_key: openaiKey });
    setWizardOpen(true);
  };

  const filtered = agents.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()));

  const getStatusKey = (agent: any) => agent.is_active ? "active" : "draft";

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 p-6 space-y-6 animate-fade-in">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card/40">
              <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-6 w-16 hidden sm:block" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Empty state (zero bots) ─────────────────────────────────────────────────
  if (agents.length === 0) {
    return (
      <div className="flex-1 p-6 animate-fade-in">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("agents.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("agents.subtitle")}</p>
          </div>
          <Button className="gap-2 shrink-0 btn-gradient text-primary-foreground border-0" onClick={() => navigate("/")}>
            <Plus className="h-4 w-4 relative z-10" /> <span className="relative z-10">{t("agents.create_new")}</span>
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-3xl bg-primary/20 blur-2xl scale-150" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 border border-primary/20">
              <Bot className="h-10 w-10 text-primary" />
            </div>
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">{t("agents.no_agents")}</h2>
          <p className="text-sm text-muted-foreground max-w-xs mb-6">{t("agents.no_agents_desc")}</p>
          <Button className="gap-2 btn-gradient text-primary-foreground border-0" onClick={() => navigate("/")}>
            <Plus className="h-4 w-4 relative z-10" />
            <span className="relative z-10">{t("agents.create")}</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("agents.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("agents.subtitle")}</p>
        </div>
        <Button className="gap-2 shrink-0 btn-gradient text-primary-foreground border-0" onClick={() => navigate("/")}>
          <Plus className="h-4 w-4 relative z-10" /> <span className="relative z-10">{t("agents.create_new")}</span>
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("agents.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card/50"
        />
      </div>

      <div className="grid gap-3">
        {filtered.map((agent) => {
          const status = getStatusKey(agent);
          const botTypeDef = BOT_TYPES.find((bt) => bt.id === agent.bot_type);
          return (
            <div
              key={agent.id}
              className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card/40 transition-all duration-150 hover:border-border hover:bg-card/70 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/40"
            >
              {/* Avatar / icon */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 overflow-hidden">
                {agent.bot_avatar_url
                  ? <img src={agent.bot_avatar_url} alt="" className="h-10 w-10 object-cover" />
                  : <Bot className="h-5 w-5 text-primary" />}
              </div>

              {/* Name + description + badges row */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground truncate">{agent.name}</p>
                  {botTypeDef && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-primary/15 border border-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary shrink-0">
                      {botTypeDef.icon} {t(`bottype.${botTypeDef.id}` as any)}
                    </span>
                  )}
                  {agent.platform === "telegram" && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/15 border border-sky-500/20 px-1.5 py-0.5 text-[10px] font-medium text-sky-300 shrink-0">
                      <Send className="h-2.5 w-2.5" /> Telegram
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{agent.description}</p>
              </div>

              {/* Active indicator */}
              {status === "active" && (
                <div className="hidden sm:block w-2 h-2 rounded-full bg-success animate-pulse shadow-[0_0_6px_hsl(var(--success))]" />
              )}

              <Badge variant="outline" className={`${statusColor[status]} text-xs hidden sm:inline-flex`}>
                {t(`status.${status}` as any)}
              </Badge>

              <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                {(agent.messages_count || 0).toLocaleString()}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEdit(agent)}>
                    <Pencil className="mr-2 h-4 w-4" />{t("agents.edit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem><Zap className="mr-2 h-4 w-4" />{t("agents.test")}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toggleAgent(agent.id, agent.is_active)}>
                    <Power className="mr-2 h-4 w-4" />{agent.is_active ? t("agents.pause") : t("agents.activate")}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => deleteAgent(agent.id)}>
                    <Trash2 className="mr-2 h-4 w-4" />{t("agents.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}

        {/* Search returned no results */}
        {filtered.length === 0 && search && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">{t("agents.no_results")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("agents.no_results_desc")}</p>
          </div>
        )}
      </div>

      {/* Edit wizard dialog */}
      {editAgent && (
        <DeployWizard
          open={wizardOpen}
          onOpenChange={(open) => {
            setWizardOpen(open);
            if (!open) { setEditAgent(null); fetchAgents(); }
          }}
          agentId={editAgent.id}
          systemPrompt={editAgent.system_prompt || ""}
          initialData={{
            bot_name:                   editAgent.name                       || "",
            short_description:          editAgent.description                || "",
            about_text:                 editAgent.about_text                 || "",
            bot_type:                   editAgent.bot_type                   || "",
            tone:                       editAgent.tone                       || "Friendly",
            response_style:             editAgent.response_style             || "Concise",
            default_language:           editAgent.default_language           || "English",
            welcome_message:            editAgent.welcome_message            || "",
            fallback_message:           editAgent.fallback_message           || "",
            bot_avatar_url:             editAgent.bot_avatar_url             || "",
            openai_api_key:             editAgent.openai_api_key             || "",
            telegram_display_name:      editAgent.telegram_display_name      || "",
            telegram_short_description: editAgent.telegram_short_description || "",
            telegram_about_text:        editAgent.telegram_about_text        || "",
            telegram_commands:          editAgent.telegram_commands          || [],
            bot_actions:    (editAgent.structured_prompt as any)?.bot_actions    || [],
            data_fields:    (editAgent.structured_prompt as any)?.data_fields    || [],
            workflow_steps: (editAgent.structured_prompt as any)?.workflow_steps || [],
            logic_rules:    (editAgent.structured_prompt as any)?.logic_rules    || [],
            external_actions:   (editAgent.structured_prompt as any)?.external_actions   || [],
            data_sources:       (editAgent.structured_prompt as any)?.data_sources       || [],
            field_mappings:     (editAgent.structured_prompt as any)?.field_mappings     || [],
            action_triggers:    (editAgent.structured_prompt as any)?.action_triggers    || [],
            integration_rules:  (editAgent.structured_prompt as any)?.integration_rules  || [],
          }}
        />
      )}
    </div>
  );
};

export default MyAgents;
