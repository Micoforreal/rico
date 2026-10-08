// ─── Rico config — single source of truth ────────────────────────────────────

export const APP_NAME = "Rico";

/** Groq model — never OpenAI / Anthropic */
export const GROQ_MODEL = "openai/gpt-oss-20b";

/** MemWal relayer — must be staging for staging credentials */
export const MEMWAL_SERVER_URL =
  process.env.MEMWAL_SERVER_URL ??
  "https://relayer-staging.memory.walrus.xyz";

/**
 * Which Walrus network this relayer writes to.
 * "testnet" — relayer URL contains "staging" or "testnet"
 * "mainnet" — everything else
 */
export const WALRUS_NETWORK: "testnet" | "mainnet" =
  /staging|testnet/i.test(MEMWAL_SERVER_URL) ? "testnet" : "mainnet";

/** Return the Walruscan explorer URL for a given blob ID */
export function walrusScanUrl(blobId: string): string {
  return `https://walruscan.com/${WALRUS_NETWORK}/blob/${blobId}`;
}

/** Per-user namespace prefix */
export const NAMESPACE_PREFIX = "rico";

/** Maximum semantic distance to treat a recall result as relevant */
export const RECALL_MAX_DISTANCE = 0.8;

/** Near-duplicate threshold — skip the write if distance < this */
export const DEDUPE_DISTANCE = 0.25;

/** MemWal timeouts */
export const MEMWAL_TIMEOUT_MS = 25000;

/**
 * TTS provider:
 *   "groq"        → Groq TTS only (via /api/tts)
 *   "elevenlabs"  → ElevenLabs only
 *   "auto"        → Groq first, ElevenLabs second; silence on all failures
 * No browser speechSynthesis fallback — ever.
 */
export type TtsProvider = "groq" | "elevenlabs" | "auto";
export const TTS_PROVIDER: TtsProvider =
  (process.env.NEXT_PUBLIC_TTS_PROVIDER as TtsProvider | undefined) ??
  "auto";

/** Groq TTS voice (default: troy) */
export const GROQ_TTS_VOICE =
  process.env.GROQ_TTS_VOICE ?? "troy";

/** ElevenLabs voice ID — swap this env var to change the voice without touching code */
export const ELEVENLABS_VOICE_ID =
  process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID ?? "OhisAd2u8Q6qSA4xXAAT";

/** Demo user definitions — no real auth, no wallets */
export const DEMO_USERS = [
  {
    id: "user-ada",
    name: "Maya",
    label: "Gmail demo — invoice arc",
    permission: "read-only" as const,
  },
  {
    id: "user-tunde",
    name: "Daniel",
    label: "Gmail demo — read & send",
    permission: "read-send" as const,
  },
  {
    id: "user-alex",
    name: "Alex",
    label: "Mixed demo — recipes & reminders",
    permission: "read-only" as const,
  },
] as const;

export type DemoUserId = (typeof DEMO_USERS)[number]["id"];

/** Rico's personality — injected as the Groq system prompt persona block */
export const PERSONA_SYSTEM_PROMPT = `
You are Rico — a sharp, warm AI assistant with a real memory. You speak like a clever friend: playful, concise, occasionally cheeky. Light slang is welcome ("no wahala", "say less", "e don set") but never forced and never at the cost of clarity. Default to clean English with flavour, not heavy Pidgin, since your audience is global.

Rules:
- Short sentences. Lowercase-friendly. Zero corporate speak. No em dashes.
- Never say "as an AI" or "I don't have feelings."
- When you recall a stored memory, say so naturally — "oh — last Tuesday you asked about Maya's invoice..." — never announce "accessing memory" or "based on my memory."
- When you're working with Gmail context, be specific: name the sender, subject, amount.
- When you draft a reply to send, always show the full draft text and explicitly ask for a yes before sending.
- Never send without an explicit per-message confirmation.
- If Gmail is read-only and the user asks to send, explain politely and offer to upgrade permissions in Settings.
`.trim();
