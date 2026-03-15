import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WizardData, ConnectorConfig, AVAILABLE_CONNECTORS } from "./types";
import { Plug, CheckCircle2, XCircle, Plus, X, Wifi, WifiOff } from "lucide-react";
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

export function StepConnections({ data, onChange }: Props) {
  const { t } = useI18n();
  const [authInputs, setAuthInputs] = useState<Record<string, string>>({});

  const connectedIds = new Set(data.connectors.map((c) => c.type));

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
          <Plug className="h-3.5 w-3.5" /> {t("wizard.conn_gallery")}
        </Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {AVAILABLE_CONNECTORS.map((conn) => {
            const isConnected = connectedIds.has(conn.id);
            return (
              <button
                key={conn.id}
                onClick={() => !isConnected && connectService(conn)}
                disabled={isConnected}
                className={`relative flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center transition-all duration-200 ${
                  isConnected
                    ? "border-success/50 bg-success/5 opacity-70"
                    : "border-border bg-card/50 hover:border-primary/40 hover:bg-primary/5 hover:scale-[1.02]"
                }`}
              >
                {isConnected && (
                  <CheckCircle2 className="absolute top-1.5 right-1.5 h-3.5 w-3.5 text-success" />
                )}
                <span className="text-xl">{conn.icon}</span>
                <span className="text-xs font-semibold text-foreground">
                  {CONNECTOR_NAME_KEYS[conn.id] ? t(CONNECTOR_NAME_KEYS[conn.id] as any) : conn.name}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {CAT_KEYS[conn.category] ? t(CAT_KEYS[conn.category] as any) : conn.category}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Connected Services */}
      {data.connectors.length > 0 && (
        <div className="space-y-3">
          <Label className="flex items-center gap-1.5 text-sm font-medium">
            <Wifi className="h-3.5 w-3.5" /> {t("wizard.conn_connected")} ({data.connectors.length})
          </Label>
          <div className="space-y-2">
            {data.connectors.map((conn) => {
              const def = AVAILABLE_CONNECTORS.find((c) => c.id === conn.type);
              return (
                <div key={conn.id} className="p-3 rounded-xl border border-border bg-card/30 flex items-center gap-3">
                  <span className="text-lg">{def?.icon || "🔌"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {CONNECTOR_NAME_KEYS[conn.type] ? t(CONNECTOR_NAME_KEYS[conn.type] as any) : conn.display_name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={conn.status === "connected" ? "default" : "secondary"} className="text-[10px] h-4">
                        {conn.status === "connected" ? t("wizard.conn_status_ok") : t("wizard.conn_status_pending")}
                      </Badge>
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
                    className="w-40 h-8 text-xs bg-background/50 font-mono"
                  />
                  <button onClick={() => disconnectService(conn.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data.connectors.length === 0 && (
        <div className="p-6 text-center rounded-xl border border-dashed border-border bg-card/20">
          <WifiOff className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{t("wizard.conn_empty")}</p>
        </div>
      )}
    </div>
  );
}
