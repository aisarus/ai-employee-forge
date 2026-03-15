import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Hammer, Mail, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/hooks/useI18n";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useI18n();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success(t("auth.welcome_back"));
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success(t("auth.check_email"));
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background dot-grid p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/80 backdrop-blur-2xl p-8 shadow-2xl shadow-black/40 animate-fade-in">
        <div className="text-center space-y-3 mb-6">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-[0_0_20px_hsl(var(--primary)/0.4)]">
              <Hammer className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {isLogin ? t("auth.welcome") : t("auth.create_account")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isLogin ? t("auth.sign_in_desc") : t("auth.sign_up_desc")}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
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
          <button
            type="submit"
            className="btn-gradient w-full h-11 rounded-xl text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
            disabled={loading}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin relative z-10" />}
            <span className="relative z-10">{isLogin ? t("auth.sign_in") : t("auth.create_account")}</span>
          </button>
        </form>
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            {isLogin ? t("auth.sign_up_link") : t("auth.sign_in_link")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
