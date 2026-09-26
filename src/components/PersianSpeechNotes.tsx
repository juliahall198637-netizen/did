import { useEffect, useRef, useState } from "react";
import { Check, Clipboard, Mic, MicOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type SpeechResult = {
  isFinal: boolean;
  [index: number]: { transcript: string };
};

type SpeechResultEvent = Event & {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechResult;
  };
};

type SpeechErrorEvent = Event & { error: string };

type SpeechRecognitionInstance = EventTarget & {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type SpeechWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "اجازه میکروفون داده نشده است.",
  "service-not-allowed": "سرویس تشخیص گفتار در دسترس نیست.",
  "audio-capture": "میکروفون پیدا نشد یا در اختیار برنامه دیگری است.",
  network: "ارتباط با سرویس تشخیص گفتار برقرار نشد.",
  language: "تشخیص زبان فارسی در این مرورگر در دسترس نیست.",
  "no-speech": "صدایی شنیده نشد. نزدیک میکروفون و واضح‌تر صحبت کنید.",
};

const START_EVENT = "persian-conversation-start";
const STOP_EVENT = "persian-conversation-stop";
const SPEAK_EVENT = "persian-user-utterance";

export function PersianSpeechNotes() {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const shouldListenRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const recognitionActiveRef = useRef(false);
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setSupported(false);
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "fa-IR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      recognitionActiveRef.current = true;
      setListening(true);
      setError(null);
    };

    recognition.onaudiostart = () => setError(null);
    recognition.onspeechstart = () => setError(null);

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result) continue;
        const phrase = result?.[0]?.transcript?.trim();
        if (!phrase) continue;
        if (result.isFinal) finalText += `${phrase} `;
        else interimText += `${phrase} `;
      }
      if (finalText) {
        const sentence = finalText.trim();
        setTranscript((current) => `${current}${current ? " " : ""}${sentence}`);
        window.dispatchEvent(new CustomEvent(SPEAK_EVENT, { detail: { text: sentence } }));
      }
      setInterim(interimText.trim());
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted") return;
      if (event.error === "no-speech" && shouldListenRef.current) {
        setError(ERROR_MESSAGES["no-speech"] ?? "صدایی شنیده نشد. دوباره صحبت کنید.");
        return;
      }
      shouldListenRef.current = false;
      recognitionActiveRef.current = false;
      setListening(false);
      setError(ERROR_MESSAGES[event.error] ?? "تشخیص گفتار متوقف شد. دوباره تلاش کنید.");
    };

    recognition.onend = () => {
      recognitionActiveRef.current = false;
      setInterim("");
      if (!shouldListenRef.current) {
        setListening(false);
        return;
      }
      restartTimerRef.current = window.setTimeout(() => {
        try {
          recognition.lang = "fa-IR";
          recognition.start();
        } catch {
          shouldListenRef.current = false;
          setListening(false);
          setError("تشخیص گفتار متوقف شد. دوباره شروع کنید.");
        }
      }, 250);
    };

    recognitionRef.current = recognition;
    return () => {
      shouldListenRef.current = false;
      if (restartTimerRef.current !== null) window.clearTimeout(restartTimerRef.current);
      recognition.abort();
      recognitionActiveRef.current = false;
      recognitionRef.current = null;
    };
  }, []);

  function toggleListening() {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    setError(null);

    if (shouldListenRef.current) {
      shouldListenRef.current = false;
      setListening(false);
      setInterim("");
      window.dispatchEvent(new Event(STOP_EVENT));
      if (recognitionActiveRef.current) recognition.stop();
      return;
    }

    void startListening(recognition);
  }

  async function startListening(recognition: SpeechRecognitionInstance) {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("این مرورگر امکان دسترسی به میکروفون را ندارد. از Chrome استفاده کنید.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      stream.getTracks().forEach((t) => t.stop());
      shouldListenRef.current = true;
      setListening(true);
      recognition.lang = "fa-IR";
      window.dispatchEvent(new Event(START_EVENT));
      recognition.start();
    } catch (caught) {
      shouldListenRef.current = false;
      setListening(false);
      const errorName = caught instanceof DOMException ? caught.name : "";
      setError(
        errorName === "NotAllowedError"
          ? "دسترسی میکروفون بسته است. آن را از تنظیمات کنار نوار آدرس مجاز کنید."
          : "میکروفون یا تشخیص گفتار شروع نشد. در Chrome صفحه را تازه کنید و دوباره بزنید.",
      );
    }
  }

  async function copyNotes() {
    const text = [transcript, interim].filter(Boolean).join(" ");
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  const hasText = Boolean(transcript || interim);

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
          variant={listening ? "destructive" : "default"}
          onClick={toggleListening}
          disabled={!supported}
          className={`flex-1 text-base ${listening ? "animate-pulse" : ""}`}
        >
          {listening ? <MicOff /> : <Mic />}
          {listening ? "پایان مکالمه" : "شروع مکالمه"}
        </Button>
        <Button type="button" size="icon" variant="ghost" onClick={copyNotes} disabled={!hasText} aria-label="کپی یادداشت" title="کپی یادداشت">
          {copied ? <Check /> : <Clipboard />}
        </Button>
        <Button type="button" size="icon" variant="ghost" onClick={() => { setTranscript(""); setInterim(""); }} disabled={!hasText} aria-label="پاک‌کردن یادداشت" title="پاک‌کردن یادداشت">
          <Trash2 />
        </Button>
      </div>
      <p className="px-4 pt-2 text-xs text-muted-foreground">
        {!supported
          ? "مرورگر شما تشخیص گفتار فارسی را پشتیبانی نمی‌کند؛ از Chrome استفاده کنید."
          : listening
            ? "در حال شنیدن فارسی… صحبت کنید."
            : "برای شروع، دکمه «شروع مکالمه» را بزنید."}
      </p>
      <div aria-live="polite" className="max-h-28 min-h-14 overflow-y-auto px-4 py-3 text-sm leading-7">
        {error ? (
          <p className="text-destructive">{error}</p>
        ) : hasText ? (
          <p className="text-foreground">
            {transcript}
            {interim && <span className="text-muted-foreground"> {interim}</span>}
          </p>
        ) : (
          <p className="text-muted-foreground">صحبت‌های شما اینجا نوشته می‌شوند.</p>
        )}
      </div>
    </section>
  );
}