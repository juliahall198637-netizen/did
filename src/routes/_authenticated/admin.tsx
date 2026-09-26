import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DID_SETTINGS_QUERY_KEY, fetchDidSettings, saveDidSettings } from "@/lib/did-settings";
import type { DidSettings } from "@/lib/did-settings";
import { getDidKeyStatus, testDidConnection } from "@/lib/did.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPanel,
  head: () => ({
    meta: [
      { title: "پنل مدیریت آواتار | دستیار آواتار فارسی" },
      { name: "description", content: "مدیریت تنظیمات ایجنت D-ID و تست اتصال." },
      { property: "og:title", content: "پنل مدیریت آواتار" },
      { property: "og:description", content: "مدیریت تنظیمات ایجنت D-ID و تست اتصال." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const TEXT_FIELDS: { key: keyof DidSettings; label: string; ltr?: boolean }[] = [
  { key: "client_key", label: "Client Key", ltr: true },
  { key: "agent_id", label: "Agent ID", ltr: true },
  {
    key: "embed_script_url",
    label: "Embed Script URL (باید https://agent.d-id.com/v2/index.js باشد)",
    ltr: true,
  },

  { key: "mode", label: "Mode", ltr: true },
  { key: "name", label: "Name", ltr: true },
  { key: "orientation", label: "Orientation", ltr: true },
  { key: "position", label: "Position", ltr: true },
  { key: "open_mode", label: "Open Mode", ltr: true },
];

const CORRECT_SCRIPT_URL = "https://agent.d-id.com/v2/index.js";
const PUBLISHED_ORIGIN = "https://persian-voice-companion.lovable.app";

function AdminPanel() {
  const navigate = useNavigate();
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const queryClient = useQueryClient();
  const [form, setForm] = useState<DidSettings | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [agentTestMsg, setAgentTestMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const settingsQuery = useQuery({
    queryKey: DID_SETTINGS_QUERY_KEY,
    queryFn: fetchDidSettings,
  });

  const runKeyStatus = useServerFn(getDidKeyStatus);
  const runTest = useServerFn(testDidConnection);

  const keyStatus = useQuery({
    queryKey: ["did-key-status"],
    queryFn: () => runKeyStatus(),
    retry: false,
  });

  useEffect(() => {
    if (settingsQuery.data && !form) setForm(settingsQuery.data);
  }, [settingsQuery.data, form]);

  const isAdmin = !keyStatus.isError;

  async function onSave() {
    if (!form) return;
    setBusy(true);
    setSaveMsg(null);
    try {
      const { id, ...values } = form;
      await saveDidSettings(id, values);
      await queryClient.invalidateQueries({ queryKey: DID_SETTINGS_QUERY_KEY });
      setSaveMsg("تنظیمات ذخیره شد.");
    } catch (error) {
      setSaveMsg(`ذخیره ناموفق بود: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function onTestConnection() {
    setTestMsg("در حال بررسی…");
    try {
      const result = await runTest();
      setTestMsg(result.message);
    } catch (error) {
      setTestMsg((error as Error).message);
    }
  }

  function onTestAgentLoad() {
    if (!form?.embed_script_url) {
      setAgentTestMsg("آدرس اسکریپت وارد نشده است.");
      return;
    }
    setAgentTestMsg("در حال بارگذاری…");
    const script = document.createElement("script");
    script.type = "module";
    script.src = form.embed_script_url;
    script.onload = () => {
      setAgentTestMsg("اسکریپت ایجنت با موفقیت بارگذاری شد.");
      script.remove();
    };
    script.onerror = () => {
      setAgentTestMsg("بارگذاری اسکریپت ایجنت ناموفق بود.");
      script.remove();
    };
    document.body.appendChild(script);
  }

  async function onSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/admin/login", replace: true });
  }

  if (settingsQuery.isLoading || keyStatus.isLoading) {
    return (
      <main dir="rtl" className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main dir="rtl" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4">
        <p className="text-sm text-muted-foreground">شما دسترسی مدیر ندارید.</p>
        <Button variant="outline" onClick={onSignOut}>
          خروج
        </Button>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">پنل مدیریت آواتار</h1>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => navigate({ to: "/" })}>
              مشاهده آواتار
            </Button>
            <Button variant="outline" onClick={onSignOut}>
              خروج
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>اتصال سرویس D-ID</CardTitle>
            <CardDescription>کلید API روی سرور ذخیره می‌شود و در صفحه عمومی دیده نمی‌شود.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              وضعیت کلید API: {keyStatus.data?.configured ? "ذخیره شده" : "ذخیره نشده"}
            </p>
            <Button variant="secondary" onClick={onTestConnection}>
              تست اتصال API
            </Button>
            {testMsg && <p className="text-sm text-muted-foreground">{testMsg}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>دامنه‌های مجاز در D-ID</CardTitle>
            <CardDescription>
              این آدرس‌ها را در پنل D-ID، بخش Manage Embed → Allowed Domains اضافه کنید. آدرس اسکریپت
              را به‌عنوان دامنه وارد نکنید.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[origin, PUBLISHED_ORIGIN].filter(Boolean).map((d) => (
              <div key={d} className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
                <code dir="ltr" className="text-xs">{d}</code>
                <Button size="sm" variant="ghost" onClick={() => void navigator.clipboard.writeText(d)}>
                  کپی
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ایجنت D-ID</CardTitle>
            <CardDescription>با تغییر این مقادیر، آواتار بدون تغییر کد عوض می‌شود.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {form &&
              TEXT_FIELDS.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <Input
                    id={field.key}
                    dir={field.ltr ? "ltr" : "rtl"}
                    value={String(form[field.key] ?? "")}
                    onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  />
                  {field.key === "embed_script_url" &&
                    form.embed_script_url !== CORRECT_SCRIPT_URL && (
                      <p className="text-xs text-destructive">
                        این آدرس درست نیست؛ باید دقیقاً {CORRECT_SCRIPT_URL} باشد.
                      </p>
                    )}
                </div>
              ))}

            {form && (
              <>
                <div className="flex items-center justify-between rounded-md border border-border p-3">
                  <Label htmlFor="monitor">Monitor</Label>
                  <Switch
                    id="monitor"
                    checked={form.monitor}
                    onCheckedChange={(v) => setForm({ ...form, monitor: v })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border p-3">
                  <Label htmlFor="light_mode">Light Mode</Label>
                  <Switch
                    id="light_mode"
                    checked={form.light_mode}
                    onCheckedChange={(v) => setForm({ ...form, light_mode: v })}
                  />
                </div>
              </>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={onSave} disabled={busy}>
                {busy ? "در حال ذخیره…" : "ذخیره تنظیمات"}
              </Button>
              <Button variant="secondary" onClick={onTestAgentLoad}>
                تست بارگذاری ایجنت
              </Button>
            </div>
            {saveMsg && <p className="text-sm text-muted-foreground">{saveMsg}</p>}
            {agentTestMsg && <p className="text-sm text-muted-foreground">{agentTestMsg}</p>}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
