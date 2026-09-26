// Records the microphone and cuts it into one audio file per spoken sentence,
// using a simple loudness-based voice activity detector (VAD).

const TICK_MS = 50;
// Pause after speech that ends a sentence.
const SILENCE_MS = 900;
// Louder bursts shorter than this are treated as noise (a cough, a click).
const MIN_SPEECH_MS = 350;
// Long monologues are sent in pieces so text keeps appearing.
const MAX_SEGMENT_MS = 30_000;
// While nobody speaks, recorded silence is dropped this often.
const IDLE_RESET_MS = 3_000;
// Voice must be louder than this RMS level and NOISE_RATIO times the background.
const MIN_RMS = 0.012;
const NOISE_RATIO = 2.5;

const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

export type VoiceRecorderOptions = {
  onSegment: (audio: Blob) => void;
  onSpeechChange?: (speaking: boolean) => void;
  // While true (for example the avatar is talking), audio is recorded but discarded.
  isPaused: () => boolean;
};

export type VoiceRecorder = { stop: () => void };

type AudioContextWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

export function isVoiceRecordingSupported() {
  const audioWindow = window as AudioContextWindow;
  return Boolean(
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined" &&
    (audioWindow.AudioContext ?? audioWindow.webkitAudioContext),
  );
}

function pickMimeType() {
  return MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export function startVoiceRecorder(stream: MediaStream, options: VoiceRecorderOptions) {
  const audioWindow = window as AudioContextWindow;
  const AudioContextClass = audioWindow.AudioContext ?? audioWindow.webkitAudioContext!;
  const context = new AudioContextClass();
  void context.resume();
  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  context.createMediaStreamSource(stream).connect(analyser);
  const samples = new Float32Array(analyser.fftSize);

  const mimeType = pickMimeType();
  let segment = startSegment();
  let stopped = false;
  let speaking = false;
  let paused = false;
  let speechStart = 0;
  let lastVoice = 0;
  let noiseFloor = MIN_RMS / NOISE_RATIO;

  function startSegment() {
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32_000 })
      : new MediaRecorder(stream);
    const chunks: Blob[] = [];
    const current = { recorder, send: false, startedAt: performance.now() };
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      if (!current.send || chunks.length === 0) return;
      options.onSegment(new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" }));
    };
    recorder.start();
    return current;
  }

  // Start the next recorder before stopping the current one so no audio is lost.
  function cut(send: boolean) {
    const finished = segment;
    segment = startSegment();
    finished.send = send;
    if (finished.recorder.state !== "inactive") finished.recorder.stop();
  }

  function setSpeaking(next: boolean) {
    if (speaking === next) return;
    speaking = next;
    options.onSpeechChange?.(next);
  }

  function tick() {
    if (stopped) return;
    const now = performance.now();

    if (options.isPaused()) {
      if (!paused) {
        paused = true;
        setSpeaking(false);
        cut(false);
      }
      return;
    }
    if (paused) {
      paused = false;
      cut(false);
    }

    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (const sample of samples) sum += sample * sample;
    const rms = Math.sqrt(sum / samples.length);
    const threshold = Math.max(MIN_RMS, noiseFloor * NOISE_RATIO);

    if (rms > threshold) {
      if (!speaking) speechStart = now;
      lastVoice = now;
      setSpeaking(true);
    } else if (!speaking) {
      noiseFloor = noiseFloor * 0.95 + rms * 0.05;
    }

    if (speaking && now - lastVoice > SILENCE_MS) {
      setSpeaking(false);
      cut(lastVoice - speechStart >= MIN_SPEECH_MS);
    } else if (speaking && now - segment.startedAt > MAX_SEGMENT_MS) {
      speechStart = now;
      cut(true);
    } else if (!speaking && now - segment.startedAt > IDLE_RESET_MS) {
      cut(false);
    }
  }

  const timer = window.setInterval(tick, TICK_MS);

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      window.clearInterval(timer);
      segment.send = false;
      if (segment.recorder.state !== "inactive") segment.recorder.stop();
      stream.getTracks().forEach((track) => track.stop());
      void context.close();
    },
  } satisfies VoiceRecorder;
}
