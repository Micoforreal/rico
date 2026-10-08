"use client";
/**
 * Voice I/O — client-side only.
 * Speech-to-text: Web Speech API (SpeechRecognition / webkitSpeechRecognition)
 * Text-to-speech: provider chain — Google Cloud TTS → ElevenLabs → browser speechSynthesis
 */

import {
  TTS_PROVIDER,
  GOOGLE_TTS_VOICE,
  GOOGLE_TTS_LANGUAGE,
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

// ─── Text-to-Speech ───────────────────────────────────────────────────────────

export type VoiceIndicator = "google" | "elevenlabs" | "browser" | "off";

let currentVoiceIndicator: VoiceIndicator = "off";

export function getCurrentVoiceIndicator(): VoiceIndicator {
  return currentVoiceIndicator;
}

/** Speaks text using the configured provider chain */
export async function speak(text: string): Promise<void> {
  // Google Cloud TTS
  if (TTS_PROVIDER === "google") {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_TTS_API_KEY;
    if (apiKey) {
      try {
        await speakGoogle(text, apiKey);
        currentVoiceIndicator = "google";
        return;
      } catch (e) {
        console.warn("[TTS] Google failed, falling back:", e);
      }
    }
  }

  // ElevenLabs
  if (TTS_PROVIDER === "elevenlabs" || TTS_PROVIDER === "google") {
    const elKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
    if (elKey) {
      try {
        await speakElevenLabs(text, elKey);
        currentVoiceIndicator = "elevenlabs";
        return;
      } catch (e) {
        console.warn("[TTS] ElevenLabs failed, falling back:", e);
      }
    }
  }

  // Browser speechSynthesis
  await speakBrowser(text);
  currentVoiceIndicator = "browser";
}

async function speakGoogle(text: string, apiKey: string): Promise<void> {
  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode: GOOGLE_TTS_LANGUAGE,
          name: GOOGLE_TTS_VOICE,
        },
        audioConfig: { audioEncoding: "MP3" },
      }),
    }
  );
  if (!res.ok) throw new Error(`Google TTS ${res.status}`);
  const data = await res.json();
  const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
  await new Promise<void>((resolve, reject) => {
    audio.onended = () => resolve();
    audio.onerror = reject;
    audio.play().catch(reject);
  });
}

async function speakElevenLabs(text: string, apiKey: string): Promise<void> {
  // Default voice: Rachel
  const voiceId = "21m00Tcm4TlvDq8ikWAM";
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_monolingual_v1",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  );
  if (!res.ok) throw new Error(`ElevenLabs TTS ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  await new Promise<void>((resolve, reject) => {
    audio.onended = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    audio.onerror = reject;
    audio.play().catch(reject);
  });
}

function speakBrowser(text: string): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!("speechSynthesis" in window)) {
      resolve();
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.0;
    utter.pitch = 1.0;

    const setVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(
        (v) =>
          v.lang.startsWith("en") && (v.name.includes("Female") || v.name.includes("Google"))
      );
      if (preferred) utter.voice = preferred;
    };

    if (window.speechSynthesis.getVoices().length > 0) {
      setVoice();
    } else {
      window.speechSynthesis.addEventListener("voiceschanged", setVoice, {
        once: true,
      });
    }

    utter.onend = () => resolve();
    utter.onerror = () => resolve();
    window.speechSynthesis.speak(utter);
  });
}

export function cancelSpeech(): void {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
