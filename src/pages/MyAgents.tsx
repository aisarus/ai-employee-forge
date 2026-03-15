import { useState, useEffect } from "react";
import { Bot, MoreVertical, Power, Pencil, Trash2, Plus, Search, MessageSquare, Zap, Send } from "lucide-react";
import { BOT_TYPES } from "@/components/wizard/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

const statusColor: Record<string, string> = {
  active: "bg-success/15 text-success border-success/20",
  paused: "bg-warning/15 text-warning border-warning/20",
  draft: "bg-muted text-muted-foreground border-border",
};

const MyAgents = () => {
  const [search, setSearch] = useState("");
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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

  const filtered = agents.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()));

  const getStatusKey = (agent: any) => agent.is_active ? "active" : "draft";

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
                  <DropdownMenuItem><Pencil className="mr-2 h-4 w-4" />{t("agents.edit")}</DropdownMenuItem>
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
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 mb-4">
              <Bot className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">{t("agents.no_agents")}</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">{t("agents.no_agents_desc")}</p>
            <Button className="mt-4 gap-2 btn-gradient text-primary-foreground border-0" size="sm" onClick={() => navigate("/")}>
              <Plus className="h-4 w-4 relative z-10" /> <span className="relative z-10">{t("agents.create")}</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyAgents;
