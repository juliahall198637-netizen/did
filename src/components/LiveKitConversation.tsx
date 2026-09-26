import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  VideoTrack,
  useLocalParticipant,
  useTranscriptions,
  useVoiceAssistant,
} from "@livekit/components-react";
import { MediaDeviceFailure } from "livekit-client";
import { Check, Clipboard, Loader2, Mic, MicOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createLiveKitSession } from "@/lib/livekit.functions";

type Connection = { serverUrl: string; token: string };

// The avatar needs a few seconds to join; after this the agent worker is
// probably not running or its keys are wrong.
const AGENT_JOIN_TIMEOUT_MS = 30_000;
const WAITING_STATES = new Set(["connecting", "pre-connect-buffering", "initializing"]);

const STATE_TEXT: Record<string, string> = {
  connecting: "در حال اتصال…",
  "pre-connect-buffering": "در حال اتصال…",
  initializing: "آواتار در حال آماده شدن است…",
  idle: "آماده است؛ صحبت کنید.",
  listening: "در حال شنیدن… صحبت کنید.",
  thinking: "در حال فکر کردن…",
  speaking: "آواتار در حال پاسخ است…",
  failed: "ایجنت پاسخ نداد. دوباره شروع کنید.",
};

function microphoneMessage(failure?: MediaDeviceFailure) {
  if (failure === MediaDeviceFailure.PermissionDenied) {
    return "دسترسی میکروفون بسته است. آن را از تنظیمات کنار نوار آدرس مجاز کنید.";
  }
  if (failure === MediaDeviceFailure.NotFound) return "میکروفونی پیدا نشد.";
  if (failure === MediaDeviceFailure.DeviceInUse) return "میکروفون در اختیار برنامه دیگری است.";
  return "میکروفون شروع نشد. صفحه را تازه کنید و دوباره بزنید.";
}

// Full-screen conversation with the D-ID avatar through a LiveKit room. The
// agent worker (agent/ folder) does speech-to-text, the AI reply and speech.
export function LiveKitConversation() {
  const createSession = useServerFn(createLiveKitSession);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const result = await createSession();
      if (result.ok) setConnection({ serverUrl: result.serverUrl, token: result.token });
      else setError(result.message);
    } catch (caught) {
      setError(`شروع مکالمه ناموفق بود: ${(caught as Error).message}`);
    } finally {
      setStarting(false);
    }
  }

  const active = connection !== null;

  return (
    <LiveKitRoom
      serverUrl={connection?.serverUrl}
      token={connection?.token}
      connect={active}
      audio={
        active ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false
      }
      video={false}
      onConnected={() => setError(null)}
      onDisconnected={() => setConnection(null)}
      onError={(caught) => setError(`خطای اتصال: ${caught.message}`)}
      onMediaDeviceFailure={(failure) => setError(microphoneMessage(failure))}
      className="absolute inset-0"
    >
      <AvatarStage active={active} />
      <RoomAudioRenderer />
      <ConversationPanel
        active={active}
        starting={starting}
        error={error}
        onStart={() => void start()}
        onStop={() => setConnection(null)}
      />
    </LiveKitRoom>
  );
}

function AvatarStage({ active }: { active: boolean }) {
  const { videoTrack } = useVoiceAssistant();
  if (videoTrack) {
    return <VideoTrack trackRef={videoTrack} className="h-full w-full object-contain" />;
  }
  return (
    <div className="flex h-full w-full items-center justify-center pb-40">
      <p className="text-sm text-muted-foreground">
        {active ? "در حال آماده شدن آواتار…" : "برای گفتگو با آواتار، «شروع مکالمه» را بزنید."}
      </p>
    </div>
  );
}

type PanelProps = {
  active: boolean;
  starting: boolean;
  error: string | null;
  onStart: () => void;
  onStop: () => void;
};

function ConversationPanel({ active, starting, error, onStart, onStop }: PanelProps) {
  const { state } = useVoiceAssistant();
  const { localParticipant } = useLocalParticipant();
  const transcriptions = useTranscriptions();
  const [hiddenCount, setHiddenCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [agentMissing, setAgentMissing] = useState(false);

  const waiting = active && WAITING_STATES.has(state);
  useEffect(() => {
    setAgentMissing(false);
    if (!waiting) return;
    const timer = window.setTimeout(() => setAgentMissing(true), AGENT_JOIN_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [waiting]);

  const lines = transcriptions
    .slice(hiddenCount)
    .filter((item) => item.text.trim())
    .map((item) => ({
      id: item.streamInfo.id,
      speaker: item.participantInfo.identity === localParticipant.identity ? "شما" : "آواتار",
      text: item.text.trim(),
    }));
  const transcript = lines.map((line) => `${line.speaker}: ${line.text}`).join("\n");

  async function copyNotes() {
    if (!transcript) return;
    await navigator.clipboard.writeText(transcript);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  const status = starting
    ? "در حال آماده‌سازی مکالمه…"
    : agentMissing
      ? "آواتار وصل نشد. پروسه ایجنت اجرا نیست یا کلیدهای OpenAI/D-ID آن نادرست است."
      : active
        ? (STATE_TEXT[state] ?? "در حال اتصال…")
        : "برای شروع، دکمه «شروع مکالمه» را بزنید.";

  return (
    <section
      dir="rtl"
      aria-label="یادداشت گفتگو"
      className="absolute inset-x-3 bottom-3 z-20 mx-auto max-w-2xl rounded-md border border-border/70 bg-background/90 shadow-lg backdrop-blur-md sm:bottom-5"
    >
      <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2">
        <Button
          type="button"
          size="lg"
          variant={active ? "destructive" : "default"}
          onClick={active ? onStop : onStart}
          disabled={starting}
          className={`flex-1 text-base ${state === "listening" ? "animate-pulse" : ""}`}
        >
          {starting ? <Loader2 className="animate-spin" /> : active ? <MicOff /> : <Mic />}
          {active ? "پایان مکالمه" : "شروع مکالمه"}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={copyNotes}
          disabled={!transcript}
          aria-label="کپی گفتگو"
          title="کپی گفتگو"
        >
          {copied ? <Check /> : <Clipboard />}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => setHiddenCount(transcriptions.length)}
          disabled={!transcript}
          aria-label="پاک‌کردن گفتگو"
          title="پاک‌کردن گفتگو"
        >
          <Trash2 />
        </Button>
      </div>
      <div className="flex items-center justify-between gap-2 px-4 pt-2">
        <p className="text-xs text-muted-foreground">{status}</p>
        <StartAudio
          label="فعال‌کردن صدا"
          className="rounded-md border border-border px-2 py-1 text-xs"
        />
      </div>
      <div
        aria-live="polite"
        className="max-h-28 min-h-14 overflow-y-auto px-4 py-3 text-sm leading-7"
      >
        {error && <p className="text-destructive">{error}</p>}
        {lines.length > 0
          ? lines.map((line) => (
              <p key={line.id} className="text-foreground">
                <span className="font-medium text-muted-foreground">{line.speaker}: </span>
                {line.text}
              </p>
            ))
          : !error && <p className="text-muted-foreground">گفتگوی شما اینجا نوشته می‌شود.</p>}
      </div>
    </section>
  );
}
