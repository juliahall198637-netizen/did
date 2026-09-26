import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DID_SETTINGS_QUERY_KEY, type DidSettings } from "@/lib/did-settings";
import { saveDidSettings } from "@/lib/did.functions";
import { getLiveKitStatus } from "@/lib/livekit.functions";

const LLM_MODELS = ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini", "gpt-5-mini"];
const TTS_VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage"];
const LIVEKIT_STATUS_QUERY_KEY = ["livekit-status"] as const;

type Fields = Pick<
  DidSettings,
  "livekit_agent_id" | "instructions" | "greeting" | "llm_model" | "tts_voice"
>;

export function LiveKitSettingsCard({ settings }: { settings: DidSettings }) {
  const queryClient = useQueryClient();
  const runStatus = useServerFn(getLiveKitStatus);
  const runSave = useServerFn(saveDidSettings);
  const [fields, setFields] = useState<Fields>({
    livekit_agent_id: settings.livekit_agent_id,
    instructions: settings.instructions,
    greeting: settings.greeting,
    llm_model: settings.llm_model,
    tts_voice: settings.tts_voice,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const status = useQuery({
    queryKey: LIVEKIT_STATUS_QUERY_KEY,
    queryFn: () => runStatus(),
    retry: false,
  });

  function update<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function onSave() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await runSave({ data: fields });
      if (result.ok) {
        await queryClient.invalidateQueries({ queryKey: DID_SETTINGS_QUERY_KEY });
        await queryClient.invalidateQueries({ queryKey: LIVEKIT_STATUS_QUERY_KEY });
      }
      setMessage(result.message);
    } catch (error) {
      setMessage(`ذخیره ناموفق بود: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const mode = status.data?.enabled
    ? "فعال: صفحه اصلی با LiveKit کار می‌کند."
    : status.data?.configured
      ? "LiveKit روی سرور تنظیم شده؛ برای فعال‌شدن، شناسه ایجنت D-ID را ذخیره کنید."
      : "غیرفعال: متغیرهای LIVEKIT_URL، LIVEKIT_API_KEY و LIVEKIT_API_SECRET روی سرور تنظیم نشده‌اند. صفحه اصلی از embed فعلی D-ID استفاده می‌کند.";

  return (
    <Card>
      <CardHeader>
        <CardTitle>ایجنت صوتی LiveKit</CardTitle>
        <CardDescription>
          گفتار فارسی کاربر به متن تبدیل می‌شود، هوش مصنوعی پاسخ می‌دهد و آواتار D-ID پاسخ را با صدا
          و حرکت لب اجرا می‌کند. کلیدهای OpenAI و D-ID در متغیرهای محیطی پروسه ایجنت (پوشه agent)
          تنظیم می‌شوند.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          وضعیت: {status.isLoading ? "در حال بررسی…" : mode}
        </p>

        <div className="space-y-2">
          <Label htmlFor="livekit_agent_id">شناسه ایجنت D-ID (نوع expressive / v4)</Label>
          <Input
            id="livekit_agent_id"
            dir="ltr"
            placeholder="v2_agt_..."
            value={fields.livekit_agent_id}
            onChange={(e) => update("livekit_agent_id", e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            این ایجنت با ایجنت embed فرق دارد و باید با API سرویس D-ID و presenter از نوع expressive
            ساخته شود.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="instructions">دستورالعمل ایجنت</Label>
          <Textarea
            id="instructions"
            rows={4}
            value={fields.instructions}
            onChange={(e) => update("instructions", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="greeting">جمله خوشامد (خالی = بدون خوشامد)</Label>
          <Input
            id="greeting"
            value={fields.greeting}
            onChange={(e) => update("greeting", e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="llm_model">مدل پاسخ‌دهی</Label>
            <Input
              id="llm_model"
              dir="ltr"
              list="llm_models"
              value={fields.llm_model}
              onChange={(e) => update("llm_model", e.target.value)}
            />
            <datalist id="llm_models">
              {LLM_MODELS.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tts_voice">صدای آواتار</Label>
            <Input
              id="tts_voice"
              dir="ltr"
              list="tts_voices"
              value={fields.tts_voice}
              onChange={(e) => update("tts_voice", e.target.value)}
            />
            <datalist id="tts_voices">
              {TTS_VOICES.map((voice) => (
                <option key={voice} value={voice} />
              ))}
            </datalist>
          </div>
        </div>

        <Button onClick={onSave} disabled={busy}>
          {busy ? "در حال ذخیره…" : "ذخیره تنظیمات LiveKit"}
        </Button>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </CardContent>
    </Card>
  );
}
