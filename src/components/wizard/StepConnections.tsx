import { useState, useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WizardData, ConnectorConfig, AVAILABLE_CONNECTORS } from "./types";
import {
  Plug, CheckCircle2, X, Wifi, WifiOff, ChevronDown, ChevronUp,
  ExternalLink, Zap, Loader2, AlertCircle, FileSpreadsheet, KeyRound, LogIn,
  RefreshCw,
} from "lucide-react";
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

// ── Auth-mode toggle ──────────────────────────────────────────────────────────

type AuthMode = "api_key" | "oauth";

interface AuthModeTabsProps {
  value: AuthMode;
  onChange: (m: AuthMode) => void;
}

function AuthModeTabs({ value, onChange }: AuthModeTabsProps) {
  return (
    <div className="flex gap-1 p-0.5 bg-background/60 rounded-lg border border-border/50 w-fit">
      {(["api_key", "oauth"] as AuthMode[]).map((mode) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
            value === mode
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {mode === "api_key" ? (
            <><KeyRound className="h-2.5 w-2.5" /> API Key</>
          ) : (
            <><LogIn className="h-2.5 w-2.5" /> OAuth</>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Google Sheets specific config form ───────────────────────────────────────

interface GoogleSheetsFormProps {
  authMode: AuthMode;
  onAuthModeChange: (m: AuthMode) => void;
  authInputs: Record<string, string>;
  configInputs: Record<string, string>;
  onAuthChange: (val: string) => void;
  onConfigChange: (key: string, val: string) => void;
  onConnect: () => void;
  onSkip: () => void;
  testing: boolean;
  testResult: "ok" | "error" | null;
  // OAuth-specific
  oauthEmail: string | null;
  oauthLoading: boolean;
  onOAuthConnect: () => void;
}

function GoogleSheetsForm({
  authMode, onAuthModeChange,
  authInputs, configInputs, onAuthChange, onConfigChange,
  onConnect, onSkip, testing, testResult,
  oauthEmail, oauthLoading, onOAuthConnect,
}: GoogleSheetsFormProps) {
  const apiKey        = authInputs["google_sheets"] || "";
  const spreadsheetId = configInputs["spreadsheet_id"] || "";
  const canConnect    = authMode === "api_key"
    ? apiKey.trim() !== "" && spreadsheetId.trim() !== ""
    : oauthEmail !== null && spreadsheetId.trim() !== "";

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 pb-1 border-b border-border/40">
        <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
        <span className="text-xs font-semibold text-foreground">Google Sheets Setup</span>
        <a
          href="https://developers.google.com/sheets/api/guides/authorizing"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-[10px] text-primary flex items-center gap-0.5 hover:underline"
        >
          Docs <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>

      {/* Auth mode toggle */}
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-muted-foreground">Auth method</label>
        <AuthModeTabs value={authMode} onChange={onAuthModeChange} />
      </div>

      {/* ── API Key mode ── */}
      {authMode === "api_key" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">
              API Key <span className="text-destructive">*</span>
            </label>
            <Input
              autoFocus
              value={apiKey}
              onChange={(e) => onAuthChange(e.target.value)}
              placeholder="AIza..."
              className="bg-background/60 font-mono text-xs h-8"
            />
            <p className="text-[10px] text-muted-foreground">
              Google Cloud Console → APIs &amp; Services → Credentials
            </p>
          </div>
        </div>
      )}

      {/* ── OAuth mode ── */}
      {authMode === "oauth" && (
        <div className="space-y-3">
          {/* OAuth Client ID */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">
              OAuth Client ID <span className="text-destructive">*</span>
            </label>
            <Input
              autoFocus
              value={configInputs["client_id"] || ""}
              onChange={(e) => onConfigChange("client_id", e.target.value)}
              placeholder="123456789-abc.apps.googleusercontent.com"
              className="bg-background/60 font-mono text-xs h-8"
            />
            <p className="text-[10px] text-muted-foreground">
              Google Cloud Console → OAuth 2.0 Client IDs → Web application.
              Add <code className="bg-muted px-0.5 rounded">{window.location.origin}/oauth/callback</code> to Authorized redirect URIs.
            </p>
          </div>

          {/* Connect button / status */}
          {oauthEmail ? (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-success/10 border border-success/30">
              <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
              <span className="text-[11px] text-success font-medium truncate">{oauthEmail}</span>
              <button
                onClick={onOAuthConnect}
                className="ml-auto p-0.5 text-muted-foreground hover:text-foreground rounded transition-colors"
                title="Re-authenticate"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={onOAuthConnect}
              disabled={!configInputs["client_id"]?.trim() || oauthLoading}
              className="h-8 w-full gap-2 text-xs border-border/60 hover:border-primary/50"
            >
              {oauthLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <svg className="h-3.5 w-3.5" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
                </svg>
              )}
              {oauthLoading ? "Waiting for Google…" : "Connect with Google"}
            </Button>
          )}
        </div>
      )}

      {/* ── Shared fields (both modes) ── */}
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-muted-foreground">
          Spreadsheet ID <span className="text-destructive">*</span>
        </label>
        <Input
          value={spreadsheetId}
          onChange={(e) => onConfigChange("spreadsheet_id", e.target.value)}
          placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
          className="bg-background/60 font-mono text-xs h-8"
        />
        <p className="text-[10px] text-muted-foreground">
          Found in the sheet URL: /spreadsheets/d/<strong>ID</strong>/edit
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-medium text-muted-foreground">Sheet / Tab Name</label>
        <Input
          value={configInputs["sheet_name"] || ""}
          onChange={(e) => onConfigChange("sheet_name", e.target.value)}
          placeholder="Sheet1"
          className="bg-background/60 text-xs h-8"
        />
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-medium text-muted-foreground">Range (optional)</label>
        <Input
          value={configInputs["range"] || ""}
          onChange={(e) => onConfigChange("range", e.target.value)}
          placeholder="A1:Z1000"
          className="bg-background/60 font-mono text-xs h-8"
        />
      </div>

      {/* Test result feedback */}
      {testResult === "ok" && (
        <div className="flex items-center gap-1.5 text-[11px] text-success">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Connection test passed — sheet is accessible.
        </div>
      )}
      {testResult === "error" && (
        <div className="flex items-center gap-1.5 text-[11px] text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          Could not reach the sheet. Check your credentials and Spreadsheet ID.
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          onClick={onConnect}
          disabled={!canConnect || testing}
          className="h-7 px-3 text-xs gap-1"
        >
          {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
          {testing ? "Testing…" : "Connect"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onSkip}
          className="h-7 px-3 text-xs text-muted-foreground"
        >
          Skip for now
        </Button>
      </div>
    </div>
  );
}

// ── Generic connector auth form ───────────────────────────────────────────────

interface GenericFormProps {
  connId: string;
  authHint: string;
  authInputs: Record<string, string>;
  onAuthChange: (val: string) => void;
  onConnect: () => void;
  onSkip: () => void;
}

function GenericConnectorForm({ connId, authHint, authInputs, onAuthChange, onConnect, onSkip }: GenericFormProps) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
        <Zap className="h-3 w-3 text-primary" />
        Enter your {authHint} to connect
      </p>
      <Input
        autoFocus
        value={authInputs[connId] || ""}
        onChange={(e) => onAuthChange(e.target.value)}
        placeholder={authHint}
        className="bg-background/60 font-mono text-xs h-8"
      />
      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" onClick={onConnect} className="h-7 px-3 text-xs gap-1">
          <CheckCircle2 className="h-3 w-3" /> Connect
        </Button>
        <Button size="sm" variant="ghost" onClick={onSkip} className="h-7 px-3 text-xs text-muted-foreground">
          Skip for now
        </Button>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Real Google Sheets API connection test. */
async function testGoogleSheetsApi(
  spreadsheetId: string,
  opts: { apiKey?: string; accessToken?: string },
): Promise<boolean> {
  if (!spreadsheetId.trim()) return false;
  try {
    const url = opts.accessToken
      ? `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetId`
      : `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?key=${encodeURIComponent(opts.apiKey ?? "")}&fields=spreadsheetId`;

    const headers: HeadersInit = opts.accessToken
      ? { Authorization: `Bearer ${opts.accessToken}` }
      : {};

    const res = await fetch(url, { headers });
    return res.ok;
  } catch {
    return false;
  }
}

/** Fetch Google account email from access token. */
async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.email ?? null;
  } catch {
    return null;
  }
}

/** Build Google OAuth 2.0 implicit-grant URL. */
function buildGoogleOAuthUrl(clientId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    response_type: "token",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "),
    access_type: "online",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// ── Main component ────────────────────────────────────────────────────────────

export function StepConnections({ data, onChange }: Props) {
  const { t } = useI18n();

  const [expandedId,    setExpandedId]    = useState<string | null>(null);
  const [authInputs,    setAuthInputs]    = useState<Record<string, string>>({});
  const [configInputs,  setConfigInputs]  = useState<Record<string, string>>({});
  const [testing,       setTesting]       = useState(false);
  const [testResult,    setTestResult]    = useState<"ok" | "error" | null>(null);

  // Google Sheets OAuth state
  const [authMode,      setAuthMode]      = useState<AuthMode>("api_key");
  const [oauthToken,    setOauthToken]    = useState<string | null>(null);
  const [oauthEmail,    setOauthEmail]    = useState<string | null>(null);
  const [oauthLoading,  setOauthLoading]  = useState(false);

  // Ref to the message event listener so we can clean it up
  const oauthListenerRef = useRef<((e: MessageEvent) => void) | null>(null);

  // Clean up listener on unmount
  useEffect(() => {
    return () => {
      if (oauthListenerRef.current) {
        window.removeEventListener("message", oauthListenerRef.current);
      }
    };
  }, []);

  const connectedIds = new Set(data.connectors.map((c) => c.type));

  const toggleExpand = (connId: string) => {
    if (connectedIds.has(connId)) return;
    setExpandedId((prev) => {
      if (prev !== connId) {
        setTestResult(null);
        // Reset OAuth state when switching connectors
        setOauthToken(null);
        setOauthEmail(null);
      }
      return prev === connId ? null : connId;
    });
  };

  // ── Google OAuth popup flow ────────────────────────────────────────────────

  const handleGoogleOAuth = () => {
    const clientId = configInputs["client_id"]?.trim();
    if (!clientId) return;

    // Remove any previous listener
    if (oauthListenerRef.current) {
      window.removeEventListener("message", oauthListenerRef.current);
    }

    const redirectUri = `${window.location.origin}/oauth/callback`;
    const authUrl     = buildGoogleOAuthUrl(clientId, redirectUri);

    // Open popup (600×700 centered)
    const left   = Math.max(0, (window.screenX ?? 0) + (window.outerWidth  - 600) / 2);
    const top    = Math.max(0, (window.screenY ?? 0) + (window.outerHeight - 700) / 2);
    const popup  = window.open(authUrl, "google_oauth", `width=600,height=700,left=${left},top=${top}`);

    if (!popup) {
      alert("Popup blocked — please allow popups for this site and try again.");
      return;
    }

    setOauthLoading(true);

    const listener = async (event: MessageEvent) => {
      // Only accept messages from our own origin
      if (event.origin !== window.location.origin) return;
      if (!event.data || event.data.type !== "GOOGLE_OAUTH_CALLBACK") return;

      window.removeEventListener("message", listener);
      oauthListenerRef.current = null;

      const { token, error } = event.data as { token?: string; error?: string };

      if (error || !token) {
        setOauthLoading(false);
        setTestResult("error");
        return;
      }

      // Fetch user email to display
      const email = await fetchGoogleEmail(token);
      setOauthToken(token);
      setOauthEmail(email);
      setAuthInputs((prev) => ({ ...prev, google_sheets: token }));
      setConfigInputs((prev) => ({ ...prev, oauth_email: email ?? "" }));
      setOauthLoading(false);
    };

    oauthListenerRef.current = listener;
    window.addEventListener("message", listener);

    // Detect if the popup was closed manually before auth completes
    const pollClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollClosed);
        if (oauthListenerRef.current) {
          window.removeEventListener("message", oauthListenerRef.current);
          oauthListenerRef.current = null;
          setOauthLoading(false);
        }
      }
    }, 500);
  };

  // ── Auth mode change ────────────────────────────────────────────────────────

  const handleAuthModeChange = (mode: AuthMode) => {
    setAuthMode(mode);
    setTestResult(null);
    // Clear credentials when switching modes
    setAuthInputs((prev) => ({ ...prev, google_sheets: "" }));
    setOauthToken(null);
    setOauthEmail(null);
    setConfigInputs((prev) => {
      const next = { ...prev };
      delete next["client_id"];
      delete next["oauth_email"];
      return next;
    });
  };

  // ── Real connection test ────────────────────────────────────────────────────

  const testGoogleSheetsConnection = async (): Promise<boolean> => {
    const spreadsheetId = configInputs["spreadsheet_id"]?.trim() ?? "";
    if (authMode === "oauth" && oauthToken) {
      return testGoogleSheetsApi(spreadsheetId, { accessToken: oauthToken });
    }
    const apiKey = authInputs["google_sheets"]?.trim() ?? "";
    return testGoogleSheetsApi(spreadsheetId, { apiKey });
  };

  // ── Connect / Skip / Disconnect ────────────────────────────────────────────

  const connectService = async (connectorDef: typeof AVAILABLE_CONNECTORS[number]) => {
    const authVal = authInputs[connectorDef.id] || "";
    const config  = connectorDef.id === "google_sheets"
      ? { ...configInputs, auth_mode: authMode }
      : {};

    // For Google Sheets: run real API test before marking connected
    if (connectorDef.id === "google_sheets") {
      const hasCredential = authMode === "oauth" ? !!oauthToken : !!authVal;
      if (hasCredential && configInputs["spreadsheet_id"]) {
        setTesting(true);
        const ok = await testGoogleSheetsConnection();
        setTesting(false);
        setTestResult(ok ? "ok" : "error");
        if (!ok) return;
      }
    }

    const connector: ConnectorConfig = {
      id: crypto.randomUUID(),
      type: connectorDef.id,
      display_name: connectorDef.name,
      status: authVal ? "connected" : "pending",
      auth_value: authVal,
      capabilities: [...connectorDef.caps],
      config,
    };
    onChange({ connectors: [...data.connectors, connector] });
    setAuthInputs((prev) => ({ ...prev, [connectorDef.id]: "" }));
    setConfigInputs({});
    setExpandedId(null);
    setTestResult(null);
    setOauthToken(null);
    setOauthEmail(null);
    setAuthMode("api_key");
  };

  const skipConnect = (connectorDef: typeof AVAILABLE_CONNECTORS[number]) => {
    const connector: ConnectorConfig = {
      id: crypto.randomUUID(),
      type: connectorDef.id,
      display_name: connectorDef.name,
      status: "pending",
      auth_value: "",
      capabilities: [...connectorDef.caps],
      config: {},
    };
    onChange({ connectors: [...data.connectors, connector] });
    setExpandedId(null);
    setTestResult(null);
  };

  const disconnectService = (id: string) => {
    const connector = data.connectors.find((c) => c.id === id);
    onChange({
      connectors:    data.connectors.filter((c) => c.id !== id),
      data_sources:  data.data_sources.filter((ds) => ds.connector_id !== connector?.type),
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

      {/* Connector gallery */}
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
            const isExpanded  = expandedId === conn.id;
            const catColor    = CAT_COLORS[conn.category] ?? CAT_COLORS.Advanced;

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
                {/* Card header */}
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

                {/* Inline auth / config form */}
                {isExpanded && !isConnected && (
                  <div className="px-3 pb-3 border-t border-border/50 pt-3 animate-fade-in">
                    {conn.id === "google_sheets" ? (
                      <GoogleSheetsForm
                        authMode={authMode}
                        onAuthModeChange={handleAuthModeChange}
                        authInputs={authInputs}
                        configInputs={configInputs}
                        onAuthChange={(v) => setAuthInputs((p) => ({ ...p, google_sheets: v }))}
                        onConfigChange={(k, v) => setConfigInputs((p) => ({ ...p, [k]: v }))}
                        onConnect={() => connectService(conn)}
                        onSkip={() => skipConnect(conn)}
                        testing={testing}
                        testResult={testResult}
                        oauthEmail={oauthEmail}
                        oauthLoading={oauthLoading}
                        onOAuthConnect={handleGoogleOAuth}
                      />
                    ) : (
                      <GenericConnectorForm
                        connId={conn.id}
                        authHint={conn.auth_hint}
                        authInputs={authInputs}
                        onAuthChange={(v) => setAuthInputs((p) => ({ ...p, [conn.id]: v }))}
                        onConnect={() => connectService(conn)}
                        onSkip={() => skipConnect(conn)}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Connected services list */}
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
              const isOAuth = conn.config?.auth_mode === "oauth";
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
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
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
                      {/* Auth mode badge */}
                      {conn.type === "google_sheets" && (
                        <span className={`inline-flex items-center gap-0.5 text-[10px] px-1 py-0 rounded border ${
                          isOAuth
                            ? "text-blue-400 bg-blue-400/10 border-blue-400/20"
                            : "text-muted-foreground bg-muted/30 border-border/50"
                        }`}>
                          {isOAuth ? <><LogIn className="h-2.5 w-2.5" /> OAuth</> : <><KeyRound className="h-2.5 w-2.5" /> API Key</>}
                        </span>
                      )}
                      {/* Email badge for OAuth */}
                      {conn.type === "google_sheets" && isOAuth && conn.config?.oauth_email && (
                        <span className="text-[10px] text-blue-400 truncate max-w-[140px]" title={conn.config.oauth_email}>
                          {conn.config.oauth_email}
                        </span>
                      )}
                      {/* Spreadsheet ID badge for API key mode */}
                      {conn.type === "google_sheets" && !isOAuth && conn.config?.spreadsheet_id && (
                        <span className="text-[10px] font-mono text-emerald-400 truncate max-w-[120px]" title={conn.config.spreadsheet_id}>
                          {conn.config.spreadsheet_id.slice(0, 14)}…
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Only show auth edit field for non-OAuth connectors */}
                  {(!isOAuth || conn.type !== "google_sheets") && (
                    <Input
                      value={conn.auth_value}
                      onChange={(e) => updateAuth(conn.id, e.target.value)}
                      placeholder={def?.auth_hint || "API Key / URL"}
                      className="w-32 h-7 text-[11px] bg-background/60 font-mono border-border/60"
                    />
                  )}
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
