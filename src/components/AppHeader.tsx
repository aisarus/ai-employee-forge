import { SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronRight, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "react-router-dom";

const pageTitles: Record<string, string> = {
  "/": "Create New Agent",
  "/agents": "My Agents",
  "/integrations": "Integrations",
  "/billing": "Billing",
};

export function AppHeader() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const pageTitle = pageTitles[location.pathname] || "Dashboard";
  const initials = user?.email?.slice(0, 2).toUpperCase() || "BF";

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/50 bg-background/60 px-4 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>Dashboard</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">{pageTitle}</span>
        </nav>
      </div>
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
          <DropdownMenuItem><Settings className="mr-2 h-4 w-4" />Settings</DropdownMenuItem>
          <DropdownMenuItem onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Log out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
