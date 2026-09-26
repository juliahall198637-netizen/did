-- Settings for the LiveKit voice agent (speech-to-text, AI reply, text-to-speech
-- and the D-ID expressive avatar). None of these values are secret; API keys
-- stay in environment variables of the web app and the agent worker.
alter table public.did_settings
  add column livekit_agent_id text not null default '',
  add column instructions text not null default
    'تو یک دستیار صوتی فارسی‌زبان، مهربان و دقیق هستی. همیشه به فارسی محاوره‌ای و کوتاه جواب بده؛ پاسخ‌ها برای شنیدن هستند، پس از فهرست، علامت‌های نگارشی خاص و ایموجی استفاده نکن.',
  add column greeting text not null default 'سلام، در خدمتم. چطور می‌تونم کمکتون کنم؟',
  add column llm_model text not null default 'gpt-4.1-mini',
  add column tts_voice text not null default 'alloy';
