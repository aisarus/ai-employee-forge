import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Hammer, Mail, Lock, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/hooks/useI18n";

type AuthMode = "login" | "signup" | "forgot" | "reset";

const Auth = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const navigate = useNavigate();
  const { t } = useI18n();

  // Detect Supabase PASSWORD_RECOVERY event (user clicked reset link in email)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success(t("auth.welcome_back"));
        navigate("/");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success(t("auth.check_email"));
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        setResetEmailSent(true);
      } else if (mode === "reset") {
        if (newPassword.length < 6) throw new Error("Password must be at least 6 characters.");
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        toast.success("Password updated successfully!");
        navigate("/");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const title =
    mode === "login"  ? t("auth.welcome") :
    mode === "signup" ? t("auth.create_account") :
    mode === "forgot" ? "Reset your password" :
                        "Set new password";

  const desc =
    mode === "login"  ? t("auth.sign_in_desc") :
    mode === "signup" ? t("auth.sign_up_desc") :
    mode === "forgot" ? "Enter your email and we'll send you a reset link." :
                        "Choose a new password for your account.";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background dot-grid p-6 overflow-hidden">
      {/* Aurora background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="aurora-orb aurora-orb-1" />
        <div className="aurora-orb aurora-orb-2" />
        <div className="aurora-orb aurora-orb-3" />
      </div>

      <div className="w-full max-w-md rounded-2xl border border-border bg-card/80 backdrop-blur-2xl p-8 shadow-2xl shadow-black/40 animate-step-enter relative z-10">
        <div className="text-center space-y-3 mb-6">
          <div className="flex justify-center animate-fade-up" style={{ animationDelay: "60ms" }}>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-[0_0_20px_hsl(var(--primary)/0.4)]">
              <Hammer className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground animate-fade-up" style={{ animationDelay: "120ms" }}>{title}</h1>
          <p className="text-sm text-muted-foreground animate-fade-up" style={{ animationDelay: "160ms" }}>{desc}</p>
        </div>

        {/* ── Forgot password: success state ── */}
        {mode === "forgot" && resetEmailSent ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-foreground">
              Check your inbox — we sent a reset link to <strong>{email}</strong>.
            </p>
            <button
              type="button"
              onClick={() => { setMode("login"); setResetEmailSent(false); }}
              className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 mx-auto"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 animate-fade-up" style={{ animationDelay: "200ms" }}>
            {/* Email — shown on login, signup, forgot */}
            {mode !== "reset" && (
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-10 bg-background/50"
                    required
                  />
                </div>
              </div>
            )}

            {/* Password — shown on login and signup */}
            {(mode === "login" || mode === "signup") && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t("auth.password")}</Label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 bg-background/50"
                    minLength={6}
                    required
                  />
                </div>
              </div>
            )}

            {/* New password — shown on reset */}
            {mode === "reset" && (
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 bg-background/50"
                    minLength={6}
                    required
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              className="btn-gradient w-full h-11 rounded-xl text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
              disabled={loading}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin relative z-10" />}
              <span className="relative z-10">
                {mode === "login"  ? t("auth.sign_in") :
                 mode === "signup" ? t("auth.create_account") :
                 mode === "forgot" ? "Send reset link" :
                                     "Update password"}
              </span>
            </button>
          </form>
        )}

        {/* ── Bottom links ── */}
        {!resetEmailSent && (
          <div className="mt-4 text-center space-y-2">
            {(mode === "login" || mode === "signup") && (
              <button
                type="button"
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
                className="text-sm text-muted-foreground hover:text-primary transition-colors block w-full"
              >
                {mode === "login" ? t("auth.sign_up_link") : t("auth.sign_in_link")}
              </button>
            )}
            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 mx-auto"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to sign in
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Auth;
