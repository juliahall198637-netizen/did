import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { parseInput } from "@/lib/validation";

export const STT_MODELS = ["gpt-4o-transcribe", "gpt-4o-mini-transcribe", "whisper-1"] as const;
const DEFAULT_STT_MODEL = "gpt-4o-transcribe";

const MIN_AUDIO_BYTES = 1_000;
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

// A short sample of well-written Persian nudges the model toward Persian
// script and correct spacing instead of Arabic letters or Finglish.
const TRANSCRIBE_PROMPT = "سلام، حالت چطوره؟ می‌خواهم درباره‌ی کارهای امروزم صحبت کنم.";

// Phrases speech models are known to invent on near-silent audio.
const HALLUCINATIONS = [/^(ترجمه و )?زیرنویس/, /subtitles? by/i, /thanks? for watching/i];

type OpenAiConfig = {
  apiKey: string;
  model: string;
  source: "panel" | "env" | null;
  tableReady: boolean;
};

export type TranscribeResult = { ok: true; text: string } | { ok: false; message: string };

function openAiBaseUrl() {
  return (process.env["OPENAI_BASE_URL"] || "https://api.openai.com/v1").replace(/\/+$/, "");
}

async function loadOpenAiConfig(): Promise<OpenAiConfig> {
  let row: { api_key: string; stt_model: string } | null = null;
  let tableReady = true;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("openai_settings")
      .select("api_key, stt_model")
      .eq("singleton", true)
      .maybeSingle();
    if (error) throw error;
    row = data;
  } catch (error) {
    tableReady = false;
    console.error("[openai] reading openai_settings failed", error);
  }

  const model = row?.stt_model || process.env["OPENAI_STT_MODEL"] || DEFAULT_STT_MODEL;
  if (row?.api_key) return { apiKey: row.api_key, model, source: "panel", tableReady };
  const envKey = process.env["OPENAI_API_KEY"] ?? "";
  return { apiKey: envKey, model, source: envKey ? "env" : null, tableReady };
}

function maskKey(key: string) {
  if (key.length <= 10) return "••••";
  return `${key.slice(0, 3)}…${key.slice(-4)}`;
}

function describeOpenAiError(status: number, body: string) {
  let detail = "";
  try {
    detail = (JSON.parse(body) as { error?: { message?: string } })?.error?.message ?? "";
  } catch {
    detail = body;
  }
  if (status === 401) return "کلید OpenAI نامعتبر است.";
  if (status === 403) return "OpenAI دسترسی را رد کرد (منطقه پشتیبانی نمی‌شود یا کلید مجوز ندارد).";
  if (status === 404) return "مدل انتخاب‌شده در حساب OpenAI در دسترس نیست.";
  if (status === 429) return "سقف درخواست یا اعتبار حساب OpenAI تمام شده است.";
  return `خطای OpenAI (${status})${detail ? `: ${detail.slice(0, 200)}` : ""}`;
}

function cleanPersianTranscript(text: string) {
  const normalized = text.replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/\s+/g, " ").trim();
  if (!normalized || normalized.includes(TRANSCRIBE_PROMPT)) return "";
  if (normalized.length < 60 && HALLUCINATIONS.some((pattern) => pattern.test(normalized))) {
    return "";
  }
  return normalized;
}

function audioFileName(type: string) {
  if (/mp4|m4a|aac/.test(type)) return "speech.mp4";
  if (type.includes("ogg")) return "speech.ogg";
  if (type.includes("wav")) return "speech.wav";
  if (/mpeg|mp3/.test(type)) return "speech.mp3";
  return "speech.webm";
}

export const getOpenAiStatus = createServerFn({ method: "GET" }).handler(async () => {
  const config = await loadOpenAiConfig();
  return {
    configured: Boolean(config.apiKey),
    masked: config.apiKey ? maskKey(config.apiKey) : null,
    source: config.source,
    model: config.model,
    tableReady: config.tableReady,
  };
});

const saveSchema = z.object({
  apiKey: z
    .string()
    .trim()
    .max(400)
    .refine((value) => value === "" || /^sk-[A-Za-z0-9_-]{16,}$/.test(value), {
      message: "کلید OpenAI باید با sk- شروع شود.",
    }),
  model: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/, "نام مدل معتبر نیست."),
  clearKey: z.boolean().default(false),
});

export const saveOpenAiSettings = createServerFn({ method: "POST" })
  .inputValidator((data: z.input<typeof saveSchema>) => parseInput(saveSchema, data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const values: { singleton: true; stt_model: string; api_key?: string } = {
      singleton: true,
      stt_model: data.model,
    };
    if (data.clearKey) values.api_key = "";
    else if (data.apiKey) values.api_key = data.apiKey;

    const { error } = await supabaseAdmin
      .from("openai_settings")
      .upsert(values, { onConflict: "singleton" });
    if (error) {
      console.error("[openai] saving openai_settings failed", error);
      return {
        ok: false,
        message: "ذخیره ناموفق بود. جدول openai_settings ساخته نشده است؛ migration را اجرا کنید.",
      };
    }
    return {
      ok: true,
      message: data.clearKey ? "کلید OpenAI حذف شد." : "تنظیمات OpenAI ذخیره شد.",
    };
  });

export const testOpenAiConnection = createServerFn({ method: "POST" }).handler(async () => {
  const config = await loadOpenAiConfig();
  if (!config.apiKey) return { ok: false, message: "کلید OpenAI ثبت نشده است." };
  try {
    const res = await fetch(`${openAiBaseUrl()}/models/${encodeURIComponent(config.model)}`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    if (!res.ok) return { ok: false, message: describeOpenAiError(res.status, await res.text()) };
    return { ok: true, message: `اتصال به OpenAI برقرار است. مدل: ${config.model}` };
  } catch (error) {
    return { ok: false, message: `ارتباط با OpenAI برقرار نشد: ${(error as Error).message}` };
  }
});

export const transcribePersianAudio = createServerFn({ method: "POST" })
  .inputValidator((data: FormData) => {
    if (!(data instanceof FormData)) throw new Error("ورودی باید فایل صوتی باشد.");
    const audio = data.get("audio");
    if (!audio || typeof audio === "string") throw new Error("فایل صوتی ارسال نشده است.");
    if (audio.type && !/^(audio|video)\//.test(audio.type)) {
      throw new Error("نوع فایل صوتی پشتیبانی نمی‌شود.");
    }
    if (audio.size < MIN_AUDIO_BYTES) throw new Error("صدای ضبط‌شده خیلی کوتاه است.");
    if (audio.size > MAX_AUDIO_BYTES) throw new Error("صدای ضبط‌شده خیلی طولانی است.");
    return audio;
  })
  .handler(async ({ data: audio }): Promise<TranscribeResult> => {
    const config = await loadOpenAiConfig();
    if (!config.apiKey) {
      return { ok: false, message: "کلید OpenAI در پنل مدیریت ثبت نشده است." };
    }

    const body = new FormData();
    body.append("file", audio, audioFileName(audio.type));
    body.append("model", config.model);
    body.append("language", "fa");
    body.append("prompt", TRANSCRIBE_PROMPT);
    body.append("response_format", "json");

    try {
      const res = await fetch(`${openAiBaseUrl()}/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}` },
        body,
      });
      const raw = await res.text();
      if (!res.ok) return { ok: false, message: describeOpenAiError(res.status, raw) };
      const parsed = JSON.parse(raw) as { text?: string };
      return { ok: true, text: cleanPersianTranscript(parsed.text ?? "") };
    } catch (error) {
      return { ok: false, message: `ارتباط با OpenAI برقرار نشد: ${(error as Error).message}` };
    }
  });
