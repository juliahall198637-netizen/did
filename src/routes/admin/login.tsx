import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/admin/login")({
  ssr: false,
  component: AdminLogin,
  head: () => ({
    meta: [
      { title: "ورود مدیر | دستیار آواتار فارسی" },
      { name: "description", content: "ورود مدیر برای تنظیم آواتار D-ID." },
      { property: "og:title", content: "ورود مدیر" },
      { property: "og:description", content: "ورود مدیر برای تنظیم آواتار D-ID." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/admin", replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/admin` },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage("حساب ساخته شد. برای فعال‌سازی، ایمیل تأیید را باز کنید.");
        } else {
          navigate({ to: "/admin", replace: true });
        }
      }
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main dir="rtl" className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{mode === "signin" ? "ورود مدیر" : "ساخت حساب مدیر"}</CardTitle>
          <CardDescription>این بخش فقط برای مدیر سامانه است.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">ایمیل</Label>
              <Input
                id="email"
                type="email"
                dir="ltr"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">رمز عبور</Label>
              <Input
                id="password"
                type="password"
                dir="ltr"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "لطفاً صبر کنید…" : mode === "signin" ? "ورود" : "ثبت‌نام"}
            </Button>
            <button
              type="button"
              className="w-full text-xs text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setMessage(null);
              }}
            >
              {mode === "signin" ? "هنوز حساب ندارید؟ ثبت‌نام" : "حساب دارید؟ ورود"}
            </button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
