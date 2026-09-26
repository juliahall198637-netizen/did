import { createServerFn } from "@tanstack/react-start";
import type { DidSettings } from "@/lib/did-settings";

// Must match AGENT_NAME in agent/src/agent.ts.
const LIVEKIT_AGENT_NAME = "persian-avatar";
const SESSION_TTL = "15m";

// Settings the agent worker reads from its dispatch metadata. Nothing secret
// belongs here: the metadata is part of the visitor's access token.
export type AgentSessionConfig = {
  didAgentId: string;
  instructions: string;
  greeting: string;
  llmModel: string;
  ttsVoice: string;
  sttModel?: string;
};

function livekitEnv() {
  const url = process.env["LIVEKIT_URL"] ?? "";
  const apiKey = process.env["LIVEKIT_API_KEY"] ?? "";
  const apiSecret = process.env["LIVEKIT_API_SECRET"] ?? "";
  return url && apiKey && apiSecret ? { url, apiKey, apiSecret } : null;
}

async function loadSttModel() {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("openai_settings")
      .select("stt_model")
      .eq("singleton", true)
      .maybeSingle();
    return data?.stt_model || undefined;
  } catch {
    return undefined;
  }
}

async function loadAgentConfig(): Promise<AgentSessionConfig | null> {
  const { LIVEKIT_DEFAULTS, fetchDidSettings } = await import("@/lib/did-settings");
  let settings: Partial<DidSettings> = LIVEKIT_DEFAULTS;
  try {
    settings = (await fetchDidSettings()) ?? LIVEKIT_DEFAULTS;
  } catch (error) {
    console.error("[livekit] reading did_settings failed", error);
  }
  // DID_AGENT_ID lets the agent run before anything is saved in the panel.
  const didAgentId = settings.livekit_agent_id || process.env["DID_AGENT_ID"] || "";
  if (!didAgentId) return null;
  const sttModel = await loadSttModel();
  return {
    didAgentId,
    instructions: settings.instructions ?? LIVEKIT_DEFAULTS.instructions,
    greeting: settings.greeting ?? LIVEKIT_DEFAULTS.greeting,
    llmModel: settings.llm_model ?? LIVEKIT_DEFAULTS.llm_model,
    ttsVoice: settings.tts_voice ?? LIVEKIT_DEFAULTS.tts_voice,
    ...(sttModel ? { sttModel } : {}),
  };
}

export const getLiveKitStatus = createServerFn({ method: "GET" }).handler(async () => {
  const env = livekitEnv();
  let agentIdSet = false;
  try {
    agentIdSet = Boolean(await loadAgentConfig());
  } catch {
    agentIdSet = false;
  }
  return { configured: Boolean(env), agentIdSet, enabled: Boolean(env) && agentIdSet };
});

export const createLiveKitSession = createServerFn({ method: "POST" }).handler(async () => {
  const env = livekitEnv();
  if (!env) {
    return { ok: false as const, message: "LiveKit روی سرور تنظیم نشده است." };
  }
  const config = await loadAgentConfig();
  if (!config) {
    return { ok: false as const, message: "شناسه ایجنت D-ID برای LiveKit در پنل ثبت نشده است." };
  }

  const { AccessToken, RoomAgentDispatch, RoomConfiguration } = await import("livekit-server-sdk");
  const roomName = `persian-avatar-${crypto.randomUUID()}`;
  const identity = `visitor-${crypto.randomUUID().slice(0, 8)}`;
  const token = new AccessToken(env.apiKey, env.apiSecret, {
    identity,
    name: "کاربر",
    ttl: SESSION_TTL,
  });
  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  // Joining the room dispatches our agent worker with these settings.
  token.roomConfig = new RoomConfiguration({
    agents: [
      new RoomAgentDispatch({ agentName: LIVEKIT_AGENT_NAME, metadata: JSON.stringify(config) }),
    ],
  });

  return { ok: true as const, serverUrl: env.url, token: await token.toJwt() };
});
