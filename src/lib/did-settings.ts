import { supabase } from "@/integrations/supabase/client";

export type DidSettings = {
  id: string;
  client_key: string;
  agent_id: string;
  embed_script_url: string;
  mode: string;
  name: string;
  monitor: boolean;
  light_mode: boolean;
  orientation: string;
  position: string;
  open_mode: string;
  livekit_agent_id: string;
  instructions: string;
  greeting: string;
  llm_model: string;
  tts_voice: string;
};

// Used until the LiveKit migration has added these columns.
export const LIVEKIT_DEFAULTS = {
  livekit_agent_id: "",
  instructions:
    "تو یک دستیار صوتی فارسی‌زبان، مهربان و دقیق هستی. همیشه به فارسی محاوره‌ای و کوتاه جواب بده؛ پاسخ‌ها برای شنیدن هستند، پس از فهرست، علامت‌های نگارشی خاص و ایموجی استفاده نکن.",
  greeting: "سلام، در خدمتم. چطور می‌تونم کمکتون کنم؟",
  llm_model: "gpt-4.1-mini",
  tts_voice: "alloy",
} satisfies Partial<DidSettings>;

export const DID_SETTINGS_QUERY_KEY = ["did-settings"] as const;

export async function fetchDidSettings(): Promise<DidSettings | null> {
  // "*" keeps the page working whether or not newer columns exist yet.
  const { data, error } = await supabase.from("did_settings").select("*").limit(1).maybeSingle();
  if (error) throw error;
  return data ? ({ ...LIVEKIT_DEFAULTS, ...data } as DidSettings) : null;
}
