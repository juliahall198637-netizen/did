// LiveKit voice agent for the Persian avatar: OpenAI speech-to-text (Persian),
// an OpenAI model for the reply, OpenAI text-to-speech, and a D-ID expressive
// avatar that lip-syncs the reply into the room.
//
// Secrets come from the environment: LIVEKIT_URL, LIVEKIT_API_KEY,
// LIVEKIT_API_SECRET, OPENAI_API_KEY, DID_API_KEY. Everything else is set in
// the web app's admin panel and arrives as the job's dispatch metadata.
import { fileURLToPath } from "node:url";
import { type JobContext, ServerOptions, cli, defineAgent, voice } from "@livekit/agents";
import * as did from "@livekit/agents-plugin-did";
import * as openai from "@livekit/agents-plugin-openai";

// Must match LIVEKIT_AGENT_NAME in src/lib/livekit.functions.ts of the web app.
const AGENT_NAME = "persian-avatar";

// Voice for the reply; the model otherwise tends to read Persian with an accent.
const TTS_STYLE =
  "Speak natural, warm, conversational Persian (Farsi) with a standard Tehrani accent.";

type SessionConfig = {
  didAgentId: string;
  instructions: string;
  greeting: string;
  llmModel: string;
  sttModel: string;
  ttsModel: string;
  ttsVoice: string;
  maxSessionMinutes: number;
};

function readConfig(metadata: string): SessionConfig {
  let fromPanel: Partial<Record<keyof SessionConfig, unknown>> = {};
  try {
    fromPanel = metadata ? JSON.parse(metadata) : {};
  } catch {
    console.warn("[agent] ignoring invalid dispatch metadata");
  }
  const text = (key: keyof SessionConfig, fallback: string) => {
    const value = fromPanel[key];
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
  };
  const env = process.env;
  return {
    didAgentId: text("didAgentId", env.DID_AGENT_ID ?? ""),
    instructions: text(
      "instructions",
      "تو یک دستیار صوتی فارسی‌زبان و مهربان هستی. همیشه به فارسی محاوره‌ای و کوتاه جواب بده.",
    ),
    greeting: text("greeting", ""),
    llmModel: text("llmModel", env.OPENAI_LLM_MODEL ?? "gpt-4.1-mini"),
    sttModel: text("sttModel", env.OPENAI_STT_MODEL ?? "gpt-4o-transcribe"),
    ttsModel: env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts",
    ttsVoice: text("ttsVoice", env.OPENAI_TTS_VOICE ?? "alloy"),
    maxSessionMinutes: Number(env.MAX_SESSION_MINUTES ?? 10) || 10,
  };
}

export default defineAgent({
  entry: async (ctx: JobContext) => {
    const config = readConfig(ctx.job.metadata);
    await ctx.connect();

    const session = new voice.AgentSession({
      stt: new openai.STT({ model: config.sttModel, language: "fa" }),
      llm: new openai.LLM({ model: config.llmModel }),
      tts: new openai.TTS({
        model: config.ttsModel,
        voice: config.ttsVoice as openai.TTSVoices,
        instructions: TTS_STYLE,
      }),
    });

    if (config.didAgentId) {
      const avatar = new did.AvatarSession({ agentId: config.didAgentId });
      await avatar.start(session, ctx.room);
    } else {
      console.warn("[agent] no D-ID agent id; running voice-only");
    }

    await session.start({
      agent: new voice.Agent({ instructions: config.instructions }),
      room: ctx.room,
    });

    if (config.greeting) session.say(config.greeting);

    // Every minute of a session costs OpenAI and D-ID credit; end forgotten tabs.
    const limit = setTimeout(
      () => ctx.shutdown("max session duration reached"),
      config.maxSessionMinutes * 60_000,
    );
    ctx.addShutdownCallback(async () => clearTimeout(limit));
  },
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url), agentName: AGENT_NAME }));
}
