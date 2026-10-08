/**
 * Gmail API helpers.
 * Uses the Supabase session.provider_token to call Gmail directly.
 * No Gmail secrets on the server — the token is the user's own OAuth token.
 */

export class GmailAuthExpiredError extends Error {
  constructor(message = "Gmail session expired") {
    super(message);
    this.name = "GmailAuthExpiredError";
  }
}

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export interface GmailMessage {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

export interface GmailFullMessage extends GmailMessage {
  body: string;
  to: string;
  messageId: string;
}

/** List message IDs matching a query */
async function listMessages(
  token: string,
  q: string,
  maxResults = 10
): Promise<string[]> {
  const url = `${GMAIL_BASE}/messages?q=${encodeURIComponent(q)}&maxResults=${maxResults}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    throw new GmailAuthExpiredError();
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail list failed: ${res.status} — ${body}`);
  }
  const data = await res.json();
  return (data.messages ?? []).map((m: { id: string }) => m.id);
}

/** Fetch message metadata */
async function fetchMessageMetadata(
  token: string,
  msgId: string
): Promise<GmailMessage> {
  const url = `${GMAIL_BASE}/messages/${msgId}?format=metadata&metadataHeaders=Subject,From,Date`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    throw new GmailAuthExpiredError();
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail list failed: ${res.status} — ${body}`);
  }
  const data = await res.json();
  const headers: Array<{ name: string; value: string }> = data.payload?.headers ?? [];
  const get = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
  return {
    id: msgId,
    subject: get("subject"),
    from: get("from"),
    date: get("date"),
    snippet: data.snippet ?? "",
  };
}

/** Decode base64url */
function decodeBase64Url(s: string): string {
  const base64 = s.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
  } catch {
    return atob(base64);
  }
}

/** Recursively extract text/plain from MIME parts */
function extractPlainText(payload: { mimeType?: string; body?: { data?: string }; parts?: unknown[] }): string {
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts) {
    for (const part of payload.parts as Array<{ mimeType?: string; body?: { data?: string }; parts?: unknown[] }>) {
      const text = extractPlainText(part);
      if (text) return text;
    }
  }
  return "";
}

/** Fetch full message with decoded body */
export async function fetchFullMessage(
  token: string,
  msgId: string
): Promise<GmailFullMessage> {
  const url = `${GMAIL_BASE}/messages/${msgId}?format=full`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    throw new GmailAuthExpiredError();
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail list failed: ${res.status} — ${body}`);
  }
  const data = await res.json();
  const headers: Array<{ name: string; value: string }> = data.payload?.headers ?? [];
  const get = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
  const body = extractPlainText(data.payload) || data.snippet || "";
  return {
    id: msgId,
    subject: get("subject"),
    from: get("from"),
    to: get("to"),
    date: get("date"),
    snippet: data.snippet ?? "",
    body,
    messageId: get("message-id"),
  };
}

/** Search for messages matching a query — returns top `limit` with metadata */
export async function searchMessages(
  token: string,
  query: string,
  limit = 3
): Promise<GmailMessage[]> {
  const ids = await listMessages(token, query, limit);
  const messages = await Promise.all(ids.map((id) => fetchMessageMetadata(token, id)));
  return messages;
}

/** Fetch the 25 most recent messages for inbox digest */
export async function fetchRecentMessages(
  token: string,
  maxResults = 25
): Promise<GmailMessage[]> {
  const url = `${GMAIL_BASE}/messages?maxResults=${maxResults}&q=newer_than:7d`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    throw new GmailAuthExpiredError();
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail list failed: ${res.status} — ${body}`);
  }
  const data = await res.json();
  const ids: string[] = (data.messages ?? []).map((m: { id: string }) => m.id);
  const messages = await Promise.all(ids.map((id) => fetchMessageMetadata(token, id)));
  return messages;
}

function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Send a raw MIME email */
export async function sendEmail(
  token: string,
  to: string,
  subject: string,
  body: string,
  inReplyToMsgId?: string
): Promise<{ id: string }> {
  const mimeLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "MIME-Version: 1.0",
    ...(inReplyToMsgId ? [`In-Reply-To: ${inReplyToMsgId}`] : []),
    "",
    body,
  ];
  const raw = base64UrlEncode(mimeLines.join("\r\n"));

  const res = await fetch(`${GMAIL_BASE}/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });
  if (res.status === 401) {
    throw new GmailAuthExpiredError();
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail send failed: ${res.status} — ${err}`);
  }
  return res.json();
}
