import { SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronRight, Settings, LogOut, Globe } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  const { user, signOut } = useAuth();
  const { t, lang, setLang } = useI18n();
  const location = useLocation();

  const pageTitleKeys: Record<string, string> = {
    "/": "nav.create_agent",
    "/agents": "nav.my_agents",
    "/integrations": "nav.integrations",
    "/billing": "nav.billing",
  };

  const titleKey = pageTitleKeys[location.pathname] || "nav.dashboard";
  const pageTitle = t(titleKey as any);
  const initials = user?.email?.slice(0, 2).toUpperCase() || "BF";

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/50 bg-background/60 px-4 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>{t("nav.dashboard")}</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">{pageTitle}</span>
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLang(lang === "ru" ? "en" : "ru")}
          className="h-8 px-2 gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <Globe className="h-3.5 w-3.5" />
          {lang === "ru" ? "EN" : "RU"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="h-8 w-8 border border-border">
                <AvatarFallback className="bg-accent text-xs font-medium text-accent-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
              {user?.email}
            </DropdownMenuItem>
            <DropdownMenuItem><Settings className="mr-2 h-4 w-4" />{t("nav.settings")}</DropdownMenuItem>
            <DropdownMenuItem onClick={signOut}><LogOut className="mr-2 h-4 w-4" />{t("nav.logout")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
