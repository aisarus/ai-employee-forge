import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WizardData, ConnectorConfig, AVAILABLE_CONNECTORS } from "./types";
import { Plug, CheckCircle2, X, Wifi, WifiOff, ChevronDown, ChevronUp, ExternalLink, Zap } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";

interface Props {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
}

const CONNECTOR_NAME_KEYS: Record<string, string> = {
  google_sheets: "conn.google_sheets",
  airtable: "conn.airtable",
  google_calendar: "conn.google_calendar",
  telegram_admin: "conn.telegram_admin",
  email: "conn.email",
  webhook: "conn.webhook",
  shopify: "conn.shopify",
  woocommerce: "conn.woocommerce",
  custom_api: "conn.custom_api",
};

const CAT_KEYS: Record<string, string> = {
  Spreadsheet: "conn.cat_spreadsheet",
  Database: "conn.cat_database",
  Calendar: "conn.cat_calendar",
  Messaging: "conn.cat_messaging",
  Notifications: "conn.cat_notifications",
  Automation: "conn.cat_automation",
  Store: "conn.cat_store",
  Advanced: "conn.cat_advanced",
};

// Category color accents
const CAT_COLORS: Record<string, string> = {
  Spreadsheet:   "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  Database:      "text-violet-400 bg-violet-400/10 border-violet-400/20",
  Calendar:      "text-blue-400 bg-blue-400/10 border-blue-400/20",
  Messaging:     "text-sky-400 bg-sky-400/10 border-sky-400/20",
  Notifications: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  Automation:    "text-orange-400 bg-orange-400/10 border-orange-400/20",
  Store:         "text-pink-400 bg-pink-400/10 border-pink-400/20",
  Advanced:      "text-primary bg-primary/10 border-primary/20",
};

export function StepConnections({ data, onChange }: Props) {
  const { t } = useI18n();
  // expanded card id for inline auth form
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [authInputs, setAuthInputs] = useState<Record<string, string>>({});

  const connectedIds = new Set(data.connectors.map((c) => c.type));

  const toggleExpand = (connId: string) => {
    if (connectedIds.has(connId)) return;
    setExpandedId((prev) => (prev === connId ? null : connId));
  };

  const connectService = (connectorDef: typeof AVAILABLE_CONNECTORS[number]) => {
    const authVal = authInputs[connectorDef.id] || "";
    const connector: ConnectorConfig = {
      id: crypto.randomUUID(),
      type: connectorDef.id,
      display_name: connectorDef.name,
      status: authVal ? "connected" : "pending",
      auth_value: authVal,
      capabilities: [...connectorDef.caps],
    };
    onChange({ connectors: [...data.connectors, connector] });
    setAuthInputs((prev) => ({ ...prev, [connectorDef.id]: "" }));
    setExpandedId(null);
  };

  const disconnectService = (id: string) => {
    const connector = data.connectors.find((c) => c.id === id);
    onChange({
      connectors: data.connectors.filter((c) => c.id !== id),
      data_sources: data.data_sources.filter((ds) => ds.connector_id !== connector?.type),
      field_mappings: data.field_mappings.filter((fm) => {
        const ds = data.data_sources.find((d) => d.id === fm.data_source_id);
        return ds?.connector_id !== connector?.type;
      }),
    });
  };

  const updateAuth = (id: string, authVal: string) => {
    onChange({
      connectors: data.connectors.map((c) =>
        c.id === id ? { ...c, auth_value: authVal, status: authVal ? "connected" : "pending" } : c
      ),
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-foreground">{t("wizard.conn_title")}</h2>
        <p className="text-sm text-muted-foreground">{t("wizard.conn_desc")}</p>
      </div>

      {/* Connector Gallery */}
      <div className="space-y-3">
        <Label className="flex items-center gap-1.5 text-sm font-medium">
          <Plug className="h-3.5 w-3.5 text-primary" />
          {t("wizard.conn_gallery")}
          <span className="ml-auto text-[10px] text-muted-foreground font-normal">
            {data.connectors.length > 0 ? `${data.connectors.length} connected` : "click to connect"}
          </span>
        </Label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {AVAILABLE_CONNECTORS.map((conn) => {
            const isConnected = connectedIds.has(conn.id);
            const isExpanded = expandedId === conn.id;
            const catColor = CAT_COLORS[conn.category] ?? CAT_COLORS.Advanced;

            return (
              <div
                key={conn.id}
                className={`rounded-xl border-2 transition-all duration-200 overflow-hidden ${
                  isConnected
                    ? "border-success/40 bg-success/5"
                    : isExpanded
                      ? "border-primary/50 bg-primary/5 shadow-[0_0_16px_hsl(var(--primary)/0.12)]"
                      : "border-border bg-card/40 hover:border-primary/30 hover:bg-card/70"
                }`}
              >
                {/* Card header row */}
                <button
                  onClick={() => toggleExpand(conn.id)}
                  disabled={isConnected}
                  className="w-full flex items-center gap-3 p-3 text-left"
                >
                  <span className="text-2xl leading-none shrink-0">{conn.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {CONNECTOR_NAME_KEYS[conn.id] ? t(CONNECTOR_NAME_KEYS[conn.id] as any) : conn.name}
                    </p>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md border text-[10px] font-medium mt-0.5 ${catColor}`}>
                      {CAT_KEYS[conn.category] ? t(CAT_KEYS[conn.category] as any) : conn.category}
                    </span>
                  </div>
                  <div className="shrink-0">
                    {isConnected ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-primary" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Inline auth form (expanded) */}
                {isExpanded && !isConnected && (
                  <div className="px-3 pb-3 space-y-2 border-t border-border/50 pt-3 animate-fade-in">
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Zap className="h-3 w-3 text-primary" />
                      Enter your {conn.auth_hint} to connect
                    </p>
                    <Input
                      autoFocus
                      value={authInputs[conn.id] || ""}
                      onChange={(e) => setAuthInputs((p) => ({ ...p, [conn.id]: e.target.value }))}
                      placeholder={conn.auth_hint}
                      className="bg-background/60 font-mono text-xs h-8"
                    />
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={() => connectService(conn)}
                        className="h-7 px-3 text-xs gap-1"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Connect
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => connectService(conn)}
                        className="h-7 px-3 text-xs text-muted-foreground"
                      >
                        Skip for now
                      </Button>
                      <a
                        href="#"
                        className="ml-auto text-[10px] text-primary flex items-center gap-0.5 hover:underline"
                        onClick={(e) => e.preventDefault()}
                      >
                        Docs <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Connected Services */}
      {data.connectors.length > 0 && (
        <div className="space-y-3">
          <Label className="flex items-center gap-1.5 text-sm font-medium">
            <Wifi className="h-3.5 w-3.5 text-success" />
            {t("wizard.conn_connected")}
            <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">
              {data.connectors.length}
            </Badge>
          </Label>
          <div className="space-y-2">
            {data.connectors.map((conn) => {
              const def = AVAILABLE_CONNECTORS.find((c) => c.id === conn.type);
              return (
                <div
                  key={conn.id}
                  className="group p-3 rounded-xl border border-success/30 bg-success/5 flex items-center gap-3 transition-colors hover:bg-success/8"
                >
                  <span className="text-xl shrink-0">{def?.icon || "🔌"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {CONNECTOR_NAME_KEYS[conn.type] ? t(CONNECTOR_NAME_KEYS[conn.type] as any) : conn.display_name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${conn.status === "connected" ? "text-success" : "text-amber-400"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${conn.status === "connected" ? "bg-success" : "bg-amber-400"}`} />
                        {conn.status === "connected" ? t("wizard.conn_status_ok") : t("wizard.conn_status_pending")}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {conn.capabilities.includes("read") && conn.capabilities.includes("write")
                          ? t("wizard.conn_rw")
                          : conn.capabilities.includes("read")
                            ? t("wizard.conn_read")
                            : t("wizard.conn_write")}
                      </span>
                    </div>
                  </div>
                  <Input
                    value={conn.auth_value}
                    onChange={(e) => updateAuth(conn.id, e.target.value)}
                    placeholder={def?.auth_hint || "API Key / URL"}
                    className="w-36 h-7 text-[11px] bg-background/60 font-mono border-border/60"
                  />
                  <button
                    onClick={() => disconnectService(conn.id)}
                    className="shrink-0 p-1 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data.connectors.length === 0 && expandedId === null && (
        <div className="p-6 text-center rounded-xl border border-dashed border-border bg-card/20">
          <WifiOff className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{t("wizard.conn_empty")}</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Click any connector above to set it up</p>
        </div>
      )}
    </div>
  );
}
