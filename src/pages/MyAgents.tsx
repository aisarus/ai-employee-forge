import { useState } from "react";
import { Bot, MoreVertical, Power, Pencil, Trash2, Plus, Search, MessageSquare, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

const statusColor: Record<string, string> = {
  active: "bg-success/15 text-success border-success/20",
  paused: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  draft: "bg-muted text-muted-foreground border-border",
};

interface Agent {
  id: number;
  name: string;
  status: string;
  platform: string;
  messages: number;
  created: string;
}

const MyAgents = () => {
  const [search, setSearch] = useState("");
  const [agents] = useState<Agent[]>([]);
  const navigate = useNavigate();
  const filtered = agents.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex-1 p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">My Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage and monitor your deployed AI agents.</p>
        </div>
        <Button className="gap-2 shrink-0" onClick={() => navigate("/")}>
          <Plus className="h-4 w-4" /> Create New Agent
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search agents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card/50"
        />
      </div>

      <div className="grid gap-3">
        {filtered.map((agent) => (
          <Card key={agent.id} className="glass-strong hover:border-primary/30 transition-colors">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{agent.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Created {agent.created}</p>
              </div>
              <Badge variant="outline" className={`${statusColor[agent.status]} text-xs capitalize hidden sm:inline-flex`}>
                {agent.status}
              </Badge>
              <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                {agent.messages.toLocaleString()}
              </div>
              <div className="hidden lg:block text-xs text-muted-foreground">{agent.platform}</div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                  <DropdownMenuItem><Zap className="mr-2 h-4 w-4" />Test</DropdownMenuItem>
                  <DropdownMenuItem><Power className="mr-2 h-4 w-4" />{agent.status === "active" ? "Pause" : "Activate"}</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent mb-4">
              <Bot className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No agents yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">Create your first AI agent to get started.</p>
            <Button className="mt-4 gap-2" size="sm" onClick={() => navigate("/")}>
              <Plus className="h-4 w-4" /> Create Agent
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyAgents;
