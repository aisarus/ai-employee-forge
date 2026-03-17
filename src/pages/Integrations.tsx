import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  MessageSquare, Send, Instagram, Globe, Webhook, Settings, ExternalLink,
  FileSpreadsheet, KeyRound, LogIn, CheckCircle2, WifiOff,
} from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { GoogleSheetsDialog, GSHEETS_LS_KEY } from "@/components/connectors/GoogleSheetsDialog";
import type { SheetsConnection } from "@/components/connectors/GoogleSheetsDialog";

// ── Messaging channels ────────────────────────────────────────────────────────

const INITIAL_INTEGRATIONS = [
  { id: "telegram",  name: "Telegram",       descKey: "integrations.telegram_desc"  as const, icon: Send,         connected: false },
  { id: "whatsapp",  name: "WhatsApp",        descKey: "integrations.whatsapp_desc"  as const, icon: MessageSquare, connected: false },
  { id: "instagram", name: "Instagram DMs",   descKey: "integrations.instagram_desc" as const, icon: Instagram,    connected: false },
  { id: "web",       name: "Web Widget",      descKey: "integrations.web_desc"       as const, icon: Globe,        connected: false },
  { id: "webhook",   name: "Custom Webhook",  descKey: "integrations.webhook_desc"   as const, icon: Webhook,      connected: false },
];

// ── Component ─────────────────────────────────────────────────────────────────

const Integrations = () => {
  const { t } = useI18n();

  // ── Messaging channels state ─────────────────────────────────────────────
  const [integrations, setIntegrations] = useState(INITIAL_INTEGRATIONS);

  const toggle = (id: string) => {
    setIntegrations((prev) =>
      prev.map((i) => (i.id === id ? { ...i, connected: !i.connected } : i))
    );
  };

  // ── Google Sheets state ──────────────────────────────────────────────────
  const [sheetsConn, setSheetsConn] = useState<SheetsConnection | null>(null);
  const [sheetsDialogOpen, setSheetsDialogOpen] = useState(false);

  // Load persisted connection on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(GSHEETS_LS_KEY);
      if (raw) setSheetsConn(JSON.parse(raw) as SheetsConnection);
    } catch {
      // ignore
    }
  }, []);

  const handleSheetsSave = (conn: SheetsConnection | null) => {
    setSheetsConn(conn);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 p-6 space-y-8 animate-fade-in">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("integrations.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("integrations.subtitle")}
        </p>
      </div>

      {/* ── Messaging channels ───────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          Messaging Channels
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {integrations.map((int) => (
            <Card key={int.id} className="glass-strong hover:border-primary/30 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <int.icon className="h-5 w-5 text-primary" />
                  </div>
                  <Switch checked={int.connected} onCheckedChange={() => toggle(int.id)} />
                </div>
                <CardTitle className="text-sm font-semibold mt-3">{int.name}</CardTitle>
                <CardDescription className="text-xs">{t(int.descKey)}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className={`text-xs ${int.connected ? "bg-success/15 text-success border-success/20" : ""}`}
                  >
                    {int.connected ? t("integrations.connected") : t("integrations.disconnected")}
                  </Badge>
                  {int.connected ? (
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5">
                      <Settings className="h-3 w-3" /> {t("integrations.configure")}
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5">
                      <ExternalLink className="h-3 w-3" /> {t("integrations.setup")}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Data Sources ─────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
          Data Sources
          <span className="text-[11px] font-normal text-muted-foreground">
            — connect spreadsheets &amp; databases your bots can read/write
          </span>
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* ── Google Sheets card ──────────────────────────────────────── */}
          <Card
            className={`glass-strong transition-colors ${
              sheetsConn
                ? "border-emerald-500/30 hover:border-emerald-500/50"
                : "hover:border-primary/30"
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                </div>

                {sheetsConn ? (
                  <Badge className="bg-success/15 text-success border-success/20 text-[10px] h-5 px-1.5">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-muted-foreground">
                    <WifiOff className="h-3 w-3 mr-1" /> Not connected
                  </Badge>
                )}
              </div>

              <CardTitle className="text-sm font-semibold mt-3">Google Sheets</CardTitle>
              <CardDescription className="text-xs">
                Read and write spreadsheet data — leads, orders, bookings, and more.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-0 space-y-3">
              {/* Connection details */}
              {sheetsConn && (
                <div className="space-y-1 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    {sheetsConn.mode === "oauth" ? (
                      <><LogIn className="h-3 w-3 text-blue-400" /> OAuth — {sheetsConn.oauthEmail || "Google account"}</>
                    ) : (
                      <><KeyRound className="h-3 w-3" /> API Key</>
                    )}
                  </div>
                  <div className="font-mono truncate text-[10px] text-emerald-400/80">
                    ID: {sheetsConn.spreadsheetId}
                  </div>
                  {sheetsConn.sheetName && sheetsConn.sheetName !== "Sheet1" && (
                    <div>Sheet: {sheetsConn.sheetName}</div>
                  )}
                  <div className="text-[10px]">
                    Connected {new Date(sheetsConn.connectedAt).toLocaleDateString()}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={sheetsConn ? "outline" : "default"}
                  className="h-7 text-xs gap-1.5 flex-1"
                  onClick={() => setSheetsDialogOpen(true)}
                >
                  {sheetsConn ? (
                    <><Settings className="h-3 w-3" /> Reconfigure</>
                  ) : (
                    <><ExternalLink className="h-3 w-3" /> Connect</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Coming-soon placeholders ──────────────────────────────────── */}
          {[
            { name: "Notion", icon: "📝", desc: "Query databases and create pages from bot conversations." },
            { name: "HubSpot CRM", icon: "🧲", desc: "Log contacts and deals directly from your AI agents." },
          ].map((ph) => (
            <Card key={ph.name} className="glass-strong opacity-60 cursor-default border-dashed">
              <CardHeader className="pb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50 text-2xl">
                  {ph.icon}
                </div>
                <CardTitle className="text-sm font-semibold mt-3 flex items-center gap-2">
                  {ph.name}
                  <Badge variant="outline" className="text-[10px] h-4 px-1 font-normal">Soon</Badge>
                </CardTitle>
                <CardDescription className="text-xs">{ph.desc}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button variant="ghost" size="sm" className="h-7 text-xs" disabled>
                  Coming soon
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Google Sheets connect dialog ──────────────────────────────────── */}
      <GoogleSheetsDialog
        open={sheetsDialogOpen}
        onOpenChange={setSheetsDialogOpen}
        onSave={handleSheetsSave}
        initialConnection={sheetsConn}
      />
    </div>
  );
};

export default Integrations;
