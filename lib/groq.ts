/**
 * Groq API helpers — server-side only.
 * Model: openai/gpt-oss-20b — never OpenAI or Anthropic.
 */
import Groq from "groq-sdk";
import { GROQ_MODEL, PERSONA_SYSTEM_PROMPT } from "./config";

let _groq: Groq | null = null;

export function getGroqClient(): Groq {
  if (_groq) return _groq;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set.");
  _groq = new Groq({ apiKey });
  return _groq;
}

/** Main chat completion */
export async function chatCompletion(
  messages: { role: "user" | "assistant" | "system"; content: string }[]
): Promise<string> {
  const groq = getGroqClient();
  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages,
    max_tokens: 512,
    temperature: 0.7,
  });
  return completion.choices[0]?.message?.content?.trim() ?? "";
}

/** Build a system message that includes persona + recalled memories + optional Gmail context */
export function buildSystemMessage(
  memories: string[],
  gmailContext?: { gmailToolsAvailable: boolean; gmailPermission?: "read-only" | "read-send" }
): string {
  const parts: string[] = [PERSONA_SYSTEM_PROMPT];

  if (memories.length > 0) {
    parts.push(
      `\n\n--- Memories you have about this user ---\n${memories.map((m, i) => `${i + 1}. ${m}`).join("\n")}`
    );
  }

  if (gmailContext?.gmailToolsAvailable) {
    let toolMsg = `\n\n--- Gmail Integration ---\nYou have Gmail tools available (gmail_search, gmail_digest, gmail_read). Whenever the user asks about their email, inbox, or messages, USE the tools — never claim you need permission and never ask them to grant access in Settings.`;
    if (gmailContext.gmailPermission === "read-only") {
      toolMsg += ` Only mention upgrading permission in Settings when the user asks to SEND email.`;
    }
    parts.push(toolMsg);
  }

  parts.push(
    `\n\nToday's date: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`
  );

  return parts.join("");
}

/** Classify a batch of email snippets into promos vs worth-your-time */
export async function classifyEmails(
  snippets: Array<{ subject: string; from: string; date: string; snippet: string }>
): Promise<{
  promos: number;
  flagged: Array<{ subject: string; from: string; reason: string }>;
  summary: string;
}> {
  const groq = getGroqClient();

  const prompt = `You are Rico, a sharp AI assistant. Classify these ${snippets.length} emails into:
- "promo": newsletters, marketing, automated notifications, receipts from services
- "worth_time": personal messages, bills, opportunities, anything that needs a human reply

Return a JSON object: { promos: number, flagged: [{ subject, from, reason }] }
Only include in flagged the 1-3 most worth checking, with a short one-line reason.

Emails:
${snippets.map((s, i) => `${i + 1}. From: ${s.from} | Subject: ${s.subject} | Date: ${s.date} | Preview: ${s.snippet}`).join("\n")}`;

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 400,
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? '{"promos":0,"flagged":[]}';
  let parsed: { promos?: number; flagged?: Array<{ subject: string; from: string; reason: string }> } = { promos: 0, flagged: [] };
  
  try {
    parsed = JSON.parse(raw);
  } catch {
    // keep default
  }

  const promos = parsed.promos ?? 0;
  const flagged = parsed.flagged ?? [];
  const flaggedCount = snippets.length - promos;
  const summary =
    flagged.length > 0
      ? `mostly noise — ${promos} promos. But you've got ${flagged.length === 1 ? "one" : flagged.length} worth opening: ${flagged.map((f: { from: string; reason: string }) => `${f.from} (${f.reason})`).join(", ")}. Want me to read it out?`
      : `${promos} promos, ${flaggedCount} other${flaggedCount !== 1 ? "s" : ""} — mostly noise, nothing urgent.`;
      
  return { promos, flagged, summary };
}

/** Condense a full email body to 2–3 spoken sentences */
export async function condenseEmail(
  subject: string,
  from: string,
  body: string
): Promise<string> {
  const groq = getGroqClient();
  const prompt = `Condense this email from ${from} (subject: "${subject}") to 2–3 natural spoken sentences. Be specific. Don't say "the email says" — just deliver the gist directly:\n\n${body.slice(0, 4000)}`;
  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 200,
    temperature: 0.5,
  });
  return completion.choices[0]?.message?.content?.trim() ?? "couldn't condense that one.";
}

/** Draft a reply to an email */
export async function draftReply(
  to: string,
  subject: string,
  originalBody: string,
  userInstruction: string
): Promise<string> {
  const groq = getGroqClient();
  const prompt = `Draft a professional but warm email reply. 
To: ${to}
Subject: Re: ${subject}
Original email excerpt: ${originalBody.slice(0, 1500)}
User's instruction: ${userInstruction}

Write only the email body — no "Subject:" line, no greeting preamble, just the content starting with the salutation.`;
  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 400,
    temperature: 0.6,
  });
  return completion.choices[0]?.message?.content?.trim() ?? "";
}

/** Extract salient facts from a conversation turn for memory storage.
 *  Uses plain-text mode — gpt-oss-20b 400s on response_format: json_object
 *  for short outputs. Worst case this returns []. */
export async function extractSalientFacts(
  userMessage: string,
  assistantReply: string
): Promise<string[]> {
  const groq = getGroqClient();

  // Truncate inputs so long inbox digests never blow the token budget
  const truncatedUser = userMessage.slice(0, 800);
  const truncatedReply = assistantReply.slice(0, 1200);

  const prompt = `From this exchange, list up to 5 salient facts worth remembering across sessions. One fact per line, no numbering, no bullets, no JSON. If nothing is worth remembering, reply with exactly: NONE.

User said: "${truncatedUser}"
Rico replied: "${truncatedReply}"`;

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 300,
    temperature: 0.2,
    // response_format intentionally omitted — json_object mode 400s on short outputs
  });

  const text = completion.choices[0]?.message?.content?.trim() ?? "";
  if (!text || /^none\.?$/i.test(text)) return [];
  return text
    .split("\n")
    .map((l) => l.replace(/^[-*\d.)\]]+\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 5);
}
