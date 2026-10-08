"use client";
/**
 * Voice I/O — client-side only.
 * Speech-to-text: Web Speech API (SpeechRecognition / webkitSpeechRecognition)
 * Text-to-speech: Groq TTS → ElevenLabs provider chain. No browser
 * speechSynthesis fallback — real-sounding voice or silence.
 */

import {
  TTS_PROVIDER,
  ELEVENLABS_VOICE_ID,
} from "./config";

// ─── Speech Recognition ───────────────────────────────────────────────────────

export type RecognitionHandler = (transcript: string, final: boolean) => void;
export type RecognitionErrorHandler = (error: string) => void;

let recognition: any = null;

export function isSpeechRecognitionSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
  );
}

export function startListening(
  onResult: RecognitionHandler,
  onError: RecognitionErrorHandler,
  onEnd: () => void
): void {
  if (!isSpeechRecognitionSupported()) {
    onError("Voice input needs Chrome or Edge — you can type instead.");
    return;
  }

  if (recognition) {
    recognition.abort();
  }

  const SR =
    (window as any).SpeechRecognition ??
    (window as any).webkitSpeechRecognition;
  recognition = new SR();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  recognition.onresult = (event: any) => {
    let interim = "";
    let final = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        final += t;
      } else {
        interim += t;
      }
    }
    if (final) {
      onResult(final.trim(), true);
    } else if (interim) {
      onResult(interim.trim(), false);
    }
  };

  recognition.onerror = (event: any) => {
    if (event.error === "not-allowed") {
      onError("Mic access denied — click the mic again and allow access.");
    } else if (event.error !== "aborted") {
      onError(`Recognition error: ${event.error}`);
    }
  };

  recognition.onend = onEnd;
  recognition.start();
}

export function stopListening(): void {
  if (recognition) {
    recognition.stop();
    recognition = null;
  }
}

// ─── Text-to-Speech (Groq → ElevenLabs, no browser fallback) ───────────────

export type VoiceIndicator = "groq" | "elevenlabs" | "off";

let currentVoiceIndicator: VoiceIndicator = "off";
/** The currently-playing Audio element — used by cancelSpeech() */
let activeAudio: HTMLAudioElement | null = null;
/** Object URL held by activeAudio that needs revoking on cancel */
let activeObjectUrl: string | null = null;

export function getCurrentVoiceIndicator(): VoiceIndicator {
  return currentVoiceIndicator;
}

/**
 * Speak text using the configured provider chain.
 *   "groq"       → Groq TTS only (via /api/tts)
 *   "elevenlabs" → ElevenLabs only
 *   "auto"       → Groq first, ElevenLabs second
 * Never touches browser speechSynthesis. Never rejects — logs and stays silent on failure.
 */
export async function speak(text: string): Promise<void> {
  currentVoiceIndicator = "off";

  const tryGroq = TTS_PROVIDER === "groq" || TTS_PROVIDER === "auto";
  const tryElevenLabs = TTS_PROVIDER === "elevenlabs" || TTS_PROVIDER === "auto";

  if (tryGroq) {
    try {
      await speakGroq(text);
      currentVoiceIndicator = "groq";
      return;
    } catch (e) {
      console.warn("[TTS] Groq TTS failed:", e);
    }
    // In "auto" mode, fall through to ElevenLabs silently
  }

  if (tryElevenLabs) {
    const key = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
    if (key) {
      try {
        await speakElevenLabs(text, key);
        currentVoiceIndicator = "elevenlabs";
        return;
      } catch (e) {
        console.warn("[TTS] ElevenLabs failed:", e);
      }
    } else if (TTS_PROVIDER === "elevenlabs") {
      console.warn("[TTS] NEXT_PUBLIC_ELEVENLABS_API_KEY not set — skipping speech.");
      return;
    }
  }

  // All configured providers exhausted — stay silent, never fall back to browser.
  console.warn("[TTS] All providers failed or unconfigured — staying silent.");
}

/** Cancel any currently-playing speech and clean up the object URL. */
export function cancelSpeech(): void {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.onended = null;
    activeAudio.onerror = null;
    activeAudio = null;
  }
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
  currentVoiceIndicator = "off";
}

// ─── Provider implementations ─────────────────────────────────────────────────

async function speakGroq(text: string): Promise<void> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const body = await res.text();
    // Special handling for terms acceptance error
    if (body.includes("model_terms_required")) {
      throw new Error(`Groq TTS: You must accept the model terms for canopylabs/orpheus-v1-english in the Groq console playground first.`);
    }
    throw new Error(`Groq TTS (via /api/tts) ${res.status} — ${body}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  await playAudio(new Audio(url), url);
}

async function speakElevenLabs(text: string, apiKey: string): Promise<void> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs TTS ${res.status} — ${body}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  await playAudio(new Audio(url), url);
}

/**
 * Stores the active Audio element in module-level refs so cancelSpeech()
 * can interrupt it mid-playback and revoke any object URL.
 */
function playAudio(audio: HTMLAudioElement, objectUrl: string | null): Promise<void> {
  // Stop anything currently playing before starting the new clip
  cancelSpeech();

  activeAudio = audio;
  activeObjectUrl = objectUrl;

  return new Promise<void>((resolve, reject) => {
    audio.onended = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      activeAudio = null;
      activeObjectUrl = null;
      resolve();
    };
    audio.onerror = (e) => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      activeAudio = null;
      activeObjectUrl = null;
      reject(e);
    };
    audio.play().catch(reject);
  });
}
