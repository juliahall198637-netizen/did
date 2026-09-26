import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { parseInput } from "@/lib/validation";

// The embed script runs on the public page, so only D-ID's own script host is
// accepted; anything else could inject arbitrary code for every visitor.
const DID_SCRIPT_ORIGIN = "https://agent.d-id.com/";

const didSettingsSchema = z.object({
  client_key: z.string().trim().max(500),
  agent_id: z.string().trim().max(200),
  embed_script_url: z
    .string()
    .trim()
    .max(500)
    .refine((value) => value.startsWith(DID_SCRIPT_ORIGIN), {
      message: `آدرس اسکریپت باید با ${DID_SCRIPT_ORIGIN} شروع شود.`,
    }),
  mode: z.string().trim().max(50),
  name: z.string().trim().max(100),
  monitor: z.boolean(),
  light_mode: z.boolean(),
  orientation: z.string().trim().max(50),
  position: z.string().trim().max(50),
  open_mode: z.string().trim().max(50),
  // LiveKit voice agent
  livekit_agent_id: z.string().trim().max(200),
  instructions: z.string().trim().min(1, "دستورالعمل ایجنت خالی است.").max(4000),
  greeting: z.string().trim().max(500),
  llm_model: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/, "نام مدل معتبر نیست."),
  tts_voice: z
    .string()
    .trim()
    .regex(/^[a-z]{2,20}$/, "نام صدا معتبر نیست."),
});

// Each panel card saves only its own fields, so the D-ID embed card keeps
// working before the LiveKit migration has added its columns.
const saveSchema = didSettingsSchema.partial();

export const saveDidSettings = createServerFn({ method: "POST" })
  .inputValidator((data: z.input<typeof saveSchema>) => parseInput(saveSchema, data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const values = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    ) as TablesUpdate<"did_settings">;
    const { error } = await supabaseAdmin.from("did_settings").update(values).eq("singleton", true);
    if (error) {
      console.error("[did] saving did_settings failed", error);
      const missingColumn = /column|schema cache/i.test(error.message);
      return {
        ok: false,
        message: missingColumn
          ? "ذخیره ناموفق بود؛ migration ‎20260926170000_livekit_settings.sql را اجرا کنید."
          : `ذخیره ناموفق بود: ${error.message}`,
      };
    }
    return { ok: true, message: "تنظیمات ذخیره شد." };
  });

export const getDidKeyStatus = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env["DID_API_KEY"];
  return { configured: Boolean(key && key.length > 0) };
});

export const testDidConnection = createServerFn({ method: "POST" }).handler(async () => {
  const key = process.env["DID_API_KEY"];
  if (!key) {
    return { ok: false, message: "کلید API ذخیره نشده است." };
  }
  const auth = key.startsWith("Basic ") || key.startsWith("Bearer ") ? key : `Basic ${key}`;
  try {
    const res = await fetch("https://api.d-id.com/credits", {
      headers: { Authorization: auth, Accept: "application/json" },
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, message: `اتصال ناموفق (${res.status}): ${text.slice(0, 200)}` };
    }
    let remaining: number | null = null;
    try {
      const body = JSON.parse(text);
      remaining = body?.remaining ?? body?.total ?? null;
    } catch {
      remaining = null;
    }
    return {
      ok: true,
      message:
        remaining === null
          ? "اتصال به D-ID برقرار است."
          : `اتصال برقرار است. اعتبار باقی‌مانده: ${remaining}`,
    };
  } catch (error) {
    return {
      ok: false,
      message: `خطا در تماس با D-ID: ${(error as Error).message}`,
    };
  }
});
