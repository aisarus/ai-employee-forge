/**
 * GoogleSheetsDialog — standalone Google Sheets connection dialog.
 *
 * Supports two auth modes:
 *   - API Key  — for public/shared spreadsheets
 *   - OAuth 2.0 — for private spreadsheets; uses implicit-grant popup flow
 *
 * After a successful connection test the user can preview the first rows
 * of the sheet, then save the connection to localStorage.
 *
 * The saved connection is picked up by the bot wizard (StepConnections) to
 * pre-populate the Google Sheets form so users don't have to re-enter creds.
 */

import { useState, useRef, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2, Loader2, AlertCircle, ExternalLink, KeyRound,
  LogIn, RefreshCw, FileSpreadsheet, Table2, X, Wifi,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SheetsConnection {
  mode: "api_key" | "oauth";
  authValue: string;          // API key or OAuth access token
  spreadsheetId: string;
  sheetName: string;
  clientId?: string;
  oauthEmail?: string;
  connectedAt: string;
}

export const GSHEETS_LS_KEY = "botforge_gsheets_connection";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function testSheetsConnection(
  spreadsheetId: string,
  auth: { apiKey?: string; accessToken?: string },
): Promise<boolean> {
  if (!spreadsheetId.trim()) return false;
  try {
    const url = auth.accessToken
      ? `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetId`
      : `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?key=${encodeURIComponent(auth.apiKey ?? "")}&fields=spreadsheetId`;
    const headers: HeadersInit = auth.accessToken
      ? { Authorization: `Bearer ${auth.accessToken}` }
      : {};
    const res = await fetch(url, { headers });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchSheetPreview(
  spreadsheetId: string,
  sheetName: string,
  auth: { apiKey?: string; accessToken?: string },
): Promise<string[][] | null> {
  const range = `${sheetName || "Sheet1"}!A1:Z6`;
  try {
    const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`;
    const url = auth.accessToken
      ? base
      : `${base}?key=${encodeURIComponent(auth.apiKey ?? "")}`;
    const headers: HeadersInit = auth.accessToken
      ? { Authorization: `Bearer ${auth.accessToken}` }
      : {};
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.values as string[][]) ?? [];
  } catch {
    return null;
  }
}

async function fetchGoogleUserEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.email as string) ?? null;
  } catch {
    return null;
  }
}

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

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new connection (or null when disconnecting). */
  onSave: (connection: SheetsConnection | null) => void;
  /** Pre-fill form from an existing connection. */
  initialConnection?: SheetsConnection | null;
}

export function GoogleSheetsDialog({ open, onOpenChange, onSave, initialConnection }: Props) {
  // ── Form state ──────────────────────────────────────────────────────────────
  const [mode, setMode]               = useState<"api_key" | "oauth">(initialConnection?.mode ?? "api_key");
  const [apiKey, setApiKey]           = useState(initialConnection?.mode === "api_key" ? initialConnection.authValue : "");
  const [clientId, setClientId]       = useState(initialConnection?.clientId ?? "");
  const [oauthToken, setOauthToken]   = useState(initialConnection?.mode === "oauth" ? initialConnection.authValue : "");
  const [oauthEmail, setOauthEmail]   = useState(initialConnection?.oauthEmail ?? "");
  const [oauthLoading, setOauthLoading] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState(initialConnection?.spreadsheetId ?? "");
  const [sheetName, setSheetName]     = useState(initialConnection?.sheetName ?? "Sheet1");

  // ── Test / preview state ────────────────────────────────────────────────────
  const [testing, setTesting]               = useState(false);
  const [testResult, setTestResult]         = useState<"ok" | "error" | null>(null);
  const [preview, setPreview]               = useState<string[][] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // OAuth popup listener ref for cleanup
  const oauthListenerRef = useRef<((e: MessageEvent) => void) | null>(null);

  useEffect(() => {
    return () => {
      if (oauthListenerRef.current) {
        window.removeEventListener("message", oauthListenerRef.current);
      }
    };
  }, []);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const getAuth = (): { apiKey?: string; accessToken?: string } =>
    mode === "oauth"
      ? { accessToken: oauthToken || undefined }
      : { apiKey: apiKey || undefined };

  const hasCredential = mode === "api_key" ? apiKey.trim() !== "" : oauthToken !== "";
  const canTest  = hasCredential && spreadsheetId.trim() !== "";
  const canSave  = testResult === "ok" && canTest;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleModeChange = (m: "api_key" | "oauth") => {
    setMode(m);
    setTestResult(null);
    setPreview(null);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setPreview(null);

    const ok = await testSheetsConnection(spreadsheetId, getAuth());
    setTestResult(ok ? "ok" : "error");
    setTesting(false);

    if (ok) {
      setPreviewLoading(true);
      const rows = await fetchSheetPreview(spreadsheetId, sheetName, getAuth());
      setPreview(rows);
      setPreviewLoading(false);
    }
  };

  const handleOAuth = () => {
    if (!clientId.trim()) return;
    if (oauthListenerRef.current) {
      window.removeEventListener("message", oauthListenerRef.current);
    }

    const redirectUri = `${window.location.origin}/oauth/callback`;
    const authUrl     = buildGoogleOAuthUrl(clientId, redirectUri);
    const left = Math.max(0, (window.screenX ?? 0) + (window.outerWidth  - 600) / 2);
    const top  = Math.max(0, (window.screenY ?? 0) + (window.outerHeight - 700) / 2);
    const popup = window.open(authUrl, "google_oauth", `width=600,height=700,left=${left},top=${top}`);

    if (!popup) {
      alert("Popup blocked — please allow popups for this site and try again.");
      return;
    }

    setOauthLoading(true);

    const listener = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!event.data || event.data.type !== "GOOGLE_OAUTH_CALLBACK") return;

      window.removeEventListener("message", listener);
      oauthListenerRef.current = null;

      const { token, error } = event.data as { token?: string; error?: string };
      if (error || !token) {
        setOauthLoading(false);
        return;
      }

      const email = await fetchGoogleUserEmail(token);
      setOauthToken(token);
      setOauthEmail(email ?? "");
      setOauthLoading(false);
      setTestResult(null);
      setPreview(null);
    };

    oauthListenerRef.current = listener;
    window.addEventListener("message", listener);

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

  const handleSave = () => {
    const conn: SheetsConnection = {
      mode,
      authValue:    mode === "api_key" ? apiKey : oauthToken,
      spreadsheetId,
      sheetName:    sheetName || "Sheet1",
      clientId:     mode === "oauth" ? clientId : undefined,
      oauthEmail:   mode === "oauth" ? oauthEmail : undefined,
      connectedAt:  new Date().toISOString(),
    };
    localStorage.setItem(GSHEETS_LS_KEY, JSON.stringify(conn));
    onSave(conn);
    onOpenChange(false);
  };

  const handleDisconnect = () => {
    localStorage.removeItem(GSHEETS_LS_KEY);
    onSave(null);
    onOpenChange(false);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
            Google Sheets Connection
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* ── Auth mode tabs ─────────────────────────────────────────────── */}
          <Tabs value={mode} onValueChange={(v) => handleModeChange(v as "api_key" | "oauth")}>
            <TabsList className="w-full">
              <TabsTrigger value="api_key" className="flex-1 gap-1.5 text-xs">
                <KeyRound className="h-3.5 w-3.5" /> API Key
              </TabsTrigger>
              <TabsTrigger value="oauth" className="flex-1 gap-1.5 text-xs">
                <LogIn className="h-3.5 w-3.5" /> OAuth 2.0
              </TabsTrigger>
            </TabsList>

            {/* ── API Key tab ──────────────────────────────────────────────── */}
            <TabsContent value="api_key" className="space-y-3 mt-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Google API Key <span className="text-destructive">*</span>
                </label>
                <Input
                  autoFocus
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setTestResult(null); setPreview(null); }}
                  placeholder="AIza..."
                  className="font-mono text-xs h-9"
                />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Google Cloud Console → APIs &amp; Services → Credentials → Create API Key.
                  Enable the <strong>Google Sheets API</strong> in your project.{" "}
                  <a
                    href="https://developers.google.com/sheets/api/guides/authorizing#APIKey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-0.5"
                  >
                    Docs <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </p>
              </div>
            </TabsContent>

            {/* ── OAuth tab ────────────────────────────────────────────────── */}
            <TabsContent value="oauth" className="space-y-3 mt-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  OAuth Client ID <span className="text-destructive">*</span>
                </label>
                <Input
                  autoFocus
                  value={clientId}
                  onChange={(e) => {
                    setClientId(e.target.value);
                    setOauthToken("");
                    setOauthEmail("");
                    setTestResult(null);
                    setPreview(null);
                  }}
                  placeholder="123456789-abc.apps.googleusercontent.com"
                  className="font-mono text-xs h-9"
                />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Google Cloud Console → OAuth 2.0 Client IDs (Web app).
                  Add{" "}
                  <code className="bg-muted px-1 rounded text-[10px]">
                    {window.location.origin}/oauth/callback
                  </code>{" "}
                  to <em>Authorized redirect URIs</em>.
                </p>
              </div>

              {/* OAuth button / status ─────────────────────────────────────── */}
              {oauthEmail ? (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-emerald-400">Connected as</p>
                    <p className="text-xs text-foreground truncate">{oauthEmail}</p>
                  </div>
                  <button
                    onClick={() => { setOauthToken(""); setOauthEmail(""); setTestResult(null); setPreview(null); }}
                    className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
                    title="Disconnect Google account"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={handleOAuth}
                    className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
                    title="Re-authenticate"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleOAuth}
                  disabled={!clientId.trim() || oauthLoading}
                  className="w-full h-9 gap-2 text-xs"
                >
                  {oauthLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
                    </svg>
                  )}
                  {oauthLoading ? "Waiting for Google…" : "Connect with Google"}
                </Button>
              )}
            </TabsContent>
          </Tabs>

          {/* ── Shared spreadsheet fields ───────────────────────────────────── */}
          <div className="space-y-3 pt-1 border-t border-border/40">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Spreadsheet ID <span className="text-destructive">*</span>
              </label>
              <Input
                value={spreadsheetId}
                onChange={(e) => { setSpreadsheetId(e.target.value); setTestResult(null); setPreview(null); }}
                placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                className="font-mono text-xs h-9"
              />
              <p className="text-[11px] text-muted-foreground">
                From the sheet URL: /spreadsheets/d/<strong>ID</strong>/edit
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Sheet / Tab Name</label>
              <Input
                value={sheetName}
                onChange={(e) => { setSheetName(e.target.value); setPreview(null); }}
                placeholder="Sheet1"
                className="text-xs h-9"
              />
            </div>
          </div>

          {/* ── Test connection ─────────────────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={!canTest || testing}
              className="h-8 text-xs gap-1.5"
            >
              {testing
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Wifi className="h-3.5 w-3.5" />
              }
              Test Connection
            </Button>

            {testResult === "ok" && (
              <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" /> Connected
              </span>
            )}
            {testResult === "error" && (
              <span className="flex items-center gap-1 text-xs text-destructive font-medium">
                <AlertCircle className="h-3.5 w-3.5" /> Connection failed — check credentials &amp; ID
              </span>
            )}
          </div>

          {/* ── Data preview ────────────────────────────────────────────────── */}
          {previewLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading preview…
            </div>
          )}

          {preview !== null && !previewLoading && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Table2 className="h-3.5 w-3.5" />
                Data Preview
                {preview.length > 0 && (
                  <span className="text-[10px] font-normal">
                    (first {Math.min(preview.length, 6)} rows)
                  </span>
                )}
              </p>

              {preview.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Sheet is empty or no data in the specified range.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border/50 bg-muted/20">
                  <table className="text-[10px] w-full">
                    <tbody>
                      {preview.slice(0, 6).map((row, ri) => (
                        <tr
                          key={ri}
                          className={ri === 0
                            ? "bg-muted/60 font-semibold border-b border-border/40"
                            : "hover:bg-muted/30 border-b border-border/20 last:border-b-0"}
                        >
                          {row.map((cell, ci) => (
                            <td
                              key={ci}
                              className="px-2.5 py-1.5 border-r border-border/30 last:border-r-0 truncate max-w-[140px]"
                              title={cell}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Footer actions ───────────────────────────────────────────────── */}
          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            {initialConnection ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                Disconnect
              </Button>
            ) : (
              <div />
            )}

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!canSave}
                className="h-8 text-xs gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Save Connection
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
