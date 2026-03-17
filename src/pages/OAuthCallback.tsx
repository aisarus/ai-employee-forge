/**
 * OAuthCallback — minimal popup page for Google OAuth implicit-grant flow.
 *
 * Google redirects here after the user grants access.
 * We read the access_token (or error) from the URL hash fragment,
 * post it back to the opener window, then close ourselves.
 *
 * Route:  /oauth/callback
 * Opener: StepConnections.tsx – handleGoogleOAuth()
 */
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function OAuthCallback() {
  useEffect(() => {
    const hash = window.location.hash.slice(1);       // strip leading "#"
    const params = new URLSearchParams(hash);

    const token = params.get("access_token") ?? undefined;
    const error = params.get("error") ?? undefined;
    const errorDescription = params.get("error_description") ?? undefined;

    if (window.opener) {
      window.opener.postMessage(
        { type: "GOOGLE_OAUTH_CALLBACK", token, error, errorDescription },
        window.location.origin,
      );
      window.close();
    } else {
      // Fallback: redirect back to main page (shouldn't normally happen)
      window.location.replace("/");
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="ml-3 text-sm text-muted-foreground">Completing Google Sign-In…</p>
    </div>
  );
}
