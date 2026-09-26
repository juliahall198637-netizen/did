import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Clipboard, Loader2, Mic, MicOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { transcribePersianAudio } from "@/lib/openai.functions";
import {
  isVoiceRecordingSupported,
  startVoiceRecorder,
  type VoiceRecorder,
} from "@/lib/voice-recorder";

const START_EVENT = "persian-conversation-start";
const STOP_EVENT = "persian-conversation-stop";
const SPEAK_EVENT = "persian-user-utterance";
const AGENT_SPEAK_EVENT = "persian-agent-speak";

// Rough time the avatar needs to start and finish saying a text; the
// microphone ignores that window so the avatar's voice is not transcribed.
const AGENT_START_MS = 2_500;
const AGENT_MS_PER_CHAR = 80;
const AGENT_MAX_MS = 30_000;

type Phase = "idle" | "listening" | "hearing";

function fileNameFor(type: string) {
  if (type.includes("mp4")) return "speech.mp4";
  if (type.includes("ogg")) return "speech.ogg";
  return "speech.webm";
}

export function PersianSpeechNotes() {
  const transcribe = useServerFn(transcribePersianAudio);
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const agentUntilRef = useRef(0);
  const [supported, setSupported] = useState(true);
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [converting, setConverting] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSupported(isVoiceRecordingSupported());

    let agentTimer: number | null = null;
    const onAgentSpeak = (event: Event) => {
      const text = (event as CustomEvent<{ text?: string }>).detail?.text ?? "";
      const duration = Math.min(AGENT_MAX_MS, AGENT_START_MS + text.length * AGENT_MS_PER_CHAR);
      agentUntilRef.current = Math.max(agentUntilRef.current, performance.now() + duration);
      setAgentSpeaking(true);
      if (agentTimer !== null) window.clearTimeout(agentTimer);
      agentTimer = window.setTimeout(
        () => setAgentSpeaking(false),
        agentUntilRef.current - performance.now(),
      );
    };

    window.addEventListener(AGENT_SPEAK_EVENT, onAgentSpeak);
    return () => {
      window.removeEventListener(AGENT_SPEAK_EVENT, onAgentSpeak);
      if (agentTimer !== null) window.clearTimeout(agentTimer);
      recorderRef.current?.stop();
      recorderRef.current = null;
    };
  }, []);

  async function convertSegment(audio: Blob, recorder: VoiceRecorder) {
    const form = new FormData();
    form.append("audio", audio, fileNameFor(audio.type));
    try {
      const result = await transcribe({ data: form });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      if (!result.text) return;
      const text = result.text;
      setTranscript((current) => (current ? `${current}\n${text}` : text));
      // Only hand the text to the avatar if this conversation is still running.
      if (recorderRef.current === recorder) {
        window.dispatchEvent(new CustomEvent(SPEAK_EVENT, { detail: { text } }));
      }
    } catch (caught) {
      setError(`تبدیل صدا به متن ناموفق بود: ${(caught as Error).message}`);
    }
  }

  function enqueueSegment(audio: Blob, recorder: VoiceRecorder) {
    setConverting((count) => count + 1);
    // Convert one sentence at a time so the text keeps its spoken order.
    queueRef.current = queueRef.current
      .then(() => convertSegment(audio, recorder))
      .finally(() => setConverting((count) => count - 1));
  }

  async function startConversation() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      let recorder: VoiceRecorder;
      try {
        recorder = startVoiceRecorder(stream, {
          onSegment: (audio) => enqueueSegment(audio, recorder),
          onSpeechChange: (speaking) => setPhase(speaking ? "hearing" : "listening"),
          isPaused: () => performance.now() < agentUntilRef.current,
        });
      } catch (caught) {
        stream.getTracks().forEach((track) => track.stop());
        throw caught;
      }
      recorderRef.current = recorder;
      setActive(true);
      setPhase("listening");
      window.dispatchEvent(new Event(START_EVENT));
    } catch (caught) {
      const errorName = caught instanceof DOMException ? caught.name : "";
      setError(
        errorName === "NotAllowedError"
          ? "دسترسی میکروفون بسته است. آن را از تنظیمات کنار نوار آدرس مجاز کنید."
          : errorName === "NotFoundError"
            ? "میکروفونی پیدا نشد."
            : errorName === "NotReadableError"
              ? "میکروفون در اختیار برنامه دیگری است."
              : "میکروفون شروع نشد. صفحه را تازه کنید و دوباره بزنید.",
      );
    }
  }

  function stopConversation() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setActive(false);
    setPhase("idle");
    window.dispatchEvent(new Event(STOP_EVENT));
  }

  async function copyNotes() {
    if (!transcript) return;
    await navigator.clipboard.writeText(transcript);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  const status = !supported
    ? "مرورگر شما ضبط صدا را پشتیبانی نمی‌کند؛ از Chrome یا Safari جدید استفاده کنید."
    : !active
      ? "برای شروع، دکمه «شروع مکالمه» را بزنید."
      : agentSpeaking
        ? "آواتار در حال صحبت است…"
        : phase === "hearing"
          ? "صدای شما دریافت می‌شود…"
          : "در حال شنیدن فارسی… صحبت کنید.";

  return (
    <section
      dir="rtl"
      aria-label="یادداشت گفتار"
      className="absolute inset-x-3 bottom-3 z-20 mx-auto max-w-2xl rounded-md border border-border/70 bg-background/90 shadow-lg backdrop-blur-md sm:bottom-5"
    >
      <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2">
        <Button
          type="button"
          size="lg"
          variant={active ? "destructive" : "default"}
          onClick={active ? stopConversation : () => void startConversation()}
          disabled={!supported}
          className={`flex-1 text-base ${phase === "hearing" ? "animate-pulse" : ""}`}
        >
          {active ? <MicOff /> : <Mic />}
          {active ? "پایان مکالمه" : "شروع مکالمه"}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={copyNotes}
          disabled={!transcript}
          aria-label="کپی یادداشت"
          title="کپی یادداشت"
        >
          {copied ? <Check /> : <Clipboard />}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => setTranscript("")}
          disabled={!transcript}
          aria-label="پاک‌کردن یادداشت"
          title="پاک‌کردن یادداشت"
        >
          <Trash2 />
        </Button>
      </div>
      <p className="flex items-center gap-2 px-4 pt-2 text-xs text-muted-foreground">
        {status}
        {converting > 0 && (
          <span className="inline-flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            در حال تبدیل صدا به متن…
          </span>
        )}
      </p>
      <div
        aria-live="polite"
        className="max-h-28 min-h-14 overflow-y-auto whitespace-pre-line px-4 py-3 text-sm leading-7"
      >
        {error && <p className="text-destructive">{error}</p>}
        {transcript ? (
          <p className="text-foreground">{transcript}</p>
        ) : (
          !error && <p className="text-muted-foreground">صحبت‌های شما اینجا نوشته می‌شوند.</p>
        )}
      </div>
    </section>
  );
}
