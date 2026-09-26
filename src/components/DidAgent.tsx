import { useEffect, useRef, useState } from "react";
import type { DidSettings } from "@/lib/did-settings";

type Status = "loading" | "ready" | "error" | "empty";

type Props = {
  settings: DidSettings;
  onStatusChange?: (status: Status) => void;
};

type DidAgentsApi = {
  configure?: (options: Record<string, unknown>) => void;
  functions?: {
    interrupt?: () => void | Promise<void>;
    setWidgetOpen?: (open: boolean) => void | Promise<void>;
    speak?: (message: { type: "text"; input: string }) => void | Promise<void>;
    toggleMicState?: (muted: boolean) => void | Promise<void>;
    toggleSpeakerState?: (muted: boolean) => void | Promise<void>;
  };
};

declare global {
  interface Window {
    DID_AGENTS_API?: DidAgentsApi;
  }
}

const TARGET_ID = "did-agent-target";
const START_EVENT = "persian-conversation-start";
const STOP_EVENT = "persian-conversation-stop";
const SPEAK_EVENT = "persian-user-utterance";

export function DidAgent({ settings, onStatusChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);



  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  useEffect(() => {
    let greetingTimer: number | null = null;
    const muteTimers: number[] = [];
    const pending: string[] = [];
    let connected = false;

    const getAgentRoot = () => {
      const host = document.querySelector<HTMLElement>("[data-testid='didagent_root']");
      return host?.shadowRoot ?? null;
    };

    const clickNativeStart = () => {
      const root = getAgentRoot();
      const buttons = root ? Array.from(root.querySelectorAll<HTMLButtonElement>("button")) : [];
      const startButton = buttons.find((button) =>
        /start call|start conversation|شروع/i.test(`${button.textContent ?? ""} ${button.getAttribute("aria-label") ?? ""}`),
      );
      startButton?.click();
      return Boolean(startButton);
    };

    // The browser speech engine owns the microphone; keep the agent mic muted
    // so the two never fight over the same audio input device.
    const muteAgentMic = () => {
      void window.DID_AGENTS_API?.functions?.toggleMicState?.(true);
    };

    const speakText = (text: string) => {
      const speak = window.DID_AGENTS_API?.functions?.speak;
      if (!speak) {
        pending.push(text);
        return;
      }
      muteAgentMic();
      void speak({ type: "text", input: text });
    };

    const flushPending = () => {
      if (!window.DID_AGENTS_API?.functions?.speak) return;
      while (pending.length > 0) {
        const next = pending.shift();
        if (next) speakText(next);
      }
    };

    const handleUtterance = (event: Event) => {
      const text = (event as CustomEvent<{ text?: string }>).detail?.text?.trim();
      if (!text) return;
      void window.DID_AGENTS_API?.functions?.interrupt?.();
      speakText(text);
    };

    const startConversation = async () => {
      const api = window.DID_AGENTS_API;
      api?.configure?.({ autoConnect: true, openMode: "expanded" });
      await api?.functions?.setWidgetOpen?.(true);
      await api?.functions?.toggleSpeakerState?.(false);

      const clickedStart = clickNativeStart();
      connected = true;

      [200, 1200, 2500, 4000, 6000].forEach((delay) => {
        muteTimers.push(window.setTimeout(muteAgentMic, delay));
      });

      greetingTimer = window.setTimeout(() => {
        flushPending();
        const speak = window.DID_AGENTS_API?.functions?.speak;
        if (speak && pending.length === 0) void speak({ type: "text", input: "سلام، در خدمتم." });
      }, clickedStart ? 3500 : 2500);
    };

    const stopConversation = () => {
      if (greetingTimer !== null) window.clearTimeout(greetingTimer);
      greetingTimer = null;
      muteTimers.forEach((id) => window.clearTimeout(id));
      muteTimers.length = 0;
      pending.length = 0;
      connected = false;
      muteAgentMic();
      void window.DID_AGENTS_API?.functions?.interrupt?.();
    };

    const flushTimer = window.setInterval(() => {
      if (connected) flushPending();
    }, 1000);

    window.addEventListener(START_EVENT, startConversation);
    window.addEventListener(STOP_EVENT, stopConversation);
    window.addEventListener(SPEAK_EVENT, handleUtterance);
    return () => {
      if (greetingTimer !== null) window.clearTimeout(greetingTimer);
      muteTimers.forEach((id) => window.clearTimeout(id));
      window.clearInterval(flushTimer);
      window.removeEventListener(START_EVENT, startConversation);
      window.removeEventListener(STOP_EVENT, stopConversation);
      window.removeEventListener(SPEAK_EVENT, handleUtterance);
    };
  }, []);

  useEffect(() => {
    setStatus("loading");

    // Remove any previously injected agent so settings changes remount cleanly.
    document.querySelectorAll("script[data-lovable-did-agent]").forEach((el) => el.remove());
    const target = containerRef.current;
    if (target) target.innerHTML = "";

    const script = document.createElement("script");
    script.type = "module";
    script.src = settings.embed_script_url;
    script.setAttribute("data-lovable-did-agent", "true");
    // Always render full-screen inside our target container.
    script.setAttribute("data-mode", settings.mode === "fabio" ? "full" : settings.mode);
    script.setAttribute("data-client-key", settings.client_key);
    script.setAttribute("data-agent-id", settings.agent_id);
    script.setAttribute("data-name", settings.name);
    script.setAttribute("data-monitor", String(settings.monitor));
    script.setAttribute("data-light-mode", String(settings.light_mode));
    script.setAttribute("data-orientation", settings.orientation);
    script.setAttribute("data-position", settings.position);
    script.setAttribute("data-open-mode", settings.open_mode);
    script.setAttribute("data-target-id", TARGET_ID);
    script.setAttribute("data-auto-connect", "true");
    script.setAttribute("data-speech-silence-timeout-ms", "1200");
    script.onload = () => setStatus("ready");
    script.onerror = () => setStatus("error");

    document.body.appendChild(script);

    // If the embed never renders anything (wrong key, or this domain is not
    // allowed in the D-ID agent settings), surface a helpful hint.
    const timeout = window.setTimeout(() => {
      if (target && target.childElementCount === 0) setStatus("empty");
    }, 9000);


    return () => {
      window.clearTimeout(timeout);
      script.remove();
      document.querySelectorAll("script[data-lovable-did-agent]").forEach((el) => el.remove());
      if (target) target.innerHTML = "";
    };

  }, [
    settings.embed_script_url,
    settings.mode,
    settings.client_key,
    settings.agent_id,
    settings.name,
    settings.monitor,
    settings.light_mode,
    settings.orientation,
    settings.position,
    settings.open_mode,
  ]);

  return (
    <div className="relative h-full w-full">
      <div id={TARGET_ID} ref={containerRef} className="h-full w-full" />
      {status === "loading" && (
        <p className="pointer-events-none absolute inset-x-0 bottom-10 text-center text-sm text-muted-foreground">
          در حال بارگذاری آواتار…
        </p>
      )}
      {status === "error" && (
        <p className="pointer-events-none absolute inset-x-0 bottom-10 text-center text-sm text-destructive">
          بارگذاری آواتار ناموفق بود.
        </p>
      )}
      {status === "empty" && (
        <div dir="rtl" className="absolute inset-x-0 bottom-10 mx-auto max-w-md px-6 text-center">
          <p className="text-sm font-medium text-destructive">آواتار نمایش داده نشد</p>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            سرویس D-ID این آدرس را مجاز نمی‌داند. در پنل D-ID، بخش Manage Embed → Allowed Domains،
            دقیقاً همین آدرس را اضافه کنید:
          </p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <code dir="ltr" className="rounded-md border border-border bg-muted px-2 py-1 text-xs">
              {origin || "—"}
            </code>
            <button
              type="button"
              className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
              onClick={() => {
                if (!origin) return;
                void navigator.clipboard.writeText(origin).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                });
              }}
            >
              {copied ? "کپی شد" : "کپی"}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
